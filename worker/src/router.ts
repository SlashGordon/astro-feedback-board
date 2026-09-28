// Route table. Each route declares its guards as data: the site or approved
// feedback it targets, and for browser writes the rate limiter. A write always
// checks the request origin against the target's site. The handler receives
// the resolved values, typed by the guards it declared.
import type { Env } from "./env";
import { findFeedback, type FeedbackRef } from "./posts";
import { assertSiteOrigin, getSite, type Site } from "./sites";
import { dailyIpHash } from "./ip";
import { HttpError } from "./util";

type Limiter = "POST_LIMITER" | "VOTE_LIMITER";

/**
 * target "site": the :site param names a registered site.
 * target "feedback": the :id param names approved feedback; its site is loaded too.
 * write: origin check, paused-site check and rate limit keyed by the daily IP hash.
 */
type Guards = { target?: undefined; write?: undefined } | { target: "site" | "feedback"; write?: Limiter };

export interface RequestContext {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  /** Keeps the Worker alive for work after the response, like notifications. */
  waitUntil(promise: Promise<unknown>): void;
}

type Resolved<G extends Guards> = RequestContext &
  (G["target"] extends "site" | "feedback" ? { site: Site } : unknown) &
  (G["target"] extends "feedback" ? { feedback: FeedbackRef } : unknown) &
  (G["write"] extends Limiter ? { ipHash: string } : unknown);

export interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  guards: Guards;
  handle(ctx: RequestContext): Promise<Response>;
}

/** Declares a route. Path params look like ":site"; they match [\w-]+. */
export function route<const G extends Guards>(
  method: string,
  path: string,
  guards: G,
  handler: (ctx: Resolved<G>) => Response | Promise<Response>,
): Route {
  const keys: string[] = [];
  const source = path.replace(/:(\w+)/g, (_, key: string) => {
    keys.push(key);
    return "([\\w-]+)";
  });
  return {
    method,
    pattern: new RegExp(`^${source}$`),
    keys,
    guards,
    async handle(ctx) {
      return handler((await resolve(ctx, guards)) as Resolved<G>);
    },
  };
}

async function resolve(ctx: RequestContext, guards: Guards): Promise<Record<string, unknown>> {
  if (!guards.target) return { ...ctx };
  const db = ctx.env.DB;
  let feedback: FeedbackRef | undefined;
  let site: Site;
  if (guards.target === "feedback") {
    feedback = (await findFeedback(db, ctx.params.id, { approvedOnly: true })) ?? undefined;
    if (!feedback) throw new HttpError(404, "feedback_not_found");
    site = await getSite(db, feedback.site_id);
  } else {
    site = await getSite(db, ctx.params.site);
  }
  if (!guards.write) return { ...ctx, site, feedback };

  assertSiteOrigin(ctx.request, site);
  if (site.paused) throw new HttpError(503, "site_paused");
  const ipHash = await dailyIpHash(ctx.request, ctx.env.DB);
  const { success } = await ctx.env[guards.write].limit({ key: ipHash });
  if (!success) throw new HttpError(429, "rate_limited");
  return { ...ctx, site, feedback, ipHash };
}

/** Finds the route for a path and runs it. Unknown paths and methods answer 404. */
export function router(routes: Route[]) {
  return async (
    request: Request,
    env: Env,
    url: URL,
    path = url.pathname,
    waitUntil: (promise: Promise<unknown>) => void = () => {},
  ): Promise<Response> => {
    for (const r of routes) {
      if (r.method !== request.method) continue;
      const match = path.match(r.pattern);
      if (!match) continue;
      const params = Object.fromEntries(r.keys.map((key, i) => [key, match[i + 1]]));
      return r.handle({ request, env, url, params, waitUntil });
    }
    throw new HttpError(404, "not_found");
  };
}

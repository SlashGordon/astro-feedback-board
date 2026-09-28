import { verifyAccess } from "./access";
import { handleAdminApi } from "./admin/api";
import { adminHtml } from "./admin/ui";
import { deleteExpiredChallenges } from "./altcha";
import type { Env } from "./env";
import { deleteOldSalts } from "./ip";
import { forgetReactionIpHashes } from "./comments";
import { forgetPostIpHashes, purgeRejected } from "./posts";
import { publicRoutes } from "./public";
import { router } from "./router";
import { corsHeaders, isKnownOrigin } from "./sites";
import { deleteExpiredTrust } from "./trust";
import { error, HttpError } from "./util";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const IP_HASH_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

const routePublic = router(publicRoutes);

async function handle(request: Request, env: Env, waitUntil: (promise: Promise<unknown>) => void): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    const identity = await verifyAccess(request, env);
    if (!identity) return error(403, "forbidden");
    if (url.pathname.startsWith("/admin/api/")) {
      return handleAdminApi(request, env, url.pathname.slice("/admin/api".length), url);
    }
    return new Response(adminHtml, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy":
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'",
        "x-content-type-options": "nosniff",
      },
    });
  }

  if (url.pathname.startsWith("/v1/")) {
    const origin = request.headers.get("origin");
    const cors = origin && (await isKnownOrigin(env.DB, origin)) ? corsHeaders(origin) : {};
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    let response: Response;
    try {
      response = await routePublic(request, env, url, url.pathname, waitUntil);
    } catch (e) {
      response = toErrorResponse(e);
    }
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    return response;
  }

  if (url.pathname === "/") return new Response("astro-feedback-board\n", { headers: { "content-type": "text/plain" } });
  return error(404, "not_found");
}

function toErrorResponse(e: unknown): Response {
  if (e instanceof HttpError) return error(e.status, e.code, e.message);
  console.error(e);
  return error(500, "internal_error");
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      return await handle(request, env, (promise) => ctx.waitUntil(promise));
    } catch (e) {
      return toErrorResponse(e);
    }
  },

  async scheduled(_controller, env): Promise<void> {
    const now = Date.now();
    await purgeRejected(env.DB, now - RETENTION_MS);
    await deleteExpiredChallenges(env.DB, now);
    await deleteExpiredTrust(env.DB, now);
    await forgetPostIpHashes(env.DB, now - IP_HASH_RETENTION_MS);
    await forgetReactionIpHashes(env.DB, now - IP_HASH_RETENTION_MS);
    await deleteOldSalts(env.DB, new Date(now));
  },
} satisfies ExportedHandler<Env>;

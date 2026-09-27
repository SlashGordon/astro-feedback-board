// Public API used by the Astro components. Handlers translate HTTP into calls
// to the board views, comments and the post lifecycle; the guards sit in the
// route table.
import {
  checkBody,
  checkNickname,
  isArticleKey,
  isKind,
  isReaction,
  isTopicStatus,
  type ReactionRequest,
  type SubmitRequest,
  type SubmitResponse,
} from "astro-feedback-board/protocol";
import { consumeChallenge, createChallenge, verifySolution } from "./altcha";
import { getThread, listFeedback, toggleVote, visitorPosts } from "./board";
import { listComments, reactionSummary, toggleReaction } from "./comments";
import { normalizeContext, normalizeNickname, normalizePageUrl } from "./content";
import type { Env } from "./env";
import { deleteOwnPost, type Draft, submitPost } from "./posts";
import { route } from "./router";
import { getSite, type Site, siteOrigins } from "./sites";
import { authorHash, dailyIpHash, HttpError, json, newId, readJson, sha256 } from "./util";

type Untrusted<T> = { [K in keyof T]?: unknown };

/** One vote per post per device and day: author token combined with the daily IP hash. */
async function voterHash(request: Request, env: Env, ipHash?: string): Promise<string> {
  const ip = ipHash ?? (await dailyIpHash(request, env.IP_SALT_SECRET));
  return sha256(`vote:${(await authorHash(request)) ?? ""}:${ip}`);
}

/**
 * Reactor identity: the device token when there is one, so the visitor keeps
 * seeing their own reactions; otherwise the daily IP hash.
 */
async function reactorHash(request: Request, env: Env, ipHash?: string): Promise<string> {
  const author = await authorHash(request);
  if (author) return sha256(`rate:${author}`);
  return sha256(`rate:ip:${ipHash ?? (await dailyIpHash(request, env.IP_SALT_SECRET))}`);
}

/** Spam layer 1: humans never see the honeypot field, bots fill it. */
function filledHoneypot(input: { website?: unknown }): boolean {
  return typeof input.website === "string" && input.website.trim() !== "";
}

/** Spam layers 1 and 2: minimum fill time and proof of work, single use. */
async function verifyAltcha(env: Env, payload: unknown): Promise<void> {
  if (typeof payload !== "string") throw new HttpError(400, "altcha_missing");
  const result = await verifySolution(env.ALTCHA_HMAC_KEY, payload);
  if (!result.ok) throw new HttpError(400, `altcha_${result.reason}`);
  if (!(await consumeChallenge(env.DB, result.signature, result.expires))) {
    throw new HttpError(400, "altcha_replayed");
  }
}

function articleParam(value: unknown): string {
  if (!isArticleKey(value)) throw new HttpError(422, "invalid_article");
  return value;
}

/**
 * Runs the spam layers and normalizes the fields. Comments need an article
 * key; other posts ignore it. Returns null when the honeypot caught a bot: the
 * caller then answers with a fake success and stores nothing.
 */
async function readDraft(
  request: Request,
  env: Env,
  site: Site,
  { comment = false }: { comment?: boolean } = {},
): Promise<Draft | null> {
  const input = await readJson<Untrusted<SubmitRequest>>(request);
  if (filledHoneypot(input)) return null;

  const article = comment ? articleParam(input.article) : undefined;
  if (input.kind !== undefined && !isKind(input.kind)) throw new HttpError(422, "invalid_kind");
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const contentError = checkBody(body);
  if (contentError) throw new HttpError(422, contentError);
  const nickname = normalizeNickname(input.nickname);
  const nicknameError = nickname && checkNickname(nickname);
  if (nicknameError) throw new HttpError(422, nicknameError);

  await verifyAltcha(env, input.altcha);

  return {
    body,
    kind: input.kind,
    article,
    nickname,
    pageUrl: normalizePageUrl(input.page_url, siteOrigins(site)),
    context: normalizeContext(input.context),
  };
}

function submitted(result: SubmitResponse): Response {
  return json(result, { status: 201 });
}

export const publicRoutes = [
  route("GET", "/v1/challenge", {}, async ({ env }) =>
    json(await createChallenge(env.ALTCHA_HMAC_KEY), { headers: { "cache-control": "no-store" } }),
  ),

  route("GET", "/v1/sites/:site/feedback", { target: "site" }, async ({ request, env, url, site }) => {
    const status = url.searchParams.get("status");
    const kind = url.searchParams.get("kind");
    return json(
      await listFeedback(env.DB, site, {
        sort: url.searchParams.get("sort") === "new" ? "new" : "top",
        topicStatus: isTopicStatus(status) ? status : undefined,
        kind: isKind(kind) ? kind : undefined,
        voter: await voterHash(request, env),
      }),
    );
  }),

  route("POST", "/v1/sites/:site/feedback", { target: "site", write: "POST_LIMITER" }, async ({ request, env, site }) => {
    const draft = await readDraft(request, env, site);
    if (!draft) return submitted({ id: newId(), status: "pending" });
    return submitted(await submitPost(env.DB, site, null, draft, await authorHash(request)));
  }),

  route("GET", "/v1/sites/:site/comments", { target: "site" }, async ({ request, env, url, site }) =>
    json(
      await listComments(
        env.DB,
        site,
        articleParam(url.searchParams.get("article")),
        await reactorHash(request, env),
        await authorHash(request),
      ),
    ),
  ),

  route("POST", "/v1/sites/:site/comments", { target: "site", write: "POST_LIMITER" }, async ({ request, env, site }) => {
    const draft = await readDraft(request, env, site, { comment: true });
    if (!draft) return submitted({ id: newId(), status: "pending" });
    return submitted(await submitPost(env.DB, site, null, draft, await authorHash(request)));
  }),

  route("POST", "/v1/sites/:site/reactions", { target: "site", write: "VOTE_LIMITER" }, async ({ request, env, site, ipHash }) => {
    const input = await readJson<Untrusted<ReactionRequest>>(request);
    const article = articleParam(input.article);
    const voter = await reactorHash(request, env, ipHash);
    // A bot gets the current summary back as if its reaction counted.
    if (filledHoneypot(input)) return json(await reactionSummary(env.DB, site.id, article, voter));
    if (!isReaction(input.reaction)) throw new HttpError(422, "invalid_reaction");
    await verifyAltcha(env, input.altcha);
    return json(await toggleReaction(env.DB, site.id, article, voter, input.reaction));
  }),

  route("GET", "/v1/feedback/:id", {}, async ({ request, env, params }) =>
    json(await getThread(env.DB, params.id, await voterHash(request, env), await authorHash(request))),
  ),

  route(
    "POST",
    "/v1/feedback/:id/replies",
    { target: "feedback", write: "POST_LIMITER" },
    async ({ request, env, site, feedback }) => {
      const draft = await readDraft(request, env, site);
      if (!draft) return submitted({ id: newId(), status: "pending" });
      return submitted(await submitPost(env.DB, site, feedback, draft, await authorHash(request)));
    },
  ),

  route(
    "POST",
    "/v1/feedback/:id/vote",
    { target: "feedback", write: "VOTE_LIMITER" },
    async ({ request, env, feedback, ipHash }) =>
      json(await toggleVote(env.DB, feedback.id, await voterHash(request, env, ipHash))),
  ),

  route("GET", "/v1/me", {}, async ({ request, env, url }) => {
    const author = await authorHash(request);
    if (!author) throw new HttpError(401, "token_required");
    const site = await getSite(env.DB, url.searchParams.get("site") ?? "");
    return json(await visitorPosts(env.DB, site.id, author));
  }),

  route("DELETE", "/v1/posts/:id", {}, async ({ request, env, params }) => {
    const author = await authorHash(request);
    if (!author) throw new HttpError(401, "token_required");
    await deleteOwnPost(env.DB, params.id, author);
    return new Response(null, { status: 204 });
  }),
];

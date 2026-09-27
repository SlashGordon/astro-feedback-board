// Admin API under /admin/api. Only reachable after verifyAccess() succeeded.
import { checkBody, isKind, isTopicStatus, TEAM_RULES } from "astro-feedback-board/protocol";
import type { Env } from "../env";
import {
  createTeamReply,
  deletePost,
  findFeedback,
  isModerationAction,
  moderatePost,
  revokeTrust,
  updateFeedback,
} from "../posts";
import { route, router } from "../router";
import { defaultSettings, getSite, listSites, saveSite, type SiteInput } from "../sites";
import { grantTrust, listTrust, parseTrustKey, trustedSql } from "../trust";
import { HttpError, json, readJson } from "../util";

/** Team texts: any non-empty body up to the maximum length. */
function teamBody(value: unknown): string {
  const body = typeof value === "string" ? value.trim() : "";
  const error = checkBody(body, TEAM_RULES);
  if (error) throw new HttpError(422, error);
  return body;
}

const TRUSTED = trustedSql("p.author_hash", "p.site_id", "?1");

async function queue(db: D1Database, site: string | null): Promise<Response> {
  const statement = db.prepare(
    `SELECT p.id, p.site_id, s.name AS site_name, p.parent_id, p.kind, p.article, parent.body AS parent_body,
            p.page_url, p.body, p.nickname, p.author_hash, p.context, p.created_at,
            ${TRUSTED} AS trusted
     FROM posts p
     JOIN sites s ON s.id = p.site_id
     LEFT JOIN posts parent ON parent.id = p.parent_id
     WHERE p.status = 'pending' ${site ? "AND p.site_id = ?2" : ""}
     ORDER BY p.created_at
     LIMIT 500`,
  );
  const { results } = await (site ? statement.bind(Date.now(), site) : statement.bind(Date.now())).all();
  return json({ posts: results });
}

/** Recent board feedback, or with comments the recent comments on articles, each with its replies. */
async function recentPosts(db: D1Database, site: string | null, comments: boolean): Promise<Response> {
  const statement = db.prepare(
    `SELECT p.id, p.site_id, s.name AS site_name, p.kind, p.article, p.page_url, p.body, p.nickname, p.author_hash,
            p.status, p.topic_status, p.context, p.created_at,
            (SELECT COUNT(*) FROM votes v WHERE v.post_id = p.id) AS votes,
            ${TRUSTED} AS trusted
     FROM posts p JOIN sites s ON s.id = p.site_id
     WHERE p.parent_id IS NULL AND p.article IS ${comments ? "NOT NULL" : "NULL"}
       AND p.status IN ('pending', 'approved') ${site ? "AND p.site_id = ?2" : ""}
     ORDER BY p.created_at DESC
     LIMIT 100`,
  );
  const { results: feedback } = await (site ? statement.bind(Date.now(), site) : statement.bind(Date.now())).all<{
    id: string;
  }>();
  if (feedback.length === 0) return json({ feedback: [] });

  const placeholders = feedback.map(() => "?").join(",");
  const { results: replies } = await db
    .prepare(
      `SELECT id, parent_id, site_id, body, nickname, author_hash, is_team, status, created_at FROM posts
       WHERE parent_id IN (${placeholders}) AND status IN ('pending', 'approved')
       ORDER BY created_at`,
    )
    .bind(...feedback.map((f) => f.id))
    .all<{ parent_id: string }>();

  return json({
    feedback: feedback.map((f) => ({ ...f, replies: replies.filter((r) => r.parent_id === f.id) })),
  });
}

interface TrustBody {
  author_hash?: unknown;
  site_id?: unknown;
  days?: unknown;
  note?: unknown;
  /** Revoke only: move the device's approved posts back to the queue. */
  requeue?: unknown;
}

const handleAdminRoute = router([
  route("GET", "/queue", {}, ({ env, url }) => queue(env.DB, url.searchParams.get("site"))),

  route("POST", "/posts/:id/moderate", {}, async ({ request, env, params }) => {
    const input = await readJson<{ action?: unknown; body?: unknown }>(request);
    if (!isModerationAction(input.action)) throw new HttpError(400, "invalid_action");
    // Redacting can shorten a post, so the team rules apply.
    const redacted = input.body === undefined ? null : teamBody(input.body);
    const result = await moderatePost(env.DB, params.id, input.action, redacted);
    return json({ id: params.id, status: result.status, auto_trusted: result.autoTrusted });
  }),

  route("POST", "/posts/:id", {}, async ({ request, env, params }) => {
    const input = await readJson<{ kind?: unknown; topic_status?: unknown }>(request);
    if (input.kind !== undefined && !isKind(input.kind)) throw new HttpError(422, "invalid_kind");
    if (input.topic_status !== undefined && !isTopicStatus(input.topic_status)) {
      throw new HttpError(422, "invalid_topic_status");
    }
    await updateFeedback(env.DB, params.id, { kind: input.kind, topic_status: input.topic_status });
    return json({ id: params.id });
  }),

  route("DELETE", "/posts/:id", {}, async ({ env, params }) => {
    await deletePost(env.DB, params.id);
    return new Response(null, { status: 204 });
  }),

  route("GET", "/feedback", {}, ({ env, url }) => recentPosts(env.DB, url.searchParams.get("site"), false)),

  route("GET", "/comments", {}, ({ env, url }) => recentPosts(env.DB, url.searchParams.get("site"), true)),

  route("POST", "/feedback/:id/replies", {}, async ({ request, env, params }) => {
    const body = teamBody((await readJson<{ body?: unknown }>(request)).body);
    const parent = await findFeedback(env.DB, params.id, { approvedOnly: false, includeComments: true });
    if (!parent) throw new HttpError(404, "feedback_not_found");
    return json(await createTeamReply(env.DB, parent, body, env.TEAM_NAME || "Team"), { status: 201 });
  }),

  route("GET", "/trust", {}, async ({ env }) => json({ trust: await listTrust(env.DB) })),

  route("POST", "/trust", {}, async ({ request, env }) => {
    const input = await readJson<TrustBody>(request);
    const key = parseTrustKey(input.author_hash, input.site_id);
    if (key.siteId) await getSite(env.DB, key.siteId);
    await grantTrust(env.DB, key, {
      days: input.days === undefined ? 0 : (input.days as number),
      source: "manual",
      note: typeof input.note === "string" ? input.note : null,
    });
    return json({ author_hash: key.authorHash, site_id: key.siteId }, { status: 201 });
  }),

  route("DELETE", "/trust", {}, async ({ request, env }) => {
    const input = await readJson<TrustBody>(request);
    const key = parseTrustKey(input.author_hash, input.site_id);
    return json(await revokeTrust(env.DB, key, input.requeue === true));
  }),

  route("GET", "/sites", {}, async ({ env }) => json({ sites: await listSites(env.DB, true) })),

  route("POST", "/sites", {}, async ({ request, env }) => {
    const id = await saveSite(env.DB, await readJson<SiteInput>(request), defaultSettings(env));
    return json({ id }, { status: 201 });
  }),
]);

export async function handleAdminApi(request: Request, env: Env, path: string, url: URL): Promise<Response> {
  if (request.method !== "GET") {
    // Cross-site requests could ride on the Access cookie.
    const origin = request.headers.get("origin");
    if (origin !== url.origin) throw new HttpError(403, "cross_origin");
  }
  return handleAdminRoute(request, env, url, path);
}

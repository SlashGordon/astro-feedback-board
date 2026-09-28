// Post lifecycle: every write to the posts table goes through this module.
// Posts are board feedback, comments on an article (article set) or replies
// to either (parent_id set).
//
// A post starts as pending or approved (depending on the site's moderation
// mode and the device's trust), moves between the moderation statuses, and
// is deleted by its author, an admin or the retention cron. approved_at drives
// the reply badge, so only this module sets it.
import type {
  Kind,
  ModerationMode,
  PostStatus,
  SubmitResponse,
  TopicStatus,
} from "astro-feedback-board/protocol";
import { callsignNumber } from "./callsign";
import { getSite, type Site } from "./sites";
import { grantTrust, isTrusted, revokeStatement, type TrustKey } from "./trust";
import { HttpError, newId } from "./util";

export interface PostRow {
  id: string;
  site_id: string;
  /** NULL for feedback, the feedback id for a reply. */
  parent_id: string | null;
  kind: Kind;
  /** Article key for comments, NULL for board feedback and replies. */
  article: string | null;
  page_url: string | null;
  body: string;
  nickname: string | null;
  author_hash: string | null;
  /** The device's callsign number on the site, NULL for team posts and posts without a token. */
  author_seq: number | null;
  is_team: number;
  status: PostStatus;
  topic_status: TopicStatus | null;
  context: string | null;
  created_at: number;
  approved_at: number | null;
  /** Daily IP hash of the writer for the post caps, cleared after two days. */
  ip_hash: string | null;
}

/** A top-level post (feedback or comment) that replies, votes and team replies attach to. */
export interface FeedbackRef {
  id: string;
  site_id: string;
}

/** Finds board feedback, or with includeComments any top-level post. */
export async function findFeedback(
  db: D1Database,
  id: string,
  { approvedOnly, includeComments = false }: { approvedOnly: boolean; includeComments?: boolean },
): Promise<FeedbackRef | null> {
  return db
    .prepare(
      `SELECT id, site_id FROM posts WHERE id = ? AND parent_id IS NULL
       ${approvedOnly ? "AND status = 'approved'" : ""} ${includeComments ? "" : "AND article IS NULL"}`,
    )
    .bind(id)
    .first<FeedbackRef>();
}

/** Status a new visitor post starts with. */
export function initialStatus(mode: ModerationMode, trusted: boolean): "pending" | "approved" {
  if (mode === "none") return "approved";
  if (mode === "untrusted" && trusted) return "approved";
  return "pending";
}

/** A visitor post after validation. */
export interface Draft {
  body: string;
  /** Feedback only; replies and comments ignore it. */
  kind?: Kind;
  /** Makes a top-level post a comment on this article. */
  article?: string;
  nickname: string | null;
  pageUrl: string | null;
  context: string | null;
  /** Daily IP hash of the writer. Counts toward the per-IP caps. */
  ipHash?: string;
}

/** Posts per IP and UTC day, whatever became of them, deleted ones included. Trusted devices are exempt. */
export const DAILY_POSTS_PER_IP = 10;
/** Posts waiting in the queue per device or IP, across sites. Trusted devices are exempt. */
export const PENDING_PER_AUTHOR = 3;

/**
 * Caps that do not rely on the device token alone: a script can drop or
 * rotate it, but not its IP within a day.
 */
async function assertPostLimits(db: D1Database, author: string | null, ipHash: string | null, pending: boolean): Promise<void> {
  const counts = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM post_quota WHERE ip_hash = ?2) AS today,
              (SELECT COUNT(*) FROM posts WHERE status = 'pending' AND (author_hash = ?1 OR ip_hash = ?2)) AS pending`,
    )
    .bind(author, ipHash)
    .first<{ today: number; pending: number }>();
  if (counts && counts.today >= DAILY_POSTS_PER_IP) throw new HttpError(429, "daily_limit");
  if (pending && counts && counts.pending >= PENDING_PER_AUTHOR) throw new HttpError(429, "too_many_pending");
}

/** Stores a visitor's feedback, comment (draft.article, no parent) or reply. */
export async function submitPost(
  db: D1Database,
  site: Site,
  parent: FeedbackRef | null,
  draft: Draft,
  author: string | null,
  now = Date.now(),
): Promise<SubmitResponse> {
  const article = parent ? null : (draft.article ?? null);
  const mode = parent ? site.moderate_replies : article ? site.moderate_comments : site.moderate_feedback;
  const trusted = await isTrusted(db, author, site.id, now);
  const status = initialStatus(mode, trusted);
  const ipHash = draft.ipHash ?? null;
  if (!trusted) await assertPostLimits(db, author, ipHash, status === "pending");
  const id = newId();
  await insert(db, {
    id,
    site_id: site.id,
    parent_id: parent?.id ?? null,
    kind: parent || article ? "feedback" : (draft.kind ?? "feedback"),
    article,
    page_url: draft.pageUrl,
    body: draft.body,
    nickname: draft.nickname,
    author_hash: author,
    author_seq: author ? await callsignNumber(db, site.id, author) : null,
    is_team: 0,
    status,
    topic_status: parent || article ? null : "open",
    context: draft.context,
    created_at: now,
    approved_at: status === "approved" ? now : null,
    ip_hash: ipHash,
  });
  if (ipHash) await db.prepare("INSERT INTO post_quota (ip_hash, created_at) VALUES (?, ?)").bind(ipHash, now).run();
  return { id, status };
}

/** Team replies are always approved and carry the verified badge. */
export async function createTeamReply(
  db: D1Database,
  parent: FeedbackRef,
  body: string,
  teamName: string,
  now = Date.now(),
): Promise<SubmitResponse> {
  const id = newId();
  await insert(db, {
    id,
    site_id: parent.site_id,
    parent_id: parent.id,
    kind: "feedback",
    article: null,
    page_url: null,
    body,
    nickname: teamName,
    author_hash: null,
    author_seq: null,
    is_team: 1,
    status: "approved",
    topic_status: null,
    context: null,
    created_at: now,
    approved_at: now,
    ip_hash: null,
  });
  return { id, status: "approved" };
}

async function insert(db: D1Database, row: PostRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO posts (id, site_id, parent_id, kind, article, page_url, body, nickname, author_hash, author_seq, is_team,
                          status, topic_status, context, created_at, approved_at, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.site_id,
      row.parent_id,
      row.kind,
      row.article,
      row.page_url,
      row.body,
      row.nickname,
      row.author_hash,
      row.author_seq,
      row.is_team,
      row.status,
      row.topic_status,
      row.context,
      row.created_at,
      row.approved_at,
      row.ip_hash,
    )
    .run();
}

export type ModerationAction = "approve" | "reject" | "spam";

const ACTION_STATUS: Record<ModerationAction, PostStatus> = { approve: "approved", reject: "rejected", spam: "spam" };

export function isModerationAction(value: unknown): value is ModerationAction {
  return typeof value === "string" && value in ACTION_STATUS;
}

export interface ModerationResult {
  status: PostStatus;
  /** True if this approval made the device trusted automatically. */
  autoTrusted: boolean;
}

/**
 * Sets a post's moderation status, optionally with a redacted body. The first
 * approval sets approved_at; approving again (for example after an edit) keeps
 * it, so replies do not show up as new a second time.
 */
export async function moderatePost(
  db: D1Database,
  id: string,
  action: ModerationAction,
  redactedBody: string | null,
  now = Date.now(),
): Promise<ModerationResult> {
  const status = ACTION_STATUS[action];
  const post = await db
    .prepare(
      `UPDATE posts SET status = ?1, body = COALESCE(?2, body),
         approved_at = CASE WHEN ?1 = 'approved' THEN COALESCE(approved_at, ?3) ELSE approved_at END
       WHERE id = ?4
       RETURNING site_id, author_hash, is_team`,
    )
    .bind(status, redactedBody, now, id)
    .first<{ site_id: string; author_hash: string | null; is_team: number }>();
  if (!post) throw new HttpError(404, "post_not_found");

  const autoTrusted =
    status === "approved" && !post.is_team
      ? await applyAutoTrust(db, await getSite(db, post.site_id), post.author_hash, now)
      : false;
  return { status, autoTrusted };
}

/** Trusts the device once it reaches the site's auto_trust_after threshold of approved posts. */
async function applyAutoTrust(db: D1Database, site: Site, authorHash: string | null, now: number): Promise<boolean> {
  if (!authorHash || site.auto_trust_after <= 0) return false;
  if (await isTrusted(db, authorHash, site.id, now)) return false;
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS approved FROM posts WHERE author_hash = ? AND site_id = ? AND status = 'approved' AND is_team = 0",
    )
    .bind(authorHash, site.id)
    .first<{ approved: number }>();
  if ((row?.approved ?? 0) < site.auto_trust_after) return false;
  await grantTrust(db, { authorHash, siteId: site.id }, { days: site.auto_trust_days, source: "auto" }, now);
  return true;
}

/**
 * Revokes a device's trust. With requeue, its approved posts in the trust's
 * scope go back to the queue in the same transaction.
 */
export async function revokeTrust(db: D1Database, key: TrustKey, requeue: boolean): Promise<{ requeued: number }> {
  const statements = [revokeStatement(db, key)];
  if (requeue) {
    statements.push(
      db
        .prepare(
          `UPDATE posts SET status = 'pending', approved_at = NULL
           WHERE author_hash = ?1 AND status = 'approved' AND is_team = 0 AND (?2 = '' OR site_id = ?2)`,
        )
        .bind(key.authorHash, key.siteId),
    );
  }
  const results = await db.batch(statements);
  return { requeued: requeue ? results[1].meta.changes : 0 };
}

/** Changes the kind or topic status of a feedback post. */
export async function updateFeedback(
  db: D1Database,
  id: string,
  changes: { kind?: Kind; topic_status?: TopicStatus },
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE posts SET kind = COALESCE(?, kind), topic_status = COALESCE(?, topic_status)
       WHERE id = ? AND parent_id IS NULL AND article IS NULL`,
    )
    .bind(changes.kind ?? null, changes.topic_status ?? null, id)
    .run();
  if (result.meta.changes === 0) throw new HttpError(404, "feedback_not_found");
}

/**
 * Deletes a post. Its replies, votes, reports and seen rows go with it through
 * ON DELETE CASCADE; D1 enforces foreign keys.
 */
export async function deletePost(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

/** GDPR Art. 17: visitors delete their own posts with their token. */
export async function deleteOwnPost(db: D1Database, id: string, author: string): Promise<void> {
  const post = await db.prepare("SELECT author_hash FROM posts WHERE id = ?").bind(id).first<{ author_hash: string | null }>();
  if (!post) throw new HttpError(404, "post_not_found");
  if (post.author_hash !== author) throw new HttpError(403, "not_your_post");
  await deletePost(db, id);
}

/**
 * GDPR Art. 17 for a whole device: its posts (with the replies under them),
 * votes, reactions, reply-badge state, callsign and trust. Votes the device
 * cast before it had a token are keyed by the daily IP hash and cannot be tied
 * to it.
 */
export async function forgetDevice(db: D1Database, author: string, reactor: string, voter: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM posts WHERE author_hash = ?").bind(author),
    db.prepare("DELETE FROM seen WHERE author_hash = ?").bind(author),
    db.prepare("DELETE FROM votes WHERE voter_hash = ?").bind(voter),
    db.prepare("DELETE FROM reactions WHERE voter_hash = ?").bind(reactor),
    db.prepare("DELETE FROM callsigns WHERE author_hash = ?").bind(author),
    db.prepare("DELETE FROM trust WHERE author_hash = ?").bind(author),
  ]);
}

/** Retention: IP hashes are only needed for the daily caps. */
export async function forgetPostIpHashes(db: D1Database, cutoff: number): Promise<void> {
  await db.batch([
    db.prepare("UPDATE posts SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < ?").bind(cutoff),
    db.prepare("DELETE FROM post_quota WHERE created_at < ?").bind(cutoff),
  ]);
}

/** Retention: deletes rejected and spam posts created before the cutoff. */
export async function purgeRejected(db: D1Database, cutoff: number): Promise<number> {
  const result = await db
    .prepare("DELETE FROM posts WHERE status IN ('rejected', 'spam') AND created_at < ?")
    .bind(cutoff)
    .run();
  return result.meta.changes;
}

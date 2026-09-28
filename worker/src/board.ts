// What <FeedbackBoard /> shows: the approved feedback of a site, one thread,
// votes, and a visitor's own posts with their unseen replies.
import type {
  FeedbackListResponse,
  Kind,
  MePost,
  MeResponse,
  PublicPost,
  ThreadResponse,
  TopicStatus,
  VoteResponse,
} from "astro-feedback-board/protocol";
import { callsign } from "./callsign";
import type { PostRow } from "./posts";
import type { Site } from "./sites";
import { HttpError } from "./util";

type ListedPost = PostRow & { votes?: number; replies?: number; voted?: number };

export function publicPost(row: ListedPost): PublicPost {
  return {
    id: row.id,
    kind: row.parent_id || row.article ? undefined : row.kind,
    body: row.body,
    nickname: row.nickname,
    callsign: row.author_seq === null ? null : callsign(row.site_id, row.author_seq),
    is_team: row.is_team === 1,
    topic_status: row.topic_status,
    page_url: row.page_url,
    created_at: row.created_at,
    ...(row.votes !== undefined ? { votes: row.votes } : {}),
    ...(row.replies !== undefined ? { replies: row.replies } : {}),
    ...(row.voted !== undefined ? { voted: row.voted === 1 } : {}),
  };
}

export interface ListOptions {
  sort: "top" | "new";
  topicStatus?: TopicStatus;
  kind?: Kind;
  /** Marks the posts this voter voted for. */
  voter: string;
}

export async function listFeedback(db: D1Database, site: Site, options: ListOptions): Promise<FeedbackListResponse> {
  const order = options.sort === "new" ? "p.created_at DESC" : "votes DESC, p.created_at DESC";
  const filters: string[] = [];
  const params: unknown[] = [options.voter, site.id];
  if (options.topicStatus) {
    filters.push("AND p.topic_status = ?");
    params.push(options.topicStatus);
  }
  if (options.kind) {
    filters.push("AND p.kind = ?");
    params.push(options.kind);
  }
  const { results } = await db
    .prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM votes v WHERE v.post_id = p.id) AS votes,
         EXISTS (SELECT 1 FROM votes v WHERE v.post_id = p.id AND v.voter_hash = ?1) AS voted,
         (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id AND r.status = 'approved') AS replies
       FROM posts p
       WHERE p.site_id = ?2 AND p.parent_id IS NULL AND p.article IS NULL AND p.status = 'approved' ${filters.join(" ")}
       ORDER BY ${order}
       LIMIT 200`,
    )
    .bind(...params)
    .all<ListedPost>();
  return { site: { id: site.id, name: site.name }, feedback: results.map(publicPost) };
}

/** One approved feedback post with its approved replies. Opening a thread the author posted in clears its badge. */
export async function getThread(
  db: D1Database,
  id: string,
  voter: string,
  author: string | null,
  now = Date.now(),
): Promise<ThreadResponse> {
  const post = await db
    .prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM votes v WHERE v.post_id = p.id) AS votes,
         EXISTS (SELECT 1 FROM votes v WHERE v.post_id = p.id AND v.voter_hash = ?2) AS voted
       FROM posts p WHERE p.id = ?1 AND p.parent_id IS NULL AND p.article IS NULL AND p.status = 'approved'`,
    )
    .bind(id, voter)
    .first<ListedPost>();
  if (!post) throw new HttpError(404, "feedback_not_found");
  const { results } = await db
    .prepare("SELECT * FROM posts WHERE parent_id = ? AND status = 'approved' ORDER BY created_at")
    .bind(id)
    .all<PostRow>();

  if (author) {
    await db
      .prepare(
        `INSERT INTO seen (author_hash, post_id, last_seen_at)
         SELECT ?1, ?2, ?3 WHERE EXISTS (
           SELECT 1 FROM posts WHERE (id = ?2 OR parent_id = ?2) AND author_hash = ?1)
         ON CONFLICT (author_hash, post_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
      )
      .bind(author, id, now)
      .run();
  }

  return { feedback: publicPost(post), replies: results.map(publicPost) };
}

/**
 * Toggles the voter's vote on an approved feedback post. Each IP adds one vote
 * per post and day: a vote from a voter with another key (a new device token)
 * on the same IP is skipped and answers voted: false.
 */
export async function toggleVote(
  db: D1Database,
  feedbackId: string,
  voter: string,
  ipHash: string | null = null,
  now = Date.now(),
): Promise<VoteResponse> {
  const removed = await db
    .prepare("DELETE FROM votes WHERE post_id = ? AND voter_hash = ?")
    .bind(feedbackId, voter)
    .run();
  let voted = removed.meta.changes === 0;
  if (voted && ipHash) {
    const taken = await db
      .prepare("SELECT 1 FROM votes WHERE post_id = ? AND ip_hash = ? AND voter_hash != ?")
      .bind(feedbackId, ipHash, voter)
      .first();
    voted = !taken;
  }
  if (voted) {
    await db
      .prepare("INSERT INTO votes (post_id, voter_hash, created_at, ip_hash) VALUES (?, ?, ?, ?)")
      .bind(feedbackId, voter, now, ipHash)
      .run();
  }
  const count = await db
    .prepare("SELECT COUNT(*) AS votes FROM votes WHERE post_id = ?")
    .bind(feedbackId)
    .first<{ votes: number }>();
  return { voted, votes: count?.votes ?? 0 };
}

/** The visitor's own posts on a site, including pending and rejected ones, plus unseen replies per thread. */
export async function visitorPosts(db: D1Database, siteId: string, author: string): Promise<MeResponse> {
  const { results: posts } = await db
    .prepare(
      `SELECT p.id, p.parent_id, p.kind, p.article, p.page_url, p.body, p.status, p.topic_status, p.created_at,
              parent.body AS parent_body, parent.status AS parent_status,
              (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id AND r.status = 'approved') AS replies
       FROM posts p LEFT JOIN posts parent ON parent.id = p.parent_id
       WHERE p.author_hash = ? AND p.site_id = ? AND p.status != 'spam'
       ORDER BY p.created_at DESC
       LIMIT 100`,
    )
    .bind(author, siteId)
    .all<Omit<MePost, "thread_id" | "unseen"> & { parent_status: string | null }>();

  const { results: unseen } = await db
    .prepare(
      `WITH threads AS (
         SELECT COALESCE(parent_id, id) AS thread_id, MIN(created_at) AS since
         FROM posts WHERE author_hash = ?1 AND site_id = ?2 GROUP BY 1
       )
       SELECT t.thread_id, COUNT(r.id) AS unseen
       FROM threads t
       LEFT JOIN seen s ON s.author_hash = ?1 AND s.post_id = t.thread_id
       JOIN posts r ON r.parent_id = t.thread_id AND r.status = 'approved'
         AND (r.author_hash IS NULL OR r.author_hash != ?1)
         AND r.approved_at > COALESCE(s.last_seen_at, t.since)
       GROUP BY t.thread_id`,
    )
    .bind(author, siteId)
    .all<{ thread_id: string; unseen: number }>();
  const unseenByThread = new Map(unseen.map((u) => [u.thread_id, u.unseen]));

  return {
    posts: posts.map(({ parent_status, ...p }) => ({
      ...p,
      // A reply links to its thread only if the thread is public. Comments have no board thread.
      thread_id: p.article ? null : p.parent_id ? (parent_status === "approved" ? p.parent_id : null) : p.id,
      unseen: p.parent_id ? 0 : (unseenByThread.get(p.id) ?? 0),
    })),
    unseen: [...unseenByThread.values()].reduce((a, b) => a + b, 0),
  };
}

/** Retention: IP hashes are only needed for the one-vote-per-IP-and-day rule. */
export async function forgetVoteIpHashes(db: D1Database, cutoff: number): Promise<void> {
  await db.prepare("UPDATE votes SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < ?").bind(cutoff).run();
}

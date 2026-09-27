// Comments and reactions for an article, as <FeedbackComments /> shows them.
import { type CommentsResponse, type Reaction, REACTIONS, type ReactionSummary } from "astro-feedback-board/protocol";
import { publicPost } from "./board";
import type { PostRow } from "./posts";
import type { Site } from "./sites";

/**
 * Approved comments on an article with their approved replies, oldest first,
 * plus the reactions. Loading the comments clears the reply badge for the
 * visitor's own comments on this article.
 */
export async function listComments(
  db: D1Database,
  site: Site,
  article: string,
  voter: string,
  author: string | null,
  now = Date.now(),
): Promise<CommentsResponse> {
  const comments = `SELECT id FROM posts
                    WHERE site_id = ?1 AND article = ?2 AND parent_id IS NULL AND status = 'approved'`;
  const [top, replies] = await db.batch<PostRow>([
    db.prepare(`SELECT * FROM posts WHERE id IN (${comments}) ORDER BY created_at LIMIT 500`).bind(site.id, article),
    db
      .prepare(`SELECT * FROM posts WHERE parent_id IN (${comments}) AND status = 'approved' ORDER BY created_at`)
      .bind(site.id, article),
  ]);

  if (author) {
    await db
      .prepare(
        `INSERT INTO seen (author_hash, post_id, last_seen_at)
         SELECT ?1, id, ?2 FROM posts
         WHERE site_id = ?3 AND article = ?4 AND parent_id IS NULL AND author_hash = ?1
         ON CONFLICT (author_hash, post_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
      )
      .bind(author, now, site.id, article)
      .run();
  }

  return {
    comments: top.results.map((comment) => ({
      ...publicPost(comment),
      replies: replies.results.filter((r) => r.parent_id === comment.id).map(publicPost),
    })),
    reactions: await reactionSummary(db, site.id, article, voter),
  };
}

export async function reactionSummary(
  db: D1Database,
  siteId: string,
  article: string,
  voter: string,
): Promise<ReactionSummary> {
  const { results } = await db
    .prepare(
      `SELECT reaction, COUNT(*) AS count, MAX(voter_hash = ?3) AS mine
       FROM reactions WHERE site_id = ?1 AND article = ?2
       GROUP BY reaction`,
    )
    .bind(siteId, article, voter)
    .all<{ reaction: Reaction; count: number; mine: number }>();
  const counts = Object.fromEntries(REACTIONS.map((r) => [r, 0])) as Record<Reaction, number>;
  for (const row of results) counts[row.reaction] = row.count;
  return { counts, mine: REACTIONS.filter((r) => results.some((row) => row.reaction === r && row.mine === 1)) };
}

/** Sets the voter's reaction, or removes it if it was set. */
export async function toggleReaction(
  db: D1Database,
  siteId: string,
  article: string,
  voter: string,
  reaction: Reaction,
  now = Date.now(),
): Promise<ReactionSummary> {
  const removed = await db
    .prepare("DELETE FROM reactions WHERE site_id = ? AND article = ? AND voter_hash = ? AND reaction = ?")
    .bind(siteId, article, voter, reaction)
    .run();
  if (removed.meta.changes === 0) {
    await db
      .prepare("INSERT INTO reactions (site_id, article, voter_hash, reaction, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(siteId, article, voter, reaction, now)
      .run();
  }
  return reactionSummary(db, siteId, article, voter);
}

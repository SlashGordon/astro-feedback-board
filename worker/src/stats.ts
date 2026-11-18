// Statistics for the admin panel: activity per site, the articles with the
// most reactions and comments, and the feedback with the most votes. Posts
// count while they are pending or approved; rejected and spam posts and the
// votes on them are left out. A period counts posts, votes and reactions by
// the time they were created.
import { type Kind, type Reaction, REACTIONS, type TopicStatus } from "astro-feedback-board/protocol";
import { DAY_MS } from "./trust";
import { HttpError } from "./util";

/** Rows in the article and feedback rankings. */
const TOP_LIMIT = 10;
const MAX_DAYS = 3650;

export interface Counts {
  /** Board feedback. */
  feedback: number;
  /** Comments on articles. */
  comments: number;
  /** Replies by visitors. Team replies are not counted. */
  replies: number;
  /** Votes on feedback. */
  votes: number;
  /** Reactions on articles. */
  reactions: number;
}

export interface SiteStats extends Counts {
  id: string;
  name: string;
}

export interface ArticleStats {
  site_id: string;
  site_name: string;
  article: string;
  reactions: number;
  by_reaction: Record<Reaction, number>;
  comments: number;
}

export interface FeedbackStats {
  id: string;
  site_id: string;
  site_name: string;
  kind: Kind;
  topic_status: TopicStatus | null;
  body: string;
  created_at: number;
  votes: number;
}

export interface Stats {
  /** Sum of the listed sites. */
  totals: Counts;
  /** Every site, or only the requested one, the site with the most feedback first. */
  sites: SiteStats[];
  /** Articles with the most reactions, then comments. */
  articles: ArticleStats[];
  /** Feedback with the most votes. */
  feedback: FeedbackStats[];
}

export interface StatsOptions {
  /** Only this site. */
  site?: string | null;
  /** Only the last days. 0 = all time. */
  days?: number;
}

/** Validates the `days` query parameter. Missing or empty means all time. */
export function parseDays(value: string | null): number {
  const days = value ? Number(value) : 0;
  if (!Number.isInteger(days) || days < 0 || days > MAX_DAYS) throw new HttpError(422, "invalid_days");
  return days;
}

const COUNTED = "status IN ('pending', 'approved')";
// Reaction names are SQL keywords in part ("like"), so the columns get a prefix.
const REACTION_SUMS = REACTIONS.map((r) => `SUM(reaction = '${r}') AS r_${r}`).join(", ");
const REACTION_ZEROS = REACTIONS.map((r) => `0 AS r_${r}`).join(", ");
const REACTION_TOTALS = REACTIONS.map((r) => `SUM(a.r_${r}) AS r_${r}`).join(", ");

type ArticleRow = Omit<ArticleStats, "by_reaction"> & Record<`r_${Reaction}`, number>;

export async function getStats(db: D1Database, options: StatsOptions = {}, now = Date.now()): Promise<Stats> {
  const since = options.days ? now - options.days * DAY_MS : 0;
  const site = options.site || null;

  const [sites, articles, feedback] = await db.batch<unknown>([
    db
      .prepare(
        `SELECT s.id, s.name,
                COALESCE(p.feedback, 0) AS feedback, COALESCE(p.comments, 0) AS comments,
                COALESCE(p.replies, 0) AS replies, COALESCE(v.votes, 0) AS votes,
                COALESCE(r.reactions, 0) AS reactions
         FROM sites s
         LEFT JOIN (
           SELECT site_id,
                  SUM(parent_id IS NULL AND article IS NULL) AS feedback,
                  SUM(parent_id IS NULL AND article IS NOT NULL) AS comments,
                  SUM(parent_id IS NOT NULL AND is_team = 0) AS replies
           FROM posts WHERE ${COUNTED} AND created_at >= ?1 GROUP BY site_id
         ) p ON p.site_id = s.id
         LEFT JOIN (
           SELECT posts.site_id, COUNT(*) AS votes
           FROM votes JOIN posts ON posts.id = votes.post_id
           WHERE posts.${COUNTED} AND votes.created_at >= ?1 GROUP BY posts.site_id
         ) v ON v.site_id = s.id
         LEFT JOIN (
           SELECT site_id, COUNT(*) AS reactions FROM reactions WHERE created_at >= ?1 GROUP BY site_id
         ) r ON r.site_id = s.id
         WHERE ?2 IS NULL OR s.id = ?2
         ORDER BY feedback DESC, comments DESC, s.name`,
      )
      .bind(since, site),
    db
      .prepare(
        `SELECT a.site_id, s.name AS site_name, a.article,
                SUM(a.reactions) AS reactions, SUM(a.comments) AS comments, ${REACTION_TOTALS}
         FROM (
           SELECT site_id, article, COUNT(*) AS reactions, 0 AS comments, ${REACTION_SUMS}
           FROM reactions
           WHERE created_at >= ?1 AND (?2 IS NULL OR site_id = ?2) GROUP BY site_id, article
           UNION ALL
           SELECT site_id, article, 0 AS reactions, COUNT(*) AS comments, ${REACTION_ZEROS}
           FROM posts
           WHERE article IS NOT NULL AND parent_id IS NULL AND ${COUNTED}
             AND created_at >= ?1 AND (?2 IS NULL OR site_id = ?2) GROUP BY site_id, article
         ) a JOIN sites s ON s.id = a.site_id
         GROUP BY a.site_id, a.article
         ORDER BY reactions DESC, comments DESC, a.article
         LIMIT ${TOP_LIMIT}`,
      )
      .bind(since, site),
    db
      .prepare(
        `SELECT p.id, p.site_id, s.name AS site_name, p.kind, p.topic_status, p.body, p.created_at,
                COUNT(*) AS votes
         FROM votes v JOIN posts p ON p.id = v.post_id JOIN sites s ON s.id = p.site_id
         WHERE p.${COUNTED} AND v.created_at >= ?1 AND (?2 IS NULL OR p.site_id = ?2)
         GROUP BY p.id
         ORDER BY votes DESC, p.created_at DESC
         LIMIT ${TOP_LIMIT}`,
      )
      .bind(since, site),
  ]);

  const siteRows = sites.results as SiteStats[];
  const totals: Counts = { feedback: 0, comments: 0, replies: 0, votes: 0, reactions: 0 };
  for (const row of siteRows) {
    for (const key of Object.keys(totals) as (keyof Counts)[]) totals[key] += row[key];
  }

  return {
    totals,
    sites: siteRows,
    articles: (articles.results as ArticleRow[]).map((row) => ({
      site_id: row.site_id,
      site_name: row.site_name,
      article: row.article,
      reactions: row.reactions,
      by_reaction: Object.fromEntries(REACTIONS.map((r) => [r, row[`r_${r}`]])) as Record<Reaction, number>,
      comments: row.comments,
    })),
    feedback: feedback.results as FeedbackStats[],
  };
}

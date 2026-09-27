// Trusted devices. A device is an author_hash; its posts skip the queue on
// sites whose moderation mode is "untrusted". site_id '' means all sites and
// expires_at NULL means permanent.
import { HttpError } from "./util";

export const DAY_MS = 86_400_000;
export const NOTE_MAX_LENGTH = 200;

export interface TrustKey {
  authorHash: string;
  /** Site id, or "" for all sites. */
  siteId: string;
}

export interface Grant {
  /** 0 = permanent. */
  days: number;
  source: "manual" | "auto";
  note?: string | null;
}

/** Validates a trust key from the admin API. */
export function parseTrustKey(authorHash: unknown, siteId: unknown): TrustKey {
  if (typeof authorHash !== "string" || !/^[0-9a-f]{64}$/.test(authorHash)) {
    throw new HttpError(422, "invalid_author_hash");
  }
  return { authorHash, siteId: typeof siteId === "string" ? siteId : "" };
}

/**
 * SQL condition that is true while the device in `author` is trusted on the
 * site in `site`. The arguments are SQL expressions, for example column names
 * or parameters like "?1".
 */
export function trustedSql(author: string, site: string, now: string): string {
  return `EXISTS (SELECT 1 FROM trust t WHERE t.author_hash = ${author} AND t.site_id IN (${site}, '')
                  AND (t.expires_at IS NULL OR t.expires_at > ${now}))`;
}

export async function isTrusted(
  db: D1Database,
  authorHash: string | null,
  siteId: string,
  now = Date.now(),
): Promise<boolean> {
  if (!authorHash) return false;
  const row = await db
    .prepare(`SELECT ${trustedSql("?1", "?2", "?3")} AS trusted`)
    .bind(authorHash, siteId, now)
    .first<{ trusted: number }>();
  return row?.trusted === 1;
}

/** Trusts a device, replacing an earlier trust for the same key. An automatic grant keeps the admin's note. */
export async function grantTrust(db: D1Database, key: TrustKey, grant: Grant, now = Date.now()): Promise<void> {
  if (!Number.isInteger(grant.days) || grant.days < 0) throw new HttpError(422, "invalid_days");
  const note = grant.note?.trim().slice(0, NOTE_MAX_LENGTH) || null;
  await db
    .prepare(
      `INSERT INTO trust (author_hash, site_id, expires_at, source, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (author_hash, site_id) DO UPDATE SET expires_at = excluded.expires_at, source = excluded.source,
         note = CASE WHEN excluded.source = 'manual' THEN excluded.note ELSE trust.note END,
         created_at = excluded.created_at`,
    )
    .bind(key.authorHash, key.siteId, grant.days > 0 ? now + grant.days * DAY_MS : null, grant.source, note, now)
    .run();
}

/** Statement that removes a trust. Returned unexecuted so callers can batch it. */
export function revokeStatement(db: D1Database, key: TrustKey): D1PreparedStatement {
  return db.prepare("DELETE FROM trust WHERE author_hash = ? AND site_id = ?").bind(key.authorHash, key.siteId);
}

export interface TrustListing {
  author_hash: string;
  site_id: string;
  site_name: string | null;
  expires_at: number | null;
  source: "manual" | "auto";
  note: string | null;
  created_at: number;
  /** Posts of the device in the trust's scope, spam excluded. */
  posts: number;
}

export async function listTrust(db: D1Database): Promise<TrustListing[]> {
  const { results } = await db
    .prepare(
      `SELECT t.author_hash, t.site_id, s.name AS site_name, t.expires_at, t.source, t.note, t.created_at,
              (SELECT COUNT(*) FROM posts p WHERE p.author_hash = t.author_hash AND p.status != 'spam'
                 AND (t.site_id = '' OR p.site_id = t.site_id)) AS posts
       FROM trust t LEFT JOIN sites s ON s.id = t.site_id
       ORDER BY t.created_at DESC`,
    )
    .all<TrustListing>();
  return results;
}

export async function deleteExpiredTrust(db: D1Database, now = Date.now()): Promise<void> {
  await db.prepare("DELETE FROM trust WHERE expires_at < ?").bind(now).run();
}

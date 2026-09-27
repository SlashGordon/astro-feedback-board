// Registered sites: their origins (CORS and write checks) and moderation settings.
import { isModerationMode, type ModerationMode } from "astro-feedback-board/protocol";
import type { Env } from "./env";
import { HttpError } from "./util";

export interface Site {
  id: string;
  name: string;
  origin: string;
  moderate_feedback: ModerationMode;
  moderate_replies: ModerationMode;
  moderate_comments: ModerationMode;
  auto_trust_after: number;
  auto_trust_days: number;
  created_at: number;
}

export function siteOrigins(site: Pick<Site, "origin">): string[] {
  return site.origin.split(/[\s,]+/).filter(Boolean);
}

let cache: { sites: Site[]; at: number } | null = null;
const CACHE_MS = 60_000;

export async function listSites(db: D1Database, fresh = false): Promise<Site[]> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.sites;
  const { results } = await db.prepare("SELECT * FROM sites ORDER BY name").all<Site>();
  cache = { sites: results, at: Date.now() };
  return results;
}

export async function getSite(db: D1Database, id: string): Promise<Site> {
  const site = (await listSites(db)).find((s) => s.id === id) ?? (await listSites(db, true)).find((s) => s.id === id);
  if (!site) throw new HttpError(404, "site_not_found");
  return site;
}

/** True if the origin belongs to any registered site (CORS allowlist). */
export async function isKnownOrigin(db: D1Database, origin: string): Promise<boolean> {
  return (await listSites(db)).some((s) => siteOrigins(s).includes(origin));
}

/** Browser writes must come from one of the site's own origins. */
export function assertSiteOrigin(request: Request, site: Site): void {
  const origin = request.headers.get("origin");
  if (!origin || !siteOrigins(site).includes(origin)) throw new HttpError(403, "origin_not_allowed");
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, x-author-token",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

export type SiteSettings = Pick<
  Site,
  "moderate_feedback" | "moderate_replies" | "moderate_comments" | "auto_trust_after" | "auto_trust_days"
>;

/** Settings for new sites, from the Worker vars in wrangler.jsonc. */
export function defaultSettings(env: Env): SiteSettings {
  return {
    moderate_feedback: env.DEFAULT_MODERATE_FEEDBACK as ModerationMode,
    moderate_replies: env.DEFAULT_MODERATE_REPLIES as ModerationMode,
    moderate_comments: env.DEFAULT_MODERATE_COMMENTS as ModerationMode,
    auto_trust_after: Number(env.DEFAULT_AUTO_TRUST_AFTER),
    auto_trust_days: Number(env.DEFAULT_AUTO_TRUST_DAYS),
  };
}

export interface SiteInput {
  id?: unknown;
  name?: unknown;
  origin?: unknown;
  moderate_feedback?: unknown;
  moderate_replies?: unknown;
  moderate_comments?: unknown;
  auto_trust_after?: unknown;
  auto_trust_days?: unknown;
}

/** Creates or updates a site. Missing settings fall back to the defaults. */
export async function saveSite(db: D1Database, input: SiteInput, defaults: SiteSettings, now = Date.now()): Promise<string> {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) throw new HttpError(422, "invalid_site_id");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new HttpError(422, "name_required");
  const origins = (typeof input.origin === "string" ? input.origin : "").split(/[\s,]+/).filter(Boolean);
  if (origins.length === 0) throw new HttpError(422, "origin_required");
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new HttpError(422, "invalid_origin", origin);
    }
    if (parsed.origin !== origin) throw new HttpError(422, "invalid_origin", origin);
  }

  const moderateFeedback = input.moderate_feedback ?? defaults.moderate_feedback;
  const moderateReplies = input.moderate_replies ?? defaults.moderate_replies;
  const moderateComments = input.moderate_comments ?? defaults.moderate_comments;
  if (![moderateFeedback, moderateReplies, moderateComments].every(isModerationMode)) {
    throw new HttpError(422, "invalid_mode");
  }
  const autoTrustAfter = input.auto_trust_after ?? defaults.auto_trust_after;
  const autoTrustDays = input.auto_trust_days ?? defaults.auto_trust_days;
  if (!isCount(autoTrustAfter) || !isCount(autoTrustDays)) throw new HttpError(422, "invalid_auto_trust");

  await db
    .prepare(
      `INSERT INTO sites (id, name, origin, moderate_feedback, moderate_replies, moderate_comments,
                          auto_trust_after, auto_trust_days, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, origin = excluded.origin,
         moderate_feedback = excluded.moderate_feedback, moderate_replies = excluded.moderate_replies,
         moderate_comments = excluded.moderate_comments, auto_trust_after = excluded.auto_trust_after, auto_trust_days = excluded.auto_trust_days`,
    )
    .bind(id, name, origins.join(" "), moderateFeedback, moderateReplies, moderateComments, autoTrustAfter, autoTrustDays, now)
    .run();
  cache = null;
  return id;
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

// A real local D1 database (workerd through wrangler's platform proxy) with
// the migrations applied. Foreign keys are enforced like in production.
import { getPlatformProxy } from "wrangler";
import type { Env } from "../src/env";
import type { Site } from "../src/sites";

const migrations = import.meta.glob<string>("../migrations/*.sql", { query: "?raw", import: "default", eager: true });

/** Splits a migration into statements. Migrations contain no semicolons inside strings. */
function statements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Children first, so deletes never trip a foreign key.
const TABLES = ["post_quota", "ip_salts", "callsigns", "seen", "reports", "votes", "reactions", "helpful", "altcha_used", "trust", "posts", "sites"];

export async function createTestDb() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: new URL("../wrangler.jsonc", import.meta.url).pathname,
    persist: false,
  });
  const db = proxy.env.DB;
  for (const file of Object.keys(migrations).sort()) {
    for (const statement of statements(migrations[file])) await db.prepare(statement).run();
  }

  return {
    db,
    dispose: () => proxy.dispose(),
    async reset(): Promise<void> {
      // Replies reference their feedback, so delete them before top-level posts.
      await db.batch([
        ...TABLES.slice(0, TABLES.indexOf("posts")).map((t) => db.prepare(`DELETE FROM ${t}`)),
        db.prepare("DELETE FROM posts WHERE parent_id IS NOT NULL"),
        db.prepare("DELETE FROM posts"),
        db.prepare("DELETE FROM sites"),
      ]);
    },
  };
}

export const ORIGIN = "https://example.org";

export async function insertSite(db: D1Database, overrides: Partial<Site> = {}): Promise<Site> {
  const site: Site = {
    id: `site-${crypto.randomUUID().slice(0, 8)}`,
    name: "Example",
    origin: ORIGIN,
    moderate_feedback: "all",
    moderate_replies: "all",
    moderate_comments: "all",
    auto_trust_after: 0,
    auto_trust_days: 30,
    paused: 0,
    created_at: 0,
    ...overrides,
  };
  await db
    .prepare(
      `INSERT INTO sites (id, name, origin, moderate_feedback, moderate_replies, moderate_comments,
                          auto_trust_after, auto_trust_days, paused, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      site.id,
      site.name,
      site.origin,
      site.moderate_feedback,
      site.moderate_replies,
      site.moderate_comments,
      site.auto_trust_after,
      site.auto_trust_days,
      site.paused,
      site.created_at,
    )
    .run();
  return site;
}

export function testEnv(db: D1Database, limits: { post?: boolean; vote?: boolean } = {}): Env {
  const limiter = (ok = true): RateLimit => ({ limit: async () => ({ success: ok }) });
  return {
    DB: db,
    POST_LIMITER: limiter(limits.post),
    VOTE_LIMITER: limiter(limits.vote),
    ACCESS_TEAM_DOMAIN: "",
    ACCESS_AUD: "",
    TEAM_NAME: "Team",
    DEFAULT_MODERATE_FEEDBACK: "all",
    DEFAULT_MODERATE_REPLIES: "all",
    DEFAULT_MODERATE_COMMENTS: "all",
    DEFAULT_AUTO_TRUST_AFTER: "0",
    DEFAULT_AUTO_TRUST_DAYS: "30",
    ALTCHA_HMAC_KEY: "test-altcha-key",
    // Real difficulty would make every test solve ~125,000 hashes per challenge.
    ALTCHA_MAX_NUMBER: "1000",
    NTFY_URL: "",
  };
}

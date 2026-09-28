// The daily IP hash: sha256 of the IP with a random salt per UTC day. The salt
// lives in D1 and the cron deletes it after two days. From then on nobody,
// including the operator, can tell which IP a stored hash (on posts, votes and
// reactions) came from.
import { sha256, toHex } from "./util";

/** Days a salt is kept. Yesterday's salt stays so a request at midnight still matches. */
export const SALT_DAYS = 2;

const salts = new Map<string, string>();

async function saltFor(db: D1Database, day: string): Promise<string> {
  const cached = salts.get(day);
  if (cached) return cached;
  const random = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  // Two isolates may race at midnight; the first salt wins and both read it back.
  const [, row] = await db.batch<{ salt: string }>([
    db.prepare("INSERT OR IGNORE INTO ip_salts (day, salt) VALUES (?, ?)").bind(day, random),
    db.prepare("SELECT salt FROM ip_salts WHERE day = ?").bind(day),
  ]);
  const salt = row.results[0].salt;
  salts.clear();
  salts.set(day, salt);
  return salt;
}

/** Rate-limit key and per-IP cap key. Never the IP itself. */
export async function dailyIpHash(request: Request, db: D1Database, date = new Date()): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  return sha256(ip + (await saltFor(db, date.toISOString().slice(0, 10))));
}

/** Cron: deletes salts older than SALT_DAYS, which makes older hashes anonymous. */
export async function deleteOldSalts(db: D1Database, date = new Date()): Promise<void> {
  const cutoff = new Date(date.getTime() - (SALT_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  await db.prepare("DELETE FROM ip_salts WHERE day < ?").bind(cutoff).run();
}

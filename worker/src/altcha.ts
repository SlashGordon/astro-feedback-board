// Self-hosted ALTCHA proof of work (https://altcha.org), compatible with the
// ALTCHA v1 payload format. The salt carries the issue and expiry time, so the
// signature also proves when the form was rendered (minimum fill time).
import { type Challenge, MIN_FILL_MS } from "astro-feedback-board/protocol";
import { hmacSha256, safeEqual, sha256 } from "./util";

export const CHALLENGE_TTL_MS = 30 * 60 * 1000;
// Solving takes on average MAX_NUMBER / 2 hashes: about a second in a desktop
// browser. The components solve in the background while the visitor types.
export const MAX_NUMBER = 250_000;

export interface Solution {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
}

export async function createChallenge(key: string, at = Date.now()): Promise<Challenge> {
  const random = [...crypto.getRandomValues(new Uint8Array(12))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const salt = `${random}?issued=${at}&expires=${at + CHALLENGE_TTL_MS}`;
  const number = crypto.getRandomValues(new Uint32Array(1))[0] % MAX_NUMBER;
  const challenge = await sha256(salt + number);
  return {
    algorithm: "SHA-256",
    challenge,
    maxnumber: MAX_NUMBER,
    salt,
    signature: await hmacSha256(key, challenge),
  };
}

export type VerifyResult =
  | { ok: true; signature: string; expires: number }
  | { ok: false; reason: "invalid" | "expired" | "too_fast" };

export async function verifySolution(key: string, payload: string, at = Date.now()): Promise<VerifyResult> {
  let solution: Solution;
  try {
    solution = JSON.parse(atob(payload)) as Solution;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (
    solution?.algorithm !== "SHA-256" ||
    typeof solution.salt !== "string" ||
    typeof solution.challenge !== "string" ||
    typeof solution.signature !== "string" ||
    !Number.isInteger(solution.number)
  ) {
    return { ok: false, reason: "invalid" };
  }

  const params = new URLSearchParams(solution.salt.split("?")[1] ?? "");
  const issued = Number(params.get("issued"));
  const expires = Number(params.get("expires"));
  if (!issued || !expires) return { ok: false, reason: "invalid" };

  const expected = await hmacSha256(key, solution.challenge);
  if (!safeEqual(expected, solution.signature)) return { ok: false, reason: "invalid" };
  if (!safeEqual(await sha256(solution.salt + solution.number), solution.challenge)) {
    return { ok: false, reason: "invalid" };
  }
  if (at > expires) return { ok: false, reason: "expired" };
  if (at - issued < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  return { ok: true, signature: solution.signature, expires };
}

/** Records a solved challenge. Returns false if it was used before. */
export async function consumeChallenge(db: D1Database, signature: string, expires: number): Promise<boolean> {
  const result = await db
    .prepare("INSERT INTO altcha_used (signature, expires_at) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .bind(signature, expires)
    .run();
  return result.meta.changes === 1;
}

export async function deleteExpiredChallenges(db: D1Database, now = Date.now()): Promise<void> {
  await db.prepare("DELETE FROM altcha_used WHERE expires_at < ?").bind(now).run();
}

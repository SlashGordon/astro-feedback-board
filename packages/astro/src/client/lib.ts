import type { Strings } from "../i18n";
import { type Challenge, VISITOR_RULES } from "../protocol";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Brute-forces an ALTCHA challenge and returns the base64 payload. */
export async function solveChallenge(c: Challenge, batch = 250): Promise<string> {
  for (let start = 0; start <= c.maxnumber; start += batch) {
    const numbers = Array.from({ length: Math.min(batch, c.maxnumber - start + 1) }, (_, i) => start + i);
    const hashes = await Promise.all(numbers.map((n) => sha256Hex(c.salt + n)));
    const index = hashes.indexOf(c.challenge);
    if (index !== -1) {
      return btoa(
        JSON.stringify({
          algorithm: c.algorithm,
          challenge: c.challenge,
          number: numbers[index],
          salt: c.salt,
          signature: c.signature,
        }),
      );
    }
  }
  throw new Error("altcha_unsolvable");
}

export function issuedAt(c: Challenge): number {
  return Number(new URLSearchParams(c.salt.split("?")[1] ?? "").get("issued")) || Date.now();
}

export function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merges the ask question, the static context prop and the runtime context hook. */
export function buildContext(question: string | undefined, fromProp: unknown, fromHook: unknown): unknown {
  const context: Record<string, unknown> = {};
  if (question) context.question = question;
  for (const part of [fromProp, fromHook]) {
    if (part === undefined || part === null) continue;
    if (isPlainObject(part)) Object.assign(context, part);
    else context.value = part;
  }
  return Object.keys(context).length ? context : undefined;
}

/** Maps a Worker error code to a message. {n} in the content-rule messages is the limit. */
export function errorMessage(code: string | undefined, t: Strings): string {
  const limit = (text: string, n: number) => text.replace("{n}", String(n));
  switch (code) {
    case "too_short":
      return limit(t.errorTooShort, VISITOR_RULES.minLength);
    case "too_long":
      return limit(t.errorTooLong, VISITOR_RULES.maxLength);
    case "too_many_links":
      return limit(t.errorTooManyLinks, VISITOR_RULES.maxLinks);
    case "nickname_email":
      return t.errorNicknameEmail;
    case "nickname_phone":
      return t.errorNicknamePhone;
    case "rate_limited":
      return t.errorRateLimited;
    default:
      return t.errorGeneric;
  }
}

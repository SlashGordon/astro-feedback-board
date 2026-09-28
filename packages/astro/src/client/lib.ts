import type { Strings } from "../i18n";
import { type Challenge, VISITOR_RULES } from "../protocol";

/**
 * Finds the number n with sha256(salt + n) = challenge, or -1. Compares raw
 * bytes, so there are no hex strings per hash. It runs inside a Web Worker as
 * source text (see solveInWorker), so it must not use anything from outside
 * its own body except browser globals.
 */
export async function findNumber(salt: string, challenge: string, max: number, pause: boolean): Promise<number> {
  const target = (challenge.match(/../g) ?? []).map((hex) => parseInt(hex, 16));
  const encoder = new TextEncoder();
  for (let start = 0; start <= max; start += 500) {
    const end = Math.min(start + 500, max + 1);
    const jobs: Promise<ArrayBuffer>[] = [];
    for (let n = start; n < end; n++) jobs.push(crypto.subtle.digest("SHA-256", encoder.encode(salt + n)));
    const hashes = await Promise.all(jobs);
    for (let i = 0; i < hashes.length; i++) {
      const bytes = new Uint8Array(hashes[i]);
      let j = 0;
      while (j < 32 && bytes[j] === target[j]) j++;
      if (j === 32) return start + i;
    }
    // On the main thread, give the browser a moment for input and paint between batches.
    if (pause) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return -1;
}

/** Runs findNumber in a Web Worker. Rejects when the page cannot start one, for example because of its CSP. */
function solveInWorker(c: Challenge): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === "undefined") return reject(new Error("no_worker"));
    const source = `onmessage = async (e) => postMessage(await (${findNumber.toString()})(e.data.salt, e.data.challenge, e.data.max, false));`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    let worker: Worker;
    try {
      worker = new Worker(url);
    } catch (error) {
      URL.revokeObjectURL(url);
      return reject(error);
    }
    const done = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    worker.onmessage = (event: MessageEvent<number>) => {
      done();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      done();
      reject(new Error("worker_failed"));
    };
    worker.postMessage({ salt: c.salt, challenge: c.challenge, max: c.maxnumber });
  });
}

/** Brute-forces an ALTCHA challenge off the main thread and returns the base64 payload. */
export async function solveChallenge(c: Challenge): Promise<string> {
  const number = await solveInWorker(c).catch(() => findNumber(c.salt, c.challenge, c.maxnumber, true));
  if (number < 0) throw new Error("altcha_unsolvable");
  return btoa(
    JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number, salt: c.salt, signature: c.signature }),
  );
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
    case "daily_limit":
      return t.errorDailyLimit;
    case "too_many_pending":
      return t.errorTooManyPending;
    case "site_paused":
      return t.errorPaused;
    default:
      return t.errorGeneric;
  }
}

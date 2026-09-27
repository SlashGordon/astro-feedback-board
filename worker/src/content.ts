// Normalizes the optional fields of a visitor post. The body rules live in
// the shared protocol (checkBody), so the form checks the same rules.
import { NICKNAME_MAX_LENGTH } from "astro-feedback-board/protocol";
import { HttpError } from "./util";

export const MAX_CONTEXT_BYTES = 4096;

export function normalizeNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim().slice(0, NICKNAME_MAX_LENGTH);
  return trimmed || null;
}

export function normalizeContext(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = JSON.stringify(value);
  if (text.length > MAX_CONTEXT_BYTES) throw new HttpError(400, "context_too_large");
  return text;
}

/** Keeps origin and path of a page URL on one of the site's origins, drops everything else. */
export function normalizePageUrl(value: unknown, origins: string[]): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return origins.includes(url.origin) ? url.origin + url.pathname : null;
  } catch {
    return null;
  }
}

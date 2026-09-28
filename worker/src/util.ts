const encoder = new TextEncoder();

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(input)));
}

export async function hmacSha256(key: string, input: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(input)));
}

/** Constant-time comparison for equal-length hex strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ID_ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyz";

export function newId(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(status: number, code: string, message?: string): Response {
  return json({ error: code, message: message ?? code }, { status });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export async function readJson<T>(request: Request, maxBytes = 16_384): Promise<T> {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "payload_too_large");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

/** Author tokens are 128-bit random values, hex encoded by the client. */
export async function authorHash(request: Request): Promise<string | null> {
  const token = request.headers.get("x-author-token");
  if (!token || !/^[0-9a-f]{32}$/.test(token)) return null;
  return sha256(`author:${token}`);
}


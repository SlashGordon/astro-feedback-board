// Verifies the Cloudflare Access JWT in front of /admin, so the admin panel
// stays closed even if the Access application is misconfigured or bypassed.
import type { Env } from "./env";

interface Jwk extends JsonWebKey {
  kid: string;
}

let cachedKeys: { domain: string; keys: Jwk[]; fetchedAt: number } | null = null;
const KEY_CACHE_MS = 60 * 60 * 1000;

async function getKeys(teamDomain: string, forceRefresh = false): Promise<Jwk[]> {
  if (
    !forceRefresh &&
    cachedKeys?.domain === teamDomain &&
    Date.now() - cachedKeys.fetchedAt < KEY_CACHE_MS
  ) {
    return cachedKeys.keys;
  }
  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs: HTTP ${response.status}`);
  const { keys } = (await response.json()) as { keys: Jwk[] };
  cachedKeys = { domain: teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export interface AccessIdentity {
  email: string;
}

export async function verifyAccess(request: Request, env: Env): Promise<AccessIdentity | null> {
  if (env.DEV_SKIP_ACCESS === "true") return { email: "dev@localhost" };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

  const token =
    request.headers.get("cf-access-jwt-assertion") ??
    request.headers.get("cookie")?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  if (!token) return null;

  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  let header: { alg: string; kid: string };
  let payload: { aud: string | string[]; iss: string; exp: number; nbf?: number; email?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  } catch {
    return null;
  }
  if (header.alg !== "RS256") return null;

  let jwk = (await getKeys(env.ACCESS_TEAM_DOMAIN)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getKeys(env.ACCESS_TEAM_DOMAIN, true)).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlDecode(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(env.ACCESS_AUD)) return null;
  if (payload.iss !== env.ACCESS_TEAM_DOMAIN) return null;
  if (payload.exp < nowSeconds) return null;
  if (payload.nbf && payload.nbf > nowSeconds + 60) return null;

  return { email: payload.email ?? "unknown" };
}

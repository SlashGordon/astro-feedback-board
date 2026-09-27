// Through the Worker's fetch handler: route guards, CORS and a full submit.
import { MIN_FILL_MS, type Challenge } from "astro-feedback-board/protocol";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { sha256 } from "../src/util";
import { createTestDb, insertSite, ORIGIN, testEnv } from "./db";

const test = await createTestDb();
const db = test.db;
const TOKEN = "0123456789abcdef0123456789abcdef";

beforeEach(() => test.reset());
afterEach(() => vi.useRealTimers());
afterAll(() => test.dispose());

function call(path: string, init: RequestInit = {}, env = testEnv(db)): Promise<Response> {
  const request = new Request(`https://feedback.test${path}`, init);
  return worker.fetch(request as Request<unknown, IncomingRequestCfProperties>, env);
}

function post(path: string, body: unknown, headers: Record<string, string> = {}, env = testEnv(db)) {
  return call(path, { method: "POST", body: JSON.stringify(body), headers: { origin: ORIGIN, ...headers } }, env);
}

async function solve(c: Challenge): Promise<string> {
  for (let n = 0; n <= c.maxnumber; n++) {
    if ((await sha256(c.salt + n)) === c.challenge) {
      return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature }));
    }
  }
  throw new Error("unsolvable");
}

/** Fetches and solves a challenge, then moves the clock past the minimum fill time. */
async function altcha(): Promise<string> {
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() });
  const payload = await solve(await (await call("/v1/challenge")).json());
  vi.setSystemTime(Date.now() + MIN_FILL_MS);
  return payload;
}

describe("guards", () => {
  it("answers CORS preflights only for registered origins", async () => {
    await insertSite(db);
    const known = await call("/v1/challenge", { method: "OPTIONS", headers: { origin: ORIGIN } });
    const unknown = await call("/v1/challenge", { method: "OPTIONS", headers: { origin: "https://evil.test" } });
    expect(known.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(unknown.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects writes from other origins before reading the body", async () => {
    const site = await insertSite(db);
    const res = await post(`/v1/sites/${site.id}/feedback`, {}, { origin: "https://evil.test" });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "origin_not_allowed" });
  });

  it("rate limits writes", async () => {
    const site = await insertSite(db);
    const res = await post(`/v1/sites/${site.id}/feedback`, {}, {}, testEnv(db, { post: false }));
    expect(res.status).toBe(429);
  });

  it("refuses votes and replies on feedback that is not approved", async () => {
    const site = await insertSite(db);
    await db
      .prepare(
        "INSERT INTO posts (id, site_id, body, status, created_at) VALUES ('pending1', ?, 'Noch nicht freigegeben', 'pending', 0)",
      )
      .bind(site.id)
      .run();
    for (const path of ["/v1/feedback/pending1/vote", "/v1/feedback/pending1/replies"]) {
      const res = await post(path, {});
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: "feedback_not_found" });
    }
  });

  it("answers 404 for unknown routes and methods", async () => {
    expect((await call("/v1/nope")).status).toBe(404);
    expect((await call("/v1/challenge", { method: "DELETE" })).status).toBe(404);
  });

  it("requires a token for /v1/me", async () => {
    const site = await insertSite(db);
    expect((await call(`/v1/me?site=${site.id}`)).status).toBe(401);
  });
});

describe("submitting", () => {
  it("stores feedback, lists it and blocks a replayed challenge", async () => {
    const site = await insertSite(db, { moderate_feedback: "none" });
    const payload = await altcha();
    const body = { body: "Bitte einen Dark Mode einbauen", kind: "idea", altcha: payload, page_url: `${ORIGIN}/x?y=1` };

    const created = await post(`/v1/sites/${site.id}/feedback`, body, { "x-author-token": TOKEN });
    expect(created.status).toBe(201);
    const { id, status } = await created.json<{ id: string; status: string }>();
    expect(status).toBe("approved");

    const list = await (await call(`/v1/sites/${site.id}/feedback`)).json<{ feedback: { id: string; kind: string }[] }>();
    expect(list.feedback).toMatchObject([{ id, kind: "idea" }]);

    const replay = await post(`/v1/sites/${site.id}/feedback`, body);
    expect(await replay.json()).toMatchObject({ error: "altcha_replayed" });

    const me = await call(`/v1/me?site=${site.id}`, { headers: { "x-author-token": TOKEN } });
    expect(await me.json()).toMatchObject({ posts: [{ id, status: "approved" }], unseen: 0 });
  });

  it("pretends to accept posts that filled the honeypot and stores nothing", async () => {
    const site = await insertSite(db);
    const res = await post(`/v1/sites/${site.id}/feedback`, { body: "Kaufen Sie jetzt billig ein", website: "spam.test" });
    expect(res.status).toBe(201);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM posts").first("n")).toBe(0);
  });

  it("rejects nicknames with contact data before checking the challenge", async () => {
    const site = await insertSite(db);
    const res = await post(`/v1/sites/${site.id}/feedback`, {
      body: "Ein ausreichend langer Text",
      nickname: "Hans 0171 1234567",
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "nickname_phone" });
  });

  it("rejects bodies that break the content rules", async () => {
    const site = await insertSite(db);
    const res = await post(`/v1/sites/${site.id}/feedback`, { body: "zu kurz" });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "too_short" });
  });
});

describe("comments and reactions", () => {
  it("stores a comment for an article and rejects a bad article key", async () => {
    const site = await insertSite(db, { moderate_comments: "none" });
    const bad = await post(`/v1/sites/${site.id}/comments`, { body: "Ein ausreichend langer Text", article: "<script>" });
    expect(await bad.json()).toMatchObject({ error: "invalid_article" });

    const res = await post(`/v1/sites/${site.id}/comments`, {
      body: "Ein ausreichend langer Text",
      article: "/blog/hello",
      altcha: await altcha(),
    });
    expect(await res.json()).toMatchObject({ status: "approved" });
    const list = await (await call(`/v1/sites/${site.id}/comments?article=%2Fblog%2Fhello`)).json<{ comments: unknown[] }>();
    expect(list.comments).toHaveLength(1);
  });

  it("needs a solved challenge for a reaction and toggles it per device", async () => {
    const site = await insertSite(db);
    const token = { "x-author-token": TOKEN };
    const missing = await post(`/v1/sites/${site.id}/reactions`, { article: "/a", reaction: "like" }, token);
    expect(await missing.json()).toMatchObject({ error: "altcha_missing" });

    const on = await post(`/v1/sites/${site.id}/reactions`, { article: "/a", reaction: "unicorn", altcha: await altcha() }, token);
    expect(await on.json()).toMatchObject({ counts: { unicorn: 1 }, mine: ["unicorn"] });
    const off = await post(`/v1/sites/${site.id}/reactions`, { article: "/a", reaction: "unicorn", altcha: await altcha() }, token);
    expect(await off.json()).toMatchObject({ counts: { unicorn: 0 }, mine: [] });
  });

  it("pretends to accept reactions that filled the honeypot", async () => {
    const site = await insertSite(db);
    const res = await post(`/v1/sites/${site.id}/reactions`, { article: "/a", reaction: "fire", website: "spam.test" });
    expect(await res.json()).toMatchObject({ counts: { fire: 0 }, mine: [] });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM reactions").first("n")).toBe(0);
  });

  it("rejects unknown reactions", async () => {
    const site = await insertSite(db);
    const res = await post(`/v1/sites/${site.id}/reactions`, { article: "/a", reaction: "poop" });
    expect(await res.json()).toMatchObject({ error: "invalid_reaction" });
  });
});

describe("admin API", () => {
  const adminEnv = () => ({ ...testEnv(db), DEV_SKIP_ACCESS: "true" });
  const admin = (path: string, method: string, body?: unknown, origin = "https://feedback.test") =>
    call(`/admin/api${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { origin } }, adminEnv());

  it("blocks cross-origin writes", async () => {
    expect((await admin("/sites", "POST", {}, "https://evil.test")).status).toBe(403);
  });

  it("approves from the queue and answers with a short team reply", async () => {
    const site = await insertSite(db);
    await db
      .prepare("INSERT INTO posts (id, site_id, body, status, created_at) VALUES ('q1', ?, 'Wartet auf Freigabe', 'pending', 0)")
      .bind(site.id)
      .run();
    const queue = await (await admin("/queue", "GET")).json<{ posts: { id: string; trusted: number }[] }>();
    expect(queue.posts).toMatchObject([{ id: "q1", trusted: 0 }]);

    expect((await admin("/posts/q1/moderate", "POST", { action: "approve" })).status).toBe(200);
    const reply = await admin("/feedback/q1/replies", "POST", { body: "Ok" });
    expect(reply.status).toBe(201);
    expect(await reply.json()).toMatchObject({ status: "approved" });
  });

  it("validates site settings", async () => {
    const res = await admin("/sites", "POST", { id: "demo", name: "Demo", origin: ORIGIN, moderate_feedback: "sometimes" });
    expect(await res.json()).toMatchObject({ error: "invalid_mode" });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTeamReply,
  deletePost,
  deleteOwnPost,
  type Draft,
  moderatePost,
  purgeRejected,
  revokeTrust,
  submitPost,
} from "../src/posts";
import { DAY_MS, grantTrust, isTrusted } from "../src/trust";
import { sha256 } from "../src/util";
import { createTestDb, insertSite } from "./db";

const test = await createTestDb();
const db = test.db;
let alice: string;
let bob: string;

const draft = (body = "Ein ausreichend langer Text"): Draft => ({ body, nickname: null, pageUrl: null, context: null });

async function row(id: string) {
  return db
    .prepare("SELECT status, approved_at, body FROM posts WHERE id = ?")
    .bind(id)
    .first<{ status: string; approved_at: number | null; body: string }>();
}

async function count(table: string): Promise<number> {
  return (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
}

beforeAll(async () => {
  alice = await sha256("alice");
  bob = await sha256("bob");
});
beforeEach(() => test.reset());
afterAll(() => test.dispose());

describe("submitPost", () => {
  it("holds every post in mode 'all', even from trusted devices", async () => {
    const site = await insertSite(db);
    await grantTrust(db, { authorHash: alice, siteId: site.id }, { days: 0, source: "manual" });
    const { status } = await submitPost(db, site, null, draft(), alice);
    expect(status).toBe("pending");
  });

  it("lets trusted devices through in mode 'untrusted' and sets approved_at", async () => {
    const site = await insertSite(db, { moderate_feedback: "untrusted" });
    await grantTrust(db, { authorHash: alice, siteId: "" }, { days: 0, source: "manual" });
    const trusted = await submitPost(db, site, null, draft(), alice, 1000);
    const unknown = await submitPost(db, site, null, draft(), bob, 1000);
    expect(trusted.status).toBe("approved");
    expect((await row(trusted.id))?.approved_at).toBe(1000);
    expect(unknown.status).toBe("pending");
  });

  it("uses the reply mode for replies", async () => {
    const site = await insertSite(db, { moderate_feedback: "all", moderate_replies: "none" });
    const feedback = await submitPost(db, site, null, draft(), alice);
    const reply = await submitPost(db, site, { id: feedback.id, site_id: site.id }, draft(), bob);
    expect(feedback.status).toBe("pending");
    expect(reply.status).toBe("approved");
  });
});

describe("moderatePost", () => {
  it("sets approved_at on the first approval only", async () => {
    const site = await insertSite(db);
    const { id } = await submitPost(db, site, null, draft(), alice, 1);
    await moderatePost(db, id, "approve", null, 100);
    await moderatePost(db, id, "approve", "Redigierter Text ohne Namen", 200);
    expect(await row(id)).toEqual({ status: "approved", approved_at: 100, body: "Redigierter Text ohne Namen" });
  });

  it("trusts a device automatically after enough approvals", async () => {
    const site = await insertSite(db, { auto_trust_after: 2, auto_trust_days: 7 });
    const first = await submitPost(db, site, null, draft(), alice);
    const second = await submitPost(db, site, null, draft(), alice);
    expect((await moderatePost(db, first.id, "approve", null)).autoTrusted).toBe(false);
    expect((await moderatePost(db, second.id, "approve", null, 0)).autoTrusted).toBe(true);
    expect(await isTrusted(db, alice, site.id, 7 * DAY_MS - 1)).toBe(true);
    expect(await isTrusted(db, alice, site.id, 7 * DAY_MS + 1)).toBe(false);
  });

  it("keeps the admin's note when an automatic grant replaces an expired manual one", async () => {
    const site = await insertSite(db, { auto_trust_after: 1 });
    await grantTrust(db, { authorHash: alice, siteId: site.id }, { days: 1, source: "manual", note: "Hans" }, 0);
    const { id } = await submitPost(db, site, null, draft(), alice, 2 * DAY_MS);
    await moderatePost(db, id, "approve", null, 2 * DAY_MS);
    const trust = await db.prepare("SELECT source, note FROM trust").first();
    expect(trust).toEqual({ source: "auto", note: "Hans" });
  });

  it("answers 404 for unknown posts", async () => {
    await expect(moderatePost(db, "missing", "approve", null)).rejects.toMatchObject({ status: 404 });
  });
});

describe("revokeTrust", () => {
  it("moves only the device's approved visitor posts in scope back to the queue", async () => {
    const site = await insertSite(db, { moderate_feedback: "untrusted" });
    const other = await insertSite(db, { moderate_feedback: "untrusted" });
    await grantTrust(db, { authorHash: alice, siteId: "" }, { days: 0, source: "manual" });
    const here = await submitPost(db, site, null, draft(), alice);
    const there = await submitPost(db, other, null, draft(), alice);
    const team = await createTeamReply(db, { id: here.id, site_id: site.id }, "Danke!", "Team");

    const { requeued } = await revokeTrust(db, { authorHash: alice, siteId: site.id }, true);
    expect(requeued).toBe(1);
    expect(await row(here.id)).toMatchObject({ status: "pending", approved_at: null });
    expect(await row(there.id)).toMatchObject({ status: "approved" });
    expect(await row(team.id)).toMatchObject({ status: "approved" });
  });
});

describe("deleting", () => {
  it("removes replies, votes, reports and seen rows with the post", async () => {
    const site = await insertSite(db, { moderate_feedback: "none", moderate_replies: "none" });
    const feedback = await submitPost(db, site, null, draft(), alice);
    const reply = await submitPost(db, site, { id: feedback.id, site_id: site.id }, draft(), bob);
    await db.batch([
      db.prepare("INSERT INTO votes (post_id, voter_hash, created_at) VALUES (?, 'v', 0)").bind(feedback.id),
      db.prepare("INSERT INTO reports (id, post_id, created_at) VALUES ('r', ?, 0)").bind(reply.id),
      db.prepare("INSERT INTO seen (author_hash, post_id, last_seen_at) VALUES (?, ?, 0)").bind(alice, feedback.id),
    ]);

    expect(await deletePost(db, feedback.id)).toBe(true);
    for (const table of ["posts", "votes", "reports", "seen"]) expect(await count(table)).toBe(0);
  });

  it("lets only the author delete a post with their token", async () => {
    const site = await insertSite(db);
    const { id } = await submitPost(db, site, null, draft(), alice);
    await expect(deleteOwnPost(db, id, bob)).rejects.toMatchObject({ status: 403, code: "not_your_post" });
    await deleteOwnPost(db, id, alice);
    expect(await count("posts")).toBe(0);
  });

  it("purges rejected and spam posts older than the cutoff", async () => {
    const site = await insertSite(db);
    const old = await submitPost(db, site, null, draft(), alice, 10);
    const spam = await submitPost(db, site, null, draft(), alice, 10);
    const fresh = await submitPost(db, site, null, draft(), alice, 500);
    const kept = await submitPost(db, site, null, draft(), alice, 10);
    await moderatePost(db, old.id, "reject", null);
    await moderatePost(db, spam.id, "spam", null);
    await moderatePost(db, fresh.id, "reject", null);

    expect(await purgeRejected(db, 100)).toBe(2);
    expect(await row(fresh.id)).not.toBeNull();
    expect(await row(kept.id)).not.toBeNull();
  });
});

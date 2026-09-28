import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listFeedback } from "../src/board";
import { CALLSIGN_SLOTS, callsign, shuffleSlot } from "../src/callsign";
import { createTeamReply, type Draft, submitPost } from "../src/posts";
import { sha256 } from "../src/util";
import { createTestDb, insertSite } from "./db";

describe("callsign", () => {
  it("shuffles every slot to a different slot", () => {
    const seen = new Uint8Array(CALLSIGN_SLOTS);
    let clashes = 0;
    for (let slot = 0; slot < CALLSIGN_SLOTS; slot++) {
      const value = shuffleSlot(slot, "demo");
      if (!(value < CALLSIGN_SLOTS) || seen[value]++) clashes++;
    }
    expect(clashes).toBe(0);
  }, 30_000);

  it("gives a stable, spacey name", () => {
    expect(callsign("demo", 0)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,4}$/);
    expect(callsign("demo", 0)).toBe(callsign("demo", 0));
    expect(callsign("demo", 1)).not.toBe(callsign("demo", 0));
  });

  it("gives the same number a different name on another site", () => {
    const names = ["a", "b", "c", "d"].map((site) => callsign(site, 0));
    expect(new Set(names).size).toBe(names.length);
  });

  it("adds a lap suffix once a site runs out of slots", () => {
    expect(callsign("demo", CALLSIGN_SLOTS + 5)).toBe(`${callsign("demo", 5)}-2`);
  });
});

const test = await createTestDb();
const db = test.db;

describe("callsign numbers", () => {
  let alice: string;
  let bob: string;
  const draft: Draft = { body: "Ein ausreichend langer Text", nickname: null, pageUrl: null, context: null };

  beforeAll(async () => {
    alice = await sha256("alice");
    bob = await sha256("bob");
  });
  beforeEach(() => test.reset());
  afterAll(() => test.dispose());

  it("keeps one callsign per device and site", async () => {
    const site = await insertSite(db, { moderate_feedback: "none", moderate_replies: "none" });
    const first = await submitPost(db, site, null, draft, alice);
    await submitPost(db, site, null, draft, bob);
    await submitPost(db, site, { id: first.id, site_id: site.id }, draft, alice);
    await createTeamReply(db, { id: first.id, site_id: site.id }, "Danke!", "Team");

    const { results } = await db
      .prepare("SELECT author_hash, author_seq FROM posts ORDER BY created_at, author_seq")
      .all<{ author_hash: string | null; author_seq: number | null }>();
    const byAuthor = new Map(results.map((r) => [r.author_hash, r.author_seq]));
    expect(byAuthor.get(alice)).toBe(0);
    expect(byAuthor.get(bob)).toBe(1);
    expect(byAuthor.get(null)).toBeNull();
    expect(results.filter((r) => r.author_hash === alice).every((r) => r.author_seq === 0)).toBe(true);
  });

  it("numbers devices per site", async () => {
    const one = await insertSite(db, { moderate_feedback: "none" });
    const two = await insertSite(db, { moderate_feedback: "none" });
    await submitPost(db, one, null, draft, bob);
    await submitPost(db, one, null, draft, alice);
    await submitPost(db, two, null, draft, alice);

    const [a1] = (await listFeedback(db, one, { sort: "new", voter: "v" })).feedback;
    const [a2] = (await listFeedback(db, two, { sort: "new", voter: "v" })).feedback;
    expect(a1.callsign).toBe(callsign(one.id, 1));
    expect(a2.callsign).toBe(callsign(two.id, 0));
  });

  it("shows no callsign for posts without a device token", async () => {
    const site = await insertSite(db, { moderate_feedback: "none" });
    await submitPost(db, site, null, draft, null);
    const [post] = (await listFeedback(db, site, { sort: "new", voter: "v" })).feedback;
    expect(post.callsign).toBeNull();
  });
});

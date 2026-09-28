import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getThread, listFeedback, toggleVote, visitorPosts } from "../src/board";
import { createTeamReply, type Draft, moderatePost, submitPost } from "../src/posts";
import { sha256 } from "../src/util";
import { createTestDb, insertSite } from "./db";

const test = await createTestDb();
const db = test.db;
let alice: string;
let bob: string;

const draft = (kind?: Draft["kind"]): Draft => ({
  body: "Ein ausreichend langer Text",
  kind,
  nickname: null,
  pageUrl: null,
  context: null,
});

beforeAll(async () => {
  alice = await sha256("alice");
  bob = await sha256("bob");
});
beforeEach(() => test.reset());
afterAll(() => test.dispose());

describe("listFeedback", () => {
  it("lists approved feedback with votes and filters by kind", async () => {
    const site = await insertSite(db, { moderate_feedback: "none" });
    const idea = await submitPost(db, site, null, draft("idea"), alice);
    await submitPost(db, site, null, draft("bug"), alice);
    await moderatePost(db, (await submitPost(db, site, null, draft("idea"), bob)).id, "reject", null);
    await toggleVote(db, idea.id, "voter");

    const all = await listFeedback(db, site, { sort: "top", voter: "voter" });
    expect(all.feedback).toHaveLength(2);
    expect(all.feedback[0]).toMatchObject({ id: idea.id, votes: 1, voted: true, replies: 0, kind: "idea" });
    expect(all.feedback[0]).not.toHaveProperty("author_hash");

    const ideas = await listFeedback(db, site, { sort: "new", kind: "idea", voter: "other" });
    expect(ideas.feedback.map((p) => [p.id, p.voted])).toEqual([[idea.id, false]]);
  });

  it("toggles a vote off again", async () => {
    const site = await insertSite(db, { moderate_feedback: "none" });
    const { id } = await submitPost(db, site, null, draft(), alice);
    expect(await toggleVote(db, id, "v")).toEqual({ voted: true, votes: 1 });
    expect(await toggleVote(db, id, "v")).toEqual({ voted: false, votes: 0 });
  });

  it("adds one vote per IP and day, whatever the voter key", async () => {
    const site = await insertSite(db, { moderate_feedback: "none" });
    const { id } = await submitPost(db, site, null, draft(), alice);
    expect(await toggleVote(db, id, "device-1", "ip-1")).toEqual({ voted: true, votes: 1 });
    expect(await toggleVote(db, id, "device-2", "ip-1")).toEqual({ voted: false, votes: 1 });
    // The next day brings a new IP hash; device-1 still owns its vote.
    expect(await toggleVote(db, id, "device-2", "ip-2")).toEqual({ voted: true, votes: 2 });
    expect(await toggleVote(db, id, "device-1", "ip-2")).toEqual({ voted: false, votes: 1 });
  });
});

describe("reply badge", () => {
  it("counts approved replies by others until the author opens the thread", async () => {
    const site = await insertSite(db, { moderate_feedback: "none", moderate_replies: "all" });
    const feedback = await submitPost(db, site, null, draft(), alice, 100);
    const parent = { id: feedback.id, site_id: site.id };
    await submitPost(db, site, parent, draft(), alice, 150);
    const pendingReply = await submitPost(db, site, parent, draft(), bob, 200);
    await createTeamReply(db, parent, "Danke, ist geplant.", "Team", 300);

    let me = await visitorPosts(db, site.id, alice);
    expect(me.unseen).toBe(1);
    expect(me.posts.find((p) => p.id === feedback.id)).toMatchObject({ unseen: 1, thread_id: feedback.id });
    expect(me.posts.find((p) => p.parent_id)).toMatchObject({ unseen: 0, thread_id: feedback.id });

    await getThread(db, feedback.id, "voter", alice, 400);
    expect((await visitorPosts(db, site.id, alice)).unseen).toBe(0);

    await moderatePost(db, pendingReply.id, "approve", null, 500);
    me = await visitorPosts(db, site.id, alice);
    expect(me.unseen).toBe(1);
  });

  it("does not mark threads as seen for visitors who did not post in them", async () => {
    const site = await insertSite(db, { moderate_feedback: "none" });
    const { id } = await submitPost(db, site, null, draft(), alice);
    await getThread(db, id, "voter", bob);
    expect(await db.prepare("SELECT COUNT(*) AS n FROM seen").first("n")).toBe(0);
  });

  it("hides the thread link of a reply while its thread is not public", async () => {
    const site = await insertSite(db, { moderate_feedback: "none", moderate_replies: "none" });
    const feedback = await submitPost(db, site, null, draft(), bob);
    await submitPost(db, site, { id: feedback.id, site_id: site.id }, draft(), alice);
    await moderatePost(db, feedback.id, "reject", null);
    const [reply] = (await visitorPosts(db, site.id, alice)).posts;
    expect(reply.thread_id).toBeNull();
  });
});

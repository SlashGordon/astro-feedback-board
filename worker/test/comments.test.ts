import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getThread, listFeedback, visitorPosts } from "../src/board";
import { listComments, toggleReaction } from "../src/comments";
import { createTeamReply, type Draft, findFeedback, moderatePost, submitPost } from "../src/posts";
import { sha256 } from "../src/util";
import { createTestDb, insertSite } from "./db";

const test = await createTestDb();
const db = test.db;
let alice: string;

const comment = (article = "/blog/hello"): Draft => ({
  body: "Schöner Artikel, danke dafür",
  article,
  nickname: "Alice",
  pageUrl: `https://example.org${article}`,
  context: null,
});

beforeAll(async () => {
  alice = await sha256("alice");
});
beforeEach(() => test.reset());
afterAll(() => test.dispose());

describe("comments", () => {
  it("follow the site's comment moderation mode", async () => {
    const site = await insertSite(db, { moderate_feedback: "none", moderate_comments: "all" });
    expect((await submitPost(db, site, null, comment(), alice)).status).toBe("pending");
  });

  it("list approved comments of one article with team replies", async () => {
    const site = await insertSite(db, { moderate_comments: "none" });
    const first = await submitPost(db, site, null, comment(), alice, 1);
    await submitPost(db, site, null, comment("/blog/other"), alice, 2);
    await createTeamReply(db, { id: first.id, site_id: site.id }, "Danke!", "Team", 3);

    const { comments } = await listComments(db, site, "/blog/hello", "voter", null);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ id: first.id, nickname: "Alice", replies: [{ body: "Danke!", is_team: true }] });
    expect(comments[0].kind).toBeUndefined();
  });

  it("stay off the board, its threads and visitor votes", async () => {
    const site = await insertSite(db, { moderate_comments: "none" });
    const { id } = await submitPost(db, site, null, comment(), alice);
    expect((await listFeedback(db, site, { sort: "new", voter: "v" })).feedback).toEqual([]);
    await expect(getThread(db, id, "v", null)).rejects.toMatchObject({ status: 404 });
    expect(await findFeedback(db, id, { approvedOnly: true })).toBeNull();
    expect(await findFeedback(db, id, { approvedOnly: true, includeComments: true })).not.toBeNull();
  });

  it("show up in the author's own posts and clear their badge when loaded", async () => {
    const site = await insertSite(db, { moderate_comments: "none" });
    const { id } = await submitPost(db, site, null, comment(), alice, 1);
    await createTeamReply(db, { id, site_id: site.id }, "Danke!", "Team", 5);

    let me = await visitorPosts(db, site.id, alice);
    expect(me.posts[0]).toMatchObject({ id, article: "/blog/hello", thread_id: null, unseen: 1 });
    await listComments(db, site, "/blog/hello", "voter", alice, 10);
    me = await visitorPosts(db, site.id, alice);
    expect(me.unseen).toBe(0);
  });
});

describe("reactions", () => {
  const zero = { like: 0, unicorn: 0, mindblown: 0, clap: 0, fire: 0 };

  it("toggle per voter and count per reaction", async () => {
    const site = await insertSite(db);
    await toggleReaction(db, site.id, "/blog/hello", "a", "like");
    await toggleReaction(db, site.id, "/blog/hello", "b", "like");
    expect(await toggleReaction(db, site.id, "/blog/hello", "b", "fire")).toEqual({
      counts: { ...zero, like: 2, fire: 1 },
      mine: ["like", "fire"],
    });
    expect(await toggleReaction(db, site.id, "/blog/hello", "b", "like")).toEqual({
      counts: { ...zero, like: 1, fire: 1 },
      mine: ["fire"],
    });

    const { reactions } = await listComments(db, site, "/blog/hello", "c", null);
    expect(reactions).toEqual({ counts: { ...zero, like: 1, fire: 1 }, mine: [] });
    expect((await listComments(db, site, "/blog/other", "a", null)).reactions).toEqual({ counts: zero, mine: [] });
  });

  it("count each reaction once per IP, whatever the token", async () => {
    const site = await insertSite(db);
    await toggleReaction(db, site.id, "/a", "a", "like", "ip-1");
    await expect(toggleReaction(db, site.id, "/a", "b", "like", "ip-1")).rejects.toThrow("already_reacted");
    // Other reactions, other articles and other IPs are fine, and the owner can still take it back.
    await toggleReaction(db, site.id, "/a", "b", "fire", "ip-1");
    await toggleReaction(db, site.id, "/b", "b", "like", "ip-1");
    await toggleReaction(db, site.id, "/a", "c", "like", "ip-2");
    expect(await toggleReaction(db, site.id, "/a", "a", "like", "ip-1")).toMatchObject({ counts: { like: 1, fire: 1 } });
  });

  it("reject unknown reactions in the database too", async () => {
    const site = await insertSite(db);
    // @ts-expect-error: not a reaction
    await expect(toggleReaction(db, site.id, "/x", "a", "poop")).rejects.toThrow();
  });
});

describe("moderation", () => {
  it("approves a comment from the queue", async () => {
    const site = await insertSite(db);
    const { id } = await submitPost(db, site, null, comment(), alice);
    await moderatePost(db, id, "approve", null);
    expect((await listComments(db, site, "/blog/hello", "v", null)).comments).toHaveLength(1);
  });
});

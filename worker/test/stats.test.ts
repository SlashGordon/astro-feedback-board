import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { toggleVote } from "../src/board";
import { setReactions } from "../src/comments";
import { createTeamReply, type Draft, moderatePost, submitPost } from "../src/posts";
import { getStats, parseDays } from "../src/stats";
import { DAY_MS } from "../src/trust";
import { sha256 } from "../src/util";
import { createTestDb, insertSite } from "./db";

const test = await createTestDb();
const db = test.db;
let alice: string;

const draft = (article?: string): Draft => ({
  body: "Ein ausreichend langer Text",
  article,
  nickname: null,
  pageUrl: null,
  context: null,
});

const OPEN = { moderate_feedback: "none", moderate_replies: "none", moderate_comments: "none" } as const;

beforeAll(async () => {
  alice = await sha256("alice");
});
beforeEach(() => test.reset());
afterAll(() => test.dispose());

describe("getStats", () => {
  it("counts the activity per site and ranks the sites by feedback", async () => {
    const quiet = await insertSite(db, { ...OPEN, name: "Quiet" });
    const busy = await insertSite(db, { ...OPEN, name: "Busy" });
    await insertSite(db, { name: "Empty" });

    const first = await submitPost(db, busy, null, draft(), alice);
    const second = await submitPost(db, busy, null, draft(), alice);
    await submitPost(db, busy, { id: first.id, site_id: busy.id }, draft(), alice);
    await createTeamReply(db, { id: first.id, site_id: busy.id }, "Danke!", "Team");
    await submitPost(db, busy, null, draft("/blog/hello"), alice);
    await toggleVote(db, first.id, "v1");
    await toggleVote(db, first.id, "v2");
    await setReactions(db, busy.id, "/blog/hello", "v1", ["like", "fire"]);
    await submitPost(db, quiet, null, draft(), alice);

    // Rejected feedback and the votes on it are left out.
    await toggleVote(db, second.id, "v1");
    await moderatePost(db, second.id, "reject", null);

    const stats = await getStats(db);
    expect(stats.sites).toEqual([
      { id: busy.id, name: "Busy", feedback: 1, comments: 1, replies: 1, votes: 2, reactions: 2 },
      { id: quiet.id, name: "Quiet", feedback: 1, comments: 0, replies: 0, votes: 0, reactions: 0 },
      { id: expect.any(String), name: "Empty", feedback: 0, comments: 0, replies: 0, votes: 0, reactions: 0 },
    ]);
    expect(stats.totals).toEqual({ feedback: 2, comments: 1, replies: 1, votes: 2, reactions: 2 });

    const one = await getStats(db, { site: quiet.id });
    expect(one.sites.map((s) => s.id)).toEqual([quiet.id]);
    expect(one.totals).toMatchObject({ feedback: 1, votes: 0 });
    expect(one.feedback).toEqual([]);
  });

  it("ranks articles by reactions, then comments", async () => {
    const site = await insertSite(db, { ...OPEN, name: "Blog" });
    await setReactions(db, site.id, "/blog/popular", "v1", ["like", "unicorn"]);
    await setReactions(db, site.id, "/blog/popular", "v2", ["like"]);
    await submitPost(db, site, null, draft("/blog/popular"), alice);
    await submitPost(db, site, null, draft("/blog/discussed"), alice);
    await submitPost(db, site, null, draft("/blog/discussed"), alice);
    await setReactions(db, site.id, "/blog/liked", "v1", ["fire"]);

    const { articles } = await getStats(db);
    expect(articles).toEqual([
      {
        site_id: site.id,
        site_name: "Blog",
        article: "/blog/popular",
        reactions: 3,
        by_reaction: { like: 2, unicorn: 1, mindblown: 0, clap: 0, fire: 0 },
        comments: 1,
      },
      expect.objectContaining({ article: "/blog/liked", reactions: 1, comments: 0 }),
      expect.objectContaining({ article: "/blog/discussed", reactions: 0, comments: 2 }),
    ]);
  });

  it("ranks feedback by votes", async () => {
    const site = await insertSite(db, { ...OPEN, name: "App" });
    const low = await submitPost(db, site, null, { ...draft(), kind: "bug" }, alice);
    const top = await submitPost(db, site, null, { ...draft(), kind: "idea" }, alice);
    await submitPost(db, site, null, draft(), alice);
    await toggleVote(db, low.id, "v1");
    await toggleVote(db, top.id, "v1");
    await toggleVote(db, top.id, "v2");

    const { feedback } = await getStats(db);
    expect(feedback).toMatchObject([
      { id: top.id, site_name: "App", kind: "idea", topic_status: "open", votes: 2 },
      { id: low.id, kind: "bug", votes: 1 },
    ]);
  });

  it("counts only what happened in the period", async () => {
    const site = await insertSite(db, OPEN);
    const now = 100 * DAY_MS;
    const old = now - 40 * DAY_MS;
    const recent = now - DAY_MS;
    const post = await submitPost(db, site, null, draft(), alice, old);
    await submitPost(db, site, null, draft("/a"), alice, recent);
    await toggleVote(db, post.id, "v1", null, old);
    await toggleVote(db, post.id, "v2", null, recent);
    await setReactions(db, site.id, "/a", "v1", ["like"], null, old);
    await setReactions(db, site.id, "/b", "v1", ["clap"], null, recent);

    const month = await getStats(db, { days: 30 }, now);
    expect(month.totals).toEqual({ feedback: 0, comments: 1, replies: 0, votes: 1, reactions: 1 });
    expect(month.feedback).toMatchObject([{ id: post.id, votes: 1 }]);
    expect(month.articles.map((a) => [a.article, a.reactions, a.comments])).toEqual([
      ["/b", 1, 0],
      ["/a", 0, 1],
    ]);

    const all = await getStats(db, {}, now);
    expect(all.totals).toEqual({ feedback: 1, comments: 1, replies: 0, votes: 2, reactions: 2 });
  });
});

describe("parseDays", () => {
  it("reads all time from a missing value and rejects anything but whole days", () => {
    expect(parseDays(null)).toBe(0);
    expect(parseDays("")).toBe(0);
    expect(parseDays("30")).toBe(30);
    for (const bad of ["-1", "1.5", "abc", "99999"]) {
      expect(() => parseDays(bad)).toThrowError("invalid_days");
    }
  });
});

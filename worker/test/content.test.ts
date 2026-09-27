import { describe, expect, it } from "vitest";
import { normalizeContext, normalizeNickname, normalizePageUrl } from "../src/content";
import { initialStatus } from "../src/posts";

describe("content", () => {
  it("normalizes nicknames", () => {
    expect(normalizeNickname("  Hans   Peter ")).toBe("Hans Peter");
    expect(normalizeNickname("")).toBeNull();
    expect(normalizeNickname(42)).toBeNull();
    expect(normalizeNickname("x".repeat(100))).toHaveLength(40);
  });

  it("limits context size", () => {
    expect(normalizeContext({ a: 1 })).toBe('{"a":1}');
    expect(normalizeContext(undefined)).toBeNull();
    expect(() => normalizeContext({ a: "x".repeat(5000) })).toThrow();
  });

  it("keeps page URLs only on the site's origins, without query or hash", () => {
    const origins = ["https://a.de"];
    expect(normalizePageUrl("https://a.de/blog/post?utm=x#top", origins)).toBe("https://a.de/blog/post");
    expect(normalizePageUrl("https://evil.de/x", origins)).toBeNull();
    expect(normalizePageUrl("not a url", origins)).toBeNull();
  });
});

describe("initialStatus", () => {
  it("follows the moderation mode", () => {
    expect(initialStatus("all", true)).toBe("pending");
    expect(initialStatus("untrusted", false)).toBe("pending");
    expect(initialStatus("untrusted", true)).toBe("approved");
    expect(initialStatus("none", false)).toBe("approved");
  });
});

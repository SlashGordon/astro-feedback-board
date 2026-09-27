import { describe, expect, it } from "vitest";
import { checkBody, checkNickname, countLinks, isKind, isTopicStatus, TEAM_RULES } from "./protocol";

describe("checkBody", () => {
  it("enforces length on the trimmed text", () => {
    expect(checkBody("zu kurz")).toBe("too_short");
    expect(checkBody("   abc      ")).toBe("too_short");
    expect(checkBody("Das ist ein Feedback.")).toBeNull();
    expect(checkBody("x".repeat(2001))).toBe("too_long");
    expect(checkBody("x".repeat(2000))).toBeNull();
  });

  it("counts emoji as one character", () => {
    expect(checkBody("👍".repeat(2000))).toBeNull();
  });

  it("allows at most two links for visitors", () => {
    expect(countLinks("see https://a.de and http://b.de and www.c.de")).toBe(3);
    expect(checkBody("see https://a.de and http://b.de")).toBeNull();
    expect(checkBody("see https://a.de and http://b.de and www.c.de")).toBe("too_many_links");
  });

  it("lets the team write short texts with any number of links", () => {
    expect(checkBody("ok", TEAM_RULES)).toBeNull();
    expect(checkBody("  ", TEAM_RULES)).toBe("too_short");
    expect(checkBody("https://a.de https://b.de https://c.de", TEAM_RULES)).toBeNull();
    expect(checkBody("x".repeat(2001), TEAM_RULES)).toBe("too_long");
  });
});

describe("checkNickname", () => {
  it("rejects email addresses, also written out", () => {
    for (const name of ["hans@example.de", "Hans (hans.peter@web.de)", "hans (at) example (dot) de", "hans [at] example.de"]) {
      expect(checkNickname(name), name).toBe("nickname_email");
    }
  });

  it("rejects phone numbers in common formats", () => {
    for (const name of ["0171 1234567", "Hans +49 171 1234567", "(030) 123 45 67", "0171/123-4567", "01711234567"]) {
      expect(checkNickname(name), name).toBe("nickname_phone");
    }
  });

  it("allows normal nicknames with a few digits", () => {
    for (const name of ["Hans Peter", "hans_1990", "R2-D2", "Team 42", "Anna-Lena @ home"]) {
      expect(checkNickname(name), name).toBeNull();
    }
  });
});

describe("value guards", () => {
  it("accepts only known kinds and topic statuses", () => {
    expect(isKind("idea")).toBe(true);
    expect(isKind("question")).toBe(false);
    expect(isTopicStatus("in_progress")).toBe(true);
    expect(isTopicStatus(null)).toBe(false);
  });
});

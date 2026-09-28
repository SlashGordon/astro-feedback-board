import { describe, expect, it } from "vitest";
import { MIN_FILL_MS } from "astro-feedback-board/protocol";
import { CHALLENGE_TTL_MS, createChallenge, verifySolution } from "../src/altcha";
import { solve } from "./solve";

const KEY = "test-key";

describe("altcha", () => {
  it("accepts a solved challenge after the minimum fill time", async () => {
    const issued = Date.now();
    const payload = await solve(await createChallenge(KEY, issued));
    const result = await verifySolution(KEY, payload, issued + MIN_FILL_MS);
    expect(result.ok).toBe(true);
  });

  it("rejects submissions faster than the minimum fill time", async () => {
    const issued = Date.now();
    const payload = await solve(await createChallenge(KEY, issued));
    expect(await verifySolution(KEY, payload, issued + 500)).toEqual({ ok: false, reason: "too_fast" });
  });

  it("rejects expired challenges", async () => {
    const issued = Date.now();
    const payload = await solve(await createChallenge(KEY, issued));
    expect(await verifySolution(KEY, payload, issued + CHALLENGE_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a wrong number, a foreign key and a forged issue time", async () => {
    const issued = Date.now();
    const c = await createChallenge(KEY, issued);
    const payload = await solve(c);
    const decoded = JSON.parse(atob(payload));

    const wrongNumber = btoa(JSON.stringify({ ...decoded, number: decoded.number + 1 }));
    expect((await verifySolution(KEY, wrongNumber, issued + MIN_FILL_MS)).ok).toBe(false);
    expect((await verifySolution("other-key", payload, issued + MIN_FILL_MS)).ok).toBe(false);

    const forgedSalt = decoded.salt.replace(`issued=${issued}`, `issued=${issued - 60_000}`);
    const forged = btoa(JSON.stringify({ ...decoded, salt: forgedSalt }));
    expect((await verifySolution(KEY, forged, issued + 100)).ok).toBe(false);
  });

  it("rejects garbage", async () => {
    expect((await verifySolution(KEY, "not base64 json")).ok).toBe(false);
  });
});

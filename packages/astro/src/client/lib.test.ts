import { describe, expect, it } from "vitest";
import { strings } from "../i18n";
import { buildContext, errorMessage, findNumber, issuedAt, newToken, solveChallenge } from "./lib";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("solveChallenge", () => {
  it("finds the secret number", async () => {
    const salt = "abc?issued=1000&expires=2000";
    const c = { algorithm: "SHA-256" as const, challenge: await sha256Hex(salt + 1234), maxnumber: 5000, salt, signature: "sig" };
    const payload = JSON.parse(atob(await solveChallenge(c)));
    expect(payload.number).toBe(1234);
    expect(payload.signature).toBe("sig");
    expect(issuedAt(c)).toBe(1000);
  });

  it("works as standalone source text, the way the Web Worker gets it", async () => {
    const salt = "abc?issued=1000&expires=2000";
    const standalone = new Function(`return (${findNumber.toString()});`)() as typeof findNumber;
    expect(await standalone(salt, await sha256Hex(salt + 777), 1000, false)).toBe(777);
    expect(await standalone(salt, await sha256Hex("other"), 1000, false)).toBe(-1);
  });
});

describe("buildContext", () => {
  it("merges question, prop and hook", () => {
    expect(buildContext(undefined, undefined, undefined)).toBeUndefined();
    expect(buildContext("Was fehlt?", { a: 1 }, { b: 2 })).toEqual({ question: "Was fehlt?", a: 1, b: 2 });
    expect(buildContext(undefined, "plain", null)).toEqual({ value: "plain" });
  });
});

describe("helpers", () => {
  it("creates 128-bit hex tokens", () => {
    expect(newToken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("maps error codes to strings", () => {
    expect(errorMessage("too_short", strings.de)).toBe("Bitte schreib mindestens 10 Zeichen.");
    expect(errorMessage("too_many_links", strings.en)).toBe("Please include at most 2 links.");
    expect(errorMessage("nickname_email", strings.de)).toBe(strings.de.errorNicknameEmail);
    expect(errorMessage("whatever", strings.en)).toBe(strings.en.errorGeneric);
  });
});

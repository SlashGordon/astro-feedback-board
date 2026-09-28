// Solves an ALTCHA challenge in batches, like the components do.
import type { Challenge } from "astro-feedback-board/protocol";
import { sha256 } from "../src/util";

export async function solve(c: Challenge): Promise<string> {
  for (let start = 0; start <= c.maxnumber; start += 1000) {
    const numbers = Array.from({ length: Math.min(1000, c.maxnumber - start + 1) }, (_, i) => start + i);
    const hashes = await Promise.all(numbers.map((n) => sha256(c.salt + n)));
    const n = numbers[hashes.indexOf(c.challenge)];
    if (n !== undefined) {
      return btoa(JSON.stringify({ algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature }));
    }
  }
  throw new Error("unsolvable");
}

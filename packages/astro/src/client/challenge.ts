// Solves ALTCHA challenges in the background, so a submit or reaction does not
// wait for the proof of work. Each solution is single use.
import { type Challenge, MIN_FILL_MS } from "../protocol";
import { api } from "./api";
import { issuedAt, solveChallenge } from "./lib";

export class ChallengeSolver {
  private solution?: Promise<{ payload: string; issued: number }>;

  constructor(private endpoint: string) {}

  /** Fetches and solves a challenge unless one is already on its way. */
  prepare(): void {
    if (this.solution) return;
    const solution = api<Challenge>(this.endpoint, "/v1/challenge", { token: null }).then(async (c) => ({
      payload: await solveChallenge(c),
      issued: issuedAt(c),
    }));
    this.solution = solution;
    // A failed challenge is fetched again on the next take().
    solution.catch(() => {
      if (this.solution === solution) this.solution = undefined;
    });
  }

  /** Returns a solved payload once the minimum fill time since the challenge was issued has passed. */
  async take(): Promise<string> {
    this.prepare();
    const solution = this.solution!;
    this.solution = undefined;
    const { payload, issued } = await solution;
    const wait = issued + MIN_FILL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return payload;
  }
}

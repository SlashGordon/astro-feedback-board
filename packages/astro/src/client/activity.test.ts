import { describe, expect, it } from "vitest";
import { createActivityClock } from "./activity";

describe("activity clock", () => {
  it("counts time only while the visitor is active and the tab is visible", () => {
    const clock = createActivityClock({ idleMs: 60_000 });
    clock.tick(0, true);
    expect(clock.tick(5_000, true)).toBe(0); // no interaction yet

    clock.interaction(5_000);
    expect(clock.tick(10_000, true)).toBe(5_000);
    expect(clock.tick(15_000, false)).toBe(5_000); // hidden tab
    expect(clock.tick(20_000, true)).toBe(10_000);
    expect(clock.tick(70_000, true)).toBe(10_000); // idle for more than a minute
  });

  it("caps the step after the device slept", () => {
    const clock = createActivityClock({ idleMs: 10 * 60_000, maxStepMs: 10_000 });
    clock.tick(0, true);
    clock.interaction(0);
    expect(clock.tick(5 * 60_000, true)).toBe(10_000);
  });
});

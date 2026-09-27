// Counts how long a visitor has actively used the page: the tab is visible and
// they clicked, typed, scrolled or moved the pointer recently. Reading a long
// article without scrolling still counts until idleMs have passed.

export interface ActivityClock {
  /** Records a click, key press, scroll or pointer move. */
  interaction(now: number): void;
  /** Adds the time since the last tick if the visitor was active; returns the total active time. */
  tick(now: number, visible: boolean): number;
}

export function createActivityClock({ idleMs = 60_000, maxStepMs = 10_000 } = {}): ActivityClock {
  let active = 0;
  let lastTick: number | null = null;
  let lastInteraction = Number.NEGATIVE_INFINITY;
  return {
    interaction(now) {
      lastInteraction = now;
    },
    tick(now, visible) {
      // maxStepMs caps the jump after the device slept or the tab was throttled.
      if (lastTick !== null && visible && now - lastInteraction <= idleMs) {
        active += Math.min(now - lastTick, maxStepMs);
      }
      lastTick = now;
      return active;
    },
  };
}

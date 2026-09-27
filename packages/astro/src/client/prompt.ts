// Client script for <FeedbackPrompt />: a small card that asks for feedback
// once the visitor has been active for a while. It never takes focus, has no
// backdrop, waits while the visitor types or has a dialog open, and stays
// away for snoozeDays after the visitor dismissed or answered it.
import { createActivityClock } from "./activity";
import { visitor } from "./visitor";

const TICK_MS = 5_000;
const DAY_MS = 86_400_000;
const CLOSE_AFTER_SUBMIT_MS = 4_000;

const clock = createActivityClock();
/** Feedback was sent from any form on this page load, so nobody gets asked again. */
let answered = false;
let started = false;

function snoozeKey(prompt: HTMLElement): string {
  return `prompt:${prompt.dataset.site ?? ""}`;
}

/** True while the visitor is typing somewhere or a dialog is open. */
function busy(): boolean {
  if (document.querySelector("dialog[open]")) return true;
  const active = document.activeElement;
  return (
    active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
  );
}

function close(prompt: HTMLElement, snooze: boolean): void {
  if (snooze) {
    const days = Number(prompt.dataset.snoozeDays ?? 30);
    visitor.snooze(snoozeKey(prompt), Date.now() + days * DAY_MS);
  }
  prompt.dataset.state = "closing";
  setTimeout(() => {
    prompt.hidden = true;
  }, 200);
}

function tick(): void {
  const active = clock.tick(Date.now(), document.visibilityState === "visible");
  if (answered || busy()) return;
  for (const prompt of document.querySelectorAll<HTMLElement>("[data-afb-prompt]:not([data-afb-shown])")) {
    if (active < Number(prompt.dataset.afterMs ?? Infinity)) continue;
    // Each prompt element shows at most once per page.
    prompt.dataset.afbShown = "";
    if (visitor.snoozedUntil(snoozeKey(prompt)) > Date.now()) continue;
    prompt.hidden = false;
    prompt.dataset.state = "open";
    return;
  }
}

function promptOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-afb-prompt]") : null;
}

/** Starts the activity clock and the listeners once per page. */
export function initPrompts(): void {
  if (started) return;
  started = true;

  const interaction = () => clock.interaction(Date.now());
  for (const type of ["pointerdown", "pointermove", "keydown", "scroll", "wheel", "touchstart"]) {
    document.addEventListener(type, interaction, { capture: true, passive: true });
  }
  setInterval(tick, TICK_MS);

  document.addEventListener("click", (event) => {
    const prompt = promptOf(event.target);
    if (!prompt || !(event.target instanceof Element)) return;
    if (event.target.closest("[data-afb-prompt-dismiss]")) {
      close(prompt, true);
      return;
    }
    if (event.target.closest("[data-afb-prompt-open]")) {
      prompt.querySelector<HTMLElement>("[data-afb-prompt-actions]")!.hidden = true;
      prompt.querySelector<HTMLElement>("[data-afb-prompt-form]")!.hidden = false;
      // The visitor asked for the form, so moving focus into it is expected.
      prompt.querySelector("textarea")?.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    const prompt = promptOf(event.target);
    if (prompt && event.key === "Escape") close(prompt, true);
  });

  document.addEventListener("afb:submitted", (event) => {
    answered = true;
    const prompt = promptOf(event.target);
    if (prompt) setTimeout(() => close(prompt, true), CLOSE_AFTER_SUBMIT_MS);
  });
}

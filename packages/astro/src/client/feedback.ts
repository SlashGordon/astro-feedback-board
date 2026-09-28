// Client script for the feedback form, the dialog and the reply badge. Uses
// event delegation, so it works for any number of forms and survives Astro
// view transitions.
import { plural, type Strings } from "../i18n";
import { icon } from "../icons";
import { checkBody, checkNickname, type SubmitRequest, type SubmitResponse, VISITOR_RULES } from "../protocol";
import { api, ApiError } from "./api";
import { ChallengeSolver } from "./challenge";
import { buildContext, errorMessage, newToken } from "./lib";
import { visitor } from "./visitor";

declare global {
  interface Window {
    /** Optional hook: return data (for example app state) to send with each post. */
    feedbackBoard?: { getContext?: () => unknown };
  }
}

interface FormState {
  solver: ChallengeSolver;
  sending?: boolean;
}

const states = new WeakMap<HTMLFormElement, FormState>();

function stateOf(form: HTMLFormElement): FormState {
  let state = states.get(form);
  if (!state) states.set(form, (state = { solver: new ChallengeSolver(form.dataset.endpoint ?? "") }));
  return state;
}

function stringsOf(el: HTMLElement): Strings {
  return JSON.parse(el.dataset.strings ?? "{}") as Strings;
}

function syncRemembered(form: HTMLFormElement): void {
  const remembered = visitor.token() !== null;
  const check = form.querySelector<HTMLElement>("[data-afb-remember]");
  const note = form.querySelector<HTMLElement>("[data-afb-remembered]");
  if (check) check.hidden = remembered;
  if (note) note.hidden = !remembered;
  const nickname = form.elements.namedItem("nickname") as HTMLInputElement | null;
  const saved = visitor.nickname();
  if (nickname && saved && !nickname.value) nickname.value = saved;
}

function setStatus(form: HTMLFormElement, kind: "error" | "success" | "", text: string): void {
  const status = form.querySelector<HTMLElement>("[data-afb-status]");
  if (!status) return;
  status.dataset.kind = kind;
  status.innerHTML = text ? icon(kind === "error" ? "alert" : "checkCircle") : "";
  if (text) status.append(document.createTextNode(text));
}

function setBusy(form: HTMLFormElement, busy: boolean, t: Strings): void {
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (!button) return;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  const label = button.querySelector("[data-afb-label]");
  if (label) label.textContent = busy ? t.sending : t.submit;
}

function updateCounter(textarea: HTMLTextAreaElement): void {
  const counter = textarea.parentElement?.querySelector<HTMLElement>("[data-afb-count]");
  if (!counter) return;
  const length = [...textarea.value].length;
  counter.textContent = `${length} / ${VISITOR_RULES.maxLength}`;
  counter.dataset.state = length > VISITOR_RULES.maxLength ? "over" : "";
}

async function submit(form: HTMLFormElement): Promise<void> {
  const state = stateOf(form);
  if (state.sending) return;
  const t = stringsOf(form);
  const endpoint = form.dataset.endpoint ?? "";
  const site = form.dataset.site ?? "";
  const parent = form.dataset.parent;
  const article = form.dataset.article;
  const fields = form.elements;
  const bodyField = fields.namedItem("body") as HTMLTextAreaElement;
  const nicknameField = fields.namedItem("nickname") as HTMLInputElement | null;
  const nickname = nicknameField?.value.trim() ?? "";
  const remember = (fields.namedItem("remember") as HTMLInputElement | null)?.checked ?? false;
  const honeypot = (fields.namedItem("website") as HTMLInputElement | null)?.value ?? "";
  const kind = (new FormData(form).get("kind") ?? undefined) as SubmitRequest["kind"];

  const local = checkBody(bodyField.value);
  if (local) {
    setStatus(form, "error", errorMessage(local, t));
    bodyField.focus();
    return;
  }
  const nicknameError = checkNickname(nickname);
  if (nicknameError) {
    setStatus(form, "error", errorMessage(nicknameError, t));
    nicknameField?.focus();
    return;
  }

  state.sending = true;
  setStatus(form, "", "");
  setBusy(form, true, t);

  // The token is stored only after the Worker accepted the post.
  const token = visitor.token() ?? (remember ? newToken() : null);

  let staticContext: unknown;
  try {
    staticContext = form.dataset.context ? JSON.parse(form.dataset.context) : undefined;
  } catch {
    staticContext = undefined;
  }
  let hookContext: unknown;
  try {
    hookContext = window.feedbackBoard?.getContext?.();
  } catch {
    hookContext = undefined;
  }

  const path = parent
    ? `/v1/feedback/${encodeURIComponent(parent)}/replies`
    : article
      ? `/v1/sites/${encodeURIComponent(site)}/comments`
      : `/v1/sites/${encodeURIComponent(site)}/feedback`;

  try {
    for (let attempt = 0; ; attempt++) {
      const payload = await state.solver.take();
      try {
        const request: SubmitRequest = {
          body: bodyField.value,
          kind: parent || article ? undefined : kind,
          article: parent ? undefined : article,
          nickname: nickname || undefined,
          page_url: location.origin + location.pathname,
          context: buildContext(form.dataset.question, staticContext, hookContext),
          altcha: payload,
          website: honeypot,
        };
        const data = await api<SubmitResponse>(endpoint, path, { method: "POST", token, body: JSON.stringify(request) });
        if (token) {
          visitor.remember(token, nickname);
          void visitor.refresh(endpoint, site);
        }
        bodyField.value = "";
        updateCounter(bodyField);
        syncRemembered(form);
        const approved = data.status === "approved";
        const [thanksApproved, thanksPending] = parent
          ? [t.thanksReplyApproved, t.thanksReplyPending]
          : article
            ? [t.thanksCommentApproved, t.thanksCommentPending]
            : [t.thanksApproved, t.thanksPending];
        setStatus(form, "success", approved ? thanksApproved : thanksPending);
        form.dispatchEvent(new CustomEvent("afb:submitted", { bubbles: true, detail: { ...data, parent, article } }));
        return;
      } catch (error) {
        if (error instanceof ApiError && error.code.startsWith("altcha_") && attempt === 0) continue;
        throw error;
      }
    }
  } catch (error) {
    setStatus(form, "error", errorMessage(error instanceof ApiError ? error.code : undefined, t));
  } finally {
    state.sending = false;
    setBusy(form, false, t);
  }
}

function formOf(target: EventTarget | null): HTMLFormElement | null {
  return target instanceof Element ? target.closest<HTMLFormElement>("form[data-afb-form]") : null;
}

function setBadge(trigger: HTMLElement, badge: HTMLElement, unseen: number): void {
  badge.textContent = String(unseen);
  badge.hidden = unseen === 0;
  const label = plural(unseen, trigger.dataset.badgeOne ?? "{n}", trigger.dataset.badgeOther ?? "{n}");
  badge.setAttribute("aria-label", label);
  badge.title = label;
}

const badgeWatches = new WeakMap<HTMLElement, () => void>();

/** Shows the number of unseen replies on every feedback button. */
function watchBadges(): void {
  for (const trigger of document.querySelectorAll<HTMLElement>("[data-afb-open][data-endpoint]")) {
    const badge = trigger.querySelector<HTMLElement>("[data-afb-badge]");
    if (!badge) continue;
    badgeWatches.get(trigger)?.();
    const unwatch = visitor.watch(trigger.dataset.endpoint ?? "", trigger.dataset.site ?? "", ({ unseen }) =>
      setBadge(trigger, badge, unseen),
    );
    badgeWatches.set(trigger, unwatch);
  }
}

/** Deletes the device's data on the Worker and in localStorage, after asking. */
async function forget(form: HTMLFormElement, button: HTMLButtonElement): Promise<void> {
  const t = stringsOf(form);
  if (!window.confirm(t.forgetConfirm)) return;
  button.disabled = true;
  try {
    await visitor.forget(form.dataset.endpoint ?? "");
    for (const field of document.querySelectorAll<HTMLInputElement>("form[data-afb-form] input[name=nickname]")) {
      field.value = "";
    }
    syncAll();
    setStatus(form, "success", t.forgotten);
  } catch (error) {
    setStatus(form, "error", errorMessage(error instanceof ApiError ? error.code : undefined, t));
  } finally {
    button.disabled = false;
  }
}

function syncAll(): void {
  document.querySelectorAll<HTMLFormElement>("form[data-afb-form]").forEach(syncRemembered);
  watchBadges();
}

let initialized = false;

/** Registers the document-level listeners once per page. */
export function initFeedback(): void {
  syncAll();
  if (initialized) return;
  initialized = true;
  document.addEventListener("astro:page-load", syncAll);

  document.addEventListener("focusin", (event) => {
    const form = formOf(event.target);
    if (form) stateOf(form).solver.prepare();
  });

  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-afb-forget]") : null;
    const form = button && formOf(button);
    if (form) void forget(form, button);
  });

  document.addEventListener("submit", (event) => {
    const form = formOf(event.target);
    if (!form) return;
    event.preventDefault();
    void submit(form);
  });

  document.addEventListener("input", (event) => {
    if (event.target instanceof HTMLTextAreaElement && formOf(event.target)) updateCounter(event.target);
  });

  // The kind picker switches the placeholder to match.
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "kind") return;
    const textarea = formOf(input)?.querySelector<HTMLTextAreaElement>("textarea[data-placeholders]");
    if (!textarea) return;
    const placeholders = JSON.parse(textarea.dataset.placeholders ?? "{}") as Record<string, string>;
    textarea.placeholder = placeholders[input.value] ?? textarea.placeholder;
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const opener = target.closest<HTMLElement>("[data-afb-open]");
    if (opener) {
      const dialog = document.getElementById(opener.dataset.afbOpen ?? "");
      if (dialog instanceof HTMLDialogElement) {
        const form = dialog.querySelector<HTMLFormElement>("form[data-afb-form]");
        if (form) {
          syncRemembered(form);
          setStatus(form, "", "");
        }
        const link = dialog.querySelector<HTMLElement>("[data-afb-mine-link]");
        if (link) link.hidden = visitor.token() === null;
        dialog.showModal();
        dialog.querySelector("textarea")?.focus();
      }
      return;
    }

    if (target.closest("[data-afb-close]")) {
      target.closest("dialog")?.close();
      return;
    }

    // Click on the backdrop closes the dialog.
    if (target instanceof HTMLDialogElement && target.classList.contains("afb-dialog")) {
      const rect = target.getBoundingClientRect();
      const { clientX: x, clientY: y } = event as MouseEvent;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) target.close();
    }
  });
}

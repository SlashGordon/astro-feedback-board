// Client script for <FeedbackComments />: the approved comments of an article
// and its reactions. A reaction is protected like a post: honeypot field,
// minimum fill time and ALTCHA proof of work, solved while the visitor points
// at the buttons.
import { plural, type Strings } from "../i18n";
import { icon } from "../icons";
import { reactionLabels } from "../labels";
import type {
  CommentsResponse,
  CommentThread,
  PublicPost,
  Reaction,
  ReactionRequest,
  ReactionSummary,
} from "../protocol";
import { ApiError } from "./api";
import { ChallengeSolver } from "./challenge";
import { avatar, displayName, h, stringsOf, svg } from "./dom";
import { errorMessage } from "./lib";
import { visitor } from "./visitor";

class Comments {
  private endpoint: string;
  private site: string;
  private article: string;
  private t: Strings;
  private date: Intl.DateTimeFormat;
  private number: Intl.NumberFormat;
  private list: HTMLElement | null;
  private reactions: HTMLFormElement | null;
  private solver: ChallengeSolver;
  /** What the Worker last confirmed. */
  private confirmed?: ReactionSummary;
  /** Optimistic state while the visitor clicks and until the Worker answers. */
  private shown?: ReactionSummary;
  /** Sends the reactions once the visitor stopped clicking. */
  private timer?: ReturnType<typeof setTimeout>;
  private sending?: Promise<void>;

  constructor(private el: HTMLElement) {
    this.endpoint = el.dataset.endpoint ?? "";
    this.site = el.dataset.site ?? "";
    this.article = el.dataset.article ?? "";
    this.t = stringsOf(el);
    this.date = new Intl.DateTimeFormat(el.dataset.lang, { dateStyle: "medium" });
    this.number = new Intl.NumberFormat(el.dataset.lang, { maximumFractionDigits: 1 });
    this.list = el.querySelector("[data-afb-comment-list]");
    this.reactions = el.querySelector("form[data-afb-reactions]");
    this.solver = new ChallengeSolver(this.endpoint);

    if (this.reactions) {
      const prepare = () => this.solver.prepare();
      this.reactions.addEventListener("pointerenter", prepare);
      this.reactions.addEventListener("focusin", prepare);
      this.reactions.addEventListener("submit", (event) => event.preventDefault());
      this.reactions.addEventListener("click", (event) => {
        const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-afb-reaction]") : null;
        if (button) this.toggle(button.dataset.afbReaction as Reaction);
      });
    }
    el.addEventListener("afb:submitted", (event) => {
      const detail = (event as CustomEvent<{ status: string; article?: string }>).detail;
      if (detail.article && detail.status === "approved") void this.load();
    });

    void this.load();
  }

  private get path(): string {
    return `/v1/sites/${encodeURIComponent(this.site)}`;
  }

  private async load(): Promise<void> {
    this.list?.setAttribute("aria-busy", "true");
    try {
      const data = await visitor.request<CommentsResponse>(
        this.endpoint,
        `${this.path}/comments?article=${encodeURIComponent(this.article)}`,
      );
      this.renderComments(data.comments);
      this.confirmed = data.reactions;
      if (!this.shown) this.renderReactions(data.reactions);
      // Loading marks the visitor's own comments as seen, so the reply badge changes.
      if (visitor.token()) void visitor.refresh(this.endpoint, this.site);
    } catch {
      this.list?.replaceChildren(h("li", { class: "afb-alert" }, this.t.loadError));
    } finally {
      this.list?.setAttribute("aria-busy", "false");
    }
  }

  // Comments -----------------------------------------------------------------

  private renderComments(comments: CommentThread[]): void {
    if (!this.list) return;
    const count = this.el.querySelector<HTMLElement>("[data-afb-comment-count]");
    if (count) count.textContent = comments.length ? String(comments.length) : "";
    const message = this.el.querySelector<HTMLElement>("[data-afb-message]");
    if (message) message.textContent = plural(comments.length, this.t.commentsOne, this.t.commentsOther);
    this.list.replaceChildren(
      ...(comments.length
        ? comments.map((comment) =>
            this.entry(
              comment,
              comment.replies.length > 0 &&
                h("ul", { class: "afb-comment-replies" }, ...comment.replies.map((reply) => this.entry(reply))),
            ),
          )
        : [h("li", { class: "afb-empty" }, h("span", { class: "afb-icon-tile" }, svg("replies")), this.t.commentsEmpty)]),
    );
  }

  private entry(post: Omit<PublicPost, "replies">, children?: Node | false): HTMLElement {
    const name = displayName(this.t, post);
    return h(
      "li",
      { class: `afb-reply${post.is_team ? " afb-reply--team" : ""}` },
      avatar(name, post.is_team),
      h(
        "div",
        { class: "afb-comment-main" },
        h(
          "div",
          { class: "afb-bubble" },
          h(
            "div",
            { class: "afb-meta" },
            post.is_team
              ? h("span", { class: "afb-chip afb-chip--feedback" }, svg("shield"), name)
              : h("span", { class: "afb-author" }, name),
            h("span", {}, this.date.format(post.created_at)),
          ),
          h("p", { class: "afb-body" }, post.body),
        ),
        children,
      ),
    );
  }

  // Reactions ----------------------------------------------------------------

  private renderReactions(summary: ReactionSummary): void {
    if (!this.reactions) return;
    const labels = reactionLabels(this.t);
    for (const button of this.reactions.querySelectorAll<HTMLButtonElement>("[data-afb-reaction]")) {
      const reaction = button.dataset.afbReaction as Reaction;
      const count = summary.counts[reaction] ?? 0;
      button.setAttribute("aria-pressed", String(summary.mine.includes(reaction)));
      button.setAttribute("aria-label", `${labels[reaction]}: ${this.number.format(count)}`);
      const counter = button.querySelector<HTMLElement>("[data-afb-reaction-count]");
      if (counter) counter.textContent = count ? this.number.format(count) : "";
    }
  }

  private setStatus(kind: "error" | "", text: string): void {
    const status = this.reactions?.querySelector<HTMLElement>("[data-afb-status]");
    if (!status) return;
    status.dataset.kind = kind;
    status.innerHTML = text ? icon("alert") : "";
    if (text) status.append(document.createTextNode(text));
  }

  /** Shows the toggle at once and sends the whole set after REACTION_DELAY_MS without clicks. */
  private toggle(reaction: Reaction): void {
    const shown = this.shown ?? this.confirmed;
    if (!shown) return;
    const on = !shown.mine.includes(reaction);
    this.shown = {
      counts: { ...shown.counts, [reaction]: Math.max(0, shown.counts[reaction] + (on ? 1 : -1)) },
      mine: on ? [...shown.mine, reaction] : shown.mine.filter((r) => r !== reaction),
    };
    this.renderReactions(this.shown);
    this.setStatus("", "");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), REACTION_DELAY_MS);
  }

  /** Sends the shown set unless it equals the confirmed one. One request at a time. */
  async flush(keepalive = false): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.sending) {
      await this.sending;
      // Clicks during the request start their own timer.
      if (this.timer) return;
    }
    const wanted = this.shown?.mine;
    if (!wanted || !this.confirmed) return;
    if (sameSet(wanted, this.confirmed.mine)) {
      this.shown = undefined;
      this.renderReactions(this.confirmed);
      return;
    }
    this.sending = this.send(wanted, keepalive).finally(() => (this.sending = undefined));
    await this.sending;
  }

  private async send(wanted: Reaction[], keepalive: boolean): Promise<void> {
    const honeypot =
      (this.reactions?.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
    try {
      for (let attempt = 0; ; attempt++) {
        const altcha = await this.solver.take();
        // Solve the next challenge while this request runs.
        this.solver.prepare();
        const request: ReactionRequest = { article: this.article, reactions: wanted, altcha, website: honeypot };
        try {
          this.confirmed = await visitor.request<ReactionSummary>(this.endpoint, `${this.path}/reactions`, {
            method: "POST",
            body: JSON.stringify(request),
            keepalive,
          });
          // The Worker skips a reaction another device on the same connection set today.
          if (wanted.some((r) => !this.confirmed?.mine.includes(r))) this.setStatus("error", this.t.errorAlreadyReacted);
          return;
        } catch (error) {
          if (error instanceof ApiError && error.code.startsWith("altcha_") && attempt === 0) continue;
          throw error;
        }
      }
    } catch (error) {
      this.setStatus("error", errorMessage(error instanceof ApiError ? error.code : undefined, this.t));
    } finally {
      // Without new clicks, show what the Worker stored.
      if (!this.timer && this.confirmed) {
        this.shown = undefined;
        this.renderReactions(this.confirmed);
      }
    }
  }
}

/** Quiet time after the last click before the reactions go out. */
const REACTION_DELAY_MS = 2000;

function sameSet(a: readonly Reaction[], b: readonly Reaction[]): boolean {
  return a.length === b.length && a.every((r) => b.includes(r));
}

const widgets = new Map<HTMLElement, Comments>();
let initialized = false;

/** Sends unsent reactions right away when the tab is hidden or closed. */
function flushAll(): void {
  for (const widget of widgets.values()) void widget.flush(true);
}

export function initComments(): void {
  const setup = () =>
    document.querySelectorAll<HTMLElement>("[data-afb-comments]").forEach((el) => {
      if (widgets.has(el)) return;
      widgets.set(el, new Comments(el));
    });
  setup();
  if (initialized) return;
  initialized = true;
  document.addEventListener("astro:page-load", setup);
  // A view transition swaps the page; send before the old widgets go away.
  document.addEventListener("astro:before-swap", () => {
    flushAll();
    widgets.clear();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
  window.addEventListener("pagehide", flushAll);
}

// Client script for <FeedbackBoard />: list, filters, votes, thread view and
// the visitor's own posts. Visitor content is only inserted as text.
import { plural, type Strings } from "../i18n";
import type { IconName } from "../icons";
import { KIND_ICONS, kindLabels, topicStatusLabels } from "../labels";
import type {
  FeedbackListResponse,
  Kind,
  MePost,
  MeResponse,
  PublicPost,
  ThreadResponse,
  TopicStatus,
  VoteResponse,
} from "../protocol";
import { ApiError } from "./api";
import { avatar, type Child, displayName, h, svg } from "./dom";
import { errorMessage } from "./lib";
import { visitor } from "./visitor";

class Board {
  private endpoint: string;
  private site: string;
  private t: Strings;
  private date: Intl.DateTimeFormat;
  private kind: string;
  private listView: HTMLElement;
  private thread: HTMLElement;
  private list: HTMLElement;
  private message: HTMLElement;
  private replyForm: HTMLFormElement | null;
  private listRequest = 0;
  private unwatchMine?: () => void;

  constructor(private el: HTMLElement) {
    this.endpoint = el.dataset.endpoint ?? "";
    this.site = el.dataset.site ?? "";
    this.t = JSON.parse(el.dataset.strings ?? "{}") as Strings;
    this.date = new Intl.DateTimeFormat(el.dataset.lang, { dateStyle: "medium" });
    this.kind = el.querySelector<HTMLElement>('[data-afb-kind][aria-pressed="true"]')?.dataset.afbKind ?? "";
    this.listView = el.querySelector("[data-afb-list-view]")!;
    this.thread = el.querySelector("[data-afb-thread]")!;
    this.list = el.querySelector("[data-afb-list]")!;
    this.message = el.querySelector("[data-afb-message]")!;
    this.replyForm = this.thread.querySelector("form[data-afb-form]");

    el.addEventListener("click", (event) => this.onClick(event));
    el.querySelector("[data-afb-sort]")?.addEventListener("change", () => this.loadList());
    el.querySelector("[data-afb-status-filter]")?.addEventListener("change", () => this.loadList());
    el.addEventListener("afb:submitted", (event) => {
      const detail = (event as CustomEvent<{ status: string; parent?: string }>).detail;
      if (detail.parent && detail.status === "approved") void this.showThread(detail.parent);
    });
    window.addEventListener("hashchange", () => {
      if (this.el.isConnected) this.route();
    });

    this.route();
    this.watchMine();
  }

  /** (Re)subscribes "Your posts" to the visitor session. */
  watchMine(): void {
    this.unwatchMine?.();
    this.unwatchMine = visitor.watch(this.endpoint, this.site, (me) => this.renderMine(me));
  }

  private route(): void {
    const match = location.hash.match(/^#afb-([\w-]+)$/);
    if (match && match[1] !== "mine") {
      void this.showThread(match[1]);
      return;
    }
    const wasThread = !this.thread.hidden;
    this.thread.hidden = true;
    this.listView.hidden = false;
    if (wasThread || this.list.getAttribute("aria-busy") === "true") void this.loadList();
  }

  private onClick(event: Event): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const kindButton = target.closest<HTMLElement>("[data-afb-kind]");
    if (kindButton) {
      this.kind = kindButton.dataset.afbKind ?? "";
      this.el.querySelectorAll<HTMLElement>("[data-afb-kind]").forEach((b) => {
        b.setAttribute("aria-pressed", String(b === kindButton));
      });
      void this.loadList();
      return;
    }

    const vote = target.closest<HTMLButtonElement>("[data-afb-vote]");
    if (vote) {
      void this.toggleVote(vote);
      return;
    }

    if (target.closest("[data-afb-back]")) {
      event.preventDefault();
      history.pushState(null, "", location.pathname + location.search);
      this.route();
      return;
    }

    const remove = target.closest<HTMLElement>("[data-afb-delete]");
    if (remove && confirm(this.t.deleteConfirm)) void this.deletePost(remove.dataset.afbDelete!);
  }

  // List ---------------------------------------------------------------------

  private skeletons(): HTMLElement[] {
    return [0, 1, 2].map(() => h("li", { class: "afb-skeleton", "aria-hidden": "true" }));
  }

  private emptyState(text: string, iconName: IconName): HTMLElement {
    return h("li", { class: "afb-empty" }, h("span", { class: "afb-icon-tile" }, svg(iconName)), text);
  }

  private async loadList(): Promise<void> {
    const request = ++this.listRequest;
    const params = new URLSearchParams();
    params.set("sort", this.el.querySelector<HTMLSelectElement>("[data-afb-sort]")?.value ?? "top");
    const status = this.el.querySelector<HTMLSelectElement>("[data-afb-status-filter]")?.value;
    if (status) params.set("status", status);
    if (this.kind) params.set("kind", this.kind);

    this.list.setAttribute("aria-busy", "true");
    this.list.replaceChildren(...this.skeletons());
    this.message.textContent = this.t.loading;
    try {
      const { feedback } = await visitor.request<FeedbackListResponse>(
        this.endpoint,
        `/v1/sites/${encodeURIComponent(this.site)}/feedback?${params}`,
      );
      if (request !== this.listRequest) return;
      const items = feedback.map((post, index) => {
        const item = this.item(post);
        item.style.animationDelay = `${Math.min(index, 8) * 30}ms`;
        return item;
      });
      this.list.replaceChildren(...(items.length ? items : [this.emptyState(this.t.empty, "inbox")]));
      this.message.textContent = "";
    } catch {
      if (request !== this.listRequest) return;
      this.list.replaceChildren(this.emptyState(this.t.loadError, "alert"));
      this.message.textContent = this.t.loadError;
    } finally {
      if (request === this.listRequest) this.list.setAttribute("aria-busy", "false");
    }
  }

  private item(post: PublicPost): HTMLElement {
    return h(
      "li",
      { class: "afb-item" },
      this.voteButton(post),
      h(
        "div",
        { class: "afb-item-main" },
        h("a", { class: "afb-item-link", href: `#afb-${post.id}` }, post.body),
        this.meta(post, true),
      ),
    );
  }

  private chips(post: { kind?: Kind; topic_status: TopicStatus | null }): Child[] {
    return [
      post.kind &&
        h(
          "span",
          { class: `afb-chip afb-chip--${post.kind}` },
          svg(KIND_ICONS[post.kind]),
          kindLabels(this.t)[post.kind],
        ),
      // "open" is the default and gets no chip.
      post.topic_status &&
        post.topic_status !== "open" &&
        h("span", { class: `afb-chip afb-chip--${post.topic_status}` }, topicStatusLabels(this.t)[post.topic_status]),
    ];
  }

  private meta(post: PublicPost, withReplies: boolean): HTMLElement {
    return h(
      "div",
      { class: "afb-meta" },
      ...this.chips(post),
      this.author(post),
      h("span", { class: "afb-meta-item" }, this.date.format(post.created_at)),
      withReplies &&
        post.replies !== undefined &&
        h("span", { class: "afb-meta-item" }, svg("replies"), plural(post.replies, this.t.repliesOne, this.t.repliesOther)),
    );
  }

  private author(post: PublicPost): HTMLElement {
    const name = displayName(this.t, post);
    return h("span", { class: "afb-author" }, avatar(name, post.is_team), name);
  }

  private voteButton(post: PublicPost): HTMLElement {
    const button = h("button", { type: "button", class: "afb-vote", "data-afb-vote": post.id });
    this.setVoteState(button, !!post.voted, post.votes ?? 0);
    return button;
  }

  private setVoteState(button: HTMLElement, voted: boolean, votes: number): void {
    button.setAttribute("aria-pressed", String(voted));
    button.setAttribute(
      "aria-label",
      `${voted ? this.t.unvote : this.t.vote} (${plural(votes, this.t.votesOne, this.t.votesOther)})`,
    );
    button.title = voted ? this.t.unvote : this.t.vote;
    button.replaceChildren(svg("up"), h("span", {}, String(votes)));
  }

  private async toggleVote(button: HTMLElement): Promise<void> {
    const id = button.dataset.afbVote!;
    if (button.getAttribute("aria-busy") === "true") return;
    button.setAttribute("aria-busy", "true");
    try {
      const { voted, votes } = await visitor.request<VoteResponse>(
        this.endpoint,
        `/v1/feedback/${encodeURIComponent(id)}/vote`,
        { method: "POST" },
      );
      this.el.querySelectorAll<HTMLElement>(`[data-afb-vote="${CSS.escape(id)}"]`).forEach((b) => {
        this.setVoteState(b, voted, votes);
      });
    } catch (error) {
      this.flash(errorMessage(error instanceof ApiError ? error.code : undefined, this.t));
    } finally {
      button.removeAttribute("aria-busy");
    }
  }

  private flash(text: string): void {
    const anchor = this.thread.hidden ? this.list : this.thread.querySelector("[data-afb-thread-post]");
    if (!anchor) return;
    const note = h("p", { class: "afb-alert", role: "alert" }, text);
    anchor.before(note);
    setTimeout(() => note.remove(), 4000);
  }

  // Thread -------------------------------------------------------------------

  private async showThread(id: string): Promise<void> {
    this.listView.hidden = true;
    this.thread.hidden = false;
    const postBox = this.thread.querySelector<HTMLElement>("[data-afb-thread-post]")!;
    const replies = this.thread.querySelector<HTMLElement>("[data-afb-replies]")!;
    const replyCount = this.thread.querySelector<HTMLElement>("[data-afb-reply-count]");
    if (this.replyForm && this.replyForm.dataset.parent !== id) {
      this.replyForm.dataset.parent = id;
      const status = this.replyForm.querySelector<HTMLElement>("[data-afb-status]");
      if (status) status.replaceChildren();
    }
    if (postBox.dataset.id !== id) {
      postBox.replaceChildren(h("div", { class: "afb-skeleton", "aria-hidden": "true" }));
      replies.replaceChildren();
      if (replyCount) replyCount.textContent = "";
    }
    this.el.scrollIntoView({ block: "start", behavior: "smooth" });

    try {
      const data = await visitor.request<ThreadResponse>(this.endpoint, `/v1/feedback/${encodeURIComponent(id)}`);
      postBox.dataset.id = id;
      postBox.replaceChildren(
        h(
          "article",
          { class: "afb-thread-post" },
          this.voteButton(data.feedback),
          h("div", { class: "afb-item-main" }, h("p", { class: "afb-body" }, data.feedback.body), this.meta(data.feedback, false)),
        ),
      );
      if (replyCount) replyCount.textContent = String(data.replies.length);
      replies.replaceChildren(
        ...(data.replies.length
          ? data.replies.map((reply) => {
              const name = displayName(this.t, reply);
              return h(
                "li",
                { class: `afb-reply${reply.is_team ? " afb-reply--team" : ""}` },
                avatar(name, reply.is_team),
                h(
                  "div",
                  { class: "afb-bubble" },
                  h(
                    "div",
                    { class: "afb-meta" },
                    reply.is_team
                      ? h("span", { class: "afb-chip afb-chip--feedback" }, svg("shield"), name)
                      : h("span", { class: "afb-author" }, name),
                    h("span", {}, this.date.format(reply.created_at)),
                  ),
                  h("p", { class: "afb-body" }, reply.body),
                ),
              );
            })
          : [this.emptyState(this.t.noReplies, "replies")]),
      );
      // The Worker marks the thread as seen, so the unseen counts change.
      void visitor.refresh(this.endpoint, this.site);
    } catch {
      postBox.dataset.id = "";
      postBox.replaceChildren(h("p", { class: "afb-alert" }, this.t.loadError));
    }
  }

  // The visitor's own posts --------------------------------------------------

  private renderMine(data: MeResponse): void {
    const section = this.el.querySelector<HTMLElement>("[data-afb-mine]");
    const list = this.el.querySelector<HTMLElement>("[data-afb-mine-list]");
    const count = this.el.querySelector<HTMLElement>("[data-afb-mine-count]");
    if (!section || !list) return;
    const wasHidden = section.hidden;
    section.hidden = data.posts.length === 0;
    if (count) count.textContent = String(data.posts.length);
    list.replaceChildren(...data.posts.map((post) => this.mineItem(post)));
    if (wasHidden && location.hash === "#afb-mine" && !section.hidden) section.scrollIntoView({ block: "start" });
  }

  private mineItem(post: MePost): HTMLElement {
    const t = this.t;
    const statusLabel = { pending: t.minePending, approved: t.mineApproved, rejected: t.mineRejected }[post.status];
    const statusIcon: IconName = post.status === "approved" ? "checkCircle" : post.status === "pending" ? "clock" : "x";
    const short = (text: string) => (text.length > 140 ? `${text.slice(0, 140)}…` : text);
    return h(
      "li",
      { class: "afb-mine-item" },
      h(
        "div",
        { class: "afb-meta" },
        h("span", { class: `afb-chip afb-chip--${post.status}` }, svg(statusIcon), statusLabel),
        ...(post.article
          ? [h("span", { class: "afb-chip" }, svg("replies"), t.mineComment)]
          : !post.parent_id
            ? this.chips({ kind: post.kind, topic_status: null })
            : []),
        h("span", {}, this.date.format(post.created_at)),
        post.unseen > 0 && h("span", { class: "afb-chip afb-unseen" }, plural(post.unseen, t.newRepliesOne, t.newRepliesOther)),
      ),
      post.parent_body && h("div", { class: "afb-meta" }, `${t.mineReplyTo}: ${short(post.parent_body)}`),
      h("p", { class: "afb-body" }, short(post.body)),
      h(
        "div",
        { class: "afb-mine-actions" },
        // A comment links to its article once it is published.
        post.article &&
          post.status === "approved" &&
          post.page_url &&
          h("a", { class: "afb-text-link", href: post.page_url }, svg("replies"), t.openArticle),
        // A reply links to its public thread; own feedback only once it is published.
        post.thread_id &&
          (post.parent_id || post.status === "approved") &&
          h(
            "a",
            { class: "afb-text-link", href: `#afb-${post.thread_id}` },
            svg("replies"),
            post.parent_id ? t.openThread : plural(post.replies, t.repliesOne, t.repliesOther),
          ),
        h(
          "button",
          { type: "button", class: "afb-text-link afb-text-link--danger", "data-afb-delete": post.id },
          svg("trash"),
          t.deletePost,
        ),
      ),
    );
  }

  private async deletePost(id: string): Promise<void> {
    try {
      await visitor.request(this.endpoint, `/v1/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      await visitor.refresh(this.endpoint, this.site);
      if (this.thread.hidden) await this.loadList();
    } catch {
      this.flash(this.t.errorGeneric);
    }
  }
}

const boards = new WeakMap<HTMLElement, Board>();

export function initBoards(): void {
  const setup = () =>
    document.querySelectorAll<HTMLElement>("[data-afb-board]").forEach((el) => {
      const board = boards.get(el);
      // A board kept across a view transition lost its watch in visitor.reset().
      if (board) board.watchMine();
      else boards.set(el, new Board(el));
    });
  setup();
  document.addEventListener("astro:page-load", setup);
}

// Small DOM helpers for the client scripts. Visitor content is only ever
// inserted as text; icons come from icons.ts.
import type { Strings } from "../i18n";
import { icon, type IconName } from "../icons";
import type { PublicPost } from "../protocol";

export type Child = Node | string | null | undefined | false;

export function h(
  tag: string,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === "class") el.className = String(value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

/** Icons are static strings from icons.ts, never visitor content. */
export function svg(name: IconName): Node {
  const template = document.createElement("template");
  template.innerHTML = icon(name);
  return template.content.firstChild!;
}

export function avatar(name: string, team: boolean): HTMLElement {
  if (team) return h("span", { class: "afb-avatar afb-avatar--team", "aria-hidden": "true" }, svg("check"));
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const initials = name.startsWith("#") ? "#" : name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const el = h("span", { class: "afb-avatar", "aria-hidden": "true" }, initials);
  el.style.background = `hsl(${hash % 360} 55% 42%)`;
  return el;
}

/** Nickname, "Team", or "Anonym #a3f". */
export function displayName(t: Strings, post: Pick<PublicPost, "is_team" | "nickname" | "tag">): string {
  if (post.is_team) return post.nickname || t.team;
  return post.nickname || `${t.anonymous} #${post.tag}`;
}

export function stringsOf(el: HTMLElement): Strings {
  return JSON.parse(el.dataset.strings ?? "{}") as Strings;
}

// Admin panel: one static page, talks to /admin/api. Visitor content is only
// ever inserted with textContent, never as HTML. Icons are Lucide (ISC license).
import type { Kind, ModerationMode, TopicStatus } from "astro-feedback-board/protocol";
import { NOTE_MAX_LENGTH } from "../trust";

// Labels for the admin panel. Typed against the protocol, so a new kind,
// topic status or mode fails the type check until it has a label here.
const KIND_LABELS: Record<Kind, string> = { feedback: "Feedback", idea: "Idee", bug: "Fehler" };
const TOPIC_LABELS: Record<TopicStatus, string> = {
  open: "Offen",
  planned: "Geplant",
  in_progress: "In Arbeit",
  done: "Erledigt",
  declined: "Abgelehnt",
};
const MODE_LABELS: Record<ModerationMode, string> = {
  all: "Alles prüfen",
  untrusted: "Nur unbekannte Geräte prüfen",
  none: "Keine Moderation",
};

export const adminHtml = /* html */ `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Feedback admin</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f8fafc; --surface: #ffffff; --surface-2: #f1f5f9; --fg: #0f172a; --muted: #475569; --subtle: #64748b;
    --line: #e2e8f0; --line-strong: #cbd5e1;
    --accent: #2563eb; --accent-soft: #dbeafe; --accent-fg: #ffffff;
    --ok: #15803d; --ok-soft: #dcfce7; --bad: #dc2626; --bad-soft: #fee2e2; --warn: #b45309; --warn-soft: #fef3c7;
    --violet: #7c3aed; --violet-soft: #ede9fe;
    --shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 1px 3px rgb(15 23 42 / 0.08);
    --shadow-lg: 0 10px 30px -10px rgb(15 23 42 / 0.25);
    --radius: 12px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b1120; --surface: #111827; --surface-2: #1e293b; --fg: #f1f5f9; --muted: #cbd5e1; --subtle: #94a3b8;
      --line: #1f2937; --line-strong: #334155;
      --accent: #3b82f6; --accent-soft: #1e3a8a55;
      --ok: #4ade80; --ok-soft: #14532d66; --bad: #f87171; --bad-soft: #7f1d1d55; --warn: #fbbf24; --warn-soft: #78350f55;
      --violet: #c4b5fd; --violet-soft: #4c1d9555;
      --shadow: 0 1px 2px rgb(0 0 0 / 0.4); --shadow-lg: 0 10px 30px -10px rgb(0 0 0 / 0.6);
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--fg); -webkit-font-smoothing: antialiased; }
  button, select, input, textarea { font: inherit; color: inherit; }
  svg.i { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  :focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 45%, transparent); outline-offset: 2px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  /* Top bar */
  header { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--surface) 85%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
  .bar { max-width: 1040px; margin: 0 auto; padding: 10px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -0.01em; margin-right: 8px; }
  .brand-mark { width: 32px; height: 32px; border-radius: 9px; background: var(--accent); color: var(--accent-fg); display: grid; place-items: center; }
  .brand-mark svg.i { width: 18px; height: 18px; }
  .brand small { font-weight: 500; color: var(--subtle); }
  nav { display: flex; gap: 2px; padding: 3px; background: var(--surface-2); border-radius: 10px; flex-wrap: wrap; }
  nav button { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 12px; border: 0; border-radius: 8px; background: none; color: var(--muted); cursor: pointer; font-weight: 500; transition: background .15s, color .15s; }
  nav button:hover { color: var(--fg); }
  nav button[aria-current="true"] { background: var(--surface); color: var(--fg); box-shadow: var(--shadow); }
  .count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--accent); color: var(--accent-fg); font-size: 12px; font-weight: 600; display: inline-grid; place-items: center; }
  .count:empty { display: none; }
  .spacer { flex: 1; }

  main { max-width: 1040px; margin: 0 auto; padding: 24px 20px 80px; }
  .page-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .page-head h1 { font-size: 22px; letter-spacing: -0.02em; margin: 0; }
  .page-head p { margin: 0; color: var(--subtle); font-size: 14px; }
  kbd { font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; padding: 3px 5px; border-radius: 5px; border: 1px solid var(--line-strong); border-bottom-width: 2px; color: var(--muted); background: var(--surface); }
  .keys { display: flex; gap: 12px; flex-wrap: wrap; color: var(--subtle); font-size: 13px; }
  .keys span { display: inline-flex; gap: 5px; align-items: center; }

  /* Controls */
  .select, .input, textarea.input { min-height: 36px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); transition: border-color .15s, box-shadow .15s; }
  .select { padding-right: 28px; appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; }
  .input:focus, .select:focus, textarea.input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent); outline: none; }
  textarea.input { width: 100%; min-height: 96px; resize: vertical; line-height: 1.5; }
  .chip-select { min-height: 28px; padding: 2px 26px 2px 10px; font-size: 13px; font-weight: 500; border-radius: 999px; background-position: right 6px center; }
  .btn { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); cursor: pointer; font-weight: 500; font-size: 14px; transition: background .15s, border-color .15s, transform .1s; }
  .btn:hover { background: var(--surface-2); }
  .btn:active { transform: translateY(1px); }
  .btn:disabled { opacity: .45; cursor: not-allowed; }
  .btn kbd { margin-left: 2px; }
  .btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
  .btn-primary:hover { background: color-mix(in srgb, var(--accent) 88%, black); }
  .btn-ok { background: var(--ok); border-color: var(--ok); color: #fff; }
  @media (prefers-color-scheme: dark) { .btn-ok { color: #052e16; } }
  .btn-ok:hover { background: color-mix(in srgb, var(--ok) 88%, black); }
  .btn-ok kbd, .btn-primary kbd { background: transparent; color: inherit; border-color: currentColor; opacity: .7; }
  .btn-ghost { border-color: transparent; background: none; color: var(--muted); }
  .btn-ghost:hover { background: var(--surface-2); color: var(--fg); }
  .btn-danger { color: var(--bad); }
  .btn-danger:hover { background: var(--bad-soft); }

  /* Cards */
  .list { display: grid; gap: 12px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px 18px; transition: border-color .15s, box-shadow .15s; }
  .card.active { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent), var(--shadow); }
  .card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .who { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .who-text { display: grid; line-height: 1.25; }
  .who-name { font-weight: 600; font-size: 14px; }
  .who-sub { font-size: 12.5px; color: var(--subtle); }
  .avatar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 600; font-size: 13px; flex: none; }
  .avatar.team { background: var(--accent); }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-left: auto; }
  .chip { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 999px; font-size: 12.5px; font-weight: 500; background: var(--surface-2); color: var(--muted); white-space: nowrap; }
  .chip svg.i { width: 13px; height: 13px; }
  .chip.ok { background: var(--ok-soft); color: var(--ok); }
  .chip.warn { background: var(--warn-soft); color: var(--warn); }
  .chip.accent { background: var(--accent-soft); color: var(--accent); }
  .chip.violet { background: var(--violet-soft); color: var(--violet); }
  .chip.bad { background: var(--bad-soft); color: var(--bad); }
  a.chip { text-decoration: none; }
  a.chip:hover { color: var(--fg); }
  .body { white-space: pre-wrap; overflow-wrap: anywhere; margin: 12px 0 4px; font-size: 15px; }
  .quote { margin-top: 12px; padding: 8px 12px; border-left: 3px solid var(--line-strong); background: var(--surface-2); border-radius: 0 8px 8px 0; font-size: 13.5px; color: var(--muted); white-space: pre-wrap; overflow-wrap: anywhere; }
  .quote b { display: block; font-size: 12px; font-weight: 600; color: var(--subtle); margin-bottom: 2px; }
  details.ctx { margin-top: 8px; font-size: 13px; color: var(--subtle); }
  details.ctx summary { cursor: pointer; width: fit-content; }
  details.ctx pre { margin: 6px 0 0; padding: 10px 12px; border-radius: 8px; background: var(--surface-2); color: var(--muted); white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
  .trust-panel { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px; padding: 12px; border-radius: 10px; background: var(--accent-soft); }
  .trust-panel .input { flex: 1; min-width: 160px; }
  .trust-panel strong { width: 100%; font-size: 13px; display: flex; gap: 6px; align-items: center; color: var(--accent); }

  /* Feedback view */
  .fb { display: grid; grid-template-columns: auto 1fr; gap: 14px; }
  .votes { width: 52px; height: 58px; border-radius: 10px; border: 1px solid var(--line); display: grid; place-items: center; align-content: center; gap: 0; font-weight: 700; color: var(--muted); }
  .votes svg.i { color: var(--subtle); }
  .thread { margin-top: 12px; display: grid; gap: 8px; }
  .reply { display: grid; grid-template-columns: auto 1fr; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); }
  .reply.team { background: var(--accent-soft); }
  .reply .avatar { width: 28px; height: 28px; font-size: 11px; }
  .reply .body { margin: 2px 0 0; font-size: 14px; }
  .composer { display: flex; gap: 8px; align-items: flex-end; margin-top: 12px; }
  .composer textarea.input { min-height: 40px; flex: 1; }
  .composer textarea.input { height: 88px; }
  .composer[hidden] { display: none; }

  /* Table */
  .table-card { padding: 0; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--subtle); padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
  td { padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tr:last-child td { border-bottom: 0; }
  code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 2px 6px; border-radius: 6px; background: var(--surface-2); }
  .check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); cursor: pointer; }
  .check input { width: 16px; height: 16px; accent-color: var(--accent); }

  /* Sites */
  .site-form { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
  .site-form h2 { grid-column: 1 / -1; margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }
  .field { display: grid; align-content: start; gap: 6px; font-size: 13px; font-weight: 500; color: var(--muted); }
  .field small { font-weight: 400; color: var(--subtle); }
  .field .input, .field .select { width: 100%; }
  .wide { grid-column: 1 / -1; }
  form[hidden] { display: none; }
  .form-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
  @media (max-width: 640px) { .site-form { grid-template-columns: 1fr; } .chips { margin-left: 0; } }

  /* States */
  .empty { text-align: center; padding: 56px 20px; color: var(--subtle); }
  .empty .icon-wrap { width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 16px; display: grid; place-items: center; background: var(--surface-2); color: var(--subtle); }
  .empty .icon-wrap svg.i { width: 26px; height: 26px; }
  .empty strong { display: block; color: var(--fg); font-size: 16px; margin-bottom: 4px; }
  .skeleton { height: 132px; border-radius: var(--radius); background: linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; border: 1px solid var(--line); }
  @keyframes shimmer { to { background-position: -200% 0; } }
  #toast { position: fixed; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; background: var(--fg); color: var(--bg); box-shadow: var(--shadow-lg); font-size: 14px; font-weight: 500; opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity .2s, transform .2s; }
  #toast.show { opacity: 1; transform: none; }
  #toast.error { background: var(--bad); color: #fff; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
<header>
  <div class="bar">
    <div class="brand"><span class="brand-mark" data-icon="message"></span><span>Feedback <small>Admin</small></span></div>
    <nav aria-label="Bereiche">
      <button data-view="queue"><span data-icon="inbox"></span>Queue <span class="count" id="queue-count"></span></button>
      <button data-view="feedback"><span data-icon="message"></span>Feedback</button>
      <button data-view="comments"><span data-icon="reply"></span>Kommentare</button>
      <button data-view="devices"><span data-icon="shield"></span>Geräte</button>
      <button data-view="sites"><span data-icon="globe"></span>Sites</button>
    </nav>
    <span class="spacer"></span>
    <label class="sr" for="site-filter">Site</label>
    <select id="site-filter" class="select"><option value="">Alle Sites</option></select>
  </div>
</header>
<main id="main"></main>
<div id="toast" role="status" aria-live="polite"></div>
<script>
(() => {
  const ICONS = {
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    party: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  };
  function icon(name) {
    const span = document.createElement("span");
    span.style.display = "contents";
    span.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>";
    return span.firstChild;
  }
  document.querySelectorAll("[data-icon]").forEach((el) => el.replaceChildren(icon(el.dataset.icon)));

  const main = document.getElementById("main");
  const siteFilter = document.getElementById("site-filter");
  const toast = document.getElementById("toast");
  let view = location.hash.slice(1) || "queue";
  let sites = [];
  let queue = [];
  let active = 0;

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }

  function notify(text, isError) {
    toast.replaceChildren(icon(isError ? "alert" : "check"), text);
    toast.classList.toggle("error", !!isError);
    toast.classList.add("show");
    clearTimeout(notify.t);
    notify.t = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  const fail = (e) => notify("Fehler: " + e.message, true);

  async function api(path, options = {}) {
    const res = await fetch("/admin/api" + path, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || res.statusText);
    return data;
  }

  const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });
  function ago(ts) {
    const s = (ts - Date.now()) / 1000;
    const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [unit, size] of units) if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
    return "gerade eben";
  }
  const fullDate = (ts) => new Date(ts).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  const nick = (p) => p.nickname || p.callsign || "Anonym";
  const siteQuery = () => (siteFilter.value ? "?site=" + encodeURIComponent(siteFilter.value) : "");
  const KINDS = ${JSON.stringify(KIND_LABELS)};
  const TOPICS = ${JSON.stringify(TOPIC_LABELS)};

  function avatar(name, isTeam) {
    if (isTeam) return h("span", { class: "avatar team", "aria-hidden": "true" }, icon("check"));
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const el = h("span", { class: "avatar", "aria-hidden": "true" }, initials);
    el.style.background = "hsl(" + (hash % 360) + " 55% 42%)";
    return el;
  }

  function who(p, sub) {
    return h("div", { class: "who" }, avatar(nick(p), p.is_team),
      h("div", { class: "who-text" }, h("span", { class: "who-name" }, p.is_team ? "Team" : nick(p)),
        h("span", { class: "who-sub", title: fullDate(p.created_at) }, sub)));
  }

  function chip(text, tone, iconName) {
    return h("span", { class: "chip" + (tone ? " " + tone : "") }, iconName ? icon(iconName) : null, text);
  }

  function select(options, value, onchange, extraClass, label) {
    return h("select", { class: "select " + (extraClass || ""), "aria-label": label, onchange: (e) => onchange(e.target.value), onclick: (e) => e.stopPropagation() },
      ...Object.entries(options).map(([v, text]) => h("option", { value: v, selected: v === value }, text)));
  }

  function pageLink(url) {
    if (!url) return null;
    return h("a", { class: "chip", href: url, target: "_blank", rel: "noopener", title: url }, icon("external"), new URL(url).pathname);
  }

  function empty(iconName, title, text) {
    return h("div", { class: "card empty" }, h("div", { class: "icon-wrap" }, icon(iconName)), h("strong", {}, title), text);
  }

  function pageHead(title, sub, extra) {
    return h("div", { class: "page-head" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null), extra || null);
  }

  function loading() {
    main.replaceChildren(h("div", { class: "list" }, h("div", { class: "skeleton" }), h("div", { class: "skeleton" })));
  }

  async function updatePost(id, data) {
    try {
      await api("/posts/" + id, { method: "POST", body: JSON.stringify(data) });
      notify("Gespeichert");
    } catch (e) { fail(e); }
  }

  /** Inline form to trust the device behind a post. */
  function trustPanel(post, confirmLabel, onSaved) {
    const days = select({ "7": "7 Tage", "30": "30 Tage", "90": "90 Tage", "0": "Dauerhaft" }, "30", () => {}, "", "Dauer");
    const scope = select({ site: "Nur " + post.site_name, all: "Alle Sites" }, "site", () => {}, "", "Geltungsbereich");
    const note = h("input", { class: "input", placeholder: "Notiz, z. B. Hans aus dem Forum", maxlength: ${NOTE_MAX_LENGTH}, "aria-label": "Notiz" });
    const save = async () => {
      try {
        await api("/trust", { method: "POST", body: JSON.stringify({
          author_hash: post.author_hash,
          site_id: scope.value === "all" ? "" : post.site_id,
          days: Number(days.value),
          note: note.value,
        }) });
        await onSaved();
      } catch (e) { fail(e); }
    };
    note.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); save(); } });
    return h("div", { class: "trust-panel", onclick: (e) => e.stopPropagation() },
      h("strong", {}, icon("shield"), "Diesem Gerät vertrauen"),
      days, scope, note, h("button", { class: "btn btn-primary", onclick: save }, icon("check"), confirmLabel));
  }

  function contextDetails(context) {
    if (!context) return null;
    let pretty = context;
    try { pretty = JSON.stringify(JSON.parse(context), null, 2); } catch {}
    return h("details", { class: "ctx" }, h("summary", {}, "Kontext anzeigen"), h("pre", {}, pretty));
  }

  async function loadSites() {
    sites = (await api("/sites")).sites;
    const current = siteFilter.value;
    siteFilter.replaceChildren(h("option", { value: "" }, "Alle Sites"),
      ...sites.map((s) => h("option", { value: s.id }, s.name)));
    siteFilter.value = current;
  }

  // Queue ------------------------------------------------------------------

  async function renderQueue() {
    queue = (await api("/queue" + siteQuery())).posts;
    document.getElementById("queue-count").textContent = queue.length || "";
    active = Math.min(active, Math.max(queue.length - 1, 0));
    const keys = h("div", { class: "keys", "aria-label": "Tastenkürzel" },
      ...[["j k", "wählen"], ["a", "freigeben"], ["r", "ablehnen"], ["s", "Spam"], ["e", "bearbeiten"], ["t", "vertrauen"]]
        .map(([k, label]) => h("span", {}, ...k.split(" ").map((x) => h("kbd", {}, x)), label)));
    main.replaceChildren(
      pageHead("Queue", queue.length ? queue.length + (queue.length === 1 ? " Beitrag wartet" : " Beiträge warten") + " auf Freigabe" : null, queue.length ? keys : null),
      queue.length
        ? h("div", { class: "list" }, ...queue.map(queueCard))
        : empty("party", "Alles erledigt", "Keine Beiträge warten auf Freigabe."),
    );
    highlight();
  }

  function queueCard(p, i) {
    const text = h("div", { class: "body" }, p.body);
    const editor = h("textarea", { class: "input", hidden: true, "aria-label": "Text bearbeiten" }, p.body);
    editor.style.marginTop = "12px";
    const card = h("article", { class: "card", "data-index": i },
      h("div", { class: "card-head" },
        who(p, p.site_name + " · " + ago(p.created_at)),
        h("div", { class: "chips" },
          p.trusted ? chip("Vertraut", "ok", "shield") : null,
          p.parent_id ? chip("Antwort", "", "reply")
            : p.article ? chip("Kommentar · " + p.article, "", "reply")
            : select(KINDS, p.kind, (kind) => { p.kind = kind; updatePost(p.id, { kind }); }, "chip-select", "Art"),
          pageLink(p.page_url))),
      p.parent_body ? h("div", { class: "quote" }, h("b", {}, "Antwort auf"), p.parent_body) : null,
      text, editor,
      contextDetails(p.context),
      h("div", { class: "actions" },
        h("button", { class: "btn btn-ok", onclick: () => act(i, "approve") }, icon("check"), "Freigeben", h("kbd", {}, "a")),
        h("button", { class: "btn", onclick: () => act(i, "reject") }, icon("x"), "Ablehnen", h("kbd", {}, "r")),
        h("button", { class: "btn btn-ghost btn-danger", onclick: () => act(i, "spam") }, icon("ban"), "Spam", h("kbd", {}, "s")),
        h("span", { class: "spacer" }),
        h("button", { class: "btn btn-ghost", onclick: () => toggleEdit(i) }, icon("pencil"), "Bearbeiten", h("kbd", {}, "e")),
        h("button", { class: "btn btn-ghost", onclick: () => openTrust(i), disabled: !p.author_hash || !!p.trusted,
          title: !p.author_hash ? "Kein Geräte-Token" : p.trusted ? "Gerät ist schon vertrauenswürdig" : "Freigeben und dem Gerät vertrauen" },
          icon("shield"), "Vertrauen", h("kbd", {}, "t"))),
    );
    card.addEventListener("click", () => { active = i; highlight(false); });
    card._text = text;
    card._editor = editor;
    return card;
  }

  function openTrust(i) {
    const p = queue[i];
    const card = cards()[i];
    if (!p || !card || !p.author_hash || p.trusted || card.querySelector(".trust-panel")) return;
    const panel = trustPanel(p, "Vertrauen und freigeben", () => act(i, "approve"));
    card.append(panel);
    panel.querySelector("input").focus();
  }

  function cards() { return [...main.querySelectorAll("article.card[data-index]")]; }

  function highlight(scroll = true) {
    cards().forEach((c, i) => c.classList.toggle("active", i === active));
    if (scroll) cards()[active]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function toggleEdit(i) {
    const card = cards()[i];
    if (!card) return;
    const editing = !card._editor.hidden;
    card._editor.hidden = editing;
    card._text.hidden = !editing;
    if (!editing) card._editor.focus();
  }

  async function act(i, action) {
    const p = queue[i];
    const card = cards()[i];
    if (!p || !card) return;
    const payload = { action };
    if (!card._editor.hidden && card._editor.value.trim() !== p.body) payload.body = card._editor.value;
    try {
      const res = await api("/posts/" + p.id + "/moderate", { method: "POST", body: JSON.stringify(payload) });
      notify({ approve: res.auto_trusted ? "Freigegeben, Gerät jetzt automatisch vertraut" : "Freigegeben", reject: "Abgelehnt", spam: "Als Spam markiert" }[action]);
      await renderQueue();
    } catch (e) { fail(e); }
  }

  document.addEventListener("keydown", (e) => {
    if (view !== "queue" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches("textarea, input, select")) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    const actions = { a: "approve", r: "reject", s: "spam" };
    if (e.key === "j") { active = Math.min(active + 1, queue.length - 1); highlight(); }
    else if (e.key === "k") { active = Math.max(active - 1, 0); highlight(); }
    else if (e.key === "e") { e.preventDefault(); toggleEdit(active); }
    else if (e.key === "t") { e.preventDefault(); openTrust(active); }
    else if (actions[e.key]) act(active, actions[e.key]);
  });

  // Feedback + team replies -----------------------------------------------

  async function renderFeedback() {
    const comments = view === "comments";
    const { feedback } = await api((comments ? "/comments" : "/feedback") + siteQuery());
    main.replaceChildren(
      comments
        ? pageHead("Kommentare", "Kommentare zu Artikeln, als Team antworten")
        : pageHead("Feedback", "Art und Status setzen, als Team antworten"),
      feedback.length
        ? h("div", { class: "list" }, ...feedback.map(feedbackCard))
        : comments
          ? empty("reply", "Noch keine Kommentare", "Freigegebene und wartende Kommentare erscheinen hier.")
          : empty("message", "Noch kein Feedback", "Freigegebene und wartende Beiträge erscheinen hier."),
    );
  }

  function feedbackCard(f) {
    const input = h("textarea", { class: "input", placeholder: "Als Team antworten …", required: true, "aria-label": "Antwort als Team" });
    const composer = h("form", { class: "composer", onsubmit: async (e) => {
      e.preventDefault();
      try {
        await api("/feedback/" + f.id + "/replies", { method: "POST", body: JSON.stringify({ body: input.value }) });
        notify("Antwort veröffentlicht");
        renderFeedback();
      } catch (err) { fail(err); }
    } }, input, h("button", { class: "btn btn-primary", type: "submit" }, icon("send"), "Senden"));
    composer.hidden = true;


    const trustButton = f.author_hash && !f.trusted ? h("button", { class: "btn btn-ghost", onclick: () => {
      if (card.querySelector(".trust-panel")) return;
      card.append(trustPanel(f, "Vertrauen", async () => { notify("Gerät vertraut"); await renderFeedback(); }));
    } }, icon("shield"), "Vertrauen") : null;

    const card = h("article", { class: "card" },
      h("div", { class: "fb" },
        f.article ? h("div", {}) : h("div", { class: "votes", title: f.votes + " Stimmen" }, icon("up"), String(f.votes)),
        h("div", {},
          h("div", { class: "card-head" },
            who(f, f.site_name + " · " + ago(f.created_at)),
            h("div", { class: "chips" },
              f.status === "pending" ? chip("Wartet", "warn") : null,
              f.trusted ? chip("Vertraut", "ok", "shield") : null,
              f.article ? chip(f.article, "", "reply") : select(KINDS, f.kind, (kind) => updatePost(f.id, { kind }), "chip-select", "Art"),
              f.article ? null : select(TOPICS, f.topic_status || "open", (topic_status) => updatePost(f.id, { topic_status }), "chip-select", "Status"),
              pageLink(f.page_url))),
          h("div", { class: "body" }, f.body),
          contextDetails(f.context),
          f.replies.length ? h("div", { class: "thread" }, ...f.replies.map((r) => h("div", { class: "reply" + (r.is_team ? " team" : "") },
            avatar(nick(r), r.is_team),
            h("div", {},
              h("div", { class: "who-sub" }, h("b", {}, r.is_team ? "Team" : nick(r)), " · " + ago(r.created_at), r.status === "pending" ? " · wartet auf Freigabe" : ""),
              h("div", { class: "body" }, r.body))))) : null,
          composer,
          h("div", { class: "actions" },
            h("button", { class: "btn", onclick: () => { composer.hidden = false; input.focus(); } }, icon("reply"), "Antworten"),
            trustButton,
            h("span", { class: "spacer" }),
            h("button", { class: "btn btn-ghost btn-danger", onclick: async () => {
              if (!confirm((f.article ? "Kommentar" : "Feedback") + " mit allen Antworten löschen?")) return;
              try {
                await api("/posts/" + f.id, { method: "DELETE" });
                notify("Gelöscht");
                renderFeedback();
              } catch (e) { fail(e); }
            } }, icon("trash"), "Löschen")))),
    );
    return card;
  }

  // Trusted devices -------------------------------------------------------

  async function renderDevices() {
    const { trust } = await api("/trust");
    const head = pageHead("Vertraute Geräte", "Posts dieser Geräte gehen bei Moderation „untrusted“ sofort live");
    if (!trust.length) {
      main.replaceChildren(head, empty("shield", "Keine vertrauten Geräte", "Vertraue einem Gerät in der Queue mit t."));
      return;
    }
    const now = Date.now();
    main.replaceChildren(head, h("div", { class: "card table-card" }, h("table", {},
      h("thead", {}, h("tr", {}, ...["Gerät", "Site", "Läuft ab", "Quelle", "Beiträge", "Notiz", ""].map((t) => h("th", {}, t)))),
      h("tbody", {}, ...trust.map((t) => {
        const requeue = h("input", { type: "checkbox" });
        const expired = t.expires_at != null && t.expires_at < now;
        return h("tr", {},
          h("td", {}, h("code", {}, t.author_hash.slice(0, 10))),
          h("td", {}, t.site_id ? (t.site_name || t.site_id) : chip("Alle Sites", "accent")),
          h("td", {}, t.expires_at == null ? chip("Dauerhaft", "ok") : expired ? chip("Abgelaufen", "bad") : h("span", { title: fullDate(t.expires_at) }, ago(t.expires_at))),
          h("td", {}, t.source === "auto" ? chip("Automatisch", "violet") : chip("Manuell")),
          h("td", {}, String(t.posts)),
          h("td", {}, t.note || h("span", { style: "color: var(--subtle)" }, "–")),
          h("td", { style: "white-space: nowrap; text-align: right" },
            h("label", { class: "check", title: "Freigegebene Beiträge des Geräts zurück in die Queue" }, requeue, "Posts zurück in Queue"),
            " ",
            h("button", { class: "btn btn-ghost btn-danger", onclick: async () => {
              try {
                const res = await api("/trust", { method: "DELETE", body: JSON.stringify({ author_hash: t.author_hash, site_id: t.site_id, requeue: requeue.checked }) });
                notify(res.requeued ? "Widerrufen, " + res.requeued + " Beiträge zurück in der Queue" : "Widerrufen");
                renderDevices();
              } catch (e) { fail(e); }
            } }, icon("x"), "Widerrufen")));
      })))));
  }

  // Sites -----------------------------------------------------------------

  const MODES = ${JSON.stringify(MODE_LABELS)};

  function renderSites() {
    const create = siteForm(null);
    create.hidden = !!sites.length;
    main.replaceChildren(
      pageHead("Sites", "Erlaubte Origins und Moderation pro Site",
        h("button", { class: "btn btn-primary", onclick: () => { create.hidden = false; create.querySelector("input").focus(); } }, icon("plus"), "Neue Site")),
      h("div", { class: "list" }, create, ...sites.map((s) => siteForm(s))),
    );
  }

  function siteForm(s) {
    const field = (label, input, hint, wide) => h("label", { class: "field" + (wide ? " wide" : "") }, label, input, hint ? h("small", {}, hint) : null);
    const modeSelect = (name, value) => h("select", { class: "select", name },
      ...Object.entries(MODES).map(([m, text]) => h("option", { value: m, selected: m === value }, text)));
    const form = h("form", { class: "card site-form", onsubmit: async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      data.auto_trust_after = Number(data.auto_trust_after);
      data.auto_trust_days = Number(data.auto_trust_days);
      data.paused = form.elements.paused.checked;
      try {
        await api("/sites", { method: "POST", body: JSON.stringify(data) });
        notify("Gespeichert");
        await loadSites();
        renderSites();
      } catch (err) { fail(err); }
    } },
      h("h2", {}, icon(s ? "globe" : "plus"), s ? s.name : "Neue Site", s?.paused ? chip("Pausiert", "bad") : null),
      field("ID", h("input", { class: "input", name: "id", value: s?.id ?? "", required: true, readonly: !!s, pattern: "[a-z0-9][a-z0-9-]*" }), s ? null : "Kleinbuchstaben, Ziffern und Bindestriche"),
      field("Name", h("input", { class: "input", name: "name", value: s?.name ?? "", required: true })),
      field("Origins", h("input", { class: "input", name: "origin", value: s?.origin ?? "", required: true, placeholder: "https://example.com http://localhost:4321" }), "Mehrere mit Leerzeichen trennen", true),
      field("Moderation Feedback", modeSelect("moderate_feedback", s?.moderate_feedback ?? "all")),
      field("Moderation Antworten", modeSelect("moderate_replies", s?.moderate_replies ?? "all")),
      field("Moderation Kommentare", modeSelect("moderate_comments", s?.moderate_comments ?? "all")),
      field("Auto-Trust nach Freigaben", h("input", { class: "input", name: "auto_trust_after", type: "number", min: 0, value: s?.auto_trust_after ?? 0 }), "0 = aus"),
      field("Auto-Trust gilt Tage", h("input", { class: "input", name: "auto_trust_days", type: "number", min: 0, value: s?.auto_trust_days ?? 30 }), "0 = dauerhaft"),
      h("label", { class: "check wide" }, h("input", { type: "checkbox", name: "paused", checked: !!s?.paused }),
        "Pausieren: keine neuen Beiträge, Stimmen und Reaktionen"),
      h("div", { class: "form-actions" }, h("button", { class: "btn btn-primary", type: "submit" }, icon("check"), s ? "Speichern" : "Site anlegen")),
    );
    return form;
  }

  // Navigation ------------------------------------------------------------

  async function render() {
    if (location.hash.slice(1) !== view) history.pushState(null, "", "#" + view);
    document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.view === view)));
    siteFilter.hidden = view === "sites" || view === "devices";
    if (view !== "sites") loading();
    try {
      if (view === "queue") await renderQueue();
      else if (view === "feedback" || view === "comments") await renderFeedback();
      else if (view === "devices") await renderDevices();
      else renderSites();
    } catch (e) {
      main.replaceChildren(empty("alert", "Laden fehlgeschlagen", e.message));
    }
  }

  document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; render(); }));
  siteFilter.addEventListener("change", render);
  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (next && next !== view) { view = next; render(); }
  });
  loadSites().then(render, (e) => main.replaceChildren(empty("alert", "Laden fehlgeschlagen", e.message)));
  // Keep the queue count fresh while working in other views.
  setInterval(async () => {
    try {
      const { posts } = await api("/queue");
      document.getElementById("queue-count").textContent = posts.length || "";
    } catch {}
  }, 60000);
})();
</script>
</body>
</html>`;

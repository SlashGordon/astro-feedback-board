// The visitor session: the device token, the saved nickname, snoozed prompts
// and the visitor's own posts (GET /v1/me) per site. The only module that
// touches localStorage, and it writes only after the visitor acted: a submit
// with "remember" ticked, or dismissing a prompt.
//
// Buttons and boards watch a site instead of fetching /v1/me themselves, so a
// page with several of them sends one request, and a post sent from any form
// updates every badge and "Your posts" list on the page.
import type { MeResponse } from "../protocol";
import { api } from "./api";

const PREFIX = "afb:";
const TOKEN_KEY = `${PREFIX}token`;
const NICKNAME_KEY = `${PREFIX}nickname`;
const SNOOZE_PREFIX = `${PREFIX}snooze:`;

type Listener = (me: MeResponse) => void;

interface Entry {
  listeners: Set<Listener>;
  value?: MeResponse;
  loading?: Promise<void>;
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createVisitor(storage: () => Storage | null = browserStorage) {
  let entries = new Map<string, Entry>();

  function read(key: string): string | null {
    try {
      return storage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  function write(key: string, value: string): void {
    try {
      storage()?.setItem(key, value);
    } catch {
      // Storage full or blocked: the visitor just loses the token features.
    }
  }

  function entryFor(endpoint: string, site: string): Entry {
    const key = `${endpoint}\n${site}`;
    let entry = entries.get(key);
    if (!entry) entries.set(key, (entry = { listeners: new Set() }));
    return entry;
  }

  function load(endpoint: string, site: string, entry: Entry): Promise<void> {
    const token = read(TOKEN_KEY);
    if (!token) return Promise.resolve();
    const loading = api<MeResponse>(endpoint, `/v1/me?site=${encodeURIComponent(site)}`, { token })
      .then((me) => {
        entry.value = me;
        for (const listener of entry.listeners) listener(me);
      })
      .catch(() => {
        // Keep showing the last known state.
      })
      .finally(() => {
        if (entry.loading === loading) entry.loading = undefined;
      });
    entry.loading = loading;
    return loading;
  }

  return {
    token: (): string | null => read(TOKEN_KEY),
    nickname: (): string | null => read(NICKNAME_KEY),

    /** Stores the token and nickname after a successful submit with "remember" ticked. */
    remember(token: string, nickname: string): void {
      if (read(TOKEN_KEY) !== token) write(TOKEN_KEY, token);
      if (nickname) write(NICKNAME_KEY, nickname);
    },

    /** Time until which a prompt stays hidden, 0 if it is not snoozed. */
    snoozedUntil(key: string): number {
      return Number(read(SNOOZE_PREFIX + key)) || 0;
    },

    /** Hides a prompt until the given time. Only call it after the visitor dismissed or answered the prompt. */
    snooze(key: string, until: number): void {
      write(SNOOZE_PREFIX + key, String(until));
    },

    /** Calls the Worker as this visitor. */
    request<T>(endpoint: string, path: string, init: RequestInit = {}): Promise<T> {
      return api<T>(endpoint, path, { ...init, token: read(TOKEN_KEY) });
    },

    /**
     * Calls the listener with the visitor's posts on a site, now if they are
     * known and again after every refresh. Nothing happens without a token.
     */
    watch(endpoint: string, site: string, listener: Listener): () => void {
      const entry = entryFor(endpoint, site);
      entry.listeners.add(listener);
      if (entry.value) listener(entry.value);
      else if (!entry.loading) void load(endpoint, site, entry);
      return () => entry.listeners.delete(listener);
    },

    /** Loads the visitor's posts again, for example after a submit, delete or opened thread. */
    refresh(endpoint: string, site: string): Promise<void> {
      return load(endpoint, site, entryFor(endpoint, site));
    },

    /**
     * Deletes everything the Worker holds for this device (posts, reactions,
     * callsign), then every afb: key in localStorage. Watchers get an empty list.
     */
    async forget(endpoint: string): Promise<void> {
      const token = read(TOKEN_KEY);
      if (token) await api<null>(endpoint, "/v1/me", { method: "DELETE", token });
      try {
        const store = storage();
        const keys = store ? Array.from({ length: store.length }, (_, i) => store.key(i)) : [];
        for (const key of keys) if (key?.startsWith(PREFIX)) store?.removeItem(key);
      } catch {
        // Storage blocked: nothing was stored either.
      }
      const empty: MeResponse = { posts: [], unseen: 0 };
      for (const entry of entries.values()) {
        entry.value = empty;
        for (const listener of entry.listeners) listener(empty);
      }
    },

    /** Forgets all watchers and cached data. Called when a view transition swaps the page. */
    reset(): void {
      entries = new Map();
    },
  };
}

export type Visitor = ReturnType<typeof createVisitor>;

export const visitor = createVisitor();

if (typeof document !== "undefined") document.addEventListener("astro:after-swap", () => visitor.reset());

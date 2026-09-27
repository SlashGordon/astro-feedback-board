import { afterEach, describe, expect, it, vi } from "vitest";
import type { MeResponse } from "../protocol";
import { createVisitor } from "./visitor";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const TOKEN = "0123456789abcdef0123456789abcdef";

function meResponse(unseen: number): MeResponse {
  return { posts: [], unseen };
}

function stubMe(...responses: MeResponse[]) {
  const fetch = vi.fn(async () => Response.json(responses.shift() ?? meResponse(0)));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("visitor", () => {
  it("loads nothing without a token", async () => {
    const fetch = stubMe();
    const visitor = createVisitor(memoryStorage);
    const listener = vi.fn();
    visitor.watch("https://w", "demo", listener);
    await visitor.refresh("https://w", "demo");
    expect(fetch).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("sends one request for all watchers of a site", async () => {
    const fetch = stubMe(meResponse(2));
    const storage = memoryStorage();
    const visitor = createVisitor(() => storage);
    visitor.remember(TOKEN, "");
    const badge = vi.fn();
    const board = vi.fn();
    visitor.watch("https://w", "demo", badge);
    visitor.watch("https://w", "demo", board);
    await vi.waitFor(() => expect(board).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(badge).toHaveBeenCalledWith(meResponse(2));

    // A late watcher gets the cached state without another request.
    const late = vi.fn();
    visitor.watch("https://w", "demo", late);
    expect(late).toHaveBeenCalledWith(meResponse(2));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("pushes a refresh to every watcher", async () => {
    stubMe(meResponse(1), meResponse(0));
    const storage = memoryStorage();
    const visitor = createVisitor(() => storage);
    visitor.remember(TOKEN, "Hans");
    const listener = vi.fn();
    visitor.watch("https://w", "demo", listener);
    await visitor.refresh("https://w", "demo");
    expect(listener).toHaveBeenLastCalledWith(meResponse(0));
    expect(visitor.nickname()).toBe("Hans");
  });

  it("sends the token with requests", async () => {
    const fetch = stubMe();
    const storage = memoryStorage();
    const visitor = createVisitor(() => storage);
    visitor.remember(TOKEN, "");
    await visitor.request("https://w", "/v1/feedback/x");
    const init = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init[1].headers).get("x-author-token")).toBe(TOKEN);
  });
});

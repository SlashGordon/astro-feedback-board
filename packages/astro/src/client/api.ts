// HTTP calls to the Worker. Callers that act as the visitor go through
// visitor.request(), which adds the device token.
import type { ErrorResponse } from "../protocol";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function api<T>(
  endpoint: string,
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (token) headers.set("x-author-token", token);
  if (rest.body) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(endpoint + path, { ...rest, headers });
  } catch (error) {
    // Usually the Worker is unreachable or rejected the origin (CORS).
    console.warn(`[feedback-board] request to ${endpoint} failed`, error);
    throw new ApiError(0, "network_error");
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as T & Partial<ErrorResponse>;
  if (!response.ok) {
    const code = data.error ?? "unknown_error";
    console.warn(`[feedback-board] ${response.status} ${code}`);
    throw new ApiError(response.status, code);
  }
  return data;
}

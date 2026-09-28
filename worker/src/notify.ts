// Push notifications through ntfy (https://ntfy.sh) for new visitor posts, so
// the queue does not need checking by hand. Off while NTFY_URL is empty.
import type { Env } from "./env";
import type { Draft, FeedbackRef } from "./posts";
import type { Site } from "./sites";

const MAX_MESSAGE = 300;

/** Sends one notification. Failures are logged and never reach the visitor. */
export async function notifyNewPost(
  env: Env,
  site: Site,
  parent: FeedbackRef | null,
  draft: Draft,
  status: "pending" | "approved",
  requestUrl: URL,
): Promise<void> {
  if (!env.NTFY_URL) return;
  const what = parent ? "Antwort" : draft.article ? "Kommentar" : "Feedback";
  // The post text only leaves Cloudflare when the operator opts in.
  const body =
    env.NTFY_INCLUDE_TEXT !== "true"
      ? "Im Admin-Panel ansehen"
      : draft.body.length > MAX_MESSAGE
        ? `${draft.body.slice(0, MAX_MESSAGE)} …`
        : draft.body;
  // JSON publishing keeps umlauts intact, which HTTP headers would not.
  const topic = new URL(env.NTFY_URL);
  try {
    const res = await fetch(topic.origin, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.NTFY_TOKEN ? { authorization: `Bearer ${env.NTFY_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        topic: topic.pathname.slice(1),
        title: `${site.name}: ${what}${status === "pending" ? " wartet auf Freigabe" : " veröffentlicht"}`,
        message: body,
        click: new URL(`/admin#${status === "pending" ? "queue" : draft.article ? "comments" : "feedback"}`, requestUrl).href,
        tags: [status === "pending" ? "hourglass" : "speech_balloon"],
      }),
    });
    if (!res.ok) console.error(`ntfy answered ${res.status}`);
  } catch (e) {
    console.error("ntfy failed", e);
  }
}

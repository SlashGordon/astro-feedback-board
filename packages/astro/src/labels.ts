// How kinds, topic statuses and reactions look: icons, emoji and the localized labels. Shared by
// the .astro components (server) and the board script (browser).
import type { Strings } from "./i18n";
import type { IconName } from "./icons";
import type { Kind, Reaction, TopicStatus } from "./protocol";

export const KIND_ICONS: Record<Kind, IconName> = { feedback: "message", idea: "idea", bug: "bug" };

export function kindLabels(t: Strings): Record<Kind, string> {
  return { feedback: t.kindFeedback, idea: t.kindIdea, bug: t.kindBug };
}

export function kindPlaceholders(t: Strings): Record<Kind, string> {
  return { feedback: t.placeholder, idea: t.placeholderIdea, bug: t.placeholderBug };
}

export function topicStatusLabels(t: Strings): Record<TopicStatus, string> {
  return {
    open: t.statusOpen,
    planned: t.statusPlanned,
    in_progress: t.statusInProgress,
    done: t.statusDone,
    declined: t.statusDeclined,
  };
}

/** Emoji as on dev.to. They render with the visitor's system emoji font. */
export const REACTION_EMOJI: Record<Reaction, string> = {
  like: "❤️",
  unicorn: "🦄",
  mindblown: "🤯",
  clap: "🙌",
  fire: "🔥",
};

export function reactionLabels(t: Strings): Record<Reaction, string> {
  return {
    like: t.reactionLike,
    unicorn: t.reactionUnicorn,
    mindblown: t.reactionMindblown,
    clap: t.reactionClap,
    fire: t.reactionFire,
  };
}

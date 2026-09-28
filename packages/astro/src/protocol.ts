// The contract between the Worker and the components: domain values, content
// rules and the JSON shapes of the public API. Both sides import this file, so
// it must stay free of DOM and Worker APIs. The SQL CHECK constraints in
// worker/migrations repeat the value lists and must be changed together.

export const KINDS = ["feedback", "idea", "bug"] as const;
export type Kind = (typeof KINDS)[number];

export const TOPIC_STATUSES = ["open", "planned", "in_progress", "done", "declined"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const MODERATION_MODES = ["all", "untrusted", "none"] as const;
export type ModerationMode = (typeof MODERATION_MODES)[number];

export type PostStatus = "pending" | "approved" | "rejected" | "spam";

export function isKind(value: unknown): value is Kind {
  return (KINDS as readonly unknown[]).includes(value);
}

export function isTopicStatus(value: unknown): value is TopicStatus {
  return (TOPIC_STATUSES as readonly unknown[]).includes(value);
}

export function isModerationMode(value: unknown): value is ModerationMode {
  return (MODERATION_MODES as readonly unknown[]).includes(value);
}

// Content rules (spam layer 4) ------------------------------------------------

export interface BodyRules {
  minLength: number;
  maxLength: number;
  maxLinks: number;
}

export const VISITOR_RULES: BodyRules = { minLength: 10, maxLength: 2000, maxLinks: 2 };
/** Team replies and admin redactions: any non-empty text up to the maximum length. */
export const TEAM_RULES: BodyRules = { minLength: 1, maxLength: VISITOR_RULES.maxLength, maxLinks: Infinity };

export const NICKNAME_MAX_LENGTH = 40;
/** Minimum time between rendering the form and submitting it (spam layer 1). */
export const MIN_FILL_MS = 3000;

export type ContentError = "too_short" | "too_long" | "too_many_links";

export function countLinks(text: string): number {
  return (text.match(/\bhttps?:\/\/|\bwww\./gi) ?? []).length;
}

/** Length counts code points of the trimmed text, so emoji count once. */
export function bodyLength(text: string): number {
  return [...text.trim()].length;
}

export function checkBody(body: string, rules: BodyRules = VISITOR_RULES): ContentError | null {
  const length = bodyLength(body);
  if (length < rules.minLength) return "too_short";
  if (length > rules.maxLength) return "too_long";
  if (countLinks(body) > rules.maxLinks) return "too_many_links";
  return null;
}

// Articles and reactions --------------------------------------------------------

/** An article key names the page comments and reactions belong to, usually its path ("/blog/hello"). */
export const ARTICLE_MAX_LENGTH = 200;
const ARTICLE_PATTERN = /^[\w\-./:~%]+$/;

export function isArticleKey(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= ARTICLE_MAX_LENGTH && ARTICLE_PATTERN.test(value)
  );
}

/** Reactions a visitor can toggle on an article, in display order. */
export const REACTIONS = ["like", "unicorn", "mindblown", "clap", "fire"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: unknown): value is Reaction {
  return (REACTIONS as readonly unknown[]).includes(value);
}

// Nickname rules ----------------------------------------------------------------

export type NicknameError = "nickname_email" | "nickname_phone";

/** Also catches "name (at) example (dot) de" and "name [at] example.de". */
const EMAIL = /[\w.+-]+\s*(?:@|\(at\)|\[at\]|\{at\})\s*[\w-]+(?:\s*(?:\.|\(dot\)|\[dot\])\s*[\w-]+)+/i;
/** A run of digits with the separators people use in phone numbers. */
const DIGIT_RUN = /[+(]?\d[\d\s().\/-]*\d/g;
/** Phone numbers have at least 7 digits; years, ages or "Hans 2" have fewer. */
const PHONE_MIN_DIGITS = 7;

/** Nicknames are public, so they must not contain an email address or a phone number. */
export function checkNickname(nickname: string): NicknameError | null {
  if (EMAIL.test(nickname)) return "nickname_email";
  for (const run of nickname.match(DIGIT_RUN) ?? []) {
    if (run.replace(/\D/g, "").length >= PHONE_MIN_DIGITS) return "nickname_phone";
  }
  return null;
}

// Public API ------------------------------------------------------------------

/** ALTCHA challenge from GET /v1/challenge. */
export interface Challenge {
  algorithm: "SHA-256";
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

/** A post as the public sees it: no author hash, no context. */
export interface PublicPost {
  id: string;
  /** Feedback only. */
  kind?: Kind;
  body: string;
  nickname: string | null;
  /** Stable name of the author's device on this site ("Lunar Otter 42"), shown without a nickname. */
  callsign: string | null;
  is_team: boolean;
  topic_status: TopicStatus | null;
  page_url: string | null;
  created_at: number;
  votes?: number;
  replies?: number;
  voted?: boolean;
}

/** GET /v1/sites/:site/feedback */
export interface FeedbackListResponse {
  site: { id: string; name: string };
  feedback: PublicPost[];
}

/** GET /v1/feedback/:id */
export interface ThreadResponse {
  feedback: PublicPost;
  replies: PublicPost[];
}

/**
 * POST /v1/sites/:site/feedback, POST /v1/sites/:site/comments and
 * POST /v1/feedback/:id/replies
 */
export interface SubmitRequest {
  body: string;
  kind?: Kind;
  /** Comments only: the article key. */
  article?: string;
  nickname?: string;
  page_url?: string;
  context?: unknown;
  altcha: string;
  /** Honeypot. Humans never fill it. */
  website?: string;
}

export interface SubmitResponse {
  id: string;
  status: "pending" | "approved";
}

/** Reaction counts of an article and the reactions the visitor set. */
export interface ReactionSummary {
  counts: Record<Reaction, number>;
  mine: Reaction[];
}

/** A comment with its approved replies (usually from the team). */
export interface CommentThread extends Omit<PublicPost, "replies"> {
  replies: PublicPost[];
}

/** GET /v1/sites/:site/comments?article= */
export interface CommentsResponse {
  comments: CommentThread[];
  reactions: ReactionSummary;
}

/**
 * POST /v1/sites/:site/reactions sets the visitor's reactions on the article
 * to exactly `reactions` and answers with the new ReactionSummary. Protected
 * like a post: honeypot, fill time and ALTCHA.
 */
export interface ReactionRequest {
  article: string;
  reactions: Reaction[];
  altcha: string;
  website?: string;
}

/** POST /v1/feedback/:id/vote */
export interface VoteResponse {
  voted: boolean;
  votes: number;
}

export interface MePost {
  id: string;
  parent_id: string | null;
  /** The public thread to link to, or null while it is not public. */
  thread_id: string | null;
  kind: Kind;
  /** Set for comments; they live on the article's page, not on the board. */
  article: string | null;
  page_url: string | null;
  body: string;
  status: "pending" | "approved" | "rejected";
  topic_status: TopicStatus | null;
  parent_body: string | null;
  created_at: number;
  replies: number;
  unseen: number;
}

/** GET /v1/me?site= */
export interface MeResponse {
  posts: MePost[];
  unseen: number;
}

export type ErrorCode =
  | ContentError
  | NicknameError
  | "rate_limited"
  | "daily_limit"
  | "too_many_pending"
  | "site_paused"
  | "invalid_kind"
  | "invalid_article"
  | "invalid_reaction"
  | "invalid_json"
  | "payload_too_large"
  | "context_too_large"
  | "altcha_missing"
  | "altcha_invalid"
  | "altcha_expired"
  | "altcha_too_fast"
  | "altcha_replayed"
  | "origin_not_allowed"
  | "site_not_found"
  | "feedback_not_found"
  | "post_not_found"
  | "not_your_post"
  | "token_required"
  | "not_found"
  | "forbidden"
  | "internal_error";

export interface ErrorResponse {
  error: ErrorCode | (string & {});
  message: string;
}

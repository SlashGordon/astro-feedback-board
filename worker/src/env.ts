export interface Env {
  DB: D1Database;
  POST_LIMITER: RateLimit;
  VOTE_LIMITER: RateLimit;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  TEAM_NAME: string;
  DEFAULT_MODERATE_FEEDBACK: string;
  DEFAULT_MODERATE_REPLIES: string;
  DEFAULT_MODERATE_COMMENTS: string;
  DEFAULT_AUTO_TRUST_AFTER: string;
  DEFAULT_AUTO_TRUST_DAYS: string;
  ALTCHA_HMAC_KEY: string;
  /** Proof-of-work difficulty. Default 250000; the tests lower it. */
  ALTCHA_MAX_NUMBER?: string;
  /** ntfy topic URL for new posts, for example https://ntfy.sh/my-feedback. Empty: no notifications. */
  NTFY_URL: string;
  /** "true" puts the post text into the notification. Default: title and link only. */
  NTFY_INCLUDE_TEXT?: string;
  /** Optional ntfy access token (secret). */
  NTFY_TOKEN?: string;
  DEV_SKIP_ACCESS?: string;
}

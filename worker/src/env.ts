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
  IP_SALT_SECRET: string;
  DEV_SKIP_ACCESS?: string;
}

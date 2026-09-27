-- origin: one or more allowed origins, separated by spaces
-- (for example "https://fuseplan.app http://localhost:4321").
CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  moderate_feedback TEXT NOT NULL DEFAULT 'all' CHECK (moderate_feedback IN ('all', 'untrusted', 'none')),
  moderate_replies TEXT NOT NULL DEFAULT 'all' CHECK (moderate_replies IN ('all', 'untrusted', 'none')),
  moderate_comments TEXT NOT NULL DEFAULT 'all' CHECK (moderate_comments IN ('all', 'untrusted', 'none')),
  auto_trust_after INTEGER NOT NULL DEFAULT 0,
  auto_trust_days INTEGER NOT NULL DEFAULT 30,
  created_at INTEGER NOT NULL
);

-- site_id '' = all sites (SQLite treats NULLs as distinct in primary keys).
-- expires_at NULL = permanent.
CREATE TABLE trust (
  author_hash TEXT NOT NULL,
  site_id TEXT NOT NULL DEFAULT '',
  expires_at INTEGER,
  source TEXT NOT NULL CHECK (source IN ('manual', 'auto')),
  note TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (author_hash, site_id)
);

-- Board feedback (no parent, no article), comments on an article (article set)
-- and replies to either (parent_id set). kind only matters for board feedback.
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  parent_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'feedback' CHECK (kind IN ('feedback', 'idea', 'bug')),
  article TEXT,
  page_url TEXT,
  body TEXT NOT NULL,
  nickname TEXT,
  author_hash TEXT,
  is_team INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  topic_status TEXT CHECK (topic_status IN ('open', 'planned', 'in_progress', 'done', 'declined')),
  context TEXT,
  created_at INTEGER NOT NULL,
  approved_at INTEGER
);
CREATE INDEX posts_site_status ON posts (site_id, status, parent_id);
CREATE INDEX posts_site_kind ON posts (site_id, kind);
CREATE INDEX posts_site_article ON posts (site_id, article, status);
CREATE INDEX posts_parent ON posts (parent_id);
CREATE INDEX posts_author ON posts (author_hash);
CREATE INDEX posts_status_created ON posts (status, created_at);

CREATE TABLE votes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, voter_hash)
);

-- Reactions on an article, like on dev.to. Each voter (device token or daily
-- IP hash) can set each reaction once.
CREATE TABLE reactions (
  site_id TEXT NOT NULL REFERENCES sites(id),
  article TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'unicorn', 'mindblown', 'clap', 'fire')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (site_id, article, voter_hash, reaction)
);

CREATE TABLE helpful (
  site_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  up INTEGER NOT NULL DEFAULT 0,
  down INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, page_url)
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reason TEXT,
  reporter_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE seen (
  author_hash TEXT NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (author_hash, post_id)
);

-- Solved ALTCHA challenges, kept until they expire to block replays.
CREATE TABLE altcha_used (
  signature TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

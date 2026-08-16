-- Visitor submissions: blog responses and testimonials.
-- Everything arrives as 'pending' and is invisible on the site until David
-- approves it. Email addresses are collected but never published.

CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,                       -- 'comment' | 'testimonial'
  slug        TEXT,                                -- blog post id, comments only
  page_title  TEXT,
  name        TEXT NOT NULL,
  email       TEXT,                                -- private to David
  role        TEXT,                                -- testimonials only
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'approved' | 'rejected'
  flags       TEXT,                                -- automatic notes, e.g. "2 links"
  ip_hash     TEXT,                                -- salted, not reversible to an IP
  user_agent  TEXT,
  created_at  INTEGER NOT NULL,
  moderated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_submissions_queue
  ON submissions (status, created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_published
  ON submissions (kind, slug, status, created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_ip
  ON submissions (ip_hash, created_at);

-- Sign-in attempts, so the moderation passphrase cannot be guessed at speed.
CREATE TABLE IF NOT EXISTS auth_attempts (
  ip_hash TEXT NOT NULL,
  at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts
  ON auth_attempts (ip_hash, at);

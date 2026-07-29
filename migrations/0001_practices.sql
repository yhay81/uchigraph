PRAGMA foreign_keys = ON;

CREATE TABLE practices (
  id TEXT PRIMARY KEY,
  owner_token_hash TEXT NOT NULL,
  creator_session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  task_text TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('japanese', 'english', 'code')),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'hidden')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX practices_creator_created_idx
  ON practices (creator_session_id, created_at);
CREATE INDEX practices_expiry_idx
  ON practices (status, expires_at);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  learner_session_id TEXT NOT NULL,
  learner_code TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  characters INTEGER NOT NULL,
  cpm REAL NOT NULL,
  accuracy REAL NOT NULL,
  error_count INTEGER NOT NULL,
  correction_count INTEGER NOT NULL,
  timeline_json TEXT NOT NULL,
  hotspots_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX attempts_practice_created_idx
  ON attempts (practice_id, created_at DESC);
CREATE INDEX attempts_session_created_idx
  ON attempts (learner_session_id, created_at);

CREATE TABLE reports (
  practice_id TEXT NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  reporter_session_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('personal', 'copyright', 'unsafe')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (practice_id, reporter_session_id)
);

CREATE TABLE product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  practice_id TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX product_events_name_day_idx
  ON product_events (name, occurred_on);
CREATE INDEX product_events_session_created_idx
  ON product_events (session_id, created_at);

-- Observability for the nightly repair sweep.
--
-- A sweep that silently stops running is itself the failure mode the sweep
-- exists to guard against, so every run records itself — including the ones
-- that fail. /stats reports how long ago the last successful one was.

CREATE TABLE IF NOT EXISTS sweep_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  trips_seen  INTEGER,
  error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_sweep_started ON sweep_runs(started_at);

-- 017 — park badge artwork.
--
-- Park badges were text chips. Andy is supplying poster artwork per park, one
-- at a time as he finds them, so the mapping lives in a table rather than in
-- code: adding a park's art is an INSERT plus an R2 put, never a deploy.
--
-- Keyed on intention.name because that is what badges() already groups by; the
-- park set comes from Lily's vault, not an external catalogue, so the names are
-- stable and there are thirteen of them.
--
-- `credit` is not decoration. These are somebody's illustrations, fine for a
-- private six-person family app and NOT clearable for anything public, so the
-- provenance travels with the row rather than living in a session transcript.
CREATE TABLE IF NOT EXISTS park_badge (
  park_name  TEXT PRIMARY KEY,
  r2_key     TEXT NOT NULL,
  credit     TEXT,
  created_at TEXT NOT NULL
);

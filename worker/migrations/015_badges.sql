-- Bespoke badges: the ones the parents invent.
--
-- Amelia's ask, 2026-08-03: "bespoke badges that we make up based on things
-- that they do. Like a Zotz badge or a Modern Civil Rights badge for visiting
-- George Floyd square." States, parks, mileage and tank badges are all
-- DERIVED at read time (the standing rule: badges are derived, not stored) —
-- but a Zotz badge is irreducibly a human award, so it gets a table. This is
-- also the app's first deliberate viewer write: any of the six can award one
-- (Andy's call, 2026-08-03). Nothing else about the auth model changes.

CREATE TABLE IF NOT EXISTS badge (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  emoji       TEXT,              -- one glyph, optional; renders on the shield
  note        TEXT,              -- why it was earned, in the awarder's words
  date        TEXT,              -- the day it's about (optional)
  awarded_by  TEXT NOT NULL REFERENCES person(id),
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_badge_created ON badge(created_at);

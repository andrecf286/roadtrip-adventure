-- Roadtrip Adventure — application schema
--
-- THE DAY IS THE SPINE.
--
-- The trip is a sequence of days. Track segments, stops, photos, and journal
-- entries all attach to a day. The itinerary is an OVERLAY on that timeline,
-- not the structure beneath it.
--
-- Why not organize by destination, which is the obvious instinct? Because the
-- itinerary is aspirational. Destinations get skipped, split across
-- non-consecutive days, merged, renamed, or invented on the spot with no plan
-- entry behind them — the diner, the breakdown, the person met at a campground.
-- A destination-shaped spine can't hold those and forces a decision every time
-- reality departs from the plan. A day can't be revised: 2026-08-02 happened,
-- it happened once, and what occurred within it belongs to it permanently.
--
-- This also makes the aspirational semantics free. An intention with no days
-- attached is simply unvisited. There is no variance state, no error, no flag.
--
-- TIMEZONE DISCIPLINE: they cross three time zones. Every instant is stored as
-- UTC in a `*_at` column, alongside the local UTC offset that applied. Day
-- assignment always uses LOCAL date — a photo taken at 11pm MDT belongs to that
-- day, not to the UTC day that had already started in Greenwich.

-- ---------------------------------------------------------------- people

CREATE TABLE IF NOT EXISTS person (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('author','viewer')),
  email      TEXT,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------- the spine

CREATE TABLE IF NOT EXISTS day (
  date       TEXT PRIMARY KEY,          -- local calendar date, YYYY-MM-DD
  day_number INTEGER,                   -- 1 = departure day
  time_zone  TEXT,                      -- offset in effect, e.g. '-0500'
  title      TEXT,                      -- optional, theirs to write
  summary    TEXT,
  created_at TEXT NOT NULL
);

-- ------------------------------------------------------- itinerary overlay

-- A place they meant to go. Ordered, deliberately NOT dated in any way that
-- drives behaviour: planned_* columns preserve Lily's original plan as part of
-- the record, but nothing reads them as authority.
CREATE TABLE IF NOT EXISTS intention (
  id                  TEXT PRIMARY KEY,
  seq                 INTEGER NOT NULL,
  name                TEXT NOT NULL,
  kind                TEXT,             -- park | city | campground | trailhead | reference
  lat                 REAL,
  lon                 REAL,
  notes               TEXT,             -- markdown body from the source note
  source_note         TEXT,             -- originating Obsidian filename
  planned_arrival     TEXT,             -- informational only
  planned_departure   TEXT,             -- informational only
  planned_nights      INTEGER,
  drive_time_from_prev TEXT,
  dropped             INTEGER NOT NULL DEFAULT 0,  -- explicitly abandoned, vs merely not yet reached
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_intention_seq ON intention(seq);

-- Which days actually touched which intention. Absence of a row is the whole
-- representation of "didn't happen" — no status column required.
CREATE TABLE IF NOT EXISTS day_intention (
  date         TEXT NOT NULL,
  intention_id TEXT NOT NULL,
  PRIMARY KEY (date, intention_id)
);

-- Things they wanted to do at a place. Sourced from Lily's own lists — Zion
-- alone names about twenty. Checking these off IS the attractions badge system;
-- no external attraction dataset is needed or wanted.
CREATE TABLE IF NOT EXISTS activity (
  id           TEXT PRIMARY KEY,
  intention_id TEXT NOT NULL,
  name         TEXT NOT NULL,
  detail       TEXT,
  distance_mi  REAL,
  duration     TEXT,
  url          TEXT,
  done         INTEGER NOT NULL DEFAULT 0,
  done_date    TEXT,
  done_note    TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_intention ON activity(intention_id);
CREATE INDEX IF NOT EXISTS idx_activity_done ON activity(done);

-- The one hard object in a soft structure. Real dates, real money, real
-- cancellation deadlines. `cancel_by` exists because Medora's 4pm cutoff was
-- buried in a note nobody was watching.
CREATE TABLE IF NOT EXISTS reservation (
  id           TEXT PRIMARY KEY,
  intention_id TEXT,
  name         TEXT NOT NULL,
  provider     TEXT,
  cost         REAL,
  booked       INTEGER NOT NULL DEFAULT 0,
  paid         INTEGER NOT NULL DEFAULT 0,
  confirmation TEXT,
  site         TEXT,
  check_in_at  TEXT,
  check_out_at TEXT,
  cancel_by    TEXT,
  url          TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reservation_cancel ON reservation(cancel_by);
CREATE INDEX IF NOT EXISTS idx_reservation_checkin ON reservation(check_in_at);

-- ------------------------------------------------------------ what happened

-- The single live write. One tap, six types, under five seconds at a gas pump.
-- Feeds three features at once: fuel records, the day's structure, and badges.
CREATE TABLE IF NOT EXISTS stop (
  id             TEXT PRIMARY KEY,
  date           TEXT NOT NULL,
  occurred_at    TEXT NOT NULL,
  tz_offset      TEXT,
  kind           TEXT NOT NULL CHECK (kind IN
                   ('gas','food','campsite','lodging','event','observation')),
  lat            REAL,
  lon            REAL,
  place          TEXT,
  note           TEXT,
  cost           REAL,
  gallons        REAL,       -- gas stops
  odometer       REAL,
  author_id      TEXT,
  intention_id   TEXT,
  reservation_id TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stop_date ON stop(date);
CREATE INDEX IF NOT EXISTS idx_stop_kind ON stop(kind);
CREATE INDEX IF NOT EXISTS idx_stop_at   ON stop(occurred_at);

CREATE TABLE IF NOT EXISTS photo (
  id          TEXT PRIMARY KEY,
  date        TEXT,
  taken_at    TEXT,
  tz_offset   TEXT,
  lat         REAL,
  lon         REAL,
  r2_key      TEXT NOT NULL,
  thumb_key   TEXT,
  width       INTEGER,
  height      INTEGER,
  mime        TEXT,
  sha256      TEXT UNIQUE,   -- idempotency: the uploader will retry
  caption     TEXT,
  author_id   TEXT,
  stop_id     TEXT,
  favorite    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photo_date ON photo(date);
CREATE INDEX IF NOT EXISTS idx_photo_taken ON photo(taken_at);

-- `shared` is the mechanism Andy asked for: sharing is explicit per entry, and
-- the DEFAULT is currently permissive so nothing is blocked while Lily and Ada
-- are asked. If they want the journal private, that is a default change here,
-- not a migration.
CREATE TABLE IF NOT EXISTS journal_entry (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL,
  written_at  TEXT NOT NULL,
  tz_offset   TEXT,
  author_id   TEXT,
  body        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app','imessage','import')),
  source_ref  TEXT UNIQUE,   -- iMessage guid, so ingestion is idempotent
  shared      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entry(date);

-- ------------------------------------------------------------------- views

-- Badges are derived, never stored. A badge that computes itself is one nobody
-- has to maintain — and one that fills in while they drive, without either of
-- them tapping anything.

CREATE VIEW IF NOT EXISTS v_trip_mileage AS
SELECT
  COUNT(*)                    AS segments,
  ROUND(SUM(distance), 1)     AS miles,
  ROUND(SUM(fuel_consumed), 2) AS gallons,
  MIN(start_time)             AS first_movement,
  MAX(end_time)               AS last_movement
FROM trips
-- The Bouncie device moved from Lily's car into Ada's on the morning of
-- 2026-08-02; earlier rows carry odometer ~166k and are a different vehicle.
WHERE start_time >= '2026-08-02T15:00:00';

CREATE VIEW IF NOT EXISTS v_day_summary AS
SELECT
  d.date,
  d.day_number,
  d.title,
  (SELECT ROUND(SUM(t.distance),1) FROM trips t
     WHERE substr(t.start_time,1,10) = d.date)              AS miles,
  (SELECT COUNT(*) FROM stop s          WHERE s.date = d.date) AS stops,
  (SELECT COUNT(*) FROM photo p         WHERE p.date = d.date) AS photos,
  (SELECT COUNT(*) FROM journal_entry j WHERE j.date = d.date) AS journal_entries,
  (SELECT GROUP_CONCAT(i.name, ', ') FROM day_intention di
     JOIN intention i ON i.id = di.intention_id
    WHERE di.date = d.date)                                 AS places
FROM day d
ORDER BY d.date;

CREATE VIEW IF NOT EXISTS v_activity_progress AS
SELECT
  i.name                                   AS place,
  COUNT(a.id)                              AS wanted,
  SUM(CASE WHEN a.done THEN 1 ELSE 0 END)  AS did
FROM intention i
LEFT JOIN activity a ON a.intention_id = i.id
GROUP BY i.id
HAVING wanted > 0
ORDER BY i.seq;

-- Reservations needing attention: a cancellation window still open, or a
-- check-in coming up. This is the query that would have caught Medora.
CREATE VIEW IF NOT EXISTS v_reservation_watch AS
SELECT name, cost, booked, paid, confirmation, check_in_at, cancel_by
FROM reservation
WHERE cancel_by IS NOT NULL OR check_in_at IS NOT NULL
ORDER BY COALESCE(cancel_by, check_in_at);

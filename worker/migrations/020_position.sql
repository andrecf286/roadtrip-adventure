-- 020 — a place for positions that are not the car.
--
-- WHY THIS IS NOT track_points.
--
-- track_points is Bouncie's timestamped breadcrumbs. They are push-only and
-- forward-only — there is no replay endpoint, and a moment not captured is
-- gone. Everything load-bearing derives from them: nights slept, miles today,
-- the map line, whether the car is moving. They mean ONE thing, precisely:
-- where the Golf was.
--
-- What arrives here means something else. A phone is a person, who can be a
-- mile up a trail while the car sits at the lot. An inReach is whatever pocket
-- it is in. Mixing those into track_points would quietly corrupt the derived
-- nights (an eight-hour parked gap is how a night is inferred) and the mileage,
-- and it would do it in a way that reads as more data rather than worse data.
--
-- So: a second table, every row naming its own source, and Today preferring
-- Bouncie whenever Bouncie is fresh. A fallback that announces itself.
--
-- 2026-08-08: written the morning after the car went silent for fifteen hours
-- on the road into Yellowstone's east entrance, while the app told four parents
-- their daughters were "Parked" outside Cody.

CREATE TABLE IF NOT EXISTS position (
  id           TEXT PRIMARY KEY,      -- source:subject:recorded_at, deterministic
  source       TEXT NOT NULL,         -- 'inreach' | 'companion' | 'manual' | 'findmy'
  subject      TEXT NOT NULL,         -- who or what: person id, device name
  lat          REAL NOT NULL,
  lon          REAL NOT NULL,
  accuracy_m   REAL,                  -- null when the source does not say
  speed_mph    REAL,
  course_deg   REAL,
  elevation_m  REAL,
  battery      INTEGER,               -- inReach and the companion both report it
  recorded_at  TEXT NOT NULL,         -- when the FIX was taken, per the device
  received_at  TEXT NOT NULL,         -- when this row was written
  note         TEXT
);

-- The companion buffers a whole track through a dead zone and flushes it when
-- a pipe appears, so the same fix WILL arrive more than once — a retry, an
-- overlapping window, a re-flush after a crash. The primary key is derived
-- from (source, subject, recorded_at) by the caller and INSERT OR IGNORE makes
-- a replay a no-op. Idempotence is the property that lets the client be dumb
-- about retrying, which is the only way it can be reliable offline.

-- Every read is "newest fix, optionally by source". One index, both shapes.
CREATE INDEX IF NOT EXISTS idx_position_recorded  ON position (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_position_src_time  ON position (source, recorded_at DESC);

-- Single source of truth for "when did the trip actually start".
--
-- 002 hard-coded the device-move timestamp into v_trip_mileage but not into
-- v_day_summary, so the two views disagreed: day 1 reported 447.6 miles while
-- the trip total reported 440.9. The 6.7-mile gap was pre-departure errands in
-- Lily's car, before the Bouncie was moved into Ada's.
--
-- A constant repeated in two places is a constant that will drift. It lives in
-- a table now, and every view joins to it.

CREATE TABLE IF NOT EXISTS trip_meta (
  id             INTEGER PRIMARY KEY CHECK (id = 1),   -- exactly one row
  name           TEXT NOT NULL,
  trip_start_at  TEXT NOT NULL,   -- UTC; earlier track data is not this trip
  departure_date TEXT NOT NULL,   -- local date of day 1
  home_lat       REAL,
  home_lon       REAL,
  notes          TEXT
);

INSERT INTO trip_meta (id, name, trip_start_at, departure_date, home_lat, home_lon, notes)
VALUES (
  1,
  'Lily & Ada — Cross Country 2026',
  '2026-08-02T15:04:31Z',
  '2026-08-02',
  41.35192, -81.10387,
  'trip_start_at is the first westbound segment out of the driveway. The Bouncie '
  || 'was moved from Lily''s car (odometer ~166k) into Ada''s 2017 Golf Alltrack that '
  || 'morning; everything before this timestamp is a different vehicle and/or '
  || 'pre-departure errands, and is retained but excluded from trip totals.'
)
-- DO NOTHING, not DO UPDATE. This migration's literal trip_start_at is the
-- WRONG one — 004 corrects it. If this re-ran with DO UPDATE it would silently
-- restore the broken boundary and lose 232 miles again, with both mileage views
-- still agreeing with each other. Re-running the sequence must be inert here.
ON CONFLICT(id) DO NOTHING;

DROP VIEW IF EXISTS v_trip_mileage;
CREATE VIEW v_trip_mileage AS
SELECT
  COUNT(*)                     AS segments,
  ROUND(SUM(t.distance), 1)    AS miles,
  ROUND(SUM(t.fuel_consumed),2) AS gallons,
  MIN(t.start_time)            AS first_movement,
  MAX(t.end_time)              AS last_movement
FROM trips t, trip_meta m
WHERE t.start_time >= m.trip_start_at;

DROP VIEW IF EXISTS v_day_summary;
CREATE VIEW v_day_summary AS
SELECT
  d.date,
  d.day_number,
  d.title,
  (SELECT ROUND(SUM(t.distance),1) FROM trips t, trip_meta m
     WHERE substr(t.start_time,1,10) = d.date
       AND t.start_time >= m.trip_start_at)                  AS miles,
  (SELECT COUNT(*) FROM stop s          WHERE s.date = d.date) AS stops,
  (SELECT COUNT(*) FROM photo p         WHERE p.date = d.date) AS photos,
  (SELECT COUNT(*) FROM journal_entry j WHERE j.date = d.date) AS journal_entries,
  (SELECT GROUP_CONCAT(i.name, ', ') FROM day_intention di
     JOIN intention i ON i.id = di.intention_id
    WHERE di.date = d.date)                                  AS places
FROM day d
ORDER BY d.date;

-- Days that have happened but carry no record of any kind. The gentlest
-- possible nudge surface — and a way to see, later, which days went unwritten.
CREATE VIEW IF NOT EXISTS v_quiet_days AS
SELECT d.date, d.day_number
FROM day d, trip_meta m
WHERE d.date >= m.departure_date
  AND d.date <= date('now')
  AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.date = d.date)
  AND NOT EXISTS (SELECT 1 FROM stop s          WHERE s.date = d.date)
  AND NOT EXISTS (SELECT 1 FROM photo p         WHERE p.date = d.date)
ORDER BY d.date;

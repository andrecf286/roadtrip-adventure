-- Fix v_day_summary to bucket miles by LOCAL date.
--
-- 002 and the README both state the rule plainly: "day assignment always uses
-- the LOCAL date — an 11pm photo belongs to that evening, not to the UTC day
-- already underway in Greenwich." Then 003's rewrite of v_day_summary did
-- `substr(t.start_time,1,10)`, which is raw UTC.
--
-- Writing the discipline into a comment and violating it four sections later is
-- the easiest mistake in this schema to make and the hardest to notice, because
-- the numbers stay plausible. Concretely: they are heading west and will spend
-- the trip between UTC-4 and UTC-7. Any drive that starts after 5pm local ends
-- up credited to the following day. Day 1 already contains a segment beginning
-- 23:16Z, which is 6:16pm CDT on Aug 2 — under the old view that mileage lands
-- on Aug 3.
--
-- Bouncie returns time_zone as a UTC offset string ('-0500'), not an IANA name,
-- so the shift is computed from that. NULL falls back to UTC rather than
-- dropping the row.

DROP VIEW IF EXISTS v_day_summary;
CREATE VIEW v_day_summary AS
SELECT
  d.date,
  d.day_number,
  d.title,
  (SELECT ROUND(SUM(t.distance),1)
     FROM trips t, trip_meta m
    WHERE t.start_time >= m.trip_start_at
      AND CASE
            WHEN t.time_zone IS NULL OR length(t.time_zone) < 3
              THEN substr(t.start_time,1,10)
            ELSE substr(datetime(t.start_time,
                   (CASE WHEN substr(t.time_zone,1,1)='-' THEN '-' ELSE '+' END)
                   || CAST(CAST(substr(t.time_zone,2,2) AS INTEGER) AS TEXT)
                   || ' hours'), 1, 10)
          END = d.date)                                        AS miles,
  (SELECT COUNT(*) FROM stop s          WHERE s.date = d.date) AS stops,
  (SELECT COUNT(*) FROM photo p         WHERE p.date = d.date) AS photos,
  (SELECT COUNT(*) FROM journal_entry j WHERE j.date = d.date) AS journal_entries,
  (SELECT GROUP_CONCAT(i.name, ', ') FROM day_intention di
     JOIN intention i ON i.id = di.intention_id
    WHERE di.date = d.date)                                    AS places
FROM day d
ORDER BY d.date;

-- Same local-date rule, exposed for the app so no caller has to re-derive it.
CREATE VIEW IF NOT EXISTS v_segment_local AS
SELECT
  t.transaction_id,
  t.start_time,
  t.end_time,
  t.distance,
  t.time_zone,
  CASE
    WHEN t.time_zone IS NULL OR length(t.time_zone) < 3
      THEN substr(t.start_time,1,10)
    ELSE substr(datetime(t.start_time,
           (CASE WHEN substr(t.time_zone,1,1)='-' THEN '-' ELSE '+' END)
           || CAST(CAST(substr(t.time_zone,2,2) AS INTEGER) AS TEXT)
           || ' hours'), 1, 10)
  END AS local_date
FROM trips t, trip_meta m
WHERE t.start_time >= m.trip_start_at;

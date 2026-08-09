-- 021 — Tonight can be a plan, not only a booking.
--
-- v_tonight ended with `WHERE r.booked = 1`. Every unbooked row — which is to
-- say every *planned* stay — was filtered out before the view ever compared a
-- date, so Tonight could only ever name something with a receipt.
--
-- On 2026-08-09 that showed the four parents "Next stay · Aug 30 — Manresa
-- State Beach", in Big Sur, three weeks away, while the girls' actual plan for
-- that night was Slough Creek Campground in Yellowstone. Slough Creek is
-- booked = 0, so it did not exist to this view; Manresa was simply the next row
-- in the future that had been paid for.
--
-- The filter was reasonable when the itinerary was mostly reservations and
-- wrong the moment it wasn't: of the fourteen stays between 08-08 and 08-13,
-- exactly one is booked. On a trip planned by two teenagers, the unbooked rows
-- ARE the itinerary.
--
-- So the view now carries plans as well as bookings and exposes `booked` (it
-- always did, via r.*, but nothing downstream read it). Which one to show is a
-- ranking decision, and ranking belongs in the query that ranks — not in a
-- WHERE clause that deletes the alternatives. The app's own rule already says
-- it: the itinerary is aspirational, a recorded campsite is a fact, and the
-- fact wins when there is one. A plan still beats a booking three weeks away.

DROP VIEW IF EXISTS v_tonight;

CREATE VIEW v_tonight AS
WITH shift AS (
  SELECT COALESCE(
    (SELECT (CASE WHEN substr(t.time_zone,1,1)='-' THEN '-' ELSE '+' END)
            || CAST(CAST(substr(t.time_zone,2,2) AS INTEGER) AS TEXT) || ' hours'
       FROM trips t
      WHERE t.time_zone IS NOT NULL AND length(t.time_zone) >= 3
      ORDER BY t.start_time DESC LIMIT 1),
    '-5 hours') AS s
),
today AS (SELECT date(datetime('now', (SELECT s FROM shift))) AS d)
SELECT
  r.*,
  i.name AS place_name,
  CASE
    WHEN (SELECT d FROM today) >= r.check_in_date
     AND (SELECT d FROM today) <  COALESCE(r.check_out_date, r.check_in_date) THEN 'tonight'
    WHEN r.check_in_date = (SELECT d FROM today)                              THEN 'tonight'
    WHEN r.check_in_date >  (SELECT d FROM today)                             THEN 'upcoming'
    ELSE 'past'
  END AS whenish
FROM reservation r
LEFT JOIN intention i ON i.id = r.intention_id
WHERE r.check_in_date IS NOT NULL
ORDER BY r.check_in_date;

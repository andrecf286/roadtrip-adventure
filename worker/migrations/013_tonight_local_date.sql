-- v_tonight must ask "what date is it FOR THE CAR", not for Greenwich.
--
-- Third instance of the UTC-date class (see 005's header, which predicted it):
-- date('now') rolls to tomorrow at 5pm PDT / 7pm CDT / 8pm EDT, at which point
-- tonight's reservation (check_out = tomorrow) stops satisfying
--   today >= check_in AND today < check_out
-- and classifies as 'past', so the Today card skips ahead a night. Observed
-- live 2026-08-03 ~8pm CDT: card showed Eggerts Landing ND instead of
-- Schroeder County Park MN.
--
-- "Local" is the vehicle's current timezone: the most recent trip's Bouncie
-- time_zone offset ('-0500' style), same source and same parsing as
-- v_day_summary in 005. Falls back to -5 (central, most of the route's early
-- days) when no trip carries one. The offset moves with them as they drive
-- west; a view can carry that, a literal cannot.

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
WHERE r.booked = 1 AND r.check_in_date IS NOT NULL
ORDER BY r.check_in_date;

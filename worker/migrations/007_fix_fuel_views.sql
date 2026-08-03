-- Repair the fuel views shipped broken in 006.
--
-- 006 put `LAG(occurred_at) OVER (...)` inside a correlated subquery's WHERE
-- clause. SQLite rejects that — "misuse of window function LAG()" — but only at
-- SELECT time. CREATE VIEW does not validate the body, so 006 applied cleanly,
-- reported success, and left a view that threw on every read.
--
-- The lesson generalises past this file: a migration that only creates views is
-- NOT verified by the migration succeeding. It is verified by selecting from
-- every view it defines. Anything less confirms the syntax of CREATE, not of
-- the query.
--
-- Fix: compute the window function in a CTE, then correlate against its output.

DROP VIEW IF EXISTS v_mpg_last_tank;
DROP VIEW IF EXISTS v_fuel_stops;

CREATE VIEW v_fuel_stops AS
WITH fills AS (
  SELECT
    id, date, occurred_at, gallons, cost, odometer,
    LAG(occurred_at) OVER (ORDER BY occurred_at) AS prev_fill_at
  FROM stop
  WHERE kind = 'gas'
)
SELECT
  f.id,
  f.date,
  f.occurred_at,
  f.gallons,
  f.cost,
  f.odometer,
  f.prev_fill_at,
  (SELECT ROUND(SUM(t.distance), 1)
     FROM trips t
    WHERE t.start_time >  COALESCE(f.prev_fill_at, '0000')
      AND t.start_time <= f.occurred_at) AS miles_since_prev_fill
FROM fills f;

CREATE VIEW v_mpg_last_tank AS
SELECT
  id                                        AS fill_id,
  date,
  gallons,
  miles_since_prev_fill                     AS miles,
  ROUND(miles_since_prev_fill / gallons, 1) AS mpg,
  'tank-to-tank'                            AS method
FROM v_fuel_stops
WHERE gallons IS NOT NULL
  AND gallons > 0
  AND prev_fill_at IS NOT NULL
  AND miles_since_prev_fill IS NOT NULL
ORDER BY occurred_at DESC
LIMIT 1;

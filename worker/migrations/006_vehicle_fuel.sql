-- Tank capacity, so MPG has a denominator.
--
-- Bouncie reports `fuel_consumed` as 0 on every trip for this vehicle, so its
-- own fuel figure cannot be used. MPG is derived two ways instead:
--
--   1. TANK-TO-TANK (preferred, accurate): gallons entered at a fill-up
--      divided into the miles since the previous fill. Needs `stop.gallons`.
--   2. FUEL-LEVEL FALLBACK (automatic, noisier): the percentage drop in
--      `track_points.fuel_level` multiplied by tank capacity. Free, but fuel
--      senders are non-linear and slosh on hills, so treat it as an estimate
--      and label it as one in the UI.
--
-- Method 2 is the ONLY reason this constant exists, and a wrong value corrupts
-- every estimate silently — the numbers stay plausible, which is the dangerous
-- kind of wrong. Provenance is therefore recorded explicitly: 13.2 US gallons
-- is the manufacturer specification for the 2017 VW Golf Alltrack, confirmed by
-- Andy 2026-08-03. It has NOT been verified against the vehicle itself, and no
-- practical way to do so exists mid-trip. If MPG estimates read consistently
-- high or low once real fills accumulate, suspect this number first.

ALTER TABLE trip_meta ADD COLUMN tank_gallons REAL;
ALTER TABLE trip_meta ADD COLUMN fuel_source_note TEXT;

UPDATE trip_meta
SET tank_gallons = 13.2,
    fuel_source_note =
      '13.2 US gal — manufacturer spec for the 2017 VW Golf Alltrack, confirmed '
      || 'by Andy 2026-08-03. Not measured against the vehicle. Used ONLY for the '
      || 'fuel-level fallback; tank-to-tank from stop.gallons is preferred and '
      || 'needs no capacity at all.'
WHERE id = 1;

-- Fills, in order, with the miles covered since the previous one. This is the
-- honest MPG source: no capacity constant, no sender curve, just gallons in
-- against distance travelled.
CREATE VIEW IF NOT EXISTS v_fuel_stops AS
SELECT
  s.id,
  s.date,
  s.occurred_at,
  s.gallons,
  s.cost,
  s.odometer,
  LAG(s.occurred_at) OVER (ORDER BY s.occurred_at) AS prev_fill_at,
  (SELECT ROUND(SUM(t.distance), 1)
     FROM trips t
    WHERE t.start_time > COALESCE(LAG(s.occurred_at) OVER (ORDER BY s.occurred_at), '0000')
      AND t.start_time <= s.occurred_at)            AS miles_since_prev_fill
FROM stop s
WHERE s.kind = 'gas'
ORDER BY s.occurred_at;

-- Most recent complete tank. NULL until two fills with gallons exist, which is
-- correct — better no number than a fabricated one.
CREATE VIEW IF NOT EXISTS v_mpg_last_tank AS
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

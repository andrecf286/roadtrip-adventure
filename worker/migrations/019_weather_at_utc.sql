-- 019 — weather_at speaks the same clock as occurred_at.
--
-- 018 added weather_at and called it "ISO instant of the observation". It was
-- not an instant. Open-Meteo is asked with timezone=auto, which is right for
-- everything a person reads, and it answers with a naive local wall clock —
-- "2026-08-06T08:00", no zone, no offset. That string went into the column
-- beside occurred_at, which is UTC, and the two columns have been describing
-- the same moment in different languages ever since.
--
-- Nothing has read them together yet, so nothing has been wrong on a screen.
-- The viewbook is what reads them together: "the reading was taken thirteen
-- minutes before they pulled in" is a subtraction, and a subtraction across
-- two clocks is a number that looks fine and is off by hours. Two clocks in
-- one table must speak one zone, and the zone is the one occurred_at already
-- speaks.
--
-- Five rows exist. Each carries the tz_offset of the stop it belongs to, so
-- each converts exactly — no guessing, no lost precision, and the result can
-- be checked: after conversion every weather_at lands 13 to 22 minutes BEFORE
-- its own occurred_at, which is the gap 018 was written to preserve (the
-- provider serves the most recent quarter-hourly observation, so the reading
-- is always slightly older than the tap). A conversion in the wrong direction
-- would put the reading hours in the future; the sign is self-checking.
--
-- Idempotent by construction rather than by discipline: the guard is on the
-- value's own shape, so a re-run converts nothing. A migration that can be
-- run twice safely is one that can be recovered from.
--
-- Going forward the app converts at write time — see attachToStop in
-- app/src/weather.js, which puts localToInstant() between the provider's
-- answer and this column.

UPDATE stop
   SET weather_at = strftime(
         '%Y-%m-%dT%H:%M:%S.000Z',
         datetime(
           weather_at,
           (CASE WHEN substr(tz_offset, 1, 1) = '-' THEN '+' ELSE '-' END)
             || CAST(substr(tz_offset, 2, 2) AS INTEGER) || ' hours',
           (CASE WHEN substr(tz_offset, 1, 1) = '-' THEN '+' ELSE '-' END)
             || CAST(substr(tz_offset, 4, 2) AS INTEGER) || ' minutes'))
 WHERE weather_at IS NOT NULL
   AND weather_at NOT LIKE '%Z'
   AND tz_offset IS NOT NULL;

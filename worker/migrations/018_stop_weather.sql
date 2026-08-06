-- 018 — the weather a stop happened in.
--
-- Andy asked for "current weather conditions displayed for wherever the vehicle
-- stops." There are two readings hiding in that sentence and they are different
-- products: what it is like where they are RIGHT NOW (a live number, no
-- durability, and the thing the three people at home want most), and what it
-- was like at the moment they pulled in (a fact that belongs to the stop
-- forever, and the thing the viewbook will want).
--
-- These columns are the second one, and they are the half that has to exist
-- NOW, because it is the half that cannot be recovered later. It is the same
-- asymmetry that made worker/ get built before the app: Open-Meteo's forecast
-- endpoint — current conditions, no key — is free, and its historical archive
-- sits behind their paid tier. A reading taken at the instant of the stop is
-- exact and costs nothing. A reading reconstructed in October is an
-- approximation somebody has to buy.
--
-- Nullable throughout, and deliberately so. A stop can land with lat/lon NULL
-- (GPS denied and no breadcrumb inside thirty minutes — it has happened), the
-- weather fetch runs in waitUntil() so it can lose a race with a dying
-- connection, and Open-Meteo can simply be down. A stop with no weather is a
-- stop, not an error; every consumer treats these as absent-by-default.
--
-- weather_at is NOT redundant with occurred_at. Open-Meteo returns readings on
-- a fifteen-minute interval and reports the instant it actually served, so the
-- gap between the tap and the observation is recorded rather than implied.
ALTER TABLE stop ADD COLUMN weather_code INTEGER;  -- WMO code: 0 clear, 61 rain, 95 thunder…
ALTER TABLE stop ADD COLUMN temp_f       REAL;
ALTER TABLE stop ADD COLUMN feels_f      REAL;     -- apparent temperature
ALTER TABLE stop ADD COLUMN wind_mph     REAL;
ALTER TABLE stop ADD COLUMN humidity     INTEGER;  -- relative, %
ALTER TABLE stop ADD COLUMN weather_at   TEXT;     -- ISO instant of the observation

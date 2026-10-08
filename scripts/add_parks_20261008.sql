-- Arches added, Canyonlands corrected. 2026-10-08, Andy supplied both posters.
--
-- ARCHES was never in Lily's vault itinerary, so like Sequoia, Kings Canyon and
-- Joshua Tree (scripts/add_parks_20260909.sql) it needs an intention row before
-- a park_badge row can mean anything — badges() drives the park list from
-- intention WHERE kind = 'park'. Sequenced at the END (38), source_note NULL.
-- Coordinate is the visitor centre, 38.6165,-109.6197: canonical, and the
-- 2026-09-26T18:57Z vehicle stop sits 0.06 mi from it, which is when they
-- actually walked in.
--
--   Its first-visit date will read 2026-09-25, not 26. They spent the night
--   before camped north of the park, 24.8 mi from the visitor centre — inside
--   VISIT_MI (25). Every point in Arches is closer to that camp than the
--   visitor centre is, so no honest coordinate avoids it. Moab is the one base
--   on this trip where 25 miles is too coarse: two parks and the town all sit
--   inside it. That is a VISIT_MI question, not a data one, and is left alone.
--
-- CANYONLANDS already had a poster (the mountain lion, 2026-08-06) and still
-- read as never visited, which is why it looked missing. Its intention
-- coordinate, 38.23326,-109.92066, is a geocode of the park's interior near the
-- Confluence — backcountry no road reaches, and more than 25 mi from every stop
-- the car made. They DID go: 486 breadcrumbs inside the Island in the Sky
-- district on the evening of 2026-09-26 local (01:00-03:00Z on the 27th),
-- reaching -109.8211, the visitor centre's own longitude. Moved to the Island
-- in the Sky visitor centre, 38.4598,-109.8210. Evidence-based, not inferred —
-- contrast the Rosebud collision, which is still deliberately left alone.
-- It now first-visits 2026-09-26, which is correct.
--
-- The new Canyonlands poster goes in under a NEW key. /photo/* is served
-- `private, max-age=31536000, immutable`, so overwriting canyonlands.jpg in
-- place would leave every phone that has already opened the badge wall
-- showing the mountain lion for a year. The old object is untouched; reverting
-- is one UPDATE back to 'parkbadges/canyonlands.jpg'.
--
-- Idempotent. Safe to re-run.

INSERT OR IGNORE INTO intention
  (id, seq, name, kind, lat, lon, dropped, created_at)
VALUES
  ('arches', 38, 'Arches', 'park', 38.6165, -109.6197, 0, '2026-10-08T00:00:00.000Z');

UPDATE intention SET lat = 38.4598, lon = -109.8210
 WHERE id = 'canyonlands' AND lat = 38.23326 AND lon = -109.92066;

INSERT OR IGNORE INTO park_badge (park_name, r2_key, credit, created_at)
VALUES ('Arches', 'parkbadges/arches.jpg', 'Anderson Design Group', '2026-10-08T00:00:00.000Z');

UPDATE park_badge
   SET r2_key = 'parkbadges/canyonlands-overlook.jpg',
       credit = 'Anderson Design Group — overlook with convertible (replaces the 2026-08-06 mountain lion, still at parkbadges/canyonlands.jpg)'
 WHERE park_name = 'Canyonlands';

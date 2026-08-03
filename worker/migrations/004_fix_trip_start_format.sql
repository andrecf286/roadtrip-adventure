-- Fix a silent 232-mile data loss introduced by 003.
--
-- 003 set trip_start_at = '2026-08-02T15:04:31Z', taken from the departure
-- segment's own start time. But Bouncie's REST API returns timestamps WITH
-- milliseconds — '2026-08-02T15:04:31.000Z' — and SQLite compares these as
-- plain strings. Character by character the two agree through '...15:04:31',
-- then compare '.' (0x2E) against 'Z' (0x5A). '.' sorts lower, so
--
--     '2026-08-02T15:04:31.000Z'  <  '2026-08-02T15:04:31Z'
--
-- and the `start_time >= trip_start_at` filter excluded the very segment the
-- boundary was derived from: the 231.8-mile departure run out of Ohio. Trip
-- mileage silently reported 209.1 instead of 440.9, and both views agreed with
-- each other, so the consistency check passed while both were wrong.
--
-- Two lessons baked into the fix: store the boundary in the same format the
-- data uses, and never derive a >= boundary from a value that must itself be
-- included — pick a round instant in the gap instead. The previous errand
-- ended 14:53:49 and the departure began 15:04:31, so 15:00:00 sits cleanly
-- between them and does not depend on exact-match semantics at all.

UPDATE trip_meta
SET trip_start_at = '2026-08-02T15:00:00.000Z'
WHERE id = 1;

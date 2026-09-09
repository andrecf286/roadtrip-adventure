-- Three parks the girls reached that were never in the plan.
--
-- Sequoia, Kings Canyon and Joshua Tree are not in Lily's vault itinerary —
-- the route drifted a long way from it (they crossed into British Columbia on
-- 08-17 and came down the coast). Andy supplied poster artwork for all three
-- on 2026-09-09, which is only half the job: `badges()` drives the park list
-- from `intention`, so a park with artwork and no intention row does not exist
-- to the app at all.
--
-- SEQUENCED AT THE END (35-37), NOT INSERTED MID-PLAN. `seq` records what was
-- PLANNED, and re-numbering the tail to slot these between Yosemite and Zion
-- would rewrite that. They sort into the badge wall by first-visit date
-- regardless, because badges() orders visited parks by date and only falls
-- back to seq for the ones still ahead. `source_note` stays NULL for the same
-- reason — it is how a later reader tells a vault park from an added one.
--
-- COORDINATES ARE CHOSEN TO BE BOTH CANONICAL AND FUNCTIONAL. derivedVisits()
-- marks a visit when a vehicle stop lands within VISIT_MI (25) of these
-- points, so the visit dates below are not typed in — they fall out of the
-- car's own breadcrumbs once these rows exist. Checked against the real track
-- before writing:
--
--   Kings Canyon / Grant Grove   36.7395,-118.9704
--       trip ending 2026-09-04T07:35Z stopped at 36.74058,-118.96867 — 0.1 mi,
--       and stayed until 18:42Z, so they slept there.
--   Sequoia / Giant Forest       36.5658,-118.7735
--       trip ending 2026-09-04T21:08Z stopped at 36.56485,-118.77428 — 0.1 mi,
--       one of six stops they made working south through the park that day.
--   Joshua Tree / west visitor centre  34.0797,-116.3103
--       the entrance they actually used: overnight 2026-09-05T05:08Z→17:52Z at
--       34.07352,-116.38852 (4 mi), then in-park stops at 10 and 11 mi. The
--       Oasis centre at Twentynine Palms is the other candidate and was
--       rejected — it sits 31 mi from that overnight, outside the radius.
--
-- Both Sequoia and Kings Canyon will show 2026-09-04. That is not a bug: the
-- parks adjoin, every stop that day is within 25 mi of both points, and they
-- were in fact in both.
--
-- Idempotent. Safe to re-run.

INSERT OR IGNORE INTO intention
  (id, seq, name, kind, lat, lon, dropped, created_at)
VALUES
  ('kings-canyon', 35, 'Kings Canyon', 'park', 36.7395,  -118.9704, 0, '2026-09-09T15:10:00.000Z'),
  ('sequoia',      36, 'Sequoia',      'park', 36.5658,  -118.7735, 0, '2026-09-09T15:10:00.000Z'),
  ('joshua-tree',  37, 'Joshua Tree',  'park', 34.0797,  -116.3103, 0, '2026-09-09T15:10:00.000Z');

INSERT OR IGNORE INTO park_badge (park_name, r2_key, credit, created_at)
VALUES
  ('Kings Canyon', 'parkbadges/kings-canyon.jpg', 'Anderson Design Group — Legends of the National Parks (Sasquatch)', '2026-09-09T15:10:00.000Z'),
  ('Sequoia',      'parkbadges/sequoia.jpg',      'Anderson Design Group', '2026-09-09T15:10:00.000Z'),
  ('Joshua Tree',  'parkbadges/joshua-tree.jpg',  'Anderson Design Group', '2026-09-09T15:10:00.000Z');

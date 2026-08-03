-- Pin the real odometer against Bouncie's, so the difference is recorded
-- rather than remembered.
--
-- Bouncie reports Ada's Golf at 31,699. The dash reads 99,470 — Andy checked
-- 2026-08-03 while they were parked, and Bouncie would not accept a correction
-- at the time. The difference is 67,771 miles.
--
-- This changes NOTHING we compute. Every distance in this database is a delta
-- or comes from `trips.distance`, both of which are correct regardless of where
-- the baseline started — verified earlier today when the sum of distances
-- (695.7) matched the odometer movement (695.6). The offset exists so that if
-- we ever display "miles on the car", it is the truth, and so a future session
-- does not rediscover this by noticing the number looks wrong.
--
-- BOTH readings are stored, not just the difference, because the offset is only
-- valid while Bouncie keeps counting from its own wrong baseline. If Andy
-- eventually gets the correction to stick, Bouncie's number will jump ~67,771
-- overnight and a stored offset would then double-count. Keeping the paired
-- readings makes that detectable: compare the live Bouncie odometer against
-- `odometer_bouncie_ref`. If it has leapt far beyond plausible driving, the
-- source has been corrected and the offset must be zeroed.

ALTER TABLE trip_meta ADD COLUMN odometer_true_ref    REAL;
ALTER TABLE trip_meta ADD COLUMN odometer_bouncie_ref REAL;
ALTER TABLE trip_meta ADD COLUMN odometer_ref_at      TEXT;
ALTER TABLE trip_meta ADD COLUMN odometer_note        TEXT;

UPDATE trip_meta
SET odometer_true_ref    = 99470,
    odometer_bouncie_ref = 31699,
    odometer_ref_at      = '2026-08-03T19:54:41.000Z',
    odometer_note        =
      'Dash read 99,470 while parked on 2026-08-03; Bouncie reported 31,699 for the '
      || 'same moment. Bouncie refused an odometer correction in the app that day. '
      || 'Offset is derived, never stored on its own — see v_odometer. Affects display '
      || 'only: all distances are deltas and were verified correct (695.7 summed vs '
      || '695.6 by odometer movement).'
WHERE id = 1;

-- Derived, so the offset can never drift from the readings it came from.
-- `suspect_corrected` fires if Bouncie's number has jumped far past anything
-- the car could have driven since the reference — the signal that the upstream
-- baseline was fixed and this whole correction should be retired.
DROP VIEW IF EXISTS v_odometer;
CREATE VIEW v_odometer AS
SELECT
  m.odometer_true_ref,
  m.odometer_bouncie_ref,
  m.odometer_ref_at,
  (m.odometer_true_ref - m.odometer_bouncie_ref)              AS offset_miles,
  b.latest_bouncie                                            AS bouncie_now,
  b.latest_bouncie + (m.odometer_true_ref - m.odometer_bouncie_ref) AS true_now,
  CASE WHEN b.latest_bouncie > m.odometer_bouncie_ref + 20000
       THEN 1 ELSE 0 END                                      AS suspect_corrected
FROM trip_meta m,
     (SELECT MAX(t.end_odometer) AS latest_bouncie
        FROM trips t, trip_meta mm
       WHERE t.start_time >= mm.trip_start_at) b
WHERE m.id = 1;

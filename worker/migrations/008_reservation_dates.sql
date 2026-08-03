-- Give reservations a real date, separate from the clock time Lily wrote.
--
-- The extraction preserved her phrasing faithfully, which is right — but it
-- means `check_in_at` holds two incompatible kinds of value. Some rows say
-- '2pm' (Schroeder, Chain O Lakes), others say '2026-08-04' (Medora, because
-- that note happened to carry a booking URL with dates in it).
--
-- Sorting a column like that gives nonsense: '2026-08-04' sorts before '2pm'
-- because digits precede letters, so "next reservation by check_in_at" showed
-- the Medora booking two days out instead of tonight's campground. On the
-- Today screen that is the single most load-bearing fact on the page, and it
-- was confidently wrong.
--
-- The fix separates the two meanings rather than trying to coerce one column:
--   check_in_date  — a real ISO date, sortable, comparable to `day.date`
--   check_in_time  — whatever she actually wrote, shown to a human verbatim
--
-- Dates are inherited from the intention's planned arrival where the note
-- itself did not carry one. Those planned dates are otherwise inert, and this
-- is the one place they legitimately drive behaviour: a booking belongs to the
-- night the plan put it on, even though the plan is aspirational everywhere
-- else.

ALTER TABLE reservation ADD COLUMN check_in_date  TEXT;
ALTER TABLE reservation ADD COLUMN check_out_date TEXT;
ALTER TABLE reservation ADD COLUMN check_in_time  TEXT;
ALTER TABLE reservation ADD COLUMN check_out_time TEXT;

-- Anything already ISO-shaped is a date; anything else is a clock time.
UPDATE reservation
SET check_in_date = CASE WHEN check_in_at LIKE '____-__-__%' THEN substr(check_in_at,1,10) END,
    check_in_time = CASE WHEN check_in_at LIKE '____-__-__%' THEN NULL ELSE check_in_at END;

UPDATE reservation
SET check_out_date = CASE WHEN check_out_at LIKE '____-__-__%' THEN substr(check_out_at,1,10) END,
    check_out_time = CASE WHEN check_out_at LIKE '____-__-__%' THEN NULL ELSE check_out_at END;

-- Inherit the planned night from the intention where the note had no date.
UPDATE reservation
SET check_in_date = (SELECT i.planned_arrival FROM intention i WHERE i.id = reservation.intention_id)
WHERE check_in_date IS NULL AND intention_id IS NOT NULL;

UPDATE reservation
SET check_out_date = (SELECT i.planned_departure FROM intention i WHERE i.id = reservation.intention_id)
WHERE check_out_date IS NULL AND intention_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_checkin_date ON reservation(check_in_date);

-- Where they are sleeping tonight: the booked reservation whose stay covers
-- today, falling back to the next one starting. Ordered by a real date.
DROP VIEW IF EXISTS v_tonight;
CREATE VIEW v_tonight AS
SELECT
  r.*,
  i.name AS place_name,
  CASE
    WHEN date('now') >= r.check_in_date
     AND date('now') <  COALESCE(r.check_out_date, r.check_in_date) THEN 'tonight'
    WHEN r.check_in_date = date('now')                              THEN 'tonight'
    WHEN r.check_in_date >  date('now')                             THEN 'upcoming'
    ELSE 'past'
  END AS whenish
FROM reservation r
LEFT JOIN intention i ON i.id = r.intention_id
WHERE r.booked = 1 AND r.check_in_date IS NOT NULL
ORDER BY r.check_in_date;

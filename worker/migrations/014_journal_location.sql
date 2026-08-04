-- Journal entries carry where they were written.
--
-- Andy's call 2026-08-03 (Amelia's linking ask behind it): when the girls
-- journal, pull the phone's location, so an entry can later be tied to the
-- place it happened at — not just the day. Nullable by design: permission
-- denied, desktop browsers, and backdated entries all simply have no fix.
-- Visibility is unchanged (kids confirmed parent-visible; the shared flag
-- and its read filter still apply).

ALTER TABLE journal_entry ADD COLUMN lat REAL;
ALTER TABLE journal_entry ADD COLUMN lon REAL;

-- Badges get a thumbnail and their awarder's clock.
--
-- Both come out of the badge book (2026-08-11). Amelia is making a printed
-- keepsake, one page per badge, and the two facts that surfaced are:
--
-- 1. Badge artwork was the ONLY image class in this app with no thumbnail.
--    Photos have had one since the start — `photo.thumb_key`, 420px — and the
--    badge wall paints its tiles at 76px from the full object. That was
--    harmless while the full object was 640px and became a regression the
--    moment print quality required 1600: a phone on campground wifi would
--    have pulled five megabytes to draw sixteen thumbnails. The size bump and
--    this column are one change, not two; the bump alone is a downgrade.
--
-- 2. `created_at` is a UTC instant and the book has to print a DAY. It was
--    rendering every badge in the car's timezone, which is right for Lily and
--    Ada and wrong for the three people awarding badges from Ohio — Amelia at
--    12:30am EDT on the 9th was being credited with an August 8th badge. The
--    awarder's own offset is what the client already sends for a journal entry
--    or a stop; badges just never asked for it. NULL for the sixteen awarded
--    before today, which fall back to the trip's zone as they do now.

ALTER TABLE badge ADD COLUMN thumb_key TEXT;
ALTER TABLE badge ADD COLUMN tz_offset TEXT;

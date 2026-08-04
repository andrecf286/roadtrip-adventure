-- Badge images: Amelia's "cool tags."
--
-- She wants to generate art for the badges she awards ("Can I generate some
-- cool tags and then you can use them to upgrade the badging?" — 2026-08-04,
-- indulged by Andy). The image is optional; it lives in the photos R2 bucket
-- under badges/ and is served through the same session-gated /photo/* path
-- as everything else.

ALTER TABLE badge ADD COLUMN image_key TEXT;

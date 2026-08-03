-- Bounding box per segment, so a zoomed-in map can ask for just the segments
-- it can actually see.
--
-- Without this, serving detail for a viewport means parsing every stored
-- polyline on every request. That is fine at eight segments and untenable at
-- six weeks — by the end this table will hold a few hundred segments and
-- something over a hundred thousand points, and the map would get slower every
-- day of the trip.
ALTER TABLE trips ADD COLUMN min_lat REAL;
ALTER TABLE trips ADD COLUMN max_lat REAL;
ALTER TABLE trips ADD COLUMN min_lon REAL;
ALTER TABLE trips ADD COLUMN max_lon REAL;
CREATE INDEX IF NOT EXISTS idx_trips_bbox ON trips(min_lon, max_lon, min_lat, max_lat);

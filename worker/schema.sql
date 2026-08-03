-- Roadtrip Adventure — ingest schema
-- Raw-first: every webhook body is archived verbatim before any parsing,
-- so a parser bug can never cost us data we can't get back.

CREATE TABLE IF NOT EXISTS webhook_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at    TEXT NOT NULL,
  event_type     TEXT,
  imei           TEXT,
  vin            TEXT,
  transaction_id TEXT,
  payload        TEXT NOT NULL,
  parse_error    TEXT
);
CREATE INDEX IF NOT EXISTS idx_we_received ON webhook_events(received_at);
CREATE INDEX IF NOT EXISTS idx_we_txn      ON webhook_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_we_type     ON webhook_events(event_type);

-- The perishable data. tripData is push-only and forward-only: these
-- timestamped breadcrumbs exist nowhere else and cannot be re-fetched.
CREATE TABLE IF NOT EXISTS track_points (
  transaction_id TEXT NOT NULL,
  imei           TEXT,
  ts             TEXT NOT NULL,
  lat            REAL NOT NULL,
  lon            REAL NOT NULL,
  heading        REAL,
  speed          REAL,
  fuel_level     REAL,
  PRIMARY KEY (transaction_id, ts)
);
CREATE INDEX IF NOT EXISTS idx_tp_ts   ON track_points(ts);
CREATE INDEX IF NOT EXISTS idx_tp_imei ON track_points(imei, ts);

-- Trip envelopes. Populated by tripStart/tripEnd/tripMetrics webhooks going
-- forward, and by the REST backfill for everything before the webhook existed.
CREATE TABLE IF NOT EXISTS trips (
  transaction_id          TEXT PRIMARY KEY,
  imei                    TEXT,
  vin                     TEXT,
  start_time              TEXT,
  end_time                TEXT,
  start_odometer          REAL,
  end_odometer            REAL,
  distance                REAL,
  average_speed           REAL,
  max_speed               REAL,
  fuel_consumed           REAL,
  total_idle_duration     REAL,
  hard_braking_count      INTEGER,
  hard_acceleration_count INTEGER,
  time_zone               TEXT,
  gps                     TEXT,
  gps_format              TEXT,
  source                  TEXT,
  updated_at              TEXT
);
CREATE INDEX IF NOT EXISTS idx_trips_start ON trips(start_time);

-- Vehicle state snapshots (mil, battery, connect/disconnect, vinChange).
-- Low volume, occasionally diagnostic — a dead battery on the road is a story.
CREATE TABLE IF NOT EXISTS vehicle_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT,
  imei       TEXT,
  vin        TEXT,
  occurred_at TEXT,
  detail     TEXT
);
CREATE INDEX IF NOT EXISTS idx_ve_occurred ON vehicle_events(occurred_at);

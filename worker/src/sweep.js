/**
 * The nightly repair sweep.
 *
 * The webhook is the real-time path and it is now correct — but it is still a
 * single parser standing between a drive and the record, and today proved how
 * that fails: eight events landed, updated nothing, returned 200 each time,
 * and nobody found out until Andy looked at a mileage figure and knew it was
 * wrong. Silent success is the failure mode this project keeps hitting.
 *
 * So this exists as the belt to the webhook's braces. Bouncie retains trips
 * indefinitely and the REST endpoint reports distances authoritatively, so a
 * periodic re-pull can repair anything the live path dropped. If the webhook
 * breaks again, the worst case becomes "the numbers are right by morning"
 * rather than "four hours of the trip are missing forever".
 *
 * It writes to `sweep_runs` so the repair is observable — a sweep that stops
 * running is itself a silent failure, and /stats surfaces when it last did.
 */

const TOKEN_URL = "https://auth.bouncie.com/oauth/token";
const TRIPS_URL = "https://api.bouncie.dev/v1/trips";

/**
 * Mint an access token. Bouncie's authorization code does not expire, so the
 * code is stored once and exchanged fresh on each run — no refresh-token
 * rotation to keep alive, which is the failure mode of most scheduled jobs.
 */
async function accessToken(env) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env.BOUNCIE_CLIENT_ID,
      client_secret: env.BOUNCIE_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: env.BOUNCIE_AUTH_CODE,
      redirect_uri: env.BOUNCIE_REDIRECT_URI,
    }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error("token exchange failed: " + JSON.stringify(body).slice(0, 200));
  return body.access_token;
}

/** One window of trips. The API rejects any range wider than seven days. */
async function fetchWindow(token, imei, startIso, endIso) {
  const qs = new URLSearchParams({
    imei,
    "gps-format": "geojson",
    "starts-after": startIso,
    "ends-before": endIso,
  });
  const res = await fetch(TRIPS_URL + "?" + qs, {
    // Bare token. A "Bearer " prefix here is the documented top cause of 401s.
    headers: { Authorization: token, "content-type": "application/json" },
  });
  if (!res.ok) throw new Error("trips " + res.status + " " + (await res.text()).slice(0, 200));
  return res.json();
}

/**
 * Re-pull the last `days` of trips and upsert.
 *
 * COALESCE favours what is already stored, so a webhook-supplied value is
 * never overwritten by the sweep — this repairs gaps, it does not fight the
 * live path. The one exception is `distance`, `end_time` and `end_odometer`,
 * where a NULL locally and a real value upstream is exactly the case we are
 * here to fix.
 */
export async function runSweep(env, days = 4) {
  const started = new Date().toISOString();
  let token, trips = [], repaired = 0, error = null;

  try {
    token = await accessToken(env);
    const now = Date.now();
    let cursor = now - days * 86400000;
    while (cursor < now) {
      const end = Math.min(cursor + 7 * 86400000, now);
      const batch = await fetchWindow(
        token, env.BOUNCIE_IMEI,
        new Date(cursor).toISOString().replace(/\.\d+Z$/, "Z"),
        new Date(end).toISOString().replace(/\.\d+Z$/, "Z")
      );
      if (Array.isArray(batch)) trips = trips.concat(batch);
      cursor = end;
    }

    // Bounding box computed on write. The zoomed-in map filters segments by
    // box so it never parses geometry it cannot see.
    const boxOf = (gps) => {
      try {
        const cs = (typeof gps === "string" ? JSON.parse(gps) : gps).coordinates || [];
        if (!cs.length) return [null, null, null, null];
        let a = 90, b = -90, c = 180, d = -180;
        for (const [lon, lat] of cs) {
          if (lat < a) a = lat; if (lat > b) b = lat;
          if (lon < c) c = lon; if (lon > d) d = lon;
        }
        return [a, b, c, d];
      } catch { return [null, null, null, null]; }
    };

    const stmt = env.roadtrip.prepare(
      `INSERT INTO trips (transaction_id, imei, vin, start_time, end_time,
                          start_odometer, end_odometer, distance, average_speed,
                          max_speed, fuel_consumed, total_idle_duration,
                          hard_braking_count, hard_acceleration_count,
                          time_zone, gps, gps_format, source, updated_at,
                          min_lat, max_lat, min_lon, max_lon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'geojson', 'sweep', ?, ?, ?, ?, ?)
       ON CONFLICT(transaction_id) DO UPDATE SET
         end_time            = COALESCE(trips.end_time, excluded.end_time),
         end_odometer        = COALESCE(trips.end_odometer, excluded.end_odometer),
         distance            = COALESCE(trips.distance, excluded.distance),
         start_odometer      = COALESCE(trips.start_odometer, excluded.start_odometer),
         average_speed       = COALESCE(trips.average_speed, excluded.average_speed),
         max_speed           = COALESCE(trips.max_speed, excluded.max_speed),
         total_idle_duration = COALESCE(trips.total_idle_duration, excluded.total_idle_duration),
         time_zone           = COALESCE(trips.time_zone, excluded.time_zone),
         gps                 = COALESCE(trips.gps, excluded.gps),
         gps_format          = COALESCE(trips.gps_format, excluded.gps_format),
         min_lat             = COALESCE(trips.min_lat, excluded.min_lat),
         max_lat             = COALESCE(trips.max_lat, excluded.max_lat),
         min_lon             = COALESCE(trips.min_lon, excluded.min_lon),
         max_lon             = COALESCE(trips.max_lon, excluded.max_lon),
         updated_at          = excluded.updated_at`
    );

    const now2 = new Date().toISOString();
    const batch = trips.map((t) => {
      const g = t.gps ? (typeof t.gps === "string" ? t.gps : JSON.stringify(t.gps)) : null;
      const [mnLat, mxLat, mnLon, mxLon] = boxOf(g);
      return stmt.bind(
        t.transactionId ?? null, t.imei ?? env.BOUNCIE_IMEI, null,
        t.startTime ?? null, t.endTime ?? null,
        t.startOdometer ?? null, t.endOdometer ?? null,
        t.distance ?? null, t.averageSpeed ?? null, t.maxSpeed ?? null,
        t.fuelConsumed ?? null, t.totalIdleDuration ?? null,
        t.hardBrakingCount ?? null, t.hardAccelerationCount ?? null,
        t.timeZone ?? null,
        g,
        now2,
        mnLat, mxLat, mnLon, mxLon
      );
    });
    if (batch.length) await env.roadtrip.batch(batch);
    repaired = batch.length;
  } catch (err) {
    error = String(err).slice(0, 500);
  }

  await env.roadtrip
    .prepare(
      `INSERT INTO sweep_runs (started_at, finished_at, trips_seen, error)
       VALUES (?, ?, ?, ?)`
    )
    .bind(started, new Date().toISOString(), repaired, error)
    .run()
    .catch(() => {});

  return { started, trips_seen: repaired, error };
}

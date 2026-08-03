/**
 * Roadtrip Adventure — Bouncie ingest Worker
 *
 * Why this exists before the rest of the app: Bouncie's `tripData` event is
 * push-only and forward-only. The REST API will hand back a trip's route
 * polyline forever, but with no per-point timestamps. The timestamped
 * breadcrumbs — position, speed, heading, fuel level, second by second —
 * only ever arrive here, once, in real time. Nothing replays them.
 *
 * So this endpoint's single job is: never drop one.
 *
 * Design consequences of that job:
 *   - The raw body is archived verbatim BEFORE any parsing. A parser bug
 *     costs us a re-parse, not data.
 *   - If the raw insert succeeds we return 200 even when parsing fails,
 *     because Bouncie auto-deactivates webhooks that keep erroring and a
 *     deactivated webhook is silent permanent loss. We have the raw row;
 *     we can always reprocess.
 *   - If the raw insert fails we return 500 so Bouncie retries with backoff.
 */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

/** Bouncie echoes the registered authKey in both of these headers. */
function authorized(request, env) {
  const expected = env.AUTH_KEY;
  if (!expected) return false;
  const a = request.headers.get('authorization') || '';
  const b = request.headers.get('x-bouncie-authorization') || '';
  const strip = (v) => v.replace(/^Bearer\s+/i, '').trim();
  return strip(a) === expected || strip(b) === expected;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/health') {
      return json({ ok: true, service: 'roadtrip-ingest', time: new Date().toISOString() });
    }

    // Completeness monitor. The server, not the phone or the device, is the
    // source of truth on whether data is still flowing — a stall needs to be
    // visible within a day, not discovered at the end of the trip.
    if (path === '/stats') {
      try {
        const [points, trips, events, latest, firstSeen, byDay] = await Promise.all([
          env.roadtrip.prepare('SELECT COUNT(*) AS n FROM track_points').first(),
          env.roadtrip.prepare('SELECT COUNT(*) AS n FROM trips').first(),
          env.roadtrip.prepare('SELECT COUNT(*) AS n FROM webhook_events').first(),
          env.roadtrip.prepare('SELECT MAX(received_at) AS t FROM webhook_events').first(),
          env.roadtrip.prepare('SELECT MIN(ts) AS t FROM track_points').first(),
          env.roadtrip
            .prepare(
              `SELECT substr(ts,1,10) AS day, COUNT(*) AS points
                 FROM track_points GROUP BY day ORDER BY day DESC LIMIT 14`
            )
            .all(),
        ]);

        const last = latest?.t ? new Date(latest.t) : null;
        const minutesSince = last ? Math.round((Date.now() - last.getTime()) / 60000) : null;

        return json({
          ok: true,
          track_points: points?.n ?? 0,
          trips: trips?.n ?? 0,
          webhook_events: events?.n ?? 0,
          first_point_at: firstSeen?.t ?? null,
          last_event_at: latest?.t ?? null,
          minutes_since_last_event: minutesSince,
          points_by_day: byDay?.results ?? [],
        });
      } catch (err) {
        return json({ ok: false, error: String(err) }, 500);
      }
    }

    if (path === '/bouncie') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
      if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);

      const raw = await request.text();
      const receivedAt = new Date().toISOString();

      // Shallow peek for indexing columns. Never let this throw.
      let peek = {};
      try {
        peek = JSON.parse(raw) || {};
      } catch (_) {
        /* archived as-is below; parse_error recorded */
      }

      let rawId;
      try {
        const res = await env.roadtrip
          .prepare(
            `INSERT INTO webhook_events (received_at, event_type, imei, vin, transaction_id, payload)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            receivedAt,
            peek.eventType ?? null,
            peek.imei ?? null,
            peek.vin ?? null,
            peek.transactionId ?? null,
            raw
          )
          .run();
        rawId = res?.meta?.last_row_id;
      } catch (err) {
        // Durable storage failed — ask Bouncie to retry rather than lose it.
        return json({ error: 'storage failure', detail: String(err) }, 500);
      }

      // From here on the data is safe. Parse best-effort and always 200.
      ctx.waitUntil(processEvent(env, peek, rawId));
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  },
};

async function processEvent(env, evt, rawId) {
  const now = new Date().toISOString();
  try {
    const type = evt.eventType;

    if (type === 'tripData' && Array.isArray(evt.data)) {
      const stmt = env.roadtrip.prepare(
        `INSERT OR IGNORE INTO track_points
           (transaction_id, imei, ts, lat, lon, heading, speed, fuel_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const batch = [];
      for (const p of evt.data) {
        const g = p?.gps;
        if (!g || typeof g.lat !== 'number' || typeof g.lon !== 'number') continue;
        if (!p.timestamp) continue;
        batch.push(
          stmt.bind(
            evt.transactionId ?? null,
            evt.imei ?? null,
            p.timestamp,
            g.lat,
            g.lon,
            g.heading ?? null,
            p.speed ?? null,
            p.fuelLevelInput ?? null
          )
        );
      }
      if (batch.length) await env.roadtrip.batch(batch);
      return;
    }

    if (type === 'tripStart' || type === 'tripEnd' || type === 'tripMetrics') {
      const d = evt.data ?? evt;
      await env.roadtrip
        .prepare(
          `INSERT INTO trips (transaction_id, imei, vin, start_time, end_time,
                              start_odometer, end_odometer, distance, average_speed,
                              max_speed, fuel_consumed, total_idle_duration,
                              hard_braking_count, hard_acceleration_count,
                              time_zone, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'webhook', ?)
           ON CONFLICT(transaction_id) DO UPDATE SET
             imei                    = COALESCE(excluded.imei, trips.imei),
             vin                     = COALESCE(excluded.vin, trips.vin),
             start_time              = COALESCE(excluded.start_time, trips.start_time),
             end_time                = COALESCE(excluded.end_time, trips.end_time),
             start_odometer          = COALESCE(excluded.start_odometer, trips.start_odometer),
             end_odometer            = COALESCE(excluded.end_odometer, trips.end_odometer),
             distance                = COALESCE(excluded.distance, trips.distance),
             average_speed           = COALESCE(excluded.average_speed, trips.average_speed),
             max_speed               = COALESCE(excluded.max_speed, trips.max_speed),
             fuel_consumed           = COALESCE(excluded.fuel_consumed, trips.fuel_consumed),
             total_idle_duration     = COALESCE(excluded.total_idle_duration, trips.total_idle_duration),
             hard_braking_count      = COALESCE(excluded.hard_braking_count, trips.hard_braking_count),
             hard_acceleration_count = COALESCE(excluded.hard_acceleration_count, trips.hard_acceleration_count),
             time_zone               = COALESCE(excluded.time_zone, trips.time_zone),
             updated_at              = excluded.updated_at`
        )
        .bind(
          evt.transactionId ?? null,
          evt.imei ?? null,
          evt.vin ?? null,
          type === 'tripStart' ? d.timestamp ?? d.startTime ?? null : d.startTime ?? null,
          type === 'tripEnd' ? d.timestamp ?? d.endTime ?? null : d.endTime ?? null,
          d.startOdometer ?? (type === 'tripStart' ? d.odometer ?? null : null),
          d.endOdometer ?? (type === 'tripEnd' ? d.odometer ?? null : null),
          d.distance ?? null,
          d.averageSpeed ?? null,
          d.maxSpeed ?? null,
          d.fuelConsumed ?? null,
          d.totalIdleDuration ?? null,
          d.hardBrakingCount ?? null,
          d.hardAccelerationCount ?? null,
          d.timeZone ?? d.timezone ?? null,
          now
        )
        .run();
      return;
    }

    if (['mil', 'battery', 'connect', 'disconnect', 'vinChange'].includes(type)) {
      await env.roadtrip
        .prepare(
          `INSERT INTO vehicle_events (event_type, imei, vin, occurred_at, detail)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(type, evt.imei ?? null, evt.vin ?? null, now, JSON.stringify(evt.data ?? evt))
        .run();
    }
  } catch (err) {
    try {
      await env.roadtrip
        .prepare('UPDATE webhook_events SET parse_error = ? WHERE id = ?')
        .bind(String(err), rawId)
        .run();
    } catch (_) {
      /* nothing further to do; the raw row survives regardless */
    }
  }
}

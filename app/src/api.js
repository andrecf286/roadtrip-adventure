/**
 * Read and write handlers.
 *
 * Everything date-shaped goes through the LOCAL date, never UTC. They cross
 * three time zones and an 11pm photo belongs to that evening. `v_day_summary`
 * and `v_segment_local` already encode the rule; nothing here re-derives it.
 */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const nowIso = () => new Date().toISOString();

/** Local date for an instant given a '-0500'-style offset. */
function localDate(iso, offset) {
  if (!iso) return null;
  let mins = 0;
  if (offset && offset.length >= 3) {
    const sign = offset[0] === "-" ? -1 : 1;
    mins = sign * (parseInt(offset.slice(1, 3), 10) * 60 + parseInt(offset.slice(3, 5) || "0", 10));
  }
  return new Date(new Date(iso).getTime() + mins * 60000).toISOString().slice(0, 10);
}

/**
 * Thin a polyline before sending it to a phone.
 *
 * Bouncie records a point every few seconds, so one long drive is thousands of
 * coordinates and the raw map payload was 179 KB on day two — on a six-week
 * trip that becomes megabytes, delivered over campground wifi to the people
 * least able to wait for it. At road-trip zoom the difference between 2,000
 * points and 120 is invisible.
 *
 * Endpoints keep the first and last point exactly (so segments still join up)
 * and sample evenly between. Not Douglas-Peucker: even sampling is O(n), has
 * no worst case, and the fidelity we would gain is smaller than a screen pixel.
 */
function thin(coords, max) {
  if (!Array.isArray(coords) || coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max - 1; i++) out.push(coords[Math.round(i * step)]);
  out.push(coords[coords.length - 1]);
  return out;
}

/** Parse a stored GeoJSON LineString and return thinned [lon,lat] pairs. */
function thinnedTrack(gpsText, max) {
  if (!gpsText) return [];
  try {
    const g = JSON.parse(gpsText);
    return thin(g.coordinates || [], max);
  } catch { return []; }
}

async function tripMeta(env) {
  return env.roadtrip.prepare("SELECT * FROM trip_meta WHERE id = 1").first();
}

/* ------------------------------------------------------------------ today */

export async function today(env) {
  const meta = await tripMeta(env);

  const last = await env.roadtrip
    .prepare(`SELECT ts, lat, lon, speed, fuel_level FROM track_points ORDER BY ts DESC LIMIT 1`)
    .first();

  const offset = (await env.roadtrip
    .prepare(`SELECT time_zone FROM trips WHERE time_zone IS NOT NULL ORDER BY start_time DESC LIMIT 1`)
    .first())?.time_zone || "-0500";

  const date = localDate(nowIso(), offset);

  const [day, total, mpg, next, lastStop] = await Promise.all([
    env.roadtrip.prepare(`SELECT * FROM v_day_summary WHERE date = ?`).bind(date).first(),
    env.roadtrip.prepare(`SELECT * FROM v_trip_mileage`).first(),
    env.roadtrip.prepare(`SELECT * FROM v_mpg_last_tank`).first(),
    // v_tonight sorts on a real date, not the mixed '2pm' / '2026-08-04'
    // strings the vault gave us. Prefer a stay covering today; otherwise the
    // next one starting.
    env.roadtrip.prepare(
      `SELECT id, name, place_name, check_in_date, check_in_time, check_out_date,
              check_out_time, cost, confirmation, site, cancel_by, whenish
         FROM v_tonight
        WHERE whenish IN ('tonight','upcoming')
        ORDER BY CASE whenish WHEN 'tonight' THEN 0 ELSE 1 END, check_in_date
        LIMIT 1`).first(),
    env.roadtrip.prepare(
      `SELECT id, kind, place, occurred_at, gallons, cost, note
         FROM stop ORDER BY occurred_at DESC LIMIT 1`).first(),
  ]);

  // Where they ACTUALLY slept beats where the plan said they would. The
  // itinerary is aspirational; a recorded campsite is a fact. If they pulled
  // into somewhere unplanned, that is tonight — no reservation required, and
  // the plan is not edited or marked wrong, it simply was not what happened.
  const actual = await env.roadtrip
    .prepare(
      `SELECT id, kind, place, note, occurred_at, cost
         FROM stop
        WHERE date = ? AND kind IN ('campsite','lodging')
        ORDER BY occurred_at DESC LIMIT 1`)
    .bind(date)
    .first();

  // Whether the car is moving. A stale last point means parked, not broken.
  const ageMin = last ? (Date.now() - new Date(last.ts).getTime()) / 60000 : null;
  const moving = ageMin !== null && ageMin < 6 && (last.speed || 0) > 3;

  const dayNumber = day?.day_number
    ?? Math.floor((new Date(date) - new Date(meta.departure_date)) / 86400000) + 1;

  return json({
    date,
    day_number: dayNumber,
    position: last ? { lat: last.lat, lon: last.lon, at: last.ts, stale_minutes: Math.round(ageMin) } : null,
    moving,
    speed: moving ? Math.round(last.speed) : null,
    fuel_level: last?.fuel_level ?? null,
    miles_today: day?.miles ?? 0,
    miles_total: total?.miles ?? 0,
    mpg: mpg ? { value: mpg.mpg, method: mpg.method, miles: mpg.miles, gallons: mpg.gallons } : null,
    tonight: actual
      ? { id: actual.id, name: actual.place || (actual.kind === "campsite" ? "Camped" : "Stayed"),
          note: actual.note, cost: actual.cost, kind: actual.kind,
          whenish: "tonight", actual: true }
      : (next || null),
    planned_tonight: actual ? (next || null) : null,
    last_stop: lastStop || null,
  });
}

/* ------------------------------------------------------------------- trip */

export async function trip(env) {
  const meta = await tripMeta(env);
  const today_ = localDate(nowIso(), "-0500");

  const days = await env.roadtrip.prepare(
    `SELECT date, day_number, title, miles, stops, photos, journal_entries, places
       FROM v_day_summary
      WHERE date >= ? AND date <= ?
      ORDER BY date DESC`).bind(meta.departure_date, today_).all();

  // Faded, undated, ordered by Lily's original sequence. These are hopes.
  // Nothing here is ever marked late, missed, or overdue.
  const ahead = await env.roadtrip.prepare(
    `SELECT i.id, i.name, i.kind, i.planned_arrival, i.planned_nights, i.drive_time_from_prev,
            (SELECT COUNT(*) FROM activity a WHERE a.intention_id = i.id) AS activities,
            (SELECT COUNT(*) FROM reservation r WHERE r.intention_id = i.id AND r.booked = 1) AS booked
       FROM intention i
      WHERE NOT EXISTS (SELECT 1 FROM day_intention di WHERE di.intention_id = i.id)
        AND i.dropped = 0
      ORDER BY i.seq LIMIT 8`).all();

  return json({
    departure: meta.departure_date,
    days: days.results,
    ahead: ahead.results,
  });
}

/* -------------------------------------------------------------------- day */

export async function day(env, date) {
  const [summary, stops, photos, journal, segments, places] = await Promise.all([
    env.roadtrip.prepare(`SELECT * FROM v_day_summary WHERE date = ?`).bind(date).first(),
    env.roadtrip.prepare(
      `SELECT id, kind, place, note, occurred_at, lat, lon, cost, gallons, price_per_gallon
         FROM stop WHERE date = ? ORDER BY occurred_at`).bind(date).all(),
    env.roadtrip.prepare(
      `SELECT id, r2_key, thumb_key, caption, taken_at, lat, lon, author_id
         FROM photo WHERE date = ? ORDER BY taken_at`).bind(date).all(),
    env.roadtrip.prepare(
      `SELECT j.id, j.body, j.written_at, j.shared, p.name AS author
         FROM journal_entry j LEFT JOIN person p ON p.id = j.author_id
        WHERE j.date = ? ORDER BY j.written_at`).bind(date).all(),
    env.roadtrip.prepare(
      `SELECT t.transaction_id, t.gps, t.distance, t.start_time, t.end_time
         FROM trips t JOIN v_segment_local v ON v.transaction_id = t.transaction_id
        WHERE v.local_date = ? ORDER BY t.start_time`).bind(date).all(),
    // eslint-disable-next-line no-unused-vars
    env.roadtrip.prepare(
      `SELECT i.id, i.name FROM day_intention di JOIN intention i ON i.id = di.intention_id
        WHERE di.date = ?`).bind(date).all(),
  ]);

  return json({
    date,
    summary: summary || null,
    stops: stops.results,
    photos: photos.results,
    journal: journal.results,
    // The raw `gps` column never leaves the Worker.
    segments: segments.results.map((s) => ({
      transaction_id: s.transaction_id,
      distance: s.distance,
      start_time: s.start_time,
      end_time: s.end_time,
      track: thinnedTrack(s.gps, 60),
    })),
    places: places.results,
  });
}

/* ------------------------------------------------------------------ place */

export async function place(env, id) {
  const [intention, activities, reservations, days] = await Promise.all([
    env.roadtrip.prepare(`SELECT * FROM intention WHERE id = ?`).bind(id).first(),
    env.roadtrip.prepare(
      `SELECT id, name, detail, distance_mi, duration, url, done, done_date
         FROM activity WHERE intention_id = ? ORDER BY done, rowid`).bind(id).all(),
    env.roadtrip.prepare(
      `SELECT id, name, provider, cost, booked, confirmation, site,
              check_in_at, check_out_at, cancel_by, url, notes
         FROM reservation WHERE intention_id = ? ORDER BY booked DESC, cost`).bind(id).all(),
    env.roadtrip.prepare(`SELECT date FROM day_intention WHERE intention_id = ? ORDER BY date`).bind(id).all(),
  ]);
  if (!intention) return json({ error: "not found" }, 404);

  return json({
    intention,
    activities: activities.results,
    reservations: reservations.results,
    visited_on: days.results.map((r) => r.date),
  });
}

export async function places(env) {
  const rows = await env.roadtrip.prepare(
    `SELECT i.id, i.name, i.kind, i.seq, i.planned_arrival, i.planned_nights,
            (SELECT COUNT(*) FROM activity a WHERE a.intention_id = i.id) AS wanted,
            (SELECT COUNT(*) FROM activity a WHERE a.intention_id = i.id AND a.done = 1) AS did,
            EXISTS(SELECT 1 FROM day_intention di WHERE di.intention_id = i.id) AS visited
       FROM intention i ORDER BY i.seq`).all();
  return json({ places: rows.results });
}

/* ----------------------------------------------------------- reservation */

export async function reservation(env, id) {
  const row = await env.roadtrip.prepare(
    `SELECT r.*, i.name AS place_name FROM reservation r
       LEFT JOIN intention i ON i.id = r.intention_id WHERE r.id = ?`).bind(id).first();
  if (!row) return json({ error: "not found" }, 404);
  return json(row);
}

/* -------------------------------------------------------------------- map */

export async function map(env) {
  const [segments, stops, last, total] = await Promise.all([
    env.roadtrip.prepare(
      `SELECT t.transaction_id, t.gps, t.gps_format, t.start_time
         FROM trips t, trip_meta m
        WHERE t.start_time >= m.trip_start_at AND t.gps IS NOT NULL
        ORDER BY t.start_time`).all(),
    env.roadtrip.prepare(
      `SELECT id, kind, place, lat, lon, occurred_at FROM stop
        WHERE lat IS NOT NULL ORDER BY occurred_at`).all(),
    env.roadtrip.prepare(`SELECT lat, lon, ts FROM track_points ORDER BY ts DESC LIMIT 1`).first(),
    env.roadtrip.prepare(`SELECT * FROM v_trip_mileage`).first(),
  ]);
  // ~90 points per segment keeps the whole trip well under 100 KB even at
  // six weeks, and is indistinguishable at this zoom.
  const tracks = segments.results
    .map((s) => thinnedTrack(s.gps, 90))
    .filter((t) => t.length > 1);

  return json({
    tracks,
    stops: stops.results,
    current: last || null,
    miles: total?.miles ?? 0,
  });
}

/* ------------------------------------------------------------------ write */

export async function createStop(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  const kinds = ["gas", "food", "campsite", "lodging", "event", "observation"];
  if (!kinds.includes(body.kind)) return json({ error: "bad kind" }, 400);

  const at = body.occurred_at || nowIso();
  const offset = body.tz_offset || "-0500";
  const id = body.client_id || crypto.randomUUID();

  // INSERT OR IGNORE, keyed on the client-supplied id: the offline queue will
  // retry the same stop and must not create duplicates.
  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO stop
       (id, date, occurred_at, tz_offset, kind, lat, lon, place, note, cost,
        gallons, price_per_gallon, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, localDate(at, offset), at, offset, body.kind,
    body.lat ?? null, body.lon ?? null, body.place ?? null, body.note ?? null,
    body.cost ?? null, body.gallons ?? null, body.price_per_gallon ?? null,
    person.id, nowIso()
  ).run();

  return json({ ok: true, id });
}

export async function updateStop(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.id) return json({ error: "id required" }, 400);
  // The pump shows gallons and price per gallon; the total is arithmetic.
  // Compute it here so nobody does multiplication standing at a fuel island.
  let cost = body.cost ?? null;
  if (cost == null && body.gallons != null && body.price_per_gallon != null) {
    cost = Math.round(body.gallons * body.price_per_gallon * 100) / 100;
  }
  await env.roadtrip.prepare(
    `UPDATE stop SET gallons = COALESCE(?, gallons),
                     price_per_gallon = COALESCE(?, price_per_gallon),
                     cost = COALESCE(?, cost),
                     note = COALESCE(?, note), place = COALESCE(?, place)
      WHERE id = ?`
  ).bind(body.gallons ?? null, body.price_per_gallon ?? null, cost,
         body.note ?? null, body.place ?? null, body.id).run();
  return json({ ok: true });
}

export async function createJournal(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.body || !body.body.trim()) return json({ error: "empty" }, 400);
  const at = body.written_at || nowIso();
  const offset = body.tz_offset || "-0500";
  const id = body.client_id || crypto.randomUUID();
  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO journal_entry
       (id, date, written_at, tz_offset, author_id, body, source, shared, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'app', ?, ?)`
  ).bind(id, localDate(at, offset), at, offset, person.id, body.body.trim(),
         body.shared === false ? 0 : 1, nowIso()).run();
  return json({ ok: true, id });
}

export async function toggleActivity(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.id) return json({ error: "id required" }, 400);
  const done = body.done ? 1 : 0;
  await env.roadtrip.prepare(
    `UPDATE activity SET done = ?, done_date = ?, done_note = COALESCE(?, done_note) WHERE id = ?`
  ).bind(done, done ? (body.date || localDate(nowIso(), "-0500")) : null,
         body.note ?? null, body.id).run();
  return json({ ok: true });
}

/** Link a day to a place. This is what makes an intention "visited". */
export async function linkDayPlace(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.date || !body.intention_id) return json({ error: "date and intention_id required" }, 400);
  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO day_intention (date, intention_id) VALUES (?, ?)`
  ).bind(body.date, body.intention_id).run();
  return json({ ok: true });
}

/**
 * Discard a stop.
 *
 * The button saves on the first tap by design — that is what makes it fast
 * enough to use at a pump — so mis-taps are inevitable and there has to be a
 * way out. Any author can discard any stop; there are two of them and they are
 * in the same car.
 */
export async function deleteStop(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.id) return json({ error: "id required" }, 400);
  await env.roadtrip.prepare(`DELETE FROM stop WHERE id = ?`).bind(body.id).run();
  return json({ ok: true });
}

/**
 * The journal, read as one stream.
 *
 * An "observation" stop and a journal entry produce the same thing — a
 * timestamped note in their own words. What differs is the gesture: an
 * observation is one thumb at 70mph going past something; a journal entry is
 * sitting down at a picnic table afterwards. Keeping both capture paths and
 * merging the reading means there is never a question of which one to use.
 */
export async function journal(env) {
  const [entries, observations] = await Promise.all([
    env.roadtrip.prepare(
      `SELECT j.id, j.date, j.written_at, j.body, j.shared, p.name AS author, 'entry' AS source
         FROM journal_entry j LEFT JOIN person p ON p.id = j.author_id
        ORDER BY j.written_at DESC`).all(),
    env.roadtrip.prepare(
      `SELECT s.id, s.date, s.occurred_at AS written_at, s.note AS body, 1 AS shared,
              p.name AS author, 'observation' AS source, s.place, s.lat, s.lon
         FROM stop s LEFT JOIN person p ON p.id = s.author_id
        WHERE s.kind = 'observation' AND s.note IS NOT NULL AND trim(s.note) <> ''
        ORDER BY s.occurred_at DESC`).all(),
  ]);

  const all = [...entries.results, ...observations.results]
    .sort((a, b) => (a.written_at < b.written_at ? 1 : -1));

  return json({ entries: all });
}

/** Every photo, newest first. Empty until the upload path exists. */
export async function photos(env) {
  const rows = await env.roadtrip.prepare(
    `SELECT p.id, p.date, p.taken_at, p.r2_key, p.thumb_key, p.caption, p.lat, p.lon,
            pe.name AS author
       FROM photo p LEFT JOIN person pe ON pe.id = p.author_id
      ORDER BY p.taken_at DESC LIMIT 500`).all();
  return json({ photos: rows.results });
}

/** Remove a journal entry. Same reasoning as discarding a stop: things get
    written by accident, and the only alternative was asking Andy to delete
    them by hand, which he had to do twice. */
export async function deleteJournal(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.id) return json({ error: "id required" }, 400);
  await env.roadtrip.prepare(`DELETE FROM journal_entry WHERE id = ?`).bind(body.id).run();
  return json({ ok: true });
}

/**
 * Route detail for a viewport.
 *
 * The overview sends 90 points per segment, which is right for the whole
 * country and useless the moment you zoom: magnifying 90 points just gives you
 * bigger straight lines. The full geometry is already stored — roughly 8,400
 * points for the first two days against the 720 the overview ships — it was
 * simply never asked for.
 *
 * So detail is fetched per viewport. Segments are filtered by their stored
 * bounding box first, so geometry that cannot be seen is never parsed, then
 * points outside the box are dropped and what remains is thinned to `max`.
 * Zoom in far enough and you get every recorded fix; zoom out and you are back
 * to the overview, at the same cost as before.
 */
export async function track(env, q) {
  const w = parseFloat(q.get("w")), s2 = parseFloat(q.get("s"));
  const e = parseFloat(q.get("e")), n = parseFloat(q.get("n"));
  const max = Math.min(parseInt(q.get("max") || "1500", 10), 6000);
  if ([w, s2, e, n].some(Number.isNaN)) return json({ error: "bbox required" }, 400);

  const rows = await env.roadtrip
    .prepare(
      `SELECT t.transaction_id, t.gps
         FROM trips t, trip_meta m
        WHERE t.start_time >= m.trip_start_at
          AND t.gps IS NOT NULL
          AND t.min_lon <= ? AND t.max_lon >= ?
          AND t.min_lat <= ? AND t.max_lat >= ?
        ORDER BY t.start_time`)
    .bind(e, w, n, s2)
    .all();

  // Keep a point just outside the viewport on either side of every visible
  // run, so lines reach the edge of the screen instead of stopping short of it.
  const tracks = [];
  for (const r of rows.results) {
    let cs;
    try { cs = JSON.parse(r.gps).coordinates || []; } catch { continue; }
    let run = [];
    for (let i = 0; i < cs.length; i++) {
      const [lon, lat] = cs[i];
      const inside = lon >= w && lon <= e && lat >= s2 && lat <= n;
      if (inside) {
        if (!run.length && i > 0) run.push(cs[i - 1]);
        run.push(cs[i]);
      } else if (run.length) {
        run.push(cs[i]);
        tracks.push(run);
        run = [];
      }
    }
    if (run.length > 1) tracks.push(run);
  }

  const total = tracks.reduce((a, t) => a + t.length, 0);
  const out = total <= max ? tracks : tracks.map((t) => {
    const share = Math.max(2, Math.floor((t.length / total) * max));
    if (t.length <= share) return t;
    const step = (t.length - 1) / (share - 1);
    const r = [];
    for (let i = 0; i < share - 1; i++) r.push(t[Math.round(i * step)]);
    r.push(t[t.length - 1]);
    return r;
  });

  return json({ tracks: out, points: out.reduce((a, t) => a + t.length, 0), available: total });
}

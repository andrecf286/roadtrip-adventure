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

/** Client-minted ids go into DOM id= and onclick= attributes downstream, and
    one of the writers (badge) is viewer-reachable — so an id is either a
    plain slug or it gets replaced. Closes the QA audit's stored-XSS vector. */
const safeId = (x) =>
  (typeof x === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(x)) ? x : crypto.randomUUID();

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

/** Path length in miles of [lon,lat] points (flat-earth, fine at this scale). */
function pathMilesOf(pts) {
  let mi = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i][0] - pts[i-1][0]) * 69 * Math.cos((pts[i][1] * Math.PI) / 180);
    const dy = (pts[i][1] - pts[i-1][1]) * 69;
    mi += Math.sqrt(dx * dx + dy * dy);
  }
  return mi;
}

/** Breadcrumb path miles of trips Bouncie hasn't closed yet — the live tail
    the completed-trip views can't see. Shared by today() and badges() so the
    1,000-mile badge appears WHEN they cross it, not at the next stop. */
async function liveExtraMiles(env) {
  let mi = 0;
  const open = await env.roadtrip.prepare(
    `SELECT t.transaction_id FROM trips t, trip_meta m
      WHERE t.start_time >= m.trip_start_at AND t.distance IS NULL`).all();
  for (const t of open.results) {
    const pts = await env.roadtrip.prepare(
      `SELECT lon, lat FROM track_points WHERE transaction_id = ? ORDER BY ts`).bind(t.transaction_id).all();
    mi += pathMilesOf(pts.results.map((r) => [r.lon, r.lat]));
  }
  return mi;
}

/** The car's position at a moment, from the breadcrumb nearest in time —
    within a tolerance, else null. This is what locates a photo whose EXIF
    GPS was stripped (iOS web uploads) but whose timestamp survived. */
async function positionAt(env, iso, toleranceMin) {
  const t = new Date(iso).getTime();
  if (!t) return null;
  const near = await env.roadtrip.prepare(
    `SELECT lat, lon, ts FROM track_points
      ORDER BY ABS(strftime('%s', ts) - strftime('%s', ?)) LIMIT 1`).bind(iso).first();
  if (near && Math.abs(new Date(near.ts).getTime() - t) / 60000 <= toleranceMin)
    return { lat: near.lat, lon: near.lon };
  // No breadcrumb near in TIME usually means the car was PARKED (breadcrumbs
  // only flow while driving). If the moment falls between one trip's end and
  // the next trip's start, the car sat at the earlier trip's last position —
  // the campground, the trailhead lot — which is the right guess for a photo
  // taken from camp.
  const prev = await env.roadtrip.prepare(
    `SELECT transaction_id, end_time FROM trips
      WHERE end_time IS NOT NULL AND strftime('%s', end_time) <= strftime('%s', ?)
      ORDER BY end_time DESC LIMIT 1`).bind(iso).first();
  if (!prev) return null;
  const nextStart = await env.roadtrip.prepare(
    `SELECT start_time FROM trips
      WHERE strftime('%s', start_time) > strftime('%s', ?)
      ORDER BY start_time LIMIT 1`).bind(prev.end_time).first();
  if (nextStart && new Date(nextStart.start_time).getTime() < t) return null; // driving, just no crumbs
  const parked = await env.roadtrip.prepare(
    `SELECT lat, lon FROM track_points WHERE transaction_id = ?
      ORDER BY ts DESC LIMIT 1`).bind(prev.transaction_id).first();
  return parked ? { lat: parked.lat, lon: parked.lon } : null;
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

  // Nearest town for the header: "Day 9 · Miles City, MT". Prefer somewhere
  // with a name people know — the biggest town within 8 miles wins; failing
  // that, whatever is nearest. Corridor-filtered GeoNames, so the scan is
  // ~2k rows of static data.
  let town = null;
  if (last) {
    const cos2 = Math.cos((last.lat * Math.PI) / 180) ** 2;
    let best = null, bestD2 = Infinity, bigBest = null, bigPop = 0;
    for (const [name, st, tlat, tlon, pop] of CORRIDOR_TOWNS) {
      const d2 = (tlat - last.lat) * (tlat - last.lat) * 4761 +
                 (tlon - last.lon) * (tlon - last.lon) * 4761 * cos2;
      if (d2 < bestD2) { bestD2 = d2; best = { name, st }; }
      if (d2 <= 64 && pop > bigPop) { bigPop = pop; bigBest = { name, st }; }
    }
    const pick = bigBest || best;
    if (pick && (bigBest || bestD2 <= 40 * 40)) town = pick.name + ", " + pick.st;
  }

  // v_day_summary only sums COMPLETED trips (distance lands at tripEnd), so
  // the number froze mid-drive — confusing at 70 mph. Add the live path
  // length of today's distance-less trips from their breadcrumbs.
  const liveMiles = await liveExtraMiles(env);
  const milesToday = Math.round(((day?.miles ?? 0) + liveMiles) * 10) / 10;

  const dayNumber = day?.day_number
    ?? Math.floor((new Date(date) - new Date(meta.departure_date)) / 86400000) + 1;

  const vstops = await vehicleStops(env);
  const stopCount = vstops.length;

  // Recent-weighted rather than uniform: a picture from this morning pulls
  // harder than one from day one. Newest 40, twelve of them, rotated hourly
  // by the client.
  // Located photos only. A photo has a location because its EXIF carried GPS,
  // or because the car's breadcrumbs put it somewhere at its capture instant —
  // either way it was taken ON THE TRIP. A screenshot has neither, which is how
  // a picture of Andy's iOS photo picker ended up as the centrepiece of the
  // Today screen. Costs three of Lily's day-1 camp shots, which were parked
  // beyond breadcrumb tolerance; they are still in Photos, and if the strays
  // get deleted this filter can be dropped.
  const heroShots = await env.roadtrip.prepare(
    `SELECT id, thumb_key, r2_key, date FROM photo
      WHERE lat IS NOT NULL
      ORDER BY taken_at DESC LIMIT 40`).all();

  return json({
    date,
    day_number: dayNumber,
    position: last ? { lat: last.lat, lon: last.lon, at: last.ts, stale_minutes: Math.round(ageMin) } : null,
    moving,
    speed: moving ? Math.round(last.speed) : null,
    fuel_level: last?.fuel_level ?? null,
    miles_today: milesToday,
    miles_total: Math.round(((total?.miles ?? 0) + liveMiles) * 10) / 10,
    mpg: mpg ? { value: mpg.mpg, method: mpg.method, miles: mpg.miles, gallons: mpg.gallons } : null,
    tonight: actual
      ? { id: actual.id, name: actual.place || (actual.kind === "campsite" ? "Camped" : "Stayed"),
          note: actual.note, cost: actual.cost, kind: actual.kind,
          whenish: "tonight", actual: true }
      : (next || null),
    planned_tonight: actual ? (next || null) : null,
    last_stop: lastStop || null,
    town,
    // The look of the app cycles ON EVERY VEHICLE STOP — background colour and
    // whose name comes first. Andy's reasoning: they should notice the app has
    // changed at the exact moment they get out of the car, because that is when
    // there is something to record. Derived, never stored, and stable between
    // stops so nothing flickers while they are looking at it.
    cycle: stopCount,
    // A dozen photos for the Today centrepiece to rotate through. Sent with
    // Today so the screen costs one request, not two.
    hero: heroShots.results.map((h) => ({ id: h.id, thumb: h.thumb_key || h.r2_key, key: h.r2_key, date: h.date })),
  });
}

/* ------------------------------------------------------------------- trip */

export async function trip(env) {
  const meta = await tripMeta(env);
  // Was hardcoded to Central. Once they reach Mountain or Pacific that is an
  // hour or three ahead of where they actually are, and the day list grows a
  // phantom tomorrow with zero miles every evening.
  const offset = (await env.roadtrip
    .prepare(`SELECT time_zone FROM trips WHERE time_zone IS NOT NULL ORDER BY start_time DESC LIMIT 1`)
    .first())?.time_zone || "-0500";
  const today_ = localDate(nowIso(), offset);

  const days = await env.roadtrip.prepare(
    `SELECT date, day_number, title, miles, stops, photos, journal_entries, places
       FROM v_day_summary
      WHERE date >= ? AND date <= ?
      ORDER BY date DESC`).bind(meta.departure_date, today_).all();

  // What actually happened each day, not just how much of it: the stops
  // themselves, in order, so a Trip row can read "gas · Culver's · Schroeder
  // County Park" instead of "2 stops". One query for the whole range, grouped
  // in JS — the day list is bounded by the trip's length.
  const stopRows = await env.roadtrip.prepare(
    `SELECT date, kind, place FROM stop
      WHERE date >= ? AND date <= ? ORDER BY date, occurred_at`
  ).bind(meta.departure_date, today_).all();
  const stopsByDate = {};
  for (const s of stopRows.results)
    (stopsByDate[s.date] = stopsByDate[s.date] || []).push({ kind: s.kind, place: s.place });
  for (const d of days.results) d.stop_list = stopsByDate[d.date] || [];

  // Visited-ness is DERIVED from where the car actually stopped (see
  // vehicleStops/derivedVisits) — nothing is marked by hand anymore.
  const [visits, names] = await Promise.all([
    derivedVisits(env),
    env.roadtrip.prepare(`SELECT id, name FROM intention`).all(),
  ]);
  const nameOf = {};
  for (const n of names.results) nameOf[n.id] = n.name;
  const everVisited = new Set();
  for (const d of Object.keys(visits)) for (const id of visits[d]) everVisited.add(id);
  for (const d of days.results) {
    const v = visits[d.date];
    d.places = v ? [...v].map((id) => nameOf[id]).filter(Boolean).join(", ") : null;
  }

  // Faded, undated, ordered by Lily's original sequence. These are hopes.
  // Nothing here is ever marked late, missed, or overdue.
  const aheadAll = await env.roadtrip.prepare(
    `SELECT i.id, i.name, i.kind, i.planned_arrival, i.planned_nights, i.drive_time_from_prev,
            (SELECT COUNT(*) FROM activity a WHERE a.intention_id = i.id) AS activities,
            (SELECT COUNT(*) FROM reservation r WHERE r.intention_id = i.id AND r.booked = 1) AS booked
       FROM intention i
      WHERE i.dropped = 0
      ORDER BY i.seq`).all();
  const ahead = { results: aheadAll.results.filter((i) => !everVisited.has(i.id)).slice(0, 8) };

  return json({
    departure: meta.departure_date,
    days: days.results,
    ahead: ahead.results,
  });
}

/* -------------------------------------------------------------------- day */

export async function day(env, date, person) {
  const [summary, stops, photos, journal, segments, places] = await Promise.all([
    env.roadtrip.prepare(`SELECT * FROM v_day_summary WHERE date = ?`).bind(date).first(),
    env.roadtrip.prepare(
      `SELECT id, kind, place, note, occurred_at, lat, lon, cost, gallons, price_per_gallon
         FROM stop WHERE date = ? ORDER BY occurred_at`).bind(date).all(),
    env.roadtrip.prepare(
      `SELECT id, r2_key, thumb_key, caption, taken_at, lat, lon, author_id
         FROM photo WHERE date = ? ORDER BY taken_at`).bind(date).all(),
    env.roadtrip.prepare(
      // Same share-flag read filter as journal(): private entries are
      // author-only on every read path, not just the feed.
      `SELECT j.id, j.body, j.written_at, j.shared, p.name AS author
         FROM journal_entry j LEFT JOIN person p ON p.id = j.author_id
        WHERE j.date = ? AND (j.shared = 1 OR j.author_id = ?)
        ORDER BY j.written_at`).bind(date, person?.id ?? "").all(),
    env.roadtrip.prepare(
      `SELECT t.transaction_id, t.gps, t.distance, t.start_time, t.end_time
         FROM trips t JOIN v_segment_local v ON v.transaction_id = t.transaction_id
        WHERE v.local_date = ? ORDER BY t.start_time`).bind(date).all(),
    // Derived, not marked: places whose 25-mile circle the car stopped in
    // that day (computed below, after the parallel batch).
    Promise.resolve({ results: [] }),
  ]);
  const dayVisits = (await derivedVisits(env))[date];
  if (dayVisits && dayVisits.size) {
    const q = [...dayVisits].map(() => "?").join(",");
    places.results = (await env.roadtrip.prepare(
      `SELECT id, name FROM intention WHERE id IN (` + q + `)`)
      .bind(...dayVisits).all()).results;
  }

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
    derivedVisits(env),
  ]);
  if (!intention) return json({ error: "not found" }, 404);

  return json({
    intention,
    activities: activities.results,
    reservations: reservations.results,
    visited_on: Object.keys(days).filter((d) => days[d].has(id)).sort(),
  });
}

export async function places(env) {
  const [rows, visited] = await Promise.all([
    env.roadtrip.prepare(
      `SELECT i.id, i.name, i.kind, i.seq, i.planned_arrival, i.planned_nights,
              (SELECT COUNT(*) FROM activity a WHERE a.intention_id = i.id) AS wanted,
              (SELECT COUNT(*) FROM activity a WHERE a.intention_id = i.id AND a.done = 1) AS did
         FROM intention i ORDER BY i.seq`).all(),
    visitedSetAll(env),
  ]);
  for (const r of rows.results) r.visited = visited.has(r.id) ? 1 : 0;
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

export async function map(env, person) {
  const [segments, gapPoints, stops, last, total, places, photos, journalPts] = await Promise.all([
    env.roadtrip.prepare(
      `SELECT t.transaction_id, t.gps, t.gps_format, t.start_time, t.distance
         FROM trips t, trip_meta m
        WHERE t.start_time >= m.trip_start_at AND t.gps IS NOT NULL
        ORDER BY t.start_time`).all(),
    // Webhook-inserted trips have NO polyline until the nightly sweep — which
    // read as large missing sections of the route for the whole afternoon.
    // And a trip's STORED polyline can itself be truncated (QA found trip
    // 3045 reporting 238 mi with only ~78 mi of line — a 155-mile hole
    // across Wisconsin). So: pull sampled breadcrumbs for EVERY post-boundary
    // trip; JS below decides which trips actually need them.
    env.roadtrip.prepare(
      `SELECT tp.transaction_id, tp.lat, tp.lon
         FROM track_points tp
         JOIN trips t ON t.transaction_id = tp.transaction_id, trip_meta m
        WHERE t.start_time >= m.trip_start_at AND (tp.rowid % 4) = 0
        ORDER BY tp.transaction_id, tp.ts`).all(),
    env.roadtrip.prepare(
      `SELECT id, kind, place, lat, lon, occurred_at, date FROM stop
        WHERE lat IS NOT NULL AND lon IS NOT NULL ORDER BY occurred_at`).all(),
    env.roadtrip.prepare(`SELECT lat, lon, ts FROM track_points ORDER BY ts DESC LIMIT 1`).first(),
    env.roadtrip.prepare(`SELECT * FROM v_trip_mileage`).first(),
    // Itinerary places, geocoded 2026-08-03: labeled pins for the basemap.
    env.roadtrip.prepare(
      `SELECT id, seq, name, lat, lon FROM intention
        WHERE lat IS NOT NULL AND dropped = 0 ORDER BY seq`).all(),
    // Located photos and journal entries: every event on the map, tappable.
    env.roadtrip.prepare(
      // author and taken_at ride along so a map pin can say who took it and
      // when, instead of offering a button that just opens the day.
      `SELECT p.id, p.thumb_key, p.date, p.lat, p.lon, p.taken_at, p.tz_offset,
              COALESCE(pe.name, '') AS author
         FROM photo p LEFT JOIN person pe ON pe.id = p.author_id
        WHERE p.lat IS NOT NULL AND p.lon IS NOT NULL ORDER BY p.taken_at`).all(),
    // Same share-flag read filter as journal(): a private entry's location
    // pin would leak the entry's existence to a viewer.
    env.roadtrip.prepare(
      `SELECT j.id, j.date, j.lat, j.lon, substr(j.body, 1, 120) AS excerpt,
              p.name AS author
         FROM journal_entry j LEFT JOIN person p ON p.id = j.author_id
        WHERE j.lat IS NOT NULL AND j.lon IS NOT NULL
          AND (j.shared = 1 OR j.author_id = ?)
        ORDER BY j.written_at`).bind(person?.id ?? "").all(),
  ]);
  // ~90 points per segment keeps the whole trip well under 100 KB even at
  // six weeks, and is indistinguishable at this zoom.
  const pathMiles = (pts) => {
    let mi = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = (pts[i][0] - pts[i-1][0]) * 69 * Math.cos((pts[i][1] * Math.PI) / 180);
      const dy = (pts[i][1] - pts[i-1][1]) * 69;
      mi += Math.sqrt(dx * dx + dy * dy);
    }
    return mi;
  };
  const byTrip = {};
  for (const p of gapPoints.results)
    (byTrip[p.transaction_id] = byTrip[p.transaction_id] || []).push([p.lon, p.lat]);

  const tracks = [];
  const covered = new Set();
  for (const s of segments.results) {
    const line = thinnedTrack(s.gps, 90);
    if (line.length > 1) {
      tracks.push(line);
      // A polyline that draws at least ~70% of the trip's reported distance
      // is trusted; a shorter one is truncated and gets its breadcrumbs too.
      const claimed = s.distance ?? null;
      if (claimed == null || claimed <= 0 || pathMiles(line) >= 0.7 * claimed)
        covered.add(s.transaction_id);
    }
  }
  for (const id of Object.keys(byTrip)) {
    if (covered.has(id)) continue;
    const t = thin(byTrip[id], 90);
    if (t.length > 1) tracks.push(t);
  }

  // Small date -> {day, place} lookup for the map popups. Day number comes from
  // the day table; the place is the derived visit for that date, i.e. where the
  // car actually stopped, which is the same source the day screen uses.
  const dayRows = await env.roadtrip.prepare(
    `SELECT date, day_number FROM day ORDER BY date`).all();
  // derivedVisits returns date -> Set(intention id), so the ids need resolving
  // to names before they can be shown to anyone.
  const [visits, intentNames] = await Promise.all([
    derivedVisits(env),
    env.roadtrip.prepare(`SELECT id, name FROM intention`).all(),
  ]);
  const nameOf = Object.fromEntries((intentNames.results || []).map((i) => [i.id, i.name]));
  const dayIndex = {};
  for (const d of dayRows.results || []) dayIndex[d.date] = { day: d.day_number, place: null };
  for (const date of Object.keys(visits || {})) {
    const ids = Array.from(visits[date] || []);
    if (dayIndex[date] && ids.length) dayIndex[date].place = nameOf[ids[0]] || null;
  }

  return json({
    day_index: dayIndex,
    tracks,
    stops: stops.results,
    current: last || null,
    miles: total?.miles ?? 0,
    places: places.results,
    photos: photos.results,
    journal: journalPts.results,
    vehicle_stops: await vehicleStops(env),
  });
}

/* ------------------------------------------- vehicle stops & derived visits */

/* Andy, 2026-08-04, taken literally: "vehicle stop, a marker gets dropped —
   itinerary places marking goes away." Nobody marks anything. The car
   stopping IS the record: a marker derives from every between-trips gap of
   >= 12 minutes, and a place counts as visited when the car (or a recorded
   stop) held still within 25 miles of it. day_intention and /api/visit stay
   in the schema as fossils; nothing reads them for truth anymore. Because
   this is derived at read time over ALL trips, the first two days backfilled
   themselves the moment it shipped. */

let VSTOP_CACHE = null;

async function vehicleStops(env) {
  const [trips, lastPts] = await Promise.all([
    env.roadtrip.prepare(
      `SELECT t.transaction_id, t.start_time, t.end_time, t.time_zone, t.gps, t.distance
         FROM trips t, trip_meta m
        WHERE t.start_time >= m.trip_start_at
        ORDER BY t.start_time`).all(),
    // Last breadcrumb per trip: truer than a truncated polyline's last vertex.
    env.roadtrip.prepare(
      `SELECT tp.transaction_id, tp.lat, tp.lon, MAX(tp.ts) AS ts
         FROM track_points tp
         JOIN trips t ON t.transaction_id = tp.transaction_id, trip_meta m
        WHERE t.start_time >= m.trip_start_at
        GROUP BY tp.transaction_id`).all(),
  ]);
  const rows = trips.results;
  const key = rows.length + ":" + (rows.length ? rows[rows.length - 1].end_time : "");
  if (VSTOP_CACHE && VSTOP_CACHE.key === key) return VSTOP_CACHE.stops;

  const lastCrumb = {};
  for (const p of lastPts.results) lastCrumb[p.transaction_id] = p;

  const stops = [];
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    if (!t.end_time) continue; // trip in progress: the car has not stopped
    const nextStart = i + 1 < rows.length ? rows[i + 1].start_time : null;
    const mins = Math.round(
      ((nextStart ? new Date(nextStart) : new Date()) - new Date(t.end_time)) / 60000);
    if (mins < 12) continue; // traffic lights and gas-and-go are not "stopped"
    let lat = null, lon = null;
    const crumb = lastCrumb[t.transaction_id];
    if (crumb) { lat = crumb.lat; lon = crumb.lon; }
    else {
      const line = thinnedTrack(t.gps, 4000);
      if (line.length) { lon = line[line.length - 1][0]; lat = line[line.length - 1][1]; }
    }
    if (lat == null) continue;
    stops.push({
      at: t.end_time,
      date: localDate(t.end_time, t.time_zone || "-0500"),
      lat, lon,
      mins: nextStart ? mins : null, // null = still there
      ongoing: !nextStart,
    });
  }
  VSTOP_CACHE = { key, stops };
  return stops;
}

/** date -> Set(intention_id), derived from vehicle stops and recorded stops
    within 25 mi of a geocoded itinerary place. */
async function derivedVisits(env) {
  const [vstops, userStops, intents] = await Promise.all([
    vehicleStops(env),
    env.roadtrip.prepare(
      `SELECT date, lat, lon FROM stop WHERE lat IS NOT NULL AND lon IS NOT NULL`).all(),
    env.roadtrip.prepare(
      `SELECT id, lat, lon FROM intention WHERE lat IS NOT NULL AND dropped = 0`).all(),
  ]);
  const R2MI = 25 * 25;
  const visits = {}; // date -> Set of intention ids
  const mark = (date, lat, lon) => {
    if (!date || lat == null) return;
    const cos2 = Math.cos((lat * Math.PI) / 180) ** 2;
    for (const it of intents.results) {
      const d2 = (it.lat - lat) * (it.lat - lat) * 4761 +
                 (it.lon - lon) * (it.lon - lon) * 4761 * cos2;
      if (d2 <= R2MI) (visits[date] = visits[date] || new Set()).add(it.id);
    }
  };
  for (const s of vstops) mark(s.date, s.lat, s.lon);
  for (const s of userStops.results) mark(s.date, s.lat, s.lon);
  return visits;
}

/** Flat helpers over the derivation. */
async function visitedSetAll(env) {
  const v = await derivedVisits(env);
  const all = new Set();
  for (const d of Object.keys(v)) for (const id of v[d]) all.add(id);
  return all;
}
async function firstVisitDates(env) {
  const v = await derivedVisits(env);
  const first = {};
  for (const d of Object.keys(v).sort())
    for (const id of v[d]) if (!(id in first)) first[id] = d;
  return first;
}

/* ----------------------------------------------------------------- photos */

/** Server-to-server photo ingest — the shared door for sources that are not
    a person tapping a button in the app. The browser upload authenticates by
    session cookie and is author-gated, which a background job on Andy's Mac
    (or, later, an inbound-email Worker) cannot satisfy: it is acting FOR a
    person, not AS one. So this path carries a shared secret and names its
    author explicitly.

    Placement policy lives with the CALLER, deliberately. EXIF GPS is used
    whenever present, for anyone. The breadcrumb fallback runs only when the
    caller sets `backfill=1`, which it does only for photos taken by someone
    who was actually in the car — otherwise a parent's un-geotagged photo from
    home would be placed on the route, which is worse than no pin at all. */
export async function ingestPhoto(env, request) {
  const secret = request.headers.get("x-ingest-secret") || "";
  if (!env.INGEST_SECRET || secret !== env.INGEST_SECRET)
    return json({ error: "unauthorized" }, 401);

  let form;
  try { form = await request.formData(); }
  catch { return json({ error: "multipart form required" }, 400); }
  const file = form.get("file"), thumb = form.get("thumb");
  if (!file || typeof file === "string") return json({ error: "file required" }, 400);

  const authorId = (form.get("author_id") || "").toString();
  const author = await env.roadtrip
    .prepare(`SELECT id FROM person WHERE id = ?`).bind(authorId).first();
  if (!author) return json({ error: "unknown author_id" }, 400);

  const id = safeId((form.get("client_id") || "").toString() || null);
  const takenAt = (form.get("taken_at") || nowIso()).toString();
  const offset = (form.get("tz_offset") || "-0500").toString();
  const date = localDate(takenAt, offset);

  let lat = form.get("lat") ? Number(form.get("lat")) : null;
  let lon = form.get("lon") ? Number(form.get("lon")) : null;
  if (lat == null && form.get("backfill") === "1") {
    const p = await positionAt(env, takenAt, 20);
    if (p) { lat = p.lat; lon = p.lon; }
  }

  const sha = (form.get("sha256") || "").toString() || null;
  if (sha) {
    const dupe = await env.roadtrip
      .prepare(`SELECT id FROM photo WHERE sha256 = ?`).bind(sha).first();
    if (dupe) return json({ ok: true, id: dupe.id, dupe: true });
  }

  const key = "photos/" + date + "/" + id + ".jpg";
  const thumbKey = "thumbs/" + id + ".jpg";
  await env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: "image/jpeg" } });
  if (thumb && typeof thumb !== "string")
    await env.PHOTOS.put(thumbKey, thumb.stream(), {
      httpMetadata: { contentType: "image/jpeg" } });

  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO photo
       (id, date, taken_at, tz_offset, lat, lon, r2_key, thumb_key,
        width, height, mime, sha256, caption, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'image/jpeg', ?, ?, ?, ?)`
  ).bind(id, date, takenAt, offset, lat, lon, key,
         (thumb && typeof thumb !== "string") ? thumbKey : null,
         sha, (form.get("caption") || "").toString().slice(0, 300) || null,
         authorId, nowIso()).run();
  return json({ ok: true, id, lat, lon, placed: lat != null ? (form.get("lat") ? "exif" : "track") : "none" });
}

/** Upload one photo: multipart form with `file` (resized JPEG), `thumb`
    (small JPEG), and metadata fields. The client resizes BEFORE upload —
    campground wifi carries ~300KB, not a 12MP original. sha256 dedupes
    retries at the DB layer; the R2 keys are content-addressed by photo id. */
export async function uploadPhoto(env, person, request) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  let form;
  try { form = await request.formData(); }
  catch { return json({ error: "multipart form required" }, 400); }
  const file = form.get("file"), thumb = form.get("thumb");
  if (!file || typeof file === "string") return json({ error: "file required" }, 400);

  const id = safeId((form.get("client_id") || "").toString() || null);
  const takenAt = (form.get("taken_at") || nowIso()).toString();
  const offset = (form.get("tz_offset") || "-0500").toString();
  const date = localDate(takenAt, offset);
  let lat = form.get("lat") ? Number(form.get("lat")) : null;
  let lon = form.get("lon") ? Number(form.get("lon")) : null;
  if (lat == null) {
    // iOS web uploads strip GPS EXIF but keep the timestamp; the car's
    // breadcrumbs know where it was at that moment (20-minute tolerance —
    // beyond that they might have hiked well away from the recorded track).
    const p = await positionAt(env, takenAt, 20);
    if (p) { lat = p.lat; lon = p.lon; }
  }
  const sha = (form.get("sha256") || "").toString() || null;

  // Same photo re-sent by a retry: point at the existing row, upload nothing.
  if (sha) {
    const dupe = await env.roadtrip
      .prepare(`SELECT id FROM photo WHERE sha256 = ?`).bind(sha).first();
    if (dupe) return json({ ok: true, id: dupe.id, dupe: true });
  }

  const key = "photos/" + date + "/" + id + ".jpg";
  const thumbKey = "thumbs/" + id + ".jpg";
  await env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: "image/jpeg" } });
  if (thumb && typeof thumb !== "string")
    await env.PHOTOS.put(thumbKey, thumb.stream(), {
      httpMetadata: { contentType: "image/jpeg" } });

  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO photo
       (id, date, taken_at, tz_offset, lat, lon, r2_key, thumb_key,
        width, height, mime, sha256, caption, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'image/jpeg', ?, ?, ?, ?)`
  ).bind(id, date, takenAt, offset, lat, lon, key,
         (thumb && typeof thumb !== "string") ? thumbKey : null,
         form.get("width") ? Number(form.get("width")) : null,
         form.get("height") ? Number(form.get("height")) : null,
         sha, (form.get("caption") || "").toString().slice(0, 300) || null,
         person.id, nowIso()).run();
  return json({ ok: true, id });
}

/** Serve a photo or thumb out of R2. Session-gated like everything else —
    these are pictures of two teenagers' trip, never public URLs. */
export async function servePhoto(env, path) {
  const key = path.replace(/^\/photo\//, "");
  if (!/^(photos|thumbs|badges|parkbadges)\//.test(key)) return json({ error: "bad key" }, 400);
  const obj = await env.PHOTOS.get(key);
  if (!obj) return json({ error: "not found" }, 404);
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType || "image/jpeg",
      // Private (cookie-gated) but immutable per key — the phone caches it.
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}

/** Remove a photo (any author, same rule as journal deletes): DB row first,
    then both R2 objects — a dangling object is better than a dangling row. */
export async function deletePhoto(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.id) return json({ error: "id required" }, 400);
  const row = await env.roadtrip
    .prepare(`SELECT r2_key, thumb_key FROM photo WHERE id = ?`).bind(body.id).first();
  if (!row) return json({ error: "not found" }, 404);
  await env.roadtrip.prepare(`DELETE FROM photo WHERE id = ?`).bind(body.id).run();
  await env.PHOTOS.delete(row.r2_key);
  if (row.thumb_key) await env.PHOTOS.delete(row.thumb_key);
  return json({ ok: true });
}

/* ----------------------------------------------------------------- badges */

import { STATE_POLYS } from "./geo_states_named.js";
import { CORRIDOR_TOWNS } from "./geo_towns.js";

// Precomputed bounding boxes make the point-in-state test cheap: most points
// skip most states on the bbox alone.
const STATE_BBOX = STATE_POLYS.map((s) => {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  for (const ring of s.r) for (const [x, y] of ring) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
});

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function stateOfPoint(x, y) {
  for (let i = 0; i < STATE_POLYS.length; i++) {
    const b = STATE_BBOX[i];
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
    for (const ring of STATE_POLYS[i].r)
      if (inRing(x, y, ring)) return STATE_POLYS[i].n;
  }
  return null;
}

/** Normalized outline(s) for a state badge: up to 3 rings (Michigan needs
    both peninsulas), projected into a 0..100 box with latitude-corrected
    aspect. The badge IS the state's shape — so simplification must be
    SHAPE-preserving (Douglas-Peucker), not the payload thinner: even
    sampling shaved Minnesota's arrowhead and Ohio's lakeshore. */
function rdpOpen(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0;
  const [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1, dy = y2 - y1, norm = Math.hypot(dx, dy) || 1e-12;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / norm;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) {
    const a = rdpOpen(pts.slice(0, idx + 1), eps), b = rdpOpen(pts.slice(idx), eps);
    return a.slice(0, -1).concat(b);
  }
  return [pts[0], pts[pts.length - 1]];
}
function rdpRingBadge(ring, target) {
  // Closed ring: a degenerate chord collapses plain RDP, so split at the
  // midpoint. Tighten tolerance-first: start fine, coarsen until it fits.
  let eps = 0.015, out = ring;
  for (let tries = 0; tries < 8; tries++) {
    const mid = Math.floor(ring.length / 2);
    const a = rdpOpen(ring.slice(0, mid + 1), eps), b = rdpOpen(ring.slice(mid), eps);
    out = a.slice(0, -1).concat(b);
    if (out.length <= target) break;
    eps *= 1.7;
  }
  return out;
}
function stateShape(name) {
  const sp = STATE_POLYS.find((s) => s.n === name);
  if (!sp) return null;
  const rings = sp.r.slice(0, 3).map((r) => rdpRingBadge(r, 80));
  let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
  for (const r of rings) for (const [x, y] of r) {
    if (y < la0) la0 = y; if (y > la1) la1 = y;
    if (x < lo0) lo0 = x; if (x > lo1) lo1 = x;
  }
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  const w = (lo1 - lo0) * k, h = la1 - la0;
  const sc = 100 / Math.max(w, h);
  return {
    w: Math.round(w * sc), h: Math.round(h * sc),
    rings: rings.map((r) => r.map(([x, y]) => [
      Math.round((x - lo0) * k * sc * 10) / 10,
      Math.round((la1 - y) * sc * 10) / 10,
    ])),
  };
}

// States derivation walks every trip polyline; cache per isolate, keyed on
// how much track exists, so repeat opens of the Badges tab cost one query.
let STATES_CACHE = null;

export async function badges(env) {
  // One tiny table read; thirteen rows at most, and it means adding a park's
  // artwork is an INSERT rather than a deploy.
  const artRows = await env.roadtrip.prepare(
    `SELECT park_name, r2_key FROM park_badge`).all();
  const parkArt = Object.fromEntries((artRows.results || []).map((r) => [r.park_name, r.r2_key]));
  const [trips, points, parks, mileage, fills, bespoke] = await Promise.all([
    env.roadtrip.prepare(
      `SELECT t.gps, t.start_time, t.time_zone
         FROM trips t, trip_meta m
        WHERE t.start_time >= m.trip_start_at AND t.gps IS NOT NULL
        ORDER BY t.start_time`).all(),
    // Webhook-inserted trips carry no polyline until the nightly sweep, so a
    // state crossed this afternoon would not appear until tomorrow morning if
    // we only read trips. The live breadcrumbs close that gap; every 15th
    // point is a fix every few miles, plenty to notice a border.
    env.roadtrip.prepare(
      `SELECT lat, lon, ts FROM track_points WHERE (rowid % 15) = 0 ORDER BY ts`).all(),
    (async () => {
      const [first, parkRows] = await Promise.all([
        firstVisitDates(env),
        env.roadtrip.prepare(`SELECT id, name FROM intention WHERE kind = 'park'`).all(),
      ]);
      return { results: parkRows.results
        .filter((p) => p.id in first)
        .map((p) => ({ id: p.id, name: p.name, first_date: first[p.id] }))
        .sort((a, b) => (a.first_date < b.first_date ? -1 : 1)) };
    })(),
    env.roadtrip.prepare(`SELECT * FROM v_trip_mileage`).first(),
    env.roadtrip.prepare(
      `SELECT COUNT(*) AS n FROM stop WHERE kind = 'gas' AND gallons IS NOT NULL`).first(),
    env.roadtrip.prepare(
      `SELECT b.id, b.title, b.emoji, b.note, b.date, b.created_at,
              b.awarded_by, b.image_key, p.name AS awarded_by_name
         FROM badge b LEFT JOIN person p ON p.id = b.awarded_by
        ORDER BY b.created_at DESC`).all(),
  ]);

  const key = trips.results.length + ":" +
    (trips.results.length ? trips.results[trips.results.length - 1].start_time : "") +
    ":" + points.results.length;
  if (!STATES_CACHE || STATES_CACHE.key !== key) {
    const seen = {}; // state -> first local date
    for (const t of trips.results) {
      const day = localDate(t.start_time, t.time_zone || "-0500");
      for (const [x, y] of thinnedTrack(t.gps, 60)) {
        const st = stateOfPoint(x, y);
        if (st && !(st in seen)) seen[st] = day;
      }
    }
    const tz = trips.results.length
      ? trips.results[trips.results.length - 1].time_zone || "-0500" : "-0500";
    for (const p of points.results) {
      const st = stateOfPoint(p.lon, p.lat);
      if (st && !(st in seen)) seen[st] = localDate(p.ts, tz);
    }
    STATES_CACHE = {
      key,
      states: Object.entries(seen)
        .map(([state, first_date]) => ({ state, first_date, shape: stateShape(state) }))
        .sort((a, b) => (a.first_date < b.first_date ? -1 : 1)),
    };
  }

  const miles = Math.round(((mileage?.miles ?? 0) + await liveExtraMiles(env)) * 10) / 10;
  return json({
    states: STATES_CACHE.states,
    parks: parks.results.map((p) => ({ ...p, image_key: parkArt[p.name] || null })),
    miles: { total: miles, earned: Math.floor(miles / 1000),
             to_next: Math.round(1000 - (miles % 1000)) },
    tanks: { fills: fills?.n ?? 0, earned: Math.floor((fills?.n ?? 0) / 10) },
    bespoke: bespoke.results,
  });
}

/** Award a bespoke badge. Deliberately NOT authors-only — this is the one
    viewer write in the app (Andy's call, 2026-08-03): any of the six can
    invent and award a badge. It writes nothing about location or the girls;
    it is a gift mechanic. */
export async function createBadge(env, person, body) {
  if (!person) return json({ error: "unauthorized" }, 401);
  if (!body.title || !body.title.trim()) return json({ error: "title required" }, 400);
  const id = safeId(body.client_id);
  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO badge (id, title, emoji, note, date, awarded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.title.trim().slice(0, 80),
         (body.emoji || "").trim().slice(0, 8) || null,
         (body.note || "").trim().slice(0, 500) || null,
         body.date || null, person.id, nowIso()).run();
  return json({ ok: true, id });
}

/** Award a badge WITH an image — multipart variant of createBadge, same
    permission (any of the six). The image is Amelia's "cool tag": client
    resizes it, we park it in R2 under badges/ and serve it session-gated. */
export async function uploadBadge(env, person, request) {
  if (!person) return json({ error: "unauthorized" }, 401);
  let form;
  try { form = await request.formData(); }
  catch { return json({ error: "multipart form required" }, 400); }
  const title = (form.get("title") || "").toString().trim();
  if (!title) return json({ error: "title required" }, 400);
  const id = safeId((form.get("client_id") || "").toString() || null);
  let imageKey = null;
  const img = form.get("image");
  if (img && typeof img !== "string") {
    imageKey = "badges/" + id + ".jpg";
    await env.PHOTOS.put(imageKey, img.stream(), {
      httpMetadata: { contentType: "image/jpeg" } });
  }
  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO badge (id, title, emoji, note, date, awarded_by, image_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, title.slice(0, 80),
         (form.get("emoji") || "").toString().trim().slice(0, 8) || null,
         (form.get("note") || "").toString().trim().slice(0, 500) || null,
         (form.get("date") || "").toString() || null,
         person.id, imageKey, nowIso()).run();
  return json({ ok: true, id });
}

/** Remove a badge: its awarder, or any author (the girls can prune). */
/** Edit a badge's title, emoji or note. Same permission as removing one:
    whoever awarded it, or any author. The family invented this whole surface
    over iMessage and they name things badly the first time — Amelia asked for
    this after "No Stabbies - Level 1" went up with a typo. The image is NOT
    touched here; re-award if the picture is wrong. */
export async function updateBadge(env, person, body) {
  if (!person) return json({ error: "unauthorized" }, 401);
  if (!body.id) return json({ error: "id required" }, 400);
  if (!body.title || !body.title.trim()) return json({ error: "title required" }, 400);
  const row = await env.roadtrip
    .prepare(`SELECT awarded_by FROM badge WHERE id = ?`).bind(body.id).first();
  if (!row) return json({ error: "not found" }, 404);
  if (person.id !== row.awarded_by && person.role !== "author")
    return json({ error: "not yours to edit" }, 403);
  await env.roadtrip.prepare(
    `UPDATE badge SET title = ?, emoji = ?, note = ? WHERE id = ?`
  ).bind(body.title.trim().slice(0, 80),
         (body.emoji || "").trim().slice(0, 8) || null,
         (body.note || "").trim().slice(0, 500) || null,
         body.id).run();
  return json({ ok: true, id: body.id });
}

export async function deleteBadge(env, person, body) {
  if (!person) return json({ error: "unauthorized" }, 401);
  if (!body.id) return json({ error: "id required" }, 400);
  const row = await env.roadtrip
    .prepare(`SELECT awarded_by, image_key FROM badge WHERE id = ?`).bind(body.id).first();
  if (!row) return json({ error: "not found" }, 404);
  if (person.id !== row.awarded_by && person.role !== "author")
    return json({ error: "not yours to remove" }, 403);
  await env.roadtrip.prepare(`DELETE FROM badge WHERE id = ?`).bind(body.id).run();
  if (row.image_key) await env.PHOTOS.delete(row.image_key);
  return json({ ok: true });
}

/* ------------------------------------------------------------------ write */

export async function createStop(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  const kinds = ["gas", "food", "campsite", "lodging", "event", "observation"];
  if (!kinds.includes(body.kind)) return json({ error: "bad kind" }, 400);

  const at = body.occurred_at || nowIso();
  const offset = body.tz_offset || "-0500";
  const id = safeId(body.client_id);

  // A stop with no position can't be a map marker or count toward a visited
  // place — and Lily's first eleven taps arrived with lat null (phone GPS
  // absent on campground wifi). The car knows where it is even when the
  // phone doesn't: default to the freshest breadcrumb when it's recent
  // enough to trust (30 min covers a stop recorded from a picnic table).
  let lat = body.lat ?? null, lon = body.lon ?? null;
  if (lat == null) {
    const p = await env.roadtrip
      .prepare(`SELECT lat, lon, ts FROM track_points ORDER BY ts DESC LIMIT 1`).first();
    if (p && Date.now() - new Date(p.ts).getTime() < 30 * 60000) { lat = p.lat; lon = p.lon; }
  }

  // INSERT OR IGNORE, keyed on the client-supplied id: the offline queue will
  // retry the same stop and must not create duplicates.
  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO stop
       (id, date, occurred_at, tz_offset, kind, lat, lon, place, note, cost,
        gallons, price_per_gallon, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, localDate(at, offset), at, offset, body.kind,
    lat, lon, body.place ?? null, body.note ?? null,
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
  const r = await env.roadtrip.prepare(
    `UPDATE stop SET gallons = COALESCE(?, gallons),
                     price_per_gallon = COALESCE(?, price_per_gallon),
                     cost = COALESCE(?, cost),
                     note = COALESCE(?, note), place = COALESCE(?, place)
      WHERE id = ?`
  ).bind(body.gallons ?? null, body.price_per_gallon ?? null, cost,
         body.note ?? null, body.place ?? null, body.id).run();
  if (!r.meta.changes) return json({ error: "not found" }, 404);
  return json({ ok: true });
}

export async function createJournal(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.body || !body.body.trim()) return json({ error: "empty" }, 400);
  const at = body.written_at || nowIso();
  const offset = body.tz_offset || "-0500";
  // An explicit date wins: writing on Tuesday about Sunday should file under
  // Sunday. Without this the entry silently landed on today and vanished from
  // the screen the author was looking at.
  const date = body.date || localDate(at, offset);
  const id = safeId(body.client_id);
  await env.roadtrip.prepare(
    `INSERT OR IGNORE INTO journal_entry
       (id, date, written_at, tz_offset, author_id, body, source, shared, lat, lon, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'app', ?, ?, ?, ?)`
  ).bind(id, date, at, offset, person.id, body.body.trim(),
         body.shared === false ? 0 : 1,
         body.lat ?? null, body.lon ?? null, nowIso()).run();
  return json({ ok: true, id });
}

export async function toggleActivity(env, person, body) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.id) return json({ error: "id required" }, 400);
  const done = body.done ? 1 : 0;
  const res = await env.roadtrip.prepare(
    `UPDATE activity SET done = ?, done_date = ?, done_note = COALESCE(?, done_note) WHERE id = ?`
  ).bind(done, done ? (body.date || localDate(nowIso(), "-0500")) : null,
         body.note ?? null, body.id).run();
  // A stale or mistyped id used to return ok:true, making a no-op
  // indistinguishable from a real edit.
  if (!res?.meta?.changes) return json({ error: "no such activity" }, 404);
  return json({ ok: true });
}

/** Link a day to a place. This is what makes an intention "visited". */
export async function linkDayPlace(env, person, body, method) {
  if (!person || person.role !== "author") return json({ error: "authors only" }, 403);
  if (!body.date || !body.intention_id) return json({ error: "date and intention_id required" }, 400);

  // Unlinking has to exist. Without it a mistaken tap permanently marks a place
  // as reached, and there is no way back through the API.
  if (method === "DELETE") {
    await env.roadtrip.prepare(
      `DELETE FROM day_intention WHERE date = ? AND intention_id = ?`
    ).bind(body.date, body.intention_id).run();
    return json({ ok: true, unlinked: true });
  }

  const exists = await env.roadtrip
    .prepare(`SELECT 1 AS n FROM intention WHERE id = ?`).bind(body.intention_id).first();
  if (!exists) return json({ error: "no such place" }, 404);

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
  const r = await env.roadtrip.prepare(`DELETE FROM stop WHERE id = ?`).bind(body.id).run();
  if (!r.meta.changes) return json({ error: "not found" }, 404);
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
export async function journal(env, person) {
  // Read-side enforcement of the share flag: a private entry (shared = 0) is
  // visible only to its author. Storing the flag on write was never enough —
  // if Lily and Ada answer "private by default", this filter is what makes
  // that a default change instead of a leak to their parents.
  const [entries, observations] = await Promise.all([
    env.roadtrip.prepare(
      `SELECT j.id, j.date, j.written_at, j.body, j.shared, p.name AS author, 'entry' AS source
         FROM journal_entry j LEFT JOIN person p ON p.id = j.author_id
        WHERE j.shared = 1 OR j.author_id = ?
        ORDER BY j.written_at DESC`).bind(person?.id ?? "").all(),
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
  const r = await env.roadtrip.prepare(`DELETE FROM journal_entry WHERE id = ?`).bind(body.id).run();
  if (!r.meta.changes) return json({ error: "not found" }, 404);
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

  // Breadcrumbs in the viewport too — polyline-less trips (pre-sweep) and
  // truncated polylines (QA's 155-mile Wisconsin hole) are invisible to the
  // trips query, and zooming used to ERASE those miles from the screen
  // because the detail response replaced the overview. Overdraw where a
  // polyline also exists is harmless; a hole is not.
  const crumbs = await env.roadtrip.prepare(
    `SELECT transaction_id, lat, lon FROM track_points
      WHERE lon >= ? AND lon <= ? AND lat >= ? AND lat <= ?
      ORDER BY transaction_id, ts`).bind(w, e, s2, n).all();
  const crumbTrips = {};
  for (const p of crumbs.results)
    (crumbTrips[p.transaction_id] = crumbTrips[p.transaction_id] || []).push([p.lon, p.lat]);
  for (const id of Object.keys(crumbTrips)) {
    const t = thin(crumbTrips[id], 400);
    if (t.length > 1) tracks.push(t);
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

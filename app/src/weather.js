/**
 * Weather — the app Worker's first and only outbound call to anything.
 *
 * Provider: Open-Meteo. Chosen over OpenWeather and the rest for one reason
 * that matters more than the data: it needs NO API KEY. Every other option
 * would have made this the first third-party credential in roadtrip-app's
 * config, with a rotation story and a way to break at 2am in Wyoming. This
 * adds a call, not a secret. Free tier is 10k calls/day, non-commercial, CC-BY
 * attribution — a private six-person family app sits comfortably inside all
 * three.
 *
 * Two functions, two different jobs:
 *
 *   currentAt()   live conditions where the car is now. Cached ten minutes.
 *                 Ephemeral by nature — nobody will want to know in October
 *                 what the dashboard said at 3pm on a Tuesday.
 *
 *   archiveAt()   what it was like at a past instant. Used ONLY to backfill
 *                 the handful of stops that predate this feature. Not a
 *                 general tool: Open-Meteo's archive is a paid product and the
 *                 endpoint answering keyless today is not something to build a
 *                 habit on. Capture forward; that is the whole design.
 *
 * Everything here fails soft and returns null. Weather is decoration on a
 * journal — an outage must never cost a stop, a Today screen, or a photograph.
 */

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE  = "https://archive-api.open-meteo.com/v1/archive";

/* American family, American units. Set at the call site so the numbers arrive
   ready to render and nothing downstream has to remember to convert. */
const UNITS = "temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch";

/* Six seconds, hard. This runs inside waitUntil() on the write path and inside
   a Today render; either way, a hanging third party must not be able to hold
   anything open. */
async function getJson(url, ms = 6000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "roadtripadventure.app" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Live conditions at a coordinate, or null.
 *
 * Cached through the Workers Cache API rather than a variable, because
 * isolates come and go and six phones re-pull Today every ninety seconds while
 * the screen is up — that is ~4,000 calls a day against a 10k ceiling if every
 * pull went upstream. The cache key rounds to two decimals (about a kilometre),
 * so a car sitting still shares one entry and a moving car naturally misses,
 * which is the correct behaviour in both cases.
 */
export async function currentAt(lat, lon) {
  if (lat == null || lon == null) return null;
  const key = `https://weather.cache/current/${lat.toFixed(2)}/${lon.toFixed(2)}`;
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return await hit.json();

  const url = `${FORECAST}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day` +
    `&${UNITS}&timezone=auto`;
  const d = await getJson(url);
  const c = d?.current;
  if (!c) return null;

  const out = {
    code: c.weather_code ?? null,
    temp_f: c.temperature_2m ?? null,
    feels_f: c.apparent_temperature ?? null,
    humidity: c.relative_humidity_2m ?? null,
    wind_mph: c.wind_speed_10m ?? null,
    is_day: c.is_day === 1,
    at: c.time ?? null,
  };
  await cache.put(key, new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json", "cache-control": "max-age=600" },
  }));
  return out;
}

/**
 * Conditions at a past instant, or null. Backfill only — see the header.
 *
 * The archive endpoint is hourly, so this asks for the stop's own day and then
 * picks the nearest hour to the actual instant rather than assuming index
 * alignment. Times come back in the location's own zone (timezone=auto) with no
 * offset suffix, which is exactly what we want for "nearest hour to when they
 * pulled in" and exactly wrong for arithmetic against a UTC stamp — so the
 * comparison is done on the local wall clock of the stop, not on epoch values.
 */
export async function archiveAt(lat, lon, iso, tzOffset) {
  if (lat == null || lon == null || !iso) return null;
  // The stop's local wall-clock time: occurred_at is UTC, tz_offset is like "-0500".
  const sign = (tzOffset || "-0500").startsWith("-") ? -1 : 1;
  const offMin = sign * (parseInt((tzOffset || "-0500").slice(1, 3), 10) * 60 +
                         parseInt((tzOffset || "-0500").slice(3, 5), 10));
  const localMs = new Date(iso).getTime() + offMin * 60000;
  const local = new Date(localMs);
  const day = local.toISOString().slice(0, 10);

  const url = `${ARCHIVE}?latitude=${lat}&longitude=${lon}&start_date=${day}&end_date=${day}` +
    `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m` +
    `&${UNITS}&timezone=auto`;
  const d = await getJson(url, 12000);
  const h = d?.hourly;
  if (!h?.time?.length) return null;

  const want = local.toISOString().slice(0, 13); // YYYY-MM-DDTHH on the local clock
  let best = 0, bestGap = Infinity;
  for (let i = 0; i < h.time.length; i++) {
    const gap = Math.abs(
      new Date(h.time[i] + ":00Z").getTime() - new Date(want + ":00:00Z").getTime());
    if (gap < bestGap) { bestGap = gap; best = i; }
  }
  if (h.temperature_2m?.[best] == null) return null;
  return {
    code: h.weather_code?.[best] ?? null,
    temp_f: h.temperature_2m[best],
    feels_f: h.apparent_temperature?.[best] ?? null,
    humidity: h.relative_humidity_2m?.[best] ?? null,
    wind_mph: h.wind_speed_10m?.[best] ?? null,
    at: h.time[best],
  };
}

/* ---------------------------------------------------------------- alerts */
/**
 * Active National Weather Service alerts at a coordinate, worst first.
 *
 * This is the one part of the weather feature that is not decoration. The
 * temperature is a nice line on a journal; a Red Flag Warning is two teenagers
 * in a tent in Montana in August who should know about it. It gets a banner,
 * not a metric.
 *
 * api.weather.gov: no key, no signup, and it REQUIRES a User-Agent that
 * identifies the caller with contact info — omit it and you get throttled.
 *
 * US only, by construction. Vancouver on Aug 17-18 returns HTTP 400 "out of
 * bounds" (verified, not assumed), which getJson turns into null and the
 * banner simply does not render. The correct behaviour for a two-day border
 * crossing is silence, not an error.
 */
export async function alertsAt(lat, lon) {
  if (lat == null || lon == null) return [];
  const key = `https://weather.cache/alerts/${lat.toFixed(2)}/${lon.toFixed(2)}`;
  const cache = caches.default;
  const hit = await cache.match(key);
  if (hit) return await hit.json();

  const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  let d = null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        // NWS asks for an identifying agent with a contact address.
        "user-agent": "roadtripadventure.app (acfoti@gmail.com)",
        accept: "application/geo+json",
      },
    });
    if (r.ok) d = await r.json();
  } catch { /* out of bounds, down, slow — all the same answer: no banner */ }
  finally { clearTimeout(t); }

  const RANK = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
  const now = Date.now();
  const out = (d?.features || [])
    .map((f) => f.properties || {})
    // Urgency "Past" is an alert about something already over, and `ends` in
    // the past is the same thing said differently. Neither is news.
    .filter((p) => p.urgency !== "Past" && (!p.ends || new Date(p.ends).getTime() > now))
    .sort((a, b) => (RANK[a.severity] ?? 9) - (RANK[b.severity] ?? 9))
    .slice(0, 3)
    .map((p) => ({
      event: p.event || "Weather alert",
      severity: p.severity || "Unknown",
      urgency: p.urgency || "",
      headline: p.headline || "",
      // The full text runs to several paragraphs of all-caps forecaster prose.
      // The instruction is the part that tells a person what to DO.
      instruction: (p.instruction || p.description || "").slice(0, 600),
      ends: p.ends || p.expires || null,
      area: p.areaDesc || "",
    }));

  await cache.put(key, new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json", "cache-control": "max-age=300" },
  }));
  return out;
}

/**
 * Write a reading onto a stop. Separate from the fetch so the caller decides
 * whether it is awaited (backfill) or fired into waitUntil (the live path).
 */
export async function attachToStop(env, stopId, w) {
  if (!w) return false;
  await env.roadtrip.prepare(
    `UPDATE stop SET weather_code = ?, temp_f = ?, feels_f = ?, wind_mph = ?,
                     humidity = ?, weather_at = ?
      WHERE id = ?`
  ).bind(w.code ?? null, w.temp_f ?? null, w.feels_f ?? null,
         w.wind_mph ?? null, w.humidity ?? null, w.at ?? null, stopId).run();
  return true;
}

/**
 * One clock.
 *
 * Everything date-shaped in this app goes through a LOCAL date, never UTC.
 * They cross three time zones and an 11pm photo belongs to that evening. The
 * offset that makes that possible arrives as a five-character string — "-0500"
 * — from the phone that wrote the row, or from the car's own last trip.
 *
 * That string used to be parsed in three places with three near-copies of the
 * same arithmetic, and the copies disagreed about the edge: localDate read a
 * short or missing offset as UTC, while localHour and the weather archive read
 * it as Ohio. One of those is wrong by five hours and neither announced which.
 * They now share one parser, and it answers Ohio — the zone the trip left
 * from, the zone three of the six people never leave, and the default every
 * other line in this codebase already used.
 *
 * Colon forms parse too ("-05:00"). Nothing in the app produces one today, but
 * the NWS alert timestamps the client parses carry them, and a parser that
 * accepts one shape of a thing and silently mis-reads another is a trap
 * waiting for whoever adds the next source.
 */

/** Ohio. Home zone, and the answer whenever a real offset is missing. */
export const HOME_TZ = "-0500";

/** Minutes east of UTC for a "-0500" / "-05:00" / "+0530" offset. */
export function tzMinutes(offset) {
  const m = /^([+-])(\d{2}):?(\d{2})?$/.exec(String(offset ?? "").trim());
  if (!m) return tzMinutes(HOME_TZ);
  return (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] || "0", 10));
}

/** The local calendar date of an instant, given that instant's offset. */
export function localDate(iso, offset) {
  if (!iso) return null;
  return new Date(new Date(iso).getTime() + tzMinutes(offset) * 60000)
    .toISOString().slice(0, 10);
}

/** The local hour-of-day of an instant, given that instant's offset. */
export function localHour(iso, offset) {
  return new Date(new Date(iso).getTime() + tzMinutes(offset) * 60000).getUTCHours();
}

/**
 * A local wall-clock reading with no offset on it, turned into a real instant.
 *
 * Open-Meteo answers `timezone=auto` with naive local strings — "2026-08-06T08:00"
 * — which is the right thing to show a person and the wrong thing to store
 * beside a UTC column. Feed it the offset of the place it describes and it
 * becomes an instant that can be subtracted from `occurred_at`.
 */
export function localToInstant(naive, offset) {
  if (!naive) return null;
  const t = Date.parse(naive.length <= 16 ? naive + ":00Z" : naive + "Z");
  if (Number.isNaN(t)) return null;
  return new Date(t - tzMinutes(offset) * 60000).toISOString();
}

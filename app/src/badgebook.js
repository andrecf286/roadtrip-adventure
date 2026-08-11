/**
 * The badge book — every family badge as a printable page.
 *
 * Amelia is making a welcome-home gift, one spread per badge, and until now
 * the only way to get the material out was to open each badge in desktop
 * Safari and save the picture by hand, then re-type the note underneath. This
 * is that job, done once, as a page she can print.
 *
 * It is deliberately ONE self-contained HTML file with every image inlined as
 * a data: URL. Not a zip (nothing to unpack, and the notes would end up in a
 * second file nobody opens beside the pictures they belong to); not a
 * server-rendered PDF (a Worker has no typesetter, and Safari's Print → Save
 * as PDF is a better one than anything worth bundling). Save it, open it, and
 * every picture is still there with no session and no signal — which matters,
 * because a keepsake that stops working when a cookie expires is not a
 * keepsake.
 *
 * Scope is the BESPOKE badges: the ones the family invented and awarded each
 * other over iMessage. The state, park, miles and tank walls are derived from
 * the trip rather than given by a person, and the park posters are somebody
 * else's illustrations under a credit line that reads oddly in a printed gift.
 * If those are wanted later they are a second section, not a widened query.
 */

import { tzMinutes } from "./tz.js";

/** Escape for HTML text and attribute contexts. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* R2 hands back an ArrayBuffer; btoa wants a binary string. Chunked because
   String.fromCharCode.apply throws RangeError on a big enough spread, and
   "big enough" is well under the size of a photograph. */
function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/* "August 8, 2026" from an ISO instant, read in the trip's own zone rather
   than UTC — a badge awarded at 9pm Mountain is not the next day's badge. */
function longDate(iso, offsetMin) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + offsetMin * 60000);
  if (isNaN(d.getTime())) return "";
  const M = ["January","February","March","April","May","June","July",
             "August","September","October","November","December"];
  return M[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}

const PAGE_CSS = `
:root{--ink:#14110e;--ink-2:#57514a;--ink-3:#8b837a;--paper:#fbf9f6;
      --line:#e7e0d7;--road:#c8621f}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#efe9e1;color:var(--ink);
  font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.page{background:var(--paper);width:7.3in;min-height:9.8in;margin:22px auto;
  padding:0.72in 0.8in;display:flex;flex-direction:column;align-items:center;
  text-align:center;box-shadow:0 2px 14px rgba(0,0,0,.13);border-radius:3px}
.cover{justify-content:center}
.cover h1{font-size:44px;line-height:1.08;margin:0 0 6px;letter-spacing:-.5px}
.cover .who{font-size:20px;color:var(--road);font-weight:640;margin:0 0 30px}
.cover .rule{width:96px;height:3px;background:var(--road);border-radius:2px;margin:0 0 30px}
.cover p{color:var(--ink-2);font-size:16px;margin:0 0 10px;max-width:26em}
.cover .count{font-size:19px;color:var(--ink);font-weight:600}
.medal{width:4.6in;height:auto;max-height:4.6in;object-fit:contain;
  margin:0.15in 0 0.34in;display:block}
.noart{width:4.6in;height:4.6in;border:3px dashed var(--line);border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:74px;
  margin:0.15in 0 0.34in;color:var(--ink-3)}
h2{font-size:30px;line-height:1.16;margin:0 0 4px;letter-spacing:-.4px}
.glyph{font-size:30px;line-height:1;margin:0 0 14px}
.note{font-size:17px;line-height:1.62;color:var(--ink-2);max-width:22em;
  margin:0 0 auto;font-style:italic}
.note:before{content:"\\201C"}
.note:after{content:"\\201D"}
.foot{margin-top:auto;padding-top:26px;color:var(--ink-3);font-size:14px;
  border-top:1px solid var(--line);width:100%}
.foot b{color:var(--ink-2);font-weight:640}
.hint{max-width:7.3in;margin:26px auto 0;padding:0 0.8in 30px;
  color:#6d655c;font-size:14px;line-height:1.6}
@media print{
  html,body{background:#fff}
  .hint{display:none}
  .page{width:auto;min-height:0;height:auto;margin:0;padding:0.45in 0.55in;
    box-shadow:none;border-radius:0;break-after:page;page-break-after:always;
    display:flex;justify-content:flex-start}
  .page:last-of-type{break-after:auto;page-break-after:auto}
  .medal{width:4.3in;max-height:4.3in}
  .noart{width:4.3in;height:4.3in}
  /* The medallions are the whole point and they carry their own background;
     a browser that helpfully drops backgrounds prints sixteen white circles. */
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@page{size:letter portrait;margin:0.35in}
`;

/**
 * GET /badge-book — the whole set as one printable document. The caller has
 * already been gated in index.js; this builds the bytes.
 *
 * A read, and every one of the six can take it: the badge economy is the one
 * thing the viewers own, and Amelia — who awarded most of these — is a viewer.
 * A hidden guest cannot, and that is a capability judgment rather than a
 * visibility one: nothing here is secret from someone already holding a
 * session, but handing a short-term guest a one-click archive of the family's
 * private artwork and their notes to each other is a different act from
 * letting her look at the wall.
 */
export async function badgeBook(env, tripOffsetMin) {
  const rows = await env.roadtrip.prepare(
    `SELECT b.title, b.emoji, b.note, b.created_at, b.image_key, b.tz_offset,
            COALESCE(p.name, b.awarded_by) AS awarded_by_name
       FROM badge b LEFT JOIN person p ON p.id = b.awarded_by
      ORDER BY b.created_at`).all();
  const badges = rows.results || [];

  /* Each badge prints in the zone of whoever awarded it — three of the six do
     so from Ohio while the car is two zones west, and a badge given at 12:30am
     EDT is not the previous day's badge. NULL for everything awarded before
     the column existed, which falls back to the trip's own offset. */
  const zoneOf = (b) => (b.tz_offset ? tzMinutes(b.tz_offset) : tripOffsetMin);

  const dates = badges.map((b) => longDate(b.created_at, zoneOf(b))).filter(Boolean);
  const span = dates.length
    ? (dates[0] === dates[dates.length - 1]
        ? dates[0] : dates[0] + " &ndash; " + dates[dates.length - 1])
    : "";

  const head = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Badges &mdash; Ada &amp; Lily's Roadtrip Adventure</title>
<style>${PAGE_CSS}</style></head>
<body>
<section class="page cover">
  <h1>The Badges</h1>
  <p class="who">Ada &amp; Lily&rsquo;s Roadtrip Adventure</p>
  <div class="rule"></div>
  <p class="count">${badges.length} badge${badges.length === 1 ? "" : "s"}</p>
  ${span ? `<p>${span}</p>` : ""}
  <p>Invented, drawn and awarded by the people who were following along.</p>
</section>
`;

  const tail = `<p class="hint"><b>To make the book:</b> File &rarr; Print, then
    &ldquo;Save as PDF&rdquo;. Each badge is already its own page. Every picture
    is inside this one file, so it keeps working after you save it &mdash; no
    signal and no sign-in needed. To pull a single badge out as its own image,
    right-click it and choose Save Image.</p>
</body></html>`;

  /* STREAMED, one badge at a time, and that is a memory decision rather than a
     latency one. The first cut fetched every object with Promise.all and then
     built the whole document as a string: every ArrayBuffer, every base64
     string and three copies of the finished HTML were all resident at once.
     Sixteen badges is ~25MB of heap that way; fifty is ~85MB against a 128MB
     limit that is PER ISOLATE, not per request — so two people tapping the
     button at the same moment could have taken out unrelated requests from the
     rest of the family. Sequentially, only one image is in hand at a time and
     the ceiling stops moving with the badge count. A cap would have been the
     other answer, and the wrong one: a keepsake that silently stops at badge
     forty is worse than one that takes an extra second. */
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(enc.encode(head));
        for (const b of badges) {
          let src = null;
          /* Belt and braces on the key even though `image_key` is only ever
             written by uploadBadge as badges/<safeId>.jpg: this is the second
             reader of the bucket, and servePhoto's allowlist protecting only
             the first is the shape of problem worth not having twice. */
          if (b.image_key && /^badges\/[A-Za-z0-9_-]{1,64}\.jpg$/.test(b.image_key)) {
            try {
              const obj = await env.PHOTOS.get(b.image_key);
              if (obj) {
                const buf = await obj.arrayBuffer();
                /* A zero-byte object is a truthy data: URL and paints a broken
                   image icon — worse than the dashed ring, and in a keepsake.
                   An interrupted put leaves exactly that behind. */
                if (buf.byteLength > 0) {
                  const type = obj.httpMetadata?.contentType || "image/jpeg";
                  src = "data:" + type + ";base64," + b64(buf);
                }
              }
            } catch { /* fall through to the ring */ }
          }
          const img = src
            ? `<img class="medal" src="${src}" alt="${esc(b.title)}">`
            : `<div class="noart">${esc(b.emoji || "\u2726")}</div>`;
          /* The emoji rides under the title only when the artwork carried the
             day; in the no-art case it is already inside the ring above. */
          const glyph = b.emoji && src ? `<p class="glyph">${esc(b.emoji)}</p>` : "";
          const note = b.note ? `<p class="note">${esc(b.note)}</p>` : "";
          const when = longDate(b.created_at, zoneOf(b));
          controller.enqueue(enc.encode(`<section class="page">
  ${img}
  <h2>${esc(b.title)}</h2>
  ${glyph}
  ${note}
  <p class="foot">Awarded by <b>${esc(b.awarded_by_name)}</b>${when ? " &middot; " + when : ""}</p>
</section>
`));
        }
        controller.enqueue(enc.encode(tail));
        controller.close();
      } catch (e) {
        /* The document is already partly on the wire, so there is no status
           code left to change. Close the markup honestly instead of leaving a
           truncated page that looks like the book simply ends. */
        try {
          controller.enqueue(enc.encode(
            `<p class="hint">Something went wrong partway through and the rest of
             the badges are missing from this file. Try again &mdash; nothing is
             lost, the book is built fresh each time.</p>\n</body></html>`));
        } catch { /* controller already dead */ }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      /* Named so the file makes sense in a Downloads folder a year from now,
         and inline rather than attachment so a tap opens it instead of
         silently landing somewhere she has to go find. */
      "content-disposition": 'inline; filename="roadtrip-badges.html"',
      "cache-control": "no-store",
    },
  });
}

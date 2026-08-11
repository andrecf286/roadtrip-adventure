/**
 * The badge export — every badge as a file she can keep.
 *
 * Amelia is making a welcome-home gift and until now the only way to get the
 * material out was to open each badge in desktop Safari, save the picture by
 * hand, and re-type the note underneath. Two doors, one generator:
 *
 *   GET /badges.zip   the export. Every image as its own named file, a CSV of
 *                     all the words, the credits, and an index page. This is
 *                     the one the button points at.
 *   GET /badge-book   the same index page on its own, images inlined, for
 *                     looking at or printing without downloading anything.
 *
 * Two kinds of badge, and they are different in kind rather than in degree.
 * The FAMILY badges were invented and drawn and awarded by the six of them
 * over iMessage — those carry a note in somebody's own words and the name of
 * whoever gave it. The PARK posters are Anderson Design Group's illustrations,
 * one per park on the itinerary, and what they carry is a credit and the date
 * the girls first got there. The index page records the parks they actually
 * reached; the archive carries all thirteen posters either way, because the
 * artwork is the material and the trip is not over.
 *
 * The archive's index links its images as sibling files rather than inlining
 * them, so it is small and everything still works once the zip is unpacked.
 * The standalone page inlines them instead, so a saved copy survives with no
 * session and no signal. Same document, two image strategies — the alternative
 * was two templates that drift.
 */

import { tzMinutes } from "./tz.js";
import { zipStream, safeName, uniqueName } from "./zip.js";

/** Escape for HTML text and attribute contexts. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* R2 hands back an ArrayBuffer; btoa wants a binary string. Chunked because
   String.fromCharCode.apply throws RangeError on a big enough spread, and
   "big enough" is well under the size of a photograph. */
function b64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

const MONTHS = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];

/* "August 8, 2026" from an ISO instant, read in the zone of whoever made it. */
function longDate(iso, offsetMin) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + offsetMin * 60000);
  if (isNaN(d.getTime())) return "";
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
}

/* A plain YYYY-MM-DD, which is what a first_date already is — no instant, no
   zone, so it must NOT be pushed through longDate and shifted a day. */
function longDay(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  return m ? MONTHS[Number(m[2]) - 1] + " " + Number(m[3]) + ", " + m[1] : "";
}

/* Only badges/<id>.jpg and parkbadges/<slug>.jpg are ever written to this
   bucket by the app. servePhoto has an allowlist; this is the second reader of
   the same bucket and one guarded reader is the shape of problem worth not
   having twice. */
const KEY_OK = /^(badges|parkbadges)\/[A-Za-z0-9_.-]{1,80}\.jpg$/;

/** Bytes for one image key, or null for anything missing, empty or refused. */
async function imageBytes(env, key) {
  if (!key || !KEY_OK.test(key)) return null;
  try {
    const obj = await env.PHOTOS.get(key);
    if (!obj) return null;
    const buf = new Uint8Array(await obj.arrayBuffer());
    /* A zero-byte object is a TRUTHY data: URL and paints a broken-image icon,
       which is worse than the fallback it would otherwise get. An interrupted
       put leaves exactly that behind. */
    return buf.length ? buf : null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ data */

async function collect(env, tripOffsetMin, firstVisitDates) {
  const [badgeRows, parkRows, firstVisit] = await Promise.all([
    env.roadtrip.prepare(
      `SELECT b.title, b.emoji, b.note, b.created_at, b.image_key, b.tz_offset,
              COALESCE(p.name, b.awarded_by) AS awarded_by_name
         FROM badge b LEFT JOIN person p ON p.id = b.awarded_by
        ORDER BY b.created_at`).all(),
    /* Driven by the ITINERARY, not by the artwork — the same list the badge
       wall greys its unreached posters from. park_badge is filled in one park
       at a time as Andy supplies illustrations, so driving off it made the
       denominator count posters ("3 of 9 reached") and, worse, dropped a park
       the girls had actually reached because nobody had added its picture yet.
       LEFT JOIN, so a park with no poster still gets its page and its row. */
    env.roadtrip.prepare(
      `SELECT i.id AS intention_id, i.name AS park_name, i.seq,
              pb.r2_key, pb.credit
         FROM intention i
         LEFT JOIN park_badge pb ON pb.park_name = i.name
        WHERE i.kind = 'park' AND i.dropped = 0
        ORDER BY COALESCE(i.seq, 9999), i.name`).all(),
    /* Where they have actually been, derived from the car's own breadcrumbs —
       the same map the badge wall greys its unvisited posters with. Injected
       rather than imported so this module does not reach back into api.js and
       make a cycle out of it. */
    firstVisitDates(env),
  ]);

  /* Each badge prints in the zone of whoever awarded it — three of the six do
     so from Ohio while the car is two zones west, and a badge given at 12:30am
     EDT is not the previous day's badge. NULL for everything awarded before
     the column existed, which falls back to the trip's own offset. */
  const badges = (badgeRows.results || []).map((b, i) => ({
    ...b,
    n: i + 1,
    when: longDate(b.created_at, b.tz_offset ? tzMinutes(b.tz_offset) : tripOffsetMin),
  }));

  const parks = (parkRows.results || []).map((p) => ({
    ...p, first_date: p.intention_id ? (firstVisit[p.intention_id] ?? null) : null,
  }));

  return { badges, parks };
}

/* --------------------------------------------------------------- the page */

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
.poster{width:3.9in;height:auto;max-height:5.2in;object-fit:contain;
  margin:0.15in 0 0.34in;display:block;box-shadow:0 1px 8px rgba(0,0,0,.16)}
.noart{width:4.6in;height:4.6in;border:3px dashed var(--line);border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:74px;
  margin:0.15in 0 0.34in;color:var(--ink-3)}
h2{font-size:30px;line-height:1.16;margin:0 0 4px;letter-spacing:-.4px}
.glyph{font-size:30px;line-height:1;margin:0 0 14px}
.note{font-size:17px;line-height:1.62;color:var(--ink-2);max-width:22em;
  margin:0 0 auto;font-style:italic}
/* The curly quotes belong ONLY to the family notes, which really are somebody
   speaking. A park page uses .fact for the same shape without them — the first
   version put "First there on August 5, 2026." in quotation marks and it read
   as though the app were quoting a person who never said it. */
.note:before{content:"\\201C"}
.note:after{content:"\\201D"}
.fact{font-size:17px;line-height:1.62;color:var(--ink-2);max-width:22em;
  margin:0 0 auto}
.foot{margin-top:auto;padding-top:26px;color:var(--ink-3);font-size:14px;
  border-top:1px solid var(--line);width:100%}
.foot b{color:var(--ink-2);font-weight:640}
.divider{background:var(--paper);width:7.3in;margin:22px auto;padding:0.5in 0.8in;
  text-align:center;box-shadow:0 2px 14px rgba(0,0,0,.13);border-radius:3px}
.divider h2{margin:0 0 6px}
.divider p{color:var(--ink-2);margin:0;font-size:15px}
.hint{max-width:7.3in;margin:26px auto 0;padding:0 0.8in 30px;
  color:#6d655c;font-size:14px;line-height:1.6}
@media print{
  html,body{background:#fff}
  .hint{display:none}
  .page,.divider{width:auto;min-height:0;height:auto;margin:0;padding:0.45in 0.55in;
    box-shadow:none;border-radius:0;break-after:page;page-break-after:always}
  .page{display:flex;justify-content:flex-start}
  .page:last-of-type{break-after:auto;page-break-after:auto}
  .medal{width:4.3in;max-height:4.3in}
  .poster{width:3.6in;max-height:4.9in}
  .noart{width:4.3in;height:4.3in}
  /* The artwork is the whole point and it carries its own background; a
     browser that helpfully drops backgrounds prints white rectangles. */
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@page{size:letter portrait;margin:0.35in}
`;

/**
 * The index page, streamed.
 *
 * `srcFor(kind, item)` resolves an image to whatever the caller wants in the
 * `src` attribute: a data: URL for the standalone page, a sibling path for the
 * copy that rides inside the archive. It returns null when there is no usable
 * artwork and the page falls back accordingly.
 */
function pageStream(data, srcFor, standalone, strict) {
  const { badges, parks } = data;
  const visited = parks.filter((p) => p.first_date);
  const dates = badges.map((b) => b.when).filter(Boolean);
  const span = dates.length
    ? (dates[0] === dates[dates.length - 1]
        ? dates[0] : dates[0] + " &ndash; " + dates[dates.length - 1])
    : "";

  async function* chunks() {
    yield `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Badges &mdash; Ada &amp; Lily's Roadtrip Adventure</title>
<style>${PAGE_CSS}</style></head>
<body>
<section class="page cover">
  <h1>The Badges</h1>
  <p class="who">Ada &amp; Lily&rsquo;s Roadtrip Adventure</p>
  <div class="rule"></div>
  <p class="count">${badges.length} from the family${
    visited.length ? ` &middot; ${visited.length} national park${visited.length === 1 ? "" : "s"}` : ""}</p>
  ${span ? `<p>${span}</p>` : ""}
  <p>Invented, drawn and awarded by the people who were following along.</p>
</section>
`;

    if (badges.length) {
      yield `<section class="divider"><h2>From the family</h2>
  <p>Made up as they went, and awarded by whoever thought of them.</p></section>
`;
    }
    for (const b of badges) {
      const src = await srcFor("badge", b);
      const img = src
        ? `<img class="medal" src="${esc(src)}" alt="${esc(b.title)}">`
        : `<div class="noart">${esc(b.emoji || "\u2726")}</div>`;
      /* The emoji rides under the title only when the artwork carried the day;
         in the no-art case it is already inside the ring above. */
      const glyph = b.emoji && src ? `<p class="glyph">${esc(b.emoji)}</p>` : "";
      yield `<section class="page">
  ${img}
  <h2>${esc(b.title)}</h2>
  ${glyph}
  ${b.note ? `<p class="note">${esc(b.note)}</p>` : ""}
  <p class="foot">Awarded by <b>${esc(b.awarded_by_name)}</b>${
    b.when ? " &middot; " + esc(b.when) : ""}</p>
</section>
`;
    }

    /* Only the parks they actually reached. The archive carries every poster
       regardless — the artwork is the material — but this document is a record
       of the trip, and a page for a park nobody has seen yet would be a claim
       about the future. It grows on its own as they get there. */
    if (visited.length) {
      yield `<section class="divider"><h2>National parks</h2>
  <p>${visited.length} of ${parks.length} reached so far.</p></section>
`;
      for (const p of visited) {
        const src = await srcFor("park", p);
        const img = src
          ? `<img class="poster" src="${esc(src)}" alt="${esc(p.park_name)}">`
          : `<div class="noart">&#127957;</div>`;
        yield `<section class="page">
  ${img}
  <h2>${esc(p.park_name)}</h2>
  <p class="fact">First there on ${esc(longDay(p.first_date))}.</p>
  <p class="foot">Poster artwork &middot; <b>${esc(p.credit || "credit unrecorded")}</b></p>
</section>
`;
      }
    }

    yield standalone
      ? `<p class="hint"><b>To print this:</b> File &rarr; Print, then
    &ldquo;Save as PDF&rdquo;. Every badge is already its own page, and every
    picture is inside this one file, so it keeps working after you save it
    &mdash; no signal and no sign-in needed. To pull one badge out as its own
    image, right-click it and choose Save Image. <b>To get the images as
    separate files</b>, use the download button on the Badges screen instead.</p>
`
      : `<p class="hint">Every picture in here is also a separate file in this
    folder &mdash; <b>Family badges</b> and <b>Park posters</b> &mdash; and
    <b>badges.csv</b> has all the words in a spreadsheet, if you are putting
    this together somewhere else. Keep this page beside those folders and it
    will keep working.</p>
`;
    yield `</body></html>`;
  }

  /* pull(), never start(). enqueue() does not block and the stream's queue is
     unbounded, so producing everything inside start() buffers the whole
     document in memory however slowly the client reads — which is precisely
     what the streaming was for, and the first version of this got it wrong
     while carrying a comment saying otherwise (measured: 29 images, ~70MB
     resident, body unread). */
  const it = chunks();
  const enc = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) { controller.close(); return; }
        controller.enqueue(enc.encode(value));
      } catch (e) {
        /* Inside the archive the caller wants the failure: an apology sealed
           into an otherwise valid zip reports nothing to anybody. On the
           standalone page the headers have already gone out and there is no
           status left to change, so close the markup honestly instead. */
        if (strict) { controller.error(e); return; }
        try {
          controller.enqueue(enc.encode(
            `<p class="hint">Something went wrong partway through and the rest is
             missing. Try again &mdash; nothing is lost, this is built fresh each
             time.</p>\n</body></html>`));
        } catch { /* controller already dead */ }
        controller.close();
      }
    },
    async cancel(reason) { await it.return?.(reason); },
  });
}

/* ------------------------------------------------------------ the page route */

/**
 * GET /badge-book — the index page on its own, every image inlined.
 *
 * Streamed one image at a time. Building it as a string first meant every
 * ArrayBuffer, every base64 string and three copies of the document resident
 * at once — fine at sixteen badges, ~85MB at fifty, against a 128MB limit that
 * is per ISOLATE rather than per request. Sequentially the ceiling stops moving
 * with the badge count.
 */
export async function badgeBook(env, tripOffsetMin, firstVisitDates) {
  const data = await collect(env, tripOffsetMin, firstVisitDates);
  const srcFor = async (kind, item) => {
    const bytes = await imageBytes(env, kind === "badge" ? item.image_key : item.r2_key);
    return bytes ? "data:image/jpeg;base64," + b64(bytes) : null;
  };
  return new Response(pageStream(data, srcFor, true, false), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": 'inline; filename="roadtrip-badges.html"',
      "cache-control": "no-store",
    },
  });
}

/* ---------------------------------------------------------- the zip route */

function csvCell(v) {
  const s = String(v == null ? "" : v);
  /* A leading =, +, - or @ is executed as a formula by Excel and Sheets when
     the file is opened. These cells are user-authored badge titles and notes,
     so the guard is not theoretical — prefix with a single quote, which both
     treat as "this is text". */
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function csvFor(data, written) {
  const rows = [["kind", "n", "title", "note", "awarded_by", "date", "credit", "file"]];
  for (const b of data.badges) {
    rows.push(["family badge", b.n, b.title, b.note || "", b.awarded_by_name, b.when, "",
               written.get("badge:" + b.n) || ""]);
  }
  for (const p of data.parks) {
    rows.push(["national park", "", p.park_name, "", "",
               p.first_date ? longDay(p.first_date) : "not yet",
               p.credit || "", written.get("park:" + p.intention_id) || ""]);
  }
  /* A BOM, because the one thing certain about this file is that it will be
     opened in Excel, and Excel reads a UTF-8 CSV as Latin-1 without one —
     which turns every apostrophe in a badge note into mojibake. */
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const badgeFile = (b) =>
  String(b.n).padStart(2, "0") + " - " + safeName(b.title, "badge") + ".jpg";
const parkFile = (p) => safeName(p.park_name, "park") + ".jpg";

/* A path inside the archive is a FILENAME to the zip and a URL to the index
   page that links it. Every segment gets encoded for the second job — spaces,
   commas, ampersands and anything else a title can legally contain. `#` and
   `%` are stripped upstream in safeName rather than encoded, because they
   would otherwise round-trip into a name nobody can match by eye. */
const asUrl = (path) => path.split("/").map(encodeURIComponent).join("/");

/**
 * GET /badges.zip — the export.
 *
 * Everything, as files: the artwork one image per badge under two named
 * folders, the words as a CSV, the credits as their own note, and the index
 * page so the pictures still have their stories attached. Streamed entry by
 * entry, so the memory ceiling is one image regardless of how many there are.
 */
export async function badgesZip(env, tripOffsetMin, firstVisitDates) {
  const data = await collect(env, tripOffsetMin, firstVisitDates);
  const stamp = new Date();

  async function* entries() {
    /* The pictures go in FIRST, and the index and the CSV are written last from
       a manifest of what actually landed. The first version decided a filename
       from the database row and emitted the index before fetching anything, so
       a badge whose R2 object was missing or zero-length got a page and a CSV
       row pointing at a file that was never in the archive — the broken-image
       icon that imageBytes() exists to prevent, reintroduced one layer up. Now
       nothing can be named that is not present. */
    const taken = new Set();
    const written = new Map();

    for (const b of data.badges) {
      const bytes = await imageBytes(env, b.image_key);
      if (!bytes) continue;
      const name = uniqueName("Family badges/" + badgeFile(b), taken);
      written.set("badge:" + b.n, name);
      yield { name, bytes, date: b.created_at ? new Date(b.created_at) : stamp };
    }
    /* ALL the posters, including parks not yet reached — unlike the index page,
       which records only where they have been. The artwork is the material she
       is working with and the trip is not over. */
    for (const p of data.parks) {
      const bytes = await imageBytes(env, p.r2_key);
      if (!bytes) continue;
      const name = uniqueName("Park posters/" + parkFile(p), taken);
      written.set("park:" + p.intention_id, name);
      yield { name, bytes, date: stamp };
    }

    const srcFor = async (kind, item) => {
      const name = written.get(kind === "badge" ? "badge:" + item.n : "park:" + item.intention_id);
      return name ? asUrl(name) : null;
    };
    /* strict: a failure here must NOT be swallowed into an apology paragraph
       and sealed inside an otherwise perfectly valid archive that reports no
       error at all. Let it throw; zipStream errors the response and the browser
       reports a truncated download. */
    const html = await new Response(pageStream(data, srcFor, false, true)).text();
    const encoder = new TextEncoder();
    yield { name: "Ada and Lily's badges.html", bytes: encoder.encode(html), date: stamp };
    yield { name: "badges.csv", bytes: encoder.encode(csvFor(data, written)), date: stamp };

    const credits = data.parks
      .filter((p) => written.has("park:" + p.intention_id))
      .map((p) => `${p.park_name}: ${p.credit || "credit unrecorded"}`).join("\n");
    yield {
      name: "credits.txt",
      bytes: encoder.encode(
`The national park posters in this archive are somebody else's illustrations.
They are here for a family keepsake and are not cleared for anything public.
Please keep the credit with the picture wherever it ends up.

${credits}

The family badges were made by the six of us. badges.csv says who made which.
`),
      date: stamp,
    };
  }

  return new Response(zipStream(entries()), {
    headers: {
      "content-type": "application/zip",
      /* attachment, unlike the page: this one is meant to land in Downloads. */
      "content-disposition": 'attachment; filename="Ada and Lily badges.zip"',
      "cache-control": "no-store",
    },
  });
}

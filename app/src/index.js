/**
 * Roadtrip Adventure — the app the six of them actually open.
 *
 * Serves one HTML shell plus a JSON API. Deliberately no framework and no build
 * step: six users, seven screens, and a phone on campground wifi. A bundler
 * would buy nothing here and cost startup time exactly where it hurts.
 */

import { currentPerson, mintToken, readToken, sessionCookie } from "./auth.js";
import { SHELL } from "./shell.js";
import * as api from "./api.js";
import { TITLE_FONT_B64 } from "./font_title.js";
import { STATE_ARCS } from "./geo.js";
import { STATE_ARCS_FINE } from "./geo_fine.js";

const json = (o, s = 200) =>
  // no-store on EVERY response from this file. /api/version and /api/me are
  // served from here rather than api.js's json(), and the omission meant the
  // version endpoint was the only reply in the app with no cache directive at
  // all — so a phone could cache {v:<old>} and poll a URL it never re-fetched
  // for the rest of the trip. That is the "some phones don't update" bug: the
  // update check itself was being served from cache.
  new Response(JSON.stringify(o), { status: s, headers: {
    "content-type": "application/json", "cache-control": "no-store" } });

/* Version = hash of the shell actually being served. Zero maintenance: a
   deploy changes the shell, the hash changes, open phones notice on their
   next version check and offer a one-tap refresh — no more "close the
   website and reopen it" texts. */
let SHELL_HASH = null;
async function shellVersion() {
  if (!SHELL_HASH) {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SHELL));
    SHELL_HASH = [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return SHELL_HASH;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (!env.SESSION_SECRET) return new Response("SESSION_SECRET not set", { status: 500 });

    /* -- follow a magic link: verify, drop a 120-day cookie, land on Today -- */
    if (path.startsWith("/a/")) {
      const token = path.slice(3);
      const personId = await readToken(env.SESSION_SECRET, token);
      if (!personId) {
        return new Response(expiredPage(), { status: 401, headers: { "content-type": "text/html" } });
      }
      return new Response(null, {
        status: 302,
        headers: { location: "/", "set-cookie": sessionCookie(token) },
      });
    }

    /* -- one-time out-of-band link distribution; Andy sends these by text -- */
    if (path === "/mint") {
      if (!env.MINT_SECRET || url.searchParams.get("k") !== env.MINT_SECRET) {
        return new Response("nope", { status: 404 });
      }
      const people = await env.roadtrip
        .prepare("SELECT id, name, role, email FROM person ORDER BY role DESC, name").all();
      const links = [];
      for (const p of people.results) {
        links.push({ ...p, link: `${url.origin}/a/${await mintToken(env.SESSION_SECRET, p.id)}` });
      }
      return json({ expires_days: 120, links });
    }

    if (path === "/health") return json({ ok: true, service: "roadtrip-app" });

    // Static and never changes. Cached hard so a phone fetches the outlines
    // once for the whole trip instead of on every visit to the map.
    if (path === "/geo/states-fine.json") {
      return new Response(JSON.stringify(STATE_ARCS_FINE), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    // The title face. Public (no session gate) because it is a font, and
    // immutable because the bytes never change under this URL.
    if (path === "/font/title.woff2") {
      const bin = Uint8Array.from(atob(TITLE_FONT_B64), (c) => c.charCodeAt(0));
      return new Response(bin, { headers: {
        "content-type": "font/woff2",
        "cache-control": "public, max-age=31536000, immutable" } });
    }
    if (path === "/geo/states.json") {
      return new Response(JSON.stringify(STATE_ARCS), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    /* --------------------------- everything below needs a session -------- */
    const person = await currentPerson(request, env);

    /* Photo bytes and the multipart upload live OUTSIDE the JSON-body parse:
       reading request.json() would consume the multipart stream. */
    if (path.startsWith("/photo/")) {
      if (!person) return json({ error: "unauthorized" }, 401);
      return api.servePhoto(env, path);
    }
    if (path === "/api/photo/upload") {
      if (!person) return json({ error: "unauthorized" }, 401);
      return api.uploadPhoto(env, person, request);
    }
    // Server-to-server ingest (Mac iMessage puller; later, inbound email).
    // Secret-gated, names its own author — no session cookie involved.
    if (path === "/api/ingest/photo") {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      return api.ingestPhoto(env, request);
    }
    // Positions from anything that is not the car's own tracker: the inReach
    // poller, a native companion, or Andy by hand. Same secret-gated door.
    if (path === "/api/ingest/position") {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);
      return api.ingestPosition(env, request);
    }
    if (path === "/api/badge/upload") {
      if (!person) return json({ error: "unauthorized" }, 401);
      return api.uploadBadge(env, person, request);
    }

    if (path.startsWith("/api/")) {
      if (!person) return json({ error: "unauthorized" }, 401);
      const body = ["POST", "PATCH", "DELETE"].includes(request.method)
        ? await request.json().catch(() => ({})) : {};

      switch (path) {
        case "/api/me":          return json(person);
        case "/api/version":     return json({ v: await shellVersion() });
        case "/api/today":       return api.today(env);
        case "/api/trip":        return api.trip(env);
        case "/api/day":         return api.day(env, url.searchParams.get("date"), person);
        case "/api/place":       return api.place(env, url.searchParams.get("id"));
        case "/api/places":      return api.places(env);
        case "/api/journal-feed": return api.journal(env, person);
        case "/api/photos":      return api.photos(env);
        case "/api/reservation": return api.reservation(env, url.searchParams.get("id"));
        case "/api/map":         return api.map(env, person);
        case "/api/track":       return api.track(env, url.searchParams);
        case "/api/stop":
          if (request.method === "DELETE") return api.deleteStop(env, person, body);
          return request.method === "PATCH"
            ? api.updateStop(env, person, body)
            : api.createStop(env, person, body, ctx);
        case "/api/journal":
          return request.method === "DELETE"
            ? api.deleteJournal(env, person, body)
            : api.createJournal(env, person, body);
        case "/api/activity":    return api.toggleActivity(env, person, body);
        case "/api/visit":       return api.linkDayPlace(env, person, body, request.method);
        case "/api/badges":      return api.badges(env);
        case "/api/badge-detail": return api.badgeDetail(env, url.searchParams.get("kind"), url.searchParams.get("key"));
        case "/api/people":      return api.people(env);
        case "/api/photo":
          if (request.method === "DELETE") return api.deletePhoto(env, person, body);
          if (request.method === "PATCH")  return api.updatePhoto(env, person, body);
          return json({ error: "use /api/photo/upload" }, 400);
        case "/api/badge":
          if (request.method === "DELETE") return api.deleteBadge(env, person, body);
          if (request.method === "PATCH")  return api.updateBadge(env, person, body);
          return api.createBadge(env, person, body);
        default:                 return json({ error: "not found" }, 404);
      }
    }

    if (!person) {
      return new Response(signedOutPage(), { status: 401, headers: { "content-type": "text/html" } });
    }

    // The shell is stamped with its own hash. It used to adopt whatever the
    // first successful poll returned, so a phone that booted with no signal
    // seeded itself from the NEXT deploy and believed stale code was current.
    return new Response(SHELL.replace("__APPV__", await shellVersion()), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  },
};

const PLAIN = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>body{font:17px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;background:#fbf9f6;color:#14110e;
margin:0;display:grid;place-items:center;min-height:100dvh;padding:32px;text-align:center}
div{max-width:20rem}h1{font-size:22px;margin:0 0 8px}p{color:#57514a;margin:0}</style>`;

const signedOutPage = () => `${PLAIN}<div><h1>Roadtrip Adventure</h1>
<p>This is a private trip journal. Open it using the link you were sent.</p></div>`;

const expiredPage = () => `${PLAIN}<div><h1>That link has expired</h1>
<p>Ask Andy for a fresh one — they last 120 days.</p></div>`;

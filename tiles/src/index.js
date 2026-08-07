/**
 * roadtrip-tiles — vector tile server backed by a .pmtiles archive in R2.
 *
 * GET /corridor/{z}/{x}/{y}.mvt   tile from the basemap archive named by BASEMAP
 *                                 below (decompressed; the platform re-compresses
 *                                 on the wire). The path name is a fossil — see BASEMAP.
 * GET /style.json                 MapLibre style (stored as an R2 object)
 * GET /fonts/{stack}/{range}.pbf  self-hosted glyphs (R2: fonts/...)
 * GET /sprites/*                  self-hosted sprite sheet (R2: sprites/...)
 * GET /lib/*                      self-hosted maplibre-gl assets (R2: lib/...)
 *
 * Upload path (multipart, because wrangler caps direct puts at 300 MiB):
 * POST /u/create?key=K            -> {uploadId}
 * PUT  /u/part?key=K&id=I&part=N  body = part bytes -> {etag}
 * POST /u/complete?key=K&id=I     body = JSON [{partNumber, etag}...]
 * All /u/* gated by header X-Upload-Key: $UPLOAD_SECRET. The secret exists so
 * a leaked URL cannot overwrite the archive; rotate or unset it to close the
 * path entirely once uploads are done.
 */

import { PMTiles } from "pmtiles";

const ALLOWED_ORIGIN = "https://roadtripadventure.app";

/**
 * The archive the /corridor/ route reads.
 *
 * It is not a corridor any more. It was: a 30 km ribbon along the OSRM-routed
 * trip, which was the right trade the day the map shipped — 995 MB instead of
 * nine gigabytes, and no third-party key anywhere in the path. What it cost is
 * measurable and was measured: probing north and south of where the car sat on
 * 2026-08-07, the basemap went blank between ten and twenty miles either side
 * of the road. Anywhere they went that Lily had not routed through — a hot
 * spring somebody mentioned, a hospital, a friend's place, the long way round —
 * the map was empty exactly when they needed to look at it.
 *
 * conus-z14 is the whole lower 48 plus the Vancouver leg (bbox
 * -125.2,24.4,-66.9,50.0), z0-14, 8.95 GB, from the Protomaps 20260807 build.
 *
 * The ROUTE keeps its old name on purpose: style.json names this path, and
 * renaming it would be a restyle rather than an object swap. Bumping the ?v
 * QUERY on that same path is not a restyle — the style's layers, fonts,
 * sprites and rules are byte-identical either way — and it is the only thing
 * that reaches a phone holding an immutable copy.
 */
const BASEMAP = "conus-z14.pmtiles";

/**
 * The cache key for a tile — the archive's name, then the tile's path.
 *
 * Tiles are cached at the edge for a year as `immutable`, and a tile the
 * basemap does not have is cached too, as an empty 204. That is right while
 * the archive is fixed and catastrophic the moment it is not: every tile
 * anybody looked at while the corridor was the map would go on answering
 * "nothing here" for a year after the map got bigger. Verified rather than
 * feared — right after the CONUS archive went live, Missoula rendered and
 * Miami did not, and the only difference between them was that Miami had been
 * probed an hour earlier and Missoula had not.
 *
 * Putting the archive name IN the key means swapping the archive IS the
 * invalidation. Nobody has to remember to purge, and nobody can forget. The
 * PUBLIC url is untouched — this is the Worker's private key.
 *
 * It reaches the EDGE and nothing else. A phone that already holds a tile is
 * holding it under `immutable, max-age=31536000` and no Worker-side key can
 * reach into that; the lever for the phones is the ?v on the style URL in
 * shell.js, which is bumped in the same change. Both are needed. This one
 * without that one fixes the map for new readers and leaves it broken for the
 * six people it was fixed for.
 */
const FALLBACK = "us-z8.pmtiles";

function tileCacheKey(request) {
  const u = new URL(request.url);
  // BOTH archives, because a cached 204 is a statement about both of them and
  // the fallback gets re-cut too. Naming only the primary left the fallback
  // with no invalidation path at all.
  return new Request(u.origin + "/__ck/" + BASEMAP + "+" + FALLBACK + u.pathname,
                     { method: "GET" });
}

class R2Source {
  constructor(env, key) { this.env = env; this.key = key; }
  getKey() { return this.key; }
  async getBytes(offset, length) {
    const obj = await this.env.TILES.get(this.key, { range: { offset, length } });
    if (!obj) throw new Error("archive missing: " + this.key);
    return { data: await obj.arrayBuffer(), etag: obj.etag };
  }
}

// One PMTiles instance per isolate per archive; its internal header/directory
// cache is what makes warm tile reads a single R2 range request.
const ARCHIVES = {};
function archive(env, key) {
  if (!ARCHIVES[key]) ARCHIVES[key] = new PMTiles(new R2Source(env, key));
  return ARCHIVES[key];
}

const cors = {
  "access-control-allow-origin": ALLOWED_ORIGIN,
  "access-control-allow-methods": "GET",
};

function notFound(msg) { return new Response(msg || "not found", { status: 404, headers: cors }); }

async function serveR2(env, key, contentType, request) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const obj = await env.TILES.get(key);
  if (!obj) return notFound();
  const resp = new Response(obj.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=31536000, immutable",
      ...cors,
    },
  });
  await cache.put(request, resp.clone());
  return resp;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    /* ---- tiles ---- */
    let m = path.match(/^\/corridor\/(\d+)\/(\d+)\/(\d+)\.mvt$/);
    if (m && request.method === "GET") {
      const [z, x, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (z > 14) return notFound("z14 max");
      const cache = caches.default;
      const ck = tileCacheKey(request);
      const hit = await cache.match(ck);
      if (hit) return hit;
      let t;
      try {
        t = await archive(env, BASEMAP).getZxy(z, x, y);
        /* Outside the extract's bounding box the low zooms still need
           something, or the fit view gets a bald rectangle where the basemap
           does not reach. A z5 tile covering eastern Canada does not intersect
           the CONUS box and comes back empty; us-z8.pmtiles is 53 MB and
           answers it. Kept deliberately after the CONUS swap — it no longer
           has anything to do with the corridor, it is the edge of the map. */
        if ((!t || !t.data) && z <= 8)
          t = await archive(env, FALLBACK).getZxy(z, x, y);
      }
      catch (e) { return new Response("tile error: " + e.message, { status: 500, headers: cors }); }
      if (!t || !t.data) {
        // Tile the basemap does not have: an empty 204 keeps MapLibre quiet
        // instead of erroring. Keyed by archive, so it expires when the map grows.
        const empty = new Response(null, { status: 204, headers: {
          "cache-control": "public, max-age=31536000, immutable", ...cors } });
        ctx.waitUntil(cache.put(ck, empty.clone()));
        return empty;
      }
      const resp = new Response(t.data, {
        headers: {
          "content-type": "application/vnd.mapbox-vector-tile",
          "cache-control": "public, max-age=31536000, immutable",
          ...cors,
        },
      });
      ctx.waitUntil(cache.put(ck, resp.clone()));
      return resp;
    }

    /* ---- static assets out of the bucket ---- */
    if (request.method === "GET") {
      // Font-stack names contain spaces ("Noto Sans Regular"); MapLibre
      // URL-encodes them, so decode before using the path as an R2 key.
      const key = decodeURIComponent(path.slice(1));
      if (path === "/style.json") return serveR2(env, "style.json", "application/json", request);
      if (path.startsWith("/fonts/") && path.endsWith(".pbf"))
        return serveR2(env, key, "application/x-protobuf", request);
      if (path.startsWith("/sprites/"))
        return serveR2(env, key,
          path.endsWith(".json") ? "application/json" : "image/png", request);
      if (path.startsWith("/lib/"))
        return serveR2(env, key,
          path.endsWith(".css") ? "text/css" : "application/javascript", request);
      if (path === "/health") return new Response("ok", { headers: cors });
    }

    /* ---- gated multipart upload ---- */
    if (path.startsWith("/u/")) {
      if (!env.UPLOAD_SECRET || request.headers.get("x-upload-key") !== env.UPLOAD_SECRET)
        return new Response("forbidden", { status: 403 });
      const key = url.searchParams.get("key");
      if (!key) return new Response("key required", { status: 400 });
      if (path === "/u/put" && request.method === "PUT") {
        // Single-shot small-object upload (fonts, sprites, style, lib).
        const obj = await env.TILES.put(key, request.body);
        return Response.json({ key, size: obj.size });
      }
      if (path === "/u/create" && request.method === "POST") {
        const up = await env.TILES.createMultipartUpload(key);
        return Response.json({ uploadId: up.uploadId });
      }
      if (path === "/u/part" && request.method === "PUT") {
        const up = env.TILES.resumeMultipartUpload(key, url.searchParams.get("id"));
        const part = await up.uploadPart(Number(url.searchParams.get("part")), request.body);
        return Response.json({ partNumber: part.partNumber, etag: part.etag });
      }
      if (path === "/u/complete" && request.method === "POST") {
        const up = env.TILES.resumeMultipartUpload(key, url.searchParams.get("id"));
        const parts = await request.json();
        const obj = await up.complete(parts);
        return Response.json({ key, size: obj.size, etag: obj.httpEtag });
      }
    }

    return notFound();
  },
};

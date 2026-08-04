/**
 * roadtrip-tiles — vector tile server backed by a .pmtiles archive in R2.
 *
 * GET /corridor/{z}/{x}/{y}.mvt   tile from corridor-z14.pmtiles (decompressed;
 *                                 the platform re-compresses on the wire)
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
      const hit = await cache.match(request);
      if (hit) return hit;
      let t;
      try {
        t = await archive(env, "corridor-z14.pmtiles").getZxy(z, x, y);
        // Off-corridor at national zooms: fall back to the US-wide z0-8
        // archive so the fit view has no bald rectangle where the corridor
        // doesn't reach (the "gray box"). Above z8 off-corridor stays empty
        // on purpose — the corridor is the map.
        if ((!t || !t.data) && z <= 8)
          t = await archive(env, "us-z8.pmtiles").getZxy(z, x, y);
      }
      catch (e) { return new Response("tile error: " + e.message, { status: 500, headers: cors }); }
      if (!t || !t.data) {
        // Off-corridor tile: empty 204 keeps MapLibre quiet instead of erroring.
        const empty = new Response(null, { status: 204, headers: {
          "cache-control": "public, max-age=31536000, immutable", ...cors } });
        ctx.waitUntil(cache.put(request, empty.clone()));
        return empty;
      }
      const resp = new Response(t.data, {
        headers: {
          "content-type": "application/vnd.mapbox-vector-tile",
          "cache-control": "public, max-age=31536000, immutable",
          ...cors,
        },
      });
      ctx.waitUntil(cache.put(request, resp.clone()));
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

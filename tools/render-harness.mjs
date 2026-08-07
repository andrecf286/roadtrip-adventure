/* Render harness: serves the LOCAL (modified) shell, proxies /api, /photo,
   /geo, /font to production with a real session cookie, and rewrites the
   tiles host server-side so MapLibre loads. One cookie per role via COOKIE. */
import http from "node:http";
import { SHELL } from "../app/src/shell.js";
const PROD = "https://roadtripadventure.app";
const COOKIE = process.env.COOKIE || "";
const PORT = Number(process.env.PORT || 8791);
const APPV = "harness";
const page = SHELL.replace("__APPV__", APPV)
  .replaceAll("https://tiles.roadtripadventure.app", `http://localhost:${PORT}/__tiles`);
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    if (u.pathname.startsWith("/__tiles/")) {
      const t = await fetch("https://tiles.roadtripadventure.app" + u.pathname.slice(8) + u.search,
        { headers: { "user-agent": "render-harness" } });
      res.writeHead(t.status, { "content-type": t.headers.get("content-type") || "application/octet-stream" });
      res.end(Buffer.from(await t.arrayBuffer()));
      return;
    }
    if (u.pathname.startsWith("/api/") || u.pathname.startsWith("/photo/") ||
        u.pathname.startsWith("/geo/") || u.pathname.startsWith("/font/")) {
      const body = ["POST","PATCH","DELETE","PUT"].includes(req.method)
        ? await new Promise((ok) => { let b=[]; req.on("data",(c)=>b.push(c)); req.on("end",()=>ok(Buffer.concat(b))); })
        : undefined;
      const p = await fetch(PROD + u.pathname + u.search, {
        method: req.method, body,
        headers: { cookie: COOKIE, "content-type": req.headers["content-type"] || "application/json" },
      });
      res.writeHead(p.status, { "content-type": p.headers.get("content-type") || "text/plain" });
      res.end(Buffer.from(await p.arrayBuffer()));
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page);
  } catch (e) {
    res.writeHead(502); res.end(String(e));
  }
}).listen(PORT, () => console.log(`harness on :${PORT} cookie=${COOKIE ? "set" : "MISSING"}`));

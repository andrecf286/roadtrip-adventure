/**
 * Sessions for six people who all know each other.
 *
 * A signed token carries the person id and an expiry. Tokens last 120 days,
 * which covers the trip with a month of margin, so each person follows one link
 * once and never sees a login again — which matters most for Lily and Ada,
 * who are opening this at a gas pump in Montana, not at a desk.
 *
 * There is deliberately no password, no email round-trip at use time, and no
 * refresh dance. The threat model is six family members and an unguessable URL,
 * not the open internet.
 *
 * Link delivery is out of band: `GET /mint?k=...` prints all six links and Andy
 * sends them by text. Standing up domain-verified transactional email to
 * deliver six links once would be more infrastructure than the problem has.
 */

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeToString(str) {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(pad + "===".slice((pad.length + 3) % 4));
}

async function key(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

/** Mint a token for a person, valid `days` from now. */
export async function mintToken(secret, personId, days = 120) {
  const payload = b64urlEncode(
    enc.encode(JSON.stringify({ p: personId, e: Date.now() + days * 86400000 }))
  );
  const sig = b64urlEncode(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(payload)));
  return `${payload}.${sig}`;
}

/**
 * Verify and decode. Returns the person id, or null for anything wrong —
 * bad shape, bad signature, or expired. Callers never distinguish the cases,
 * so a tampered token leaks nothing about why it failed.
 */
export async function readToken(secret, token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let sigBytes;
  try {
    const raw = b64urlDecodeToString(sig);
    sigBytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  } catch { return null; }

  const ok = await crypto.subtle.verify("HMAC", await key(secret), sigBytes, enc.encode(payload));
  if (!ok) return null;

  try {
    const { p, e } = JSON.parse(b64urlDecodeToString(payload));
    if (!p || !e || Date.now() > e) return null;
    return p;
  } catch { return null; }
}

export function cookieFrom(request) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === "rt_s") return v.join("=");
  }
  return null;
}

export function sessionCookie(token, days = 120) {
  return `rt_s=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${days * 86400}`;
}

/** Resolve the caller. Returns the person row, or null. */
export async function currentPerson(request, env) {
  const id = await readToken(env.SESSION_SECRET, cookieFrom(request));
  if (!id) return null;
  return env.roadtrip
    .prepare("SELECT id, name, role, email FROM person WHERE id = ?")
    .bind(id)
    .first();
}

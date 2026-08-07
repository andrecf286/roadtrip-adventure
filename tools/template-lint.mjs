#!/usr/bin/env node
/**
 * template-lint — one command, no flags, nothing to remember.
 *
 *   node tools/template-lint.mjs
 *
 * Why this exists: app/src/shell.js is a ~2700-line module whose bulk is a
 * single String.raw template literal holding the entire client (HTML + CSS +
 * ~2200 lines of JS). To `node --check`, every one of those lines is just
 * string content. A build once shipped
 *
 *     html += '<button onclick="tab('badges')">Badges</button>';
 *
 * inside that literal. The apostrophes closed the JS string early, the client
 * script threw SyntaxError at parse time, the whole app was a dead white page,
 * and `node --check app/src/shell.js` printed nothing at all — because to node
 * the broken line is inert text inside a template literal.
 *
 * So: pull the literal out of the module, pull the <script> out of the literal,
 * and hand THAT to the parser. Plus the structural asserts that tell us we
 * actually found the literal instead of silently linting an empty string.
 *
 * Exit 0 = clean. Exit 1 = at least one check failed. Every check runs even
 * after one fails, so a single run reports everything.
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(ROOT, "app/src/shell.js");
const MIN_BODY = 100000;

let failed = 0;
const ok = (m) => console.log("  ok    " + m);
const fail = (m) => { failed++; console.log("  FAIL  " + m); };

console.log("template-lint: " + TARGET);

const src = readFileSync(TARGET, "utf8");

/* --- 1. locate the String.raw literal ------------------------------------ */

const OPEN = "String.raw`";
const openIdx = src.indexOf(OPEN);
if (openIdx === -1) {
  fail("no `String.raw\\`` opening found in shell.js — the template moved or was renamed");
  process.exit(1);
}
const bodyStart = openIdx + OPEN.length;

/* Walk the literal the way the JS lexer does. A backslash escapes the next
   character even under String.raw (String.raw only changes what the *value*
   is, not where the literal ends), and `${` opens an interpolation whose
   nested braces/strings have to be skipped before the literal can close. */
let i = bodyStart;
let bodyEnd = -1;
const interpolations = [];
scan: while (i < src.length) {
  const c = src[i];
  if (c === "\\") { i += 2; continue; }
  if (c === "`") { bodyEnd = i; break scan; }
  if (c === "$" && src[i + 1] === "{") {
    const at = i;
    let depth = 1;
    i += 2;
    while (i < src.length && depth > 0) {
      const d = src[i];
      if (d === "{") depth++;
      else if (d === "}") depth--;
      else if (d === "'" || d === '"' || d === "`") {
        const q = d;
        i++;
        while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      }
      i++;
    }
    interpolations.push({ at, text: src.slice(at, i) });
    continue;
  }
  i++;
}

if (bodyEnd === -1) {
  fail("String.raw literal never closes — unterminated template");
  process.exit(1);
}

const body = src.slice(bodyStart, bodyEnd);
const lineOf = (idx) => src.slice(0, idx).split("\n").length;

/* --- 2. structural asserts ----------------------------------------------- */

if (body.length > MIN_BODY) {
  ok("literal body is " + body.length.toLocaleString() + " chars (> " + MIN_BODY.toLocaleString() + ")");
} else {
  fail(
    "literal body is only " + body.length.toLocaleString() + " chars (expected > " +
    MIN_BODY.toLocaleString() + ") — the literal closed early, so everything after " +
    "line " + lineOf(bodyEnd) + " is being shipped as CODE, not as page text"
  );
}

const after = src.slice(bodyEnd + 1);
if (/^;\s*$/.test(after)) {
  ok("literal closes at `; on line " + lineOf(bodyEnd) + " and nothing follows it");
} else if (after.startsWith(";")) {
  ok("literal closes at `; on line " + lineOf(bodyEnd));
} else {
  fail(
    "literal does not close at `; — line " + lineOf(bodyEnd) + " is followed by " +
    JSON.stringify(after.slice(0, 40)) + ". A stray backtick inside the page ended " +
    "the string early."
  );
}

if (interpolations.length === 0) {
  ok("no ${...} interpolations inside the literal");
} else {
  for (const it of interpolations) {
    fail(
      "${...} interpolation at line " + lineOf(it.at) + ": " +
      JSON.stringify(it.text.slice(0, 60)) + " — this is substituted at build " +
      "time into the page. If it was meant to be literal page text, escape it as \\${."
    );
  }
}

/* --- 3. extract the client <script> blocks ------------------------------- */

const scripts = [];
const openTag = /<script\b([^>]*)>/gi;
let m;
while ((m = openTag.exec(body)) !== null) {
  const attrs = m[1] || "";
  const codeStart = m.index + m[0].length;
  const closeIdx = body.indexOf("</script>", codeStart);
  if (closeIdx === -1) {
    fail("<script> opened at line " + lineOf(bodyStart + m.index) + " is never closed");
    break;
  }
  openTag.lastIndex = closeIdx + "</script>".length;
  if (/\bsrc\s*=/i.test(attrs)) continue;                 // external, nothing to parse
  if (/type\s*=\s*["']?(?!text\/javascript|module)/i.test(attrs)) continue; // data block
  scripts.push({
    attrs,
    code: body.slice(codeStart, closeIdx),
    startLine: lineOf(bodyStart + codeStart),
  });
}

if (scripts.length === 0) {
  fail("no inline <script> block found inside the literal — nothing to parse");
} else {
  ok("found " + scripts.length + " inline <script> block(s), " +
     scripts.map((s) => s.code.length.toLocaleString() + " chars").join(", "));
}

/* --- 4. parse each extracted script -------------------------------------- */

const dir = mkdtempSync(join(tmpdir(), "template-lint-"));

for (const s of scripts) {
  /* A literal "</script>" inside a JS string closes the block in the browser
     even though it is fine to node. Check before parsing, because the
     extraction above already truncated at it. */
  const f = join(dir, "script-" + s.startLine + ".js");
  /* Pad so node's reported line numbers match shell.js line numbers. */
  writeFileSync(f, "\n".repeat(s.startLine - 1) + s.code);
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    ok("client script at shell.js:" + s.startLine + " parses");
  } catch (e) {
    const out = (e.stderr ? e.stderr.toString() : "") + (e.stdout ? e.stdout.toString() : "");
    fail(
      "client script at shell.js:" + s.startLine + " does NOT parse — the browser " +
      "will throw SyntaxError and run NONE of it (blank app). Line numbers below " +
      "are shell.js line numbers:\n" +
      out.trim().split("\n").map((l) => "        " + l).join("\n")
    );
  }
}

/* --- 5. </script> hiding in a JS string ---------------------------------- */

/* Every </script> in the literal must pair with a <script>. A surplus means one
   is buried in a JS string or a CSS block and will cut the client short. */
{
  const opens = (body.match(/<script\b/gi) || []).length;
  const closes = (body.match(/<\/script\s*>/gi) || []).length;
  if (opens === closes) {
    ok("<script> / </script> tags balance (" + opens + " each)");
  } else {
    fail(
      "<script> x" + opens + " but </script> x" + closes + " — a stray </script> " +
      "inside a JS string truncates the client script at that point"
    );
  }
}

console.log(failed === 0 ? "\ntemplate-lint: clean" : "\ntemplate-lint: " + failed + " failure(s)");
process.exit(failed === 0 ? 0 : 1);

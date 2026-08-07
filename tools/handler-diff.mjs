/* Handler diff — the instrument for "this client change is behaviour-preserving".
 *
 * template-lint proves the shell still parses. This proves it still renders the
 * same app. It boots the shell in a real browser against the render harness,
 * walks every screen that draws inline handlers, and prints the sorted set of
 * onclick / ontouchstart attributes it found. Run it once with the old shell
 * and once with the new one and diff the two.
 *
 *   COOKIE=<rt_s=...> PORT=8791 node tools/render-harness.mjs &
 *   node tools/handler-diff.mjs > /tmp/handlers_before.json
 *   # ...change the shell, RESTART THE HARNESS (it holds SHELL from process
 *   #    start, so editing the file underneath it changes nothing)...
 *   node tools/handler-diff.mjs > /tmp/handlers_after.json
 *   diff <(jq -S . /tmp/handlers_before.json) <(jq -S . /tmp/handlers_after.json)
 *
 * It earned its place the day it was written: a sweep that looked obviously
 * safe was quietly stripping the slashes out of every photo path and the space
 * out of "North Dakota". Nothing else in the toolchain would have said a word.
 */
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
await pg.goto("http://localhost:8791/", { waitUntil: "domcontentloaded" });
await pg.waitForTimeout(3000);
const grab = () => pg.evaluate(() =>
  [...document.querySelectorAll("[onclick],[ontouchstart]")]
    .map(e => (e.getAttribute("onclick")||"") + "|" + (e.getAttribute("ontouchstart")||"") + "|" + (e.id||""))
);
const all = new Set();
const add = async () => (await grab()).forEach(h => all.add(h));
await add();                                                      // today
await pg.evaluate(() => tab("trip"));      await pg.waitForTimeout(2500); await add();
await pg.evaluate(() => loadDay("2026-08-05")); await pg.waitForTimeout(2500); await add();
await pg.evaluate(() => loadDay("2026-08-06")); await pg.waitForTimeout(2000); await add();
await pg.evaluate(() => tab("badges"));    await pg.waitForTimeout(2500); await add();
await pg.evaluate(() => { if (window.BADGEDATA && BADGEDATA.bespoke && BADGEDATA.bespoke[0]) openBadge("bespoke", BADGEDATA.bespoke[0].id); });
await pg.waitForTimeout(1800); await add();
await pg.evaluate(() => { if (window.BADGEDATA && BADGEDATA.bespoke && BADGEDATA.bespoke[0]) editBadge(BADGEDATA.bespoke[0].id); });
await pg.waitForTimeout(1200); await add();
await pg.evaluate(() => tab("memories"));  await pg.waitForTimeout(2800); await add();
await pg.evaluate(() => loadPlace("yellowstone")); await pg.waitForTimeout(2200); await add();
await pg.evaluate(() => loadPlace("theodore-roosevelt-national-park")); await pg.waitForTimeout(2200); await add();
await pg.evaluate(() => loadRes("r7")); await pg.waitForTimeout(1800); await add();
await pg.evaluate(() => openJot()); await pg.waitForTimeout(800); await add();
await pg.evaluate(() => tab("today")); await pg.waitForTimeout(2000);
await pg.evaluate(() => openStaying()); await pg.waitForTimeout(900); await add();
const sorted = [...all].sort();
console.log(JSON.stringify(sorted, null, 0));
await b.close();

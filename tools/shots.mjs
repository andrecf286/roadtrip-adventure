import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
async function shoot(base, name, actions) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto(base, { waitUntil: "networkidle" }).catch(()=>{});
  await pg.waitForTimeout(2500);
  if (actions) await actions(pg);
  await pg.screenshot({ path: `/tmp/shot_${name}.png`, fullPage: false });
  await pg.close();
  console.log("shot", name);
}
await shoot("http://localhost:8791/", "today_author");
await shoot("http://localhost:8791/", "day_aug5", async (pg) => {
  await pg.evaluate(() => loadDay("2026-08-05"));
  await pg.waitForTimeout(2500);
});
await shoot("http://localhost:8791/", "badges_miles", async (pg) => {
  await pg.evaluate(() => tab("badges"));
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => { if (window.BADGEDATA && BADGEDATA.miles && BADGEDATA.miles.earned) openBadge("miles", BADGEDATA.miles.earned); });
  await pg.waitForTimeout(2500);
});
await shoot("http://localhost:8792/", "viewer_deny", async (pg) => {
  await pg.evaluate(() => { var btn = document.querySelector(".dialbtn"); if (btn) btn.click(); });
  await pg.waitForTimeout(800);
});
await b.close();

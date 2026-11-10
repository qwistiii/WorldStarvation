// Exploration screenshots of the current game (phase 1). node tools/explore.mjs <outdir>
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
const out = process.argv[2] || 'shots';
fs.mkdirSync(out, { recursive: true });
const PORT = 8111;
const server = await serve(PORT);
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
async function run(tag, vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: mobile ? 3 : 1, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 90000 });
  console.log(tag, 'menu ready ms', Date.now() - t0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${tag}-menu.png` });
  await page.evaluate(() => localStorage.clear());
  await page.click('[data-go="new"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${tag}-new.png` });
  await page.evaluate(() => { const C = __ui.C; C.seed = 1337; C.rules.botCount = 2; C.slot = 6; C.rules.ai = 0; });
  const t1 = Date.now();
  await page.click('#screate');
  await page.waitForFunction(() => Game.api && Game.api.ready, null, { timeout: 90000 });
  console.log(tag, 'game ready ms', Date.now() - t1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${tag}-found.png` });
  await page.evaluate(() => { for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 90000 });
  await page.evaluate(() => { Game.setSpeed(0); Game._test.run(200); });
  const c = await page.evaluate(() => { const c = Game.api.W.cities.find((o) => o.cap === 0); return [c.x, c.y, c.R]; });
  for (const [name, m] of [['city', 4], ['near', 1.2], ['close', 0.35]]) {
    await page.evaluate(([x, y, m]) => { const w = Game.api; w.stop(); w.cam.x = x; w.cam.y = y; w.cam.m = m; }, [c[0], c[1], m]);
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${out}/${tag}-${name}.png` });
  }
  await page.evaluate(([x, y]) => { const w = Game.api; w.setTod(23); w.cam.x = x; w.cam.y = y; w.cam.m = 1.2; }, c);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/${tag}-night.png` });
  console.log(tag, 'errors', errs.slice(0, 5));
  await ctx.close();
}
await run('desk', { width: 1920, height: 1080 });
await run('mob', { width: 390, height: 844 }, true);
await browser.close();
server.close();

// Lamps and floodlights at night and by day (phase 7): a row of street lamps on the own land and a factory with its
// floodlights; the ground brightness under a lamp with the lights on and off. node tests/visual/lamps.mjs [outdir]
import fs from 'node:fs';
import { launch, server, DESKTOP, openMenu, newGame, settle } from '../lib/game.mjs';
const OUT = process.argv[2] || '.work/lamps'; fs.mkdirSync(OUT, { recursive: true });
const PORT = 8240, srv = await server(PORT), browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await openMenu(page, PORT); await newGame(page); await settle(page, 10000);
const site = await page.evaluate(() => {
  const T = Game._test, G = Game.G, W = Game.api.W, p = G.states[0], c = W.cities.find((o) => o.cap === 0); p.res.money = 1e9; Game.setSpeed(0); Game.api.stop();
  // a row of lamps along a street of the capital, 30 m apart, at its kerb
  T.run(240); p.res.money = 1e9;
  const RW = W._dbg.RW; let row = null; const pts = [];
  for (const r of W.queryRoads(c.x - 900, c.y - 900, c.x + 900, c.y + 900)) { if (r.k !== 3 && r.k !== 2) continue; pts.length = 0;
    for (let d = 40; d < r.L - 40 && pts.length < 10; d += 30) { const q = W.posAt(r, d), o = RW[r.k] / 2 + 2, x = q[0] - q[3] * o, y = q[1] + q[2] * o; if (T.canBuild('lamp', x, y) === null) pts.push([x, y]); else if (pts.length) break; }
    if (pts.length >= 8) { row = pts[Math.floor(pts.length / 2)]; break } }
  for (const [x, y] of pts) T.startBuild('lamp', x, y);
  let fac = null; for (let r = 1500; r < 16000 && !fac; r += 320) for (let a = 0; a < 6.28; a += 0.21) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild('factory', x, y) === null) { T.startBuild('factory', x, y); fac = [x, y]; break } }
  T.run(60); return { row, fac }; });
console.log('site', JSON.stringify(site));
const shot = async (n, m, tod, fn, at = site.row) => { await page.evaluate(async ([x, y, m, tod, fn]) => { const a = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)); a.setTod(tod); a.setWeather(0); a.cam.x = x; a.cam.y = y; a.cam.m = m; if (fn) eval(fn);
    let q = 0; for (let i = 0; i < 150; i++) { await sl(100); const s = a.stats(); if (!s.queue && !s.pending) { if (++q > 5) break } else q = 0 } await sl(1500); }, [at[0], at[1], m, tod, fn]); await page.screenshot({ path: `${OUT}/${n}.png` }); };
await shot('night', 0.9, 23); await shot('night-close', 0.25, 23); await shot('day', 0.6, 12); await shot('day-close', 0.12, 12); await shot('dusk', 0.9, 19.3);
if (site.fac) { await shot('factory-night', 1.4, 23, null, site.fac); await shot('factory-day', 1.4, 12, null, site.fac); }
// brightness of the ground under the 5th lamp, lights on vs off (night)
const lum = await page.evaluate(async ([x, y]) => { const a = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)), L = a.lights; a.setTod(23); a.cam.x = x + 4; a.cam.y = y + 4; a.cam.m = 0.25;
  const meas = async () => { await sl(1500); const g = __world.gl.gl, w = g.drawingBufferWidth, h = g.drawingBufferHeight, px = new Uint8Array(4 * 9);
    await new Promise((r) => requestAnimationFrame(r)); g.readPixels((w >> 1) - 1, (h >> 1) - 1, 3, 3, g.RGBA, g.UNSIGNED_BYTE, px); let s = 0; for (let i = 0; i < 9; i++) s += px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]; return s / 27; };
  const on = await meas(); for (const l of L.all()) L.setMode(l.id, 'off'); const off = await meas(); for (const l of L.all()) L.setMode(l.id, 'auto');
  return { on, off, n: L.size }; }, site.row);
console.log('ground under a lamp, night: on', lum.on.toFixed(1), 'off', lum.off.toFixed(1), 'lights', lum.n, 'errors', errs.slice(0, 3));
await browser.close(); srv.close();

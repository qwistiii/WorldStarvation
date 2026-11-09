// Founding a capital in a game and the camera approach after it (what the player sees right after the loading):
// frame times from the founding until 8 s after the game starts (fps per second, p95, worst, long tasks), then
// flights from 60 m/px down to the capital (day, overcast, night) with the frame cost per stage (PROF, ms) and how many
// times each cloud layer [shadows, clouds] was redrawn during the flight (5.14+, null on older builds).
// node tests/perf-capital.mjs
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
const PORT = 8103;
const server = await serve(PORT);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
try {
  await p.goto('http://127.0.0.1:' + PORT + '/index.html');
  await p.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 90000 });
  await p.evaluate(() => localStorage.clear());
  await p.click('[data-go="new"]');
  await p.evaluate(() => { const C = __ui.C; C.seed = 1337; C.rules.botCount = 2; C.slot = 7; C.rules.ai = 0; });
  await p.click('#screate');
  await p.waitForFunction(() => Game.api && Game.api.ready, null, { timeout: 90000 });
  await p.evaluate(() => { window.__ft = []; window.__lt = []; window.__rec = true; let last = performance.now();
    const loop = (t) => { window.__ft.push([t, t - last]); last = t; if (window.__rec) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
  await p.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 90000 });
  await p.waitForTimeout(8000);
  const found = await p.evaluate(() => { window.__rec = false; const a = window.__ft.slice(1), d = a.map((x) => x[1]), s = d.slice().sort((x, y) => x - y), t0 = a.length ? a[0][0] : 0, sec = [];
    for (const [t] of a) { const i = Math.floor((t - t0) / 1000); sec[i] = (sec[i] || 0) + 1; }
    const w = window.__world, prof = {}; if (w && w.PROF) for (const k in w.PROF) prof[k] = +(+w.PROF[k]).toFixed(2);
    return { frames: d.length, fps: d.length ? Math.round(1000 * d.length / d.reduce((q, x) => q + x, 0)) : 0, p95: +(s[Math.floor(s.length * 0.95)] || 0).toFixed(1), max: +(s[s.length - 1] || 0).toFixed(1), over12ms: d.filter((x) => x > 12).length, perSec: Array.from(sec, (x) => x || 0), longTasks: window.__lt.length, longMs: window.__lt.reduce((q, x) => q + x, 0), prof }; });
  console.log('found ' + JSON.stringify(found));
  for (const [name, tod, wx] of [['day', 12, 1], ['overcast', 12, 2], ['night', 23, 1]]) {
    const r = await p.evaluate(async ([tod, wx]) => { const w = window.__world, sl = (ms) => new Promise((r) => setTimeout(r, ms)); if (!w) return { err: 'no __world' };
      const W = Game.api.W, c = W.cities.find((o) => o.cap === 0); if (w.setTod) w.setTod(tod); if (w.setWeather) w.setWeather(wx);
      w.cam.x = c.x; w.cam.y = c.y; w.cam.m = 60;
      for (let i = 0; i < 100; i++) { await sl(100); const s = w.stats ? w.stats() : null; if (!s || (s.queue === 0 && s.pending === 0)) break; }
      await sl(400);
      const L = w.cloudLayers || [], rd = () => L.map((l) => (l.rd === undefined ? null : l.rd)), r0 = rd();
      const ft = []; let last = performance.now(), run = true; const loop = (t) => { ft.push(t - last); last = t; if (run) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
      w.flyTo(c.x, c.y, 1.2, 4); await sl(3000); const prof = {}; for (const k in w.PROF) prof[k] = +(+w.PROF[k]).toFixed(2); await sl(1300); run = false; const r1 = rd();
      const a = ft.slice(1), s = a.slice().sort((x, y) => x - y);
      return { fps: Math.round(1000 * a.length / a.reduce((q, x) => q + x, 0)), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s[s.length - 1].toFixed(1), n: a.length, redraws: r0.length && r0[0] !== null ? [r1[0] - r0[0], r1[1] - r0[1]] : null, prof }; }, [tod, wx]);
    console.log(name + ' ' + JSON.stringify(r));
  }
} catch (e) { console.log('ERROR ' + e); }
if (errs.length) console.log('ERR ' + errs.slice(0, 3).join(' | '));
await b.close();
server.close();

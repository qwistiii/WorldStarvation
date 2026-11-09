// Camera flight from orbit down to a city (what happens after the capital is founded): frame rate and worst frames
// during the flight, the frame cost per stage (PROF, ms) and how much of the destination view is sharp on arrival
// (% of tiles of the final LOD in the cache: [day, lights]) at 0, 1 and 3 s after it.
// node tests/perf-fly.mjs [page]
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
const PORT = 8095;
const server = await serve(PORT);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://127.0.0.1:' + PORT + '/' + (process.argv[2] || 'index.html') + '#20261107');
await p.waitForFunction(() => window.__world && window.__world.cache && window.__world.cache.size > 4, null, { timeout: 90000 });
const out = {};
for (const [name, tod, wx, ci] of [['day', 12, 1, 0], ['overcast', 12, 2, 1], ['night', 23, 1, 2]]) {
  out[name] = await p.evaluate(async ([tod, wx, ci]) => {
    const w = window.__world, W = w.W, sl = ms => new Promise(r => setTimeout(r, ms));
    w.stop(); w.setSpeed(0); w.setTod(tod); w.setWeather(wx);
    const c = W.cities.slice().sort((a, b) => b.R - a.R)[ci];
    w.cam.x = W.WORLD / 2; w.cam.y = W.WORLD / 2; w.cam.m = w.maxM();
    for (let i = 0; i < 150; i++) { await sl(100); const s = w.stats(); if (s.queue === 0 && s.pending === 0) break }
    await sl(400);
    const cov = mp => {
      const m = w.cam.m, md = m / Math.min(w.DPR, 1.5);
      const z = Math.max(0, Math.min(12, Math.ceil(Math.log2(W.WORLD / (256 * md)) - 0.25))), n = 1 << z, ts = W.WORLD / n;
      const x0 = w.cam.x - w.VW / 2 * m, x1 = w.cam.x + w.VW / 2 * m, y0 = w.cam.y - w.VH / 2 * m, y1 = w.cam.y + w.VH / 2 * m;
      let t = 0, k = 0;
      for (let ty = Math.max(0, Math.floor(y0 / ts)); ty <= Math.min(n - 1, Math.floor(y1 / ts)); ty++)
        for (let tx = Math.max(0, Math.floor(x0 / ts)); tx <= Math.min(n - 1, Math.floor(x1 / ts)); tx++) { t++; if (mp.has(z * 16777216 + ty * 4096 + tx)) k++ }
      return t ? Math.round(k / t * 100) : 0;
    };
    const ft = []; let last = performance.now(), run = true;
    const loop = t => { ft.push(t - last); last = t; if (run) requestAnimationFrame(loop) };
    requestAnimationFrame(loop);
    const dur = 4; w.flyTo(c.x, c.y, 1.2, dur);
    await sl(dur * 750);
    const prof = {}; for (const k in w.PROF) prof[k] = +w.PROF[k].toFixed(2);
    await sl(dur * 250 + 30);
    const nFly = ft.length;
    const ready = { at0: [cov(w.cache), cov(w.lcache)] };
    await sl(1000); ready.at1 = [cov(w.cache), cov(w.lcache)];
    await sl(2000); ready.at3 = [cov(w.cache), cov(w.lcache)];
    run = false;
    const st = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const avg = a.reduce((q, x) => q + x, 0) / a.length;
      return { fps: Math.round(1000 / avg), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s[s.length - 1].toFixed(1), n: a.length } };
    const s = w.stats();
    return { fly: st(ft.slice(1, nFly)), after: st(ft.slice(nFly)), prof, ready, cpu: s.main, lowQ: s.lowQ };
  }, [tod, wx, ci]);
  console.log(name + ' ' + JSON.stringify(out[name]));
}
if (errs.length) console.log('ERR ' + errs.slice(0, 3).join(' | '));
await b.close();
server.close();

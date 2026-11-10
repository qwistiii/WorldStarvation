// Benchmark of the game frame: desktop 1920x1080 and a phone (390x844, DPR 3, CPU slowed down 4x).
// node tests/perf/bench.mjs [label] [--quick] [--only=desktop|phone]
//   → bench/<label>.json and a table in the console.
// Frame cost = time of the world's rAF callback plus a 1-pixel read-back of the main canvas, which waits until the GPU
// has drawn the frame: it is the CPU + GPU cost of one frame, independent of the 60 Hz cap of the headless browser.
// "fps" below is 1000 / mean frame cost — the rate the machine could hold with an uncapped display (a 165 Hz monitor
// needs a cost of at most 6.06 ms). Draw calls are the Canvas 2D calls on the main canvas per frame (drawImage, fill,
// stroke, fillRect, fillText, …), counted in a separate pass so the counting does not change the timing.
import fs from 'node:fs';
import { launch, server, DESKTOP, PHONE, openMenu, newGame, settle, capital, watchErrors } from '../lib/game.mjs';

const args = process.argv.slice(2);
const label = args.find((a) => !a.startsWith('--')) || 'run';
const quick = args.includes('--quick');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const PORT = 8120 + Math.floor(Math.random() * 50);

const INIT = () => {
  const B = window.__bench = { on: false, sync: true, count: false, cost: [], js: [], dc: 0, dcs: [], px: new Uint8Array(4), multi: 0, thr: [] };
  // the engine schedules its next frame inside the callback: in throughput mode the extra frames call the same function
  // directly (cb2), the scheduled one is swallowed
  let swallow = 0;
  const RAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    if (cb.name !== 'frame') return RAF(cb);
    if (swallow > 0) { swallow--; return 0 }
    return RAF(function (ts) {
      if (!B.on) return cb(ts);
      // throughput mode: k frames back to back, one read-back for all of them (the GPU pipelines them as a real
      // uncapped display would); cost per frame = wall time / k
      if (B.multi > 1) { const c = document.getElementById('c'), g = c.getContext('webgl2'), t0 = performance.now(); swallow = B.multi - 1;
        for (let i = 0; i < B.multi; i++) cb(ts + i * 1000 / 165);
        if (g) g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, B.px); else c.getContext('2d').getImageData(0, 0, 1, 1);
        B.thr.push((performance.now() - t0) / B.multi); return }
      B.dc = 0; const t0 = performance.now(); cb(ts); const t1 = performance.now();
      if (B.sync) { const c = document.getElementById('c'); const g = c.getContext('webgl2'); if (g) g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, B.px); else c.getContext('2d').getImageData(0, 0, 1, 1); }
      const t2 = performance.now(); B.cost.push(t2 - t0); B.js.push(t1 - t0);
      if (B.count) { const G = window.__world && window.__world.gl; B.dcs.push(B.dc + (G ? G.stats.draws : 0)); }
    });
  };
  const P = CanvasRenderingContext2D.prototype;
  for (const n of ['drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'putImageData', 'clearRect']) {
    const f = P[n];
    P[n] = function () { if (B.count && this.canvas && (this.canvas.id === 'c' || this.canvas.id === 'c2')) B.dc++; return f.apply(this, arguments); };
  }
};

// scenarios: camera set-ups over the capital; 'pan' and 'zoom' move the camera every frame (a drag / a wheel zoom)
const SCEN = [
  { n: 'orbit', m: 'max', tod: 12, wx: 1 },
  { n: 'region', m: 18, tod: 12, wx: 1 },
  { n: 'city', m: 4, tod: 12, wx: 1 },
  { n: 'street', m: 0.35, tod: 12, wx: 1 },
  { n: 'night', m: 1.2, tod: 23, wx: 1 },
  { n: 'clouds', m: 30, tod: 12, wx: 2 },
  { n: 'pan', m: 1.2, tod: 12, wx: 1, move: 'pan' },
  { n: 'zoom', m: 3, tod: 17.5, wx: 1, move: 'zoom' },
];

function stat(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), avg = a.reduce((q, x) => q + x, 0) / a.length;
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return { avg: +avg.toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +s[s.length - 1].toFixed(2), n: a.length };
}

async function measure(page, sc, secs) {
  return page.evaluate(async ([sc, secs]) => {
    const w = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)), B = window.__bench;
    const c = Game.api.W.cities.find((o) => o.cap === 0);
    w.stop(); w.setSpeed(0); w.setTod(sc.tod); w.setWeather(sc.wx); Game.setSpeed(0);
    w.cam.x = c.x; w.cam.y = c.y; w.cam.m = sc.m === 'max' ? w.maxM() : sc.m;
    for (let i = 0; i < 200; i++) { await sl(100); const s = w.stats(); if (s.queue === 0 && s.pending === 0) break; }
    await sl(600);
    let mover = null, t0 = performance.now();
    if (sc.move) {
      const m0 = w.cam.m, x0 = w.cam.x;
      mover = () => { const t = (performance.now() - t0) / 1000;
        if (sc.move === 'pan') { w.cam.x = x0 + Math.sin(t * 0.9) * 900; w.cam.y = c.y + Math.cos(t * 0.6) * 500; }
        else w.cam.m = m0 * Math.exp(Math.sin(t * 1.3) * 0.9);
        if (mover) requestAnimationFrame(mover); };
      requestAnimationFrame(mover);
    }
    B.cost.length = 0; B.js.length = 0; B.on = true; B.sync = true; B.count = false;
    const r0 = performance.now(); let rafN = 0; const cnt = () => { rafN++; if (B.on) requestAnimationFrame(cnt); }; requestAnimationFrame(cnt);
    await sl(secs * 1000);
    const cost = B.cost.slice(5), js = B.js.slice(5); const wall = performance.now() - r0;
    // throughput: 4 frames per tick, one read-back
    B.thr.length = 0; B.multi = 4; await sl(1500); B.multi = 0; const thr = B.thr.slice(3);
    // draw calls: a short separate pass
    B.dcs.length = 0; B.count = true; B.sync = false; await sl(500); B.count = false; const dcs = B.dcs.slice(2);
    B.on = false; const mv = mover; mover = null; void mv;
    const st = w.stats(), W = window.__world;
    const lay = (W.cloudLayers || []).reduce((q, l) => q + (l.c.width || l.c.w || 0) * (l.c.height || l.c.h || 0) * 4, 0);
    const tiles = st.tiles + String(st.lights).split('/').reduce((q, x) => q + (+x || 0), 0);
    // texture memory: the GL renderer has fixed pools (st.gl.texMB); the Canvas 2D one kept one bitmap per tile
    const mem = performance.memory ? performance.memory.usedJSHeapSize : 0;
    return { cost, js, dcs, thr, rafFps: rafN / (wall / 1000), tiles, texMB: st.gl ? st.gl.slots * 0.25 + lay / 1048576 : (tiles * 256 * 256 * 4 + lay) / 1048576, heapMB: mem / 1048576, lowQ: st.lowQ, cars: st.cars,
      prof: Object.fromEntries(Object.entries(W.PROF || {}).map(([k, v]) => [k, +v.toFixed(2)])) };
  }, [sc, secs]);
}

async function device(browser, name, opts, throttle) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const cdp = await ctx.newCDPSession(page);
  if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const tMenu = await openMenu(page, PORT);
  const g = await newGame(page);
  const tSettle = await settle(page, 30000);
  const res = { device: name, viewport: opts.viewport, dpr: opts.deviceScaleFactor, cpuThrottle: throttle || 1, load: { menuMs: tMenu, worldMs: g.tWorld, foundMs: g.tFound, settleMs: tSettle }, scen: {} };
  const secs = quick ? 1.5 : 3;
  for (const sc of SCEN) {
    const r = await measure(page, sc, secs);
    const c = stat(r.cost), d = stat(r.dcs);
    const th = stat(r.thr);
    res.scen[sc.n] = { cost: c, js: stat(r.js), thr: th, fpsThr: th ? +(1000 / th.avg).toFixed(1) : 0, fps: c ? +(1000 / c.avg).toFixed(1) : 0, fps95: c ? +(1000 / c.p95).toFixed(1) : 0, rafFps: +r.rafFps.toFixed(1),
      drawCalls: d ? Math.round(d.avg) : 0, drawCallsMax: d ? d.max : 0, tiles: r.tiles, texMB: +r.texMB.toFixed(1), heapMB: +r.heapMB.toFixed(1), cars: r.cars, lowQ: r.lowQ, prof: r.prof };
    console.log(`${name.padEnd(7)} ${sc.n.padEnd(7)} thr ${th ? th.avg.toFixed(2).padStart(6) : '  —  '} ms → ${th ? (1000 / th.avg).toFixed(0).padStart(4) : '—'} fps · sync ${c.avg.toFixed(2).padStart(6)} ms (p95 ${c.p95.toFixed(2).padStart(6)}) · js ${stat(r.js).avg.toFixed(2)} ms · draw ${res.scen[sc.n].drawCalls} · tex ${r.texMB.toFixed(0)} MB · heap ${r.heapMB.toFixed(0)} MB`);
  }
  const m = await cdp.send('Performance.enable').then(() => cdp.send('Performance.getMetrics')).catch(() => null);
  if (m) { const g2 = Object.fromEntries(m.metrics.map((q) => [q.name, q.value])); res.heap = { usedMB: +(g2.JSHeapUsedSize / 1048576).toFixed(1), totalMB: +(g2.JSHeapTotalSize / 1048576).toFixed(1), nodes: g2.Nodes }; }
  res.gpu = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; });
  res.errors = errors.slice(0, 10);
  console.log(`${name.padEnd(7)} load: menu ${tMenu} ms · world ${g.tWorld} ms · found ${g.tFound} ms · settle ${tSettle} ms · ${res.gpu}`);
  if (errors.length) console.log('ERRORS', errors.slice(0, 5));
  await ctx.close();
  return res;
}

const srv = await server(PORT);
const browser = await launch();
const out = { label, date: new Date().toISOString(), runs: [] };
try {
  if (only !== 'phone') out.runs.push(await device(browser, 'desktop', DESKTOP, 0));
  if (only !== 'desktop') out.runs.push(await device(browser, 'phone', PHONE, 4));
} finally { await browser.close(); srv.close(); }
fs.mkdirSync('bench', { recursive: true });
fs.writeFileSync(`bench/${label}.json`, JSON.stringify(out, null, 1));
console.log('saved bench/' + label + '.json');

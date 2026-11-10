// A/B of render switches in one page (the machine load cancels out): configurations alternate 6 times per view,
// throughput mode (4 frames per tick, one read-back). node tests/perf/ab.mjs '{"a":{},"b":{"vigPass":1}}'
import { launch, server, DESKTOP, openMenu, newGame, settle } from '../lib/game.mjs';
const CFG = JSON.parse(process.argv[2] || '{"new":{},"legacy":{"vigPass":1,"bloomFull":1}}');
const INIT = () => { const B = window.__bench = { on: false, thr: [], px: new Uint8Array(4) }; const RAF = window.requestAnimationFrame.bind(window); let sw = 0;
  window.requestAnimationFrame = function (cb) { if (cb.name !== 'frame') return RAF(cb); if (sw > 0) { sw--; return 0 } return RAF(function (ts) { if (!B.on) return cb(ts);
    const g = document.getElementById('c').getContext('webgl2'), t0 = performance.now(); sw = 3; for (let i = 0; i < 4; i++) cb(ts + i * 6); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, B.px); B.thr.push((performance.now() - t0) / 4); }); }; };
const s = await server(8175); const b = await launch(); const ctx = await b.newContext(DESKTOP); await ctx.addInitScript(INIT);
const p = await ctx.newPage(); await openMenu(p, 8175); await newGame(p); await settle(p, 20000);
for (const [n, m, tod, wx] of (process.argv[3] ? JSON.parse(process.argv[3]) : [['city', 4, 12, 1], ['street', 0.35, 12, 1], ['night', 1.2, 23, 1], ['overcast', 30, 12, 2]])) {
  const r = await p.evaluate(async ([m, tod, wx, CFG]) => { const w = Game.api, sl = ms => new Promise(r => setTimeout(r, ms)), B = window.__bench; const c = w.W.cities.find(o => o.cap === 0);
    w.stop(); w.setTod(tod); w.setWeather(wx); Game.setSpeed(0); w.cam.x = c.x; w.cam.y = c.y; w.cam.m = m;
    for (let i = 0; i < 150; i++) { await sl(100); const s = w.stats(); if (!s.queue && !s.pending) break; } await sl(400);
    const out = {}; for (const k in CFG) out[k] = [];
    for (let rep = 0; rep < 6; rep++) for (const k in CFG) { for (const q in __world.dbg) delete __world.dbg[q]; Object.assign(__world.dbg, CFG[k]); w.opt.labels = !CFG[k].noLabels; for (const q of ['border','fill','dep','caps','names']) Game._dbg[q] = !!(CFG[k].g || {})[q]; await sl(150); B.thr.length = 0; B.on = true; await sl(700); B.on = false; const a = B.thr.slice(2).sort((x, y) => x - y); out[k].push(a[a.length >> 1]); }
    for (const k in out) { const a = out[k].sort((x, y) => x - y); out[k] = +((a[2] + a[3]) / 2).toFixed(2); } for (const q in __world.dbg) delete __world.dbg[q]; return out; }, [m, tod, wx, CFG]);
  console.log(n.padEnd(9), JSON.stringify(r));
}
await b.close(); s.close();

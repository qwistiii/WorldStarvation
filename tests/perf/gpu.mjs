// GPU time per pass (timer queries), desktop 1920x1080: node tests/perf/gpu.mjs
import { launch, server, DESKTOP, openMenu, newGame, settle } from '../lib/game.mjs';
const s = await server(8176); const b = await launch(process.argv.includes('hp') ? ['--force_high_performance_gpu'] : []); const p = await (await b.newContext(DESKTOP)).newPage();
await openMenu(p, 8176); await newGame(p); await settle(p, 20000);
for (const [n, m, tod, wx] of [['city', 4, 12, 1], ['street', 0.35, 12, 1], ['night', 1.2, 23, 1], ['dusk', 3, 18.7, 1], ['overcast', 30, 12, 2], ['orbit', 'max', 12, 1]]) {
  const r = await p.evaluate(async ([m, tod, wx]) => { const w = Game.api, sl = ms => new Promise(r => setTimeout(r, ms)); const c = w.W.cities.find(o => o.cap === 0);
    w.stop(); w.setTod(tod); w.setWeather(wx); Game.setSpeed(0); w.cam.x = c.x; w.cam.y = c.y; w.cam.m = m === 'max' ? w.maxM() : m;
    let q = 0; for (let i = 0; i < 150; i++) { await sl(100); const s = w.stats(); if (!s.queue && !s.pending) { if (++q > 5) break } else q = 0 } const G = __world.gl; G.gpu = {}; G.gpuOn = true; await sl(2500); G.gpuOn = false;
    const o = {}; let t = 0; for (const k in G.gpu) { o[k] = +G.gpu[k].toFixed(2); t += G.gpu[k] } o.total = +t.toFixed(2); return o; }, [m, tod, wx]);
  console.log(n.padEnd(9), JSON.stringify(r));
}
await b.close(); s.close();

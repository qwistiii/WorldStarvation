// Frame time while the camera MOVES — what the player sees, not a still frame.
// node tests/perf/motion.mjs [label] [--profile] [--heights=500,1000,5000,20000] [--headless]
//
// Runs in a real (headed) maximized Chromium window on the real display: frame intervals come from the monitor's vsync
// (165 Hz here), so a frame that misses its 6.06 ms slot shows up as a 12 ms interval — exactly the stutter a player sees.
// Over the biggest city, at each camera height: still, smooth pan (a mouse drag), jerks (fast flicks with stops) and a
// wheel-like zoom in and out. Per phase: frame interval p50/p95/p99/max, frames over the budget (> 6.06 ms * 1.15),
// main-thread time per frame (the engine's rAF callback) p50/p95/p99, long tasks, tiles still missing at the end.
// --profile records a JS CPU profile (Chrome DevTools protocol) of the pan/jerk phases at every height and prints the
// functions with the most self time — the real bottlenecks, not guesses.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { GPU_ARGS, server, openMenu, newGame, settle } from '../lib/game.mjs';

const args = process.argv.slice(2);
const label = args.find((a) => !a.startsWith('--')) || 'run';
const PROFILE = args.includes('--profile');
const GPU = args.includes('--gpu'); // GPU time per frame from timer queries (adds a flush per pass: run it separately)
const HEADLESS = args.includes('--headless');
const HEIGHTS = ((args.find((a) => a.startsWith('--heights=')) || '').slice(10) || '500,1000,5000,20000').split(',').map(Number);
const PHASES = ((args.find((a) => a.startsWith('--phases=')) || '').slice(9) || 'still,pan,jerk,zoom').split(',');
const PORT = 8170 + Math.floor(Math.random() * 40);
const BUDGET = 1000 / 165;

const INIT = () => {
  const R = window.__mo = { on: false, iv: [], js: [], last: 0, lt: 0 };
  const RAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    if (cb.name !== 'frame') return RAF(cb);
    return RAF(function (ts) {
      if (!R.on) return cb(ts);
      const t0 = performance.now(); cb(ts); const t1 = performance.now();
      if (R.last) R.iv.push(ts - R.last); R.last = ts; R.js.push(t1 - t0);
    });
  };
  try { new PerformanceObserver((l) => { if (R.on) for (const e of l.getEntries()) R.lt += e.duration; }).observe({ entryTypes: ['longtask'] }); } catch (e) { /* no long tasks API */ }
};

function stat(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const q = (p) => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2);
  return { n: a.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: +s[s.length - 1].toFixed(1) };
}

const srv = await server(PORT);
const browser = await chromium.launch({ headless: HEADLESS, args: [...GPU_ARGS, '--start-maximized', ...(args.includes('--dgpu') ? ['--force_high_performance_gpu'] : [])] }); // --dgpu: the discrete card of a hybrid laptop
const ctx = await browser.newContext(HEADLESS ? { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 } : { viewport: null });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await openMenu(page, PORT, process.env.Q || ''); await newGame(page); await settle(page, 30000);
const env = await page.evaluate(() => {
  const W = Game.api.W, cs = W.cities.filter((c) => !c.vst && c.R).sort((a, b) => b.R - a.R), c = cs[0];
  Game.setSpeed(1); Game.api.setTod(12); Game.api.setWeather(1);
  return { VW: innerWidth, VH: innerHeight, dpr: devicePixelRatio, city: { x: c.x, y: c.y, R: c.R, name: c.name }, gpu: (() => { const g = document.getElementById('c').getContext('webgl2'), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })() };
});
console.log(`окно ${env.VW}x${env.VH} @${env.dpr} · ${env.gpu} · город ${env.city.name} R=${Math.round(env.city.R)} м`);
if (GPU) await page.evaluate(() => { __world.gl.gpuOn = true; });
if (process.env.DBG) await page.evaluate((s) => { for (const k of s.split(',')) __world.dbg[k] = 1; }, process.env.DBG); // A/B switches, e.g. DBG=noPF
let cdp = null; if (PROFILE) { cdp = await ctx.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); }
const out = { label, env, at: new Date().toISOString(), rows: [], profile: {} };

for (const H of HEIGHTS) {
  const m = H / (env.VH * 0.9);
  // arrive and let the tiles load (the player stops before moving)
  await page.evaluate(async ([x, y, m]) => { const a = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)); a.cam.x = x; a.cam.y = y; a.cam.m = m;
    for (let i = 0; i < 250; i++) { await sl(100); const s = a.stats(); if (!s.queue && !s.pending) break; } await sl(800); }, [env.city.x, env.city.y, m]);
  for (const ph of PHASES) {
    if (cdp && (ph === 'pan' || ph === 'jerk')) await cdp.send('Profiler.start');
    const r = await page.evaluate(async ([ph, m, cx, cy]) => {
      const a = Game.api, R = window.__mo, sl = (ms) => new Promise((r) => setTimeout(r, ms)), VW = innerWidth;
      const dur = ph === 'still' ? 2000 : ph === 'pan' ? 4000 : 3000; let t0 = 0, run = true;
      const mv = (ts) => { if (!run) return; if (!t0) t0 = ts; const t = (ts - t0) / 1000, sw = VW * m; // sw: screen width in metres
        if (ph === 'pan') { a.cam.x = cx + Math.sin(t * 0.85) * sw * 1.6; a.cam.y = cy + Math.sin(t * 0.55) * sw * 0.8; } // up to ~1.4 screens per second
        else if (ph === 'jerk') { const k = Math.floor(t / 0.4), f = (t % 0.4) / 0.4, e = f < 0.45 ? (1 - Math.cos(f / 0.45 * Math.PI)) / 2 : 1; // 0.18 s flick of 0.9 screen, then rest
          const dir = [[1, 0], [0, 1], [-1, 0.3], [-0.3, -1], [1, 1], [-1, -1]][k % 6], base = window.__jb || (window.__jb = { k: -1, x: cx, y: cy });
          if (base.k !== k) { if (base.k >= 0) { base.x = a.cam.x; base.y = a.cam.y; } base.k = k; }
          a.cam.x = base.x + dir[0] * sw * 0.9 * e; a.cam.y = base.y + dir[1] * sw * 0.9 * e; }
        else if (ph === 'zoom') { a.cam.m = m * Math.exp(Math.sin(t * 2.1) * 0.75); }
        requestAnimationFrame(mv); };
      window.__jb = null; a.cam.x = cx; a.cam.y = cy; a.cam.m = m;
      R.iv.length = 0; R.js.length = 0; R.last = 0; R.lt = 0; R.on = true; requestAnimationFrame(mv);
      await sl(dur); run = false; R.on = false; const st = a.stats(); a.cam.m = m;
      const P = window.__world && window.__world.PROF, prof = P ? Object.fromEntries(Object.entries(P).map(([k, v]) => [k, +v.toFixed(2)])) : {};
      const G = window.__world.gl.gpu || {}; const gpu = Object.values(G).reduce((q, v) => q + v, 0);
      return { iv: R.iv.slice(2), js: R.js.slice(2), lt: Math.round(R.lt), queue: st.queue, pending: st.pending, prof, gpu: +gpu.toFixed(2), gpuPass: Object.fromEntries(Object.entries(G).map(([k, v]) => [k, +v.toFixed(2)])) };
    }, [ph, m, env.city.x, env.city.y]);
    if (cdp && (ph === 'pan' || ph === 'jerk')) { const { profile } = await cdp.send('Profiler.stop'); out.profile[`${H}-${ph}`] = selfTimes(profile); }
    const iv = stat(r.iv), js = stat(r.js);
    const row = { H, ph, fps: +(1000 / (r.iv.reduce((s, x) => s + x, 0) / Math.max(1, r.iv.length))).toFixed(0), iv, js, over: r.iv.filter((x) => x > BUDGET * 1.15).length, jsOver: r.js.filter((x) => x > 6).length, lt: r.lt, missing: r.queue + r.pending, prof: r.prof, gpu: r.gpu, gpuPass: r.gpuPass };
    out.rows.push(row);
    console.log(`${String(H).padStart(6)} м ${ph.padEnd(5)} | FPS ${String(row.fps).padStart(4)} | кадр p50 ${iv.p50} p95 ${iv.p95} p99 ${iv.p99} max ${iv.max} | >6 мс: ${row.over}/${iv.n} | JS p50 ${js.p50} p95 ${js.p95} p99 ${js.p99} | long ${r.lt} мс | тайлов ждёт ${row.missing}${GPU ? ' | GPU ' + r.gpu + ' мс ' + JSON.stringify(r.gpuPass) : ''}`);
  }
}
if (PROFILE) {
  for (const [k, v] of Object.entries(out.profile)) console.log(`\nпрофиль ${k}: ` + v.slice(0, 12).map((f) => `${f.fn} ${f.ms} мс`).join(' · '));
}
fs.mkdirSync('bench', { recursive: true });
fs.writeFileSync(`bench/motion-${label}.json`, JSON.stringify(out, null, 1));
console.log(`\n→ bench/motion-${label}.json`, errs.length ? 'ошибки: ' + errs.slice(0, 3).join(' | ') : '');
await browser.close(); srv.close();

// self time per function (ms) from a V8 CPU profile, the main thread only
function selfTimes(p) {
  const dt = new Map(); const ids = new Map(p.nodes.map((n) => [n.id, n]));
  for (let i = 0; i < p.samples.length; i++) { const n = ids.get(p.samples[i]); const d = (p.timeDeltas[i] || 0) / 1000; const cf = n.callFrame; const key = `${cf.functionName || '(анон)'} ${(cf.url || '').split('/').pop().split('?')[0]}:${cf.lineNumber + 1}`; dt.set(key, (dt.get(key) || 0) + d); }
  return [...dt.entries()].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([fn, ms]) => ({ fn, ms: +ms.toFixed(1) }));
}

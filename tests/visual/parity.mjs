// Parity of the WebGL renderer with the Canvas 2D one of stage 5.13 (git ref, default origin/main): the same seed, camera
// and frozen time are rendered by both; tests/visual/diff.py compares the screenshots. The camera set-ups include clouds
// at several heights seen from different camera positions — the parallax must not move.
// node tests/visual/parity.mjs [ref]   → .work/parity/{old,new}-*.png and a report
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { launch, server } from '../lib/game.mjs';

const ref = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || 'origin/main';
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const OUT = '.work/parity';
fs.mkdirSync(OUT, { recursive: true });
const git = (p) => execSync(`git show ${ref}:${p}`, { encoding: 'utf8', maxBuffer: 1 << 26 });
const FREEZE = (s) => {
  const a = 'const dt=M.min(0.06,(now-last)/1000);';
  if (!s.includes(a)) throw new Error('freeze hook not found');
  const b = 'last=now;T+=dt;frameNo++;';
  if (!s.includes(b)) throw new Error('clock hook not found');
  return s.replace(a, 'const dt=window.__dt!=null?window.__dt:M.min(0.06,(now-last)/1000);').replace(b, 'last=now;T=window.__T!=null?window.__T:T+dt;frameNo++;');
};
// the reference is the whole page of the ref (all of src/), the new run only gets the clock hooks in main.js
const OLD = { 'index.html': git('index.html'), 'src/main.js': FREEZE(git('src/main.js')) };
for (const f of execSync(`git ls-tree --name-only ${ref} src/`, { encoding: 'utf8' }).split(/\r?\n/).filter((f) => /\.(js|css)$/.test(f))) if (!OLD[f]) OLD[f] = git(f);
const NEW = { 'src/main.js': FREEZE(fs.readFileSync('src/main.js', 'utf8')) };

// [name, x, y (fraction of the world or 'city'), m, tod, weather, dx (camera shift in metres)]
const VIEWS = [
  ['orbit', 'w', 0, 'max', 12, 1, 0],
  ['region-clouds', 'city', 0, 22, 12, 2, 0],
  ['region-clouds-pan', 'city', 0, 22, 12, 2, 6000],
  ['clouds-low', 'city', 0, 9, 12, 1, 0],
  ['clouds-low-pan', 'city', 0, 9, 12, 1, 1500],
  ['city', 'city', 0, 3, 12, 1, 0],
  ['street', 'city', 0, 0.4, 12, 1, 0],
  ['dusk', 'city', 0, 2.5, 18.7, 1, 0],
  ['night', 'city', 0, 1.6, 23, 1, 0],
  ['coast', 'port', 0, 1.5, 12, 0, 0],
];

async function shoot(tag, files) {
  const ctx = await (await browserP).newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.route(/\/(index\.html|src\/[^?]+\.(js|css))(\?|$)/, (r) => {
    const u = new URL(r.request().url()); const k = u.pathname.slice(1);
    if (files[k] !== undefined) return r.fulfill({ body: files[k], contentType: k.endsWith('.html') ? 'text/html' : k.endsWith('.css') ? 'text/css' : 'text/javascript' });
    return r.continue();
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html#1337,t12,w1`);
  await page.waitForFunction(() => window.__world && window.__world.W && window.__world.cache && window.__world.cache.size > 4, null, { timeout: 90000 });
  await page.evaluate(() => { __world.stop(); });
  const res = [];
  for (const [name, wx, wy, m, tod, w, dx] of VIEWS.filter((v) => !ONLY.length || ONLY.includes(v[0]))) {
    await page.evaluate(async ([wx, wy, m, tod, w, dx]) => {
      const A = window.__world, W = A.W, sl = (ms) => new Promise((r) => setTimeout(r, ms));
      window.__dt = null; window.__T = null;
      const c = W.cities.slice().sort((a, b) => b.R - a.R)[0];
      let x = W.WORLD / 2, y = W.WORLD / 2;
      if (wx === 'city') { x = c.x; y = c.y } else if (wx === 'port') { const z = W.zones.find((q) => q.zk === 'port') || c; x = z.x; y = z.y }
      A.setTod(tod); A.setWeather(w); A.setSpeed(0); A.closeInsp && A.closeInsp();
      A.cam.x = x + dx; A.cam.y = y; A.cam.m = m === 'max' ? A.maxM() : m;
      let q = 0, sig = ''; for (let i = 0; i < 1200; i++) { await sl(100); const s = A.stats(), g = s.tiles + '/' + s.lights; if (!s.queue && !s.pending && g === sig) { if (++q > 10) break } else q = 0; sig = g }
      // freeze the clock at the same moment in both runs: T is read from the engine and set by stepping dt
      window.__dt = 0; window.__T = 100000; await sl(900);
    }, [wx, wy, m, tod, w, dx]);
    const f = `${OUT}/${tag}-${name}.png`;
    await page.screenshot({ path: f });
    const st = await page.evaluate(() => { const s = __world.stats(); return s.tiles + '+' + s.lights + ' q' + s.queue + ' p' + s.pending; });
    console.log(tag, name, st);
    res.push(f);
  }
  await ctx.close();
  return { res, errs };
}

const PORT = 8160;
const srv = await server(PORT);
const browserP = launch();
const o = await shoot('old', OLD);
const n = await shoot('new', NEW);
(await browserP).close(); srv.close();
console.log('errors old', o.errs, 'new', n.errs);
console.log(execSync(`python tests/visual/diff.py ${OUT} ${VIEWS.filter((v) => !ONLY.length || ONLY.includes(v[0])).map((v) => v[0]).join(' ')}`, { encoding: 'utf8' }));

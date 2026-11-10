// Close-ups of every building type placed in the game (day), a rotated one and two neighbours side by side: the ground
// around them is what phase 5 checks (transitions, edges, blending, no seams). node tests/visual/buildings.mjs [outdir]
import fs from 'node:fs';
import { launch, server, DESKTOP, openMenu, newGame, settle } from '../lib/game.mjs';
const OUT = process.argv[2] || '.work/bld';
const SHOOT = (process.argv[3] || '').split(',').filter(Boolean); // only these close-ups (all are placed)
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8230;
const srv = await server(PORT);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await openMenu(page, PORT); await newGame(page); await settle(page, 15000);
const ORDER = ['village', 'farm', 'factory', 'power', 'solar', 'sawmill', 'refinery', 'barracks', 'sam', 'station', 'airport', 'droneport', 'dronefab', 'port', 'oil', 'gaswell', 'mine', 'dramp', 'drwy', 'dstore', 'city'];
const placed = await page.evaluate(async (ORDER) => {
  const T = Game._test, G = Game.G, W = Game.api.W, p = G.states[0], c = W.cities.find((o) => o.cap === 0); p.res.money = 1e9; p.res.energy = 999; Game.setSpeed(0); Game.api.stop();
  const out = [];
  const site = (k, ang, near) => {
    const cand = []; if (near) for (let a = 0; a < 6.28; a += 0.2) for (const r of near[2]) cand.push([near[0] + Math.cos(a) * r, near[1] + Math.sin(a) * r]);
    for (let r = 1500; r < 16000; r += 320) for (let a = 0; a < 6.28; a += 0.21) cand.push([c.x + Math.cos(a) * r, c.y + Math.sin(a) * r]);
    for (const d of G.dep) if (d.known && d.used < 0) cand.unshift([d.x, d.y]);
    for (const q of p.builds) if (q.k === 'droneport' && q.done) for (let a = 0; a < 6.28; a += 0.5) for (const r of [300, 500, 700]) cand.unshift([q.x + Math.cos(a) * r, q.y + Math.sin(a) * r]);
    for (const q of p.places) if (q.k === 'village') for (let a = 0; a < 6.28; a += 0.4) for (const r of [500, 800, 1100]) cand.unshift([q.x + Math.cos(a) * r, q.y + Math.sin(a) * r]);
    for (const [x, y] of cand) if (T.canBuild(k, x, y, ang) === null) return [x, y]; return null;
  };
  for (const k of ORDER) { const s = site(k, 0); if (!s) continue; T.startBuild(k, s[0], s[1]); out.push([k, s[0], s[1], 0]); T.run(k === 'village' || k === 'droneport' ? 40 : 2); }
  // a factory turned by 30° and two power plants as close as the rules allow
  { const s = site('factory', Math.PI / 6); if (s) { T.startBuild('factory', s[0], s[1], Math.PI / 6); out.push(['factory-rot', s[0], s[1], Math.PI / 6]); } }
  // two factories side by side, 14 m apart (the rules want 8 m): their aprons must merge into one
  { const Wf = T.BLD.factory.W; for (let r = 2000; r < 15000 && !out.some((o) => o[0] === 'pair'); r += 400) for (let an = 0; an < 6.28; an += 0.3) { const x = c.x + Math.cos(an) * r, y = c.y + Math.sin(an) * r;
      if (T.canBuild('factory', x, y) === null && T.canBuild('factory', x + Wf + 14, y) === null) { T.startBuild('factory', x, y); if (T.canBuild('factory', x + Wf + 14, y) === null) { T.startBuild('factory', x + Wf + 14, y); out.push(['pair', x + (Wf + 14) / 2, y, 0]); } break; } } }
  T.run(200);
  return out;
}, ORDER);
for (const [k, x, y] of placed.filter((p) => !SHOOT.length || SHOOT.includes(p[0]))) {
  for (const [tag, m] of [['near', 0.55], ['far', 1.8]]) {
    await page.evaluate(async ([x, y, m]) => { const a = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)); a.setTod(12); a.setWeather(0); a.cam.x = x; a.cam.y = y; a.cam.m = m;
      let q = 0; for (let i = 0; i < 200; i++) { await sl(100); const s = a.stats(); if (!s.queue && !s.pending) { if (++q > 6) break } else q = 0 } await sl(300); }, [x, y, m]);
    await page.screenshot({ path: `${OUT}/${k}-${tag}.png` });
  }
}
console.log('placed', placed.map((p) => p[0]).join(' '), 'errors', errs.slice(0, 3));
await browser.close(); srv.close();

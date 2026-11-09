// Браузерный тест этапа 5.14 (после основания столицы, на двух сидах):
// - нет диагональных бульваров («креста») ни в одной столице;
// - нет кольцевой трассы вокруг столиц (ни флага ring, ни дороги, огибающей город больше чем на полкруга);
// - здания правительственного квартала стоят внутри своего квартала и не налезают друг на друга;
// - на круглой центральной площади нет зданий;
// - общий порядок отрисовки зданий ничего не теряет (каждый примитив квартала нарисован ровно один раз);
// - плитка над центром столицы рисует здания строго от дальних к ближним (нет ни одной пары, где южное здание
//   нарисовано раньше северного, которое оно перекрывает);
// - пока камера летит к столице, слои облаков и их теней не перерисовываются каждый кадр.
// Запуск: node tests/game514.mjs  (входит в npm run test:browser)
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const PORT = 8102;
const server = await serve(PORT);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
const check = (ok, name, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const lays = new Set();
  for (const seed of [1337, 4242]) {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);
    await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 60000 });
    await page.evaluate(() => localStorage.clear());
    await page.click('[data-go="new"]');
    await page.evaluate((s) => { const C = __ui.C; C.seed = s; C.rules.botCount = 3; C.slot = 7; C.rules.ai = 0; }, seed);
    await page.click('#screate');
    await page.waitForFunction(() => Game.api && Game.api.ready, null, { timeout: 60000 });
    await page.evaluate(() => { for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
    await page.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 60000 });
    await page.evaluate(() => { Game.setSpeed(0); Game._test.run(400); });

    const geo = await page.evaluate(() => {
      const W = Game.api.W, D = W._dbg, out = { caps: [] };
      const isUS = (p) => (p.k === 'b' && p.lvl === undefined && p.H0 === undefined) || p.k === 'cyl';
      const box = (p) => p.k === 'cyl' ? [p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r] : [p.x, p.y, p.x + p.w, p.y + p.h];
      const ov = (a, b) => a[0] < b[2] - 0.2 && b[0] < a[2] - 0.2 && a[1] < b[3] - 0.2 && b[1] < a[3] - 0.2;
      out.dg = W.roads.filter((r) => r.dg).length;
      out.ringFlag = W.roads.filter((r) => r.ring).length;
      for (const c of W.cities.filter((q) => q.cap !== undefined)) {
        const o = { id: c.id, lay: c.lay, type: c.type, R: Math.round(c.R), dgl: (c.dgl || []).length, rings: (c.rings || []).length, ringLike: 0, streets: 0, offAxis: 0, blocks: 0, gov: 0, govN: 0, govBad: [], plazaHit: 0, prims: 0, lost: 0, overlapRaw: 0, err: null };
        for (const r of W.roads) { if (r.k !== 0 && r.k !== 1) continue; const bins = new Set();
          for (let i = 0; i < r.n; i++) { const x = r.pts[i * 2] - c.x, y = r.pts[i * 2 + 1] - c.y, d = Math.hypot(x, y); if (d > c.R * 0.8 && d < c.R * 1.6) bins.add(Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI * 2) * 36)); }
          if (bins.size >= 18) o.ringLike++; }
        if (c.lay === 'grid') { const ang = Math.atan2(c.sa, c.ca);
          for (const r of W.roads) { if (r.city !== c.id) continue; o.streets++; for (let i = 0; i + 1 < r.n; i++) { const dx = r.pts[i * 2 + 2] - r.pts[i * 2], dy = r.pts[i * 2 + 3] - r.pts[i * 2 + 1]; if (Math.hypot(dx, dy) < 40) continue; const q = Math.PI / 2; let d = ((Math.atan2(dy, dx) - ang) % q + q) % q; d = Math.min(d, q - d); if (d > 0.35) { o.offAxis++; break; } } } }
        const BD = c.D - 1;
        for (let bj = 0; bj < BD; bj++) for (let bi = 0; bi < BD; bi++) { const t = c.blocks[bj * BD + bi]; if (!t) continue; if (t === 21) o.gov++;
          let P; try { P = D.genBlock(c, bi, bj, t); } catch (e) { o.err = String(e); continue; } if (!P || !P.length) continue; o.blocks++;
          const U = D.unitsOf(P); let n = U.pre.length; for (const u of U.U) n += u.a.length; o.prims += P.length; o.lost += Math.abs(P.length - n);
          const S = P.filter(isUS).map(box); for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) if (ov(S[i], S[j])) o.overlapRaw++;
          const bf = W.blkFrame(c, bi, bj);
          if (t === 21) { const g = P.find((p) => p.k === 'g'); const B = g ? [g.x, g.y, g.x + g.w, g.y + g.h] : [-bf[4], -bf[5], bf[4], bf[5]]; const Sb = P.filter((p) => p.k === 'b' && p.lvl === undefined && p.H0 === undefined); o.govN += Sb.length;
            for (const p of Sb) { const b = box(p); if (b[0] < B[0] - 0.5 || b[1] < B[1] - 0.5 || b[2] > B[2] + 0.5 || b[3] > B[3] + 0.5) o.govBad.push('out ' + b.map((v) => Math.round(v)).join(',') + ' / ' + B.map((v) => Math.round(v)).join(',')); }
            for (let i = 0; i < Sb.length; i++) for (let j = i + 1; j < Sb.length; j++) if (ov(box(Sb[i]), box(Sb[j]))) o.govBad.push('overlap ' + i + '/' + j); }
          if (c.pol && c.px !== undefined) { const rp = c.pol.rin - 18; for (const p of P) { if (!isUS(p)) continue; const b = box(p);
            for (let k = 0; k < 4; k++) { const lx = k & 1 ? b[2] : b[0], ly = k & 2 ? b[3] : b[1]; const wx = bf[0] + lx * bf[2] - ly * bf[3], wy = bf[1] + lx * bf[3] + ly * bf[2]; if (Math.hypot(wx - c.px, wy - c.py) < rp) { o.plazaHit++; break; } } } } }
        out.caps.push(o); }
      return out; });
    for (const o of geo.caps) lays.add(o.lay);
    const cs = geo.caps;
    console.log('     seed ' + seed + ': ' + JSON.stringify(cs.map((o) => ({ lay: o.lay, type: o.type, R: o.R, blocks: o.blocks, prims: o.prims, overlapRaw: o.overlapRaw, streets: o.streets, offAxis: o.offAxis, govN: o.govN }))));
    check(cs.length >= 4, `сид ${seed}: найдены столицы`, String(cs.length));
    check(geo.dg === 0 && cs.every((o) => o.dgl === 0), `сид ${seed}: нет диагональных бульваров («креста»)`, 'dg ' + geo.dg + ', dgl ' + cs.map((o) => o.dgl).join('/'));
    check(geo.ringFlag === 0 && cs.every((o) => o.rings === 0 && o.ringLike === 0), `сид ${seed}: нет кольцевой трассы вокруг столиц`, 'ring ' + geo.ringFlag + ', огибающих ' + cs.map((o) => o.ringLike).join('/'));
    check(cs.every((o) => o.gov === 1 && o.govN > 0 && o.govBad.length === 0), `сид ${seed}: правительственный квартал в своих границах, здания не налезают`, JSON.stringify(cs.map((o) => [o.gov, o.govN, o.govBad.slice(0, 3)])));
    check(cs.every((o) => o.plazaHit === 0), `сид ${seed}: на круглой площади нет зданий`, cs.map((o) => o.plazaHit).join('/'));
    check(cs.every((o) => o.lost === 0 && o.prims > 0 && !o.err), `сид ${seed}: порядок отрисовки не теряет ни одного примитива`, JSON.stringify(cs.map((o) => [o.prims, o.lost, o.err])));

    const pt = await page.evaluate(() => { const W = Game.api.W, D = W._dbg, res = [];
      for (const c of W.cities.filter((q) => q.cap !== undefined)) { const z = Math.round(Math.log2(W.WORLD / (W.TS * 0.8))), ts = W.WORLD / (1 << z), tx = Math.floor(c.x / ts), ty = Math.floor(c.y / ts);
        D.paintLog(true); let err = null; try { W.renderTile(z, tx, ty); } catch (e) { err = String(e); } const L = D.paintLog(false) || [];
        let sorted = true, viol = 0; for (let i = 1; i < L.length; i++) if (L[i][0] < L[i - 1][0]) sorted = false;
        for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a[2] >= b[4] - 0.01 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1) viol++; }
        res.push({ lay: c.lay, z, units: L.length, sorted, viol, err }); }
      return res; });
    check(pt.length && pt.every((r) => !r.err && r.units > 20 && r.sorted && r.viol === 0), `сид ${seed}: здания плитки рисуются от дальних к ближним`, JSON.stringify(pt));

    if (seed === 1337) {
      const cl = await page.evaluate(async () => { const w = window.__world; if (!w || !w.cloudLayers) return { err: 'нет __world.cloudLayers' }; const W = Game.api.W, c = W.cities.find((o) => o.cap === 0), sl = (ms) => new Promise((r) => setTimeout(r, ms));
        if (w.setTod) w.setTod(12); if (w.setWeather) w.setWeather(2);
        w.cam.x = c.x; w.cam.y = c.y; w.cam.m = 60; await sl(1500);
        const L = w.cloudLayers, n0 = [L[0].n, L[1].n], r0 = [L[0].rd || 0, L[1].rd || 0]; const ft = []; let last = performance.now(), run = true;
        const loop = (t) => { ft.push(t - last); last = t; if (run) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
        w.flyTo(c.x, c.y, 1.2, 4); await sl(4300); run = false;
        return { frames: ft.length, shadows: (L[0].rd || 0) - r0[0], clouds: (L[1].rd || 0) - r0[1], n0 }; });
      // zoom 60 -> 1.2 is ln 50 = 3.9: at most 3.9/0.1 cloud redraws and 3.9/0.15 shadow redraws (+5 for start/stop/edges)
      check(!cl.err && cl.frames > 10 && cl.clouds <= 45 && cl.shadows <= 32, 'при полёте к столице облака не перерисовываются каждый кадр', JSON.stringify(cl));
    }
  }
  console.log('     планировки: ' + [...lays].join(', '));
  for (const e of errors) console.log('     ' + e);
  check(errors.length === 0, 'без ошибок на странице');
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);

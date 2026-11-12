// Браузерный тест этапа 5.11: аэропорт и рейсы (пассажирские — в свои аэропорты и в страны с безвизом, грузовые — свои
// и экспорт в мирные страны), безвиз в дипломатии, война отменяет безвиз; ЖД путь обходит город; планировка столицы.
// Запуск: node tests/game511.mjs  (входит в npm run test:browser)
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const PORT = 8098;
const server = await serve(PORT);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
const check = (ok, name, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.click('[data-go="new"]');
  await page.evaluate(() => { const C = __ui.C; C.seed = 1337; C.rules.botCount = 2; C.slot = 6; C.rules.ai = 0; });
  await page.click('#screate');
  await page.waitForFunction(() => Game.api && Game.api.ready, null, { timeout: 60000 });
  await page.evaluate(() => { for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 60000 });

  // ---- столица — не квадратная решётка: у неё одна из планировок
  const lay = await page.evaluate(() => { const W = Game.api.W; return W.cities.filter((c) => c.cap !== undefined).map((c) => c.lay); });
  check(lay.length >= 3 && new Set(lay).size === lay.length && lay.every((l) => ['free', 'mixed', 'grid', 'bent', 'organic'].includes(l)), 'у столиц разные планировки (без колец и лучей, этап 6.2)', lay.join(', '));

  // ---- аэропорты: ключ на вкладке «Города», два своих и один у соседа
  await page.evaluate(() => { Game.setSpeed(0); Game._test.run(30); });
  const key = await page.evaluate(() => !!document.querySelector('#bb-cat [data-k="airport"]'));
  check(key, 'ключ «Аэропорт» на вкладке «Города»');
  const ap = await page.evaluate(() => { const T = Game._test, G = Game.G; for (const s of G.states) { s.res.money = 1e8; s.res.energy = 999; }
    const put = (i, c, skip) => { for (let rr = 2500; rr < 30000; rr += 400) for (let a = 0; a < 6.28; a += 0.12) { const x = c.x + Math.cos(a) * rr, y = c.y + Math.sin(a) * rr; if (skip && Math.hypot(x - skip[0], y - skip[1]) < 6000) continue; if (T.canBuildFor(i, 'airport', x, y) === null && T.startBuildFor(i, 'airport', x, y)) return [x, y]; } return null; };
    const c0 = G.states[0].places[0], a = put(0, c0), b = put(0, c0, a), c = put(1, G.states[1].places[0]); T.run(30);
    return { a, b, c, done: G.states.map((s) => s.builds.filter((q) => q.k === 'airport' && q.done).length) }; });
  check(ap.a && ap.b && ap.c && ap.done[0] === 2 && ap.done[1] === 1, 'аэропорты построены (2 своих, 1 у соседа)', JSON.stringify(ap));

  // ---- ЖД путь между вокзалами по разные стороны столицы обходит город
  const rail = await page.evaluate(() => { const T = Game._test, G = Game.G, W = Game.api.W, p = G.states[0], c = W.cities.find((o) => o.cap === 0); const st = [];
    for (let a = 0; a < 6.28 && st.length < 2; a += 0.2) { if (st.length === 1 && Math.abs(((a - st[0].a + 9.42) % 6.283) - 3.14) > 0.5) continue; for (let d = c.R * 1.1; d < c.R * 1.3 + 3000; d += 150) { if (st.length && st.length === 1 && st[0].done) break; const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d; if (T.canBuild('station', x, y) === null && T.startBuild('station', x, y)) { st.push({ a, q: p.builds[p.builds.length - 1] }); break; } } }
    if (st.length < 2) { const d = c.R * 1.3 + 1500; return { st: st.length, why: [0, 1.57, 3.14, 4.71].map((a) => T.canBuild('station', c.x + Math.cos(a) * d, c.y + Math.sin(a) * d)) }; } T.run(20); const za = W.zones[st[0].q.id], zb = W.zones[st[1].q.id]; const P = W.railPts(za, zb); if (typeof P === 'string') return { why: P };
    let minF = 9; for (let i = 0; i < P.length; i += 2) minF = Math.min(minF, Math.hypot(P[i] - c.x, P[i + 1] - c.y) / c.R); return { ok: true, minF, n: P.length / 2 }; });
  check(rail.ok && rail.minF > 1, 'ЖД путь сам огибает столицу (не заходит в застройку)', JSON.stringify(rail));

  // ---- рейсы: самолёты взлетают, летят, садятся; пассажирские к соседу — только с безвизом
  const f1 = await page.evaluate(() => { const T = Game._test, G = Game.G, p = G.states[0]; const m0 = p.res.money; T.run(700);
    const F = G.flights || [], toN = F.filter((f) => f.st === 0 && f.to === 1);
    return { air: F.length, gfl: Game.api.gflights.length, landed: p.landed || 0, paxN: toN.filter((f) => f.kind === 'pax').length, cargoN: toN.filter((f) => f.kind === 'cargo').length, own: F.filter((f) => f.st === 0 && f.to === 0).length, money: p.res.money - m0, visa: T.visa(1) }; });
  check(f1.air > 0 && f1.gfl === f1.air, 'самолёты в воздухе (и в небе движка)', JSON.stringify(f1));
  check(f1.landed > 0, 'рейсы садятся и приносят деньги', 'посадок ' + f1.landed);
  check(!f1.visa && f1.paxN === 0, 'без безвиза к соседу летят только грузовые', JSON.stringify(f1));
  const geo = await page.evaluate(() => { const G = Game.G, f = G.flights[0], g = f.g, W = Game.api.W, za = W.zones[f.a.id], [r0, r1] = W.air2Rw(za);
    const d0 = Math.min(Math.hypot(g.pts[0] - r0[0], g.pts[1] - r0[1]), Math.hypot(g.pts[0] - r1[0], g.pts[1] - r1[1])); return { d0, L: g.L, n: g.n, s: g.s }; });
  check(geo.d0 < 1 && geo.L > 5000 && geo.s >= 0, 'рейс начинается разбегом по ВПП своего аэропорта', JSON.stringify(geo));
  await page.evaluate(() => Game._test.signVisa(1));
  const f2 = await page.evaluate(() => { const T = Game._test, G = Game.G, t0 = G.t; T.run(600); const H = (G.fhist || []).filter((h) => h[3] >= t0); return { visa: T.visa(1), pax: H.filter((h) => h[2] === 'pax' && (h[0] !== h[1])).length, n: H.length }; });
  check(f2.visa && f2.pax > 0, 'с безвизом к соседу летят и пассажирские рейсы', JSON.stringify(f2));
  const card = await page.evaluate(() => { const q = Game.G.states[0].builds.find((b) => b.k === 'airport' && b.done); return { q: !!q, uid: q && q.uid }; });
  check(card.q, 'аэропорт стоит до войны');
  // дипломатия: строка соседа показывает безвиз; война его отменяет и рейсы к врагу прекращаются
  await page.evaluate(() => { document.getElementById('dip').classList.add('show'); });
  await page.waitForTimeout(600);
  const dip = await page.evaluate(() => document.getElementById('dipb').textContent);
  check(/безвиз/.test(dip), 'в «Дипломатии» отмечен безвиз');
  const war = await page.evaluate(() => { const T = Game._test, G = Game.G; T.declareWar(1); const v = T.visa(1); const n0 = (G.flights || []).filter((f) => f.st === 0 && f.to === 1).length; T.run(500); const n1 = (G.flights || []).filter((f) => f.st === 0 && f.to === 1 && f.t0 > G.t - 500).length; return { v, n0, n1 }; });
  check(!war.v && war.n1 === 0, 'война отменяет безвиз и рейсы к врагу', JSON.stringify(war));
  await page.evaluate(() => { document.getElementById('dip').classList.remove('show'); });

  for (const e of errors) console.log('     ' + e);
  check(errors.length === 0, 'без ошибок на странице');
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);

// Браузерный тест этапа 5.9 (первая часть): село и город появляются сразу и растут, разные планировки сёл,
// постройка рядом с другой (зазор 8 м), панель «Залежи» и карточка залежи с постройкой, «Штаб», значки построек.
// Запуск: node tests/game59.mjs  (входит в npm run test:browser)
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const PORT = 8097;
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
  await page.evaluate(() => { Game.setSpeed(0); Game._test.run(30); Game.G.states[0].res.money = 1e7; });

  // ---- село появляется сразу и растёт, пока строится; у сёл разные планировки
  const v = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], c = s.places[0], W = Game.api.W, out = [];
    for (let r = 3000; r < 16000 && out.length < 6; r += 400) for (let a = 0; a < 6.28 && out.length < 6; a += 0.45) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild('village', x, y) === null && T.startBuild('village', x, y)) out.push(s.builds[s.builds.length - 1]); }
    const q = out[0], p = s.places.find((o) => o.bq === q.uid); const g0 = p && p.grow, g0w = W.growOf(p.id), now = !!p && q.id === p.id && !q.done; T.run(4); const g1 = p.grow; T.run(10);
    return { n: out.length, now, g0, g0w, g1, g2: p.grow, done: q.done, lays: [...new Set(out.map((b) => W.cities[b.id].vlay))].length, places: s.places.filter((o) => o.k === 'village').length }; });
  check(v.n >= 4 && v.now && v.g0 < 0.2 && v.g0w < 1 && v.g1 > v.g0 && v.g1 < 1 && v.g2 === 1 && v.done && v.places === v.n, 'село сразу на карте и растёт во время стройки (как город)', JSON.stringify(v));
  check(v.lays >= 3, 'у сёл разные планировки улиц', 'вариантов: ' + v.lays);
  const ring = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], c = s.places[0]; for (let r = 4000; r < 16000; r += 400) for (let a = 0; a < 6.28; a += 0.45) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild('city', x, y) === null && T.startBuild('city', x, y)) { const q = s.builds[s.builds.length - 1]; return { id: q.id, place: s.places.some((o) => o.bq === q.uid) }; } } return null; });
  check(ring && ring.id >= 0 && ring.place, 'город тоже появляется сразу при закладке', JSON.stringify(ring));

  // ---- постройка рядом с другой: зазор 8 м, а не 30
  const gap = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], c = s.places[0], W = Game.api.W, B = T.BLD;
    for (let r = 1500; r < 12000; r += 300) for (let a = 0; a < 6.28; a += 0.3) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild('factory', x, y) === null) { T.startBuild('factory', x, y); T.run(20);
      const q = s.builds[s.builds.length - 1], z = W.zones[q.id]; const near = [];
      for (const d of [14, 25]) { const sx = z.x + z.ca * (z.W / 2 + B.solar.W / 2 + d), sy = z.y + z.sa * (z.W / 2 + B.solar.W / 2 + d); near.push(T.canBuild('solar', sx, sy)); }
      const inside = T.canBuild('solar', z.x, z.y); return { near, inside }; } } return null; });
  check(gap && gap.near.every((r) => r === null || !/Занято/.test(r)) && /Занято/.test(gap.inside || ''), 'солнечные панели можно поставить в 14 м от завода, на заводе — нельзя', JSON.stringify(gap));

  // ---- «Залежи»: список свободных на своей земле, клик — камера и карточка, ключ ставит рудник
  const ores = await page.evaluate(() => { const G = Game.G, own = Game._test.own; for (const d of G.dep) if (own[d.c] === 1) d.known = true; return G.dep.filter((d) => d.known && d.used < 0 && d.amt > 0 && own[d.c] === 1).length; });
  await page.click('#b-ores');
  await page.waitForTimeout(400);
  const ol = await page.evaluate(() => ({ show: document.getElementById('orep').classList.contains('show'), rows: document.querySelectorAll('#orel [data-dep]').length, chips: document.querySelectorAll('#oref button').length, badge: document.getElementById('oren').textContent }));
  check(ol.show && ol.rows === ores && ol.chips === 8 && +ol.badge === ores, 'панель «Свободные залежи»: фильтры по ресурсам и список (' + ores + ')', JSON.stringify(ol));
  if (ol.rows) {
    await page.click('#orel [data-dep]');
    await page.waitForTimeout(500);
    const card = await page.evaluate(() => ({ sel: Game.G.sel && Game.G.sel.dep, title: (document.querySelector('#gpanel .pc-t b') || {}).textContent, key: !!document.getElementById('a-depb'), shown: document.body.classList.contains('sel') }));
    check(card.sel != null && /Залежь/.test(card.title) && card.key && card.shown, 'клик по строке — карточка «Залежь: …» с ключом постройки', JSON.stringify(card));
    const before = await page.evaluate(() => Game.G.states[0].builds.length);
    await page.evaluate(() => { const b = document.getElementById('a-depb'); if (b && !b.disabled) b.click(); });
    const built = await page.evaluate((n) => { const s = Game.G.states[0], q = s.builds[s.builds.length - 1]; return { more: s.builds.length > n, k: q.k, dep: q.dep }; }, before);
    check(built.more && ['mine', 'oil', 'gaswell'].includes(built.k) && built.dep != null, 'ключ в карточке ставит добычу прямо на залежь', JSON.stringify(built));
  }
  await page.click('#b-hq');
  const hq = await page.evaluate(() => ({ show: document.getElementById('hqp').classList.contains('show'), ores: document.getElementById('orep').classList.contains('show'), txt: document.getElementById('hqb').textContent }));
  check(hq.show && !hq.ores && /Войны/.test(hq.txt) && /Армии/.test(hq.txt) && /ПВО/.test(hq.txt), '«Штаб»: войны, угрозы, армии, дроны и ПВО (и закрывает «Залежи»)', JSON.stringify({ show: hq.show, ores: hq.ores }));
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !document.getElementById('hqp').classList.contains('show')), 'Esc закрывает «Штаб»');

  // ---- значки залежей пропадают у облаков, постройки отмечены на карте и миникарте
  const far = await page.evaluate(() => { const A = Game.api; return { m: A.maxM() }; });
  check(far.m > 75, 'у облаков (высота камеры ' + Math.round(far.m) + ' м/пикс) значки залежей не рисуются');
  // ---- облака: полное разрешение, у неподвижной камеры слой не перерисовывается (FPS у облаков)
  await page.evaluate(() => { const A = Game.api; A.stop(); A.cam.m = A.maxM(); Game.setSpeed(0); });
  await page.waitForTimeout(2500);
  const cl = await page.evaluate(async () => { const L = __world.cloudLayers[1], k0 = L.key, w = L.c.width || L.c.w; await new Promise((r) => setTimeout(r, 1200)); return { same: L.key === k0, full: w >= innerWidth * Math.min(devicePixelRatio, 2) * 0.99, n: L.n, p: +__world.PROF.clouds.toFixed(2) }; });
  check(cl.same && cl.full && cl.n > 50, 'облака в полном разрешении, все; у неподвижной камеры слой не перерисовывается', JSON.stringify(cl));
  for (const e of errors) console.log('     ' + e);
  check(errors.length === 0, 'без ошибок на странице');
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);

// Браузерный тест этапа 6.2: стройка стоит на месте сразу, АЭС на уране, ПВО как в DroneFlames (виды, «Цели ПВО», РЛС, РЭБ,
// «Ёлки» ночью), разведка Орланом с лимитом на дронопорт, удар по точкам маршрута, причина простоя цеха с кнопкой.
// Запуск: node tests/game62.mjs
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
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 180000 });
  await page.evaluate(() => localStorage.clear());
  await page.click('[data-go="new"]');
  await page.evaluate(() => { const C = __ui.C; C.seed = 1337; C.rules.botCount = 2; C.slot = 6; C.rules.ai = 0; });
  await page.click('#screate');
  await page.waitForFunction(() => Game.api && Game.api.ready, null, { timeout: 180000 });
  await page.evaluate(() => { for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 180000 });
  // the player gets money, metal and land around the capital
  await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], c = s.places[0]; Game.setSpeed(0); T.run(5); s.res.money = 1e7; s.res.metal = 500; T.claim(0, c.x, c.y, 11000); });
  await page.waitForTimeout(400);
  // helpers in the page: put a building of kind k at the nearest free spot r0… m from the capital (or from a point)
  await page.evaluate(() => { window.put = (k, r0, ox, oy) => { const T = Game._test, c = Game.G.states[0].places[0], X = ox != null ? ox : c.x, Y = oy != null ? oy : c.y;
      for (let r = r0; r < 9000; r += 120) for (let a = 0; a < 6.28; a += 0.2) { const x = X + Math.cos(a) * r, y = Y + Math.sin(a) * r; if (T.canBuild(k, x, y) === null && T.startBuild(k, x, y)) return Game.G.states[0].builds[Game.G.states[0].builds.length - 1]; } return null; };
    window.done = (q) => { q.t = q.time - 0.01; Game._test.run(0.2); return q.done; }; });

  // ---- стройка: здание сразу стоит в мире участком и доходит до готового
  const con = await page.evaluate(() => { const q = put('factory', 1800); if (!q) return { err: 'нет места' }; const z0 = Game.api.W.zones[q.id], st0 = z0 && z0.con;
    q.t = q.time * 0.7; Game._test.run(0.2); const st1 = Game.api.W.zones[q.id].con; done(q); return { id: q.id, st0, st1, st2: Game.api.W.zones[q.id].con, done: q.done }; });
  check(!con.err && con.id >= 0 && con.st0 === 1 && con.st1 === 3 && con.st2 === 0 && con.done, 'стройка: здание сразу на карте (этап 1 → 3), после — готовое', JSON.stringify(con));

  // ---- АЭС: даёт энергию, пока есть уран
  const npp = await page.evaluate(() => { const s = Game.G.states[0], q = put('npp', 2500); if (!q) return { err: 'нет места' }; done(q);
    s.res.uran = 0; Game._test.run(0.5); const off = s.energy[0]; s.res.uran = 30; Game._test.run(1); const on = s.energy[0], used = 30 - s.res.uran;
    return { off, on, used: +used.toFixed(2), stall: (Game._test.stallOf(s, q) || [''])[0] }; });
  check(!npp.err && npp.on >= npp.off + 59 && npp.used > 0.05, 'АЭС: +60 энергии на уране, уран расходуется', JSON.stringify(npp));

  // ---- ПВО: дрон врага над ЗСУ сбивают; по правилу «Только реактивные» ЗСУ не стреляет по Ланцету
  const ad = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], b = Game.G.states[1]; T.declareWar(1); const q = put('zsu', 3000); done(q);
    const shoot = () => { let k = 0; for (let i = 0; i < 40; i++) { const d = { st: 1, to: 0, x: q.x + 300, y: q.y, tx: q.x, ty: q.y, kind: 'lancet', life: 0, ph: 'go', uid: 9000 + i * 7 }; let hit = false; for (let t = 0; t < 30 && !hit; t++) { d.life += 0.1; hit = T.adShoot(d, 0.1); } if (hit) k++; } return k; };
    s.adr = JSON.parse(JSON.stringify(T.ADPRE.all)); const all = shoot(); s.adr = JSON.parse(JSON.stringify(T.ADPRE.jet)); const jet = shoot(); s.adr = JSON.parse(JSON.stringify(T.ADPRE.all));
    return { all, jet, q: q.k }; });
  check(ad.all >= 10 && ad.jet === 0, 'ПВО: ЗСУ сбивает Ланцеты рядом; «Только реактивные» — не стреляет по ним', JSON.stringify(ad));

  // ---- РЛС: ЗРК без неё бьёт на 4 км, с ней — на 9 км
  const rls = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], q = put('sam', 4000); done(q); const far = { x: q.x + 7000, y: q.y };
    const before = T.radarSees(s, far.x, far.y); const r = put('rls', 300, q.x, q.y); done(r); s.eK = 1; const after = T.radarSees(s, far.x, far.y); return { before, after }; });
  check(!rls.before && rls.after, 'РЛС: ЗРК видит цель за 4 км только под её полем', JSON.stringify(rls));

  // ---- «Ёлки» не летают ночью
  const yolka = await page.evaluate(() => { const T = Game._test, a = Game.api; a.setTod(13); const day = T.intOk(); a.setTod(1); const night = T.intOk(); a.setTod(13); return { day, night }; });
  check(yolka.day && !yolka.night, 'перехватчики «Ёлка»: днём летают, ночью — нет', JSON.stringify(yolka));

  // ---- окно «Цели ПВО»: пресеты и клетки, клетка «Ёлка × реактивные» закрыта
  await page.click('#bb-tabs [data-t="aa"]');
  const aaKeys = await page.evaluate(() => [...document.querySelectorAll('#bb-cat .bcat b')].map((b) => b.textContent).join(','));
  check(aaKeys === 'ЗСУ,ЗРК,Перехват,РЛС,РЭБ,Цели ПВО' && !/№/.test(aaKeys), 'вкладка «ПВО» как в DroneFlames: ЗСУ, ЗРК, перехватчики, РЛС, РЭБ, «Цели ПВО» (без «ПВО №1»)', aaKeys);
  await page.click('#bb-cat [data-go="adr"]');
  const adrW = await page.evaluate(() => ({ show: document.getElementById('adr').classList.contains('show'), cells: document.querySelectorAll('#adrb .ar-c').length, locked: document.querySelectorAll('#adrb .ar-c.lock').length, pre: document.querySelectorAll('#adrb [data-pre]').length }));
  await page.click('#adrb [data-pre="eco"]');
  const eco = await page.evaluate(() => JSON.stringify(Game.G.states[0].adr.sam));
  check(adrW.show && adrW.cells === 9 && adrW.locked === 1 && adrW.pre === 3 && eco === '{"uav":0,"jet":1,"recon":0}', '«Цели ПВО»: 3 вида × 3 цели, «Экономно» бережёт ЗРК для реактивных', JSON.stringify(adrW) + ' ' + eco);
  await page.click('#adrx');

  // ---- армия: военная часть и «Армии», без значков «Армия №1»
  await page.click('#bb-tabs [data-t="army"]');
  const armyKeys = await page.evaluate(() => [...document.querySelectorAll('#bb-cat .bcat b')].map((b) => b.textContent).join(','));
  check(!/№/.test(armyKeys) && /Армии/.test(armyKeys), 'вкладка «Армия»: без значков «Армия №1»', armyKeys);

  // ---- разведка: один Орлан на дронопорт с рампой, второй — после возвращения; цех Орланы не делает
  const rec = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], p = put('droneport', 2600); done(p); const ramp = put('dramp', 160, p.x, p.y); done(ramp); const pw = put('power', 3500); done(pw); T.run(0.5);
    const c = s.places[0], w0 = T.reconWhy(s, c.x + 5000, c.y), l1 = T.launchRecon(s, c.x + 5000, c.y), w1 = T.reconWhy(s, c.x + 5000, c.y);
    const fab = put('dronefab', 2000); done(fab); const fabOrlan = [...document.querySelectorAll('[data-make]')].some((e) => e.dataset.make === 'orlan');
    return { w0, l1, w1, fabOrlan }; });
  check(rec.w0 === null && rec.l1 === null && /воздухе/.test(rec.w1) && !rec.fabOrlan, 'разведка: Орлан с рампы дронопорта, второй — нельзя («Все Орланы в воздухе»)', JSON.stringify(rec));

  // ---- удар по точкам маршрута: дрон проходит через точку, затем к цели
  const route = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], b = Game.G.states[1], bc = b.places[0], c = s.places[0]; s.uav = { lancet: 2, geran: 0, orlan: 0 };
    const wp = { x: (c.x + bc.x) / 2 + 2500, y: (c.y + bc.y) / 2 - 2500 }; const why = Game._test.launchUav ? null : 'no'; Game.G.drones.length = 0;
    const r = Game.G.states[0].builds.find((q) => q.k === 'dramp'); s.uav.lancet = 1; const res = T.launchUav('lancet', bc.x, bc.y, 1, [wp]); const d = Game.G.drones[Game.G.drones.length - 1]; if (!d) return { err: res };
    let near = 1e9; for (let i = 0; i < 4000 && Game.G.drones.includes(d); i++) { T.stepDrones(0.1); near = Math.min(near, Math.hypot(d.x - wp.x, d.y - wp.y)); }
    return { near: Math.round(near), wps: d.wps.length }; });
  check(!route.err && route.near < 60 && route.wps === 0, 'удар: дрон летит через точку маршрута', JSON.stringify(route));

  // ---- цех: «дронопорт заполнен» с кнопкой «+ Склад»
  const stall = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], f = s.builds.find((q) => q.k === 'dronefab'); s.uav = { lancet: 20, geran: 0, orlan: 0 }; f.queue = ['lancet']; T.run(0.5); return T.stallOf(s, f); });
  check(stall && /заполнен/.test(stall[0]) && stall[1] === 'store', 'цех БПЛА: причина простоя «дронопорт заполнен» и кнопка «+ Склад»', JSON.stringify(stall));

  check(errors.length === 0, 'без ошибок на странице', errors.slice(0, 3).join(' | '));
} catch (e) { check(false, 'тест упал', String(e && e.stack || e)); }
await browser.close(); server.close();
console.log(failed ? `FAIL: ${failed}` : 'OK: этап 6.2');
process.exit(failed ? 1 : 0);

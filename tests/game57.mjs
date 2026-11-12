// Браузерный тест этапа 5.7: панели как в DroneFlames, туман войны без затемнения (прячет постройки соседей),
// Орлан-10 раскрывает их, Ланцет поражает, солнечные панели и аккумулятор, рудник, ЖД путь мышью от вокзала,
// месторождение уходит из-под села, сохранение, долгий прогон с ботами.
// Запуск: node tests/game57.mjs  (входит в npm run test:browser)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const PORT = 8095, SHOTS = process.env.SHOTS || '';
const server = await serve(PORT);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
const check = (ok, name, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) failed++; };
const shot = async (page, name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const settle = async (page) => { for (let i = 0; i < 60; i++) { await page.waitForTimeout(300); const s = await page.evaluate(() => Game.api.stats()); if (i > 3 && s.queue === 0 && s.pending === 0) break; } await page.waitForTimeout(400); };
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.click('[data-go="new"]');
  await page.evaluate(() => { const C = __ui.C; C.seed = 1337; C.rules.botCount = 2; C.slot = 4; C.rules.ai = 0; });
  await page.click('#screate');
  await page.waitForFunction(() => Game.api && Game.api.ready, null, { timeout: 60000 });
  await page.evaluate(() => { for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 60000 });
  await page.evaluate(() => { Game.setSpeed(0); Game._test.run(45); });

  // ---- панели (с этапа 5.8 — как в DroneFlames): вкладки во всю ширину над панелью, пауза и скорость на панели слева
  const ui = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), tabs = r('bb-tabs'), tray = r('bb-tray'), pause = r('bpause');
    return { pauseLeft: pause.left < 120 && pause.top >= tray.top, tabsFull: tabs.left <= 4 && tabs.right >= innerWidth - 4, trayBelow: tray.top >= tabs.bottom - 1 && tray.bottom >= innerHeight - 1,
      tabs: document.querySelectorAll('#bb-tabs button').length, cards: document.querySelectorAll('#bb-cat .bcat').length, metal: !!document.getElementById('rmetal-v') }; });
  check(ui.pauseLeft && ui.tabsFull && ui.trayBelow && ui.tabs === 7 && ui.cards === 17 && ui.metal, 'панели: вкладки во всю ширину, под ними панель с паузой и скоростью слева, металл в ресурсах', JSON.stringify(ui));
  await page.click('#bb-tabs [data-t="cities"]');
  const off = await page.evaluate(() => document.body.classList.contains('tray-off'));
  await page.click('#bb-tabs [data-t="strike"]');
  const strike = await page.evaluate(() => ({ on: !document.body.classList.contains('tray-off'), n: document.querySelectorAll('#bb-cat .bcat').length, title: document.querySelector('#bb-tabs .on').textContent, keys: [...document.querySelectorAll('#bb-cat .bcat b')].map((b) => b.textContent).join(',') }));
  check(off && strike.on && strike.n === 5 && /Удар/.test(strike.title) && strike.keys === 'Маршрут,Разведка,Удар,Цех БПЛА,Дронопорт', 'повторный клик по вкладке сворачивает панель; вкладка «Удар» как в DroneFlames: маршрут, разведка, удар, цех, дронопорт (модули — в карточке дронопорта)', JSON.stringify(strike));

  // ---- туман войны: карта не затемняется, постройка бота вдали скрыта
  const fog = await page.evaluate(() => { const T = Game._test, G = Game.G, W = Game.api.W, b = G.states[1], c = b.places[0];
    for (const q of b.builds.slice()) if (q.k === 'sam') b.builds.splice(b.builds.indexOf(q), 1);
    b.res.money = 1e6; let site = null; const cc = W.cities[b.cityId];
    // a free spot on the bot's own land, clear of its town, zones and roads
    for (let r = cc.R * 1.35 + 600; r < 9000 && !site; r += 200) for (let a = 0; a < 6.28; a += 0.2) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
      const o = T.own[Math.floor(y / 512) * 256 + Math.floor(x / 512)]; if (o !== 2 || W.landE(x, y, 0) < 0.03 || W.zones.some((z) => !z.dead && Math.hypot(z.x - x, z.y - y) < z.rad + 500)) continue;
      if (W.queryRoads(x - 450, y - 450, x + 450, y + 450).some((r2) => r2.k !== 8)) continue; site = [x, y]; break; }
    G.states[1].builds.push({ k: 'factory', x: site[0], y: site[1], t: 0, time: 0.2, done: false, id: -1, off: 0, uid: ++G.uid });
    T.run(1); T.updHidden(); const q = b.builds.find((q) => q.k === 'factory' && q.done);
    return { id: q.id, hid: W.isHid(q.id), x: q.x, y: q.y }; });
  check(fog.id >= 0 && fog.hid, 'постройка бота за пределами видимости скрыта туманом', JSON.stringify(fog));
  const dark = await page.evaluate(() => { const A = Game.api; A.stop(); const c = Game.G.states[1].places[0]; A.cam.x = c.x; A.cam.y = c.y; A.cam.m = 30; return true; });
  await settle(page);
  // the map is WebGL since stage 6: read the pixels inside a frame (the drawing buffer is not kept between frames)
  const lum = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => { const g = __world.gl.gl, w = 400, h = 300, d = new Uint8Array(w * h * 4); g.readPixels((g.drawingBufferWidth >> 1) - 200, (g.drawingBufferHeight >> 1) - 150, w, h, g.RGBA, g.UNSIGNED_BYTE, d); let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; res(s / (d.length / 4) / 3); })));
  check(dark && lum > 45, 'земля соседа не затемнена (яркость ' + lum.toFixed(0) + ')');
  await shot(page, 'fog-neighbour');

  // ---- своя экономика: солнечные панели, рудник, дронопорт с модулями, цех БПЛА
  const eco = await page.evaluate(() => { const T = Game._test, G = Game.G, s = G.states[0], c = s.places[0]; s.res.money = 1e6; s.res.metal = 0; s.res.fuel = 100; const out = {};
    const find = (k, r0, r1) => { for (let r = r0; r < r1; r += 150) for (let a = 0; a < 6.28; a += 0.13) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild(k, x, y) === null) return [x, y]; } return null; };
    for (const k of ['power', 'solar', 'droneport']) { const q = find(k, 3500, 12000); out[k] = !!q; if (q) T.startBuild(k, q[0], q[1]); }
    const d = G.dep.find((d) => [3, 4, 7].includes(d.k) && d.used < 0 && T.canBuild('mine', d.x, d.y) === null); out.mine = !!d; if (d) T.startBuild('mine', d.x, d.y);
    T.run(20);
    const p = s.builds.find((b) => b.k === 'droneport'); for (const k of ['dramp', 'dstore']) { let q = null; for (let r = 260; r < 1100 && !q; r += 40) for (let a = 0; a < 6.28; a += 0.2) { const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (T.canBuild(k, x, y) === null) { q = [x, y]; break; } } out[k] = !!q; if (q) T.startBuild(k, q[0], q[1]); }
    const f = find('dronefab', 3500, 12000); out.dronefab = !!f; if (f) T.startBuild('dronefab', f[0], f[1]);
    T.run(30); out.metal = s.res.metal; out.flowMetal = s.flow.metal; out.cap = T.uavCap(); out.done = s.builds.filter((b) => b.done).map((b) => b.k).join(',');
    const fab = s.builds.find((b) => b.k === 'dronefab'); fab.queue.push('orlan', 'lancet'); T.run(40); out.uav = Object.assign({}, s.uav); return out; });
  check(eco.mine && eco.metal > 0 && eco.flowMetal > 0, 'рудник на месторождении даёт металл', JSON.stringify({ metal: eco.metal, flow: eco.flowMetal }));
  check(eco.cap === 8 && eco.uav.orlan === 1 && eco.uav.lancet === 1, 'дронопорт со складом (8 мест), цех БПЛА выпустил Орлан-10 и Ланцет', JSON.stringify(eco));

  const sol = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], A = Game.api; A.setTod(12); T.run(60); const day = { bat: s.bat, batC: s.batC, sol: s.energy[2] };
    // ночь, и ТЭЦ подбита: потребители (цех, рудник, дронопорт) держатся на аккумуляторе
    A.setTod(1); s.builds.find((b) => b.k === 'power').off = 20; T.run(2); const night = { bat: s.bat, cover: s.energy[3], sol: s.energy[2], eK: s.eK }; s.builds.find((b) => b.k === 'power').off = 0; return { day, night }; });
  check(sol.day.batC === 600 && sol.day.bat > 590 && sol.day.sol > 3 && sol.night.sol === 0 && sol.night.cover > 0 && sol.night.eK === 1 && sol.night.bat < sol.day.bat, 'солнечные панели: днём заряжают аккумулятор, ночью он покрывает нехватку энергии', JSON.stringify(sol));
  await page.evaluate(() => Game.api.setTod(12.5));

  // ---- Орлан-10 раскрывает постройку бота, Ланцет поражает её
  const recon = await page.evaluate(([x, y, id]) => { const T = Game._test, G = Game.G, W = Game.api.W; for (const s of G.states) if (!s.isP) for (const q of s.builds.slice()) if (q.k === 'sam') s.builds.splice(s.builds.indexOf(q), 1);
    const why = T.launchUav('orlan', x, y, null); let t = 0, loiter = false;
    while (t < 900 && G.drones.length) { T.run(1); t++; if (G.drones.some((d) => d.ph === 'loiter')) loiter = true; if (G.rev.has(id) && !G.drones.some(d => d.ph === 'loiter')) break; }
    T.updHidden(); return { why, loiter, rev: G.rev.has(id), hid: W.isHid(id), t }; }, [fog.x, fog.y, fog.id]);
  check(!recon.why && recon.loiter && recon.rev && !recon.hid, 'Орлан-10 долетел, кружил над точкой и раскрыл постройку бота', JSON.stringify(recon));
  const strikeRes = await page.evaluate(([x, y, id]) => { const T = Game._test, G = Game.G; T.declareWar(1); for (const s of G.states) if (!s.isP) for (const q of s.builds.slice()) if (q.k === 'sam') s.builds.splice(s.builds.indexOf(q), 1); const why = T.launchUav('lancet', x, y, 1); let t = 0;
    // the bots keep building air defence during the flight: keep it away here, this check is about the hit itself
    while (t < 900 && G.drones.some((d) => d.kind === 'lancet')) { for (const s of G.states) if (!s.isP) for (const q of s.builds.slice()) if (q.k === 'sam') s.builds.splice(s.builds.indexOf(q), 1); T.run(1); t++; }
    const q = G.states[1].builds.find((b) => b.id === id); return { why, off: q.off, t }; }, [fog.x, fog.y, fog.id]);
  check(!strikeRes.why && strikeRes.off > 0, 'Ланцет поразил завод противника — он не работает', JSON.stringify(strikeRes));

  // ---- ЖД путь мышью: нажать на вокзал и вести линию в поле — там встанет новый вокзал
  const st = await page.evaluate(() => { const T = Game._test, G = Game.G, s = G.states[0], c = s.places[0];
    for (let r = 3500; r < 9000; r += 150) for (let a = 0; a < 6.28; a += 0.13) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild('station', x, y) === null) { T.startBuild('station', x, y); T.run(12); const q = s.builds.find((b) => b.k === 'station'); return { x: q.x, y: q.y, done: q.done, uid: q.uid }; } } return null; });
  check(st && st.done, 'вокзал построен');
  await page.click('#bb-tabs [data-t="cities"]');
  await page.click('#bb-cat [data-mode="rail"]');
  const plan = await page.evaluate(([sx, sy]) => { const A = Game.api, T = Game._test, s = Game.G.states[0]; A.stop(); A.cam.x = sx; A.cam.y = sy; A.cam.m = 14;
    for (let r = 2400; r < 5200; r += 200) for (let a = 0; a < 6.28; a += 0.15) { const x = sx + Math.cos(a) * r, y = sy + Math.sin(a) * r, X = A.sxw(x), Y = A.syw(y); if (X < 300 || Y < 120 || X > 1150 || Y > 640) continue;
      const ev = T.railEval(s.builds.find((b) => b.k === 'station'), x, y, X, Y); if (!ev.bad) return { from: [A.sxw(sx), A.syw(sy)], to: [X, Y], L: ev.L, cost: ev.cost }; } return null; }, [st.x, st.y]);
  check(!!plan, 'нашлось место для второго вокзала', plan ? `${Math.round(plan.L)} м, ${plan.cost}` : '');
  await page.mouse.move(plan.from[0], plan.from[1]); await page.mouse.down();
  for (let q = 1; q <= 12; q++) { await page.mouse.move(plan.from[0] + (plan.to[0] - plan.from[0]) * q / 12, plan.from[1] + (plan.to[1] - plan.from[1]) * q / 12); await page.waitForTimeout(30); }
  await page.waitForTimeout(250); await shot(page, 'rail-drag');
  await page.mouse.up(); await page.waitForTimeout(300);
  const ask = await page.evaluate(() => ({ show: document.getElementById('confirm').classList.contains('show'), t: document.getElementById('cft').textContent, cam: Game.api.cam.m }));
  check(ask.show && /ЖД путь/.test(ask.t), 'после отпускания — вопрос «ЖД путь … Построить / ✕»', ask.t);
  await page.click('#cfy');
  const rail = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0]; T.run(40); const r = s.builds.find((b) => b.k === 'rail'), sts = s.builds.filter((b) => b.k === 'station');
    const road = r && r.id >= 0 ? Game.api.W.roads[r.id] : null; return { n: sts.length, done: r && r.done, k: road && road.k, L: road && Math.round(road.L), shown: road && Game.api.W.roadShown(road) }; });
  check(rail.n === 2 && rail.done && rail.k === 5 && rail.shown, 'новый вокзал встал в конце пути, ЖД путь проложен (рельсы в мире, по ним пойдут поезда)', JSON.stringify(rail));
  await page.evaluate(() => { const T = Game._test; T.run(1); }); await settle(page); await shot(page, 'rail-built');

  // ---- месторождение уходит из-под нового села
  const dep = await page.evaluate(() => { const T = Game._test, G = Game.G, W = Game.api.W, s = G.states[0];
    for (const d of G.dep) { if (d.used >= 0) continue; for (let r = 0; r < 300; r += 50) for (let a = 0; a < 6.28; a += 0.5) { const x = d.x + Math.cos(a) * r, y = d.y + Math.sin(a) * r; if (T.canBuild('village', x, y) !== null) continue;
      const i = G.dep.indexOf(d), x0 = d.x, y0 = d.y; T.startBuild('village', x, y); T.run(12); const v = s.places[s.places.length - 1], c = W.cities[v.id];
      return { moved: Math.hypot(d.x - x0, d.y - y0) > 300, clear: Math.hypot(d.x - c.x, d.y - c.y) > c.R * 1.6 + 300, sync: Math.abs(W.deps[i].x - d.x) < 1 && Math.abs(W.deps[i].y - d.y) < 1 }; } }
    return null; });
  check(dep && dep.moved && dep.clear && dep.sync, 'месторождение под новым селом сдвинулось на свободное место (и в мире тоже)', JSON.stringify(dep));

  // ---- сохранение и загрузка: дроны, путь, раскрытые постройки
  const before = await page.evaluate(() => { Game.save(false); const s = Game.G.states[0]; return { uav: JSON.stringify(s.uav), rails: s.builds.filter((b) => b.k === 'rail' && b.done).length, rev: Game.G.rev.size }; });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.evaluate(() => { document.getElementById('pause').classList.remove('show'); __ui.menuGo && 0; });
  await page.evaluate(() => { const L = Saves.get(4); Game.exit(); Game.load(L); });
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G && Game.G.phase === 'play', null, { timeout: 60000 });
  const after = await page.evaluate(() => { const s = Game.G.states[0], W = Game.api.W, r = s.builds.find((b) => b.k === 'rail'); return { uav: JSON.stringify(s.uav), rails: s.builds.filter((b) => b.k === 'rail' && b.done).length, rev: Game.G.rev.size, road: r && W.roads[r.id] && W.roads[r.id].k }; });
  check(after.uav === before.uav && after.rails === before.rails && after.rev === before.rev && after.road === 5, 'сохранение загружено: дроны, ЖД путь и раскрытые постройки на месте', JSON.stringify([before, after]));

  // ---- долгий прогон: 3 агрессивных бота, 20 минут — стройка дронопортов и цехов, войны, дроны, без ошибок
  const long = await page.evaluate(() => { const G = Game.G; Game.setSpeed(0); for (const s of G.states) if (!s.isP) { s.res.money += 30000; s.trait = 'militarist'; }
    let err = null; try { Game._test.run(1200); } catch (e) { err = String(e.stack || e); }
    const bots = G.states.filter((s) => !s.isP); return { err, ports: bots.reduce((t, s) => t + s.builds.filter((b) => b.k === 'droneport').length, 0), fabs: bots.reduce((t, s) => t + s.builds.filter((b) => b.k === 'dronefab').length, 0), t: Math.round(G.t) }; });
  check(!long.err, '20 минут игры с ботами без ошибок', long.err || JSON.stringify(long));
  for (const e of errors) console.log('     ' + e);
  check(errors.length === 0, 'без ошибок на странице');
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);

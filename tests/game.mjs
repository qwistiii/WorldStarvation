// Браузерный тест игры (этап 5): меню → новая игра → основание столицы → рост → действия → сохранение → «Продолжить».
// Запуск: node tests/game.mjs  (входит в npm run test:browser)
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const PORT = 8094;
const server = await serve(PORT);
const browser = await chromium.launch();
let failed = 0;
const check = (ok, name, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) failed++; };
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 60000 });
  check(await page.evaluate(() => document.body.classList.contains('m-menu') && document.getElementById('mm-cont').style.display === 'none'), 'главное меню, «Продолжить» скрыто без сохранений');

  await page.click('[data-go="new"]');
  check(await page.evaluate(() => document.querySelectorAll('#stabs button').length === 5), 'экран новой игры: 5 вкладок');
  await page.click('#stabs button:nth-child(2)');
  await page.waitForFunction(() => /Суша/.test(document.getElementById('mp-info').textContent), null, { timeout: 45000 }).catch(() => {});
  check(await page.evaluate(() => /Суша/.test(document.getElementById('mp-info').textContent)), 'предпросмотр карты построен');
  await page.evaluate(() => { const C = __ui.C; C.seed = 1337; C.rules.botCount = 2; C.slot = 2; });

  await page.click('#screate');
  await page.waitForFunction(() => Game.api && Game.api.ready, null, { timeout: 60000 });
  check(await page.evaluate(() => Game.G.phase === 'found' && document.getElementById('hint').classList.contains('show')), 'мир создан, подсказка «выберите место для столицы»');

  // перетаскивание карты мышью срабатывает каждый раз
  const moves = [];
  for (let k = 0; k < 6; k++) {
    const a = await page.evaluate(() => [Game.api.cam.x, Game.api.cam.y]); const d = k % 2 ? -1 : 1;
    await page.mouse.move(700, 450); await page.mouse.down();
    for (let q = 1; q <= 8; q++) { await page.mouse.move(700 + d * q * 12, 450 + d * q * 6); await page.waitForTimeout(16); }
    await page.mouse.up(); await page.waitForTimeout(300);
    const c = await page.evaluate(() => [Game.api.cam.x, Game.api.cam.y]); moves.push(Math.round(Math.hypot(c[0] - a[0], c[1] - a[1])));
  }
  check(moves.every((m) => m > 1000), 'карта перетаскивается мышью каждый раз', moves.join(' '));
  check(await page.evaluate(() => Game.G.phase === 'found' && !document.getElementById('confirm').classList.contains('show')), 'перетаскивание не открывает вопрос об основании');
  // место для столицы: ближайшая к центру подходящая точка, клик по ней на экране
  const site = await page.evaluate(() => { const A = Game.api; A.stop(); A.cam.x = 65536; A.cam.y = 65536; A.cam.m = A.maxM() * 0.8;
    for (let r = 0; r < 60000; r += 2500) for (let a = 0; a < 6.28; a += 0.4) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r;
      if (Game._test.validSite(x, y) === null) return [A.sxw(x), A.syw(y)]; } return null; });
  check(!!site, 'нашлось место для столицы');
  await page.click('#a-found');
  check(await page.evaluate(() => document.body.classList.contains('placing')), 'режим «Основать столицу»');
  await page.mouse.click(site[0], site[1]);
  await page.waitForTimeout(500);
  check(await page.evaluate(() => document.getElementById('confirm').classList.contains('show')), 'вопрос «Основать столицу здесь?»');
  await page.click('#cfy');
  await page.waitForTimeout(400);
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play', null, { timeout: 60000 });
  const st = await page.evaluate(() => Game.G.states.map((s) => ({ cap: !!s.cap, city: s.cityId >= 0 && Game.api.W.cities[s.cityId].cap === s.id, cells: s.cells })));
  check(st.length === 3 && st.every((s) => s.cap && s.city && s.cells > 0), 'игрок и 2 бота основали столицы, у всех есть территория', JSON.stringify(st));

  check(await page.evaluate(() => /Село/.test(document.getElementById('hintt').textContent) && document.querySelectorAll('#bb-tabs button').length === 7 && document.querySelectorAll('#bb-cat .bcat').length === 17), 'подсказка «поставьте Село», внизу 7 вкладок, во вкладке «Города» 15 построек (с аэропортом и фонарём), «ЖД путь» и «Снести»');
  // село: кнопка в каталоге, затем клик по подходящему месту на карте
  await page.click('#bb-cat [data-k="village"]');
  const vs = await page.evaluate(() => { const A = Game.api, c = Game.G.states[0].places[0]; A.stop(); A.cam.x = c.x; A.cam.y = c.y; A.cam.m = 30;
    for (let r = 3000; r < 10000; r += 300) for (let a = 0; a < 6.28; a += 0.3) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; const sx = A.sxw(x), sy = A.syw(y);
      if (sx > 320 && sx < 1100 && sy > 120 && sy < 700 && Game._test.canBuild('village', x, y) === null) return [sx, sy]; } return null; });
  check(!!vs, 'нашлось место для села');
  await page.mouse.move(vs[0], vs[1]); await page.waitForTimeout(150); await page.mouse.click(vs[0], vs[1]); await page.waitForTimeout(500);
  check(await page.evaluate(() => Game.G.states[0].builds.some((q) => q.k === 'village')), 'село строится');
  await page.evaluate(() => Game.setSpeed(4));
  await page.waitForFunction(() => Game.G.states[0].builds.some((q) => q.k === 'village' && q.done), null, { timeout: 20000 }).catch(() => {});
  check(await page.evaluate(() => { const p = Game.G.states[0].places.find((q) => q.k === 'village'); return !!p && Game.api.W.cities[p.id].dyn && /Колхоз/.test(document.getElementById('hintt').textContent); }), 'село построено в мире, подсказка «Колхоз»');
  const st2 = await page.evaluate(() => Game.G.states.map((s) => s.cells));
  check(st2[0] > st[0].cells, 'у села появилась своя земля', st2.join(','));
  // военная часть → армия, сборка, набор бойцов
  const ok = await page.evaluate(() => { const s = Game.G.states[0], c = s.places[0]; s.res.money = 1e6;
    for (let r = 3500; r < 9000; r += 200) for (let a = 0; a < 6.28; a += 0.25) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (Game._test.canBuild('barracks', x, y) === null) return Game._test.startBuild('barracks', x, y); } return false; });
  check(ok, 'военная часть заложена');
  await page.waitForFunction(() => Game.G.states[0].armies.length > 0, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => { Game.G.sel = { army: Game.G.states[0].armies[0] }; });
  await page.waitForSelector('#gpanel [data-tpl="mixed"]', { timeout: 5000 }).catch(() => {});
  await page.click('#gpanel [data-tpl="mixed"]');
  await page.waitForTimeout(7000);
  check(await page.evaluate(() => { const a = Game.G.states[0].armies[0]; return a.tpl === 'mixed' && a.units.length > 0; }), 'Армия №1: «Смешанная армия» набирает бойцов');
  // война: объявление, дрон летит к цели
  const war = await page.evaluate(() => { Game._test.declareWar(1); const t = Game.G.states[1], q = t.places[0]; return Game._test.launchDrone(Game.G.states[0], t, q.x, q.y); });
  check(war && await page.evaluate(() => Game.G.drones.length > 0), 'война объявлена, дрон запущен');
  // снос: постройка уходит из мира (op во все workers), армия части распускается, часть денег возвращается
  const dem = await page.evaluate(() => { const s = Game.G.states[0], q = s.builds.find((b) => b.k === 'barracks' && b.done); const m0 = s.res.money, id = q.id; Game._test.demolish(q);
    return { dead: Game.api.W.zones[id].dead === 1, gone: !s.builds.includes(q), armies: s.armies.length, refund: s.res.money > m0 }; });
  check(dem.dead && dem.gone && dem.armies === 0 && dem.refund, 'снос военной части', JSON.stringify(dem));
  await page.keyboard.press('Escape'); // первый Esc снимает выбор армии
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => document.getElementById('pause').classList.contains('show') && Game.G.speed === 0), 'Esc — пауза');
  await page.click('#psave');
  check(await page.evaluate(() => !!localStorage.getItem('ws.save.2')), 'сохранение в ячейку 2');
  const saved = await page.evaluate(() => Game.G.states.map((s) => s.cells));
  await page.click('#pexit');
  await page.waitForTimeout(800);
  check(await page.evaluate(() => document.body.classList.contains('m-menu') && document.getElementById('mm-cont').style.display === ''), 'выход в меню, «Продолжить» доступно');

  await page.click('#mm-cont');
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G && Game.G.phase === 'play', null, { timeout: 60000 });
  const loaded = await page.evaluate(() => Game.G.states.map((s) => s.cells));
  check(loaded.every((n, i) => Math.abs(n - saved[i]) <= 3), 'сохранение загружено', `${saved} → ${loaded}`);
  check(await page.evaluate(() => { const s = Game.G.states[0]; return s.places.some((p) => p.k === 'village') && Game.api.W.cities.some((c) => c.dyn) && Game.api.W.zones.some((z) => z.dyn && z.dead); }), 'после загрузки на месте село, снесённая часть осталась снесённой');

  await page.keyboard.press('Digit6'); await page.waitForTimeout(400);
  check(await page.evaluate(() => document.querySelector('#bb-tabs .on').textContent.includes('Полит')), 'клавиша 6 — вкладка «Полит.»');
  await page.click('#bb-cat [data-go="dip"]');
  check(await page.evaluate(() => document.querySelectorAll('#dipb .dst').length === 3), 'дипломатия: 3 государства');
  for (const e of errors) console.log('     ' + e);
  check(errors.length === 0, 'без ошибок на странице');
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);

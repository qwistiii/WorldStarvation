// Браузерный тест этапа 5.8: интерфейс игры как в DroneFlames.
// Сверху — флаг и страна, очки и гонка, часы, меню; под ними по центру — ресурсы (клик — склад), план развития и новости.
// Внизу — вкладки во всю ширину на панели: пауза и скорость слева, затем ключи вкладки (квадрат с иконкой, подпись, цена).
// Выбранная постройка или армия — карточка на месте панели над вкладками. Шрифт Rubik, масштаб по размеру окна.
// Запуск: node tests/game58.mjs  (входит в npm run test:browser)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const PORT = 8096, SHOTS = process.env.SHOTS || '';
const server = await serve(PORT);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
const check = (ok, name, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) failed++; };
const shot = async (page, name) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, vis: getComputedStyle(e).display !== 'none' && r.width > 0 }; }, sel);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.click('[data-go="new"]');
  await page.evaluate(() => { const C = __ui.C; C.seed = 1337; C.rules.botCount = 2; C.slot = 5; C.rules.ai = 0; });
  await page.click('#screate');
  await page.waitForFunction(() => Game.api && Game.api.ready, null, { timeout: 60000 });
  await page.mouse.move(640, 300);
  await page.waitForTimeout(600);

  // ---- основание: слева большая кнопка «Основать столицу», во вкладке «Города» — ключ «Столица»
  const f = await page.evaluate(() => ({ found: getComputedStyle(document.getElementById('found')).display, plan: getComputedStyle(document.getElementById('plan')).display,
    keys: [...document.querySelectorAll('#bb-cat .bcat')].map((e) => e.dataset.tn), tab: document.querySelector('#bb-tabs .on').dataset.t, font: document.fonts.check('700 12px Rubik') }));
  check(f.found === 'flex' && f.plan === 'none' && f.keys.length === 1 && f.keys[0] === 'Основать столицу' && f.tab === 'cities' && f.font, 'основание: слева «Основать столицу», внизу ключ «Столица» во вкладке «Города», шрифт Rubik', JSON.stringify(f));
  await page.click('#bb-cat [data-found]');
  check(await page.evaluate(() => document.body.classList.contains('placing') && document.getElementById('a-found').classList.contains('on') && getComputedStyle(document.getElementById('a-found-x')).display !== 'none'), 'ключ «Столица» включает выбор места (кнопка слева красная, есть ✕)');
  await page.click('#a-found-x');
  check(await page.evaluate(() => !document.body.classList.contains('placing')), '✕ отменяет выбор места');
  await shot(page, 'found');
  await page.evaluate(() => { for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 60000 });
  await page.evaluate(() => { Game.setSpeed(0); Game._test.run(20); });
  await page.waitForTimeout(600);

  // ---- верх: полоса во всю ширину, страна слева, очки и часы справа, меню в углу; ресурсы, план и новости — по центру под ней
  const top = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect();
    const hud = r('hud'), res = r('hres'), hint = r('hint'), name = r('hstate'), menu = r('bmenu'), sc = r('hscore');
    return { full: hud.left <= 0 && hud.right >= innerWidth && hud.top <= 0, name: name.left < 40, menu: menu.right > innerWidth - 8, score: sc.left > innerWidth * 0.6,
      res: res.top >= hud.bottom && Math.abs((res.left + res.right) / 2 - innerWidth / 2) < 4, hint: hint.top >= res.bottom && Math.abs((hint.left + hint.right) / 2 - innerWidth / 2) < 4,
      items: document.querySelectorAll('#hres .res').length, store: document.getElementById('rstore').textContent, race: document.getElementById('hrace').textContent, plan: document.getElementById('plann').textContent }; });
  check(top.full && top.name && top.menu && top.score && top.res && top.hint && top.items === 10 && /лидер/.test(top.race) && /из 18/.test(top.plan), 'верх: страна слева, очки и гонка, меню в углу; под полосой по центру ресурсы (9 и «Склад») и план развития', JSON.stringify(top));
  await page.click('#hres');
  const store = await page.evaluate(() => ({ show: document.getElementById('store').classList.contains('show'), rows: document.querySelectorAll('#stb .stat').length, txt: document.getElementById('stb').textContent }));
  check(store.show && store.rows === 9 && /Металл/.test(store.txt) && /\/ 400/.test(store.txt), 'клик по ресурсам — окно «Склад»: запас / вместимость и изменение каждого ресурса', JSON.stringify({ show: store.show, rows: store.rows }));
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !document.getElementById('store').classList.contains('show') && !document.getElementById('pause').classList.contains('show')), 'Esc закрывает склад (а не открывает паузу)');
  await page.click('#hstate');
  const ms = await page.evaluate(() => ({ show: document.getElementById('mystate').classList.contains('show'), txt: document.getElementById('msb').textContent }));
  check(ms.show && /Столица/.test(ms.txt) && /Население/.test(ms.txt) && /Стройка/.test(ms.txt), 'клик по флагу — окно государства', JSON.stringify({ show: ms.show }));
  await page.click('#msx');
  await page.click('#hintx');
  const h1 = await page.evaluate(() => document.getElementById('hint').classList.contains('show'));
  await page.click('#plan');
  const h2 = await page.evaluate(() => document.getElementById('hint').classList.contains('show') && /шаг 3 из 18/.test(document.getElementById('hintn').textContent));
  check(!h1 && h2, '✕ скрывает подсказку, «План развития» слева возвращает её');

  // ---- низ: вкладки во всю ширину, под ними панель; пауза и скорость слева, ключи — квадрат с иконкой, подпись и цена
  const bot = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), tabs = r('bb-tabs'), tray = r('bb-tray'), p = r('bpause'), sp = r('bspeed');
    const keys = [...document.querySelectorAll('#bb-cat .bcat')], k0 = keys[0], sl = k0.querySelector('.sl').getBoundingClientRect();
    return { tabs: tabs.left <= 4 && tabs.right >= innerWidth - 4 && tray.top >= tabs.bottom - 1 && tray.bottom >= innerHeight - 1, pause: p.left < 60 && sp.left > p.left && p.top > tabs.bottom,
      n: keys.length, square: Math.abs(sl.width - sl.height) < 1 && sl.width > 36, label: !!k0.querySelector('b') && !!k0.querySelector('small'), order: keys.slice(0, 3).map((e) => e.dataset.k).join(','),
      on: document.querySelector('#bb-tabs .on').dataset.t, red: getComputedStyle(document.querySelector('#bb-tabs .on'), '::after').backgroundImage.includes('200, 72, 58') }; });
  check(bot.tabs && bot.pause && bot.n === 17 && bot.square && bot.label && bot.order === 'city,village,farm' && bot.on === 'cities' && bot.red, 'низ: вкладки над панелью, пауза и скорость слева, 17 ключей «Городов» (квадрат, подпись, цена), открытая вкладка красная', JSON.stringify(bot));
  await page.click('#bpause');
  const ps = await page.evaluate(() => ({ sp: Game.G.speed, on: document.getElementById('bpause').classList.contains('on') }));
  await page.click('#bspeed');
  const sp2 = await page.evaluate(() => ({ sp: Game.G.speed, b: document.getElementById('bspd').textContent }));
  await page.click('#bpause');
  check(ps.sp === 1 && !ps.on && sp2.sp === 2 && sp2.b === 'x2', 'пауза и скорость: кнопки на панели, значок x2 на «Скорости»', JSON.stringify([ps, sp2]));
  await page.evaluate(() => Game.setSpeed(0));
  await page.hover('#bb-cat [data-k="factory"]');
  await page.waitForTimeout(200);
  const tip = await page.evaluate(() => { const t = document.getElementById('ktip'); return { show: t.classList.contains('show'), txt: t.textContent }; });
  check(tip.show && /Завод товаров/.test(tip.txt) && /Цена 2 500/.test(tip.txt) && /энергия 6/.test(tip.txt), 'подсказка над ключом: полное название, цена, что нужно и что даёт', JSON.stringify(tip));
  await shot(page, 'play');

  // ---- карточка выбранной постройки: на месте панели над вкладками, ✕ и ключ «Снести»; клик по вкладке закрывает её
  const sel = await page.evaluate(() => { const T = Game._test, s = Game.G.states[0], c = s.places[0]; s.res.money = 1e6;
    for (let r = 1000; r < 12000; r += 200) for (let a = 0; a < 6.28; a += 0.2) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild('droneport', x, y) === null) { T.startBuild('droneport', x, y); T.run(20); Game.G.sel = { build: s.builds.find((q) => q.k === 'droneport') }; return true; } } return false; });
  await page.waitForTimeout(500);
  const card = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), g = r('gpanel'), tabs = r('bb-tabs'), tray = document.getElementById('bb-tray');
    return { sel: document.body.classList.contains('sel'), above: g.bottom <= tabs.top + 1 && g.width > innerWidth * 0.9, tabsBottom: tabs.bottom >= innerHeight - 1, tray: getComputedStyle(tray).display,
      title: document.querySelector('#gpanel .pc-t b').textContent, keys: [...document.querySelectorAll('#gpanel .bcat')].map((e) => e.querySelector('b').textContent).join(','), mini: r('mini').bottom <= g.top + 1 }; });
  check(sel && card.sel && card.above && card.tabsBottom && card.tray === 'none' && card.title === 'Дронопорт' && /Рампа/.test(card.keys) && /Снести/.test(card.keys) && card.mini, 'карточка постройки — над вкладками на месте панели (модули, «Снести»), миникарта над ней', JSON.stringify(card));
  await shot(page, 'card');
  await page.click('#gpanel [data-mod="dramp"]');
  check(await page.evaluate(() => Game.G.build === 'dramp' && Game.G.forPort && document.body.classList.contains('sel')), 'ключ модуля в карточке — режим постройки рампы, карточка остаётся');
  await page.evaluate(() => { Game.G.build = null; document.body.classList.remove('placing'); });
  await page.click('#bb-tabs [data-t="map"]');
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => ({ sel: document.body.classList.contains('sel'), g: Game.G.sel, tray: getComputedStyle(document.getElementById('bb-tray')).display, tab: document.querySelector('#bb-tabs .on').dataset.t }));
  check(!back.sel && !back.g && back.tray !== 'none' && back.tab === 'map', 'клик по вкладке закрывает карточку и открывает её панель', JSON.stringify(back));

  // ---- новости: по центру под планом, значок, ✕ и полоса времени; не больше трёх
  await page.evaluate(() => { for (let i = 0; i < 5; i++) Game._test.declareWar(1 + (i % 2)); });
  await page.waitForTimeout(300);
  const news = await page.evaluate(() => { const t = [...document.querySelectorAll('#toasts .toast')], r = t[0] && t[0].getBoundingClientRect(), h = document.getElementById('hint').getBoundingClientRect();
    return { n: t.length, center: r && Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 4, below: r && r.top >= h.bottom - 1, parts: t[0] && !!t[0].querySelector('.t-i') && !!t[0].querySelector('.xb') && !!t[0].querySelector('.t-bar i') }; });
  check(news.n >= 1 && news.n <= 3 && news.center && news.below && news.parts, 'новости по центру под планом: значок, ✕, полоса времени, не больше трёх', JSON.stringify(news));
  await page.click('#toasts .toast .xb');
  await page.waitForTimeout(500);

  // ---- масштаб: на большом окне интерфейс крупнее, на месте
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(600);
  const big = await page.evaluate(() => { const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z')), hud = document.getElementById('hud').getBoundingClientRect(), tabs = document.getElementById('bb-tabs').getBoundingClientRect(), mini = document.getElementById('mini').getBoundingClientRect(), bar = document.getElementById('bbar').getBoundingClientRect();
    return { z, hud: hud.height, tabs: tabs.right >= innerWidth - 6, mini: mini.bottom <= bar.top + 1 }; });
  check(big.z > 1.3 && big.hud > 60 && big.tabs && big.mini, 'окно 1920×1080: интерфейс в ' + big.z + ' раза крупнее, вкладки во всю ширину, миникарта над панелью', JSON.stringify(big));
  await shot(page, 'big');
  for (const e of errors) console.log('     ' + e);
  check(errors.length === 0, 'без ошибок на странице');
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);

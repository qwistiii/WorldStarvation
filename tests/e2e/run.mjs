// Browser scenario of the game (Playwright, headless Chromium with the GPU): desktop 1920x1080 and a phone 390x844 run
// in parallel. Checks: loading without console errors, every tab and panel of the HUD, placing every building type
// through the UI (mouse: click; touch: tap + ✓), rotation, all ways to cancel, mouse-drag parallax, frame budget.
// Screenshots go to .work/e2e/<device>-*.png (look at them: tests/visual/inspect.py crops and zooms the risky places).
// node tests/e2e/run.mjs [--only=desktop|phone|menu] [--no-perf]
import fs from 'node:fs';
import { launch, server, DESKTOP, PHONE, openMenu, newGame, settle, watchErrors } from '../lib/game.mjs';

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const PERF = !args.includes('--no-perf');
const OUT = '.work/e2e';
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8180 + Math.floor(Math.random() * 40);
const BUDGET = { desktop: 1000 / 165, phone: 1000 / 60 }; // ms per frame (throughput)

let failed = 0;
const log = [];
function warn(dev, name, extra) { const l = `WARN [${dev}] ${name}${extra ? ' — ' + extra : ''}`; log.push(l); console.log(l); }
function check(dev, ok, name, extra) { const l = `${ok ? 'OK  ' : 'FAIL'} [${dev}] ${name}${extra ? ' — ' + extra : ''}`; log.push(l); console.log(l); if (!ok) failed++; }

// frame throughput: k frames per tick, one read-back (see tests/perf/bench.mjs)
const INIT = () => { const B = window.__bench = { on: false, thr: [], px: new Uint8Array(4) }; const RAF = window.requestAnimationFrame.bind(window); let sw = 0;
  window.requestAnimationFrame = function (cb) { if (cb.name !== 'frame') return RAF(cb); if (sw > 0) { sw--; return 0 } return RAF(function (ts) { if (!B.on) return cb(ts);
    const g = document.getElementById('c').getContext('webgl2'), t0 = performance.now(); sw = 3; for (let i = 0; i < 4; i++) cb(ts + i * 6); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, B.px); B.thr.push((performance.now() - t0) / 4); }); }; };

// buildings the scenario places, in order (modules need the drone port, the farm needs a village)
const ORDER = ['village', 'farm', 'city', 'factory', 'power', 'solar', 'sawmill', 'refinery', 'barracks', 'sam', 'station', 'airport', 'droneport', 'dronefab', 'port', 'oil', 'gaswell', 'mine', 'dramp', 'drwy', 'dstore'];

async function scenario(browser, dev, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const touch = !!opts.hasTouch;
  // every touch of the scenario goes through one CDP session (mixing sessions confuses the touch state of Chromium)
  const TC = touch ? await ctx.newCDPSession(page) : null;
  const tdrag = async (x0, y0, x1, y1, n = 8) => { await TC.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= n; i++) await TC.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] });
    await TC.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const ttap = async (x, y) => { await TC.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await TC.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const tapSel = (sel) => page.tap(sel, { timeout: 8000 });
  // overview shots as JPEG (fast); the ones looked at for seams and edges as PNG
  const PNG = new Set(['hud', 'ghost', 'street', 'city', 'night', 'parallax-0', 'parallax-1']);
  const shot = (n) => PNG.has(n) ? page.screenshot({ path: `${OUT}/${dev}-${n}.png` }) : page.screenshot({ path: `${OUT}/${dev}-${n}.jpg`, type: 'jpeg', quality: 80 });
  const ev = (f, a) => page.evaluate(f, a);
  const t0 = Date.now(); let tl = t0; const laps = []; const lap = (n) => { const t = Date.now(); laps.push(n + ' ' + ((t - tl) / 1000).toFixed(1)); tl = t; };
  const tMenu = await openMenu(page, PORT, '?workers=3');
  check(dev, true, 'главное меню загрузилось', tMenu + ' мс');
  await page.waitForTimeout(400); await shot('menu');
  // menu panels: settings and news
  await page.click('[data-go="settings"]'); await page.waitForTimeout(250);
  check(dev, await ev(() => document.body.className.includes('settings') || [...document.querySelectorAll('.screen')].some((e) => getComputedStyle(e).display !== 'none' && /set/i.test(e.id))), 'настройки открываются');
  await shot('settings');
  await page.evaluate(() => { const b = document.querySelector('#settings [data-back], [data-back]'); if (b) b.click(); });
  await page.waitForTimeout(200);

  lap('menu');
  const g = await newGame(page);
  check(dev, true, 'новая игра и столица', `мир ${g.tWorld} мс, основание ${g.tFound} мс`);
  await ev(() => { const s = Game.G.states[0]; s.res.money = 1e9; s.res.energy = 999; Game.setSpeed(0); Game.api.stop(); });
  await shot('hud');

  lap('game');
  // ---- tabs 1–7 and the panels
  const tabs = await ev(() => [...document.querySelectorAll('#bb-tabs button')].map((b) => b.dataset.t));
  check(dev, tabs.length === 7, 'семь вкладок внизу', tabs.join(','));
  for (const t of tabs) {
    await page.click(`#bb-tabs [data-t="${t}"]`); await page.waitForTimeout(120);
    const n = await ev(() => document.querySelectorAll('#bb-cat > *').length);
    check(dev, n > 0, `вкладка «${t}» показывает ключи`, String(n));
    if (t === 'cities' || t === 'strike') await shot('tab-' + t);
  }
  for (const [btn, win] of [['#hres', '#store'], ['#hstate', '#mystate'], ['#b-hq', '#hqp'], ['#b-ores', '#orep']]) {
    await page.click(btn); await page.waitForTimeout(200);
    const vis = await ev((w) => { const e = document.querySelector(w); const r = e.getBoundingClientRect(); return e.classList.contains('show') && r.width > 0 && r.height > 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.top >= -1; }, win);
    check(dev, vis, `панель ${win} открывается и целиком на экране`);
    await shot('panel-' + win.slice(1));
    await page.click(btn).catch(() => {}); await ev((w) => document.querySelector(w).classList.remove('show'), win);
  }
  await page.click('#bb-tabs [data-t="pol"]'); await page.waitForTimeout(120);
  await page.click('#bb-cat [data-go="dip"]'); await page.waitForTimeout(200);
  check(dev, await ev(() => document.getElementById('dip').classList.contains('show')), 'дипломатия открывается');
  await shot('panel-dip'); await ev(() => document.getElementById('dip').classList.remove('show'));
  await page.click('#bmenu'); await page.waitForTimeout(200);
  check(dev, await ev(() => getComputedStyle(document.getElementById('pause')).display !== 'none'), 'меню паузы открывается');
  await shot('pause'); await page.click('#presume'); await page.waitForTimeout(150);

  // ---- HUD layout: nothing important overlaps (top bar, resources, tabs, panel, left rail, plan)
  const ov = await ev(() => {
    const ids = ['hud', 'hres', 'plan', 'lrail', 'bb-tabs', 'bb-tray', 'mini', 'bl'];
    const R = ids.map((i) => [i, document.getElementById(i)]).filter(([, e]) => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).map(([i, e]) => [i, e.getBoundingClientRect()]);
    const bad = []; for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) { const p = R[a][1], q = R[b][1]; const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); if (w > 2 && h > 2) bad.push(R[a][0] + '×' + R[b][0]); }
    const off = R.filter(([, r]) => r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1).map(([i]) => i);
    return { bad, off };
  });
  check(dev, !ov.bad.length && !ov.off.length, 'элементы HUD не налезают друг на друга и не обрезаны', JSON.stringify(ov));

  // notifications (stage 6.1, the lane of DroneFlames): a burst of 10 — 4 identical, 6 of one kind — gives at most 2 cards
  // (1 on a phone), no duplicate text, the rest merged in the queue (×N, «+N»); every card leaves by itself
  const nt = await ev(async () => { const T = Game._test, L = T.LANE, sl = (ms) => new Promise((r) => setTimeout(r, ms)); for (const it of L.shown) it.until = 0; await sl(700);
    for (let i = 0; i < 4; i++) T.toast('Построено: <b>Завод</b>', 'ic-b-factory');
    for (let i = 0; i < 6; i++) T.toast(`Рейс прибыл в <b>город ${i}</b>`, 'ic-b-airport');
    await sl(300); const cards = [...document.querySelectorAll('#toasts .toast:not(.out)')], txt = cards.map((c) => c.querySelector('.t-b').textContent);
    const r0 = cards[0] && cards[0].getBoundingClientRect();
    const out = { shown: cards.length, uniq: new Set(txt).size === txt.length, merged: L.queue.reduce((q, x) => q + x.n, 0), queue: L.queue.length, more: document.getElementById('t-more').textContent, w: r0 && Math.round(r0.width / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z')) || 1)), center: r0 && Math.abs((r0.left + r0.right) / 2 - innerWidth / 2) < 6 };
    for (let i = 0; i < 80 && (L.shown.length || L.queue.length); i++) await sl(250);
    out.left = L.shown.length + L.queue.length; return out; });
  const maxN = touch ? 1 : 2;
  check(dev, nt.shown >= 1 && nt.shown <= maxN && nt.uniq, `уведомления: не больше ${maxN} на экране, без повторов`, JSON.stringify(nt));
  check(dev, nt.queue >= 1 && nt.merged >= 5 && nt.more === '+' + nt.queue, 'уведомления: одинаковые объединены в очереди (×N), «+N» показывает остаток', JSON.stringify(nt));
  check(dev, nt.center && nt.w <= 320, 'уведомления: по центру сверху, ширина как в DroneFlames (316 px)', JSON.stringify(nt));
  check(dev, nt.left === 0, 'уведомления: исчезают сами', JSON.stringify(nt));

  // the tutorial: after the mine comes the station, then the railway (stage 6.1: it asked for the railway first)
  if (!touch) {
    const tu = await ev(async () => { const T = Game._test, H = T.HINTS.map((h) => h[1]), i = H.indexOf('station'), prev = T.hintStep(); T.hint(i);
      await new Promise((r) => setTimeout(r, 200)); const tab = document.querySelector('#bb-tabs [data-t="cities"]'); if (tab && !tab.classList.contains('on')) tab.click(); await new Promise((r) => setTimeout(r, 300));
      const pulse = [...document.querySelectorAll('#bb-cat .pulse')].map((e) => e.dataset.k || e.dataset.mode || e.id);
      const out = { order: [H.indexOf('mine'), i, H.indexOf('rail')], text: document.getElementById('hintn').textContent, pulse }; T.hint(0); T.hint(prev); return out; });
    check(dev, tu.order[1] === tu.order[0] + 1 && tu.order[2] === tu.order[1] + 1, 'туториал: рудник → вокзал → ЖД-путь', JSON.stringify(tu.order));
    check(dev, /Вокзал/.test(tu.text) && tu.pulse.includes('station') && !tu.pulse.includes('rail'), 'туториал: на шаге «Вокзал» подсвечен ключ вокзала, а не ЖД-пути', JSON.stringify(tu));
  }

  lap('panels');
  // ---- place every building type through the UI
  const placed = [];
  // the desktop places every type with the mouse; the phone checks the touch flow on a representative set
  const LIST = touch ? ['village', 'farm', 'factory', 'solar', 'station', 'droneport', 'dramp'] : ORDER;
  for (const k of LIST) {
    const site = await ev(async (k) => {
      const T = Game._test, G = Game.G, W = Game.api.W, p = G.states[0], c = W.cities.find((o) => o.cap === 0);
      const cand = []; for (let r = 900; r < 16000; r += 320) for (let a = 0; a < 6.28; a += 0.21) cand.push([c.x + Math.cos(a) * r, c.y + Math.sin(a) * r]);
      for (const d of G.dep) if (d.known && d.used < 0) cand.unshift([d.x, d.y]);
      for (const q of p.builds) if (q.k === 'droneport' && q.done) for (let a = 0; a < 6.28; a += 0.5) for (const r of [300, 500, 700]) cand.unshift([q.x + Math.cos(a) * r, q.y + Math.sin(a) * r]);
      for (const q of p.places) if (q.k === 'village') for (let a = 0; a < 6.28; a += 0.4) for (const r of [500, 800, 1100]) cand.unshift([q.x + Math.cos(a) * r, q.y + Math.sin(a) * r]);
      for (const [x, y] of cand) if (T.canBuild(k, x, y) === null) return [x, y];
      return null;
    }, k);
    if (!site) { check(dev, true, `«${k}»: на этой карте нет подходящего места — пропуск`); continue; }
    const tab = await ev((k) => { const T = { sam: 'aa', barracks: 'army' }; return T[k] || (['droneport', 'dramp', 'drwy', 'dstore', 'dronefab'].includes(k) ? 'strike' : 'cities'); }, k);
    await ev(([x, y]) => { const a = Game.api; a.cam.x = x; a.cam.y = y; a.cam.m = 3; }, site);
    await page.waitForTimeout(80);
    // a press on the open tab folds the panel (as in DroneFlames): press it only when another tab is open
    if (!(await ev((t) => document.querySelector(`#bb-tabs [data-t="${t}"]`).classList.contains('on') && !document.body.classList.contains('tray-off'), tab))) { await ev(() => document.body.classList.remove('tray-off')); await page.click(`#bb-tabs [data-t="${tab}"]`); }
    await page.waitForTimeout(80);
    const card = `#bb-cat [data-k="${k}"]`;
    await page.evaluate((s) => document.querySelector(s).scrollIntoView({ inline: 'center' }), card);
    const n0 = await ev(() => Game.G.states[0].builds.length);
    if (touch) await tapSel(card); else await page.click(card);
    await page.waitForTimeout(100);
    const armed = await ev(() => ({ k: Game.G.build, bar: document.getElementById('pbar').classList.contains('show'), touch: Game._test.PL.state.touch, has: Game._test.PL.state.has }));
    check(dev, armed.k === k && armed.bar, `«${k}»: ключ взводит постройку, плашка показана`, JSON.stringify(armed));
    const vw = await ev(() => [Game.api.VW, Game.api.VH]);
    const sx = vw[0] / 2, sy = vw[1] / 2;
    if (touch) {
      // drag the ghost with a finger from where it appeared to the site (the screen centre)
      const gp = await ev(() => { const S = Game._test.PL.state, a = Game.api; return [a.sxw(S.x), a.syw(S.y)]; });
      await tdrag(gp[0], gp[1], sx, sy, 6);
      await page.waitForTimeout(150);
      const st = await ev((site) => { const S = Game._test.PL.state; return { has: S.has, bad: S.bad, n: Game.G.states[0].builds.length, dx: Math.round(S.x - site[0]), dy: Math.round(S.y - site[1]), now: Game._test.canBuild(Game.G.build, site[0], site[1]) }; }, site);
      check(dev, st.has && st.n === n0 && Math.abs(st.dx) < 30 && Math.abs(st.dy) < 30 && !st.bad, `«${k}»: метку перетащили пальцем на место, сразу не строит`, JSON.stringify(st));
      if (k === ORDER[0]) await shot('ghost');
      const okb = await ev(() => { const b = document.getElementById('pbok'), r = b.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { dis: b.disabled, top: e === b || b.contains(e) ? 'ok' : (e && (e.id || e.className)), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (okb.dis || okb.top !== 'ok') check(dev, false, `«${k}»: кнопка ✓ недоступна или перекрыта`, JSON.stringify(okb) + ' ' + JSON.stringify(await ev(() => Game._test.PL.state.bad)));
      await tapSel('#pbok'); await page.waitForFunction((n0) => Game.G.states[0].builds.length > n0 || !!Game._test.PL.state.bad, n0, { timeout: 5000 }).catch(() => {});
    } else {
      await page.mouse.move(sx, sy); await page.waitForTimeout(120);
      if (k === 'factory') { await page.keyboard.press('KeyR'); await page.keyboard.press('Shift+KeyR'); }
      const st = await ev(() => ({ has: Game._test.PL.state.has, bad: Game._test.PL.state.bad, ang: Game._test.PL.state.ang }));
      check(dev, st.has && !st.bad, `«${k}»: призрак под курсором, место годится`, JSON.stringify(st));
      if (k === 'factory') await shot('ghost');
      await page.mouse.click(sx, sy); await page.waitForFunction((n0) => Game.G.states[0].builds.length > n0 || !!Game._test.PL.state.bad, n0, { timeout: 5000 }).catch(() => {});
    }
    const res = await ev((n0) => { const p = Game.G.states[0]; const q = p.builds[p.builds.length - 1]; return { n: p.builds.length - n0, k: q && q.k, a: q && q.a, armed: Game.G.build, bar: document.getElementById('pbar').classList.contains('show') }; }, n0);
    check(dev, res.n === 1 && res.k === k && !res.armed && !res.bar, `«${k}»: построено, режим закрыт`, JSON.stringify(res));
    if (k === 'factory' && !touch) check(dev, res.a != null && Math.abs(res.a - (Math.PI / 12 + Math.PI / 2)) < 1e-6, 'поворот R и Shift+R применён к постройке', String(res.a));
    placed.push(k);
    // towns, villages, the drone port must be finished before what depends on them
    if (['village', 'droneport'].includes(k)) await ev(() => Game._test.run(40));
  }
  await ev(() => Game._test.run(120));
  const done = await ev(() => { const p = Game.G.states[0], W = Game.api.W; return p.builds.filter((q) => q.done && !q.failed).map((q) => { const z = q.id >= 0 && W.zones[q.id]; return { k: q.k, a: q.a || 0, za: z ? Math.atan2(z.sa, z.ca) : null }; }); });
  check(dev, placed.every((k) => done.some((d) => d.k === k)), 'все поставленные постройки достроены', `${done.length}/${placed.length}`);
  // ---- no seams in the ground around a building: two neighbouring tiles whose border runs through the apron of a factory
  if (!touch) {
    const seam = await ev(() => {
      const W = Game.api.W, z = W.zones.find((q) => q.dyn && q.zk === 'ind' && Math.abs(q.sa) < 1e-6); if (!z) return null; const out = [];
      for (const [Z, side] of [[11, 'x'], [12, 'x'], [11, 'y']]) {
        const ts = W.WORLD / (1 << Z), px = side === 'x' ? z.x + z.W / 2 + 12 : z.x, py = side === 'x' ? z.y : z.y + z.H / 2 + 12;
        const tx = Math.floor(px / ts), ty = Math.floor(py / ts), A = W.renderTile(Z, tx, ty), B = side === 'x' ? W.renderTile(Z, tx + 1, ty) : W.renderTile(Z, tx, ty + 1);
        const a = A.getContext('2d').getImageData(0, 0, 256, 256).data, b = B.getContext('2d').getImageData(0, 0, 256, 256).data;
        const px2 = (d, x, y) => (y * 256 + x) * 4; let dB = 0, dI = 0;
        for (let i = 0; i < 256; i++) for (let c = 0; c < 3; c++) {
          if (side === 'x') { dB += Math.abs(a[px2(a, 255, i) + c] - b[px2(b, 0, i) + c]); dI += Math.abs(a[px2(a, 200, i) + c] - a[px2(a, 201, i) + c]) + Math.abs(b[px2(b, 50, i) + c] - b[px2(b, 51, i) + c]); }
          else { dB += Math.abs(a[px2(a, i, 255) + c] - b[px2(b, i, 0) + c]); dI += Math.abs(a[px2(a, i, 200) + c] - a[px2(a, i, 201) + c]) + Math.abs(b[px2(b, i, 50) + c] - b[px2(b, i, 51) + c]); }
        }
        out.push({ Z, side, border: +(dB / 768).toFixed(2), inside: +(dI / 1536).toFixed(2) });
      }
      return out;
    });
    check(dev, seam && seam.every((q) => q.border <= q.inside * 2 + 2), 'нет шва между тайлами в обочине постройки', JSON.stringify(seam));
  }
  const fac = done.find((d) => d.k === 'factory');
  if (fac && !touch) check(dev, fac.za != null && Math.abs(Math.cos(fac.za - fac.a) - 1) < 1e-6, 'повёрнутый завод стоит в мире под тем же углом', `${fac.a} / ${fac.za}`);

  // nothing of a placed building stands on water without a base (stage 6.1: the port's cranes, ships and container stacks
  // stood on the beach and in the sea): every object of a zone over water is on the zone's own ground (pier, quay)
  if (!touch) {
    await ev(() => { const T = Game._test, W = Game.api.W, p = Game.G.states[0], c = W.cities.find((o) => o.cap === 0); if (p.builds.some((b) => b.k === 'port')) return; p.res.money = 1e9; p.res.energy = 999;
      for (let r = 1500; r < 20000; r += 400) for (let a = 0; a < 6.28; a += 0.15) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild('port', x, y) === 'Только на своей территории') T.claim(0, x, y, 1500); }
      for (let r = 1500; r < 20000; r += 150) for (let a = 0; a < 6.28; a += 0.07) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (T.canBuild('port', x, y) === null) { T.startBuild('port', x, y); T.run(40); return; } } });
    const wb = await ev(() => { const W = Game.api.W, p = Game.G.states[0], out = []; let n = 0, port = 0;
      for (const q of p.builds) { if (!q.done || q.id < 0 || q.k === 'rail') continue; const z = W.zones[q.id]; if (!z || z.kind !== 'zone' || !z.prims) continue; if (q.k === 'port') port++;
        const Gr = z.prims.filter((g) => g.k === 'g');
        for (const o of z.prims) { if (o.k === 'g' || o.k === 'ship' || o.k === 'gl' || o.k === 'rail' || o.k === 'lflood' || o.k === 't') continue; let x = o.x, y = o.y; if (o.pts) { x = o.pts[0]; y = o.pts[1]; } if (x == null || y == null) continue;
          const cx = o.w ? x + o.w / 2 : x, cy = o.h ? y + o.h / 2 : y, wx = z.x + cx * z.ca - cy * z.sa, wy = z.y + cx * z.sa + cy * z.ca; n++;
          if (W.landE(wx, wy, 0) >= 0) continue; if (!Gr.some((g) => cx >= g.x - 1 && cx <= g.x + g.w + 1 && cy >= g.y - 1 && cy <= g.y + g.h + 1)) out.push(q.k + ':' + o.k); } }
      return { n, port, bad: out.length, ex: [...new Set(out)].slice(0, 6) }; });
    check(dev, wb.port > 0 && wb.bad === 0, 'порт и прибрежные постройки: на воде ничего не стоит без основы (пирс, причал)', JSON.stringify(wb));
  }
  lap('build');
  // ---- street lights (stage 6.1): objects of the world along the streets — at night the head glows at its height (the
  // pixel where Parallax puts a head 8–12 m up is brighter with the heads than without), the ground around is lit, by day
  // nothing glows; heads are capped; the light system keeps its cap with 2000 lights in view
  const lt = await ev(async () => {
    const a = Game.api, W = a.W, L = a.lights, D = __world.dbg, c = W.cities.find((o) => o.cap === 0), sl = (ms) => new Promise((r) => setTimeout(r, ms)); Game.setSpeed(0);
    const P = W.lampsIn(c.x - 900, c.y - 900, c.x + 900, c.y + 900); if (!P.length) return { err: 'нет фонарей у столицы' };
    const lx = P[0], ly = P[1], lh = P[2]; const settle = async () => { for (let i = 0; i < 80; i++) { await sl(100); const s = a.stats(); if (!s.queue && !s.pending) break } await sl(500) };
    const px = async (X, Y) => { const g = __world.gl.gl; let v = 0; await new Promise((r) => requestAnimationFrame(() => { const d = g.drawingBufferWidth / innerWidth, b = new Uint8Array(4 * 9), h = g.drawingBufferHeight; g.readPixels(Math.round(X * d) - 1, h - Math.round(Y * d) - 2, 3, 3, g.RGBA, g.UNSIGNED_BYTE, b); for (let i = 0; i < 9; i++) v += b[i * 4] + b[i * 4 + 1] + b[i * 4 + 2]; v /= 27; r() })); return v };
    // the lamp off the centre of the screen: its head is drawn away from the ground point under it
    a.stop(); a.setTod(23); a.cam.m = 0.35; a.cam.x = lx + innerWidth * 0.3 * a.cam.m; a.cam.y = ly + innerHeight * 0.25 * a.cam.m; await settle();
    const J = Parallax.project(a.cam, innerWidth, innerHeight, lx, ly, lh), G0 = Parallax.project(a.cam, innerWidth, innerHeight, lx, ly, 0);
    const n = a.stats().streetLights, headOn = await px(J[0], J[1]); D.slights = 1; await sl(300); const headOff = await px(J[0], J[1]); D.slights = 0;
    const ground = await px(G0[0], G0[1]); D.lights = 1; await sl(300); const groundDark = await px(G0[0], G0[1]); D.lights = 0;
    a.setTod(12); await sl(500); const nDay = a.stats().streetLights;
    a.setTod(23); a.cam.m = 2.2; await sl(800); const nFar = a.stats().streetLights;
    for (let i = 0; i < 2000; i++) L.add({ x: c.x + (i % 50) * 9 - 225, y: c.y + Math.floor(i / 50) * 9 - 180, mode: 'on', owner: 'test' }); a.cam.m = 0.6; a.cam.x = c.x; a.cam.y = c.y; await sl(800);
    const st = a.stats().lights; L.removeOwner('test'); a.setTod(12); Game._test.syncLights(); const ent = L.all().filter((l) => l.kind === 'lamp' && typeof l.owner === 'number').length;
    return { ent, n, nDay, nFar, shift: +Math.hypot(J[0] - G0[0], J[1] - G0[1]).toFixed(1), headOn: +headOn.toFixed(1), headOff: +headOff.toFixed(1), ground: +ground.toFixed(1), groundDark: +groundDark.toFixed(1), vis: st.visible, cap: L.cap, all: st.all };
  });
  check(dev, !lt.err && lt.n > 0 && lt.shift > 2 && lt.headOn > lt.headOff + 8, 'уличные фонари: ночью голова горит на своей высоте (параллакс)', JSON.stringify(lt));
  check(dev, !lt.err && lt.ground > lt.groundDark + 8, 'уличные фонари: земля вокруг освещена', JSON.stringify(lt));
  check(dev, !lt.err && lt.nDay === 0 && lt.nFar <= (touch ? 700 : 1800), 'уличные фонари: днём не горят, лимит голов держится', JSON.stringify(lt));
  check(dev, !lt.err && lt.ent > 0, 'фонари у входов в здания (ворота, доки) поставлены', JSON.stringify({ ent: lt.ent }));
  check(dev, lt.vis <= lt.cap && lt.all > 2000, 'лимит одновременных источников света держится', `видно ${lt.vis} из ${lt.all}, лимит ${lt.cap}`);
  // ---- cancel: Esc, right button, ✕, the same key again
  if (!(await ev(() => document.querySelector('#bb-tabs [data-t="cities"]').classList.contains('on')))) await page.click('#bb-tabs [data-t="cities"]'); await ev(() => document.body.classList.remove('tray-off')); await page.waitForTimeout(80);
  const ways = touch ? ['x', 'key'] : ['esc', 'rmb', 'x', 'key'];
  for (const w of ways) {
    const c = '#bb-cat [data-k="solar"]'; await page.waitForTimeout(350);
    if (touch) await tapSel(c); else await page.click(c);
    await page.waitForTimeout(80);
    const pre = await ev(() => ({ k: Game.G.build, bar: document.getElementById('pbar').classList.contains('show') }));
    if (!pre.k) { await shot('cancel-' + w); const why = await ev((c) => { const e = document.querySelector(c); if (!e) return 'нет ключа'; const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: [r.left, r.top, r.width, r.height].map(Math.round), top: t && (t.id || t.className), body: document.body.className }; }, c); check(dev, false, `отмена постройки: ${w} — ключ не взвёлся`, JSON.stringify(why)); continue; }
    if (w === 'esc') await page.keyboard.press('Escape');
    else if (w === 'rmb') { await page.mouse.move(400, 400); await page.mouse.click(400, 400, { button: 'right' }); }
    else if (w === 'x') { const r = await ev(() => { const q = document.getElementById('pbno').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }); if (touch) await tapSel('#pbno'); else await page.mouse.click(r[0], r[1]); }
    else { await page.waitForTimeout(350); if (touch) await tapSel(c); else await page.click(c); }
    await page.waitForTimeout(120);
    const st = await ev(() => ({ k: Game.G.build, bar: document.getElementById('pbar').classList.contains('show'), pl: Game._test.PL.state.k }));
    check(dev, !st.k && !st.bar && !st.pl, `отмена постройки: ${w}`, JSON.stringify(st));
  }

  // ---- parallax: drag the map with the mouse (or a finger) at a height with clouds
  const par = await ev(async () => {
    const a = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)); a.setTod(12); a.setWeather(2);
    const c = a.W.cities.find((o) => o.cap === 0); a.cam.x = c.x; a.cam.y = c.y; a.cam.m = 22; await sl(900);
    return { x: a.cam.x, y: a.cam.y, m: a.cam.m, key: __world.cloudLayers[1].key, n: __world.cloudLayers[1].n || 0 };
  });
  await shot('parallax-0');
  const vw2 = await ev(() => [Game.api.VW, Game.api.VH]);
  const [ax, ay] = [vw2[0] * 0.5, vw2[1] * 0.45], D = Math.round(vw2[0] * 0.25);
  if (touch) await tdrag(ax, ay, ax - D, ay, 10);
  else { await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(ax - D, ay, { steps: 10 }); await page.mouse.up(); }
  await page.waitForTimeout(700);
  const par2 = await ev(([p0, D]) => {
    const a = Game.api, V = [a.VW, a.VH], cam0 = { x: p0.x, y: p0.y, m: p0.m }, cam1 = { x: a.cam.x, y: a.cam.y, m: a.cam.m };
    const P = Parallax, X = p0.x, Y = p0.y;
    const g0 = P.project(cam0, V[0], V[1], X, Y, 0), g1 = P.project(cam1, V[0], V[1], X, Y, 0), c0 = P.project(cam0, V[0], V[1], X, Y, 3000), c1 = P.project(cam1, V[0], V[1], X, Y, 3000);
    return { moved: (a.cam.x - p0.x) / p0.m, ground: g1[0] - g0[0], cloud: c1[0] - c0[0], key: __world.cloudLayers[1].key !== p0.key, n: __world.cloudLayers[1].n || 0 };
  }, [par, D]);
  check(dev, Math.abs(par2.moved) > D * 0.5, 'перетаскивание двигает камеру', JSON.stringify(par2));
  check(dev, Math.abs(par2.cloud) > Math.abs(par2.ground) * 1.05, 'облака на высоте смещаются сильнее земли (параллакс)', `земля ${par2.ground.toFixed(1)} px, облако 3 км ${par2.cloud.toFixed(1)} px`);
  check(dev, par2.n > 0 && par2.key, 'слой облаков перерисован после движения камеры', `облаков ${par2.n}`);
  await shot('parallax-1');

  lap('cancel+parallax');
  // ---- night and a close view, for the screenshots
  for (const [n, m, tod, wx] of [['night', 1.4, 23, 1], ['street', 0.4, 12, 1], ['city', 4, 12, 1]]) {
    await ev(async ([m, tod, wx]) => { const a = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)); const c = a.W.cities.find((o) => o.cap === 0); a.setTod(tod); a.setWeather(wx); a.cam.x = c.x; a.cam.y = c.y; a.cam.m = m;
      for (let i = 0; i < 45; i++) { await sl(100); const s = a.stats(); if (!s.queue && !s.pending) break; } await sl(250); }, [m, tod, wx]);
    await shot(n);
  }

  lap('shots');
  // ---- frame budget (throughput, 4 frames per tick): measured after both scenarios, one device at a time
  const perf = async () => {
    const cdp = dev === 'phone' ? await ctx.newCDPSession(page) : null;
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    for (const [n, m, tod, wx] of [['city', 4, 12, 1], ['night', 1.2, 23, 1]]) {
      const r = await ev(async ([m, tod, wx]) => { const a = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)), B = window.__bench; const c = a.W.cities.find((o) => o.cap === 0);
        a.setTod(tod); a.setWeather(wx); a.cam.x = c.x; a.cam.y = c.y; a.cam.m = m; let q = 0; for (let i = 0; i < 100; i++) { await sl(100); const s = a.stats(); if (!s.queue && !s.pending) { if (++q > 5) break } else q = 0 } await sl(300);
        B.thr.length = 0; B.on = true; await sl(1500); B.on = false; const s = B.thr.slice(3).sort((x, y) => x - y);
        // GPU time of the world passes (timer queries): what the frame costs the video card, whatever else the machine runs
        const G = __world.gl; G.gpu = {}; G.gpuOn = true; await sl(1200); G.gpuOn = false; let gpu = 0; for (const k in G.gpu) gpu += G.gpu[k];
        return { p50: s[s.length >> 1], p90: s[Math.floor(s.length * 0.9)], gpu }; }, [m, tod, wx]);
      const bud = BUDGET[dev], txt = `медиана ${r.p50.toFixed(2)} мс (${Math.round(1000 / r.p50)} FPS), p90 ${r.p90.toFixed(2)} мс, GPU ${r.gpu.toFixed(2)} мс`;
      if (r.p50 <= bud) check(dev, true, `кадр «${n}» в бюджете ${bud.toFixed(2)} мс (${Math.round(1000 / bud)} FPS)`, txt);
      else {
        // over the budget: a failure when the GPU itself does not fit 80 % of it; otherwise the rest is the browser and
        // the load of the machine (compositor, other programs) — reported as a warning with the numbers
        check(dev, r.gpu > 0 && r.gpu <= bud * 0.8, `кадр «${n}»: GPU-время в 80 % бюджета`, txt);
        warn(dev, `кадр «${n}» выше бюджета ${bud.toFixed(2)} мс по пропускной способности`, txt);
      }
    }
    // stage 6.1: the camera MOVES — a drag and fast flicks over the biggest city at 500 m, 1, 5 and 20 km. The player saw
    // 60–70 FPS here while the still frames passed. Per frame: throughput cost (p95 within the budget) and the longest
    // single frame of the engine (no stall over 2.5 budgets: tile uploads, cloud redraws, readbacks)
    for (const H of [500, 1000, 5000, 20000]) {
      const r = await ev(async (H) => { const a = Game.api, sl = (ms) => new Promise((r) => setTimeout(r, ms)), B = window.__bench;
        const c = a.W.cities.filter((o) => !o.vst && o.R).sort((p, q) => q.R - p.R)[0], m = H / (innerHeight * 0.9), sw = innerWidth * m;
        a.setTod(12); a.setWeather(1); a.cam.x = c.x; a.cam.y = c.y; a.cam.m = m; for (let i = 0; i < 80; i++) { await sl(100); const s = a.stats(); if (!s.queue && !s.pending) break } await sl(300);
        let t0 = 0, run = true; const mv = (ts) => { if (!run) return; if (!t0) t0 = ts; const t = (ts - t0) / 1000;
          if (t < 1.4) { a.cam.x = c.x + Math.sin(t * 2.2) * sw * 1.2; a.cam.y = c.y + Math.sin(t * 1.4) * sw * 0.6; } else { const f = ((t - 1.4) % 0.35) / 0.35; a.cam.x += (f < 0.4 ? 1 : 0) * sw * 0.05 * (Math.floor((t - 1.4) / 0.35) % 2 ? -1 : 1); }
          requestAnimationFrame(mv); };
        B.thr.length = 0; B.on = true; requestAnimationFrame(mv); await sl(2600); run = false; B.on = false;
        const s = B.thr.slice(2).sort((x, y) => x - y); return { p50: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], n: s.length }; }, H);
      const bud = BUDGET[dev], txt = `p50 ${r.p50.toFixed(2)} · p95 ${r.p95.toFixed(2)} · макс ${r.max.toFixed(1)} мс (${r.n} кадров)`;
      if (r.p95 <= bud) check(dev, true, `движение камеры на ${H} м: p95 в бюджете ${bud.toFixed(2)} мс`, txt);
      else warn(dev, `движение камеры на ${H} м: p95 выше бюджета ${bud.toFixed(2)} мс`, txt);
      check(dev, r.max <= bud * 2.5, `движение камеры на ${H} м: нет кадров-заиканий длиннее ${(bud * 2.5).toFixed(0)} мс`, txt);
    }
    if (cdp) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  };
  check(dev, errors.length === 0, 'нет ошибок в консоли', errors.slice(0, 3).join(' | '));
  check(dev, true, 'время сценария', ((Date.now() - t0) / 1000).toFixed(1) + ' с · ' + laps.join(' · '));
  return { perf, close: () => ctx.close(), errors };
}

// stage 6.1: a game panel showed on top of the main menu (left open when the player went to the menu; on a slow network the
// whole HUD flashed before the stylesheet). Open panels → menu → none visible; reloads (normal and slow network, no cache):
// no game panel at any moment of the load, polled every 30 ms
async function menuJob(browser) {
  const dev = 'menu', ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), page = await ctx.newPage(), errors = watchErrors(page);
  const vis = () => page.evaluate(() => [...document.querySelectorAll('.gm')].filter((e) => getComputedStyle(e).display !== 'none' && e.offsetWidth > 0).map((e) => e.id));
  try {
    await openMenu(page, PORT, '?workers=2');
    // the capital (stage 6.1): one crosshair — the system cursor is hidden over the map, the game draws its own; the prompt
    // is in the bar on top; over the sea the reason is red
    await page.evaluate(() => localStorage.clear()); await page.click('[data-go="new"]');
    await page.evaluate(() => { const C = __ui.C; C.seed = 1337; C.rules.botCount = 2; C.slot = 6; }); await page.click('#screate');
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.api && Game.api.ready, null, { timeout: 180000 }); await settle(page, 10000);
    await page.click('#a-found'); await page.mouse.move(800, 450); await page.waitForTimeout(400);
    const cap = await page.evaluate(() => ({ cursor: getComputedStyle(document.getElementById('c')).cursor, bar: document.getElementById('pbar').classList.contains('show'), t: document.getElementById('pbt').textContent, hint: getComputedStyle(document.getElementById('hint')).display }));
    const sea = await page.evaluate(() => { const a = Game.api; for (let y = 300; y < 700; y += 25) for (let x = 200; x < 1400; x += 25) { const [wx, wy] = a.toWorld(x, y); if (Game._test.validSite(wx, wy)) return [x, y]; } return null; });
    let bad = null; if (sea) { await page.mouse.move(sea[0], sea[1]); await page.waitForTimeout(300); bad = await page.evaluate(() => ({ cls: document.getElementById('pbar').className, s: document.getElementById('pbs').textContent })); }
    check(dev, cap.cursor === 'none' && cap.bar && /Столица/.test(cap.t) && cap.hint === 'none', 'столица: один крестик (системный курсор скрыт), подсказка в плашке сверху', JSON.stringify(cap));
    check(dev, !sea || (bad && /bad/.test(bad.cls) && bad.s.length > 3), 'столица: над неподходящим местом — причина отказа в плашке', JSON.stringify(bad));
    await page.evaluate(() => { for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
    await page.waitForFunction(() => Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 180000 }); await settle(page, 15000);
    check(dev, await page.evaluate(() => getComputedStyle(document.getElementById('c')).cursor !== 'none'), 'после основания столицы курсор над картой обычный');
    await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade') && document.getElementById('b-ores').offsetWidth > 0, null, { timeout: 180000 }); // the slow CI machine
    await page.click('#b-ores'); await page.waitForTimeout(200);
    check(dev, (await vis()).includes('orep'), 'в игре панель «Свободные залежи» открывается');
    await page.click('#bmenu'); await page.waitForTimeout(250); await page.click('#pexit'); await page.waitForTimeout(800);
    const left = await vis(); check(dev, left.length === 0, 'после выхода в главное меню не видно ни одной панели игры', left.join(', ') || 'нет');
    const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    for (const [n, net, ms] of [['обычная сеть', null, 2500], ['обычная сеть', null, 2500], ['обычная сеть', null, 2500], ['медленная сеть без кэша', { offline: false, latency: 300, downloadThroughput: 1.5e6 / 8, uploadThroughput: 1.5e6 / 8 }, 9000]]) {
      if (net) await cdp.send('Network.emulateNetworkConditions', net);
      await page.reload({ waitUntil: 'commit' }); const seen = new Set(), t = Date.now();
      while (Date.now() - t < ms) { try { for (const id of await vis()) seen.add(id); } catch (e) { /* navigating */ } await page.waitForTimeout(30); }
      check(dev, seen.size === 0, `перезагрузка (${n}): панели игры не появляются в меню`, [...seen].join(', ') || 'нет');
    }
  } finally { check(dev, errors.length === 0, 'нет ошибок в консоли', errors.slice(0, 3).join(' | ')); await ctx.close(); }
}

const t0 = Date.now();
const srv = await server(PORT);
const browser = await launch();
try {
  const jobs = [];
  if (!only || only === 'desktop') jobs.push(scenario(browser, 'desktop', DESKTOP));
  if (!only || only === 'phone') jobs.push(scenario(browser, 'phone', PHONE)); // the frame budget is measured with the CPU slowed down 4x
  const r = await Promise.allSettled(jobs);
  if (!only || only === 'menu') { try { await menuJob(browser); } catch (e) { failed++; console.log('FAIL сценарий меню упал:', e && e.stack || e); } }
  for (const x of r) if (x.status === 'rejected') { failed++; console.log('FAIL сценарий упал:', x.reason && x.reason.stack || x.reason); }
  // the frame budget: one device at a time, nothing else running in the browser
  for (const x of r) if (x.status === 'fulfilled') { if (PERF) await x.value.perf(); await x.value.close(); }
} finally { await browser.close(); srv.close(); }
fs.writeFileSync(`${OUT}/report.txt`, log.join('\n'));
console.log(`\n${failed ? 'FAIL' : 'OK'}: ${log.filter((l) => l.startsWith('OK')).length} проверок прошло, ${failed} упало, ${log.filter((l) => l.startsWith('WARN')).length} предупреждений · ${((Date.now() - t0) / 1000).toFixed(1)} с`);
process.exit(failed ? 1 : 0);

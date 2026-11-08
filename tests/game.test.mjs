// Этап 5 (игра) в Node: параметры карты, столицы государств, правительственные кварталы, военные базы, рост столиц.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, audit, inWater, groundClash, label, where } from './audit.mjs';

const terrain = (seed, opt) => world(seed, Object.assign({}, opt, { terrainOnly: true }));
const landShare = (T) => { let l = 0, n = 0; for (let y = 2048; y < T.WORLD; y += 2048) for (let x = 2048; x < T.WORLD; x += 2048) { n++; if (T.baseH(x, y, 6) > 0.004) l++; } return l / n; };

test('тип и размер карты меняют сушу; без параметров мир классический', () => {
  const base = landShare(world(1337, { terrainOnly: true }));
  assert.equal(landShare(terrain(1337, { map: 'normal', size: 1, rivers: 2, lakes: 0 })), base, 'обычная средняя карта без озёр = классический мир');
  for (const map of ['normal', 'cont', 'arch', 'islands']) {
    const s = [0, 1, 2].map((size) => landShare(terrain(1337, { map, size })));
    assert.ok(s[0] < s[1] && s[1] < s[2], `${map}: малая < средняя < большая (${s.map((v) => v.toFixed(2))})`);
    assert.ok(s[0] > 0.04 && s[2] < 0.75, `${map}: разумная доля суши`);
  }
  assert.ok(landShare(terrain(1337, { map: 'arch' })) < landShare(terrain(1337, { map: 'normal' })), 'на архипелаге суши меньше');
});

test('реки отключаются, озёра появляются внутри суши', () => {
  const T0 = terrain(1337, { rivers: 0 });
  let wet = 0;
  for (let y = 4000; y < T0.WORLD; y += 3000) for (let x = 4000; x < T0.WORLD; x += 3000) { const e = T0.baseH(x, y, 7); if (e > 0.004 && T0.riverW(x, y, e) > 0) wet++; }
  assert.equal(wet, 0, 'без рек ширина русла везде 0');
  const lakes = (k) => { const T = terrain(1337, { lakes: k }), A = world(1337, { terrainOnly: true }); let n = 0;
    for (let y = 4000; y < T.WORLD; y += 1500) for (let x = 4000; x < T.WORLD; x += 1500) if (A.baseH(x, y, 6) > 0.03 && T.baseH(x, y, 6) < 0.004) n++; return n; };
  const [a, b, c] = [1, 2, 3].map(lakes);
  assert.ok(a > 0 && a < b && b < c, `мало < норм < много озёр (${a}, ${b}, ${c})`);
});

// столицы: как их ставит игра — на ровной суше, далеко друг от друга
function sites(T, n) {
  const out = [];
  for (let y = 12000; y < T.WORLD - 12000 && out.length < n; y += 2500) for (let x = 12000; x < T.WORLD - 12000 && out.length < n; x += 2500) {
    const e = T.landE(x, y, 0.006); if (e < 0.03 || e > 0.3) continue;
    let ok = 0; for (let a = 0; a < 8; a++) if (T.landE(x + Math.cos(a) * 3000, y + Math.sin(a) * 3000, 0) >= 0) ok++;
    if (ok < 7 || out.some((q) => Math.hypot(q.x - x, q.y - y) < 26000)) continue;
    out.push({ x, y, st: out.length, name: 'Столица ' + (out.length + 1), fl: { c: ['#c8102e', '#f4f4f0', '#1d3f8f'], p: 2, e: 1, ec: '#f2c230' } });
  }
  return out;
}
const OPT = { map: 'normal', size: 1, rivers: 2, lakes: 2, mountains: 0.42, empty: true }; // как в игре
const caps = sites(terrain(1337, OPT), 4);
const W = world(1337, Object.assign({ caps }, OPT));
const capC = W.cities.filter((c) => c.cap !== undefined);

test('игровой мир изначально пустой: ни городов, ни дорог, ни зон, ни судов и самолётов', () => {
  const E = world(1337, OPT);
  assert.deepEqual([E.cities.length, E.roads.length, E.zones.length, E.ships.length, E.flights.length, E.farms.length], [0, 0, 0, 0, 0, 0]);
});

test('в игровом мире гор меньше, суша та же', () => {
  const share = (T) => { let land = 0, mt = 0; for (let y = 1500; y < T.WORLD; y += 1500) for (let x = 1500; x < T.WORLD; x += 1500) { const e = T.baseH(x, y, 6); if (e < 0.004) continue; land++; if (e > 0.34) mt++; } return [land, mt / land]; };
  for (const seed of [1337, 20261107, 4242]) {
    const [l0, m0] = share(world(seed, { terrainOnly: true })), [l1, m1] = share(terrain(seed, Object.assign({}, OPT, { lakes: 0 })));
    assert.equal(l1, l0, seed + ': доля суши не меняется');
    assert.ok(m1 < 0.17 && m1 < m0 * 0.7, `${seed}: горы ${(m0 * 100).toFixed(0)}% → ${(m1 * 100).toFixed(0)}%`);
  }
});

test('суда и самолёты появляются только у портов и аэропортов столиц', () => {
  for (const sh of W.ships) assert.ok(capC.some((c) => c.id === sh.city), 'судно без порта');
  for (const f of W.flights) assert.ok(capC.some((c) => c.id === f.city), 'рейс без аэропорта');
});

test('столицы стоят ровно там, где основаны, с именами и правительственным кварталом; своих зон у них нет', () => {
  assert.equal(caps.length, 4);
  assert.equal(capC.length, 4);
  for (const q of caps) {
    const c = capC.find((k) => k.cap === q.st);
    assert.ok(c, 'столица ' + q.name);
    assert.equal(c.name, q.name); assert.equal(c.x, q.x); assert.equal(c.y, q.y); assert.equal(c.type, 3);
    assert.equal([...c.blocks].filter((t) => t === 21).length, 1, 'один правительственный квартал');
    assert.ok(!W.zones.some((z) => z.city === c && !z.dyn), 'заводы и базы ставят игроки, а не генератор');
  }
});

test('столицы соединены магистралями', () => {
  // магистраль (k=0) начинается или кончается у каждой столицы
  for (const c of capC) {
    const near = W.roads.some((r) => r.k === 0 && !r.ring && [0, r.n - 1].some((i) => Math.hypot(r.pts[i * 2] - c.x, r.pts[i * 2 + 1] - c.y) < c.R * 1.6));
    assert.ok(near, c.name + ': нет магистрали');
  }
});

// игра ставит сёла, города и постройки по ходу партии — те же вызовы идут в каждый worker
const D = world(1337, Object.assign({ caps }, OPT));
const dyn = { places: [], zones: [] };
{
  const c0 = D.cities.find((c) => c.cap === 0);
  const dry = (x, y, r) => { for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) if (D.landE(x + (a / 4 - 0.5) * r * 1.5, y + (b / 4 - 0.5) * r * 1.5, 0.002) < 0) return false; return true; };
  const free = (x, y, r) => dry(x, y, r) && D.cities.every((c) => Math.hypot(c.x - x, c.y - y) > c.R * 1.2 + r + 400) && D.zones.every((z) => Math.hypot(z.x - x, z.y - y) > z.rad + r);
  const spot = (cx, cy, r0, r1, r) => { for (let d = r0; d < r1; d += 250) for (let a = 0; a < 6.28; a += 0.3) { const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (free(x, y, r)) return [x, y]; } return null; };
  const v = spot(c0.x, c0.y, 5000, 12000, 400); if (v) dyn.places.push(D.addPlace({ k: 'village', x: v[0], y: v[1], st: 0, name: 'Село' }));
  const t = spot(c0.x, c0.y, 9000, 20000, 2000); if (t) dyn.places.push(D.addPlace({ k: 'city', x: t[0], y: t[1], st: 0, name: 'Новгород', R: 1500 }));
  const vill = D.cities[dyn.places[0]];
  for (const [zk, w, h, home] of [['farm', 300, 200, vill], ['ind', 640, 420, c0], ['pow', 760, 560, c0], ['saw', 360, 260, c0], ['oil', 130, 95, c0], ['ref2', 1000, 700, c0], ['mil', 720, 520, c0], ['sam', 150, 150, c0]]) {
    const q = spot(home.x, home.y, home.R * 1.3 + 600, home.R * 1.3 + 6000, Math.hypot(w, h) / 2); if (q) dyn.zones.push([zk, D.addZone({ zk, x: q[0], y: q[1], city: home.id, st: 0, W: w, H: h })]);
  }
}

test('новые сёла, города и постройки появляются в мире и соединяются дорогами', () => {
  assert.equal(dyn.places.length, 2, 'село и город поставлены');
  for (const id of dyn.places) { const c = D.cities[id]; assert.ok(c && c.dyn, 'поселение в мире'); assert.ok(D.roads.some((r) => r.city === undefined && [0, r.n - 1].some((i) => Math.hypot(r.pts[i * 2] - c.x, r.pts[i * 2 + 1] - c.y) < c.R * 1.6 + 300)), c.name + ': есть дорога'); }
  assert.ok(D.cities[dyn.places[1]].nblocks > 50, 'у нового города есть кварталы');
  assert.equal(dyn.zones.length, 8, 'все 8 построек встали: ' + dyn.zones.map((z) => z[0]).join(','));
  for (const [zk, id] of dyn.zones) { assert.ok(id >= 0, zk); const z = D.zones.find((q) => q.id === id); assert.ok(z.dyn && z.prims.length > 5, zk + ': есть содержимое'); }
  assert.ok(D.forestAt(0, 0) === 0 && D.forestAt(65536, 65536) >= 0);
});

test('мир с постройками игроков проходит общий аудит геометрии', () => {
  const RW = D._dbg.RW, bad = [];
  for (const z of D.zones) for (const p of z.prims) {
    if (p.k !== 'veh') continue;
    const x = z.x + p.x * z.ca - p.y * z.sa, y = z.y + p.x * z.sa + p.y * z.ca;
    for (const r of D.queryRoads(x - 40, y - 40, x + 40, y + 40)) { if (r.k === 8) continue;
      for (let i = 0; i < r.n - 1; i++) { const ax = r.pts[i * 2], ay = r.pts[i * 2 + 1], ex = r.pts[i * 2 + 2] - ax, ey = r.pts[i * 2 + 3] - ay, l2 = ex * ex + ey * ey || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)); if (Math.hypot(ax + ex * t - x, ay + ey * t - y) < RW[r.k] / 2 + 2) { bad.push(`техника на дороге k=${r.k}`); break; } } }
  }
  assert.deepEqual(bad.slice(0, 8), []);
  const A = audit(D);
  const list = (xs, f) => xs.slice(0, 8).map(f);
  assert.deepEqual(list(A.overlap, (it) => `${label(it.a)} | ${label(it.b)} @${where(it.a)}`), []);
  assert.deepEqual(list(A.overlapSame, (it) => `${label(it.a)} @${where(it.a)}`), []);
  assert.deepEqual(list(inWater(D), (o) => `${label(o)} @${where(o)}`), []);
});

test('мир со столицами проходит общий аудит геометрии', () => {
  const A = audit(W);
  const list = (xs, f) => xs.slice(0, 8).map(f);
  assert.deepEqual(list(A.onRoad, (it) => `${label(it.o)} на дороге k=${it.r.k} @${where(it.o)}`), []);
  assert.deepEqual(list(A.overlap, (it) => `${label(it.a)} | ${label(it.b)} @${where(it.a)}`), []);
  assert.deepEqual(list(inWater(W), (o) => `${label(o)} @${where(o)}`), []);
  assert.deepEqual(groundClash(W).slice(0, 8), []);
});

test('рост столицы: доля застройки задаётся и читается', () => {
  const c = capC[0];
  assert.equal(W.growOf(c.id), 1);
  W.setGrow(c.id, 0.3); assert.equal(W.growOf(c.id), 0.3);
  W.setGrow(c.id, 1); assert.equal(W.growOf(c.id), 1);
});

test('у файлов в index.html версия из package.json (сброс кэша GitHub Pages)', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const v = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version.split('.').slice(0, 2).join('.');
  const refs = [...html.matchAll(/(?:src|href)="src\/[^"?]+(\?v=[^"]*)?"/g)];
  assert.ok(refs.length >= 6, 'подключены style.css и 5 скриптов');
  for (const m of refs) assert.equal(m[1], '?v=' + v, m[0]);
  const ui = fs.readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.ok(ui.includes(`const VERSION='${v}'`), 'версия в меню');
});

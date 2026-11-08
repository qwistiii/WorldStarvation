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
const OPT = { map: 'normal', size: 1, rivers: 2, lakes: 2 };
const caps = sites(terrain(1337, OPT), 4);
const W = world(1337, Object.assign({ caps }, OPT));
const capC = W.cities.filter((c) => c.cap !== undefined);

test('столицы стоят ровно там, где основаны, с именами и правительственным кварталом', () => {
  assert.equal(caps.length, 4);
  assert.equal(capC.length, 4);
  for (const q of caps) {
    const c = capC.find((k) => k.cap === q.st);
    assert.ok(c, 'столица ' + q.name);
    assert.equal(c.name, q.name); assert.equal(c.x, q.x); assert.equal(c.y, q.y); assert.equal(c.type, 3);
    assert.equal([...c.blocks].filter((t) => t === 21).length, 1, 'один правительственный квартал');
    assert.ok(W.zones.some((z) => z.zk === 'mil' && z.city === c), 'у столицы есть военная база');
  }
});

test('столицы соединены магистралями', () => {
  // магистраль (k=0) начинается или кончается у каждой столицы
  for (const c of capC) {
    const near = W.roads.some((r) => r.k === 0 && !r.ring && [0, r.n - 1].some((i) => Math.hypot(r.pts[i * 2] - c.x, r.pts[i * 2 + 1] - c.y) < c.R * 1.6));
    assert.ok(near, c.name + ': нет магистрали');
  }
});

test('военные базы: техника стоит на земле базы, ничего не налезает на дороги и постройки', () => {
  const mil = W.zones.filter((z) => z.zk === 'mil');
  const veh = mil.reduce((a, z) => a + z.prims.filter((p) => p.k === 'veh').length, 0);
  assert.ok(veh > 100, 'на базах есть техника: ' + veh);
  for (const z of mil) for (const p of z.prims) if (p.k === 'veh' || p.k === 'flag') assert.ok(Math.abs(p.x) < z.W / 2 && Math.abs(p.y) < z.H / 2, 'техника за оградой');
  // техника не стоит на дорогах (подъезд к базе и проезды внутри — тоже дороги)
  const RW = W._dbg.RW, bad = [];
  for (const z of mil) for (const p of z.prims) {
    if (p.k !== 'veh') continue;
    const x = z.x + p.x * z.ca - p.y * z.sa, y = z.y + p.x * z.sa + p.y * z.ca;
    for (const r of W.queryRoads(x - 40, y - 40, x + 40, y + 40)) {
      if (r.k === 8) continue;
      for (let i = 0; i < r.n - 1; i++) { const ax = r.pts[i * 2], ay = r.pts[i * 2 + 1], ex = r.pts[i * 2 + 2] - ax, ey = r.pts[i * 2 + 3] - ay, l2 = ex * ex + ey * ey || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)); if (Math.hypot(ax + ex * t - x, ay + ey * t - y) < RW[r.k] / 2 + 2) { bad.push(`техника v=${p.v} на дороге k=${r.k} @${Math.round(x)},${Math.round(y)}`); break; } }
    }
  }
  assert.deepEqual(bad.slice(0, 8), []);
  // весь мир с государствами проходит те же проверки, что и классические миры
  const A = audit(W);
  const list = (xs, f) => xs.slice(0, 8).map(f);
  assert.deepEqual(list(A.onRoad, (it) => `${label(it.o)} на дороге k=${it.r.k} @${where(it.o)}`), []);
  assert.deepEqual(list(A.overlap, (it) => `${label(it.a)} | ${label(it.b)} @${where(it.a)}`), []);
  assert.deepEqual(list(A.overlapSame, (it) => `${label(it.a)} @${where(it.a)}`), []);
  assert.deepEqual(list(inWater(W), (o) => `${label(o)} @${where(o)}`), []);
  assert.deepEqual(groundClash(W).slice(0, 8), []);
});

test('рост столицы: доля застройки задаётся и читается', () => {
  const c = capC[0];
  assert.equal(W.growOf(c.id), 1);
  W.setGrow(c.id, 0.3); assert.equal(W.growOf(c.id), 0.3);
  W.setGrow(c.id, 1); assert.equal(W.growOf(c.id), 1);
});

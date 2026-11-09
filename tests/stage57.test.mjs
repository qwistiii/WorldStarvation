// Этап 5.7 в Node: дороги игры обходят постройки, пересечения дорог игры (путепроводы и стыки), разные планировки городов,
// поля без колец, месторождения уходят из-под города, туман прячет постройки, железные дороги, улучшения построек.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, audit, inWater, label, where, levelCrossings, railEnds, groundClash, deadEnds } from './audit.mjs';

// ---- классический мир (без параметров) не изменился ни в одной точке дорог, кварталов и зон
test('классический мир бит в бит прежний (контрольная сумма дорог, кварталов и зон seed 1337)', () => {
  const W = world(1337); let h = 0;
  const add = (v) => { const s = typeof v === 'number' ? v.toFixed(3) : String(v); for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; };
  for (const r of W.roads) { add(r.k); for (const v of r.pts) add(v); for (const q of r.jz || []) add(q.join()); for (const q of r.ov || []) add(q.join()); for (const q of r.br || []) add(q.join()); }
  for (const c of W.cities) { add(c.x); add(c.y); if (c.blocks) for (const t of c.blocks) add(t); }
  for (const z of W.zones) { add(z.zk); add(z.x); add(z.prims.length); }
  assert.equal(h, -986491180);
  assert.ok(W.cities.every((c) => !c.wp), 'в классическом мире все сетки прямые');
});

// ---- игровой мир со столицами (как в игре)
const terrain = (seed, opt) => world(seed, Object.assign({}, opt, { terrainOnly: true }));
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
const OPT = { map: 'normal', size: 1, rivers: 2, lakes: 2, mountains: 0.42, empty: true };

// партия: вокруг столицы 0 кольцом встают постройки, за ними — сёла и города (их дороги к столице идут через кольцо построек)
function play(seed) {
  const caps = sites(terrain(seed, OPT), 3), D = world(seed, Object.assign({ caps }, OPT)), r0 = D.roads.length;
  const c0 = D.cities.find((c) => c.cap === 0), RW = D._dbg.RW;
  const dry = (x, y, r) => { for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) if (D.landE(x + (a / 4 - 0.5) * r * 1.5, y + (b / 4 - 0.5) * r * 1.5, 0.002) < 0) return false; return true; };
  const roadNear = (x, y, r) => D.queryRoads(x - r, y - r, x + r, y + r).some((q) => { if (q.k === 8 || q.dead) return false; const p = D._dbg.projOn(q, x, y); return Math.hypot(p[0] - x, p[1] - y) < r; });
  const free = (x, y, r) => dry(x, y, r) && D.cities.every((c) => Math.hypot(c.x - x, c.y - y) > c.R * 1.25 + r + 400) && D.zones.every((z) => z.dead || Math.hypot(z.x - x, z.y - y) > z.rad + r + 120) && !roadNear(x, y, r + 30);
  const zones = [], places = [];
  const kinds = ['farm', 'ind', 'pow', 'saw', 'sol2', 'mine', 'gasw', 'rst', 'dport', 'dramp', 'drwy', 'dstore', 'dfab', 'sam', 'ref2', 'mil'];
  const SZ = { farm: [300, 200], ind: [640, 420], pow: [760, 560], saw: [360, 260], ref2: [1000, 700], mil: [720, 520] };
  for (let i = 0, a = 0.2; i < kinds.length * 3 && zones.length < kinds.length; i++, a += 0.41) {
    const zk = kinds[zones.length], d = c0.R * 1.3 + 900 + (i % 3) * 700, x = c0.x + Math.cos(a) * d, y = c0.y + Math.sin(a) * d, [w, h] = SZ[zk] || [0, 0];
    if (!free(x, y, Math.hypot(w || 300, h || 220) / 2)) continue;
    const q = { zk, x, y, city: c0.id, st: 0, ore: 3 }; if (w) { q.W = w; q.H = h; }
    const id = D.addZone(q); if (id >= 0) zones.push(id);
  }
  for (let i = 0, a = 0.05; i < 60 && places.length < 8; i++, a += 0.77) {
    const city = i % 3 === 0, d = c0.R * 1.3 + 6000 + (i % 4) * 1800, x = c0.x + Math.cos(a) * d, y = c0.y + Math.sin(a) * d;
    if (!free(x, y, city ? 2200 : 500)) continue;
    places.push(D.addPlace({ k: city ? 'city' : 'village', x, y, st: 0, name: 'П' + i, R: city ? 1500 : undefined }));
  }
  return { D, r0, c0, zones, places, RW };
}
const P1 = play(1337), P2 = play(20261107);

test('постройки встали, сёла и города добавлены', () => {
  for (const P of [P1, P2]) {
    assert.ok(P.zones.length >= 12, 'построек: ' + P.zones.length);
    assert.ok(P.places.length >= 5, 'поселений: ' + P.places.length);
  }
});

test('каждое новое село и город соединены дорогой с соседним поселением (обход построек не оставляет без дороги)', () => {
  for (const P of [P1, P2]) for (const id of P.places) {
    const c = P.D.cities[id], own = new Set((c.vst || []).map((s) => s.r));
    const ok = P.D.roads.some((r) => r.city === undefined && !own.has(r) && r.k !== 8 && [0, r.n - 1].some((i) => Math.hypot(r.pts[i * 2] - c.x, r.pts[i * 2 + 1] - c.y) < c.R * 1.6 + 300));
    assert.ok(ok, c.name + ': нет дороги к соседям');
  }
});

test('дороги, проложенные в игре, не идут через постройки (обходят их)', () => {
  for (const P of [P1, P2]) {
    const { D, r0, RW } = P, bad = [];
    for (let i = r0; i < D.roads.length; i++) {
      const r = D.roads[i]; if (r.k === 8 || r.dead || r.city !== undefined) continue;
      const own = D.zones.filter((z) => z.link === r || z.acc === r);
      const h = D._dbg.zoneOnPath(Array.from(r.pts), RW[r.k] / 2 + 1, own);
      if (h) bad.push(`дорога k=${r.k} #${r.id} через ${h[1].zk}#${h[1].id} @${Math.round(h[1].x)},${Math.round(h[1].y)}`);
    }
    assert.deepEqual(bad.slice(0, 8), []);
  }
});

test('у ПВО и солнечных панелей нет подъездной дороги, у остальных построек есть', () => {
  for (const P of [P1, P2]) for (const id of P.zones) {
    const z = P.D.zones[id];
    if (z.zk === 'sam' || z.zk === 'sol2' || z.zk === 'dramp' || z.zk === 'drwy') assert.ok(!z.link, z.zk + ': без дороги');
    else assert.ok(z.link && z.link.L > 10, z.zk + ': есть дорога');
  }
});

// точка (x,y) лежит в зоне стыка дороги r (там разметка и бордюры не рисуются)?
function inJz(D, r, x, y) { let best = 1e18, bs = 0; for (let i = 0; i < r.n - 1; i++) { const ax = r.pts[i * 2], ay = r.pts[i * 2 + 1], dx = r.pts[i * 2 + 2] - ax, dy = r.pts[i * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); const d = (ax + dx * t - x) ** 2 + (ay + dy * t - y) ** 2; if (d < best) { best = d; bs = r.cum[i] + t * Math.sqrt(l2); } }
  return (r.jz || []).some((q) => bs >= q[0] - 0.5 && bs <= q[1] + 0.5); }
const onOv = (r, s) => (r.ov || []).some((o) => s > o[0] - 1 && s < o[1] + 1);

test('пересечения дорог игры: с магистралью и железной дорогой — путепровод, остальные — стык без разметки', () => {
  for (const P of [P1, P2]) {
    const { D, r0 } = P;
    assert.deepEqual(levelCrossings(D).slice(0, 6).map((o) => `k=${o.a.k}/${o.b.k} @${Math.round(o.x)},${Math.round(o.y)}`), [], 'ж/д и магистрали не пересекаются в одном уровне');
    const bad = []; let n = 0;
    for (let i = r0; i < D.roads.length; i++) {
      const a = D.roads[i]; if (a.k === 8 || a.k === 5 || a.k === 0 || a.dead) continue;
      for (const b of D.queryRoads(a.bb[0], a.bb[1], a.bb[2], a.bb[3])) {
        if (b === a || b.k === 8 || b.k === 5 || b.k === 0 || b.dead) continue;
        for (let p = 0; p < a.n - 1; p++) for (let q = 0; q < b.n - 1; q++) {
          const ax = a.pts[p * 2], ay = a.pts[p * 2 + 1], ex = a.pts[p * 2 + 2] - ax, ey = a.pts[p * 2 + 3] - ay, cx = b.pts[q * 2], cy = b.pts[q * 2 + 1], fx = b.pts[q * 2 + 2] - cx, fy = b.pts[q * 2 + 3] - cy, den = ex * fy - ey * fx;
          if (Math.abs(den) < 1e-9) continue; const t = ((cx - ax) * fy - (cy - ay) * fx) / den, u = ((cx - ax) * ey - (cy - ay) * ex) / den; if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const X = ax + ex * t, Y = ay + ey * t, sa = a.cum[p] + t * Math.hypot(ex, ey), sb = b.cum[q] + u * Math.hypot(fx, fy); if (onOv(a, sa) || onOv(b, sb)) continue; n++;
          if (!inJz(D, a, X, Y) || !inJz(D, b, X, Y)) bad.push(`k=${a.k}/${b.k} @${Math.round(X)},${Math.round(Y)}`);
        }
      }
    }
    assert.ok(n > 20, 'пересечений проверено: ' + n);
    assert.deepEqual(bad.slice(0, 8), []);
  }
});

test('мир с постройками и поселениями игры проходит аудит геометрии', () => {
  for (const P of [P1, P2]) {
    const A = audit(P.D), list = (xs, f) => xs.slice(0, 8).map(f);
    assert.deepEqual(list(A.onRoad, (it) => `${label(it.o)} на дороге k=${it.r.k} @${where(it.o)}`), []);
    assert.deepEqual(list(A.overlap, (it) => `${label(it.a)} | ${label(it.b)} @${where(it.a)}`), []);
    assert.deepEqual(list(A.overlapSame, (it) => `${label(it.a)} @${where(it.a)}`), []);
    assert.deepEqual(list(inWater(P.D), (o) => `${label(o)} @${where(o)}`), []);
  }
});

test('города игры — разные планировки: кольца и лучи, веер, прямые и изогнутые сетки, суперкварталы, диагонали', () => {
  const towns = [P1, P2].flatMap((P) => P.D.cities.filter((c) => c.type >= 2).map((c) => [P.D, c]));
  const fams = new Set(towns.map(([, c]) => c.lay));
  assert.ok(fams.size >= 4, 'семейств планировок: ' + [...fams].join(', '));
  for (const P of [P1, P2]) { const L = P.D.cities.filter((c) => c.cap !== undefined).map((c) => c.lay); assert.equal(new Set(L).size, L.length, 'у столиц одной партии разные планировки: ' + L); }
  assert.ok(towns.some(([, c]) => c.pol && c.pol.full) && towns.some(([, c]) => c.pol && !c.pol.full), 'есть радиально-кольцевые и веерные города');
  assert.ok(towns.filter(([, c]) => !c.pol && c.msi + c.msj > 0).length >= 3, 'в сетках есть суперкварталы');
  for (const [W, c] of towns) {
    const BD = c.D - 1, RW = W._dbg.RW, own = W.roads.filter((r) => r.city === c.id && !r.dg);
    // обратное отображение возвращает в ту же точку сетки
    for (let q = 0; q < 30; q++) { const i = 1 + (q * 7) % (BD - 2), j = 1 + (q * 13) % (BD - 2), u = (c.us[i] + c.us[i + 1]) / 2, v = (c.vs[j] + c.vs[j + 1]) / 2; if (c.pol && j >= c.nr) continue;
      const w = W.cW(c, u, v), b = W.cU(c, w[0], w[1]); assert.ok(Math.hypot(b[0] - u, (b[1] - v) * (c.pol ? u / c.prr : 1)) < 0.05, c.name + ': cU(cW) = id'); }
    let worst = 0, inner = 0, merged = 0;
    for (let bj = 0; bj < BD; bj++) for (let bi = 0; bi < BD; bi++) {
      if (!c.blocks[bj * BD + bi]) continue; const q = c.sp ? c.sp[bj * BD + bi] : 0, si = (q & 15) + 1, sj = (q >> 4) + 1;
      const [x, y, ca, sa, hu, hv] = W.blkFrame(c, bi, bj);
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const rx = x + su * hu * ca - sv * hv * sa, ry = y + su * hu * sa + sv * hv * ca;
        if (c.pol) { // угол прямоугольника лежит в своём секторе: между лучами и между дугами
          const [u, v0] = W.cU(c, rx, ry), e = 0.6 / Math.max(u, 1) * c.prr, per = 2 * Math.PI * c.prr, v = v0 + Math.round(((c.vs[bj] + c.vs[bj + sj]) / 2 - v0) / per) * per;
          if (u < c.us[bi] - 0.3 || u > c.us[bi + si] + 0.3 || v < c.vs[bj] - e || v > c.vs[bj + sj] + e) worst = Math.max(worst, 99);
        } else { const gi = su < 0 ? bi : bi + si, gj = sv < 0 ? bj : bj + sj, g = W.cW(c, c.us[gi], c.vs[gj]); worst = Math.max(worst, Math.hypot(g[0] - rx, g[1] - ry)); }
      }
      // внутри суперквартала улиц нет: середина внутренней линии сетки далеко от улиц города
      if (si > 1 || sj > 1) { merged++; const m = si > 1 ? W.cW(c, c.us[bi + (si >> 1)], (c.vs[bj] + c.vs[bj + sj]) / 2) : W.cW(c, (c.us[bi] + c.us[bi + si]) / 2, c.vs[bj + (sj >> 1)]);
        for (const r of own) { const p = W._dbg.projOn(r, m[0], m[1]); if (Math.hypot(p[0] - m[0], p[1] - m[1]) < RW[r.k] / 2 + 2) { inner++; break; } } }
    }
    assert.ok(worst < 4.5, `${c.name} (${c.lay}): углы кварталов отходят от сетки на ${worst.toFixed(1)} м`);
    assert.equal(inner, 0, `${c.name}: улица внутри суперквартала (${inner} из ${merged})`);
    if (c.diag) assert.ok(W.roads.some((r) => r.city === c.id && r.dg && r.k === 7), c.name + ': диагональный бульвар');
  }
  // у сетки — свои проспекты: шаг главных линий различается
  const gaps = new Set(); for (const [, c] of towns) if (c.kU && !c.pol) { let last = -1; for (let i = 0; i < c.D; i++) if (c.kU[i] !== 3) { if (last >= 0) gaps.add(i - last); last = i; } }
  assert.ok(gaps.size >= 3, 'расстояния между проспектами: ' + [...gaps]);
});

test('новые кварталы (микрорайоны, площади) без наложений; улицы городов игры не обрываются в пустоте', () => {
  for (const P of [P1, P2]) {
    assert.deepEqual(groundClash(P.D).slice(0, 6), []);
    const dead = deadEnds(P.D).filter((e) => e.r.city !== undefined && P.D.cities[e.r.city].lay);
    assert.deepEqual(dead.slice(0, 6).map((e) => `k=${e.r.k} @${Math.round(e.x)},${Math.round(e.y)}`), []);
    const T = new Set(); for (const c of P.D.cities) if (c.lay) for (const t of c.blocks) T.add(t);
    assert.ok(T.has(22) && T.has(23), 'есть микрорайоны и площади');
  }
});

test('поля вокруг поселений — не кольца: на одном расстоянии есть и пашня, и луг, рядом с городом — пашня', () => {
  const { D } = P1, { fieldOn, fieldR } = D._dbg;
  for (const c of D.cities.filter((q) => q.cap !== undefined || q.dyn).slice(0, 6)) {
    const R = fieldR(c); let near = 0, n1 = 0, ring = 0, n2 = 0;
    for (let a = 0; a < 6.283; a += 0.05) {
      const h = (x, y) => (Math.imul(Math.round(x), 2654435761) ^ Math.imul(Math.round(y), 40503)) >>> 0;
      const x1 = c.x + Math.cos(a) * R * 0.45, y1 = c.y + Math.sin(a) * R * 0.45; n1++; near += fieldOn(x1, y1, h(x1, y1) | 1);
      const x2 = c.x + Math.cos(a) * R * 1.0, y2 = c.y + Math.sin(a) * R * 1.0; n2++; ring += fieldOn(x2, y2, h(x2, y2) | 1);
    }
    assert.ok(near / n1 > 0.6, `${c.name}: у города пашни ${(near / n1 * 100).toFixed(0)} %`);
    assert.ok(ring / n2 > 0.15 && ring / n2 < 0.85, `${c.name}: на краю пашня и луг вперемешку (${(ring / n2 * 100).toFixed(0)} % пашни)`);
  }
});

test('месторождение уходит из-под нового города, туман прячет постройку и её дорогу', () => {
  const { D, zones } = P1;
  const n = D.addDeposits([[3, 60000, 60000, 260]]) - 1, old = D.deps[n];
  assert.equal(D.moveDeposit([n, 61500, 60500]), n);
  assert.ok(old.dead && D.deps[n].x === 61500 && D.deps[n].y === 60500 && !D.deps[n].dead, 'месторождение переехало');
  const z = D.zones.find((q) => zones.includes(q.id) && q.link);
  D.setHidden([z.id]);
  assert.ok(D.isHid(z.id) && !D.roadShown(z.link), 'постройка и её дорога скрыты');
  D.setHidden([]);
  assert.ok(!D.isHid(z.id) && D.roadShown(z.link), 'снова видны');
});

test('железная дорога игры: от вокзала до вокзала, через дороги — путепроводом, концы на вокзалах', () => {
  const { D, c0 } = P1, RW = D._dbg.RW;
  // два вокзала по разные стороны столицы, путь обходит её стороной
  const st = [];
  for (const [a, d] of [[1.2, c0.R * 1.3 + 3500], [2.4, c0.R * 1.3 + 3800], [3.6, c0.R * 1.3 + 3600], [4.8, c0.R * 1.3 + 3900], [0.3, c0.R * 1.3 + 4200]]) {
    if (st.length >= 2) break; const x = c0.x + Math.cos(a) * d, y = c0.y + Math.sin(a) * d;
    if (D.zones.some((z) => !z.dead && Math.hypot(z.x - x, z.y - y) < z.rad + 400)) continue;
    const id = D.addZone({ zk: 'rst', x, y, a: a + Math.PI / 2, city: c0.id, st: 0 }); if (id >= 0) st.push(id);
  }
  assert.equal(st.length, 2, 'два вокзала');
  const P = D.railPts(D.zones[st[0]], D.zones[st[1]]);
  assert.ok(Array.isArray(P), 'путь проложен: ' + P);
  const id = D.addRail({ a: st[0], b: st[1], st: 0 }), r = D.roads[id];
  assert.ok(r && r.k === 5 && r.L > 2000, 'рельсы в мире');
  for (const e of [0, r.n - 1]) assert.ok(st.some((s) => Math.hypot(D.zones[s].x - r.pts[e * 2], D.zones[s].y - r.pts[e * 2 + 1]) < 5), 'конец пути — на вокзале');
  assert.ok(!D._dbg.zoneOnPath(Array.from(r.pts).slice(6, -6), RW[5] / 2, st.map((s) => D.zones[s])), 'путь не идёт через постройки');
  assert.deepEqual(levelCrossings(D).slice(0, 4).map((o) => `k=${o.a.k}/${o.b.k}`), [], 'дороги проходят над рельсами по путепроводам');
  assert.equal(D.removeRail(id), id); assert.ok(r.dead && !D.roadShown(r), 'путь разобран');
});

test('улучшения цеха БПЛА: та же планировка, плюс сетка, бетон и солнечные панели', () => {
  const { D, zones } = P2; const z = D.zones.find((q) => zones.includes(q.id) && q.zk === 'dfab'); assert.ok(z, 'цех стоит');
  const base = z.prims.filter((p) => !p.fz).map((p) => p.k + ':' + Math.round(p.x || 0)).join(',');
  D.zoneUp([z.id, 'net']); D.zoneUp([z.id, 'con']); D.zoneUp([z.id, 'sol']);
  assert.ok(z.prims.some((p) => p.net), 'сетка над корпусами');
  assert.ok(z.prims.filter((p) => p.k === 'twall').length >= 2, 'бетонные стены');
  assert.ok(z.prims.filter((p) => p.k === 'pv').length >= 3, 'ряды солнечных панелей');
  assert.ok(z.prims.filter((p) => !p.fz).length > base.split(',').length, 'добавились детали');
  assert.ok(z.prims.filter((p) => p.fz).length > 20, 'свободные места площадки заняты деталями');
  const A = audit(D); assert.deepEqual(A.overlapSame.filter((it) => it.a.zone === z).slice(0, 4).map((it) => label(it.a)), []);
});

test('постройки игры без пустых площадок: свободные части заняты деталями своего дела, ничего не налезает', () => {
  const K = { ind: 30, pow: 30, ref2: 20, saw: 10, mine: 10, mil: 15, dport: 8, dfab: 15, farm: 8 };
  for (const P of [P1, P2]) for (const id of P.zones) {
    const z = P.D.zones[id]; if (!K[z.zk]) continue;
    const n = z.prims.filter((p) => p.fz).length;
    assert.ok(n >= K[z.zk], `${z.zk}#${z.id}: деталей ${n}`);
    for (const p of z.prims) if (p.fz && p.k === 'b') assert.ok(p.x >= -z.W / 2 && p.x + p.w <= z.W / 2 && p.y >= -z.H / 2 && p.y + p.h <= z.H / 2, `${z.zk}: деталь за краем площадки`);
  }
});

test('железная дорога сама огибает город: вокзалы по разные стороны столицы — путь идёт вокруг застройки дугой', () => {
  const W = play(1337), c0 = W.c0, D = W.D, d = c0.R * 1.3 + 900; let done = 0;
  for (const a of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
    const st = []; for (const s of [0, 1]) { const aa = a + s * Math.PI, x = c0.x + Math.cos(aa) * d, y = c0.y + Math.sin(aa) * d; if (D.landE(x, y, 0.004) < 0) break; if (D.zones.some((z) => !z.dead && Math.hypot(z.x - x, z.y - y) < z.rad + 500)) break; const id = D.addZone({ zk: 'rst', x, y, a: aa + Math.PI / 2, city: c0.id, st: 0 }); if (id >= 0) st.push(id); }
    if (st.length < 2) continue;
    const P = D.railPts(D.zones[st[0]], D.zones[st[1]]); assert.ok(Array.isArray(P), 'путь найден: ' + P);
    let minF = 9, turn = 0; for (let i = 0; i < P.length; i += 2) minF = Math.min(minF, Math.hypot(P[i] - c0.x, P[i + 1] - c0.y) / c0.R);
    for (let i = 2; i < P.length - 2; i += 2) { const a1 = Math.atan2(P[i + 1] - P[i - 1], P[i] - P[i - 2]), a2 = Math.atan2(P[i + 3] - P[i + 1], P[i + 2] - P[i]); let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da; turn = Math.max(turn, da); }
    assert.ok(minF > 1, `путь не заходит в застройку (ближе всего ${minF.toFixed(2)} R)`);
    assert.ok(turn < 0.5, `путь плавный (излом ${turn.toFixed(2)} рад)`);
    const id = D.addRail({ a: st[0], b: st[1], st: 0 }); assert.ok(id >= 0 && D.roads[id].k === 5, 'путь в мире');
    if (++done >= 2) break;
  }
  assert.ok(done >= 1, 'проверено путей: ' + done);
});

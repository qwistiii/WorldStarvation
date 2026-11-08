// Аудит геометрии мира: что на что налезает. Используется тестами (tests/geometry.test.mjs) и CLI (tools/audit.mjs).
// Всё считается в мировых координатах: здания — повёрнутые прямоугольники, дороги — ломаные с шириной RW[k].
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let WG = null;
export function world(seed) {
  if (!WG) { const ctx = vm.createContext({ console }); vm.runInContext(fs.readFileSync(path.join(root, 'src/gen.js'), 'utf8'), ctx); WG = ctx.WorldGen; }
  return WG(seed);
}

// отрезок (в мировых координатах) пересекает прямоугольник с центром c, углом и полуразмерами hx, hy
export function segHitsRect(ax, ay, bx, by, cx, cy, ca, sa, hx, hy) {
  const x0 = (ax - cx) * ca + (ay - cy) * sa, y0 = -(ax - cx) * sa + (ay - cy) * ca;
  const x1 = (bx - cx) * ca + (by - cy) * sa, y1 = -(bx - cx) * sa + (by - cy) * ca;
  let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 + hx], [dx, hx - x0], [-dy, y0 + hy], [dy, hy - y0]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
// пересечение двух повёрнутых прямоугольников (теорема о разделяющей оси); shrink — допуск, м
export function rectsOverlap(a, b, shrink = 0.05) {
  const ax = [[a.ca, a.sa], [-a.sa, a.ca]], bx = [[b.ca, b.sa], [-b.sa, b.ca]];
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [ux, uy] of [...ax, ...bx]) {
    const ra = a.hw * Math.abs(ux * a.ca + uy * a.sa) + a.hh * Math.abs(-ux * a.sa + uy * a.ca);
    const rb = b.hw * Math.abs(ux * b.ca + uy * b.sa) + b.hh * Math.abs(-ux * b.sa + uy * b.ca);
    if (Math.abs(dx * ux + dy * uy) >= ra + rb - shrink) return false;
  }
  return true;
}
// примитив здания в локальной системе (ox, oy, угол) → мировой прямоугольник
export function wrect(p, ox, oy, ca, sa, tag) {
  const lx = p.x + p.w / 2, ly = p.y + p.h / 2, a = Math.atan2(sa, ca) + (p.a || 0);
  return { x: ox + lx * ca - ly * sa, y: oy + lx * sa + ly * ca, hw: p.w / 2, hh: p.h / 2, ca: Math.cos(a), sa: Math.sin(a), tag, p };
}
export function wcirc(p, ox, oy, ca, sa, r, tag) {
  return { x: ox + p.x * ca - p.y * sa, y: oy + p.x * sa + p.y * ca, hw: r, hh: r, ca: 1, sa: 0, tag, p, circ: true };
}

// точное расстояние от отрезка (мировые координаты) до прямоугольника R; 0 — пересекает
function segRectDist(ax, ay, bx, by, R) {
  if (segHitsRect(ax, ay, bx, by, R.x, R.y, R.ca, R.sa, R.hw, R.hh)) return 0;
  const tl = (x, y) => [(x - R.x) * R.ca + (y - R.y) * R.sa, -(x - R.x) * R.sa + (y - R.y) * R.ca];
  const [x0, y0] = tl(ax, ay), [x1, y1] = tl(bx, by);
  const pr = (x, y) => Math.hypot(x - Math.max(-R.hw, Math.min(R.hw, x)), y - Math.max(-R.hh, Math.min(R.hh, y)));
  const ps = (x, y) => { const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)); return Math.hypot(x0 + dx * t - x, y0 + dy * t - y); };
  return Math.min(pr(x0, y0), pr(x1, y1), ps(-R.hw, -R.hh), ps(R.hw, -R.hh), ps(R.hw, R.hh), ps(-R.hw, R.hh));
}
// дорога, на которую налезает прямоугольник (с запасом mg к полуширине дороги)
export function roadOn(W, R, keep, mg = 0) {
  const RW = W._dbg.RW, rad = Math.hypot(R.hw, R.hh) + 40;
  for (const r of W.queryRoads(R.x - rad, R.y - rad, R.x + rad, R.y + rad)) {
    if (r.k === 8 || !keep(r)) continue;
    const m = RW[r.k] / 2 + mg;
    for (let i = 0; i < r.n - 1; i++) {
      const ax = r.pts[i * 2], ay = r.pts[i * 2 + 1], bx = r.pts[i * 2 + 2], by = r.pts[i * 2 + 3];
      if (R.circ) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((R.x - ax) * dx + (R.y - ay) * dy) / l2));
        if (Math.hypot(ax + dx * t - R.x, ay + dy * t - R.y) < R.hw + m) return r; }
      else if (segRectDist(ax, ay, bx, by, R) < m) return r;
    }
  }
  return null;
}

// все постройки мира: здания кварталов, сёл и зон, резервуары и цилиндры зон
export function collect(W, { trees = false } = {}) {
  const { genVillage, genBlock } = W._dbg; const out = [];
  for (const c of W.cities) {
    if (c.type >= 1) {
      const BD = c.D - 1;
      for (let bj = 0; bj < BD; bj++) for (let bi = 0; bi < BD; bi++) {
        const t = c.blocks[bj * BD + bi]; if (!t) continue;
        const u = (c.us[bi] + c.us[bi + 1]) / 2, v = (c.vs[bj] + c.vs[bj + 1]) / 2;
        const ox = c.x + u * c.ca - v * c.sa, oy = c.y + u * c.sa + v * c.ca;
        const blk = { city: c, bi, bj, t };
        for (const p of genBlock(c, bi, bj, t)) {
          if (p.k === 'b') out.push(Object.assign(wrect(p, ox, oy, c.ca, c.sa, 'city'), { blk }));
          else if (p.k === 'cyl') out.push(Object.assign(wcirc(p, ox, oy, c.ca, c.sa, p.r, 'city'), { blk }));
          else if (trees && p.k === 't') out.push(Object.assign(wcirc(p, ox, oy, c.ca, c.sa, p.d * 0.4, 'tree'), { blk }));
        }
      }
    } else {
      c.vst.forEach((st, si) => {
        for (const p of genVillage(c, si)) {
          if (p.k === 'b') out.push(Object.assign(wrect(p, st.x0, st.y0, st.ca, st.sa, 'village'), { vil: c, st }));
          else if (trees && p.k === 't') out.push(Object.assign(wcirc(p, st.x0, st.y0, st.ca, st.sa, p.d * 0.4, 'tree'), { vil: c, st }));
        }
      });
    }
  }
  for (const z of W.zones) {
    if (!z.prims) continue;
    for (const p of z.prims) {
      if (p.k === 'b') out.push(Object.assign(wrect(p, z.x, z.y, z.ca, z.sa, 'zone'), { zone: z }));
      else if (p.k === 'cyl') out.push(Object.assign(wcirc(p, z.x, z.y, z.ca, z.sa, p.r, 'zone'), { zone: z }));
      else if (trees && p.k === 't') out.push(Object.assign(wcirc(p, z.x, z.y, z.ca, z.sa, p.d * 0.4, 'tree'), { zone: z }));
    }
  }
  return out;
}

// какие дороги «свои» для объекта и потому не считаются помехой
function ownRoad(o, r) {
  if (o.st && r === o.st.r) return true;                         // улица села, вдоль которой стоит дом
  if (o.zone && o.zone.zk === 'air') return true;                // у аэропорта свои рулёжки
  return false;
}

// пространственная сетка для попарных проверок
function grid(list, cell) {
  const g = new Map();
  list.forEach((o, i) => {
    const r = Math.hypot(o.hw, o.hh);
    for (let gy = Math.floor((o.y - r) / cell); gy <= Math.floor((o.y + r) / cell); gy++)
      for (let gx = Math.floor((o.x - r) / cell); gx <= Math.floor((o.x + r) / cell); gx++) {
        const k = gx * 100000 + gy; let a = g.get(k); if (!a) g.set(k, a = []); a.push(i);
      }
  });
  return g;
}
const sameOwner = (a, b) => (a.blk && b.blk && a.blk === b.blk) || (a.st && a.st === b.st) || (a.zone && a.zone === b.zone);
const circOverlap = (a, b, s) => Math.hypot(a.x - b.x, a.y - b.y) < a.hw + b.hw - s;
function overlap2(a, b, s) {
  if (a.circ && b.circ) return circOverlap(a, b, s);
  if (a.circ || b.circ) { const c = a.circ ? a : b, r = a.circ ? b : a; // круг против прямоугольника
    const dx = c.x - r.x, dy = c.y - r.y, lx = dx * r.ca + dy * r.sa, ly = -dx * r.sa + dy * r.ca;
    const qx = Math.max(-r.hw, Math.min(r.hw, lx)), qy = Math.max(-r.hh, Math.min(r.hh, ly));
    return Math.hypot(lx - qx, ly - qy) < c.hw - s; }
  return rectsOverlap(a, b, s);
}

// дубли дорог: участок одной дороги длиной > minRun идёт вплотную вдоль другой (не пересекает её)
export function parallelRoads(W, minRun = 80) {
  const RW = W._dbg.RW, bad = [];
  for (const a of W.roads) {
    if (a.k === 8 || a.k === 6) continue;
    let run = 0, last = null;
    for (let s = 15; s < a.L - 15; s += 10) {
      const p = W.posAt(a, s); let hit = null;
      for (const b of W.queryRoads(p[0] - 40, p[1] - 40, p[0] + 40, p[1] + 40)) {
        if (b === a || b.k === 8 || b.k === 6) continue;
        if (a.city !== undefined && a.city === b.city) continue; // улицы одного города образуют сетку
        const lim = (RW[a.k] + RW[b.k]) / 2 - 1;
        for (let i = 0; i < b.n - 1; i++) {
          const ax = b.pts[i * 2], ay = b.pts[i * 2 + 1], dx = b.pts[i * 2 + 2] - ax, dy = b.pts[i * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2));
          const d = Math.hypot(ax + dx * t - p[0], ay + dy * t - p[1]);
          if (d < lim && Math.abs((dx * p[2] + dy * p[3]) / Math.sqrt(l2)) > 0.9) { hit = b; break; }
        }
        if (hit) break;
      }
      if (hit && (!last || hit === last)) { run += 10; last = hit; if (run === minRun) bad.push({ a, b: hit, x: p[0], y: p[1] }); }
      else { run = 0; last = hit; }
    }
  }
  return bad;
}

export function audit(W, opts = {}) {
  const objs = collect(W, { trees: opts.trees });
  const R = {
    onRoad: [],        // постройка на чужой дороге
    treeOnRoad: [],    // дерево на проезжей части
    overlap: [],       // постройки разных владельцев налезают друг на друга
    overlapSame: [],   // постройки одного квартала/улицы/зоны налезают друг на друга
    turbine: [],       // ветряк на дороге или в постройке
    n: objs.length,
  };
  for (const o of objs) {
    if (o.tag === 'tree') { // ствол (а не крона) не должен стоять на проезжей части
      const r = roadOn(W, { x: o.x, y: o.y, hw: 0.4, hh: 0.4, ca: 1, sa: 0 }, (r) => !ownRoad(o, r), 0);
      if (r) R.treeOnRoad.push({ o, r });
      continue;
    }
    const r = roadOn(W, o, (r) => !ownRoad(o, r), 0);
    if (r) R.onRoad.push({ o, r });
  }
  const B = objs.filter((o) => o.tag !== 'tree');
  const g = grid(B, 64);
  for (const [key, a] of g) for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
    const A = B[a[i]], C = B[a[j]], rA = Math.hypot(A.hw, A.hh), rC = Math.hypot(C.hw, C.hh);
    // пара проверяется один раз: в клетке, где лежит угол пересечения их описанных квадратов
    if (Math.floor(Math.max(A.x - rA, C.x - rC) / 64) * 100000 + Math.floor(Math.max(A.y - rA, C.y - rC) / 64) !== key) continue;
    if ((A.p.lvl !== undefined || A.p.H0 || C.p.lvl !== undefined || C.p.H0) && sameOwner(A, C)) continue; // ступенчатые башни и храмы — составные здания
    if (A.p.k === 'cyl' && C.p.k === 'b' && sameOwner(A, C) || C.p.k === 'cyl' && A.p.k === 'b' && sameOwner(A, C)) { if (overlap2(A, C, 0.3)) R.overlapSame.push({ a: A, b: C }); continue; }
    if (!overlap2(A, C, 0.3)) continue;
    (sameOwner(A, C) ? R.overlapSame : R.overlap).push({ a: A, b: C });
  }
  // кроны деревьев не накрывают крыши (деревья рисуются поверх зданий)
  R.crown = [];
  if (opts.trees) for (const o of objs) {
    if (o.tag !== 'tree') continue;
    const c = { x: o.x, y: o.y, hw: o.p.d * 0.45, hh: o.p.d * 0.45, ca: 1, sa: 0, circ: true };
    const k = Math.floor(o.x / 64) * 100000 + Math.floor(o.y / 64);
    for (const i of g.get(k) || []) if (overlap2(c, B[i], 0.6)) { R.crown.push({ o, b: B[i] }); break; }
  }
  for (const f of W.farms) for (const t of f.t) {
    const o = { x: t.x, y: t.y, hw: 6, hh: 6, ca: 1, sa: 0 };
    const r = roadOn(W, o, () => true, 0); if (r) { R.turbine.push({ t, r }); continue; }
    if (g.size) { const k = Math.floor(t.x / 64) * 100000 + Math.floor(t.y / 64); for (const i of g.get(k) || []) if (overlap2(Object.assign({ circ: true }, o), B[i], 0)) { R.turbine.push({ t, b: B[i] }); break; } }
  }
  if (opts.roads) R.parallel = parallelRoads(W);
  return R;
}

export function where(o) { return `${Math.round(o.x)},${Math.round(o.y)}`; }
export function label(o) {
  if (o.blk) return `${o.blk.city.name} квартал ${o.blk.bi},${o.blk.bj} тип ${o.blk.t}`;
  if (o.vil) return `село ${o.vil.name}`;
  if (o.zone) return `зона ${o.zone.zk}#${o.zone.id}`;
  return o.tag;
}

// концы дорог, которые ни к чему не примыкают (кроме законных тупиков: улицы сёл, начало подъезда внутри зоны,
// вокзальные концы железных дорог, замкнутые кольца)
export function deadEnds(W) {
  const RW = W._dbg.RW, out = [];
  const acc = new Set(W.zones.map((z) => z.acc).filter(Boolean)), vst = new Set();
  for (const c of W.cities) if (c.vst) for (const s of c.vst) vst.add(s.r);
  const near = (x, y, self) => {
    for (const r of W.queryRoads(x - 60, y - 60, x + 60, y + 60)) {
      if (r === self || r.k === 8) continue;
      for (let i = 0; i < r.n - 1; i++) {
        const ax = r.pts[i * 2], ay = r.pts[i * 2 + 1], dx = r.pts[i * 2 + 2] - ax, dy = r.pts[i * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        if (Math.hypot(ax + dx * t - x, ay + dy * t - y) < (RW[r.k] + RW[self.k]) / 2 + 2) return true;
      }
    }
    return false;
  };
  for (const r of W.roads) {
    if (r.k === 8 || r.k === 5 || vst.has(r) || r.stub) continue; // stub: отведена от магистрали и кончается у её обочины
    if (Math.hypot(r.pts[0] - r.pts[r.n * 2 - 2], r.pts[1] - r.pts[r.n * 2 - 1]) < 1) continue;
    for (const e of [0, r.n - 1]) {
      const x = r.pts[e * 2], y = r.pts[e * 2 + 1];
      if (acc.has(r) && e === 0) continue;
      if (r.k === 4 && W.cities.some((c) => c.type === 0 && Math.hypot(c.x - x, c.y - y) < 5)) continue;
      if (!near(x, y, r)) out.push({ r, x, y });
    }
  }
  return out;
}

// плоские объекты (парковки, грядки, площадки, теплицы, корты) под зданиями и друг на друге
export function groundClash(W) {
  const { genBlock, genVillage } = W._dbg, out = [];
  const K = new Set(['pk', 'play', 'pool', 'court', 'field', 'track', 'gh', 'helipad', 'rows', 'wood']);
  const rect = (p) => p.k === 'helipad' ? { x: p.x - p.r, y: p.y - p.r, w: 2 * p.r, h: 2 * p.r } : p;
  const ov = (a, b) => a.x < b.x + b.w - 0.3 && b.x < a.x + a.w - 0.3 && a.y < b.y + b.h - 0.3 && b.y < a.y + a.h - 0.3;
  const chk = (P, tag) => {
    const Bs = P.filter((p) => p.k === 'b' && !p.a), G = P.filter((p) => K.has(p.k));
    for (const g of G) for (const b of Bs) if (ov(rect(g), b)) { out.push(`${tag}: ${g.k} под зданием`); break; }
    for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
      const a = G[i], b = G[j]; if (a.k === 'rows' || b.k === 'rows') continue;
      if (ov(rect(a), rect(b))) out.push(`${tag}: ${a.k} на ${b.k}`);
    }
  };
  for (const c of W.cities) {
    if (c.type >= 1) { const BD = c.D - 1; for (let bj = 0; bj < BD; bj++) for (let bi = 0; bi < BD; bi++) { const t = c.blocks[bj * BD + bi]; if (t) chk(genBlock(c, bi, bj, t), `${c.name} тип ${t}`); } }
    else c.vst.forEach((s, i) => chk(genVillage(c, i), `село ${c.name}`));
  }
  for (const z of W.zones) if (z.prims) chk(z.prims, `зона ${z.zk}`);
  return out;
}

// постройки, стоящие в воде (река или море под углом или серединой здания)
export function inWater(W) {
  const out = [];
  for (const o of collect(W)) {
    for (const [a, b] of [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = o.x + (a * o.hw * o.ca - b * o.hh * o.sa) * 0.9, y = o.y + (a * o.hw * o.sa + b * o.hh * o.ca) * 0.9;
      if (W.landE(x, y, 0) < 0) { out.push(o); break; }
    }
  }
  return out;
}

// дороги над водой без моста (мосты рисуются по r.br) и пересечения в одном уровне, которых быть не должно:
// железная дорога с магистралью, трассой или проспектом, магистраль с трассой
export function roadWater(W) {
  const out = [];
  for (const r of W.roads) {
    if (r.k === 8) continue;
    for (let s = 0; s <= r.L; s += 10) { // те же точки, что и у bridgesOf: пятна воды мельче шага не видны под дорогой
      const p = W.posAt(r, s);
      if (W.landE(p[0], p[1], 0) >= 0) continue;
      if (!(r.br || []).some((b) => s >= b[0] - 1 && s <= b[1] + 1)) { out.push({ r, x: p[0], y: p[1] }); break; }
    }
  }
  return out;
}
export function levelCrossings(W) {
  const out = [], onOv = (r, s) => (r.ov || []).some((o) => s > o[0] - 1 && s < o[1] + 1);
  const bad = (a, b) => (a.k === 5 && (b.k === 0 || b.k === 1 || b.k === 2 || b.k === 7)) || (a.k === 0 && b.k === 1);
  for (const a of W.roads) {
    if (a.k !== 5 && a.k !== 0) continue;
    for (const b of W.queryRoads(a.bb[0], a.bb[1], a.bb[2], a.bb[3])) {
      if (b === a || !bad(a, b)) continue;
      for (let i = 0; i < a.n - 1; i++) for (let j = 0; j < b.n - 1; j++) {
        const ax = a.pts[i * 2], ay = a.pts[i * 2 + 1], ex = a.pts[i * 2 + 2] - ax, ey = a.pts[i * 2 + 3] - ay;
        const cx = b.pts[j * 2], cy = b.pts[j * 2 + 1], fx = b.pts[j * 2 + 2] - cx, fy = b.pts[j * 2 + 3] - cy, den = ex * fy - ey * fx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((cx - ax) * fy - (cy - ay) * fx) / den, u = ((cx - ax) * ey - (cy - ay) * ex) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const sa = a.cum[i] + t * Math.hypot(ex, ey), sb = b.cum[j] + u * Math.hypot(fx, fy);
        if (sa < 25 || sa > a.L - 25 || sb < 25 || sb > b.L - 25) continue; // примыкание концом
        if (!onOv(a, sa) && !onOv(b, sb)) out.push({ a, b, x: ax + ex * t, y: ay + ey * t });
      }
    }
  }
  return out;
}

// каждый конец железной дороги — на вокзале (или на другой линии), без путей, уходящих в поле
export function railEnds(W) {
  const out = [];
  for (const r of W.roads) {
    if (r.k !== 5) continue;
    for (const e of [0, 1]) {
      const x = e ? r.pts[r.n * 2 - 2] : r.pts[0], y = e ? r.pts[r.n * 2 - 1] : r.pts[1];
      const st = W.zones.some((z) => z.zk === 'stn' && Math.hypot(z.x - x, z.y - y) < 270);
      const other = W.queryRoads(x - 10, y - 10, x + 10, y + 10).some((o) => o !== r && o.k === 5);
      if (!st && !other) out.push({ r, x, y });
    }
  }
  return out;
}

// изломы: у загородных дорог (и проспектов-продолжений) нет поворота круче 60° на одной вершине
export function sharpBends(W, maxDeg = 60) {
  const out = [], c = Math.cos(maxDeg * Math.PI / 180);
  for (const r of W.roads) {
    if (r.city !== undefined || r.k === 8 || r.k === 6 || r.k === 5 || r.ring) continue;
    for (let i = 1; i < r.n - 1; i++) {
      const ax = r.pts[i * 2] - r.pts[i * 2 - 2], ay = r.pts[i * 2 + 1] - r.pts[i * 2 - 1], bx = r.pts[i * 2 + 2] - r.pts[i * 2], by = r.pts[i * 2 + 3] - r.pts[i * 2 + 1];
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by); if (la < 0.5 || lb < 0.5) continue;
      if ((ax * bx + ay * by) / (la * lb) < c) { out.push({ r, x: r.pts[i * 2], y: r.pts[i * 2 + 1] }); break; }
    }
  }
  return out;
}

// второстепенная дорога не примыкает к магистрали в одном уровне
export function minorOnHighway(W) {
  const RW = W._dbg.RW, out = [];
  for (const r of W.roads) {
    if (r.city !== undefined || ![3, 4].includes(r.k)) continue; // трасса (k=1) может вливаться в магистраль по касательной
    for (const e of [0, 1]) {
      const x = e ? r.pts[r.n * 2 - 2] : r.pts[0], y = e ? r.pts[r.n * 2 - 1] : r.pts[1];
      for (const o of W.queryRoads(x - 20, y - 20, x + 20, y + 20)) {
        if (o.k !== 0 || o.ring) continue;
        let d = 1e9; for (let i = 0; i < o.n - 1; i++) { const ax = o.pts[i * 2], ay = o.pts[i * 2 + 1], dx = o.pts[i * 2 + 2] - ax, dy = o.pts[i * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); d = Math.min(d, Math.hypot(ax + dx * t - x, ay + dy * t - y)); }
        if (d < RW[0] / 2 + RW[r.k] / 2) { out.push({ r, x, y }); break; }
      }
    }
  }
  return out;
}

// крюки: поворот больше 75° на участке 80 м (у загородных дорог и проспектов-продолжений)
export function hooks(W, deg = 75, win = 80) {
  const out = [], lim = deg * Math.PI / 180;
  for (const r of W.roads) {
    if (r.city !== undefined || r.k === 8 || r.k === 6 || r.k === 5 || r.ring || r.L < win) continue;
    for (let s = 0; s + win <= r.L; s += 10) {
      const a = W.posAt(r, s), b = W.posAt(r, s + win);
      let d = Math.abs(Math.atan2(a[2] * b[3] - a[3] * b[2], a[2] * b[2] + a[3] * b[3]));
      if (d > lim) { const m = W.posAt(r, s + win / 2); out.push({ r, x: m[0], y: m[1] }); break; }
    }
  }
  return out;
}

// съезды развязок (k=6) не пересекают другие дороги (кроме двух, которые соединяют, и других съездов той же развязки)
export function rampCrossings(W) {
  const out = [], RW = W._dbg.RW;
  for (const r of W.roads) {
    if (r.k !== 6) continue;
    const ends = [[r.pts[0], r.pts[1]], [r.pts[r.n * 2 - 2], r.pts[r.n * 2 - 1]]];
    for (const o of W.queryRoads(r.bb[0], r.bb[1], r.bb[2], r.bb[3])) {
      if (o === r || o.k === 6 || o.k === 8) continue;
      // дороги, к которым съезд примыкает концом, — его собственные
      let own = false;
      for (const [x, y] of ends) for (let i = 0; i < o.n - 1 && !own; i++) { const ax = o.pts[i * 2], ay = o.pts[i * 2 + 1], dx = o.pts[i * 2 + 2] - ax, dy = o.pts[i * 2 + 3] - ay, l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); if (Math.hypot(ax + dx * t - x, ay + dy * t - y) < RW[o.k] / 2 + 4) own = true; }
      if (own) continue;
      let hit = null;
      for (let i = 0; i < r.n - 1 && !hit; i++) for (let j = 0; j < o.n - 1; j++) {
        const ax = r.pts[i * 2], ay = r.pts[i * 2 + 1], ex = r.pts[i * 2 + 2] - ax, ey = r.pts[i * 2 + 3] - ay, cx = o.pts[j * 2], cy = o.pts[j * 2 + 1], fx = o.pts[j * 2 + 2] - cx, fy = o.pts[j * 2 + 3] - cy, den = ex * fy - ey * fx;
        if (Math.abs(den) < 1e-9) continue; const t = ((cx - ax) * fy - (cy - ay) * fx) / den, u = ((cx - ax) * ey - (cy - ay) * ex) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) { hit = [ax + ex * t, ay + ey * t]; break; }
      }
      if (hit) out.push({ r, o, x: hit[0], y: hit[1] });
    }
  }
  return out;
}

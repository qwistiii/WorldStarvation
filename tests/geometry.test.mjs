// Геометрия мира: постройки не должны стоять на дорогах (тесты без браузера).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'src/gen.js'), 'utf8'), ctx);
const W = ctx.WorldGen(20261107);
const { genVillage, genBlock, RW } = W._dbg;

// пересечение отрезка с прямоугольником (центр, угол, полуразмеры + запас)
function segHitsRect(ax, ay, bx, by, cx, cy, ca, sa, hx, hy) {
  const tx = (x, y) => [(x - cx) * ca + (y - cy) * sa, -(x - cx) * sa + (y - cy) * ca];
  const [x0, y0] = tx(ax, ay), [x1, y1] = tx(bx, by);
  let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 + hx], [dx, hx - x0], [-dy, y0 + hy], [dy, hy - y0]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
function hits(cx, cy, ang, w, h, keep) {
  const ca = Math.cos(ang), sa = Math.sin(ang), rad = Math.hypot(w, h) / 2 + 20;
  for (const r of W.queryRoads(cx - rad, cy - rad, cx + rad, cy + rad)) {
    if (!keep(r)) continue;
    const m = RW[r.k] / 2;
    for (let i = 0; i < r.n - 1; i++)
      if (segHitsRect(r.pts[i * 2], r.pts[i * 2 + 1], r.pts[i * 2 + 2], r.pts[i * 2 + 3], cx, cy, ca, sa, w / 2 + m, h / 2 + m)) return r;
  }
  return null;
}
const through = (r) => r.city === undefined && r.k !== 8;

test('дома в сёлах не стоят на чужих дорогах и железных дорогах', () => {
  let n = 0, bad = [];
  for (const c of W.cities.filter((c) => c.type === 0).slice(0, 150)) {
    c.vst.forEach((st, si) => {
      for (const p of genVillage(c, si)) {
        if (p.k !== 'b') continue; n++;
        const lx = p.x + p.w / 2, ly = p.y + p.h / 2;
        const x = st.x0 + lx * st.ca - ly * st.sa, y = st.y0 + lx * st.sa + ly * st.ca;
        const r = hits(x, y, Math.atan2(st.sa, st.ca) + (p.a || 0), p.w, p.h, (r) => r !== st.r && r.k !== 8 && !c.vst.some((q) => q.r === r && q !== st && false));
        if (r && r.k !== 4) bad.push(`${c.name}: дом на дороге k=${r.k}`);
      }
    });
  }
  assert.ok(n > 1000, 'проверено мало домов');
  assert.deepEqual(bad.slice(0, 10), []);
});

test('здания в городах не стоят на магистралях, трассах и железных дорогах', () => {
  let n = 0; const bad = [];
  for (const c of W.cities.filter((c) => c.type >= 1)) {
    const BD = c.D - 1;
    for (let bj = 0; bj < BD; bj++) for (let bi = 0; bi < BD; bi++) {
      const t = c.blocks[bj * BD + bi]; if (!t) continue;
      const u = (c.us[bi] + c.us[bi + 1]) / 2, v = (c.vs[bj] + c.vs[bj + 1]) / 2;
      const wx = c.x + u * c.ca - v * c.sa, wy = c.y + u * c.sa + v * c.ca;
      for (const p of genBlock(c, bi, bj, t)) {
        if (p.k !== 'b') continue; n++;
        const lx = p.x + p.w / 2, ly = p.y + p.h / 2;
        const x = wx + lx * c.ca - ly * c.sa, y = wy + lx * c.sa + ly * c.ca;
        const r = hits(x, y, c.ang + (p.a || 0), p.w, p.h, (r) => through(r) && (r.k === 0 || r.k === 1 || r.k === 5 || r.k === 6));
        if (r) bad.push(`${c.name}: здание на дороге k=${r.k}`);
      }
    }
  }
  assert.ok(n > 10000, 'проверено мало зданий');
  assert.deepEqual(bad.slice(0, 10), []);
});

test('съезды развязок у кольцевых не заходят в кварталы', () => {
  const bad = [];
  for (const r of W.roads) {
    if (r.k !== 6) continue;
    for (let i = 0; i < r.n; i += 3) {
      const x = r.pts[i * 2], y = r.pts[i * 2 + 1];
      for (const c of W.cities) {
        if (c.type < 1 || x < c.bb[0] || x > c.bb[2] || y < c.bb[1] || y > c.bb[3]) continue;
        const dx = x - c.x, dy = y - c.y, uu = dx * c.ca + dy * c.sa, vv = -dx * c.sa + dy * c.ca;
        const BD = c.D - 1; let bi = -1, bj = -1;
        for (let q = 0; q < BD; q++) { if (uu >= c.us[q] && uu < c.us[q + 1]) bi = q; if (vv >= c.vs[q] && vv < c.vs[q + 1]) bj = q; }
        if (bi >= 0 && bj >= 0 && c.blocks[bj * BD + bi]) { bad.push(`${c.name}: съезд в квартале`); break; }
      }
    }
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

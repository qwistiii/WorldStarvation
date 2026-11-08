// Геометрия мира (без браузера): ничего ни на что не налезает. Проверяются два разных мира целиком.
// Подробная сводка с координатами мест: node tools/audit.mjs <seed>.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, audit, deadEnds, groundClash, parallelRoads, inWater, roadWater, levelCrossings, railEnds, sharpBends, minorOnHighway, hooks, where, label } from './audit.mjs';

for (const seed of [20261107, 1337]) {
  const W = world(seed);
  const A = audit(W, { trees: true });
  const list = (xs, f) => xs.slice(0, 8).map(f);

  test(`${seed}: здания, резервуары и дома не стоят на дорогах`, () => {
    assert.ok(A.n > 500000, 'проверено мало объектов');
    assert.deepEqual(list(A.onRoad, (it) => `${label(it.o)} на дороге k=${it.r.k} @${where(it.o)}`), []);
  });
  test(`${seed}: деревья не растут на проезжей части и не закрывают крыши`, () => {
    assert.deepEqual(list(A.treeOnRoad, (it) => `${label(it.o)} k=${it.r.k} @${where(it.o)}`), []);
    assert.deepEqual(list(A.crown, (it) => `${label(it.o)} @${where(it.o)}`), []);
  });
  test(`${seed}: постройки не налезают друг на друга`, () => {
    assert.deepEqual(list(A.overlap, (it) => `${label(it.a)} | ${label(it.b)} @${where(it.a)}`), []);
    assert.deepEqual(list(A.overlapSame, (it) => `${label(it.a)} @${where(it.a)}`), []);
    assert.deepEqual(list(A.turbine, (it) => `ветряк @${Math.round(it.t.x)},${Math.round(it.t.y)}`), []);
  });
  test(`${seed}: постройки не стоят в реках и в море`, () => {
    assert.deepEqual(list(inWater(W), (o) => `${label(o)} @${where(o)}`), []);
  });
  test(`${seed}: парковки, грядки и площадки не уходят под здания`, () => {
    assert.deepEqual(groundClash(W).slice(0, 8), []);
  });
  test(`${seed}: у дорог нет висячих концов`, () => {
    assert.deepEqual(list(deadEnds(W), (d) => `k=${d.r.k} конец @${Math.round(d.x)},${Math.round(d.y)}`), []);
  });
  test(`${seed}: над водой у дорог и рельсов есть мосты`, () => {
    assert.deepEqual(list(roadWater(W), (it) => `k=${it.r.k} над водой без моста @${Math.round(it.x)},${Math.round(it.y)}`), []);
  });
  test(`${seed}: железные дороги и магистрали пересекают дороги только на путепроводах`, () => {
    assert.deepEqual(list(levelCrossings(W), (it) => `k=${it.a.k} × k=${it.b.k} в одном уровне @${Math.round(it.x)},${Math.round(it.y)}`), []);
  });
  test(`${seed}: железные дороги кончаются на вокзалах`, () => {
    assert.deepEqual(list(railEnds(W), (it) => `рельсы уходят в поле @${Math.round(it.x)},${Math.round(it.y)}`), []);
  });
  test(`${seed}: у дорог нет изломов, второстепенные не примыкают к магистралям`, () => {
    assert.deepEqual(list(sharpBends(W), (it) => `k=${it.r.k} излом @${Math.round(it.x)},${Math.round(it.y)}`), []);
    assert.deepEqual(list(hooks(W), (it) => `k=${it.r.k} крюк @${Math.round(it.x)},${Math.round(it.y)}`), []);
    assert.deepEqual(list(minorOnHighway(W), (it) => `k=${it.r.k} упирается в магистраль @${Math.round(it.x)},${Math.round(it.y)}`), []);
  });
  test(`${seed}: загородные дороги не идут поверх других дорог`, () => {
    const bad = parallelRoads(W).filter((it) => it.a.city === undefined && it.b.city === undefined);
    assert.deepEqual(list(bad, (it) => `k=${it.a.k} вдоль k=${it.b.k} @${Math.round(it.x)},${Math.round(it.y)}`), []);
  });
  test(`${seed}: съезды развязок у кольцевых не заходят в кварталы`, () => {
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
          if (bi >= 0 && bj >= 0 && c.blocks[bj * BD + bi] && c.blocks[bj * BD + bi] !== 20) { bad.push(`${c.name}: съезд в квартале`); break; }
        }
      }
    }
    assert.deepEqual(bad.slice(0, 10), []);
  });
}

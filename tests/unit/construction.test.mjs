// Stage 6.2: a building of the game stands in the world at once as a construction site (gen.js addZone {con}, zoneCon) and
// the cities of the game world have no ring roads and no polar (ring-and-ray) layouts.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL('../../src/gen.js', import.meta.url), 'utf8'), ctx);
const W = ctx.WorldGen(1337, { empty: true });

// a dry flat spot away from the edge for a village and a power plant next to it
function spot() {
  for (let y = 20000; y < W.WORLD - 20000; y += 1500) for (let x = 20000; x < W.WORLD - 20000; x += 1500) {
    let ok = true; for (let a = 0; a < 8 && ok; a++) for (const r of [0, 900, 1800]) if (W.landE(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.004) < 0.03) { ok = false; break; }
    if (ok) return [x, y];
  }
  return null;
}
const [X, Y] = spot();
const vid = W.addPlace({ k: 'village', x: X, y: Y, st: 0, name: 'Тест' });

test('стройка: здание сразу стоит в мире участком (этап 1), есть кран', () => {
  const id = W.addZone({ zk: 'pow', x: X + 1400, y: Y, city: vid, st: 0, W: 760, H: 560, con: 1 });
  assert.ok(id >= 0, 'зона добавлена');
  const z = W.zones[id];
  assert.equal(z.con, 1);
  assert.ok(Array.isArray(z.crane) && z.crane.length === 5 && z.crane[2] >= 28 && z.crane[2] <= 120, 'кран: место, стрела, угол, высота');
  assert.ok(z.prims.some((p) => p.k === 'b'), 'настоящие корпуса уже известны (по ним встают фундаменты)');
  W.zoneCon([id, 3]); assert.equal(z.con, 3, 'этап 3: стены выше');
  W.zoneCon([id, 0]); assert.equal(z.con, 0, 'готово: настоящее здание');
  assert.ok(z.prims.some((p) => p.k === 'b'), 'корпуса на месте');
});

test('стройку можно снести: зона исчезает', () => {
  const id = W.addZone({ zk: 'saw', x: X - 1400, y: Y, city: vid, st: 0, W: 360, H: 260, con: 1 });
  assert.ok(id >= 0); W.removeZone(id); assert.ok(W.zones[id].dead);
});

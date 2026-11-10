// The ground around game buildings (gen.js padAt / padField): the apron where fields end and the soil is worn.
// Continuity (no seams: the value never jumps), rotation, rounded corners, neighbours merging into one apron.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(new URL('../../src/gen.js', import.meta.url), 'utf8'), ctx);
const W = ctx.WorldGen(1337, { empty: true });
const Z = (o) => Object.assign({ kind: 'zone', dyn: 1, id: 7, zk: 'ind', x: 50000, y: 50000, W: 640, H: 420, ca: 1, sa: 0 }, o);
const rot = (a) => ({ ca: Math.cos(a), sa: Math.sin(a) });
test('на площадке 1, за обочиной 0', () => {
  const z = Z(); assert.equal(W.padAt(z, 50000, 50000), 1); assert.equal(W.padAt(z, 50000 + 319, 50000), 1);
  assert.equal(W.padAt(z, 50000 + 320 + 60, 50000), 0); assert.equal(W.padAt(z, 50000, 50000 + 210 + 60), 0);
});
test('значение непрерывно: нет скачков на краю площадки и обочины (без швов)', () => {
  for (const [a, z] of [[0, Z()], [0.52, Z(rot(0.52))], [2.1, Z(Object.assign(rot(2.1), { zk: 'sam', W: 150, H: 150 }))]]) {
    for (let k = 0; k < 24; k++) { const t = k / 24 * Math.PI * 2; let prev = W.padAt(z, z.x, z.y), maxd = 0;
      for (let r = 0; r < 420; r += 0.25) { const v = W.padAt(z, z.x + Math.cos(t) * r, z.y + Math.sin(t) * r); maxd = Math.max(maxd, Math.abs(v - prev)); prev = v; }
      assert.ok(maxd < 0.04, `угол ${a}, луч ${k}: скачок ${maxd.toFixed(3)}`); }
  }
});
test('поворот: внутри повёрнутой площадки 1, снаружи за обочиной 0', () => {
  const a = 0.7, z = Z(rot(a)); const P = (u, v) => [z.x + u * Math.cos(a) - v * Math.sin(a), z.y + u * Math.sin(a) + v * Math.cos(a)];
  assert.equal(W.padAt(z, ...P(300, 200)), 1); assert.equal(W.padAt(z, ...P(-300, -200)), 1);
  assert.equal(W.padAt(z, ...P(320 + 70, 0)), 0); assert.ok(W.padAt(z, ...P(300 + 20, 200 + 20)) < 1);
  // the same point is inside for the turned zone and outside for the unturned one
  const p = P(310, 205); assert.equal(W.padAt(z, ...p), 1); assert.ok(W.padAt(Z(), ...p) < 1);
});
test('углы скруглены: по диагонали угла значение падает плавно, без «шипа»', () => {
  const z = Z(); let prev = 1;
  for (let s = 0; s < 60; s += 0.5) { const v = W.padAt(z, z.x + 320 + s * 0.7071, z.y + 210 + s * 0.7071); assert.ok(v <= prev + 1e-9, 'монотонно'); prev = v; }
  assert.ok(W.padAt(z, z.x + 320 + 4, z.y + 210 + 4) < 1, 'точка у самого угла уже на обочине');
});
test('соседи сливаются в одну обочину: значение — максимум, не сумма; в зазоре не проваливается', () => {
  const a = Z({ id: 1 }), b = Z({ id: 2, x: 50000 + 640 + 14 });
  for (let x = 50000; x < 50000 + 654; x += 3) { const [f] = W.padField([a, b], x, 50000), fa = W.padAt(a, x, 50000), fb = W.padAt(b, x, 50000);
    assert.ok(Math.abs(f - Math.max(fa, fb)) < 1e-12 && f <= 1); }
  const mid = W.padField([a, b], 50000 + 320 + 7, 50000)[0]; assert.ok(mid > 0.6, 'зазор 14 м между соседями — обочина, не поле: ' + mid.toFixed(2));
});
test('вытоптанность зависит от типа: у ПВО и панелей — трава, у завода — утоптанная земля', () => {
  const p = [50000 + 320 + 2, 50000]; const ind = W.padField([Z()], ...p)[1], sam = W.padField([Z({ zk: 'sam' })], ...p)[1];
  assert.ok(ind > sam * 2, `${ind} vs ${sam}`);
});
test('постройки мира (не игры) не меняются: обочина только у построек игрока и ботов', () => {
  assert.deepEqual([...W.padField([Z({ dyn: 0 })], 50000, 50000)], [0, 0]);
});

// Проверка генератора в Node (без браузера и canvas): мир детерминирован по seed.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'src/gen.js'), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src, ctx);
const WorldGen = ctx.WorldGen;

test('seed 1337 совпадает с эталоном этапа 4', () => {
  const W = WorldGen(1337);
  assert.equal(W.cities.length, 433, 'число населённых пунктов');
  assert.equal(W.roads.length, 6319, 'число дорог (этап 4.4: без дублей дорог)');
  assert.equal(W.WORLD, 131072);
});

test('генерация детерминирована', () => {
  const a = WorldGen(20261107), b = WorldGen(20261107);
  assert.equal(a.cities.length, b.cities.length);
  assert.equal(a.roads.length, b.roads.length);
  assert.equal(a.zones.length, b.zones.length);
  assert.deepEqual(a.cities.slice(0, 20).map((c) => [c.name, c.x, c.y]), b.cities.slice(0, 20).map((c) => [c.name, c.x, c.y]));
});

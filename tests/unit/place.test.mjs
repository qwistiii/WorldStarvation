// Placement of buildings (src/place.js): select, ghost, rotation, confirm and cancel with the mouse and on touch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const Placement = load('place.js', 'Placement');
function mk(bad) {
  const built = [];
  const pl = Placement({ check: (k, x, y, a) => (bad && bad(k, x, y, a)) || null, build: (k, x, y, a) => { built.push([k, x, y, a]); return true }, rotates: (k) => k !== 'city' });
  return { pl, built };
}
test('ключ взводит постройку, повторное нажатие отменяет', () => {
  const { pl } = mk(); assert.ok(pl.select('farm')); assert.equal(pl.state.k, 'farm'); assert.equal(pl.select('farm'), false); assert.equal(pl.state.k, null);
});
test('мышь: призрак следует за курсором, клик строит и выходит из режима', () => {
  const { pl, built } = mk(); pl.select('farm'); pl.hover(100, 200); assert.ok(pl.state.has); assert.equal(pl.tap(110, 210, false), 'built');
  assert.deepEqual(built, [['farm', 110, 210, 0]]); assert.equal(pl.state.k, null);
});
test('мышь: Shift+клик оставляет режим для следующей постройки', () => {
  const { pl, built } = mk(); pl.select('solar'); assert.equal(pl.tap(1, 1, false, true), 'built'); assert.equal(pl.tap(50, 1, false, true), 'built');
  assert.equal(built.length, 2); assert.equal(pl.state.k, 'solar');
});
test('плохое место: не строит, причина в состоянии', () => {
  const { pl, built } = mk((k, x) => x < 0 ? 'Здесь вода' : null); pl.select('farm'); assert.equal(pl.tap(-5, 0, false), 'bad');
  assert.equal(pl.state.bad, 'Здесь вода'); assert.equal(built.length, 0); assert.equal(pl.state.k, 'farm');
});
test('тач: призрак сразу в центре экрана, тап двигает, ✓ строит', () => {
  const { pl, built } = mk(); pl.select('factory', true, 500, 500); assert.ok(pl.state.has && pl.state.touch);
  assert.equal(pl.tap(700, 650, true), 'moved'); assert.equal(built.length, 0); assert.deepEqual([pl.state.x, pl.state.y], [700, 650]);
  assert.equal(pl.confirm(), 'built'); assert.deepEqual(built[0].slice(0, 3), ['factory', 700, 650]); assert.equal(pl.state.k, null);
});
test('тач: призрак перетаскивается пальцем, промах мимо него двигает карту', () => {
  const { pl } = mk(); pl.select('power', true, 0, 0); assert.equal(pl.grab(900, 0, 400), false); assert.ok(pl.grab(100, 50, 400));
  pl.move(300, 300); pl.release(); assert.deepEqual([pl.state.x, pl.state.y], [200, 250], 'the ghost keeps the offset of the finger'); assert.equal(pl.state.drag, false);
});
test('поворот: шаг 15°, Shift — 90°, полный круг возвращает 0; город не поворачивается', () => {
  const { pl, built } = mk(); pl.select('factory'); for (let i = 0; i < 6; i++) pl.rotate(1); assert.ok(Math.abs(pl.state.ang - Math.PI / 2) < 1e-9);
  pl.rotate(1, true); pl.rotate(1, true); pl.rotate(1, true); assert.ok(Math.abs(pl.state.ang) < 1e-9 || Math.abs(pl.state.ang - 2 * Math.PI) < 1e-9);
  pl.rotate(-1); assert.ok(Math.abs(pl.state.ang - (2 * Math.PI - Math.PI / 12)) < 1e-9); pl.tap(0, 0, false); assert.ok(Math.abs(built[0][3] - (2 * Math.PI - Math.PI / 12)) < 1e-9);
  pl.select('city'); assert.equal(pl.rotate(1), false); assert.equal(pl.state.ang, 0);
});
test('проверка места учитывает угол (повёрнутая постройка не влезает)', () => {
  const { pl } = mk((k, x, y, a) => a > 0.1 ? 'Не помещается' : null); pl.select('airport'); pl.hover(0, 0); assert.equal(pl.state.bad, null);
  pl.rotate(1, true); assert.equal(pl.state.bad, 'Не помещается');
});
test('отмена: Esc / ПКМ / ✕ сбрасывают всё', () => {
  const { pl } = mk(); pl.select('farm', true, 1, 1); pl.grab(1, 1, 10); assert.ok(pl.cancel()); assert.equal(pl.state.k, null); assert.equal(pl.state.drag, false); assert.equal(pl.cancel(), false);
});
test('углы пятна постройки поворачиваются вокруг центра', () => {
  const { pl } = mk(); pl.select('farm'); pl.hover(10, 20); pl.rotate(1, true);
  const c = pl.corners(4, 2).map((p) => p.map((v) => Math.round(v * 1e6) / 1e6)); assert.deepEqual(c, [[11, 18], [11, 22], [9, 22], [9, 18]]);
});
test('отказ стройки (нет денег) не выходит из режима и показывает причину', () => {
  const pl = Placement({ check: () => null, build: () => 'Не хватает денег', rotates: () => true }); pl.select('farm'); assert.equal(pl.tap(0, 0, false), 'bad'); assert.equal(pl.state.bad, 'Не хватает денег'); assert.equal(pl.state.k, 'farm');
});

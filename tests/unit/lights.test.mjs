// Light sources (src/lights.js): modes, time of day, fade, culling by the screen, the cap, owners.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const LightSystem = load('lights.js', 'LightSystem');
const VIEW = [0, 0, 1000, 1000];
test('фонарь: позиция, высота и радиус по виду, режим «авто» по умолчанию', () => {
  const S = LightSystem(); const id = S.add({ x: 10, y: 20 }); const l = S.get(id);
  assert.deepEqual([l.x, l.y, l.h, l.r, l.mode], [10, 20, 8, 34, 'auto']); const f = S.get(S.add({ x: 0, y: 0, kind: 'flood' })); assert.ok(f.h > l.h && f.r > l.r);
});
test('авто: днём не горит, ночью горит; включается плавно', () => {
  const S = LightSystem(), l = S.get(S.add({ x: 500, y: 500 }));
  S.update(5, 0); assert.equal(l.lv, 0); S.update(0.1, 1); assert.ok(l.lv > 0 && l.lv < 1, 'разгорается'); S.update(5, 1); assert.equal(l.lv, 1);
  S.update(0.1, 0); assert.ok(l.lv < 1 && l.lv > 0, 'гаснет плавно'); S.update(5, 0); assert.equal(l.lv, 0);
});
test('фонари улицы включаются не все сразу (у каждого свой порог в сумерках)', () => {
  const S = LightSystem(); for (let i = 0; i < 200; i++) S.add({ x: i, y: 0 }); S.update(10, 0.4);
  const on = S.all().filter((l) => l.lv > 0).length; assert.ok(on > 20 && on < 180, String(on)); S.update(10, 0.9); assert.equal(S.all().filter((l) => l.lv === 1).length, 200);
});
test('ручные режимы: «вкл» горит и днём, «выкл» не горит и ночью', () => {
  const S = LightSystem(), a = S.add({ x: 1, y: 1 }), b = S.add({ x: 2, y: 2 }); S.setMode(a, 'on'); S.setMode(b, 'off');
  S.update(5, 0); assert.equal(S.get(a).lv, 1); S.update(5, 1); assert.equal(S.get(b).lv, 0); assert.equal(S.setMode(a, 'bogus'), false);
});
test('отсечение по экрану: за краем не рисуется, у края — с учётом радиуса пятна', () => {
  const S = LightSystem(); S.add({ x: 500, y: 500, mode: 'on' }); S.add({ x: 1020, y: 500, mode: 'on' }); S.add({ x: 1300, y: 500, mode: 'on' }); S.update(5, 0);
  const v = S.visible(VIEW).map((l) => l.x); assert.deepEqual(v.sort((a, b) => a - b), [500, 1020]);
});
test('лимит одновременных источников: остаются самые сильные и ближние к центру', () => {
  const S = LightSystem({ cap: 50 }); for (let i = 0; i < 500; i++) S.add({ x: (i * 37) % 1000, y: (i * 91) % 1000, mode: 'on' }); S.add({ x: 500, y: 500, kind: 'flood', mode: 'on', i: 3 }); S.update(5, 0);
  const v = S.visible(VIEW); assert.equal(v.length, 50); assert.ok(v.some((l) => l.kind === 'flood'), 'сильный прожектор в центре не отсечён');
  const far = Math.max(...v.map((l) => Math.hypot(l.x - 500, l.y - 500))); assert.ok(far < 520);
});
test('скрытые (туман войны) и погашенные не попадают в кадр', () => {
  const S = LightSystem(); S.add({ x: 1, y: 1, mode: 'on', owner: 7 }); S.add({ x: 2, y: 2, mode: 'off' }); S.update(5, 1);
  assert.equal(S.visible(VIEW, (l) => l.owner === 7).length, 0);
});
test('огни постройки удаляются вместе с ней', () => {
  const S = LightSystem(); for (let i = 0; i < 4; i++) S.add({ x: i, y: 0, kind: 'flood', owner: 'z12' }); S.add({ x: 9, y: 9, owner: 'z13' });
  assert.equal(S.removeOwner('z12'), 4); assert.equal(S.size, 1);
});

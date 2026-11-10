// The parallax module against the formulas of stage 5.13 (main.js drawClouds / drawFlights): the look must not change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';
const P = load('parallax.js', 'Parallax');
// stage 5.13, verbatim: H = cam.m*VH*0.9; kk = H/(H-alt); X = VW/2+(x-cam.x)/cam.m*kk; shadow = x + SUNX*alt
const ref = (cam, VW, VH, x, y, alt) => { const H = cam.m * VH * 0.9, kk = H / (H - alt); return [VW / 2 + (x - cam.x) / cam.m * kk, VH / 2 + (y - cam.y) / cam.m * kk, kk]; };
test('проекция совпадает с формулой этапа 5.13 для облаков и самолётов', () => {
  for (const m of [0.5, 3, 22, 140]) for (const alt of [0, 900, 2000, 3800]) for (const [VW, VH] of [[1920, 1080], [390, 844]]) {
    const cam = { x: 65000, y: 61000, m }; const H = P.camH(cam, VH); if (!P.inFront(H, alt)) continue;
    const a = P.project(cam, VW, VH, 66234, 60011, alt), b = ref(cam, VW, VH, 66234, 60011, alt);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-9, `m ${m} alt ${alt}: ${a} vs ${b}`);
  }
});
test('выше — сильнее смещается при движении камеры (параллакс), земля — ровно на сдвиг', () => {
  const cam = { x: 0, y: 0, m: 20 }, VH = 1080;
  const g = P.shift(cam, VH, 0, 1000, 0)[0], c1 = P.shift(cam, VH, 2000, 1000, 0)[0], c2 = P.shift(cam, VH, 3800, 1000, 0)[0];
  assert.equal(g, -50); assert.ok(Math.abs(c1) > Math.abs(g) && Math.abs(c2) > Math.abs(c1), [g, c1, c2].join(' '));
});
test('при снижении камеры объект на высоте растёт быстрее земли', () => {
  const VH = 1080, k = (m) => P.scale(P.camH({ m }, VH), 2000);
  assert.ok(k(5) > k(20) && k(20) > k(100) && k(100) > 1);
});
test('над объективом (выше 0,9 H) объект не рисуется', () => {
  const H = P.camH({ m: 2 }, 1000); assert.equal(H, 1800); assert.ok(P.inFront(H, 1600)); assert.ok(!P.inFront(H, 1700));
});
test('тень падает по солнцу пропорционально высоте', () => {
  assert.deepEqual(P.shadow(100, 200, 1000), [100 + 620, 200 + 480]); assert.deepEqual(P.shadow(5, 5, 0), [5, 5]);
});

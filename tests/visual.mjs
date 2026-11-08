// Визуальные тесты в браузере (Playwright): тайлы рендерятся прямо в странице и проверяются по пикселям.
//  1) швы: правый столбец тайла и левый столбец соседнего (и так же по вертикали) должны продолжать друг друга —
//     разница на стыке не больше, чем между соседними столбцами внутри тайла (плюс допуск);
//  2) дыры: на суше в тайле не должно быть прозрачных пикселей (вода полупрозрачна намеренно);
//  3) ночь: тайл огней не пуст в центре города и не залит светом сплошь.
// Запуск: node tests/visual.mjs  (входит в npm run test:browser)
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const PORT = 8092, SEED = 20261107;
const server = await serve(PORT);
const browser = await chromium.launch();
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html#${SEED}`);
  await page.waitForFunction(() => window.__world && window.__world.W, null, { timeout: 30000 });
  const res = await page.evaluate(() => {
    const W = __world.W; __world.stop && __world.stop();
    const TS = W.TS, WORLD = W.WORLD, out = { seams: [], holes: [], night: [], n: 0 };
    const px = (c) => { const x = c.getContext('2d'); return x.getImageData(0, 0, c.width, c.height).data; };
    const tileAt = (z, wx, wy) => { const n = 2 ** z; return [Math.floor(wx / WORLD * n), Math.floor(wy / WORLD * n)]; };
    const spots = [];
    const cs = W.cities.slice().sort((a, b) => b.R - a.R);
    for (let i = 0; i < 6; i++) spots.push([cs[i * 3].x + cs[i * 3].R * 0.3, cs[i * 3].y]);
    for (const c of W.cities.filter((c) => c.type === 0).slice(0, 4)) spots.push([c.x, c.y]);
    for (const k of ['port', 'ind', 'ref', 'pow', 'air', 'gas']) { const z = W.zones.find((z) => z.zk === k); if (z) spots.push([z.x, z.y]); }
    for (const r of W.roads.filter((r) => r.k === 6).slice(0, 3)) spots.push([r.pts[0], r.pts[1]]);
    const col = (d, x, y, w) => (y * w + x) * 4;
    for (const [wx, wy] of spots) for (const z of [9, 10, 11, 12]) {
      const [tx, ty] = tileAt(z, wx, wy);
      const A = W.renderTile(z, tx, ty), R = W.renderTile(z, tx + 1, ty), D = W.renderTile(z, tx, ty + 1); out.n++;
      const a = px(A), r = px(R), d = px(D), w = A.width;
      // seams: compare the step across the border with the steps just inside both tiles
      const step = (p, q, x0, y0, x1, y1) => { const o = col(p, x0, y0, w), u = col(q, x1, y1, w); return Math.abs(p[o] - q[u]) + Math.abs(p[o + 1] - q[u + 1]) + Math.abs(p[o + 2] - q[u + 2]); };
      let sx = 0, ix = 0, sy = 0, iy = 0;
      for (let y = 0; y < w; y++) { sx += step(a, r, w - 1, y, 0, y); ix += (step(a, a, w - 2, y, w - 1, y) + step(r, r, 0, y, 1, y)) / 2; }
      for (let x = 0; x < w; x++) { sy += step(a, d, x, w - 1, x, 0); iy += (step(a, a, x, w - 2, x, w - 1) + step(d, d, x, 0, x, 1)) / 2; }
      sx /= w; ix /= w; sy /= w; iy /= w;
      if (sx > ix * 2.2 + 9) out.seams.push(`z${z} ${tx},${ty} | шов по x: ${sx.toFixed(1)} при ${ix.toFixed(1)} внутри`);
      if (sy > iy * 2.2 + 9) out.seams.push(`z${z} ${tx},${ty} — шов по y: ${sy.toFixed(1)} при ${iy.toFixed(1)} внутри`);
      // holes on land
      let holes = 0; const m = WORLD / 2 ** z / w;
      for (let y = 2; y < w; y += 8) for (let x = 2; x < w; x += 8) { const o = col(a, x, y, w); if (a[o + 3] < 8 && W.landE(tx * w * m + (x + 0.5) * m, ty * w * m + (y + 0.5) * m, 0) > 0.01) holes++; }
      if (holes > 2) out.holes.push(`z${z} ${tx},${ty}: ${holes} прозрачных точек на суше`);
    }
    // night lights in the centres of the biggest towns
    for (const c of cs.slice(0, 4)) { const [tx, ty] = tileAt(11, c.x, c.y); const L = W.renderLights(11, tx, ty, 0); if (!L) { out.night.push(`${c.name}: ночью тайл пуст`); continue; }
      const p = px(L); let lit = 0, sat = 0; for (let i = 3; i < p.length; i += 16) { if (p[i] > 20) lit++; if (p[i] > 250) sat++; }
      const N = p.length / 16; if (lit < N * 0.03) out.night.push(`${c.name}: огней слишком мало (${(lit / N * 100).toFixed(1)}%)`); if (sat > N * 0.6) out.night.push(`${c.name}: тайл залит светом`); }
    return out;
  });
  const report = (name, list) => { console.log(`${list.length ? 'FAIL' : 'OK  '} ${name}`); for (const l of list.slice(0, 12)) console.log('     ' + l); if (list.length) failed++; };
  console.log(`визуальные проверки: ${res.n} мест × 3 тайла`);
  report('швы между тайлами', res.seams);
  report('дыры на суше', res.holes);
  report('ночные огни', res.night);
  report('ошибки страницы', errs);
} finally { await browser.close(); server.close(); }
if (failed) { console.log(`\nвизуальных проблем: ${failed}`); process.exit(1); }

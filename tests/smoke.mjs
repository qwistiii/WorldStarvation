// Браузерный smoke-тест (Playwright + Chromium): игра стартует без ошибок в основных режимах.
// Запуск: npm run test:browser   (один раз перед этим: npx playwright install chromium)
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const PORT = 8091;
const pages = ['index.html', 'dist/living-world.html'];
const modes = [
  ['день', '#1337'],
  ['ночь', '#1337,t23'],
  ['зима + снегопад', '#1337,t12,s2,w5'],
  ['без workers', '#1337cpu'],
];

const server = await serve(PORT);
const browser = await chromium.launch();
let failed = 0;
try {
  for (const file of pages) {
    for (const [name, hash] of modes) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`http://127.0.0.1:${PORT}/${file}${hash}`);
      let ok = true;
      try {
        await page.waitForFunction(() => window.__world && window.__world.W && window.__world.W.cities.length > 0, null, { timeout: 30000 });
        await page.waitForTimeout(4000);
      } catch (e) { ok = false; errors.push('мир не запустился: ' + e.message); }
      const stats = await page.evaluate(() => ({ cities: window.__world?.W?.cities.length, fps: document.getElementById('fps')?.textContent })).catch(() => ({}));
      if (errors.length) ok = false;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${file} ${name}: городов ${stats.cities}, ${stats.fps || ''}`);
      for (const e of errors) console.log('     ' + e);
      if (!ok) failed++;
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);

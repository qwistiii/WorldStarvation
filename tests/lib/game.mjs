// Shared helpers for the browser tests and the benchmark: start the static server, open the game, found a capital.
import { chromium } from 'playwright';
import { serve } from '../../tools/serve.mjs';

// Real GPU (ANGLE/D3D11 on Windows) when available, otherwise Chromium falls back to SwiftShader by itself.
export const GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--enable-webgl-draft-extensions', '--enable-privileged-webgl-extensions'];

export async function launch(extra = []) {
  return chromium.launch({ args: [...GPU_ARGS, ...extra] });
}

export async function server(port) { return serve(port); }

export const DESKTOP = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 };
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

// collects page errors and console errors
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// opens index.html, waits for the menu; returns ms to the menu
export async function openMenu(page, port, query = '') {
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/index.html${query}`);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('fade'), null, { timeout: 90000 });
  return Date.now() - t0;
}

// new game with a fixed seed and two bots; founds the capital near the centre; returns timings
export async function newGame(page, { seed = 1337, bots = 2, ai = 0 } = {}) {
  await page.evaluate(() => localStorage.clear());
  await page.click('[data-go="new"]');
  await page.evaluate(([seed, bots, ai]) => { const C = __ui.C; C.seed = seed; C.rules.botCount = bots; C.slot = 6; C.rules.ai = ai; }, [seed, bots, ai]);
  const t0 = Date.now();
  await page.click('#screate');
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.api && Game.api.ready, null, { timeout: 90000 });
  const tWorld = Date.now() - t0;
  const t1 = Date.now();
  await page.evaluate(() => { for (let r = 0; r < 60000; r += 1500) for (let a = 0; a < 6.28; a += 0.3) { const x = 65536 + Math.cos(a) * r, y = 65536 + Math.sin(a) * r; if (Game._test.validSite(x, y) === null) { Game._test.found(x, y); return; } } });
  await page.waitForFunction(() => Game.api && Game.api.ready && Game.G.phase === 'play' && Game.G.states[0].places.length, null, { timeout: 90000 });
  return { tWorld, tFound: Date.now() - t1 };
}

// waits until no tile is queued or in flight (or the timeout)
export async function settle(page, ms = 20000) {
  return page.evaluate(async (ms) => {
    const w = Game.api, t0 = performance.now();
    for (;;) { await new Promise((r) => setTimeout(r, 120)); const s = w.stats(); if ((s.queue === 0 && s.pending === 0) || performance.now() - t0 > ms) return Math.round(performance.now() - t0); }
  }, ms);
}

export function capital(page) {
  return page.evaluate(() => { const c = Game.api.W.cities.find((o) => o.cap === 0); return { x: c.x, y: c.y, R: c.R }; });
}

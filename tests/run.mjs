// The whole test set: unit tests (Node) + the browser scenario (desktop and phone, with the frame budget).
// npm test   ·   node tests/run.mjs [--no-perf]
import { spawnSync } from 'node:child_process';
const t0 = Date.now();
const run = (cmd, args) => { const t = Date.now(); const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false }); return { ok: r.status === 0, s: ((Date.now() - t) / 1000).toFixed(1) }; };
const fs = (await import('node:fs')).default;
const units = fs.readdirSync('tests/unit').filter((f) => f.endsWith('.test.mjs')).map((f) => 'tests/unit/' + f);
const u = run(process.execPath, ['--test', ...units]);
const e = run(process.execPath, ['tests/e2e/run.mjs', ...process.argv.slice(2)]);
console.log(`\nюнит: ${u.ok ? 'OK' : 'FAIL'} (${u.s} с) · браузер: ${e.ok ? 'OK' : 'FAIL'} (${e.s} с) · всего ${((Date.now() - t0) / 1000).toFixed(1)} с`);
process.exit(u.ok && e.ok ? 0 : 1);

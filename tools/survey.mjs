// Обход типовых мест мира для проверки глазами: node tools/survey.mjs [seed] [префикс]
// Снимает 16 кадров в /tmp/shots/<префикс>NN.png: центр мегаполиса, города разного размера, сёла, порт, ТЭЦ,
// промзону, развязку, мост, АЗС, вокзал, СНТ. Места ищутся по данным мира, поэтому подходят для любого seed.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = process.argv[2] || '20261107', p = process.argv[3] || 's';
const zone = (k, i = 0) => `(()=>{const z=W.zones.filter(z=>z.zk==='${k}')[${i}];return z&&[z.x,z.y]})()`;
const J = [
  { at: 'city', i: 0, m: 1.6 }, { at: 'city', i: 0, m: 0.45, dx: 600, dy: 300 },
  { at: 'city', i: 3, m: 0.8 }, { at: 'city', i: 8, m: 0.6, dx: 200 },
  { at: 'city', i: 20, m: 0.5 }, { at: 'village', i: 3, m: 0.5 },
  { at: 'village', i: 12, m: 0.35 }, { at: 'expr', expr: zone('port'), m: 1.2 },
  { at: 'expr', expr: zone('pow'), m: 0.9 }, { at: 'expr', expr: zone('ind', 2), m: 0.9 },
  { at: 'expr', expr: '(()=>{const r=W.roads.filter(r=>r.k===6)[10];return r&&[r.pts[0],r.pts[1]]})()', m: 1.0 },
  { at: 'expr', expr: '(()=>{const r=W.roads.find(r=>r.k===0&&r.br&&r.br.length&&!r.ring);if(!r)return null;const q=W.posAt(r,(r.br[0][0]+r.br[0][1])/2);return [q[0],q[1]]})()', m: 0.8 },
  { at: 'expr', expr: zone('gas'), m: 0.3 }, { at: 'expr', expr: zone('stn'), m: 0.6 },
  { at: 'expr', expr: zone('dacha'), m: 0.5 }, { at: 'city', i: 1, m: 0.25, dx: -300, dy: 200 },
].map((j, n) => Object.assign(j, { name: p + String(n + 1).padStart(2, '0'), tod: 12, hash: seed }));
execFileSync('node', [path.join(root, 'tools/shot.mjs'), 'index.html', JSON.stringify(J)], { stdio: 'inherit', cwd: root });

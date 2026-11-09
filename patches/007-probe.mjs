import fs from 'fs';
const src = fs.readFileSync('src/gen.js', 'utf8');
const out = [];
const hits = (re, max, pre, post) => { const r = new RegExp(re, 'g'); let m, n = 0; out.push('######## ' + re); while ((m = r.exec(src)) && n < max) { n++; out.push('--- @' + m.index); out.push(src.slice(Math.max(0, m.index - pre), m.index + post)); } };
hits('ringR\\(', 8, 300, 900);
hits('JUNC', 6, 200, 900);
hits("'plz'", 6, 200, 700);
hits('LEANX', 4, 300, 500);
const a = src.indexOf('function renderTile(');
out.push('######## renderTile @' + a);
out.push(src.slice(a, a + 16000));
fs.mkdirSync('docs/probe', { recursive: true });
fs.writeFileSync('docs/probe/slices2.txt', out.join('\n'));
const g = fs.readFileSync('src/game.js', 'utf8');
const o2 = [];
for (const re of ['setGrow', 'flyTo', 'found', 'capital']) { const r = new RegExp(re, 'g'); let m, n = 0; o2.push('######## ' + re); while ((m = r.exec(g)) && n < 6) { n++; o2.push('--- @' + m.index); o2.push(g.slice(Math.max(0, m.index - 250), m.index + 450)); } }
fs.writeFileSync('docs/probe/game.txt', o2.join('\n'));
console.log('ok');

import fs from 'fs';
const src = fs.readFileSync('src/gen.js', 'utf8');
const R = [['genBlock head', 197394, 198400], ['diag+cityLayout', 18100, 20700], ['addDiag', 29280, 30840], ['connect/ring', 42650, 46500], ['gov quarter case 21', 212700, 215800], ['growth', 332400, 335200], ['fpOver/dedupe', 114100, 115200], ['obbOver', 218600, 219300]];
const out = [];
for (const [n, a, b] of R) { out.push('######## ' + n + ' @' + a + '-' + b); out.push(src.slice(a, b)); }
fs.mkdirSync('docs/probe', { recursive: true });
fs.writeFileSync('docs/probe/slices.txt', out.join('\n'));
console.log('slices written');

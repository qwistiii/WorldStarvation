import fs from 'fs';
const src = fs.readFileSync('src/gen.js', 'utf8');
const lines = src.split('\n');
const out = [];
out.push('gen.js chars ' + src.length + ' lines ' + lines.length);
const starts = [0];
for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
function lineOf(o) { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= o) lo = m; else hi = m - 1; } return lo + 1; }
out.push('## line lengths (line:len) for lines > 400 chars');
lines.forEach((l, i) => { if (l.length > 400) out.push((i + 1) + ':' + l.length); });
out.push('## functions');
const fre = /function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g;
let m;
while ((m = fre.exec(src))) out.push(lineOf(m.index) + ' @' + m.index + ' ' + (m[1] || m[2]));
out.push('## keywords');
const kws = ['cityLayout', 'gridStreets', '\\bring', 'radial', 'diag', '\\bcross', 'avenue', 'boulevard', 'plaza', 'square', '\\bhall', '\\bgov', 'capital', 'tower', 'FAMS', 'overlap', 'footprint', 'roof'];
for (const k of kws) {
  const re = new RegExp(k, 'gi');
  let n = 0;
  out.push('# ' + k);
  while ((m = re.exec(src)) && n < 12) {
    n++;
    const a = Math.max(0, m.index - 90), b = Math.min(src.length, m.index + 110);
    out.push(lineOf(m.index) + ' @' + m.index + ' ' + src.slice(a, b).replace(/\n/g, ' | '));
  }
  let total = 0; re.lastIndex = 0; while (re.exec(src)) total++;
  out.push('  total ' + total);
}
fs.mkdirSync('docs/probe', { recursive: true });
fs.writeFileSync('docs/probe/gen.txt', out.join('\n'));
console.log('probe written', out.length, 'lines');

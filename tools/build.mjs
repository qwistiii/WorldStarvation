// Собирает index.html + src/* в один самодостаточный файл dist/living-world.html
// (тот же формат, что и living-world-stageN.html в Notion).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

export function build() {
  let html = read('index.html');
  const swap = (tag, inline) => {
    if (!html.includes(tag)) throw new Error(`В index.html не найден тег: ${tag}`);
    html = html.replace(tag, () => inline);
  };
  swap('<link rel="stylesheet" href="src/style.css">\n', `<style>\n${read('src/style.css')}</style>`);
  for (const f of ['flag', 'gen', 'main', 'game', 'ui']) swap(`<script src="src/${f}.js"></script>`, `<script>\n${read(`src/${f}.js`)}</script>`);
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = path.join(root, 'dist', 'living-world.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, build());
  console.log(`Готово: ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} КБ)`);
}

// Собирает index.html + src/* в один самодостаточный файл dist/living-world.html
// (тот же формат, что и living-world-stageN.html в Notion).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

export function build() {
  let html = read('index.html').split('\r\n').join('\n'); // Windows checkouts have CRLF
  const swap = (tag, inline) => {
    if (!html.includes(tag)) throw new Error(`В index.html не найден тег: ${tag}`);
    html = html.replace(tag, () => inline);
  };
  // assets carry ?v=<version> (cache busting on GitHub Pages: max-age=600 would otherwise mix old and new files)
  const v = JSON.parse(read('package.json')).version.split('.').slice(0, 2).join('.');
  // the font (Rubik, OFL — src/fonts/OFL.txt) goes into the file as a data: URL
  const font = fs.readFileSync(path.join(root, 'src/fonts/rubik.woff2')).toString('base64');
  const css = read('src/style.css').replace('url(fonts/rubik.woff2)', () => `url(data:font/woff2;base64,${font})`);
  swap(`<link rel="stylesheet" href="src/style.css?v=${v}">\n`, `<style>\n${css}</style>`);
  for (const f of ['flag', 'gen', 'parallax', 'gl', 'place', 'lights', 'main', 'game', 'ui']) swap(`<script src="src/${f}.js?v=${v}"></script>`, `<script>\n${read(`src/${f}.js`)}</script>`);
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = path.join(root, 'dist', 'living-world.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, build());
  console.log(`Готово: ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} КБ)`);
}

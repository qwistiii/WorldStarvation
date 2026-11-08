// Аудит геометрии: node tools/audit.mjs [seed ...] — сводка наложений и примеры мест (координаты для tools/shot.mjs).
import { world, audit, where, label } from '../tests/audit.mjs';
const seeds = process.argv.slice(2).map(Number);
for (const seed of seeds.length ? seeds : [20261107]) {
  const t0 = Date.now(); const W = world(seed); const A = audit(W, { trees: true, roads: true });
  console.log(`\nseed ${seed}: объектов ${A.n}, ${Date.now() - t0} мс`);
  const show = (name, list, f) => {
    console.log(`  ${name}: ${list.length}`);
    const by = new Map(); for (const it of list) { const k = f(it).split(' @')[0]; by.set(k, (by.get(k) || 0) + 1); }
    [...by].sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([k, n]) => console.log(`     ${n}× ${k}`));
    list.slice(0, 4).forEach((it) => console.log(`     пример: ${f(it)}`));
  };
  show('постройки на дорогах', A.onRoad, (it) => `${label(it.o).replace(/ квартал.*тип/, ' тип')} на k=${it.r.k} @${where(it.o)}`);
  show('деревья на проезжей части', A.treeOnRoad, (it) => `${label(it.o).replace(/ квартал.*тип/, ' тип')} на k=${it.r.k} @${where(it.o)}`);
  show('наложения разных владельцев', A.overlap, (it) => `${it.a.tag}/${it.b.tag} @${where(it.a)} ${label(it.a)} | ${label(it.b)}`);
  show('наложения внутри квартала/зоны', A.overlapSame, (it) => `${label(it.a).replace(/ квартал [\d,]+/, '').replace(/^.* тип/, 'тип')} @${where(it.a)}`);
  show('кроны деревьев на крышах', A.crown, (it) => `${label(it.o).replace(/ квартал.*тип/, ' тип')} @${where(it.o)}`);
  show('ветряки', A.turbine, (it) => `${it.r ? 'на дороге k=' + it.r.k : 'в постройке'} @${Math.round(it.t.x)},${Math.round(it.t.y)}`);
  show('дороги вплотную вдоль дорог', A.parallel, (it) => `k=${it.a.k}${it.a.city !== undefined ? 'г' : ''} вдоль k=${it.b.k}${it.b.city !== undefined ? 'г' : ''} @${Math.round(it.x)},${Math.round(it.y)}`);
}

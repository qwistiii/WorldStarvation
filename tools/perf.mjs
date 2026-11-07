// Время рендера тайлов (мс) в центре крупнейшего города: [день, огни] по уровням z. node tools/perf.mjs
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const server = await serve(8094);
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`http://127.0.0.1:8094/${process.argv[2]||'index.html'}#20261107cpu`);
await p.waitForFunction(() => window.__world && window.__world.W, null, { timeout: 30000 });
const r = await p.evaluate(() => { const W=__world.W;__world.stop();const c=W.cities.slice().sort((a,b)=>b.R-a.R)[0];const out={};W.renderTile(9,10,10);W.renderLights(9,10,10,0);
  for (const z of [6,8,10,11,12]) { const n=1<<z,ts=W.WORLD/n;const tx=Math.floor((c.x+300)/ts),ty=Math.floor(c.y/ts);let t=performance.now();
    for(let i=0;i<4;i++)W.renderTile(z,tx+(i&1),ty+(i>>1));const d=(performance.now()-t)/4;t=performance.now();for(let i=0;i<4;i++)W.renderLights(z,tx+(i&1),ty+(i>>1),0);out['z'+z]=[d.toFixed(0),((performance.now()-t)/4).toFixed(0)]}
  return out});
console.log(JSON.stringify(r));
await b.close(); server.close();

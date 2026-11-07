// Скриншоты для проверки визуала (Playwright). Результат: /tmp/shots/<name>.png
// node tools/shot.mjs index.html '[{"name":"city","at":"big","dx":300,"m":0.5,"tod":12}]'
// at: big | city (i — индекс по размеру) | village (i) | expr (JS от W, вернуть [x,y]) | иначе x,y; wait — ждать N×0,5 с вместо полной загрузки; m — метров на пиксель; tod — час; wx — погода; season — сезон
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const [,, file='index.html', ...rest] = process.argv;
const jobs = JSON.parse(rest[0]);
fs.mkdirSync('/tmp/shots',{recursive:true});
const server = await serve(8093);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for (const j of jobs) {
  const p = await b.newPage({ viewport: { width: j.w||900, height: j.h||600 } });
  const errs=[];p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(`http://127.0.0.1:8093/${file}#${j.hash||'20261107'}`);
  await p.waitForFunction(() => window.__world && window.__world.W, null, { timeout: 30000 });
  await p.evaluate((j) => { const w=__world; w.stop(); w.setSpeed&&w.setSpeed(0); if(j.tod!=null)w.setTod(j.tod);if(j.season!=null)w.setSeason(j.season); if(j.wx!=null)w.setWeather(j.wx);
    const W=w.W; let x,y;
    if(j.at==='big'){const c=W.cities.slice().sort((a,b)=>b.R-a.R)[0];x=c.x;y=c.y}
    else if(j.at==='village'){const c=W.cities.filter(c=>c.type===0)[j.i||5];x=c.x;y=c.y}
    else if(j.at==='city'){const c=W.cities.slice().sort((a,b)=>b.R-a.R)[j.i||0];x=c.x;y=c.y}
    else if(j.at==='expr'){[x,y]=(new Function('W','return '+j.expr))(W)}
    else {x=j.x;y=j.y}
    w.cam.x=x+(j.dx||0);w.cam.y=y+(j.dy||0);w.cam.m=j.m;
    const o=w.opt; if(j.noclouds!==false){o.clouds=false;const el=document.getElementById('o_clouds');if(el)el.checked=false}
    for(const id of ['top','side','bl','help','mini','tg'])document.getElementById(id).style.display='none';
  }, j);
  for (let i=0;i<(j.wait!=null?j.wait:120);i++){await p.waitForTimeout(500);const s=await p.evaluate(()=>__world.stats());if(j.wait==null&&i>4&&s.queue===0&&s.pending===0)break}
  await p.waitForTimeout(800);
  await p.screenshot({ path: `/tmp/shots/${j.name}.png` });
  console.log(j.name, errs.join(' | '));
  await p.close();
}
await b.close(); server.close();

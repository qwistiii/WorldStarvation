// stage 5.12 (2): flat cloud layers (shadows; clouds seen from far above) are reused while the camera zooms or flies —
// scaled up to 8 % and shifted by the wind — and redrawn in full quality when the camera stops; version 5.12
import fs from 'node:fs';
function edit(path,pairs){let s=fs.readFileSync(path,'utf8');for(const [a,b,all] of pairs){const n=s.split(a).length-1;if(all?n<1:n!==1)throw new Error(path+': '+n+' matches for '+JSON.stringify(a.slice(0,90)));s=all?s.split(a).join(b):s.replace(a,()=>b)}fs.writeFileSync(path,s);console.log('ok',path)}

edit('src/main.js',[
  [`const key=[cam.m.toFixed(5),M.round(T*9*q),`,`const flat=shadowPass||H>90000,key=[flat?'f':cam.m.toFixed(5)+'|'+M.round(T*9*q),`],
  [`const ox=(L.cx-cam.x)/cam.m,oy=(L.cy-cam.y)/cam.m,flat=shadowPass||H>90000;`,`const ox=(L.cx-cam.x)/cam.m,oy=(L.cy-cam.y)/cam.m;`],
  [`if(key!==L.key||(flat?M.abs(ox)>PAD*0.9||M.abs(oy)>PAD*0.9:M.abs(ox)>0.34||M.abs(oy)>0.34)){L.key=key;L.cx=cam.x;L.cy=cam.y;`,
   `// stage 5.12: a flat layer is reused while the camera zooms (scaled, up to 8 %) and while the wind drifts it (shifted);
  // it is redrawn when the scale drifts further, its edge would show or the camera stops (then at the exact scale)
  let need=key!==L.key;if(!need){if(flat){const r=L.m/cam.m,X0=ox+(-PAD-VW/2)*r+VW/2+(T-L.T)*9/cam.m,Y0=oy+(-PAD-VH/2)*r+VH/2;need=M.abs(M.log(r))>(CAMMV?0.08:0.002)||X0>-2||Y0>-2||X0+(VW+PAD*2)*r<VW+2||Y0+(VH+PAD*2)*r<VH+2}else need=M.abs(ox)>0.34||M.abs(oy)>0.34}
  if(need){L.key=key;L.cx=cam.x;L.cy=cam.y;L.m=cam.m;L.T=T;`],
  [`{const lf=L.f||1;if(lf>=1)ctx.drawImage(L.c,M.round((dx-PAD)*DPR),M.round((dy-PAD)*DPR));else ctx.drawImage(L.c,0,0,lw*lf,lh*lf,(dx-PAD)*DPR,(dy-PAD)*DPR,lw,lh)}`,
   `{const lf=L.f||1,r=flat?L.m/cam.m:1,X0=dx+(-PAD-VW/2)*r+VW/2+(flat?(T-L.T)*9/cam.m:0),Y0=dy+(-PAD-VH/2)*r+VH/2;if(lf>=1&&!flat)ctx.drawImage(L.c,M.round(X0*DPR),M.round(Y0*DPR));else ctx.drawImage(L.c,0,0,lw*lf,lh*lf,X0*DPR,Y0*DPR,lw*r,lh*r)}`],
]);

edit('src/ui.js',[
  [`const VERSION='5.11';`,`const VERSION='5.12';`],
  [`const NEWS=[['5.11',[`,`const NEWS=[['5.12',['Полёт камеры к столице и зум без провалов: участки карты и ночные огни в точке прилёта загружаются первыми — нет размытых квадратов','Облака и их тени не перерисовываются каждый кадр, пока камера движется, — выше FPS без потери качества','Карта собирается в 7 потоков на компьютерах с 8 ГБ памяти и больше']],['5.11',[`],
]);

edit('index.html',[[`?v=5.11`,`?v=5.12`,true]]);
edit('package.json',[[`"version": "5.11.0"`,`"version": "5.12.0"`]]);

{const p='DEVLOG.md';if(fs.existsSync(p)){let s=fs.readFileSync(p,'utf8');const add=`## 5.12 — оптимизация\n\n- Предзагрузка цели камеры: при flyTo и зуме колесом тайлы дня и света (L1–L3) для точки прилёта запрашиваются первыми (camGoal/preRect). Тест fly: к прилёту готово 100 % тайлов (было 0–2 %), ночью свет 100 % (было 0 %).\n- Облака: при движении камеры слой рисуется в уменьшенном масштабе там, где спрайты растянуты (L.f); плоские слои (тени, облака с высоты) переиспользуются с масштабом до 8 % и сдвигом по ветру и перерисовываются в полном качестве, когда камера останавливается.\n- До 7 потоков тайлов при deviceMemory ≥ 8.\n- CI: tests/perf-fly.mjs (пролёт к столице день / пасмурно / ночь, ветка против main), патчи patches/*.mjs применяет workflow apply.\n\n`;
  const i=s.indexOf('\n## ');s=i>=0?s.slice(0,i+1)+add+s.slice(i+1):s+'\n'+add;fs.writeFileSync(p,s);console.log('ok',p)}}

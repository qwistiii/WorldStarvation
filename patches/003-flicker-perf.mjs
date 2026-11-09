// stage 5.13: no flicker while tiles load and a town grows; perf overlay (F3); version 5.13
import fs from 'node:fs';
function edit(path,pairs){let s=fs.readFileSync(path,'utf8');for(const [a,b,all] of pairs){const n=s.split(a).length-1;if(all?n<1:n!==1)throw new Error(path+': '+n+' matches for '+JSON.stringify(a.slice(0,90)));s=all?s.split(a).join(b):s.replace(a,()=>b)}fs.writeFileSync(path,s);console.log('ok',path)}

edit('src/main.js',[
  [`let stale=new Map(),staleT=0;`,`let stale=new Map(),staleT=0,lastArr=-9;const LST=[null,new Map(),new Map(),new Map()]; // stage 5.13: LST = previous light tiles of a redrawn area, shown until the new ones arrive`],
  [`LCS[m.L].set(m.key,{b:m.b,f:frameNo});return}`,`LCS[m.L].set(m.key,{b:m.b,f:frameNo,t0:T});lastArr=T;return}`],
  [`cache.set(m.key,{b:m.b,f:frameNo})}};`,`cache.set(m.key,{b:m.b,f:frameNo,t0:T});lastArr=T}};`],
  [`function dropStale(){for(const v of stale.values())if(v.b&&v.b.close)v.b.close();stale=new Map()}`,`function dropStale(){for(const v of stale.values())if(v.b&&v.b.close)v.b.close();stale=new Map();for(let L=1;L<=3;L++){for(const v of LST[L].values())if(v.b&&v.b.close)v.b.close();LST[L].clear()}}`],
  [`{if(v.b&&v.b.close)v.b.close();LCS[L].delete(k)}}`,`{const o=LST[L].get(k);if(o&&o.b&&o.b.close&&o!==v)o.b.close();LST[L].set(k,v);LCS[L].delete(k)}}`],
  [`function setGrow(id,g){g=g>=1?1:g;const g0=GROWS.has(id)?GROWS.get(id):1;if(g0===g)return;const coarse=g>=1||M.floor(g*4)!==M.floor(g0*4);if(g>=1)GROWS.delete(id);else GROWS.set(id,g);W.setGrow(id,g);for(const w of workers)w.postMessage({t:'grow',id,g});`,
   `const GSENT=new Map();function setGrow(id,g){g=g>=1?1:g;const g0=GROWS.has(id)?GROWS.get(id):1;if(g0===g)return;if(g>=1)GROWS.delete(id);else GROWS.set(id,g);W.setGrow(id,g);
  // stage 5.13: the tiles of a growing town are redrawn in steps of 1/12 of the growth, not on every call: constant
  // re-rendering kept the workers busy, dropped every tile in flight and made the town flicker
  const s0=GSENT.has(id)?GSENT.get(id):1;if(g<1&&g>=s0&&M.floor(g*12)===M.floor(s0*12)&&(g>=0.95)===(s0>=0.95))return;if(g>=1)GSENT.delete(id);else GSENT.set(id,g);const coarse=g>=1||M.floor(g*4)!==M.floor(s0*4);for(const w of workers)w.postMessage({t:'grow',id,g});`],
  [`function drawTiles(){`,`// stage 5.13: a new tile fades in over its fallback (the old version of the tile or the nearest coarser one) instead of popping;
// at most 8 new tiles start per frame (their upload to the GPU is spread over frames)
const FADE=0.3;
function anc2(z,tx,ty,X0,Y0,X1,Y1){for(let d=1;d<=z;d++){const ax=tx>>d,ay=ty>>d,k=tkey(z-d,ax,ay);const a=cache.get(k)||stale.get(k);if(a&&a.b){a.f=frameNo;const sz=256/(1<<d);ctx.drawImage(a.b,(tx-(ax<<d))*sz,(ty-(ay<<d))*sz,sz,sz,X0,Y0,X1-X0,Y1-Y0);return true}}return false}
function fallback(k,z,tx,ty,X0,Y0,X1,Y1){const st=stale.get(k);if(st&&st.b){ctx.drawImage(st.b,X0,Y0,X1-X0,Y1-Y0);return true}return anc2(z,tx,ty,X0,Y0,X1,Y1)}
function drawTiles(){`],
  [`queue=[];request(0,0,0,-1e9);`,`queue=[];request(0,0,0,-1e9);let upN=0;`],
  [`if(e){e.f=frameNo;ctx.drawImage(e.b,X0,Y0,X1-X0,Y1-Y0);continue}`,`if(e){e.f=frameNo;if(e.t0!==undefined&&!e.up){if(upN<8){e.up=1;upN++;e.t0=T}else if(fallback(k,z,tx,ty,X0,Y0,X1,Y1))continue;else e.up=1}
      let u=e.t0===undefined?1:(T-e.t0)/FADE;if(u>=1)e.t0=undefined;else if(fallback(k,z,tx,ty,X0,Y0,X1,Y1)){u=u<0?0:u;ctx.globalAlpha=u*u*(3-2*u)}ctx.drawImage(e.b,X0,Y0,X1-X0,Y1-Y0);ctx.globalAlpha=1;continue}`],
  [`if(!ancestor(cache,z,tx,ty,X0,Y0,X1,Y1))ancestor(stale,z,tx,ty,X0,Y0,X1,Y1)}`,`anc2(z,tx,ty,X0,Y0,X1,Y1)}`],
  [`if(e){e.f=frameNo;if(e.b)ctx.drawImage(e.b,X0,Y0,X1-X0,Y1-Y0);continue}`,`if(e){e.f=frameNo;let u=e.t0===undefined?1:(T-e.t0)/FADE;if(u>=1){e.t0=undefined;u=1}else{u=u<0?0:u*u*(3-2*u);const o=LST[L].get(k);ctx.globalAlpha=a*(1-u);if(o){if(o.b)ctx.drawImage(o.b,X0,Y0,X1-X0,Y1-Y0)}else ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2)}ctx.globalAlpha=a*u;if(e.b)ctx.drawImage(e.b,X0,Y0,X1-X0,Y1-Y0);ctx.globalAlpha=a;continue}`],
  [`requestL(z,tx,ty,prio+M.hypot((tx+0.5)*ts-cam.x,(ty+0.5)*ts-cam.y)/ts,L);ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2)}}`,`requestL(z,tx,ty,prio+M.hypot((tx+0.5)*ts-cam.x,(ty+0.5)*ts-cam.y)/ts,L);{const o=LST[L].get(k);if(o){if(o.b)ctx.drawImage(o.b,X0,Y0,X1-X0,Y1-Y0)}else ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2)}}}`],
  [`if(stale.size){staleT+=dt;if((pending.size===0&&!queue.some(q=>!q.L))||staleT>25)dropStale()}`,`if(stale.size||LST[1].size||LST[2].size||LST[3].size){staleT+=dt;if((pending.size+LPS[1].size+LPS[2].size+LPS[3].size===0&&!queue.length&&T-lastArr>FADE+0.1)||staleT>25)dropStale()}`],
  [`keys[e.code]=true;`,`keys[e.code]=true;if(e.code==='F3'){e.preventDefault();perfOn=!perfOn;if(!perfOn&&perfEl)perfEl.style.display='none';return}`],
  [`const PROF={};function pf(n){`,`let perfOn=false,perfEl=null,fWorst=0;const PROF={};function pf(n){`],
  [`function frame(now){if(!alive)return;try{frameBody(now)}catch(e){`,`function frame(now){if(!alive)return;const fj0=performance.now();try{frameBody(now);PROF.js=(PROF.js||0)*0.95+(performance.now()-fj0)*0.05}catch(e){`],
  [`frameNo++;fpsA=fpsA*0.95+(1/M.max(dt,1e-3))*0.05;`,`frameNo++;fpsA=fpsA*0.95+(1/M.max(dt,1e-3))*0.05;if(perfOn)fWorst=M.max(fWorst,dt*1000);`],
  [`function updHUD(){const H=camH();`,`function updHUD(){const H=camH();if(perfOn)perfShow();`],
  [`function fmtD(m){`,`// stage 5.13: F3 shows where the frame time goes (to check FPS on a real machine)
function perfShow(){if(!perfEl){perfEl=document.createElement('div');perfEl.style.cssText='position:fixed;left:8px;top:64px;z-index:9999;background:rgba(0,0,0,0.75);color:#9f9;font:12px/1.4 monospace;padding:6px 9px;border-radius:6px;pointer-events:none;white-space:pre';document.body.appendChild(perfEl)}perfEl.style.display='block';const NL=String.fromCharCode(10);
  const top=Object.entries(PROF).filter(e=>e[0]!=='js').sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>e[0]+' '+e[1].toFixed(2)+' мс');
  perfEl.textContent=['FPS '+M.round(fpsA)+' · худший кадр '+fWorst.toFixed(1)+' мс','JS за кадр '+(PROF.js||0).toFixed(2)+' мс'].concat(top,['тайлы '+cache.size+' · старые '+stale.size+' · в работе '+(pending.size+LPS[1].size+LPS[2].size+LPS[3].size)+' · очередь '+queue.length,'потоков '+workers.filter(w=>w.ready).length+(mainRender?' (CPU)':'')+' · машин '+carCount+' · LOD '+zNow]).join(NL);fWorst=0}
function fmtD(m){`],
]);

edit('src/ui.js',[
  [`const VERSION='5.12';`,`const VERSION='5.13';`],
  [`const NEWS=[['5.12',[`,`const NEWS=[['5.13',['Карта больше не мерцает при подгрузке: новые участки плавно проявляются поверх старых','Растущая столица перерисовывается шагами, а не каждый кадр: меньше просадок FPS после основания','Ночные огни не пропадают при перерисовке города','F3: панель замера FPS']],['5.12',[`],
]);

edit('index.html',[[`?v=5.12`,`?v=5.13`,true]]);
edit('package.json',[[`"version": "5.12.0"`,`"version": "5.13.0"`]]);
{const p='DEVLOG.md';let s=fs.readFileSync(p,'utf8');const i=s.indexOf('\n## ');const add=`\n## 5.13 — мерцание и рост столицы\n\n- setGrow: тайлы растущего города перерисовываются шагами по 1/12 роста (и при переходе 0.95), а не на каждый вызов — раньше воркеры были заняты постоянно, все тайлы в пути отбрасывались как устаревшие, город мерцал.\n- Новые тайлы проявляются за 0.3 с поверх старой версии или ближайшего более грубого тайла (anc2 ищет и в cache, и в stale); не больше 8 новых тайлов за кадр.\n- Ночные огни при invalidate уходят в LST (как stale для дневных) и показываются, пока не придут новые — раньше они пропадали сразу (мерцание раз в 12 с от LOWB).\n- F3 — панель замера: FPS, худший кадр, время JS, этапы кадра, очередь тайлов.\n`;s=i<0?s+add:s.slice(0,i)+add+s.slice(i);fs.writeFileSync(p,s);console.log('ok',p)}

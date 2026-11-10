// The world engine: renders a WorldGen world with camera, traffic, light and weather.
// startWorld(cfg) can be called again after api.destroy() (main menu → game → menu …).
// cfg: {seed, opt (WorldGen options), mode:'view'|'bg'|'game', hash (url hash string for 'view'), hooks:{draw,click,key,frame}}
function startWorld(cfg){
'use strict';
cfg=cfg||{};const MODE=cfg.mode||'view',HK=cfg.hooks||{};
const M=Math,PI=M.PI,TAU=PI*2;
const AC=new AbortController(),SIG={signal:AC.signal};let alive=true;
const clamp=(x,a,b)=>x<a?a:x>b?b:x, smooth=(a,b,x)=>{let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t)}, lerp=(a,b,t)=>a+(b-a)*t;
// hash: #seed[,tHH][,wN][,sN][cpu]   e.g. #20261107,t22.5,w3,s2
const HS=MODE==='view'?(cfg.hash!=null?cfg.hash:location.hash.slice(1)):(cfg.cpu?'cpu':'');
let SEED=cfg.seed||parseInt(HS.replace('cpu',''));if(!SEED||isNaN(SEED))SEED=20261107;
const hv=(re,d)=>{const m=HS.match(re);return m?parseFloat(m[1]):d};
// stage 6: the world is drawn with WebGL2 (src/gl.js) — ctx is a GL2D with the Canvas 2D calls the engine uses; text,
// the game overlay and the selection go to a transparent 2D canvas on top (#c2, no pointer events)
const cv=document.getElementById('c');let ov=document.getElementById('c2');if(!ov){ov=document.createElement('canvas');ov.id='c2';cv.after(ov)}
const ctx=GL2D(cv);if(!ctx){const t=document.getElementById('ldt');if(t)t.textContent='Нужен браузер с поддержкой WebGL2';throw new Error('WebGL2 is not available')}
const octx=ov.getContext('2d');
const VQ=cfg.view||{};let DPR=M.min(window.devicePixelRatio||1,VQ.dpr||2),VW=0,VH=0;const vg={r0:1,r1:2};const LITE=!!VQ.lite;
// small screens or little memory: fewer tile slots (the pools are the whole tile memory: 256 KB per slot)
const SMALL=M.min(screen.width||1e4,screen.height||1e4)<700||(navigator.deviceMemory||8)<=4;
function resize(){VW=innerWidth;VH=innerHeight;cv.width=M.round(VW*DPR);cv.height=M.round(VH*DPR);ov.width=cv.width;ov.height=cv.height;
  vg.r0=M.min(VW,VH)*0.35;vg.r1=M.hypot(VW,VH)*0.62}
addEventListener('resize',resize,SIG);resize();

let season=clamp(hv(/,s(\d)/,0)|0,0,2);
const W=WorldGen(SEED,cfg.opt),WORLD=W.WORLD,S0=W.sprites();W.setSeason(season);
const OPS=[];for(const o of cfg.ops||[]){W[o.f](o.q);OPS.push(o)} // settlements and buildings placed in the game (replayed on load)
const GROWS=new Map(cfg.grow||[]);for(const [id,g] of GROWS)W.setGrow(id,g);
let HIDL=[];
// main-thread copies of sprites as regular canvases (faster to draw than OffscreenCanvas sources in some browsers)
const SP=c=>ctx.sprite(c); // sprites go into the GL atlas
const S={car:S0.car.map(SP),carLo:S0.carLo.map(SP),truck:S0.truck.map(SP),bus:SP(S0.bus),carSh:SP(S0.carSh),truckSh:SP(S0.truckSh),busSh:SP(S0.busSh)};
const opt=Object.assign({clouds:true,labels:true,traffic:true},cfg.view||{});

// ------------------------------------------------------------ workers / tile caches
// cache: day tiles of the current season; stale: previous season (fallback while re-rendering); lcache: night-light tiles
const cache=new Map(),pending=new Set();const LCS=[null,new Map(),new Map(),new Map()],LPS=[null,new Set(),new Set(),new Set()],lcache=LCS[1];const LHB=[0,0,2,2];let stale=new Map(),staleT=0,lastArr=-9;const LST=[null,new Map(),new Map(),new Map()]; // stage 5.13: LST = previous light tiles of a redrawn area, shown until the new ones arrive
let frameNo=0,queue=[];
// tile memory: two texture-array pools (day tiles, light tiles); an entry is uploaded the first time it is drawn
const DPOOL=ctx.pool(SMALL?192:384),LPOOL=ctx.pool(SMALL?128:256);
function freeE(v){if(!v)return;if(v.s>=0&&v.P){v.P.release(v.s);v.s=-1}if(v.b&&v.b.close)v.b.close();v.b=null}
const hasC=v=>v.s>=0||!!v.b;
// frees the least recently drawn slots of a pool (not the ones drawn in this frame, never the z0–3 tiles)
function reclaim(P){const maps=P===DPOOL?[cache,stale]:[LCS[1],LCS[2],LCS[3],LST[1],LST[2],LST[3]];const arr=[];
  for(const mp of maps)for(const [k,v] of mp)if(v.s>=0&&v.f<frameNo&&k>=4*16777216)arr.push([v.f,k,mp]);arr.sort((a,b)=>a[0]-b[0]);
  for(let i=0;i<M.min(16,arr.length);i++){const mp=arr[i][2],v=mp.get(arr[i][1]);freeE(v);mp.delete(arr[i][1])}}
function slotOf(v,P){if(v.s>=0)return v.s;if(!v.b)return -1;let s=P.upload(v.b);if(s<0){reclaim(P);s=P.upload(v.b)}if(s<0)return -1;v.s=s;v.P=P;if(!v.keep){if(v.b.close)v.b.close();v.b=null}return s}
// draws an entry (whole tile or a source rect of it); false when it has nothing to show
function drawE(v,P,sx,sy,sw,sh,X0,Y0,W0,H0){const s=slotOf(v,P);if(s<0)return false;ctx.tile(P,s,sx,sy,sw,sh,X0,Y0,W0,H0);return true}
const workers=[];let mainRender=false;
const NWQ=+(new URLSearchParams(location.search).get('workers')||0); // ?workers=N — a fixed number of tile workers (tests, slow devices)
const NW=NWQ>0?M.min(8,NWQ|0):M.max(2,M.min((navigator.deviceMemory||4)>=8?7:5,(navigator.hardwareConcurrency||4)-2)); // stage 5.12: up to 7 workers on 8+ GB machines
const wsrc=(typeof FlagArt==='function'?FlagArt.toString():'')+WorldGen.toString()+`
let G=null;
onmessage=function(e){const m=e.data;
 if(m.t==='init'){try{const t=new OffscreenCanvas(2,2).getContext('2d');if(!t)throw new Error('no2d');G=WorldGen(m.seed,m.opt);G.setSeason(m.season);for(const o of m.ops||[])G[o.f](o.q);for(const q of m.grow||[])G.setGrow(q[0],q[1]);postMessage({t:'ready',ok:true})}catch(err){postMessage({t:'ready',ok:false,err:String(err)})}}
 else if(m.t==='season'){G.setSeason(m.s)}
 else if(m.t==='grow'){G.setGrow(m.id,m.g)}
 else if(m.t==='hid'){G.setHidden(m.ids)}
 else if(m.t==='op'){G[m.op.f](m.op.q)}
 else if(m.t==='tile'){if(m.L){const c=G.renderLights(m.z,m.x,m.y,m.hb);if(!c){postMessage({t:'tile',key:m.key,L:m.L,b:null,gv:m.gv});return}const b=c.transferToImageBitmap();postMessage({t:'tile',key:m.key,L:m.L,b,gv:m.gv},[b]);return}
   const c=G.renderTile(m.z,m.x,m.y);const op=!!c.op;const b=c.transferToImageBitmap();postMessage({t:'tile',key:m.key,b,s:G.season(),gv:m.gv,op},[b])}};`;
let wurl=null;try{if(HS.indexOf('cpu')>=0)throw 0;const url=URL.createObjectURL(new Blob([wsrc],{type:'text/javascript'}));
  for(let i=0;i<NW;i++){const w=new Worker(url);w.busy=0;w.ready=false;w.dead=false;
    w.onmessage=e=>{const m=e.data;if(m.t==='ready'){if(m.ok){w.ready=true;mainRender=false} // a slow start fell back to the main thread: hand rendering back to the workers
          else{w.dead=true;if(workers.every(q=>q.dead))mainRender=true}return}
      if(m.t==='tile'){w.busy--;if(!alive){if(m.b&&m.b.close)m.b.close();return}
        if(m.L){LPS[m.L].delete(m.key);if(outdated(m.key,m.gv)){if(m.b&&m.b.close)m.b.close();return}LCS[m.L].set(m.key,{b:m.b,s:-1,f:frameNo,t0:T,keep:m.key===0});lastArr=T;return}
        pending.delete(m.key);if(m.s!==season||outdated(m.key,m.gv)){if(m.b&&m.b.close)m.b.close();return}cache.set(m.key,{b:m.b,s:-1,f:frameNo,t0:T,keep:m.key===0,op:!!m.op});lastArr=T}};
    w.onerror=()=>{w.dead=true;if(workers.every(q=>q.dead))mainRender=true};w.postMessage({t:'init',seed:SEED,season,opt:cfg.opt,grow:[...GROWS],ops:OPS});if(HIDL.length)w.postMessage({t:'hid',ids:HIDL});workers.push(w)}wurl=url}
catch(e){mainRender=true}
setTimeout(()=>{if(alive&&!workers.some(w=>w.ready))mainRender=true},4000+(cfg.opt?3000:0));
const tkey=(z,x,y)=>z*16777216+y*4096+x;
function request(z,x,y,p){const k=tkey(z,x,y);if(cache.has(k)||pending.has(k))return;queue.push({k,z,x,y,p,L:0})}
function requestL(z,x,y,p,L){const k=tkey(z,x,y);if(LCS[L].has(k)||LPS[L].has(k))return;queue.push({k,z,x,y,p,L})}
function dispatch(){queue.sort((a,b)=>a.p-b.p);let qi=0;
  if(mainRender){const t0=performance.now();while(qi<queue.length&&performance.now()-t0<12){const q=queue[qi++];
      if(q.L){if(LCS[q.L].has(q.k))continue;LCS[q.L].set(q.k,{b:W.renderLights(q.z,q.x,q.y,LHB[q.L]),s:-1,f:frameNo,keep:q.k===0})}else{if(cache.has(q.k))continue;const c=W.renderTile(q.z,q.x,q.y);cache.set(q.k,{b:c,s:-1,f:frameNo,keep:q.k===0,op:!!c.op})}}return}
  for(const w of workers){if(!w.ready||w.dead)continue;while(w.busy<2&&qi<queue.length){const q=queue[qi++];
      if(q.L){if(LPS[q.L].has(q.k)||LCS[q.L].has(q.k))continue;LPS[q.L].add(q.k)}else{if(pending.has(q.k)||cache.has(q.k))continue;pending.add(q.k)}
      w.busy++;w.postMessage({t:'tile',z:q.z,x:q.x,y:q.y,key:q.k,L:q.L,hb:LHB[q.L],gv:GV})}}}
function evictMap(mp,hi,lo){if(mp.size<hi)return;const arr=[];for(const [k,v] of mp){if(k>=4*16777216)arr.push([k,v.f])}arr.sort((a,b)=>a[1]-b[1]);
  for(let i=0;i<arr.length&&mp.size>lo;i++){if(arr[i][1]>=frameNo-2)break;const v=mp.get(arr[i][0]);freeE(v);mp.delete(arr[i][0])}}
function evict(){const d=DPOOL.slots,l=LPOOL.slots;evictMap(cache,d-24,d-96);evictMap(LCS[1],l*0.5|0,l*0.38|0);evictMap(LCS[2],l*0.27|0,l*0.2|0);evictMap(LCS[3],l*0.18|0,l*0.13|0)}
function dropStale(){for(const v of stale.values())freeE(v);stale=new Map();for(let L=1;L<=3;L++){for(const v of LST[L].values())freeE(v);LST[L].clear()}}
function setSeason(s){s=clamp(s|0,0,2);if(s===season)return;season=s;W.setSeason(s);for(const w of workers)if(w.ready)w.postMessage({t:'season',s});
  dropStale();stale=new Map(cache);cache.clear();pending.clear();staleT=0;
}

// growth of capitals: tiles over a growing town are re-rendered; the old picture stays (stale) until the new one arrives.
// Tiles that were in flight while the town changed are dropped on arrival (generation version GV).
let GV=0;const INV=[];
const tileBB=k=>{const z=M.floor(k/16777216),r=k-z*16777216,y=M.floor(r/4096),x=r-y*4096,ts=WORLD/(1<<z);return [x*ts,y*ts,(x+1)*ts,(y+1)*ts]};
const hitBB=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
const tileZ0=k=>M.floor(k/16777216);
function outdated(k,gv){if(gv===undefined||gv>=GV)return false;const bb=tileBB(k),z=tileZ0(k);for(const e of INV)if(e.gv>gv&&z>=e.zmin&&z<=e.zmax&&hitBB(bb,e.bb))return true;return false}
// zmin: coarse levels (whole regions per tile) are refreshed only on big growth steps — a town is a few pixels there
function invalidate(bb,zmin,zmax){zmin=zmin||0;zmax=zmax==null?99:zmax;GV++;INV.push({gv:GV,bb,zmin,zmax});if(INV.length>64)INV.shift();
  for(const [k,v] of cache){const tz=tileZ0(k);if(tz<zmin||tz>zmax||!hitBB(tileBB(k),bb))continue;const o=stale.get(k);if(o&&o!==v)freeE(o);stale.set(k,v);cache.delete(k)}staleT=0;
  for(let L=1;L<=3;L++)for(const [k,v] of LCS[L])if(tileZ0(k)>=zmin&&tileZ0(k)<=zmax&&hitBB(tileBB(k),bb)){const o=LST[L].get(k);if(o&&o!==v)freeE(o);LST[L].set(k,v);LCS[L].delete(k)}}
const GSENT=new Map();function setGrow(id,g){g=g>=1?1:g;const g0=GROWS.has(id)?GROWS.get(id):1;if(g0===g)return;if(g>=1)GROWS.delete(id);else GROWS.set(id,g);W.setGrow(id,g);
  // stage 5.13: the tiles of a growing town are redrawn in steps of 1/12 of the growth, not on every call: constant
  // re-rendering kept the workers busy, dropped every tile in flight and made the town flicker
  const s0=GSENT.has(id)?GSENT.get(id):1;if(g<1&&g>=s0&&M.floor(g*12)===M.floor(s0*12)&&(g>=0.95)===(s0>=0.95))return;if(g>=1)GSENT.delete(id);else GSENT.set(id,g);const coarse=g>=1||M.floor(g*4)!==M.floor(s0*4);for(const w of workers)w.postMessage({t:'grow',id,g});
  const c=W.cities.find(q=>q.id===id);if(c){const rf=W.fieldReach(c)+200;let bb=[c.x-rf,c.y-rf,c.x+rf,c.y+rf];for(const z of W.zones)if(z.city===c)bb=[M.min(bb[0],z.bb[0]),M.min(bb[1],z.bb[1]),M.max(bb[2],z.bb[2]),M.max(bb[3],z.bb[3])];invalidate([bb[0]-300,bb[1]-300,bb[2]+300,bb[3]+300],coarse?0:6)}}
const zoneOn=z=>!W.isHid(z.id)&&(z.dyn||!z.city||W.growOf(z.city.id)>=0.95);
// fog of war (stage 5.7): the game hides buildings of other states that the player has not seen; tiles over the zones
// that changed are redrawn
function setHidden(ids){ids=[...ids].sort((a,b)=>a-b);const old=new Set(HIDL),now=new Set(ids);let bb=null;
  for(const id of new Set([...old,...now])){if(old.has(id)&&now.has(id))continue;const z=W.zones[id];if(!z)continue;let b=z.bb;if(z.link)b=[M.min(b[0],z.link.bb[0]),M.min(b[1],z.link.bb[1]),M.max(b[2],z.link.bb[2]),M.max(b[3],z.link.bb[3])];
    bb=bb?[M.min(bb[0],b[0]),M.min(bb[1],b[1]),M.max(bb[2],b[2]),M.max(bb[3],b[3])]:b.slice()}
  if(!bb)return;HIDL=ids;W.setHidden(ids);for(const w of workers)w.postMessage({t:'hid',ids});invalidate([bb[0]-100,bb[1]-100,bb[2]+100,bb[3]+100],4);LOWB=LOWB?[M.min(LOWB[0],bb[0]),M.min(LOWB[1],bb[1]),M.max(LOWB[2],bb[2]),M.max(LOWB[3],bb[3])]:bb}
// a settlement or building placed during the game: same call here and in every worker, then the tiles over it are redrawn
function op(f,q){const r0=W.roads.length,id=W[f](q);if(id<0)return id;const o={f,q};OPS.push(o);for(const w of workers)w.postMessage({t:'op',op:o});
  const f0=f==='addPlace'?W.cities.find(c=>c.id===id):f==='addZone'||f==='removeZone'?W.zones.find(z=>z.id===id):null;let bb=f0?f0.bb.slice():q&&q.x!=null?[q.x-500,q.y-500,q.x+500,q.y+500]:null;
  // a town also changes the farmland around it (fields reach R + 4.5 km): redraw that ring too, or tiles meet with seams
  if(f==='addPlace'&&f0){const r=W.fieldReach(f0)+200;bb=[f0.x-r,f0.y-r,f0.x+r,f0.y+r]}if(f==='addDeposits'){bb=[0,0,WORLD,WORLD]}
  if(f==='zoneUp'){const z=W.zones[id];bb=z.bb.slice()}if(f==='addRail'||f==='removeRail'){bb=W.roads[id].bb.slice()}
  if(f==='moveDeposit'){const d=W.deps[id],o=q.length>4?[q[3],q[4]]:[d.x,d.y];bb=[M.min(o[0],d.x)-400,M.min(o[1],d.y)-400,M.max(o[0],d.x)+400,M.max(o[1],d.y)+400]}if(!bb)return id;
  for(let i=r0;i<W.roads.length;i++){const r=W.roads[i];bb=[M.min(bb[0],r.bb[0]),M.min(bb[1],r.bb[1]),M.max(bb[2],r.bb[2]),M.max(bb[3],r.bb[3])]}
  // detailed levels at once; the coarse ones (a whole region per tile) are refreshed in batches every 12 s
  const b2=[bb[0]-200,bb[1]-200,bb[2]+200,bb[3]+200];invalidate(b2,4);LOWB=LOWB?[M.min(LOWB[0],b2[0]),M.min(LOWB[1],b2[1]),M.max(LOWB[2],b2[2]),M.max(LOWB[3],b2[3])]:b2;return id}
let LOWB=null;const lowT=setInterval(()=>{if(alive&&LOWB){invalidate(LOWB,0,3);LOWB=null}},12000);
// game hooks must never stop the render loop: errors are reported once per hook
const hkErr={};function hk(n,a,b){try{HK[n](a,b)}catch(e){if(!hkErr[n]){hkErr[n]=1;console.error('hook '+n+':',e)}octx.setTransform(DPR,0,0,DPR,0,0);octx.globalAlpha=1;octx.globalCompositeOperation='source-over'}}
// ------------------------------------------------------------ camera
const cam={x:WORLD/2,y:WORLD/2,m:400};let zoomT=null,fly=null,vel={x:0,y:0};
const MINM=0.045,maxM=()=>WORLD*1.25/M.min(VW,VH);cam.m=maxM();
function zoomAt(f,sx,sy){const base=zoomT?zoomT.m:cam.m;zoomT={m:clamp(base*f,MINM,maxM()),sx,sy};fly=null}
function flyTo(x,y,m,dur){const d=M.hypot(x-cam.x,y-cam.y);const span=M.max(cam.m,m)*M.max(VW,VH);const peak=M.max(0,M.log(d/span+1))*0.9;
  fly={t:0,dur:dur||M.min(6,2.2+peak*1.2),x0:cam.x,y0:cam.y,l0:M.log(cam.m),x1:x,y1:y,l1:M.log(clamp(m,MINM,maxM())),peak};zoomT=null;vel.x=vel.y=0}
function updateCam(dt){
  if(fly){fly.t+=dt/fly.dur;const t=M.min(1,fly.t);const e=t*t*(3-2*t);cam.x=fly.x0+(fly.x1-fly.x0)*e;cam.y=fly.y0+(fly.y1-fly.y0)*e;cam.m=M.exp(fly.l0+(fly.l1-fly.l0)*e+fly.peak*M.sin(PI*t));if(t>=1)fly=null}
  if(zoomT){const wx=cam.x+(zoomT.sx-VW/2)*cam.m,wy=cam.y+(zoomT.sy-VH/2)*cam.m;const nm=cam.m*M.pow(zoomT.m/cam.m,1-M.exp(-dt*11));cam.m=nm;cam.x=wx-(zoomT.sx-VW/2)*nm;cam.y=wy-(zoomT.sy-VH/2)*nm;
    if(M.abs(M.log(nm/zoomT.m))<0.003){cam.m=zoomT.m;zoomT=null}}
  if(!drag&&(vel.x||vel.y)){cam.x+=vel.x*dt;cam.y+=vel.y*dt;const k=M.exp(-dt*4.5);vel.x*=k;vel.y*=k;if(M.hypot(vel.x,vel.y)<cam.m*2)vel.x=vel.y=0}
  const kx=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),ky=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0);
  if(kx||ky){cam.x+=kx*cam.m*VW*0.7*dt;cam.y+=ky*cam.m*VW*0.7*dt;fly=null}
  if(keys.Equal||keys.NumpadAdd)zoomAt(M.exp(-dt*2.2),VW/2,VH/2);if(keys.Minus||keys.NumpadSubtract)zoomAt(M.exp(dt*2.2),VW/2,VH/2);
  const mg=WORLD*0.15;cam.x=clamp(cam.x,-mg,WORLD+mg);cam.y=clamp(cam.y,-mg,WORLD+mg);cam.m=clamp(cam.m,MINM,maxM())}
// input
const ptr=new Map();let drag=false,lastMove=0,pinch=null,downAt=null;const keys={};
const hover={x:-1,y:-1,on:false};
cv.addEventListener('pointerleave',()=>{hover.on=false},SIG);
let hold=null; // a game tool that holds the pointer (press on a station and drag a railway)
cv.addEventListener('pointerdown',e=>{if(MODE==='bg')return;cv.setPointerCapture(e.pointerId);
  if(HK.pdown&&ptr.size===0&&e.button===0){const w=[cam.x+(e.clientX-VW/2)*cam.m,cam.y+(e.clientY-VH/2)*cam.m];let r=false;try{r=HK.pdown(w[0],w[1],e.clientX,e.clientY)}catch(err){console.error(err)}if(r){hold=e.pointerId;fly=null;vel.x=vel.y=0;return}}
  ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});drag=true;fly=null;vel.x=vel.y=0;if(ptr.size===2)pinch=null;
  downAt=ptr.size===1&&e.button===0?{x:e.clientX,y:e.clientY,t:performance.now(),moved:0}:null},SIG); // the right / middle button drag the map but never click
cv.addEventListener('pointermove',e=>{hover.x=e.clientX;hover.y=e.clientY;hover.on=true;
  if(hold===e.pointerId){if(HK.pmove)try{HK.pmove(cam.x+(e.clientX-VW/2)*cam.m,cam.y+(e.clientY-VH/2)*cam.m,e.clientX,e.clientY)}catch(err){console.error(err)}return}const p=ptr.get(e.pointerId);if(!p)return;
  if(ptr.size===1){const dx=e.clientX-p.x,dy=e.clientY-p.y;if(downAt)downAt.moved+=M.abs(dx)+M.abs(dy);cam.x-=dx*cam.m;cam.y-=dy*cam.m;const now=performance.now(),dtm=M.max(1,now-lastMove)/1000;lastMove=now;
    vel.x=-dx*cam.m/dtm*0.6+vel.x*0.4;vel.y=-dy*cam.m/dtm*0.6+vel.y*0.4;zoomT=null}
  p.x=e.clientX;p.y=e.clientY;
  if(ptr.size===2){downAt=null;const [a,b]=[...ptr.values()];const d=M.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    if(pinch){const f=pinch.d/d;const wx=cam.x+(pinch.mx-VW/2)*cam.m,wy=cam.y+(pinch.my-VH/2)*cam.m;cam.m=clamp(cam.m*f,MINM,maxM());cam.x=wx-(mx-VW/2)*cam.m;cam.y=wy-(my-VH/2)*cam.m}
    pinch={d,mx,my};vel.x=vel.y=0}},SIG);
const up=e=>{if(hold===e.pointerId){hold=null;if(HK.pup)try{HK.pup(cam.x+(e.clientX-VW/2)*cam.m,cam.y+(e.clientY-VH/2)*cam.m,e.clientX,e.clientY,e.type==='pointercancel')}catch(err){console.error(err)}return}
  ptr.delete(e.pointerId);if(ptr.size<2)pinch=null;
  if(ptr.size===0){drag=false;if(performance.now()-lastMove>90)vel.x=vel.y=0;
    if(downAt&&downAt.moved<6&&performance.now()-downAt.t<450&&e.type==='pointerup'){vel.x=vel.y=0;const sx=e.clientX,sy=e.clientY;clickT=setTimeout(()=>pick(sx,sy),230)}downAt=null}};
let clickT=0;
cv.addEventListener('pointerup',up,SIG);cv.addEventListener('pointercancel',up,SIG);
cv.addEventListener('wheel',e=>{e.preventDefault();if(MODE==='bg')return;let d=e.deltaY;if(e.deltaMode===1)d*=18;else if(e.deltaMode===2)d*=400;zoomAt(M.exp(clamp(d,-300,300)*0.0022),e.clientX,e.clientY)},{passive:false,signal:AC.signal});
cv.addEventListener('dblclick',e=>{clearTimeout(clickT);if(HK.dblclick&&HK.dblclick())return;zoomAt(0.35,e.clientX,e.clientY)},SIG);
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;if(MODE==='bg')return;keys[e.code]=true;if(e.code==='F3'){e.preventDefault();perfOn=!perfOn;if(!perfOn&&perfEl)perfEl.style.display='none';return}
  if(HK.key&&HK.key(e))return;
  if(MODE==='view'){if(e.code==='KeyN')setTod(isNight()?11:22.5);if(e.code==='KeyP')setSpeed(tSpeed?0:1)}if(e.code==='Escape')closeInsp()},SIG);
addEventListener('keyup',e=>{keys[e.code]=false},SIG);
addEventListener('blur',()=>{for(const k in keys)keys[k]=false},SIG);

// ------------------------------------------------------------ procedural assets (main thread)
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
// water ripples: tileable height field (sum of wind-aligned waves with integer wave vectors), lit by the sun:
// faces toward the sun -> light, away -> dark, plus sparse sun glints. Signed alpha like the ground materials.
// procedural textures are pixel loops (~0.3–0.8 s): they are kept between worlds (menu → game → menu) in AST, by seed
const AST=window.__wsAssets||(window.__wsAssets={});const cached=(k,f)=>AST[k]||(AST[k]=f());
const wavePat=(()=>{const c=cached('wave',()=>{const N=256,c=mk(N,N),x=c.getContext('2d'),id=x.createImageData(N,N),d=id.data;const R=W.rng(99);const waves=[];const wa=M.atan2(W.WDY,W.WDX);
  for(let i=0;i<64;i++){const k=4+R()*R()*40,a=wa+(R()-0.5)*(i<20?1.6:TAU);const kx=M.round(M.cos(a)*k),ky=M.round(M.sin(a)*k);if(!kx&&!ky)continue;waves.push([kx,ky,R()*TAU,1/M.pow(M.hypot(kx,ky),1.15)])}
  const S=new Float32Array(N*N),Hh=new Float32Array(N*N);let ms=0,mh=0;const lx=-W.SUNX,ly=-W.SUNY;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){let gx=0,gy=0,h=0;for(const w of waves){const ph=(w[0]*i+w[1]*j)/N*TAU+w[2],cv=M.cos(ph)*w[3];gx+=cv*w[0];gy+=cv*w[1];h+=M.sin(ph)*w[3]}
    const q=j*N+i;S[q]=gx*lx+gy*ly;Hh[q]=h;ms=M.max(ms,M.abs(S[q]));mh=M.max(mh,h)}
  for(let q=0;q<N*N;q++){const v=S[q]/ms,gl=M.pow(M.max(0,v),6)*1.6+M.pow(M.max(0,Hh[q]/mh),8)*0.6;const o=q*4;
    if(v>=0){d[o]=230;d[o+1]=242;d[o+2]=255;d[o+3]=clamp((v*0.55+gl)*200,0,255)}else{d[o]=4;d[o+1]=20;d[o+2]=44;d[o+3]=clamp(-v*0.7*200,0,255)}}
  x.putImageData(id,0,0);return c});return {tex:ctx.texture(0,0,c,true),x:0,y:0,w:256,h:256}})();
function cloudSprite(seed){return SP(cached('cloud'+seed+'|'+SEED,()=>cloudCanvas(seed)))}
function cloudCanvas(seed){const N=256,c=mk(N,N),x=c.getContext('2d'),id=x.createImageData(N,N),d=id.data;const den=new Float32Array(N*N);const ox=seed*17.3,oy=seed*5.1;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=i/N-0.5,v=j/N-0.5;const r=M.sqrt(u*u+v*v)*2;let n=0,a=0.55,f=2.2;for(let o=0;o<5;o++){n+=a*W.noise(u*f+ox+o*3.1,v*f+oy-o*1.7);a*=0.48;f*=2.05}
    den[j*N+i]=clamp(n*1.1+0.62-r*r*1.25-r*0.2,0,1)}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,dd=den[k];const k2=M.min(N-1,j+5)*N+M.min(N-1,i+5),k3=M.max(0,j-5)*N+M.max(0,i-5);
    const lit=clamp(0.92-(den[k2]-den[k3])*1.4+dd*0.08,0.55,1.05);const o=k*4;d[o]=clamp(250*lit,0,255);d[o+1]=clamp(252*lit,0,255);d[o+2]=clamp(255*lit+6,0,255);d[o+3]=smooth(0.02,0.6,dd)*235}
  x.putImageData(id,0,0);return c} // the shadow ('#061018' silhouette) and the tinted cloud are the same sprite with a tint
const CLS=[];for(let i=0;i<6;i++)CLS.push(cloudSprite(i+SEED%100));
// cloud groups are generated for full overcast; weather "cover" decides how many are shown
const clouds=[];{const R=W.rng(SEED^0xc10d);const NG=160;const ord=[];for(let i=0;i<NG;i++)ord.push(i);for(let i=NG-1;i>0;i--){const j=(R()*(i+1))|0;[ord[i],ord[j]]=[ord[j],ord[i]]}
  for(let c=0;c<NG;c++){const cx=(R()*1.3-0.15)*WORLD,cy=(R()*1.3-0.15)*WORLD;const n=2+(R()*7|0),alt=2000+R()*1800;
  for(let k=0;k<n;k++)clouds.push({x:cx+(R()-0.5)*12000,y:cy+(R()-0.5)*8000,s:3500+R()*7000,alt:alt+(R()-0.5)*500,v:R()*6|0,g:ord[c]/NG})}}
let cloudTint='';const CLT=[1,1,1,0],CLSH=[6/255,16/255,24/255,1],BLK=[0,0,0,1];
function tintClouds(r,g,b,mixA){const key=(r>>3)+','+(g>>3)+','+(b>>3)+','+(mixA*20|0);if(key===cloudTint)return;cloudTint=key;CLT[0]=(r|0)/255;CLT[1]=(g|0)/255;CLT[2]=(b|0)/255;CLT[3]=mixA}
function soft(r,g,b,a){const c=mk(64,64),x=c.getContext('2d');const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${r},${g},${b},${a})`);gr.addColorStop(0.5,`rgba(${r},${g},${b},${a*0.55})`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);x.fillStyle=gr;x.fillRect(0,0,64,64);return SP(c)}
function glow(r,g,b){const c=mk(64,64),x=c.getContext('2d');const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${r},${g},${b},1)`);gr.addColorStop(0.1,`rgba(${r},${g},${b},0.8)`);gr.addColorStop(0.35,`rgba(${r},${g},${b},0.2)`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);x.fillStyle=gr;x.fillRect(0,0,64,64);return SP(c)}
const PUFF_W=soft(250,250,252,0.9),PUFF_G=soft(120,118,114,0.9),PUFF_D=soft(60,58,56,0.9),FLAME=soft(255,170,60,1),FLAME2=soft(255,240,180,1);
const GL_W=glow(255,244,220),GL_R=glow(255,40,28),GL_G=glow(60,255,120),GL_S=glow(255,150,56),GL_B=glow(225,235,255);
const PLANES=[];for(let c=0;c<5;c++){const p=mk(128,128),x=p.getContext('2d');x.translate(64,64);x.scale(2,2);W.drawPlane(x,1,c);PLANES.push(SP(p))} // shadows: the same sprite tinted black
// headlight beam: origin at left-middle, two lamps + cone (local: x forward)
const BEAM=(()=>{const Wd=256,Hd=96,c=mk(Wd,Hd),x=c.getContext('2d');const im=x.createImageData(Wd,Hd),d=im.data; // 22 x 8 m, lamps at +-0.75 m
  for(let py=0;py<Hd;py++)for(let px=0;px<Wd;px++){const u=px/Wd,v=(py+0.5-Hd/2)/12;let I=0;
    for(const ly of [-0.75,0.75]){const sp=0.35+u*22*0.2,dv=(v-ly-u*ly*0.6)/sp;I+=M.exp(-dv*dv*1.4)}
    I*=M.pow(1-u,1.7)*M.min(1,u*14+0.15)*0.32;const o=(py*Wd+px)*4;d[o]=255;d[o+1]=238;d[o+2]=205;d[o+3]=M.min(255,I*255)}
  x.putImageData(im,0,0);x.globalCompositeOperation='lighter';for(const ly of [-0.75,0.75]){const cy=Hd/2+ly*12;const g=x.createRadialGradient(2,cy,0,2,cy,7);g.addColorStop(0,'rgba(255,255,245,1)');g.addColorStop(0.35,'rgba(255,250,230,0.5)');g.addColorStop(1,'rgba(255,245,220,0)');x.fillStyle=g;x.fillRect(0,cy-7,9,14)}return SP(c)})();
const TAIL=(()=>{const c=mk(32,32),x=c.getContext('2d');const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,40,30,0.9)');g.addColorStop(0.4,'rgba(255,20,10,0.35)');g.addColorStop(1,'rgba(255,0,0,0)');x.fillStyle=g;x.fillRect(0,0,32,32);
  x.fillStyle='rgba(255,90,70,1)';x.beginPath();x.arc(16,9.5,1.6,0,TAU);x.arc(16,22.5,1.6,0,TAU);x.fill();return SP(c)})();
const FLAKE=(()=>{const c=mk(16,16),x=c.getContext('2d');const g=x.createRadialGradient(8,8,0,8,8,8);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.45,'rgba(255,255,255,0.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,16,16);return SP(c)})();
const TRAM=(()=>{const c=mk(124,12),x=c.getContext('2d');x.fillStyle='rgba(0,0,0,0.3)';x.fillRect(3,3,121,9);for(let i=0;i<3;i++){x.fillStyle='#c8322a';x.fillRect(2+i*40.5,1,39,9.6);x.fillStyle='#eeeeea';x.fillRect(4+i*40.5,3,35,5.6);x.fillStyle='rgba(40,50,60,0.6)';for(let q=0;q<5;q++)x.fillRect(6+i*40.5+q*6.8,3.6,4.6,1.2)}x.fillStyle='#333';x.fillRect(118,2,4,8);x.fillStyle='#555';x.fillRect(30,5,6,1.6);return SP(c)})();
// stage 6 helper sprites: a disc (nav lights), a fading bar (contrails), a ship wake and bow wave (were canvas gradients)
const DISC=(()=>{const c=mk(32,32),x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(16,16,15,0,TAU);x.fill();return SP(c)})();
const GRADX=(()=>{const c=mk(256,4),x=c.getContext('2d');const g=x.createLinearGradient(0,0,256,0);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,256,4);return SP(c)})();
const WAKE=(()=>{const c=mk(276,100),x=c.getContext('2d');x.translate(320,50);const L=100;const g=x.createLinearGradient(-L/2,0,-L*3.2,0);g.addColorStop(0,'rgba(240,250,255,0.55)');g.addColorStop(1,'rgba(240,250,255,0)');x.fillStyle=g;
  x.beginPath();x.moveTo(-L*0.45,-L*0.06);x.lineTo(-L*3.2,-L*0.5);x.lineTo(-L*3.2,-L*0.38);x.lineTo(-L*0.5,0);x.lineTo(-L*3.2,L*0.38);x.lineTo(-L*3.2,L*0.5);x.lineTo(-L*0.45,L*0.06);x.closePath();x.fill();return SP(c)})();
const BOW=(()=>{const c=mk(20,24),x=c.getContext('2d');x.fillStyle='rgba(255,255,255,0.35)';x.beginPath();x.moveTo(20,12);x.lineTo(0,0);x.lineTo(0,24);x.fill();return SP(c)})();
// ship hulls: W.drawShip is vector art; each (length, style, colour, resolution) is drawn once into its own texture and
// kept while ships of that kind are on screen (resolution follows the zoom, up to the 8 px/m of the closest tiles)
const SHIPS=new Map();function shipSprite(L,st,c,m){const ps=m<0.15?8:m<0.4?4:2,key=L+'|'+st+'|'+c+'|'+ps;let e=SHIPS.get(key);
  if(!e){const w=L*(st===2?0.16:0.14),h=L/2;const cw=M.ceil((L+10)*ps),ch=M.ceil((w+10)*ps);const cv2=mk(cw,ch),x=cv2.getContext('2d');x.scale(ps,ps);x.translate(h+3,w/2+3);W.drawShip(x,L,st,c,true);
    e={r:{tex:ctx.texture(0,0,cv2),x:0,y:0,w:cw,h:ch},ox:-(h+3),oy:-(w/2+3),w:cw/ps,h:ch/ps,f:0};SHIPS.set(key,e)}e.f=frameNo;return e}
// tileable fog texture
const FOG=(()=>{const c=cached('fog'+SEED,()=>{const N=256,c=mk(N,N),x=c.getContext('2d'),id=x.createImageData(N,N),d=id.data;const f=(i,j)=>{let n=0,a=0.55,q=4/N;for(let o=0;o<5;o++){n+=a*W.noise(i*q+o*7.1,j*q-o*3.3);a*=0.5;q*=2}return n};
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=i/N,v=j/N;const n=f(i,j)*(1-u)*(1-v)+f(i-N,j)*u*(1-v)+f(i,j-N)*(1-u)*v+f(i-N,j-N)*u*v;const a=smooth(-0.32,0.42,n*1.6);const o=(j*N+i)*4;d[o]=232;d[o+1]=236;d[o+2]=240;d[o+3]=a*255}
  x.putImageData(id,0,0);return c});return {tex:ctx.texture(0,0,c,true),x:0,y:0,w:256,h:256}})();

// ------------------------------------------------------------ time of day & weather
let tod=((hv(/,t(\d+(?:\.\d+)?)/,cfg.tod!=null?cfg.tod:17.2))%24+24)%24,tSpeed=1,todRate=null,readyFired=false;const DN=cfg.dayNight!==false;const SPEEDS=[0,4/60,40/60]; // game hours per real second (4 game min/s → day = 6 min)
const AMB=[[-1,[0.12,0.15,0.27]],[-0.3,[0.13,0.16,0.28]],[-0.12,[0.24,0.24,0.4]],[-0.03,[0.5,0.4,0.5]],[0.04,[0.86,0.6,0.48]],[0.14,[1,0.84,0.7]],[0.3,[1,0.97,0.93]],[0.5,[1,1,1]],[1,[1,1,1]]];
const CLC=[[-1,[48,56,80]],[-0.12,[86,82,112]],[-0.03,[214,142,140]],[0.06,[255,186,150]],[0.2,[255,240,228]],[0.4,[255,255,255]],[1,[255,255,255]]];
function keyf(K,x){if(x<=K[0][0])return K[0][1].slice();for(let i=1;i<K.length;i++){if(x<=K[i][0]){const t=(x-K[i-1][0])/(K[i][0]-K[i-1][0]),a=K[i-1][1],b=K[i][1];return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]}}return K[K.length-1][1].slice()}
const sunEl=h=>M.sin((h-6)/12*PI);
const isNight=()=>sunEl(tod)<0;
const WX=[{n:'☀️ Ясно',cover:0.12},{n:'⛅ Переменная облачность',cover:0.45},{n:'☁️ Пасмурно',cover:1,dim:0.8,cd:0.78},{n:'🌧️ Дождь',cover:1,dim:0.7,cd:0.6,rain:1},
  {n:'⛈️ Гроза',cover:1,dim:0.58,cd:0.46,rain:1.7,storm:1},{n:'🌨️ Снегопад',cover:1,dim:0.84,cd:0.86,snow:1},{n:'🌫️ Туман',cover:0.3,dim:0.88,cd:0.9,fog:1}];
let wxi=clamp(hv(/,w(\d)/,1)|0,0,WX.length-1);
const wcur={cover:0.45,dim:1,cd:1,rain:0,snow:0,fog:0,storm:0};{const w=WX[wxi];for(const k in wcur)wcur[k]=w[k]!==undefined?w[k]:(k==='dim'||k==='cd'?1:0)}
function updWeather(dt){const w=WX[wxi],k=1-M.exp(-dt*0.9);for(const q in wcur){const t=w[q]!==undefined?w[q]:(q==='dim'||q==='cd'?1:0);wcur[q]+=(t-wcur[q])*k}}
// derived lighting state, recomputed every frame
const LG={el:0,amb:[1,1,1],day:1,night:0,lights:0,cloud:[255,255,255]};
function updLight(){const el=sunEl(tod);LG.el=el;const a=keyf(AMB,el);const dim=wcur.dim;const lum=(a[0]+a[1]+a[2])/3;const ds=(1-dim)*1.6;
  for(let i=0;i<3;i++){a[i]=lerp(a[i],lum,clamp(ds,0,0.8))*dim}if(wcur.rain>0.01){a[0]*=1-0.08*wcur.rain;a[1]*=1-0.06*wcur.rain;a[2]*=1-0.02*wcur.rain}
  LG.amb=a;LG.day=smooth(-0.08,0.25,el);LG.night=smooth(0.05+0.12*(1-dim),-0.14,el);
  const late=tod<6?smooth(0.5,2.5,tod)*smooth(5.6,4,tod):0;LG.lights=LG.night*(1-0.28*late)*(1-0.35*wcur.fog);
  const c=keyf(CLC,el);const cd=wcur.cd;LG.cloud=[c[0]*cd,c[1]*cd,c[2]*cd]}
let flash=0,nextBolt=4;
function setTod(h){tod=((h%24)+24)%24}
function setSpeed(i){tSpeed=i}

// ------------------------------------------------------------ water mask
// the ripple layers are full-screen pattern fills; they are clipped to screen cells that actually contain water
// (sea, lakes or a river), found from the terrain on a 12 x 8 grid and cached while the camera stays put
let WCLIP=null,wcKey='';
function waterClip(){const GX=12,GY=8,key=M.round(cam.x/(cam.m*VW/GX/4))+','+M.round(cam.y/(cam.m*VH/GY/4))+','+M.round(M.log(cam.m)*20)+','+VW+','+VH;if(key===wcKey)return !!WCLIP;wcKey=key;
  const cw=VW/GX,ch=VH/GY,mg=M.hypot(cw,ch)*0.5*cam.m*1.6e-4;const P=[];let n=0;
  for(let j=0;j<GY;j++)for(let i=0;i<GX;i++){let wet=false;for(const [a,b] of [[0.5,0.5],[0.1,0.1],[0.9,0.1],[0.1,0.9],[0.9,0.9]]){const x=cam.x+((i+a)*cw-VW/2)*cam.m,y=cam.y+((j+b)*ch-VH/2)*cam.m;
      if(x<0||y<0||x>WORLD||y>WORLD||W.baseH(x,y,4)<0.03||W.landE(x,y,mg)<0){wet=true;break}}
    if(wet){const l=P[P.length-1];if(l&&l[4]===j&&l[5]===i-1){l[2]+=cw;l[5]=i}else P.push([i*cw,j*ch,cw,ch,j,i]);n++}}
  WCLIP=n?P:null;return n>0}
// ------------------------------------------------------------ rendering helpers
let T=0;
const sxw=x=>(x-cam.x)/cam.m+VW/2,syw=y=>(y-cam.y)/cam.m+VH/2;
let vx0,vy0,vx1,vy1;
function inView(x,y,r){return x>vx0-r&&x<vx1+r&&y>vy0-r&&y<vy1+r}
function setRot(x,y,hx,hy,k){ctx.setTransform(DPR*k*hx,DPR*k*hy,-DPR*k*hy,DPR*k*hx,DPR*x,DPR*y)}
// tiles at most at 1.5 device px per tile px; the 'high' quality (DPR 2) gets tiles at 2 — sharp, not stretched
const TDPR=M.min(DPR,VQ.dpr>=2?2:1.5);
function tileZ(){const md=cam.m/TDPR;let z=M.ceil(M.log2(WORLD/(256*md))-0.25);return clamp(z,0,12)}
function tileZAt(m){const md=m/TDPR;return clamp(M.ceil(M.log2(WORLD/(256*md))-0.25),0,12)}
// stage 5.12: the goal of a flight (flyTo) or of a wheel zoom — its tiles are rendered first, so the view is sharp on arrival
function camGoal(){if(fly)return [fly.x1,fly.y1,M.exp(fly.l1),-5e5];if(zoomT){const wx=cam.x+(zoomT.sx-VW/2)*cam.m,wy=cam.y+(zoomT.sy-VH/2)*cam.m;return [wx-(zoomT.sx-VW/2)*zoomT.m,wy-(zoomT.sy-VH/2)*zoomT.m,zoomT.m,-50]}return null}
function preRect(zt,cx,cy,m,p,L){const nt=1<<zt,tt=WORLD/nt,hw=VW/2*m,hh=VH/2*m;for(let y=M.max(0,M.floor((cy-hh)/tt));y<=M.min(nt-1,M.floor((cy+hh)/tt));y++)for(let x=M.max(0,M.floor((cx-hw)/tt));x<=M.min(nt-1,M.floor((cx+hw)/tt));x++){const d=M.hypot((x+0.5)*tt-cx,(y+0.5)*tt-cy)/tt;if(L)requestL(zt,x,y,p+d,L);else request(zt,x,y,p+d)}}
function tileRect(tx,ty,ts){return [M.round(((tx*ts-cam.x)/cam.m+VW/2)*DPR),M.round((((tx+1)*ts-cam.x)/cam.m+VW/2)*DPR),M.round(((ty*ts-cam.y)/cam.m+VH/2)*DPR),M.round((((ty+1)*ts-cam.y)/cam.m+VH/2)*DPR)]}
function ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,md){for(let d=1;d<=M.min(z,md||99);d++){const ax=tx>>d,ay=ty>>d;const a=mp.get(tkey(z-d,ax,ay));if(a&&hasC(a)){a.f=frameNo;const sz=256/(1<<d);if(drawE(a,LPOOL,(tx-(ax<<d))*sz,(ty-(ay<<d))*sz,sz,sz,X0,Y0,X1-X0,Y1-Y0))return true}}return false}
// stage 5.13: a new tile fades in over its fallback (the old version of the tile or the nearest coarser one) instead of popping;
// at most 8 new tiles start per frame (their upload to the GPU is spread over frames)
const FADE=0.3;
function anc2(z,tx,ty,X0,Y0,X1,Y1){for(let d=1;d<=z;d++){const ax=tx>>d,ay=ty>>d,k=tkey(z-d,ax,ay);const a=cache.get(k)||stale.get(k);if(a&&hasC(a)){a.f=frameNo;const sz=256/(1<<d);if(drawE(a,DPOOL,(tx-(ax<<d))*sz,(ty-(ay<<d))*sz,sz,sz,X0,Y0,X1-X0,Y1-Y0))return true}}return false}
function fallback(k,z,tx,ty,X0,Y0,X1,Y1){const st=stale.get(k);if(st&&hasC(st)){st.f=frameNo;if(drawE(st,DPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0))return true}return anc2(z,tx,ty,X0,Y0,X1,Y1)}
function drawTiles(){
  const z=tileZ(),n=1<<z,ts=WORLD/n;
  const tx0=M.max(0,M.floor(vx0/ts)),tx1=M.min(n-1,M.floor(vx1/ts)),ty0=M.max(0,M.floor(vy0/ts)),ty1=M.min(n-1,M.floor(vy1/ts));
  queue=[];request(0,0,0,-1e9);let upN=0;
  const zf=M.max(0,z-3),nf=1<<zf,tf=WORLD/nf;for(let y=M.max(0,M.floor(vy0/tf));y<=M.min(nf-1,M.floor(vy1/tf));y++)for(let x=M.max(0,M.floor(vx0/tf));x<=M.min(nf-1,M.floor(vx1/tf));x++)request(zf,x,y,-1e6);
  ctx.setTransform(1,0,0,1,0,0);
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const k=tkey(z,tx,ty);const e=cache.get(k);
    const [X0,X1,Y0,Y1]=tileRect(tx,ty,ts);
    if(e){e.f=frameNo;if(e.t0!==undefined&&!e.up){if(upN<8){e.up=1;upN++;e.t0=T}else if(fallback(k,z,tx,ty,X0,Y0,X1,Y1))continue;else e.up=1}
      let u=e.t0===undefined?1:(T-e.t0)/FADE;if(u>=1)e.t0=undefined;else if(fallback(k,z,tx,ty,X0,Y0,X1,Y1)){u=u<0?0:u;ctx.globalAlpha=u*u*(3-2*u)}
      // stage 6: an opaque tile shown in full replaces what is under it — no blending (half the memory traffic of the pass)
      if(e.op&&ctx.globalAlpha>=1&&!DBG.blendAll)ctx.globalCompositeOperation='opaque';drawE(e,DPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;continue}
    const cxp=(tx+0.5)*ts-cam.x,cyp=(ty+0.5)*ts-cam.y;request(z,tx,ty,M.hypot(cxp,cyp)/ts);
    const st=stale.get(k);if(st){st.f=frameNo;if(drawE(st,DPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0))continue}
    anc2(z,tx,ty,X0,Y0,X1,Y1)}
  {const g=camGoal();if(g){const zt=tileZAt(g[2]);if(zt!==z)preRect(zt,g[0],g[1],g[2],g[3],0)}}
  if(z<12&&queue.length<4){const z2=z+1,n2=1<<z2,t2=WORLD/n2;const cx=M.floor(cam.x/t2),cy=M.floor(cam.y/t2);for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if(x>=0&&y>=0&&x<n2&&y<n2)request(z2,x,y,1e5)}
  return z}
// night lights: sharp layer at the current LOD + two blurred "bloom" layers from coarser LODs
// cover: every grid cell gets draws of total alpha a (an empty slot fills the gap) — the bloom rides on these draws
function lightLevel(z,a,L,prio,cover){const n=1<<z,ts=WORLD/n,mp=LCS[L];
  const tx0=M.max(0,M.floor(vx0/ts)),tx1=M.min(n-1,M.floor(vx1/ts)),ty0=M.max(0,M.floor(vy0/ts)),ty1=M.min(n-1,M.floor(vy1/ts));ctx.globalAlpha=a;
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const k=tkey(z,tx,ty);const e=mp.get(k);const [X0,X1,Y0,Y1]=tileRect(tx,ty,ts);
    let w=0;
    if(e){e.f=frameNo;let u=e.t0===undefined?1:(T-e.t0)/FADE;if(u>=1){e.t0=undefined;u=1}else{u=u<0?0:u*u*(3-2*u);const o=LST[L].get(k);ctx.globalAlpha=a*(1-u);if(o){o.f=frameNo;if(drawE(o,LPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0))w+=1-u}else if(ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2))w+=1-u}ctx.globalAlpha=a*u;if(drawE(e,LPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0))w+=u}
    else{requestL(z,tx,ty,prio+M.hypot((tx+0.5)*ts-cam.x,(ty+0.5)*ts-cam.y)/ts,L);const o=LST[L].get(k);if(o){o.f=frameNo;if(drawE(o,LPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0))w=1}else if(ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2))w=1}
    if(cover&&w<0.999){ctx.globalAlpha=a*(1-w);ctx.tile(LPOOL,EMPTY,0,0,256,256,X0,Y0,X1-X0,Y1-Y0)}ctx.globalAlpha=a}}
function drawLights(z,a){if(a<0.01)return;ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='lighter';
  const fogB=1+wcur.fog*0.9+wcur.rain*0.3;
  requestL(0,0,0,-1e9,1);
  const far=1-smooth(15,200,cam.m)*0.55;
  // stage 6: the two bloom levels (coarser LODs, already blurred in the tiles) are summed in a third-resolution buffer (stage 6: 1/3 — under the blur of these tiles) and
  // added in one pass — they carry no detail a full-resolution pass would keep; the sharp level stays full resolution
  if(DBG.bloomFull){lightLevel(M.max(0,z-2),a*(lowQ?0.7:0.45)*fogB*far,3,-2e5);if(!lowQ)lightLevel(M.max(0,z-1),a*0.42*fogB,2,-1e5)}
  else if(!DBG.bloom){const BQ=DBG.bloomHalf?2:3,bw=M.ceil(cv.width/BQ),bh=M.ceil(cv.height/BQ);BLB.resize(bw,bh);ctx.target(BLB);ctx.clear(0,0,0,0);ctx.setTransform(bw/cv.width,0,0,bh/cv.height,0,0);ctx.globalCompositeOperation='lighter';
    lightLevel(M.max(0,z-2),a*(lowQ?0.7:0.45)*fogB*far,3,-2e5);if(!lowQ)lightLevel(M.max(0,z-1),a*0.42*fogB,2,-1e5);
    ctx.target(null);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='lighter';
    // the bloom is added by the draws of the sharp level (one pass; the grid covers the screen) — or alone where the world
    // does not cover the screen
    const a1=a*(1-wcur.fog*0.3);if(inWorldNow()&&!DBG.L1&&a1>0.001){ctx.tileOverlay(BLB,bw,bh,0,0,cv.width,cv.height,true,1/a1);lightLevel(z,a1,1,0.3,true);ctx.tileOverlay(null);bloomDone=true}
    else ctx.drawImage(BLB,0,0,bw,bh,0,0,cv.width,cv.height)}
  ctx.setTransform(1,0,0,1,0,0);if(!DBG.L1&&!bloomDone)lightLevel(z,a*(1-wcur.fog*0.3),1,0.3);bloomDone=false;
  {const g=camGoal();if(g){const zt=tileZAt(g[2]);if(zt!==z){preRect(M.max(0,zt-2),g[0],g[1],g[2],g[3],3);if(!lowQ)preRect(M.max(0,zt-1),g[0],g[1],g[2],g[3]+20,2);preRect(zt,g[0],g[1],g[2],g[3]+40,1)}}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}

// traffic -------------------------------------------------------------------------
const LANES={0:[[3.6,1,27,52],[7.1,1,31,64],[10.6,1,23,85],[-3.6,-1,27,52],[-7.1,-1,31,64],[-10.6,-1,23,85]],1:[[2.6,1,21,130],[-2.6,-1,21,130]],
  2:[[2.6,1,13,58],[6.2,1,15,72],[-2.6,-1,13,58],[-6.2,-1,15,72]],3:[[2.3,1,10,95],[-2.3,-1,10,95]],4:[[1.4,1,9,380],[-1.4,-1,9,380]],
  6:[[0,1,15,110]],7:[[5.6,1,13,60],[9.2,1,15,75],[-5.6,-1,13,60],[-9.2,-1,15,75]]};
const DOTC=['#eee','#ccc','#333','#a22','#36c','#888','#454','#eb3'],DOTS=[[],[],[],[],[],[],[],[],[],[]];
function hsh(a,b,c){return W.hh(a,b,c)/4294967296}
let carCount=0;const CB=new Float32Array(5*40000);let cbn=0;
const DENS=MODE==='game'?2.6:1; // the game shows lighter traffic (and none on streets that are not built yet)
function drawTraffic(roads){const m=cam.m,k=1/m,dots=m>1.5;carCount=0;cbn=0;
  for(const a of DOTS)a.length=0;
  for(const r of roads){const LN=LANES[r.k];if(!LN)continue;const iv=[];
    for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],bx=r.pts[i*2+2],by=r.pts[i*2+3];if(M.max(ax,bx)<vx0-30||M.min(ax,bx)>vx1+30||M.max(ay,by)<vy0-30||M.min(ay,by)>vy1+30)continue;
      const a=r.cum[i],b=r.cum[i+1];if(iv.length&&iv[iv.length-1][1]>=a-1)iv[iv.length-1][1]=b;else iv.push([a,b])}
    if(!iv.length)continue;
    for(let li=0;li<LN.length;li++){const [off,dir,v0,sp0]=LN[li];const v=v0*(0.9+hsh(r.id,li,3)*0.2);const K=M.max(1,M.round(r.L/(sp0*DENS))),sp=r.L/K;const base=((T*v+hsh(r.id,li,7)*r.L)%r.L);
      for(const [a0,b0] of iv){const a=dir>0?a0:r.L-b0,b=dir>0?b0:r.L-a0;const k0=M.ceil((a-base-sp*0.45)/sp),k1=M.floor((b-base)/sp);
        for(let q=k0;q<=k1;q++){const kk=((q%K)+K)%K;const hq=W.hh(r.id,li*7919+kk,11);if((hq&7)===0)continue;const j=((hq>>>3)&255)/255*sp*0.45;let s=q*sp+base+j;if(s<a||s>b)continue;
          const sd=dir>0?s:r.L-s;const p=W.posAt(r,sd);let hx=p[2]*dir,hy=p[3]*dir;const x=p[0]-p[3]*off,y=p[1]+p[2]*off;const X=sxw(x),Y=syw(y);
          if(X<-30||Y<-30||X>VW+30||Y>VH+30)continue;carCount++;
          const ty=(hq>>>12)&31;const truck=(r.k===0&&(li%3===2?ty<18:ty<3))||(r.k===1&&ty<5);const bus=!truck&&r.k===2&&ty<2;
          if(cbn<40000){const o=cbn*5;CB[o]=X;CB[o+1]=Y;CB[o+2]=hx;CB[o+3]=hy;CB[o+4]=truck?8.5:bus?6.25:2.5;cbn++}
          if(dots){const ci=truck?8:bus?9:(hq>>>17)&7;DOTS[ci].push(X,Y,M.max(1.2,(truck?9:4.5)*k));continue}
          // the footprint shadow along the sun (one light direction for everything), then the vehicle
          {const so=truck||bus?0.55:0.27;setRot(X+W.SUNX*so*k,Y+W.SUNY*so*k,hx,hy,k);if(truck)ctx.drawImage(S.truckSh,-8.5,-2.1,17,4.25);else if(bus)ctx.drawImage(S.busSh,-6.25,-1.5,12.5,3);else ctx.drawImage(S.carSh,-2.5,-1.25,5,2.5)}
          setRot(X,Y,hx,hy,k);
          if(truck){ctx.drawImage(S.truck[(hq>>>17)%5],-8.5,-2.1,17,4.25)}else if(bus){ctx.drawImage(S.bus,-6.25,-1.5,12.5,3)}else ctx.drawImage((k>7?S.car:S.carLo)[(hq>>>17)%S.car.length],-2.5,-1.25,5,2.5)}}}
    if(r.tram&&!dots){const nT=M.max(1,M.round(r.L/450));for(const dir of [1,-1]){for(let q=0;q<nT;q++){const v=9;const s=((T*v+hsh(r.id,q,dir>0?31:32)*r.L+q*r.L/nT)%r.L);const sd=dir>0?s:r.L-s;const p=W.posAt(r,sd);
        const x=p[0]-p[3]*1.75*dir,y=p[1]+p[2]*1.75*dir;const X=sxw(x),Y=syw(y);if(X<-40||Y<-40||X>VW+40||Y>VH+40)continue;setRot(X,Y,p[2]*dir,p[3]*dir,k);ctx.drawImage(TRAM,-15.5,-1.5,31,3);if(cbn<40000){const o=cbn*5;CB[o]=X;CB[o+1]=Y;CB[o+2]=p[2]*dir;CB[o+3]=p[3]*dir;CB[o+4]=15.5;cbn++}carCount++}}}}
  if(dots){ctx.setTransform(DPR,0,0,DPR,0,0);for(let ci=0;ci<10;ci++){const A=DOTS[ci];if(!A.length)continue;ctx.fillStyle=ci===8?'#ddd':ci===9?'#e8c040':DOTC[ci];for(let i=0;i<A.length;i+=3){const sz=A[i+2];ctx.fillRect(A[i]-sz/2,A[i+1]-sz/2,sz,sz)}}}}
function drawCarLights(a){if(!cbn||a<0.02)return;const m=cam.m,k=1/m;ctx.globalCompositeOperation='lighter';
  if(m>1.5){ctx.setTransform(DPR,0,0,DPR,0,0);const d=M.max(1.1,2.6*k),sz=M.max(1.3,2.2*k);
    ctx.globalAlpha=a*0.7;ctx.fillStyle='rgb(255,232,180)';for(let i=0;i<cbn;i++){const o=i*5;ctx.fillRect(CB[o]+CB[o+2]*d-sz/2,CB[o+1]+CB[o+3]*d-sz/2,sz,sz)}
    ctx.globalAlpha=a*0.6;ctx.fillStyle='rgb(255,36,24)';for(let i=0;i<cbn;i++){const o=i*5;ctx.fillRect(CB[o]-CB[o+2]*d-sz/2,CB[o+1]-CB[o+3]*d-sz/2,sz,sz)}}
  else{for(let i=0;i<cbn;i++){const o=i*5,L=CB[o+4];setRot(CB[o],CB[o+1],CB[o+2],CB[o+3],k);ctx.globalAlpha=a*0.8;ctx.drawImage(BEAM,L-0.25,-4,22,8);ctx.globalAlpha=a*0.85;ctx.drawImage(TAIL,-L-1.6,-1.6,3.2,3.2)}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
function drawTrains(roads,lp){const m=cam.m,k=1/m;if(lp)ctx.globalCompositeOperation='lighter';
  for(const r of roads){if(r.k!==5)continue;const nt=M.max(1,M.round(r.L/14000));
    for(let q=0;q<nt;q++){const h=hsh(r.id,q,21),nw=8+(h*16|0),len=nw*25.5,span=r.L-len-40;if(span<200)continue;const v=20+h*14;const pax=hsh(r.id,q,23)<0.4;
      const u=(T*v+hsh(r.id,q,22)*span*2)%(2*span);const fw=u<span;const tail=20+(fw?u:2*span-u);
      const pm=W.posAt(r,tail+len/2);if(!inView(pm[0],pm[1],len))continue;
      for(let w=0;w<nw;w++){const s=tail+(w+0.5)*25.5;const p=W.posAt(r,s);const X=sxw(p[0]),Y=syw(p[1]);if(X<-40||Y<-40||X>VW+40||Y>VH+40)continue;
        const loco=fw?w===nw-1:w===0;setRot(X,Y,p[2],p[3],k);
        if(lp){ctx.globalAlpha=lp;if(loco){if(fw)ctx.drawImage(BEAM,12,-7,90,14);else{ctx.save();ctx.scale(-1,1);ctx.drawImage(BEAM,12,-7,90,14);ctx.restore()}}
          else if(pax){ctx.drawImage(GL_W,-14,-5,28,10);ctx.fillStyle='rgba(255,226,170,0.85)';for(let wi=-10;wi<10;wi+=2.6)ctx.fillRect(wi,-1.7,1.6,3.4)}continue}
        ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(-12+1.2,-1.6+1,24.4,3.3);
        let c;if(loco)c=pax?'#b8322a':'#2c6a3c';else if(pax)c='#3e7a5a';else{const t=(hsh(r.id,q*100+w,24)*4)|0;c=['#2a2a2c','#7a4a32','#8a8a8a','#3a5a8a'][t]}
        ctx.fillStyle=c;ctx.fillRect(-12,-1.6,24,3.25);
        if(k>2){if(pax&&!loco){ctx.fillStyle='rgba(220,230,220,0.5)';ctx.fillRect(-11,-1.6,22,0.5)}else if(!loco&&c==='#2a2a2c'){ctx.fillStyle='#555';ctx.fillRect(-10,-0.9,20,1.8)}
          else if(loco){ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fillRect(-10,-1.2,18,2.4);ctx.fillStyle='#223';ctx.fillRect(fw?10:-12,-1.4,2,2.8)}}}}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
function shipPos(sh){const span=sh.L;const u=(T*sh.v+sh.ph)%(2*span);const fw=u<span,s=fw?u:2*span-u;const dx=(sh.bx-sh.ax)/span,dy=(sh.by-sh.ay)/span;return [sh.ax+dx*s,sh.ay+dy*s,fw?dx:-dx,fw?dy:-dy]}
function drawShips(lp){const m=cam.m,k=1/m;if(m>(lp?120:30))return;if(lp)ctx.globalCompositeOperation='lighter';
  for(const sh of W.ships){if(sh.city!==undefined&&W.growOf(sh.city)<0.95)continue;const [x,y,hx,hy]=shipPos(sh);if(!inView(x,y,sh.len*3))continue;const X=sxw(x),Y=syw(y);const L=sh.len;
    if(lp){ctx.setTransform(DPR,0,0,DPR,0,0);const px=L*k;ctx.globalAlpha=lp;
      if(px<6){const s=M.max(2.5,px*0.8);ctx.drawImage(GL_W,X-s,Y-s,s*2,s*2);continue}
      setRot(X,Y,hx,hy,k);ctx.globalAlpha=lp*0.5;ctx.drawImage(GL_W,-L*0.5,-L*0.16,L,L*0.32);ctx.globalAlpha=lp;const d=M.max(3,4*m);
      ctx.drawImage(GL_W,L*0.42-d/2,-d/2,d,d);ctx.drawImage(GL_W,-L*0.45-d/2,-d/2,d,d);ctx.drawImage(GL_R,L*0.1-d/2,-L*0.08-d/2,d,d);ctx.drawImage(GL_G,L*0.1-d/2,L*0.08-d/2,d,d);continue}
    setRot(X,Y,hx,hy,k);
    ctx.drawImage(WAKE,-L*3.2,-L*0.5,L*2.76,L);ctx.drawImage(BOW,L*0.3,-L*0.12,L*0.2,L*0.24);
    const sp=shipSprite(L,sh.st,sh.c,m);
    // the hull's shadow along the sun (it was painted 4 m to the hull's own starboard-aft and turned with the ship)
    setRot(sxw(x+W.SUNX*6.4),syw(y+W.SUNY*6.4),hx,hy,k);ctx.tint=SHIPSH;ctx.globalAlpha=0.35;ctx.drawImage(sp.r,sp.ox,sp.oy,sp.w,sp.h);ctx.tint=null;ctx.globalAlpha=1;
    setRot(X,Y,hx,hy,k);ctx.drawImage(sp.r,sp.ox,sp.oy,sp.w,sp.h)}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
function drawEmitters(){const m=cam.m;if(m>28)return;ctx.setTransform(DPR,0,0,DPR,0,0);const k=1/m;const px=-W.WDY,py=W.WDX;
  for(const e of W.emitters){if(!inView(e.x,e.y,e.k==='steam'?1500:700)||(e.city>=0&&W.growOf(e.city)<0.95)||W.isHid(e.zid))continue;
    const n=e.k==='steam'?16:e.k==='flare'?6:18,rate=e.k==='steam'?0.035:0.055,len=(e.k==='steam'?650:420)*e.s;
    for(let i=0;i<n;i++){const age=((T*rate+i/n+e.ph)%1);const wob=M.sin(age*5+e.ph*20+i)*age*40;
      const x=e.x+W.WDX*age*len+px*wob,y=e.y+W.WDY*age*len+py*wob;const X=sxw(x),Y=syw(y);
      let r,a,spr;if(e.k==='steam'){r=(30+age*150)*e.s;a=0.8*M.pow(1-age,1.2)*M.min(1,age*10+0.3);spr=PUFF_W}else if(e.k==='flare'){r=6+age*30;a=0.25*(1-age);spr=PUFF_D}else{r=(6+age*50)*e.s;a=0.6*(1-age)*M.min(1,age*12+0.2);spr=PUFF_G}
      const sz=r*2*k;if(sz<1||X+sz<0||Y+sz<0||X-sz>VW||Y-sz>VH)continue;ctx.globalAlpha=a;ctx.drawImage(spr,X-sz/2,Y-sz/2,sz,sz)}}ctx.globalAlpha=1}
function drawFlares(nl){const m=cam.m;if(m>(nl>0.05?200:28))return;ctx.setTransform(DPR,0,0,DPR,0,0);const k=1/m;ctx.globalCompositeOperation='lighter';
  for(const e of W.emitters){if(e.k!=='flare'||!inView(e.x,e.y,700)||(e.city>=0&&W.growOf(e.city)<0.95)||W.isHid(e.zid))continue;const X=sxw(e.x),Y=syw(e.y);const f=1+0.25*M.sin(T*13+e.ph*50)+0.15*M.sin(T*31+e.ph*9);
    if(nl>0.02){const g=M.max(6,520*f*k);ctx.globalAlpha=nl*0.42;ctx.drawImage(GL_S,X-g/2,Y-g/2,g,g)}
    if(m>28)continue;const sz=M.max(4,26*f*k);ctx.globalAlpha=0.85;ctx.drawImage(FLAME,X-sz/2+3*k,Y-sz/2-2*k,sz,sz);ctx.globalAlpha=0.9;const s2=sz*0.45;ctx.drawImage(FLAME2,X-s2/2,Y-s2/2,s2,s2)}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1}
function drawTurbines(lp){const m=cam.m;if(m>(lp?60:12))return;const k=1/m;ctx.setTransform(DPR,0,0,DPR,0,0);const ux=-W.WDY,uy=W.WDX;
  const on=(T%2.4)<1.0;if(lp&&!on)return;if(lp)ctx.globalCompositeOperation='lighter';
  for(const f of W.farms){if(!inView((f.bb[0]+f.bb[2])/2,(f.bb[1]+f.bb[3])/2,2600))continue;
    for(const t of f.t){if(!inView(t.x,t.y,150))continue;const tx=t.x+W.LEANX*95,ty=t.y+W.LEANY*95;
      if(lp){const X=sxw(tx),Y=syw(ty),d=M.max(4,9*k);ctx.globalAlpha=lp;ctx.drawImage(GL_R,X-d/2,Y-d/2,d,d);continue}
      const th=T*t.sp+t.ph;const hx=t.x+W.SUNX*95,hy=t.y+W.SUNY*95;
      ctx.fillStyle=`rgba(10,20,30,${0.32*LG.day})`;let lw=M.max(1,2.4*k);
      for(let b=0;b<3;b++){const a=th+b*TAU/3;const c=M.cos(a)*55,s=M.sin(a)*55;ctx.line(sxw(hx),syw(hy),sxw(hx+ux*c+W.SUNX*s),syw(hy+uy*c+W.SUNY*s),lw)}
      ctx.fillStyle='#e4e4e0';ctx.line(sxw(t.x),syw(t.y),sxw(tx),syw(ty),M.max(1,3*k));
      ctx.fillStyle='#f2f2f0';lw=M.max(1,2.2*k);const X=sxw(tx),Y=syw(ty);
      for(let b=0;b<3;b++){const a=th+b*TAU/3;const c=M.cos(a)*55,sn=M.sin(a)*55;ctx.line(X,Y,sxw(tx+ux*c-W.WDX*2+W.LEANX*sn),syw(ty+uy*c-W.WDY*2+W.LEANY*sn),lw)}
      ctx.fillStyle='#dcdcd8';ctx.save();ctx.translate(X,Y);ctx.rotate(M.atan2(W.WDY,W.WDX));ctx.fillRect(-2*k,-1.6*k,9*k,3.2*k);ctx.restore()}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
// height and parallax: src/parallax.js
function camH(){return Parallax.camH(cam,VH)}
const PJ=[0,0,0];
const FLB=[];
// GFL: flights of the game (stage 5.11) — one trip each; the game sets f.s (metres flown) every frame
const GFL=[];
function drawFlights(){const H=camH();ctx.setTransform(DPR,0,0,DPR,0,0);FLB.length=0;
  for(const f of GFL.length?W.flights.concat(GFL):W.flights){if(f.city!==undefined&&(W.growOf(f.city)<0.95||(f.city2!==undefined&&W.growOf(f.city2)<0.95)))continue;let s;
    if(f.s!==undefined){s=f.s;if(s<0||s>f.L)continue}else{const tot=f.L+(f.kind?0:900*f.v/78);s=(T*f.v+f.ph)%tot;if(s>f.L)continue}
    let i=1;while(i<f.n-1&&f.cum[i]<s)i++;const t=(s-f.cum[i-1])/(f.cum[i]-f.cum[i-1]||1);const ax=f.pts[i*2-2],ay=f.pts[i*2-1],bx=f.pts[i*2],by=f.pts[i*2+1];
    const x=ax+(bx-ax)*t,y=ay+(by-ay)*t;let hx=bx-ax,hy=by-ay;const hl=M.hypot(hx,hy)||1;hx/=hl;hy/=hl;
    let alt=f.alt;if(!f.kind){const td=f.cum[4]+300;alt=clamp(M.min((s-(f.lift||1900))*0.11,(td-s)*0.055),0,f.alt)}
    const [sx,sy]=Parallax.shadow(x,y,alt);
    if(LG.day>0.05&&inView(sx,sy,200)&&cam.m<60){const X=sxw(sx),Y=syw(sy),sz=64/cam.m;if(sz>1.5){ctx.globalAlpha=0.28*LG.day*(1-wcur.cover*0.5);ctx.save();ctx.translate(X,Y);ctx.rotate(M.atan2(hy,hx));ctx.tint=BLK;ctx.drawImage(PLANES[f.c],-sz/2,-sz/2,sz,sz);ctx.restore();ctx.globalAlpha=1}}
    if(!Parallax.inFront(H,alt))continue;Parallax.project(cam,VW,VH,x,y,alt,PJ);const kk=PJ[2],X=PJ[0],Y=PJ[1];if(X<-200||Y<-200||X>VW+200||Y>VH+200)continue;
    const sz=64/cam.m*kk*(f.kind?1.1:1);FLB.push([X,Y,hx,hy,sz,alt,f]);
    if(f.kind&&sz>0.3){const L=9000/cam.m*kk;const ca=0.75*(0.35+0.65*LG.day);const lw=M.max(1,14/cam.m*kk);CTR[3]=ca;
      for(const o of [-1,1])ctx.lineImg(GRADX,X-hx*sz*0.3-hy*o*sz*0.12,Y-hy*sz*0.3+hx*o*sz*0.12,X-hx*L-hy*o*sz*0.5,Y-hy*L+hx*o*sz*0.5,lw,CTR)}
    if(sz<2){if(sz>0.4){ctx.fillStyle='#fff';ctx.fillRect(X-1,Y-1,2,2)}continue}
    ctx.save();ctx.translate(X,Y);ctx.rotate(M.atan2(hy,hx));ctx.drawImage(PLANES[f.c],-sz/2,-sz/2,sz,sz);
    if(sz>10&&LG.night<0.3){const bl=(T*1.3+f.ph)%1<0.08;if(bl){const r=M.max(1.5,sz*0.02);disc(-sz*0.07,-sz*0.42,r,NAVR);disc(-sz*0.07,sz*0.42,r,NAVG)}}ctx.restore()}}
const SHIPSH=[0,10/255,20/255,1],CTR=[1,1,1,1],NAVR=[1,60/255,60/255,0.95],NAVG=[80/255,1,120/255,0.95];
// a filled circle (Canvas arc + fill) of colour c = [r, g, b, a]
function disc(x,y,r,c){const t=ctx.tint,a=ctx.globalAlpha;ctx.tint=c;ctx.globalAlpha=a*c[3];ctx.drawImage(DISC,x-r*16/15,y-r*16/15,r*32/15,r*32/15);ctx.tint=t;ctx.globalAlpha=a}
function drawFlightLights(a){if(a<0.02||!FLB.length)return;ctx.globalCompositeOperation='lighter';
  for(const [X,Y,hx,hy,sz,alt,f] of FLB){const strobe=(T*1.1+f.ph)%1<0.07;const d=M.max(4,sz*0.12);
    ctx.setTransform(DPR*hx,DPR*hy,-DPR*hy,DPR*hx,DPR*X,DPR*Y);ctx.globalAlpha=a;
    if(!f.kind&&alt<1200&&sz>3){ctx.globalAlpha=a*0.8*smooth(1200,300,alt);ctx.drawImage(BEAM,sz*0.45,-sz*0.35,sz*4,sz*0.7);ctx.globalAlpha=a}
    ctx.drawImage(GL_R,-sz*0.07-d/2,-sz*0.43-d/2,d,d);ctx.drawImage(GL_G,-sz*0.07-d/2,sz*0.43-d/2,d,d);ctx.drawImage(GL_W,-sz*0.5-d/2,-d/2,d,d);
    if(strobe){const e=d*2.6;ctx.drawImage(GL_B,-sz*0.07-e/2,-sz*0.43-e/2,e,e);ctx.drawImage(GL_B,-sz*0.07-e/2,sz*0.43-e/2,e,e)}
    if((T*0.9+f.ph)%1<0.12){const e=d*1.6;ctx.drawImage(GL_R,-e/2,-e/2,e,e)}}
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
// clouds and their shadows (stage 5.9): full resolution again (as before 5.3 — the quarter-size layer lost the look) and
// every cloud is drawn. The cost was the number of sprites, not their size: from high up hundreds of clouds are in view.
// So each pass is drawn into its own full-size layer and that layer is only redrawn when the picture would change —
// the camera moved (by a third of a pixel), the wind drifted the clouds by a third of a pixel, the cover, the daylight
// or the tint changed. A still camera blits one image per pass.
const CLL=[{c:ctx.layer(4,4),key:'',cx:0,cy:0},{c:ctx.layer(4,4),key:'',cx:0,cy:0}];
const BLB=ctx.layer(4,4); // half-resolution bloom buffer of the night lights
// ------------------------------------------------------------ light sources (src/lights.js)
const LIGHTS=LightSystem({cap:SMALL?128:256}),LMB=ctx.layer(4,4),LV=[],LN=[];
// the pool of a light on the ground: (1 - d²)² falloff; the glow of its head: a bright core in a soft halo
const POOL=(()=>{const N=128,c=mk(N,N),x=c.getContext('2d'),id=x.createImageData(N,N),d=id.data;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=(i+0.5)/N*2-1,v=(j+0.5)/N*2-1,r=u*u+v*v;const a=r>=1?0:(1-r)*(1-r);const o=(j*N+i)*4;d[o]=d[o+1]=d[o+2]=255;d[o+3]=a*255}x.putImageData(id,0,0);return SP(c)})();
const lightHid=l=>typeof l.owner==='number'&&W.isHid(l.owner);
// the light map: ambient + the pools of the visible lights, at half resolution; the draws before the ambient point take
// their light from it (src/gl.js ambAt) — the ground, the roads, the cars and the smoke under a lamp are lit, not overlaid
function lightMap(A){if(DBG.glights||!LV.length)return false;const lw=M.ceil(cv.width/2),lh=M.ceil(cv.height/2);LMB.resize(lw,lh);
  const AM0=ctx.getAmbient(),T0=ctx.getTransform();ctx.ambient(1,1,1);ctx.target(LMB);ctx.clear(A[0],A[1],A[2],1);ctx.setTransform(DPR*lw/cv.width,0,0,DPR*lh/cv.height,0,0);ctx.globalCompositeOperation='lighter';
  for(const l of LV){if(!l.r)continue;const X=sxw(l.x),Y=syw(l.y),Rr=l.r/cam.m;if(Rr<0.6)continue;LTC[0]=l.c[0];LTC[1]=l.c[1];LTC[2]=l.c[2];ctx.tint=LTC;ctx.globalAlpha=M.min(1,l.i*l.lv*0.8);ctx.drawImage(POOL,X-Rr,Y-Rr,Rr*2,Rr*2)}
  ctx.tint=null;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.target(null);ctx.setTransform(T0[0],T0[1],T0[2],T0[3],T0[4],T0[5]);ctx.ambient(AM0[0],AM0[1],AM0[2]);ctx.lightmap(LMB);return true}
const LTC=[1,1,1,1],POLEC=[0.16,0.17,0.18,1],LHC=[1,1,1,1];
// poles: from the foot on the ground to the head at its height (the parallax camera), their shadow along the sun by day
function drawPoles(){if(cam.m>2.6||!LN.length)return;ctx.setTransform(DPR,0,0,DPR,0,0);const k=1/cam.m;
  for(const l of LN){if(l.kind==='beacon')continue;const X=sxw(l.x),Y=syw(l.y);Parallax.project(cam,VW,VH,l.x,l.y,l.h,PJ);const w=M.max(1,(l.kind==='flood'?0.5:0.25)*k*PJ[2]);
    if(LG.day>0.05){const [sx,sy]=Parallax.shadow(l.x,l.y,l.h);ctx.fillStyle=`rgba(10,20,30,${0.3*LG.day})`;ctx.line(X,Y,sxw(sx),syw(sy),w)}
    // the head: a dark housing with its lens (lit by the light map at night, the glow is added after the ambient point)
    ctx.fillStyle=POLEC;ctx.line(X,Y,PJ[0],PJ[1],w);const hs=M.max(1.6,(l.kind==='flood'?1.8:0.7)*k*PJ[2]);ctx.fillStyle='#34383e';ctx.fillRect(PJ[0]-hs/2,PJ[1]-hs/2,hs,hs);
    const ls=hs*0.5;ctx.fillStyle='#e6e0c8';ctx.fillRect(PJ[0]-ls/2,PJ[1]-ls/2,ls,ls)}}
// the glow of the burning heads (after the ambient point: emissive), at their height through the parallax camera
function drawLightHeads(){if(!LV.length)return;ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalCompositeOperation='lighter';const k=1/cam.m,nb=0.35+0.65*LG.night;
  for(const l of LV){Parallax.project(cam,VW,VH,l.x,l.y,l.h,PJ);const a=l.lv*l.i*nb;if(a<0.01)continue;LHC[0]=l.c[0];LHC[1]=l.c[1];LHC[2]=l.c[2];ctx.tint=LHC;
    const g=M.max(3,(l.kind==='flood'?7:l.kind==='beacon'?3:4.5)*k*PJ[2]);ctx.globalAlpha=a*0.55;ctx.drawImage(GL_W,PJ[0]-g,PJ[1]-g,g*2,g*2);
    const c=M.max(1.5,(l.kind==='flood'?1.4:0.8)*k*PJ[2]);ctx.globalAlpha=a;ctx.drawImage(GL_W,PJ[0]-c,PJ[1]-c,c*2,c*2)}
  ctx.tint=null;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
let bloomDone=false;const inWorldNow=()=>sxw(0)<=0&&syw(0)<=0&&sxw(WORLD)>=VW&&syw(WORLD)>=VH;
// a permanently empty slot of the light pool: cells without lights still carry the bloom (lightLevel cover)
const EMPTY=LPOOL.upload(mk(256,256));
// get: return where the layer goes ({L, sw, sh, dx, dy, dw, dh} in device px, null — nothing) instead of drawing it
function drawClouds(shadowPass,get){const H=camH();const cloudFar=1; // clouds are seen from orbit too (stage 5.5); near the cloud layer they dissolve (game)
  const span=WORLD*1.3;
  if(shadowPass&&(LG.day<0.03||cam.m<0.12))return null;
  // the layer is a margin larger than the screen: a pan (the shadows always, the clouds when seen from far above, where
  // they have no parallax) only shifts the old picture until it would show its edge
  const PAD=64,L=CLL[shadowPass?0:1],q=3/cam.m,lw=M.max(4,M.ceil((VW+PAD*2)*DPR)),lh=M.max(4,M.ceil((VH+PAD*2)*DPR));
  const fl=clamp(384/M.max(1,(L.ms||0)*DPR),0.25,1),f=M.round((CAMMV&&(L.ms||0)*DPR>96?M.max(0.25,fl*0.5):fl)*16)/16; // stage 5.12
  const flat=shadowPass||H>90000,key=[flat?'f':cam.m.toFixed(5)+'|'+M.round(T*9*q),M.round(wcur.cover*60),shadowPass?M.round(LG.day*60):cloudTint,lw,lh,LITE?1:0,f].join('|');
  const ox=(L.cx-cam.x)/cam.m,oy=(L.cy-cam.y)/cam.m;
  // stage 5.12: a flat layer is reused while the camera zooms (scaled, up to 8 %) and while the wind drifts it (shifted);
  // it is redrawn when the scale drifts further, its edge would show or the camera stops (then at the exact scale)
  let need=key!==L.key;if(!need){if(flat){const r=L.m/cam.m,X0=ox+(-PAD-VW/2)*r+VW/2+(T-L.T)*9/cam.m,Y0=oy+(-PAD-VH/2)*r+VH/2;need=M.abs(M.log(r))>(CAMMV?0.08:0.002)||X0>-2||Y0>-2||X0+(VW+PAD*2)*r<VW+2||Y0+(VH+PAD*2)*r<VH+2}else need=M.abs(ox)>0.34||M.abs(oy)>0.34}
  if(need){L.key=key;L.cx=cam.x;L.cy=cam.y;L.m=cam.m;L.T=T;L.c.resize(lw,lh);const x2=ctx,T0=ctx.getTransform(),A0=ctx.globalAlpha,AM0=ctx.getAmbient();ctx.ambient(1,1,1);ctx.target(L.c);ctx.clear(0,0,0,0);x2.setTransform(DPR*f,0,0,DPR*f,PAD*DPR*f,PAD*DPR*f);let n=0,ms=1e9;L.f=f;
    ctx.tint=shadowPass?CLSH:CLT;
    for(let ci=0;ci<clouds.length;ci++){const c=clouds[ci];const vis=clamp((wcur.cover-c.g)*14,0,1);if(vis<=0)continue;
      let x=((c.x+T*9+WORLD*0.15)%span+span)%span-WORLD*0.15,y=c.y;
      if(LITE&&ci%2)continue;
      if(shadowPass){const [sx,sy]=Parallax.shadow(x,y,c.alt,PJ);if(!inView(sx,sy,c.s+PAD*cam.m*2))continue;const sz=c.s/cam.m;const sa=0.2*vis*LG.day*(1-0.45*smooth(0.6,1,wcur.cover))*cloudFar;if(sa<0.02)continue;x2.globalAlpha=sa;x2.drawImage(CLS[c.v],sxw(sx)-sz/2,syw(sy)-sz/2,sz,sz);n++;if(sz<ms)ms=sz;continue}
      if(H<c.alt*1.12)continue;let a=smooth(c.alt*1.12,c.alt*2.6,H)*(MODE==='game'?smooth(c.alt*3,c.alt*6,H)*0.85:1);if(a<=0.01)continue; // game: no white-out when the camera comes down through the cloud layer
      Parallax.project(cam,VW,VH,x,y,c.alt,PJ);const X=PJ[0],Y=PJ[1],sz=c.s/cam.m*PJ[2];if(X+sz/2<-PAD||Y+sz/2<-PAD||X-sz/2>VW+PAD||Y-sz/2>VH+PAD)continue;
      const ca=a*0.95*vis*cloudFar*(MODE==='game'?smooth(VW*2.4,VW*1.3,sz):1);if(ca<0.02)continue;/* game: no screen-filling cloud sprites */x2.globalAlpha=ca;x2.drawImage(CLS[c.v],X-sz/2,Y-sz/2,sz,sz);n++;if(sz<ms)ms=sz}
    L.n=n;L.ms=ms;ctx.tint=null;ctx.target(null);ctx.setTransform(T0[0],T0[1],T0[2],T0[3],T0[4],T0[5]);ctx.globalAlpha=A0;ctx.ambient(AM0[0],AM0[1],AM0[2])}
  if(!L.n)return null;const dx=(L.cx-cam.x)/cam.m,dy=(L.cy-cam.y)/cam.m;const lf=L.f||1,r=flat?L.m/cam.m:1,X0=dx+(-PAD-VW/2)*r+VW/2+(flat?(T-L.T)*9/cam.m:0),Y0=dy+(-PAD-VH/2)*r+VH/2;
  const B=lf>=1&&!flat?{L:L.c,sw:lw,sh:lh,dx:M.round(X0*DPR),dy:M.round(Y0*DPR),dw:lw,dh:lh}:{L:L.c,sw:lw*lf,sh:lh*lf,dx:X0*DPR,dy:Y0*DPR,dw:lw*r,dh:lh*r};if(get)return B;
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.drawImage(B.L,0,0,B.sw,B.sh,B.dx,B.dy,B.dw,B.dh);ctx.setTransform(DPR,0,0,DPR,0,0);return B}
// does a layer placement cover the whole canvas?
const covers=B=>B&&B.dx<=0.5&&B.dy<=0.5&&B.dx+B.dw>=cv.width-0.5&&B.dy+B.dh>=cv.height-0.5;
function drawFog(){const f=wcur.fog;if(f<0.01)return;ctx.setTransform(DPR,0,0,DPR,0,0);
  for(let l=0;l<2;l++){const P=l?1700:5200,sc=P/256/cam.m;const ox=VW/2-(cam.x-T*(l?9:5))/cam.m,oy=VH/2-(cam.y+T*(l?3:-2))/cam.m;
    ctx.globalAlpha=f*(l?0.42:0.6);ctx.pattern(FOG,[sc,0,0,sc,ox+l*91,oy+l*57],[[0,0,VW,VH]])}
  ctx.globalAlpha=f*0.3;ctx.fillStyle='rgb(226,230,234)';ctx.fillRect(0,0,VW,VH);ctx.globalAlpha=1}
// precipitation in a camera-relative volume: particles fall from the lens toward the ground
const PR=[];let pcx=0,pcy=0;
function spawnP(p,top){p.q=top?0.06+M.random()*0.12:0.06+M.random()*0.94;const X=M.random()*VW*1.1-VW*0.05,Y=M.random()*VH*1.1-VH*0.05;p.dx=(X-VW/2)*cam.m*p.q;p.dy=(Y-VH/2)*cam.m*p.q;p.w=M.random()*TAU}
function drawPrecip(dt){const rain=wcur.rain,snow=wcur.snow,H=camH();const vis=smooth(14000,3000,H);const amt=M.max(rain,snow*1.1);
  const dx=cam.x-pcx,dy=cam.y-pcy;pcx=cam.x;pcy=cam.y;if(vis<=0.01||amt<0.02){PR.length=0;return}
  const want=M.min(2600,M.round(amt*VW*VH/(snow>rain?900:800)*vis));while(PR.length<want){const p={};spawnP(p,false);PR.push(p)}if(PR.length>want)PR.length=want;
  ctx.setTransform(DPR,0,0,DPR,0,0);const m=cam.m,A=LG.amb;const br=M.max(0.35,(A[0]+A[1]+A[2])/3);
  const isSnow=snow>rain;const vq=isSnow?0.16:1.25;const wx=(isSnow?26:70)*m,wy=(isSnow?10:24)*m;
  if(!isSnow){ctx.fillStyle=`rgba(${200*br|0},${214*br|0},${235*br|0},${0.34*vis})`}
  for(const p of PR){p.dx-=dx;p.dy-=dy;const q0=p.q;p.q+=vq*dt*(0.6+0.4*p.q);p.dx+=wx*dt*p.q;p.dy+=wy*dt*p.q;
    if(isSnow){p.w+=dt*1.8;p.dx+=M.sin(p.w)*m*p.q*14*dt}
    const X=VW/2+p.dx/(m*p.q),Y=VH/2+p.dy/(m*p.q);if(p.q>=1||X<-60||Y<-60||X>VW+60||Y>VH+60){spawnP(p,p.q>=1);continue}
    if(isSnow){const s=clamp(1.6/p.q,1.2,9);ctx.globalAlpha=vis*clamp(0.95-p.q*0.5,0.3,0.9)*br;ctx.drawImage(FLAKE,X-s/2,Y-s/2,s,s)}
    else{const qb=p.q*0.93;const X0=VW/2+(p.dx-wx*0.03*p.q)/(m*qb),Y0=VH/2+(p.dy-wy*0.03*p.q)/(m*qb);ctx.line(X0,Y0,X,Y,1)}}
  ctx.globalAlpha=1}
const ZDYN={ref2:'НПЗ',farm:'Колхоз',ind:'Завод товаров',pow:'ТЭЦ',saw:'Лесопилка',oil:'Нефтевышка',ref:'НПЗ',port:'Порт',mil:'Военная часть',sam:'ПВО',
  sol2:'Солнечные панели',mine:'Рудник',gasw:'Газовая скважина',rst:'Вокзал',dport:'Дронопорт',dramp:'Пусковая рампа',drwy:'ВПП',dstore:'Склад БПЛА',dfab:'Цех БПЛА',air2:'Аэропорт'};
const ZNAME={air2:'Аэропорт',ref2:'НПЗ',saw:'Лесопилка',oil:'Нефтевышка',sam:'ПВО',mil:'Военная база',air:'Аэропорт',ref:'НПЗ',pow:'ТЭЦ',port:'Порт',ind:'Промзона',solar:'Солнечная электростанция',agro:'Тепличный комбинат',farm:'Ферма',dacha:'СНТ',cem:'Кладбище',quarry:'Карьер',gas:'АЗС',stn:'Вокзал',sol2:'Солнечные панели',mine:'Рудник',gasw:'Газовая скважина',rst:'Вокзал',dport:'Дронопорт',dramp:'Пусковая рампа',drwy:'ВПП',dstore:'Склад БПЛА',dfab:'Цех БПЛА'};
const ZLIM={mil:12,gas:2.5,farm:5,cem:5,dacha:6,stn:5,sol2:2.5,dramp:2,gasw:4,dstore:4,drwy:5};
function drawLabels(){const ctx=octx;ctx.setTransform(DPR,0,0,DPR,0,0);const m=cam.m;const boxes=[];ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  const lim=[9,32,95,380],fs=[11,12.5,15,19];const nl=LG.night;
  for(const c of W.cities){if(m>lim[c.type])continue;const X=sxw(c.x),Y=syw(c.y);if(X<-100||Y<-30||X>VW+100||Y>VH+30||(HK.seen&&!HK.seen(c.x,c.y)))continue;
    const a=M.min(1,(lim[c.type]-m)/(lim[c.type]*0.3))*(m<0.6?0.55:1);ctx.font=`${c.type>=2?600:500} ${fs[c.type]}px Rubik,system-ui,Segoe UI,Roboto,sans-serif`;const w=c._lw||(c._lw=ctx.measureText(c.name).width+8),h=fs[c.type]+4;
    let hit=false;for(const b of boxes){if(M.abs(b[0]-X)<(b[2]+w)/2&&M.abs(b[1]-Y)<(b[3]+h)/2){hit=true;break}}if(hit)continue;boxes.push([X,Y,w,h]);
    ctx.globalAlpha=a*(1-nl*0.15);ctx.strokeStyle='rgba(10,20,30,0.75)';ctx.lineWidth=3.5;ctx.strokeText(c.name,X,Y);ctx.fillStyle=c.type===3?'#fff6dc':'#ffffff';ctx.fillText(c.name,X,Y)}
  if(m<12){ctx.font='500 11px Rubik,system-ui,sans-serif';for(const z of W.zones){const lim=ZLIM[z.zk]||9;if(m>lim||!zoneOn(z))continue;const X=sxw(z.x),Y=syw(z.y);if(X<-80||Y<-20||X>VW+80||Y>VH+20)continue;const t=(z.dyn&&ZDYN[z.zk])||ZNAME[z.zk];ctx.globalAlpha=M.min(1,(lim-m)/(lim/3))*0.9;
    ctx.strokeStyle='rgba(10,20,30,0.7)';ctx.lineWidth=3;ctx.strokeText(t,X,Y);ctx.fillStyle='#ffe9a8';ctx.fillText(t,X,Y)}}
  ctx.globalAlpha=1}

// ------------------------------------------------------------ inspector
let sel=null;
const BPOP=[0,3200,950,1700,60,0,0,0,0,0,40,0,180,45,0,0,0,0,300,0,0,200,1500,0];
function cityStats(c){if(c._st)return c._st;let pop=0,area=0;const cnt={};
  if(c.type===0){let L=0;for(const s of c.vst)L+=s.L;const houses=M.round(L/31*2*0.84);pop=houses*3;cnt.houses=houses;area=L*90}
  else{const BD=c.D-1;for(let j=0;j<BD;j++)for(let i=0;i<BD;i++){const t=c.blocks[j*BD+i];if(!t||t===20)continue;const a=c.sp||c.pol?(f=>4*f[4]*f[5])(W.blkFrame(c,i,j)):(c.us[i+1]-c.us[i])*(c.vs[j+1]-c.vs[j]);area+=a;pop+=BPOP[t]*a/14000;cnt[t]=(cnt[t]||0)+1}}
  const zs=W.zones.filter(z=>z.city===c);const roads=[0,0,0,0,0,0];
  c._st={pop:pop<1000?M.round(pop/10)*10:pop<1e5?M.round(pop/100)*100:M.round(pop/1000)*1000,area,cnt,zs};return c._st}
const fmtN=n=>String(M.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const TN=['Деревня','Город','Крупный город','Мегаполис'];
const BTN={21:'правительственный квартал',1:'деловой центр',2:'периметральная застройка',3:'панельные микрорайоны',4:'частный сектор',5:'парки',6:'торговые центры',7:'школы',8:'гаражи',9:'стадион',10:'храмы',11:'стройки',12:'торговые улицы',13:'коттеджи',14:'больницы',15:'рынки',16:'спорткомплексы',17:'автобусные парки',18:'жилые кварталы',19:'офисы'};
function zoneInfo(z){const c={};for(const p of z.prims){const k=p.k==='cyl'?p.st:p.k;c[k]=(c[k]||0)+1}const rows=[];
  if(z.zk==='air'){const n=W.flights.filter(f=>!f.kind&&(M.hypot(f.pts[0]-z.x,f.pts[1]-z.y)<4000||M.hypot(f.pts[8]-z.x,f.pts[9]-z.y)<4000)).length;rows.push(['ВПП','3 300 × 60 м'],['Самолётов на перроне',c.plane||0],['Рейсов',n])}
  if(z.zk==='ref')rows.push(['Резервуаров',c.tank||0],['Ректификационных колонн',c.tower||0],['Газовых сфер',c.sphere||0],['Факелов',2]);
  if(z.zk==='pow')rows.push(['Градирен',c.cool||0],['Дымовых труб',c.chim||0]);
  if(z.zk==='port')rows.push(['Причалов',(c.ship||0)/2],['Судов у причалов',c.ship||0],['Кранов',c.crane||0]);
  if(z.zk==='ind')rows.push(['Корпусов',c.b||0],['Дымовых труб',c.chim||0],['Резервуаров',c.tank||0]);
  if(z.zk==='solar')rows.push(['Площадь панелей',fmtN(z.W*z.H*0.5/1e4)+' га']);
  if(z.zk==='mil'){const v=[0,0,0,0,0,0];for(const p of z.prims)if(p.k==='veh')v[p.v]++;rows.push(['Танков',v[0]],['БМП',v[1]],['БТР',v[2]],['Пусковых установок ПВО',v[3]],['Грузовиков',v[4]],['Вертолётов',v[5]])}
  if(!rows.length)rows.push(['Площадь',(z.W*z.H/1e4).toFixed(1).replace('.',',')+' га'],['Построек',c.b||0]);
  return rows}
function pick(sx,sy){const x=cam.x+(sx-VW/2)*cam.m,y=cam.y+(sy-VH/2)*cam.m;let best=null,bd=1e18;if(HK.click&&HK.click(x,y,sx,sy))return;
  for(const z of W.zones){if(!zoneOn(z))continue;const dx=x-z.x,dy=y-z.y;const lx=dx*z.ca+dy*z.sa,ly=-dx*z.sa+dy*z.ca;if(M.abs(lx)<z.W/2+20&&M.abs(ly)<z.H/2+20){best={k:'zone',o:z};bd=0;break}}
  if(!best)for(const c of W.cities){const d=M.hypot(x-c.x,y-c.y);const r=c.R*(c.type===0?1.2:1.05)+cam.m*8;if(d<r&&d/r<bd){bd=d/r;best={k:'city',o:c}}}
  if(!best){closeInsp();return}sel=best;showInsp()}
function showInsp(){const el=document.getElementById('insp'),c=document.getElementById('inspc');let h='';
  if(sel.k==='city'){const o=sel.o,st=cityStats(o);h=`<h2>${o.name}</h2><div class="k">${TN[o.type]} · ${(o.x/1000).toFixed(1)} : ${(o.y/1000).toFixed(1)} км</div><table>`;
    h+=`<tr><td>Население</td><td>≈ ${fmtN(st.pop)} чел.</td></tr><tr><td>Площадь</td><td>${(st.area/1e6).toFixed(st.area<1e6?2:1).replace('.',',')} км²</td></tr>`;
    if(o.type===0)h+=`<tr><td>Дворов</td><td>${st.cnt.houses}</td></tr><tr><td>Улиц</td><td>${o.vst.length}</td></tr>`;
    else{h+=`<tr><td>Кварталов</td><td>${o.nblocks}</td></tr>`;const top=Object.entries(st.cnt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t,n])=>`${BTN[t]} — ${n}`).join('<br>');h+=`<tr><td>Застройка</td><td>${top}</td></tr>`}
    if(st.zs.length)h+=`<tr><td>Объекты</td><td>${st.zs.map(z=>ZNAME[z.zk]).join(', ')}</td></tr>`;if(HK.inspect)h+=HK.inspect(o);h+='</table>'}
  else{const z=sel.o;h=`<h2>${ZNAME[z.zk]}</h2><div class="k">при г. ${z.city.name} · ${fmtN(z.W)} × ${fmtN(z.H)} м</div><table>`;for(const [a,b] of zoneInfo(z))h+=`<tr><td>${a}</td><td>${b}</td></tr>`;h+='</table>'}
  h+=`<div class="row"><button id="inspgo">🔎 Приблизить</button></div>`;c.innerHTML=h;el.style.display='block';
  document.getElementById('inspgo').onclick=()=>{const o=sel.o;if(sel.k==='city')flyTo(o.x,o.y,o.type===3?2.2:o.type===2?1.4:o.type===1?0.9:0.45);else flyTo(o.x,o.y,M.max(o.W,o.H)*1.3/M.min(VW,VH))}}
function closeInsp(){sel=null;document.getElementById('insp').style.display='none'}
document.getElementById('inspx').onclick=closeInsp;
function drawSel(){if(!sel)return;const ctx=octx;ctx.setTransform(DPR,0,0,DPR,0,0);const o=sel.o;ctx.strokeStyle='rgba(255,210,90,0.9)';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.lineDashOffset=-T*20;ctx.beginPath();
  if(sel.k==='city'){ctx.arc(sxw(o.x),syw(o.y),M.max(12,o.R*1.08/cam.m),0,TAU)}
  else{const w=o.W/2+30,h=o.H/2+30;for(const [u,v] of [[-w,-h],[w,-h],[w,h],[-w,h]])ctx.lineTo(sxw(o.x+u*o.ca-v*o.sa),syw(o.y+u*o.sa+v*o.ca));ctx.closePath()}
  ctx.stroke();ctx.setLineDash([])}

// ------------------------------------------------------------ main loop
const VIGC=[0,8/255,20/255],CLRC=[0,0,0,1],HZC=[0,0,0,0];
// debug switches of the frame passes (F3 profiling, tests): __world.dbg.tiles = true skips the tiles, etc.
const DBG={};
let last=performance.now(),fpsA=60,hudT=0,zNow=0,lowQ=false,qT=0,pfT=0,CAMMV=false,pcm=0;
let perfOn=false,perfEl=null,fWorst=0;const PROF={};function pf(n){const t=performance.now();PROF[n]=(PROF[n]||0)*0.97+(t-pfT)*0.03;pfT=t}
const hud={alt:document.getElementById('alt'),scale:document.getElementById('scalebar'),scaleT:document.getElementById('scalet'),pos:document.getElementById('pos'),fps:document.getElementById('fps'),load:document.getElementById('loading'),clock:null};
const mini=document.getElementById('mini'),mctx=mini.getContext('2d');
let frameErr=0;
function frame(now){if(!alive)return;const fj0=performance.now();try{frameBody(now);PROF.js=(PROF.js||0)*0.95+(performance.now()-fj0)*0.05}catch(e){if(frameErr++<3)console.error('frame:',e);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}requestAnimationFrame(frame)}
function frameBody(now){const dt=M.min(0.06,(now-last)/1000);last=now;T+=dt;frameNo++;fpsA=fpsA*0.95+(1/M.max(dt,1e-3))*0.05;if(perfOn)fWorst=M.max(fWorst,dt*1000);
  if(!todDrag&&DN)tod=(tod+(todRate!==null?todRate:SPEEDS[tSpeed])*dt)%24;if(HK.frame)hk('frame',dt);if(MODE==='bg')bgCam(dt);updWeather(dt);updLight();
  pfT=performance.now();updateCam(dt);CAMMV=!!(fly||zoomT||pinch)||M.abs(cam.m-pcm)>cam.m*1e-4;pcm=cam.m;
  vx0=cam.x-VW/2*cam.m;vy0=cam.y-VH/2*cam.m;vx1=cam.x+VW/2*cam.m;vy1=cam.y+VH/2*cam.m;
  const A=LG.amb,NL=LG.lights;
  // ambient light (dusk / night / overcast) multiplies everything drawn before the lights: as a shader uniform, which is
  // exact (compositing is linear in colour) and saves the full-screen multiply pass of stages 1–5
  const AMBON=!DBG.amb&&(A[0]<0.995||A[1]<0.995||A[2]<0.995);
  ctx.begin();ctx.gpuMark('layers');if(AMBON)ctx.ambient(A[0],A[1],A[2]);ctx.clear(14/255*(AMBON?A[0]:1),46/255*(AMBON?A[1]:1),82/255*(AMBON?A[2]:1),1);ctx.setTransform(DPR,0,0,DPR,0,0);
  // the vignette (stage 6): 'cloud' — in the pass of the cloud layer, 'spatial' — a factor of every draw (no pass of its
  // own: night, close views), 'pass' — a separate pass (the edge of the world is in view, haze or lightning)
  LIGHTS.update(dt,LG.night);LIGHTS.visible([vx0,vy0,vx1,vy1],lightHid,LV);LIGHTS.near([vx0,vy0,vx1,vy1],lightHid,LN);
  if(AMBON)lightMap(A);
  let CLB=null;if(opt.clouds&&!DBG.clouds){const c=LG.cloud;tintClouds(c[0],c[1],c[2],flash>0.05?0:0.92);CLB=drawClouds(false,true)}
  const hz=smooth(40,600,cam.m)*0.16;const wX0=sxw(0),wY0=syw(0),wX1=sxw(WORLD),wY1=syw(WORLD),inWorld=wX0<=0&&wY0<=0&&wX1>=VW&&wY1>=VH;
  const VM=DBG.vign?'off':flash>0.01?'pass':covers(CLB)&&!DBG.vigPass?'cloud':hz>0||CLB||!inWorld||DBG.vigPass?'pass':'spatial';
  if(VM==='spatial'){ctx.spatialVignette([VW/2*DPR,VH/2*DPR,vg.r0*DPR,vg.r1*DPR,VIGC[0],VIGC[1],VIGC[2],0.38]);
    // the clear colour shows through the translucent water of the tiles: there it is drawn as a quad, so it is vignetted
    if(waterClip()){ctx.fillStyle=CLRC;CLRC[0]=14/255*(AMBON?A[0]:1);CLRC[1]=46/255*(AMBON?A[1]:1);CLRC[2]=82/255*(AMBON?A[2]:1);for(const q of WCLIP)ctx.fillRect(q[0],q[1],q[2],q[3])}}
  // animated water glints (seen through translucent water in tiles)
  // world-anchored octaves: texel size 0.08*2^k m; the two octaves around the current zoom cross-fade,
  // so ripples stay glued to the water and never look like a stretched picture
  // cost: each layer is a full-screen pattern fill. In the game the ripples fade out above ~14 m/px (they cannot be seen
  // from there anyway); only the 'high' quality draws two layers per octave
  ctx.gpuMark('water');const gaW=(0.2+0.8*LG.day)*(1-wcur.cover*0.35)*(1-smooth(6,90,cam.m)*0.8)*(MODE==='game'?smooth(5,2.5,cam.m):1);
  if(!opt.noWater&&gaW>0.03&&waterClip()){const ga=gaW,NLW=VQ.dpr>=2?2:1;ctx.save();const lv=M.log2(M.max(cam.m,0.01)/0.08)+0.6,k0=M.floor(lv),fr=lv-k0;
    for(let o=0;o<2;o++){const wgt=o?fr:1-fr;if(wgt<0.03||ga*wgt<0.03||(LITE&&o!==(fr>0.5?1:0)))continue;const tm=0.08*M.pow(2,k0+o),sp=M.sqrt(tm/0.08);
      for(let l=0;l<NLW;l++){const sc=tm*(l?1.41:1)/cam.m,ang=l?0.35:0,ca=M.cos(ang)*sc,sa=M.sin(ang)*sc;const dx=W.WDX*T*(l?2.2:3.4)*sp+l*61*tm,dy=W.WDY*T*(l?2.2:3.4)*sp+l*29*tm;
        ctx.globalAlpha=(l?0.45:NLW===1?0.8:0.65)*wgt*ga;ctx.pattern(wavePat,[ca,sa,-sa,ca,(dx-cam.x)/cam.m+VW/2,(dy-cam.y)/cam.m+VH/2],WCLIP)}}ctx.globalAlpha=1;ctx.restore()}
  // the cloud shadow layer is composited over the tiles in the tile pass (stage 6): no separate full-screen pass
  const SHB=opt.clouds&&!DBG.shadows?drawClouds(true,true):null;if(SHB)ctx.tileOverlay(SHB.L,SHB.sw,SHB.sh,SHB.dx,SHB.dy,SHB.dw,SHB.dh);
  pf('water');ctx.gpuMark('tiles');ctx.vignetteAdd(true);zNow=DBG.tiles?tileZ():drawTiles();ctx.vignetteAdd(false);ctx.tileOverlay(null);pf('tiles');
  {ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='rgba(14,46,82,0.8)';const X0=sxw(0),Y0=syw(0),X1=sxw(WORLD),Y1=syw(WORLD);if(X0>0||Y0>0||X1<VW||Y1<VH){ // outside the world: four bands around it
    const a=M.max(-5,M.min(VH+5,Y0)),b=M.max(-5,M.min(VH+5,Y1));if(a>-5)ctx.fillRect(-5,-5,VW+10,a+5);if(b<VH+5)ctx.fillRect(-5,b,VW+10,VH+5-b);
    if(X0>-5)ctx.fillRect(-5,a,M.min(VW+5,X0)+5,b-a);if(X1<VW+5){const l=M.max(-5,X1);ctx.fillRect(l,a,VW+5-l,b-a)}}}
  ctx.gpuMark('sprites');pf('edge');pf('shadows');
  let rs=[];const trafficOn=opt.traffic&&cam.m<30;
  if(trafficOn){rs=cam.m<8?W.queryRoads(vx0,vy0,vx1,vy1).filter(W.roadShown):[];if(cam.m<3.2)drawTraffic(rs);else cbn=0;if(cam.m<8)drawTrains(rs,0);drawShips(0)}else cbn=0;
  pf('traffic');drawEmitters();drawTurbines(0);drawPoles();pf('emit');
  if(opt.traffic)drawFlights();else FLB.length=0;
  pf('flights');drawFog();pf('fog');
  // ambient light (dusk / night / overcast)
  ctx.gpuMark('lights');ctx.ambient(1,1,1);ctx.lightmap(null); // the ambient point: from here on (lights, precipitation, clouds) nothing is darkened
  // emissive layers
  if(NL>0.01&&!DBG.lights){drawLights(zNow,NL);if(trafficOn&&!DBG.carl){drawCarLights(NL);if(cam.m<8)drawTrains(rs,NL)}if(opt.traffic||cam.m<120)drawShips(NL);drawTurbines(NL);}
  drawFlares(NL);if(opt.traffic)drawFlightLights(LG.night);drawLightHeads();pf('lights');
  dispatch();pf('dispatch');
  pf('lights');drawPrecip(dt);
  ctx.gpuMark('clouds+vign');const merge=VM==='cloud';if(CLB){ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
    if(merge){ctx.setTransform(DPR,0,0,DPR,0,0);HZC[0]=(160*A[0]|0)/255;HZC[1]=(195*A[1]|0)/255;HZC[2]=(230*A[2]|0)/255;HZC[3]=hz>0?hz:0;ctx.drawImageVignette(CLB.L,0,0,CLB.sw,CLB.sh,CLB.dx,CLB.dy,CLB.dw,CLB.dh,VW/2,VH/2,vg.r0,vg.r1,VIGC,0.38,HZC)}
    else ctx.drawImage(CLB.L,0,0,CLB.sw,CLB.sh,CLB.dx,CLB.dy,CLB.dw,CLB.dh)}
  ctx.setTransform(DPR,0,0,DPR,0,0);
  if(hz>0&&!merge){ctx.fillStyle=`rgba(${160*A[0]|0},${195*A[1]|0},${230*A[2]|0},${hz})`;ctx.fillRect(0,0,VW,VH)}
  if(wcur.storm>0.3){nextBolt-=dt;if(nextBolt<0){flash=1;nextBolt=3+M.random()*12}}
  if(flash>0.01){const f=flash*(0.6+0.4*M.sin(T*60));ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(190,200,255,${0.3*f})`;ctx.fillRect(0,0,VW,VH);ctx.globalCompositeOperation='source-over';flash*=M.exp(-dt*7)}
  pf('clouds');if(VM==='pass')ctx.vignette(VW/2,VH/2,vg.r0,vg.r1,VIGC,0.38);ctx.spatialVignette(null);
  // the game's own GL layer (state borders): above the vignette, under the 2D overlay — where its 2D drawing used to be
  if(HK.glDraw&&!DBG.hook){ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;hk('glDraw',ctx,API);ctx.linesFlush();ctx.globalAlpha=1}ctx.end();
  // the 2D overlay: labels, the game layer, the selection
  octx.setTransform(1,0,0,1,0,0);octx.clearRect(0,0,ov.width,ov.height);
  if(opt.labels)drawLabels();pf('labels');
  if(HK.draw&&!DBG.hook){octx.setTransform(DPR,0,0,DPR,0,0);hk('draw',octx,API);octx.setTransform(DPR,0,0,DPR,0,0);octx.globalAlpha=1;octx.globalCompositeOperation='source-over'}
  pf('hook');drawSel();
  if(frameNo%30===0)evict();
  if(stale.size||LST[1].size||LST[2].size||LST[3].size){staleT+=dt;if((pending.size+LPS[1].size+LPS[2].size+LPS[3].size===0&&!queue.length&&T-lastArr>FADE+0.1)||staleT>25)dropStale()}
  // adaptive quality (hysteresis): drop the mid bloom layer when the frame rate is low
  if(LG.lights>0.05){if(!lowQ&&fpsA<22||lowQ&&fpsA>38)qT+=dt;else qT=0;if(qT>3){lowQ=!lowQ;qT=0}}
  hudT+=dt;if(hudT>0.12){hudT=0;updHUD()}
}
// stage 5.13: F3 shows where the frame time goes (to check FPS on a real machine)
function perfShow(){if(!perfEl){perfEl=document.createElement('div');perfEl.style.cssText='position:fixed;left:8px;top:64px;z-index:9999;background:rgba(0,0,0,0.75);color:#9f9;font:12px/1.4 monospace;padding:6px 9px;border-radius:6px;pointer-events:none;white-space:pre';document.body.appendChild(perfEl)}perfEl.style.display='block';const NL=String.fromCharCode(10);
  const top=Object.entries(PROF).filter(e=>e[0]!=='js').sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>e[0]+' '+e[1].toFixed(2)+' мс');
  perfEl.textContent=['FPS '+M.round(fpsA)+' · худший кадр '+fWorst.toFixed(1)+' мс','JS за кадр '+(PROF.js||0).toFixed(2)+' мс','GL: вызовов '+ctx.stats.draws+' · примитивов '+ctx.stats.inst+' · слотов '+DPOOL.used+'/'+DPOOL.slots+' + '+LPOOL.used+'/'+LPOOL.slots].concat(top,['тайлы '+cache.size+' · старые '+stale.size+' · в работе '+(pending.size+LPS[1].size+LPS[2].size+LPS[3].size)+' · очередь '+queue.length,'потоков '+workers.filter(w=>w.ready).length+(mainRender?' (CPU)':'')+' · машин '+carCount+' · LOD '+zNow]).join(NL);fWorst=0}
function fmtD(m){return m>=1000?(m/1000).toFixed(m>=10000?0:1).replace('.',',')+' км':M.round(m)+' м'}
function updHUD(){const H=camH();if(perfOn)perfShow();hud.alt.textContent=fmtD(H);
  const target=110*cam.m;const p=M.pow(10,M.floor(M.log10(target)));let L=p;for(const f of [1,2,5,10])if(f*p<=target)L=f*p;hud.scale.style.width=(L/cam.m)+'px';hud.scaleT.textContent=fmtD(L);
  hud.pos.textContent=`${(cam.x/1000).toFixed(2)} : ${(cam.y/1000).toFixed(2)} км · LOD ${zNow}`;hud.fps.textContent=`${M.round(fpsA)} FPS · тайлов ${cache.size}+${lcache.size}${mainRender?' (CPU)':' · потоков '+workers.filter(w=>w.ready).length}${carCount?' · машин '+carCount:''}`;
  const z0=cache.get(0)||stale.get(0);if(z0&&z0.b){if(!readyFired&&cache.size>4){readyFired=true;if(cfg.onReady)cfg.onReady(API)}
    mctx.setTransform(1,0,0,1,0,0);mctx.drawImage(z0.b,0,0,mini.width,mini.height);
    const A=LG.amb;if(A[0]<0.99){mctx.globalCompositeOperation='multiply';mctx.fillStyle=`rgb(${A[0]*255|0},${A[1]*255|0},${A[2]*255|0})`;mctx.fillRect(0,0,mini.width,mini.height);mctx.globalCompositeOperation='source-over'}
    const l0=lcache.get(0);if(l0&&l0.b&&LG.lights>0.02){mctx.globalCompositeOperation='lighter';mctx.globalAlpha=LG.lights;mctx.drawImage(l0.b,0,0,mini.width,mini.height);mctx.globalAlpha=1;mctx.globalCompositeOperation='source-over'}
    if(HK.mini)hk('mini',mctx,mini.width/WORLD);const s=mini.width/WORLD;mctx.strokeStyle='#ffd25a';mctx.lineWidth=1.5;
    const w=M.max(3,(vx1-vx0)*s),h=M.max(3,(vy1-vy0)*s);mctx.strokeRect(cam.x*s-w/2,cam.y*s-h/2,w,h)}}
mini.addEventListener('click',e=>{if(MODE==='bg')return;const r=mini.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*WORLD,y=(e.clientY-r.top)/r.height*WORLD;flyTo(x,y,M.min(cam.m,40))},SIG);

// stage 5: the viewer keeps no panels of its own (the old weather / search / time panel is gone); it is a dev mode for tools and tests
const todDrag=false;
let introOff=false,introT=0;
// main-menu background: a slow flight over the largest town
const bgC=W.cities.filter(c=>c.type===3).sort((a,b)=>b.R-a.R)[0]||W.cities[0];let bgA=hsh(SEED,1,1)*TAU;
function bgCam(dt){bgA+=dt*0.02;const r=bgC.R*0.5;cam.x=bgC.x+M.cos(bgA)*r;cam.y=bgC.y+M.sin(bgA*0.8)*r*0.6;cam.m=2.6+1.6*M.sin(bgA*0.55);fly=null;zoomT=null}
if(MODE==='bg')bgCam(0);
function destroy(){if(!alive)return;alive=false;AC.abort();clearInterval(lowT);clearTimeout(introT);clearTimeout(clickT);for(const w of workers)w.terminate();if(wurl)URL.revokeObjectURL(wurl);
  for(const mp of [cache,stale,LCS[1],LCS[2],LCS[3],LST[1],LST[2],LST[3]])for(const v of mp.values())if(v.b&&v.b.close)v.b.close();ctx.dispose();octx.setTransform(1,0,0,1,0,0);octx.clearRect(0,0,ov.width,ov.height);closeInsp();if(window.__world&&window.__world.W===W)window.__world=null}
const API={gl:ctx,lights:LIGHTS,gflights:GFL,get ops(){return OPS},op,W,cam,setHidden,flyTo,zoomAt,maxM,opt,LG,wcur,hover,setGrow,invalidate,setTod,setSpeed,setSeason,destroy,closeInsp,pick,
  get VW(){return VW},get VH(){return VH},get DPR(){return DPR},get T(){return T},get tod(){return tod},get fps(){return fpsA},get ready(){return readyFired},
  sxw,syw,toWorld:(sx,sy)=>[cam.x+(sx-VW/2)*cam.m,cam.y+(sy-VH/2)*cam.m],setTodRate:r=>{todRate=r},isNight,
  showCity:c=>{sel={k:'city',o:c};showInsp()},
  setWeather:i=>{wxi=i;const w=WX[i];for(const k in wcur)wcur[k]=w[k]!==undefined?w[k]:(k==='dim'||k==='cd'?1:0)},
  stats:()=>({fps:fpsA,cars:carCount,tiles:cache.size,lights:LCS[1].size+'/'+LCS[2].size+'/'+LCS[3].size,queue:queue.length,pending:pending.size+LPS[1].size+LPS[2].size+LPS[3].size,main:mainRender,lowQ,
    lights:{all:LIGHTS.size,visible:LV.length,near:LN.length},gl:{draws:ctx.stats.draws,inst:ctx.stats.inst,slots:DPOOL.used+LPOOL.used,cap:DPOOL.slots+LPOOL.slots,texMB:(DPOOL.slots+LPOOL.slots)*0.25+CLL.reduce((q,l)=>q+l.c.w*l.c.h*4/1048576,0)}}),
  stop:()=>{introOff=true;fly=null;zoomT=null}};
window.__world=Object.assign({PROF,cache,lcache,cloudLayers:CLL,gl:ctx,overlay:ov,dbg:DBG,LMB,POOLref:POOL},API);
requestAnimationFrame(frame);
// cinematic intro (viewer): dive from orbit to the largest city
if(MODE==='view'){const big=W.cities.find(c=>c.type===3)||W.cities[0];introT=setTimeout(()=>{if(!drag&&!zoomT&&!introOff)flyTo(big.x+big.R*0.12,big.y+big.R*0.08,2.4,7)},1600)}
return API;
}

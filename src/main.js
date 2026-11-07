(function(){
'use strict';
const M=Math,PI=M.PI,TAU=PI*2;
const clamp=(x,a,b)=>x<a?a:x>b?b:x, smooth=(a,b,x)=>{let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t)}, lerp=(a,b,t)=>a+(b-a)*t;
// hash: #seed[,tHH][,wN][,sN][cpu]   e.g. #20261107,t22.5,w3,s2
const HS=location.hash.slice(1);
let SEED=parseInt(HS.replace('cpu',''));if(!SEED||isNaN(SEED))SEED=20261107;
const hv=(re,d)=>{const m=HS.match(re);return m?parseFloat(m[1]):d};
const cv=document.getElementById('c'),ctx=cv.getContext('2d',{alpha:false});
let DPR=M.min(window.devicePixelRatio||1,2),VW=0,VH=0,vign=null;
function resize(){VW=innerWidth;VH=innerHeight;cv.width=M.round(VW*DPR);cv.height=M.round(VH*DPR);
  vign=ctx.createRadialGradient(VW/2,VH/2,M.min(VW,VH)*0.35,VW/2,VH/2,M.hypot(VW,VH)*0.62);vign.addColorStop(0,'rgba(0,0,0,0)');vign.addColorStop(1,'rgba(0,8,20,0.38)')}
addEventListener('resize',resize);resize();

let season=clamp(hv(/,s(\d)/,0)|0,0,2);
const W=WorldGen(SEED),WORLD=W.WORLD,S0=W.sprites();W.setSeason(season);
// main-thread copies of sprites as regular canvases (faster to draw than OffscreenCanvas sources in some browsers)
const toC=c=>{const d=document.createElement('canvas');d.width=c.width;d.height=c.height;d.getContext('2d').drawImage(c,0,0);return d};
const S={car:S0.car.map(toC),truck:S0.truck.map(toC),bus:toC(S0.bus),tree:S0.tree.map(toC)};
const opt={clouds:true,labels:true,traffic:true};

// ------------------------------------------------------------ workers / tile caches
// cache: day tiles of the current season; stale: previous season (fallback while re-rendering); lcache: night-light tiles
const cache=new Map(),pending=new Set();const LCS=[null,new Map(),new Map(),new Map()],LPS=[null,new Set(),new Set(),new Set()],lcache=LCS[1];const LHB=[0,0,2,3];let stale=new Map(),staleT=0;let frameNo=0,queue=[];
const workers=[];let mainRender=false;
const NW=M.max(2,M.min(5,(navigator.hardwareConcurrency||4)-2));
const wsrc=WorldGen.toString()+`
let G=null;
onmessage=function(e){const m=e.data;
 if(m.t==='init'){try{const t=new OffscreenCanvas(2,2).getContext('2d');if(!t)throw new Error('no2d');G=WorldGen(m.seed);G.setSeason(m.season);postMessage({t:'ready',ok:true})}catch(err){postMessage({t:'ready',ok:false,err:String(err)})}}
 else if(m.t==='season'){G.setSeason(m.s)}
 else if(m.t==='tile'){if(m.L){const c=G.renderLights(m.z,m.x,m.y,m.hb);if(!c){postMessage({t:'tile',key:m.key,L:m.L,b:null});return}const b=c.transferToImageBitmap();postMessage({t:'tile',key:m.key,L:m.L,b},[b]);return}
   const c=G.renderTile(m.z,m.x,m.y);const b=c.transferToImageBitmap();postMessage({t:'tile',key:m.key,b,s:G.season()},[b])}};`;
try{if(location.hash.indexOf('cpu')>=0)throw 0;const url=URL.createObjectURL(new Blob([wsrc],{type:'text/javascript'}));
  for(let i=0;i<NW;i++){const w=new Worker(url);w.busy=0;w.ready=false;w.dead=false;
    w.onmessage=e=>{const m=e.data;if(m.t==='ready'){if(m.ok)w.ready=true;else{w.dead=true;if(workers.every(q=>q.dead))mainRender=true}return}
      if(m.t==='tile'){w.busy--;
        if(m.L){LPS[m.L].delete(m.key);LCS[m.L].set(m.key,{b:m.b,f:frameNo});return}
        pending.delete(m.key);if(m.s!==season){if(m.b&&m.b.close)m.b.close();return}cache.set(m.key,{b:m.b,f:frameNo})}};
    w.onerror=()=>{w.dead=true;if(workers.every(q=>q.dead))mainRender=true};w.postMessage({t:'init',seed:SEED,season});workers.push(w)}}
catch(e){mainRender=true}
setTimeout(()=>{if(!workers.some(w=>w.ready))mainRender=true},4000);
const tkey=(z,x,y)=>z*16777216+y*4096+x;
function request(z,x,y,p){const k=tkey(z,x,y);if(cache.has(k)||pending.has(k))return;queue.push({k,z,x,y,p,L:0})}
function requestL(z,x,y,p,L){const k=tkey(z,x,y);if(LCS[L].has(k)||LPS[L].has(k))return;queue.push({k,z,x,y,p,L})}
function dispatch(){queue.sort((a,b)=>a.p-b.p);let qi=0;
  if(mainRender){const t0=performance.now();while(qi<queue.length&&performance.now()-t0<12){const q=queue[qi++];
      if(q.L){if(LCS[q.L].has(q.k))continue;LCS[q.L].set(q.k,{b:W.renderLights(q.z,q.x,q.y,LHB[q.L]),f:frameNo})}else{if(cache.has(q.k))continue;cache.set(q.k,{b:W.renderTile(q.z,q.x,q.y),f:frameNo})}}return}
  for(const w of workers){if(!w.ready||w.dead)continue;while(w.busy<2&&qi<queue.length){const q=queue[qi++];
      if(q.L){if(LPS[q.L].has(q.k)||LCS[q.L].has(q.k))continue;LPS[q.L].add(q.k)}else{if(pending.has(q.k)||cache.has(q.k))continue;pending.add(q.k)}
      w.busy++;w.postMessage({t:'tile',z:q.z,x:q.x,y:q.y,key:q.k,L:q.L,hb:LHB[q.L]})}}}
function evictMap(mp,hi,lo){if(mp.size<hi)return;const arr=[];for(const [k,v] of mp){if(k>=4*16777216)arr.push([k,v.f])}arr.sort((a,b)=>a[1]-b[1]);
  for(let i=0;i<arr.length&&mp.size>lo;i++){if(arr[i][1]>=frameNo-2)break;const v=mp.get(arr[i][0]);if(v.b&&v.b.close)v.b.close();mp.delete(arr[i][0])}}
function evict(){evictMap(cache,460,360);evictMap(LCS[1],320,240);evictMap(LCS[2],180,130);evictMap(LCS[3],120,90)}
function dropStale(){for(const v of stale.values())if(v.b&&v.b.close)v.b.close();stale=new Map()}
function setSeason(s){s=clamp(s|0,0,2);if(s===season)return;season=s;W.setSeason(s);for(const w of workers)if(w.ready)w.postMessage({t:'season',s});
  dropStale();stale=new Map(cache);cache.clear();pending.clear();staleT=0;
  for(const b of document.querySelectorAll('#seasons button'))b.classList.toggle('on',+b.dataset.s===s)}

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
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});drag=true;fly=null;vel.x=vel.y=0;if(ptr.size===2)pinch=null;
  downAt=ptr.size===1?{x:e.clientX,y:e.clientY,t:performance.now(),moved:0}:null});
cv.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p)return;
  if(ptr.size===1){const dx=e.clientX-p.x,dy=e.clientY-p.y;if(downAt)downAt.moved+=M.abs(dx)+M.abs(dy);cam.x-=dx*cam.m;cam.y-=dy*cam.m;const now=performance.now(),dtm=M.max(1,now-lastMove)/1000;lastMove=now;
    vel.x=-dx*cam.m/dtm*0.6+vel.x*0.4;vel.y=-dy*cam.m/dtm*0.6+vel.y*0.4;zoomT=null}
  p.x=e.clientX;p.y=e.clientY;
  if(ptr.size===2){downAt=null;const [a,b]=[...ptr.values()];const d=M.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    if(pinch){const f=pinch.d/d;const wx=cam.x+(pinch.mx-VW/2)*cam.m,wy=cam.y+(pinch.my-VH/2)*cam.m;cam.m=clamp(cam.m*f,MINM,maxM());cam.x=wx-(mx-VW/2)*cam.m;cam.y=wy-(my-VH/2)*cam.m}
    pinch={d,mx,my};vel.x=vel.y=0}});
const up=e=>{ptr.delete(e.pointerId);if(ptr.size<2)pinch=null;
  if(ptr.size===0){drag=false;if(performance.now()-lastMove>90)vel.x=vel.y=0;
    if(downAt&&downAt.moved<6&&performance.now()-downAt.t<450&&e.type==='pointerup'){vel.x=vel.y=0;const sx=e.clientX,sy=e.clientY;clickT=setTimeout(()=>pick(sx,sy),230)}downAt=null}};
let clickT=0;
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();let d=e.deltaY;if(e.deltaMode===1)d*=18;else if(e.deltaMode===2)d*=400;zoomAt(M.exp(clamp(d,-300,300)*0.0022),e.clientX,e.clientY)},{passive:false});
cv.addEventListener('dblclick',e=>{clearTimeout(clickT);zoomAt(0.35,e.clientX,e.clientY)});
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;keys[e.code]=true;
  if(e.code==='KeyN')setTod(isNight()?11:22.5);if(e.code==='KeyP')setSpeed(tSpeed?0:1);if(e.code==='Escape')closeInsp()});
addEventListener('keyup',e=>{keys[e.code]=false});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false});

// ------------------------------------------------------------ procedural assets (main thread)
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
const wavePat=(()=>{const c=mk(256,256),x=c.getContext('2d'),id=x.createImageData(256,256),d=id.data;const R=W.rng(99);const waves=[];
  for(let i=0;i<9;i++)waves.push([1+(R()*7|0),(R()*9|0)-4,R()*TAU,0.5+R()]);
  for(let j=0;j<256;j++)for(let i=0;i<256;i++){let v=0;for(const w of waves)v+=M.sin((w[0]*i+w[1]*j)/256*TAU+w[2])*w[3];v/=4;const h=M.pow(M.max(0,v),3.2);const o=(j*256+i)*4;d[o]=235;d[o+1]=245;d[o+2]=255;d[o+3]=clamp(h*255,0,255)}
  x.putImageData(id,0,0);return ctx.createPattern(c,'repeat')})();
function cloudSprite(seed){const N=256,c=mk(N,N),x=c.getContext('2d'),id=x.createImageData(N,N),d=id.data;const den=new Float32Array(N*N);const ox=seed*17.3,oy=seed*5.1;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=i/N-0.5,v=j/N-0.5;const r=M.sqrt(u*u+v*v)*2;let n=0,a=0.55,f=2.2;for(let o=0;o<5;o++){n+=a*W.noise(u*f+ox+o*3.1,v*f+oy-o*1.7);a*=0.48;f*=2.05}
    den[j*N+i]=clamp(n*1.1+0.62-r*r*1.25-r*0.2,0,1)}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,dd=den[k];const k2=M.min(N-1,j+5)*N+M.min(N-1,i+5),k3=M.max(0,j-5)*N+M.max(0,i-5);
    const lit=clamp(0.92-(den[k2]-den[k3])*1.4+dd*0.08,0.55,1.05);const o=k*4;d[o]=clamp(250*lit,0,255);d[o+1]=clamp(252*lit,0,255);d[o+2]=clamp(255*lit+6,0,255);d[o+3]=smooth(0.02,0.6,dd)*235}
  x.putImageData(id,0,0);const s=mk(N,N),sx=s.getContext('2d');sx.drawImage(c,0,0);sx.globalCompositeOperation='source-in';sx.fillStyle='#061018';sx.fillRect(0,0,N,N);return [c,s,mk(N,N)]}
const CLS=[];for(let i=0;i<6;i++)CLS.push(cloudSprite(i+SEED%100));
// cloud groups are generated for full overcast; weather "cover" decides how many are shown
const clouds=[];{const R=W.rng(SEED^0xc10d);const NG=160;const ord=[];for(let i=0;i<NG;i++)ord.push(i);for(let i=NG-1;i>0;i--){const j=(R()*(i+1))|0;[ord[i],ord[j]]=[ord[j],ord[i]]}
  for(let c=0;c<NG;c++){const cx=(R()*1.3-0.15)*WORLD,cy=(R()*1.3-0.15)*WORLD;const n=2+(R()*7|0),alt=2000+R()*1800;
  for(let k=0;k<n;k++)clouds.push({x:cx+(R()-0.5)*12000,y:cy+(R()-0.5)*8000,s:3500+R()*7000,alt:alt+(R()-0.5)*500,v:R()*6|0,g:ord[c]/NG})}}
let cloudTint='';
function tintClouds(r,g,b,mixA){const key=(r>>3)+','+(g>>3)+','+(b>>3)+','+(mixA*20|0);if(key===cloudTint)return;cloudTint=key;
  for(const c of CLS){const t=c[2],x=t.getContext('2d');x.globalCompositeOperation='copy';x.drawImage(c[0],0,0);x.globalCompositeOperation='source-atop';
    x.fillStyle=`rgba(${r|0},${g|0},${b|0},${mixA})`;x.fillRect(0,0,256,256);x.globalCompositeOperation='source-over'}}
function soft(r,g,b,a){const c=mk(64,64),x=c.getContext('2d');const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${r},${g},${b},${a})`);gr.addColorStop(0.5,`rgba(${r},${g},${b},${a*0.55})`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);x.fillStyle=gr;x.fillRect(0,0,64,64);return c}
function glow(r,g,b){const c=mk(64,64),x=c.getContext('2d');const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${r},${g},${b},1)`);gr.addColorStop(0.1,`rgba(${r},${g},${b},0.8)`);gr.addColorStop(0.35,`rgba(${r},${g},${b},0.2)`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);x.fillStyle=gr;x.fillRect(0,0,64,64);return c}
const PUFF_W=soft(250,250,252,0.9),PUFF_G=soft(120,118,114,0.9),PUFF_D=soft(60,58,56,0.9),FLAME=soft(255,170,60,1),FLAME2=soft(255,240,180,1);
const GL_W=glow(255,244,220),GL_R=glow(255,40,28),GL_G=glow(60,255,120),GL_S=glow(255,150,56),GL_B=glow(225,235,255);
const PLANES=[],PLANESH=[];for(let c=0;c<5;c++){const p=mk(128,128),x=p.getContext('2d');x.translate(64,64);x.scale(2,2);W.drawPlane(x,1,c);PLANES.push(p);
  const s=mk(128,128),y=s.getContext('2d');y.drawImage(p,0,0);y.globalCompositeOperation='source-in';y.fillStyle='#000';y.fillRect(0,0,128,128);PLANESH.push(s)}
// headlight beam: origin at left-middle, two lamps + cone (local: x forward)
const BEAM=(()=>{const Wd=256,Hd=96,c=mk(Wd,Hd),x=c.getContext('2d');const im=x.createImageData(Wd,Hd),d=im.data; // 22 x 8 m, lamps at +-0.75 m
  for(let py=0;py<Hd;py++)for(let px=0;px<Wd;px++){const u=px/Wd,v=(py+0.5-Hd/2)/12;let I=0;
    for(const ly of [-0.75,0.75]){const sp=0.35+u*22*0.2,dv=(v-ly-u*ly*0.6)/sp;I+=M.exp(-dv*dv*1.4)}
    I*=M.pow(1-u,1.7)*M.min(1,u*14+0.15)*0.32;const o=(py*Wd+px)*4;d[o]=255;d[o+1]=238;d[o+2]=205;d[o+3]=M.min(255,I*255)}
  x.putImageData(im,0,0);x.globalCompositeOperation='lighter';for(const ly of [-0.75,0.75]){const cy=Hd/2+ly*12;const g=x.createRadialGradient(2,cy,0,2,cy,7);g.addColorStop(0,'rgba(255,255,245,1)');g.addColorStop(0.35,'rgba(255,250,230,0.5)');g.addColorStop(1,'rgba(255,245,220,0)');x.fillStyle=g;x.fillRect(0,cy-7,9,14)}return c})();
const TAIL=(()=>{const c=mk(32,32),x=c.getContext('2d');const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,40,30,0.9)');g.addColorStop(0.4,'rgba(255,20,10,0.35)');g.addColorStop(1,'rgba(255,0,0,0)');x.fillStyle=g;x.fillRect(0,0,32,32);
  x.fillStyle='rgba(255,90,70,1)';x.beginPath();x.arc(16,9.5,1.6,0,TAU);x.arc(16,22.5,1.6,0,TAU);x.fill();return c})();
const FLAKE=(()=>{const c=mk(16,16),x=c.getContext('2d');const g=x.createRadialGradient(8,8,0,8,8,8);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.45,'rgba(255,255,255,0.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,16,16);return c})();
const TRAM=(()=>{const c=mk(124,12),x=c.getContext('2d');x.fillStyle='rgba(0,0,0,0.3)';x.fillRect(3,3,121,9);for(let i=0;i<3;i++){x.fillStyle='#c8322a';x.fillRect(2+i*40.5,1,39,9.6);x.fillStyle='#eeeeea';x.fillRect(4+i*40.5,3,35,5.6);x.fillStyle='rgba(40,50,60,0.6)';for(let q=0;q<5;q++)x.fillRect(6+i*40.5+q*6.8,3.6,4.6,1.2)}x.fillStyle='#333';x.fillRect(118,2,4,8);x.fillStyle='#555';x.fillRect(30,5,6,1.6);return c})();
// tileable fog texture
const FOG=(()=>{const N=256,c=mk(N,N),x=c.getContext('2d'),id=x.createImageData(N,N),d=id.data;const f=(i,j)=>{let n=0,a=0.55,q=4/N;for(let o=0;o<5;o++){n+=a*W.noise(i*q+o*7.1,j*q-o*3.3);a*=0.5;q*=2}return n};
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=i/N,v=j/N;const n=f(i,j)*(1-u)*(1-v)+f(i-N,j)*u*(1-v)+f(i,j-N)*(1-u)*v+f(i-N,j-N)*u*v;const a=smooth(-0.32,0.42,n*1.6);const o=(j*N+i)*4;d[o]=232;d[o+1]=236;d[o+2]=240;d[o+3]=a*255}
  x.putImageData(id,0,0);return ctx.createPattern(c,'repeat')})();

// ------------------------------------------------------------ time of day & weather
let tod=((hv(/,t(\d+(?:\.\d+)?)/,17.2))%24+24)%24,tSpeed=1;const SPEEDS=[0,4/60,40/60]; // game hours per real second (4 game min/s → day = 6 min)
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
function setTod(h){tod=((h%24)+24)%24;todEl.value=M.round(tod*60)%1440}
function setSpeed(i){tSpeed=i;for(const [id,v] of [['tpause',0],['tplay',1],['tfast',2]])document.getElementById(id).classList.toggle('on',v===i)}

// ------------------------------------------------------------ rendering helpers
let T=0;
const sxw=x=>(x-cam.x)/cam.m+VW/2,syw=y=>(y-cam.y)/cam.m+VH/2;
let vx0,vy0,vx1,vy1;
function inView(x,y,r){return x>vx0-r&&x<vx1+r&&y>vy0-r&&y<vy1+r}
function setRot(x,y,hx,hy,k){ctx.setTransform(DPR*k*hx,DPR*k*hy,-DPR*k*hy,DPR*k*hx,DPR*x,DPR*y)}
function tileZ(){const md=cam.m/M.min(DPR,1.5);let z=M.ceil(M.log2(WORLD/(256*md))-0.25);return clamp(z,0,12)}
function tileRect(tx,ty,ts){return [M.round(((tx*ts-cam.x)/cam.m+VW/2)*DPR),M.round((((tx+1)*ts-cam.x)/cam.m+VW/2)*DPR),M.round(((ty*ts-cam.y)/cam.m+VH/2)*DPR),M.round((((ty+1)*ts-cam.y)/cam.m+VH/2)*DPR)]}
function ancestor(mp,z,tx,ty,X0,Y0,X1,Y1){for(let d=1;d<=z;d++){const ax=tx>>d,ay=ty>>d;const a=mp.get(tkey(z-d,ax,ay));if(a&&a.b){a.f=frameNo;const sz=256/(1<<d);ctx.drawImage(a.b,(tx-(ax<<d))*sz,(ty-(ay<<d))*sz,sz,sz,X0,Y0,X1-X0,Y1-Y0);return true}}return false}
function drawTiles(){
  const z=tileZ(),n=1<<z,ts=WORLD/n;
  const tx0=M.max(0,M.floor(vx0/ts)),tx1=M.min(n-1,M.floor(vx1/ts)),ty0=M.max(0,M.floor(vy0/ts)),ty1=M.min(n-1,M.floor(vy1/ts));
  queue=[];request(0,0,0,-1e9);
  const zf=M.max(0,z-3),nf=1<<zf,tf=WORLD/nf;for(let y=M.max(0,M.floor(vy0/tf));y<=M.min(nf-1,M.floor(vy1/tf));y++)for(let x=M.max(0,M.floor(vx0/tf));x<=M.min(nf-1,M.floor(vx1/tf));x++)request(zf,x,y,-1e6);
  ctx.setTransform(1,0,0,1,0,0);
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const k=tkey(z,tx,ty);const e=cache.get(k);
    const [X0,X1,Y0,Y1]=tileRect(tx,ty,ts);
    if(e){e.f=frameNo;ctx.drawImage(e.b,X0,Y0,X1-X0,Y1-Y0);continue}
    const cxp=(tx+0.5)*ts-cam.x,cyp=(ty+0.5)*ts-cam.y;request(z,tx,ty,M.hypot(cxp,cyp)/ts);
    const st=stale.get(k);if(st){ctx.drawImage(st.b,X0,Y0,X1-X0,Y1-Y0);continue}
    if(!ancestor(cache,z,tx,ty,X0,Y0,X1,Y1))ancestor(stale,z,tx,ty,X0,Y0,X1,Y1)}
  if(z<12&&queue.length<4){const z2=z+1,n2=1<<z2,t2=WORLD/n2;const cx=M.floor(cam.x/t2),cy=M.floor(cam.y/t2);for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if(x>=0&&y>=0&&x<n2&&y<n2)request(z2,x,y,1e5)}
  return z}
// night lights: sharp layer at the current LOD + two blurred "bloom" layers from coarser LODs
function lightLevel(z,a,L,prio){const n=1<<z,ts=WORLD/n,mp=LCS[L];
  const tx0=M.max(0,M.floor(vx0/ts)),tx1=M.min(n-1,M.floor(vx1/ts)),ty0=M.max(0,M.floor(vy0/ts)),ty1=M.min(n-1,M.floor(vy1/ts));ctx.globalAlpha=a;
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){const k=tkey(z,tx,ty);const e=mp.get(k);const [X0,X1,Y0,Y1]=tileRect(tx,ty,ts);
    if(e){e.f=frameNo;if(e.b)ctx.drawImage(e.b,X0,Y0,X1-X0,Y1-Y0);continue}
    requestL(z,tx,ty,prio+M.hypot((tx+0.5)*ts-cam.x,(ty+0.5)*ts-cam.y)/ts,L);ancestor(mp,z,tx,ty,X0,Y0,X1,Y1)}}
function drawLights(z,a){if(a<0.01)return;ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='lighter';
  const fogB=1+wcur.fog*0.9+wcur.rain*0.3;
  requestL(0,0,0,-1e9,1);
  lightLevel(M.max(0,z-3),a*(lowQ?0.75:0.5)*fogB,3,-2e5);if(!lowQ)lightLevel(M.max(0,z-1),a*0.42*fogB,2,-1e5);
  lightLevel(z,a*(1-wcur.fog*0.3),1,0.3);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}

// traffic -------------------------------------------------------------------------
const LANES={0:[[3.6,1,27,52],[7.1,1,31,64],[10.6,1,23,85],[-3.6,-1,27,52],[-7.1,-1,31,64],[-10.6,-1,23,85]],1:[[2.6,1,21,130],[-2.6,-1,21,130]],
  2:[[2.6,1,13,58],[6.2,1,15,72],[-2.6,-1,13,58],[-6.2,-1,15,72]],3:[[2.3,1,10,95],[-2.3,-1,10,95]],4:[[1.4,1,9,380],[-1.4,-1,9,380]],
  6:[[0,1,15,110]],7:[[5.6,1,13,60],[9.2,1,15,75],[-5.6,-1,13,60],[-9.2,-1,15,75]]};
const DOTC=['#eee','#ccc','#333','#a22','#36c','#888','#454','#eb3'],DOTS=[[],[],[],[],[],[],[],[],[],[]];
function hsh(a,b,c){return W.hh(a,b,c)/4294967296}
let carCount=0;const CB=new Float32Array(5*40000);let cbn=0;
function drawTraffic(roads){const m=cam.m,k=1/m,dots=m>1.5;carCount=0;cbn=0;
  for(const a of DOTS)a.length=0;
  for(const r of roads){const LN=LANES[r.k];if(!LN)continue;const iv=[];
    for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],bx=r.pts[i*2+2],by=r.pts[i*2+3];if(M.max(ax,bx)<vx0-30||M.min(ax,bx)>vx1+30||M.max(ay,by)<vy0-30||M.min(ay,by)>vy1+30)continue;
      const a=r.cum[i],b=r.cum[i+1];if(iv.length&&iv[iv.length-1][1]>=a-1)iv[iv.length-1][1]=b;else iv.push([a,b])}
    if(!iv.length)continue;
    for(let li=0;li<LN.length;li++){const [off,dir,v0,sp0]=LN[li];const v=v0*(0.9+hsh(r.id,li,3)*0.2);const K=M.max(1,M.round(r.L/sp0)),sp=r.L/K;const base=((T*v+hsh(r.id,li,7)*r.L)%r.L);
      for(const [a0,b0] of iv){const a=dir>0?a0:r.L-b0,b=dir>0?b0:r.L-a0;const k0=M.ceil((a-base-sp*0.45)/sp),k1=M.floor((b-base)/sp);
        for(let q=k0;q<=k1;q++){const kk=((q%K)+K)%K;const hq=W.hh(r.id,li*7919+kk,11);if((hq&7)===0)continue;const j=((hq>>>3)&255)/255*sp*0.45;let s=q*sp+base+j;if(s<a||s>b)continue;
          const sd=dir>0?s:r.L-s;const p=W.posAt(r,sd);let hx=p[2]*dir,hy=p[3]*dir;const x=p[0]-p[3]*off,y=p[1]+p[2]*off;const X=sxw(x),Y=syw(y);
          if(X<-30||Y<-30||X>VW+30||Y>VH+30)continue;carCount++;
          const ty=(hq>>>12)&31;const truck=(r.k===0&&(li%3===2?ty<18:ty<3))||(r.k===1&&ty<5);const bus=!truck&&r.k===2&&ty<2;
          if(cbn<40000){const o=cbn*5;CB[o]=X;CB[o+1]=Y;CB[o+2]=hx;CB[o+3]=hy;CB[o+4]=truck?8.5:bus?6.25:2.5;cbn++}
          if(dots){const ci=truck?8:bus?9:(hq>>>17)&7;DOTS[ci].push(X,Y,M.max(1.2,(truck?9:4.5)*k));continue}
          setRot(X,Y,hx,hy,k);
          if(truck){ctx.drawImage(S.truck[(hq>>>17)%5],-8.5,-2.1,17,4.25)}else if(bus){ctx.drawImage(S.bus,-6.25,-1.5,12.5,3)}else ctx.drawImage(S.car[(hq>>>17)%S.car.length],-2.5,-1.25,5,2.5)}}}
    if(r.tram&&!dots){const nT=M.max(1,M.round(r.L/450));for(const dir of [1,-1]){for(let q=0;q<nT;q++){const v=9;const s=((T*v+hsh(r.id,q,dir>0?31:32)*r.L+q*r.L/nT)%r.L);const sd=dir>0?s:r.L-s;const p=W.posAt(r,sd);
        const x=p[0]-p[3]*1.75*dir,y=p[1]+p[2]*1.75*dir;const X=sxw(x),Y=syw(y);if(X<-40||Y<-40||X>VW+40||Y>VH+40)continue;setRot(X,Y,p[2]*dir,p[3]*dir,k);ctx.drawImage(TRAM,-15.5,-1.5,31,3);if(cbn<40000){const o=cbn*5;CB[o]=X;CB[o+1]=Y;CB[o+2]=p[2]*dir;CB[o+3]=p[3]*dir;CB[o+4]=15.5;cbn++}carCount++}}}}
  if(dots){ctx.setTransform(DPR,0,0,DPR,0,0);for(let ci=0;ci<10;ci++){const A=DOTS[ci];if(!A.length)continue;ctx.fillStyle=ci===8?'#ddd':ci===9?'#e8c040':DOTC[ci];ctx.beginPath();for(let i=0;i<A.length;i+=3){const sz=A[i+2];ctx.rect(A[i]-sz/2,A[i+1]-sz/2,sz,sz)}ctx.fill()}}}
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
  for(const sh of W.ships){const [x,y,hx,hy]=shipPos(sh);if(!inView(x,y,sh.len*3))continue;const X=sxw(x),Y=syw(y);const L=sh.len;
    if(lp){ctx.setTransform(DPR,0,0,DPR,0,0);const px=L*k;ctx.globalAlpha=lp;
      if(px<6){const s=M.max(2.5,px*0.8);ctx.drawImage(GL_W,X-s,Y-s,s*2,s*2);continue}
      setRot(X,Y,hx,hy,k);ctx.globalAlpha=lp*0.5;ctx.drawImage(GL_W,-L*0.5,-L*0.16,L,L*0.32);ctx.globalAlpha=lp;const d=M.max(3,4*m);
      ctx.drawImage(GL_W,L*0.42-d/2,-d/2,d,d);ctx.drawImage(GL_W,-L*0.45-d/2,-d/2,d,d);ctx.drawImage(GL_R,L*0.1-d/2,-L*0.08-d/2,d,d);ctx.drawImage(GL_G,L*0.1-d/2,L*0.08-d/2,d,d);continue}
    setRot(X,Y,hx,hy,k);
    const g=ctx.createLinearGradient(-L/2,0,-L*3.2,0);g.addColorStop(0,'rgba(240,250,255,0.55)');g.addColorStop(1,'rgba(240,250,255,0)');ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(-L*0.45,-L*0.06);ctx.lineTo(-L*3.2,-L*0.5);ctx.lineTo(-L*3.2,-L*0.38);ctx.lineTo(-L*0.5,0);ctx.lineTo(-L*3.2,L*0.38);ctx.lineTo(-L*3.2,L*0.5);ctx.lineTo(-L*0.45,L*0.06);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.beginPath();ctx.moveTo(L*0.5,0);ctx.lineTo(L*0.3,-L*0.12);ctx.lineTo(L*0.3,L*0.12);ctx.fill();
    W.drawShip(ctx,L,sh.st,sh.c)}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
function drawEmitters(){const m=cam.m;if(m>28)return;ctx.setTransform(DPR,0,0,DPR,0,0);const k=1/m;const px=-W.WDY,py=W.WDX;
  for(const e of W.emitters){if(!inView(e.x,e.y,e.k==='steam'?1500:700))continue;
    const n=e.k==='steam'?16:e.k==='flare'?6:18,rate=e.k==='steam'?0.035:0.055,len=(e.k==='steam'?650:420)*e.s;
    for(let i=0;i<n;i++){const age=((T*rate+i/n+e.ph)%1);const wob=M.sin(age*5+e.ph*20+i)*age*40;
      const x=e.x+W.WDX*age*len+px*wob,y=e.y+W.WDY*age*len+py*wob;const X=sxw(x),Y=syw(y);
      let r,a,spr;if(e.k==='steam'){r=(30+age*150)*e.s;a=0.8*M.pow(1-age,1.2)*M.min(1,age*10+0.3);spr=PUFF_W}else if(e.k==='flare'){r=6+age*30;a=0.25*(1-age);spr=PUFF_D}else{r=(6+age*50)*e.s;a=0.6*(1-age)*M.min(1,age*12+0.2);spr=PUFF_G}
      const sz=r*2*k;if(sz<1||X+sz<0||Y+sz<0||X-sz>VW||Y-sz>VH)continue;ctx.globalAlpha=a;ctx.drawImage(spr,X-sz/2,Y-sz/2,sz,sz)}}ctx.globalAlpha=1}
function drawFlares(nl){const m=cam.m;if(m>(nl>0.05?200:28))return;ctx.setTransform(DPR,0,0,DPR,0,0);const k=1/m;ctx.globalCompositeOperation='lighter';
  for(const e of W.emitters){if(e.k!=='flare'||!inView(e.x,e.y,700))continue;const X=sxw(e.x),Y=syw(e.y);const f=1+0.25*M.sin(T*13+e.ph*50)+0.15*M.sin(T*31+e.ph*9);
    if(nl>0.02){const g=M.max(6,520*f*k);ctx.globalAlpha=nl*0.42;ctx.drawImage(GL_S,X-g/2,Y-g/2,g,g)}
    if(m>28)continue;const sz=M.max(4,26*f*k);ctx.globalAlpha=0.85;ctx.drawImage(FLAME,X-sz/2+3*k,Y-sz/2-2*k,sz,sz);ctx.globalAlpha=0.9;const s2=sz*0.45;ctx.drawImage(FLAME2,X-s2/2,Y-s2/2,s2,s2)}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1}
function drawTurbines(lp){const m=cam.m;if(m>(lp?60:12))return;const k=1/m;ctx.setTransform(DPR,0,0,DPR,0,0);const ux=-W.WDY,uy=W.WDX;
  const on=(T%2.4)<1.0;if(lp&&!on)return;if(lp)ctx.globalCompositeOperation='lighter';
  for(const f of W.farms){if(!inView((f.bb[0]+f.bb[2])/2,(f.bb[1]+f.bb[3])/2,2600))continue;
    for(const t of f.t){if(!inView(t.x,t.y,150))continue;const tx=t.x+W.LEANX*95,ty=t.y+W.LEANY*95;
      if(lp){const X=sxw(tx),Y=syw(ty),d=M.max(4,9*k);ctx.globalAlpha=lp;ctx.drawImage(GL_R,X-d/2,Y-d/2,d,d);continue}
      const th=T*t.sp+t.ph;const hx=t.x+W.SUNX*95,hy=t.y+W.SUNY*95;
      ctx.lineCap='round';ctx.strokeStyle=`rgba(10,20,30,${0.32*LG.day})`;ctx.lineWidth=M.max(1,2.4*k);ctx.beginPath();
      for(let b=0;b<3;b++){const a=th+b*TAU/3;const c=M.cos(a)*55,s=M.sin(a)*55;ctx.moveTo(sxw(hx),syw(hy));ctx.lineTo(sxw(hx+ux*c+W.SUNX*s),syw(hy+uy*c+W.SUNY*s))}ctx.stroke();
      ctx.strokeStyle='#e4e4e0';ctx.lineWidth=M.max(1,3*k);ctx.beginPath();ctx.moveTo(sxw(t.x),syw(t.y));ctx.lineTo(sxw(tx),syw(ty));ctx.stroke();
      ctx.strokeStyle='#f2f2f0';ctx.lineWidth=M.max(1,2.2*k);ctx.beginPath();const X=sxw(tx),Y=syw(ty);
      for(let b=0;b<3;b++){const a=th+b*TAU/3;const c=M.cos(a)*55,sn=M.sin(a)*55;ctx.moveTo(X,Y);ctx.lineTo(sxw(tx+ux*c-W.WDX*2+W.LEANX*sn),syw(ty+uy*c-W.WDY*2+W.LEANY*sn))}ctx.stroke();
      ctx.fillStyle='#dcdcd8';ctx.save();ctx.translate(X,Y);ctx.rotate(M.atan2(W.WDY,W.WDX));ctx.fillRect(-2*k,-1.6*k,9*k,3.2*k);ctx.restore()}}
  ctx.lineCap='butt';ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
function camH(){return cam.m*VH*0.9}
const FLB=[];
function drawFlights(){const H=camH();ctx.setTransform(DPR,0,0,DPR,0,0);FLB.length=0;
  for(const f of W.flights){const tot=f.L+(f.kind?0:900*f.v/78);const s=(T*f.v+f.ph)%tot;if(s>f.L)continue;
    let i=1;while(i<f.n-1&&f.cum[i]<s)i++;const t=(s-f.cum[i-1])/(f.cum[i]-f.cum[i-1]||1);const ax=f.pts[i*2-2],ay=f.pts[i*2-1],bx=f.pts[i*2],by=f.pts[i*2+1];
    const x=ax+(bx-ax)*t,y=ay+(by-ay)*t;let hx=bx-ax,hy=by-ay;const hl=M.hypot(hx,hy)||1;hx/=hl;hy/=hl;
    let alt=f.alt;if(!f.kind){const td=f.cum[4]+300;alt=clamp(M.min((s-1900)*0.11,(td-s)*0.055),0,f.alt)}
    const sx=x+W.SUNX*alt,sy=y+W.SUNY*alt;
    if(LG.day>0.05&&inView(sx,sy,200)&&cam.m<60){const X=sxw(sx),Y=syw(sy),sz=64/cam.m;if(sz>1.5){ctx.globalAlpha=0.28*LG.day*(1-wcur.cover*0.5);ctx.save();ctx.translate(X,Y);ctx.rotate(M.atan2(hy,hx));ctx.drawImage(PLANESH[f.c],-sz/2,-sz/2,sz,sz);ctx.restore();ctx.globalAlpha=1}}
    if(alt>H*0.9)continue;const kk=H/(H-alt);const X=VW/2+(x-cam.x)/cam.m*kk,Y=VH/2+(y-cam.y)/cam.m*kk;if(X<-200||Y<-200||X>VW+200||Y>VH+200)continue;
    const sz=64/cam.m*kk*(f.kind?1.1:1);FLB.push([X,Y,hx,hy,sz,alt,f]);
    if(f.kind&&sz>0.3){const L=9000/cam.m*kk;const ca=0.75*(0.35+0.65*LG.day);const g=ctx.createLinearGradient(X,Y,X-hx*L,Y-hy*L);g.addColorStop(0,`rgba(255,255,255,${ca})`);g.addColorStop(1,'rgba(255,255,255,0)');ctx.strokeStyle=g;ctx.lineWidth=M.max(1,14/cam.m*kk);
      ctx.beginPath();for(const o of [-1,1]){ctx.moveTo(X-hx*sz*0.3-hy*o*sz*0.12,Y-hy*sz*0.3+hx*o*sz*0.12);ctx.lineTo(X-hx*L-hy*o*sz*0.5,Y-hy*L+hx*o*sz*0.5)}ctx.stroke()}
    if(sz<2){if(sz>0.4){ctx.fillStyle='#fff';ctx.fillRect(X-1,Y-1,2,2)}continue}
    ctx.save();ctx.translate(X,Y);ctx.rotate(M.atan2(hy,hx));ctx.drawImage(PLANES[f.c],-sz/2,-sz/2,sz,sz);
    if(sz>10&&LG.night<0.3){const bl=(T*1.3+f.ph)%1<0.08;if(bl){ctx.fillStyle='rgba(255,60,60,0.95)';ctx.beginPath();ctx.arc(-sz*0.07,-sz*0.42,M.max(1.5,sz*0.02),0,TAU);ctx.fill();ctx.fillStyle='rgba(80,255,120,0.95)';ctx.beginPath();ctx.arc(-sz*0.07,sz*0.42,M.max(1.5,sz*0.02),0,TAU);ctx.fill()}}ctx.restore()}}
function drawFlightLights(a){if(a<0.02||!FLB.length)return;ctx.globalCompositeOperation='lighter';
  for(const [X,Y,hx,hy,sz,alt,f] of FLB){const strobe=(T*1.1+f.ph)%1<0.07;const d=M.max(4,sz*0.12);
    ctx.setTransform(DPR*hx,DPR*hy,-DPR*hy,DPR*hx,DPR*X,DPR*Y);ctx.globalAlpha=a;
    if(!f.kind&&alt<1200&&sz>3){ctx.globalAlpha=a*0.8*smooth(1200,300,alt);ctx.drawImage(BEAM,sz*0.45,-sz*0.35,sz*4,sz*0.7);ctx.globalAlpha=a}
    ctx.drawImage(GL_R,-sz*0.07-d/2,-sz*0.43-d/2,d,d);ctx.drawImage(GL_G,-sz*0.07-d/2,sz*0.43-d/2,d,d);ctx.drawImage(GL_W,-sz*0.5-d/2,-d/2,d,d);
    if(strobe){const e=d*2.6;ctx.drawImage(GL_B,-sz*0.07-e/2,-sz*0.43-e/2,e,e);ctx.drawImage(GL_B,-sz*0.07-e/2,sz*0.43-e/2,e,e)}
    if((T*0.9+f.ph)%1<0.12){const e=d*1.6;ctx.drawImage(GL_R,-e/2,-e/2,e,e)}}
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
function drawClouds(shadowPass){const H=camH();ctx.setTransform(DPR,0,0,DPR,0,0);const span=WORLD*1.3;const cov=wcur.cover*clouds.length;
  if(shadowPass&&LG.day<0.03)return;
  for(let ci=0;ci<clouds.length;ci++){const c=clouds[ci];const vis=clamp((wcur.cover-c.g)*14,0,1);if(vis<=0)continue;
    let x=((c.x+T*9+WORLD*0.15)%span+span)%span-WORLD*0.15,y=c.y;
    if(shadowPass){if(cam.m<0.12)continue;const sx=x+W.SUNX*c.alt,sy=y+W.SUNY*c.alt;if(!inView(sx,sy,c.s))continue;const sz=c.s/cam.m;ctx.globalAlpha=0.2*vis*LG.day*(1-0.45*smooth(0.6,1,wcur.cover));ctx.drawImage(CLS[c.v][1],sxw(sx)-sz/2,syw(sy)-sz/2,sz,sz);continue}
    if(H<c.alt*1.12)continue;const kk=H/(H-c.alt);const a=smooth(c.alt*1.12,c.alt*2.6,H);if(a<=0.01)continue;
    const X=VW/2+(x-cam.x)/cam.m*kk,Y=VH/2+(y-cam.y)/cam.m*kk,sz=c.s/cam.m*kk;if(X+sz/2<0||Y+sz/2<0||X-sz/2>VW||Y-sz/2>VH)continue;
    ctx.globalAlpha=a*0.95*vis;ctx.drawImage(CLS[c.v][2],X-sz/2,Y-sz/2,sz,sz)}ctx.globalAlpha=1}
function drawFog(){const f=wcur.fog;if(f<0.01)return;ctx.setTransform(DPR,0,0,DPR,0,0);
  for(let l=0;l<2;l++){const P=l?1700:5200,sc=P/256/cam.m;const ox=VW/2-(cam.x-T*(l?9:5))/cam.m,oy=VH/2-(cam.y+T*(l?3:-2))/cam.m;
    FOG.setTransform(new DOMMatrix([sc,0,0,sc,ox+l*91,oy+l*57]));ctx.fillStyle=FOG;ctx.globalAlpha=f*(l?0.42:0.6);ctx.fillRect(0,0,VW,VH)}
  ctx.globalAlpha=f*0.3;ctx.fillStyle='rgb(226,230,234)';ctx.fillRect(0,0,VW,VH);ctx.globalAlpha=1}
// precipitation in a camera-relative volume: particles fall from the lens toward the ground
const PR=[];let pcx=0,pcy=0;
function spawnP(p,top){p.q=top?0.06+M.random()*0.12:0.06+M.random()*0.94;const X=M.random()*VW*1.1-VW*0.05,Y=M.random()*VH*1.1-VH*0.05;p.dx=(X-VW/2)*cam.m*p.q;p.dy=(Y-VH/2)*cam.m*p.q;p.w=M.random()*TAU}
function drawPrecip(dt){const rain=wcur.rain,snow=wcur.snow,H=camH();const vis=smooth(14000,3000,H);const amt=M.max(rain,snow*1.1);
  const dx=cam.x-pcx,dy=cam.y-pcy;pcx=cam.x;pcy=cam.y;if(vis<=0.01||amt<0.02){PR.length=0;return}
  const want=M.min(2600,M.round(amt*VW*VH/(snow>rain?900:800)*vis));while(PR.length<want){const p={};spawnP(p,false);PR.push(p)}if(PR.length>want)PR.length=want;
  ctx.setTransform(DPR,0,0,DPR,0,0);const m=cam.m,A=LG.amb;const br=M.max(0.35,(A[0]+A[1]+A[2])/3);
  const isSnow=snow>rain;const vq=isSnow?0.16:1.25;const wx=(isSnow?26:70)*m,wy=(isSnow?10:24)*m;
  if(!isSnow){ctx.strokeStyle=`rgba(${200*br|0},${214*br|0},${235*br|0},${0.34*vis})`;ctx.lineWidth=1;ctx.beginPath()}
  for(const p of PR){p.dx-=dx;p.dy-=dy;const q0=p.q;p.q+=vq*dt*(0.6+0.4*p.q);p.dx+=wx*dt*p.q;p.dy+=wy*dt*p.q;
    if(isSnow){p.w+=dt*1.8;p.dx+=M.sin(p.w)*m*p.q*14*dt}
    const X=VW/2+p.dx/(m*p.q),Y=VH/2+p.dy/(m*p.q);if(p.q>=1||X<-60||Y<-60||X>VW+60||Y>VH+60){spawnP(p,p.q>=1);continue}
    if(isSnow){const s=clamp(1.6/p.q,1.2,9);ctx.globalAlpha=vis*clamp(0.95-p.q*0.5,0.3,0.9)*br;ctx.drawImage(FLAKE,X-s/2,Y-s/2,s,s)}
    else{const qb=p.q*0.93;const X0=VW/2+(p.dx-wx*0.03*p.q)/(m*qb),Y0=VH/2+(p.dy-wy*0.03*p.q)/(m*qb);ctx.moveTo(X0,Y0);ctx.lineTo(X,Y)}}
  if(!isSnow)ctx.stroke();ctx.globalAlpha=1}
const ZNAME={air:'Аэропорт',ref:'НПЗ',pow:'ТЭЦ',port:'Порт',ind:'Промзона',solar:'Солнечная электростанция',agro:'Тепличный комбинат',farm:'Ферма',dacha:'СНТ',cem:'Кладбище',quarry:'Карьер',gas:'АЗС',stn:'Вокзал'};const ZLIM={gas:2.5,farm:5,cem:5,dacha:6,stn:5};
function drawLabels(){ctx.setTransform(DPR,0,0,DPR,0,0);const m=cam.m;const boxes=[];ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  const lim=[9,32,95,380],fs=[11,12.5,15,19];const nl=LG.night;
  for(const c of W.cities){if(m>lim[c.type])continue;const X=sxw(c.x),Y=syw(c.y);if(X<-100||Y<-30||X>VW+100||Y>VH+30)continue;
    const a=M.min(1,(lim[c.type]-m)/(lim[c.type]*0.3))*(m<0.6?0.55:1);ctx.font=`${c.type>=2?600:500} ${fs[c.type]}px system-ui,Segoe UI,Roboto,sans-serif`;const w=c._lw||(c._lw=ctx.measureText(c.name).width+8),h=fs[c.type]+4;
    let hit=false;for(const b of boxes){if(M.abs(b[0]-X)<(b[2]+w)/2&&M.abs(b[1]-Y)<(b[3]+h)/2){hit=true;break}}if(hit)continue;boxes.push([X,Y,w,h]);
    ctx.globalAlpha=a*(1-nl*0.15);ctx.strokeStyle='rgba(10,20,30,0.75)';ctx.lineWidth=3.5;ctx.strokeText(c.name,X,Y);ctx.fillStyle=c.type===3?'#fff6dc':'#ffffff';ctx.fillText(c.name,X,Y)}
  if(m<9){ctx.font='500 11px system-ui,sans-serif';for(const z of W.zones){const lim=ZLIM[z.zk]||9;if(m>lim)continue;const X=sxw(z.x),Y=syw(z.y);if(X<-80||Y<-20||X>VW+80||Y>VH+20)continue;const t=ZNAME[z.zk];ctx.globalAlpha=M.min(1,(lim-m)/(lim/3))*0.9;
    ctx.strokeStyle='rgba(10,20,30,0.7)';ctx.lineWidth=3;ctx.strokeText(t,X,Y);ctx.fillStyle='#ffe9a8';ctx.fillText(t,X,Y)}}
  ctx.globalAlpha=1}

// ------------------------------------------------------------ inspector
let sel=null;
const BPOP=[0,3200,950,1700,60,0,0,0,0,0,40,0,180,45,0,0,0,0,300,0];
function cityStats(c){if(c._st)return c._st;let pop=0,area=0;const cnt={};
  if(c.type===0){let L=0;for(const s of c.vst)L+=s.L;const houses=M.round(L/31*2*0.84);pop=houses*3;cnt.houses=houses;area=L*90}
  else{const BD=c.D-1;for(let j=0;j<BD;j++)for(let i=0;i<BD;i++){const t=c.blocks[j*BD+i];if(!t)continue;const a=(c.us[i+1]-c.us[i])*(c.vs[j+1]-c.vs[j]);area+=a;pop+=BPOP[t]*a/14000;cnt[t]=(cnt[t]||0)+1}}
  const zs=W.zones.filter(z=>z.city===c);const roads=[0,0,0,0,0,0];
  c._st={pop:pop<1000?M.round(pop/10)*10:pop<1e5?M.round(pop/100)*100:M.round(pop/1000)*1000,area,cnt,zs};return c._st}
const fmtN=n=>String(M.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const TN=['Деревня','Город','Крупный город','Мегаполис'];
const BTN={1:'деловой центр',2:'периметральная застройка',3:'панельные микрорайоны',4:'частный сектор',5:'парки',6:'торговые центры',7:'школы',8:'гаражи',9:'стадион',10:'храмы',11:'стройки',12:'торговые улицы',13:'коттеджи',14:'больницы',15:'рынки',16:'спорткомплексы',17:'автобусные парки',18:'жилые кварталы',19:'офисы'};
function zoneInfo(z){const c={};for(const p of z.prims){const k=p.k==='cyl'?p.st:p.k;c[k]=(c[k]||0)+1}const rows=[];
  if(z.zk==='air'){const n=W.flights.filter(f=>!f.kind&&(M.hypot(f.pts[0]-z.x,f.pts[1]-z.y)<4000||M.hypot(f.pts[8]-z.x,f.pts[9]-z.y)<4000)).length;rows.push(['ВПП','3 300 × 60 м'],['Самолётов на перроне',c.plane||0],['Рейсов',n])}
  if(z.zk==='ref')rows.push(['Резервуаров',c.tank||0],['Ректификационных колонн',c.tower||0],['Газовых сфер',c.sphere||0],['Факелов',2]);
  if(z.zk==='pow')rows.push(['Градирен',c.cool||0],['Дымовых труб',c.chim||0]);
  if(z.zk==='port')rows.push(['Причалов',(c.ship||0)/2],['Судов у причалов',c.ship||0],['Кранов',c.crane||0]);
  if(z.zk==='ind')rows.push(['Корпусов',c.b||0],['Дымовых труб',c.chim||0],['Резервуаров',c.tank||0]);
  if(z.zk==='solar')rows.push(['Площадь панелей',fmtN(z.W*z.H*0.5/1e4)+' га']);
  if(!rows.length)rows.push(['Площадь',(z.W*z.H/1e4).toFixed(1).replace('.',',')+' га'],['Построек',c.b||0]);
  return rows}
function pick(sx,sy){const x=cam.x+(sx-VW/2)*cam.m,y=cam.y+(sy-VH/2)*cam.m;let best=null,bd=1e18;
  for(const z of W.zones){const dx=x-z.x,dy=y-z.y;const lx=dx*z.ca+dy*z.sa,ly=-dx*z.sa+dy*z.ca;if(M.abs(lx)<z.W/2+20&&M.abs(ly)<z.H/2+20){best={k:'zone',o:z};bd=0;break}}
  if(!best)for(const c of W.cities){const d=M.hypot(x-c.x,y-c.y);const r=c.R*(c.type===0?1.2:1.05)+cam.m*8;if(d<r&&d/r<bd){bd=d/r;best={k:'city',o:c}}}
  if(!best){closeInsp();return}sel=best;showInsp()}
function showInsp(){const el=document.getElementById('insp'),c=document.getElementById('inspc');let h='';
  if(sel.k==='city'){const o=sel.o,st=cityStats(o);h=`<h2>${o.name}</h2><div class="k">${TN[o.type]} · ${(o.x/1000).toFixed(1)} : ${(o.y/1000).toFixed(1)} км</div><table>`;
    h+=`<tr><td>Население</td><td>≈ ${fmtN(st.pop)} чел.</td></tr><tr><td>Площадь</td><td>${(st.area/1e6).toFixed(st.area<1e6?2:1).replace('.',',')} км²</td></tr>`;
    if(o.type===0)h+=`<tr><td>Дворов</td><td>${st.cnt.houses}</td></tr><tr><td>Улиц</td><td>${o.vst.length}</td></tr>`;
    else{h+=`<tr><td>Кварталов</td><td>${o.nblocks}</td></tr>`;const top=Object.entries(st.cnt).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t,n])=>`${BTN[t]} — ${n}`).join('<br>');h+=`<tr><td>Застройка</td><td>${top}</td></tr>`}
    if(st.zs.length)h+=`<tr><td>Объекты</td><td>${st.zs.map(z=>ZNAME[z.zk]).join(', ')}</td></tr>`;h+='</table>'}
  else{const z=sel.o;h=`<h2>${ZNAME[z.zk]}</h2><div class="k">при г. ${z.city.name} · ${fmtN(z.W)} × ${fmtN(z.H)} м</div><table>`;for(const [a,b] of zoneInfo(z))h+=`<tr><td>${a}</td><td>${b}</td></tr>`;h+='</table>'}
  h+=`<div class="row"><button id="inspgo">🔎 Приблизить</button></div>`;c.innerHTML=h;el.style.display='block';
  document.getElementById('inspgo').onclick=()=>{const o=sel.o;if(sel.k==='city')flyTo(o.x,o.y,o.type===3?2.2:o.type===2?1.4:o.type===1?0.9:0.45);else flyTo(o.x,o.y,M.max(o.W,o.H)*1.3/M.min(VW,VH))}}
function closeInsp(){sel=null;document.getElementById('insp').style.display='none'}
document.getElementById('inspx').onclick=closeInsp;
function drawSel(){if(!sel)return;ctx.setTransform(DPR,0,0,DPR,0,0);const o=sel.o;ctx.strokeStyle='rgba(255,210,90,0.9)';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.lineDashOffset=-T*20;ctx.beginPath();
  if(sel.k==='city'){ctx.arc(sxw(o.x),syw(o.y),M.max(12,o.R*1.08/cam.m),0,TAU)}
  else{const w=o.W/2+30,h=o.H/2+30;for(const [u,v] of [[-w,-h],[w,-h],[w,h],[-w,h]])ctx.lineTo(sxw(o.x+u*o.ca-v*o.sa),syw(o.y+u*o.sa+v*o.ca));ctx.closePath()}
  ctx.stroke();ctx.setLineDash([])}

// ------------------------------------------------------------ main loop
let last=performance.now(),fpsA=60,hudT=0,zNow=0,lowQ=false,qT=0,pfT=0;
const PROF={};function pf(n){const t=performance.now();PROF[n]=(PROF[n]||0)*0.97+(t-pfT)*0.03;pfT=t}
const hud={alt:document.getElementById('alt'),scale:document.getElementById('scalebar'),scaleT:document.getElementById('scalet'),pos:document.getElementById('pos'),fps:document.getElementById('fps'),load:document.getElementById('loading'),clock:document.getElementById('clock')};
const mini=document.getElementById('mini'),mctx=mini.getContext('2d');
const todEl=document.getElementById('tod');
function frame(now){const dt=M.min(0.06,(now-last)/1000);last=now;T+=dt;frameNo++;fpsA=fpsA*0.95+(1/M.max(dt,1e-3))*0.05;
  if(!todDrag)tod=(tod+SPEEDS[tSpeed]*dt)%24;updWeather(dt);updLight();
  pfT=performance.now();updateCam(dt);
  vx0=cam.x-VW/2*cam.m;vy0=cam.y-VH/2*cam.m;vx1=cam.x+VW/2*cam.m;vy1=cam.y+VH/2*cam.m;
  const A=LG.amb,NL=LG.lights;
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='#0e2e52';ctx.fillRect(0,0,VW,VH);
  // animated water glints (seen through translucent water in tiles)
  const P=M.max(cam.m,0.3),sc=P/cam.m;const ga=(0.2+0.8*LG.day)*(1-wcur.cover*0.35);
  for(let l=0;l<2;l++){const dr=l?-1:1;const ox=VW/2-cam.x/cam.m+T*(l?3:5)*dr/cam.m*sc,oy=VH/2-cam.y/cam.m+T*(l?4:-2)/cam.m*sc;
    wavePat.setTransform(new DOMMatrix([sc*(l?1.37:1),0,0,sc*(l?1.37:1),ox+l*77,oy+l*31]));ctx.fillStyle=wavePat;ctx.globalAlpha=(l?0.5:0.7)*(1-smooth(4,60,cam.m)*0.75)*ga;ctx.fillRect(0,0,VW,VH)}ctx.globalAlpha=1;
  pf('water');zNow=drawTiles();pf('tiles');
  {ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='rgba(14,46,82,0.8)';const X0=sxw(0),Y0=syw(0),X1=sxw(WORLD),Y1=syw(WORLD);if(X0>0||Y0>0||X1<VW||Y1<VH){ctx.beginPath();ctx.rect(-5,-5,VW+10,VH+10);ctx.rect(X0,Y0,X1-X0,Y1-Y0);ctx.fill('evenodd')}}
  if(opt.clouds)drawClouds(true);
  let rs=[];const trafficOn=opt.traffic&&cam.m<30;
  if(trafficOn){rs=cam.m<8?W.queryRoads(vx0,vy0,vx1,vy1):[];if(cam.m<3.2)drawTraffic(rs);else cbn=0;if(cam.m<8)drawTrains(rs,0);drawShips(0)}else cbn=0;
  pf('traffic');drawEmitters();drawTurbines(0);pf('emit');
  if(opt.traffic)drawFlights();else FLB.length=0;
  pf('flights');drawFog();
  // ambient light (dusk / night / overcast)
  if(A[0]<0.995||A[1]<0.995||A[2]<0.995){ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalCompositeOperation='multiply';ctx.fillStyle=`rgb(${A[0]*255|0},${A[1]*255|0},${A[2]*255|0})`;ctx.fillRect(0,0,VW,VH);ctx.globalCompositeOperation='source-over'}
  // emissive layers
  if(NL>0.01){drawLights(zNow,NL);if(trafficOn){drawCarLights(NL);if(cam.m<8)drawTrains(rs,NL)}if(opt.traffic||cam.m<120)drawShips(NL);drawTurbines(NL);}
  drawFlares(NL);if(opt.traffic)drawFlightLights(LG.night);
  dispatch();
  pf('lights');drawPrecip(dt);
  if(opt.clouds){const c=LG.cloud;tintClouds(c[0],c[1],c[2],flash>0.05?0:0.92);drawClouds(false)}
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const hz=smooth(40,600,cam.m)*0.16;if(hz>0){ctx.fillStyle=`rgba(${160*A[0]|0},${195*A[1]|0},${230*A[2]|0},${hz})`;ctx.fillRect(0,0,VW,VH)}
  if(wcur.storm>0.3){nextBolt-=dt;if(nextBolt<0){flash=1;nextBolt=3+M.random()*12}}
  if(flash>0.01){const f=flash*(0.6+0.4*M.sin(T*60));ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(190,200,255,${0.3*f})`;ctx.fillRect(0,0,VW,VH);ctx.globalCompositeOperation='source-over';flash*=M.exp(-dt*7)}
  pf('clouds');ctx.fillStyle=vign;ctx.fillRect(0,0,VW,VH);
  if(opt.labels)drawLabels();pf('labels');
  drawSel();
  if(frameNo%30===0)evict();
  if(stale.size){staleT+=dt;if((pending.size===0&&!queue.some(q=>!q.L))||staleT>25)dropStale()}
  // adaptive quality (hysteresis): drop the mid bloom layer when the frame rate is low
  if(LG.lights>0.05){if(!lowQ&&fpsA<22||lowQ&&fpsA>38)qT+=dt;else qT=0;if(qT>3){lowQ=!lowQ;qT=0}}
  hudT+=dt;if(hudT>0.12){hudT=0;updHUD()}
  requestAnimationFrame(frame)}
function fmtD(m){return m>=1000?(m/1000).toFixed(m>=10000?0:1).replace('.',',')+' км':M.round(m)+' м'}
function updHUD(){const H=camH();hud.alt.textContent=fmtD(H);
  const target=110*cam.m;const p=M.pow(10,M.floor(M.log10(target)));let L=p;for(const f of [1,2,5,10])if(f*p<=target)L=f*p;hud.scale.style.width=(L/cam.m)+'px';hud.scaleT.textContent=fmtD(L);
  hud.pos.textContent=`${(cam.x/1000).toFixed(2)} : ${(cam.y/1000).toFixed(2)} км · LOD ${zNow}`;hud.fps.textContent=`${M.round(fpsA)} FPS · тайлов ${cache.size}+${lcache.size}${mainRender?' (CPU)':' · потоков '+workers.filter(w=>w.ready).length}${carCount?' · машин '+carCount:''}`;
  const hm=M.floor(tod*60)%1440;hud.clock.textContent=String(M.floor(hm/60)).padStart(2,'0')+':'+String(hm%60).padStart(2,'0');if(!todDrag)todEl.value=hm;
  const z0=cache.get(0)||stale.get(0);if(z0){if(hud.load.style.display!=='none'&&cache.size>4)hud.load.style.display='none';
    mctx.setTransform(1,0,0,1,0,0);mctx.drawImage(z0.b,0,0,mini.width,mini.height);
    const A=LG.amb;if(A[0]<0.99){mctx.globalCompositeOperation='multiply';mctx.fillStyle=`rgb(${A[0]*255|0},${A[1]*255|0},${A[2]*255|0})`;mctx.fillRect(0,0,mini.width,mini.height);mctx.globalCompositeOperation='source-over'}
    const l0=lcache.get(0);if(l0&&l0.b&&LG.lights>0.02){mctx.globalCompositeOperation='lighter';mctx.globalAlpha=LG.lights;mctx.drawImage(l0.b,0,0,mini.width,mini.height);mctx.globalAlpha=1;mctx.globalCompositeOperation='source-over'}
    const s=mini.width/WORLD;mctx.strokeStyle='#ffd25a';mctx.lineWidth=1.5;
    const w=M.max(3,(vx1-vx0)*s),h=M.max(3,(vy1-vy0)*s);mctx.strokeRect(cam.x*s-w/2,cam.y*s-h/2,w,h)}}
mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*WORLD,y=(e.clientY-r.top)/r.height*WORLD;flyTo(x,y,M.min(cam.m,40))});

// ------------------------------------------------------------ UI
const list=document.getElementById('list'),q=document.getElementById('q');
const sorted=W.cities.slice().sort((a,b)=>b.type-a.type||a.name.localeCompare(b.name,'ru'));
function fill(){const f=q.value.trim().toLowerCase();list.innerHTML='';let n=0;
  for(const c of sorted){if(f?c.name.toLowerCase().indexOf(f)<0:c.type<1)continue;if(++n>80)break;const d=document.createElement('div');d.className='it t'+c.type;d.innerHTML=`<b>${c.name}</b><span>${TN[c.type]}</span>`;
    d.onclick=()=>{flyTo(c.x,c.y,c.type===3?2.2:c.type===2?1.4:c.type===1?0.9:0.45);sel={k:'city',o:c};showInsp()};list.appendChild(d)}}
q.addEventListener('input',fill);fill();
document.getElementById('st').textContent=`${W.cities.length} населённых пунктов · ${W.zones.length} пром. объектов · ${M.round(W.roads.reduce((a,r)=>a+r.L,0)/1000)} км дорог · ${(WORLD/1000).toFixed(0)}×${(WORLD/1000).toFixed(0)} км`;
for(const id of ['clouds','labels','traffic']){const el=document.getElementById('o_'+id);el.checked=opt[id];el.onchange=()=>opt[id]=el.checked}
document.getElementById('newworld').onclick=()=>{location.hash=String((M.random()*1e9)|0);location.reload()};
document.getElementById('seed').textContent='seed '+SEED;
document.getElementById('rnd').onclick=()=>{const c=W.cities[(M.random()*W.cities.length)|0];flyTo(c.x+(M.random()-0.5)*c.R,c.y+(M.random()-0.5)*c.R,0.35+M.random()*1.5)};
document.getElementById('home').onclick=()=>flyTo(WORLD/2,WORLD/2,maxM()*0.95);
document.getElementById('tg').onclick=()=>document.getElementById('side').classList.toggle('hid');
let todDrag=false;todEl.value=M.round(tod*60);
todEl.addEventListener('input',()=>{todDrag=true;tod=+todEl.value/60});todEl.addEventListener('change',()=>{todDrag=false});todEl.addEventListener('pointerup',()=>{todDrag=false});
document.getElementById('tpause').onclick=()=>setSpeed(0);document.getElementById('tplay').onclick=()=>setSpeed(1);document.getElementById('tfast').onclick=()=>setSpeed(2);
for(const b of document.querySelectorAll('#seasons button')){b.onclick=()=>setSeason(+b.dataset.s);b.classList.toggle('on',+b.dataset.s===season)}
const wxEl=document.getElementById('wx');WX.forEach((w,i)=>{const o=document.createElement('option');o.value=i;o.textContent=w.n;wxEl.appendChild(o)});wxEl.value=wxi;wxEl.onchange=()=>{wxi=+wxEl.value;wxEl.blur()};
let introOff=false;
window.__world={PROF,W,cam,flyTo,cache,lcache,opt,LG,wcur,stop:()=>{introOff=true;fly=null;zoomT=null},setTod,setSpeed,setSeason,setWeather:i=>{wxi=i;wxEl.value=i;const w=WX[i];for(const k in wcur)wcur[k]=w[k]!==undefined?w[k]:(k==='dim'||k==='cd'?1:0)},pick,
  stats:()=>({fps:fpsA,cars:carCount,tiles:cache.size,lights:LCS[1].size+'/'+LCS[2].size+'/'+LCS[3].size,queue:queue.length,pending:pending.size+LPS[1].size+LPS[2].size+LPS[3].size,main:mainRender,lowQ})};
requestAnimationFrame(frame);
// cinematic intro: dive from orbit to the largest city
const big=W.cities.find(c=>c.type===3)||W.cities[0];
setTimeout(()=>{if(!drag&&!zoomT&&!introOff)flyTo(big.x+big.R*0.12,big.y+big.R*0.08,2.4,7)},1600);
})();

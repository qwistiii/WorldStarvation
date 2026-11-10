# one-off migration of src/main.js from Canvas 2D to GL2D (stage 6); every replacement must match exactly once
import sys
p = 'src/main.js'
s = open(p, encoding='utf8').read()
def R(a, b, cnt=1):
    global s
    k = s.count(a)
    if k != cnt:
        sys.exit(f'patch: expected {cnt} got {k}: {a[:90]!r}')
    s = s.replace(a, b)

# ---- canvas, GL context, overlay
R("""const cv=document.getElementById('c'),ctx=cv.getContext('2d',{alpha:false});
const VQ=cfg.view||{};let DPR=M.min(window.devicePixelRatio||1,VQ.dpr||2),VW=0,VH=0,vign=null;const LITE=!!VQ.lite;
function resize(){VW=innerWidth;VH=innerHeight;cv.width=M.round(VW*DPR);cv.height=M.round(VH*DPR);
  vign=ctx.createRadialGradient(VW/2,VH/2,M.min(VW,VH)*0.35,VW/2,VH/2,M.hypot(VW,VH)*0.62);vign.addColorStop(0,'rgba(0,0,0,0)');vign.addColorStop(1,'rgba(0,8,20,0.38)')}""",
"""// stage 6: the world is drawn with WebGL2 (src/gl.js) — ctx is a GL2D with the Canvas 2D calls the engine uses; text,
// the game overlay and the selection go to a transparent 2D canvas on top (#c2, no pointer events)
const cv=document.getElementById('c');let ov=document.getElementById('c2');if(!ov){ov=document.createElement('canvas');ov.id='c2';cv.after(ov)}
const ctx=GL2D(cv);if(!ctx){const t=document.getElementById('ldt');if(t)t.textContent='Нужен браузер с поддержкой WebGL2';throw new Error('WebGL2 is not available')}
const octx=ov.getContext('2d');
const VQ=cfg.view||{};let DPR=M.min(window.devicePixelRatio||1,VQ.dpr||2),VW=0,VH=0;const vg={r0:1,r1:2};const LITE=!!VQ.lite;
// small screens or little memory: fewer tile slots (the pools are the whole tile memory: 256 KB per slot)
const SMALL=M.min(screen.width||1e4,screen.height||1e4)<700||(navigator.deviceMemory||8)<=4;
function resize(){VW=innerWidth;VH=innerHeight;cv.width=M.round(VW*DPR);cv.height=M.round(VH*DPR);ov.width=cv.width;ov.height=cv.height;
  vg.r0=M.min(VW,VH)*0.35;vg.r1=M.hypot(VW,VH)*0.62}""")

R("""const toC=c=>{const d=document.createElement('canvas');d.width=c.width;d.height=c.height;d.getContext('2d').drawImage(c,0,0);return d};
const S={car:S0.car.map(toC),carLo:S0.carLo.map(toC),truck:S0.truck.map(toC),bus:toC(S0.bus),tree:S0.tree.map(toC)};""",
"""const SP=c=>ctx.sprite(c); // sprites go into the GL atlas
const S={car:S0.car.map(SP),carLo:S0.carLo.map(SP),truck:S0.truck.map(SP),bus:SP(S0.bus)};""")

# ---- tile caches: entries {b (ImageBitmap until uploaded), s (slot), P (pool), f, t0, keep}
R("""let frameNo=0,queue=[];""",
"""let frameNo=0,queue=[];
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
function drawE(v,P,sx,sy,sw,sh,X0,Y0,W0,H0){const s=slotOf(v,P);if(s<0)return false;ctx.tile(P,s,sx,sy,sw,sh,X0,Y0,W0,H0);return true}""")

R("""if(m.L){LPS[m.L].delete(m.key);if(outdated(m.key,m.gv)){if(m.b&&m.b.close)m.b.close();return}LCS[m.L].set(m.key,{b:m.b,f:frameNo,t0:T});lastArr=T;return}
        pending.delete(m.key);if(m.s!==season||outdated(m.key,m.gv)){if(m.b&&m.b.close)m.b.close();return}cache.set(m.key,{b:m.b,f:frameNo,t0:T});lastArr=T}};""",
"""if(m.L){LPS[m.L].delete(m.key);if(outdated(m.key,m.gv)){if(m.b&&m.b.close)m.b.close();return}LCS[m.L].set(m.key,{b:m.b,s:-1,f:frameNo,t0:T,keep:m.key===0});lastArr=T;return}
        pending.delete(m.key);if(m.s!==season||outdated(m.key,m.gv)){if(m.b&&m.b.close)m.b.close();return}cache.set(m.key,{b:m.b,s:-1,f:frameNo,t0:T,keep:m.key===0});lastArr=T}};""")
R("""      if(q.L){if(LCS[q.L].has(q.k))continue;LCS[q.L].set(q.k,{b:W.renderLights(q.z,q.x,q.y,LHB[q.L]),f:frameNo})}else{if(cache.has(q.k))continue;cache.set(q.k,{b:W.renderTile(q.z,q.x,q.y),f:frameNo})}}return}""",
"""      if(q.L){if(LCS[q.L].has(q.k))continue;LCS[q.L].set(q.k,{b:W.renderLights(q.z,q.x,q.y,LHB[q.L]),s:-1,f:frameNo,keep:q.k===0})}else{if(cache.has(q.k))continue;cache.set(q.k,{b:W.renderTile(q.z,q.x,q.y),s:-1,f:frameNo,keep:q.k===0})}}return}""")
R("""  for(let i=0;i<arr.length&&mp.size>lo;i++){if(arr[i][1]>=frameNo-2)break;const v=mp.get(arr[i][0]);if(v.b&&v.b.close)v.b.close();mp.delete(arr[i][0])}}
function evict(){evictMap(cache,460,360);evictMap(LCS[1],320,240);evictMap(LCS[2],180,130);evictMap(LCS[3],120,90)}
function dropStale(){for(const v of stale.values())if(v.b&&v.b.close)v.b.close();stale=new Map();for(let L=1;L<=3;L++){for(const v of LST[L].values())if(v.b&&v.b.close)v.b.close();LST[L].clear()}}""",
"""  for(let i=0;i<arr.length&&mp.size>lo;i++){if(arr[i][1]>=frameNo-2)break;const v=mp.get(arr[i][0]);freeE(v);mp.delete(arr[i][0])}}
function evict(){const d=DPOOL.slots,l=LPOOL.slots;evictMap(cache,d-24,d-96);evictMap(LCS[1],l*0.5|0,l*0.38|0);evictMap(LCS[2],l*0.27|0,l*0.2|0);evictMap(LCS[3],l*0.18|0,l*0.13|0)}
function dropStale(){for(const v of stale.values())freeE(v);stale=new Map();for(let L=1;L<=3;L++){for(const v of LST[L].values())freeE(v);LST[L].clear()}}""")
R("""for(const [k,v] of cache){const tz=tileZ0(k);if(tz<zmin||tz>zmax||!hitBB(tileBB(k),bb))continue;const o=stale.get(k);if(o&&o.b&&o.b.close&&o!==v)o.b.close();stale.set(k,v);cache.delete(k)}staleT=0;
  for(let L=1;L<=3;L++)for(const [k,v] of LCS[L])if(tileZ0(k)>=zmin&&tileZ0(k)<=zmax&&hitBB(tileBB(k),bb)){const o=LST[L].get(k);if(o&&o.b&&o.b.close&&o!==v)o.b.close();LST[L].set(k,v);LCS[L].delete(k)}}""",
"""for(const [k,v] of cache){const tz=tileZ0(k);if(tz<zmin||tz>zmax||!hitBB(tileBB(k),bb))continue;const o=stale.get(k);if(o&&o!==v)freeE(o);stale.set(k,v);cache.delete(k)}staleT=0;
  for(let L=1;L<=3;L++)for(const [k,v] of LCS[L])if(tileZ0(k)>=zmin&&tileZ0(k)<=zmax&&hitBB(tileBB(k),bb)){const o=LST[L].get(k);if(o&&o!==v)freeE(o);LST[L].set(k,v);LCS[L].delete(k)}}""")
R("""const hkErr={};function hk(n,a,b){try{HK[n](a,b)}catch(e){if(!hkErr[n]){hkErr[n]=1;console.error('hook '+n+':',e)}ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}}""",
"""const hkErr={};function hk(n,a,b){try{HK[n](a,b)}catch(e){if(!hkErr[n]){hkErr[n]=1;console.error('hook '+n+':',e)}octx.setTransform(DPR,0,0,DPR,0,0);octx.globalAlpha=1;octx.globalCompositeOperation='source-over'}}""")

# ---- procedural assets
R("""  x.putImageData(id,0,0);return ctx.createPattern(c,'repeat')})();
function cloudSprite""", """  x.putImageData(id,0,0);return {tex:ctx.texture(0,0,c,true),x:0,y:0,w:N,h:N}})();
function cloudSprite""")
R("""  x.putImageData(id,0,0);const s=mk(N,N),sx=s.getContext('2d');sx.drawImage(c,0,0);sx.globalCompositeOperation='source-in';sx.fillStyle='#061018';sx.fillRect(0,0,N,N);return [c,s,mk(N,N)]}""",
"""  x.putImageData(id,0,0);return SP(c)} // the shadow ('#061018' silhouette) and the tinted cloud are the same sprite with a tint""")
R("""let cloudTint='';
function tintClouds(r,g,b,mixA){const key=(r>>3)+','+(g>>3)+','+(b>>3)+','+(mixA*20|0);if(key===cloudTint)return;cloudTint=key;
  for(const c of CLS){const t=c[2],x=t.getContext('2d');x.globalCompositeOperation='copy';x.drawImage(c[0],0,0);x.globalCompositeOperation='source-atop';
    x.fillStyle=`rgba(${r|0},${g|0},${b|0},${mixA})`;x.fillRect(0,0,256,256);x.globalCompositeOperation='source-over'}}""",
"""let cloudTint='';const CLT=[1,1,1,0],CLSH=[6/255,16/255,24/255,1],BLK=[0,0,0,1];
function tintClouds(r,g,b,mixA){const key=(r>>3)+','+(g>>3)+','+(b>>3)+','+(mixA*20|0);if(key===cloudTint)return;cloudTint=key;CLT[0]=(r|0)/255;CLT[1]=(g|0)/255;CLT[2]=(b|0)/255;CLT[3]=mixA}""")
R("""x.fillStyle=gr;x.fillRect(0,0,64,64);return c}
function glow""", """x.fillStyle=gr;x.fillRect(0,0,64,64);return SP(c)}
function glow""")
R("""gr.addColorStop(1,`rgba(${r},${g},${b},0)`);x.fillStyle=gr;x.fillRect(0,0,64,64);return c}
const PUFF_W""", """gr.addColorStop(1,`rgba(${r},${g},${b},0)`);x.fillStyle=gr;x.fillRect(0,0,64,64);return SP(c)}
const PUFF_W""")
R("""const PLANES=[],PLANESH=[];for(let c=0;c<5;c++){const p=mk(128,128),x=p.getContext('2d');x.translate(64,64);x.scale(2,2);W.drawPlane(x,1,c);PLANES.push(p);
  const s=mk(128,128),y=s.getContext('2d');y.drawImage(p,0,0);y.globalCompositeOperation='source-in';y.fillStyle='#000';y.fillRect(0,0,128,128);PLANESH.push(s)}""",
"""const PLANES=[];for(let c=0;c<5;c++){const p=mk(128,128),x=p.getContext('2d');x.translate(64,64);x.scale(2,2);W.drawPlane(x,1,c);PLANES.push(SP(p))} // shadows: the same sprite tinted black""")
R("""x.fillStyle=g;x.fillRect(0,cy-7,9,14)}return c})();""", """x.fillStyle=g;x.fillRect(0,cy-7,9,14)}return SP(c)})();""")
R("""x.fillStyle='rgba(255,90,70,1)';x.beginPath();x.arc(16,9.5,1.6,0,TAU);x.arc(16,22.5,1.6,0,TAU);x.fill();return c})();""",
"""x.fillStyle='rgba(255,90,70,1)';x.beginPath();x.arc(16,9.5,1.6,0,TAU);x.arc(16,22.5,1.6,0,TAU);x.fill();return SP(c)})();""")
R("""g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,16,16);return c})();""",
"""g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,16,16);return SP(c)})();""")
R("""x.fillStyle='#333';x.fillRect(118,2,4,8);x.fillStyle='#555';x.fillRect(30,5,6,1.6);return c})();""",
"""x.fillStyle='#333';x.fillRect(118,2,4,8);x.fillStyle='#555';x.fillRect(30,5,6,1.6);return SP(c)})();
// stage 6 helper sprites: a disc (nav lights), a fading bar (contrails), a ship wake and bow wave (were canvas gradients)
const DISC=(()=>{const c=mk(32,32),x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();x.arc(16,16,15,0,TAU);x.fill();return SP(c)})();
const GRADX=(()=>{const c=mk(256,4),x=c.getContext('2d');const g=x.createLinearGradient(0,0,256,0);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,256,4);return SP(c)})();
const WAKE=(()=>{const c=mk(276,100),x=c.getContext('2d');x.translate(320,50);const L=100;const g=x.createLinearGradient(-L/2,0,-L*3.2,0);g.addColorStop(0,'rgba(240,250,255,0.55)');g.addColorStop(1,'rgba(240,250,255,0)');x.fillStyle=g;
  x.beginPath();x.moveTo(-L*0.45,-L*0.06);x.lineTo(-L*3.2,-L*0.5);x.lineTo(-L*3.2,-L*0.38);x.lineTo(-L*0.5,0);x.lineTo(-L*3.2,L*0.38);x.lineTo(-L*3.2,L*0.5);x.lineTo(-L*0.45,L*0.06);x.closePath();x.fill();return SP(c)})();
const BOW=(()=>{const c=mk(20,24),x=c.getContext('2d');x.fillStyle='rgba(255,255,255,0.35)';x.beginPath();x.moveTo(20,12);x.lineTo(0,0);x.lineTo(0,24);x.fill();return SP(c)})();
// ship hulls: W.drawShip is vector art; each (length, style, colour, resolution) is drawn once into its own texture and
// kept while ships of that kind are on screen (resolution follows the zoom, up to the 8 px/m of the closest tiles)
const SHIPS=new Map();function shipSprite(L,st,c,m){const ps=m<0.15?8:m<0.4?4:2,key=L+'|'+st+'|'+c+'|'+ps;let e=SHIPS.get(key);
  if(!e){const w=L*(st===2?0.16:0.14),h=L/2;const cw=M.ceil((L+10)*ps),ch=M.ceil((w+10)*ps);const cv2=mk(cw,ch),x=cv2.getContext('2d');x.scale(ps,ps);x.translate(h+3,w/2+3);W.drawShip(x,L,st,c);
    e={r:{tex:ctx.texture(0,0,cv2),x:0,y:0,w:cw,h:ch},ox:-(h+3),oy:-(w/2+3),w:cw/ps,h:ch/ps,f:0};SHIPS.set(key,e)}e.f=frameNo;return e}""")
R("""  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=i/N,v=j/N;const n=f(i,j)*(1-u)*(1-v)+f(i-N,j)*u*(1-v)+f(i,j-N)*(1-u)*v+f(i-N,j-N)*u*v;const a=smooth(-0.32,0.42,n*1.6);const o=(j*N+i)*4;d[o]=232;d[o+1]=236;d[o+2]=240;d[o+3]=a*255}
  x.putImageData(id,0,0);return ctx.createPattern(c,'repeat')})();""",
"""  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const u=i/N,v=j/N;const n=f(i,j)*(1-u)*(1-v)+f(i-N,j)*u*(1-v)+f(i,j-N)*(1-u)*v+f(i-N,j-N)*u*v;const a=smooth(-0.32,0.42,n*1.6);const o=(j*N+i)*4;d[o]=232;d[o+1]=236;d[o+2]=240;d[o+3]=a*255}
  x.putImageData(id,0,0);return {tex:ctx.texture(0,0,c,true),x:0,y:0,w:N,h:N}})();""")

# ---- water mask: rects (merged along rows, no overlap) instead of a clip path
R("""  const cw=VW/GX,ch=VH/GY,mg=M.hypot(cw,ch)*0.5*cam.m*1.6e-4;const P=new Path2D();let n=0;""",
"""  const cw=VW/GX,ch=VH/GY,mg=M.hypot(cw,ch)*0.5*cam.m*1.6e-4;const P=[];let n=0;""")
R("""    if(wet){P.rect(i*cw-1,j*ch-1,cw+2,ch+2);n++}}""",
"""    if(wet){const l=P[P.length-1];if(l&&l[4]===j&&l[5]===i-1){l[2]+=cw;l[5]=i}else P.push([i*cw,j*ch,cw,ch,j,i]);n++}}""")

# ---- tiles
R("""function ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,md){for(let d=1;d<=M.min(z,md||99);d++){const ax=tx>>d,ay=ty>>d;const a=mp.get(tkey(z-d,ax,ay));if(a&&a.b){a.f=frameNo;const sz=256/(1<<d);ctx.drawImage(a.b,(tx-(ax<<d))*sz,(ty-(ay<<d))*sz,sz,sz,X0,Y0,X1-X0,Y1-Y0);return true}}return false}""",
"""function ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,md){for(let d=1;d<=M.min(z,md||99);d++){const ax=tx>>d,ay=ty>>d;const a=mp.get(tkey(z-d,ax,ay));if(a&&hasC(a)){a.f=frameNo;const sz=256/(1<<d);if(drawE(a,LPOOL,(tx-(ax<<d))*sz,(ty-(ay<<d))*sz,sz,sz,X0,Y0,X1-X0,Y1-Y0))return true}}return false}""")
R("""function anc2(z,tx,ty,X0,Y0,X1,Y1){for(let d=1;d<=z;d++){const ax=tx>>d,ay=ty>>d,k=tkey(z-d,ax,ay);const a=cache.get(k)||stale.get(k);if(a&&a.b){a.f=frameNo;const sz=256/(1<<d);ctx.drawImage(a.b,(tx-(ax<<d))*sz,(ty-(ay<<d))*sz,sz,sz,X0,Y0,X1-X0,Y1-Y0);return true}}return false}
function fallback(k,z,tx,ty,X0,Y0,X1,Y1){const st=stale.get(k);if(st&&st.b){ctx.drawImage(st.b,X0,Y0,X1-X0,Y1-Y0);return true}return anc2(z,tx,ty,X0,Y0,X1,Y1)}""",
"""function anc2(z,tx,ty,X0,Y0,X1,Y1){for(let d=1;d<=z;d++){const ax=tx>>d,ay=ty>>d,k=tkey(z-d,ax,ay);const a=cache.get(k)||stale.get(k);if(a&&hasC(a)){a.f=frameNo;const sz=256/(1<<d);if(drawE(a,DPOOL,(tx-(ax<<d))*sz,(ty-(ay<<d))*sz,sz,sz,X0,Y0,X1-X0,Y1-Y0))return true}}return false}
function fallback(k,z,tx,ty,X0,Y0,X1,Y1){const st=stale.get(k);if(st&&hasC(st)){st.f=frameNo;if(drawE(st,DPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0))return true}return anc2(z,tx,ty,X0,Y0,X1,Y1)}""")
R("""      let u=e.t0===undefined?1:(T-e.t0)/FADE;if(u>=1)e.t0=undefined;else if(fallback(k,z,tx,ty,X0,Y0,X1,Y1)){u=u<0?0:u;ctx.globalAlpha=u*u*(3-2*u)}ctx.drawImage(e.b,X0,Y0,X1-X0,Y1-Y0);ctx.globalAlpha=1;continue}""",
"""      let u=e.t0===undefined?1:(T-e.t0)/FADE;if(u>=1)e.t0=undefined;else if(fallback(k,z,tx,ty,X0,Y0,X1,Y1)){u=u<0?0:u;ctx.globalAlpha=u*u*(3-2*u)}drawE(e,DPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0);ctx.globalAlpha=1;continue}""")
R("""    const st=stale.get(k);if(st){ctx.drawImage(st.b,X0,Y0,X1-X0,Y1-Y0);continue}""",
"""    const st=stale.get(k);if(st){st.f=frameNo;if(drawE(st,DPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0))continue}""")
R("""    if(e){e.f=frameNo;let u=e.t0===undefined?1:(T-e.t0)/FADE;if(u>=1){e.t0=undefined;u=1}else{u=u<0?0:u*u*(3-2*u);const o=LST[L].get(k);ctx.globalAlpha=a*(1-u);if(o){if(o.b)ctx.drawImage(o.b,X0,Y0,X1-X0,Y1-Y0)}else ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2)}ctx.globalAlpha=a*u;if(e.b)ctx.drawImage(e.b,X0,Y0,X1-X0,Y1-Y0);ctx.globalAlpha=a;continue}
    requestL(z,tx,ty,prio+M.hypot((tx+0.5)*ts-cam.x,(ty+0.5)*ts-cam.y)/ts,L);{const o=LST[L].get(k);if(o){if(o.b)ctx.drawImage(o.b,X0,Y0,X1-X0,Y1-Y0)}else ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2)}}}""",
"""    if(e){e.f=frameNo;let u=e.t0===undefined?1:(T-e.t0)/FADE;if(u>=1){e.t0=undefined;u=1}else{u=u<0?0:u*u*(3-2*u);const o=LST[L].get(k);ctx.globalAlpha=a*(1-u);if(o){o.f=frameNo;drawE(o,LPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0)}else ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2)}ctx.globalAlpha=a*u;drawE(e,LPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0);ctx.globalAlpha=a;continue}
    requestL(z,tx,ty,prio+M.hypot((tx+0.5)*ts-cam.x,(ty+0.5)*ts-cam.y)/ts,L);{const o=LST[L].get(k);if(o){o.f=frameNo;drawE(o,LPOOL,0,0,256,256,X0,Y0,X1-X0,Y1-Y0)}else ancestor(mp,z,tx,ty,X0,Y0,X1,Y1,L===1?1:2)}}}""")

# ---- traffic dots
R("""  if(dots){ctx.setTransform(DPR,0,0,DPR,0,0);for(let ci=0;ci<10;ci++){const A=DOTS[ci];if(!A.length)continue;ctx.fillStyle=ci===8?'#ddd':ci===9?'#e8c040':DOTC[ci];ctx.beginPath();for(let i=0;i<A.length;i+=3){const sz=A[i+2];ctx.rect(A[i]-sz/2,A[i+1]-sz/2,sz,sz)}ctx.fill()}}}""",
"""  if(dots){ctx.setTransform(DPR,0,0,DPR,0,0);for(let ci=0;ci<10;ci++){const A=DOTS[ci];if(!A.length)continue;ctx.fillStyle=ci===8?'#ddd':ci===9?'#e8c040':DOTC[ci];for(let i=0;i<A.length;i+=3){const sz=A[i+2];ctx.fillRect(A[i]-sz/2,A[i+1]-sz/2,sz,sz)}}}}""")

# ---- ships
R("""    setRot(X,Y,hx,hy,k);
    const g=ctx.createLinearGradient(-L/2,0,-L*3.2,0);g.addColorStop(0,'rgba(240,250,255,0.55)');g.addColorStop(1,'rgba(240,250,255,0)');ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(-L*0.45,-L*0.06);ctx.lineTo(-L*3.2,-L*0.5);ctx.lineTo(-L*3.2,-L*0.38);ctx.lineTo(-L*0.5,0);ctx.lineTo(-L*3.2,L*0.38);ctx.lineTo(-L*3.2,L*0.5);ctx.lineTo(-L*0.45,L*0.06);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.beginPath();ctx.moveTo(L*0.5,0);ctx.lineTo(L*0.3,-L*0.12);ctx.lineTo(L*0.3,L*0.12);ctx.fill();
    W.drawShip(ctx,L,sh.st,sh.c)}""",
"""    setRot(X,Y,hx,hy,k);
    ctx.drawImage(WAKE,-L*3.2,-L*0.5,L*2.76,L);ctx.drawImage(BOW,L*0.3,-L*0.12,L*0.2,L*0.24);
    const sp=shipSprite(L,sh.st,sh.c,m);ctx.drawImage(sp.r,sp.ox,sp.oy,sp.w,sp.h)}""")

# ---- turbines: strokes → lines
R("""      ctx.lineCap='round';ctx.strokeStyle=`rgba(10,20,30,${0.32*LG.day})`;ctx.lineWidth=M.max(1,2.4*k);ctx.beginPath();
      for(let b=0;b<3;b++){const a=th+b*TAU/3;const c=M.cos(a)*55,s=M.sin(a)*55;ctx.moveTo(sxw(hx),syw(hy));ctx.lineTo(sxw(hx+ux*c+W.SUNX*s),syw(hy+uy*c+W.SUNY*s))}ctx.stroke();
      ctx.strokeStyle='#e4e4e0';ctx.lineWidth=M.max(1,3*k);ctx.beginPath();ctx.moveTo(sxw(t.x),syw(t.y));ctx.lineTo(sxw(tx),syw(ty));ctx.stroke();
      ctx.strokeStyle='#f2f2f0';ctx.lineWidth=M.max(1,2.2*k);ctx.beginPath();const X=sxw(tx),Y=syw(ty);
      for(let b=0;b<3;b++){const a=th+b*TAU/3;const c=M.cos(a)*55,sn=M.sin(a)*55;ctx.moveTo(X,Y);ctx.lineTo(sxw(tx+ux*c-W.WDX*2+W.LEANX*sn),syw(ty+uy*c-W.WDY*2+W.LEANY*sn))}ctx.stroke();""",
"""      ctx.fillStyle=`rgba(10,20,30,${0.32*LG.day})`;let lw=M.max(1,2.4*k);
      for(let b=0;b<3;b++){const a=th+b*TAU/3;const c=M.cos(a)*55,s=M.sin(a)*55;ctx.line(sxw(hx),syw(hy),sxw(hx+ux*c+W.SUNX*s),syw(hy+uy*c+W.SUNY*s),lw)}
      ctx.fillStyle='#e4e4e0';ctx.line(sxw(t.x),syw(t.y),sxw(tx),syw(ty),M.max(1,3*k));
      ctx.fillStyle='#f2f2f0';lw=M.max(1,2.2*k);const X=sxw(tx),Y=syw(ty);
      for(let b=0;b<3;b++){const a=th+b*TAU/3;const c=M.cos(a)*55,sn=M.sin(a)*55;ctx.line(X,Y,sxw(tx+ux*c-W.WDX*2+W.LEANX*sn),syw(ty+uy*c-W.WDY*2+W.LEANY*sn),lw)}""")
R("""  ctx.lineCap='butt';ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
function camH(){return cam.m*VH*0.9}""",
"""  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
// height and parallax: src/parallax.js
function camH(){return Parallax.camH(cam,VH)}
const PJ=[0,0,0];""")

# ---- flights
R("""    const sx=x+W.SUNX*alt,sy=y+W.SUNY*alt;
    if(LG.day>0.05&&inView(sx,sy,200)&&cam.m<60){const X=sxw(sx),Y=syw(sy),sz=64/cam.m;if(sz>1.5){ctx.globalAlpha=0.28*LG.day*(1-wcur.cover*0.5);ctx.save();ctx.translate(X,Y);ctx.rotate(M.atan2(hy,hx));ctx.drawImage(PLANESH[f.c],-sz/2,-sz/2,sz,sz);ctx.restore();ctx.globalAlpha=1}}
    if(alt>H*0.9)continue;const kk=H/(H-alt);const X=VW/2+(x-cam.x)/cam.m*kk,Y=VH/2+(y-cam.y)/cam.m*kk;if(X<-200||Y<-200||X>VW+200||Y>VH+200)continue;""",
"""    const [sx,sy]=Parallax.shadow(x,y,alt);
    if(LG.day>0.05&&inView(sx,sy,200)&&cam.m<60){const X=sxw(sx),Y=syw(sy),sz=64/cam.m;if(sz>1.5){ctx.globalAlpha=0.28*LG.day*(1-wcur.cover*0.5);ctx.save();ctx.translate(X,Y);ctx.rotate(M.atan2(hy,hx));ctx.tint=BLK;ctx.drawImage(PLANES[f.c],-sz/2,-sz/2,sz,sz);ctx.restore();ctx.globalAlpha=1}}
    if(!Parallax.inFront(H,alt))continue;Parallax.project(cam,VW,VH,x,y,alt,PJ);const kk=PJ[2],X=PJ[0],Y=PJ[1];if(X<-200||Y<-200||X>VW+200||Y>VH+200)continue;""")
R("""    if(f.kind&&sz>0.3){const L=9000/cam.m*kk;const ca=0.75*(0.35+0.65*LG.day);const g=ctx.createLinearGradient(X,Y,X-hx*L,Y-hy*L);g.addColorStop(0,`rgba(255,255,255,${ca})`);g.addColorStop(1,'rgba(255,255,255,0)');ctx.strokeStyle=g;ctx.lineWidth=M.max(1,14/cam.m*kk);
      ctx.beginPath();for(const o of [-1,1]){ctx.moveTo(X-hx*sz*0.3-hy*o*sz*0.12,Y-hy*sz*0.3+hx*o*sz*0.12);ctx.lineTo(X-hx*L-hy*o*sz*0.5,Y-hy*L+hx*o*sz*0.5)}ctx.stroke()}""",
"""    if(f.kind&&sz>0.3){const L=9000/cam.m*kk;const ca=0.75*(0.35+0.65*LG.day);const lw=M.max(1,14/cam.m*kk);CTR[3]=ca;
      for(const o of [-1,1])ctx.lineImg(GRADX,X-hx*sz*0.3-hy*o*sz*0.12,Y-hy*sz*0.3+hx*o*sz*0.12,X-hx*L-hy*o*sz*0.5,Y-hy*L+hx*o*sz*0.5,lw,CTR)}""")
R("""    if(sz>10&&LG.night<0.3){const bl=(T*1.3+f.ph)%1<0.08;if(bl){ctx.fillStyle='rgba(255,60,60,0.95)';ctx.beginPath();ctx.arc(-sz*0.07,-sz*0.42,M.max(1.5,sz*0.02),0,TAU);ctx.fill();ctx.fillStyle='rgba(80,255,120,0.95)';ctx.beginPath();ctx.arc(-sz*0.07,sz*0.42,M.max(1.5,sz*0.02),0,TAU);ctx.fill()}}ctx.restore()}}""",
"""    if(sz>10&&LG.night<0.3){const bl=(T*1.3+f.ph)%1<0.08;if(bl){const r=M.max(1.5,sz*0.02);disc(-sz*0.07,-sz*0.42,r,NAVR);disc(-sz*0.07,sz*0.42,r,NAVG)}}ctx.restore()}}
const CTR=[1,1,1,1],NAVR=[1,60/255,60/255,0.95],NAVG=[80/255,1,120/255,0.95];
// a filled circle (Canvas arc + fill) of colour c = [r, g, b, a]
function disc(x,y,r,c){const t=ctx.tint,a=ctx.globalAlpha;ctx.tint=c;ctx.globalAlpha=a*c[3];ctx.drawImage(DISC,x-r*16/15,y-r*16/15,r*32/15,r*32/15);ctx.tint=t;ctx.globalAlpha=a}""")

# ---- clouds: layers are framebuffer textures
R("""const CLL=[{c:mk(4,4),key:'',cx:0,cy:0},{c:mk(4,4),key:'',cx:0,cy:0}];""",
"""const CLL=[{c:ctx.layer(4,4),key:'',cx:0,cy:0},{c:ctx.layer(4,4),key:'',cx:0,cy:0}];""")
R("""  if(need){L.key=key;L.cx=cam.x;L.cy=cam.y;L.m=cam.m;L.T=T;if(L.c.width!==lw||L.c.height!==lh){L.c.width=lw;L.c.height=lh}const x2=L.c.getContext('2d');x2.setTransform(1,0,0,1,0,0);x2.clearRect(0,0,M.min(lw,M.ceil(lw*f)+2),M.min(lh,M.ceil(lh*f)+2));x2.setTransform(DPR*f,0,0,DPR*f,PAD*DPR*f,PAD*DPR*f);x2.imageSmoothingEnabled=true;let n=0,ms=1e9;L.f=f;""",
"""  if(need){L.key=key;L.cx=cam.x;L.cy=cam.y;L.m=cam.m;L.T=T;L.c.resize(lw,lh);const x2=ctx,T0=ctx.getTransform(),A0=ctx.globalAlpha;ctx.target(L.c);ctx.clear(0,0,0,0);x2.setTransform(DPR*f,0,0,DPR*f,PAD*DPR*f,PAD*DPR*f);let n=0,ms=1e9;L.f=f;
    ctx.tint=shadowPass?CLSH:CLT;""")
R("""      if(shadowPass){const sx=x+W.SUNX*c.alt,sy=y+W.SUNY*c.alt;if(!inView(sx,sy,c.s+PAD*cam.m*2))continue;const sz=c.s/cam.m;const sa=0.2*vis*LG.day*(1-0.45*smooth(0.6,1,wcur.cover))*cloudFar;if(sa<0.02)continue;x2.globalAlpha=sa;x2.drawImage(CLS[c.v][1],sxw(sx)-sz/2,syw(sy)-sz/2,sz,sz);n++;if(sz<ms)ms=sz;continue}
      if(H<c.alt*1.12)continue;const kk=H/(H-c.alt);let a=smooth(c.alt*1.12,c.alt*2.6,H)*(MODE==='game'?smooth(c.alt*3,c.alt*6,H)*0.85:1);if(a<=0.01)continue; // game: no white-out when the camera comes down through the cloud layer
      const X=VW/2+(x-cam.x)/cam.m*kk,Y=VH/2+(y-cam.y)/cam.m*kk,sz=c.s/cam.m*kk;if(X+sz/2<-PAD||Y+sz/2<-PAD||X-sz/2>VW+PAD||Y-sz/2>VH+PAD)continue;
      const ca=a*0.95*vis*cloudFar*(MODE==='game'?smooth(VW*2.4,VW*1.3,sz):1);if(ca<0.02)continue;/* game: no screen-filling cloud sprites */x2.globalAlpha=ca;x2.drawImage(CLS[c.v][2],X-sz/2,Y-sz/2,sz,sz);n++;if(sz<ms)ms=sz}
    L.n=n;L.ms=ms}""",
"""      if(shadowPass){const [sx,sy]=Parallax.shadow(x,y,c.alt,PJ);if(!inView(sx,sy,c.s+PAD*cam.m*2))continue;const sz=c.s/cam.m;const sa=0.2*vis*LG.day*(1-0.45*smooth(0.6,1,wcur.cover))*cloudFar;if(sa<0.02)continue;x2.globalAlpha=sa;x2.drawImage(CLS[c.v],sxw(sx)-sz/2,syw(sy)-sz/2,sz,sz);n++;if(sz<ms)ms=sz;continue}
      if(H<c.alt*1.12)continue;let a=smooth(c.alt*1.12,c.alt*2.6,H)*(MODE==='game'?smooth(c.alt*3,c.alt*6,H)*0.85:1);if(a<=0.01)continue; // game: no white-out when the camera comes down through the cloud layer
      Parallax.project(cam,VW,VH,x,y,c.alt,PJ);const X=PJ[0],Y=PJ[1],sz=c.s/cam.m*PJ[2];if(X+sz/2<-PAD||Y+sz/2<-PAD||X-sz/2>VW+PAD||Y-sz/2>VH+PAD)continue;
      const ca=a*0.95*vis*cloudFar*(MODE==='game'?smooth(VW*2.4,VW*1.3,sz):1);if(ca<0.02)continue;/* game: no screen-filling cloud sprites */x2.globalAlpha=ca;x2.drawImage(CLS[c.v],X-sz/2,Y-sz/2,sz,sz);n++;if(sz<ms)ms=sz}
    L.n=n;L.ms=ms;ctx.tint=null;ctx.target(null);ctx.setTransform(T0[0],T0[1],T0[2],T0[3],T0[4],T0[5]);ctx.globalAlpha=A0}""")

# ---- fog
R("""    FOG.setTransform(new DOMMatrix([sc,0,0,sc,ox+l*91,oy+l*57]));ctx.fillStyle=FOG;ctx.globalAlpha=f*(l?0.42:0.6);ctx.fillRect(0,0,VW,VH)}""",
"""    ctx.globalAlpha=f*(l?0.42:0.6);ctx.pattern(FOG,[sc,0,0,sc,ox+l*91,oy+l*57],[[0,0,VW,VH]])}""")

# ---- rain
R("""  if(!isSnow){ctx.strokeStyle=`rgba(${200*br|0},${214*br|0},${235*br|0},${0.34*vis})`;ctx.lineWidth=1;ctx.beginPath()}""",
"""  if(!isSnow){ctx.fillStyle=`rgba(${200*br|0},${214*br|0},${235*br|0},${0.34*vis})`}""")
R("""    else{const qb=p.q*0.93;const X0=VW/2+(p.dx-wx*0.03*p.q)/(m*qb),Y0=VH/2+(p.dy-wy*0.03*p.q)/(m*qb);ctx.moveTo(X0,Y0);ctx.lineTo(X,Y)}}
  if(!isSnow)ctx.stroke();ctx.globalAlpha=1}""",
"""    else{const qb=p.q*0.93;const X0=VW/2+(p.dx-wx*0.03*p.q)/(m*qb),Y0=VH/2+(p.dy-wy*0.03*p.q)/(m*qb);ctx.line(X0,Y0,X,Y,1)}}
  ctx.globalAlpha=1}""")

# ---- labels and selection: the 2D overlay
R("""function drawLabels(){ctx.setTransform(DPR,0,0,DPR,0,0);const m=cam.m;const boxes=[];ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';""",
"""function drawLabels(){const ctx=octx;ctx.setTransform(DPR,0,0,DPR,0,0);const m=cam.m;const boxes=[];ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';""")
R("""function drawSel(){if(!sel)return;ctx.setTransform(DPR,0,0,DPR,0,0);""", """function drawSel(){if(!sel)return;const ctx=octx;ctx.setTransform(DPR,0,0,DPR,0,0);""")

# ---- frame
R("""  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='#0e2e52';ctx.fillRect(0,0,VW,VH);""",
"""  ctx.begin();ctx.clear(14/255,46/255,82/255,1);ctx.setTransform(DPR,0,0,DPR,0,0);""")
R("""  if(!opt.noWater&&gaW>0.03&&waterClip()){const ga=gaW,NLW=VQ.dpr>=2?2:1;ctx.save();ctx.clip(WCLIP);const lv=""",
"""  if(!opt.noWater&&gaW>0.03&&waterClip()){const ga=gaW,NLW=VQ.dpr>=2?2:1;ctx.save();const lv=""")
R("""        wavePat.setTransform(new DOMMatrix([ca,sa,-sa,ca,(dx-cam.x)/cam.m+VW/2,(dy-cam.y)/cam.m+VH/2]));ctx.fillStyle=wavePat;ctx.globalAlpha=(l?0.45:NLW===1?0.8:0.65)*wgt*ga;ctx.fillRect(0,0,VW,VH)}}ctx.globalAlpha=1;ctx.restore()}""",
"""        ctx.globalAlpha=(l?0.45:NLW===1?0.8:0.65)*wgt*ga;ctx.pattern(wavePat,[ca,sa,-sa,ca,(dx-cam.x)/cam.m+VW/2,(dy-cam.y)/cam.m+VH/2],WCLIP)}}ctx.globalAlpha=1;ctx.restore()}""")
R("""  {ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='rgba(14,46,82,0.8)';const X0=sxw(0),Y0=syw(0),X1=sxw(WORLD),Y1=syw(WORLD);if(X0>0||Y0>0||X1<VW||Y1<VH){ctx.beginPath();ctx.rect(-5,-5,VW+10,VH+10);ctx.rect(X0,Y0,X1-X0,Y1-Y0);ctx.fill('evenodd')}}""",
"""  {ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='rgba(14,46,82,0.8)';const X0=sxw(0),Y0=syw(0),X1=sxw(WORLD),Y1=syw(WORLD);if(X0>0||Y0>0||X1<VW||Y1<VH){ // outside the world: four bands around it
    const a=M.max(-5,M.min(VH+5,Y0)),b=M.max(-5,M.min(VH+5,Y1));if(a>-5)ctx.fillRect(-5,-5,VW+10,a+5);if(b<VH+5)ctx.fillRect(-5,b,VW+10,VH+5-b);
    if(X0>-5)ctx.fillRect(-5,a,M.min(VW+5,X0)+5,b-a);if(X1<VW+5){const l=M.max(-5,X1);ctx.fillRect(l,a,VW+5-l,b-a)}}}""")
R("""  pf('clouds');ctx.fillStyle=vign;ctx.fillRect(0,0,VW,VH);
  if(opt.labels)drawLabels();pf('labels');
  if(HK.draw){ctx.setTransform(DPR,0,0,DPR,0,0);hk('draw',ctx,API);ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}
  pf('hook');drawSel();""",
"""  pf('clouds');ctx.vignette(VW/2,VH/2,vg.r0,vg.r1,VIGC,0.38);ctx.end();
  // the 2D overlay: labels, the game layer, the selection
  octx.setTransform(1,0,0,1,0,0);octx.clearRect(0,0,ov.width,ov.height);
  if(opt.labels)drawLabels();pf('labels');
  if(HK.draw){octx.setTransform(DPR,0,0,DPR,0,0);hk('draw',octx,API);octx.setTransform(DPR,0,0,DPR,0,0);octx.globalAlpha=1;octx.globalCompositeOperation='source-over'}
  pf('hook');drawSel();""")
R("""let last=performance.now(),fpsA=60,""", """const VIGC=[0,8/255,20/255];
let last=performance.now(),fpsA=60,""")
R("""perfEl.textContent=['FPS '+M.round(fpsA)+' · худший кадр '+fWorst.toFixed(1)+' мс','JS за кадр '+(PROF.js||0).toFixed(2)+' мс']""",
"""perfEl.textContent=['FPS '+M.round(fpsA)+' · худший кадр '+fWorst.toFixed(1)+' мс','JS за кадр '+(PROF.js||0).toFixed(2)+' мс','GL: вызовов '+ctx.stats.draws+' · примитивов '+ctx.stats.inst+' · слотов '+DPOOL.used+'/'+DPOOL.slots+' + '+LPOOL.used+'/'+LPOOL.slots]""")

# ---- destroy, API
R("""  for(const mp of [cache,stale,LCS[1],LCS[2],LCS[3]])for(const v of mp.values())if(v.b&&v.b.close)v.b.close();closeInsp();if(window.__world&&window.__world.W===W)window.__world=null}""",
"""  for(const mp of [cache,stale,LCS[1],LCS[2],LCS[3],LST[1],LST[2],LST[3]])for(const v of mp.values())if(v.b&&v.b.close)v.b.close();ctx.dispose();octx.setTransform(1,0,0,1,0,0);octx.clearRect(0,0,ov.width,ov.height);closeInsp();if(window.__world&&window.__world.W===W)window.__world=null}""")
R("""  stats:()=>({fps:fpsA,cars:carCount,tiles:cache.size,lights:LCS[1].size+'/'+LCS[2].size+'/'+LCS[3].size,queue:queue.length,pending:pending.size+LPS[1].size+LPS[2].size+LPS[3].size,main:mainRender,lowQ}),""",
"""  stats:()=>({fps:fpsA,cars:carCount,tiles:cache.size,lights:LCS[1].size+'/'+LCS[2].size+'/'+LCS[3].size,queue:queue.length,pending:pending.size+LPS[1].size+LPS[2].size+LPS[3].size,main:mainRender,lowQ,
    gl:{draws:ctx.stats.draws,inst:ctx.stats.inst,slots:DPOOL.used+LPOOL.used,cap:DPOOL.slots+LPOOL.slots,texMB:(DPOOL.slots+LPOOL.slots)*0.25+CLL.reduce((q,l)=>q+l.c.w*l.c.h*4/1048576,0)}}),""")
R("""window.__world=Object.assign({PROF,cache,lcache,cloudLayers:CLL},API);""",
"""window.__world=Object.assign({PROF,cache,lcache,cloudLayers:CLL,gl:ctx,overlay:ov},API);""")
open(p, 'w', encoding='utf8').write(s)
print('ok', len(s))

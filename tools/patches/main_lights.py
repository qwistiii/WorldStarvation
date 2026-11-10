# stage 6, phase 7: light sources in the engine — the light map (real light on the ground and on what stands on it),
# the poles (objects by day too, their heads through the parallax camera), the glow of the lamps
import sys
p = 'src/main.js'
s = open(p, encoding='utf8').read()
def R(a, b, cnt=1):
    global s
    k = s.count(a)
    if k != cnt:
        sys.exit(f'patch: expected {cnt} got {k}: {a[:90]!r}')
    s = s.replace(a, b)

R("""const BLB=ctx.layer(4,4); // half-resolution bloom buffer of the night lights""",
"""const BLB=ctx.layer(4,4); // half-resolution bloom buffer of the night lights
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
    ctx.fillStyle=POLEC;ctx.line(X,Y,PJ[0],PJ[1],w);const hs=M.max(1.4,(l.kind==='flood'?1.6:0.9)*k*PJ[2]);ctx.fillStyle='#d8d4c8';ctx.fillRect(PJ[0]-hs/2,PJ[1]-hs/2,hs,hs)}}
// the glow of the burning heads (after the ambient point: emissive), at their height through the parallax camera
function drawLightHeads(){if(!LV.length)return;ctx.setTransform(DPR,0,0,DPR,0,0);ctx.globalCompositeOperation='lighter';const k=1/cam.m,nb=0.35+0.65*LG.night;
  for(const l of LV){Parallax.project(cam,VW,VH,l.x,l.y,l.h,PJ);const a=l.lv*l.i*nb;if(a<0.01)continue;LHC[0]=l.c[0];LHC[1]=l.c[1];LHC[2]=l.c[2];ctx.tint=LHC;
    const g=M.max(3,(l.kind==='flood'?7:l.kind==='beacon'?3:4.5)*k*PJ[2]);ctx.globalAlpha=a*0.55;ctx.drawImage(GL_W,PJ[0]-g,PJ[1]-g,g*2,g*2);
    const c=M.max(1.5,(l.kind==='flood'?1.4:0.8)*k*PJ[2]);ctx.globalAlpha=a;ctx.drawImage(GL_W,PJ[0]-c,PJ[1]-c,c*2,c*2)}
  ctx.tint=null;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}""")

# frame: update the lights, pick the visible ones, build the light map before the scene
R("""  let CLB=null;if(opt.clouds&&!DBG.clouds){const c=LG.cloud;""",
"""  LIGHTS.update(dt,LG.night);LIGHTS.visible([vx0,vy0,vx1,vy1],lightHid,LV);LIGHTS.near([vx0,vy0,vx1,vy1],lightHid,LN);
  if(AMBON)lightMap(A);
  let CLB=null;if(opt.clouds&&!DBG.clouds){const c=LG.cloud;""")
R("""  pf('traffic');drawEmitters();drawTurbines(0);pf('emit');""","""  pf('traffic');drawEmitters();drawTurbines(0);drawPoles();pf('emit');""")
R("""  ctx.gpuMark('lights');ctx.ambient(1,1,1); // the ambient point""","""  ctx.gpuMark('lights');ctx.ambient(1,1,1);ctx.lightmap(null); // the ambient point""")
R("""  drawFlares(NL);if(opt.traffic)drawFlightLights(LG.night);pf('lights');""","""  drawFlares(NL);if(opt.traffic)drawFlightLights(LG.night);drawLightHeads();pf('lights');""")
R("""const API={gl:ctx,gflights:GFL,""", """const API={gl:ctx,lights:LIGHTS,gflights:GFL,""")
open(p, 'w', encoding='utf8').write(s)

p = 'index.html'
s = open(p, encoding='utf8').read()
R("""<script src="src/place.js?v=5.13"></script>""", """<script src="src/place.js?v=5.13"></script>
<script src="src/lights.js?v=5.13"></script>""")
open(p, 'w', encoding='utf8').write(s)
p = 'tools/build.mjs'
s = open(p, encoding='utf8').read()
R("""['flag', 'gen', 'parallax', 'gl', 'place', 'main', 'game', 'ui']""", """['flag', 'gen', 'parallax', 'gl', 'place', 'lights', 'main', 'game', 'ui']""")
open(p, 'w', encoding='utf8').write(s)
print('ok')

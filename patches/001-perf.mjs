// stage 5.12, step 1: engine performance (applied by the 'apply' workflow, then removed)
import fs from 'node:fs';
function patch(file, edits){let s=fs.readFileSync(file,'utf8');for(const [a,b] of edits){const i=s.indexOf(a);if(i<0)throw new Error(file+': not found: '+a.slice(0,160));if(s.indexOf(a,i+a.length)>=0)throw new Error(file+': not unique: '+a.slice(0,160));s=s.slice(0,i)+b+s.slice(i+a.length)}fs.writeFileSync(file,s);console.log(file+': '+edits.length+' edits')}
const r=String.raw;
patch('src/main.js',[
// more tile workers on machines with 8+ GB (tiles cost 40-95 ms each; the queue is the bottleneck of a flight)
[r`const NW=M.max(2,M.min(5,(navigator.hardwareConcurrency||4)-2));`,
 r`const NW=M.max(2,M.min((navigator.deviceMemory||4)>=8?7:5,(navigator.hardwareConcurrency||4)-2)); // stage 5.12: up to 7 workers on 8+ GB machines`],
// where the camera is heading: its tiles are requested before the levels the flight only passes through
[r`function tileZ(){const md=cam.m/M.min(DPR,1.5);let z=M.ceil(M.log2(WORLD/(256*md))-0.25);return clamp(z,0,12)}`,
 r`function tileZ(){const md=cam.m/M.min(DPR,1.5);let z=M.ceil(M.log2(WORLD/(256*md))-0.25);return clamp(z,0,12)}
function tileZAt(m){const md=m/M.min(DPR,1.5);return clamp(M.ceil(M.log2(WORLD/(256*md))-0.25),0,12)}
// stage 5.12: the goal of a flight (flyTo) or of a wheel zoom — its tiles are rendered first, so the view is sharp on arrival
function camGoal(){if(fly)return [fly.x1,fly.y1,M.exp(fly.l1),-5e5];if(zoomT){const wx=cam.x+(zoomT.sx-VW/2)*cam.m,wy=cam.y+(zoomT.sy-VH/2)*cam.m;return [wx-(zoomT.sx-VW/2)*zoomT.m,wy-(zoomT.sy-VH/2)*zoomT.m,zoomT.m,-50]}return null}
function preRect(zt,cx,cy,m,p,L){const nt=1<<zt,tt=WORLD/nt,hw=VW/2*m,hh=VH/2*m;for(let y=M.max(0,M.floor((cy-hh)/tt));y<=M.min(nt-1,M.floor((cy+hh)/tt));y++)for(let x=M.max(0,M.floor((cx-hw)/tt));x<=M.min(nt-1,M.floor((cx+hw)/tt));x++){const d=M.hypot((x+0.5)*tt-cx,(y+0.5)*tt-cy)/tt;if(L)requestL(zt,x,y,p+d,L);else request(zt,x,y,p+d)}}`],
[r`if(z<12&&queue.length<4){const z2=z+1,`,
 r`{const g=camGoal();if(g){const zt=tileZAt(g[2]);if(zt!==z)preRect(zt,g[0],g[1],g[2],g[3],0)}}
  if(z<12&&queue.length<4){const z2=z+1,`],
[r`lightLevel(z,a*(1-wcur.fog*0.3),1,0.3);`,
 r`lightLevel(z,a*(1-wcur.fog*0.3),1,0.3);
  {const g=camGoal();if(g){const zt=tileZAt(g[2]);if(zt!==z){preRect(M.max(0,zt-2),g[0],g[1],g[2],g[3],3);if(!lowQ)preRect(M.max(0,zt-1),g[0],g[1],g[2],g[3]+20,2);preRect(zt,g[0],g[1],g[2],g[3]+40,1)}}}`],
// camera motion flag (zoom / flight / pinch)
[r`let last=performance.now(),fpsA=60,hudT=0,zNow=0,lowQ=false,qT=0,pfT=0;`,
 r`let last=performance.now(),fpsA=60,hudT=0,zNow=0,lowQ=false,qT=0,pfT=0,CAMMV=false,pcm=0;`],
[r`pfT=performance.now();updateCam(dt);`,
 r`pfT=performance.now();updateCam(dt);CAMMV=!!(fly||zoomT||pinch)||M.abs(cam.m-pcm)>cam.m*1e-4;pcm=cam.m;`],
// cloud and cloud-shadow layers: resolution follows the sprites. A 256 px cloud stretched to 1000+ px loses nothing in a
// quarter-size layer (bilinear of bilinear); while the camera zooms (the layer is redrawn every frame then) half of that.
[r`const key=[cam.m.toFixed(5),M.round(T*9*q),M.round(wcur.cover*60),shadowPass?M.round(LG.day*60):cloudTint,lw,lh,LITE?1:0].join('|');`,
 r`const fl=clamp(384/M.max(1,(L.ms||0)*DPR),0.25,1),f=M.round((CAMMV&&(L.ms||0)*DPR>96?M.max(0.25,fl*0.5):fl)*16)/16; // stage 5.12
  const key=[cam.m.toFixed(5),M.round(T*9*q),M.round(wcur.cover*60),shadowPass?M.round(LG.day*60):cloudTint,lw,lh,LITE?1:0,f].join('|');`],
[r`x2.setTransform(1,0,0,1,0,0);x2.clearRect(0,0,lw,lh);x2.setTransform(DPR,0,0,DPR,PAD*DPR,PAD*DPR);x2.imageSmoothingEnabled=true;let n=0;`,
 r`x2.setTransform(1,0,0,1,0,0);x2.clearRect(0,0,M.min(lw,M.ceil(lw*f)+2),M.min(lh,M.ceil(lh*f)+2));x2.setTransform(DPR*f,0,0,DPR*f,PAD*DPR*f,PAD*DPR*f);x2.imageSmoothingEnabled=true;let n=0,ms=1e9;L.f=f;`],
[r`x2.drawImage(CLS[c.v][1],sxw(sx)-sz/2,syw(sy)-sz/2,sz,sz);n++;continue}`,
 r`x2.drawImage(CLS[c.v][1],sxw(sx)-sz/2,syw(sy)-sz/2,sz,sz);n++;if(sz<ms)ms=sz;continue}`],
[r`x2.drawImage(CLS[c.v][2],X-sz/2,Y-sz/2,sz,sz);n++}`,
 r`x2.drawImage(CLS[c.v][2],X-sz/2,Y-sz/2,sz,sz);n++;if(sz<ms)ms=sz}`],
[r`L.n=n}`, r`L.n=n;L.ms=ms}`],
[r`ctx.drawImage(L.c,M.round((dx-PAD)*DPR),M.round((dy-PAD)*DPR));`,
 r`{const lf=L.f||1;if(lf>=1)ctx.drawImage(L.c,M.round((dx-PAD)*DPR),M.round((dy-PAD)*DPR));else ctx.drawImage(L.c,0,0,lw*lf,lh*lf,(dx-PAD)*DPR,(dy-PAD)*DPR,lw,lh)}`],
]);

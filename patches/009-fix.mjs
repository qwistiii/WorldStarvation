import fs from 'fs';
import { execSync } from 'child_process';
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b, all] of pairs) {
    const n = s.split(a).length - 1;
    if (all ? n < 1 : n !== 1) throw new Error(p + ': ' + n + ' matches for: ' + a.slice(0, 200));
    s = all ? s.split(a).join(b) : s.replace(a, () => b);
  }
  fs.writeFileSync(p, s);
}

// ---------------------------------------------------------------- gen.js
const DEPTH = `// stage 5.14: one depth order for every building of a tile. Before, the blocks of a town were sorted by their centre,
// but the buildings inside a block (and in the zones) were drawn in the order they were made, so a tall roof (roofs lean
// north) was painted over by a lower neighbour standing south of it. Now pass 2 collects units (a building with its
// upper levels, domes and masts; footprints that overlap inside one block stay one unit in their own order: a podium and
// its tower) from all blocks, plazas and zones of the tile, sorts them by the world y of their footprint and draws them
// back to front. Flat things of pass 2 (cars, paving) are drawn first, under all buildings.
let DQ=null,DQLOG=null;
function isUS(p){return (p.k==='b'&&p.lvl===undefined&&p.H0===undefined)||p.k==='cyl'}
function isUA(p){return p.k==='b'||p.lvl!==undefined||p.H!==undefined}
function pBox(p){if(p.k==='cyl')return [p.x-p.r,p.y-p.r,p.x+p.r,p.y+p.r];if(p.a){const cx=p.x+p.w/2,cy=p.y+p.h/2,r=M.hypot(p.w,p.h)/2;return [cx-r,cy-r,cx+r,cy+r]}return [p.x,p.y,p.x+p.w,p.y+p.h]}
function bOv(a,b){return a[0]<b[2]-0.2&&b[0]<a[2]-0.2&&a[1]<b[3]-0.2&&b[1]<a[3]-0.2}
function unitsOf(P){if(P._u&&P._un===P.length)return P._u;const pre=[],U=[];let cur=null,cb=null;
  for(const p of P){if(isUS(p)){const b=pBox(p);let u=null;for(const o of U){for(const q of o.bs)if(bOv(b,q)){u=o;break}if(u)break}
      if(u){u.a.push(p);u.bs.push(b);const B=u.b;if(b[0]<B[0])B[0]=b[0];if(b[1]<B[1])B[1]=b[1];if(b[2]>B[2])B[2]=b[2];if(b[3]>B[3])B[3]=b[3]}else{u={a:[p],bs:[b],b:b.slice()};U.push(u)}cur=u;cb=b}
    else if(cur&&(isUA(p)||(p.x!==undefined&&p.y!==undefined&&p.x>=cb[0]-2&&p.x<=cb[2]+2&&p.y>=cb[1]-2&&p.y<=cb[3]+2)))cur.a.push(p);else pre.push(p)}
  P._u={pre,U};P._un=P.length;return P._u}
function dq(P,fx,fy,ca,sa){const u=unitsOf(P);if(u.pre.length)drawPrims(DQ.ctx,u.pre,2,DQ.mpp);
  for(const e of u.U){const b=e.b;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let c=0;c<4;c++){const lx=c&1?b[2]:b[0],ly=c&2?b[3]:b[1];const wx=fx+lx*ca-ly*sa,wy=fy+lx*sa+ly*ca;if(wx<x0)x0=wx;if(wx>x1)x1=wx;if(wy<y0)y0=wy;if(wy>y1)y1=wy}
    DQ.push({a:e.a,fx,fy,ca,sa,k:(y0+y1)/2,x0,y0,x1,y1})}}
function flushDQ(){const Q=DQ;DQ=null;if(!Q)return;Q.sort((a,b)=>a.k-b.k);
  for(const j of Q){setFrame(Q.ctx,j.fx,j.fy,j.ca,j.sa,Q.x0,Q.y0,Q.s);drawPrims(Q.ctx,j.a,2,Q.mpp)}
  if(DQLOG)for(const j of Q)DQLOG.push([j.k,j.x0,j.y0,j.x1,j.y1])}
function paintLog(on){const r=DQLOG;DQLOG=on?[]:null;return r}
function renderTile(z,tx,ty){`;

edit('src/gen.js', [
  [`if(fam==='grid'){c.diag=Q()<0.75?1+(Q()<0.55?1:0):0;return}`, `if(fam==='grid'){c.diag=0;return} /* stage 5.14: no diagonal boulevards (the cross through the grid) */`],
  [`for(const c of bigs){if(c.type!==3)continue;const n=96,pts=[],wat=[];`, `for(const c of bigs){if(c.type!==3||EMPTY||c.cap!==undefined)continue;/* stage 5.14: no ring motorway round capitals and in game worlds */const n=96,pts=[],wat=[];`],
  ['function renderTile(z,tx,ty){', DEPTH],
  [`for(const f of feats){drawFeat(ctx,f,1,x0,y0,s,mpp,qx0,qy0,qx1,qy1)}
    for(const f of feats)drawFeat(ctx,f,2,x0,y0,s,mpp,qx0,qy0,qx1,qy1);`, `for(const f of feats){drawFeat(ctx,f,1,x0,y0,s,mpp,qx0,qy0,qx1,qy1)}
    DQ=[];DQ.ctx=ctx;DQ.mpp=mpp;DQ.x0=x0;DQ.y0=y0;DQ.s=s;try{for(const f of feats)drawFeat(ctx,f,2,x0,y0,s,mpp,qx0,qy0,qx1,qy1)}finally{flushDQ()}`],
  [`const P=plazaPrims(f);if(pass===1){ctx.beginPath();drawPrims(ctx,P,1,mpp);ctx.fillStyle=SHADOW;ctx.fill()}else drawPrims(ctx,P,pass,mpp)}}`, `const P=plazaPrims(f);if(pass===1){ctx.beginPath();drawPrims(ctx,P,1,mpp);ctx.fillStyle=SHADOW;ctx.fill()}else if(pass===2&&DQ)dq(P,f.px,f.py,1,0);else drawPrims(ctx,P,pass,mpp)}}`],
  [`else drawPrims(ctx,P,pass,mpp)}
    return}
  if(f.kind==='zone'){setFrame(ctx,f.x,f.y,f.ca,f.sa,x0,y0,s);if(pass===1){ctx.beginPath();drawPrims(ctx,f.prims,1,mpp);ctx.fillStyle=SHADOW;ctx.fill();return}drawPrims(ctx,f.prims,pass,mpp);return}`, `else if(pass===2&&DQ)dq(P,bf[0],bf[1],bf[2],bf[3]);else drawPrims(ctx,P,pass,mpp)}
    return}
  if(f.kind==='zone'){setFrame(ctx,f.x,f.y,f.ca,f.sa,x0,y0,s);if(pass===1){ctx.beginPath();drawPrims(ctx,f.prims,1,mpp);ctx.fillStyle=SHADOW;ctx.fill();return}if(pass===2&&DQ){dq(f.prims,f.x,f.y,f.ca,f.sa);return}drawPrims(ctx,f.prims,pass,mpp);return}`],
  ['_dbg:{genVillage,genBlock,', '_dbg:{paintLog,unitsOf,genVillage,genBlock,'],
]);

// ---------------------------------------------------------------- main.js
const CLH = `const CLL=[{c:mk(4,4),key:'',cx:0,cy:0},{c:mk(4,4),key:'',cx:0,cy:0}];
// stage 5.14: while the camera flies (the approach after a capital is founded) the cloud layer below 90 km is no longer
// redrawn every frame: like the flat layers it is scaled and shifted with the camera (with the parallax of the mean cloud
// height) and redrawn when the scale drifts by 10 % (shadows 15 %), its edge would show or the camera stops; the two
// layers are not both redrawn in one frame unless one of them would show its edge. Below the cloud layer (where no cloud
// can be seen) the cloud pass does nothing at all.
let CALT=0,CAMN=0,CLRF=-1,CLFN=0;
function cAlt(mn){if(!CALT){let s=0,m=1e9;for(const c of clouds){s+=c.alt;if(c.alt<m)m=c.alt}CALT=clouds.length?s/clouds.length:2900;CAMN=clouds.length?m:2000}return mn?CAMN:CALT}
function clProj(L,kN,PAD){const r=(kN/cam.m)/((L.kk||1)/L.m),dx=(L.cx-cam.x)/cam.m*kN,dy=(L.cy-cam.y)/cam.m*kN,wx=(T-L.T)*9/cam.m*kN;return [r,dx+(-PAD-VW/2)*r+VW/2+wx,dy+(-PAD-VH/2)*r+VH/2,dx+wx,dy]}`;
edit('src/main.js', [
  [`const CLL=[{c:mk(4,4),key:'',cx:0,cy:0},{c:mk(4,4),key:'',cx:0,cy:0}];`, CLH],
  ['function drawClouds(shadowPass){const H=camH();', 'function drawClouds(shadowPass){if(shadowPass)CLFN++;const H=camH();'],
  [`const span=WORLD*1.3;
  if(shadowPass&&(LG.day<0.03||cam.m<0.12))return;`, `const span=WORLD*1.3;
  if(shadowPass&&(LG.day<0.03||cam.m<0.12))return;
  if(!shadowPass&&H<(MODE==='game'?3:1.12)*cAlt(1)){CLL[1].key='';CLL[1].n=0;return}`],
  [`const flat=shadowPass||H>90000,key=[flat?'f':cam.m.toFixed(5)+'|'+M.round(T*9*q),`, `const cAl=cAlt(),flat=shadowPass||H>90000,pl=!flat&&H>cAl*2.5,kN=flat?1:H/M.max(1,H-cAl),key=[flat?'f':pl?'p':cam.m.toFixed(5)+'|'+M.round(T*9*q),`],
  [`let need=key!==L.key;if(!need){if(flat){const r=L.m/cam.m,X0=ox+(-PAD-VW/2)*r+VW/2+(T-L.T)*9/cam.m,Y0=oy+(-PAD-VH/2)*r+VH/2;need=M.abs(M.log(r))>(CAMMV?0.08:0.002)||X0>-2||Y0>-2||X0+(VW+PAD*2)*r<VW+2||Y0+(VH+PAD*2)*r<VH+2}else need=M.abs(ox)>0.34||M.abs(oy)>0.34}`, `let need=key!==L.key;if(!need){if(flat||pl){const pr=clProj(L,kN,PAD),r=pr[0],X0=pr[1],Y0=pr[2],tol=shadowPass?0.15:0.1,lr=M.abs(M.log(r)),edge=X0>-2||Y0>-2||X0+(VW+PAD*2)*r<VW+2||Y0+(VH+PAD*2)*r<VH+2;need=edge||lr>(CAMMV?tol:0.002)||(!CAMMV&&pl&&(M.abs(pr[3])>0.34||M.abs(pr[4])>0.34));if(need&&!edge&&CAMMV&&CLRF===CLFN&&lr<tol*1.6)need=false}else need=M.abs(ox)>0.34||M.abs(oy)>0.34}if(need)CLRF=CLFN;`],
  ['if(need){L.key=key;L.cx=cam.x;L.cy=cam.y;L.m=cam.m;L.T=T;', 'if(need){L.key=key;L.cx=cam.x;L.cy=cam.y;L.m=cam.m;L.T=T;L.kk=kN;L.rd=(L.rd||0)+1;'],
  [`{const lf=L.f||1,r=flat?L.m/cam.m:1,X0=dx+(-PAD-VW/2)*r+VW/2+(flat?(T-L.T)*9/cam.m:0),Y0=dy+(-PAD-VH/2)*r+VH/2;if(lf>=1&&!flat)ctx.drawImage(L.c,M.round(X0*DPR),M.round(Y0*DPR));else ctx.drawImage(L.c,0,0,lw*lf,lh*lf,X0*DPR,Y0*DPR,lw*r,lh*r)}`, `{const lf=L.f||1;let r=1,X0=dx-PAD,Y0=dy-PAD;if(flat||pl){const pr=clProj(L,kN,PAD);r=pr[0];X0=pr[1];Y0=pr[2]}if(lf>=1&&!flat&&!pl)ctx.drawImage(L.c,M.round(X0*DPR),M.round(Y0*DPR));else ctx.drawImage(L.c,0,0,lw*lf,lh*lf,X0*DPR,Y0*DPR,lw*r,lh*r)}`],
]);

for (const f of ['src/gen.js', 'src/main.js']) execSync('node --check ' + f, { stdio: 'inherit' });

// probe for the version bump (ui.js VERSION / NEWS)
const ui = fs.readFileSync('src/ui.js', 'utf8');
const out = [];
for (const k of ['VERSION', 'NEWS']) { let i = -1, n = 0; while ((i = ui.indexOf(k, i + 1)) >= 0 && n < 4) { n++; out.push('######## ' + k + ' @' + i, ui.slice(Math.max(0, i - 200), i + 1400)); } }
fs.mkdirSync('docs/probe', { recursive: true });
fs.writeFileSync('docs/probe/ui.txt', out.join('\n'));
console.log('009 ok');

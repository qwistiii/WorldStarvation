function WorldGen(SEED){
'use strict';
const M=Math,PI=M.PI,TAU=PI*2,WORLD=131072,TS=256;
const SUNX=0.62,SUNY=0.48;
const LEANX=-0.05,LEANY=-0.17;        // oblique camera: roof offset per metre of height            // shadow offset per metre of height
const WDX=0.86,WDY=-0.51;             // wind direction
const ELEV=2600;                      // metres per height unit
function clamp(x,a,b){return x<a?a:x>b?b:x}
function smooth(e0,e1,x){let t=(x-e0)/(e1-e0);t=t<0?0:t>1?1:t;return t*t*(3-2*t)}
function lerp(a,b,t){return a+(b-a)*t}
function mix32(a){a=M.imul(a^(a>>>16),0x7feb352d);a=M.imul(a^(a>>>15),0x846ca68b);return (a^(a>>>16))>>>0}
const SS=mix32(M.imul(SEED|0,0x9E3779B1)+12345);
function hh(a,b,c){return mix32(M.imul(a|0,0x27d4eb2d)^mix32(M.imul(b|0,0x165667b1)^mix32(M.imul(c|0,0x1b873593)^SS)))}
function hr(a,b,c){return hh(a,b,c)/4294967296}
function rng(s){let a=s>>>0;return function(){a=(a+0x6D2B79F5)|0;let t=M.imul(a^(a>>>15),1|a);t=(t+M.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296}}
function mkCanvas(w,h){if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c}
// ---------------------------------------------------------------- seasons (stage 2): 0 summer, 1 autumn, 2 winter
let SEASON=0;
function setSeason(s){SEASON=s|0}
const SNOW=[236,240,246];
function seasonC(c,m){ // m: 0 ground, 1 pitched roof, 2 flat roof, 3 glass, 4 trampled
  if(SEASON===0)return c;const g=c[1]>=c[2]+20&&c[1]>c[0]-10;
  if(SEASON===1){if(m===0&&g)return [c[0]*0.82+38,c[1]*0.88+10,c[2]*0.78];return c}
  const a=m===1?0.84:m===2?0.72:m===3?0.12:m===4?0.42:(g?0.9:0.52);return [c[0]+(SNOW[0]-c[0])*a,c[1]+(SNOW[1]-c[1])*a,c[2]+(SNOW[2]-c[2])*a]}

// ---------------------------------------------------------------- noise
const P=new Uint8Array(512),GX=new Float32Array(256),GY=new Float32Array(256);
{const R=rng(SS^0xabcdef);const p=new Uint8Array(256);for(let i=0;i<256;i++)p[i]=i;
 for(let i=255;i>0;i--){const j=(R()*(i+1))|0;const t=p[i];p[i]=p[j];p[j]=t}
 for(let i=0;i<512;i++)P[i]=p[i&255];for(let i=0;i<256;i++){const a=R()*TAU;GX[i]=M.cos(a);GY[i]=M.sin(a)}}
function noise(x,y){
  let xi=M.floor(x),yi=M.floor(y);const xf=x-xi,yf=y-yi;xi&=255;yi&=255;
  const u=xf*xf*xf*(xf*(xf*6-15)+10),v=yf*yf*yf*(yf*(yf*6-15)+10);
  const a=P[xi]+yi,b=P[xi+1]+yi;const g00=P[a],g01=P[a+1],g10=P[b],g11=P[b+1];
  const n00=GX[g00]*xf+GY[g00]*yf,n10=GX[g10]*(xf-1)+GY[g10]*yf,n01=GX[g01]*xf+GY[g01]*(yf-1),n11=GX[g11]*(xf-1)+GY[g11]*(yf-1);
  const x1=n00+u*(n10-n00),x2=n01+u*(n11-n01);return (x1+v*(x2-x1))*1.4;
}
// ---------------------------------------------------------------- terrain
const ROOF_IND=[[198,200,204],[172,182,192],[120,140,165],[182,172,160],[150,162,150],[205,205,200],[140,120,110]];
const RW=[32,12,20,10,6,5,8,29,0];const RMIN=[1.6,1.0,0.9,0.7,0.6,0.9,0.7,1.0,0];
const SIDEW=[168,166,158],YARD=[112,124,86],PAVE=[172,168,160];
const PANELC=[[158,158,156],[120,122,126],[176,170,160],[138,134,128],[100,102,108],[180,178,176]];
const ROOFH=[[150,62,46],[96,110,94],[94,106,124],[120,84,62],[132,132,132],[168,96,60],[70,90,80],[110,48,44]];
const ROOFP=[[146,144,140],[110,110,114],[134,104,88],[162,160,156],[96,108,112],[128,120,108],[150,90,70]];
const CS=1/30000;
function baseH(x,y,oct){
  let px=x*CS,py=y*CS;
  const qx=noise(px*1.3+5.2,py*1.3+1.3),qy=noise(px*1.3-3.1,py*1.3+7.7);
  let e=0,a=0.62,fx=px+qx*0.6,fy=py+qy*0.6,ux=px,uy=py;
  for(let o=0;o<oct;o++){const w=o<2?1:o<4?0.5:0;const sx=fx*w+ux*(1-w),sy=fy*w+uy*(1-w);e+=a*noise(sx+o*31.7,sy-o*17.3);
    let nx=1.6*fx+1.2*fy;fy=-1.2*fx+1.6*fy;fx=nx;nx=1.6*ux+1.2*uy;uy=-1.2*ux+1.6*uy;ux=nx;a*=o<3?0.5:0.45}
  const dx=x/WORLD-0.5,dy=y/WORLD-0.5,d=M.sqrt(dx*dx+dy*dy)*2;
  e+=0.22-M.max(0,d-0.7)*2.6;
  const mm=smooth(0.2,0.5,e)*smooth(0.0,0.4,noise(x/42000+91.3,y/42000+12.1));
  if(mm>0){let fx=x/9000+40.5,fy=y/9000-20.2,amp=0.5,sum=0,prev=1;const no=M.min(oct+1,10);
    for(let o=0;o<no;o++){let r=1-M.abs(noise(fx,fy));r=r*M.sqrt(r);sum+=r*amp*prev;prev=clamp(r*1.5,0,1);const nx=1.62*fx+1.18*fy+3.7;fy=-1.18*fx+1.62*fy+1.9;fx=nx;amp*=0.48}
    e+=mm*sum*0.55}
  return e;
}
function riverV(x,y){
  let px=x/16000,py=y/16000;
  const wx=noise(px*1.9+70.1,py*1.9+3.3),wy=noise(px*1.9+13.7,py*1.9+80.9);
  px+=wx*0.5;py+=wy*0.5;
  return noise(px+200.3,py+50.7)+0.22*noise(px*3.1+7.7,py*3.1+3.3);
}
function riverW(x,y,e){
  if(e<-0.03)return 0;
  const big=smooth(-0.45,0.45,noise(x/55000+33.3,y/55000+44.4));
  return (0.0032+0.0105*big)*smooth(0.55,0.3,e);
}
function moist(x,y){return noise(x/22000+5.5,y/22000-8.8)*0.7+noise(x/6000+1.1,y/6000+2.2)*0.3}
function landE(x,y,mg){const e=baseH(x,y,7);if(e<0.004)return -1;const w=riverW(x,y,e);if(w>0){if(M.abs(riverV(x,y))<w+mg)return -1}return e}

// ---------------------------------------------------------------- names
const ROOTS=['Камен','Сосн','Берёз','Озёр','Яр','Зелен','Светл','Лес','Гор','Реч','Дуб','Лип','Орл','Сокол','Медвед','Журавл','Ольх','Кедр','Вишн','Снеж','Тих','Быстр','Ясн','Ржан','Север','Золот','Серебр','Волж','Камыш','Кузнец','Стальн','Мирн','Луч','Рад','Сибир','Урал','Ангар','Белг','Ковр','Иртыш','Добр','Звёзд','Свят','Лаз','Глин','Ключ','Рыбн','Холм','Бор','Студён'];
const PREF=['Ново','Старо','Верхне','Нижне','Усть-','Красно','Бело','Соль-'];
const EC=['инск','огорск','оград','ополь','одар','ов','оярск','озёрск','ово','ецк','ейск','ино'];
const EV=['овка','ино','ево','ское','енка','ки','ицы','ово','ье','иха','очное','ный'];
function mkName(R,t){let root=ROOTS[R()*ROOTS.length|0];let pre='';
  if(R()<0.33){pre=PREF[R()*PREF.length|0];if(!pre.endsWith('-'))root=root.toLowerCase()}
  const end=t>=1?EC[R()*EC.length|0]:EV[R()*EV.length|0];return pre+root+end}

// ---------------------------------------------------------------- spatial grids
const GC=4096,GNC=WORLD/GC,gridF=[];for(let i=0;i<GNC*GNC;i++)gridF.push([]);
function addF(o,x0,y0,x1,y1){const a=clamp(M.floor(x0/GC),0,GNC-1),b=clamp(M.floor(x1/GC),0,GNC-1),c=clamp(M.floor(y0/GC),0,GNC-1),d=clamp(M.floor(y1/GC),0,GNC-1);
  for(let j=c;j<=d;j++)for(let i=a;i<=b;i++)gridF[j*GNC+i].push(o)}
let stampF=1;
function queryF(x0,y0,x1,y1){stampF++;const out=[];const a=clamp(M.floor(x0/GC),0,GNC-1),b=clamp(M.floor(x1/GC),0,GNC-1),c=clamp(M.floor(y0/GC),0,GNC-1),d=clamp(M.floor(y1/GC),0,GNC-1);
  for(let j=c;j<=d;j++)for(let i=a;i<=b;i++){const L=gridF[j*GNC+i];for(let k=0;k<L.length;k++){const o=L[k];if(o._s===stampF)continue;o._s=stampF;
    if(o.bb[2]<x0||o.bb[0]>x1||o.bb[3]<y0||o.bb[1]>y1)continue;out.push(o)}}return out}
const RC=1024,RNC=WORLD/RC,gridR=[];for(let i=0;i<RNC*RNC;i++)gridR.push(null);
const roads=[];
function mkRoad(k,pts,extra){
  const n=pts.length/2;if(n<2)return null;
  const cum=new Float64Array(n);let L=0;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(let i=0;i<n;i++){const x=pts[i*2],y=pts[i*2+1];if(i>0)L+=M.hypot(x-pts[i*2-2],y-pts[i*2-1]);cum[i]=L;
    if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(L<20)return null;
  const r={id:roads.length,k,pts:new Float64Array(pts),cum,L,n,bb:[x0,y0,x1,y1],br:null,_s:0};
  if(extra)Object.assign(r,extra);
  roads.push(r);
  for(let i=0;i<n-1;i++){const ax=pts[i*2],ay=pts[i*2+1],bx=pts[i*2+2],by=pts[i*2+3];
    const a=clamp(M.floor(M.min(ax,bx)/RC-0.05),0,RNC-1),b=clamp(M.floor(M.max(ax,bx)/RC+0.05),0,RNC-1),c=clamp(M.floor(M.min(ay,by)/RC-0.05),0,RNC-1),d=clamp(M.floor(M.max(ay,by)/RC+0.05),0,RNC-1);
    for(let j=c;j<=d;j++)for(let q=a;q<=b;q++){const id=j*RNC+q;let A=gridR[id];if(!A)A=gridR[id]=[];if(A[A.length-1]!==r.id)A.push(r.id)}}
  return r;
}
let stampR=1;
function queryRoads(x0,y0,x1,y1){stampR++;const out=[];const a=clamp(M.floor(x0/RC),0,RNC-1),b=clamp(M.floor(x1/RC),0,RNC-1),c=clamp(M.floor(y0/RC),0,RNC-1),d=clamp(M.floor(y1/RC),0,RNC-1);
  for(let j=c;j<=d;j++)for(let i=a;i<=b;i++){const A=gridR[j*RNC+i];if(!A)continue;for(let k=0;k<A.length;k++){const r=roads[A[k]];if(r._s===stampR)continue;r._s=stampR;
    if(r.bb[2]<x0-40||r.bb[0]>x1+40||r.bb[3]<y0-40||r.bb[1]>y1+40)continue;out.push(r)}}return out}
function bridgesOf(r){ // water intervals along road
  const out=[];let inW=false,s0=0;const step=24;
  for(let s=0;s<=r.L;s+=step){const p=posAt(r,s);const w=landE(p[0],p[1],0)<0;
    if(w&&!inW){inW=true;s0=s}else if(!w&&inW){inW=false;out.push([M.max(0,s0-28),M.min(r.L,s+4)])}}
  if(inW)out.push([M.max(0,s0-28),r.L]);r.br=out.length?out:null}
const _p=[0,0,0,0];
function posAt(r,s){const c=r.cum;let lo=0,hi=r.n-1;if(s<=0)s=0;if(s>=r.L)s=r.L-1e-6;
  while(hi-lo>1){const m=(lo+hi)>>1;if(c[m]>s)hi=m;else lo=m}
  const t=(s-c[lo])/(c[hi]-c[lo]||1);const ax=r.pts[lo*2],ay=r.pts[lo*2+1],bx=r.pts[hi*2],by=r.pts[hi*2+1];
  const dx=bx-ax,dy=by-ay,l=M.hypot(dx,dy)||1;_p[0]=ax+dx*t;_p[1]=ay+dy*t;_p[2]=dx/l;_p[3]=dy/l;return _p}
function waterRunOK(pts,maxRun,maxFrac){let run=0,wl=0,L=0;
  for(let i=0;i<pts.length/2-1;i++){const ax=pts[i*2],ay=pts[i*2+1],bx=pts[i*2+2],by=pts[i*2+3];const l=M.hypot(bx-ax,by-ay);const n=M.max(1,M.ceil(l/60));
    for(let k=0;k<n;k++){const t=k/n;const w=landE(ax+(bx-ax)*t,ay+(by-ay)*t,0)<0;const d=l/n;L+=d;if(w){run+=d;wl+=d;if(run>maxRun)return false}else run=0}}
  return wl<=L*maxFrac}

// ---------------------------------------------------------------- settlements
const cities=[];
function cityF(c,x,y){const dx=x-c.x,dy=y-c.y;return M.sqrt(dx*dx+dy*dy)/c.R+0.26*noise(x/(c.R*0.9)+c.id*7.13,y/(c.R*0.9)-c.id*3.7)}
{
  const CELL=2700,NC=M.floor(WORLD/CELL);const cand=[];
  for(let cy=0;cy<NC;cy++)for(let cx=0;cx<NC;cx++){const R=rng(hh(cx,cy,11));if(R()<0.12)continue;
    const x=(cx+0.15+0.7*R())*CELL,y=(cy+0.15+0.7*R())*CELL;const e=landE(x,y,0.006);if(e<0.022||e>0.34)continue;
    const t=R();let type,Rr;
    if(t<0.022){type=3;Rr=2500+R()*1200}else if(t<0.08){type=2;Rr=1150+R()*700}else if(t<0.24){type=1;Rr=520+R()*380}else{type=0;Rr=170+R()*190}
    cand.push({x,y,R:Rr,type,seed:hh(cx,cy,12)})}
  cand.sort((a,b)=>b.type-a.type||b.R-a.R);
  for(const c of cand){let ok=true;for(const k of cities){const d=M.hypot(c.x-k.x,c.y-k.y);if(d<(c.R+k.R)*1.12+(c.type+k.type>1?900:250)){ok=false;break}}if(ok)cities.push(c)}
  cities.forEach((c,i)=>{c.id=i;const R=rng(c.seed^0x777);c.name=mkName(R,c.type);c.bb=[c.x-c.R*1.4,c.y-c.R*1.4,c.x+c.R*1.4,c.y+c.R*1.4];c.kind='city'});
}
function buildCity(c){
  const R=rng(c.seed^0x55);c.ang=R()*PI;c.ca=M.cos(c.ang);c.sa=M.sin(c.ang);
  if(c.type===3){c.bu=140+R()*40;c.bv=110+R()*30}else if(c.type===2){c.bu=118+R()*30;c.bv=95+R()*25}else{c.bu=92+R()*25;c.bv=78+R()*20}
  const N=c.N=M.ceil(c.R*1.3/M.min(c.bu,c.bv)),D=c.D=2*N+1;const ok=new Uint8Array(D*D);
  const us=c.us=new Float64Array(D),vs=c.vs=new Float64Array(D);for(let k=1;k<=N;k++){us[N+k]=us[N+k-1]+c.bu*(0.7+0.6*R());us[N-k]=us[N-k+1]-c.bu*(0.7+0.6*R());vs[N+k]=vs[N+k-1]+c.bv*(0.7+0.6*R());vs[N-k]=vs[N-k+1]-c.bv*(0.7+0.6*R())}
  for(let j=0;j<D;j++)for(let i=0;i<D;i++){const u=us[i],v=vs[j];const x=c.x+u*c.ca-v*c.sa,y=c.y+u*c.sa+v*c.ca;
    if(cityF(c,x,y)<1){const e=landE(x,y,0.0025);if(e>=0&&e<0.42)ok[j*D+i]=1}}
  const BD=D-1;const bl=c.blocks=new Uint8Array(BD*BD);let stad=false,cnt=0;
  for(let j=0;j<BD;j++)for(let i=0;i<BD;i++){if(!(ok[j*D+i]&&ok[j*D+i+1]&&ok[(j+1)*D+i]&&ok[(j+1)*D+i+1]))continue;
    const u=(us[i]+us[i+1])/2,v=(vs[j]+vs[j+1])/2;const x=c.x+u*c.ca-v*c.sa,y=c.y+u*c.sa+v*c.ca;
    const Rb=rng(hh(c.id,i*977+j,51));let t=pickType(c,cityF(c,x,y),Rb);if(t===9){if(stad)t=5;else stad=true}bl[j*BD+i]=t;cnt++}
  c.nblocks=cnt;
  const blk=(i,j)=>i>=0&&j>=0&&i<BD&&j<BD&&bl[j*BD+i]>0;
  // streets along U (fixed j)
  const eU=c.eU=new Uint8Array(D*D),eV=c.eV=new Uint8Array(D*D);
  const bridgeGap=(k,a0,a1,b0,b1)=>{if(k!==2&&k!==7)return;const A=cpt(c,a0,a1),B=cpt(c,b0,b1);const L=M.hypot(B[0]-A[0],B[1]-A[1]);if(L>520||L<20)return;let w=0;for(let q=1;q<6;q++){if(landE(A[0]+(B[0]-A[0])*q/6,A[1]+(B[1]-A[1])*q/6,0)<0)w++}if(w<2)return;const r=mkRoad(k,[A[0],A[1],B[0],B[1]],{city:c.id});if(r)bridgesOf(r)};
  for(let j=0;j<D;j++){let s=-1,le=-1;for(let i=0;i<=D;i++){const e=i<D-1&&ok[j*D+i]&&ok[j*D+i+1]&&(blk(i,j-1)||blk(i,j));if(e)eU[j*D+i]=1;
      if(e&&s<0){s=i;if(le>=0)bridgeGap(lineKind(j-N),le-N,j-N,i-N,j-N)}if(!e&&s>=0){addStreet(c,s-N,j-N,i-N,j-N,lineKind(j-N));le=i;s=-1}}}
  for(let i=0;i<D;i++){let s=-1,le=-1;for(let j=0;j<=D;j++){const e=j<D-1&&ok[j*D+i]&&ok[(j+1)*D+i]&&(blk(i-1,j)||blk(i,j));if(e)eV[j*D+i]=1;
      if(e&&s<0){s=j;if(le>=0)bridgeGap(lineKind(i-N),i-N,le-N,i-N,j-N)}if(!e&&s>=0){addStreet(c,i-N,s-N,i-N,j-N,lineKind(i-N));le=j;s=-1}}}
}
function bsr(a,v){let lo=0,hi=a.length-1;if(v<=a[0])return -1;if(v>=a[hi])return hi;while(hi-lo>1){const m=(lo+hi)>>1;if(a[m]>v)hi=m;else lo=m}return lo}
function cpt(c,i,j){const u=c.us[i+c.N],v=c.vs[j+c.N];return [c.x+u*c.ca-v*c.sa,c.y+u*c.sa+v*c.ca]}
function addStreet(c,i0,j0,i1,j1,k){const a=cpt(c,i0,j0),b=cpt(c,i1,j1);const r=mkRoad(k,[a[0],a[1],b[0],b[1]],{city:c.id});if(r&&k===2&&c.type>=2&&hr(c.id,i0===i1?i0*7+1:j0*7+2,88)<0.5)r.tram=1}
function lineKind(n){n=((n%8)+8)%8;return n===0?7:n===4?2:3}
function lineHalf(n){const k=lineKind(n);return k===7?14.5:k===2?10:5}
function pickW(r,T){let s=0;for(let i=1;i<T.length;i+=2)s+=T[i];r*=s;for(let i=1;i<T.length;i+=2){r-=T[i];if(r<=0)return T[i-1]}return T[T.length-2]}
// 1 towers 2 perimeter 3 panel 4 houses 5 park 6 mall 7 school 8 garages 9 stadium 10 church 11 construction 12 shops
// 13 cottages 14 hospital 15 market 16 sport 17 depot 19 offices
function pickType(c,dn,R){const r=R();
  if(c.type>=2){const core=c.type===3?0.24:0.13;
    if(dn<core)return pickW(r,[1,40,19,16,2,14,6,7,5,8,10,5,14,3,12,7]);
    if(dn<0.68)return pickW(r,[3,36,2,18,5,7,7,7,6,5,8,5,11,3,10,2,9,1.5,14,3,15,3,16,4,17,2,19,4,12,3]);
    return pickW(r,[4,40,13,c.type===3?16:10,3,12,8,8,5,5,7,4,6,4,11,3,16,4,17,2,15,1.5,12,2])}
  if(dn<0.32)return pickW(r,[2,25,3,25,12,12,5,10,7,9,10,9,6,4,15,6]);
  return pickW(r,[4,72,8,8,5,5,7,4,3,3,16,3,13,5])}
function buildVillage(c){
  const R=rng(c.seed^0x99);c.ang=R()*PI;c.ca=M.cos(c.ang);c.sa=M.sin(c.ang);c.vst=[];
  const mk=(ang,len)=>{const ca=M.cos(ang),sa=M.sin(ang);let best=null,cur=null;const n=20;
    for(let k=0;k<=n;k++){const t=-len+2*len*k/n;const x=c.x+ca*t,y=c.y+sa*t;const okk=landE(x,y,0.004)>=0;
      if(okk){if(!cur)cur=[t,t];cur[1]=t}else{if(cur&&(!best||cur[1]-cur[0]>best[1]-best[0]))best=cur;cur=null}}
    if(cur&&(!best||cur[1]-cur[0]>best[1]-best[0]))best=cur;
    if(best&&best[1]-best[0]>80){const s={x0:c.x+ca*best[0],y0:c.y+sa*best[0],x1:c.x+ca*best[1],y1:c.y+sa*best[1],ca,sa,L:best[1]-best[0]};c.vst.push(s);
      const r=mkRoad(4,[s.x0,s.y0,s.x1,s.y1]);}};
  mk(c.ang,c.R*1.1);if(R()<0.6)mk(c.ang+PI/2+(R()-0.5)*0.4,c.R*0.75);
  if(c.R>280&&R()<0.5){const o=(R()<0.5?1:-1)*c.R*0.45;const ox=-c.sa*o,oy=c.ca*o;const cc={x:c.x+ox,y:c.y+oy};const sv=c.x;c.x=cc.x;c.y=cc.y;mk(c.ang,c.R*0.7);c.x=sv;c.y-=oy;}
}
const T0=Date.now();
for(const c of cities){if(c.type>=1)buildCity(c);else buildVillage(c)}
for(let i=cities.length-1;i>=0;i--){const c=cities[i];if(c.type===0&&c.vst.length===0)c.dead=true;if(c.type>=1&&c.nblocks<4)c.dead=true}
const live=cities.filter(c=>!c.dead);
for(const c of live)addF(c,c.bb[0],c.bb[1],c.bb[2],c.bb[3]);

// ---------------------------------------------------------------- inter-city routes
function routePts(ax,ay,bx,by,amp,det,ph,step){
  const dx=bx-ax,dy=by-ay,L=M.hypot(dx,dy),nx=-dy/L,ny=dx/L,n=M.max(2,M.ceil(L/step));const pts=[];
  for(let k=0;k<=n;k++){const t=k/n;const env=M.sin(PI*t);
    const off=env*(noise(t*L/9000+ph,ph*1.37)*M.min(L*amp,2600)+noise(t*L/1300+ph*2.1,3.3+ph)*det);
    pts.push(ax+dx*t+nx*off,ay+dy*t+ny*off)}return pts}
const pairs=new Set();
function connect(A,B,k){const key=A.id<B.id?A.id+'_'+B.id+'_'+k:B.id+'_'+A.id+'_'+k;if(pairs.has(key))return;pairs.add(key);
  const dx=B.x-A.x,dy=B.y-A.y,L=M.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const rr=(C,ang)=>C.type===3?(k===0?ringR(C,ang):C.R*1.0):C.type===2?C.R*0.82:C.type===1?C.R*0.6:0;const ra=rr(A,M.atan2(uy,ux)),rb=rr(B,M.atan2(-uy,-ux));
  const ax=A.x+ux*ra,ay=A.y+uy*ra,bx=B.x-ux*rb,by=B.y-uy*rb;
  const cfg=k===0?[0.1,60,420,900,0.2]:k===1?[0.1,50,300,450,0.15]:k===5?[0.07,30,380,700,0.2]:[0.13,40,160,150,0.1];
  for(let a=0;a<4;a++){const ph=hr(A.id,B.id,k*13+a)*100;const pts=routePts(ax,ay,bx,by,cfg[0]*(a%2?-1:1),cfg[1],ph,cfg[2]);
    if(waterRunOK(pts,cfg[3],cfg[4])){const r=mkRoad(k,pts);if(r){bridgesOf(r);if(k===0){if(A.type===3)JUNC.push([A,ax,ay]);if(B.type===3)JUNC.push([B,bx,by])}}return}}}
const JUNC=[];
function ringR(c,a){return c.R*(1.08+0.07*noise(M.cos(a)*1.5+c.id,M.sin(a)*1.5))}
const bigs=live.filter(c=>c.type>=2),towns=live.filter(c=>c.type===1),vills=live.filter(c=>c.type===0);
function nearest(c,list,n,maxD){return list.filter(o=>o!==c).map(o=>[o,M.hypot(o.x-c.x,o.y-c.y)]).filter(a=>a[1]<maxD).sort((a,b)=>a[1]-b[1]).slice(0,n).map(a=>a[0])}
for(const c of bigs)for(const o of nearest(c,bigs,3,34000))connect(c,o,0);
for(const c of bigs)for(const o of nearest(c,bigs,2,48000))connect(c,o,5);
for(const c of towns)for(const o of nearest(c,live.filter(q=>q.type>=1),2,16000))connect(c,o,1);
for(const c of vills){const nn=nearest(c,live,2,7000);if(nn[0])connect(c,nn[0],4);if(nn[1]&&hr(c.id,1,1)<0.45)connect(c,nn[1],4)}
// ring roads
for(const c of bigs){if(c.type!==3)continue;const n=96,pts=[],wat=[];
  for(let k=0;k<n;k++){const a=k/n*TAU;const rr=ringR(c,a);const x=c.x+M.cos(a)*rr,y=c.y+M.sin(a)*rr;pts.push([x,y]);wat.push(landE(x,y,0)<0)}
  let st=wat.indexOf(true);const runs=[];
  if(st<0){const p=[];for(let k=0;k<=n;k++)p.push(pts[k%n][0],pts[k%n][1]);runs.push(p)}else{
    let cur=[],wrun=0;for(let q=1;q<=n;q++){const k=(st+q)%n;if(wat[k]){wrun++;cur.push(pts[k][0],pts[k][1]);if(wrun>3){if(cur.length>8)runs.push(cur.slice(0,cur.length-2*wrun));cur=[]}}else{wrun=0;cur.push(pts[k][0],pts[k][1])}}
    if(cur.length>8)runs.push(cur)}
  c.rings=[];for(const p of runs){const r=mkRoad(0,p,{ring:1});if(r){bridgesOf(r);c.rings.push(r)}}}

// ---------------------------------------------------------------- zones
const zones=[],emitters=[],airports=[],farms=[];
const ZS={ind:[1300,850],ref:[1500,1050],pow:[760,560],port:[820,900],air:[4300,1500],solar:[620,420],agro:[520,340],farm:[300,200],dacha:[760,520],cem:[380,260],quarry:[700,520]};const OLDK=['ind','ref','pow','port','air','solar'];
function zoneFree(x,y,rad,self){
  for(const c of live){if(c===self)continue;const d=M.hypot(c.x-x,c.y-y);if(d<c.R*1.1+rad)return false}
  if(self&&M.hypot(self.x-x,self.y-y)<self.R*1.02+rad*0.6)return false;
  for(const z of zones){if(M.hypot(z.x-x,z.y-y)<z.rad+rad+80)return false}return true}
function segBox(ax,ay,bx,by,hx,hy){let t0=0,t1=1;const dx=bx-ax,dy=by-ay;const P=[-dx,dx,-dy,dy],Q=[ax+hx,hx-ax,ay+hy,hy-ay];
  for(let i=0;i<4;i++){if(P[i]===0){if(Q[i]<0)return false}else{const t=Q[i]/P[i];if(P[i]<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}}return true}
function roadHits(x,y,a,W,H,mg,skip){const ca=M.cos(a),sa=M.sin(a),rad=M.hypot(W,H)/2+mg;const L=queryRoads(x-rad,y-rad,x+rad,y+rad);
  for(const r of L){if(r===skip||r.k===8)continue;const m=mg+RW[r.k]/2;for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2]-x,ay=r.pts[i*2+1]-y,bx=r.pts[i*2+2]-x,by=r.pts[i*2+3]-y;
    if(segBox(ax*ca+ay*sa,-ax*sa+ay*ca,bx*ca+by*sa,-bx*sa+by*ca,W/2+m,H/2+m))return true}}return false}
function placeZone(c,kind){
  let [W,H]=ZS[kind];if(kind==='ind'){const s=c.type===3?1:c.type===2?0.75:0.48;W*=s;H*=s}
  const rad=M.hypot(W,H)/2;const R=rng(hh(c.id,OLDK.includes(kind)?kind.length:100+kind.charCodeAt(0)*7+kind.charCodeAt(1),77));const a0=R()*TAU;
  for(let k=0;k<48;k++){const a=a0+k*TAU/16;const ca=M.cos(a),sa=M.sin(a);const ring=(k>>4)*900;
    if(kind==='port'){let found=-1;for(let d=c.R*0.7;d<c.R+2200;d+=60){if(baseH(c.x+ca*d,c.y+sa*d,7)<-0.01){found=d;break}}
      if(found<0)continue;const d=found-260;const x=c.x+ca*d,y=c.y+sa*d;
      let okk=true;for(let q=-2;q<=2;q++){const px=x-ca*160-sa*q*180,py=y-sa*160+ca*q*180;if(landE(px,py,0.002)<0){okk=false;break}}
      if(!okk)continue;if(!zoneFree(x,y,rad*0.7,c))continue;return mkZone(c,kind,x,y,a,W,H,rad)}
    const d=c.R*1.05+rad+120+ring;const x=c.x+ca*d,y=c.y+sa*d;if(x<4000||y<4000||x>WORLD-4000||y>WORLD-4000)continue;
    const za=a+PI/2+(R()-0.5)*0.3,zc=M.cos(za),zs=M.sin(za);let okk=true;
    for(let q=0;q<25&&okk;q++){const u=((q%5)/4-0.5)*W*1.05,v=((q/5|0)/4-0.5)*H*1.05;const px=x+u*zc-v*zs,py=y+u*zs+v*zc;const e=landE(px,py,0.003);if(e<0||e>(kind==='air'?0.3:0.4))okk=false}
    if(!okk||!zoneFree(x,y,rad,c))continue;if(!OLDK.includes(kind)&&roadHits(x,y,za,W,H,6,null))continue;return mkZone(c,kind,x,y,za,W,H,rad)}
  return null}
function mkZoneRaw(c,kind,x,y,a,W,H){const rad=M.hypot(W,H)/2;const z={kind:'zone',zk:kind,id:zones.length,city:c,x,y,ang:a,ca:M.cos(a),sa:M.sin(a),W,H,rad,seed:hh(c?c.id:7,zones.length,93)};
  z.bb=[x-rad-50,y-rad-50,x+rad+50,y+rad+50];zones.push(z);genZone(z);addF(z,z.bb[0],z.bb[1],z.bb[2],z.bb[3]);return z}
function mkZone(c,kind,x,y,a,W,H,rad){const z={kind:'zone',zk:kind,id:zones.length,city:c,x,y,ang:a,ca:M.cos(a),sa:M.sin(a),W,H,rad,seed:hh(c.id,zones.length,91)};
  z.bb=[x-rad-50,y-rad-50,x+rad+50,y+rad+50];zones.push(z);genZone(z);addF(z,z.bb[0],z.bb[1],z.bb[2],z.bb[3]);
  // access road
  if(kind!=='port'||true){const dx=c.x-x,dy=c.y-y,L=M.hypot(dx,dy);const ux=dx/L,uy=dy/L;const sx=x+ux*rad*0.55,sy=y+uy*rad*0.55;const ex=c.x-ux*c.R*0.75,ey=c.y-uy*c.R*0.75;
    if(M.hypot(ex-sx,ey-sy)>60){const r=mkRoad(['farm','dacha','cem'].includes(kind)?4:1,[sx,sy,(sx+ex)/2+(-uy)*40,(sy+ey)/2+ux*40,ex,ey]);if(r)bridgesOf(r)}}
  return z}
for(const c of live){if(c.type<1)continue;const R=rng(c.seed^0x3131);
  if(c.type===3){placeZone(c,'air');placeZone(c,'port');placeZone(c,'ind');placeZone(c,'ind');if(R()<0.6)placeZone(c,'ref');placeZone(c,'pow');if(R()<0.5)placeZone(c,'solar')}
  else if(c.type===2){placeZone(c,'ind');if(R()<0.5)placeZone(c,'port');if(R()<0.35)placeZone(c,'ref');if(R()<0.45)placeZone(c,'pow');if(R()<0.3)placeZone(c,'solar')}
  else{if(R()<0.6)placeZone(c,'ind');else if(R()<0.25)placeZone(c,'solar')}}

// extra zones (countryside & suburbs)
for(const c of live){const R=rng(c.seed^0x5151);
  if(c.type>=1){if(R()<(c.type>=2?0.85:0.3))placeZone(c,'dacha');if(R()<0.55)placeZone(c,'cem');if(R()<0.3)placeZone(c,'agro');if(baseH(c.x,c.y,6)>0.18&&R()<0.45)placeZone(c,'quarry')}
  else if(R()<0.32)placeZone(c,'farm')}
// interchanges -------------------------------------------------------------
function addClover(Jx,Jy,tx,ty,nx,ny){const rl=46,D=17;
  for(const sa of [-1,1])for(const sb of [-1,1]){const ax=tx*sa,ay=ty*sa,bx=nx*sb,by=ny*sb;const qx=Jx+(ax+bx)*(rl+D),qy=Jy+(ay+by)*(rl+D);
    const pts=[qx-ax*rl+bx*55,qy-ay*rl+by*55];for(let d=180;d>=-90;d-=10){const t=d*PI/180;pts.push(qx+rl*(M.cos(t)*ax+M.sin(t)*bx),qy+rl*(M.cos(t)*ay+M.sin(t)*by))}
    pts.push(qx-bx*rl+ax*55,qy-by*rl+ay*55);mkRoad(6,pts);
    const p1x=Jx+ax*(D+3)+bx*rl*3.3,p1y=Jy+ay*(D+3)+by*rl*3.3,p2x=Jx+bx*(D+3)+ax*rl*3.3,p2y=Jy+by*(D+3)+ay*rl*3.3,cx=Jx+(ax+bx)*rl*3.05,cy=Jy+(ay+by)*rl*3.05;
    const op=[];for(let q=0;q<=14;q++){const t=q/14,u=1-t;op.push(u*u*p1x+2*u*t*cx+t*t*p2x,u*u*p1y+2*u*t*cy+t*t*p2y)}mkRoad(6,op)}}
function nearestS(r,x,y){let best=1e18,bs=0;for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],bx=r.pts[i*2+2],by=r.pts[i*2+3];const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy||1;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=clamp(t,0,1);const px=ax+dx*t,py=ay+dy*t;const d=(px-x)**2+(py-y)**2;if(d<best){best=d;bs=r.cum[i]+t*M.sqrt(l2)}}return [M.sqrt(best),bs]}
for(const [c,jx,jy] of JUNC){if(landE(jx,jy,0)<0)continue;const L=M.hypot(jx-c.x,jy-c.y);const nx=(jx-c.x)/L,ny=(jy-c.y)/L;addClover(jx,jy,-ny,nx,nx,ny);
  mkRoad(2,[jx,jy,c.x+(jx-c.x)*0.8,c.y+(jy-c.y)*0.8]);
  for(const r of c.rings||[]){const [d,s]=nearestS(r,jx,jy);if(d<120){(r.ov=r.ov||[]).push([s-42,s+42]);break}}}
// grade-separated crossings ----------------------------------------------
{const SC=512,SN=WORLD/SC;const cells=new Map();
  for(const r of roads){if(r.k===6||r.k===8)continue;for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],bx=r.pts[i*2+2],by=r.pts[i*2+3];
    const a=clamp(M.floor(M.min(ax,bx)/SC),0,SN-1),b=clamp(M.floor(M.max(ax,bx)/SC),0,SN-1),c0=clamp(M.floor(M.min(ay,by)/SC),0,SN-1),d=clamp(M.floor(M.max(ay,by)/SC),0,SN-1);
    for(let j=c0;j<=d;j++)for(let q=a;q<=b;q++){const key=j*SN+q;let A=cells.get(key);if(!A){A=[];cells.set(key,A)}A.push(r.id*4096+i)}}}
  const seen=new Set();
  for(const [key,A] of cells){if(A.length<2)continue;const cx0=(key%SN)*SC,cy0=M.floor(key/SN)*SC;
    for(let p=0;p<A.length;p++){const ra=roads[A[p]>>>12],ia=A[p]&4095;for(let q=p+1;q<A.length;q++){const rb=roads[A[q]>>>12],ib=A[q]&4095;if(ra===rb)continue;
      const ka=ra.k,kb=rb.k;if(!(ka===0||kb===0||ka===5||kb===5))continue;if(ka===5&&kb===5)continue;if((ka===4&&kb===5)||(ka===5&&kb===4))continue;
      const ax=ra.pts[ia*2],ay=ra.pts[ia*2+1],bx=ra.pts[ia*2+2],by=ra.pts[ia*2+3],cx=rb.pts[ib*2],cy=rb.pts[ib*2+1],dx=rb.pts[ib*2+2],dy=rb.pts[ib*2+3];
      const r1x=bx-ax,r1y=by-ay,r2x=dx-cx,r2y=dy-cy,den=r1x*r2y-r1y*r2x;if(M.abs(den)<1e-9)continue;
      const t=((cx-ax)*r2y-(cy-ay)*r2x)/den,u=((cx-ax)*r1y-(cy-ay)*r1x)/den;if(t<0||t>1||u<0||u>1)continue;
      const X=ax+r1x*t,Y=ay+r1y*t;if(X<cx0||X>=cx0+SC||Y<cy0||Y>=cy0+SC)continue;
      const sA=ra.cum[ia]+t*M.hypot(r1x,r1y),sB=rb.cum[ib]+u*M.hypot(r2x,r2y);if(sA<30||sA>ra.L-30||sB<30||sB>rb.L-30)continue;
      const kk=M.min(ra.id,rb.id)+'_'+M.max(ra.id,rb.id)+'_'+M.round(X/50)+'_'+M.round(Y/50);if(seen.has(kk))continue;seen.add(kk);
      if(landE(X,Y,0)<0)continue;
      let up,lo,su;if(ka===5){up=rb;lo=ra;su=sB}else if(kb===5){up=ra;lo=rb;su=sA}else if(ka===0&&kb===0){if(ra.id>rb.id){up=ra;lo=rb;su=sA}else{up=rb;lo=ra;su=sB}}
      else if(ka===0){up=ra;lo=rb;su=sA}else{up=rb;lo=ra;su=sB}
      const hw=RW[lo.k]/2+24;(up.ov=up.ov||[]).push([su-hw,su+hw]);
      if(ka===0&&kb===0&&!ra.ring&&!rb.ring){const l1=M.hypot(r1x,r1y),l2=M.hypot(r2x,r2y);const cosA=M.abs((r1x*r2x+r1y*r2y)/(l1*l2));if(cosA<0.6){addClover(X,Y,r1x/l1,r1y/l1,r2x/l2,r2y/l2)}}}}}}
// gas stations along highways / trunk roads ---------------------------------
var GASOFF=40,GASHW=false;
{const base=roads.length;for(let i=0;i<base;i++){const r=roads[i];if((r.k!==0&&r.k!==1)||r.ring||r.L<5000)continue;const R=rng(hh(r.id,5,55));
  for(let s=2000+R()*3000;s<r.L-2000;s+=7000+R()*6000){const p=posAt(r,s);const dx=p[2],dy=p[3];const off=RW[r.k]/2+34;const x=p[0]-dy*off,y=p[1]+dx*off;
    if(landE(x,y,0.004)<0||landE(x+dx*40,y+dy*40,0.004)<0||landE(x-dx*40,y-dy*40,0.004)<0)continue;let bad=false;
    for(const c of live)if(M.hypot(c.x-x,c.y-y)<c.R*1.15+120){bad=true;break}if(!bad)for(const z of zones)if(M.hypot(z.x-x,z.y-y)<z.rad+60){bad=true;break}if(bad)continue;
    if(roadHits(x,y,M.atan2(dy,dx),84,54,3,r))continue;GASOFF=off;GASHW=r.k===0;mkZoneRaw(null,'gas',x,y,M.atan2(dy,dx),84,54)}}}
// railway stations at line ends --------------------------------------------
for(const r of roads.slice()){if(r.k!==5)continue;for(const end of [0,1]){
  for(let d=300;d<3200;d+=120){const s=end?r.L-d:d;if(s<300||s>r.L-300)break;const p=posAt(r,s);const ux=p[2],uy=p[3],cx=p[0],cy=p[1];
    if(landE(cx,cy,0.003)<0||landE(cx+ux*240,cy+uy*240,0.003)<0||landE(cx-ux*240,cy-uy*240,0.003)<0)continue;let bad=false;
    for(const z of zones)if(M.hypot(z.x-cx,z.y-cy)<z.rad+260){bad=true;break}if(bad)continue;
    for(const c of live)if(M.hypot(c.x-cx,c.y-cy)<c.R*1.6+300&&(cityF(c,cx,cy)<1.08||cityF(c,cx+ux*250,cy+uy*250)<1.08||cityF(c,cx-ux*250,cy-uy*250)<1.08)){bad=true;break}
    if(bad||roadHits(cx,cy,M.atan2(uy,ux),500,96,4,r))continue;mkZoneRaw(null,'stn',cx,cy,M.atan2(uy,ux),500,96);break}}}
// power lines --------------------------------------------------------------
for(const z of zones.slice()){if(z.zk!=='pow')continue;const targets=[z.city].concat(nearest(z.city,live.filter(c=>c.type>=1),2,26000));
  for(const c of targets){const dx=c.x-z.x,dy=c.y-z.y,L=M.hypot(dx,dy);const ex=c.x-dx/L*c.R*0.92,ey=c.y-dy/L*c.R*0.92;const sx=z.x+dx/L*z.rad*0.6,sy=z.y+dy/L*z.rad*0.6;const LL=M.hypot(ex-sx,ey-sy);if(LL<400)continue;
    const n=M.ceil(LL/330);const pts=[];const ph=hr(z.id,c.id,3)*50;for(let q=0;q<=n;q++){const t=q/n;const o=M.sin(PI*t)*noise(t*3+ph,ph)*LL*0.06;pts.push(sx+(ex-sx)*t+(-(ey-sy)/LL)*o,sy+(ey-sy)*t+((ex-sx)/LL)*o)}mkRoad(8,pts)}}
// wind farms
{const CELL=7000,NC=M.floor(WORLD/CELL);for(let cy=0;cy<NC;cy++)for(let cx=0;cx<NC;cx++){const R=rng(hh(cx,cy,313));if(R()>0.3)continue;
  const x=(cx+0.2+0.6*R())*CELL,y=(cy+0.2+0.6*R())*CELL;const e=landE(x,y,0.01);if(e<0.03||e>0.3)continue;
  let bad=false;for(const c of live){if(M.hypot(c.x-x,c.y-y)<c.R+700){bad=true;break}}for(const z of zones){if(M.hypot(z.x-x,z.y-y)<z.rad+700){bad=true;break}}if(bad)continue;const a=R()*PI,ca=M.cos(a),sa=M.sin(a);const rows=2+(R()*2|0),per=4+(R()*4|0);const tb=[];
  for(let r=0;r<rows;r++)for(let k=0;k<per;k++){const u=(k-(per-1)/2)*380,v=(r-(rows-1)/2)*620+(k%2)*60;const px=x+u*ca-v*sa,py=y+u*sa+v*ca;
    if(landE(px,py,0.006)<0)continue;let inC=false;for(const c of live){if(M.hypot(c.x-px,c.y-py)<c.R*1.2+250){inC=true;break}}if(inC)continue;
    tb.push({x:px,y:py,ph:R()*TAU,sp:1.1+R()*0.5})}
  if(tb.length<3)continue;const f={kind:'farm',t:tb,bb:[x-2200,y-2200,x+2200,y+2200]};farms.push(f);addF(f,f.bb[0],f.bb[1],f.bb[2],f.bb[3])}}

// ------- zone content (local coords, x along zone axis)
function G(P,x,y,w,h,c){P.push({k:'g',x,y,w,h,c})}
function B(P,x,y,w,h,H,c,r,ex){const o={k:'b',x,y,w,h,H,c,r};if(ex)for(const q in ex)o[q]=ex[q];P.push(o);return o}
function TR(P,x,y,d,v){P.push({k:'t',x,y,d,v})}
function CY(P,x,y,r,H,c,st){P.push({k:'cyl',x,y,r,H,c,st})}
function LN(P,pts,w,c,dash){P.push({k:'gl',pts,w,c,dash})}
function PK(P,x,y,w,h,fill,seed,truck){P.push({k:'pk',x,y,w,h,fill,seed,truck})}
function zemit(z,lx,ly,k,s,H){H=H||0;emitters.push({x:z.x+lx*z.ca-ly*z.sa+LEANX*H,y:z.y+lx*z.sa+ly*z.ca+LEANY*H,k,s,H,ph:hr(lx|0,ly|0,z.id)})}
function genZone(z){
  const R=rng(z.seed),P=[],W=z.W,H=z.H;z.prims=P;
  const ASP=[78,80,84],CON=[160,158,152],GRV=[150,146,136];
  if(z.zk==='ind'){
    G(P,-W/2,-H/2,W,H,[142,139,130]);
    const nx=M.max(2,M.round(W/230)),ny=M.max(2,M.round(H/210)),cw=W/nx,ch=H/ny;
    for(let i=0;i<=nx;i++)LN(P,[-W/2+i*cw,-H/2,-W/2+i*cw,H/2],9,ASP);for(let j=0;j<=ny;j++)LN(P,[-W/2,-H/2+j*ch,W/2,-H/2+j*ch],9,ASP);
    P.push({k:'rail',pts:[-W/2,-H/2+ch-12,W/2,-H/2+ch-12]});
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x0=-W/2+i*cw+9,y0=-H/2+j*ch+9,w=cw-18,h=ch-18;const r=R();
      if(r<0.38){const c=ROOF_IND[R()*ROOF_IND.length|0];const bw=w*(0.72+R()*0.2),bh=h*(0.55+R()*0.3);B(P,x0+4,y0+4,bw,bh,9+R()*6,c,'co');
        PK(P,x0+4,y0+bh+10,M.min(bw,w-8),M.min(16,h-bh-14),0.7,R()*1e9|0,1)}
      else if(r<0.66){G(P,x0,y0,w,h,CON);P.push({k:'lflood',x:x0,y:y0,w,h,sp:70,r:24,c:'sod'});const n=2+(R()*3|0);for(let q=0;q<n;q++){const bw=w*(0.25+R()*0.35),bh=h*(0.25+R()*0.35);const bx=x0+R()*(w-bw),by=y0+R()*(h-bh);B(P,bx,by,bw,bh,8+R()*20,ROOF_IND[R()*7|0],R()<0.5?'co':'f')}
        const nc=1+(R()*2|0);for(let q=0;q<nc;q++){const cx=x0+10+R()*(w-20),cy=y0+10+R()*(h-20),H2=50+R()*70;CY(P,cx,cy,2.5+R()*2,H2,[180,70,60],'chim');zemit(z,cx,cy,'smoke',0.7+R()*0.6,H2)}
        if(R()<0.5)for(let q=0;q<3;q++)CY(P,x0+w-14-q*16,y0+h-14,6,10,[200,200,198],'tank')}
      else if(r<0.8){PK(P,x0,y0,w,h,0.55,R()*1e9|0,1)}
      else if(r<0.86){G(P,x0,y0,w,h,CON);const n=M.max(3,M.floor((w-20)/12));for(let q=0;q<n;q++)for(let rr2=0;rr2<2;rr2++)CY(P,x0+12+q*12,y0+h*0.35+rr2*12,5.6,34,[208,204,196],'tank');B(P,x0+6,y0+h*0.35-10,8,30,48,[200,196,188],'f');PK(P,x0+6,y0+h-20,w-12,14,0.5,R()*1e9|0,1)}
      else if(r<0.92){G(P,x0,y0,w,h,GRV);for(let q=0;q<5;q++)P.push({k:'pile',x:x0+20+R()*(w-40),y:y0+20+R()*(h-40),r:10+R()*16,c:[[60,58,56],[190,170,130],[150,140,125],[120,80,60]][R()*4|0]})}
      else{G(P,x0,y0,w,h,CON);for(let a=0;a<2;a++)for(let b=0;b<2;b++)CY(P,x0+w*0.3+a*w*0.4,y0+h*0.3+b*h*0.4,M.min(w,h)*0.14,14,[210,210,205],'tank')}}
    for(let q=0;q<30;q++)TR(P,(R()-0.5)*W,(R()<0.5?-1:1)*(H/2-4),5+R()*4,R()*6|0);
  }else if(z.zk==='ref'){
    G(P,-W/2,-H/2,W,H,[166,160,146]);
    LN(P,[-W/2,0,W/2,0],10,ASP);LN(P,[-W*0.12,-H/2,-W*0.12,H/2],10,ASP);LN(P,[W*0.2,-H/2,W*0.2,H/2],9,ASP);
    // tank farm
    const tx0=-W/2+30,tx1=-W*0.12-30;const sp=78;
    for(let y=-H/2+50;y<H/2-40;y+=sp){if(M.abs(y)<45)continue;for(let x=tx0+40;x<tx1-20;x+=sp){const r=22+R()*12;G(P,x-sp/2+4,y-sp/2+4,sp-8,sp-8,[154,150,136]);P.push({k:'bund',x:x-sp/2+4,y:y-sp/2+4,w:sp-8,h:sp-8});
      CY(P,x,y,r,16,R()<0.8?[214,214,210]:[90,92,96],'tank')}}
    // process units
    for(let y=-H/2+30;y<H/2-30;y+=130){for(let x=-W*0.12+30;x<W/2-30;x+=150){if(M.abs(y+50)<30)continue;
      G(P,x,y,130,105,[172,172,168]);P.push({k:'lflood',x,y,w:130,h:105,sp:44,r:16,c:'sod'});
      // pipe rack
      P.push({k:'pipe',pts:[x,y+52,x+130,y+52],n:5,w:7});
      const nc=2+(R()*4|0);for(let q=0;q<nc;q++)CY(P,x+12+R()*106,y+10+R()*30,2.5+R()*3,35+R()*40,[200,200,204],'tower');
      for(let q=0;q<2;q++)B(P,x+8+q*60,y+64,40+R()*15,26+R()*10,8+R()*10,ROOF_IND[R()*7|0],'f');
      if(R()<0.4){CY(P,x+115,y+90,3,60,[180,70,60],'chim');zemit(z,x+115,y+90,'smoke',0.5,60)}
      if(R()<0.3)for(let q=0;q<4;q++)CY(P,x+20+q*25,y+95,8,8,[225,225,222],'sphere')}}
    // spheres row
    for(let q=0;q<6;q++)CY(P,W*0.2+30+q*28,H/2-30,10,14,[232,232,228],'sphere');
    // flares
    for(let q=0;q<2;q++){const fx=W/2-30,fy=-H/2+60+q*90;CY(P,fx,fy,2.2,90,[190,60,50],'chim');zemit(z,fx,fy,'flare',1,90)}
    P.push({k:'pipe',pts:[-W*0.12,-8,W/2,-8],n:8,w:9});P.push({k:'pipe',pts:[-W*0.12-8,-H/2,-W*0.12-8,H/2],n:6,w:8});
    P.push({k:'rail',pts:[-W/2,H/2-12,W/2,H/2-12]});P.push({k:'rail',pts:[-W/2,H/2-20,W/2,H/2-20]});
  }else if(z.zk==='pow'){
    G(P,-W/2,-H/2,W,H,[150,148,140]);
    G(P,-W/2+10,-H/2+10,W*0.36,H*0.5,[58,56,54]);for(let q=0;q<5;q++)P.push({k:'pile',x:-W/2+40+R()*(W*0.36-60),y:-H/2+40+R()*(H*0.5-60),r:20+R()*20,c:[40,38,36]});
    P.push({k:'pipe',pts:[-W/2+W*0.36,-H/2+H*0.25,-W*0.05,-H*0.05],n:1,w:5});
    B(P,-W*0.05,-H*0.12,W*0.38,H*0.16,42,[176,182,190],'co');P.push({k:'lflood',x:-W*0.1,y:-H*0.2,w:W*0.5,h:H*0.42,sp:60,r:22,c:'sod'});B(P,-W*0.05,H*0.04,W*0.22,H*0.12,58,[150,154,160],'f');
    for(let q=0;q<2;q++){const cx=W*0.22+q*30,cy=H*0.12;CY(P,cx,cy,6.5,180+q*20,[200,60,50],'chim');zemit(z,cx,cy,'smoke',1.5,180+q*20)}
    for(let q=0;q<3;q++){const cx=-W*0.25+q*W*0.28,cy=H*0.33;CY(P,cx,cy,48,120,[196,194,188],'cool');zemit(z,cx,cy,'steam',1,120)}
    G(P,W*0.25,-H/2+12,W*0.23,H*0.42,[128,126,118]);P.push({k:'switch',x:W*0.25,y:-H/2+12,w:W*0.23,h:H*0.42});P.push({k:'lflood',x:W*0.25,y:-H/2+12,w:W*0.23,h:H*0.42,sp:55,r:18,c:'led'});
    P.push({k:'rail',pts:[-W/2,-H/2+H*0.55,W*0.1,-H/2+H*0.55]});
  }else if(z.zk==='port'){
    // x>0 is seaward. land part x in [-W/2,0]
    const LW=W*0.62;G(P,-LW,-H/2,LW+40,H,[150,148,142]);
    // quay apron
    G(P,0,-H/2,40,H,[176,174,168]);P.push({k:'lflood',x:0,y:-H/2,w:40,h:H,sp:55,r:30,c:'led'});
    // piers
    const np=2+(R()*2|0);for(let q=0;q<np;q++){const py=-H/2+(q+0.5)*H/np;G(P,40,py-28,300,56,[170,168,160]);P.push({k:'lflood',x:40,y:py-28,w:300,h:56,sp:60,r:26,c:'led'});
      for(let s=0;s<2;s++){P.push({k:'ship',x:40+150,y:py+(s?44:-44),a:0,len:150+R()*90,st:R()<0.6?0:R()<0.5?1:2,c:R()*6|0});}
      for(let c=0;c<3;c++)P.push({k:'crane',x:60+c*80,y:py-20,len:60,c:[[200,60,50],[60,110,180],[230,150,40]][R()*3|0]})}
    for(let c=0;c<H/90-1;c++)P.push({k:'crane',x:10,y:-H/2+50+c*90,len:70,c:[[200,60,50],[60,110,180],[230,150,40]][R()*3|0]});
    // container yard
    P.push({k:'cont',x:-LW*0.62,y:-H/2+20,w:LW*0.55,h:H-40,seed:R()*1e9|0});
    LN(P,[-LW*0.66,-H/2,-LW*0.66,H/2],12,ASP);
    for(let q=0;q<3;q++)B(P,-LW+14,-H/2+20+q*(H/3),LW*0.3,H/3-40,14,ROOF_IND[R()*7|0],'co');
    P.push({k:'rail',pts:[-LW+6,-H/2,-LW+6,H/2]});
  }else if(z.zk==='air'){
    G(P,-W/2,-H/2,W,H,[120,142,88]);P.push({k:'mow',x:-W/2,y:-H/2,w:W,h:H});
    P.push({k:'rw',x:-1650,y:-30,w:3300,h:60});
    G(P,-1600,-202,3200,24,[96,96,98]);P.push({k:'ltaxi',x:-1600,y:-202,w:3200,h:24});P.push({k:'lflood',x:-1000,y:-560,w:1500,h:350,sp:110,r:46,c:'sod'});P.push({k:'lflood',x:-900,y:-740,w:1300,h:80,sp:60,r:22,c:'led'});LN(P,[-1600,-190,1600,-190],0.4,[230,190,60],[0]);
    for(let q=0;q<7;q++){const x=-1500+q*500;G(P,x-12,-190,24,160,[96,96,98])}
    G(P,-1000,-560,1500,350,[168,168,162]);
    for(let q=0;q<14;q++)P.push({k:'plane',x:-940+q*100,y:-430+(q%2)*0,a:-PI/2,s:R()<0.3?1.4:1,c:R()*5|0});
    for(let q=0;q<4;q++)P.push({k:'plane',x:-850+q*110,y:-280,a:0,s:0.8,c:R()*5|0});
    B(P,-1000,-640,1500,70,22,[120,140,160],'gl');for(let q=0;q<14;q++)B(P,-950+q*100,-570,8,40,6,[200,200,200],'f');
    PK(P,-900,-740,1300,80,0.75,R()*1e9|0,0);
    for(let q=0;q<3;q++)B(P,700+q*230,-600,180,120,24,[190,192,196],'co');
    CY(P,560,-620,7,55,[200,200,205],'tower');
    LN(P,[-1000,-700,-1000,-H/2],14,ASP);
  }else if(z.zk==='agro'){
    G(P,-W/2,-H/2,W,H,[150,148,128]);let y=-H/2+14;while(y<H/2-60){B(P,-W/2+14,y,W-60,46,6,[214,226,224],'glh',{fc:[200,220,222]});y+=56}
    B(P,W/2-40,-H/2+14,28,22,9,[170,150,130],'f');CY(P,W/2-26,-H/2+50,2.2,32,[180,70,60],'chim');zemit(z,W/2-26,-H/2+50,'smoke',0.45,32);PK(P,W/2-42,-H/2+70,30,16,0.6,R()*1e9|0);
  }else if(z.zk==='farm'){
    G(P,-W/2,-H/2,W,H,[138,126,100]);const cols=[[176,178,180],[206,206,202],[150,60,50],[120,126,130]];
    for(let q=0;q<4;q++)B(P,-W/2+12,-H/2+12+q*30,W*0.56,20,8,cols[R()*4|0],'co');
    for(let q=0;q<3;q++){G(P,W*0.18,-H/2+14+q*22,W*0.22,16,[172,170,164]);G(P,W*0.18+2,-H/2+16+q*22,W*0.22-4,12,q===1?[110,96,60]:[86,104,58])}
    for(let q=0;q<3;q++)CY(P,W/2-20,-H/2+20+q*16,5,18,[q===1?150:110,140,160],'tank');
    P.push({k:'gc',x:W*0.3,y:H/2-35,r:22,c:[96,82,58]});P.push({k:'bales',x:-W/2+14,y:H/2-46,w:W*0.4,h:34,seed:R()*1e9|0});PK(P,W*0.05,H/2-30,40,12,0.5,R()*1e9|0,1);
  }else if(z.zk==='dacha'){
    G(P,-W/2,-H/2,W,H,[108,128,76]);const lw=18,lh=26;
    for(let y=-H/2+6;y<H/2-lh;y+=lh*2+6){LN(P,[-W/2,y+lh+3,W/2,y+lh+3],4,[150,134,104]);
      for(let x=-W/2+4;x<W/2-lw;x+=lw){for(const side of [0,1]){if(R()<0.1)continue;const ly=side?y+lh+6:y;const gc=[[100,124,66],[112,128,72],[118,120,74],[92,118,62]][R()*4|0];G(P,x+0.5,ly+0.5,lw-1,lh-1,gc);P.push({k:'fence',x:x+0.3,y:ly+0.3,w:lw-0.6,h:lh-0.6});
        if(R()<0.8)P.push({k:'rows',x:x+2,y:side?ly+lh*0.45:ly+2,w:lw-4,h:lh*0.5,o:R()<0.5?0:1});
        const hw=4+R()*2.5,hd=4+R()*2;const hy=side?ly+2:ly+lh-hd-2;B(P,x+lw/2-hw/2+(R()-0.5)*4,hy,hw,hd,3.6+R()*2,ROOFH[R()*ROOFH.length|0],R()<0.6?'g':'h',{a:(R()-0.5)*0.2});
        if(R()<0.35)P.push({k:'gh',x:x+2+R()*(lw-6),y:side?ly+lh-10:ly+3,w:3,h:6});if(R()<0.6)TR(P,x+2+R()*(lw-4),ly+2+R()*(lh-4),3+R()*4,[0,2,4,6][R()*4|0])}}}
  }else if(z.zk==='cem'){
    G(P,-W/2,-H/2,W,H,[92,110,76]);P.push({k:'fence',x:-W/2+1,y:-H/2+1,w:W-2,h:H-2});
    const nx=M.floor(W/48),ny=M.floor(H/40);for(let i=0;i<=nx;i++)LN(P,[-W/2+i*W/nx,-H/2,-W/2+i*W/nx,H/2],3,[176,166,144]);for(let j=0;j<=ny;j++)LN(P,[-W/2,-H/2+j*H/ny,W/2,-H/2+j*H/ny],3,[176,166,144]);
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)P.push({k:'graves',x:-W/2+i*W/nx+3,y:-H/2+j*H/ny+3,w:W/nx-6,h:H/ny-6,seed:R()*1e9|0});
    for(let q=0;q<70;q++)TR(P,(R()-0.5)*W,(R()-0.5)*H,5+R()*6,[4,1,3,0][R()*4|0]);
    B(P,-8,-H/2+6,16,10,8,[236,232,220],'f');P.push({k:'dome',x:0,y:-H/2+11,r:2.4,c:[230,190,80],H:14,lvl:3});
  }else if(z.zk==='quarry'){
    G(P,-W/2,-H/2,W,H,[160,142,112]);P.push({k:'quarry',x:0,y:0,rx:W*0.42,ry:H*0.4,seed:R()*1e9|0});
    PK(P,W/2-60,-H/2+12,50,14,0.6,R()*1e9|0,1);B(P,W/2-56,H/2-40,40,26,10,[170,160,140],'co');P.push({k:'pipe',pts:[W/2-56,H/2-28,W*0.15,H*0.1],n:1,w:2.5});
    for(let q=0;q<6;q++)P.push({k:'pile',x:-W/2+30+q*28,y:H/2-24,r:10+R()*6,c:[[186,168,130],[140,132,124],[170,150,110]][R()*3|0]});
  }else if(z.zk==='gas'){
    const br=[[200,40,40],[40,140,70],[230,180,30],[40,90,180],[230,110,20]][R()*5|0];
    G(P,-W/2,-H/2,W,H,[90,92,96]);G(P,-W/2,H/2-6,W,6,[110,138,80]);
    const ry=-(GASOFF-(GASHW?RW[0]:RW[1])/2)+2;LN(P,[-W/2-46,ry,-W/2+2,-H/2+4],7.5,[90,92,96]);LN(P,[W/2+46,ry,W/2-2,-H/2+4],7.5,[90,92,96]);z.hw=GASHW;
    for(let q=0;q<3;q++){G(P,-14+q*10,-10,2,8,[200,200,200]);G(P,-14+q*10,-2,2,0.01,[0,0,0])}
    B(P,-20,-14,34,16,5.5,[240,240,238],'f',{cnp:br,nd:1});B(P,10,6,22,11,4,[200,200,198],'f',{fc:[230,226,216]});B(P,-W/2+4,-H/2+3,1.6,1.2,11,br,'f',{nd:1});
    PK(P,-W/2+6,6,24,10.4,0.6,R()*1e9|0);if(z.hw)PK(P,-W/2+30+2,H/2-21,40,12,0.6,R()*1e9|0,1);
    TR(P,W/2-4,-H/2+4,6,0);TR(P,W/2-4,H/2-4,6,2);
  }else if(z.zk==='stn'){
    G(P,-W/2,-H/2,W,H,[132,128,120]);
    for(let q=0;q<6;q++){const y=-22+q*7.6;P.push({k:'rail',pts:[-W/2,y,W/2,y]})}
    for(let q=0;q<3;q++){const y=-22+q*15.2+3.8;G(P,-W*0.36,y-2,W*0.72,4,[178,176,170]);B(P,-W*0.32,y-1.6,W*0.64,3.2,5,[150,160,168],'co',{nd:1})}
    B(P,-40,24,80,18,15,[96,128,96],'h',{fc:[232,220,190]});B(P,-10,24,20,18,22,[96,128,96],'h',{fc:[232,220,190],lvl:1});
    PK(P,-120,30,60,14,0.75,R()*1e9|0);PK(P,60,30,60,14,0.7,R()*1e9|0);G(P,-W/2,42,W,6,[110,138,80]);for(let q=0;q<14;q++)TR(P,-W/2+10+q*35,45,6,0);
  }else if(z.zk==='solar'){
    G(P,-W/2,-H/2,W,H,[146,150,112]);P.push({k:'solar',x:-W/2+15,y:-H/2+15,w:W-30,h:H-30});
    B(P,-W/2+4,-H/2+4,14,10,4,[200,200,200],'f');
  }
}

// ---------------------------------------------------------------- ships & flights
const ships=[];
{for(let tries=0;ships.length<110&&tries<6000;tries++){const R=rng(hh(tries,7,99));const x=R()*WORLD,y=R()*WORLD;if(baseH(x,y,5)>-0.05)continue;
  const a=R()*TAU,L=6000+R()*22000;const bx=x+M.cos(a)*L,by=y+M.sin(a)*L;if(bx<0||by<0||bx>WORLD||by>WORLD)continue;let ok=true;
  for(let s=0;s<=L&&ok;s+=300){if(baseH(x+(bx-x)*s/L,y+(by-y)*s/L,5)>-0.025)ok=false}if(!ok)continue;
  ships.push({ax:x,ay:y,bx,by,L,v:5+R()*6,len:[70,110,160,220,280][R()*5|0],st:R()*3|0,c:R()*6|0,ph:R()*L*2})}
 for(const z of zones){if(z.zk!=='port')continue;const R=rng(z.seed^5);for(let q=0;q<3;q++){const x=z.x+z.ca*500,y=z.y+z.sa*500;const a=z.ang+(R()-0.5)*1.4;const L=8000+R()*12000;const bx=x+M.cos(a)*L,by=y+M.sin(a)*L;let ok=true;
   for(let s=0;s<=L&&ok;s+=300){if(baseH(x+(bx-x)*s/L,y+(by-y)*s/L,5)>-0.01)ok=false}if(ok)ships.push({ax:x,ay:y,bx,by,L,v:4+R()*4,len:[120,180,240][R()*3|0],st:R()*3|0,c:R()*6|0,ph:R()*L*2})}}}
for(const z of zones)if(z.zk==='air'){const ax=z.x-z.ca*1650,ay=z.y-z.sa*1650,bx=z.x+z.ca*1650,by=z.y+z.sa*1650;airports.push({z,ax,ay,bx,by,ux:z.ca,uy:z.sa,name:z.city.name})}
const flights=[];
{const R=rng(SS^0xf1);
 for(const A of airports){const others=airports.filter(o=>o!==A).sort((p,q)=>M.hypot(p.ax-A.ax,p.ay-A.ay)-M.hypot(q.ax-A.ax,q.ay-A.ay)).slice(0,3);
   for(const B of others){for(let k=0;k<2;k++){const pts=[A.ax,A.ay,A.bx,A.by];const app=B.ax-B.ux*16000,apy=B.ay-B.uy*16000;pts.push(A.bx+A.ux*8000,A.by+A.uy*8000,app,apy,B.ax,B.ay,B.ax+B.ux*2400,B.ay+B.uy*2400);
     const f={pts,v:78,ph:R()*5000,alt:3500+R()*3000,kind:0,c:R()*5|0};prepPath(f);flights.push(f)}}}
 for(let q=0;q<28;q++){const a=R()*TAU;const cx=WORLD*(0.2+0.6*R()),cy=WORLD*(0.2+0.6*R());const L=WORLD*1.4;
   const f={pts:[cx-M.cos(a)*L/2,cy-M.sin(a)*L/2,cx+M.cos(a)*L/2,cy+M.sin(a)*L/2],v:220+R()*30,ph:R()*1000,alt:9000+R()*2500,kind:1,c:R()*5|0};prepPath(f);flights.push(f)}
 // stage 2: a lone airport gets circuit flights (take-off, loop, landing on the same runway)
 if(airports.length===1)for(const A of airports)for(let k=0;k<3;k++){const nx=-A.uy,ny=A.ux,sd=k%2?1:-1;
   const pts=[A.ax,A.ay,A.bx,A.by,A.bx+A.ux*9000+nx*sd*(5000+k*1500),A.by+A.uy*9000+ny*sd*(5000+k*1500),A.ax-A.ux*16000,A.ay-A.uy*16000,A.ax,A.ay,A.ax+A.ux*2400,A.ay+A.uy*2400];
   const f={pts,v:78,ph:R()*5000,alt:2600+R()*1400,kind:0,c:R()*5|0};prepPath(f);flights.push(f)}}
function prepPath(f){const n=f.pts.length/2,cum=[0];let L=0;for(let i=1;i<n;i++){L+=M.hypot(f.pts[i*2]-f.pts[i*2-2],f.pts[i*2+1]-f.pts[i*2-1]);cum.push(L)}f.cum=cum;f.L=L;f.n=n}

// ================================================================= RENDERING
let SPR=null;
function sprites(){if(SPR)return SPR;SPR={tree:[],treeS:[[],[],[]],car:[],truck:[],bus:null};
  for(let s=0;s<3;s++)for(let v=0;v<7;v++)SPR.treeS[s].push(mkTree(v,s));SPR.tree=SPR.treeS[0];
  for(let v=0;v<CARC.length;v++)SPR.car.push(mkCar(CARC[v]));
  for(let v=0;v<5;v++)SPR.truck.push(mkTruck(v));SPR.bus=mkBus();return SPR}
const CARC=[[235,235,232],[200,202,206],[40,42,46],[170,30,30],[40,70,140],[120,122,126],[50,80,60],[230,190,40],[190,170,140],[90,30,40],[230,230,230],[30,30,32]];
function mkTree(v,se){const cv=mkCanvas(64,64),x=cv.getContext('2d');const R=rng(777+v*31);const con=v===3||v===5;
  let g=x.createRadialGradient(38,37,2,38,37,24);const sa=se===2&&!con?0.55:1;g.addColorStop(0,`rgba(5,15,5,${0.5*sa})`);g.addColorStop(0.7,`rgba(5,15,5,${0.3*sa})`);g.addColorStop(1,'rgba(5,15,5,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
  let pal=[[62,102,46],[52,92,40],[78,112,50],[38,70,44],[88,118,56],[34,64,42],[96,110,48]][v];
  if(se===1&&!con)pal=[[176,98,34],[196,158,46],[152,54,34],0,[150,138,50],0,[128,88,48]][v];
  if(se===2&&con)pal=[30,52,38];
  if(se===2&&!con){ // bare deciduous crown: branches
    x.lineCap='round';const nb=6+(R()*4|0);
    for(let b=0;b<nb;b++){const a=R()*TAU,l=13+R()*8;const ex=28+M.cos(a)*l,ey=28+M.sin(a)*l;
      x.strokeStyle='rgba(84,70,58,0.95)';x.lineWidth=2.2;x.beginPath();x.moveTo(28,28);x.lineTo(ex,ey);x.stroke();
      x.lineWidth=1;x.strokeStyle='rgba(100,86,72,0.8)';for(let q=0;q<3;q++){const t=0.4+R()*0.5,a2=a+(R()-0.5)*1.6,l2=4+R()*5;const sx=28+(ex-28)*t,sy=28+(ey-28)*t;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+M.cos(a2)*l2,sy+M.sin(a2)*l2);x.stroke()}}
    x.fillStyle='rgba(70,58,48,1)';x.beginPath();x.arc(28,28,2.6,0,TAU);x.fill();
    for(let k=0;k<40;k++){const a=R()*TAU,d=R()*15;x.fillStyle='rgba(245,248,252,0.55)';x.fillRect(28+M.cos(a)*d-2,28+M.sin(a)*d-2,1.6,1.6)}
    return cv}
  if(con){ // conifer
    for(let l=0;l<3;l++){x.beginPath();const rr=20-l*5;for(let k=0;k<16;k++){const a=k/16*TAU+l*0.3;const r=k%2?rr*0.55:rr;x.lineTo(28+M.cos(a)*r,28+M.sin(a)*r)}x.closePath();
      g=x.createRadialGradient(24,24,1,28,28,rr);g.addColorStop(0,`rgb(${pal[0]+30+l*10},${pal[1]+34+l*10},${pal[2]+20})`);g.addColorStop(1,`rgb(${pal[0]*0.6|0},${pal[1]*0.6|0},${pal[2]*0.6|0})`);x.fillStyle=g;x.fill()}
    if(se===2){for(let k=0;k<70;k++){const a=R()*TAU,d=R()*17;if(M.cos(a)+M.sin(a)>0.6&&R()<0.6)continue;x.fillStyle=`rgba(240,245,250,${0.5+R()*0.4})`;x.fillRect(28+M.cos(a)*d-1,28+M.sin(a)*d-1,2,2)}}
  }else{const n=7+(R()*4|0);for(let k=0;k<n;k++){const a=R()*TAU,d=R()*9;const cx=28+M.cos(a)*d,cy=28+M.sin(a)*d,r=8+R()*6;
      g=x.createRadialGradient(cx-r*0.4,cy-r*0.4,1,cx,cy,r);const l=0.85+R()*0.3;g.addColorStop(0,`rgb(${pal[0]*l+40|0},${pal[1]*l+40|0},${pal[2]*l+22|0})`);g.addColorStop(0.6,`rgb(${pal[0]*l|0},${pal[1]*l|0},${pal[2]*l|0})`);g.addColorStop(1,`rgba(${pal[0]*0.45|0},${pal[1]*0.45|0},${pal[2]*0.45|0},0.9)`);
      x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill()}}
  for(let k=0;k<90;k++){const a=R()*TAU,d=R()*17;x.fillStyle=R()<0.5?'rgba(255,255,200,0.12)':'rgba(0,20,0,0.18)';x.fillRect(28+M.cos(a)*d,28+M.sin(a)*d,1.5,1.5)}
  return cv}
function rr(x,X,Y,W,H,r){x.beginPath();x.moveTo(X+r,Y);x.lineTo(X+W-r,Y);x.quadraticCurveTo(X+W,Y,X+W,Y+r);x.lineTo(X+W,Y+H-r);x.quadraticCurveTo(X+W,Y+H,X+W-r,Y+H);x.lineTo(X+r,Y+H);x.quadraticCurveTo(X,Y+H,X,Y+H-r);x.lineTo(X,Y+r);x.quadraticCurveTo(X,Y,X+r,Y);x.closePath()}
function cs(c,k){return 'rgb('+M.min(255,c[0]*k|0)+','+M.min(255,c[1]*k|0)+','+M.min(255,c[2]*k|0)+')'}
function mkCar(c){ // 5 x 2.5 m at 10px/m
  const cv=mkCanvas(50,25),x=cv.getContext('2d');
  x.fillStyle='rgba(0,0,0,0.28)';rr(x,4,3.5,44,20,6);x.fill();
  let g=x.createLinearGradient(0,3,0,22);g.addColorStop(0,cs(c,0.75));g.addColorStop(0.5,cs(c,1.15));g.addColorStop(1,cs(c,0.7));x.fillStyle=g;rr(x,3,3.5,44,18,6);x.fill();
  x.fillStyle='rgba(25,35,45,0.92)';x.beginPath();x.moveTo(32,5.5);x.lineTo(37,7);x.lineTo(37,18);x.lineTo(32,19.5);x.closePath();x.fill();
  x.beginPath();x.moveTo(11,6.5);x.lineTo(14,7.5);x.lineTo(14,17.5);x.lineTo(11,18.5);x.closePath();x.fill();
  x.fillStyle=cs(c,1.05);rr(x,14.5,6.5,17,12,2);x.fill();x.fillStyle='rgba(255,255,255,0.18)';x.fillRect(16,8,14,2);
  x.fillStyle='rgba(255,250,220,0.95)';x.fillRect(45,5,2,3);x.fillRect(45,17,2,3);x.fillStyle='rgba(200,20,20,0.95)';x.fillRect(3,5,1.6,3);x.fillRect(3,17,1.6,3);
  return cv}
function mkTruck(v){const cv=mkCanvas(170,34),x=cv.getContext('2d');const tc=[[235,235,235],[200,60,40],[40,90,160],[220,200,60],[90,100,90]][v];
  x.fillStyle='rgba(0,0,0,0.3)';x.fillRect(6,7,162,25);
  x.fillStyle=cs(tc,1);x.fillRect(3,4,128,25);x.fillStyle='rgba(0,0,0,0.12)';for(let k=8;k<128;k+=10)x.fillRect(3+k,4,1,25);
  x.fillStyle='rgba(255,255,255,0.15)';x.fillRect(3,4,128,4);
  const cc=[[200,30,30],[240,240,240],[40,40,40],[30,80,150],[230,120,30]][(v+2)%5];x.fillStyle='#222';x.fillRect(131,9,6,15);
  x.fillStyle=cs(cc,1);rr(x,137,5,26,24,3);x.fill();x.fillStyle='rgba(25,35,45,0.9)';x.fillRect(158,7,4,20);x.fillStyle=cs(cc,1.2);x.fillRect(140,8,14,18);return cv}
function mkBus(){const cv=mkCanvas(125,30),x=cv.getContext('2d');x.fillStyle='rgba(0,0,0,0.3)';x.fillRect(5,6,118,23);
  x.fillStyle='#e8e6dc';rr(x,2,3,120,24,4);x.fill();x.fillStyle='#d8a020';x.fillRect(2,3,120,4);x.fillRect(2,23,120,4);
  x.fillStyle='rgba(30,40,50,0.6)';x.fillRect(8,9,100,12);x.fillStyle='#ccc';x.fillRect(30,11,10,8);x.fillRect(70,11,10,8);x.fillStyle='rgba(25,35,45,0.95)';x.fillRect(114,6,6,18);return cv}

function drawShip(x,len,st,ci){ // local frame metres, facing +x, centred
  const w=len*(st===2?0.16:0.14),h=len/2;
  x.fillStyle='rgba(0,10,20,0.35)';x.beginPath();x.moveTo(-h+4,-w/2+4);x.lineTo(h*0.7+4,-w/2+4);x.quadraticCurveTo(h+4,4,h*0.7+4,w/2+4);x.lineTo(-h+4,w/2+4);x.closePath();x.fill();
  const hull=[[160,40,40],[30,50,80],[40,40,44],[60,90,60],[160,60,30],[200,200,200]][ci];
  x.fillStyle=cs(hull,1);x.beginPath();x.moveTo(-h,-w/2);x.lineTo(h*0.7,-w/2);x.quadraticCurveTo(h,0,h*0.7,w/2);x.lineTo(-h,w/2);x.closePath();x.fill();
  x.fillStyle=st===1?'#6b5a4a':'#8a8a86';x.beginPath();x.moveTo(-h+2,-w/2+1.5);x.lineTo(h*0.68,-w/2+1.5);x.quadraticCurveTo(h-3,0,h*0.68,w/2-1.5);x.lineTo(-h+2,w/2-1.5);x.closePath();x.fill();
  if(st===0){const CC=['#c0392b','#2e6da4','#e0a030','#3a7d44','#888','#d35400','#ddd','#5d4e8c'];const r=rng(len*13+ci);const cl=12.2,cw=2.45;
    for(let xx=-h+20;xx<h*0.62-cl;xx+=cl+0.6){for(let yy=-w/2+2;yy<w/2-2-cw;yy+=cw){if(r()<0.08)continue;x.fillStyle=CC[r()*8|0];x.fillRect(xx,yy,cl,cw-0.2)}}}
  else if(st===1){x.fillStyle='#8a3a2a';x.fillRect(-h+20,-1,h*1.5-30,2);for(let xx=-h+30;xx<h*0.6;xx+=18){x.fillStyle='#7a7060';x.beginPath();x.arc(xx,0,w*0.22,0,TAU);x.fill()}}
  else{for(let xx=-h+22;xx<h*0.6;xx+=len*0.12){x.fillStyle='#4a4038';x.fillRect(xx,-w/2+3,len*0.1,w-6)}}
  x.fillStyle='#f2f2ee';x.fillRect(-h+3,-w/2+1.5,13,w-3);x.fillStyle='rgba(0,0,0,0.25)';x.fillRect(-h+3,w/2-4,13,2.5);x.fillStyle='#333';x.fillRect(-h+8,-1.5,4,3);
}
function drawPlane(x,s,ci){ // facing +x, ~ 60 m
  const L=30*s;const liv=[[240,240,242],[240,240,242],[210,220,235],[245,245,245],[230,230,230]][ci];const tail=[[200,40,40],[30,70,150],[20,120,90],[230,140,20],[40,40,40]][ci];
  x.fillStyle=cs(liv,0.97);x.beginPath();x.moveTo(L*0.2,0);x.lineTo(-L*0.25,-L*0.95);x.lineTo(-L*0.38,-L*0.95);x.lineTo(-L*0.15,0);x.lineTo(-L*0.38,L*0.95);x.lineTo(-L*0.25,L*0.95);x.closePath();x.fill();
  x.fillStyle=cs(liv,0.85);x.beginPath();x.moveTo(-L*0.78,0);x.lineTo(-L*0.92,-L*0.34);x.lineTo(-L*1.0,-L*0.34);x.lineTo(-L*0.95,0);x.lineTo(-L*1.0,L*0.34);x.lineTo(-L*0.92,L*0.34);x.closePath();x.fill();
  const g=x.createLinearGradient(0,-L*0.08,0,L*0.08);g.addColorStop(0,cs(liv,0.8));g.addColorStop(0.5,cs(liv,1.08));g.addColorStop(1,cs(liv,0.78));x.fillStyle=g;
  x.beginPath();x.moveTo(L,0);x.quadraticCurveTo(L*0.95,-L*0.075,L*0.8,-L*0.075);x.lineTo(-L*0.9,-L*0.05);x.lineTo(-L*1.02,0);x.lineTo(-L*0.9,L*0.05);x.lineTo(L*0.8,L*0.075);x.quadraticCurveTo(L*0.95,L*0.075,L,0);x.fill();
  x.fillStyle=cs(tail,1);x.fillRect(-L*1.0,-L*0.02,L*0.25,L*0.04);
  x.fillStyle='#777';x.fillRect(-L*0.02,-L*0.45,L*0.16,L*0.07);x.fillRect(-L*0.02,L*0.38,L*0.16,L*0.07);
}

// ---------------------------------------------------------------- tile render: raster
const TINTZ={ind:1,ref:1,pow:1,port:1,stn:1,gas:1,agro:1};
const GS=4,GN=TS/GS+4;
const gH=new Float32Array(GN*GN),gR=new Float32Array(GN*GN),gW=new Float32Array(GN*GN),gM=new Float32Array(GN*GN),gF=new Float32Array(GN*GN),gA=new Float32Array(GN*GN),gU=new Float32Array(GN*GN),gS=new Float32Array(GN*GN),gGR=new Float32Array(GN*GN),gGH=new Float32Array(GN*GN),gHS=new Float32Array(GN*GN);
const LX=-0.55,LY=-0.62,LZ=0.56;const LN_=M.hypot(LX,LY,LZ);
let RCx=1e9,RCy=1e9,RCh=0,RCc=1,RCs=0;
const AUT=[[178,96,30],[200,160,44],[156,52,30],[150,124,44]];
function raster(ctx,x0,y0,mpp,near){const WIN=SEASON===2;
  const st=GS*mpp;const oct=clamp(M.ceil(M.log2(30000/(st*1.2))),3,13);
  const ex=1+clamp(M.log2(mpp)*0.25,0,1.6);
  let k=0;
  for(let gj=0;gj<GN;gj++){const wy=y0+(gj-1.5)*st;for(let gi=0;gi<GN;gi++,k++){const wx=x0+(gi-1.5)*st;
    const e=baseH(wx,wy,oct);gH[k]=e;const rv=riverV(wx,wy);gR[k]=rv;const w=riverW(wx,wy,e);gW[k]=w;
    gM[k]=moist(wx,wy);gF[k]=noise(wx/1900+3.3,wy/1900-7.1)*0.6+noise(wx/520+1.7,wy/520+9.9)*0.4;
    let fa=smooth(0.0,0.3,noise(wx/15000+61.1,wy/15000-12.3)),u=0;
    for(let q=0;q<near.length;q++){const c=near[q];if(c.kind==='zone'){const dx=wx-c.x,dy=wy-c.y;const lx=dx*c.ca+dy*c.sa,ly=-dx*c.sa+dy*c.ca;
        const v=smooth(1.08,0.98,M.max(M.abs(lx)/(c.W/2),M.abs(ly)/(c.H/2)));if(TINTZ[c.zk]&&v>u)u=v*0.8;continue}
      const dx=wx-c.x,dy=wy-c.y,d2=dx*dx+dy*dy,R2=c.R+4500;if(d2>R2*R2)continue;const d=M.sqrt(d2);
      const fv=smooth(c.R+4500,c.R+600,d)*(c.type===0?0.85:1);if(fv>fa)fa=fv;
      if(d<c.R*1.6){const f=cityF(c,wx,wy)*(c.type===0?0.8:1);const v=smooth(1.1,0.92,f)*(c.type===0?0.45:1);if(v>u)u=v}}
    gA[k]=fa;gU[k]=u;
    const r=M.abs(rv);gHS[k]=e}}
  for(let gj=1;gj<GN-1;gj++)for(let gi=1;gi<GN-1;gi++){const k=gj*GN+gi;
    const dhx=(gHS[k+1]-gHS[k-1])/(2*st),dhy=(gHS[k+GN]-gHS[k-GN])/(2*st);const zx=dhx*ELEV*ex,zy=dhy*ELEV*ex;
    const nl=M.sqrt(zx*zx+zy*zy+1);gS[k]=((-zx*LX-zy*LY+LZ)/nl)/(LZ);
    gGH[k]=M.hypot((gH[k+1]-gH[k-1])/(2*st),(gH[k+GN]-gH[k-GN])/(2*st));
    gGR[k]=M.hypot((gR[k+1]-gR[k-1])/(2*st),(gR[k+GN]-gR[k-GN])/(2*st))}
  const img=ctx.createImageData(TS,TS),d=img.data;
  const id1=1/(4*mpp),id2=1/(16*mpp);const crowns=mpp<1.7,fieldsOn=mpp<120,stripes=mpp<2.5;
  let o=0;
  for(let py=0;py<TS;py++){const gy=(py+0.5)/GS+1.5;const j=gy|0,ty=gy-j;const wy=y0+(py+0.5)*mpp;
    for(let px=0;px<TS;px++,o+=4){const gx=(px+0.5)/GS+1.5;const i=gx|0,tx=gx-i;const k=j*GN+i;
      const w00=(1-tx)*(1-ty),w10=tx*(1-ty),w01=(1-tx)*ty,w11=tx*ty;
      const e=gH[k]*w00+gH[k+1]*w10+gH[k+GN]*w01+gH[k+GN+1]*w11;
      const rv=gR[k]*w00+gR[k+1]*w10+gR[k+GN]*w01+gR[k+GN+1]*w11;
      const ww=gW[k]*w00+gW[k+1]*w10+gW[k+GN]*w01+gW[k+GN+1]*w11;
      const sh=gS[k]*w00+gS[k+1]*w10+gS[k+GN]*w01+gS[k+GN+1]*w11;
      const gh=gGH[k]*w00+gGH[k+1]*w10+gGH[k+GN]*w01+gGH[k+GN+1]*w11;
      const wx=x0+(px+0.5)*mpp;
      const d1=noise(wx*id1+0.5,wy*id1+0.3),d2=noise(wx*id2+7.1,wy*id2+3.9);const d0=((mix32(M.imul(px,73856093)^M.imul(py,19349663)^(x0|0))&255)/255-0.5);const dt=d1*0.4+d2*0.45+d0*0.3;
      let aL=clamp(e/(gh*mpp*1.2+1e-7)+0.5,0,1);
      let aR=0;if(ww>0&&e>-0.03){const gr=(gGR[k]*w00+gGR[k+1]*w10+gGR[k+GN]*w01+gGR[k+GN+1]*w11)*mpp+1e-7;const r=rv<0?-rv:rv;
        aR=clamp((ww-r)/gr+0.5,0,1);if(aR>0)aR*=M.min(1,0.22+3*ww/gr)}
      const land=aL*(1-aR);
      let R=0,Gc=0,Bc=0;
      if(land>0){
        const mo=gM[k]*w00+gM[k+1]*w10+gM[k+GN]*w01+gM[k+GN+1]*w11;
        const fn=gF[k]*w00+gF[k+1]*w10+gF[k+GN]*w01+gF[k+GN+1]*w11;
        const ag=gA[k]*w00+gA[k+1]*w10+gA[k+GN]*w01+gA[k+GN+1]*w11;
        const u=gU[k]*w00+gU[k+1]*w10+gU[k+GN]*w01+gU[k+GN+1]*w11;
        const dry=smooth(0.3,-0.45,mo);
        R=88+44*dry+dt*8;Gc=122+14*dry+dt*9;Bc=58+24*dry+dt*5;
        if(SEASON===1){R+=30+dry*8;Gc-=2;Bc-=10}else if(WIN){R=230+dt*10;Gc=234+dt*10;Bc=240+dt*8}
        const slope=gh*ELEV;
        // forest
        const fv=mo*0.75+fn*0.6+dt*0.05;
        let fo=smooth(0.06,0.13,fv)*(1-smooth(0.04,0.25,u))*smooth(0.55,0.44,e);
        // fields
        let agv=smooth(0.25,0.55,ag)*smooth(0.36,0.22,e)*(1-smooth(0.05,0.3,u))*(1-smooth(1.2,2.5,slope));
        if(agv>0)fo*=1-smooth(0.3,0.7,agv)*0.85;
        if(agv>0.01&&fieldsOn){
          const rx=M.floor(wx/2600),ry=M.floor(wy/2600);if(rx!==RCx||ry!==RCy){RCx=rx;RCy=ry;RCh=hh(rx,ry,5);const an=(RCh&1023)/1023*PI;RCc=M.cos(an);RCs=M.sin(an)}const hR=RCh,ca=RCc,sa=RCs;
          const lx=wx*ca+wy*sa,ly=-wx*sa+wy*ca;const fW=140+((hR>>>10)&255)*1.1,fH=70+((hR>>>18)&255)*0.7;
          const cx=M.floor(lx/fW),cy=M.floor(ly/fH);const hf=hh(cx,cy,hR);const crop=hf&7;
          let fr,fg,fb;
          switch(crop){case 0:fr=196;fg=172;fb=98;break;case 1:fr=122;fg=150;fb=62;break;case 2:fr=124;fg=96;fb=66;break;case 3:fr=206;fg=192;fb=72;break;
            case 4:fr=94;fg=134;fb=56;break;case 5:fr=150;fg=148;fb=92;break;case 6:fr=172;fg=158;fb=100;break;default:fr=108;fg=128;fb=70}
          if(SEASON===1){if(crop===1||crop===4||crop===7){fr=116;fg=90;fb=62}else if(crop!==2){fr=184;fg=162;fb=104}}else if(WIN){fr=226;fg=230;fb=236}
          const vv=((hf>>>8)&63)/63*0.16+0.92;fr*=vv;fg*=vv;fb*=vv;{const kc=smooth(8,90,mpp)*0.55;fr=lerp(fr,150,kc);fg=lerp(fg,150,kc);fb=lerp(fb,92,kc)}
          if(stripes){const s=M.sin(ly*(crop===2?1.6:2.4))*(0.5-0.5*smooth(0.9,2.5,mpp))*(SEASON===1&&(crop===1||crop===4||crop===7)?2.2:WIN?0.8:1);fr*=1+s*0.07;fg*=1+s*0.07;fb*=1+s*0.06}
          if(mpp<8){const ex2=lx/fW-cx,ey2=ly/fH-cy;const em=M.min(M.min(ex2,1-ex2)*fW,M.min(ey2,1-ey2)*fH);const ea=clamp((2.6-em)/mpp+0.5,0,1)*(1-smooth(3,8,mpp));
            if(ea>0){if(WIN){fr=lerp(fr,(hf&256)?120:200,ea);fg=lerp(fg,(hf&256)?118:204,ea);fb=lerp(fb,(hf&256)?110:210,ea)}else{fr=lerp(fr,(hf&256)?70:150,ea);fg=lerp(fg,(hf&256)?100:136,ea);fb=lerp(fb,(hf&256)?50:100,ea)}}}
          if(WIN){fr=fr*0.92+14;fg=fg*0.92+16;fb=fb*0.92+18}else{fr=fr*0.72+36;fg=fg*0.72+38;fb=fb*0.72+24}fr+=dt*10;fg+=dt*10;fb+=dt*7;
          const a=agv*(1-fo);R=lerp(R,fr,a);Gc=lerp(Gc,fg,a);Bc=lerp(Bc,fb,a)}
        if(fo>0.003){let fr=40+dry*14,fg=70+dry*8,fb=38;
          if(crowns){const C=5.5;const cxi=M.floor(wx/C),cyi=M.floor(wy/C);let bd=9,bx=0,by=0,br=1;
            for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const hq=hh(cxi+a,cyi+b,3);const fx=(cxi+a+((hq&255)/255)*0.8+0.1)*C,fy=(cyi+b+(((hq>>>8)&255)/255)*0.8+0.1)*C;
              const rr=(0.62+((hq>>>16)&255)/255*0.5);const dx=wx-fx,dy=wy-fy;const dd=(dx*dx+dy*dy)/(rr*rr*C*C);if(dd<bd){bd=dd;bx=dx;by=dy;br=(hq>>>24)&255}}
            const dist=M.sqrt(bd);const cr=clamp(1.15-dist,0,1);const lit=clamp(0.5-(bx+by)/(C*1.3),0,1);
            let cb=0.45+cr*(0.55+lit*0.55);cb=lerp(0.85+dt*0.3,cb,1-smooth(0.7,1.7,mpp));const tint=br/255;
            const ever=(br&3)===0||mo>0.32;
            if(SEASON===1&&!ever){const q=(br>>2)&3;const AC=AUT[q];fr=AC[0];fg=AC[1];fb=AC[2]}
            if(WIN){if(ever){fr=30;fg=50;fb=38}else{fr=96;fg=86;fb=78}const cov=ever?smooth(0.05,0.35,cr):smooth(0.2,0.6,cr)*0.75;
              const c2=lerp(0.9+dt*0.2,cb,1-smooth(0.7,1.7,mpp));fr=lerp(SNOW[0]*0.9,fr*c2,cov);fg=lerp(SNOW[1]*0.9,fg*c2,cov);fb=lerp(SNOW[2]*0.92,fb*c2,cov)}
            else{fr=fr*cb*(0.9+tint*0.25);fg=fg*cb*(0.95+tint*0.12);fb=fb*cb}}
          else{const m2=0.82+0.36*(d1*0.6+0.5);
            if(SEASON===1){const q=fn>0.05?0.35:0.75;fr=lerp(fr,150,q);fg=lerp(fg,100,q*0.7);fb=lerp(fb,40,q)}
            if(WIN){const q=0.45+0.2*smooth(0.2,-0.2,mo);fr=lerp(48,200,q);fg=lerp(62,206,q);fb=lerp(54,214,q)}
            fr*=m2;fg*=m2;fb*=m2}
          R=lerp(R,fr,fo);Gc=lerp(Gc,fg,fo);Bc=lerp(Bc,fb,fo)}
        // beach
        const sand=smooth(0.009,0.003,e)*(1-u);if(sand>0){if(WIN){R=lerp(R,214+dt*10,sand);Gc=lerp(Gc,212+dt*10,sand);Bc=lerp(Bc,206+dt*10,sand)}else{R=lerp(R,200+dt*12,sand);Gc=lerp(Gc,184+dt*12,sand);Bc=lerp(Bc,136+dt*10,sand)}}
        // rock / snow
        const rk=M.max(smooth(0.42,0.6,e+dt*0.04),smooth(0.8,1.6,slope)*smooth(0.12,0.28,e));
        if(rk>0){const rc=112+dt*26;const rk2=WIN?rk*smooth(0.6,1.5,slope+dt*0.5):rk;R=lerp(R,rc+8,rk2);Gc=lerp(Gc,rc,rk2);Bc=lerp(Bc,rc-12,rk2)}
        const sn=smooth(0.8,0.88,e+dt*0.05)*(1-smooth(0.7,1.4,slope)*0.8);if(sn>0){R=lerp(R,238,sn);Gc=lerp(Gc,242,sn);Bc=lerp(Bc,248,sn)}
        if(u>0){const uc=0.92+dt*0.18;if(WIN){R=lerp(R,178*uc,u*0.6);Gc=lerp(Gc,180*uc,u*0.6);Bc=lerp(Bc,184*uc,u*0.6)}else{R=lerp(R,138*uc,u*0.7);Gc=lerp(Gc,138*uc,u*0.7);Bc=lerp(Bc,118*uc,u*0.7)}}
        if(ww>0){const r2=rv<0?-rv:rv;const bk=smooth(ww*2.2+0.002,ww,r2)*(1-u*0.7);if(bk>0){const bc=WIN?[150,150,146]:SEASON===1?[120,96,46]:[62,88,48];R=lerp(R,bc[0]+dt*10,bk*0.75);Gc=lerp(Gc,bc[1]+dt*12,bk*0.75);Bc=lerp(Bc,bc[2],bk*0.75)}}
        let s2=clamp(sh>1?1+(sh-1)*0.65:1-(1-sh)*0.72,0.32,1.38);if(WIN){s2=M.min(s2,1.06);Bc+=(1-s2)*34;Gc+=(1-s2)*8}if(sn>0){const ss=0.62+0.38*s2;s2=lerp(s2,ss,sn);Bc+=sn*(1-s2)*40}R*=s2;Gc*=s2;Bc*=s2;
      }
      // water
      if(land<1){let wr,wg,wb;
        if(e<0.003&&aR<0.999){const t=clamp(-e/0.13,0,1),t2=M.sqrt(t);wr=lerp(58,14,t2);wg=lerp(134,46,t2);wb=lerp(140,82,t2);
          const sh2=smooth(0.0,-0.012,e);wr=lerp(wr+40,wr,sh2);wg=lerp(wg+36,wg,sh2);wb=lerp(wb+18,wb,sh2)}
        else{wr=50;wg=96;wb=100}
        if(aR>0&&e>0.003){const r2=rv<0?-rv:rv;const dp=M.sqrt(clamp((ww-r2)/(ww+1e-7),0,1));const rr2=lerp(78,30,dp),rg2=lerp(112,74,dp),rb2=lerp(96,90,dp);wr=lerp(wr,rr2,aR);wg=lerp(wg,rg2,aR);wb=lerp(wb,rb2,aR)}
        wr+=dt*5;wg+=dt*6;wb+=dt*6;let wa=0.8;
        if(WIN){let ice=0;if(aR>0&&e>0.003){const r2=rv<0?-rv:rv;const dp=clamp((ww-r2)/(ww+1e-7),0,1);ice=1-smooth(0.55,0.85,dp)*smooth(0.006,0.012,ww)}
          else if(e<0.003){const t=clamp(-e/0.13,0,1);ice=smooth(0.05,0.015,t+d1*0.025)}
          if(ice>0){const ck=M.abs(d2)<0.025?-26:0;wr=lerp(wr,196+dt*14+ck,ice);wg=lerp(wg,212+dt*14+ck,ice);wb=lerp(wb,224+dt*12+ck,ice);wa=lerp(0.8,1,ice)}}
        R=lerp(wr,R,land);Gc=lerp(wg,Gc,land);Bc=lerp(wb,Bc,land);
        d[o+3]=(land+(1-land)*wa)*255}
      else d[o+3]=255;
      d[o]=R;d[o+1]=Gc;d[o+2]=Bc}}
  ctx.putImageData(img,0,0);
}

// ---------------------------------------------------------------- block generation
const MASS_=[0,[128,130,136],[138,130,122],[134,136,132],[122,126,104],[96,118,74],[160,160,160],[126,132,108],[124,118,110],[118,128,100],[134,134,124],[140,128,110],[142,136,128]];
const MASS=MASS_.concat([[112,132,90],[180,182,180],[130,120,120],[112,130,96],[132,132,134],[0,0,0],[120,132,146]]);
function occ(O,x,y,m){for(let i=0;i<O.length;i+=4){if(x>O[i]-m&&x<O[i]+O[i+2]+m&&y>O[i+1]-m&&y<O[i+1]+O[i+3]+m)return true}return false}
let LITE=false,LITE2=false;
function treesIn(P,O,R,x0,y0,w,h,n,dmin,dmax,vset){if(LITE)n=M.min(n,LITE2?4:10);for(let q=0;q<n;q++){const x=x0+R()*w,y=y0+R()*h,d=dmin+R()*(dmax-dmin);if(occ(O,x,y,d*0.45))continue;TR(P,x,y,d,vset[R()*vset.length|0])}}
function streetTrees(P,R,x0,y0,x1,y1,sp){if(LITE2)return;if(LITE)sp*=1.6;const v=R()*3|0;for(let x=x0+4;x<x1-4;x+=sp){TR(P,x,y0+1.8,5+R()*3,v);TR(P,x,y1-1.8,5+R()*3,v)}for(let y=y0+4+sp;y<y1-4-sp;y+=sp){TR(P,x0+1.8,y,5+R()*3,v);TR(P,x1-1.8,y,5+R()*3,v)}}
function genBlock(c,bi,bj,t){
  const R=rng(hh(c.id,bi*1013+bj,61));const i=bi-c.N,j=bj-c.N;const hu=(c.us[bi+1]-c.us[bi])/2,hv=(c.vs[bj+1]-c.vs[bj])/2;
  const iL=lineHalf(i),iR=lineHalf(i+1),iB=lineHalf(j),iT=lineHalf(j+1);
  const sx0=-hu+iL,sy0=-hv+iB,sx1=hu-iR,sy1=hv-iT;const P=[],O=[];
  G(P,sx0,sy0,sx1-sx0,sy1-sy0,SIDEW);P[P.length-1].tr=1;
  const X0=sx0+3.5,Y0=sy0+3.5,X1=sx1-3.5,Y1=sy1-3.5,W=X1-X0,H=Y1-Y0,cx=(X0+X1)/2,cy=(Y0+Y1)/2;
  const dn=M.hypot(c.us[bi]+hu,c.vs[bj]+hv)/c.R;
  const bld=(x,y,w,h,Hh,col,r,ex)=>{B(P,x,y,w,h,Hh,col,r,ex);O.push(x,y,w,h)};
  switch(t){
  case 1:{ // towers
    G(P,X0,Y0,W,H,PAVE);const n=1+(R()*3|0);const horiz=W>=H;
    for(let q=0;q<n;q++){const pw=(horiz?W:H)/n;const tw=M.min(pw*0.7,26+R()*24),th=M.min((horiz?H:W)*0.7,24+R()*24);
      const pc=(horiz?X0:Y0)+pw*(q+0.5);let x,y;if(horiz){x=pc-tw/2+(R()-0.5)*(pw-tw)*0.6;y=cy-th/2+(R()-0.5)*(H-th)*0.6}else{y=pc-th/2+(R()-0.5)*(pw-th)*0.6;x=cx-tw/2+(R()-0.5)*(W-tw)*0.6}
      const w2=horiz?tw:th,h2=horiz?th:tw;const Hh=M.max(40,(c.type===3?90+R()*220:50+R()*90)*(1-dn*1.6));
      const gl=R()<0.6;const col=gl?[[62,92,116],[74,108,122],[56,80,104],[96,118,130],[88,96,112]][R()*5|0]:[[176,174,170],[152,150,146],[124,124,128],[186,170,150]][R()*4|0],rf=gl?'gl':'f';const st=R();
      if(st<0.4){bld(x,y,w2,h2,Hh,col,rf,{heli:Hh>150&&R()<0.6,ant:Hh>170&&R()<0.5,sol:!gl&&R()<0.2})}
      else if(st<0.68){const k1=M.min(w2,h2)*0.13;bld(x,y,w2,h2,Hh*0.42,col,rf,{lvl:0});bld(x+k1,y+k1,w2-2*k1,h2-2*k1,Hh*0.74,col,rf,{H0:Hh*0.42,lvl:1});
        bld(x+k1*2.3,y+k1*2.3,w2-4.6*k1,h2-4.6*k1,Hh,col,rf,{H0:Hh*0.74,lvl:2,ant:R()<0.6,heli:R()<0.3})}
      else if(st<0.84){const rr2=M.min(w2,h2)/2;CY(P,x+w2/2,y+h2/2,rr2,Hh,col,'gtow');O.push(x,y,w2,h2)}
      else{const tw2=w2*0.42;bld(x,y,tw2,h2,Hh,col,rf,{lvl:1,ant:1});bld(x+w2-tw2,y,tw2,h2,Hh,col,rf,{lvl:1,ant:1});bld(x+tw2,y+h2*0.35,w2-2*tw2,h2*0.3,Hh*0.62,[200,205,210],'gl',{H0:Hh*0.55,lvl:2,nd:1})}}
    if(n<3&&R()<0.5){P.push({k:'gc',x:cx+(R()-0.5)*W*0.4,y:cy+(R()-0.5)*H*0.4,r:6,c:[160,170,175]});}
    treesIn(P,O,R,X0+4,Y0+4,W-8,H-8,8,4,7,[0,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,11);break}
  case 2:{ // perimeter
    G(P,X0,Y0,W,H,YARD);const d=13+R()*4;const col=ROOFP[R()*ROOFP.length|0];
    const seg=(x,y,w,h,alongX)=>{let p=0;const L=alongX?w:h;while(p<L-6){let s=M.min(L-p,22+R()*40);if(L-p-s<14)s=L-p;
      const fl=(5+(R()*5|0))*3.1;const cc=[col[0]*(0.9+R()*0.2),col[1]*(0.9+R()*0.2),col[2]*(0.9+R()*0.2)];
      if(alongX)bld(x+p,y,s-0.5,h,fl,cc,R()<0.25?'h':'f');else bld(x,y+p,w,s-0.5,fl,cc,R()<0.25?'h':'f');p+=s}};
    seg(X0,Y0,W,d,1);seg(X0,Y1-d,W,d,1);seg(X0,Y0+d,d,H-2*d,0);if(R()<0.8)seg(X1-d,Y0+d,d,H-2*d,0);
    if(W>60&&H>60){PK(P,X0+d+4,cy-6,M.min(W-2*d-8,40),12,0.6,R()*1e9|0);P.push({k:'play',x:cx+5,y:Y0+d+6,w:14,h:10})}
    treesIn(P,O,R,X0+d,Y0+d,W-2*d,H-2*d,14,5,9,[0,1,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,12);break}
  case 3:{ // panel slabs
    G(P,X0,Y0,W,H,YARD);const horiz=W>=H;const LA=horiz?W:H,SA=horiz?H:W;const n=M.max(1,M.floor((SA-8)/46));
    const fls=[5,9,9,9,12,14,16][R()*7|0];const col=PANELC[R()*PANELC.length|0];
    for(let q=0;q<n;q++){const len=LA*(0.55+R()*0.38),sw=12+R()*2.5;const off=(R()-0.5)*(LA-len-8);const pc=-SA/2+(q+0.5)*SA/n;
      const fl=(R()<0.25?[5,9,12,16][R()*4|0]:fls)*2.9;
      if(horiz){bld(cx+off-len/2,cy+pc-sw/2,len,sw,fl,col,'f',{mr:1});PK(P,cx+off-len/2+4,cy+pc+sw/2+3,len-8,5.5,0.65,R()*1e9|0)}
      else{bld(cx+pc-sw/2,cy+off-len/2,sw,len,fl,col,'f',{mr:1});PK(P,cx+pc+sw/2+3,cy+off-len/2+4,5.5,len-8,0.65,R()*1e9|0)}}
    if(R()<0.45&&W>70&&H>70){const tx=X0+6+R()*(W-40),ty=Y0+6+R()*(H-40);if(!occ(O,tx+12,ty+12,16))bld(tx,ty,24,24,(16+(R()*8|0))*2.9,col,'f')}
    if(R()<0.5){const kx=cx-15,ky=cy-12;if(!occ(O,kx+15,ky+12,18)){bld(kx,ky,30,8,7,[176,118,80],'f');bld(kx,ky+8,8,16,7,[176,118,80],'f');P.push({k:'play',x:kx+12,y:ky+11,w:16,h:12})}}
    for(let q=0;q<2;q++){const px=X0+8+R()*(W-30),py=Y0+8+R()*(H-24);if(!occ(O,px+8,py+6,6))P.push({k:'play',x:px,py,y:py,w:14,h:10})}
    treesIn(P,O,R,X0+2,Y0+2,W-4,H-4,M.floor(W*H/420),5,10,[0,1,2,4,6]);streetTrees(P,R,sx0,sy0,sx1,sy1,13);break}
  case 4:case 13:{ // private houses
    G(P,X0,Y0,W,H,[112,130,76]);const horiz=W>=H;const LA=horiz?W:H,SA=horiz?H:W;const lw=20+R()*8;const nl=M.max(1,M.floor(LA/lw)),lw2=LA/nl;const rows=SA>50?2:1;
    for(let r=0;r<rows;r++)for(let q=0;q<nl;q++){const Rl=rng(hh(c.id*7+bi,bj*131+q,r+5));if(Rl()<0.08)continue;
      const a0=-LA/2+q*lw2,b0=r===0?-SA/2:0,bl=rows===2?SA/2:SA;
      let lx,ly,lw3,lh3;if(horiz){lx=cx+a0;ly=cy+b0;lw3=lw2;lh3=bl}else{lx=cx+b0;ly=cy+a0;lw3=bl;lh3=lw2}
      const gc=[[104,124,70],[118,128,78],[96,118,66],[126,116,82]][Rl()*4|0];G(P,lx+0.6,ly+0.6,lw3-1.2,lh3-1.2,gc);P.push({k:'fence',x:lx+0.4,y:ly+0.4,w:lw3-0.8,h:lh3-0.8});
      if(Rl()<0.6){const vw=(horiz?lw3:lh3)*0.6;if(horiz)P.push({k:'rows',x:lx+2,y:r===0?ly+2:ly+lh3-14,w:vw,h:12,o:0});else P.push({k:'rows',x:r===0?lx+2:lx+lw3-14,y:ly+2,w:12,h:vw,o:1})}
      const hw=7+Rl()*5,hd=6.5+Rl()*4;const front=4;let hx,hy;
      if(horiz){hx=lx+(lw3-hw)/2+(Rl()-0.5)*3;hy=r===0?ly+front:ly+lh3-front-hd}else{hy=ly+(lh3-hw)/2;hx=r===0?lx+front:lx+lw3-front-hd}
      const ww=horiz?hw:hd,hh2=horiz?hd:hw;bld(hx,hy,ww,hh2,5+Rl()*4,ROOFH[Rl()*ROOFH.length|0],Rl()<0.55?'g':'h',{a:(Rl()-0.5)*0.12});
      if(Rl()<0.5){const sx=lx+lw3*0.15+Rl()*lw3*0.5,sy=ly+lh3*0.15+Rl()*lh3*0.6;if(!occ(O,sx,sy,4))bld(sx,sy,3.5,3,2.6,[[120,100,80],[100,100,100],[150,80,60]][Rl()*3|0],'f')}
      if(Rl()<0.3){const gx=lx+lw3*0.5,gy=ly+lh3*0.5;if(!occ(O,gx+2,gy+4,3))P.push({k:'gh',x:gx,y:gy,w:3.5,h:8})}
      const nt=Rl()*3|0;for(let q2=0;q2<nt;q2++){const tx=lx+2+Rl()*(lw3-4),ty=ly+2+Rl()*(lh3-4);if(!occ(O,tx,ty,3))TR(P,tx,ty,4+Rl()*4,[0,2,4,6][Rl()*4|0])}}
    break}
  case 5:{ // park
    G(P,X0,Y0,W,H,[86,126,62]);const R2=M.min(W,H);
    LN(P,[X0,Y0,cx,cy,X1,Y1],3,[190,180,152]);LN(P,[X0,Y1,cx,cy,X1,Y0],3,[190,180,152]);O.push(cx-6,cy-6,12,12);
    if(R()<0.5){const pr=R2*0.2;const px=cx+(R()<0.5?-1:1)*W*0.22,py=cy+(R()<0.5?-1:1)*H*0.22;P.push({k:'pond',x:px,y:py,rx:pr*1.3,ry:pr});O.push(px-pr*1.5,py-pr*1.3,pr*3,pr*2.6)}P.push({k:'gc',x:cx,y:cy,r:8,c:[200,192,170]});P.push({k:'gc',x:cx,y:cy,r:3,c:[90,140,170]});
    treesIn(P,O,R,X0,Y0,W,H,M.floor(W*H/140),5,11,[0,1,2,3,4,5]);break}
  case 6:{ // mall + parking
    G(P,X0,Y0,W,H,[92,94,96]);const horiz=W>=H;
    const sol=R()<0.45;if(horiz){const bw=W*0.55;bld(X0+2,Y0+2,bw,H-4,12,[196,196,198],'f',{sol});PK(P,X0+bw+6,Y0+4,W-bw-10,H-8,0.7,R()*1e9|0)}
    else{const bh=H*0.55;bld(X0+2,Y0+2,W-4,bh,12,[196,196,198],'f',{sol});PK(P,X0+4,Y0+bh+6,W-8,H-bh-10,0.7,R()*1e9|0)}break}
  case 7:{ // school
    G(P,X0,Y0,W,H,[118,138,88]);const col=[[184,120,90],[150,150,150],[176,150,110]][R()*3|0];
    bld(X0+5,Y0+5,W*0.45,12,12,col,'f');bld(X0+5,Y0+17,12,H*0.4,12,col,'f');bld(X0+5+W*0.45-12,Y0+17,12,H*0.25,12,col,'f');
    const tw=M.min(W*0.5,90),th=M.min(H*0.55,50);P.push({k:'track',x:X1-tw-5,y:Y1-th-5,w:tw,h:th});O.push(X1-tw-5,Y1-th-5,tw,th);
    treesIn(P,O,R,X0,Y0,W,H,12,5,9,[0,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,12);break}
  case 8:{ // garages
    G(P,X0,Y0,W,H,[122,118,110]);const horiz=W>=H;const LA=horiz?W:H,SA=horiz?H:W;let p=-SA/2+4;
    while(p<SA/2-12){for(let s2=0;s2<2;s2++){const rowY=p+s2*6;for(let a=-LA/2+4;a<LA/2-4;a+=3.6){const col=[[120,90,72],[100,100,104],[134,112,92],[90,86,82],[140,100,80]][R()*5|0];
          if(horiz)B(P,cx+a,cy+rowY,3.4,6,2.6,col,'f',{nd:1});else B(P,cx+rowY,cy+a,6,3.4,2.6,col,'f',{nd:1})}}p+=20}break}
  case 9:{ // stadium
    G(P,X0,Y0,W,H,[136,136,130]);const sw=M.min(W,H*1.5)*0.86,shh=sw/1.5;P.push({k:'stad',x:cx,y:cy,w:M.min(sw,W-6),h:M.min(shh,H-6)});
    treesIn(P,O,R,X0,Y0,W,H,0,5,9,[0]);break}
  case 10:{ // church + square
    G(P,X0,Y0,W,H,[96,128,70]);G(P,cx-25,cy-25,50,50,PAVE);const rc=[[90,140,110],[220,220,214],[70,90,140]][R()*3|0];
    bld(cx-14,cy-7,28,14,14,[236,232,220],'f',{lvl:0});bld(cx-5,cy-14,10,28,14,[236,232,220],'f',{lvl:0});
    P.push({k:'dome',x:cx,y:cy,r:4.5,c:R()<0.6?[230,190,80]:rc,H:24,lvl:3});for(const [dx,dy] of [[-10,0],[10,0],[0,-10],[0,10]])P.push({k:'dome',x:cx+dx,y:cy+dy,r:2.2,c:[230,190,80],H:18,lvl:3});B(P,cx-16,cy-3,6,6,30,[236,232,220],'f',{lvl:1});P.push({k:'dome',x:cx-13,y:cy,r:1.8,c:[230,190,80],H:33,lvl:4});
    O.push(cx-28,cy-28,56,56);treesIn(P,O,R,X0,Y0,W,H,30,5,10,[0,1,2,3]);break}
  case 11:{ // construction
    G(P,X0,Y0,W,H,[150,128,98]);G(P,X0+W*0.15,Y0+H*0.2,W*0.5,H*0.35,[120,100,80]);
    bld(X0+W*0.18,Y0+H*0.24,W*0.44,14,(3+(R()*8|0))*2.9,[140,140,136],'f',{cons:1});
    P.push({k:'crane2',x:X0+W*0.7,y:Y0+H*0.5,len:50,a:R()*TAU,H:60,lvl:5});
    for(let q=0;q<5;q++)P.push({k:'pile',x:X0+10+R()*(W-20),y:Y1-10-R()*20,r:3+R()*4,c:[[160,150,130],[120,110,100],[180,160,120]][R()*3|0]});
    PK(P,X0+4,Y1-12,30,8,0.5,R()*1e9|0,1);break}
  case 12:{ // low-rise commercial
    G(P,X0,Y0,W,H,[150,146,138]);let p=X0;while(p<X1-10){const w=M.min(X1-p,14+R()*24);const h=14+R()*16;bld(p,Y0,w-1,h,(2+(R()*3|0))*3.2,ROOFP[R()*ROOFP.length|0],R()<0.3?'h':'f');bld(p,Y1-h,w-1,h,(2+(R()*3|0))*3.2,ROOFP[R()*ROOFP.length|0],'f');p+=w}
    PK(P,X0+4,cy-9,W-8,18,0.6,R()*1e9|0);streetTrees(P,R,sx0,sy0,sx1,sy1,12);break}

  case 13:{ // cottages with pools
    G(P,X0,Y0,W,H,[104,132,72]);const horiz=W>=H;const LA=horiz?W:H,SA=horiz?H:W;const nl=M.max(1,M.floor(LA/34)),lw2=LA/nl,rows=SA>70?2:1;
    for(let r=0;r<rows;r++)for(let q=0;q<nl;q++){const Rl=rng(hh(c.id*5+bi,bj*97+q,r+9));const a0=-LA/2+q*lw2,b0=r===0?-SA/2:0,bl=rows===2?SA/2:SA;
      let lx,ly,w3,h3;if(horiz){lx=cx+a0;ly=cy+b0;w3=lw2;h3=bl}else{lx=cx+b0;ly=cy+a0;w3=bl;h3=lw2}
      P.push({k:'lawn',x:lx+0.8,y:ly+0.8,w:w3-1.6,h:h3-1.6,o:horiz?0:1});P.push({k:'hedge',x:lx+0.4,y:ly+0.4,w:w3-0.8,h:h3-0.8});
      const vw=12+Rl()*6,vh=10+Rl()*4;const fx=r===0?0:1;let vx,vy;if(horiz){vx=lx+(w3-vw)/2;vy=fx?ly+h3-vh-7:ly+7}else{vy=ly+(h3-vw)/2;vx=fx?lx+w3-vh-7:lx+7}
      const ww=horiz?vw:vh,hh2=horiz?vh:vw,rc=[[70,74,80],[150,70,50],[110,60,50],[180,180,176],[60,90,110]][Rl()*5|0];
      bld(vx,vy,ww,hh2,7+Rl()*3,rc,'h',{fc:[236,230,214]});bld(vx+(horiz?ww*0.55:0),vy+(horiz?0:hh2*0.55),horiz?ww*0.45:hh2*0.0+ww,horiz?hh2+5:hh2*0.45,5,rc,'h',{fc:[236,230,214]});
      const pw=8+Rl()*4,ph=4+Rl()*2;let px2,py2;if(horiz){px2=lx+3+Rl()*(w3-pw-6);py2=fx?ly+3:ly+h3-ph-4}else{py2=ly+3+Rl()*(h3-pw-6);px2=fx?lx+3:lx+w3-ph-4}
      if(Rl()<0.75){P.push({k:'pool',x:px2,y:py2,w:horiz?pw:ph,h:horiz?ph:pw});O.push(px2,py2,horiz?pw:ph,horiz?ph:pw)}
      const nt=2+(Rl()*4|0);for(let t2=0;t2<nt;t2++){const tx=lx+2+Rl()*(w3-4),ty=ly+2+Rl()*(h3-4);if(!occ(O,tx,ty,3))TR(P,tx,ty,4+Rl()*6,[0,2,3,4,5][Rl()*5|0])}}
    break}
  case 14:{ // hospital
    G(P,X0,Y0,W,H,[118,140,94]);const fl=(5+(R()*4|0))*3.3;const col=[[214,212,206],[196,200,204]][R()*2|0];const d=14;
    bld(X0+6,Y0+6,d,H*0.7,fl,col,'f',{fc:[230,230,226]});bld(X0+6+d,Y0+6+H*0.3,W*0.5,d,fl,col,'f',{fc:[230,230,226]});bld(X0+6+d+W*0.5,Y0+6,d,H*0.7,fl,col,'f',{fc:[230,230,226]});
    bld(X0+6+d+W*0.12,Y0+6+H*0.3+d,W*0.25,H*0.18,8,[180,184,190],'f');
    P.push({k:'helipad',x:X1-16,y:Y0+16,r:9});O.push(X1-26,Y0+6,20,20);PK(P,X0+6,Y1-16,W-40,11,0.8,R()*1e9|0);
    treesIn(P,O,R,X0,Y0,W,H,16,5,9,[0,1,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,12);break}
  case 15:{ // market
    G(P,X0,Y0,W,H,[110,110,108]);const CC=[[40,90,170],[190,50,40],[230,230,228],[60,140,80],[230,170,40],[120,60,140]];
    bld(X0+3,Y0+3,W-6,16,7,[176,180,186],'co');
    for(let y=Y0+24;y<Y1-6;y+=9)for(let x=X0+4;x<X1-4;x+=3.4){if(R()<0.12)continue;B(P,x,y,3.1,3.4,2.4,CC[R()*6|0],'f',{nd:1})}
    break}
  case 16:{ // sports complex
    G(P,X0,Y0,W,H,[112,132,90]);const fw=M.min(W-20,105),fh=M.min(H*0.5,68);P.push({k:'field',x:X0+10,y:Y0+8,w:fw,h:fh});O.push(X0+10,Y0+8,fw,fh);
    let x=X0+10;const yy=Y0+fh+16;while(x<X1-20&&yy+34<Y1){const t=R()<0.7?0:1;P.push({k:'court',x,y:yy,w:17,h:34,t});O.push(x,yy,17,34);x+=20}
    bld(X1-30,Y1-22,24,16,8,[190,190,192],'f');treesIn(P,O,R,X0,Y0,W,H,14,5,9,[0,1,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,12);break}
  case 17:{ // bus depot
    G(P,X0,Y0,W,H,[104,104,104]);const horiz=W>=H;
    if(horiz){bld(X0+3,Y0+3,W*0.4,H-6,12,[186,190,194],'co');P.push({k:'pk',x:X0+W*0.45,y:Y0+4,w:W*0.53,h:H-8,fill:0.7,seed:R()*1e9|0,bus:1})}
    else{bld(X0+3,Y0+3,W-6,H*0.4,12,[186,190,194],'co');P.push({k:'pk',x:X0+4,y:Y0+H*0.45,w:W-8,h:H*0.53,fill:0.7,seed:R()*1e9|0,bus:1})}break}
  case 19:{ // offices
    G(P,X0,Y0,W,H,PAVE);const n=2+(R()*2|0);const horiz=W>=H;
    for(let q=0;q<n;q++){const pw=(horiz?W:H)/n;const a=(horiz?X0:Y0)+q*pw+4;const ow=pw-8,oh=(horiz?H:W)*(0.45+R()*0.3);const fl=(6+(R()*9|0))*3.6;const gl=R()<0.6;
      const col=gl?[[80,110,128],[96,120,136],[70,96,120]][R()*3|0]:[[186,182,176],[160,160,162]][R()*2|0];const o=(horiz?H:W)-oh-8;const off=R()*o;
      if(horiz)bld(a,Y0+4+off,ow,oh,fl,col,gl?'gl':'f',{rg:!gl&&R()<0.5,sol:!gl&&R()<0.4});else bld(X0+4+off,a,oh,ow,fl,col,gl?'gl':'f',{rg:!gl&&R()<0.5,sol:!gl&&R()<0.4})}
    P.push({k:'gc',x:cx,y:cy,r:5,c:[120,160,180]});treesIn(P,O,R,X0,Y0,W,H,10,4,8,[0,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,11);break}
  }
  return P;
}
function genVillage(c,si){
  const s=c.vst[si];const R=rng(hh(c.id,si,71));const P=[],O=[];
  for(let a=12;a<s.L-12;a+=26+R()*12){for(const side of [-1,1]){if(R()<0.16)continue;
    const Rl=R;const lw=24+Rl()*4,ld=36+Rl()*26;const ly=side>0?5:-5-ld;
    const wx=s.x0+s.ca*a-s.sa*(side*(5+ld/2)),wy=s.y0+s.sa*a+s.ca*(side*(5+ld/2));if(landE(wx,wy,0.002)<0)continue;
    let inZ=false;for(const z of zones){if(M.hypot(z.x-wx,z.y-wy)<z.rad){inZ=true;break}}if(inZ)continue;
    const gc=[[100,124,66],[112,128,72],[118,120,74],[92,118,62]][Rl()*4|0];G(P,a-lw/2,ly,lw,ld,gc);P.push({k:'fence',x:a-lw/2+0.3,y:ly+0.3,w:lw-0.6,h:ld-0.6});
    if(Rl()<0.75)P.push({k:'rows',x:a-lw/2+3,y:side>0?ly+ld*0.62:ly+3,w:(lw-6)*(0.4+Rl()*0.5),h:ld*0.3,o:Rl()<0.5?0:1});
    const hw=7.5+Rl()*4,hd=6.5+Rl()*3;const hy=side>0?ly+3:ly+ld-3-hd;
    B(P,a-hw/2+(Rl()-0.5)*4,hy,hw,hd,4.5+Rl()*2.5,ROOFH[Rl()*ROOFH.length|0],Rl()<0.6?'g':'h',{a:(Rl()-0.5)*0.15});O.push(a-hw/2,hy,hw,hd);
    if(Rl()<0.7){const bx=a-lw/2+2+Rl()*(lw-7),by=side>0?ly+ld*0.3:ly+ld*0.6;B(P,bx,by,3.5+Rl()*2,3,2.5,[[118,96,72],[98,98,100],[140,84,64]][Rl()*3|0],'f');O.push(bx,by,5,3)}
    if(Rl()<0.25)P.push({k:'gh',x:a+lw/2-6,y:side>0?ly+ld-12:ly+3,w:3.5,h:8});
    const nt=1+(Rl()*3|0);for(let q=0;q<nt;q++){const tx=a-lw/2+2+Rl()*(lw-4),ty=ly+2+Rl()*(ld-4);if(!occ(O,tx,ty,3))TR(P,tx,ty,4+Rl()*5,[0,2,4,6][Rl()*4|0])}}}
  return P}

// ---------------------------------------------------------------- primitive drawing
let SDX=0,SDY=0,LNX=0,LNY=0,FCA=1,FSA=0,FOX=0,FOY=0,FS=1;const TREEQ=[];
const SHADOW='rgba(16,22,34,0.32)';
function setFrame(ctx,wx,wy,ca,sa,x0,y0,s){FCA=ca;FSA=sa;FOX=(wx-x0)*s;FOY=(wy-y0)*s;FS=s;
  ctx.setTransform(s*ca,s*sa,-s*sa,s*ca,FOX,FOY);SDX=SUNX*ca+SUNY*sa;SDY=-SUNX*sa+SUNY*ca;LNX=LEANX*ca+LEANY*sa;LNY=-LEANX*sa+LEANY*ca}
const HP=new Float64Array(64);
function hullFill(ctx,pts,n){ // pts flat; monotone chain
  const idx=[];for(let i=0;i<n;i++)idx.push(i);idx.sort((a,b)=>pts[a*2]-pts[b*2]||pts[a*2+1]-pts[b*2+1]);
  const cr=(o,a,b)=>(pts[a*2]-pts[o*2])*(pts[b*2+1]-pts[o*2+1])-(pts[a*2+1]-pts[o*2+1])*(pts[b*2]-pts[o*2]);
  const lo=[],up=[];for(const i of idx){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],i)<=0)lo.pop();lo.push(i)}
  for(let k=idx.length-1;k>=0;k--){const i=idx[k];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],i)<=0)up.pop();up.push(i)}
  lo.pop();up.pop();const h=lo.concat(up);ctx.moveTo(pts[h[0]*2],pts[h[0]*2+1]);for(let k=1;k<h.length;k++)ctx.lineTo(pts[h[k]*2],pts[h[k]*2+1]);ctx.closePath()}
function bShadow(ctx,p){let dx=SDX*p.H,dy=SDY*p.H;const x=p.x,y=p.y,w=p.w,h=p.h;
  if(p.a){const cx=x+w/2,cy=y+h/2,ca=M.cos(p.a),sa=M.sin(p.a);const pts=HP;let n=0;
    for(const [u,v] of [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]){const X=cx+u*ca-v*sa,Y=cy+u*sa+v*ca;pts[n*2]=X;pts[n*2+1]=Y;n++;pts[n*2]=X+dx;pts[n*2+1]=Y+dy;n++}hullFill(ctx,pts,8);return}
  HP[0]=x;HP[1]=y;HP[2]=x+w;HP[3]=y;HP[4]=x+w;HP[5]=y+h;HP[6]=x;HP[7]=y+h;HP[8]=x+dx;HP[9]=y+dy;HP[10]=x+w+dx;HP[11]=y+dy;HP[12]=x+w+dx;HP[13]=y+h+dy;HP[14]=x+dx;HP[15]=y+h+dy;hullFill(ctx,HP,8)}
function roof(ctx,p,s){const x=p.x,y=p.y,w=p.w,h=p.h,c=SEASON===2?seasonC(p.c,p.r==='g'||p.r==='h'?1:p.r==='gl'?3:2):p.c;const px=M.min(w,h)*s;
  if(p.a){ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(p.a);ctx.translate(-x-w/2,-y-h/2)}
  if((p.r==='g'||p.r==='h')&&px>2){
    const hor=w>=h;
    if(p.r==='g'){if(hor){ctx.fillStyle=cs(c,1.12);ctx.fillRect(x,y,w,h/2);ctx.fillStyle=cs(c,0.74);ctx.fillRect(x,y+h/2,w,h/2)}else{ctx.fillStyle=cs(c,1.08);ctx.fillRect(x,y,w/2,h);ctx.fillStyle=cs(c,0.8);ctx.fillRect(x+w/2,y,w/2,h)}}
    else{const m=M.min(w,h)/2;ctx.fillStyle=cs(c,1.14);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w-m,y+m);ctx.lineTo(x+m,y+h-m);ctx.lineTo(x+m,y+m);ctx.closePath();ctx.fill();
      ctx.fillStyle=cs(c,0.98);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+m,y+m);ctx.lineTo(x+m,y+h-m);ctx.lineTo(x,y+h);ctx.closePath();ctx.fill();
      ctx.fillStyle=cs(c,0.74);ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+m,y+h-m);ctx.lineTo(x+w-m,y+h-m);ctx.lineTo(x+w-m,y+m);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fill();}
    if(px>5){ctx.strokeStyle='rgba(0,0,0,0.12)';ctx.lineWidth=0.18;ctx.beginPath();if(hor){for(let q=y+0.6;q<y+h;q+=0.7){ctx.moveTo(x,q);ctx.lineTo(x+w,q)}}else{for(let q=x+0.6;q<x+w;q+=0.7){ctx.moveTo(q,y);ctx.lineTo(q,y+h)}}ctx.stroke()}
  }else if(p.r==='gl'){const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,cs(c,0.7));g.addColorStop(0.45,cs(c,1.35));g.addColorStop(0.55,cs(c,1.05));g.addColorStop(1,cs(c,0.6));ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    if(px>14){ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=0.25;ctx.beginPath();for(let q=x+3;q<x+w;q+=3){ctx.moveTo(q,y);ctx.lineTo(q,y+h)}ctx.stroke();ctx.strokeStyle='rgba(220,230,240,0.55)';ctx.lineWidth=0.8;ctx.strokeRect(x+0.4,y+0.4,w-0.8,h-0.8)}}
  else if(p.r==='glh'){ctx.fillStyle='rgba(215,232,230,0.92)';ctx.fillRect(x,y,w,h);if(px>4){const hor=w>=h;ctx.fillStyle='rgba(120,150,150,0.35)';if(hor)for(let q=y;q<y+h;q+=3.2)ctx.fillRect(x,q,w,0.35);else for(let q=x;q<x+w;q+=3.2)ctx.fillRect(q,y,0.35,h);
      ctx.fillStyle='rgba(255,255,255,0.35)';if(hor)for(let q=y+1.6;q<y+h;q+=3.2)ctx.fillRect(x,q,w,0.5);else for(let q=x+1.6;q<x+w;q+=3.2)ctx.fillRect(q,y,0.5,h)}}
  else{ctx.fillStyle=cs(c,1);ctx.fillRect(x,y,w,h);
    if(p.cnp){ctx.fillStyle=cs(p.cnp,1);ctx.fillRect(x,y,w,1.3);ctx.fillRect(x,y+h-1.3,w,1.3)}
    if(p.r==='co'&&px>6){ctx.fillStyle='rgba(0,0,0,0.07)';const hor=w>=h;if(hor)for(let q=x;q<x+w;q+=1.6)ctx.fillRect(q,y,0.6,h);else for(let q=y;q<y+h;q+=1.6)ctx.fillRect(x,q,w,0.6);
      ctx.fillStyle='rgba(230,240,250,0.35)';if(hor)for(let q=y+8;q<y+h-4;q+=16)ctx.fillRect(x+3,q,w-6,1.6);else for(let q=x+8;q<x+w-4;q+=16)ctx.fillRect(q,y+3,1.6,h-6)}
    if(px>3&&!p.nd){ctx.lineWidth=M.min(0.9,M.min(w,h)*0.08);ctx.strokeStyle=cs(c,1.22);ctx.strokeRect(x+0.45,y+0.45,w-0.9,h-0.9);
      ctx.fillStyle='rgba(0,0,0,0.12)';ctx.fillRect(x+0.9,y+h-1.6,w-1.8,0.7);ctx.fillRect(x+w-1.6,y+0.9,0.7,h-1.8)}
    if(px>10&&!p.nd){const r=rng(hh(x*10|0,y*10|0,9));
      if(p.mr){const hor=w>=h,L=hor?w:h;for(let q=8;q<L-6;q+=16+r()*4){const a=hor?x+q:x+w/2-2,b=hor?y+h/2-2:y+q;ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(a+0.8,b+0.8,4,3.5);ctx.fillStyle=cs(c,1.18);ctx.fillRect(a,b,4,3.5)}}
      else{const n=M.min(14,M.floor(w*h/160));for(let q=0;q<n;q++){const aw=1.4+r()*2.2,ah=1.2+r()*1.8;const a=x+1.5+r()*(w-aw-3),b=y+1.5+r()*(h-ah-3);ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(a+0.5,b+0.5,aw,ah);ctx.fillStyle=r()<0.5?'#c8c8c6':'#a8aaac';ctx.fillRect(a,b,aw,ah)}}
      if(p.heli){const cx=x+w/2,cy=y+h/2,rr2=M.min(w,h)*0.3;ctx.fillStyle='#3a3d40';ctx.beginPath();ctx.arc(cx,cy,rr2,0,TAU);ctx.fill();ctx.strokeStyle='#e8e8e0';ctx.lineWidth=0.5;ctx.stroke();ctx.fillStyle='#e8e8e0';ctx.fillRect(cx-rr2*0.35,cy-rr2*0.5,rr2*0.15,rr2);ctx.fillRect(cx+rr2*0.2,cy-rr2*0.5,rr2*0.15,rr2);ctx.fillRect(cx-rr2*0.35,cy-rr2*0.07,rr2*0.7,rr2*0.14)}
      if(p.sol){const m=2;ctx.fillStyle='#1e2c4a';for(let yy=y+m;yy<y+h-m-1.6;yy+=2.4){ctx.fillRect(x+m,yy,w-2*m,1.6)}ctx.fillStyle='rgba(170,200,240,0.18)';for(let yy=y+m;yy<y+h-m-1.6;yy+=2.4)ctx.fillRect(x+m,yy,w-2*m,0.3)}
      if(p.rg){const m=2.2;ctx.fillStyle=SEASON===2?'#dfe4e8':SEASON===1?'#8a8a48':'#5e8a44';ctx.fillRect(x+m,y+m,w-2*m,h-2*m);ctx.fillStyle='#b8ae94';ctx.fillRect(x+w/2-0.8,y+m,1.6,h-2*m);
        for(let q=0;q<8;q++){const tx=x+m+1.5+r()*(w-2*m-3),ty=y+m+1.5+r()*(h-2*m-3),tr=0.9+r()*1.4;ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.arc(tx+0.5,ty+0.4,tr,0,TAU);ctx.fill();ctx.fillStyle=r()<0.5?'#3f6e30':'#4f7e38';ctx.beginPath();ctx.arc(tx,ty,tr,0,TAU);ctx.fill()}}
      if(p.cons){ctx.strokeStyle='rgba(60,60,60,0.5)';ctx.lineWidth=0.3;ctx.beginPath();for(let q=x;q<x+w;q+=3){ctx.moveTo(q,y);ctx.lineTo(q,y+h)}ctx.stroke()}}}
  if(p.a)ctx.restore()}
const BC=new Float64Array(8),NRM=[0,-1,1,0,0,1,-1,0];
function facadeOf(p){if(p.fc)return p.fc;const c=p.c;
  if(p.r==='gl')return [c[0]*1.15,c[1]*1.15,c[2]*1.2];
  if(p.r==='g'||p.r==='h'){const v=hh(p.x*7|0,p.y*7|0,13)&3;return [[226,218,200],[206,196,176],[232,228,220],[190,170,150]][v]}
  if(p.mr)return [200,198,192];
  return [c[0]*0.55+100,c[1]*0.55+96,c[2]*0.55+88]}
function bld3d(ctx,p,s){
  const H=p.H,H0=p.H0||0;let lx=LNX*H,ly=LNY*H;const lpx=M.hypot(lx,ly)*s;
  if(lpx<0.6){roof(ctx,p,s);return}
  const x=p.x,y=p.y,w=p.w,h=p.h;let ca=1,sa=0;if(p.a){ca=M.cos(p.a);sa=M.sin(p.a)}
  const cx=x+w/2,cy=y+h/2,hw=w/2,hhh=h/2;
  BC[0]=cx+(-hw)*ca-(-hhh)*sa;BC[1]=cy+(-hw)*sa+(-hhh)*ca;BC[2]=cx+hw*ca-(-hhh)*sa;BC[3]=cy+hw*sa+(-hhh)*ca;
  BC[4]=cx+hw*ca-hhh*sa;BC[5]=cy+hw*sa+hhh*ca;BC[6]=cx+(-hw)*ca-hhh*sa;BC[7]=cy+(-hw)*sa+hhh*ca;
  const fc=facadeOf(p);const bx=LNX*H0,by=LNY*H0;const dh=H-H0;const dlx=lx-bx,dly=ly-by;const LL=M.hypot(dlx,dly);
  const glass=p.r==='gl';
  for(let e=0;e<4;e++){const nx=NRM[e*2]*ca-NRM[e*2+1]*sa,ny=NRM[e*2]*sa+NRM[e*2+1]*ca;const dp=nx*lx+ny*ly;if(dp>=0)continue;
    const wnx=nx*FCA-ny*FSA,wny=nx*FSA+ny*FCA;const br=0.9-0.3*(wnx*0.7071+wny*0.7071);
    const e1=(e+1)&3;const a0x=BC[e*2]+bx,a0y=BC[e*2+1]+by,a1x=BC[e1*2]+bx,a1y=BC[e1*2+1]+by;
    if(glass&&lpx>8){const gg=ctx.createLinearGradient(a0x,a0y,a0x+dlx,a0y+dly);gg.addColorStop(0,cs(fc,br*0.8));gg.addColorStop(0.7,cs(fc,br*1.15));gg.addColorStop(1,cs(fc,br*1.4));ctx.fillStyle=gg}else ctx.fillStyle=cs(fc,br);ctx.beginPath();ctx.moveTo(a0x,a0y);ctx.lineTo(a1x,a1y);ctx.lineTo(a1x+dlx,a1y+dly);ctx.lineTo(a0x+dlx,a0y+dly);ctx.closePath();ctx.fill();
    const fl=M.max(1,M.round(dh/3.1));const el=M.hypot(a1x-a0x,a1y-a0y);
    if(!p.nd&&LL*s/fl>1.7&&el*s>5&&-dp>0.55*M.hypot(lx,ly)){
      ctx.lineWidth=LL/fl*(glass?0.5:0.4);ctx.strokeStyle=glass?'rgba(190,225,245,0.42)':(p.r==='co'?'rgba(60,70,80,0.35)':'rgba(38,48,60,0.6)');
      if(!glass)ctx.setLineDash(p.r==='co'?[2,9]:[1.3,1.6]);
      const ex=(a1x-a0x)/el,ey=(a1y-a0y)/el,ins=M.min(1.2,el*0.08);ctx.beginPath();
      for(let f=0;f<fl;f++){const t=(f+0.58)/fl;ctx.moveTo(a0x+ex*ins+dlx*t,a0y+ey*ins+dly*t);ctx.lineTo(a1x-ex*ins+dlx*t,a1y-ey*ins+dly*t)}ctx.stroke();if(!glass)ctx.setLineDash([])}}
  ctx.translate(lx,ly);roof(ctx,p,s);
  if(p.ant&&s>0.3){ctx.strokeStyle='#555';ctx.lineWidth=M.max(0.5,mppG*0.8);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+LNX*25,cy+LNY*25);ctx.stroke()}
  ctx.translate(-lx,-ly)}
let mppG=1;
function cyl3d(ctx,p,s){const H=p.H;const lx=LNX*H,ly=LNY*H;const lp=M.hypot(lx,ly)*s;
  if(lp<0.8||p.st==='sphere'){if(p.st==='sphere'){ctx.translate(lx*0.6,ly*0.6);cylDraw(ctx,p,s);ctx.translate(-lx*0.6,-ly*0.6)}else cylDraw(ctx,p,s);return}
  const r=p.r,rt=p.st==='cool'?r*0.78:p.st==='chim'?r*0.82:r;const L=M.hypot(lx,ly)||1;const nx=-ly/L,ny=lx/L;
  let n=0;for(let a=0;a<12;a++){const c=M.cos(a*PI/6),sn=M.sin(a*PI/6);HP[n++]=p.x+c*r;HP[n++]=p.y+sn*r;HP[n++]=p.x+lx+c*rt;HP[n++]=p.y+ly+sn*rt}
  const wl=-(nx*FCA-ny*FSA)*0.7071-(nx*FSA+ny*FCA)*0.7071;const c=p.st==='chim'?[226,224,218]:p.c;
  const g=ctx.createLinearGradient(p.x-nx*r,p.y-ny*r,p.x+nx*r,p.y+ny*r);g.addColorStop(0,cs(c,0.62+0.25*wl));g.addColorStop(0.5,cs(c,0.86));g.addColorStop(1,cs(c,0.62-0.25*wl));
  ctx.fillStyle=g;ctx.beginPath();hullFill(ctx,HP,24);ctx.fill();
  if(p.st==='gtow'&&lp>6){const fl=M.round(H/3.6);ctx.strokeStyle='rgba(200,230,250,0.35)';ctx.lineWidth=L/fl*0.45;ctx.beginPath();for(let q=1;q<fl;q++){const t=q/fl;ctx.moveTo(p.x+lx*t-nx*r*0.97,p.y+ly*t-ny*r*0.97);ctx.lineTo(p.x+lx*t+nx*r*0.97,p.y+ly*t+ny*r*0.97)}ctx.stroke()}
  if(p.st==='cool'&&lp>6){ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=r*0.05;ctx.beginPath();for(let q=1;q<8;q++){const t=q/8;ctx.moveTo(p.x+lx*t-nx*r*0.9,p.y+ly*t-ny*r*0.9);ctx.lineTo(p.x+lx*t+nx*r*0.9,p.y+ly*t+ny*r*0.9)}ctx.stroke()}
  if(p.st==='chim'&&lp>3){ctx.strokeStyle=cs(p.c,1);ctx.lineWidth=r*1.7;ctx.setLineDash([L/14,L/14]);ctx.beginPath();ctx.moveTo(p.x+lx*0.5,p.y+ly*0.5);ctx.lineTo(p.x+lx*0.98,p.y+ly*0.98);ctx.stroke();ctx.setLineDash([])}
  if(p.st==='tower'&&lp>3){ctx.strokeStyle='rgba(200,170,60,0.75)';ctx.lineWidth=r*0.25;ctx.beginPath();for(let q=1;q<5;q++){const t=q/5;ctx.moveTo(p.x+lx*t-nx*r*1.2,p.y+ly*t-ny*r*1.2);ctx.lineTo(p.x+lx*t+nx*r*1.2,p.y+ly*t+ny*r*1.2)}ctx.stroke()}
  ctx.translate(lx,ly);const sr=p.r;if(p.st==='cool'||p.st==='chim')p.r=rt;cylDraw(ctx,p,s);p.r=sr;ctx.translate(-lx,-ly)}
function tallKey(p){const x=p.k==='b'?p.x+p.w/2:p.x,y=p.k==='b'?p.y+p.h/2:p.y;return x*LNX+y*LNY-(p.lvl||0)*1e7}
const DEF=[];
function drawTall(ctx,p,s){const k=p.k;
  if(k==='b')bld3d(ctx,p,s);else if(k==='cyl')cyl3d(ctx,p,s);
  else if(k==='dome'){const H=p.H||16;const ox=LNX*H,oy=LNY*H;const g=ctx.createRadialGradient(p.x+ox-p.r*0.4,p.y+oy-p.r*0.4,0,p.x+ox,p.y+oy,p.r);g.addColorStop(0,'#fff6d0');g.addColorStop(0.5,cs(p.c,1));g.addColorStop(1,cs(p.c,0.55));
    ctx.fillStyle=cs(p.c,0.6);ctx.beginPath();ctx.arc(p.x+ox*0.75,p.y+oy*0.75,p.r*0.8,0,TAU);ctx.fill();ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x+ox,p.y+oy,p.r,0,TAU);ctx.fill();
    if(s>1.2){ctx.strokeStyle='#d8b850';ctx.lineWidth=0.25;ctx.beginPath();ctx.moveTo(p.x+ox,p.y+oy);ctx.lineTo(p.x+ox+LNX*p.r*1.6,p.y+oy+LNY*p.r*1.6);ctx.stroke()}}
  else if(k==='crane2'){const ox=LNX*p.H,oy=LNY*p.H;ctx.strokeStyle='#d8a818';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+ox,p.y+oy);ctx.stroke();
    ctx.save();ctx.translate(p.x+ox,p.y+oy);ctx.rotate(p.a);ctx.fillStyle='#e0b020';ctx.fillRect(-p.len*0.3,-0.7,p.len*1.3,1.4);ctx.fillStyle='#777';ctx.fillRect(-p.len*0.3,-1.6,6,3.2);ctx.fillStyle='#e0b020';ctx.fillRect(-1.2,-1.2,2.4,2.4);
    ctx.strokeStyle='rgba(40,40,40,0.6)';ctx.lineWidth=0.12;ctx.beginPath();ctx.moveTo(p.len*0.7,0);ctx.lineTo(p.len*0.7,0.01);ctx.stroke();ctx.restore()}}
function cylDraw(ctx,p,s){const x=p.x,y=p.y,r=p.r,c=p.c;
  switch(p.st){
  case 'tank':{let g=ctx.createRadialGradient(x-r*0.35,y-r*0.35,r*0.1,x,y,r);g.addColorStop(0,cs(c,1.08));g.addColorStop(1,cs(c,0.7));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    if(r*s>4){ctx.strokeStyle=cs(c,0.6);ctx.lineWidth=r*0.06;ctx.beginPath();ctx.arc(x,y,r*0.88,0,TAU);ctx.stroke();ctx.fillStyle=cs(c,0.8);ctx.beginPath();ctx.arc(x,y,r*0.12,0,TAU);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=r*0.02;ctx.beginPath();for(let k=0;k<8;k++){const a=k/8*TAU;ctx.moveTo(x+M.cos(a)*r*0.15,y+M.sin(a)*r*0.15);ctx.lineTo(x+M.cos(a)*r*0.85,y+M.sin(a)*r*0.85)}ctx.stroke()}break}
  case 'cool':{let g=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.2,x,y,r);g.addColorStop(0,cs(c,1.08));g.addColorStop(0.75,cs(c,0.92));g.addColorStop(1,cs(c,0.66));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    g=ctx.createRadialGradient(x+r*0.2,y+r*0.2,r*0.1,x,y,r*0.74);g.addColorStop(0,'#3a3c3e');g.addColorStop(0.85,'#25272a');g.addColorStop(1,'#55575a');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*0.74,0,TAU);ctx.fill();break}
  case 'chim':{ctx.fillStyle='#e8e6e0';ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.fillStyle=cs(c,1);ctx.beginPath();ctx.arc(x,y,r*0.82,0,TAU);ctx.fill();ctx.fillStyle='#1c1c1e';ctx.beginPath();ctx.arc(x,y,r*0.55,0,TAU);ctx.fill();break}
  case 'tower':{let g=ctx.createRadialGradient(x-r*0.4,y-r*0.4,0,x,y,r);g.addColorStop(0,'#f4f4f4');g.addColorStop(1,cs(c,0.65));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    if(r*s>3){ctx.strokeStyle='rgba(200,170,60,0.8)';ctx.lineWidth=r*0.18;ctx.beginPath();ctx.arc(x,y,r*1.3,0,TAU*0.7);ctx.stroke()}break}
  case 'gtow':{let g=ctx.createRadialGradient(x-r*0.4,y-r*0.4,r*0.1,x,y,r);g.addColorStop(0,cs(c,1.5));g.addColorStop(0.6,cs(c,1));g.addColorStop(1,cs(c,0.7));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    ctx.fillStyle='#9a9ca0';ctx.beginPath();ctx.arc(x,y,r*0.45,0,TAU);ctx.fill();ctx.strokeStyle='rgba(230,240,250,0.6)';ctx.lineWidth=r*0.05;ctx.beginPath();ctx.arc(x,y,r*0.95,0,TAU);ctx.stroke();break}
  case 'sphere':{let g=ctx.createRadialGradient(x-r*0.4,y-r*0.45,r*0.05,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(0.5,cs(c,0.95));g.addColorStop(1,cs(c,0.55));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();break}
  }}
function drawPrims(ctx,P,pass,mpp){const s=1/mpp;
  for(let q=0;q<P.length;q++){const p=P[q];const k=p.k;
    if(pass===0){
      if(k==='g'){if(p.w*s<0.4&&p.h*s<0.4)continue;ctx.fillStyle=cs(seasonC(p.c,p.tr?4:0),1);ctx.fillRect(p.x,p.y,p.w,p.h)}
      else if(k==='gl'){ctx.strokeStyle=cs(seasonC(p.c,4),1);ctx.lineWidth=M.max(p.w,mpp*0.6);ctx.lineCap='butt';if(p.dash)ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(p.pts[0],p.pts[1]);for(let i=2;i<p.pts.length;i+=2)ctx.lineTo(p.pts[i],p.pts[i+1]);ctx.stroke();if(p.dash)ctx.setLineDash([])}
      else if(k==='gc'){ctx.fillStyle=cs(seasonC(p.c,0),1);ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill()}
      else if(k==='pond'){const wi=SEASON===2;ctx.fillStyle=wi?'#c8cfd4':'#6a8a5a';ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx+1.5,p.ry+1.5,0,0,TAU);ctx.fill();const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.rx);g.addColorStop(0,wi?'#b8ccd8':'#2e5a66');g.addColorStop(1,wi?'#d6e2ea':'#4a7e80');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);ctx.fill()}
      else if(k==='pk'){ctx.fillStyle='#55585c';ctx.fillRect(p.x,p.y,p.w,p.h);if(s>1.2){ctx.strokeStyle='rgba(235,235,230,0.65)';ctx.lineWidth=0.12;ctx.beginPath();const hor=p.w>=p.h;
          if(hor){const rows=M.max(1,M.floor(p.h/5.4));for(let r=0;r<rows;r++){for(let x=p.x;x<=p.x+p.w;x+=2.6){ctx.moveTo(x,p.y+r*5.4);ctx.lineTo(x,p.y+r*5.4+5)}}}else{const rows=M.max(1,M.floor(p.w/5.4));for(let r=0;r<rows;r++){for(let y=p.y;y<=p.y+p.h;y+=2.6){ctx.moveTo(p.x+r*5.4,y);ctx.lineTo(p.x+r*5.4+5,y)}}}ctx.stroke()}}
      else if(k==='rows'){if(s<0.6)continue;ctx.fillStyle=SEASON===2?'#e2e6ea':'#806a50';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle=SEASON===2?'#c8ced4':SEASON===1?'#7a6a40':'#5a8a3a';if(p.o===0)for(let y=p.y+0.3;y<p.y+p.h;y+=1.1)ctx.fillRect(p.x,y,p.w,0.5);else for(let x=p.x+0.3;x<p.x+p.w;x+=1.1)ctx.fillRect(x,p.y,0.5,p.h)}
      else if(k==='track'){const r=p.h/2;ctx.fillStyle=SEASON===2?'#d8d4d2':'#a8503c';rr(ctx,p.x,p.y,p.w,p.h,r);ctx.fill();ctx.fillStyle=SEASON===2?'#e8ecf0':SEASON===1?'#6e8a3c':'#4f8a3c';rr(ctx,p.x+5,p.y+5,p.w-10,p.h-10,r-5);ctx.fill();
        if(s>1){ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=0.15;for(let l=1;l<5;l++){rr(ctx,p.x+l,p.y+l,p.w-2*l,p.h-2*l,r-l);ctx.stroke()}ctx.strokeRect(p.x+p.w*0.2,p.y+8,p.w*0.6,p.h-16);ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y+8);ctx.lineTo(p.x+p.w/2,p.y+p.h-8);ctx.stroke()}}
      else if(k==='rw'){ctx.fillStyle='#5a5c60';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='rgba(40,40,40,0.5)';ctx.fillRect(p.x+80,p.y+p.h*0.3,p.w-160,p.h*0.4);
        if(s>0.12){ctx.fillStyle='#ececec';for(let x=p.x+120;x<p.x+p.w-120;x+=60)ctx.fillRect(x,p.y+p.h/2-0.45,30,0.9);
          for(const e of [p.x+8,p.x+p.w-38])for(let q=0;q<8;q++)ctx.fillRect(e,p.y+4+q*(p.h-8)/8+0.5,30,(p.h-8)/8*0.55);
          ctx.fillRect(p.x,p.y+1,p.w,0.9);ctx.fillRect(p.x,p.y+p.h-1.9,p.w,0.9);for(const e of [p.x+300,p.x+p.w-345])ctx.fillRect(e,p.y+8,45,8),ctx.fillRect(e,p.y+p.h-16,45,8)}}
      else if(k==='mow'){if(s<0.1)continue;ctx.fillStyle='rgba(255,255,220,0.05)';for(let y=p.y;y<p.y+p.h;y+=40)ctx.fillRect(p.x,y,p.w,20)}
      else if(k==='rail'){ctx.strokeStyle='#7a7266';ctx.lineWidth=M.max(4,mpp*0.6);ctx.beginPath();ctx.moveTo(p.pts[0],p.pts[1]);ctx.lineTo(p.pts[2],p.pts[3]);ctx.stroke();
        if(s>1.5){ctx.strokeStyle='#444';ctx.lineWidth=0.18;const dx=p.pts[2]-p.pts[0],dy=p.pts[3]-p.pts[1],l=M.hypot(dx,dy),nx=-dy/l*0.72,ny=dx/l*0.72;ctx.beginPath();for(const sg of [-1,1]){ctx.moveTo(p.pts[0]+nx*sg,p.pts[1]+ny*sg);ctx.lineTo(p.pts[2]+nx*sg,p.pts[3]+ny*sg)}ctx.stroke()}}
      else if(k==='switch'){if(s<0.5)continue;ctx.strokeStyle='rgba(60,60,60,0.7)';ctx.lineWidth=0.3;ctx.beginPath();for(let x=p.x+5;x<p.x+p.w;x+=12){ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h)}for(let y=p.y+5;y<p.y+p.h;y+=18){ctx.moveTo(p.x,y);ctx.lineTo(p.x+p.w,y)}ctx.stroke();
        ctx.fillStyle='#8a8c90';for(let x=p.x+5;x<p.x+p.w;x+=12)for(let y=p.y+5;y<p.y+p.h;y+=18)ctx.fillRect(x-1.5,y-1.5,3,3)}
      else if(k==='lawn'){ctx.fillStyle=SEASON===2?'#e4e8ec':SEASON===1?'#8e9450':'#6f9a4c';ctx.fillRect(p.x,p.y,p.w,p.h);if(s>1.2){ctx.fillStyle='rgba(255,255,230,0.07)';if(p.o===0)for(let x=p.x;x<p.x+p.w;x+=3)ctx.fillRect(x,p.y,1.5,p.h);else for(let y=p.y;y<p.y+p.h;y+=3)ctx.fillRect(p.x,y,p.w,1.5)}}
      else if(k==='pool'){ctx.fillStyle='#d8d6cc';ctx.fillRect(p.x-0.8,p.y-0.8,p.w+1.6,p.h+1.6);const gp=ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y+p.h);gp.addColorStop(0,'#3fb6d8');gp.addColorStop(1,'#7fdcef');if(SEASON>0){gp.addColorStop(0,SEASON===2?'#b8c4cc':'#4a7a8a');gp.addColorStop(1,SEASON===2?'#cdd6dc':'#5a8a96')}ctx.fillStyle=gp;ctx.fillRect(p.x,p.y,p.w,p.h);
        if(s>2){ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=0.12;ctx.beginPath();for(let q=1;q<4;q++){ctx.moveTo(p.x+p.w*q/4,p.y+0.5);ctx.bezierCurveTo(p.x+p.w*q/4+0.6,p.y+p.h*0.3,p.x+p.w*q/4-0.6,p.y+p.h*0.7,p.x+p.w*q/4,p.y+p.h-0.5)}ctx.stroke()}}
      else if(k==='helipad'){ctx.fillStyle='#4a4d52';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();ctx.strokeStyle='#e8e8e2';ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(p.x,p.y,p.r*0.85,0,TAU);ctx.stroke();
        ctx.fillStyle='#d23a30';const a=p.r*0.55,b=p.r*0.18;ctx.fillRect(p.x-a,p.y-b,2*a,2*b);ctx.fillRect(p.x-b,p.y-a,2*b,2*a)}
      else if(k==='field'){ctx.fillStyle=SEASON===2?'#e6eaee':SEASON===1?'#6e8a3c':'#4a8c3a';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='rgba(255,255,255,0.06)';for(let q=0;q<p.w;q+=p.w/8)ctx.fillRect(p.x+q,p.y,p.w/16,p.h);
        if(s>0.8){ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=0.14;ctx.strokeRect(p.x+2,p.y+2,p.w-4,p.h-4);ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y+2);ctx.lineTo(p.x+p.w/2,p.y+p.h-2);ctx.stroke();ctx.beginPath();ctx.arc(p.x+p.w/2,p.y+p.h/2,p.h*0.14,0,TAU);ctx.stroke();
          ctx.strokeRect(p.x+2,p.y+p.h*0.3,p.w*0.14,p.h*0.4);ctx.strokeRect(p.x+p.w-2-p.w*0.14,p.y+p.h*0.3,p.w*0.14,p.h*0.4)}}
      else if(k==='court'){ctx.fillStyle='#d8d6cc';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle=p.t?'#b8603c':'#3a6ea8';ctx.fillRect(p.x+1.5,p.y+1.5,p.w-3,p.h-3);ctx.fillStyle=p.t?'#c87050':'#4a8a4c';ctx.fillRect(p.x+3.5,p.y+5,p.w-7,p.h-10);
        if(s>1.5){ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=0.08;ctx.strokeRect(p.x+3.5,p.y+5,p.w-7,p.h-10);ctx.beginPath();ctx.moveTo(p.x+3.5,p.y+p.h/2);ctx.lineTo(p.x+p.w-3.5,p.y+p.h/2);ctx.moveTo(p.x+p.w/2,p.y+11);ctx.lineTo(p.x+p.w/2,p.y+p.h-11);ctx.moveTo(p.x+3.5,p.y+11);ctx.lineTo(p.x+p.w-3.5,p.y+11);ctx.moveTo(p.x+3.5,p.y+p.h-11);ctx.lineTo(p.x+p.w-3.5,p.y+p.h-11);ctx.stroke()}}
      else if(k==='graves'){if(s<0.25){ctx.fillStyle='rgba(150,150,140,0.35)';ctx.fillRect(p.x,p.y,p.w,p.h);continue}const r=rng(p.seed);
        for(let y=p.y+1;y<p.y+p.h-2;y+=3.2)for(let x=p.x+0.5;x<p.x+p.w-1;x+=1.9){if(r()<0.15)continue;const v=r();ctx.fillStyle=v<0.5?'#9a9a96':v<0.8?'#d8d6d0':'#3c3c3e';ctx.fillRect(x,y,0.9,1.6);if(s>2&&r()<0.4){ctx.fillStyle='#c84a4a';ctx.fillRect(x+0.2,y+1.7,0.5,0.4)}}}
      else if(k==='quarry'){const r=rng(p.seed);const n=7;for(let i=0;i<n;i++){const f=1-i/n*0.92;const rx=p.rx*f,ry=p.ry*f;const ox=(r()-0.5)*p.rx*0.06*i,oy=(r()-0.5)*p.ry*0.06*i;
          const v=i%2?0.92:1.04,base=[176-i*9,154-i*9,118-i*8];ctx.fillStyle='rgba(60,50,40,0.35)';ctx.beginPath();ctx.ellipse(p.x+ox+2.5,p.y+oy+2.5,rx,ry,0.15,0,TAU);ctx.fill();
          ctx.fillStyle=cs(base,v);ctx.beginPath();ctx.ellipse(p.x+ox,p.y+oy,rx,ry,0.15,0,TAU);ctx.fill();ctx.strokeStyle=cs(base,1.25);ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x+ox,p.y+oy,rx,ry,0.15,PI*0.9,PI*1.6);ctx.stroke()}
        ctx.fillStyle='#4e7a78';ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx*0.1,p.ry*0.08,0.15,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(210,196,160,0.9)';ctx.lineWidth=7;ctx.beginPath();for(let t=0;t<=1;t+=0.02){const f=1-t*0.85,a=t*TAU*1.6;const xx=p.x+M.cos(a)*p.rx*f,yy=p.y+M.sin(a)*p.ry*f;if(t===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)}ctx.stroke()}
      else if(k==='bund'){ctx.strokeStyle='#bab4a2';ctx.lineWidth=1.6;ctx.strokeRect(p.x,p.y,p.w,p.h)}
    }else if(pass===1){
      if(k==='b'){if(s*M.max(p.w,p.h)<1.2)continue;bShadow(ctx,p)}
      else if(k==='cyl'){if(p.r*s<0.4)continue;const r=p.r*(p.st==='cool'?0.9:1),dx=SDX*p.H,dy=SDY*p.H;let n=0;for(let a=0;a<12;a++){const c=M.cos(a*PI/6)*r,sn=M.sin(a*PI/6)*r;HP[n++]=p.x+c;HP[n++]=p.y+sn;HP[n++]=p.x+dx+c;HP[n++]=p.y+dy+sn}hullFill(ctx,HP,24)}
      else if(k==='crane2'){ctx.save();ctx.translate(p.x+SDX*p.H,p.y+SDY*p.H);ctx.rotate(p.a);ctx.rect(-p.len*0.3,-0.7,p.len*1.3,1.4);ctx.restore();ctx.rect(p.x,p.y-0.9,SDX*p.H,1.8)}
    }else{
      if(k==='b'){if(s*M.max(p.w,p.h)<0.5)continue;DEF.push(p)}
      else if(k==='cyl'){if(p.r*s<0.3)continue;DEF.push(p)}
      else if(k==='t'){if(p.d*s<1.6)continue;TREEQ.push(FOX+(p.x*FCA-p.y*FSA)*FS,FOY+(p.x*FSA+p.y*FCA)*FS,p.d*FS,p.v)}
      else if(k==='pk'){if(s<0.55)continue;drawParked(ctx,p,s)}
      else if(k==='play'){if(s<0.5)continue;ctx.fillStyle='#c8b890';ctx.fillRect(p.x,p.y,p.w,p.h);const r=rng(p.x*7|0);for(let q=0;q<4;q++){ctx.fillStyle=['#d04030','#3070c0','#e0b020','#40a050'][q];ctx.fillRect(p.x+1+r()*(p.w-4),p.y+1+r()*(p.h-4),2+r()*1.5,1.2+r())}}
      else if(k==='bales'){if(s<0.6)continue;const r=rng(p.seed);for(let q=0;q<60;q++){const x=p.x+r()*p.w,y=p.y+r()*p.h;ctx.fillStyle='rgba(0,0,0,0.28)';ctx.beginPath();ctx.arc(x+0.7,y+0.55,0.9,0,TAU);ctx.fill();ctx.fillStyle=r()<0.5?'#d8c070':'#c8b062';ctx.beginPath();ctx.arc(x,y,0.9,0,TAU);ctx.fill()}}
      else if(k==='hedge'){if(s<0.7)continue;ctx.strokeStyle=SEASON===2?'#6a7a6a':SEASON===1?'#7a6a30':'#3e6a30';ctx.lineWidth=1.1;ctx.strokeRect(p.x,p.y,p.w,p.h)}
      else if(k==='fence'){if(s<1.3)continue;ctx.strokeStyle='rgba(90,72,56,0.6)';ctx.lineWidth=0.15;ctx.strokeRect(p.x,p.y,p.w,p.h)}
      else if(k==='gh'){if(s<0.6)continue;ctx.fillStyle='rgba(230,240,240,0.75)';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='rgba(120,140,140,0.5)';for(let y=p.y+1;y<p.y+p.h;y+=1.2)ctx.fillRect(p.x,y,p.w,0.2)}
      else if(k==='pile'){if(p.r*s<0.5)continue;const g=ctx.createRadialGradient(p.x-p.r*0.3,p.y-p.r*0.3,0,p.x,p.y,p.r);g.addColorStop(0,cs(p.c,1.3));g.addColorStop(1,cs(p.c,0.7));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,p.r,p.r*0.8,0.4,0,TAU);ctx.fill()}
      else if(k==='pipe'){ctx.lineCap='butt';ctx.lineWidth=p.w+1;ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.moveTo(p.pts[0]+1.5,p.pts[1]+1.5);ctx.lineTo(p.pts[2]+1.5,p.pts[3]+1.5);ctx.stroke();
        if(s<0.6){ctx.strokeStyle='#9a9890';ctx.lineWidth=p.w;ctx.beginPath();ctx.moveTo(p.pts[0],p.pts[1]);ctx.lineTo(p.pts[2],p.pts[3]);ctx.stroke()}
        else{const dx=p.pts[2]-p.pts[0],dy=p.pts[3]-p.pts[1],l=M.hypot(dx,dy),nx=-dy/l,ny=dx/l;const cols=['#c8c8c4','#a0a29e','#c9a43a','#b04a3a','#7c8a96','#d8d8d4','#8a7a60','#c0c0b8'];
          for(let q=0;q<p.n;q++){const o=(q-(p.n-1)/2)*(p.w/p.n);ctx.strokeStyle=cols[q%8];ctx.lineWidth=p.w/p.n*0.7;ctx.beginPath();ctx.moveTo(p.pts[0]+nx*o,p.pts[1]+ny*o);ctx.lineTo(p.pts[2]+nx*o,p.pts[3]+ny*o);ctx.stroke()}}}
      else if(k==='cont'){if(s<0.12){ctx.fillStyle='#8a6a5a';ctx.fillRect(p.x,p.y,p.w,p.h);continue}const r=rng(p.seed);const CC=[[180,60,48],[46,110,164],[224,160,48],[58,125,68],[136,136,136],[210,84,0],[220,220,220],[93,78,140],[150,40,40]];
        for(let y=p.y;y<p.y+p.h-12;y+=16){for(let x=p.x;x<p.x+p.w-2.4;x+=2.5){if(r()<0.1)continue;const c=CC[r()*9|0];const hgt=1+(r()*4|0);ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(x+hgt*0.6,y+hgt*0.5,2.4,12.2);ctx.fillStyle=cs(c,0.85+hgt*0.06);ctx.fillRect(x,y,2.4,12.2)}}}
      else if(k==='crane'){ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(p.x+12,p.y+10,p.len,4);ctx.fillRect(p.x+10,p.y+8,22,22);ctx.fillStyle=cs(p.c,1);ctx.fillRect(p.x-4,p.y,p.len,3.2);ctx.fillRect(p.x,p.y-2,3,24);ctx.fillRect(p.x+16,p.y-2,3,24);ctx.fillStyle=cs(p.c,0.7);ctx.fillRect(p.x+p.len*0.6,p.y-0.8,4,4.8)}
      else if(k==='crane2'||k==='dome'){DEF.push(p)}
      else if(k==='ship'){if(s<0.08)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);drawShip(ctx,p.len,p.st,p.c);ctx.restore()}
      else if(k==='plane'){if(s<0.1)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.globalAlpha=0.3;ctx.fillStyle='#000';ctx.translate(2,2);drawPlane(ctx,p.s,p.c);ctx.translate(-2,-2);ctx.globalAlpha=1;drawPlane(ctx,p.s,p.c);ctx.restore()}
      else if(k==='solar'){ctx.fillStyle='#1e2a44';const step=s>0.6?6:6;for(let y=p.y;y<p.y+p.h-3;y+=step){ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(p.x,y+3.2,p.w,1.2);ctx.fillStyle='#24345a';ctx.fillRect(p.x,y,p.w,3.4);if(s>0.8){ctx.fillStyle='rgba(160,190,230,0.25)';ctx.fillRect(p.x,y,p.w,0.6)}}}
      else if(k==='stad'){const w=p.w,h=p.h;ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(p.x+8,p.y+6,w/2,h/2,0,0,TAU);ctx.fill();
        ctx.fillStyle='#d8d8d4';ctx.beginPath();ctx.ellipse(p.x,p.y,w/2,h/2,0,0,TAU);ctx.fill();ctx.fillStyle='#8a2a2a';ctx.beginPath();ctx.ellipse(p.x,p.y,w*0.42,h*0.4,0,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=0.4;for(let q=0;q<6;q++){ctx.beginPath();ctx.ellipse(p.x,p.y,w*(0.3+q*0.02),h*(0.3+q*0.017),0,0,TAU);ctx.stroke()}
        const pw=w*0.5,ph=h*0.5;ctx.fillStyle=SEASON===2?'#e4e8ec':'#3f8a36';ctx.fillRect(p.x-pw/2,p.y-ph/2,pw,ph);ctx.fillStyle='rgba(255,255,255,0.06)';for(let q=0;q<10;q+=2)ctx.fillRect(p.x-pw/2+q*pw/10,p.y-ph/2,pw/10,ph);
        ctx.strokeStyle='rgba(255,255,255,0.8)';ctx.lineWidth=0.25;ctx.strokeRect(p.x-pw/2+2,p.y-ph/2+2,pw-4,ph-4);ctx.beginPath();ctx.moveTo(p.x,p.y-ph/2+2);ctx.lineTo(p.x,p.y+ph/2-2);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,ph*0.15,0,TAU);ctx.stroke()}
    }}
  if(pass===2&&DEF.length){if(DEF.length>1)DEF.sort((a,b)=>tallKey(b)-tallKey(a));for(let i=0;i<DEF.length;i++)drawTall(ctx,DEF[i],s);DEF.length=0}}
function drawParked(ctx,p,s){const S=sprites();const r=rng(p.seed);const hor=p.w>=p.h;
  if(p.bus){const L=hor?p.h:p.w;const rows=M.max(1,M.floor(L/14));const n=hor?M.floor(p.w/4):M.floor(p.h/4);
    for(let rw=0;rw<rows;rw++)for(let q=0;q<n;q++){if(r()>p.fill)continue;ctx.save();if(hor){ctx.translate(p.x+q*4+2,p.y+rw*14+7);ctx.rotate(PI/2)}else{ctx.translate(p.x+rw*14+7,p.y+q*4+2)}ctx.drawImage(S.bus,-6.25,-1.5,12.5,3);ctx.restore()}return}
  if(p.truck){const n=hor?M.floor(p.w/4.2):M.floor(p.h/4.2);for(let q=0;q<n;q++){if(r()>p.fill)continue;const spr=S.truck[r()*5|0];ctx.save();if(hor){ctx.translate(p.x+q*4.2+2.1,p.y+p.h/2);ctx.rotate(PI/2)}else{ctx.translate(p.x+p.w/2,p.y+q*4.2+2.1)}
      const L=M.min(17,hor?p.h:p.w);ctx.drawImage(spr,-L/2,-2.1,L,4.2);ctx.restore()}return}
  const rows=M.max(1,M.floor((hor?p.h:p.w)/5.4));
  for(let rw=0;rw<rows;rw++){const L=hor?p.w:p.h;for(let a=0;a+2.6<=L;a+=2.6){if(r()>p.fill)continue;const spr=S.car[r()*S.car.length|0];const fl=r()<0.5;
    ctx.save();if(hor){ctx.translate(p.x+a+1.3,p.y+rw*5.4+2.5);ctx.rotate(fl?PI/2:-PI/2)}else{ctx.translate(p.x+rw*5.4+2.5,p.y+a+1.3);if(fl)ctx.rotate(PI)}
    ctx.drawImage(spr,-2.5,-1.25,5,2.5);ctx.restore()}}}

// ---------------------------------------------------------------- roads drawing
let TX0=0,TY0=0;
function offsetPath(ctx,r,off){const p=r.pts,n=r.n;
  for(let i=0;i<n;i++){let nx,ny;if(i===0){nx=-(p[3]-p[1]);ny=p[2]-p[0]}else if(i===n-1){nx=-(p[i*2+1]-p[i*2-1]);ny=p[i*2]-p[i*2-2]}else{const ax=p[i*2]-p[i*2-2],ay=p[i*2+1]-p[i*2-1],bx=p[i*2+2]-p[i*2],by=p[i*2+3]-p[i*2+1];const la=M.hypot(ax,ay)||1,lb=M.hypot(bx,by)||1;nx=-(ay/la+by/lb);ny=ax/la+bx/lb}
    const l=M.hypot(nx,ny)||1;const x=p[i*2]+nx/l*off,y=p[i*2+1]+ny/l*off;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}}
function offsetRange(ctx,r,off,a,b){let p=posAt(r,a);ctx.moveTo(p[0]-p[3]*off,p[1]+p[2]*off);for(let i=0;i<r.n;i++){const c=r.cum[i];if(c>a&&c<b){const q=posAt(r,c-0.01);ctx.lineTo(r.pts[i*2]-q[3]*off,r.pts[i*2+1]+q[2]*off)}}p=posAt(r,b);ctx.lineTo(p[0]-p[3]*off,p[1]+p[2]*off)}
function PT(ctx,it,off){if(it.r)offsetRange(ctx,it.r,off,it.a,it.b);else offsetPath(ctx,it,off)}
function subPath(ctx,r,s0,s1){offsetRange(ctx,r,0,s0,s1)}
function isDirt(r){return r.k===4&&(r.id*2654435761>>>0)%100<55}
const ORDER=[5,4,3,6,2,7,1,0];
function strokeAll(ctx,L,off){ctx.beginPath();for(const it of L)PT(ctx,it,off);ctx.stroke()}
function strokeSym(ctx,L,offs){ctx.beginPath();for(const it of L)for(const o of offs){PT(ctx,it,o);PT(ctx,it,-o)}ctx.stroke()}
function drawRoads(ctx,list,mpp,over){const s=1/mpp;
  const byK=[[],[],[],[],[],[],[],[],[]];for(const it of list){const r=it.r||it;if(r.k!==8)byK[r.k].push(it)}
  ctx.lineJoin='round';
  for(const k of ORDER){let L=byK[k];if(!L.length)continue;const w=RW[k];const px=w*s;let alpha=1,lw=w;if(px<RMIN[k]){alpha=M.max(0.25,M.pow(px/RMIN[k],0.45));lw=RMIN[k]*mpp}
    if(k===3&&mpp>22)continue;if((k===2||k===7)&&mpp>40)continue;if(k===4&&mpp>45)continue;if(k===6&&mpp>30)continue;
    ctx.globalAlpha=alpha;
    if(k===5){ctx.lineCap='butt';ctx.strokeStyle=px>2?'#7c7466':'#5a5650';ctx.lineWidth=lw;strokeAll(ctx,L,0);
      if(s>1.4){ctx.strokeStyle='#5a4636';ctx.lineWidth=2.8;ctx.setLineDash([0.32,0.33]);strokeAll(ctx,L,0);ctx.setLineDash([]);
        ctx.strokeStyle='#9a9ca2';ctx.lineWidth=0.14;strokeSym(ctx,L,[0.72])}
      if(!over)for(const r of L)if(r.br&&px>1)bridgeDecks(ctx,r,w+3,s);
      ctx.globalAlpha=1;continue}
    ctx.lineCap=over?'butt':'round';
    const dirt=[],paved=[];if(k===4){for(const it of L)(isDirt(it.r||it)?dirt:paved).push(it)}
    // casing / curbs
    if(px>1.2){ctx.strokeStyle=SEASON===2&&k!==6?(k===4?'#c4c6c8':'#d2d6da'):k===0?'#8c8a84':k===1?'#9a968a':k===4?'#8a8070':k===6?'#8c8a84':'#a8a69e';ctx.lineWidth=lw+(k===0?2:k===4?1.5:1.2);strokeAll(ctx,L,0)}
    if(!over)for(const r of L)if(r.br&&px>0.8)bridgeDecks(ctx,r,w+4,s);
    const fc=px<2?(k===0?'#c0b8a8':k===1?'#aaa396':k===4?(SEASON===2?'#c8c8c4':'#a89c86'):SEASON===2?'#8a8c90':'#9a9890'):(k===0?'#56585c':k===1?'#5e6064':k===2?'#58595d':k===3?'#626366':k===6?'#5a5c60':k===7?'#5a5b5f':SEASON===2?'#b4b6b8':'#76726a');
    if(k===0&&px>4){ctx.strokeStyle='#8a8880';ctx.lineWidth=w;strokeAll(ctx,L,0);ctx.strokeStyle=fc;ctx.lineWidth=12;ctx.lineCap='butt';strokeSym(ctx,L,[7.6]);ctx.lineCap=over?'butt':'round';
      ctx.strokeStyle='#b8b6ae';ctx.lineWidth=0.8;strokeAll(ctx,L,0)}
    else if(k===7&&px>4){ctx.strokeStyle=fc;ctx.lineWidth=w-1;strokeAll(ctx,L,0);ctx.strokeStyle='#b0aea6';ctx.lineWidth=6;strokeAll(ctx,L,0);ctx.strokeStyle=SEASON===2?'#dde2e6':SEASON===1?'#8a8a46':'#628a48';ctx.lineWidth=5;strokeAll(ctx,L,0);
      if(s>0.35&&!over){for(const r of L){const n=M.floor(r.L/9);for(let q=1;q<n;q++){const p=posAt(r,q*9);TREEQ.push((p[0]-TX0)*s,(p[1]-TY0)*s,(6+((q*7+r.id)%3))*s,(q+r.id)%3===0?4:0)}}}}
    else if(k===4&&px>2){if(paved.length){ctx.strokeStyle='#6c6a66';ctx.lineWidth=lw;strokeAll(ctx,paved,0)}
      if(dirt.length){ctx.strokeStyle='#8c7a5c';ctx.lineWidth=lw;strokeAll(ctx,dirt,0);if(s>0.9){ctx.lineCap='butt';ctx.strokeStyle='rgba(70,56,40,0.45)';ctx.lineWidth=0.7;strokeSym(ctx,dirt,[1.15]);ctx.strokeStyle='rgba(96,120,64,0.55)';ctx.lineWidth=0.6;strokeAll(ctx,dirt,0)}}}
    else{ctx.strokeStyle=fc;ctx.lineWidth=lw;strokeAll(ctx,L,0)}
    // trams
    if(k===2&&s>0.6){const T=L.filter(it=>(it.r||it).tram);if(T.length){ctx.lineCap='butt';ctx.strokeStyle='#76736c';ctx.lineWidth=3.1;strokeSym(ctx,T,[1.75]);if(s>1.3){ctx.strokeStyle='#a9abb0';ctx.lineWidth=0.12;strokeSym(ctx,T,[1.03,2.47])}}}
    // tyre wear
    if(s>0.7&&(k<=3||k===6||k===7)){ctx.lineCap='butt';ctx.strokeStyle='rgba(20,20,20,0.10)';ctx.lineWidth=0.7;const LO=k===0?[3.6,7.1,10.6]:k===2?[2.6,6.2]:k===1?[2.6]:k===6?[0]:k===7?[5.6,9.2]:[2.3];
      ctx.beginPath();for(const it of L)for(const o of LO){PT(ctx,it,o-0.85);PT(ctx,it,o+0.85);if(o){PT(ctx,it,-o-0.85);PT(ctx,it,-o+0.85)}}ctx.stroke()}
    // markings
    if(s>0.9){ctx.lineCap='butt';ctx.strokeStyle='rgba(240,240,235,0.85)';ctx.lineWidth=0.16;
      if(k===0){strokeSym(ctx,L,[1.9,13.3]);ctx.setLineDash([3,9]);strokeSym(ctx,L,[5.4,8.9]);ctx.setLineDash([])}
      else if(k===2){strokeSym(ctx,L,[0.25]);ctx.setLineDash([3,6]);strokeSym(ctx,L,[4.3]);ctx.setLineDash([])}
      else if(k===7){strokeSym(ctx,L,[13.6]);ctx.setLineDash([3,6]);strokeSym(ctx,L,[7.4]);ctx.setLineDash([])}
      else if(k===6){strokeSym(ctx,L,[3.4])}
      else if(k===1||k===3){ctx.setLineDash([3,5]);strokeAll(ctx,L,0);ctx.setLineDash([]);if(k===1)strokeSym(ctx,L,[4.6])}}
    ctx.globalAlpha=1}
  ctx.lineCap='butt'}
function drawOverpasses(ctx,rl,mpp){const s=1/mpp;if(mpp>20)return;const items=[];
  for(const r of rl)if(r.ov)for(const o of r.ov)items.push({r,a:M.max(0,o[0]),b:M.min(r.L,o[1])});if(!items.length)return;
  ctx.lineCap='butt';ctx.lineJoin='round';
  ctx.save();ctx.translate(SUNX*7,SUNY*7);ctx.strokeStyle='rgba(10,16,26,0.34)';for(const it of items){ctx.lineWidth=RW[it.r.k]+5;ctx.beginPath();PT(ctx,it,0);ctx.stroke()}ctx.restore();
  ctx.strokeStyle='#b2b0a8';for(const it of items){ctx.lineWidth=RW[it.r.k]+4;ctx.beginPath();PT(ctx,it,0);ctx.stroke()}
  drawRoads(ctx,items,mpp,true);
  if(s>0.8){ctx.strokeStyle='#e4e2da';ctx.lineWidth=0.45;for(const it of items){const o=RW[it.r.k]/2+1.6;ctx.beginPath();PT(ctx,it,o);PT(ctx,it,-o);ctx.stroke()}}}
function drawPower(ctx,rl,mpp){if(mpp>7)return;const s=1/mpp;const H=38;
  for(const r of rl){if(r.k!==8)continue;const p=r.pts;
    ctx.lineCap='round';ctx.strokeStyle='rgba(10,16,26,0.22)';ctx.lineWidth=M.max(0.25,mpp*0.5);ctx.beginPath();
    for(let i=0;i<r.n-1;i++){const ax=p[i*2],ay=p[i*2+1],bx=p[i*2+2],by=p[i*2+3];const L=M.hypot(bx-ax,by-ay)||1;const nx=-(by-ay)/L,ny=(bx-ax)/L;
      for(const o of [-7,0,7]){ctx.moveTo(ax+SUNX*(H-4)+nx*o,ay+SUNY*(H-4)+ny*o);ctx.lineTo(bx+SUNX*(H-4)+nx*o,by+SUNY*(H-4)+ny*o)}}ctx.stroke();
    ctx.lineWidth=2.4;ctx.strokeStyle='rgba(10,16,26,0.25)';ctx.beginPath();for(let i=0;i<r.n;i++){const x=p[i*2],y=p[i*2+1];ctx.moveTo(x,y);ctx.lineTo(x+SUNX*H,y+SUNY*H)}ctx.stroke();
    for(let i=0;i<r.n;i++){const x=p[i*2],y=p[i*2+1];const j=M.min(i,r.n-2);const L=M.hypot(p[j*2+2]-p[j*2],p[j*2+3]-p[j*2+1])||1;const nx=-(p[j*2+3]-p[j*2+1])/L,ny=(p[j*2+2]-p[j*2])/L;
      ctx.strokeStyle='#6a6c70';ctx.lineWidth=0.5;ctx.strokeRect(x-3,y-3,6,6);ctx.strokeStyle='#55575c';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+LEANX*H,y+LEANY*H);ctx.stroke();
      ctx.lineWidth=0.7;ctx.beginPath();ctx.moveTo(x+LEANX*H-nx*8,y+LEANY*H-ny*8);ctx.lineTo(x+LEANX*H+nx*8,y+LEANY*H+ny*8);ctx.stroke()}
    ctx.strokeStyle='rgba(40,42,46,0.75)';ctx.lineWidth=M.max(0.18,mpp*0.55);ctx.beginPath();
    for(let i=0;i<r.n-1;i++){const ax=p[i*2]+LEANX*H,ay=p[i*2+1]+LEANY*H,bx=p[i*2+2]+LEANX*H,by=p[i*2+3]+LEANY*H;const L=M.hypot(bx-ax,by-ay)||1;const nx=-(by-ay)/L,ny=(bx-ax)/L;
      for(const o of [-7,0,7]){ctx.moveTo(ax+nx*o,ay+ny*o);ctx.quadraticCurveTo((ax+bx)/2+nx*o+SUNX*0+LEANX*-6,(ay+by)/2+ny*o-LEANY*-6*0+3,bx+nx*o,by+ny*o)}}ctx.stroke()}
  ctx.lineCap='butt'}
function bridgeDecks(ctx,r,w,s){for(const b of r.br){ctx.save();ctx.translate(SUNX*9,SUNY*9);ctx.strokeStyle='rgba(10,20,30,0.35)';ctx.lineWidth=w;ctx.beginPath();subPath(ctx,r,b[0],b[1]);ctx.stroke();ctx.restore();
  ctx.strokeStyle='#b4b2aa';ctx.lineWidth=w;ctx.beginPath();subPath(ctx,r,b[0],b[1]);ctx.stroke();
  if(s>0.8){ctx.strokeStyle='#e0ded6';ctx.lineWidth=0.5;ctx.beginPath();const sv=ctx.lineCap;offsetSub(ctx,r,b,w/2-0.4);offsetSub(ctx,r,b,-w/2+0.4);ctx.stroke()}}}
function offsetSub(ctx,r,b,off){let st=false;const step=8;for(let s=b[0];s<=b[1];s+=step){const p=posAt(r,s);const x=p[0]-p[3]*off,y=p[1]+p[2]*off;if(!st){ctx.moveTo(x,y);st=true}else ctx.lineTo(x,y)}}


// ================================================================= NIGHT LIGHTS (stage 2)
// Separate additive layer, rendered per tile like the day layer. Main thread composites it with 'lighter'.
const LC={wled:'255,226,184',sod:'255,158,62',led:'222,232,255',warm:'255,198,128',win:'255,212,150',cool:'186,210,255',red:'255,36,24',grn:'70,255,130',blu:'70,128,255',gold:'255,198,90'};
function la(c,a){return 'rgba('+c+','+a+')'}
let POOL=null;
function pools(){if(POOL)return POOL;POOL={};for(const k in LC){const c=mkCanvas(64,64),x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,la(LC[k],1));g.addColorStop(0.12,la(LC[k],0.75));g.addColorStop(0.4,la(LC[k],0.22));g.addColorStop(0.72,la(LC[k],0.06));g.addColorStop(1,la(LC[k],0));x.fillStyle=g;x.fillRect(0,0,64,64);POOL[k]=c}return POOL}
let LS=1,LMPP=1,LCNT=0;
// light of real diameter d (m); energy preserving when it becomes sub-pixel
function fdot(ctx,c,x,y,d,a){LCNT++;const px=d*LS;
  if(px>=1.6){ctx.globalAlpha=a;ctx.drawImage(POOL[c],x-d/2,y-d/2,d,d);ctx.globalAlpha=1;return}
  const q=1.3*LMPP;ctx.fillStyle=la(LC[c],M.min(1,a*0.32*(px/1.3)*(px/1.3)+0.02*a));ctx.fillRect(x-q/2,y-q/2,q,q)}
const DASH=[[1.2,0.8],[2,1.5,0.8,2.5],[1,2.2],[3,1,1,1],[0.9,0.5],[1.5,3,1,1],[2.2,0.6],[0.8,1.6,2,0.7]];
// lit windows on the visible (pseudo-3D) facades; mirrors bld3d geometry. Returns false when the facade is too small.
function facadeLights(ctx,p,s,hs,lit,ind){const H=p.H||0,H0=p.H0||0,lx=LNX*H,ly=LNY*H;const lpx=M.hypot(lx,ly)*s;if(lpx<2.2||s<0.45)return false;
  let ca=1,sa=0;if(p.a){ca=M.cos(p.a);sa=M.sin(p.a)}const cx=p.x+p.w/2,cy=p.y+p.h/2,hw=p.w/2,hhh=p.h/2;
  BC[0]=cx-hw*ca+hhh*sa;BC[1]=cy-hw*sa-hhh*ca;BC[2]=cx+hw*ca+hhh*sa;BC[3]=cy+hw*sa-hhh*ca;BC[4]=cx+hw*ca-hhh*sa;BC[5]=cy+hw*sa+hhh*ca;BC[6]=cx-hw*ca-hhh*sa;BC[7]=cy-hw*sa+hhh*ca;
  const bx=LNX*H0,by=LNY*H0,dlx=lx-bx,dly=ly-by,LL=M.hypot(dlx,dly);const glass=p.r==='gl';const col=glass?LC.cool:lit>0.55?LC.win:LC.warm;
  const fl=M.max(1,M.round((H-H0)/3.1));const step=M.max(1,M.ceil(1.6/(LL*s/fl)));const fr=ind?0.15:0.25+0.6*(((hs>>>8)&255)/255);LCNT++;
  ctx.strokeStyle=la(col,(0.05+fr*0.08)*M.min(1,3.2/(LMPP*1.3)));ctx.lineWidth=M.max(4,LMPP*1.3);ctx.strokeRect(p.x-1,p.y-1,p.w+2,p.h+2);
  ctx.lineWidth=LL/fl*(glass?0.5:0.42)*M.min(step,2);ctx.setLineDash(DASH[(hs>>>20)&7]);
  for(let e=0;e<4;e++){const nx=NRM[e*2]*ca-NRM[e*2+1]*sa,ny=NRM[e*2]*sa+NRM[e*2+1]*ca;const dp=nx*lx+ny*ly;if(dp>=0)continue;
    const e1=(e+1)&3;const a0x=BC[e*2]+bx,a0y=BC[e*2+1]+by,a1x=BC[e1*2]+bx,a1y=BC[e1*2+1]+by;const el=M.hypot(a1x-a0x,a1y-a0y);if(el*s<3)continue;
    const ex=(a1x-a0x)/el,ey=(a1y-a0y)/el,ins=M.min(1.2,el*0.08);
    for(let f=0;f<fl;f+=step){const hr2=hh(hs,e,f);const on=((hr2&255)/255)<fr*(f>fl*0.8&&!glass?0.7:1);if(!on)continue;ctx.lineDashOffset=(hr2>>>8)&7;
      ctx.strokeStyle=la(col,0.45+(((hr2>>>16)&255)/255)*0.5);const t=(f+0.58)/fl;ctx.beginPath();ctx.moveTo(a0x+ex*ins+dlx*t,a0y+ey*ins+dly*t);ctx.lineTo(a1x-ex*ins+dlx*t,a1y-ey*ins+dly*t);ctx.stroke()}}
  ctx.setLineDash([]);ctx.lineDashOffset=0;
  if(H>95)fdot(ctx,'red',cx+lx,cy+ly,5,1);
  if(ind&&lit>0.45)fdot(ctx,'sod',p.x+(((hs>>>12)&1)?0:p.w),p.y+p.h+5,30,0.5);
  return true}
function drawLightPrims(ctx,P,mpp,ind){const s=1/mpp;
  for(let q=0;q<P.length;q++){const p=P[q],k=p.k;
    if(k==='b'){
      if(p.r==='glh'){LCNT++;ctx.fillStyle=la(LC.sod,0.22);ctx.fillRect(p.x,p.y,p.w,p.h);continue}
      if(p.cnp){LCNT++;ctx.fillStyle=la(LC.led,0.55);ctx.fillRect(p.x,p.y,p.w,p.h);fdot(ctx,'led',p.x+p.w/2,p.y+p.h/2,M.max(p.w,p.h)*1.6,0.5);continue}
      if(p.nd)continue;const hs=hh(p.x*10|0,p.y*10|0,77),lit=(hs&255)/255;
      if(p.r!=='g'&&p.r!=='h'&&facadeLights(ctx,p,s,hs,lit,ind))continue;
      if(p.r==='g'||p.r==='h'){if(lit<0.3)continue;fdot(ctx,'win',p.x+p.w*(((hs>>>8)&255)/255*0.6+0.2),p.y+p.h*(((hs>>>16)&255)/255*0.6+0.2),6,0.85);
        if(lit>0.72)fdot(ctx,'warm',p.x+p.w/2,p.y+p.h+1.5,7,0.6);continue}
      const big=M.max(p.w,p.h);if(big*s<1.2){fdot(ctx,lit>0.5?'win':'warm',p.x+p.w/2,p.y+p.h/2,big*1.3,0.45+lit*0.4);continue}
      const col=p.r==='gl'?LC.cool:lit>0.55?LC.win:LC.warm;const fr=ind?0.2:0.25+0.65*(((hs>>>8)&255)/255);LCNT++;const kA=M.min(1,3.2/(mpp*1.3));
      ctx.strokeStyle=la(col,(0.06+fr*0.11)*kA);ctx.lineWidth=M.max(4,mpp*1.3);ctx.strokeRect(p.x-1,p.y-1,p.w+2,p.h+2);
      if(s>0.45){ctx.setLineDash(DASH[(hs>>>20)&7]);ctx.lineDashOffset=(hs>>>4)&15;ctx.strokeStyle=la(col,(0.3+fr*0.5)*M.min(1,0.9/(mpp*0.55)));ctx.lineWidth=M.max(0.55,mpp*0.55);ctx.beginPath();
        const sd=(hs>>>24)&3,x0=p.x-0.2,y0=p.y-0.2,x1=p.x+p.w+0.2,y1=p.y+p.h+0.2;
        if(sd!==0){ctx.moveTo(x0,y1);ctx.lineTo(x1,y1)}if(sd!==1){ctx.moveTo(x1,y0);ctx.lineTo(x1,y1)}if(sd!==2&&lit>0.4){ctx.moveTo(x0,y0);ctx.lineTo(x1,y0)}if(sd!==3&&lit>0.6){ctx.moveTo(x0,y0);ctx.lineTo(x0,y1)}
        ctx.stroke();ctx.setLineDash([]);ctx.lineDashOffset=0}
      if(p.H>95)fdot(ctx,'red',p.x+p.w/2+LNX*p.H,p.y+p.h/2+LNY*p.H,5,1);
      if(ind&&lit>0.45)fdot(ctx,'sod',p.x+(((hs>>>12)&1)?0:p.w),p.y+p.h+5,30,0.5)}
    else if(k==='pk'){const hor=p.w>=p.h,L=hor?p.w:p.h;for(let a=10;a<L;a+=24){const x=hor?p.x+a:p.x+p.w/2,y=hor?p.y+p.h/2:p.y+a;fdot(ctx,'led',x,y,20,0.5);fdot(ctx,'led',x,y,2.2,1)}}
    else if(k==='stad'){if(hh(p.x|0,p.y|0,5)%3===0){ctx.fillStyle=la(LC.led,0.32);ctx.fillRect(p.x-p.w*0.25,p.y-p.h*0.25,p.w*0.5,p.h*0.5);LCNT++;
        for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){fdot(ctx,'led',p.x+a*p.w*0.36,p.y+b*p.h*0.36,46,0.75);fdot(ctx,'led',p.x+a*p.w*0.36,p.y+b*p.h*0.36,4,1)}}
      else for(let a=0;a<12;a++)fdot(ctx,'warm',p.x+M.cos(a/12*TAU)*p.w*0.47,p.y+M.sin(a/12*TAU)*p.h*0.47,8,0.5)}
    else if(k==='dome')fdot(ctx,'gold',p.x,p.y,p.r*7,0.5);
    else if(k==='crane2')fdot(ctx,'red',p.x+M.cos(p.a)*p.len,p.y+M.sin(p.a)*p.len,4,1);
    else if(k==='crane'){fdot(ctx,'led',p.x+p.len*0.45,p.y+14,46,0.4);fdot(ctx,'led',p.x+p.len*0.6,p.y+1.5,3,1);fdot(ctx,'red',p.x+p.len-4,p.y+1.5,3,1)}
    else if(k==='cont'){for(let y=p.y+25;y<p.y+p.h;y+=80)for(let x=p.x+25;x<p.x+p.w;x+=80){fdot(ctx,'led',x,y,70,0.32);fdot(ctx,'led',x,y,3,1)}}
    else if(k==='ship'){fdot(ctx,'warm',p.x-p.len*0.42,p.y,16,0.8);fdot(ctx,'led',p.x+p.len*0.1,p.y,p.len*0.55,0.22);fdot(ctx,'led',p.x+p.len*0.45,p.y,2.5,1)}
    else if(k==='rw'){const ey=[p.y,p.y+p.h];for(let x=p.x;x<=p.x+p.w+0.1;x+=60){fdot(ctx,'led',x,ey[0],7,1);fdot(ctx,'led',x,ey[1],7,1)}
      for(let x=p.x+20;x<p.x+p.w;x+=30)fdot(ctx,'led',x,p.y+p.h/2,4,0.75);
      for(let q2=0;q2<9;q2++){const yy=p.y+3+q2*(p.h-6)/8;fdot(ctx,'grn',p.x,yy,5,1);fdot(ctx,'red',p.x+p.w,yy,5,1)}
      for(const [x0,dir] of [[p.x,-1],[p.x+p.w,1]])for(let d=60;d<=900;d+=60){const xx=x0+dir*d;for(let q2=-2;q2<=2;q2++)fdot(ctx,'led',xx,p.y+p.h/2+q2*(d%300===0?9:4),d%300===0?6:4.5,0.9)}}
    else if(k==='ltaxi'){for(let x=p.x;x<=p.x+p.w;x+=40){fdot(ctx,'blu',x,p.y,5,0.9);fdot(ctx,'blu',x,p.y+p.h,5,0.9);fdot(ctx,'grn',x+20,p.y+p.h/2,3,0.6)}}
    else if(k==='cyl'){if(p.st==='tower'){for(let a=0;a<4;a++)fdot(ctx,'sod',p.x+M.cos(a*1.57+0.4)*(p.r+1.2),p.y+M.sin(a*1.57+0.4)*(p.r+1.2),2.4,1);fdot(ctx,'sod',p.x,p.y,p.r*5+8,0.35)}
      else if(p.st==='sphere')fdot(ctx,'sod',p.x,p.y,p.r*2.6,0.3);else if(p.st==='chim'&&p.H>80)fdot(ctx,'red',p.x+LNX*p.H,p.y+LNY*p.H,4,1);else if(p.st==='cool'){fdot(ctx,'red',p.x+LNX*p.H+p.r*0.7,p.y+LNY*p.H,4,1);fdot(ctx,'red',p.x+LNX*p.H-p.r*0.7,p.y+LNY*p.H,4,1)}else if(p.st==='gtow'){fdot(ctx,'cool',p.x+LNX*p.H*0.5,p.y+LNY*p.H*0.5,p.r*3,0.35);fdot(ctx,'red',p.x+LNX*p.H,p.y+LNY*p.H,5,1)}}
    else if(k==='pipe'){const dx=p.pts[2]-p.pts[0],dy=p.pts[3]-p.pts[1],l=M.hypot(dx,dy);for(let a=6;a<l;a+=16)fdot(ctx,'sod',p.pts[0]+dx*a/l,p.pts[1]+dy*a/l,11,0.5)}
    else if(k==='gl'){const big=p.w>6,sp=big?36:24;for(let i=0;i<p.pts.length-2;i+=2){const ax=p.pts[i],ay=p.pts[i+1],dx=p.pts[i+2]-ax,dy=p.pts[i+3]-ay,l=M.hypot(dx,dy);
        for(let a=sp/2;a<l;a+=sp)fdot(ctx,big?'sod':'warm',ax+dx*a/l,ay+dy*a/l,big?18:9,big?0.6:0.55)}}
    else if(k==='lflood'){for(let y=p.y+p.sp/2;y<p.y+p.h;y+=p.sp)for(let x=p.x+p.sp/2;x<p.x+p.w;x+=p.sp){fdot(ctx,p.c,x,y,p.r*2,0.38);fdot(ctx,p.c,x,y,2.5,1)}}
  }}
const LAMP=[[[0],48,26,'sod',0.75],[[6.8],55,19,'sod',0.7],[[10.8,-10.8],32,16,'wled',0.6],[[5.6,-5.6],38,13,'sod',0.55],[[3.6],80,11,'warm',0.5],null,[[0],40,16,'sod',0.6],[[12.8,-12.8],30,16,'wled',0.62],null];
function lightRoads(ctx,list,mpp,bx0,by0,bx1,by1){const s=1/mpp;ctx.lineCap='round';ctx.lineJoin='round';
  const byK=[[],[],[],[],[],[],[],[],[]];for(const r of list)if(byK[r.k])byK[r.k].push(r);
  for(const k of [4,3,6,2,7,1,0]){const L=byK[k];if(!L.length||!LAMP[k])continue;if((k===3&&mpp>22)||((k===2||k===7)&&mpp>40)||(k===4&&mpp>45)||(k===6&&mpp>30))continue;
    const [offs,sp,D,col,a]=LAMP[k];LCNT+=L.length;
    if(D*s>2.4){ctx.strokeStyle=la(LC[col],0.07);ctx.lineWidth=RW[k]*1.15;ctx.beginPath();for(const r of L)offsetPath(ctx,r,0);ctx.stroke();
      for(const r of L){if(r.bb[2]<bx0-D||r.bb[0]>bx1+D||r.bb[3]<by0-D||r.bb[1]>by1+D)continue;const ph=hr(r.id,3,3)*sp;
        for(let oi=0;oi<offs.length;oi++){const off=offs[oi];for(let q=ph+oi*sp/2;q<r.L;q+=sp){const p=posAt(r,q);const x=p[0]-p[3]*off,y=p[1]+p[2]*off;
          if(x<bx0-D||x>bx1+D||y<by0-D||y>by1+D)continue;fdot(ctx,col,x,y,D,a);fdot(ctx,col,x,y,D*0.12,1)}}}}
    else{const w=M.max(D*0.8,mpp*1.15);const aa=a*0.4*M.min(1,D*0.8/w)*(k===0?1.3:k===3?0.8:k===7?1.1:1);ctx.strokeStyle=la(LC[col],M.min(1,aa));ctx.lineWidth=w;ctx.beginPath();for(const r of L)offsetPath(ctx,r,0);ctx.stroke()}}
  ctx.lineCap='butt'}
const BLA=[0,0.95,0.7,0.62,0.3,0.06,0.9,0.3,0.12,0.55,0.45,0.25,0.8,0.3,0.7,0.5,0.55,0.45,0.3,0.85];
const ZLA={ref:0.42,port:0.36,ind:0.2,air:0.16,pow:0.26,solar:0,gas:0.55,stn:0.42,agro:0.5,farm:0.08,dacha:0.1,quarry:0.05,cem:0};
const ZFL={gas:[22,16,'led',0.5],stn:[40,22,'wled',0.42],farm:[90,14,'warm',0.4],quarry:[150,34,'sod',0.32],dacha:[70,10,'warm',0.3]};
function lightFeat(ctx,f,x0,y0,s,mpp,qx0,qy0,qx1,qy1){
  if(f.kind==='city'){
    if(f.type===0){if(mpp>9){ctx.setTransform(s,0,0,s,-x0*s,-y0*s);fdot(ctx,'warm',f.x,f.y,f.R*2.4,M.min(0.6,0.18+mpp*0.004))}
      for(let i=0;i<f.vst.length;i++){const st=f.vst[i];setFrame(ctx,st.x0,st.y0,st.ca,st.sa,x0,y0,s);
        if(mpp>9){const R=rng(hh(f.id,i,72));for(let a=12;a<st.L-12;a+=30){for(const sd of [-1,1]){if(R()<0.35)continue;fdot(ctx,'win',a,sd*12,8,0.7)}if(R()<0.4)fdot(ctx,'warm',a,0,11,0.45)}continue}
        const vk='v'+f.id+'_'+i+(LITE2?'b':LITE?'a':'');let P=bcGet(vk);if(!P){P=genVillage(f,i);bcSet(vk,P)}drawLightPrims(ctx,P,mpp,false);
        for(let a=20;a<st.L;a+=80)fdot(ctx,'warm',a,4,11,0.5)}return}
    const BD=f.D-1;let i0=1e9,i1=-1e9,j0=1e9,j1=-1e9;
    for(const [x,y] of [[qx0,qy0],[qx1,qy0],[qx1,qy1],[qx0,qy1]]){const dx=x-f.x,dy=y-f.y;const u=(dx*f.ca+dy*f.sa),v=(-dx*f.sa+dy*f.ca);i0=M.min(i0,u);i1=M.max(i1,u);j0=M.min(j0,v);j1=M.max(j1,v)}
    const bi0=M.max(0,bsr(f.us,i0)),bi1=M.min(BD-1,bsr(f.us,i1)),bj0=M.max(0,bsr(f.vs,j0)),bj1=M.min(BD-1,bsr(f.vs,j1));
    for(let bj=bj0;bj<=bj1;bj++)for(let bi=bi0;bi<=bi1;bi++){const t=f.blocks[bj*BD+bi];if(!t)continue;
      const u=(f.us[bi]+f.us[bi+1])/2,v=(f.vs[bj]+f.vs[bj+1])/2;const wx=f.x+u*f.ca-v*f.sa,wy=f.y+u*f.sa+v*f.ca;setFrame(ctx,wx,wy,f.ca,f.sa,x0,y0,s);
      if(mpp>14){const bw=f.us[bi+1]-f.us[bi],bh=f.vs[bj+1]-f.vs[bj];const a=BLA[t]*(0.7+hr(f.id,bi*999+bj,8)*0.6);LCNT++;
        ctx.fillStyle=la(t===1||t===6||t===12?LC.win:LC.sod,M.min(1,a*0.55));ctx.fillRect(-bw/2+5,-bh/2+5,bw-10,bh-10);continue}
      if(mpp>2.5){const bw=f.us[bi+1]-f.us[bi],bh=f.vs[bj+1]-f.vs[bj];ctx.fillStyle=la(t===1||t===6||t===12?LC.win:LC.sod,BLA[t]*0.22*smooth(2.5,14,mpp)*(0.7+hr(f.id,bi*999+bj,8)*0.6));ctx.fillRect(-bw/2+6,-bh/2+6,bw-12,bh-12)}
      const key=(f.id*1e6+bj*1000+bi)*3+(LITE2?2:LITE?1:0);let P=bcGet(key);if(!P){P=genBlock(f,bi,bj,t);bcSet(key,P)}drawLightPrims(ctx,P,mpp,false)}
    return}
  if(f.kind==='zone'){setFrame(ctx,f.x,f.y,f.ca,f.sa,x0,y0,s);
    if(mpp>14){const a=ZLA[f.zk];if(a>0){const R=rng(f.seed^0x1a);const sp=M.max(70,mpp*2.2);for(let y=-f.H/2+sp/2;y<f.H/2;y+=sp)for(let x=-f.W/2+sp/2;x<f.W/2;x+=sp){if(R()<0.35)continue;fdot(ctx,R()<0.12?'wled':'sod',x+(R()-0.5)*sp*0.6,y+(R()-0.5)*sp*0.6,sp*0.9,a*(0.8+R()*1.4))}}
      if(f.zk==='air'){ctx.fillStyle=la(LC.led,0.4);ctx.fillRect(-1650,-30,3300,60);ctx.fillStyle=la(LC.sod,0.12);ctx.fillRect(-1000,-560,1500,350)}return}
    const zf=ZFL[f.zk];if(zf){const [sp,r,c,a]=zf;for(let y=-f.H/2+sp/2;y<f.H/2;y+=sp)for(let x=-f.W/2+sp/2;x<f.W/2;x+=sp){if(hh(x|0,y|0,f.id)%3===0&&f.zk!=='gas')continue;fdot(ctx,c,x,y,r*2,a);fdot(ctx,c,x,y,2,0.9)}}
    drawLightPrims(ctx,f.prims,mpp,f.zk!=='air'&&f.zk!=='dacha')}}
function renderLights(z,tx,ty,hb){
  const PAD=hb?32:0,CS=TS+2*PAD;
  const tsz=WORLD/(1<<z),mpp=tsz/TS,x0=tx*tsz-PAD*mpp,y0=ty*tsz-PAD*mpp,s=1/mpp;pools();LS=s;LMPP=mpp;LCNT=0;
  const cv=mkCanvas(CS,CS),ctx=cv.getContext('2d');ctx.globalCompositeOperation='lighter';
  const ext=tsz+2*PAD*mpp;const mg=mpp<6?300:mpp*45;const qx0=x0-mg,qy0=y0-mg,qx1=x0+ext+mg,qy1=y0+ext+mg;
  const feats=queryF(qx0,qy0,qx1,qy1);const rl=queryRoads(x0-mpp*20-60,y0-mpp*20-60,x0+ext+mpp*20+60,y0+ext+mpp*20+60);
  blockCache=new Map();mppG=mpp;LITE=mpp>2.2;LITE2=mpp>4.5;
  ctx.setTransform(s,0,0,s,-x0*s,-y0*s);lightRoads(ctx,rl,mpp,x0-40,y0-40,x0+ext+40,y0+ext+40);
  for(const f of feats){if(f.kind==='city'||f.kind==='zone')lightFeat(ctx,f,x0,y0,s,mpp,qx0,qy0,qx1,qy1)}
  blockCache=null;if(!LCNT)return null;if(!hb)return cv;
  // bloom variant: successive 2x box downsampling, then smooth upscale
  // padded canvas → light from neighbouring tiles bleeds in, no seams at tile edges
  let src=cv,sz=CS;for(let i=0;i<hb;i++){sz>>=1;const c2=mkCanvas(sz,sz),x2=c2.getContext('2d');x2.imageSmoothingQuality='high';x2.drawImage(src,0,0,sz,sz);src=c2}
  const out=mkCanvas(TS,TS),xo=out.getContext('2d');xo.imageSmoothingQuality='high';const f=sz/CS;xo.drawImage(src,PAD*f,PAD*f,TS*f,TS*f,0,0,TS,TS);return out}

// ---------------------------------------------------------------- tile
let blockCache=new Map();const BCACHE=new Map();
function bcGet(key){const v=BCACHE.get(key);return v}
function bcSet(key,v){if(BCACHE.size>6000){let n=0;for(const k of BCACHE.keys()){BCACHE.delete(k);if(++n>2000)break}}BCACHE.set(key,v)}
function renderTile(z,tx,ty){
  const tsz=WORLD/(1<<z),mpp=tsz/TS,x0=tx*tsz,y0=ty*tsz,s=1/mpp;
  const cv=mkCanvas(TS,TS),ctx=cv.getContext('2d',{willReadFrequently:true});
  const near=queryF(x0-5000,y0-5000,x0+tsz+5000,y0+tsz+5000).filter(o=>o.kind==='city'||o.kind==='zone');
  raster(ctx,x0,y0,mpp,near);
  const mg=mpp<6?260:mpp*45;const qx0=x0-mg,qy0=y0-mg,qx1=x0+tsz+mg,qy1=y0+tsz+mg;
  const feats=queryF(qx0,qy0,qx1,qy1);const rl=queryRoads(x0-mpp*20-40,y0-mpp*20-40,x0+tsz+mpp*20+40,y0+tsz+mpp*20+40);
  blockCache=new Map();TREEQ.length=0;mppG=mpp;LITE=mpp>2.2;LITE2=mpp>4.5;
  const detail=mpp<14;
  const T=()=>ctx.setTransform(s,0,0,s,-x0*s,-y0*s);
  // pass 0 (grounds)
  for(const f of feats)drawFeat(ctx,f,0,x0,y0,s,mpp,qx0,qy0,qx1,qy1);
  TX0=x0;TY0=y0;T();drawRoads(ctx,rl,mpp);T();drawOverpasses(ctx,rl,mpp);if(mpp<0.75)for(const f of feats)drawCross(ctx,f,x0,y0,s,qx0,qy0,qx1,qy1);
  if(detail){
    ctx.fillStyle=SHADOW;
    for(const f of feats){drawFeat(ctx,f,1,x0,y0,s,mpp,qx0,qy0,qx1,qy1)}
    for(const f of feats)drawFeat(ctx,f,2,x0,y0,s,mpp,qx0,qy0,qx1,qy1);
  }
  ctx.setTransform(1,0,0,1,0,0);
  if(TREEQ.length){const S=sprites();for(let i=0;i<TREEQ.length;i+=4){const d=TREEQ[i+2]*1.45;if(d<1.6)continue;ctx.drawImage(S.treeS[SEASON][TREEQ[i+3]],TREEQ[i]-d*0.44,TREEQ[i+1]-d*0.44,d,d)}}
  if(mpp<7){T();drawPower(ctx,rl,mpp);ctx.setTransform(1,0,0,1,0,0)}
  blockCache=null;
  grain(ctx,x0,y0,mpp,feats.length>0||rl.length>0);
  return cv;
}
function drawCross(ctx,f,x0,y0,s,qx0,qy0,qx1,qy1){if(f.kind!=='city'||f.type===0)return;const N=f.N,D=f.D;
  let i0=1e9,i1=-1e9,j0=1e9,j1=-1e9;for(const [x,y] of [[qx0,qy0],[qx1,qy0],[qx1,qy1],[qx0,qy1]]){const dx=x-f.x,dy=y-f.y;const u=(dx*f.ca+dy*f.sa),v=(-dx*f.sa+dy*f.ca);i0=M.min(i0,u);i1=M.max(i1,u);j0=M.min(j0,v);j1=M.max(j1,v)}
  const a0=M.max(0,bsr(f.us,i0)),a1=M.min(D-1,bsr(f.us,i1)+1),b0=M.max(0,bsr(f.vs,j0)),b1=M.min(D-1,bsr(f.vs,j1)+1);if(a1<a0||b1<b0)return;
  setFrame(ctx,f.x,f.y,f.ca,f.sa,x0,y0,s);ctx.fillStyle='rgba(236,236,230,0.85)';ctx.beginPath();
  for(let j=b0;j<=b1;j++)for(let i=a0;i<=a1;i++){const up=f.eU[j*D+i],um=i>0&&f.eU[j*D+i-1],vp=f.eV[j*D+i],vm=j>0&&f.eV[(j-1)*D+i];if(up+um+vp+vm<3)continue;
    const cx=f.us[i],cy=f.vs[j];const hvI=RW[lineKind(i-N)]/2,hvJ=RW[lineKind(j-N)]/2;
    const zeb=(dirx,diry,dist,half)=>{for(let o=-half+0.5;o<half-0.4;o+=1.05){if(dirx){const x=cx+dirx*dist;ctx.rect(dirx>0?x:x-3,cy+o,3,0.55)}else{const y=cy+diry*dist;ctx.rect(cx+o,diry>0?y:y-3,0.55,3)}}};
    if(up)zeb(1,0,hvI+1.6,hvJ-0.4);if(um)zeb(-1,0,hvI+1.6,hvJ-0.4);if(vp)zeb(0,1,hvJ+1.6,hvI-0.4);if(vm)zeb(0,-1,hvJ+1.6,hvI-0.4);
    if(up)ctx.rect(cx+hvI+5.4,cy,0.35,hvJ-0.6);if(um)ctx.rect(cx-hvI-5.75,cy-hvJ+0.6,0.35,hvJ-0.6);if(vp)ctx.rect(cx-hvI+0.6,cy+hvJ+5.4,hvI-0.6,0.35);if(vm)ctx.rect(cx,cy-hvJ-5.75,hvI-0.6,0.35)}
  ctx.fill()}
function grain(ctx,x0,y0,mpp,vec){if(!vec)return;
  const img=ctx.getImageData(0,0,TS,TS),d=img.data;const i1=1/(2.2*mpp),i2=1/(7*mpp);let o=0;const fine=mpp<3;
  for(let py=0;py<TS;py++){const wy=y0+(py+0.5)*mpp;for(let px=0;px<TS;px++,o+=4){if(d[o+3]<250)continue;const wx=x0+(px+0.5)*mpp;
    let g=noise(wx*i1+3.1,wy*i1+1.7)*0.05+noise(wx*i2+9.3,wy*i2+4.1)*0.04;if(fine){const h=mix32((px*73856093)^(py*19349663)^(x0*7|0));g+=((h&255)/255-0.5)*0.05}
    const m=1+g;d[o]*=m;d[o+1]*=m;d[o+2]*=m}}
  ctx.putImageData(img,0,0)}
function drawFeat(ctx,f,pass,x0,y0,s,mpp,qx0,qy0,qx1,qy1){
  if(f.kind==='city'){if(f.type===0){if(mpp>9)return;for(let i=0;i<f.vst.length;i++){const st=f.vst[i];setFrame(ctx,st.x0,st.y0,st.ca,st.sa,x0,y0,s);const vk='v'+f.id+'_'+i+(LITE2?'b':LITE?'a':'');let P=bcGet(vk);if(!P){P=genVillage(f,i);bcSet(vk,P)}
        if(pass===1){ctx.beginPath();drawPrims(ctx,P,1,mpp);ctx.fillStyle=SHADOW;ctx.fill()}else drawPrims(ctx,P,pass,mpp)}return}
    const N=f.N,BD=f.D-1;let i0=1e9,i1=-1e9,j0=1e9,j1=-1e9;
    for(const [x,y] of [[qx0,qy0],[qx1,qy0],[qx1,qy1],[qx0,qy1]]){const dx=x-f.x,dy=y-f.y;const u=(dx*f.ca+dy*f.sa),v=(-dx*f.sa+dy*f.ca);i0=M.min(i0,u);i1=M.max(i1,u);j0=M.min(j0,v);j1=M.max(j1,v)}
    const bi0=M.max(0,bsr(f.us,i0)),bi1=M.min(BD-1,bsr(f.us,i1)),bj0=M.max(0,bsr(f.vs,j0)),bj1=M.min(BD-1,bsr(f.vs,j1));
    const LB=[];for(let bj=bj0;bj<=bj1;bj++)for(let bi=bi0;bi<=bi1;bi++){const t=f.blocks[bj*BD+bi];if(!t)continue;
      const u=(f.us[bi]+f.us[bi+1])/2,v=(f.vs[bj]+f.vs[bj+1])/2;LB.push(bi,bj,t,f.y+u*f.sa+v*f.ca)}
    const ord=[];for(let q=0;q<LB.length;q+=4)ord.push(q);if(pass===2)ord.sort((a,b)=>LB[a+3]-LB[b+3]);
    for(const q of ord){const bi=LB[q],bj=LB[q+1],t=LB[q+2];
      const u=(f.us[bi]+f.us[bi+1])/2,v=(f.vs[bj]+f.vs[bj+1])/2;const wx=f.x+u*f.ca-v*f.sa,wy=f.y+u*f.sa+v*f.ca;setFrame(ctx,wx,wy,f.ca,f.sa,x0,y0,s);
      if(mpp>14){if(pass===0){const c=seasonC(MASS[t],0);const v2=0.93+hr(f.id,bi*999+bj,4)*0.14;ctx.fillStyle=cs(c,v2);const bw=f.us[bi+1]-f.us[bi],bh=f.vs[bj+1]-f.vs[bj];ctx.fillRect(-bw/2+5,-bh/2+5,bw-10,bh-10)}continue}
      const key=(f.id*1e6+bj*1000+bi)*3+(LITE2?2:LITE?1:0);let P=bcGet(key);if(!P){P=genBlock(f,bi,bj,t);bcSet(key,P)}
      if(pass===1){ctx.beginPath();drawPrims(ctx,P,1,mpp);ctx.fillStyle=SHADOW;ctx.fill()}else drawPrims(ctx,P,pass,mpp)}
    return}
  if(f.kind==='zone'){setFrame(ctx,f.x,f.y,f.ca,f.sa,x0,y0,s);if(pass===1){ctx.beginPath();drawPrims(ctx,f.prims,1,mpp);ctx.fillStyle=SHADOW;ctx.fill();return}drawPrims(ctx,f.prims,pass,mpp);return}
  if(f.kind==='farm'){if(pass===0)return;ctx.setTransform(s,0,0,s,-x0*s,-y0*s);if(pass===1)ctx.beginPath();
    for(const t of f.t){if(pass===1){ctx.moveTo(t.x,t.y);ctx.lineTo(t.x+SUNX*95-2,t.y+SUNY*95-2);ctx.lineTo(t.x+SUNX*95+2,t.y+SUNY*95+2);ctx.closePath()}
      else{ctx.fillStyle='#c8c8c4';ctx.beginPath();ctx.arc(t.x,t.y,M.max(2.5,mpp*0.8),0,TAU);ctx.fill();ctx.fillStyle='#9a9a90';ctx.fillRect(t.x-6,t.y-6,12,12)}}if(pass===1){ctx.fillStyle=SHADOW;ctx.fill()}}
}
// zone cylinder shadows need stroke not fill: patch drawPrims pass1 for cyl via stroke
const _dp=drawPrims;

return {setSeason,season:()=>SEASON,renderLights,WORLD,TS,SUNX,SUNY,WDX,WDY,LEANX,LEANY,cities:live,roads,zones,farms,ships,flights,emitters,airports,queryRoads,queryF,posAt,renderTile,sprites,drawShip,drawPlane,baseH,landE,rng,hh,noise,genTime:Date.now()-T0,mkCanvas};
}


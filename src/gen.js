function WorldGen(SEED,OPT){
'use strict';
const M=Math,PI=M.PI,TAU=PI*2,WORLD=131072,TS=256;
// stage 5 (game): world options. No options = the classic world of stages 1-4 (bit-for-bit, the tests rely on it)
OPT=OPT||{};
const MAPT=OPT.map||'normal',LSZ=OPT.size==null?1:clamp(OPT.size|0,0,2),RIVK=[0,0.55,1,1.6][OPT.rivers==null?2:clamp(OPT.rivers|0,0,3)],LAKK=clamp(OPT.lakes|0,0,3);
const CAPS=OPT.caps||[];const MNT=OPT.mountains==null?1:clamp(+OPT.mountains,0,1),EMPTY=!!OPT.empty;const RWMAX=0.0137*M.max(1,RIVK);
const FLAG=typeof FlagArt==='function'?FlagArt():null;
let DYNR=false,DYNW=false,ZOPT=null,HID=new Set(); // stage 5.7: game-time roads avoid zones, zone options, hidden zones (fog of war)
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
  if(MAPT==='normal')e+=(LSZ===1?0.22:SZO[LSZ])-M.max(0,d-SZR[LSZ])*2.6;else e=mapShape(x,y,e,d,qx,qy);
  // game worlds (MNT < 1): gentler hills and fewer, narrower mountain ranges — more room for plains
  if(MNT<1&&e>0.05)e=0.05+(e-0.05)*(0.42+0.58*MNT);
  const mm=MNT<1?smooth(0.2+0.14*(1-MNT),0.5+0.1*(1-MNT),e)*smooth(0.3*(1-MNT),0.4+0.3*(1-MNT),noise(x/42000+91.3,y/42000+12.1))*(0.55+0.45*MNT):smooth(0.2,0.5,e)*smooth(0.0,0.4,noise(x/42000+91.3,y/42000+12.1));
  if(mm>0){let fx=x/9000+40.5,fy=y/9000-20.2,amp=0.5,sum=0,prev=1;const no=M.min(oct+1,10);
    for(let o=0;o<no;o++){let r=1-M.abs(noise(fx,fy));r=r*M.sqrt(r);sum+=r*amp*prev;prev=clamp(r*1.5,0,1);const nx=1.62*fx+1.18*fy+3.7;fy=-1.18*fx+1.62*fy+1.9;fx=nx;amp*=0.48}
    e+=mm*sum*0.55}
  if(LAKK&&e>0.004&&e<0.5){const lk=noise(x/8200+311.1,y/8200-71.7)*0.78+noise(x/2700+41.3,y/2700+7.9)*0.22,th=LAKT[LAKK];
    if(lk>th){const t=smooth(th,th+0.09,lk)*smooth(0.5,0.16,e);e=lerp(e,-0.035,t)}}
  return e;
}
// land size (small / medium / large): sea level offset and the radius where the world edge starts to sink
const SZO=[0.14,0.22,0.28],SZR=[0.56,0.7,0.82],LAKT=[9,0.52,0.42,0.33];
// island centres for the 'islands' map: 5-9 separate lands
const ISL=[];{const R=rng(SS^0x15a1);const n=5+(R()*5|0);for(let t=0;ISL.length<n&&t<400;t++){const x=WORLD*(0.16+0.68*R()),y=WORLD*(0.16+0.68*R()),r=WORLD*(0.07+0.07*R())*[0.75,1,1.22][LSZ];
  if(ISL.every(o=>M.hypot(o[0]-x,o[1]-y)>(o[2]+r)*0.95))ISL.push([x,y,r])}}
// non-classic map shapes, applied to the fbm height e (before the mountains): d — distance from the centre (1 = world edge)
function mapShape(x,y,e,d,qx,qy){const so=SZO[LSZ],sr=SZR[LSZ];
  if(MAPT==='cont'){ // continents: two to four big lands split by straits along the zero lines of a large noise
    e+=so+0.02-M.max(0,d-sr-0.04)*2.6;const cn=noise(x/50000+17.7+qx*0.25,y/50000-33.1+qy*0.25)+0.3*noise(x/16000+5.1,y/16000+9.3);
    return e-0.46*smooth(0.17,0.02,M.abs(cn))}
  if(MAPT==='arch'){ // archipelago: many islands of all sizes over the whole map
    const isl=noise(x/10500+51.3,y/10500-12.9)*0.65+noise(x/4200+8.1,y/4200+77.3)*0.35;
    return e*0.5+isl*0.42+so-0.25-M.max(0,d-sr-0.1)*2.6}
  if(MAPT==='islands'){ // a few large separate islands
    let b=-1;for(const [cx,cy,r] of ISL){const q=1-M.hypot(x-cx+qx*r*0.35,y-cy+qy*r*0.35)/r;if(q>b)b=q}
    return e*0.42+b*0.5+so-0.24}
  return e}
function riverV(x,y){
  let px=x/16000,py=y/16000;
  const wx=noise(px*1.9+70.1,py*1.9+3.3),wy=noise(px*1.9+13.7,py*1.9+80.9);
  px+=wx*0.5;py+=wy*0.5;
  return noise(px+200.3,py+50.7)+0.22*noise(px*3.1+7.7,py*3.1+3.3);
}
function riverW(x,y,e){
  if(e<-0.03||!RIVK)return 0;
  const big=smooth(-0.45,0.45,noise(x/55000+33.3,y/55000+44.4));
  return (0.0032+0.0105*big)*smooth(0.55,0.3,e)*RIVK;
}
function moist(x,y){return noise(x/22000+5.5,y/22000-8.8)*0.7+noise(x/6000+1.1,y/6000+2.2)*0.3}
function landE(x,y,mg){const e=baseH(x,y,7);if(e<0.004)return -1;const w=riverW(x,y,e);if(w>0){if(M.abs(riverV(x,y))<w+mg)return -1}return e}
// map preview in the setup screen: terrain only, no settlements (a few ms instead of seconds)
if(OPT.terrainOnly)return {baseH,landE,riverV,riverW,moist,noise,WORLD};

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
  r._b=1;
  if(r.n===2){const mx=(r.pts[0]+r.pts[2])/2,my=(r.pts[1]+r.pts[3])/2;if(M.abs(riverV(mx,my))>RWMAX+r.L*1.6e-4){let dry=true;const nq=M.max(8,M.ceil(r.L/20));for(let q=0;q<=nq;q++){const t=q/nq;if(baseH(r.pts[0]+(r.pts[2]-r.pts[0])*t,r.pts[1]+(r.pts[3]-r.pts[1])*t,7)<0.004){dry=false;break}}if(dry){r.br=null;return}}}
  const out=[];let inW=false,s0=0;const step=10;
  for(let s=0;s<=r.L+step-0.01;s+=step){if(s>r.L)s=r.L;const p=posAt(r,s);const w=landE(p[0],p[1],0)<0;
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
  if(!EMPTY)for(let cy=0;cy<NC;cy++)for(let cx=0;cx<NC;cx++){const R=rng(hh(cx,cy,11));if(R()<0.12)continue;
    const x=(cx+0.15+0.7*R())*CELL,y=(cy+0.15+0.7*R())*CELL;const e=landE(x,y,0.006);if(e<0.022||e>0.34)continue;
    const t=R();let type,Rr;
    if(t<0.022){type=3;Rr=2500+R()*1200}else if(t<0.08){type=2;Rr=1150+R()*700}else if(t<0.24){type=1;Rr=520+R()*380}else{type=0;Rr=170+R()*190}
    cand.push({x,y,R:Rr,type,seed:hh(cx,cy,12)})}
  cand.sort((a,b)=>b.type-a.type||b.R-a.R);
  // capitals of the states (game): placed first, exactly where they were founded; towns in their way give room
  const capC=CAPS.map((q,i)=>({x:q.x,y:q.y,R:q.R||2900,type:3,seed:hh(q.x|0,q.y|0,1201+i),cap:q.st,st:q.st,capName:q.name,fl:q.fl}));if(capC.length)cand.unshift(...capC);
  for(const c of cand){let ok=true;for(const k of cities){const d=M.hypot(c.x-k.x,c.y-k.y);if(d<(c.R+k.R)*1.12+(c.type+k.type>1?900:250)){ok=false;break}}if(ok)cities.push(c)}
  cities.forEach((c,i)=>{c.id=i;const R=rng(c.seed^0x777);c.name=mkName(R,c.type);if(c.capName)c.name=c.capName;c.bb=[c.x-c.R*1.4,c.y-c.R*1.4,c.x+c.R*1.4,c.y+c.R*1.4];c.kind='city'});
}
function buildCity(c){
  const R=rng(c.seed^0x55);c.ang=R()*PI;c.ca=M.cos(c.ang);c.sa=M.sin(c.ang);
  if(c.type===3){c.bu=140+R()*40;c.bv=110+R()*30}else if(c.type===2){c.bu=118+R()*30;c.bv=95+R()*25}else{c.bu=92+R()*25;c.bv=78+R()*20}
  if(EMPTY&&c.type>=2)cityLayout(c);
  if(c.pol){buildPolar(c);return}
  const N=c.N=M.ceil(c.R*1.3/M.min(c.bu,c.bv)),D=c.D=2*N+1;const ok=new Uint8Array(D*D);const j0=c.jit?0.6:0.7,jw=c.jit?0.85:0.6;if(c.lay)lineKinds(c);
  const us=c.us=new Float64Array(D),vs=c.vs=new Float64Array(D);for(let k=1;k<=N;k++){us[N+k]=us[N+k-1]+c.bu*(j0+jw*R());us[N-k]=us[N-k+1]-c.bu*(j0+jw*R());vs[N+k]=vs[N+k-1]+c.bv*(j0+jw*R());vs[N-k]=vs[N-k+1]-c.bv*(j0+jw*R())}
  for(let j=0;j<D;j++)for(let i=0;i<D;i++){const u=us[i],v=vs[j];let x,y;if(c.cv)[x,y]=cW(c,u,v);else{x=c.x+u*c.ca-v*c.sa;y=c.y+u*c.sa+v*c.ca}
    if(cityF(c,x,y)<1){const e=landE(x,y,0.0025);if(e>=0&&e<0.42)ok[j*D+i]=1}}
  const BD=D-1;const bl=c.blocks=new Uint8Array(BD*BD);let stad=false,cnt=0;
  for(let j=0;j<BD;j++)for(let i=0;i<BD;i++){if(!(ok[j*D+i]&&ok[j*D+i+1]&&ok[(j+1)*D+i]&&ok[(j+1)*D+i+1]))continue;
    if(c.cv){const f=blkFrame(c,i,j);if(wetArea(f[0],f[1],f[2],f[3],-f[4],-f[5],f[4],f[5],c.lay?18:28,0.0015,!!c.lay))continue}
    else if(wetArea(c.x,c.y,c.ca,c.sa,us[i],vs[j],us[i+1],vs[j+1],28,0.0015))continue; // a river between the corners: no block over it
    const u=(us[i]+us[i+1])/2,v=(vs[j]+vs[j+1])/2;let x,y;if(c.cv)[x,y]=cW(c,u,v);else{x=c.x+u*c.ca-v*c.sa;y=c.y+u*c.sa+v*c.ca}
    const Rb=rng(hh(c.id,i*977+j,51));let t=pickType(c,cityF(c,x,y),Rb);if(t===9){if(stad)t=5;else stad=true}
    if(c.lay){const f=blkFrame(c,i,j);if(M.min(f[4],f[5])<34)t=Rb()<0.6?5:23} // a narrow block of a bent grid: a garden or a small square
    bl[j*BD+i]=t;cnt++}
  c.nblocks=cnt;
  if(c.diag)addDiag(c);
  if(c.cap!==undefined){let bd=1e18,bk=-1;for(let j=0;j<BD;j++)for(let i=0;i<BD;i++){if(!bl[j*BD+i]||(c.diag&&bl[j*BD+i]===20))continue;const d=((us[i]+us[i+1])/2)**2+((vs[j]+vs[j+1])/2)**2;if(d<bd){bd=d;bk=j*BD+i}}if(bk>=0)bl[bk]=21}
  if(c.mrg)mergeBlocks(c);
  if(c.kU){gridStreets(c,ok);if(c.dgl)for(const p of c.dgl){const r=mkRoad(7,p,{city:c.id,dg:1});if(r)bridgesOf(r)}return}
  const blk=(i,j)=>i>=0&&j>=0&&i<BD&&j<BD&&bl[j*BD+i]>0;
  // streets along U (fixed j)
  const eU=c.eU=new Uint8Array(D*D),eV=c.eV=new Uint8Array(D*D);
  // an edge with blocks on both sides is dry (blocks are checked for water), only open edges may cross a river
  for(let j=0;j<D;j++){let s=-1,le=-1,op=0;for(let i=0;i<=D;i++){const e=i<D-1&&ok[j*D+i]&&ok[j*D+i+1]&&(blk(i,j-1)||blk(i,j));if(e){eU[j*D+i]=1;if(!(blk(i,j-1)&&blk(i,j)))op=1}
      if(e&&s<0){s=i;if(le>=0)bridgeGap(c,lineKind(j-N),le-N,j-N,i-N,j-N)}if(!e&&s>=0){addStreet(c,s-N,j-N,i-N,j-N,lineKind(j-N),op);le=i;s=-1;op=0}}}
  for(let i=0;i<D;i++){let s=-1,le=-1,op=0;for(let j=0;j<=D;j++){const e=j<D-1&&ok[j*D+i]&&ok[(j+1)*D+i]&&(blk(i-1,j)||blk(i,j));if(e){eV[j*D+i]=1;if(!(blk(i-1,j)&&blk(i,j)))op=1}
      if(e&&s<0){s=j;if(le>=0)bridgeGap(c,lineKind(i-N),i-N,le-N,i-N,j-N)}if(!e&&s>=0){addStreet(c,i-N,s-N,i-N,j-N,lineKind(i-N),op);le=j;s=-1;op=0}}}
}
// an avenue or boulevard line broken by a short stretch of water gets a bridge over it
function bridgeGap(c,k,a0,a1,b0,b1){if(k!==2&&k!==7)return;const A=cpt(c,a0,a1),B=cpt(c,b0,b1);const L=M.hypot(B[0]-A[0],B[1]-A[1]);if(L>520||L<20)return;let w=0;for(let q=1;q<6;q++){if(landE(A[0]+(B[0]-A[0])*q/6,A[1]+(B[1]-A[1])*q/6,0)<0)w++}if(w<2)return;const r=mkRoad(k,c.cv?gridLine(c,a0,a1,b0,b1):[A[0],A[1],B[0],B[1]],{city:c.id});if(r)bridgesOf(r)}
// any water inside the rectangle [u0,u1]x[v0,v1] of a rotated frame (origin ox,oy), sampled every ~st metres
function wetArea(ox,oy,ca,sa,u0,v0,u1,v1,st,mg,exact){const nu=M.max(1,M.ceil((u1-u0)/st)),nv=M.max(1,M.ceil((v1-v0)/st));
  // fast path: far from any river channel (riverV changes by < 3e-4 per metre) only the sea can be inside
  const um=(u0+u1)/2,vm=(v0+v1)/2,cx=ox+um*ca-vm*sa,cy=oy+um*sa+vm*ca;if(!exact&&M.abs(riverV(cx,cy))>RWMAX+mg+M.hypot(u1-u0,v1-v0)*1.6e-4){
    for(let a=0;a<=2;a++)for(let b=0;b<=2;b++){const u=u0+(u1-u0)*a/2,v=v0+(v1-v0)*b/2;if(baseH(ox+u*ca-v*sa,oy+u*sa+v*ca,7)<0.004)return true}return false}
  for(let a=0;a<=nu;a++)for(let b=0;b<=nv;b++){const u=u0+(u1-u0)*a/nu,v=v0+(v1-v0)*b/nv;if(landE(ox+u*ca-v*sa,oy+u*sa+v*ca,mg)<0)return true}return false}
function bsr(a,v){let lo=0,hi=a.length-1;if(v<=a[0])return -1;if(v>=a[hi])return hi;while(hi-lo>1){const m=(lo+hi)>>1;if(a[m]>v)hi=m;else lo=m}return lo}
function cpt(c,i,j){const u=c.us[i+c.N],v=c.vs[j+c.N];if(c.cv)return cW(c,u,v);return [c.x+u*c.ca-v*c.sa,c.y+u*c.sa+v*c.ca]}
// ---------------------------------------------------------------- town layouts of the game (stages 5.7, 5.11)
// Families (c.lay): 'grid' — a straight grid with superblocks and, often, diagonal boulevards; 'bent' — the grid frame
// z = u + iv mapped by the conformal w = F(z) = z + a z^2/L + b z^3/L^2 (streets curve but meet at right angles, every
// block is a rectangle in a frame rotated by arg F' and scaled by |F'|); 'organic' — a strongly bent grid with uneven
// spacing, many merged blocks and open squares; 'radial' — rings and rays around a round central square (u = distance
// from the centre, v = angle · c.prr); 'fan' — rays and arcs fanning out from a square at one side of the town.
// Superblocks: a block may span several grid cells (c.sp: (si-1) | (sj-1)<<4 at its first cell, c.ms: the first cell
// for the others); the streets between its cells are left out, so the grid gets T-junctions and big courtyards.
// Avenues and boulevards stand on their own lines in each town (c.kU / c.kV: road kind of every grid line).
// Classic towns have none of this (plain grid, lineKind()).
const FAMS=['radial','grid','fan','bent','organic'];
function cityLayout(c){const Q=rng(c.seed^0x4c41a7);
  // capitals of one game all differ (the family rotates with the state), other towns draw theirs
  const fam=c.lay=c.cap!==undefined?FAMS[(hh(c.seed|0,7,91)%5+c.cap)%5]:FAMS[Q()*5|0];
  if(fam==='radial'){c.pol={full:1,off:0,th:TAU,rin:120+Q()*60};c.cv=1;return}
  if(fam==='fan'){c.pol={full:0,off:c.R*(0.42+Q()*0.2),th:PI*(1.1+Q()*0.3),rin:95+Q()*45};c.cv=1;return}
  // block proportions: square-ish, long slabs along one axis or the other
  const asp=Q()<0.3?1:0.62+Q()*0.8;c.bu*=M.sqrt(asp);c.bv/=M.sqrt(asp);c.mrg=fam==='organic'?0.3:0.16;c.opn=fam==='organic'?0.07:0.035;
  if(fam==='grid'){c.diag=Q()<0.75?1+(Q()<0.55?1:0):0;return}
  const s=fam==='organic'?1.25:1,a=(0.12+Q()*0.1)*s,aa=Q()*TAU,b=(0.015+Q()*0.035)*s,ba=Q()*TAU;
  if(fam==='organic')c.jit=1;
  c.wp=[a*M.cos(aa),a*M.sin(aa),b*M.cos(ba),b*M.sin(ba)];c.wL=c.R*1.3;c.cv=1}
// avenues and boulevards of a game town: the central lines and then a major line every 3..6 lines (organic: 2..6)
function lineKinds(c){const R=rng(c.seed^0x1b2c3),D=c.D,N=c.N,g0=c.lay==='organic'?2:3;
  const mk=()=>{const a=new Uint8Array(D).fill(3);a[N]=R()<0.55?7:2;for(const dir of [1,-1]){let since=0,gap=g0+(R()*4|0);for(let q=1;q<=N;q++){if(++since>=gap){a[N+dir*q]=R()<0.3?7:2;since=0;gap=g0+(R()*4|0)}}}return a};
  c.kU=mk();c.kV=mk()}
function lkU(c,i){return c.kU?c.kU[i]:lineKind(i-c.N)}
function lkV(c,j){return c.kV?c.kV[j]:lineKind(j-c.N)}
function lineKind(n){n=((n%8)+8)%8;return n===0?7:n===4?2:3}
function lineHalf(n){const k=lineKind(n);return k===7?14.5:k===2?10:5}
const KH=k=>k===7?14.5:k===2?10:5;
function wpF(c,u,v){const L=c.wL,w=c.wp,x=u/L,y=v/L,x2=x*x-y*y,y2=2*x*y,x3=x2*x-y2*y,y3=x2*y+y2*x;return [u+L*(w[0]*x2-w[1]*y2+w[2]*x3-w[3]*y3),v+L*(w[0]*y2+w[1]*x2+w[2]*y3+w[3]*x3)]}
function wpD(c,u,v){const L=c.wL,w=c.wp,x=u/L,y=v/L,x2=x*x-y*y,y2=2*x*y;return [1+2*(w[0]*x-w[1]*y)+3*(w[2]*x2-w[3]*y2),2*(w[0]*y+w[1]*x)+3*(w[2]*y2+w[3]*x2)]}
// polar towns: (u, v) = (distance from the origin c.px,c.py; angle from c.ang times c.prr)
function plW(c,u,v){const a=c.ang+v/c.prr;return [c.px+u*M.cos(a),c.py+u*M.sin(a)]}
function plU(c,x,y){const dx=x-c.px,dy=y-c.py;let a=M.atan2(dy,dx)-c.ang;const a0=c.pol.full?c.vs[0]/c.prr:-PI;a-=M.floor((a-a0)/TAU)*TAU;return [M.hypot(dx,dy),a*c.prr]}
// town grid (u, v) → world, world → town grid (Newton on F)
function cW(c,u,v){if(c.pol)return plW(c,u,v);if(c.wp){const q=wpF(c,u,v);u=q[0];v=q[1]}return [c.x+u*c.ca-v*c.sa,c.y+u*c.sa+v*c.ca]}
function cU(c,x,y){if(c.pol)return plU(c,x,y);const dx=x-c.x,dy=y-c.y,wu=dx*c.ca+dy*c.sa,wv=-dx*c.sa+dy*c.ca;if(!c.wp)return [wu,wv];let u=wu,v=wv;
  for(let it=0;it<8;it++){const f=wpF(c,u,v),fr=f[0]-wu,fi=f[1]-wv;if(fr*fr+fi*fi<1e-6)break;const d=wpD(c,u,v),dd=d[0]*d[0]+d[1]*d[1];u-=(fr*d[0]+fi*d[1])/dd;v-=(fi*d[0]-fr*d[1])/dd}return [u,v]}
// grid cells covered by block (bi, bj): [si, sj]
function blkSpan(c,bi,bj){if(!c.sp)return SP11;const q=c.sp[bj*(c.D-1)+bi];return q?[(q&15)+1,(q>>4)+1]:SP11}
const SP11=[1,1];
// frame of block (bi, bj): [centre x, centre y, axis cos, axis sin, half width, half height] in world metres
function blkFrame(c,bi,bj){const sp=blkSpan(c,bi,bj),u0=c.us[bi],u1=c.us[bi+sp[0]],v0=c.vs[bj],v1=c.vs[bj+sp[1]];
  if(c.pol){ // an annular sector: the largest rectangle (on the middle ray) that keeps clear of both rays and the outer arc
    const h=(v1-v0)/2/c.prr,a=c.ang+(v0+v1)/2/c.prr,hv=u0*M.tan(h),r1=M.sqrt(M.max(u0*u0,u1*u1-hv*hv)),rc=(u0+r1)/2,ca=M.cos(a),sa=M.sin(a);
    return [c.px+rc*ca,c.py+rc*sa,ca,sa,(r1-u0)/2,hv]}
  const u=(u0+u1)/2,v=(v0+v1)/2,hu=(u1-u0)/2,hv=(v1-v0)/2;
  if(!c.wp)return [c.x+u*c.ca-v*c.sa,c.y+u*c.sa+v*c.ca,c.ca,c.sa,hu,hv];const p=cW(c,u,v),d=wpD(c,u,v),k=M.hypot(d[0],d[1]),a=c.ang+M.atan2(d[1],d[0]);
  return [p[0],p[1],M.cos(a),M.sin(a),hu*k,hv*k]}
// frame of street node (i, j) (grid indices 0..D-1)
function nodeFrame(c,i,j){const u=c.us[i],v=c.vs[j],p=cW(c,u,v);if(c.pol){const a=c.ang+v/c.prr;return [p[0],p[1],M.cos(a),M.sin(a),1]}if(!c.wp)return [p[0],p[1],c.ca,c.sa,1];const d=wpD(c,u,v),a=c.ang+M.atan2(d[1],d[0]);return [p[0],p[1],M.cos(a),M.sin(a),M.hypot(d[0],d[1])]}
// a street along a grid line from node (i0,j0) to (i1,j1) (one index fixed): a polyline that follows the bent grid
function gridLine(c,i0,j0,i1,j1){if(!c.cv){const a=cpt(c,i0,j0),b=cpt(c,i1,j1);return [a[0],a[1],b[0],b[1]]}
  const P=[],fixU=i0===i1,a=fixU?j0:i0,b=fixU?j1:i1,N=c.N;
  for(let q=a;q<b;q++){const t0=fixU?c.vs[q+N]:c.us[q+N],t1=fixU?c.vs[q+1+N]:c.us[q+1+N],n=c.pol?(fixU?M.max(1,M.ceil((t1-t0)/c.prr*c.us[i0+N]/30)):1):M.max(1,M.ceil((t1-t0)/30));
    for(let s=0;s<n;s++){const t=t0+(t1-t0)*s/n,p=fixU?cW(c,c.us[i0+N],t):cW(c,t,c.vs[j0+N]);P.push(p[0],p[1])}}
  const e=cpt(c,i1,j1);P.push(e[0],e[1]);return P}
// blocks of town f that may touch the world box [x0,y0]-[x1,y1]: [bi0, bi1, bj0, bj1]
function blkRange(f,x0,y0,x1,y1,D){let i0=1e9,i1=-1e9,j0=1e9,j1=-1e9;
  if(!f.cv){for(const [x,y] of [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]){const dx=x-f.x,dy=y-f.y;const u=(dx*f.ca+dy*f.sa),v=(-dx*f.sa+dy*f.ca);i0=M.min(i0,u);i1=M.max(i1,u);j0=M.min(j0,v);j1=M.max(j1,v)}
    return [i0,i1,j0,j1]}
  for(let a=0;a<=2;a++)for(let b=0;b<=2;b++){const q=cU(f,x0+(x1-x0)*a/2,y0+(y1-y0)*b/2);i0=M.min(i0,q[0]);i1=M.max(i1,q[0]);j0=M.min(j0,q[1]);j1=M.max(j1,q[1])}
  const m=M.max(x1-x0,y1-y0)*0.2+(f.bu+f.bv);
  if(f.pol){const inB=f.px>=x0&&f.px<=x1&&f.py>=y0&&f.py<=y1,nx=clamp(f.px,x0,x1),ny=clamp(f.py,y0,y1);i0=M.min(i0,M.hypot(nx-f.px,ny-f.py));
    if(inB||j1-j0>PI*f.prr)return [i0-m,i1+m,f.vs[0]-1,f.vs[f.D-1]+1];const ma=m/M.max(i0,60)*f.prr;return [i0-m,i1+m,j0-ma,j1+ma]}
  return [i0-m,i1+m,j0-m,j1+m]}
function addStreet(c,i0,j0,i1,j1,k,open){const a=cpt(c,i0,j0),b=cpt(c,i1,j1);const r=mkRoad(k,c.cv?gridLine(c,i0,j0,i1,j1):[a[0],a[1],b[0],b[1]],{city:c.id});if(r){if(open)bridgesOf(r);else r._b=1}if(r&&k===2&&c.type>=2&&hr(c.id,i0===i1?i0*7+1:j0*7+2,88)<0.5)r.tram=1}
// block (or merged block) that covers grid cell (i, j): its first cell index, -1 when there is none
function grpAt(c,i,j){const BD=c.D-1;if(c.pol&&c.pol.full){if(j<0)j+=c.nr;else if(j>=c.nr)j-=c.nr}if(i<0||j<0||i>=BD||j>=BD)return -1;const k=j*BD+i;return c.blocks[k]>0?k:c.ms&&c.ms[k]>=0?c.ms[k]:-1}
// streets of a game town: a grid edge is a street where it separates two different blocks (or a block from open land);
// inside a superblock there is none. The seam ray of a full radial town is laid once.
function gridStreets(c,ok){const D=c.D,N=c.N,full=c.pol&&c.pol.full,NR=c.nr;const eU=c.eU=new Uint8Array(D*D),eV=c.eV=new Uint8Array(D*D);
  for(let j=0;j<D;j++){if(full&&j>=NR)continue;let s=-1,le=-1,op=0;for(let i=0;i<=D;i++){let e=false;if(i<D-1&&ok[j*D+i]&&ok[j*D+i+1]){const a=grpAt(c,i,j-1),b=grpAt(c,i,j);e=(a>=0||b>=0)&&a!==b;if(e){eU[j*D+i]=1;if(a<0||b<0)op=1}}
      if(e&&s<0){s=i;if(le>=0)bridgeGap(c,lkV(c,j),le-N,j-N,i-N,j-N)}if(!e&&s>=0){addStreet(c,s-N,j-N,i-N,j-N,lkV(c,j),op);le=i;s=-1;op=0}}}
  for(let i=0;i<D;i++){let s=-1,le=-1,op=0;for(let j=0;j<=D;j++){let e=false;if(j<D-1&&ok[j*D+i]&&ok[(j+1)*D+i]){const a=grpAt(c,i-1,j),b=grpAt(c,i,j);e=(a>=0||b>=0)&&a!==b;if(e){eV[j*D+i]=1;if(a<0||b<0)op=1}}
      if(e&&s<0){s=j;if(le>=0)bridgeGap(c,lkU(c,i),i-N,le-N,i-N,j-N)}if(!e&&s>=0){addStreet(c,i-N,s-N,i-N,j-N,lkU(c,i),op);le=j;s=-1;op=0}}}}
// block types for superblocks: microdistricts, parks, squares, sport grounds, hospitals, offices in the centre
function bigType(c,dn,R){const r=R(),core=c.type===3?0.26:0.16;
  if(dn<core)return pickW(r,[19,22,1,14,23,16,5,14,6,8,2,12,14,5,10,4,22,6]);
  if(dn<0.68)return pickW(r,[22,38,5,12,23,6,16,8,7,8,14,5,6,6,2,7,3,6]);
  return pickW(r,[22,22,5,16,16,10,13,10,17,5,8,4,7,6])}
function mergeBlocks(c){const R=rng(c.seed^0x3e61),BD=c.D-1,bl=c.blocks,sp=c.sp=new Uint8Array(BD*BD),ms=c.ms=new Int32Array(BD*BD).fill(-1);let mi=0,mj=0,n=0;
  const SH=c.lay==='organic'?[2,1,3,1,2,3,2,2,2,3,1,1,1,3,1,3,2,1,2,3,1]:[2,1,3,1,2,3,2,2,2];const tw=[];for(let q=2;q<SH.length;q+=3)tw.push(q/3|0,SH[q]);
  for(let j=0;j<BD;j++)for(let i=0;i<BD;i++){const k=j*BD+i;if(!bl[k]||ms[k]>=0||sp[k]||bl[k]===21||bl[k]===20)continue;
    if(R()<c.opn){bl[k]=R()<0.55?23:5;continue} // an open square or a small park: the town is not built up wall to wall
    if(R()>c.mrg)continue;const q=pickW(R(),tw),si=SH[q*3],sj=SH[q*3+1];if(i+si>BD||j+sj>BD)continue;let good=true;
    for(let a=1;a<si;a++)if(c.kU[i+a]!==3)good=false;for(let b=1;b<sj;b++)if(c.kV[j+b]!==3)good=false; // avenues and boulevards run on through
    for(let b=0;b<sj&&good;b++)for(let a=0;a<si;a++){const o=(j+b)*BD+i+a;if(!bl[o]||bl[o]===21||bl[o]===20||ms[o]>=0||(o!==k&&sp[o])){good=false;break}}
    if(!good)continue;sp[k]=(si-1)|((sj-1)<<4);const f=blkFrame(c,i,j);if(!blkFits(c,i,j,si,sj,f)||wetArea(f[0],f[1],f[2],f[3],-f[4],-f[5],f[4],f[5],c.lay?18:28,0.0015,!!c.lay)){sp[k]=0;continue}
    for(let b=0;b<sj;b++)for(let a=0;a<si;a++){const o=(j+b)*BD+i+a;if(o!==k){ms[o]=k;bl[o]=0;n++}}
    let t=bigType(c,cityF(c,f[0],f[1]),R);if(t===9&&c._stad)t=22;if(t===9)c._stad=1;bl[k]=t;mi=M.max(mi,si-1);mj=M.max(mj,sj-1)}
  c.msi=mi;c.msj=mj;c.nblocks-=n}
// a merged block of a bent grid is one rectangle: its edges must stay within 2.5 m of the curved streets round it
function blkFits(c,i,j,si,sj,f){if(!c.wp)return true;const u0=c.us[i],u1=c.us[i+si],v0=c.vs[j],v1=c.vs[j+sj];
  for(let q=0;q<=4;q++){const t=q/4;for(const [u,v,lx,ly] of [[u0+(u1-u0)*t,v0,-f[4]+2*f[4]*t,-f[5]],[u0+(u1-u0)*t,v1,-f[4]+2*f[4]*t,f[5]],[u0,v0+(v1-v0)*t,-f[4],-f[5]+2*f[5]*t],[u1,v0+(v1-v0)*t,f[4],-f[5]+2*f[5]*t]]){
    const g=cW(c,u,v),x=f[0]+lx*f[2]-ly*f[3],y=f[1]+lx*f[3]+ly*f[2];if(M.hypot(g[0]-x,g[1]-y)>2.5)return false}}return true}
// diagonal boulevards across a straight grid (1 or 2, through the centre): the blocks they cut become green strips
// (both ends on grid nodes inside the built-up area, so they meet streets; the road itself is laid after the streets)
function addDiag(c){const R=rng(c.seed^0xd1a9),base=c.ang+PI/4+(R()-0.5)*0.35,BD=c.D-1,N=c.N,bl=c.blocks;c.dgl=[];
  const inner=(i,j)=>i>0&&j>0&&i<BD&&j<BD&&bl[(j-1)*BD+i-1]&&bl[(j-1)*BD+i]&&bl[j*BD+i-1]&&bl[j*BD+i];
  const snap=(x,y)=>{const q=cU(c,x,y),bi=bsr(c.us,q[0]),bj=bsr(c.vs,q[1]);let best=null,bd=1e18;for(let j=bj-3;j<=bj+4;j++)for(let i=bi-3;i<=bi+4;i++){if(!inner(i,j))continue;const p=cpt(c,i-N,j-N),d=(p[0]-x)**2+(p[1]-y)**2;if(d<bd){bd=d;best=p}}return best};
  for(let q=0;q<c.diag;q++){const a=base+q*(PI/2+(R()-0.5)*0.5),ca=M.cos(a),sa=M.sin(a),off=(R()-0.5)*c.bu*0.6,ox=-sa*off,oy=ca*off,runs=[];let cur=null;
    for(let t=-c.R*1.3;t<=c.R*1.3;t+=20){const x=c.x+ox+ca*t,y=c.y+oy+sa*t,on=cityF(c,x,y)<0.88&&landE(x,y,0.002)>=0;if(on){if(!cur)runs.push(cur=[]);cur.push(x,y)}else cur=null}
    for(const p of runs){if(p.length<2*30)continue;const A=snap(p[0]+ca*60,p[1]+sa*60),B=snap(p[p.length-2]-ca*60,p[p.length-1]-sa*60);if(!A||!B||M.hypot(B[0]-A[0],B[1]-A[1])<600)continue;
      const pts=[A[0],A[1],B[0],B[1]];if(!waterRunOK(pts,60,0.05))continue;throughClear({k:7,pts,n:2},c);c.dgl.push(pts)}}}
// radial and fan towns: rings at growing steps, rays (a multiple of 16); near the centre neighbouring cells merge
// along the ring (2, 4, 8, 16 of them) so blocks keep a sensible width
function buildPolar(c){const P=c.pol,R=rng(c.seed^0x9a7e);c.N=0;
  if(!P.full){let best=-1,ba=c.ang;for(let q=0;q<12;q++){const a=q/12*TAU;let s=0;for(let d=0.2;d<=1.21;d+=0.2)for(const da of [-0.6,0,0.6])if(landE(c.x+M.cos(a+da)*c.R*d,c.y+M.sin(a+da)*c.R*d,0)>=0)s++;if(s>best){best=s;ba=a}}c.ang=ba;c.ca=M.cos(ba);c.sa=M.sin(ba)}
  c.px=c.x-c.ca*P.off;c.py=c.y-c.sa*P.off;
  const rmax=P.off+c.R*1.32,bu=c.bu,bv=c.bv,rs=[P.rin];while(rs[rs.length-1]<rmax){const r=rs[rs.length-1];rs.push(r+M.min(bu*(0.8+0.4*R()),0.38*r+45))}
  const NR=c.nr=M.max(32,M.round(P.th*0.72*rmax/(1.25*bv)/32)*32);c.prr=1000;const dv=P.th/NR*c.prr,v0=P.full?0:-P.th/2*c.prr;
  const D=c.D=M.max(rs.length,NR+1)+1,us=c.us=new Float64Array(D),vs=c.vs=new Float64Array(D);
  for(let i=0;i<D;i++){us[i]=i<rs.length?rs[i]:rs[rs.length-1]+(i-rs.length+1)*bu;vs[i]=v0+i*dv}
  // ring 0 (round the central square) and two rings further out are boulevards, every 4th ring an avenue;
  // rays: every 32nd a boulevard, every 8th an avenue
  const kU=c.kU=new Uint8Array(D).fill(3),kV=c.kV=new Uint8Array(D).fill(3);kU[0]=7;for(let i=4;i<D;i+=4)kU[i]=2;
  for(const f of [0.42,0.82]){let bi=1,bd=1e18;for(let i=1;i<rs.length;i++){const d=M.abs(rs[i]-(P.off+c.R*f));if(d<bd){bd=d;bi=i}}kU[bi]=7}
  for(let j=0;j<D;j++)kV[j]=j%32===0?7:j%8===0?2:3;if(!P.full){kV[0]=2;kV[NR]=2}
  const spanAt=i=>{const w=us[i]*dv/c.prr;let s=1;while(s<16&&w*s<0.62*bv)s*=2;return s};
  for(let i=1;i<D;i++)if(spanAt(i-1)>=16&&spanAt(i)<16&&kU[i]===3)kU[i]=2; // avenue rays begin on an avenue ring
  const ok=new Uint8Array(D*D);for(let j=0;j<=NR;j++)for(let i=0;i<D;i++){const p=plW(c,us[i],vs[j]);if(cityF(c,p[0],p[1])<1){const e=landE(p[0],p[1],0.0025);if(e>=0&&e<0.42)ok[j*D+i]=1}}
  const BD=D-1,bl=c.blocks=new Uint8Array(BD*BD),sp=c.sp=new Uint8Array(BD*BD),ms=c.ms=new Int32Array(BD*BD).fill(-1);let stad=false,cnt=0,mj=0;
  const cell=(i,j)=>ok[j*D+i]&&ok[j*D+i+1]&&ok[(j+1)*D+i]&&ok[(j+1)*D+i+1];
  const put=(i,j,s)=>{let all=true;for(let q=0;q<s;q++)if(!cell(i,j+q)){all=false;break}
    if(all){const k=j*BD+i;sp[k]=(s-1)<<4;const f=blkFrame(c,i,j);
      if(us[i]*dv/c.prr*s>=bv*0.3&&f[4]>14&&f[5]>14&&!wetArea(f[0],f[1],f[2],f[3],-f[4],-f[5],f[4],f[5],c.lay?18:28,0.0015,!!c.lay)){
        const Rb=rng(hh(c.id,i*977+j,51));let t=i===0?(Rb()<0.5?23:5):pickType(c,cityF(c,f[0],f[1]),Rb);if(t===9){if(stad)t=5;else stad=true}if(i>0&&Rb()<0.05)t=Rb()<0.5?23:5;
        bl[k]=t;cnt++;for(let q=1;q<s;q++)ms[k+q*BD]=k;mj=M.max(mj,s-1);return}
      sp[k]=0}
    if(s>1){put(i,j,s/2);put(i,j+s/2,s/2)}};
  for(let i=0;i<BD;i++){const s=spanAt(i);for(let j=0;j+s<=NR;j+=s)put(i,j,s)}
  c.nblocks=cnt;c.msi=0;c.msj=mj;
  // the government quarter of a capital faces the central square (fan: at its head, on the axis)
  if(c.cap!==undefined){let bd=1e18,bk=-1;for(let j=0;j<NR;j++)for(let i=0;i<3;i++){const k=j*BD+i;if(!bl[k])continue;const f=blkFrame(c,i,j),d=i*1e7+M.abs(((M.atan2(f[3],f[2])-c.ang)%TAU+TAU*1.5)%TAU-PI);if(d<bd){bd=d;bk=k}}if(bk>=0)bl[bk]=21}
  gridStreets(c,ok)}

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
  const mk=(ang,len,ox,oy)=>{const ca=M.cos(ang),sa=M.sin(ang);let best=null,cur=null;const n=20;const X=ox===undefined?c.x:ox,Y=oy===undefined?c.y:oy;
    for(let k=0;k<=n;k++){const t=-len+2*len*k/n;const x=X+ca*t,y=Y+sa*t;const okk=landE(x,y,0.004)>=0;
      if(okk){if(!cur)cur=[t,t];cur[1]=t}else{if(cur&&(!best||cur[1]-cur[0]>best[1]-best[0]))best=cur;cur=null}}
    if(cur&&(!best||cur[1]-cur[0]>best[1]-best[0]))best=cur;
    if(best&&best[1]-best[0]>80){const s={x0:X+ca*best[0],y0:Y+sa*best[0],x1:X+ca*best[1],y1:Y+sa*best[1],ca,sa,L:best[1]-best[0]};c.vst.push(s);
      s.r=mkRoad(4,[s.x0,s.y0,s.x1,s.y1]);}};
  // villages founded in the game (stage 5.9) get one of several layouts and their own plot rhythm
  if(c.dyn){const L=c.R,a=c.ang,px=-c.sa,py=c.ca,t=R()*6|0;c.vsp=0.8+R()*0.6;c.vlay=t;
    if(t===0)mk(a,L*1.25);
    else if(t===1){mk(a,L*1.05);mk(a+PI/2,L*0.85)}
    else if(t===2){mk(a,L*1.05);mk(a+PI/2,L*0.45,c.x+px*L*0.45,c.y+py*L*0.45)}
    else if(t===3){mk(a,L*0.95);mk(a+0.62,L*0.8)}
    else if(t===4){mk(a,L*0.95,c.x+px*L*0.28,c.y+py*L*0.28);mk(a,L*0.8,c.x-px*L*0.28,c.y-py*L*0.28);mk(a+PI/2,L*0.32)}
    else{mk(a,L*0.7,c.x-c.ca*L*0.35,c.y-c.sa*L*0.35);mk(a+PI/2,L*0.7,c.x+c.ca*L*0.35+px*L*0.35,c.y+c.sa*L*0.35+py*L*0.35)}
    return}
  mk(c.ang,c.R*1.1);if(R()<0.6)mk(c.ang+PI/2+(R()-0.5)*0.4,c.R*0.75);
  if(c.R>280&&R()<0.5){const o=(R()<0.5?1:-1)*c.R*0.45;const ox=-c.sa*o,oy=c.ca*o;const cc={x:c.x+ox,y:c.y+oy};const sv=c.x;c.x=cc.x;c.y=cc.y;mk(c.ang,c.R*0.7);c.x=sv;c.y-=oy;}
}
const T0=Date.now();
for(const c of cities){if(c.type>=1)buildCity(c);else buildVillage(c)}
for(let i=cities.length-1;i>=0;i--){const c=cities[i];if(c.type===0&&c.vst.length===0)c.dead=true;if(c.type>=1&&c.nblocks<4&&c.cap===undefined)c.dead=true}
const live=cities.filter(c=>!c.dead);
for(const c of live)addF(c,c.bb[0],c.bb[1],c.bb[2],c.bb[3]);

// ---------------------------------------------------------------- inter-city routes
function routePts(ax,ay,bx,by,amp,det,ph,step){
  const dx=bx-ax,dy=by-ay,L=M.hypot(dx,dy),nx=-dy/L,ny=dx/L,n=M.max(2,M.ceil(L/step));const pts=[];
  for(let k=0;k<=n;k++){const t=k/n;const env=M.sin(PI*t);
    const off=env*(noise(t*L/9000+ph,ph*1.37)*M.min(L*amp,2600)+noise(t*L/1300+ph*2.1,3.3+ph)*det);
    pts.push(ax+dx*t+nx*off,ay+dy*t+ny*off)}return pts}
function snapNode(C,x,y){if(C.kU)return snapNodeG(C,x,y);const N=C.N,D=C.D,BD=D-1,bl=C.blocks;const dx=x-C.x,dy=y-C.y;let u=dx*C.ca+dy*C.sa,v=-dx*C.sa+dy*C.ca;if(C.wp)[u,v]=cU(C,x,y);
  const bi=bsr(C.us,u),bj=bsr(C.vs,v);let best=null,bd=1e18;
  for(let j=bj-2;j<=bj+3;j++)for(let i=bi-2;i<=bi+3;i++){if(i<0||j<0||i>=D||j>=D)continue;let adj=false;
    for(const [a,b] of [[i-1,j-1],[i,j-1],[i-1,j],[i,j]])if(a>=0&&b>=0&&a<BD&&b<BD&&bl[b*BD+a]>0)adj=true;if(!adj)continue;
    const d=((C.us[i]-u)**2+(C.vs[j]-v)**2)*((lineKind(i-N)!==3||lineKind(j-N)!==3)?0.3:1);if(d<bd){bd=d;best=[i,j]}}
  if(!best)for(let j=0;j<D;j++)for(let i=0;i<D;i++){let adj=false; // no streets here (hills, water): nearest node that has a block
    for(const [a,b] of [[i-1,j-1],[i,j-1],[i-1,j],[i,j]])if(a>=0&&b>=0&&a<BD&&b<BD&&bl[b*BD+a]>0)adj=true;if(!adj)continue;const d=(C.us[i]-u)**2+(C.vs[j]-v)**2;if(d<bd){bd=d;best=[i,j]}}
  return best?cpt(C,best[0]-N,best[1]-N):[x,y]}
// game towns: the nearest node on a street (merged blocks leave grid nodes without streets), avenues preferred
function snapNodeG(C,x,y){const D=C.D,eU=C.eU,eV=C.eV,full=C.pol&&C.pol.full,NR=C.nr;const q=cU(C,x,y),bi=bsr(C.us,q[0]),bj=bsr(C.vs,q[1]);let best=null,bd=1e18;
  const has=(i,j)=>eU[j*D+i]||(i>0&&eU[j*D+i-1])||eV[j*D+i]||(j>0&&eV[(j-1)*D+i]);
  const tryN=(i,j)=>{if(full)j=((j%NR)+NR)%NR;if(i<0||j<0||i>=D||j>=D||!has(i,j))return;const p=cW(C,C.us[i],C.vs[j]);const d=((p[0]-x)**2+(p[1]-y)**2)*((C.kU[i]!==3||C.kV[j]!==3)?0.3:1);if(d<bd){bd=d;best=p}};
  const w=C.pol?17:3;for(let j=bj-w;j<=bj+w+1;j++)for(let i=bi-3;i<=bi+4;i++)tryN(i,j);
  if(!best)for(let j=0;j<D;j++)for(let i=0;i<D;i++)tryN(i,j);return best||[x,y]}
const pairs=new Set();
// a new route must not run on top of an existing road: ends that ride along a street / road are trimmed back to
// where they leave it (a T-junction there), railways are rerouted away from long side-by-side runs
function chaikin(p,it){for(let q=0;q<it;q++){const n=p.length/2;if(n<3)return p;const o=[p[0],p[1]];for(let i=0;i<n-1;i++){const ax=p[i*2],ay=p[i*2+1],bx=p[i*2+2],by=p[i*2+3];if(i>0)o.push(ax*0.75+bx*0.25,ay*0.75+by*0.25);if(i<n-2)o.push(ax*0.25+bx*0.75,ay*0.25+by*0.75)}o.push(p[n*2-2],p[n*2-1]);p=o}return p}
function plCum(pts){const n=pts.length/2,c=[0];for(let i=1;i<n;i++)c.push(c[i-1]+M.hypot(pts[i*2]-pts[i*2-2],pts[i*2+1]-pts[i*2-1]));return c}
function plAt(pts,c,s){let i=0;while(i<c.length-2&&c[i+1]<s)i++;const l=c[i+1]-c[i]||1,t=clamp((s-c[i])/l,0,1),dx=(pts[i*2+2]-pts[i*2])/l,dy=(pts[i*2+3]-pts[i*2+1])/l;return [pts[i*2]+(pts[i*2+2]-pts[i*2])*t,pts[i*2+1]+(pts[i*2+3]-pts[i*2+1])*t,dx,dy,i]}
function ridesOn(x,y,dx,dy,k,only){for(const r of queryRoads(x-40,y-40,x+40,y+40)){if(r.k===8||(only&&!only(r))||x<r.bb[0]-40||x>r.bb[2]+40||y<r.bb[1]-40||y>r.bb[3]+40)continue;const lim=(RW[k]+RW[r.k])/2+3;
    for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],ex=r.pts[i*2+2]-ax,ey=r.pts[i*2+3]-ay,l2=ex*ex+ey*ey||1;const t=clamp(((x-ax)*ex+(y-ay)*ey)/l2,0,1);
      if(M.hypot(ax+ex*t-x,ay+ey*t-y)<lim&&M.abs(ex*dx+ey*dy)/M.sqrt(l2)>0.85)return r}}return null}
function projOn(r,x,y){let best=1e18,bx=x,by=y;for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],ex=r.pts[i*2+2]-ax,ey=r.pts[i*2+3]-ay,l2=ex*ex+ey*ey||1;const t=clamp(((x-ax)*ex+(y-ay)*ey)/l2,0,1);const d=(ax+ex*t-x)**2+(ay+ey*t-y)**2;if(d<best){best=d;bx=ax+ex*t;by=ay+ey*t}}return [bx,by]}
let TSTUB=false;
function trimAlong(pts,k,keepA,keepB){TSTUB=false;const c=plCum(pts),L=c[c.length-1];let s0=0,s1=L,rA=null,rB=null;
  if(!keepA)while(s0<L){const p=plAt(pts,c,s0);const r=ridesOn(p[0],p[1],p[2],p[3],k);if(!r)break;rA=r;s0+=8}
  if(!keepB)while(s1>s0){const p=plAt(pts,c,s1);const r=ridesOn(p[0],p[1],p[2],p[3],k);if(!r)break;rB=r;s1-=8}
  // a minor road never joins a highway on the level: it stops short of it instead
  const hw=(r)=>r&&r.k===0&&(k===3||k===4);TSTUB=false;if(hw(rA)){s0=M.min(L,s0+22);rA=null;TSTUB=true}if(hw(rB)){s1=M.max(0,s1-22);rB=null;TSTUB=true}
  if(s0===0&&s1===L)return pts;if(s1-s0<80)return null;
  // the cut end is joined to the centre line of the road it was riding on, so it does not hang next to it
  // the cut end merges into the road it was riding on at a shallow angle (a point on that road a little way back)
  const a=plAt(pts,c,s0),b=plAt(pts,c,s1),out=[];if(rA){const m=plAt(pts,c,M.max(0,s0-30)),q=projOn(rA,m[0],m[1]);out.push(q[0],q[1])}out.push(a[0],a[1]);for(let i=a[4]+1;i<=b[4];i++)out.push(pts[i*2],pts[i*2+1]);out.push(b[0],b[1]);if(rB){const m=plAt(pts,c,M.min(L,s1+30)),q=projOn(rB,m[0],m[1]);out.push(q[0],q[1])}return out}
// join point on road r: straight ahead along (dx,dy) if the road is met within 90 m, otherwise the nearest point
function joinOn(r,x,y,dx,dy){let bt=90,q=null;for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],ex=r.pts[i*2+2]-ax,ey=r.pts[i*2+3]-ay,den=dx*ey-dy*ex;if(M.abs(den)<1e-9)continue;
    const t=((ax-x)*ey-(ay-y)*ex)/den,u=((ax-x)*dy-(ay-y)*dx)/den;if(t>0&&t<bt&&u>=0&&u<=1){bt=t;q=[x+dx*t,y+dy*t]}}return q||projOn(r,x,y)}
function sideRun(pts,k,stop){const c=plCum(pts),L=c[c.length-1];let run=0,best=0;stop=stop||1e9;
  for(let s=0;s<L;s+=16){const p=plAt(pts,c,s);if(ridesOn(p[0],p[1],p[2],p[3],k)){run+=16;if(run>best){best=run;if(best>=stop)return best}}else run=0}return best}
function connect(A,B,k){const key=A.id<B.id?A.id+'_'+B.id+'_'+k:B.id+'_'+A.id+'_'+k;if(pairs.has(key))return;pairs.add(key);
  const dx=B.x-A.x,dy=B.y-A.y,L=M.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const rr=(C,ang)=>k===5&&C.type>=1?C.R*(C.type===3?1.3:1.15):C.type===3?(k===0?ringR(C,ang):C.R*1.0):C.type===2?C.R*0.82:C.type===1?C.R*0.6:0;const ra=rr(A,M.atan2(uy,ux)),rb=rr(B,M.atan2(-uy,-ux));
  let ax=A.x+ux*ra,ay=A.y+uy*ra,bx=B.x-ux*rb,by=B.y-uy*rb;
  // roads that end inside a town end exactly on a street node (preferably on an avenue), not in the middle of a block
  const wA=k===0&&A.type===3&&landE(ax,ay,0)<0,wB=k===0&&B.type===3&&landE(bx,by,0)<0; // ring point in the water: go into the city
  if(k!==5){if(A.type>=1&&(!(k===0&&A.type===3)||wA))[ax,ay]=snapNode(A,ax,ay);if(B.type>=1&&(!(k===0&&B.type===3)||wB))[bx,by]=snapNode(B,bx,by)}
  const cfg=DYNW?[0.1,40,200,900,0.45]:k===0?[0.1,60,420,900,0.2]:k===1?[0.1,50,300,450,0.15]:k===5?[0.07,30,380,700,0.2]:[0.13,40,160,150,0.1];
  let fb=null,fbr=1e9;const ring=(C)=>k===0&&C.type===3&&!(C===A?wA:wB);
  const NA=k===5?10:4;for(let a=0;a<=NA;a++){let pts;if(a<NA){const ph=hr(A.id,B.id,k*13+a)*100;
      if(k===5){const d=(a%2?-1:1)*(0.32+0.09*(a>>1)),th=M.atan2(uy,ux);ax=A.x+M.cos(th+d)*ra;ay=A.y+M.sin(th+d)*ra;bx=B.x-M.cos(th-d)*rb;by=B.y-M.sin(th-d)*rb} // rails approach towns off the highway bearing
      pts=routePts(ax,ay,bx,by,cfg[0]*(a%2?-1:1)*(1+(a>>2)*0.6),cfg[1],ph,cfg[2]);if(!waterRunOK(pts,cfg[3],cfg[4]))continue;
      if(k!==5){pts=trimAlong(pts,k,ring(A),ring(B));if(!pts)continue;pts.stub=TSTUB}else if(plCum(pts).pop()<3000)return; // no room for stations at both ends
      const sr=sideRun(pts,k,M.min(fbr,1e9));if(sr>40){if(sr<fbr){fb=pts;fbr=sr}continue}}else{if(!fb||fbr>(DYNW?400:100)&&k!==5)return;pts=fb} // a road that would ride on top of another for >100 m duplicates it: skip
    // round off corners (Chaikin, end points kept): no kinks where the route bends towards a street node
    const stub=pts.stub;if(k!==5)pts=chaikin(pts,2);
    if(DYNR&&k!==5){const q=avoidZ(pts,k,null);if(!q){if(a<NA)continue;return}pts=q} // game: around the buildings in the way
    // a highway does not run into a town's street grid: from the town edge on it continues as an avenue to the node
    if(k===0){const c=plCum(pts),L=c[c.length-1];const inn=(C,e)=>{if(C.type<1||(C.type===3&&!(e?wB:wA)))return 0;let d=0,last=-1;const BD=C.D-1;
        while(d<L*0.45){const q=plAt(pts,c,e?L-d:d);if(cityF(C,q[0],q[1])>1.3)break;const x=q[0]-C.x,y=q[1]-C.y,uv=C.cv?cU(C,q[0],q[1]):[x*C.ca+y*C.sa,-x*C.sa+y*C.ca],bi=bsr(C.us,uv[0]),bj=bsr(C.vs,uv[1]);
          if(bi>=0&&bj>=0&&bi<BD&&bj<BD&&(C.blocks[bj*BD+bi]||C.ms&&C.ms[bj*BD+bi]>=0))last=d;d+=10}return last>=0?last+25:70}; // at least a short avenue stub: a highway never meets a street head-on
      const dA=inn(A,0),dB=inn(B,1);if(dA||dB){const cut=(s0,s1)=>{const a=plAt(pts,c,s0),b=plAt(pts,c,s1),o=[a[0],a[1]];for(let i=a[4]+1;i<=b[4];i++)o.push(pts[i*2],pts[i*2+1]);o.push(b[0],b[1]);return o};
        if(dA){const q=mkRoad(2,cut(0,dA));if(q)bridgesOf(q)}if(dB){const q=mkRoad(2,cut(L-dB,L));if(q)bridgesOf(q)}pts=cut(dA,L-dB)}}
    {const r=mkRoad(k,pts);if(r&&stub)r.stub=1;if(r){bridgesOf(r);if(k===0){const p=r.pts,n=r.n;if(A.type===3&&!wA)JUNC.push([A,ax,ay,p[2]-p[0],p[3]-p[1],r]);if(B.type===3&&!wB)JUNC.push([B,bx,by,p[n*2-4]-p[n*2-2],p[n*2-3]-p[n*2-1],r])}}return}}}
const JUNC=[];
function ringR(c,a){return c.R*(1.08+0.07*noise(M.cos(a)*1.5+c.id,M.sin(a)*1.5))}
const bigs=live.filter(c=>c.type>=2),towns=live.filter(c=>c.type===1),vills=live.filter(c=>c.type===0);
function nearest(c,list,n,maxD){return list.filter(o=>o!==c).map(o=>[o,M.hypot(o.x-c.x,o.y-c.y)]).filter(a=>a[1]<maxD).sort((a,b)=>a[1]-b[1]).slice(0,n).map(a=>a[0])}
for(const c of bigs)for(const o of nearest(c,bigs,3,34000))connect(c,o,0);
for(const c of bigs)for(const o of nearest(c,bigs,2,48000))connect(c,o,5);
// state highways: every capital is linked to the two nearest capitals, however far
{const capL=live.filter(c=>c.cap!==undefined);for(const c of capL)for(const o of nearest(c,capL,2,1e9))connect(c,o,0)}
for(const c of towns)for(const o of nearest(c,live.filter(q=>q.type>=1),2,16000))connect(c,o,1);
for(const c of vills){const nn=nearest(c,live,2,7000);if(nn[0])connect(c,nn[0],4);if(nn[1]&&hr(c.id,1,1)<0.45)connect(c,nn[1],4)}
// ring roads
for(const c of bigs){if(c.type!==3)continue;const n=96,pts=[],wat=[];
  for(let k=0;k<n;k++){const a=k/n*TAU;const rr=ringR(c,a);const x=c.x+M.cos(a)*rr,y=c.y+M.sin(a)*rr;pts.push([x,y]);wat.push(landE(x,y,0)<0)}
  let st=wat.indexOf(true);const runs=[];
  if(st<0){const p=[];for(let k=0;k<=n;k++)p.push(pts[k%n][0],pts[k%n][1]);runs.push(p)}else{
    let cur=[],wrun=0;for(let q=1;q<=n;q++){const k=(st+q)%n;if(wat[k]){wrun++;cur.push(pts[k][0],pts[k][1]);if(wrun>3){if(cur.length>8)runs.push(cur.slice(0,cur.length-2*wrun));cur=[]}}else{wrun=0;cur.push(pts[k][0],pts[k][1])}}
    if(cur.length>8)runs.push(cur)}
  for(const p of runs){while(p.length>4&&landE(p[p.length-2],p[p.length-1],0)<0)p.length-=2;while(p.length>4&&landE(p[0],p[1],0)<0)p.splice(0,2)} // a ring piece never ends in the water
  c.rings=[];for(const p of runs){if(p.length<2*14)continue;const r=mkRoad(0,p,{ring:1});if(!r)continue;bridgesOf(r);c.rings.push(r);
    if(runs.length>1||st>=0)for(const e of [0,r.n-1]){const x=r.pts[e*2],y=r.pts[e*2+1],a0=M.atan2(y-c.y,x-c.x);
      for(const [f,da] of [[0.85,0],[0.85,0.25],[0.85,-0.25],[0.7,0],[0.7,0.4],[0.7,-0.4],[0.55,0]]){const q=snapNode(c,c.x+M.cos(a0+da)*M.hypot(x-c.x,y-c.y)*f,c.y+M.sin(a0+da)*M.hypot(x-c.x,y-c.y)*f);if(waterRunOK([x,y,q[0],q[1]],120,0.2)||f===0.55){mkRoad(2,[x,y,q[0],q[1]]);break}}}}}

// ---------------------------------------------------------------- zones
const zones=[],emitters=[],airports=[],farms=[];
const ZS={ind:[1300,850],ref:[1500,1050],pow:[760,560],port:[820,900],air:[4300,1500],solar:[620,420],agro:[520,340],farm:[300,200],dacha:[760,520],cem:[380,260],quarry:[700,520],mil:[940,660],saw:[360,260],oil:[130,95],sam:[150,150],ref2:[1000,700],sol2:[72,46],mine:[300,220],gasw:[150,110],rst:[300,64],dport:[240,180],dramp:[84,40],drwy:[460,56],dstore:[120,76],dfab:[400,280]};const OLDK=['ind','ref','pow','port','air','solar'];
function zoneFree(x,y,rad,self){
  for(const c of live){if(c===self)continue;const d=M.hypot(c.x-x,c.y-y);if(d<c.R*1.1+rad)return false}
  if(self&&M.hypot(self.x-x,self.y-y)<self.R*1.02+rad*0.6)return false;
  for(const z of zones){if(M.hypot(z.x-x,z.y-y)<z.rad+rad+80)return false}return true}
function segBox(ax,ay,bx,by,hx,hy){let t0=0,t1=1;const dx=bx-ax,dy=by-ay;const P=[-dx,dx,-dy,dy],Q=[ax+hx,hx-ax,ay+hy,hy-ay];
  for(let i=0;i<4;i++){if(P[i]===0){if(Q[i]<0)return false}else{const t=Q[i]/P[i];if(P[i]<0){if(t>t1)return false;if(t>t0)t0=t}else{if(t<t0)return false;if(t<t1)t1=t}}}return true}
function roadHits(x,y,a,W,H,mg,skip){const ca=M.cos(a),sa=M.sin(a),rad=M.hypot(W,H)/2+mg;const L=queryRoads(x-rad,y-rad,x+rad,y+rad);
  for(const r of L){if(r===skip||r.k===8||x<r.bb[0]-rad-20||x>r.bb[2]+rad+20||y<r.bb[1]-rad-20||y>r.bb[3]+rad+20)continue;const m=mg+RW[r.k]/2;for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2]-x,ay=r.pts[i*2+1]-y,bx=r.pts[i*2+2]-x,by=r.pts[i*2+3]-y;
    if(segBox(ax*ca+ay*sa,-ax*sa+ay*ca,bx*ca+by*sa,-bx*sa+by*ca,W/2+m,H/2+m))return true}}return false}
function placeZone(c,kind){
  let [W,H]=ZS[kind];if(kind==='ind'){const s=c.type===3?1:c.type===2?0.75:0.48;W*=s;H*=s}
  const rad=M.hypot(W,H)/2;const R=rng(hh(c.id,OLDK.includes(kind)?kind.length:100+kind.charCodeAt(0)*7+kind.charCodeAt(1),77));const a0=R()*TAU;
  for(let k=0,nk=kind==='mil'?80:48;k<nk;k++){const a=a0+k*TAU/16;const ca=M.cos(a),sa=M.sin(a);const ring=(k>>4)*900;
    if(kind==='port'){let found=-1;for(let d=c.R*0.7;d<c.R+2200;d+=60){if(baseH(c.x+ca*d,c.y+sa*d,7)<-0.01){found=d;break}}
      if(found<0)continue;
      // face the open water: the port axis follows the coast normal (height gradient), not the ray from the town
      const fx=c.x+ca*found,fy=c.y+sa*found,gx=baseH(fx+60,fy,7)-baseH(fx-60,fy,7),gy=baseH(fx,fy+60,7)-baseH(fx,fy-60,7),gl=M.hypot(gx,gy);if(gl<1e-6)continue;
      const pa=M.atan2(-gy,-gx),pc=M.cos(pa),ps=M.sin(pa);const x=fx-pc*260,y=fy-ps*260;
      // land part (x in [-0.62W, 40]) on dry land and outside every town, pier heads in the water
      let okk=true;for(let qx=0;qx<=6&&okk;qx++)for(let qy=-3;qy<=3;qy++){const lx=-W*0.62+(W*0.62+40)*qx/6,ly=qy/3*H*0.48,px=x+lx*pc-ly*ps,py=y+lx*ps+ly*pc;
        if(landE(px,py,0.002)<0){okk=false;break}for(const o of live)if(o.type>=1&&cityF(o,px,py)<1.08){okk=false;break}if(!okk)break}
      for(let q=-1;q<=1&&okk;q++){const lx=300,ly=q*H*0.33,px=x+lx*pc-ly*ps,py=y+lx*ps+ly*pc;if(landE(px,py,0)>=0)okk=false}
      if(!okk)continue;if(!zoneFree(x,y,rad*0.7,c))continue;return mkZone(c,kind,x,y,pa,W,H,rad)}
    const d=c.R*1.05+rad+120+ring;const x=c.x+ca*d,y=c.y+sa*d;if(x<4000||y<4000||x>WORLD-4000||y>WORLD-4000)continue;
    const za=a+PI/2+(R()-0.5)*0.3,zc=M.cos(za),zs=M.sin(za);let okk=true;
    for(let q=0;q<25&&okk;q++){const u=((q%5)/4-0.5)*W*1.05,v=((q/5|0)/4-0.5)*H*1.05;const px=x+u*zc-v*zs,py=y+u*zs+v*zc;const e=landE(px,py,0.003);if(e<0||e>(kind==='air'?0.3:kind==='mil'?0.48:0.4))okk=false}
    if(!okk||!zoneFree(x,y,rad,c))continue;if((ZSTRICT||!OLDK.includes(kind))&&roadHits(x,y,za,W,H,6,null))continue;
    if(wetArea(x,y,zc,zs,-W/2,-H/2,W/2,H/2,36,0.002))continue;return mkZone(c,kind,x,y,za,W,H,rad)}
  if(ZSTRICT&&OLDK.includes(kind)){ZSTRICT=false;const z=placeZone(c,kind);ZSTRICT=true;return z}
  return null}
let ZSTRICT=true;
// the access road starts on the edge of the zone's grounds (never runs under its buildings)
function zoneExit(z,ux,uy){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of z.prims)if(p.k==='g'){x0=M.min(x0,p.x);y0=M.min(y0,p.y);x1=M.max(x1,p.x+p.w);y1=M.max(y1,p.y+p.h)}
  if(x0>x1){x0=-z.W/2;x1=z.W/2;y0=-z.H/2;y1=z.H/2}const lx=ux*z.ca+uy*z.sa,ly=-ux*z.sa+uy*z.ca;
  const tx=lx>1e-9?x1/lx:lx<-1e-9?x0/lx:1e9,ty=ly>1e-9?y1/ly:ly<-1e-9?y0/ly:1e9,t=M.max(0,M.min(tx,ty)-3);return [z.x+ux*t,z.y+uy*t]}
let NOACC=false;
function mkZoneRaw(c,kind,x,y,a,W,H){const rad=M.hypot(W,H)/2;const z={kind:'zone',zk:kind,id:zones.length,city:c,x,y,ang:a,ca:M.cos(a),sa:M.sin(a),W,H,rad,seed:hh(c?c.id:7,zones.length,93)};
  z.bb=[x-rad-50,y-rad-50,x+rad+50,y+rad+50];zones.push(z);genZone(z);addF(z,z.bb[0],z.bb[1],z.bb[2],z.bb[3]);return z}
function mkZone(c,kind,x,y,a,W,H,rad){const z={kind:'zone',zk:kind,id:zones.length,city:c,x,y,ang:a,ca:M.cos(a),sa:M.sin(a),W,H,rad,seed:hh(c.id,zones.length,91)};if(ZOPT)z.o=ZOPT;
  z.bb=[x-rad-50,y-rad-50,x+rad+50,y+rad+50];zones.push(z);genZone(z);addF(z,z.bb[0],z.bb[1],z.bb[2],z.bb[3]);
  // access road
  if(!NOACC){const dx=c.x-x,dy=c.y-y,L=M.hypot(dx,dy);const ux=dx/L,uy=dy/L;const [sx,sy]=zoneExit(z,ux,uy);let ex=c.x-ux*c.R*0.75,ey=c.y-uy*c.R*0.75;if(c.type>=1)[ex,ey]=snapNode(c,ex,ey);else if(c.vst&&c.vst.length){let bd=1e18,bq=null;for(const st of c.vst){const q=projOn(st.r,ex,ey),d=(q[0]-ex)**2+(q[1]-ey)**2;if(d<bd){bd=d;bq=q}}[ex,ey]=bq}const kk=['farm','dacha','cem'].includes(kind)?4:1;
    if(M.hypot(ex-sx,ey-sy)>60){let pp=null,pr=1e9;for(const o of [40,-40,140,-140,260,-260]){const q=trimAlong([sx,sy,(sx+ex)/2+(-uy)*o,(sy+ey)/2+ux*o,ex,ey],kk,true,false);if(!q||!waterRunOK(q,kk===4?150:450,0.15))continue;const sr=sideRun(q,kk,pr);if(sr<pr){pp=q;pr=sr}if(sr<=40)break}
    const r=pp&&pr<=60&&mkRoad(kk,chaikin(pp,2));if(r){z.acc=r;if(z.city)r.gz=z.city.id;bridgesOf(r)}}}
  return z}
for(const c of live){if(c.type<1||EMPTY)continue;const R=rng(c.seed^0x3131); // game worlds: every building is placed by the players
  if(c.type===3){placeZone(c,'air');placeZone(c,'port');placeZone(c,'ind');placeZone(c,'ind');if(R()<0.6)placeZone(c,'ref');placeZone(c,'pow');if(R()<0.5)placeZone(c,'solar')}
  else if(c.type===2){placeZone(c,'ind');if(R()<0.5)placeZone(c,'port');if(R()<0.35)placeZone(c,'ref');if(R()<0.45)placeZone(c,'pow');if(R()<0.3)placeZone(c,'solar')}
  else{if(R()<0.6)placeZone(c,'ind');else if(R()<0.25)placeZone(c,'solar')}}

// extra zones (countryside & suburbs)
for(const c of live){if(EMPTY)break;const R=rng(c.seed^0x5151);
  if(c.type>=1){if(R()<(c.type>=2?0.85:0.3))placeZone(c,'dacha');if(R()<0.55)placeZone(c,'cem');if(R()<0.3)placeZone(c,'agro');if(baseH(c.x,c.y,6)>0.18&&R()<0.45)placeZone(c,'quarry')}
  else if(R()<0.32)placeZone(c,'farm')}
// military bases of the capitals (stage 5) go last: no later access road may cut through them
for(const c of live)if(!EMPTY&&c.cap!==undefined&&!placeZone(c,'mil')){ZS.mil=[720,520];placeZone(c,'mil');ZS.mil=[940,660]} // a smaller base if the full one does not fit
// interchanges -------------------------------------------------------------
function addClover(Jx,Jy,tx,ty,nx,ny,half,RA,RB){const rl=46,D=17,E=RW[0]/2-2.5;
  // ramp ends sit on the real carriageway (the roads bend away from the crossing tangents)
  const fix=(pts)=>{for(const [i,rd] of [[0,RB],[pts.length-2,RA]]){if(!rd)continue;const q=projOn(rd,pts[i],pts[i+1]),dx=pts[i]-q[0],dy=pts[i+1]-q[1],L=M.hypot(dx,dy)||1;pts[i]=q[0]+dx/L*E;pts[i+1]=q[1]+dy/L*E}return pts};
  const RP=[];for(const sa of [-1,1])for(const sb of (half?[1]:[-1,1])){const ax=tx*sa,ay=ty*sa,bx=nx*sb,by=ny*sb;const qx=Jx+(ax+bx)*(rl+D),qy=Jy+(ay+by)*(rl+D);
    const pts=[Jx+ax*E+bx*(rl+D+150),Jy+ay*E+by*(rl+D+150),qx-ax*rl+bx*70,qy-ay*rl+by*70];for(let d=180;d>=-90;d-=10){const t=d*PI/180;pts.push(qx+rl*(M.cos(t)*ax+M.sin(t)*bx),qy+rl*(M.cos(t)*ay+M.sin(t)*by))}
    pts.push(qx-bx*rl+ax*70,qy-by*rl+ay*70,Jx+bx*E+ax*(rl+D+150),Jy+by*E+ay*(rl+D+150));RP.push(fix(pts));
    const p1x=Jx+ax*(D+3)+bx*rl*3.3,p1y=Jy+ay*(D+3)+by*rl*3.3,p2x=Jx+bx*(D+3)+ax*rl*3.3,p2y=Jy+by*(D+3)+ay*rl*3.3,cx=Jx+(ax+bx)*rl*3.05,cy=Jy+(ay+by)*rl*3.05;
    const op=[Jx+ax*E+bx*(rl*3.3-130),Jy+ay*E+by*(rl*3.3-130)];for(let q=0;q<=14;q++){const t=q/14,u=1-t;op.push(u*u*p1x+2*u*t*cx+t*t*p2x,u*u*p1y+2*u*t*cy+t*t*p2y)}op.push(Jx+bx*E+ax*(rl*3.3-130),Jy+by*E+ay*(rl*3.3-130));RP.push(fix(op))}
  // no interchange where its ramps would cut across other roads (town streets beyond a ring road, a third highway)
  for(const P of RP){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<P.length;i+=2){x0=M.min(x0,P[i]);x1=M.max(x1,P[i]);y0=M.min(y0,P[i+1]);y1=M.max(y1,P[i+1])}
    for(const o of queryRoads(x0,y0,x1,y1)){if(o===RA||o===RB||o.k===6||o.k===8)continue;for(let i=0;i<P.length-2;i+=2)if(roadHitsSeg(o,P[i],P[i+1],P[i+2],P[i+3]))return false}}
  for(const P of RP)mkRoad(6,P);return true}
function nearestS(r,x,y){let best=1e18,bs=0;for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],bx=r.pts[i*2+2],by=r.pts[i*2+3];const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy||1;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=clamp(t,0,1);const px=ax+dx*t,py=ay+dy*t;const d=(px-x)**2+(py-y)**2;if(d<best){best=d;bs=r.cum[i]+t*M.sqrt(l2)}}return [M.sqrt(best),bs]}
for(const [c,jx,jy,hx,hy,hr0] of JUNC){if(landE(jx,jy,0)<0)continue;let ringR0=null;for(const r of c.rings||[]){const [d]=nearestS(r,jx,jy);if(d<120){ringR0=r;break}}const L=M.hypot(jx-c.x,jy-c.y);const nx=(jx-c.x)/L,ny=(jy-c.y)/L;
  // half cloverleaf only where the highway meets the ring almost radially and on dry land
  const hl=M.hypot(hx,hy)||1;let ok=(hx*nx+hy*ny)/hl>0.93;for(let q=0;q<16&&ok;q++){const a=q/16*TAU,rr=q&1?150:280;if(landE(jx+M.cos(a)*rr,jy+M.sin(a)*rr,0.002)<0)ok=false}
  if(ok&&ringR0)addClover(jx,jy,-ny,nx,nx,ny,true,ringR0,hr0);
  {const e=snapNode(c,c.x+(jx-c.x)*0.8,c.y+(jy-c.y)*0.8);const pts=trimAlong([jx,jy,e[0],e[1]],2,true,false);if(pts)mkRoad(2,pts)}
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
      const wet=landE(X,Y,0)<0; // over water the upper road still passes above the lower one (no interchange there)
      let up,lo,su;if(ka===5){up=rb;lo=ra;su=sB}else if(kb===5){up=ra;lo=rb;su=sA}else if(ka===0&&kb===0){if(ra.id>rb.id){up=ra;lo=rb;su=sA}else{up=rb;lo=ra;su=sB}}
      else if(ka===0){up=ra;lo=rb;su=sA}else{up=rb;lo=ra;su=sB}
      const hw=RW[lo.k]/2+24;(up.ov=up.ov||[]).push([su-hw,su+hw,lo.id]);
      if(!wet&&ka===0&&kb===0&&!ra.ring&&!rb.ring&&M.min(sA,ra.L-sA,sB,rb.L-sB)>420){const l1=M.hypot(r1x,r1y),l2=M.hypot(r2x,r2y);const cosA=M.abs((r1x*r2x+r1y*r2y)/(l1*l2));let dry=cosA<0.3;for(const c of live)if(M.hypot(c.x-X,c.y-Y)<c.R*1.35+300){dry=false;break}for(let q=0;q<16&&dry;q++){const a=q/16*TAU,rr=q&1?140:260;if(landE(X+M.cos(a)*rr,Y+M.sin(a)*rr,0.002)<0)dry=false}if(dry){addClover(X,Y,r1x/l1,r1y/l1,r2x/l2,r2y/l2,false,ra,rb)}}}}}}
// gas stations along highways / trunk roads ---------------------------------
var GASOFF=40,GASHW=false;
{const base=roads.length;for(let i=0;i<base;i++){const r=roads[i];if((r.k!==0&&r.k!==1)||r.ring||r.L<5000)continue;const R=rng(hh(r.id,5,55));
  for(let s=2000+R()*3000;s<r.L-2000;s+=7000+R()*6000){const p=posAt(r,s);const dx=p[2],dy=p[3];const off=RW[r.k]/2+34;const x=p[0]-dy*off,y=p[1]+dx*off;
    if(landE(x,y,0.004)<0||landE(x+dx*40,y+dy*40,0.004)<0||landE(x-dx*40,y-dy*40,0.004)<0)continue;let bad=false;
    for(const c of live)if(M.hypot(c.x-x,c.y-y)<c.R*1.15+120){bad=true;break}if(!bad)for(const z of zones)if(M.hypot(z.x-x,z.y-y)<z.rad+60){bad=true;break}if(bad)continue;
    if(roadHits(x,y,M.atan2(dy,dx),84,54,3,r)||wetArea(x,y,dx,dy,-42,-27,42,27,20,0.002))continue;GASOFF=off;GASHW=r.k===0;mkZoneRaw(null,'gas',x,y,M.atan2(dy,dx),84,54)}}}
// railway stations at line ends --------------------------------------------
// cut a road to [a,b] in place (grid cells keep their references, which is harmless)
function trimRoad(r,a,b){const P=[];const pa=posAt(r,a);P.push(pa[0],pa[1]);for(let i=0;i<r.n;i++)if(r.cum[i]>a+0.5&&r.cum[i]<b-0.5)P.push(r.pts[i*2],r.pts[i*2+1]);const pb=posAt(r,b);P.push(pb[0],pb[1]);
  const n=P.length/2,cum=new Float64Array(n);let L=0,x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<n;i++){if(i)L+=M.hypot(P[i*2]-P[i*2-2],P[i*2+1]-P[i*2-1]);cum[i]=L;x0=M.min(x0,P[i*2]);x1=M.max(x1,P[i*2]);y0=M.min(y0,P[i*2+1]);y1=M.max(y1,P[i*2+1])}
  r.pts=new Float64Array(P);r.cum=cum;r.L=L;r.n=n;r.bb=[x0,y0,x1,y1];if(r.ov){r.ov=r.ov.map(o=>[o[0]-a,o[1]-a,o[2]]).filter(o=>o[1]>0&&o[0]<L);if(!r.ov.length)r.ov=null}bridgesOf(r)}
// the line ends at the far end of its station (no track running on into the fields)
// a station is reached by a road from its car park side to the nearest ordinary road (not a highway)
function stnAccess(z){const lx=0,ly=z.H/2+2,sx=z.x+lx*z.ca-ly*z.sa,sy=z.y+lx*z.sa+ly*z.ca;let best=null,bd=1600;
  for(const o of queryRoads(sx-1600,sy-1600,sx+1600,sy+1600)){if(o.k===0||o.k===5||o.k===6||o.k===8)continue;const q=projOn(o,sx,sy),d=M.hypot(q[0]-sx,q[1]-sy);if(d>=bd)continue;
    const ax=q[0]-z.x,ay=q[1]-z.y;if(segBox(lx,ly+0.5,ax*z.ca+ay*z.sa,-ax*z.sa+ay*z.ca,z.W/2+4,z.H/2+1))continue; /* never across the station */
    if(sideRun([sx,sy,q[0],q[1]],4,31)>30)continue;let cross=false;for(const h of queryRoads(M.min(sx,q[0]),M.min(sy,q[1]),M.max(sx,q[0]),M.max(sy,q[1])))if(h!==o&&(h.k===0||h.k===1||h.k===5||h.k===6)&&roadHitsSeg(h,sx,sy,q[0],q[1])){cross=true;break}if(cross)continue;bd=d;best=q}
  if(!best||bd<15)return;const pts=[sx,sy,best[0],best[1]];if(!waterRunOK(pts,150,0.2))return;const r=mkRoad(4,pts);if(r){z.acc=r;if(z.city)r.gz=z.city.id;bridgesOf(r)}}
function roadHitsSeg(h,ax,ay,bx,by){for(let i=0;i<h.n-1;i++){const cx=h.pts[i*2],cy=h.pts[i*2+1],fx=h.pts[i*2+2]-cx,fy=h.pts[i*2+3]-cy,ex=bx-ax,ey=by-ay,den=ex*fy-ey*fx;if(M.abs(den)<1e-9)continue;const t=((cx-ax)*fy-(cy-ay)*fx)/den,u=((cx-ax)*ey-(cy-ay)*ex)/den;if(t>0.02&&t<0.98&&u>=0&&u<=1)return true}return false}
function stnSpot(r,s,strict){const p=posAt(r,s);const ux=p[2],uy=p[3],cx=p[0],cy=p[1];
  if(landE(cx,cy,0.003)<0||landE(cx+ux*240,cy+uy*240,0.003)<0||landE(cx-ux*240,cy-uy*240,0.003)<0)return null;
  for(const z of zones)if(M.hypot(z.x-cx,z.y-cy)<z.rad+(strict?260:70))return null;
  const lim=strict?1.08:1.0;for(const c of live)if(M.hypot(c.x-cx,c.y-cy)<c.R*1.6+300&&(cityF(c,cx,cy)<lim||cityF(c,cx+ux*250,cy+uy*250)<lim||cityF(c,cx-ux*250,cy-uy*250)<lim))return null;
  if(roadHits(cx,cy,M.atan2(uy,ux),500,96,4,r)||wetArea(cx,cy,ux,uy,-250,-48,250,48,30,0.002))return null;return [cx,cy,M.atan2(uy,ux)]}
for(const r of roads.slice()){if(r.k!==5)continue;let t0=0,t1=r.L,got=[false,false];
  for(const strict of [true,false])for(const end of [0,1]){if(got[end])continue;
    for(let d=300;d<(strict?3200:4600);d+=120){const s=end?r.L-d:d;if(s<300||s>r.L-300)break;if(end?s<t0+560:s>t1-560)break;const q=stnSpot(r,s,strict);if(!q)continue;
      stnAccess(mkZoneRaw(null,'stn',q[0],q[1],q[2],500,96));got[end]=true;if(end)t1=s+236;else t0=s-236;break}}
  if(t0>0||t1<r.L)trimRoad(r,t0,t1)}
// a minor road that ends on a highway is pulled back to stop short of it (no level junctions with highways)
for(const r of roads){if(r.city!==undefined||(r.k!==3&&r.k!==4))continue;
  for(const e of [1,0]){const x=e?r.pts[r.n*2-2]:r.pts[0],y=e?r.pts[r.n*2-1]:r.pts[1];let H=null;
    for(const o of queryRoads(x-20,y-20,x+20,y+20)){if(o.k!==0||o.ring)continue;const [d]=nearestS(o,x,y);if(d<RW[0]/2+RW[r.k]/2){H=o;break}}if(!H)continue;
    let d=0;while(d<r.L*0.5){const p=posAt(r,e?r.L-d:d);if(nearestS(H,p[0],p[1])[0]>RW[0]/2+14)break;d+=4}
    if(d<r.L*0.5&&r.L-d>60){if(e)trimRoad(r,0,r.L-d);else trimRoad(r,d,r.L);r.stub=1}}}
// an overpass whose lower road was cut back no longer crosses anything: drop it
for(const r of roads){if(!r.ov)continue;r.ov=r.ov.filter(o=>{if(o[2]===undefined)return true;const lo=roads[o[2]],p=posAt(r,(o[0]+o[1])/2);const [d]=nearestS(lo,p[0],p[1]);return d<RW[lo.k]/2+30});if(!r.ov.length)r.ov=null}
// power lines --------------------------------------------------------------
for(const z of zones.slice()){if(z.zk!=='pow')continue;const targets=[z.city].concat(nearest(z.city,live.filter(c=>c.type>=1),2,26000));
  for(const c of targets){const dx=c.x-z.x,dy=c.y-z.y,L=M.hypot(dx,dy);const ex=c.x-dx/L*c.R*0.92,ey=c.y-dy/L*c.R*0.92;const sx=z.x+dx/L*z.rad*0.6,sy=z.y+dy/L*z.rad*0.6;const LL=M.hypot(ex-sx,ey-sy);if(LL<400)continue;
    const n=M.ceil(LL/330);const pts=[];const ph=hr(z.id,c.id,3)*50;for(let q=0;q<=n;q++){const t=q/n;const o=M.sin(PI*t)*noise(t*3+ph,ph)*LL*0.06;pts.push(sx+(ex-sx)*t+(-(ey-sy)/LL)*o,sy+(ey-sy)*t+((ex-sx)/LL)*o)}mkRoad(8,pts)}}
// city blocks never sit on through-roads (highways, trunk roads, railways, ramps, access roads)
function throughClear(r,c){const hw=RW[r.k]/2+7;const BD=c.D-1,bl=c.blocks;
    for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],bx=r.pts[i*2+2],by=r.pts[i*2+3];if(M.max(ax,bx)<c.bb[0]||M.min(ax,bx)>c.bb[2]||M.max(ay,by)<c.bb[1]||M.min(ay,by)>c.bb[3])continue;
      const L=M.hypot(bx-ax,by-ay)||1,nx=-(by-ay)/L,ny=(bx-ax)/L;
      if(r.k===0&&cityF(c,(ax+bx)/2,(ay+by)/2)<1.05){const U=r.urb||(r.urb=[]);const a=r.cum[i],b=r.cum[i+1];if(U.length&&U[U.length-1][1]>=a-1)U[U.length-1][1]=b;else U.push([a,b])}
      for(let t=0;t<=L;t+=6)for(const o of [-hw,-hw/2,0,hw/2,hw]){const x=ax+(bx-ax)*t/L+nx*o-c.x,y=ay+(by-ay)*t/L+ny*o-c.y;let u=x*c.ca+y*c.sa,v=-x*c.sa+y*c.ca;if(c.cv)[u,v]=cU(c,x+c.x,y+c.y);
        const bi=bsr(c.us,u),bj=bsr(c.vs,v);if(bi>=0&&bj>=0&&bi<BD&&bj<BD){let k=bj*BD+bi;if(c.ms&&c.ms[k]>=0)k=c.ms[k];if(bl[k])bl[k]=20}}}
    for(const e of [0,r.n-1])for(let q=0;q<16;q++){const a=q/16*TAU;for(const rr of [hw*0.6,hw]){const x=r.pts[e*2]+M.cos(a)*rr-c.x,y=r.pts[e*2+1]+M.sin(a)*rr-c.y;let u=x*c.ca+y*c.sa,v=-x*c.sa+y*c.ca;if(c.cv)[u,v]=cU(c,x+c.x,y+c.y);
      const bi=bsr(c.us,u),bj=bsr(c.vs,v);if(bi>=0&&bj>=0&&bi<BD&&bj<BD){let k=bj*BD+bi;if(c.ms&&c.ms[k]>=0)k=c.ms[k];if(bl[k])bl[k]=20}}}}
for(const r of roads){if(r.city!==undefined||r.k===8)continue;
  for(const c of queryF(r.bb[0],r.bb[1],r.bb[2],r.bb[3])){if(c.kind!=='city'||c.type<1)continue;throughClear(r,c)}}
// every road over water gets its bridges (also connectors, ramps and avenues added late)
for(const r of roads)if(!r._b&&r.k!==8)bridgesOf(r);
// boulevards: where another road crosses, the median strip and its trees are interrupted (r.xs = [s, half gap])
for(const r of roads){if(r.k!==7)continue;const xs=[];for(const o of queryRoads(r.bb[0]-5,r.bb[1]-5,r.bb[2]+5,r.bb[3]+5)){if(o===r||o.k===8||o.k===5)continue;
  for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],ex=r.pts[i*2+2]-ax,ey=r.pts[i*2+3]-ay,li=M.hypot(ex,ey);for(let j=0;j<o.n-1;j++){const cx=o.pts[j*2],cy=o.pts[j*2+1],fx=o.pts[j*2+2]-cx,fy=o.pts[j*2+3]-cy;
    const den=ex*fy-ey*fx;if(M.abs(den)<1e-9)continue;const t=((cx-ax)*fy-(cy-ay)*fx)/den,u=((cx-ax)*ey-(cy-ay)*ex)/den;if(t<-0.01||t>1.01||u<-0.01||u>1.01)continue;
    const sin=M.abs(den)/(li*M.hypot(fx,fy));xs.push([r.cum[i]+t*li,RW[o.k]/2/M.max(0.3,sin)+7])}}}
  if(xs.length){xs.sort((a,b)=>a[0]-b[0]);r.xs=xs}}
// at-grade junction zones (r.jz): where a road runs over another road's carriageway (a crossing, or the end of
// a road that joins another), its markings and tyre tracks are left out so junctions read as one clean surface;
// r.inC: stretches of rural roads inside towns (no grass verge there)
{const onOv=(r,s)=>{if(!r.ov)return false;for(const o of r.ov)if(s>o[0]-2&&s<o[1]+2)return true;return false};
 const JZ=new Map();const jpush=(r,iv)=>{let a=JZ.get(r);if(!a)JZ.set(r,a=[]);a.push(iv)};
 for(const r of roads){if(r.k===8||r.k===5)continue;
  for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],ex=r.pts[i*2+2]-ax,ey=r.pts[i*2+3]-ay,li=M.hypot(ex,ey)||1;const sx0=M.min(ax,ax+ex),sx1=M.max(ax,ax+ex),sy0=M.min(ay,ay+ey),sy1=M.max(ay,ay+ey);
    for(const o of queryRoads(sx0-2,sy0-2,sx1+2,sy1+2)){if(o.id<=r.id||o.k===8||o.k===5)continue; // each pair once, both roads get their zone
      if(o.bb[0]>sx1||o.bb[2]<sx0||o.bb[1]>sy1||o.bb[3]<sy0)continue;
      for(let j=0;j<o.n-1;j++){const cx=o.pts[j*2],cy=o.pts[j*2+1],fx=o.pts[j*2+2]-cx,fy=o.pts[j*2+3]-cy;if(M.max(cx,cx+fx)<sx0||M.min(cx,cx+fx)>sx1||M.max(cy,cy+fy)<sy0||M.min(cy,cy+fy)>sy1)continue;const lj=M.hypot(fx,fy)||1;const den=ex*fy-ey*fx;if(M.abs(den)<1e-9)continue;
        const t=((cx-ax)*fy-(cy-ay)*fx)/den,u=((cx-ax)*ey-(cy-ay)*ex)/den;if(t<0||t>1||u<0||u>1)continue;const sr=r.cum[i]+t*li,so=o.cum[j]+u*lj;if(onOv(r,sr)||onOv(o,so))continue;
        const sn=M.max(0.25,M.abs(den)/(li*lj)),hr=RW[o.k]/2/sn+0.6,ho=RW[r.k]/2/sn+0.6;jpush(r,[sr-hr,sr+hr]);jpush(o,[so-ho,so+ho])}}}}
 for(const r of roads){if(r.k===8||r.k===5)continue;const J=JZ.get(r)||[];
  for(const e of [0,1]){const x=e?r.pts[r.n*2-2]:r.pts[0],y=e?r.pts[r.n*2-1]:r.pts[1];
    for(const o of queryRoads(x-20,y-20,x+20,y+20)){if(o===r||o.k===8||o.k===5||x<o.bb[0]-20||x>o.bb[2]+20||y<o.bb[1]-20||y>o.bb[3]+20)continue;const q=projOn(o,x,y),d=M.hypot(q[0]-x,q[1]-y);if(d>RW[o.k]/2+1)continue;
      const so=nearestS(o,x,y)[1];if(onOv(o,so))continue;const pa=posAt(r,e?r.L-1:1),pb=posAt(o,so);const sn=M.max(0.3,M.abs(pa[2]*pb[3]-pa[3]*pb[2]));const ext=(RW[o.k]/2+d)/sn+0.6;J.push(e?[r.L-ext,r.L+1]:[-1,ext])}}
  if(J.length){J.sort((a,b)=>a[0]-b[0]);const m=[J[0].slice()];for(let q=1;q<J.length;q++){const l=m[m.length-1];if(J[q][0]<=l[1])l[1]=M.max(l[1],J[q][1]);else m.push(J[q].slice())}r.jz=m}}
 for(const r of roads){if(r.city!==undefined||(r.k!==0&&r.k!==1&&r.k!==4))continue;const I=[];let st=-1;
  for(let s=0;s<=r.L;s+=15){const p=posAt(r,s);let inC=false;for(const c of queryF(p[0]-1,p[1]-1,p[0]+1,p[1]+1))if(c.kind==='city'&&c.type>=1&&cityF(c,p[0],p[1])<1.02){inC=true;break}
    if(inC&&st<0)st=M.max(0,s-15);if(!inC&&st>=0){I.push([st,s]);st=-1}}if(st>=0)I.push([st,r.L]);if(I.length)r.inC=I}}
// zone objects never stand on roads that cross the zone (fallback placement, later access roads): drop them
for(const z of zones){const P=z.prims;if(!P||z.zk==='air')continue;const keep=[];let cut=0;
  for(const p of P){let w=0,h=0,cx=0,cy=0;const k=p.k;
    if(k==='b'||k==='pk'||k==='cont'||k==='bund'){w=p.w;h=p.h;cx=p.x+w/2;cy=p.y+h/2}else if(k==='cyl'||k==='pile'){w=h=p.r*2;cx=p.x;cy=p.y}else if(k==='t'){w=h=p.d*0.8;cx=p.x;cy=p.y}else if(k==='pipe'&&p.gr&&p.n===2){w=h=4;cx=p.pts[0];cy=p.pts[1]} // tank stub follows its tank
    if(w){const x=z.x+cx*z.ca-cy*z.sa,y=z.y+cx*z.sa+cy*z.ca;
      if(roadHits(x,y,z.ang+(p.a||0),w,h,2,null)){cut++;if(k==='cyl'&&p.H)dropEmit(z,p);continue}}
    keep.push(p)}
  if(cut)z.prims=keep}
// wind farms
if(!EMPTY){const CELL=7000,NC=M.floor(WORLD/CELL);for(let cy=0;cy<NC;cy++)for(let cx=0;cx<NC;cx++){const R=rng(hh(cx,cy,313));if(R()>0.3)continue;
  const x=(cx+0.2+0.6*R())*CELL,y=(cy+0.2+0.6*R())*CELL;const e=landE(x,y,0.01);if(e<0.03||e>0.3)continue;
  let bad=false;for(const c of live){if(M.hypot(c.x-x,c.y-y)<c.R+700){bad=true;break}}for(const z of zones){if(M.hypot(z.x-x,z.y-y)<z.rad+700){bad=true;break}}if(bad)continue;const a=R()*PI,ca=M.cos(a),sa=M.sin(a);const rows=2+(R()*2|0),per=4+(R()*4|0);const tb=[];
  for(let r=0;r<rows;r++)for(let k=0;k<per;k++){const u=(k-(per-1)/2)*380,v=(r-(rows-1)/2)*620+(k%2)*60;const px=x+u*ca-v*sa,py=y+u*sa+v*ca;
    if(landE(px,py,0.006)<0||roadHits(px,py,0,24,24,4,null))continue;let inC=false;for(const c of live){if(M.hypot(c.x-px,c.y-py)<c.R*1.2+250){inC=true;break}}if(inC)continue;
    tb.push({x:px,y:py,ph:R()*TAU,sp:1.1+R()*0.5})}
  if(tb.length<3)continue;const f={kind:'farm',t:tb,bb:[x-2200,y-2200,x+2200,y+2200]};farms.push(f);addF(f,f.bb[0],f.bb[1],f.bb[2],f.bb[3])}}

// ------- zone content (local coords, x along zone axis)
function G(P,x,y,w,h,c){P.push({k:'g',x,y,w,h,c})}
function B(P,x,y,w,h,H,c,r,ex){const o={k:'b',x,y,w,h,H,c,r};if(ex)for(const q in ex)o[q]=ex[q];P.push(o);return o}
function TR(P,x,y,d,v){P.push({k:'t',x,y,d,v})}
function CY(P,x,y,r,H,c,st){P.push({k:'cyl',x,y,r,H,c,st})}
function LN(P,pts,w,c,dash){P.push({k:'gl',pts,w,c,dash})}
function PK(P,x,y,w,h,fill,seed,truck){P.push({k:'pk',x,y,w,h,fill,seed,truck})}
function zemit(z,lx,ly,k,s,H){H=H||0;emitters.push({x:z.x+lx*z.ca-ly*z.sa+LEANX*H,y:z.y+lx*z.sa+ly*z.ca+LEANY*H,k,s,H,ph:hr(lx|0,ly|0,z.id),city:z.city?z.city.id:-1,zid:z.id})}
function genZone(z){
  const R=rng(z.seed),P=[],W=z.W,H=z.H;z.prims=P;
  const ASP=[78,80,84],CON=[160,158,152],GRV=[150,146,136];
  if(z.zk==='ind'){
    G(P,-W/2,-H/2,W,H,[142,139,130]);
    const nx=M.max(2,M.round(W/230)),ny=M.max(2,M.round(H/210)),cw=W/nx,ch=H/ny;
    for(let i=0;i<=nx;i++)LN(P,[-W/2+i*cw,-H/2,-W/2+i*cw,H/2],9,ASP);for(let j=0;j<=ny;j++)LN(P,[-W/2,-H/2+j*ch,W/2,-H/2+j*ch],9,ASP);
    P.push({k:'rail',pts:[-W/2,-H/2+ch-12,W/2,-H/2+ch-12]});
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x0=-W/2+i*cw+9,y0=-H/2+j*ch+9,w=cw-18,h=ch-18;const r=R();
      if(r<0.38){const c=ROOF_IND[R()*ROOF_IND.length|0];const bw=w*(0.72+R()*0.2),bh=h*(0.55+R()*0.3);B(P,x0+4,y0+4,bw,bh,9+R()*6,c,'co',{dk:[2,1],dkt:w-bw-4>=21});
        PK(P,x0+4,y0+bh+10,M.min(bw,w-8),M.min(16,h-bh-14),0.7,R()*1e9|0,1)}
      else if(r<0.66){G(P,x0,y0,w,h,CON);P.push({k:'lflood',x:x0,y:y0,w,h,sp:70,r:24,c:'sod'});const n=2+(R()*3|0);for(let q=0;q<n;q++){const bw=w*(0.25+R()*0.35),bh=h*(0.25+R()*0.35);const bx=x0+R()*(w-bw),by=y0+R()*(h-bh);B(P,bx,by,bw,bh,8+R()*20,ROOF_IND[R()*7|0],R()<0.5?'co':'f',{fac:1,gate:2})}
        const nc=1+(R()*2|0);for(let q=0;q<nc;q++){const cx=x0+10+R()*(w-20),cy=y0+10+R()*(h-20),H2=50+R()*70;CY(P,cx,cy,2.5+R()*2,H2,[180,70,60],'chim');zemit(z,cx,cy,'smoke',0.7+R()*0.6,H2)}
        if(R()<0.5)for(let q=0;q<3;q++)CY(P,x0+w-14-q*16,y0+h-14,6,10,[200,200,198],'tank')}
      else if(r<0.8){PK(P,x0,y0,w,h,0.55,R()*1e9|0,1)}
      else if(r<0.86){G(P,x0,y0,w,h,CON);const n=M.max(3,M.floor((w-20)/12));for(let q=0;q<n;q++)for(let rr2=0;rr2<2;rr2++)CY(P,x0+12+q*12,y0+h*0.35+rr2*12,5.6,34,[208,204,196],'tank');P.push({k:'pipe',pts:[x0+14,y0+h*0.35+20,x0+12+(n-1)*12,y0+h*0.35+20],n:2,w:1.4,gr:1});B(P,x0+6,y0+h*0.35-10,8,30,48,[200,196,188],'f');PK(P,x0+6,y0+h-20,w-12,14,0.5,R()*1e9|0,1)}
      else if(r<0.92){G(P,x0,y0,w,h,GRV);for(let q=0;q<5;q++)P.push({k:'pile',x:x0+20+R()*(w-40),y:y0+20+R()*(h-40),r:10+R()*16,c:[[60,58,56],[190,170,130],[150,140,125],[120,80,60]][R()*4|0]})}
      else{G(P,x0,y0,w,h,CON);for(let a=0;a<2;a++)for(let b=0;b<2;b++)CY(P,x0+w*0.3+a*w*0.4,y0+h*0.3+b*h*0.4,M.min(w,h)*0.14,14,[210,210,205],'tank')}}
    for(let q=0;q<30;q++)TR(P,(R()-0.5)*W,(R()<0.5?-1:1)*(H/2-4),5+R()*4,R()*6|0);
  }else if(z.zk==='ref'){
    G(P,-W/2,-H/2,W,H,[166,160,146]);
    LN(P,[-W/2,0,W/2,0],10,ASP);LN(P,[-W*0.12,-H/2,-W*0.12,H/2],10,ASP);LN(P,[W*0.2,-H/2,W*0.2,H/2],9,ASP);
    // tank farm
    const tx0=-W/2+30,tx1=-W*0.12-30;const sp=78;
    for(let y=-H/2+50;y<H/2-40;y+=sp){if(M.abs(y)<45)continue;const cy=y+(y<0?sp/2:-sp/2);let xe=null;
      for(let x=tx0+40;x<tx1-20;x+=sp){const r=22+R()*12;G(P,x-sp/2+4,y-sp/2+4,sp-8,sp-8,[154,150,136]);P.push({k:'bund',x:x-sp/2+4,y:y-sp/2+4,w:sp-8,h:sp-8});
        CY(P,x,y,r,16,R()<0.8?[214,214,210]:[90,92,96],'tank');P.push({k:'pipe',pts:[x+r*0.3,y+(y<0?r:-r)*0.95,x+r*0.3,cy],n:2,w:1.6,gr:1});xe=x}
      if(xe!==null)P.push({k:'pipe',pts:[tx0+40,cy,-W*0.12-8,cy],n:3,w:2.4,gr:1})}
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
  }else if(z.zk==='saw'){ // sawmill (stage 5.6): log deck in rows, debarker and saw hall on a conveyor, drying kilns, stacked boards, timber trucks
    G(P,-W/2,-H/2,W,H,[126,114,92]);P.push({k:'fence',x:-W/2+2,y:-H/2+2,w:W-4,h:H-4});
    const dx0=-W/2+12,dw=W*0.36;G(P,dx0,-H/2+12,dw,H-24,[112,100,78]);for(let y=-H/2+18;y<H/2-18;y+=11)P.push({k:'logs',x:dx0+4,y,w:dw-8,h:8,seed:R()*1e9|0});
    const hx=dx0+dw+16;B(P,hx,-H/2+20,W*0.26,H*0.34,12,[150,152,150],'co',{fac:1,gate:2});P.push({k:'pipe',pts:[dx0+dw,-H/2+20+H*0.17,hx,-H/2+20+H*0.17],n:1,w:2.2,gr:1});
    B(P,hx,-H/2+30+H*0.34,W*0.12,H*0.18,6,[168,124,84],'g');CY(P,hx+W*0.2,-H/2+34+H*0.34,2.2,22,[170,70,60],'chim');zemit(z,hx+W*0.2,-H/2+34+H*0.34,'smoke',0.35,22);
    const kx=W/2-12-W*0.18;for(let q=0;q<3;q++)B(P,kx,-H/2+16+q*26,W*0.18,20,6,[132,136,140],'co');
    for(let q=0;q<5;q++)for(let r2=0;r2<2;r2++)P.push({k:'boards',x:kx+r2*W*0.09,y:H*0.02+q*16,w:W*0.08,h:12,seed:R()*1e9|0});
    PK(P,hx,H/2-26,W*0.3,14,0.7,R()*1e9|0,1);
  }else if(z.zk==='oil'){ // oil well pad (stage 5.6): four pump jacks, flowlines on supports to a manifold, separator, tank battery, flare, tanker bay
    G(P,-W/2,-H/2,W,H,[150,144,126]);P.push({k:'fence',x:-W/2+1.5,y:-H/2+1.5,w:W-3,h:H-3});
    const J=[[-W*0.34,-H*0.3,0.25],[-W*0.08,-H*0.32,-0.2],[-W*0.36,H*0.06,0.5],[-W*0.1,H*0.1,-0.4]],mx=W*0.12,my=-H*0.02;
    for(const [x,y,a] of J){G(P,x-9,y-6,18,12,[166,160,148]);P.push({k:'pjack',x,y,a,c:R()*3|0});P.push({k:'pipe',pts:[x+4,y+3,mx,my],n:1,w:0.35,gr:1})}
    B(P,mx-3,my-4,6,8,1.5,[150,150,146],'f',{nd:1});
    const bx=W*0.2,by=-H*0.38;G(P,bx-4,by-3,W*0.28,26,[160,154,140]);P.push({k:'bund',x:bx-4,y:by-3,w:W*0.28,h:26});for(let q=0;q<3;q++)CY(P,bx+5+q*10.5,by+10,4.2,7,[q===1?118:206,q===1?120:200,q===1?122:188],'tank');
    B(P,bx-2,my+6,15,4,2.6,[222,216,202],'f',{nd:1});B(P,bx+18,my+4,7,7,3.5,[176,180,184],'f');B(P,bx+18,H*0.22,10,7,3,[200,198,190],'g',{rc:[120,60,50]});
    P.push({k:'pipe',pts:[mx+3,my,bx-2,my+8],n:2,w:0.5,gr:1},{k:'pipe',pts:[bx+6,my+6,bx+6,by+20],n:2,w:0.5,gr:1});
    CY(P,W/2-8,H/2-10,0.9,14,[200,60,50],'chim');zemit(z,W/2-8,H/2-10,'flare',0.45,14);P.push({k:'pipe',pts:[bx+22,my+8,W/2-8,H/2-10],n:1,w:0.3,gr:1});
    G(P,-W*0.42,H*0.3,34,H*0.16,[136,130,116]);PK(P,-W*0.4,H*0.32,30,8,0.8,R()*1e9|0,1);
  }else if(z.zk==='sam'){ // air defence battery (stage 5.6): no platform — launchers in earth revetments, radar, command vehicle on the grass
    const cam=R()*3|0;
    for(let q=0;q<4;q++){const a=q*PI/2+PI/4,x=M.cos(a)*W*0.32,y=M.sin(a)*H*0.32;P.push({k:'berm',x,y,r:11,a:a+PI});P.push({k:'veh',x,y,a:a+PI,v:3,c:cam})}
    P.push({k:'berm',x:0,y:0,r:9,a:0});P.push({k:'dome',x:0,y:0,r:4.5,c:[232,232,226],H:7,lvl:3,drum:[150,154,140]});P.push({k:'veh',x:W*0.05,y:H*0.36,a:0,v:4,c:cam});P.push({k:'veh',x:-W*0.16,y:H*0.36,a:0,v:4,c:cam});
    P.push({k:'gl',pts:[-W/2,H*0.36,W/2,H*0.36],w:3,c:[136,124,98]});
  }else if(z.zk==='ref2'){ // refinery of the game (stage 5.6): roads around and across, units in cells that never touch a road
    G(P,-W/2,-H/2,W,H,[164,158,144]);const RD=[166,162,154],X1=-W*0.12,Y1=0,ed=14;
    LN(P,[-W/2+ed,-H/2+ed,W/2-ed,-H/2+ed,W/2-ed,H/2-ed,-W/2+ed,H/2-ed,-W/2+ed,-H/2+ed],8,ASP);LN(P,[-W/2+ed,Y1,W/2-ed,Y1],10,ASP);LN(P,[X1,-H/2+ed,X1,H/2-ed],10,ASP);
    const cell=(x0,y0,x1,y1)=>[x0+12,y0+12,x1-12,y1-12];const Q=[cell(-W/2+ed+5,-H/2+ed+5,X1-5,Y1-5),cell(-W/2+ed+5,Y1+5,X1-5,H/2-ed-5),cell(X1+5,-H/2+ed+5,W/2-ed-5,Y1-5),cell(X1+5,Y1+5,W/2-ed-5,H/2-ed-5)];
    // tank farms (west)
    for(const [a0,b0,a1,b1] of Q.slice(0,2)){const sp=74,nx=M.floor((a1-a0)/sp),ny=M.floor((b1-b0)/sp),ox=a0+((a1-a0)-nx*sp)/2,oy=b0+((b1-b0)-ny*sp)/2;
      for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=ox+i*sp,y=oy+j*sp;G(P,x+3,y+3,sp-6,sp-6,[150,146,132]);P.push({k:'bund',x:x+3,y:y+3,w:sp-6,h:sp-6});const r=20+R()*9;CY(P,x+sp/2,y+sp/2,r,15,R()<0.75?[216,216,212]:[92,94,98],'tank')}
      P.push({k:'pipe',pts:[ox,oy+ny*sp+4,a1,oy+ny*sp+4],n:3,w:2,gr:1})}
    // process units (east): platform, columns, furnaces, a pipe rack; all inside its cell
    for(const [a0,b0,a1,b1] of Q.slice(2)){const uw=134,uh=104,g=14,nx=M.max(1,M.floor((a1-a0+g)/(uw+g))),ny=M.max(1,M.floor((b1-b0+g)/(uh+g))),ox=a0+((a1-a0)-(nx*uw+(nx-1)*g))/2,oy=b0+((b1-b0)-(ny*uh+(ny-1)*g))/2;
      for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=ox+i*(uw+g),y=oy+j*(uh+g);G(P,x,y,uw,uh,[176,176,172]);P.push({k:'lflood',x,y,w:uw,h:uh,sp:44,r:16,c:'sod'});
        P.push({k:'pipe',pts:[x+4,y+uh*0.48,x+uw-4,y+uh*0.48],n:5,w:6});
        const nc=2+(R()*3|0);for(let q=0;q<nc;q++)CY(P,x+16+q*(uw-32)/M.max(1,nc-1),y+18+R()*12,2.6+R()*2.4,34+R()*40,[204,204,206],'tower');
        B(P,x+8,y+uh*0.62,uw*0.36,uh*0.3,8+R()*6,ROOF_IND[R()*7|0],'f');B(P,x+uw*0.52,y+uh*0.62,uw*0.4,uh*0.3,7+R()*6,ROOF_IND[R()*7|0],'f');
        if(R()<0.5){CY(P,x+uw-10,y+12,2.8,55,[180,70,60],'chim');zemit(z,x+uw-10,y+12,'smoke',0.5,55)}}}
    // flare stacks, control room, truck loading at the gate
    const fx=W/2-ed-26;for(let q=0;q<2;q++){const fy=-H/2+ed+30+q*36;CY(P,fx,fy,2,85,[190,60,50],'chim');zemit(z,fx,fy,'flare',1,85)}
    B(P,X1-58,Y1+16,40,22,9,[210,206,196],'f');PK(P,-W/2+ed+16,Y1+12,80,16,0.7,R()*1e9|0,1);
    P.push({k:'pipe',pts:[-W/2+ed+8,Y1-12,W/2-ed-8,Y1-12],n:6,w:7});P.push({k:'pipe',pts:[X1-12,-H/2+ed+8,X1-12,H/2-ed-8],n:4,w:6});
  }else if(z.zk==='mil'){ // military base of a capital (stage 5): HQ with the state flags, barracks, motor pool, helipads, air defence, range
    const fl=z.city&&z.city.fl,cam=R()*3|0,X0=-W/2,Y0=-H/2;const cx1=-W*0.18,cx2=W*0.2;
    G(P,X0,Y0,W,H,[110,122,82]);P.push({k:'mow',x:X0,y:Y0,w:W,h:H});
    LN(P,[X0+3,Y0+3,W/2-3,Y0+3,W/2-3,H/2-3,X0+3,H/2-3,X0+3,Y0+3],1.4,[158,156,150]);LN(P,[X0+9,Y0+9,W/2-9,Y0+9,W/2-9,H/2-9,X0+9,H/2-9,X0+9,Y0+9],0.35,[120,124,120],1);
    for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])B(P,a*(W/2-10)-3,b*(H/2-10)-3,6,6,9,[128,130,116],'f');
    LN(P,[X0,0,W/2-12,0],11,ASP);LN(P,[cx1,Y0+10,cx1,H/2-10],8,ASP);LN(P,[cx2,Y0+10,cx2,H/2-10],8,ASP);
    // checkpoint at the gate (both short sides; the access road comes to one of them)
    for(const sd of [-1,1]){B(P,sd*(W/2-22)-6,9,12,8,4.5,[206,202,192],'f');G(P,sd*(W/2-16)-1,-5.5,2,11,[214,64,52])}
    // HQ, flags and the parade ground (north-west)
    B(P,X0+40,Y0+36,84,24,14,[220,212,196],'h',{rc:[118,64,52],gf:[-1,-1,2]});
    G(P,X0+40,Y0+68,84,10,PAVE);if(fl)for(let q=0;q<3;q++)P.push({k:'flag',x:X0+62+q*20,y:Y0+73,H:15+(q===1?3:0),fl});
    {const px=X0+40,py=Y0+92,pw=cx1-X0-60,ph=-py-22;G(P,px,py,pw,ph,[86,88,92]);P.push({k:'gl',pts:[px+6,py+6,px+pw-6,py+6,px+pw-6,py+ph-6,px+6,py+ph-6,px+6,py+6],w:0.4,c:[230,230,222]});
      for(let y=py+18;y<py+ph-10;y+=14)LN(P,[px+20,y,px+pw-20,y],0.3,[226,226,220],1)}
    // barracks, mess hall and a sports field (north, centre)
    {const bx0=cx1+16,bx1=cx2-16,bw=(bx1-bx0-14)/2;const rc=ROOFP[R()*ROOFP.length|0];
      for(let q=0;q<4;q++)for(let c2=0;c2<2;c2++){const by=Y0+28+q*31;B(P,bx0+c2*(bw+14),by,bw,17,11,rc,'g',{gf:[-1,2,-1]});P.push({k:'path',x:bx0+c2*(bw+14)+bw*0.25,y:by+17,w:3,h:5},{k:'path',x:bx0+c2*(bw+14)+bw*0.7,y:by+17,w:3,h:5})}
      B(P,bx0,Y0+156,bw*0.9,26,8,[184,180,170],'f');P.push({k:'field',x:bx0+bw+14,y:Y0+152,w:M.min(bw,105),h:M.min(-Y0-170,66)})}
    // helipads with attack helicopters, an air-defence site with a radar (north-east)
    {const hx0=cx2+30;for(let q=0;q<3;q++){const x=hx0+20+q*52,y=Y0+50;P.push({k:'helipad',x,y,r:15,mil:1});if(q<2)P.push({k:'veh',x,y,a:-PI/2+0.3*(q-0.5),v:5,c:cam})}
      B(P,hx0+8,Y0+82,120,22,10,[150,156,150],'co',{fac:1});
      const ax=W/2-110,ay=Y0+170;G(P,ax-62,ay-52,124,104,[134,130,110]);P.push({k:'dome',x:ax,y:ay,r:6.5,c:[236,236,232],H:13,lvl:3,drum:[176,178,172]});
      for(let q=0;q<4;q++){const a=q*PI/2+PI/4;P.push({k:'veh',x:ax+M.cos(a)*36,y:ay+M.sin(a)*34,a:a+PI,v:3,c:cam})}}
    // fuel depot and stores (south-west)
    {for(let q=0;q<3;q++)for(let r2=0;r2<2;r2++)CY(P,X0+50+q*24,30+r2*24,8,9,[198,198,190],'tank');P.push({k:'bund',x:X0+36,y:16,w:76,h:52});
      for(let q=0;q<3;q++)B(P,X0+40+q*44,92,34,52,8,ROOF_IND[R()*7|0],'co');PK(P,X0+40,160,120,14,0.6,R()*1e9|0,1)}
    // motor pool: vehicle sheds and rows of armour on a concrete pad (south, centre)
    {const mx0=cx1+14,mx1=cx2-14,mw=mx1-mx0;G(P,mx0,14,mw,H/2-34,CON);P.push({k:'lflood',x:mx0,y:14,w:mw,h:H/2-34,sp:60,r:22,c:'sod'});
      const ns=M.floor(mw/96);for(let q=0;q<ns;q++)B(P,mx0+4+q*96,H/2-48,90,26,8,[120,128,112],'co',{fac:1,gate:0});
      const rows=[[0,9],[0,9],[1,7.6],[2,6.2],[4,4.2]];let y=30;for(const [v,sp] of rows){P.push({k:'gl',pts:[mx0+8,y-(v===4?6:9),mx1-6,y-(v===4?6:9)],w:0.25,c:[226,206,90]});for(let x=mx0+10;x<mx1-8;x+=sp){if(R()<0.08)continue;P.push({k:'veh',x:x+sp/2-1,y:y,a:PI/2,v,c:cam})}y+=v===4?18:21}}
    // training ground with berms and track loops (south-east), two tanks on the move
    {const tx=cx2+16,tw=W/2-16-tx,ty=14,th=H/2-30;G(P,tx,ty,tw,th,[150,132,98]);
      for(let q=0;q<3;q++)P.push({k:'gl',pts:[tx+20+q*10,ty+30+q*12,tx+tw-30,ty+40+q*8,tx+tw-40,ty+th-30-q*10,tx+30,ty+th-40,tx+20+q*10,ty+30+q*12],w:3.2,c:[124,104,76]});
      for(let q=0;q<7;q++)P.push({k:'pile',x:tx+30+R()*(tw-60),y:ty+30+R()*(th-60),r:6+R()*7,c:[132,112,82]});
      P.push({k:'veh',x:tx+tw*0.45,y:ty+34,a:0.1,v:0,c:cam});P.push({k:'veh',x:tx+tw-36,y:ty+th*0.55,a:PI/2+0.15,v:0,c:cam})}
    for(let q=0;q<46;q++){const sd=q%4;const t=R();let x,y;if(sd<2){x=X0+16+t*(W-32);y=sd?H/2-15:Y0+15}else{y=Y0+16+t*(H-32);x=sd===2?W/2-15:X0+15}if(M.abs(y)<16)continue;TR(P,x,y,5+R()*4,R()*6|0)}
  }else if(z.zk==='sol2'){ // solar panels of the game (stage 5.7): rows of tilted modules on racks, a battery container, an inverter
    G(P,-W/2,-H/2,W,H,[148,146,132]);P.push({k:'fence',x:-W/2+1,y:-H/2+1,w:W-2,h:H-2});
    for(let y=-H/2+4;y<H/2-9;y+=6.4)P.push({k:'pv',x:-W/2+4,y,w:W-26,h:3.8});
    B(P,W/2-19,-H/2+5,14,6,2.7,[222,224,226],'f',{nd:1});B(P,W/2-17,-H/2+15,7,4.5,2.2,[178,184,190],'f');B(P,W/2-17,-H/2+23,5,3,1.8,[96,104,112],'f',{nd:1});
    P.push({k:'gl',pts:[-W/2+3,H/2-4,W/2-3,H/2-4],w:2.2,c:[156,150,134]});
  }else if(z.zk==='mine'){ // mine of the game (stage 5.7): open pit with benches, headframe over the shaft, conveyor to the crusher, ore stockpiles
    const O=z.o||{},oc=[[48,46,46],[60,56,54],[52,50,50],[150,84,58],[96,138,116],[192,170,118],[150,160,96],[226,224,214]][O.ore|0]||[120,110,100];
    G(P,-W/2,-H/2,W,H,[150,138,116]);P.push({k:'fence',x:-W/2+2,y:-H/2+2,w:W-4,h:H-4});
    P.push({k:'quarry',x:-W*0.2,y:H*0.04,rx:W*0.26,ry:H*0.36,seed:R()*1e9|0,c:oc});
    const hx=W*0.16,hy=-H*0.24;G(P,hx-18,hy-16,36,32,[136,134,128]);P.push({k:'hframe',x:hx,y:hy,a:0,H:34});B(P,hx+20,hy-9,22,18,12,[150,154,150],'co',{fac:1});
    const cx2=W*0.34,cy2=H*0.12;B(P,cx2-12,cy2-10,24,20,16,[166,160,148],'co');P.push({k:'conv',pts:[hx+5,hy+16,cx2-6,cy2-10],H:9});P.push({k:'conv',pts:[cx2+8,cy2+10,cx2+20,H/2-30],H:7});
    for(let q=0;q<4;q++)P.push({k:'pile',x:W*0.2+q*20,y:H/2-24-(q%2)*8,r:9+R()*5,c:oc});
    B(P,-W/2+10,-H/2+10,30,14,7,[204,200,190],'f',{gf:[-1,2,-1]});PK(P,-W/2+10,-H/2+30,40,12,0.6,R()*1e9|0,1);
    P.push({k:'lflood',x:-W*0.42,y:-H*0.32,w:W*0.84,h:H*0.7,sp:70,r:24,c:'sod'});CY(P,cx2+14,cy2-16,1.6,24,[170,70,60],'chim');zemit(z,cx2+14,cy2-16,'smoke',0.35,24);
  }else if(z.zk==='gasw'){ // gas well of the game (stage 5.7): wellhead in a cellar, separator, glycol unit, compressor, flare
    G(P,-W/2,-H/2,W,H,[158,152,136]);P.push({k:'fence',x:-W/2+1.5,y:-H/2+1.5,w:W-3,h:H-3});
    const wx=-W*0.3,wy=-H*0.1;G(P,wx-9,wy-9,18,18,[176,172,162]);P.push({k:'wellhd',x:wx,y:wy});
    B(P,-W*0.05,-H*0.32,30,7,3.2,[226,222,212],'f',{nd:1});B(P,-W*0.05,-H*0.12,12,12,6,[190,196,200],'f');CY(P,W*0.06,-H*0.06,3.2,16,[214,214,210],'tower');
    B(P,W*0.18,-H*0.36,26,16,7,[150,158,152],'co',{fac:1});for(let q=0;q<3;q++)CY(P,W*0.18+q*9,H*0.14,3.6,6,[208,204,196],'tank');
    P.push({k:'pipe',pts:[wx+3,wy,-W*0.05,-H*0.29],n:1,w:0.6,gr:1},{k:'pipe',pts:[W*0.0,-H*0.25,W*0.18,-H*0.28],n:2,w:0.6,gr:1},{k:'pipe',pts:[W*0.06,-H*0.06,W*0.18,H*0.14],n:1,w:0.5,gr:1});
    CY(P,W/2-10,H/2-12,1.1,22,[200,60,50],'chim');zemit(z,W/2-10,H/2-12,'flare',0.6,22);P.push({k:'pipe',pts:[W*0.2,H*0.14,W/2-10,H/2-12],n:1,w:0.35,gr:1});
    PK(P,-W/2+8,H/2-18,34,10,0.7,R()*1e9|0,1);P.push({k:'lflood',x:-W*0.4,y:-H*0.4,w:W*0.8,h:H*0.8,sp:50,r:18,c:'sod'});
  }else if(z.zk==='rst'){ // railway station of the game (stage 5.7): the main line runs along the axis (it is the rail road itself),
    // two loops beside it, island platforms with canopies, the station hall and a car park on the town side
    G(P,-W/2,-H/2,W,H,[134,130,122]);for(const y of [-10,0,10])P.push({k:'rail',pts:[y?-W/2+6:-W/2,y,y?W/2-6:W/2,y]});
    for(const y of [-5,5]){G(P,-W*0.36,y-1.7,W*0.72,3.4,[180,178,172]);B(P,-W*0.32,y-1.4,W*0.64,2.8,4.6,[146,156,164],'co',{nd:1})}
    G(P,-W/2,15,W,H/2-15,[140,136,128]);B(P,-28,18,56,13,11,[164,108,84],'h',{fc:[232,220,196],gf:[-1,2,-1]});B(P,-7,18,14,13,17,[164,108,84],'h',{fc:[232,220,196],lvl:1});
    PK(P,-W/2+14,19,70,11,0.7,R()*1e9|0);PK(P,W/2-84,19,70,11,0.65,R()*1e9|0);P.push({k:'lflood',x:-W*0.4,y:-12,w:W*0.8,h:24,sp:40,r:16,c:'wled'});
  }else if(z.zk==='dport'){ // drone port (stage 5.7): fenced apron, arched hangar, control post with a mast and a dish, fuel, parked UAVs
    const cam=R()*3|0;G(P,-W/2,-H/2,W,H,[118,126,96]);P.push({k:'mow',x:-W/2,y:-H/2,w:W,h:H});P.push({k:'fence',x:-W/2+2,y:-H/2+2,w:W-4,h:H-4});
    G(P,-W/2+14,-H/2+14,W*0.62,H*0.56,[150,150,146]);P.push({k:'gl',pts:[-W/2+20,-H/2+H*0.42,-W/2+W*0.62+8,-H/2+H*0.42],w:0.35,c:[226,206,90],dash:1});
    B(P,-W/2+20,-H/2+20,56,26,9,[120,128,104],'arc');B(P,-W/2+84,-H/2+20,40,26,8,[128,134,110],'arc');
    for(let q=0;q<4;q++)P.push({k:'uav',x:-W/2+30+q*24,y:-H/2+H*0.53,a:-PI/2,v:q%3===2?2:q%3,c:cam});
    const kx=W*0.22,ky=-H*0.3;B(P,kx,ky,24,14,7,[196,192,178],'f',{gf:[-1,2,-1]});CY(P,kx+32,ky+6,0.8,32,[200,200,204],'tower');P.push({k:'dome',x:kx+32,y:ky+22,r:3.4,c:[236,236,232],H:5,lvl:3,drum:[160,160,150]});
    for(let q=0;q<2;q++)CY(P,W*0.3+q*12,H*0.12,4.2,5,[96,108,84],'tank');P.push({k:'bund',x:W*0.3-7,y:H*0.12-7,w:26,h:14});
    PK(P,W*0.16,H/2-26,60,12,0.6,R()*1e9|0,1);P.push({k:'veh',x:-W/2+40,y:H/2-24,a:0,v:4,c:cam},{k:'veh',x:-W/2+56,y:H/2-24,a:0,v:4,c:cam});
    P.push({k:'lflood',x:-W/2+14,y:-H/2+14,w:W*0.62,h:H*0.56,sp:50,r:20,c:'sod'});
    for(let q=0;q<26;q++){const sd=q%4,t=R();let x,y;if(sd<2){x=-W/2+8+t*(W-16);y=sd?H/2-7:-H/2+7}else{y=-H/2+8+t*(H-16);x=sd===2?W/2-7:-W/2+7}TR(P,x,y,5+R()*4,R()*6|0)}
  }else if(z.zk==='dramp'){ // launch ramp module: two pneumatic catapults on trailers with UAVs on the rails, a generator, a crew van
    const cam=R()*3|0;G(P,-W/2,-H/2,W,H,[128,124,104]);for(const y of [-H*0.22,H*0.22])P.push({k:'cat',x:-W*0.2,y,a:0,len:W*0.62,v:y<0?0:2,c:cam});
    B(P,-W/2+3,-H/2+3,7,5,2.2,[100,110,86],'f',{nd:1});P.push({k:'veh',x:-W/2+12,y:H/2-5,a:0,v:4,c:cam});
  }else if(z.zk==='drwy'){ // runway module: a short paved strip with threshold bars, centre line, edge lights; a jet UAV on the threshold
    G(P,-W/2,-H/2,W,H,[122,132,94]);P.push({k:'mow',x:-W/2,y:-H/2,w:W,h:H});P.push({k:'rw2',x:-W/2+10,y:-9,w:W-20,h:18});
    P.push({k:'uav',x:-W/2+28,y:0,a:0,v:1,c:R()*3|0});G(P,-W/2+10,12,40,12,[150,150,146]);
  }else if(z.zk==='dstore'){ // storage module: two arched stores, containers, a loading pad
    G(P,-W/2,-H/2,W,H,[142,140,132]);P.push({k:'fence',x:-W/2+1.5,y:-H/2+1.5,w:W-3,h:H-3});
    B(P,-W/2+6,-H/2+6,48,22,8,[126,132,116],'arc');B(P,-W/2+6,-H/2+34,48,22,8,[118,126,108],'arc');
    P.push({k:'cont',x:W*0.1,y:-H/2+8,w:W*0.34,h:H-36,seed:R()*1e9|0});PK(P,W*0.06,H/2-16,W*0.38,10,0.6,R()*1e9|0,1);
  }else if(z.zk==='dfab'){ // UAV factory (stage 5.7): assembly halls with sawtooth roofs, a composites shop, offices, a test stand, finished UAVs.
    // upgrades: o.up.sol solar arrays, o.up.net anti-drone nets over the roofs, o.up.con concrete blast walls
    const U=(z.o&&z.o.up)||{},cam=R()*3|0;G(P,-W/2,-H/2,W,H,[146,142,132]);P.push({k:'fence',x:-W/2+2,y:-H/2+2,w:W-4,h:H-4});
    LN(P,[-W/2+10,0,W/2-10,0],9,ASP);LN(P,[W*0.12,-H/2+10,W*0.12,H/2-10],8,ASP);
    const hall=(x,y,w,h,Hh,c)=>{const b=B(P,x,y,w,h,Hh,c,'co',{fac:1,gate:2});if(U.net)b.net=1;if(U.con)P.push({k:'twall',x:x-4,y:y-4,w:w+8,h:h+8})};
    hall(-W/2+18,-H/2+18,150,82,14,[176,182,188]);hall(-W/2+18,10,100,58,11,[164,170,176]);
    const ob=B(P,-W/2+128,14,40,22,13,[196,192,184],'f',{gf:[2,0,-1],sol:!!U.sol});if(U.net)ob.net=1;
    const sb=B(P,W*0.16,-H/2+18,70,38,9,[132,138,124],'arc');if(U.net)sb.net=1;if(U.con)P.push({k:'twall',x:W*0.16-4,y:-H/2+14,w:78,h:46});
    G(P,W*0.16,-H/2+64,W*0.32,H*0.2,[156,156,150]);for(let q=0;q<5;q++)P.push({k:'uav',x:W*0.16+14+q*22,y:-H/2+80,a:-PI/2,v:q<3?0:1,c:cam});
    G(P,W*0.18,16,60,44,[136,134,128]);P.push({k:'helipad',x:W*0.18+30,y:38,r:14,mil:1});P.push({k:'uav',x:W*0.18+30,y:38,a:0.4,v:1,c:cam});
    PK(P,W*0.18+70,16,W/2-W*0.18-84,40,0.65,R()*1e9|0);
    if(U.sol){for(let y=H/2-38;y<H/2-12;y+=6.4)P.push({k:'pv',x:-W/2+16,y,w:110,h:3.8});B(P,-W/2+132,H/2-36,12,6,2.7,[222,224,226],'f',{nd:1})}
    CY(P,-W/2+176,-H/2+26,1.8,22,[170,70,60],'chim');zemit(z,-W/2+176,-H/2+26,'smoke',0.3,22);
    P.push({k:'lflood',x:-W/2+14,y:-H/2+14,w:W-28,h:H-28,sp:60,r:22,c:'sod'});
  }else if(z.zk==='solar'){
    G(P,-W/2,-H/2,W,H,[146,150,112]);P.push({k:'solar',x:-W/2+15,y:-H/2+15,w:W-30,h:H-30});
    B(P,-W/2+4,-H/2+4,14,10,4,[200,200,200],'f');
  }
  if(z.o)zoneFill(z);
  dedupeZone(z);z.prims=dropCrowns(fitGround(z.prims));
}
// ---------- detail of the game's buildings (stage 5.11): the empty parts of a pad get the yard clutter of its trade
// (pallets, containers, pipe stacks, skips, drums, sheds, parked lorries, heaps; hay, herds, silage on a farm; ore heaps
// and tyres at a mine; crates, tents, sandbag rings at military sites). A cell grid of the pad marks what is taken
// (buildings, tanks, heaps, driveways, pipes, rails with a margin); clusters go into free rectangles of it.
const ZFILL={ind:['pal','cont','trk','pipe','skip','drum','shed','kiosk','pile','pal','cont','trees'],pow:['pile','pipe','kiosk','cont','trk','tankS','drum','shed','trees'],ref2:['pipe','drum','tankS','cont','trk','kiosk','pipe'],
  saw:['logs','boards','trk','shed','dust','logs','trees'],farm:['bales','herd','silage','shed','manure','tankS','rows','herd','trees'],mine:['ore','cont','trk','tyre','drum','shed','ore','rock'],
  mil:['crateM','tent','vehM','berm','contM','crateM'],dport:['crateM','contM','vehM','berm','mast','bladder','tent'],dfab:['crateM','contM','pal','trk','drum','shed','trees'],dstore:['crateM','contM'],
  oil:['drum','pipe','tankS','skip'],gasw:['drum','pipe','skip'],port:['pal','cont','trk','drum','kiosk']};
const FCC=[[180,60,48],[46,110,164],[224,160,48],[58,125,68],[136,136,136],[200,90,40],[96,70,130]];
function zoneFill(z){const L=ZFILL[z.zk];if(!L)return;const P=z.prims,W=z.W,H=z.H,R=rng(z.seed^0x5f11),cam=R()*3|0;
  const cs=8,m=11,nx=M.floor((W-2*m)/cs),ny=M.floor((H-2*m)/cs);if(nx<2||ny<2)return;const occ=new Uint8Array(nx*ny),x0=-W/2+m,y0=-H/2+m;
  const mark=(ax,ay,bx,by,cl)=>{const i0=M.max(0,M.floor((ax-cl-x0)/cs)),i1=M.min(nx-1,M.floor((bx+cl-x0)/cs)),j0=M.max(0,M.floor((ay-cl-y0)/cs)),j1=M.min(ny-1,M.floor((by+cl-y0)/cs));for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)occ[j*nx+i]=1};
  const lmark=(pts,w)=>{for(let i=0;i+3<pts.length;i+=2){const ax=pts[i],ay=pts[i+1],bx=pts[i+2],by=pts[i+3],n=M.max(1,M.ceil(M.hypot(bx-ax,by-ay)/4));for(let q=0;q<=n;q++){const x=ax+(bx-ax)*q/n,y=ay+(by-ay)*q/n;mark(x,y,x,y,w/2+3)}}};
  const apron=z.zk==='dport'||z.zk==='drwy';
  for(let pi=0;pi<P.length;pi++){const p=P[pi],k=p.k;
    if(k==='b'||k==='pk'||k==='cont'||k==='bund'||k==='logs'||k==='boards'||k==='bales'||k==='field'||k==='track'||k==='switch'||k==='pv'||k==='twall'||k==='rw2'||k==='court'||k==='rows'||k==='solar')mark(p.x,p.y,p.x+p.w,p.y+p.h,3);
    else if(k==='cyl'||k==='pile'||k==='helipad'||k==='berm'||(k==='gc'&&p.r>3))mark(p.x-p.r,p.y-p.r,p.x+p.r,p.y+p.r,3);
    else if(k==='quarry')mark(p.x-p.rx,p.y-p.ry,p.x+p.rx,p.y+p.ry,5);
    else if(k==='veh'||k==='uav'||k==='pjack'||k==='wellhd'||k==='hframe'||k==='dome'||k==='flag')mark(p.x-6,p.y-6,p.x+6,p.y+6,3);
    else if(k==='cat')mark(p.x-3,p.y-4,p.x+p.len+3,p.y+4,3);
    else if(k==='gl'||k==='pipe'||k==='conv'||k==='rail')lmark(p.pts,(p.w||3)+(k==='rail'?3:0));
    else if(k==='g'&&pi>0){const c=p.c,dark=c[0]+c[1]+c[2]<330;if(apron&&!dark){for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const cx=x0+(i+0.5)*cs,cy=y0+(j+0.5)*cs;if(cx>p.x+3&&cx<p.x+p.w-3&&cy>p.y+3&&cy<p.y+p.h-3&&!occ[j*nx+i])occ[j*nx+i]=2}}else if(dark)mark(p.x,p.y,p.x+p.w,p.y+p.h,2)}}
  let cls=0;const free=(i,j,w,h)=>{for(let b=j;b<j+h;b++)for(let a=i;a<i+w;a++)if(a>=nx||b>=ny||occ[b*nx+a]!==cls)return false;return true};
  const AL=['vehM','crateM','apron','apron'];
  let budget=nx*ny*0.62,miss=0;
  for(let it=0;it<900&&budget>0&&miss<260;it++){const i=R()*nx|0,j=R()*ny|0;if(occ[j*nx+i]===1){miss++;continue}cls=occ[j*nx+i];
    const wm=2+(R()*4|0),hm=2+(R()*3|0);let w=1,h=1;while(w<wm&&free(i+w,j,1,h))w++;while(h<hm&&free(i,j+h,w,1))h++;if(w*h<2){occ[j*nx+i]=1;miss++;continue}
    const x=x0+i*cs+1.5,y=y0+j*cs+1.5,cw=w*cs-3,ch=h*cs-3,n0=P.length;zclus(z,(cls?AL:L)[R()*(cls?AL:L).length|0],P,R,x,y,cw,ch,cam);for(let q=n0;q<P.length;q++)P[q].fz=1;
    for(let b=j;b<j+h;b++)for(let a=i;a<i+w;a++)occ[b*nx+a]=1;budget-=w*h}}
function zclus(z,t,P,R,x,y,w,h,cam){const hz=w>=h;
  switch(t){
  case 'pal':{const pc=[[178,142,98],[212,214,216],[72,112,160],[190,170,120]][R()*4|0];for(let yy=y;yy+2.2<=y+h;yy+=3.4)for(let xx=x;xx+2.6<=x+w;xx+=3.2)if(R()<0.82)B(P,xx,yy,2.6,2.2,0.7+R()*1.5,pc,'f');break}
  case 'cont':case 'contM':{const mil=t==='contM';if(hz)for(let yy=y;yy+2.5<=y+h;yy+=3.2)for(let xx=x;xx+6.1<=x+w;xx+=6.7){if(R()<0.15)continue;B(P,xx,yy,6.1,2.44,R()<0.4?5.2:2.6,mil?[[96,104,72],[110,112,96],[84,90,70]][R()*3|0]:FCC[R()*FCC.length|0],'co')}
    else for(let xx=x;xx+2.5<=x+w;xx+=3.2)for(let yy=y;yy+6.1<=y+h;yy+=6.7){if(R()<0.15)continue;B(P,xx,yy,2.44,6.1,R()<0.4?5.2:2.6,mil?[[96,104,72],[110,112,96],[84,90,70]][R()*3|0]:FCC[R()*FCC.length|0],'co')}break}
  case 'trk':PK(P,x,y,w,h,0.75,R()*1e9|0,1);break;
  case 'pipe':{const c=[[150,96,70],[120,124,130],[196,190,170]][R()*3|0];if(hz)for(let yy=y+1;yy<y+h-0.5;yy+=1.3)P.push({k:'pipe',pts:[x+R()*2,yy,x+w-R()*2,yy],n:1,w:0.9,gr:1,c});else for(let xx=x+1;xx<x+w-0.5;xx+=1.3)P.push({k:'pipe',pts:[xx,y+R()*2,xx,y+h-R()*2],n:1,w:0.9,gr:1,c});break}
  case 'skip':{let xx=x;while(xx+4.2<=x+w){B(P,xx,y+(h-2.2)*R(),4.2,2.2,1.4,[[226,180,40],[52,96,160],[64,120,72]][R()*3|0],'f');xx+=5.2+R()*2}break}
  case 'drum':{const c=[[40,90,150],[170,50,40],[60,64,70],[200,170,60]][R()*4|0];for(let yy=y+0.6;yy+0.6<=y+h;yy+=1.35)for(let xx=x+0.6;xx+0.6<=x+w;xx+=1.35)if(R()<0.7)CY(P,xx,yy,0.45,0.95,c,'tank');break}
  case 'shed':{const sw=M.min(w,10+R()*10),sh=M.min(h,6+R()*5);B(P,x+(w-sw)*R(),y+(h-sh)*R(),sw,sh,3.5+R()*2.5,ROOF_IND[R()*ROOF_IND.length|0],R()<0.5?'co':'f');break}
  case 'kiosk':{const kx=x+(w-5)*R(),ky=y+(h-4)*R();B(P,kx+0.8,ky+0.8,3.4,2.4,2.5,[176,178,170],'f');P.push({k:'fence',x:kx,y:ky,w:5,h:4});break}
  case 'pile':case 'ore':case 'rock':case 'dust':case 'manure':{const O=z.o||{},oc=[[48,46,46],[60,56,54],[52,50,50],[150,84,58],[96,138,116],[192,170,118],[150,160,96],[226,224,214]][O.ore|0];
    const c=t==='ore'&&oc?oc:t==='dust'?[200,166,112]:t==='manure'?[92,74,52]:t==='rock'?[130,126,118]:[[60,58,56],[190,170,130],[150,140,125],[120,80,60]][R()*4|0];
    const n=1+(R()*2|0);for(let q=0;q<n;q++){const r=M.min(w,h)/(n+1)*0.9;P.push({k:'pile',x:x+r+(w-2*r)*(n>1?q/(n-1):0.5),y:y+h/2+(R()-0.5)*(h-2*r)*0.6,r,c})}break}
  case 'tankS':{const n=M.max(1,M.min(4,M.floor((hz?w:h)/6)));for(let q=0;q<n;q++){const tx=hz?x+3+q*6:x+w/2,ty=hz?y+h/2:y+3+q*6;CY(P,tx,ty,2.3,4+R()*2,[[210,210,204],[150,160,150],[96,108,84]][R()*3|0],'tank')}break}
  case 'tyre':{for(let yy=y+1.4;yy+1.4<=y+h;yy+=3)for(let xx=x+1.4;xx+1.4<=x+w;xx+=3)if(R()<0.55)CY(P,xx,yy,1.3,0.8+(R()*3|0)*0.8,[34,34,36],'tank');break}
  case 'logs':{for(let yy=y;yy+8<=y+h;yy+=10)P.push({k:'logs',x,y:yy,w,h:8,seed:R()*1e9|0});break}
  case 'boards':{for(let yy=y;yy+11<=y+h;yy+=14)for(let xx=x;xx+7<=x+w;xx+=9)P.push({k:'boards',x:xx,y:yy,w:7,h:11,seed:R()*1e9|0});break}
  case 'bales':P.push({k:'bales',x,y,w,h,seed:R()*1e9|0});break;
  case 'herd':G(P,x,y,w,h,[118,108,74]);P.push({k:'fence',x,y,w,h});P.push({k:'herd',x,y,w,h,seed:R()*1e9|0});B(P,x+1,y+1,M.min(6,w-2),M.min(3,h-2),2.6,[120,96,70],'f');break;
  case 'silage':{G(P,x,y,w,h,[110,106,70]);const n=hz?M.max(1,M.floor(h/6)):M.max(1,M.floor(w/6));for(let q=0;q<n;q++){if(hz){B(P,x,y+q*6,w,0.7,1.8,[176,172,160],'f');P.push({k:'pile',x:x+w/2,y:y+q*6+3.3,r:M.min(2.4,h/4),c:[124,128,66]})}else{B(P,x+q*6,y,0.7,h,1.8,[176,172,160],'f');P.push({k:'pile',x:x+q*6+3.3,y:y+h/2,r:M.min(2.4,w/4),c:[124,128,66]})}}break}
  case 'rows':P.push({k:'rows',x,y,w,h,o:hz?0:1});break;
  case 'crateM':{for(let yy=y;yy+1.5<=y+h;yy+=2.6)for(let xx=x;xx+2.1<=x+w;xx+=2.8)if(R()<0.75)B(P,xx,yy,2.1,1.5,1+R()*0.9,[[96,104,72],[86,92,64],[120,112,84]][R()*3|0],'f');break}
  case 'tent':{const tw=M.min(w,8),th=M.min(h,5);for(let xx=x;xx+tw<=x+w;xx+=tw+3)B(P,xx,y+(h-th)/2,tw,th,2.6,[[104,112,78],[92,98,70]][R()*2|0],'g');break}
  case 'vehM':case 'veh':{const v=z.zk==='mil'?[0,1,2,4][R()*4|0]:4;const n=M.max(1,M.floor((hz?w:h)/8));for(let q=0;q<n;q++)P.push({k:'veh',x:hz?x+4+q*8:x+w/2,y:hz?y+h/2:y+4+q*8,a:hz?PI/2:0,v,c:cam});break}
  case 'berm':{const r=M.min(w,h)/2-1;if(r>4){P.push({k:'berm',x:x+w/2,y:y+h/2,r,a:R()*TAU});if(r>6)P.push({k:'veh',x:x+w/2,y:y+h/2,a:R()*TAU,v:4,c:cam})}break}
  case 'mast':{CY(P,x+w/2,y+h/2,0.7,22+R()*14,[200,200,204],'tower');B(P,x+w/2+2,y+h/2-1.5,3,3,2.4,[170,174,166],'f');break}
  case 'bladder':{const r=M.min(w,h)/2-1;if(r>2){P.push({k:'gc',x:x+w/2,y:y+h/2,r,c:[44,48,42]});P.push({k:'gc',x:x+w/2,y:y+h/2,r:r*0.7,c:[58,62,52]})}break}
  case 'apron':{P.push({k:'gl',pts:[x,y,x+w,y,x+w,y+h,x,y+h,x,y],w:0.3,c:[226,206,90]});if(w>10&&h>8){P.push({k:'gl',pts:[x+w/2,y+1,x+w/2,y+h-1],w:0.25,c:[226,206,90],dash:1});B(P,x+1.2,y+1.2,2.4,1.6,1.1,[200,196,60],'f')}break}
  case 'trees':{const n=M.max(2,M.floor(w*h/40));for(let q=0;q<n;q++)TR(P,x+2+R()*(w-4),y+2+R()*(h-4),4+R()*4,[0,1,2,4][R()*4|0]);break}
  }}
// randomly placed zone objects must not interpenetrate: a building that overlaps an earlier one is dropped,
// a tank / tower / chimney that overlaps a building or an earlier cylinder too (with its smoke)
function fpOver(a,b){if(a.k==='b'&&b.k==='b')return a.x<b.x+b.w-0.2&&b.x<a.x+a.w-0.2&&a.y<b.y+b.h-0.2&&b.y<a.y+a.h-0.2;
  if(a.k==='cyl'&&b.k==='cyl')return M.hypot(a.x-b.x,a.y-b.y)<a.r+b.r-0.2;const c=a.k==='cyl'?a:b,r=a.k==='cyl'?b:a;
  return M.hypot(c.x-clamp(c.x,r.x,r.x+r.w),c.y-clamp(c.y,r.y,r.y+r.h))<c.r-0.2}
function dropEmit(z,p){const ex=z.x+p.x*z.ca-p.y*z.sa+LEANX*p.H,ey=z.y+p.x*z.sa+p.y*z.ca+LEANY*p.H;for(let i=emitters.length-1;i>=0;i--)if(M.abs(emitters[i].x-ex)<0.5&&M.abs(emitters[i].y-ey)<0.5)emitters.splice(i,1)}
function dedupeZone(z){if(z.zk==='air')return;const P=z.prims,K=mkBins(),out=[];let cut=0;
  for(const pass of ['b','cyl'])for(const p of P){if(p.k!==pass||p.nd||p.lvl!==undefined)continue;const bb=fpBox(p);let bad=false;for(const q of binGet(K,bb[0],bb[1],bb[2],bb[3]))if(fpOver(p,q)){bad=true;break}if(bad){p._x=1;cut++}else binAdd(K,p,bb)}
  if(!cut)return;for(const p of P){if(p._x){if(p.k==='cyl'&&p.H)dropEmit(z,p);continue}out.push(p)}z.prims=out}

// ---------------------------------------------------------------- ships & flights
const ships=[];
{for(let tries=0;!EMPTY&&ships.length<110&&tries<6000;tries++){const R=rng(hh(tries,7,99));const x=R()*WORLD,y=R()*WORLD;if(baseH(x,y,5)>-0.05)continue;
  const a=R()*TAU,L=6000+R()*22000;const bx=x+M.cos(a)*L,by=y+M.sin(a)*L;if(bx<0||by<0||bx>WORLD||by>WORLD)continue;let ok=true;
  for(let s=0;s<=L&&ok;s+=300){if(baseH(x+(bx-x)*s/L,y+(by-y)*s/L,5)>-0.025)ok=false}if(!ok)continue;
  ships.push({ax:x,ay:y,bx,by,L,v:5+R()*6,len:[70,110,160,220,280][R()*5|0],st:R()*3|0,c:R()*6|0,ph:R()*L*2})}
 for(const z of zones){if(z.zk!=='port')continue;const R=rng(z.seed^5);for(let q=0;q<3;q++){const x=z.x+z.ca*500,y=z.y+z.sa*500;const a=z.ang+(R()-0.5)*1.4;const L=8000+R()*12000;const bx=x+M.cos(a)*L,by=y+M.sin(a)*L;let ok=true;
   for(let s=0;s<=L&&ok;s+=300){if(baseH(x+(bx-x)*s/L,y+(by-y)*s/L,5)>-0.01)ok=false}if(ok)ships.push({city:z.city.id,ax:x,ay:y,bx,by,L,v:4+R()*4,len:[120,180,240][R()*3|0],st:R()*3|0,c:R()*6|0,ph:R()*L*2})}}}
for(const z of zones)if(z.zk==='air'){const ax=z.x-z.ca*1650,ay=z.y-z.sa*1650,bx=z.x+z.ca*1650,by=z.y+z.sa*1650;airports.push({z,ax,ay,bx,by,ux:z.ca,uy:z.sa,name:z.city.name})}
const flights=[];
{const R=rng(SS^0xf1);
 for(const A of airports){const others=airports.filter(o=>o!==A).sort((p,q)=>M.hypot(p.ax-A.ax,p.ay-A.ay)-M.hypot(q.ax-A.ax,q.ay-A.ay)).slice(0,3);
   for(const B of others){for(let k=0;k<2;k++){const pts=[A.ax,A.ay,A.bx,A.by];const app=B.ax-B.ux*16000,apy=B.ay-B.uy*16000;pts.push(A.bx+A.ux*8000,A.by+A.uy*8000,app,apy,B.ax,B.ay,B.ax+B.ux*2400,B.ay+B.uy*2400);
     const f={pts,v:78,ph:R()*5000,alt:3500+R()*3000,kind:0,c:R()*5|0,city:A.z.city.id,city2:B.z.city.id};prepPath(f);flights.push(f)}}}
 for(let q=0;q<(EMPTY?0:28);q++){const a=R()*TAU;const cx=WORLD*(0.2+0.6*R()),cy=WORLD*(0.2+0.6*R());const L=WORLD*1.4;
   const f={pts:[cx-M.cos(a)*L/2,cy-M.sin(a)*L/2,cx+M.cos(a)*L/2,cy+M.sin(a)*L/2],v:220+R()*30,ph:R()*1000,alt:9000+R()*2500,kind:1,c:R()*5|0};prepPath(f);flights.push(f)}
 // stage 2: a lone airport gets circuit flights (take-off, loop, landing on the same runway)
 if(airports.length===1)for(const A of airports)for(let k=0;k<3;k++){const nx=-A.uy,ny=A.ux,sd=k%2?1:-1;
   const pts=[A.ax,A.ay,A.bx,A.by,A.bx+A.ux*9000+nx*sd*(5000+k*1500),A.by+A.uy*9000+ny*sd*(5000+k*1500),A.ax-A.ux*16000,A.ay-A.uy*16000,A.ax,A.ay,A.ax+A.ux*2400,A.ay+A.uy*2400];
   const f={pts,v:78,ph:R()*5000,alt:2600+R()*1400,kind:0,c:R()*5|0,city:A.z.city.id};prepPath(f);flights.push(f)}}
function prepPath(f){const n=f.pts.length/2,cum=[0];let L=0;for(let i=1;i<n;i++){L+=M.hypot(f.pts[i*2]-f.pts[i*2-2],f.pts[i*2+1]-f.pts[i*2-1]);cum.push(L)}f.cum=cum;f.L=L;f.n=n}


// ================================================================= DYNAMIC WORLD (stage 5.5)
// Settlements and buildings placed during the game. The same calls run in the main thread and in every worker in the
// same order (the engine sends them as an op log), so ids and geometry match everywhere.
const stOf=o=>o.cap!==undefined?o.cap:o.st;
function addPlace(q){const city=q.k==='city';const c={x:q.x,y:q.y,R:q.R||(city?1500:320),type:city?2:0,seed:hh(q.x|0,q.y|0,2701),dyn:1,st:q.st,kind:'city'};
  c.id=cities.length;cities.push(c);c.name=q.name||mkName(rng(c.seed),c.type);c.bb=[c.x-c.R*1.4,c.y-c.R*1.4,c.x+c.R*1.4,c.y+c.R*1.4];
  const r0=roads.length;if(city)buildCity(c);else buildVillage(c);if(!city&&!c.vst.length)c.vst=[];live.push(c);addF(c,c.bb[0],c.bb[1],c.bb[2],c.bb[3]);
  // road to the nearest settlements of the same state (a second one for towns); it goes around the buildings in its way
  const mine=live.filter(o=>o!==c&&stOf(o)===q.st).sort((a,b)=>M.hypot(a.x-c.x,a.y-c.y)-M.hypot(b.x-c.x,b.y-c.y));
  // (when water or buildings leave no way to the nearest one, the next one is tried)
  DYNR=true;let got=0;for(const o of mine.slice(0,city?4:3)){const n0=roads.length;connect(c,o,city?1:4);if(roads.length>n0&&++got>=(city?2:1))break}
  // still cut off (a lake, a wide river): a road with a long bridge to the nearest settlement
  if(!got&&mine.length){DYNW=true;pairs.delete(c.id<mine[0].id?c.id+'_'+mine[0].id+'_'+(city?1:4):mine[0].id+'_'+c.id+'_'+(city?1:4));connect(c,mine[0],city?1:4);DYNW=false}DYNR=false;
  for(let i=r0;i<roads.length;i++){const r=roads[i];if(!r._b&&r.k!==8)bridgesOf(r);if(r.city!==undefined)continue;for(const o of queryF(r.bb[0],r.bb[1],r.bb[2],r.bb[3]))if(o.kind==='city'&&o.type>=1)throughClear(r,o)}
  if(city)for(const r of queryRoads(c.bb[0],c.bb[1],c.bb[2],c.bb[3]))if(r.city===undefined&&r.k!==8)throughClear(r,c);
  dynCross(r0);return c.id}
// a port faces the open water next to (x,y): nearest coast within 1.6 km, axis along the coast normal
function portAt(x,y,W,H){let best=null;for(let k=0;k<24;k++){const a=k*TAU/24,ca=M.cos(a),sa=M.sin(a);for(let d=100;d<1600;d+=50){if(baseH(x+ca*d,y+sa*d,7)<-0.01){if(!best||d<best[0])best=[d,ca,sa];break}}}
  if(!best)return null;const fx=x+best[1]*best[0],fy=y+best[2]*best[0],gx=baseH(fx+60,fy,7)-baseH(fx-60,fy,7),gy=baseH(fx,fy+60,7)-baseH(fx,fy-60,7);if(M.hypot(gx,gy)<1e-6)return null;
  const pa=M.atan2(-gy,-gx),pc=M.cos(pa),ps=M.sin(pa);return [fx-pc*260,fy-ps*260,pa]}
function addZone(q){const c=cities[q.city];if(!c)return -1;let x=q.x,y=q.y,a=q.a||0;const [W,H]=q.W?[q.W,q.H]:ZS[q.zk];
  if(q.zk==='port'){const p=portAt(x,y,W,H);if(!p)return -1;[x,y,a]=p}
  const r0=roads.length;NOACC=true;ZOPT=q;const z=mkZone(c,q.zk,x,y,a,W,H,M.hypot(W,H)/2);ZOPT=null;NOACC=false;z.dyn=1;z.st=q.st;linkZone(z,c);dynCross(r0);return z.id}
// a building of the game is linked by a straight road from the edge of its grounds to the nearest ordinary road
// (or into its settlement when there is no road within 4 km); the road goes around other buildings. Air defence,
// solar panels and the launch ramp / runway of a drone port get no road.
const NOLINK={sam:1,sol2:1,dramp:1,drwy:1};
function linkZone(z,c){if(NOLINK[z.zk])return;const cand=[];
  for(const r of queryRoads(z.x-4000,z.y-4000,z.x+4000,z.y+4000)){if(r.dead||r.k===0||r.k===5||r.k===6||r.k===8||r.ring)continue;
    const q=projOn(r,z.x,z.y),d=M.hypot(q[0]-z.x,q[1]-z.y);if(d>z.rad*0.5&&d<4000)cand.push([d,q[0],q[1],r])}
  cand.sort((a,b)=>a[0]-b[0]);
  const go=(tx,ty,k,wc)=>{const L=M.hypot(tx-z.x,ty-z.y);if(L<1)return true;const ux=(tx-z.x)/L,uy=(ty-z.y)/L;let [sx,sy]=zoneExit(z,ux,uy);sx+=ux*(RW[k]/2+1.5);sy+=uy*(RW[k]/2+1.5); // the road starts at the gate, outside the buildings
    if(M.hypot(tx-sx,ty-sy)<15)return true;
    const P=avoidZ([sx,sy,tx,ty],k,[z]);if(!P||(wc&&!waterRunOK(P,400,0.3)))return false;const r=mkRoad(k,P);if(r){r.dyn=1;r.hz=z.id;z.link=r;bridgesOf(r)}return true};
  const t=c.type>=1?snapNode(c,c.x,c.y):[c.x,c.y];
  // dry ways first, then with a bridge
  for(const wc of [true,false]){for(const [d,tx,ty,r] of cand.slice(0,6))if(go(tx,ty,r.k===1||r.k===2?1:4,wc))return;if(go(t[0],t[1],4,wc))return}}
// ---------- roads of the game go around buildings
// does segment a-b come closer than m to the grounds of zone z?
function zHitSeg(z,ax,ay,bx,by,m){const ux=ax-z.x,uy=ay-z.y,vx=bx-z.x,vy=by-z.y;return segBox(ux*z.ca+uy*z.sa,-ux*z.sa+uy*z.ca,vx*z.ca+vy*z.sa,-vx*z.sa+vy*z.ca,z.W/2+m,z.H/2+m)}
function zoneOnPath(P,m,skip){for(let i=0;i<P.length/2-1;i++){const ax=P[i*2],ay=P[i*2+1],bx=P[i*2+2],by=P[i*2+3];
    for(const z of queryF(M.min(ax,bx)-m-20,M.min(ay,by)-m-20,M.max(ax,bx)+m+20,M.max(ay,by)+m+20)){if(z.kind!=='zone'||z.dead||(skip&&skip.includes(z)))continue;if(zHitSeg(z,ax,ay,bx,by,m))return [i,z]}}return null}
// a segment that crosses a zone (with a margin) is replaced by the shorter way round the zone's corners; the corners
// are then rounded off. null when there is no way round (after 24 detours)
function avoidZ(pts,k,skip){for(const m of [RW[k]/2+22,RW[k]/2+9,RW[k]/2+3]){const P=avoidZm(pts,m,skip);if(P)return P}return null}
function avoidZm(pts,m,skip){let P=Array.from(pts),det=false;
  const inZ=(z,x,y,mg)=>{const dx=x-z.x,dy=y-z.y;return M.abs(dx*z.ca+dy*z.sa)<z.W/2+mg&&M.abs(-dx*z.sa+dy*z.ca)<z.H/2+mg};
  for(let it=0;it<24;it++){const h=zoneOnPath(P,m-2,skip);if(!h)break;det=true;const z=h[1];
    // the whole stretch of the route inside the zone's band is replaced: from the last point before it to the first after
    let lo=h[0],hi=h[0]+1;while(lo>0&&inZ(z,P[lo*2],P[lo*2+1],m+1))lo--;while(hi<P.length/2-1&&inZ(z,P[hi*2],P[hi*2+1],m+1))hi++;
    if(inZ(z,P[lo*2],P[lo*2+1],m-3)||inZ(z,P[hi*2],P[hi*2+1],m-3))return null;
    const ax=P[lo*2],ay=P[lo*2+1],bx=P[hi*2],by=P[hi*2+1],hw=z.W/2+m+6,hh2=z.H/2+m+6;
    const C=[[-hw,-hh2],[hw,-hh2],[hw,hh2],[-hw,hh2]].map(([u,v])=>[z.x+u*z.ca-v*z.sa,z.y+u*z.sa+v*z.ca]);let best=null,bl=1e18;
    for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(const d of [1,3]){if(zHitSeg(z,ax,ay,C[i][0],C[i][1],m-3)||zHitSeg(z,C[j][0],C[j][1],bx,by,m-3))continue;
      const ch=[i];let q=i;while(q!==j){q=(q+d)%4;ch.push(q)}let L=M.hypot(C[i][0]-ax,C[i][1]-ay)+M.hypot(bx-C[j][0],by-C[j][1]);for(let t=1;t<ch.length;t++)L+=M.hypot(C[ch[t]][0]-C[ch[t-1]][0],C[ch[t]][1]-C[ch[t-1]][1]);
      if(L<bl){bl=L;best=[];for(const c of ch)best.push(C[c][0],C[c][1])}}
    if(!best)return null;P.splice(lo*2+2,(hi-lo-1)*2,...best);if(it===23)return null}
  if(!det)return P;
  // round off the corners of the detour (cut each corner 30 m back along both legs); keep the sharp version if that
  // would touch a zone again
  const Q=[P[0],P[1]];for(let i=1;i<P.length/2-1;i++){const x=P[i*2],y=P[i*2+1],ax=P[i*2-2]-x,ay=P[i*2-1]-y,bx=P[i*2+2]-x,by=P[i*2+3]-y,la=M.hypot(ax,ay),lb=M.hypot(bx,by);
    if(la<1||lb<1||(ax*bx+ay*by)/(la*lb)<-0.94){Q.push(x,y);continue}const r=M.min(30,la*0.4,lb*0.4);Q.push(x+ax/la*r,y+ay/la*r,x+bx/lb*r,y+by/lb*r)}
  Q.push(P[P.length-2],P[P.length-1]);return zoneOnPath(Q,M.max(1,m-8),skip)?P:Q}
// ---------- crossings of the roads laid during the game (the rules of world generation): a highway or a railway
// crossing makes an overpass, other crossings and joins get junction zones (no markings or curbs across), boulevard
// medians open where a road crosses them
function dynCross(r0){const NEW=[];for(let i=r0;i<roads.length;i++)if(roads[i].k!==8&&!roads[i].dead)NEW.push(roads[i]);if(!NEW.length)return;
  const X=[],seen=new Set();
  for(const r of NEW)for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],ex=r.pts[i*2+2]-ax,ey=r.pts[i*2+3]-ay,li=M.hypot(ex,ey)||1;
    for(const o of queryRoads(M.min(ax,ax+ex)-2,M.min(ay,ay+ey)-2,M.max(ax,ax+ex)+2,M.max(ay,ay+ey)+2)){if(o===r||o.k===8||o.dead||(o.id>=r0&&o.id<r.id))continue;
      for(let j=0;j<o.n-1;j++){const cx=o.pts[j*2],cy=o.pts[j*2+1],fx=o.pts[j*2+2]-cx,fy=o.pts[j*2+3]-cy,den=ex*fy-ey*fx;if(M.abs(den)<1e-9)continue;
        const t=((cx-ax)*fy-(cy-ay)*fx)/den,u=((cx-ax)*ey-(cy-ay)*ex)/den;if(t<0||t>1||u<0||u>1)continue;const lj=M.hypot(fx,fy)||1;
        const key=r.id+'_'+o.id+'_'+M.round((ax+ex*t)/4)+'_'+M.round((ay+ey*t)/4);if(seen.has(key))continue;seen.add(key);
        X.push([r,o,r.cum[i]+t*li,o.cum[j]+u*lj,M.max(0.25,M.abs(den)/(li*lj))])}}}
  // pass 1: grade-separated crossings
  for(const [r,o,sr,so] of X){const ka=r.k,kb=o.k;if(!(ka===0||kb===0||ka===5||kb===5)||(ka===5&&kb===5)||(ka===4&&kb===5)||(ka===5&&kb===4))continue;
    if(M.min(sr,r.L-sr,so,o.L-so)<20)continue; // a road that ends on it is a join, not a crossing
    let up,lo,su;if(ka===5){up=o;lo=r;su=so}else if(kb===5){up=r;lo=o;su=sr}else if(ka===0&&kb===0){if(r.id>o.id){up=r;lo=o;su=sr}else{up=o;lo=r;su=so}}else if(ka===0){up=r;lo=o;su=sr}else{up=o;lo=r;su=so}
    const hw=RW[lo.k]/2+24;(up.ov=up.ov||[]).push([su-hw,su+hw,lo.id])}
  const onOv=(r,s)=>{if(!r.ov)return false;for(const o of r.ov)if(s>o[0]-2&&s<o[1]+2)return true;return false};
  const JZ=new Map(),jpush=(r,iv)=>{let a=JZ.get(r);if(!a)JZ.set(r,a=[]);a.push(iv)},XS=new Map(),xpush=(r,v)=>{let a=XS.get(r);if(!a)XS.set(r,a=[]);a.push(v)};
  // pass 2: at-grade crossings
  for(const [r,o,sr,so,sn] of X){if(r.k===5||o.k===5)continue;if(r.k===7)xpush(r,[sr,RW[o.k]/2/M.max(0.3,sn)+7]);if(o.k===7)xpush(o,[so,RW[r.k]/2/M.max(0.3,sn)+7]);
    if(r.k===0||o.k===0||onOv(r,sr)||onOv(o,so))continue;jpush(r,[sr-RW[o.k]/2/sn-0.6,sr+RW[o.k]/2/sn+0.6]);jpush(o,[so-RW[r.k]/2/sn-0.6,so+RW[r.k]/2/sn+0.6])}
  // ends of the new roads that join another road
  for(const r of NEW){if(r.k===5)continue;for(const e of [0,1]){const x=e?r.pts[r.n*2-2]:r.pts[0],y=e?r.pts[r.n*2-1]:r.pts[1];
    for(const o of queryRoads(x-20,y-20,x+20,y+20)){if(o===r||o.k===8||o.k===5||o.dead||x<o.bb[0]-20||x>o.bb[2]+20||y<o.bb[1]-20||y>o.bb[3]+20)continue;const q=projOn(o,x,y),d=M.hypot(q[0]-x,q[1]-y);if(d>RW[o.k]/2+1)continue;
      const so=nearestS(o,x,y)[1];if(onOv(o,so))continue;const pa=posAt(r,e?r.L-1:1),pb=posAt(o,so);const sn=M.max(0.3,M.abs(pa[2]*pb[3]-pa[3]*pb[2]));const ext=(RW[o.k]/2+d)/sn+0.6;jpush(r,e?[r.L-ext,r.L+1]:[-1,ext])}}}
  for(const [r,J] of JZ){if(r.jz)for(const q of r.jz)J.push(q.slice());J.sort((a,b)=>a[0]-b[0]);const m=[J[0].slice()];for(let q=1;q<J.length;q++){const l=m[m.length-1];if(J[q][0]<=l[1])l[1]=M.max(l[1],J[q][1]);else m.push(J[q].slice())}r.jz=m}
  for(const [r,V] of XS)r.xs=(r.xs||[]).concat(V).sort((a,b)=>a[0]-b[0]);
  // rural roads inside towns lose their grass verge there
  for(const r of NEW){if(r.city!==undefined||(r.k!==0&&r.k!==1&&r.k!==4))continue;const I=[];let st=-1;
    for(let s=0;s<=r.L;s+=15){const p=posAt(r,s);let inC=false;for(const c of queryF(p[0]-1,p[1]-1,p[0]+1,p[1]+1))if(c.kind==='city'&&c.type>=1&&cityF(c,p[0],p[1])<1.02){inC=true;break}
      if(inC&&st<0)st=M.max(0,s-15);if(!inC&&st>=0){I.push([st,s]);st=-1}}if(st>=0)I.push([st,r.L]);r.inC=I.length?I:undefined}}
// ---------- railways of the game: a line between two stations ('rst' zones or a station frame about to be built)
// the line leaves a station along its axis (from the end facing the other station) and runs straight on for 160 m
function railEnd(z,tx,ty){const s=(tx-z.x)*z.ca+(ty-z.y)*z.sa>=0?1:-1;return [[z.x+z.ca*s*z.W/2,z.y+z.sa*s*z.W/2],[z.x+z.ca*s*(z.W/2+160),z.y+z.sa*s*(z.W/2+160)]]}
// rail line A → B: [points] or a reason string. The line finds its own way (stage 5.11): an A* search on a grid of
// 110..260 m cells round towns (their built-up area is closed, the outskirts cost extra), villages, buildings, high
// mountains and long water (a bridge costs a lot); blk(x,y) can close more cells (the game: foreign land). The cell path
// is straightened (string pulling over cheap cells) and rounded off (Chaikin), so the track bends in long curves.
function railPts(A,B,blk){const [ea,fa]=railEnd(A,B.x,B.y),[eb,fb]=railEnd(B,A.x,A.y);if(M.hypot(B.x-A.x,B.y-A.y)<900)return 'Слишком коротко';
  const sk=[A,B].filter(z=>z.kind==='zone');let Q=null;
  for(const cs0 of [0,1]){const mid=railRoute(fa,fb,sk,blk,cs0,[A,B]);if(!mid)continue;
    for(const it of [8,4,0]){const P=[A.x,A.y,ea[0],ea[1]].concat(railSmooth(mid,ea,eb,it),[eb[0],eb[1],B.x,B.y]);const q=chaikin(P,3);if(!zoneOnPath(q.slice(4,q.length-4),RW[5]/2+6,sk)){Q=q;break}}if(Q)break}
  if(!Q)return 'Нет пути: мешают города, постройки, вода или горы';
  if(!waterRunOK(Q,900,0.35))return 'Слишком много воды на пути';
  for(const c of live){if(c.type<1)continue;for(let i=0;i<Q.length;i+=8)if(cityF(c,Q[i],Q[i+1])<0.85)return 'Путь идёт через центр '+c.name}
  return Q}
// the cell path is resampled every ~60 m and relaxed (each point moves towards the mean of its neighbours; the
// station leads stay fixed), so corners open into curves of a few hundred metres radius
function railSmooth(mid,ea,eb,it){if(!it)return mid;const P=[];for(let i=0;i+3<mid.length;i+=2){const ax=mid[i],ay=mid[i+1],bx=mid[i+2],by=mid[i+3],n=M.max(1,M.round(M.hypot(bx-ax,by-ay)/60));for(let q=0;q<n;q++)P.push([ax+(bx-ax)*q/n,ay+(by-ay)*q/n])}
  P.push([mid[mid.length-2],mid[mid.length-1]]);const n=P.length;if(n<4)return mid;
  // the ends are fixed; the first and last points are also drawn onto the line of their station lead (no kink there)
  const da=[P[0][0]-ea[0],P[0][1]-ea[1]],db=[P[n-1][0]-eb[0],P[n-1][1]-eb[1]],la=M.hypot(da[0],da[1])||1,lb=M.hypot(db[0],db[1])||1;
  for(let k=0;k<it;k++)for(let r=0;r<3;r++){for(let i=1;i<n-1;i++){const a=P[i-1],b=P[i+1];P[i][0]+=((a[0]+b[0])/2-P[i][0])*0.5;P[i][1]+=((a[1]+b[1])/2-P[i][1])*0.5}
    for(const [i,e,d,l] of [[1,P[0],da,la],[n-2,P[n-1],db,lb]]){const t=M.hypot(P[i][0]-e[0],P[i][1]-e[1]);P[i][0]+=(e[0]+d[0]/l*t-P[i][0])*0.5;P[i][1]+=(e[1]+d[1]/l*t-P[i][1])*0.5}}
  const out=[];for(const p of P)out.push(p[0],p[1]);return out}
function railRoute(fa0,fb0,sk,blk,fine,ends){const L=M.hypot(fb0[0]-fa0[0],fb0[1]-fa0[1]),pad=M.max(2600,L*0.5);let cs=clamp(L/(fine?110:70),fine?80:110,fine?180:260);
  // the search runs between points a further 2.5 cells out along the station leads, so the line leaves and meets
  // each station head-on (never sneaking in alongside it)
  const ext=(f,e)=>{const dx=f[0]-e[0],dy=f[1]-e[1],l=M.hypot(dx,dy)||1;return [f[0]+dx/l*cs*2.5,f[1]+dy/l*cs*2.5]},fa=ext(fa0,railEnd(ends[0],ends[1].x,ends[1].y)[0]),fb=ext(fb0,railEnd(ends[1],ends[0].x,ends[0].y)[0]);
  const bx0=M.min(fa[0],fb[0])-pad,by0=M.min(fa[1],fb[1])-pad,bx1=M.max(fa[0],fb[0])+pad,by1=M.max(fa[1],fb[1])+pad;while(((bx1-bx0)/cs+1)*((by1-by0)/cs+1)>70000)cs*=1.2;
  const nx=M.ceil((bx1-bx0)/cs)+1,ny=M.ceil((by1-by0)/cs)+1,N=nx*ny,C=new Float32Array(N);
  const X=i=>bx0+i*cs,Y=j=>by0+j*cs,ci=x=>M.round((x-bx0)/cs),cj=y=>M.round((y-by0)/cs);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=X(i),y=Y(j),e=landE(x,y,0.002);C[j*nx+i]=e<0?9:e>0.34?0:e>0.24?2.2:1}
  // towns: the built-up area is closed, the outskirts cost extra; villages are closed with a margin
  for(const c of live){if(c.dead)continue;const rr=c.type>=1?c.R*1.6+cs:c.R+260;if(c.x+rr<bx0||c.x-rr>bx1||c.y+rr<by0||c.y-rr>by1)continue;
    for(let j=M.max(0,cj(c.y-rr));j<=M.min(ny-1,cj(c.y+rr));j++)for(let i=M.max(0,ci(c.x-rr));i<=M.min(nx-1,ci(c.x+rr));i++){const k=j*nx+i;if(!C[k])continue;const x=X(i),y=Y(j);
      if(c.type>=1){const f=cityF(c,x,y);if(f<1.08)C[k]=0;else if(f<1.45)C[k]+=(1.45-f)*14}else if(M.hypot(x-c.x,y-c.y)<c.R+150)C[k]=0}}
  // other buildings are closed with a margin; the two stations too (the line reaches them only along their leads)
  for(const z of queryF(bx0,by0,bx1,by1).concat(ends.filter(e=>e.kind!=='zone').map(e=>Object.assign({kind:'zone',rad:M.hypot(e.W,e.H)/2},e)))){if(z.kind!=='zone'||z.dead)continue;const r=z.rad+90+cs*0.7;
    for(let j=M.max(0,cj(z.y-r));j<=M.min(ny-1,cj(z.y+r));j++)for(let i=M.max(0,ci(z.x-r));i<=M.min(nx-1,ci(z.x+r));i++){const dx=X(i)-z.x,dy=Y(j)-z.y;
      if(M.abs(dx*z.ca+dy*z.sa)<z.W/2+70+cs*0.7&&M.abs(-dx*z.sa+dy*z.ca)<z.H/2+70+cs*0.7)C[j*nx+i]=0}}
  if(blk)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;if(C[k]&&blk(X(i),Y(j)))C[k]=0}
  const s0=cj(fa[1])*nx+ci(fa[0]),g0=cj(fb[1])*nx+ci(fb[0]);
  // the cells right at the two ends stay open (a station may stand next to a town)
  for(const [ex,ey] of [fa,fb])for(let j=M.max(0,cj(ey)-1);j<=M.min(ny-1,cj(ey)+1);j++)for(let i=M.max(0,ci(ex)-1);i<=M.min(nx-1,ci(ex)+1);i++){const k=j*nx+i;if(!C[k])C[k]=3}
  // A* (8 neighbours, octile distance)
  const G=new Float32Array(N).fill(1e30),Fr=new Int32Array(N).fill(-1),cl=new Uint8Array(N),H=[],HF=[];
  const push=(k,f)=>{H.push(k);HF.push(f);let i=H.length-1;while(i>0){const p=(i-1)>>1;if(HF[p]<=HF[i])break;[H[p],H[i]]=[H[i],H[p]];[HF[p],HF[i]]=[HF[i],HF[p]];i=p}};
  const pop=()=>{const k=H[0],lk=H.pop(),lf=HF.pop();if(H.length){H[0]=lk;HF[0]=lf;let i=0;for(;;){const a=2*i+1,b=a+1;let m=i;if(a<H.length&&HF[a]<HF[m])m=a;if(b<H.length&&HF[b]<HF[m])m=b;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];[HF[m],HF[i]]=[HF[i],HF[m]];i=m}}return k};
  const gx=g0%nx,gy=(g0/nx)|0,hz=k=>{const dx=M.abs(k%nx-gx),dy=M.abs(((k/nx)|0)-gy);return (M.max(dx,dy)+0.4142*M.min(dx,dy))};
  G[s0]=0;push(s0,hz(s0));let it=0,found=false;
  while(H.length&&it++<N*4){const k=pop();if(cl[k])continue;cl[k]=1;if(k===g0){found=true;break}const kx=k%nx,ky=(k/nx)|0;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const x=kx+di,y=ky+dj;if(x<0||y<0||x>=nx||y>=ny)continue;const q=y*nx+x,c=C[q];if(!c||cl[q])continue;
      if(di&&dj&&(!C[ky*nx+x]||!C[y*nx+kx]))continue;const g=G[k]+(di&&dj?1.4142:1)*(c+C[k])/2;if(g<G[q]){G[q]=g;Fr[q]=k;push(q,g+hz(q))}}}
  if(!found)return null;const cells=[];for(let k=g0;k>=0;k=Fr[k])cells.push(k);cells.reverse();
  // string pulling: a straight run is kept while every cell under it is open and no dearer than the cells it replaces
  const los=(a,b)=>{const ax=a%nx,ay=(a/nx)|0,bx=b%nx,by=(b/nx)|0,n=M.max(M.abs(bx-ax),M.abs(by-ay))*2;let mx=1.05;for(let q=0;q<=n;q++){const x=M.round(ax+(bx-ax)*q/n),y=M.round(ay+(by-ay)*q/n),c=C[y*nx+x];if(!c||c>M.max(1.3,mx))return false}return true};
  const keep=[cells[0]];let i=0;while(i<cells.length-1){let j=cells.length-1;while(j>i+1&&!los(cells[i],cells[j]))j--;keep.push(cells[j]);i=j}
  const out=[fa0[0],fa0[1],fa[0],fa[1]];for(let q=1;q<keep.length-1;q++){const x=X(keep[q]%nx),y=Y((keep[q]/nx)|0);if(M.hypot(x-fa[0],y-fa[1])<cs*1.6||M.hypot(x-fb[0],y-fb[1])<cs*1.6)continue;out.push(x,y)}out.push(fb[0],fb[1],fb0[0],fb0[1]);return out}
function addRail(q){const A=zones[q.a],B=zones[q.b];if(!A||!B)return -1;const P=q.P&&q.P.length>=8?q.P:railPts(A,B);if(typeof P==='string')return -1;const r0=roads.length;const r=mkRoad(5,P);if(!r)return -1;r.dyn=1;r.st=q.st;r.za=q.a;r.zb=q.b;bridgesOf(r);
  for(const o of queryF(r.bb[0],r.bb[1],r.bb[2],r.bb[3]))if(o.kind==='city'&&o.type>=1)throughClear(r,o);dynCross(r0);return r.id}
function removeRail(id){const r=roads[id];if(!r||r.dead||r.k!==5)return -1;r.dead=1;DEADN++;return id}
// ---------- upgrades of a building (stage 5.7): the zone is laid out again with the extra parts (same seed, so the
// base layout does not change)
function zoneUp(q){const z=zones[q[0]];if(!z||z.dead)return -1;z.o=Object.assign({},z.o||{});z.o.up=Object.assign({},z.o.up||{});z.o.up[q[1]]=1;
  for(let i=emitters.length-1;i>=0;i--)if(emitters[i].zid===z.id)emitters.splice(i,1);genZone(z);return z.id}
// ---------- deposits under a new town move aside to the nearest free spot (the game decides where, all threads move it)
function moveDeposit(q){const [i,x,y]=q,o=DEPS[i];if(!o)return -1;o.dead=1;const f={kind:'dep',k:o.k,x,y,r:o.r,seed:hh(x|0,y|0,4411)};f.bb=[x-f.r*1.3,y-f.r*1.3,x+f.r*1.3,y+f.r*1.3];DEPS[i]=f;addF(f,f.bb[0],f.bb[1],f.bb[2],f.bb[3]);return i}
// ---------- fog of war (stage 5.7): buildings of other states that the player has not seen are left out of the tiles
function setHidden(L){HID=new Set(L||[])}
const zHid=z=>HID.size>0&&HID.has(z.id),rHid=r=>HID.size>0&&r.hz!==undefined&&HID.has(r.hz);
// forest density 0..1 at a point (the same field the terrain raster uses for woods)
function forestAt(x,y){const e=baseH(x,y,6);if(e<0.004)return 0;const mo=moist(x,y),fn=noise(x/1900+3.3,y/1900-7.1)*0.6+noise(x/520+1.7,y/520+9.9)*0.4;return smooth(0.06,0.13,mo*0.75+fn*0.6)*smooth(0.55,0.44,e)}

// ================================================================= RENDERING
let SPR=null;
function sprites(){if(SPR)return SPR;SPR={tree:[],treeS:[[],[],[]],car:[],truck:[],bus:null};
  for(let s=0;s<3;s++)for(let v=0;v<7;v++)SPR.treeS[s].push(mkTree(v,s));SPR.tree=SPR.treeS[0];
  for(let v=0;v<CARC.length;v++)for(let t=0;t<3;t++)SPR.car.push(mkCar(CARC[v],(v+t)%3));
  // 10 px/m copies (box-filtered down) for parked cars in tiles and for traffic seen from afar: no sparkle when minified
  SPR.carLo=SPR.car.map(c=>{let src=c;for(const w of [100,50]){const d=mkCanvas(w,w/2),x=d.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(src,0,0,w,w/2);src=d}return src});
  for(let v=0;v<5;v++)SPR.truck.push(mkTruck(v));SPR.bus=mkBus();return SPR}
// ---------------------------------------------------------------- military vehicles (stage 5), top view, facing +x
// 0 main battle tank, 1 tracked IFV, 2 8x8 APC, 3 SAM launcher, 4 army truck, 5 attack helicopter; camo 0 woodland, 1 desert, 2 urban
const CAMO=[[[94,104,64],[58,68,42],[130,130,90]],[[178,154,110],[138,114,78],[204,186,144]],[[122,126,122],[82,86,86],[160,164,160]]];
const VDIM=[[7.4,2.3],[5.8,2.0],[4.2,1.7],[5.6,1.6],[4.3,1.5],[8.8,8.8]],VPX=20;let VSPR=null;
function vehSprites(){if(VSPR)return VSPR;VSPR=[];for(let v=0;v<6;v++)for(let c=0;c<3;c++){const [hl,hw]=VDIM[v];const cv=mkCanvas(M.ceil(hl*2*VPX),M.ceil(hw*2*VPX)),x=cv.getContext('2d');
    x.translate(hl*VPX,hw*VPX);x.scale(VPX,VPX);mkVeh(x,v,CAMO[c],hh(v,c,515));
    const sh=mkCanvas(cv.width,cv.height),y=sh.getContext('2d');y.drawImage(cv,0,0);y.globalCompositeOperation='source-in';y.fillStyle='#0a0e14';y.fillRect(0,0,sh.width,sh.height);
    // 5 px/m copy for distant views (box-filtered, no sparkle)
    let lo=cv;for(const f of [2,4]){const d=mkCanvas(M.max(2,M.round(cv.width/f)),M.max(2,M.round(cv.height/f))),q=d.getContext('2d');q.imageSmoothingEnabled=true;q.imageSmoothingQuality='high';q.drawImage(lo,0,0,d.width,d.height);lo=d}
    VSPR.push({c:cv,lo,sh,hl,hw})}return VSPR}
function camoFill(x,pal,sd,x0,y0,w,h){const r=rng(sd);x.fillStyle=cs(pal[0],1);x.fill();x.save();x.clip();
  for(let q=0;q<w*h*0.9;q++){const px=x0+r()*w,py=y0+r()*h,rx=0.25+r()*0.6,ry=0.15+r()*0.35;x.fillStyle=cs(q%3?pal[1]:pal[2],0.92+r()*0.1);x.globalAlpha=0.55;x.beginPath();x.ellipse(px,py,rx,ry,r()*PI,0,TAU);x.fill()}
  x.globalAlpha=1;const g=x.createLinearGradient(x0,y0,x0+w*0.4,y0+h);g.addColorStop(0,'rgba(255,255,240,0.16)');g.addColorStop(1,'rgba(0,0,0,0.18)');x.fillStyle=g;x.fillRect(x0,y0,w,h);x.restore()}
function poly(x,pts){x.beginPath();x.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)x.lineTo(pts[i],pts[i+1]);x.closePath()}
function trackRun(x,x0,x1,y0,y1){x.fillStyle='#24241f';x.fillRect(x0,y0,x1-x0,y1-y0);x.fillStyle='#3a3a33';for(let t=x0;t<x1;t+=0.17)x.fillRect(t,y0,0.07,y1-y0);x.fillStyle='rgba(120,120,110,0.35)';x.fillRect(x0,(y0+y1)/2-0.04,x1-x0,0.08)}
function hatch(x,cx,cy,r){x.fillStyle='rgba(0,0,0,0.35)';x.beginPath();x.arc(cx+0.03,cy+0.04,r,0,TAU);x.fill();x.fillStyle='rgba(255,255,255,0.12)';x.beginPath();x.arc(cx,cy,r*0.92,0,TAU);x.fill();x.strokeStyle='rgba(0,0,0,0.45)';x.lineWidth=0.04;x.stroke()}
function mkVeh(x,v,pal,sd){x.lineJoin='round';const dk=cs(pal[1],0.7),ol='rgba(20,22,16,0.7)';
  if(v===0){ // MBT: tracks under side skirts, chamfered glacis, engine deck grilles, wedge turret with ERA, 125 mm gun
    trackRun(x,-3.85,3.85,-1.85,-1.18);trackRun(x,-3.85,3.85,1.18,1.85);
    poly(x,[3.95,-0.95,3.7,-1.3,-3.6,-1.3,-3.75,-1.1,-3.75,1.1,-3.6,1.3,3.7,1.3,3.95,0.95]);camoFill(x,pal,sd,-3.8,-1.3,7.8,2.6);x.strokeStyle=ol;x.lineWidth=0.05;x.stroke();
    for(const sg of [-1,1]){x.fillStyle=cs(pal[0],0.82);x.fillRect(-3.3,sg>0?1.3:-1.9,6.4,0.6);x.fillStyle='rgba(0,0,0,0.25)';for(let t=-3.3;t<3.1;t+=0.8)x.fillRect(t,sg>0?1.3:-1.9,0.04,0.6)}
    x.fillStyle='rgba(20,22,18,0.55)';x.fillRect(-3.55,-0.95,1.5,1.9);x.fillStyle='rgba(150,150,130,0.35)';for(let t=-3.5;t<-2.05;t+=0.12)x.fillRect(t,-0.9,0.05,1.8);
    hatch(x,3.15,0,0.28);
    x.save();x.translate(0.14,0.2);poly(x,[2.05,0,1.25,-1.45,-1.35,-1.62,-2.25,-1.2,-2.25,1.2,-1.35,1.62,1.25,1.45]);x.fillStyle='rgba(0,0,0,0.38)';x.fill();x.restore();
    poly(x,[2.05,0,1.25,-1.45,-1.35,-1.62,-2.25,-1.2,-2.25,1.2,-1.35,1.62,1.25,1.45]);camoFill(x,[pal[2],pal[0],pal[1]],sd+7,-2.3,-1.7,4.4,3.4);x.strokeStyle=ol;x.lineWidth=0.09;x.stroke();x.strokeStyle='rgba(255,255,230,0.18)';x.lineWidth=0.05;x.beginPath();x.moveTo(1.9,-0.1);x.lineTo(1.2,-1.35);x.lineTo(-1.3,-1.5);x.stroke();
    x.fillStyle=cs(pal[1],0.95);for(let q=0;q<4;q++){x.fillRect(1.05-q*0.25,-1.38+q*0.04,0.2,0.5);x.fillRect(1.05-q*0.25,0.88-q*0.04,0.2,0.5)}
    x.fillStyle='#2a2c24';x.fillRect(-2.75,-1.05,0.5,2.1);x.strokeStyle='rgba(120,120,100,0.6)';x.lineWidth=0.03;for(let t=-1;t<=1.01;t+=0.35){x.beginPath();x.moveTo(-2.75,t);x.lineTo(-2.25,t);x.stroke()}
    x.fillStyle=cs(pal[1],1.05);x.fillRect(1.9,-0.11,5.3,0.22);x.fillStyle=cs(pal[1],0.9);x.fillRect(4.1,-0.16,0.65,0.32);x.fillRect(7.0,-0.14,0.18,0.28);x.fillStyle='rgba(255,255,255,0.15)';x.fillRect(1.9,-0.11,5.3,0.06);
    hatch(x,-0.65,-0.72,0.36);hatch(x,-0.55,0.75,0.3);x.fillStyle='#1c1e18';x.fillRect(0.45,0.55,0.4,0.3);x.strokeStyle='#2a2a26';x.lineWidth=0.05;x.beginPath();x.moveTo(-0.6,-0.7);x.lineTo(0.4,-0.95);x.stroke();
    x.strokeStyle='rgba(20,20,20,0.6)';x.lineWidth=0.025;x.beginPath();x.moveTo(-1.9,-1.05);x.lineTo(-3.6,-1.6);x.moveTo(-1.9,1.05);x.lineTo(-3.3,1.7);x.stroke()}
  else if(v===1){ // tracked IFV: low hull, small turret with a 30 mm cannon and an ATGM launcher, rear ramp
    trackRun(x,-3.3,3.4,-1.6,-1.05);trackRun(x,-3.3,3.4,1.05,1.6);
    poly(x,[3.65,-0.6,3.25,-1.55,-3.4,-1.55,-3.4,1.55,3.25,1.55,3.65,0.6]);camoFill(x,pal,sd,-3.4,-1.6,7.1,3.2);x.strokeStyle=ol;x.lineWidth=0.05;x.stroke();
    x.strokeStyle='rgba(0,0,0,0.35)';x.lineWidth=0.04;x.strokeRect(-3.35,-0.8,0.7,1.6);x.beginPath();x.moveTo(2.4,-1.5);x.lineTo(3.2,-0.6);x.moveTo(2.4,1.5);x.lineTo(3.2,0.6);x.stroke();
    hatch(x,2.55,-0.7,0.25);hatch(x,-1.9,-0.7,0.24);hatch(x,-1.9,0.7,0.24);
    poly(x,[0.9,-0.55,0.55,-0.95,-1.0,-0.95,-1.2,-0.6,-1.2,0.75,-0.9,1.0,0.55,1.0,0.9,0.6]);camoFill(x,[pal[2],pal[0],pal[1]],sd+3,-1.2,-1,2.1,2);x.strokeStyle=ol;x.lineWidth=0.05;x.stroke();
    x.fillStyle=cs(pal[1],1);x.fillRect(0.8,-0.07,2.9,0.14);x.fillRect(3.55,-0.1,0.2,0.2);x.fillStyle='#3c4030';x.fillRect(-0.8,1.0,1.4,0.36);x.fillStyle='rgba(0,0,0,0.4)';x.fillRect(-0.8,1.16,1.4,0.04);hatch(x,-0.45,-0.45,0.26)}
  else if(v===2){ // 8x8 APC: boat-shaped hull, wheels, remote weapon station
    x.fillStyle='#202020';for(const wx of [-2.75,-1.15,0.75,2.35])for(const sg of [-1,1]){x.beginPath();x.ellipse(wx,sg*1.32,0.55,0.24,0,0,TAU);x.fill()}
    poly(x,[4.1,0,3.45,-1.25,-3.7,-1.42,-3.95,-1.1,-3.95,1.1,-3.7,1.42,3.45,1.25]);camoFill(x,pal,sd,-3.95,-1.45,8.1,2.9);x.strokeStyle=ol;x.lineWidth=0.05;x.stroke();
    x.strokeStyle='rgba(0,0,0,0.3)';x.lineWidth=0.035;x.beginPath();x.moveTo(2.4,-1.2);x.lineTo(2.4,1.2);x.moveTo(-3.4,-1.0);x.lineTo(-3.4,1.0);x.stroke();
    hatch(x,2.9,-0.45,0.22);hatch(x,2.9,0.45,0.22);hatch(x,-1.6,-0.6,0.26);hatch(x,-1.6,0.6,0.26);
    x.fillStyle=cs(pal[1],0.95);x.fillRect(0.0,-0.42,0.85,0.84);x.fillStyle=cs(pal[1],1.1);x.fillRect(0.7,-0.05,1.7,0.1);x.fillStyle='#16181a';x.fillRect(0.55,0.18,0.22,0.16)}
  else if(v===3){ // SAM launcher on an 8x8 chassis: cab, four canisters raised to the rear
    x.fillStyle='#202020';for(const wx of [-3.8,-2.4,1.6,3.0])for(const sg of [-1,1]){x.beginPath();x.ellipse(wx,sg*1.35,0.55,0.22,0,0,TAU);x.fill()}
    poly(x,[5.4,-1.2,5.6,-0.9,5.6,0.9,5.4,1.2,3.6,1.3,3.6,-1.3]);camoFill(x,pal,sd,3.6,-1.3,2,2.6);x.strokeStyle=ol;x.lineWidth=0.05;x.stroke();
    x.fillStyle='rgba(30,44,56,0.85)';x.fillRect(5.25,-1.0,0.25,2.0);x.fillStyle=cs(pal[0],0.8);x.fillRect(-5.3,-1.3,8.8,2.6);
    for(let q=0;q<4;q++){const y=-0.98+q*0.655;x.fillStyle=cs(pal[2],0.95+q*0.02);x.fillRect(-5.4,y-0.3,7.6,0.6);x.fillStyle='rgba(0,0,0,0.35)';x.fillRect(-5.4,y+0.22,7.6,0.08);x.fillStyle=cs(pal[1],0.9);x.fillRect(-5.5,y-0.3,0.18,0.6);x.fillRect(2.0,y-0.3,0.2,0.6)}
    x.strokeStyle='#30322a';x.lineWidth=0.08;x.beginPath();x.moveTo(2.4,-1.3);x.lineTo(3.0,-1.55);x.moveTo(2.4,1.3);x.lineTo(3.0,1.55);x.moveTo(-4.8,-1.3);x.lineTo(-5.2,-1.6);x.moveTo(-4.8,1.3);x.lineTo(-5.2,1.6);x.stroke()}
  else if(v===4){ // army truck: cab and a canvas-covered cargo bed with hoops
    x.fillStyle='#202020';for(const wx of [-2.9,-1.6,2.7])for(const sg of [-1,1]){x.beginPath();x.ellipse(wx,sg*1.2,0.5,0.2,0,0,TAU);x.fill()}
    poly(x,[4.15,-1.05,4.25,-0.8,4.25,0.8,4.15,1.05,2.5,1.2,2.5,-1.2]);camoFill(x,pal,sd,2.5,-1.2,1.8,2.4);x.strokeStyle=ol;x.lineWidth=0.05;x.stroke();
    x.fillStyle='rgba(30,44,56,0.8)';x.fillRect(3.95,-0.95,0.22,1.9);
    x.fillStyle=cs([pal[0][0]*0.92,pal[0][1]*0.95,pal[0][2]*0.82],1);x.fillRect(-4.2,-1.25,6.5,2.5);const g=x.createLinearGradient(0,-1.25,0,1.25);g.addColorStop(0,'rgba(0,0,0,0.22)');g.addColorStop(0.45,'rgba(255,255,230,0.18)');g.addColorStop(1,'rgba(0,0,0,0.25)');x.fillStyle=g;x.fillRect(-4.2,-1.25,6.5,2.5);
    x.fillStyle='rgba(0,0,0,0.22)';for(let t=-3.6;t<2.2;t+=0.95)x.fillRect(t,-1.25,0.07,2.5)}
  else{ // attack helicopter: slim fuselage, tandem cockpit, stub wings with pods, tail boom, 5-blade rotor
    x.fillStyle=cs(pal[0],0.9);poly(x,[-7.6,-0.18,-7.6,0.18,-1.6,0.32,-1.6,-0.32]);x.fill();x.fillStyle=cs(pal[1],1);x.fillRect(-8.1,-0.9,0.7,1.8);
    x.strokeStyle='#2a2a28';x.lineWidth=0.12;x.beginPath();x.moveTo(-7.8,0.95);x.lineTo(-7.8,2.2);x.moveTo(-7.8,0.95);x.lineTo(-7.8,-0.3);x.stroke();
    x.beginPath();x.ellipse(0.8,0,4.4,0.82,0,0,TAU);camoFill(x,pal,sd,-3.6,-0.9,8.8,1.8);x.strokeStyle=ol;x.lineWidth=0.05;x.stroke();
    x.fillStyle='rgba(40,60,72,0.85)';x.beginPath();x.ellipse(3.4,0,1.1,0.42,0,0,TAU);x.fill();x.beginPath();x.ellipse(2.0,0,0.9,0.46,0,0,TAU);x.fill();x.fillStyle='rgba(200,230,255,0.35)';x.fillRect(3.0,-0.3,0.8,0.1);
    x.fillStyle=cs(pal[1],1);x.fillRect(0.1,-2.3,1.0,4.6);for(const sg of [-1,1])for(const o of [1.5,2.1]){x.fillStyle='#2c2e28';x.beginPath();x.ellipse(0.55,sg*o,0.9,0.22,0,0,TAU);x.fill()}
    x.fillStyle='#1e1e1c';x.fillRect(4.9,-0.06,0.9,0.12);
    x.strokeStyle='rgba(38,40,36,0.82)';x.lineWidth=0.5;x.lineCap='butt';x.beginPath();for(let b=0;b<5;b++){const a=b*TAU/5+0.4;x.moveTo(0.8,0);x.lineTo(0.8+M.cos(a)*8.5,M.sin(a)*8.5)}x.stroke();x.strokeStyle='rgba(230,200,60,0.85)';x.lineWidth=0.5;x.beginPath();for(let b=0;b<5;b++){const a=b*TAU/5+0.4;x.moveTo(0.8+M.cos(a)*8.1,M.sin(a)*8.1);x.lineTo(0.8+M.cos(a)*8.5,M.sin(a)*8.5)}x.stroke();
    x.fillStyle='#3a3c38';x.beginPath();x.arc(0.8,0,0.45,0,TAU);x.fill()}}
function drawVeh(ctx,p,s){const S=vehSprites()[p.v*3+p.c],src=s<5?S.lo:S.c,H=p.v===5?2.6:1.4;
  ctx.save();ctx.translate(p.x+SDX*H,p.y+SDY*H);ctx.rotate(p.a);ctx.globalAlpha=0.4;ctx.drawImage(S.sh,-S.hl,-S.hw,S.hl*2,S.hw*2);ctx.restore();
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.drawImage(src,-S.hl,-S.hw,S.hl*2,S.hw*2);ctx.restore()}

// pump jack (top view, x along the walking beam): skid, samson post, beam with horsehead, crank and counterweights, motor
function drawJack(ctx,p,s){const C=[[226,184,48],[60,96,150],[190,64,50]][p.c],H=4.2;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);
  ctx.fillStyle='rgba(10,14,20,0.35)';ctx.fillRect(-4.6+SDX*H*0.5,-0.6+SDY*H*0.5,9.4,1.2);
  ctx.fillStyle='#55585c';ctx.fillRect(-5,-1.3,10,2.6);ctx.fillStyle='#3e4044';ctx.fillRect(-5,-1.3,10,0.35);ctx.fillRect(-5,0.95,10,0.35);
  ctx.fillStyle='#6a6e72';ctx.fillRect(-4.6,-0.9,1.6,1.8);ctx.fillStyle='#2e3034';ctx.fillRect(-4.3,-0.6,1,1.2); // motor
  // crank with counterweights at the rear
  for(const sd of [-1,1]){ctx.fillStyle='#4a4c50';ctx.beginPath();ctx.arc(-2.6,sd*1.05,0.95,0,TAU);ctx.fill();ctx.fillStyle=cs(C,0.85);ctx.beginPath();ctx.moveTo(-2.6,sd*1.05);ctx.arc(-2.6,sd*1.05,0.95,-0.9,0.9);ctx.closePath();ctx.fill()}
  // samson post (A-frame legs lean towards the beam bearing)
  const tx=LNX*H,ty=LNY*H;ctx.strokeStyle='#4a4c50';ctx.lineWidth=0.22;ctx.beginPath();for(const sd of [-1,1]){ctx.moveTo(0.4,sd*1.1);ctx.lineTo(0.4+tx*0.1,ty*0.1)}ctx.stroke();
  // walking beam (elevated: shifted by the lean), horsehead at the front
  ctx.save();ctx.translate(tx*0.12,ty*0.12);ctx.fillStyle='rgba(10,14,20,0.25)';ctx.fillRect(-2.8+SDX*H*0.8,-0.28+SDY*H*0.8,7.6,0.56);
  ctx.fillStyle=cs(C,1);ctx.fillRect(-2.8,-0.28,6.6,0.56);ctx.fillStyle=cs(C,1.15);ctx.fillRect(-2.8,-0.28,6.6,0.16);
  ctx.fillStyle=cs(C,0.9);ctx.beginPath();ctx.moveTo(3.6,-0.5);ctx.quadraticCurveTo(5,-0.4,5.1,0);ctx.quadraticCurveTo(5,0.4,3.6,0.5);ctx.closePath();ctx.fill();ctx.restore();
  // polished rod and wellhead
  ctx.fillStyle='#2a2c30';ctx.beginPath();ctx.arc(5.1,0,0.35,0,TAU);ctx.fill();ctx.fillStyle='#8a8e92';ctx.fillRect(4.8,-0.7,0.6,1.4);ctx.restore()}
// ---------------------------------------------------------------- stage 5.7 objects
// PV row on a rack: the upper edge (p.y) is lifted, the shadow falls from it; modules 1 x 2 m with cells and a silver frame
function drawPV(ctx,p,s){const H=1.7;ctx.fillStyle='rgba(14,18,28,0.32)';ctx.beginPath();ctx.moveTo(p.x,p.y+p.h);ctx.lineTo(p.x+p.w,p.y+p.h);ctx.lineTo(p.x+p.w+SDX*H,p.y+SDY*H);ctx.lineTo(p.x+SDX*H,p.y+SDY*H);ctx.closePath();ctx.fill();
  if(s>2){ctx.fillStyle='#5a5e62';for(let x=p.x+1;x<p.x+p.w;x+=4)ctx.fillRect(x,p.y+0.3,0.12,p.h-0.6)}
  const g=ctx.createLinearGradient(p.x,p.y,p.x+p.w*0.25,p.y+p.h);g.addColorStop(0,'#33497a');g.addColorStop(0.45,'#1f2d50');g.addColorStop(1,'#151e36');ctx.fillStyle=g;ctx.fillRect(p.x,p.y,p.w,p.h);
  if(s>0.9){ctx.strokeStyle='rgba(196,204,214,0.55)';ctx.lineWidth=M.max(0.04,0.35/s);ctx.beginPath();for(let x=p.x;x<=p.x+p.w+0.01;x+=1.0){ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h)}ctx.moveTo(p.x,p.y+p.h/2);ctx.lineTo(p.x+p.w,p.y+p.h/2);ctx.stroke();ctx.strokeRect(p.x,p.y,p.w,p.h)}
  if(s>4){ctx.strokeStyle='rgba(120,150,200,0.25)';ctx.lineWidth=0.02;ctx.beginPath();for(let x=p.x+0.167;x<p.x+p.w;x+=0.167){ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h)}for(let y=p.y+0.16;y<p.y+p.h;y+=0.16){ctx.moveTo(p.x,y);ctx.lineTo(p.x+p.w,y)}ctx.stroke()}
  const gl=ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y+p.h);gl.addColorStop(0,'rgba(200,220,255,0)');gl.addColorStop(0.42,'rgba(200,220,255,0.16)');gl.addColorStop(0.5,'rgba(220,232,255,0.06)');gl.addColorStop(1,'rgba(200,220,255,0)');ctx.fillStyle=gl;ctx.fillRect(p.x,p.y,p.w,p.h)}
// UAVs (top view, local metres, nose along +x): 0 Lancet loitering munition (tandem X wings, pusher prop),
// 1 Geran-3 jet (delta wing, winglets, turbojet on the back), 2 Orlan-10 recon (high straight wing, tail, tractor prop)
const UAVC=[[[176,178,160],[120,124,104],[88,92,78]],[[86,90,94],[60,64,68],[150,154,158]],[[196,198,196],[150,156,160],[96,104,110]]];
function drawUav(ctx,v,c,s,sh){const P=UAVC[v],k=(c|0)%3,body=k===1&&v===0?[150,140,110]:P[0],dk=P[1],ac=P[2];ctx.lineJoin='round';
  const shd=(f)=>{if(!sh)return;ctx.save();ctx.translate(SDX*0.5+0.15,SDY*0.5+0.12);ctx.fillStyle='rgba(10,14,20,0.3)';f(true);ctx.restore()};
  if(v===0){const L=1.65;const shape=(o)=>{ctx.beginPath();ctx.ellipse(0,0,L/2,0.09,0,0,TAU);for(const [cx,sp] of [[0.38,0.5],[-0.42,0.52]])for(const sg of [-1,1]){ctx.moveTo(cx+0.06,0);ctx.lineTo(cx-0.12,sg*sp);ctx.lineTo(cx-0.22,sg*sp);ctx.lineTo(cx-0.08,0)}if(o)ctx.fill()};
    shd(shape);ctx.fillStyle=cs(body,1);shape(false);ctx.fill();ctx.strokeStyle=cs(dk,0.8);ctx.lineWidth=0.02;ctx.stroke();
    ctx.fillStyle=cs(dk,1);ctx.beginPath();ctx.ellipse(0.75,0,0.1,0.07,0,0,TAU);ctx.fill();ctx.fillStyle='rgba(30,40,60,0.9)';ctx.beginPath();ctx.arc(0.8,0,0.04,0,TAU);ctx.fill();
    if(s>3){ctx.fillStyle='rgba(40,40,40,0.35)';ctx.beginPath();ctx.ellipse(-0.86,0,0.04,0.2,0,0,TAU);ctx.fill()}
    ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fillRect(-0.6,-0.03,1.2,0.025)}
  else if(v===1){const shape=(o)=>{ctx.beginPath();ctx.moveTo(1.75,0);ctx.lineTo(0.6,-0.18);ctx.lineTo(-0.9,-1.25);ctx.lineTo(-1.25,-1.25);ctx.lineTo(-1.1,-0.2);ctx.lineTo(-1.6,-0.14);ctx.lineTo(-1.6,0.14);ctx.lineTo(-1.1,0.2);ctx.lineTo(-1.25,1.25);ctx.lineTo(-0.9,1.25);ctx.lineTo(0.6,0.18);ctx.closePath();if(o)ctx.fill()};
    shd(shape);const g=ctx.createLinearGradient(0,-1.2,0,1.2);g.addColorStop(0,cs(body,0.8));g.addColorStop(0.5,cs(body,1.15));g.addColorStop(1,cs(body,0.75));ctx.fillStyle=g;shape(false);ctx.fill();ctx.strokeStyle=cs(dk,0.7);ctx.lineWidth=0.03;ctx.stroke();
    ctx.fillStyle=cs(dk,1);for(const sg of [-1,1])ctx.fillRect(-1.25,sg*1.25-0.04,0.42,0.08);
    // turbojet on the back: intake, nacelle, nozzle
    const ng=ctx.createLinearGradient(0,-0.17,0,0.17);ng.addColorStop(0,'#2a2c2e');ng.addColorStop(0.5,'#6a6e72');ng.addColorStop(1,'#1e2022');ctx.fillStyle=ng;ctx.beginPath();ctx.ellipse(-0.75,0,0.72,0.16,0,0,TAU);ctx.fill();
    ctx.fillStyle='#141516';ctx.beginPath();ctx.ellipse(-0.06,0,0.05,0.12,0,0,TAU);ctx.fill();ctx.fillStyle='#3a2a20';ctx.beginPath();ctx.ellipse(-1.45,0,0.06,0.11,0,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.18)';ctx.fillRect(0.2,-0.05,1.3,0.04);if(s>3){ctx.fillStyle='#c83a30';ctx.fillRect(1.2,-0.03,0.25,0.06)}}
  else{const shape=(o)=>{ctx.beginPath();ctx.ellipse(0.05,0,0.9,0.1,0,0,TAU);ctx.rect(0.1,-1.55,0.26,3.1);ctx.rect(-0.85,-0.45,0.16,0.9);if(o)ctx.fill()};
    shd(shape);ctx.fillStyle=cs(body,1);ctx.beginPath();ctx.rect(0.1,-1.55,0.26,3.1);ctx.fill();ctx.fillStyle=cs(body,0.86);ctx.fillRect(0.1,-1.55,0.26,0.07);ctx.fillRect(0.1,1.48,0.26,0.07);
    ctx.fillStyle=cs(body,1.05);ctx.beginPath();ctx.ellipse(0.05,0,0.9,0.1,0,0,TAU);ctx.fill();ctx.fillStyle=cs(dk,1);ctx.fillRect(-0.85,-0.45,0.16,0.9);ctx.fillRect(-0.9,-0.02,0.3,0.04);
    ctx.fillStyle='rgba(30,36,46,0.85)';ctx.beginPath();ctx.ellipse(0.55,0,0.14,0.07,0,0,TAU);ctx.fill();ctx.fillStyle=cs(ac,1);ctx.beginPath();ctx.arc(0.25,0.12,0.06,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(30,30,30,0.3)';ctx.beginPath();ctx.ellipse(0.98,0,0.03,0.24,0,0,TAU);ctx.fill();ctx.fillStyle='#2a2a2a';ctx.fillRect(0.94,-0.03,0.06,0.06)}}
// pneumatic launch catapult on a trailer: the rail rises towards the nose, a UAV sits on the shuttle
function drawCat(ctx,p,s){const C=CAMO[p.c||0],L=13,H=2.6;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);
  ctx.fillStyle='rgba(14,18,28,0.3)';ctx.beginPath();ctx.moveTo(0,-0.6);ctx.lineTo(L+SDX*H,-0.6+SDY*H);ctx.lineTo(L+SDX*H,0.6+SDY*H);ctx.lineTo(0,0.6);ctx.closePath();ctx.fill();ctx.fillRect(-4+SDX*0.8,-1.2+SDY*0.8,4.6,2.4);
  ctx.fillStyle='#222';for(const wx of [-3.2,-1.6])for(const sg of [-1,1])ctx.fillRect(wx-0.4,sg*1.1-0.15,0.8,0.3);
  ctx.fillStyle=cs(C[0],1);ctx.fillRect(-4,-1.05,4.4,2.1);ctx.fillStyle=cs(C[1],1);ctx.fillRect(-3.6,-0.8,1.8,1.6);ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(-4,-1.05,4.4,0.3);
  // the rail: a lattice beam from the trailer up to the end support
  const ex=L+LNX*H,ey=LNY*H;ctx.strokeStyle='#3c3e3a';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ex,ey);ctx.stroke();ctx.strokeStyle='#8a8c86';ctx.lineWidth=0.16;ctx.beginPath();ctx.moveTo(0,-0.2);ctx.lineTo(ex,ey-0.2);ctx.moveTo(0,0.2);ctx.lineTo(ex,ey+0.2);ctx.stroke();
  if(s>2){ctx.strokeStyle='rgba(60,62,58,0.8)';ctx.lineWidth=0.05;ctx.beginPath();for(let t=0.05;t<1;t+=0.08){ctx.moveTo(ex*t,ey*t-0.25);ctx.lineTo(ex*(t+0.04),ey*(t+0.04)+0.25)}ctx.stroke()}
  ctx.strokeStyle='#4a4c48';ctx.lineWidth=0.22;ctx.beginPath();ctx.moveTo(L,0);ctx.lineTo(ex,ey);ctx.moveTo(L*0.6,0);ctx.lineTo(L*0.6+LNX*H*0.6,LNY*H*0.6);ctx.stroke();
  ctx.translate(ex*0.75,ey*0.75);drawUav(ctx,p.v===2?2:0,p.c,s,0);ctx.restore()}
// headframe over a mine shaft: two A-frame legs, braces, the sheave wheels on top
function drawHead(ctx,p,s){const H=p.H,tx=p.x+LNX*H,ty=p.y+LNY*H,sx=p.x+SDX*H,sy=p.y+SDY*H;ctx.lineCap='round';
  ctx.strokeStyle='rgba(14,18,28,0.3)';ctx.lineWidth=1.2;ctx.beginPath();for(const o of [-4,4]){ctx.moveTo(p.x+o,p.y-5);ctx.lineTo(sx+o*0.3,sy);ctx.moveTo(p.x+o,p.y+5);ctx.lineTo(sx+o*0.3,sy)}ctx.stroke();
  ctx.fillStyle='rgba(14,18,28,0.3)';ctx.beginPath();ctx.arc(sx,sy,2.6,0,TAU);ctx.fill();
  ctx.strokeStyle='#8a3a2c';ctx.lineWidth=0.9;ctx.beginPath();for(const o of [-4,4]){ctx.moveTo(p.x+o,p.y-5);ctx.lineTo(tx+o*0.3,ty);ctx.moveTo(p.x+o,p.y+5);ctx.lineTo(tx+o*0.3,ty)}ctx.stroke();
  ctx.strokeStyle='#a84a36';ctx.lineWidth=0.35;ctx.beginPath();for(let t=0.25;t<0.95;t+=0.22){const ax=p.x+(tx-p.x)*t,ay=p.y+(ty-p.y)*t;ctx.moveTo(ax-4*(1-t*0.7),ay-5*(1-t));ctx.lineTo(ax+4*(1-t*0.7),ay+5*(1-t));ctx.moveTo(ax+4*(1-t*0.7),ay-5*(1-t));ctx.lineTo(ax-4*(1-t*0.7),ay+5*(1-t))}ctx.stroke();
  ctx.fillStyle='#5a5c5e';ctx.fillRect(tx-3,ty-2,6,4);for(const o of [-1.4,1.4]){ctx.strokeStyle='#c8c8c0';ctx.lineWidth=0.35;ctx.beginPath();ctx.arc(tx+o,ty,1.5,0,TAU);ctx.stroke();ctx.strokeStyle='#6a6c6e';ctx.lineWidth=0.12;ctx.beginPath();ctx.moveTo(tx+o-1.5,ty);ctx.lineTo(tx+o+1.5,ty);ctx.moveTo(tx+o,ty-1.5);ctx.lineTo(tx+o,ty+1.5);ctx.stroke()}
  ctx.strokeStyle='rgba(30,30,30,0.7)';ctx.lineWidth=0.08;ctx.beginPath();ctx.moveTo(tx-1.4,ty+1.5);ctx.lineTo(p.x-1.4,p.y);ctx.moveTo(tx+1.4,ty+1.5);ctx.lineTo(p.x+1.4,p.y);ctx.stroke();ctx.lineCap='butt'}
// elevated belt conveyor rising from the first point to the second (height H at the far end)
function drawConv(ctx,p,s){const [ax,ay,bx,by]=p.pts,H=p.H,dx=bx-ax,dy=by-ay,L=M.hypot(dx,dy),nx=-dy/L,ny=dx/L;
  ctx.fillStyle='rgba(14,18,28,0.28)';ctx.beginPath();ctx.moveTo(ax+nx*0.9,ay+ny*0.9);ctx.lineTo(bx+SDX*H+nx*0.9,by+SDY*H+ny*0.9);ctx.lineTo(bx+SDX*H-nx*0.9,by+SDY*H-ny*0.9);ctx.lineTo(ax-nx*0.9,ay-ny*0.9);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#6a6a66';ctx.lineWidth=0.3;ctx.beginPath();for(let t=8;t<L;t+=8){const f=t/L,x=ax+dx*f,y=ay+dy*f;ctx.moveTo(x,y);ctx.lineTo(x+LNX*H*f,y+LNY*H*f)}ctx.stroke();
  const ex=bx+LNX*H,ey=by+LNY*H;ctx.lineCap='butt';ctx.strokeStyle='#8c8e8a';ctx.lineWidth=1.9;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ex,ey);ctx.stroke();ctx.strokeStyle='#2c2c2a';ctx.lineWidth=0.9;ctx.stroke();
  if(s>1.5){ctx.strokeStyle='rgba(120,100,80,0.8)';ctx.lineWidth=0.5;ctx.setLineDash([1.2,0.8]);ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([])}}
// gas wellhead in its cellar: the master valves, the wing valves, the choke and a gauge
function drawWell(ctx,p,s){ctx.fillStyle='#4a4c4e';ctx.fillRect(p.x-2.4,p.y-2.4,4.8,4.8);ctx.fillStyle='#2a2c2e';ctx.fillRect(p.x-1.9,p.y-1.9,3.8,3.8);
  ctx.fillStyle='rgba(14,18,28,0.35)';ctx.fillRect(p.x-0.5+SDX*2.2,p.y-1.6+SDY*2.2,1,3.2);ctx.fillStyle='#c83a2c';ctx.fillRect(p.x-0.45,p.y-1.5,0.9,3.0);ctx.fillRect(p.x-1.6,p.y-0.35,3.2,0.7);
  ctx.fillStyle='#e0b028';for(const [a,b] of [[0,-1.1],[0,1.1],[-1.1,0],[1.1,0]]){ctx.beginPath();ctx.arc(p.x+a,p.y+b,0.32,0,TAU);ctx.fill()}ctx.fillStyle='#d8d8d0';ctx.beginPath();ctx.arc(p.x,p.y,0.28,0,TAU);ctx.fill()}
// flagpole with the state flag; the cloth flies downwind (drawn as a slanted panel so it reads from above)
function drawFlagPole(ctx,p,s){const H=p.H,tx=p.x+LNX*H,ty=p.y+LNY*H;ctx.lineCap='round';
  ctx.strokeStyle='rgba(10,14,20,0.35)';ctx.lineWidth=0.16;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+SDX*H,p.y+SDY*H);ctx.stroke();
  ctx.strokeStyle='#dcdcd6';ctx.lineWidth=0.18;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(tx,ty);ctx.stroke();ctx.lineCap='butt';
  if(!FLAG||!p.fl||s<1.2)return;const wx=WDX*FCA+WDY*FSA,wy=-WDX*FSA+WDY*FCA,ll=M.hypot(LNX,LNY)||1,lx=-LNX/ll,ly=-LNY/ll,fw=3.4,fh=2.2;
  // shadow of the cloth
  ctx.save();ctx.transform(wx,wy,lx*0.25,ly*0.25,p.x+SDX*(H-1),p.y+SDY*(H-1));ctx.fillStyle='rgba(10,14,20,0.25)';ctx.fillRect(0,0,fw,fh);ctx.restore();
  ctx.save();ctx.transform(wx,wy,lx*0.55,ly*0.55,tx,ty);FLAG.draw(ctx,p.fl,0,0,fw,fh);
  const g=ctx.createLinearGradient(0,0,fw,0);for(let q=0;q<=4;q++)g.addColorStop(q/4,q%2?'rgba(0,0,0,0.22)':'rgba(255,255,255,0.12)');ctx.fillStyle=g;ctx.fillRect(0,0,fw,fh);ctx.restore()}
const CARC=[[235,235,232],[200,202,206],[40,42,46],[170,30,30],[40,70,140],[120,122,126],[50,80,60],[230,190,40],[190,170,140],[90,30,40],[230,230,230],[30,30,32]];
// tree sprite (128 px, crown centre at 0.44): per-pixel crown height field from leaf clusters, lit from the sun,
// with ambient occlusion, ragged leafy edge and a soft ground shadow. Conifers: star-shaped tiers with branch ridges.
function vn2(x,y,sd){const ix=M.floor(x),iy=M.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);const h=(a,b)=>(hh(a,b,sd)&65535)/65535;
  const a=h(ix,iy),b=h(ix+1,iy),c=h(ix,iy+1),d=h(ix+1,iy+1);return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy}
function mkTree(v,se){const N=128,C=56,cv=mkCanvas(N,N),x=cv.getContext('2d');const R=rng(777+v*31);const con=v===3||v===5;
  // ground shadow (crown footprint shifted along the sun)
  {const g=x.createRadialGradient(C+14,C+11,4,C+14,C+11,46);const sa=se===2&&!con?0.45:1;g.addColorStop(0,`rgba(5,14,5,${0.5*sa})`);g.addColorStop(0.65,`rgba(5,14,5,${0.32*sa})`);g.addColorStop(1,'rgba(5,14,5,0)');x.fillStyle=g;x.fillRect(0,0,N,N)}
  let pal=[[62,102,46],[52,92,40],[78,112,50],[38,70,44],[88,118,56],[34,64,42],[96,110,48]][v];
  if(se===1&&!con)pal=[[176,98,34],[196,158,46],[152,54,34],0,[150,138,50],0,[128,88,48]][v];
  if(se===2&&con)pal=[30,52,38];
  if(se===2&&!con){x.save();x.scale(2,2);x.lineCap='round';const nb=6+(R()*4|0);
    for(let b=0;b<nb;b++){const a=R()*TAU,l=13+R()*8;const ex=28+M.cos(a)*l,ey=28+M.sin(a)*l;
      x.strokeStyle='rgba(84,70,58,0.95)';x.lineWidth=2.2;x.beginPath();x.moveTo(28,28);x.lineTo(ex,ey);x.stroke();
      x.lineWidth=0.8;x.strokeStyle='rgba(100,86,72,0.8)';for(let q=0;q<4;q++){const t=0.35+R()*0.55,a2=a+(R()-0.5)*1.6,l2=3+R()*6;const sx=28+(ex-28)*t,sy=28+(ey-28)*t;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+M.cos(a2)*l2,sy+M.sin(a2)*l2);x.stroke()}}
    x.fillStyle='rgba(70,58,48,1)';x.beginPath();x.arc(28,28,2.6,0,TAU);x.fill();
    for(let k=0;k<50;k++){const a=R()*TAU,d=R()*15;x.fillStyle='rgba(245,248,252,0.55)';x.fillRect(28+M.cos(a)*d-1,28+M.sin(a)*d-1,1.4,1.4)}x.restore();return cv}
  const Rc=con?38:40*(0.88+R()*0.16),K=[];
  if(!con){const nk=14+(R()*10|0);for(let k=0;k<nk;k++){const a=R()*TAU,d=M.sqrt(R())*Rc*0.6;K.push([C+M.cos(a)*d,C+M.sin(a)*d,Rc*(0.3+R()*0.2),0.86+R()*0.28])}}
  const nbr=9+(v&3),rot=R()*TAU,sd=v*131+se*7+5;
  const H=(px,py)=>{if(con){const dx=px-C,dy=py-C,d=M.hypot(dx,dy),a=M.atan2(dy,dx);const tier=M.max(0,1-d/Rc);if(tier<=0)return [-1,0];
      const ridge=M.pow(M.abs(M.cos((a+rot)*nbr/2+d*0.05+vn2(px*0.2,py*0.2,sd)*1.5)),0.8);const edge=Rc*(0.8+0.2*ridge)*(0.9+0.2*vn2(px*0.3,py*0.3,sd+3));if(d>edge)return [-1,0];
      return [(1-d/edge)*Rc*0.9+ridge*3+vn2(px*0.7,py*0.7,sd)*2.2,1]}
    let best=-1,bi=0;for(let k=0;k<K.length;k++){const c=K[k],dx=px-c[0],dy=py-c[1],q=c[2]*c[2]-dx*dx-dy*dy;if(q>0){const h=M.sqrt(q)+(1-k/K.length)*3;if(h>best){best=h;bi=k}}}
    if(best<0)return [-1,0];const lf=vn2(px*0.55,py*0.55,sd)*3.2+vn2(px*1.4,py*1.4,sd+1)*1.6;return [best+lf,K[bi][3]]};
  const img=x.getImageData(0,0,N,N),d=img.data;const L=[-0.58,-0.46,0.67];let hm=1;const HB=new Float32Array(N*N),TB=new Float32Array(N*N);
  for(let py=0;py<N;py++)for(let px=0;px<N;px++){const q=py*N+px;const [h,t]=H(px,py);HB[q]=h;TB[q]=t;if(h>hm)hm=h}
  for(let py=1;py<N-1;py++)for(let px=1;px<N-1;px++){const q=py*N+px,h=HB[q];if(h<0)continue;
    const hx=(HB[q+1]<0?h-2:HB[q+1])-(HB[q-1]<0?h-2:HB[q-1]),hy=(HB[q+N]<0?h-2:HB[q+N])-(HB[q-N]<0?h-2:HB[q-N]);
    const nx=-hx*0.5,ny=-hy*0.5,nz=1,nl=M.hypot(nx,ny,nz);const lam=M.max(0,(nx*L[0]+ny*L[1]+nz*L[2])/nl);const ao=0.55+0.45*M.min(1,h/hm*1.3);
    const t=TB[q],sh=(0.32+0.95*lam)*ao*t,hi=M.pow(lam,6)*0.25;const edge=clamp(h/2.5,0,1)*(vn2(px*0.9,py*0.9,sd+2)>0.25||h>4?1:0.4);
    const o=q*4,cr=pal[0]*sh+hi*90+8,cg=pal[1]*sh+hi*100+10,cb=pal[2]*sh+hi*40+4;const a=edge;
    d[o]=d[o]*(1-a)+cr*a;d[o+1]=d[o+1]*(1-a)+cg*a;d[o+2]=d[o+2]*(1-a)+cb*a;d[o+3]=M.min(255,d[o+3]*(1-a)+255*a)}
  x.putImageData(img,0,0);
  if(se===2&&con){for(let k=0;k<140;k++){const a=R()*TAU,dd=R()*34;if(M.cos(a)+M.sin(a)>0.6&&R()<0.6)continue;x.fillStyle=`rgba(240,245,250,${0.5+R()*0.4})`;x.fillRect(C+M.cos(a)*dd-1,C+M.sin(a)*dd-1,2.5,2.5)}}
  return cv}
function rr(x,X,Y,W,H,r){x.beginPath();x.moveTo(X+r,Y);x.lineTo(X+W-r,Y);x.quadraticCurveTo(X+W,Y,X+W,Y+r);x.lineTo(X+W,Y+H-r);x.quadraticCurveTo(X+W,Y+H,X+W-r,Y+H);x.lineTo(X+r,Y+H);x.quadraticCurveTo(X,Y+H,X,Y+H-r);x.lineTo(X,Y+r);x.quadraticCurveTo(X,Y,X+r,Y);x.closePath()}
function cs(c,k){return 'rgb('+M.min(255,c[0]*k|0)+','+M.min(255,c[1]*k|0)+','+M.min(255,c[2]*k|0)+')'}
function mkCar(c,v){ // 5 x 2.5 m; drawn at 40 px/m so it stays sharp at the closest zoom. v: 0 sedan, 1 hatchback, 2 SUV
  const K=4,cv=mkCanvas(50*K,25*K),x=cv.getContext('2d');x.scale(K,K);v=v||0;
  const L0=3,L1=47,T=3.6,B=21.4,W=B-T,cy=(T+B)/2,rear=v===1?11.5:v===2?9:11,fwd=v===2?35.5:33,roofA=rear+(v===1?1.5:3.2),roofB=fwd-(v===2?3:4.5);
  // soft shadow
  x.fillStyle='rgba(0,0,0,0.16)';rr(x,L0+1.6,T+1.4,L1-L0,W+0.6,6.5);x.fill();x.fillStyle='rgba(0,0,0,0.18)';rr(x,L0+0.8,T+0.7,L1-L0,W,6);x.fill();
  // tyres peeking out at the corners
  x.fillStyle='#161616';for(const wx of [L0+6.5,L1-8.5])for(const wy of [T-0.35,B-1.65])rr(x,wx,wy,5,2,0.8),x.fill();
  // body: rounded box shaded across the width (sides darker, crown lit)
  let g=x.createLinearGradient(0,T,0,B);g.addColorStop(0,cs(c,0.62));g.addColorStop(0.18,cs(c,1.0));g.addColorStop(0.5,cs(c,1.16));g.addColorStop(0.82,cs(c,0.96));g.addColorStop(1,cs(c,0.58));
  x.fillStyle=g;rr(x,L0,T,L1-L0,W,v===2?4.5:6);x.fill();
  // bonnet and boot panel lines, bumpers
  x.strokeStyle=cs(c,0.7);x.lineWidth=0.25;x.beginPath();x.moveTo(fwd+1.2,T+2.2);x.quadraticCurveTo(fwd+6,cy,fwd+1.2,B-2.2);x.moveTo(rear-1,T+2.4);x.quadraticCurveTo(rear-4.5,cy,rear-1,B-2.4);x.stroke();
  x.fillStyle='rgba(30,30,30,0.55)';rr(x,L1-1.6,T+2.5,1.6,W-5,0.6);x.fill();rr(x,L0,T+2.5,1.4,W-5,0.6);x.fill();
  // glasshouse: windscreen, rear window, side windows; roof panel with a sheen
  x.fillStyle='rgba(22,32,44,0.94)';x.beginPath();x.moveTo(roofB,T+2.6);x.lineTo(fwd,T+1.6);x.quadraticCurveTo(fwd+1.4,cy,fwd,B-1.6);x.lineTo(roofB,B-2.6);x.closePath();x.fill();
  x.beginPath();x.moveTo(roofA,T+2.6);x.lineTo(rear,T+1.9);x.quadraticCurveTo(rear-1.2,cy,rear,B-1.9);x.lineTo(roofA,B-2.6);x.closePath();x.fill();
  x.fillRect(roofA,T+1.0,roofB-roofA,1.5);x.fillRect(roofA,B-2.5,roofB-roofA,1.5);
  x.fillStyle='rgba(190,215,235,0.32)';x.beginPath();x.moveTo(roofB+0.4,T+3);x.lineTo(fwd-0.6,T+2.4);x.lineTo(fwd-0.2,T+5.5);x.lineTo(roofB+0.6,T+5.8);x.closePath();x.fill();
  x.strokeStyle=cs(c,0.75);x.lineWidth=0.3;x.beginPath();const pil=(roofA+roofB)/2;x.moveTo(pil,T+1);x.lineTo(pil,T+2.6);x.moveTo(pil,B-1);x.lineTo(pil,B-2.6);x.stroke();
  g=x.createLinearGradient(0,T+2.6,0,B-2.6);g.addColorStop(0,cs(c,0.92));g.addColorStop(0.45,cs(c,1.22));g.addColorStop(1,cs(c,0.88));x.fillStyle=g;rr(x,roofA,T+2.6,roofB-roofA,W-5.2,1.6);x.fill();
  x.fillStyle='rgba(255,255,255,0.16)';x.fillRect(roofA+1,T+3.6,roofB-roofA-2,1.1);
  if(v===2){x.strokeStyle='rgba(30,30,30,0.6)';x.lineWidth=0.35;x.beginPath();x.moveTo(roofA+1,T+3.4);x.lineTo(roofB-1,T+3.4);x.moveTo(roofA+1,B-3.4);x.lineTo(roofB-1,B-3.4);x.stroke()}
  // mirrors, head and tail lights
  x.fillStyle=cs(c,0.8);x.fillRect(roofB+0.5,T-0.9,1.4,1.1);x.fillRect(roofB+0.5,B-0.2,1.4,1.1);
  x.fillStyle='rgba(255,250,225,0.98)';rr(x,L1-2.4,T+0.9,1.9,3,0.8);x.fill();rr(x,L1-2.4,B-3.9,1.9,3,0.8);x.fill();
  x.fillStyle='rgba(200,24,20,0.96)';rr(x,L0+0.2,T+1,1.5,3.2,0.6);x.fill();rr(x,L0+0.2,B-4.2,1.5,3.2,0.6);x.fill();
  return cv}
function mkTruck(v){const cv=mkCanvas(340,68),x=cv.getContext('2d');x.scale(2,2);const tc=[[235,235,235],[200,60,40],[40,90,160],[220,200,60],[90,100,90]][v];
  x.fillStyle='rgba(0,0,0,0.3)';x.fillRect(6,7,162,25);
  x.fillStyle=cs(tc,1);x.fillRect(3,4,128,25);x.fillStyle='rgba(0,0,0,0.12)';for(let k=8;k<128;k+=10)x.fillRect(3+k,4,1,25);
  x.fillStyle='rgba(255,255,255,0.15)';x.fillRect(3,4,128,4);
  const cc=[[200,30,30],[240,240,240],[40,40,40],[30,80,150],[230,120,30]][(v+2)%5];x.fillStyle='#222';x.fillRect(131,9,6,15);
  x.fillStyle=cs(cc,1);rr(x,137,5,26,24,3);x.fill();x.fillStyle='rgba(25,35,45,0.9)';x.fillRect(158,7,4,20);x.fillStyle=cs(cc,1.2);x.fillRect(140,8,14,18);return cv}
function mkBus(){const cv=mkCanvas(250,60),x=cv.getContext('2d');x.scale(2,2);x.fillStyle='rgba(0,0,0,0.3)';x.fillRect(5,6,118,23);
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
const gQX=new Float32Array(GN*GN),gQY=new Float32Array(GN*GN),gH=new Float32Array(GN*GN),gR=new Float32Array(GN*GN),gW=new Float32Array(GN*GN),gM=new Float32Array(GN*GN),gF=new Float32Array(GN*GN),gA=new Float32Array(GN*GN),gU=new Float32Array(GN*GN),gS=new Float32Array(GN*GN),gGR=new Float32Array(GN*GN),gGH=new Float32Array(GN*GN),gHS=new Float32Array(GN*GN),gMS=new Float32Array(GN*GN),gCV=new Float32Array(GN*GN),MC1=new Float32Array(400),MC2=new Float32Array(400);
const LX=-0.55,LY=-0.62,LZ=0.56;const LN_=M.hypot(LX,LY,LZ);
let VCx=1e9,VCy=1e9;const VP=new Float64Array(27),VF=new Float32Array(9);
// game worlds: is the field system with centre (x, y) ploughed? Each settlement farms the systems whose centres lie
// within a ragged reach (0.62..1.3 of fieldR, random per system); some systems stay meadow even inside
function fieldR(c){const g=GROW.size?growFields(c):1;return (c.type===0?c.R+2300:c.R+3300)*g}
function fieldOn(x,y,h){if(h%9===0)return 0;const t=0.62+((h>>>21)&1023)/1023*0.68;if(baseH(x,y,5)>0.3)return 0;
  for(const c of live){const R=fieldR(c);if(R<=0)continue;const dx=x-c.x,dy=y-c.y;if(dx*dx+dy*dy<R*R*t*t)return 1}return 0}
const AUT=[[178,96,30],[200,160,44],[156,52,30],[150,124,44]];
// SPLIT: part of the hillshade is kept in SHD and applied after the vector layers (grain), so houses,
// plots and roads on slopes are lit like the terrain under them instead of looking pasted on flat ground
let SPLIT=false;const SHD=new Float32Array(256*256);
function raster(ctx,x0,y0,mpp,near){const WIN=SEASON===2;if(EMPTY)VCx=1e9;
  const st=GS*mpp;const oct=clamp(M.ceil(M.log2(30000/(st*1.2))),3,13);
  const ex=1+clamp(M.log2(mpp)*0.25,0,1.6);
  let k=0;
  for(let gj=0;gj<GN;gj++){const wy=y0+(gj-1.5)*st;for(let gi=0;gi<GN;gi++,k++){const wx=x0+(gi-1.5)*st;
    const e=baseH(wx,wy,oct);gH[k]=e;const rv=riverV(wx,wy);gR[k]=rv;const w=riverW(wx,wy,e);gW[k]=w;
    gM[k]=moist(wx,wy);gF[k]=noise(wx/1900+3.3,wy/1900-7.1)*0.6+noise(wx/520+1.7,wy/520+9.9)*0.4;
    let fa=EMPTY?0:smooth(0.0,0.3,noise(wx/15000+61.1,wy/15000-12.3)),u=0;
    for(let q=0;q<near.length;q++){const c=near[q];if(c.kind==='zone'){const dx=wx-c.x,dy=wy-c.y;const lx=dx*c.ca+dy*c.sa,ly=-dx*c.sa+dy*c.ca;
        const v=smooth(1.08,0.98,M.max(M.abs(lx)/(c.W/2),M.abs(ly)/(c.H/2)));if(TINTZ[c.zk]&&v>u)u=v*0.8;continue}
      const dx=wx-c.x,dy=wy-c.y,d2=dx*dx+dy*dy,R2=EMPTY?fieldR(c)*1.3+3400:c.R+4500;if(d2>R2*R2)continue;const d=M.sqrt(d2);
      // game worlds: only the reach of the farmland (which field systems are ploughed is decided per field system below)
      const fv=EMPTY?smooth(R2,R2-800,d):smooth(c.R+4500,c.R+600,d)*(c.type===0?0.85:1)*(GROW.size?growFields(c):1);if(fv>fa)fa=fv;
      if(d<c.R*1.6){const f=cityF(c,wx,wy)*(c.type===0?0.8:1)+(GROW.size?growShift(c):0);const v=smooth(1.1,0.92,f)*(c.type===0?0.12:1);if(v>u)u=v}}
    gA[k]=fa;gU[k]=u;
    // game worlds: field systems are looked up through a smooth domain warp, so the edge between farmland and wood or
    // meadow (and the field tracks between systems) curves like a real clearing instead of following straight Voronoi edges
    if(EMPTY){gQX[k]=noise(wx/2100+5.3,wy/2100-2.7)*330+noise(wx/640+1.9,wy/640+7.7)*70;gQY[k]=noise(wx/2100-8.1,wy/2100+4.4)*330+noise(wx/640-3.3,wy/640-6.1)*70}
    const r=M.abs(rv);gHS[k]=e}}
  // macro relief (smooth 4-octave height, 250 m stencil) on a 4x coarser grid, bilinearly upsampled:
  // readable hills / valleys / hilltops that do not depend on zoom
  {const CS=4,NC=M.ceil((GN-1)/CS)+1;const cM=MC1,cC=MC2;
    for(let cj=0;cj<NC;cj++)for(let ci=0;ci<NC;ci++){const wx=x0+(ci*CS-1.5)*st,wy=y0+(cj*CS-1.5)*st;const H=250,c0=baseH(wx,wy,4),eE=baseH(wx+H,wy,4),eW=baseH(wx-H,wy,4),eN=baseH(wx,wy-H,4),eS=baseH(wx,wy+H,4);
      const zx=(eE-eW)/(2*H)*ELEV*1.7,zy=(eS-eN)/(2*H)*ELEV*1.7,nl=M.sqrt(zx*zx+zy*zy+1);const lam=((-zx*LX-zy*LY+LZ)/nl)/LZ;
      cM[cj*NC+ci]=clamp(1+(lam-1)*0.5,0.72,1.12);cC[cj*NC+ci]=clamp((c0-(eE+eW+eN+eS)/4)*ELEV/14,-1,1)*smooth(0,0.01,c0)}
    for(let gj=0;gj<GN;gj++){const fy=gj/CS,cj=M.min(NC-2,fy|0),ty=fy-cj;for(let gi=0;gi<GN;gi++){const fx=gi/CS,ci=M.min(NC-2,fx|0),tx=fx-ci,q=cj*NC+ci,k=gj*GN+gi;
      gMS[k]=(cM[q]*(1-tx)+cM[q+1]*tx)*(1-ty)+(cM[q+NC]*(1-tx)+cM[q+NC+1]*tx)*ty;gCV[k]=(cC[q]*(1-tx)+cC[q+1]*tx)*(1-ty)+(cC[q+NC]*(1-tx)+cC[q+NC+1]*tx)*ty}}}
  for(let gj=1;gj<GN-1;gj++)for(let gi=1;gi<GN-1;gi++){const k=gj*GN+gi;
    const dhx=(gHS[k+1]-gHS[k-1])/(2*st),dhy=(gHS[k+GN]-gHS[k-GN])/(2*st);const zx=dhx*ELEV*ex,zy=dhy*ELEV*ex;
    const nl=M.sqrt(zx*zx+zy*zy+1);gS[k]=((-zx*LX-zy*LY+LZ)/nl)/(LZ);
    gGH[k]=M.hypot((gH[k+1]-gH[k-1])/(2*st),(gH[k+GN]-gH[k-GN])/(2*st));
    gGR[k]=M.hypot((gR[k+1]-gR[k-1])/(2*st),(gR[k+GN]-gR[k-GN])/(2*st))}
  const img=ctx.createImageData(TS,TS),d=img.data;
  const id1=1/(4*mpp),id2=1/(16*mpp);const crowns=mpp<1.7,fieldsOn=mpp<120,stripes=mpp<2.5;
  let o=0;
  for(let py=0;py<TS;py++){const gy=(py+0.5)/GS+1.5;const j=gy|0,ty=gy-j;const wy=y0+(py+0.5)*mpp;
    for(let px=0;px<TS;px++,o+=4){SHD[o>>2]=1;const gx=(px+0.5)/GS+1.5;const i=gx|0,tx=gx-i;const k=j*GN+i;
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
        aR=clamp((ww-r)/gr+0.5,0,1);if(aR>0)aR*=M.min(1,0.22+3*ww/gr)*smooth(-0.003,0.006,e)} // the channel fades out at the mouth instead of running on into the sea
      const land=aL*(1-aR);
      let R=0,Gc=0,Bc=0;
      if(land>0){
        const mo=gM[k]*w00+gM[k+1]*w10+gM[k+GN]*w01+gM[k+GN+1]*w11;
        const fn=gF[k]*w00+gF[k+1]*w10+gF[k+GN]*w01+gF[k+GN+1]*w11;
        const ag=gA[k]*w00+gA[k+1]*w10+gA[k+GN]*w01+gA[k+GN+1]*w11;
        const u=gU[k]*w00+gU[k+1]*w10+gU[k+GN]*w01+gU[k+GN+1]*w11;
        const dry=smooth(0.3,-0.45,mo);
        R=88+44*dry+dt*8;Gc=122+14*dry+dt*9;Bc=58+24*dry+dt*5;{const hy=smooth(0.06,0.4,e)*0.32;R=lerp(R,136,hy);Gc=lerp(Gc,132,hy);Bc=lerp(Bc,86,hy)}
        if(SEASON===1){R+=30+dry*8;Gc-=2;Bc-=10}else if(WIN){R=230+dt*10;Gc=234+dt*10;Bc=240+dt*8}
        const slope=gh*ELEV;
        // forest
        const fv=mo*0.75+fn*0.6+dt*0.05;
        let fo=smooth(0.06,0.13,fv)*(1-smooth(0.04,0.25,u))*smooth(0.55,0.44,e);
        // fields
        let agv=smooth(0.25,0.55,ag)*smooth(0.36,0.22,e)*(1-smooth(0.05,0.3,u))*(1-smooth(1.2,2.5,slope));
        let i1=0,i2=0,dB=0,pdx=0,pdy=0,EDP=-1,fe=0;
        if(agv>0.01&&(fieldsOn||EMPTY)){
          // field systems: jittered Voronoi regions (each with its own furrow direction and plot sizes),
          // bounded by field tracks / hedgerows, so there are no straight seams on a fixed grid
          let qx=wx,qy=wy;if(EMPTY){qx+=gQX[k]*w00+gQX[k+1]*w10+gQX[k+GN]*w01+gQX[k+GN+1]*w11;qy+=gQY[k]*w00+gQY[k+1]*w10+gQY[k+GN]*w01+gQY[k+GN+1]*w11}
          const vx=M.floor(qx/2400),vy=M.floor(qy/2400);if(vx!==VCx||vy!==VCy){VCx=vx;VCy=vy;let q=0;for(let b2=-1;b2<=1;b2++)for(let a2=-1;a2<=1;a2++){const hq=hh(vx+a2,vy+b2,23);VP[q++]=(vx+a2+0.15+((hq&1023)/1023)*0.7)*2400;VP[q++]=(vy+b2+0.15+(((hq>>>10)&1023)/1023)*0.7)*2400;VP[q++]=hq;if(EMPTY)VF[q/3-1]=fieldOn(VP[q-3],VP[q-2],hq)}}
          let q1=1e18,q2=1e18;for(let q=0;q<27;q+=3){const dx=qx-VP[q],dy=qy-VP[q+1],dd=dx*dx+dy*dy;if(dd<q1){q2=q1;i2=i1;q1=dd;i1=q}else if(dd<q2){q2=dd;i2=q}}
          pdx=VP[i2]-VP[i1];pdy=VP[i2+1]-VP[i1+1];dB=(q2-q1)/(2*M.sqrt(pdx*pdx+pdy*pdy)+1e-6);
          // game worlds: a whole field system is ploughed or left as meadow / wood, so the farmland has the ragged outline
          // of real field patterns (no rings around the towns); 1 px blend across the boundary
          // near a boundary between ploughed and wild systems each plot decides on its own (EDP: chance to be ploughed),
          // so the edge of the farmland follows plot margins instead of a straight line
          if(EMPTY){const f1=VF[i1/3],f2=VF[i2/3];
            // wild side: the wood thins out into a meadow verge towards the nearest ploughed system (distance to its edge)
            if(!f1){let dP=1e9;for(let q=0;q<27;q+=3){if(q===i1||!VF[q/3])continue;const ex=VP[q]-VP[i1],ey=VP[q+1]-VP[i1+1],dd=(qx-VP[q])**2+(qy-VP[q+1])**2;dP=M.min(dP,(dd-q1)/(2*M.sqrt(ex*ex+ey*ey)+1e-6))}
              if(dP<1e8){const bd=260+((VP[i1+2]>>>4)&255)*1.6;fe=smooth(bd+160,bd*0.3,dP)*0.92}}else fe=0.85; // fallow plots among the crops: meadow, a few trees
            if(f1!==f2){const band=260+((VP[i1+2]>>>4)&255)*1.6;if(fieldsOn&&mpp<40&&dB<band)EDP=f1?0.5+0.5*dB/band:0.5-0.5*dB/band;else{const e2=clamp(dB/M.max(mpp,0.5),0,1)*0.5;agv*=f1?0.5+e2:0.5-e2}}else agv*=f1}}
        // wood gives way to the crops (game worlds: completely, after each plot has decided whether it is ploughed)
        const clr=()=>{if(agv>0)fo*=1-smooth(0.3,0.7,agv)*(EMPTY?1:0.85)};if(!(agv>0.01&&fieldsOn))clr();
        if(fe>0&&!crowns)fo*=1-fe;
        if(agv>0.01&&fieldsOn){
          const hR=VP[i1+2];const an=((hR>>>20)&1023)/1023*PI;const ca=M.cos(an),sa=M.sin(an);
          const lx=wx*ca+wy*sa,ly=-wx*sa+wy*ca;const fH=70+((hR>>>18)&255)*0.75;const cy=M.floor(ly/fH);const hrow=hh(cy,hR,7);
          const fW=(150+((hR>>>10)&255)*1.2)*(0.55+((hrow&255)/255)*1.1),lxs=lx+((hrow>>>8)&1023)/1023*fW;const cx=M.floor(lxs/fW);
          let hf=hh(cx,cy,hR);const ey0=ly/fH-cy;const half=(hf>>>28)&1;if(half&&ey0>0.5)hf=hh(cx,cy+7919,hR);const crop=hf&7;
          if(EDP>=0&&((hf>>>3)&1023)/1023>=EDP)agv=0;clr();
          let fr,fg,fb;
          switch(crop){case 0:fr=196;fg=172;fb=98;break;case 1:fr=122;fg=150;fb=62;break;case 2:fr=124;fg=96;fb=66;break;case 3:fr=206;fg=192;fb=72;break;
            case 4:fr=94;fg=134;fb=56;break;case 5:fr=150;fg=148;fb=92;break;case 6:fr=172;fg=158;fb=100;break;default:fr=108;fg=128;fb=70}
          if(SEASON===1){if(crop===1||crop===4||crop===7){fr=116;fg=90;fb=62}else if(crop!==2){fr=184;fg=162;fb=104}}else if(WIN){fr=226;fg=230;fb=236}
          const vv=((hf>>>8)&63)/63*0.16+0.92;fr*=vv;fg*=vv;fb*=vv;
          // in-field soil/moisture patches
          const pv=1+(noise(wx/95+hR%97,wy/95)*0.09+d1*0.04)*(WIN?0.4:1);fr*=pv;fg*=pv;fb*=pv*0.98;
          {const kc=smooth(8,90,mpp)*0.55;fr=lerp(fr,150,kc);fg=lerp(fg,150,kc);fb=lerp(fb,92,kc)}
          const ex2=lxs/fW-cx,ey2=half?(ey0<0.5?ey0*2:ey0*2-1):ey0,fHh=half?fH/2:fH;const eX=M.min(ex2,1-ex2)*fW,eY=M.min(ey2,1-ey2)*fHh;const em=M.min(eX,eY);
          if(stripes||mpp<4){ // drill rows; headlands turn the rows along the short edges; tramlines every 24 m
            const head=eX<11&&eX<eY,ax=head?lxs:ly;const amp=(0.5-0.5*smooth(0.9,2.5,mpp))*(crop===2?1.6:1)*(SEASON===1&&(crop===1||crop===4||crop===7)?2.2:WIN?0.7:1);
            if(stripes){const sv=M.sin(ax*(crop===2?1.6:2.4));fr*=1+sv*amp*0.07;fg*=1+sv*amp*0.07;fb*=1+sv*amp*0.06}
            if(!head&&crop!==2&&em>11){const tl=((ly%24)+24)%24;const tw=clamp((0.35-M.min(M.abs(tl-6),M.abs(tl-8)))/mpp+0.5,0,1)*(1-smooth(1.5,4,mpp))*(WIN?0.5:1);if(tw>0){fr=lerp(fr,fr*0.78+12,tw);fg=lerp(fg,fg*0.74+6,tw);fb=lerp(fb,fb*0.8,tw)}}}
          // grass margins between plots
          if(mpp<10){const mw=1.2+((hf>>>14)&3)*0.5;const ea=clamp((mw-em)/mpp+0.5,0,1)*(1-smooth(4,10,mpp));
            if(ea>0){if(WIN){fr=lerp(fr,214,ea);fg=lerp(fg,218,ea);fb=lerp(fb,224,ea)}else if(SEASON===1){fr=lerp(fr,138,ea);fg=lerp(fg,128,ea);fb=lerp(fb,72,ea)}else{fr=lerp(fr,96,ea);fg=lerp(fg,124,ea);fb=lerp(fb,62,ea)}}}
          if(WIN){fr=fr*0.92+14;fg=fg*0.92+16;fb=fb*0.92+18}else{fr=fr*0.72+36;fg=fg*0.72+38;fb=fb*0.72+24}fr+=dt*10;fg+=dt*10;fb+=dt*7;
          // region boundary: dirt field track with verges, or a hedgerow / shelter belt
          if(dB<12&&mpp<14){const hp=hh(M.min(VP[i1+2],VP[i2+2]),M.max(VP[i1+2],VP[i2+2]),9);const belt=(hp&7)===0;
            if(belt){const bw=3+((hp>>>4)&3)*0.8;const bnx=pdx,bny=pdy,bl=M.sqrt(bnx*bnx+bny*bny)+1e-9;const sd=(bnx*SUNX+bny*SUNY)/bl; // >0: shadow falls into the neighbour region
              if(dB<bw+0.5*mpp){const C=4.2;const cxi=M.floor(wx/C),cyi=M.floor(wy/C);let bd=9,bx=0,by=0;
                for(let b2=-1;b2<=1;b2++)for(let a2=-1;a2<=1;a2++){const hq=hh(cxi+a2,cyi+b2,29);const fx=(cxi+a2+((hq&255)/255)*0.8+0.1)*C,fy=(cyi+b2+(((hq>>>8)&255)/255)*0.8+0.1)*C;const dx=wx-fx,dy=wy-fy,dd=(dx*dx+dy*dy)/(C*C*0.5);if(dd<bd){bd=dd;bx=dx;by=dy}}
                const cr=clamp(1.2-M.sqrt(bd),0,1),lit=clamp(0.55-(bx*SUNX+by*SUNY)/(C*0.9),0.1,1);const edge=clamp((bw-dB)/M.max(mpp,0.6)+0.5,0,1)*(dB<bw*0.6?1:0.35+0.65*cr);
                let br,bg,bb;if(WIN){br=96;bg=88;bb=82;if(hp&16){br=34;bg=52;bb=42}}else if(SEASON===1&&!(hp&16)){br=150;bg=106;bb=42}else{br=46;bg=78;bb=40}
                const kk=mpp<1.7?0.55+cr*(0.5+lit*0.55):0.85;if(WIN&&!(hp&16)){br=lerp(212,br,cr*0.7);bg=lerp(214,bg,cr*0.7);bb=lerp(220,bb,cr*0.7)}
                fr=lerp(fr,br*kk,edge);fg=lerp(fg,bg*kk,edge);fb=lerp(fb,bb*kk,edge)}
              else if(sd<-0.05&&dB<bw+7*-sd){const sh=clamp((bw+7*-sd-dB)/M.max(mpp,1),0,1)*0.3;fr*=1-sh;fg*=1-sh;fb*=1-sh*0.8}}
            else{const tw=2.6,vw=5;const va=clamp((vw-dB)/mpp+0.5,0,1);if(va>0){const gr=WIN?[220,224,230]:SEASON===1?[146,132,80]:[104,128,66];fr=lerp(fr,gr[0],va);fg=lerp(fg,gr[1],va);fb=lerp(fb,gr[2],va)}
              const ta=clamp((tw/2-dB)/mpp+0.5,0,1);if(ta>0){const rut=mpp<1.2&&M.abs(dB-0.8)<0.3?0.82:1;const tr=WIN?[200,198,196]:[142,122,90];fr=lerp(fr,tr[0]*rut+dt*8,ta);fg=lerp(fg,tr[1]*rut+dt*8,ta);fb=lerp(fb,tr[2]*rut+dt*6,ta)}}}
          const a=agv*(1-fo);R=lerp(R,fr,a);Gc=lerp(Gc,fg,a);Bc=lerp(Bc,fb,a)}
        if(fo>0.003){let fr=40+dry*14,fg=70+dry*8,fb=38;
          if(crowns){const C=5.5;const cxi=M.floor(wx/C),cyi=M.floor(wy/C);let bd=9,bx=0,by=0,br=1;
            for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const hq=hh(cxi+a,cyi+b,3);const fx=(cxi+a+((hq&255)/255)*0.8+0.1)*C,fy=(cyi+b+(((hq>>>8)&255)/255)*0.8+0.1)*C;
              const rr=(0.62+((hq>>>16)&255)/255*0.5);const dx=wx-fx,dy=wy-fy;const dd=(dx*dx+dy*dy)/(rr*rr*C*C);if(dd<bd){bd=dd;bx=dx;by=dy;br=(hq>>>24)&255}}
            const dist=M.sqrt(bd);const cr=clamp(1.15-dist,0,1);const lit=clamp(0.5-(bx+by)/(C*1.3),0,1);
            if(fe>0){const keep=((br*37)&255)/255>fe;fo*=keep?smooth(0.05,0.35,cr):0} // the verge: single trees and clumps, no torn edge
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
        {const ms=gMS[k]*w00+gMS[k+1]*w10+gMS[k+GN]*w01+gMS[k+GN+1]*w11,cv=gCV[k]*w00+gCV[k+1]*w10+gCV[k+GN]*w01+gCV[k+GN+1]*w11;const v=ms*(1+0.1*cv);
          if(cv<0){const hz=-cv*0.07;R=lerp(R,120,hz);Gc=lerp(Gc,138,hz);Bc=lerp(Bc,152,hz)}if(SPLIT)SHD[o>>2]=v;else{R*=v;Gc*=v;Bc*=v}}
      }
      // water
      if(land<1){let wr,wg,wb;
        if(e<0.003&&aR<0.999){const t=clamp(-e/0.13,0,1),t2=M.sqrt(t);wr=lerp(58,14,t2);wg=lerp(134,46,t2);wb=lerp(140,82,t2);
          const sh2=smooth(0.0,-0.012,e);wr=lerp(wr+40,wr,sh2);wg=lerp(wg+36,wg,sh2);wb=lerp(wb+18,wb,sh2)}
        else{wr=50;wg=96;wb=100}
        if(aR>0&&e>0.003){const r2=rv<0?-rv:rv;const dp=M.sqrt(clamp((ww-r2)/(ww+1e-7),0,1));let rr2=lerp(78,30,dp),rg2=lerp(112,74,dp),rb2=lerp(96,90,dp);{const m=smooth(0.011,0.004,e)*0.8;rr2=lerp(rr2,80,m);rg2=lerp(rg2,150,m);rb2=lerp(rb2,150,m)} /* the estuary takes on the colour of the shallow sea */wr=lerp(wr,rr2,aR);wg=lerp(wg,rg2,aR);wb=lerp(wb,rb2,aR)}
        wr+=dt*5;wg+=dt*6;wb+=dt*6;let wa=0.66;
        if(WIN){let ice=0;if(aR>0&&e>0.003){const r2=rv<0?-rv:rv;const dp=clamp((ww-r2)/(ww+1e-7),0,1);ice=1-smooth(0.55,0.85,dp)*smooth(0.006,0.012,ww)}
          else if(e<0.003){const t=clamp(-e/0.13,0,1);ice=smooth(0.05,0.015,t+d1*0.025)}
          if(ice>0){const ck=M.abs(d2)<0.025?-26:0;wr=lerp(wr,196+dt*14+ck,ice);wg=lerp(wg,212+dt*14+ck,ice);wb=lerp(wb,224+dt*12+ck,ice);wa=lerp(0.66,1,ice)}}
        R=lerp(wr,R,land);Gc=lerp(wg,Gc,land);Bc=lerp(wb,Bc,land);
        d[o+3]=(land+(1-land)*wa)*255}
      else d[o+3]=255;
      d[o]=R;d[o+1]=Gc;d[o+2]=Bc}}
  ctx.putImageData(img,0,0);
}

// ---------------------------------------------------------------- block generation
const MASS_=[0,[128,130,136],[138,130,122],[134,136,132],[122,126,104],[96,118,74],[160,160,160],[126,132,108],[124,118,110],[118,128,100],[134,134,124],[140,128,110],[142,136,128]];
const MASS=MASS_.concat([[112,132,90],[180,182,180],[130,120,120],[112,130,96],[132,132,134],[0,0,0],[120,132,146],[100,122,76],[176,170,160],[136,138,132],[178,172,160]]);
function occR(O,x,y,w,h){for(let q=0;q<O.length;q+=4)if(x<O[q]+O[q+2]&&x+w>O[q]&&y<O[q+1]+O[q+3]&&y+h>O[q+1])return true;return false}
function occ(O,x,y,m){for(let i=0;i<O.length;i+=4){if(x>O[i]-m&&x<O[i]+O[i+2]+m&&y>O[i+1]-m&&y<O[i+1]+O[i+3]+m)return true}return false}
let LITE=false,LITE2=false;
function treesIn(P,O,R,x0,y0,w,h,n,dmin,dmax,vset){if(LITE)n=M.min(n,LITE2?4:10);for(let q=0;q<n;q++){const x=x0+R()*w,y=y0+R()*h,d=dmin+R()*(dmax-dmin);if(occ(O,x,y,d*0.45))continue;TR(P,x,y,d,vset[R()*vset.length|0])}}
// flat ground objects never run under buildings or each other: beds and car parks are clipped to the free part,
// playgrounds, greenhouses, courts, tracks and pads that collide are dropped (after layout, no RNG involved)
function gRect(p){return p.k==='helipad'?[p.x-p.r,p.y-p.r,2*p.r,2*p.r]:[p.x,p.y,p.w,p.h]}
function rOver(a,b,m){return a[0]<b[0]+b[2]-m&&b[0]<a[0]+a[2]-m&&a[1]<b[1]+b[3]-m&&b[1]<a[1]+a[3]-m}
function fitGround(P){const GCLIP={pk:1,rows:1},GDROP={play:1,gh:1,court:1,track:1,field:1,helipad:1,wood:1,pool:1};const BG=mkBins();let nb=0;for(const p of P)if(p.k==='b'){const q=p.a?fpBox(p):[p.x-0.4,p.y-0.4,p.x+p.w+0.4,p.y+p.h+0.4];binAdd(BG,[q[0],q[1],q[2]-q[0],q[3]-q[1]],q);nb++}
  const Gs=[];let cut=false;
  for(const p of P){const k=p.k;if(!GCLIP[k]&&!GDROP[k])continue;let r=gRect(p);const Bs=nb?binGet(BG,r[0],r[1],r[0]+r[2],r[1]+r[3]):[];
    if(GCLIP[k]){for(const b of Bs){if(!rOver(r,b,0.05))continue;const c=[[r[0],r[1],b[0]-r[0],r[3]],[b[0]+b[2],r[1],r[0]+r[2]-b[0]-b[2],r[3]],[r[0],r[1],r[2],b[1]-r[1]],[r[0],b[1]+b[3],r[2],r[1]+r[3]-b[1]-b[3]]];
        let best=null;for(const q of c)if(q[2]>0&&q[3]>0&&(!best||q[2]*q[3]>best[2]*best[3]))best=q;r=best;if(!r)break}
      const min=k==='pk'?5.4:2.5;if(!r||r[2]<min||r[3]<min){p._x=1;cut=true;continue}p.x=r[0];p.y=r[1];p.w=r[2];p.h=r[3];if(k==='pk')Gs.push(r);continue}
    let bad=false;for(const b of Bs)if(rOver(r,b,0.05)){bad=true;break}if(!bad)for(const g of Gs)if(rOver(r,g,0.05)){bad=true;break}
    if(bad){p._x=1;cut=true}else Gs.push(r)}
  return cut?P.filter(p=>!p._x):P}
// trees are drawn above buildings, so a crown must not cover a roof: drop such trees (after layout, no RNG involved)
// buckets of footprints (local metres) for the layout checks below
function fpBox(p){if(p.k==='cyl')return [p.x-p.r,p.y-p.r,p.x+p.r,p.y+p.r];if(p.a){const r=M.hypot(p.w,p.h)/2,cx=p.x+p.w/2,cy=p.y+p.h/2;return [cx-r,cy-r,cx+r,cy+r]}return [p.x,p.y,p.x+p.w,p.y+p.h]}
function mkBins(){return new Map()}
function binAdd(G,p,b){for(let j=M.floor(b[1]/24);j<=M.floor(b[3]/24);j++)for(let i=M.floor(b[0]/24);i<=M.floor(b[2]/24);i++){const k=i*65536+j;let a=G.get(k);if(!a)G.set(k,a=[]);a.push(p)}}
function binGet(G,x0,y0,x1,y1){const out=[];for(let j=M.floor(y0/24);j<=M.floor(y1/24);j++)for(let i=M.floor(x0/24);i<=M.floor(x1/24);i++){const a=G.get(i*65536+j);if(a)for(const p of a)if(out.indexOf(p)<0)out.push(p)}return out}
function dropCrowns(P){const G=mkBins();let nb=0;for(const p of P)if(p.k==='b'||p.k==='cyl'){binAdd(G,p,fpBox(p));nb++}if(!nb)return P;let cut=false;
  for(const p of P){if(p.k!=='t')continue;const r=p.d*0.45-0.4;for(const b of binGet(G,p.x-r,p.y-r,p.x+r,p.y+r)){let tx=p.x,ty=p.y;if(b.a){const cx=b.x+b.w/2,cy=b.y+b.h/2,c=M.cos(b.a),sn=M.sin(b.a);tx=cx+(p.x-cx)*c+(p.y-cy)*sn;ty=cy-(p.x-cx)*sn+(p.y-cy)*c}
    const d=b.k==='b'?M.hypot(tx-clamp(tx,b.x,b.x+b.w),ty-clamp(ty,b.y,b.y+b.h)):M.hypot(p.x-b.x,p.y-b.y)-b.r;if(d<r){p._x=1;cut=true;break}}}
  return cut?P.filter(p=>!p._x):P}
// street trees on the sidewalk; a crown that would cover a roof is left out (trees are drawn above buildings)
function streetTrees(P,R,x0,y0,x1,y1,sp,O){if(LITE2)return;if(LITE)sp*=1.6;const v=R()*3|0;const T=(x,y)=>{const d=5+R()*3;if(!O||!occ(O,x,y,d*0.5))TR(P,x,y,d,v)};for(let x=x0+4;x<x1-4;x+=sp){T(x,y0+1.8);T(x,y1-1.8)}for(let y=y0+4+sp;y<y1-4-sp;y+=sp){T(x0+1.8,y);T(x1-1.8,y)}}
function genBlock(c,bi,bj,t){
  const R=rng(hh(c.id,bi*1013+bj,61));const i=bi-c.N,j=bj-c.N;const sp=blkSpan(c,bi,bj);const hu0=(c.us[bi+sp[0]]-c.us[bi])/2,hv0=(c.vs[bj+sp[1]]-c.vs[bj])/2;let hu=hu0,hv=hv0,bf=null;if(c.cv||c.sp){bf=blkFrame(c,bi,bj);hu=bf[4];hv=bf[5]}
  const iL=c.kU?KH(c.kU[bi]):lineHalf(i),iR=c.kU?KH(c.kU[bi+sp[0]]):lineHalf(i+1),iB=c.kV?KH(c.kV[bj]):lineHalf(j),iT=c.kV?KH(c.kV[bj+sp[1]]):lineHalf(j+1);
  const sx0=-hu+iL,sy0=-hv+iB,sx1=hu-iR,sy1=hv-iT;const P=[],O=[];
  G(P,sx0,sy0,sx1-sx0,sy1-sy0,SIDEW);P[P.length-1].tr=1;
  const X0=sx0+3.5,Y0=sy0+3.5,X1=sx1-3.5,Y1=sy1-3.5,W=X1-X0,H=Y1-Y0,cx=(X0+X1)/2,cy=(Y0+Y1)/2;
  const dn=c.pol?M.hypot(bf[0]-c.x,bf[1]-c.y)/c.R:M.hypot(c.us[bi]+hu0,c.vs[bj]+hv0)/c.R;
  const bld=(x,y,w,h,Hh,col,r,ex)=>{B(P,x,y,w,h,Hh,col,r,ex);O.push(x,y,w,h)};
  switch(t){
  case 1:{ // towers
    G(P,X0,Y0,W,H,PAVE);P.push({k:'plz',x:X0,y:Y0,w:W,h:H,seed:hh(c.id,bi*1013+bj,99)});const n=1+(R()*3|0);const horiz=W>=H;
    for(let q=0;q<n;q++){const pw=(horiz?W:H)/n;const tw=M.min(pw*0.7,26+R()*24),th=M.min((horiz?H:W)*0.7,24+R()*24);
      const pc=(horiz?X0:Y0)+pw*(q+0.5);let x,y;if(horiz){x=pc-tw/2+(R()-0.5)*(pw-tw)*0.6;y=cy-th/2+(R()-0.5)*(H-th)*0.6}else{y=pc-tw/2+(R()-0.5)*(pw-tw)*0.6;x=cx-th/2+(R()-0.5)*(W-th)*0.6}
      const w2=horiz?tw:th,h2=horiz?th:tw;const Hh=M.max(40,(c.type===3?90+R()*220:50+R()*90)*(1-dn*1.6));
      const gl=R()<0.6;const col=gl?[[62,92,116],[74,108,122],[56,80,104],[96,118,130],[88,96,112]][R()*5|0]:[[176,174,170],[152,150,146],[124,124,128],[186,170,150]][R()*4|0],rf=gl?'gl':'f';const st=R();
      if(st<0.4){bld(x,y,w2,h2,Hh,col,rf,{heli:Hh>150&&R()<0.6,ant:Hh>170&&R()<0.5,sol:!gl&&R()<0.2})}
      else if(st<0.68){const k1=M.min(w2,h2)*0.13;bld(x,y,w2,h2,Hh*0.42,col,rf,{lvl:0});bld(x+k1,y+k1,w2-2*k1,h2-2*k1,Hh*0.74,col,rf,{H0:Hh*0.42,lvl:1});
        bld(x+k1*2.3,y+k1*2.3,w2-4.6*k1,h2-4.6*k1,Hh,col,rf,{H0:Hh*0.74,lvl:2,ant:R()<0.6,heli:R()<0.3})}
      else if(st<0.84){const rr2=M.min(w2,h2)/2;CY(P,x+w2/2,y+h2/2,rr2,Hh,col,'gtow');O.push(x,y,w2,h2)}
      else{const tw2=w2*0.42;bld(x,y,tw2,h2,Hh,col,rf,{lvl:1,ant:1});bld(x+w2-tw2,y,tw2,h2,Hh,col,rf,{lvl:1,ant:1});bld(x+tw2,y+h2*0.35,w2-2*tw2,h2*0.3,Hh*0.62,[200,205,210],'gl',{H0:Hh*0.55,lvl:2,nd:1})}}
    if(n<3&&R()<0.5){P.push({k:'gc',x:cx+(R()-0.5)*W*0.4,y:cy+(R()-0.5)*H*0.4,r:6,c:[160,170,175]});}
    treesIn(P,O,R,X0+4,Y0+4,W-8,H-8,8,4,7,[0,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,11,O);break}
  case 2:{ // perimeter
    G(P,X0,Y0,W,H,YARD);const d=M.min(13+R()*4,(M.min(W,H)-1)/2);const col=ROOFP[R()*ROOFP.length|0];
    const seg=(x,y,w,h,alongX,gf)=>{let p=0;const L=alongX?w:h;while(p<L-6){let s=M.min(L-p,22+R()*40);if(L-p-s<14)s=L-p;
      const fl=(5+(R()*5|0))*3.1;const cc=[col[0]*(0.9+R()*0.2),col[1]*(0.9+R()*0.2),col[2]*(0.9+R()*0.2)];
      if(alongX)bld(x+p,y,s-0.5,h,fl,cc,R()<0.25?'h':'f',{gf});else bld(x,y+p,w,s-0.5,fl,cc,R()<0.25?'h':'f',{gf});p+=s}};
    seg(X0,Y0,W,d,1,[0,2,-1]);seg(X0,Y1-d,W,d,1,[2,0,-1]);seg(X0,Y0+d,d,H-2*d,0,[3,1,-1]);if(R()<0.8)seg(X1-d,Y0+d,d,H-2*d,0,[1,3,-1]);
    if(W>60&&H>60){PK(P,X0+d+4,cy-6,M.min(W-2*d-8,40),12,0.6,R()*1e9|0);P.push({k:'play',x:cx+5,y:Y0+d+6,w:14,h:10})}
    treesIn(P,O,R,X0+d,Y0+d,W-2*d,H-2*d,14,5,9,[0,1,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,12,O);break}
  case 3:{ // panel slabs
    G(P,X0,Y0,W,H,YARD);const horiz=W>=H;const LA=horiz?W:H,SA=horiz?H:W;const n=M.max(1,M.floor((SA-8)/46));
    const fls=[5,9,9,9,12,14,16][R()*7|0];const col=PANELC[R()*PANELC.length|0];
    for(let q=0;q<n;q++){const len=LA*(0.55+R()*0.38),sw=12+R()*2.5;const off=(R()-0.5)*(LA-len-8);const pc=-SA/2+(q+0.5)*SA/n;
      const fl=(R()<0.25?[5,9,12,16][R()*4|0]:fls)*2.9;
      if(horiz){bld(cx+off-len/2,cy+pc-sw/2,len,sw,fl,col,'f',{mr:1,gf:[-1,2,-1]});PK(P,cx+off-len/2+4,cy+pc+sw/2+3,len-8,5.5,0.65,R()*1e9|0)}
      else{bld(cx+pc-sw/2,cy+off-len/2,sw,len,fl,col,'f',{mr:1,gf:[-1,1,-1]});PK(P,cx+pc+sw/2+3,cy+off-len/2+4,5.5,len-8,0.65,R()*1e9|0)}}
    if(R()<0.45&&W>70&&H>70){const tx=X0+6+R()*(W-40),ty=Y0+6+R()*(H-40);if(!occ(O,tx+12,ty+12,16))bld(tx,ty,24,24,(16+(R()*8|0))*2.9,col,'f')}
    if(R()<0.5){const kx=cx-15,ky=cy-12;if(!occ(O,kx+15,ky+12,18)){bld(kx,ky,30,8,7,[176,118,80],'f');bld(kx,ky+8,8,16,7,[176,118,80],'f');P.push({k:'play',x:kx+12,y:ky+11,w:16,h:12})}}
    for(let q=0;q<2;q++){const px=X0+8+R()*(W-30),py=Y0+8+R()*(H-24);if(!occ(O,px+8,py+6,6))P.push({k:'play',x:px,py,y:py,w:14,h:10})}
    treesIn(P,O,R,X0+2,Y0+2,W-4,H-4,M.floor(W*H/420),5,10,[0,1,2,4,6]);streetTrees(P,R,sx0,sy0,sx1,sy1,13,O);break}
  case 4:case 13:{ // private houses
    G(P,X0,Y0,W,H,[112,130,76]);const horiz=W>=H;const LA=horiz?W:H,SA=horiz?H:W;const lw=20+R()*8;const nl=M.max(1,M.floor(LA/lw)),lw2=LA/nl;const rows=SA>50?2:1;
    for(let r=0;r<rows;r++)for(let q=0;q<nl;q++){const Rl=rng(hh(c.id*7+bi,bj*131+q,r+5));if(Rl()<0.08)continue;
      const a0=-LA/2+q*lw2,b0=r===0?-SA/2:0,bl=rows===2?SA/2:SA;
      let lx,ly,lw3,lh3;if(horiz){lx=cx+a0;ly=cy+b0;lw3=lw2;lh3=bl}else{lx=cx+b0;ly=cy+a0;lw3=bl;lh3=lw2}
      const gc=[[104,124,70],[118,128,78],[96,118,66],[126,116,82]][Rl()*4|0];G(P,lx+0.6,ly+0.6,lw3-1.2,lh3-1.2,gc);P.push({k:'fence',x:lx+0.4,y:ly+0.4,w:lw3-0.8,h:lh3-0.8});
      if(Rl()<0.6){const vw=(horiz?lw3:lh3)*0.6;if(horiz)P.push({k:'rows',x:lx+2,y:r===0?ly+2:ly+lh3-14,w:vw,h:12,o:0});else P.push({k:'rows',x:r===0?lx+2:lx+lw3-14,y:ly+2,w:12,h:vw,o:1})}
      const hw=7+Rl()*5,hd=6.5+Rl()*4;const front=4;let hx,hy;
      if(horiz){hx=lx+(lw3-hw)/2+(Rl()-0.5)*3;hy=r===0?ly+front:ly+lh3-front-hd}else{hy=ly+(lh3-hw)/2;hx=r===0?lx+front:lx+lw3-front-hd}
      const ww=horiz?hw:hd,hh2=horiz?hd:hw;if(horiz)P.push({k:'path',x:hx+ww*0.3,y:r===0?ly+0.4:hy+hh2,w:1.3,h:r===0?hy-ly-0.4:ly+lh3-hy-hh2-0.4});else P.push({k:'path',x:r===0?lx+0.4:hx+ww,y:hy+hh2*0.3,w:r===0?hx-lx-0.4:lx+lw3-hx-ww-0.4,h:1.3});
      {const fe=horiz?(r===0?0:2):(r===0?3:1),fr=fe===0||fe===1?0.3:0.7;bld(hx,hy,ww,hh2,5+Rl()*4,ROOFH[Rl()*ROOFH.length|0],Rl()<0.55?'g':'h',{a:(Rl()-0.5)*0.12,gf:[-1,fe,-1],hs:fr})}
      if(Rl()<0.5){const sx=lx+lw3*0.15+Rl()*lw3*0.5,sy=ly+lh3*0.15+Rl()*lh3*0.6;if(!occ(O,sx+1.75,sy+1.5,3.4))bld(sx,sy,3.5,3,2.6,[[120,100,80],[100,100,100],[150,80,60]][Rl()*3|0],'f')}
      if(Rl()<0.3){const gx=lx+lw3*0.5,gy=ly+lh3*0.5;if(!occ(O,gx+2,gy+4,3))P.push({k:'gh',x:gx,y:gy,w:3.5,h:8})}
      const nt=Rl()*3|0;for(let q2=0;q2<nt;q2++){const tx=lx+2+Rl()*(lw3-4),ty=ly+2+Rl()*(lh3-4);if(!occ(O,tx,ty,3))TR(P,tx,ty,4+Rl()*4,[0,2,4,6][Rl()*4|0])}
      // back of the plot: vegetable garden, orchard, bathhouse, woodpile
      const D=horiz?lh3:lw3,Wp=horiz?lw3:lh3;if(D>30){const back=(a,b)=>r===0?a:D-a-b;const loc=(u,v,w,h)=>horiz?[lx+u,ly+back(v,h),w,h]:[lx+back(v,h),ly+u,h,w];
        if(Rl()<0.8){const gd=D*(0.25+Rl()*0.2);const [x1,y1,w1,h1]=loc(1.5,D-gd-1.5,Wp-3,gd);P.push({k:'rows',x:x1,y:y1,w:w1,h:h1,o:horiz?0:1})}
        const no=Rl()<0.7?3+(Rl()*6|0):0;for(let q2=0;q2<no;q2++){const u=2.5+(q2%3)*(Wp-5)/2+(Rl()-0.5),v=D*0.42+((q2/3)|0)*5+(Rl()-0.5);const [tx,ty]=loc(u,v,0,0);if(!occ(O,tx,ty,2.5))TR(P,tx,ty,3+Rl()*1.8,[2,4,0][Rl()*3|0])}
        if(Rl()<0.45){const [bx,by,bw,bh]=loc(Wp-5.5,D-6.5,4,3.6);if(!occ(O,bx+bw/2,by+bh/2,M.max(bw,bh)/2+1))bld(bx,by,bw,bh,2.8,[[132,104,76],[118,92,66]][Rl()*2|0],'g')}
        if(Rl()<0.5){const [wx,wy,ww2,wh]=loc(1,D*0.5,3,0.8);P.push({k:'wood',x:wx,y:wy,w:ww2,h:wh})}}}
    break}
  case 5:{ // park
    G(P,X0,Y0,W,H,[86,126,62]);const R2=M.min(W,H);
    LN(P,[X0,Y0,cx,cy,X1,Y1],3,[190,180,152]);LN(P,[X0,Y1,cx,cy,X1,Y0],3,[190,180,152]);O.push(cx-6,cy-6,12,12);
    if(R()<0.5){const pr=R2*0.2;const px=cx+(R()<0.5?-1:1)*W*0.22,py=cy+(R()<0.5?-1:1)*H*0.22;P.push({k:'pond',x:px,y:py,rx:pr*1.3,ry:pr});O.push(px-pr*1.5,py-pr*1.3,pr*3,pr*2.6)}P.push({k:'gc',x:cx,y:cy,r:8,c:[200,192,170]});P.push({k:'gc',x:cx,y:cy,r:3,c:[90,140,170]});
    treesIn(P,O,R,X0,Y0,W,H,M.floor(W*H/140),5,11,[0,1,2,3,4,5]);break}
  case 6:{ // mall + parking
    G(P,X0,Y0,W,H,[92,94,96]);const horiz=W>=H;
    const sol=R()<0.45;if(horiz){const bw=W*0.55;bld(X0+2,Y0+2,bw,H-4,12,[196,196,198],'f',{sol,gf:[-1,-1,1]});PK(P,X0+bw+6,Y0+4,W-bw-10,H-8,0.7,R()*1e9|0)}
    else{const bh=H*0.55;bld(X0+2,Y0+2,W-4,bh,12,[196,196,198],'f',{sol,gf:[-1,-1,2]});PK(P,X0+4,Y0+bh+6,W-8,H-bh-10,0.7,R()*1e9|0)}break}
  case 7:{ // school
    G(P,X0,Y0,W,H,[118,138,88]);const col=[[184,120,90],[150,150,150],[176,150,110]][R()*3|0];
    const sw=M.max(W*0.45,30);bld(X0+5,Y0+5,sw,12,12,col,'f');bld(X0+5,Y0+17,12,H*0.4,12,col,'f');bld(X0+5+sw-12,Y0+17,12,H*0.25,12,col,'f');
    const tw=M.min(W*0.5,90),th=M.min(H*0.55,50);P.push({k:'track',x:X1-tw-5,y:Y1-th-5,w:tw,h:th});O.push(X1-tw-5,Y1-th-5,tw,th);
    treesIn(P,O,R,X0,Y0,W,H,12,5,9,[0,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,12,O);break}
  case 8:{ // garages
    G(P,X0,Y0,W,H,[122,118,110]);const horiz=W>=H;const LA=horiz?W:H,SA=horiz?H:W;let p=-SA/2+4;
    while(p<SA/2-12){for(let s2=0;s2<2;s2++){const rowY=p+s2*6;for(let a=-LA/2+4;a<LA/2-4;a+=3.6){const col=[[120,90,72],[100,100,104],[134,112,92],[90,86,82],[140,100,80]][R()*5|0];
          if(horiz)B(P,cx+a,cy+rowY,3.4,6,2.6,col,'f',{nd:1});else B(P,cx+rowY,cy+a,6,3.4,2.6,col,'f',{nd:1})}}p+=20}break}
  case 9:{ // stadium
    G(P,X0,Y0,W,H,[136,136,130]);const sw=M.min(W,H*1.5)*0.86,shh=sw/1.5;P.push({k:'stad',x:cx,y:cy,w:M.min(sw,W-6),h:M.min(shh,H-6)});
    treesIn(P,O,R,X0,Y0,W,H,0,5,9,[0]);break}
  case 10:{ // church + square
    G(P,X0,Y0,W,H,[96,128,70]);G(P,cx-25,cy-25,50,50,PAVE);const rc=[[90,140,110],[220,220,214],[70,90,140]][R()*3|0];
    // orthodox church: refectory + bell tower (west), nave with metal roof, apse (east), drum + onion domes
    P.push({k:'path',x:cx-25,y:cy-1.6,w:50,h:3.2});P.push({k:'fence',x:cx-27,y:cy-27,w:54,h:54});
    const wall=[[240,236,226],[236,226,206],[226,214,196],[244,240,232]][R()*4|0],gold=R()<0.6,dc=gold?[226,182,72]:rc;
    bld(cx-3,cy-7.5,15,15,15,wall,'h',{lvl:0,rc:rc});bld(cx-14,cy-6,11,12,8,wall,'g',{lvl:0,rc:rc});bld(cx-21,cy-3.5,7,7,26,wall,'h',{lvl:1,rc:rc});
    P.push({k:'apse',x:cx+12,y:cy,r:5.5,H:12,c:wall,rc});
    P.push({k:'dome',x:cx+4.5,y:cy,r:4,c:dc,H:23,lvl:3,drum:wall});for(const [dx,dy] of [[-5,-5],[5,-5],[-5,5],[5,5]])P.push({k:'dome',x:cx+4.5+dx,y:cy+dy,r:1.7,c:dc,H:18,lvl:3,drum:wall});
    P.push({k:'dome',x:cx-17.5,y:cy,r:1.6,c:dc,H:31,lvl:4,drum:wall});
    O.push(cx-28,cy-28,56,56);treesIn(P,O,R,X0,Y0,W,H,30,5,10,[0,1,2,3]);break}
  case 11:{ // construction
    G(P,X0,Y0,W,H,[150,128,98]);G(P,X0+W*0.15,Y0+H*0.2,W*0.5,H*0.35,[120,100,80]);
    bld(X0+W*0.18,Y0+H*0.24,W*0.44,14,(3+(R()*8|0))*2.9,[140,140,136],'f',{cons:1});
    P.push({k:'crane2',x:X0+W*0.7,y:Y0+H*0.5,len:50,a:R()*TAU,H:60,lvl:5});
    for(let q=0;q<5;q++)P.push({k:'pile',x:X0+10+R()*(W-20),y:Y1-10-R()*20,r:3+R()*4,c:[[160,150,130],[120,110,100],[180,160,120]][R()*3|0]});
    PK(P,X0+4,Y1-12,30,8,0.5,R()*1e9|0,1);break}
  case 12:{ // low-rise commercial
    G(P,X0,Y0,W,H,[150,146,138]);let p=X0;while(p<X1-10){const w=M.min(X1-p,14+R()*24);const h=M.min(14+R()*16,(H-22)/2);bld(p,Y0,w-1,h,(2+(R()*3|0))*3.2,ROOFP[R()*ROOFP.length|0],R()<0.3?'h':'f',{gf:[0,2,-1]});bld(p,Y1-h,w-1,h,(2+(R()*3|0))*3.2,ROOFP[R()*ROOFP.length|0],'f',{gf:[2,0,-1]});p+=w}
    PK(P,X0+4,cy-9,W-8,18,0.6,R()*1e9|0);streetTrees(P,R,sx0,sy0,sx1,sy1,12,O);break}

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
    const mw=M.min(W*0.5,W-2*d-14);bld(X0+6,Y0+6,d,H*0.7,fl,col,'f',{fc:[230,230,226]});bld(X0+6+d,Y0+6+H*0.3,mw,d,fl,col,'f',{fc:[230,230,226]});bld(X0+6+d+mw,Y0+6,d,H*0.7,fl,col,'f',{fc:[230,230,226]});
    bld(X0+6+d+mw*0.24,Y0+6+H*0.3+d,mw*0.5,H*0.18,8,[180,184,190],'f');
    P.push({k:'helipad',x:X1-16,y:Y0+16,r:9});O.push(X1-26,Y0+6,20,20);PK(P,X0+6,Y1-16,W-40,11,0.8,R()*1e9|0);
    treesIn(P,O,R,X0,Y0,W,H,16,5,9,[0,1,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,12,O);break}
  case 15:{ // market
    G(P,X0,Y0,W,H,[110,110,108]);const CC=[[40,90,170],[190,50,40],[230,230,228],[60,140,80],[230,170,40],[120,60,140]];
    bld(X0+3,Y0+3,W-6,16,7,[176,180,186],'co');
    for(let y=Y0+24;y<Y1-6;y+=9)for(let x=X0+4;x<X1-4;x+=3.4){if(R()<0.12)continue;B(P,x,y,3.1,3.4,2.4,CC[R()*6|0],'f',{nd:1})}
    break}
  case 16:{ // sports complex
    G(P,X0,Y0,W,H,[112,132,90]);const fw=M.min(W-20,105),fh=M.min(H*0.5,68);P.push({k:'field',x:X0+10,y:Y0+8,w:fw,h:fh});O.push(X0+10,Y0+8,fw,fh);
    let x=X0+10;const yy=Y0+fh+16;while(x<X1-20&&yy+34<Y1){const t=R()<0.7?0:1;P.push({k:'court',x,y:yy,w:17,h:34,t});O.push(x,yy,17,34);x+=20}
    bld(X1-30,Y1-22,24,16,8,[190,190,192],'f');treesIn(P,O,R,X0,Y0,W,H,14,5,9,[0,1,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,12,O);break}
  case 17:{ // bus depot
    G(P,X0,Y0,W,H,[104,104,104]);const horiz=W>=H;
    if(horiz){bld(X0+3,Y0+3,W*0.4,H-6,12,[186,190,194],'co');P.push({k:'pk',x:X0+W*0.45,y:Y0+4,w:W*0.53,h:H-8,fill:0.7,seed:R()*1e9|0,bus:1})}
    else{bld(X0+3,Y0+3,W-6,H*0.4,12,[186,190,194],'co');P.push({k:'pk',x:X0+4,y:Y0+H*0.45,w:W-8,h:H*0.53,fill:0.7,seed:R()*1e9|0,bus:1})}break}
  case 19:{ // offices
    G(P,X0,Y0,W,H,PAVE);P.push({k:'plz',x:X0,y:Y0,w:W,h:H,seed:hh(c.id,bi*1013+bj,99)});const n=2+(R()*2|0);const horiz=W>=H;
    for(let q=0;q<n;q++){const pw=(horiz?W:H)/n;const a=(horiz?X0:Y0)+q*pw+4;const ow=pw-8,oh=(horiz?H:W)*(0.45+R()*0.3);const fl=(6+(R()*9|0))*3.6;const gl=R()<0.6;
      const col=gl?[[80,110,128],[96,120,136],[70,96,120]][R()*3|0]:[[186,182,176],[160,160,162]][R()*2|0];const o=(horiz?H:W)-oh-8;const off=R()*o;
      if(horiz)bld(a,Y0+4+off,ow,oh,fl,col,gl?'gl':'f',{rg:!gl&&R()<0.5,sol:!gl&&R()<0.4});else bld(X0+4+off,a,oh,ow,fl,col,gl?'gl':'f',{rg:!gl&&R()<0.5,sol:!gl&&R()<0.4})}
    P.push({k:'gc',x:cx,y:cy,r:5,c:[120,160,180]});treesIn(P,O,R,X0,Y0,W,H,10,4,8,[0,2,4]);streetTrees(P,R,sx0,sy0,sx1,sy1,11,O);break}
  case 21:{ // government quarter of a capital (stage 5): parliament with a dome, wings, a square with lawns, fountains and flags
    const fl=c.fl;G(P,X0,Y0,W,H,PAVE);const hz=W>=H,L=hz?W:H,S=hz?H:W;
    // local frame: a along the long side, b across; the parliament stands at -b and faces the square
    const at=(a,b)=>hz?[cx+a,cy+b]:[cx+b,cy+a],rc=(a0,b0,la,lb)=>hz?[cx+a0,cy+b0,la,lb]:[cx+b0,cy+a0,lb,la];
    const pw=M.min(L*0.5,86),pd=M.min(S*0.32,32),pb=-S/2+6,wall=[228,224,214];
    {const [x,y,w,h]=rc(-pw/2,pb,pw,pd);bld(x,y,w,h,20,wall,'f')}
    if(L>pw+40)for(const sd of [-1,1]){const [x,y,w,h]=rc(sd>0?pw/2:-pw/2-14,pb+5,14,pd-10);bld(x,y,w,h,15,[222,218,206],'f')}
    {const [x,y,w,h]=rc(-15,pb+pd,30,6);bld(x,y,w,h,15,[234,230,220],'g');const [px,py,pw2,ph2]=rc(-17,pb+pd+6,34,3);P.push({k:'path',x:px,y:py,w:pw2,h:ph2})}
    {const [x,y]=at(0,pb+pd/2);P.push({k:'dome',x,y,r:M.min(pw,pd)*0.27,c:R()<0.5?[148,178,160]:[222,184,86],H:36,lvl:3,drum:[238,234,224]})}
    const sq0=pb+pd+5,sq1=S/2-5;
    if(sq1-sq0>14){for(const sd of [-1,1]){const [x,y,w,h]=rc(sd>0?6:-L/2+6,sq0+4,L/2-12,sq1-sq0-8);P.push({k:'lawn',x,y,w,h,o:hz?0:1})}
      if(sq1-sq0>30)for(const sd of [-1,1]){const [x,y]=at(sd*L*0.24,(sq0+sq1)/2);P.push({k:'pond',x,y,rx:5.5,ry:5.5})}
      for(let a=-L/2+10;a<L/2-6;a+=9){if(M.abs(a)<8)continue;for(const b of [sq0+2,sq1-2]){const [x,y]=at(a,b);TR(P,x,y,4+R()*2,[0,1,4][R()*3|0])}}}
    if(fl)for(let q=-2;q<=2;q++){const [x,y]=at(q*5,sq0+7+M.abs(q)*0.8);P.push({k:'flag',x,y,H:q===0?16:12,fl})}
    break}
  case 20:{ // green buffer along a through-road: meadow + tree groups kept clear of the carriageway
    G(P,X0,Y0,W,H,[104,124,72]);const bf=blkFrame(c,bi,bj),ca=bf[2],sa=bf[3],bx=bf[0],by=bf[1];
    const n=M.floor(W*H/90);for(let q=0;q<n;q++){const x=X0+3+R()*(W-6),y=Y0+3+R()*(H-6),d=4+R()*6;const wx=bx+x*ca-y*sa,wy=by+x*sa+y*ca;if(roadHits(wx,wy,0,d,d,4,null))continue;TR(P,x,y,d,[0,1,2,4,6][R()*5|0])}
    break}
  case 22:{ // microdistrict on a superblock: panel slabs along the edges with gaps, point towers on the corners,
            // a school with a running track and a kindergarten in the middle, parking strips and playgrounds in the yards
    G(P,X0,Y0,W,H,YARD);const col=PANELC[R()*PANELC.length|0],fls=[9,9,12,14,16][R()*5|0],sw=12+R()*2.5,st=6;
    const fl=()=>(R()<0.22?[5,9,12,16][R()*4|0]:fls)*2.9;
    const put=(x,y,w,h,Hh,ex,cl)=>{if(x<X0+2||y<Y0+2||x+w>X1-2||y+h>Y1-2||occR(O,x-4,y-4,w+8,h+8))return false;bld(x,y,w,h,Hh,cl||col,'f',ex);return true};
    const flat=(x,y,w,h,o)=>{if(x<X0+1||y<Y0+1||x+w>X1-1||y+h>Y1-1||occR(O,x-1.5,y-1.5,w+3,h+3))return false;P.push(Object.assign({x,y,w,h},o));O.push(x,y,w,h);return true};
    const ct=R()<0.65,tw=20+R()*4;
    if(ct)for(const [x,y] of [[X0+st,Y0+st],[X1-st-tw,Y0+st],[X0+st,Y1-st-tw],[X1-st-tw,Y1-st-tw]])if(R()<0.8)put(x,y,tw,tw,(16+(R()*7|0))*2.9,{mr:1});
    const run=(alongX,a0,a1,fix,e)=>{let p=a0;while(p<a1-36){let len=M.min(a1-p,58+R()*62);if(a1-p-len<36)len=a1-p;if(len<36)break;
        if(alongX)put(p,fix,len,sw,fl(),{mr:1,gf:[-1,e,-1]});else put(fix,p,sw,len,fl(),{mr:1,gf:[-1,e,-1]});p+=len+16+R()*26}};
    const m0=st+(ct?tw+10:0),m1=st+M.max(sw,ct?tw:0)+14;
    run(true,X0+m0,X1-m0,Y0+st,2);run(true,X0+m0,X1-m0,Y1-st-sw,0);if(H>130){run(false,Y0+m1,Y1-m1,X0+st,1);run(false,Y0+m1,Y1-m1,X1-st-sw,3)}
    const ix0=X0+st+sw+14,iy0=Y0+st+sw+14,ix1=X1-st-sw-14,iy1=Y1-st-sw-14,iw=ix1-ix0,ih=iy1-iy0;
    if(iw>40&&ih>40){
      if(iw>120&&ih>70&&R()<0.8){const tw2=M.min(iw*0.42,95),th2=M.min(ih*0.6,56),left=R()<0.5,tx=left?ix0:ix1-tw2,ty=iy0+(ih-th2)*R();
        if(flat(tx,ty,tw2,th2,{k:'track'})){const bw=M.min(64,iw-tw2-24);if(bw>26){const bx=left?tx+tw2+12:tx-12-bw;put(bx,ty,bw,13,12.5,{},[184,120,90]);put(left?bx:bx+bw-13,ty+17,13,M.min(30,th2-17),12.5,{},[184,120,90])}}}
      for(let q=0;q<8;q++){const kx=ix0+R()*(iw-30),ky=iy0+R()*(ih-28);if(put(kx,ky,30,14,7,{},[[206,158,104],[196,176,140],[214,196,170]][R()*3|0])){flat(kx+1,ky+17,13,9,{k:'play'});flat(kx+16,ky+17,13,9,{k:'play'});break}}
      for(let q=0;q<6;q++){const pw=28+R()*30,px=ix0+R()*(iw-pw),py=iy0+R()*(ih-6);if(!occR(O,px-2,py-2,pw+4,10)){PK(P,px,py,pw,6,0.65,R()*1e9|0);O.push(px,py,pw,6)}}
      for(let q=0;q<7;q++)flat(ix0+R()*(iw-14),iy0+R()*(ih-10),14,10,{k:'play'})}
    treesIn(P,O,R,X0+2,Y0+2,W-4,H-4,M.floor(W*H/360),5,10,[0,1,2,4,6]);streetTrees(P,R,sx0,sy0,sx1,sy1,13,O);break}
  case 23:{ // town square: patterned paving, a fountain (sometimes a column in it), four lawns, rows of trees, kiosks
    G(P,X0,Y0,W,H,PAVE);P.push({k:'plz',x:X0,y:Y0,w:W,h:H,seed:hh(c.id,bi*1013+bj,98)});const r=M.min(W,H),lw=W*0.27,lh=H*0.27;
    for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]])P.push({k:'lawn',x:cx+sx*W*0.24-lw/2,y:cy+sy*H*0.24-lh/2,w:lw,h:lh,o:W>=H?0:1});
    P.push({k:'gc',x:cx,y:cy,r:r*0.15,c:[198,192,178]});P.push({k:'pond',x:cx,y:cy,rx:r*0.105,ry:r*0.105});O.push(cx-r*0.16,cy-r*0.16,r*0.32,r*0.32);
    if(R()<0.5)bld(cx-1.8,cy-1.8,3.6,3.6,13+R()*8,[132,128,120],'f');
    const ts=8.5+R()*2,tv=[0,1,4][R()*3|0];for(let x=X0+6;x<X1-4;x+=ts){TR(P,x,Y0+5,5+R()*2,tv);TR(P,x,Y1-5,5+R()*2,tv)}for(let y=Y0+6+ts;y<Y1-4-ts;y+=ts){TR(P,X0+5,y,5+R()*2,tv);TR(P,X1-5,y,5+R()*2,tv)}
    if(W>70&&H>60)for(const sd of [-1,1]){const kx=cx+sd*W*0.36-4,ky=cy-3;if(!occR(O,kx-2,ky-2,12,10))bld(kx,ky,8,6,3.6,[[176,120,80],[90,120,96],[160,60,52]][R()*3|0],'f')}
    break}
  }
  // towers and offices: lobby + entrance canopy on the facade nearest to the street
  if(t===7||t===14){const p=P.find(q=>q.k==='b');if(p){const d=[p.y-Y0,X1-p.x-p.w,Y1-p.y-p.h,p.x-X0];let e=0;for(let q=1;q<4;q++)if(d[q]<d[e])e=q;p.gf=[-1,-1,e]}}
  if(t===1||t===19)for(const p of P)if(p.k==='b'&&!p.H0&&!p.nd){const d=[p.y-Y0,X1-p.x-p.w,Y1-p.y-p.h,p.x-X0];let e=0;for(let q=1;q<4;q++)if(d[q]<d[e])e=q;p.gf=[-1,-1,e]}
  return dropCrowns(fitGround(P));
}
// oriented boxes [cx,cy,hw,hh,ca,sa] overlap (separating axis)
function obbOver(a,b){for(const [ux,uy] of [[a[4],a[5]],[-a[5],a[4]],[b[4],b[5]],[-b[5],b[4]]]){const pa=a[2]*M.abs(ux*a[4]+uy*a[5])+a[3]*M.abs(-ux*a[5]+uy*a[4]),pb=b[2]*M.abs(ux*b[4]+uy*b[5])+b[3]*M.abs(-ux*b[5]+uy*b[4]);
  if(M.abs((b[0]-a[0])*ux+(b[1]-a[1])*uy)>=pa+pb)return false}return true}
// plots of a village street in world space (for the streets that are laid out after it)
function vPlots(c,sj){const s=c.vst[sj],out=[];for(const p of genVillage(c,sj,true))if(p.k==='g'){const lx=p.x+p.w/2,ly=p.y+p.h/2;out.push([s.x0+lx*s.ca-ly*s.sa,s.y0+lx*s.sa+ly*s.ca,p.w/2,p.h/2,s.ca,s.sa])}return out}
function genVillage(c,si,full){
  if(!full&&GROW.has(c.id)){const g=GROW.get(c.id),s=c.vst[si],h=s.L/2;return genVillage(c,si,true).filter(p=>{const px=(p.x||0)+(p.w||0)/2;return M.abs(px-h)<=h*g+3})}
  const s=c.vst[si];const R=rng(hh(c.id,si,71));const P=[],O=[];const OP=[];for(let sj=0;sj<si;sj++)for(const q of vPlots(c,sj))OP.push(q);const sp=c.vsp||1;
  for(let a=12;a<s.L-12;a+=(26+R()*12)*sp){for(const side of [-1,1]){if(R()<0.16)continue;
    const Rl=R;const lw=24+Rl()*4,ld=36+Rl()*26;const ly=side>0?5:-5-ld;
    const wx=s.x0+s.ca*a-s.sa*(side*(5+ld/2)),wy=s.y0+s.sa*a+s.ca*(side*(5+ld/2));if(landE(wx,wy,0.002)<0||wetArea(s.x0,s.y0,s.ca,s.sa,a-lw/2,ly,a+lw/2,ly+ld,14,0.001))continue;
    let inZ=false;for(const z of zones){if(M.hypot(z.x-wx,z.y-wy)<z.rad){inZ=true;break}}if(inZ)continue;
    if(roadHits(wx,wy,M.atan2(s.sa,s.ca),lw,ld,1.5,s.r))continue;
    if(OP.length){const me=[wx,wy,lw/2+0.5,ld/2+0.5,s.ca,s.sa];let hit=false;for(const q of OP)if(obbOver(me,q)){hit=true;break}if(hit)continue}
    const gc=[[100,124,66],[112,128,72],[118,120,74],[92,118,62]][Rl()*4|0];G(P,a-lw/2,ly,lw,ld,gc);P.push({k:'fence',x:a-lw/2+0.3,y:ly+0.3,w:lw-0.6,h:ld-0.6});
    if(Rl()<0.75)P.push({k:'rows',x:a-lw/2+3,y:side>0?ly+ld*0.62:ly+3,w:(lw-6)*(0.4+Rl()*0.5),h:ld*0.3,o:Rl()<0.5?0:1});
    const hw=7.5+Rl()*4,hd=6.5+Rl()*3;const hy=side>0?ly+3:ly+ld-3-hd;P.push(side>0?{k:'path',x:a-0.6,y:ly+0.3,w:1.3,h:2.8}:{k:'path',x:a-0.6,y:ly+ld-3.1,w:1.3,h:2.8});
    const ho=B(P,a-hw/2+(Rl()-0.5)*4,hy,hw,hd,4.5+Rl()*2.5,ROOFH[Rl()*ROOFH.length|0],Rl()<0.6?'g':'h',{a:(Rl()-0.5)*0.15});{const fe=side>0?0:2,f=clamp((a-ho.x)/hw,0.2,0.8);ho.gf=[-1,fe,-1];ho.hs=fe===0?f:1-f}O.push(ho.x-0.6,hy-0.6,hw+1.2,hd+1.2);
    if(Rl()<0.7){const bx=a-lw/2+2+Rl()*(lw-7),by=side>0?ly+ld*0.3:ly+ld*0.6,sw=3.5+Rl()*2,sc=[[118,96,72],[98,98,100],[140,84,64]][Rl()*3|0];if(!occ(O,bx+sw/2,by+1.5,M.max(sw/2,1.5)+0.5)){B(P,bx,by,sw,3,2.5,sc,'f');O.push(bx,by,sw,3)}}
    if(Rl()<0.25)P.push({k:'gh',x:a+lw/2-6,y:side>0?ly+ld-12:ly+3,w:3.5,h:8});
    const nt=1+(Rl()*3|0);for(let q=0;q<nt;q++){const tx=a-lw/2+2+Rl()*(lw-4),ty=ly+2+Rl()*(ld-4);if(!occ(O,tx,ty,3))TR(P,tx,ty,4+Rl()*5,[0,2,4,6][Rl()*4|0])}}}
  return dropCrowns(fitGround(P))}

// ---------------------------------------------------------------- primitive drawing
let SDX=0,SDY=0,LNX=0,LNY=0,FCA=1,FSA=0,FOX=0,FOY=0,FS=1;const TREEQ=[];
const SHADOW='rgba(16,22,34,0.32)';
// ---------------------------------------------------------------- materials (stage 4)
// Tileable procedural textures (signed modulation: lo colour where v<0, hi colour where v>0) with a
// box-filtered mip chain. Applied as CanvasPattern in metres, so they are seamless across tiles.
let MATS=null,PCTX=null,PCACHE=null;const HASDM=typeof DOMMatrix!=='undefined';
function tnoise(N,per,seed){const g=new Float32Array(per*per);const R=rng(seed);for(let i=0;i<g.length;i++)g[i]=R();
  const o=new Float32Array(N*N);const sc=per/N;
  for(let y=0;y<N;y++){const fy=y*sc,iy=fy|0,ty=fy-iy,sy=ty*ty*(3-2*ty),y0=(iy%per)*per,y1=((iy+1)%per)*per;
    for(let x=0;x<N;x++){const fx=x*sc,ix=fx|0,tx=fx-ix,sx=tx*tx*(3-2*tx),x0=ix%per,x1=(ix+1)%per;
      const a=g[y0+x0],b=g[y0+x1],c=g[y1+x0],d=g[y1+x1];const ab=a+(b-a)*sx;o[y*N+x]=ab+((c+(d-c)*sx)-ab)*sy}}return o}
function tfbm(N,p0,oct,seed){const o=new Float32Array(N*N);let amp=1,tot=0;for(let i=0;i<oct&&(p0<<i)<=N;i++){const n=tnoise(N,p0<<i,seed+i*101);for(let k=0;k<o.length;k++)o[k]+=(n[k]-0.5)*amp;tot+=amp;amp*=0.55}
  for(let k=0;k<o.length;k++)o[k]/=tot*0.5;return o} // ~[-1,1]
function mkMat(N,t,lo,hi,fn){const cv=mkCanvas(N,N),x=cv.getContext('2d');const img=x.createImageData(N,N),d=img.data;
  for(let y=0,o=0;y<N;y++)for(let X=0;X<N;X++,o+=4){let v=fn(X,y);v=v<-1?-1:v>1?1:v;const c=v<0?lo:hi;d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=(v<0?-v:v)*255}
  x.putImageData(img,0,0);const L=[cv];let src=d,n=N;
  while(n>8){const m=n>>1,dst=new Uint8ClampedArray(m*m*4);
    for(let y=0;y<m;y++)for(let X=0;X<m;X++){let r=0,g=0,b=0,a=0;for(const [u,v] of [[0,0],[1,0],[0,1],[1,1]]){const q=((y*2+v)*n+X*2+u)*4,w=src[q+3];r+=src[q]*w;g+=src[q+1]*w;b+=src[q+2]*w;a+=w}
      const q=(y*m+X)*4;if(a>0){dst[q]=r/a;dst[q+1]=g/a;dst[q+2]=b/a}dst[q+3]=a/4}
    const c2=mkCanvas(m,m),x2=c2.getContext('2d');const im2=x2.createImageData(m,m);im2.data.set(dst);x2.putImageData(im2,0,0);L.push(c2);src=dst;n=m}
  return {l:L,t}}
function mats(){if(MATS)return MATS;MATS={};const K=[0,0,0],Wh=[255,255,255];
  const hq=(x,y,s)=>(hh(x,y,s)&65535)/65535;
  // flat roof membrane: blotches, rolled strips (seams every 1.28 m), speckle, drain stains
  {const N=256,f=tfbm(N,4,6,11),f2=tfbm(N,32,3,12);MATS.mem=mkMat(N,0.08,K,Wh,(x,y)=>{let v=f[y*N+x]*0.32+f2[y*N+x]*0.12+(hq(x,y,1)-0.5)*0.22;const s=x%16;if(s===0)v-=0.38;else if(s===1)v+=0.18;return v})}
  // gravel ballast
  {const N=128,f=tfbm(N,8,4,21);MATS.grav=mkMat(N,0.035,[20,18,14],[250,246,236],(x,y)=>{const h=hq(x,y,2),h2=hq(x>>1,y>>1,3);return f[y*N+x]*0.3+(h-0.5)*0.6+(h2-0.5)*0.45})}
  // clay/concrete roof tiles: rows 0.32 m, tiles 0.24 m, staggered; bottom lip shadow; per-tile tone
  {const N=128,f=tfbm(N,8,3,31);MATS.tile=mkMat(N,0.04,[30,14,8],[255,236,210],(x,y)=>{const row=y>>3,ty=y&7,xs=(x+(row&1)*4)&127,tile=xs>>3,tx=xs&7;
    let v=(hq(tile,row,4)-0.5)*0.5+f[y*N+x]*0.18;v+=0.28-ty*0.07;if(ty===7)v-=0.55;if(tx===0)v-=0.32;if(hq(tile,row,5)<0.04)v-=0.35;return v})}
  // standing-seam metal / corrugated sheet (lines across x)
  {const N=128,f=tfbm(N,4,4,41);MATS.seam=mkMat(N,0.04,K,Wh,(x,y)=>{const s=x%16;let v=f[y*N+x]*0.14+(s===0?0.5:s===1?-0.45:s===2?-0.15:0);return v})}
  {const N=64,f=tfbm(N,4,3,42);MATS.corr=mkMat(N,0.05,K,Wh,(x,y)=>M.sin(x/N*TAU*16)*0.32+f[y*N+x]*0.15)}
  // concrete / sidewalk: blotches + expansion joints every 4 m + hairline cracks
  {const N=256,f=tfbm(N,4,6,51),c=tfbm(N,16,2,52);MATS.conc=mkMat(N,0.05,[10,10,12],[255,255,250],(x,y)=>{let v=f[y*N+x]*0.3+(hq(x,y,6)-0.5)*0.16;if((x&127)===0||(y&127)===0)v-=0.22;if(M.abs(c[y*N+x])<0.008)v-=0.25;return v})}
  // paving slabs 0.5 m with gaps and per-slab tone
  {const N=128,f=tfbm(N,4,4,61);MATS.pave=mkMat(N,0.025,[12,10,8],[255,252,240],(x,y)=>{const sx=x>>4,sy=y>>4;let v=(hq(sx,sy,7)-0.5)*0.35+f[y*N+x]*0.15+(hq(x,y,8)-0.5)*0.12;if((x&15)===0||(y&15)===0)v-=0.6;return v})}
  // asphalt: fine aggregate, patches, cracks
  {const N=256,f=tfbm(N,4,6,71),c=tfbm(N,8,3,72),pt=tfbm(N,2,2,73);MATS.asph=mkMat(N,0.05,[0,0,0],[235,235,230],(x,y)=>{let v=f[y*N+x]*0.18+(hq(x,y,9)-0.5)*0.42;if(pt[y*N+x]>0.55)v-=0.22;if(M.abs(c[y*N+x])<0.007)v-=0.3;return v})}
  // grass: clumps, dry and lush patches, clover
  {const N=256,f=tfbm(N,4,6,81),g=tfbm(N,32,2,82);MATS.grass=mkMat(N,0.05,[16,34,8],[214,222,128],(x,y)=>f[y*N+x]*0.4+g[y*N+x]*0.2+(hq(x,y,10)-0.5)*0.5)}
  // soil / garden beds
  {const N=128,f=tfbm(N,4,5,91);MATS.soil=mkMat(N,0.04,[28,18,8],[236,214,170],(x,y)=>f[y*N+x]*0.38+(hq(x,y,11)-0.5)*0.4)}
  return MATS}
// pattern for material `name` at s px/m; rot (rad) and origin (ox,oy) in current user space (metres)
function matP(ctx,name,s,rot,ox,oy,k){if(!HASDM)return null;const m=mats()[name];k=k||1;const want=1/(s*m.t*k);
  const lv=M.max(0,M.round(M.log2(want)));if(lv>=m.l.length)return null;
  if(PCTX!==ctx){PCTX=ctx;PCACHE={}}const key=name+lv;let P=PCACHE[key];if(!P){P=ctx.createPattern(m.l[lv],'repeat');PCACHE[key]=P}
  const sc=m.t*k*(1<<lv),c=rot?M.cos(rot):1,sn=rot?M.sin(rot):0;P.setTransform(new DOMMatrix([sc*c,sc*sn,-sc*sn,sc*c,ox||0,oy||0]));return P}
// two layers of the same material at incommensurate scale/angle hide the tiling period;
// structured materials (tiles, seams, slabs) keep their exact grid in layer 1 and only get a faint layer 2
const MAT2={tile:0.25,seam:0.25,pave:0.3,corr:0.2,mem:0.25,conc:0.3};
function matRect(ctx,name,s,a,x,y,w,h,rot,seed){const ox=seed?(seed&1023)*0.37:x,oy=seed?((seed>>>10)&1023)*0.29:y;const P=matP(ctx,name,s,rot,ox,oy);if(!P)return;const b=MAT2[name]||0.6;
  ctx.globalAlpha=a*(MAT2[name]?0.9:0.62);ctx.fillStyle=P;ctx.fillRect(x,y,w,h);const P2=matP(ctx,name,s,(rot||0)+0.73,ox*1.7+13.1,oy*1.3+7.7,2.618);if(P2){ctx.globalAlpha=a*b;ctx.fillStyle=P2;ctx.fillRect(x,y,w,h)}ctx.globalAlpha=1}
function matFill(ctx,name,s,a,rot,ox,oy){const P=matP(ctx,name,s,rot,ox,oy);if(!P)return;const b=MAT2[name]||0.6;ctx.globalAlpha=a*(MAT2[name]?0.9:0.62);ctx.fillStyle=P;ctx.fill();
  const P2=matP(ctx,name,s,(rot||0)+0.73,(ox||0)*1.7+13.1,(oy||0)*1.3+7.7,2.618);if(P2){ctx.globalAlpha=a*b;ctx.fillStyle=P2;ctx.fill()}ctx.globalAlpha=1}
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
// small box on a roof (machine room, AC unit, chimney): shadow hull + top face + sunlit/shaded rims
function rbox(ctx,x,y,w,h,H,col,s){const dx=SDX*H,dy=SDY*H;
  HP[0]=x;HP[1]=y;HP[2]=x+w;HP[3]=y;HP[4]=x+w;HP[5]=y+h;HP[6]=x;HP[7]=y+h;HP[8]=x+dx;HP[9]=y+dy;HP[10]=x+w+dx;HP[11]=y+dy;HP[12]=x+w+dx;HP[13]=y+h+dy;HP[14]=x+dx;HP[15]=y+h+dy;
  ctx.fillStyle='rgba(14,18,28,0.34)';ctx.beginPath();hullFill(ctx,HP,8);ctx.fill();
  ctx.fillStyle=cs(col,1);ctx.fillRect(x,y,w,h);
  if(w*s>3){const e=M.min(0.14,w*0.12);ctx.fillStyle='rgba(255,255,255,0.22)';ctx.fillRect(x,y,w,e);ctx.fillRect(x,y,e,h);ctx.fillStyle='rgba(0,0,0,0.22)';ctx.fillRect(x,y+h-e,w,e);ctx.fillRect(x+w-e,y,e,h)}}
function rdisc(ctx,x,y,r,H,col,dark){ctx.fillStyle='rgba(14,18,28,0.3)';ctx.beginPath();ctx.arc(x+SDX*H,y+SDY*H,r,0,TAU);ctx.fill();
  ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();if(dark){ctx.fillStyle=dark;ctx.beginPath();ctx.arc(x+r*0.08,y+r*0.08,r*0.62,0,TAU);ctx.fill()}}
// parapet: light rim + inner shadow strips on the edges facing away from the sun
function parapet(ctx,x,y,w,h,c,s,ph){const t=M.min(0.45,M.min(w,h)*0.06);ctx.lineWidth=t;ctx.strokeStyle=cs(c,1.25);ctx.strokeRect(x+t/2,y+t/2,w-t,h-t);
  ctx.fillStyle='rgba(10,14,24,0.26)';const a=SDY*ph,b=SDX*ph;
  if(a>0)ctx.fillRect(x+t,y+t,w-2*t,a);else if(a<0)ctx.fillRect(x+t,y+h-t+a,w-2*t,-a);
  if(b>0)ctx.fillRect(x+t,y+t,b,h-2*t);else if(b<0)ctx.fillRect(x+w-t+b,y+t,-b,h-2*t)}
const ACC=[[206,208,208],[188,190,192],[214,214,210],[170,174,178]];
function roofKit(ctx,p,x,y,w,h,c,s){const r=rng(hh(x*10|0,y*10|0,9));const A=w*h;const O=[];
  const free=(a,b,aw,ah)=>{if(a<x+0.8||b<y+0.8||a+aw>x+w-0.8||b+ah>y+h-0.8)return false;for(let i=0;i<O.length;i+=4)if(a<O[i]+O[i+2]+0.5&&a+aw>O[i]-0.5&&b<O[i+1]+O[i+3]+0.5&&b+ah>O[i+1]-0.5)return false;O.push(a,b,aw,ah);return true};
  // water stains near drains
  if(s>1.2){const n=2+(r()*3|0);for(let q=0;q<n;q++){const ex=r()<0.5,gx=ex?x+1+r()*(w-2):(r()<0.5?x+1.2:x+w-1.2),gy=ex?(r()<0.5?y+1.2:y+h-1.2):y+1+r()*(h-2);const rad=1.5+r()*3;
    const g=ctx.createRadialGradient(gx,gy,0,gx,gy,rad);g.addColorStop(0,'rgba(20,20,16,0.2)');g.addColorStop(1,'rgba(20,20,16,0)');ctx.fillStyle=g;ctx.fillRect(gx-rad,gy-rad,rad*2,rad*2);
    if(s>3){ctx.fillStyle='#2a2c2e';ctx.beginPath();ctx.arc(gx,gy,0.18,0,TAU);ctx.fill()}}}
  const fc=facadeOf(p);
  if(p.mr){const hor=w>=h,L=hor?w:h;for(let q=7;q<L-6;q+=16+r()*5){const bw=hor?4.5:3.6,bh=hor?3.6:4.5;const a=hor?x+q:x+w/2-bw/2,b=hor?y+h/2-bh/2:y+q;O.push(a,b,bw,bh);rbox(ctx,a,b,bw,bh,2.6,fc,s);
      if(s>2.5){ctx.fillStyle='rgba(40,44,50,0.8)';if(hor)ctx.fillRect(a+bw*0.35,b+bh-0.05,bw*0.3,0.12);else ctx.fillRect(a+bw-0.05,b+bh*0.35,0.12,bh*0.3)}}}
  else if(A>260&&r()<0.85){const bw=3.5+r()*3,bh=3+r()*2.5;const a=x+w*(0.25+r()*0.5)-bw/2,b=y+h*(0.25+r()*0.5)-bh/2;if(free(a,b,bw,bh))rbox(ctx,a,b,bw,bh,2.8,fc,s)}
  // AC units with fans
  const nAC=M.min(16,M.floor(A/(p.mr?260:110)*(0.5+r())));
  for(let q=0;q<nAC;q++){const big=r()<0.3,aw=big?2.2+r()*1.4:1.0+r()*0.8,ah=big?1.4+r()*1:0.8+r()*0.6;const a=x+1+r()*(w-aw-2),b=y+1+r()*(h-ah-2);if(!free(a,b,aw,ah))continue;
    rbox(ctx,a,b,aw,ah,big?1.4:0.9,ACC[r()*4|0],s);
    if(s>2.2){const nf=big?M.max(1,M.round(aw/1.1)):1,fr=M.min(ah*0.36,aw/nf*0.36);for(let f=0;f<nf;f++){const fx=a+aw*(f+0.5)/nf,fy=b+ah/2;ctx.fillStyle='#3e4246';ctx.beginPath();ctx.arc(fx,fy,fr,0,TAU);ctx.fill();
      if(s>5){ctx.strokeStyle='rgba(200,204,208,0.6)';ctx.lineWidth=0.04;ctx.beginPath();ctx.moveTo(fx-fr,fy);ctx.lineTo(fx+fr,fy);ctx.moveTo(fx,fy-fr);ctx.lineTo(fx,fy+fr);ctx.stroke()}}}}
  // vents, skylights, hatches, dishes
  if(s>1.5){const nv=M.min(10,M.floor(A/90)+1);for(let q=0;q<nv;q++){const vr=0.18+r()*0.25,a=x+1+r()*(w-2),b=y+1+r()*(h-2);if(!free(a-vr,b-vr,vr*2,vr*2))continue;rdisc(ctx,a,b,vr,0.6,'#b8bab8','#4a4c4e')}
    const ns=A>400?(r()*4|0):0;for(let q=0;q<ns;q++){const sw=1.2+r()*1.6,sh=1.2+r()*1.2,a=x+1+r()*(w-sw-2),b=y+1+r()*(h-sh-2);if(!free(a,b,sw,sh))continue;
      ctx.fillStyle='#c8cacc';ctx.fillRect(a-0.12,b-0.12,sw+0.24,sh+0.24);const g=ctx.createLinearGradient(a,b,a+sw,b+sh);g.addColorStop(0,'#5d7d96');g.addColorStop(0.5,'#a8c4d4');g.addColorStop(1,'#3f5a70');ctx.fillStyle=g;ctx.fillRect(a,b,sw,sh)}
    if(r()<0.5){const a=x+1+r()*(w-3),b=y+1+r()*(h-3);if(free(a,b,0.9,0.9)){ctx.fillStyle='#8a8c8e';ctx.fillRect(a,b,0.9,0.9);ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(a+0.9,b+0.15,0.15,0.9)}}
    if(r()<0.3&&s>2.5){const a=x+1.5+r()*(w-3),b=y+1.5+r()*(h-3);if(free(a-0.5,b-0.5,1,1)){ctx.fillStyle='rgba(14,18,28,0.3)';ctx.beginPath();ctx.ellipse(a+0.5,b+0.4,0.5,0.4,0.6,0,TAU);ctx.fill();ctx.fillStyle='#e4e4e0';ctx.beginPath();ctx.ellipse(a,b,0.48,0.38,0.6,0,TAU);ctx.fill()}}}}
function roof(ctx,p,s){const x=p.x,y=p.y,w=p.w,h=p.h,WIN=SEASON===2,c0=p.rc||p.c,c=WIN?seasonC(c0,p.r==='g'||p.r==='h'?1:p.r==='gl'?3:2):c0;const px=M.min(w,h)*s;const hs=hh(x*10|0,y*10|0,9);
  if(p.a){ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(p.a);ctx.translate(-x-w/2,-y-h/2)}
  if((p.r==='g'||p.r==='h')&&px>2){
    const hor=w>=h,mat=p.rc||(hs&7)<2?'seam':'tile',ma=WIN?0.22:mat==='tile'?0.62:0.45,rot=hor?0:PI/2;
    if(p.r==='g'){const A=[hor?[x,y,w,h/2,1.12]:[x,y,w/2,h,1.08],hor?[x,y+h/2,w,h/2,0.74]:[x+w/2,y,w/2,h,0.8]];
      for(const [a,b,aw,ah,k] of A){ctx.fillStyle=cs(c,k);ctx.fillRect(a,b,aw,ah);if(px>4)matRect(ctx,mat,s,ma,a,b,aw,ah,rot,hs)}
      if(px>5){ctx.lineCap='butt';ctx.strokeStyle=cs(c,WIN?1.05:0.62);ctx.lineWidth=0.35;ctx.beginPath();if(hor){ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2)}else{ctx.moveTo(x+w/2,y);ctx.lineTo(x+w/2,y+h)}ctx.stroke();
        ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=0.22;ctx.strokeRect(x+0.11,y+0.11,w-0.22,h-0.22)}}
    else{const m=M.min(w,h)/2;const F=[[[x,y],[x+w,y],[x+w-m,y+m],[x+m,y+m]],[[x,y],[x+m,y+m],[x+m,y+h-m],[x,y+h]],[[x,y+h],[x+m,y+h-m],[x+w-m,y+h-m],[x+w,y+h]],[[x+w,y],[x+w,y+h],[x+w-m,y+h-m],[x+w-m,y+m]]];const K=[1.14,0.98,0.74,0.86];
      for(let i=0;i<4;i++){const f=F[i];ctx.beginPath();ctx.moveTo(f[0][0],f[0][1]);for(let q=1;q<4;q++)ctx.lineTo(f[q][0],f[q][1]);ctx.closePath();ctx.fillStyle=cs(c,K[i]);ctx.fill();if(px>4)matFill(ctx,mat,s,ma,i&1?PI/2:0,(hs&1023)*0.37,((hs>>>10)&1023)*0.29)}
      if(px>5){ctx.strokeStyle=cs(c,WIN?1.05:1.3);ctx.lineWidth=0.25;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+m,y+m);ctx.lineTo(x+w-m,y+m);ctx.lineTo(x+w,y);ctx.moveTo(x,y+h);ctx.lineTo(x+m,y+h-m);ctx.lineTo(x+w-m,y+h-m);ctx.lineTo(x+w,y+h);ctx.moveTo(x+m,y+m);ctx.lineTo(x+m,y+h-m);ctx.moveTo(x+w-m,y+m);ctx.lineTo(x+w-m,y+h-m);ctx.stroke();
        ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=0.22;ctx.strokeRect(x+0.11,y+0.11,w-0.22,h-0.22)}}
    if(px>7&&!p.nd){const r=rng(hs);const nc=r()<0.75?1+(r()<0.3?1:0):0;const BR=[[148,82,62],[120,112,104],[164,98,74]];
      for(let q=0;q<nc;q++){const t=0.2+r()*0.6;const cx2=hor?x+w*t:x+w/2+(r()-0.5)*w*0.3,cy2=hor?y+h/2+(r()-0.5)*h*0.3:y+h*t;rbox(ctx,cx2-0.4,cy2-0.4,0.8,0.8,1.3,BR[r()*3|0],s);if(s>3){ctx.fillStyle='#1e1e1e';ctx.fillRect(cx2-0.22,cy2-0.22,0.44,0.44)}}
      if(r()<0.35){const nw=1+(r()*2|0);for(let q=0;q<nw;q++){const t=0.25+q*0.35+r()*0.1;const wx=hor?x+w*t:x+w*0.72,wy=hor?y+h*0.68:y+h*t;ctx.fillStyle='#d8d8d4';ctx.fillRect(wx-0.5,wy-0.6,1.0,1.2);ctx.fillStyle='#3e5466';ctx.fillRect(wx-0.4,wy-0.5,0.8,1.0)}}}
  }else if(p.r==='gl'){const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,cs(c,0.7));g.addColorStop(0.45,cs(c,1.35));g.addColorStop(0.55,cs(c,1.05));g.addColorStop(1,cs(c,0.6));ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    if(px>6)matRect(ctx,'mem',s,0.18,x,y,w,h,0,hs);
    if(px>14){ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=0.18;ctx.beginPath();for(let q=x+3;q<x+w;q+=3){ctx.moveTo(q,y);ctx.lineTo(q,y+h)}for(let q=y+3;q<y+h;q+=3){ctx.moveTo(x,q);ctx.lineTo(x+w,q)}ctx.stroke();ctx.strokeStyle='rgba(220,230,240,0.55)';ctx.lineWidth=0.8;ctx.strokeRect(x+0.4,y+0.4,w-0.8,h-0.8);
      if(!p.nd&&px>18)roofKit(ctx,p,x+w*0.3,y+h*0.3,w*0.4,h*0.4,c,s)}}
  else if(p.r==='glh'){ctx.fillStyle='rgba(215,232,230,0.92)';ctx.fillRect(x,y,w,h);if(px>4){const hor=w>=h;ctx.fillStyle='rgba(120,150,150,0.35)';if(hor)for(let q=y;q<y+h;q+=3.2)ctx.fillRect(x,q,w,0.35);else for(let q=x;q<x+w;q+=3.2)ctx.fillRect(q,y,0.35,h);
      ctx.fillStyle='rgba(255,255,255,0.35)';if(hor)for(let q=y+1.6;q<y+h;q+=3.2)ctx.fillRect(x,q,w,0.5);else for(let q=x+1.6;q<x+w;q+=3.2)ctx.fillRect(q,y,0.5,h)}}
  else if(p.r==='arc'){const hor=w>=h,g=hor?ctx.createLinearGradient(0,y,0,y+h):ctx.createLinearGradient(x,0,x+w,0);
    g.addColorStop(0,cs(c,0.62));g.addColorStop(0.28,cs(c,1.16));g.addColorStop(0.55,cs(c,1.02));g.addColorStop(1,cs(c,0.56));ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    if(px>3)matRect(ctx,'corr',s,WIN?0.2:0.45,x,y,w,h,hor?PI/2:0,hs);
    if(px>6){ctx.strokeStyle='rgba(20,24,20,0.28)';ctx.lineWidth=0.12;ctx.beginPath();const L=hor?w:h;for(let t=2.5;t<L-1;t+=2.5){if(hor){ctx.moveTo(x+t,y);ctx.lineTo(x+t,y+h)}else{ctx.moveTo(x,y+t);ctx.lineTo(x+w,y+t)}}ctx.stroke();
      ctx.fillStyle='rgba(40,44,40,0.75)';if(hor){ctx.fillRect(x,y+h*0.3,0.5,h*0.4);ctx.fillRect(x+w-0.5,y+h*0.3,0.5,h*0.4)}else{ctx.fillRect(x+w*0.3,y,w*0.4,0.5);ctx.fillRect(x+w*0.3,y+h-0.5,w*0.4,0.5)}}}
  else{ctx.fillStyle=cs(c,1);ctx.fillRect(x,y,w,h);
    if(p.cnp){ctx.fillStyle=cs(p.cnp,1);ctx.fillRect(x,y,w,1.3);ctx.fillRect(x,y+h-1.3,w,1.3)}
    if(p.r==='co'){const hor=w>=h;if(px>3)matRect(ctx,(hs&3)?'corr':'seam',s,WIN?0.25:0.55,x,y,w,h,hor?0:PI/2,hs);
      if(p.fac&&(hs&1)&&px>6){ // factory shed: sawtooth bays, glazed north slopes with mullions, shaded south slopes
        const L=hor?h:w,bay=7.5,nb=M.max(1,M.floor((L-2)/bay)),o=(L-nb*bay)/2;for(let q=0;q<nb;q++){const a=o+q*bay;
          const g=hor?ctx.createLinearGradient(0,y+a,0,y+a+bay):ctx.createLinearGradient(x+a,0,x+a+bay,0);g.addColorStop(0,'rgba(0,0,0,0.22)');g.addColorStop(0.72,'rgba(255,255,255,0.08)');g.addColorStop(0.73,'rgba(150,176,196,0.95)');g.addColorStop(1,'rgba(196,214,226,0.95)');
          ctx.fillStyle=g;if(hor)ctx.fillRect(x+1,y+a,w-2,bay);else ctx.fillRect(x+a,y+1,bay,h-2)}
        if(s>2.5){ctx.strokeStyle='rgba(60,70,80,0.5)';ctx.lineWidth=0.08;ctx.beginPath();for(let q=0;q<nb;q++){const a=o+q*bay+bay*0.73;for(let t=1.5;t<(hor?w:h)-1;t+=1.5){if(hor){ctx.moveTo(x+t,y+a);ctx.lineTo(x+t,y+a+bay*0.27)}else{ctx.moveTo(x+a,y+t);ctx.lineTo(x+a+bay*0.27,y+t)}}}ctx.stroke()}}
      else if(px>6){ctx.fillStyle='rgba(230,240,250,0.35)';if(hor)for(let q=y+8;q<y+h-4;q+=16)ctx.fillRect(x+3,q,w-6,1.6);else for(let q=x+8;q<x+w-4;q+=16)ctx.fillRect(q,y+3,1.6,h-6)}
      if(p.fac&&px>14){ // ridge ventilators (turbine vents) along the long axis, exhaust fans near the ends
        const L=hor?w:h;for(let t=6;t<L-5;t+=9){const vx=hor?x+t:x+w/2,vy=hor?y+h/2:y+t;rdisc(ctx,vx,vy,0.55,1.1,'#b4b8bc','rgba(70,74,80,0.7)')}
        for(const t of [3.5,L-3.5]){const vx=hor?x+t:x+w*0.25,vy=hor?y+h*0.25:y+t;rbox(ctx,vx-1,vy-1,2,2,1.4,[150,154,158],s);if(s>3){ctx.strokeStyle='rgba(30,30,30,0.6)';ctx.lineWidth=0.08;ctx.beginPath();ctx.arc(vx,vy,0.75,0,TAU);ctx.stroke()}}}
      if(px>3)parapet(ctx,x,y,w,h,c,s,0.5)}
    else if(px>3&&!p.nd){if(!p.sol&&!p.rg)matRect(ctx,(hs&7)<3?'grav':'mem',s,WIN?0.3:0.7,x,y,w,h,w>=h?0:PI/2,hs);parapet(ctx,x,y,w,h,c,s,0.9)}
    if(px>10&&!p.nd){const r=rng(hs^0x5bd1);
      if(p.heli){const cx=x+w/2,cy=y+h/2,rr2=M.min(w,h)*0.3;ctx.fillStyle='#3a3d40';ctx.beginPath();ctx.arc(cx,cy,rr2,0,TAU);ctx.fill();matFill(ctx,'asph',s,0.5);ctx.strokeStyle='#e8e8e0';ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(cx,cy,rr2,0,TAU);ctx.stroke();ctx.fillStyle='#e8e8e0';ctx.fillRect(cx-rr2*0.35,cy-rr2*0.5,rr2*0.15,rr2);ctx.fillRect(cx+rr2*0.2,cy-rr2*0.5,rr2*0.15,rr2);ctx.fillRect(cx-rr2*0.35,cy-rr2*0.07,rr2*0.7,rr2*0.14)}
      else if(p.sol){const m=1.6,hor=w>=h;for(let yy=y+m;yy<y+h-m-1.7;yy+=2.6){ctx.fillStyle='rgba(14,18,28,0.35)';ctx.fillRect(x+m,yy+1.6,w-2*m,0.5);const g=ctx.createLinearGradient(x,yy,x+w,yy+1.6);g.addColorStop(0,'#1b2846');g.addColorStop(0.5,'#2c4170');g.addColorStop(1,'#18233e');ctx.fillStyle=g;ctx.fillRect(x+m,yy,w-2*m,1.6);
          if(s>2){ctx.strokeStyle='rgba(170,190,220,0.35)';ctx.lineWidth=0.04;ctx.beginPath();for(let q=x+m;q<x+w-m;q+=1){ctx.moveTo(q,yy);ctx.lineTo(q,yy+1.6)}ctx.moveTo(x+m,yy+0.8);ctx.lineTo(x+w-m,yy+0.8);ctx.stroke()}}}
      else if(p.rg){const m=2.2;ctx.fillStyle=WIN?'#dfe4e8':SEASON===1?'#8a8a48':'#5e8a44';ctx.fillRect(x+m,y+m,w-2*m,h-2*m);matRect(ctx,'grass',s,WIN?0.2:0.8,x+m,y+m,w-2*m,h-2*m,0,hs);ctx.fillStyle='#b8ae94';ctx.fillRect(x+w/2-0.8,y+m,1.6,h-2*m);matRect(ctx,'pave',s,0.6,x+w/2-0.8,y+m,1.6,h-2*m,0,hs);
        for(let q=0;q<8;q++){const tx=x+m+1.5+r()*(w-2*m-3),ty=y+m+1.5+r()*(h-2*m-3),tr=0.9+r()*1.4;ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.arc(tx+0.5,ty+0.4,tr,0,TAU);ctx.fill();ctx.fillStyle=r()<0.5?'#3f6e30':'#4f7e38';ctx.beginPath();ctx.arc(tx,ty,tr,0,TAU);ctx.fill()}}
      else if(p.r!=='co'||r()<0.5)roofKit(ctx,p,x,y,w,h,c,s);
      if(p.cons){ctx.strokeStyle='rgba(60,60,60,0.5)';ctx.lineWidth=0.3;ctx.beginPath();for(let q=x;q<x+w;q+=3){ctx.moveTo(q,y);ctx.lineTo(q,y+h)}ctx.stroke()}}}
  // anti-drone net (stage 5.7): a dark mesh on cables over the roof, sagging between the masts
  if(p.net&&px>2){const m=1.2;ctx.fillStyle='rgba(40,46,40,0.18)';ctx.fillRect(x-m,y-m,w+2*m,h+2*m);
    if(s>0.5){ctx.strokeStyle='rgba(30,34,30,0.42)';ctx.lineWidth=M.max(0.05,0.5/s);const st=s>2?1.6:3.2;ctx.beginPath();for(let q=x-m;q<=x+w+m;q+=st){ctx.moveTo(q,y-m);ctx.lineTo(q,y+h+m)}for(let q=y-m;q<=y+h+m;q+=st){ctx.moveTo(x-m,q);ctx.lineTo(x+w+m,q)}ctx.stroke()}
    ctx.strokeStyle='rgba(20,22,20,0.7)';ctx.lineWidth=M.max(0.1,0.25);ctx.strokeRect(x-m,y-m,w+2*m,h+2*m);ctx.beginPath();const sp=M.max(8,M.min(w,h)/2);for(let q=x+sp;q<x+w;q+=sp){ctx.moveTo(q,y-m);ctx.lineTo(q,y+h+m)}ctx.stroke();
    ctx.fillStyle='#2a2c28';for(const [a,b] of [[x-m,y-m],[x+w+m,y-m],[x+w+m,y+h+m],[x-m,y+h+m]]){ctx.beginPath();ctx.arc(a,b,0.35,0,TAU);ctx.fill()}}
  if(p.a)ctx.restore()}
const BC=new Float64Array(8),NRM=[0,-1,1,0,0,1,-1,0];
function facadeOf(p){if(p.fc)return p.fc;const c=p.c;
  if(p.r==='gl')return [c[0]*1.15,c[1]*1.15,c[2]*1.2];
  if(p.rc)return p.c;
  if(p.r==='g'||p.r==='h'){const v=hh(p.x*7|0,p.y*7|0,13)&3;return [[226,218,200],[206,196,176],[232,228,220],[190,170,150]][v]}
  if(p.mr)return [200,198,192];
  return [c[0]*0.55+100,c[1]*0.55+96,c[2]*0.55+88]}
// ---------------------------------------------------------------- ground floors (stage 4.3)
// p.gf = [shop edge, entrance edge, lobby edge], -1 = none; edges 0 top, 1 right, 2 bottom, 3 left (building frame).
// Units: [kind, u0, u1, hash]; kind 1 shop front, 2 entrance, 3 lobby. Shared by the day facade, the ground-plane
// canopies and the night layer, so all three always agree.
const SIGNC=[[196,44,40],[34,92,168],[236,186,44],[40,138,78],[236,236,230],[118,52,128],[228,112,32],[36,36,40]];
const AWNC=[[176,46,40],[38,96,68],[36,70,128],[198,150,58],[112,40,50],[72,76,82],[214,206,190]];
function gfUnits(p,e,el,s){const k=p.gf,U=[];const hs=hh(p.x*10|0,p.y*10|0,e+41);
  if(p.dk&&p.dk.indexOf(e)>=0){const n=M.max(1,M.floor(el*0.72/4.2)),u0=(el-n*4.2)/2,tr=p.dkt&&e===p.dk[1];for(let i=0;i<n;i++){const v=hh(hs,i,4);U.push([4,u0+i*4.2+0.6,u0+i*4.2+3.6,tr&&v%3!==0?v|1:v&~1])}}
  if(p.gate===e&&s>0.7){const n=el>70?2:1;for(let i=0;i<n;i++){const c=el*(n===1?0.5:0.3+0.4*i);U.push([5,c-2.6,c+2.6,hh(hs,i,6)])}}
  if(!k||s<=1.5)return U;
  if(e===k[0]){let u=0.6,i=0;while(u<el-3.5){let w=5+(hh(hs,i,1)%45)/10;if(el-0.6-u-w<4)w=el-0.6-u;U.push([1,u,u+w-0.5,hh(hs,i,2)]);u+=w;i++}}
  else if(e===k[1]&&p.hs){const c=el*p.hs;U.push([2,c-0.9,c+0.9,hh(hs,0,3)|16])} // porch of a private house
  else if(e===k[1]){const n=M.max(1,M.round(el/(p.mr?24:19)));for(let i=0;i<n;i++){const v=p.mr?hh(hs,i,3)|16:hh(hs,i,3)&~16;if(!p.mr&&(v&3)===0)continue;const c=(i+0.5)*el/n;U.push([2,c-1.3,c+1.3,v])}}
  else if(e===k[2]){const w=M.min(el*0.45,6+(hs%5));const c=el*(0.35+((hs>>>8)&255)/255*0.3);U.push([3,c-w/2,c+w/2,hs])}
  return U}
// canopy of a unit: [height of the wall edge, height of the outer edge, depth, colour] or null
function gfCanopy(u){const v=u[3];
  if(u[0]===1)return (v&7)<5?[2.9,2.45,1.15+((v>>>3)&3)*0.18,AWNC[(v>>>5)%7]]:null;
  if(u[0]===2)return u[2]-u[1]<2?[2.4,2.3,1.0,[[112,74,54],[150,148,142],[84,92,100]][(v>>>0)%3]]:[2.7,2.7,1.35,(v>>>4)&1?[164,162,156]:[96,62,52]];
  if(u[0]===4)return [4.6,4.6,0.7,[44,46,50]];
  if(u[0]===5)return null;
  return [4.3,4.3,3.2,[150,156,162]]}
// world point on a facade: corner a, unit edge vector E, outward normal N; u along, o out, z up (lean) or z down the sun (shadow)
let GA=0,GB=0,GEX=0,GEY=0,GNX=0,GNY=0;
function gq(ctx,u0,u1,o0,o1,z0,z1,kx,ky,mv){const X=(u,o,z)=>GA+GEX*u+GNX*o+kx*z,Y=(u,o,z)=>GB+GEY*u+GNY*o+ky*z;
  if(mv)ctx.moveTo(X(u0,o0,z0),Y(u0,o0,z0));else ctx.lineTo(X(u0,o0,z0),Y(u0,o0,z0));ctx.lineTo(X(u1,o0,z0),Y(u1,o0,z0));ctx.lineTo(X(u1,o1,z1),Y(u1,o1,z1));ctx.lineTo(X(u0,o1,z1),Y(u0,o1,z1));ctx.closePath()}
function gfEdge(e,ca,sa){const e1=(e+1)&3;GA=BC[e*2];GB=BC[e*2+1];const dx=BC[e1*2]-GA,dy=BC[e1*2+1]-GB,el=M.hypot(dx,dy);GEX=dx/el;GEY=dy/el;
  GNX=NRM[e*2]*ca-NRM[e*2+1]*sa;GNY=NRM[e*2]*sa+NRM[e*2+1]*ca;return el}
// ground plane, drawn before the facades: stoops, terraces and the shadows of canopies
function gfGround(ctx,p,GU,ca,sa,s){
  for(let e=0;e<4;e++){const U=GU[e];if(!U.length)continue;gfEdge(e,ca,sa);
    for(const u of U){const cp=gfCanopy(u);
      if(u[0]===2){ctx.fillStyle=SEASON===2?'#d4d8dc':'#b2aea4';ctx.beginPath();gq(ctx,u[1]+0.2,u[2]-0.2,0,1.6,0,0,0,0,1);ctx.fill();
        if(s>4){ctx.strokeStyle='rgba(40,40,40,0.25)';ctx.lineWidth=0.05;ctx.beginPath();gq(ctx,u[1]+0.5,u[2]-0.5,0,0.75,0,0,0,0,1);ctx.stroke()}}
      if(u[0]===5){ctx.fillStyle='#96948c';ctx.beginPath();gq(ctx,u[1]-1,u[2]+1,0,7,0,0,0,0,1);ctx.fill();ctx.strokeStyle='rgba(230,200,60,0.8)';ctx.lineWidth=0.18;ctx.beginPath();gq(ctx,u[1]-0.6,u[2]+0.6,0.4,6.4,0,0,0,0,1);ctx.stroke()}
      if(u[0]===4){const tr=u[3]&1;ctx.fillStyle='#8e8c86';ctx.beginPath();gq(ctx,u[1]-0.6,u[2]+0.6,0,tr?19:8.5,0,0,0,0,1);ctx.fill();
        ctx.fillStyle='#d8b830';ctx.beginPath();gq(ctx,u[1]-0.3,u[2]+0.3,0,0.35,0,0,0,0,1);ctx.fill();
        if(s>2){ctx.fillStyle='#222';ctx.beginPath();for(const a of [u[1]+0.1,u[2]-0.45])gq(ctx,a,a+0.35,0,0.3,0,0,0,0,1);ctx.fill()}
        ctx.strokeStyle='rgba(236,232,220,0.7)';ctx.lineWidth=0.14;ctx.beginPath();for(const a of [u[1]-0.45,u[2]+0.45]){ctx.moveTo(GA+GEX*a+GNX*1.2,GB+GEY*a+GNY*1.2);ctx.lineTo(GA+GEX*a+GNX*(tr?18:8),GB+GEY*a+GNY*(tr?18:8))}ctx.stroke()}
      if(cp){ctx.fillStyle='rgba(14,18,28,0.26)';ctx.beginPath();gq(ctx,u[1],u[2],0,cp[2],cp[0],cp[1],SDX,SDY,1);ctx.fill()}
      if(u[0]===1&&((u[3]>>>11)&7)<2&&SEASON!==2&&u[2]-u[1]>4.5){ // summer café terrace: deck + tables
        ctx.fillStyle='#8a7058';ctx.beginPath();gq(ctx,u[1]+0.3,u[2]-0.3,cp?cp[2]+0.1:0.2,(cp?cp[2]:0)+2.3,0,0,0,0,1);ctx.fill();
        if(s>3){ctx.strokeStyle='rgba(40,28,20,0.35)';ctx.lineWidth=0.04;ctx.beginPath();for(let a=u[1]+0.6;a<u[2]-0.3;a+=0.3){const o0=cp?cp[2]+0.1:0.2;ctx.moveTo(GA+GEX*a+GNX*o0,GB+GEY*a+GNY*o0);ctx.lineTo(GA+GEX*a+GNX*(o0+2.2),GB+GEY*a+GNY*(o0+2.2))}ctx.stroke()}}}}}
// canopies and awnings at their real height (lean), drawn after the facades and before the roof (which hides the far side)
function gfCanopies(ctx,p,GU,ca,sa,s){
  for(let e=0;e<4;e++){const U=GU[e];if(!U.length)continue;gfEdge(e,ca,sa);
    for(const u of U){const cp=gfCanopy(u);
      if(u[0]===1&&((u[3]>>>11)&7)<2&&SEASON!==2&&u[2]-u[1]>4.5){const o=(cp?cp[2]:0)+1.25,n=M.max(1,M.floor((u[2]-u[1]-0.6)/2.6)),uc=AWNC[(u[3]>>>17)%7];
        for(let q=0;q<n;q++){const a=u[1]+0.3+(q+0.5)*(u[2]-u[1]-0.6)/n,X=GA+GEX*a+GNX*o,Y=GB+GEY*a+GNY*o;
          ctx.fillStyle='rgba(14,18,28,0.22)';ctx.beginPath();ctx.arc(X+SDX*2.3,Y+SDY*2.3,1.05,0,TAU);ctx.fill();
          if(s<3){ctx.fillStyle='#e4e0d4';ctx.fillRect(X-0.4,Y-0.4,0.8,0.8);continue}
          // umbrella: 8 panels, alternating tone, at 2.3 m
          const cx=X+LNX*2.3,cy=Y+LNY*2.3;for(let k=0;k<8;k++){ctx.fillStyle=cs(k&1?uc:[236,232,222],k<4?1.02:0.86);ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,1.1,k*PI/4,(k+1)*PI/4);ctx.closePath();ctx.fill()}
          ctx.fillStyle='rgba(30,30,30,0.6)';ctx.beginPath();ctx.arc(cx,cy,0.08,0,TAU);ctx.fill()}}
      if(u[0]===4&&(u[3]&1)){const S=sprites(),a=(u[1]+u[2])/2;ctx.save();ctx.translate(GA+GEX*a+GNX*0.35,GB+GEY*a+GNY*0.35);ctx.rotate(M.atan2(GNY,GNX));ctx.drawImage(S.truck[(u[3]>>>3)%5],0,-2.1,17,4.2);ctx.restore()}
      if(!cp)continue;const [z0,z1,d,c]=cp;const top=SEASON===2?(u[0]===1?[c[0]*0.45+126,c[1]*0.45+129,c[2]*0.45+131]:[226,230,234]):c;
      ctx.fillStyle=cs(top,1);ctx.beginPath();gq(ctx,u[1],u[2],0,d,z0,z1,LNX,LNY,1);ctx.fill();
      if(u[0]===1&&((u[3]>>>9)&1)&&s>2.5){ // striped canvas
        ctx.fillStyle='rgba(245,242,232,0.8)';ctx.beginPath();for(let a=u[1]+0.25;a<u[2]-0.25;a+=0.9)gq(ctx,a,M.min(a+0.45,u[2]),0,d,z0,z1,LNX,LNY,1);ctx.fill()}
      // shading: the fold of the awning, the outer lip / fascia
      ctx.fillStyle=u[0]===1?'rgba(0,0,0,0.16)':'rgba(0,0,0,0.12)';ctx.beginPath();gq(ctx,u[1],u[2],0,0.25,z0,z0,LNX,LNY,1);ctx.fill();
      ctx.strokeStyle=cs(top,u[0]===1?0.62:0.7);ctx.lineWidth=M.max(0.06,0.7/s);ctx.beginPath();const X=(a)=>GA+GEX*a+GNX*d+LNX*z1,Y=(a)=>GB+GEY*a+GNY*d+LNY*z1;
      ctx.moveTo(X(u[1]),Y(u[1]));ctx.lineTo(X(u[2]),Y(u[2]));ctx.stroke();
      if(u[0]===3){ // lobby canopy: glass panes over a steel frame, two columns
        if(s>2.5){ctx.strokeStyle='rgba(70,76,84,0.7)';ctx.lineWidth=0.08;ctx.beginPath();for(let a=u[1]+1.5;a<u[2]-0.5;a+=1.5){ctx.moveTo(GA+GEX*a+LNX*z0,GB+GEY*a+LNY*z0);ctx.lineTo(X(a),Y(a))}ctx.stroke()}
        ctx.fillStyle='rgba(200,224,236,0.25)';ctx.beginPath();gq(ctx,u[1]+0.2,u[2]-0.2,0.3,d-0.2,z0,z1,LNX,LNY,1);ctx.fill();
        ctx.strokeStyle='#5a6068';ctx.lineWidth=0.25;ctx.beginPath();for(const a of [u[1]+0.6,u[2]-0.6]){const gx=GA+GEX*a+GNX*(d-0.4),gy=GB+GEY*a+GNY*(d-0.4);ctx.moveTo(gx,gy);ctx.lineTo(gx+LNX*z1,gy+LNY*z1)}ctx.stroke()}
      else if(u[0]===2&&s>3){ // entrance lamp under the canopy
        const a=(u[1]+u[2])/2;ctx.fillStyle='#e8e4d4';ctx.fillRect(GA+GEX*a+GNX*0.2+LNX*z0-0.1,GB+GEY*a+GNY*0.2+LNY*z0-0.1,0.2,0.2)}}}}
// on a visible facade: shop windows with sign bands, doors, lobby glazing. fh = floor height
function gfFacade(ctx,U,a0x,a0y,ex,ey,el,dlx,dly,dh,fh,br){const q=(u0,u1,z0,z1)=>{const t0=z0/dh,t1=z1/dh;ctx.moveTo(a0x+ex*u0+dlx*t0,a0y+ey*u0+dly*t0);ctx.lineTo(a0x+ex*u1+dlx*t0,a0y+ey*u1+dly*t0);ctx.lineTo(a0x+ex*u1+dlx*t1,a0y+ey*u1+dly*t1);ctx.lineTo(a0x+ex*u0+dlx*t1,a0y+ey*u0+dly*t1);ctx.closePath()};
  for(const u of U){const v=u[3];
    if(u[0]===1){const gt=M.min(fh*0.7,3.0);ctx.fillStyle=cs([36,48,56],br);ctx.beginPath();q(u[1]+0.25,u[2]-0.25,0.35,gt);ctx.fill();
      ctx.fillStyle='rgba(176,200,214,0.32)';ctx.beginPath();q(u[1]+0.35,u[2]-0.35,gt*0.55,gt-0.1);ctx.fill();
      ctx.fillStyle=cs(SIGNC[v%8],br*1.05);ctx.beginPath();q(u[1]+0.15,u[2]-0.15,gt+0.12,M.min(fh*0.96,gt+0.75));ctx.fill();
      ctx.fillStyle=v%8===4||v%8===2?'rgba(30,30,30,0.7)':'rgba(255,255,250,0.75)';ctx.beginPath();const L=u[2]-u[1],n=M.max(2,M.floor(L*0.9));for(let i=0;i<n;i++){if(hh(v,i,5)%5===0)continue;const a=u[1]+L*0.2+i*L*0.6/n;q(a,a+L*0.6/n*0.7,gt+0.3,gt+0.58)}ctx.fill()}
    else if(u[0]===2){const c=(u[1]+u[2])/2;ctx.fillStyle=cs((v>>>4)&1?[70,56,44]:[58,64,70],br);ctx.beginPath();q(c-0.65,c+0.65,0,2.2);ctx.fill();
      ctx.fillStyle='rgba(150,176,196,0.4)';ctx.beginPath();q(c-0.5,c+0.5,1.4,2.05);ctx.fill()}
    else if(u[0]===5){const gh=M.min(dh*0.75,5.2);ctx.fillStyle=cs([60,64,68],br);ctx.beginPath();q(u[1]-0.3,u[2]+0.3,0,gh+0.3);ctx.fill();ctx.fillStyle=cs((v>>>5)&1?[120,138,150]:[176,150,70],br);ctx.beginPath();q(u[1],u[2],0,gh);ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.18)';ctx.beginPath();for(let a=u[1]+0.6;a<u[2]-0.2;a+=0.65)q(a,a+0.09,0,gh);ctx.fill()}
    else if(u[0]===4){ctx.fillStyle=cs([30,30,32],br);ctx.beginPath();q(u[1]-0.35,u[2]+0.35,1.0,4.6);ctx.fill();ctx.fillStyle=cs((v>>>6)&1?[188,190,190]:[150,160,172],br);ctx.beginPath();q(u[1],u[2],1.2,4.3);ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.16)';ctx.beginPath();for(let z=1.5;z<4.2;z+=0.45)q(u[1],u[2],z,z+0.08);ctx.fill()}
    else{ctx.fillStyle=cs([30,40,48],br);ctx.beginPath();q(M.max(0.3,u[1]-1.5),M.min(el-0.3,u[2]+1.5),0.1,M.min(fh*0.92,4.2));ctx.fill();ctx.fillStyle='rgba(190,210,222,0.3)';ctx.beginPath();q(M.max(0.4,u[1]-1.4),M.min(el-0.4,u[2]+1.4),2.4,M.min(fh*0.9,4.1));ctx.fill()}}}
function bld3d(ctx,p,s){
  const H=p.H,H0=p.H0||0;let lx=LNX*H,ly=LNY*H;const lpx=M.hypot(lx,ly)*s;
  if(lpx<0.6){roof(ctx,p,s);return}
  const x=p.x,y=p.y,w=p.w,h=p.h;let ca=1,sa=0;if(p.a){ca=M.cos(p.a);sa=M.sin(p.a)}
  const cx=x+w/2,cy=y+h/2,hw=w/2,hhh=h/2;
  BC[0]=cx+(-hw)*ca-(-hhh)*sa;BC[1]=cy+(-hw)*sa+(-hhh)*ca;BC[2]=cx+hw*ca-(-hhh)*sa;BC[3]=cy+hw*sa+(-hhh)*ca;
  BC[4]=cx+hw*ca-hhh*sa;BC[5]=cy+hw*sa+hhh*ca;BC[6]=cx+(-hw)*ca-hhh*sa;BC[7]=cy+(-hw)*sa+hhh*ca;
  const fc=facadeOf(p);const bx=LNX*H0,by=LNY*H0;const dh=H-H0;const dlx=lx-bx,dly=ly-by;const LL=M.hypot(dlx,dly);
  const glass=p.r==='gl';const GU=(p.gf&&s>1.5||(p.dk||p.gate!==undefined)&&s>0.7)&&!H0?[gfUnits(p,0,w,s),gfUnits(p,1,h,s),gfUnits(p,2,w,s),gfUnits(p,3,h,s)]:null;
  if(GU)gfGround(ctx,p,GU,ca,sa,s);
  for(let e=0;e<4;e++){const nx=NRM[e*2]*ca-NRM[e*2+1]*sa,ny=NRM[e*2]*sa+NRM[e*2+1]*ca;const dp=nx*lx+ny*ly;if(dp>=0)continue;
    const wnx=nx*FCA-ny*FSA,wny=nx*FSA+ny*FCA;const br=0.9-0.3*(wnx*0.7071+wny*0.7071);
    const e1=(e+1)&3;const a0x=BC[e*2]+bx,a0y=BC[e*2+1]+by,a1x=BC[e1*2]+bx,a1y=BC[e1*2+1]+by;
    if(glass&&lpx>8){const gg=ctx.createLinearGradient(a0x,a0y,a0x+dlx,a0y+dly);gg.addColorStop(0,cs(fc,br*0.8));gg.addColorStop(0.7,cs(fc,br*1.15));gg.addColorStop(1,cs(fc,br*1.4));ctx.fillStyle=gg}else ctx.fillStyle=cs(fc,br);ctx.beginPath();ctx.moveTo(a0x,a0y);ctx.lineTo(a1x,a1y);ctx.lineTo(a1x+dlx,a1y+dly);ctx.lineTo(a0x+dlx,a0y+dly);ctx.closePath();ctx.fill();
    const fl=M.max(1,M.round(dh/3.1));const el=M.hypot(a1x-a0x,a1y-a0y);
    const fpx=LL*s/fl,ex0=(a1x-a0x)/el,ey0=(a1y-a0y)/el;const GE=GU&&GU[e].length?GU[e]:null,f0=GE&&GE[0][0]===1?1:0;
    if(glass&&fpx>=1.5&&el*s>8&&-dp>0.35*M.hypot(lx,ly)){
      // curtain wall: spandrel bands at the slabs, per-pane tint, mullions on a 1.5 / 3 m module, dark double-height lobby
      const quad=(u0,u1,t0,t1)=>{ctx.moveTo(a0x+ex0*u0+dlx*t0,a0y+ey0*u0+dly*t0);ctx.lineTo(a0x+ex0*u1+dlx*t0,a0y+ey0*u1+dly*t0);ctx.lineTo(a0x+ex0*u1+dlx*t1,a0y+ey0*u1+dly*t1);ctx.lineTo(a0x+ex0*u0+dlx*t1,a0y+ey0*u0+dly*t1);ctx.closePath()};
      const mod=1.5*s>=3?1.5:3*s>=3?3:0,nq=mod?M.max(1,M.round(el/mod)):0,pw=nq?el/nq:el,hs=hh(p.x*10|0,p.y*10|0,37),lb=H0?0:M.min(0.3,5/dh);
      if(nq&&fl*nq<7000){for(const [m,c] of [[1,'rgba(214,232,246,0.08)'],[2,'rgba(8,18,32,0.12)'],[3,'rgba(120,150,170,0.07)']]){ctx.beginPath();for(let f=0;f<fl;f++){const t0=f/fl;if(t0<lb)continue;for(let k=0;k<nq;k++){if((hh(hs,f*131+k,e)&7)!==m)continue;quad(k*pw,(k+1)*pw,t0,(f+1)/fl)}}ctx.fillStyle=c;ctx.fill()}}
      ctx.beginPath();for(let f=1;f<=fl;f++){const t1=f/fl;if(t1<=lb)continue;quad(0,el,t1-0.24/fl,t1)}ctx.fillStyle=cs(fc,br*0.55);ctx.globalAlpha=0.55;ctx.fill();ctx.globalAlpha=1;
      if(lb){ctx.fillStyle='rgba(18,26,34,0.62)';ctx.beginPath();quad(0,el,0,lb);ctx.fill()}
      if(nq){ctx.beginPath();for(let k=1;k<nq;k++){const u=k*pw;ctx.moveTo(a0x+ex0*u,a0y+ey0*u);ctx.lineTo(a0x+ex0*u+dlx,a0y+ey0*u+dly)}ctx.lineWidth=M.max(0.05,0.45/s);ctx.strokeStyle='rgba(12,20,30,0.34)';ctx.stroke()}
      ctx.beginPath();ctx.moveTo(a0x+dlx,a0y+dly);ctx.lineTo(a1x+dlx,a1y+dly);ctx.lineWidth=M.max(0.08,0.8/s);ctx.strokeStyle='rgba(230,240,248,0.5)';ctx.stroke()}
    else if(!p.nd&&!glass&&p.r!=='co'&&p.r!=='arc'&&fpx>=2.6&&el*s>8&&-dp>0.5*M.hypot(lx,ly)&&fl*el<9000){
      // real windows: per-floor openings (dark glass + sky reflection), panel blocks get balconies
      const ws=p.mr?3.0:(p.r==='g'||p.r==='h')?2.8:3.3,nw=M.max(1,M.floor((el-1.2)/ws)),st0=(el-nw*ws)/2,ww=ws*(p.mr?0.42:0.5);const hs=hh(p.x*10|0,p.y*10|0,31);
      const quad=(u0,u1,t0,t1)=>{const bx0=a0x+ex0*u0,by0=a0y+ey0*u0,bx1=a0x+ex0*u1,by1=a0y+ey0*u1;ctx.moveTo(bx0+dlx*t0,by0+dly*t0);ctx.lineTo(bx1+dlx*t0,by1+dly*t0);ctx.lineTo(bx1+dlx*t1,by1+dly*t1);ctx.lineTo(bx0+dlx*t1,by0+dly*t1);ctx.closePath()};
      ctx.beginPath();for(let f=f0;f<fl;f++){const t0=(f+0.22)/fl,t1=(f+0.78)/fl;for(let q=0;q<nw;q++){const u=st0+q*ws+(ws-ww)/2;quad(u,u+ww,t0,t1)}}ctx.fillStyle=cs([46,58,72],br);ctx.fill();
      if(fpx>4){ctx.beginPath();for(let f=f0;f<fl;f++){const t0=(f+0.55)/fl,t1=(f+0.78)/fl;for(let q=0;q<nw;q++){if(hh(hs,f,q)&1)continue;const u=st0+q*ws+(ws-ww)/2;quad(u+ww*0.1,u+ww*0.9,t0,t1)}}ctx.fillStyle='rgba(170,196,214,0.35)';ctx.fill()}
      if(p.mr&&fpx>3.5){ctx.beginPath();for(let f=1;f<fl;f++){const t0=(f+0.05)/fl,t1=(f+0.2)/fl;for(let q=(hs&1);q<nw;q+=2){const u=st0+q*ws+(ws-ww)/2-ww*0.35;quad(u,u+ww*1.7,t0,t1)}}ctx.fillStyle=cs(fc,br*1.12);ctx.fill()}
      if(fpx>3){ctx.beginPath();for(let f=1;f<fl;f++){const t=f/fl;ctx.moveTo(a0x+dlx*t,a0y+dly*t);ctx.lineTo(a1x+dlx*t,a1y+dly*t)}ctx.lineWidth=LL/fl*0.06;ctx.strokeStyle='rgba(0,0,0,0.18)';ctx.stroke()}}
    else if(!p.nd&&LL*s/fl>1.7&&el*s>5&&-dp>0.55*M.hypot(lx,ly)){
      ctx.lineWidth=LL/fl*(glass?0.5:0.4);ctx.strokeStyle=glass?'rgba(190,225,245,0.42)':(p.r==='co'||p.r==='arc'?'rgba(60,70,80,0.35)':'rgba(38,48,60,0.6)');
      if(!glass)ctx.setLineDash(p.r==='co'||p.r==='arc'?[2,9]:[1.3,1.6]);
      const ex=(a1x-a0x)/el,ey=(a1y-a0y)/el,ins=M.min(1.2,el*0.08);ctx.beginPath();
      for(let f=f0;f<fl;f++){const t=(f+0.58)/fl;ctx.moveTo(a0x+ex*ins+dlx*t,a0y+ey*ins+dly*t);ctx.lineTo(a1x-ex*ins+dlx*t,a1y-ey*ins+dly*t)}ctx.stroke();if(!glass)ctx.setLineDash([])}
    if(GE&&fpx>=1.8&&-dp>0.5*M.hypot(lx,ly))gfFacade(ctx,GE,a0x,a0y,ex0,ey0,el,dlx,dly,dh,dh/fl,br)}
  if(GU)gfCanopies(ctx,p,GU,ca,sa,s);
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
  if(p.st==='tank'&&lp>4){ // shell courses, spiral stair with handrail up the visible side
    const ff=M.atan2(-ly,-lx),nc=M.max(2,M.round(H/2.4));ctx.strokeStyle='rgba(0,0,0,0.12)';ctx.lineWidth=M.max(0.05,0.6/s);ctx.beginPath();
    for(let q=1;q<nc;q++){const t=q/nc;ctx.moveTo(p.x+lx*t+M.cos(ff-1.45)*r,p.y+ly*t+M.sin(ff-1.45)*r);ctx.arc(p.x+lx*t,p.y+ly*t,r,ff-1.45,ff+1.45)}ctx.stroke();
    const sx=(t)=>{const a=ff-1.3+t*2.3;return [p.x+lx*t+M.cos(a)*r*1.01,p.y+ly*t+M.sin(a)*r*1.01]};const st=[];for(let q=0;q<=16;q++)st.push(sx(q/16));
    ctx.lineCap='butt';ctx.strokeStyle='rgba(40,42,46,0.75)';ctx.lineWidth=0.9;ctx.beginPath();ctx.moveTo(st[0][0],st[0][1]);for(const q of st)ctx.lineTo(q[0],q[1]);ctx.stroke();
    if(lp>10){ctx.strokeStyle='rgba(230,226,210,0.8)';ctx.lineWidth=0.12;ctx.beginPath();ctx.moveTo(st[0][0]+LNX*1.1,st[0][1]+LNY*1.1);for(const q of st)ctx.lineTo(q[0]+LNX*1.1,q[1]+LNY*1.1);ctx.stroke()}}
  if(p.st==='cool'&&lp>6){ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=r*0.05;ctx.beginPath();for(let q=1;q<8;q++){const t=q/8;ctx.moveTo(p.x+lx*t-nx*r*0.9,p.y+ly*t-ny*r*0.9);ctx.lineTo(p.x+lx*t+nx*r*0.9,p.y+ly*t+ny*r*0.9)}ctx.stroke()}
  if(p.st==='chim'&&lp>3){ctx.strokeStyle=cs(p.c,1);ctx.lineWidth=r*1.7;ctx.setLineDash([L/14,L/14]);ctx.beginPath();ctx.moveTo(p.x+lx*0.5,p.y+ly*0.5);ctx.lineTo(p.x+lx*0.98,p.y+ly*0.98);ctx.stroke();ctx.setLineDash([])}
  if(p.st==='tower'&&lp>3){ctx.strokeStyle='rgba(200,170,60,0.75)';ctx.lineWidth=r*0.25;ctx.beginPath();for(let q=1;q<5;q++){const t=q/5;ctx.moveTo(p.x+lx*t-nx*r*1.2,p.y+ly*t-ny*r*1.2);ctx.lineTo(p.x+lx*t+nx*r*1.2,p.y+ly*t+ny*r*1.2)}ctx.stroke()}
  ctx.translate(lx,ly);const sr=p.r;if(p.st==='cool'||p.st==='chim')p.r=rt;cylDraw(ctx,p,s);p.r=sr;ctx.translate(-lx,-ly)}
function tallKey(p){const x=p.k==='b'?p.x+p.w/2:p.x,y=p.k==='b'?p.y+p.h/2:p.y;return x*LNX+y*LNY-(p.lvl||0)*1e7}
const DEF=[];
function drawTall(ctx,p,s){const k=p.k;
  if(k==='b')bld3d(ctx,p,s);else if(k==='cyl')cyl3d(ctx,p,s);
  else if(k==='dome'){const H=p.H||16;const ox=LNX*H,oy=LNY*H,r=p.r;
    if(p.drum){const dH=H*0.72,dx=LNX*dH,dy=LNY*dH,rd=r*0.82;const L=M.hypot(ox,oy)||1,nx=-oy/L,ny=ox/L;ctx.fillStyle=cs(p.drum,0.82);ctx.beginPath();ctx.moveTo(p.x+dx*0.75+nx*rd,p.y+dy*0.75+ny*rd);ctx.lineTo(p.x+dx+nx*rd,p.y+dy+ny*rd);ctx.lineTo(p.x+dx-nx*rd,p.y+dy-ny*rd);ctx.lineTo(p.x+dx*0.75-nx*rd,p.y+dy*0.75-ny*rd);ctx.closePath();ctx.fill();
      if(s>2){ctx.fillStyle='rgba(40,46,56,0.55)';for(let q=0;q<5;q++){const t=(q-2)/2.6;ctx.fillRect(p.x+dx*0.86+nx*rd*t-0.12,p.y+dy*0.86+ny*rd*t-0.25,0.24,0.5)}}}
    const cx=p.x+ox,cy=p.y+oy;ctx.fillStyle='rgba(20,22,30,0.35)';ctx.beginPath();ctx.arc(cx+r*0.15,cy+r*0.15,r*1.02,0,TAU);ctx.fill();
    const g=ctx.createRadialGradient(cx-r*0.45,cy-r*0.5,r*0.05,cx,cy,r);const gold=p.c[0]>200&&p.c[2]<120;g.addColorStop(0,gold?'#fff4c8':cs(p.c,1.6));g.addColorStop(0.35,cs(p.c,1.1));g.addColorStop(0.8,cs(p.c,0.7));g.addColorStop(1,cs(p.c,0.45));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.fill();
    if(s*r>3){ctx.strokeStyle=cs(p.c,0.55);ctx.lineWidth=M.max(0.05,r*0.05);ctx.beginPath();for(let q=0;q<8;q++){const a=q/8*TAU;ctx.moveTo(cx+LNX*r*0.6,cy+LNY*r*0.6);ctx.quadraticCurveTo(cx+M.cos(a)*r*0.7,cy+M.sin(a)*r*0.7,cx+M.cos(a)*r*0.98,cy+M.sin(a)*r*0.98)}ctx.stroke()}
    const tx=cx+LNX*r*1.1,ty=cy+LNY*r*1.1;ctx.fillStyle=gold?'#ffe9a0':cs(p.c,1.3);ctx.beginPath();ctx.arc(tx,ty,r*0.12,0,TAU);ctx.fill();
    if(s>1.2){const cl=r*0.9+0.6;ctx.strokeStyle='#e8c860';ctx.lineWidth=M.max(0.08,0.12);ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx+LNX*cl*2,ty+LNY*cl*2);const mx=tx+LNX*cl*1.5,my=ty+LNY*cl*1.5,ex=-LNY*0.5,ey=LNX*0.5,el=M.hypot(ex,ey)||1;ctx.moveTo(mx-ex/el*0.45,my-ey/el*0.45);ctx.lineTo(mx+ex/el*0.45,my+ey/el*0.45);ctx.stroke()}}
  else if(k==='apse'){const H=p.H,ox=LNX*H,oy=LNY*H;ctx.fillStyle=cs(p.c,0.78);ctx.beginPath();ctx.arc(p.x,p.y,p.r,-PI/2,PI/2);ctx.lineTo(p.x+ox,p.y+oy+p.r);ctx.arc(p.x+ox,p.y+oy,p.r,PI/2,-PI/2,true);ctx.closePath();ctx.fill();
    ctx.fillStyle=cs(p.rc,1.05);ctx.beginPath();ctx.moveTo(p.x+ox,p.y+oy-p.r);ctx.arc(p.x+ox,p.y+oy,p.r,-PI/2,PI/2);ctx.closePath();ctx.fill();matFill(ctx,'seam',s,0.4,0,0,0);
    ctx.strokeStyle=cs(p.rc,0.7);ctx.lineWidth=0.12;ctx.beginPath();for(let q=1;q<6;q++){const a=-PI/2+q/6*PI;ctx.moveTo(p.x+ox,p.y+oy);ctx.lineTo(p.x+ox+M.cos(a)*p.r,p.y+oy+M.sin(a)*p.r)}ctx.stroke()}
  else if(k==='crane2'){const ox=LNX*p.H,oy=LNY*p.H;ctx.strokeStyle='#d8a818';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+ox,p.y+oy);ctx.stroke();
    ctx.save();ctx.translate(p.x+ox,p.y+oy);ctx.rotate(p.a);ctx.fillStyle='#e0b020';ctx.fillRect(-p.len*0.3,-0.7,p.len*1.3,1.4);ctx.fillStyle='#777';ctx.fillRect(-p.len*0.3,-1.6,6,3.2);ctx.fillStyle='#e0b020';ctx.fillRect(-1.2,-1.2,2.4,2.4);
    ctx.strokeStyle='rgba(40,40,40,0.6)';ctx.lineWidth=0.12;ctx.beginPath();ctx.moveTo(p.len*0.7,0);ctx.lineTo(p.len*0.7,0.01);ctx.stroke();ctx.restore()}}
function cylDraw(ctx,p,s){const x=p.x,y=p.y,r=p.r,c=p.c;
  switch(p.st){
  case 'tank':{let g=ctx.createRadialGradient(x-r*0.35,y-r*0.35,r*0.1,x,y,r);g.addColorStop(0,cs(c,1.08));g.addColorStop(1,cs(c,0.7));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    if(r*s>4){ctx.strokeStyle=cs(c,0.6);ctx.lineWidth=r*0.06;ctx.beginPath();ctx.arc(x,y,r*0.88,0,TAU);ctx.stroke();ctx.fillStyle=cs(c,0.8);ctx.beginPath();ctx.arc(x,y,r*0.12,0,TAU);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=r*0.02;ctx.beginPath();for(let k=0;k<8;k++){const a=k/8*TAU;ctx.moveTo(x+M.cos(a)*r*0.15,y+M.sin(a)*r*0.15);ctx.lineTo(x+M.cos(a)*r*0.85,y+M.sin(a)*r*0.85)}ctx.stroke();
      if(r*s>10){ // roof handrail, landing at the stair head, catwalk to the centre, vents and a gauge hatch
        const ff=M.atan2(-LNY,-LNX)+1.0;ctx.strokeStyle='rgba(236,232,220,0.75)';ctx.lineWidth=M.max(0.06,0.5/s);ctx.beginPath();ctx.arc(x,y,r*0.985,0,TAU);ctx.stroke();
        ctx.save();ctx.translate(x,y);ctx.rotate(ff);ctx.fillStyle='rgba(14,18,28,0.25)';ctx.fillRect(r*0.12+0.3,-0.3,r*0.86,1.1);ctx.fillStyle='#8a8c8e';ctx.fillRect(r*0.12,-0.5,r*0.86,1.0);ctx.fillStyle='#6e7072';ctx.fillRect(r*0.84,-1.2,1.6,2.4);
        ctx.strokeStyle='#d8c040';ctx.lineWidth=0.1;ctx.beginPath();ctx.moveTo(r*0.12,-0.55);ctx.lineTo(r*0.98,-0.55);ctx.moveTo(r*0.12,0.55);ctx.lineTo(r*0.98,0.55);ctx.stroke();ctx.restore();
        for(let k=0;k<3;k++){const a=ff+2+k*1.3;rdisc(ctx,x+M.cos(a)*r*0.6,y+M.sin(a)*r*0.6,M.max(0.35,r*0.04),0.6,cs(c,0.85),'rgba(40,42,46,0.6)')}}}break}
  case 'cool':{let g=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.2,x,y,r);g.addColorStop(0,cs(c,1.08));g.addColorStop(0.75,cs(c,0.92));g.addColorStop(1,cs(c,0.66));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    g=ctx.createRadialGradient(x+r*0.2,y+r*0.2,r*0.1,x,y,r*0.74);g.addColorStop(0,'#3a3c3e');g.addColorStop(0.85,'#25272a');g.addColorStop(1,'#55575a');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*0.74,0,TAU);ctx.fill();break}
  case 'chim':{ctx.fillStyle='#e8e6e0';ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.fillStyle=cs(c,1);ctx.beginPath();ctx.arc(x,y,r*0.82,0,TAU);ctx.fill();ctx.fillStyle='#1c1c1e';ctx.beginPath();ctx.arc(x,y,r*0.55,0,TAU);ctx.fill();break}
  case 'tower':{let g=ctx.createRadialGradient(x-r*0.4,y-r*0.4,0,x,y,r);g.addColorStop(0,'#f4f4f4');g.addColorStop(1,cs(c,0.65));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    if(r*s>3){ctx.strokeStyle='rgba(200,170,60,0.8)';ctx.lineWidth=r*0.18;ctx.beginPath();ctx.arc(x,y,r*1.3,0,TAU*0.7);ctx.stroke()}break}
  case 'gtow':{let g=ctx.createRadialGradient(x-r*0.4,y-r*0.4,r*0.1,x,y,r);g.addColorStop(0,cs(c,1.5));g.addColorStop(0.6,cs(c,1));g.addColorStop(1,cs(c,0.7));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    ctx.fillStyle='#9a9ca0';ctx.beginPath();ctx.arc(x,y,r*0.45,0,TAU);ctx.fill();ctx.strokeStyle='rgba(230,240,250,0.6)';ctx.lineWidth=r*0.05;ctx.beginPath();ctx.arc(x,y,r*0.95,0,TAU);ctx.stroke();break}
  case 'sphere':{let g=ctx.createRadialGradient(x-r*0.4,y-r*0.45,r*0.05,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(0.5,cs(c,0.95));g.addColorStop(1,cs(c,0.55));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();break}
  }}

// playground: rubber surface, sandbox, swings, slide tower, carousel, benches (local metres)
function playground(ctx,p,s){const r=rng((p.x*7|0)^(p.y*13|0)),x=p.x,y=p.y,w=p.w,h=p.h,WI=SEASON===2;
  ctx.fillStyle='#9a9890';ctx.fillRect(x-0.3,y-0.3,w+0.6,h+0.6);ctx.fillStyle=WI?'#dfe3e6':r()<0.5?'#b4563e':'#4f7f56';ctx.fillRect(x,y,w,h);matRect(ctx,'grav',s,WI?0.15:0.4,x,y,w,h,0,p.x*31|0);
  const sh=(a,b,aw,ah,H)=>{ctx.fillStyle='rgba(14,18,28,0.3)';ctx.fillRect(a+SDX*H,b+SDY*H,aw,ah)};
  // sandbox
  const sbx=x+0.8,sby=y+h-3.6;ctx.fillStyle='#8a6a44';ctx.fillRect(sbx,sby,2.8,2.8);ctx.fillStyle=WI?'#e8eaec':'#dcc890';ctx.fillRect(sbx+0.25,sby+0.25,2.3,2.3);matRect(ctx,'soil',s,0.35,sbx+0.25,sby+0.25,2.3,2.3,0,7);
  // swings: frame beam + 2 seats
  const swx=x+w*0.45,swy=y+1.2;sh(swx,swy,3.6,0.18,2.2);ctx.fillStyle='#3a4a5a';ctx.fillRect(swx,swy,3.6,0.18);ctx.fillRect(swx,swy-0.4,0.15,1.0);ctx.fillRect(swx+3.45,swy-0.4,0.15,1.0);
  ctx.fillStyle='#d0402e';ctx.fillRect(swx+0.7,swy+0.55,0.55,0.3);ctx.fillStyle='#2f6fb8';ctx.fillRect(swx+2.3,swy+0.55,0.55,0.3);
  // slide tower with roof + chute
  const tx=x+w-4,ty=y+h*0.45;sh(tx,ty,1.6,1.6,2.6);ctx.fillStyle=['#e0a020','#c8402e','#3a78c0'][r()*3|0];ctx.fillRect(tx,ty,1.6,1.6);ctx.fillStyle='rgba(0,0,0,0.25)';ctx.fillRect(tx+0.8,ty,0.8,1.6);
  ctx.fillStyle='#cfd3d6';ctx.fillRect(tx-2.4,ty+0.5,2.4,0.6);ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fillRect(tx-2.4,ty+0.5,2.4,0.15);
  // carousel
  if(w>11){const cx=x+w*0.3,cy=y+h*0.45;ctx.fillStyle='rgba(14,18,28,0.25)';ctx.beginPath();ctx.arc(cx+0.3,cy+0.25,1.1,0,TAU);ctx.fill();ctx.fillStyle='#d8d8d0';ctx.beginPath();ctx.arc(cx,cy,1.1,0,TAU);ctx.fill();
    for(let q=0;q<4;q++){ctx.fillStyle=['#d0402e','#e0b020','#3a78c0','#40a050'][q];ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,1.0,q*PI/2,(q+1)*PI/2);ctx.closePath();ctx.fill()}ctx.fillStyle='#555';ctx.beginPath();ctx.arc(cx,cy,0.18,0,TAU);ctx.fill()}
  // benches
  ctx.fillStyle='#7a5a3a';for(const bx of [x+0.6,x+w-2.4])ctx.fillRect(bx,y-1.0,1.8,0.45)}
// plaza: decorative paving bands, planters with shrubs, benches, lamp posts, litter bins
function plaza(ctx,p,s){const r=rng(p.seed),x=p.x,y=p.y,w=p.w,h=p.h,WI=SEASON===2;
  const band=WI?'rgba(150,156,162,0.14)':'rgba(120,110,100,0.32)',sp=12+(r()*3|0)*4;
  ctx.fillStyle=band;for(let q=x+sp/2;q<x+w;q+=sp)ctx.fillRect(q,y,0.8,h);for(let q=y+sp/2;q<y+h;q+=sp)ctx.fillRect(x,q,w,0.8);
  const n=M.min(40,M.floor(w*h/260));
  for(let i=0;i<n;i++){const t=r(),px=x+2+r()*(w-6),py=y+2+r()*(h-6);
    if(t<0.35){const pw=2.5+r()*3,ph=1.4+r()*1.2,hor=r()<0.5,aw=hor?pw:ph,ah=hor?ph:pw;ctx.fillStyle='rgba(14,18,28,0.28)';ctx.fillRect(px+SDX*0.6,py+SDY*0.6,aw,ah);ctx.fillStyle='#9c9890';ctx.fillRect(px,py,aw,ah);
      ctx.fillStyle=WI?'#dde2e4':SEASON===1?'#8a7a3a':'#4a7a38';ctx.fillRect(px+0.25,py+0.25,aw-0.5,ah-0.5);if(!WI){for(let q=0;q<4;q++){ctx.fillStyle=r()<0.5?'#3d6a2e':'#5a8a40';ctx.beginPath();ctx.arc(px+0.5+r()*(aw-1),py+0.5+r()*(ah-1),0.35+r()*0.3,0,TAU);ctx.fill()}
        if(SEASON===0&&r()<0.5){ctx.fillStyle=['#d84a5a','#e8c040','#e87a30','#c060c0'][r()*4|0];for(let q=0;q<6;q++){ctx.beginPath();ctx.arc(px+0.4+r()*(aw-0.8),py+0.4+r()*(ah-0.8),0.15,0,TAU);ctx.fill()}}}}
    else if(t<0.6){const hor=r()<0.5;ctx.fillStyle='rgba(14,18,28,0.3)';ctx.fillRect(px+0.2,py+0.2,hor?1.8:0.5,hor?0.5:1.8);ctx.fillStyle='#7a5a3a';ctx.fillRect(px,py,hor?1.8:0.5,hor?0.5:1.8);ctx.fillStyle='#444';ctx.fillRect(px,py,hor?1.8:0.08,hor?0.08:1.8)}
    else if(t<0.85){ctx.strokeStyle='rgba(14,18,28,0.35)';ctx.lineWidth=0.14;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+SDX*5,py+SDY*5);ctx.stroke();ctx.fillStyle='#2e3236';ctx.beginPath();ctx.arc(px,py,0.18,0,TAU);ctx.fill();ctx.fillStyle='#e8e4d8';ctx.beginPath();ctx.arc(px+LNX*5,py+LNY*5,0.28,0,TAU);ctx.fill()}
    else{ctx.fillStyle='#3a3e42';ctx.beginPath();ctx.arc(px,py,0.3,0,TAU);ctx.fill();ctx.fillStyle='#1e2022';ctx.beginPath();ctx.arc(px,py,0.18,0,TAU);ctx.fill()}}}
// material for a flat ground primitive, guessed from its colour
function groundMat(p){const c=p.c,r=c[0],g=c[1],b=c[2];if(p.tr)return 'pave';
  if(g>r+6&&g>=b)return 'grass';if(r>g+10&&r>b+20)return 'soil';const l=(r+g+b)/3;return l<95?'asph':(hh(p.x*3|0,p.y*3|0,17)&3)?'conc':'pave'}
function drawPrims(ctx,P,pass,mpp){const s=1/mpp;
  for(let q=0;q<P.length;q++){const p=P[q];const k=p.k;
    if(pass===0){
      if(k==='g'){if(p.w*s<0.4&&p.h*s<0.4)continue;ctx.fillStyle=cs(seasonC(p.c,p.tr?4:0),1);ctx.fillRect(p.x,p.y,p.w,p.h);
        if(s>0.45&&p.w*s>3&&p.h*s>3){const m=p.gm||(p.gm=groundMat(p));matRect(ctx,m,s,SEASON===2?(m==='grass'||m==='soil'?0.15:0.35):m==='grass'?0.6:0.5,p.x,p.y,p.w,p.h,0,(p.x*7.3+p.y*3.1)|0)}}
      else if(k==='gl'){ctx.strokeStyle=cs(seasonC(p.c,4),1);ctx.lineWidth=M.max(p.w,mpp*0.6);ctx.lineCap='butt';if(p.dash)ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(p.pts[0],p.pts[1]);for(let i=2;i<p.pts.length;i+=2)ctx.lineTo(p.pts[i],p.pts[i+1]);ctx.stroke();if(p.dash)ctx.setLineDash([])}
      else if(k==='wood'){if(s<1.5)continue;ctx.fillStyle='rgba(14,18,28,0.3)';ctx.fillRect(p.x+0.4,p.y+0.3,p.w,p.h);ctx.fillStyle='#8a6440';ctx.fillRect(p.x,p.y,p.w,p.h);if(s>4){ctx.fillStyle='#c09868';const r=rng(p.x*9|0);for(let q=0;q<p.w*p.h*12;q++){ctx.beginPath();ctx.arc(p.x+0.1+r()*(p.w-0.2),p.y+0.1+r()*(p.h-0.2),0.07,0,TAU);ctx.fill()}}}
      else if(k==='path'){ctx.fillStyle=SEASON===2?'#d8dce0':'#b4aa98';ctx.fillRect(p.x,p.y,p.w,p.h);matRect(ctx,'pave',s,0.5,p.x,p.y,p.w,p.h,0,0)}
      else if(k==='gc'){ctx.fillStyle=cs(seasonC(p.c,0),1);ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();if(s>0.45){matFill(ctx,groundMat(p),s,0.45,0,3.3,1.7);ctx.strokeStyle='rgba(0,0,0,0.18)';ctx.lineWidth=0.3;ctx.stroke()}}
      else if(k==='pond'){const wi=SEASON===2;ctx.fillStyle=wi?'#c8cfd4':'#6a8a5a';ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx+1.5,p.ry+1.5,0,0,TAU);ctx.fill();const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.rx);g.addColorStop(0,wi?'#b8ccd8':'#2e5a66');g.addColorStop(1,wi?'#d6e2ea':'#4a7e80');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,0,0,TAU);ctx.fill()}
      else if(k==='pk'){ctx.fillStyle='#55585c';ctx.fillRect(p.x,p.y,p.w,p.h);matRect(ctx,'asph',s,0.8,p.x,p.y,p.w,p.h,0,0);if(s>1.2){ctx.strokeStyle='rgba(235,235,230,0.65)';ctx.lineWidth=0.12;ctx.beginPath();const hor=p.w>=p.h;
          if(hor){const rows=M.max(1,M.floor(p.h/5.4));for(let r=0;r<rows;r++){for(let x=p.x;x<=p.x+p.w;x+=2.6){ctx.moveTo(x,p.y+r*5.4);ctx.lineTo(x,p.y+r*5.4+5)}}}else{const rows=M.max(1,M.floor(p.w/5.4));for(let r=0;r<rows;r++){for(let y=p.y;y<=p.y+p.h;y+=2.6){ctx.moveTo(p.x+r*5.4,y);ctx.lineTo(p.x+r*5.4+5,y)}}}ctx.stroke()}}
      else if(k==='rows'){if(s<0.6)continue;const WI=SEASON===2;ctx.fillStyle=WI?'#e2e6ea':'#7a644a';ctx.fillRect(p.x,p.y,p.w,p.h);if(!WI)matRect(ctx,'soil',s,0.6,p.x,p.y,p.w,p.h,0,p.x*13|0);
        // beds of different crops separated by trodden paths: potatoes (clumps), cabbage (pale rosettes), onion/carrot (fine lines), strawberry
        const r=rng((p.x*31|0)^(p.y*17|0)),L=p.o===0?p.h:p.w,Wd=p.o===0?p.w:p.h;let pos=0.3;
        while(pos<L-0.8){const bw=1.0+r()*0.5,crop=r()*4|0;const bx=p.o===0?p.x:p.x+pos,by=p.o===0?p.y+pos:p.y;const bW=p.o===0?Wd:bw,bH=p.o===0?bw:Wd;
          if(WI){ctx.fillStyle='rgba(180,186,192,0.5)';ctx.fillRect(bx,by,bW,bH*0.3)}
          else if(SEASON===1&&crop!==1){ctx.fillStyle='rgba(60,44,30,0.35)';ctx.fillRect(bx,by,bW,bH)}
          else if(s<2.5){ctx.fillStyle=['#4e7a34','#7e9e62','#5f8a3c','#3f6e30'][crop];ctx.fillRect(bx+(p.o?0.15:0),by+(p.o?0:0.15),p.o?bW-0.3:bW,p.o?bH:bH-0.3)}
          else{const step=crop===2?0.25:0.55,rad=crop===0?0.28:crop===1?0.3:crop===2?0.08:0.18;ctx.fillStyle=['#4e7a34','#88a86a','#6a9a40','#3f7a32'][crop];ctx.beginPath();
            for(let a=0.3;a<(p.o===0?Wd:Wd)-0.2;a+=step)for(let l=0.25;l<bw-0.2;l+=0.45){const X=p.o===0?bx+a:bx+l,Y=p.o===0?by+l:by+a;const j=(r()-0.5)*0.12;ctx.moveTo(X+j+rad,Y);ctx.arc(X+j,Y,rad,0,TAU)}ctx.fill();
            }
          pos+=bw+0.45}}
      else if(k==='track'){const r=p.h/2;ctx.fillStyle=SEASON===2?'#d8d4d2':'#a8503c';rr(ctx,p.x,p.y,p.w,p.h,r);ctx.fill();ctx.fillStyle=SEASON===2?'#e8ecf0':SEASON===1?'#6e8a3c':'#4f8a3c';rr(ctx,p.x+5,p.y+5,p.w-10,p.h-10,r-5);ctx.fill();
        if(s>1){ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=0.15;for(let l=1;l<5;l++){rr(ctx,p.x+l,p.y+l,p.w-2*l,p.h-2*l,r-l);ctx.stroke()}ctx.strokeRect(p.x+p.w*0.2,p.y+8,p.w*0.6,p.h-16);ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y+8);ctx.lineTo(p.x+p.w/2,p.y+p.h-8);ctx.stroke()}}
      else if(k==='rw'){ctx.fillStyle='#5a5c60';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='rgba(40,40,40,0.5)';ctx.fillRect(p.x+80,p.y+p.h*0.3,p.w-160,p.h*0.4);
        if(s>0.12){ctx.fillStyle='#ececec';for(let x=p.x+120;x<p.x+p.w-120;x+=60)ctx.fillRect(x,p.y+p.h/2-0.45,30,0.9);
          for(const e of [p.x+8,p.x+p.w-38])for(let q=0;q<8;q++)ctx.fillRect(e,p.y+4+q*(p.h-8)/8+0.5,30,(p.h-8)/8*0.55);
          ctx.fillRect(p.x,p.y+1,p.w,0.9);ctx.fillRect(p.x,p.y+p.h-1.9,p.w,0.9);for(const e of [p.x+300,p.x+p.w-345])ctx.fillRect(e,p.y+8,45,8),ctx.fillRect(e,p.y+p.h-16,45,8)}}
      else if(k==='rw2'){ctx.fillStyle='#4e5054';ctx.fillRect(p.x,p.y,p.w,p.h);matRect(ctx,'asph',s,0.7,p.x,p.y,p.w,p.h,0,7);
        if(s>0.3){ctx.fillStyle='#e8e8e2';const cy=p.y+p.h/2;for(let x=p.x+34;x<p.x+p.w-40;x+=24)ctx.fillRect(x,cy-0.25,12,0.5);ctx.fillRect(p.x+1,p.y+0.8,p.w-2,0.4);ctx.fillRect(p.x+1,p.y+p.h-1.2,p.w-2,0.4);
          for(const e of [p.x+3,p.x+p.w-15])for(let q=0;q<6;q++)ctx.fillRect(e,p.y+2+q*(p.h-4)/6+0.3,12,(p.h-4)/6*0.55);for(const e of [p.x+60,p.x+p.w-82])ctx.fillRect(e,p.y+3,22,2),ctx.fillRect(e,p.y+p.h-5,22,2)}
        if(s>1.2){ctx.fillStyle='rgba(0,0,0,0.25)';for(let x=p.x+40;x<p.x+p.w-40;x+=7)ctx.fillRect(x+(x*13%5),p.y+p.h*0.35,3,p.h*0.3);ctx.fillStyle='#d8d4a0';for(let x=p.x;x<=p.x+p.w;x+=30){ctx.fillRect(x-0.3,p.y-1.5,0.6,0.6);ctx.fillRect(x-0.3,p.y+p.h+0.9,0.6,0.6)}}}
      else if(k==='mow'){if(s<0.1)continue;ctx.fillStyle='rgba(255,255,220,0.05)';for(let y=p.y;y<p.y+p.h;y+=40)ctx.fillRect(p.x,y,p.w,20)}
      else if(k==='rail'){ctx.strokeStyle='#7a7266';ctx.lineWidth=M.max(4,mpp*0.6);ctx.beginPath();ctx.moveTo(p.pts[0],p.pts[1]);ctx.lineTo(p.pts[2],p.pts[3]);ctx.stroke();
        if(s>1.5){ctx.strokeStyle='#444';ctx.lineWidth=0.18;const dx=p.pts[2]-p.pts[0],dy=p.pts[3]-p.pts[1],l=M.hypot(dx,dy),nx=-dy/l*0.72,ny=dx/l*0.72;ctx.beginPath();for(const sg of [-1,1]){ctx.moveTo(p.pts[0]+nx*sg,p.pts[1]+ny*sg);ctx.lineTo(p.pts[2]+nx*sg,p.pts[3]+ny*sg)}ctx.stroke()}}
      else if(k==='switch'){if(s<0.5)continue;ctx.strokeStyle='rgba(60,60,60,0.7)';ctx.lineWidth=0.3;ctx.beginPath();for(let x=p.x+5;x<p.x+p.w;x+=12){ctx.moveTo(x,p.y);ctx.lineTo(x,p.y+p.h)}for(let y=p.y+5;y<p.y+p.h;y+=18){ctx.moveTo(p.x,y);ctx.lineTo(p.x+p.w,y)}ctx.stroke();
        ctx.fillStyle='#8a8c90';for(let x=p.x+5;x<p.x+p.w;x+=12)for(let y=p.y+5;y<p.y+p.h;y+=18)ctx.fillRect(x-1.5,y-1.5,3,3)}
      else if(k==='lawn'){ctx.fillStyle=SEASON===2?'#e4e8ec':SEASON===1?'#8e9450':'#6f9a4c';ctx.fillRect(p.x,p.y,p.w,p.h);matRect(ctx,'grass',s,SEASON===2?0.15:0.7,p.x,p.y,p.w,p.h,0,0);if(s>1.2){ctx.fillStyle='rgba(255,255,230,0.07)';if(p.o===0)for(let x=p.x;x<p.x+p.w;x+=3)ctx.fillRect(x,p.y,1.5,p.h);else for(let y=p.y;y<p.y+p.h;y+=3)ctx.fillRect(p.x,y,p.w,1.5)}}
      else if(k==='pool'){ctx.fillStyle='#d8d6cc';ctx.fillRect(p.x-0.8,p.y-0.8,p.w+1.6,p.h+1.6);const gp=ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y+p.h);gp.addColorStop(0,'#3fb6d8');gp.addColorStop(1,'#7fdcef');if(SEASON>0){gp.addColorStop(0,SEASON===2?'#b8c4cc':'#4a7a8a');gp.addColorStop(1,SEASON===2?'#cdd6dc':'#5a8a96')}ctx.fillStyle=gp;ctx.fillRect(p.x,p.y,p.w,p.h);
        if(s>2){ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=0.12;ctx.beginPath();for(let q=1;q<4;q++){ctx.moveTo(p.x+p.w*q/4,p.y+0.5);ctx.bezierCurveTo(p.x+p.w*q/4+0.6,p.y+p.h*0.3,p.x+p.w*q/4-0.6,p.y+p.h*0.7,p.x+p.w*q/4,p.y+p.h-0.5)}ctx.stroke()}}
      else if(k==='helipad'){ctx.fillStyle='#4a4d52';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();ctx.strokeStyle='#e8e8e2';ctx.lineWidth=0.5;ctx.beginPath();ctx.arc(p.x,p.y,p.r*0.85,0,TAU);ctx.stroke();
        if(p.mil){ctx.fillStyle='#e8e8e2';const a=p.r*0.42,b=p.r*0.11;ctx.fillRect(p.x-a,p.y-a,b*1.6,2*a);ctx.fillRect(p.x+a-b*1.6,p.y-a,b*1.6,2*a);ctx.fillRect(p.x-a,p.y-b*0.8,2*a,b*1.6)}
        else{ctx.fillStyle='#d23a30';const a=p.r*0.55,b=p.r*0.18;ctx.fillRect(p.x-a,p.y-b,2*a,2*b);ctx.fillRect(p.x-b,p.y-a,2*b,2*a)}}
      else if(k==='field'){ctx.fillStyle=SEASON===2?'#e6eaee':SEASON===1?'#6e8a3c':'#4a8c3a';ctx.fillRect(p.x,p.y,p.w,p.h);matRect(ctx,'grass',s,SEASON===2?0.15:0.55,p.x,p.y,p.w,p.h,0,0);ctx.fillStyle='rgba(255,255,255,0.06)';for(let q=0;q<p.w;q+=p.w/8)ctx.fillRect(p.x+q,p.y,p.w/16,p.h);
        if(s>0.8){ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=0.14;ctx.strokeRect(p.x+2,p.y+2,p.w-4,p.h-4);ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y+2);ctx.lineTo(p.x+p.w/2,p.y+p.h-2);ctx.stroke();ctx.beginPath();ctx.arc(p.x+p.w/2,p.y+p.h/2,p.h*0.14,0,TAU);ctx.stroke();
          ctx.strokeRect(p.x+2,p.y+p.h*0.3,p.w*0.14,p.h*0.4);ctx.strokeRect(p.x+p.w-2-p.w*0.14,p.y+p.h*0.3,p.w*0.14,p.h*0.4)}}
      else if(k==='court'){ctx.fillStyle='#d8d6cc';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle=p.t?'#b8603c':'#3a6ea8';ctx.fillRect(p.x+1.5,p.y+1.5,p.w-3,p.h-3);ctx.fillStyle=p.t?'#c87050':'#4a8a4c';ctx.fillRect(p.x+3.5,p.y+5,p.w-7,p.h-10);
        if(s>1.5){ctx.strokeStyle='rgba(255,255,255,0.9)';ctx.lineWidth=0.08;ctx.strokeRect(p.x+3.5,p.y+5,p.w-7,p.h-10);ctx.beginPath();ctx.moveTo(p.x+3.5,p.y+p.h/2);ctx.lineTo(p.x+p.w-3.5,p.y+p.h/2);ctx.moveTo(p.x+p.w/2,p.y+11);ctx.lineTo(p.x+p.w/2,p.y+p.h-11);ctx.moveTo(p.x+3.5,p.y+11);ctx.lineTo(p.x+p.w-3.5,p.y+11);ctx.moveTo(p.x+3.5,p.y+p.h-11);ctx.lineTo(p.x+p.w-3.5,p.y+p.h-11);ctx.stroke()}}
      else if(k==='graves'){if(s<0.25){ctx.fillStyle='rgba(150,150,140,0.35)';ctx.fillRect(p.x,p.y,p.w,p.h);continue}const r=rng(p.seed);
        for(let y=p.y+1;y<p.y+p.h-2;y+=3.2)for(let x=p.x+0.5;x<p.x+p.w-1;x+=1.9){if(r()<0.15)continue;const v=r();ctx.fillStyle=v<0.5?'#9a9a96':v<0.8?'#d8d6d0':'#3c3c3e';ctx.fillRect(x,y,0.9,1.6);if(s>2&&r()<0.4){ctx.fillStyle='#c84a4a';ctx.fillRect(x+0.2,y+1.7,0.5,0.4)}}}
      else if(k==='quarry'){const r=rng(p.seed);const n=7;for(let i=0;i<n;i++){const f=1-i/n*0.92;const rx=p.rx*f,ry=p.ry*f;const ox=(r()-0.5)*p.rx*0.06*i,oy=(r()-0.5)*p.ry*0.06*i;
          const v=i%2?0.92:1.04,base=p.c?[p.c[0]*0.55+80-i*8,p.c[1]*0.55+70-i*8,p.c[2]*0.55+56-i*7]:[176-i*9,154-i*9,118-i*8];ctx.fillStyle='rgba(60,50,40,0.35)';ctx.beginPath();ctx.ellipse(p.x+ox+2.5,p.y+oy+2.5,rx,ry,0.15,0,TAU);ctx.fill();
          ctx.fillStyle=cs(base,v);ctx.beginPath();ctx.ellipse(p.x+ox,p.y+oy,rx,ry,0.15,0,TAU);ctx.fill();ctx.strokeStyle=cs(base,1.25);ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x+ox,p.y+oy,rx,ry,0.15,PI*0.9,PI*1.6);ctx.stroke()}
        ctx.fillStyle='#4e7a78';ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx*0.1,p.ry*0.08,0.15,0,TAU);ctx.fill();
        ctx.strokeStyle='rgba(210,196,160,0.9)';ctx.lineWidth=7;ctx.beginPath();for(let t=0;t<=1;t+=0.02){const f=1-t*0.85,a=t*TAU*1.6;const xx=p.x+M.cos(a)*p.rx*f,yy=p.y+M.sin(a)*p.ry*f;if(t===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)}ctx.stroke()}
      else if(k==='bund'){ctx.strokeStyle='#bab4a2';ctx.lineWidth=1.6;ctx.strokeRect(p.x,p.y,p.w,p.h)}
      else if(k==='logs'){if(s<0.3){ctx.fillStyle='#7a5a3a';ctx.fillRect(p.x,p.y,p.w,p.h);continue}const r=rng(p.seed);ctx.fillStyle='rgba(20,14,8,0.35)';ctx.fillRect(p.x+0.8,p.y+0.8,p.w,p.h);
        for(let y=p.y;y<p.y+p.h-0.6;y+=0.7){const c=[[128,92,58],[146,108,68],[112,80,50]][r()*3|0];ctx.fillStyle=cs(c,1);ctx.fillRect(p.x,y,p.w-r()*1.5,0.62);if(s>2){ctx.fillStyle='#d8b888';ctx.beginPath();ctx.arc(p.x+p.w-0.2,y+0.31,0.3,0,TAU);ctx.fill()}}}
      else if(k==='boards'){ctx.fillStyle='rgba(20,14,8,0.35)';ctx.fillRect(p.x+1.2,p.y+1,p.w,p.h);ctx.fillStyle='#c9a872';ctx.fillRect(p.x,p.y,p.w,p.h);if(s>1){ctx.fillStyle='rgba(90,60,30,0.5)';for(let x=p.x+1.2;x<p.x+p.w;x+=1.2)ctx.fillRect(x,p.y,0.12,p.h);ctx.fillStyle='rgba(60,40,20,0.6)';ctx.fillRect(p.x,p.y+p.h*0.33,p.w,0.25);ctx.fillRect(p.x,p.y+p.h*0.66,p.w,0.25)}}
      else if(k==='berm'){if(s<0.15)continue;const a0=p.a+PI*0.35,a1=p.a+PI*1.65;ctx.lineCap='round';ctx.strokeStyle='rgba(20,16,10,0.35)';ctx.lineWidth=p.r*0.55;ctx.beginPath();ctx.arc(p.x+1.2,p.y+1,p.r,a0,a1);ctx.stroke();
        ctx.strokeStyle=SEASON===2?'#d8dade':'#7c6a4c';ctx.lineWidth=p.r*0.5;ctx.beginPath();ctx.arc(p.x,p.y,p.r,a0,a1);ctx.stroke();ctx.strokeStyle=SEASON===2?'#eef0f2':'rgba(170,150,104,0.8)';ctx.lineWidth=p.r*0.14;ctx.beginPath();ctx.arc(p.x-0.4,p.y-0.4,p.r*0.92,a0,a1);ctx.stroke();ctx.lineCap='butt';
        ctx.fillStyle=SEASON===2?'#e2e4e6':'#8e8060';ctx.beginPath();ctx.arc(p.x,p.y,p.r*0.72,0,TAU);ctx.fill()}
    }else if(pass===1){
      if(k==='b'){if(s*M.max(p.w,p.h)<1.2)continue;bShadow(ctx,p)}
      else if(k==='cyl'){if(p.r*s<0.4)continue;const r=p.r*(p.st==='cool'?0.9:1),dx=SDX*p.H,dy=SDY*p.H;let n=0;for(let a=0;a<12;a++){const c=M.cos(a*PI/6)*r,sn=M.sin(a*PI/6)*r;HP[n++]=p.x+c;HP[n++]=p.y+sn;HP[n++]=p.x+dx+c;HP[n++]=p.y+dy+sn}hullFill(ctx,HP,24)}
      else if(k==='apse'){const dx=SDX*p.H,dy=SDY*p.H;ctx.moveTo(p.x,p.y-p.r);ctx.arc(p.x,p.y,p.r,-PI/2,PI/2);ctx.lineTo(p.x+dx,p.y+dy+p.r);ctx.arc(p.x+dx,p.y+dy,p.r,PI/2,-PI/2,true);ctx.closePath()}
      else if(k==='dome'){if(p.drum){const r=p.r*0.85,dx=SDX*p.H,dy=SDY*p.H;let n=0;for(let a=0;a<12;a++){const c=M.cos(a*PI/6)*r,sn=M.sin(a*PI/6)*r;HP[n++]=p.x+c;HP[n++]=p.y+sn;HP[n++]=p.x+dx+c*1.15;HP[n++]=p.y+dy+sn*1.15}hullFill(ctx,HP,24)}}
      else if(k==='crane2'){ctx.save();ctx.translate(p.x+SDX*p.H,p.y+SDY*p.H);ctx.rotate(p.a);ctx.rect(-p.len*0.3,-0.7,p.len*1.3,1.4);ctx.restore();ctx.rect(p.x,p.y-0.9,SDX*p.H,1.8)}
    }else{
      if(k==='b'){if(s*M.max(p.w,p.h)<0.5)continue;DEF.push(p)}
      else if(k==='cyl'){if(p.r*s<0.3)continue;DEF.push(p)}
      else if(k==='t'){if(p.d*s<1.6)continue;TREEQ.push(FOX+(p.x*FCA-p.y*FSA)*FS,FOY+(p.x*FSA+p.y*FCA)*FS,p.d*FS,p.v)}
      else if(k==='pk'){if(s<0.55)continue;drawParked(ctx,p,s)}
      else if(k==='play'){if(s<0.5)continue;playground(ctx,p,s)}
      else if(k==='plz'){if(s<0.35)continue;plaza(ctx,p,s)}
      else if(k==='bales'){if(s<0.6)continue;const r=rng(p.seed);for(let q=0;q<60;q++){const x=p.x+r()*p.w,y=p.y+r()*p.h;ctx.fillStyle='rgba(0,0,0,0.28)';ctx.beginPath();ctx.arc(x+0.7,y+0.55,0.9,0,TAU);ctx.fill();ctx.fillStyle=r()<0.5?'#d8c070':'#c8b062';ctx.beginPath();ctx.arc(x,y,0.9,0,TAU);ctx.fill()}}
      else if(k==='herd'){if(s<0.6)continue;const r=rng(p.seed),n=M.min(40,M.floor(p.w*p.h/30));for(let q=0;q<n;q++){const x=p.x+1.6+r()*(p.w-3.2),y=p.y+1.6+r()*(p.h-3.2),a=r()*TAU,ca=M.cos(a),sa=M.sin(a),t=r();
          ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(x+0.5,y+0.4,1.15,0.5,a,0,TAU);ctx.fill();ctx.fillStyle=t<0.45?'#6a4a32':t<0.75?'#e8e4dc':'#2a2624';ctx.beginPath();ctx.ellipse(x,y,1.1,0.48,a,0,TAU);ctx.fill();
          if(t>=0.45&&t<0.75){ctx.fillStyle='#2a2624';ctx.beginPath();ctx.arc(x-ca*0.2,y-sa*0.2,0.26,0,TAU);ctx.fill()}ctx.fillStyle='#3a2a20';ctx.beginPath();ctx.arc(x+ca*1.1,y+sa*1.1,0.32,0,TAU);ctx.fill()}}
      else if(k==='hedge'){if(s<0.7)continue;ctx.strokeStyle=SEASON===2?'#6a7a6a':SEASON===1?'#7a6a30':'#3e6a30';ctx.lineWidth=1.1;ctx.strokeRect(p.x,p.y,p.w,p.h)}
      else if(k==='fence'){if(s<1.0)continue;const t=hh(p.x*3|0,p.y*3|0,41)%4;const col=['rgba(110,84,60,0.85)','rgba(70,104,72,0.9)','rgba(150,150,150,0.7)','rgba(120,64,48,0.85)'][t];
        ctx.strokeStyle='rgba(14,18,28,0.25)';ctx.lineWidth=t===1||t===3?0.25:0.12;ctx.strokeRect(p.x+SDX*0.9,p.y+SDY*0.9,p.w,p.h);ctx.strokeStyle=col;ctx.strokeRect(p.x,p.y,p.w,p.h);
        if(s>3&&t!==1&&t!==3){ctx.fillStyle=t===2?'#6a6c70':'#5a4430';ctx.beginPath();for(const [ax,ay,bx,by] of [[p.x,p.y,p.x+p.w,p.y],[p.x+p.w,p.y,p.x+p.w,p.y+p.h],[p.x+p.w,p.y+p.h,p.x,p.y+p.h],[p.x,p.y+p.h,p.x,p.y]]){const L=M.hypot(bx-ax,by-ay);for(let q=0;q<L;q+=2.5){const X=ax+(bx-ax)*q/L,Y=ay+(by-ay)*q/L;ctx.rect(X-0.08,Y-0.08,0.16,0.16)}}ctx.fill()}}
      else if(k==='gh'){if(s<0.6)continue;const hor=p.w>p.h;ctx.fillStyle='rgba(14,18,28,0.22)';ctx.fillRect(p.x+SDX*1.6,p.y+SDY*1.6,p.w,p.h);
        const g=hor?ctx.createLinearGradient(p.x,p.y,p.x,p.y+p.h):ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y);g.addColorStop(0,'rgba(250,252,252,0.9)');g.addColorStop(0.4,'rgba(214,230,228,0.85)');g.addColorStop(1,'rgba(150,176,172,0.85)');ctx.fillStyle=g;ctx.fillRect(p.x,p.y,p.w,p.h);
        ctx.fillStyle='rgba(90,110,110,0.55)';if(hor)for(let x=p.x;x<=p.x+p.w;x+=1)ctx.fillRect(x,p.y,0.08,p.h);else for(let y=p.y;y<=p.y+p.h;y+=1)ctx.fillRect(p.x,y,p.w,0.08);
        if(s>2&&SEASON===0){ctx.fillStyle='rgba(70,120,50,0.35)';if(hor)ctx.fillRect(p.x+0.3,p.y+p.h*0.25,p.w-0.6,p.h*0.5);else ctx.fillRect(p.x+p.w*0.25,p.y+0.3,p.w*0.5,p.h-0.6)}}
      else if(k==='pile'){if(p.r*s<0.5)continue;const g=ctx.createRadialGradient(p.x-p.r*0.3,p.y-p.r*0.3,0,p.x,p.y,p.r);g.addColorStop(0,cs(p.c,1.3));g.addColorStop(1,cs(p.c,0.7));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,p.r,p.r*0.8,0.4,0,TAU);ctx.fill()}
      else if(k==='pipe'){ctx.lineCap='butt';ctx.lineWidth=p.w+1;ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.moveTo(p.pts[0]+1.5,p.pts[1]+1.5);ctx.lineTo(p.pts[2]+1.5,p.pts[3]+1.5);ctx.stroke();
        if(s<0.6){ctx.strokeStyle='#9a9890';ctx.lineWidth=p.w;ctx.beginPath();ctx.moveTo(p.pts[0],p.pts[1]);ctx.lineTo(p.pts[2],p.pts[3]);ctx.stroke()}
        else{const dx=p.pts[2]-p.pts[0],dy=p.pts[3]-p.pts[1],l=M.hypot(dx,dy),nx=-dy/l,ny=dx/l;const cols=['#c8c8c4','#a0a29e','#c9a43a','#b04a3a','#7c8a96','#d8d8d4','#8a7a60','#c0c0b8'];
          for(let q=0;q<p.n;q++){const o=(q-(p.n-1)/2)*(p.w/p.n);ctx.strokeStyle=cols[q%8];ctx.lineWidth=p.w/p.n*0.7;ctx.beginPath();ctx.moveTo(p.pts[0]+nx*o,p.pts[1]+ny*o);ctx.lineTo(p.pts[2]+nx*o,p.pts[3]+ny*o);ctx.stroke()}}}
      else if(k==='cont'){if(s<0.12){ctx.fillStyle='#8a6a5a';ctx.fillRect(p.x,p.y,p.w,p.h);continue}const r=rng(p.seed);const CC=[[180,60,48],[46,110,164],[224,160,48],[58,125,68],[136,136,136],[210,84,0],[220,220,220],[93,78,140],[150,40,40]];
        for(let y=p.y;y<p.y+p.h-12;y+=16){for(let x=p.x;x<p.x+p.w-2.4;x+=2.5){if(r()<0.1)continue;const c=CC[r()*9|0];const hgt=1+(r()*4|0);ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(x+hgt*0.6,y+hgt*0.5,2.4,12.2);ctx.fillStyle=cs(c,0.85+hgt*0.06);ctx.fillRect(x,y,2.4,12.2)}}}
      else if(k==='crane'){ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(p.x+12,p.y+10,p.len,4);ctx.fillRect(p.x+10,p.y+8,22,22);ctx.fillStyle=cs(p.c,1);ctx.fillRect(p.x-4,p.y,p.len,3.2);ctx.fillRect(p.x,p.y-2,3,24);ctx.fillRect(p.x+16,p.y-2,3,24);ctx.fillStyle=cs(p.c,0.7);ctx.fillRect(p.x+p.len*0.6,p.y-0.8,4,4.8)}
      else if(k==='crane2'||k==='dome'||k==='apse'){DEF.push(p)}
      else if(k==='ship'){if(s<0.08)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);drawShip(ctx,p.len,p.st,p.c);ctx.restore()}
      else if(k==='pjack'){if(s<0.3)continue;drawJack(ctx,p,s)}
      else if(k==='veh'){if(s<0.35)continue;drawVeh(ctx,p,s)}
      else if(k==='flag'){if(s<0.5)continue;drawFlagPole(ctx,p,s)}
      else if(k==='plane'){if(s<0.1)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.globalAlpha=0.3;ctx.fillStyle='#000';ctx.translate(2,2);drawPlane(ctx,p.s,p.c);ctx.translate(-2,-2);ctx.globalAlpha=1;drawPlane(ctx,p.s,p.c);ctx.restore()}
      else if(k==='pv'){if(s<0.3){ctx.fillStyle='#22304e';ctx.fillRect(p.x,p.y,p.w,p.h);continue}drawPV(ctx,p,s)}
      else if(k==='uav'){if(s<0.3)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);drawUav(ctx,p.v,p.c,s,1);ctx.restore()}
      else if(k==='cat'){if(s<0.25)continue;drawCat(ctx,p,s)}
      else if(k==='hframe'){if(s<0.2)continue;drawHead(ctx,p,s)}
      else if(k==='conv'){if(s<0.2)continue;drawConv(ctx,p,s)}
      else if(k==='wellhd'){if(s<0.4)continue;drawWell(ctx,p,s)}
      else if(k==='twall'){if(s<0.15)continue;const H=3.6;ctx.lineCap='butt';ctx.lineWidth=0.7;if(s>1.2)ctx.setLineDash([1.45,0.12]);
        ctx.strokeStyle='rgba(14,18,28,0.3)';ctx.strokeRect(p.x+SDX*H*0.5,p.y+SDY*H*0.5,p.w,p.h);ctx.strokeStyle='#a6a49c';ctx.strokeRect(p.x+LNX*H,p.y+LNY*H,p.w,p.h);
        ctx.strokeStyle='#c4c2ba';ctx.lineWidth=0.35;ctx.strokeRect(p.x+LNX*H-0.15,p.y+LNY*H-0.15,p.w,p.h);ctx.setLineDash([])}
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
  for(let rw=0;rw<rows;rw++){const L=hor?p.w:p.h;for(let a=0;a+2.6<=L;a+=2.6){if(r()>p.fill)continue;const spr=S.carLo[r()*S.carLo.length|0];const fl=r()<0.5;
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
// the median of a boulevard, interrupted at the crossings
function inGap(r,s,m){if(!r.xs)return false;for(const [c,g] of r.xs)if(M.abs(s-c)<g+m)return true;return false}
function medStroke(ctx,L){ctx.beginPath();for(const it of L){const r=it.r||it,a=it.r?it.a:0,b=it.r?it.b:r.L;let cur=a;
    for(const [c,g] of r.xs||[]){if(c+g<cur||c-g>b)continue;if(c-g>cur+0.5)offsetRange(ctx,r,0,cur,c-g);cur=M.max(cur,c+g)}if(cur<b-0.5)offsetRange(ctx,r,0,cur,b)}ctx.stroke()}
function strokeAll(ctx,L,off){ctx.beginPath();for(const it of L)PT(ctx,it,off);ctx.stroke()}
function strokeSym(ctx,L,offs){ctx.beginPath();for(const it of L)for(const o of offs){PT(ctx,it,o);PT(ctx,it,-o)}ctx.stroke()}
// pieces of an item outside the junction zones (and outside other exclusion lists such as r.inC)
function cutIv(a,b,X){if(!X)return [[a,b]];const out=[];let cur=a;for(const [c,d] of X){if(d<cur||c>b)continue;if(c>cur+0.3)out.push([cur,c]);cur=M.max(cur,d)}if(cur<b-0.3)out.push([cur,b]);return out}
function itIv(it){const r=it.r||it;return [r,it.r?it.a:0,it.r?it.b:r.L]}
function strokeAllM(ctx,L,off){ctx.beginPath();for(const it of L){const [r,a,b]=itIv(it);for(const [c,d] of cutIv(a,b,r.jz))offsetRange(ctx,r,off,c,d)}ctx.stroke()}
function strokeSymM(ctx,L,offs){ctx.beginPath();for(const it of L){const [r,a,b]=itIv(it);const P=cutIv(a,b,r.jz);for(const o of offs)for(const [c,d] of P){offsetRange(ctx,r,o,c,d);offsetRange(ctx,r,-o,c,d)}}ctx.stroke()}
// Roads are drawn in phases over all kinds: verges, then casings, then surfaces, then markings. So a road that meets
// another never paints its curb or lines across it: junctions read as one continuous surface.
function drawRoads(ctx,list,mpp,over){const s=1/mpp;
  const byK=[[],[],[],[],[],[],[],[],[]];for(const it of list){const r=it.r||it;if(r.k!==8)byK[r.k].push(it)}
  ctx.lineJoin='round';const KS=[];
  for(const k of ORDER){const L=byK[k];if(!L.length)continue;const w=RW[k];const px=w*s;let alpha=1,lw=w;if(px<RMIN[k]){alpha=M.max(0.25,M.pow(px/RMIN[k],0.45));lw=RMIN[k]*mpp}
    if(k===3&&mpp>22)continue;if((k===2||k===7)&&mpp>40)continue;if(k===4&&mpp>45)continue;if(k===6&&mpp>30)continue;KS.push({k,L,w,px,alpha,lw})}
  const cap=(k)=>over||k===0||k===1||k===2||k===7?'butt':'round';
  // railways first (everything else lies over them)
  for(const {k,L,w,px,alpha,lw} of KS){if(k!==5)continue;ctx.globalAlpha=alpha;ctx.lineCap='butt';ctx.strokeStyle=px>2?'#7c7466':'#5a5650';ctx.lineWidth=lw;strokeAll(ctx,L,0);
    if(s>1.4){ctx.strokeStyle='#5a4636';ctx.lineWidth=2.8;ctx.setLineDash([0.32,0.33]);strokeAll(ctx,L,0);ctx.setLineDash([]);ctx.strokeStyle='#9a9ca2';ctx.lineWidth=0.14;strokeSym(ctx,L,[0.72])}
    if(!over)for(const r of L)if(r.br&&px>1)bridgeDecks(ctx,r,w+3,s);ctx.globalAlpha=1}
  // phase 1: rural roads get a mown grass verge (hides field margins under the road); not inside towns, not on bridges
  if(!over)for(const {k,L,px,alpha,lw} of KS){if(px<=1.2||(k!==0&&k!==1&&k!==4))continue;const V=[];
    for(const it of L){const [r,a,b]=itIv(it);if(r.city!==undefined)continue;let X=r.inC||[];if(r.br)X=X.concat(r.br.map(q=>[q[0]-6,q[1]+6])).sort((p,q)=>p[0]-q[0]);for(const [c,d] of cutIv(a,b,X.length?X:null))V.push({r,a:c,b:d})}
    if(!V.length)continue;ctx.globalAlpha=alpha;ctx.lineCap=cap(k);ctx.strokeStyle=SEASON===2?'#d6dade':SEASON===1?'#8e8a52':'#6c8a4a';ctx.lineWidth=lw+(k===0?14:k===1?10:6);strokeAll(ctx,V,0);
    if(s>0.4){const P=matP(ctx,'grass',s,0,0,0);if(P){ctx.globalAlpha=alpha*(SEASON===2?0.2:0.6);ctx.strokeStyle=P;strokeAll(ctx,V,0)}}ctx.globalAlpha=1}
  // phase 2: casings / curbs and bridge decks
  for(const {k,L,w,px,alpha,lw} of KS){if(k===5)continue;ctx.globalAlpha=alpha;ctx.lineCap=cap(k);
    if(px>1.2){ctx.strokeStyle=SEASON===2&&k!==6?(k===4?'#c4c6c8':'#d2d6da'):k===0?'#8c8a84':k===1?'#9a968a':k===4?'#8a8070':k===6?'#8c8a84':'#a8a69e';ctx.lineWidth=lw+(k===0?2:k===4?1.5:1.2);strokeAll(ctx,L,0)}
    if(!over)for(const r of L)if(r.br&&px>0.8)bridgeDecks(ctx,r,w+4,s);ctx.globalAlpha=1}
  // phase 3: carriageways
  for(const {k,L,w,px,alpha,lw} of KS){if(k===5)continue;ctx.globalAlpha=alpha;ctx.lineCap=cap(k);
    const dirt=[],paved=[];if(k===4){for(const it of L)(isDirt(it.r||it)?dirt:paved).push(it)}
    const fc=px<2?(k===0?'#c0b8a8':k===1?'#aaa396':k===4?(SEASON===2?'#c8c8c4':'#a89c86'):SEASON===2?'#8a8c90':'#9a9890'):(k===0?'#56585c':k===1?'#5e6064':k===2?'#58595d':k===3?'#626366':k===6?'#5a5c60':k===7?'#5a5b5f':SEASON===2?'#b4b6b8':'#76726a');
    const tex=(m,wd,offs,LL)=>{if(s<0.4)return;for(let l=0;l<2;l++){const P=l?matP(ctx,m,s,0.73,13.1,7.7,2.618):matP(ctx,m,s,0,0,0);if(!P)continue;ctx.globalAlpha=alpha*(m==='asph'?0.4:0.45);ctx.strokeStyle=P;ctx.lineWidth=wd;if(offs)strokeSym(ctx,LL||L,offs);else strokeAll(ctx,LL||L,0)}ctx.globalAlpha=alpha};
    if(k===0&&px>4){ctx.strokeStyle='#8a8880';ctx.lineWidth=w;strokeAll(ctx,L,0);tex('conc',w);ctx.strokeStyle=fc;ctx.lineWidth=12;ctx.lineCap='butt';strokeSym(ctx,L,[7.6]);tex('asph',12,[7.6]);
      ctx.strokeStyle='#b8b6ae';ctx.lineWidth=0.8;strokeAllM(ctx,L,0)}
    else if(k===7&&px>4){ctx.strokeStyle=fc;ctx.lineWidth=w-1;strokeAll(ctx,L,0);tex('asph',w-1);ctx.strokeStyle='#b0aea6';ctx.lineWidth=6;medStroke(ctx,L);ctx.strokeStyle=SEASON===2?'#dde2e6':SEASON===1?'#8a8a46':'#628a48';ctx.lineWidth=5;medStroke(ctx,L);
      if(s>0.35&&!over){for(const r of L){const n=M.floor(r.L/9);for(let q=1;q<n;q++){if(inGap(r,q*9,4))continue;const p=posAt(r,q*9);TREEQ.push((p[0]-TX0)*s,(p[1]-TY0)*s,(6+((q*7+r.id)%3))*s,(q+r.id)%3===0?4:0)}}}}
    else if(k===4&&px>2){
      if(dirt.length){ctx.strokeStyle='#8c7a5c';ctx.lineWidth=lw;strokeAll(ctx,dirt,0);tex('soil',lw,null,dirt);if(s>0.9){const lc=ctx.lineCap;ctx.lineCap='butt';ctx.strokeStyle='rgba(70,56,40,0.45)';ctx.lineWidth=0.7;strokeSymM(ctx,dirt,[1.15]);ctx.strokeStyle='rgba(96,120,64,0.55)';ctx.lineWidth=0.6;strokeAllM(ctx,dirt,0);ctx.lineCap=lc}}
      if(paved.length){ctx.strokeStyle='#6c6a66';ctx.lineWidth=lw;strokeAll(ctx,paved,0);tex('asph',lw,null,paved)}}
    else{ctx.strokeStyle=fc;ctx.lineWidth=lw;strokeAll(ctx,L,0);if(px>3)tex('asph',lw)}
    ctx.globalAlpha=1}
  // phase 4: barriers, trams, tyre tracks and markings (left out inside junction zones)
  for(const {k,L,px,alpha} of KS){if(k===5)continue;ctx.globalAlpha=alpha;
    if(k===0&&px>3&&!over){const B=[];for(const it of L){const r=it.r||it;if(!r.urb)continue;for(const u of r.urb){const a=M.max(u[0],it.r?it.a:0),b=M.min(u[1],it.r?it.b:r.L);if(b-a>20)B.push({r,a,b})}}
      if(B.length){const o=RW[0]/2+2.2;ctx.lineCap='butt';ctx.save();ctx.translate(SUNX*3.5,SUNY*3.5);ctx.strokeStyle='rgba(12,16,26,0.3)';ctx.lineWidth=2.6;strokeSymM(ctx,B,[o]);ctx.restore();
        ctx.strokeStyle=SEASON===2?'#c8ccd0':'#7a8c80';ctx.lineWidth=0.5;strokeSymM(ctx,B,[o]);ctx.strokeStyle='rgba(200,220,215,0.6)';ctx.lineWidth=0.16;strokeSymM(ctx,B,[o-0.2]);
        if(s>2){ctx.strokeStyle='#4a4e52';ctx.lineWidth=0.7;ctx.setLineDash([0.25,3.75]);strokeSymM(ctx,B,[o]);ctx.setLineDash([])}}}
    if(k===2&&s>0.6){const T=L.filter(it=>(it.r||it).tram);if(T.length){ctx.lineCap='butt';ctx.strokeStyle='#76736c';ctx.lineWidth=3.1;strokeSym(ctx,T,[1.75]);if(s>1.3){ctx.strokeStyle='#a9abb0';ctx.lineWidth=0.12;strokeSym(ctx,T,[1.03,2.47])}}}
    if(s>0.7&&(k<=3||k===6||k===7)){ctx.lineCap='butt';ctx.strokeStyle='rgba(20,20,20,0.10)';ctx.lineWidth=0.7;const LO=k===0?[3.6,7.1,10.6]:k===2?[2.6,6.2]:k===1?[2.6]:k===6?[0]:k===7?[5.6,9.2]:[2.3];
      ctx.beginPath();for(const it of L){const [r,a,b]=itIv(it);const P=cutIv(a,b,r.jz);for(const o of LO)for(const [c,d] of P){offsetRange(ctx,r,o-0.85,c,d);offsetRange(ctx,r,o+0.85,c,d);if(o){offsetRange(ctx,r,-o-0.85,c,d);offsetRange(ctx,r,-o+0.85,c,d)}}}ctx.stroke()}
    if(s>0.9){ctx.lineCap='butt';ctx.strokeStyle='rgba(240,240,235,0.85)';ctx.lineWidth=0.16;
      if(k===0){strokeSymM(ctx,L,[1.9,13.3]);ctx.setLineDash([3,9]);strokeSymM(ctx,L,[5.4,8.9]);ctx.setLineDash([])}
      else if(k===2){strokeSymM(ctx,L,[0.25]);ctx.setLineDash([3,6]);strokeSymM(ctx,L,[4.3]);ctx.setLineDash([])}
      else if(k===7){strokeSymM(ctx,L,[13.6]);ctx.setLineDash([3,6]);strokeSymM(ctx,L,[7.4]);ctx.setLineDash([])}
      else if(k===6){strokeSymM(ctx,L,[3.4])}
      else if(k===1||k===3){ctx.setLineDash([3,5]);strokeAllM(ctx,L,0);ctx.setLineDash([]);if(k===1)strokeSymM(ctx,L,[4.6])}}
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
  const thin=clamp((lpx-2.2)/3,0.25,1);
  ctx.lineWidth=LL/fl*(glass?0.5:0.42)*M.min(step,2);ctx.setLineDash(DASH[(hs>>>20)&7]);
  for(let e=0;e<4;e++){const nx=NRM[e*2]*ca-NRM[e*2+1]*sa,ny=NRM[e*2]*sa+NRM[e*2+1]*ca;const dp=nx*lx+ny*ly;if(dp>=0)continue;
    const e1=(e+1)&3;const a0x=BC[e*2]+bx,a0y=BC[e*2+1]+by,a1x=BC[e1*2]+bx,a1y=BC[e1*2+1]+by;const el=M.hypot(a1x-a0x,a1y-a0y);if(el*s<3)continue;
    const ex=(a1x-a0x)/el,ey=(a1y-a0y)/el,ins=M.min(1.2,el*0.08);
    if(!H0&&!ind){const D=M.min(9,3+fl*0.35),g=ctx.createLinearGradient(a0x,a0y,a0x+nx*D,a0y+ny*D);g.addColorStop(0,la(col,0.05+fr*0.1));g.addColorStop(1,la(col,0));ctx.fillStyle=g;
      ctx.beginPath();ctx.moveTo(a0x,a0y);ctx.lineTo(a1x,a1y);ctx.lineTo(a1x+nx*D,a1y+ny*D);ctx.lineTo(a0x+nx*D,a0y+ny*D);ctx.closePath();ctx.fill()}
    if((p.gf||p.dk||p.gate!==undefined)&&!H0&&s>0.9){const U=gfUnits(p,e,el,s),dh=H,q=(u0,u1,z0,z1)=>{const t0=z0/dh,t1=z1/dh;ctx.beginPath();ctx.moveTo(a0x+ex*u0+dlx*t0,a0y+ey*u0+dly*t0);ctx.lineTo(a0x+ex*u1+dlx*t0,a0y+ey*u1+dly*t0);ctx.lineTo(a0x+ex*u1+dlx*t1,a0y+ey*u1+dly*t1);ctx.lineTo(a0x+ex*u0+dlx*t1,a0y+ey*u0+dly*t1);ctx.closePath();ctx.fill()};
      for(const u of U){const v=u[3],c=(u[1]+u[2])/2,gx=a0x+ex*c,gy=a0y+ey*c;LCNT++;
        if(u[0]===1){if((v>>>13)%5===0)continue;const fh=dh/fl,gt=M.min(fh*0.7,3.0),sc=SIGNC[v%8];ctx.fillStyle=la(LC.win,0.6);q(u[1]+0.25,u[2]-0.25,0.35,gt);
          ctx.fillStyle='rgba('+M.min(255,sc[0]+60)+','+M.min(255,sc[1]+60)+','+M.min(255,sc[2]+60)+',0.85)';q(u[1]+0.15,u[2]-0.15,gt+0.12,M.min(fh*0.96,gt+0.75));
          fdot(ctx,'win',gx+nx*1.6,gy+ny*1.6,M.min(9,u[2]-u[1]+2),0.32)}
        else if(u[0]===5){fdot(ctx,'sod',gx+nx*3.5,gy+ny*3.5,12,0.45);fdot(ctx,'sod',gx+LNX*6,gy+LNY*6,0.9,1)}
        else if(u[0]===4){fdot(ctx,'sod',gx+nx*3,gy+ny*3,9,0.45);fdot(ctx,'sod',gx+nx*0.3+LNX*5,gy+ny*0.3+LNY*5,0.8,1)}
        else if(u[0]===2){fdot(ctx,'warm',gx+nx*0.9,gy+ny*0.9,5,0.5);fdot(ctx,'warm',gx+nx*0.2+LNX*2.6,gy+ny*0.2+LNY*2.6,0.9,1)}
        else{ctx.fillStyle=la(LC.wled,0.5);q(M.max(0.3,u[1]-1.5),M.min(el-0.3,u[2]+1.5),0.1,M.min(dh/fl*0.92,4.2));fdot(ctx,'wled',gx+nx*2.5,gy+ny*2.5,12,0.45)}}}
    if(LL*s>3){ctx.fillStyle=la(col,(0.03+fr*0.06)*thin);ctx.beginPath();ctx.moveTo(a0x,a0y);ctx.lineTo(a1x,a1y);ctx.lineTo(a1x+dlx,a1y+dly);ctx.lineTo(a0x+dlx,a0y+dly);ctx.closePath();ctx.fill()}
    for(let f=0;f<fl;f+=step){const hr2=hh(hs,e,f);const on=((hr2&255)/255)<fr*(f>fl*0.8&&!glass?0.7:1);if(!on)continue;ctx.lineDashOffset=(hr2>>>8)&7;
      ctx.strokeStyle=la(col,(0.35+(((hr2>>>16)&255)/255)*0.45)*thin);const t=(f+0.58)/fl;ctx.beginPath();ctx.moveTo(a0x+ex*ins+dlx*t,a0y+ey*ins+dly*t);ctx.lineTo(a1x-ex*ins+dlx*t,a1y-ey*ins+dly*t);ctx.stroke()}}
  ctx.setLineDash([]);ctx.lineDashOffset=0;
  if(H>95)fdot(ctx,'red',cx+lx,cy+ly,5,1);
  if(ind&&lit>0.45)fdot(ctx,'sod',p.x+(((hs>>>12)&1)?0:p.w),p.y+p.h+5,30,0.5);
  return true}
function drawLightPrims(ctx,P,mpp,ind){const s=1/mpp;
  for(let q=0;q<P.length;q++){const p=P[q],k=p.k;
    if(k==='b'){
      if(p.r==='glh'){LCNT++;ctx.fillStyle=la(LC.sod,0.22);ctx.fillRect(p.x,p.y,p.w,p.h);continue}
      if(p.cnp){LCNT++;ctx.strokeStyle=la(LC.led,0.4);ctx.lineWidth=M.max(0.6,LMPP*0.8);ctx.strokeRect(p.x,p.y,p.w,p.h);ctx.fillStyle=la(LC.led,0.06);ctx.fillRect(p.x,p.y,p.w,p.h);
        for(const [u,v] of [[0,0],[1,0],[0,1],[1,1],[0.5,-0.15],[0.5,1.15]])fdot(ctx,'led',p.x+p.w*u,p.y+p.h*v,M.min(p.w,p.h)*0.9,0.16);continue}
      if(p.nd)continue;const hs=hh(p.x*10|0,p.y*10|0,77),lit=(hs&255)/255;
      if(p.r!=='g'&&p.r!=='h'&&facadeLights(ctx,p,s,hs,lit,ind))continue;
      if(p.r==='g'||p.r==='h'){if(lit<0.3)continue;fdot(ctx,'win',p.x+p.w*(((hs>>>8)&255)/255*0.6+0.2),p.y+p.h*(((hs>>>16)&255)/255*0.6+0.2),6,0.85);
        if(lit>0.72)fdot(ctx,'warm',p.x+p.w/2,p.y+p.h+1.5,7,0.6);continue}
      const big=M.max(p.w,p.h);if(big*s<1.2){fdot(ctx,lit>0.5?'win':'warm',p.x+p.w/2,p.y+p.h/2,big*1.3,(0.45+lit*0.4)*(ind?0.5:1));continue}
      if(ind&&ZLITE)continue;
      {const fr=ind?0.2:0.25+0.65*(((hs>>>8)&255)/255);const n=M.min(24,M.max(1,M.round(p.w*p.h/70*fr)));const r=rng(hs);const hm=M.min(1,(p.H||10)/40),cl=p.r==='gl'?'cool':lit>0.55?'win':'warm';
        for(let q=0;q<n;q++){const t=r(),u=r()*0.9+0.05,v=r()*0.9+0.05;fdot(ctx,cl,p.x+p.w*u+LNX*(p.H||0)*t*hm,p.y+p.h*v+LNY*(p.H||0)*t*hm,M.max(3,M.min(8,M.sqrt(p.w*p.h)*0.28)),0.55+0.45*r())}}
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
    else if(k==='rw2'){for(let x=p.x;x<=p.x+p.w+0.1;x+=30){fdot(ctx,'led',x,p.y-1.2,5,0.9);fdot(ctx,'led',x,p.y+p.h+1.2,5,0.9)}for(let q=0;q<6;q++){const yy=p.y+1.5+q*(p.h-3)/5;fdot(ctx,'grn',p.x,yy,4,1);fdot(ctx,'red',p.x+p.w,yy,4,1)}}
    else if(k==='ltaxi'){for(let x=p.x;x<=p.x+p.w;x+=40){fdot(ctx,'blu',x,p.y,5,0.9);fdot(ctx,'blu',x,p.y+p.h,5,0.9);fdot(ctx,'grn',x+20,p.y+p.h/2,3,0.6)}}
    else if(k==='cyl'){if(p.st==='tower'){for(let a=0;a<4;a++)fdot(ctx,'sod',p.x+M.cos(a*1.57+0.4)*(p.r+1.2),p.y+M.sin(a*1.57+0.4)*(p.r+1.2),2.4,1);fdot(ctx,'sod',p.x,p.y,p.r*5+8,0.35)}
      else if(p.st==='sphere')fdot(ctx,'sod',p.x,p.y,p.r*2.6,0.3);else if(p.st==='chim'&&p.H>80)fdot(ctx,'red',p.x+LNX*p.H,p.y+LNY*p.H,4,1);else if(p.st==='cool'){fdot(ctx,'red',p.x+LNX*p.H+p.r*0.7,p.y+LNY*p.H,4,1);fdot(ctx,'red',p.x+LNX*p.H-p.r*0.7,p.y+LNY*p.H,4,1)}else if(p.st==='gtow'){fdot(ctx,'cool',p.x+LNX*p.H*0.5,p.y+LNY*p.H*0.5,p.r*3,0.35);fdot(ctx,'red',p.x+LNX*p.H,p.y+LNY*p.H,5,1)}}
    else if(k==='pipe'&&!p.gr){const dx=p.pts[2]-p.pts[0],dy=p.pts[3]-p.pts[1],l=M.hypot(dx,dy);for(let a=6;a<l;a+=16)fdot(ctx,'sod',p.pts[0]+dx*a/l,p.pts[1]+dy*a/l,11,0.5)}
    else if(k==='gl'){const big=p.w>6,sp=big?36:24;for(let i=0;i<p.pts.length-2;i+=2){const ax=p.pts[i],ay=p.pts[i+1],dx=p.pts[i+2]-ax,dy=p.pts[i+3]-ay,l=M.hypot(dx,dy);
        for(let a=sp/2;a<l;a+=sp)fdot(ctx,big?'sod':'warm',ax+dx*a/l,ay+dy*a/l,big?18:9,big?0.6:0.55)}}
    else if(k==='lflood'){for(let y=p.y+p.sp/2;y<p.y+p.h;y+=p.sp)for(let x=p.x+p.sp/2;x<p.x+p.w;x+=p.sp){fdot(ctx,p.c,x,y,p.r*2,0.38);fdot(ctx,p.c,x,y,2.5,1)}}
  }}
const LAMP=[[[0],48,26,'sod',0.75],[[6.8],55,19,'sod',0.7],[[10.8,-10.8],32,16,'wled',0.6],[[5.6,-5.6],38,13,'sod',0.55],[[3.6],80,11,'warm',0.5],null,[[0],40,16,'sod',0.6],[[12.8,-12.8],30,16,'wled',0.62],null];
// street lighting. All of it is drawn as opaque light intensity on black into its own layer G, where light from
// different roads and lamps combines by maximum ('lighten'), so a crossing is no brighter than the street and pools do
// not stack up; the glow along a road is a feathered band (three nested strokes), not a flat strip with hard edges.
// G is then turned back into premultiplied light (alpha = brightest channel) and added to the tile.
let LG_=null,LT_=null;const POOLO={};
function poolO(c,a){const key=c+a;let q=POOLO[key];if(q)return q;q=POOLO[key]=mkCanvas(64,64);const x=q.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,64,64);x.globalAlpha=a;x.drawImage(pools()[c],0,0);return q}
function fdotO(g,c,x,y,d,a){LCNT++;const px=d*LS;if(px>=1.6){g.drawImage(poolO(c,a),x-d/2,y-d/2,d,d);return}
  const q=1.3*LMPP,k=M.min(1,a*0.32*(px/1.3)*(px/1.3)+0.02*a),cc=LC[c].split(',');g.fillStyle=`rgb(${cc[0]*k|0},${cc[1]*k|0},${cc[2]*k|0})`;g.fillRect(x-q/2,y-q/2,q,q)}
function lightRoads(ctx,list,mpp,bx0,by0,bx1,by1){const s=1/mpp,W=ctx.canvas.width,H=ctx.canvas.height,tf=ctx.getTransform();
  const byK=[[],[],[],[],[],[],[],[],[]];for(const r of list)if(byK[r.k])byK[r.k].push(r);let any=false;
  for(const k of [4,3,6,2,7,1,0])if(byK[k].length&&LAMP[k])any=true;if(!any)return;
  if(!LG_||LG_.width!==W||LG_.height!==H){LG_=mkCanvas(W,H);LT_=mkCanvas(W,H)}
  const g=LG_.getContext('2d'),t=LT_.getContext('2d');const blank=(c)=>{c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#000';c.fillRect(0,0,W,H);c.setTransform(tf)};
  blank(g);g.globalCompositeOperation='lighten';t.lineCap='round';t.lineJoin='round';any=false;
  const band=(L,col,a,w0)=>{blank(t);t.globalCompositeOperation='lighter';
    for(const [f,q] of [[1.7,0.26],[1.25,0.32],[0.85,0.42]]){t.strokeStyle=la(LC[col],a*q);t.lineWidth=w0*f;t.beginPath();for(const r of L)offsetPath(t,r,0);t.stroke()}
    g.setTransform(1,0,0,1,0,0);g.drawImage(LT_,0,0);g.setTransform(tf)};
  for(const k of [4,3,6,2,7,1,0]){const L=byK[k];if(!L.length||!LAMP[k])continue;if((k===3&&mpp>70)||((k===2||k===7)&&mpp>130)||(k===4&&mpp>45)||(k===6&&mpp>30))continue;
    const [offs,sp,D,col,a]=LAMP[k];LCNT+=L.length;any=true;
    if(D*s>2.4){band(L,col,0.07,RW[k]*1.15);
      for(const r of L){if(r.bb[2]<bx0-D||r.bb[0]>bx1+D||r.bb[3]<by0-D||r.bb[1]>by1+D)continue;const ph=hr(r.id,3,3)*sp;
        for(let oi=0;oi<offs.length;oi++){const off=offs[oi];for(let q=ph+oi*sp/2;q<r.L;q+=sp){const p=posAt(r,q);const x=p[0]-p[3]*off,y=p[1]+p[2]*off;
          if(x<bx0-D||x>bx1+D||y<by0-D||y>by1+D)continue;fdotO(g,col,x,y,D,a);fdotO(g,col,x,y,D*0.12,1)}}}}
    else{const w=M.max(D*0.8,mpp*1.15);const aa=a*0.4*M.min(1,D*0.8/w)*(k===0?1.3:k===3?0.8:k===7?1.1:1)*(k===3?1.7-smooth(22,70,mpp)*1.1:(k===2||k===7)?1-smooth(40,130,mpp)*0.5:1);band(L,col,M.min(1,aa),w)}}
  if(!any)return;
  g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';const im=g.getImageData(0,0,W,H),d=im.data;
  for(let i=0;i<d.length;i+=4){const m=d[i]>d[i+1]?(d[i]>d[i+2]?d[i]:d[i+2]):(d[i+1]>d[i+2]?d[i+1]:d[i+2]);if(m<1){d[i+3]=0;continue}const f=255/m;d[i]=d[i]*f;d[i+1]=d[i+1]*f;d[i+2]=d[i+2]*f;d[i+3]=m}
  g.putImageData(im,0,0);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='lighter';ctx.drawImage(LG_,0,0);ctx.restore()}
const BLA=[0,0.95,0.7,0.62,0.3,0.06,0.9,0.3,0.12,0.55,0.45,0.25,0.8,0.3,0.7,0.5,0.55,0.45,0.3,0.85,0.02,0.7,0.66,0.4];
const ZLA={ref:0.42,port:0.36,ind:0.2,air:0.16,pow:0.26,solar:0,gas:0.55,stn:0.42,agro:0.5,farm:0.08,dacha:0.1,quarry:0.05,cem:0};
const ZFL={gas:[22,16,'led',0.28],stn:[40,22,'wled',0.42],farm:[90,14,'warm',0.4],quarry:[150,34,'sod',0.32],dacha:[70,10,'warm',0.3]};
function lightFeat(ctx,f,x0,y0,s,mpp,qx0,qy0,qx1,qy1){
  if(f.kind==='city'){
    if(f.type===0){if(mpp>9){ctx.setTransform(s,0,0,s,-x0*s,-y0*s);fdot(ctx,'warm',f.x,f.y,f.R*1.5,M.min(0.35,0.1+mpp*0.002))}
      for(let i=0;i<f.vst.length;i++){const st=f.vst[i];setFrame(ctx,st.x0,st.y0,st.ca,st.sa,x0,y0,s);
        if(mpp>9){const R=rng(hh(f.id,i,72));for(let a=12;a<st.L-12;a+=30){for(const sd of [-1,1]){if(R()<0.35)continue;fdot(ctx,'win',a,sd*12,8,0.7)}if(R()<0.4)fdot(ctx,'warm',a,0,11,0.45)}continue}
        const vk='v'+f.id+'_'+i+(LITE2?'b':LITE?'a':'')+(GROW.has(f.id)?'g'+GROW.get(f.id).toFixed(2):'');let P=bcGet(vk);if(!P){P=genVillage(f,i);bcSet(vk,P)}drawLightPrims(ctx,P,mpp,false);
        for(let a=20;a<st.L;a+=80)fdot(ctx,'warm',a,4,11,0.5)}return}
    const BD=f.D-1;const [i0,i1,j0,j1]=blkRange(f,qx0,qy0,qx1,qy1);
    const bi0=M.max(0,bsr(f.us,i0)-(f.msi||0)),bi1=M.min(BD-1,bsr(f.us,i1)),bj0=M.max(0,bsr(f.vs,j0)-(f.msj||0)),bj1=M.min(BD-1,bsr(f.vs,j1));
    for(let bj=bj0;bj<=bj1;bj++)for(let bi=bi0;bi<=bi1;bi++){const t=growT(f,bi,bj,f.blocks[bj*BD+bi]);if(!t)continue;
      const bf=blkFrame(f,bi,bj);setFrame(ctx,bf[0],bf[1],bf[2],bf[3],x0,y0,s);
      if(mpp>14){const bw=bf[4]*2,bh=bf[5]*2;const a=BLA[t]*(0.7+hr(f.id,bi*999+bj,8)*0.6);const R=rng(hh(f.id,bi*999+bj,8));
        const sp=M.max(16,mpp*1.2),cl=t===1||t===6||t===12?'win':t===4||t===13?'warm':'sod';
        for(let y=-bh/2+12;y<bh/2-8;y+=sp)for(let x=-bw/2+12;x<bw/2-8;x+=sp){if(R()>a)continue;fdot(ctx,R()<0.25?'wled':cl,x+(R()-0.5)*sp*0.8,y+(R()-0.5)*sp*0.8,sp*(0.45+R()*0.5),0.6+R()*0.4)}continue}
      const key=(f.id*1e6+bj*1000+bi)*3+(LITE2?2:LITE?1:0)+(t!==f.blocks[bj*BD+bi]?0.5:0);let P=bcGet(key);if(!P){P=genBlock(f,bi,bj,t);bcSet(key,P)}drawLightPrims(ctx,P,mpp,false)}
    return}
  if(f.kind==='zone'){setFrame(ctx,f.x,f.y,f.ca,f.sa,x0,y0,s);
    if(mpp>14){const a=ZLA[f.zk];if(a>0){const R=rng(f.seed^0x1a);const sp=M.max(70,mpp*2.2);for(let y=-f.H/2+sp/2;y<f.H/2;y+=sp)for(let x=-f.W/2+sp/2;x<f.W/2;x+=sp){if(R()<0.35)continue;fdot(ctx,R()<0.12?'wled':'sod',x+(R()-0.5)*sp*0.6,y+(R()-0.5)*sp*0.6,sp*0.9,a*(0.8+R()*1.4))}}
      if(f.zk==='air'){ctx.fillStyle=la(LC.led,0.4);ctx.fillRect(-1650,-30,3300,60);ctx.fillStyle=la(LC.sod,0.12);ctx.fillRect(-1000,-560,1500,350)}return}
    const zf=ZFL[f.zk];if(zf){const [sp,r,c,a]=zf;for(let y=-f.H/2+sp/2;y<f.H/2;y+=sp)for(let x=-f.W/2+sp/2;x<f.W/2;x+=sp){if(hh(x|0,y|0,f.id)%3===0&&f.zk!=='gas')continue;fdot(ctx,c,x,y,r*2,a);fdot(ctx,c,x,y,2,0.9)}}
    ZLITE=!!f.dyn;drawLightPrims(ctx,f.prims,mpp,f.zk!=='air'&&f.zk!=='dacha');ZLITE=false}}
function renderLights(z,tx,ty,hb){
  const PAD=hb?32:0,CS=TS+2*PAD;
  const tsz=WORLD/(1<<z),mpp=tsz/TS,x0=tx*tsz-PAD*mpp,y0=ty*tsz-PAD*mpp,s=1/mpp;pools();LS=s;LMPP=mpp;LCNT=0;
  const cv=mkCanvas(CS,CS),ctx=cv.getContext('2d');ctx.globalCompositeOperation='lighter';
  const ext=tsz+2*PAD*mpp;const mg=mpp<6?300:mpp*45;const qx0=x0-mg,qy0=y0-mg,qx1=x0+ext+mg,qy1=y0+ext+mg;
  let feats=queryF(qx0,qy0,qx1,qy1),rl=queryRoads(x0-mpp*20-60,y0-mpp*20-60,x0+ext+mpp*20+60,y0+ext+mpp*20+60);
  if(DEADN||HID.size){feats=feats.filter(f=>!f.dead&&!(f.kind==='zone'&&zHid(f)));rl=rl.filter(r=>!r.dead&&!rHid(r))}if(GROW.size){feats=feats.filter(featOn);rl=growRoads(rl,true)}
  blockCache=new Map();mppG=mpp;LITE=mpp>2.2;LITE2=mpp>4.5;
  ctx.setTransform(s,0,0,s,-x0*s,-y0*s);lightRoads(ctx,rl,mpp,x0-40,y0-40,x0+ext+40,y0+ext+40);
  for(const f of feats){if(f.kind==='city'||f.kind==='zone')lightFeat(ctx,f,x0,y0,s,mpp,qx0,qy0,qx1,qy1)}
  blockCache=null;if(!LCNT)return null;if(!hb)return cv;
  // bloom variant: successive 2x box downsampling, then smooth upscale
  // padded canvas → light from neighbouring tiles bleeds in, no seams at tile edges
  let src=cv,sz=CS;for(let i=0;i<hb;i++){sz>>=1;const c2=mkCanvas(sz,sz),x2=c2.getContext('2d');x2.imageSmoothingQuality='high';x2.drawImage(src,0,0,sz,sz);src=c2}
  const out=mkCanvas(TS,TS),xo=out.getContext('2d');xo.imageSmoothingQuality='high';const f=sz/CS;xo.drawImage(src,PAD*f,PAD*f,TS*f,TS*f,0,0,TS,TS);return out}


// ---------------------------------------------------------------- deposits on the ground (stage 5.6)
// oil 0, gas 1, coal 2, iron 3, copper 4, gold 5, uranium 6, lithium 7 (the game's order)
let DEADN=0,ZLITE=false;const DEPS=[];
function addDeposits(L){for(const [k,x,y,r] of L){const f={kind:'dep',k,x,y,r:r||260,seed:hh(x|0,y|0,4411)};f.bb=[x-f.r*1.3,y-f.r*1.3,x+f.r*1.3,y+f.r*1.3];DEPS.push(f);addF(f,f.bb[0],f.bb[1],f.bb[2],f.bb[3])}return DEPS.length}
const DEPC=[[44,38,32],[164,160,138],[44,44,46],[148,74,46],[92,138,116],[176,156,114],[164,168,98],[232,230,222]];
function depBlob(ctx,f,k,ph){ctx.beginPath();for(let i=0;i<56;i++){const a=i/56*TAU,cx=M.cos(a),sy=M.sin(a);
    const rr=f.r*k*(0.74+0.28*noise(cx*1.3+f.seed%97+ph,sy*1.3+(f.seed>>8)%89)+0.1*noise(cx*4.1+ph*3,sy*4.1+(f.seed>>12)%71));const x=f.x+cx*rr,y=f.y+sy*rr;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.closePath()}
function rock(ctx,R,x,y,r,c,s){const n=5+(R()*3|0),pts=[];for(let i=0;i<n;i++){const a=i/n*TAU+R()*0.5,rr=r*(0.65+R()*0.45);pts.push(x+M.cos(a)*rr,y+M.sin(a)*rr*0.85)}
  const path=(dx,dy)=>{ctx.beginPath();for(let i=0;i<pts.length;i+=2){if(i)ctx.lineTo(pts[i]+dx,pts[i+1]+dy);else ctx.moveTo(pts[i]+dx,pts[i+1]+dy)}ctx.closePath()};
  path(r*0.35,r*0.28);ctx.fillStyle='rgba(10,12,16,0.32)';ctx.fill();path(0,0);ctx.fillStyle=cs(c,0.82+R()*0.3);ctx.fill();
  if(r*s>1.5){ctx.save();ctx.clip();ctx.fillStyle='rgba(255,255,240,0.2)';ctx.beginPath();ctx.ellipse(x-r*0.35,y-r*0.3,r*0.7,r*0.45,-0.6,0,TAU);ctx.fill();ctx.fillStyle='rgba(0,0,0,0.18)';ctx.beginPath();ctx.ellipse(x+r*0.45,y+r*0.4,r*0.8,r*0.5,-0.6,0,TAU);ctx.fill();ctx.restore()}}
function drawDeps(ctx,L,mpp){const s=1/mpp;
  for(const f of L){if(f.dead)continue;const c=DEPC[f.k],R=rng(f.seed),win=SEASON===2,wk=win?0.45:1;
    // stained ground with a soft edge: a ragged blob filled with a radial falloff, a second darker core
    for(const [k,a,ph] of [[1.08,0.55,0],[0.7,0.6,3.7]]){depBlob(ctx,f,k,ph);const g=ctx.createRadialGradient(f.x,f.y,f.r*k*0.15,f.x,f.y,f.r*k*1.05);
      g.addColorStop(0,`rgba(${c[0]},${c[1]},${c[2]},${a*wk})`);g.addColorStop(0.7,`rgba(${c[0]},${c[1]},${c[2]},${a*0.75*wk})`);g.addColorStop(1,`rgba(${c[0]},${c[1]},${c[2]},0)`);ctx.fillStyle=g;ctx.fill()}
    if(s<0.08)continue;
    // grit: small light and dark specks across the stain
    if(s>0.25){const n=M.min(900,f.r*f.r*0.012);for(let q=0;q<n;q++){const a=R()*TAU,d=M.sqrt(R())*f.r*0.85,x=f.x+M.cos(a)*d,y=f.y+M.sin(a)*d,v=R();ctx.fillStyle=v<0.5?`rgba(0,0,0,${0.12+v*0.2})`:`rgba(255,255,240,${(v-0.5)*0.35})`;ctx.fillRect(x,y,1.2+R()*2,1.2+R()*2)}}
    switch(f.k){
    case 0: // oil seeps: tar-black pools with an oily sheen, dark runnels between them
      ctx.strokeStyle='rgba(20,18,16,0.55)';ctx.lineWidth=M.max(0.8,2.2*mpp);ctx.beginPath();for(let q=0;q<6;q++){const a=R()*TAU,d=R()*f.r*0.5;let x=f.x+M.cos(a)*d,y=f.y+M.sin(a)*d;ctx.moveTo(x,y);for(let t=0;t<5;t++){x+=(R()-0.5)*50;y+=(R()-0.5)*50;ctx.lineTo(x,y)}}ctx.stroke();
      for(let q=0;q<12;q++){const a=R()*TAU,d=R()*f.r*0.6,x=f.x+M.cos(a)*d,y=f.y+M.sin(a)*d,rx=5+R()*16,ry=rx*(0.5+R()*0.4),an=R()*PI;
        ctx.fillStyle='rgba(14,12,10,0.9)';ctx.beginPath();ctx.ellipse(x,y,rx,ry,an,0,TAU);ctx.fill();if(s>0.4){const g=ctx.createLinearGradient(x-rx,y-ry,x+rx,y+ry);g.addColorStop(0,'rgba(90,120,170,0.35)');g.addColorStop(0.5,'rgba(170,90,160,0.25)');g.addColorStop(1,'rgba(60,160,120,0.2)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x-rx*0.15,y-ry*0.2,rx*0.55,ry*0.45,an,0,TAU);ctx.fill()}}break;
    case 1: // gas: bleached ground, grey-blue pools with bubbles
      for(let q=0;q<16;q++){const a=R()*TAU,d=R()*f.r*0.65,x=f.x+M.cos(a)*d,y=f.y+M.sin(a)*d,r=3+R()*9;ctx.fillStyle='rgba(206,200,176,0.6)';ctx.beginPath();ctx.arc(x,y,r*1.5,0,TAU);ctx.fill();ctx.fillStyle='rgba(68,94,104,0.85)';ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
        if(s>0.5){ctx.strokeStyle='rgba(230,238,240,0.7)';ctx.lineWidth=0.25;for(let b=0;b<4;b++){ctx.beginPath();ctx.arc(x+(R()-0.5)*r,y+(R()-0.5)*r,0.5+R()*1.2,0,TAU);ctx.stroke()}}}break;
    case 7: // lithium: a salt crust broken into polygons
      if(s>0.15){ctx.strokeStyle='rgba(150,146,136,0.75)';ctx.lineWidth=M.max(0.4,0.9*mpp);ctx.beginPath();const st=26;for(let gy=-f.r;gy<f.r;gy+=st)for(let gx=-f.r;gx<f.r;gx+=st){if(gx*gx+gy*gy>f.r*f.r*0.45)continue;
        const jx=f.x+gx+(R()-0.5)*st*0.7,jy=f.y+gy+(R()-0.5)*st*0.7;ctx.moveTo(jx,jy);ctx.lineTo(jx+st*(0.7+R()*0.5),jy+(R()-0.5)*st*0.6);ctx.moveTo(jx,jy);ctx.lineTo(jx+(R()-0.5)*st*0.6,jy+st*(0.7+R()*0.5))}ctx.stroke()}break;
    default: // outcrops of coal / iron / copper / gold / uranium ore: angular boulders lit from the sun, scree, ore veins
      {const n=M.round(f.r*f.r/1400);for(let q=0;q<n;q++){const a=R()*TAU,d=M.sqrt(R())*f.r*0.72,x=f.x+M.cos(a)*d,y=f.y+M.sin(a)*d,r=1.5+R()*R()*13;rock(ctx,R,x,y,r,c,s)}}
      if(f.k>=4){ctx.strokeStyle=f.k===5?'rgba(244,232,196,0.85)':f.k===6?'rgba(212,226,70,0.75)':'rgba(70,170,150,0.7)';ctx.lineWidth=M.max(0.5,1.5*mpp);ctx.beginPath();
        for(let q=0;q<7;q++){const a=R()*TAU,d=R()*f.r*0.5,x=f.x+M.cos(a)*d,y=f.y+M.sin(a)*d,b=R()*TAU;ctx.moveTo(x,y);ctx.quadraticCurveTo(x+M.cos(b)*30,y+M.sin(b)*30,x+M.cos(b+0.5)*75,y+M.sin(b+0.5)*75)}ctx.stroke()}
    }}}
function removeZone(id){const z=zones[id];if(!z||z.dead)return -1;z.dead=1;DEADN++;if(z.acc)z.acc.dead=1;if(z.link)z.link.dead=1;for(const e of emitters)if(e.zid===id)e.dead=1;return id}
function removeDeposit(i){const f=DEPS[i];if(f)f.dead=1;return i}
// ---------------------------------------------------------------- tile

// ---------------------------------------------------------------- growth of the capitals (stage 5)
// g in (0,1): blocks with cityF < g are built, a band of g..g+0.1 is under construction, the rest is still empty land.
// Streets are laid a little ahead of the houses; the town's zones and their access roads appear when it is nearly complete.
const GROW=new Map();
function setGrow(id,g){if(g>=1)GROW.delete(id);else GROW.set(id,M.max(0.05,g))}
function blkF(f,bi,bj){const BD=f.D-1;let a=f._bf;if(!a){a=f._bf=new Float32Array(BD*BD);for(let j=0;j<BD;j++)for(let i=0;i<BD;i++){const u=(f.us[i]+f.us[i+1])/2,v=(f.vs[j]+f.vs[j+1])/2;if(f.cv||f.sp){const q=blkFrame(f,i,j);a[j*BD+i]=cityF(f,q[0],q[1])}else a[j*BD+i]=cityF(f,f.x+u*f.ca-v*f.sa,f.y+u*f.sa+v*f.ca)}}return a[bj*BD+bi]}
function growT(f,bi,bj,t){if(!t||!GROW.size||t===21)return t;const g=GROW.get(f.id);if(g===undefined)return t;const d=blkF(f,bi,bj);return d>g+0.1?0:d>g?11:t}
function growFields(c){const g=GROW.get(c.id);return g===undefined?1:M.min(1,g*1.4)}
function growShift(c){const g=GROW.get(c.id);return g===undefined?0:1-M.min(1,g+0.1)}
function featOn(f){if(f.dead)return false;if(f.kind==='zone'&&zHid(f))return false;if(f.kind!=='zone'||!f.city||f.dyn)return true;const g=GROW.get(f.city.id);return g===undefined||g>=0.95}
// visible intervals of a town street: sampled every 25 m (cached per growth value)
function streetIv(r,g){if(r._gv===g)return r._gi;if(r.k===2||r.k===7){r._gv=g;r._gi=[[0,r.L]];return r._gi}const c=cities[r.city],out=[];let a=-1;const n=M.max(1,M.ceil(r.L/25));
  for(let q=0;q<=n;q++){const sd=r.L*q/n,p=posAt(r,sd),on=cityF(c,p[0],p[1])<g+0.13;if(on&&a<0)a=sd;if((!on||q===n)&&a>=0){const b=on?r.L:sd;if(b-a>12)out.push([a,b]);a=-1}}
  r._gv=g;r._gi=out;return out}
// a road is fully shown (traffic runs only on such roads)
function roadShown(r){if(r.dead||rHid(r))return false;if(!GROW.size)return true;const id=r.city!==undefined?r.city:r.gz;const g=id===undefined?undefined:GROW.get(id);if(g===undefined)return true;if(r.city===undefined)return g>=0.95;const iv=streetIv(r,g);return iv.length===1&&iv[0][0]===0&&iv[0][1]===r.L}
function growRoads(rl,whole){const out=[];for(const r of rl){const id=r.city!==undefined?r.city:r.gz;const g=id===undefined?undefined:GROW.get(id);if(g===undefined){out.push(r);continue}
    if(r.city===undefined){if(g>=0.95)out.push(r);continue}const iv=streetIv(r,g);if(!iv.length)continue;
    if(iv.length===1&&iv[0][0]===0&&iv[0][1]===r.L){out.push(r);continue}if(whole)continue;for(const [a,b] of iv)out.push({r,a,b})}return out}
let blockCache=new Map();const BCACHE=new Map();
function bcGet(key){const v=BCACHE.get(key);return v}
function bcSet(key,v){if(BCACHE.size>6000){let n=0;for(const k of BCACHE.keys()){BCACHE.delete(k);if(++n>2000)break}}BCACHE.set(key,v)}
function renderTile(z,tx,ty){
  const tsz=WORLD/(1<<z),mpp=tsz/TS,x0=tx*tsz,y0=ty*tsz,s=1/mpp;
  const cv=mkCanvas(TS,TS),ctx=cv.getContext('2d',{willReadFrequently:true});
  const NM=EMPTY?9500:5000,near=queryF(x0-NM,y0-NM,x0+tsz+NM,y0+tsz+NM).filter(o=>(o.kind==='city'||o.kind==='zone')&&featOn(o));
  const deps=DEPS.length?queryF(x0-300,y0-300,x0+tsz+300,y0+tsz+300).filter(o=>o.kind==='dep'):null;
  SPLIT=true;raster(ctx,x0,y0,mpp,near);
  const mg=mpp<6?260:mpp*45;const qx0=x0-mg,qy0=y0-mg,qx1=x0+tsz+mg,qy1=y0+tsz+mg;
  let feats=queryF(qx0,qy0,qx1,qy1),rl=queryRoads(x0-mpp*20-40,y0-mpp*20-40,x0+tsz+mpp*20+40,y0+tsz+mpp*20+40);
  if(DEADN||HID.size){feats=feats.filter(f=>!f.dead&&!(f.kind==='zone'&&zHid(f)));rl=rl.filter(r=>!r.dead&&!rHid(r))}if(GROW.size){feats=feats.filter(featOn);rl=growRoads(rl,false)}
  blockCache=new Map();TREEQ.length=0;mppG=mpp;LITE=mpp>2.2;LITE2=mpp>4.5;
  const detail=mpp<14;
  const T=()=>ctx.setTransform(s,0,0,s,-x0*s,-y0*s);
  // pass 0 (grounds)
  if(deps&&deps.length){T();drawDeps(ctx,deps,mpp)}
  for(const f of feats)drawFeat(ctx,f,0,x0,y0,s,mpp,qx0,qy0,qx1,qy1);
  TX0=x0;TY0=y0;T();drawRoads(ctx,rl,mpp);if(s>1.4){const RL=rl.filter(r=>r.k===5);if(RL.length){ctx.lineCap='butt';ctx.strokeStyle='#9a9ca2';ctx.lineWidth=0.14;strokeSym(ctx,RL,[0.72]);ctx.strokeStyle='rgba(40,40,44,0.5)';ctx.lineWidth=0.08;strokeSym(ctx,RL,[0.82])}}if(mpp<0.75)for(const f of feats)drawCross(ctx,f,x0,y0,s,qx0,qy0,qx1,qy1);T();drawOverpasses(ctx,rl,mpp);
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
function drawCross(ctx,f,x0,y0,s,qx0,qy0,qx1,qy1){if(f.kind!=='city'||f.type===0||GROW.has(f.id))return;const N=f.N,D=f.D;
  const [i0,i1,j0,j1]=blkRange(f,qx0,qy0,qx1,qy1);
  const a0=M.max(0,bsr(f.us,i0)),a1=M.min(D-1,bsr(f.us,i1)+1),b0=M.max(0,bsr(f.vs,j0)),b1=M.min(D-1,bsr(f.vs,j1)+1);if(a1<a0||b1<b0)return;
  if(!f.cv)setFrame(ctx,f.x,f.y,f.ca,f.sa,x0,y0,s);ctx.fillStyle='rgba(236,236,230,0.85)';ctx.beginPath();
  for(let j=b0;j<=b1;j++)for(let i=a0;i<=a1;i++){const up=f.eU[j*D+i],um=i>0&&f.eU[j*D+i-1],vp=f.eV[j*D+i],vm=j>0&&f.eV[(j-1)*D+i];if(up+um+vp+vm<3)continue;
    let cx=f.us[i],cy=f.vs[j];if(f.cv){const nf=nodeFrame(f,i,j);ctx.fill();setFrame(ctx,nf[0],nf[1],nf[2],nf[3],x0,y0,s);ctx.beginPath();cx=0;cy=0}const hvI=RW[lkU(f,i)]/2,hvJ=RW[lkV(f,j)]/2;
    const zeb=(dirx,diry,dist,half)=>{for(let o=-half+0.5;o<half-0.4;o+=1.05){if(dirx){const x=cx+dirx*dist;ctx.rect(dirx>0?x:x-3,cy+o,3,0.55)}else{const y=cy+diry*dist;ctx.rect(cx+o,diry>0?y:y-3,0.55,3)}}};
    if(up)zeb(1,0,hvI+1.6,hvJ-0.4);if(um)zeb(-1,0,hvI+1.6,hvJ-0.4);if(vp)zeb(0,1,hvJ+1.6,hvI-0.4);if(vm)zeb(0,-1,hvJ+1.6,hvI-0.4);
    if(up)ctx.rect(cx+hvI+5.4,cy,0.35,hvJ-0.6);if(um)ctx.rect(cx-hvI-5.75,cy-hvJ+0.6,0.35,hvJ-0.6);if(vp)ctx.rect(cx-hvI+0.6,cy+hvJ+5.4,hvI-0.6,0.35);if(vm)ctx.rect(cx,cy-hvJ-5.75,hvI-0.6,0.35)}
  ctx.fill()}
function grain(ctx,x0,y0,mpp,vec){if(!vec&&!SPLIT)return;
  const img=ctx.getImageData(0,0,TS,TS),d=img.data;const i1=1/(2.2*mpp),i2=1/(7*mpp);let o=0;const fine=mpp<3;
  for(let py=0;py<TS;py++){const wy=y0+(py+0.5)*mpp;for(let px=0;px<TS;px++,o+=4){if(d[o+3]<250)continue;if(!vec){const v=SHD[o>>2];if(v!==1){d[o]*=v;d[o+1]*=v;d[o+2]*=v}continue}const wx=x0+(px+0.5)*mpp;
    let g=noise(wx*i1+3.1,wy*i1+1.7)*0.05+noise(wx*i2+9.3,wy*i2+4.1)*0.04;if(fine){const h=mix32((px*73856093)^(py*19349663)^(x0*7|0));g+=((h&255)/255-0.5)*0.05}
    const m=(1+g)*SHD[o>>2];d[o]*=m;d[o+1]*=m;d[o+2]*=m}}
  ctx.putImageData(img,0,0)}
function drawFeat(ctx,f,pass,x0,y0,s,mpp,qx0,qy0,qx1,qy1){
  if(f.kind==='city'){if(f.type===0){if(mpp>9)return;for(let i=0;i<f.vst.length;i++){const st=f.vst[i];setFrame(ctx,st.x0,st.y0,st.ca,st.sa,x0,y0,s);const vk='v'+f.id+'_'+i+(LITE2?'b':LITE?'a':'')+(GROW.has(f.id)?'g'+GROW.get(f.id).toFixed(2):'');let P=bcGet(vk);if(!P){P=genVillage(f,i);bcSet(vk,P)}
        if(pass===1){ctx.beginPath();drawPrims(ctx,P,1,mpp);ctx.fillStyle=SHADOW;ctx.fill()}else drawPrims(ctx,P,pass,mpp)}return}
    const N=f.N,BD=f.D-1;const [i0,i1,j0,j1]=blkRange(f,qx0,qy0,qx1,qy1);
    if(f.pol&&mpp<=14){const pr=f.pol.rin;if(f.px+pr>qx0&&f.px-pr<qx1&&f.py+pr>qy0&&f.py-pr<qy1){setFrame(ctx,f.px,f.py,1,0,x0,y0,s);const P=plazaPrims(f);if(pass===1){ctx.beginPath();drawPrims(ctx,P,1,mpp);ctx.fillStyle=SHADOW;ctx.fill()}else drawPrims(ctx,P,pass,mpp)}}
    const bi0=M.max(0,bsr(f.us,i0)-(f.msi||0)),bi1=M.min(BD-1,bsr(f.us,i1)),bj0=M.max(0,bsr(f.vs,j0)-(f.msj||0)),bj1=M.min(BD-1,bsr(f.vs,j1));
    const LB=[];for(let bj=bj0;bj<=bj1;bj++)for(let bi=bi0;bi<=bi1;bi++){const t=growT(f,bi,bj,f.blocks[bj*BD+bi]);if(!t)continue;
      const u=(f.us[bi]+f.us[bi+1])/2,v=(f.vs[bj]+f.vs[bj+1])/2;LB.push(bi,bj,t,f.cv||f.sp?blkFrame(f,bi,bj)[1]:f.y+u*f.sa+v*f.ca)}
    const ord=[];for(let q=0;q<LB.length;q+=4)ord.push(q);if(pass===2)ord.sort((a,b)=>LB[a+3]-LB[b+3]);
    for(const q of ord){const bi=LB[q],bj=LB[q+1],t=LB[q+2];
      const bf=blkFrame(f,bi,bj);setFrame(ctx,bf[0],bf[1],bf[2],bf[3],x0,y0,s);
      if(mpp>14){if(pass===0){const c=seasonC(MASS[t],0);const v2=0.93+hr(f.id,bi*999+bj,4)*0.14;ctx.fillStyle=cs(c,v2);const bw=bf[4]*2,bh=bf[5]*2;ctx.fillRect(-bw/2+5,-bh/2+5,bw-10,bh-10)}continue}
      const key=(f.id*1e6+bj*1000+bi)*3+(LITE2?2:LITE?1:0)+(t!==f.blocks[bj*BD+bi]?0.5:0);let P=bcGet(key);if(!P){P=genBlock(f,bi,bj,t);bcSet(key,P)}
      if(pass===1){ctx.beginPath();drawPrims(ctx,P,1,mpp);ctx.fillStyle=SHADOW;ctx.fill()}else drawPrims(ctx,P,pass,mpp)}
    return}
  if(f.kind==='zone'){setFrame(ctx,f.x,f.y,f.ca,f.sa,x0,y0,s);if(pass===1){ctx.beginPath();drawPrims(ctx,f.prims,1,mpp);ctx.fillStyle=SHADOW;ctx.fill();return}drawPrims(ctx,f.prims,pass,mpp);return}
  if(f.kind==='farm'){if(pass===0)return;ctx.setTransform(s,0,0,s,-x0*s,-y0*s);if(pass===1)ctx.beginPath();
    for(const t of f.t){if(pass===1){ctx.moveTo(t.x,t.y);ctx.lineTo(t.x+SUNX*95-2,t.y+SUNY*95-2);ctx.lineTo(t.x+SUNX*95+2,t.y+SUNY*95+2);ctx.closePath()}
      else{ctx.fillStyle='#c8c8c4';ctx.beginPath();ctx.arc(t.x,t.y,M.max(2.5,mpp*0.8),0,TAU);ctx.fill();ctx.fillStyle='#9a9a90';ctx.fillRect(t.x-6,t.y-6,12,12)}}if(pass===1){ctx.fillStyle=SHADOW;ctx.fill()}}
}
// the round central square of a radial (or fan) town, inside its first ring: paving, a lawn ring with trees,
// a fountain basin and a column on a pedestal in the middle, lamp posts and benches
function plazaPrims(f){if(f._pz)return f._pz;const R=rng(f.seed^0x77aa),P=[],r=f.pol.rin-14.5-3.5;
  P.push({k:'gc',x:0,y:0,r,c:PAVE});P.push({k:'gc',x:0,y:0,r:r*0.8,c:[96,132,70]});P.push({k:'gc',x:0,y:0,r:r*0.62,c:[184,178,166]});
  for(let q=0;q<4;q++){const a=q*PI/2+PI/4;P.push({k:'path',x:M.cos(a)*r*0.71-2,y:M.sin(a)*r*0.71-2,w:4,h:4})}
  const n=M.floor(TAU*r*0.71/11);for(let q=0;q<n;q++){const a=q/n*TAU;if(q%M.max(1,n>>2)===0)continue;TR(P,M.cos(a)*r*0.71,M.sin(a)*r*0.71,5.5+R()*2,[0,1,4][q%3])}
  P.push({k:'pond',x:0,y:0,rx:r*0.36,ry:r*0.36});P.push({k:'gc',x:0,y:0,r:r*0.14,c:[178,172,160]});
  B(P,-5,-5,10,10,3.2,[170,166,156],'f');B(P,-2.2,-2.2,4.4,4.4,24+R()*12,[150,146,138],'f',{H0:3.2,lvl:1});
  f._pz=dropCrowns(P);return f._pz}
// zone cylinder shadows need stroke not fill: patch drawPrims pass1 for cyl via stroke
const _dp=drawPrims;

return {roadShown,addPlace,addZone,removeZone,addDeposits,removeDeposit,moveDeposit,addRail,removeRail,railPts,zoneUp,setHidden,drawUav:(ctx,v,c,s)=>drawUav(ctx,v,c,s,0),isHid:id=>HID.has(id),
  fieldReach:c=>EMPTY?fieldR(c)*1.3+3500:c.R+4700,blkFrame,cU,cW,deps:DEPS,zoneDead:id=>!zones[id]||!!zones[id].dead,forestAt,portAt:(x,y)=>portAt(x,y,820,900),setGrow,growOf:id=>GROW.has(id)?GROW.get(id):1,opt:OPT,setSeason,season:()=>SEASON,renderLights,WORLD,TS,SUNX,SUNY,WDX,WDY,LEANX,LEANY,cities:live,roads,zones,farms,ships,flights,emitters,airports,queryRoads,queryF,posAt,renderTile,sprites,drawShip,drawPlane,baseH,landE,rng,hh,noise,genTime:Date.now()-T0,mkCanvas,_dbg:{genVillage,genBlock,RW,riverV,riverW,avoidZ,zoneOnPath,waterRunOK,zoneExit,projOn,fieldOn,fieldR}};
}


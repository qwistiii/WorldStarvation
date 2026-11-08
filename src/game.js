// Game layer (stage 5): states, founding of capitals, territory growth, economy, bots, deposits, fog of war, saves.
// Uses the world engine (startWorld) through hooks; all game graphics are overlays drawn in Canvas 2D.
const FL=FlagArt();
function flagCanvas(fl,w,h,cv){cv=cv||document.createElement('canvas');const d=M_DPR();cv.width=M.round(w*d);cv.height=M.round(h*d);const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);FL.draw(x,fl,0,0,w,h);return cv}
function M_DPR(){return Math.min(2,window.devicePixelRatio||1)}
const M=Math;
const fmt=n=>n===Infinity?'∞':String(M.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const fmtK=n=>n===Infinity?'∞':n>=1e9?(n/1e9).toFixed(1).replace('.',',')+' млрд':n>=1e6?(n/1e6).toFixed(n>=1e7?0:1).replace('.',',')+' млн':n>=1e4?M.round(n/1000)+' тыс':fmt(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------------------------------------------------------------- names
const NAMES=(()=>{
  const CR=['Арвен','Бельт','Вирд','Гелар','Дакор','Зелер','Илар','Кордан','Лемор','Марв','Новар','Орис','Паллад','Рутен','Солар','Теран','Ундор','Фрисс','Хельв','Эстер','Альтан','Борей','Вестмар','Гард','Ирвен','Калед','Лузит','Миран','Норд','Остмар','Ривер','Сармат','Таврид','Ульмар','Фалькон','Хорн','Цезар','Шарван','Юстин','Ярден'];
  const CE=['ия','ания','ения','ия','ланд','ора','ея','истан'];
  const GOV=['Республика','Федерация','Королевство','Союз','Конфедерация','Народная Республика','Империя','Содружество'];
  const CAPR=['Сталь','Север','Золот','Кремн','Звёзд','Лун','Гран','Вольн','Светл','Крас','Бел','Ясн','Мир','Нов','Горн','Дубр','Кедр','Сокол','Орл','Рус','Ладо','Тавр','Верх','Озёр'];
  const CAPE=['оград','ополь','ск','инск','огорск','бург','ин','град','ец','омир','ослав'];
  const pick=(a,R)=>a[(R()*a.length)|0];
  return {GOV,
    country(R){R=R||M.random;const n=pick(CR,R),e=pick(CE,R);return n+e},
    capital(R){R=R||M.random;return pick(CAPR,R)+pick(CAPE,R)},
    gov(R){R=R||M.random;return pick(GOV,R)}};
})();
const LANDC=['#d94a3a','#3a78d9','#3fae5a','#e0b13a','#9b59d0','#e07a2f','#2fb3b0','#d04a8f','#8a9a3a','#6a7ad8','#c7c2b8','#5a3a2a'];
const TRAITS={random:'Случайный',trader:'Торговец',militarist:'Милитарист',cautious:'Осторожный',adventurer:'Авантюрист'};
const DIFF=[{n:'Лёгкий',inc:0.8,dec:3},{n:'Нормальный',inc:1,dec:2},{n:'Сложный',inc:1.35,dec:1}];
const ORES=[{k:'oil',n:'Нефть',v:6,w:18,c:'#2a2a2e'},{k:'gas',n:'Газ',v:5,w:14,c:'#4f8fd0'},{k:'coal',n:'Уголь',v:3,w:18,c:'#545458'},{k:'iron',n:'Железо',v:4,w:16,c:'#b0603e'},
  {k:'copper',n:'Медь',v:4.5,w:12,c:'#d08a4a'},{k:'gold',n:'Золото',v:9,w:6,c:'#f2c230'},{k:'uran',n:'Уран',v:10,w:5,c:'#86d14b'},{k:'lith',n:'Литий',v:7,w:8,c:'#c8d4e6'}];
function defaultConfig(){const R=M.random;const fl=FL.random(R);return {v:1,seed:(R()*1e9)|0,
  country:{name:NAMES.country(R),capital:NAMES.capital(R),gov:NAMES.gov(R),color:LANDC[(R()*6)|0],flag:fl},
  map:{type:'normal',size:1,rivers:2,lakes:2,mountains:1},
  rules:{money:5000,customBots:false,bots:[],botCount:3,diff:1,victory:'points',target:10000,timeLimit:60,mode:'normal',
    ai:1,botGrowth:1,trenches:2,ores:'balance',oreCustom:{oil:8,gas:6,coal:8,iron:7,copper:5,gold:3,uran:2,lith:4},reserves:0,dayNight:true,fog:true,alliances:true},
  slot:1}}
function makeBot(i,used,R){R=R||M.random;let col=LANDC.find(c=>!used.includes(c))||LANDC[i%LANDC.length];
  return {name:NAMES.country(R),capital:NAMES.capital(R),gov:NAMES.gov(R),flag:FL.random(R),diff:1,trait:'random',money:5000,color:col}}

// ---------------------------------------------------------------- saves
const Saves={key:i=>'ws.save.'+i,
  get(i){try{const s=localStorage.getItem(this.key(i));return s?JSON.parse(s):null}catch(e){return null}},
  put(i,d){try{localStorage.setItem(this.key(i),JSON.stringify(d));return true}catch(e){return false}},
  del(i){localStorage.removeItem(this.key(i))},
  list(){const o=[];for(let i=1;i<=5;i++)o.push(this.get(i));return o},
  latest(){let b=null,bi=0;this.list().forEach((s,i)=>{if(s&&(!b||s.meta.date>b.meta.date)){b=s;bi=i+1}});return b?{s:b,i:bi}:null}};
const rle=a=>{let o=[],v=a[0],n=0;for(let i=0;i<a.length;i++){if(a[i]===v)n++;else{o.push(v.toString(36)+'.'+n.toString(36));v=a[i];n=1}}o.push(v.toString(36)+'.'+n.toString(36));return o.join(',')};
const unrle=(s,a)=>{let i=0;for(const p of s.split(',')){const [v,n]=p.split('.');const vv=parseInt(v,36),nn=parseInt(n,36);a.fill(vv,i,i+nn);i+=nn}return a};

// ---------------------------------------------------------------- the game
const Game=(()=>{
const N=256,CSZ=512; // territory grid: 256 x 256 cells of 512 m
let api=null,W=null,cfg=null,G=null,ui=null;
let land=null,elev=null,coast=null,jit=null,own=null,vis=null,expl=null,ocean=null;
let polC=null,fogC=null,ovC=null,ovFa=-1,ovFg=null,ovE=false,dirtyOv=true,borders=null,dirtyPol=true,dirtyFog=true,polT=0,fogT=0,simAcc=0;
let placing=false,pend=null,mapMode='pol',hintStep=0,hintsOff=false,tutorial=false;
const ICONS={},DBG={};const PRF={};const prf=(n,f)=>{const t=performance.now();f();const d=performance.now()-t;const q=PRF[n]||(PRF[n]={n:0,sum:0,max:0});q.n++;q.sum+=d;q.max=M.max(q.max,d)};

// ---------- helpers
const cellOf=(x,y)=>{const i=M.floor(x/CSZ),j=M.floor(y/CSZ);return i<0||j<0||i>=N||j>=N?-1:j*N+i};
const cx=c=>(c%N+0.5)*CSZ,cy=c=>(M.floor(c/N)+0.5)*CSZ;
const hsh=(a,b)=>{let h=M.imul(a|0,0x27d4eb2d)^M.imul(b|0,0x165667b1)^(cfg?cfg.seed:0);h=M.imul(h^(h>>>15),0x85ebca6b);h^=h>>>13;return (h>>>0)/4294967296};
function rngS(s){let a=s>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=M.imul(a^(a>>>15),1|a);t=(t+M.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296}}
// game worlds start empty (no towns, roads or zones; only the capitals once founded) and with gentler relief
const MNTV=[0.25,0.42,0.7];
function mapOpt(caps){const m=cfg.map;return {map:m.type,size:m.size,rivers:m.rivers,lakes:m.lakes,mountains:MNTV[m.mountains==null?1:m.mountains],empty:true,caps:caps||undefined}}
const player=()=>G.states[0];
const creative=()=>cfg.rules.mode==='creative';

// ---------- heap (cost, cell, water run) per state
function hpush(h,c,cell,w){h.push([c,cell,w]);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;[h[p],h[i]]=[h[i],h[p]];i=p}}
function hpop(h){const top=h[0],last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===i)break;[h[m],h[i]]=[h[i],h[m]];i=m}}return top}

// ---------- world analysis
function analyse(){analyseLand();ocean=new Uint8Array(N*N);const st=[];for(let i=0;i<N;i++)for(const c of [i,(N-1)*N+i,i*N,i*N+N-1])if(!land[c]&&!ocean[c]){ocean[c]=1;st.push(c)}
  while(st.length){const c=st.pop(),i=c%N,j=(c/N)|0;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=N||jj>=N)continue;const q=jj*N+ii;if(!land[q]&&!ocean[q]){ocean[q]=1;st.push(q)}}}}
function analyseLand(){land=new Uint8Array(N*N);elev=new Float32Array(N*N);coast=new Uint8Array(N*N);jit=new Float32Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=(i+0.5)*CSZ,y=(j+0.5)*CSZ,e=W.baseH(x,y,6),k=j*N+i;elev[k]=e;land[k]=e>0.004?1:0;jit[k]=hsh(i,j)}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;if(!land[k])continue;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=(j+b)*N+i+a;if(i+a<0||j+b<0||i+a>=N||j+b>=N||!land[q]){coast[k]=1;break}}}}
function validSite(x,y){if(x<7000||y<7000||x>W.WORLD-7000||y>W.WORLD-7000)return 'Слишком близко к краю мира';
  const e=W.landE(x,y,0.006);if(e<0)return 'Здесь вода';if(e<0.025)return 'Слишком низко — болота у берега';if(e>0.32)return 'Горы: город здесь не построить';
  let n=0,ok=0;for(let a=0;a<16;a++){const r=a<8?1600:3000,t=a*0.785+(a<8?0:0.39);n++;if(W.landE(x+M.cos(t)*r,y+M.sin(t)*r,0)>=0)ok++}if(ok/n<0.62)return 'Мало суши вокруг';
  if(G&&G.phase!=='found')return 'Столица уже основана';return null}

// ---------- states
function hexRgb(h){const n=parseInt(h.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255]}
function botList(){const r=cfg.rules;if(r.customBots&&r.bots.length)return r.bots;const out=[],used=[cfg.country.color],names=[cfg.country.name];const R=rngS(cfg.seed^0x5a5a);
  for(let i=0;i<r.botCount;i++){const b=makeBot(i,used,R);const clash=n=>names.some(q=>q.slice(0,4)===n.slice(0,4));for(let t=0;t<40&&clash(b.name);t++)b.name=NAMES.country(R);b.diff=r.diff;b.money=r.money;used.push(b.color);names.push(b.name);out.push(b)}return out}

// ---------- bots pick their capitals: far from everyone, on good land; traders prefer coasts
function chooseCaps(px,py){const caps=[{x:px,y:py}],out=[];const bots=G.states.slice(1);const R=rngS(cfg.seed^0xcafe);
  const cand=[];for(let j=8;j<N-8;j+=4)for(let i=8;i<N-8;i+=4){const x=(i+R())*CSZ,y=(j+R())*CSZ;if(!land[cellOf(x,y)]||validSite(x,y)!==null)continue;
    let cw=0;for(let a=0;a<8;a++){const t=a*0.785;if(W.landE(x+M.cos(t)*6000,y+M.sin(t)*6000,0)<0)cw++}cand.push({x,y,cw,r:R()})}
  for(const b of bots){let best=null,bs=-1e18;for(const c of cand){let md=1e18;for(const q of caps)md=M.min(md,M.hypot(q.x-c.x,q.y-c.y));if(md<12000)continue;
      let sc=M.min(md,60000);if(b.trait==='trader')sc+=c.cw*2500;if(b.trait==='adventurer')sc+=c.r*22000;if(b.trait==='cautious')sc+=M.min(md,80000)*0.3;if(b.trait==='militarist')sc-=M.max(0,md-35000)*0.4;
      if(sc>bs){bs=sc;best=c}}
    if(!best)continue;caps.push(best);out.push([b,best])}
  return out}

// ---------- territory
// ---------- territory: the land around settlements and buildings (with a small margin), taken in war
function setOwn(c,sid){const o=own[c];if(o===sid+1)return;if(o)G.states[o-1].cells--,G.states[o-1]._dirty=true;own[c]=sid+1;dirtyPol=true;dirtyFog=true;
  if(sid<0)return;const s=G.states[sid];s.cells++;s._dirty=true;const i=c%N,j=(c/N)|0,b=s.bb||(s.bb=[i,j,i,j]);if(i<b[0])b[0]=i;if(j<b[1])b[1]=j;if(i>b[2])b[2]=i;if(j>b[3])b[3]=j}
// claim free land (and only land) within r metres of (x,y)
function claimDisc(s,x,y,r){const R=r/CSZ,i0=M.floor(x/CSZ),j0=M.floor(y/CSZ),n=M.ceil(R);
  for(let b=-n;b<=n;b++)for(let a=-n;a<=n;a++){const i=i0+a,j=j0+b;if(i<0||j<0||i>=N||j>=N)continue;const dx=(i+0.5)*CSZ-x,dy=(j+0.5)*CSZ-y;if(dx*dx+dy*dy>r*r)continue;const c=j*N+i;if(!land[c]||own[c])continue;setOwn(c,s.id)}}
// the town's planned footprint (its street grid reaches ~1.3 R) plus a margin of 1.5 km for its industry
function placeR(p){const c=W.cities[p.id];if(!c)return 900;if(p.k==='village')return 1300;return c.R*1.3+1500}
function initTerritory(){own=new Uint8Array(N*N);vis=new Uint8Array(N*N);expl=new Uint8Array(N*N);for(const s of G.states)s.cells=0;claimAll()}
// demolish: the zone leaves the world (op in all workers), 30 % of the price comes back; its army is disbanded
function demolish(s,q){if(!q.done||q.k==='city'||q.k==='village')return false;if(q.id>=0)api.op('removeZone',q.id);s.builds.splice(s.builds.indexOf(q),1);if(q.dep!=null&&G.dep[q.dep])G.dep[q.dep].used=-1;
  const a=s.armies.find(x=>x.home===q);if(a)s.armies.splice(s.armies.indexOf(a),1);if(s.res.money!==Infinity)s.res.money+=BLD[q.k].cost*0.3;if(s.isP)toast(`Снесено: <b>${BLD[q.k].n}</b> · возвращено ${fmt(BLD[q.k].cost*0.3)}`);updPop();return true}
// territory as merging drops: a cell is taken where the sum of (r/d)^2 over the state's places and buildings reaches 1,
// so neighbouring places join into one land; a new place's reach grows in over ~40 s
function claimAll(){for(const s of G.states){if(s.dead)continue;const src=[];
    for(const p of s.places){const age=p.t0==null?99:G.t-p.t0;src.push([p.x,p.y,placeR(p)*(0.55+0.45*M.min(1,age/40))])}for(const b of s.builds)if(b.done&&!b.gone)src.push([b.x,b.y,850]);if(!src.length)continue;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const [x,y,r] of src){x0=M.min(x0,x-r*1.6);y0=M.min(y0,y-r*1.6);x1=M.max(x1,x+r*1.6);y1=M.max(y1,y+r*1.6)}
    const i0=M.max(0,M.floor(x0/CSZ)),i1=M.min(N-1,M.floor(x1/CSZ)),j0=M.max(0,M.floor(y0/CSZ)),j1=M.min(N-1,M.floor(y1/CSZ));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const c=j*N+i;if(own[c]||!land[c])continue;const X=(i+0.5)*CSZ,Y=(j+0.5)*CSZ;let F=0;for(const [x,y,r] of src){const d2=(X-x)**2+(Y-y)**2;F+=r*r/M.max(d2,1);if(F>=1)break}if(F>=1)setOwn(c,s.id)}}}
const ownerAt=(x,y)=>{const c=cellOf(x,y);return c<0||!own?0:own[c]};

// ---------- deposits
function genDeposits(){const r=cfg.rules,R=rngS(cfg.seed^0x0e5);const dep=[];let want=[];
  if(r.ores==='custom')for(const o of ORES)for(let q=0;q<(r.oreCustom[o.k]|0);q++)want.push(o);
  else{const n={few:34,balance:70,many:130}[r.ores]||70;const tw=ORES.reduce((a,o)=>a+o.w,0);for(let q=0;q<n;q++){let t=R()*tw;for(const o of ORES){t-=o.w;if(t<=0){want.push(o);break}}}}
  const mul=creative()?Infinity:[1,3,Infinity][r.reserves];
  for(const o of want){for(let t=0;t<60;t++){const x=6000+R()*(W.WORLD-12000),y=6000+R()*(W.WORLD-12000);const c=cellOf(x,y);if(!land[c]||W.landE(x,y,0)<0)continue;
      if(dep.some(d=>M.hypot(d.x-x,d.y-y)<2500))continue;
      const amt=o.v*(700+R()*700)*mul;dep.push({k:ORES.indexOf(o),x,y,c,amt,max:amt,known:true,used:-1});break}}
  return dep}

// ---------- buildings (shared by the player and the bots)
// prod / need per second; area: where it may stand
const BLD={
  city:{n:'Город',cost:4000,time:24,d:'Новый город растёт сам; налоги, жители, новые земли',area:'near',R:1500},
  village:{n:'Село',cost:900,time:10,d:'Небольшое село и земля вокруг него — под колхозы',area:'near'},
  farm:{n:'Колхоз',cost:600,time:8,d:'Еда и немного денег. Только в области села',zk:'farm',W:300,H:200,area:'village',prod:{food:8,money:2}},
  factory:{n:'Завод товаров',cost:2500,time:16,d:'Главный доход: товары и деньги. Нужна энергия',zk:'ind',W:640,H:420,area:'town',need:{energy:6},prod:{goods:4,money:16}},
  power:{n:'ТЭЦ',cost:2000,time:16,d:'Энергия для заводов, НПЗ и портов',zk:'pow',W:760,H:560,area:'own',prod:{energy:20}},
  sawmill:{n:'Лесопилка',cost:900,time:10,d:'Древесина и деньги. Ставится у леса',zk:'saw',W:360,H:260,area:'forest',prod:{wood:4,money:2}},
  oil:{n:'Нефтевышка',cost:1500,time:12,d:'Нефть. Только на месторождении нефти',zk:'oil',W:130,H:95,area:'oil',prod:{oil:5}},
  refinery:{n:'НПЗ',cost:3500,time:20,d:'Нефть → топливо и деньги',zk:'ref2',W:1000,H:700,area:'own',need:{oil:4,energy:3},prod:{fuel:3,money:12}},
  port:{n:'Порт',cost:4000,time:20,d:'Экспорт излишков, импорт нехватки, +800 к складу',zk:'port',W:820,H:900,area:'coast',need:{energy:2}},
  barracks:{n:'Военная часть',cost:2500,time:18,d:'Армия до 12 бойцов',zk:'mil',W:720,H:520,area:'own'},
  sam:{n:'ПВО',cost:1800,time:12,d:'Сбивает вражеские дроны в радиусе 9 км',zk:'sam',W:150,H:150,area:'own'}};
const BORDER=['village','farm','factory','power','sawmill','oil','refinery','port','city','barracks','sam'];
const RES=['food','goods','wood','oil','fuel'];const RESN={money:'Деньги',food:'Еда',goods:'Товары',energy:'Энергия',wood:'Древесина',oil:'Нефть',fuel:'Топливо'};
const PRICE={food:1,goods:3,wood:1.5,oil:2,fuel:3};
// can state s build kind k at (x,y)?  → null or the reason
function canBuild(s,k,x,y){const b=BLD[k];if(!b)return 'Неизвестная постройка';if(x<5000||y<5000||x>W.WORLD-5000||y>W.WORLD-5000)return 'Слишком близко к краю мира';
  const e=W.landE(x,y,0.004);if(e<0)return 'Здесь вода';if(e>0.36)return 'Слишком высоко в горах';
  const o=ownerAt(x,y),mine=o===s.id+1;const rad=b.R?b.R*1.3:M.hypot(b.W||600,b.H||600)/2;
  for(const c of W.cities){const d=M.hypot(c.x-x,c.y-y);if(k==='city'||k==='village'){if(d<c.R*1.2+rad+400)return 'Слишком близко к '+c.name}else if(c.type>=1&&cityF(c,x,y)<1.1+rad/c.R)return 'Здесь кварталы '+c.name}
  const hw=b.zk?b.W/2:(b.R?b.R*1.3:400),hh=b.zk?b.H/2:hw;
  for(const z of W.zones)if(!z.dead&&rectHit(z,x,y,hw+30,hh+30))return 'Занято: мешает «'+(ZLBL[z.zk]||'объект')+'»';
  if(b.zk&&k!=='port'&&footBad(x,y,b.W,b.H))return footBad(x,y,b.W,b.H);
  for(const st of G.states)for(const q of st.builds)if(!q.done&&M.hypot(q.x-x,q.y-y)<rad+600)return 'Рядом идёт стройка';
  if(b.area==='near'){if(o&&!mine)return 'Чужая территория';if(!mine&&distOwn(s,x,y)>(k==='city'?14000:10000))return 'Слишком далеко от ваших земель';return null}
  if(!mine)return 'Только на своей территории';
  if(b.area==='village'){const v=s.places.find(p=>p.k==='village'&&M.hypot(p.x-x,p.y-y)<1400);return v?null:'Колхоз — только в области села'}
  if(b.area==='town'){const t=s.places.find(p=>p.k!=='village'&&M.hypot(p.x-x,p.y-y)<placeR(p)+1500);return t?null:'Завод — рядом с городом'}
  if(b.area==='forest'){let f=0;for(let a=0;a<8;a++)f=M.max(f,W.forestAt(x+M.cos(a)*450,y+M.sin(a)*450));return f>0.5||W.forestAt(x,y)>0.5?null:'Лесопилка — у леса'}
  if(b.area==='oil'){const d=G.dep.find(d=>ORES[d.k].k==='oil'&&d.known&&d.used<0&&M.hypot(d.x-x,d.y-y)<800);return d?null:'Нефтевышка — на месторождении нефти'}
  if(b.area==='coast')return coastNear(x,y)?null:'Порт — только на берегу моря с выходом в океан';
  return null}
// the port needs the open sea: the water it faces must be connected to the world's edge (not a lake)
function coastNear(x,y){const p=W.portAt(x,y);if(!p)return false;for(const d of [420,600,800]){const c=cellOf(p[0]+M.cos(p[2])*d,p[1]+M.sin(p[2])*d);if(c>=0&&ocean[c])return true}return false}
// does the zone z overlap an axis-aligned box (x±hw, y±hh)? separating axes of the two rectangles
function rectHit(z,x,y,hw,hh){const ax=[[1,0],[0,1],[z.ca,z.sa],[-z.sa,z.ca]],dx=x-z.x,dy=y-z.y;
  for(const [ux,uy] of ax){const pa=hw*M.abs(ux)+hh*M.abs(uy),pb=z.W/2*M.abs(ux*z.ca+uy*z.sa)+z.H/2*M.abs(-ux*z.sa+uy*z.ca);if(M.abs(dx*ux+dy*uy)>pa+pb)return false}return true}
const ZLBL={farm:'Колхоз',ind:'Завод товаров',pow:'ТЭЦ',saw:'Лесопилка',oil:'Нефтевышка',ref2:'НПЗ',port:'Порт',mil:'Военная часть',sam:'ПВО'};
// the footprint of a building: dry land everywhere (3 x 3 samples + corners) and no road across it
function footBad(x,y,w,h){for(let a=0;a<=4;a++)for(let b=0;b<=4;b++){if(W.landE(x+(a/4-0.5)*w,y+(b/4-0.5)*h,0.002)<0)return 'Здесь вода'}
  const RW=W._dbg.RW;for(const r of W.queryRoads(x-w/2-40,y-h/2-40,x+w/2+40,y+h/2+40)){if(r.k===8)continue;const m=RW[r.k]/2+6;
    for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],bx=r.pts[i*2+2],by=r.pts[i*2+3],L=M.hypot(bx-ax,by-ay);for(let t=0;t<=L;t+=20){const px=ax+(bx-ax)*t/L,py=ay+(by-ay)*t/L;if(M.abs(px-x)<w/2+m&&M.abs(py-y)<h/2+m)return 'Мешает дорога'}}}return null}
function distOwn(s,x,y){let d=1e9;for(const p of s.places)d=M.min(d,M.hypot(p.x-x,p.y-y)-placeR(p));return d}
function cityF(c,x,y){return M.hypot(x-c.x,y-c.y)/c.R}
// the nearest settlement of the state — a building's access road leads there
function homeOf(s,x,y){let best=null,bd=1e18;for(const p of s.places){const d=M.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=p}}return best}
function startBuild(s,k,x,y){const b=BLD[k],c=creative()&&s.isP?0:b.cost;if(s.res.money<c)return false;if(s.res.money!==Infinity)s.res.money-=c;
  const q={k,x,y,t:0,time:b.time*(s.isP?1:[1.3,1,0.8][s.diff]),done:false,id:-1,off:0};if(k==='oil'){const d=G.dep.find(d=>ORES[d.k].k==='oil'&&d.known&&d.used<0&&M.hypot(d.x-x,d.y-y)<800);if(d){d.used=s.id;q.dep=G.dep.indexOf(d);q.x=d.x;q.y=d.y}}
  s.builds.push(q);if(s.isP)onBuilt(k,false);return true}
// construction finished: the world gets the new town or zone (same op in all workers)
function finishBuild(s,q){q.done=true;const b=BLD[q.k];
  if(q.k==='city'||q.k==='village'){const name=NAMES.capital(rngS(hsh(q.x|0,q.y|0)*1e9));const id=api.op('addPlace',{k:q.k,x:q.x,y:q.y,st:s.id,name,R:b.R});q.id=id;
    const p={k:q.k,id,x:q.x,y:q.y,grow:q.k==='city'?0.12:1,growQ:-1,name,st:s,t0:G.t};s.places.push(p);if(q.k==='city')syncPlace(p);claimAll()}
  else{const h=homeOf(s,q.x,q.y);q.id=api.op('addZone',{zk:b.zk,x:q.x,y:q.y,city:h.id,st:s.id,W:b.W,H:b.H});if(q.id<0){q.failed=true}claimAll()
    if(q.k==='barracks'){const n=(s.armyN=(s.armyN||0)+1);s.armies.push(mkArmy(s,n,q))}}
  if(s.isP){toast(`Построено: <b>${b.n}</b>`);onBuilt(q.k,true)}updPop()}
function syncPlace(p){const g=p.grow>=1?1:M.floor(p.grow/0.07)*0.07+0.07;if(g!==p.growQ){p.growQ=g;api.setGrow(p.id,M.min(1,g))}}
function syncGrow(s){const g=s.grow>=1?1:M.floor(s.grow/0.07)*0.07+0.07;if(g!==s.growQ&&s.cityId>=0){s.growQ=g;api.setGrow(s.cityId,M.min(1,g))}}

// ---------- economy
function popOf(p){const c=W.cities[p.id];if(!c)return 0;if(p.k==='village')return 800+c.R*2;const g=p.k==='capital'?p.st.grow:p.grow;return c.R*c.R*(p.k==='capital'?0.11:0.08)*M.min(1,g)}
function updPop(){for(const s of G.states){s.pop=0;for(const p of s.places)s.pop+=popOf(p)}}
function econ(s,dt){const r=s.res,cap=400+800*s.builds.filter(q=>q.done&&q.k==='port').length,mul=s.isP?1:DIFF[s.diff].inc;s.store=cap;
  // energy is a rate: production vs demand; consumers run at the share that is covered
  let eProd=0,eNeed=0;const live=s.builds.filter(q=>q.done&&!q.failed&&q.off<=0);for(const q of live){const b=BLD[q.k];if(b.prod&&b.prod.energy)eProd+=b.prod.energy;if(b.need&&b.need.energy)eNeed+=b.need.energy}
  const eK=eNeed?M.min(1,eProd/eNeed):1;s.energy=[eProd,eNeed];let inc=0;const flow={food:0,goods:0,wood:0,oil:0,fuel:0};
  for(const q of live){const b=BLD[q.k];let k=b.need&&b.need.energy?eK:1;
    if(b.need&&b.need.oil){const want=b.need.oil*dt*k;const got=M.min(want,r.oil);r.oil-=got;k*=want?got/want:0;flow.oil-=got/dt}
    if(q.k==='oil'){const d=G.dep[q.dep];if(!d||d.amt<=0)continue;const take=b.prod.oil*dt;if(d.amt!==Infinity)d.amt=M.max(0,d.amt-take)}
    if(!b.prod)continue;for(const [rk,v] of Object.entries(b.prod)){if(rk==='energy')continue;if(rk==='money'){inc+=v*k;continue}r[rk]=M.min(cap,r[rk]+v*k*dt);flow[rk]+=v*k}}
  // people: taxes, they eat food and use goods
  const pop=s.pop,eat=pop/70000,use=pop/140000;const fOk=r.food>=eat*dt,gOk=r.goods>=use*dt;r.food=M.max(0,r.food-eat*dt);r.goods=M.max(0,r.goods-use*dt);flow.food-=eat;flow.goods-=use;
  inc+=3+pop/5000*(fOk?1:0.5)*(gOk?1:0.75);
  // other deposits inside the borders give a little money
  for(const d of G.dep)if(ORES[d.k].k!=='oil'&&own[d.c]===s.id+1&&d.amt>0){inc+=ORES[d.k].v*0.25;if(d.amt!==Infinity)d.amt=M.max(0,d.amt-ORES[d.k].v*0.25*dt)}
  // ports: sell what is above 70 % of the store, buy food when it runs out
  if(cap>400){for(const rk of RES){const over=r[rk]-cap*0.7;if(over>0){const sell=M.min(over,8*dt);r[rk]-=sell;inc+=sell/dt*PRICE[rk]}}if(r.food<cap*0.1&&r.money>50){const buy=4*dt;r.food+=buy;r.money-=buy*2}}
  inc*=mul;if(r.money!==Infinity)r.money+=inc*dt;s.income=inc;s.earned+=inc*dt;s.flow=flow;
  for(const q of s.builds)if(q.off>0)q.off-=dt;
  s.score=M.round(s.pop/1000+s.earned/100+s.cells*0.5)}

// ---------- armies
const UNIT={inf:{n:'Пехота',atk:2,def:2,cost:60,ic:'И'},sf:{n:'Спецназ',atk:4,def:2.5,cost:130,ic:'С'},mot:{n:'Мотострелки',atk:3,def:3,cost:110,ic:'М'},
  at:{n:'ПТ-расчёт',atk:3.5,def:3,cost:120,ic:'П'},art:{n:'Артиллерия',atk:5,def:1,cost:160,ic:'А'},tank:{n:'Танк',atk:6,def:5,cost:260,ic:'Т'}};
const TPL={mixed:{n:'Смешанная армия',u:{inf:6,mot:3,at:1,art:1,tank:1}},assault:{n:'Штурмовой спецназ',u:{sf:8,inf:4}},motor:{n:'Мотострелки',u:{mot:10,at:2}},
  atdef:{n:'ПТ-оборона',u:{at:8,inf:4}},fire:{n:'Огневая поддержка',u:{art:6,inf:4,at:2}},tank:{n:'Танковый кулак',u:{tank:8,mot:4}}};
function mkArmy(s,n,q){return {id:s.id*100+n,n,st:s.id,x:q.x,y:q.y,home:q,tpl:null,units:[],tx:null,ty:null,rec:0,fight:0}}
const strength=a=>a.units.reduce((t,u)=>t+UNIT[u].atk+UNIT[u].def,0);
function recruit(s,a,dt){if(!a.tpl||a.home.off>0)return;const want=[];for(const [u,n] of Object.entries(TPL[a.tpl].u)){const have=a.units.filter(x=>x===u).length;for(let i=have;i<n;i++)want.push(u)}
  if(!want.length||a.units.length>=12)return;a.rec+=dt;if(a.rec<4)return;a.rec=0;const u=want[0],c=UNIT[u].cost;if(s.res.money<c)return;if(s.res.money!==Infinity)s.res.money-=c;a.units.push(u)}
const atWar=(a,b)=>a!==b&&(G.wars.has(a+'-'+b)||G.wars.has(b+'-'+a));
function stepArmy(s,a,dt){if(a.tx!==null&&a.units.length){const dx=a.tx-a.x,dy=a.ty-a.y,d=M.hypot(dx,dy),v=a.units.some(u=>u==='inf'||u==='at'||u==='art')?110:150,st=v*dt;
    if(d<=st){a.x=a.tx;a.y=a.ty;a.tx=a.ty=null}else{a.x+=dx/d*st;a.y+=dy/d*st}}
  if(!a.units.length)return;a.fight=M.max(0,a.fight-dt);
  // battle with hostile armies in contact
  for(const t of G.states){if(!atWar(s.id,t.id))continue;for(const e of t.armies){if(!e.units.length||M.hypot(e.x-a.x,e.y-a.y)>1600)continue;a.fight=e.fight=1;
    const dmg=a.units.reduce((t2,u)=>t2+UNIT[u].atk,0)*dt*0.012*(0.6+hsh(a.id,G.t*10|0)*0.8),def=e.units.reduce((t2,u)=>t2+UNIT[u].def,0)/e.units.length;e.hp=(e.hp||0)+dmg/def;
    while(e.hp>=1&&e.units.length){e.hp-=1;e.units.splice((hsh(e.id,G.t*10|0)*e.units.length)|0,1)}if(!e.units.length)toastWar(`<b>${armyName(t,e)}</b> разбита`,t)}}
  // capture: in enemy land with no defenders around the army takes the cells and settlements it stands on
  const o=ownerAt(a.x,a.y)-1;if(o>=0&&o!==s.id&&atWar(s.id,o)&&!a.fight){const t=G.states[o];if(!t.armies.some(e=>e.units.length&&M.hypot(e.x-a.x,e.y-a.y)<3000)){
    a.cap=(a.cap||0)+dt;if(a.cap>1){a.cap=0;const i0=M.floor(a.x/CSZ),j0=M.floor(a.y/CSZ);for(let b=-3;b<=3;b++)for(let c=-3;c<=3;c++){if(c*c+b*b>9)continue;const i=i0+c,j=j0+b;if(i<0||j<0||i>=N||j>=N)continue;const k=j*N+i;if(own[k]===o+1)setOwn(k,s.id)}
      for(const p of t.places.slice())if(M.hypot(p.x-a.x,p.y-a.y)<1500)capturePlace(t,s,p)}}}}
function capturePlace(from,to,p){from.places.splice(from.places.indexOf(p),1);p.st=to;to.places.push(p);if(p.k==='capital'){p.k='city';p.grow=from.grow;from.cap=null;from.lostCap=true}
  for(const q of from.builds.slice())if(q.done&&M.hypot(q.x-p.x,q.y-p.y)<placeR(p)+2000){from.builds.splice(from.builds.indexOf(q),1);to.builds.push(q);
    if(q.k==='barracks'){const a=from.armies.find(x=>x.home===q);if(a){from.armies.splice(from.armies.indexOf(a),1)}}}
  toastWar(`<b>${esc(to.name)}</b> захватывает ${p.k==='city'&&from.lostCap?'столицу':'город'} <b>${esc(p.name)}</b>`,to);updPop();
  if(!from.places.length){from.dead=true;for(let c=0;c<N*N;c++)if(own[c]===from.id+1)setOwn(c,to.id);for(const a of from.armies)a.units=[];G.wars.forEach(w=>{if(w.split('-').includes(String(from.id)))G.wars.delete(w)});toastWar(`<b>${esc(from.name)}</b> прекращает существование`,from)}}
const armyName=(s,a)=>`Армия №${a.n}`+(s.isP?'':' ('+s.name+')');
function toastWar(h,s){toast(h,s&&s.flag)}
// ---------- drones: launched from military bases at enemy targets; air defence shoots them down
function launchDrone(s,t,tx,ty,kind){const base=s.builds.find(q=>q.done&&q.k==='barracks'&&q.off<=0);if(!base)return false;G.drones.push({st:s.id,to:t.id,x:base.x,y:base.y,tx,ty,kind,life:0});return true}
function stepDrones(dt){for(const d of G.drones.slice()){const dx=d.tx-d.x,dy=d.ty-d.y,L=M.hypot(dx,dy),v=320*dt;d.life+=dt;
    // air defence of the target state (and its allies) within 9 km
    for(const t of G.states){if(t.id===d.st||!(t.id===d.to||t.allies.includes(d.to)))continue;for(const q of t.builds){if(!q.done||q.k!=='sam'||q.off>0)continue;if(M.hypot(q.x-d.x,q.y-d.y)<9000&&hsh(q.x|0,(G.t*10|0)+d.life*100)<0.06*dt*10){G.fx.push({x:d.x,y:d.y,t:0,k:'boom'});G.fx.push({x:q.x,y:q.y,x2:d.x,y2:d.y,t:0,k:'shot'});G.drones.splice(G.drones.indexOf(d),1);if(t.isP)toast('ПВО сбила вражеский дрон');d.dead=1;break}}if(d.dead)break}
    if(d.dead)continue;if(L<=v){G.drones.splice(G.drones.indexOf(d),1);G.fx.push({x:d.tx,y:d.ty,t:0,k:'boom'});droneHit(d);continue}d.x+=dx/L*v;d.y+=dy/L*v}
  for(const f of G.fx.slice()){f.t+=dt;if(f.t>1.2)G.fx.splice(G.fx.indexOf(f),1)}}
function droneHit(d){const t=G.states[d.to];if(!t)return;let hit=null;for(const q of t.builds)if(q.done&&M.hypot(q.x-d.tx,q.y-d.ty)<700){hit=q;break}
  if(hit){hit.off=40;if(t.isP)toast(`Дрон поразил: <b>${BLD[hit.k].n}</b> — не работает 40 с`);return}
  for(const a of t.armies)if(a.units.length&&M.hypot(a.x-d.tx,a.y-d.ty)<1200){a.units.splice(0,M.min(2,a.units.length));if(t.isP)toast(`Дрон ударил по армии №${a.n}`);return}}

// ---------- war and peace
function declareWar(a,b){if(atWar(a.id,b.id)||a.allies.includes(b.id))return;G.wars.add(a.id+'-'+b.id);toast(`<b>${esc(a.name)}</b> объявляет войну <b>${esc(b.name)}</b>`,a.flag,null,9000);updDip()}
function makePeace(a,b){G.wars.delete(a.id+'-'+b.id);G.wars.delete(b.id+'-'+a.id);toast(`<b>${esc(a.name)}</b> и <b>${esc(b.name)}</b> заключили мир`,a.flag);updDip()}
function askPeace(o){const p=player();const mine=p.armies.reduce((t,a)=>t+strength(a),0),their=o.armies.reduce((t,a)=>t+strength(a),0);if(their<mine*0.9||hsh(o.id,G.t|0)<0.3)makePeace(p,o);else toast(`<b>${esc(o.name)}</b> отвергает мир`,o.flag);o.asked=G.t;updDip()}

// ---------- bots
const BOTPLAN={trader:['village','farm','factory','power','port','sawmill','oil','refinery','city','barracks','sam','factory','village','farm','city'],
  militarist:['village','farm','barracks','factory','power','sam','oil','refinery','city','barracks','factory','sawmill','port','village','farm','city'],
  cautious:['village','farm','factory','power','sam','sawmill','barracks','oil','refinery','port','city','factory','village','farm','sam'],
  adventurer:['village','city','farm','factory','power','oil','refinery','barracks','village','city','sawmill','port','sam','factory','farm']};
function botThink(s){const ai=cfg.rules.ai,R=()=>hsh(s.id*7919+(G.t|0),G.dec++);if(s.dead)return;
  // build: next item of the plan (then repeat its second half)
  s.bT=(s.bT||0)+1;if(!s.builds.some(q=>!q.done)&&s.bT>=[6,4,3][s.diff]){s.bT=0;const plan=BOTPLAN[s.trait]||BOTPLAN.trader;const i=s.planI||0,k=plan[i<plan.length?i:plan.length/2+(i-plan.length)%(plan.length/2)|0];
    if(s.res.money>=BLD[k].cost*1.1){const site=findSite(s,k,R);if(site){startBuild(s,k,site[0],site[1]);s.planI=i+1}else if(R()<0.3)s.planI=i+1}}
  for(const a of s.armies)if(!a.tpl)a.tpl={trader:'mixed',militarist:R()<0.5?'tank':'assault',cautious:'atdef',adventurer:R()<0.5?'motor':'mixed'}[s.trait]||'mixed';
  // war: not before ~10-12 minutes, only with an army; aggressive AI decides sooner
  const ready=s.armies.some(a=>a.units.length>=6);if(ready&&cfg.rules.ai>0&&G.t>(s.warAfter||(s.warAfter=600+hsh(s.id,99)*120))&&!G.states.some(t=>atWar(s.id,t.id))&&R()<0.05*ai*(s.trait==='militarist'?2:s.trait==='cautious'?0.4:1)){
    // the target: a near neighbour that is not already fighting two wars (no dog-pile on one state)
    const tg=G.states.filter(t=>t!==s&&!t.dead&&t.places.length&&!s.allies.includes(t.id)&&G.states.filter(u=>atWar(u.id,t.id)).length<2).map(t=>[t,distOwn(s,t.places[0].x,t.places[0].y)*(0.7+R()*0.6)]).sort((a,b)=>a[1]-b[1])[0];if(tg)declareWar(s,tg[0])}
  for(const t of G.states){if(!atWar(s.id,t.id)||t.dead)continue;
    for(const a of s.armies){if(a.units.length<5||a.tx!==null)continue;const p=t.places.slice().sort((p1,p2)=>M.hypot(p1.x-a.x,p1.y-a.y)-M.hypot(p2.x-a.x,p2.y-a.y))[0];if(p){a.tx=p.x+(R()-0.5)*600;a.ty=p.y+(R()-0.5)*600}}
    s.dT=(s.dT||0)+DIFF[s.diff].dec;if(s.dT>30&&s.res.money>300){s.dT=0;const tgts=t.builds.filter(q=>q.done);const q=tgts[(R()*tgts.length)|0]||t.places[0];if(q&&launchDrone(s,t,q.x,q.y)&&s.res.money!==Infinity)s.res.money-=300}
    // peace when losing badly
    if(strengthOf(s)<strengthOf(t)*0.4&&R()<0.05)makePeace(s,t)}
  if(cfg.rules.alliances&&G.t-(s.offT||-1e9)>150&&R()<0.012*(1.5-ai*0.5)*(s.trait==='cautious'?1.8:1)){s.offT=G.t;const others=G.states.filter(o=>o!==s&&!o.dead&&!s.allies.includes(o.id)&&!atWar(s.id,o.id));if(others.length){const o=others[(R()*others.length)|0];
      if(o.isP)offerAlly(s);else if(R()<0.5)ally(s,o)}}}
const strengthOf=s=>s.armies.reduce((t,a)=>t+strength(a),0);
function findSite(s,k,R){const b=BLD[k];const base=k==='farm'?s.places.filter(p=>p.k==='village'):k==='oil'?G.dep.filter(d=>ORES[d.k].k==='oil'&&d.known&&d.used<0&&own[d.c]===s.id+1).map(d=>({x:d.x,y:d.y})):s.places;
  for(let t=0;t<40;t++){const p=base[(R()*base.length)|0];if(!p)return null;const r=k==='city'?6000+R()*8000:k==='village'?3500+R()*5000:k==='farm'?500+R()*700:k==='oil'?0:600+R()*(p.k?placeR(p)+800:600);const a=R()*M.PI*2;
    const x=p.x+M.cos(a)*r,y=p.y+M.sin(a)*r;if(canBuild(s,k,x,y)===null)return [x,y]}return null}
function ally(a,b){if(a.allies.includes(b.id))return;if(atWar(a.id,b.id))makePeace(a,b);a.allies.push(b.id);b.allies.push(a.id);dirtyFog=true;toast(`<b>${esc(a.name)}</b> и <b>${esc(b.name)}</b> заключили альянс`,a.flag)}
function offerAlly(s){if(G.offers.includes(s.id))return;G.offers.push(s.id);
  toast(`<b>${esc(s.name)}</b> предлагает вам альянс`,s.flag,[['Принять',()=>{G.offers=G.offers.filter(i=>i!==s.id);ally(player(),s);updDip()}],['Отказать',()=>{G.offers=G.offers.filter(i=>i!==s.id)}]],20000)}
function askAlly(o){const ai=cfg.rules.ai;const p=player();const like=(o.trait==='cautious'?0.75:o.trait==='trader'?0.6:o.trait==='militarist'?0.25:0.45)*(1.3-ai*0.3)*(p.score>=o.score?1.15:0.85);
  if(!atWar(p.id,o.id)&&hsh(o.id,G.t|0)<like){ally(p,o)}else toast(`<b>${esc(o.name)}</b> отклоняет союз`,o.flag);o.asked=G.t;updDip()}

// ---------- simulation tick (game seconds)
function sim(dt){G.t+=dt;
  for(const s of G.states){if(s.dead||!s.places.length)continue;
    for(const q of s.builds)if(!q.done){q.t+=dt;if(q.t>=q.time)finishBuild(s,q)}
    if(s.grow<1&&s.cityId>=0&&s.cap){s.grow=M.min(1,s.grow+dt*0.005*(s.isP?1:[0.6,1,1.6][cfg.rules.botGrowth]));syncGrow(s)}
    for(const p of s.places)if(p.k==='city'&&p.grow<1){p.grow=M.min(1,p.grow+dt*0.008);syncPlace(p)}
    econ(s,dt);for(const a of s.armies){recruit(s,a,dt);stepArmy(s,a,dt)}}
  stepDrones(dt);
  for(const s of G.states){if(s.isP||s.dead||!s.places.length)continue;s._dt=(s._dt||0)+dt;const iv=DIFF[s.diff].dec;if(s._dt>=iv){s._dt-=iv;botThink(s)}}
  G._popT=(G._popT||0)+dt;if(G._popT>2){G._popT=0;updPop();claimAll()}
  for(const d of G.dep)if(!d.known&&own[d.c]===1)d.known=true;
  checkEnd();
  G._asT=(G._asT||0)+dt;if(G._asT>60){G._asT=0;save(true)}}
function checkEnd(){if(G.over||G.phase!=='play')return;const r=cfg.rules,lim=r.timeLimit*60,me=player();const alive=G.states.filter(s=>!s.dead&&s.places.length);
  if(me.dead||!me.places.length)return finish(alive.sort((a,b)=>b.score-a.score)[0]||me,'— ваше государство пало');
  if(alive.length===1)return finish(alive[0],'— единственное государство на карте');
  if(r.victory==='capitals'){const caps=G.states.filter(s=>!s.lostCap&&s.cap);if(caps.length===1&&!caps[0].lostCap)return finish(caps[0],'удержало единственную столицу')}
  const rank=alive.slice().sort((a,b)=>b.score-a.score);
  if(r.victory==='points'){const w=rank.find(s=>s.score>=r.target);if(w)return finish(w,'набрало '+fmt(r.target)+' очков')}
  if(lim>0&&G.t>=lim)return finish(rank[0],'лидирует по очкам к концу лимита времени')}
function finish(w,why){G.over=true;setSpeed(0);const me=player();const won=w===me;
  const rows=G.states.filter(s=>s.cap).slice().sort((a,b)=>b.score-a.score).map((s,i)=>`<div class="rank"><b>${i+1}</b><span class="fl" data-st="${s.id}"></span><span>${esc(s.name)}${s.isP?' (вы)':''}</span><b>${fmt(s.score)}</b></div>`).join('');
  const o=document.getElementById('overc');o.innerHTML=`<h2>${won?'Победа!':'Поражение'}</h2><p class="pv">${esc(w.name)} ${why}</p>${rows}`;
  for(const e of o.querySelectorAll('.fl'))e.replaceWith(flagCanvas(G.states[+e.dataset.st].flag,36,24));
  document.getElementById('over').classList.add('show');save(true)}

// ---------- overlays
function rebuildPol(){if(!polC){polC=document.createElement('canvas');polC.width=N;polC.height=N}const x=polC.getContext('2d'),im=x.createImageData(N,N),d=im.data;
  for(let c=0;c<N*N;c++){const o=own[c];if(!o)continue;const s=G.states[o-1],k=c*4;d[k]=s.rgb[0];d[k+1]=s.rgb[1];d[k+2]=s.rgb[2];d[k+3]=255}x.putImageData(im,0,0);
  // borders: marching squares over each state's indicator field at cell corners (only states that changed, inside their bbox)
  borders=[];for(const s of G.states){if(!s.cells)continue;if(!s._dirty&&s._P){borders.push([s,s._P]);continue}s._dirty=false;const id=s.id+1,SG=[],b=s.bb,i0=M.max(0,b[0]-1),j0=M.max(0,b[1]-1),i1=M.min(N,b[2]+2),j1=M.min(N,b[3]+2);
    const at=(i,j)=>i>=0&&j>=0&&i<N&&j<N&&own[j*N+i]===id?1:0,V=(i,j)=>(at(i-1,j-1)+at(i,j-1)+at(i-1,j)+at(i,j))/4;
    const T=0.49,L=(a,b)=>(T-a)/(b-a);let sx=0,sy=0;
    for(let j=j0;j<j1;j++){let a=V(i0,j),e=V(i0,j+1);for(let i=i0;i<i1;i++){const b=V(i+1,j),c=V(i+1,j+1);if(own[j*N+i]===id){sx+=i;sy+=j}const m=(a>T?8:0)|(b>T?4:0)|(c>T?2:0)|(e>T?1:0);
      if(m!==0&&m!==15){const top=[i+L(a,b),j],rgt=[i+1,j+L(b,c)],bot=[i+L(e,c),j+1],lft=[i,j+L(a,e)];const seg=(p,q)=>{SG.push(p[0],p[1],q[0],q[1])};
        switch(m){case 1:case 14:seg(lft,bot);break;case 2:case 13:seg(bot,rgt);break;case 3:case 12:seg(lft,rgt);break;case 4:case 11:seg(top,rgt);break;case 6:case 9:seg(top,bot);break;case 7:case 8:seg(lft,top);break;
          case 5:seg(lft,top);seg(bot,rgt);break;case 10:seg(top,rgt);seg(lft,bot);break}}a=b;e=c}}
    s.lx=(sx/s.cells+0.5)*CSZ;s.ly=(sy/s.cells+0.5)*CSZ;const LS=chainLines(SG),P=new Path2D();s._L=[];
    for(const pl of LS){const q=new Path2D();let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let k=0;k<pl.length;k+=2){const X=pl[k]*CSZ,Y=pl[k+1]*CSZ;if(k){q.lineTo(X,Y);P.lineTo(X,Y)}else{q.moveTo(X,Y);P.moveTo(X,Y)}x0=M.min(x0,X);y0=M.min(y0,Y);x1=M.max(x1,X);y1=M.max(y1,Y)}s._L.push({P:q,bb:[x0,y0,x1,y1]})}
    s._P=P;borders.push([s,P])}
  dirtyPol=false;dirtyOv=true;bordDirty=true}
// far views: all borders are rasterised into one 2048 x 2048 world layer (64 m per texel) when they change, then blitted
let bordC=null,bordDirty=true,bordT=0;
function rasterBorders(){bordT=performance.now();bordDirty=false;const R=2048;if(!bordC){bordC=document.createElement('canvas');bordC.width=bordC.height=R}const x=bordC.getContext('2d');x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,R,R);
  const k=R/(N*CSZ);x.setTransform(k,0,0,k,0,0);x.lineCap='round';x.lineJoin='round';for(const [s,P] of borders){x.strokeStyle='rgba(6,10,16,0.55)';x.lineWidth=4.6/k;x.stroke(P)}
  for(const [s,P] of borders){x.strokeStyle=s._bc||(s._bc=`rgb(${s.rgb.map(v=>M.min(255,v*1.15+20)|0).join(',')})`);x.lineWidth=2.4/k;x.stroke(P)}}
// marching-squares segments → continuous polylines (shared end points), then rounded off (Chaikin): far fewer
// path pieces to stroke every frame and no staircase of 512 m cells
function chainLines(SG){const key=(x,y)=>M.round(x*1000)+','+M.round(y*1000),ends=new Map(),n=SG.length/4,used=new Uint8Array(n),out=[];
  for(let q=0;q<n;q++)for(const e of [0,1]){const k=key(SG[q*4+e*2],SG[q*4+e*2+1]);let a=ends.get(k);if(!a)ends.set(k,a=[]);a.push(q*2+e)}
  const next=(x,y,skip)=>{const a=ends.get(key(x,y));if(!a)return -1;for(const r of a){const q=r>>1;if(!used[q]&&q!==skip)return r}return -1};
  for(let q0=0;q0<n;q0++){if(used[q0])continue;used[q0]=1;let pl=[SG[q0*4],SG[q0*4+1],SG[q0*4+2],SG[q0*4+3]];
    for(const dir of [1,0]){for(;;){const L=pl.length,x=dir?pl[L-2]:pl[0],y=dir?pl[L-1]:pl[1];const r=next(x,y,-1);if(r<0)break;const q=r>>1,e=r&1;used[q]=1;
        const ox=SG[q*4+(1-e)*2],oy=SG[q*4+(1-e)*2+1];if(dir)pl.push(ox,oy);else pl.unshift(ox,oy)}}
    const closed=pl.length>4&&M.abs(pl[0]-pl[pl.length-2])<1e-6&&M.abs(pl[1]-pl[pl.length-1])<1e-6;
    for(let it=0;it<2;it++){const m=pl.length/2;if(m<3)break;const o=closed?[]:[pl[0],pl[1]];for(let i=0;i<m-1;i++){const ax=pl[i*2],ay=pl[i*2+1],bx=pl[i*2+2],by=pl[i*2+3];o.push(ax*0.75+bx*0.25,ay*0.75+by*0.25,ax*0.25+bx*0.75,ay*0.25+by*0.75)}
      if(closed)o.push(o[0],o[1]);else o.push(pl[pl.length-2],pl[pl.length-1]);pl=o}
    out.push(pl)}return out}
function rebuildFog(){const me=player();const ids=[me.id+1,...me.allies.map(i=>i+1)];vis.fill(0);const R=9,R2=R*R;
  for(let c=0;c<N*N;c++){const o=own[c];if(!o||!ids.includes(o))continue;vis[c]=1;const i=c%N,j=(c/N)|0;
    const edge=i===0||j===0||i===N-1||j===N-1||!ids.includes(own[c-1])||!ids.includes(own[c+1])||!ids.includes(own[c-N])||!ids.includes(own[c+N]);if(!edge)continue;
    for(let b=-R;b<=R;b++)for(let a=-R;a<=R;a++){if(a*a+b*b>R2)continue;const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=N||jj>=N)continue;vis[jj*N+ii]=1}}
  for(let c=0;c<N*N;c++)if(vis[c])expl[c]=1;
  if(!fogC){fogC=document.createElement('canvas');fogC.width=N;fogC.height=N}const x=fogC.getContext('2d'),im=x.createImageData(N,N),d=im.data;
  for(let c=0;c<N*N;c++){const k=c*4;d[k]=7;d[k+1]=12;d[k+2]=20;d[k+3]=vis[c]?0:expl[c]?120:226}x.putImageData(im,0,0);dirtyFog=false;dirtyOv=true}
const fogOn=()=>cfg.rules.fog&&G.phase==='play';
const seenAt=(x,y)=>{if(!fogOn())return true;const c=cellOf(x,y);return c>=0&&expl[c]};
function drawOverlay(ctx,A){if(!G||(G.phase==='play'&&!own))return;const m=A.cam.m,VW=A.VW,VH=A.VH;const X0=A.sxw(0),Y0=A.syw(0),S=W.WORLD/m;
  if(G.phase==='play'){
    if(dirtyPol&&performance.now()-polT>500){polT=performance.now();prf('pol',rebuildPol)}
    if(fogOn()&&dirtyFog&&performance.now()-fogT>500){fogT=performance.now();prf('fog',rebuildFog)}
    if(mapMode!=='off'&&borders&&!DBG.border){ctx.save();ctx.setTransform(A.DPR/m,0,0,A.DPR/m,A.DPR*(VW/2-A.cam.x/m),A.DPR*(VH/2-A.cam.y/m));ctx.lineCap='round';ctx.lineJoin='round';
      const near=m<45,bw=m<5?1.3:2,far=m>50,vx0=A.cam.x-VW/2*m,vy0=A.cam.y-VH/2*m,vx1=A.cam.x+VW/2*m,vy1=A.cam.y+VH/2*m;ctx.globalAlpha=m<5?0.75:1;
      if(far){if(bordDirty&&performance.now()-bordT>700)prf('bord',rasterBorders);ctx.restore();if(bordC){ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(bordC,X0,Y0,S,S);ctx.restore()}}
      else for(const [s,P] of borders){const col=s._bc||(s._bc=`rgb(${s.rgb.map(v=>M.min(255,v*1.15+20)|0).join(',')})`);
        if(far)continue;
        const vis=s._L.filter(l=>l.bb[2]>vx0&&l.bb[0]<vx1&&l.bb[3]>vy0&&l.bb[1]<vy1);if(!vis.length)continue;
        if(near){ctx.strokeStyle='rgba(6,10,16,0.5)';ctx.lineWidth=(bw+2.2)*m;for(const l of vis)ctx.stroke(l.P)}ctx.strokeStyle=col;ctx.lineWidth=bw*m;for(const l of vis)ctx.stroke(l.P)}ctx.restore()}
    // the political fill and the fog are composed into one 256 x 256 layer (only when either changes) and drawn once
    const fa=mapMode==='off'||DBG.fill?0:M.round((mapMode==='res'?0.18:0.42)*smoothst(3.5,26,m)*50)/50,fg=fogOn()&&!DBG.fog;
    if(dirtyOv||fa!==ovFa||fg!==ovFg){dirtyOv=false;ovFa=fa;ovFg=fg;if(!ovC){ovC=document.createElement('canvas');ovC.width=ovC.height=N}const x=ovC.getContext('2d');x.clearRect(0,0,N,N);
      if(fa>0&&polC){x.globalAlpha=fa;x.drawImage(polC,0,0)}x.globalAlpha=1;if(fg&&fogC)x.drawImage(fogC,0,0);ovE=fa>0||fg}
    if(ovE){ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(ovC,X0,Y0,S,S);
      if(fg&&(X0>0||Y0>0||X0+S<VW||Y0+S<VH)){ctx.fillStyle='rgba(7,12,20,0.83)';ctx.beginPath();ctx.rect(-10,-10,VW+20,VH+20);ctx.rect(X0+0.5,Y0+0.5,S-1,S-1);ctx.fill('evenodd')}ctx.restore()}
    if(!DBG.dep)drawDeposits(ctx,A);if(!DBG.caps)drawCaps(ctx,A);if(mapMode!=='off'&&!DBG.names)drawNames(ctx,A)}
  if(G.phase==='found'){drawDeposits(ctx,A);drawPlacement(ctx,A)}}
function smoothst(a,b,x){let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t)}
// state names: each label is rendered once into its own canvas (per size step) and then just blitted
const NAMEC=new Map();
function nameCanvas(s,sz){const key=s.id+'|'+s.name+'|'+sz;let c=NAMEC.get(key);if(c)return c;if(NAMEC.size>80)NAMEC.clear();
  const t=s.name.toUpperCase(),d=M_DPR(),x0=document.createElement('canvas').getContext('2d');x0.font=`700 ${sz}px system-ui,Segoe UI,sans-serif`;const sp=sz*0.18;const ws=[...t].map(ch=>x0.measureText(ch).width);
  const w=ws.reduce((a,b)=>a+b,0)+sp*(t.length-1),pad=M.ceil(sz*0.2)+2;c=document.createElement('canvas');c.width=M.ceil((w+pad*2)*d);c.height=M.ceil((sz*1.4+pad*2)*d);c.lw=w+pad*2;c.lh=sz*1.4+pad*2;
  const x=c.getContext('2d');x.scale(d,d);x.font=x0.font;x.textBaseline='middle';x.textAlign='center';x.lineJoin='round';x.lineWidth=M.max(2,sz*0.12);x.strokeStyle='rgba(6,10,16,0.6)';
  x.fillStyle=`rgb(${s.rgb.map(v=>M.min(255,v*0.5+128)|0).join(',')})`;let px=pad;for(let i=0;i<t.length;i++){x.strokeText(t[i],px+ws[i]/2,c.lh/2);x.fillText(t[i],px+ws[i]/2,c.lh/2);px+=ws[i]+sp}
  NAMEC.set(key,c);return c}
function drawNames(ctx,A){const m=A.cam.m;if(m<22)return; // close up the town names and buildings speak for themselves
  for(const [s] of borders||[]){if(!s.cells||!seenAt(s.lx,s.ly))continue;const raw=M.sqrt(s.cells)*CSZ*0.2/m;if(raw<11||raw>140)continue;const sz=M.round(raw/3)*3,a=M.min(1,(raw-11)/8)*M.min(1,(140-raw)/40)*0.9;
    const X=A.sxw(s.lx);let Y=A.syw(s.ly);if(s.cap&&M.abs(A.sxw(s.cap.x)-X)<sz*4&&M.abs(A.syw(s.cap.y)-Y)<sz*1.4+14)Y=A.syw(s.cap.y)+sz*1.1+16;
    const c=nameCanvas(s,sz);ctx.globalAlpha=a;ctx.drawImage(c,X-c.lw/2,Y-c.lh/2,c.lw,c.lh)}ctx.globalAlpha=1}
function drawCaps(ctx,A){const m=A.cam.m;if(m<3)return;for(const s of G.states){if(!s.cap||!seenAt(s.cap.x,s.cap.y))continue;const X=A.sxw(s.cap.x),Y=A.syw(s.cap.y)-(m>9?26:38);
    if(X<-40||Y<-40||X>A.VW+40||Y>A.VH+40)continue;const f=s._fc||(s._fc=flagCanvas(s.flag,30,20));
    ctx.fillStyle='rgba(6,10,16,0.55)';ctx.fillRect(X-17,Y-12,34,24);ctx.drawImage(f,X-15,Y-10,30,20);ctx.strokeStyle=s.isP?'#ffd25a':'rgba(255,255,255,0.55)';ctx.lineWidth=s.isP?2:1;ctx.strokeRect(X-15.5,Y-10.5,31,21);
    ctx.fillStyle=s.isP?'#ffd25a':'#fff';star(ctx,X,Y+16,5.5)}}
function star(ctx,x,y,r){ctx.beginPath();for(let i=0;i<10;i++){const a=-M.PI/2+i*M.PI/5,rr=i%2?r*0.45:r;ctx.lineTo(x+M.cos(a)*rr,y+M.sin(a)*rr)}ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=1;ctx.stroke()}
function oreIcon(k){if(ICONS['o'+k])return ICONS['o'+k];const S=28,d=M_DPR(),c=document.createElement('canvas');c.width=S*d;c.height=S*d;const x=c.getContext('2d');x.scale(d,d);const o=ORES[k];
  const g=x.createRadialGradient(S/2-3,S/2-4,2,S/2,S/2,S/2);g.addColorStop(0,'#3a4250');g.addColorStop(1,'#151a22');x.fillStyle=g;x.beginPath();x.arc(S/2,S/2,S/2-1.5,0,M.PI*2);x.fill();x.strokeStyle=o.c;x.lineWidth=2;x.stroke();
  x.fillStyle=o.c;x.strokeStyle=o.c;const C=S/2;x.lineWidth=1.6;
  switch(o.k){case 'oil':x.beginPath();x.moveTo(C,C-8);x.bezierCurveTo(C+7,C,C+6,C+7,C,C+7);x.bezierCurveTo(C-6,C+7,C-7,C,C,C-8);x.fillStyle='#e8e8e8';x.fill();break;
    case 'gas':x.beginPath();x.moveTo(C,C-8);x.bezierCurveTo(C+8,C-1,C+5,C+8,C,C+7);x.bezierCurveTo(C-5,C+8,C-8,C,C-2,C-3);x.bezierCurveTo(C-1,C,C+1,C,C,C-8);x.fill();break;
    case 'coal':x.beginPath();x.moveTo(C-7,C+4);x.lineTo(C-4,C-5);x.lineTo(C+3,C-6);x.lineTo(C+7,C+1);x.lineTo(C+3,C+6);x.closePath();x.fillStyle='#9a9aa2';x.fill();break;
    case 'uran':for(let i=0;i<3;i++){const a=-M.PI/2+i*M.PI*2/3;x.beginPath();x.moveTo(C,C);x.arc(C,C,7.5,a-0.5,a+0.5);x.closePath();x.fill()}x.fillStyle='#151a22';x.beginPath();x.arc(C,C,2.2,0,7);x.fill();x.fillStyle=o.c;x.beginPath();x.arc(C,C,1.3,0,7);x.fill();break;
    case 'lith':x.strokeRect(C-4,C-6,8,13);x.fillRect(C-2,C-8,4,2);x.fillRect(C-2.5,C,5,5);break;
    default:x.beginPath();x.moveTo(C-8,C+4);x.lineTo(C-5,C-3);x.lineTo(C+8,C-3);x.lineTo(C+5,C+4);x.closePath();x.fill();x.fillStyle='rgba(255,255,255,0.35)';x.fillRect(C-4,C-2,10,1.6)}
  return ICONS['o'+k]=c}
function drawDeposits(ctx,A){const m=A.cam.m,fd=G.phase==='found';if(!fd&&(mapMode==='off'||(mapMode==='pol'&&m>40)))return;const z=mapMode==='res'||fd?1:smoothst(40,18,m);if(z<=0.02)return;ctx.globalAlpha=z;
  for(const d of G.dep){if(!d.known)continue;const X=A.sxw(d.x),Y=A.syw(d.y);if(X<-20||Y<-20||X>A.VW+20||Y>A.VH+20)continue;
    const sz=mapMode==='res'?24:20;const ic=oreIcon(d.k);ctx.globalAlpha=z*(d.amt<=0?0.35:1);ctx.drawImage(ic,X-sz/2,Y-sz/2,sz,sz);
    if(d.max!==Infinity&&mapMode==='res'){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(X-10,Y+sz/2+1,20,3);ctx.fillStyle=ORES[d.k].c;ctx.fillRect(X-10,Y+sz/2+1,20*d.amt/d.max,3)}
    const o=own?own[d.c]:0;if(o&&mapMode==='res'){ctx.fillStyle=G.states[o-1].color;ctx.beginPath();ctx.arc(X+sz/2-3,Y-sz/2+3,3.5,0,7);ctx.fill()}}ctx.globalAlpha=1}
function drawPlacement(ctx,A){if(pend){const X=A.sxw(pend.x),Y=A.syw(pend.y),r=M.max(12,2900/A.cam.m),q=(A.T*1.2)%1;ctx.save();ctx.strokeStyle='rgba(255,210,90,0.95)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(X,Y,r,0,M.PI*2);ctx.stroke();
    ctx.globalAlpha=1-q;ctx.beginPath();ctx.arc(X,Y,r*(1+q*0.8),0,M.PI*2);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle='#ffd25a';star(ctx,X,Y,7);ctx.restore();return}
  if(!placing||!A.hover.on)return;const [x,y]=A.toWorld(A.hover.x,A.hover.y);const bad=validSite(x,y);const r=2900/A.cam.m;const X=A.hover.x,Y=A.hover.y;
  ctx.save();ctx.textAlign='left';ctx.strokeStyle=bad?'rgba(255,107,90,0.95)':'rgba(255,210,90,0.95)';ctx.fillStyle=bad?'rgba(255,107,90,0.12)':'rgba(255,210,90,0.12)';ctx.lineWidth=2;ctx.setLineDash([10,7]);ctx.lineDashOffset=-A.T*24;
  ctx.beginPath();ctx.arc(X,Y,M.max(10,r),0,M.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(X-8,Y);ctx.lineTo(X+8,Y);ctx.moveTo(X,Y-8);ctx.lineTo(X,Y+8);ctx.stroke();
  const t=bad||'Основать столицу здесь';ctx.font='600 12px system-ui,sans-serif';const w=ctx.measureText(t).width+16;ctx.fillStyle='rgba(10,15,23,0.85)';ctx.fillRect(X+14,Y+12,w,22);ctx.fillStyle=bad?'#ff9c8e':'#ffd25a';ctx.textBaseline='middle';ctx.fillText(t,X+22,Y+23);ctx.restore()}
function drawMini(mx,s){if(!G||G.phase!=='play'||!own)return;const S=W.WORLD*s;if(polC){mx.globalAlpha=0.55;mx.imageSmoothingEnabled=true;mx.drawImage(polC,0,0,S,S);mx.globalAlpha=1}if(fogOn()&&fogC)mx.drawImage(fogC,0,0,S,S);
  for(const st of G.states){if(!st.cap||!seenAt(st.cap.x,st.cap.y))continue;mx.fillStyle=st.isP?'#ffd25a':'#fff';mx.fillRect(st.cap.x*s-2,st.cap.y*s-2,4,4)}}

// ---------- HUD and panels
const $=id=>document.getElementById(id);
function setSpeed(v){G.speed=v;if(v)G._lastSp=v;$('bpause').classList.toggle('on',v===0);$('bpause').className='bb-btn'+(v===0?' on':'');$('bpause').innerHTML=`<span class="ic ${v===0?'ic-play':'ic-pause'}"></span>`;$('bspeed').textContent='×'+(v||G._lastSp||1);if(api)api.setTodRate(v*4/60)}
function gameClock(){const mins=8*60+G.t*4;const d=M.floor(mins/1440)+1,h=M.floor(mins/60)%24,mm=M.floor(mins)%60;return `День ${d} · ${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`}
const fmtT=s=>{s=M.round(s);const h=M.floor(s/3600),m=M.floor(s/60)%60,ss=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(ss).padStart(2,'0')};
const sgn=v=>(v>=0?'+':'−')+fmtK(M.abs(v));
function updHUD(){const p=player(),r=p.res,f=p.flow||{};
  $('rmoney-v').textContent=fmtK(r.money);const inc=$('rinc-v');inc.textContent=(r.money===Infinity?'∞':sgn(p.income||0))+'/с';inc.className=(p.income||0)>=0?'pos':'neg';
  for(const k of RES){$('r'+k+'-v').textContent=fmtK(r[k]);const e=$('r'+k+'-f');const v=f[k]||0;e.textContent=M.abs(v)<0.05?'':sgn(v);e.className=v>0.05?'pos':v<-0.05?'neg':''}
  const en=p.energy||[0,0];$('renergy-v').textContent=fmt(en[0]);const ee=$('renergy-f');ee.textContent=en[1]?'/ '+fmt(en[1]):'';ee.className=en[1]>en[0]?'neg':'';
  $('rpop-v').textContent=fmtK(p.pop);$('gclock').textContent=gameClock();
  const lim=cfg.rules.timeLimit*60;$('glimit').textContent=(lim>0?'осталось '+fmtT(M.max(0,lim-G.t)):'без лимита')+' · '+fmt(p.score)+' очков';
  updPanel();updCatalog()}
let panelSig='';
function updPanel(){const el=$('gpanel');const p=player();
  if(G.phase==='found'){const sig='found'+placing;if(sig===panelSig)return;panelSig=sig;
    el.innerHTML=`<div class="gp-h">Первый шаг</div><button class="act${placing?' armed':''}" id="a-found"><span class="ic ic-capital"></span><span><b>Основать столицу</b><small>${placing?'Кликните по карте, где стоять столице':'Выберите место на карте'}</small></span>${placing?'<span class="btn ax" id="a-found-x">✕</span>':''}</button>
      <p class="note">Хорошее место: равнина у реки или моря, подальше от края мира. Боты выберут свои столицы одновременно с вами.</p>`;
    $('a-found').onclick=e=>{if(e.target.id==='a-found-x'){setPlacing(false);return}setPlacing(!placing)};return}
  const a=G.sel&&G.sel.army;if(a){armyPanel(el,a);return}
  const sb=G.sel&&G.sel.build;if(sb){buildPanel(el,sb);return}
  if(panelSig!=='state'){panelSig='state';
    el.innerHTML=`<div class="gp-h">${esc(p.gov)} ${esc(p.name)}</div>`+['Столица','Население','Города и сёла','Постройки','Армии','Войны'].map((n,i)=>`<div class="stat"><span>${n}</span><b data-v="${i}"></b></div>`).join('')+
      `<div class="gp-h" style="margin-top:12px">Стройка</div><div id="gp-q"></div><button class="btn sm" id="a-home" style="width:100%;margin-top:8px">Перейти к столице</button>`;
    $('a-home').onclick=()=>{const q=p.places[0];if(q)api.flyTo(q.x,q.y,3)}}
  const wars=G.states.filter(t=>atWar(p.id,t.id)).map(t=>t.name);
  const v=[esc(p.capital)+' · '+M.round(p.grow*100)+' %',fmtK(p.pop),p.places.length,p.builds.filter(q=>q.done).length,p.armies.length?p.armies.map(a=>'№'+a.n+' ('+a.units.length+')').join(', '):'нет',wars.length?wars.join(', '):'нет'];
  for(const e of el.querySelectorAll('[data-v]'))e.textContent=v[+e.dataset.v];
  const qs=p.builds.filter(q=>!q.done);$('gp-q').innerHTML=qs.length?qs.map(q=>`<div class="stat"><span>${BLD[q.k].n}</span><b>${M.round(q.t/q.time*100)} %</b></div>`).join(''):'<p class="note" style="margin:0">Ничего не строится. Постройки — на панели внизу.</p>'}
function armyPanel(el,a){const p=player();const sig='army'+a.id+'|'+a.tpl+'|'+a.units.join('')+'|'+(G.mode||'')+'|'+atWarAny();
  const comp={};for(const u of a.units)comp[u]=(comp[u]||0)+1;
  if(sig!==panelSig){panelSig=sig;
    let h=`<div class="gp-h">Армия №${a.n}<button class="btn sm ghost" id="a-close" style="float:right;padding:0 6px">✕</button></div>
      <div class="stat"><span>Бойцов</span><b>${a.units.length} / 12</b></div><div class="stat"><span>Сила</span><b>${fmt(strength(a))}</b></div>
      <div class="stat"><span>Состав</span><b>${Object.entries(comp).map(([u,n])=>UNIT[u].n+' '+n).join(', ')||'—'}</b></div>
      <div class="gp-h" style="margin-top:10px">Сборка${a.tpl?': '+TPL[a.tpl].n:''}</div><div class="tpls">`+Object.entries(TPL).map(([k,t])=>`<button class="btn sm${a.tpl===k?' on':''}" data-tpl="${k}" title="${Object.entries(t.u).map(([u,n])=>UNIT[u].n+' '+n).join(', ')}">${t.n}</button>`).join('')+`</div>
      <p class="note">Бойцы набираются по одному раз в 4 с, пока хватает денег (пехота 60 … танк 260).</p>
      <button class="btn sm${G.mode==='move'?' on':''}" id="a-move" style="width:100%;margin-top:6px">${G.mode==='move'?'Кликните по карте — куда идти':'Двигаться (клик по карте)'}</button>
      <button class="btn sm${G.mode==='drone'?' on':''}" id="a-drone" style="width:100%;margin-top:6px" ${atWarAny()?'':'disabled'}>${G.mode==='drone'?'Кликните по цели на вражеской земле':'Удар дронами · 300'}</button>
      <button class="btn sm" id="a-go" style="width:100%;margin-top:6px">Показать армию</button>`;
    el.innerHTML=h;$('a-close').onclick=()=>{G.sel=null;G.mode=null;panelSig=''};
    for(const b of el.querySelectorAll('[data-tpl]'))b.onclick=()=>{a.tpl=b.dataset.tpl;panelSig='';updPanel();onBuilt('assembly',true)};
    $('a-move').onclick=()=>{G.mode=G.mode==='move'?null:'move';panelSig=''};$('a-drone').onclick=()=>{G.mode=G.mode==='drone'?null:'drone';panelSig=''};
    $('a-go').onclick=()=>api.flyTo(a.x,a.y,4)}}
function buildPanel(el,q){const b=BLD[q.k],sig='b'+q.id+'|'+(q.off>0);if(sig===panelSig)return;panelSig=sig;
  const pr=b.prod?Object.entries(b.prod).map(([k,v])=>RESN[k]+' +'+v).join(', '):'—',nd=b.need?Object.entries(b.need).map(([k,v])=>RESN[k]+' '+v).join(', '):'—';
  el.innerHTML=`<div class="gp-h">${b.n}<button class="btn sm ghost" id="a-close" style="float:right;padding:0 6px">✕</button></div><p class="note" style="margin-top:0">${b.d}</p>
    <div class="stat"><span>Даёт в секунду</span><b>${pr}</b></div><div class="stat"><span>Нужно</span><b>${nd}</b></div><div class="stat"><span>Состояние</span><b>${q.off>0?'не работает '+M.ceil(q.off)+' с':'работает'}</b></div>
    ${q.k==='barracks'?'<button class="btn sm" id="a-army" style="width:100%;margin-top:8px">Армия этой части</button>':''}<button class="btn sm danger" id="a-dem" style="width:100%;margin-top:8px">Снести · вернётся ${fmt(b.cost*0.3)}</button>`;
  $('a-close').onclick=()=>{G.sel=null;panelSig=''};$('a-dem').onclick=()=>{demolish(player(),q);G.sel=null;panelSig='';updHUD()};
  const ab=$('a-army');if(ab)ab.onclick=()=>{const a=player().armies.find(x=>x.home===q);if(a){G.sel={army:a};panelSig=''}}}
const atWarAny=()=>G.states.some(t=>atWar(0,t.id));
// bottom panel (as in DroneFlames): pause / speed and the clock on the left; tabs КАРТА ГОРОДА УДАР ПВО АРМИЯ ПОЛИТ. ФЛОТ over a row of cards
const TABS=[['map','Карта'],['cities','Города'],['strike','Удар'],['aa','ПВО'],['army','Армия'],['pol','Полит.'],['fleet','Флот']];
const ECON=['village','farm','factory','power','sawmill','oil','refinery','port','city'];
const tabOf=k=>k==='sam'?'aa':k==='barracks'||k==='assembly'?'army':ECON.includes(k)?'cities':null;
let tab='cities',tabSig='';
function buildTabs(){const t=$('bb-tabs');t.innerHTML='';TABS.forEach(([k,n],i)=>{const b=document.createElement('button');b.dataset.t=k;b.innerHTML=`<i>${i+1}</i>${n}`;b.onclick=()=>setTab(k);t.appendChild(b)})}
function setTab(k){tab=k;tabSig='';updCatalog()}
const card=(o)=>`<button class="bcat${o.cls?' '+o.cls:''}" ${o.data||''} ${o.dis?'disabled':''} title="${esc(o.tip||'')}"><span class="ic ${o.ic}"></span><b>${o.n}</b><small>${o.sub||''}</small></button>`;
function tabCards(){const p=player(),out=[];
  if(tab==='map'){out.push(card({n:'Государства',sub:'границы',ic:'ic-land',data:'data-m="pol"',cls:mapMode==='pol'?'on':''}),card({n:'Ресурсы',sub:'месторождения',ic:'ic-ore',data:'data-m="res"',cls:mapMode==='res'?'on':''}),card({n:'Местность',sub:'без слоёв',ic:'ic-new',data:'data-m="off"',cls:mapMode==='off'?'on':''}),
    card({n:'К столице',sub:esc(p.capital),ic:'ic-capital',data:'data-go="cap"'}),card({n:'Весь мир',sub:'131 × 131 км',ic:'ic-star',data:'data-go="world"'}))}
  else if(tab==='cities'){for(const k of ECON){const b=BLD[k];out.push(card({n:b.n,sub:fmt(b.cost),ic:'ic-b-'+k,data:`data-k="${k}"`,tip:b.d}))}out.push(card({n:'Снести',sub:'30 % назад',ic:'ic-b-demolish',data:'data-mode="demolish"',tip:'Кликните по своей постройке, чтобы снести её'}))}
  else if(tab==='strike'){const war=atWarAny(),base=p.builds.some(q=>q.done&&q.k==='barracks');const why=!base?'нужна военная часть':!war?'нет войны':'';
    out.push(card({n:'Ударный дрон',sub:why||'300',ic:'ic-b-drone',data:'data-mode="drone"',dis:!!why,tip:'Кликните по цели на земле противника'}),card({n:'Рой дронов',sub:why||'800 · 3 шт.',ic:'ic-b-swarm',data:'data-mode="swarm"',dis:!!why,tip:'Три дрона по одной цели: ПВО не успевает сбить всех'}))}
  else if(tab==='aa'){out.push(card({n:'ПВО',sub:fmt(BLD.sam.cost),ic:'ic-b-sam',data:'data-k="sam"',tip:BLD.sam.d}));p.builds.filter(q=>q.k==='sam').forEach((q,i)=>out.push(card({n:'ПВО №'+(i+1),sub:!q.done?'строится':q.off>0?'подавлена':'на дежурстве',ic:'ic-b-sam',data:`data-fly="${q.x|0},${q.y|0}"`})))}
  else if(tab==='army'){out.push(card({n:'Военная часть',sub:fmt(BLD.barracks.cost),ic:'ic-b-barracks',data:'data-k="barracks"',tip:BLD.barracks.d}));
    p.armies.forEach((a,i)=>out.push(card({n:'Армия №'+a.n,sub:a.units.length+'/12 · '+(a.tpl?TPL[a.tpl].n:'без сборки'),ic:'ic-b-army',data:`data-army="${i}"`,cls:G.sel&&G.sel.army===a?'on':''})))}
  else if(tab==='pol'){for(const t of G.states){if(t.isP||!t.places.length)continue;const rel=p.allies.includes(t.id)?'союзник':atWar(p.id,t.id)?'война':'мир';out.push(card({n:esc(t.name),sub:rel,ic:'fl-'+t.id,data:`data-st="${t.id}"`,cls:rel==='война'?'war':rel==='союзник'?'ally':''}))}
    out.push(card({n:'Дипломатия',sub:'все государства',ic:'ic-dip',data:'data-go="dip"'}))}
  else if(tab==='fleet'){const ports=p.builds.filter(q=>q.done&&q.k==='port').length;out.push(card({n:'Верфь',sub:'следующий этап',ic:'ic-b-port',dis:true,tip:'Флот появится на следующем этапе. Для него нужен порт'}),card({n:'Порты',sub:ports?ports+' шт.':'нет',ic:'ic-b-port',data:'data-tab="cities"'}))}
  return out.join('')}
function updCatalog(){if(!G||G.phase!=='play')return;const p=player(),el=$('bb-cat');const hk=HINTS[hintStep]&&HINTS[hintStep][1];
  for(const b of $('bb-tabs').children){b.classList.toggle('on',b.dataset.t===tab);b.classList.toggle('pulse',tabOf(hk)===b.dataset.t&&tab!==b.dataset.t)}
  const sig=tab+'|'+tabCards();if(sig!==tabSig){tabSig=sig;el.innerHTML=tabCards();
    for(const e of el.querySelectorAll('[class*="fl-"]')){const id=+[...e.classList].find(c=>c.startsWith('fl-')).slice(3);e.appendChild(flagCanvas(G.states[id].flag,26,17))}
    for(const e of el.children)e.onclick=()=>cardClick(e)}
  for(const e of el.children){const k=e.dataset.k;if(k){e.classList.toggle('on',G.build===k);e.classList.toggle('poor',p.res.money<BLD[k].cost&&!creative());e.classList.toggle('pulse',hk===k||(hk==='defense'&&(k==='sam'||k==='barracks')&&!p.builds.some(q=>q.k===k)))}
    if(e.dataset.mode)e.classList.toggle('on',G.mode===e.dataset.mode)}}
function cardClick(e){const d=e.dataset,p=player();
  if(d.k)return setBuild(G.build===d.k?null:d.k);
  if(d.m){mapMode=d.m;updModes();tabSig='';return updCatalog()}
  if(d.mode){setBuild(null);G.mode=G.mode===d.mode?null:d.mode;if(G.mode==='drone'||G.mode==='swarm')toast('Кликните по цели на земле противника');if(G.mode==='demolish')toast('Кликните по своей постройке, чтобы снести её');return updCatalog()}
  if(d.go==='cap'){const q=p.places[0];if(q)api.flyTo(q.x,q.y,3);return}if(d.go==='world')return api.flyTo(W.WORLD/2,W.WORLD/2,api.maxM()*0.9);
  if(d.go==='dip'){$('dip').classList.add('show');updDip();return}
  if(d.fly){const [x,y]=d.fly.split(',').map(Number);return api.flyTo(x,y,3)}
  if(d.army!=null){const a=p.armies[+d.army];G.sel={army:a};G.mode=null;panelSig='';updPanel();api.flyTo(a.x,a.y,M.min(api.cam.m,8));return updCatalog()}
  if(d.st!=null){$('dip').classList.add('show');updDip();return}
  if(d.tab)return setTab(d.tab)}
function setBuild(k){if(!G||G.phase!=='play')return;G.build=k;if(k)G.mode=null;document.body.classList.toggle('placing',!!k);if(k){const t=tabOf(k);if(t&&t!==tab)setTab(t)}updCatalog()}
function setPlacing(v){placing=v;document.body.classList.toggle('placing',v);panelSig='';updPanel();if(v)hint(1);closeConfirm()}
function closeConfirm(){$('confirm').classList.remove('show');pend=null}
function openConfirm(x,y,sx,sy){pend={x,y};const c=$('confirm');$('cft').textContent='Основать столицу здесь?';const e=W.landE(x,y,0);
  $('cfs').innerHTML=`Высота ${M.round(e*2600)} м<br>Город вырастет здесь сам, к соседям проложат магистрали`;
  c.style.left=M.min(innerWidth-130,M.max(130,sx))+'px';c.style.top=M.max(150,sy)+'px';c.classList.add('show')}
function toast(html,fl,btns,ms){const t=document.createElement('div');t.className='toast';if(fl)t.appendChild(flagCanvas(fl,30,20));const b=document.createElement('div');b.innerHTML=html;t.appendChild(b);
  if(btns){const r=document.createElement('div');r.className='tb';for(const [n,f] of btns){const q=document.createElement('button');q.className='btn sm';q.textContent=n;q.onclick=()=>{f();kill()};r.appendChild(q)}b.appendChild(r)}
  const box=$('toasts');box.prepend(t);while(box.children.length>5)box.lastChild.remove();const kill=()=>{t.classList.add('out');setTimeout(()=>t.remove(),400)};setTimeout(kill,ms||6500)}
// hints: the step-by-step guide; [text, what finishes the step]
const HINTS=[
  ['Выберите место для <b>столицы</b>: нажмите «Основать столицу» слева или просто кликните по карте','found'],
  ['Кликните по карте там, где будет столица. Красный круг — место не подходит. <b>Esc</b> или ✕ — отмена','found'],
  ['Столица основана! Внизу — панель управления: слева пауза и скорость, справа вкладки. Во вкладке <b>Города</b> поставьте <b>Село</b> рядом со столицей','village'],
  ['Поставьте в селе <b>Колхоз</b>: еда и немного денег. Колхоз — только в области села','farm'],
  ['<b>Завод товаров</b> — главный доход. Ставится рядом с городом, ему нужна энергия','factory'],
  ['Заводу нужна энергия: постройте <b>ТЭЦ</b>','power'],
  ['<b>Лесопилка</b> — древесина и деньги. Ставится у леса','sawmill'],
  ['<b>Нефтевышка</b> — на месторождении нефти (чёрное пятно на земле; вкладка «Карта» → «Ресурсы» покажет все месторождения)','oil'],
  ['<b>НПЗ</b> перерабатывает нефть в топливо и деньги','refinery'],
  ['<b>Порт</b> на берегу продаёт излишки за рубеж, привозит нехватку и даёт +800 к складу','port'],
  ['Расширяйтесь: поставьте <b>новый город</b> — он вырастет сам и принесёт налоги и земли','city'],
  ['Защита: <b>Военная часть</b> (вкладка «Армия», армия до 12 бойцов) и <b>ПВО</b> (вкладка «ПВО», сбивает вражеские дроны). Боты могут начать войну не раньше 10–12 минуты','defense'],
  ['Кликните по военной части или по значку армии на карте: «Армия №1», выберите <b>Сборку</b> — состав армии','assembly'],
  ['Армия выбрана: «Двигаться» и клик по карте — приказ. Вкладка <b>Полит.</b> — альянсы, война и мир, <b>Удар</b> — дроны. <b>Пробел</b> — пауза, <b>F</b> — скорость, <b>1–7</b> — вкладки, <b>Esc</b> — меню','end']];
function hint(i){if(hintsOff&&!tutorial)return;if(i<hintStep&&i!==0)return;
  // steps already done (built out of order) are skipped
  if(G&&G.phase==='play')while(HINTS[i]&&stepDone(HINTS[i][1]))i++;hintStep=i;const h=HINTS[i];if(!h)return hideHint();$('hintn').textContent=i+1;$('hintt').innerHTML=h[0];$('hint').classList.add('show');if(G&&G.phase==='play')updCatalog()}
function hideHint(){$('hint').classList.remove('show')}
function stepDone(k){const p=player();if(!p)return false;if(k==='defense')return p.builds.some(q=>q.k==='barracks')&&p.builds.some(q=>q.k==='sam');if(k==='assembly')return p.armies.some(a=>a.tpl);if(k==='end'||k==='found')return false;return p.builds.some(q=>q.k===k)}
// a placed / finished building moves the guide on
function onBuilt(k,done){const h=HINTS[hintStep];if(!h)return;const p=player();
  if(h[1]==='defense'){if(p.builds.some(q=>q.k==='barracks')&&p.builds.some(q=>q.k==='sam'))hint(hintStep+1);return}
  if(h[1]===k)hint(hintStep+1)}
function updDip(){const b=$('dipb');if(!$('dip').classList.contains('show')||!G)return;const p=player();let h='';
  for(const s of G.states){if(!s.places.length&&!s.dead)continue;const ally=p.allies.includes(s.id),war=atWar(p.id,s.id);
    h+=`<div class="dst"><span class="fl" data-st="${s.id}"></span><div><b>${esc(s.name)}${s.isP?' (вы)':''}${s.dead?' — пало':''}</b><small>${esc(s.gov)} · ${esc(s.capital)}${s.isP?'':' · '+TRAITS[s.trait]+' · '+DIFF[s.diff].n.toLowerCase()}</small><small>${fmt(s.score)} очков · ${fmtK(s.pop)} чел. · армия ${fmt(strengthOf(s))}</small></div>`+
      (s.isP?'<span></span>':`<span class="rel${ally?' ally':war?' war':''}">${ally?'Союзник':war?'Война':'Мир'}</span>`)+`<div class="acts">`+
      (s.isP||s.dead?'':war?`<button class="btn sm" data-peace="${s.id}" ${s.asked&&G.t-s.asked<60?'disabled':''}>Предложить мир</button>`:`${cfg.rules.alliances&&!ally?`<button class="btn sm" data-ally="${s.id}" ${s.asked&&G.t-s.asked<60?'disabled':''}>Альянс</button>`:''}${ally?'':`<button class="btn sm danger" data-war="${s.id}">Объявить войну</button>`}`)+
      `<button class="btn sm" data-go="${s.id}">Показать</button></div></div>`}
  if(h===b._h)return;b._h=h;b.innerHTML=h;for(const e of b.querySelectorAll('.fl'))e.replaceWith(flagCanvas(G.states[+e.dataset.st].flag,38,25));
  for(const e of b.querySelectorAll('[data-ally]'))e.onclick=()=>askAlly(G.states[+e.dataset.ally]);
  for(const e of b.querySelectorAll('[data-war]'))e.onclick=()=>declareWar(p,G.states[+e.dataset.war]);
  for(const e of b.querySelectorAll('[data-peace]'))e.onclick=()=>askPeace(G.states[+e.dataset.peace]);
  for(const e of b.querySelectorAll('[data-go]'))e.onclick=()=>{const s=G.states[+e.dataset.go];const q=s.places[0];if(q)api.flyTo(q.x,q.y,6)}}
function updModes(){tabSig=''}

// ---------- map objects: construction sites, build preview, armies, drones, hits
function drawObjects(ctx,A){const m=A.cam.m,T=A.T;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const s of G.states)for(const q of s.builds){if(q.done||!seenAt(q.x,q.y))continue;const X=A.sxw(q.x),Y=A.syw(q.y);if(X<-40||Y<-40||X>A.VW+40||Y>A.VH+40)continue;const b=BLD[q.k],r=M.max(9,M.min(60,(b.R||M.hypot(b.W,b.H)/2)/m));
    ctx.fillStyle='rgba(10,15,23,0.55)';ctx.beginPath();ctx.arc(X,Y,r,0,7);ctx.fill();ctx.strokeStyle=s.isP?'#ffd25a':s.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,r,-M.PI/2,-M.PI/2+M.PI*2*q.t/q.time);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.lineDashOffset=-T*10;ctx.beginPath();ctx.arc(X,Y,r+5,0,7);ctx.stroke();ctx.setLineDash([]);
    const ic=bIcon(q.k);ctx.drawImage(ic,X-11,Y-11,22,22)}
  for(const s of G.states)for(const a of s.armies){if(!a.units.length||!seenAt(a.x,a.y))continue;const X=A.sxw(a.x),Y=A.syw(a.y);if(X<-40||Y<-40||X>A.VW+40||Y>A.VH+40)continue;const sel=G.sel&&G.sel.army===a;
    if(a.tx!==null&&(s.isP||sel)){ctx.strokeStyle=s.isP?'rgba(255,210,90,0.8)':'rgba(255,107,90,0.8)';ctx.lineWidth=2;ctx.setLineDash([7,6]);ctx.lineDashOffset=-T*25;ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(A.sxw(a.tx),A.syw(a.ty));ctx.stroke();ctx.setLineDash([])}
    if(a.fight){for(let k=0;k<3;k++){const f=(T*3+k*0.33)%1;ctx.fillStyle=`rgba(255,${160+k*30},60,${1-f})`;ctx.beginPath();ctx.arc(X+M.sin(T*9+k)*12,Y+M.cos(T*7+k)*9,3+f*6,0,7);ctx.fill()}}
    armyToken(ctx,s,a,X,Y,sel)}
  for(const d of G.drones){const X=A.sxw(d.x),Y=A.syw(d.y);if(X<-20||Y<-20||X>A.VW+20||Y>A.VH+20)continue;const h=M.atan2(d.ty-d.y,d.tx-d.x);ctx.save();ctx.translate(X,Y);ctx.rotate(h);
    ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(-26,0);ctx.stroke();ctx.fillStyle='#20242a';ctx.strokeStyle='#ff6b5a';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-6);ctx.lineTo(-3,0);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
  for(const f of G.fx){const X=A.sxw(f.x),Y=A.syw(f.y),k=f.t/1.2;if(f.k==='boom'){ctx.fillStyle=`rgba(255,${200-k*140|0},80,${1-k})`;ctx.beginPath();ctx.arc(X,Y,4+k*22,0,7);ctx.fill();ctx.strokeStyle=`rgba(255,240,200,${1-k})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(X,Y,8+k*34,0,7);ctx.stroke()}
    else if(k<0.4){ctx.strokeStyle=`rgba(255,240,160,${1-k*2.5})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(A.sxw(f.x2),A.syw(f.y2));ctx.stroke()}}
  // build preview
  if(G.build&&A.hover.on){const [x,y]=A.toWorld(A.hover.x,A.hover.y),k=G.build,b=BLD[k],bad=canBuild(player(),k,x,y),X=A.hover.x,Y=A.hover.y;ctx.save();
    ctx.strokeStyle=bad?'rgba(255,107,90,0.95)':'rgba(127,209,139,0.95)';ctx.fillStyle=bad?'rgba(255,107,90,0.14)':'rgba(127,209,139,0.14)';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.lineDashOffset=-T*24;
    if(b.zk){const w=M.max(8,b.W/m),h=M.max(8,b.H/m);ctx.beginPath();ctx.rect(X-w/2,Y-h/2,w,h);ctx.fill();ctx.stroke()}else{const r=M.max(10,(k==='city'?b.R:320)/m);ctx.beginPath();ctx.arc(X,Y,r,0,7);ctx.fill();ctx.stroke()}
    if(k==='village'||k==='farm'){ctx.setLineDash([3,5]);ctx.strokeStyle='rgba(255,210,90,0.6)';for(const p of player().places)if(p.k==='village'){ctx.beginPath();ctx.arc(A.sxw(p.x),A.syw(p.y),1400/m,0,7);ctx.stroke()}}
    ctx.setLineDash([]);ctx.drawImage(bIcon(k),X-12,Y-12,24,24);const t=bad||b.n+' · '+fmt(b.cost);ctx.font='600 12px system-ui,sans-serif';ctx.textAlign='left';const w=ctx.measureText(t).width+16;
    ctx.fillStyle='rgba(10,15,23,0.88)';ctx.fillRect(X+16,Y+14,w,22);ctx.fillStyle=bad?'#ff9c8e':'#9fe3aa';ctx.fillText(t,X+24,Y+25);ctx.restore()}
  if(G.mode==='drone'&&A.hover.on){ctx.strokeStyle='#ff6b5a';ctx.lineWidth=2;const X=A.hover.x,Y=A.hover.y;ctx.beginPath();ctx.arc(X,Y,14,0,7);ctx.moveTo(X-20,Y);ctx.lineTo(X+20,Y);ctx.moveTo(X,Y-20);ctx.lineTo(X,Y+20);ctx.stroke()}}
// army token: a framed counter in the state colour with the type symbol and the number of fighters
function armyToken(ctx,s,a,X,Y,sel){const comp={};for(const u of a.units)comp[u]=(comp[u]||0)+1;const main=Object.entries(comp).sort((p,q)=>q[1]-p[1])[0][0];
  ctx.save();ctx.translate(X,Y);ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(-15,-9,32,22);ctx.fillStyle=s.color;ctx.fillRect(-16,-11,32,22);ctx.strokeStyle=sel?'#fff':'rgba(10,15,23,0.9)';ctx.lineWidth=sel?2.5:1.5;ctx.strokeRect(-16,-11,32,22);
  ctx.strokeStyle='rgba(10,15,23,0.85)';ctx.lineWidth=1.4;ctx.beginPath();
  if(main==='tank'){ctx.ellipse(0,0,10,5,0,0,7)}else if(main==='art'){ctx.arc(0,0,3,0,7)}else if(main==='at'){ctx.moveTo(-10,6);ctx.lineTo(0,-6);ctx.lineTo(10,6)}else{ctx.moveTo(-16,-11);ctx.lineTo(16,11);ctx.moveTo(16,-11);ctx.lineTo(-16,11);if(main==='mot'){ctx.moveTo(-3,-11);ctx.lineTo(-3,11);ctx.moveTo(3,-11);ctx.lineTo(3,11)}}
  ctx.stroke();ctx.font='700 11px system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(10,15,23,0.9)';ctx.strokeText(a.units.length,0,19);ctx.fillStyle='#fff';ctx.fillText(a.units.length,0,19);ctx.restore()}
const BIC={};function bIcon(k){if(BIC[k])return BIC[k];const S=48,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');const src=getComputedStyle(document.documentElement).getPropertyValue('--ic-b-'+k);
  if(ICONIMG[k]){x.drawImage(ICONIMG[k],0,0,S,S)}return BIC[k]=c}
const ICONIMG={};

// ---------- engine hooks
function ownBuildAt(x,y){for(const q of player().builds){if(!q.done||q.id<0)continue;const z=W.zones[q.id];if(z&&!z.dead&&rectHit(z,x,y,1,1))return q}return null}
function pickArmy(sx,sy){for(const s of G.states){if(!s.isP)continue;for(const a of s.armies){if(!a.units.length)continue;if(M.abs(api.sxw(a.x)-sx)<18&&M.abs(api.syw(a.y)-sy)<14)return a}}
  for(const s of G.states)if(s.isP)for(const a of s.armies){const q=a.home;if(!q.done)continue;const b=BLD.barracks;if(M.abs(q.x-api.toWorld(sx,sy)[0])<b.W/2&&M.abs(q.y-api.toWorld(sx,sy)[1])<b.H/2)return a}return null}
const hooks={
  frame(dt){if(!G||G.over&&G.speed===0){return}const sp=G.phase==='play'&&own&&api&&api.ready?G.speed:0;if(sp>0){simAcc+=dt*sp;prf('sim',()=>{while(simAcc>0.1){sim(0.1);simAcc-=0.1}})}
    G._hud=(G._hud||0)+dt;if(G._hud>0.25){G._hud=0;prf('hud',()=>{updHUD();updDip()})}},
  draw:(ctx,A)=>{drawOverlay(ctx,A);if(G&&G.phase==='play'&&own)drawObjects(ctx,A)},
  seen:(x,y)=>!G||!own||seenAt(x,y),
  mini:(mx,s)=>drawMini(mx,s),
  click(x,y,sx,sy){if(!G)return false;if(G.phase==='found'){const bad=validSite(x,y);if(bad){toast(bad);if(!placing)setPlacing(true);return true}if(!placing){setPlacing(true)}openConfirm(x,y,sx,sy);return true}
    if(G.build){const k=G.build,p=player(),bad=canBuild(p,k,x,y);if(bad){toast(bad);return true}if(p.res.money<BLD[k].cost&&!creative()){toast('Не хватает денег: нужно '+fmt(BLD[k].cost));return true}startBuild(p,k,x,y);setBuild(null);updHUD();return true}
    if(G.mode==='drone'||G.mode==='swarm'){const o=ownerAt(x,y)-1,sw=G.mode==='swarm',cost=sw?800:300;if(o<0||!atWar(0,o)){toast('Цель — на земле государства, с которым идёт война');return true}if(player().res.money<cost){toast('Не хватает денег');return true}
      let n=0;for(let i=0;i<(sw?3:1);i++)if(launchDrone(player(),G.states[o],x+(i-1)*120,y+(i%2)*90))n++;if(n){if(player().res.money!==Infinity)player().res.money-=cost;toast(sw?'Рой дронов запущен':'Дрон запущен')}else toast('Нет действующей военной части');G.mode=null;panelSig='';updCatalog();return true}
    const own=ownBuildAt(x,y);
    if(G.mode==='demolish'){if(!own){toast('Здесь нет вашей постройки');return true}toast(`Снести <b>${BLD[own.k].n}</b>? Вернётся ${fmt(BLD[own.k].cost*0.3)}`,null,[['Снести',()=>{demolish(player(),own);G.sel=null;panelSig='';updHUD()}],['Отмена',()=>{}]],9000);G.mode=null;updCatalog();return true}
    const a=pickArmy(sx,sy);if(a){G.sel={army:a};G.mode=null;panelSig='';updPanel();onBuilt('assembly',false);return true}
    if(own&&!G.mode){G.sel={build:own};panelSig='';updPanel();return true}
    if(G.sel&&G.sel.army&&G.mode==='move'){const ar=G.sel.army;ar.tx=x;ar.ty=y;G.mode=null;panelSig='';return true}
    if(fogOn()&&!seenAt(x,y))return true;if(G.sel){G.sel=null;G.mode=null;panelSig=''}return false},
  key(e){if(!G||document.body.classList.contains('m-settings'))return !!G;if(e.code==='Escape'){if($('confirm').classList.contains('show')){closeConfirm();return true}if(placing){setPlacing(false);return true}
      if(G.build){setBuild(null);return true}if(G.mode||G.sel){G.mode=null;G.sel=null;panelSig='';return true}if($('dip').classList.contains('show')){$('dip').classList.remove('show');return true}ui.pause(true);return true}
    if(G.phase!=='play')return false;if(e.code==='Space'||e.code==='KeyP'){setSpeed(G.speed?0:(G._lastSp||1));e.preventDefault();return true}
    if(e.code==='KeyF'||e.code==='Tab'){const n={1:2,2:4,4:1}[G._lastSp||1];G._lastSp=n;setSpeed(n);e.preventDefault();return true}
    const d=/^Digit([1-7])$/.exec(e.code);if(d){setTab(TABS[+d[1]-1][0]);return true}return false},
  inspect(c){const o=ownerAt(c.x,c.y);if(!o)return G&&G.phase==='play'?'<tr><td>Государство</td><td>ничейная земля</td></tr>':'';const s=G.states[o-1];
    return `<tr><td>Государство</td><td><span class="own"><i class="chip" style="background:${s.color}"></i>${esc(s.name)}${c.cap!==undefined?' · столица':''}</span></td></tr>`}};

// ---------- boot / phases
function boot(caps,onReady,ops){if(api){api.destroy();api=null}
  const vo=ui.viewOpts();api=startWorld({seed:cfg.seed,opt:mapOpt(caps),ops:ops||[],mode:'game',tod:cfg.rules.dayNight?9.5:12.5,dayNight:cfg.rules.dayNight,view:vo,hooks,onReady:A=>{onReady&&onReady(A)}});
  W=api.W;ui.loading('Отрисовка карты',api.W.cities.length+' населённых пунктов · '+api.W.zones.length+' объектов');api.setTodRate(G.speed*4/60);if(!cfg.rules.dayNight)api.setTodRate(0);document.getElementById('fps').classList.toggle('hid',!vo.fps)}
function mkState(i,o,isP){return {id:i,name:o.name,capital:o.capital,gov:o.gov,flag:o.flag,color:o.color,isP,diff:isP?1:o.diff,trait:o.trait==='random'?['trader','militarist','cautious','adventurer'][(hsh(i,77)*4)|0]:o.trait,
  res:{money:isP&&creative()?Infinity:o.money,food:60,goods:30,wood:0,oil:0,fuel:0},earned:0,income:0,cells:0,pop:0,score:0,cap:null,cityId:-1,grow:0.18,growQ:0,allies:[],places:[],builds:[],armies:[],flow:{},energy:[0,0],rgb:hexRgb(o.color)}}
function initState(c){cfg=c;tutorial=!!c.tutorial;hintsOff=!ui.settings().hints;placing=false;pend=null;mapMode='pol';hintStep=0;simAcc=0;polC=null;fogC=null;ovC=null;dirtyOv=true;bordC=null;bordDirty=true;borders=null;panelSig='';
  G={t:0,speed:1,phase:'found',states:[],dep:[],offers:[],over:false,dec:0,wars:new Set(),drones:[],fx:[],build:null,mode:null,sel:null};
  G.states.push(mkState(0,Object.assign({},c.country,{money:c.rules.money,diff:1,trait:'random'}),true));
  botList().forEach((b,i)=>G.states.push(mkState(i+1,b,false)));
  const p=player();$('hname').textContent=p.name;$('hgov').textContent=p.gov+' · столица '+p.capital;flagCanvas(p.flag,42,28,$('hflag'));G._lastSp=1;setSpeed(1);updModes();tab='cities';tabSig='';
  $('over').classList.remove('show');$('dip').classList.remove('show');$('toasts').innerHTML=''}
function depOp(){return {f:'addDeposits',q:G.dep.map(d=>[d.k,M.round(d.x),M.round(d.y),M.round(200+ORES[d.k].v*14)])}}
function newGame(c){initState(c);const MT={normal:'обычная карта',cont:'материки',arch:'архипелаг',islands:'острова'};ui.loading('Создание мира',`Сид ${c.seed} · ${MT[c.map.type]} · рельеф, реки, леса, месторождения`);setTimeout(()=>{boot(null,()=>{ui.loaded();analyse();G.dep=genDeposits();const o=depOp();api.op(o.f,o.q);hint(0);updHUD()});document.body.className='m-game';updHUD()},60)}
// founding: bots pick their sites, the world is rebuilt with the capitals; land is taken around them
function found(x,y){closeConfirm();setPlacing(false);const picks=chooseCaps(x,y);const p=player();p.cap={x,y};for(const [b,s] of picks)b.cap={x:s.x,y:s.y};
  G.phase='play';ui.loading('Основание государств',G.states.filter(s=>s.cap).map(s=>esc(s.name)).join(' · '));
  setTimeout(()=>{const caps=G.states.filter(s=>s.cap).map(s=>({x:s.cap.x,y:s.cap.y,st:s.id,name:s.capital,fl:s.flag}));cfg.caps=caps;const keep=G.dep;
    G.dep=keep;boot(caps,()=>{ui.loaded();api.flyTo(x,y,3.2,4.5)},[depOp()]);
    for(const s of G.states){const c=W.cities.find(q=>q.cap===s.id);s.cityId=c?c.id:-1;s.growQ=-1;if(c)s.places=[{k:'capital',id:c.id,x:c.x,y:c.y,name:s.capital,st:s,t0:0}];syncGrow(s)}
    G.dep=keep;initTerritory();updPop();rebuildFog();
    for(const s of G.states.slice(1))if(s.cap)toast(`<b>${esc(s.name)}</b> основала столицу <b>${esc(s.capital)}</b>`,s.flag);
    toast(`Вы основали столицу <b>${esc(p.capital)}</b>. ${esc(p.gov)} ${esc(p.name)} начинает свою историю`,p.flag,null,9000);hint(2);save(true)},60)}
function snapshot(){const P=player();return {cfg,meta:{date:Date.now(),name:P.name,flag:P.flag,t:G.t,phase:G.phase,day:gameClock(),score:P.score,map:cfg.map.type},
  g:{t:G.t,phase:G.phase,over:G.over,wars:[...G.wars],ops:api?api.ops.slice():[],hint:hintStep,
    states:G.states.map(s=>({res:Object.fromEntries(Object.entries(s.res).map(([k,v])=>[k,v===Infinity?'inf':v])),earned:s.earned,cap:s.cap,grow:s.grow,allies:s.allies,trait:s.trait,dead:s.dead,lostCap:s.lostCap,planI:s.planI,warAfter:s.warAfter,armyN:s.armyN,
      places:s.places.map(p=>({k:p.k,id:p.id,x:p.x,y:p.y,grow:p.grow,name:p.name,t0:p.t0})),builds:s.builds.map(q=>({k:q.k,x:q.x,y:q.y,t:q.t,time:q.time,done:q.done,id:q.id,off:q.off,dep:q.dep,failed:q.failed})),
      armies:s.armies.map(a=>({n:a.n,id:a.id,x:a.x,y:a.y,tpl:a.tpl,units:a.units,tx:a.tx,ty:a.ty,home:s.builds.indexOf(a.home)}))})),
    dep:G.dep.map(d=>[d.k,M.round(d.x),M.round(d.y),d.amt===Infinity?-1:M.round(d.amt),d.max===Infinity?-1:M.round(d.max),d.known?1:0,d.used]),own:own?rle(own):null,expl:expl?rle(expl):null,cam:api?[api.cam.x,api.cam.y,api.cam.m]:null}}}
function save(auto){if(!G||!cfg||cfg.tutorial&&auto)return false;const ok=Saves.put(cfg.slot||1,snapshot());if(!auto)toast(ok?`Сохранено в ячейку ${cfg.slot||1}`:'Не удалось сохранить: нет места в хранилище браузера');return ok}
function load(sv){const c=sv.cfg;initState(c);const g=sv.g;G.t=g.t;G.phase=g.phase;G.over=g.over;G.wars=new Set(g.wars||[]);
  g.states.forEach((q,i)=>{const s=G.states[i];if(!s)return;if(q.res)for(const k in q.res)s.res[k]=q.res[k]==='inf'?Infinity:q.res[k];Object.assign(s,{earned:q.earned,cap:q.cap,grow:q.grow,allies:q.allies||[],trait:q.trait||s.trait,dead:q.dead,lostCap:q.lostCap,planI:q.planI,warAfter:q.warAfter,armyN:q.armyN});
    s.places=(q.places||[]).map(p=>Object.assign({growQ:-1,st:s},p));s.builds=q.builds||[];s.armies=(q.armies||[]).map(a=>Object.assign({st:s.id,rec:0,fight:0},a,{home:s.builds[a.home]||s.builds[0]}))});
  ui.loading('Загрузка сохранения',esc(sv.meta.name)+' · '+sv.meta.day);
  setTimeout(()=>{const caps=G.phase==='play'?c.caps:null;boot(caps,()=>{ui.loaded();if(g.cam){api.cam.x=g.cam[0];api.cam.y=g.cam[1];api.cam.m=g.cam[2]}},g.ops);document.body.className='m-game';
    analyse();G.dep=g.dep.map(a=>({k:a[0],x:a[1],y:a[2],c:cellOf(a[1],a[2]),amt:a[3]<0?Infinity:a[3],max:a[4]<0?Infinity:a[4],known:!!a[5],used:a[6]===undefined?-1:a[6]}));
    if(G.phase==='play'){own=unrle(g.own,new Uint8Array(N*N));vis=new Uint8Array(N*N);expl=g.expl?unrle(g.expl,new Uint8Array(N*N)):new Uint8Array(N*N);
      for(const s of G.states){s.cells=0;s.bb=null;s._P=null;s._dirty=true;const ct=W.cities.find(q=>q.cap===s.id);s.cityId=ct?ct.id:-1;s.growQ=-1;syncGrow(s);for(const p of s.places)if(p.k==='city')syncPlace(p)}
      for(let k=0;k<N*N;k++)if(own[k]){const s=G.states[own[k]-1],i=k%N,j=(k/N)|0;s.cells++;const b=s.bb||(s.bb=[i,j,i,j]);if(i<b[0])b[0]=i;if(j<b[1])b[1]=j;if(i>b[2])b[2]=i;if(j>b[3])b[3]=j}
      updPop();dirtyPol=true;dirtyFog=true;hint(g.hint>=2?g.hint:2)}else hint(0);
    if(G.over)setSpeed(0);updHUD()},60)}
function exit(){if(G&&!G.over)save(true);if(api){api.destroy();api=null}G=null;W=null;own=null;placing=false;document.body.classList.remove('placing');closeConfirm();hideHint()}

// ---------- DOM wiring (once)
function wire(u){ui=u;
  $('cfy').onclick=()=>{if(pend)found(pend.x,pend.y)};$('cfn').onclick=()=>closeConfirm();
  $('hintx').onclick=()=>hideHint();
$('dipx').onclick=()=>$('dip').classList.remove('show');
  $('bmenu').onclick=()=>ui.pause(true);
  $('bb-l').onclick=()=>$('bb-cat').scrollBy({left:-300,behavior:'smooth'});$('bb-r').onclick=()=>$('bb-cat').scrollBy({left:300,behavior:'smooth'});buildTabs();
  $('bpause').onclick=()=>{if(G&&G.phase==='play')setSpeed(G.speed?0:(G._lastSp||1))};$('bspeed').onclick=()=>{if(G&&G.phase==='play'){const n={1:2,2:4,4:1}[G._lastSp||1];G._lastSp=n;setSpeed(n)}};
  $('overm').onclick=()=>{$('over').classList.remove('show');ui.toMenu()};$('overk').onclick=()=>$('over').classList.remove('show')}
return {wire,newGame,load,save,exit,setSpeed:v=>G&&setSpeed(v),get G(){return G},get api(){return api},paused:()=>G?G.speed===0:true,
  pauseInfo:()=>G?`${esc(player().name)} · ${gameClock()} · ${fmt(player().score)} очков · ячейка ${cfg.slot||1}`:'',setIcon:(k,img)=>{ICONIMG[k]=img},
  _prof:PRF,_dbg:DBG,_test:{demolish:q=>demolish(player(),q),run:sec=>{for(let t=0;t<sec;t+=0.1)sim(0.1)},validSite:(x,y)=>validSite(x,y),found,get own(){return own},chooseCaps,canBuild:(k,x,y)=>canBuild(player(),k,x,y),startBuild:(k,x,y)=>startBuild(player(),k,x,y),BLD,declareWar:(i)=>declareWar(player(),G.states[i]),launchDrone}};
})();

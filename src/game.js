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
function demolish(s,q){if(!q.done||q.k==='city'||q.k==='village')return false;const cost=q.k==='rail'?q.cost:BLD[q.k].cost;
  if(q.k==='rail'){if(q.id>=0)api.op('removeRail',q.id)}else if(q.id>=0)api.op('removeZone',q.id);s.builds.splice(s.builds.indexOf(q),1);if(q.dep!=null&&G.dep[q.dep])G.dep[q.dep].used=-1;
  // a station takes its lines with it, a drone port its modules
  if(q.k==='station')for(const r of s.builds.slice())if(r.k==='rail'&&(r.a===q.uid||r.b===q.uid)){if(r.done)demolish(s,r);else s.builds.splice(s.builds.indexOf(r),1)}
  if(q.k==='droneport')for(const r of s.builds.slice())if(r.port===q.uid&&BLD[r.k]&&BLD[r.k].mod){if(r.done)demolish(s,r);else s.builds.splice(s.builds.indexOf(r),1)}
  lightsDirty=true;const a=s.armies.find(x=>x.home===q);if(a)s.armies.splice(s.armies.indexOf(a),1);if(s.res.money!==Infinity)s.res.money+=cost*0.3;if(s.isP)toast(`Снесено: <b>${bName(q)}</b> · возвращено ${fmt(cost*0.3)}`,'ic-b-demolish');updPop();capUav(s);return true}
const bName=q=>q.k==='rail'?'ЖД путь':BLD[q.k].n;
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
  airport:{n:'Аэропорт',cost:5000,time:24,d:'Самолёты летают по рейсам: пассажирские — в свои аэропорты и в страны с безвизом, грузовые — в свои аэропорты и на экспорт в мирные страны. Каждый рейс приносит деньги. Нужна энергия',zk:'air2',W:2000,H:440,area:'own',need:{energy:2}},
  sam:{n:'ПВО',cost:1800,time:12,d:'Сбивает вражеские дроны в радиусе 9 км',zk:'sam',W:150,H:150,area:'own'},
  // stage 5.7
  solar:{n:'Солнечные панели',cost:700,time:8,d:'Резерв энергии: днём +6, излишек заряжает аккумулятор (600), он покрывает нехватку ночью и когда ТЭЦ стоит. Рядом с дронопортом питает его',zk:'sol2',W:72,H:46,area:'own',solar:6,bat:600},
  mine:{n:'Рудник',cost:2200,time:16,d:'Добыча на месторождении угля, железа, меди, золота, урана или лития. Нужна энергия',zk:'mine',W:300,H:220,area:'ore',need:{energy:3}},
  gaswell:{n:'Газовая скважина',cost:1600,time:12,d:'Газ месторождения → топливо и энергия',zk:'gasw',W:150,H:110,area:'gas',prod:{fuel:3,energy:4}},
  station:{n:'Вокзал',cost:1200,time:10,d:'Станция железной дороги. Вокзалы соединяются путями: «ЖД путь» и протяните линию от вокзала',zk:'rst',W:300,H:64,area:'own'},
  droneport:{n:'Дронопорт',cost:3000,time:16,d:'База БПЛА: хранит 2 дрона. Модули: пусковая рампа (Ланцет, Орлан-10), ВПП (Герань-3), склад (+6 дронов)',zk:'dport',W:240,H:180,area:'own',need:{energy:2}},
  dramp:{n:'Пусковая рампа',cost:800,time:8,d:'Модуль дронопорта: запуск Ланцетов и Орланов',zk:'dramp',W:84,H:40,area:'dport',mod:1},
  drwy:{n:'ВПП',cost:1500,time:12,d:'Модуль дронопорта: взлёт реактивных Гераней-3',zk:'drwy',W:460,H:56,area:'dport',mod:1},
  dstore:{n:'Склад БПЛА',cost:900,time:8,d:'Модуль дронопорта: +6 мест для дронов',zk:'dstore',W:120,H:76,area:'dport',mod:1},
  dronefab:{n:'Цех БПЛА',cost:4000,time:20,d:'Производство дронов: Ланцет, Герань-3, Орлан-10. Улучшения: солнечные панели, противодронная сетка, бетон',zk:'dfab',W:400,H:280,area:'town',need:{energy:6}}};
const BORDER=['village','farm','factory','power','sawmill','oil','refinery','port','airport','city','barracks','sam','solar','mine','gaswell','station','droneport','dronefab'];
const RES=['food','goods','wood','oil','fuel','metal'];const RESN={money:'Деньги',food:'Еда',goods:'Товары',energy:'Энергия',wood:'Древесина',oil:'Нефть',fuel:'Топливо',metal:'Металл'};
const PRICE={food:1,goods:3,wood:1.5,oil:2,fuel:3,metal:4};
// mines: output per second by the ore of the deposit (index in ORES)
const MINE={2:{energy:8,money:4},3:{metal:5},4:{metal:3,money:5},5:{money:18},6:{money:22},7:{metal:2,money:8}};
// UAVs (stage 5.7): price, build time, launch module, speed (m/s), damage
const DRN={lancet:{n:'Ланцет',cost:260,metal:6,fuel:0,time:14,from:'dramp',v:260,off:40,kill:2,sam:1,ic:'lancet',d:'Барражирующий боеприпас: поражает постройку или технику'},
  geran:{n:'Герань-3',cost:600,metal:10,fuel:8,time:24,from:'drwy',v:430,off:75,kill:3,sam:0.55,ic:'geran',d:'Реактивный ударный дрон: быстрый, дальний, ПВО сбивает его реже'},
  orlan:{n:'Орлан-10',cost:300,metal:4,fuel:2,time:12,from:'dramp',v:150,recon:1,sam:0.8,ic:'orlan',d:'Разведчик: летит к точке, кружит 25 с и раскрывает постройки. Может быть сбит'}};
const UPG={sol:{n:'Солнечные панели',cost:900,d:'Цеху нужно на 4 энергии меньше'},net:{n:'Противодронная сетка',cost:700,d:'Половина попавших дронов застревает в сетке'},con:{n:'Бетонная защита',cost:1200,d:'После попадания цех стоит вдвое меньше'}};
// can state s build kind k at (x,y)?  → null or the reason
function canBuild(s,k,x,y,ang){const b=BLD[k];if(!b)return 'Неизвестная постройка';if(x<5000||y<5000||x>W.WORLD-5000||y>W.WORLD-5000)return 'Слишком близко к краю мира';
  const a=ang!=null?ang:k==='station'?stationAng(s,x,y):0;
  // a well or a mine stands on the centre of its deposit: check the footprint there
  {const dk=b.area==='oil'?(d=>ORES[d.k].k==='oil'):b.area==='gas'?(d=>ORES[d.k].k==='gas'):b.area==='ore'?(d=>!!MINE[d.k]):null;if(dk){const d=G.dep.find(d=>dk(d)&&d.known&&d.used<0&&M.hypot(d.x-x,d.y-y)<800);if(d){x=d.x;y=d.y}}}
  const e=W.landE(x,y,0.004);if(e<0)return 'Здесь вода';if(e>0.36)return 'Слишком высоко в горах';
  const o=ownerAt(x,y),mine=o===s.id+1;const rad=b.R?b.R*1.3:M.hypot(b.W||600,b.H||600)/2;
  for(const c of W.cities){const d=M.hypot(c.x-x,c.y-y);if(k==='city'||k==='village'){if(d<c.R*1.2+rad+400)return 'Слишком близко к '+c.name}else if(c.type>=1&&cityF(c,x,y)<1.1+rad/c.R)return 'Здесь кварталы '+c.name}
  const hw=b.zk?b.W/2:(b.R?b.R*1.3:400),hh=b.zk?b.H/2:hw;
  const gap=b.zk?8:30;for(const z of W.zones)if(!z.dead&&rectHit(z,x,y,hw+gap,hh+gap,a))return 'Занято: мешает «'+(ZLBL[z.zk]||'объект')+'»';
  if(b.zk&&k!=='port'){const f=footBad(x,y,b.W,b.H,a);if(f)return f}
  for(const d of G.dep)if(d.used<0&&b.zk&&b.area!=='ore'&&b.area!=='gas'&&k!=='oil'&&rectHit({x,y,ca:M.cos(a),sa:M.sin(a),W:b.W,H:b.H},d.x,d.y,120,120))return 'Здесь месторождение — для него рудник, скважина или вышка';
  // another construction site: their footprints must not touch (8 m apart), towns keep their radius
  for(const st of G.states)for(const q of st.builds){if(q.done||q.k==='rail')continue;const c=BLD[q.k];if(!c)continue;
    if(c.zk&&b.zk){const qa=q.k==='station'?(q.ang||0):0;if(rectHit({x:q.x,y:q.y,ca:M.cos(qa),sa:M.sin(qa),W:c.W,H:c.H},x,y,hw+8,hh+8,a))return 'Рядом идёт стройка: «'+c.n+'»'}
    else if(M.hypot(q.x-x,q.y-y)<(c.R?c.R*1.3:c.zk?M.hypot(c.W,c.H)/2:400)+rad+60)return 'Рядом идёт стройка: «'+c.n+'»'}
  if(b.area==='near'){if(o&&!mine)return 'Чужая территория';if(!mine&&distOwn(s,x,y)>(k==='city'?14000:10000))return 'Слишком далеко от ваших земель';return null}
  if(!mine)return 'Только на своей территории';
  if(b.area==='village'){const v=s.places.find(p=>p.k==='village'&&M.hypot(p.x-x,p.y-y)<1400);return v?null:'Колхоз — только в области села'}
  if(b.area==='town'){const t=s.places.find(p=>p.k!=='village'&&M.hypot(p.x-x,p.y-y)<placeR(p)+1500);return t?null:'Завод — рядом с городом'}
  if(b.area==='forest'){let f=0;for(let a=0;a<8;a++)f=M.max(f,W.forestAt(x+M.cos(a)*450,y+M.sin(a)*450));return f>0.5||W.forestAt(x,y)>0.5?null:'Лесопилка — у леса'}
  if(b.area==='oil'){const d=G.dep.find(d=>ORES[d.k].k==='oil'&&d.known&&d.used<0&&M.hypot(d.x-x,d.y-y)<800);return d?null:'Нефтевышка — на месторождении нефти'}
  if(b.area==='coast')return coastNear(x,y)?null:'Порт — только на берегу моря с выходом в океан';
  if(b.area==='ore')return oreAt(x,y)?null:'Рудник — на месторождении угля, железа, меди, золота, урана или лития';
  if(b.area==='gas'){const d=G.dep.find(d=>ORES[d.k].k==='gas'&&d.known&&d.used<0&&M.hypot(d.x-x,d.y-y)<800);return d?null:'Газовая скважина — на месторождении газа'}
  if(b.area==='dport'){const p=portNear(s,x,y,1100);if(!p)return 'Модуль — рядом с вашим дронопортом (до 1 км)';if(s.builds.some(q=>q.k===k&&q.port===p.uid))return 'У этого дронопорта уже есть: '+b.n;return null}
  return null}
const oreAt=(x,y)=>G.dep.find(d=>MINE[d.k]&&d.known&&d.used<0&&M.hypot(d.x-x,d.y-y)<800);
// the drone port of state s nearest to (x,y) within r metres
function portNear(s,x,y,r){let best=null,bd=r;for(const q of s.builds)if(q.k==='droneport'){const d=M.hypot(q.x-x,q.y-y);if(d<bd){bd=d;best=q}}return best}
// the port needs the open sea: the water it faces must be connected to the world's edge (not a lake)
function coastNear(x,y){const p=W.portAt(x,y);if(!p)return false;for(const d of [420,600,800]){const c=cellOf(p[0]+M.cos(p[2])*d,p[1]+M.sin(p[2])*d);if(c>=0&&ocean[c])return true}return false}
// does the zone z overlap an axis-aligned box (x±hw, y±hh)? separating axes of the two rectangles
function rectHit(z,x,y,hw,hh,a){const c=a?M.cos(a):1,sn=a?M.sin(a):0,ax=[[c,sn],[-sn,c],[z.ca,z.sa],[-z.sa,z.ca]],dx=x-z.x,dy=y-z.y;
  for(const [ux,uy] of ax){const pa=hw*M.abs(ux*c+uy*sn)+hh*M.abs(-ux*sn+uy*c),pb=z.W/2*M.abs(ux*z.ca+uy*z.sa)+z.H/2*M.abs(-ux*z.sa+uy*z.ca);if(M.abs(dx*ux+dy*uy)>pa+pb)return false}return true}
// a station stands along the town edge: its hall (local +y) faces the nearest settlement
function stationAng(s,x,y){const h=homeOf(s,x,y);if(!h)return 0;return M.atan2(-(h.x-x),h.y-y)}
const ZLBL={air2:'Аэропорт',farm:'Колхоз',ind:'Завод товаров',pow:'ТЭЦ',saw:'Лесопилка',oil:'Нефтевышка',ref2:'НПЗ',port:'Порт',mil:'Военная часть',sam:'ПВО'};
// the footprint of a building: dry land everywhere (3 x 3 samples + corners) and no road across it
function footBad(x,y,w,h,an){const c=an?M.cos(an):1,sn=an?M.sin(an):0;for(let a=0;a<=4;a++)for(let b=0;b<=4;b++){const u=(a/4-0.5)*w,v=(b/4-0.5)*h;if(W.landE(x+u*c-v*sn,y+u*sn+v*c,0.002)<0)return 'Здесь вода'}
  const RW=W._dbg.RW,R=M.hypot(w,h)/2;for(const r of W.queryRoads(x-R-40,y-R-40,x+R+40,y+R+40)){if(r.k===8||r.dead)continue;const m=RW[r.k]/2+6;
    for(let i=0;i<r.n-1;i++){const ax=r.pts[i*2],ay=r.pts[i*2+1],bx=r.pts[i*2+2],by=r.pts[i*2+3],L=M.hypot(bx-ax,by-ay);for(let t=0;t<=L;t+=10){const px=ax+(bx-ax)*t/L-x,py=ay+(by-ay)*t/L-y;if(M.abs(px*c+py*sn)<w/2+m&&M.abs(-px*sn+py*c)<h/2+m)return 'Мешает дорога'}}}return null}
function distOwn(s,x,y){let d=1e9;for(const p of s.places)d=M.min(d,M.hypot(p.x-x,p.y-y)-placeR(p));return d}
function cityF(c,x,y){return M.hypot(x-c.x,y-c.y)/c.R}
// the nearest settlement of the state — a building's access road leads there
function homeOf(s,x,y){let best=null,bd=1e18;for(const p of s.places){const d=M.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=p}}return best}
function startBuild(s,k,x,y,ang){const b=BLD[k],c=creative()&&s.isP?0:b.cost;if(s.res.money<c)return false;if(s.res.money!==Infinity)s.res.money-=c;
  const q={k,x,y,t:0,time:b.time*(s.isP?1:[1.3,1,0.8][s.diff]),done:false,id:-1,off:0,uid:++G.uid};
  const dk=k==='oil'?(d=>ORES[d.k].k==='oil'):k==='gaswell'?(d=>ORES[d.k].k==='gas'):k==='mine'?(d=>!!MINE[d.k]):null;
  if(dk){const d=G.dep.find(d=>dk(d)&&d.known&&d.used<0&&M.hypot(d.x-x,d.y-y)<800);if(d){d.used=s.id;q.dep=G.dep.indexOf(d);q.x=d.x;q.y=d.y}}
  if(k==='station')q.a=ang!=null?ang:stationAng(s,x,y);else if(ang!=null&&b.zk&&ang)q.a=ang;
  if(b.mod){const p=portNear(s,x,y,1100);if(p)q.port=p.uid}
  if(k==='dronefab'){q.queue=[];q.pt=0;q.up={}}
  s.builds.push(q);if(k==='city'||k==='village')placeNow(s,q);if(s.isP)onBuilt(k,false);return true}
// a town or a village appears on the map at once and grows while it is being built (stage 5.9), as the capitals do
function placeNow(s,q){const b=BLD[q.k],name=NAMES.capital(rngS(hsh(q.x|0,q.y|0)*1e9));const id=api.op('addPlace',{k:q.k,x:q.x,y:q.y,st:s.id,name,R:b.R});q.id=id;if(id<0)return;
  const p={k:q.k,id,x:q.x,y:q.y,grow:0.05,growQ:-1,name,st:s,t0:G.t,bq:q.uid};s.places.push(p);syncPlace(p);clearDeps(W.cities[id]);claimAll()}
// a railway between two stations of the state (uid a, b): built after both stations stand; price by length
function startRail(s,a,b,L){const cost=M.round(L*RAILK),c=creative()&&s.isP?0:cost;if(s.res.money<c)return false;if(s.res.money!==Infinity)s.res.money-=c;
  const q={k:'rail',a,b,x:0,y:0,t:0,time:M.max(10,L/250),done:false,id:-1,off:0,uid:++G.uid,cost,L:M.round(L)};const A=byUid(s,a),B=byUid(s,b);if(A&&B){q.x=(A.x+B.x)/2;q.y=(A.y+B.y)/2}
  s.builds.push(q);if(s.isP)toast(`ЖД путь ${fmtKm(L)} строится · ${fmt(cost)}`,'ic-b-rail');return true}
const RAILK=0.9,byUid=(s,u)=>s.builds.find(q=>q.uid===u),fmtKm=m=>(m/1000).toFixed(1).replace('.',',')+' км';
// construction finished: the world gets the new town or zone (same op in all workers)
function finishBuild(s,q){q.done=true;
  if(q.k==='rail'){const A=byUid(s,q.a),B=byUid(s,q.b);let P=null;if(A&&B&&A.id>=0&&B.id>=0){P=W.railPts(W.zones[A.id],W.zones[B.id],railBlk(s));if(typeof P==='string')P=null}
    q.id=P?api.op('addRail',{a:A.id,b:B.id,st:s.id,P:P.map(v=>M.round(v*10)/10)}):-1;if(q.id<0){q.failed=true;if(s.isP)toast('ЖД путь не удалось проложить','ic-b-rail');return}
    if(s.isP){toast(`Построено: <b>ЖД путь</b> ${fmtKm(q.L)}`,'ic-b-rail');onBuilt('rail',true)}return}
  const b=BLD[q.k];lightsDirty=true;
  if(q.k==='city'||q.k==='village'){let p=s.places.find(o=>o.bq===q.uid);if(!p){placeNow(s,q);p=s.places.find(o=>o.bq===q.uid)}
    if(p){p.grow=q.k==='city'?M.max(p.grow,0.12):1;syncPlace(p)}}
  else{const h=homeOf(s,q.x,q.y);const o={zk:b.zk,x:q.x,y:q.y,city:h.id,st:s.id,W:b.W,H:b.H};if(q.a!=null)o.a=q.a;if(q.dep!=null)o.ore=G.dep[q.dep].k;
    q.id=api.op('addZone',o);if(q.id<0){q.failed=true}claimAll();
    if(q.k==='barracks'){const n=(s.armyN=(s.armyN||0)+1);s.armies.push(mkArmy(s,n,q))}
    if(q.id>=0&&q.up)for(const u in q.up)if(q.up[u])api.op('zoneUp',[q.id,u])}
  capUav(s);if(s.isP){toast(`Построено: <b>${b.n}</b>`,'ic-b-'+q.k);onBuilt(q.k,true)}updPop()}
// deposits under a new town move aside to the nearest free spot (stage 5.7)
function depFree(x,y,self){if(W.landE(x,y,0.004)<0.02||W.landE(x,y,0)>0.32)return false;
  for(const c of W.cities){const d=M.hypot(c.x-x,c.y-y);if(d<(c.type===0?c.R*1.6+350:c.R*1.45+350))return false}
  for(const z of W.zones)if(!z.dead&&rectHit(z,x,y,160,160))return false;for(const d of G.dep)if(d!==self&&M.hypot(d.x-x,d.y-y)<1500)return false;
  for(const r of W.queryRoads(x-260,y-260,x+260,y+260))if(!r.dead&&r.k!==8){const q=W._dbg.projOn(r,x,y);if(M.hypot(q[0]-x,q[1]-y)<230)return false}
  for(const st of G.states)for(const q of st.builds)if(!q.done&&M.hypot(q.x-x,q.y-y)<900)return false;return true}
function clearDeps(c,local){if(!c||!G.dep)return 0;let n=0;const lim=c.type===0?c.R*1.6+300:c.R*1.45+300;
  G.dep.forEach((d,i)=>{if(d.used>=0||M.hypot(d.x-c.x,d.y-c.y)>lim)return;const a0=M.atan2(d.y-c.y,d.x-c.x);
    for(let r=lim+400;r<lim+9000;r+=300){for(let k=0;k<16;k++){const a=a0+(k%2?1:-1)*M.ceil(k/2)*0.32,x=c.x+M.cos(a)*r,y=c.y+M.sin(a)*r;if(!depFree(x,y,d))continue;
      const ox=d.x,oy=d.y;d.x=M.round(x);d.y=M.round(y);d.c=cellOf(d.x,d.y);if(!local)api.op('moveDeposit',[i,d.x,d.y,ox,oy]);n++;return}}});return n}
function syncPlace(p){const g=p.grow>=1?1:M.floor(p.grow/0.07)*0.07+0.07;if(g!==p.growQ){p.growQ=g;api.setGrow(p.id,M.min(1,g))}}
function syncGrow(s){const g=s.grow>=1?1:M.floor(s.grow/0.07)*0.07+0.07;if(g!==s.growQ&&s.cityId>=0){s.growQ=g;api.setGrow(s.cityId,M.min(1,g))}}

// ---------- economy
function popOf(p){const c=W.cities[p.id];if(!c)return 0;if(p.k==='village')return 800+c.R*2;const g=p.k==='capital'?p.st.grow:p.grow;return c.R*c.R*(p.k==='capital'?0.11:0.08)*M.min(1,g)}
function updPop(){for(const s of G.states){s.pop=0;for(const p of s.places)s.pop+=popOf(p)}}
// daylight for the solar panels: sun elevation from the engine clock and the cloud cover
function daylight(){if(!api)return 1;if(!cfg.rules.dayNight)return 1;const el=M.sin((api.tod-6)/12*M.PI);return M.max(0,M.min(1,el*1.7))*(1-0.45*(api.wcur?api.wcur.cover:0))}
// what a building makes / needs per second (mines by their ore, the UAV factory less energy with its solar roof)
function prodOf(q){const b=BLD[q.k];if(q.k==='mine'){const d=G.dep[q.dep];return d?MINE[d.k]:null}return b.prod}
function needOf(s,q){const b=BLD[q.k];if(!b.need)return null;if(q.k==='dronefab'&&q.up&&q.up.sol)return {energy:2};if(q.k==='droneport'&&solarNear(s,q))return null;return b.need}
const solarNear=(s,q)=>s.builds.some(p=>p.k==='solar'&&p.done&&p.off<=0&&M.hypot(p.x-q.x,p.y-q.y)<700);
function econ(s,dt){const r=s.res,cap=400+800*s.builds.filter(q=>q.done&&q.k==='port').length,mul=s.isP?1:DIFF[s.diff].inc;s.store=cap;
  // energy is a rate: production vs demand; consumers run at the share that is covered. Solar panels give energy by day
  // and charge a battery with the surplus; the battery covers a shortage (night, a power plant that was hit)
  let eProd=0,eNeed=0,sol=0,batC=0;const live=s.builds.filter(q=>q.done&&!q.failed&&q.off<=0&&q.k!=='rail');const day=daylight();
  for(const q of live){const b=BLD[q.k],pr=prodOf(q),nd=needOf(s,q);if(pr&&pr.energy&&(q.k!=='mine'||depLeft(q)))eProd+=pr.energy;if(b.solar){sol+=b.solar*day;batC+=b.bat}if(nd&&nd.energy)eNeed+=nd.energy}
  eProd+=sol;s.bat=M.min(s.bat||0,batC);s.batC=batC;let cover=0;
  if(eProd>=eNeed){s.bat=M.min(batC,s.bat+(eProd-eNeed)*dt)}else if(s.bat>0){cover=M.min(eNeed-eProd,s.bat/dt);s.bat-=cover*dt}
  const eK=eNeed?M.min(1,(eProd+cover)/eNeed):1;s.energy=[eProd+cover,eNeed,sol,cover];s.eK=eK;let inc=0;const flow={food:0,goods:0,wood:0,oil:0,fuel:0,metal:0};
  for(const q of live){const b=BLD[q.k],nd=needOf(s,q),pr=prodOf(q);let k=nd&&nd.energy?eK:1;
    if(nd&&nd.oil){const want=nd.oil*dt*k;const got=M.min(want,r.oil);r.oil-=got;k*=want?got/want:0;flow.oil-=got/dt}
    if(q.dep!=null){const d=G.dep[q.dep];if(!d||d.amt<=0)continue;const take=(q.k==='oil'?b.prod.oil:4)*dt*k;if(d.amt!==Infinity)d.amt=M.max(0,d.amt-take)}
    if(q.k==='dronefab')fabStep(s,q,dt*k);
    if(!pr)continue;for(const [rk,v] of Object.entries(pr)){if(rk==='energy')continue;if(rk==='money'){inc+=v*k;continue}r[rk]=M.min(cap,(r[rk]||0)+v*k*dt);flow[rk]+=v*k}}
  // people: taxes, they eat food and use goods
  const pop=s.pop,eat=pop/70000,use=pop/140000;const fOk=r.food>=eat*dt,gOk=r.goods>=use*dt;r.food=M.max(0,r.food-eat*dt);r.goods=M.max(0,r.goods-use*dt);flow.food-=eat;flow.goods-=use;
  inc+=3+pop/5000*(fOk?1:0.5)*(gOk?1:0.75);
  // other deposits inside the borders give a little money
  for(const d of G.dep)if(ORES[d.k].k!=='oil'&&d.used<0&&own[d.c]===s.id+1&&d.amt>0){inc+=ORES[d.k].v*0.25;if(d.amt!==Infinity)d.amt=M.max(0,d.amt-ORES[d.k].v*0.25*dt)}
  // ports: sell what is above 70 % of the store, buy food when it runs out
  // railways: every line between two stations brings trade money (more for a longer line)
  for(const q of s.builds)if(q.k==='rail'&&q.done&&!q.failed)inc+=3+q.L/1500;
  if(cap>400){for(const rk of RES){const over=r[rk]-cap*0.7;if(over>0){const sell=M.min(over,8*dt);r[rk]-=sell;inc+=sell/dt*PRICE[rk]}}if(r.food<cap*0.1&&r.money>50){const buy=4*dt;r.food+=buy;r.money-=buy*2}}
  inc*=mul;if(r.money!==Infinity)r.money+=inc*dt;s.income=inc;s.earned+=inc*dt;s.flow=flow;
  for(const q of s.builds)if(q.off>0)q.off-=dt;
  s.score=M.round(s.pop/1000+s.earned/100+s.cells*0.5)}

const depLeft=q=>{const d=G.dep[q.dep];return d&&d.amt>0};
// ---------- UAVs (stage 5.7): a factory builds the queued drones one by one (money and metal up front, fuel for the
// jet), they wait in the drone ports (2 places each, +6 with a store); launches need the port's ramp or runway
const uavCap=s=>s.builds.filter(q=>q.k==='droneport'&&q.done).reduce((t,q)=>t+2+(s.builds.some(m=>m.k==='dstore'&&m.done&&m.port===q.uid)?6:0),0);
const uavN=s=>{const u=s.uav||{};return (u.lancet||0)+(u.geran||0)+(u.orlan||0)};
function capUav(s){const u=s.uav||(s.uav={lancet:0,geran:0,orlan:0});let over=uavN(s)-uavCap(s);for(const k of ['orlan','lancet','geran'])while(over>0&&u[k]>0){u[k]--;over--}}
function fabStep(s,q,dt){if(!q.queue||!q.queue.length)return;const k=q.queue[0],d=DRN[k],r=s.res;if(uavN(s)>=uavCap(s)){q.wait='нет места в дронопорте';return}
  if(!q.paid){if(r.money<d.cost||(r.metal||0)<d.metal||(r.fuel||0)<d.fuel){q.wait=r.money<d.cost?'не хватает денег':(r.metal||0)<d.metal?'не хватает металла':'не хватает топлива';return}
    if(r.money!==Infinity)r.money-=d.cost;r.metal-=d.metal;r.fuel-=d.fuel;q.paid=1}
  q.wait='';q.pt=(q.pt||0)+dt;if(q.pt<d.time)return;q.pt=0;q.paid=0;q.queue.shift();(s.uav||(s.uav={lancet:0,geran:0,orlan:0}))[k]++;
  if(s.isP){toast(`Цех БПЛА: готов <b>${d.n}</b>`,'ic-b-'+d.ic);onBuilt('uav',true)}}
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
// ---------- drones (stage 5.7): Lancet and Orlan-10 take off from the launch ramp of a drone port, the Geran-3 jet from
// its runway; an old-style strike drone from a military base is left for the bots that have no drone port yet.
// Air defence within 9 km shoots at them (the jet is harder to hit); the Orlan circles its point for 25 s, reveals the
// buildings around it and flies home
const portPowered=(s,p)=>solarNear(s,p)||(s.eK==null?1:s.eK)>=0.5;
function launchSite(s,mod){for(const q of s.builds){if(q.k!==mod||!q.done||q.off>0)continue;const p=byUid(s,q.port);if(!p||!p.done||p.off>0||!portPowered(s,p))continue;return q}return null}
function launchUav(s,kind,tx,ty,to){const d=DRN[kind],u=s.uav||(s.uav={lancet:0,geran:0,orlan:0});if(!u[kind])return 'Нет готовых дронов «'+d.n+'» — закажите их в цехе БПЛА';
  const m=launchSite(s,d.from);if(!m)return d.from==='drwy'?'Нужна ВПП дронопорта (и энергия)':'Нужна пусковая рампа дронопорта (и энергия)';
  u[kind]--;G.drones.push({st:s.id,to:to==null?-1:to,x:m.x,y:m.y,hx:m.x,hy:m.y,tx,ty,kind,life:0,ph:'go',lt:0,uid:++G.uid});return null}
function launchDrone(s,t,tx,ty,kind){const base=s.builds.find(q=>q.done&&q.k==='barracks'&&q.off<=0);if(!base)return false;G.drones.push({st:s.id,to:t.id,x:base.x,y:base.y,tx,ty,kind:kind||'drone',life:0,ph:'go',uid:++G.uid});return true}
const REVR=3000; // radius of what an Orlan sees
function samShoot(d,dt){const D=DRN[d.kind],k=D?D.sam:1,own=G.states[d.st];
  for(const t of G.states){if(t.id===d.st||own.allies.includes(t.id))continue;
    const hostile=d.kind==='orlan'?ownerAt(d.x,d.y)===t.id+1||atWar(t.id,d.st):(t.id===d.to||t.allies.includes(d.to));if(!hostile)continue;
    // each battery fires a salvo of two missiles at a drone in its 9 km circle, 2.5 s apart; the chance to kill depends on the drone
    for(const q of t.builds){if(!q.done||q.k!=='sam'||q.off>0||M.hypot(q.x-d.x,q.y-d.y)>9000)continue;const sh=d.sh||(d.sh={}),f=sh[q.uid||q.id]||(sh[q.uid||q.id]={n:0,t:-9});
      if(f.n>=2||d.life-f.t<2.5)continue;f.n++;f.t=d.life;G.fx.push({x:q.x,y:q.y,x2:d.x,y2:d.y,t:0,k:'shot'});
      if(hsh((q.uid||q.id)*31+f.n,(d.uid||d.life*1000|0))<0.55*k){G.fx.push({x:d.x,y:d.y,t:0,k:'boom'});
        if(t.isP)toast(d.kind==='orlan'?'ПВО сбила вражеский разведчик':'ПВО сбила вражеский дрон','ic-b-sam');else if(d.st===0)toast(`ПВО противника сбила <b>${D?D.n:'дрон'}</b>`,'ic-b-sam');return true}}}return false}
function stepDrones(dt){for(const d of G.drones.slice()){const D=DRN[d.kind],v=(D?D.v:320)*dt;d.life+=dt;
    if(samShoot(d,dt)){G.drones.splice(G.drones.indexOf(d),1);continue}
    if(d.ph==='loiter'){d.lt+=dt;const a=d.lt*0.32;d.x=d.tx+M.cos(a)*700;d.y=d.ty+M.sin(a)*700;if((d.lt%1)<dt)reveal(d);if(d.lt>=25){d.ph='back';if(d.st===0)toast('Орлан-10 закончил разведку и возвращается','ic-b-orlan')}continue}
    const gx=d.ph==='back'?d.hx:d.tx,gy=d.ph==='back'?d.hy:d.ty,dx=gx-d.x,dy=gy-d.y,L=M.hypot(dx,dy);
    if(L<=v){if(d.ph==='back'){G.drones.splice(G.drones.indexOf(d),1);const s=G.states[d.st];if(uavN(s)<uavCap(s))s.uav.orlan++;continue}
      if(d.kind==='orlan'){d.ph='loiter';d.lt=0;reveal(d);continue}
      G.drones.splice(G.drones.indexOf(d),1);G.fx.push({x:d.tx,y:d.ty,t:0,k:'boom'});droneHit(d);continue}
    d.x+=dx/L*v;d.y+=dy/L*v}
  for(const f of G.fx.slice()){f.t+=dt;if(f.t>1.2)G.fx.splice(G.fx.indexOf(f),1)}}
// what an Orlan of the player (or an ally) sees: the buildings of other states within 3 km stay revealed
function reveal(d){const s=G.states[d.st];if(!(s.isP||s.allies.includes(0)))return;let n=0;
  for(const t of G.states){if(t===s)continue;for(const q of t.builds)if(q.done&&q.id>=0&&q.k!=='rail'&&!G.rev.has(q.id)&&M.hypot(q.x-d.x,q.y-d.y)<REVR+700){G.rev.add(q.id);n++}}
  if(n){hidDirty=true;if(s.isP)toast(`Орлан-10 обнаружил построек: <b>${n}</b>`,'ic-b-orlan')}}
function droneHit(d){const t=G.states[d.to];if(!t)return;const D=DRN[d.kind]||{off:40,kill:2};let hit=null,hd=700;for(const q of t.builds){if(!q.done||q.k==='rail')continue;const r=M.hypot(q.x-d.tx,q.y-d.ty);if(r<hd){hd=r;hit=q}} // the building nearest to the impact
  if(hit){if(hit.up&&hit.up.net&&hsh(d.uid||1,G.t*10|0)<0.5){if(t.isP)toast(`Противодронная сетка остановила дрон над «${BLD[hit.k].n}»`,'ic-net');return}
    hit.off=D.off*(hit.up&&hit.up.con?0.5:1);if(t.isP)toast(`${D.n||'Дрон'} поразил: <b>${BLD[hit.k].n}</b> — не работает ${M.round(hit.off)} с`,'ic-b-'+hit.k);else if(d.st===0)toast(`${D.n} поразил цель: <b>${BLD[hit.k].n}</b>`,'ic-b-'+(D.ic||'lancet'));return}
  for(const a of t.armies)if(a.units.length&&M.hypot(a.x-d.tx,a.y-d.ty)<1200){a.units.splice(0,M.min(D.kill||2,a.units.length));if(t.isP)toast(`Дрон ударил по армии №${a.n}`,'ic-b-army');return}}

// ---------- war and peace
function declareWar(a,b){if(atWar(a.id,b.id)||a.allies.includes(b.id))return;G.wars.add(a.id+'-'+b.id);dropVisa(a,b);toast(`<b>${esc(a.name)}</b> объявляет войну <b>${esc(b.name)}</b>`,a.flag,null,9000);updDip()}
function makePeace(a,b){G.wars.delete(a.id+'-'+b.id);G.wars.delete(b.id+'-'+a.id);toast(`<b>${esc(a.name)}</b> и <b>${esc(b.name)}</b> заключили мир`,a.flag);updDip()}
function askPeace(o){const p=player();const mine=p.armies.reduce((t,a)=>t+strength(a),0),their=o.armies.reduce((t,a)=>t+strength(a),0);if(their<mine*0.9||hsh(o.id,G.t|0)<0.3)makePeace(p,o);else toast(`<b>${esc(o.name)}</b> отвергает мир`,o.flag);o.asked=G.t;updDip()}

// ---------- bots
const BOTPLAN={trader:['village','farm','factory','power','port','sawmill','oil','refinery','solar','city','mine','barracks','sam','droneport','dramp','dronefab','factory','village','farm','airport','city','gaswell'],
  militarist:['village','farm','barracks','factory','power','sam','droneport','dramp','dronefab','mine','oil','refinery','drwy','city','barracks','factory','solar','sawmill','port','village','farm','airport','city'],
  cautious:['village','farm','factory','power','sam','solar','sawmill','barracks','oil','refinery','mine','port','droneport','dramp','city','dronefab','factory','village','farm','airport','sam'],
  adventurer:['village','city','farm','factory','power','oil','refinery','barracks','droneport','dramp','dronefab','village','city','mine','sawmill','port','sam','drwy','factory','farm','airport','gaswell']};
function botThink(s){const ai=cfg.rules.ai,R=()=>hsh(s.id*7919+(G.t|0),G.dec++);if(s.dead)return;
  // build: next item of the plan (then repeat its second half)
  s.bT=(s.bT||0)+1;if(!s.builds.some(q=>!q.done)&&s.bT>=[6,4,3][s.diff]){s.bT=0;const plan=BOTPLAN[s.trait]||BOTPLAN.trader;const i=s.planI||0,k=plan[i<plan.length?i:plan.length/2+(i-plan.length)%(plan.length/2)|0];
    if(s.res.money>=BLD[k].cost*1.1){const site=findSite(s,k,R);if(site){startBuild(s,k,site[0],site[1]);s.planI=i+1}else if(R()<0.3)s.planI=i+1}}
  // keep the UAV factories busy
  for(const q of s.builds)if(q.k==='dronefab'&&q.done&&q.queue&&q.queue.length<2&&uavN(s)+q.queue.length<uavCap(s))q.queue.push(R()<(s.trait==='militarist'?0.55:0.35)&&s.builds.some(m=>m.k==='drwy'&&m.done)?'geran':'lancet');
  for(const a of s.armies)if(!a.tpl)a.tpl={trader:'mixed',militarist:R()<0.5?'tank':'assault',cautious:'atdef',adventurer:R()<0.5?'motor':'mixed'}[s.trait]||'mixed';
  // war: not before ~10-12 minutes, only with an army; aggressive AI decides sooner
  const ready=s.armies.some(a=>a.units.length>=6);if(ready&&cfg.rules.ai>0&&G.t>(s.warAfter||(s.warAfter=600+hsh(s.id,99)*120))&&!G.states.some(t=>atWar(s.id,t.id))&&R()<0.05*ai*(s.trait==='militarist'?2:s.trait==='cautious'?0.4:1)){
    // the target: a near neighbour that is not already fighting two wars (no dog-pile on one state)
    const tg=G.states.filter(t=>t!==s&&!t.dead&&t.places.length&&!s.allies.includes(t.id)&&G.states.filter(u=>atWar(u.id,t.id)).length<2).map(t=>[t,distOwn(s,t.places[0].x,t.places[0].y)*(0.7+R()*0.6)]).sort((a,b)=>a[1]-b[1])[0];if(tg)declareWar(s,tg[0])}
  for(const t of G.states){if(!atWar(s.id,t.id)||t.dead)continue;
    for(const a of s.armies){if(a.units.length<5||a.tx!==null)continue;const p=t.places.slice().sort((p1,p2)=>M.hypot(p1.x-a.x,p1.y-a.y)-M.hypot(p2.x-a.x,p2.y-a.y))[0];if(p){a.tx=p.x+(R()-0.5)*600;a.ty=p.y+(R()-0.5)*600}}
    s.dT=(s.dT||0)+DIFF[s.diff].dec;if(s.dT>30){s.dT=0;const tgts=t.builds.filter(q=>q.done&&q.k!=='rail');const q=tgts[(R()*tgts.length)|0]||t.places[0];
      if(q){const u=s.uav||{};const kind=u.geran&&R()<0.6?'geran':u.lancet?'lancet':null;if(!(kind&&!launchUav(s,kind,q.x,q.y,t.id))&&s.res.money>300&&!uavCap(s)&&launchDrone(s,t,q.x,q.y)&&s.res.money!==Infinity)s.res.money-=300}}
    // peace when losing badly
    if(strengthOf(s)<strengthOf(t)*0.4&&R()<0.05)makePeace(s,t)}
  if(cfg.rules.alliances&&G.t-(s.offT||-1e9)>150&&R()<0.012*(1.5-ai*0.5)*(s.trait==='cautious'?1.8:1)){s.offT=G.t;const others=G.states.filter(o=>o!==s&&!o.dead&&!s.allies.includes(o.id)&&!atWar(s.id,o.id));if(others.length){const o=others[(R()*others.length)|0];
      if(o.isP)offerAlly(s);else if(R()<0.5)ally(s,o)}}
  // visa-free travel: a peaceful state with an airport proposes it now and then (to the player — as a question)
  if(airportsOf(s).length&&G.t-(s.visT||-1e9)>200&&R()<0.02){s.visT=G.t;const o=G.states.filter(t=>t!==s&&!t.dead&&t.places.length&&!atWar(s.id,t.id)&&!visa(s,t))[0];
    if(o){if(o.isP)toast(`<b>${esc(s.name)}</b> предлагает безвизовый режим: пассажирские рейсы между вашими странами`,s.flag,[['Принять',()=>{if(!atWar(s.id,o.id))signVisa(o,s);updDip()}],['Отказать',()=>{}]],12000);else if(R()<0.6)signVisa(s,o)}}}
const strengthOf=s=>s.armies.reduce((t,a)=>t+strength(a),0);
function findSite(s,k,R){const b=BLD[k];const dep=f=>G.dep.filter(d=>f(d)&&d.known&&d.used<0&&own[d.c]===s.id+1).map(d=>({x:d.x,y:d.y}));
  const base=k==='farm'?s.places.filter(p=>p.k==='village'):k==='oil'?dep(d=>ORES[d.k].k==='oil'):k==='gaswell'?dep(d=>ORES[d.k].k==='gas'):k==='mine'?dep(d=>!!MINE[d.k]):b.mod?s.builds.filter(q=>q.k==='droneport'&&q.done):s.places;
  for(let t=0;t<40;t++){const p=base[(R()*base.length)|0];if(!p)return null;const r=k==='city'?6000+R()*8000:k==='village'?3500+R()*5000:k==='farm'?500+R()*700:k==='oil'||k==='mine'||k==='gaswell'?0:b.mod?280+R()*500:600+R()*(p.k?placeR(p)+800:600);const a=R()*M.PI*2;
    const x=p.x+M.cos(a)*r,y=p.y+M.sin(a)*r;if(canBuild(s,k,x,y)===null)return [x,y]}return null}
function dropVisa(a,b){a.visa=(a.visa||[]).filter(i=>i!==b.id);b.visa=(b.visa||[]).filter(i=>i!==a.id)}
function ally(a,b){if(a.allies.includes(b.id))return;if(atWar(a.id,b.id))makePeace(a,b);a.allies.push(b.id);b.allies.push(a.id);dirtyFog=true;toast(`<b>${esc(a.name)}</b> и <b>${esc(b.name)}</b> заключили альянс`,a.flag)}
function offerAlly(s){if(G.offers.includes(s.id))return;G.offers.push(s.id);
  toast(`<b>${esc(s.name)}</b> предлагает вам альянс`,s.flag,[['Принять',()=>{G.offers=G.offers.filter(i=>i!==s.id);ally(player(),s);updDip()}],['Отказать',()=>{G.offers=G.offers.filter(i=>i!==s.id)}]],20000)}
function askAlly(o){const ai=cfg.rules.ai;const p=player();const like=(o.trait==='cautious'?0.75:o.trait==='trader'?0.6:o.trait==='militarist'?0.25:0.45)*(1.3-ai*0.3)*(p.score>=o.score?1.15:0.85);
  if(!atWar(p.id,o.id)&&hsh(o.id,G.t|0)<like){ally(p,o)}else toast(`<b>${esc(o.name)}</b> отклоняет союз`,o.flag);o.asked=G.t;updDip()}

// ---------- simulation tick (game seconds)
function sim(dt){G.t+=dt;
  for(const s of G.states){if(s.dead||!s.places.length)continue;
    for(const q of s.builds.slice())if(!q.done){if(q.k==='rail'){const A=byUid(s,q.a),B=byUid(s,q.b);if(!A||!B){s.builds.splice(s.builds.indexOf(q),1);continue}if(!A.done||!B.done)continue}q.t+=dt;if(q.t>=q.time)finishBuild(s,q)}
    if(s.grow<1&&s.cityId>=0&&s.cap){s.grow=M.min(1,s.grow+dt*0.005*(s.isP?1:[0.6,1,1.6][cfg.rules.botGrowth]));syncGrow(s)}
    for(const p of s.places){if(p.grow>=1)continue;const q=p.bq&&s.builds.find(o=>o.uid===p.bq&&!o.done);
      if(q){p.grow=M.max(p.grow,0.05+(q.k==='city'?0.07:0.95)*q.t/q.time);syncPlace(p)}else if(p.k==='city'){p.grow=M.min(1,p.grow+dt*0.008);syncPlace(p)}}
    econ(s,dt);for(const a of s.armies){recruit(s,a,dt);stepArmy(s,a,dt)}}
  stepDrones(dt);stepFlights(dt);
  for(const s of G.states){if(s.isP||s.dead||!s.places.length)continue;s._dt=(s._dt||0)+dt;const iv=DIFF[s.diff].dec;if(s._dt>=iv){s._dt-=iv;botThink(s)}}
  G._popT=(G._popT||0)+dt;if(G._popT>2){G._popT=0;updPop();claimAll()}
  for(const d of G.dep)if(!d.known&&own[d.c]===1)d.known=true;
  G._hidT=(G._hidT||0)+dt;if(G._hidT>1||hidDirty){G._hidT=0;updHidden()}
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
    for(const pl of LS){const q=new Path2D(),W=new Float32Array(pl.length);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let k=0;k<pl.length;k+=2){const X=pl[k]*CSZ,Y=pl[k+1]*CSZ;W[k]=X;W[k+1]=Y;if(k){q.lineTo(X,Y);P.lineTo(X,Y)}else{q.moveTo(X,Y);P.moveTo(X,Y)}x0=M.min(x0,X);y0=M.min(y0,Y);x1=M.max(x1,X);y1=M.max(y1,Y)}s._L.push({P:q,W,bb:[x0,y0,x1,y1]})}
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
// fog of war (stage 5.7): the map is not darkened; buildings of other states are hidden from the tiles until the player
// sees them — within the vision ring around the own (and allied) land, or revealed by an Orlan-10
let hidSig='',hidDirty=true;
function updHidden(){hidDirty=false;if(!api||!api.setHidden||!vis)return;const me=player(),ids=[];
  if(fogOn())for(const s of G.states){if(s===me||me.allies.includes(s.id))continue;for(const q of s.builds){if(!q.done||q.id<0||q.k==='rail'||G.rev.has(q.id))continue;const c=cellOf(q.x,q.y);if(c>=0&&vis[c])continue;ids.push(q.id)}}
  const sig=ids.join(',');if(sig===hidSig)return;hidSig=sig;api.setHidden(ids)}
const seenNow=(x,y)=>{if(!fogOn())return true;const c=cellOf(x,y);return c>=0&&!!vis[c]};
function rebuildFog(){const me=player();const ids=[me.id+1,...me.allies.map(i=>i+1)];vis.fill(0);const R=9,R2=R*R;
  for(let c=0;c<N*N;c++){const o=own[c];if(!o||!ids.includes(o))continue;vis[c]=1;const i=c%N,j=(c/N)|0;
    const edge=i===0||j===0||i===N-1||j===N-1||!ids.includes(own[c-1])||!ids.includes(own[c+1])||!ids.includes(own[c-N])||!ids.includes(own[c+N]);if(!edge)continue;
    for(let b=-R;b<=R;b++)for(let a=-R;a<=R;a++){if(a*a+b*b>R2)continue;const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=N||jj>=N)continue;vis[jj*N+ii]=1}}
  for(let c=0;c<N*N;c++)if(vis[c])expl[c]=1;dirtyFog=false;hidDirty=true}
const fogOn=()=>cfg.rules.fog&&G.phase==='play';
const seenAt=(x,y)=>true; // towns, borders and capitals are always visible; only buildings and troops hide in the fog
function drawOverlay(ctx,A){if(!G||(G.phase==='play'&&!own))return;const m=A.cam.m,VW=A.VW,VH=A.VH;const X0=A.sxw(0),Y0=A.syw(0),S=W.WORLD/m;
  if(G.phase==='play'){
    if(dirtyPol&&performance.now()-polT>500){polT=performance.now();prf('pol',rebuildPol)}
    if(dirtyFog&&performance.now()-fogT>500){fogT=performance.now();prf('fog',rebuildFog)}
    if(mapMode!=='off'&&borders&&!DBG.border){ctx.save();ctx.setTransform(A.DPR/m,0,0,A.DPR/m,A.DPR*(VW/2-A.cam.x/m),A.DPR*(VH/2-A.cam.y/m));ctx.lineCap='round';ctx.lineJoin='round';
      const near=m<45,bw=m<5?1.3:2,far=m>50,vx0=A.cam.x-VW/2*m,vy0=A.cam.y-VH/2*m,vx1=A.cam.x+VW/2*m,vy1=A.cam.y+VH/2*m;ctx.globalAlpha=m<5?0.75:1;
      if(far){if(bordDirty&&performance.now()-bordT>700)prf('bord',rasterBorders);ctx.restore();if(bordC){ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(bordC,X0,Y0,S,S);ctx.restore()}}
      else if(A.gl)glB=true;else for(const [s,P] of borders){const col=s._bc||(s._bc=`rgb(${s.rgb.map(v=>M.min(255,v*1.15+20)|0).join(',')})`);
        if(far)continue;
        const vis=s._L.filter(l=>l.bb[2]>vx0&&l.bb[0]<vx1&&l.bb[3]>vy0&&l.bb[1]<vy1);if(!vis.length)continue;
        if(near){ctx.strokeStyle='rgba(6,10,16,0.5)';ctx.lineWidth=(bw+2.2)*m;for(const l of vis)ctx.stroke(l.P)}ctx.strokeStyle=col;ctx.lineWidth=bw*m;for(const l of vis)ctx.stroke(l.P)}ctx.restore()}
    // the political fill and the fog are composed into one 256 x 256 layer (only when either changes) and drawn once
    const fa=mapMode==='off'||DBG.fill?0:M.round((mapMode==='res'?0.18:0.42)*smoothst(3.5,26,m)*50)/50,fg=false;
    if(dirtyOv||fa!==ovFa||fg!==ovFg){dirtyOv=false;ovFa=fa;ovFg=fg;if(!ovC){ovC=document.createElement('canvas');ovC.width=ovC.height=N}const x=ovC.getContext('2d');x.clearRect(0,0,N,N);
      if(fa>0&&polC){x.globalAlpha=fa;x.drawImage(polC,0,0)}x.globalAlpha=1;if(fg&&fogC)x.drawImage(fogC,0,0);ovE=fa>0||fg}
    if(ovE){ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(ovC,X0,Y0,S,S);
      if(fg&&(X0>0||Y0>0||X0+S<VW||Y0+S<VH)){ctx.fillStyle='rgba(7,12,20,0.83)';ctx.beginPath();ctx.rect(-10,-10,VW+20,VH+20);ctx.rect(X0+0.5,Y0+0.5,S-1,S-1);ctx.fill('evenodd')}ctx.restore()}
    if(!DBG.dep)drawDeposits(ctx,A);if(!DBG.caps)drawCaps(ctx,A);if(mapMode!=='off'&&!DBG.names)drawNames(ctx,A)}
  if(G.phase==='found'){drawDeposits(ctx,A);drawPlacement(ctx,A)}}
// stage 6: the near state borders through GL (A.gl.polyline): the same two strokes (dark outline when near, then the colour),
// device px, only the visible polylines; Canvas 2D re-tessellated these long paths every frame (~0.8 ms)
let glB=false;const BPT=[];
function glBorders(g,A){if(!glB||!borders)return;glB=false;const m=A.cam.m,VW=A.VW,VH=A.VH,D=A.DPR,near=m<45,bw=(m<5?1.3:2)*D,vx0=A.cam.x-VW/2*m,vy0=A.cam.y-VH/2*m,vx1=A.cam.x+VW/2*m,vy1=A.cam.y+VH/2*m;
  g.globalAlpha=m<5?0.75:1;const k=D/m,ox=D*VW/2-A.cam.x*k,oy=D*VH/2-A.cam.y*k,dark=[6/255,10/255,16/255,0.5];
  for(const pass of near?[0,1]:[1])for(const [s] of borders){if(!s._L)continue;const col=pass?(s._bcg||(s._bcg=s.rgb.map(v=>M.min(255,v*1.15+20)/255).concat(1))):dark;
    for(const l of s._L){if(!(l.bb[2]>vx0&&l.bb[0]<vx1&&l.bb[3]>vy0&&l.bb[1]<vy1))continue;const W=l.W,n=W.length/2;if(BPT.length<W.length)BPT.length=W.length;
      for(let i=0;i<W.length;i+=2){BPT[i]=W[i]*k+ox;BPT[i+1]=W[i+1]*k+oy}g.polyline(BPT,n,pass?bw:bw+2.2*D,col)}
    if(!pass)g.linesFlush()}
  g.globalAlpha=1}
function smoothst(a,b,x){let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t)}
// state names: each label is rendered once into its own canvas (per size step) and then just blitted
const NAMEC=new Map();
function nameCanvas(s,sz){const key=s.id+'|'+s.name+'|'+sz;let c=NAMEC.get(key);if(c)return c;if(NAMEC.size>80)NAMEC.clear();
  const t=s.name.toUpperCase(),d=M_DPR(),x0=document.createElement('canvas').getContext('2d');x0.font=`700 ${sz}px Rubik,system-ui,Segoe UI,sans-serif`;const sp=sz*0.18;const ws=[...t].map(ch=>x0.measureText(ch).width);
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
// stage 6.1: one style for every ring and ghost on the map, as DroneFlames draws them: a solid ring (dark "rubber" under a
// thin colour line), an optional translucent band inside, the area tinted green (fits) or red (does not); no dashes
const GH={ok:{fill:'rgba(89,255,115,0.22)',edge:'#bfffcc',ring:'#33f259'},bad:{fill:'rgba(255,77,64,0.24)',edge:'#ff8c80',ring:'#f24d33'},amber:{ring:'#ffb000'},sky:{ring:'#78c8ff'}};
function ring(ctx,X,Y,r,col,fill,band){ctx.save();ctx.setLineDash([]);ctx.beginPath();ctx.arc(X,Y,r,0,7);if(fill){ctx.fillStyle=fill;ctx.fill()}
  if(band&&r>14){ctx.globalAlpha=0.18;ctx.lineWidth=10;ctx.strokeStyle=col;ctx.beginPath();ctx.arc(X,Y,r-5,0,7);ctx.stroke();ctx.globalAlpha=1;ctx.beginPath();ctx.arc(X,Y,r,0,7)}
  ctx.lineWidth=3.5;ctx.strokeStyle='rgba(11,20,48,0.8)';ctx.stroke();ctx.lineWidth=1.6;ctx.strokeStyle=col;ctx.stroke();ctx.restore()}
function cross(ctx,X,Y,k,col){ctx.save();ctx.lineCap='butt';for(const [w,c] of [[4,'rgba(11,20,48,0.8)'],[2,col]]){ctx.lineWidth=w;ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(X-k,Y);ctx.lineTo(X+k,Y);ctx.moveTo(X,Y-k);ctx.lineTo(X,Y+k);ctx.stroke()}ctx.restore()}
function star(ctx,x,y,r){ctx.beginPath();for(let i=0;i<10;i++){const a=-M.PI/2+i*M.PI/5,rr=i%2?r*0.45:r;ctx.lineTo(x+M.cos(a)*rr,y+M.sin(a)*rr)}ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=1;ctx.stroke()}
// stage 6.1: deposits are map badges as in DroneFlames (its ore tiles), drawn as vectors: a rounded square, cream body,
// dark ink outline, the glyph in the colour of the resource with an ink outline; centred on the deposit (48 × 48).
// v: 0 — free, 1 — taken by another state (the caller fades it), 2 — our mine (dark body, as DroneFlames)
const INK='#0b1430';
function oreGlyph(x,o,C,Y,fill,acc){x.fillStyle=fill;x.strokeStyle=fill;x.lineJoin='round';x.lineCap='round';
  switch(o.k){
  case 'oil':x.beginPath();x.moveTo(C,Y-9);x.bezierCurveTo(C+4,Y-2,C+7,Y+1,C+7,Y+4);x.arc(C,Y+4,7,0,M.PI);x.bezierCurveTo(C-7,Y+1,C-4,Y-2,C,Y-9);x.fill();break;
  case 'gas':x.beginPath();x.moveTo(C,Y-10);x.bezierCurveTo(C+8,Y-2,C+7,Y+7,C,Y+8);x.bezierCurveTo(C-7,Y+7,C-8,Y-2,C,Y-10);x.fill();x.fillStyle=acc;x.beginPath();x.moveTo(C,Y-2);x.bezierCurveTo(C+4,Y+2,C+3,Y+6,C,Y+6);x.bezierCurveTo(C-3,Y+6,C-4,Y+2,C,Y-2);x.fill();break;
  case 'coal':for(const [a,b,r] of [[-4,3,5],[4,4,4.4],[0,-4,4.6]]){x.beginPath();for(let q=0;q<6;q++){const t=q/6*M.PI*2+0.3;x.lineTo(C+a+M.cos(t)*r,Y+b+M.sin(t)*r)}x.closePath();x.fill()}break;
  case 'iron':case 'copper':for(const [a,b] of [[-5,4],[5,4],[0,-3]]){x.beginPath();x.moveTo(C+a-4,Y+b-2);x.lineTo(C+a+4,Y+b-2);x.lineTo(C+a+6,Y+b+3);x.lineTo(C+a-6,Y+b+3);x.closePath();x.fill()}break;
  case 'gold':x.beginPath();x.moveTo(C-8,Y-3);x.lineTo(C-4,Y-8);x.lineTo(C+4,Y-8);x.lineTo(C+8,Y-3);x.lineTo(C,Y+8);x.closePath();x.fill();x.strokeStyle=acc;x.lineWidth=1.2;x.beginPath();x.moveTo(C-8,Y-3);x.lineTo(C+8,Y-3);x.moveTo(C-4,Y-8);x.lineTo(C-2,Y-3);x.lineTo(C,Y+8);x.lineTo(C+2,Y-3);x.lineTo(C+4,Y-8);x.stroke();break;
  case 'uran':x.beginPath();x.arc(C,Y,2.4,0,M.PI*2);x.fill();for(let q=0;q<3;q++){const a=-M.PI/2+q*M.PI*2/3;x.beginPath();x.moveTo(C+M.cos(a-0.5)*4,Y+M.sin(a-0.5)*4);x.arc(C,Y,9,a-0.5,a+0.5);x.lineTo(C+M.cos(a+0.5)*4,Y+M.sin(a+0.5)*4);x.closePath();x.fill()}break;
  case 'lith':for(const [a,h,w] of [[-4,8,3],[4,7,3],[0,10,3.4]]){x.beginPath();x.moveTo(C+a,Y-h);x.lineTo(C+a+w,Y-h+3);x.lineTo(C+a+w,Y+7);x.lineTo(C+a-w,Y+7);x.lineTo(C+a-w,Y-h+3);x.closePath();x.fill()}break}
}
function oreIcon(k,v){v=v||0;const key='o'+k+':'+v;if(ICONS[key])return ICONS[key];const c=document.createElement('canvas');c.width=48;c.height=48;const x=c.getContext('2d'),o=ORES[k];
  const rr=(p,r)=>{x.beginPath();x.roundRect?x.roundRect(p,p,48-p*2,48-p*2,r):x.rect(p,p,48-p*2,48-p*2)};
  const body=v===2?'#2a3142':'#f4efe0';
  rr(2,9);x.fillStyle=INK;x.fill();                                  // ink frame
  rr(5,6);x.fillStyle=body;x.fill();                                 // body
  x.fillStyle=v===2?'rgba(0,0,0,0.25)':'rgba(60,48,30,0.14)';x.fillRect(6,36,36,5); // the lower lip, as the tiles of DroneFlames
  if(v===0){x.lineWidth=1.2;x.strokeStyle='rgba(255,241,196,0.9)';rr(1.2,10);x.stroke()}
  // the glyph: an ink outline (the glyph dilated), then the colour; the glyph is scaled into the body
  const g=document.createElement('canvas');g.width=g.height=48;const gx=g.getContext('2d');gx.translate(24,24);gx.scale(0.95,0.95);gx.translate(-24,-22);
  oreGlyph(gx,o,24,22,INK,INK);
  for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2],[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]])x.drawImage(g,dx,dy);
  gx.setTransform(1,0,0,1,0,0);gx.clearRect(0,0,48,48);gx.translate(24,24);gx.scale(0.95,0.95);gx.translate(-24,-22);
  const lt=o.k==='oil'?'#5b5b66':o.k==='coal'?'#7a7a80':o.c;oreGlyph(gx,o,24,22,lt,body);x.drawImage(g,0,0);
  return ICONS[key]=c}
function drawDeposits(ctx,A){const m=A.cam.m,fd=G.phase==='found';if(!fd&&(mapMode==='off'||(mapMode==='pol'&&m>40)))return;const z=(mapMode==='res'||fd?1:smoothst(40,18,m))*smoothst(75,45,m);if(z<=0.02)return;ctx.globalAlpha=z;
  for(const d of G.dep){if(!d.known)continue;const X=A.sxw(d.x),Y=A.syw(d.y);if(X<-20||Y<-20||X>A.VW+20||Y>A.VH+20)continue;
    if(d.used>=0&&mapMode!=='res'&&A.cam.m<12)continue;const sz=mapMode==='res'?24:20;const mine=d.used>=0&&own&&own[d.c]===1;const ic=oreIcon(d.k,mine?2:0);ctx.globalAlpha=z*(d.amt<=0?0.35:d.used>=0&&!mine?0.5:1);ctx.drawImage(ic,M.round(X-sz/2),M.round(Y-sz/2),sz,sz);
    if(d.max!==Infinity&&mapMode==='res'){ctx.fillStyle=INK;ctx.fillRect(X-10,Y+sz/2+1,20,4);ctx.fillStyle=ORES[d.k].c;ctx.fillRect(X-9,Y+sz/2+2,18*d.amt/d.max,2)}
    const o=own?own[d.c]:0;if(o&&mapMode==='res'){ctx.fillStyle=INK;ctx.fillRect(X+sz/2-5,Y-sz/2-2,7,7);ctx.fillStyle=G.states[o-1].color;ctx.fillRect(X+sz/2-4,Y-sz/2-1,5,5)}}ctx.globalAlpha=1}
function drawPlacement(ctx,A){if(pend){const X=A.sxw(pend.x),Y=A.syw(pend.y),r=M.max(12,2900/A.cam.m);ring(ctx,X,Y,r,GH.ok.ring,GH.ok.fill);ctx.fillStyle='#ffd25a';star(ctx,X,Y,7);return}
  if(!placing||!A.hover.on){capPrompt(null);return}const [x,y]=A.toWorld(A.hover.x,A.hover.y);const bad=validSite(x,y);const r=2900/A.cam.m;const X=A.hover.x,Y=A.hover.y,c=bad?GH.bad:GH.ok;
  // the game draws the only crosshair (the system cursor is hidden over the map while the capital is placed)
  ring(ctx,X,Y,M.max(10,r),c.ring,c.fill);cross(ctx,X,Y,12,c.ring);capPrompt(bad||'')}
// the capital prompt in the placement bar on top (as the prompt box of DroneFlames), not a label at the cursor
let capSig=null;function capPrompt(bad){const el=$('pbar');if(!el)return;if(bad===null){if(capSig!==null&&!(G&&G.phase==='play'&&G.build))el.classList.remove('show');capSig=null;return}
  el.classList.add('show');if(bad===capSig)return;capSig=bad;el.classList.toggle('bad',!!bad);el.classList.remove('touch');$('pbi').className='ic ic-capital';$('pbt').textContent='Столица';$('pbs').innerHTML=bad?`<span class="neg">${esc(bad)}</span>`:'Кликните по карте: здесь встанет столица. Лучше равнина у реки или моря';
  for(const b of ['pbrot','pbok','pbno'])$(b).hidden=true}
function drawMini(mx,s){if(!G||G.phase!=='play'||!own)return;const S=W.WORLD*s;if(polC){mx.globalAlpha=0.55;mx.imageSmoothingEnabled=true;mx.drawImage(polC,0,0,S,S);mx.globalAlpha=1}
  drawMiniBuilds(mx,s);for(const st of G.states){if(!st.cap||!seenAt(st.cap.x,st.cap.y))continue;mx.fillStyle=st.isP?'#ffd25a':'#fff';mx.fillRect(st.cap.x*s-2,st.cap.y*s-2,4,4)}}

// ---------- HUD and panels
const $=id=>document.getElementById(id);
function setSpeed(v){G.speed=v;if(v)G._lastSp=v;const b=$('bpause');b.classList.toggle('on',v===0);b.querySelector('.ic').className='ic '+(v===0?'ic-play':'ic-pause');$('bspd').textContent='x'+(v||G._lastSp||1);if(api)api.setTodRate(v*4/60)}
function gameClock(){const [d,hm]=clockParts();return `День ${d} · ${hm}`}
function clockParts(){const mins=8*60+G.t*4;return [M.floor(mins/1440)+1,String(M.floor(mins/60)%24).padStart(2,'0')+':'+String(M.floor(mins)%60).padStart(2,'0')]}
const fmtT=s=>{s=M.round(s);const h=M.floor(s/3600),m=M.floor(s/60)%60,ss=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(ss).padStart(2,'0')};
const sgn=v=>(v>=0?'+':'−')+fmtK(M.abs(v));
// short numbers for the resources pill (as in DroneFlames: 250К)
const fmtS=n=>n===Infinity?'∞':n>=1e6?(n/1e6).toFixed(n>=1e7?0:1).replace('.',',')+'М':n>=1e4?M.round(n/1000)+'К':fmt(n);
const GEN={food:'еды',goods:'товаров',wood:'древесины',oil:'нефти',fuel:'топлива',metal:'металла'};
// the store chip: «Склад», or what runs out first («Мало нефти», «Нет топлива»), or a full store (ports sell the surplus)
function shortage(p){const r=p.res,f=p.flow||{};let k0=null,t0=1e9;for(const k of RES){const v=f[k]||0;if(v>-0.05)continue;const t=r[k]/-v;if(t<t0){t0=t;k0=k}}
  if(k0&&t0<40)return [(r[k0]<1?'Нет ':'Мало ')+GEN[k0],1];const en=p.energy||[0,0];if(en[1]>en[0]+0.01)return ['Мало энергии',1];
  if(RES.some(k=>r[k]>=(p.store||400)*0.98))return ['Склад полон',0];return ['Склад',-1]}
function updHUD(){const p=player(),r=p.res,f=p.flow||{};
  $('rmoney-v').textContent=fmtS(r.money);const inc=$('rinc-v');inc.textContent=r.money===Infinity?'':sgn(p.income||0)+'/с';inc.className=(p.income||0)>=0?'pos':'neg';
  for(const k of RES){const e=$('r'+k+'-v'),v=f[k]||0;e.textContent=fmtS(r[k]);e.className=v<-0.05&&r[k]<-v*40?'neg':'';e.parentNode.title=`${RESN[k]}: ${fmt(r[k])} из ${fmt(p.store||400)}${M.abs(v)<0.05?'':' · '+sgn(v)+' в секунду'}`}
  const en=p.energy||[0,0],ee=$('renergy-v');ee.textContent=fmt(en[1])+'/'+fmt(en[0]);ee.className=en[1]>en[0]+0.01?'neg':en[3]>0?'warn':'';
  ee.parentNode.title=`Энергия: нужно ${fmt(en[1])} из ${fmt(en[0])}`+(p.batC?` · аккумулятор ${M.round((p.bat||0)/p.batC*100)} %`:'')+(en[3]>0?' · сейчас выручает аккумулятор':'');
  $('rpop-v').textContent=fmtS(p.pop);const sh=shortage(p),se=$('rstore');se.textContent=sh[0];se.className=sh[1]>0?'neg':sh[1]===0?'warn':'';
  const [d,hm]=clockParts(),lim=cfg.rules.timeLimit*60;$('gclock').textContent=hm;$('glimit').textContent='день '+d+(lim>0?' · ост. '+fmtT(M.max(0,lim-G.t)):'');
  updRace(p);updPanel();updCatalog();updMyState();updStore();updOres();updHQ();bbh()}
// the height of the bottom dock on the screen → --bbh (the minimap, the scale and the side windows stand above it)
let bbH=-1;function bbh(){const h=M.round($('bbar').getBoundingClientRect().height);if(h!==bbH){bbH=h;document.documentElement.style.setProperty('--bbh',h+'px')}}
// score and the race to victory (as in DroneFlames: «лидер 3,5/10 тыс.»)
function updRace(p){$('hscore').textContent=fmt(p.score);const r=cfg.rules,el=$('hrace');const L=G.states.filter(s=>!s.dead&&s.places.length).sort((a,b)=>b.score-a.score)[0];let t='',c='';
  if(G.phase!=='play'||!L)t='основание столицы';
  else if(r.victory==='points'){const lead=L===p,pct=L.score/r.target;t=(lead?'вы лидер ':'лидер ')+(L.score/1000).toFixed(1).replace('.',',')+'/'+String(r.target/1000).replace('.',',')+' тыс.';c=lead?'ok':pct>=0.8?'bad':pct>=0.6?'warn':''}
  else if(r.victory==='capitals')t='столиц: '+G.states.filter(s=>s.cap&&!s.lostCap&&!s.dead).length;
  else{t=L===p?'вы лидер':'лидер: '+L.name;c=L===p?'ok':''}
  el.textContent=t;el.className=c}
// the state window (a click on the flag or the name)
function updMyState(){const w=$('mystate');if(!w.classList.contains('show')||!G||G.phase!=='play')return;const p=player();
  const wars=G.states.filter(t=>atWar(p.id,t.id)).map(t=>esc(t.name)),al=G.states.filter(t=>p.allies.includes(t.id)).map(t=>esc(t.name)),qs=p.builds.filter(q=>!q.done);
  const h=stat('Столица',esc(p.capital)+' · рост '+M.round(p.grow*100)+' %')+stat('Население',fmtK(p.pop))+stat('Города и сёла',p.places.length)+stat('Постройки',p.builds.filter(q=>q.done).length)+stat('Земли',fmt(p.cells*0.26)+' км²')+
    stat('Армии',p.armies.length?p.armies.map(a=>'№'+a.n+' ('+a.units.length+')').join(', '):'нет')+stat('Войны',wars.length?wars.join(', '):'нет')+stat('Союзники',al.length?al.join(', '):'нет')+stat('Очки',fmt(p.score))+
    `<div class="pc-s">Стройка</div>`+(qs.length?qs.map(q=>stat(bName(q),M.round(q.t/q.time*100)+' %')).join(''):'<p class="note">Ничего не строится. Постройки — на панели внизу.</p>')+
    `<div class="tpls" style="margin-top:8px"><button class="btn sm" id="a-home">К столице</button><button class="btn sm" id="a-dip">Дипломатия</button></div>`;
  const b=$('msb');if(b._h===h)return;b._h=h;b.innerHTML=h;$('a-home').onclick=()=>{const q=p.places[0];if(q)api.flyTo(q.x,q.y,3)};$('a-dip').onclick=()=>{$('dip').classList.add('show');updDip()}}
// the store window (a click on the resources pill): stock / capacity and the flow of every resource
function updStore(){const w=$('store');if(!w.classList.contains('show')||!G)return;const p=player(),r=p.res,f=p.flow||{},cap=p.store||400,en=p.energy||[0,0];const fl=v=>`<small class="${v>0.05?'pos':v<-0.05?'neg':''}">${M.abs(v)<0.05?'±0':sgn(v)}/с</small>`;
  let h=stat('<i class="ri ri-money"></i>Деньги',(r.money===Infinity?'∞':fmt(r.money))+' '+fl(p.income||0))+stat('<i class="ri ri-energy"></i>Энергия','нужно '+fmt(en[1])+' из '+fmt(en[0])+(p.batC?' · АКБ '+M.round((p.bat||0)/p.batC*100)+' %':''));
  for(const k of RES)h+=stat(`<i class="ri ri-${k}"></i>${RESN[k]}`,fmt(r[k])+' / '+fmt(cap)+' '+fl(f[k]||0));
  h+=stat('<i class="ri ri-pop"></i>Население',fmt(p.pop));const sh=shortage(p);
  h+=`<p class="note">${sh[1]>0?'<b style="color:var(--tr)">'+sh[0]+'.</b> ':''}Склад вмещает ${fmt(cap)} каждого ресурса. ${cap>400?'Порты продают всё, что выше 70 %, и докупают еду.':'Порт на берегу добавит +800 и будет продавать излишки.'}</p>`;
  const b=$('stb');if(b._h===h)return;b._h=h;b.innerHTML=h}
let panelSig='';
const stat=(n,v)=>`<div class="stat"><span>${n}</span><b>${v}</b></div>`;
// the card of the selection (as in DroneFlames): the icon slot, the orange title, the state, ✕; then the keys and the description
const pcHead=(ic,t,sub)=>`<div class="pc-h"><span class="sl"><span class="ic ${ic}"></span></span><div class="pc-t"><b>${t}</b><small>${sub}</small></div><button class="xb" id="a-close" title="Закрыть (Esc)">✕</button></div>`;
function updPanel(){const bd=document.body;bd.classList.toggle('ph-found',G.phase==='found');bd.classList.toggle('ph-play',G.phase==='play');
  if(G.phase==='found'){bd.classList.remove('sel');$('a-found').classList.toggle('on',placing);return}
  const el=$('gpanel'),a=G.sel&&G.sel.army,sb=G.sel&&G.sel.build,sd=G.sel&&G.sel.dep!=null;bd.classList.toggle('sel',!!(a||sb||sd));
  if(a)return armyPanel(el,a);if(sb)return buildPanel(el,sb);if(sd)return depPanel(el,G.sel.dep);if(panelSig){panelSig='';el.innerHTML=''}}
const closeSel=()=>{G.sel=null;G.mode=null;panelSig='';updPanel();updCatalog()};
function armyPanel(el,a){const p=player();const sig='army'+a.id+'|'+a.tpl+'|'+a.units.join('')+'|'+(G.mode||'')+'|'+atWarAny()+'|'+p.uav.lancet;
  if(sig===panelSig)return;panelSig=sig;const comp={};for(const u of a.units)comp[u]=(comp[u]||0)+1;const war=atWarAny(),ln=p.uav.lancet||0;
  el.innerHTML=pcHead('ic-b-army','Армия №'+a.n,`бойцов ${a.units.length} / 12 · сила ${fmt(strength(a))} · ${a.tpl?TPL[a.tpl].n:'без сборки'}`)+
    `<div class="pc-s">Сборка — состав армии</div><div class="tpls">`+Object.entries(TPL).map(([k,t])=>`<button class="btn sm${a.tpl===k?' on':''}" data-tpl="${k}" title="${Object.entries(t.u).map(([u,n])=>UNIT[u].n+' '+n).join(', ')}">${t.n}</button>`).join('')+`</div>`+
    `<div class="pc-s">Приказы</div><div class="pc-r">`+card({id:'a-move',n:'Двигаться',sub:G.mode==='move'?'клик по карте':'',ic:'ic-move',cls:G.mode==='move'?'on':'',tip:'Затем кликните по карте — куда идти'})+
    card({id:'a-drone',n:'Ланцет',sub:!war?'нет войны':ln?'готово: '+ln:'нет готовых',ic:'ic-b-lancet',cls:G.mode==='uav:lancet'?'on':'',dis:!(war&&ln),tip:'Удар Ланцетом: кликните по цели на вражеской земле'})+
    card({id:'a-go',n:'Показать',ic:'ic-scout',tip:'Камера к армии'})+`</div>`+
    `<div class="pc-d">Состав: ${Object.entries(comp).map(([u,n])=>UNIT[u].n+' '+n).join(', ')||'—'}. Бойцы набираются по одному раз в 4 с, пока хватает денег (пехота 60 … танк 260).</div>`;
  $('a-close').onclick=closeSel;
  for(const b of el.querySelectorAll('[data-tpl]'))b.onclick=()=>{a.tpl=b.dataset.tpl;panelSig='';updPanel();onBuilt('assembly',true)};
  $('a-move').onclick=()=>{G.mode=G.mode==='move'?null:'move';panelSig='';updPanel()};$('a-drone').onclick=()=>{G.mode=G.mode==='uav:lancet'?null:'uav:lancet';panelSig='';updPanel()};
  $('a-go').onclick=()=>api.flyTo(a.x,a.y,4)}
const PCS={droneport:'Модули и питание',dronefab:'Производство дронов',station:'Железная дорога',barracks:'Военная часть'};
const UPGS={sol:'Солнце',net:'Сетка',con:'Бетон'},UPGI={sol:'ic-b-solar',net:'ic-net',con:'ic-con'};
function buildPanel(el,q){const p=player(),b=q.k==='rail'?{n:'ЖД путь',d:'Линия между двумя вокзалами: поезда и торговля, +'+fmt(3+q.L/1500)+' в секунду',cost:q.cost}:BLD[q.k];
  const sig='b'+q.uid+'|'+q.done+'|'+(q.off>0?M.ceil(q.off):0)+'|'+(q.done?'':M.round(q.t/q.time*20))+'|'+(q.k==='dronefab'?(q.queue||[]).join(',')+'|'+M.floor((q.pt||0))+'|'+(q.wait||'')+'|'+JSON.stringify(q.up||{}):'')+'|'+(q.k==='droneport'?JSON.stringify(p.uav)+p.builds.filter(m=>m.port===q.uid).map(m=>m.k+m.done+M.round(m.t/m.time*20)).join(','):'')+'|'+G.mode+'|'+G.build+'|'+M.floor(p.res.money/100);
  if(sig===panelSig)return;panelSig=sig;
  const pr=prodOf(q)?Object.entries(prodOf(q)).map(([k,v])=>RESN[k]+' +'+v).join(', '):q.k==='solar'?'энергия до +'+b.solar+' днём, аккумулятор '+b.bat:'';
  const nd=needOf(p,q)?Object.entries(needOf(p,q)).map(([k,v])=>RESN[k]+' '+v).join(', '):'';
  const state=!q.done?'строится '+M.round(q.t/q.time*100)+' %':q.off>0?'не работает '+M.ceil(q.off)+' с':'работает';
  let g=stat('Даёт в секунду',pr||'—')+stat('Нужно',nd||'—'),keys='',more='';
  if(q.dep!=null){const d=G.dep[q.dep];g+=stat('Месторождение',ORES[d.k].n+' · '+(d.amt===Infinity?'∞':fmt(d.amt)))}
  if(q.k==='droneport'){const m=k=>p.builds.find(x=>x.k===k&&x.port===q.uid);
    for(const k of ['dramp','drwy','dstore']){const x=m(k);keys+=card({n:SHORT[k],tn:BLD[k].n,sub:x?(x.done?'есть':M.round(x.t/x.time*100)+' %'):fmt(BLD[k].cost),ic:'ic-b-'+k,data:x?'':`data-mod="${k}"`,cls:x?(x.done?'done':''):G.build===k?'on':'',tip:BLD[k].d})}
    if(!solarNear(p,q))keys+=card({n:'Солнце',tn:'Солнечные панели рядом',sub:fmt(BLD.solar.cost),ic:'ic-b-solar',data:'data-mod="solar"',cls:G.build==='solar'?'on':'',tip:'Питание дронопорта без сети: поставьте панели рядом (до 700 м)'});
    const u=p.uav||{};g+=stat('Питание',solarNear(p,q)?'солнечные панели рядом':portPowered(p,q)?'от сети':'нет энергии')+stat('Дроны · '+uavN(p)+' / '+uavCap(p),Object.keys(DRN).map(k=>DRN[k].n+' '+(u[k]||0)).join(', '))}
  if(q.k==='dronefab'){for(const [k,d] of Object.entries(DRN))keys+=card({n:d.n,sub:fmt(d.cost),ic:'ic-b-'+d.ic,data:`data-make="${k}"`,tc:`${fmt(d.cost)} · металл ${d.metal}${d.fuel?' · топливо '+d.fuel:''} · ${d.time} с`,tip:d.d});
    const Q=q.queue||[];if(Q.length)keys+=card({id:'a-qclr',n:'Очистить',sub:Q.length+' в очереди',ic:'ic-b-demolish',tip:'Очистить очередь цеха: оплаченный дрон вернёт деньги и сырьё'});
    g+=stat('Очередь',Q.length?Q.map(k=>DRN[k].n).join(', '):'пусто');if(Q.length)g+=stat(DRN[Q[0]].n,q.wait?q.wait:M.round((q.pt||0)/DRN[Q[0]].time*100)+' %');g+=stat('Дронов на складах',uavN(p)+' / '+uavCap(p));
    more=`<div class="pc-s">Улучшения</div><div class="pc-r">`+Object.entries(UPG).map(([k,u])=>card({n:UPGS[k],tn:u.n,sub:q.up&&q.up[k]?'есть':fmt(u.cost),ic:UPGI[k],data:q.up&&q.up[k]?'':`data-up="${k}"`,cls:q.up&&q.up[k]?'done':'',tip:u.d})).join('')+`</div>`+
      (uavCap(p)?'':'<div class="pc-d">Готовым дронам нужен дронопорт (вкладка «Удар»).</div>')}
  if(q.k==='station'){g+=stat('Линий',p.builds.filter(r=>r.k==='rail'&&(r.a===q.uid||r.b===q.uid)).length);keys+=card({id:'a-rail',n:'Ж/Д путь',sub:fmt(RAILK*1000)+' / км',ic:'ic-b-rail',cls:G.mode==='rail'?'on':'',tip:'Нажмите на вокзал и, не отпуская, ведите путь к другому вокзалу или в поле'})}
  if(q.k==='airport'){const F=(G.flights||[]).filter(f=>f.a===q),dest=[...new Set(F.map(f=>G.states[f.to].isP?'свой аэропорт':G.states[f.to].name))];
    g+=stat('В воздухе',F.length?F.map(f=>(f.kind==='pax'?'пассажирский':'грузовой')).join(', '):'нет')+stat('Куда летят',dest.length?dest.join(', '):'—')+stat('Безвиз',G.states.filter(t=>t!==p&&visa(p,t)).map(t=>t.name).join(', ')||'нет — договоритесь в «Дипломатии»')+stat('Рейсов выполнено',fmt(p.landed||0))}
  if(q.k==='barracks')keys+=card({id:'a-army',n:'Армия',ic:'ic-b-army',tip:'Армия этой части: сборка и приказы'});
  keys+=card({id:'a-dem',n:'Снести',sub:fmt((b.cost||0)*0.3),ic:'ic-b-demolish',cls:'red',tip:'Снести постройку: вернётся 30 % цены'});
  el.innerHTML=pcHead(q.k==='rail'?'ic-b-rail':'ic-b-'+q.k,b.n,state+(pr?' · '+pr:''))+`<div class="pc-s">${PCS[q.k]||'Действия'}</div><div class="pc-r">${keys}</div>${more}<div class="pc-g">${g}</div><div class="pc-d">${b.d}</div>`;
  $('a-close').onclick=closeSel;$('a-dem').onclick=()=>{demolish(player(),q);closeSel();updHUD()};
  const ab=$('a-army');if(ab)ab.onclick=()=>{const a=player().armies.find(x=>x.home===q);if(a){G.sel={army:a};panelSig='';updPanel()}};
  const rb=$('a-rail');if(rb)rb.onclick=()=>{setBuild(null);G.mode=G.mode==='rail'?null:'rail';panelSig='';updCatalog();if(G.mode)toast('Нажмите на вокзал и, не отпуская, ведите путь к другому вокзалу или к месту нового','ic-b-rail')};
  for(const e of el.querySelectorAll('[data-mod]'))e.onclick=()=>{G.forPort=q;setBuild(G.build===e.dataset.mod?null:e.dataset.mod);panelSig=''};
  for(const e of el.querySelectorAll('[data-make]'))e.onclick=()=>{const Q=q.queue||(q.queue=[]);if(Q.length>=6){toast('Очередь цеха полна (6)');return}Q.push(e.dataset.make);panelSig='';onBuilt('order',true)};
  const qc=$('a-qclr');if(qc)qc.onclick=()=>{if(q.paid){const d=DRN[q.queue[0]];if(p.res.money!==Infinity)p.res.money+=d.cost;p.res.metal+=d.metal;p.res.fuel+=d.fuel;q.paid=0}q.queue=[];q.pt=0;panelSig=''};
  for(const e of el.querySelectorAll('[data-up]'))e.onclick=()=>buyUp(p,q,e.dataset.up)}
function buyUp(s,q,u){const c=creative()&&s.isP?0:UPG[u].cost;if(s.res.money<c){toast('Не хватает денег: нужно '+fmt(c));return false}if(s.res.money!==Infinity)s.res.money-=c;q.up=q.up||{};q.up[u]=1;if(q.done&&q.id>=0)api.op('zoneUp',[q.id,u]);panelSig='';if(s.isP)toast(`Цех БПЛА: <b>${UPG[u].n}</b>`,UPGI[u]);return true}
const atWarAny=()=>G.states.some(t=>atWar(0,t.id));
// bottom panel (as in DroneFlames): tabs КАРТА ГОРОДА УДАР ПВО АРМИЯ ПОЛИТ. ФЛОТ on the panel: pause, speed, then the keys of the tab
const TABS=[['map','Карта'],['cities','Города'],['strike','Удар'],['aa','ПВО'],['army','Армия'],['pol','Полит.'],['fleet','Флот']];
const ECON=['city','village','farm','factory','power','solar','mine','sawmill','oil','gaswell','refinery','port','airport','station'];
const STRIKE=['droneport','dramp','drwy','dstore','dronefab'];
const tabOf=k=>k==='sam'?'aa':k==='barracks'||k==='assembly'?'army':ECON.includes(k)||k==='rail'?'cities':STRIKE.includes(k)||k==='order'||k==='uav'?'strike':null;
let tab='cities',tabSig='';
const TABIC={map:'ic-tab-map',cities:'ic-tab-city',strike:'ic-tab-strike',aa:'ic-tab-aa',army:'ic-tab-army',pol:'ic-tab-pol',fleet:'ic-tab-fleet'};
const TABSUB={map:'Слои карты и переходы',cities:'Экономика: города, сёла, заводы, энергия, добыча, железная дорога',strike:'Дронопорт, его модули, цех БПЛА и удары дронами',aa:'Противовоздушная оборона',army:'Военные части и армии',pol:'Государства, союзы, война и мир',fleet:'Порты и флот'};
// the short names of the keys (the full one is in the tooltip)
const SHORT={city:'Город',village:'Село',farm:'Колхоз',factory:'Завод',power:'ТЭЦ',solar:'Солнце',mine:'Рудник',sawmill:'Лесопилка',oil:'Нефть',gaswell:'Газ',refinery:'НПЗ',port:'Порт',airport:'Аэропорт',station:'Вокзал',
  barracks:'Воен. часть',sam:'ПВО',droneport:'Дронопорт',dramp:'Рампа',drwy:'ВПП',dstore:'Склад БПЛА',dronefab:'Цех БПЛА'};
function buildTabs(){const t=$('bb-tabs');t.innerHTML='';TABS.forEach(([k,n],i)=>{const b=document.createElement('button');b.dataset.t=k;b.dataset.tn=n+' · клавиша '+(i+1);b.dataset.td=TABSUB[k];
  b.innerHTML=`<i>${i+1}</i><span class="ic ${TABIC[k]}"></span><b>${n}</b>`;b.onclick=()=>setTab(k,true);t.appendChild(b)})}
// a click on a tab closes the card of the selection; on the open tab it folds the panel, on another one opens it
function setTab(k,user){const bd=document.body;if(user&&G&&G.sel){G.sel=null;G.mode=null;panelSig='';bd.classList.remove('sel','tray-off');if(G.phase==='play')updPanel()}
  else if(user&&k===tab)bd.classList.toggle('tray-off');else bd.classList.remove('tray-off');tab=k;tabSig='';updCatalog()}
// a key as in DroneFlames: the square slot with the icon, the short name under it and the price (or the state) under that
const card=(o)=>`<button class="bcat${o.cls?' '+o.cls:''}"${o.id?` id="${o.id}"`:''} ${o.data||''} ${o.dis?'disabled':''} data-tn="${esc(o.tn||o.n)}" data-td="${esc(o.tip||'')}"${o.tc?` data-tc="${esc(o.tc)}"`:''}><span class="sl"><span class="ic ${o.ic}"></span>${o.badge!=null?`<i class="bd">${o.badge}</i>`:''}</span><b${String(o.n).replace(/<[^>]*>|&[a-z#0-9]+;/g,'x').length>9?' class="cn"':''}>${o.n}</b>${o.sub?`<small>${o.sub}</small>`:''}</button>`;
const costTip=b=>'Цена '+fmt(b.cost)+(b.need?' · нужно: '+Object.entries(b.need).map(([k,v])=>RESN[k].toLowerCase()+' '+v).join(', '):'')+(b.prod?' · даёт: '+Object.entries(b.prod).map(([k,v])=>RESN[k].toLowerCase()+' +'+v).join(', '):'');
function tabCards(){const p=player(),out=[];
  if(G.phase==='found')return tab==='cities'?card({n:'Столица',tn:'Основать столицу',sub:placing?'клик по карте':'выбор места',ic:'ic-capital',data:'data-found="1"',cls:placing?'on':'',tip:'Кликните по карте, где стоять столице. Хорошее место: равнина у реки или моря, подальше от края мира'})
    :'<div class="bb-note">Сначала основайте столицу — вкладка «Города»</div>';
  if(tab==='map'){out.push(card({n:'Границы',tn:'Государства',sub:'слой',ic:'ic-land',data:'data-m="pol"',cls:mapMode==='pol'?'on':'',tip:'Границы и цвета государств'}),card({n:'Залежи',tn:'Ресурсы',sub:'слой',ic:'ic-ore',data:'data-m="res"',cls:mapMode==='res'?'on':'',tip:'Все известные месторождения'}),card({n:'Рельеф',tn:'Местность',sub:'без слоёв',ic:'ic-new',data:'data-m="off"',cls:mapMode==='off'?'on':''}),
    card({n:'Столица',tn:'К столице',sub:esc(p.capital),ic:'ic-capital',data:'data-go="cap"'}),card({n:'Весь мир',sub:'131 км',ic:'ic-star',data:'data-go="world"',tip:'Вся карта 131 × 131 км'}))}
  else if(tab==='cities'){for(const k of ECON){const b=BLD[k];out.push(card({n:SHORT[k],tn:b.n,sub:fmt(b.cost),ic:'ic-b-'+k,data:`data-k="${k}"`,tc:costTip(b),tip:b.d}));
      if(k==='station'){const n=p.builds.filter(q=>q.k==='station'&&q.done).length;out.push(card({n:'Ж/Д путь',tn:'ЖД путь',sub:n>=1?fmt(RAILK*1000)+'/км':'нужен вокзал',ic:'ic-b-rail',data:'data-mode="rail"',dis:n<1,tip:'Нажмите на вокзал и, удерживая, ведите путь: до другого вокзала — соединит их, в поле — там встанет новый вокзал'}))}}
    out.push(card({n:'Снести',sub:'30 % назад',ic:'ic-b-demolish',data:'data-mode="demolish"',cls:'red',tip:'Кликните по своей постройке, чтобы снести её'}))}
  else if(tab==='strike'){const port=p.builds.some(q=>q.done&&q.k==='droneport'),u=p.uav||{};
    for(const k of STRIKE){const b=BLD[k];const dis=b.mod&&!port;out.push(card({n:SHORT[k],tn:b.n,sub:dis?'нужен порт':fmt(b.cost),ic:'ic-b-'+k,data:`data-k="${k}"`,dis,tc:costTip(b),tip:b.d+(dis?'. Сначала постройте дронопорт':'')}))}
    for(const [k,d] of Object.entries(DRN)){const site=launchSite(p,d.from),war=atWarAny();const why=!u[k]?'нет готовых':!site?(d.from==='drwy'?'нужна ВПП':'нужна рампа'):!d.recon&&!war?'нет войны':'';
      out.push(card({n:d.n,sub:why||'пуск',badge:u[k]||0,ic:'ic-b-'+d.ic,data:`data-mode="uav:${k}"`,dis:!!why,tip:d.d+(d.recon?'. Кликните по точке на карте':'. Кликните по цели на земле противника')}))}}
  else if(tab==='aa'){out.push(card({n:'ПВО',tn:BLD.sam.n,sub:fmt(BLD.sam.cost),ic:'ic-b-sam',data:'data-k="sam"',tc:costTip(BLD.sam),tip:BLD.sam.d}));p.builds.filter(q=>q.k==='sam').forEach((q,i)=>out.push(card({n:'ПВО №'+(i+1),sub:!q.done?'строится':q.off>0?'подавлена':'дежурство',ic:'ic-b-sam',data:`data-fly="${q.x|0},${q.y|0}"`,tip:'Показать на карте'})))}
  else if(tab==='army'){out.push(card({n:SHORT.barracks,tn:BLD.barracks.n,sub:fmt(BLD.barracks.cost),ic:'ic-b-barracks',data:'data-k="barracks"',tc:costTip(BLD.barracks),tip:BLD.barracks.d}));
    p.armies.forEach((a,i)=>out.push(card({n:'Армия №'+a.n,sub:a.units.length+'/12',ic:'ic-b-army',data:`data-army="${i}"`,cls:G.sel&&G.sel.army===a?'on':'',tip:a.tpl?TPL[a.tpl].n:'Без сборки — выберите состав в карточке армии'})))}
  else if(tab==='pol'){for(const t of G.states){if(t.isP||!t.places.length)continue;const rel=p.allies.includes(t.id)?'союзник':atWar(p.id,t.id)?'война':'мир';out.push(card({n:esc(t.name),sub:rel,ic:'fl-'+t.id,data:`data-st="${t.id}"`,cls:rel==='война'?'war':rel==='союзник'?'ally':'',tip:esc(t.gov)+' · '+fmt(t.score)+' очков'}))}
    out.push(card({n:'Дипломатия',sub:'все',ic:'ic-dip',data:'data-go="dip"',tip:'Все государства: альянсы, война и мир'}))}
  else if(tab==='fleet'){const ports=p.builds.filter(q=>q.done&&q.k==='port').length;out.push(card({n:'Верфь',sub:'скоро',ic:'ic-tab-fleet',dis:true,tip:'Флот появится на следующем этапе. Для него нужен порт'}),card({n:'Порты',sub:ports?ports+' шт.':'нет',ic:'ic-b-port',data:'data-tab="cities"',tip:'Порт ставится во вкладке «Города»'}))}
  return out.join('')}
function updCatalog(){if(!G||(G.phase!=='play'&&G.phase!=='found'))return;const p=player(),el=$('bb-cat');const hk=G.phase==='play'&&$('hint').classList.contains('show')&&HINTS[hintStep]&&HINTS[hintStep][1];
  for(const b of $('bb-tabs').children){b.classList.toggle('on',b.dataset.t===tab);b.classList.toggle('pulse',(G.phase==='found'?'cities':tabOf(hk))===b.dataset.t&&tab!==b.dataset.t)}
  const html=tabCards(),sig=tab+'|'+html;if(sig!==tabSig){tabSig=sig;el.innerHTML=html;
    for(const e of el.querySelectorAll('[class*="fl-"]')){const id=+[...e.classList].find(c=>c.startsWith('fl-')).slice(3);e.appendChild(flagCanvas(G.states[id].flag,34,23))}
    for(const e of el.children)if(e.tagName==='BUTTON')e.onclick=()=>cardClick(e)}
  for(const e of el.children){const k=e.dataset.k;if(k){e.classList.toggle('on',G.build===k);e.classList.toggle('poor',p.res.money<BLD[k].cost&&!creative());e.classList.toggle('pulse',hk===k||(hk==='defense'&&(k==='sam'||k==='barracks')&&!p.builds.some(q=>q.k===k)))}
    if(e.dataset.mode)e.classList.toggle('on',G.mode===e.dataset.mode);
    if(e.dataset.mode==='rail')e.classList.toggle('pulse',hk==='rail'&&G.mode!=='rail');if(e.dataset.mode&&e.dataset.mode.startsWith('uav:'))e.classList.toggle('pulse',hk==='uav'&&G.mode!==e.dataset.mode&&!e.disabled);
    if(e.dataset.found)e.classList.toggle('pulse',!placing)}}
function cardClick(e){const d=e.dataset,p=player();$('ktip').classList.remove('show');
  if(d.found)return setPlacing(!placing);
  if(d.k)return setBuild(G.build===d.k?null:d.k);
  if(d.m){mapMode=d.m;updModes();tabSig='';return updCatalog()}
  if(d.mode){setBuild(null);G.mode=G.mode===d.mode?null:d.mode;railDrag=null;closeConfirm();
    if(G.mode&&G.mode.startsWith('uav:'))toast(DRN[G.mode.slice(4)].recon?'Кликните по точке на карте — туда полетит разведчик':'Кликните по цели на земле противника','ic-b-'+DRN[G.mode.slice(4)].ic);
    if(G.mode==='rail')toast('Нажмите на вокзал и, не отпуская, ведите путь к другому вокзалу или к месту нового','ic-b-rail');if(G.mode==='demolish')toast('Кликните по своей постройке, чтобы снести её','ic-b-demolish');return updCatalog()}
  if(d.go==='cap'){const q=p.places[0];if(q)api.flyTo(q.x,q.y,3);return}if(d.go==='world')return api.flyTo(W.WORLD/2,W.WORLD/2,api.maxM()*0.9);
  if(d.go==='dip'){$('dip').classList.add('show');updDip();return}
  if(d.fly){const [x,y]=d.fly.split(',').map(Number);return api.flyTo(x,y,3)}
  if(d.army!=null){const a=p.armies[+d.army];G.sel={army:a};G.mode=null;panelSig='';updPanel();api.flyTo(a.x,a.y,M.min(api.cam.m,8));return updCatalog()}
  if(d.st!=null){$('dip').classList.add('show');updDip();return}
  if(d.tab)return setTab(d.tab)}
// ---------- placement (stage 6): src/place.js keeps the ghost, its angle and the touch confirmation
// which buildings turn: the zones; a port is laid along its coast, a station along the tracks, towns are round
const rotK=k=>!!(BLD[k]&&BLD[k].zk)&&k!=='port'&&k!=='station';
let lastTouch=false,shiftDown=false;
const PL=Placement({check:(k,x,y,a)=>canBuild(player(),k,x,y,rotK(k)?a:undefined),rotates:rotK,onChange:()=>updPbar(),
  build:(k,x,y,a)=>{const p=player();if(p.res.money<BLD[k].cost&&!creative())return 'Не хватает денег: нужно '+fmt(BLD[k].cost);return startBuild(p,k,x,y,rotK(k)?a:undefined)?true:'Не удалось начать стройку'}});
// after a building was placed: leave the mode (unless Shift keeps it), back to the drone port card for its modules
// ---------- light sources (stage 6): built from the finished builds of all states — the
// floodlights of every yard (at its corners, one mast for a small one). Ids are stable (uid*8 + n), so a light keeps its
// level (no flicker) when the set is rebuilt
let lightsDirty=true;
function syncLights(){if(!api||!api.lights||!G)return;lightsDirty=false;const L=api.lights,mine=l=>typeof l.owner==='number'||(typeof l.owner==='string'&&l.owner[0]==='b'),prev=new Map(L.all().filter(mine).map(l=>[l.id,l.lv]));
  // only the lights the game owns (of its builds) are rebuilt; lights added by others stay
  for(const l of L.all())if(mine(l))L.remove(l.id);
  for(const s of G.states)for(const q of s.builds){if(!q.done)continue;
    if(q.id<0||q.k==='rail')continue;const z=W.zones[q.id],b=BLD[q.k];if(!z||z.dead||!b||!b.zk)continue;
    // masts stand inside the yard near its corners (the light falls on the concrete, not on the grass of the apron)
    const big=z.W*z.H>60000,ins=big?16:6,hw=z.W/2-ins,hh=z.H/2-ins,pts=big?[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]]:[[hw,hh]],r=M.min(80,42+M.sqrt(z.W*z.H)/25);
    pts.forEach(([u,v],i)=>L.add({id:q.uid*8+1+i,x:z.x+u*z.ca-v*z.sa,y:z.y+u*z.sa+v*z.ca,kind:'flood',owner:q.id,r}));
    // stage 6.1: a lamp over each entrance (the gate or the loading docks of a hall, 2 m out of the wall), up to three
    // a building — the biggest halls first; lit at night, its pool on the ground, the head at its height (parallax)
    const E=[];for(const p of z.prims){if(p.k!=='b'||p.a||p.H0||(p.gate==null&&!p.dk))continue;for(const e of p.gate!=null?[p.gate]:p.dk){const cx=p.x+p.w/2,cy=p.y+p.h/2,
      u=e===1?p.x+p.w+2:e===3?p.x-2:cx,v=e===0?p.y-2:e===2?p.y+p.h+2:cy;E.push([p.w*p.h,u,v])}}
    E.sort((a,b)=>b[0]-a[0]).slice(0,3).forEach(([,u,v],i)=>L.add({id:q.uid*8+5+i,x:z.x+u*z.ca-v*z.sa,y:z.y+u*z.sa+v*z.ca,kind:'lamp',owner:q.id}))}
  for(const l of L.all())if(prev.has(l.id))l.lv=prev.get(l.id)}
function placeDone(keep){const fp=G.forPort;if(!keep)setBuild(null);if(fp&&!keep){G.sel={build:fp};panelSig=''}updHUD();updPbar()}
function placeTap(x,y){const r=PL.tap(x,y,lastTouch,shiftDown&&!lastTouch);if(r==='built')placeDone(shiftDown&&!lastTouch);else if(r==='bad'&&PL.state.bad&&!lastTouch)toast(PL.state.bad);return r}
function placeConfirm(){const r=PL.confirm(false);if(r==='built')placeDone(false);else if(r==='bad'&&PL.state.bad)toast(PL.state.bad);return r}
// the bar of the armed building (as the hint box of DroneFlames): name and price, what to do or why not, ⟲ ✓ ✕
function updPbar(){const el=$('pbar');if(!el)return;const k=G&&G.phase==='play'?G.build:null;el.classList.toggle('show',!!k);document.body.classList.toggle('placing-k',!!k);if(!k)return;const S=PL.state,b=BLD[k];
  el.classList.toggle('touch',!!S.touch);el.classList.toggle('bad',!!(S.has&&S.bad));$('pbi').className='ic ic-b-'+k;$('pbt').textContent=b.n+' ('+fmt(b.cost)+')';
  $('pbs').textContent=S.has&&S.bad?S.bad:S.touch?(S.has?'Нажмите ✓, чтобы построить. Перетащите метку или коснитесь другого места':'Коснитесь карты, где поставить'):'Клик — построить · R — повернуть · Shift+клик — ещё одну · Esc или ПКМ — отмена';
  $('pbrot').hidden=!rotK(k);$('pbok').hidden=false;$('pbno').hidden=false;$('pbok').disabled=!(S.has&&!S.bad)}
function setBuild(k){if(!G||G.phase!=='play')return;G.build=k;if(k){G.mode=null;railDrag=null}if(!k||!BLD[k].mod&&k!=='solar')G.forPort=null;document.body.classList.toggle('placing',!!k);if(k){const t=tabOf(k);if(t&&t!==tab)setTab(t)}
  if(k){if(PL.state.k!==k){const c=api.toWorld(api.VW/2,api.VH*0.45);PL.select(k,lastTouch,c[0],c[1])}}else PL.cancel();updPbar();updCatalog()}
function setPlacing(v){placing=v;document.body.classList.toggle('placing',v);document.body.classList.toggle('placing-cap',v);panelSig='';if(G&&G.phase==='found'&&tab!=='cities')setTab('cities');updPanel();updCatalog();if(v)hint(1);closeConfirm()}
function closeConfirm(){$('confirm').classList.remove('show');pend=null;askFn=null;if(G)G.railAsk=null}
// the same box asks other questions (build this railway?) with a callback
let askFn=null;
// the zoom of the HUD (--z): boxes placed at screen points take the point divided by it
const zf=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z'))||1;
function placeAsk(c,sx,sy){const z=zf();c.style.left=M.min(innerWidth-130*z,M.max(130*z,sx))/z+'px';c.style.top=M.max(150*z,M.min(innerHeight-200*z,sy))/z+'px';c.classList.add('show')}
function openAsk(t,sub,fn,sx,sy){pend=null;askFn=fn;const c=$('confirm');$('cft').textContent=t;$('cfs').innerHTML=sub;$('cfy').textContent='Построить';placeAsk(c,sx,sy)}
function openConfirm(x,y,sx,sy){askFn=null;pend={x,y};const c=$('confirm');$('cft').textContent='Основать столицу здесь?';$('cfy').textContent='Да';const e=W.landE(x,y,0);
  $('cfs').innerHTML=`Высота ${M.round(e*2600)} м<br>Город вырастет здесь сам, к соседям проложат магистрали`;placeAsk(c,sx,sy)}
// news as in DroneFlames: the red icon block (a flag, or the icon of the building), the text, ✕ and the bar of the time left
// stage 6.1: notifications as the lane of DroneFlames (ui24/notif_lane.gd): at most 2 cards at once (1 on a phone), the
// rest wait in a short queue (a card older than 15 s is dropped, unless it asks something); the same text does not make a
// second card — the shown one lives longer; cards of one kind waiting in the queue merge into one with ×N; a card leaves
// by itself (errors 3.5 s, news 7 s, offers 20 s) or on a tap; «+N» tells how many wait. One place: top centre, 316 px.
const LANE={shown:[],queue:[],seq:0};const LANE_AGE=15000;
function laneMax(){return innerWidth<760?1:2}
function toast(html,fl,btns,ms){const txt=String(html).replace(/<[^>]+>/g,''),cat=fl&&typeof fl==='object'?'flag':(fl||'ic-warn'),now=performance.now();
  ms=ms||(btns?20000:cat==='ic-warn'?3500:7000);
  for(const it of LANE.shown)if(it.txt===txt){it.until=M.max(it.until,now+ms);return}
  for(const it of LANE.queue)if(it.txt===txt){it.ms=M.max(it.ms,ms);return}
  if(!btns)for(const it of LANE.queue)if(!it.btns&&it.cat===cat&&cat!=='ic-warn'){it.n++;it.html=html;it.txt=txt;it.fl=fl;it.t0=now;laneSync();return}
  LANE.queue.push({id:++LANE.seq,html,txt,fl,cat,btns,ms,n:1,t0:now});
  while(LANE.queue.length>6){const i=LANE.queue.findIndex(q=>!q.btns);LANE.queue.splice(i<0?0:i,1)}
  laneSync()}
function laneKill(it){if(it.dead)return;it.dead=true;const t=it.el;LANE.shown=LANE.shown.filter(q=>q!==it);if(t){t.classList.add('out');setTimeout(()=>t.remove(),160)}setTimeout(laneSync,170)}
function laneCard(it){const t=document.createElement('div');t.className='toast'+(it.btns?' ask':'');const ic=document.createElement('span');ic.className='t-i';
  if(it.fl&&typeof it.fl==='object')ic.appendChild(flagCanvas(it.fl,28,19));else ic.innerHTML=`<span class="ic ${it.fl||'ic-warn'}"></span>`;t.appendChild(ic);
  const b=document.createElement('div');b.className='t-b';b.innerHTML=it.html;t.appendChild(b);
  if(it.n>1){const n=document.createElement('span');n.className='t-n';n.textContent='×'+it.n;t.appendChild(n)}
  if(it.btns){const r=document.createElement('div');r.className='tb';it.btns.forEach(([n,f],i)=>{const q=document.createElement('button');q.className='btn sm'+(i===0?(/^Снести|^Объявить/.test(n)?' danger':' primary'):'');q.textContent=n;q.onclick=e=>{e.stopPropagation();f();laneKill(it)};r.appendChild(q)});b.appendChild(r)}
  else t.onclick=()=>laneKill(it);
  return t}
function laneSync(){const box=$('toasts');if(!box)return;const now=performance.now();
  LANE.queue=LANE.queue.filter(q=>q.btns||now-q.t0<LANE_AGE);
  while(LANE.shown.length<laneMax()&&LANE.queue.length){const it=LANE.queue.shift();it.until=now+it.ms;it.el=laneCard(it);box.insertBefore(it.el,$('t-more'));LANE.shown.push(it)}
  let mo=$('t-more');if(!mo){mo=document.createElement('button');mo.id='t-more';mo.className='t-more';mo.onclick=()=>{const o=LANE.shown.find(q=>!q.btns)||LANE.shown[0];if(o)laneKill(o)};box.appendChild(mo)}
  mo.textContent='+'+LANE.queue.length;mo.title='Ещё уведомлений: '+LANE.queue.length+' — нажмите, чтобы показать следующее';mo.style.display=LANE.queue.length?'':'none'}
function laneTick(){const now=performance.now();for(const it of LANE.shown.slice())if(now>it.until)laneKill(it);if(LANE.queue.length&&LANE.shown.length<laneMax())laneSync()}
setInterval(laneTick,250);
function laneClear(){for(const it of LANE.shown)it.dead=true;LANE.shown=[];LANE.queue=[];const box=$('toasts');if(box)box.innerHTML=''}
// hints: the step-by-step guide («План развития»); [text, what finishes the step]
const HINTS=[
  ['Выберите место для <b>столицы</b>: нажмите «Основать столицу» слева или просто кликните по карте','found'],
  ['Кликните по карте там, где будет столица. Красный круг — место не подходит. <b>Esc</b> или ✕ — отмена','found'],
  ['Столица основана! Сверху — ресурсы (клик — склад), внизу — вкладки, пауза и скорость. Во вкладке <b>Города</b> поставьте <b>Село</b> рядом со столицей','village'],
  ['Поставьте в селе <b>Колхоз</b>: еда и немного денег. Колхоз — только в области села','farm'],
  ['<b>Завод товаров</b> — главный доход. Ставится рядом с городом, ему нужна энергия','factory'],
  ['Заводу нужна энергия: постройте <b>ТЭЦ</b>','power'],
  ['<b>Лесопилка</b> — древесина и деньги. Ставится у леса','sawmill'],
  ['<b>Нефтевышка</b> (ключ «Нефть») — на месторождении нефти (чёрное пятно на земле; вкладка «Карта» → «Залежи» покажет все месторождения)','oil'],
  ['<b>НПЗ</b> перерабатывает нефть в топливо и деньги','refinery'],
  ['<b>Порт</b> на берегу продаёт излишки за рубеж, привозит нехватку и даёт +800 к складу','port'],
  ['Расширяйтесь: поставьте <b>новый город</b> — он вырастет сам и принесёт налоги и земли','city'],
  ['<b>Солнечные панели</b> — резерв энергии: днём заряжают аккумулятор, а ночью или когда ТЭЦ стоит, он держит заводы','solar'],
  ['<b>Рудник</b> — на месторождении угля, железа, меди, золота, урана или лития: металл (для дронов) или деньги','mine'],
  ['Железная дорога начинается с вокзала: во вкладке <b>Города</b> поставьте <b>Вокзал</b> в городе, у дороги','station'],
  ['Теперь <b>Ж/Д путь</b>: нажмите ключ «Ж/Д путь», затем нажмите на вокзал и, не отпуская, ведите линию к другому вокзалу или в поле — там встанет новый вокзал','rail'],
  ['Защита: <b>Военная часть</b> (вкладка «Армия», армия до 12 бойцов) и <b>ПВО</b> (вкладка «ПВО», сбивает вражеские дроны). Боты могут начать войну не раньше 10–12 минуты','defense'],
  ['Вкладка <b>Удар</b>: <b>Дронопорт</b>, к нему <b>Рампа</b>, затем <b>Цех БПЛА</b> — закажите в нём Ланцет или Орлан-10 (нужен металл с рудника)','uav'],
  ['Кликните по военной части или по значку армии на карте: «Армия №1», выберите <b>Сборку</b> — состав армии','assembly'],
  ['Армия выбрана: «Двигаться» и клик по карте — приказ. Вкладка <b>Полит.</b> — альянсы, война и мир, <b>Удар</b> — Ланцет, Герань-3 и разведчик Орлан-10. <b>Пробел</b> — пауза, <b>F</b> — скорость, <b>1–7</b> — вкладки, <b>Esc</b> — меню','end']];
function hint(i,force){if(i<hintStep&&i!==0)return;
  // steps already done (built out of order) are skipped; with the hints off in the settings the plan still counts the steps
  if(G&&G.phase==='play')while(HINTS[i]&&stepDone(HINTS[i][1]))i++;hintStep=i;updPlan();const h=HINTS[i];if(!h)return hideHint();if(hintsOff&&!tutorial&&!force)return;
  $('hintn').textContent=`План развития · шаг ${i+1} из ${HINTS.length}`;$('hintt').innerHTML=h[0];$('hint').classList.add('show');if(G&&G.phase==='play')updCatalog()}
function hideHint(){$('hint').classList.remove('show');if(G&&G.phase==='play')updCatalog()}
function updPlan(){$('plann').textContent=M.min(hintStep+1,HINTS.length)+' из '+HINTS.length}
function stepDone(k){const p=player();if(!p)return false;if(k==='uav')return uavN(p)>0||G.drones.some(d=>d.st===0);if(k==='defense')return p.builds.some(q=>q.k==='barracks')&&p.builds.some(q=>q.k==='sam');if(k==='assembly')return p.armies.some(a=>a.tpl);if(k==='end'||k==='found')return false;return p.builds.some(q=>q.k===k)}
// a placed / finished building moves the guide on
function onBuilt(k,done){const h=HINTS[hintStep];if(!h)return;const p=player();
  if(h[1]==='defense'){if(p.builds.some(q=>q.k==='barracks')&&p.builds.some(q=>q.k==='sam'))hint(hintStep+1);return}
  if(h[1]===k)hint(hintStep+1)}
function updDip(){const b=$('dipb');if(!$('dip').classList.contains('show')||!G)return;const p=player();let h='';
  for(const s of G.states){if(!s.places.length&&!s.dead)continue;const ally=p.allies.includes(s.id),war=atWar(p.id,s.id);
    h+=`<div class="dst"><span class="fl" data-st="${s.id}"></span><div><b>${esc(s.name)}${s.isP?' (вы)':''}${s.dead?' — пало':''}</b><small>${esc(s.gov)} · ${esc(s.capital)}${s.isP?'':' · '+TRAITS[s.trait]+' · '+DIFF[s.diff].n.toLowerCase()}</small><small>${fmt(s.score)} очков · ${fmtK(s.pop)} чел. · армия ${fmt(strengthOf(s))}</small></div>`+
      (s.isP?'<span></span>':`<span class="rel${ally?' ally':war?' war':''}">${ally?'Союзник':war?'Война':'Мир'}${!s.isP&&visa(p,s)?' · безвиз':''}</span>`)+`<div class="acts">`+
      (s.isP||s.dead||war||visa(p,s)?'':`<button class="btn sm" data-visa="${s.id}" ${s.askedV&&G.t-s.askedV<60?'disabled':''}>Безвиз</button>`)+
      (s.isP||s.dead?'':war?`<button class="btn sm" data-peace="${s.id}" ${s.asked&&G.t-s.asked<60?'disabled':''}>Предложить мир</button>`:`${cfg.rules.alliances&&!ally?`<button class="btn sm" data-ally="${s.id}" ${s.asked&&G.t-s.asked<60?'disabled':''}>Альянс</button>`:''}${ally?'':`<button class="btn sm danger" data-war="${s.id}">Объявить войну</button>`}`)+
      `<button class="btn sm" data-go="${s.id}">Показать</button></div></div>`}
  if(h===b._h)return;b._h=h;b.innerHTML=h;for(const e of b.querySelectorAll('.fl'))e.replaceWith(flagCanvas(G.states[+e.dataset.st].flag,38,25));
  for(const e of b.querySelectorAll('[data-ally]'))e.onclick=()=>askAlly(G.states[+e.dataset.ally]);
  for(const e of b.querySelectorAll('[data-war]'))e.onclick=()=>declareWar(p,G.states[+e.dataset.war]);
  for(const e of b.querySelectorAll('[data-visa]'))e.onclick=()=>askVisa(G.states[+e.dataset.visa]);
  for(const e of b.querySelectorAll('[data-peace]'))e.onclick=()=>askPeace(G.states[+e.dataset.peace]);
  for(const e of b.querySelectorAll('[data-go]'))e.onclick=()=>{const s=G.states[+e.dataset.go];const q=s.places[0];if(q)api.flyTo(q.x,q.y,6)}}
function updModes(){tabSig=''}

// ---------- map objects: construction sites, build preview, armies, drones, hits
function drawObjects(ctx,A){const m=A.cam.m,T=A.T;drawPennants(ctx,A);ctx.textAlign='center';ctx.textBaseline='middle';
  const me=player(),mine=s=>s.isP||me.allies.includes(s.id);
  for(const s of G.states)for(const q of s.builds){if(q.done||q.k==='rail'||(!mine(s)&&!seenNow(q.x,q.y)))continue;const X=A.sxw(q.x),Y=A.syw(q.y);if(X<-40||Y<-40||X>A.VW+40||Y>A.VH+40)continue;const b=BLD[q.k],r=M.max(9,M.min(60,(b.R||(b.W?M.hypot(b.W,b.H)/2:340))/m));
    ctx.fillStyle='rgba(10,15,23,0.55)';ctx.beginPath();ctx.arc(X,Y,r,0,7);ctx.fill();ctx.strokeStyle=s.isP?'#ffd25a':s.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,r,-M.PI/2,-M.PI/2+M.PI*2*q.t/q.time);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.lineDashOffset=-T*10;ctx.beginPath();ctx.arc(X,Y,r+5,0,7);ctx.stroke();ctx.setLineDash([]);
    const ic=bIcon(q.k);ctx.drawImage(ic,X-11,Y-11,22,22)}
  // railways under construction (as DroneFlames): the track is laid along the real route as the work goes, the rest is the
  // earthworks; until both stations stand — the earthworks only, and a chip «ждёт вокзалы»
  for(const s of G.states){if(!mine(s))continue;for(const q of s.builds){if(q.k!=='rail'||q.done)continue;const a=byUid(s,q.a),b=byUid(s,q.b);if(!a||!b)continue;
    const ready=a.done&&b.done&&a.id>=0&&b.id>=0;if(ready&&!q._P){const P=W.railPts(W.zones[a.id],W.zones[b.id],railBlk(s));q._P=typeof P==='string'||!P?[a.x,a.y,b.x,b.y]:P}
    const P=q._P||[a.x,a.y,b.x,b.y],sp=[];for(let i=0;i<P.length;i+=2){sp.push(A.sxw(P[i]),A.syw(P[i+1]))}trackLine(ctx,sp,ready?q.t/q.time:0);
    if(!ready){const mx=(A.sxw(a.x)+A.sxw(b.x))/2,my=(A.syw(a.y)+A.syw(b.y))/2;ctx.font='700 11px Rubik,system-ui,sans-serif';const t='ждёт вокзалы',w=ctx.measureText(t).width+14;ctx.fillStyle=INK;ctx.fillRect(mx-w/2-1,my-11,w+2,22);ctx.fillStyle='#24211a';ctx.fillRect(mx-w/2,my-10,w,20);ctx.fillStyle='#ffd25a';ctx.fillText(t,mx,my)}}}
  for(const s of G.states)for(const a of s.armies){if(!a.units.length||(!mine(s)&&!seenNow(a.x,a.y)))continue;const X=A.sxw(a.x),Y=A.syw(a.y);if(X<-40||Y<-40||X>A.VW+40||Y>A.VH+40)continue;const sel=G.sel&&G.sel.army===a;
    if(a.tx!==null&&(s.isP||sel)){ctx.strokeStyle=s.isP?'rgba(255,210,90,0.8)':'rgba(255,107,90,0.8)';ctx.lineWidth=2;ctx.setLineDash([7,6]);ctx.lineDashOffset=-T*25;ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(A.sxw(a.tx),A.syw(a.ty));ctx.stroke();ctx.setLineDash([])}
    if(a.fight){for(let k=0;k<3;k++){const f=(T*3+k*0.33)%1;ctx.fillStyle=`rgba(255,${160+k*30},60,${1-f})`;ctx.beginPath();ctx.arc(X+M.sin(T*9+k)*12,Y+M.cos(T*7+k)*9,3+f*6,0,7);ctx.fill()}}
    armyToken(ctx,s,a,X,Y,sel)}
  // drones: the real top-view model (at least ~18 px long so it reads), a vapour trail; an Orlan shows the ring it watches
  for(const d of G.drones){const s=G.states[d.st];if(!mine(s)&&!seenNow(d.x,d.y))continue;const X=A.sxw(d.x),Y=A.syw(d.y);if(X<-60||Y<-60||X>A.VW+60||Y>A.VH+60)continue;
    let h;if(d.ph==='loiter')h=d.lt*0.32+M.PI/2;else{const gx=d.ph==='back'?d.hx:d.tx,gy=d.ph==='back'?d.hy:d.ty;h=M.atan2(gy-d.y,gx-d.x)}
    if(d.kind==='orlan'&&mine(s)&&d.ph==='loiter'){ctx.save();ctx.strokeStyle='rgba(120,200,255,0.55)';ctx.lineWidth=1.2;ctx.setLineDash([6,6]);ctx.lineDashOffset=-T*12;ctx.beginPath();ctx.arc(A.sxw(d.tx),A.syw(d.ty),REVR/m,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
    const v=d.kind==='geran'?1:d.kind==='orlan'?2:0,L=v===1?3.5:v===2?3.2:1.8,k=M.max(1/m,(d.kind==='drone'?16:v===1?24:20)/L);
    ctx.save();ctx.translate(X,Y);ctx.rotate(h);ctx.strokeStyle=mine(s)?'rgba(255,240,200,0.45)':'rgba(255,140,120,0.5)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-L*k*0.5,0);ctx.lineTo(-L*k*0.5-22,0);ctx.stroke();
    ctx.scale(k,k);W.drawUav(ctx,v,s.isP?0:1,8);ctx.restore();
    if(!mine(s)){ctx.strokeStyle='#ff6b5a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(X,Y,L*k*0.62+4,0,7);ctx.stroke()}}
  for(const f of G.fx){const X=A.sxw(f.x),Y=A.syw(f.y),k=f.t/1.2;if(f.k==='boom'){ctx.fillStyle=`rgba(255,${200-k*140|0},80,${1-k})`;ctx.beginPath();ctx.arc(X,Y,4+k*22,0,7);ctx.fill();ctx.strokeStyle=`rgba(255,240,200,${1-k})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(X,Y,8+k*34,0,7);ctx.stroke()}
    else if(k<0.4){ctx.strokeStyle=`rgba(255,240,160,${1-k*2.5})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(A.sxw(f.x2),A.syw(f.y2));ctx.stroke()}}
  // build preview
  if(G.build&&!PL.state.touch&&A.hover.on){const [hx,hy]=A.toWorld(A.hover.x,A.hover.y);PL.hover(hx,hy)}
  if(G.build&&PL.state.has){const S=PL.state,x=S.x,y=S.y,k=G.build,b=BLD[k],bad=S.bad,X=A.sxw(x),Y=A.syw(y);ctx.save();
    const c=bad?GH.bad:GH.ok;ctx.strokeStyle=c.edge;ctx.fillStyle=c.fill;ctx.lineWidth=2;
    if(b.zk){const w=M.max(8,b.W/m),h=M.max(8,b.H/m),an=k==='station'?stationAng(player(),x,y):rotK(k)?S.ang:0;ctx.save();ctx.translate(X,Y);ctx.rotate(an);ctx.beginPath();ctx.rect(-w/2,-h/2,w,h);ctx.fill();ctx.stroke();
      // the front of the building (its gate side) — so the angle reads
      if(rotK(k)){ctx.setLineDash([]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-w/2,h/2);ctx.lineTo(w/2,h/2);ctx.stroke()}ctx.restore()}else{const r=M.max(10,(k==='city'?b.R:b.point?b.r:320)/m);ring(ctx,X,Y,r,c.ring,c.fill)}
    // where it may stand: the cover rings of DroneFlames (band, rubber, amber line)
    if(b.mod||k==='solar'){for(const q of player().builds)if(q.k==='droneport')ring(ctx,A.sxw(q.x),A.syw(q.y),(b.mod?1100:700)/m,GH.amber.ring,null,true)}
    if(k==='village'||k==='farm'){for(const p of player().places)if(p.k==='village')ring(ctx,A.sxw(p.x),A.syw(p.y),1400/m,GH.amber.ring,null,true)}
    // touch: a round handle to drag the ghost (the name and the reason are in the placement bar)
    if(S.touch){ctx.lineWidth=2;ctx.strokeStyle=bad?'rgba(255,140,120,0.95)':'rgba(255,255,255,0.95)';ctx.fillStyle='rgba(10,15,23,0.6)';ctx.beginPath();ctx.arc(X,Y,22,0,7);ctx.fill();ctx.stroke()}
    ctx.drawImage(bIcon(k),X-12,Y-12,24,24);
    ctx.restore()}
  if(G.mode==='rail'||G.railAsk)drawRailTool(ctx,A);
  if(G.mode&&G.mode.startsWith('uav:')&&A.hover.on&&DRN[G.mode.slice(4)].recon){ring(ctx,A.hover.x,A.hover.y,REVR/m,GH.sky.ring,'rgba(120,200,255,0.08)',true);cross(ctx,A.hover.x,A.hover.y,10,GH.sky.ring)}
  if(G.mode&&G.mode.startsWith('uav:')&&A.hover.on){ctx.strokeStyle='#ff6b5a';ctx.lineWidth=2;const X=A.hover.x,Y=A.hover.y;ctx.beginPath();ctx.arc(X,Y,14,0,7);ctx.moveTo(X-20,Y);ctx.lineTo(X+20,Y);ctx.moveTo(X,Y-20);ctx.lineTo(X,Y+20);ctx.stroke()}}
// the railway tool on the map: rings over the own stations, the line being drawn (green: can be built, red: the reason)
// stage 6.1: a railway on the map as DroneFlames draws it (world/rail_layer.gd), in vectors: dark edge, ballast, sleepers
// across at a fixed step, two rails; a part not built yet is the earthworks (earth bed, stacked sleepers). pts — screen
// points [x0,y0,x1,y1,…]; from/to — the built fraction; tint — the ghost colour of the rail tool (green / red / amber)
function trackLine(ctx,pts,built,tint){const n=pts.length>>1;if(n<2)return;let L=0;const S=[0];for(let i=1;i<n;i++){L+=M.hypot(pts[i*2]-pts[i*2-2],pts[i*2+1]-pts[i*2-1]);S.push(L)}
  const cut=L*(built==null?1:built);
  const path=(a,b)=>{ctx.beginPath();let on=false;for(let i=0;i<n;i++){const s0=S[i];if(s0<a&&i<n-1&&S[i+1]<a)continue;if(s0>b&&on){const t=(b-S[i-1])/(s0-S[i-1]||1);ctx.lineTo(pts[i*2-2]+(pts[i*2]-pts[i*2-2])*t,pts[i*2-1]+(pts[i*2+1]-pts[i*2-1])*t);break}
    if(!on){if(s0>=a){ctx.moveTo(pts[i*2],pts[i*2+1])}else{const t=(a-s0)/(S[i+1]-s0||1);ctx.moveTo(pts[i*2]+(pts[i*2+2]-pts[i*2])*t,pts[i*2+1]+(pts[i*2+3]-pts[i*2+1])*t)}on=true;if(s0<a)continue}ctx.lineTo(pts[i*2],pts[i*2+1])}};
  const ties=(a,b,col,w,len,step)=>{ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();for(let i=1;i<n;i++){const x0=pts[i*2-2],y0=pts[i*2-1],dx=pts[i*2]-x0,dy=pts[i*2+1]-y0,l=S[i]-S[i-1];if(l<=0)continue;const ux=dx/l,uy=dy/l;
    for(let d=M.ceil(M.max(S[i-1],a)/step)*step;d<=M.min(S[i],b);d+=step){const t=d-S[i-1],x=x0+ux*t,y=y0+uy*t;ctx.moveTo(x-uy*len,y+ux*len);ctx.lineTo(x+uy*len,y-ux*len)}}ctx.stroke()};
  ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';ctx.setLineDash([]);
  if(cut<L){path(cut,L);ctx.strokeStyle='rgba(58,44,30,0.55)';ctx.lineWidth=8;ctx.stroke();ctx.strokeStyle='rgba(150,116,78,0.85)';ctx.lineWidth=5;ctx.stroke();ties(cut,L,'rgba(92,66,40,0.7)',1.6,3,14)}
  if(cut>0){path(0,cut);ctx.strokeStyle='#2c2b27';ctx.lineWidth=8;ctx.stroke();ctx.strokeStyle='#7d786c';ctx.lineWidth=6;ctx.stroke();ties(0,cut,'#5c4328',1.7,3.4,5);
    // two rails: offsets of the centre line by ±1.5 px
    for(const [o,c] of [[1.5,'#e3e1d8'],[-1.5,'#b9b7ae']]){ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();let first=true;for(let i=0;i<n;i++){if(S[i]>cut&&i>0){const t=(cut-S[i-1])/(S[i]-S[i-1]||1);const x0=pts[i*2-2],y0=pts[i*2-1],dx=pts[i*2]-x0,dy=pts[i*2+1]-y0,l=M.hypot(dx,dy)||1;ctx.lineTo(x0+dx*t-dy/l*o,y0+dy*t+dx/l*o);break}
      const j=M.min(i,n-2),dx=pts[j*2+2]-pts[j*2],dy=pts[j*2+3]-pts[j*2+1],l=M.hypot(dx,dy)||1,x=pts[i*2]-dy/l*o,y=pts[i*2+1]+dx/l*o;if(first){ctx.moveTo(x,y);first=false}else ctx.lineTo(x,y)}ctx.stroke()}}
  if(tint){path(0,L);ctx.globalAlpha=0.38;ctx.strokeStyle=tint;ctx.lineWidth=10;ctx.stroke();ctx.globalAlpha=1}
  ctx.restore()}
function drawRailTool(ctx,A){const m=A.cam.m,T=A.T,p=player();ctx.save();
  for(const q of p.builds){if(q.k!=='station'||!q.done)continue;const X=A.sxw(q.x),Y=A.syw(q.y),r=M.max(18,170/m),f=(T*1.1)%1;
    ring(ctx,X,Y,r,GH.amber.ring,'rgba(255,176,0,0.10)',true);cross(ctx,X,Y,6,GH.amber.ring)}
  let ev=G.railAsk;if(railDrag){const d=railDrag;if(!d.ev||performance.now()-d.et>110){d.et=performance.now();d.ev=railEval(d.a,d.x,d.y,d.sx,d.sy)}ev=d.ev;
    if(ev&&!ev.P)trackLine(ctx,[A.sxw(d.a.x),A.syw(d.a.y),d.sx,d.sy],0,GH.bad.ring)}
  if(ev&&ev.P){const P=ev.P,ok=!ev.bad,amb=!!G.railAsk&&!railDrag,sp=[];for(let i=0;i<P.length;i+=2)sp.push(A.sxw(P[i]),A.syw(P[i+1]));trackLine(ctx,sp,1,amb?GH.amber.ring:ok?GH.ok.ring:GH.bad.ring)}
  if(ev&&ev.nb){const w=M.max(8,BLD.station.W/m),h=M.max(5,BLD.station.H/m);ctx.save();ctx.translate(A.sxw(ev.nb.x),A.syw(ev.nb.y));ctx.rotate(ev.nb.ang);ctx.fillStyle=ev.bad?GH.bad.fill:GH.ok.fill;ctx.strokeStyle=ev.bad?GH.bad.edge:G.railAsk&&!railDrag?GH.amber.ring:GH.ok.edge;ctx.lineWidth=2;ctx.beginPath();ctx.rect(-w/2,-h/2,w,h);ctx.fill();ctx.stroke();ctx.restore()}
  if(railDrag&&ev){const t=ev.bad||`${fmtKm(ev.L)} · ${fmt(ev.cost)}${ev.nb?' · новый вокзал':''}`;ctx.font='600 12px Rubik,system-ui,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';const w=ctx.measureText(t).width+16;
    ctx.fillStyle='rgba(10,15,23,0.9)';ctx.fillRect(railDrag.sx+16,railDrag.sy+14,w,22);ctx.fillStyle=ev.bad?'#ff9c8e':'#9fe3aa';ctx.fillText(t,railDrag.sx+24,railDrag.sy+25)}
  ctx.restore()}
// army token: a framed counter in the state colour with the type symbol and the number of fighters
function armyToken(ctx,s,a,X,Y,sel){const comp={};for(const u of a.units)comp[u]=(comp[u]||0)+1;const main=Object.entries(comp).sort((p,q)=>q[1]-p[1])[0][0];
  ctx.save();ctx.translate(X,Y);ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(-15,-9,32,22);ctx.fillStyle=s.color;ctx.fillRect(-16,-11,32,22);ctx.strokeStyle=sel?'#fff':'rgba(10,15,23,0.9)';ctx.lineWidth=sel?2.5:1.5;ctx.strokeRect(-16,-11,32,22);
  ctx.strokeStyle='rgba(10,15,23,0.85)';ctx.lineWidth=1.4;ctx.beginPath();
  if(main==='tank'){ctx.ellipse(0,0,10,5,0,0,7)}else if(main==='art'){ctx.arc(0,0,3,0,7)}else if(main==='at'){ctx.moveTo(-10,6);ctx.lineTo(0,-6);ctx.lineTo(10,6)}else{ctx.moveTo(-16,-11);ctx.lineTo(16,11);ctx.moveTo(16,-11);ctx.lineTo(-16,11);if(main==='mot'){ctx.moveTo(-3,-11);ctx.lineTo(-3,11);ctx.moveTo(3,-11);ctx.lineTo(3,11)}}
  ctx.stroke();ctx.font='700 11px Rubik,system-ui,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(10,15,23,0.9)';ctx.strokeText(a.units.length,0,19);ctx.fillStyle='#fff';ctx.fillText(a.units.length,0,19);ctx.restore()}
const BIC={};function bIcon(k){if(BIC[k])return BIC[k];const S=48,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');const src=getComputedStyle(document.documentElement).getPropertyValue('--ic-b-'+k);
  if(ICONIMG[k]){x.drawImage(ICONIMG[k],0,0,S,S)}return BIC[k]=c}
const ICONIMG={};

// ---------- railway tool (stage 5.7): own stations are ringed; press on one and drag — to another station (they get
// connected) or into the open (a new station is placed there, its axis along the line); release, then ✓ or ✕
let railDrag=null;
function stationAtScreen(sx,sy){let best=null,bd=1e9;for(const q of player().builds){if(q.k!=='station'||!q.done||q.id<0)continue;const d=M.hypot(api.sxw(q.x)-sx,api.syw(q.y)-sy),r=M.max(18,170/api.cam.m);if(d<r&&d<bd){bd=d;best=q}}return best}
function railEval(A,x,y,sx,sy){const p=player(),za=W.zones[A.id],B=stationAtScreen(sx,sy);if(!za)return {bad:'Нет вокзала'};
  if(B===A)return {bad:'Ведите путь к другому вокзалу или в поле',x,y};
  let zb,nb=null,cost=0;
  if(B){if(p.builds.some(r=>r.k==='rail'&&((r.a===A.uid&&r.b===B.uid)||(r.a===B.uid&&r.b===A.uid))))return {bad:'Эти вокзалы уже соединены',B};zb=W.zones[B.id]}
  else{const ang=M.atan2(y-za.y,x-za.x),why=canBuild(p,'station',x,y,ang);nb={x,y,ang};if(why)return {bad:why,nb,x,y};zb={x,y,ca:M.cos(ang),sa:M.sin(ang),W:BLD.station.W,H:BLD.station.H};cost+=BLD.station.cost}
  const P=W.railPts(za,zb,railBlk(p));if(typeof P==='string')return {bad:P,nb,x,y,B};
  for(let i=0;i<P.length;i+=12){const o=ownerAt(P[i],P[i+1]);if(o&&o!==p.id+1)return {bad:'Путь идёт по чужой земле',P,nb,B}}
  let L=0;for(let i=2;i<P.length;i+=2)L+=M.hypot(P[i]-P[i-2],P[i+1]-P[i-1]);cost+=M.round(L*RAILK);
  if(p.res.money<cost&&!creative())return {bad:'Не хватает денег: нужно '+fmt(cost),P,L,cost,nb,B};return {P,L,cost,B,nb,A}}
// ---------- airports and flights (stage 5.11). Every working airport sends a plane about once a minute (at most three
// of its planes in the air): a passenger flight to another own airport or to a state with a visa-free agreement, a cargo
// flight to an own airport or (export) to any state at peace. A flight is a real trip: take-off run, climb-out, cruise,
// approach along the runway of the destination, landing; it earns money when it lands (export also moves goods).
const FLR={pax:[45,20],cargo:[60,0]},FLS=90,FLA=5000,FLB=10300;
// metres flown after t seconds: 90 m/s on the take-off run and climb-out (5 km) and on the approach (10.3 km), cruise
// between them at up to 260 m/s; flTime: the whole trip
const flCruise=g=>M.min(260,M.max(FLS,(g.L-FLA-FLB)/60)),flTime=g=>{const m=g.L-FLA-FLB;return m<=0?g.L/FLS:(FLA+FLB)/FLS+m/flCruise(g)};
function flAt(g,t){const m=g.L-FLA-FLB;if(m<=0)return t*FLS;const t1=FLA/FLS,t2=t1+m/flCruise(g);return t<t1?t*FLS:t<t2?FLA+(t-t1)*flCruise(g):FLA+m+(t-t2)*FLS}
const airportsOf=s=>s.builds.filter(q=>q.k==='airport'&&q.done&&q.id>=0&&W.zones[q.id]&&!W.zones[q.id].dead);
const visa=(a,b)=>a===b||(a.visa||[]).includes(b.id);
function flightPath(za,zb){const [a0,a1]=W.air2Rw(za),[b0,b1]=W.air2Rw(zb);
  // take off towards the destination, land in the direction that keeps the approach on the near side
  const tA=(a1[0]-a0[0])*(zb.x-za.x)+(a1[1]-a0[1])*(zb.y-za.y)>=0,[as,ae]=tA?[a0,a1]:[a1,a0];const tB=(b1[0]-b0[0])*(zb.x-za.x)+(b1[1]-b0[1])*(zb.y-za.y)>=0,[bs,be]=tB?[b0,b1]:[b1,b0];
  const ux=(ae[0]-as[0])/1800,uy=(ae[1]-as[1])/1800,vx=(be[0]-bs[0])/1800,vy=(be[1]-bs[1])/1800;
  const pts=[as[0],as[1],ae[0],ae[1],ae[0]+ux*3200,ae[1]+uy*3200,bs[0]-vx*9000,bs[1]-vy*9000,bs[0],bs[1],bs[0]+vx*1300,bs[1]+vy*1300];
  const n=pts.length/2,cum=[0];let L=0;for(let i=1;i<n;i++){L+=M.hypot(pts[i*2]-pts[i*2-2],pts[i*2+1]-pts[i*2-1]);cum.push(L)}return {pts,cum,L,n}}
function stepFlights(dt){const F=G.flights||(G.flights=[]);
  for(let i=F.length-1;i>=0;i--){const f=F[i];if(G.t-f.t0<flTime(f.g))continue;F.splice(i,1);const gi=api.gflights.indexOf(f.g);if(gi>=0)api.gflights.splice(gi,1);landed(f)}
  for(const s of G.states){if(s.dead||!s.places.length)continue;const mine=airportsOf(s);if(!mine.length)continue;
    for(const q of mine){if(q.off>0)continue;if(q.ft==null)q.ft=G.t+5+hsh(q.uid,7)*20;if(G.t<q.ft)continue;q.ft=G.t+45+hsh(q.uid,G.t|0)*40;
      if(F.filter(f=>f.a===q).length>=3)continue;
      const dest=[];for(const t of G.states){if(t.dead||!t.places.length||atWar(s.id,t.id))continue;for(const r of airportsOf(t)){if(r===q)continue;const pax=visa(s,t),cargo=true;dest.push([t,r,pax,cargo])}}
      if(!dest.length)continue;const R=hsh(q.uid*31+(G.t|0),G.dec++);const d=dest[R*dest.length|0];const kind=d[2]&&(hsh(q.uid,G.t*7|0)<0.55||!d[3])?'pax':'cargo';
      const za=W.zones[q.id],zb=W.zones[d[1].id];if(!za||!zb)continue;const g=flightPath(za,zb);Object.assign(g,{v:FLS,alt:kind==='pax'?2600:3200,kind:0,lift:1000,c:s.id%5,ph:hsh(q.uid,G.uid)*100,s:0,fl:1});
      const f={st:s.id,a:q,to:d[0].id,b:d[1],kind,t0:G.t,g};F.push(f);const Hs=G.fhist||(G.fhist=[]);Hs.push([s.id,d[0].id,kind,G.t|0]);if(Hs.length>80)Hs.shift();api.gflights.push(g);s.nFl=(s.nFl||0)+1;
      if(s.isP&&!s._fl1){s._fl1=1;toast(`Первый рейс: <b>${kind==='pax'?'пассажирский':'грузовой'}</b> в ${esc(G.states[d[0].id].isP?'свой аэропорт':G.states[d[0].id].name)}`,'ic-b-airport')}}}}
function landed(f){const s=G.states[f.st],t=G.states[f.to];if(!s||s.dead)return;const [mo,mt]=FLR[f.kind];const foreign=s!==t;
  if(f.kind==='cargo'&&foreign){const n=M.min(4,s.res.goods||0);s.res.goods-=n;t.res.goods=(t.res.goods||0)+n;addMoney(s,mo+n*PRICE.goods*4)}
  else addMoney(s,foreign?mo+10:mo*0.6);if(foreign&&f.kind==='pax'&&mt)addMoney(t,mt);
  s.landed=(s.landed||0)+1;if(s.isP&&foreign&&!(s._flTo||(s._flTo={}))[t.id]){s._flTo[t.id]=1;toast(`Рейс прибыл в <b>${esc(t.name)}</b>: ${f.kind==='pax'?'пассажиры':'груз'} · +${fmt(mo)}`,t.flag)}}
const addMoney=(s,v)=>{if(s.res.money!==Infinity)s.res.money+=v;s.earned=(s.earned||0)+v};
// visa-free agreements: asked in the diplomacy window; a state at peace agrees when it likes the asker enough
function signVisa(a,b){if(visa(a,b))return;(a.visa=a.visa||[]).push(b.id);(b.visa=b.visa||[]).push(a.id);toast(`<b>${esc(a.name)}</b> и <b>${esc(b.name)}</b> ввели безвизовый режим: пассажирские рейсы между ними`,a.flag)}
function askVisa(o){const p=player();if(atWar(p.id,o.id)){toast('Во время войны безвиз невозможен');return}const like=p.allies.includes(o.id)?0.95:o.trait==='cautious'?0.35:o.trait==='militarist'?0.4:0.65;
  if(hsh(o.id*13,G.t|0)<like)signVisa(p,o);else toast(`<b>${esc(o.name)}</b> отклоняет безвиз`,o.flag);o.askedV=G.t;updDip()}
// the line keeps to the state's own land and neutral land (foreign land is closed to the route search)
const railBlk=s=>(x,y)=>{const o=ownerAt(x,y);return !!o&&o!==s.id+1};
function buildRailway(ev){const p=player();if(!ev||ev.bad)return false;let b=ev.B;
  if(!b){if(!startBuild(p,'station',ev.nb.x,ev.nb.y,ev.nb.ang))return false;b=p.builds[p.builds.length-1]}
  return startRail(p,ev.A.uid,b.uid,ev.L)}

// ---------- stage 5.9: the left rail as in DroneFlames — ШТАБ (wars, threats, armies, drones, air defence) and ЗАЛЕЖИ
// (free deposits on the own land: a filter by resource, the list; a row flies the camera there and opens the deposit card)
const ORF=[['all','Все',null],['metal','Металл',[3,4]],['prec','Драгмет.',[5]],['uran','Уран',[6]],['oil','Нефть',[0]],['gas','Газ',[1]],['coal','Уголь',[2]],['lith','Литий',[7]]];
let oreF='all',oreSig='';
function oreCss(){if(document.getElementById('orecss'))return;const st=document.createElement('style');st.id='orecss';st.textContent=ORES.map((o,i)=>`.ic-o-${i}{background-image:url(${oreIcon(i).toDataURL()});background-size:contain;background-repeat:no-repeat;background-position:center}`).join('\n');document.head.appendChild(st)}
const capOf=p=>p.places[0]||p.cap||{x:W.WORLD/2,y:W.WORLD/2};
function freeDeps(p){const c=capOf(p);return G.dep.map((d,i)=>[d,i]).filter(([d])=>d.known&&d.used<0&&d.amt>0&&own&&own[d.c]===p.id+1).map(([d,i])=>[d,i,M.hypot(d.x-c.x,d.y-c.y)]).sort((a,b)=>a[2]-b[2])}
const depAmt=d=>d.amt===Infinity?'∞':fmtK(d.amt);
// which building takes the deposit
const depBuild=d=>ORES[d.k].k==='oil'?'oil':ORES[d.k].k==='gas'?'gaswell':MINE[d.k]?'mine':null;
const depBName=d=>{const k=depBuild(d);return k==='oil'?'Нефтевышка':k==='gaswell'?'Газ. скважина':ORES[d.k].k==='uran'?'Уран. шахта':'Рудник'};
function updOres(){if(!G||G.phase!=='play')return;const p=player(),L=freeDeps(p);$('oren').textContent=L.length;$('oren').style.display=L.length?'':'none';
  const op=$('orep');$('b-ores').classList.toggle('on',op.classList.contains('show'));$('b-hq').classList.toggle('on',$('hqp').classList.contains('show'));if(!op.classList.contains('show'))return;
  const f=ORF.find(q=>q[0]===oreF),rows=L.filter(([d])=>!f[2]||f[2].includes(d.k)),sel=G.sel&&G.sel.dep;
  const sig=oreF+'|'+sel+'|'+rows.map(([d,i])=>i+':'+M.round(d.amt)).join(',')+'|'+L.length;if(sig===oreSig)return;oreSig=sig;
  $('oref').innerHTML=ORF.map(([k,n,ks])=>{const c=k==='all'?L.length:L.filter(([d])=>ks.includes(d.k)).length;return `<button data-f="${k}" class="${k===oreF?'on':''}" title="${c}">${ks?`<span class="ic ic-o-${ks[0]}"></span>`:''}${n} ${c}</button>`}).join('');
  $('orel').innerHTML=rows.length?rows.map(([d,i,r])=>`<button data-dep="${i}" class="${sel===i?'on':''}"><span class="ic ic-o-${d.k}"></span><span><b>${ORES[d.k].n}</b> · запас ${depAmt(d)}</span><small>${(r/1000).toFixed(1).replace('.',',')} км</small></button>`).join('')
    :`<p>${L.length?'Таких залежей на вашей земле нет.':'Все залежи на вашей земле уже добываются. Расширяйте границы городами и сёлами.'}</p>`;
  for(const b of $('oref').children)b.onclick=()=>{oreF=b.dataset.f;oreSig='';updOres()};
  for(const b of $('orel').querySelectorAll('[data-dep]'))b.onclick=()=>selDep(+b.dataset.dep,true)}
function selDep(i,fly){const d=G.dep[i];if(!d)return;G.sel={dep:i};G.mode=null;setBuild(null);panelSig='';if(fly)api.flyTo(d.x,d.y,M.min(api.cam.m,4));updPanel();oreSig='';updOres()}
function depPanel(el,i){const p=player(),d=G.dep[i];if(!d){G.sel=null;return}const o=own?own[d.c]:0,mine=o===p.id+1,bk=depBuild(d);const sig='d'+i+'|'+M.round(d.amt)+'|'+d.used+'|'+o+'|'+M.floor(p.res.money/100);if(sig===panelSig)return;panelSig=sig;
  const land=mine?'ваша земля':o?'земля: '+esc(G.states[o-1].name):'ничья земля',max=d.max===Infinity?'':' из '+fmtK(d.max);
  const gives=bk==='oil'?'Нефть +'+BLD.oil.prod.oil+' в секунду (для НПЗ)':bk==='gaswell'?'Топливо +3 и энергия +4 в секунду':MINE[d.k]?Object.entries(MINE[d.k]).map(([k,v])=>RESN[k]+' +'+v).join(', ')+' в секунду, руднику нужна энергия 3':'';
  let keys='';const why=bk&&mine&&d.used<0?canBuild(p,bk,d.x,d.y):null;
  if(bk&&mine&&d.used<0)keys+=card({id:'a-depb',n:depBName(d),tn:BLD[bk].n,sub:fmt(BLD[bk].cost),ic:'ic-b-'+bk,cls:p.res.money<BLD[bk].cost&&!creative()?'poor':'',dis:!!why,tip:why?why:'Поставить прямо на эту залежь'});
  keys+=card({id:'a-depgo',n:'Показать',ic:'ic-scout',tip:'Камера к залежи'});
  el.innerHTML=pcHead('ic-o-'+d.k,'Залежь: '+ORES[d.k].n.toLowerCase(),'месторождение · запас '+depAmt(d)+max+' · '+land+(d.used>=0?' · уже добывается':''))+`<div class="pc-s">Добыча</div><div class="pc-r">${keys}</div>`+
    `<div class="pc-d">${gives?'<b>'+depBName(d)+'</b> даст: '+gives+'. ':''}${mine?(d.used>=0?'Залежь уже добывается.':why?'Сейчас нельзя: '+why+'.':''):'Добывать можно только на своей земле — расширяйте границы городами и сёлами.'}</div>`;
  $('a-close').onclick=closeSel;$('a-depgo').onclick=()=>api.flyTo(d.x,d.y,M.min(api.cam.m,3));
  const b=$('a-depb');if(b)b.onclick=()=>{const k=depBuild(d),bad=canBuild(p,k,d.x,d.y);if(bad){toast(bad);return}if(p.res.money<BLD[k].cost&&!creative()){toast('Не хватает денег: нужно '+fmt(BLD[k].cost));return}
    if(startBuild(p,k,d.x,d.y)){toast(`Строится: <b>${BLD[k].n}</b> на залежи «${ORES[d.k].n}»`,'ic-b-'+k);closeSel();updHUD()}}}
// the HQ: everything about the war in one window
let hqSig='';
function updHQ(){const w=$('hqp');if(!w.classList.contains('show')||!G||G.phase!=='play')return;const p=player(),u=p.uav||{};let h='';
  const wars=G.states.filter(t=>atWar(p.id,t.id));h+=`<div class="pc-s">Войны</div>`+(wars.length?wars.map(t=>`<div class="hq-row"><span class="fl" data-st="${t.id}"></span><span><b>${esc(t.name)}</b><small>их армия ${fmt(strengthOf(t))} · наша ${fmt(strengthOf(p))}</small></span><button class="btn sm" data-peace="${t.id}">Мир</button></div>`).join(''):'<p class="note">Войн нет.</p>');
  const thr=[];for(const t of wars)for(const a of t.armies)if(a.units.length&&own){const c=cellOf(a.x,a.y);if(c>=0&&own[c]===p.id+1||p.places.some(q=>M.hypot(q.x-a.x,q.y-a.y)<6000))thr.push([t,a])}
  h+=`<div class="pc-s">Угрозы</div>`+(thr.length?thr.map(([t,a])=>`<div class="hq-row"><span class="ic ic-warn"></span><span><b>${esc(t.name)}: армия №${a.n}</b><small>${a.units.length} бойцов · сила ${fmt(strength(a))}</small></span><button class="btn sm" data-fly="${a.x|0},${a.y|0}">Показать</button></div>`).join(''):'<p class="note">Вражеских армий у ваших земель нет.</p>');
  h+=`<div class="pc-s">Армии</div>`+(p.armies.length?p.armies.map((a,i)=>`<div class="hq-row"><span class="ic ic-b-army"></span><span><b>Армия №${a.n}</b><small>${a.units.length} / 12 · ${a.tpl?TPL[a.tpl].n:'без сборки'} · ${a.fight?'в бою':a.tx!==null?'на марше':'стоит'}</small></span><button class="btn sm" data-army="${i}">Выбрать</button></div>`).join(''):'<p class="note">Армий нет: постройте военную часть (вкладка «Армия»).</p>');
  const sams=p.builds.filter(q=>q.k==='sam');h+=`<div class="pc-s">Дроны и ПВО</div>`+stat('Дроны на складах',uavN(p)+' / '+uavCap(p)+' · '+Object.keys(DRN).map(k=>DRN[k].n+' '+(u[k]||0)).join(', '))+stat('В воздухе',G.drones.filter(d=>d.st===p.id).length)+stat('ПВО',sams.length?sams.filter(q=>q.done&&q.off<=0).length+' на дежурстве из '+sams.length:'нет');
  const b=$('hqb');if(h===hqSig)return;hqSig=h;b.innerHTML=h;for(const e of b.querySelectorAll('.fl'))e.replaceWith(flagCanvas(G.states[+e.dataset.st].flag,30,20));
  for(const e of b.querySelectorAll('[data-peace]'))e.onclick=()=>{askPeace(G.states[+e.dataset.peace]);hqSig=''};
  for(const e of b.querySelectorAll('[data-fly]'))e.onclick=()=>{const [x,y]=e.dataset.fly.split(',').map(Number);api.flyTo(x,y,4)};
  for(const e of b.querySelectorAll('[data-army]'))e.onclick=()=>{const a=p.armies[+e.dataset.army];if(!a)return;G.sel={army:a};G.mode=null;panelSig='';updPanel();api.flyTo(a.x,a.y,M.min(api.cam.m,6))}}
function leftWin(id){const w=$(id),on=!w.classList.contains('show');for(const k of ['orep','hqp','mystate'])$(k).classList.remove('show');if(on)w.classList.add('show');oreSig='';hqSig='';$('msb')._h='';updOres();updHQ();updMyState()}
// a click on a deposit pin on the map opens its card
function depAt(sx,sy){if(!G.dep||mapMode==='off')return -1;const m=api.cam.m;if(m>75)return -1;let best=-1,bd=1e9;
  G.dep.forEach((d,i)=>{if(!d.known)return;if(d.used>=0&&mapMode!=='res'&&m<12)return;const X=api.sxw(d.x),Y=api.syw(d.y),h=mapMode==='res'?33:26;if(sx<X-11||sx>X+11||sy<Y-h||sy>Y+2)return;const e=M.abs(sx-X)+M.abs(sy-Y+h*0.6);if(e<bd){bd=e;best=i}});return best}
// own buildings as small pennants on the map between the near and the far view (as in DroneFlames), and on the minimap
const PCOL={factory:'#f2a52a',power:'#ffd050',solar:'#66b2f2',refinery:'#f2a52a',oil:'#2e2f36',gaswell:'#66b2f2',mine:'#a8743c',sawmill:'#7fcc4c',farm:'#7fcc4c',port:'#3a78c8',station:'#d9cfb6',
  barracks:'#dc523d',sam:'#dc523d',droneport:'#b4bec8',dronefab:'#b4bec8',dramp:'#b4bec8',drwy:'#b4bec8',dstore:'#b4bec8'};
function drawPennants(ctx,A){const m=A.cam.m,a=smoothst(4,8,m)*smoothst(70,48,m);if(a<=0.02)return;const p=player(),cell=new Set();ctx.save();ctx.globalAlpha=a;
  for(const q of p.builds){if(!q.done||q.k==='rail'||BLD[q.k].mod)continue;const X=A.sxw(q.x),Y=A.syw(q.y);if(X<-20||Y<-30||X>A.VW+20||Y>A.VH+20)continue;const key=(X/22|0)+','+(Y/22|0);if(cell.has(key))continue;cell.add(key);
    const s=18,x0=X-s/2,y0=Y-s-6;ctx.fillStyle='#131410';ctx.fillRect(x0-1,y0-1,s+2,s+2);ctx.fillStyle=q.off>0?'#6e2a20':'#2a2b27';ctx.fillRect(x0,y0,s,s);ctx.strokeStyle='#a88c5a';ctx.lineWidth=1;ctx.strokeRect(x0+0.5,y0+0.5,s-1,s-1);
    ctx.fillStyle='#131410';ctx.beginPath();ctx.moveTo(X-4,y0+s);ctx.lineTo(X+4,y0+s);ctx.lineTo(X,Y-1);ctx.closePath();ctx.fill();ctx.drawImage(bIcon(q.k),x0+2,y0+2,s-4,s-4)}ctx.restore()}
function drawMiniBuilds(mx,s){const p=player();for(const q of p.builds){if(!q.done||q.k==='rail'||BLD[q.k].mod)continue;const x=q.x*s,y=q.y*s;mx.fillStyle='#131410';mx.fillRect(x-2.5,y-2.5,5,5);mx.fillStyle=PCOL[q.k]||'#fbf3e0';mx.fillRect(x-1.5,y-1.5,3,3)}}
// ---------- engine hooks
function ownBuildAt(x,y){for(const q of player().builds){if(!q.done||q.id<0||q.k==='rail')continue;const z=W.zones[q.id];if(z&&!z.dead&&rectHit(z,x,y,1,1))return q}return null}
function pickArmy(sx,sy){for(const s of G.states){if(!s.isP)continue;for(const a of s.armies){if(!a.units.length)continue;if(M.abs(api.sxw(a.x)-sx)<18&&M.abs(api.syw(a.y)-sy)<14)return a}}
  for(const s of G.states)if(s.isP)for(const a of s.armies){const q=a.home;if(!q.done)continue;const b=BLD.barracks;if(M.abs(q.x-api.toWorld(sx,sy)[0])<b.W/2&&M.abs(q.y-api.toWorld(sx,sy)[1])<b.H/2)return a}return null}
const hooks={
  pdown(x,y,sx,sy){if(G&&G.phase==='play'&&G.build&&lastTouch){const b=BLD[G.build];if(PL.grab(x,y,(b.R||(b.W?M.max(b.W,b.H)/2:b.point?12:320))+16*api.cam.m))return true}
    if(!G||G.phase!=='play'||G.mode!=='rail')return false;const q=stationAtScreen(sx,sy);if(!q)return false;closeConfirm();railDrag={a:q,x,y,sx,sy,ev:null,et:0};return true},
  pmove(x,y,sx,sy){if(PL.state.drag){PL.move(x,y);return}if(railDrag){railDrag.x=x;railDrag.y=y;railDrag.sx=sx;railDrag.sy=sy}},
  pup(x,y,sx,sy,cancel){if(PL.state.drag){PL.release();return}if(!railDrag)return;const d=railDrag;railDrag=null;if(cancel)return;const ev=railEval(d.a,x,y,sx,sy);if(ev.bad){toast(ev.bad);return}
    G.railAsk=ev;openAsk(`ЖД путь ${fmtKm(ev.L)}${ev.nb?' и новый вокзал':''}`,`${ev.B?'Соединит два вокзала':'В конце пути встанет вокзал'}<br>Стоимость <b>${fmt(ev.cost)}</b>`,()=>{if(buildRailway(ev)){onBuilt('rail',false);updHUD()}},sx,sy)},
  frame(dt){if(lightsDirty&&G&&api&&api.lights){lightsDirty=false;syncLights()}if(!G||G.over&&G.speed===0){return}const sp=G.phase==='play'&&own&&api&&api.ready?G.speed:0;if(sp>0){simAcc+=dt*sp;prf('sim',()=>{while(simAcc>0.1){sim(0.1);simAcc-=0.1}})}
    if(G.flights)for(const f of G.flights)f.g.s=flAt(f.g,G.t+simAcc-f.t0);
    G._hud=(G._hud||0)+dt;if(G._hud>0.25){G._hud=0;prf('hud',()=>{updHUD();updDip()})}},
  draw:(ctx,A)=>{drawOverlay(ctx,A);if(G&&G.phase==='play'&&own)drawObjects(ctx,A)},
  glDraw:(g,A)=>glBorders(g,A),
  seen:(x,y)=>!G||!own||seenAt(x,y),
  mini:(mx,s)=>drawMini(mx,s),
  click(x,y,sx,sy){if(!G)return false;if(G.phase==='found'){const bad=validSite(x,y);if(bad){toast(bad);if(!placing)setPlacing(true);return true}if(!placing){setPlacing(true)}openConfirm(x,y,sx,sy);return true}
    if(G.build){placeTap(x,y);return true}
    if(G.mode&&G.mode.startsWith('uav:')){const k=G.mode.slice(4),D=DRN[k],p=player();let to=null;
      if(!D.recon){const o=ownerAt(x,y)-1;if(o<0||!atWar(0,o)){toast('Цель — на земле государства, с которым идёт война');return true}to=o}
      const why=launchUav(p,k,x,y,to);if(why){toast(why);return true}toast(`${D.n} запущен${D.recon?' на разведку':''}`,'ic-b-'+D.ic);if(!(p.uav[k]>0))G.mode=null;panelSig='';updCatalog();return true}
    if(G.mode==='rail'){if(!stationAtScreen(sx,sy))toast('Нажмите на свой вокзал и, не отпуская, ведите путь');return true}
    const own=ownBuildAt(x,y);
    if(G.mode==='demolish'){if(!own){toast('Здесь нет вашей постройки');return true}toast(`Снести <b>${BLD[own.k].n}</b>${own.k==='station'?' вместе с его путями':own.k==='droneport'?' вместе с модулями':''}? Вернётся ${fmt(BLD[own.k].cost*0.3)}`,'ic-b-demolish',[['Снести',()=>{demolish(player(),own);G.sel=null;panelSig='';updHUD()}],['Отмена',()=>{}]],9000);G.mode=null;updCatalog();return true}
    const a=pickArmy(sx,sy);if(a){G.sel={army:a};G.mode=null;panelSig='';updPanel();onBuilt('assembly',false);return true}
    if(!G.mode&&!own){const di=depAt(sx,sy);if(di>=0){selDep(di,false);return true}}
    if(own&&!G.mode){G.sel={build:own};panelSig='';updPanel();return true}
    if(G.sel&&G.sel.army&&G.mode==='move'){const ar=G.sel.army;ar.tx=x;ar.ty=y;G.mode=null;panelSig='';return true}
    if(fogOn()&&!seenAt(x,y))return true;if(G.sel){G.sel=null;G.mode=null;panelSig=''}return false},
  key(e){if(!G||document.body.classList.contains('m-settings'))return !!G;if(e.code==='Escape'){if($('confirm').classList.contains('show')){closeConfirm();return true}if(placing){setPlacing(false);return true}if(railDrag){railDrag=null;return true}
      if(G.build){setBuild(null);return true}if(G.mode||G.sel){G.mode=null;G.sel=null;panelSig='';updPanel();updCatalog();return true}for(const w of ['store','mystate','dip','orep','hqp'])if($(w).classList.contains('show')){$(w).classList.remove('show');updOres();return true}ui.pause(true);return true}
    if(G.phase!=='play')return false;if(G.build&&e.code==='KeyR'){PL.rotate(1,e.shiftKey);return true}if(G.build&&(e.code==='Enter'||e.code==='NumpadEnter')){placeConfirm();return true}
    if(e.code==='Space'||e.code==='KeyP'){setSpeed(G.speed?0:(G._lastSp||1));e.preventDefault();return true}
    if(e.code==='KeyF'||e.code==='Tab'){const n={1:2,2:4,4:1}[G._lastSp||1];G._lastSp=n;setSpeed(n);e.preventDefault();return true}
    const d=/^Digit([1-7])$/.exec(e.code);if(d){setTab(TABS[+d[1]-1][0],true);return true}return false},
  inspect(c){const o=ownerAt(c.x,c.y);if(!o)return G&&G.phase==='play'?'<tr><td>Государство</td><td>ничейная земля</td></tr>':'';const s=G.states[o-1];
    return `<tr><td>Государство</td><td><span class="own"><i class="chip" style="background:${s.color}"></i>${esc(s.name)}${c.cap!==undefined?' · столица':''}</span></td></tr>`}};

// ---------- boot / phases
function boot(caps,onReady,ops){if(api){api.destroy();api=null}lightsDirty=true;
  const vo=ui.viewOpts();api=startWorld({seed:cfg.seed,opt:mapOpt(caps),ops:ops||[],mode:'game',tod:cfg.rules.dayNight?9.5:12.5,dayNight:cfg.rules.dayNight,view:vo,hooks,onReady:A=>{onReady&&onReady(A)}});
  W=api.W;ui.loading('Отрисовка карты',api.W.cities.length+' населённых пунктов · '+api.W.zones.length+' объектов');api.setTodRate(G.speed*4/60);if(!cfg.rules.dayNight)api.setTodRate(0);document.getElementById('fps').classList.toggle('hid',!vo.fps)}
function mkState(i,o,isP){return {id:i,name:o.name,capital:o.capital,gov:o.gov,flag:o.flag,color:o.color,isP,diff:isP?1:o.diff,trait:o.trait==='random'?['trader','militarist','cautious','adventurer'][(hsh(i,77)*4)|0]:o.trait,
  res:{money:isP&&creative()?Infinity:o.money,food:60,goods:30,wood:0,oil:0,fuel:0,metal:0},uav:{lancet:0,geran:0,orlan:0},bat:0,batC:0,earned:0,income:0,cells:0,pop:0,score:0,cap:null,cityId:-1,grow:0.18,growQ:0,allies:[],places:[],builds:[],armies:[],flow:{},energy:[0,0],rgb:hexRgb(o.color)}}
function initState(c){cfg=c;tutorial=!!c.tutorial;hintsOff=!ui.settings().hints;placing=false;pend=null;mapMode='pol';hintStep=0;simAcc=0;polC=null;fogC=null;ovC=null;dirtyOv=true;bordC=null;bordDirty=true;borders=null;panelSig='';
  G={t:0,speed:1,phase:'found',states:[],dep:[],offers:[],over:false,dec:0,wars:new Set(),drones:[],fx:[],build:null,mode:null,sel:null,uid:0,rev:new Set(),railAsk:null,forPort:null};railDrag=null;askFn=null;hidSig='';hidDirty=true;
  G.states.push(mkState(0,Object.assign({},c.country,{money:c.rules.money,diff:1,trait:'random'}),true));
  botList().forEach((b,i)=>G.states.push(mkState(i+1,b,false)));
  const p=player();$('hname').textContent=p.name;$('hgov').textContent=p.gov+' · столица '+p.capital;flagCanvas(p.flag,42,28,$('hflag'));flagCanvas(p.flag,54,36,$('msf'));$('msh').textContent=p.gov+' '+p.name;G._lastSp=1;setSpeed(1);updModes();tab='cities';tabSig='';
  document.body.classList.remove('tray-off','sel');$('bb-cat').innerHTML='';$('gpanel').innerHTML='';
  closeWins();oreCss();oreSig='';hqSig=''}
// every window of a game closes when a game starts AND when it ends: a panel left open (the free deposits, the HQ…) stayed
// on top of the main menu after «Выйти в главное меню» (stage 6.1)
function closeWins(){for(const w of ['over','dip','mystate','store','orep','hqp','ktip','pbar'])$(w).classList.remove('show');for(const b of ['b-ores','b-hq'])$(b).classList.remove('on');laneClear()}
function depOp(){return {f:'addDeposits',q:G.dep.map(d=>[d.k,M.round(d.x),M.round(d.y),M.round(200+ORES[d.k].v*14)])}}
function newGame(c){initState(c);const MT={normal:'обычная карта',cont:'материки',arch:'архипелаг',islands:'острова'};ui.loading('Создание мира',`Сид ${c.seed} · ${MT[c.map.type]} · рельеф, реки, леса, месторождения`);setTimeout(()=>{boot(null,()=>{ui.loaded();analyse();G.dep=genDeposits();const o=depOp();api.op(o.f,o.q);hint(0);updHUD()});document.body.className='m-game';updHUD()},60)}
// founding: bots pick their sites, the world is rebuilt with the capitals; land is taken around them
function found(x,y){closeConfirm();setPlacing(false);const picks=chooseCaps(x,y);const p=player();p.cap={x,y};for(const [b,s] of picks)b.cap={x:s.x,y:s.y};
  G.phase='play';ui.loading('Основание государств',G.states.filter(s=>s.cap).map(s=>esc(s.name)).join(' · '));
  setTimeout(()=>{const caps=G.states.filter(s=>s.cap).map(s=>({x:s.cap.x,y:s.cap.y,st:s.id,name:s.capital,fl:s.flag}));cfg.caps=caps;const keep=G.dep;
    G.dep=keep;boot(caps,()=>{ui.loaded();api.flyTo(x,y,3.2,4.5)},[depOp()]);
    for(const s of G.states){const c=W.cities.find(q=>q.cap===s.id);s.cityId=c?c.id:-1;s.growQ=-1;if(c)s.places=[{k:'capital',id:c.id,x:c.x,y:c.y,name:s.capital,st:s,t0:0}];syncGrow(s)}
    G.dep=keep;for(const s of G.states)if(s.cityId>=0)clearDeps(W.cities[s.cityId]);initTerritory();updPop();rebuildFog();
    for(const s of G.states.slice(1))if(s.cap)toast(`<b>${esc(s.name)}</b> основала столицу <b>${esc(s.capital)}</b>`,s.flag);
    toast(`Вы основали столицу <b>${esc(p.capital)}</b>. ${esc(p.gov)} ${esc(p.name)} начинает свою историю`,p.flag,null,9000);hint(2);save(true)},60)}
function snapshot(){const P=player();return {cfg,meta:{date:Date.now(),name:P.name,flag:P.flag,t:G.t,phase:G.phase,day:gameClock(),score:P.score,map:cfg.map.type},
  g:{t:G.t,phase:G.phase,over:G.over,wars:[...G.wars],ops:api?api.ops.slice():[],hint:hintStep,uid:G.uid,rev:[...G.rev],
    states:G.states.map(s=>({res:Object.fromEntries(Object.entries(s.res).map(([k,v])=>[k,v===Infinity?'inf':v])),earned:s.earned,cap:s.cap,grow:s.grow,allies:s.allies,visa:s.visa||[],trait:s.trait,dead:s.dead,lostCap:s.lostCap,planI:s.planI,warAfter:s.warAfter,armyN:s.armyN,uav:s.uav,bat:s.bat,
      places:s.places.map(p=>({k:p.k,id:p.id,x:p.x,y:p.y,grow:p.grow,name:p.name,t0:p.t0,bq:p.bq})),builds:s.builds.map(q=>({k:q.k,x:q.x,y:q.y,t:q.t,time:q.time,done:q.done,id:q.id,off:q.off,dep:q.dep,failed:q.failed,uid:q.uid,a:q.a,b:q.b,L:q.L,cost:q.cost,port:q.port,queue:q.queue,pt:q.pt,paid:q.paid,up:q.up})),
      armies:s.armies.map(a=>({n:a.n,id:a.id,x:a.x,y:a.y,tpl:a.tpl,units:a.units,tx:a.tx,ty:a.ty,home:s.builds.indexOf(a.home)}))})),
    dep:G.dep.map(d=>[d.k,M.round(d.x),M.round(d.y),d.amt===Infinity?-1:M.round(d.amt),d.max===Infinity?-1:M.round(d.max),d.known?1:0,d.used]),own:own?rle(own):null,expl:expl?rle(expl):null,cam:api?[api.cam.x,api.cam.y,api.cam.m]:null}}}
function save(auto){if(!G||!cfg||cfg.tutorial&&auto)return false;const ok=Saves.put(cfg.slot||1,snapshot());if(!auto)toast(ok?`Сохранено в ячейку ${cfg.slot||1}`:'Не удалось сохранить: нет места в хранилище браузера',ok?'ic-save':'ic-warn');return ok}
function load(sv){const c=sv.cfg;initState(c);const g=sv.g;G.t=g.t;G.phase=g.phase;G.over=g.over;G.wars=new Set(g.wars||[]);G.rev=new Set(g.rev||[]);G.uid=g.uid||0;
  g.states.forEach((q,i)=>{const s=G.states[i];if(!s)return;if(q.res)for(const k in q.res)s.res[k]=q.res[k]==='inf'?Infinity:q.res[k];Object.assign(s,{earned:q.earned,cap:q.cap,grow:q.grow,allies:q.allies||[],visa:q.visa||[],trait:q.trait||s.trait,dead:q.dead,lostCap:q.lostCap,planI:q.planI,warAfter:q.warAfter,armyN:q.armyN});if(q.uav)s.uav=Object.assign({lancet:0,geran:0,orlan:0},q.uav);s.bat=q.bat||0;if(s.res.metal==null)s.res.metal=0;
    s.places=(q.places||[]).map(p=>Object.assign({growQ:-1,st:s},p));s.builds=(q.builds||[]).map(b=>{if(b.uid==null)b.uid=++G.uid;return b});s.armies=(q.armies||[]).map(a=>Object.assign({st:s.id,rec:0,fight:0},a,{home:s.builds[a.home]||s.builds[0]}));s.builds=s.builds.filter(b=>b.k!=='lamp') /* stage 6.1: the lamp building is gone — street lights belong to the world */});
  ui.loading('Загрузка сохранения',esc(sv.meta.name)+' · '+sv.meta.day);
  setTimeout(()=>{const caps=G.phase==='play'?c.caps:null;boot(caps,()=>{ui.loaded();if(g.cam){api.cam.x=g.cam[0];api.cam.y=g.cam[1];api.cam.m=g.cam[2]}},g.ops);document.body.className='m-game';
    analyse();G.dep=g.dep.map(a=>({k:a[0],x:a[1],y:a[2],c:cellOf(a[1],a[2]),amt:a[3]<0?Infinity:a[3],max:a[4]<0?Infinity:a[4],known:!!a[5],used:a[6]===undefined?-1:a[6]}));
    if(G.phase==='play'){own=unrle(g.own,new Uint8Array(N*N));vis=new Uint8Array(N*N);expl=g.expl?unrle(g.expl,new Uint8Array(N*N)):new Uint8Array(N*N);
      for(const s of G.states){s.cells=0;s.bb=null;s._P=null;s._dirty=true;const ct=W.cities.find(q=>q.cap===s.id);s.cityId=ct?ct.id:-1;s.growQ=-1;syncGrow(s);for(const p of s.places)if(p.k!=='capital'&&p.grow<1)syncPlace(p)}
      for(let k=0;k<N*N;k++)if(own[k]){const s=G.states[own[k]-1],i=k%N,j=(k/N)|0;s.cells++;const b=s.bb||(s.bb=[i,j,i,j]);if(i<b[0])b[0]=i;if(j<b[1])b[1]=j;if(i>b[2])b[2]=i;if(j>b[3])b[3]=j}
      updPop();dirtyPol=true;dirtyFog=true;hint(g.hint>=2?g.hint:2)}else hint(0);
    if(G.over)setSpeed(0);updHUD()},60)}
function exit(){if(G&&!G.over)save(true);if(api){api.destroy();api=null}G=null;W=null;own=null;placing=false;document.body.classList.remove('placing','placing-k','placing-cap','sel');capSig=null;closeConfirm();hideHint();closeWins()}

// ---------- DOM wiring (once)
function wire(u){ui=u;
  $('cfy').onclick=()=>{if(askFn){const f=askFn;closeConfirm();f();return}if(pend)found(pend.x,pend.y)};$('cfn').onclick=()=>closeConfirm();
  $('hintx').onclick=()=>hideHint();$('plan').onclick=()=>{if($('hint').classList.contains('show'))hideHint();else hint(hintStep,true)};
  $('dipx').onclick=()=>$('dip').classList.remove('show');$('msx').onclick=()=>$('mystate').classList.remove('show');$('stx').onclick=()=>$('store').classList.remove('show');
  $('hstate').onclick=()=>{if(!G||G.phase!=='play')return;leftWin('mystate')};$('b-hq').onclick=()=>leftWin('hqp');$('b-ores').onclick=()=>leftWin('orep');
  $('orex').onclick=()=>leftWin('orep');$('hqx').onclick=()=>{$('hqp').classList.remove('show');updOres()};
  $('hres').onclick=()=>{if(!G)return;$('store').classList.toggle('show');$('stb')._h='';updStore()};
  $('a-found').onclick=()=>{if(G&&G.phase==='found')setPlacing(!placing)};$('a-found-x').onclick=()=>setPlacing(false);
  $('bmenu').onclick=()=>ui.pause(true);
  // the tooltip of the keys and tabs (as in DroneFlames: the title, the price, what it does)
  document.addEventListener('pointerdown',e=>{lastTouch=e.pointerType==='touch'||e.pointerType==='pen'},true);
  addEventListener('keydown',e=>{if(e.key==='Shift')shiftDown=true});addEventListener('keyup',e=>{if(e.key==='Shift')shiftDown=false});addEventListener('blur',()=>{shiftDown=false});
  // the right mouse button cancels the armed building (as Esc)
  $('c').addEventListener('contextmenu',e=>{e.preventDefault();if(G&&G.build){setBuild(null)}else if(G&&G.mode){G.mode=null;railDrag=null;updCatalog()}});
  $('pbrot').onclick=()=>PL.rotate(1,lastTouch);$('pbok').onclick=()=>placeConfirm();$('pbno').onclick=()=>setBuild(null);
  // touch: a tap on any HUD button acts at once on pointerup (finger lifted on the same button, moved < 12 px). Chrome does
  // not synthesise a click for a tap that follows a drag (of the map or of the ghost), and adds a delay otherwise; the late
  // native click is swallowed so nothing acts twice. A swipe over the key tray still scrolls it.
  let tdn=null,swal=null;
  document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'){tdn=null;return}const b=e.target.closest&&e.target.closest('button');tdn=b&&!b.disabled?{b,id:e.pointerId,x:e.clientX,y:e.clientY}:null},true);
  document.addEventListener('pointerup',e=>{const d=tdn;tdn=null;if(!d||e.pointerId!==d.id||M.hypot(e.clientX-d.x,e.clientY-d.y)>12)return;const b=e.target.closest&&e.target.closest('button');
    // the key tray is re-rendered while a finger is down: the same key is the same data-k / data-t / id
    const same=b&&(b===d.b||(b.dataset.k&&b.dataset.k===d.b.dataset.k)||(b.dataset.t&&b.dataset.t===d.b.dataset.t)||(b.dataset.mode&&b.dataset.mode===d.b.dataset.mode)||(b.id&&b.id===d.b.id));if(!same||b.disabled)return;swal={b,t:performance.now()};b.click()},true);
  document.addEventListener('click',e=>{if(swal&&e.isTrusted&&performance.now()-swal.t<800&&swal.b.contains(e.target)){e.stopPropagation();e.preventDefault();swal=null}},true);
  const tip=$('ktip');document.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse'){tip.classList.remove('show');return}const k=e.target.closest&&e.target.closest('[data-tn]');if(!k){tip.classList.remove('show');return}
    tip.innerHTML=`<b>${esc(k.dataset.tn)}</b>${k.dataset.tc?`<i>${esc(k.dataset.tc)}</i>`:''}${k.dataset.td?`<span>${esc(k.dataset.td)}</span>`:''}`;
    const r=k.getBoundingClientRect(),z=zf();tip.style.left=M.max(150*z,M.min(innerWidth-150*z,r.left+r.width/2))/z+'px';tip.style.top=M.max(60*z,r.top-8)/z+'px';tip.classList.add('show')});
  document.addEventListener('pointerdown',()=>tip.classList.remove('show'),true);
  // the minimap, the scale and the inspector stand on the bottom dock: its height goes to --bbh
  new ResizeObserver(bbh).observe($('bbar'));addEventListener('resize',()=>setTimeout(bbh,0));
  $('bb-l').onclick=()=>$('bb-cat').scrollBy({left:-300,behavior:'smooth'});$('bb-r').onclick=()=>$('bb-cat').scrollBy({left:300,behavior:'smooth'});buildTabs();
  $('bpause').onclick=()=>{if(G&&G.phase==='play')setSpeed(G.speed?0:(G._lastSp||1))};$('bspeed').onclick=()=>{if(G&&G.phase==='play'){const n={1:2,2:4,4:1}[G._lastSp||1];G._lastSp=n;setSpeed(n)}};
  $('overm').onclick=()=>{$('over').classList.remove('show');ui.toMenu()};$('overk').onclick=()=>$('over').classList.remove('show')}
return {wire,newGame,load,save,exit,setSpeed:v=>G&&setSpeed(v),get G(){return G},get api(){return api},paused:()=>G?G.speed===0:true,
  pauseInfo:()=>G?`${esc(player().name)} · ${gameClock()} · ${fmt(player().score)} очков · ячейка ${cfg.slot||1}`:'',setIcon:(k,img)=>{ICONIMG[k]=img},
  _prof:PRF,_dbg:DBG,_test:{toast,LANE,claim:(i,x,y,r)=>{claimDisc(G.states[i],x,y,r);dirtyPol=true},HINTS,hint:(i)=>hint(i,true),hintStep:()=>hintStep,startBuildFor:(i,k,x,y)=>startBuild(G.states[i],k,x,y),canBuildFor:(i,k,x,y)=>canBuild(G.states[i],k,x,y),signVisa:i=>signVisa(player(),G.states[i]),visa:i=>visa(player(),G.states[i]),flightPath,demolish:q=>demolish(player(),q),run:sec=>{for(let t=0;t<sec;t+=0.1)sim(0.1)},validSite:(x,y)=>validSite(x,y),found,get own(){return own},chooseCaps,canBuild:(k,x,y,a)=>canBuild(player(),k,x,y,a),startBuild:(k,x,y,a)=>startBuild(player(),k,x,y,a),PL,setBuild,placeTap,placeConfirm,syncLights,set touch(v){lastTouch=v},set shift(v){shiftDown=v},BLD,declareWar:(i)=>declareWar(player(),G.states[i]),launchDrone,launchUav:(k,x,y,to)=>launchUav(player(),k,x,y,to),startRail:(a,b,L)=>startRail(player(),a,b,L),railEval,buildRailway,
    buyUp:(q,u)=>buyUp(player(),q,u),clearDeps,updHidden,DRN,oreIcon,uavCap:()=>uavCap(player()),daylight,stationAtScreen,get hidSig(){return hidSig},get vis(){return vis}}};
})();

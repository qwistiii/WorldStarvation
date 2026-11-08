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
  map:{type:'normal',size:1,rivers:2,lakes:2},
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
let land=null,elev=null,coast=null,jit=null,own=null,vis=null,expl=null,heaps=[],seen=[];
let polC=null,fogC=null,borders=null,dirtyPol=true,dirtyFog=true,polT=0,fogT=0,simAcc=0;
let placing=false,pend=null,mapMode='pol',hintStep=0,hintsOff=false,tutorial=false;
const ICONS={};

// ---------- helpers
const cellOf=(x,y)=>{const i=M.floor(x/CSZ),j=M.floor(y/CSZ);return i<0||j<0||i>=N||j>=N?-1:j*N+i};
const cx=c=>(c%N+0.5)*CSZ,cy=c=>(M.floor(c/N)+0.5)*CSZ;
const hsh=(a,b)=>{let h=M.imul(a|0,0x27d4eb2d)^M.imul(b|0,0x165667b1)^(cfg?cfg.seed:0);h=M.imul(h^(h>>>15),0x85ebca6b);h^=h>>>13;return (h>>>0)/4294967296};
function rngS(s){let a=s>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=M.imul(a^(a>>>15),1|a);t=(t+M.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296}}
function mapOpt(caps){const m=cfg.map;return {map:m.type,size:m.size,rivers:m.rivers,lakes:m.lakes,caps:caps||undefined}}
const player=()=>G.states[0];
const creative=()=>cfg.rules.mode==='creative';

// ---------- heap (cost, cell, water run) per state
function hpush(h,c,cell,w){h.push([c,cell,w]);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;[h[p],h[i]]=[h[i],h[p]];i=p}}
function hpop(h){const top=h[0],last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===i)break;[h[m],h[i]]=[h[i],h[m]];i=m}}return top}

// ---------- world analysis
function analyse(){land=new Uint8Array(N*N);elev=new Float32Array(N*N);coast=new Uint8Array(N*N);jit=new Float32Array(N*N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=(i+0.5)*CSZ,y=(j+0.5)*CSZ,e=W.baseH(x,y,6),k=j*N+i;elev[k]=e;land[k]=e>0.004?1:0;jit[k]=hsh(i,j)}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i;if(!land[k])continue;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=(j+b)*N+i+a;if(i+a<0||j+b<0||i+a>=N||j+b>=N||!land[q]){coast[k]=1;break}}}}
function validSite(x,y){if(x<7000||y<7000||x>W.WORLD-7000||y>W.WORLD-7000)return 'Слишком близко к краю мира';
  const e=W.landE(x,y,0.006);if(e<0)return 'Здесь вода';if(e<0.025)return 'Слишком низко — болота у берега';if(e>0.32)return 'Горы: город здесь не построить';
  let n=0,ok=0;for(let a=0;a<16;a++){const r=a<8?1600:3000,t=a*0.785+(a<8?0:0.39);n++;if(W.landE(x+M.cos(t)*r,y+M.sin(t)*r,0)>=0)ok++}if(ok/n<0.62)return 'Мало суши вокруг';
  if(G&&G.phase!=='found')return 'Столица уже основана';return null}

// ---------- states
function mkState(i,o,isP){return {id:i,name:o.name,capital:o.capital,gov:o.gov,flag:o.flag,color:o.color,isP,diff:isP?1:o.diff,trait:o.trait==='random'?['trader','militarist','cautious','adventurer'][(hsh(i,77)*4)|0]:o.trait,
  money:isP&&creative()?Infinity:o.money,earned:0,income:0,cells:0,pop:0,ores:0,score:0,cap:null,cityId:-1,grow:0.18,growQ:0,boostT:0,invest:0,dec:0,allies:[],spd:1,rgb:hexRgb(o.color)}}
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
function claim(s,c){own[c]=s.id+1;s.cells++;dirtyPol=true;dirtyFog=true;s._dirty=true;const i=c%N,j=(c/N)|0,b=s.bb||(s.bb=[i,j,i,j]);if(i<b[0])b[0]=i;if(j<b[1])b[1]=j;if(i>b[2])b[2]=i;if(j>b[3])b[3]=j}
function pushNb(s,c,cost,w){const i=c%N,j=(c/N)|0,h=heaps[s.id],sn=seen[s.id];
  for(let d=0;d<8;d++){const a=[1,-1,0,0,1,1,-1,-1][d],b=[0,0,1,-1,1,-1,1,-1][d];const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=N||jj>=N)continue;const q=jj*N+ii;if(sn[q])continue;
    const L=land[q];if(!L&&w>=3)continue;sn[q]=1;let k=(d<4?1:1.414)*(L?stepCost(s,q):4.5);hpush(h,cost+k,q,L?0:w+1)}}
function stepCost(s,q){let k=1+M.max(0,elev[q]-0.22)*9+jit[q]*0.9;
  switch(s.trait){case 'trader':if(coast[q])k*=0.55;break;case 'adventurer':k*=0.6+jit[q]*1.1;break;case 'cautious':k*=1.15;break;case 'militarist':{let md=1e9;for(const o of G.states)if(o!==s&&o.cap)md=M.min(md,M.hypot(cx(q)-o.cap.x,cy(q)-o.cap.y));k*=0.75+M.min(1,md/40000)*0.5}}
  return k}
function initTerritory(){own=new Uint8Array(N*N);vis=new Uint8Array(N*N);expl=new Uint8Array(N*N);heaps=[];seen=[];
  for(const s of G.states){heaps[s.id]=[];seen[s.id]=new Uint8Array(N*N);s.cells=0}
  for(const s of G.states){if(!s.cap)continue;const c=cellOf(s.cap.x,s.cap.y);seen[s.id][c]=1;hpush(heaps[s.id],0,c,0)}
  // core: the first ~3 km around each capital at once
  for(let k=0;k<40;k++)for(const s of G.states)if(s.cap)expandOne(s)}
function rebuildFrontier(){heaps=[];seen=[];for(const s of G.states){heaps[s.id]=[];seen[s.id]=new Uint8Array(N*N)}
  for(let c=0;c<N*N;c++){const o=own[c];if(!o)continue;const s=G.states[o-1];seen[s.id][c]=1}
  for(let c=0;c<N*N;c++){const o=own[c];if(!o)continue;const s=G.states[o-1];const d=s.cap?M.hypot(cx(c)-s.cap.x,cy(c)-s.cap.y)/CSZ:0;pushNb(s,c,d,0)}}
function expandOne(s){const h=heaps[s.id];while(h.length){const [cost,c,w]=hpop(h);if(own[c])continue;if(!land[c]){pushNb(s,c,cost,w);continue}claim(s,c);pushNb(s,c,cost,0);return true}return false}
function rateOf(s){const r=cfg.rules,gm=s.isP?1:[0.6,1,1.6][r.botGrowth];return (3+M.sqrt(s.cells)*0.12)*gm*(s.boostT>0?2.6:1)}

// ---------- deposits
function genDeposits(){const r=cfg.rules,R=rngS(cfg.seed^0x0e5);const dep=[];let want=[];
  if(r.ores==='custom')for(const o of ORES)for(let q=0;q<(r.oreCustom[o.k]|0);q++)want.push(o);
  else{const n={few:34,balance:70,many:130}[r.ores]||70;const tw=ORES.reduce((a,o)=>a+o.w,0);for(let q=0;q<n;q++){let t=R()*tw;for(const o of ORES){t-=o.w;if(t<=0){want.push(o);break}}}}
  const mul=creative()?Infinity:[1,3,Infinity][r.reserves];
  for(const o of want){for(let t=0;t<60;t++){const x=6000+R()*(W.WORLD-12000),y=6000+R()*(W.WORLD-12000);const c=cellOf(x,y);if(!land[c]||W.landE(x,y,0)<0)continue;
      let bad=false;for(const k of W.cities)if(M.hypot(k.x-x,k.y-y)<k.R*1.3+300){bad=true;break}if(bad)continue;if(dep.some(d=>M.hypot(d.x-x,d.y-y)<2500))continue;
      const amt=o.v*(700+R()*700)*mul;dep.push({k:ORES.indexOf(o),x,y,c,amt,max:amt,known:!r.fog});break}}
  return dep}

// ---------- economy and score
function popOf(c,s){const R=c.R;let p=c.type===0?R*2.2:c.type===1?R*R*0.05:c.type===2?R*R*0.08:R*R*0.11;if(c.cap!==undefined){const st=G.states[c.cap];p*=st?st.grow:1}return p}
function econ(dt){for(const s of G.states){if(!s.cap)continue;let ores=0,oreInc=0;for(const d of G.dep){if(own[d.c]!==s.id+1||d.amt<=0)continue;ores++;const take=ORES[d.k].v*dt;oreInc+=ORES[d.k].v;if(d.amt!==Infinity)d.amt=M.max(0,d.amt-take)}
    s.ores=ores;const mul=s.isP?1:DIFF[s.diff].inc;s.income=(4+s.cells*0.035+s.pop/40000+oreInc)*mul;if(s.money!==Infinity)s.money+=s.income*dt;s.earned+=s.income*dt;
    s.boostT=M.max(0,s.boostT-dt);
    // the capital grows by itself; investments speed it up
    if(s.grow<1){s.grow=M.min(1,s.grow+dt*0.0042*(s.isP?1:[0.6,1,1.6][cfg.rules.botGrowth]));syncGrow(s)}
    s.score=M.round(s.cells*0.262*2+s.pop/2000+s.earned/100)}}
function syncGrow(s){const q=s.grow>=1?1:M.floor(s.grow/0.07)*0.07+0.07;if(q!==s.growQ&&s.cityId>=0){s.growQ=q;api.setGrow(s.cityId,M.min(1,q))}}
function updPop(){for(const s of G.states)s.pop=0;for(const c of W.cities){const k=cellOf(c.x,c.y);const o=k>=0?own[k]:0;if(o)G.states[o-1].pop+=popOf(c)}}

// ---------- actions (shared by the player and the bots)
const ACT={
  boost:{n:'Ускорить расширение',d:'Территория растёт в 2,6 раза быстрее 45 с',cost:s=>M.round(400+s.cells*0.5),ok:s=>s.boostT<=0,run:s=>{s.boostT=45}},
  invest:{n:'Инвестировать в столицу',d:'Новые кварталы, +10 % к застройке',cost:s=>M.round(700+s.invest*450),ok:s=>s.grow<1,run:s=>{s.invest++;s.grow=M.min(1,s.grow+0.1);syncGrow(s)}},
  scout:{n:'Геологоразведка',d:'Открывает месторождения в 12 км от границ',cost:s=>M.round(600+G.dep.filter(d=>d.known).length*25),ok:s=>G.dep.some(d=>!d.known),run:s=>{if(s.isP)scout(s)}}};
function doAct(s,k){const a=ACT[k];const c=a.cost(s);if(!a.ok(s)||s.money<c)return false;if(s.money!==Infinity)s.money-=c;a.run(s);return true}
function scout(s){let n=0;for(const d of G.dep){if(d.known)continue;const c=d.c,i=c%N,j=(c/N)|0;let near=false;
    for(let b=-24;b<=24&&!near;b+=2)for(let a=-24;a<=24;a+=2){const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=N||jj>=N)continue;if(own[jj*N+ii]===s.id+1&&a*a+b*b<=576){near=true;break}}
    if(near){d.known=true;n++}}
  toast(n?`Геологи нашли <b>${n}</b> ${plural(n,'месторождение','месторождения','месторождений')}`:'Геологи ничего нового не нашли');if(n){mapMode='res';updModes()}}
const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c};

// ---------- bots
function botThink(s){const ai=cfg.rules.ai,R=()=>hsh(s.id*7919+(G.t|0),G.dec++);
  const greed={trader:0.5,militarist:1.2,cautious:0.4,adventurer:1}[s.trait]*(0.6+ai*0.4);
  if(s.boostT<=0&&s.money>ACT.boost.cost(s)*(2.6-greed)&&R()<[0.3,0.55,0.85][s.diff])doAct(s,'boost');
  else if(s.grow<1&&s.money>ACT.invest.cost(s)*(s.trait==='trader'?1.2:1.8)&&R()<0.6)doAct(s,'invest');
  if(cfg.rules.alliances&&R()<0.04*(1.5-ai*0.5)*(s.trait==='cautious'?1.8:1)){const others=G.states.filter(o=>o!==s&&o.cap&&!s.allies.includes(o.id));if(others.length){const o=others[(R()*others.length)|0];
      if(o.isP)offerAlly(s);else if(R()<0.5)ally(s,o)}}}
function ally(a,b){if(a.allies.includes(b.id))return;a.allies.push(b.id);b.allies.push(a.id);dirtyFog=true;toast(`<b>${esc(a.name)}</b> и <b>${esc(b.name)}</b> заключили альянс`,a.flag)}
function offerAlly(s){if(G.offers.includes(s.id))return;G.offers.push(s.id);
  toast(`<b>${esc(s.name)}</b> предлагает вам альянс`,s.flag,[['Принять',()=>{G.offers=G.offers.filter(i=>i!==s.id);ally(player(),s);updDip()}],['Отказать',()=>{G.offers=G.offers.filter(i=>i!==s.id)}]],20000)}
function askAlly(o){const ai=cfg.rules.ai;const p=player();const like=(o.trait==='cautious'?0.75:o.trait==='trader'?0.6:o.trait==='militarist'?0.25:0.45)*(1.3-ai*0.3)*(p.score>=o.score?1.15:0.85);
  if(hsh(o.id,G.t|0)<like){ally(p,o)}else toast(`<b>${esc(o.name)}</b> отклоняет союз`,o.flag);o.asked=G.t;updDip()}

// ---------- simulation tick (game seconds)
function sim(dt){G.t+=dt;
  for(const s of G.states){if(!s.cap)continue;s._acc=(s._acc||0)+rateOf(s)*dt;while(s._acc>=1){s._acc--;if(!expandOne(s)){s._acc=0;break}}}
  econ(dt);
  for(const s of G.states){if(s.isP||!s.cap)continue;s._dt=(s._dt||0)+dt;const iv=DIFF[s.diff].dec;if(s._dt>=iv){s._dt-=iv;botThink(s)}}
  G._popT=(G._popT||0)+dt;if(G._popT>2){G._popT=0;updPop()}
  for(const d of G.dep)if(!d.known&&own[d.c]===1)d.known=true;
  checkEnd();
  G._asT=(G._asT||0)+dt;if(G._asT>60){G._asT=0;save(true)}}
function checkEnd(){if(G.over||G.phase!=='play')return;const r=cfg.rules,lim=r.timeLimit*60;const rank=G.states.filter(s=>s.cap).slice().sort((a,b)=>b.score-a.score);
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
  borders=[];for(const s of G.states){if(!s.cells)continue;if(!s._dirty&&s._P){borders.push([s,s._P]);continue}s._dirty=false;const id=s.id+1,P=new Path2D(),b=s.bb,i0=M.max(0,b[0]-1),j0=M.max(0,b[1]-1),i1=M.min(N,b[2]+2),j1=M.min(N,b[3]+2);
    const at=(i,j)=>i>=0&&j>=0&&i<N&&j<N&&own[j*N+i]===id?1:0,V=(i,j)=>(at(i-1,j-1)+at(i,j-1)+at(i-1,j)+at(i,j))/4;
    const T=0.49,L=(a,b)=>(T-a)/(b-a);let sx=0,sy=0;
    for(let j=j0;j<j1;j++){let a=V(i0,j),e=V(i0,j+1);for(let i=i0;i<i1;i++){const b=V(i+1,j),c=V(i+1,j+1);if(own[j*N+i]===id){sx+=i;sy+=j}const m=(a>T?8:0)|(b>T?4:0)|(c>T?2:0)|(e>T?1:0);
      if(m!==0&&m!==15){const top=[i+L(a,b),j],rgt=[i+1,j+L(b,c)],bot=[i+L(e,c),j+1],lft=[i,j+L(a,e)];const seg=(p,q)=>{P.moveTo(p[0]*CSZ,p[1]*CSZ);P.lineTo(q[0]*CSZ,q[1]*CSZ)};
        switch(m){case 1:case 14:seg(lft,bot);break;case 2:case 13:seg(bot,rgt);break;case 3:case 12:seg(lft,rgt);break;case 4:case 11:seg(top,rgt);break;case 6:case 9:seg(top,bot);break;case 7:case 8:seg(lft,top);break;
          case 5:seg(lft,top);seg(bot,rgt);break;case 10:seg(top,rgt);seg(lft,bot);break}}a=b;e=c}}
    s.lx=(sx/s.cells+0.5)*CSZ;s.ly=(sy/s.cells+0.5)*CSZ;s._P=P;
    borders.push([s,P])}dirtyPol=false}
function rebuildFog(){const me=player();const ids=[me.id+1,...me.allies.map(i=>i+1)];vis.fill(0);const R=9,R2=R*R;
  for(let c=0;c<N*N;c++){const o=own[c];if(!o||!ids.includes(o))continue;vis[c]=1;const i=c%N,j=(c/N)|0;
    const edge=i===0||j===0||i===N-1||j===N-1||!ids.includes(own[c-1])||!ids.includes(own[c+1])||!ids.includes(own[c-N])||!ids.includes(own[c+N]);if(!edge)continue;
    for(let b=-R;b<=R;b++)for(let a=-R;a<=R;a++){if(a*a+b*b>R2)continue;const ii=i+a,jj=j+b;if(ii<0||jj<0||ii>=N||jj>=N)continue;vis[jj*N+ii]=1}}
  for(let c=0;c<N*N;c++)if(vis[c])expl[c]=1;
  if(!fogC){fogC=document.createElement('canvas');fogC.width=N;fogC.height=N}const x=fogC.getContext('2d'),im=x.createImageData(N,N),d=im.data;
  for(let c=0;c<N*N;c++){const k=c*4;d[k]=7;d[k+1]=12;d[k+2]=20;d[k+3]=vis[c]?0:expl[c]?120:226}x.putImageData(im,0,0);dirtyFog=false}
const fogOn=()=>cfg.rules.fog&&G.phase==='play';
const seenAt=(x,y)=>{if(!fogOn())return true;const c=cellOf(x,y);return c>=0&&expl[c]};
function drawOverlay(ctx,A){if(!G||(G.phase==='play'&&!own))return;const m=A.cam.m,VW=A.VW,VH=A.VH;const X0=A.sxw(0),Y0=A.syw(0),S=W.WORLD/m;
  if(G.phase==='play'){
    if(mapMode!=='off'){if(dirtyPol&&performance.now()-polT>500){polT=performance.now();rebuildPol()}
      if(polC){const fa=mapMode==='res'?0.18:M.min(0.42,0.1+0.32*smoothst(2,40,m));ctx.save();ctx.globalAlpha=fa;ctx.imageSmoothingEnabled=true;ctx.drawImage(polC,X0,Y0,S,S);ctx.restore()}
      if(borders){ctx.save();ctx.setTransform(A.DPR/m,0,0,A.DPR/m,A.DPR*(VW/2-A.cam.x/m),A.DPR*(VH/2-A.cam.y/m));ctx.lineCap='round';ctx.lineJoin='round';
        for(const [s,P] of borders){ctx.strokeStyle='rgba(6,10,16,0.55)';ctx.lineWidth=M.max(3.2,4.5)*m;ctx.stroke(P);ctx.strokeStyle=`rgb(${s.rgb.map(v=>M.min(255,v*1.15+20)|0).join(',')})`;ctx.lineWidth=2*m;ctx.stroke(P)}ctx.restore()}}
    if(fogOn()){if(dirtyFog&&performance.now()-fogT>500){fogT=performance.now();rebuildFog()}if(fogC){ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(fogC,X0,Y0,S,S);ctx.fillStyle='rgba(7,12,20,0.83)';ctx.beginPath();ctx.rect(-10,-10,VW+20,VH+20);ctx.rect(X0+0.5,Y0+0.5,S-1,S-1);ctx.fill('evenodd');ctx.restore()}}
    drawDeposits(ctx,A);drawCaps(ctx,A);if(mapMode!=='off')drawNames(ctx,A)}
  if(G.phase==='found')drawPlacement(ctx,A)}
function smoothst(a,b,x){let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t)}
function drawNames(ctx,A){const m=A.cam.m;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const [s] of borders||[]){if(!s.cells||!seenAt(s.lx,s.ly))continue;const sz=M.sqrt(s.cells)*CSZ*0.2/m;if(sz<11||sz>140)continue;const a=M.min(1,(sz-11)/8)*M.min(1,(140-sz)/40)*0.9;
    const X=A.sxw(s.lx);let Y=A.syw(s.ly);if(s.cap&&M.abs(A.sxw(s.cap.x)-X)<sz*4&&M.abs(A.syw(s.cap.y)-Y)<sz*1.4+14)Y=A.syw(s.cap.y)+sz*1.1+16;const t=s.name.toUpperCase();ctx.font=`700 ${sz|0}px system-ui,Segoe UI,sans-serif`;const sp=sz*0.18;let w=0;const ws=[];for(const ch of t){const cw=ctx.measureText(ch).width;ws.push(cw);w+=cw+sp}w-=sp;
    ctx.globalAlpha=a;ctx.lineJoin='round';ctx.lineWidth=M.max(2,sz*0.12);ctx.strokeStyle='rgba(6,10,16,0.6)';ctx.fillStyle=`rgba(${s.rgb.map(v=>M.min(255,v*0.5+128)|0).join(',')},1)`;
    let x=X-w/2;for(let i=0;i<t.length;i++){ctx.strokeText(t[i],x+ws[i]/2,Y);ctx.fillText(t[i],x+ws[i]/2,Y);x+=ws[i]+sp}}ctx.globalAlpha=1}
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
function drawDeposits(ctx,A){const m=A.cam.m;if(mapMode==='off'||(mapMode==='pol'&&m>40))return;const z=mapMode==='res'?1:smoothst(40,18,m);if(z<=0.02)return;ctx.globalAlpha=z;
  for(const d of G.dep){if(!d.known)continue;const X=A.sxw(d.x),Y=A.syw(d.y);if(X<-20||Y<-20||X>A.VW+20||Y>A.VH+20)continue;
    const sz=mapMode==='res'?24:20;const ic=oreIcon(d.k);ctx.globalAlpha=z*(d.amt<=0?0.35:1);ctx.drawImage(ic,X-sz/2,Y-sz/2,sz,sz);
    if(d.max!==Infinity&&mapMode==='res'){ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(X-10,Y+sz/2+1,20,3);ctx.fillStyle=ORES[d.k].c;ctx.fillRect(X-10,Y+sz/2+1,20*d.amt/d.max,3)}
    const o=own[d.c];if(o&&mapMode==='res'){ctx.fillStyle=G.states[o-1].color;ctx.beginPath();ctx.arc(X+sz/2-3,Y-sz/2+3,3.5,0,7);ctx.fill()}}ctx.globalAlpha=1}
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
function setSpeed(v){G.speed=v;for(const b of $('gspeed').children)b.classList.toggle('on',+b.dataset.s===v);if(api)api.setTodRate(v*4/60)}
function gameClock(){const mins=8*60+G.t*4;const d=M.floor(mins/1440)+1,h=M.floor(mins/60)%24,mm=M.floor(mins)%60;return `День ${d} · ${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`}
function updHUD(){const p=player();$('rmoney-v').textContent=fmtK(p.money);const inc=$('rinc-v');inc.textContent=(creative()?'∞':'+'+fmtK(p.income))+'/с';inc.className=p.income>0?'pos':'';
  $('rland-v').textContent=fmt(p.cells*0.262);$('rpop-v').textContent=fmtK(p.pop);$('rore-v').textContent=p.ores;$('rscore-v').textContent=fmt(p.score);
  const r=cfg.rules;$('rgoal-v').textContent=r.victory==='points'?'/ '+fmt(r.target):'';$('gclock').textContent=gameClock();
  const lim=r.timeLimit*60;$('glimit').textContent=lim>0?'осталось '+fmtT(M.max(0,lim-G.t)):'без лимита';updPanel()}
const fmtT=s=>{s=M.round(s);const h=M.floor(s/3600),m=M.floor(s/60)%60,ss=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(ss).padStart(2,'0')};
let panelSig='';
function updPanel(){const el=$('gpanel');const p=player();
  if(G.phase==='found'){const sig='found'+placing;if(sig===panelSig)return;panelSig=sig;
    el.innerHTML=`<div class="gp-h">Первый шаг</div><button class="act${placing?' armed':''}" id="a-found"><span class="ic ic-capital"></span><span><b>Основать столицу</b><small>${placing?'Кликните по карте, где стоять столице':'Выберите место на карте'}</small></span>${placing?'<span class="btn ax" id="a-found-x">✕</span>':''}</button>
      <p class="note">Хорошее место: равнина у реки или моря, подальше от края мира. Боты выберут свои столицы одновременно с вами.</p>`;
    $('a-found').onclick=e=>{if(e.target.id==='a-found-x'){setPlacing(false);return}setPlacing(!placing)};return}
  // the play panel is built once and then only updated in place (buttons must not be re-created under the cursor)
  if(panelSig!=='play'){panelSig='play';const r=cfg.rules;
    let h=`<div class="gp-h">${esc(p.gov)} ${esc(p.name)}</div>`+['Столица','Застройка','Территория','Население','Доход'].map((n,i)=>`<div class="stat"><span>${n}</span><b data-v="${i}"></b></div>`).join('')+`<div class="gp-h" style="margin-top:12px">Действия</div>`;
    for(const k of ['boost','invest','scout'])h+=`<button class="act" data-a="${k}"><span class="ic ic-${k}"></span><span><b>${ACT[k].n}</b><small></small></span><span class="cost"></span>${k==='scout'?'':'<span class="bar"><i></i></span>'}</button>`;
    h+=`<button class="btn sm" id="a-home" style="width:100%;margin-top:4px">Перейти к столице</button><div class="gp-h" style="margin-top:12px">Цель</div><p class="note" style="margin-top:0">${r.victory==='points'?'Первым набрать '+fmt(r.target)+' очков':r.victory==='time'?'Набрать больше всех очков к концу лимита':'Захват всех столиц — с появлением армии (следующие этапы). Пока побеждает лидер по очкам к концу лимита'}${r.timeLimit?'. Лимит — '+r.timeLimit+' мин':''}</p>`;
    el.innerHTML=h;for(const b of el.querySelectorAll('[data-a]'))b.onclick=()=>{if(doAct(player(),b.dataset.a)){updHUD();if(b.dataset.a==='boost')hint(4)}};
    $('a-home').onclick=()=>{const q=player();api.flyTo(q.cap.x,q.cap.y,3)}}
  const v=[esc(p.capital),M.round(p.grow*100)+' %',fmt(p.cells*0.262)+' км²',fmtK(p.pop),(creative()?'∞':'+'+fmtK(p.income))+' /с'];
  for(const e of el.querySelectorAll('[data-v]'))e.textContent=v[+e.dataset.v];
  for(const b of el.querySelectorAll('[data-a]')){const k=b.dataset.a,a=ACT[k],c=a.cost(p),ok=a.ok(p)&&p.money>=c;b.disabled=!ok;b.querySelector('.cost').textContent=fmt(c);
    b.querySelector('small').textContent=k==='boost'&&p.boostT>0?'Действует ещё '+M.ceil(p.boostT)+' с':a.ok(p)?a.d:k==='invest'?'Столица застроена полностью':'Всё разведано';
    const bar=b.querySelector('.bar i');if(bar)bar.style.width=(k==='boost'?p.boostT/45*100:p.grow*100)+'%'}}
function setPlacing(v){placing=v;document.body.classList.toggle('placing',v);panelSig='';updPanel();if(v)hint(1);closeConfirm()}
function closeConfirm(){$('confirm').classList.remove('show');pend=null}
function openConfirm(x,y,sx,sy){pend={x,y};const c=$('confirm');$('cft').textContent='Основать столицу здесь?';
  const e=W.landE(x,y,0);let near=null,nd=1e18;for(const k of W.cities){const d=M.hypot(k.x-x,k.y-y);if(d<nd){nd=d;near=k}}
  $('cfs').innerHTML=`Высота ${M.round(e*2600)} м${near?` · рядом ${esc(near.name)} (${(nd/1000).toFixed(1).replace('.',',')} км)`:''}<br>Город вырастет здесь сам, к соседям проложат магистрали`;
  c.style.left=M.min(innerWidth-130,M.max(130,sx))+'px';c.style.top=M.max(150,sy)+'px';c.classList.add('show')}
function toast(html,fl,btns,ms){const t=document.createElement('div');t.className='toast';if(fl)t.appendChild(flagCanvas(fl,30,20));const b=document.createElement('div');b.innerHTML=html;t.appendChild(b);
  if(btns){const r=document.createElement('div');r.className='tb';for(const [n,f] of btns){const q=document.createElement('button');q.className='btn sm';q.textContent=n;q.onclick=()=>{f();kill()};r.appendChild(q)}b.appendChild(r)}
  const box=$('toasts');box.prepend(t);while(box.children.length>5)box.lastChild.remove();const kill=()=>{t.classList.add('out');setTimeout(()=>t.remove(),400)};setTimeout(kill,ms||6500)}
// hints: the step-by-step guide (more steps in the tutorial)
const HINTS=[
  ['Выберите место для <b>столицы</b>: нажмите «Основать столицу» слева или просто кликните по карте','found'],
  ['Кликните по карте там, где будет столица. Красный круг — место не подходит. <b>Esc</b> или ✕ — отмена','found'],
  ['Столица основана! Город строится сам, территория растёт. Колесо мыши — приблизить, перетаскивание — двигать карту','play'],
  ['Слева — ваши действия: <b>Ускорить расширение</b> захватит больше земли, пока соседи не заняли её','play'],
  ['Отлично! Месторождения внутри границ дают доход. <b>Геологоразведка</b> найдёт новые. Вкладка «Ресурсы» справа внизу покажет их','play'],
  ['<b>Дипломатия</b> вверху справа: союзники делятся обзором. <b>Пробел</b> — пауза, <b>1–3</b> — скорость, <b>Esc</b> — меню и сохранение','play']];
function hint(i){if(hintsOff&&!tutorial)return;if(i<hintStep&&i!==0)return;hintStep=i;const h=HINTS[i];if(!h)return hideHint();$('hintn').textContent=i+1;$('hintt').innerHTML=h[0];$('hint').classList.add('show')}
function hideHint(){$('hint').classList.remove('show')}
function updDip(){const b=$('dipb');if(!$('dip').classList.contains('show')||!G)return;const p=player();let h='';
  for(const s of G.states){if(!s.cap)continue;const ally=p.allies.includes(s.id);const canAsk=!s.isP&&cfg.rules.alliances&&!ally;
    h+=`<div class="dst"><span class="fl" data-st="${s.id}"></span><div><b>${esc(s.name)}${s.isP?' (вы)':''}</b><small>${esc(s.gov)} · столица ${esc(s.capital)}${s.isP?'':' · '+TRAITS[s.trait]+' · '+DIFF[s.diff].n.toLowerCase()}</small><small>${fmt(s.score)} очков · ${fmt(s.cells*0.262)} км² · ${fmtK(s.pop)} чел.</small></div>`+
      (s.isP?'<span></span>':`<span class="rel${ally?' ally':''}">${ally?'Союзник':'Мир'}</span>`)+
      `<div class="acts">${canAsk?`<button class="btn sm" data-ally="${s.id}" ${s.asked&&G.t-s.asked<60?'disabled':''}>Предложить альянс</button>`:''}<button class="btn sm" data-go="${s.id}">Показать</button></div></div>`}
  if(!cfg.rules.alliances)h+='<p class="note">Альянсы отключены в правилах этой игры.</p>';
  if(h===b._h)return;b._h=h;b.innerHTML=h;for(const e of b.querySelectorAll('.fl'))e.replaceWith(flagCanvas(G.states[+e.dataset.st].flag,38,25));
  for(const e of b.querySelectorAll('[data-ally]'))e.onclick=()=>askAlly(G.states[+e.dataset.ally]);
  for(const e of b.querySelectorAll('[data-go]'))e.onclick=()=>{const s=G.states[+e.dataset.go];api.flyTo(s.cap.x,s.cap.y,6)}}
function updModes(){for(const b of $('mapmodes').children)b.classList.toggle('on',b.dataset.m===mapMode)}

// ---------- engine hooks
const hooks={
  frame(dt){if(!G||G.over&&G.speed===0){return}const sp=G.phase==='play'&&own&&api&&api.ready?G.speed:0;if(sp>0){simAcc+=dt*sp;while(simAcc>0.1){sim(0.1);simAcc-=0.1}}
    G._hud=(G._hud||0)+dt;if(G._hud>0.25){G._hud=0;updHUD();updDip()}},
  draw:(ctx,A)=>drawOverlay(ctx,A),
  seen:(x,y)=>!G||!own||seenAt(x,y),
  mini:(mx,s)=>drawMini(mx,s),
  click(x,y,sx,sy){if(!G)return false;if(G.phase==='found'){const bad=validSite(x,y);if(bad){toast(bad);if(!placing)setPlacing(true);return true}if(!placing){setPlacing(true)}openConfirm(x,y,sx,sy);return true}
    if(fogOn()&&!seenAt(x,y)){return true}return false},
  key(e){if(!G||document.body.classList.contains('m-settings'))return !!G;if(e.code==='Escape'){if($('confirm').classList.contains('show')){closeConfirm();return true}if(placing){setPlacing(false);return true}if($('dip').classList.contains('show')){$('dip').classList.remove('show');return true}ui.pause(true);return true}
    if(G.phase!=='play')return false;if(e.code==='Space'){setSpeed(G.speed?0:(G._lastSp||1));if(G.speed)G._lastSp=G.speed;e.preventDefault();return true}
    const k={Digit1:1,Digit2:2,Digit3:4,Digit0:0}[e.code];if(k!==undefined){setSpeed(k);return true}return false},
  inspect(c){const k=cellOf(c.x,c.y);const o=k>=0&&own?own[k]:0;if(!o)return G&&G.phase==='play'?'<tr><td>Государство</td><td>ничейная земля</td></tr>':'';const s=G.states[o-1];
    return `<tr><td>Государство</td><td><span class="own"><i class="chip" style="background:${s.color}"></i>${esc(s.name)}${c.cap!==undefined?' · столица':''}</span></td></tr>`}};

// ---------- boot / phases
function boot(caps,onReady,stage){if(api){api.destroy();api=null}
  const vo=ui.viewOpts();api=startWorld({seed:cfg.seed,opt:mapOpt(caps),mode:'game',tod:cfg.rules.dayNight?9.5:12.5,dayNight:cfg.rules.dayNight,view:vo,hooks,onReady:A=>{onReady&&onReady(A)}});
  W=api.W;api.setTodRate(G.speed*4/60);if(!cfg.rules.dayNight)api.setTodRate(0);document.getElementById('fps').classList.toggle('hid',!vo.fps)}
function initState(c,save){cfg=c;tutorial=!!c.tutorial;hintsOff=!ui.settings().hints;placing=false;pend=null;mapMode='pol';hintStep=0;simAcc=0;polC=null;fogC=null;borders=null;panelSig='';
  G={t:0,speed:1,phase:'found',states:[],dep:[],offers:[],over:false,dec:0};
  G.states.push(mkState(0,Object.assign({},c.country,{money:c.rules.money,diff:1,trait:'random'}),true));
  botList().forEach((b,i)=>G.states.push(mkState(i+1,b,false)));
  const p=player();$('hname').textContent=p.name;$('hgov').textContent=p.gov+' · столица '+p.capital;flagCanvas(p.flag,42,28,$('hflag'));setSpeed(1);updModes();
  $('over').classList.remove('show');$('dip').classList.remove('show');$('toasts').innerHTML='';}
function newGame(c){initState(c);ui.loading('Генерация мира…','Сид '+c.seed);setTimeout(()=>{boot(null,()=>{ui.loaded();analyse();G.dep=genDeposits();hint(0);updHUD()});document.body.className='m-game';updHUD()},60)}
// founding: bots pick their sites, the world is rebuilt with the capitals, territory starts growing
function found(x,y){closeConfirm();setPlacing(false);const picks=chooseCaps(x,y);const p=player();p.cap={x,y};for(const [b,s] of picks)b.cap={x:s.x,y:s.y};
  G.phase='play';ui.loading('Основание государств…',G.states.filter(s=>s.cap).map(s=>esc(s.name)).join(' · '));
  setTimeout(()=>{const caps=G.states.filter(s=>s.cap).map(s=>({x:s.cap.x,y:s.cap.y,st:s.id,name:s.capital,fl:s.flag}));cfg.caps=caps;const keep=G.dep;
    boot(caps,()=>{ui.loaded();api.flyTo(x,y,3.2,4.5)},1);
    for(const s of G.states){const c=W.cities.find(q=>q.cap===s.id);s.cityId=c?c.id:-1;s.growQ=-1;syncGrow(s)}
    G.dep=keep;initTerritory();updPop();rebuildFog();
    for(const s of G.states.slice(1))if(s.cap)toast(`<b>${esc(s.name)}</b> основала столицу <b>${esc(s.capital)}</b>`,s.flag);
    toast(`Вы основали столицу <b>${esc(p.capital)}</b>. ${esc(p.gov)} ${esc(p.name)} начинает свою историю`,p.flag,null,9000);
    hint(2);setTimeout(()=>{if(hintStep===2)hint(3)},14000);setTimeout(()=>{if(hintStep>=3&&hintStep<5)hint(5)},48000);save(true)},60)}
function snapshot(){return {cfg,meta:{date:Date.now(),name:player().name,flag:player().flag,t:G.t,phase:G.phase,day:gameClock(),score:player().score,map:cfg.map.type},
  g:{t:G.t,phase:G.phase,over:G.over,states:G.states.map(s=>({money:s.money===Infinity?'inf':s.money,earned:s.earned,cap:s.cap,grow:s.grow,boostT:s.boostT,invest:s.invest,allies:s.allies,trait:s.trait})),
    dep:G.dep.map(d=>[d.k,M.round(d.x),M.round(d.y),d.amt===Infinity?-1:M.round(d.amt),d.max===Infinity?-1:M.round(d.max),d.known?1:0]),own:own?rle(own):null,expl:expl?rle(expl):null,cam:api?[api.cam.x,api.cam.y,api.cam.m]:null}}}
function save(auto){if(!G||!cfg||cfg.tutorial&&auto)return false;const ok=Saves.put(cfg.slot||1,snapshot());if(!auto)toast(ok?`Сохранено в ячейку ${cfg.slot||1}`:'Не удалось сохранить: нет места в хранилище браузера');return ok}
function load(sv){const c=sv.cfg;initState(c);const g=sv.g;G.t=g.t;G.phase=g.phase;G.over=g.over;
  g.states.forEach((q,i)=>{const s=G.states[i];if(!s)return;s.money=q.money==='inf'?Infinity:q.money;s.earned=q.earned;s.cap=q.cap;s.grow=q.grow;s.boostT=q.boostT;s.invest=q.invest;s.allies=q.allies||[];s.trait=q.trait||s.trait});
  ui.loading('Загрузка сохранения…',esc(sv.meta.name)+' · '+sv.meta.day);
  setTimeout(()=>{const caps=G.phase==='play'?c.caps:null;boot(caps,()=>{ui.loaded();if(g.cam){api.cam.x=g.cam[0];api.cam.y=g.cam[1];api.cam.m=g.cam[2]}});document.body.className='m-game';
    analyse();G.dep=g.dep.map(a=>({k:a[0],x:a[1],y:a[2],c:cellOf(a[1],a[2]),amt:a[3]<0?Infinity:a[3],max:a[4]<0?Infinity:a[4],known:!!a[5]}));
    if(G.phase==='play'){own=unrle(g.own,new Uint8Array(N*N));vis=new Uint8Array(N*N);expl=g.expl?unrle(g.expl,new Uint8Array(N*N)):new Uint8Array(N*N);
      for(const s of G.states){s.cells=0;s.bb=null;s._P=null;s._dirty=true;const ct=W.cities.find(q=>q.cap===s.id);s.cityId=ct?ct.id:-1;s.growQ=-1;syncGrow(s)}
      for(let k=0;k<N*N;k++)if(own[k]){const s=G.states[own[k]-1],i=k%N,j=(k/N)|0;s.cells++;const b=s.bb||(s.bb=[i,j,i,j]);if(i<b[0])b[0]=i;if(j<b[1])b[1]=j;if(i>b[2])b[2]=i;if(j>b[3])b[3]=j}
      rebuildFrontier();updPop();econ(0);dirtyPol=true;dirtyFog=true;hint(5)}else hint(0);
    if(G.over)setSpeed(0);updHUD()},60)}
function exit(){if(G&&!G.over)save(true);if(api){api.destroy();api=null}G=null;W=null;own=null;placing=false;document.body.classList.remove('placing');closeConfirm();hideHint()}

// ---------- DOM wiring (once)
function wire(u){ui=u;
  for(const b of $('gspeed').children)b.onclick=()=>{if(G&&G.phase==='play')setSpeed(+b.dataset.s)};
  $('cfy').onclick=()=>{if(pend)found(pend.x,pend.y)};$('cfn').onclick=()=>closeConfirm();
  $('hintx').onclick=()=>hideHint();
  $('bdip').onclick=()=>{if(!G||G.phase!=='play')return toast('Дипломатия станет доступна после основания столицы');$('dip').classList.toggle('show');updDip()};$('dipx').onclick=()=>$('dip').classList.remove('show');
  $('bmenu').onclick=()=>ui.pause(true);
  for(const b of $('mapmodes').children)b.onclick=()=>{mapMode=b.dataset.m;updModes()};
  $('overm').onclick=()=>{$('over').classList.remove('show');ui.toMenu()};$('overk').onclick=()=>$('over').classList.remove('show')}
return {wire,newGame,load,save,exit,setSpeed:v=>G&&setSpeed(v),get G(){return G},get api(){return api},paused:()=>G?G.speed===0:true,
  pauseInfo:()=>G?`${esc(player().name)} · ${gameClock()} · ${fmt(player().score)} очков · ячейка ${cfg.slot||1}`:'',
  _test:{validSite:(x,y)=>validSite(x,y),found,get own(){return own},chooseCaps}};
})();

// Menus and screens (stage 5): main menu, new game setup, settings, pause, loading; app bootstrap.
(function(){
'use strict';
const $=id=>document.getElementById(id);
const VERSION='5.1';
let bg=null,C=null,prevWorker=null,prevId=0,prevT=0,setFrom=null,paused=null;

// ---------------------------------------------------------------- settings
const SDEF={clouds:true,traffic:true,labels:true,fps:false,ui:1,menuBg:true,hints:true};
let S=Object.assign({},SDEF);try{Object.assign(S,JSON.parse(localStorage.getItem('ws.settings')||'{}'))}catch(e){}
function saveS(){try{localStorage.setItem('ws.settings',JSON.stringify(S))}catch(e){}applyS()}
function applyS(){document.documentElement.style.setProperty('--ui',S.ui);const a=Game.api;if(a){a.opt.clouds=S.clouds;a.opt.traffic=S.traffic;a.opt.labels=S.labels}$('fps').classList.toggle('hid',!S.fps)}

// ---------------------------------------------------------------- procedural icons (Canvas 2D → CSS)
function icon(name,draw){const N=64,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.lineCap='round';x.lineJoin='round';
  const g=x.createLinearGradient(0,6,0,58);g.addColorStop(0,'#ffe7a0');g.addColorStop(0.55,'#ffcf55');g.addColorStop(1,'#d98f2a');x.strokeStyle=g;x.fillStyle=g;x.lineWidth=4.2;
  x.shadowColor='rgba(0,0,0,0.45)';x.shadowBlur=4;x.shadowOffsetY=1.5;draw(x,g);return `.ic-${name},.ri-${name}{background-image:url(${c.toDataURL()})}`}
const P2=Math.PI*2;
function paintIcons(){const css=[];
  css.push(icon('new',x=>{x.beginPath();x.arc(30,32,19,0,P2);x.stroke();x.lineWidth=2.6;x.beginPath();x.ellipse(30,32,8,19,0,0,P2);x.moveTo(11,32);x.lineTo(49,32);x.moveTo(14,22);x.lineTo(46,22);x.moveTo(14,42);x.lineTo(46,42);x.stroke();
    x.fillStyle='#1b1406';x.beginPath();x.arc(48,46,10,0,P2);x.fill();x.lineWidth=3.6;x.beginPath();x.moveTo(42,46);x.lineTo(54,46);x.moveTo(48,40);x.lineTo(48,52);x.stroke()}));
  css.push(icon('cont',x=>{x.beginPath();x.arc(32,32,20,0,P2);x.stroke();x.beginPath();x.moveTo(27,22);x.lineTo(42,32);x.lineTo(27,42);x.closePath();x.fill()}));
  css.push(icon('tut',x=>{x.beginPath();x.moveTo(8,24);x.lineTo(32,13);x.lineTo(56,24);x.lineTo(32,35);x.closePath();x.fill();x.beginPath();x.moveTo(18,30);x.lineTo(18,42);x.quadraticCurveTo(32,52,46,42);x.lineTo(46,30);x.stroke();x.beginPath();x.moveTo(54,25);x.lineTo(54,40);x.stroke()}));
  css.push(icon('set',x=>{x.beginPath();for(let i=0;i<16;i++){const a=i*P2/16,r=i%2?16:22;x.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}x.closePath();x.fill();x.globalCompositeOperation='destination-out';x.beginPath();x.arc(32,32,7,0,P2);x.fill()}));
  css.push(icon('capital',x=>{x.beginPath();x.arc(32,26,10,Math.PI,0);x.fill();x.fillRect(31,10,2,7);x.fillRect(14,28,36,4);for(let i=0;i<5;i++)x.fillRect(16+i*7.5,34,3.5,14);x.fillRect(10,48,44,5);x.beginPath();x.moveTo(33,10);x.lineTo(42,12);x.lineTo(33,14);x.fill()}));
  css.push(icon('boost',x=>{x.strokeRect(22,22,20,20);for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){x.beginPath();x.moveTo(32+dx*14,32+dy*14);x.lineTo(32+dx*26,32+dy*26);x.stroke();x.beginPath();x.moveTo(32+dx*28-dy*6,32+dy*28+dx*6);x.lineTo(32+dx*28+dy*6,32+dy*28-dx*6);x.lineTo(32+dx*34,32+dy*34);x.closePath();x.fill()}}));
  css.push(icon('invest',x=>{x.fillRect(10,40,10,14);x.fillRect(24,30,10,24);x.fillRect(38,20,10,34);x.lineWidth=3.4;x.beginPath();x.moveTo(10,30);x.lineTo(24,20);x.lineTo(34,24);x.lineTo(50,9);x.stroke();x.beginPath();x.moveTo(52,7);x.lineTo(43,8);x.lineTo(51,16);x.closePath();x.fill()}));
  css.push(icon('scout',x=>{x.beginPath();x.arc(27,27,14,0,P2);x.stroke();x.lineWidth=6;x.beginPath();x.moveTo(38,38);x.lineTo(52,52);x.stroke();x.lineWidth=2.4;x.beginPath();x.moveTo(19,32);x.lineTo(24,24);x.lineTo(29,29);x.lineTo(35,21);x.stroke()}));
  css.push(icon('money',x=>{for(let i=0;i<4;i++){x.beginPath();x.ellipse(32,46-i*8,17,6,0,0,P2);x.fill();x.strokeStyle='rgba(60,40,0,0.5)';x.lineWidth=1.5;x.stroke()}}));
  css.push(icon('land',x=>{x.beginPath();x.moveTo(8,16);x.lineTo(24,10);x.lineTo(40,16);x.lineTo(56,10);x.lineTo(56,48);x.lineTo(40,54);x.lineTo(24,48);x.lineTo(8,54);x.closePath();x.stroke();x.lineWidth=2.6;x.beginPath();x.moveTo(24,10);x.lineTo(24,48);x.moveTo(40,16);x.lineTo(40,54);x.stroke()}));
  css.push(icon('pop',x=>{x.beginPath();x.arc(24,22,8,0,P2);x.fill();x.beginPath();x.arc(24,52,15,Math.PI,0);x.fill();x.globalAlpha=0.75;x.beginPath();x.arc(42,20,7,0,P2);x.fill();x.beginPath();x.arc(43,48,13,Math.PI,0);x.fill()}));
  css.push(icon('ore',x=>{x.beginPath();x.moveTo(32,8);x.lineTo(50,24);x.lineTo(42,54);x.lineTo(22,54);x.lineTo(14,24);x.closePath();x.fill();x.strokeStyle='rgba(60,40,0,0.55)';x.lineWidth=2;x.beginPath();x.moveTo(14,24);x.lineTo(32,30);x.lineTo(50,24);x.moveTo(32,30);x.lineTo(32,54);x.moveTo(32,8);x.lineTo(32,30);x.stroke()}));
  css.push(icon('star',x=>{x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?10:24;x.lineTo(32+Math.cos(a)*r,33+Math.sin(a)*r)}x.closePath();x.fill()}));
  css.push(icon('dip',x=>{x.beginPath();x.arc(24,32,13,0,P2);x.stroke();x.beginPath();x.arc(40,32,13,0,P2);x.stroke()}));
  // logo: globe in a sight, with a wheat ear — «World Starvation»
  {const N=136,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.translate(N/2,N/2);
    const g=x.createRadialGradient(-12,-14,6,0,0,54);g.addColorStop(0,'#3a7ab8');g.addColorStop(1,'#0c2440');x.fillStyle=g;x.beginPath();x.arc(0,0,46,0,P2);x.fill();
    x.fillStyle='#4f8a46';x.beginPath();x.moveTo(-30,-18);x.bezierCurveTo(-10,-34,14,-20,8,-6);x.bezierCurveTo(2,6,-20,2,-26,14);x.bezierCurveTo(-36,6,-38,-8,-30,-18);x.fill();
    x.beginPath();x.moveTo(14,6);x.bezierCurveTo(30,0,38,14,28,28);x.bezierCurveTo(18,36,8,26,14,6);x.fill();
    x.strokeStyle='rgba(255,255,255,0.22)';x.lineWidth=1.4;x.beginPath();x.ellipse(0,0,18,46,0,0,P2);x.moveTo(-46,0);x.lineTo(46,0);x.stroke();
    const gg=x.createLinearGradient(0,-60,0,60);gg.addColorStop(0,'#ffe7a0');gg.addColorStop(1,'#d98f2a');x.strokeStyle=gg;x.lineWidth=4;x.beginPath();x.arc(0,0,56,0,P2);x.stroke();
    x.lineWidth=3;for(let i=0;i<4;i++){const a=i*Math.PI/2;x.beginPath();x.moveTo(Math.cos(a)*50,Math.sin(a)*50);x.lineTo(Math.cos(a)*66,Math.sin(a)*66);x.stroke()}
    css.push(`.logo-mark{background-image:url(${c.toDataURL()})}`)}
  const st=document.createElement('style');st.textContent=css.join('\n');document.head.appendChild(st)}

// ---------------------------------------------------------------- small widgets
function seg(el,items,val,on){el.innerHTML='';for(const [v,t,tip] of items){const b=document.createElement('button');b.textContent=t;if(tip)b.title=tip;b.classList.toggle('on',v===val);b.onclick=()=>{for(const q of el.children)q.classList.remove('on');b.classList.add('on');on(v)};el.appendChild(b)}}
function tog(el,val,on){el.classList.toggle('on',!!val);el.onclick=()=>{const v=!el.classList.contains('on');el.classList.toggle('on',v);on(v)}}
function cards(el,items,val,on){el.innerHTML='';for(const [v,t,d] of items){const b=document.createElement('button');b.className='card';b.innerHTML=`<b>${t}</b><small>${d}</small>`;b.classList.toggle('on',v===val);b.onclick=()=>{for(const q of el.children)q.classList.remove('on');b.classList.add('on');on(v)};el.appendChild(b)}}
function swatches(el,list,val,on,custom){el.innerHTML='';for(const c of list){const b=document.createElement('button');b.className='sw';b.style.background=c;b.classList.toggle('on',c===val);b.title=c;b.onclick=()=>{set(c);on(c)};el.appendChild(b)}
  if(custom!==false){const b=document.createElement('label');b.className='sw cust';b.title='Свой цвет';const i=document.createElement('input');i.type='color';i.value=/^#[0-9a-f]{6}$/i.test(val)?val:'#888888';i.oninput=()=>{set(i.value);on(i.value)};b.appendChild(i);el.appendChild(b);if(!list.includes(val))b.classList.add('on')}
  function set(c){for(const q of el.children)q.classList.toggle('on',q.title===c||(q.classList.contains('cust')&&!list.includes(c)))}}
function rnd(){return Math.random()}

// ---------------------------------------------------------------- main menu
function showMenu(){document.body.className='m-menu';
  const L=Saves.latest(),cb=$('mm-cont');cb.disabled=!L;cb.style.display=L?'':'none';$('mm-cont-s').textContent=L?`${L.s.meta.name} · ${L.s.meta.day} · ячейка ${L.i}`:'Сохранений пока нет';
  $('mm-ver').textContent='v'+VERSION;
  if(!S.menuBg||bg){loaded();return}
  // the living background of the menu: the loading screen stays until its first tiles are drawn
  loading('Загрузка мира','Рельеф, города, дороги, заводы и порты');setTimeout(()=>{if(bg||!/m-(menu|setup|settings)/.test(document.body.className)){loaded();return}
    bg=startWorld({mode:'bg',seed:20261107,tod:17.4,view:{labels:false,traffic:true,clouds:true},onReady:()=>loaded()});$('ldt').textContent='Отрисовка карты'},80)}
function stopBg(){if(bg){bg.destroy();bg=null}}
function toMenu(){Game.exit();$('pause').classList.remove('show');$('over').classList.remove('show');showMenu()}
function menuGo(k){
  if(k==='new'){openSetup();return}
  if(k==='continue'){const L=Saves.latest();if(L){stopBg();C=L.s.cfg;C.slot=L.i;Game.load(L.s)}return}
  if(k==='tutorial'){stopBg();const c=defaultConfig();c.seed=777;c.tutorial=true;c.country.name='Учебная Республика';c.country.gov='Республика';c.map={type:'normal',size:0,rivers:2,lakes:1};
    Object.assign(c.rules,{botCount:2,diff:0,ai:0,victory:'points',target:5000,timeLimit:0,botGrowth:0});c.slot=5;Game.newGame(c);return}
  if(k==='settings'){openSettings('menu')}}

// ---------------------------------------------------------------- new game setup
const TABS=[];
function openSetup(){document.body.className='m-setup';try{C=JSON.parse(localStorage.getItem('ws.lastcfg'))}catch(e){C=null}
  const d=defaultConfig();if(!C||C.v!==1)C=d;else{C.rules=Object.assign(d.rules,C.rules);C.map=Object.assign(d.map,C.map);C.country=Object.assign(d.country,C.country)}delete C.caps;delete C.tutorial;
  buildTabs();buildCountry();buildMap();buildRules();buildMore();buildSlots();summary();showTab(TABS[0])}
function buildTabs(){const t=$('stabs');t.innerHTML='';TABS.length=0;for(const s of document.querySelectorAll('#spages section')){TABS.push(s.dataset.tab);const b=document.createElement('button');b.textContent=s.dataset.name;b.dataset.t=s.dataset.tab;b.onclick=()=>showTab(s.dataset.tab);t.appendChild(b)}}
function showTab(k){for(const b of $('stabs').children)b.classList.toggle('on',b.dataset.t===k);for(const s of document.querySelectorAll('#spages section'))s.classList.toggle('on',s.dataset.tab===k);if(k==='map')preview()}
// country
function drawFlagBig(){const c=$('cflag'),x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);FL.draw(x,C.country.flag,0,0,c.width,c.height);tilesFlag();summary()}
function tilesFlag(){const f=C.country.flag;
  const mk=(el,n,cur,mod,label)=>{el.innerHTML='';for(let i=0;i<n;i++){const b=document.createElement('button');b.className='tile';b.classList.toggle('on',i===cur);const cv=document.createElement('canvas');cv.width=96;cv.height=64;FL.draw(cv.getContext('2d'),mod(i),0,0,96,64);b.appendChild(cv);const s=document.createElement('span');s.textContent=label[i];b.appendChild(s);b.onclick=()=>{mod(i,true);drawFlagBig()};el.appendChild(b)}};
  mk($('fpat'),FL.PAT.length,f.p|0,(i,set)=>{if(set){f.p=i;return}return Object.assign({},f,{p:i,e:0})},FL.PAT);
  mk($('femb'),FL.EMB.length,f.e|0,(i,set)=>{if(set){f.e=i;return}return Object.assign({},f,{e:i})},FL.EMB)}
function buildCountry(){const c=C.country;
  $('cname').value=c.name;$('cname').oninput=e=>{c.name=e.target.value.trim()||'Безымянная страна';summary()};$('cname-rnd').onclick=()=>{c.name=NAMES.country();$('cname').value=c.name;summary()};
  $('ccap').value=c.capital;$('ccap').oninput=e=>{c.capital=e.target.value.trim()||'Столица'};$('ccap-rnd').onclick=()=>{c.capital=NAMES.capital();$('ccap').value=c.capital};
  const g=$('cgov');g.innerHTML=NAMES.GOV.map(v=>`<option${v===c.gov?' selected':''}>${v}</option>`).join('');g.onchange=()=>{c.gov=g.value};
  swatches($('cland'),LANDC,c.color,v=>{c.color=v});
  const fc=$('fcols');fc.innerHTML='';['Основной','Второй','Третий'].forEach((n,i)=>{const r=document.createElement('div');r.className='fcol';r.innerHTML=`<span>${n}</span>`;const s=document.createElement('div');s.className='swatches';r.appendChild(s);fc.appendChild(r);
    swatches(s,FL.PALETTE,c.flag.c[i],v=>{c.flag.c[i]=v;drawFlagBig()})});
  swatches($('fec'),FL.PALETTE,c.flag.ec,v=>{c.flag.ec=v;drawFlagBig()});
  seg($('fep'),[[0,'Центр'],[1,'У древка']],c.flag.ep|0,v=>{c.flag.ep=v;drawFlagBig()});
  $('cflag-rnd').onclick=()=>{c.flag=FL.random();buildCountry()};drawFlagBig()}
// map
function buildMap(){const m=C.map;
  cards($('mtype'),[['normal','Обычная','Большой материк с заливами, реками и горами'],['cont','Материки','Два–четыре континента, разделённые проливами'],['arch','Архипелаг','Множество островов разного размера'],['islands','Острова','Несколько крупных островов в океане']],m.type,v=>{m.type=v;preview()});
  seg($('msize'),[[0,'Малый'],[1,'Средний'],[2,'Большой']],m.size,v=>{m.size=v;preview()});
  const lv=[[0,'Нет'],[1,'Мало'],[2,'Норм'],[3,'Много']];seg($('mriv'),lv,m.rivers,v=>{m.rivers=v;preview()});seg($('mlak'),lv,m.lakes,v=>{m.lakes=v;preview()});
  $('mseed').value=C.seed;$('mseed').onchange=()=>{const v=parseInt($('mseed').value);if(v>0){C.seed=v;preview()}else $('mseed').value=C.seed};
  $('mdice').onclick=()=>{C.seed=(Math.random()*1e9)|0;$('mseed').value=C.seed;const d=$('mdice');d.classList.remove('roll');void d.offsetWidth;d.classList.add('roll');preview()}}
function preview(){summary();if(!$('setup')||!document.body.classList.contains('m-setup'))return;clearTimeout(prevT);prevT=setTimeout(()=>{
  if(!prevWorker){const src=FlagArt.toString()+WorldGen.toString()+PREVIEW_SRC;prevWorker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
    prevWorker.onmessage=e=>{const m=e.data;if(m.id!==prevId)return;const c=$('mprev'),x=c.getContext('2d');const im=new ImageData(new Uint8ClampedArray(m.buf),m.n,m.n);
      const t=document.createElement('canvas');t.width=t.height=m.n;t.getContext('2d').putImageData(im,0,0);x.imageSmoothingEnabled=true;x.drawImage(t,0,0,c.width,c.height);
      x.strokeStyle='rgba(255,255,255,0.07)';x.lineWidth=1;x.beginPath();for(let i=1;i<6;i++){const p=i*c.width/6;x.moveTo(p,0);x.lineTo(p,c.height);x.moveTo(0,p);x.lineTo(c.width,p)}x.stroke();
      $('mp-wait').classList.remove('on');$('mp-info').innerHTML=`Суша ≈ ${Math.round(m.land*100)} % · ${Math.round(m.land*131*131)} км² · мир 131 × 131 км<br>Сид ${C.seed}. Сам мир (города, дороги) строится после «Создать мир».`}}
  $('mp-wait').classList.add('on');prevId++;prevWorker.postMessage({id:prevId,seed:C.seed,opt:{map:C.map.type,size:C.map.size,rivers:C.map.rivers,lakes:C.map.lakes},n:200})},120)}
// terrain preview worker: hypsometric tints + hillshade + rivers and lakes (terrain-only WorldGen, no towns)
const PREVIEW_SRC=`
onmessage=function(e){const q=e.data,n=q.n;const T=WorldGen(q.seed,Object.assign({},q.opt,{terrainOnly:true}));const S=T.WORLD/n;const H=new Float32Array((n+2)*(n+2));
  for(let j=0;j<n+2;j++)for(let i=0;i<n+2;i++)H[j*(n+2)+i]=T.baseH((i-0.5)*S,(j-0.5)*S,6);
  const out=new Uint8ClampedArray(n*n*4);let land=0;const K=[[0.004,[196,188,142]],[0.03,[104,140,78]],[0.12,[92,128,66]],[0.22,[124,134,82]],[0.34,[138,126,104]],[0.55,[142,136,130]],[0.75,[176,174,172]],[0.95,[236,238,240]]];
  const ramp=e=>{if(e<=K[0][0])return K[0][1];for(let i=1;i<K.length;i++)if(e<=K[i][0]){const t=(e-K[i-1][0])/(K[i][0]-K[i-1][0]),a=K[i-1][1],b=K[i][1];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}return K[K.length-1][1]};
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=(j+1)*(n+2)+i+1,e=H[k],o=(j*n+i)*4;const x=(i+0.5)*S,y=(j+0.5)*S;let c;
    if(e<0.004){const t=Math.min(1,-e/0.32);c=[58+(14-58)*t,118+(44-118)*t,152+(78-152)*t];if(e>-0.02){c[0]+=18;c[1]+=20;c[2]+=10}}
    else{land++;c=ramp(e).slice();const w=T.riverW(x,y,e);if(w>0&&Math.abs(T.riverV(x,y))<w+S*5e-5){c=[58,112,156]}else{const mo=T.moist(x,y);c[0]+=(-mo)*14;c[1]+=mo*6;
      const dx=H[k+1]-H[k-1],dy=H[k+n+2]-H[k-n-2];const sh=Math.max(0.6,Math.min(1.35,1-(dx*0.9+dy*1.1)*S/30));c=[c[0]*sh,c[1]*sh,c[2]*sh]}}
    out[o]=c[0];out[o+1]=c[1];out[o+2]=c[2];out[o+3]=255}
  postMessage({id:q.id,buf:out.buffer,n,land:land/(n*n)},[out.buffer])};`;
// rules
function buildRules(){const r=C.rules;
  const money=[[1000,'1 000'],[5000,'5 000'],[10000,'10 000'],[25000,'25 000'],[50000,'50 000']];
  seg($('rmoney'),money,r.money,v=>{r.money=v;summary()});
  cards($('rvic'),[['points','По очкам','Первым набрать заданное число очков'],['time','По времени','Лидер по очкам к концу лимита'],['capitals','Захват столиц','Нужна армия — следующие этапы; пока считается лидер к концу лимита']],r.victory,v=>{r.victory=v;$('rtarget-f').style.display=v==='points'?'':'none';summary()});
  $('rtarget-f').style.display=r.victory==='points'?'':'none';
  seg($('rtarget'),[[5000,'5 000'],[10000,'10 000'],[20000,'20 000'],[50000,'50 000']],r.target,v=>{r.target=v;summary()});
  seg($('rtime'),[[0,'Нет'],[30,'30 мин'],[60,'1 ч'],[90,'1,5 ч'],[120,'2 ч'],[180,'3 ч']],r.timeLimit,v=>{r.timeLimit=v;summary()});
  cards($('rmode'),[['normal','Обычный','Казна и запасы месторождений ограничены'],['creative','Творческий','Бесконечные деньги и залежи — стройте и пробуйте']],r.mode,v=>{r.mode=v;summary()});
  seg($('rbots'),[1,2,3,4,5,6,7,8].map(n=>[n,String(n)]),r.botCount,v=>{r.botCount=v;summary()});
  const dn=()=>{const d=DIFF[r.diff];$('rdiff-n').textContent=`Доход ботов ×${String(d.inc).replace('.',',')} · решение раз в ${d.dec} с`};
  seg($('rdiff'),DIFF.map((d,i)=>[i,d.n]),r.diff,v=>{r.diff=v;dn();summary()});dn();
  tog($('rcustom'),r.customBots,v=>{r.customBots=v;if(v&&!r.bots.length){const used=[C.country.color];for(let i=0;i<r.botCount;i++){const b=makeBot(i,used);b.diff=r.diff;b.money=r.money;used.push(b.color);r.bots.push(b)}}botsUI();summary()});botsUI()}
function botsUI(){const r=C.rules;$('rauto').style.display=r.customBots?'none':'';const L=$('rlist');L.innerHTML='';if(!r.customBots)return;
  r.bots.forEach((b,i)=>{const el=document.createElement('div');el.className='bot'+(b._open?' open':'');const hd=document.createElement('div');hd.className='bot-h';
    const fc=flagCanvas(b.flag,36,24);hd.appendChild(fc);hd.insertAdjacentHTML('beforeend',`<b>${escH(b.name)}</b><small>${DIFF[b.diff].n} · ${TRAITS[b.trait]}</small><i class="chip" style="background:${b.color}"></i>`);
    const del=document.createElement('button');del.className='btn sm ghost';del.textContent='✕';del.title='Убрать бота';del.disabled=r.bots.length<=1;del.onclick=e=>{e.stopPropagation();r.bots.splice(i,1);botsUI();summary()};hd.appendChild(del);
    hd.onclick=()=>{b._open=!b._open;el.classList.toggle('open',b._open)};el.appendChild(hd);
    const bd=document.createElement('div');bd.className='bot-b';el.appendChild(bd);
    bd.innerHTML=`<div class="field"><label>Флаг</label><div class="inrow"><canvas class="bf" width="90" height="60" style="width:60px;height:40px;border-radius:4px"></canvas><button class="btn sm br">🎲 Другой флаг</button><select class="bp">${FL.PAT.map((p,k)=>`<option value="${k}"${k===b.flag.p?' selected':''}>${p}</option>`).join('')}</select><select class="be">${FL.EMB.map((p,k)=>`<option value="${k}"${k===b.flag.e?' selected':''}>${p}</option>`).join('')}</select></div></div>
      <div class="field"><label>Название и столица</label><div class="inrow"><input class="bn" value="${escH(b.name)}" maxlength="32"><input class="bc" value="${escH(b.capital)}" maxlength="28"><button class="btn sq bnr">🎲</button></div></div>
      <div class="field"><label>Сложность</label><div class="seg wide bdf"></div><p class="note bdn"></p></div>
      <div class="field"><label>Характер</label><div class="seg wide btr"></div></div>
      <div class="field"><label>Стартовый капитал</label><div class="seg wide bm"></div></div>
      <div class="field"><label>Цвет земли на карте</label><div class="swatches bcol"></div></div>`;
    const q=s=>bd.querySelector(s);const redraw=()=>{FL.draw(q('.bf').getContext('2d'),b.flag,0,0,90,60);flagCanvas(b.flag,36,24,fc)};redraw();
    q('.br').onclick=()=>{b.flag=FL.random();q('.bp').value=b.flag.p;q('.be').value=b.flag.e;redraw()};q('.bp').onchange=e=>{b.flag.p=+e.target.value;redraw()};q('.be').onchange=e=>{b.flag.e=+e.target.value;redraw()};
    q('.bn').oninput=e=>{b.name=e.target.value.trim()||'Безымянная страна';hd.querySelector('b').textContent=b.name};q('.bc').oninput=e=>{b.capital=e.target.value.trim()||'Столица'};
    q('.bnr').onclick=()=>{b.name=NAMES.country();b.capital=NAMES.capital();q('.bn').value=b.name;q('.bc').value=b.capital;hd.querySelector('b').textContent=b.name};
    const dn=()=>{const d=DIFF[b.diff];q('.bdn').textContent=`Доход ×${String(d.inc).replace('.',',')} в секунду · принимает решения раз в ${d.dec} с`;hd.querySelector('small').textContent=`${d.n} · ${TRAITS[b.trait]}`};
    seg(q('.bdf'),DIFF.map((d,k)=>[k,d.n]),b.diff,v=>{b.diff=v;dn()});dn();
    seg(q('.btr'),Object.entries(TRAITS).map(([k,v])=>[k,v]),b.trait,v=>{b.trait=v;dn()});
    seg(q('.bm'),[[1000,'1 тыс'],[5000,'5 тыс'],[10000,'10 тыс'],[25000,'25 тыс'],[50000,'50 тыс']],b.money,v=>{b.money=v});
    swatches(q('.bcol'),LANDC,b.color,v=>{b.color=v;hd.querySelector('.chip').style.background=v});
    L.appendChild(el)});
  if(r.bots.length<8){const a=document.createElement('button');a.className='btn addbot';a.textContent='+ Добавить бота';a.onclick=()=>{const b=makeBot(r.bots.length,[C.country.color,...r.bots.map(q=>q.color)]);b.diff=r.diff;b.money=r.money;b._open=true;r.bots.push(b);botsUI();summary()};L.appendChild(a)}}
const escH=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// more rules
function buildMore(){const r=C.rules;
  seg($('xai'),[[0,'Мирные'],[1,'Обычные'],[2,'Агрессивные']],r.ai,v=>{r.ai=v});
  seg($('xgrow'),[[0,'Медленно'],[1,'Норма'],[2,'Быстро']],r.botGrowth,v=>{r.botGrowth=v});
  seg($('xtr'),[[0,'Выкл'],[1,'Вкл'],[2,'По сложности']],r.trenches,v=>{r.trenches=v});
  tog($('xdn'),r.dayNight,v=>{r.dayNight=v});tog($('xfog'),r.fog,v=>{r.fog=v});tog($('xally'),r.alliances,v=>{r.alliances=v});
  const oc=$('xore-c');const showC=()=>{oc.classList.toggle('on',r.ores==='custom')};
  seg($('xore'),[['balance','Баланс'],['few','Мало'],['many','Много'],['custom','Свои']],r.ores,v=>{r.ores=v;showC()});
  oc.innerHTML='';for(const o of ORES){const row=document.createElement('div');row.className='ore-row';row.innerHTML=`<span>${o.n}</span><input type="range" min="0" max="30" value="${r.oreCustom[o.k]|0}"><i>${r.oreCustom[o.k]|0}</i>`;
    const i=row.querySelector('input');i.oninput=()=>{r.oreCustom[o.k]=+i.value;row.querySelector('i').textContent=i.value};oc.appendChild(row)}showC();
  seg($('xres'),[[0,'Обычные'],[1,'Большие'],[2,'Бесконечные']],r.reserves,v=>{r.reserves=v})}
// slots
function buildSlots(){const el=$('slots');el.innerHTML='';const list=Saves.list();
  list.forEach((s,k)=>{const i=k+1;const b=document.createElement('button');b.className='slot';b.classList.toggle('on',C.slot===i);
    if(s){b.innerHTML=`<b>Ячейка ${i}</b><span class="fl"></span><small>${escH(s.meta.name)} · ${s.meta.day}<br>${fmt(s.meta.score)} очков · ${new Date(s.meta.date).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small><small style="color:#ff9c8e">Будет перезаписана</small>`;b.querySelector('.fl').replaceWith(flagCanvas(s.meta.flag,36,24))}
    else b.innerHTML=`<b>Ячейка ${i}</b><small>Пусто</small>`;
    b.onclick=()=>{C.slot=i;buildSlots();summary()};el.appendChild(b)})}
function summary(){if(!C)return;const r=C.rules,m=C.map;const MT={normal:'Обычная',cont:'Материки',arch:'Архипелаг',islands:'Острова'};
  const nb=r.customBots?r.bots.length:r.botCount;const V={points:'по очкам',time:'по времени',capitals:'захват столиц'};
  $('ssum').innerHTML=[escH(C.country.name),MT[m.type]+', '+['малая','средняя','большая'][m.size]+' суша','Ботов: '+nb+(r.customBots?' (свои)':' · '+DIFF[r.diff].n.toLowerCase()),'Победа '+V[r.victory],r.timeLimit?'Лимит '+r.timeLimit+' мин':'Без лимита',r.mode==='creative'?'Творческий':'','Ячейка '+C.slot].filter(Boolean).map(t=>`<span>${t}</span>`).join('')}
function create(){try{localStorage.setItem('ws.lastcfg',JSON.stringify(C))}catch(e){}stopBg();if(prevWorker){prevWorker.terminate();prevWorker=null}
  const c=JSON.parse(JSON.stringify(C));for(const b of c.rules.bots)delete b._open;Game.newGame(c)}

// ---------------------------------------------------------------- settings
function openSettings(from){setFrom=from;document.body.classList.add('m-settings');if(from==='game')$('pause').classList.remove('show');buildSettings()}
function closeSettings(){document.body.classList.remove('m-settings');if(setFrom==='game')$('pause').classList.add('show');else showMenu()}
function buildSettings(){const b=$('setb');b.innerHTML='';
  const row=(t,d,ctl)=>{const r=document.createElement('div');r.className='set-row';r.innerHTML=`<span>${t}${d?`<small>${d}</small>`:''}</span>`;r.appendChild(ctl);b.appendChild(r)};
  const head=t=>{const h=document.createElement('div');h.className='set-h';h.textContent=t;b.appendChild(h)};
  const T=(k,t,d)=>{const e=document.createElement('div');e.className='tog';tog(e,S[k],v=>{S[k]=v;saveS();if(k==='menuBg'&&!v)stopBg()});row(t,d,e)};
  head('Графика');T('clouds','Облака','Облака и их тени над картой');T('traffic','Транспорт','Машины, поезда, суда и самолёты');T('labels','Подписи городов');T('menuBg','Живой фон главного меню','Отключите на слабом компьютере');
  head('Интерфейс');{const e=document.createElement('div');e.className='seg';seg(e,[[0.9,'90 %'],[1,'100 %'],[1.15,'115 %'],[1.3,'130 %']],S.ui,v=>{S.ui=v;saveS()});row('Масштаб интерфейса','',e)}
  T('hints','Подсказки','Пошаговые подсказки в начале игры');T('fps','Показывать FPS');
  head('Сохранения');Saves.list().forEach((s,k)=>{const e=document.createElement('button');e.className='btn sm danger';e.textContent='Удалить';e.disabled=!s;e.onclick=()=>{if(confirm('Удалить сохранение в ячейке '+(k+1)+'?')){Saves.del(k+1);buildSettings()}};
    row('Ячейка '+(k+1),s?`${escH(s.meta.name)} · ${s.meta.day} · ${fmt(s.meta.score)} очков`:'Пусто',e)});
  {const e=document.createElement('button');e.className='btn sm';e.textContent='Сбросить';e.onclick=()=>{S=Object.assign({},SDEF);saveS();buildSettings()};row('Настройки по умолчанию','',e)}}

// ---------------------------------------------------------------- pause
function pause(v){if(!Game.G)return;const p=$('pause');if(v){if(p.classList.contains('show')){pause(false);return}paused=Game.G.speed;Game.setSpeed(0);$('pinfo').textContent=Game.pauseInfo();p.classList.add('show')}
  else{p.classList.remove('show');if(paused!==null&&Game.G&&Game.G.phase==='play'&&!Game.G.over)Game.setSpeed(paused||1);paused=null}}

// ---------------------------------------------------------------- loading overlay
// the loading screen: procedural topographic map behind the logo (drawn once per size), a sweep bar that runs on the
// compositor (keeps moving while the world is generated on the main thread), tips that change every few seconds
const TIPS=['Столица растёт сама: сначала прокладываются улицы, потом стройплощадки, потом кварталы.','Территория быстрее расходится по равнинам и вдоль побережья, медленнее — в горах.',
  'Месторождения внутри границ пополняют казну, пока не иссякнут. Геологоразведка находит новые.','Союзники делятся обзором: туман войны над их землями рассеивается.',
  '«Ускорить расширение» особенно полезно в начале, пока соседи не заняли свободную землю.','Пробел — пауза, 1–3 — скорость, Esc — меню паузы и сохранение.',
  'Боты-торговцы держатся побережья, милитаристы тянутся к чужим столицам, авантюристы расползаются «щупальцами».','Каждая столица получает правительственный квартал и военную базу.'];
let tipI=(Math.random()*TIPS.length)|0,tipT=0,bgSize='';
function tip(){const e=$('ldtip');e.style.opacity=0;setTimeout(()=>{tipI=(tipI+1)%TIPS.length;e.innerHTML='<b>Совет</b>'+TIPS[tipI];e.style.opacity=1},350)}
function drawLdBg(){const c=$('ldbg');const w=Math.ceil(innerWidth*1.08/2),h=Math.ceil(innerHeight*1.08/2),key=w+'x'+h;if(key===bgSize)return;bgSize=key;c.width=w;c.height=h;const x=c.getContext('2d');
  // value-noise height field on a coarse grid, contour lines by marching squares
  const G=6,nx=Math.ceil(w/G)+1,ny=Math.ceil(h/G)+1,H=new Float32Array(nx*ny);const sd=Math.random()*1000;
  const hsh=(i,j)=>{let q=Math.imul(i|0,374761393)+Math.imul(j|0,668265263)+(sd|0);q=Math.imul(q^(q>>>13),1274126177);return ((q^(q>>>16))>>>0)/4294967296};
  const vn=(u,v)=>{const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,a=hsh(i,j),b=hsh(i+1,j),cc=hsh(i,j+1),d=hsh(i+1,j+1),su=fu*fu*(3-2*fu),sv=fv*fv*(3-2*fv);return a+(b-a)*su+(cc-a)*sv+(a-b-cc+d)*su*sv};
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let v=0,a=1,f=1/90,tot=0;for(let o=0;o<4;o++){v+=a*vn(i*G*f,j*G*f);tot+=a;a*=0.5;f*=2.1}H[j*nx+i]=v/tot}
  x.fillStyle='#070e18';x.fillRect(0,0,w,h);
  x.strokeStyle='rgba(120,160,200,0.06)';x.lineWidth=1;x.beginPath();for(let q=0;q<w;q+=48){x.moveTo(q+0.5,0);x.lineTo(q+0.5,h)}for(let q=0;q<h;q+=48){x.moveTo(0,q+0.5);x.lineTo(w,q+0.5)}x.stroke();
  for(let L=0;L<14;L++){const T=0.3+L*0.03;x.strokeStyle=L%5===0?'rgba(255,210,90,0.15)':'rgba(150,190,220,0.09)';x.lineWidth=L%5===0?1.2:0.8;x.beginPath();
    for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){const a=H[j*nx+i],b=H[j*nx+i+1],cc=H[(j+1)*nx+i+1],d=H[(j+1)*nx+i];const m=(a>T?8:0)|(b>T?4:0)|(cc>T?2:0)|(d>T?1:0);if(!m||m===15)continue;
      const t=(p,q)=>(T-p)/(q-p),X=i*G,Y=j*G;const P={t:[X+t(a,b)*G,Y],r:[X+G,Y+t(b,cc)*G],b:[X+t(d,cc)*G,Y+G],l:[X,Y+t(a,d)*G]};
      const sg=(p,q)=>{x.moveTo(P[p][0],P[p][1]);x.lineTo(P[q][0],P[q][1])};
      switch(m){case 1:case 14:sg('l','b');break;case 2:case 13:sg('b','r');break;case 3:case 12:sg('l','r');break;case 4:case 11:sg('t','r');break;case 6:case 9:sg('t','b');break;case 7:case 8:sg('l','t');break;case 5:sg('l','t');sg('b','r');break;case 10:sg('t','r');sg('l','b')}}
    x.stroke()}
  // a few "targets" over the map: rings with a cross, like a staff map
  x.strokeStyle='rgba(255,210,90,0.28)';x.lineWidth=1;for(let q=0;q<5;q++){const px=w*(0.1+0.8*hsh(q,7)),py=h*(0.1+0.8*hsh(q,9)),r=6+hsh(q,3)*8;x.beginPath();x.arc(px,py,r,0,P2);x.moveTo(px-r-5,py);x.lineTo(px+r+5,py);x.moveTo(px,py-r-5);x.lineTo(px,py+r+5);x.stroke()}}
function loading(t,s){const l=$('loading');drawLdBg();$('ldt').textContent=t;$('lds').innerHTML=s||'';if(l.classList.contains('fade')||!tipT){$('ldtip').innerHTML='<b>Совет</b>'+TIPS[tipI];clearInterval(tipT);tipT=setInterval(tip,5200)}l.classList.remove('fade')}
function loaded(){$('loading').classList.add('fade');clearInterval(tipT);tipT=0}

// ---------------------------------------------------------------- boot
paintIcons();applyS();
const U={viewOpts:()=>({clouds:S.clouds,traffic:S.traffic,labels:S.labels,fps:S.fps}),settings:()=>S,pause,toMenu,loading,loaded};
Game.wire(U);
for(const b of document.querySelectorAll('.mm-b'))b.onclick=()=>menuGo(b.dataset.go);
for(const b of document.querySelectorAll('[data-back]'))b.onclick=()=>{if(document.body.classList.contains('m-settings'))closeSettings();else showMenu()};
$('screate').onclick=create;
$('presume').onclick=()=>pause(false);$('psave').onclick=()=>{Game.save(false);$('pinfo').textContent=Game.pauseInfo()};$('pset').onclick=()=>openSettings('game');
$('pexit').onclick=()=>{$('pause').classList.remove('show');paused=null;toMenu()};
addEventListener('resize',()=>{if(!$('loading').classList.contains('fade'))drawLdBg()});
addEventListener('keydown',e=>{if(e.code!=='Escape')return;if(document.body.classList.contains('m-settings')){closeSettings();return}if(document.body.classList.contains('m-setup'))showMenu()});
window.__ui={S,menuGo,openSetup,create,get C(){return C}};
const HS=location.hash.slice(1);
if(/^\d/.test(HS)||/^view/.test(HS)){document.body.className='m-view';loading('Загрузка мира','Режим просмотра · сид '+parseInt(HS));setTimeout(()=>startWorld({mode:'view',onReady:()=>loaded()}),60)}
else showMenu();
})();

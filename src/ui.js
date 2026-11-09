// Menus and screens (stage 5): main menu, new game setup, settings, pause, loading; app bootstrap.
(function(){
'use strict';
const $=id=>document.getElementById(id);
const VERSION='5.13';
let bg=null,C=null,prevWorker=null,prevId=0,prevT=0,setFrom=null,paused=null;

// ---------------------------------------------------------------- settings
const SDEF={clouds:true,traffic:true,labels:true,fps:false,ui:1,menuBg:true,hints:true,quality:'balance'};
const QV={high:{dpr:2},balance:{dpr:1.25},fast:{dpr:1,lite:true}};
let S=Object.assign({},SDEF);try{Object.assign(S,JSON.parse(localStorage.getItem('ws.settings')||'{}'))}catch(e){}
function saveS(){try{localStorage.setItem('ws.settings',JSON.stringify(S))}catch(e){}applyS()}
// the game HUD scales with the window (as the UI of DroneFlames) and with «Масштаб интерфейса»
function applyZ(){document.documentElement.style.setProperty('--z',(Math.min(1.6,Math.max(0.9,Math.min(innerHeight/780,innerWidth/1300)))*S.ui).toFixed(3))}
addEventListener('resize',applyZ);
function applyS(){document.documentElement.style.setProperty('--ui',S.ui);applyZ();const a=Game.api;if(a){a.opt.clouds=S.clouds;a.opt.traffic=S.traffic;a.opt.labels=S.labels}$('fps').classList.toggle('hid',!S.fps)}

// ---------------------------------------------------------------- procedural icons (Canvas 2D → CSS)
// stage 5.8: coloured, with a dark outline and a drop under it, as the sprites of DroneFlames
const IC={w:'#f6eedb',w2:'#d9cfb6',r:'#dc523d',r2:'#a8372a',y:'#ffd050',o:'#f2a52a',g:'#7fcc4c',g2:'#4e9234',b:'#66b2f2',b2:'#3a78c8',s:'#b4bec8',s2:'#7c8794',k:'#45464c',br:'#b07a40',br2:'#7d5428',ol:'#97a35e',ol2:'#6b7640'};
function outlined(c){const N=c.width,o=document.createElement('canvas');o.width=o.height=N;const x=o.getContext('2d'),s=document.createElement('canvas');s.width=s.height=N;const y=s.getContext('2d');
  y.drawImage(c,0,0);y.globalCompositeOperation='source-in';y.fillStyle='#1b120c';y.fillRect(0,0,N,N);
  for(const [dx,dy] of [[-2.4,0],[2.4,0],[0,-2.4],[0,2.4],[-1.7,-1.7],[1.7,-1.7],[-1.7,1.7],[1.7,1.7],[0,3.6]])x.drawImage(s,dx,dy);x.drawImage(c,0,0);return o}
function icon(name,draw,bld){const N=64,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.lineCap='round';x.lineJoin='round';
  const g=IC.w;x.strokeStyle=g;x.fillStyle=g;x.lineWidth=4.2;draw(x,g);const o=outlined(c);
  if(bld){Game.setIcon(name,o);return `.ic-b-${name}{background-image:url(${o.toDataURL()})}`}return `.ic-${name},.ri-${name}{background-image:url(${o.toDataURL()})}`}
const P2=Math.PI*2;
const col=(x,f,s)=>{x.fillStyle=f;x.strokeStyle=s||f};
function paintIcons(){const css=[];
  css.push(icon('new',x=>{col(x,IC.b2);x.beginPath();x.arc(30,32,19,0,P2);x.fill();col(x,IC.g);x.beginPath();x.moveTo(16,22);x.bezierCurveTo(24,14,34,20,30,28);x.bezierCurveTo(26,36,16,32,14,40);x.bezierCurveTo(10,34,11,27,16,22);x.fill();
    x.beginPath();x.moveTo(34,36);x.bezierCurveTo(42,32,48,38,44,46);x.bezierCurveTo(40,50,34,46,34,36);x.fill();col(x,IC.y);x.beginPath();x.arc(48,46,10,0,P2);x.fill();col(x,'#1b120c');x.lineWidth=3.6;x.beginPath();x.moveTo(42,46);x.lineTo(54,46);x.moveTo(48,40);x.lineTo(48,52);x.stroke()}));
  css.push(icon('cont',x=>{col(x,IC.g2);x.beginPath();x.arc(32,32,20,0,P2);x.fill();col(x,IC.w);x.beginPath();x.moveTo(27,21);x.lineTo(43,32);x.lineTo(27,43);x.closePath();x.fill()}));
  css.push(icon('tut',x=>{col(x,IC.b2);x.beginPath();x.moveTo(8,24);x.lineTo(32,13);x.lineTo(56,24);x.lineTo(32,35);x.closePath();x.fill();col(x,IC.w);x.beginPath();x.moveTo(18,30);x.lineTo(18,42);x.quadraticCurveTo(32,52,46,42);x.lineTo(46,30);x.stroke();col(x,IC.y);x.beginPath();x.moveTo(54,25);x.lineTo(54,40);x.stroke()}));
  css.push(icon('set',x=>{col(x,IC.s);x.beginPath();for(let i=0;i<16;i++){const a=i*P2/16,r=i%2?16:22;x.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}x.closePath();x.fill();x.globalCompositeOperation='destination-out';x.beginPath();x.arc(32,32,7,0,P2);x.fill()}));
  css.push(icon('capital',x=>{x.beginPath();x.arc(32,26,10,Math.PI,0);x.fill();x.fillRect(31,9,2.4,8);x.fillRect(14,28,36,4);for(let i=0;i<5;i++)x.fillRect(16+i*7.5,34,3.5,14);col(x,IC.w2);x.fillRect(10,48,44,6);
    col(x,IC.r);x.beginPath();x.moveTo(33.4,8);x.lineTo(44,11);x.lineTo(33.4,15);x.fill()}));
  css.push(icon('boost',x=>{x.strokeRect(22,22,20,20);for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){x.beginPath();x.moveTo(32+dx*14,32+dy*14);x.lineTo(32+dx*26,32+dy*26);x.stroke();x.beginPath();x.moveTo(32+dx*28-dy*6,32+dy*28+dx*6);x.lineTo(32+dx*28+dy*6,32+dy*28-dx*6);x.lineTo(32+dx*34,32+dy*34);x.closePath();x.fill()}}));
  css.push(icon('invest',x=>{col(x,IC.g);x.fillRect(10,40,10,14);x.fillRect(24,30,10,24);x.fillRect(38,20,10,34);col(x,IC.y);x.lineWidth=3.4;x.beginPath();x.moveTo(10,30);x.lineTo(24,20);x.lineTo(34,24);x.lineTo(50,9);x.stroke();x.beginPath();x.moveTo(52,7);x.lineTo(43,8);x.lineTo(51,16);x.closePath();x.fill()}));
  css.push(icon('scout',x=>{col(x,'rgba(102,178,242,0.45)');x.beginPath();x.arc(27,27,13,0,P2);x.fill();col(x,IC.w);x.beginPath();x.arc(27,27,14,0,P2);x.stroke();col(x,IC.br);x.lineWidth=7;x.beginPath();x.moveTo(38,38);x.lineTo(52,52);x.stroke()}));
  css.push(icon('money',x=>{for(let i=0;i<4;i++){col(x,i%2?'#ffc63a':IC.y);x.beginPath();x.ellipse(32,46-i*8,17,6,0,0,P2);x.fill();x.strokeStyle='#a86e14';x.lineWidth=1.6;x.stroke()}}));
  css.push(icon('land',x=>{col(x,IC.w2);x.beginPath();x.moveTo(8,16);x.lineTo(24,10);x.lineTo(40,16);x.lineTo(56,10);x.lineTo(56,48);x.lineTo(40,54);x.lineTo(24,48);x.lineTo(8,54);x.closePath();x.fill();
    col(x,IC.g);x.beginPath();x.moveTo(13,22);x.lineTo(22,18);x.lineTo(30,26);x.lineTo(22,40);x.lineTo(12,38);x.closePath();x.fill();col(x,IC.r);x.lineWidth=2.6;x.setLineDash([4,3]);x.beginPath();x.moveTo(34,14);x.lineTo(42,30);x.lineTo(36,50);x.stroke()}));
  css.push(icon('pop',x=>{col(x,IC.w2);x.beginPath();x.arc(42,20,7,0,P2);x.fill();x.beginPath();x.arc(43,48,13,Math.PI,0);x.fill();col(x,IC.w);x.beginPath();x.arc(24,22,8,0,P2);x.fill();x.beginPath();x.arc(24,52,15,Math.PI,0);x.fill()}));
  css.push(icon('ore',x=>{col(x,'#c060e0');x.beginPath();x.moveTo(32,8);x.lineTo(50,24);x.lineTo(42,54);x.lineTo(22,54);x.lineTo(14,24);x.closePath();x.fill();x.strokeStyle='#7a2c96';x.lineWidth=2;x.beginPath();x.moveTo(14,24);x.lineTo(32,30);x.lineTo(50,24);x.moveTo(32,30);x.lineTo(32,54);x.moveTo(32,8);x.lineTo(32,30);x.stroke();
    col(x,'rgba(255,255,255,0.55)');x.beginPath();x.moveTo(20,25);x.lineTo(30,13);x.lineTo(31,28);x.closePath();x.fill()}));
  css.push(icon('star',x=>{col(x,IC.y);x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?10:24;x.lineTo(32+Math.cos(a)*r,33+Math.sin(a)*r)}x.closePath();x.fill()}));
  css.push(icon('dip',x=>{col(x,IC.y);x.beginPath();x.arc(24,32,13,0,P2);x.stroke();col(x,IC.b);x.beginPath();x.arc(40,32,13,0,P2);x.stroke()}));
  // resources
  css.push(icon('food',x=>{col(x,IC.o);x.beginPath();x.moveTo(32,56);x.lineTo(32,14);x.stroke();for(let i=0;i<5;i++){const y=18+i*7;for(const sd of [-1,1]){col(x,i%2?IC.o:IC.y);x.beginPath();x.ellipse(32+sd*7,y,6,3.4,sd*0.6,0,P2);x.fill()}}}));
  css.push(icon('goods',x=>{col(x,IC.br);x.beginPath();x.moveTo(32,8);x.lineTo(54,19);x.lineTo(54,45);x.lineTo(32,56);x.lineTo(10,45);x.lineTo(10,19);x.closePath();x.fill();col(x,IC.br2);x.lineWidth=3;x.beginPath();x.moveTo(10,19);x.lineTo(32,30);x.lineTo(54,19);x.moveTo(32,30);x.lineTo(32,56);x.stroke();
    col(x,'#d9a466');x.beginPath();x.moveTo(32,8);x.lineTo(54,19);x.lineTo(32,30);x.lineTo(10,19);x.closePath();x.fill()}));
  css.push(icon('energy',x=>{col(x,IC.y);x.beginPath();x.moveTo(38,6);x.lineTo(16,36);x.lineTo(30,36);x.lineTo(24,58);x.lineTo(48,26);x.lineTo(34,26);x.closePath();x.fill();col(x,'#fff6c8');x.beginPath();x.moveTo(36,10);x.lineTo(21,32);x.lineTo(27,32);x.closePath();x.fill()}));
  css.push(icon('wood',x=>{for(const [y,l] of [[44,0],[30,6],[16,12]]){col(x,IC.br);x.fillRect(14+l,y-7,36-l,14);col(x,'#e0b47a');x.beginPath();x.ellipse(14+l,y,7,7,0,0,P2);x.fill();col(x,IC.br2);x.lineWidth=1.6;x.beginPath();x.arc(14+l,y,3,0,P2);x.stroke()}}));
  css.push(icon('oil',x=>{col(x,'#2e2f36');x.beginPath();x.moveTo(32,6);x.bezierCurveTo(46,24,50,34,50,40);x.bezierCurveTo(50,52,42,58,32,58);x.bezierCurveTo(22,58,14,52,14,40);x.bezierCurveTo(14,34,18,24,32,6);x.fill();
    col(x,'rgba(255,255,255,0.6)');x.beginPath();x.ellipse(24,40,3.4,7,0.3,0,P2);x.fill()}));
  css.push(icon('fuel',x=>{col(x,IC.r);x.fillRect(14,16,26,40);col(x,IC.r2);x.fillRect(14,46,26,10);col(x,IC.w);x.fillRect(19,22,16,10);col(x,IC.s);x.lineWidth=4;x.beginPath();x.moveTo(40,24);x.lineTo(50,30);x.lineTo(50,48);x.quadraticCurveTo(50,54,45,52);x.stroke()}));
  css.push(icon('metal',x=>{for(const [dx,dy] of [[0,14],[18,14],[9,0]]){col(x,dy?IC.s:'#d4dce4');x.beginPath();x.moveTo(8+dx,24+dy);x.lineTo(28+dx,24+dy);x.lineTo(32+dx,34+dy);x.lineTo(4+dx,34+dy);x.closePath();x.fill();col(x,IC.s2);x.fillRect(6+dx,31+dy,24,3)}}));
  // buildings (also drawn on the map: construction sites and the build preview)
  css.push(icon('city',x=>{col(x,'#8ea6bd');x.fillRect(8,30,12,26);col(x,'#b9cbdc');x.fillRect(22,12,14,44);col(x,'#9db4c9');x.fillRect(38,24,16,32);
    col(x,'#ffe08a');for(let i=0;i<4;i++)for(let j=0;j<2;j++)x.fillRect(25+j*6,17+i*9,3,4);for(let i=0;i<3;i++)x.fillRect(42,29+i*8,3,3),x.fillRect(48,29+i*8,3,3);x.fillRect(11,35,3,3);x.fillRect(11,43,3,3)},1));
  css.push(icon('village',x=>{for(const [cx,w] of [[20,24],[44,20]]){col(x,IC.w);x.fillRect(cx-w/2,36,w,18);col(x,IC.r);x.beginPath();x.moveTo(cx-w/2-3,37);x.lineTo(cx,20);x.lineTo(cx+w/2+3,37);x.closePath();x.fill();col(x,IC.br2);x.fillRect(cx-3,44,6,10)}},1));
  css.push(icon('farm',x=>{col(x,IC.g);x.fillRect(4,52,56,6);col(x,IC.r2);x.fillRect(12,30,32,24);col(x,IC.r);x.beginPath();x.moveTo(8,31);x.lineTo(28,14);x.lineTo(48,31);x.closePath();x.fill();col(x,IC.w);x.fillRect(22,38,12,16);x.lineWidth=2;x.strokeStyle=IC.r2;x.beginPath();x.moveTo(22,38);x.lineTo(34,54);x.moveTo(34,38);x.lineTo(22,54);x.stroke();
    col(x,IC.w2);x.fillRect(50,18,8,36);x.beginPath();x.arc(54,18,4,Math.PI,0);x.fill()},1));
  css.push(icon('factory',x=>{col(x,'#aab6c2');x.beginPath();x.moveTo(6,56);x.lineTo(6,30);x.lineTo(20,22);x.lineTo(20,30);x.lineTo(34,22);x.lineTo(34,30);x.lineTo(48,22);x.lineTo(48,56);x.closePath();x.fill();
    col(x,'#6fa3d8');for(let i=0;i<3;i++)x.fillRect(10+i*13,38,8,6);col(x,IC.r);x.fillRect(50,10,7,46);col(x,IC.w);x.fillRect(50,18,7,4);x.fillRect(50,30,7,4);col(x,'rgba(220,220,220,0.8)');x.beginPath();x.arc(54,6,4,0,P2);x.fill()},1));
  css.push(icon('power',x=>{for(const cx of [18,40]){col(x,cx<30?'#c8cdd2':'#dde2e6');x.beginPath();x.moveTo(cx-10,56);x.quadraticCurveTo(cx-4,34,cx-8,14);x.lineTo(cx+8,14);x.quadraticCurveTo(cx+4,34,cx+10,56);x.closePath();x.fill();col(x,IC.r);x.fillRect(cx-7,20,14,3)}
    col(x,IC.y);x.beginPath();x.moveTo(56,18);x.lineTo(46,36);x.lineTo(53,36);x.lineTo(48,52);x.lineTo(60,32);x.lineTo(53,32);x.closePath();x.fill()},1));
  css.push(icon('sawmill',x=>{col(x,IC.g2);x.beginPath();x.moveTo(18,6);x.lineTo(31,30);x.lineTo(5,30);x.closePath();x.fill();col(x,IC.g);x.beginPath();x.moveTo(18,6);x.lineTo(26,20);x.lineTo(10,20);x.closePath();x.fill();col(x,IC.br2);x.fillRect(16,30,4,10);
    col(x,IC.s);x.beginPath();x.arc(42,40,15,0,P2);x.fill();for(let i=0;i<12;i++){const a=i*P2/12;x.beginPath();x.moveTo(42+Math.cos(a)*14,40+Math.sin(a)*14);x.lineTo(42+Math.cos(a+0.25)*19,40+Math.sin(a+0.25)*19);x.lineTo(42+Math.cos(a+0.5)*14,40+Math.sin(a+0.5)*14);x.fill()}col(x,IC.s2);x.beginPath();x.arc(42,40,5,0,P2);x.fill()},1));
  css.push(icon('oil',x=>{col(x,IC.o);x.beginPath();x.moveTo(10,56);x.lineTo(32,10);x.lineTo(54,56);x.stroke();x.beginPath();x.moveTo(17,42);x.lineTo(47,42);x.moveTo(22,30);x.lineTo(42,30);x.stroke();col(x,IC.k);x.fillRect(27,5,10,7);col(x,'#2e2f36');x.beginPath();x.ellipse(32,57,10,3.5,0,0,P2);x.fill()},1));
  css.push(icon('refinery',x=>{col(x,IC.w);x.fillRect(8,26,10,30);col(x,IC.s);x.fillRect(22,14,8,42);col(x,IC.w2);x.fillRect(34,32,22,24);x.beginPath();x.arc(45,30,10,Math.PI,0);x.fill();col(x,IC.r);x.fillRect(8,34,10,3);x.fillRect(34,40,22,3);
    col(x,IC.o);x.beginPath();x.moveTo(26,2);x.bezierCurveTo(32,7,30,12,26,14);x.bezierCurveTo(22,12,21,7,26,2);x.fill();col(x,IC.y);x.beginPath();x.arc(26,11,2,0,P2);x.fill()},1));
  css.push(icon('port',x=>{col(x,IC.b2);x.fillRect(4,52,56,8);col(x,IC.b);x.beginPath();x.arc(32,14,6,0,P2);x.stroke();x.beginPath();x.moveTo(32,20);x.lineTo(32,52);x.moveTo(20,30);x.lineTo(44,30);x.stroke();x.beginPath();x.moveTo(10,38);x.quadraticCurveTo(14,52,32,52);x.quadraticCurveTo(50,52,54,38);x.stroke()},1));
  css.push(icon('airport',x=>{col(x,IC.k);x.fillRect(4,47,56,11);col(x,IC.w);for(let i=0;i<5;i++)x.fillRect(7+i*11,51.5,6,2);
    col(x,IC.s2);x.fillRect(47,20,7,27);col(x,IC.b);x.beginPath();x.moveTo(42,20);x.lineTo(59,20);x.lineTo(56,12);x.lineTo(45,12);x.closePath();x.fill();
    x.save();x.translate(24,26);x.rotate(-0.55);col(x,IC.w);x.beginPath();x.ellipse(0,0,19,3.6,0,0,P2);x.fill();x.beginPath();x.moveTo(-3,-2);x.lineTo(-9,-17);x.lineTo(-4,-17);x.lineTo(6,-2);x.lineTo(6,2);x.lineTo(-4,17);x.lineTo(-9,17);x.lineTo(-3,2);x.closePath();x.fill();
    x.beginPath();x.moveTo(-14,-1);x.lineTo(-18,-8);x.lineTo(-15,-8);x.lineTo(-10,-1);x.lineTo(-10,1);x.lineTo(-15,8);x.lineTo(-18,8);x.lineTo(-14,1);x.closePath();x.fill();col(x,IC.b2);x.fillRect(11,-1.6,5,3.2);x.restore()},1));
  css.push(icon('barracks',x=>{col(x,IC.ol);x.beginPath();x.moveTo(32,6);x.lineTo(54,14);x.lineTo(54,32);x.quadraticCurveTo(52,50,32,58);x.quadraticCurveTo(12,50,10,32);x.lineTo(10,14);x.closePath();x.fill();col(x,IC.ol2);x.beginPath();x.moveTo(32,6);x.lineTo(54,14);x.lineTo(54,32);x.quadraticCurveTo(52,50,32,58);x.closePath();x.fill();
    col(x,IC.r);x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?5:12;x.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}x.closePath();x.fill()},1));
  css.push(icon('sam',x=>{col(x,IC.ol2);x.fillRect(8,46,48,8);col(x,IC.k);for(const cx of [16,30,44]){x.beginPath();x.arc(cx,56,3.5,0,P2);x.fill()}x.save();x.translate(30,44);x.rotate(-0.7);col(x,IC.ol);for(let i=0;i<2;i++)x.fillRect(-4,-8-i*9,34,7);col(x,IC.r);for(let i=0;i<2;i++)x.fillRect(28,-8-i*9,5,7);x.restore();
    col(x,IC.w);x.beginPath();x.arc(50,14,5,0,P2);x.fill();x.lineWidth=2.5;x.beginPath();x.arc(50,14,10,-2.4,-0.6);x.stroke()},1));
  css.push(icon('pause',x=>{col(x,IC.b);x.fillRect(18,13,10,38);x.fillRect(36,13,10,38);col(x,'#c8e6ff');x.fillRect(20,15,3,34);x.fillRect(38,15,3,34)}));
  css.push(icon('play',x=>{col(x,IC.g);x.beginPath();x.moveTo(20,12);x.lineTo(50,32);x.lineTo(20,52);x.closePath();x.fill()}));
  css.push(icon('demolish',x=>{col(x,IC.br);x.lineWidth=6;x.beginPath();x.moveTo(14,50);x.lineTo(40,24);x.stroke();col(x,IC.s);x.beginPath();x.moveTo(30,14);x.lineTo(50,34);x.lineTo(56,28);x.lineTo(36,8);x.closePath();x.fill();col(x,IC.r);for(const [a,b] of [[8,30],[17,21],[46,50],[54,42]]){x.fillRect(a,b,6,5)}},1));
  css.push(icon('drone',x=>{col(x,IC.s);x.beginPath();x.moveTo(52,32);x.lineTo(14,14);x.lineTo(22,32);x.lineTo(14,50);x.closePath();x.fill();x.fillRect(6,30,12,4)},1));
  css.push(icon('swarm',x=>{col(x,IC.s);for(const [dx,dy,k] of [[0,-14,0.6],[-6,0,0.75],[0,14,0.6]]){x.save();x.translate(32+dx,32+dy);x.scale(k,k);x.beginPath();x.moveTo(26,0);x.lineTo(-20,-18);x.lineTo(-10,0);x.lineTo(-20,18);x.closePath();x.fill();x.restore()}},1));
  css.push(icon('army',x=>{col(x,IC.ol);x.fillRect(8,16,48,32);col(x,IC.w);x.lineWidth=3.6;x.strokeRect(8,16,48,32);x.beginPath();x.moveTo(8,16);x.lineTo(56,48);x.moveTo(56,16);x.lineTo(8,48);x.stroke()},1));
  // stage 5.7
  css.push(icon('solar',x=>{x.save();x.translate(30,38);x.transform(1,0,-0.45,0.62,0,0);col(x,'#2b4f9a');x.fillRect(-23,-15,46,30);col(x,IC.b);for(let i=0;i<3;i++)for(let j=0;j<2;j++)x.fillRect(-22+i*15,-14+j*15,13,13);x.restore();col(x,IC.s2);x.fillRect(16,48,3,10);x.fillRect(40,48,3,10);
    col(x,IC.y);x.beginPath();x.arc(50,13,6,0,P2);x.fill();x.lineWidth=2.6;for(let i=0;i<8;i++){const a=i*P2/8;x.beginPath();x.moveTo(50+Math.cos(a)*9,13+Math.sin(a)*9);x.lineTo(50+Math.cos(a)*12.5,13+Math.sin(a)*12.5);x.stroke()}},1));
  css.push(icon('mine',x=>{col(x,IC.r);x.lineWidth=3.6;x.beginPath();x.moveTo(12,54);x.lineTo(24,10);x.lineTo(36,54);x.moveTo(17,36);x.lineTo(31,36);x.moveTo(20,24);x.lineTo(28,24);x.stroke();x.beginPath();x.arc(24,10,5,0,P2);x.stroke();
    col(x,IC.s2);x.beginPath();x.moveTo(36,40);x.lineTo(58,40);x.lineTo(54,52);x.lineTo(40,52);x.closePath();x.fill();col(x,IC.k);for(const cx of [43,51]){x.beginPath();x.arc(cx,56,3,0,P2);x.fill()}col(x,'#8d97a4');x.beginPath();x.moveTo(38,40);x.lineTo(44,31);x.lineTo(50,35);x.lineTo(56,30);x.lineTo(58,40);x.fill()},1));
  css.push(icon('gaswell',x=>{col(x,IC.b);x.beginPath();x.moveTo(32,4);x.bezierCurveTo(45,17,43,30,32,34);x.bezierCurveTo(21,30,19,17,32,4);x.fill();col(x,'#c8e6ff');x.beginPath();x.moveTo(32,15);x.bezierCurveTo(38,21,37,28,32,30);x.bezierCurveTo(27,28,26,21,32,15);x.fill();
    col(x,IC.s);x.fillRect(29,34,6,14);x.fillRect(16,40,32,5);col(x,IC.y);x.fillRect(10,50,44,7);col(x,IC.k);for(let i=0;i<5;i++)x.fillRect(12+i*9,50,4,7)},1));
  css.push(icon('station',x=>{col(x,IC.w2);x.fillRect(12,26,40,18);col(x,IC.r);x.beginPath();x.moveTo(8,27);x.lineTo(32,10);x.lineTo(56,27);x.closePath();x.fill();col(x,'#6fa3d8');for(let i=0;i<3;i++)x.fillRect(16+i*12,30,7,10);
    col(x,IC.br2);for(let i=0;i<7;i++)x.fillRect(7+i*8,47,3,14);col(x,IC.s);x.fillRect(4,50,56,3);x.fillRect(4,57,56,3)},1));
  css.push(icon('rail',x=>{col(x,IC.br);x.lineWidth=3.4;for(let i=0;i<6;i++){const t=i/5,y=54-t*44,w=14-t*6;x.beginPath();x.moveTo(32-w,y);x.lineTo(32+w,y);x.stroke()}col(x,IC.s);x.beginPath();x.moveTo(20,58);x.lineTo(28,6);x.moveTo(44,58);x.lineTo(36,6);x.stroke();
    col(x,IC.r);x.fillRect(46,4,2.4,16);x.beginPath();x.moveTo(48,4);x.lineTo(58,8);x.lineTo(48,12);x.fill()},1));
  const uav=(x,v,s)=>{x.save();x.translate(32,32);x.scale(s,s);x.beginPath();
    if(v===0){x.ellipse(0,0,24,3.5,0,0,P2);x.fill();for(const [cx,sp] of [[10,15],[-12,16]])for(const sg of [-1,1]){x.beginPath();x.moveTo(cx+2,0);x.lineTo(cx-4,sg*sp);x.lineTo(cx-8,sg*sp);x.lineTo(cx-3,0);x.fill()}}
    else if(v===1){x.moveTo(26,0);x.lineTo(8,-3);x.lineTo(-14,-20);x.lineTo(-20,-20);x.lineTo(-17,-3);x.lineTo(-25,-2.5);x.lineTo(-25,2.5);x.lineTo(-17,3);x.lineTo(-20,20);x.lineTo(-14,20);x.lineTo(8,3);x.closePath();x.fill();
      x.globalCompositeOperation='destination-out';x.beginPath();x.ellipse(-12,0,10,2.6,0,0,P2);x.fill();x.globalCompositeOperation='source-over';x.beginPath();x.ellipse(-12,0,9,1.6,0,0,P2);x.fill()}
    else{x.ellipse(2,0,22,3,0,0,P2);x.fill();x.fillRect(2,-26,7,52);x.fillRect(-20,-9,4,18);x.fillRect(22,-1.5,3,3);x.fillRect(24,-8,1.8,16)}
    x.restore()};
  css.push(icon('lancet',x=>{col(x,'#c2ccd4');uav(x,0,1.05);col(x,IC.r);x.fillRect(55,30,5,4)},1));css.push(icon('geran',x=>{col(x,'#9aa48a');uav(x,1,1.05)},1));css.push(icon('orlan',x=>{col(x,'#dfe5ea');uav(x,2,1);col(x,IC.b2);x.fillRect(34,6,7,4);x.fillRect(34,54,7,4)},1));
  css.push(icon('droneport',x=>{col(x,IC.s);x.beginPath();x.moveTo(6,44);x.quadraticCurveTo(6,18,32,18);x.quadraticCurveTo(58,18,58,44);x.closePath();x.fill();col(x,IC.s2);x.fillRect(4,44,56,4);col(x,'#2e2f36');x.fillRect(22,30,20,14);
    x.save();x.translate(32,10);x.scale(0.42,0.42);col(x,IC.w);x.beginPath();x.moveTo(26,0);x.lineTo(-14,-20);x.lineTo(-20,-20);x.lineTo(-17,0);x.lineTo(-20,20);x.lineTo(-14,20);x.closePath();x.fill();x.restore();col(x,IC.y);x.fillRect(4,54,56,4);col(x,IC.k);for(let i=0;i<7;i++)x.fillRect(6+i*8,54,4,4)},1));
  css.push(icon('dramp',x=>{x.save();x.translate(8,52);x.rotate(-0.5);col(x,IC.s);x.fillRect(0,-2,52,5);x.restore();col(x,IC.ol);x.fillRect(6,48,22,9);col(x,IC.k);for(const cx of [10,22]){x.beginPath();x.arc(cx,58,3.4,0,P2);x.fill()}col(x,IC.s2);x.fillRect(44,30,3,26);
    x.save();x.translate(40,26);x.rotate(-0.5);x.scale(0.4,0.4);col(x,IC.w);x.beginPath();x.ellipse(0,0,24,3.5,0,0,P2);x.fill();for(const sg of [-1,1]){x.beginPath();x.moveTo(10,0);x.lineTo(4,sg*15);x.lineTo(0,sg*15);x.lineTo(5,0);x.fill()}x.restore()},1));
  css.push(icon('drwy',x=>{x.save();x.translate(32,38);x.transform(1,0,-0.6,0.5,0,0);col(x,'#55575e');x.fillRect(-30,-12,60,24);col(x,IC.w);for(let i=0;i<5;i++)x.fillRect(-24+i*11,-1.5,6,3);x.restore();
    x.save();x.translate(40,14);x.rotate(-0.4);x.scale(0.42,0.42);col(x,IC.w);x.beginPath();x.moveTo(26,0);x.lineTo(-14,-20);x.lineTo(-20,-20);x.lineTo(-17,0);x.lineTo(-20,20);x.lineTo(-14,20);x.closePath();x.fill();x.restore()},1));
  css.push(icon('dstore',x=>{for(const [y,w,c] of [[34,40,'#c9d1d8'],[52,48,IC.s]]){col(x,c);x.beginPath();x.moveTo(32-w/2,y);x.quadraticCurveTo(32-w/2,y-18,32,y-18);x.quadraticCurveTo(32+w/2,y-18,32+w/2,y);x.closePath();x.fill()}
    col(x,'#2e2f36');x.fillRect(26,42,12,10);x.fillRect(28,25,8,9)},1));
  css.push(icon('dronefab',x=>{col(x,'#aab6c2');x.beginPath();x.moveTo(4,58);x.lineTo(4,32);x.lineTo(16,24);x.lineTo(16,32);x.lineTo(28,24);x.lineTo(28,32);x.lineTo(40,24);x.lineTo(40,58);x.closePath();x.fill();col(x,IC.ol2);x.fillRect(44,40,16,18);col(x,'#6fa3d8');x.fillRect(9,40,8,6);x.fillRect(24,40,8,6);
    x.save();x.translate(44,14);x.scale(0.42,0.42);col(x,IC.w);x.beginPath();x.ellipse(0,0,24,3.5,0,0,P2);x.fill();for(const [cx,sp] of [[10,15],[-12,16]])for(const sg of [-1,1]){x.beginPath();x.moveTo(cx+2,0);x.lineTo(cx-4,sg*sp);x.lineTo(cx-8,sg*sp);x.lineTo(cx-3,0);x.fill()}x.restore()},1));
  // stage 5.8: the HUD as in DroneFlames — tabs, the top bar, the panel keys
  css.push(icon('tab-map',x=>{col(x,IC.s2);x.beginPath();x.moveTo(4,54);x.lineTo(22,20);x.lineTo(32,34);x.lineTo(42,14);x.lineTo(60,54);x.closePath();x.fill();col(x,IC.w);x.beginPath();x.moveTo(17,30);x.lineTo(22,20);x.lineTo(27,27);x.lineTo(23,30);x.closePath();x.fill();
    x.beginPath();x.moveTo(36,26);x.lineTo(42,14);x.lineTo(48,26);x.lineTo(44,24);x.lineTo(41,28);x.closePath();x.fill();col(x,IC.g2);x.fillRect(4,52,56,5)}));
  css.push(icon('tab-city',x=>{col(x,IC.w);x.fillRect(6,30,13,26);x.fillRect(22,10,14,46);x.fillRect(39,22,16,34);col(x,'#5f6b78');for(let i=0;i<4;i++)for(let j=0;j<2;j++)x.fillRect(25+j*6,15+i*9,3,5);for(let i=0;i<3;i++)x.fillRect(43,27+i*8,3,4),x.fillRect(49,27+i*8,3,4);x.fillRect(9,35,3,4);x.fillRect(9,44,3,4);x.fillRect(14,35,3,4)}));
  css.push(icon('tab-strike',x=>{col(x,IC.w);x.beginPath();x.moveTo(32,4);x.lineTo(36,16);x.lineTo(36,26);x.lineTo(58,38);x.lineTo(58,43);x.lineTo(36,37);x.lineTo(35,50);x.lineTo(44,56);x.lineTo(44,60);x.lineTo(32,57);x.lineTo(20,60);x.lineTo(20,56);x.lineTo(29,50);x.lineTo(28,37);x.lineTo(6,43);x.lineTo(6,38);x.lineTo(28,26);x.lineTo(28,16);x.closePath();x.fill();
    col(x,IC.b2);x.beginPath();x.ellipse(32,16,2.4,5,0,0,P2);x.fill()}));
  css.push(icon('tab-aa',x=>{col(x,IC.s2);x.fillRect(6,46,52,9);col(x,IC.k);for(const cx of [14,26,38,50]){x.beginPath();x.arc(cx,56,4,0,P2);x.fill()}x.save();x.translate(26,44);x.rotate(-0.75);col(x,IC.s);for(let i=0;i<3;i++)x.fillRect(-4,-14+i*7,36,6);col(x,IC.w);for(let i=0;i<3;i++)x.fillRect(30,-14+i*7,5,6);x.restore();
    col(x,IC.w);x.lineWidth=2.6;x.beginPath();x.arc(50,16,8,-2.6,-0.5);x.stroke();x.beginPath();x.arc(50,16,13,-2.6,-0.5);x.stroke()}));
  css.push(icon('tab-army',x=>{col(x,IC.ol2);x.beginPath();x.moveTo(6,44);x.lineTo(58,44);x.lineTo(53,56);x.lineTo(11,56);x.closePath();x.fill();col(x,IC.ol);x.beginPath();x.moveTo(10,44);x.lineTo(14,34);x.lineTo(50,34);x.lineTo(54,44);x.closePath();x.fill();x.fillRect(22,24,20,11);
    col(x,IC.ol2);x.fillRect(40,27,22,4);col(x,IC.k);for(let i=0;i<5;i++){x.beginPath();x.arc(15+i*8.5,50,3.2,0,P2);x.fill()}}));
  css.push(icon('tab-pol',x=>{col(x,IC.b2);x.beginPath();x.arc(28,36,20,0,P2);x.fill();col(x,IC.g);x.beginPath();x.moveTo(14,26);x.bezierCurveTo(22,18,32,24,28,32);x.bezierCurveTo(24,40,14,36,12,44);x.bezierCurveTo(8,38,9,31,14,26);x.fill();
    x.beginPath();x.moveTo(32,42);x.bezierCurveTo(40,38,46,44,42,52);x.bezierCurveTo(38,56,32,52,32,42);x.fill();col(x,IC.s);x.fillRect(44,4,2.6,24);col(x,IC.r);x.beginPath();x.moveTo(46.6,4);x.lineTo(60,8);x.lineTo(46.6,13);x.fill()}));
  css.push(icon('tab-fleet',x=>{col(x,IC.s);x.beginPath();x.moveTo(4,40);x.lineTo(60,40);x.lineTo(52,52);x.lineTo(10,52);x.closePath();x.fill();col(x,'#d4dce4');x.fillRect(18,30,22,10);x.fillRect(24,20,10,10);col(x,IC.s2);x.fillRect(44,34,12,3);x.fillRect(27,12,3,8);
    col(x,IC.b2);x.fillRect(2,54,60,5);col(x,IC.b);x.fillRect(8,54,10,2);x.fillRect(30,56,12,2)}));
  css.push(icon('menu',x=>{for(let i=0;i<3;i++){x.fillRect(10,13+i*15,44,9)}col(x,'#c9c1aa');for(let i=0;i<3;i++)x.fillRect(10,19+i*15,44,3)}));
  css.push(icon('score',x=>{col(x,IC.r);x.beginPath();x.moveTo(18,4);x.lineTo(28,4);x.lineTo(34,24);x.lineTo(26,26);x.closePath();x.fill();col(x,IC.b2);x.beginPath();x.moveTo(46,4);x.lineTo(36,4);x.lineTo(30,24);x.lineTo(38,26);x.closePath();x.fill();
    col(x,IC.o);x.beginPath();x.arc(32,40,17,0,P2);x.fill();col(x,IC.y);x.beginPath();x.arc(32,40,12,0,P2);x.fill();col(x,IC.o);x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?3.6:8;x.lineTo(32+Math.cos(a)*r,40.5+Math.sin(a)*r)}x.closePath();x.fill()}));
  css.push(icon('store',x=>{const box=(bx,by,s)=>{col(x,IC.br);x.fillRect(bx,by,s,s);col(x,IC.br2);x.lineWidth=2.6;x.strokeRect(bx+1.5,by+1.5,s-3,s-3);x.beginPath();x.moveTo(bx+2,by+2);x.lineTo(bx+s-2,by+s-2);x.moveTo(bx+s-2,by+2);x.lineTo(bx+2,by+s-2);x.stroke()};box(6,34,24);box(32,34,24);box(19,10,24)}));
  css.push(icon('hint',x=>{col(x,IC.w);x.beginPath();x.arc(32,26,16,0,P2);x.fill();x.fillRect(24,36,16,10);col(x,IC.s);x.fillRect(24,46,16,5);x.fillRect(26,52,12,4);col(x,'#fffbe8');x.beginPath();x.arc(27,21,5,0,P2);x.fill();
    col(x,'#1b120c');x.lineWidth=2.6;for(const [a,b,c,d] of [[6,14,12,18],[58,14,52,18],[4,30,11,30],[60,30,53,30]]){x.beginPath();x.moveTo(a,b);x.lineTo(c,d);x.stroke()}}));
  css.push(icon('speed',x=>{col(x,IC.br);x.fillRect(12,6,40,6);x.fillRect(12,52,40,6);col(x,'#c8e6ff');x.beginPath();x.moveTo(17,12);x.lineTo(47,12);x.lineTo(34,32);x.lineTo(47,52);x.lineTo(17,52);x.lineTo(30,32);x.closePath();x.fill();
    col(x,IC.y);x.beginPath();x.moveTo(24,18);x.lineTo(40,18);x.lineTo(32,29);x.closePath();x.fill();x.beginPath();x.moveTo(32,38);x.lineTo(43,51);x.lineTo(21,51);x.closePath();x.fill()}));
  css.push(icon('warn',x=>{col(x,IC.y);x.beginPath();x.moveTo(32,6);x.lineTo(60,56);x.lineTo(4,56);x.closePath();x.fill();col(x,'#1b120c');x.fillRect(29,22,6,20);x.fillRect(29,46,6,6)}));
  css.push(icon('save',x=>{col(x,IC.b2);x.fillRect(8,8,48,48);col(x,IC.w);x.fillRect(18,8,26,16);col(x,IC.s);x.fillRect(16,34,32,22);col(x,IC.b2);x.fillRect(36,11,5,10)}));
  css.push(icon('move',x=>{col(x,IC.g);x.beginPath();x.moveTo(6,26);x.lineTo(34,26);x.lineTo(34,12);x.lineTo(58,32);x.lineTo(34,52);x.lineTo(34,38);x.lineTo(6,38);x.closePath();x.fill()}));
  css.push(icon('net',x=>{col(x,IC.s);x.lineWidth=3;for(let i=0;i<5;i++){x.beginPath();x.moveTo(8+i*12,8);x.lineTo(8+i*12,56);x.stroke();x.beginPath();x.moveTo(8,8+i*12);x.lineTo(56,8+i*12);x.stroke()}col(x,IC.r);x.fillRect(26,26,12,12)}));
  css.push(icon('hq',x=>{col(x,IC.w2);x.beginPath();x.moveTo(6,14);x.lineTo(22,8);x.lineTo(42,14);x.lineTo(58,8);x.lineTo(58,50);x.lineTo(42,56);x.lineTo(22,50);x.lineTo(6,56);x.closePath();x.fill();col(x,IC.g);x.beginPath();x.moveTo(10,20);x.lineTo(20,16);x.lineTo(26,30);x.lineTo(14,40);x.lineTo(10,38);x.closePath();x.fill();
    col(x,IC.r);x.lineWidth=4;x.beginPath();x.moveTo(16,46);x.quadraticCurveTo(28,24,44,26);x.stroke();x.beginPath();x.moveTo(50,26);x.lineTo(41,19);x.lineTo(42,33);x.closePath();x.fill();col(x,IC.b2);x.beginPath();x.arc(46,42,4,0,P2);x.fill()}));
  css.push(icon('con',x=>{for(const [bx,by] of [[6,36],[32,36],[19,14]]){col(x,'#c3c6c9');x.fillRect(bx,by,26,20);col(x,'#8e9296');x.fillRect(bx,by+16,26,4);x.fillRect(bx+20,by,6,20)}}));
  // the key (meander) band of the DroneFlames panels: one hook per 12 px, drawn at 3× for a zoomed HUD
  {const K=3,c=document.createElement('canvas');c.width=12*K;c.height=8*K;const x=c.getContext('2d');x.fillStyle='#3e412d';x.fillRect(0,0,c.width,c.height);x.fillStyle='#70764f';
    for(const [a,b,w,h] of [[0,7,12,1],[1,1,1,6],[1,1,8,1],[8,1,1,5],[4,5,5,1],[4,3,1,3],[4,3,3,1]])x.fillRect(a*K,b*K,w*K,h*K);css.push(`:root{--key:url(${c.toDataURL()})}`)}
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

// ---------------------------------------------------------------- main menu (stage 5.11: laid out as in DroneFlames)
// the logo: chunky Rubik Black letters with a dark outline and drop, an orange-to-yellow fill with a light top band
// and pixel rows, a wheat ear and a drone over the title — drawn in Canvas when the font is ready
function drawLogo(cv){const x=cv.getContext('2d'),W=cv.width,H=cv.height;x.clearRect(0,0,W,H);
  const word=(t,y,size,track)=>{x.font=`900 ${size}px Rubik, system-ui, sans-serif`;x.textBaseline='alphabetic';const ch=[...t],w=ch.map(c=>x.measureText(c).width),tot=w.reduce((a,b)=>a+b,0)+track*(ch.length-1);
    let cx=W/2-tot/2;const P=ch.map((c,i)=>{const p=cx;cx+=w[i]+track;return p});
    const each=f=>ch.forEach((c,i)=>f(c,P[i]));
    x.fillStyle='#160a04';each((c,p)=>x.fillText(c,p+2,y+size*0.1));x.lineJoin='round';x.strokeStyle='#160a04';x.lineWidth=size*0.2;each((c,p)=>x.strokeText(c,p,y));
    const L=document.createElement('canvas');L.width=W;L.height=H;const l=L.getContext('2d');l.font=x.font;l.textBaseline='alphabetic';
    const g=l.createLinearGradient(0,y-size*0.75,0,y+size*0.02);g.addColorStop(0,'#fff09a');g.addColorStop(0.3,'#ffc63a');g.addColorStop(0.62,'#f58a1c');g.addColorStop(1,'#b8380c');l.fillStyle=g;ch.forEach((c,i)=>l.fillText(c,P[i],y));
    l.globalCompositeOperation='source-atop';l.fillStyle='rgba(255,255,235,0.42)';l.fillRect(0,y-size*0.75,W,size*0.13);l.fillStyle='rgba(90,20,0,0.16)';for(let q=y-size*0.4;q<y;q+=4)l.fillRect(0,q,W,2);
    l.globalCompositeOperation='source-over';x.drawImage(L,0,0);x.strokeStyle='rgba(60,16,0,0.55)';x.lineWidth=2;each((c,p)=>x.strokeText(c,p,y))};
  word('WORLD',128,124,6);word('STARVATION',262,102,2);
  // wheat ear (left) and a quadcopter (right) above the first word
  x.save();x.translate(W*0.1,64);x.rotate(-0.35);x.lineWidth=5;x.strokeStyle='#160a04';x.beginPath();x.moveTo(0,46);x.lineTo(0,-30);x.stroke();x.lineWidth=2.4;x.strokeStyle='#ffd24a';x.beginPath();x.moveTo(0,46);x.lineTo(0,-30);x.stroke();
  for(let i=0;i<5;i++)for(const sd of [-1,1]){x.save();x.translate(0,-22+i*12);x.rotate(sd*0.55);x.fillStyle='#160a04';x.beginPath();x.ellipse(sd*8,0,10,5.6,0,0,P2);x.fill();x.fillStyle=i%2?'#ffcf3c':'#f2a52a';x.beginPath();x.ellipse(sd*8,0,8,4,0,0,P2);x.fill();x.restore()}x.restore();
  x.save();x.translate(W*0.9,50);const arm=(a)=>{x.save();x.rotate(a);x.fillStyle='#160a04';x.fillRect(-2,-30,4,30);x.beginPath();x.ellipse(0,-30,15,5,0,0,P2);x.fill();x.fillStyle='#e5743a';x.beginPath();x.ellipse(0,-30,12,3,0,0,P2);x.fill();x.restore()};
  for(const a of [0.8,-0.8,2.35,-2.35])arm(a);x.fillStyle='#160a04';x.fillRect(-14,-9,28,18);x.fillStyle='#f2a52a';x.fillRect(-11,-6,22,12);x.fillStyle='#ffe36a';x.fillRect(-11,-6,22,4);x.restore()}
function logoReady(){const cv=$('mm-logo');if(!cv)return;drawLogo(cv);if(document.fonts&&document.fonts.load)document.fonts.load('900 100px Rubik').then(()=>drawLogo(cv)).catch(()=>{})}
// «Что нового»: the changes of the latest stages (newest first)
const NEWS=[['5.13',['Карта больше не мерцает при подгрузке: новые участки плавно проявляются поверх старых','Растущая столица перерисовывается шагами, а не каждый кадр: меньше просадок FPS после основания','Ночные огни не пропадают при перерисовке города','F3: панель замера FPS']],['5.12',['Полёт камеры к столице и зум без провалов: участки карты и ночные огни в точке прилёта загружаются первыми — нет размытых квадратов','Облака и их тени не перерисовываются каждый кадр, пока камера движется, — выше FPS без потери качества','Карта собирается в 7 потоков на компьютерах с 8 ГБ памяти и больше']],['5.11',['Города растут по-разному: кольца и лучи вокруг площади, веер от площади, прямая сетка с диагональными бульварами, изогнутые и «старые» сетки; суперкварталы, микрорайоны, площади и скверы','Аэропорт: самолёты летают по рейсам — пассажирские в свои аэропорты и в страны с безвизом, грузовые — свои и на экспорт','Безвизовый режим в «Дипломатии»; война его отменяет','Железная дорога сама огибает города, постройки, горы и воду','Детали на площадках всех построек: склады, техника, грузы, стада, кучи руды','Пашня плавно переходит в лес через опушку; свет фонарей без пятен на перекрёстках','Главное меню, настройки и новая игра — в стиле DroneFlames']],
  ['5.10',['Облака снова в полном разрешении, FPS у облаков как у земли']],['5.9',['Сёла растут с закладки, разные планировки сёл','Слева «Штаб» и «Залежи»: список свободных залежей и постройка добычи в два клика','Значки залежей — булавки, свои постройки на миникарте']]];
function showNews(v){const w=$('news');if(!v){w.classList.remove('show');return}$('newsb').innerHTML=NEWS.map(([ver,L])=>`<div class="nw-v">Версия ${ver}</div><ul>${L.map(t=>`<li>${t}</li>`).join('')}</ul>`).join('');w.classList.add('show')}
function showMenu(){document.body.className='m-menu';logoReady();
  const L=Saves.latest(),cb=$('mm-cont');cb.disabled=!L;cb.style.display=L?'':'none';$('mm-cont-s').textContent=L?`${L.s.meta.name} · ${L.s.meta.day} · ячейка ${L.i}`:'Сохранений пока нет';
  $('mm-ver').textContent='v'+VERSION;
  if(!S.menuBg||bg){loaded();return}
  // the living background of the menu: the loading screen stays until its first tiles are drawn
  loading('Загрузка мира','Рельеф, города, дороги, заводы и порты');setTimeout(()=>{if(bg||!/m-(menu|setup|settings)/.test(document.body.className)){loaded();return}
    bg=startWorld({mode:'bg',seed:20261107,tod:17.4,view:Object.assign({labels:false,traffic:true,clouds:true},QV[S.quality]||QV.balance),onReady:()=>loaded()});$('ldt').textContent='Отрисовка карты'},80)}
function stopBg(){if(bg){bg.destroy();bg=null}}
function toMenu(){Game.exit();$('pause').classList.remove('show');$('over').classList.remove('show');showMenu()}
function menuGo(k){
  if(k==='new'){openSetup();return}
  if(k==='continue'){const L=Saves.latest();if(L){stopBg();C=L.s.cfg;C.slot=L.i;Game.load(L.s)}return}
  if(k==='tutorial'){stopBg();const c=defaultConfig();c.seed=777;c.tutorial=true;c.country.name='Учебная Республика';c.country.gov='Республика';c.map={type:'normal',size:0,rivers:2,lakes:1,mountains:1};
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
  const lv=[[0,'Нет'],[1,'Мало'],[2,'Норм'],[3,'Много']];seg($('mriv'),lv,m.rivers,v=>{m.rivers=v;preview()});seg($('mlak'),lv,m.lakes,v=>{m.lakes=v;preview()});if(m.mountains==null)m.mountains=1;seg($('mmnt'),[[0,'Мало'],[1,'Норм'],[2,'Много']],m.mountains,v=>{m.mountains=v;preview()});
  $('mseed').value=C.seed;$('mseed').onchange=()=>{const v=parseInt($('mseed').value);if(v>0){C.seed=v;preview()}else $('mseed').value=C.seed};
  $('mdice').onclick=()=>{C.seed=(Math.random()*1e9)|0;$('mseed').value=C.seed;const d=$('mdice');d.classList.remove('roll');void d.offsetWidth;d.classList.add('roll');preview()}}
function preview(){summary();if(!$('setup')||!document.body.classList.contains('m-setup'))return;clearTimeout(prevT);prevT=setTimeout(()=>{
  if(!prevWorker){const src=FlagArt.toString()+WorldGen.toString()+PREVIEW_SRC;prevWorker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
    prevWorker.onmessage=e=>{const m=e.data;if(m.id!==prevId)return;const c=$('mprev'),x=c.getContext('2d');const im=new ImageData(new Uint8ClampedArray(m.buf),m.n,m.n);
      const t=document.createElement('canvas');t.width=t.height=m.n;t.getContext('2d').putImageData(im,0,0);x.imageSmoothingEnabled=true;x.drawImage(t,0,0,c.width,c.height);
      x.strokeStyle='rgba(255,255,255,0.07)';x.lineWidth=1;x.beginPath();for(let i=1;i<6;i++){const p=i*c.width/6;x.moveTo(p,0);x.lineTo(p,c.height);x.moveTo(0,p);x.lineTo(c.width,p)}x.stroke();
      $('mp-wait').classList.remove('on');$('mp-info').innerHTML=`Суша ≈ ${Math.round(m.land*100)} % · ${Math.round(m.land*131*131)} км² · мир 131 × 131 км<br>Сид ${C.seed}. Мир пустой: города и дороги появятся с государствами.`}}
  $('mp-wait').classList.add('on');prevId++;prevWorker.postMessage({id:prevId,seed:C.seed,opt:{map:C.map.type,size:C.map.size,rivers:C.map.rivers,lakes:C.map.lakes,mountains:[0.25,0.42,0.7][C.map.mountains==null?1:C.map.mountains]},n:200})},120)}
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
  cards($('rvic'),[['points','По очкам','Первым набрать заданное число очков'],['time','По времени','Лидер по очкам к концу лимита'],['capitals','Захват столиц','Победит тот, кто удержит последнюю столицу']],r.victory,v=>{r.victory=v;$('rtarget-f').style.display=v==='points'?'':'none';summary()});
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
  head('Графика');{const e=document.createElement('div');e.className='seg';seg(e,[['high','Высокое'],['balance','Баланс'],['fast','Скорость']],S.quality,v=>{S.quality=v;saveS()});row('Качество','Чёткость кадра и плотность облаков. Применится при следующем запуске мира',e)}T('clouds','Облака','Облака и их тени над картой');T('traffic','Транспорт','Машины, поезда, суда и самолёты');T('labels','Подписи городов');T('menuBg','Живой фон главного меню','Отключите на слабом компьютере');
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
const TIPS=['Столица растёт сама: сначала прокладываются проспекты, потом стройплощадки, потом кварталы.','Колхоз ставится только в области села, нефтевышка — на месторождении нефти, лесопилка — у леса.',
  'Завод товаров — главный доход, но без энергии ТЭЦ он стоит.','Порт строится только на берегу моря с выходом в океан: он продаёт излишки и привозит нехватку.',
  'Сёла и города рядом сливают свои земли в одну область.','Пробел — пауза, F — скорость, 1–7 — вкладки нижней панели, Esc — меню паузы и сохранение.',
  'Боты начинают войны не раньше 10–12 минуты. ПВО сбивает их дроны, армия из военной части защищает земли.','Ненужную постройку можно снести: вкладка «Города» → «Снести», вернётся 30 % цены.','Туман войны прячет заводы, порты и базы соседей. Орлан-10 с пусковой рампы дронопорта раскрывает их.',
  'Солнечные панели — резерв энергии: аккумулятор держит заводы ночью и когда ТЭЦ подбита.','Железная дорога: поставьте вокзал, выберите «ЖД путь», нажмите на вокзал и, не отпуская, ведите линию.'];
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
paintIcons();applyS();if(document.fonts)document.fonts.load('700 12px Rubik').catch(()=>{}); // the HUD font, before the game starts
const U={viewOpts:()=>Object.assign({clouds:S.clouds,traffic:S.traffic,labels:S.labels,fps:S.fps},QV[S.quality]||QV.balance),settings:()=>S,pause,toMenu,loading,loaded};
Game.wire(U);
for(const b of document.querySelectorAll('.mm-b'))b.onclick=()=>menuGo(b.dataset.go);
$('mm-news').onclick=()=>showNews(!$('news').classList.contains('show'));$('newsx').onclick=()=>showNews(false);
for(const b of document.querySelectorAll('[data-back]'))b.onclick=()=>{if(document.body.classList.contains('m-settings'))closeSettings();else showMenu()};
$('screate').onclick=create;
$('presume').onclick=()=>pause(false);$('psave').onclick=()=>{Game.save(false);$('pinfo').textContent=Game.pauseInfo()};$('pset').onclick=()=>openSettings('game');
$('pexit').onclick=()=>{$('pause').classList.remove('show');paused=null;toMenu()};
addEventListener('resize',()=>{if(!$('loading').classList.contains('fade'))drawLdBg()});
addEventListener('keydown',e=>{if(e.code!=='Escape')return;if($('news').classList.contains('show')){showNews(false);return}if(document.body.classList.contains('m-settings')){closeSettings();return}if(document.body.classList.contains('m-setup'))showMenu()});
window.__ui={S,menuGo,openSetup,create,get C(){return C}};
const HS=location.hash.slice(1);
if(/^\d/.test(HS)||/^view/.test(HS)){document.body.className='m-view';loading('Загрузка мира','Режим просмотра · сид '+parseInt(HS));setTimeout(()=>startWorld({mode:'view',onReady:()=>loaded()}),60)}
else showMenu();
})();

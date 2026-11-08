// Flags of the states: patterns and emblems drawn procedurally in Canvas 2D.
// Self-contained (no outer references): its source is also sent to the tile workers, WorldGen uses it for flagpoles.
// Flag: {c:[c1,c2,c3] (#rrggbb), p: pattern, e: emblem, ec: emblem colour, ep: 0 centre / 1 canton}
function FlagArt(){
'use strict';
const M=Math,PI=M.PI,TAU=PI*2;
const PAT=['Однотонный','Две полосы','Три полосы','Три вертикальные','Скандинавский крест','Прямой крест','Диагональ','Треугольник у древка','Кайма','Четверти','Шеврон','Косой крест','Широкая полоса','Пять полос'];
const EMB=['Нет','Звезда','Полумесяц','Солнце','Круг','Щит','Орёл','Шестерня','Мечи','Венок','Молния','Корона'];
const PALETTE=['#c8102e','#e03c31','#7a1f2b','#f4f4f0','#111418','#1d3f8f','#0b5cad','#3a8fd8','#007a3d','#2e6b34','#7fb34b','#f2c230','#f08a24','#5b2a86','#8a5a2b','#9aa4ad'];
function star(x,cx,cy,r,n,ir){x.beginPath();for(let i=0;i<n*2;i++){const a=-PI/2+i*PI/n,rr=i%2?r*(ir||0.42):r;x.lineTo(cx+M.cos(a)*rr,cy+M.sin(a)*rr)}x.closePath();x.fill()}
function emblem(x,e,cx,cy,r,col,bg){x.fillStyle=col;x.strokeStyle=col;
  switch(e){
  case 1:star(x,cx,cy,r,5);break;
  case 2:x.beginPath();x.arc(cx-r*0.1,cy,r*0.9,0,TAU);x.fill();x.fillStyle=bg;x.beginPath();x.arc(cx+r*0.18,cy-r*0.05,r*0.76,0,TAU);x.fill();x.fillStyle=col;star(x,cx+r*0.55,cy-r*0.05,r*0.32,5);break;
  case 3:{x.beginPath();x.arc(cx,cy,r*0.45,0,TAU);x.fill();x.lineWidth=r*0.12;x.beginPath();for(let i=0;i<16;i++){const a=i*TAU/16,r0=r*0.58,r1=i%2?r*0.82:r;x.moveTo(cx+M.cos(a)*r0,cy+M.sin(a)*r0);x.lineTo(cx+M.cos(a)*r1,cy+M.sin(a)*r1)}x.stroke();break}
  case 4:x.beginPath();x.arc(cx,cy,r*0.8,0,TAU);x.fill();break;
  case 5:x.beginPath();x.moveTo(cx-r*0.75,cy-r*0.85);x.lineTo(cx+r*0.75,cy-r*0.85);x.lineTo(cx+r*0.75,cy-r*0.1);x.quadraticCurveTo(cx+r*0.7,cy+r*0.65,cx,cy+r);x.quadraticCurveTo(cx-r*0.7,cy+r*0.65,cx-r*0.75,cy-r*0.1);x.closePath();x.fill();
    x.fillStyle=bg;x.fillRect(cx-r*0.09,cy-r*0.6,r*0.18,r*1.2);x.fillRect(cx-r*0.45,cy-r*0.25,r*0.9,r*0.18);break;
  case 6:{ // stylised eagle: body, spread wings with feathers, head
    x.beginPath();x.ellipse(cx,cy+r*0.1,r*0.2,r*0.5,0,0,TAU);x.fill();x.beginPath();x.arc(cx,cy-r*0.52,r*0.17,0,TAU);x.fill();
    for(const sd of [-1,1]){x.beginPath();x.moveTo(cx+sd*r*0.12,cy-r*0.15);for(let i=0;i<5;i++){const t=i/4;x.lineTo(cx+sd*r*(0.35+t*0.62),cy-r*(0.75-t*0.55));x.lineTo(cx+sd*r*(0.3+t*0.55),cy-r*(0.5-t*0.6))}x.lineTo(cx+sd*r*0.15,cy+r*0.25);x.closePath();x.fill()}
    x.beginPath();x.moveTo(cx-r*0.2,cy+r*0.55);x.lineTo(cx,cy+r*0.95);x.lineTo(cx+r*0.2,cy+r*0.55);x.closePath();x.fill();break}
  case 7:{x.beginPath();for(let i=0;i<24;i++){const a=i*TAU/24,rr=(i>>1)%2?r*0.72:r*0.92;x.lineTo(cx+M.cos(a)*rr,cy+M.sin(a)*rr)}x.closePath();x.fill();x.fillStyle=bg;x.beginPath();x.arc(cx,cy,r*0.34,0,TAU);x.fill();break}
  case 8:{x.lineWidth=r*0.16;x.lineCap='round';x.beginPath();x.moveTo(cx-r*0.7,cy+r*0.7);x.lineTo(cx+r*0.7,cy-r*0.7);x.moveTo(cx+r*0.7,cy+r*0.7);x.lineTo(cx-r*0.7,cy-r*0.7);x.stroke();
    x.lineWidth=r*0.12;x.beginPath();x.moveTo(cx-r*0.62,cy+r*0.3);x.lineTo(cx-r*0.3,cy+r*0.62);x.moveTo(cx+r*0.62,cy+r*0.3);x.lineTo(cx+r*0.3,cy+r*0.62);x.stroke();x.lineCap='butt';break}
  case 9:{x.lineWidth=r*0.1;for(const sd of [-1,1]){x.beginPath();x.arc(cx,cy,r*0.78,PI/2+sd*0.25,PI/2+sd*2.6,sd<0);x.stroke();for(let i=0;i<7;i++){const a=PI/2+sd*(0.45+i*0.32),px=cx+M.cos(a)*r*0.78,py=cy+M.sin(a)*r*0.78;x.beginPath();x.ellipse(px,py,r*0.2,r*0.08,a+sd*0.9,0,TAU);x.fill()}}break}
  case 10:x.beginPath();x.moveTo(cx+r*0.25,cy-r);x.lineTo(cx-r*0.45,cy+r*0.1);x.lineTo(cx,cy+r*0.1);x.lineTo(cx-r*0.25,cy+r);x.lineTo(cx+r*0.45,cy-r*0.1);x.lineTo(cx,cy-r*0.1);x.closePath();x.fill();break;
  case 11:{x.beginPath();x.moveTo(cx-r*0.8,cy+r*0.45);x.lineTo(cx-r*0.9,cy-r*0.45);x.lineTo(cx-r*0.45,cy-r*0.05);x.lineTo(cx,cy-r*0.7);x.lineTo(cx+r*0.45,cy-r*0.05);x.lineTo(cx+r*0.9,cy-r*0.45);x.lineTo(cx+r*0.8,cy+r*0.45);x.closePath();x.fill();
    x.fillRect(cx-r*0.8,cy+r*0.55,r*1.6,r*0.22);break}
  }}
// draw a flag into rectangle (x0,y0,w,h)
function draw(x,fl,x0,y0,w,h){fl=fl||{};const c=fl.c||['#c8102e','#f4f4f0','#1d3f8f'];const [a,b,d]=c;x.save();x.beginPath();x.rect(x0,y0,w,h);x.clip();
  x.fillStyle=a;x.fillRect(x0,y0,w,h);
  const R=(px,py,pw,ph,col)=>{x.fillStyle=col;x.fillRect(x0+px*w,y0+py*h,pw*w,ph*h)};
  const P=(pts,col)=>{x.fillStyle=col;x.beginPath();for(let i=0;i<pts.length;i+=2)x.lineTo(x0+pts[i]*w,y0+pts[i+1]*h);x.closePath();x.fill()};
  let bg=a;
  switch(fl.p|0){
  case 1:R(0,0.5,1,0.5,b);bg=a;break;
  case 2:R(0,1/3,1,1/3,b);R(0,2/3,1,1/3,d);bg=b;break;
  case 3:R(1/3,0,1/3,1,b);R(2/3,0,1/3,1,d);bg=b;break;
  case 4:R(0.28,0,0.16,1,d);R(0,0.42,1,0.16,d);R(0.31,0,0.1,1,b);R(0,0.45,1,0.1,b);break;
  case 5:R(0.42,0,0.16,1,b);R(0,0.39,1,0.22,b);break;
  case 6:P([0,1,1,0,1,1],b);break;
  case 7:R(0,0.5,1,0.5,b);P([0,0,0.42,0.5,0,1],d);bg=d;break;
  case 8:R(0.08,0.12,0.84,0.76,b);bg=b;break;
  case 9:R(0.5,0,0.5,0.5,b);R(0,0.5,0.5,0.5,b);R(0.5,0.5,0.5,0.5,d);break;
  case 10:P([0,0,0.5,0.5,0,1,0,0.78,0.28,0.5,0,0.22],b);P([0,0.22,0.28,0.5,0,0.78],d);break;
  case 11:x.strokeStyle=b;x.lineWidth=h*0.2;x.beginPath();x.moveTo(x0,y0);x.lineTo(x0+w,y0+h);x.moveTo(x0+w,y0);x.lineTo(x0,y0+h);x.stroke();x.strokeStyle=d;x.lineWidth=h*0.07;x.stroke();break;
  case 12:R(0,0.25,1,0.5,b);bg=b;break;
  case 13:for(let i=1;i<5;i+=2)R(0,i/5,1,1/5,b);R(0,0,0.4,0.6,d);bg=d;break;
  }
  if(fl.e){const can=fl.ep===1||(fl.p|0)===13;const cx=can?x0+w*0.2:(fl.p|0)===7?x0+w*0.15:(fl.p|0)===10?x0+w*0.13:x0+w/2,cy=can?y0+h*0.3:y0+h/2,r=h*(can?0.2:0.3);
    emblem(x,fl.e,cx,cy,r,fl.ec||'#f2c230',bg)}
  // cloth sheen
  const g=x.createLinearGradient(x0,y0,x0+w,y0+h);g.addColorStop(0,'rgba(255,255,255,0.1)');g.addColorStop(0.5,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,0.12)');x.fillStyle=g;x.fillRect(x0,y0,w,h);
  x.restore()}
const lum=h=>{const n=parseInt(h.slice(1),16);return ((n>>16)&255)*0.3+((n>>8)&255)*0.59+(n&255)*0.11};
function random(R){R=R||M.random;const pick=a=>a[(R()*a.length)|0];const c=[];let t=0;while(c.length<3&&t++<200){const q=pick(PALETTE);if(c.includes(q)||q==='#8a5a2b'&&R()<0.8)continue;if(c.length&&M.abs(lum(q)-lum(c[c.length-1]))<60)continue;c.push(q)}while(c.length<3)c.push(pick(PALETTE))
  const ec=pick(PALETTE.filter(q=>!c.includes(q)||q==='#f2c230'));return {c,p:(R()*PAT.length)|0,e:R()<0.65?1+((R()*(EMB.length-1))|0):0,ec,ep:R()<0.3?1:0}}
return {draw,random,PAT,EMB,PALETTE};
}

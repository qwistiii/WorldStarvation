# stage 6, phase 6: one light direction. The cars, trucks, buses and ships had their shadows painted into the sprite in
# its own frame, so the shadow turned with the vehicle (a car heading west cast it to the north-west). Now the sprites are
# clean and the shadow is a separate footprint sprite shifted along the world sun vector (traffic: SUNX/SUNY; parked in
# tiles: SDX/SDY — the sun in the frame of the zone), as the military vehicles and buildings already did.
import sys
def patch(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        k = s.count(a)
        if k != 1:
            sys.exit(f'{p}: expected 1 got {k}: {a[:90]!r}')
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8').write(s)

patch('src/gen.js', [
("""  // soft shadow
  x.fillStyle='rgba(0,0,0,0.16)';rr(x,L0+1.6,T+1.4,L1-L0,W+0.6,6.5);x.fill();x.fillStyle='rgba(0,0,0,0.18)';rr(x,L0+0.8,T+0.7,L1-L0,W,6);x.fill();""",
 """  // (stage 6: the soft shadow is the separate sprite carSh, laid along the sun where the car is drawn)"""),
("""function mkTruck(v){const cv=mkCanvas(340,68),x=cv.getContext('2d');x.scale(2,2);const tc=[[235,235,235],[200,60,40],[40,90,160],[220,200,60],[90,100,90]][v];
  x.fillStyle='rgba(0,0,0,0.3)';x.fillRect(6,7,162,25);""",
 """// footprint shadows of the vehicles, in the frame of their sprites (centred, no offset: it goes along the sun when drawn)
function mkCarSh(){const K=4,cv=mkCanvas(50*K,25*K),x=cv.getContext('2d');x.scale(K,K);const L0=3,L1=47,T=3.6,B=21.4,W=B-T;
  x.fillStyle='rgba(0,0,0,0.16)';rr(x,L0-0.4,T-0.3,L1-L0+0.8,W+0.6,7);x.fill();x.fillStyle='rgba(0,0,0,0.18)';rr(x,L0,T,L1-L0,W,6);x.fill();return cv}
function mkBoxSh(w,h,bx,by,bw,bh,a){const cv=mkCanvas(w,h),x=cv.getContext('2d');x.scale(2,2);x.fillStyle=`rgba(0,0,0,${a})`;x.fillRect(bx,by,bw,bh);return cv}
function mkTruck(v){const cv=mkCanvas(340,68),x=cv.getContext('2d');x.scale(2,2);const tc=[[235,235,235],[200,60,40],[40,90,160],[220,200,60],[90,100,90]][v];"""),
("""function mkBus(){const cv=mkCanvas(250,60),x=cv.getContext('2d');x.scale(2,2);x.fillStyle='rgba(0,0,0,0.3)';x.fillRect(5,6,118,23);""",
 """function mkBus(){const cv=mkCanvas(250,60),x=cv.getContext('2d');x.scale(2,2);"""),
("""  for(let v=0;v<5;v++)SPR.truck.push(mkTruck(v));SPR.bus=mkBus();return SPR}""",
 """  for(let v=0;v<5;v++)SPR.truck.push(mkTruck(v));SPR.bus=mkBus();
  SPR.carSh=mkCarSh();SPR.truckSh=mkBoxSh(340,68,3,4,162,25,0.3);SPR.busSh=mkBoxSh(250,60,2,3,118,23,0.3);return SPR}
// sun offset of a vehicle's footprint shadow, metres along the sun per kind (the old painted offsets: car 0.16 m, truck and bus 0.3 m)
const VSH={car:0.27,truck:0.55,bus:0.55};"""),
# parked buses, trucks and cars in the tiles
("""    for(let rw=0;rw<rows;rw++)for(let q=0;q<n;q++){if(r()>p.fill)continue;ctx.save();if(hor){ctx.translate(p.x+q*4+2,p.y+rw*14+7);ctx.rotate(PI/2)}else{ctx.translate(p.x+rw*14+7,p.y+q*4+2)}ctx.drawImage(S.bus,-6.25,-1.5,12.5,3);ctx.restore()}return}""",
 """    for(let rw=0;rw<rows;rw++)for(let q=0;q<n;q++){if(r()>p.fill)continue;const cx=hor?p.x+q*4+2:p.x+rw*14+7,cy=hor?p.y+rw*14+7:p.y+q*4+2;
      for(const sh of [1,0]){ctx.save();ctx.translate(cx+(sh?SDX*VSH.bus:0),cy+(sh?SDY*VSH.bus:0));if(hor)ctx.rotate(PI/2);ctx.drawImage(sh?S.busSh:S.bus,-6.25,-1.5,12.5,3);ctx.restore()}}return}"""),
("""  if(p.truck){const n=hor?M.floor(p.w/4.2):M.floor(p.h/4.2);for(let q=0;q<n;q++){if(r()>p.fill)continue;const spr=S.truck[r()*5|0];ctx.save();if(hor){ctx.translate(p.x+q*4.2+2.1,p.y+p.h/2);ctx.rotate(PI/2)}else{ctx.translate(p.x+p.w/2,p.y+q*4.2+2.1)}
      const L=M.min(17,hor?p.h:p.w);ctx.drawImage(spr,-L/2,-2.1,L,4.2);ctx.restore()}return}""",
 """  if(p.truck){const n=hor?M.floor(p.w/4.2):M.floor(p.h/4.2);for(let q=0;q<n;q++){if(r()>p.fill)continue;const spr=S.truck[r()*5|0];const cx=hor?p.x+q*4.2+2.1:p.x+p.w/2,cy=hor?p.y+p.h/2:p.y+q*4.2+2.1;
      const L=M.min(17,hor?p.h:p.w);for(const sh of [1,0]){ctx.save();ctx.translate(cx+(sh?SDX*VSH.truck:0),cy+(sh?SDY*VSH.truck:0));if(hor)ctx.rotate(PI/2);ctx.drawImage(sh?S.truckSh:spr,-L/2,-2.1,L,4.2);ctx.restore()}}return}"""),
("""    ctx.save();if(hor){ctx.translate(p.x+a+1.3,p.y+rw*5.4+2.5);ctx.rotate(fl?PI/2:-PI/2)}else{ctx.translate(p.x+rw*5.4+2.5,p.y+a+1.3);if(fl)ctx.rotate(PI)}
    ctx.drawImage(spr,-2.5,-1.25,5,2.5);ctx.restore()}}}""",
 """    const cx=hor?p.x+a+1.3:p.x+rw*5.4+2.5,cy=hor?p.y+rw*5.4+2.5:p.y+a+1.3;
    for(const sh of [1,0]){ctx.save();ctx.translate(cx+(sh?SDX*VSH.car:0),cy+(sh?SDY*VSH.car:0));if(hor)ctx.rotate(fl?PI/2:-PI/2);else if(fl)ctx.rotate(PI);ctx.drawImage(sh?S.carSh:spr,-2.5,-1.25,5,2.5);ctx.restore()}}}}"""),
# trucks at the loading docks
("""      if(u[0]===4&&(u[3]&1)){const S=sprites(),a=(u[1]+u[2])/2;ctx.save();ctx.translate(GA+GEX*a+GNX*0.35,GB+GEY*a+GNY*0.35);ctx.rotate(M.atan2(GNY,GNX));ctx.drawImage(S.truck[(u[3]>>>3)%5],0,-2.1,17,4.2);ctx.restore()}""",
 """      if(u[0]===4&&(u[3]&1)){const S=sprites(),a=(u[1]+u[2])/2;for(const sh of [1,0]){ctx.save();ctx.translate(GA+GEX*a+GNX*0.35+(sh?SDX*VSH.truck:0),GB+GEY*a+GNY*0.35+(sh?SDY*VSH.truck:0));ctx.rotate(M.atan2(GNY,GNX));ctx.drawImage(sh?S.truckSh:S.truck[(u[3]>>>3)%5],0,-2.1,17,4.2);ctx.restore()}}"""),
# ships: the hull without its shadow (main.js lays the shadow along the sun)
("""function drawShip(x,len,st,ci){ // local frame metres, facing +x, centred
  const w=len*(st===2?0.16:0.14),h=len/2;
  x.fillStyle='rgba(0,10,20,0.35)';x.beginPath();""",
 """function drawShip(x,len,st,ci,noSh){ // local frame metres, facing +x, centred; noSh: without the shadow (stage 6: drawn along the sun)
  const w=len*(st===2?0.16:0.14),h=len/2;
  if(!noSh){x.fillStyle='rgba(0,10,20,0.35)';x.beginPath();"""),
("""x.lineTo(-h+4,w/2+4);x.closePath();x.fill();
  const hull=""", """x.lineTo(-h+4,w/2+4);x.closePath();x.fill()}
  const hull="""),
])

patch('src/main.js', [
("""const S={car:S0.car.map(SP),carLo:S0.carLo.map(SP),truck:S0.truck.map(SP),bus:SP(S0.bus)};""",
 """const S={car:S0.car.map(SP),carLo:S0.carLo.map(SP),truck:S0.truck.map(SP),bus:SP(S0.bus),carSh:SP(S0.carSh),truckSh:SP(S0.truckSh),busSh:SP(S0.busSh)};"""),
("""          setRot(X,Y,hx,hy,k);
          if(truck){ctx.drawImage(S.truck[(hq>>>17)%5],-8.5,-2.1,17,4.25)}""",
 """          // the footprint shadow along the sun (one light direction for everything), then the vehicle
          {const so=truck||bus?0.55:0.27;setRot(X+W.SUNX*so*k,Y+W.SUNY*so*k,hx,hy,k);if(truck)ctx.drawImage(S.truckSh,-8.5,-2.1,17,4.25);else if(bus)ctx.drawImage(S.busSh,-6.25,-1.5,12.5,3);else ctx.drawImage(S.carSh,-2.5,-1.25,5,2.5)}
          setRot(X,Y,hx,hy,k);
          if(truck){ctx.drawImage(S.truck[(hq>>>17)%5],-8.5,-2.1,17,4.25)}"""),
("""x.scale(ps,ps);x.translate(h+3,w/2+3);W.drawShip(x,L,st,c);""", """x.scale(ps,ps);x.translate(h+3,w/2+3);W.drawShip(x,L,st,c,true);"""),
("""    const sp=shipSprite(L,sh.st,sh.c,m);ctx.drawImage(sp.r,sp.ox,sp.oy,sp.w,sp.h)}""",
 """    const sp=shipSprite(L,sh.st,sh.c,m);
    // the hull's shadow along the sun (it was painted 4 m to the hull's own starboard-aft and turned with the ship)
    setRot(sxw(x+W.SUNX*6.4),syw(y+W.SUNY*6.4),hx,hy,k);ctx.tint=SHIPSH;ctx.globalAlpha=0.35;ctx.drawImage(sp.r,sp.ox,sp.oy,sp.w,sp.h);ctx.tint=null;ctx.globalAlpha=1;
    setRot(X,Y,hx,hy,k);ctx.drawImage(sp.r,sp.ox,sp.oy,sp.w,sp.h)}"""),
("""const CTR=[1,1,1,1],NAVR=""", """const SHIPSH=[0,10/255,20/255,1],CTR=[1,1,1,1],NAVR="""),
])
print('ok')

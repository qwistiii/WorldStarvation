# stage 6, phase 7: light sources in the game — the street lamp the player builds (auto / on / off), the floodlights of
# every building yard (all states; hidden by the fog of war with their building)
import sys
def patch(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        k = s.count(a)
        if k != 1:
            sys.exit(f'{p}: expected 1 got {k}: {a[:90]!r}')
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8').write(s)

patch('src/game.js', [
# the building
("""  dronefab:{n:'Цех БПЛА',""",
 """  // stage 6: a street lamp — a point object (no grounds): lights the ground around it at night
  lamp:{n:'Фонарь',cost:60,time:3,d:'Уличный фонарь (8 м): ночью освещает землю и всё вокруг в радиусе 34 м. Режимы: авто (по времени суток), вкл, выкл',area:'own',point:1,r:34},
  dronefab:{n:'Цех БПЛА',"""),
("""const ECON=['city','village','farm','factory','power','solar','mine','sawmill','oil','gaswell','refinery','port','airport','station'];""",
 """const ECON=['city','village','farm','factory','power','solar','mine','sawmill','oil','gaswell','refinery','port','airport','station','lamp'];"""),
("""const SHORT={city:'Город',""", """const SHORT={lamp:'Фонарь',city:'Город',"""),
# where a lamp may stand: own land, not water, not on a building, not on another lamp
("""  const a=ang!=null?ang:k==='station'?stationAng(s,x,y):0;""",
 """  if(b.point){if(W.landE(x,y,0.002)<0)return 'Здесь вода';if(ownerAt(x,y)!==s.id+1)return 'Только на своей территории';
    for(const z of W.zones)if(!z.dead&&rectHit(z,x,y,2,2))return 'Здесь постройка';for(const q of s.builds)if(q.k==='lamp'&&M.hypot(q.x-x,q.y-y)<10)return 'Рядом уже стоит фонарь';return null}
  const a=ang!=null?ang:k==='station'?stationAng(s,x,y):0;"""),
# finished: a lamp is a light, not a zone
("""  const b=BLD[q.k];
  if(q.k==='city'||q.k==='village'){let p=s.places.find(o=>o.bq===q.uid);""",
 """  const b=BLD[q.k];lightsDirty=true;
  if(b.point){q.id=-1;q.on=q.on||'auto';if(s.isP){toast(`Построено: <b>${b.n}</b>`,'ic-b-'+q.k);onBuilt(q.k,true)}return}
  if(q.k==='city'||q.k==='village'){let p=s.places.find(o=>o.bq===q.uid);"""),
("""  const a=s.armies.find(x=>x.home===q);if(a)s.armies.splice(s.armies.indexOf(a),1);if(s.res.money!==Infinity)s.res.money+=cost*0.3;""",
 """  lightsDirty=true;const a=s.armies.find(x=>x.home===q);if(a)s.armies.splice(s.armies.indexOf(a),1);if(s.res.money!==Infinity)s.res.money+=cost*0.3;"""),
# a lamp is picked by its foot
("""function ownBuildAt(x,y){for(const q of player().builds){if(!q.done||q.id<0||q.k==='rail')continue;""",
 """function ownBuildAt(x,y){for(const q of player().builds){if(q.done&&q.k==='lamp'&&M.hypot(q.x-x,q.y-y)<M.max(8,16*api.cam.m))return q;if(!q.done||q.id<0||q.k==='rail')continue;"""),
# the card of a selected lamp: its mode
("""  if(q.k==='barracks')keys+=card({id:'a-army',""",
 """  if(q.k==='lamp'){const md=q.on||'auto';g+=stat('Режим',{auto:'авто — по времени суток',on:'включён',off:'выключен'}[md])+stat('Высота · радиус света','8 м · '+BLD.lamp.r+' м');
    for(const [m,n] of [['auto','Авто'],['on','Вкл'],['off','Выкл']])keys+=card({n,sub:m===md?'сейчас':'',ic:'ic-b-lamp',data:`data-lmode="${m}"`,cls:m===md?'on':'',tip:{auto:'Горит ночью, гаснет на рассвете',on:'Горит всегда',off:'Не горит'}[m]})}
  if(q.k==='barracks')keys+=card({id:'a-army',"""),
("""  for(const e of el.querySelectorAll('[data-mod]'))e.onclick=""",
 """  for(const e of el.querySelectorAll('[data-lmode]'))e.onclick=()=>{q.on=e.dataset.lmode;const l=api.lights.get(q.uid*8);if(l)api.lights.setMode(l.id,q.on);panelSig='';updPanel()};
  for(const e of el.querySelectorAll('[data-mod]'))e.onclick="""),
# the ghost of a lamp shows the reach of its light
("""else{const r=M.max(10,(k==='city'?b.R:320)/m);ctx.beginPath();ctx.arc(X,Y,r,0,7);ctx.fill();ctx.stroke()}""",
 """else{const r=M.max(10,(k==='city'?b.R:b.point?b.r:320)/m);ctx.beginPath();ctx.arc(X,Y,r,0,7);ctx.fill();ctx.stroke()}"""),
("""if(PL.grab(x,y,(b.R||(b.W?M.max(b.W,b.H)/2:320))+16*api.cam.m))return true}""",
 """if(PL.grab(x,y,(b.R||(b.W?M.max(b.W,b.H)/2:b.point?12:320))+16*api.cam.m))return true}"""),
# the lights of the world follow the builds (on the next frame after a change, a load or a new world)
("""function placeDone(keep){""",
 """// ---------- light sources (stage 6): built from the finished builds of all states — the lamps of the player, the
// floodlights of every yard (at its corners, one mast for a small one). Ids are stable (uid*8 + n), so a light keeps its
// level (no flicker) when the set is rebuilt
let lightsDirty=true;
function syncLights(){if(!api||!api.lights||!G)return;const L=api.lights,prev=new Map(L.all().map(l=>[l.id,l.lv]));L.clear();
  for(const s of G.states)for(const q of s.builds){if(!q.done)continue;
    if(q.k==='lamp'){L.add({id:q.uid*8,x:q.x,y:q.y,kind:'lamp',mode:q.on||'auto',owner:'b'+q.uid});continue}
    if(q.id<0||q.k==='rail')continue;const z=W.zones[q.id],b=BLD[q.k];if(!z||z.dead||!b||!b.zk)continue;
    const hw=z.W/2+5,hh=z.H/2+5,pts=z.W*z.H>60000?[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]]:[[hw,hh]],r=M.min(80,42+M.sqrt(z.W*z.H)/25);
    pts.forEach(([u,v],i)=>L.add({id:q.uid*8+1+i,x:z.x+u*z.ca-v*z.sa,y:z.y+u*z.sa+v*z.ca,kind:'flood',owner:q.id,r}))}
  for(const l of L.all())if(prev.has(l.id))l.lv=prev.get(l.id)}
function placeDone(keep){"""),
("""  frame(dt){if(!G||G.over&&G.speed===0){return}""", """  frame(dt){if(lightsDirty&&G&&api&&api.lights){lightsDirty=false;syncLights()}if(!G||G.over&&G.speed===0){return}"""),
("""function boot(caps,onReady,ops){if(api){api.destroy();api=null}""", """function boot(caps,onReady,ops){if(api){api.destroy();api=null}lightsDirty=true;"""),
# test hooks
("""PL,setBuild,placeTap,placeConfirm,""", """PL,setBuild,placeTap,placeConfirm,syncLights,""",),
])

patch('src/ui.js', [
("""  css.push(icon('mine',x=>{""",
 """  // stage 6: the street lamp — a pole with an arm and a lit head
  css.push(icon('lamp',x=>{col(x,IC.s2);x.fillRect(18,14,5,42);x.fillRect(12,54,17,4);x.lineWidth=4;x.beginPath();x.moveTo(20,16);x.quadraticCurveTo(22,8,36,10);x.stroke();
    col(x,IC.k);x.fillRect(32,9,14,6);col(x,IC.y);x.beginPath();x.moveTo(33,15);x.lineTo(45,15);x.lineTo(42,20);x.lineTo(36,20);x.closePath();x.fill();
    x.globalAlpha=0.45;x.beginPath();x.moveTo(34,20);x.lineTo(44,20);x.lineTo(54,52);x.lineTo(24,52);x.closePath();x.fill();x.globalAlpha=1},1));
  css.push(icon('mine',x=>{"""),
])
print('ok')

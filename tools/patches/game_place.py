# stage 6, phase 4: building placement through src/place.js (ghost, rotation, confirm / cancel, touch)
import sys
p = 'src/game.js'
s = open(p, encoding='utf8').read()
def R(a, b, cnt=1):
    global s
    k = s.count(a)
    if k != cnt:
        sys.exit(f'patch: expected {cnt} got {k}: {a[:90]!r}')
    s = s.replace(a, b)

# startBuild keeps the angle of any rotated zone building
R("""  if(k==='station')q.a=ang!=null?ang:stationAng(s,x,y);""",
"""  if(k==='station')q.a=ang!=null?ang:stationAng(s,x,y);else if(ang!=null&&b.zk&&ang)q.a=ang;""")

# the placement machine and its HUD bar
R("""function setBuild(k){if(!G||G.phase!=='play')return;G.build=k;if(k){G.mode=null;railDrag=null}if(!k||!BLD[k].mod&&k!=='solar')G.forPort=null;document.body.classList.toggle('placing',!!k);if(k){const t=tabOf(k);if(t&&t!==tab)setTab(t)}updCatalog()}""",
"""// ---------- placement (stage 6): src/place.js keeps the ghost, its angle and the touch confirmation
// which buildings turn: the zones; a port is laid along its coast, a station along the tracks, towns are round
const rotK=k=>!!(BLD[k]&&BLD[k].zk)&&k!=='port'&&k!=='station';
let lastTouch=false,shiftDown=false;
const PL=Placement({check:(k,x,y,a)=>canBuild(player(),k,x,y,rotK(k)?a:undefined),rotates:rotK,onChange:()=>updPbar(),
  build:(k,x,y,a)=>{const p=player();if(p.res.money<BLD[k].cost&&!creative())return 'Не хватает денег: нужно '+fmt(BLD[k].cost);return startBuild(p,k,x,y,rotK(k)?a:undefined)?true:'Не удалось начать стройку'}});
// after a building was placed: leave the mode (unless Shift keeps it), back to the drone port card for its modules
function placeDone(keep){const fp=G.forPort;if(!keep)setBuild(null);if(fp&&!keep){G.sel={build:fp};panelSig=''}updHUD();updPbar()}
function placeTap(x,y){const r=PL.tap(x,y,lastTouch,shiftDown&&!lastTouch);if(r==='built')placeDone(shiftDown&&!lastTouch);else if(r==='bad'&&PL.state.bad&&!lastTouch)toast(PL.state.bad);return r}
function placeConfirm(){const r=PL.confirm(false);if(r==='built')placeDone(false);else if(r==='bad'&&PL.state.bad)toast(PL.state.bad);return r}
// the bar of the armed building (as the hint box of DroneFlames): name and price, what to do or why not, ⟲ ✓ ✕
function updPbar(){const el=$('pbar');if(!el)return;const k=G&&G.phase==='play'?G.build:null;el.classList.toggle('show',!!k);document.body.classList.toggle('placing-k',!!k);if(!k)return;const S=PL.state,b=BLD[k];
  el.classList.toggle('touch',!!S.touch);el.classList.toggle('bad',!!(S.has&&S.bad));$('pbi').className='ic ic-b-'+k;$('pbt').textContent=b.n+' ('+fmt(b.cost)+')';
  $('pbs').textContent=S.has&&S.bad?S.bad:S.touch?(S.has?'Нажмите ✓, чтобы построить. Перетащите метку или коснитесь другого места':'Коснитесь карты, где поставить'):'Клик — построить · R — повернуть · Shift+клик — ещё одну · Esc или ПКМ — отмена';
  $('pbrot').hidden=!rotK(k);$('pbok').disabled=!(S.has&&!S.bad)}
function setBuild(k){if(!G||G.phase!=='play')return;G.build=k;if(k){G.mode=null;railDrag=null}if(!k||!BLD[k].mod&&k!=='solar')G.forPort=null;document.body.classList.toggle('placing',!!k);if(k){const t=tabOf(k);if(t&&t!==tab)setTab(t)}
  if(k){if(PL.state.k!==k){const c=api.toWorld(api.VW/2,api.VH*0.45);PL.select(k,lastTouch,c[0],c[1])}}else PL.cancel();updPbar();updCatalog()}""")

# click on the map while a building is armed
R("""    if(G.build){const k=G.build,p=player(),bad=canBuild(p,k,x,y);if(bad){toast(bad);return true}if(p.res.money<BLD[k].cost&&!creative()){toast('Не хватает денег: нужно '+fmt(BLD[k].cost));return true}startBuild(p,k,x,y);const fp=G.forPort;setBuild(null);if(fp){G.sel={build:fp};panelSig=''}updHUD();return true}""",
"""    if(G.build){placeTap(x,y);return true}""")

# touch: a press on the ghost moves it instead of the map
R("""  pdown(x,y,sx,sy){if(!G||G.phase!=='play'||G.mode!=='rail')return false;""",
"""  pdown(x,y,sx,sy){if(G&&G.phase==='play'&&G.build&&lastTouch){const b=BLD[G.build];if(PL.grab(x,y,(b.R||M.hypot(b.W||600,b.H||600)/2)+44*api.cam.m))return true}
    if(!G||G.phase!=='play'||G.mode!=='rail')return false;""")
R("""  pmove(x,y,sx,sy){if(railDrag){""", """  pmove(x,y,sx,sy){if(PL.state.drag){PL.move(x,y);return}if(railDrag){""")
R("""  pup(x,y,sx,sy,cancel){if(!railDrag)return;""", """  pup(x,y,sx,sy,cancel){if(PL.state.drag){PL.release();return}if(!railDrag)return;""")

# keys: R turns, Enter builds
R("""    if(G.phase!=='play')return false;if(e.code==='Space'||e.code==='KeyP'){""",
"""    if(G.phase!=='play')return false;if(G.build&&e.code==='KeyR'){PL.rotate(1,e.shiftKey);return true}if(G.build&&(e.code==='Enter'||e.code==='NumpadEnter')){placeConfirm();return true}
    if(e.code==='Space'||e.code==='KeyP'){""")

# the ghost: the footprint turned by the angle; on touch it stands where it was put, with a handle
R("""  if(G.build&&A.hover.on){const [x,y]=A.toWorld(A.hover.x,A.hover.y),k=G.build,b=BLD[k],bad=canBuild(player(),k,x,y),X=A.hover.x,Y=A.hover.y;ctx.save();""",
"""  if(G.build&&!PL.state.touch&&A.hover.on){const [hx,hy]=A.toWorld(A.hover.x,A.hover.y);PL.hover(hx,hy)}
  if(G.build&&PL.state.has){const S=PL.state,x=S.x,y=S.y,k=G.build,b=BLD[k],bad=S.bad,X=A.sxw(x),Y=A.syw(y);ctx.save();""")
R("""    if(b.zk){const w=M.max(8,b.W/m),h=M.max(8,b.H/m),an=k==='station'?stationAng(player(),x,y):0;ctx.save();ctx.translate(X,Y);ctx.rotate(an);ctx.beginPath();ctx.rect(-w/2,-h/2,w,h);ctx.fill();ctx.stroke();ctx.restore()}""",
"""    if(b.zk){const w=M.max(8,b.W/m),h=M.max(8,b.H/m),an=k==='station'?stationAng(player(),x,y):rotK(k)?S.ang:0;ctx.save();ctx.translate(X,Y);ctx.rotate(an);ctx.beginPath();ctx.rect(-w/2,-h/2,w,h);ctx.fill();ctx.stroke();
      // the front of the building (its gate side) — so the angle reads
      if(rotK(k)){ctx.setLineDash([]);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-w/2,h/2);ctx.lineTo(w/2,h/2);ctx.stroke()}ctx.restore()}""")
R("""    ctx.setLineDash([]);ctx.drawImage(bIcon(k),X-12,Y-12,24,24);const t=bad||b.n+' · '+fmt(b.cost);ctx.font='600 12px system-ui,sans-serif';ctx.textAlign='left';const w=ctx.measureText(t).width+16;
    ctx.fillStyle='rgba(10,15,23,0.88)';ctx.fillRect(X+16,Y+14,w,22);ctx.fillStyle=bad?'#ff9c8e':'#9fe3aa';ctx.fillText(t,X+24,Y+25);ctx.restore()}""",
"""    ctx.setLineDash([]);
    // touch: a round handle to drag the ghost (the name and the reason are in the placement bar)
    if(S.touch){ctx.lineWidth=2;ctx.strokeStyle=bad?'rgba(255,140,120,0.95)':'rgba(255,255,255,0.95)';ctx.fillStyle='rgba(10,15,23,0.6)';ctx.beginPath();ctx.arc(X,Y,22,0,7);ctx.fill();ctx.stroke()}
    ctx.drawImage(bIcon(k),X-12,Y-12,24,24);
    if(!S.touch){const t=bad||b.n+' · '+fmt(b.cost);ctx.font='600 12px system-ui,sans-serif';ctx.textAlign='left';const w=ctx.measureText(t).width+16;
      ctx.fillStyle='rgba(10,15,23,0.88)';ctx.fillRect(X+16,Y+14,w,22);ctx.fillStyle=bad?'#ff9c8e':'#9fe3aa';ctx.fillText(t,X+24,Y+25)}ctx.restore()}""")

# tooltip: mouse only (touch fires mouseover after a tap and the box stayed); pointer type and Shift are tracked
R("""  const tip=$('ktip');document.addEventListener('mouseover',e=>{const k=e.target.closest&&e.target.closest('[data-tn]');if(!k){tip.classList.remove('show');return}""",
"""  document.addEventListener('pointerdown',e=>{lastTouch=e.pointerType==='touch'||e.pointerType==='pen'},true);
  addEventListener('keydown',e=>{if(e.key==='Shift')shiftDown=true});addEventListener('keyup',e=>{if(e.key==='Shift')shiftDown=false});addEventListener('blur',()=>{shiftDown=false});
  // the right mouse button cancels the armed building (as Esc)
  $('c').addEventListener('contextmenu',e=>{e.preventDefault();if(G&&G.build){setBuild(null)}else if(G&&G.mode){G.mode=null;railDrag=null;updCatalog()}});
  $('pbrot').onclick=()=>PL.rotate(1,lastTouch);$('pbok').onclick=()=>placeConfirm();$('pbno').onclick=()=>setBuild(null);
  const tip=$('ktip');document.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse'){tip.classList.remove('show');return}const k=e.target.closest&&e.target.closest('[data-tn]');if(!k){tip.classList.remove('show');return}""")

# test hooks
R("""canBuild:(k,x,y)=>canBuild(player(),k,x,y),startBuild:(k,x,y)=>startBuild(player(),k,x,y),""",
"""canBuild:(k,x,y,a)=>canBuild(player(),k,x,y,a),startBuild:(k,x,y,a)=>startBuild(player(),k,x,y,a),PL,setBuild,placeTap,placeConfirm,set touch(v){lastTouch=v},set shift(v){shiftDown=v},""")
open(p, 'w', encoding='utf8').write(s)
print('ok')

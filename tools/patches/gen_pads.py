# stage 6, phase 5: the ground around game buildings — an apron where the fields end, the wood is cleared and the soil is
# worn, with a ragged (noise-driven, world-anchored) outline; neighbours merge (max), rotation through the zone frame
import sys
p = 'src/gen.js'
s = open(p, encoding='utf8').read()
def R(a, b, cnt=1):
    global s
    k = s.count(a)
    if k != cnt:
        sys.exit(f'patch: expected {cnt} got {k}: {a[:90]!r}')
    s = s.replace(a, b)

R("""const TINTZ={ind:1,ref:1,pow:1,port:1,stn:1,gas:1,agro:1};""",
"""const TINTZ={ind:1,ref:1,pow:1,port:1,stn:1,gas:1,agro:1};
// stage 6: the apron of a game building — [width m, wear 0..1]. Big pads get a wide worn ring; air defence, solar panels,
// the launch ramp and the runway stand on grass and only push the fields back
const PADK={sam:[14,0.25],sol2:[12,0.2],dramp:[14,0.35],drwy:[18,0.35],farm:[22,0.45],oil:[20,0.6],gasw:[20,0.6]},PADD=[32,0.75];
// pad field of zone c at (x, y): 1 on the pad, falling to 0 across the apron; signed distance to the turned rectangle with
// rounded corners (no corner spikes), the apron width breathes along the outline with world noise (tiles agree)
function padAt(c,x,y){const pk=PADK[c.zk]||PADD,ap=pk[0];const dx=x-c.x,dy=y-c.y;const lx=dx*c.ca+dy*c.sa,ly=-dx*c.sa+dy*c.ca;
  const hw=c.W/2,hh=c.H/2,ax=M.abs(lx)-hw,ay=M.abs(ly)-hh;if(ax>ap*1.6||ay>ap*1.6)return 0;
  const r=M.min(16,hw*0.3,hh*0.3),qx=ax+r,qy=ay+r;const d=M.hypot(qx>0?qx:0,qy>0?qy:0)+M.min(M.max(qx,qy),0)-r;if(d<=0)return 1;
  const w=ap*(0.7+0.6*(noise(x/41+c.id*1.7,y/41-c.id*0.9)*0.5+0.5));return smooth(w,0,d)}
// the strongest pad of the zones near (x, y): [field 0..1, wear 0..1]; neighbouring pads merge into one apron
function padField(zs,x,y){let f=0,w=0;for(const c of zs){if(c.kind!=='zone'||!c.dyn)continue;const v=padAt(c,x,y);if(v>f)f=v;const pw=v*(PADK[c.zk]||PADD)[1];if(pw>w)w=pw}return [f,w]}""")

# the grid of the raster gets the pad field
R("""const gQX=new Float32Array(GN*GN),""", """const gZ=new Float32Array(GN*GN),gZW=new Float32Array(GN*GN),gQX=new Float32Array(GN*GN),""")
R("""    let fa=EMPTY?0:smooth(0.0,0.3,noise(wx/15000+61.1,wy/15000-12.3)),u=0;
    for(let q=0;q<near.length;q++){const c=near[q];if(c.kind==='zone'){const dx=wx-c.x,dy=wy-c.y;const lx=dx*c.ca+dy*c.sa,ly=-dx*c.sa+dy*c.ca;
        const v=smooth(1.08,0.98,M.max(M.abs(lx)/(c.W/2),M.abs(ly)/(c.H/2)));if(TINTZ[c.zk]&&v>u)u=v*0.8;continue}""",
"""    let fa=EMPTY?0:smooth(0.0,0.3,noise(wx/15000+61.1,wy/15000-12.3)),u=0,zf=0,zw=0;
    for(let q=0;q<near.length;q++){const c=near[q];if(c.kind==='zone'){
        if(c.dyn){const v=padAt(c,wx,wy);if(v>zf)zf=v;const pw=v*(PADK[c.zk]||PADD)[1];if(pw>zw)zw=pw;continue}
        const dx=wx-c.x,dy=wy-c.y;const lx=dx*c.ca+dy*c.sa,ly=-dx*c.sa+dy*c.ca;
        const v=smooth(1.08,0.98,M.max(M.abs(lx)/(c.W/2),M.abs(ly)/(c.H/2)));if(TINTZ[c.zk]&&v>u)u=v*0.8;continue}""")
R("""    gA[k]=fa;gU[k]=u;""", """    gA[k]=fa;gU[k]=u;gZ[k]=zf;gZW[k]=zw;""")

# per pixel: fields end before the pad, the wood is cleared, the soil is worn
R("""        const u=gU[k]*w00+gU[k+1]*w10+gU[k+GN]*w01+gU[k+GN+1]*w11;
        const dry=smooth(0.3,-0.45,mo);""",
"""        const u=gU[k]*w00+gU[k+1]*w10+gU[k+GN]*w01+gU[k+GN+1]*w11;
        const zi=gZ[k]*w00+gZ[k+1]*w10+gZ[k+GN]*w01+gZ[k+GN+1]*w11,zw=gZW[k]*w00+gZW[k+1]*w10+gZW[k+GN]*w01+gZW[k+GN+1]*w11;
        const dry=smooth(0.3,-0.45,mo);""")
R("""        let fo=smooth(0.06,0.13,fv)*(1-smooth(0.04,0.25,u))*smooth(0.55,0.44,e);
        // fields
        let agv=smooth(0.25,0.55,ag)*smooth(0.36,0.22,e)*(1-smooth(0.05,0.3,u))*(1-smooth(1.2,2.5,slope));""",
"""        let fo=smooth(0.06,0.13,fv)*(1-smooth(0.04,0.25,u))*smooth(0.55,0.44,e)*(1-smooth(0.04,0.4,zi));
        // fields (stage 6: they end with a headland before a building's apron)
        let agv=smooth(0.25,0.55,ag)*smooth(0.36,0.22,e)*(1-smooth(0.05,0.3,u))*(1-smooth(1.2,2.5,slope))*(1-smooth(0.18,0.6,zi));""")
R("""        if(u>0){const uc=0.92+dt*0.18;if(WIN){R=lerp(R,178*uc,u*0.6);""",
"""        // stage 6: the worn ground of a building's apron (compacted soil, trampled snow), mottled by the detail noise
        if(zw>0.002){const wv=smooth(0.08,0.9,zw)*(0.82+dt*0.3),wc=0.94+dt*0.12;if(WIN){R=lerp(R,196*wc,wv*0.7);Gc=lerp(Gc,196*wc,wv*0.7);Bc=lerp(Bc,192*wc,wv*0.7)}
          else if(SEASON===1){R=lerp(R,146*wc,wv);Gc=lerp(Gc,124*wc,wv);Bc=lerp(Bc,88*wc,wv)}else{R=lerp(R,150*wc,wv);Gc=lerp(Gc,138*wc,wv);Bc=lerp(Bc,102*wc,wv)}}
        if(u>0){const uc=0.92+dt*0.18;if(WIN){R=lerp(R,178*uc,u*0.6);""")
# for the tests: the pad field from outside
R("""function renderTile(z,tx,ty){""", """function padFieldAt(x,y){return padField(zones.filter(z=>z.dyn&&!z.dead&&!HID.has(z.id)).map(z=>Object.assign({kind:'zone'},z)),x,y)}
function renderTile(z,tx,ty){""")
open(p, 'w', encoding='utf8').write(s)
print('ok')

import fs from 'fs';
const BT = String.fromCharCode(96);
function rep(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [a, b] of pairs) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(file + ': expected 1 match, got ' + n + ' for: ' + a.slice(0, 80));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(file, s);
}
rep('src/main.js', [
  ["const workers=[];let mainRender=false;", "const workers=[];let mainRender=false;const WD={ready:0,dead:0,fb:0,mr:0,terr:0,errs:[]};"],
  ["onmessage=function(e){const m=e.data;\n if(m.t==='init')", "function H0(e){const m=e.data;\n if(m.t==='init')"],
  ["postMessage({t:'tile',key:m.key,b,s:G.season(),gv:m.gv},[b])}};" + BT + ";",
   "postMessage({t:'tile',key:m.key,b,s:G.season(),gv:m.gv},[b])}}\n// stage 5.14: an error in one tile or op must not kill the worker (all workers dead = every tile on the main thread)\nonmessage=function(e){try{H0(e)}catch(err){const m=e.data||{};const es=String(err&&err.stack||err).slice(0,300);if(m.t==='tile')postMessage({t:'tile',key:m.key,L:m.L,b:null,s:G?G.season():0,gv:m.gv,err:es});else postMessage({t:'err',m:m.t,err:es})}};" + BT + ";"],
  ["w.onmessage=e=>{const m=e.data;if(m.t==='ready'){if(m.ok){w.ready=true;mainRender=false}",
   "w.onmessage=e=>{const m=e.data;if(m.t==='err'){if(WD.errs.length<20)WD.errs.push('w:'+m.m+':'+m.err);return}if(m.t==='ready'){if(!m.ok&&WD.errs.length<20)WD.errs.push('init:'+m.err);if(m.ok){w.ready=true;WD.ready++;mainRender=false}"],
  ["if(m.L){LPS[m.L].delete(m.key);", "if(m.L){LPS[m.L].delete(m.key);if(m.err&&WD.errs.length<20)WD.errs.push('light:'+m.err);"],
  ["pending.delete(m.key);if(m.s!==season", "pending.delete(m.key);if(!m.b){WD.terr++;if(m.err&&WD.errs.length<20)WD.errs.push('tile:'+m.err);return}if(m.s!==season"],
  ["w.onerror=()=>{w.dead=true;", "w.onerror=(ev)=>{WD.dead++;if(WD.errs.length<20)WD.errs.push('onerror:'+(ev&&ev.message)+' @'+(ev&&ev.lineno));w.dead=true;"],
  ["catch(e){mainRender=true}", "catch(e){mainRender=true;WD.errs.push('spawn:'+String(e))}"],
  ["setTimeout(()=>{if(alive&&!workers.some(w=>w.ready))mainRender=true},", "setTimeout(()=>{if(alive&&!workers.some(w=>w.ready)){mainRender=true;WD.fb++}},"],
  ["if(mainRender){const t0=performance.now();", "if(mainRender){WD.mr++;const t0=performance.now();"],
  ["main:mainRender,lowQ})", "main:mainRender,lowQ,nw:workers.length,wr:workers.filter(q=>q.ready).length,wdead:workers.filter(q=>q.dead).length,cpu:HS.indexOf('cpu')>=0,wd:WD})"],
]);
rep('tests/perf-capital.mjs', [
  ["s ? s.pending : null]);", "s ? s.pending : null, s ? (s.main ? 1 : 0) : null, s ? s.wr : null]);"],
  ["cam per s [ms,m,queue,pending] ", "cam per s [ms,m,queue,pending,mainRender,workersReady] "],
  ["  const lt = found.lt, cm = found.cm;", "  const wk0 = await p.evaluate(() => { const s = window.__world && window.__world.stats ? window.__world.stats() : null; return s ? { main: s.main, nw: s.nw, wr: s.wr, wdead: s.wdead, cpu: s.cpu, wd: s.wd, hc: navigator.hardwareConcurrency, dm: navigator.deviceMemory } : null; });\n  tail.push('workers ' + JSON.stringify(wk0));\n  const lt = found.lt, cm = found.cm;"],
]);
const out = [];
const grep = (f, re) => { const L = fs.readFileSync(f, 'utf8').split('\n'); out.push('=== grep ' + f + ' ' + re); L.forEach((l, i) => { if (re.test(l)) out.push((i + 1) + ': ' + l.slice(0, 400)); }); };
grep('src/game.js', /startWorld|cpu/);
grep('src/ui.js', /cpu|startWorld/);
fs.mkdirSync('docs/probe', { recursive: true });
fs.writeFileSync('docs/probe/p014.txt', out.join('\n'));

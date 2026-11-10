// GL2D — the world frame on WebGL2 with a small Canvas-2D-like API (stage 6).
// Why: the frame was ~10 full-screen Canvas 2D passes (water, tiles, cloud layers, ambient, three light levels, haze,
// vignette) plus thousands of drawImage calls; on an integrated GPU that cost 25–68 ms per frame while the main thread
// idled. Here every primitive is one instance of a unit quad; consecutive primitives with the same texture, program and
// blend mode go to the GPU in one instanced draw call. Tiles live in texture arrays with a fixed number of slots
// (bounded memory, LRU), sprites in an atlas, cached layers (clouds, shadows) in framebuffer textures.
//
// The API mirrors the subset of CanvasRenderingContext2D the engine uses, so drawing code reads the same:
//   g.setTransform(a,b,c,d,e,f) · save/restore/translate/rotate/scale · globalAlpha · globalCompositeOperation
//   ('source-over' | 'lighter' | 'multiply') · fillStyle (css colour) · fillRect · drawImage(ref, …3/5/9 args)
// plus: g.tile(pool, slot, sx,sy,sw,sh, dx,dy,dw,dh) — a tile from a texture array; g.line(x0,y0,x1,y1,w) — a solid line;
// g.lineImg(ref,…) — a textured line; g.pattern(ref, m, rects) — a repeating texture through a matrix; g.vignette(…).
// Coordinates: device pixels of the current target after the current transform, as in Canvas 2D.
function GL2D(canvas, opts) {
  'use strict';
  opts = opts || {};
  const M = Math;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
  if (!gl) return null;
  const STRIDE = 20; // floats per instance: origin(2) axisA(2) axisB(2) uv0(2) uv1(2) layer(1) pad(1) colour(4) tint(4)
  let cap = 8192, data = new Float32Array(cap * STRIDE), n = 0;
  let prog = null, tex = null, texKind = 0, blend = '', layerTex = null;
  let tW = 1, tH = 1; // current target size (device px)
  const stats = { draws: 0, inst: 0, uploads: 0 };

  // ---------------------------------------------------------------- shaders
  const VS = `#version 300 es
layout(location=0) in vec2 aC;
layout(location=1) in vec4 aOA;
layout(location=2) in vec4 aBU;
layout(location=3) in vec4 aUV;
layout(location=4) in vec4 aCol;
layout(location=5) in vec4 aTint;
uniform vec2 uS;
out vec2 vUV; out vec2 vP; out vec4 vCol; out vec4 vTint; flat out float vL;
void main(){
  vec2 p = aOA.xy + aOA.zw * aC.x + aBU.xy * aC.y;
  gl_Position = vec4(p.x * uS.x - 1.0, 1.0 - p.y * uS.y, 0.0, 1.0);
  vUV = vec2(mix(aBU.z, aUV.x, aC.x), mix(aBU.w, aUV.y, aC.y));
  vP = p; vCol = aCol; vTint = aTint; vL = aUV.z;
}`;
  const FS_HEAD = `#version 300 es
precision highp float;
in vec2 vUV; in vec2 vP; in vec4 vCol; in vec4 vTint; flat in float vL;
out vec4 o;
uniform float uPre;
vec4 shade(vec4 t){
  vec3 c = uPre > 0.5 ? (t.a > 0.0 ? t.rgb / t.a : vec3(0.0)) : t.rgb;
  c = mix(c, vTint.rgb, vTint.a);
  float a = t.a * vCol.a;
  return vec4(c * vCol.rgb * a, a);
}
`;
  const FS_2D = FS_HEAD + `uniform sampler2D uT; void main(){ o = shade(texture(uT, vUV)); }`;
  const FS_ARR = FS_HEAD + `uniform highp sampler2DArray uA; void main(){ o = shade(texture(uA, vec3(vUV, vL))); }`;
  // a repeating texture through a matrix: the device position goes back to texture pixels
  const FS_PAT = FS_HEAD + `uniform sampler2D uT; uniform mat3 uInv; uniform vec2 uSz;
void main(){ vec3 q = uInv * vec3(vP, 1.0); o = shade(texture(uT, q.xy / uSz)); }`;
  // radial vignette as Canvas createRadialGradient(cx,cy,r0, cx,cy,r1) with stops 0 → transparent, 1 → colour
  const FS_VIG = `#version 300 es
precision highp float;
in vec2 vP; out vec4 o; uniform vec2 uC; uniform vec2 uR; uniform vec4 uCol;
void main(){ float t = clamp((length(vP - uC) - uR.x) / (uR.y - uR.x), 0.0, 1.0); float a = uCol.a * t; o = vec4(uCol.rgb * a, a); }`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('GL2D shader: ' + gl.getShaderInfoLog(s)); return s }
  function mkProg(fs) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('GL2D link: ' + gl.getProgramInfoLog(p));
    const u = {}; const nU = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nU; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name) }
    return { p, u };
  }
  let P2, PA, PP, PV, vao, ibuf, qbuf;
  function init() {
    P2 = mkProg(FS_2D); PA = mkProg(FS_ARR); PP = mkProg(FS_PAT); PV = mkProg(FS_VIG);
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    qbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    ibuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ibuf); gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.STREAM_DRAW);
    const B = STRIDE * 4; const at = (loc, sz, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, sz, gl.FLOAT, false, B, off * 4); gl.vertexAttribDivisor(loc, 1) };
    at(1, 4, 0); at(2, 4, 4); at(3, 4, 8); at(4, 4, 12); at(5, 4, 16);
    gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    blend = ''; prog = null; tex = null;
  }
  init();

  // ---------------------------------------------------------------- state (Canvas-like)
  let T = [1, 0, 0, 1, 0, 0]; const stack = [];
  const api = {
    gl, stats, globalAlpha: 1, globalCompositeOperation: 'source-over', tint: null,
    get width() { return tW }, get height() { return tH },
    setTransform(a, b, c, d, e, f) { T[0] = a; T[1] = b; T[2] = c; T[3] = d; T[4] = e; T[5] = f },
    getTransform() { return T.slice() },
    save() { stack.push([T.slice(), api.globalAlpha, api.globalCompositeOperation, api._fill, api.tint]) },
    restore() { const s = stack.pop(); if (!s) return; T = s[0]; api.globalAlpha = s[1]; api.globalCompositeOperation = s[2]; api._fill = s[3]; api.tint = s[4] },
    translate(x, y) { T[4] += T[0] * x + T[2] * y; T[5] += T[1] * x + T[3] * y },
    scale(x, y) { T[0] *= x; T[1] *= x; T[2] *= y; T[3] *= y },
    rotate(r) { const c = M.cos(r), s = M.sin(r), a = T[0], b = T[1], cc = T[2], d = T[3]; T[0] = a * c + cc * s; T[1] = b * c + d * s; T[2] = cc * c - a * s; T[3] = d * c - b * s },
    _fill: [0, 0, 0, 1],
    set fillStyle(v) { api._fill = color(v) }, get fillStyle() { return api._fill },
  };
  const CC = new Map();
  function color(v) {
    if (typeof v !== 'string') return v;
    let c = CC.get(v); if (c) return c;
    let m;
    if (v[0] === '#') { let h = v.slice(1); if (h.length === 3) h = h.split('').map((q) => q + q).join(''); const x = parseInt(h, 16); c = [(x >> 16 & 255) / 255, (x >> 8 & 255) / 255, (x & 255) / 255, 1] }
    else if ((m = /rgba?\(([^)]+)\)/.exec(v))) { const p = m[1].split(',').map(parseFloat); c = [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1] }
    else c = [0, 0, 0, 1];
    if (CC.size > 4000) CC.clear(); CC.set(v, c); return c;
  }
  api.color = color;

  // ---------------------------------------------------------------- batching
  function setBlend(b) {
    if (b === blend) return; blend = b;
    if (b === 'lighter') gl.blendFunc(gl.ONE, gl.ONE);
    else if (b === 'multiply') gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  function flush() {
    if (!n || !prog) { n = 0; return }
    gl.useProgram(prog.p);
    gl.uniform2f(prog.u.uS, 2 / tW, 2 / tH);
    if (prog.u.uPre) gl.uniform1f(prog.u.uPre, tex && tex.pre ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    if (prog === PA) { gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.t); gl.uniform1i(prog.u.uA, 0) }
    else if (tex) { gl.bindTexture(gl.TEXTURE_2D, tex.t); if (prog.u.uT) gl.uniform1i(prog.u.uT, 0) }
    if (prog.set) prog.set();
    gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * STRIDE), gl.STREAM_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    stats.draws++; stats.inst += n; n = 0;
  }
  function use(p, t, b) {
    if (p !== prog || t !== tex || b !== blend || p.set) { flush(); prog = p; tex = t; setBlend(b) }
    if (n >= cap) { flush(); cap *= 2; const d = new Float32Array(cap * STRIDE); data = d; }
  }
  // pushes one instance: a parallelogram (ox,oy)+(ax,ay)*u+(bx,by)*v in device px, uv rect, colour, tint
  function push(ox, oy, ax, ay, bx, by, u0, v0, u1, v1, L, r, g, b, a, tint) {
    const o = n * STRIDE; const d = data;
    d[o] = ox; d[o + 1] = oy; d[o + 2] = ax; d[o + 3] = ay; d[o + 4] = bx; d[o + 5] = by; d[o + 6] = u0; d[o + 7] = v0;
    d[o + 8] = u1; d[o + 9] = v1; d[o + 10] = L; d[o + 11] = 0; d[o + 12] = r; d[o + 13] = g; d[o + 14] = b; d[o + 15] = a;
    if (tint) { d[o + 16] = tint[0]; d[o + 17] = tint[1]; d[o + 18] = tint[2]; d[o + 19] = tint[3] } else { d[o + 16] = 0; d[o + 17] = 0; d[o + 18] = 0; d[o + 19] = 0 }
    n++;
  }
  // a user-space rect through the current transform
  function quad(t, x, y, w, h, u0, v0, u1, v1, L, r, g, b, a, tint) {
    const ox = T[0] * x + T[2] * y + T[4], oy = T[1] * x + T[3] * y + T[5];
    push(ox, oy, T[0] * w, T[1] * w, T[2] * h, T[3] * h, u0, v0, u1, v1, L, r, g, b, a, tint);
  }

  // ---------------------------------------------------------------- textures
  // a texture object: {t, w, h, pre (texels premultiplied), kind: '2d'|'arr'}
  const OWN = []; // everything created here, deleted by dispose()
  function tex2D(w, h, src, repeat) {
    flush(); const t = gl.createTexture(); OWN.push(t); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wr = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    tex = null; // the binding changed
    return { t, w: src ? src.width : w, h: src ? src.height : h, pre: true, kind: '2d' };
  }
  // does an ImageBitmap reach the texture premultiplied? (the spec leaves 'default' bitmaps to the browser)
  let bitmapPre = true;
  function probeBitmaps() {
    if (typeof OffscreenCanvas === 'undefined') return;
    try {
      const oc = new OffscreenCanvas(1, 1), x = oc.getContext('2d'); x.fillStyle = 'rgba(255,0,0,0.5)'; x.fillRect(0, 0, 1, 1);
      const bm = oc.transferToImageBitmap(); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bm);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); bitmapPre = px[0] < 200;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(t); bm.close && bm.close(); tex = null;
    } catch (e) { /* keep the default */ }
  }
  probeBitmaps();

  // texture array pool for 256 x 256 tiles: fixed slots, the caller keeps the LRU (see main.js)
  function pool(slots, size) {
    size = size || 256; slots = M.min(slots, gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) || 256);
    flush(); const t = gl.createTexture(); OWN.push(t); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, size, size, slots);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    tex = null;
    const free = []; for (let i = slots - 1; i >= 0; i--) free.push(i);
    const P = { t, size, slots, free, pre: bitmapPre, kind: 'arr',
      // uploads an ImageBitmap or a canvas into a free slot; returns the slot or -1 when the pool is full
      upload(src) {
        if (!free.length) return -1; const s = free.pop(); flush();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
        // canvases honour the unpack flag; bitmaps arrive as the probe found — make both match P.pre
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, bitmapPre);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, s, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, src);
        tex = null; stats.uploads++; return s;
      },
      release(s) { if (s >= 0) free.push(s) },
      get used() { return slots - free.length } };
    return P;
  }

  // sprite atlas: shelf packing into 2048 x 2048 pages; refs {tex, x, y, w, h} in page pixels
  const pages = [];
  function atlasPage() { const p = { tex: tex2D(2048, 2048, null), x: 0, y: 0, rowH: 0 }; pages.push(p); return p }
  function addSprite(src) {
    const w = src.width, h = src.height, PAD = 2;
    if (w + PAD * 2 > 2048 || h + PAD * 2 > 2048) { const t = tex2D(0, 0, src); return { tex: t, x: 0, y: 0, w, h, src } }
    let p = pages[pages.length - 1];
    for (let tries = 0; tries < 2; tries++) {
      if (!p) p = atlasPage();
      if (p.x + w + PAD * 2 > 2048) { p.x = 0; p.y += p.rowH; p.rowH = 0 }
      if (p.y + h + PAD * 2 > 2048) { p = null; continue }
      break;
    }
    if (!p) p = atlasPage();
    const x = p.x + PAD, y = p.y + PAD; p.x += w + PAD * 2; p.rowH = M.max(p.rowH, h + PAD * 2);
    flush(); gl.bindTexture(gl.TEXTURE_2D, p.tex.t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, src); tex = null;
    return { tex: p.tex, x, y, w, h, src };
  }
  // white texel for solid fills
  let WHITE = null;
  function white() { if (!WHITE) { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); WHITE = addSprite(c) } return WHITE }

  // a framebuffer layer (cached cloud and shadow layers): ref {tex, x:0, y:0, w, h, flip}
  function layer(w, h) {
    const L = { w: 0, h: 0, tex: null, fb: gl.createFramebuffer(), x: 0, y: 0, flip: true };
    L.resize = (w2, h2) => { if (w2 === L.w && h2 === L.h) return; if (L.tex) { gl.deleteTexture(L.tex.t); const i = OWN.indexOf(L.tex.t); if (i >= 0) OWN.splice(i, 1) } L.tex = tex2D(w2, h2, null); L.w = w2; L.h = h2;
      gl.bindFramebuffer(gl.FRAMEBUFFER, L.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, L.tex.t, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, cur ? cur.fb : null) };
    L.resize(w, h); return L;
  }
  let cur = null;
  function target(L) {
    flush(); cur = L || null; gl.bindFramebuffer(gl.FRAMEBUFFER, cur ? cur.fb : null);
    tW = cur ? cur.w : canvas.width; tH = cur ? cur.h : canvas.height; gl.viewport(0, 0, tW, tH);
  }
  function clear(r, g, b, a) { flush(); gl.clearColor(r, g, b, a); gl.clear(gl.COLOR_BUFFER_BIT) }

  // ---------------------------------------------------------------- primitives
  const opOf = () => api.globalCompositeOperation;
  api.fillRect = function (x, y, w, h) {
    const W0 = white(), c = api._fill, a = c[3] * api.globalAlpha; if (a <= 0) return;
    use(P2, W0.tex, opOf()); const u = (W0.x + 2) / 2048, v = (W0.y + 2) / 2048;
    quad(T, x, y, w, h, u, v, u, v, 0, c[0], c[1], c[2], a, null);
  };
  // drawImage(ref, dx, dy) · (ref, dx, dy, dw, dh) · (ref, sx, sy, sw, sh, dx, dy, dw, dh)
  api.drawImage = function (r, a1, a2, a3, a4, a5, a6, a7, a8) {
    if (!r || !r.tex) return; let sx = 0, sy = 0, sw = r.w, sh = r.h, dx, dy, dw, dh;
    if (a5 !== undefined) { sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8 }
    else if (a3 !== undefined) { dx = a1; dy = a2; dw = a3; dh = a4 } else { dx = a1; dy = a2; dw = r.w; dh = r.h }
    const al = api.globalAlpha; if (al <= 0) return;
    const t = r.tex; use(P2, t, opOf());
    let u0 = (r.x + sx) / t.w, u1 = (r.x + sx + sw) / t.w, v0 = (r.y + sy) / t.h, v1 = (r.y + sy + sh) / t.h;
    if (r.flip) { v0 = 1 - v0; v1 = 1 - v1 }
    quad(T, dx, dy, dw, dh, u0, v0, u1, v1, 0, 1, 1, 1, al, api.tint);
  };
  // a tile (slot of a pool): source rect in tile pixels
  api.tile = function (P, slot, sx, sy, sw, sh, dx, dy, dw, dh) {
    const al = api.globalAlpha; if (al <= 0 || slot < 0) return; use(PA, P, opOf()); const S = P.size;
    quad(T, dx, dy, dw, dh, sx / S, sy / S, (sx + sw) / S, (sy + sh) / S, slot, 1, 1, 1, al, null);
  };
  // a solid line of width w (user units) from (x0,y0) to (x1,y1)
  api.line = function (x0, y0, x1, y1, w) {
    const dx = x1 - x0, dy = y1 - y0, L = M.hypot(dx, dy); if (L < 1e-6) return; const nx = -dy / L * w / 2, ny = dx / L * w / 2;
    const W0 = white(), c = api._fill, a = c[3] * api.globalAlpha; if (a <= 0) return; use(P2, W0.tex, opOf()); const u = (W0.x + 2) / 2048, v = (W0.y + 2) / 2048;
    const ox = x0 - nx, oy = y0 - ny;
    push(T[0] * ox + T[2] * oy + T[4], T[1] * ox + T[3] * oy + T[5], T[0] * dx + T[2] * dy, T[1] * dx + T[3] * dy, T[0] * 2 * nx + T[2] * 2 * ny, T[1] * 2 * nx + T[3] * 2 * ny, u, v, u, v, 0, c[0], c[1], c[2], a, null);
  };
  // a textured line: the image runs from (x0,y0) (u = 0) to (x1,y1) (u = 1), w wide; colour multiplies the texels
  api.lineImg = function (r, x0, y0, x1, y1, w, col) {
    const dx = x1 - x0, dy = y1 - y0, L = M.hypot(dx, dy); if (L < 1e-6 || !r) return; const nx = -dy / L * w / 2, ny = dx / L * w / 2;
    const c = col || [1, 1, 1, 1], a = c[3] * api.globalAlpha; if (a <= 0) return; const t = r.tex; use(P2, t, opOf());
    const ox = x0 - nx, oy = y0 - ny;
    push(T[0] * ox + T[2] * oy + T[4], T[1] * ox + T[3] * oy + T[5], T[0] * dx + T[2] * dy, T[1] * dx + T[3] * dy, T[0] * 2 * nx + T[2] * 2 * ny, T[1] * 2 * nx + T[3] * 2 * ny,
      r.x / t.w, r.y / t.h, (r.x + r.w) / t.w, (r.y + r.h) / t.h, 0, c[0], c[1], c[2], a, null);
  };
  // fills rects (user units, through the transform) with the texture repeated through m (texture px → user units)
  api.pattern = function (r, m, rects) {
    const al = api.globalAlpha; if (al <= 0 || !rects.length) return;
    // device = T * m * p  →  p = (T*m)^-1 * device
    const a = T[0] * m[0] + T[2] * m[1], b = T[1] * m[0] + T[3] * m[1], c = T[0] * m[2] + T[2] * m[3], d = T[1] * m[2] + T[3] * m[3];
    const e = T[0] * m[4] + T[2] * m[5] + T[4], f = T[1] * m[4] + T[3] * m[5] + T[5]; const det = a * d - b * c; if (!det) return;
    const ia = d / det, ib = -b / det, ic = -c / det, id = a / det, ie = (c * f - d * e) / det, iff = (b * e - a * f) / det;
    flush(); prog = PP; tex = r.tex; setBlend(opOf());
    const sz = [r.w, r.h], inv = new Float32Array([ia, ib, 0, ic, id, 0, ie, iff, 1]);
    PP.set = () => { gl.uniformMatrix3fv(PP.u.uInv, false, inv); gl.uniform2f(PP.u.uSz, sz[0], sz[1]) };
    for (const q of rects) quad(T, q[0], q[1], q[2], q[3], 0, 0, 0, 0, 0, 1, 1, 1, al, null);
    flush(); PP.set = null; prog = null;
  };
  // a radial vignette over the whole target (CSS px centre and radii through the transform's scale)
  api.vignette = function (cx, cy, r0, r1, col, alpha) {
    flush(); prog = PV; tex = null; setBlend('source-over'); const s = M.hypot(T[0], T[1]);
    PV.set = () => { gl.uniform2f(PV.u.uC, T[0] * cx + T[2] * cy + T[4], T[1] * cx + T[3] * cy + T[5]); gl.uniform2f(PV.u.uR, r0 * s, r1 * s); gl.uniform4f(PV.u.uCol, col[0], col[1], col[2], alpha) };
    push(0, 0, tW, 0, 0, tH, 0, 0, 0, 0, 0, 1, 1, 1, 1, null); flush(); PV.set = null; prog = null;
  };
  api.begin = function () { stats.draws = 0; stats.inst = 0; stats.uploads = 0; target(null); T = [1, 0, 0, 1, 0, 0]; api.globalAlpha = 1; api.globalCompositeOperation = 'source-over'; api.tint = null };
  api.end = function () { flush() };
  api.flush = flush; api.target = target; api.clear = clear; api.layer = layer; api.pool = pool; api.sprite = addSprite; api.texture = tex2D;
  api.lost = () => gl.isContextLost();
  // frees every texture, buffer and program of this instance (the canvas and its context stay for the next world)
  api.dispose = function () {
    n = 0; for (const t of OWN) gl.deleteTexture(t); OWN.length = 0; pages.length = 0; WHITE = null;
    for (const P of [P2, PA, PP, PV]) gl.deleteProgram(P.p); gl.deleteBuffer(ibuf); gl.deleteBuffer(qbuf); gl.deleteVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  return api;
}

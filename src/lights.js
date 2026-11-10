// Light sources as game objects (stage 6): street lamps the player builds, floodlights of the buildings. Each light has a
// place and a height (its head is seen through the parallax camera, src/parallax.js), a radius, a colour, an intensity and
// a mode: 'auto' (on at dusk, off at dawn — every lamp at its own moment, so a street does not switch at once), 'on', 'off'.
// The renderer (main.js) asks for the visible lights each frame: culled by the screen (with the radius of their pool) and
// capped (cap), the strongest and the nearest to the screen centre first.
// Pure logic, no DOM: LightSystem({cap}).
const LightSystem = (function () {
  'use strict';
  const M = Math;
  const KINDS = {
    lamp: { h: 8, r: 34, c: [1, 0.86, 0.62], i: 1 },     // a street lamp: warm, 8 m pole
    flood: { h: 14, r: 62, c: [0.92, 0.95, 1], i: 0.9 },  // a floodlight of a building yard: cold white, high mast
    beacon: { h: 30, r: 0, c: [1, 0.2, 0.15], i: 1 },     // a red obstruction light (glow only, lights no ground)
  };
  const FADE = 0.7; // s to light up or go dark
  function hash(n) { n = M.imul(n ^ (n >>> 16), 0x45d9f3b); n = M.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296 }
  return function LightSystem(opts) {
    opts = opts || {};
    const L = new Map(); let nid = 0; const vis = [];
    const api = {
      KINDS,
      cap: opts.cap || 256,
      get size() { return L.size },
      // adds a light; returns its id. o: {x, y, kind?, h?, r?, c?, i?, mode?, owner?}
      add(o) {
        const k = KINDS[o.kind] || KINDS.lamp, id = o.id != null ? o.id : ++nid; if (o.id != null && o.id > nid) nid = o.id;
        const l = { id, x: o.x, y: o.y, kind: o.kind || 'lamp', h: o.h != null ? o.h : k.h, r: o.r != null ? o.r : k.r, c: o.c || k.c, i: o.i != null ? o.i : k.i,
          mode: o.mode || 'auto', owner: o.owner != null ? o.owner : null, lv: 0, ph: hash(id * 2654435761 + 1) };
        L.set(id, l); return id;
      },
      get(id) { return L.get(id) },
      remove(id) { return L.delete(id) },
      removeOwner(owner) { let n = 0; for (const [id, l] of L) if (l.owner === owner) { L.delete(id); n++ } return n },
      clear() { L.clear() },
      all() { return [...L.values()] },
      setMode(id, mode) { const l = L.get(id); if (!l || !['auto', 'on', 'off'].includes(mode)) return false; l.mode = mode; return true },
      // is the light meant to burn now? night: 0 (day) … 1 (deep night); auto lamps switch on between night 0.25 and 0.55
      // (each at its own threshold) and off again in the same order at dawn
      wants(l, night) { return l.mode === 'on' || (l.mode === 'auto' && night > 0.25 + l.ph * 0.3) },
      // advances the levels (fade) of all lights; dt — seconds
      update(dt, night) { const st = dt / FADE; for (const l of L.values()) { const t = api.wants(l, night) ? 1 : 0; l.lv = t > l.lv ? M.min(t, l.lv + st) : M.max(t, l.lv - st) } },
      // the lights to draw: burning (lv > 0), inside the view rect [x0, y0, x1, y1] grown by their pool radius (and a
      // margin for the parallax of the head), not hidden (hidden(l) → true); at most cap, the most important first
      visible(view, hidden, out) {
        out = out || vis; out.length = 0; const [x0, y0, x1, y1] = view, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, span = M.max(x1 - x0, y1 - y0);
        for (const l of L.values()) {
          if (l.lv <= 0.001) continue; const g = M.max(l.r, 12) + l.h * 0.5;
          if (l.x + g < x0 || l.x - g > x1 || l.y + g < y0 || l.y - g > y1) continue; if (hidden && hidden(l)) continue;
          l._p = l.i * l.lv * (M.max(l.r, 10) + 10) / (1 + M.hypot(l.x - cx, l.y - cy) / span * 4); out.push(l);
        }
        if (out.length > api.cap) { out.sort((a, b) => b._p - a._p); out.length = api.cap }
        return out;
      },
      // every light in the view, burning or not (the poles are objects by day too), at most cap
      near(view, hidden, out) { out = out || []; out.length = 0; const [x0, y0, x1, y1] = view;
        for (const l of L.values()) { const g = l.h; if (l.x + g < x0 || l.x - g > x1 || l.y + g < y0 || l.y - g > y1) continue; if (hidden && hidden(l)) continue; out.push(l); if (out.length >= api.cap) break } return out },
      // serialisable state (the game saves the modes of the player's lamps in its builds; this is for tests and tools)
      dump() { return [...L.values()].map((l) => ({ id: l.id, x: l.x, y: l.y, kind: l.kind, mode: l.mode, owner: l.owner })) },
    };
    return api;
  };
})();
if (typeof module !== 'undefined') module.exports = LightSystem;

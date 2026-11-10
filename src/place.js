// Placement of buildings (stage 6), as in DroneFlames: a key of the bottom panel arms a building, a ghost of it follows the
// pointer (mouse) or waits in the middle of the screen (touch), turns with R / the rotate button, is placed by a click
// (mouse) or by a tap and the ✓ button (touch: the first tap only moves the ghost, the ghost can be dragged), and is
// cancelled by Esc, the right mouse button, ✕ or a second press of the same key.
// Pure logic, no DOM: the game passes the checks and the actions in. Placement(opts):
//   opts.check(k, x, y, ang) → null | reason   — can the building stand there?
//   opts.build(k, x, y, ang) → true | reason   — build it (money is checked by the game)
//   opts.rotates(k) → bool                      — does this building turn (round towns do not)
//   opts.onChange(state)                        — redraw the HUD
const Placement = (function () {
  'use strict';
  const STEP = Math.PI / 12; // 15° per press; Shift+R / the long press turn by 90°
  function wrap(a) { const T = Math.PI * 2; a %= T; return a < 0 ? a + T : a }
  return function Placement(opts) {
    opts = opts || {};
    const S = { k: null, x: 0, y: 0, ang: 0, has: false, touch: false, pending: false, bad: null, drag: false, keep: false, placed: 0 };
    const changed = () => { if (opts.onChange) opts.onChange(S) };
    const check = () => { S.bad = S.k && S.has ? (opts.check ? opts.check(S.k, S.x, S.y, S.ang) : null) : null; return S.bad };
    const api = {
      state: S,
      get active() { return !!S.k },
      // a key of the panel: arms the building, or disarms it when it is armed already
      select(k, touch, cx, cy) {
        if (S.k === k || !k) { api.cancel(); return false }
        S.k = k; S.touch = !!touch; S.pending = false; S.drag = false; S.bad = null; S.ang = 0; // a new building starts unturned
        // touch: the ghost appears in the middle of the screen at once (there is no hover to follow)
        if (touch && cx != null) { S.x = cx; S.y = cy; S.has = true; S.pending = true; check() } else S.has = false;
        changed(); return true;
      },
      // the mouse moved over the map (world coordinates)
      hover(x, y) { if (!S.k || S.touch) return; S.x = x; S.y = y; S.has = true; check(); },
      // a click or a tap on the map; returns 'built' | 'moved' | 'bad' | 'none'
      tap(x, y, touch, keep) {
        if (!S.k) return 'none';
        if (touch) { S.touch = true; S.x = x; S.y = y; S.has = true; S.pending = true; check(); changed(); return 'moved' }
        S.touch = false; S.x = x; S.y = y; S.has = true; if (check()) { changed(); return 'bad' }
        return api.confirm(keep);
      },
      // touch: a press on the ghost starts moving it instead of the map
      // the ghost keeps its offset from the finger (it does not jump under it)
      grab(x, y, radius) { if (!S.k || !S.has || !S.touch) return false; if (Math.hypot(x - S.x, y - S.y) > radius) return false; S.drag = true; S.gx = S.x - x; S.gy = S.y - y; return true },
      move(x, y) { if (!S.drag) return; S.x = x + (S.gx || 0); S.y = y + (S.gy || 0); check(); },
      release() { if (!S.drag) return; S.drag = false; changed() },
      rotate(dir, big) { if (!S.k || (opts.rotates && !opts.rotates(S.k))) return false; S.ang = wrap(S.ang + (dir || 1) * (big ? Math.PI / 2 : STEP)); check(); changed(); return true },
      // the ✓ button (touch) or the click (mouse): builds where the ghost stands
      confirm(keep) {
        if (!S.k || !S.has) return 'none'; if (check()) { changed(); return 'bad' }
        const r = opts.build ? opts.build(S.k, S.x, S.y, S.ang) : true;
        if (r !== true) { S.bad = typeof r === 'string' ? r : 'Нельзя построить'; changed(); return 'bad' }
        S.placed++;
        if (keep) { S.pending = false; check() } else { S.k = null; S.has = false; S.pending = false; S.bad = null }
        changed(); return 'built';
      },
      cancel() { const was = !!S.k; S.k = null; S.has = false; S.pending = false; S.drag = false; S.bad = null; if (was) changed(); return was },
      // the ghost footprint in world coordinates: four corners of a W x H rectangle turned by ang around (x, y)
      corners(W, H) { const c = Math.cos(S.ang), s = Math.sin(S.ang), hw = W / 2, hh = H / 2; return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) => [S.x + u * c - v * s, S.y + u * s + v * c]) },
    };
    return api;
  };
})();
if (typeof module !== 'undefined') module.exports = Placement;

// Parallax and height: everything that does not lie on the ground (clouds, planes, lamp heads, smoke) is projected through
// one perspective camera. The camera hangs above the screen centre at height H = m * VH * HK (m — metres per CSS pixel,
// VH — screen height in CSS px); a point at height alt is seen k = H / (H - alt) times farther from the screen centre than
// the ground point under it. So high objects slide faster than the ground when the camera pans and grow as it descends —
// the world reads as a volume, not a flat map. Shadows fall along the sun vector: a point at height alt casts its shadow
// alt * (SUNX, SUNY) metres away on the ground. Buildings keep their oblique lean in the tiles (LEANX, LEANY per metre).
//
// This file is the single place where these formulas live: main.js (clouds, planes, lights), the light system and the tests
// all use it. Pure functions, no state: Parallax.project(cam, VW, VH, x, y, alt, out) → out = [X, Y, k].
const Parallax = (() => {
  'use strict';
  const HK = 0.9;               // camera height in screen heights (H = m * VH * 0.9), as in stages 1–5
  const SUNX = 0.62, SUNY = 0.48; // ground offset of a shadow per metre of height (same as WorldGen)
  const NEAR = 0.9;             // objects higher than NEAR * H are behind the lens: not drawn
  // camera height above the ground, metres
  function camH(cam, VH) { return cam.m * VH * HK }
  // scale of a point at height alt (1 on the ground); Infinity / negative at or above the lens
  function scale(H, alt) { return H / (H - alt) }
  // screen position of the world point (x, y) at height alt; out = [X, Y, k] (k — size multiplier of the object)
  function project(cam, VW, VH, x, y, alt, out) {
    const H = cam.m * VH * HK, k = alt ? H / (H - alt) : 1;
    out = out || [0, 0, 0];
    out[0] = VW / 2 + (x - cam.x) / cam.m * k;
    out[1] = VH / 2 + (y - cam.y) / cam.m * k;
    out[2] = k;
    return out;
  }
  // is a point at height alt in front of the lens (drawable)?
  function inFront(H, alt) { return alt <= H * NEAR }
  // screen shift of a point at height alt against the ground point under it, for a camera move of (dx, dy) world metres:
  // ground moves by -d/m, the high point by -d/m*k — the difference is the parallax the player sees
  function shift(cam, VH, alt, dx, dy) { const H = camH(cam, VH), k = scale(H, alt); return [-dx / cam.m * k, -dy / cam.m * k] }
  // where the shadow of a point (x, y, alt) falls on the ground
  function shadow(x, y, alt, out) { out = out || [0, 0]; out[0] = x + SUNX * alt; out[1] = y + SUNY * alt; return out }
  return { HK, SUNX, SUNY, NEAR, camH, scale, project, inFront, shift, shadow };
})();
if (typeof module !== 'undefined') module.exports = Parallax;

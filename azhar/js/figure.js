// Character looks, and the bridge from a frame's pose (frames.js) to the smooth vector figure
// drawn by body.js. Each animation frame is drawn exactly as authored: no blending between frames.
const PRINCE = {
  skin: '#c98f68', skinS: '#9c6646', shirt: '#efe8da', vest: '#7c1f1d', trim: '#d4a24c', sash: '#b8322a',
  pants: '#e9e1cf', shoe: '#8a5a2b', hair: '#23160e', headwear: 'turban', turban: '#f6f2ea',
};
const PRINCESS = {
  skin: '#dcaa88', skinS: '#ad7a5c', shirt: '#2f6f86', sash: '#d4a24c', pants: '#2f6f86', shoe: '#2f6f86',
  hair: '#1c110b', female: true, dress: true, dressCol: '#3a86a0', longHair: true, tiara: true, brow: '#1c110b',
};
function guardLook(g) {
  return {
    skin: '#b47a58', skinS: '#86553a', shirt: g.tunic, vest: g.vest, trim: g.trim || '#9a8a6a', sash: '#2a1d14',
    pants: g.pants, shoe: '#3a2616', boots: '#3a2616', bootTall: true, fullSleeve: true, bracer: '#4a3420',
    hair: '#111', beard: '#17100b', headwear: 'helmet', helmet: g.helmet || '#7d858f', turban: g.turban, bulky: true,
  };
}
const FLASH = { skin: '#ffb6a0', skinS: '#e0705a', shirt: '#ffd6c8', pants: '#ffc8b6', vest: '#ff8f76' };
const T_ = (x, y) => ({ t: [x, y] });

// Skeleton in pose units (1 unit = 2 world px), matching the frame poses.
const D2R = Math.PI / 180, PU = SP / FIG_SC; // pose units -> body.js units
const dirv = a => [Math.sin(a * D2R), Math.cos(a * D2R)];
const segAng = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]); // from straight down, forward positive
function ik2(root, t, l1, l2, pick) {
  const dx = t[0] - root[0], dy = t[1] - root[1], d = Math.hypot(dx, dy) || 0.001;
  const dc = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const ux = dx / d, uy = dy / d, a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const m = [root[0] + ux * a, root[1] + uy * a], c1 = [m[0] - uy * hh, m[1] + ux * hh], c2 = [m[0] + uy * hh, m[1] - ux * hh];
  const j = pick(c1) >= pick(c2) ? c1 : c2, ex = t[0] - j[0], ey = t[1] - j[1], el = Math.hypot(ex, ey) || 1;
  return [j, [j[0] + ex / el * l2, j[1] + ey / el * l2]];
}

// Converts a frame pose into body.js joint angles (cached per pose object).
const solvedCache = new WeakMap();
function solveFrame(p) {
  let s = solvedCache.get(p); if (s) return s;
  const hip = p.h, sh = [hip[0] + Math.sin(p.t * D2R) * 12, hip[1] - Math.cos(p.t * D2R) * 12];
  const leg = (t, kd) => { const [k, a] = ik2(hip, t, 11, 11, q => q[0] * (kd || 1)); return [segAng(hip, k), segAng(k, a)]; };
  const arm = (ang, hand) => {
    if (!hand) return [ang[0] * D2R, ang[1] * D2R];
    const [e, h] = ik2(sh, hand, 8, 7, p.e === 'down' ? q => q[1] : q => -q[0]);
    return [segAng(sh, e), segAng(e, h)];
  };
  const lf = leg(p.f, p.fk), lb = leg(p.b, p.bk), af = arm(p.af, p.hf), ab = arm(p.ab, p.hb), lean = p.t * D2R;
  s = {
    v: [hip[0] * PU, hip[1] * PU, lean, (p.t + (p.hd || 0)) * D2R - lean * 0.55, lf[0], lf[1], lb[0], lb[1], af[0], af[1], ab[0], ab[1],
      p.sw == null ? NaN : p.sw * D2R, 0, 0],
    flatF: p.f[1] > -2.5, flatB: p.b[1] > -2.5, gripF: !!p.hf, gripB: !!p.hb, hasSword: p.sw != null, alpha: 1, flip: false,
  };
  solvedCache.set(p, s);
  return s;
}

function drawChar(ctx, x, y, dir, pose, look, o = {}) {
  let s = solveFrame(pose);
  if (o.alpha != null && o.alpha !== 1) s = Object.assign({}, s, { alpha: o.alpha });
  drawFigure(ctx, x, y, dir, null, look, Object.assign({ solved: s, swordDrawn: pose.sw != null }, o));
}

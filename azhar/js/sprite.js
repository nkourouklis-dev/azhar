// Pixel-art characters. Each animation frame's pose is rasterised once into a small sprite
// (1 sprite pixel = 2 world pixels, the original's screen resolution at our scale) with a flat
// palette and a dark outline, cached, and drawn with smoothing off. No in-between frames.
const SPR_W = 100, SPR_H = 96, SPR_OX = 50, SPR_OY = 82;
const LEG1 = 11, LEG2 = 11, TORSO = 12, ARM1 = 8, ARM2 = 7, BLADE = 15;

const PAL_KEYS = ['', 'outline', 'skin', 'skinS', 'shirt', 'shirtS', 'pants', 'pantsS', 'vest', 'vestS', 'sash', 'shoe',
  'hair', 'head', 'headS', 'blade', 'hilt', 'eye', 'beard', 'scab', 'hold', 'dress', 'dressS', 'trim'];
const PI_ = Object.fromEntries(PAL_KEYS.map((k, i) => [k, i]));

const PRINCE = { id: 'prince', outline: '#140c08', skin: '#d99a6a', skinS: '#a86c44', shirt: '#f3ecdc', shirtS: '#bfb196', pants: '#ece3cf', pantsS: '#b3a78c',
  vest: '#a8281f', vestS: '#6c1712', sash: '#d09a34', shoe: '#7a4a22', hair: '#26170d', head: '#f7f3ea', headS: '#c3b9a6', blade: '#e9eff6', hilt: '#d6a64a',
  eye: '#1a0e08', scab: '#5a3a1e', trim: '#d09a34', turban: true };
const PRINCESS = { id: 'princess', outline: '#140c08', skin: '#e2b08c', skinS: '#b07e5e', shirt: '#3a86a0', shirtS: '#2a6276', pants: '#3a86a0', pantsS: '#2a6276',
  vest: '#3a86a0', vestS: '#2a6276', sash: '#d4a24c', shoe: '#2f6f86', hair: '#1c110b', head: '#d4a24c', headS: '#a07a30', eye: '#1a0e08',
  dress: '#3f8fab', dressS: '#2c6a80', trim: '#d4a24c', longHair: true, tiara: true };
function guardLook(g) {
  return { id: 'guard' + g.tunic, outline: '#100a08', skin: '#b87c58', skinS: '#86553a', shirt: g.tunic, shirtS: g.shade, pants: g.pants, pantsS: g.shade,
    vest: g.vest, vestS: g.shade, sash: '#2a1d14', shoe: '#3a2616', hair: '#111', head: g.helmet || '#8d96a0', headS: g.trim || '#5b636c',
    blade: '#dfe6ee', hilt: '#b08a3a', eye: '#0c0806', beard: '#1d130c', scab: '#3a2616', trim: g.trim || '#9a8a6a', helmet: true, sleeves: true, bulky: true };
}

const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const FLASH_LOOK = { skin: '#ffd0c0', skinS: '#f09080', shirt: '#ffe6dc', shirtS: '#ffb0a0', pants: '#ffe0d4', pantsS: '#ffa898', vest: '#ff8a7a', vestS: '#e06050' };
function paletteOf(look, flash) {
  const k = flash ? '_pf' : '_p';
  if (look[k]) return look[k];
  const src = flash ? Object.assign({}, look, FLASH_LOOK) : look;
  return (look[k] = PAL_KEYS.map(n => src[n] ? rgbOf(src[n]) : null));
}

const dirv = a => { const r = a * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; };
function ik2(root, t, l1, l2, pick) {
  let dx = t[0] - root[0], dy = t[1] - root[1], d = Math.hypot(dx, dy) || 0.001;
  const dc = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const ux = dx / d, uy = dy / d, a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const m = [root[0] + ux * a, root[1] + uy * a], c1 = [m[0] - uy * hh, m[1] + ux * hh], c2 = [m[0] + uy * hh, m[1] - ux * hh];
  const j = pick(c1) >= pick(c2) ? c1 : c2, ex = t[0] - j[0], ey = t[1] - j[1], el = Math.hypot(ex, ey) || 1;
  return [j, [j[0] + ex / el * l2, j[1] + ey / el * l2]];
}

function rasterize(pose, look, o) {
  const N = SPR_W * SPR_H, buf = new Uint8Array(N), lay = new Uint8Array(N);
  let lid = 0;
  const put = (i, j, c) => { if (i < 0 || j < 0 || i >= SPR_W || j >= SPR_H) return; const k = j * SPR_W + i; buf[k] = c; lay[k] = lid; };
  const cap = (a, b, ra, rb, c) => {
    const x0 = Math.floor(Math.min(a[0] - ra, b[0] - rb) + SPR_OX) - 1, x1 = Math.ceil(Math.max(a[0] + ra, b[0] + rb) + SPR_OX) + 1;
    const y0 = Math.floor(Math.min(a[1] - ra, b[1] - rb) + SPR_OY) - 1, y1 = Math.ceil(Math.max(a[1] + ra, b[1] + rb) + SPR_OY) + 1;
    const vx = b[0] - a[0], vy = b[1] - a[1], ll = vx * vx + vy * vy || 1e-6;
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const px = i + 0.5 - SPR_OX, py = j + 0.5 - SPR_OY;
      const t = clamp(((px - a[0]) * vx + (py - a[1]) * vy) / ll, 0, 1);
      const r = ra + (rb - ra) * t, qx = a[0] + vx * t - px, qy = a[1] + vy * t - py;
      if (qx * qx + qy * qy <= r * r) put(i, j, c);
    }
  };
  const disc = (p, r, c, test) => {
    for (let j = Math.floor(p[1] - r + SPR_OY) - 1; j <= Math.ceil(p[1] + r + SPR_OY); j++)
      for (let i = Math.floor(p[0] - r + SPR_OX) - 1; i <= Math.ceil(p[0] + r + SPR_OX); i++) {
        const px = i + 0.5 - SPR_OX, py = j + 0.5 - SPR_OY, dx = px - p[0], dy = py - p[1];
        if (dx * dx + dy * dy <= r * r && (!test || test(px, py))) put(i, j, c);
      }
  };
  const add = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];

  const hip = pose.h, tv = dirv(180 - pose.t); // torso points up, leaning forward
  const sh = add(hip, [tv[0], tv[1]], TORSO);
  const hv = dirv(180 - pose.t - (pose.hd || 0)), head = add(sh, hv, 5);
  const leg = (t, kd) => ik2(hip, t, LEG1, LEG2, p => p[0] * (kd || 1));
  const arm = (ang, hand, mode) => {
    if (hand) { const e = ik2(sh, hand, ARM1, ARM2, mode === 'down' ? p => p[1] : p => -p[0]); return e; }
    const e = add(sh, dirv(ang[0]), ARM1); return [e, add(e, dirv(ang[1]), ARM2)];
  };
  const LN = leg(pose.f, pose.fk), LF = leg(pose.b, pose.bk);
  const AN = arm(pose.af, pose.hf, pose.e), AF = arm(pose.ab, pose.hb, pose.e);
  const bulk = look.bulky ? 0.4 : 0;
  const foot = (knee, ank, c) => {
    const sv = [ank[0] - knee[0], ank[1] - knee[1]], sl = Math.hypot(sv[0], sv[1]) || 1;
    const fv = ank[1] > -2.5 && sv[1] > 0 ? [1, 0.1] : [sv[1] / sl, -sv[0] / sl];
    cap(ank, add(ank, fv, 3.2), 1.4, 1.1, c);
  };
  const drawLeg = (L, near) => {
    const [knee, ank] = L;
    if (look.dress) { foot(knee, ank, PI_.shoe); return; }
    cap(hip, knee, 2.9 + bulk, 2.3 + bulk, near ? PI_.pants : PI_.pantsS);
    cap(knee, ank, 2.3 + bulk, 1.9, near ? PI_.pants : PI_.pantsS);
    if (look.helmet) cap(add(knee, [ank[0] - knee[0], ank[1] - knee[1]], 0.45), ank, 2.1, 1.9, PI_.shoe); // boots
    foot(knee, ank, PI_.shoe);
  };
  const drawArm = (A, near) => {
    const [el, hand] = A;
    cap(sh, el, 1.7 + bulk, 1.4 + bulk, near ? PI_.shirt : PI_.shirtS);
    cap(el, hand, 1.4, 1.15, look.sleeves ? (near ? PI_.shirt : PI_.shirtS) : (near ? PI_.skin : PI_.skinS));
    disc(hand, 1.45, near ? PI_.skin : PI_.skinS);
  };

  // far arm, far leg
  lid = 1; drawArm(AF, false);
  lid = 2; drawLeg(LF, false);
  // scabbard while the sword is put away
  lid = 3;
  if (o.scabbard && pose.sw == null) { const a = add(hip, tv, 2), b = add(a, dirv(-58), 11); cap(a, b, 1.0, 0.9, PI_.scab); disc(add(a, dirv(122), 1.5), 0.9, PI_.hilt); }
  // body
  lid = 4;
  if (look.dress) {
    const fx = (pose.f[0] + pose.b[0]) / 2, top = hip[1] - 2;
    for (let j = Math.floor(top + SPR_OY); j < SPR_OY; j++) {
      const py = j + 0.5 - SPR_OY, s = (py - top) / (0 - top), cx = hip[0] + (fx - hip[0]) * s, w = 3 + s * 6.5;
      for (let i = Math.floor(cx - w + SPR_OX); i <= Math.ceil(cx + w + SPR_OX); i++) {
        const px = i + 0.5 - SPR_OX; if (Math.abs(px - cx) <= w) put(i, j, px < cx - w * 0.35 ? PI_.dressS : PI_.dress);
      }
    }
  } else disc(hip, 3.0 + bulk, PI_.pants);
  cap(hip, sh, 3.3 + bulk, 3.7 + bulk, PI_.shirt);
  if (!look.dress) {
    const nv = [-tv[1], tv[0]]; // points backward relative to the lean
    cap(add(add(hip, tv, 2.4), nv, -0.9), add(add(sh, tv, -0.6), nv, -0.9), 3.0 + bulk, 3.3 + bulk, PI_.vest);
    cap(add(hip, tv, 0.5), add(hip, tv, 2.4), 3.6 + bulk, 3.6 + bulk, PI_.sash);
  } else cap(add(hip, tv, 1.2), add(hip, tv, 2.4), 3.4, 3.4, PI_.sash);
  // near leg
  lid = 5; drawLeg(LN, true);
  // head
  lid = 6;
  if (look.longHair) cap(add(head, [-1.2, 0], 1), add(sh, [-2.2, 3], 1), 2.6, 2.2, PI_.hair);
  cap(sh, head, 1.6, 1.8, PI_.skinS);
  disc(add(head, [-1.4, 0.4], 1), 2.9, PI_.hair);
  disc(head, 3.5, PI_.skin);
  const fwd = [-hv[1], hv[0]], up = hv; // forward / up in the head's frame
  const hp = (a, b) => [head[0] + fwd[0] * a + up[0] * b, head[1] + fwd[1] * a + up[1] * b];
  const rel = (px, py) => { const dx = px - head[0], dy = py - head[1]; return [dx * fwd[0] + dy * fwd[1], dx * up[0] + dy * up[1]]; };
  if (look.turban) {
    disc(hp(-0.4, 1.1), 3.9, PI_.head, (px, py) => rel(px, py)[1] > 0.3);
    disc(hp(-0.4, 1.1), 3.9, PI_.headS, (px, py) => { const q = rel(px, py); return q[1] > 0.3 && q[1] < 1.4 && q[0] < -1; });
    disc(hp(0.2, 4.4), 1.2, PI_.head);
    disc(hp(1.4, 2.0), 0.7, PI_.vest);
  }
  if (look.helmet) {
    disc(hp(-0.2, 0.9), 3.9, PI_.head, (px, py) => rel(px, py)[1] > 0.5);
    disc(hp(-0.2, 0.9), 3.9, PI_.headS, (px, py) => { const q = rel(px, py); return q[1] > 0.5 && q[1] < 1.5; });
    cap(hp(0, 4.2), hp(0, 6.0), 0.7, 0.4, PI_.head);
    disc(head, 3.6, PI_.beard, (px, py) => { const q = rel(px, py); return q[1] < -0.9 && q[0] > -1.6; });
  }
  if (look.tiara) disc(hp(0, 2.4), 3.0, PI_.trim, (px, py) => { const q = rel(px, py); return q[1] > 2.2 && q[1] < 3.2; });
  { const e = hp(1.9, 0.4); put(Math.floor(e[0] + SPR_OX), Math.floor(e[1] + SPR_OY), PI_.eye); }
  // near arm, sword, potion
  lid = 7; drawArm(AN, true);
  if (pose.sw != null) {
    const hand = AN[1], bv = dirv(pose.sw), pv = [-bv[1], bv[0]];
    lid = 8;
    cap(add(hand, bv, 1.6), add(hand, bv, BLADE), 0.75, 0.45, PI_.blade);
    cap(add(add(hand, bv, 1.6), pv, 2.4), add(add(hand, bv, 1.6), pv, -2.4), 0.6, 0.6, PI_.hilt);
    disc(add(hand, bv, -1.8), 0.9, PI_.hilt);
  }
  if (o.hold) { lid = 8; disc(add(AN[1], [1, -2], 1), 1.9, PI_.hold); }

  // dark rim where the near limbs cross the body, then the outline round the whole figure
  const rim = [];
  for (let k = 0; k < N; k++) {
    const L = lay[k]; if (!buf[k] || (L !== 5 && L !== 7)) continue;
    for (const d of [1, -1, SPR_W, -SPR_W]) { const q = k + d; if (q >= 0 && q < N && buf[q] && lay[q] < L && lay[q] !== 5) rim.push(q); }
  }
  for (const q of rim) buf[q] = PI_.outline;
  const out = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (buf[k]) continue;
    const i = k % SPR_W;
    if ((i > 0 && buf[k - 1]) || (i < SPR_W - 1 && buf[k + 1]) || (k >= SPR_W && buf[k - SPR_W]) || (k < N - SPR_W && buf[k + SPR_W])) out[k] = 1;
  }
  for (let k = 0; k < N; k++) if (out[k]) buf[k] = PI_.outline;

  const pal = paletteOf(look, o.flash);
  if (o.hold) pal[PI_.hold] = rgbOf(o.hold);
  const cv = document.createElement('canvas'); cv.width = SPR_W; cv.height = SPR_H;
  const g = cv.getContext('2d'), img = g.createImageData(SPR_W, SPR_H), d = img.data;
  for (let k = 0; k < N; k++) {
    const c = buf[k]; if (!c) continue;
    const col = pal[c] || pal[PI_.outline];
    d[k * 4] = col[0]; d[k * 4 + 1] = col[1]; d[k * 4 + 2] = col[2]; d[k * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

const spriteCache = new WeakMap();
function spriteFor(pose, look, o) {
  let m = spriteCache.get(pose); if (!m) spriteCache.set(pose, m = new Map());
  const k = look.id + (o.flash ? 'f' : '') + (o.scabbard ? 's' : '') + (o.hold || '');
  let c = m.get(k); if (!c) m.set(k, c = rasterize(pose, look, o));
  return c;
}

// Draws one frame with its feet at world (x, y), facing dir.
function drawSprite(ctx, x, y, dir, pose, look, o = {}) {
  const c = spriteFor(pose, look, o);
  const sx = Math.round(x / SP) * SP, sy = Math.round(y / SP) * SP;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.shadow) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(sx - 16, sy, 32, 2); ctx.fillRect(sx - 12, sy + 2, 24, 2); }
  ctx.imageSmoothingEnabled = false;
  ctx.translate(sx, sy); ctx.scale(dir, 1);
  ctx.drawImage(c, -SPR_OX * SP, -SPR_OY * SP, SPR_W * SP, SPR_H * SP);
  ctx.restore();
}

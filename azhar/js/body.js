// Character renderer. Works in a local frame: origin between the feet on the ground,
// +x is the facing direction, y grows downward. Each part is outlined first, then filled,
// so overlapping parts of one body read as a single silhouette.
const LEN = { thigh: 26, shin: 25, torso: 27, neck: 5, upper: 17, fore: 15 };
const OUT = 'rgba(14,9,6,.78)';

const _shadeCache = new Map();
function tint(hex, amt) { // amt > 0 lightens, < 0 darkens
  const k = hex + amt; if (_shadeCache.has(k)) return _shadeCache.get(k);
  let r, g, b;
  if (hex[0] === '#') { const v = parseInt(hex.slice(1), 16); r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255; }
  else [r, g, b] = hex.match(/[\d.]+/g).map(Number); // already an rgb() string
  if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; } else { r *= 1 + amt * 0.8; g *= 1 + amt; b *= 1 + amt * 1.25; } // shadows stay warm
  const s = `rgb(${r | 0},${g | 0},${b | 0})`; _shadeCache.set(k, s); return s;
}
const fk = (p, a, l) => [p[0] + Math.sin(a) * l, p[1] + Math.cos(a) * l];
function ik(root, t, l1, l2, bend) {
  const dx = t[0] - root[0], dy = t[1] - root[1], d0 = Math.hypot(dx, dy) || 0.001, d = Math.min(d0, l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx), a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const j = [root[0] + Math.cos(base + bend * a) * l1, root[1] + Math.sin(base + bend * a) * l1];
  const ex = root[0] + Math.cos(base) * d, ey = root[1] + Math.sin(base) * d;
  return [j, [ex, ey]];
}

function capsulePath(ctx, a, b, ra, rb) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  ctx.beginPath(); ctx.arc(b[0], b[1], rb, ang - Math.PI / 2, ang + Math.PI / 2); ctx.arc(a[0], a[1], ra, ang + Math.PI / 2, ang + Math.PI * 1.5); ctx.closePath();
}
function part(ctx, pathFn, fill, ow = 2.2) {
  pathFn(); ctx.lineWidth = ow; ctx.strokeStyle = OUT; ctx.stroke(); ctx.fillStyle = fill; ctx.fill();
}
// Cylinder shading: light on the upper/front side of the segment.
function limb(ctx, a, b, ra, rb, col) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang), ny = Math.cos(ang), r = Math.max(ra, rb);
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const g = ctx.createLinearGradient(m[0] - nx * r, m[1] - ny * r, m[0] + nx * r, m[1] + ny * r);
  const flip = ny < 0 || (Math.abs(ny) < 0.2 && nx > 0);
  g.addColorStop(0, tint(col, flip ? -0.32 : 0.22)); g.addColorStop(0.45, col); g.addColorStop(1, tint(col, flip ? 0.22 : -0.32));
  part(ctx, () => capsulePath(ctx, a, b, ra, rb), g);
}
function smoothClosed(ctx, pts) {
  ctx.beginPath();
  const n = pts.length, mid = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  const s = mid(n - 1); ctx.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const m = mid(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  ctx.closePath();
}

function drawFoot(ctx, ankle, f, col, boot, flat) {
  const nx = -f[1], ny = f[0]; // "down" relative to the foot
  const P = (a, b) => [ankle[0] + f[0] * a + nx * b, ankle[1] + f[1] * a + ny * b];
  const pts = boot
    ? [P(-4, -2), P(-4.5, 3), P(9.5, 3), P(10.5, 0.5), P(5, -2.2)]
    : [P(-3.5, -1.5), P(-4, 3), P(9, 3), P(12.5, 0.2), P(13.5, -2.6), P(10.5, -0.8), P(4.5, -1.6)];
  const g = ctx.createLinearGradient(...P(0, -2), ...P(0, 3)); g.addColorStop(0, tint(col, 0.25)); g.addColorStop(1, tint(col, -0.35));
  part(ctx, () => smoothClosed(ctx, pts), g, 2);
  if (!boot) { ctx.strokeStyle = 'rgba(230,190,90,.7)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(...P(-2, 0.4)); ctx.lineTo(...P(8, 0.4)); ctx.stroke(); }
}

function drawLeg(ctx, hip, knee, ankle, S, flat, back) {
  const pants = back ? tint(S.pants, -0.16) : S.pants;
  limb(ctx, hip, knee, 5.8, 4.4, pants);
  if (S.boots && S.bootTall) {
    limb(ctx, knee, ankle, 5.2, 4, pants);
    const bk = [knee[0] + (ankle[0] - knee[0]) * 0.38, knee[1] + (ankle[1] - knee[1]) * 0.38];
    limb(ctx, bk, ankle, 4.8, 3.9, back ? tint(S.boots, -0.25) : S.boots);
  } else {
    limb(ctx, knee, ankle, 4.6, 2.9, pants);
    // gathered cuff + bare ankle
    const d = [ankle[0] - knee[0], ankle[1] - knee[1]], l = Math.hypot(d[0], d[1]) || 1, u = [d[0] / l, d[1] / l];
    part(ctx, () => capsulePath(ctx, [ankle[0] - u[0] * 3, ankle[1] - u[1] * 3], [ankle[0] - u[0] * 1, ankle[1] - u[1] * 1], 3.2, 3.0), tint(pants, -0.12), 1.6);
  }
  const sd = [ankle[0] - knee[0], ankle[1] - knee[1]], sl = Math.hypot(sd[0], sd[1]) || 1;
  let f = flat ? [1, 0] : [sd[1] / sl, -sd[0] / sl];
  drawFoot(ctx, [ankle[0], ankle[1] + (S.bootTall ? 0 : 0.5)], f, back ? tint(S.shoe, -0.25) : S.shoe, !!S.bootTall, flat);
}

function drawArm(ctx, sh, el, hand, S, back, grip) {
  const sleeve = back ? tint(S.shirt, -0.16) : S.shirt, skin = back ? S.skinS : S.skin;
  if (S.fullSleeve) {
    limb(ctx, sh, el, 4.8, 4, sleeve);
    limb(ctx, el, hand, 4, 3.2, back ? tint(S.bracer, -0.25) : S.bracer);
  } else {
    limb(ctx, el, hand, 3.4, 2.7, skin);
    limb(ctx, sh, el, 5.2, 4.4, sleeve); // loose sleeve over the elbow
  }
  part(ctx, () => { ctx.beginPath(); ctx.ellipse(hand[0], hand[1], grip ? 3.8 : 3.3, grip ? 3.2 : 3.6, 0, 0, Math.PI * 2); }, skin, 1.8);
}

function torsoPts(P0, u, n, L, spec) {
  return spec.map(([s, w]) => [P0[0] + u[0] * L * s + n[0] * w, P0[1] + u[1] * L * s + n[1] * w]);
}
const TORSO_MALE = [[0, -8], [0.3, -6.6], [0.62, -7.6], [0.9, -6.6], [1.02, -2.5], [1.02, 3], [0.9, 7.4], [0.68, 8.4], [0.42, 6.4], [0.15, 7.6], [0, 7]];
const TORSO_BULKY = [[0, -9], [0.3, -7.8], [0.62, -8.8], [0.9, -7.6], [1.02, -3], [1.02, 3.4], [0.9, 8.6], [0.62, 10], [0.35, 9.6], [0.12, 8.4], [0, 7.6]];
const TORSO_FEMALE = [[0, -7], [0.3, -5.2], [0.6, -5.8], [0.9, -5.4], [1.02, -2.2], [1.02, 2.6], [0.88, 5.6], [0.7, 7.6], [0.5, 4.6], [0.25, 5.2], [0, 6.4]];

function drawHead(ctx, H, ang, S, opts, sway) {
  ctx.save(); ctx.translate(H[0], H[1]); ctx.rotate(ang);
  const sk = ctx.createRadialGradient(3, -3, 1, 0, 0, 10); sk.addColorStop(0, tint(S.skin, 0.15)); sk.addColorStop(1, S.skinS);
  if (S.longHair) { // hair falling behind
    part(ctx, () => { ctx.beginPath(); ctx.moveTo(-3, -8); ctx.bezierCurveTo(-12, -6, -10 - sway, 12, -8 - sway * 1.5, 26); ctx.lineTo(-2, 22); ctx.bezierCurveTo(-3, 12, -1, 6, 0, 0); ctx.closePath(); }, S.hair);
  }
  const skull = () => { ctx.beginPath(); ctx.ellipse(-0.5, -1.2, 7.4, 7.9, 0, 0, Math.PI * 2); };
  const face = () => { ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(6.4, -4.4); ctx.quadraticCurveTo(7.4, -2.6, 7.3, -1.4); ctx.lineTo(9.4, 1.6); ctx.quadraticCurveTo(8.8, 2.4, 7.4, 2.3);
    ctx.quadraticCurveTo(7.9, 3.4, 7.2, 4.1); ctx.quadraticCurveTo(7.4, 5.4, 6.4, 6.6); ctx.quadraticCurveTo(4.6, 8.4, 2, 7.6); ctx.lineTo(-2.5, 4.5); ctx.closePath(); };
  ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; skull(); ctx.stroke(); face(); ctx.stroke();
  ctx.fillStyle = sk; skull(); ctx.fill(); face(); ctx.fill();
  // ear, eye, brow, mouth
  ctx.fillStyle = S.skinS; ctx.beginPath(); ctx.ellipse(-1.2, 0.6, 1.7, 2.5, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4ece0'; ctx.beginPath(); ctx.ellipse(4.9, -1.2, 1.7, 1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20140c'; ctx.beginPath(); ctx.arc(5.5, -1.15, 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = S.brow || '#24160d'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(3.1, -3.4); ctx.quadraticCurveTo(5, -4.1, 6.8, -3.4); ctx.stroke();
  ctx.strokeStyle = tint(S.skinS, -0.3); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(6.6, 4.3); ctx.lineTo(5.3, 4.5); ctx.stroke();
  if (S.female) { ctx.fillStyle = 'rgba(200,80,90,.35)'; ctx.beginPath(); ctx.arc(4.5, 2.4, 1.6, 0, 7); ctx.fill(); }
  if (opts.beard) {
    part(ctx, () => { ctx.beginPath(); ctx.moveTo(-1.5, 2); ctx.quadraticCurveTo(1, 4.5, 3.5, 4.2); ctx.lineTo(7.6, 3.4); ctx.quadraticCurveTo(8.2, 6, 6.6, 9.5);
      ctx.quadraticCurveTo(3.5, 11.5, 0.5, 8.5); ctx.quadraticCurveTo(-2, 6, -1.5, 2); ctx.closePath(); }, S.beard || '#1d140e', 1.4);
    ctx.fillStyle = S.beard || '#1d140e'; ctx.beginPath(); ctx.ellipse(7.2, 3.1, 2.4, 1, -0.2, 0, 7); ctx.fill();
  } else if (!S.female) { // short hair at the nape and sideburn
    ctx.fillStyle = S.hair; ctx.beginPath(); ctx.moveTo(-7.6, -2); ctx.quadraticCurveTo(-8.4, 3.5, -5, 5.5); ctx.lineTo(-3.2, 2); ctx.lineTo(-2, -3); ctx.closePath(); ctx.fill();
    ctx.fillRect(0.4, -3.4, 1.6, 4.4);
  }
  // headwear
  if (S.headwear === 'turban') {
    const tg = ctx.createLinearGradient(0, -12, 0, -1); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, S.turban); tg.addColorStop(1, tint(S.turban, -0.3));
    part(ctx, () => { ctx.beginPath(); ctx.moveTo(-8.4, -0.6); ctx.bezierCurveTo(-10.4, -7, -6, -12.6, 0.5, -12.4); ctx.bezierCurveTo(6.5, -12.2, 9.4, -8, 8.2, -3.6);
      ctx.quadraticCurveTo(3, -5.2, -1, -3.2); ctx.quadraticCurveTo(-5, -1.6, -8.4, -0.6); ctx.closePath(); }, tg);
    ctx.strokeStyle = tint(S.turban, -0.28); ctx.lineWidth = 0.9;
    for (const k of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(-8 + k * 0.6, -3 - k * 2.6); ctx.quadraticCurveTo(0, -7 - k * 2.4, 7.8, -5 - k * 2); ctx.stroke(); }
    if (opts.jewel) {
      ctx.strokeStyle = 'rgba(240,230,210,.9)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(5.5, -8.5); ctx.quadraticCurveTo(4 - sway, -16, -1 - sway * 2, -18); ctx.stroke();
      part(ctx, () => { ctx.beginPath(); ctx.arc(6, -7.6, 2.3, 0, 7); }, '#d4a24c', 1.2);
      ctx.fillStyle = opts.jewel; ctx.beginPath(); ctx.arc(6, -7.6, 1.4, 0, 7); ctx.fill();
    }
  } else if (S.headwear === 'helmet') {
    const hg = ctx.createLinearGradient(-6, -14, 6, -2); hg.addColorStop(0, tint(S.helmet, 0.45)); hg.addColorStop(0.5, S.helmet); hg.addColorStop(1, tint(S.helmet, -0.4));
    part(ctx, () => { ctx.beginPath(); ctx.moveTo(-8.6, -2.4); ctx.bezierCurveTo(-9, -11, -3, -14.5, 0, -18.5); ctx.bezierCurveTo(3, -14.5, 9, -11, 8.4, -3.4); ctx.closePath(); }, hg);
    part(ctx, () => { ctx.beginPath(); ctx.moveTo(-9, -1.6); ctx.quadraticCurveTo(0, -6.5, 8.8, -2.8); ctx.lineTo(8.6, -5.2); ctx.quadraticCurveTo(0, -9, -8.8, -4.4); ctx.closePath(); }, S.turban, 1.6);
    ctx.fillStyle = tint(S.helmet, -0.3); ctx.fillRect(6.6, -4, 1.4, 5.5);
  } else if (S.tiara) {
    ctx.fillStyle = S.hair; ctx.beginPath(); ctx.ellipse(-1, -3.5, 8, 6.4, -0.2, Math.PI * 0.95, Math.PI * 2.08); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6.8, -4.6); ctx.quadraticCurveTo(5, -0.5, 2.2, -3.6); ctx.fill();
    ctx.strokeStyle = '#e8c35a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-6, -7.6); ctx.quadraticCurveTo(0, -10.6, 6, -7); ctx.stroke();
    ctx.fillStyle = '#4fd1c5'; ctx.beginPath(); ctx.arc(1.5, -9.6, 1.3, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawSword(ctx, hand, ang) {
  const dx = Math.sin(ang), dy = Math.cos(ang), px = -dy, py = dx;
  const at = (a, b) => [hand[0] + dx * a + px * b, hand[1] + dy * a + py * b];
  // curved scimitar blade
  ctx.beginPath(); ctx.moveTo(...at(4, -1.4)); ctx.quadraticCurveTo(...at(26, -2.6), ...at(44, 2.4)); ctx.quadraticCurveTo(...at(26, 2.4), ...at(4, 1.4)); ctx.closePath();
  ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
  const g = ctx.createLinearGradient(...at(0, -2), ...at(0, 2)); g.addColorStop(0, '#f6f9ff'); g.addColorStop(0.5, '#b9c2cc'); g.addColorStop(1, '#6d757e');
  ctx.fillStyle = g; ctx.fill();
  part(ctx, () => capsulePath(ctx, at(2.5, -5), at(2.5, 5), 1.4, 1.4), '#d4a24c', 1.4);
  part(ctx, () => capsulePath(ctx, at(-5, 0), at(1.5, 0), 1.6, 1.6), '#4a2c18', 1.4);
}

function drawFigure(ctx, x, y, dir, ps, st, opts = {}) {
  const s = opts.solved || solvePose(ps), v = s.v;
  if (s.alpha <= 0.01) return;
  if (s.flip) dir = -dir;
  const S = opts.flash > 0 && Math.floor(opts.flash * 20) % 2 === 0 ? Object.assign({}, st, FLASH) : st;
  const sway = opts.still ? 0 : (opts.flow || 0) * Math.sin(L.time * 10 + x * 0.03) * 2 + (opts.flow ? 1.5 * opts.flow : 0);
  const rot = v[13], dy = v[14];
  ctx.save();
  ctx.globalAlpha = s.alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (opts.ground && Math.abs(rot) < 0.3) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 19, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.translate(x, y + dy); ctx.scale(dir * FIG_SC, FIG_SC); if (rot) ctx.rotate(rot);

  const hip = [v[0], v[1]], lean = v[2], u = [Math.sin(lean), -Math.cos(lean)], n = [-u[1], u[0]];
  const neck = [hip[0] + u[0] * LEN.torso, hip[1] + u[1] * LEN.torso];
  const sh = [neck[0] - u[0] * 3.5 - n[0] * 0.5, neck[1] - u[1] * 3.5 - n[1] * 0.5];
  const hAng = lean * 0.55 + v[3];
  const head = [neck[0] + Math.sin(hAng) * 9.5, neck[1] - Math.cos(hAng) * 9.5];
  const legOf = (ti, back, flat) => { const h = [hip[0] - n[0] * (back ? 1.5 : -1.5), hip[1]], k = fk(h, v[ti], LEN.thigh); return [h, k, fk(k, v[ti + 1], LEN.shin), flat]; };
  const armOf = (ti, grip) => { const e = fk(sh, v[ti], LEN.upper); return [e, fk(e, v[ti + 1], LEN.fore), grip]; };
  const LF = legOf(4, false, s.flatF), LB = legOf(6, true, s.flatB), AF = armOf(8, s.gripF), AB = armOf(10, s.gripB);
  ps = { sword: s.hasSword ? v[12] : null, legF: (ps && ps.legF) || T_(6, -3), legB: (ps && ps.legB) || T_(-6, -3) };

  // back arm, back leg
  drawArm(ctx, sh, AB[0], AB[1], S, true, AB[2]);
  if (!S.dress) drawLeg(ctx, LB[0], LB[1], LB[2], S, LB[3], true);
  // scabbard on the hip while the sword is sheathed
  if (opts.hasSword && !opts.swordDrawn) {
    const a = [hip[0] - n[0] * 3 + u[0] * 6, hip[1] - n[1] * 3 + u[1] * 6], b = [a[0] - 24, a[1] + 18];
    part(ctx, () => capsulePath(ctx, a, b, 2.4, 2), '#5a3a1e', 1.8); ctx.fillStyle = '#d4a24c'; ctx.beginPath(); ctx.arc(b[0], b[1], 2.2, 0, 7); ctx.fill();
    part(ctx, () => capsulePath(ctx, [a[0] + 3, a[1] - 2.5], [a[0] + 7, a[1] - 5.5], 1.6, 1.6), '#4a2c18', 1.2);
  }
  // skirt or pelvis
  if (S.dress) {
    const fl = ps.legF.t ? ps.legF.t[0] : 6, bl = ps.legB.t ? ps.legB.t[0] : -6;
    const sk = ctx.createLinearGradient(-16, 0, 16, 0); sk.addColorStop(0, tint(S.dressCol, -0.3)); sk.addColorStop(0.55, S.dressCol); sk.addColorStop(1, tint(S.dressCol, -0.15));
    part(ctx, () => { ctx.beginPath(); ctx.moveTo(hip[0] - 7, hip[1] - 3); ctx.quadraticCurveTo(hip[0] - 12, hip[1] + 26, Math.min(bl, -6) - 9 - sway, -1);
      ctx.quadraticCurveTo(2, 2, Math.max(fl, 6) + 8, -1); ctx.quadraticCurveTo(hip[0] + 11, hip[1] + 24, hip[0] + 7, hip[1] - 3); ctx.closePath(); }, sk);
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1; for (const k of [-3, 2, 6]) { ctx.beginPath(); ctx.moveTo(hip[0] + k * 0.6, hip[1] + 4); ctx.quadraticCurveTo(hip[0] + k, hip[1] + 24, k * 1.6, -2); ctx.stroke(); }
  } else {
    part(ctx, () => { ctx.beginPath(); ctx.ellipse(hip[0], hip[1] + 1, 6.8, 6.2, 0, 0, Math.PI * 2); }, S.pants, 2);
  }
  // torso
  const spec = S.female ? TORSO_FEMALE : S.bulky ? TORSO_BULKY : TORSO_MALE;
  const tg = ctx.createLinearGradient(hip[0] - n[0] * 9, hip[1] - n[1] * 9, hip[0] + n[0] * 9, hip[1] + n[1] * 9);
  tg.addColorStop(0, tint(S.shirt, -0.3)); tg.addColorStop(0.6, S.shirt); tg.addColorStop(1, tint(S.shirt, 0.12));
  part(ctx, () => smoothClosed(ctx, torsoPts(hip, u, n, LEN.torso, spec)), tg);
  ctx.strokeStyle = tint(S.shirt, -0.22); ctx.lineWidth = 0.8; // cloth folds
  for (const [s0, s1, w] of [[0.35, 0.75, 2], [0.4, 0.8, 5]]) { const p0 = torsoPts(hip, u, n, LEN.torso, [[s0, w], [s1, w - 1.5]]); ctx.beginPath(); ctx.moveTo(...p0[0]); ctx.lineTo(...p0[1]); ctx.stroke(); }
  if (S.vest) {
    const vs = S.bulky ? [[0.22, -8.6], [0.62, -9.2], [0.92, -7.8], [1.0, -2], [0.92, 6], [0.62, 9.4], [0.3, 9], [0.22, 8]]
      : [[0.25, -7.2], [0.62, -8], [0.92, -6.9], [1.0, -1.8], [0.9, 3.4], [0.62, 2], [0.32, 2.8]];
    const vg = ctx.createLinearGradient(hip[0] - n[0] * 9, hip[1] - n[1] * 9, hip[0] + n[0] * 9, hip[1] + n[1] * 9);
    vg.addColorStop(0, tint(S.vest, -0.35)); vg.addColorStop(1, tint(S.vest, 0.15));
    part(ctx, () => smoothClosed(ctx, torsoPts(hip, u, n, LEN.torso, vs)), vg, 1.6);
    ctx.strokeStyle = S.trim; ctx.lineWidth = 1.1; smoothClosed(ctx, torsoPts(hip, u, n, LEN.torso, vs)); ctx.stroke();
    if (S.bulky) { ctx.fillStyle = S.trim; for (const [s, w] of [[0.4, -4], [0.4, 2], [0.4, 7], [0.7, -4], [0.7, 2], [0.7, 7]]) { const p = torsoPts(hip, u, n, LEN.torso, [[s, w]])[0]; ctx.beginPath(); ctx.arc(p[0], p[1], 0.9, 0, 7); ctx.fill(); } }
  }
  // sash with hanging tail
  const band = torsoPts(hip, u, n, LEN.torso, [[0.13, -8.2], [0.29, -7.2], [0.29, 7.6], [0.13, 8.2]]);
  part(ctx, () => { ctx.beginPath(); ctx.moveTo(...band[0]); band.forEach(p => ctx.lineTo(...p)); ctx.closePath(); }, S.sash, 1.6);
  const tb = torsoPts(hip, u, n, LEN.torso, [[0.2, -7]])[0];
  part(ctx, () => { ctx.beginPath(); ctx.moveTo(tb[0], tb[1] - 2); ctx.quadraticCurveTo(tb[0] - 6 - sway * 2, tb[1] + 6, tb[0] - 5 - sway * 4, tb[1] + 17 - sway);
    ctx.lineTo(tb[0] - 1 - sway * 3, tb[1] + 16 - sway); ctx.quadraticCurveTo(tb[0] - 2 - sway, tb[1] + 6, tb[0] + 1, tb[1] + 1); ctx.closePath(); }, tint(S.sash, -0.12), 1.4);
  // neck, front leg, head
  part(ctx, () => capsulePath(ctx, [neck[0] - u[0] * 2, neck[1] - u[1] * 2], [head[0] - Math.sin(hAng) * 4, head[1] + Math.cos(hAng) * 4], 3.6, 3.2), S.skinS, 1.8);
  if (!S.dress) drawLeg(ctx, LF[0], LF[1], LF[2], S, LF[3], false);
  drawHead(ctx, head, hAng, S, opts, sway);
  // front arm and sword
  if (opts.swordDrawn && ps.sword != null) { drawArm(ctx, sh, AF[0], AF[1], S, false, true); drawSword(ctx, AF[1], ps.sword); part(ctx, () => { ctx.beginPath(); ctx.ellipse(AF[1][0], AF[1][1], 3.6, 3.2, 0, 0, 7); }, S.skin, 1.6); }
  else drawArm(ctx, sh, AF[0], AF[1], S, false, AF[2]);
  if (opts.hold) { // potion flask in the hand, tipped toward the mouth
    const h = AF[1];
    part(ctx, () => { ctx.beginPath(); ctx.arc(h[0] + 2, h[1] - 3, 4, 0, 7); }, opts.hold, 1.4);
    part(ctx, () => capsulePath(ctx, [h[0] + 3, h[1] - 7], [h[0] + 5, h[1] - 11], 1.6, 1.4), '#cfe0f0', 1.2);
    drawArm(ctx, sh, AF[0], AF[1], S, false, true);
  }
  ctx.restore();
}

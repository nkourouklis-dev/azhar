// Static level art, painted once per level into an offscreen canvas.
const THEMES = {
  dungeon: { bh: 214, bs: 15, bl: 23, mortar: '#090d15', blk: [214, 13, 33], top: '#97a1b0', face: [214, 13, 29], dark: 'rgba(3,6,16,0.66)', glow: 'rgba(255,138,60,', sky: null },
  palace: { bh: 32, bs: 36, bl: 37, mortar: '#24160c', blk: [36, 30, 50], top: '#eadbb8', face: [34, 28, 42], dark: 'rgba(22,10,34,0.42)', glow: 'rgba(255,170,90,', sky: true },
};
let RS = 2, BG = null;
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const staticFloor = ch => '_^cpgEQ'.includes(ch);

function paintLevel() {
  const T = THEMES[L.theme], w = L.cols * W, h = L.rows * H;
  BG = document.createElement('canvas'); BG.width = Math.ceil(w * RS); BG.height = Math.ceil(h * RS);
  const g = BG.getContext('2d'); g.scale(RS, RS);

  // back wall bricks
  g.fillStyle = T.mortar; g.fillRect(0, 0, w, h);
  const bw = 42, bhgt = 21;
  for (let y = 0, row = 0; y < h; y += bhgt, row++) {
    for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
      const n = hash(x | 0, y | 0), n2 = hash(y | 0, x + 7 | 0);
      g.fillStyle = hsl(T.bh + (n2 - 0.5) * 8, T.bs + (n - 0.5) * 6, T.bl + (n - 0.5) * 7);
      g.fillRect(x + 1, y + 1, bw - 2, bhgt - 2);
      g.fillStyle = 'rgba(255,255,255,.055)'; g.fillRect(x + 1, y + 1, bw - 2, 1.5);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + 1, y + bhgt - 3, bw - 2, 2);
      if (n > 0.93) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 8 + n2 * 20, y + 2); g.lineTo(x + 14 + n2 * 18, y + 10); g.lineTo(x + 10 + n2 * 22, y + 19); g.stroke(); }
    }
  }
  // grain
  for (let i = 0; i < w * h / 90; i++) {
    const x = hash(i, 3) * w, y = hash(i, 9) * h;
    g.fillStyle = hash(i, 5) > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.18)';
    g.fillRect(x, y, 1 + hash(i, 1) * 1.5, 1 + hash(i, 2) * 1.5);
  }
  // row shading: ceilings dim, floors catch a little light
  for (let r = 0; r < L.rows; r++) {
    const gr = g.createLinearGradient(0, r * H, 0, r * H + H);
    gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(0.35, 'rgba(0,0,0,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = gr; g.fillRect(0, r * H, w, H);
  }

  // decorations on open back wall
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    if (tile(c, r) === '#') continue;
    const n = hash(c * 7 + 1, r * 13 + 5), x = c * W, fy = floorY(r);
    if (T.sky) {
      if (n < 0.22 && !L.torches.some(t => t.c === c && t.r === r) && tile(c, r) !== 'E') paintWindow(g, x + W / 2, fy - 50, n);
      // zellige band
      for (let i = 0; i < 4; i++) { const tx = x + i * 16, ty = fy - 26; g.fillStyle = (i + c) % 2 ? '#1f5a5a' : '#c49a3c'; g.save(); g.translate(tx + 8, ty + 5); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore(); }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, fy - 34, W, 2); g.fillRect(x, fy - 15, W, 2);
    } else {
      if (n < 0.14 && tile(c, r) !== 'E') paintAlcove(g, x + W / 2, fy - 18, T);
      else if (n > 0.9) paintChains(g, x + 14 + n * 30, r * H + 2, 40 + n * 30);
    }
  }

  // wall blocks
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    if (tile(c, r) !== '#') continue;
    const x = c * W, y = r * H;
    // cast shadow onto the open neighbour on the right
    if (tile(c + 1, r) !== '#') { const s = g.createLinearGradient(x + W, 0, x + W + 22, 0); s.addColorStop(0, 'rgba(0,0,0,.5)'); s.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = s; g.fillRect(x + W, y, 22, H); }
    for (let k = 0; k < 2; k++) {
      const by = y + k * (H / 2), split = hash(c, r * 2 + k) > 0.5;
      const parts = split ? [[0, 32], [32, 32]] : [[0, 64]];
      for (const [px, pw] of parts) {
        const n = hash(c * 3 + px, r * 5 + k);
        const [hh, ss, ll] = T.blk, L0 = ll + (n - 0.5) * 6;
        const gr = g.createLinearGradient(x + px, by, x + px + pw, by + H / 2);
        gr.addColorStop(0, hsl(hh, ss, L0 + 5)); gr.addColorStop(1, hsl(hh, ss, L0 - 7));
        g.fillStyle = gr; g.fillRect(x + px + 1, by + 1, pw - 2, H / 2 - 2);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + px + 1, by + 1, pw - 2, 2); g.fillRect(x + px + 1, by + 1, 2, H / 2 - 2);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + px + 1, by + H / 2 - 4, pw - 2, 3); g.fillRect(x + px + pw - 4, by + 1, 3, H / 2 - 2);
        if (n > 0.75) { g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + px + pw * n, by + 4); g.lineTo(x + px + pw * (n - 0.3), by + 24); g.lineTo(x + px + pw * (n - 0.15), by + 50); g.stroke(); }
        if (!T.sky && n < 0.12) { g.fillStyle = 'rgba(70,110,60,.35)'; g.beginPath(); g.ellipse(x + px + pw / 2, by + H / 2 - 6, pw / 2.5, 5, 0, 0, Math.PI * 2); g.fill(); }
      }
    }
    if (tile(c, r - 1) !== '#') { g.fillStyle = T.top; g.globalAlpha = 0.7; g.fillRect(x, y - 3, W, 4); g.globalAlpha = 1; }
  }

  // floor slabs
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    const ch = tile(c, r);
    if (!staticFloor(ch)) continue;
    paintSlab(g, c, r, T, false);
    if (ch === '_' && !T.sky && hash(c * 11, r * 3) < 0.1) paintBones(g, c * W + 20 + hash(c, r) * 24, floorY(r));
    if (ch === '^') for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(c * W + 10 + i * 10, floorY(r) - 2, 5, 3); }
    if (ch === 'c') { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(c * W + 29, r * H + 6, 6, floorY(r) - r * H - 100); }
    if (ch === 'g') { g.fillStyle = '#1a1714'; g.fillRect(c * W + 20, r * H + 2, 24, 8); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(c * W + 20, r * H + 2, 24, 1.5); }
    if (ch === 'E') paintDoorFrame(g, c, r, T);
  }
  for (const t of L.torches) paintBracket(g, t.c * W + W / 2, floorY(t.r) - 62);

  // top-of-level ceiling shadow
  const cg = g.createLinearGradient(0, 0, 0, 30); cg.addColorStop(0, 'rgba(0,0,0,.6)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = cg; g.fillRect(0, 0, w, 30);
}

function paintSlab(g, c, r, T, loose) {
  const x = c * W, fy = floorY(r), bot = (r + 1) * H;
  const left = !isFloorCh(tile(c - 1, r)) && tile(c - 1, r) !== '#', right = !isFloorCh(tile(c + 1, r)) && tile(c + 1, r) !== '#';
  // shadow cast onto the wall below the slab
  if (r + 1 < L.rows && tile(c, r + 1) !== '#' && !loose) {
    const s = g.createLinearGradient(0, bot, 0, bot + 34); s.addColorStop(0, 'rgba(0,0,0,.55)'); s.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = s; g.fillRect(x, bot, W, 34);
  }
  const x0 = x + (left ? 3 : 0), x1 = x + W - (right ? 3 : 0);
  const [hh, ss, ll] = T.face, n = hash(c * 5, r * 7);
  const fg = g.createLinearGradient(0, fy, 0, bot);
  fg.addColorStop(0, hsl(hh, ss, ll + 8 + n * 4)); fg.addColorStop(1, hsl(hh, ss, ll - 6));
  g.fillStyle = fg; g.fillRect(x0, fy + 2, x1 - x0, bot - fy - 2);
  g.fillStyle = T.top; g.fillRect(x0 + 1, fy - 4, x1 - x0 - 2, 6);
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x0 + 1, fy - 4, x1 - x0 - 2, 1.2);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0, fy + 2, x1 - x0, 1);
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + W - 1, fy + 2, 1, bot - fy - 2);
  if (T.sky) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x0 + 6, fy - 3, 18, 3); }
  if (loose) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 20, fy - 3); g.lineTo(x + 26, fy + 4); g.lineTo(x + 22, bot - 1); g.moveTo(x + 44, fy - 3); g.lineTo(x + 40, fy + 6); g.stroke(); }
}

function paintAlcove(g, cx, base, T) {
  const w = 34, h = 54;
  g.save();
  g.beginPath(); g.moveTo(cx - w / 2, base); g.lineTo(cx - w / 2, base - h + w / 2); g.arc(cx, base - h + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, base); g.closePath();
  const gr = g.createLinearGradient(0, base - h, 0, base); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.stroke();
  g.restore();
}
function paintWindow(g, cx, cy, n) {
  const w = 30, h = 52;
  g.save();
  g.beginPath(); g.moveTo(cx - w / 2, cy + h / 2); g.lineTo(cx - w / 2, cy - h / 2 + w / 2);
  g.quadraticCurveTo(cx - w / 2, cy - h / 2 - 4, cx, cy - h / 2 - 12); g.quadraticCurveTo(cx + w / 2, cy - h / 2 - 4, cx + w / 2, cy - h / 2 + w / 2);
  g.lineTo(cx + w / 2, cy + h / 2); g.closePath();
  const sk = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); sk.addColorStop(0, '#0b1636'); sk.addColorStop(1, '#2b2d5a');
  g.fillStyle = sk; g.fill(); g.clip();
  for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.4 + hash(i, n * 99 | 0) * 0.6) + ')'; g.fillRect(cx - w / 2 + hash(i, 4 + n * 50 | 0) * w, cy - h / 2 + hash(i, 8 + n * 70 | 0) * h * 0.7, 1.2, 1.2); }
  if (n < 0.08) { g.fillStyle = '#f6eccb'; g.beginPath(); g.arc(cx + 5, cy - 10, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0b1636'; g.beginPath(); g.arc(cx + 8, cy - 12, 6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#1a120a'; g.fillRect(cx - 1, cy - h / 2 - 12, 2, h + 12); g.fillRect(cx - w / 2, cy, w, 2);
  g.restore();
  g.strokeStyle = '#c49a3c'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - w / 2, cy + h / 2); g.lineTo(cx - w / 2, cy - h / 2 + w / 2);
  g.quadraticCurveTo(cx - w / 2, cy - h / 2 - 4, cx, cy - h / 2 - 12); g.quadraticCurveTo(cx + w / 2, cy - h / 2 - 4, cx + w / 2, cy - h / 2 + w / 2); g.lineTo(cx + w / 2, cy + h / 2); g.stroke();
  g.fillStyle = '#8a6a2c'; g.fillRect(cx - w / 2 - 4, cy + h / 2, w + 8, 4);
}
function paintChains(g, x, y, len) {
  g.strokeStyle = 'rgba(20,22,26,.9)'; g.lineWidth = 2;
  for (let i = 0; i < len; i += 6) { g.beginPath(); g.ellipse(x, y + i, i / 6 % 2 ? 1.5 : 2.5, 3.2, 0, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(160,170,180,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 1, y); g.lineTo(x - 1, y + len); g.stroke();
}
function paintBones(g, x, y) {
  g.fillStyle = '#cfc6b0'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1;
  g.beginPath(); g.arc(x, y - 5, 5, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#222'; g.fillRect(x - 3, y - 6, 2, 2); g.fillRect(x + 1, y - 6, 2, 2);
  g.fillStyle = '#cfc6b0'; g.fillRect(x + 7, y - 3, 16, 2.5); g.beginPath(); g.arc(x + 7, y - 2, 2, 0, 7); g.arc(x + 23, y - 2, 2, 0, 7); g.fill();
}
function paintBracket(g, x, y) {
  g.fillStyle = '#15110e'; g.fillRect(x - 6, y + 4, 12, 4); g.fillRect(x - 1.5, y - 4, 3, 14);
  const wd = g.createLinearGradient(x - 3, 0, x + 3, 0); wd.addColorStop(0, '#3a2414'); wd.addColorStop(1, '#6b4426');
  g.fillStyle = wd; g.fillRect(x - 3, y - 14, 6, 16);
  g.fillStyle = '#211a14'; g.beginPath(); g.moveTo(x - 6, y - 14); g.lineTo(x + 6, y - 14); g.lineTo(x + 4, y - 9); g.lineTo(x - 4, y - 9); g.fill();
}
function paintDoorFrame(g, c, r, T) {
  const cx = c * W + W / 2, fy = floorY(r), w = 48, h = 92;
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(cx - w / 2 - 8, fy - h - 8, w + 16, h + 8);
  g.fillStyle = hsl(T.blk[0], T.blk[1], T.blk[2] + 6); g.fillRect(cx - w / 2 - 7, fy - h - 7, w + 14, 9);
  g.fillRect(cx - w / 2 - 7, fy - h, 7, h); g.fillRect(cx + w / 2, fy - h, 7, h);
  g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(cx - w / 2 - 7, fy - h - 7, w + 14, 2);
  g.fillStyle = T.top; g.fillRect(cx - w / 2 - 10, fy - 6, w + 20, 6);
}

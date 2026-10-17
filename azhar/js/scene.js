// Per-frame drawing: moving parts, characters, light, HUD.
let LIGHT = null, VIG = null;

function setupBuffers(cv) {
  LIGHT = document.createElement('canvas'); LIGHT.width = cv.width; LIGHT.height = Math.ceil(VIEW_H * RS);
  VIG = document.createElement('canvas'); VIG.width = cv.width; VIG.height = LIGHT.height;
  const v = VIG.getContext('2d'), gr = v.createRadialGradient(VIG.width / 2, VIG.height * 0.45, VIG.height * 0.35, VIG.width / 2, VIG.height / 2, VIG.width * 0.62);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)');
  v.fillStyle = gr; v.fillRect(0, 0, VIG.width, VIG.height);
}

function inView(c, r) { return c >= Cam.rx * ROOM_C - 1 && c <= Cam.rx * ROOM_C + ROOM_C && r >= Cam.ry * ROOM_R - 1 && r <= Cam.ry * ROOM_R + ROOM_R; }

let lastDraw = 0;
function drawScene(ctx) {
  const nowMs = performance.now(), dtR = Math.min(0.05, lastDraw ? (nowMs - lastDraw) / 1000 : 0.016); lastDraw = nowMs;
  const T = THEMES[L.theme], ox = Cam.rx * VIEW_W, oy = Cam.ry * VIEW_H;
  const sh = L.shake > 0 ? (Math.random() - 0.5) * 6 * L.shake / 0.25 : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(BG, ox * RS, oy * RS, VIEW_W * RS, VIEW_H * RS, sh * RS, sh * RS, VIEW_W * RS, VIEW_H * RS);
  ctx.setTransform(RS, 0, 0, RS, (-ox + sh) * RS, (-oy + sh) * RS);

  // door
  if (L.door && inView(L.door.c, L.door.r)) drawDoor(ctx, L.door);
  // plates
  for (const p of L.plates.values()) if (inView(p.c, p.r)) {
    const x = p.c * W, fy = floorY(p.r), d = p.down > 0.3 ? 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x + 8, fy - 4, 48, 6);
    ctx.fillStyle = p.link === 'E' ? '#c9a14e' : T.top; ctx.fillRect(x + 9, fy - 7 + d, 46, 5);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 9, fy - 7 + d, 46, 1);
  }
  // loose floors
  for (const l of L.loose.values()) if (inView(l.c, l.r)) {
    ctx.save(); ctx.translate(0, l.t >= 0 ? Math.abs(l.wob) : Math.sin(L.time * 0.7 + l.c) > 0.995 ? 1 : 0);
    paintSlab(ctx, l.c, l.r, T, true); ctx.restore();
  }
  for (const f of L.falling) {
    ctx.save(); ctx.translate(f.x + W / 2, f.y); ctx.rotate(Math.sin(f.rot * 3) * 0.08); ctx.translate(-f.x - W / 2, -f.y);
    ctx.fillStyle = hsl(T.face[0], T.face[1], T.face[2]); ctx.fillRect(f.x + 2, f.y + 2, W - 4, 10);
    ctx.fillStyle = T.top; ctx.fillRect(f.x + 2, f.y - 4, W - 4, 6); ctx.restore();
  }
  for (const k of L.rubble) {
    const c = k % 1000, r = (k / 1000) | 0; if (!inView(c, r)) continue;
    const fy = floorY(r);
    for (let i = 0; i < 9; i++) { const n = hash(k, i); ctx.fillStyle = i % 3 ? hsl(T.face[0], T.face[1], T.face[2] + 10) : T.top;
      ctx.beginPath(); ctx.ellipse(c * W + 6 + n * 52, fy - 2 - hash(i, k) * 3, 3 + n * 4, 2 + n * 2, n, 0, Math.PI * 2); ctx.fill(); }
  }
  // spikes
  for (const s of L.spikes.values()) if (inView(s.c, s.r) && s.ext > 0.01) {
    const x = s.c * W, fy = floorY(s.r), hgt = 24 * s.ext;
    for (let i = 0; i < 5; i++) {
      const sx = x + 12.5 + i * 10, gr = ctx.createLinearGradient(sx - 4, 0, sx + 4, 0);
      gr.addColorStop(0, '#4b525c'); gr.addColorStop(0.5, '#e8eef5'); gr.addColorStop(1, '#5b626c');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(sx - 3.5, fy); ctx.lineTo(sx, fy - hgt - (i % 2) * 4 * s.ext); ctx.lineTo(sx + 3.5, fy); ctx.fill();
    }
    if (!P.alive && P.cause === 'spikes' && pCol() === s.c) { ctx.fillStyle = 'rgba(140,20,20,.75)'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 11 + i * 10, fy - hgt * 0.7, 3, hgt * 0.5); }
  }
  // items
  for (const it of L.items.values()) if (inView(it.c, it.r)) drawItem(ctx, it);
  // princess
  if (L.princess && inView(L.princess.c, L.princess.r)) {
    const q = L.princess;
    drawFigure(ctx, q.c * W + W / 2 + 8, floorY(q.r), -1, Game.state === 'won' ? pose({ armF: A_(1.4, 1.8), armB: A_(1.1, 1.5) }) : pose(Object.assign(standPose(L.time), { armF: A_(0.45, 1.7), armB: A_(0.3, 1.6) })), PRINCESS, { ground: true });
  }
  // guards
  for (const g of guards) {
    if (g.y > 1e5 || !inView(colOf(g.x), rowOf(g.y))) continue;
    const ps = guardPose(g);
    if (!g.look) g.look = guardLook(g.style);
    drawFigure(ctx, g.x, g.y, g.dir, ps, g.look, { solved: smoothedFor(g, ps, dtR), swordDrawn: g.st !== 'dead', hasSword: g.st === 'dead', ground: true, beard: true, flash: g.flash, still: g.st === 'dead' });
    if (g.st === 'dead' && g.t < 0.6) for (let i = 0; i < 2; i++) spawn({ x: g.x - g.dir * rand(0, 40), y: g.y - 4, vx: rand(-20, 20), vy: rand(-30, -10), life: 1, g: -5, size: rand(6, 12), kind: 'dust' });
  }
  // prince
  {
    const ps = playerPose(), drawn = (P.hasSword && ['fight', 'advance', 'retreat', 'strike', 'block', 'hurt', 'parried'].includes(P.st)) || (P.st === 'draw' && P.t > 0.12) || (P.st === 'sheathe' && P.t < 0.25) || (P.st === 'pickup' && P.t > 0.5);
    drawFigure(ctx, P.x, P.y, P.dir, ps, PRINCE, { solved: smoothedFor(P, ps, dtR), swordDrawn: drawn, hasSword: P.hasSword, ground: groundedStates.has(P.st) || P.st === 'dead', flash: P.flash, flow: Math.min(1, Math.abs(P.vx) / RUN), jewel: '#b3261e', still: !P.alive, hold: P.st === 'drink' && P.t > 0.2 && P.t < 1.0 ? (P.mv.it.type === 'H' ? '#50dc8c' : '#e6323c') : null });
  }
  // front layer: gates and blades
  for (const g of L.gates.values()) if (inView(g.c, g.r)) drawGate(ctx, g);
  for (const b of L.blades.values()) if (inView(b.c, b.r)) drawBlades(ctx, b);

  // particles
  for (const p of L.particles) {
    const a = 1 - p.t / p.life;
    if (p.kind === 'chip') { ctx.fillStyle = hsl(T.face[0], T.face[1], T.face[2] + 15, a); ctx.fillRect(p.x, p.y, p.size, p.size); }
    else if (p.kind === 'dust') { ctx.fillStyle = `rgba(180,170,150,${a * 0.18})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + p.t), 0, 7); ctx.fill(); }
    else if (p.kind === 'mote') { ctx.fillStyle = `rgba(255,230,190,${Math.sin(a * Math.PI) * 0.35})`; ctx.fillRect(p.x, p.y, p.size, p.size); }
  }

  // lighting
  const lc = LIGHT.getContext('2d');
  lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, LIGHT.width, LIGHT.height);
  lc.fillStyle = T.dark; lc.fillRect(0, 0, LIGHT.width, LIGHT.height);
  lc.setTransform(RS, 0, 0, RS, (-ox + sh) * RS, (-oy + sh) * RS); lc.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const gr = lc.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); lc.fillStyle = gr; lc.fillRect(x - r, y - r, r * 2, r * 2); };
  const lights = [];
  for (const t of L.torches) if (inView(t.c, t.r)) { const fl = 1 + Math.sin(L.time * 11 + t.seed) * 0.04 + Math.sin(L.time * 23 + t.seed * 3) * 0.03; lights.push([t.c * W + W / 2, floorY(t.r) - 78, 230 * fl, 0.95]); }
  if (L.door && L.door.open > 0 && inView(L.door.c, L.door.r)) lights.push([L.door.c * W + W / 2, floorY(L.door.r) - 40, 160 * L.door.open, 0.9]);
  if (L.princess && inView(L.princess.c, L.princess.r)) lights.push([L.princess.c * W + W / 2, floorY(L.princess.r) - 50, 170, 0.8]);
  for (const l of lights) hole(l[0], l[1], l[2], l[3]);
  hole(P.x, P.y - 50, 120, 0.45);
  for (const p of L.particles) if (p.kind === 'spark' || p.kind === 'glow') hole(p.x, p.y, 26, 0.5 * (1 - p.t / p.life));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(LIGHT, 0, 0);

  // additive: warm torch glow, flames, embers, sparks
  ctx.setTransform(RS, 0, 0, RS, (-ox + sh) * RS, (-oy + sh) * RS);
  ctx.globalCompositeOperation = 'lighter';
  for (const t of L.torches) if (inView(t.c, t.r)) drawFlame(ctx, t.c * W + W / 2, floorY(t.r) - 76, t.seed, T);
  for (const p of L.particles) {
    const a = 1 - p.t / p.life;
    if (p.kind === 'ember') { ctx.fillStyle = `rgba(255,${150 + a * 80 | 0},60,${a})`; ctx.fillRect(p.x, p.y, p.size, p.size); }
    else if (p.kind === 'spark') { ctx.fillStyle = `rgba(255,240,180,${a})`; ctx.fillRect(p.x - 1, p.y - 1, p.size + 1, p.size + 1); }
    else if (p.kind === 'glow') { ctx.fillStyle = `rgba(255,120,140,${a * 0.8})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(VIG, 0, 0);
  if (P.flash > 0 && !P.alive) { ctx.fillStyle = `rgba(160,0,0,${P.flash * 0.5})`; ctx.fillRect(0, 0, VIEW_W * RS, VIEW_H * RS); }
  drawHud(ctx);
}

function drawFlame(ctx, x, y, seed, T) {
  const t = L.time, f1 = Math.sin(t * 13 + seed) * 2, f2 = Math.sin(t * 7.3 + seed * 2) * 1.5;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 90);
  glow.addColorStop(0, T.glow + '0.28)'); glow.addColorStop(1, T.glow + '0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 90, y - 90, 180, 180);
  const layer = (w, h, col, dx) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w, y + 6);
    ctx.quadraticCurveTo(x - w - 1, y - h * 0.4, x + dx, y - h); ctx.quadraticCurveTo(x + w + 1, y - h * 0.4, x + w, y + 6); ctx.closePath(); ctx.fill(); };
  layer(8, 26 + f1, 'rgba(255,90,20,.55)', f2 * 1.5);
  layer(5.5, 19 + f2, 'rgba(255,170,50,.7)', f1);
  layer(3, 11 + f1 * 0.5, 'rgba(255,240,190,.9)', f2 * 0.5);
}

function drawItem(ctx, it) {
  const x = it.c * W + 40, fy = floorY(it.r), b = Math.sin(L.time * 2 + it.bob);
  if (it.type === 'S') {
    ctx.save(); ctx.translate(x - 10, fy - 3); ctx.rotate(-0.06);
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(26, 0); ctx.stroke();
    const gr = ctx.createLinearGradient(-10, 0, 26, 0); gr.addColorStop(0, '#9aa3ad'); gr.addColorStop(0.6, '#f4f8ff'); gr.addColorStop(1, '#c8d0da');
    ctx.strokeStyle = gr; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(26, 0); ctx.stroke();
    ctx.strokeStyle = '#d8b26a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(-9, 5); ctx.stroke();
    ctx.strokeStyle = '#6b4426'; ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-10, 0); ctx.stroke();
    const g = (L.time * 0.8) % 1; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,230,${Math.sin(g * Math.PI)})`;
    const gx = -8 + g * 34; ctx.beginPath(); ctx.moveTo(gx, -6); ctx.lineTo(gx + 1, -1); ctx.lineTo(gx + 6, 0); ctx.lineTo(gx + 1, 1); ctx.lineTo(gx, 6); ctx.lineTo(gx - 1, 1); ctx.lineTo(gx - 6, 0); ctx.lineTo(gx - 1, -1); ctx.fill();
    ctx.restore(); return;
  }
  const big = it.type === 'H', col = big ? [80, 220, 140] : [230, 50, 60], s = big ? 1.25 : 1;
  ctx.save(); ctx.translate(x, fy - 1); ctx.scale(s, s);
  const glow = ctx.createRadialGradient(0, -8, 0, 0, -8, 22); glow.addColorStop(0, `rgba(${col},${0.35 + b * 0.1})`); glow.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = glow; ctx.fillRect(-22, -30, 44, 44);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(0, -7, 7.5, 0, 7); ctx.fill(); ctx.fillRect(-3.5, -20, 7, 9);
  ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(0, -7, 6, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(-2, -9, 2, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(200,220,255,.5)'; ctx.fillRect(-2.5, -19, 5, 8);
  ctx.fillStyle = '#8a5a2e'; ctx.fillRect(-3, -22, 6, 3);
  const by = -6 - ((L.time * 12 + it.bob * 5) % 8); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(1, by, 1.5, 1.5);
  ctx.restore();
}

function drawGate(ctx, g) {
  const x = g.c * W + 25, top = g.r * H + 8, fy = floorY(g.r), full = fy - top, bottom = fy - g.open * (full - 14);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 6, top, 26, fy - top + 2); ctx.clip();
  const len = full, y0 = bottom - len;
  ctx.fillStyle = 'rgba(0,0,0,.65)';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + i * 6 - 1, y0, 4, len);
  for (let yy = bottom - 6; yy > y0; yy -= 14) ctx.fillRect(x - 2, yy - 1, 18, 4);
  const gr = ctx.createLinearGradient(x, 0, x + 14, 0); gr.addColorStop(0, '#3d3a36'); gr.addColorStop(0.5, '#7d7770'); gr.addColorStop(1, '#2e2b28');
  ctx.fillStyle = gr;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + i * 6, y0, 2.4, len);
  for (let yy = bottom - 6; yy > y0; yy -= 14) ctx.fillRect(x - 1, yy, 16, 2.2);
  ctx.fillStyle = '#8d867d'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 6 - 1, bottom - 2); ctx.lineTo(x + i * 6 + 1.2, bottom + 3); ctx.lineTo(x + i * 6 + 3.4, bottom - 2); ctx.fill(); }
  ctx.restore();
}

function drawBlades(ctx, b) {
  const a = bladeAmount(b), x = b.c * W + W / 2, fy = floorY(b.r), mid = fy - 52, gap = (1 - a) * 46;
  const jaw = (y1, y2, up) => {
    const gr = ctx.createLinearGradient(x - 6, 0, x + 6, 0); gr.addColorStop(0, '#6b737d'); gr.addColorStop(0.5, '#eef3f8'); gr.addColorStop(1, '#59606a');
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 5, Math.min(y1, y2) - 1, 10, Math.abs(y2 - y1) + 2);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 4, y1); ctx.lineTo(x + 4, y1);
    for (let i = 0; i <= 4; i++) { const yy = y1 + (y2 - y1) * (i / 4); ctx.lineTo(x + (i % 2 ? 6 : 4), yy); }
    ctx.lineTo(x - 4, y2); ctx.closePath(); ctx.fill();
  };
  jaw(fy - 100, mid - gap, false);
  jaw(fy - 2, mid + gap, true);
  if (!P.alive && P.cause === 'blades' && pCol() === b.c) { ctx.fillStyle = 'rgba(150,20,20,.7)'; ctx.fillRect(x - 4, mid - 8, 8, 16); }
}

function drawDoor(ctx, d) {
  const cx = d.c * W + W / 2, fy = floorY(d.r), w = 48, h = 92;
  const lg = ctx.createLinearGradient(0, fy - h, 0, fy); lg.addColorStop(0, '#ffd9a0'); lg.addColorStop(1, '#ff9a4a');
  ctx.fillStyle = lg; ctx.fillRect(cx - w / 2, fy - h, w, h - 6);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(cx - w / 2 + 6, fy - 12 - i * 8, w - 12, 2);
  const lift = d.open * (h - 10);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - w / 2, fy - h, w, h - 6); ctx.clip();
  const y0 = fy - h - lift;
  const dg = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); dg.addColorStop(0, '#3b2a1a'); dg.addColorStop(0.5, '#5e4329'); dg.addColorStop(1, '#2f2114');
  ctx.fillStyle = dg; ctx.fillRect(cx - w / 2, y0, w, h - 6);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 1; i < 4; i++) ctx.fillRect(cx - w / 2 + i * 12, y0, 1.5, h - 6);
  ctx.fillStyle = '#9a8a6a'; for (let k = 0; k < 2; k++) ctx.fillRect(cx - w / 2, y0 + 18 + k * 44, w, 4);
  ctx.restore();
}

function drawHud(ctx) {
  const y = VIEW_H * RS, h = HUD_H * RS, wd = VIEW_W * RS;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#120c08'); gr.addColorStop(1, '#050302');
  ctx.fillStyle = gr; ctx.fillRect(0, y, wd, h);
  ctx.fillStyle = 'rgba(216,178,106,.35)'; ctx.fillRect(0, y, wd, Math.max(1, RS * 0.5));
  ctx.setTransform(RS, 0, 0, RS, 0, VIEW_H * RS);
  const tri = (x, filled, col) => { ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x + 10, 16); ctx.lineTo(x + 5, 6); ctx.closePath();
    if (filled) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); } };
  for (let i = 0; i < P.maxHp; i++) tri(10 + i * 14, i < P.hp && (P.hp > 1 || Math.sin(L.time * 10) > -0.3), '#e0453a');
  const g = guards.find(g => g.alive && sameRow(g, P) && Math.abs(g.x - P.x) < W * 4.8 && Math.floor(g.x / 640) === Math.floor(P.x / 640));
  if (g) for (let i = 0; i < g.maxHp; i++) tri(VIEW_W - 20 - i * 14, i < g.hp, '#5aa9e6');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (Msg.t > 0) { ctx.fillStyle = `rgba(243,233,210,${Math.min(1, Msg.t * 2)})`; ctx.font = '600 11px "Fira Sans", sans-serif'; ctx.fillText(Msg.text, VIEW_W / 2, 11.5); }
  else {
    const s = Math.max(0, Game.timeLeft | 0), m = (s / 60) | 0;
    ctx.fillStyle = s < 300 ? '#e0703a' : 'rgba(216,178,106,.85)'; ctx.font = '600 10.5px "Fira Sans", sans-serif';
    ctx.fillText(`Επίπεδο ${L.idx + 1}  ·  ${m}:${String(s % 60).padStart(2, '0')}`, VIEW_W / 2, 11.5);
  }
}

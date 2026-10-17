// Level state: the tile grid plus every moving part (gates, plates, loose floors, blades, spikes).
let L = null;
const key = (c, r) => r * 1000 + c;
const PLATE_LINK = { a: '1', b: '2', d: '3', e: '4', f: '5' }; // plate letter -> gate it opens

function loadLevel(idx) {
  const def = LEVELS[idx];
  const grid = def.map.map(s => s.split(''));
  L = {
    idx, def, theme: def.theme, grid, cols: grid[0].length, rows: grid.length,
    start: null, guards: [], torches: [], items: new Map(), plates: new Map(), gates: new Map(),
    loose: new Map(), spikes: new Map(), blades: new Map(), rubble: new Set(), falling: [],
    door: null, princess: null, time: 0, particles: [], shake: 0,
  };
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    const ch = grid[r][c], k = key(c, r);
    let t = ch;
    if (PLATE_LINK[ch]) { L.plates.set(k, { c, r, link: PLATE_LINK[ch], down: 0 }); grid[r][c] = 'p'; continue; }
    if (ch >= '1' && ch <= '5') { L.gates.set(ch, { c, r, open: 0, hold: 0, id: ch }); grid[r][c] = 'g'; continue; }
    switch (ch) {
      case 'P': L.start = { c, r }; t = '_'; break;
      case 'G': L.guards.push({ c, r }); t = '_'; break;
      case 't': L.torches.push({ c, r, seed: Math.random() * 10 }); t = '_'; break;
      case 'h': case 'H': case 'S': L.items.set(k, { type: ch, c, r, bob: Math.random() * 6 }); t = '_'; break;
      case 'X': L.plates.set(k, { c, r, link: 'E', down: 0 }); t = 'p'; break;
      case 'E': L.door = { c, r, open: 0, opening: false }; break;
      case 'Q': L.princess = { c, r }; break;
      case '~': L.loose.set(k, { c, r, t: -1, wob: 0 }); break;
      case '^': L.spikes.set(k, { c, r, ext: 0, idle: 0 }); break;
      case 'c': L.blades.set(k, { c, r, phase: (c * 0.37) % 1.8, last: 1 }); break;
    }
    grid[r][c] = t;
  }
  return L;
}

function tile(c, r) {
  if (c < 0 || c >= L.cols || r < 0) return '#';
  if (r >= L.rows) return ' ';
  return L.grid[r][c];
}
const isFloorCh = ch => ch !== ' ' && ch !== '#';
function standable(c, r) {
  const t = tile(c, r);
  return isFloorCh(t) || (t === ' ' && tile(c, r + 1) === '#');
}
function gateAt(c, r) { for (const g of L.gates.values()) if (g.c === c && g.r === r) return g; return null; }

// Horizontal obstacle inside cell (c,r), as [left,right] in world x, or null.
function hBlock(c, r) {
  const t = tile(c, r);
  if (t === '#') return [c * W, c * W + W];
  if (t === 'g') { const g = gateAt(c, r); if (g && g.open < 0.75) return [c * W + 25, c * W + 39]; }
  return null;
}

// Move from ox to nx with half-width hw through the given rows; returns the corrected x.
function resolveX(ox, nx, hw, rows) {
  for (const r of rows) {
    const c0 = colOf(Math.min(ox, nx) - hw), c1 = colOf(Math.max(ox, nx) + hw);
    for (let c = c0; c <= c1; c++) {
      const iv = hBlock(c, r); if (!iv) continue;
      if (nx + hw > iv[0] && nx - hw < iv[1]) nx = ox <= (iv[0] + iv[1]) / 2 ? iv[0] - hw - 0.01 : iv[1] + hw + 0.01;
    }
  }
  return nx;
}

function bladesClosed(b) {
  const p = (L.time + b.phase) % 1.8;
  return p > 1.45 && p < 1.72;
}
function bladeAmount(b) { // 0 open .. 1 shut
  const p = (L.time + b.phase) % 1.8;
  if (p < 1.3) return 0; if (p < 1.45) return (p - 1.3) / 0.15; if (p < 1.72) return 1; return 1 - (p - 1.72) / 0.08;
}

function pressPlate(c, r) {
  const p = L.plates.get(key(c, r)); if (!p) return;
  if (p.down < 0.5) Sfx.plate();
  p.down = 1;
  if (p.link === 'E') { if (L.door && !L.door.opening) { L.door.opening = true; Sfx.door(); showMsg('Η έξοδος ανοίγει…', 2); } }
  else { const g = L.gates.get(p.link); if (g) { if (g.open < 0.05) Sfx.gate(); g.hold = 7; } }
}

function triggerLoose(c, r) {
  const l = L.loose.get(key(c, r)); if (l && l.t < 0) { l.t = 0; Sfx.noise(0.3, 0.12, 500); }
}

function updateWorld(dt) {
  L.time += dt;
  for (const p of L.plates.values()) p.down = Math.max(0, p.down - dt * 4);
  for (const g of L.gates.values()) {
    if (g.hold > 0) { g.hold -= dt; g.open = Math.min(1, g.open + dt * 1.8); }
    else if (g.open > 0) { const was = g.open; g.open = Math.max(0, g.open - dt * 0.55); if (was > 0.02 && g.open === 0) Sfx.thud(); }
  }
  if (L.door && L.door.opening) L.door.open = Math.min(1, L.door.open + dt * 0.45);
  for (const [k, l] of L.loose) {
    if (l.t < 0) continue;
    l.t += dt; l.wob = Math.sin(l.t * 60) * 2;
    if (l.t > 0.8) { // long enough to run across, as in the original
      L.loose.delete(k); L.grid[l.r][l.c] = ' ';
      L.falling.push({ x: l.c * W, y: floorY(l.r), vy: 0, r0: l.r, rot: 0 });
      Sfx.noise(0.2, 0.15, 900);
    }
  }
  for (let i = L.falling.length - 1; i >= 0; i--) {
    const f = L.falling[i], py = f.y;
    f.vy = Math.min(f.vy + 1700 * dt, 900); f.y += f.vy * dt; f.rot += dt * 0.6;
    const c = Math.round(f.x / W);
    // hurts the player if it lands on them
    if (P.alive && Math.abs(P.x - (f.x + W / 2)) < 30 && f.y > P.y - 95 && py <= P.y - 95 && P.alive) hurtPlayer(1, 'rubble');
    let done = false;
    for (let r = f.r0 + 1; r < L.rows; r++) {
      const fy = floorY(r);
      if (py < fy && f.y >= fy && standable(c, r)) {
        L.falling.splice(i, 1); done = true; L.rubble.add(key(c, r)); Sfx.crumble(); L.shake = 0.25;
        for (let n = 0; n < 16; n++) spawn({ x: c * W + rand(4, 60), y: fy - 4, vx: rand(-90, 90), vy: rand(-260, -60), life: rand(0.5, 1), g: 1200, size: rand(2, 4.5), kind: 'chip' });
        for (let n = 0; n < 10; n++) spawn({ x: c * W + rand(0, 64), y: fy - 8, vx: rand(-30, 30), vy: rand(-40, -10), life: rand(0.8, 1.6), g: -10, size: rand(8, 16), kind: 'dust' });
        break;
      }
    }
    if (!done && f.y > L.rows * H + 200) L.falling.splice(i, 1);
  }
  for (const s of L.spikes.values()) {
    const near = P.alive && Math.abs(P.x - (s.c * W + W / 2)) < W * 1.7 && Math.abs(P.y - floorY(s.r)) < 70;
    if (near) { if (s.ext < 0.1) Sfx.spikes(); s.ext = Math.min(1, s.ext + dt * 7); s.idle = 0; }
    else { s.idle += dt; if (s.idle > 1.2) s.ext = Math.max(0, s.ext - dt * 2); }
  }
  for (const b of L.blades.values()) {
    const a = bladeAmount(b);
    if (a > 0.9 && b.last <= 0.9 && Math.abs(P.x - b.c * W) < W * 6 && rowOf(P.y) === b.r) Sfx.blades();
    b.last = a;
  }
  for (const t of L.torches) {
    if (Math.random() < dt * 5) spawn({ x: t.c * W + W / 2 + rand(-3, 3), y: floorY(t.r) - 84, vx: rand(-12, 12), vy: rand(-70, -35), life: rand(0.6, 1.4), g: -20, size: rand(1, 2.2), kind: 'ember' });
  }
  if (Math.random() < dt * 3) { // drifting dust in the air
    const ox = Cam.rx * VIEW_W, oy = Cam.ry * VIEW_H;
    spawn({ x: ox + rand(0, VIEW_W), y: oy + rand(0, VIEW_H), vx: rand(-6, 6), vy: rand(-4, 4), life: rand(3, 6), g: 0, size: rand(0.8, 1.6), kind: 'mote' });
  }
  L.shake = Math.max(0, L.shake - dt);
  for (let i = L.particles.length - 1; i >= 0; i--) {
    const p = L.particles[i]; p.t += dt;
    if (p.t >= p.life) { L.particles.splice(i, 1); continue; }
    p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'chip') { const c = colOf(p.x), r = rowOf(p.y + 6); if (standable(c, r) && p.y > floorY(r) - 1 && p.vy > 0) { p.y = floorY(r) - 1; p.vy *= -0.3; p.vx *= 0.6; } }
  }
}
function spawn(p) { p.t = 0; if (L.particles.length < 400) L.particles.push(p); }

// Messages shown in the HUD strip.
const Msg = { text: '', t: 0 };
function showMsg(text, secs = 2.5) { Msg.text = text; Msg.t = secs; }

const Cam = { rx: 0, ry: 0 };
function updateCamera() {
  const cy = isHanging() && !(P.seq === "jumpgrab" && P.fi < 3) ? P.y - HANG - 6 : P.y - 40;
  Cam.rx = clamp(Math.floor(P.x / (ROOM_C * W)), 0, Math.ceil(L.cols / ROOM_C) - 1);
  Cam.ry = clamp(Math.floor(cy / (ROOM_R * H)), 0, Math.ceil(L.rows / ROOM_R) - 1);
}

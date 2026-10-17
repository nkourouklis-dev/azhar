// The prince, driven frame by frame by the sequence table in frames.js, like the 1989 original.
// The game ticks at 12 frames a second: on each tick the controls are read once, then either a new
// sequence starts or the current one advances a frame, moving the root by that frame's fixed amount.
// Tap ◀ ▶ for one careful step, hold to run; letting go skids to a stop, reversing is a running turn.
const HW = 11, TOE = 10, FALL_G = 6, FALL_MAX = 66; // falling: +6px per frame, up to 66 (the original's 3 and 33 at our scale)
const P = { alive: true };
const Clock = { acc: 0 };

function resetPlayer(keepSword) {
  const s = L.start;
  Object.assign(P, {
    x: s.c * W + W / 2, y: floorY(s.r), dir: 1, seq: 'stand', frs: SEQ.stand.frames, fi: 0, ft: 0,
    alive: true, flash: 0, grab: null, vx: 0, vy: 0, fallY: 0, noGrab: false, autoGrab: false,
    hasSword: keepSword, cause: '', hinted: new Set(), it: null, lat: { u: 0, d: 0, a: 0, l: 0, r: 0 },
  });
  P.hp = P.maxHp; Clock.acc = 0;
}

const pRow = () => rowOf(P.y);
const pCol = () => colOf(P.x);
const wantDir = () => (Input.r && !Input.l) ? 1 : (Input.l && !Input.r) ? -1 : 0;
const curFrame = () => P.frs[P.fi];
const pMode = () => SEQ[P.seq] ? SEQ[P.seq].mode : 'ground';
const onGround = () => P.alive && pMode() === 'ground' && !curFrame().fl.includes('a');
const isHanging = () => pMode() === 'hang';

function moveP(nx, airborne) {
  const rows = airborne ? [rowOf(P.y), rowOf(P.y - 40)] : [pRow()];
  const fx = resolveX(P.x, nx, HW, rows);
  const blocked = Math.abs(fx - nx) > 0.5;
  P.x = fx;
  return blocked;
}

// Distance (along dir) the root can go before the toes reach a drop in this row, or Infinity.
function edgeAhead(dir) {
  const r = pRow(), c0 = pCol();
  for (let i = 0; i <= 2; i++) {
    const c = c0 + dir * i;
    if (i > 0 && !standable(c, r)) {
      if (tile(c, r) === '#') return Infinity;
      const edge = dir > 0 ? c * W : (c + 1) * W;
      return Math.max(0, (edge - dir * TOE - P.x) * dir);
    }
    if (hBlock(c, r)) return Infinity;
  }
  return Infinity;
}
// Distance (along dir) to a wall or closed gate in this row, or Infinity.
function wallAhead(dir) {
  const r = pRow(), c0 = pCol();
  for (let i = 0; i <= 2; i++) {
    const iv = hBlock(c0 + dir * i, r);
    if (iv) { const d = ((dir > 0 ? iv[0] - HW : iv[1] + HW) - P.x) * dir; if (d > -1) return Math.max(0, d); }
  }
  return Infinity;
}

function setSeq(name, fi = 0, frs) {
  P.seq = name; P.frs = frs || SEQ[name].frames; P.fi = Math.min(fi, P.frs.length - 1); P.ft = 0;
  enterFrame();
}

// Moves that never carry him over an edge (careful feet).
const SAFE = new Set(['step', 'runstop', 'testfoot', 'turn', 'crawl', 'advance', 'retreat', 'engarde', 'standup', 'softland', 'medland', 'drink', 'pickup']);
const RUNNING = new Set(['startrun', 'run', 'runturn', 'runjump']);

// Applies the displacement and events of the frame just entered.
function enterFrame() {
  const f = curFrame(), fl = f.fl;
  if (fl.includes('F')) P.dir = -P.dir;
  if (fl.includes('s')) Sfx.step();
  const mode = pMode();
  if (P.seq === 'jumpgrab' && P.fi >= 3) {
    const g = P.grab, k = [0.45, 0.85, 1][P.fi - 3];
    P.x = g.x0 + (g.hx - g.x0) * k; P.y = g.y0 + (g.hy - g.y0) * k;
  } else if (mode === 'hang') { P.x += f.dx * P.dir; P.y += f.dy; }
  else if (P.seq === 'exit') { P.x = approach(P.x, L.door.c * W + W / 2, 8); }
  else if (f.dx || f.dy) {
    if (fl.includes('a') || fl.includes('L')) { moveP(P.x + f.dx * P.dir, true); P.y += f.dy; }
    else {
      let d = f.dx;
      if (P.seq === 'advance') { const g = engagedGuard(); if (g && (g.x - P.x) * P.dir < 34 + d) d = Math.max(0, (g.x - P.x) * P.dir - 34); }
      if (SAFE.has(P.seq) && d > 0) d = Math.min(d, edgeAhead(P.dir), wallAhead(P.dir));
      if (SAFE.has(P.seq) && d < 0) d = -Math.min(-d, edgeAhead(-P.dir), wallAhead(-P.dir));
      const blocked = moveP(P.x + d * P.dir);
      P.y += f.dy;
      if (blocked && RUNNING.has(P.seq) && d > 0) { setSeq('bump'); Sfx.land(); return; }
    }
  }
  if (fl.includes('U') && P.it) { useItem(P.it); P.it = null; }
  if (fl.includes('T')) { const c = pCol(), r = pRow() - 1; if (r >= 0 && tile(c, r) === '~') triggerLoose(c, r); }
  if (fl.includes('H')) playerHit();
  if (fl.includes('L')) land();
}

function land() {
  const c = pCol(), r = pRow();
  if (!standable(c, r)) { startFall(P.dir * 3 * U, true); return; }
  if (tile(c, r) === '^') { const s = L.spikes.get(key(c, r)); if (s) s.ext = 1; killPlayer('spikes'); return; }
  Sfx.land();
}

function startFall(vx, fromJump) {
  setSeq('fall'); P.vx = vx; P.vy = 0; P.fallY = floorY(rowOf(P.y - 1));
  P.autoGrab = !!fromJump; P.noGrab = false;
}

function groundCheck() {
  if (standable(pCol(), pRow())) return true;
  const run = RUNNING.has(P.seq);
  P.x += P.dir * 4;
  startFall(run ? P.dir * 2.5 * U : P.dir * U, false);
  return false;
}

function hurtPlayer(n, cause) {
  if (!P.alive) return;
  P.hp -= n; P.flash = 0.35;
  if (P.hp <= 0) killPlayer(cause);
  else { Sfx.hit(); if (onGround()) setSeq(FIGHT_SEQS.has(P.seq) ? 'hurt' : 'softland'); }
}

function killPlayer(cause) {
  if (!P.alive) return;
  P.alive = false; P.hp = 0; P.cause = cause; P.flash = 0.6;
  if (cause === 'spikes' || cause === 'blades') P.x = pCol() * W + W / 2;
  setSeq(cause === 'spikes' ? 'spiked' : cause === 'sword' || cause === 'rubble' ? 'die' : 'dead');
  if (cause !== 'pit') Sfx.death(); else Sfx.thud();
  L.shake = cause === 'fall' ? 0.3 : 0.15;
  Game.onDeath();
}

function atDoor() {
  const d = L.door;
  return d && d.open > 0.9 && pRow() === d.r && Math.abs(P.x - (d.c * W + W / 2)) < 36;
}
function itemHere() {
  const it = L.items.get(key(pCol(), pRow()));
  return it && Math.abs(P.x - (pCol() * W + W / 2)) < 30 ? it : null;
}

function tryJumpUp() {
  const c = pCol(), r = pRow(), rr = r - 1, d = P.dir;
  if (rr >= 0) {
    if (!standable(c, rr) && tile(c, rr) !== '#' && standable(c + d, rr)) return beginGrab(d > 0 ? (c + 1) * W : c * W, rr, d);
    const e = d > 0 ? (c + 1) * W : c * W;
    if (standable(c, rr) && !standable(c + d, rr) && tile(c + d, rr) !== '#' && tile(c + d, r) !== '#' && Math.abs(P.x - e) < 30) return beginGrab(e, rr, -d);
    if (!standable(c, rr) && tile(c, rr) !== '#' && standable(c - d, rr)) return beginGrab(d > 0 ? c * W : (c + 1) * W, rr, -d);
  }
  setSeq('jumpup'); Sfx.jump();
}

function beginGrab(edgeX, r, d) {
  P.dir = d; P.grab = { edgeX, r, x0: P.x, y0: P.y, hx: edgeX - d * 10, hy: floorY(r) + HANG };
  setSeq('jumpgrab'); Sfx.jump();
}

function tryClimbDown() {
  const c = pCol(), r = pRow();
  for (const d of [P.dir, -P.dir]) {
    const edge = d > 0 ? (c + 1) * W : c * W;
    if (Math.abs(P.x - edge) > 34) continue;
    if (standable(c + d, r) || tile(c + d, r) === '#' || tile(c + d, r + 1) === '#') continue;
    P.dir = -d; P.x = edge - d * 18;
    P.grab = { edgeX: edge, r, hx: edge + d * 10, hy: floorY(r) + HANG };
    setSeq('climbdown');
    return true;
  }
  return false;
}

// A careful step: a full cell, or exactly up to the edge; at the edge itself he tests his footing.
function beginStep(fi = 1) {
  P.qStep = 0;
  const e = edgeAhead(P.dir), d = Math.min(14 * U, e, wallAhead(P.dir));
  if (e < 2) { setSeq('testfoot'); return; }
  if (d < U * 0.6) { setSeq('stand'); return; }
  setSeq('step', fi, stepFrames(Math.floor(d / U + 0.01)));
}

function updatePlayer(dt) {
  const I = Input, lat = P.lat;
  if (I.pu) lat.u = 1; if (I.pd) lat.d = 1; if (I.pa) lat.a = 1; if (I.pl) lat.l = 1; if (I.pr) lat.r = 1;
  P.flash = Math.max(0, P.flash - dt);
  Clock.acc += dt;
  while (Clock.acc >= FT) {
    Clock.acc -= FT;
    tickPlayer();
    tickGuards();
    lat.u = lat.d = lat.a = lat.l = lat.r = 0;
  }
}

function tickPlayer() {
  if (P.seq === 'gone') return;
  P.ft++;
  if (!P.alive) { if (P.fi < P.frs.length - 1) { P.fi++; enterFrame(); } return; }
  if (P.seq === 'fall') { fallTick(); return; }
  if (!control()) advance();
  afterMove();
}

// Reads the controls for the current move. Returns true if it started a new sequence.
function control() {
  const I = Input, lat = P.lat, want = wantDir(), tap = lat.r && !lat.l ? 1 : lat.l && !lat.r ? -1 : 0;
  const go = want || tap, fi = P.fi, last = fi === P.frs.length - 1;
  switch (P.seq) {
    case 'stand': return standControl(go);
    case 'ready': // one frame after the press: still held means run, a tap means a careful step
      if (want === P.dir) setSeq('startrun', 1); else beginStep(1);
      return true;
    case 'startrun':
      if (lat.u) { if (atDoor()) { setSeq('exit'); Sfx.door(); } else { setSeq(fi >= 4 ? 'runjump' : 'standjump'); Sfx.jump(); } return true; }
      if (want === -P.dir) { setSeq(fi >= 4 ? 'runturn' : 'turn'); return true; }
      if (want !== P.dir) { setSeq(fi >= 4 ? 'runstop' : 'stand'); return true; }
      return false;
    case 'run':
      if (engagedGuard()) { setSeq('runstop'); return true; }
      if (lat.u) { if (atDoor()) { setSeq('exit'); Sfx.door(); } else { setSeq('runjump'); Sfx.jump(); } return true; }
      if (want === -P.dir) { setSeq('runturn'); return true; }
      if (want !== P.dir) { setSeq('runstop'); return true; }
      return false;
    case 'runstop':
      if (lat.u && fi <= 2) { setSeq('runjump'); Sfx.jump(); return true; }
      return false;
    case 'step': // a tap during a step is remembered and taken as soon as this one allows
      if (tap === P.dir) P.qStep = 1;
      if (fi >= 9 && (go === P.dir || P.qStep)) { beginStep(1); return true; }
      if (fi >= 9 && lat.u) { setSeq('stand'); return standControl(go); }
      return false;
    case 'testfoot':
      if (fi >= 6 && (lat.u || lat.d || go)) { setSeq('stand'); return standControl(go); }
      return false;
    case 'stoop':
      if (!last) return false;
      if (lat.a && itemHere()) return standControl(0);
      if (!I.d) { setSeq('standup'); return true; }
      if (go === P.dir && P.ft > 1) { setSeq('crawl'); return true; }
      return false;
    case 'hang': {
      const g = P.grab, ec = colOf(g.edgeX + P.dir * 4);
      if (tile(ec, g.r) === '~') triggerLoose(ec, g.r);
      if (!standable(ec, g.r)) { startFall(0, false); P.noGrab = true; return true; }
      if (lat.u || (I.u && P.ft > 3)) { setSeq('climbup'); return true; }
      if (lat.d) { P.x -= P.dir * 2; startFall(0, false); P.noGrab = true; return true; }
      return false;
    }
    case 'win': case 'spiked': case 'dead': return true;
  }
  if (FIGHT_SEQS.has(P.seq) || P.seq === 'sheathe') return fightControl(go);
  return false;
}

function standControl(go) {
  const lat = P.lat;
  P.vx = 0;
  if (!groundCheck()) return true;
  if (engagedGuard()) { setSeq('engarde'); Sfx.swish(); return true; }
  if (lat.u) {
    if (atDoor()) { setSeq('exit'); Sfx.door(); }
    else if (go === P.dir) { setSeq('standjump'); Sfx.jump(); }
    else tryJumpUp();
    return true;
  }
  if (lat.a && itemHere()) { P.it = itemHere(); P.drinkCol = P.it.type === 'H' ? '#50dc8c' : '#e6323c'; setSeq(P.it.type === 'S' ? 'pickup' : 'drink'); return true; }
  if (lat.d || Input.d) { if (!tryClimbDown()) setSeq('stoop'); return true; }
  if (go === P.dir) { setSeq('ready'); return true; }
  if (go === -P.dir) { setSeq('turn'); return true; }
  const it = itemHere();
  if (it && !P.hinted.has(it)) { P.hinted.add(it); showMsg(it.type === 'S' ? 'Πάτα ⚔ για να πάρεις το σπαθί' : 'Πάτα ⚔ για να πιεις το φίλτρο', 3); }
  return false;
}

// Advances one frame; at the end of a sequence, picks what follows.
function advance() {
  const s = SEQ[P.seq];
  if (P.fi + 1 < P.frs.length) {
    P.fi++; enterFrame();
    if (onGround() && !SAFE.has(P.seq) && P.seq !== 'stand') groundCheck();
    return;
  }
  if (s.loop != null) { P.fi = s.loop; enterFrame(); if (onGround()) groundCheck(); return; }
  const want = wantDir();
  switch (P.seq) {
    case 'turn': return want === P.dir ? setSeq('startrun', 1) : setSeq('stand');
    case 'runturn': return want === P.dir ? setSeq('run') : setSeq('runstop');
    case 'runjump': return want === P.dir ? setSeq('run', 1) : setSeq('runstop');
    case 'step': return setSeq('stand');
    case 'crawl': return setSeq('stoop', 2);
    case 'exit': P.seq = 'gone'; Game.levelDone(); return;
    case 'sheathe': return setSeq('stand');
  }
  if (FIGHT_SEQS.has(P.seq) && P.seq !== 'fight') return setSeq(engagedGuard() ? 'fight' : 'sheathe');
  if (s.next) setSeq(s.next);
}

function fallTick() {
  const I = Input, py = P.y, ph = P.y - HANG;
  P.vy = Math.min(P.vy + FALL_G, FALL_MAX); P.y += P.vy;
  if (P.vx) { moveP(P.x + P.vx, true); P.vx = Math.abs(P.vx) < 1 ? 0 : P.vx * 0.6; }
  P.fi = P.fi + 1 < P.frs.length ? P.fi + 1 : SEQ.fall.loop;
  const c = pCol();
  for (let r = Math.max(0, rowOf(py)); r <= rowOf(P.y) && r < L.rows; r++) {
    const fy = floorY(r);
    if (py < fy && P.y >= fy && standable(c, r)) {
      P.y = fy; P.vx = 0; const rows = (fy - P.fallY) / H;
      if (tile(c, r) === '^') { const s = L.spikes.get(key(c, r)); if (s) s.ext = 1; killPlayer('spikes'); }
      else if (rows > 2.3) killPlayer('fall');
      else if (rows > 1.3) { Sfx.thud(); L.shake = 0.2; hurtPlayer(1, 'fall'); if (P.alive) setSeq('medland'); }
      else { Sfx.land(); setSeq('softland'); }
      return afterMove();
    }
  }
  if (!P.noGrab && (I.u || P.autoGrab) && P.y - P.fallY < H * 1.6) {
    const nh = P.y - HANG;
    for (let r = 0; r < L.rows; r++) {
      const fy = floorY(r);
      if (!(ph < fy && nh >= fy) || standable(c, r)) continue;
      for (const d of [P.dir, -P.dir]) {
        const edge = d > 0 ? (c + 1) * W : c * W;
        if (standable(c + d, r) && Math.abs(P.x - edge) < 38) {
          P.dir = d; P.grab = { edgeX: edge, r, hx: edge - d * 10, hy: fy + HANG };
          P.x = P.grab.hx; P.y = P.grab.hy; P.vy = 0; setSeq('hang'); Sfx.step();
          return;
        }
      }
    }
  }
  if (P.y > L.rows * H + 40) killPlayer('pit');
}

function useItem(it) {
  const k = key(it.c, it.r); if (!L.items.has(k)) return;
  L.items.delete(k);
  const cx = it.c * W + W / 2;
  if (it.type === 'S') { P.hasSword = true; Sfx.sword(); showMsg('Το σπαθί είναι δικό σου! ⚔ επίθεση, ▲ άμυνα', 4); }
  else if (it.type === 'h') { P.hp = Math.min(P.maxHp, P.hp + 1); Sfx.potion(); showMsg('Θεραπευτικό φίλτρο', 2); }
  else { P.maxHp += 1; P.hp = P.maxHp; Sfx.potion(); showMsg('Φίλτρο ζωής! +1 μέγιστη ζωή', 3); }
  for (let n = 0; n < 18; n++) spawn({ x: cx + rand(-10, 10), y: P.y - rand(10, 60), vx: rand(-30, 30), vy: rand(-80, -20), life: rand(0.6, 1.2), g: 0, size: rand(1.5, 3), kind: it.type === 'S' ? 'spark' : 'glow' });
}

function afterMove() {
  if (!onGround()) return;
  const c = pCol(), r = pRow(), k = key(c, r), t = tile(c, r), cx = c * W + W / 2;
  if (t === 'p') pressPlate(c, r);
  if (t === '~') triggerLoose(c, r);
  // like the original, careful steps over spikes are safe; running or landing on them is not
  if (t === '^' && (curFrame().fl.includes('X') || P.seq === 'bump')) { const s = L.spikes.get(k); if (s && s.ext > 0.55 && Math.abs(P.x - cx) < 26) killPlayer('spikes'); }
  if (t === 'c') { const b = L.blades.get(k); if (b && bladesClosed(b) && Math.abs(P.x - cx) < 16) killPlayer('blades'); }
  if (P.alive && L.princess && r === L.princess.r && Math.abs(P.x - (L.princess.c * W + W / 2)) < 46 && P.seq !== 'win') {
    setSeq('win'); P.dir = 1; Game.win();
  }
}

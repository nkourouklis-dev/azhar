// The prince: a move-based state machine modelled on the 1989 original.
// Tap a direction for one careful step, hold it to run. Letting go skids to a stop,
// reversing mid-run is a running turn, and stopping at a drop makes him teeter.
// Timings follow the original's human pace (it was rotoscoped from film of a real runner).
const CLIMB_T = 1.25, RUN = 195, ACC = 520, SKID_DEC = 540, G = 1750, HW = 11;
const STEP_LEN = 32, STEP_T = 0.75, TURN_T = 0.36, RTURN_T = 0.56, RTURN_FLIP = 0.26, JUP_PREP = 0.18, JUP_T = 0.32, TOE = 7, TAP_T = 0.13;
const P = { alive: true };

function resetPlayer(keepSword) {
  const s = L.start;
  Object.assign(P, {
    x: s.c * W + W / 2, y: floorY(s.r), dir: 1, st: 'stand', t: 0, vx: 0, vy: 0,
    alive: true, flash: 0, phase: 0, grab: null, jump: null, fallY: 0, noGrab: false, autoGrab: false,
    hasSword: keepSword, cause: '', stepT: 0, hitDone: false, blockCd: 0, mv: null, hinted: new Set(), sm: null,
  });
  P.hp = P.maxHp;
}

const groundedStates = new Set(['stand', 'pre', 'step', 'teeter', 'run', 'skid', 'runturn', 'turn', 'crouch', 'crouchhop', 'rise', 'land', 'bump',
  'drink', 'pickup', 'draw', 'sheathe', 'fight', 'advance', 'retreat', 'strike', 'block', 'hurt', 'parried', 'exit', 'win']);
const pRow = () => rowOf(P.y);
const pCol = () => colOf(P.x);
const wantDir = () => (Input.r && !Input.l) ? 1 : (Input.l && !Input.r) ? -1 : 0;
const ease = k => k * k * (3 - 2 * k);

function setSt(st) { P.st = st; P.t = 0; if (st === 'pre') P.mv = { preX0: P.x }; }

function moveP(nx, airborne) {
  const rows = airborne ? [rowOf(P.y), rowOf(P.y - 40)] : [pRow()];
  const fx = resolveX(P.x, nx, HW, rows);
  const blocked = Math.abs(fx - nx) > 0.5;
  P.x = fx;
  return blocked;
}

// Distance (along dir) to where the toes reach a drop in the current row, or Infinity.
function edgeAhead(dir) {
  const r = pRow(), c0 = pCol();
  for (let i = 0; i <= 2; i++) {
    const c = c0 + dir * i;
    if (i > 0 && !standable(c, r)) {
      if (tile(c, r) === '#') return Infinity;
      const edge = dir > 0 ? c * W : (c + 1) * W;
      return (edge - dir * TOE - P.x) * dir;
    }
    if (hBlock(c, r)) return Infinity;
  }
  return Infinity;
}
// Distance (along dir) to a wall or closed gate in the current row, or Infinity.
function wallAhead(dir) {
  const r = pRow(), c0 = pCol();
  for (let i = 0; i <= 2; i++) {
    const iv = hBlock(c0 + dir * i, r);
    if (iv) { const d = ((dir > 0 ? iv[0] - HW : iv[1] + HW) - P.x) * dir; if (d > -1) return Math.max(0, d); }
  }
  return Infinity;
}

function startFall(vx, fromJump) {
  setSt('fall'); P.vx = vx; P.vy = 0; P.fallY = floorY(rowOf(P.y));
  P.autoGrab = !!fromJump; P.noGrab = false;
}

function groundCheck() {
  if (standable(pCol(), pRow())) return true;
  startFall(P.vx * 0.55, false);
  P.x += Math.sign(P.vx || P.dir) * 4;
  return false;
}

function hurtPlayer(n, cause) {
  if (!P.alive) return;
  P.hp -= n; P.flash = 0.35;
  if (P.hp <= 0) killPlayer(cause);
  else { Sfx.hit(); if (groundedStates.has(P.st)) { setSt('hurt'); } }
}

function killPlayer(cause) {
  if (!P.alive) return;
  P.alive = false; P.hp = 0; P.cause = cause; P.flash = 0.6; setSt('dead');
  if (cause === 'spikes' || cause === 'blades') P.x = pCol() * W + W / 2;
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
    if (tile(c, rr) === '~') triggerLoose(c, rr); // bump a loose tile from below
  }
  setSt('hop'); P.jump = { baseY: P.y }; Sfx.jump();
}

function beginGrab(edgeX, r, d) {
  P.dir = d; P.grab = { edgeX, r, x0: P.x, y0: P.y, hx: edgeX - d * 10, hy: floorY(r) + HANG };
  setSt('jumpUp'); Sfx.jump();
}

function tryClimbDown() {
  const c = pCol(), r = pRow();
  for (const d of [P.dir, -P.dir]) {
    const edge = d > 0 ? (c + 1) * W : c * W;
    if (Math.abs(P.x - edge) > 34) continue;
    if (standable(c + d, r) || tile(c + d, r) === '#' || tile(c + d, r + 1) === '#') continue;
    P.dir = -d;
    P.grab = { edgeX: edge, r, x0: P.x, y0: P.y, hx: edge + d * 10, hy: floorY(r) + HANG };
    setSt('climbDown');
    return true;
  }
  return false;
}

function startJump(kind) {
  const run = kind === 'run';
  const k = run ? clamp(Math.abs(P.vx) / RUN, 0.8, 1) : 1;
  P.jump = { run, baseY: P.y, prep: run ? 0.08 : 0.34, T: run ? 0.64 : 0.56, h: run ? 34 : 30, spd: run ? 305 * k : 224 };
  setSt('jump'); Sfx.jump();
}

// Up/down/action handling shared by every standing-still state. Returns true if it started a move.
function standActions(want) {
  const I = Input;
  if (I.pu) {
    if (atDoor()) { setSt('exit'); Sfx.door(); return true; }
    if (want === P.dir) startJump('stand');
    else tryJumpUp();
    return true;
  }
  if (I.pa && itemHere()) { const it = itemHere(); setSt(it.type === 'S' ? 'pickup' : 'drink'); P.mv = { it, done: false }; return true; }
  if (I.pd || (I.d && P.st === 'stand')) { if (!tryClimbDown()) setSt('crouch'); return true; }
  return false;
}

// A careful step from x0 (the step may already be under way after a short tap).
function beginStep(x0 = P.x) {
  const moved = (P.x - x0) * P.dir;
  const lim = Math.min(STEP_LEN - moved, edgeAhead(P.dir), wallAhead(P.dir));
  if (lim < 2.5) { if (edgeAhead(P.dir) < 2.5) { setSt('teeter'); Sfx.step(); } else setSt(moved > 4 ? 'step' : 'stand'); if (P.st === 'step') { P.mv = { x0, d: moved }; P.t = STEP_T; } return; }
  const d = moved + lim;
  // start the step animation at the point that matches how far he already moved
  let pt = 0; while (pt < 0.9 && ease(clamp((pt - 0.15) / 0.75, 0, 1)) * d < moved) pt += 0.01;
  P.mv = { x0, d }; setSt('step'); P.t = pt * STEP_T;
}

function updatePlayer(dt) {
  const I = Input, want = wantDir();
  P.t += dt; P.flash = Math.max(0, P.flash - dt); P.blockCd = Math.max(0, P.blockCd - dt);

  switch (P.st) {
    case 'stand': {
      P.vx = 0;
      if (!groundCheck()) break;
      if (engagedGuard()) { setSt('draw'); Sfx.swish(); break; }
      if (standActions(want)) break;
      if (want === P.dir) setSt('pre');
      else if (want) setSt('turn');
      const it = itemHere();
      if (it && !P.hinted.has(it)) { P.hinted.add(it); showMsg(it.type === 'S' ? 'Πάτα ⚔ για να πάρεις το σπαθί' : 'Πάτα ⚔ για να πιεις το φίλτρο', 3); }
      break;
    }
    case 'pre': { // he starts moving at once; a tap turns into a careful step, a hold into a run
      if (I.pu) { startJump('stand'); break; }
      if (want !== P.dir) { beginStep(P.mv.preX0); break; }
      const e = edgeAhead(P.dir), dx = 55 * dt;
      if (e <= dx) { moveP(P.x + P.dir * Math.max(0, e)); setSt('teeter'); Sfx.step(); break; }
      moveP(P.x + P.dir * dx);
      if (P.t >= TAP_T) { setSt('run'); P.vx = P.dir * 60; P.phase = 0.08; }
      break;
    }
    case 'step': {
      const p = clamp(P.t / STEP_T, 0, 1), m = P.mv;
      moveP(m.x0 + P.dir * m.d * ease(clamp((p - 0.15) / 0.75, 0, 1)));
      if (p >= 1) setSt(want === P.dir ? 'pre' : 'stand');
      break;
    }
    case 'teeter': // toes over the edge, arms wheeling, then he finds his balance
      if (P.t > 1.25) setSt('stand');
      else if (P.t > 0.5 && (I.pu || I.pd)) { setSt('stand'); updatePlayer(0); }
      break;
    case 'turn':
      if (P.t > TURN_T) { P.dir = -P.dir; if (wantDir() === P.dir) { setSt('run'); P.vx = P.dir * 50; } else setSt('stand'); }
      break;
    case 'run': {
      if (engagedGuard() && Math.abs(P.vx) < 150) { P.vx = 0; setSt('draw'); break; }
      if (want === P.dir) P.vx = approach(P.vx, P.dir * RUN, ACC * dt);
      else if (want === -P.dir) { setSt(Math.abs(P.vx) > 110 ? 'runturn' : 'turn'); break; }
      else { setSt('skid'); break; }
      if (I.pu) {
        if (atDoor()) { setSt('exit'); Sfx.door(); break; }
        startJump(Math.abs(P.vx) > 140 ? 'run' : 'stand'); break;
      }
      { const k = clamp(Math.abs(P.vx) / RUN, 0.25, 1); P.phase += Math.abs(P.vx) * dt / (81 * FIG_SC * (0.45 + 0.55 * k)); }
      P.stepT -= Math.abs(P.vx) * dt; if (P.stepT <= 0) { P.stepT = 40; Sfx.step(); }
      if (moveP(P.x + P.vx * dt)) {
        if (Math.abs(P.vx) > 160) { setSt('bump'); Sfx.land(); } else setSt('stand');
        P.vx = 0; break;
      }
      groundCheck();
      break;
    }
    case 'skid': {
      if (I.pu && Math.abs(P.vx) > 140) { startJump('run'); break; }
      const v0 = Math.abs(P.vx), v1 = Math.max(0, v0 - SKID_DEC * dt), dx = (v0 + v1) / 2 * dt;
      P.vx = P.dir * v1;
      const e = edgeAhead(P.dir);
      if (e <= dx) { moveP(P.x + P.dir * Math.max(0, e)); P.vx = 0; setSt('teeter'); Sfx.step(); break; }
      if (moveP(P.x + P.dir * dx)) { P.vx = 0; setSt('stand'); break; }
      if (P.t > 0.05 && P.t < 0.07) Sfx.noise(0.18, 0.08, 1500, 'bandpass');
      if (v1 === 0) setSt(want === P.dir ? 'pre' : 'stand');
      groundCheck();
      break;
    }
    case 'runturn': { // skid, swing round, push off the other way
      if (P.t < RTURN_FLIP) {
        const v0 = Math.abs(P.vx), v1 = Math.max(0, v0 - SKID_DEC * 1.4 * dt), dx = (v0 + v1) / 2 * dt;
        P.vx = P.dir * v1;
        const e = edgeAhead(P.dir);
        if (e <= dx) { moveP(P.x + P.dir * Math.max(0, e)); P.vx = 0; } else moveP(P.x + P.dir * dx);
      } else {
        if (!P.mv || !P.mv.turned) { P.dir = -P.dir; P.vx = 0; P.mv = { turned: true }; }
        P.vx = approach(P.vx, P.dir * RUN * 0.6, ACC * 1.3 * dt);
        if (moveP(P.x + P.vx * dt)) P.vx = 0;
      }
      if (P.t > RTURN_T) { P.mv = null; if (wantDir() === P.dir) setSt('run'); else setSt('skid'); }
      groundCheck();
      break;
    }
    case 'bump':
      if (P.t < 0.15) moveP(P.x - P.dir * 40 * dt);
      if (P.t > 0.45) setSt('stand');
      break;
    case 'crouch':
      if (!groundCheck()) break;
      if (I.pa && itemHere()) { standActions(want); break; }
      if (I.d && want === P.dir && P.t > 0.15) {
        const lim = Math.min(14, edgeAhead(P.dir), wallAhead(P.dir));
        if (lim > 1) { P.mv = { x0: P.x, d: lim }; setSt('crouchhop'); }
      } else if (!I.d && P.t > 0.15) setSt('rise');
      break;
    case 'crouchhop': {
      const p = clamp(P.t / 0.45, 0, 1);
      moveP(P.mv.x0 + P.dir * P.mv.d * ease(p));
      if (p >= 1) { setSt('crouch'); P.t = 0.16; }
      break;
    }
    case 'rise': if (P.t > 0.3) setSt('stand'); break;
    case 'drink': case 'pickup': {
      const m = P.mv, at = P.st === 'drink' ? 0.75 : 0.45;
      if (!m.done && P.t > at) { m.done = true; useItem(m.it); }
      if (P.t > (P.st === 'drink' ? 1.25 : 1.0)) setSt('stand');
      break;
    }
    case 'draw': if (P.t > 0.4) setSt(engagedGuard() ? 'fight' : 'stand'); break;
    case 'sheathe': if (P.t > 0.35) setSt('stand'); break;
    case 'jump': {
      const j = P.jump;
      if (P.t < j.prep) { if (j.run) moveP(P.x + P.dir * j.spd * 0.6 * dt); break; }
      const p = Math.min(1, (P.t - j.prep) / j.T);
      moveP(P.x + P.dir * j.spd * dt, true);
      P.y = j.baseY - j.h * Math.sin(Math.PI * p);
      if (p >= 1) {
        P.y = j.baseY;
        if (standable(pCol(), pRow())) {
          Sfx.land();
          if (tile(pCol(), pRow()) === '^') { L.spikes.get(key(pCol(), pRow())).ext = 1; killPlayer('spikes'); }
          else if (j.run && wantDir() === P.dir) { setSt('run'); P.vx = P.dir * RUN * 0.85; }
          else if (j.run) { setSt('skid'); P.vx = P.dir * 200; P.mv = { fromJump: true }; } // momentum carries into a skid
          else { setSt('land'); P.vx = 0; P.jump = { soft: true }; }
        } else startFall(P.dir * j.spd * 0.35, true);
      }
      break;
    }
    case 'hop': {
      const p = Math.min(1, P.t / 0.42);
      P.y = P.jump.baseY - 24 * Math.sin(Math.PI * p);
      if (p >= 1) { P.y = P.jump.baseY; setSt('land'); P.jump = { soft: true }; Sfx.land(); }
      break;
    }
    case 'jumpUp': {
      const g = P.grab, prep = JUP_PREP, p = clamp((P.t - prep) / JUP_T, 0, 1), e = 1 - (1 - p) * (1 - p);
      P.x = g.x0 + (g.hx - g.x0) * e; P.y = g.y0 + (g.hy - g.y0) * e;
      if (p >= 1) { setSt('hang'); Sfx.step(); }
      break;
    }
    case 'climbDown': {
      const g = P.grab, p = clamp(P.t / 0.5, 0, 1);
      P.x = g.x0 + (g.hx - g.x0) * ease(p); P.y = g.y0 + (g.hy - g.y0) * ease(p);
      if (p >= 1) setSt('hang');
      break;
    }
    case 'hang': {
      const g = P.grab, ec = colOf(g.edgeX + P.dir * 4);
      if (tile(ec, g.r) === '~') triggerLoose(ec, g.r);
      if (!standable(ec, g.r)) { startFall(0, false); P.noGrab = true; break; }
      if (I.pu || (I.u && P.t > 0.25)) { setSt('climb'); break; }
      if (I.pd) { startFall(0, false); P.noGrab = true; P.x -= P.dir * 2; }
      break;
    }
    case 'climb': {
      const g = P.grab, p = clamp(P.t / CLIMB_T, 0, 1);
      const tx = g.edgeX + P.dir * 18, ty = floorY(g.r), mid = ty + 57;
      if (p < 0.38) { const q = p / 0.38; P.x = g.hx; P.y = g.hy + (mid - g.hy) * (1 - (1 - q) * (1 - q)); }
      else if (p < 0.78) { const q = (p - 0.38) / 0.4; P.y = mid + (ty - mid) * ease(q); P.x = g.hx + (tx - g.hx) * ease(clamp((q - 0.2) / 0.8, 0, 1)); }
      else { P.x = tx; P.y = ty; }
      if (p >= 1) setSt('stand');
      break;
    }
    case 'fall': {
      const py = P.y, ph = P.y - HANG;
      P.vy = Math.min(P.vy + G * dt, 950); P.y += P.vy * dt;
      P.vx *= Math.pow(0.4, dt);
      moveP(P.x + P.vx * dt, true);
      const c = pCol();
      for (let r = Math.max(0, rowOf(py)); r <= rowOf(P.y) && r < L.rows; r++) {
        const fy = floorY(r);
        if (py < fy && P.y >= fy && standable(c, r)) {
          P.y = fy; const rows = (fy - P.fallY) / H;
          if (tile(c, r) === '^') { L.spikes.get(key(c, r)).ext = 1; killPlayer('spikes'); }
          else if (rows > 2.3) { killPlayer('fall'); }
          else if (rows > 1.3) { Sfx.thud(); L.shake = 0.2; hurtPlayer(1, 'fall'); if (P.alive) { setSt('land'); P.jump = { hard: true }; } }
          else { Sfx.land(); setSt('land'); P.jump = { soft: rows < 0.6 }; }
          P.vx = 0;
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
              P.x = P.grab.hx; P.y = P.grab.hy; P.vy = 0; setSt('hang'); Sfx.step();
              return afterMove();
            }
          }
        }
      }
      if (P.y > L.rows * H + 40) killPlayer('pit');
      break;
    }
    case 'land': {
      const dur = P.jump && P.jump.hard ? 0.95 : P.jump && P.jump.soft ? 0.26 : 0.45;
      if (P.t > dur) setSt(wantDir() === P.dir ? 'pre' : 'stand');
      break;
    }
    case 'exit':
      P.x = approach(P.x, L.door.c * W + W / 2, 60 * dt);
      if (P.t > 1.3) { setSt('gone'); Game.levelDone(); }
      break;
    case 'fight': case 'advance': case 'retreat': case 'strike': case 'block': case 'hurt': case 'parried':
      updatePlayerFight(dt, want);
      break;
  }
  afterMove();
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
  if (!P.alive || !groundedStates.has(P.st)) return;
  const c = pCol(), r = pRow(), k = key(c, r), t = tile(c, r), cx = c * W + W / 2;
  if (t === 'p') pressPlate(c, r);
  if (t === '~') triggerLoose(c, r);
  // like the original, careful steps over spikes are safe; running or landing on them is not
  if (t === '^' && ['run', 'skid', 'runturn', 'land', 'bump', 'turn'].includes(P.st)) { const s = L.spikes.get(k); if (s && s.ext > 0.55 && Math.abs(P.x - cx) < 26) killPlayer('spikes'); }
  if (t === 'c') { const b = L.blades.get(k); if (b && bladesClosed(b) && Math.abs(P.x - cx) < 16) killPlayer('blades'); }
  if (L.princess && r === L.princess.r && Math.abs(P.x - (L.princess.c * W + W / 2)) < 46 && P.st !== 'win') {
    setSt('win'); P.dir = 1; Game.win();
  }
}

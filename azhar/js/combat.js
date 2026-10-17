// Sword fighting: advance, retreat, strike, parry. Guards read the prince's wind-up and may block it.
let guards = [];
const REACH_MIN = 20, REACH_MAX = 84;

function spawnGuards() {
  const def = L.def;
  guards = L.guards.map(g => ({
    x: g.c * W + W / 2, y: floorY(g.r), dir: -1, st: 'idle', t: 0, hp: def.guardHp, maxHp: def.guardHp,
    skill: def.skill, style: GUARD_STYLES[def.guardColor], cool: 1, reacted: false, flash: 0, alive: true, vy: 0, fallY: 0, phase: 0, hitDone: false,
  }));
}

function sameRow(a, b) { return Math.abs(a.y - b.y) < 6; }
function liveGuardNear(range) {
  let best = null, bd = 1e9;
  for (const g of guards) {
    if (!g.alive || g.st === 'fall') continue;
    const d = Math.abs(g.x - P.x);
    const sameRoom = Math.floor(g.x / (ROOM_C * W)) === Math.floor(P.x / (ROOM_C * W));
    if (sameRow(g, P) && d < range && d < bd && (sameRoom || d < W * 2.5)) { best = g; bd = d; }
  }
  return best;
}
function engagedGuard() { return P.hasSword && P.alive ? liveGuardNear(W * 4.5) : null; }

function blocking(e) { return e.st === 'block' && e.t < 0.34; }

function resolveStrike(att, def, isPlayer) {
  const dx = (def.x - att.x) * att.dir;
  if (dx < REACH_MIN || dx > REACH_MAX || !sameRow(att, def) || (isPlayer ? !def.alive : !P.alive)) { Sfx.swish(); return; }
  if (blocking(def)) {
    Sfx.clang(); att.st = 'parried'; att.t = 0;
    const sx = (att.x + def.x) / 2, sy = att.y - 62;
    for (let n = 0; n < 14; n++) spawn({ x: sx, y: sy, vx: rand(-160, 160), vy: rand(-180, 40), life: rand(0.2, 0.5), g: 600, size: rand(1, 2.2), kind: 'spark' });
    return;
  }
  if (isPlayer) {
    def.hp -= 1; def.flash = 0.3; Sfx.hit();
    def.x = resolveX(def.x, def.x + att.dir * 16, 10, [rowOf(def.y)]);
    if (def.hp <= 0) { def.alive = false; def.st = 'dead'; def.t = 0; Sfx.death(); showMsg('Ο φρουρός έπεσε', 2); }
    else { def.st = 'hurt'; def.t = 0; def.cool = Math.max(def.cool, 0.35); }
    if (def.alive && !standable(colOf(def.x), rowOf(def.y))) { def.st = 'fall'; def.vy = 0; def.fallY = def.y; }
  } else {
    P.x = resolveX(P.x, P.x + att.dir * 14, HW, [pRow()]);
    hurtPlayer(1, 'sword');
    if (P.alive && !standable(pCol(), pRow())) startFall(att.dir * 40, false);
  }
}

function updatePlayerFight(dt, want) {
  const g = engagedGuard();
  if (!g && P.st === 'fight') { setSt('sheathe'); return; }
  if (g && P.st !== 'hurt') P.dir = Math.sign(g.x - P.x) || P.dir;
  switch (P.st) {
    case 'fight': {
      if (!groundCheck()) return;
      if (Input.pa) { setSt('strike'); P.hitDone = false; Sfx.swish(); }
      else if (Input.pu && P.blockCd <= 0) { setSt('block'); P.blockCd = 0.15; }
      else if (want) { P.mv = { x0: P.x, d: want * 20 }; setSt(want === P.dir ? 'advance' : 'retreat'); }
      break;
    }
    case 'advance': case 'retreat': { // footwork comes in discrete steps, like the original
      const p = clamp(P.t / 0.28, 0, 1);
      let nx = P.mv.x0 + P.mv.d * ease(p);
      if (g && Math.abs(g.x - nx) < 34 && Math.sign(g.x - nx) === P.dir) nx = P.x;
      moveP(nx);
      if (!groundCheck()) return;
      if (Input.pa && p > 0.5) { setSt('strike'); P.hitDone = false; Sfx.swish(); }
      else if (p >= 1) setSt(g ? 'fight' : 'sheathe');
      break;
    }
    case 'strike':
      if (P.t > 0.13 && !P.hitDone) { P.hitDone = true; if (g) resolveStrike(P, g, true); else Sfx.swish(); }
      if (P.st === 'strike' && P.t > 0.36) setSt(g ? 'fight' : 'stand');
      break;
    case 'block': if (P.t > 0.38) setSt(g ? 'fight' : 'stand'); break;
    case 'hurt': if (P.t > 0.32) setSt(g ? 'fight' : 'stand'); break;
    case 'parried': if (P.t > 0.3) setSt(g ? 'fight' : 'stand'); break;
  }
}

function updateGuards(dt) {
  for (const g of guards) {
    g.t += dt; g.flash = Math.max(0, g.flash - dt);
    if (g.st === 'dead') continue;
    if (g.st === 'fall') {
      const py = g.y; g.vy = Math.min(g.vy + G * dt, 950); g.y += g.vy * dt;
      for (let r = 0; r < L.rows; r++) {
        const fy = floorY(r);
        if (py < fy && g.y >= fy && standable(colOf(g.x), r)) {
          g.y = fy; Sfx.thud();
          if (fy - g.fallY > H * 0.6) { g.alive = false; g.st = 'dead'; g.t = 0; } else { g.st = 'idle'; g.t = 0; }
          break;
        }
      }
      if (g.y > L.rows * H + 80) { g.alive = false; g.st = 'dead'; g.y = 1e6; }
      continue;
    }
    const dx = P.x - g.x, dist = Math.abs(dx);
    const roomMatch = Math.floor(g.x / (ROOM_C * W)) === Math.floor(P.x / (ROOM_C * W)) || dist < W * 2.5;
    const engaged = P.alive && sameRow(g, P) && dist < W * 4.8 && roomMatch;
    if (g.st === 'idle') { if (engaged) { g.st = 'fight'; g.t = 0; g.cool = rand(0.5, 1.0); } else continue; }
    if (!engaged && (g.st === 'fight')) { g.st = 'idle'; g.t = 0; continue; }
    if (g.st !== 'hurt') g.dir = Math.sign(dx) || g.dir;
    g.cool -= dt;

    // read the prince's wind-up
    if (P.st === 'strike' && P.t < 0.09) {
      if (!g.reacted && (g.st === 'fight') && dist < REACH_MAX + 10) { g.reacted = true; if (Math.random() < g.skill) { g.st = 'block'; g.t = 0; } }
    } else g.reacted = false;

    switch (g.st) {
      case 'fight': {
        let mv = 0;
        if (dist > 66) mv = 1; else if (dist < 38) mv = -1;
        else if (Math.random() < dt * 0.6) mv = Math.random() < 0.5 ? 1 : -1;
        if (mv) {
          const nx = g.x + g.dir * mv * 70 * dt;
          if (standable(colOf(nx + g.dir * mv * 10), rowOf(g.y))) g.x = resolveX(g.x, nx, 10, [rowOf(g.y)]);
          g.phase += dt * 3;
        }
        if (dist < REACH_MAX && g.cool <= 0 && P.st !== 'dead') { g.st = 'strike'; g.t = 0; g.hitDone = false; }
        break;
      }
      case 'strike':
        if (g.t > 0.3 && !g.hitDone) { g.hitDone = true; Sfx.swish(); resolveStrike(g, P, false); }
        if (g.st === 'strike' && g.t > 0.56) { g.st = 'fight'; g.t = 0; g.cool = rand(0.55, 1.5) * (1.35 - g.skill); }
        break;
      case 'block': if (g.t > 0.4) { g.st = 'fight'; g.t = 0; g.cool = Math.min(g.cool, rand(0.1, 0.4) / g.skill * 0.3); } break;
      case 'hurt': if (g.t > 0.35) { g.st = 'fight'; g.t = 0; } break;
      case 'parried': if (g.t > 0.4) { g.st = 'fight'; g.t = 0; g.cool = rand(0.2, 0.6); } break;
    }
  }
}

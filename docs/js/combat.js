// Sword fighting, frame by frame: en garde, advance, retreat, strike, block. A strike lands on its
// fourth frame; a block covers its first three, so a guard that reads the wind-up can parry it.
let guards = [];
const REACH_MIN = 20, REACH_MAX = 84;

function spawnGuards() {
  const def = L.def;
  guards = L.guards.map(g => ({
    x: g.c * W + W / 2, y: floorY(g.r), dir: -1, seq: 'fight', frs: SEQ.fight.frames, fi: 0, hp: def.guardHp, maxHp: def.guardHp,
    skill: def.skill, style: GUARD_STYLES[def.guardColor], cool: 1, reacted: false, flash: 0, alive: true, vy: 0, fallY: 0, deadT: 0,
  }));
}

function sameRow(a, b) { return Math.abs(a.y - b.y) < 6; }
function liveGuardNear(range) {
  let best = null, bd = 1e9;
  for (const g of guards) {
    if (!g.alive || g.seq === 'fall') continue;
    const d = Math.abs(g.x - P.x);
    const sameRoom = Math.floor(g.x / (ROOM_C * W)) === Math.floor(P.x / (ROOM_C * W));
    if (sameRow(g, P) && d < range && d < bd && (sameRoom || d < W * 2.5)) { best = g; bd = d; }
  }
  return best;
}
function engagedGuard() { return P.hasSword && P.alive ? liveGuardNear(W * 4.5) : null; }

const blocking = e => e.frs[e.fi].fl.includes('B');

function resolveStrike(att, def, isPlayer) {
  const dx = (def.x - att.x) * att.dir;
  if (dx < REACH_MIN || dx > REACH_MAX || !sameRow(att, def) || !def.alive) { Sfx.swish(); return; }
  if (blocking(def)) {
    Sfx.clang();
    if (isPlayer) setSeq('parried'); else gSet(att, 'parried');
    const sx = (att.x + def.x) / 2, sy = att.y - 62;
    for (let n = 0; n < 14; n++) spawn({ x: sx, y: sy, vx: rand(-160, 160), vy: rand(-180, 40), life: rand(0.2, 0.5), g: 600, size: rand(1, 2.2), kind: 'spark' });
    return;
  }
  if (isPlayer) {
    def.hp -= 1; def.flash = 0.3; Sfx.hit();
    if (def.hp <= 0) { def.alive = false; gSet(def, 'die'); Sfx.death(); showMsg('Ο φρουρός έπεσε', 2); }
    else { gSet(def, 'hurt'); def.cool = Math.max(def.cool, 0.35); }
  } else {
    hurtPlayer(1, 'sword');
  }
}

function playerHit() {
  const g = engagedGuard();
  if (g) resolveStrike(P, g, true); else Sfx.swish();
}

// Player controls while en garde. Returns true if a new move started.
function fightControl(go) {
  const lat = P.lat, g = engagedGuard(), fi = P.fi;
  if (P.seq === 'fight') {
    if (!g) { setSeq('sheathe'); return true; }
    P.dir = Math.sign(g.x - P.x) || P.dir;
    if (!groundCheck()) return true;
    if (lat.a) { setSeq('strike'); Sfx.swish(); return true; }
    if (lat.u) { setSeq('block'); return true; }
    if (go === P.dir) { setSeq('advance'); return true; }
    if (go === -P.dir) { setSeq('retreat'); return true; }
    return true;
  }
  if (lat.a && ((P.seq === 'block' && fi >= 1) || ((P.seq === 'advance' || P.seq === 'retreat') && fi >= 1))) { setSeq('strike'); Sfx.swish(); return true; }
  return false;
}

// ---- guards ---------------------------------------------------------------------------------
function gSet(g, name, fi = 0) { g.seq = name; g.frs = SEQ[name].frames; g.fi = fi; gEnter(g); }
function gEnter(g) {
  const f = g.frs[g.fi];
  if (f.dx) {
    let d = f.dx;
    if (g.seq === 'advance') { const room = (P.x - g.x) * g.dir - 34; if (room < d) d = Math.max(0, room); }
    g.x = resolveX(g.x, g.x + d * g.dir, 10, [rowOf(g.y)]);
    if (!standable(colOf(g.x), rowOf(g.y))) { g.seq = 'fall'; g.frs = SEQ.fall.frames; g.fi = 0; g.vy = 0; g.fallY = g.y; return; }
  }
  if (f.fl.includes('s') && g.seq !== 'fight') Sfx.step();
  if (f.fl.includes('H')) resolveStrike(g, P, false);
}

function tickGuards() {
  for (const g of guards) {
    if (g.y > 1e5) continue;
    if (g.seq === 'fall') {
      const py = g.y; g.vy = Math.min(g.vy + FALL_G, FALL_MAX); g.y += g.vy; g.fi = g.fi === 1 ? 2 : 1;
      for (let r = 0; r < L.rows; r++) {
        const fy = floorY(r);
        if (py < fy && g.y >= fy && standable(colOf(g.x), r)) {
          g.y = fy; Sfx.thud();
          if (fy - g.fallY > H * 0.6) { g.alive = false; gSet(g, 'dead'); } else gSet(g, 'fight');
          break;
        }
      }
      if (g.y > L.rows * H + 80) { g.alive = false; g.y = 1e6; }
      continue;
    }
    if (!g.alive) { if (g.fi < g.frs.length - 1) { g.fi++; gEnter(g); } g.deadT += FT; continue; }

    const dx = P.x - g.x, dist = Math.abs(dx);
    const roomMatch = Math.floor(g.x / (ROOM_C * W)) === Math.floor(P.x / (ROOM_C * W)) || dist < W * 2.5;
    const engaged = P.alive && sameRow(g, P) && dist < W * 4.8 && roomMatch;
    if (engaged && !g.engaged) g.cool = Math.max(g.cool, rand(0.6, 1.1)); // a moment to size you up
    g.engaged = engaged; g.cool -= FT;

    // read the prince's wind-up
    if (P.seq === 'strike' && P.fi <= 1) {
      if (!g.reacted && (g.seq === 'fight' || g.seq === 'advance' || g.seq === 'retreat') && dist < REACH_MAX + 10) {
        g.reacted = true; if (Math.random() < g.skill) { gSet(g, 'block'); continue; }
      }
    } else g.reacted = false;

    if (g.seq !== 'fight') { // play the current move out
      if (g.fi + 1 < g.frs.length) { g.fi++; gEnter(g); }
      else {
        if (g.seq === 'strike') g.cool = rand(0.55, 1.5) * (1.35 - g.skill);
        if (g.seq === 'block') g.cool = Math.min(g.cool, rand(0.1, 0.4) / g.skill * 0.3);
        if (g.seq === 'parried') g.cool = rand(0.2, 0.6);
        gSet(g, 'fight');
      }
      continue;
    }
    if (!engaged) continue;
    g.dir = Math.sign(dx) || g.dir;
    if (dist < REACH_MAX && g.cool <= 0 && P.alive) { gSet(g, 'strike'); continue; }
    let mv = 0;
    if (dist > 66) mv = 1; else if (dist < 38) mv = -1; else if (Math.random() < 0.05) mv = Math.random() < 0.5 ? 1 : -1;
    if (mv && standable(colOf(g.x + g.dir * mv * 30), rowOf(g.y))) gSet(g, mv > 0 ? 'advance' : 'retreat');
  }
}

function updateGuards(dt) {
  for (const g of guards) g.flash = Math.max(0, g.flash - dt);
}

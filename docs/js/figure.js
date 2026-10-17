// Character looks and poses. Poses live in the local frame used by body.js:
// feet at the origin, +x forward, y up is negative. Legs/arms are either IK targets {t:[x,y]}
// (ankle / hand position) or forward-kinematic angles {a:[upper, lower]} measured from straight down.
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
const A_ = (a, b) => ({ a: [a, b] });
const GRIP = (x, y) => ({ t: [x, y], bend: -1, grip: true });
const BASE = { hip: [0, -53], lean: 0.03, head: 0, legF: T_(4.5, -3), legB: T_(-4, -3), armF: A_(0.12, 0.24), armB: A_(-0.1, 0.06), sword: null, rot: 0, dy: 0, alpha: 1, ground: true };
const pose = o => Object.assign({}, BASE, o);

function mixLimb(a, b, t) {
  if (a.t && b.t) return Object.assign({}, b, { t: [a.t[0] + (b.t[0] - a.t[0]) * t, a.t[1] + (b.t[1] - a.t[1]) * t] });
  if (a.a && b.a) return { a: [a.a[0] + (b.a[0] - a.a[0]) * t, a.a[1] + (b.a[1] - a.a[1]) * t] };
  return t < 0.5 ? a : b;
}
function mixPose(a, b, t) {
  t = clamp(t, 0, 1); const m = (x, y) => x + (y - x) * t;
  return { hip: [m(a.hip[0], b.hip[0]), m(a.hip[1], b.hip[1])], lean: m(a.lean, b.lean), head: m(a.head || 0, b.head || 0),
    legF: mixLimb(a.legF, b.legF, t), legB: mixLimb(a.legB, b.legB, t), armF: mixLimb(a.armF, b.armF, t), armB: mixLimb(a.armB, b.armB, t),
    sword: t < 0.5 ? a.sword : b.sword, rot: m(a.rot, b.rot), dy: m(a.dy, b.dy), alpha: m(a.alpha, b.alpha), ground: t < 0.5 ? a.ground : b.ground, flip: t < 0.5 ? a.flip : b.flip };
}

const CROUCH = pose({ hip: [-4, -28], lean: 0.78, head: -0.55, legF: T_(9, -3), legB: T_(-6, -3), armF: A_(0.95, 1.35), armB: A_(0.6, 1.1) });
const HARD = pose({ hip: [-2, -27], lean: 0.7, head: -0.4, legF: T_(9, -3), legB: T_(-8, -3), armF: A_(1.0, 1.4), armB: A_(0.7, 1.2) });
const FIGHT = pose({ hip: [0, -46], lean: 0.05, legF: T_(11, -3), legB: T_(-11, -3), armF: A_(0.95, 1.5), armB: A_(-1.9, -2.7), sword: 1.95 });

function standPose(t) { const b = Math.sin(t * 1.8) * 0.35; return pose({ hip: [0, -53.6 + b * 0.5], lean: 0.01, legF: T_(2.5, -3), legB: T_(-2.5, -3), armF: A_(0.05 + b * 0.02, 0.1), armB: A_(-0.04, 0.03) }); }

// Catmull-Rom through a list of points, u in [0,1].
function spline(pts, u) {
  const n = pts.length - 1, f = clamp(u, 0, 0.9999) * n, i = Math.floor(f), t = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}
// One leg's path through a running stride: planted and sweeping back, then heel kick, knee drive, reach.
const SWING = [[-17, -3], [-21, -9], [-12, -16], [6, -14], [17, -6], [17, -3]];
function runFoot(p, k) {
  p = ((p % 1) + 1) % 1;
  let x, y;
  if (p < 0.42) { x = 17 - 34 * (p / 0.42); y = -3; } else [x, y] = spline(SWING, (p - 0.42) / 0.58);
  return T_(x * (0.45 + 0.55 * k) + 2, -3 + (y + 3) * (0.35 + 0.65 * k));
}
function runPose(ph, k = 1) {
  const f = ((ph % 1) + 1) % 1, bob = Math.cos(2 * Math.PI * (2 * f - 0.08));
  const arm = p => { const s = Math.cos(2 * Math.PI * (p - 0.45)) * (0.25 + 0.6 * k); return A_(s, s + 1.45 + 0.15 * Math.sin(2 * Math.PI * p)); };
  return pose({ hip: [2 + k * 2, -51.2 + 1.2 * bob * k], lean: 0.05 + 0.15 * k + 0.025 * bob, head: -0.06 - 0.08 * k,
    legF: runFoot(f, k), legB: runFoot(f + 0.5, k), armF: arm(f + 0.5), armB: arm(f) });
}
// A careful step: front foot reaches first, the back foot follows. offs = how far the body has moved.
function stepPose(p, d, offs) {
  const a = clamp((p - 0.12) / 0.55, 0, 1), b = clamp((p - 0.55) / 0.4, 0, 1);
  const fx = 4.5 + d * ease(a), fy = -3 - 7 * Math.sin(Math.PI * a), bx = -4 + d * ease(b), by = -3 - 4 * Math.sin(Math.PI * b);
  const sway = Math.sin(Math.PI * p);
  return pose({ hip: [1, -53.2 + sway * 0.6], lean: 0.08 + 0.06 * sway, head: 0.1, legF: T_(fx - offs, fy), legB: T_(bx - offs, by),
    armF: A_(0.25 - 0.3 * sway, 0.55), armB: A_(-0.05 + 0.3 * sway, 0.45) });
}
// Toes over the edge: he tips forward, wheels his arms and pulls himself back.
function teeterPose(t) {
  const w = Math.sin(t * 14), into = clamp(t / 0.28, 0, 1), out = clamp((t - 0.88) / 0.37, 0, 1);
  const lean = (0.5 + 0.12 * Math.sin(t * 9)) * into * (1 - out) - 0.08 * Math.sin(Math.PI * out);
  const p = pose({ hip: [3 * into * (1 - out), -52.8 + 2 * into * (1 - out)], lean, head: 0.45 * into * (1 - out),
    legF: T_(6, -3), legB: T_(-5, -3 - 5 * into * (1 - out)),
    armF: A_(2.2 + 0.9 * w, 2.5 + 0.9 * w), armB: A_(1.6 - 0.9 * w, 2.0 - 0.9 * w) });
  return out > 0 ? mixPose(p, standPose(L.time), out) : p;
}
const SKID = pose({ hip: [-4, -45], lean: -0.22, head: 0.12, legF: T_(21, -3), legB: T_(-9, -3), armF: A_(1.35, 1.75), armB: A_(-0.5, 0.1) });
const KNEEL = pose({ hip: [-3, -27], lean: 0.18, head: 0.05, legF: T_(10, -3), legB: T_(-19, -3), armF: A_(0.4, 0.9), armB: A_(0.1, 0.4) });
function fightStep(p, d, offs) { // d along facing: >0 advance (front foot first), <0 retreat (back foot first)
  const first = clamp(p / 0.6, 0, 1), second = clamp((p - 0.4) / 0.6, 0, 1);
  const fa = d > 0 ? first : second, ba = d > 0 ? second : first;
  return pose(Object.assign({}, FIGHT, { hip: [d > 0 ? 2 : -2, -46 + Math.sin(Math.PI * p)],
    legF: T_(11 + d * ease(fa) - offs, -3 - 5 * Math.sin(Math.PI * fa)), legB: T_(-11 + d * ease(ba) - offs, -3 - 4 * Math.sin(Math.PI * ba)) }));
}
// Hanging: hands locked onto the ledge, body hangs below with straight arms.
function hangPose(hx, hy, swing) {
  const s = Math.sin(swing) * 0.07;
  return pose({ hip: [-1, hy + 54.5], lean: 0.1, head: -0.15, ground: false,
    legF: A_(0.16 + s, 0.06 + s * 0.6), legB: A_(0.02 - s, -0.12 - s * 0.5),
    armF: GRIP(hx - 1, hy + 2.5), armB: GRIP(hx - 3.5, hy + 2) });
}
function grabLocal() {
  const g = P.grab; return g ? [(g.edgeX - P.x) * P.dir / FIG_SC, (floorY(g.r) - P.y) / FIG_SC] : [12, -HANG / FIG_SC];
}

function playerPose() {
  const t = P.t, sw = P.hasSword, m = P.mv;
  const offs = m && m.x0 != null ? (P.x - m.x0) * P.dir / FIG_SC : 0;
  switch (P.st) {
    case 'stand': return standPose(L.time);
    case 'pre': return mixPose(standPose(L.time), runPose(0.05, 0.35), t / TAP_T);
    case 'step': return stepPose(clamp(t / STEP_T, 0, 1), m.d / FIG_SC, offs);
    case 'teeter': return teeterPose(t);
    case 'run': return runPose(P.phase, clamp(Math.abs(P.vx) / RUN, 0.25, 1));
    case 'skid': return m && m.fromJump ? mixPose(pose(Object.assign({}, CROUCH, { hip: [-2, -38], lean: 0.2 })), SKID, t / 0.22) : mixPose(runPose(P.phase, 1), SKID, t / 0.1);
    case 'runturn': {
      if (t < RTURN_FLIP) return mixPose(runPose(P.phase, 1), SKID, t / 0.1);
      const pivot = pose({ hip: [0, -47], lean: 0.1, legF: T_(3, -3), legB: T_(-12, -6), armF: A_(0.9, 1.5), armB: A_(-0.7, -0.2) });
      return mixPose(pivot, runPose(P.phase, 0.6), (t - RTURN_FLIP) / (RTURN_T - RTURN_FLIP));
    }
    case 'turn': { // weight shift, feet come together, pivot
      const mid = pose({ hip: [0, -49.5], lean: 0, legF: T_(1.5, -3), legB: T_(-1.5, -3.5), armF: A_(0.05, 0.35), armB: A_(-0.05, 0.3) });
      const h = TURN_T / 2; return t < h ? mixPose(standPose(L.time), mid, t / h) : Object.assign(mixPose(mid, standPose(L.time), (t - h) / h), { flip: true });
    }
    case 'bump': return pose({ lean: -0.38, hip: [-4, -48], head: 0.35, legF: T_(9, -3), legB: T_(-7, -3), armF: A_(1.5, 2.2), armB: A_(1.0, 1.6) });
    case 'crouch': return t < 0.15 ? mixPose(standPose(L.time), CROUCH, t / 0.15) : CROUCH;
    case 'crouchhop': { const h = Math.sin(Math.PI * clamp(t / 0.45, 0, 1)); return pose(Object.assign({}, CROUCH, { hip: [-1, -32 - 5 * h], legF: T_(8, -3 - 5 * h), legB: T_(-7, -3 - 6 * h) })); }
    case 'rise': return mixPose(CROUCH, standPose(L.time), t / 0.3);
    case 'drink': {
      const sip = pose(Object.assign({}, KNEEL, { lean: 0.05, head: -0.45, armF: A_(2.0, 3.35) }));
      if (t < 0.3) return mixPose(standPose(L.time), KNEEL, t / 0.3);
      if (t < 0.95) return mixPose(KNEEL, sip, (t - 0.3) / 0.2);
      return mixPose(KNEEL, standPose(L.time), (t - 0.95) / 0.3);
    }
    case 'pickup': {
      const reach = pose(Object.assign({}, KNEEL, { lean: 0.45, head: -0.3, armF: T_(15, -4) }));
      const raise = pose({ armF: A_(2.6, 3.0), armB: A_(-0.2, 0.2), sword: 3.1, head: -0.15 });
      if (t < 0.4) return mixPose(standPose(L.time), reach, t / 0.4);
      if (t < 0.5) return reach;
      return mixPose(reach, raise, (t - 0.5) / 0.35);
    }
    case 'draw': return mixPose(pose({ armF: A_(-0.5, 0.2), sword: 0.4 }), FIGHT, t / 0.4);
    case 'sheathe': return mixPose(FIGHT, pose({ armF: A_(-0.5, 0.2), sword: 0.4 }), t / 0.35);
    case 'land': {
      const j = P.jump || {};
      if (j.hard) return t < 0.45 ? pose(Object.assign({}, HARD, { armF: T_(17, -4) })) : mixPose(HARD, standPose(L.time), (t - 0.45) / 0.3);
      const low = j.soft ? pose(Object.assign({}, CROUCH, { hip: [-1, -40], lean: 0.3 })) : CROUCH;
      const dur = j.soft ? 0.18 : 0.32;
      return mixPose(low, standPose(L.time), (t - dur * 0.35) / (dur * 0.65));
    }
    case 'jump': {
      const j = P.jump;
      if (t < j.prep) return j.run ? runPose(P.phase, 1) : mixPose(standPose(0), pose(Object.assign({}, CROUCH, { hip: [-3, -34], lean: 0.6, armF: A_(-1.0, -0.6), armB: A_(-1.15, -0.7) })), t / j.prep);
      const p = clamp((t - j.prep) / j.T, 0, 1);
      const air = j.run
        ? pose({ hip: [2, -50], lean: 0.3, head: -0.12, ground: false, legF: A_(1.45, 1.15), legB: A_(-0.85, -1.7), armF: A_(2.4, 2.6), armB: A_(-0.9, -0.4) })
        : pose({ hip: [1, -50], lean: 0.38, head: -0.1, ground: false, legF: A_(1.25, 0.3), legB: A_(0.55, -0.75), armF: A_(1.62, 1.6), armB: A_(1.5, 1.5) });
      const reachDown = pose(Object.assign({}, air, { legF: A_(0.75, 0.25), legB: A_(0.1, -0.5), lean: 0.2 }));
      if (p < 0.18) return mixPose(j.run ? runPose(P.phase, 1) : CROUCH, air, p / 0.18);
      return p < 0.7 ? air : mixPose(air, reachDown, (p - 0.7) / 0.3);
    }
    case 'hop': return pose({ hip: [0, -49], ground: false, legF: A_(0.25, -0.35), legB: A_(0.05, -0.55), armF: A_(2.75, 2.95), armB: A_(2.6, 2.85) });
    case 'jumpUp': {
      const [hx, hy] = grabLocal();
      if (t < JUP_PREP) return mixPose(standPose(0), CROUCH, t / JUP_PREP * 0.6);
      return mixPose(pose({ hip: [0, -49], ground: false, legF: A_(0.3, -0.3), legB: A_(0.1, -0.5), armF: GRIP(hx - 1, hy + 2.5), armB: GRIP(hx - 3.5, hy + 2) }), hangPose(hx, hy, 0), (t - JUP_PREP) / JUP_T);
    }
    case 'hang': { const [hx, hy] = grabLocal(); return hangPose(hx, hy, t * 2.4); }
    case 'climbDown': {
      const [hx, hy] = grabLocal(), p = clamp(t / 0.5, 0, 1);
      const kneel = pose(Object.assign({}, CROUCH, { armF: GRIP(hx - 1, hy + 2.5), armB: GRIP(hx - 3.5, hy + 2), lean: 0.7 }));
      return p < 0.25 ? mixPose(standPose(0), kneel, p / 0.25) : mixPose(kneel, hangPose(hx, hy, 0), (p - 0.25) / 0.75);
    }
    case 'climb': return climbPose(t);
    case 'fall': {
      const f = Math.sin(L.time * 13) * 0.22;
      return pose({ hip: [0, -49], lean: -0.1, head: 0.2, ground: false, legF: A_(0.55, -0.15), legB: A_(-0.25, -0.8), armF: A_(2.6 + f, 2.95 + f), armB: A_(2.3 - f, 2.7 - f) });
    }
    case 'fight': return fightWalk(FIGHT, L.time * 0.6);
    case 'advance': case 'retreat': return fightStep(clamp(t / 0.28, 0, 1), m.d * P.dir / FIG_SC, offs);
    case 'strike': return strikePose(t, 0.13);
    case 'block': return pose(Object.assign({}, FIGHT, { armF: A_(1.25, 2.55), sword: 3.0, lean: -0.05 }));
    case 'hurt': return pose(Object.assign({}, FIGHT, { lean: -0.3, hip: [-3, -48], head: 0.3, armF: A_(0.6, 1.0), armB: A_(-0.6, -0.2), sword: sw ? 1.2 : null }));
    case 'parried': return pose(Object.assign({}, FIGHT, { lean: -0.22, armF: A_(2.2, 2.9), sword: 3.4 }));
    case 'dead': return deadPose(P.cause);
    case 'exit': return Object.assign(runPose(t * 1.4, 0.4), { alpha: clamp(1 - (t - 0.4) / 0.8, 0, 1) });
    case 'win': return pose({ armF: A_(1.35, 1.75), armB: A_(1.05, 1.5) });
    case 'gone': return pose({ alpha: 0 });
  }
  return BASE;
}

// Climb timeline matches player.js: pull (0-.38), mantle (.38-.78), stand (.78-1).
function climbPose(t) {
  const p = clamp(t / CLIMB_T, 0, 1), [hx, hy] = grabLocal();
  if (p < 0.38) {
    const q = p / 0.38;
    return pose({ hip: [-1, hy + 54.5], lean: 0.1 + 0.25 * q, head: -0.2, ground: false,
      legF: A_(0.2 + 1.0 * q, 0.05 - 0.9 * q), legB: A_(0.05 + 0.35 * q, -0.15 - 0.6 * q),
      armF: GRIP(hx - 1, hy + 2.5), armB: GRIP(hx - 3.5, hy + 2) });
  }
  if (p < 0.78) {
    const q = (p - 0.38) / 0.4, ly = hy; // ledge height in local space
    const front = ly < -30 ? A_(1.7, 0.25) : T_(Math.max(hx + 6, 4), Math.min(ly - 3, -3));
    return pose({ hip: [-2, -44 + q * 8], lean: 0.75 - 0.15 * q, head: -0.35, ground: true,
      legF: front, legB: A_(-0.1 + q * 0.6, -0.5 - q * 0.4),
      armF: { t: [hx + 1, hy + 2.5], bend: -1, grip: true }, armB: { t: [hx - 1, hy + 2], bend: -1, grip: true } });
  }
  return mixPose(CROUCH, standPose(0), (p - 0.78) / 0.22);
}

function fightWalk(base, ph) {
  const s = Math.sin(ph * 3) * 1.5;
  return pose(Object.assign({}, base, { hip: [base.hip[0], base.hip[1] + Math.abs(s) * 0.3], legF: T_(base.legF.t[0] + s, -3), legB: T_(base.legB.t[0] - s, -3) }));
}
function strikePose(t, wind) {
  if (t < wind) return mixPose(FIGHT, pose(Object.assign({}, FIGHT, { lean: -0.06, armF: A_(2.3, 2.9), sword: 2.7 })), t / wind * 1.6);
  const lunge = pose(Object.assign({}, FIGHT, { hip: [5, -42], lean: 0.3, legF: T_(23, -3), legB: T_(-13, -3), armF: A_(1.55, 1.6), armB: A_(-1.2, -1.7), sword: 1.62 }));
  return t < wind + 0.12 ? lunge : mixPose(lunge, FIGHT, (t - wind - 0.12) / 0.12);
}
function deadPose(cause) {
  if (cause === 'spikes') return pose({ hip: [0, -30], lean: 1.15, head: 0.6, legF: T_(6, -3), legB: T_(-9, -3), armF: A_(0.25, 0.35), armB: A_(0.15, 0.25) });
  return pose({ rot: -Math.PI / 2, dy: -8, lean: 0, head: 0.35, ground: false, hip: [0, -51], legF: A_(0.04, 0.0), legB: A_(-0.03, -0.04), armF: A_(0.06, 0.12), armB: A_(-0.08, 0.02) });
}

function guardPose(g) {
  switch (g.st) {
    case 'idle': return pose(Object.assign(standPose(L.time + g.x), { armF: A_(0.25, 0.65), sword: 0.55 }));
    case 'fight': return fightWalk(FIGHT, g.phase);
    case 'strike': return strikePose(g.t, 0.3);
    case 'block': return pose(Object.assign({}, FIGHT, { armF: A_(1.25, 2.55), sword: 3.0, lean: -0.05 }));
    case 'hurt': return pose(Object.assign({}, FIGHT, { lean: -0.32, hip: [-3, -48], head: 0.3, armF: A_(0.6, 1.0), sword: 1.2 }));
    case 'parried': return pose(Object.assign({}, FIGHT, { lean: -0.22, armF: A_(2.2, 2.9), sword: 3.4 }));
    case 'fall': return pose({ hip: [0, -49], ground: false, armF: A_(2.5, 2.9), armB: A_(2.2, 2.6), legF: A_(0.5, -0.2), legB: A_(-0.2, -0.7) });
    case 'dead': return deadPose('sword');
  }
  return BASE;
}

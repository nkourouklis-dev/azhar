// Turns a pose into joint angles and smooths them over time.
// Two layers: (1) inertialization: when a pose jumps between frames (a new move starts),
// the jump is absorbed and decays away, so moves flow into each other with no pops;
// (2) springs on lean, head and arms, which trail the body slightly and overshoot a touch.
// Values: 0 hipX 1 hipY 2 lean 3 head 4/5 front thigh/shin 6/7 back thigh/shin
//         8/9 front upper/fore arm 10/11 back upper/fore arm 12 sword 13 rot 14 dy
const N_V = 15, ANGLE = i => i >= 2 && i <= 13;
const segAng = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]); // from straight down, forward positive

function solvePose(ps) {
  const hip = ps.hip, u = [Math.sin(ps.lean), -Math.cos(ps.lean)], n = [-u[1], u[0]];
  const neck = [hip[0] + u[0] * LEN.torso, hip[1] + u[1] * LEN.torso];
  const sh = [neck[0] - u[0] * 3.5 - n[0] * 0.5, neck[1] - u[1] * 3.5 - n[1] * 0.5];
  const leg = (lg, back) => {
    const h = [hip[0] - n[0] * (back ? 1.5 : -1.5), hip[1]];
    if (lg.a) return [lg.a[0], lg.a[1], false];
    const [k, a] = ik(h, lg.t, LEN.thigh, LEN.shin, -1);
    return [segAng(h, k), segAng(k, a), ps.ground && lg.t[1] > -4.5];
  };
  const arm = am => {
    if (am.a) return [am.a[0], am.a[1], false];
    const [e, h] = ik(sh, am.t, LEN.upper, LEN.fore, am.bend == null ? 1 : am.bend);
    return [segAng(sh, e), segAng(e, h), !!am.grip];
  };
  const lf = leg(ps.legF, false), lb = leg(ps.legB, true), af = arm(ps.armF), ab = arm(ps.armB);
  return {
    v: [hip[0], hip[1], ps.lean, ps.head || 0, lf[0], lf[1], lb[0], lb[1], af[0], af[1], ab[0], ab[1], ps.sword == null ? NaN : ps.sword, ps.rot || 0, ps.dy || 0],
    flatF: lf[2], flatB: lb[2], gripF: af[2], gripB: ab[2], hasSword: ps.sword != null, alpha: ps.alpha, flip: !!ps.flip,
  };
}

const wrapA = a => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;
// Spring settings per value: [omega, zeta]; null = no spring (exact after inertialization).
const SPRING = [null, null, [24, 0.72], [15, 0.55], null, null, null, null, [19, 0.62], [17, 0.58], [19, 0.62], [17, 0.58], [28, 0.7], null, null];
const DECAY = [0.07, 0.07, 0.09, 0.09, 0.06, 0.06, 0.06, 0.06, 0.08, 0.08, 0.08, 0.08, 0.06, 0.22, 0.22];
const JUMP = [5, 5, 0.22, 0.22, 0.3, 0.3, 0.3, 0.3, 0.35, 0.35, 0.35, 0.35, 0.4, 0.3, 4];

function smoothPose(sm, s, dt) {
  const v = s.v;
  if (isNaN(v[12])) v[12] = sm && !isNaN(sm.out[12]) ? sm.out[12] : 1.9;
  if (!sm || !sm.prev) {
    sm = sm || {};
    sm.prev = v.slice(); sm.off = new Array(N_V).fill(0); sm.x = v.slice(); sm.vel = new Array(N_V).fill(0); sm.out = v.slice(); sm.flip = s.flip;
    return sm;
  }
  if (s.flip !== sm.flip) { sm.flip = s.flip; } // the pivot itself is the visible change
  for (let i = 0; i < N_V; i++) {
    let d = v[i] - sm.prev[i]; if (ANGLE(i)) d = wrapA(d);
    if (Math.abs(d) > JUMP[i] * Math.max(1, dt * 60)) sm.off[i] -= d; // a pose jump: absorb it
    sm.prev[i] = v[i];
    sm.off[i] *= Math.exp(-dt / DECAY[i]);
    let base = v[i] + sm.off[i];
    const grip = (i === 8 || i === 9) && s.gripF || (i === 10 || i === 11) && s.gripB;
    if (grip) { sm.off[i] *= 0.6; base = v[i] + sm.off[i]; }
    const sp = SPRING[i];
    if (!sp || grip) { sm.x[i] = base; sm.vel[i] = 0; }
    else {
      if (ANGLE(i)) sm.x[i] = base + wrapA(sm.x[i] - base);
      const [w, z] = sp, steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
      for (let k = 0; k < steps; k++) { sm.vel[i] += (w * w * (base - sm.x[i]) - 2 * z * w * sm.vel[i]) * h; sm.x[i] += sm.vel[i] * h; }
    }
    sm.out[i] = sm.x[i];
  }
  return sm;
}

// Convenience: pose -> smoothed solved pose, keeping the smoother on the owner object.
function smoothedFor(owner, ps, dt) {
  const s = solvePose(ps);
  owner.sm = smoothPose(owner.sm, s, dt);
  s.v = owner.sm.out.slice();
  return s;
}

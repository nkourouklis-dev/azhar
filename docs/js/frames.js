// Frame-based animation, the way the 1989 original works: every move is a fixed sequence of
// discrete frames played at 12 per second. Each frame moves the character's root (the point
// between the feet) by a fixed amount and may carry flags. There is no blending between frames.
//
// Distances and frame counts follow the original's documented movement table, scaled to our grid
// (one cell = 14 of its x units, one row = 63 of its screen pixels; our cell is 64px, our row 126px).
// The poses themselves are our own: a small skeleton drawn as pixel art by sprite.js.
//
// Pose units are sprite pixels (1 sprite px = 2 world px), origin at the feet, +x forward, -y up.
//   h: hip [x,y]   t: torso lean (deg, + forward)   hd: extra head tilt
//   f / b: near / far ankle [x,y] (knees bend forward)   fk / bk: -1 bends that knee backward
//   af / ab: near / far arm [upper, lower] absolute angles (deg; 0 down, 90 forward, 180 up)
//   hf / hb: near / far hand target [x,y] instead of angles (elbows bend back)
//   sw: sword blade angle in the near hand (same angle convention), or null
// Frame flags: a = airborne, L = landing check, s = footstep sound, F = turn round on entering,
//   H = sword hit lands, U = use the item, B = blocking, X = spikes are deadly (running feet)
const FPS = 12, FT = 1 / FPS, U = W / 14, SP = 2;

const STAND = { h: [0, -21], t: 3, hd: 0, f: [2, -1], b: [-3, -1], af: [8, 20], ab: [-6, 8], sw: null };
const S = o => Object.assign({}, STAND, o);
const FIGHT_P = S({ h: [0, -19], t: 4, f: [8, -1], b: [-8, -1], af: [62, 88], ab: [-115, -165], sw: 98 });
const F = o => Object.assign({}, FIGHT_P, o);

// a frame: [pose, dx in original x units, dy in world px, flags]
const fr = (p, dx = 0, dy = 0, fl = '') => ({ p, dx: dx * U, dy, fl });

// ---- standing, turning ----------------------------------------------------------------------
const P_READY = S({ t: 6, f: [3, -1], b: [-3, -1], af: [12, 40], ab: [-8, 20] });
const TURN = [
  fr(S({ t: 1, f: [2, -1], b: [-2, -1], af: [0, 12], ab: [2, 12] })),
  fr(S({ t: 0, f: [1, -1], b: [-1, -1], af: [-6, 6], ab: [8, 14] })),
  fr(S({ t: -1, f: [0, -1], b: [0, -1], af: [-3, 4], ab: [3, 8] })),
  fr(S({ t: 0, f: [0, -1], b: [0, -1], af: [4, 8], ab: [-3, 4] }), 0, 0, 'F'),
  fr(S({ t: 1, f: [1, -1], b: [-1, -1], af: [6, 14], ab: [-4, 6] })),
  fr(S({ t: 2, f: [2, -1], b: [-2, -1], af: [8, 18], ab: [-6, 8] })),
  fr(S({ t: 3, f: [2, -1], b: [-3, -1] })),
];

// ---- running --------------------------------------------------------------------------------
// One stride is push-off, flight, contact, mid-stance; the cycle is two strides (8 frames).
const runArm = s => [s * 48, s * 48 + 72];
const RUN_P = {
  AR: S({ h: [0, -20.5], t: 15, b: [-7, -2], f: [6, -8], af: runArm(-0.8), ab: runArm(0.8) }),
  BR: S({ h: [0, -21.5], t: 13, b: [-13, -7], f: [9, -4], af: runArm(-1), ab: runArm(1) }),
  CL: S({ h: [0, -20], t: 14, f: [7, -1], b: [-9, -8], af: runArm(-0.7), ab: runArm(0.7) }),
  DL: S({ h: [0, -19], t: 15, f: [2, -1], b: [-3, -11], af: runArm(0), ab: runArm(0) }),
  AL: S({ h: [0, -20.5], t: 15, f: [-7, -2], b: [6, -8], af: runArm(0.8), ab: runArm(-0.8) }),
  BL: S({ h: [0, -21.5], t: 13, f: [-13, -7], b: [9, -4], af: runArm(1), ab: runArm(-1) }),
  CR: S({ h: [0, -20], t: 14, b: [7, -1], f: [-9, -8], af: runArm(0.7), ab: runArm(-0.7) }),
  DR: S({ h: [0, -19], t: 15, b: [2, -1], f: [-3, -11], af: runArm(0), ab: runArm(0) }),
};
const RUN = [ // running cycle, 26 units per loop
  fr(RUN_P.AR, 4, 0, 'X'), fr(RUN_P.BR, 5, 0, 'X'), fr(RUN_P.CL, 1, 0, 'sX'), fr(RUN_P.DL, 2, 0, 'X'),
  fr(RUN_P.AL, 4, 0, 'X'), fr(RUN_P.BL, 5, 0, 'X'), fr(RUN_P.CR, 1, 0, 'sX'), fr(RUN_P.DR, 2, 0, 'X'),
];
const SR = [ // start running: four frames of lean, then a lurching first stride
  fr(P_READY),
  fr(S({ h: [1, -20.5], t: 10, f: [2, -1], b: [-4, -2], af: [-10, 40], ab: [20, 70] })),
  fr(S({ h: [2, -20], t: 14, f: [1, -1], b: [-5, -4], af: [-25, 30], ab: [30, 90] })),
  fr(S({ h: [3, -20], t: 18, f: [0, -2], b: [-4, -8], af: [-32, 30], ab: [36, 100] })),
  fr(S({ h: [0, -20], t: 16, b: [8, -2], f: [-10, -4], af: runArm(0.8), ab: runArm(-0.8) }), 8, 0, 's'),
  fr(RUN_P.DR, 3),
];
const RSTOP = [ // run stop: plant, skid, rock back, settle (9 units)
  fr(S({ h: [0, -19], t: 2, f: [10, -1], b: [-6, -5], af: [50, 100], ab: [20, 80] }), 0, 0, 'sX'),
  fr(S({ h: [0, -17], t: -6, f: [8, -1], b: [-4, -2], af: [70, 110], ab: [40, 90] }), 2, 0, 'X'),
  fr(S({ h: [1, -16], t: -10, f: [12, -1], b: [-3, -1], af: [80, 120], ab: [50, 100] }), 7, 0, 'X'),
  fr(S({ h: [1, -16], t: -8, f: [12, -1], b: [-2, -1], af: [70, 110], ab: [45, 95] })),
  fr(S({ h: [0, -18], t: -2, f: [8, -1], b: [-3, -1], af: [40, 80], ab: [30, 60] }), 2),
  fr(S({ h: [-1, -19], t: -3, f: [5, -1], b: [-4, -1], af: [25, 50], ab: [15, 35] }), -2),
  fr(S({ h: [0, -20.5], t: 2, f: [3, -1], b: [-3, -1], af: [15, 30], ab: [0, 15] })),
  fr(STAND),
];
const RTURN = [ // running turn: skid, swing round, push off the other way (13 frames)
  fr(RSTOP[0].p, 1, 0, 'sX'), fr(RSTOP[1].p, 3, 0, 'X'), fr(RSTOP[2].p, 2), fr(RSTOP[3].p, 1),
  fr(S({ h: [0, -18], t: -3, f: [6, -1], b: [-3, -1], af: [40, 90], ab: [60, 100] })),
  fr(S({ h: [0, -19], t: -2, f: [2, -1], b: [1, -1], af: [0, 30], ab: [10, 40] })),
  fr(S({ h: [0, -19], t: 5, f: [-2, -1], b: [2, -1], af: [-10, 30], ab: [20, 60] }), 0, 0, 'F'),
  fr(SR[1].p, 0), fr(SR[2].p, 1), fr(SR[3].p, 2), fr(SR[4].p, 3, 0, 's'), fr(SR[5].p, 3),
];
const BUMP = [ // ran into a wall
  fr(S({ h: [-1, -20], t: -16, f: [3, -1], b: [-5, -2], af: [70, 110], ab: [40, 80], hd: -10 }), -1, 0, 's'),
  fr(S({ h: [-2, -18], t: -10, f: [3, -1], b: [-6, -1], af: [50, 90], ab: [30, 60] }), -1),
  fr(S({ h: [-1, -17], t: 8, f: [3, -1], b: [-5, -1], af: [30, 60], ab: [20, 40] })),
  fr(S({ h: [0, -19], t: 6, f: [3, -1], b: [-4, -1] })),
  fr(S({ h: [0, -20.5], t: 4 })),
];

// ---- careful step (one cell; shorter steps scale it down) ------------------------------------
// Feet are given in sequence space (from the step's start) so the planted foot stays put.
const STEP_SRC = [ // [pose, dx units, near foot, far foot]
  [{ t: 4, af: [8, 20], ab: [-6, 8] }, 0, [2, -1], [-3, -1]],
  [{ t: 5, af: [0, 25], ab: [2, 14] }, 1, [5, -4], [-3, -1]],
  [{ t: 6, af: [-10, 20], ab: [12, 26] }, 1, [11, -4], [-3, -1]],
  [{ t: 6, h: [0, -18.5], af: [-16, 14], ab: [16, 30] }, 3, [18, -1], [-3, -2]],
  [{ t: 6, h: [0, -19], af: [-10, 20], ab: [12, 26] }, 4, [18, -1], [4, -7]],
  [{ t: 5, h: [0, -20], af: [0, 25], ab: [2, 16] }, 3, [18, -1], [16, -7]],
  [{ t: 4, h: [0, -20.5], af: [10, 30], ab: [-8, 8] }, 2, [18, -1], [26, -4]],
  [{ t: 4, af: [10, 25], ab: [-8, 8] }, 0, [18, -2], [29, -1]],
  [{ t: 3, af: [6, 20], ab: [-4, 10] }, 0, [24, -4], [29, -1]],
  [{ t: 3, af: [8, 20], ab: [-6, 8] }, 0, [30, -3], [29, -1]],
  [{ t: 3 }, 0, [34, -1], [29, -1]],
  [{ t: 3 }, 0, [34, -1], [29, -1]],
];
const stepCache = new Map();
function stepFrames(units) { // a careful step of `units` (1..14) original x units
  units = Math.max(1, Math.min(14, Math.round(units)));
  if (stepCache.has(units)) return stepCache.get(units);
  const k = units / 14;
  let root = 0;
  const out = STEP_SRC.map(([o, dx, nf, ff], i) => {
    root += dx * U * k / SP;
    // shorter steps shrink the stride around each foot's starting spot
    const p = S(Object.assign({}, o, { f: [2 + (nf[0] - 2) * k - root, nf[1]], b: [-3 + (ff[0] + 3) * k - root, ff[1]] }));
    return fr(p, dx * k, 0, i === 3 || i === 7 ? 's' : '');
  });
  stepCache.set(units, out);
  return out;
}
const TESTFOOT = [ // toes over the edge, arms wheeling, back to balance
  fr(S({ f: [2, -1], b: [-3, -1] })),
  fr(S({ t: 4, f: [5, -3], af: [60, 80], ab: [40, 70] })),
  fr(S({ t: 8, f: [9, -2], af: [80, 100], ab: [-60, -30] }), 0, 0, 's'),
  fr(S({ h: [1, -20], t: 12, f: [10, 0], af: [120, 160], ab: [-80, -40] })),
  fr(S({ t: 6, f: [10, -1], af: [60, 40], ab: [-120, -150] })),
  fr(S({ t: 10, f: [9, -3], af: [150, 180], ab: [-30, 0] })),
  fr(S({ t: 2, f: [7, -4], af: [90, 120], ab: [-90, -60] })),
  fr(S({ t: -3, f: [5, -3], af: [40, 70], ab: [-30, 0] })),
  fr(S({ t: -1, f: [3, -1], af: [20, 40], ab: [-10, 10] })),
  fr(S({ t: 1 })),
  fr(STAND),
];

// ---- jumps ------------------------------------------------------------------------------------
const SJUMP = [ // standing jump: wind-up, spring, flight, land (18 frames)
  fr(S({ af: [20, 40], ab: [10, 30] })),
  fr(S({ af: [60, 90], ab: [45, 80] })),
  fr(S({ h: [-1, -18], t: 15, f: [3, -1], af: [30, 60], ab: [20, 50] })),
  fr(S({ h: [-2, -15.5], t: 30, f: [4, -1], af: [-40, -10], ab: [-50, -20] })),
  fr(S({ h: [-2, -14.5], t: 38, f: [4, -1], af: [-70, -40], ab: [-75, -45] })),
  fr(S({ h: [0, -17], t: 30, f: [3, -1], af: [0, 30], ab: [-10, 20] })),
  fr(S({ h: [2, -21], t: 25, f: [2, -2], b: [-4, -3], af: [80, 110], ab: [70, 100] }), 1),
  fr(S({ h: [0, -22], t: 22, f: [6, -7], b: [-9, -5], af: [120, 150], ab: [110, 140] }), 5, -8, 'a'),
  fr(S({ h: [0, -23], t: 15, f: [9, -11], b: [-6, -11], af: [150, 170], ab: [140, 160] }), 6, -10, 'a'),
  fr(S({ h: [0, -23], t: 12, f: [10, -10], b: [-3, -10], af: [115, 140], ab: [100, 130] }), 6, -4, 'a'),
  fr(S({ h: [0, -22], t: 10, f: [11, -5], b: [4, -6], af: [90, 120], ab: [80, 110] }), 5, 4, 'a'),
  fr(S({ h: [0, -21], t: 8, f: [10, -2], b: [5, -3], af: [70, 100], ab: [60, 90] }), 4, 10, 'a'),
  fr(S({ h: [0, -16], t: 25, f: [6, -1], b: [-1, -1], af: [60, 80], ab: [40, 70] }), 2, 8, 'Ls'),
  fr(S({ h: [0, -14], t: 30, f: [5, -1], b: [-3, -1], af: [40, 60], ab: [30, 50] }), 1, 0, 'X'),
  fr(S({ h: [0, -16], t: 20, f: [4, -1], b: [-3, -1], af: [25, 45], ab: [15, 35] })),
  fr(S({ h: [0, -18], t: 12, f: [3, -1], b: [-3, -1], af: [15, 30] })),
  fr(S({ h: [0, -20], t: 6, f: [2, -1], b: [-3, -1] })),
  fr(STAND),
];
const RJUMP = [ // running jump (11 frames, 67 units)
  fr(S({ h: [0, -19], t: 18, f: [2, -1], b: [-4, -9], af: [-40, 10], ab: [-30, 20] }), 0, 0, 'X'),
  fr(S({ h: [0, -21], t: 18, f: [-6, -2], b: [6, -9], af: [60, 110], ab: [40, 100] }), 5, 0, 'a'),
  fr(S({ h: [0, -22], t: 14, f: [-12, -6], b: [9, -9], af: [110, 150], ab: [90, 130] }), 6, 0, 'a'),
  fr(S({ h: [0, -23], t: 10, f: [-14, -9], b: [13, -8], af: [135, 165], ab: [-70, -30] }), 3, -6, 'a'),
  fr(S({ h: [0, -23], t: 8, f: [-15, -10], b: [14, -9], af: [140, 170], ab: [-75, -35] }), 5, -18, 'a'),
  fr(S({ h: [0, -23], t: 8, f: [-12, -8], b: [14, -8], af: [130, 160], ab: [-60, -20] }), 7, -4, 'a'),
  fr(S({ h: [0, -22], t: 10, f: [-8, -6], b: [13, -5], af: [110, 140], ab: [-30, 10] }), 12, 0, 'a'),
  fr(S({ h: [0, -21], t: 12, f: [-4, -6], b: [12, -3], af: [90, 120], ab: [60, 100] }), 8, 22, 'a'),
  fr(S({ h: [0, -18], t: 16, b: [9, -1], f: [-6, -5], af: [60, 100], ab: [40, 90] }), 8, 6, 'Ls'),
  fr(S({ h: [0, -17], t: 18, b: [3, -1], f: [-2, -9], af: [30, 80], ab: [10, 60] }), 4, 0, 'X'),
  fr(RUN_P.AR, 4, 0, 'X'),
];
const JUP_PREP = [
  fr(S({ af: [60, 90], ab: [50, 80] })),
  fr(S({ h: [0, -17], t: 15, f: [3, -1], af: [-30, 0], ab: [-30, 0] })),
  fr(S({ h: [0, -15], t: 20, f: [3, -1], af: [-50, -20], ab: [-50, -20] })),
];
const JUMPUP = [ // straight up and down, nothing to catch (13 frames)
  ...JUP_PREP,
  fr(S({ h: [0, -22], t: 2, f: [1, -2], b: [-2, -2], af: [160, 175], ab: [150, 170] }), 0, -10, 'a'),
  fr(S({ h: [0, -22], t: 0, f: [1, -3], b: [-1, -3], af: [175, 180], ab: [168, 178] }), 0, -12, 'a'),
  fr(S({ h: [0, -22], t: 0, f: [1, -3], b: [-1, -3], af: [178, 180], ab: [170, 178] }), 0, -4, 'aT'),
  fr(S({ h: [0, -22], t: 1, f: [1, -3], b: [-1, -3], af: [170, 178], ab: [160, 172] }), 0, 4, 'a'),
  fr(S({ h: [0, -21], t: 2, f: [1, -2], b: [-2, -2], af: [140, 160], ab: [130, 150] }), 0, 12, 'a'),
  fr(S({ h: [0, -17], t: 15, f: [3, -1], af: [60, 90], ab: [50, 80] }), 0, 10, 's'),
  fr(S({ h: [0, -15], t: 20, f: [3, -1], af: [30, 60], ab: [20, 50] })),
  fr(S({ h: [0, -18], t: 10, f: [3, -1], af: [20, 40] })),
  fr(S({ h: [0, -20], t: 5 })),
  fr(STAND),
];

// ---- hanging and climbing -----------------------------------------------------------------
// While hanging the root is still the feet, 90px (45 sprite px) below the hands.
const hangP = sx => ({ h: [sx * 0.5 - 1, -20], t: -4, hd: 4, f: [sx, -0.5 - Math.abs(sx) * 0.2], b: [sx - 2, -1], fk: -1, bk: -1, hf: [5, -45], hb: [4, -45], af: null, ab: null });
const JUMPGRAB = [ // spring up and catch the ledge; the root rise is set by player.js
  ...JUP_PREP,
  fr(S({ h: [0, -23], t: -2, f: [0, -3], b: [-1, -2], af: [170, 178], ab: [165, 176] }), 0, 0, 'a'),
  fr(S({ h: [0, -22], t: -3, f: [2, -5], b: [-1, -4], fk: -1, af: [176, 180], ab: [172, 178] }), 0, 0, 'a'),
  fr(S(hangP(3)), 0, 0, 's'),
];
const HANG_FR = [3, 5, 3, 0, -2, -3, -2, 0, 1, 0].map(sx => fr(S(hangP(sx))));

// Climbing up is authored in ledge space: origin at the ledge corner, +x onto the ledge.
// [root, hip, lean, near ankle, far ankle, near hand, far hand, near knee dir]
const CLIMB_SRC = [
  [[-5, 45], [-6, 25], -4, [-5, 45], [-6, 44], [0, 0], [-1, 0], -1],
  [[-5, 45], [-6, 24], -3, [-4, 44], [-6, 44], [0, 0], [-1, 0], -1],
  [[-5, 40], [-6, 20], -2, [-3, 38], [-6, 40], [0, 0], [-1, 0], -1],
  [[-5, 33], [-6, 13], 0, [-4, 32], [-6, 33], [0, 0], [-1, 0], -1],
  [[-5, 27], [-6, 8], 5, [-4, 26], [-6, 27], [0, 0], [-1, 0], -1],
  [[-5, 27], [-6, 7], 8, [-4, 26], [-6, 27], [1, 0], [0, 0], -1],
  [[-5, 20], [-5, 4], 30, [-6, 22], [-7, 24], [2, 0], [1, 0], -1],
  [[-4, 15], [-4, 1], 45, [-6, 18], [-7, 20], [3, 0], [2, 0], -1],
  [[-2, 7], [-3, -1], 50, [1, -1], [-6, 14], [4, 0], [3, 0], 1],
  [[0, 4], [0, -6], 45, [2, -1], [-5, 8], [6, 0], [5, 0], 1],
  [[2, 1], [2, -9], 40, [3, -1], [-3, 2], [8, 0], [7, 0], 1],
  [[4, 0], [4, -12], 35, [5, -1], [1, -1], [10, -2], [9, -2], 1],
  [[6, 0], [6, -13], 30, [9, -1], [3, -1], null, null, 1],
  [[7, 0], [7, -16], 20, [9, -1], [4, -1], null, null, 1],
  [[8, 0], [8, -18], 12, [10, -1], [5, -1], null, null, 1],
  [[9, 0], [9, -20], 6, [11, -1], [6, -1], null, null, 1],
  [[9, 0], [9, -21], 3, [11, -1], [6, -1], null, null, 1],
];
function climbFrame(i, prevRoot) {
  const [root, hip, t, nf, ff, nh, fh, kd] = CLIMB_SRC[i];
  const rel = q => q && [q[0] - root[0], q[1] - root[1]];
  const p = S({ h: rel(hip), t, f: rel(nf), b: rel(ff), fk: kd, bk: kd, hf: rel(nh), hb: rel(fh), af: nh ? null : [30 - i, 50], ab: fh ? null : [20, 40] });
  if (i === CLIMB_SRC.length - 1) Object.assign(p, { f: [2, -1], b: [-3, -1], af: STAND.af, ab: STAND.ab });
  return { p, dx: (root[0] - prevRoot[0]) * SP, dy: (root[1] - prevRoot[1]) * SP, fl: i === 8 || i === 12 ? 's' : '' };
}
const CLIMB = CLIMB_SRC.map((c, i) => climbFrame(i, i ? CLIMB_SRC[i - 1][0] : c[0]));
// Climbing down plays climbing frames backwards, ending in the hang.
const CLIMBDOWN = (() => {
  const idx = [16, 14, 12, 11, 10, 9, 8, 6, 3, 0];
  return idx.map((ci, k) => {
    const prev = k ? CLIMB_SRC[idx[k - 1]][0] : CLIMB_SRC[ci][0], cur = CLIMB_SRC[ci][0];
    return { p: climbFrame(ci, cur).p, dx: (cur[0] - prev[0]) * SP, dy: (cur[1] - prev[1]) * SP, fl: '' };
  });
})();

// ---- crouching, landing, falling ----------------------------------------------------------
const P_CROUCH = S({ h: [-2, -11], t: 45, hd: -20, f: [6, -1], b: [-5, -1], af: [40, 70], ab: [30, 60] });
const STOOP = [fr(S({ h: [-1, -16], t: 25, f: [4, -1], b: [-4, -1], af: [30, 55], ab: [20, 45] })), fr(S({ h: [-2, -12], t: 40, hd: -15, f: [5, -1], b: [-5, -1], af: [40, 65], ab: [30, 55] })), fr(P_CROUCH)];
const STANDUP = [
  fr(S({ h: [-2, -12], t: 38, hd: -10, f: [5, -1], b: [-5, -1], af: [35, 60], ab: [25, 50] })),
  fr(S({ h: [-1, -15], t: 25, f: [4, -1], b: [-4, -1], af: [25, 45], ab: [15, 35] })),
  fr(S({ h: [0, -18], t: 12, f: [3, -1], b: [-3, -1], af: [15, 30] })),
  fr(S({ h: [0, -20], t: 5 })),
  fr(STAND),
];
const CRAWL = [
  fr(S({ h: [0, -12], t: 45, hd: -15, f: [6, -1], b: [-5, -1], af: [70, 90], ab: [60, 80] })),
  fr(S({ h: [2, -14], t: 40, hd: -12, f: [7, -3], b: [-4, -3], af: [60, 80], ab: [50, 70] }), 2),
  fr(S({ h: [1, -12], t: 45, hd: -15, f: [6, -1], b: [-4, -2], af: [50, 75], ab: [40, 65] }), 2),
  fr(P_CROUCH, 1),
];
const SOFTLAND = [fr(S({ h: [0, -14], t: 30, f: [5, -1], b: [-4, -1], af: [60, 90], ab: [50, 80] }), 0, 0, 's'), fr(P_CROUCH), ...STANDUP];
const P_KNEEL = S({ h: [-3, -10], t: 50, hd: -30, f: [7, -1], b: [-7, -1], af: [20, 10], ab: [10, 0] });
const MEDLAND = [fr(SOFTLAND[0].p, 0, 0, 's'), fr(P_KNEEL), ...Array(16).fill(fr(P_KNEEL)), fr(P_CROUCH), ...STANDUP];
const FALL = [
  fr(S({ h: [0, -21], t: 5, f: [3, -3], b: [-3, -2], af: [120, 150], ab: [100, 130] }), 0, 0, 'a'),
  fr(S({ h: [0, -21], t: 0, f: [4, -5], b: [-2, -3], af: [150, 175], ab: [130, 160] }), 0, 0, 'a'),
  fr(S({ h: [0, -21], t: -3, f: [3, -3], b: [-1, -5], af: [140, 170], ab: [150, 175] }), 0, 0, 'a'),
];

// ---- items --------------------------------------------------------------------------------
const P_BEND = S({ h: [-2, -14], t: 40, hd: -10, f: [6, -1], b: [-6, -1], af: [55, 60], ab: [40, 50] });
const DRINK = [
  fr(S({ h: [-1, -18], t: 20, af: [40, 50] })), fr(P_BEND), fr(S(Object.assign({}, P_BEND, { af: [30, 20] }))),
  fr(S({ h: [-1, -18], t: 15, af: [20, 90] })),
  fr(S({ t: 2, hf: [4, -33] })), fr(S({ t: -2, hd: -10, hf: [4, -35] })),
  ...Array(6).fill(fr(S({ t: -4, hd: -22, hf: [3, -38] }), 0, 0, '')),
  fr(S({ t: -4, hd: -22, hf: [3, -38] }), 0, 0, 'U'),
  fr(S({ t: -3, hd: -18, hf: [3, -37] })), fr(S({ t: -2, hd: -10, hf: [4, -34] })),
  fr(S({ t: 0, hf: [5, -28] })), fr(S({ t: 2, af: [40, 80] })), fr(S({ t: 3, af: [20, 40] })),
  fr(S({ t: 3, af: [12, 25] })), fr(STAND), fr(STAND),
];
const PICKUP = [
  fr(S({ h: [-1, -18], t: 20, af: [40, 50] })), fr(P_BEND), fr(S(Object.assign({}, P_BEND, { af: [70, 75] }))),
  fr(S(Object.assign({}, P_BEND, { af: [65, 70], sw: 92 })), 0, 0, 'U'),
  fr(S({ h: [-1, -17], t: 22, af: [80, 110], sw: 120 })),
  fr(S({ h: [0, -20], t: 8, af: [130, 160], sw: 175 })),
  fr(S({ t: 3, af: [140, 170], sw: 178 })), fr(S({ t: 3, af: [90, 140], sw: 160 })), fr(STAND),
];

// ---- sword fighting -----------------------------------------------------------------------
const ENGARDE = [
  fr(S({ af: [-25, 40] })),
  fr(S({ af: [30, 100], sw: 120 }), 0, 0, 's'),
  fr(S({ h: [0, -20], f: [5, -1], b: [-5, -1], af: [95, 125], sw: 150 }), 1),
  fr(F({ h: [0, -19.5], af: [75, 100], sw: 110, ab: [-80, -130] }), 1),
  fr(FIGHT_P), fr(FIGHT_P),
];
const SHEATHE = [fr(F({ af: [90, 130], sw: 150 })), fr(S({ af: [30, 80], sw: 140 })), fr(S({ af: [-20, 30] })), fr(STAND)];
const ADVANCE = [fr(F({ h: [1, -19], f: [12, -3], b: [-8, -1] }), 2), fr(F({ h: [0, -18.5], f: [9, -1], b: [-9, -2] }), 3, 0, 's'), fr(FIGHT_P, 1)];
const RETREAT = [fr(F({ h: [-1, -19], f: [8, -1], b: [-11, -3] }), -3), fr(FIGHT_P, -2, 0, 's')];
const STRIKE = [
  fr(F({ h: [-1, -19], t: 0, af: [30, 70], sw: 140 })),
  fr(F({ h: [-1, -19.5], t: -2, af: [15, 45], sw: 165 })),
  fr(F({ h: [3, -18], t: 15, f: [12, -1], af: [88, 92], sw: 92 })),
  fr(F({ h: [4, -17], t: 18, f: [13, -1], af: [92, 92], sw: 90 }), 0, 0, 'H'),
  fr(F({ h: [4, -17], t: 18, f: [13, -1], af: [92, 92], sw: 90 })),
  fr(F({ h: [2, -18], t: 10, f: [10, -1], af: [75, 90], sw: 95 })),
  fr(F({ h: [1, -18.5], t: 6, f: [9, -1], af: [68, 88] })),
  fr(FIGHT_P),
];
const BLOCK = [
  fr(F({ af: [110, 150], sw: 165, t: 0 }), 0, 0, 'B'), fr(F({ af: [115, 155], sw: 170, t: -2 }), 0, 0, 'B'),
  fr(F({ af: [110, 150], sw: 165, t: 0 }), 0, 0, 'B'), fr(F({ af: [80, 110], sw: 120 })), fr(FIGHT_P),
];
const PARRIED = [fr(F({ h: [-1, -19], t: -8, af: [100, 130], sw: 140 }), -1), fr(F({ h: [-1, -19], t: -6, af: [90, 120], sw: 130 })), fr(F({ t: 0, af: [75, 100], sw: 110 })), fr(FIGHT_P)];
const HURT = [fr(F({ h: [-2, -19], t: -14, hd: -10, af: [40, 90], sw: 120 }), -2), fr(F({ h: [-2, -18], t: -8, af: [50, 90], sw: 110 }), -1), fr(F({ t: 0 }), -1), fr(FIGHT_P)];
const P_DEAD = S({ h: [0, -3], t: -90, hd: -5, f: [20, -1], b: [19, -2], af: [80, 95], ab: [100, 115], sw: null });
const DIE = [
  fr(S({ h: [-1, -18], t: -14, hd: -15, f: [4, -1], b: [-5, -1], af: [60, 100], ab: [40, 80] }), -1),
  fr(S({ h: [-2, -12], t: -6, hd: -10, f: [6, -1], b: [-6, -1], af: [40, 70], ab: [20, 50] }), -1),
  fr(S({ h: [-2, -7], t: -45, hd: -10, f: [10, -1], b: [8, -1], af: [60, 80], ab: [70, 90] }), -1, 0, 's'),
  fr(S({ h: [-1, -4], t: -75, hd: -5, f: [16, -1], b: [15, -2], af: [80, 95], ab: [95, 110] })),
  fr(P_DEAD),
];
const P_SPIKED = S({ h: [0, -9], t: 40, hd: 35, f: [6, -1], b: [-6, -1], af: [25, 10], ab: [15, 0] });

// Sequence table. mode decides how the root is treated; next is where a sequence goes when it
// runs out (null = hold the last frame); loop = frame index to loop back to.
const SEQ = {
  stand: { mode: 'ground', frames: [fr(STAND)], next: null },
  ready: { mode: 'ground', frames: [fr(P_READY)], next: null },
  step: { mode: 'ground', frames: stepFrames(14), next: 'stand' },
  turn: { mode: 'ground', frames: TURN, next: 'stand' },
  startrun: { mode: 'ground', frames: SR, next: 'run' },
  run: { mode: 'ground', frames: RUN, loop: 0 },
  runstop: { mode: 'ground', frames: RSTOP, next: 'stand', safe: true },
  runturn: { mode: 'ground', frames: RTURN, next: 'run' },
  bump: { mode: 'ground', frames: BUMP, next: 'stand' },
  testfoot: { mode: 'ground', frames: TESTFOOT, next: 'stand' },
  standjump: { mode: 'ground', frames: SJUMP, next: 'stand' },
  runjump: { mode: 'ground', frames: RJUMP, next: 'run' },
  jumpup: { mode: 'ground', frames: JUMPUP, next: 'stand' },
  jumpgrab: { mode: 'hang', frames: JUMPGRAB, next: 'hang' },
  hang: { mode: 'hang', frames: HANG_FR, next: null },
  climbup: { mode: 'hang', frames: CLIMB, next: 'stand' },
  climbdown: { mode: 'hang', frames: CLIMBDOWN, next: 'hang' },
  stoop: { mode: 'ground', frames: STOOP, next: null },
  standup: { mode: 'ground', frames: STANDUP, next: 'stand' },
  crawl: { mode: 'ground', frames: CRAWL, next: null },
  softland: { mode: 'ground', frames: SOFTLAND, next: 'stand' },
  medland: { mode: 'ground', frames: MEDLAND, next: 'stand' },
  fall: { mode: 'fall', frames: FALL, loop: 1 },
  drink: { mode: 'ground', frames: DRINK, next: 'stand' },
  pickup: { mode: 'ground', frames: PICKUP, next: 'stand' },
  engarde: { mode: 'ground', frames: ENGARDE, next: 'fight' },
  fight: { mode: 'ground', frames: [fr(FIGHT_P)], next: null },
  sheathe: { mode: 'ground', frames: SHEATHE, next: 'stand' },
  advance: { mode: 'ground', frames: ADVANCE, next: 'fight' },
  retreat: { mode: 'ground', frames: RETREAT, next: 'fight' },
  strike: { mode: 'ground', frames: STRIKE, next: 'fight' },
  block: { mode: 'ground', frames: BLOCK, next: 'fight' },
  parried: { mode: 'ground', frames: PARRIED, next: 'fight' },
  hurt: { mode: 'ground', frames: HURT, next: 'fight' },
  die: { mode: 'dead', frames: DIE, next: null },
  dead: { mode: 'dead', frames: [fr(P_DEAD)], next: null },
  spiked: { mode: 'dead', frames: [fr(P_SPIKED)], next: null },
  exit: { mode: 'ground', frames: [], next: null },
  win: { mode: 'ground', frames: [fr(S({ af: [150, 170], ab: [140, 165] }))], next: null },
};
SEQ.exit.frames = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => stepFrames(14)[i]).map(f => ({ p: f.p, dx: 0, dy: 0, fl: '' }));
const FIGHT_SEQS = new Set(['engarde', 'fight', 'advance', 'retreat', 'strike', 'block', 'parried', 'hurt']);
const PRINCESS_POSE = S({ t: 1, f: [2, -1], b: [-2, -1], af: [30, 110], ab: [25, 105] });

// Geometry: a room is 10 cells x 3 rows, like the 1989 original.
const W = 64, H = 126, ROOM_C = 10, ROOM_R = 3;
const VIEW_W = 640, VIEW_H = 378, HUD_H = 22, CANVAS_H = VIEW_H + HUD_H;
const FLOOR_OFF = 12;      // walking surface sits this far above the cell bottom
const FIG_SC = 0.86;       // the figure's drawing units per world px (body.js)
const HANG = 90;           // feet are this far below the hands while hanging
const TOTAL_TIME = 30 * 60; // seconds to rescue the princess

const floorY = r => (r + 1) * H - FLOOR_OFF;
const colOf = x => Math.floor(x / W);
const rowOf = y => Math.floor((y - 1) / H);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const rand = (a, b) => a + Math.random() * (b - a);
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

/*
 Tile legend
  ' ' air        '#' stone block    '_' floor       't' floor + torch
  '~' loose floor '^' spikes        'c' slicer blades
  'a','b' pressure plate -> opens gate '1','2'
  'X' plate that opens the exit door  'E' exit door  'Q' princess
  'h' healing potion  'H' life potion (+1 max)  'S' sword
  'P' start          'G' guard
*/
const LEVELS = [
  {
    name: 'Τα Μπουντρούμια', theme: 'dungeon', skill: 0.25, guardHp: 3, guardColor: 0,
    intro: 'Βρες το σπαθί. Πάτα την πλάκα για να ανοίξει η έξοδος.',
    map: [
      '##############################',
      '#    __t__' + '___  __S_~' + '___G_hX_E#',
      '#P_t_____#' + '#_t_______' + '##########',
    ],
  },
  {
    name: 'Ο Διάδρομος των Λεπίδων', theme: 'dungeon', skill: 0.4, guardHp: 3, guardColor: 1,
    intro: 'Η πλάκα ανοίγει την πύλη για λίγα δευτερόλεπτα. Τρέξε!',
    map: [
      '########################################',
      '#P_t__^___' + '___  a__1_' + '_c__~~__t_' + '__G__X__E#',
      '##########' + '###  #####' + '####__h___' + '##########',
    ],
  },
  {
    name: 'Ο Πύργος της Φρουράς', theme: 'dungeon', skill: 0.55, guardHp: 4, guardColor: 2,
    intro: 'Σκαρφάλωσε ψηλά. Μην πέσεις στα καρφιά.',
    map: [
      '##########' + '####  __a_' + '___c___1__' + '__G___t  _',
      '#    ___t_' + '__  ~_  __' + '_t_h######' + '#######X_E',
      '#P_^_____#' + '___t___^__' + '##########' + '##########',
    ],
  },
  {
    name: 'Το Παλάτι του Βεζίρη', theme: 'palace', skill: 0.72, guardHp: 5, guardColor: 3,
    intro: 'Η πριγκίπισσα σε περιμένει. Ο αρχιφύλακας όχι.',
    map: [
      '########################################',
      '#P_t_c__  ' + '__^__~~_a_' + '_1___G__t_' + '_c__cH  _Q',
      '####____h_' + '#####___##' + '##########' + '######  ##',
    ],
  },
];

const GUARD_STYLES = [
  { tunic: '#5b6b3a', shade: '#3c4826', turban: '#a8742c', vest: '#2d2a26', pants: '#4a3e2c' },
  { tunic: '#3f5d78', shade: '#29405a', turban: '#c9c1ad', vest: '#232a33', pants: '#33404f' },
  { tunic: '#7a3b54', shade: '#55263a', turban: '#d3a347', vest: '#2a1f25', pants: '#4b2c3a' },
  { tunic: '#2a2140', shade: '#191329', turban: '#b5221d', vest: '#c9a24a', pants: '#211a32', helmet: '#c9a24a', trim: '#6b4f1c' },
];

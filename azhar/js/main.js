// Game flow: menus, level transitions, timer, layout and the main loop.
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const menu = document.getElementById('menu'), card = document.getElementById('menuCard');
const SAVE_KEY = 'azhar-save-v1';
const loadSave = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } };
const writeSave = s => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {} };
const fmtTime = s => { s = Math.max(0, s | 0); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; };

const Game = {
  state: 'menu', level: 0, timeLeft: TOTAL_TIME, maxHp: 3, deadT: 0, sword: false,
  start(level, timeLeft, maxHp) {
    this.level = level; this.timeLeft = timeLeft; this.maxHp = maxHp;
    this.begin();
  },
  begin() {
    loadLevel(this.level); spawnGuards();
    P.maxHp = this.maxHp; resetPlayer(this.level > 0);
    paintLevel(); updateCamera();
    this.state = 'play'; this.deadT = 0; hideMenu();
    showMsg(`${this.level + 1}. ${L.def.name} — ${L.def.intro}`, 5);
    Sfx.level();
    writeSave({ level: this.level, timeLeft: this.timeLeft, maxHp: this.maxHp });
  },
  onDeath() { this.state = 'dying'; this.deadT = 0; },
  levelDone() {
    this.maxHp = P.maxHp;
    if (this.level + 1 >= LEVELS.length) return;
    this.level++; this.state = 'between';
    writeSave({ level: this.level, timeLeft: this.timeLeft, maxHp: this.maxHp });
    showCard(`<div class="eyebrow">Επίπεδο ${this.level} ολοκληρώθηκε</div><h2>${LEVELS[this.level].name}</h2>
      <p>Απομένουν <span class="stat">${fmtTime(this.timeLeft)}</span></p>
      <div class="row"><button class="mbtn" id="bNext">Συνέχεια</button></div>`);
    on('bNext', () => this.begin());
  },
  win() {
    this.state = 'won'; Sfx.win(); writeSave(null);
    setTimeout(() => {
      showCard(`<div class="eyebrow">Το τέλος</div><h1>AZHAR</h1><p class="sub">Η πριγκίπισσα σώθηκε.</p>
        <p>Τα κατάφερες με <span class="stat">${fmtTime(this.timeLeft)}</span> να περισσεύουν.</p>
        <div class="row"><button class="mbtn" id="bAgain">Ξανά από την αρχή</button></div>`);
      on('bAgain', () => this.start(0, TOTAL_TIME, 3));
    }, 2600);
  },
  timeUp() {
    this.state = 'over'; writeSave(null); Sfx.death();
    showCard(`<div class="eyebrow">Ο χρόνος τελείωσε</div><h2>Ο Βεζίρης κέρδισε</h2><p>Η άμμος της κλεψύδρας έπεσε. Δοκίμασε ξανά.</p>
      <div class="row"><button class="mbtn" id="bAgain">Νέο παιχνίδι</button></div>`);
    on('bAgain', () => this.start(0, TOTAL_TIME, 3));
  },
  pause() {
    if (this.state !== 'play' && this.state !== 'dying') return;
    this.prev = this.state; this.state = 'paused'; Input.clear();
    showCard(`<div class="eyebrow">Παύση</div><h2>${L.def.name}</h2><p>Απομένουν <span class="stat">${fmtTime(this.timeLeft)}</span></p>
      <div class="row"><button class="mbtn" id="bRes">Συνέχεια</button><button class="mbtn ghost" id="bRestart">Από την αρχή του επιπέδου</button></div>
      <div class="row"><button class="mbtn ghost" id="bSnd">${Sfx.muted ? 'Ήχος: κλειστός' : 'Ήχος: ανοιχτός'}</button><button class="mbtn ghost" id="bHome">Αρχική</button></div>`);
    on('bRes', () => { hideMenu(); this.state = this.prev; });
    on('bRestart', () => this.begin());
    on('bSnd', () => { Sfx.muted = !Sfx.muted; this.state = this.prev; this.pause(); });
    on('bHome', () => title());
  },
};

function on(id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', e => { e.stopPropagation(); Sfx.init(); fn(); }); }
function showCard(html) { card.innerHTML = html; menu.hidden = false; }
function hideMenu() { menu.hidden = true; }

const HELP = `<div class="help">
  <b>◀ ▶ πάτημα</b><span>Ένα προσεκτικό βήμα. Στην άκρη σταματάς ακριβώς στο χείλος, και πάνω από τα καρφιά περνάς με βήματα χωρίς να πάθεις τίποτα.</span>
  <b>◀ ▶ κράτημα</b><span>Τρέξιμο. Αν το αφήσεις γλιστράς λίγο ως να σταματήσεις, και αν αλλάξεις κατεύθυνση κάνεις στροφή τρέχοντας.</span>
  <b>▲</b><span>Πήδημα. Τρέχοντας: μακρύ άλμα. Κάτω από ένα πεζούλι: πιάσου και σκαρφάλωσε. Κράτα το ▲ όταν πέφτεις για να πιαστείς από άκρη.</span>
  <b>▲ + ◀▶</b><span>Από στάση: άλμα ενός κελιού.</span>
  <b>▼</b><span>Σκύψιμο, και με ▶ μικρά πηδηματάκια σκυφτός. Στην άκρη: κατέβα κρεμασμένος. Κρεμασμένος: άφησε το χέρι.</span>
  <b>⚔</b><span>Πάνω σε φίλτρο ή σπαθί: γονάτισε και πάρ' το. Με το σπαθί: χτύπα. Στη μάχη το ▲ αποκρούει, και τα ◀ ▶ κάνουν βήματα μπρος-πίσω.</span>
  <b>Πτώσεις</b><span>Ένας όροφος είναι ακίνδυνος, δύο πονάνε, τρεις σκοτώνουν.</span>
</div>`;

function title() {
  Game.state = 'menu';
  const s = loadSave();
  showCard(`<div class="eyebrow">Σπαθιά, παγίδες και μια κλεψύδρα</div>
    <h1>AZHAR</h1><p class="sub">Η Φυλακή του Βεζίρη</p>
    <p>Ο Βεζίρης σε έριξε στα μπουντρούμια. Έχεις ${TOTAL_TIME / 60} λεπτά να φτάσεις στην πριγκίπισσα πριν τελειώσει η κλεψύδρα.</p>
    <div class="row">${s ? `<button class="mbtn" id="bCont">Συνέχεια · Επίπεδο ${s.level + 1}</button>` : ''}
      <button class="mbtn ${s ? 'ghost' : ''}" id="bNew">Νέο παιχνίδι</button>
      <button class="mbtn ghost" id="bHelp">Οδηγίες</button></div>
    ${/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.standalone === false && 'serviceWorker' in navigator && location.protocol === 'https:'
      ? '<p class="stat">Για να το έχεις σαν εφαρμογή: Κοινοποίηση ⬆ → «Προσθήκη στην οθόνη Αφετηρίας»</p>' : ''}`);
  on('bNew', () => Game.start(0, TOTAL_TIME, 3));
  if (s) on('bCont', () => Game.start(s.level, s.timeLeft, s.maxHp || 3));
  on('bHelp', () => {
    showCard(`<div class="eyebrow">Οδηγίες</div><h2>Πώς παίζεται</h2>${HELP}<div class="row"><button class="mbtn" id="bBack">Πίσω</button></div>`);
    on('bBack', title);
  });
}

document.getElementById('pause').addEventListener('click', () => { Sfx.init(); if (menu.hidden) Game.pause(); });

// Layout: fit the 640x400 frame. Portrait phones get the frame on top and the thumb pads below it.
function layout() {
  const vw = innerWidth, vh = innerHeight, portrait = vh > vw;
  const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('padding-top')) || 0;
  let w, h, top;
  if (portrait) { w = vw; h = w * CANVAS_H / VIEW_W; top = Math.max(sat + 56, (vh - h) * 0.28); }
  else { h = vh; w = h * VIEW_W / CANVAS_H; if (w > vw) { w = vw; h = w * CANVAS_H / VIEW_W; } top = (vh - h) / 2; }
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.style.left = (vw - w) / 2 + 'px'; cv.style.top = top + 'px';
  const hint = document.getElementById('hint');
  hint.hidden = !portrait; hint.style.top = (top + h + 14) + 'px';
  const b = portrait ? Math.min(84, vw / 4.6) : Math.min(72, vh / 5);
  document.querySelectorAll('.pad').forEach(p => p.style.setProperty('--b', b + 'px'));
  document.querySelectorAll('.btn').forEach(p => p.style.setProperty('--b', b + 'px'));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const newRS = Math.min(3, Math.max(1, (w * dpr) / VIEW_W));
  cv.width = Math.round(VIEW_W * newRS); cv.height = Math.round(CANVAS_H * newRS);
  if (Math.abs(newRS - RS) > 0.01 || !LIGHT) { RS = newRS; if (L) paintLevel(); }
  RS = newRS; setupBuffers(cv);
}
addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 200));

// Main loop with a fixed physics step.
let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (L && (Game.state === 'play' || Game.state === 'dying' || Game.state === 'won')) {
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      if (Game.state === 'play') { Game.timeLeft -= STEP; if (Game.timeLeft <= 0) { Game.timeUp(); break; } }
      updatePlayer(STEP); updateGuards(STEP); updateWorld(STEP);
      Input.endFrame();
    }
    if (Game.state === 'dying') {
      Game.deadT += dt;
      if (Game.deadT > 2.2 && menu.hidden) {
        const why = { spikes: 'Τα καρφιά δεν συγχωρούν.', blades: 'Οι λεπίδες σε πρόλαβαν.', fall: 'Η πτώση ήταν πολύ μεγάλη.', pit: 'Χάθηκες στο σκοτάδι του πηγαδιού.', sword: 'Ο φρουρός ήταν ταχύτερος.', rubble: 'Η πέτρα έπεσε πάνω σου.' }[P.cause] || '';
        showCard(`<div class="eyebrow">Επίπεδο ${Game.level + 1}</div><h2>Έπεσες</h2><p>${why} Απομένουν <span class="stat">${fmtTime(Game.timeLeft)}</span>.</p>
          <div class="row"><button class="mbtn" id="bRetry">Ξαναπροσπάθησε</button></div>`);
        on('bRetry', () => Game.begin());
      }
    }
    Msg.t -= dt;
    updateCamera();
  } else Input.endFrame();
  if (L) drawScene(ctx);
}

// Boot: show the first dungeon behind the title so the page is never empty.
layout();
loadLevel(0); spawnGuards(); P.maxHp = 3; resetPlayer(false); paintLevel(); updateCamera();
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {});
title();
requestAnimationFrame(frame);
window.claude?.hot?.snapshot?.(() => ({ level: Game.level, timeLeft: Game.timeLeft }));

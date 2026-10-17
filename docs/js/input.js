// Held keys plus one-frame "pressed" edges, fed by touch buttons and the keyboard.
const Input = {
  l: false, r: false, u: false, d: false, a: false,
  pu: false, pd: false, pa: false, pl: false, pr: false,
  _touch: new Set(), _keys: new Set(),
  sync() {
    const s = k => this._touch.has(k) || this._keys.has(k);
    for (const k of ['l', 'r', 'u', 'd', 'a']) {
      const v = s(k);
      if (v && !this[k]) this['p' + k] = true;
      this[k] = v;
    }
  },
  endFrame() { this.pu = this.pd = this.pa = this.pl = this.pr = false; },
  clear() { this._touch.clear(); this._keys.clear(); this.sync(); },
};

(() => {
  const keyMap = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u',
    ArrowDown: 'd', KeyS: 'd', ShiftLeft: 'a', ShiftRight: 'a', Space: 'a', KeyJ: 'a', KeyK: 'a' };
  addEventListener('keydown', e => {
    const k = keyMap[e.code]; if (!k) return;
    e.preventDefault(); Sfx.init(); Input._keys.add(k); Input.sync();
  });
  addEventListener('keyup', e => { const k = keyMap[e.code]; if (k) { Input._keys.delete(k); Input.sync(); } });
  addEventListener('blur', () => Input.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Input.clear(); });

  // Each finger maps to whichever button is under it, so a thumb can slide from ◀ to ▶.
  const pointers = new Map();
  const btnAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('[data-k]') : null; };
  const refresh = () => {
    Input._touch.clear();
    document.querySelectorAll('.btn.on').forEach(b => b.classList.remove('on'));
    for (const b of pointers.values()) if (b) { Input._touch.add(b.dataset.k); b.classList.add('on'); }
    Input.sync();
  };
  const onDown = e => {
    const b = btnAt(e.clientX, e.clientY); if (!b) return;
    e.preventDefault(); Sfx.init(); pointers.set(e.pointerId, b); refresh();
  };
  const onMove = e => {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    const b = btnAt(e.clientX, e.clientY);
    // keep the finger's button while it drifts off into empty space
    if (b && b !== pointers.get(e.pointerId)) { pointers.set(e.pointerId, b); refresh(); }
  };
  const onUp = e => { if (pointers.delete(e.pointerId)) refresh(); };
  for (const id of ['padL', 'padR']) {
    const pad = document.getElementById(id);
    pad.addEventListener('pointerdown', onDown);
  }
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
})();

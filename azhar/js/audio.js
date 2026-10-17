// Tiny synthesized sound kit (no files to load).
const Sfx = {
  ctx: null, master: null, noiseBuf: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  ok() { return this.ctx && !this.muted && this.ctx.state === 'running'; },
  tone(f, dur, type = 'sine', vol = 0.2, f2 = null, delay = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, freq = 1200, type = 'lowpass', delay = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; s.playbackRate.value = rand(0.8, 1.2);
    f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  step() { this.noise(0.06, 0.07, 700); },
  land() { this.noise(0.16, 0.28, 400); this.tone(90, 0.12, 'sine', 0.2, 50); },
  thud() { this.noise(0.35, 0.45, 300); this.tone(70, 0.3, 'sine', 0.35, 35); },
  jump() { this.noise(0.08, 0.06, 2000, 'highpass'); },
  swish() { this.noise(0.14, 0.12, 2500, 'bandpass'); },
  clang() { [1320, 1870, 2480].forEach((f, i) => this.tone(f, 0.35 - i * 0.07, 'triangle', 0.12)); this.noise(0.08, 0.18, 4000, 'highpass'); },
  hit() { this.noise(0.12, 0.3, 900); this.tone(180, 0.15, 'sawtooth', 0.12, 90); },
  gate() { this.noise(0.5, 0.12, 250); this.tone(55, 0.5, 'square', 0.04, 45); },
  plate() { this.tone(160, 0.08, 'square', 0.06); this.noise(0.06, 0.12, 900); },
  crumble() { this.noise(0.5, 0.3, 600); },
  potion() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.12, null, i * 0.07)); },
  sword() { [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.1, null, i * 0.09)); },
  blades() { this.tone(2200, 0.06, 'square', 0.04, 900); this.noise(0.05, 0.1, 5000, 'highpass'); },
  spikes() { this.tone(900, 0.05, 'square', 0.05, 2000); },
  death() { [392, 370, 349, 311, 262].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.13, null, i * 0.22)); },
  door() { this.noise(1.2, 0.1, 200); this.tone(65, 1.1, 'sawtooth', 0.04, 80); },
  win() { [392, 494, 587, 784, 587, 784, 988].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.12, null, i * 0.16)); },
  level() { [294, 392, 440, 587].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.1, null, i * 0.14)); },
};

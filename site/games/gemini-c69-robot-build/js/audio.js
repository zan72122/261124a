// Procedural Web Audio Foley & Mechanical Music Engine (Zero external assets)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.unlocked = false;
    this.danceBeatTimer = 0;
    this.danceStep = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.75;

      // Subtle warm room compressor so layered metallic foley never clips
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.14;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      // Shared white/pink-ish noise buffer
      const sr = this.ctx.sampleRate;
      const len = sr * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, sr);
      const data = this.noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.08 * w) / 1.08;
        data[i] = w * 0.65 + last * 1.6;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Crisp machined silver metal clink (mass 0 = small screw, 1 = heavy torso)
  metalClink(mass = 0.5, pitchJitter = 0) {
    if (!this.ctx) return;
    const t = this.now();
    const base = 1650 - mass * 950 + pitchJitter * 180 + (Math.random() - 0.5) * 90;
    const ratios = [1.0, 2.38, 3.91, 5.42];
    ratios.forEach((r, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(base * r, t);
      osc.frequency.exponentialRampToValueAtTime(base * r * 0.985, t + 0.16 + mass * 0.18);
      const amp = (0.16 / (idx + 1)) * (0.7 + mass * 0.45);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(amp, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09 + mass * 0.22 / (idx * 0.6 + 1));
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  // Heavy magnetic socket snap when connecting a robot part
  socketSnap(partIndex = 0) {
    if (!this.ctx) return;
    const t = this.now();
    // Low steel thud
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const f0 = 190 + partIndex * 28;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(62, t + 0.11);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);

    // High precision latch click + harmonic ring
    this.metalClink(0.55, partIndex * 0.4);
  }

  // Ratchet click when tightening a screw (progress 0..1 raises pitch!)
  ratchetTick(progress = 0.5) {
    if (!this.ctx) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1900 + progress * 1700, t);
    bp.Q.value = 7.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.035);

    // Subtle steel thread ping
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900 + progress * 880, t);
    og.gain.setValueAtTime(0.06, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);
    osc.connect(og);
    og.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // Soft cloth/brush buffing swoosh across silver metal
  polishBrush(intensity = 0.5) {
    if (!this.ctx) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2800 + intensity * 1600, t);
    bp.Q.value = 2.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.085, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.1);
  }

  // Cardboard tape tear / flap open
  tapeRip(progress = 0) {
    if (!this.ctx) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(1250 + progress * 1100, t);
    hp.Q.value = 1.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.095);
  }

  // Fabric swish + brass snap for dressing up
  clothEquip(variant = 0) {
    if (!this.ctx) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(750 + variant * 200, t);
    lp.frequency.exponentialRampToValueAtTime(1600, t + 0.14);
    lp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.17, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.2);

    // Warm cheerful two-note brass snap chime
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq * (1 + variant * 0.06), t + 0.05 + i * 0.055);
      og.gain.setValueAtTime(0.0001, t + 0.05 + i * 0.055);
      og.gain.linearRampToValueAtTime(0.1, t + 0.06 + i * 0.055);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.24 + i * 0.055);
      o.connect(og);
      og.connect(this.master);
      o.start(t + 0.05 + i * 0.055);
      o.stop(t + 0.28 + i * 0.055);
    });
  }

  // Cute inquisitive "Huh? / あれ？" marimba-servo inflection -> happy chime
  huhSound() {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(370, t);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.16);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  happySparkle() {
    if (!this.ctx) return;
    const t = this.now();
    const notes = [587.33, 739.99, 880.0, 1174.66];
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      const st = t + i * 0.055;
      o.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.11, st + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.26);
      o.connect(g);
      g.connect(this.master);
      o.start(st);
      o.stop(st + 0.28);
    });
  }

  // Robot power-up servo & harmonic hum
  powerUp() {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + 0.45);
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.45);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.58);
    setTimeout(() => this.happySparkle(), 260);
  }

  // Dad's clumsy tin crash!
  dadClatter() {
    if (!this.ctx) return;
    const t = this.now();
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.metalClink(0.25 + Math.random() * 0.65, (Math.random() - 0.5) * 2);
      }, i * 55);
    }
    // Comedic downward trombone-ish boing
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(310, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(118, t + 0.48);
    g.gain.setValueAtTime(0.22, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t + 0.08);
    osc.stop(t + 0.55);
  }

  // Gentle non-scary mechanical fault beep (playful dizzy robot wobble, not harsh alarm)
  faultPulse() {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(460, t);
    osc.frequency.linearRampToValueAtTime(340, t + 0.14);
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Big tactile emergency button press + repair latch
  bigButtonClick(stage = 0, complete = false) {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + stage * 95, t);
    osc.frequency.exponentialRampToValueAtTime(420 + stage * 130, t + 0.09);
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
    this.metalClink(0.4, stage * 0.5);
    if (complete) {
      setTimeout(() => this.happySparkle(), 100);
    }
  }

  // Wooden block or brass item knock
  woodTap(pitch = 1.0) {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480 * pitch + (Math.random() - 0.5) * 40, t);
    osc.frequency.exponentialRampToValueAtTime(260 * pitch, t + 0.055);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  // Rhythmic mechanical music box + percussion beat during Scene 3 Robot Dance!
  updateDanceMusic(dt, style = 0) {
    if (!this.ctx) return;
    const tempos = [0.28, 0.22, 0.32, 0.24];
    const interval = tempos[style % 4];
    this.danceBeatTimer += dt;
    if (this.danceBeatTimer < interval) return;
    this.danceBeatTimer -= interval;

    const step = this.danceStep++ % 8;
    const t = this.now();

    // Soft brushed kick/snare mechanical rhythm
    if (step % 2 === 0) {
      const k = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      k.type = 'sine';
      k.frequency.setValueAtTime(step % 4 === 0 ? 125 : 190, t);
      k.frequency.exponentialRampToValueAtTime(48, t + 0.09);
      kg.gain.setValueAtTime(0.15, t);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      k.connect(kg);
      kg.connect(this.master);
      k.start(t);
      k.stop(t + 0.12);
    } else {
      // Soft hi-hat tick
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5500;
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.045, t);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      src.connect(hp);
      hp.connect(hg);
      hg.connect(this.master);
      src.start(t);
      src.stop(t + 0.03);
    }

    // Melodic glockenspiel / celesta silver-metal notes per dance style
    const scales = [
      [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 880.0, 783.99],
      [587.33, 783.99, 880.0, 1174.66, 987.77, 880.0, 783.99, 659.25],
      [440.0, 554.37, 659.25, 880.0, 987.77, 880.0, 659.25, 554.37],
      [523.25, 783.99, 1046.5, 1318.5, 1174.66, 1046.5, 880.0, 1046.5],
    ];
    const freq = scales[style % 4][step];
    const m = this.ctx.createOscillator();
    const mg = this.ctx.createGain();
    m.type = style === 1 ? 'triangle' : 'sine';
    m.frequency.setValueAtTime(freq, t);
    mg.gain.setValueAtTime(0.0001, t);
    mg.gain.linearRampToValueAtTime(0.085, t + 0.006);
    mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    m.connect(mg);
    mg.connect(this.master);
    m.start(t);
    m.stop(t + 0.24);
  }
}

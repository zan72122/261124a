// 100% Procedural Web Audio Foley & Wordless Vocalization Engine

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.rubNode = null;
    this.rubGain = null;
    this.rubFilter = null;
    this.ambienceStarted = false;
    this.lastSnapTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._buildNoiseBuffer();
      this._setupContinuousRub();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.ctx && !this.ambienceStarted) {
      this.ambienceStarted = true;
      this._startMorningAmbience();
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, sr);
    const data = this.noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Soft pink-weighted cotton noise
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.16;
    }
  }

  _setupContinuousRub() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.9;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();

    this.rubNode = src;
    this.rubFilter = filter;
    this.rubGain = gain;
  }

  // Continuous linen smoothing friction sound mapped directly to finger drag speed
  setLinenRub(speed01) {
    if (!this.ctx || !this.rubGain) return;
    const now = this.ctx.currentTime;
    const target = Math.min(0.16, Math.max(0, speed01 * 0.15));
    this.rubGain.gain.setTargetAtTime(target, now, 0.035);
    this.rubFilter.frequency.setTargetAtTime(750 + speed01 * 1450, now, 0.04);
  }

  _startMorningAmbience() {
    if (!this.ctx) return;
    // Ultra-gentle sheer curtain morning breeze + occasional soft morning bird chirp outside window
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = this.ctx.createGain();
    g.gain.value = 0.018;
    src.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    src.start();

    const scheduleBird = () => {
      if (this.ctx && this.ctx.state === 'running') {
        const now = this.ctx.currentTime;
        const base = 2200 + Math.random() * 650;
        for (let n = 0; n < 2; n++) {
          const t0 = now + n * 0.13;
          const osc = this.ctx.createOscillator();
          const bg = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(base, t0);
          osc.frequency.exponentialRampToValueAtTime(base * 1.24, t0 + 0.06);
          osc.frequency.exponentialRampToValueAtTime(base * 0.96, t0 + 0.11);
          bg.gain.setValueAtTime(0.0001, t0);
          bg.gain.linearRampToValueAtTime(0.012, t0 + 0.025);
          bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.115);
          osc.connect(bg);
          bg.connect(this.ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.12);
        }
      }
      setTimeout(scheduleBird, 6500 + Math.random() * 7500);
    };
    setTimeout(scheduleBird, 3200);
  }

  // Crisp hotel sheet pull-taut snap ("シュッ…バッ！")
  playSheetSnap(intensity = 0.8) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSnapTime < 0.18) return;
    this.lastSnapTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(600, now);
    bp.frequency.exponentialRampToValueAtTime(2100, now + 0.09);
    bp.Q.value = 1.1;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24 * intensity, now + 0.022);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.21);

    // Low cotton air thump
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now + 0.015);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.13);
    og.gain.setValueAtTime(0.16 * intensity, now + 0.015);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(og);
    og.connect(this.ctx.destination);
    osc.start(now + 0.015);
    osc.stop(now + 0.15);
  }

  // Soft fabric pickup / drape rustle
  playFabricRustle(pitchScale = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1250 * pitchScale;
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.2);
  }

  // Down pillow fluff ("ぽふっ♪")
  playPillowFluff() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, now);
    lp.frequency.exponentialRampToValueAtTime(240, now + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.25, now + 0.035);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.25);
  }

  // Wicker basket / hamper toss landing
  playBasketDrop() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.12);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
    this.playFabricRustle(0.85);
  }

  // Artisanal chocolate gold-foil crinkle & soft placement
  playChocolatePlace() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.028;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3600 + i * 700;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.ctx.destination);
      src.start(t);
      src.stop(t + 0.04);
    }
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    og.gain.setValueAtTime(0.08, now + 0.04);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(og);
    og.connect(this.ctx.destination);
    osc.start(now + 0.04);
    osc.stop(now + 0.13);
  }

  // Brushed-brass hotel bell ("チーン♪")
  playBrassBell() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const partials = [
      { f: 1567.98, a: 0.17, d: 1.9 },
      { f: 3135.96, a: 0.09, d: 1.3 },
      { f: 4285.0, a: 0.055, d: 0.85 },
      { f: 5890.0, a: 0.03, d: 0.5 }
    ];
    partials.forEach((p) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.f, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(p.a, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0004, now + p.d);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + p.d + 0.05);
    });
  }

  // Soft wooden knock / tap for wooden furniture & signboard
  playWoodTap(pitch = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(165 * pitch, now + 0.065);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Dress-up sparkle / uniform snap-on warm chord
  playDressEquip(stepIndex = 0) {
    this.unlock();
    if (!this.ctx) return;
    this.playFabricRustle(1.15);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const base = notes[stepIndex % notes.length];
    const now = this.ctx.currentTime;
    [base, base * 1.25].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      g.gain.setValueAtTime(0.001, now + idx * 0.06);
      g.gain.linearRampToValueAtTime(0.09, now + idx * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.06 + 0.42);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.45);
    });
  }

  // Wordless Character Reactions:
  // 'huh' ("あれ？" rising puzzled inflection), 'delight' (warm happy chuckle/chord), 'blunder' (comedic Papa/Mama stumble), 'munch' (eating chocolate)
  playVoiceReaction(kind = 'delight', isLowVoice = false) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const voiceScale = isLowVoice ? 0.62 : 1.05;

    if (kind === 'huh') {
      // Gentle rising "Hm~?" formant inflection
      const osc = this.ctx.createOscillator();
      const bp = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220 * voiceScale, now);
      osc.frequency.exponentialRampToValueAtTime(340 * voiceScale, now + 0.24);
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(650, now);
      bp.frequency.linearRampToValueAtTime(1150, now + 0.24);
      bp.Q.value = 3.2;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(bp);
      bp.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (kind === 'blunder') {
      // Comedic soft stumble: two quick wood/slipper steps + downward "wah-oops" slide
      this.playWoodTap(0.85);
      setTimeout(() => this.playWoodTap(1.15), 95);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(310 * voiceScale, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(155 * voiceScale, now + 0.45);
      g.gain.setValueAtTime(0.14, now + 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + 0.14);
      osc.stop(now + 0.5);
    } else if (kind === 'munch') {
      // Happy chocolate bite + warm "Mmm~!"
      this.playChocolatePlace();
      const osc = this.ctx.createOscillator();
      const lp = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(290 * voiceScale, now + 0.14);
      osc.frequency.linearRampToValueAtTime(355 * voiceScale, now + 0.32);
      osc.frequency.linearRampToValueAtTime(315 * voiceScale, now + 0.52);
      lp.type = 'lowpass';
      lp.frequency.value = 950;
      g.gain.setValueAtTime(0.001, now + 0.14);
      g.gain.linearRampToValueAtTime(0.11, now + 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + 0.14);
      osc.stop(now + 0.58);
    } else {
      // 'delight': warm buoyant 3-note marimba/breath chime
      const chord = [523.25, 659.25, 783.99, 987.77];
      chord.forEach((f, idx) => {
        const t = now + idx * 0.065;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * (isLowVoice ? 0.75 : 1.0), t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.085, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.48);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    }
  }
}

export const sound = new SoundEngine();

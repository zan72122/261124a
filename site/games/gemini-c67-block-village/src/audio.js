// Procedural Web Audio Foley & Acoustic Sound Engine (Zero external assets)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.lastImpactTime = 0;
    this.lastHoldTime = 0;
    this.ambientGain = null;
    this.nightCricketTimer = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.75;

      // Subtle warm room compressor so overlapping physics clatters never clip
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.15;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 1.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 1.4));
    }
    this.noiseBuf = buf;
  }

  _noiseBurst(duration, filterType, freq, q, gainVal, delay = 0) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.85 + Math.random() * 0.35;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 0.5, duration + 0.02);
  }

  _tone(type, fStart, fEnd, duration, gainVal, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, t);
    if (fEnd !== fStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + duration);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  playOutfitWear(outfitIndex = 0) {
    this.unlock();
    if (!this.ctx) return;
    // Crisp woven cloth rustle + warm brass snap + cheerful wooden marimba triad
    this._noiseBurst(0.22, 'bandpass', 1100 + outfitIndex * 180, 1.4, 0.28, 0);
    this._noiseBurst(0.14, 'highpass', 2600, 0.9, 0.14, 0.08);
    const roots = [392.0, 440.0, 349.23];
    const base = roots[outfitIndex % 3];
    [1, 1.25, 1.5, 2.0].forEach((mul, idx) => {
      this._tone('triangle', base * mul, base * mul * 1.004, 0.28, 0.16, 0.06 + idx * 0.055);
    });
  }

  playPickup(type = 'wood') {
    this.unlock();
    if (!this.ctx) return;
    if (type === 'stone') {
      this._noiseBurst(0.07, 'bandpass', 1800, 2.2, 0.16);
      this._tone('sine', 220, 310, 0.08, 0.12);
    } else if (type === 'earth' || type === 'seed') {
      this._noiseBurst(0.09, 'lowpass', 700, 1.0, 0.20);
      this._tone('sine', 160, 230, 0.09, 0.10);
    } else if (type === 'grass') {
      this._noiseBurst(0.11, 'bandpass', 2400, 1.2, 0.18);
      this._tone('triangle', 260, 360, 0.08, 0.10);
    } else {
      this._tone('triangle', 290, 420, 0.08, 0.15);
      this._noiseBurst(0.05, 'bandpass', 1400, 2.0, 0.12);
    }
  }

  playBlockPlace(type = 'wood', heightLevel = 0, bonusPitch = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const hMul = Math.pow(1.045, Math.min(8, Math.max(0, heightLevel))) * bonusPitch;
    if (type === 'earth') {
      // Damp rich loam thump + fine soil crumble
      this._tone('sine', 125 * hMul, 58, 0.16, 0.34);
      this._noiseBurst(0.16, 'lowpass', 620, 0.9, 0.30);
      this._noiseBurst(0.11, 'bandpass', 1500, 1.4, 0.12, 0.03);
    } else if (type === 'grass') {
      // Sod thump + crisp meadow blade rustle
      this._tone('sine', 140 * hMul, 68, 0.14, 0.28);
      this._noiseBurst(0.18, 'bandpass', 2800, 1.1, 0.24);
      this._noiseBurst(0.12, 'lowpass', 750, 0.8, 0.18);
    } else if (type === 'wood') {
      // Resonant hollow cedar timber tok-clack
      this._tone('triangle', 265 * hMul, 195 * hMul, 0.13, 0.28);
      this._tone('sine', 540 * hMul, 480 * hMul, 0.075, 0.16);
      this._noiseBurst(0.055, 'bandpass', 1650, 2.8, 0.22);
    } else if (type === 'stone') {
      // Heavy quarried stone clink + deep mineral thud
      this._tone('sine', 110 * hMul, 48, 0.18, 0.36);
      this._tone('triangle', 980 * hMul, 790 * hMul, 0.05, 0.14);
      this._noiseBurst(0.09, 'bandpass', 2350, 2.5, 0.26);
    } else if (type === 'lantern') {
      // Warm cedar + frosted glass chime
      this._tone('triangle', 320 * hMul, 315 * hMul, 0.15, 0.2);
      this._tone('sine', 880 * hMul, 884 * hMul, 0.32, 0.16, 0.02);
      this._tone('sine', 1320 * hMul, 1325 * hMul, 0.28, 0.10, 0.05);
    } else if (type === 'seed') {
      // Gentle soil tuck + sproutplink
      this._noiseBurst(0.10, 'bandpass', 1300, 1.3, 0.18);
      this._tone('sine', 420 * hMul, 580 * hMul, 0.11, 0.16, 0.02);
    }
  }

  playHoldTick(progress = 0.5, mode = 'sculpt') {
    this.unlock();
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastHoldTime < 115) return;
    this.lastHoldTime = now;

    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const idx = Math.min(scale.length - 1, Math.floor(progress * scale.length));
    const f = scale[idx] * (mode === 'grow' ? 1.25 : 1.0);
    this._tone('sine', f, f * 1.03, 0.12, 0.12);
    if (mode === 'grow') {
      // Water droplet + leaf rustle
      this._tone('sine', f * 1.5, f * 2.1, 0.07, 0.07, 0.02);
      this._noiseBurst(0.07, 'bandpass', 2900, 1.5, 0.08);
    } else {
      this._noiseBurst(0.05, 'bandpass', 1800, 2.2, 0.09);
    }
  }

  playCropRipe() {
    this.unlock();
    if (!this.ctx) return;
    // Plump juicy pop + bright sparkle triad
    this._tone('sine', 320, 680, 0.11, 0.22);
    this._tone('triangle', 523.25, 525, 0.22, 0.14, 0.05);
    this._tone('triangle', 659.25, 662, 0.24, 0.14, 0.10);
    this._tone('sine', 783.99, 788, 0.28, 0.12, 0.15);
  }

  playAnimal(kind = 'sheep', excited = false) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'sheep') {
      // Warm natural vibrato bleat ("meeeh")
      const osc = this.ctx.createOscillator();
      const vib = this.ctx.createOscillator();
      const vibGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const baseF = excited ? 315 : 265 + Math.random() * 25;
      osc.frequency.setValueAtTime(baseF, t);
      osc.frequency.linearRampToValueAtTime(baseF * 0.92, t + 0.34);

      vib.frequency.value = 11.5;
      vibGain.gain.value = 12;
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);

      const f1 = this.ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 720;
      f1.Q.value = 3.2;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);

      osc.connect(f1);
      f1.connect(g);
      g.connect(this.master);
      osc.start(t);
      vib.start(t);
      osc.stop(t + 0.38);
      vib.stop(t + 0.38);
    } else {
      // Cute acoustic hen cluck ("kok-kok!")
      const count = excited ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const d = i * 0.095;
        const f = (excited ? 680 : 560) + i * 55 + Math.random() * 35;
        this._tone('triangle', f, f * 0.68, 0.065, 0.16, d);
        this._tone('sine', f * 1.9, f * 1.3, 0.045, 0.08, d);
      }
    }
  }

  playHuhThenHappy() {
    this.unlock();
    if (!this.ctx) return;
    // "あれ？" quizzical upward bend -> 0.55s pause -> delighted warm giggle chime!
    this._tone('triangle', 310, 445, 0.19, 0.20, 0.0);
    this._tone('sine', 620, 890, 0.16, 0.09, 0.02);

    // Happy realization!
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, idx) => {
      this._tone('triangle', n, n * 1.01, 0.22, 0.15, 0.52 + idx * 0.065);
    });
  }

  playTowerCreak(step = 0) {
    this.unlock();
    if (!this.ctx) return;
    const f = 145 + step * 22;
    this._tone('sawtooth', f, f * 0.84, 0.18, 0.07);
    this._noiseBurst(0.12, 'bandpass', 950 + step * 120, 4.0, 0.10);
  }

  playTowerUhOh() {
    this.unlock();
    if (!this.ctx) return;
    // Surprised two-note gasp before collapse
    this._tone('triangle', 520, 480, 0.12, 0.20, 0);
    this._tone('triangle', 440, 290, 0.24, 0.22, 0.13);
  }

  playPhysicsImpact(type = 'stone', speed = 2.0) {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastImpactTime < 28) return;
    const strength = Math.min(1.0, Math.max(0.06, (speed - 0.5) / 6.5));
    if (strength <= 0.07) return;
    this.lastImpactTime = now;

    if (type === 'stone') {
      this._tone('sine', 95 + Math.random() * 35, 45, 0.13, 0.26 * strength);
      this._noiseBurst(0.085, 'bandpass', 2100 + Math.random() * 500, 2.4, 0.24 * strength);
    } else {
      this._tone('triangle', 220 + Math.random() * 60, 165, 0.11, 0.24 * strength);
      this._noiseBurst(0.065, 'bandpass', 1450 + Math.random() * 350, 2.2, 0.18 * strength);
    }
  }

  playLanternLight(idx = 0) {
    this.unlock();
    if (!this.ctx) return;
    const pent = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99];
    const f = pent[idx % pent.length];
    this._noiseBurst(0.06, 'highpass', 3200, 1.0, 0.08);
    this._tone('sine', f, f * 1.003, 0.55, 0.14);
    this._tone('triangle', f * 2, f * 2.004, 0.35, 0.06, 0.02);
  }

  playGoalChime(stage = 1) {
    this.unlock();
    if (!this.ctx) return;
    const chords = {
      1: [261.63, 329.63, 392.0, 523.25, 659.25],
      2: [293.66, 369.99, 440.0, 587.33, 739.99],
      3: [220.0, 277.18, 329.63, 440.0, 554.37, 659.25],
    };
    const notes = chords[stage] || chords[1];
    notes.forEach((f, i) => {
      this._tone('triangle', f, f * 1.002, 0.65, 0.14, i * 0.08);
      this._tone('sine', f * 2, f * 2, 0.45, 0.05, i * 0.08 + 0.015);
    });
  }

  updateNightAmbience(dt, nightFactor) {
    if (!this.ctx || nightFactor < 0.45) return;
    this.nightCricketTimer -= dt;
    if (this.nightCricketTimer <= 0) {
      this.nightCricketTimer = 2.6 + Math.random() * 3.8;
      // Very gentle warm summer-evening cricket chirp (quiet & cozy)
      const f = 3850 + Math.random() * 220;
      for (let i = 0; i < 3; i++) {
        this._tone('sine', f, f * 0.98, 0.032, 0.018 * nightFactor, i * 0.052);
      }
    }
  }
}

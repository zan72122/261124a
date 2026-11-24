// Procedural Web Audio API Foley & Environmental Sound Engine (Zero speech/words)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambientStarted = false;
    this.engineGain = null;
    this.engineOsc = null;
    this.hydraulicNode = null;
    this.noiseBuffer = null;
    this.birdTimer = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.75;
      this.master.connect(this.ctx.destination);
      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.ambientStarted) {
      this._startAmbient();
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2.0;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  _startAmbient() {
    this.ambientStarted = true;
    const t = this.ctx.currentTime;

    // Subtle warm diesel truck idle rumble
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.value = 39;
    osc2.frequency.value = 78.5;

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 6.2;
    lfoGain.gain.value = 1.4;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 135;
    filter.Q.value = 2.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.055, t + 1.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc1.start(t);
    osc2.start(t);
    lfo.start(t);

    this.engineGain = gain;
    this.engineOsc = osc1;
  }

  updateAmbient(dt, sceneIndex) {
    if (!this.ctx || !this.ambientStarted) return;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = sceneIndex === 3 ? 2.4 + Math.random() * 3.2 : 4.2 + Math.random() * 5.0;
      this._playMorningSparrow(sceneIndex === 3 ? 0.08 : 0.045);
    }
    if (this.engineGain) {
      const target = sceneIndex === 2 ? 0.085 : sceneIndex === 3 ? 0.025 : 0.05;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
    }
  }

  _playMorningSparrow(vol = 0.05) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < notes; i++) {
      const t0 = now + i * (0.09 + Math.random() * 0.05);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const base = 2600 + Math.random() * 900;
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.exponentialRampToValueAtTime(base * 1.28, t0 + 0.035);
      osc.frequency.exponentialRampToValueAtTime(base * 0.92, t0 + 0.075);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.09);
    }
  }

  _noiseBurst(duration, filterType, freq, q, gainVal, delay = 0) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.85 + Math.random() * 0.35;
    const offset = Math.random() * 1.1;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal, t + Math.min(0.018, duration * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t, offset, duration + 0.02);
  }

  playSoftTap() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(170, t + 0.055);
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  playEquipCloth(isCap = true) {
    this.unlock();
    if (!this.ctx) return;
    this._noiseBurst(0.16, 'bandpass', isCap ? 1400 : 950, 1.4, 0.22, 0);
    this._noiseBurst(0.09, 'highpass', 2600, 1.8, 0.14, 0.06);

    const t = this.ctx.currentTime + 0.07;
    const notes = isCap ? [523.25, 659.25, 783.99] : [587.33, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.055);
      g.gain.setValueAtTime(0.001, t + idx * 0.055);
      g.gain.linearRampToValueAtTime(0.16, t + idx * 0.055 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + idx * 0.055 + 0.24);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + idx * 0.055);
      osc.stop(t + idx * 0.055 + 0.26);
    });
  }

  playDressComplete() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const st = t + i * 0.065;
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.18, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, st + 0.48);
      osc.connect(g);
      g.connect(this.master);
      osc.start(st);
      osc.stop(st + 0.5);
    });
  }

  playBagCrinkle(intensity = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const count = 3 + Math.floor(intensity * 3);
    for (let i = 0; i < count; i++) {
      this._noiseBurst(
        0.04 + Math.random() * 0.05,
        'bandpass',
        2800 + Math.random() * 3400,
        2.8,
        (0.12 + Math.random() * 0.12) * Math.min(1.4, intensity),
        i * 0.028
      );
    }
  }

  playItemGrab(category) {
    this.unlock();
    if (!this.ctx) return;
    if (category === 'bottle') {
      this._playModalRing([1480, 2210, 3120], 0.18, 0.14);
    } else if (category === 'can') {
      this._playModalRing([690, 1140, 1890], 0.12, 0.15, 'triangle');
      this._noiseBurst(0.04, 'bandpass', 3200, 3.0, 0.08);
    } else if (category === 'paper') {
      this._noiseBurst(0.11, 'bandpass', 2100, 1.8, 0.18);
    } else {
      // organic
      this._noiseBurst(0.09, 'lowpass', 650, 1.2, 0.22);
    }
  }

  playItemDrop(category, matched = true) {
    this.unlock();
    if (!this.ctx) return;
    if (category === 'bottle') {
      this._playModalRing([1280, 1920, 2780], 0.28, 0.2);
      this._playModalRing([1520, 2290], 0.2, 0.12, 'sine', 0.06);
    } else if (category === 'can') {
      this._playModalRing([580, 960, 1620, 2410], 0.18, 0.18, 'triangle');
      this._playModalRing([640, 1080], 0.14, 0.11, 'triangle', 0.055);
    } else if (category === 'paper') {
      this._noiseBurst(0.14, 'bandpass', 1750, 1.5, 0.22);
      this._noiseBurst(0.08, 'highpass', 3100, 2.0, 0.1, 0.04);
    } else {
      this._noiseBurst(0.12, 'lowpass', 520, 1.6, 0.26);
    }

    if (matched) {
      const t = this.ctx.currentTime + 0.04;
      [659.25, 880].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t + idx * 0.055);
        g.gain.setValueAtTime(0.001, t + idx * 0.055);
        g.gain.linearRampToValueAtTime(0.13, t + idx * 0.055 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.055 + 0.22);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t + idx * 0.055);
        osc.stop(t + idx * 0.055 + 0.24);
      });
    }
  }

  playHuhThenHappy() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Gentle curious "Huh? / あれ？" two-tone rising inflection
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(392, t);
    osc.frequency.exponentialRampToValueAtTime(540, t + 0.19);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);

    // Warm, forgiving happy chime right after (~0.52s)
    const t2 = t + 0.52;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      o2.type = 'triangle';
      const st = t2 + i * 0.055;
      o2.frequency.setValueAtTime(f, st);
      g2.gain.setValueAtTime(0.001, st);
      g2.gain.linearRampToValueAtTime(0.15, st + 0.015);
      g2.gain.exponentialRampToValueAtTime(0.001, st + 0.32);
      o2.connect(g2);
      g2.connect(this.master);
      o2.start(st);
      o2.stop(st + 0.34);
    });
  }

  _playModalRing(freqs, dur, vol, type = 'sine', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f * (0.97 + Math.random() * 0.06), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol / (idx + 1), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + idx * 0.25));
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  }

  playHopperToss() {
    this.unlock();
    if (!this.ctx) return;
    // Heavy metallic hopper clang + bag rustle
    this._playModalRing([210, 385, 620, 1140], 0.32, 0.22, 'triangle');
    this._noiseBurst(0.15, 'bandpass', 1600, 1.4, 0.2, 0.02);
  }

  playLeverGrab() {
    this.unlock();
    if (!this.ctx) return;
    this._playModalRing([180, 420, 890], 0.14, 0.24, 'sawtooth');
  }

  playCrunchStep(intensity = 0.7) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Hydraulic low groan + crunching cans/cartons/plastic
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92 + intensity * 48, t);
    osc.frequency.linearRampToValueAtTime(74 + intensity * 30, t + 0.16);

    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 340;

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16 * intensity, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.19);

    this._noiseBurst(0.11, 'bandpass', 1400 + Math.random() * 1800, 1.9, 0.22 * intensity);
    if (Math.random() < 0.55) {
      this._playModalRing([510 + Math.random() * 300, 1120], 0.09, 0.12 * intensity, 'triangle', 0.02);
    }
  }

  playHydraulicRelease() {
    this.unlock();
    if (!this.ctx) return;
    // Pneumatic hiss + heavy latch clunk
    this._noiseBurst(0.32, 'highpass', 3400, 1.2, 0.18);
    this._playModalRing([145, 290, 540], 0.22, 0.2, 'triangle', 0.04);
  }

  playDadSlipAndScatter() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Comic boot slip pitch bend
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.16);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.38);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.44);

    // Puddle splash + bum thud
    this._noiseBurst(0.26, 'bandpass', 1200, 1.1, 0.26, 0.22);
    this._playModalRing([95, 145], 0.25, 0.28, 'sine', 0.24);

    // Fluttering paper burst in the morning breeze
    for (let i = 0; i < 7; i++) {
      this._noiseBurst(0.09, 'bandpass', 2300 + i * 220, 2.0, 0.15, 0.26 + i * 0.06);
    }
  }

  playPaperCatch(midAir = false) {
    this.unlock();
    if (!this.ctx) return;
    this._noiseBurst(0.09, 'bandpass', 2500, 1.8, 0.18);
    const freq = midAir ? 987.77 : 783.99;
    this._playModalRing([freq, freq * 1.5], 0.22, midAir ? 0.18 : 0.12, 'sine', 0.01);
  }

  playWaterSpray() {
    this.unlock();
    if (!this.ctx) return;
    this._noiseBurst(0.14, 'bandpass', 3600, 0.9, 0.12);
  }

  playBloom(pitchScale = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const base = pentatonic[Math.floor(Math.random() * pentatonic.length)] * pitchScale;
    this._playModalRing([base, base * 1.5, base * 2], 0.42, 0.15, 'sine');
  }

  playPinwheelSpin(speed = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const notes = [659.25, 783.99, 987.77, 1174.66, 1318.5];
    const n = notes[Math.floor(Math.random() * notes.length)];
    this._playModalRing([n, n * 2.01], 0.35, Math.min(0.2, 0.08 + speed * 0.08), 'triangle');
  }

  playTruckHorn() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Friendly warm dual-tone truck horn ("Paa-poo!")
    [293.66, 369.99].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const flt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      flt.type = 'lowpass';
      flt.frequency.value = 1150;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.13, t + 0.025);
      g.gain.setValueAtTime(0.12, t + 0.16);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(flt);
      flt.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playSceneCelebration() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, idx) => {
      const st = t + idx * 0.085;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.17, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, st + 0.65);
      osc.connect(g);
      g.connect(this.master);
      osc.start(st);
      osc.stop(st + 0.68);
    });
  }
}

// Procedural Web Audio Engine: Realistic Airliner Cabin Ambient + Tactile Foley + Wordless Expressions

export class CabinAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.master = null;
    this.ambientGain = null;
    this.pourNodes = null;
    this.lastWipeTime = 0;
    this.lastRollTime = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    this._createNoiseBuffer();
    this._startCabinAmbience();
    this.unlocked = true;
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 3;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Smooth pink-ish noise for realistic cabin airflow & liquid streams
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buf;
  }

  _startCabinAmbience() {
    const t = this.ctx.currentTime;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.001, t);
    this.ambientGain.gain.exponentialRampToValueAtTime(0.22, t + 1.4);
    this.ambientGain.connect(this.master);

    // Pressurized air conditioning airflow (warm filtered noise)
    const airSrc = this.ctx.createBufferSource();
    airSrc.buffer = this.noiseBuffer;
    airSrc.loop = true;

    const airLP = this.ctx.createBiquadFilter();
    airLP.type = 'lowpass';
    airLP.frequency.value = 360;
    airLP.Q.value = 0.6;

    const airHP = this.ctx.createBiquadFilter();
    airHP.type = 'highpass';
    airHP.frequency.value = 55;

    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.45;
    airSrc.connect(airHP).connect(airLP).connect(airGain).connect(this.ambientGain);
    airSrc.start(t);

    // Subtle twin-engine high-bypass turbofan hum (82Hz + 82.6Hz gentle acoustic warmth + 164Hz harmonic)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'triangle';
    osc1.frequency.value = 78.0;
    osc2.frequency.value = 78.45;
    osc3.frequency.value = 156.2;

    const humLP = this.ctx.createBiquadFilter();
    humLP.type = 'lowpass';
    humLP.frequency.value = 210;

    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.075;
    osc1.connect(humLP);
    osc2.connect(humLP);
    const g3 = this.ctx.createGain();
    g3.gain.value = 0.25;
    osc3.connect(g3).connect(humLP);
    humLP.connect(humGain).connect(this.ambientGain);

    osc1.start(t);
    osc2.start(t);
    osc3.start(t);
    this.engineOscs = [osc1, osc2, osc3];
  }

  // Authentic two-tone aircraft cabin chime (Hi-Lo C#5 -> A4 warm tubular bell)
  playCabinChime() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [
      { freq: 587.33, delay: 0.0, dur: 1.1 }, // D5
      { freq: 466.16, delay: 0.42, dur: 1.45 } // Bb4
    ];
    for (const n of notes) {
      const osc = this.ctx.createOscillator();
      const over = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      over.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, t + n.delay);
      over.frequency.setValueAtTime(n.freq * 2.99, t + n.delay);

      const overGain = this.ctx.createGain();
      overGain.gain.setValueAtTime(0.08, t + n.delay);
      overGain.gain.exponentialRampToValueAtTime(0.001, t + n.delay + 0.28);

      gain.gain.setValueAtTime(0.0001, t + n.delay);
      gain.gain.linearRampToValueAtTime(0.20, t + n.delay + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.delay + n.dur);

      osc.connect(gain);
      over.connect(overGain).connect(gain);
      gain.connect(this.master);

      osc.start(t + n.delay);
      over.start(t + n.delay);
      osc.stop(t + n.delay + n.dur + 0.05);
      over.stop(t + n.delay + n.dur + 0.05);
    }
  }

  playFabricPutOn(pitchMul = 1.0) {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Soft silk/wool rustle
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900 * pitchMul, t);
    bp.frequency.exponentialRampToValueAtTime(1700 * pitchMul, t + 0.18);
    bp.Q.value = 1.5;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.26);

    // Bright happy sparkle note
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25 * pitchMul, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(783.99 * pitchMul, t + 0.22);
    og.gain.setValueAtTime(0.001, t + 0.05);
    og.gain.linearRampToValueAtTime(0.14, t + 0.08);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    osc.connect(og).connect(this.master);
    osc.start(t + 0.05);
    osc.stop(t + 0.38);
  }

  playCartRoll(speed = 0.5) {
    this.init();
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastRollTime < 70) return;
    this.lastRollTime = now;

    const t = this.ctx.currentTime;
    const amp = Math.min(0.22, 0.04 + speed * 0.16);

    // Heavy rubber wheel rumble + subtle metal tray rattle
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 140 + speed * 120;
    lp.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.13);

    if (Math.random() < 0.38) {
      // Gentle glassware/metal clink on cart
      const clink = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      clink.type = 'sine';
      clink.frequency.value = 2150 + Math.random() * 650;
      cg.gain.setValueAtTime(amp * 0.18, t);
      cg.gain.exponentialRampToValueAtTime(0.0005, t + 0.07);
      clink.connect(cg).connect(this.master);
      clink.start(t);
      clink.stop(t + 0.08);
    }
  }

  startPouring(isHot = false) {
    this.init();
    if (!this.ctx || this.pourNodes) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isHot ? 620 : 520, t);
    bp.Q.value = 3.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.06);

    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    this.pourNodes = { src, bp, g, isHot, nextBubble: t + 0.05 };
  }

  updatePouring(fillRatio = 0.5) {
    if (!this.ctx || !this.pourNodes) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1.25, fillRatio));
    // Resonant cavity pitch rises naturally as cup fills up!
    const targetFreq = (this.pourNodes.isHot ? 560 : 460) + clamped * 680;
    this.pourNodes.bp.frequency.setTargetAtTime(targetFreq, t, 0.04);

    if (t >= this.pourNodes.nextBubble) {
      this.pourNodes.nextBubble = t + 0.055 + Math.random() * 0.045;
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'sine';
      const baseF = 380 + clamped * 540 + (Math.random() - 0.5) * 90;
      bOsc.frequency.setValueAtTime(baseF, t);
      bOsc.frequency.exponentialRampToValueAtTime(baseF * 1.38, t + 0.045);
      bGain.gain.setValueAtTime(clamped > 1.0 ? 0.085 : 0.048, t);
      bGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
      bOsc.connect(bGain).connect(this.master);
      bOsc.start(t);
      bOsc.stop(t + 0.055);
    }
  }

  stopPouring() {
    if (!this.ctx || !this.pourNodes) return;
    const t = this.ctx.currentTime;
    const nodes = this.pourNodes;
    this.pourNodes = null;
    try {
      nodes.g.gain.setTargetAtTime(0.0001, t, 0.03);
      nodes.src.stop(t + 0.12);
    } catch (_) {}
  }

  playIceClink() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [2480, 3320].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f + Math.random() * 180, t + idx * 0.045);
      g.gain.setValueAtTime(0.11, t + idx * 0.045);
      g.gain.exponentialRampToValueAtTime(0.0008, t + idx * 0.045 + 0.09);
      osc.connect(g).connect(this.master);
      osc.start(t + idx * 0.045);
      osc.stop(t + idx * 0.045 + 0.1);
    });
  }

  playPlasticPlace(pitch = 1.0) {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(140 * pitch, t + 0.065);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playFoilPeel() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2400, t);
    hp.frequency.linearRampToValueAtTime(4200, t + 0.18);
    hp.Q.value = 1.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.22);
  }

  playWarmerSizzle() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.13);
  }

  // Wordless reaction tones ("Huh?" quizzical upward inflection vs "Delighted!" warm chord)
  playReactionHuh() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(510, t + 0.22);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  playReactionHappy(intensity = 1.0) {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.055);
      g.gain.setValueAtTime(0.001, t + i * 0.055);
      g.gain.linearRampToValueAtTime(0.11 * intensity, t + i * 0.055 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.42);
      osc.connect(g).connect(this.master);
      osc.start(t + i * 0.055);
      osc.stop(t + i * 0.055 + 0.45);
    });
  }

  playSpillOops() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Cup knock + liquid splash
    this.playPlasticPlace(0.8);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1100, t + 0.05);
    bp.frequency.exponentialRampToValueAtTime(480, t + 0.38);
    bp.Q.value = 1.2;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.32, t + 0.05);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    src.connect(bp).connect(sg).connect(this.master);
    src.start(t + 0.05);
    src.stop(t + 0.44);

    // Dad's comical surprised "Oh-oh!" downward two-note inflection
    [290, 215].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * 1.12, t + 0.1 + idx * 0.16);
      osc.frequency.exponentialRampToValueAtTime(f * 0.86, t + 0.23 + idx * 0.16);
      g.gain.setValueAtTime(0.15, t + 0.1 + idx * 0.16);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + idx * 0.16);
      osc.connect(g).connect(this.master);
      osc.start(t + 0.1 + idx * 0.16);
      osc.stop(t + 0.27 + idx * 0.16);
    });
  }

  playWipeScrub(speed = 0.6) {
    this.init();
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastWipeTime < 65) return;
    this.lastWipeTime = now;

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1350 + speed * 700, t);
    bp.Q.value = 2.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.22, 0.07 + speed * 0.12), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.1);
  }

  playCozySleepChime() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392.0, 493.88, 587.33].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.001, t + idx * 0.12);
      g.gain.linearRampToValueAtTime(0.075, t + idx * 0.12 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0008, t + idx * 0.12 + 0.85);
      osc.connect(g).connect(this.master);
      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + 0.9);
    });
  }

  playTouchdownAndApplause() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Gentle landing gear tire thump + reverse thrust whoosh
    const thump = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(92, t);
    thump.frequency.exponentialRampToValueAtTime(34, t + 0.35);
    tg.gain.setValueAtTime(0.32, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    thump.connect(tg).connect(this.master);
    thump.start(t);
    thump.stop(t + 0.42);

    // Cabin chime right after touchdown
    setTimeout(() => this.playCabinChime(), 360);

    // Warm multi-passenger handclaps!
    for (let i = 0; i < 28; i++) {
      const delay = 0.55 + i * 0.085 + (Math.random() - 0.5) * 0.04;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1050 + Math.random() * 650;
      bp.Q.value = 1.9;
      const cg = this.ctx.createGain();
      const envPeak = 0.14 * (1.0 - i / 36);
      cg.gain.setValueAtTime(0.001, t + delay);
      cg.gain.linearRampToValueAtTime(Math.max(0.02, envPeak), t + delay + 0.008);
      cg.gain.exponentialRampToValueAtTime(0.0008, t + delay + 0.075);
      src.connect(bp).connect(cg).connect(this.master);
      src.start(t + delay);
      src.stop(t + delay + 0.085);
    }
  }
}

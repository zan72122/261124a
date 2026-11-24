// Procedural Web Audio API sound engine — tactile liquid, glass, fruit, blender, expressions

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.blenderNodes = null;
    this.pourNodes = null;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
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

  playFabricRustle() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(1900, t + 0.16);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.32);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.36);

    // Warm dress-up sparkle chime
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const og = this.ctx.createGain();
      const st = t + 0.06 + idx * 0.055;
      og.gain.setValueAtTime(0.001, st);
      og.gain.linearRampToValueAtTime(0.11, st + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0008, st + 0.42);
      osc.connect(og).connect(this.master);
      osc.start(st);
      osc.stop(st + 0.45);
    });
  }

  playPickSoft(pitchScale = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320 * pitchScale, t);
    osc.frequency.exponentialRampToValueAtTime(580 * pitchScale, t + 0.065);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playFruitPlop(liquidFill = 0.2, mass = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Bubble cavity upward chirp ("plop!")
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const base = (240 + liquidFill * 140) / Math.max(0.7, mass);
    osc.frequency.setValueAtTime(base * 0.72, t);
    osc.frequency.exponentialRampToValueAtTime(base * 2.15, t + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);

    // Wet splash burst
    const ns = this.ctx.createBufferSource();
    ns.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 2.0;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.16, t + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    ns.connect(bp).connect(ng).connect(this.master);
    ns.start(t);
    ns.stop(t + 0.15);
  }

  playWoodTap() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(125, t + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  startBlender() {
    this.unlock();
    if (!this.ctx || this.blenderNodes) return;
    const t = this.ctx.currentTime;
    const motor = this.ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(95, t);

    const sub = this.ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(190, t);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, t);
    lp.Q.value = 2.5;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const foamFilter = this.ctx.createBiquadFilter();
    foamFilter.type = 'bandpass';
    foamFilter.frequency.setValueAtTime(950, t);
    foamFilter.Q.value = 1.2;

    const motorGain = this.ctx.createGain();
    motorGain.gain.setValueAtTime(0.001, t);
    motorGain.gain.linearRampToValueAtTime(0.11, t + 0.08);

    const foamGain = this.ctx.createGain();
    foamGain.gain.setValueAtTime(0.001, t);
    foamGain.gain.linearRampToValueAtTime(0.12, t + 0.1);

    motor.connect(lp);
    sub.connect(lp);
    lp.connect(motorGain).connect(this.master);
    noise.connect(foamFilter).connect(foamGain).connect(this.master);

    motor.start(t);
    sub.start(t);
    noise.start(t);

    this.blenderNodes = { motor, sub, lp, noise, foamFilter, motorGain, foamGain, lastChop: 0 };
  }

  updateBlender(blendDuration, dt) {
    if (!this.blenderNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const prog = Math.min(1, blendDuration / 4.2);
    this.blenderNodes.motor.frequency.setTargetAtTime(110 + prog * 155, t, 0.05);
    this.blenderNodes.sub.frequency.setTargetAtTime(220 + prog * 310, t, 0.05);
    this.blenderNodes.lp.frequency.setTargetAtTime(520 + prog * 1100, t, 0.06);
    this.blenderNodes.foamFilter.frequency.setTargetAtTime(900 + prog * 1900, t, 0.06);
    this.blenderNodes.foamGain.gain.setTargetAtTime(0.10 + prog * 0.14, t, 0.06);

    // Early stage fruit-chopping impacts, late stage airy bubbles
    this.blenderNodes.lastChop += dt;
    const interval = blendDuration < 1.3 ? 0.085 : 0.14;
    if (this.blenderNodes.lastChop > interval) {
      this.blenderNodes.lastChop = 0;
      if (blendDuration < 1.4) {
        this.playFruitChopHit(1 - blendDuration / 1.5);
      } else {
        this.playMicroBubble(0.5 + prog * 0.6);
      }
    }
  }

  playFruitChopHit(strength = 0.7) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180 + Math.random() * 140, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  playMicroBubble(bright = 1.0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const f = (550 + Math.random() * 650) * bright;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.65, t + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  stopBlender() {
    if (!this.blenderNodes || !this.ctx) return;
    const n = this.blenderNodes;
    this.blenderNodes = null;
    const t = this.ctx.currentTime;
    n.motor.frequency.exponentialRampToValueAtTime(55, t + 0.25);
    n.sub.frequency.exponentialRampToValueAtTime(110, t + 0.25);
    n.motorGain.gain.setTargetAtTime(0.0001, t, 0.06);
    n.foamGain.gain.setTargetAtTime(0.0001, t, 0.06);
    setTimeout(() => {
      try { n.motor.stop(); n.sub.stop(); n.noise.stop(); } catch (_) {}
    }, 320);
  }

  startPour(viscosity = 0.3) {
    this.unlock();
    if (!this.ctx || this.pourNodes) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(700, t);
    bp.Q.value = 3.8 + viscosity * 2.5;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.22 * (1 - viscosity * 0.35), t + 0.06);

    noise.connect(bp).connect(g).connect(this.master);
    noise.start(t);
    this.pourNodes = { noise, bp, g, bubbleTimer: 0, viscosity };
  }

  updatePour(fillLevel, pourHeightFactor, dt) {
    if (!this.pourNodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Acoustic physics: rising cavity resonance frequency as glass fills!
    const targetFreq = 460 + fillLevel * 920 + pourHeightFactor * 240;
    this.pourNodes.bp.frequency.setTargetAtTime(targetFreq, t, 0.05);
    this.pourNodes.bubbleTimer += dt;
    const rate = 0.075 + this.pourNodes.viscosity * 0.09;
    if (this.pourNodes.bubbleTimer > rate) {
      this.pourNodes.bubbleTimer = 0;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const bf = (320 + fillLevel * 520) * (0.9 + Math.random() * 0.25);
      osc.frequency.setValueAtTime(bf, t);
      osc.frequency.exponentialRampToValueAtTime(bf * 1.45, t + 0.055);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.065 * (1 - this.pourNodes.viscosity * 0.4), t);
      og.gain.exponentialRampToValueAtTime(0.0008, t + 0.06);
      osc.connect(og).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.065);
    }
  }

  stopPour() {
    if (!this.pourNodes || !this.ctx) return;
    const n = this.pourNodes;
    this.pourNodes = null;
    const t = this.ctx.currentTime;
    n.g.gain.setTargetAtTime(0.0001, t, 0.04);
    setTimeout(() => {
      try { n.noise.stop(); } catch (_) {}
    }, 180);
  }

  playDrip() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.055);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.065);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  // Crystal glass clink whose resonant pitch shifts physically with liquid fill!
  playGlassClink(fillLevel = 0.5, strength = 1.0) {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Fuller glass = heavier mass = lower clear crystal ring; emptier glass = higher ring
    const root = 1760 - fillLevel * 680;
    const ratios = [1.0, 2.32, 3.86];
    ratios.forEach((r, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(root * r, t);
      const g = this.ctx.createGain();
      const amp = (idx === 0 ? 0.20 : idx === 1 ? 0.09 : 0.04) * strength;
      const decay = (idx === 0 ? 0.85 : 0.42) * (1.05 - fillLevel * 0.25);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + decay + 0.03);
    });
  }

  playStrawBubbles() {
    this.unlock();
    if (!this.ctx) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.playMicroBubble(0.75 + i * 0.08), i * 52);
    }
  }

  playSip() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const ns = this.ctx.createBufferSource();
    ns.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(1450, t + 0.22);
    bp.Q.value = 3.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    ns.connect(bp).connect(g).connect(this.master);
    ns.start(t);
    ns.stop(t + 0.27);
  }

  playCuriousHuh() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Playful upward-inflected marimba "huh?"
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(370, t);
    osc.frequency.exponentialRampToValueAtTime(540, t + 0.19);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  playSourPucker() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Comical puckering wobble squeak!
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.14);
    osc.frequency.linearRampToValueAtTime(590, t + 0.26);
    osc.frequency.linearRampToValueAtTime(980, t + 0.38);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 22;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 45;
    lfo.connect(lfoGain).connect(osc.frequency);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 2.5;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(bp).connect(g).connect(this.master);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.47);
    lfo.stop(t + 0.47);
  }

  playHappySmile() {
    this.unlock();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    notes.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      const st = t + i * 0.065;
      g.gain.setValueAtTime(0.001, st);
      g.gain.linearRampToValueAtTime(0.14, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, st + 0.55);
      osc.connect(g).connect(this.master);
      osc.start(st);
      osc.stop(st + 0.58);
    });
  }

  playPartyCheers() {
    this.unlock();
    if (!this.ctx) return;
    this.playGlassClink(0.45, 1.15);
    setTimeout(() => this.playGlassClink(0.68, 0.9), 70);
    setTimeout(() => this.playHappySmile(), 110);
  }
}

export const sound = new SoundEngine();

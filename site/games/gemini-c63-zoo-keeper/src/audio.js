// Procedural Web Audio Foley & Gentle Vocalization Engine (Zero Words)
export class ZooAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.hoseNode = null;
    this.hoseGain = null;
    this.hoseFilter = null;
    this.foamGain = null;
    this.foamFilter = null;
    this.brushGain = null;
    this.brushFilter = null;
    this.ambienceStarted = false;
    this.lastPopTime = 0;
    this.lastDropletTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;

      // Gentle soft limiter via compressor
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      // 2-second pink/white blended noise buffer
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        data[i] = (b0 + b1 + b2 + w * 0.28) * 0.22;
      }

      this._setupContinuousLoops();
      this._startOutdoorAmbience();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _createNoiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.loopStart = Math.random() * 0.4;
    return src;
  }

  _setupContinuousLoops() {
    // Pressurized water hose loop
    const hoseSrc = this._createNoiseSource();
    this.hoseFilter = this.ctx.createBiquadFilter();
    this.hoseFilter.type = 'bandpass';
    this.hoseFilter.frequency.value = 1650;
    this.hoseFilter.Q.value = 0.75;
    this.hoseGain = this.ctx.createGain();
    this.hoseGain.gain.value = 0.0001;
    hoseSrc.connect(this.hoseFilter);
    this.hoseFilter.connect(this.hoseGain);
    this.hoseGain.connect(this.master);
    hoseSrc.start();

    // Creamy soap lather scrub loop
    const foamSrc = this._createNoiseSource();
    this.foamFilter = this.ctx.createBiquadFilter();
    this.foamFilter.type = 'bandpass';
    this.foamFilter.frequency.value = 920;
    this.foamFilter.Q.value = 1.4;
    this.foamGain = this.ctx.createGain();
    this.foamGain.gain.value = 0.0001;
    foamSrc.connect(this.foamFilter);
    this.foamFilter.connect(this.foamGain);
    this.foamGain.connect(this.master);
    foamSrc.start();

    // Bristle grooming brush loop
    const brushSrc = this._createNoiseSource();
    this.brushFilter = this.ctx.createBiquadFilter();
    this.brushFilter.type = 'highpass';
    this.brushFilter.frequency.value = 2200;
    this.brushGain = this.ctx.createGain();
    this.brushGain.gain.value = 0.0001;
    brushSrc.connect(this.brushFilter);
    this.brushFilter.connect(this.brushGain);
    this.brushGain.connect(this.master);
    brushSrc.start();
  }

  _startOutdoorAmbience() {
    if (this.ambienceStarted || !this.ctx) return;
    this.ambienceStarted = true;
    // Soft overcast wind through sanctuary trees
    const wind = this._createNoiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 360;
    const g = this.ctx.createGain();
    g.gain.value = 0.045;
    wind.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    wind.start();

    // Occasional distant gentle bird chirp
    const scheduleBird = () => {
      if (this.ctx && this.ctx.state === 'running') {
        this._playSoftBird();
      }
      setTimeout(scheduleBird, 4200 + Math.random() * 5500);
    };
    setTimeout(scheduleBird, 2200);
  }

  _playSoftBird() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const base = 1950 + Math.random() * 650;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.28, t + 0.07);
    osc.frequency.exponentialRampToValueAtTime(base * 0.92, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.022, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  updateContinuous({ hose = 0, hoseHitAnimal = false, foamScrub = 0, brushSpeed = 0, furGloss = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Hose sound
    const targetHose = Math.min(0.28, hose * (hoseHitAnimal ? 0.26 : 0.16));
    this.hoseGain.gain.setTargetAtTime(Math.max(0.0001, targetHose), t, 0.04);
    this.hoseFilter.frequency.setTargetAtTime(hoseHitAnimal ? 1250 : 2100, t, 0.06);

    if (hose > 0.2 && t - this.lastDropletTime > (hoseHitAnimal ? 0.045 : 0.09)) {
      this.lastDropletTime = t;
      this.playWaterDroplet(hoseHitAnimal ? 0.9 : 0.45);
    }

    // Foam scrub sound + creamy micro-bubble pops
    const targetFoam = Math.min(0.22, foamScrub * 0.2);
    this.foamGain.gain.setTargetAtTime(Math.max(0.0001, targetFoam), t, 0.035);
    this.foamFilter.frequency.setTargetAtTime(750 + foamScrub * 650, t, 0.05);
    if (foamScrub > 0.15 && t - this.lastPopTime > 0.055) {
      this.lastPopTime = t;
      this.playBubblePop(0.5 + Math.random() * 0.6);
    }

    // Brushing fur sound (becomes higher & silkier as furGloss increases!)
    const targetBrush = Math.min(0.2, brushSpeed * 0.18);
    this.brushGain.gain.setTargetAtTime(Math.max(0.0001, targetBrush), t, 0.03);
    this.brushFilter.frequency.setTargetAtTime(1700 + furGloss * 1900 + brushSpeed * 500, t, 0.04);
  }

  playBubblePop(intensity = 0.7) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const f0 = 420 + Math.random() * 680;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 2.15, t + 0.045);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045 * intensity, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  playWaterDroplet(intensity = 0.7) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const f0 = 680 + Math.random() * 900;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.65, t + 0.04);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.032 * intensity, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playBigSplash(volume = 0.8) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this._createNoiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(950, t);
    bp.frequency.exponentialRampToValueAtTime(380, t + 0.55);
    bp.Q.value = 0.65;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.28 * volume, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.65);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.playWaterDroplet(0.9), i * 45);
    }
  }

  playBootPutOn() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Rubber squeak + two happy little boot stomps
    [0, 0.16].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 155 : 175, t + offset);
      osc.frequency.exponentialRampToValueAtTime(62, t + offset + 0.11);
      g.gain.setValueAtTime(0.001, t + offset);
      g.gain.linearRampToValueAtTime(0.24, t + offset + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.13);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.14);
    });
  }

  playApronPutOn() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this._createNoiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.28);
    this.playWarmChord([523.25, 659.25, 783.99], 0.12);
  }

  playWarmChord(freqs = [440, 554.37, 659.25], vol = 0.1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + i * 0.045);
      g.gain.setValueAtTime(0.0001, t + i * 0.045);
      g.gain.linearRampToValueAtTime(vol, t + i * 0.045 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.045 + 0.55);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + i * 0.045);
      osc.stop(t + i * 0.045 + 0.58);
    });
  }

  playGirlHuh() {
    // Gentle non-verbal rising "hmm?" / "あれ？" melodic formant
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(510, t + 0.22);
    flt.type = 'bandpass';
    flt.frequency.value = 980;
    flt.Q.value = 2.2;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  playGirlGiggle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [587, 698, 784];
    notes.forEach((f, i) => {
      const st = t + i * 0.085;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, st);
      osc.frequency.exponentialRampToValueAtTime(f * 1.12, st + 0.065);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.09, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
      osc.connect(g);
      g.connect(this.master);
      osc.start(st);
      osc.stop(st + 0.09);
    });
  }

  playElephantTrumpet(gentle = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc2.type = 'triangle';
    const base = gentle ? 165 : 235;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.75, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(base * 1.32, t + 0.58);
    osc2.frequency.setValueAtTime(base * 2.01, t);
    osc2.frequency.exponentialRampToValueAtTime(base * 3.5, t + 0.18);
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(750, t);
    flt.frequency.linearRampToValueAtTime(1350, t + 0.2);
    flt.Q.value = 2.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gentle ? 0.11 : 0.18, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    osc.connect(flt);
    osc2.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.68);
    osc2.stop(t + 0.68);
  }

  playZebraWhinny() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const st = t + i * 0.11;
      const osc = this.ctx.createOscillator();
      const flt = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(460 - i * 45, st);
      osc.frequency.exponentialRampToValueAtTime(310 - i * 30, st + 0.09);
      flt.type = 'bandpass';
      flt.frequency.value = 1100;
      flt.Q.value = 2.0;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.095, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1);
      osc.connect(flt);
      flt.connect(g);
      g.connect(this.master);
      osc.start(st);
      osc.stop(st + 0.105);
    }
  }

  playBigCatPurr(isLion = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isLion ? 68 : 84, t);
    lfo.frequency.value = 22;
    lfoGain.gain.value = 0.06;
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.68);
    lfo.stop(t + 0.68);
  }

  playMunch(crispy = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 0.14, 0.27].forEach((off) => {
      const src = this._createNoiseSource();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = crispy ? 1550 : 720;
      bp.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t + off);
      g.gain.linearRampToValueAtTime(0.16, t + off + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.09);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t + off);
      src.stop(t + off + 0.1);
    });
  }

  playWatermelonSlice() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Crisp rind crack + juicy squish
    const src = this._createNoiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(620, t + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.18);
    this.playWaterDroplet(0.85);
  }

  playDadSlipAndRoll() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Comical gentle slip slide + soft thump + rolling melon thuds
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.36);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.42);

    [0.36, 0.55, 0.72, 0.92, 1.15].forEach((off, idx) => {
      const thud = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(125 - idx * 8, t + off);
      thud.frequency.exponentialRampToValueAtTime(48, t + off + 0.11);
      tg.gain.setValueAtTime(0.001, t + off);
      tg.gain.linearRampToValueAtTime(0.2 - idx * 0.025, t + off + 0.012);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.13);
      thud.connect(tg);
      tg.connect(this.master);
      thud.start(t + off);
      thud.stop(t + off + 0.14);
    });
  }
}

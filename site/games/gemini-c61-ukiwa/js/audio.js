// Procedural Web Audio engine: glossy PVC vinyl squeaks, hollow air resonance,
// bellows & cylinder air pumps, valve air release, water splashes, and nonverbal family voices.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.ambientStarted = false;
    this.lastSqueakTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.ambientStarted && this.ctx.state === 'running') {
      this._startSummerAmbience();
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

  _startSummerAmbience() {
    if (!this.ctx || !this.noiseBuffer || this.ambientStarted) return;
    this.ambientStarted = true;
    // Very gentle warm summer breeze + distant high shimmer (subtle, non-intrusive)
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4200;
    filter.Q.value = 6.0;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.22;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.004;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.006;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    src.start();
    lfo.start();
  }

  // Glossy PVC rub / squeak ("kyu!")
  playVinylSqueak(intensity = 0.6, pitchScale = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSqueakTime < 0.055) return;
    this.lastSqueakTime = now;

    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    const baseFreq = (680 + intensity * 380) * pitchScale;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.82, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.32, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 0.13);

    mod.type = 'triangle';
    mod.frequency.value = 48;
    modGain.gain.value = 65 * intensity;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.09 * Math.min(1.2, intensity), now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    mod.start(now);
    osc.stop(now + 0.15);
    mod.stop(now + 0.15);
  }

  // Hollow inflated vinyl drum bounce ("pon! boyon!") - pitch rises with internal pressure
  playVinylBounce(pressure = 0.7, sizeScale = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const p = Math.max(0.1, Math.min(1.4, pressure));

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const f0 = (135 + p * 165) / Math.max(0.65, sizeScale);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0 * 1.35, now);
    osc.frequency.exponentialRampToValueAtTime(f0, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.06, now + 0.24);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(f0 * 2.71, now);
    osc2.frequency.exponentialRampToValueAtTime(f0 * 2.1, now + 0.14);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.045 * p, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.20, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    osc2.connect(g2);
    g2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.30);
    osc2.stop(now + 0.16);
  }

  // Air pump stroke ("shuko-psht!") + rising chamber resonance
  playPumpStroke(pumpType = 'bellows', pressure = 0.3, holdStrength = 0.6) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const dur = 0.16 + holdStrength * 0.14;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseF = pumpType === 'cylinder' ? 1200 : 820;
    filter.frequency.setValueAtTime(baseF, now);
    filter.frequency.exponentialRampToValueAtTime(baseF * (1.4 + pressure * 0.8), now + dur);
    filter.Q.value = 2.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.02);

    // Subtle tonal air resonance inside float
    const tone = this.ctx.createOscillator();
    const tGain = this.ctx.createGain();
    tone.type = 'sine';
    const rFreq = 190 + pressure * 260;
    tone.frequency.setValueAtTime(rFreq * 0.9, now);
    tone.frequency.linearRampToValueAtTime(rFreq * 1.12, now + dur);
    tGain.gain.setValueAtTime(0.0001, now);
    tGain.gain.linearRampToValueAtTime(0.055, now + 0.03);
    tGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    tone.connect(tGain);
    tGain.connect(this.ctx.destination);
    tone.start(now);
    tone.stop(now + dur + 0.02);
  }

  // Valve pop-click or unplug ("pon!")
  playValvePop(open = true) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    if (open) {
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.065);
    } else {
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.065);
    }
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Over-inflation / deflation air release ("PSHUUUUUU~!")
  playAirRelease(duration = 0.75, pressure = 1.0) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400 + pressure * 900, now);
    filter.frequency.exponentialRampToValueAtTime(680, now + duration);
    filter.Q.value = 3.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Little fluttering vinyl lip buzz
    const lip = this.ctx.createOscillator();
    const lipGain = this.ctx.createGain();
    lip.type = 'sawtooth';
    lip.frequency.setValueAtTime(140 + pressure * 70, now);
    lip.frequency.exponentialRampToValueAtTime(68, now + duration);
    lipGain.gain.setValueAtTime(0.025, now);
    lipGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.85);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    lip.connect(lipGain);
    lipGain.connect(this.ctx.destination);

    src.start(now);
    lip.start(now);
    src.stop(now + duration + 0.03);
    lip.stop(now + duration + 0.03);
  }

  // Dad's turbo mishap rapid inflation rumble
  playTurboInflate(duration = 1.35) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + duration * 0.82);
    osc.frequency.exponentialRampToValueAtTime(220, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.04);

    this.playVinylBounce(1.1, 1.5);
  }

  // Outfit cloth swish + joyful sparkle notes
  playOutfitSelect(outfitIndex = 0) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Soft fabric rustle
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 1.5;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.08, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.2);

    // Warm marimba-like triad
    const chords = [
      [523.25, 659.25, 783.99, 1046.5],
      [587.33, 739.99, 880.0, 1174.66],
      [493.88, 622.25, 739.99, 987.77]
    ];
    const notes = chords[outfitIndex % chords.length];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.065;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  // Multi-layered realistic water splash (plunge bubble + mid slosh + sparkling droplets)
  playWaterSplash(intensity = 0.7) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const k = Math.max(0.2, Math.min(1.6, intensity));

    // 1. Deep underwater plunge bubble ("doboon!")
    const plunge = this.ctx.createOscillator();
    const pGain = this.ctx.createGain();
    plunge.type = 'sine';
    plunge.frequency.setValueAtTime(190 / (0.7 + k * 0.4), now);
    plunge.frequency.exponentialRampToValueAtTime(72, now + 0.14);
    plunge.frequency.exponentialRampToValueAtTime(240, now + 0.34);
    pGain.gain.setValueAtTime(0.22 * Math.min(1.2, k), now);
    pGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    plunge.connect(pGain);
    pGain.connect(this.ctx.destination);
    plunge.start(now);
    plunge.stop(now + 0.4);

    // 2. Filtered splash noise burst ("zabaaan!")
    const dur = 0.32 + k * 0.42;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + dur);
    filter.Q.value = 1.1;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.linearRampToValueAtTime(0.22 * Math.min(1.25, k), now + 0.02);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.03);

    // 3. Falling water droplets ("pasha-pasha-pichi!")
    const drops = Math.floor(3 + k * 6);
    for (let i = 0; i < drops; i++) {
      const dt = now + 0.08 + Math.random() * (0.28 + k * 0.25);
      const dOsc = this.ctx.createOscillator();
      const dGain = this.ctx.createGain();
      const df = 720 + Math.random() * 1100;
      dOsc.type = 'sine';
      dOsc.frequency.setValueAtTime(df * 0.75, dt);
      dOsc.frequency.exponentialRampToValueAtTime(df * 1.45, dt + 0.045);
      dGain.gain.setValueAtTime(0.038, dt);
      dGain.gain.exponentialRampToValueAtTime(0.0001, dt + 0.05);
      dOsc.connect(dGain);
      dGain.connect(this.ctx.destination);
      dOsc.start(dt);
      dOsc.stop(dt + 0.055);
    }
  }

  playRipple() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.08);
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Expressive wordless vocal reaction ("huh?", happy giggle, Dad chuckle)
  playReaction(who = 'girl', mood = 'happy') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const pitchBase = who === 'dad' ? 155 : who === 'mom' ? 285 : 390;

    if (mood === 'huh') {
      // Rising questioning hum ("hm~?")
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitchBase * 0.92, now);
      osc.frequency.exponentialRampToValueAtTime(pitchBase * 1.38, now + 0.22);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = pitchBase * 3.2;
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.085, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (mood === 'muffled') {
      // Dad muffled wiggle under giant octopus
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.14;
        const osc = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140 + i * 25, t);
        osc.frequency.linearRampToValueAtTime(115, t + 0.11);
        lp.type = 'lowpass';
        lp.frequency.value = 340;
        g.gain.setValueAtTime(0.075, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.connect(lp);
        lp.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
      }
    } else {
      // Joyful 3-note laugh/giggle
      const steps = [1.0, 1.22, 1.48];
      steps.forEach((mul, idx) => {
        const t = now + idx * 0.085;
        const osc = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitchBase * mul, t);
        osc.frequency.exponentialRampToValueAtTime(pitchBase * mul * 1.09, t + 0.065);
        lp.type = 'lowpass';
        lp.frequency.value = pitchBase * 3.8;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.08, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        osc.connect(lp);
        lp.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      });
    }
  }
}

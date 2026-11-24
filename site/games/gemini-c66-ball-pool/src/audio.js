// Procedural Web Audio API foley & acoustic sound engine (zero external assets)
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.rustleGain = null;
    this.rustleFilter = null;
    this.pourAccumulator = 0;
    this.lastPopTime = 0;
    this.popCountWindow = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.82;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      // 2-second white/pink noise buffer for mesh rustle, slide friction & hand claps
      const sr = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sr * 2, sr);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.18) * 0.7;
      }

      // Continuous mesh bag rustle loop
      const rustleSrc = this.ctx.createBufferSource();
      rustleSrc.buffer = this.noiseBuffer;
      rustleSrc.loop = true;
      this.rustleFilter = this.ctx.createBiquadFilter();
      this.rustleFilter.type = 'bandpass';
      this.rustleFilter.frequency.value = 2600;
      this.rustleFilter.Q.value = 1.1;
      this.rustleGain = this.ctx.createGain();
      this.rustleGain.gain.value = 0.0;
      rustleSrc.connect(this.rustleFilter);
      this.rustleFilter.connect(this.rustleGain);
      this.rustleGain.connect(this.master);
      rustleSrc.start();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Hollow LDPE plastic ball impact ("pok / pak / pon")
  playBallPop(colorId = 0, intensity = 0.6, pan = 0, surface = 'ball') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.lastPopTime < 0.012) {
      this.popCountWindow++;
      if (this.popCountWindow > 4) return;
    } else {
      this.popCountWindow = 0;
      this.lastPopTime = now;
    }

    const vol = Math.min(0.32, Math.max(0.02, intensity * 0.24));
    // Distinct subtle resonant pitch per color + natural variance
    const baseFreqs = [650, 735, 820];
    let f1 = (baseFreqs[colorId % 3] || 700) * (0.94 + Math.random() * 0.12);
    if (surface === 'wood') f1 *= 1.18;
    else if (surface === 'foam') f1 *= 0.78;
    else if (surface === 'crate') f1 *= 0.92;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(f1 * 1.24, now);
    osc1.frequency.exponentialRampToValueAtTime(f1 * 0.76, now + 0.048);

    osc2.frequency.setValueAtTime(f1 * 2.12, now);
    osc2.frequency.exponentialRampToValueAtTime(f1 * 1.45, now + 0.032);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.0025);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + (surface === 'wood' ? 0.068 : 0.052));

    let outNode = gain;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
      gain.connect(panner);
      outNode = panner;
    }

    osc1.connect(gain);
    osc2.connect(gain);
    outNode.connect(this.master);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.075);
    osc2.stop(now + 0.075);
  }

  // Continuous pouring stream sound: nylon mesh rustle + cascading plastic ball grains
  updatePour(dt, isPouring, rate01 = 0.8, colorId = 0, pan = 0, fillRatio = 0) {
    if (!this.ctx || !this.rustleGain) return;
    const now = this.ctx.currentTime;
    const targetRustle = isPouring ? 0.065 * (0.5 + rate01 * 0.7) : 0.0;
    this.rustleGain.gain.setTargetAtTime(targetRustle, now, 0.04);
    if (isPouring && this.rustleFilter) {
      this.rustleFilter.frequency.setTargetAtTime(2100 + rate01 * 1200, now, 0.05);
      this.pourAccumulator += dt * (18 + rate01 * 20);
      while (this.pourAccumulator >= 1) {
        this.pourAccumulator -= 1;
        this.playBallPop(
          colorId,
          0.35 + Math.random() * 0.45 + fillRatio * 0.15,
          pan + (Math.random() - 0.5) * 0.25,
          fillRatio > 0.15 ? 'ball' : 'foam'
        );
      }
    } else {
      this.pourAccumulator = 0;
    }
  }

  playDressUp(outfitIndex = 0) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Soft cloth swoosh
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(1400, now);
      filt.frequency.exponentialRampToValueAtTime(2900, now + 0.18);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.14, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 0.5, 0.26);
    }

    // Warm marimba-like chord arpeggio tailored to outfit
    const chords = [
      [523.25, 659.25, 783.99, 1046.5],
      [587.33, 739.99, 880.0, 1174.66],
      [493.88, 622.25, 739.99, 987.77]
    ];
    const notes = chords[outfitIndex % 3];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.065;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.36);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  playSlideWhoosh(duration = 0.42, intense = false) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 2.2;
    filt.frequency.setValueAtTime(480, now);
    filt.frequency.exponentialRampToValueAtTime(intense ? 2400 : 1500, now + duration);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(intense ? 0.26 : 0.14, now + duration * 0.55);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(now, 0, duration + 0.05);

    // Playful descending whistle/slide tone on Mom's big slide
    if (intense) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(360, now + duration);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.001, now + 0.05);
      og.gain.linearRampToValueAtTime(0.11, now + 0.14);
      og.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(og);
      og.connect(this.master);
      osc.start(now + 0.05);
      osc.stop(now + duration + 0.02);
    }
  }

  playBigSplash(intensity = 0.8, isMomMishap = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Deep cushioned mat thump
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isMomMishap ? 128 : 105, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.24);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(isMomMishap ? 0.42 : 0.26, now + 0.01);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    sub.connect(sg);
    sg.connect(this.master);
    sub.start(now);
    sub.stop(now + 0.3);

    // Burst of scattered plastic ball clatters
    const count = isMomMishap ? 26 : 12;
    for (let i = 0; i < count; i++) {
      const delay = i * (isMomMishap ? 18 : 14) + Math.random() * 25;
      setTimeout(() => {
        this.playBallPop(
          i % 3,
          (isMomMishap ? 0.85 : 0.55) * (1 - i / (count * 1.35)),
          (Math.random() - 0.5) * 1.5,
          isMomMishap && i > 8 ? 'wood' : 'ball'
        );
      }, delay);
    }

    // Cute sheepish "Oops!" inflection after Mom's splash settles
    if (isMomMishap) {
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(520, t);
        o.frequency.exponentialRampToValueAtTime(370, t + 0.18);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.14, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + 0.24);
      }, 420);
    }
  }

  playCrateDrop(colorId = 0, fillRatio = 0.2) {
    if (!this.ctx) return;
    this.playBallPop(colorId, 0.72, 0, 'crate');
    const now = this.ctx.currentTime;
    const pitch = 392 * Math.pow(2, fillRatio * 0.55);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now + 0.015);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now + 0.015);
    g.gain.linearRampToValueAtTime(0.11, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now + 0.015);
    osc.stop(now + 0.18);
  }

  // "あれ？" (curious upward inflection) -> 0.62s later -> "喜ぶ" (happy sunny chime)
  playHuhThenJoy() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Curious "Huh?" (rising glide)
    const huh = this.ctx.createOscillator();
    huh.type = 'triangle';
    huh.frequency.setValueAtTime(340, now);
    huh.frequency.exponentialRampToValueAtTime(515, now + 0.19);
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0.001, now);
    hg.gain.linearRampToValueAtTime(0.16, now + 0.03);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    huh.connect(hg);
    hg.connect(this.master);
    huh.start(now);
    huh.stop(now + 0.25);

    // Warm delighted giggle/chime 0.62s later
    const joyStart = now + 0.62;
    [587.33, 739.99, 880.0].forEach((f, idx) => {
      const t = joyStart + idx * 0.055;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.3);
    });
  }

  playSoftWobble() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(240, now);
    o.frequency.exponentialRampToValueAtTime(165, now + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    o.connect(g);
    g.connect(this.master);
    o.start(now);
    o.stop(now + 0.1);
  }

  // Final ball drop + multi-person realistic family applause!
  playLastBallApplause() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Bright completion chord
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.65);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.68);
    });

    // 3-person overlapping hand claps (Dad ~980Hz, Mom ~1380Hz, Daughter ~1850Hz)
    const clappers = [
      { formant: 980, pan: -0.35, rate: 0.20, offset: 0.18, amp: 0.22 },
      { formant: 1380, pan: 0.35, rate: 0.18, offset: 0.22, amp: 0.20 },
      { formant: 1860, pan: 0.0, rate: 0.155, offset: 0.20, amp: 0.18 }
    ];

    clappers.forEach((clapper) => {
      for (let c = 0; c < 14; c++) {
        const t = now + clapper.offset + c * clapper.rate + (Math.random() - 0.5) * 0.024;
        const fade = c > 9 ? (14 - c) / 5 : 1.0;

        // Micro double-slap envelope of real human palms meeting
        for (let pulse = 0; pulse < 2; pulse++) {
          const pt = t + pulse * 0.009;
          const src = this.ctx.createBufferSource();
          src.buffer = this.noiseBuffer;

          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = clapper.formant * (0.92 + Math.random() * 0.16);
          bp.Q.value = 2.6;

          const g = this.ctx.createGain();
          const peak = clapper.amp * fade * (pulse === 0 ? 0.72 : 1.0);
          g.gain.setValueAtTime(0.0001, pt);
          g.gain.linearRampToValueAtTime(peak, pt + 0.0025);
          g.gain.exponentialRampToValueAtTime(0.0008, pt + 0.058);

          src.connect(bp);
          bp.connect(g);
          if (this.ctx.createStereoPanner) {
            const p = this.ctx.createStereoPanner();
            p.pan.value = clapper.pan;
            g.connect(p);
            p.connect(this.master);
          } else {
            g.connect(this.master);
          }
          src.start(pt, Math.random() * 1.2, 0.07);
        }
      }
    });
  }
}

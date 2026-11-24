// Lifelike Soft-Focus Portraits (Girl & Dad), 3D Child's Hand, 3D Dad's Hand, and Photorealistic Square Sheep & Chickens
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ============================================================================
// 1. SOFT-FOCUS NATURAL PORTRAIT CAMEOS (Zero text, zero anime outlines)
// ============================================================================
export class PortraitOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.outfitIndex = -1; // -1 = plain linen shirt before dress-up, 0=denim, 1=linen, 2=corduroy

    // Pre-generate subtle photographic hair & skin grain offscreen layers for realistic texture
    this.girlMood = 'curious'; // curious, happy, huh, delighted, surprised, proud
    this.girlMoodTimer = 0;
    this.dadVisible = false;
    this.dadAlpha = 0;
    this.dadMood = 'happy'; // happy, huh, excited, panic, sheepish, proud
    this.dadMoodTimer = 0;

    // Smoothly interpolated facial muscles (girl)
    this.gState = {
      smile: 0.35,
      mouthOpen: 0.05,
      mouthO: 0.0,
      browL: 0.0,
      browR: 0.0,
      squint: 0.05,
      tilt: 0.0,
      gazeX: 0.0,
      gazeY: 0.08,
      blink: 0.0,
      bounce: 0.0,
    };

    // Smoothly interpolated facial muscles (dad)
    this.dState = {
      smile: 0.45,
      mouthOpen: 0.08,
      mouthO: 0.0,
      browL: 0.0,
      browR: 0.0,
      tilt: 0.0,
      sweat: 0.0,
      blink: 0.0,
    };

    // Position state: in Dress-Up, girl cameo is prominent upper-center; after Dress-Up, glides to top-left
    this.dressUpMode = true;
    this.posBlend = 0; // 0 = dressup center, 1 = gameplay top-left
    this.blinkTimerG = 2.4;
    this.blinkTimerD = 3.1;
    this.time = 0;
    this.sunWarmth = 0.0; // 0=day, 0.5=sunset, 1=night warm glow
    this.pointerNorm = { x: 0, y: 0 };
  }

  setGirlMood(mood, duration = 2.0) {
    this.girlMood = mood;
    this.girlMoodTimer = duration;
    this.gState.bounce = 1.0;
  }

  triggerHuhThenHappy(who = 'both') {
    if (who === 'girl' || who === 'both') {
      this.setGirlMood('huh', 0.62);
      setTimeout(() => this.setGirlMood('delighted', 1.9), 600);
    }
    if (who === 'dad' || who === 'both') {
      this.dadVisible = true;
      this.dadMood = 'huh';
      this.dadMoodTimer = 0.62;
      setTimeout(() => {
        this.dadMood = 'proud';
        this.dadMoodTimer = 2.2;
      }, 600);
    }
  }

  showDad(mood = 'happy', duration = 3.5) {
    this.dadVisible = true;
    this.dadMood = mood;
    this.dadMoodTimer = duration;
  }

  resize(w, h, dpr) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  update(dt) {
    this.time += dt;
    const targetBlend = this.dressUpMode ? 0 : 1;
    this.posBlend = lerp(this.posBlend, targetBlend, Math.min(1, dt * 4.5));
    this.gState.bounce = Math.max(0, this.gState.bounce - dt * 3.2);

    if (this.girlMoodTimer > 0) {
      this.girlMoodTimer -= dt;
      if (this.girlMoodTimer <= 0) this.girlMood = 'happy';
    }

    if (this.dadMoodTimer > 0) {
      this.dadMoodTimer -= dt;
      if (this.dadMoodTimer <= 0 && this.dadMood !== 'sheepish') {
        this.dadVisible = false;
      }
    }
    this.dadAlpha = lerp(this.dadAlpha, this.dadVisible ? 1 : 0, Math.min(1, dt * 6));

    // Natural eye blinking
    this.blinkTimerG -= dt;
    if (this.blinkTimerG <= 0) {
      this.blinkTimerG = 2.6 + Math.random() * 2.8;
      this.gState.blink = 1.0;
    } else {
      this.gState.blink = Math.max(0, this.gState.blink - dt * 11);
    }

    this.blinkTimerD -= dt;
    if (this.blinkTimerD <= 0) {
      this.blinkTimerD = 3.0 + Math.random() * 2.5;
      this.dState.blink = 1.0;
    } else {
      this.dState.blink = Math.max(0, this.dState.blink - dt * 10);
    }

    // Target muscle values for Girl
    const gt = { smile: 0.42, mouthOpen: 0.04, mouthO: 0, browL: 0, browR: 0, squint: 0.08, tilt: 0 };
    if (this.girlMood === 'curious') {
      gt.smile = 0.28; gt.mouthOpen = 0.06; gt.browL = 0.15; gt.browR = 0.15;
    } else if (this.girlMood === 'huh') {
      // "あれ？" face: head tilted, one eyebrow raised, little round 'o' mouth!
      gt.smile = -0.05; gt.mouthOpen = 0.38; gt.mouthO = 0.92; gt.browL = 0.55; gt.browR = -0.12; gt.tilt = -0.14; gt.squint = -0.05;
    } else if (this.girlMood === 'delighted' || this.girlMood === 'proud') {
      gt.smile = 0.95; gt.mouthOpen = 0.52; gt.mouthO = 0.0; gt.browL = 0.25; gt.browR = 0.25; gt.squint = 0.42; gt.tilt = 0.06;
    } else if (this.girlMood === 'surprised') {
      gt.smile = 0.0; gt.mouthOpen = 0.62; gt.mouthO = 0.85; gt.browL = 0.65; gt.browR = 0.65; gt.squint = -0.12;
    }

    const rate = Math.min(1, dt * 9);
    for (const k of Object.keys(gt)) {
      this.gState[k] = lerp(this.gState[k], gt[k], rate);
    }
    this.gState.gazeX = lerp(this.gState.gazeX, Math.max(-0.35, Math.min(0.35, this.pointerNorm.x * 0.35)), Math.min(1, dt * 6));
    this.gState.gazeY = lerp(this.gState.gazeY, Math.max(-0.25, Math.min(0.35, this.pointerNorm.y * 0.3)), Math.min(1, dt * 6));

    // Target muscle values for Dad
    const dtarg = { smile: 0.5, mouthOpen: 0.08, mouthO: 0, browL: 0.08, browR: 0.08, tilt: 0, sweat: 0 };
    if (this.dadMood === 'huh') {
      dtarg.smile = 0.0; dtarg.mouthOpen = 0.36; dtarg.mouthO = 0.88; dtarg.browL = 0.58; dtarg.browR = -0.10; dtarg.tilt = 0.13;
    } else if (this.dadMood === 'excited') {
      dtarg.smile = 0.88; dtarg.mouthOpen = 0.45; dtarg.browL = 0.3; dtarg.browR = 0.3;
    } else if (this.dadMood === 'panic') {
      dtarg.smile = -0.25; dtarg.mouthOpen = 0.78; dtarg.mouthO = 0.9; dtarg.browL = 0.72; dtarg.browR = 0.72; dtarg.sweat = 1.0;
    } else if (this.dadMood === 'sheepish') {
      dtarg.smile = 0.25; dtarg.mouthOpen = 0.12; dtarg.browL = -0.35; dtarg.browR = -0.35; dtarg.tilt = -0.12; dtarg.sweat = 0.85;
    } else if (this.dadMood === 'proud') {
      dtarg.smile = 0.96; dtarg.mouthOpen = 0.55; dtarg.browL = 0.25; dtarg.browR = 0.25; dtarg.tilt = 0.05;
    }
    for (const k of Object.keys(dtarg)) {
      this.dState[k] = lerp(this.dState[k], dtarg[k], rate);
    }
  }

  render() {
    const ctx = this.ctx;
    if (!this.w || !this.h) return;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.w, this.h);

    const minDim = Math.min(this.w, this.h);
    // Dress-up center vs Gameplay top-left natural wooden mirror medallion
    const dressR = Math.max(66, Math.min(96, minDim * 0.145));
    const playR = Math.max(46, Math.min(64, minDim * 0.095));
    const r = lerp(dressR, playR, this.posBlend);

    const dressX = this.w * 0.5;
    const dressY = Math.max(r + 18, this.h * 0.20);
    const playX = r + 16;
    const playY = r + 16;

    const gx = lerp(dressX, playX, this.posBlend);
    const gy = lerp(dressY, playY, this.posBlend) - Math.sin(this.gState.bounce * Math.PI) * 5;

    this._drawGirlCameo(ctx, gx, gy, r);

    if (this.dadAlpha > 0.02) {
      const dr = playR * 0.96;
      const dx = this.w - dr - 16;
      const dy = dr + 16 + (1 - this.dadAlpha) * -24;
      ctx.save();
      ctx.globalAlpha = this.dadAlpha;
      this._drawDadCameo(ctx, dx, dy, dr);
      ctx.restore();
    }

    ctx.restore();
  }

  _drawWoodenMirrorFrame(ctx, cx, cy, r) {
    // Soft natural drop shadow onto the 3D scene
    ctx.save();
    ctx.shadowColor = 'rgba(20, 14, 8, 0.42)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#7c5330';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Turned cedar wood bezel
    const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rim.addColorStop(0, '#c79764');
    rim.addColorStop(0.5, '#8f5f35');
    rim.addColorStop(1, '#59381d');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fill();

    // Inner brass fillet ring
    ctx.strokeStyle = 'rgba(232, 198, 132, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawGirlCameo(ctx, cx, cy, r) {
    this._drawWoodenMirrorFrame(ctx, cx, cy, r);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Out-of-focus sunlit meadow/sunset/twilight bokeh background matching world time of day
    const bg = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    if (this.sunWarmth < 0.4) {
      bg.addColorStop(0, '#a6c69f');
      bg.addColorStop(0.55, '#72945c');
      bg.addColorStop(1, '#4c663b');
    } else if (this.sunWarmth < 0.78) {
      bg.addColorStop(0, '#e39a68');
      bg.addColorStop(0.55, '#9d684c');
      bg.addColorStop(1, '#4c4637');
    } else {
      bg.addColorStop(0, '#233154');
      bg.addColorStop(0.6, '#39364a');
      bg.addColorStop(1, '#4f3a29');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Creamy circular optical bokeh circles in portrait backdrop
    const bokehColor = this.sunWarmth > 0.65 ? 'rgba(255, 204, 112, 0.28)' : 'rgba(255, 248, 220, 0.24)';
    [[-0.52, -0.42, 0.26], [0.56, -0.30, 0.22], [-0.45, 0.35, 0.18], [0.48, 0.42, 0.24]].forEach(([bx, by, br]) => {
      ctx.fillStyle = bokehColor;
      ctx.beginPath();
      ctx.arc(cx + bx * r, cy + by * r, br * r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.translate(cx, cy + r * 0.06);
    const breath = Math.sin(this.time * 2.2) * r * 0.012;
    ctx.translate(0, breath);

    const s = this.gState;

    // --- BACK HAIR (Strictly behind head & sides onto shoulders — NEVER under chin!) ---
    const backHair = ctx.createLinearGradient(0, -r * 0.45, 0, r * 0.55);
    backHair.addColorStop(0, '#4a2f20');
    backHair.addColorStop(0.6, '#321d12');
    backHair.addColorStop(1, '#24140c');
    ctx.fillStyle = backHair;
    // Left & right soft shoulder-length hair locks behind neck
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.34, r * 0.18, r * 0.18, r * 0.38, side * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });
    // Crown volume behind upper head only
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.14, r * 0.45, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- SHOULDERS & REALISTIC FABRIC OUTFIT ---
    ctx.save();
    ctx.rotate(-s.tilt); // Keep shoulders level while head tilts expressively!
    // Soft cotton cream undershirt
    const shirtGrad = ctx.createLinearGradient(0, r * 0.38, 0, r * 0.98);
    shirtGrad.addColorStop(0, '#f6efe4');
    shirtGrad.addColorStop(1, '#d4c8b5');
    ctx.fillStyle = shirtGrad;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.86, r * 0.68, r * 0.48, 0, Math.PI, 0, false);
    ctx.fill();

    // Chosen Builder Outfit straps & bib!
    if (this.outfitIndex >= 0) {
      const outfitColors = [
        { main: '#3c5a82', dark: '#273d5b', stitch: '#e0b354', button: '#d9a441' }, // Denim overalls
        { main: '#6f855d', dark: '#4e6140', stitch: '#dcd4be', button: '#8c6239' }, // Sage linen apron
        { main: '#a8523d', dark: '#7c3726', stitch: '#ebd0b3', button: '#c99b52' }, // Terracotta corduroy vest
      ];
      const oc = outfitColors[this.outfitIndex % 3];
      const bibG = ctx.createLinearGradient(-r * 0.4, r * 0.45, r * 0.4, r * 0.95);
      bibG.addColorStop(0, oc.main);
      bibG.addColorStop(1, oc.dark);
      ctx.fillStyle = bibG;
      ctx.beginPath();
      ctx.roundRect(-r * 0.36, r * 0.44, r * 0.16, r * 0.52, r * 0.04);
      ctx.roundRect( r * 0.20, r * 0.44, r * 0.16, r * 0.52, r * 0.04);
      ctx.roundRect(-r * 0.34, r * 0.62, r * 0.68, r * 0.40, r * 0.06);
      ctx.fill();

      ctx.strokeStyle = oc.stitch;
      ctx.setLineDash([2.5, 2.5]);
      ctx.lineWidth = 1.1;
      ctx.strokeRect(-r * 0.30, r * 0.66, r * 0.60, r * 0.30);
      ctx.setLineDash([]);

      [-r * 0.28, r * 0.28].forEach((bx) => {
        ctx.fillStyle = oc.button;
        ctx.beginPath();
        ctx.arc(bx, r * 0.67, r * 0.042, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Warm sunlit neck cleanly separating chin from shirt collar!
    const neckG = ctx.createLinearGradient(0, r * 0.31, 0, r * 0.55);
    neckG.addColorStop(0, '#d29e82');
    neckG.addColorStop(0.45, '#efc1a7');
    neckG.addColorStop(1, '#e4b59a');
    ctx.fillStyle = neckG;
    ctx.beginPath();
    ctx.roundRect(-r * 0.15, r * 0.30, r * 0.30, r * 0.25, r * 0.08);
    ctx.fill();
    ctx.restore();

    // Soft ears
    [-1, 1].forEach((side) => {
      ctx.fillStyle = side < 0 ? '#eab99e' : '#d6a286';
      ctx.beginPath();
      ctx.ellipse(side * r * 0.38, r * 0.02, r * 0.072, r * 0.105, side * -0.12, 0, Math.PI * 2);
      ctx.fill();
    });

    // Face shape: soft child oval with plump lower cheeks
    const skinKey = ctx.createRadialGradient(-r * 0.12, -r * 0.14, r * 0.05, 0, r * 0.02, r * 0.48);
    if (this.sunWarmth > 0.55) {
      // Warm golden lantern glow on skin at dusk/night
      skinKey.addColorStop(0, '#ffdfc4');
      skinKey.addColorStop(0.62, '#efb590');
      skinKey.addColorStop(1, '#c98864');
    } else {
      skinKey.addColorStop(0, '#fce0ce');
      skinKey.addColorStop(0.60, '#f1c3a8');
      skinKey.addColorStop(1, '#d59f83');
    }
    ctx.fillStyle = skinKey;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.42);
    ctx.bezierCurveTo(r * 0.38, -r * 0.42, r * 0.42, -r * 0.04, r * 0.37, r * 0.16);
    ctx.bezierCurveTo(r * 0.32, r * 0.32, r * 0.15, r * 0.40, 0, r * 0.40);
    ctx.bezierCurveTo(-r * 0.15, r * 0.40, -r * 0.32, r * 0.32, -r * 0.37, r * 0.16);
    ctx.bezierCurveTo(-r * 0.42, -r * 0.04, -r * 0.38, -r * 0.42, 0, -r * 0.42);
    ctx.closePath();
    ctx.fill();

    // Natural subsurface warm rosy cheek blush
    [-1, 1].forEach((side) => {
      const blush = ctx.createRadialGradient(side * r * 0.21, r * 0.11, 0, side * r * 0.21, r * 0.11, r * 0.15);
      blush.addColorStop(0, `rgba(232, 126, 112, ${0.26 + Math.max(0, s.smile) * 0.16})`);
      blush.addColorStop(1, 'rgba(232, 126, 112, 0)');
      ctx.fillStyle = blush;
      ctx.beginPath();
      ctx.arc(side * r * 0.21, r * 0.11, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- EYES (Natural human child scale, soft almond shape, chestnut iris, corneal catchlight) ---
    [-1, 1].forEach((side) => {
      const ex = side * r * 0.155;
      const ey = -r * 0.025;
      const ew = r * 0.088;
      const openFactor = Math.max(0.06, (1 - s.blink) * (1 - s.squint * 0.35));
      const eh = r * 0.056 * openFactor;

      // Soft upper socket shading
      const sock = ctx.createRadialGradient(ex, ey - r * 0.02, 0, ex, ey - r * 0.02, ew * 1.4);
      sock.addColorStop(0, 'rgba(165, 108, 84, 0.22)');
      sock.addColorStop(1, 'rgba(165, 108, 84, 0)');
      ctx.fillStyle = sock;
      ctx.beginPath();
      ctx.arc(ex, ey - r * 0.02, ew * 1.4, 0, Math.PI * 2);
      ctx.fill();

      if (openFactor > 0.14) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, ey, ew, eh, side * 0.04, 0, Math.PI * 2);
        ctx.clip();

        // Natural off-white sclera with upper lid shadow
        const scl = ctx.createLinearGradient(ex, ey - eh, ex, ey + eh);
        scl.addColorStop(0, '#d8cfc8');
        scl.addColorStop(0.35, '#f7f3ee');
        scl.addColorStop(1, '#ebe4dc');
        ctx.fillStyle = scl;
        ctx.fillRect(ex - ew, ey - eh, ew * 2, eh * 2);

        // Iris + dark limbal ring + pupil
        const ix = ex + s.gazeX * ew * 0.45;
        const iy = ey + s.gazeY * eh * 0.45;
        const ir = r * 0.050;
        const irisG = ctx.createRadialGradient(ix, iy + ir * 0.2, ir * 0.1, ix, iy, ir);
        irisG.addColorStop(0, '#180e08');
        irisG.addColorStop(0.45, '#593722');
        irisG.addColorStop(0.82, '#3a2214');
        irisG.addColorStop(1, '#1d110a');
        ctx.fillStyle = irisG;
        ctx.beginPath();
        ctx.arc(ix, iy, ir, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#0d0805';
        ctx.beginPath();
        ctx.arc(ix, iy, ir * 0.42, 0, Math.PI * 2);
        ctx.fill();

        // Natural sunlit window catchlight
        ctx.fillStyle = 'rgba(255, 252, 245, 0.92)';
        ctx.beginPath();
        ctx.arc(ix - ir * 0.28, iy - ir * 0.28, ir * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 242, 220, 0.45)';
        ctx.beginPath();
        ctx.arc(ix + ir * 0.24, iy + ir * 0.26, ir * 0.11, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // Soft upper lash line & subtle eyelid crease (warm espresso brown, never harsh black)
      ctx.strokeStyle = 'rgba(54, 32, 20, 0.78)';
      ctx.lineWidth = r * 0.020;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(ex, ey, ew * 1.02, eh, side * 0.04, Math.PI * 1.06, Math.PI * 1.94);
      ctx.stroke();

      // Natural feathered eyebrow
      const browLift = (side < 0 ? s.browL : s.browR) * r * 0.075;
      ctx.strokeStyle = 'rgba(68, 43, 28, 0.68)';
      ctx.lineWidth = r * 0.024;
      ctx.beginPath();
      ctx.moveTo(ex - side * ew * 0.85, ey - r * 0.095 - browLift * 0.6);
      ctx.quadraticCurveTo(ex, ey - r * 0.125 - browLift, ex + side * ew * 0.95, ey - r * 0.088 - browLift * 0.4);
      ctx.stroke();
    });

    // --- SOFT CHILD NOSE (Subtle highlight on tip + soft nostril shadows, no cartoon line!) ---
    const noseShadow = ctx.createRadialGradient(0, r * 0.095, 0, 0, r * 0.095, r * 0.075);
    noseShadow.addColorStop(0, 'rgba(172, 112, 86, 0.30)');
    noseShadow.addColorStop(1, 'rgba(172, 112, 86, 0)');
    ctx.fillStyle = noseShadow;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.098, r * 0.07, r * 0.042, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft nose tip highlight
    const noseTip = ctx.createRadialGradient(-r * 0.012, r * 0.062, 0, 0, r * 0.065, r * 0.042);
    noseTip.addColorStop(0, 'rgba(255, 245, 236, 0.55)');
    noseTip.addColorStop(1, 'rgba(255, 245, 236, 0)');
    ctx.fillStyle = noseTip;
    ctx.beginPath();
    ctx.arc(0, r * 0.065, r * 0.042, 0, Math.PI * 2);
    ctx.fill();

    // Tiny subtle nostrils
    [-1, 1].forEach((side) => {
      ctx.fillStyle = 'rgba(138, 82, 60, 0.38)';
      ctx.beginPath();
      ctx.ellipse(side * r * 0.032, r * 0.095, r * 0.014, r * 0.008, side * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- NATURAL TWO-TONED LIPS & EXPRESSIONS ---
    const my = r * 0.21;
    const mw = r * 0.125 * (1 - s.mouthO * 0.48 + Math.max(0, s.smile) * 0.18);
    const curve = s.smile * r * 0.065;
    const openH = s.mouthOpen * r * 0.085;

    if (s.mouthO > 0.45) {
      // Soft surprised / "あれ？" rounded mouth
      ctx.fillStyle = '#7a332e';
      ctx.beginPath();
      ctx.ellipse(0, my + r * 0.01, mw * 0.65, openH * 0.9 + r * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(216, 118, 108, 0.72)';
      ctx.lineWidth = r * 0.022;
      ctx.stroke();
    } else {
      if (openH > r * 0.015) {
        // Warm open smile interior + soft upper teeth hint
        ctx.fillStyle = '#7d342f';
        ctx.beginPath();
        ctx.moveTo(-mw, my - curve * 0.35);
        ctx.quadraticCurveTo(0, my + curve * 0.45, mw, my - curve * 0.35);
        ctx.quadraticCurveTo(0, my + curve + openH * 1.6, -mw, my - curve * 0.35);
        ctx.fill();

        if (s.smile > 0.4) {
          ctx.fillStyle = 'rgba(252, 248, 242, 0.88)';
          ctx.beginPath();
          ctx.ellipse(0, my + curve * 0.22, mw * 0.58, openH * 0.36, 0, 0, Math.PI);
          ctx.fill();
        }
      }

      // Soft upper lip & lower lip sheen
      ctx.strokeStyle = 'rgba(204, 104, 95, 0.82)';
      ctx.lineWidth = r * 0.024;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-mw, my - curve * 0.35);
      ctx.quadraticCurveTo(0, my + curve * 0.65, mw, my - curve * 0.35);
      ctx.stroke();

      // Moist lower lip highlight
      ctx.strokeStyle = 'rgba(255, 215, 208, 0.45)';
      ctx.lineWidth = r * 0.014;
      ctx.beginPath();
      ctx.moveTo(-mw * 0.45, my + curve * 0.42 + openH * 0.55);
      ctx.quadraticCurveTo(0, my + curve * 0.68 + openH * 0.75, mw * 0.45, my + curve * 0.42 + openH * 0.55);
      ctx.stroke();
    }

    // --- LAYERED NATURAL CHESTNUT HAIR BANGS & SIDE WISPS ---
    const hairTop = ctx.createLinearGradient(0, -r * 0.52, 0, -r * 0.05);
    hairTop.addColorStop(0, '#5a3a26');
    hairTop.addColorStop(0.5, '#3b2417');
    hairTop.addColorStop(1, '#28170e');
    ctx.fillStyle = hairTop;
    ctx.beginPath();
    ctx.moveTo(-r * 0.44, -r * 0.06);
    ctx.bezierCurveTo(-r * 0.46, -r * 0.48, r * 0.46, -r * 0.48, r * 0.44, -r * 0.06);
    // Soft parted natural fringe across forehead
    ctx.bezierCurveTo(r * 0.32, -r * 0.18, r * 0.16, -r * 0.14, r * 0.04, -r * 0.22);
    ctx.bezierCurveTo(-r * 0.08, -r * 0.13, -r * 0.28, -r * 0.16, -r * 0.44, -r * 0.06);
    ctx.closePath();
    ctx.fill();

    // Fine individual sunlit hair strands for realistic texture
    ctx.lineCap = 'round';
    for (let i = -9; i <= 9; i++) {
      const hx = (i / 9) * r * 0.36;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(138, 96, 64, 0.38)' : 'rgba(32, 18, 10, 0.42)';
      ctx.lineWidth = r * 0.015;
      ctx.beginPath();
      ctx.moveTo(hx * 0.6, -r * 0.44);
      ctx.quadraticCurveTo(hx * 1.05, -r * 0.28, hx, -r * 0.15 - Math.abs(i % 2) * r * 0.03);
      ctx.stroke();
    }

    // --- CHOSEN BUILDER HAT / CAP ON HER HEAD! ---
    if (this.outfitIndex === 0) {
      // Mustard canvas carpenter work cap
      const capG = ctx.createLinearGradient(0, -r * 0.58, 0, -r * 0.24);
      capG.addColorStop(0, '#e3ae48');
      capG.addColorStop(1, '#b57e22');
      ctx.fillStyle = capG;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.34, r * 0.44, r * 0.22, -0.04, Math.PI, 0);
      ctx.fill();
      // Visor brim
      ctx.fillStyle = '#9c6818';
      ctx.beginPath();
      ctx.ellipse(r * 0.04, -r * 0.33, r * 0.47, r * 0.075, -0.04, 0, Math.PI, true);
      ctx.fill();
    } else if (this.outfitIndex === 1) {
      // Woven natural straw sunhat with olive ribbon
      ctx.fillStyle = '#dfc58d';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.32, r * 0.56, r * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ead4a2';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.35, r * 0.38, r * 0.19, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#5e754c';
      ctx.lineWidth = r * 0.045;
      ctx.beginPath();
      ctx.moveTo(-r * 0.36, -r * 0.34);
      ctx.quadraticCurveTo(0, -r * 0.30, r * 0.36, -r * 0.34);
      ctx.stroke();
    } else if (this.outfitIndex === 2) {
      // Terracotta mason bandana / soft cap
      const bG = ctx.createLinearGradient(-r * 0.4, -r * 0.52, r * 0.4, -r * 0.25);
      bG.addColorStop(0, '#cf5544');
      bG.addColorStop(1, '#963427');
      ctx.fillStyle = bG;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.33, r * 0.45, r * 0.21, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(248, 226, 198, 0.45)';
      ctx.lineWidth = r * 0.02;
      ctx.beginPath();
      ctx.moveTo(-r * 0.38, -r * 0.36);
      ctx.quadraticCurveTo(0, -r * 0.41, r * 0.38, -r * 0.36);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawDadCameo(ctx, cx, cy, r) {
    this._drawWoodenMirrorFrame(ctx, cx, cy, r);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Warm sunlit background
    const bg = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    bg.addColorStop(0, this.sunWarmth > 0.6 ? '#2b385c' : '#9ab98f');
    bg.addColorStop(1, this.sunWarmth > 0.6 ? '#4a3828' : '#536e42');
    ctx.fillStyle = bg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    ctx.translate(cx, cy + r * 0.06);
    const s = this.dState;

    // Chambray work shirt shoulders
    ctx.fillStyle = '#56718a';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.86, r * 0.72, r * 0.48, 0, Math.PI, 0, false);
    ctx.fill();

    // Neck
    ctx.fillStyle = '#d4a184';
    ctx.beginPath();
    ctx.roundRect(-r * 0.19, r * 0.26, r * 0.38, r * 0.28, r * 0.06);
    ctx.fill();

    ctx.rotate(s.tilt);

    // Dad's natural dark-brown back/side hair & ears behind temples
    ctx.fillStyle = '#332015';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.14, r * 0.41, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    [-1, 1].forEach((side) => {
      ctx.fillStyle = '#d9a487';
      ctx.beginPath();
      ctx.ellipse(side * r * 0.38, r * 0.01, r * 0.068, r * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Warm fatherly jaw & oval face
    const skin = ctx.createRadialGradient(-r * 0.1, -r * 0.14, r * 0.04, 0, 0, r * 0.48);
    skin.addColorStop(0, '#f4cdb3');
    skin.addColorStop(0.65, '#e2b092');
    skin.addColorStop(1, '#c28b6d');
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.roundRect(-r * 0.36, -r * 0.40, r * 0.72, r * 0.78, [r * 0.34, r * 0.34, r * 0.30, r * 0.30]);
    ctx.fill();

    // Subtle 5-o'clock warm stubble shadow on chin
    const stub = ctx.createRadialGradient(0, r * 0.26, r * 0.04, 0, r * 0.24, r * 0.28);
    stub.addColorStop(0, 'rgba(92, 68, 56, 0.16)');
    stub.addColorStop(1, 'rgba(92, 68, 56, 0)');
    ctx.fillStyle = stub;
    ctx.beginPath();
    ctx.arc(0, r * 0.24, r * 0.26, 0, Math.PI * 2);
    ctx.fill();

    // Eyes & thicker warm eyebrows
    [-1, 1].forEach((side) => {
      const ex = side * r * 0.15;
      const ey = -r * 0.04;
      const ew = r * 0.078;
      const eh = r * 0.046 * Math.max(0.08, 1 - s.blink);

      ctx.fillStyle = '#f5f0ea';
      ctx.beginPath();
      ctx.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2);
      ctx.fill();

      if (eh > r * 0.01) {
        ctx.fillStyle = '#2d1b10';
        ctx.beginPath();
        ctx.arc(ex, ey, r * 0.038, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - r * 0.012, ey - r * 0.012, r * 0.011, 0, Math.PI * 2);
        ctx.fill();
      }

      const bLift = (side < 0 ? s.browL : s.browR) * r * 0.07;
      const slope = this.dadMood === 'sheepish' ? side * r * 0.045 : 0;
      ctx.strokeStyle = '#332015';
      ctx.lineWidth = r * 0.034;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - side * ew * 0.9, ey - r * 0.095 - bLift + slope);
      ctx.quadraticCurveTo(ex, ey - r * 0.12 - bLift, ex + side * ew * 0.9, ey - r * 0.09 - bLift - slope);
      ctx.stroke();
    });

    // Nose
    ctx.fillStyle = 'rgba(165, 105, 80, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.09, r * 0.068, r * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    const my = r * 0.21;
    if (s.mouthO > 0.45) {
      ctx.fillStyle = '#6e2c26';
      ctx.beginPath();
      ctx.ellipse(0, my, r * 0.075, r * 0.04 + s.mouthOpen * r * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const mw = r * 0.135;
      const c = s.smile * r * 0.055;
      ctx.strokeStyle = '#8f463d';
      ctx.lineWidth = r * 0.026;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-mw, my - c * 0.3);
      ctx.quadraticCurveTo(0, my + c, mw, my - c * 0.3);
      ctx.stroke();
    }

    // Short natural dark-brown hair
    ctx.fillStyle = '#2a1a11';
    ctx.beginPath();
    ctx.moveTo(-r * 0.38, -r * 0.10);
    ctx.bezierCurveTo(-r * 0.42, -r * 0.50, r * 0.42, -r * 0.50, r * 0.38, -r * 0.10);
    ctx.bezierCurveTo(r * 0.22, -r * 0.28, -r * 0.22, -r * 0.28, -r * 0.38, -r * 0.10);
    ctx.fill();

    //Tiny realistic sweat drop on temple when Dad panics/apologizes for tower crash!
    if (s.sweat > 0.2) {
      ctx.fillStyle = `rgba(190, 232, 255, ${0.75 * s.sweat})`;
      ctx.beginPath();
      ctx.moveTo(r * 0.28, -r * 0.18);
      ctx.quadraticCurveTo(r * 0.33, -r * 0.09, r * 0.28, -r * 0.06);
      ctx.quadraticCurveTo(r * 0.23, -r * 0.09, r * 0.28, -r * 0.18);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ============================================================================
// 2. LIFELIKE 3D CHILD'S HAND (Player's Finger Avatar with Matching Sleeve!)
// ============================================================================
export class ChildHand3D {
  constructor(materials) {
    this.materials = materials;
    this.group = new THREE.Group();
    this.group.visible = false;

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf0bfa4,
      roughness: 0.62,
      metalness: 0.01,
    });
    const nailMat = new THREE.MeshStandardMaterial({
      color: 0xf9ded2,
      roughness: 0.34,
      metalness: 0.02,
    });

    // Inner pivot angled naturally from foreground-bottom into the diorama
    this.pose = new THREE.Group();
    this.group.add(this.pose);

    // Sculpted dorsal palm
    const palmGeo = new RoundedBoxGeometry(0.42, 0.15, 0.46, 3, 0.065);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.castShadow = true;
    this.pose.add(palm);

    // 4 tapered rounded fingers (index, middle, ring, pinky)
    this.fingers = [];
    const fSpecs = [
      { x: -0.145, len: 0.30, r: 0.044 },
      { x: -0.048, len: 0.33, r: 0.046 },
      { x:  0.048, len: 0.30, r: 0.044 },
      { x:  0.140, len: 0.24, r: 0.039 },
    ];
    fSpecs.forEach((fs) => {
      const fg = new THREE.Group();
      fg.position.set(fs.x, 0.0, -0.21);
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(fs.r, fs.len * 0.62, 6, 10), skinMat);
      seg.rotation.x = Math.PI * 0.46;
      seg.position.set(0, -0.02, -fs.len * 0.46);
      seg.castShadow = true;
      fg.add(seg);

      // Subtle natural fingernail
      const nail = new THREE.Mesh(new THREE.BoxGeometry(fs.r * 1.15, 0.012, fs.r * 1.25), nailMat);
      nail.position.set(0, 0.012, -fs.len * 0.82);
      nail.rotation.x = 0.12;
      fg.add(nail);

      this.pose.add(fg);
      this.fingers.push(fg);
    });

    // Opposable thumb on left side (right hand reaching in)
    this.thumb = new THREE.Group();
    this.thumb.position.set(-0.21, -0.02, -0.04);
    this.thumb.rotation.y = 0.58;
    const tMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.18, 6, 10), skinMat);
    tMesh.rotation.x = Math.PI * 0.46;
    tMesh.position.set(0, -0.01, -0.13);
    tMesh.castShadow = true;
    this.thumb.add(tMesh);
    this.pose.add(this.thumb);

    // Coaxial Wrist + Rolled Cuff + Long Woven Sleeve anchored seamlessly at back of palm (ZERO gaps at any angle!)
    const armPivot = new THREE.Group();
    armPivot.position.set(0.02, 0.01, 0.18);
    armPivot.rotation.y = 0.22;
    armPivot.rotation.x = -0.06;

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.138, 0.26, 12), skinMat);
    wrist.rotation.x = Math.PI * 0.5;
    wrist.position.set(0, 0, 0.12);
    wrist.castShadow = true;
    armPivot.add(wrist);

    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(0.152, 0.026, 8, 18),
      new THREE.MeshStandardMaterial({ color: 0xf2e9da, roughness: 0.85 })
    );
    trim.position.set(0, 0, 0.24);
    armPivot.add(trim);

    this.cuffMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.156, 0.235, 3.6, 14, 1, false),
      materials.outfits[0].cloth
    );
    this.cuffMesh.rotation.x = Math.PI * 0.5;
    this.cuffMesh.position.set(0, 0, 2.02);
    this.cuffMesh.castShadow = true;
    armPivot.add(this.cuffMesh);

    this.pose.add(armPivot);

    // Held miniature block / seed preview underneath palm!
    this.heldAnchor = new THREE.Group();
    this.heldAnchor.position.set(0, -0.26, -0.22);
    this.pose.add(this.heldAnchor);

    this.targetPos = new THREE.Vector3(0, 2.2, 2.5);
    this.pressAmount = 0;
    this.active = false;
    this.demoTimer = 0;
  }

  setOutfit(index) {
    const outfit = this.materials.outfits[index % this.materials.outfits.length];
    this.cuffMesh.material = outfit.cloth;
    this.group.visible = true;
  }

  setHeldPreview(meshOrNull) {
    while (this.heldAnchor.children.length > 0) {
      this.heldAnchor.remove(this.heldAnchor.children[0]);
    }
    if (meshOrNull) {
      this.heldAnchor.add(meshOrNull);
    }
  }

  update(dt, isPressed) {
    if (!this.group.visible) return;
    this.group.position.lerp(this.targetPos, Math.min(1, dt * 16));
    this.pressAmount = lerp(this.pressAmount, isPressed ? 1 : 0, Math.min(1, dt * 14));

    // Natural dorsal top-down child's hand reaching from bottom-right foreground!
    this.group.scale.setScalar(1.18);
    this.pose.position.y = -this.pressAmount * 0.22;
    this.pose.rotation.y = 0.28;
    this.pose.rotation.x = -0.14 - this.pressAmount * 0.18;
    this.pose.rotation.z = -0.06 + (this.targetPos.x * -0.025);

    for (let i = 0; i < this.fingers.length; i++) {
      this.fingers[i].rotation.x = -0.10 - this.pressAmount * 0.34;
    }
    this.thumb.rotation.z = this.pressAmount * 0.28;
  }
}

// ============================================================================
// 3. 3D DAD'S ADULT HAND (Reaches in from right to stack the tall tower!)
// ============================================================================
export class DadHand3D {
  constructor(materials) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe3af92, roughness: 0.68 });
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.20, 0.62, 3, 0.08), skinMat);
    palm.castShadow = true;
    this.group.add(palm);

    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.26, 6, 8), skinMat);
      f.rotation.z = Math.PI * 0.45;
      f.position.set(-0.42, -0.04, -0.20 + i * 0.135);
      f.castShadow = true;
      this.group.add(f);
    }

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 1.1, 14),
      materials.matDadSleeve
    );
    sleeve.rotation.z = Math.PI * 0.48;
    sleeve.position.set(0.75, 0.06, 0);
    sleeve.castShadow = true;
    this.group.add(sleeve);

    this.targetPos = new THREE.Vector3(7, 3.5, 0);
  }

  update(dt) {
    if (!this.group.visible) return;
    this.group.position.lerp(this.targetPos, Math.min(1, dt * 10));
  }
}

// ============================================================================
// 4. PHOTOREALISTIC SQUARE SHEEP & SQUARE CHICKENS (Autonomous Flock)
// ============================================================================
export class AnimalManager {
  constructor(scene, materials, getGroundHeight, sound) {
    this.scene = scene;
    this.materials = materials;
    this.getGroundHeight = getGroundHeight;
    this.sound = sound;
    this.animals = [];

    this.woolBoxGeo = new RoundedBoxGeometry(0.62, 0.52, 0.74, 3, 0.09);
    this.woolPuffGeo = new RoundedBoxGeometry(0.32, 0.16, 0.32, 2, 0.06);
    this.sheepHeadGeo = new RoundedBoxGeometry(0.34, 0.32, 0.38, 3, 0.06);
    this.henBodyGeo = new RoundedBoxGeometry(0.36, 0.36, 0.42, 3, 0.07);
    this.henWingGeo = new RoundedBoxGeometry(0.08, 0.22, 0.28, 2, 0.03);

    this.muzzleMat = new THREE.MeshStandardMaterial({ color: 0x5d493c, roughness: 0.78 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x18120e, roughness: 0.22 });
    this.combMat = new THREE.MeshStandardMaterial({ color: 0xc92c2c, roughness: 0.55 });
    this.beakMat = new THREE.MeshStandardMaterial({ color: 0xe39e2b, roughness: 0.45 });
  }

  spawnAnimal(kind = 'sheep', spawnPos = null) {
    if (this.animals.length >= 9) return null;
    const g = new THREE.Group();

    if (kind === 'sheep') {
      // Photorealistic wooly square body + top fleece cap
      const body = new THREE.Mesh(this.woolBoxGeo, this.materials.matWool);
      body.position.y = 0.42;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const topFleece = new THREE.Mesh(this.woolPuffGeo, this.materials.matWool);
      topFleece.position.set(0, 0.68, 0.05);
      topFleece.castShadow = true;
      g.add(topFleece);

      // Head pivot so sheep can tilt head for "あれ？" and dip down to graze!
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.54, 0.38);
      const head = new THREE.Mesh(this.sheepHeadGeo, this.muzzleMat);
      head.position.z = 0.10;
      head.castShadow = true;
      headPivot.add(head);

      const woolCrown = new THREE.Mesh(
        new RoundedBoxGeometry(0.36, 0.14, 0.30, 2, 0.05),
        this.materials.matWool
      );
      woolCrown.position.set(0, 0.15, 0.08);
      headPivot.add(woolCrown);

      // Floppy ears + dark eyes
      [-1, 1].forEach((s) => {
        const ear = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.07, 0.10, 2, 0.02), this.muzzleMat);
        ear.position.set(s * 0.22, 0.04, 0.06);
        ear.rotation.z = s * -0.35;
        headPivot.add(ear);

        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), this.eyeMat);
        eye.position.set(s * 0.13, 0.04, 0.28);
        headPivot.add(eye);
      });
      g.add(headPivot);

      // 4 sturdy square legs
      const legs = [];
      [[-0.18, -0.22], [0.18, -0.22], [-0.18, 0.22], [0.18, 0.22]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.26, 0.11, 2, 0.02), this.muzzleMat);
        leg.position.set(lx, 0.13, lz);
        leg.castShadow = true;
        g.add(leg);
        legs.push(leg);
      });

      g.userData.headPivot = headPivot;
      g.userData.legs = legs;
      g.userData.body = body;
    } else {
      // Photorealistic feathered Square Chicken
      const body = new THREE.Mesh(this.henBodyGeo, this.materials.matFeather);
      body.position.y = 0.30;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.46, 0.16);
      const head = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.24, 0.24, 2, 0.05), this.materials.matFeather);
      head.castShadow = true;
      headPivot.add(head);

      const comb = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.10, 0.15, 2, 0.02), this.combMat);
      comb.position.set(0, 0.15, 0.01);
      headPivot.add(comb);

      const beak = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.06, 0.11, 1, 0.01), this.beakMat);
      beak.position.set(0, -0.01, 0.15);
      headPivot.add(beak);

      [-1, 1].forEach((s) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), this.eyeMat);
        eye.position.set(s * 0.11, 0.03, 0.08);
        headPivot.add(eye);

        const wing = new THREE.Mesh(this.henWingGeo, this.materials.matFeather);
        wing.position.set(s * 0.20, 0.31, -0.02);
        wing.castShadow = true;
        g.add(wing);
      });
      g.add(headPivot);

      const legs = [];
      [-0.08, 0.08].forEach((lx) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), this.beakMat);
        leg.position.set(lx, 0.08, 0.0);
        g.add(leg);
        legs.push(leg);
      });

      g.userData.headPivot = headPivot;
      g.userData.legs = legs;
      g.userData.body = body;
    }

    const start = spawnPos || new THREE.Vector3(-4.6 + Math.random() * 1.2, 0, 1.2 + Math.random() * 2.0);
    start.y = this.getGroundHeight(start.x, start.z);
    g.position.copy(start);
    this.scene.add(g);

    const a = {
      kind,
      group: g,
      pos: start.clone(),
      target: new THREE.Vector3(-1.2 + (Math.random() - 0.5) * 2.6, 0, 1.5 + (Math.random() - 0.5) * 1.4),
      waitTimer: 0.4 + Math.random() * 1.2,
      hopPhase: Math.random() * Math.PI * 2,
      fluffScale: 1.0,
      huhTimer: 0,
      joyTimer: 0,
      perchY: 0,
      sleepy: false,
    };
    this.animals.push(a);
    this.sound.playAnimal(kind, false);
    return a;
  }

  // Triggered when player taps an animal or gives it an item!
  interactWithAnimal(animal, heldItemType, onWrongItemHuh) {
    if (!animal) return;
    if (!heldItemType || heldItemType === 'seed' || heldItemType === 'crop') {
      // Yummy crop or gentle pet! Grow slightly fluffier & hop with joy!
      animal.fluffScale = Math.min(1.32, animal.fluffScale + 0.08);
      animal.joyTimer = 1.4;
      this.sound.playAnimal(animal.kind, true);
    } else {
      // Given Stone / Wood / Earth / Grass instead of food!
      // "違う物を渡すと相手は「あれ？」の顔→喜ぶ"
      animal.huhTimer = 0.62;
      setTimeout(() => {
        animal.joyTimer = 1.6;
        this.sound.playAnimal(animal.kind, true);
      }, 600);
      if (onWrongItemHuh) onWrongItemHuh(animal);
    }
  }

  scareSlightlyFromCrash(crashCenter) {
    this.animals.forEach((a) => {
      const dir = a.pos.clone().sub(crashCenter);
      dir.y = 0;
      if (dir.lengthSq() < 0.01) dir.set(-1, 0, 1);
      dir.normalize();
      a.target.copy(a.pos).addScaledVector(dir, 1.6);
      a.target.x = Math.max(-4.2, Math.min(3.5, a.target.x));
      a.target.z = Math.max(-0.5, Math.min(3.4, a.target.z));
      a.waitTimer = 0;
      a.joyTimer = 0.6;
    });
  }

  update(dt, cropTargets = [], nightFactor = 0) {
    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      const g = a.group;
      const hp = g.userData.headPivot;

      // Smoothly scale wool/plumage puffiness
      g.userData.body.scale.lerp(
        new THREE.Vector3(a.fluffScale, a.fluffScale, a.fluffScale),
        Math.min(1, dt * 6)
      );

      if (a.huhTimer > 0) {
        // Comical head-tilt "あれ？" pose!
        a.huhTimer -= dt;
        hp.rotation.z = lerp(hp.rotation.z, 0.52, Math.min(1, dt * 12));
        hp.rotation.x = lerp(hp.rotation.x, -0.22, Math.min(1, dt * 12));
        continue;
      }

      if (a.joyTimer > 0) {
        a.joyTimer -= dt;
        hp.rotation.z = lerp(hp.rotation.z, 0, Math.min(1, dt * 10));
        hp.rotation.x = Math.sin(a.joyTimer * 18) * 0.22;
        const jump = Math.abs(Math.sin(a.joyTimer * 11)) * 0.28;
        const gy = this.getGroundHeight(a.pos.x, a.pos.z) + a.perchY;
        g.position.set(a.pos.x, gy + jump, a.pos.z);
        continue;
      }

      hp.rotation.z = lerp(hp.rotation.z, 0, Math.min(1, dt * 8));

      // Cozy night resting near the warm house windows!
      if (nightFactor > 0.72) {
        a.target.set(-1.5 + (i % 3) * 0.95, 0, 0.85 + Math.floor(i / 3) * 0.75);
      }

      const dx = a.target.x - a.pos.x;
      const dz = a.target.z - a.pos.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.14) {
        const speed = (a.kind === 'sheep' ? 0.95 : 1.25) * (nightFactor > 0.75 ? 0.55 : 1.0);
        a.pos.x += (dx / dist) * speed * dt;
        a.pos.z += (dz / dist) * speed * dt;
        a.hopPhase += dt * (a.kind === 'sheep' ? 9 : 14);

        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - g.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        g.rotation.y += diff * Math.min(1, dt * 7);

        const hop = Math.abs(Math.sin(a.hopPhase)) * (a.kind === 'sheep' ? 0.08 : 0.06);
        const gy = this.getGroundHeight(a.pos.x, a.pos.z);
        g.position.set(a.pos.x, gy + hop, a.pos.z);

        const legs = g.userData.legs;
        for (let l = 0; l < legs.length; l++) {
          legs[l].rotation.x = Math.sin(a.hopPhase + (l % 2) * Math.PI) * 0.45;
        }
        hp.rotation.x = lerp(hp.rotation.x, 0.05, Math.min(1, dt * 6));
      } else {
        const gy = this.getGroundHeight(a.pos.x, a.pos.z);
        g.position.y = lerp(g.position.y, gy, Math.min(1, dt * 8));
        // Graze / peck gently while waiting
        hp.rotation.x = nightFactor > 0.78
          ? lerp(hp.rotation.x, 0.28, Math.min(1, dt * 3))
          : 0.25 + Math.sin(performance.now() * 0.008 + i) * 0.18;

        a.waitTimer -= dt;
        if (a.waitTimer <= 0 && nightFactor < 0.72) {
          a.waitTimer = 1.8 + Math.random() * 2.8;
          if (cropTargets.length > 0 && Math.random() < 0.72) {
            const pick = cropTargets[(Math.random() * cropTargets.length) | 0];
            a.target.set(
              pick.x + (Math.random() - 0.5) * 0.9,
              0,
              pick.z + (Math.random() - 0.5) * 0.9
            );
          } else {
            a.target.set(-3.2 + Math.random() * 5.2, 0, 0.6 + Math.random() * 2.6);
          }
        }
      }
    }
  }
}

import * as THREE from 'three';

// All procedural textures <= 512px or 1024px max for fast mobile GPU performance

export function createStudioRimEnvironment(renderer) {
  // Equirectangular dark-field beverage commercial studio HDRI (1024x512 Float DataTexture)
  // Pitch black studio + 1 strong overhead-back Rim Softbox + 2 razor thin edge strip reflectors + warm bokeh bulbs
  const width = 512;
  const height = 256;
  const data = new Float32Array(width * height * 4);

  const bokehSpots = [
    { u: 0.44, v: 0.54, r: 0.022, col: [4.5, 2.6, 0.9] },
    { u: 0.56, v: 0.52, r: 0.018, col: [4.2, 2.1, 0.7] },
    { u: 0.37, v: 0.48, r: 0.016, col: [3.6, 2.4, 1.1] },
    { u: 0.63, v: 0.50, r: 0.020, col: [4.8, 2.8, 1.0] },
    { u: 0.50, v: 0.45, r: 0.015, col: [3.8, 1.9, 0.8] },
  ];

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1); // 0 bottom -> 1 top in DataTexture flipY=false
    const theta = (1.0 - v) * Math.PI; // 0 zenith, PI nadir
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      // Base studio pitch-black dark-field (zero muddy grey!)
      let r = 0.0015;
      let g = 0.0015;
      let b = 0.0025;

      // 1) Primary Studio 1-Light Overhead-Back Rim Softbox (at u=0.38 off-axis so no center pole reflection!)
      const duRim = Math.abs(((u - 0.38 + 1.5) % 1.0) - 0.5);
      const dvRim = Math.abs(v - 0.78);
      if (duRim < 0.13 && dvRim < 0.13) {
        const fx = Math.pow(Math.max(0, 1 - duRim / 0.13), 2.0);
        const fy = Math.pow(Math.max(0, 1 - dvRim / 0.13), 2.0);
        const rimIntensity = fx * fy * 11.5;
        r += rimIntensity * 1.0;
        g += rimIntensity * 0.97;
        b += rimIntensity * 0.92;
      }

      // 2) Asymmetric studio grazing edge strip-boxes (u=0.06 and u=0.93 -> hug outer left/right glass silhouettes!)
      const dStripL = Math.min(Math.abs(u - 0.065), Math.abs(u - 1.065));
      const dStripR = Math.abs(u - 0.935);
      const vMask = v > 0.22 && v < 0.88 ? Math.sin(((v - 0.22) / 0.66) * Math.PI) : 0;
      if (dStripL < 0.018) {
        const s = Math.pow(1 - dStripL / 0.018, 1.8) * vMask * 10.5;
        r += s * 0.98;
        g += s * 0.99;
        b += s * 1.0;
      }
      if (dStripR < 0.022) {
        const s = Math.pow(1 - dStripR / 0.022, 1.8) * vMask * 12.5;
        r += s * 1.0;
        g += s * 0.96;
        b += s * 0.90;
      }

      // 3) Crisp overhead rim ring for polished crystal glass lips
      if (v > 0.90) {
        const topGlow = Math.pow((v - 0.90) / 0.10, 2.2) * 4.2;
        r += topGlow;
        g += topGlow * 0.98;
        b += topGlow * 0.96;
      }

      // 4) Warm party bokeh glints reflected in glass curves
      for (let k = 0; k < bokehSpots.length; k++) {
        const sp = bokehSpots[k];
        const dx = (u - sp.u) * 2.0;
        const dy = v - sp.v;
        const d = Math.hypot(dx, dy);
        if (d < sp.r) {
          const w = Math.pow(1 - d / sp.r, 1.8) * 0.55;
          r += sp.col[0] * w;
          g += sp.col[1] * w;
          b += sp.col[2] * w;
        }
      }

      // Very dark counter floor so empty upper glass stays crystal-transparent black
      if (theta > Math.PI * 0.65) {
        r += 0.004;
        g += 0.003;
        b += 0.002;
      }

      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 1.0;
    }
  }

  const eqTex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  eqTex.mapping = THREE.EquirectangularReflectionMapping;
  eqTex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(eqTex);
  eqTex.dispose();
  pmrem.dispose();
  return envRT.texture;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createCounterTextures() {
  // Rich dark oiled walnut / slate bar counter with fine grain and subtle wet sheen
  const w = 512, h = 512;
  const colC = makeCanvas(w, h);
  const ctx = colC.getContext('2d');
  ctx.fillStyle = '#140e0b';
  ctx.fillRect(0, 0, w, h);

  // Subtle organic dark walnut grain streaks
  for (let i = 0; i < 240; i++) {
    const y = Math.random() * h;
    const thick = 1 + Math.random() * 5;
    const lum = 14 + Math.floor(Math.random() * 14);
    ctx.strokeStyle = `rgba(${lum + 8}, ${lum + 2}, ${lum - 2}, 0.22)`;
    ctx.lineWidth = thick;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.33, y + (Math.random() - 0.5) * 14, w * 0.66, y + (Math.random() - 0.5) * 14, w, y + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }

  const roughC = makeCanvas(w, h);
  const rctx = roughC.getContext('2d');
  rctx.fillStyle = '#383838'; // ~0.22 roughness polished dark bar surface for luscious glass reflection!
  rctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rad = 8 + Math.random() * 34;
    const grad = rctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(20,20,20,0.35)');
    grad.addColorStop(1, 'rgba(56,56,56,0)');
    rctx.fillStyle = grad;
    rctx.beginPath();
    rctx.arc(x, y, rad, 0, Math.PI * 2);
    rctx.fill();
  }

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  return { map, roughnessMap };
}

export function createGlassCondensationBump() {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  // Hundreds of tiny micro-condensation mist droplets
  for (let i = 0; i < 550; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 0.7 + Math.pow(Math.random(), 2.2) * 3.4;
    const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.7, '#b0b0b0');
    grad.addColorStop(1, '#808080');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

export function createFabricTexture(style = 'berry') {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  if (style === 'berry') {
    ctx.fillStyle = '#9e1c2f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,220,220,0.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i < w; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }
  } else if (style === 'citrus') {
    ctx.fillStyle = '#d98c1e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,244,214,0.34)';
    for (let i = 0; i < w; i += 24) {
      ctx.fillRect(i, 0, 9, h);
    }
  } else {
    ctx.fillStyle = '#2d8a6e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(225,255,245,0.22)';
    for (let y = 12; y < h; y += 28) {
      for (let x = 12; x < w; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Fine linen cross-weave micrograin
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createFruitTextures() {
  // 1) Strawberry outer skin with sunken golden achenes
  const sbSkinC = makeCanvas(256, 256);
  const sbBumpC = makeCanvas(256, 256);
  {
    const ctx = sbSkinC.getContext('2d');
    const bctx = sbBumpC.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#e82838');
    grad.addColorStop(0.55, '#c81224');
    grad.addColorStop(1, '#8c0a18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    bctx.fillStyle = '#909090';
    bctx.fillRect(0, 0, 256, 256);

    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 14; col++) {
        const x = ((col + (row % 2) * 0.5) / 14) * 256;
        const y = ((row + 0.5) / 14) * 256;
        // Sunken dimple
        const bg = bctx.createRadialGradient(x, y, 1, x, y, 8);
        bg.addColorStop(0, '#282828');
        bg.addColorStop(0.6, '#606060');
        bg.addColorStop(1, '#909090');
        bctx.fillStyle = bg;
        bctx.beginPath(); bctx.arc(x, y, 8, 0, Math.PI * 2); bctx.fill();

        // Dark dimple halo + golden seed
        ctx.fillStyle = 'rgba(70,0,8,0.42)';
        ctx.beginPath(); ctx.ellipse(x, y, 3.6, 5.0, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e7be52';
        ctx.beginPath(); ctx.ellipse(x, y, 1.5, 2.7, 0.1, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // 2) Strawberry sliced interior cross-section (vascular white core + juicy ruby border)
  const sbCutC = makeCanvas(256, 256);
  {
    const ctx = sbCutC.getContext('2d');
    const cx = 128, cy = 128;
    const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 124);
    g.addColorStop(0.0, '#fff5f2');
    g.addColorStop(0.24, '#ffd2cc');
    g.addColorStop(0.48, '#f0434f');
    g.addColorStop(0.84, '#cc1426');
    g.addColorStop(1.0, '#9e0d1c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,238,235,0.45)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
      ctx.quadraticCurveTo(
        cx + Math.cos(a + 0.12) * 65,
        cy + Math.sin(a + 0.12) * 65,
        cx + Math.cos(a) * 112,
        cy + Math.sin(a) * 112
      );
      ctx.stroke();
    }
  }

  // 3) Citrus wheel cross-section (Orange & Lemon reusable generator)
  const makeCitrusWheel = (rindCol, pulpInner, pulpOuter, vesCol) => {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    const cx = 128, cy = 128;
    ctx.fillStyle = rindCol;
    ctx.fillRect(0, 0, 256, 256);
    // White pith
    ctx.fillStyle = '#fff8ea';
    ctx.beginPath(); ctx.arc(cx, cy, 116, 0, Math.PI * 2); ctx.fill();
    // Juicy segments
    const segs = 10;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2 + 0.035;
      const a1 = ((s + 1) / segs) * Math.PI * 2 - 0.035;
      const rg = ctx.createRadialGradient(cx, cy, 12, cx, cy, 108);
      rg.addColorStop(0, pulpInner);
      rg.addColorStop(1, pulpOuter);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos((a0 + a1) * 0.5) * 10, cy + Math.sin((a0 + a1) * 0.5) * 10);
      ctx.arc(cx, cy, 107, a0, a1);
      ctx.closePath();
      ctx.fill();

      // Vesicle streaks
      ctx.strokeStyle = vesCol;
      ctx.lineWidth = 1.4;
      for (let j = 0; j < 14; j++) {
        const aa = a0 + Math.random() * (a1 - a0);
        const r0 = 18 + Math.random() * 55;
        const r1 = r0 + 16 + Math.random() * 24;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(aa) * r0, cy + Math.sin(aa) * r0);
        ctx.lineTo(cx + Math.cos(aa) * Math.min(104, r1), cy + Math.sin(aa) * Math.min(104, r1));
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  // 4) Sliced Emerald Kiwi cross-section
  const kiwiC = makeCanvas(256, 256);
  {
    const ctx = kiwiC.getContext('2d');
    const cx = 128, cy = 128;
    ctx.fillStyle = '#6b4e2e';
    ctx.fillRect(0, 0, 256, 256);
    const rg = ctx.createRadialGradient(cx, cy, 12, cx, cy, 118);
    rg.addColorStop(0.0, '#f4fae1');
    rg.addColorStop(0.24, '#e6f5be');
    rg.addColorStop(0.36, '#65c42f');
    rg.addColorStop(0.86, '#3b9c1e');
    rg.addColorStop(1.0, '#5a4728');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(cx, cy, 122, 0, Math.PI * 2); ctx.fill();

    // Pale starburst rays + tiny glossy black kiwi seeds
    ctx.strokeStyle = 'rgba(235,255,205,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
      ctx.lineTo(cx + Math.cos(a) * 102, cy + Math.sin(a) * 102);
      ctx.stroke();

      const sr = 42 + (i % 3) * 8;
      const sx = cx + Math.cos(a + 0.04) * sr;
      const sy = cy + Math.sin(a + 0.04) * sr;
      ctx.fillStyle = '#141210';
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // 5) Mango/Pineapple juicy fibrous chunk texture
  const mangoC = makeCanvas(256, 256);
  {
    const ctx = mangoC.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#ffca28');
    g.addColorStop(0.5, '#f5a614');
    g.addColorStop(1, '#e6890b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,245,190,0.28)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(128, y + (Math.random() - 0.5) * 18, 256, y + (Math.random() - 0.5) * 12);
      ctx.stroke();
    }
  }

  const sbSkin = new THREE.CanvasTexture(sbSkinC);
  sbSkin.colorSpace = THREE.SRGBColorSpace;
  const sbBump = new THREE.CanvasTexture(sbBumpC);
  const sbCut = new THREE.CanvasTexture(sbCutC);
  sbCut.colorSpace = THREE.SRGBColorSpace;
  const kiwiCut = new THREE.CanvasTexture(kiwiC);
  kiwiCut.colorSpace = THREE.SRGBColorSpace;
  const mangoTex = new THREE.CanvasTexture(mangoC);
  mangoTex.colorSpace = THREE.SRGBColorSpace;

  return {
    strawberrySkin: sbSkin,
    strawberryBump: sbBump,
    strawberryCut: sbCut,
    orangeWheel: makeCitrusWheel('#f06d0e', '#ffb636', '#eb6a0e', 'rgba(255,232,165,0.42)'),
    lemonWheel: makeCitrusWheel('#ebd41c', '#fff799', '#e5cc1e', 'rgba(255,255,235,0.52)'),
    kiwiCut,
    mangoTex,
  };
}

// Pure pictorial wooden menu board texture (ZERO text, ZERO letters, ZERO numbers, ZERO arrows!)
export function createPictorialSignTexture() {
  const c = makeCanvas(512, 384);
  const ctx = c.getContext('2d');

  // Rich dark chalkboard slate background
  const bg = ctx.createLinearGradient(0, 0, 0, 384);
  bg.addColorStop(0, '#181a1e');
  bg.addColorStop(1, '#101215');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 384);

  // Warm painted border line (no letters!)
  ctx.strokeStyle = 'rgba(245, 212, 150, 0.45)';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 476, 348);

  // Subtle decorative divider dots between the 3 visual vignettes (no arrows!)
  const drawDots = (x) => {
    ctx.fillStyle = 'rgba(255, 224, 170, 0.45)';
    [172, 192, 212].forEach((y) => {
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    });
  };
  drawDots(176);
  drawDots(336);

  // Panel 1 (left): Whole fruits dropping into a glass blender jar
  // Strawberry & Orange above blender
  ctx.fillStyle = '#e83042';
  ctx.beginPath(); ctx.arc(76, 78, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#48b838';
  ctx.beginPath(); ctx.ellipse(76, 58, 10, 5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#f5921d';
  ctx.beginPath(); ctx.arc(114, 92, 16, 0, Math.PI * 2); ctx.fill();

  // Blender jar illustration
  ctx.strokeStyle = 'rgba(230,245,255,0.8)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(58, 132); ctx.lineTo(132, 132);
  ctx.lineTo(122, 245); ctx.lineTo(68, 245);
  ctx.closePath();
  ctx.stroke();
  // Swirled juice + foam in blender
  ctx.fillStyle = '#ef5340';
  ctx.beginPath();
  ctx.moveTo(64, 175); ctx.lineTo(126, 175);
  ctx.lineTo(120, 242); ctx.lineTo(70, 242);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe5dc';
  ctx.fillRect(63, 162, 64, 14);
  // Blender base + big round button
  ctx.fillStyle = '#3c4048';
  ctx.fillRect(62, 248, 66, 56);
  ctx.fillStyle = '#ff5c5c';
  ctx.beginPath(); ctx.arc(95, 276, 13, 0, Math.PI * 2); ctx.fill();

  // Panel 2 (center): Tilted pitcher pouring rainbow layers into glass
  // Tilted mini carafe
  ctx.save();
  ctx.translate(232, 92);
  ctx.rotate(0.55);
  ctx.fillStyle = '#4cb828';
  ctx.fillRect(-18, -12, 36, 26);
  ctx.strokeStyle = 'rgba(235,248,255,0.85)';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(-20, -18, 40, 34);
  ctx.restore();
  // Pouring stream
  ctx.strokeStyle = '#4cb828';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(252, 106); ctx.lineTo(256, 168); ctx.stroke();

  // Rainbow glass
  ctx.fillStyle = '#e0243c';
  ctx.fillRect(222, 256, 68, 44);
  ctx.fillStyle = '#f5a81c';
  ctx.fillRect(220, 212, 72, 44);
  ctx.fillStyle = '#4cb828';
  ctx.fillRect(218, 172, 76, 40);
  ctx.strokeStyle = 'rgba(240,250,255,0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(214, 152); ctx.lineTo(298, 152);
  ctx.lineTo(288, 302); ctx.lineTo(224, 302);
  ctx.closePath();
  ctx.stroke();

  // Panel 3 (right): Topped rainbow glass with cherry, orange slice, striped straw & cheers sparkles!
  // Straw
  ctx.strokeStyle = '#ff6b88';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(430, 165); ctx.lineTo(448, 86); ctx.lineTo(470, 78);
  ctx.stroke();
  // Orange wheel on rim
  ctx.fillStyle = '#f5921d';
  ctx.beginPath(); ctx.arc(386, 150, 20, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff3d1';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Finished rainbow cup
  ctx.fillStyle = '#6c35bd';
  ctx.fillRect(390, 256, 66, 44);
  ctx.fillStyle = '#f5b21d';
  ctx.fillRect(388, 212, 70, 44);
  ctx.fillStyle = '#e82c42';
  ctx.fillRect(386, 170, 74, 42);
  ctx.fillStyle = '#fff5ee';
  ctx.fillRect(385, 154, 76, 16);
  // Cherry on top
  ctx.fillStyle = '#b80c24';
  ctx.beginPath(); ctx.arc(422, 145, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4fa832';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(422, 133); ctx.quadraticCurveTo(428, 108, 442, 102); ctx.stroke();

  ctx.strokeStyle = 'rgba(240,250,255,0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(382, 152); ctx.lineTo(464, 152);
  ctx.lineTo(454, 302); ctx.lineTo(392, 302);
  ctx.closePath();
  ctx.stroke();

  // Warm cheers star glints
  const drawStar = (sx, sy, sr) => {
    ctx.fillStyle = '#ffe28a';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? sr : sr * 0.32;
      const a = (i / 8) * Math.PI * 2;
      if (i === 0) ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      else ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  };
  drawStar(374, 96, 11);
  drawStar(478, 118, 9);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

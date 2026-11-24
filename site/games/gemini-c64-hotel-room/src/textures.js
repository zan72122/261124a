import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fast smooth anisotropic tileable noise (separate gridX, gridY so wood fibers stretch naturally!)
function createAnisoNoise(gridX, gridY, seed) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(gridX * gridY);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  return function sample(u, v) {
    const x = (((u % 1) + 1) % 1) * gridX;
    const y = (((v % 1) + 1) % 1) * gridY;
    const x0 = Math.floor(x) % gridX;
    const y0 = Math.floor(y) % gridY;
    const x1 = (x0 + 1) % gridX;
    const y1 = (y0 + 1) % gridY;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = grid[y0 * gridX + x0];
    const n10 = grid[y0 * gridX + x1];
    const n01 = grid[y1 * gridX + x0];
    const n11 = grid[y1 * gridX + x1];
    return (n00 + (n10 - n00) * sx) * (1 - sy) + (n01 + (n11 - n01) * sx) * sy;
  };
}

function heightToNormalTexture(height, size, strength = 2.2, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (height[y * size + xp] - height[y * size + xm]) * strength;
      const dy = (height[yp * size + x] - height[ym * size + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const inv = 1.0 / Math.hypot(nx, ny, nz);
      const idx = (y * size + x) * 4;
      d[idx] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function configureColorTex(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function configureLinearTex(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// 1. High-Thread-Count White Hotel Percale Linen (1024x1024)
export function createLinenTextureSet(repeat = 12) {
  const size = 1024;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const colCtx = colCanvas.getContext('2d');
  const colImg = colCtx.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(size, size);

  const height = new Float32Array(size * size);
  const nMacro = createAnisoNoise(16, 16, 303);
  const nSlubX = createAnisoNoise(24, 192, 404);
  const nSlubY = createAnisoNoise(192, 24, 505);

  const threads = 136;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const warpPhase = Math.abs(Math.sin(u * Math.PI * threads));
      const weftPhase = Math.abs(Math.sin(v * Math.PI * threads));
      const overUnder = Math.sin(u * Math.PI * threads) * Math.sin(v * Math.PI * threads) > 0;

      const slubW = Math.pow(nSlubX(u, v), 2.2) * 0.26;
      const slubF = Math.pow(nSlubY(u, v), 2.2) * 0.26;
      const macro = nMacro(u, v);

      const weaveH = 0.46 + (overUnder ? warpPhase * 0.24 : weftPhase * 0.22) + slubW + slubF + (macro - 0.5) * 0.10;
      height[idx] = weaveH;

      const shade = 0.925 + (weaveH - 0.55) * 0.08 - (slubW + slubF) * 0.03;
      colImg.data[p4] = Math.min(255, Math.round(247 * shade + macro * 4));
      colImg.data[p4 + 1] = Math.min(255, Math.round(244 * shade + macro * 3));
      colImg.data[p4 + 2] = Math.min(255, Math.round(238 * shade + macro * 1));
      colImg.data[p4 + 3] = 255;

      const rv = Math.min(255, Math.max(155, Math.round((0.82 + (0.65 - weaveH) * 0.16) * 255)));
      roughImg.data[p4] = rv;
      roughImg.data[p4 + 1] = rv;
      roughImg.data[p4 + 2] = rv;
      roughImg.data[p4 + 3] = 255;
    }
  }
  colCtx.putImageData(colImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  return {
    map: configureColorTex(colCanvas, repeat, repeat),
    roughnessMap: configureLinearTex(roughCanvas, repeat, repeat),
    normalMap: heightToNormalTexture(height, size, 2.6, repeat, repeat)
  };
}

// 2. Plush White Terry-Cloth Bath Towel Texture Set (512x512)
export function createTerryTowelTextureSet(repeat = 8) {
  const size = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const colCtx = colCanvas.getContext('2d');
  const colImg = colCtx.createImageData(size, size);

  const height = new Float32Array(size * size);
  const rand = mulberry32(777);
  const nSoft = createAnisoNoise(24, 24, 778);

  for (let i = 0; i < height.length; i++) {
    const u = (i % size) / size;
    const v = Math.floor(i / size) / size;
    height[i] = 0.34 + nSoft(u, v) * 0.18;
  }

  for (let k = 0; k < 18000; k++) {
    const cx = Math.floor(rand() * size);
    const cy = Math.floor(rand() * size);
    const amp = 0.25 + rand() * 0.36;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const d2 = (dx * dx) / 2.2 + (dy * dy) / 5.2;
        if (d2 <= 1.0) {
          const x = (cx + dx + size) % size;
          const y = (cy + dy + size) % size;
          height[y * size + x] = Math.min(1.0, height[y * size + x] + amp * (1 - d2));
        }
      }
    }
  }

  for (let i = 0; i < height.length; i++) {
    const h = height[i];
    const p4 = i * 4;
    const shade = 0.89 + h * 0.105;
    colImg.data[p4] = Math.min(255, Math.round(248 * shade));
    colImg.data[p4 + 1] = Math.min(255, Math.round(245 * shade));
    colImg.data[p4 + 2] = Math.min(255, Math.round(239 * shade));
    colImg.data[p4 + 3] = 255;
  }
  colCtx.putImageData(colImg, 0, 0);

  return {
    map: configureColorTex(colCanvas, repeat, repeat),
    normalMap: heightToNormalTexture(height, size, 3.4, repeat, repeat)
  };
}

// 3. Authentic Architectural Quarter-Sawn & Crown-Cut Wood Grain (1024x1024)
// High-aspect longitudinal fibers + fine vertical vessels + smooth satin cathedrals (zero blotches!)
export function createWoodTextureSet(variant = 'walnut', repeatX = 1, repeatY = 1) {
  const size = 1024;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const colCtx = colCanvas.getContext('2d');
  const colImg = colCtx.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(size, size);

  const height = new Float32Array(size * size);

  const palettes = {
    walnut: {
      base: [108, 72, 47],
      dark: [68, 42, 26],
      light: [136, 94, 63],
      rings: 9.0,
      seed: 910
    },
    oak: {
      base: [182, 142, 98],
      dark: [142, 104, 66],
      light: [206, 168, 124],
      rings: 11.0,
      seed: 950
    },
    lightOak: {
      base: [198, 162, 118],
      dark: [160, 124, 84],
      light: [220, 186, 144],
      rings: 10.0,
      seed: 990
    }
  };
  const pal = palettes[variant] || palettes.walnut;

  // Anisotropic noise: many columns across U, very smooth long sweep along vertical V!
  const nSweep = createAnisoNoise(10, 4, pal.seed + 1);
  const nFiber = createAnisoNoise(256, 12, pal.seed + 2);
  const nVessel = createAnisoNoise(320, 20, pal.seed + 3);
  const nPlank = createAnisoNoise(6, 2, pal.seed + 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      // Gentle vertical cathedral arch
      const sweep = (nSweep(u, v) - 0.5) * 0.14;
      const cathedral = Math.sin(u * Math.PI * 4.0 + sweep * 6.0) * 0.35 + Math.cos(v * Math.PI * 2.0) * 0.22;
      const ringVal = (u * pal.rings + cathedral + sweep * 2.2);
      const frac = ringVal - Math.floor(ringVal);
      // Smooth asymmetric earlywood/latewood transition
      const latewood = Math.pow(Math.sin(frac * Math.PI), 0.7);

      // Fine vertical wood fibers & micro-vessels
      const fiber = nFiber(u, v);
      const vesselRaw = nVessel(u, v);
      const vessel = vesselRaw > 0.80 ? (vesselRaw - 0.80) * 3.2 : 0.0;
      const toneShift = (nPlank(u, v) - 0.5) * 0.08;

      const h = 0.68 + latewood * 0.10 + (fiber - 0.5) * 0.12 - vessel * 0.38;
      height[idx] = h;

      const darkMix = (1 - latewood) * 0.52 + vessel * 0.45 + (0.5 - fiber) * 0.18;
      const lightMix = Math.max(0, latewood - 0.45) * 0.55 + toneShift;

      const r = pal.base[0] * (1 - darkMix) + pal.dark[0] * darkMix + (pal.light[0] - pal.base[0]) * lightMix;
      const g = pal.base[1] * (1 - darkMix) + pal.dark[1] * darkMix + (pal.light[1] - pal.base[1]) * lightMix;
      const b = pal.base[2] * (1 - darkMix) + pal.dark[2] * darkMix + (pal.light[2] - pal.base[2]) * lightMix;

      colImg.data[p4] = Math.max(0, Math.min(255, Math.round(r)));
      colImg.data[p4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
      colImg.data[p4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
      colImg.data[p4 + 3] = 255;

      const rough = 0.34 + (1 - latewood) * 0.10 + vessel * 0.30;
      const rv = Math.max(65, Math.min(230, Math.round(rough * 255)));
      roughImg.data[p4] = rv;
      roughImg.data[p4 + 1] = rv;
      roughImg.data[p4 + 2] = rv;
      roughImg.data[p4 + 3] = 255;
    }
  }
  colCtx.putImageData(colImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  return {
    map: configureColorTex(colCanvas, repeatX, repeatY),
    roughnessMap: configureLinearTex(roughCanvas, repeatX, repeatY),
    normalMap: heightToNormalTexture(height, size, 1.45, repeatX, repeatY)
  };
}

// 4. Wide-Plank European Oak Floor (1024x1024) with fine hair-line bevels & long straight grain
export function createWoodFloorTextureSet(repeatX = 3, repeatY = 3) {
  const size = 1024;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const colCtx = colCanvas.getContext('2d');
  const colImg = colCtx.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(size, size);

  const height = new Float32Array(size * size);
  const plankCols = 7;
  const rand = mulberry32(2028);
  const plankTint = [];
  const plankSeed = [];
  for (let c = 0; c < 32; c++) {
    plankTint.push(0.93 + rand() * 0.14);
    plankSeed.push(rand());
  }

  const nFiber = createAnisoNoise(256, 10, 1414);
  const nSweep = createAnisoNoise(16, 4, 1515);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const colF = u * plankCols;
      const colIdx = Math.floor(colF);
      const localU = colF - colIdx;

      const rowShift = (colIdx * 0.37) % 1.0;
      const rowF = (v + rowShift) * 1.5;
      const rowIdx = Math.floor(rowF) % 4;
      const localV = rowF - Math.floor(rowF);

      const pId = (rowIdx * plankCols + colIdx) % plankTint.length;
      const tint = plankTint[pId];
      const off = plankSeed[pId];

      // Subtle micro-bevel between oak planks (not dark cartoon outlines!)
      const edgeU = Math.min(localU, 1 - localU);
      const edgeV = Math.min(localV, 1 - localV);
      const grooveU = edgeU < 0.014 ? 0.62 + (edgeU / 0.014) * 0.38 : 1.0;
      const grooveV = edgeV < 0.005 ? 0.68 + (edgeV / 0.005) * 0.32 : 1.0;
      const groove = Math.min(grooveU, grooveV);

      const sweep = (nSweep(localU + off, v * 0.6 + off) - 0.5) * 0.18;
      const grain = Math.sin((localU * 4.5 + sweep * 3.2) * Math.PI * 2) * 0.5 + 0.5;
      const fiber = nFiber(u, v);

      const h = groove * (0.68 + grain * 0.12 + (fiber - 0.5) * 0.14);
      height[idx] = h;

      const shade = (0.87 + grain * 0.09 + (fiber - 0.5) * 0.07) * tint * groove;
      colImg.data[p4] = Math.min(255, Math.round(192 * shade));
      colImg.data[p4 + 1] = Math.min(255, Math.round(154 * shade));
      colImg.data[p4 + 2] = Math.min(255, Math.round(112 * shade));
      colImg.data[p4 + 3] = 255;

      const rv = Math.min(235, Math.max(75, Math.round((0.36 + (1 - grain) * 0.12 + (1 - groove) * 0.3) * 255)));
      roughImg.data[p4] = rv;
      roughImg.data[p4 + 1] = rv;
      roughImg.data[p4 + 2] = rv;
      roughImg.data[p4 + 3] = 255;
    }
  }
  colCtx.putImageData(colImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  return {
    map: configureColorTex(colCanvas, repeatX, repeatY),
    roughnessMap: configureLinearTex(roughCanvas, repeatX, repeatY),
    normalMap: heightToNormalTexture(height, size, 1.7, repeatX, repeatY)
  };
}

// 5. Woven Rattan / Wicker Basket Texture Set (512x512)
export function createWickerTextureSet(repeatX = 5, repeatY = 3) {
  const size = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const ctx = colCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const n = createAnisoNoise(32, 32, 3333);

  const stripsX = 16;
  const stripsY = 16;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const sx = u * stripsX;
      const sy = v * stripsY;
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const fx = sx - ix;
      const fy = sy - iy;

      const over = (ix + iy) % 2 === 0;
      const arch = over
        ? Math.sin(fy * Math.PI) * (0.72 + 0.28 * Math.sin(fx * Math.PI))
        : Math.sin(fx * Math.PI) * (0.72 + 0.28 * Math.sin(fy * Math.PI));

      const h = 0.25 + arch * 0.7 + (n(u * 3, v * 3) - 0.5) * 0.08;
      height[idx] = h;

      const tone = 0.58 + arch * 0.42 + (n(u * 4, v * 4) - 0.5) * 0.08;
      img.data[p4] = Math.min(255, Math.round(198 * tone));
      img.data[p4 + 1] = Math.min(255, Math.round(156 * tone));
      img.data[p4 + 2] = Math.min(255, Math.round(108 * tone));
      img.data[p4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    map: configureColorTex(colCanvas, repeatX, repeatY),
    normalMap: heightToNormalTexture(height, size, 3.2, repeatX, repeatY)
  };
}

// 6. Woven Garment Textures for Tidy Items (Chambray Stripe Shirt / Ribbed Knit Sweater)
export function createGarmentTexture(styleIndex = 0) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  const palettes = [
    { a: [110, 142, 174], b: [236, 240, 245], stripe: true },  // Classic crisp blue-and-white hotel shirt
    { a: [184, 152, 118], b: [162, 130, 98], stripe: false },  // Warm camel ribbed knit cardigan
    { a: [104, 132, 114], b: [232, 236, 230], stripe: true },  // Sage-and-ivory striped pajama top
    { a: [152, 118, 108], b: [132, 98, 88], stripe: false }    // Terracotta-taupe waffle knit
  ];
  const pal = palettes[styleIndex % palettes.length];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const p4 = (y * size + x) * 4;
      let r, g, b;
      if (pal.stripe) {
        const s = ((u * 24) % 1) < 0.42 ? 1 : 0;
        const weave = Math.sin(u * Math.PI * 64) * Math.sin(v * Math.PI * 64) * 8;
        r = (s ? pal.a[0] : pal.b[0]) + weave;
        g = (s ? pal.a[1] : pal.b[1]) + weave;
        b = (s ? pal.a[2] : pal.b[2]) + weave;
      } else {
        // Cozy vertical cable/rib knit
        const rib = Math.sin(u * Math.PI * 36) * 0.5 + 0.5;
        const stitch = Math.sin(v * Math.PI * 72) * 8;
        r = pal.a[0] * rib + pal.b[0] * (1 - rib) + stitch;
        g = pal.a[1] * rib + pal.b[1] * (1 - rib) + stitch;
        b = pal.a[2] * rib + pal.b[2] * (1 - rib) + stitch;
      }
      img.data[p4] = Math.max(0, Math.min(255, Math.round(r)));
      img.data[p4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
      img.data[p4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
      img.data[p4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return configureColorTex(canvas, 2, 2);
}

// 7. Bed Runner Woven Textures (3 styles)
export function createRunnerTexture(styleIndex = 0) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const n = createAnisoNoise(48, 48, 4100 + styleIndex * 31);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      let r = 238, g = 232, b = 220, h = 0.5;
      if (styleIndex === 0) {
        const wx = Math.abs(Math.sin(u * Math.PI * 36));
        const wy = Math.abs(Math.sin(v * Math.PI * 36));
        const pocket = Math.min(wx, wy);
        h = 0.35 + (1 - pocket) * 0.55;
        const s = 0.88 + h * 0.14;
        r = 242 * s; g = 236 * s; b = 224 * s;
      } else if (styleIndex === 1) {
        const zig = Math.abs(((v * 24) % 2) - 1);
        const diag = Math.sin((u * 48 + zig * 3.0) * Math.PI);
        h = 0.45 + diag * 0.25 + (n(u, v) - 0.5) * 0.15;
        const mix = diag * 0.5 + 0.5;
        r = 192 + mix * 34;
        g = 176 + mix * 34;
        b = 154 + mix * 32;
      } else {
        const band = Math.sin(v * Math.PI * 10);
        const isStripe = Math.abs(v - 0.5) > 0.32 && Math.abs(v - 0.5) < 0.42;
        const weave = Math.sin(u * Math.PI * 64) * Math.sin(v * Math.PI * 64);
        h = 0.5 + weave * 0.2 + (isStripe ? 0.08 : 0);
        if (isStripe) {
          r = 232 + weave * 10; g = 224 + weave * 10; b = 210 + weave * 10;
        } else {
          const s = 0.92 + band * 0.04 + weave * 0.05;
          r = 122 * s; g = 92 * s; b = 68 * s;
        }
      }
      height[idx] = h;
      img.data[p4] = Math.min(255, Math.max(0, Math.round(r)));
      img.data[p4 + 1] = Math.min(255, Math.max(0, Math.round(g)));
      img.data[p4 + 2] = Math.min(255, Math.max(0, Math.round(b)));
      img.data[p4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    map: configureColorTex(canvas, 3, 2),
    normalMap: heightToNormalTexture(height, size, 2.6, 3, 2)
  };
}

// 8. Single Wordless Pictorial Wooden Signboard Texture (512x512, ZERO text/digits/arrows)
export function createPictorialBoardTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, 0, size);
  bgGrad.addColorStop(0, '#f8f3ea');
  bgGrad.addColorStop(1, '#ece1cf');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#9c7a54';
  ctx.lineWidth = 7;
  ctx.strokeRect(18, 18, size - 36, size - 36);
  ctx.strokeStyle = '#c9a978';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(30, 30, size - 60, size - 60);

  ctx.strokeStyle = 'rgba(156, 122, 84, 0.26)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(46, 180); ctx.lineTo(size - 46, 180);
  ctx.moveTo(46, 354); ctx.lineTo(size - 46, 354);
  ctx.stroke();

  // Top: Striped shirt & white towel inside woven basket
  ctx.save();
  ctx.translate(256, 108);
  ctx.fillStyle = '#6f8ea8';
  ctx.beginPath(); ctx.roundRect(-64, -46, 60, 42, 10); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbbba4';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(2, -42, 58, 38, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c49563';
  ctx.beginPath();
  ctx.moveTo(-78, -12); ctx.lineTo(78, -12); ctx.lineTo(62, 46); ctx.lineTo(-62, 46);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8d6238';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  for (let y = 4; y <= 32; y += 14) {
    ctx.beginPath(); ctx.moveTo(-68 + y * 0.2, y); ctx.lineTo(68 - y * 0.2, y); ctx.stroke();
  }
  ctx.restore();

  // Middle: Crisp white hotel bed + White Swan + Pillow Chocolates
  ctx.save();
  ctx.translate(256, 268);
  ctx.fillStyle = '#7d5333';
  ctx.beginPath(); ctx.roundRect(-124, -56, 248, 42, 8); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cfc2b0';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-100, -36, 86, 34, 12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(14, -36, 86, 34, 12); ctx.fill(); ctx.stroke();
  // Chocolates on pillows
  for (const cx of [-57, 57]) {
    ctx.fillStyle = '#4a2a18';
    ctx.beginPath(); ctx.roundRect(cx - 11, -26, 22, 16, 3); ctx.fill();
    ctx.fillStyle = '#e5be67';
    ctx.beginPath(); ctx.arc(cx, -18, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fcfaf6';
  ctx.beginPath(); ctx.roundRect(-118, -6, 236, 62, 10); ctx.fill();
  ctx.strokeStyle = '#d4c7b4';
  ctx.stroke();
  // Towel Swan
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#b4a28a';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.ellipse(0, 22, 34, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(14, 16);
  ctx.bezierCurveTo(32, -8, -4, -26, 12, -34);
  ctx.bezierCurveTo(22, -38, 28, -28, 22, -22);
  ctx.lineWidth = 9; ctx.strokeStyle = '#b4a28a'; ctx.lineCap = 'round'; ctx.stroke();
  ctx.lineWidth = 5.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.restore();

  // Bottom: Brass Bell + Beaming Guest Face
  ctx.save();
  ctx.translate(256, 422);
  ctx.fillStyle = '#d8ad56';
  ctx.strokeStyle = '#8f6922';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(-58, 12, 26, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(-63, -20, 10, 7);
  ctx.fillStyle = '#6c492a';
  ctx.fillRect(-88, 12, 60, 7);

  ctx.fillStyle = '#f5cbb0';
  ctx.strokeStyle = '#8c6245';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(42, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5c3c28';
  ctx.beginPath(); ctx.arc(42, -6, 31, Math.PI * 1.08, Math.PI * 1.92); ctx.fill();
  ctx.strokeStyle = '#4c3020';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(31, -2, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(53, -2, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(42, 6, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(232, 120, 112, 0.45)';
  ctx.beginPath(); ctx.arc(24, 7, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(60, 7, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function createSoftShadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.48);
  g.addColorStop(0, 'rgba(28, 20, 14, 0.48)');
  g.addColorStop(0.55, 'rgba(34, 24, 16, 0.20)');
  g.addColorStop(1, 'rgba(34, 24, 16, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createSheerCurtainTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n = createAnisoNoise(32, 32, 8080);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const p4 = (y * size + x) * 4;
      const wx = Math.abs(Math.sin(u * Math.PI * 96));
      const wy = Math.abs(Math.sin(v * Math.PI * 96));
      const fiber = Math.max(wx, wy) * 0.35 + n(u * 2, v * 6) * 0.15;
      img.data[p4] = 253;
      img.data[p4 + 1] = 250;
      img.data[p4 + 2] = 244;
      img.data[p4 + 3] = Math.round((0.56 + fiber * 0.36) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  tex.needsUpdate = true;
  return tex;
}

// Feathered Soft Sunbeam Ray Texture (zero hard polygon edges!)
export function createSunbeamTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    const vy = Math.sin(v * Math.PI);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      // Stronger near window (u=1), fading smoothly across room (u=0), soft bell curve across width (v)
      const ux = Math.pow(u, 0.85) * Math.sin(u * Math.PI * 0.96);
      const a = Math.pow(vy, 2.2) * ux;
      const p4 = (y * size + x) * 4;
      img.data[p4] = 255;
      img.data[p4 + 1] = 246;
      img.data[p4 + 2] = 224;
      img.data[p4 + 3] = Math.round(a * 34);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Woven Ivory-Oatmeal Boucle Hotel Area Rug Texture Set (512x512)
export function createBoucleRugTextureSet(repeatX = 6, repeatY = 5) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  const n1 = createAnisoNoise(64, 64, 6161);
  const n2 = createAnisoNoise(16, 16, 6262);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      // Chunky woven wool boucle knots
      const knotX = Math.abs(Math.sin(u * Math.PI * 48 + n1(u, v) * 0.8));
      const knotY = Math.abs(Math.sin(v * Math.PI * 36 + n1(v, u) * 0.8));
      const h = 0.35 + knotX * 0.32 + knotY * 0.24 + (n2(u, v) - 0.5) * 0.14;
      height[idx] = h;

      const shade = 0.86 + h * 0.14;
      img.data[p4] = Math.min(255, Math.round(234 * shade));
      img.data[p4 + 1] = Math.min(255, Math.round(224 * shade));
      img.data[p4 + 2] = Math.min(255, Math.round(208 * shade));
      img.data[p4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    map: configureColorTex(canvas, repeatX, repeatY),
    normalMap: heightToNormalTexture(height, size, 3.0, repeatX, repeatY)
  };
}

export function buildHotelEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xdad0c2);

  const roomGeo = new THREE.BoxGeometry(14, 9, 14);
  const roomMats = [
    new THREE.MeshBasicMaterial({ color: 0xf0e9de, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: 0xc2b09a, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: 0xf4f0ea, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: 0x9e7750, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: 0xd6cab8, side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: 0x865e3d, side: THREE.BackSide })
  ];
  envScene.add(new THREE.Mesh(roomGeo, roomMats));

  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 3.4, 3.05) });
  const winPane1 = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 6.2), winMat);
  winPane1.position.set(6.9, 1.2, -0.2);
  winPane1.rotation.y = -Math.PI / 2;
  envScene.add(winPane1);

  const skyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.35, 1.50) });
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), skyMat);
  skyPlane.position.set(2.5, 4.4, 0);
  skyPlane.rotation.x = Math.PI / 2;
  envScene.add(skyPlane);

  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.7, 0.92) });
  const lampOrb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), lampMat);
  lampOrb.position.set(-4.8, 0.5, -2.2);
  envScene.add(lampOrb);

  const rt = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  roomGeo.dispose();
  roomMats.forEach((m) => m.dispose());
  winMat.dispose();
  skyMat.dispose();
  lampMat.dispose();
  return rt.texture;
}

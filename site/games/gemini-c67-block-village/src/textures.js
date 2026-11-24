// Photorealistic Procedural PBR Texture & Environment Generator (All textures strictly <= 1024px)
import * as THREE from 'three';

function makePRNG(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Fast tileable 2D value noise + FBM
class TileNoise {
  constructor(seed = 42, period = 64) {
    this.period = period;
    const rng = makePRNG(seed);
    this.grid = new Float32Array(period * period);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = rng();
  }

  sample(x, y, freq = 1) {
    const p = (this.period * freq) | 0 || this.period;
    const fx = ((x * p) % p + p) % p;
    const fy = ((y * p) % p + p) % p;
    const x0 = fx | 0;
    const y0 = fy | 0;
    const x1 = (x0 + 1) % p;
    const y1 = (y0 + 1) % p;
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);

    const g = this.grid;
    const gp = this.period;
    const v00 = g[(y0 % gp) * gp + (x0 % gp)];
    const v10 = g[(y0 % gp) * gp + (x1 % gp)];
    const v01 = g[(y1 % gp) * gp + (x0 % gp)];
    const v11 = g[(y1 % gp) * gp + (x1 % gp)];
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  }

  fbm(u, v, octaves = 4, baseScale = 1) {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let sc = baseScale;
    for (let i = 0; i < octaves; i++) {
      sum += this.sample(u * sc, v * sc, 1) * amp;
      norm += amp;
      amp *= 0.5;
      sc *= 2;
    }
    return sum / norm;
  }
}

// Tileable Worley cellular distance (F1 & F2-F1 edge distance for stones/clods)
function makeWorleyPoints(seed, cells) {
  const rng = makePRNG(seed);
  const pts = new Float32Array(cells * cells * 2);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const idx = (y * cells + x) * 2;
      pts[idx] = x + 0.14 + rng() * 0.72;
      pts[idx + 1] = y + 0.14 + rng() * 0.72;
    }
  }
  return { pts, cells };
}

function sampleWorley(worley, u, v) {
  const { pts, cells } = worley;
  const px = ((u % 1) + 1) % 1 * cells;
  const py = ((v % 1) + 1) % 1 * cells;
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  let d1 = 999, d2 = 999, cellId = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = ((cx + dx) % cells + cells) % cells;
      const ny = ((cy + dy) % cells + cells) % cells;
      const id = ny * cells + nx;
      const ox = pts[id * 2] + (cx + dx - nx);
      const oy = pts[id * 2 + 1] + (cy + dy - ny);
      const dist = Math.hypot(px - ox, py - oy);
      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        cellId = id;
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }
  return { d1, edge: d2 - d1, cellId };
}

// Convert Float32 heightmap [0..1] into crisp Sobel tangent-space normal CanvasTexture
function heightToNormalTexture(height, size, strength = 3.2) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const mask = size - 1;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1) & mask;
    const yp = (y + 1) & mask;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;

      const tl = height[ym * size + xm];
      const t  = height[ym * size + x];
      const tr = height[ym * size + xp];
      const l  = height[y  * size + xm];
      const r  = height[y  * size + xp];
      const bl = height[yp * size + xm];
      const b  = height[yp * size + x];
      const br = height[yp * size + xp];

      const gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const gy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -gx * strength;
      let ny = -gy * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      d[idx]     = ((nx * 0.5 + 0.5) * 255) | 0;
      d[idx + 1] = ((ny * 0.5 + 0.5) * 255) | 0;
      d[idx + 2] = ((nz * 0.5 + 0.5) * 255) | 0;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function arrayToGrayTexture(arr, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, (arr[i] * 255) | 0));
    const idx = i * 4;
    d[idx] = v;
    d[idx + 1] = v;
    d[idx + 2] = v;
    d[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeColorTexture(canvas, srgb = true) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// 1. PHOTOREALISTIC DAMP EARTH / LOAM BLOCK (768x768 <= 1024px)
function buildEarthPBR(size = 768) {
  const noise = new TileNoise(101, 64);
  const fine = new TileNoise(202, 128);
  const clods = makeWorleyPoints(303, 12);
  const pebbles = makeWorleyPoints(404, 26);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = noise.fbm(u, v, 4, 1);
      const n2 = fine.fbm(u, v, 3, 2);
      const wc = sampleWorley(clods, u + (n1 - 0.5) * 0.08, v + (n2 - 0.5) * 0.08);
      const wp = sampleWorley(pebbles, u, v);

      // Soil clod relief + embedded small pebbles
      const clodBump = Math.min(1, wc.edge * 2.4) * 0.55 + n1 * 0.3 + n2 * 0.15;
      const isPebble = wp.d1 < 0.16 && ((wp.cellId * 17) % 7 === 0);
      const pebbleBump = isPebble ? (1.0 - wp.d1 / 0.16) * 0.45 : 0;

      const h = Math.max(0, Math.min(1, clodBump + pebbleBump));
      const i = y * size + x;
      height[i] = h;

      // Rich organic dark sienna-umber soil palette with moist humus crevices
      const ao = 0.55 + 0.45 * Math.min(1, wc.edge * 2.8);
      let r = (74 + n1 * 42 + (n2 - 0.5) * 26) * ao;
      let g = (49 + n1 * 28 + (n2 - 0.5) * 18) * ao;
      let b = (31 + n1 * 18 + (n2 - 0.5) * 12) * ao;

      if (isPebble) {
        const tone = 128 + ((wp.cellId * 31) % 55);
        const blend = Math.min(1, (0.16 - wp.d1) * 11);
        r = r * (1 - blend) + tone * 1.03 * blend;
        g = g * (1 - blend) + tone * 0.98 * blend;
        b = b * (1 - blend) + tone * 0.90 * blend;
        rough[i] = 0.56;
      } else {
        // Damp dark humus pockets have slightly lower roughness
        rough[i] = 0.80 + (1 - ao) * -0.10 + n2 * 0.15;
      }

      const idx = i * 4;
      d[idx]     = Math.max(0, Math.min(255, r)) | 0;
      d[idx + 1] = Math.max(0, Math.min(255, g)) | 0;
      d[idx + 2] = Math.max(0, Math.min(255, b)) | 0;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Fine organic rootlet hairs
  const rng = makePRNG(505);
  ctx.lineCap = 'round';
  for (let k = 0; k < 140; k++) {
    const rx = rng() * size;
    const ry = rng() * size;
    ctx.strokeStyle = `rgba(${105 + (rng() * 35) | 0}, ${82 + (rng() * 25) | 0}, ${54 + (rng() * 18) | 0}, 0.42)`;
    ctx.lineWidth = 0.8 + rng() * 1.3;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.quadraticCurveTo(rx + (rng() - 0.5) * 28, ry + rng() * 20, rx + (rng() - 0.5) * 34, ry + 14 + rng() * 24);
    ctx.stroke();
  }

  return {
    map: makeColorTexture(canvas),
    normalMap: heightToNormalTexture(height, size, 3.8),
    roughnessMap: arrayToGrayTexture(rough, size),
    earthCanvas: canvas,
    earthHeight: height,
  };
}

// 2. TILLED MOIST FARMLAND SOIL (512x512)
function buildTilledSoilPBR(size = 512) {
  const noise = new TileNoise(606, 64);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    // 4 parallel plowed ridges per block
    const furrow = 0.5 + 0.5 * Math.cos(v * Math.PI * 8 + (noise.fbm(0.3, v, 2, 2) - 0.5) * 0.6);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n = noise.fbm(u, v, 4, 2);
      const h = Math.max(0, Math.min(1, furrow * 0.68 + n * 0.32));
      const i = y * size + x;
      height[i] = h;
      rough[i] = 0.48 + furrow * 0.34;

      const shade = 0.52 + furrow * 0.48;
      const idx = i * 4;
      d[idx]     = (56 * shade + n * 24) | 0;
      d[idx + 1] = (36 * shade + n * 16) | 0;
      d[idx + 2] = (22 * shade + n * 10) | 0;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: makeColorTexture(canvas),
    normalMap: heightToNormalTexture(height, size, 4.4),
    roughnessMap: arrayToGrayTexture(rough, size),
  };
}

// 3. LUSH MEADOW GRASS TOP & OVERHANGING SOD SIDE (768x768 <= 1024px)
function buildGrassPBR(earthData, size = 768) {
  const noise = new TileNoise(707, 64);
  const rng = makePRNG(808);

  // --- GRASS TOP ---
  const topCanvas = document.createElement('canvas');
  topCanvas.width = size;
  topCanvas.height = size;
  const tCtx = topCanvas.getContext('2d');

  // Deep mossy soil bed underneath blades
  const baseImg = tCtx.createImageData(size, size);
  const bd = baseImg.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise.fbm(x / size, y / size, 4, 1);
      const idx = (y * size + x) * 4;
      bd[idx]     = (38 + n * 34) | 0;
      bd[idx + 1] = (62 + n * 48) | 0;
      bd[idx + 2] = (24 + n * 18) | 0;
      bd[idx + 3] = 255;
    }
  }
  tCtx.putImageData(baseImg, 0, 0);

  // Height canvas for blades so normal map captures real individual blade ridges!
  const hCanvas = document.createElement('canvas');
  hCanvas.width = size;
  hCanvas.height = size;
  const hCtx = hCanvas.getContext('2d');
  hCtx.fillStyle = '#262626';
  hCtx.fillRect(0, 0, size, size);

  // Draw 11,000 layered tapering meadow grass blades (wrapped seamlessly across edges)
  tCtx.lineCap = 'round';
  hCtx.lineCap = 'round';
  for (let i = 0; i < 11000; i++) {
    const bx = rng() * size;
    const by = rng() * size;
    const len = 10 + rng() * 20;
    const ang = -Math.PI * 0.5 + (rng() - 0.5) * 2.2;
    const bend = (rng() - 0.5) * 10;
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    const cx = (bx + ex) * 0.5 + bend;
    const cy = (by + ey) * 0.5 - Math.abs(bend) * 0.3;

    const patch = noise.sample(bx / size, by / size, 2);
    const dryMix = rng() < 0.06 ? 1 : 0;
    const r = dryMix ? (135 + rng() * 30) | 0 : (46 + patch * 44 + rng() * 28) | 0;
    const g = dryMix ? (126 + rng() * 25) | 0 : (82 + patch * 56 + rng() * 34) | 0;
    const b = dryMix ? (62 + rng() * 20) | 0  : (26 + patch * 20 + rng() * 18) | 0;
    const w = 1.1 + rng() * 2.1;

    // Draw wrapped if near edge
    const offsets = [[0, 0]];
    if (bx < 24) offsets.push([size, 0]);
    if (bx > size - 24) offsets.push([-size, 0]);
    if (by < 24) offsets.push([0, size]);
    if (by > size - 24) offsets.push([0, -size]);

    const hLum = (95 + (i / 11000) * 145) | 0;
    for (let o = 0; o < offsets.length; o++) {
      const ox = offsets[o][0], oy = offsets[o][1];
      tCtx.strokeStyle = `rgb(${r},${g},${b})`;
      tCtx.lineWidth = w;
      tCtx.beginPath();
      tCtx.moveTo(bx + ox, by + oy);
      tCtx.quadraticCurveTo(cx + ox, cy + oy, ex + ox, ey + oy);
      tCtx.stroke();

      hCtx.strokeStyle = `rgb(${hLum},${hLum},${hLum})`;
      hCtx.lineWidth = w;
      hCtx.beginPath();
      hCtx.moveTo(bx + ox, by + oy);
      hCtx.quadraticCurveTo(cx + ox, cy + oy, ex + ox, ey + oy);
      hCtx.stroke();
    }
  }

  // Tiny natural white clover & buttercup specks
  for (let i = 0; i < 65; i++) {
    const fx = 16 + rng() * (size - 32);
    const fy = 16 + rng() * (size - 32);
    const yellow = rng() < 0.35;
    tCtx.fillStyle = yellow ? 'rgba(235, 202, 74, 0.88)' : 'rgba(242, 244, 234, 0.85)';
    for (let p = 0; p < 4; p++) {
      const pa = (p / 4) * Math.PI * 2 + rng() * 0.5;
      tCtx.beginPath();
      tCtx.arc(fx + Math.cos(pa) * 2.4, fy + Math.sin(pa) * 2.4, 1.8, 0, Math.PI * 2);
      tCtx.fill();
    }
  }

  const hData = hCtx.getImageData(0, 0, size, size).data;
  const topHeight = new Float32Array(size * size);
  const topRough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const h = hData[i * 4] / 255;
    topHeight[i] = h;
    topRough[i] = 0.62 + (1 - h) * 0.28;
  }

  // --- GRASS SIDE (Earth strata + overhanging sod lip with AO shadow) ---
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = size;
  sideCanvas.height = size;
  const sCtx = sideCanvas.getContext('2d');
  sCtx.drawImage(earthData.earthCanvas, 0, 0);

  const sideHeight = new Float32Array(earthData.earthHeight);
  const sideRough = new Float32Array(size * size);
  sideRough.fill(0.84);

  // Soft AO shadow beneath irregular natural torn-sod turf lip (NO uniform sine waves!)
  const sImg = sCtx.getImageData(0, 0, size, size);
  const sd = sImg.data;
  for (let x = 0; x < size; x++) {
    const u = x / size;
    const nLip1 = noise.fbm(u * 2.0, 0.17, 4, 2) - 0.5;
    const nLip2 = noise.fbm(u * 7.0, 0.63, 3, 3) - 0.5;
    const lipY = size * Math.max(0.08, Math.min(0.36, 0.19 + nLip1 * 0.22 + nLip2 * 0.10));
    for (let y = 0; y < size; y++) {
      const i = y * size + x;
      const idx = i * 4;
      if (y < lipY) {
        const n = noise.fbm(u * 2, y / size * 2, 4, 2);
        const bladeVar = noise.sample(u * 18, y / size * 4, 1);
        const rootBlend = Math.pow(y / Math.max(1, lipY), 2.4) * 0.35;
        const gr = (52 + n * 38 + bladeVar * 22) * (1 - rootBlend) + 78 * rootBlend;
        const gg = (84 + n * 48 + bladeVar * 26) * (1 - rootBlend) + 60 * rootBlend;
        const gb = (30 + n * 16 + bladeVar * 10) * (1 - rootBlend) + 36 * rootBlend;
        sd[idx]     = gr | 0;
        sd[idx + 1] = gg | 0;
        sd[idx + 2] = gb | 0;
        sideHeight[i] = Math.min(1, 0.66 + bladeVar * 0.28);
        sideRough[i] = 0.72;
      } else if (y < lipY + size * 0.12) {
        // Natural soft turf overhang contact AO on damp topsoil
        const t = (y - lipY) / (size * 0.12);
        const ao = 0.46 + 0.54 * (t * t);
        sd[idx]     = (sd[idx] * ao) | 0;
        sd[idx + 1] = (sd[idx + 1] * ao) | 0;
        sd[idx + 2] = (sd[idx + 2] * ao) | 0;
      }
    }
  }
  sCtx.putImageData(sImg, 0, 0);

  // Fine overhanging grass stalks & exposed rootlets along the irregular sod edge
  sCtx.lineCap = 'round';
  for (let i = 0; i < 1300; i++) {
    const gx = rng() * size;
    const u = gx / size;
    const nLip1 = noise.fbm(u * 2.0, 0.17, 4, 2) - 0.5;
    const baseLip = size * Math.max(0.08, 0.18 + nLip1 * 0.22);
    const gy = rng() * baseLip;
    const len = 10 + rng() * 28;
    sCtx.strokeStyle = `rgb(${(48 + rng() * 44) | 0}, ${(82 + rng() * 48) | 0}, ${(28 + rng() * 18) | 0})`;
    sCtx.lineWidth = 1.1 + rng() * 1.9;
    sCtx.beginPath();
    sCtx.moveTo(gx, gy);
    sCtx.quadraticCurveTo(gx + (rng() - 0.5) * 9, gy + len * 0.55, gx + (rng() - 0.5) * 14, gy + len);
    sCtx.stroke();
  }

  return {
    topMap: makeColorTexture(topCanvas),
    topNormal: heightToNormalTexture(topHeight, size, 3.1),
    topRoughness: arrayToGrayTexture(topRough, size),
    sideMap: makeColorTexture(sideCanvas),
    sideNormal: heightToNormalTexture(sideHeight, size, 3.6),
    sideRoughness: arrayToGrayTexture(sideRough, size),
  };
}

// 4. NATURAL SAWN CEDAR & OAK TIMBER BLOCK (768x768 <= 1024px)
function buildWoodPBR(size = 768) {
  const noise = new TileNoise(909, 64);
  const fine = new TileNoise(1010, 128);

  // --- PLANK / BEAM SIDE ---
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = size;
  sideCanvas.height = size;
  const ctx = sideCanvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  // 3 horizontal fitted cedar planks per block face with subtle chamfered seam
  const planks = 3;
  const knotU = [0.28, 0.74, 0.42];
  const knotV = [0.17, 0.52, 0.84];

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const plankIdx = Math.floor(v * planks);
    const pv = (v * planks) % 1;
    const seamDist = Math.min(pv, 1 - pv);
    const seamAO = seamDist < 0.045 ? 0.52 + (seamDist / 0.045) * 0.48 : 1.0;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const uOff = u + plankIdx * 0.37;

      // Knot distortion
      const dxK = u - knotU[plankIdx];
      const dyK = (v - knotV[plankIdx]) * 2.2;
      const dKnot = Math.hypot(dxK, dyK);
      const knotSwirl = dKnot < 0.16 ? (1 - dKnot / 0.16) * 2.8 : 0;

      const warp = noise.fbm(uOff * 0.5, v * 2.0, 4, 1) * 3.8 + knotSwirl;
      const ring = 0.5 + 0.5 * Math.sin((v * planks * 11.0 + warp) * Math.PI);
      const ringSharp = Math.pow(ring, 1.65);
      const fiber = fine.fbm(uOff * 6.0, v * 0.8, 3, 2);

      const plankTone = 0.93 + (plankIdx % 2) * 0.08;
      const knotDark = dKnot < 0.065 ? 0.48 + (dKnot / 0.065) * 0.52 : 1.0;

      const grainVal = ringSharp * 0.72 + fiber * 0.28;
      const shade = seamAO * plankTone * knotDark;

      const r = (132 + grainVal * 56) * shade;
      const g = (86 + grainVal * 42) * shade;
      const b = (48 + grainVal * 26) * shade;

      const i = y * size + x;
      height[i] = seamAO * (0.55 + ringSharp * 0.25 + fiber * 0.20);
      rough[i] = 0.48 + (1 - ringSharp) * 0.20 + (1 - seamAO) * 0.25;

      const idx = i * 4;
      d[idx]     = Math.max(0, Math.min(255, r)) | 0;
      d[idx + 1] = Math.max(0, Math.min(255, g)) | 0;
      d[idx + 2] = Math.max(0, Math.min(255, b)) | 0;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // --- END GRAIN / LOG TOP (512x512) ---
  const endSize = 512;
  const endCanvas = document.createElement('canvas');
  endCanvas.width = endSize;
  endCanvas.height = endSize;
  const eCtx = endCanvas.getContext('2d');
  const eImg = eCtx.createImageData(endSize, endSize);
  const ed = eImg.data;
  const endHeight = new Float32Array(endSize * endSize);

  for (let y = 0; y < endSize; y++) {
    const dy = y / endSize - 0.5;
    for (let x = 0; x < endSize; x++) {
      const dx = x / endSize - 0.5;
      const rad = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const n = noise.fbm(x / endSize, y / endSize, 4, 2);
      const rings = 0.5 + 0.5 * Math.sin((rad * 34 + n * 1.8) * Math.PI);
      const rays = 0.5 + 0.5 * Math.sin(ang * 42 + n * 4);
      const bark = rad > 0.45 ? 0.55 : 1.0;

      const val = rings * 0.78 + rays * 0.12 + n * 0.10;
      const i = y * endSize + x;
      endHeight[i] = 0.4 + rings * 0.4 + rays * 0.2;

      const idx = i * 4;
      ed[idx]     = ((138 + val * 58) * bark) | 0;
      ed[idx + 1] = ((94 + val * 44) * bark) | 0;
      ed[idx + 2] = ((54 + val * 26) * bark) | 0;
      ed[idx + 3] = 255;
    }
  }
  eCtx.putImageData(eImg, 0, 0);

  // --- CEDAR ROOF SHINGLES (512x512) ---
  const roofCanvas = document.createElement('canvas');
  roofCanvas.width = endSize;
  roofCanvas.height = endSize;
  const rCtx = roofCanvas.getContext('2d');
  const rImg = rCtx.createImageData(endSize, endSize);
  const rd = rImg.data;
  const roofHeight = new Float32Array(endSize * endSize);

  for (let y = 0; y < endSize; y++) {
    const v = y / endSize;
    const row = Math.floor(v * 5);
    const rv = (v * 5) % 1;
    for (let x = 0; x < endSize; x++) {
      const u = (x / endSize + (row % 2) * 0.5 / 4) % 1;
      const col = Math.floor(u * 4);
      const cu = (u * 4) % 1;
      const gapX = Math.min(cu, 1 - cu) < 0.035 ? 0.45 : 1.0;
      const dropAO = rv < 0.12 ? 0.48 + (rv / 0.12) * 0.52 : 1.0;
      const n = noise.fbm(u * 3 + row * 0.2, v * 2, 3, 2);
      const shingleTone = 0.85 + ((row * 7 + col * 13) % 5) * 0.055;
      const sh = gapX * dropAO * shingleTone;
      const i = y * endSize + x;
      roofHeight[i] = gapX * (0.3 + rv * 0.6 + n * 0.1);
      const idx = i * 4;
      rd[idx]     = ((116 + n * 44) * sh) | 0;
      rd[idx + 1] = ((74 + n * 30) * sh) | 0;
      rd[idx + 2] = ((44 + n * 20) * sh) | 0;
      rd[idx + 3] = 255;
    }
  }
  rCtx.putImageData(rImg, 0, 0);

  return {
    sideMap: makeColorTexture(sideCanvas),
    sideNormal: heightToNormalTexture(height, size, 3.0),
    sideRoughness: arrayToGrayTexture(rough, size),
    endMap: makeColorTexture(endCanvas),
    endNormal: heightToNormalTexture(endHeight, endSize, 2.8),
    shingleMap: makeColorTexture(roofCanvas),
    shingleNormal: heightToNormalTexture(roofHeight, endSize, 3.8),
  };
}

// 5. ORGANIC QUARRIED FIELDSTONE / WEATHERED LIMESTONE & GRANITE BLOCK (768x768 <= 1024px)
function buildStonePBR(size = 768) {
  const noise = new TileNoise(1111, 64);
  const micro = new TileNoise(1212, 128);
  const stones = makeWorleyPoints(1717, 5); // Organic polygonal fieldstones instead of uniform brick grid!
  const subCracks = makeWorleyPoints(1818, 11);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warpU = u + (noise.fbm(u, v, 4, 2) - 0.5) * 0.11;
      const warpV = v + (noise.fbm(u + 0.37, v + 0.19, 4, 2) - 0.5) * 0.11;

      // Slightly compressed vertically so fieldstones sit naturally bedded in horizontal-ish drystone masonry
      const ws = sampleWorley(stones, warpU, (warpV * 1.35) % 1);
      const wc = sampleWorley(subCracks, warpU, warpV);

      const rockFbm = noise.fbm(u * 3.0, v * 3.0, 4, 2);
      const grain = micro.fbm(u * 6.0, v * 6.0, 3, 2);
      const ridge = 1.0 - Math.abs(rockFbm * 2 - 1) * 0.52;
      const microCrack = wc.edge < 0.035 ? (0.035 - wc.edge) / 0.035 : 0;

      const stoneId = ws.cellId;
      const warmTint = ((stoneId * 29) % 13) / 13; // Natural mix of warm Cotswold limestone & cool granite
      const isMortar = ws.edge < 0.058;

      const i = y * size + x;
      const idx = i * 4;

      if (isMortar) {
        const mDepth = ws.edge / 0.058;
        height[i] = 0.10 + mDepth * 0.24 + grain * 0.08;
        rough[i] = 0.94;
        // Subtle natural moss in damp rock crevices
        const moss = rockFbm > 0.56 ? (rockFbm - 0.56) * 1.9 : 0;
        const mr = 94 + grain * 24 - moss * 34;
        const mg = 89 + grain * 22 + moss * 26;
        const mb = 79 + grain * 18 - moss * 36;
        const ao = 0.46 + mDepth * 0.42;
        d[idx]     = Math.max(0, Math.min(255, mr * ao)) | 0;
        d[idx + 1] = Math.max(0, Math.min(255, mg * ao)) | 0;
        d[idx + 2] = Math.max(0, Math.min(255, mb * ao)) | 0;
      } else {
        const bevel = Math.min(1, (ws.edge - 0.058) / 0.13);
        const h = Math.max(0.15, 0.34 + bevel * 0.42 * ridge + grain * 0.20 - microCrack * 0.16);
        height[i] = h;
        const glint = grain > 0.74 ? -0.24 : 0;
        rough[i] = Math.max(0.36, 0.74 + (1 - ridge) * 0.16 + glint);

        const baseLum = 112 + ((stoneId * 23) % 32) + (ridge - 0.68) * 52 + (grain - 0.5) * 38 - microCrack * 26;
        const bevelShade = 0.72 + bevel * 0.28;
        const lichen = (rockFbm > 0.74 && grain > 0.58) ? 0.28 : 0;
        const r = (baseLum + warmTint * 20 - lichen * 16) * bevelShade;
        const g = (baseLum + warmTint * 12 + lichen * 18) * bevelShade;
        const b = (baseLum - warmTint * 10 - lichen * 18) * bevelShade;
        d[idx]     = Math.max(0, Math.min(255, r)) | 0;
        d[idx + 1] = Math.max(0, Math.min(255, g)) | 0;
        d[idx + 2] = Math.max(0, Math.min(255, b)) | 0;
      }
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  return {
    map: makeColorTexture(canvas),
    normalMap: heightToNormalTexture(height, size, 4.6),
    roughnessMap: arrayToGrayTexture(rough, size),
  };
}

// 6. WARM WOOD-AND-AMBER-GLASS LANTERN / WINDOW TEXTURE (512x512)
function buildLanternPBR(size = 512) {
  const noise = new TileNoise(1313, 64);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = size;
  emissiveCanvas.height = size;
  const eCtx = emissiveCanvas.getContext('2d');

  // Warm frosted amber glass center
  const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.52);
  grad.addColorStop(0, '#fff4d2');
  grad.addColorStop(0.55, '#f4c77b');
  grad.addColorStop(1, '#c98a42');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const eGrad = eCtx.createRadialGradient(size * 0.5, size * 0.5, size * 0.04, size * 0.5, size * 0.5, size * 0.5);
  eGrad.addColorStop(0, '#ffe8a8');
  eGrad.addColorStop(0.6, '#ffaa44');
  eGrad.addColorStop(1, '#8a3e08');
  eCtx.fillStyle = eGrad;
  eCtx.fillRect(0, 0, size, size);

  // Subtle handmade glass ripple texture
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = noise.fbm(u * 3, v * 3, 3, 2);
      const border = u < 0.13 || u > 0.87 || v < 0.13 || v > 0.87;
      const mullion = Math.abs(u - 0.5) < 0.032 || Math.abs(v - 0.5) < 0.032;
      const i = y * size + x;
      const idx = i * 4;
      if (border || mullion) {
        // Dark roasted cedar frame
        d[idx]     = (68 + n * 28) | 0;
        d[idx + 1] = (43 + n * 18) | 0;
        d[idx + 2] = (25 + n * 12) | 0;
        height[i] = 0.88;
      } else {
        d[idx]     = Math.min(255, d[idx] + (n - 0.5) * 18) | 0;
        d[idx + 1] = Math.min(255, d[idx + 1] + (n - 0.5) * 16) | 0;
        d[idx + 2] = Math.min(255, d[idx + 2] + (n - 0.5) * 12) | 0;
        height[i] = 0.25 + n * 0.14;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // Mask wooden frame in emissive map so ONLY the glass panes glow!
  eCtx.fillStyle = '#000000';
  const b = size * 0.13;
  eCtx.fillRect(0, 0, size, b);
  eCtx.fillRect(0, size - b, size, b);
  eCtx.fillRect(0, 0, b, size);
  eCtx.fillRect(size - b, 0, b, size);
  eCtx.fillRect(size * 0.468, 0, size * 0.064, size);
  eCtx.fillRect(0, size * 0.468, size, size * 0.064);

  return {
    map: makeColorTexture(canvas),
    emissiveMap: makeColorTexture(emissiveCanvas),
    normalMap: heightToNormalTexture(height, size, 3.4),
  };
}

// 7. WOVEN CLOTH, FLUFFY WOOL, SOFT FEATHERS & RUBY BERRY TEXTURES (256-512px)
function buildCraftPBR() {
  const noise = new TileNoise(1414, 64);

  // Fluffy curly sheep wool (512x512)
  const wSize = 512;
  const woolC = document.createElement('canvas');
  woolC.width = wSize;
  woolC.height = wSize;
  const wCtx = woolC.getContext('2d');
  const wImg = wCtx.createImageData(wSize, wSize);
  const wd = wImg.data;
  const wHeight = new Float32Array(wSize * wSize);
  const curls = makeWorleyPoints(1515, 18);

  for (let y = 0; y < wSize; y++) {
    for (let x = 0; x < wSize; x++) {
      const u = x / wSize, v = y / wSize;
      const n = noise.fbm(u * 4, v * 4, 3, 2);
      const wc = sampleWorley(curls, u + (n - 0.5) * 0.05, v + (n - 0.5) * 0.05);
      const puff = Math.max(0, 1 - wc.d1 * 1.35);
      const h = puff * 0.72 + n * 0.28;
      wHeight[y * wSize + x] = h;
      const idx = (y * wSize + x) * 4;
      const lum = 205 + h * 46;
      wd[idx]     = Math.min(255, lum) | 0;
      wd[idx + 1] = Math.min(255, lum * 0.965) | 0;
      wd[idx + 2] = Math.min(255, lum * 0.895) | 0;
      wd[idx + 3] = 255;
    }
  }
  wCtx.putImageData(wImg, 0, 0);

  // Overlapping chicken feathers (256x256)
  const fSize = 256;
  const featC = document.createElement('canvas');
  featC.width = fSize;
  featC.height = fSize;
  const fCtx = featC.getContext('2d');
  const fImg = fCtx.createImageData(fSize, fSize);
  const fd = fImg.data;
  const fHeight = new Float32Array(fSize * fSize);

  for (let y = 0; y < fSize; y++) {
    const v = y / fSize;
    const row = Math.floor(v * 8);
    const rv = (v * 8) % 1;
    for (let x = 0; x < fSize; x++) {
      const u = (x / fSize + (row % 2) * 0.08) % 1;
      const cu = ((u * 8) % 1) - 0.5;
      const scallop = Math.max(0, 1 - Math.hypot(cu * 1.4, (rv - 0.45) * 1.3));
      const barb = 0.5 + 0.5 * Math.sin((cu * 24 + rv * 10) * Math.PI);
      const h = scallop * 0.8 + barb * 0.2;
      fHeight[y * fSize + x] = h;
      const idx = (y * fSize + x) * 4;
      const lum = 218 + h * 35;
      fd[idx]     = Math.min(255, lum) | 0;
      fd[idx + 1] = Math.min(255, lum * 0.96) | 0;
      fd[idx + 2] = Math.min(255, lum * 0.90) | 0;
      fd[idx + 3] = 255;
    }
  }
  fCtx.putImageData(fImg, 0, 0);

  // Woven textiles for the 3 outfits (256x256 each)
  const makeFabric = (baseRGB, kind) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d');
    const im = g.createImageData(256, 256);
    const dt = im.data;
    const fh = new Float32Array(256 * 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        let weave = 0.5;
        if (kind === 'denim') {
          // Diagonal twill weave + white weft flecks
          weave = 0.5 + 0.5 * Math.sin(((x + y * 2) % 6) / 6 * Math.PI * 2);
        } else if (kind === 'linen') {
          // Crisp crosshatch plain weave
          weave = 0.5 + 0.25 * Math.sin(x * 1.6) + 0.25 * Math.sin(y * 1.6);
        } else {
          // Corduroy vertical ribs
          weave = 0.5 + 0.5 * Math.cos((x / 256) * Math.PI * 36);
        }
        const n = noise.fbm(x / 256, y / 256, 3, 3);
        const h = weave * 0.75 + n * 0.25;
        fh[y * 256 + x] = h;
        const sh = 0.78 + h * 0.34;
        const fleck = kind === 'denim' && weave > 0.86 ? 26 : 0;
        const idx = (y * 256 + x) * 4;
        dt[idx]     = Math.min(255, baseRGB[0] * sh + fleck) | 0;
        dt[idx + 1] = Math.min(255, baseRGB[1] * sh + fleck) | 0;
        dt[idx + 2] = Math.min(255, baseRGB[2] * sh + fleck) | 0;
        dt[idx + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    return {
      map: makeColorTexture(c),
      normalMap: heightToNormalTexture(fh, 256, 2.4),
    };
  };

  // Glossy ruby strawberry skin with recessed golden achenes (256x256)
  const bSize = 256;
  const berryC = document.createElement('canvas');
  berryC.width = bSize;
  berryC.height = bSize;
  const bCtx = berryC.getContext('2d');
  const bImg = bCtx.createImageData(bSize, bSize);
  const bd = bImg.data;
  const bHeight = new Float32Array(bSize * bSize);
  for (let y = 0; y < bSize; y++) {
    for (let x = 0; x < bSize; x++) {
      const u = x / bSize, v = y / bSize;
      const row = Math.floor(v * 10);
      const su = ((u * 10 + (row % 2) * 0.5) % 1) - 0.5;
      const sv = ((v * 10) % 1) - 0.5;
      const dSeed = Math.hypot(su, sv * 0.75);
      const isSeed = dSeed < 0.11;
      const pit = dSeed < 0.26 ? Math.cos((dSeed / 0.26) * Math.PI * 0.5) * 0.45 : 0;
      bHeight[y * bSize + x] = isSeed ? 0.72 : 0.65 - pit;
      const idx = (y * bSize + x) * 4;
      if (isSeed) {
        bd[idx] = 228; bd[idx + 1] = 192; bd[idx + 2] = 74;
      } else {
        const sh = 1 - pit * 0.45;
        bd[idx] = (208 * sh) | 0; bd[idx + 1] = (28 * sh) | 0; bd[idx + 2] = (38 * sh) | 0;
      }
      bd[idx + 3] = 255;
    }
  }
  bCtx.putImageData(bImg, 0, 0);

  return {
    woolMap: makeColorTexture(woolC),
    woolNormal: heightToNormalTexture(wHeight, wSize, 3.6),
    featherMap: makeColorTexture(featC),
    featherNormal: heightToNormalTexture(fHeight, fSize, 2.5),
    denim: makeFabric([58, 86, 126], 'denim'),
    linen: makeFabric([116, 136, 98], 'linen'),
    corduroy: makeFabric([168, 84, 62], 'corduroy'),
    dadShirt: makeFabric([88, 114, 138], 'linen'),
    berryMap: makeColorTexture(berryC),
    berryNormal: heightToNormalTexture(bHeight, bSize, 3.2),
  };
}

// 8. WORDLESS WOODEN PICTURE SIGNBOARD PAINTINGS (512x384, ZERO TEXT, ZERO UI ARROWS)
export function buildSignboardTexture(sceneIndex = 1, requestedMaterial = 'stone') {
  const w = 512, h = 384;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // Natural warm weathered cedar board background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#c89c6c');
  bg.addColorStop(0.5, '#be905f');
  bg.addColorStop(1, '#ab7d4e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal wood grain streaks
  for (let i = 0; i < 90; i++) {
    const gy = (i / 90) * h;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(90, 56, 26, 0.12)' : 'rgba(245, 218, 182, 0.10)';
    ctx.lineWidth = 2 + (i % 4);
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.bezierCurveTo(w * 0.33, gy + Math.sin(i) * 5, w * 0.66, gy - Math.cos(i) * 5, w, gy);
    ctx.stroke();
  }

  // Recessed darker wooden border frame + brass corner pegs
  ctx.strokeStyle = '#6d4726';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, w - 18, h - 18);

  [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]].forEach(([px, py]) => {
    ctx.fillStyle = '#4f3218';
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // Warm cream chalk/tempera painted vignette center
  ctx.fillStyle = 'rgba(248, 240, 222, 0.82)';
  ctx.beginPath();
  ctx.roundRect(34, 34, w - 68, h - 68, 18);
  ctx.fill();

  const drawPaintedCube = (cx, cy, s, mat) => {
    const palettes = {
      stone: ['#9b9890', '#7e7c75', '#64635d'],
      wood:  ['#c48e58', '#a6723f', '#87592d'],
      grass: ['#6c9840', '#83603e', '#694a2d'],
      earth: ['#855c3a', '#6e492c', '#573820'],
      lantern: ['#ffd97d', '#e5a84b', '#8a5528'],
    };
    const pal = palettes[mat] || palettes.wood;
    // Isometric-ish hand-painted little block icon
    ctx.fillStyle = pal[0];
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.9, cy - s * 0.45);
    ctx.lineTo(cx, cy + s * 0.1);
    ctx.lineTo(cx - s * 0.9, cy - s * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal[1];
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.9, cy - s * 0.45);
    ctx.lineTo(cx, cy + s * 0.1);
    ctx.lineTo(cx, cy + s * 1.0);
    ctx.lineTo(cx - s * 0.9, cy + s * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal[2];
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.9, cy - s * 0.45);
    ctx.lineTo(cx, cy + s * 0.1);
    ctx.lineTo(cx, cy + s * 1.0);
    ctx.lineTo(cx + s * 0.9, cy + s * 0.45);
    ctx.closePath();
    ctx.fill();
  };

  if (sceneIndex === 1) {
    // Scene 1 Picture: A cozy block house built from Stone/Wood/Grass blocks + highlighted current favored block
    // Green meadow hill base
    ctx.fillStyle = '#7ea352';
    ctx.beginPath();
    ctx.ellipse(w * 0.42, h * 0.78, 138, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone foundation blocks
    drawPaintedCube(w * 0.34, h * 0.62, 34, 'stone');
    drawPaintedCube(w * 0.50, h * 0.62, 34, 'stone');
    // Timber upper wall blocks
    drawPaintedCube(w * 0.34, h * 0.46, 34, 'wood');
    drawPaintedCube(w * 0.50, h * 0.46, 34, 'wood');
    // Pitched cedar roof + chimney
    ctx.fillStyle = '#9e5638';
    ctx.beginPath();
    ctx.moveTo(w * 0.21, h * 0.42);
    ctx.lineTo(w * 0.42, h * 0.21);
    ctx.lineTo(w * 0.63, h * 0.42);
    ctx.closePath();
    ctx.fill();
    // Little warm door & window
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(w * 0.39, h * 0.58, 22, 32);
    ctx.fillStyle = '#f5d27a';
    ctx.fillRect(w * 0.48, h * 0.46, 18, 18);

    // Friendly thought-cloud medallion on the right showing the material Dad currently suggests
    ctx.fillStyle = 'rgba(255, 250, 238, 0.95)';
    ctx.strokeStyle = '#b99362';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.46, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawPaintedCube(w * 0.78, h * 0.46, 34, requestedMaterial);
  } else if (sceneIndex === 2) {
    // Scene 2 Picture: Sprouting berry & wheat blocks in dark soil + fluffy square sheep & white square hen
    ctx.fillStyle = '#6a472b';
    ctx.beginPath();
    ctx.roundRect(68, h * 0.67, w - 136, 48, 16);
    ctx.fill();

    // Lush green bush + ruby berries
    drawPaintedCube(155, h * 0.55, 32, 'grass');
    [[142, 198], [166, 204], [154, 186]].forEach(([bx, by]) => {
      ctx.fillStyle = '#d62834';
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Golden wheat sheaves
    ctx.strokeStyle = '#d8a236';
    ctx.lineWidth = 6;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(252 + k * 10, h * 0.68);
      ctx.quadraticCurveTo(252 + k * 14, h * 0.48, 252 + k * 17, h * 0.36);
      ctx.stroke();
    }

    // Painted Square Sheep
    ctx.fillStyle = '#f2ece0';
    ctx.beginPath();
    ctx.roundRect(326, h * 0.44, 68, 56, 12);
    ctx.fill();
    ctx.fillStyle = '#5a4638';
    ctx.beginPath();
    ctx.roundRect(310, h * 0.47, 28, 28, 7);
    ctx.fill();
    ctx.fillRect(336, h * 0.44 + 54, 9, 18);
    ctx.fillRect(372, h * 0.44 + 54, 9, 18);

    // Painted Square Hen
    ctx.fillStyle = '#f8f3e8';
    ctx.beginPath();
    ctx.roundRect(410, h * 0.53, 40, 38, 9);
    ctx.fill();
    ctx.fillStyle = '#d43535';
    ctx.beginPath();
    ctx.arc(428, h * 0.52, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5a428';
    ctx.beginPath();
    ctx.moveTo(450, h * 0.59);
    ctx.lineTo(462, h * 0.62);
    ctx.lineTo(450, h * 0.65);
    ctx.closePath();
    ctx.fill();
  } else {
    // Scene 3 Picture: Starry indigo twilight sky, crescent moon, glowing warm house & lanterns
    ctx.fillStyle = '#232c4a';
    ctx.beginPath();
    ctx.roundRect(48, 48, w - 96, h - 96, 14);
    ctx.fill();

    // Crescent moon & warm stars
    ctx.fillStyle = '#ffe799';
    ctx.beginPath();
    ctx.arc(125, 108, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#232c4a';
    ctx.beginPath();
    ctx.arc(136, 100, 22, 0, Math.PI * 2);
    ctx.fill();

    [[210, 88], [340, 96], [412, 118], [280, 76]].forEach(([sx, sy]) => {
      ctx.fillStyle = '#fff2be';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Warm glowing cottage silhouette
    const glow = ctx.createRadialGradient(w * 0.52, h * 0.62, 12, w * 0.52, h * 0.62, 130);
    glow.addColorStop(0, 'rgba(255, 196, 92, 0.65)');
    glow.addColorStop(1, 'rgba(255, 196, 92, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(48, 48, w - 96, h - 96);

    drawPaintedCube(w * 0.45, h * 0.62, 34, 'stone');
    drawPaintedCube(w * 0.60, h * 0.62, 34, 'wood');
    drawPaintedCube(w * 0.28, h * 0.66, 24, 'lantern');
    drawPaintedCube(w * 0.76, h * 0.66, 24, 'lantern');

    ctx.fillStyle = '#6c3c28';
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.52);
    ctx.lineTo(w * 0.525, h * 0.31);
    ctx.lineTo(w * 0.73, h * 0.52);
    ctx.closePath();
    ctx.fill();

    // Glowing windows
    ctx.fillStyle = '#ffe28a';
    ctx.fillRect(w * 0.43, h * 0.57, 22, 22);
    ctx.fillRect(w * 0.57, h * 0.57, 22, 22);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 9. REALISTIC PROCEDURAL HDR-LIKE SKY ENVIRONMENT MAP (512x256 Equirectangular)
export function buildSkyEnvTexture(sunElevation = 0.55) {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // sunElevation: 1.0 = bright crisp day, 0.35 = sunset magic hour, 0.0 = starry warm night
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (sunElevation > 0.55) {
    g.addColorStop(0.0, '#4f82bd');
    g.addColorStop(0.42, '#9ec4e6');
    g.addColorStop(0.50, '#e6decb');
    g.addColorStop(0.56, '#6e8349');
    g.addColorStop(1.0, '#3e3022');
  } else if (sunElevation > 0.18) {
    // Sunset Magic Hour
    g.addColorStop(0.0, '#2c3968');
    g.addColorStop(0.28, '#7c5278');
    g.addColorStop(0.46, '#e87d4b');
    g.addColorStop(0.51, '#ffc46b');
    g.addColorStop(0.58, '#55472f');
    g.addColorStop(1.0, '#291e16');
  } else {
    // Cozy Twilight Night
    g.addColorStop(0.0, '#0f172e');
    g.addColorStop(0.45, '#1d2b4f');
    g.addColorStop(0.52, '#2a334c');
    g.addColorStop(0.60, '#1e241d');
    g.addColorStop(1.0, '#14110e');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Sun / warm horizon glow disc for natural specular highlights on stone & wood bevels
  const sunX = w * 0.72;
  const sunY = h * (0.49 - sunElevation * 0.24);
  const sg = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, sunElevation > 0.18 ? 65 : 35);
  if (sunElevation > 0.55) {
    sg.addColorStop(0, 'rgba(255, 252, 236, 1.0)');
    sg.addColorStop(0.3, 'rgba(255, 238, 198, 0.55)');
    sg.addColorStop(1, 'rgba(255, 238, 198, 0.0)');
  } else if (sunElevation > 0.18) {
    sg.addColorStop(0, 'rgba(255, 224, 148, 1.0)');
    sg.addColorStop(0.4, 'rgba(255, 132, 66, 0.55)');
    sg.addColorStop(1, 'rgba(255, 110, 50, 0.0)');
  } else {
    sg.addColorStop(0, 'rgba(210, 224, 255, 0.65)');
    sg.addColorStop(1, 'rgba(120, 150, 220, 0.0)');
  }
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAllMaterialAssets() {
  const earth = buildEarthPBR(768);
  const tilled = buildTilledSoilPBR(512);
  const grass = buildGrassPBR(earth, 768);
  const wood = buildWoodPBR(768);
  const stone = buildStonePBR(768);
  const lantern = buildLanternPBR(512);
  const craft = buildCraftPBR();

  const matEarth = new THREE.MeshStandardMaterial({
    map: earth.map,
    normalMap: earth.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: earth.roughnessMap,
    roughness: 0.94,
    metalness: 0.02,
  });

  const matTilled = new THREE.MeshStandardMaterial({
    map: tilled.map,
    normalMap: tilled.normalMap,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: tilled.roughnessMap,
    roughness: 0.82,
    metalness: 0.03,
  });

  const matGrassTop = new THREE.MeshStandardMaterial({
    map: grass.topMap,
    normalMap: grass.topNormal,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: grass.topRoughness,
    roughness: 0.88,
    metalness: 0.01,
  });

  const matGrassSide = new THREE.MeshStandardMaterial({
    map: grass.sideMap,
    normalMap: grass.sideNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: grass.sideRoughness,
    roughness: 0.90,
    metalness: 0.02,
  });

  // 6-face material array for realistic Grass Block (+x, -x, +y top, -y bottom earth, +z, -z)
  const matGrassBlock = [
    matGrassSide,
    matGrassSide,
    matGrassTop,
    matEarth,
    matGrassSide,
    matGrassSide,
  ];

  const matWoodSide = new THREE.MeshStandardMaterial({
    map: wood.sideMap,
    normalMap: wood.sideNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: wood.sideRoughness,
    roughness: 0.68,
    metalness: 0.03,
  });

  const matWoodEnd = new THREE.MeshStandardMaterial({
    map: wood.endMap,
    normalMap: wood.endNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.74,
    metalness: 0.02,
  });

  const matWoodBlock = [
    matWoodSide,
    matWoodSide,
    matWoodEnd,
    matWoodEnd,
    matWoodSide,
    matWoodSide,
  ];

  const matRoofShingle = new THREE.MeshStandardMaterial({
    map: wood.shingleMap,
    normalMap: wood.shingleNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.72,
    metalness: 0.03,
  });

  const matStone = new THREE.MeshStandardMaterial({
    map: stone.map,
    normalMap: stone.normalMap,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: stone.roughnessMap,
    roughness: 0.86,
    metalness: 0.05,
  });

  const matLantern = new THREE.MeshStandardMaterial({
    map: lantern.map,
    normalMap: lantern.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    emissive: new THREE.Color(0xffa838),
    emissiveMap: lantern.emissiveMap,
    emissiveIntensity: 0.25,
    roughness: 0.42,
    metalness: 0.05,
  });

  const matWool = new THREE.MeshStandardMaterial({
    map: craft.woolMap,
    normalMap: craft.woolNormal,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughness: 0.92,
    metalness: 0.0,
  });

  const matFeather = new THREE.MeshStandardMaterial({
    map: craft.featherMap,
    normalMap: craft.featherNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.78,
    metalness: 0.0,
  });

  const matBerry = new THREE.MeshStandardMaterial({
    map: craft.berryMap,
    normalMap: craft.berryNormal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.22,
    metalness: 0.02,
  });

  const outfits = [
    {
      name: 'denim',
      cloth: new THREE.MeshStandardMaterial({
        map: craft.denim.map,
        normalMap: craft.denim.normalMap,
        roughness: 0.82,
      }),
      hatColor: 0xd49b38,
      accentHex: '#3a567e',
      hatHex: '#d49b38',
    },
    {
      name: 'linen',
      cloth: new THREE.MeshStandardMaterial({
        map: craft.linen.map,
        normalMap: craft.linen.normalMap,
        roughness: 0.86,
      }),
      hatColor: 0xd9be86,
      accentHex: '#748862',
      hatHex: '#d9be86',
    },
    {
      name: 'corduroy',
      cloth: new THREE.MeshStandardMaterial({
        map: craft.corduroy.map,
        normalMap: craft.corduroy.normalMap,
        roughness: 0.84,
      }),
      hatColor: 0xc2493a,
      accentHex: '#a8543e',
      hatHex: '#c2493a',
    },
  ];

  const matDadSleeve = new THREE.MeshStandardMaterial({
    map: craft.dadShirt.map,
    normalMap: craft.dadShirt.normalMap,
    roughness: 0.84,
  });

  return {
    matEarth,
    matTilled,
    matGrassTop,
    matGrassSide,
    matGrassBlock,
    matWoodSide,
    matWoodEnd,
    matWoodBlock,
    matRoofShingle,
    matStone,
    matLantern,
    matWool,
    matFeather,
    matBerry,
    outfits,
    matDadSleeve,
  };
}

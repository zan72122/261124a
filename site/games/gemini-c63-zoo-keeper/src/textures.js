import * as THREE from 'three';

// Deterministic fast hash & value/gradient noise for rich procedural PBR maps (all <= 1024px)
function hash2(x, y, seed = 1) {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 1442695041, 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  return (h & 0xfffffff) / 0xfffffff;
}

function noise2(x, y, seed = 1) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, octaves = 4, seed = 1) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2(x * freq, y * freq, seed + i * 17);
    freq *= 2.02;
    amp *= 0.5;
  }
  return v;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// 1. Soft Overcast Diffuse Sky Environment Map (1024x512 Equirectangular -> PMREM)
export function createOvercastEnvironment(renderer) {
  const w = 1024, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0 zenith, 0.5 horizon, 1 nadir
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const theta = u * Math.PI * 2;
      const idx = (y * w + x) * 4;

      if (v < 0.52) {
        // Luminous overcast cloud dome: soft cool-pearl & warm sun-diffused patches
        const skyT = Math.min(1, v / 0.52);
        const cx = Math.cos(theta) * (1.2 + skyT * 2.5);
        const cy = Math.sin(theta) * (1.2 + skyT * 2.5);
        const cloud = fbm(cx * 1.8 + 4.2, cy * 1.8 + 1.7, 4, 11);
        const breakWarm = Math.max(0, Math.cos(theta - 0.9) * (1 - skyT * 0.55));

        // High dynamic range compressed into rich sRGB with bright cloud luminance
        let r = 212 + cloud * 34 + breakWarm * 14 - skyT * 18;
        let g = 220 + cloud * 31 + breakWarm * 11 - skyT * 14;
        let b = 229 + cloud * 24 + breakWarm * 4 - skyT * 10;

        // Soft distant sanctuary tree canopy near horizon (0.43..0.52)
        if (v > 0.42) {
          const treeLine = 0.44 + 0.045 * fbm(u * 18, 2.5, 3, 33);
          if (v > treeLine) {
            const blend = Math.min(1, (v - treeLine) / 0.035);
            const foliage = fbm(u * 42, v * 36, 3, 51);
            const tr = 74 + foliage * 32;
            const tg = 94 + foliage * 38;
            const tb = 66 + foliage * 24;
            r = r * (1 - blend) + tr * blend;
            g = g * (1 - blend) + tg * blend;
            b = b * (1 - blend) + tb * blend;
          }
        }
        d[idx] = Math.min(255, Math.max(0, r));
        d[idx + 1] = Math.min(255, Math.max(0, g));
        d[idx + 2] = Math.min(255, Math.max(0, b));
        d[idx + 3] = 255;
      } else {
        // Damp earth, wet cobblestones & warm sanctuary meadow bounce
        const gndT = (v - 0.52) / 0.48;
        const earth = fbm(Math.cos(theta) * 4, Math.sin(theta) * 4 + gndT * 4, 3, 77);
        d[idx] = 88 + earth * 28 - gndT * 22;
        d[idx + 1] = 84 + earth * 26 - gndT * 20;
        d[idx + 2] = 73 + earth * 20 - gndT * 18;
        d[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  return { envMap: envRT.texture, skyTexture: tex };
}

// 2. Tileable Hair Strand & Voronoi Wet-Clump Data Texture (512x512)
// R: fine strand height (0..255), G/B: vector toward wet-clump center, A: strand tone variation
export function createFurStrandDataTexture() {
  const size = 512;
  const data = new Uint8Array(size * size * 4);

  // Periodic Voronoi clump grid (28x28 clumps per tile -> ~784 realistic wet bundles per tile!)
  const grid = 28;
  const ptsX = new Float32Array(grid * grid);
  const ptsY = new Float32Array(grid * grid);
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const i = gy * grid + gx;
      ptsX[i] = gx + 0.18 + hash2(gx, gy, 101) * 0.64;
      ptsY[i] = gy + 0.18 + hash2(gx, gy, 202) * 0.64;
    }
  }

  // Fine hair strand grid (168x168 strands per tile -> ~28,000 crisp hair fibers per tile!)
  const sGrid = 168;
  const sH = new Float32Array(sGrid * sGrid);
  const sTint = new Float32Array(sGrid * sGrid);
  for (let i = 0; i < sGrid * sGrid; i++) {
    const gx = i % sGrid;
    const gy = (i / sGrid) | 0;
    // Guard hairs (tall) + dense undercoat (mid)
    const r = hash2(gx, gy, 303);
    sH[i] = r > 0.72 ? 0.78 + (r - 0.72) * 0.78 : 0.32 + r * 0.62;
    sTint[i] = 0.76 + hash2(gx, gy, 404) * 0.46;
  }

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const cv = v * grid;
    const cy0 = Math.floor(cv);
    const sv = v * sGrid;
    const sy0 = Math.floor(sv);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const cu = u * grid;
      const cx0 = Math.floor(cu);

      // Nearest wet clump center
      let minDist = 999;
      let bestDx = 0;
      let bestDy = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const gy = (cy0 + oy + grid) % grid;
        for (let ox = -1; ox <= 1; ox++) {
          const gx = (cx0 + ox + grid) % grid;
          const ci = gy * grid + gx;
          const px = ptsX[ci] + Math.floor((cx0 + ox) / grid) * grid;
          const py = ptsY[ci] + Math.floor((cy0 + oy) / grid) * grid;
          const dx = px - cu;
          const dy = py - cv;
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist) {
            minDist = d2;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }

      // Fine strand fiber profile (stretched slightly along U spine flow!)
      const su = u * sGrid * 0.65;
      const sx0 = Math.floor(su);
      let fiberH = 0;
      let fiberTint = 1.0;
      for (let oy = 0; oy <= 1; oy++) {
        for (let ox = 0; ox <= 1; ox++) {
          const gx = (sx0 + ox + sGrid) % sGrid;
          const gy = (sy0 + oy + sGrid) % sGrid;
          const si = gy * sGrid + gx;
          const cx = gx + 0.5 + (hash2(gx, gy, 505) - 0.5) * 0.45;
          const cy = gy + 0.5 + (hash2(gx, gy, 606) - 0.5) * 0.45;
          const dx = (su - cx);
          const dy = (sv - cy);
          const rad = Math.sqrt(dx * dx * 0.65 + dy * dy * 1.25);
          const cone = Math.max(0, 1 - rad * 1.32) * sH[si];
          if (cone > fiberH) {
            fiberH = cone;
            fiberTint = sTint[si];
          }
        }
      }

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, Math.floor(fiberH * 255));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor((bestDx * 0.65 + 0.5) * 255)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor((bestDy * 0.65 + 0.5) * 255)));
      data[idx + 3] = Math.min(255, Math.max(0, Math.floor((fiberTint - 0.5) * 255)));
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// 3. Animal Coat & Skin Albedo/Bump Maps (1024x1024)
export function createZebraCoatTexture() {
  const s = 1024;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const d = img.data;

  for (let y = 0; y < s; y++) {
    const v = y / s; // around body circumference (0.5 = dorsal spine, 0/1 = belly)
    const bellyDist = Math.abs(v - 0.5) * 2; // 0 dorsal, 1 ventral belly
    for (let x = 0; x < s; x++) {
      const u = x / s; // 0 nose -> 1 rump
      const idx = (y * s + x) * 4;

      // Dark velvety muzzle at u < 0.11
      if (u < 0.115) {
        const muzzleBlend = Math.max(0, Math.min(1, (0.115 - u) / 0.045));
        const grain = fbm(u * 90, v * 90, 3, 12);
        const mr = 42 + grain * 14;
        const mg = 38 + grain * 13;
        const mb = 36 + grain * 13;
        if (muzzleBlend > 0.96) {
          d[idx] = mr; d[idx + 1] = mg; d[idx + 2] = mb; d[idx + 3] = 255;
          continue;
        }
      }

      // Anatomical Plains Zebra stripes: vertical on neck/ribs, sweeping diagonally over haunches!
      const warp = fbm(u * 7.5, v * 6.5, 3, 21) * 0.48;
      const haunchSweep = u > 0.62 ? (u - 0.62) * (bellyDist * 2.4) : 0;
      const freq = u < 0.24 ? 26 : 19;
      const phase = (u * freq + haunchSweep * 4.5 + warp) * Math.PI * 2;
      // Hair-follicle serrated edge along stripe boundary
      const follicle = (noise2(u * 280, v * 420, 99) - 0.5) * 0.34;
      let stripe = Math.sin(phase) + follicle;

      // White belly merge on underside
      if (bellyDist > 0.78 && u > 0.32 && u < 0.85) {
        stripe += (bellyDist - 0.78) * 5.2;
      }
      // Dark dorsal spinal stripe
      if (bellyDist < 0.045 && u > 0.18) {
        stripe = -1;
      }

      const tWhite = Math.max(0, Math.min(1, stripe * 2.8 + 0.5));
      const hairVar = (noise2(u * 320, v * 160, 44) - 0.5) * 16;
      // Warm cream-ivory light hair vs deep espresso-charcoal dark hair
      let r = 24 * (1 - tWhite) + (234 + hairVar) * tWhite;
      let g = 20 * (1 - tWhite) + (227 + hairVar) * tWhite;
      let b = 18 * (1 - tWhite) + (214 + hairVar * 0.8) * tWhite;

      if (u < 0.115) {
        const mb = Math.max(0, Math.min(1, (0.115 - u) / 0.045));
        r = r * (1 - mb) + 44 * mb;
        g = g * (1 - mb) + 39 * mb;
        b = b * (1 - mb) + 37 * mb;
      }

      d[idx] = Math.max(0, Math.min(255, r));
      d[idx + 1] = Math.max(0, Math.min(255, g));
      d[idx + 2] = Math.max(0, Math.min(255, b));
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createElephantSkinTextures() {
  const s = 1024;
  const cCol = makeCanvas(s, s);
  const cBump = makeCanvas(s, s);
  const ctxC = cCol.getContext('2d');
  const ctxB = cBump.getContext('2d');
  const imgC = ctxC.createImageData(s, s);
  const imgB = ctxB.createImageData(s, s);
  const dC = imgC.data;
  const dB = imgB.data;

  for (let y = 0; y < s; y++) {
    const v = y / s;
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const idx = (y * s + x) * 4;

      // Deep circumferential folds + crisscross polygonal elephant dermis creases
      const fold1 = Math.abs(Math.sin((u * 48 + fbm(u * 12, v * 12, 3, 5) * 1.9) * Math.PI));
      const fold2 = Math.abs(Math.sin(((u * 26 + v * 28) + fbm(u * 18, v * 18, 2, 9) * 1.4) * Math.PI));
      const fold3 = Math.abs(Math.sin(((u * 24 - v * 30) + fbm(u * 16, v * 16, 2, 14) * 1.4) * Math.PI));
      const pores = noise2(u * 260, v * 260, 61);

      const crease = Math.pow(fold1, 0.35) * 0.52 + Math.pow(fold2 * fold3, 0.28) * 0.36 + pores * 0.12;
      const mottled = fbm(u * 9, v * 9, 4, 88);

      // Authentic warm slate-grey with dusty earthy warmth & pinkish ear/trunk freckles
      const pinkSpeck = u < 0.22 && mottled > 0.63 ? (mottled - 0.63) * 1.8 : 0;
      const base = 102 + crease * 36 + (mottled - 0.5) * 22;
      const r = base + 8 + pinkSpeck * 58;
      const g = base + 3 + pinkSpeck * 24;
      const b = base - 2 + pinkSpeck * 18;

      dC[idx] = Math.max(0, Math.min(255, r));
      dC[idx + 1] = Math.max(0, Math.min(255, g));
      dC[idx + 2] = Math.max(0, Math.min(255, b));
      dC[idx + 3] = 255;

      const bVal = Math.max(0, Math.min(255, crease * 255));
      dB[idx] = bVal; dB[idx + 1] = bVal; dB[idx + 2] = bVal; dB[idx + 3] = 255;
    }
  }
  ctxC.putImageData(imgC, 0, 0);
  ctxB.putImageData(imgB, 0, 0);

  const map = new THREE.CanvasTexture(cCol);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

export function createTigerCoatTexture() {
  const s = 1024;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const d = img.data;

  for (let y = 0; y < s; y++) {
    const v = y / s;
    const bellyDist = Math.abs(v - 0.5) * 2; // 0 spine, 1 belly/chin/cheeks
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const idx = (y * s + x) * 4;

      // White underside, chest, inner cheeks
      const whiteMask = Math.max(0, Math.min(1, (bellyDist - 0.56) / 0.24 + (u < 0.16 && bellyDist > 0.36 ? 0.65 : 0)));
      const hair = (noise2(u * 300, v * 180, 71) - 0.5) * 20;
      const rich = fbm(u * 6, v * 6, 3, 73);

      // Rich burnt-orange / golden-amber pelage transitioning to creamy white belly
      let r = (206 + rich * 28) * (1 - whiteMask) + 239 * whiteMask + hair;
      let g = (114 + rich * 24) * (1 - whiteMask) + 233 * whiteMask + hair * 0.8;
      let b = (42 + rich * 14) * (1 - whiteMask) + 220 * whiteMask + hair * 0.6;

      // Branching organic tiger stripes (thinner, split loops, ragged hair borders)
      const warp = fbm(u * 10, v * 8, 3, 91) * 0.65;
      const sPhase = Math.sin((u * 22 + warp) * Math.PI * 2 + Math.cos(v * 9) * 1.1);
      const jag = (noise2(u * 240, v * 340, 95) - 0.5) * 0.32;
      const stripeMask = Math.max(0, Math.min(1, (-sPhase - 0.52 + jag) * 5.2)) * (bellyDist < 0.88 ? 1 : 0.35);

      r = r * (1 - stripeMask) + 24 * stripeMask;
      g = g * (1 - stripeMask) + 20 * stripeMask;
      b = b * (1 - stripeMask) + 18 * stripeMask;

      d[idx] = Math.max(0, Math.min(255, r));
      d[idx + 1] = Math.max(0, Math.min(255, g));
      d[idx + 2] = Math.max(0, Math.min(255, b));
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createLionCoatTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const d = img.data;
  for (let y = 0; y < s; y++) {
    const v = y / s;
    const belly = Math.max(0, Math.min(1, (Math.abs(v - 0.5) * 2 - 0.62) / 0.28));
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const idx = (y * s + x) * 4;
      const n = fbm(u * 12, v * 12, 3, 121);
      const hair = (noise2(u * 220, v * 140, 123) - 0.5) * 18;
      let r = (196 + n * 24) * (1 - belly) + 234 * belly + hair;
      let g = (150 + n * 20) * (1 - belly) + 221 * belly + hair * 0.85;
      let b = (92 + n * 16) * (1 - belly) + 196 * belly + hair * 0.7;
      d[idx] = Math.max(0, Math.min(255, r));
      d[idx + 1] = Math.max(0, Math.min(255, g));
      d[idx + 2] = Math.max(0, Math.min(255, b));
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createGiraffeCoatTexture() {
  const s = 1024;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const d = img.data;

  // Voronoi polygon giraffe patches
  const gxN = 14, gyN = 12;
  const px = new Float32Array(gxN * gyN);
  const py = new Float32Array(gxN * gyN);
  const shade = new Float32Array(gxN * gyN);
  for (let gy = 0; gy < gyN; gy++) {
    for (let gx = 0; gx < gxN; gx++) {
      const i = gy * gxN + gx;
      px[i] = gx + 0.18 + hash2(gx, gy, 311) * 0.64;
      py[i] = gy + 0.18 + hash2(gx, gy, 317) * 0.64;
      shade[i] = hash2(gx, gy, 331);
    }
  }

  for (let y = 0; y < s; y++) {
    const v = y / s;
    const belly = Math.max(0, Math.min(1, (Math.abs(v - 0.5) * 2 - 0.76) / 0.2));
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const idx = (y * s + x) * 4;
      const cu = u * gxN + (fbm(u * 22, v * 22, 2, 350) - 0.5) * 0.28;
      const cv = v * gyN + (fbm(u * 22, v * 22, 2, 360) - 0.5) * 0.28;
      const cx0 = Math.floor(cu);
      const cy0 = Math.floor(cv);

      let d1 = 999, d2 = 999, sh = 0.5;
      for (let oy = -1; oy <= 1; oy++) {
        const gy = (cy0 + oy + gyN) % gyN;
        for (let ox = -1; ox <= 1; ox++) {
          const gx = (cx0 + ox + gxN) % gxN;
          const ci = gy * gxN + gx;
          const dx = (px[ci] + Math.floor((cx0 + ox) / gxN) * gxN) - cu;
          const dy = (py[ci] + Math.floor((cy0 + oy) / gyN) * gyN) - cv;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < d1) {
            d2 = d1;
            d1 = dist;
            sh = shade[ci];
          } else if (dist < d2) {
            d2 = dist;
          }
        }
      }
      const edge = d2 - d1;
      const hair = (noise2(u * 280, v * 200, 389) - 0.5) * 16;
      const patchMask = Math.max(0, Math.min(1, (edge - 0.075) / 0.035)) * (1 - belly * 0.85) * (u < 0.08 ? 0.15 : 1);

      const creamR = 230 + hair, creamG = 213 + hair * 0.9, creamB = 180 + hair * 0.7;
      const spotR = 118 + sh * 36 + hair * 0.6;
      const spotG = 66 + sh * 24 + hair * 0.5;
      const spotB = 34 + sh * 14 + hair * 0.4;

      d[idx] = Math.max(0, Math.min(255, creamR * (1 - patchMask) + spotR * patchMask));
      d[idx + 1] = Math.max(0, Math.min(255, creamG * (1 - patchMask) + spotG * patchMask));
      d[idx + 2] = Math.max(0, Math.min(255, creamB * (1 - patchMask) + spotB * patchMask));
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 4. Cellular Soap Foam Bump Texture (512x512)
export function createFoamBubbleTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a8a8a8';
  ctx.fillRect(0, 0, s, s);
  // Multi-scale creamy micro-bubbles
  for (let i = 0; i < 1600; i++) {
    const x = hash2(i, 1, 701) * s;
    const y = hash2(i, 2, 709) * s;
    const r = i < 1200 ? 2 + hash2(i, 3, 719) * 5 : 6 + hash2(i, 3, 727) * 14;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const gx = x + ox * s;
        const gy = y + oy * s;
        if (gx < -r || gx > s + r || gy < -r || gy > s + r) continue;
        const grad = ctx.createRadialGradient(gx - r * 0.25, gy - r * 0.25, r * 0.05, gx, gy, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.92)');
        grad.addColorStop(0.75, 'rgba(215,215,215,0.75)');
        grad.addColorStop(1, 'rgba(120,120,120,0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 5. Sanctuary Ground, Weathered Wood & Watermelon Textures
export function createGroundTextures() {
  const s = 1024;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const d = img.data;
  for (let y = 0; y < s; y++) {
    const v = y / s;
    const ay = v * Math.PI * 2;
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const ax = u * Math.PI * 2;
      const idx = (y * s + x) * 4;
      // Seamless 4D torus noise projection so repeat(4,4) has ZERO visible tile seams!
      const nx = Math.cos(ax) * 2.2 + 5.0;
      const ny = Math.sin(ax) * 2.2 + 5.0;
      const nz = Math.cos(ay) * 2.2 + 5.0;
      const nw = Math.sin(ay) * 2.2 + 5.0;
      const earth = fbm(nx + nz * 0.7, ny + nw * 0.7, 4, 801);
      const moss = fbm(nx * 0.8 - nw, ny * 0.8 + nz, 3, 811);
      const pebble = noise2((x % 256) * 0.65, (y % 256) * 0.65, 821);
      const cobble = Math.sin(ax * 9 + earth * 3.2) * Math.sin(ay * 9 + moss * 3.2);
      const stoneEdge = cobble > 0.22 ? 1.08 : 0.92;

      const grassMix = Math.max(0, Math.min(1, (moss - 0.50) * 3.0));
      const stoneR = (108 + earth * 34 + (pebble - 0.5) * 24) * stoneEdge;
      const stoneG = (101 + earth * 32 + (pebble - 0.5) * 22) * stoneEdge;
      const stoneB = (90 + earth * 26 + (pebble - 0.5) * 18) * stoneEdge;
      const grassR = 72 + earth * 26;
      const grassG = 96 + earth * 32;
      const grassB = 54 + earth * 18;
      d[idx] = Math.max(0, Math.min(255, stoneR * (1 - grassMix) + grassR * grassMix));
      d[idx + 1] = Math.max(0, Math.min(255, stoneG * (1 - grassMix) + grassG * grassMix));
      d[idx + 2] = Math.max(0, Math.min(255, stoneB * (1 - grassMix) + grassB * grassMix));
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  return map;
}

export function createWoodTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  const d = img.data;
  for (let y = 0; y < s; y++) {
    const v = y / s;
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const idx = (y * s + x) * 4;
      const ring = Math.sin((v * 22 + fbm(u * 4, v * 12, 3, 901) * 2.4) * Math.PI * 2) * 0.5 + 0.5;
      const fiber = noise2(u * 180, v * 28, 907);
      const plank = Math.abs(((y % 128) - 64) / 64) > 0.96 ? 0.72 : 1.0;
      d[idx] = (128 + ring * 34 + fiber * 14) * plank;
      d[idx + 1] = (96 + ring * 26 + fiber * 11) * plank;
      d[idx + 2] = (66 + ring * 18 + fiber * 8) * plank;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createWatermelonTextures() {
  const s = 512;
  // Rind texture
  const cR = makeCanvas(s, s);
  const ctxR = cR.getContext('2d');
  const imgR = ctxR.createImageData(s, s);
  const dR = imgR.data;
  for (let y = 0; y < s; y++) {
    const v = y / s;
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const idx = (y * s + x) * 4;
      const jag = (fbm(u * 24, v * 18, 3, 951) - 0.5) * 0.55;
      const stripe = Math.sin((u * 13 + jag) * Math.PI * 2);
      const dark = Math.max(0, Math.min(1, stripe * 2.4 + 0.5));
      const mottle = noise2(u * 80, v * 80, 953) * 14;
      dR[idx] = 32 * dark + 108 * (1 - dark) + mottle * 0.5;
      dR[idx + 1] = 74 * dark + 158 * (1 - dark) + mottle;
      dR[idx + 2] = 36 * dark + 74 * (1 - dark) + mottle * 0.4;
      dR[idx + 3] = 255;
    }
  }
  ctxR.putImageData(imgR, 0, 0);
  const rindMap = new THREE.CanvasTexture(cR);
  rindMap.colorSpace = THREE.SRGBColorSpace;

  // Juicy flesh texture (red & golden variants)
  const makeFlesh = (isGolden) => {
    const cf = makeCanvas(s, s);
    const ctx = cf.getContext('2d');
    const cx = s / 2, cy = s / 2, maxR = s * 0.48;
    const grad = ctx.createRadialGradient(cx, cy, maxR * 0.1, cx, cy, maxR);
    grad.addColorStop(0, isGolden ? '#f6be28' : '#d92b38');
    grad.addColorStop(0.82, isGolden ? '#ebad1e' : '#c92632');
    grad.addColorStop(0.91, '#e8eed2');
    grad.addColorStop(1.0, '#2c6830');
    ctx.fillStyle = '#2c6830';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fill();

    // Realistic glossy black teardrop seeds
    ctx.fillStyle = '#1b1412';
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? 10 : 16;
      const rad = maxR * (ring === 0 ? 0.42 : 0.66);
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + ring * 0.25;
        ctx.save();
        ctx.translate(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
        ctx.rotate(ang + Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.5, 8.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    const t = new THREE.CanvasTexture(cf);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  return { rindMap, redFleshMap: makeFlesh(false), goldFleshMap: makeFlesh(true) };
}

// 6. Zero-Text Hand-Painted Wooden Picture Signboard ("ルールは絵の看板1枚で見せる")
export function createSignboardTexture(sceneIndex = 0) {
  const w = 512, h = 384;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Natural warm painted cedar wood background (ZERO text, ZERO numbers, ZERO arrows!)
  ctx.fillStyle = '#dfd3bc';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = `rgba(145, 112, 74, ${0.05 + 0.05 * Math.sin(y * 0.08)})`;
    ctx.fillRect(0, y, w, 2);
  }
  ctx.strokeStyle = '#6c4f33';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.strokeStyle = '#9c7853';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, w - 44, h - 44);

  const drawCloudFoam = (cx, cy, scale = 1) => {
    ctx.fillStyle = '#fbfcfd';
    ctx.strokeStyle = '#b9c9d4';
    ctx.lineWidth = 2.5;
    const puffs = [[-22, 6, 18], [0, -6, 23], [22, 5, 17], [-8, 12, 16], [12, 12, 16]];
    puffs.forEach(([ox, oy, r]) => {
      ctx.beginPath();
      ctx.arc(cx + ox * scale, cy + oy * scale, r * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  };

  const drawDroplets = (cx, cy, dir = 1) => {
    ctx.fillStyle = '#67add6';
    for (let i = 0; i < 6; i++) {
      const ang = -0.55 + i * 0.22;
      const dist = 28 + (i % 2) * 18;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(ang) * dist * dir, cy + Math.sin(ang) * dist, 7, 4, ang * dir, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (sceneIndex === 0) {
    // Dress-up picture board: Rubber Boots + Keeper Apron -> Happy Girl Keeper!
    // Left: Yellow/Olive Rubber Boots
    ctx.fillStyle = '#d49b2a';
    ctx.beginPath();
    ctx.roundRect(72, 130, 44, 92, 10);
    ctx.roundRect(72, 194, 72, 34, 14);
    ctx.fill();
    ctx.fillStyle = '#dfa835';
    ctx.beginPath();
    ctx.roundRect(156, 130, 44, 92, 10);
    ctx.roundRect(156, 194, 72, 34, 14);
    ctx.fill();

    // Right: Keeper Canvas Apron with pocket & brush
    ctx.fillStyle = '#6b8058';
    ctx.beginPath();
    ctx.moveTo(310, 102);
    ctx.lineTo(392, 102);
    ctx.lineTo(414, 256);
    ctx.lineTo(288, 256);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#48583a';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = '#536643';
    ctx.fillRect(322, 182, 58, 44);
  } else if (sceneIndex === 1) {
    // Scene 1 picture board: Zebra + Elephant covered in fluffy bubbles & sparkling hose water!
    // Left silhouette: Striped Zebra with foam crown
    ctx.fillStyle = '#f2ede2';
    ctx.strokeStyle = '#26221e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(148, 224, 62, 42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(98, 152, 26, 44, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Stripes
    ctx.strokeStyle = '#221e1b';
    ctx.lineWidth = 6;
    for (let sx = -36; sx <= 36; sx += 18) {
      ctx.beginPath();
      ctx.moveTo(148 + sx, 185);
      ctx.lineTo(144 + sx, 260);
      ctx.stroke();
    }
    drawCloudFoam(148, 178, 1.05);
    drawCloudFoam(100, 118, 0.72);

    // Right: Gentle Grey Elephant + Trunk Water Splash!
    ctx.fillStyle = '#8b8e90';
    ctx.strokeStyle = '#4c4f52';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(362, 222, 74, 54, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(302, 178, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Curved raised trunk
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8b8e90';
    ctx.beginPath();
    ctx.moveTo(272, 188);
    ctx.quadraticCurveTo(234, 186, 246, 134);
    ctx.stroke();
    drawCloudFoam(368, 165, 1.15);
    drawDroplets(246, 118, -1);
  } else if (sceneIndex === 2) {
    // Scene 2 picture board: Tiger + Brush | Lion + Bowl | Giraffe + High Leaves
    // 1. Tiger + Brush
    ctx.fillStyle = '#d97b29';
    ctx.beginPath();
    ctx.arc(105, 205, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#231c18';
    ctx.lineWidth = 5;
    [-22, 0, 22].forEach((dy) => {
      ctx.beginPath(); ctx.moveTo(68, 205 + dy); ctx.lineTo(86, 205 + dy * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(142, 205 + dy); ctx.lineTo(124, 205 + dy * 0.7); ctx.stroke();
    });
    // Wooden Brush above Tiger
    ctx.fillStyle = '#9c6b3b';
    ctx.beginPath();
    ctx.roundRect(72, 102, 68, 24, 10);
    ctx.fill();
    ctx.fillStyle = '#e7d9be';
    ctx.fillRect(78, 126, 56, 14);

    // 2. Lion with Golden Mane + Food Bowl
    ctx.fillStyle = '#7a471e';
    ctx.beginPath();
    ctx.arc(256, 178, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d6a45c';
    ctx.beginPath();
    ctx.arc(256, 182, 35, 0, Math.PI * 2);
    ctx.fill();
    // Food bowl
    ctx.fillStyle = '#b84336';
    ctx.beginPath();
    ctx.arc(256, 258, 24, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#8b6f4e';
    ctx.beginPath();
    ctx.roundRect(222, 256, 68, 24, 8);
    ctx.fill();

    // 3. Giraffe + High Green Branch
    ctx.fillStyle = '#dfbe7d';
    ctx.beginPath();
    ctx.moveTo(382, 286);
    ctx.lineTo(404, 148);
    ctx.lineTo(432, 152);
    ctx.lineTo(422, 286);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(404, 142, 26, 18, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c4420';
    [[398, 185], [412, 215], [396, 248], [412, 268]].forEach(([gx, gy]) => {
      ctx.beginPath(); ctx.arc(gx, gy, 8, 0, Math.PI * 2); ctx.fill();
    });
    // High leafy branch
    ctx.strokeStyle = '#5a4328';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(352, 82);
    ctx.lineTo(448, 104);
    ctx.stroke();
    ctx.fillStyle = '#4f8f3c';
    [[368, 92], [388, 98], [412, 102], [432, 108]].forEach(([lx, ly]) => {
      ctx.beginPath(); ctx.ellipse(lx, ly, 12, 7, 0.5, 0, Math.PI * 2); ctx.fill();
    });
  } else {
    // Scene 3 picture board: Rolled & Sliced Watermelons + All Animals Party!
    // Whole striped watermelon
    ctx.fillStyle = '#3b7d3b';
    ctx.beginPath();
    ctx.arc(146, 195, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f4921';
    ctx.lineWidth = 8;
    [-30, -10, 10, 30].forEach((dx) => {
      ctx.beginPath();
      ctx.arc(146 + dx * 0.4, 195, 54, -1.2, 1.2);
      ctx.stroke();
    });
    // Sliced juicy red wedge
    ctx.fillStyle = '#2f6d31';
    ctx.beginPath();
    ctx.arc(345, 175, 76, 0.15, Math.PI - 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d92f3b';
    ctx.beginPath();
    ctx.arc(345, 175, 64, 0.2, Math.PI - 0.2);
    ctx.closePath();
    ctx.fill();
    drawCloudFoam(250, 112, 0.85);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

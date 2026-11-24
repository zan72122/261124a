import * as THREE from '../vendor/three.module.min.js';

function hash2(x, y, seed = 1) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x, y, periodX, periodY, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const x0 = ((xi % periodX) + periodX) % periodX;
  const x1 = (x0 + 1) % periodX;
  const y0 = ((yi % periodY) + periodY) % periodY;
  const y1 = (y0 + 1) % periodY;

  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);

  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbmTile(u, v, baseFreq, octaves = 4, seed = 1) {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * smoothNoise(u * freq, v * freq, freq, freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function heightToNormalTexture(heightData, w, h, strength = 1.8) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;

      const tl = heightData[ym * w + xm];
      const l = heightData[y * w + xm];
      const bl = heightData[yp * w + xm];
      const tr = heightData[ym * w + xp];
      const r = heightData[y * w + xp];
      const br = heightData[yp * w + xp];
      const t = heightData[ym * w + x];
      const b = heightData[yp * w + x];

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const inv = 1.0 / Math.hypot(dx, dy, dz);

      const idx = (y * w + x) * 4;
      data[idx] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// HDR-like Dawn Street PMREM Environment (aligned with low raking front-left morning sun!)
export function createDawnStreetEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();

  const skyGeo = new THREE.SphereGeometry(40, 48, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(-0.88, 0.20, 0.42).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSunDir;
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 zenith = vec3(0.14, 0.27, 0.50);
        vec3 midSky = vec3(0.44, 0.60, 0.80);
        vec3 horizon = vec3(1.35, 0.88, 0.52);
        vec3 ground = vec3(0.06, 0.07, 0.09);

        vec3 col;
        if (y >= 0.0) {
          float t1 = pow(clamp(1.0 - y, 0.0, 1.0), 3.4);
          col = mix(zenith, midSky, pow(clamp(1.0 - y, 0.0, 1.0), 1.25));
          col = mix(col, horizon, t1);
        } else {
          col = mix(horizon * 0.34, ground, clamp(-y * 5.0, 0.0, 1.0));
        }

        float sunDot = max(dot(d, uSunDir), 0.0);
        col += vec3(2.2, 1.25, 0.55) * pow(sunDot, 12.0) * 0.9;
        col += vec3(8.0, 5.8, 3.4) * pow(sunDot, 220.0);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));

  // Urban horizon silhouettes for crisp automotive clearcoat & stainless steel reflections
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x18202c });
  const warmWallMat = new THREE.MeshBasicMaterial({ color: 0xe6a66c });
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const dirX = Math.cos(ang);
    const dirZ = Math.sin(ang);
    if (dirX < -0.55 && dirZ > 0.0) continue; // leave morning sun corridor clear!
    const dist = 18 + (i % 3) * 3;
    const h = 4.2 + (i % 4) * 2.0;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, h, 2.5),
      dirX > 0.2 ? warmWallMat : darkMat
    );
    b.position.set(dirX * dist, h * 0.38 - 1.2, dirZ * dist);
    b.lookAt(0, h * 0.38 - 1.2, 0);
    envScene.add(b);
  }

  // Bright overhead sky strip & warm dawn bounce cards for realistic curved metal highlights
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.5, 2.8) });
  const skyStrip = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), stripMat);
  skyStrip.rotation.x = Math.PI / 2;
  skyStrip.position.set(2, 14, 4);
  envScene.add(skyStrip);

  const rt = pmrem.fromScene(envScene, 0.012);
  pmrem.dispose();
  skyGeo.dispose();
  skyMat.dispose();
  return rt.texture;
}

// 1024x1024 Hero Wet Asphalt Pavement Texture Suite (Rich dark damp basalt, aggregate stones, mirror puddle basins)
export function createWetAsphaltTextures() {
  const size = 1024;
  const colorData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const heightData = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;

      const macro = fbmTile(u, v, 4, 4, 11);
      const mid = fbmTile(u, v, 14, 3, 37);
      const coarseStone = smoothNoise(u * 96, v * 96, 96, 96, 53);
      const fineStone = smoothNoise(u * 220, v * 220, 220, 220, 89);
      const pebble = Math.pow(coarseStone, 1.8) * 0.62 + fineStone * 0.38;

      // Subtle tarmac crack
      const crackWave = Math.abs(v - 0.52 - (fbmTile(u, 0.3, 6, 3, 71) - 0.5) * 0.16);
      const crack = crackWave < 0.004 ? 1.0 - crackWave / 0.004 : 0.0;

      const basin = macro * 0.7 + mid * 0.3;
      const puddle = Math.max(0, Math.min(1, (0.48 - basin) * 6.8));
      const dampMargin = Math.max(0, Math.min(1, (0.60 - basin) * 4.2));

      // Smooth height in puddles, crisp stone aggregate on damp dry zones
      heightData[idx] = (pebble * 0.72 + mid * 0.28 - crack * 0.65) * (1.0 - puddle * 0.97);

      const graniteFlecks = pebble > 0.74 ? (pebble - 0.74) * 1.35 : 0;
      const dryLum = 48 + pebble * 34 + graniteFlecks * 42 - crack * 20;
      const wetDarken = 1.0 - dampMargin * 0.46 - puddle * 0.20;

      const p4 = idx * 4;
      colorData[p4] = Math.max(11, Math.min(255, dryLum * wetDarken * 0.96));
      colorData[p4 + 1] = Math.max(12, Math.min(255, dryLum * wetDarken * 0.99));
      colorData[p4 + 2] = Math.max(15, Math.min(255, dryLum * wetDarken * 1.08));
      colorData[p4 + 3] = 255;

      let rough = 0.68 - dampMargin * 0.38;
      rough = rough * (1.0 - puddle) + 0.032 * puddle;
      const rByte = Math.max(8, Math.min(240, Math.round(rough * 255)));
      roughData[p4] = rByte;
      roughData[p4 + 1] = rByte;
      roughData[p4 + 2] = rByte;
      roughData[p4 + 3] = rByte;
      roughData[p4 + 3] = 255;
    }
  }

  const map = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 8;
  roughnessMap.needsUpdate = true;

  const normalMap = heightToNormalTexture(heightData, size, size, 1.45);
  normalMap.anisotropy = 8;

  return { map, roughnessMap, normalMap };
}

// 1024x1024 Smooth Anisotropic Brushed Stainless Hopper Steel (NO grainy pixel static!)
export function createBrushedSteelTextures() {
  const size = 1024;
  const colorData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
  const heightData = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    // Edge weld & subtle hydraulic grease patina near borders
    const borderDist = Math.min(v, 1.0 - v);
    const patina = borderDist < 0.08 ? (1.0 - borderDist / 0.08) * 0.22 : 0.0;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const borderU = Math.min(u, 1.0 - u);
      const seam = borderU < 0.008 || borderDist < 0.008 ? 1.0 : 0.0;

      // Smooth directional brushed steel bands (stretched strongly along U, fine along V)
      const brush1 = smoothNoise(u * 12, v * 180, 12, 180, 31);
      const brush2 = smoothNoise(u * 24, v * 360, 24, 360, 67);
      const broadSheen = fbmTile(u, v, 4, 3, 15);

      const brushVal = brush1 * 0.6 + brush2 * 0.4;
      const idx = y * size + x;
      heightData[idx] = brushVal * 0.35 + broadSheen * 0.25 - seam * 0.65;

      const baseLum = (196 + (brushVal - 0.5) * 28 + (broadSheen - 0.5) * 22) * (1.0 - patina - seam * 0.35);
      const p4 = idx * 4;
      colorData[p4] = Math.max(40, Math.min(250, baseLum * 0.97));
      colorData[p4 + 1] = Math.max(42, Math.min(252, baseLum * 1.0));
      colorData[p4 + 2] = Math.max(46, Math.min(255, baseLum * 1.04));
      colorData[p4 + 3] = 255;

      const rough = 0.19 + (1.0 - brushVal) * 0.14 + patina * 0.32 + seam * 0.25;
      const rByte = Math.max(28, Math.min(220, Math.round(rough * 255)));
      roughData[p4] = rByte;
      roughData[p4 + 1] = rByte;
      roughData[p4 + 2] = rByte;
      roughData[p4 + 3] = 255;
    }
  }

  const map = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 8;
  roughnessMap.needsUpdate = true;

  const normalMap = heightToNormalTexture(heightData, size, size, 0.45);
  normalMap.anisotropy = 8;

  return { map, roughnessMap, normalMap };
}

// Smooth Pressed-Steel Automotive Panel Normal Map
export function createTruckPaintNormalMap() {
  const size = 512;
  const heightData = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const ribPhase = (v * 4.0) % 1.0;
    const rib =
      ribPhase > 0.42 && ribPhase < 0.58
        ? Math.sin(((ribPhase - 0.42) / 0.16) * Math.PI) * 0.32
        : 0;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const softWave = fbmTile(u, v, 8, 2, 19) * 0.04;
      heightData[y * size + x] = rib + softWave;
    }
  }
  return heightToNormalTexture(heightData, size, size, 0.75);
}

// Woven Fabric Normal Map for Realistic Clothing & Safety Vests
export function createFabricNormalMap() {
  const size = 256;
  const heightData = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const weave = (Math.sin(u * Math.PI * 96) * 0.5 + 0.5) * (Math.sin(v * Math.PI * 96) * 0.5 + 0.5) * 0.25;
      const fold = Math.sin(u * Math.PI * 4 + fbmTile(u, v, 4, 2, 5) * 2.0) * 0.35;
      heightData[y * size + x] = weave + fold;
    }
  }
  return heightToNormalTexture(heightData, size, size, 0.65);
}

export function createHazardStripeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#181b20';
  for (let i = -256; i < 512; i += 86) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 43, 0);
    ctx.lineTo(i - 213, 256);
    ctx.lineTo(i - 256, 256);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Concrete Block Wall & Curb Stone Texture (512x512 with realistic weathering & damp base)
export function createConcreteTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;
  const heightData = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * 4);
    const vLocal = (v * 4) % 1.0;
    const hJoint = vLocal < 0.04 || vLocal > 0.96 ? 1.0 : 0.0;

    for (let x = 0; x < size; x++) {
      const u = (x / size + (row % 2) * 0.25) % 1.0;
      const uLocal = (u * 2) % 1.0;
      const vJoint = uLocal < 0.025 || uLocal > 0.975 ? 1.0 : 0.0;
      const joint = Math.max(hJoint, vJoint);

      const n = fbmTile(x / size, v, 12, 4, 105);
      const pores = smoothNoise((x / size) * 128, v * 128, 128, 128, 211);
      const damp = Math.max(0, 1.0 - (1.0 - v) * 2.8) * 0.26;

      heightData[y * size + x] = n * 0.65 + pores * 0.35 - joint * 0.75;

      const lum = (138 + n * 38 + (pores - 0.5) * 20 - joint * 42) * (1.0 - damp);
      const p = (y * size + x) * 4;
      d[p] = lum * 0.99;
      d[p + 1] = lum * (1.0 + damp * 0.06); // faint natural moss/dampness at bottom
      d[p + 2] = lum * 0.96;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  const normalMap = heightToNormalTexture(heightData, size, size, 1.35);
  return { map, normalMap };
}

// Knitted Cotton Work Glove (軍手) Texture
export function createGloveTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ece6da';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const shade = 224 + Math.floor(hash2(x, y, 7) * 22);
      ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 12})`;
      ctx.fillRect(x, y, 3, 3);
    }
  }
  ctx.fillStyle = '#eab308';
  for (let y = 96; y < 220; y += 12) {
    for (let x = 24; x < 232; x += 12) {
      ctx.beginPath();
      ctx.arc(x + ((y / 12) % 2) * 6, y, 3.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawCategoryIllustration(ctx, category, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);

  if (category === 'bottle') {
    const drawBottle = (ox, oy, scale, col, hiCol, rot) => {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-11, -38);
      ctx.lineTo(11, -38);
      ctx.lineTo(10, -20);
      ctx.quadraticCurveTo(25, -8, 25, 10);
      ctx.lineTo(25, 38);
      ctx.quadraticCurveTo(25, 44, 18, 44);
      ctx.lineTo(-18, 44);
      ctx.quadraticCurveTo(-25, 44, -25, 38);
      ctx.lineTo(-25, 10);
      ctx.quadraticCurveTo(-25, -8, -10, -20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-14, 2);
      ctx.lineTo(-14, 34);
      ctx.stroke();
      ctx.fillStyle = hiCol;
      ctx.fillRect(-12, -41, 24, 6);
      ctx.restore();
    };
    drawBottle(-r * 0.22, r * 0.04, (r / 62) * 0.92, '#1e7e5c', '#eab308', -0.1);
    drawBottle(r * 0.22, r * 0.08, (r / 62) * 0.86, '#9a521b', '#cbd5e1', 0.12);
  } else if (category === 'can') {
    const s = r / 58;
    ctx.scale(s, s);
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-28, -34, 56, 70, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f97316';
    ctx.fillRect(-26, -12, 52, 30);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(7, -8, 5, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(0, -34, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (category === 'paper') {
    const s = r / 58;
    ctx.scale(s, s);
    ctx.save();
    ctx.rotate(-0.12);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-34, -22, 46, 54);
    ctx.strokeRect(-34, -22, 46, 54);
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(-27, -14, 32, 16);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-27, 8, 32, 5);
    ctx.fillRect(-27, 18, 24, 5);
    ctx.restore();

    ctx.save();
    ctx.translate(15, 4);
    ctx.rotate(0.08);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.fillRect(-15, -16, 30, 44);
    ctx.strokeRect(-15, -16, 30, 44);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-14, 0, 28, 16);
    ctx.beginPath();
    ctx.moveTo(-15, -16);
    ctx.lineTo(0, -29);
    ctx.lineTo(15, -16);
    ctx.closePath();
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (category === 'organic') {
    const s = r / 58;
    ctx.scale(s, s);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(-10, -22, 20, 36);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(0, -22, 20, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 16, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.ellipse(-3, -3, 2, 3.5, 0.2, 0, Math.PI * 2);
    ctx.ellipse(4, -1, 2, 3.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(3, -38);
    ctx.stroke();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(11, -34, 9, 5, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.quadraticCurveTo(32, 10, 20, 28);
    ctx.stroke();
  }

  ctx.restore();
}

export function createCrateEmblemTexture(category, bgHex) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = bgHex;
  ctx.lineWidth = 18;
  ctx.strokeRect(12, 12, 232, 232);

  ctx.fillStyle = '#94a3b8';
  [
    [28, 28],
    [228, 28],
    [28, 228],
    [228, 228],
  ].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  drawCategoryIllustration(ctx, category, 128, 128, 76);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPictorialSignboardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#fbf9f3');
  g.addColorStop(1, '#eae6dc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#1e5b7a';
  ctx.lineWidth = 18;
  ctx.strokeRect(14, 14, 484, 484);

  const cols = [
    { cat: 'bottle', col: '#2563eb', x: 78 },
    { cat: 'can', col: '#eab308', x: 186 },
    { cat: 'paper', col: '#94a3b8', x: 294 },
    { cat: 'organic', col: '#16a34a', x: 402 },
  ];

  cols.forEach(({ cat, col, x }) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = col;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(x - 44, 44, 88, 112, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x - 38, 124, 76, 26, 6);
    ctx.fill();

    drawCategoryIllustration(ctx, cat, x, 88, 34);
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(236, 172);
  ctx.lineTo(276, 172);
  ctx.lineTo(276, 194);
  ctx.lineTo(292, 194);
  ctx.lineTo(256, 220);
  ctx.lineTo(220, 194);
  ctx.lineTo(236, 194);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(256, 286);
  ctx.fillStyle = '#1d628c';
  ctx.beginPath();
  ctx.roundRect(-120, -44, 152, 74, 12);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.roundRect(-132, -26, 28, 54, 6);
  ctx.fill();
  ctx.fillStyle = '#2678a8';
  ctx.beginPath();
  ctx.roundRect(38, -28, 66, 58, 10);
  ctx.fill();
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.roundRect(68, -20, 30, 26, 5);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  [-76, 68].forEach((wx) => {
    ctx.beginPath();
    ctx.arc(wx, 34, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(wx, 34, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
  });
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-102, -6);
  ctx.lineTo(-124, -34);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(-126, -36, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(236, 344);
  ctx.lineTo(276, 344);
  ctx.lineTo(276, 362);
  ctx.lineTo(292, 362);
  ctx.lineTo(256, 386);
  ctx.lineTo(220, 362);
  ctx.lineTo(236, 362);
  ctx.closePath();
  ctx.fill();

  const rCols = ['#fb7185', '#fbbf24', '#4ade80', '#38bdf8'];
  rCols.forEach((rc, i) => {
    ctx.strokeStyle = rc;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(256, 468, 92 - i * 7, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  });

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.roundRect(76, 456, 360, 22, 10);
  ctx.fill();

  const fSpots = [
    { x: 118, col: '#f43f5e' },
    { x: 186, col: '#f59e0b' },
    { x: 256, col: '#ec4899' },
    { x: 326, col: '#3b82f6' },
    { x: 394, col: '#eab308' },
  ];
  fSpots.forEach(({ x, col }) => {
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, 458);
    ctx.lineTo(x, 424);
    ctx.stroke();

    ctx.fillStyle = col;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 11, 420 + Math.sin(a) * 11, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(x, 420, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createNewspaperTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eeeae0';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(120,115,105,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }

  ctx.fillStyle = '#6b8cad';
  ctx.fillRect(18, 20, 102, 74);
  ctx.fillStyle = '#d99b66';
  ctx.beginPath();
  ctx.arc(52, 48, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f624d';
  ctx.beginPath();
  ctx.moveTo(18, 94);
  ctx.lineTo(65, 58);
  ctx.lineTo(120, 94);
  ctx.fill();

  ctx.fillStyle = '#9ca3af';
  for (let y = 22; y < 236; y += 11) {
    if (y < 102) {
      ctx.fillRect(132, y, 96 + ((y * 7) % 14), 4.5);
    } else {
      ctx.fillRect(18, y, 96, 4.5);
      ctx.fillRect(132, y, 102, 4.5);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCanLabelTexture(accent = '#ea580c', stripe = '#facc15') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 10, 256, 14);
  ctx.fillRect(0, 104, 256, 12);
  ctx.fillStyle = stripe;
  for (let x = 28; x < 240; x += 64) {
    ctx.beginPath();
    ctx.arc(x, 64, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(x + 8, 44, 8, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = stripe;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// Dappled Morning Tree Foliage Texture (256x256 — eliminates low-poly solid-green spheres!)
export function createFoliageTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f3f26';
  ctx.fillRect(0, 0, size, size);

  const heightData = new Float32Array(size * size);
  const colors = ['#1b3822', '#264d2d', '#346439', '#497d44', '#6d9952'];
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rx = 3 + Math.random() * 6;
    const ry = 2 + Math.random() * 4;
    const ang = Math.random() * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const img = ctx.getImageData(0, 0, size, size).data;
  for (let i = 0; i < size * size; i++) {
    heightData[i] = img[i * 4 + 1] / 255;
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  const normalMap = heightToNormalTexture(heightData, size, size, 1.9);
  return { map, normalMap };
}

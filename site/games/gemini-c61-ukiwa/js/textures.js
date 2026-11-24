import * as THREE from '../vendor/three.module.min.js';

// All procedural textures kept <= 1024px for crisp mobile 60fps performance.

// 1. True FloatType HDR Summer Midday Environment Map for razor-sharp vinyl specular highlights
export function createSummerEnvMap(renderer) {
  const width = 512;
  const height = 256;
  const data = new Float32Array(width * height * 4);

  // Blazing summer midday sun direction (high elevation, slightly front-right-back so strong rim + top highlights hit floats)
  const sunDir = new THREE.Vector3(0.42, 0.78, 0.46).normalize();
  const bouncePoolDir = new THREE.Vector3(0.0, -0.65, 0.76).normalize();
  const dir = new THREE.Vector3();

  for (let y = 0; y < height; y++) {
    const v = 1.0 - (y + 0.5) / height; // 1 = zenith, 0 = nadir
    const theta = (1.0 - v) * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const phi = u * Math.PI * 2.0;

      dir.set(
        -sinTheta * Math.sin(phi),
        cosTheta,
        -sinTheta * Math.cos(phi)
      );

      let r = 0, g = 0, b = 0;

      if (dir.y >= 0.0) {
        // Rich deep summer sky (moderate diffuse so shadows stay crisp, high-contrast bright reflection cards for glossy PVC!)
        const skyT = Math.pow(dir.y, 0.52);
        r = THREE.MathUtils.lerp(0.42, 0.06, skyT) * 1.35;
        g = THREE.MathUtils.lerp(0.62, 0.24, skyT) * 1.45;
        b = THREE.MathUtils.lerp(0.88, 0.68, skyT) * 1.65;

        // Sharp sunlit cumulus clouds
        const cloudWave = Math.sin(phi * 3.0 + 0.7) * 0.5 + Math.cos(phi * 7.0 - 1.2) * 0.3;
        const cloudElev = 0.16 + cloudWave * 0.07;
        const cloudMask = Math.exp(-Math.pow((dir.y - cloudElev) / 0.055, 2.0)) * Math.max(0, Math.sin(phi * 2.0 + 1.1));
        r += cloudMask * 3.8;
        g += cloudMask * 3.75;
        b += cloudMask * 3.6;

        // Sharp rectangular sky-window reflection strips (produces unmistakable glossy PVC specular ribbons!)
        const strip1 = Math.max(0, Math.cos(phi - 0.85)) * Math.exp(-Math.pow((dir.y - 0.48) / 0.11, 4.0));
        const strip2 = Math.max(0, Math.cos(phi + 0.95)) * Math.exp(-Math.pow((dir.y - 0.36) / 0.09, 4.0));
        if (strip1 > 0.62) { r += 8.5; g += 8.7; b += 9.0; }
        if (strip2 > 0.68) { r += 5.5; g += 5.8; b += 6.2; }
      } else {
        // Rich warm cedar bounce + vivid turquoise pool caustic bounce on float undersides!
        const downT = Math.min(1.0, -dir.y * 1.8);
        const poolBounce = Math.pow(Math.max(0, dir.dot(bouncePoolDir)), 2.5);
        r = THREE.MathUtils.lerp(0.32, 0.16, downT);
        g = THREE.MathUtils.lerp(0.26, 0.14, downT);
        b = THREE.MathUtils.lerp(0.18, 0.09, downT);
        r += poolBounce * 0.25;
        g += poolBounce * 1.65;
        b += poolBounce * 2.10;
      }

      // Blazing midday sun disc (super-HDR pinpoint for razor-sharp mirror highlight on vinyl & water!)
      const sunDot = Math.max(0.0, dir.dot(sunDir));
      if (sunDot > 0.9972) {
        r += 115.0;
        g += 110.0;
        b += 96.0;
      } else if (sunDot > 0.95) {
        const halo = Math.pow((sunDot - 0.95) / 0.0472, 5.0);
        r += halo * 14.0;
        g += halo * 12.8;
        b += halo * 10.2;
      }

      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 1.0;
    }
  }

  const equirect = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  equirect.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(equirect);
  equirect.dispose();
  pmrem.dispose();
  return envRT.texture;
}

// 2. Vinyl Crease & Fold Normal Map (wrinkled when deflated, smooths out taut when inflated!)
export function createVinylNormalMap() {
  const size = 512;
  const hCanvas = document.createElement('canvas');
  hCanvas.width = size;
  hCanvas.height = size;
  const hCtx = hCanvas.getContext('2d');

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  // Subtle folded PVC crease lines (tileable via wrapped drawing)
  for (let i = 0; i < 46; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * size;
    const y = (Math.cos(i * 78.233) * 0.5 + 0.5) * size;
    const angle = (i * 1.93) % (Math.PI * 2);
    const len = 55 + (i % 5) * 28;

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const cx = x + ox * size;
        const cy = y + oy * size;
        const x2 = cx + Math.cos(angle) * len;
        const y2 = cy + Math.sin(angle) * len;

        const grad = hCtx.createLinearGradient(
          cx - Math.sin(angle) * 7,
          cy + Math.cos(angle) * 7,
          cx + Math.sin(angle) * 7,
          cy - Math.cos(angle) * 7
        );
        grad.addColorStop(0.0, 'rgba(128,128,128,0)');
        grad.addColorStop(0.38, 'rgba(70,70,70,0.42)');
        grad.addColorStop(0.55, 'rgba(215,215,215,0.45)');
        grad.addColorStop(1.0, 'rgba(128,128,128,0)');

        hCtx.strokeStyle = grad;
        hCtx.lineWidth = 12;
        hCtx.lineCap = 'round';
        hCtx.beginPath();
        hCtx.moveTo(cx, cy);
        hCtx.lineTo(x2, y2);
        hCtx.stroke();
      }
    }
  }

  // Convert heightfield into tangent-space normal map
  const src = hCtx.getImageData(0, 0, size, size).data;
  const nCanvas = document.createElement('canvas');
  nCanvas.width = size;
  nCanvas.height = size;
  const nCtx = nCanvas.getContext('2d');
  const out = nCtx.createImageData(size, size);
  const dst = out.data;

  const sample = (px, py) => {
    const wx = ((px % size) + size) % size;
    const wy = ((py % size) + size) % size;
    return src[(wy * size + wx) * 4] / 255.0;
  };

  const strength = 2.6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength;
      const v = new THREE.Vector3(-dx, -dy, 1.0).normalize();
      const idx = (y * size + x) * 4;
      dst[idx] = Math.round((v.x * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((v.y * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((v.z * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  nCtx.putImageData(out, 0, 0);

  const tex = new THREE.CanvasTexture(nCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

// 3. Printed PVC pattern textures for Donut icing/sprinkles & Octopus subtle polka-shimmer
export function createDonutVinylTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Realistic commercial pool-float screen-printed strawberry frosting & crisp glossy sprinkles on translucent amber PVC!
  const amberGrad = ctx.createLinearGradient(0, 0, 0, size);
  amberGrad.addColorStop(0.0, '#ff4785');
  amberGrad.addColorStop(0.45, '#ff3b7d');
  amberGrad.addColorStop(0.54, '#e59a46');
  amberGrad.addColorStop(0.88, '#eba452');
  amberGrad.addColorStop(1.0, '#ff4785');
  ctx.fillStyle = amberGrad;
  ctx.fillRect(0, 0, size, size);

  // Glossy wavy icing drip border with subtle darker screen-print outline
  ctx.fillStyle = '#ff3679';
  ctx.beginPath();
  for (let x = 0; x <= size; x += 4) {
    const u = (x / size) * Math.PI * 2;
    const scallop = Math.sin(u * 8) * 20 + Math.cos(u * 13) * 8;
    const yEdge = size * 0.49 + scallop;
    if (x === 0) ctx.moveTo(x, 0);
    ctx.lineTo(x, yEdge);
  }
  ctx.lineTo(size, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  for (let x = 0; x <= size; x += 4) {
    const u = (x / size) * Math.PI * 2;
    const scallop = Math.sin(u * 8 + 1.2) * 16 + Math.cos(u * 11) * 7;
    const yEdge = size * 0.88 + scallop * 0.5;
    if (x === 0) ctx.moveTo(x, size);
    ctx.lineTo(x, yEdge);
  }
  ctx.lineTo(size, size);
  ctx.closePath();
  ctx.fill();

  // Crisp realistic printed sprinkles with subtle drop-edge
  const colors = ['#ffe84d', '#38d9ff', '#ffffff', '#69f0ae', '#ffa94d'];
  for (let i = 0; i < 110; i++) {
    const sx = ((i * 73.13) % 1) * (size - 32) + 16;
    const sy = ((i * 39.71) % 1) * (size * 0.41) + 14;
    const ang = (i * 2.399) % Math.PI;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(140,15,60,0.22)';
    ctx.beginPath();
    ctx.roundRect(-9, -2.5, 20, 7, 3.5);
    ctx.fill();
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.roundRect(-10, -3.5, 20, 7, 3.5);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 4. Sunlit Warm Oak Living Room Hardwood Planks
export function createWoodFloorTexture(cedarDeck = false) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const planks = cedarDeck ? 8 : 6;
  const plankH = size / planks;

  for (let p = 0; p < planks; p++) {
    const y0 = p * plankH;
    const shade = (Math.sin(p * 4.7) * 0.5 + 0.5) * 24 - 12;
    const baseR = (cedarDeck ? 172 : 194) + shade;
    const baseG = (cedarDeck ? 116 : 142) + shade * 0.85;
    const baseB = (cedarDeck ? 74 : 92) + shade * 0.7;

    ctx.fillStyle = `rgb(${Math.round(baseR)},${Math.round(baseG)},${Math.round(baseB)})`;
    ctx.fillRect(0, y0, size, plankH);

    // Rich realistic wood grain knots & fibers
    for (let g = 0; g < 34; g++) {
      const gy = y0 + (g / 34) * plankH;
      ctx.strokeStyle = g % 2 === 0 ? 'rgba(82,44,18,0.14)' : 'rgba(255,232,198,0.09)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 24) {
        const wy = gy + Math.sin(x * 0.028 + p * 1.9 + g * 0.4) * 2.8;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    // Plank gap groove
    ctx.fillStyle = cedarDeck ? 'rgba(52,32,16,0.68)' : 'rgba(95,62,35,0.35)';
    ctx.fillRect(0, y0, size, cedarDeck ? 3.5 : 2.0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(cedarDeck ? 3 : 4, cedarDeck ? 3 : 4);
  return tex;
}

// 5. Pool Mosaic Tile Texture (refracted underneath water with caustics!)
export function createPoolTileTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d9f4fb';
  ctx.fillRect(0, 0, size, size);

  const cells = 16;
  const step = size / cells;
  const palette = ['#48bfe3', '#56cfe1', '#64dfdf', '#3aa8d8', '#72efdd', '#2d96c8'];

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const h = Math.abs(Math.sin(x * 12.7 + y * 31.3));
      ctx.fillStyle = palette[Math.floor(h * palette.length) % palette.length];
      ctx.beginPath();
      ctx.roundRect(x * step + 2, y * step + 2, step - 4, step - 4, 3);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

// 6. Lush Sunlit Summer Lawn Texture
export function createLawnTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#5da93c';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const green = 135 + Math.floor(Math.random() * 65);
    const red = 68 + Math.floor(Math.random() * 48);
    ctx.strokeStyle = `rgba(${red},${green},42,0.55)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 5, y - 6 - Math.random() * 6);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

// 7. Pictorial Wooden Sign Board Texture (1 single visual rule sign per stage, ZERO text/letters/numbers!)
export function createSignBoardTexture(stage = 0) {
  const w = 512;
  const h = 340;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Warm natural cream-painted wooden board with cedar border
  ctx.fillStyle = '#c88d55';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 24);
  ctx.fill();

  ctx.fillStyle = '#fff9ee';
  ctx.beginPath();
  ctx.roundRect(14, 14, w - 28, h - 28, 16);
  ctx.fill();

  // Subtle wood grain lines
  ctx.strokeStyle = 'rgba(180,130,80,0.10)';
  ctx.lineWidth = 2;
  for (let y = 26; y < h - 24; y += 18) {
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(w - 22, y + Math.sin(y) * 3);
    ctx.stroke();
  }

  const drawChevrons = (cx, cy) => {
    ctx.strokeStyle = '#e09b56';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = -1; i <= 0; i++) {
      const ox = cx + i * 14;
      ctx.beginPath();
      ctx.moveTo(ox - 8, cy - 12);
      ctx.lineTo(ox + 6, cy);
      ctx.lineTo(ox - 8, cy + 12);
      ctx.stroke();
    }
  };

  const drawShinyRing = (cx, cy, rx, ry, color, highlight = true) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 0, rx * 0.38, ry * 0.36, 0, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    if (highlight) {
      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth = Math.max(3, ry * 0.18);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, rx * 0.72, -Math.PI * 0.82, -Math.PI * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawSmileyFace = (cx, cy, r, hairColor = '#4a3022', hatColor = null) => {
    ctx.save();
    ctx.translate(cx, cy);
    // Hair back
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(0, -r * 0.05, r * 1.12, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = '#ffdfc8';
    ctx.beginPath();
    ctx.arc(0, r * 0.06, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    // Hat
    if (hatColor) {
      ctx.fillStyle = hatColor;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.65, r * 1.35, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -r * 0.68, r * 0.78, Math.PI, 0);
      ctx.fill();
    }
    // Happy curved eyes & smile
    ctx.strokeStyle = '#3b2418';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-r * 0.34, r * 0.02, r * 0.16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.34, r * 0.02, r * 0.16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = '#f26a6a';
    ctx.beginPath();
    ctx.arc(0, r * 0.25, r * 0.28, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  };

  if (stage === 0) {
    // Stage 0: 3 cute summer hats/shirts -> smiling girl wearing chosen sleeve!
    const outfits = [
      { x: 105, y: 120, c: '#ffd43b' },
      { x: 105, y: 225, c: '#ff6b8b' },
      { x: 195, y: 172, c: '#4dabf7' }
    ];
    outfits.forEach((o) => {
      ctx.fillStyle = o.c;
      ctx.beginPath();
      ctx.roundRect(o.x - 32, o.y - 22, 64, 48, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(o.x, o.y - 22, 14, 0, Math.PI);
      ctx.fill();
    });
    drawChevrons(278, 170);
    drawSmileyFace(388, 155, 48, '#462c1d', '#ffd43b');
    // Raised happy hand with matching yellow cuff
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.roundRect(352, 212, 72, 46, 14);
    ctx.fill();
  } else if (stage === 1) {
    // Stage 1: Yellow foot pump -> flat vinyl ring swelling into glossy round float (+ little puff if overfull!)
    // Pump icon
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.ellipse(92, 185, 46, 30, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#339af0';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(132, 185);
    ctx.bezierCurveTo(165, 215, 175, 195, 198, 195);
    ctx.stroke();

    // Deflated thin vinyl
    drawShinyRing(225, 200, 44, 13, 'rgba(255,95,82,0.75)', false);

    drawChevrons(305, 172);

    // Big glossy plump octopus/donut float!
    drawShinyRing(402, 182, 62, 44, '#ff5c4d', true);
    // Cute octopus head crown on top
    ctx.fillStyle = '#ff5c4d';
    ctx.beginPath();
    ctx.arc(402, 135, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(391, 134, 7, 0, Math.PI * 2);
    ctx.arc(413, 134, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(391, 134, 3.5, 0, Math.PI * 2);
    ctx.arc(413, 134, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Small happy air puffs
    ctx.strokeStyle = '#74c0fc';
    ctx.lineWidth = 4;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(458 + k * 8, 118 - k * 10);
      ctx.lineTo(478 + k * 10, 105 - k * 12);
      ctx.stroke();
    }
  } else if (stage === 2) {
    // Stage 2: Giant octopus squishing Dad -> pressing vinyl to puff air out -> fits out to sunny garden!
    // Left: Huge octopus + Dad's feet sticking out
    ctx.fillStyle = '#ff5847';
    ctx.beginPath();
    ctx.arc(125, 168, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(125, 168, 56, -2.4, -0.8);
    ctx.stroke();
    // Dad legs sticking out bottom
    ctx.strokeStyle = '#3b5bdb';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(85, 226);
    ctx.lineTo(62, 268);
    ctx.moveTo(156, 228);
    ctx.lineTo(182, 268);
    ctx.stroke();

    // Air puff clouds coming out
    ctx.strokeStyle = '#4dabf7';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(205, 132);
    ctx.lineTo(245, 110);
    ctx.moveTo(208, 152);
    ctx.lineTo(252, 145);
    ctx.stroke();

    drawChevrons(276, 185);

    // Right: Happy right-sized octopus & smiling Dad + Sun
    ctx.fillStyle = '#fcc419';
    ctx.beginPath();
    ctx.arc(445, 76, 26, 0, Math.PI * 2);
    ctx.fill();
    drawSmileyFace(365, 132, 30, '#2f241f');
    drawShinyRing(405, 212, 54, 34, '#ff5847', true);
  } else {
    // Stage 3: Pool water + 3 floats + family splashing & playing freely!
    // Sparkling pool oval
    ctx.fillStyle = '#3bc9db';
    ctx.beginPath();
    ctx.ellipse(256, 208, 208, 88, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(256, 208, 175, 66, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3 floats on water
    drawShinyRing(138, 202, 46, 28, '#ff5c4d', true);
    drawShinyRing(265, 218, 46, 28, '#f8f9fa', true);
    drawShinyRing(385, 198, 44, 27, '#ff66a3', true);

    // Family smiling above
    drawSmileyFace(138, 138, 26, '#2f241f');
    drawSmileyFace(265, 152, 25, '#543524', '#ffe066');
    drawSmileyFace(385, 136, 23, '#462c1d', '#ffd43b');

    // Blue water splash droplets!
    ctx.fillStyle = '#74c0fc';
    const drops = [
      [84, 148], [192, 145], [218, 165], [322, 152], [442, 146]
    ];
    drops.forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(dx, dy, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

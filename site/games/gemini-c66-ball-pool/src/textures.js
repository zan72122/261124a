import * as THREE from 'three';

function makeSeededRandom(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 1024x1024 rich warm European honey-oak wide-plank flooring (commercial photography mid-tone contrast)
export function createOakFloorTextures() {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');

  const rand = makeSeededRandom(6609);
  const planks = 8;
  const plankH = size / planks;

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#686868';
  rctx.fillRect(0, 0, size, size);

  for (let p = 0; p < planks; p++) {
    const y0 = p * plankH;
    const jointX = Math.floor((0.18 + ((p * 0.37) % 0.66)) * size);
    const segments = [
      [0, jointX],
      [jointX, size]
    ];

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const [xStart, xEnd] = segments[segIdx];
      const w = xEnd - xStart;
      const hueShift = (rand() - 0.5) * 10;
      const lightShift = (rand() - 0.5) * 16;
      const baseR = Math.min(215, Math.max(135, 174 + lightShift + hueShift));
      const baseG = Math.min(172, Math.max(96, 128 + lightShift * 0.82));
      const baseB = Math.min(125, Math.max(58, 84 + lightShift * 0.62 - hueShift * 0.4));

      const grad = ctx.createLinearGradient(xStart, y0, xStart, y0 + plankH);
      grad.addColorStop(0, `rgb(${baseR - 7},${baseG - 6},${baseB - 5})`);
      grad.addColorStop(0.5, `rgb(${baseR + 5},${baseG + 4},${baseB + 3})`);
      grad.addColorStop(1, `rgb(${baseR - 9},${baseG - 7},${baseB - 6})`);
      ctx.fillStyle = grad;
      ctx.fillRect(xStart, y0, w, plankH);

      const plankRough = Math.floor(88 + rand() * 34);
      rctx.fillStyle = `rgb(${plankRough},${plankRough},${plankRough})`;
      rctx.fillRect(xStart, y0, w, plankH);

      const grainCenterY = y0 + plankH * (0.25 + rand() * 0.5);
      const grainAmp = 8 + rand() * 16;
      const grainFreq = (1.5 + rand() * 2.2) * Math.PI * 2 / size;
      const phase = rand() * Math.PI * 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(xStart, y0, w, plankH);
      ctx.clip();

      bctx.save();
      bctx.beginPath();
      bctx.rect(xStart, y0, w, plankH);
      bctx.clip();

      for (let g = 0; g < 52; g++) {
        const offset = (g - 26) * (plankH / 36);
        const alpha = 0.08 + rand() * 0.11;
        const dark = g % 3 !== 1;
        ctx.strokeStyle = dark
          ? `rgba(88, 52, 24, ${alpha})`
          : `rgba(214, 170, 118, ${alpha * 0.7})`;
        ctx.lineWidth = 0.9 + rand() * 2.0;
        ctx.beginPath();

        bctx.strokeStyle = dark ? 'rgba(82,82,82,0.28)' : 'rgba(168,168,168,0.22)';
        bctx.lineWidth = 1.2;
        bctx.beginPath();

        for (let x = xStart; x <= xEnd; x += 12) {
          const wave = Math.sin(x * grainFreq + phase + g * 0.14) * grainAmp * (0.4 + Math.abs(offset) / plankH);
          const yy = grainCenterY + offset + wave;
          if (x === xStart) {
            ctx.moveTo(x, yy);
            bctx.moveTo(x, yy);
          } else {
            ctx.lineTo(x, yy);
            bctx.lineTo(x, yy);
          }
        }
        ctx.stroke();
        bctx.stroke();
      }

      for (let k = 0; k < 170; k++) {
        const px = xStart + rand() * w;
        const py = y0 + 3 + rand() * (plankH - 6);
        const len = 5 + rand() * 16;
        ctx.strokeStyle = `rgba(76, 44, 18, ${0.11 + rand() * 0.12})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + len, py + (rand() - 0.5) * 0.8);
        ctx.stroke();
      }

      if (rand() < 0.45 && w > 180) {
        const kx = xStart + 60 + rand() * (w - 120);
        const ky = y0 + 22 + rand() * (plankH - 44);
        const kr = 5 + rand() * 7;
        const kgrad = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr * 2.5);
        kgrad.addColorStop(0, 'rgba(64, 36, 16, 0.65)');
        kgrad.addColorStop(0.45, 'rgba(104, 62, 30, 0.30)');
        kgrad.addColorStop(1, 'rgba(148, 102, 58, 0)');
        ctx.fillStyle = kgrad;
        ctx.beginPath();
        ctx.ellipse(kx, ky, kr * 2.6, kr * 1.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      bctx.restore();
    }

    // Crisp V-groove plank bevel seam
    ctx.fillStyle = 'rgba(54, 32, 14, 0.78)';
    ctx.fillRect(0, y0, size, 2.8);
    ctx.fillStyle = 'rgba(222, 182, 134, 0.32)';
    ctx.fillRect(0, y0 + 2.8, size, 1.5);

    bctx.fillStyle = '#1d1d1d';
    bctx.fillRect(0, y0, size, 3.5);
    rctx.fillStyle = '#c4c4c4';
    rctx.fillRect(0, y0, size, 3.5);

    ctx.fillStyle = 'rgba(54, 32, 14, 0.70)';
    ctx.fillRect(jointX - 1.2, y0, 2.4, plankH);
    bctx.fillStyle = '#242424';
    bctx.fillRect(jointX - 1.5, y0, 3, plankH);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.4, 3.8);
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.4, 3.8);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3.4, 3.8);

  return { map, bumpMap, roughnessMap };
}

// 512x512 warm oatmeal-greige woven boucle play rug (distinct from white foam pool!)
export function createBoucleRugTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  const rand = makeSeededRandom(8821);
  ctx.fillStyle = '#cfc2af';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#707070';
  bctx.fillRect(0, 0, size, size);

  const step = 4;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const n = (rand() - 0.5) * 28;
      const weave = ((x / step + y / step) % 2 === 0) ? 8 : -7;
      const r = Math.min(238, Math.max(165, 206 + n + weave));
      const g = Math.min(228, Math.max(154, 194 + n + weave * 0.85));
      const b = Math.min(212, Math.max(138, 176 + n + weave * 0.7));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(x + step * 0.5, y + step * 0.5, step * (0.52 + rand() * 0.22), 0, Math.PI * 2);
      ctx.fill();

      const bv = Math.floor(95 + rand() * 135);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      ctx.beginPath();
      bctx.beginPath();
      bctx.arc(x + step * 0.5, y + step * 0.5, step * 0.55, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 4.5);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 4.5);

  return { map, bumpMap };
}

// 512x512 luxury soft-play pebble leatherette / quilted foam texture
export function createQuiltedFoamTextures() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  const rand = makeSeededRandom(3319);
  ctx.fillStyle = '#ebe5da';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#929292';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 10500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.2 + rand() * 2.0;
    const shade = 232 + (rand() - 0.5) * 16;
    ctx.fillStyle = `rgb(${shade},${shade - 5},${shade - 12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const b = Math.floor(135 + (rand() - 0.5) * 75);
    bctx.fillStyle = `rgb(${b},${b},${b})`;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }

  for (let s = 0; s < size; s += 128) {
    const g = ctx.createLinearGradient(s - 10, 0, s + 10, 0);
    g.addColorStop(0, 'rgba(205,196,184,0)');
    g.addColorStop(0.5, 'rgba(162,152,138,0.48)');
    g.addColorStop(1, 'rgba(255,252,246,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(s - 10, 0, 20, size);

    const bg = bctx.createLinearGradient(s - 8, 0, s + 8, 0);
    bg.addColorStop(0, 'rgba(146,146,146,0)');
    bg.addColorStop(0.5, 'rgba(42,42,42,0.9)');
    bg.addColorStop(1, 'rgba(182,182,182,0.45)');
    bctx.fillStyle = bg;
    bctx.fillRect(s - 8, 0, 16, size);

    ctx.strokeStyle = 'rgba(148, 138, 124, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(s + 3, 0);
    ctx.lineTo(s + 3, size);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 1);

  return { map, bumpMap };
}

// 256x256 LDPE plastic micro-satin & blow-mold equatorial parting seam
export function createPlasticBallBumpTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = makeSeededRandom(7104);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = Math.floor(120 + (rand() - 0.5) * 24);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const seamGrad = ctx.createLinearGradient(0, size * 0.5 - 3, 0, size * 0.5 + 3);
  seamGrad.addColorStop(0, '#808080');
  seamGrad.addColorStop(0.45, '#b2b2b2');
  seamGrad.addColorStop(0.55, '#606060');
  seamGrad.addColorStop(1, '#808080');
  ctx.fillStyle = seamGrad;
  ctx.fillRect(0, size * 0.5 - 3, size, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 512x512 translucent diamond nylon mesh bag texture (high visibility of vibrant balls inside!)
export function createMeshBagTexture(trimHex = '#ff2e7a') {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  // Clear holes so vibrant balls inside shine right through!
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(232, 228, 222, 0.72)';
  ctx.lineWidth = 3.2;
  const spacing = 28;
  for (let i = -size; i < size * 2; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i + size, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }

  ctx.fillStyle = trimHex;
  ctx.fillRect(0, 0, size, 64);
  ctx.fillRect(0, size - 56, size, 56);

  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, 52);
  ctx.lineTo(size, 52);
  ctx.moveTo(0, size - 44);
  ctx.lineTo(size, size - 44);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createFabricTexture(baseHex, secondHex, style = 'twill') {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = makeSeededRandom(baseHex.charCodeAt(1) * 97 + style.length * 31);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  if (style === 'stripes') {
    ctx.fillStyle = secondHex;
    for (let y = 0; y < size; y += 26) {
      ctx.fillRect(0, y, size, 11);
    }
  } else if (style === 'denim') {
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        if ((x + y) % 4 === 0) {
          ctx.fillStyle = 'rgba(225, 236, 255, 0.22)';
          ctx.fillRect(x, y, 1.5, 1.5);
        } else if (rand() < 0.28) {
          ctx.fillStyle = 'rgba(14, 28, 54, 0.26)';
          ctx.fillRect(x, y, 2, 1.5);
        }
      }
    }
  } else if (style === 'quilted') {
    ctx.strokeStyle = secondHex;
    ctx.lineWidth = 2.6;
    const step = 32;
    for (let i = -size; i < size * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + size, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }
  }

  for (let i = 0; i < 2600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, y, 2, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 1024x512 Vibrant Rich Wooden Picture Signboard ("ルールは絵の看板1枚で見せる" - ZERO text, ZERO arrows)
export function createPictureSignboardCanvas() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  function redraw(activeStep = 0) {
    const ctx = canvas.getContext('2d');
    const rand = makeSeededRandom(4409);

    // Rich toasted beech/oak board
    const woodGrad = ctx.createLinearGradient(0, 0, 0, height);
    woodGrad.addColorStop(0, '#c89b68');
    woodGrad.addColorStop(0.5, '#b88956');
    woodGrad.addColorStop(1, '#a37544');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 65; i++) {
      const y = (i / 65) * height;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(92, 56, 24, 0.18)' : 'rgba(238, 202, 156, 0.16)';
      ctx.lineWidth = 2 + rand() * 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(width * 0.33, y + (rand() - 0.5) * 14, width * 0.66, y + (rand() - 0.5) * 14, width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#7c5329';
    ctx.lineWidth = 20;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    const panelW = 296;
    const panelH = 416;
    const gap = 26;
    const startX = (width - (panelW * 3 + gap * 2)) * 0.5;
    const startY = 48;

    const drawRoundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };

    for (let i = 0; i < 3; i++) {
      const px = startX + i * (panelW + gap);
      const py = startY;
      const isCurrent = activeStep === i;

      ctx.save();
      drawRoundRect(px, py, panelW, panelH, 24);
      ctx.fillStyle = isCurrent ? '#f7f0e2' : '#e6dccb';
      ctx.fill();
      ctx.lineWidth = isCurrent ? 10 : 4;
      ctx.strokeStyle = isCurrent ? '#f0941f' : '#8d663c';
      ctx.stroke();
      ctx.clip();

      const bg = ctx.createLinearGradient(px, py, px, py + panelH);
      bg.addColorStop(0, isCurrent ? '#f6eedc' : '#e4d9c6');
      bg.addColorStop(1, '#d8cab3');
      ctx.fillStyle = bg;
      ctx.fillRect(px, py, panelW, panelH);

      const drawGlossyBall = (bx, by, br, color) => {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath();
        ctx.arc(bx + 2, by + 3, br, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.beginPath();
        ctx.arc(bx - br * 0.32, by - br * 0.34, br * 0.30, 0, Math.PI * 2);
        ctx.fill();
      };

      if (i === 0) {
        // Panel 1: Tilting bags pouring Pink, Blue, Yellow balls into cushioned pool
        ctx.fillStyle = '#faf6ee';
        ctx.strokeStyle = '#9e8e78';
        ctx.lineWidth = 8;
        drawRoundRect(px + 30, py + 232, panelW - 60, 142, 22);
        ctx.fill();
        ctx.stroke();

        const cols = ['#f52876', '#0e96f2', '#f7be08'];
        for (let row = 0; row < 3; row++) {
          for (let c = 0; c < 7; c++) {
            drawGlossyBall(
              px + 58 + c * 29 + (row % 2) * 9,
              py + 344 - row * 25,
              14.5,
              cols[row]
            );
          }
        }

        ctx.save();
        ctx.translate(px + 142, py + 98);
        ctx.rotate(0.58);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = '#f52876';
        ctx.lineWidth = 8;
        drawRoundRect(-48, -58, 96, 112, 22);
        ctx.fill();
        ctx.stroke();
        drawGlossyBall(-17, -20, 14, '#f52876');
        drawGlossyBall(15, -18, 14, '#f52876');
        drawGlossyBall(0, 10, 14, '#f52876');
        ctx.restore();

        drawGlossyBall(px + 164, py + 166, 14.5, '#f52876');
        drawGlossyBall(px + 142, py + 194, 14.5, '#0e96f2');
        drawGlossyBall(px + 174, py + 214, 14.5, '#f7be08');
      } else if (i === 1) {
        // Panel 2: Slide + joyful family splash
        ctx.fillStyle = '#faf6ee';
        ctx.strokeStyle = '#9e8e78';
        ctx.lineWidth = 8;
        drawRoundRect(px + 52, py + 234, panelW - 80, 140, 22);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#b97b3d';
        ctx.lineWidth = 22;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px + 26, py + 128);
        ctx.lineTo(px + 114, py + 246);
        ctx.stroke();

        const drawHappyHead = (hx, hy, r, hair) => {
          ctx.fillStyle = hair;
          ctx.beginPath();
          ctx.arc(hx, hy - 4, r + 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f5c2a0';
          ctx.beginPath();
          ctx.arc(hx, hy + 2, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#3b2216';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.arc(hx - r * 0.34, hy, 4, Math.PI, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(hx + r * 0.34, hy, 4, Math.PI, 0);
          ctx.stroke();
          ctx.fillStyle = '#d94854';
          ctx.beginPath();
          ctx.arc(hx, hy + r * 0.30, r * 0.35, 0, Math.PI);
          ctx.fill();
        };

        drawHappyHead(px + 132, py + 224, 24, '#3a2218');
        drawHappyHead(px + 198, py + 234, 20, '#241610');

        const splashPts = [
          [78, 168, '#f52876'], [116, 118, '#f7be08'], [166, 98, '#0e96f2'],
          [216, 122, '#f52876'], [246, 172, '#f7be08'], [92, 294, '#0e96f2'],
          [128, 310, '#f52876'], [164, 300, '#f7be08'], [200, 312, '#0e96f2'],
          [230, 294, '#f52876']
        ];
        for (const [sx, sy, sc] of splashPts) {
          drawGlossyBall(px + sx, py + sy, 14.5, sc);
        }
      } else {
        // Panel 3: 3 Color-coded boxes + joyful clapping hands
        const boxColors = ['#f52876', '#0e96f2', '#f7be08'];
        for (let b = 0; b < 3; b++) {
          const bx = px + 24 + b * 86;
          const by = py + 256;
          const bw = 76;
          const bh = 102;

          drawGlossyBall(bx + 22, by - 4, 13.5, boxColors[b]);
          drawGlossyBall(bx + 52, by - 4, 13.5, boxColors[b]);
          drawGlossyBall(bx + 37, by - 18, 13.5, boxColors[b]);

          ctx.fillStyle = boxColors[b];
          drawRoundRect(bx, by, bw, bh, 14);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          drawRoundRect(bx + 18, by + 22, bw - 36, 14, 7);
          ctx.fill();
        }

        ctx.save();
        ctx.translate(px + panelW * 0.5, py + 128);
        ctx.strokeStyle = '#e88b14';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * 46, Math.sin(ang) * 46);
          ctx.lineTo(Math.cos(ang) * 64, Math.sin(ang) * 64);
          ctx.stroke();
        }
        ctx.fillStyle = '#ebb08a';
        ctx.beginPath();
        ctx.ellipse(-13, 6, 20, 30, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f7c5a4';
        ctx.beginPath();
        ctx.ellipse(13, 6, 20, 30, 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    tex.needsUpdate = true;
  }

  redraw(0);
  return { texture: tex, redraw };
}

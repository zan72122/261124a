// Single-Pass Optical Depth-of-Field Bokeh + Highlight Glare + Filmic Tone Mapping
// Foreground Interactive Zone (Cart, Daughter, Cups, Row 1 Family) stays 100% razor-sharp;
// Deep Cabin Aisle (Rows 2..7, distant bins & cabin lights) receives smooth circular lens bokeh.

import * as THREE from 'three';

export class CabinPostFX {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.enabled = true;

    const rtParams = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType
    };

    this.rt = new THREE.WebGLRenderTarget(width, height, rtParams);
    this.rt.texture.name = 'CabinColorRT';
    this.rt.depthTexture = new THREE.DepthTexture(width, height);
    this.rt.depthTexture.format = THREE.DepthFormat;
    this.rt.depthTexture.type = THREE.UnsignedIntType;

    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture },
        uResolution: { value: new THREE.Vector2(width, height) },
        uNear: { value: 0.25 },
        uFar: { value: 32.0 },
        // Foreground focus zone: 0.35m .. 3.18m from camera is 100% sharp; > 3.18m dissolves into authentic DSLR aisle bokeh
        uFocusEnd: { value: 3.18 },
        uBokehRange: { value: 3.65 },
        uMaxBlurPx: { value: 15.5 },
        uWarmth: { value: 0.0 },
        uExposure: { value: 1.04 }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 uResolution;
        uniform float uNear;
        uniform float uFar;
        uniform float uFocusEnd;
        uniform float uBokehRange;
        uniform float uMaxBlurPx;
        uniform float uWarmth;
        uniform float uExposure;
        varying vec2 vUv;

        float linearizeDepth(float d) {
          float z = d * 2.0 - 1.0;
          return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
        }

        vec3 acesFilm(vec3 x) {
          const float a = 2.51;
          const float b = 0.03;
          const float c = 2.43;
          const float d = 0.59;
          const float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        void main() {
          vec2 texel = 1.0 / uResolution;
          float rawDepth = texture2D(tDepth, vUv).r;
          float viewZ = linearizeDepth(rawDepth);

          // Foreground sharpness preservation + subtle directional edge AA
          vec3 center = texture2D(tColor, vUv).rgb;

          float coc = clamp((viewZ - uFocusEnd) / uBokehRange, 0.0, 1.0);
          coc = smoothstep(0.0, 1.0, coc);

          vec3 col = center;

          if (coc < 0.015) {
            // Crisp subpixel edge smoothing for metallic rails without softening interior textures
            vec3 n = texture2D(tColor, vUv + vec2(0.0, -texel.y)).rgb;
            vec3 s = texture2D(tColor, vUv + vec2(0.0, texel.y)).rgb;
            vec3 w = texture2D(tColor, vUv + vec2(-texel.x, 0.0)).rgb;
            vec3 e = texture2D(tColor, vUv + vec2(texel.x, 0.0)).rgb;
            float lumC = dot(center, vec3(0.299, 0.587, 0.114));
            float lumMin = min(lumC, min(min(dot(n, vec3(0.299, 0.587, 0.114)), dot(s, vec3(0.299, 0.587, 0.114))), min(dot(w, vec3(0.299, 0.587, 0.114)), dot(e, vec3(0.299, 0.587, 0.114)))));
            float lumMax = max(lumC, max(max(dot(n, vec3(0.299, 0.587, 0.114)), dot(s, vec3(0.299, 0.587, 0.114))), max(dot(w, vec3(0.299, 0.587, 0.114)), dot(e, vec3(0.299, 0.587, 0.114)))));
            float edge = smoothstep(0.08, 0.28, lumMax - lumMin);
            col = mix(center, (center * 2.0 + n + s + w + e) / 6.0, edge * 0.45);
          } else {
            // Golden-angle 16-tap Poisson disc lens bokeh with highlight emphasis (makes distant cabin lights bloom into round discs!)
            float radius = coc * uMaxBlurPx;
            vec3 acc = center * 1.25;
            float wSum = 1.25;
            const float GOLDEN_ANGLE = 2.39996323;
            for (int i = 1; i <= 16; i++) {
              float fi = float(i);
              float r = sqrt(fi / 16.0) * radius;
              float theta = fi * GOLDEN_ANGLE;
              vec2 offset = vec2(cos(theta), sin(theta)) * r * texel;
              float sDepth = linearizeDepth(texture2D(tDepth, vUv + offset).r);
              // Prevent sharp foreground silhouettes from bleeding into background bokeh
              float sCoc = clamp((sDepth - uFocusEnd) / uBokehRange, 0.0, 1.0);
              float weight = mix(0.08, 1.0, smoothstep(0.02, 0.25, sCoc));
              vec3 sCol = texture2D(tColor, vUv + offset).rgb;
              // Optical bokeh highlight boost on bright distant LEDs/windows
              float bright = max(0.0, dot(sCol, vec3(0.2126, 0.7152, 0.0722)) - 0.85);
              weight *= (1.0 + bright * 1.9);
              acc += sCol * weight;
              wSum += weight;
            }
            col = acc / wSum;
          }

          // Subtle sunset/night atmospheric warmth grading
          col *= mix(vec3(1.0), vec3(1.05, 0.98, 0.93), clamp(uWarmth, 0.0, 1.0));

          // Exposure + ACES Filmic Tone Mapping
          col = acesFilm(col * uExposure);

          // Natural camera lens vignette (subtle, keeps cabin bright & clear)
          vec2 vigUv = vUv - 0.5;
          float vig = 1.0 - dot(vigUv, vigUv) * 0.24;
          col *= clamp(vig, 0.82, 1.0);

          // Linear -> sRGB
          col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  setSize(width, height) {
    this.rt.setSize(width, height);
    this.material.uniforms.uResolution.value.set(width, height);
  }

  render(scene, camera) {
    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.material.uniforms.uNear.value = camera.near;
    this.material.uniforms.uFar.value = camera.far;

    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.orthoCam);
  }
}

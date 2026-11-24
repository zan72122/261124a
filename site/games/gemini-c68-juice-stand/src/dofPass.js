import * as THREE from 'three';

// Macro Shallow Depth-of-Field + Circular Bokeh (玉ボケ) Post-Processing Pass
// Keeps foreground glass & fruit razor-sharp while turning background specular bulbs into creamy circular bokeh discs.

export class MacroBokehPipeline {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    const depthTex = new THREE.DepthTexture(width, height);
    depthTex.type = THREE.UnsignedIntType;

    this.rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture: depthTex,
      samples: 0,
    });

    this.sceneTriangles = 0;
    this.sceneCalls = 0;
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture },
        tDepth: { value: depthTex },
        uResolution: { value: new THREE.Vector2(width, height) },
        uNear: { value: 0.1 },
        uFar: { value: 25.0 },
        uFocusDist: { value: 2.15 },
        uFocusRange: { value: 0.85 },
        uMaxBlur: { value: 0.017 }, // UV radius for lush circular bokeh discs
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
        uniform float uFocusDist;
        uniform float uFocusRange;
        uniform float uMaxBlur;

        varying vec2 vUv;

        float getLinearDepth(vec2 uv) {
          float fragCoordZ = texture2D(tDepth, uv).x;
          float viewZ = (uNear * uFar) / ((uFar - uNear) * fragCoordZ - uFar);
          return -viewZ;
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
          float centerDepth = getLinearDepth(vUv);
          vec3 centerCol = texture2D(tColor, vUv).rgb;

          // Compute Circle of Confusion (0 in hero macro plane, smooth ramp into background)
          float distDiff = max(0.0, centerDepth - (uFocusDist + uFocusRange)) * 0.55
                         + max(0.0, (uFocusDist - uFocusRange * 0.95) - centerDepth) * 0.45;
          float coc = clamp(distDiff / 2.6, 0.0, 1.0);

          vec3 col = centerCol;
          if (coc > 0.018) {
            float aspect = uResolution.x / max(1.0, uResolution.y);
            vec2 radius = vec2(uMaxBlur / aspect, uMaxBlur) * coc;
            vec3 acc = centerCol * 1.0;
            float wSum = 1.0;

            // 20-tap Golden-Angle Vogel Disk with specular highlight boost -> round 玉ボケ!
            const int TAPS = 20;
            for (int i = 1; i <= TAPS; i++) {
              float fi = float(i);
              float r = sqrt(fi / float(TAPS));
              float theta = fi * 2.39996323;
              vec2 offset = vec2(cos(theta), sin(theta)) * r * radius;
              vec2 suv = clamp(vUv + offset, 0.001, 0.999);

              float sDepth = getLinearDepth(suv);
              // Prevent sharp foreground glass edges from bleeding into background blur
              float sDistDiff = max(0.0, sDepth - (uFocusDist + uFocusRange)) * 0.55
                              + max(0.0, (uFocusDist - uFocusRange * 0.95) - sDepth) * 0.45;
              float sCoc = clamp(sDistDiff / 2.6, 0.0, 1.0);
              float leakGuard = sDepth < centerDepth - 0.25 ? smoothstep(0.0, 0.25, sCoc) : 1.0;

              vec3 sCol = texture2D(tColor, suv).rgb;
              float luma = dot(sCol, vec3(0.2126, 0.7152, 0.0722));
              // Bright specular pinpoints get strong circular bokeh weight
              float bokehBoost = 1.0 + pow(max(0.0, luma - 0.45), 1.8) * 5.5;
              // Crisp circular aperture rim boost (slight optical spherical aberration warmth)
              float rimBoost = 0.88 + 0.32 * smoothstep(0.65, 1.0, r);
              float w = bokehBoost * rimBoost * leakGuard;

              acc += sCol * w;
              wSum += w;
            }
            col = acc / max(0.001, wSum);
          }

          // Subtle studio lens vignette
          vec2 vigUv = vUv - 0.5;
          float vig = 1.0 - dot(vigUv, vigUv) * 0.34;
          col *= vig;

          // Filmic HDR -> sRGB output
          col = acesFilm(col * 1.08);
          col = pow(col, vec3(1.0 / 2.2));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  setSize(width, height) {
    this.rt.setSize(width, height);
    this.material.uniforms.uResolution.value.set(width, height);
  }

  render(scene, camera, focusDist, focusRange, maxBlur = 0.017) {
    this.material.uniforms.uNear.value = camera.near;
    this.material.uniforms.uFar.value = camera.far;
    this.material.uniforms.uFocusDist.value = focusDist;
    this.material.uniforms.uFocusRange.value = focusRange;
    this.material.uniforms.uMaxBlur.value = maxBlur;

    const prevToneMapping = this.renderer.toneMapping;
    // Render HDR scene linearly into HalfFloat RT so bokeh highlights preserve true HDR energy!
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.sceneTriangles = this.renderer.info.render.triangles;
    this.sceneCalls = this.renderer.info.render.calls;

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.orthoCam);
    this.renderer.toneMapping = prevToneMapping;
  }
}

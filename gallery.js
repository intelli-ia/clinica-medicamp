import * as THREE from 'three';

const IMAGES = ['/2.png', '/4.png', '/6.png', '/7.png'];
const VISIBLE  = 12;
const DEPTH    = 50;
const HALF     = DEPTH / 2;
const FADE     = { in: { s: 0.05, e: 0.28 }, out: { s: 0.40, e: 0.44 } };

// At worldZ=-22.5 (FAR_DIST), FOV=55 → screen half-width ≈ 11.7 units
// Positions are defined at FAR_DIST and scaled linearly with distance,
// so each image keeps a constant angular (screen-space) position —
// appearing from a fixed spot on the edges and flying straight at the viewer.
const FAR_DIST = 22.5;

function spatialPos(i) {
  const ha = (i * 2.618) % (Math.PI * 2);          // golden angle → even distribution
  const va = (i * 1.618 + Math.PI / 3) % (Math.PI * 2);
  const xR = 8.5 + (i % 5) * 1.4;                  // 8.5 – 14.1  (near/beyond screen edge)
  const yR = 3.5 + (i % 4) * 1.3;                  // 3.5 – 7.4
  return {
    x: Math.sin(ha) * xR,
    y: Math.cos(va) * yR,
  };
}

function calcOpacity(norm) {
  if (norm < FADE.in.s)  return 0;
  if (norm < FADE.in.e)  return (norm - FADE.in.s) / (FADE.in.e - FADE.in.s);
  if (norm < FADE.out.s) return 1;
  if (norm < FADE.out.e) return 1 - (norm - FADE.out.s) / (FADE.out.e - FADE.out.s);
  return 0;
}

const vert = `
  uniform float force;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float curve  = length(p.xy) * length(p.xy) * force * 0.10;
    float ripple = sin(p.x * 2.0 + force * 3.0) * 0.014 * abs(force);
    p.z -= curve + ripple;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const frag = `
  uniform sampler2D map;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    gl_FragColor = vec4(c.rgb, opacity);
  }
`;

function makeMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      map:     { value: null },
      opacity: { value: 1.0 },
      force:   { value: 0.0 },
    },
    vertexShader:   vert,
    fragmentShader: frag,
  });
}

export function initGallery(container) {
  const W = container.clientWidth  || window.innerWidth;
  const H = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
  camera.position.set(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
  container.appendChild(canvas);

  const loader   = new THREE.TextureLoader();
  const textures = IMAGES.map(src => {
    const t = loader.load(src);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });

  const imgStep = VISIBLE % IMAGES.length || IMAGES.length;

  const planes = Array.from({ length: VISIBLE }, (_, i) => {
    const mat    = makeMat();
    const imgIdx = i % IMAGES.length;
    mat.uniforms.map.value = textures[imgIdx];

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 24, 24), mat);
    scene.add(mesh);

    const pos = spatialPos(i);
    return { mesh, mat, normZ: i / VISIBLE, imgIdx, x: pos.x, y: pos.y };
  });

  let vel = 0;

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  const clock = new THREE.Clock();

  (function animate() {
    requestAnimationFrame(animate);

    const delta   = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    vel += 0.14 * delta;
    vel *= 0.97;

    planes.forEach((p, i) => {
      p.normZ += vel * delta;

      if (p.normZ >= 1) {
        p.normZ -= 1;
        p.imgIdx = (p.imgIdx + imgStep) % IMAGES.length;
        p.mat.uniforms.map.value = textures[p.imgIdx];
        const pos = spatialPos(i);
        p.x = pos.x; p.y = pos.y;
      } else if (p.normZ < 0) {
        p.normZ += 1;
        p.imgIdx = ((p.imgIdx - imgStep) % IMAGES.length + IMAGES.length) % IMAGES.length;
        p.mat.uniforms.map.value = textures[p.imgIdx];
      }

      const worldZ = p.normZ * DEPTH - HALF;

      // Scale x/y linearly with distance so each image holds a constant
      // screen-space angle — appearing from its edge position and flying
      // straight at the viewer without drifting.
      const spread = Math.max(0, -worldZ) / FAR_DIST;

      const tex    = textures[p.imgIdx];
      let sx = 3, sy = 3;
      if (tex.image?.width) {
        const asp = tex.image.width / tex.image.height;
        sx = asp > 1 ? 2.8 * asp : 2.8;
        sy = asp > 1 ? 2.8 : 2.8 / asp;
      }

      p.mesh.position.set(p.x * spread, p.y * spread, worldZ);
      p.mesh.scale.set(sx, sy, 1);
      p.mat.uniforms.opacity.value = calcOpacity(p.normZ);
      p.mat.uniforms.force.value   = vel;
    });

    renderer.render(scene, camera);
  })();
}

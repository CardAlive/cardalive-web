/* CardAlive — the city behind the page.
   A procedural Gothic city laid out like the game's own: Lantern Row in the
   south, Weighhouse Market, Assize Quay, the Underline trench and the broken
   Great Span, Cinder Close, Cathedral Plaza, and the Cathedral at the
   epicentre. Scrolling walks the camera north along it; main.js feeds the
   corruption, the light-span, the scale view, the Veil Dive and the fight
   through window.CA. Built once from a fixed seed, so every visit sees the
   same city. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const S = (window.CA = window.CA || {});
S.worldStarted = true;

const canvas = document.getElementById('world');
const dissolve = document.getElementById('dissolve');
const params = new URLSearchParams(location.search);
// main.js owns the motion preference (full motion unless the visitor turned it off)
const rm = () => !!S.reduceMotion;
const SMALL = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;

let renderer;
try {
  if (params.has('nowebgl')) throw new Error('fallback requested'); // preview the painted fallback
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no context');
} catch (err) {
  document.dispatchEvent(new Event('ca:fail'));
  throw err;
}

/* ------------------------------------------------------------------
   Seeded randomness
   ------------------------------------------------------------------ */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(1003); // the masterplan's seed
const R = (a, b) => a + (b - a) * rnd();

/* ------------------------------------------------------------------
   Renderer, scene, post
   ------------------------------------------------------------------ */
let pixelRatio = Math.min(window.devicePixelRatio || 1, SMALL ? 1 : 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Tile-based GPUs (phones, tablets, Apple silicon) already shade each pixel about once, so the
// city's depth pre-pass would only add work for them
const GPU_NAME = (() => {
  const gl = renderer.getContext();
  const name = gl.getParameter(gl.RENDERER) || '';
  if (!/^webkit webgl$/i.test(name)) return name;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : name;
})();
const TILER = /apple|mali|adreno|powervr|immortalis|xclipse/i.test(GPU_NAME);

const LIN = THREE.LinearSRGBColorSpace;
const FOG_NIGHT = new THREE.Color().setRGB(0.020, 0.012, 0.034, LIN);
const FOG_VEIL = new THREE.Color().setRGB(0.003, 0.016, 0.05, LIN);
const FOG_BLOOD = new THREE.Color().setRGB(0.045, 0.006, 0.02, LIN);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG_NIGHT.clone(), 0.0024);
scene.background = FOG_NIGHT.clone();

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 4200);
S.cam = camera.position; // read by the HUD readout in main.js

// The post chain renders into its own targets, so the canvas's own antialias flag does nothing;
// multisample those targets instead.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: SMALL ? 2 : 4 }));
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.55, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ------------------------------------------------------------------
   Shared uniforms
   ------------------------------------------------------------------ */
const CATH = new THREE.Vector3(0, 0, -165);
const U = {
  uTime: { value: 0 },
  uVeil: { value: 0 },
  uCorr: { value: 0.1 },
  uReach: { value: 200 },
  uFlash: { value: 0 },
  uBoss: { value: 0 },
  uCath: { value: CATH },
  uScale: { value: 600 },
};

const GLSL_NOISE = /* glsl */ `
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
    return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
  float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }
`;

function shader(opts) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, THREE.UniformsUtils.clone(THREE.UniformsLib.fog), U, opts.uniforms || {}),
    vertexShader: opts.vertex,
    fragmentShader: opts.fragment,
    defines: opts.defines || {},
    fog: opts.fog !== false,
    transparent: !!opts.transparent,
    depthWrite: opts.depthWrite !== false,
    blending: opts.blending || THREE.NormalBlending,
    side: opts.side || THREE.FrontSide,
    extensions: { derivatives: true },
  });
}

/* ------------------------------------------------------------------
   Stone: every building, wall, pier and spire shares one shader.
   Windows are cut in world space, so a block of any size gets a
   regular grid of them; the Veil Dive swaps the look for a blueprint.
   ------------------------------------------------------------------ */
const STONE_VERT = /* glsl */ `
  attribute float aSeed;
  varying vec3 vW; varying vec3 vN; varying vec3 vLocal; varying vec3 vScale; varying float vSeed;
  #include <fog_pars_vertex>
  void main(){
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vec4 wp = m * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(m) * normal);
    vLocal = position;
    vScale = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz));
    vSeed = aSeed;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const STONE_FRAG = /* glsl */ `
  uniform float uTime, uVeil, uCorr, uReach, uFlash, uBoss, uWin, uEdge, uTone;
  uniform vec3 uCath;
  varying vec3 vW; varying vec3 vN; varying vec3 vLocal; varying vec3 vScale; varying float vSeed;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  void main(){
    vec3 n = normalize(vN);
    vec3 base = mix(vec3(0.020, 0.019, 0.028), vec3(0.058, 0.052, 0.072), clamp(vW.y / 80.0, 0.0, 1.0)) * uTone;
    base *= 0.8 + 0.4 * hash12(vec2(vSeed * 91.7, 3.1));
    vec3 L = normalize(vec3(-0.45, 0.75, -0.5));
    float diff = max(dot(n, L), 0.0);
    vec3 col = base * (0.45 + 1.15 * diff) + vec3(0.016, 0.02, 0.045) * max(n.y, 0.0);

    // violet bounce light off the corruption, strongest facing the Cathedral
    vec2 toC = uCath.xz - vW.xz; float dC = length(toC);
    float near = exp(-dC / 150.0);
    float face = max(dot(n.xz, toC / max(dC, 1.0)), 0.0);
    col += vec3(0.30, 0.06, 0.55) * near * (0.35 + 0.65 * face) * (0.25 + 0.75 * uCorr) * (1.0 + uBoss) * 0.6;

    // box edges: never thinner than ~1.5 px, and dimmer as they shrink, so they never crawl
    vec3 lp = vLocal - vec3(0.0, 0.5, 0.0);
    vec3 dd = (0.5 - abs(lp)) * vScale;
    float mn = min(dd.x, min(dd.y, dd.z)), mx = max(dd.x, max(dd.y, dd.z));
    float mid = dd.x + dd.y + dd.z - mn - mx;
    float pw = fwidth(mid);
    float edgeW = 0.45 + pw * 1.5;
    float edgeK = 0.45 / edgeW;
    float edge = (1.0 - smoothstep(0.0, edgeW, mid)) * uEdge * edgeK * edgeK;
    col += vec3(0.05, 0.045, 0.075) * edge;

    // windows, filtered: crisp up close, faded to their average glow as a window shrinks toward
    // a pixel; unfiltered they moire and sparkle on distant facades whenever the camera moves
    float vert = 1.0 - abs(n.y);
    vec2 fuv = (abs(n.x) > abs(n.z)) ? vec2(vW.z, vW.y) : vec2(vW.x, vW.y);
    vec2 g = fuv / vec2(3.4, 4.2);
    vec2 fw = max(fwidth(g), vec2(1e-4));
    vec2 id = floor(g), f = fract(g);
    vec2 a0 = smoothstep(vec2(0.32, 0.22) - fw, vec2(0.32, 0.22) + fw, f);
    vec2 a1 = 1.0 - smoothstep(vec2(0.68, 0.78) - fw, vec2(0.68, 0.78) + fw, f);
    float win = a0.x * a0.y * a1.x * a1.y;
    float far = smoothstep(0.16, 0.45, max(fw.x, fw.y));
    float r = hash12(id + vSeed * 17.0);
    float lit = step(0.78, r);
    float flick = 0.8 + 0.2 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
    vec3 warm = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.68, 0.32), hash12(id + 7.7));
    warm = mix(warm, vec3(1.0, 0.55, 0.22), far);
    float corrNear = smoothstep(uReach, uReach * 0.4, dC);
    warm = mix(warm, vec3(0.62, 0.20, 1.0), corrNear * 0.85);
    float facade = vert * (1.0 - edge) * uWin;
    float wmask = mix(win, 0.2, far) * facade;
    float glow = mix(win * lit * flick, 0.03, far) * facade;
    col = mix(col, col * 0.4, wmask);
    col += warm * glow * 1.45;

    col += vec3(0.07, 0.065, 0.12) * uFlash * (0.2 + 0.8 * max(n.y, 0.0));

    // Veil Dive: blueprint (grid lines fade out before they can alias)
    vec2 gp = (abs(n.y) > 0.5) ? vW.xz : fuv;
    vec2 fg = max(fwidth(gp / 6.0), vec2(1e-4));
    vec2 gq = abs(fract(gp / 6.0 - 0.5) - 0.5) / fg;
    float grid = (1.0 - min(min(gq.x, gq.y), 1.0)) * (1.0 - smoothstep(0.15, 0.5, max(fg.x, fg.y)));
    float bpW = 0.35 + pw * 1.5;
    float bpEdge = (1.0 - smoothstep(0.0, bpW, mid)) * uEdge * (0.35 / bpW);
    vec3 bp = vec3(0.004, 0.018, 0.06) + vec3(0.08, 0.65, 1.0) * (grid * 0.3 + bpEdge * 1.6)
            + vec3(0.1, 0.7, 1.2) * glow * 0.9;
    col = mix(col, bp, uVeil);

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;
const stoneMat = (win, edge, tone) => shader({
  vertex: STONE_VERT, fragment: STONE_FRAG,
  uniforms: { uWin: { value: win }, uEdge: { value: edge }, uTone: { value: tone || 1 } },
});
const MAT_BUILDING = stoneMat(1, 1, 1); // the Underline's inhabited walls
const MAT_PLAIN = stoneMat(0, 1, 1.1);

const GEO_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

const _o = new THREE.Object3D();
const _off = new THREE.Vector3();
// near pieces first: every camera looks north, so sorting south-to-north lets the depth test
// throw away most of what stands behind before it is shaded
const nearFirst = (a, b) => (b.z + 0.3 * b.x) - (a.z + 0.3 * a.x);
function instanced(geo, mat, list, prepass) {
  // seeds are drawn in the order given, before sorting, so each entry keeps the one it always had
  list = list.map((b) => (b.seed != null ? b : Object.assign({}, b, { seed: rnd() }))).sort(nearFirst);
  const g = geo.clone();
  const mesh = new THREE.InstancedMesh(g, mat, Math.max(1, list.length));
  const seeds = new Float32Array(Math.max(1, list.length));
  list.forEach((b, i) => {
    _o.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0);
    _o.position.set(b.x, b.y || 0, b.z);
    // geometry pivots at its base; `c` marks an entry placed by its centre
    if (b.c) _o.position.sub(_off.set(0, b.h / 2, 0).applyEuler(_o.rotation));
    _o.scale.set(b.w, b.h, b.d);
    _o.updateMatrix();
    mesh.setMatrixAt(i, _o.matrix);
    seeds[i] = b.seed;
  });
  mesh.count = list.length;
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  if (prepass && !TILER) {
    const pre = new THREE.InstancedMesh(g, PREPASS, Math.max(1, list.length));
    pre.instanceMatrix = mesh.instanceMatrix;
    pre.count = list.length;
    pre.frustumCulled = false;
    pre.renderOrder = -1;
    scene.add(pre);
  }
  return mesh;
}

/* ------------------------------------------------------------------
   Modelled pieces. Each stands on y = 0 and spans one unit, like
   GEO_BOX, so an entry's w/h/d size it; the dormer and the flying
   buttress are drawn in metres. Faces are wound outward from the
   centre last given, so shapes are written without minding order,
   and each face is flat-shaded with a normal of its own.
   ------------------------------------------------------------------ */
function piece(build) {
  const pts = [], faces = [];
  const c = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), M = new THREE.Vector3();
  const k = {
    centre(x, y, z) { c.set(x, y, z); },
    v(x, y, z) { pts.push(x, y, z); return pts.length / 3 - 1; },
    // a flat convex polygon
    face(...ids) {
      M.set(0, 0, 0);
      ids.forEach((i) => M.add(A.fromArray(pts, i * 3)));
      M.divideScalar(ids.length).sub(c);
      A.fromArray(pts, ids[0] * 3); B.fromArray(pts, ids[1] * 3).sub(A); C.fromArray(pts, ids[2] * 3).sub(A);
      faces.push(B.cross(C).dot(M) < 0 ? ids.reverse() : ids);
    },
    box(x0, x1, y0, y1, z0, z1) { // no floor
      k.centre((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      const p = [];
      [y0, y1].forEach((y) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => p.push(k.v(x, y, z))));
      for (let i = 0; i < 4; i++) k.face(p[i], p[(i + 1) % 4], p[4 + (i + 1) % 4], p[4 + i]);
      k.face(p[4], p[5], p[6], p[7]);
    },
    // n sides from circumradius r0 at y0 to r1 at y1 (0 closes it to a point); the faces look down the axes
    ring(n, r0, r1, y0, y1, cap) {
      k.centre(0, (y0 + y1) / 2, 0);
      const lo = [], hi = [];
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * Math.PI * 2;
        lo.push(k.v(Math.cos(a) * r0, y0, Math.sin(a) * r0));
        if (r1 > 0) hi.push(k.v(Math.cos(a) * r1, y1, Math.sin(a) * r1));
      }
      const apex = r1 > 0 ? -1 : k.v(0, y1, 0);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (r1 > 0) k.face(lo[i], lo[j], hi[j], hi[i]); else k.face(lo[i], lo[j], apex);
      }
      if (cap && r1 > 0) { k.centre(0, y0, 0); k.face(...hi); }
    },
  };
  k.tri = k.quad = k.face;
  build(k);
  // every face gets corners of its own, so it carries its own flat normal
  const pos = [], nor = [], idx = [];
  faces.forEach((f) => {
    const base = pos.length / 3;
    A.fromArray(pts, f[0] * 3); B.fromArray(pts, f[1] * 3).sub(A); C.fromArray(pts, f[2] * 3).sub(A);
    B.cross(C).normalize();
    f.forEach((i) => { pos.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); nor.push(B.x, B.y, B.z); });
    for (let j = 1; j < f.length - 1; j++) idx.push(base, base + j, base + j + 1);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

const GEO_BLOCK = piece((k) => k.box(-0.5, 0.5, 0, 1, -0.5, 0.5));
const roofPiece = (ridge) => piece((k) => {
  k.centre(0, 0.35, 0);
  const a = k.v(-0.5, 0, -0.5), b = k.v(0.5, 0, -0.5), c = k.v(0.5, 0, 0.5), d = k.v(-0.5, 0, 0.5);
  const e = k.v(-ridge, 1, 0), f = k.v(ridge, 1, 0);
  k.quad(a, b, f, e); k.quad(d, c, f, e); k.tri(a, d, e); k.tri(b, c, f);
});
const GEO_GABLE = roofPiece(0.5); // ridge along x, a gable wall at each end
const GEO_HIP = roofPiece(0.22);
// a gabled dormer in metres, its window wall at z = 0 and its body reaching back (scaled) into the roof
const GEO_DORMER = piece((k) => {
  k.centre(0, 1.2, -0.5);
  const fa = k.v(-0.9, 0, 0), fb = k.v(0.9, 0, 0), fc = k.v(0.9, 1.8, 0), fd = k.v(-0.9, 1.8, 0), fe = k.v(0, 2.55, 0);
  const ba = k.v(-0.9, 0, -1), bb = k.v(0.9, 0, -1), bc = k.v(0.9, 1.8, -1), bd = k.v(-0.9, 1.8, -1);
  k.quad(fa, fb, fc, fd); k.tri(fd, fc, fe);
  k.quad(fa, ba, bd, fd); k.quad(fb, bb, bc, fc);
  const l0 = k.v(-1.08, 1.7, 0.15), r0 = k.v(1.08, 1.7, 0.15), t0 = k.v(0, 2.68, 0.15);
  const l1 = k.v(-1.08, 1.7, -1), r1 = k.v(1.08, 1.7, -1), t1 = k.v(0, 2.68, -1);
  k.quad(l0, t0, t1, l1); k.quad(r0, t0, t1, r1);
});
// an open belfry lantern, the spire over it, and four lucarnes round its foot
const GEO_SPIRE_8 = piece((k) => {
  k.ring(8, 0.42, 0.42, 0, 0.16);
  k.ring(8, 0.48, 0, 0.16, 1);
  for (let i = 0; i < 4; i++) {
    const cs = Math.cos(i * Math.PI / 2), sn = Math.sin(i * Math.PI / 2);
    const P = (x, y, r) => k.v(cs * r - sn * x, y, sn * r + cs * x);
    k.centre(cs * 0.3, 0.26, sn * 0.3);
    const f1 = P(-0.07, 0.21, 0.47), f2 = P(0.07, 0.21, 0.47), f3 = P(0, 0.36, 0.47), b = P(0, 0.42, 0.3);
    k.tri(f1, f2, f3); k.tri(f1, f3, b); k.tri(f2, f3, b);
  }
});
// a square pinnacle: gabled on all four faces, with a spirelet behind the gables
const GEO_PINNACLE = piece((k) => {
  k.box(-0.5, 0.5, 0, 0.4, -0.5, 0.5);
  k.ring(4, 0.7071, 0, 0.4, 1);
  for (let i = 0; i < 4; i++) {
    const cs = Math.cos(i * Math.PI / 2), sn = Math.sin(i * Math.PI / 2);
    const P = (x, y, r) => k.v(cs * r - sn * x, y, sn * r + cs * x);
    k.centre(cs * 0.3, 0.45, sn * 0.3);
    const f1 = P(-0.5, 0.4, 0.5), f2 = P(0.5, 0.4, 0.5), f3 = P(0, 0.64, 0.5), b = P(0, 0.72, 0.23);
    k.tri(f1, f2, f3); k.tri(f1, f3, b); k.tri(f2, f3, b);
  }
});
// an octagonal stair turret under a candle-snuffer roof (also the Cathedral's apse)
const GEO_TURRET = piece((k) => { k.ring(8, 0.5, 0.5, 0, 0.7); k.ring(8, 0.56, 0, 0.7, 1); });
// a flying buttress in metres for the east side of the nave: coping above, a quarter arch below
const GEO_FLYER = piece((k) => {
  const N = 7, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, th = t * Math.PI / 2;
    top.push([29.6 - 12.6 * t, 31.2 + 10 * t]);
    bot.push([29.6 - 12.6 * Math.sin(th), 37.5 - 13.5 * Math.cos(th)]);
  }
  for (let i = 0; i < N; i++) {
    const q = [top[i], top[i + 1], bot[i + 1], bot[i]];
    const mx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, my = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
    [-0.7, 0.7].forEach((z) => { k.centre(mx, my, 0); k.quad(...q.map(([x, y]) => k.v(x, y, z))); });
    k.centre((bot[i][0] + bot[i + 1][0]) / 2, (bot[i][1] + bot[i + 1][1]) / 2, 0);
    k.quad(k.v(top[i][0], top[i][1], -0.7), k.v(top[i + 1][0], top[i + 1][1], -0.7), k.v(top[i + 1][0], top[i + 1][1], 0.7), k.v(top[i][0], top[i][1], 0.7));
    k.centre((top[i][0] + top[i + 1][0]) / 2, (top[i][1] + top[i + 1][1]) / 2, 0);
    k.quad(k.v(bot[i][0], bot[i][1], -0.7), k.v(bot[i + 1][0], bot[i + 1][1], -0.7), k.v(bot[i + 1][0], bot[i + 1][1], 0.7), k.v(bot[i][0], bot[i][1], 0.7));
  }
});

/* ------------------------------------------------------------------
   Town stone: walls, slate and lead, from one shader. Walls are told
   from roofs by their slope, and windows are laid out per face in
   the piece's own metres, so each wall gets whole windows centred
   on it.
   ------------------------------------------------------------------ */
const TOWN_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uLod;
  varying vec3 vW; varying vec3 vL; varying vec3 vS; varying vec3 vN; varying vec3 vNl; varying float vSeed;
  #include <fog_pars_vertex>
  void main(){
    mat4 m = modelMatrix * instanceMatrix;
    vec3 S = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz));
    vNl = normalize(normal / S);                  // in the piece's own metres, before it is turned
    vN = normalize(mat3(m) * (normal / (S * S))); // in the world
    // small pieces sink into their base as they fall out of sight, so far ones shade nothing
    float keep = uLod > 0.0 ? smoothstep(uLod, uLod * 0.8, distance(cameraPosition, m[3].xyz)) : 1.0;
    vec4 wp = m * vec4(position * keep, 1.0);
    vW = wp.xyz; vL = position * S; vS = S; vSeed = aSeed;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
// Each material compiles only what it uses: WINDOWS (BLIND for carved arcading instead of glass),
// SIDES8 for octagonal pieces, ROOF 0/1/2 for slate, lead or stone on pitched faces.
const TOWN_FRAG = /* glsl */ `
  uniform float uTime, uVeil, uCorr, uReach, uFlash, uBoss;
  uniform float uTone, uSpan, uFaceW, uWinK;
  uniform vec4 uWin;
  uniform vec3 uCath;
  varying vec3 vW; varying vec3 vL; varying vec3 vS; varying vec3 vN; varying vec3 vNl; varying float vSeed;
  #include <fog_pars_fragment>
  ${GLSL_NOISE}
  const vec3 KEY = vec3(-0.4467, 0.7444, -0.4963);
  const vec3 MOON = vec3(-0.4187, 0.2991, -0.8574);

  // a pointed (equilateral) arch: signed distance in metres, p.x from its centre line, p.y up from its sill
  float lancet(vec2 p, float hw, float h){
    float y0 = h - 1.732 * hw, side = abs(p.x) - hw;
    return p.y < y0 ? max(side, -p.y) : max(length(vec2(abs(p.x) + hw, p.y - y0)) - 2.0 * hw, side);
  }
  // how much of a pixel w metres wide lies inside a shape d metres away (negative d: inside)
  float cover(float d, float w){ return clamp(0.5 - d / w, 0.0, 1.0); }
  // lines w metres wide every period metres, faded to their average before they can alias
  float lines(float x, float period, float w){
    float q = x / period, fw = fwidth(q), h = 0.5 * w / period;
    float d = abs(fract(q + 0.5) - 0.5);
    return mix(1.0 - smoothstep(h - fw * 0.5, h + fw * 0.5, d), 2.0 * h, smoothstep(0.15, 0.45, fw));
  }

  void main(){
    vec3 n = vN, nl = vNl; // every face is flat, so these hold steady across it
    float seedA = hash12(vec2(vSeed * 91.7, 3.1));
    float diff = max(dot(n, KEY), 0.0);
    // across the face, measured from its centre line (every piece is built round its own axis)
    vec2 nh = nl.xz / max(length(nl.xz), 1e-4);
    float u = dot(vL.xz, vec2(-nh.y, nh.x));
    float y = vL.y;
    vec3 stone = mix(vec3(0.020, 0.019, 0.028), vec3(0.058, 0.052, 0.072), clamp(vW.y / 80.0, 0.0, 1.0)) * uTone * (0.8 + 0.4 * seedA);
    vec3 col, warm = vec3(1.0, 0.55, 0.22);
    float glow = 0.0;

    if (abs(nl.y) < 0.02) {
      // walls: coursed stone, quoins on the corners, darker at the foot
      #if defined(FACEW)
        float W = uFaceW;
      #elif defined(SIDES8)
        float W = dot(vL.xz, nh) * 0.8284;
      #else
        float W = abs(nl.x) > abs(nl.z) ? vS.z : vS.x;
      #endif
      vec2 mpp = fwidth(vec2(u, y)) + 1e-4; // metres per pixel across and up the face
      float aa = max(mpp.x, mpp.y);
      float edgeD = 0.5 * W - abs(u);
      float cq = y / 0.55, fade = smoothstep(0.08, 0.25, mpp.y);
      float course = mix(cover(abs(fract(cq + 0.5) - 0.5) * 0.55 - 0.025, mpp.y), 0.09, fade);
      float quoin = mix(cover(edgeD - 0.4 - 0.3 * mod(floor(cq), 2.0), mpp.x), 0.5 - 0.5 * smoothstep(0.3, 0.75, edgeD), fade);
      col = stone * (1.0 - 0.22 * course) * (1.0 + 0.45 * quoin) * (0.7 + 0.3 * smoothstep(0.0, 2.5, vW.y)) * (0.45 + 1.15 * diff);

      #ifdef WINDOWS
      if (uWin.x > 0.0) {
        vec4 win = uWin;
        #ifdef SIDES8
          win.yzw *= vS.y * uWinK / 3.4; win.z = min(win.z, 0.3 * W);
        #endif
        float cols = max(1.0, floor((W - 1.0) / uSpan)), cw = W / cols;
        vec2 g = vec2((u + 0.5 * W) / cw, (y - win.y) / win.x);
        vec2 id = floor(g);
        float far = smoothstep(0.16, 0.45, max(mpp.x / cw, mpp.y / win.x));
        vec2 p = vec2((fract(g.x) - 0.5) * cw, fract(g.y) * win.x - 0.25);
        #ifdef FACEW
          float valid = step(0.0, id.y) * step(id.y, 0.0) * step(0.7, nl.z); // the dormer's one window
        #else
          float valid = step(0.0, id.y) * step(id.y, floor((vS.y - 1.0 - win.y - win.w) / win.x)); // whole windows only
        #endif
        float d = lancet(p, win.z, win.w);
        float glass = cover(d, aa) * valid;
        #ifdef BLIND
          // blind arcading: a sunk panel inside a raised moulding
          float mould = cover(abs(d) - 0.12, aa) * valid;
          col *= mix(1.0 - 0.35 * glass + 0.7 * mould, 0.92, far);
        #else
          // which face this is, from steps of the normal well clear of floor()'s edges (an interpolated
          // normal wobbles in its last bit, and a key on an edge would flip from pixel to pixel)
          float r = hash12(id + vec2(dot(floor(nl.xz * 1.9 + 2.5), vec2(3.0, 7.0)) * 13.7, vSeed * 17.0));
          #ifdef SIDES8
            float lit = step(0.8, r);
          #else
            float lit = step(id.y < 0.5 ? 0.58 : 0.72, r); // shops and kitchens on the ground floor
          #endif
          float flick = 0.8 + 0.2 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
          warm = mix(mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.68, 0.32), fract(r * 7.13)), warm, far);
          float near = (1.0 - far) * valid * smoothstep(0.07, 0.035, aa); // glazing bars and sills only up close
          float reveal = cover(d - 0.14, aa) * valid - glass;
          float bars = max(cover(abs(p.x) - 0.04, aa), cover(abs(p.y - win.w * 0.42) - 0.04, aa)) * step(0.45, win.z);
          float pane = glass * (1.0 - 0.85 * bars * near);
          float sill = near * cover(abs(p.x) - win.z - 0.12, aa) * cover(abs(p.y + 0.16) - 0.08, aa);
          float rim = 1.0 - max(dot(n, normalize(cameraPosition - vW)), 0.0);
          col = mix(col, vec3(0.005, 0.006, 0.012) + vec3(0.02, 0.024, 0.05) * rim * rim * rim, mix(pane + reveal * 0.55, 0.2, far));
          col += stone * 1.4 * sill * (0.45 + diff);
          glow = mix(pane * lit * flick * (0.8 + 0.35 * (1.0 - p.y / win.w)), 0.045, far);
        #endif
      }
      #endif
    } else if (abs(nl.y) < 0.97) {
      // pitched faces
      float spec = pow(max(dot(reflect(normalize(vW - cameraPosition), n), MOON), 0.0), 10.0);
      #if ROOF == 0
        // slate: level courses, each offset half a slate from the one below
        float row = y / 0.3, rid = floor(row);
        float tu = u / 0.42 + 0.5 * mod(rid, 2.0);
        vec2 fwT = fwidth(vec2(tu, row));
        float farT = smoothstep(0.2, 0.55, max(fwT.x, fwT.y));
        float tv = hash12(vec2(floor(tu), rid) + vSeed * 7.0);
        float lap = smoothstep(0.0, 0.22 + fwT.y, fract(row));
        float joint = smoothstep(0.0, 0.08 + fwT.x, 0.5 - abs(fract(tu) - 0.5));
        // weathered darker toward the eaves, a lead flashing catching the light along the ridge
        #ifdef FACEW
          float ridge = 0.0; // dormers are drawn in metres; their own ridge is not the piece's top
        #else
          float ridge = cover(vS.y - y - 0.22, fwT.y * 0.3);
        #endif
        vec3 rc = vec3(0.027, 0.028, 0.042) * (0.7 + 0.6 * seedA) * (0.7 + 0.3 * smoothstep(0.0, 2.0, y)) * (1.0 + 0.9 * ridge);
        #ifdef SIDES8
          // a few spires were sheathed in copper, long since gone to verdigris
          rc = mix(rc, vec3(0.022, 0.036, 0.04), step(0.9, hash12(vec2(vSeed * 13.1, 5.7))));
        #endif
        rc *= uTone * mix((0.72 + 0.5 * tv) * mix(0.5, 1.0, lap) * mix(0.75, 1.0, joint), 0.82, farT);
      #elif ROOF == 1
        // lead with standing seams
        vec3 rc = vec3(0.045, 0.05, 0.066) * uTone * (1.0 + 0.8 * lines(u, 0.9, 0.09));
        spec *= 2.0;
      #else
        vec3 rc = stone * 1.1 * (1.0 - 0.18 * lines(y, 0.6, 0.05));
        spec *= 0.4;
      #endif
      #ifdef SIDES8
        // ribs up the arrises, and a band of crockets every few metres
        float re = dot(vL.xz, nh) * 0.4142 - abs(u);
        rc *= 1.0 + 0.45 * (1.0 - smoothstep(0.06, 0.16 + fwidth(re), re)) + 0.3 * lines(y, 4.5, 0.25);
      #endif
      col = rc * (0.5 + 1.25 * diff) + vec3(0.012, 0.015, 0.036) * max(n.y, 0.0) + vec3(0.035, 0.04, 0.075) * spec;
    } else {
      col = stone * 1.1 * (0.45 + 1.15 * diff) + vec3(0.016, 0.02, 0.045) * max(n.y, 0.0);
    }

    // violet bounce light off the corruption, strongest facing the Cathedral
    vec2 toC = uCath.xz - vW.xz; float dC = length(toC);
    float face = max(dot(n.xz, toC / max(dC, 1.0)), 0.0);
    col += vec3(0.30, 0.06, 0.55) * exp(-dC / 150.0) * (0.35 + 0.65 * face) * (0.25 + 0.75 * uCorr) * (1.0 + uBoss) * 0.6;
    // warm light thrown up from the streets
    col += vec3(0.05, 0.022, 0.008) * exp(-max(vW.y, 0.0) / 7.0) * (1.0 - abs(n.y));
    warm = mix(warm, vec3(0.62, 0.20, 1.0), smoothstep(uReach, uReach * 0.4, dC) * 0.85);
    col += warm * glow * 1.45;
    col += vec3(0.07, 0.065, 0.12) * uFlash * (0.2 + 0.8 * max(n.y, 0.0));

    if (uVeil > 0.001) {
      // Veil Dive: blueprint (grid lines fade out before they can alias)
      vec2 gp = abs(n.y) > 0.5 ? vW.xz : vec2(u, y);
      vec2 fg2 = max(fwidth(gp / 6.0), vec2(1e-4));
      vec2 gq = abs(fract(gp / 6.0 - 0.5) - 0.5) / fg2;
      float grid = (1.0 - min(min(gq.x, gq.y), 1.0)) * (1.0 - smoothstep(0.15, 0.5, max(fg2.x, fg2.y)));
      col = mix(col, vec3(0.004, 0.018, 0.06) + vec3(0.08, 0.65, 1.0) * grid * 0.3 + vec3(0.1, 0.7, 1.2) * glow * 0.9, uVeil);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;
const townMat = (o) => {
  const defines = { ROOF: o.roof || 0 };
  if (o.win) defines.WINDOWS = '';
  if (o.blind) defines.BLIND = '';
  if (o.sides === 8) defines.SIDES8 = '';
  if (o.faceW) defines.FACEW = '';
  return shader({
    vertex: TOWN_VERT, fragment: TOWN_FRAG, defines,
    uniforms: {
      uTone: { value: o.tone || 1 }, uWin: { value: new THREE.Vector4().fromArray(o.win || [0, 0, 0, 0]) },
      uSpan: { value: o.span || 100 }, uFaceW: { value: o.faceW || 0 }, uWinK: { value: o.winK || 0 }, uLod: { value: o.lod || 0 },
    },
  });
  return m;
};
// uWin: floor height, first sill, window half-width, window height (all metres)
const LOD = SMALL ? 230 : 330;
const HOLY_WIN = { win: [9.5, 1.6, 1.15, 6.8], span: 3.8, blind: true };
const M_HOUSE = townMat({ win: [4.2, 1.5, 0.6, 2.2], span: 3.3 });
const M_TOWER = townMat({ win: [5, 2.5, 0.6, 3], span: 3.4 });
const M_ROOF = townMat({ win: [9, 0.7, 0.4, 1.5] });                 // slate, an attic window in each gable
const M_DORMER = townMat({ win: [9, 0.25, 0.42, 1.3], faceW: 1.8, lod: LOD });
const M_TRIM = townMat({ tone: 1.25, roof: 2 });
const M_CHIMNEY = townMat({ tone: 0.9, roof: 2, lod: LOD });
const M_SPIRE = townMat({ win: [100, 0.5, 0.42, 2.3], sides: 8, winK: 0.16, tone: 2.5 });
const M_TURRET = townMat({ win: [0, 0, 0, 0], sides: 8, tone: 1.3 });   // shares the spire's program; no windows
const M_HOLY = townMat({ tone: 1.2, ...HOLY_WIN });
const M_HOLY_TRIM = townMat({ tone: 1.35, roof: 2 });
const M_HOLY_ROOF = townMat({ tone: 1.2, roof: 1, ...HOLY_WIN });
const M_HOLY_SPIRE = townMat({ win: [100, 0.5, 0.42, 2.3], sides: 8, winK: 0.16, tone: 1.5, roof: 2 });
const M_APSE = townMat({ tone: 1.2, roof: 1, sides: 8, ...HOLY_WIN });
// The depth pre-pass: the big pieces lay their depth down first, so the stone shader runs about
// once per pixel instead of once per layer of town behind it.
const PREPASS = shader({ vertex: TOWN_VERT, fragment: 'void main(){ gl_FragColor = vec4(0.0); }', fog: false, uniforms: { uLod: { value: 0 } } });
PREPASS.colorWrite = false;
PREPASS.polygonOffset = true; PREPASS.polygonOffsetFactor = 1; PREPASS.polygonOffsetUnits = 1; // never in front of the shaded pass

/* ------------------------------------------------------------------
   Layout (metres; north is -z)
   ------------------------------------------------------------------ */
const TRENCH_N = -5, TRENCH_S = 45;            // the Underline
const QUAY_S = 64;                             // Assize Quay runs along the trench's south lip
const MARKET = { x: 0, z: 140, r: 40 };
const PLAZA = { x0: -58, x1: 58, z0: -250, z1: -62 };
const AVENUE = 13;

// The Conduit Spine, 16 m over the roofs, into the Cathedral's flank
const conduitCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-70, 44, 300), new THREE.Vector3(-62, 44, 230), new THREE.Vector3(-52, 44, 150),
  new THREE.Vector3(-44, 44, 70), new THREE.Vector3(-40, 44, -10), new THREE.Vector3(-46, 42, -100),
  new THREE.Vector3(-44, 34, -150), new THREE.Vector3(-41, 28, -170),
]);
const conduitPts = conduitCurve.getSpacedPoints(120);
const nearConduit = (x, z) => conduitPts.some((p) => Math.abs(p.x - x) < 15 && Math.abs(p.z - z) < 15);

const WEIGH_TOWER = { x: -30, z: 86 };

const walls = [], towerWalls = [], trims = [], gables = [], hips = [], chimneys = [], dormers = [], spires = [], pinnacles = [], turrets = [];
const trench = [], plain = [];
const lamps = [];

// The plan above draws from `rnd`, so the streets stay where they always were; how each block
// is dressed (roof, chimneys, dormers, turrets) draws from its own stream.
const rd = mulberry(4111);
// The old box city also drew one seed from `rnd` for each block, roof, spire and Cathedral piece.
// The roots, mist and embers draw from `rnd` after it, so the city burns as many seeds as the old
// one drew (below the instancing) and they stay where they were. Its Cathedral took 92.
let oldDraws = 92;
const D = (a, b) => a + (b - a) * rd();
// a point in a block's own frame, in world space
function onBlock(b, lx, lz) {
  const c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

// A house: walls, a gabled or hipped slate roof, a cornice, chimneys on the ridge,
// dormers on steep roofs, now and then a stair turret on a corner. Far ones get walls and a roof.
function house(b, rh, kind) {
  b.seed = rd();
  if (rd() < 0.5) { b.ry = (b.ry || 0) + Math.PI / 2; [b.w, b.d] = [b.d, b.w]; } // turn the ridge
  walls.push(b);
  const hip = kind !== 'gable';
  (hip ? hips : gables).push({ x: b.x, y: b.h, z: b.z, w: b.w + 0.6, h: rh, d: b.d + 0.9, ry: b.ry, seed: b.seed });
  if (kind === 'far') return;
  if (rd() < 0.55) trims.push({ x: b.x, y: b.h - 0.75, z: b.z, w: b.w + 0.45, h: 0.75, d: b.d + 0.45, ry: b.ry, seed: b.seed });
  const ends = b.w > 11 && rd() < 0.5 ? [-1, 1] : [rd() < 0.5 ? -1 : 1];
  ends.forEach((s) => {
    const p = onBlock(b, s * (b.w / 2 - D(0.9, 1.6)), D(-0.12, 0.12) * b.d);
    chimneys.push({ x: p.x, y: b.h + rh * 0.4, z: p.z, w: 1.1, h: rh * 0.6 + D(1, 2.2), d: 0.85, ry: b.ry, seed: b.seed });
  });
  if (!hip && rh > 5.2) {
    // dormer fronts halfway up the slope, their bodies run back until the roof swallows them
    const half = b.d / 2 + 0.45, lzF = half * 0.5, y0 = b.h + rh * 0.5 - 0.35;
    const depth = half * 2.4 / rh + 0.3;
    [1, -1].forEach((s) => {
      if (rd() < 0.35) return;
      const n = b.w > 11 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const p = onBlock(b, n === 1 ? D(-0.15, 0.15) * b.w : (i ? 1 : -1) * b.w * 0.24, s * lzF);
        dormers.push({ x: p.x, y: y0, z: p.z, w: 1, h: 1, d: depth, ry: (b.ry || 0) + (s < 0 ? Math.PI : 0), seed: rd() });
      }
    });
  }
  if (b.w > 9 && b.d > 9 && rd() < 0.12) {
    const p = onBlock(b, (rd() < 0.5 ? -0.5 : 0.5) * b.w, (rd() < 0.5 ? -0.5 : 0.5) * b.d);
    turrets.push({ x: p.x, z: p.z, w: 2.8, h: (b.h + 1.2) / 0.7, d: 2.8, ry: b.ry, seed: b.seed });
  }
}

// A tower: shaft, parapet, belfry lantern and spire; near ones get clasping piers and corner pinnacles
function tower(x, z, tw, h, sh, ry, far) {
  const seed = rd();
  towerWalls.push({ x, z, w: tw, h, d: tw, ry, seed });
  trims.push({ x, y: h - 0.5, z, w: tw + 0.8, h: 1.5, d: tw + 0.8, ry, seed });
  spires.push({ x, y: h, z, w: tw * 0.95, h: sh, d: tw * 0.95, ry, seed });
  if (far) return;
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    const p = onBlock({ x, z, ry }, sx * tw / 2, sz * tw / 2);
    trims.push({ x: p.x, z: p.z, w: 1.3, h: h * D(0.8, 0.9), d: 1.3, ry, seed });
    pinnacles.push({ x: p.x, y: h + 1, z: p.z, w: 1.1, h: D(3.5, 5), d: 1.1, ry, seed });
  }));
}

(function city() {
  const cell = SMALL ? 16 : 13;
  for (let x = -290; x <= 290; x += cell) {
    for (let z = -330; z <= 350; z += cell) {
      const jx = x + R(-1.5, 1.5), jz = z + R(-1.5, 1.5);
      if (Math.abs(jx) < AVENUE && jz > PLAZA.z1 - 10) continue;
      if (jz > TRENCH_N - 14 && jz < QUAY_S) continue;
      if (Math.hypot(jx - MARKET.x, jz - MARKET.z) < MARKET.r) continue;
      if (jx > PLAZA.x0 && jx < PLAZA.x1 && jz > PLAZA.z0 && jz < PLAZA.z1) continue;
      if (Math.hypot(jx - WEIGH_TOWER.x, jz - WEIGH_TOWER.z) < 14) continue;
      if (rnd() < 0.07) continue;

      const w = R(cell * 0.62, cell * 0.92), d = R(cell * 0.62, cell * 0.92);
      const distC = Math.hypot(jx - CATH.x, jz - CATH.z);
      let h = R(10, 26) + (distC < 200 ? R(0, 12) : 0);
      const ry = R(-0.04, 0.04);
      const capped = nearConduit(jx, jz);
      const towerChance = Math.abs(jx) > 30 && !capped && jz < 250 ? (distC < 210 ? 0.16 : 0.06) : 0;

      if (rnd() < towerChance) {
        const tw = Math.min(w, d) * R(0.65, 0.85);
        h = R(42, 92);
        tower(jx, jz, tw, h, R(20, 48) * 1.1 + 2, ry);
        oldDraws += 2;
        continue;
      }
      if (capped) h = Math.min(h, 28);
      // steep gables on most; the rest under low hipped roofs
      if (rnd() < 0.6) { R(3, 7); house({ x: jx, z: jz, w, h, d, ry }, Math.min(w, d) * D(0.5, 0.85), 'gable'); oldDraws += 2; }
      else { house({ x: jx, z: jz, w, h, d, ry }, D(2, 3.6), 'hip'); oldDraws += 1; }
    }
  }
  // a ring of distant blocks and needles so the horizon is never empty
  for (let i = 0; i < (SMALL ? 120 : 240); i++) {
    const a = rnd() * Math.PI * 2, r = R(330, 720);
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9 - 40;
    if (z > 220 && Math.abs(x) < 380) continue; // keep the southern approach open for the camera
    const w = R(18, 40), d = R(18, 40);
    if (rnd() < 0.18) {
      const h = R(90, 210), tw = R(10, 18);
      tower(x, z, tw, h, R(40, 90) * 1.1, 0, true);
      oldDraws += 2;
    } else {
      house({ x, z, w, h: R(20, 64), d, ry: R(-0.3, 0.3) }, Math.min(w, d) * D(0.2, 0.4), 'far');
      oldDraws += 1;
    }
  }

  // The Weigh Tower on Assize Quay
  tower(WEIGH_TOWER.x, WEIGH_TOWER.z, 12, 74, 40, 0);
  oldDraws += 2;

  // The Underline: two inhabited walls, 18 m deep
  trench.push({ x: 0, y: -18, z: TRENCH_S + 1.5, w: 1600, h: 18, d: 3, seed: 0.31 });
  trench.push({ x: 0, y: -18, z: TRENCH_N - 1.5, w: 1600, h: 18, d: 3, seed: 0.77 });

  // The Great Span: two broken decks, piers, a fallen arch, four projector pylons
  plain.push({ x: 0, y: -2.4, z: 37.5, w: 14, h: 2.4, d: 15 });
  plain.push({ x: 0, y: -2.4, z: 2.5, w: 14, h: 2.4, d: 15 });
  plain.push({ x: 0, y: -18, z: 41, w: 10, h: 15.6, d: 3 });
  plain.push({ x: 0, y: -18, z: -1, w: 10, h: 15.6, d: 3 });
  plain.push({ x: 0, y: -9, z: 17, w: 11, h: 1.6, d: 18, rx: 0.7, c: true });
  [30.5, 9.5].forEach((z) => [-7.6, 7.6].forEach((x) => plain.push({ x, y: 0, z, w: 1.4, h: 18, d: 1.4 })));
  [37.5, 2.5].forEach((z) => [-6.8, 6.8].forEach((x) => plain.push({ x, y: 0, z, w: 0.35, h: 1.1, d: 15 })));

  // Conduit Spine piers
  conduitCurve.getSpacedPoints(28).forEach((p, i) => {
    if (i === 0) return;
    const bottom = p.z < TRENCH_S && p.z > TRENCH_N ? -18 : 0;
    plain.push({ x: p.x, y: bottom, z: p.z, w: 2.6, h: p.y - bottom - 1.2, d: 2.6 });
  });

  // The Lych arch at the plaza mouth, and the Lych House
  [-10, 10].forEach((x) => plain.push({ x, y: 0, z: -66, w: 2.6, h: 15, d: 2.6 }));
  plain.push({ x: 0, y: 15, z: -66, w: 23, h: 2.4, d: 2.8 });
  house({ x: -40, z: -78, w: 14, h: 15, d: 12 }, 8, 'gable');
  oldDraws += 2;

  // Lamps down the whole road north, and round the market
  for (let z = 330; z > PLAZA.z1; z -= 12) {
    if (z < TRENCH_S + 2 && z > TRENCH_N - 2) continue;
    [-8, 8].forEach((x) => {
      lamps.push(new THREE.Vector3(x, 5.6, z));
      plain.push({ x, y: 0, z, w: 0.22, h: 5.2, d: 0.22 });
    });
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const x = MARKET.x + Math.cos(a) * (MARKET.r - 6), z = MARKET.z + Math.sin(a) * (MARKET.r - 6);
    lamps.push(new THREE.Vector3(x, 5.6, z));
    plain.push({ x, y: 0, z, w: 0.22, h: 5.2, d: 0.22 });
  }
  for (let x = -280; x <= 280; x += 20) lamps.push(new THREE.Vector3(x, 2.5, QUAY_S - 2));
})();

/* ------------------------------------------------------------------
   The Cathedral: twin-towered west front, nave and transept under
   lead, a crossing tower and spire, a polygonal apse, and flying
   buttresses down both flanks
   ------------------------------------------------------------------ */
const FACADE_Z = -113;
const holyWalls = [], holyTrim = [], holyRoofs = [], holySpires = [], holyPinns = [], flyers = [], apse = [];
(function cathedral() {
  holyWalls.push({ x: 0, z: -118, w: 46, h: 60, d: 10 });                              // west front
  holyRoofs.push({ x: 0, y: 60, z: -116.5, w: 7, h: 18, d: 26, ry: Math.PI / 2 });     // its gable
  [-14, 14].forEach((x) => holyPinns.push({ x, y: 60, z: -114, w: 2.4, h: 16, d: 2.4 }));
  holyPinns.push({ x: 0, y: 76, z: -114.5, w: 2, h: 14, d: 2 });
  [-19, 19].forEach((x) => {
    holyWalls.push({ x, z: -118, w: 14, h: 94, d: 14 });                               // twin towers
    [-7, 7].forEach((dx) => [-7, 7].forEach((dz) => {
      holyTrim.push({ x: x + dx, z: -118 + dz, w: 3, h: 52, d: 3 });                    // buttresses, set back as they climb
      holyTrim.push({ x: x + dx, z: -118 + dz, w: 2.2, h: 88, d: 2.2 });
      holyPinns.push({ x: x + dx, y: 88, z: -118 + dz, w: 2.4, h: 16, d: 2.4 });
    }));
    [38, 74].forEach((y) => holyTrim.push({ x, y, z: -118, w: 15.6, h: 1.1, d: 15.6 }));
    holyTrim.push({ x, y: 92.5, z: -118, w: 15.4, h: 2, d: 15.4 });                     // parapet
    holySpires.push({ x, y: 94, z: -118, w: 13, h: 64, d: 13 });                         // belfry and spire
  });
  // relief on the west front: pilasters with pinnacles, string courses, the portal's jambs
  [-11, 11].forEach((x) => {
    holyTrim.push({ x, z: -113.6, w: 1.6, h: 58, d: 1.6 });
    holyPinns.push({ x, y: 58, z: -113.6, w: 1.8, h: 9, d: 1.8 });
  });
  [27, 50].forEach((y) => holyTrim.push({ x: 0, y, z: -113.4, w: 22, h: 0.9, d: 1.4 }));
  [-6.75, 6.75].forEach((x) => {
    holyTrim.push({ x, z: -112.6, w: 0.6, h: 23, d: 1.4 });
    holyPinns.push({ x, y: 23, z: -112.6, w: 0.9, h: 5, d: 0.9 });
  });

  holyWalls.push({ x: 0, z: -168, w: 34, h: 48, d: 90 });                              // nave
  holyRoofs.push({ x: 0, y: 48, z: -168, w: 92, h: 17, d: 36, ry: Math.PI / 2 });
  holyWalls.push({ x: 0, z: -175, w: 82, h: 44, d: 24 });                              // transept
  holyRoofs.push({ x: 0, y: 44, z: -175, w: 83, h: 15, d: 26 });
  [-41, 41].forEach((x) => [-12, 12].forEach((dz) => {
    holyTrim.push({ x, z: -175 + dz, w: 3, h: 46, d: 3 });
    holyPinns.push({ x, y: 46, z: -175 + dz, w: 2.4, h: 13, d: 2.4 });
  }));
  holyWalls.push({ x: 0, z: -175, w: 20, h: 84, d: 20 });                              // crossing tower
  holyTrim.push({ x: 0, y: 82.5, z: -175, w: 21.4, h: 2, d: 21.4 });
  [-10, 10].forEach((x) => [-10, 10].forEach((dz) => {
    holyTrim.push({ x, y: 50, z: -175 + dz, w: 2.2, h: 34, d: 2.2 });
    holyPinns.push({ x, y: 84, z: -175 + dz, w: 2.2, h: 14, d: 2.2 });
  }));
  holySpires.push({ x: 0, y: 84, z: -175, w: 18, h: 84, d: 18 });                       // its tip is the beam's root
  apse.push({ x: 0, z: -213, w: 36, h: 64, d: 36 });
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.15 + 0.7 * i / 4), x = Math.cos(a) * 18, z = -213 - Math.sin(a) * 18;
    holyTrim.push({ x, z, w: 3, h: 34, d: 3, ry: -a });
    holyPinns.push({ x, y: 34, z, w: 2.4, h: 11, d: 2.4, ry: -a });
  }
  // down both flanks: stepped piers, a flying buttress to the clerestory, pinnacles on the eaves
  for (let z = -130; z >= -206; z -= 10.5) {
    if (Math.abs(z + 175) < 13) continue;
    [-1, 1].forEach((s) => {
      holyTrim.push({ x: s * 31, z, w: 3.4, h: 20, d: 4.4 });
      holyTrim.push({ x: s * 31, z, w: 2.6, h: 32, d: 3.4 });
      holyPinns.push({ x: s * 31, y: 32, z, w: 2.4, h: 11, d: 2.4 });
      flyers.push({ x: 0, z, w: 1, h: 1, d: 1, ry: s < 0 ? Math.PI : 0 });
      holyPinns.push({ x: s * 17, y: 48, z, w: 1.8, h: 10, d: 1.8 });
    });
  }
  // the Lych arch's coping
  holyRoofs.push({ x: 0, y: 17.4, z: -66, w: 24, h: 3.5, d: 3.2 });
  [holyWalls, holyTrim, holyRoofs, holySpires, holyPinns, flyers, apse].forEach((l) => l.forEach((b) => (b.seed = rd())));
})();

// big occluders first; those passed `true` also go into the depth pre-pass
instanced(GEO_BLOCK, M_HOUSE, walls, true);
instanced(GEO_BLOCK, M_TOWER, towerWalls, true);
instanced(GEO_BLOCK, M_HOLY, holyWalls, true);
instanced(GEO_GABLE, M_ROOF, gables, true);
instanced(GEO_HIP, M_ROOF, hips, true);
instanced(GEO_BLOCK, M_TRIM, trims);
instanced(GEO_SPIRE_8, M_SPIRE, spires, true);
instanced(GEO_PINNACLE, M_TRIM, pinnacles);
instanced(GEO_BLOCK, M_CHIMNEY, chimneys);
instanced(GEO_DORMER, M_DORMER, dormers);
instanced(GEO_TURRET, M_TURRET, turrets);
instanced(GEO_BOX, MAT_BUILDING, trench);
instanced(GEO_BOX, MAT_PLAIN, plain);
instanced(GEO_GABLE, M_HOLY_ROOF, holyRoofs, true);
instanced(GEO_TURRET, M_APSE, apse, true);
instanced(GEO_BLOCK, M_HOLY_TRIM, holyTrim);
instanced(GEO_PINNACLE, M_HOLY_TRIM, holyPinns);
instanced(GEO_FLYER, M_HOLY_TRIM, flyers);
instanced(GEO_SPIRE_8, M_HOLY_SPIRE, holySpires, true);
for (let i = 0; i < oldDraws; i++) rnd();

/* ------------------------------------------------------------------
   Glass: rose windows, lancets, the door
   ------------------------------------------------------------------ */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const roseTex = canvasTex(512, 512, (g) => {
  g.translate(256, 256);
  const grd = g.createRadialGradient(0, 0, 8, 0, 0, 250);
  grd.addColorStop(0, '#e6fdff'); grd.addColorStop(0.25, '#62e6ff'); grd.addColorStop(0.6, '#2a7dff'); grd.addColorStop(1, '#7a3cff');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 250, 0, Math.PI * 2); g.fill();
  const pr = mulberry(55);
  for (let ring = 0; ring < 3; ring++) {
    const r0 = [40, 95, 170][ring], r1 = [95, 170, 246][ring], n = [8, 16, 24][ring];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const v = pr();
      g.fillStyle = v < 0.18 ? 'rgba(170,70,255,0.55)' : v < 0.28 ? 'rgba(255,60,110,0.4)' : 'rgba(255,255,255,' + (pr() * 0.25) + ')';
      g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.fill();
    }
  }
  g.strokeStyle = '#06040c'; g.lineCap = 'round';
  [250, 170, 95, 40].forEach((r, i) => { g.lineWidth = i === 0 ? 14 : 9; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); });
  g.lineWidth = 7;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); g.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); g.stroke();
    g.beginPath(); g.arc(Math.cos(a + 0.2) * 132, Math.sin(a + 0.2) * 132, 22, 0, Math.PI * 2); g.stroke();
  }
});
const lancetTex = canvasTex(64, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#d9fbff'); grd.addColorStop(0.35, '#4fd9ff'); grd.addColorStop(1, '#2440c8');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const pr = mulberry(9);
  for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 21) {
    const v = pr();
    g.fillStyle = v < 0.15 ? 'rgba(170,70,255,0.6)' : v < 0.22 ? 'rgba(255,70,120,0.45)' : 'rgba(0,0,30,' + (pr() * 0.35) + ')';
    g.fillRect(x, y, 21, 16);
  }
  g.fillStyle = '#05040a';
  g.fillRect(w / 2 - 2, 0, 4, h);
  for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 3);
});

function lancetShape(w, h) {
  const s = new THREE.Shape(), r = w / 2, y0 = h - w * 0.866;
  s.moveTo(-r, 0); s.lineTo(-r, y0);
  s.absarc(r, y0, w, Math.PI, (2 * Math.PI) / 3, true);
  s.absarc(-r, y0, w, Math.PI / 3, 0, true);
  s.lineTo(r, 0); s.lineTo(-r, 0);
  return s;
}
function normalizedShapeGeo(shape) {
  const g = new THREE.ShapeGeometry(shape, 10);
  g.computeBoundingBox();
  const bb = g.boundingBox, uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  }
  return g;
}

const glassColor = new THREE.Color(2.0, 2.0, 2.0);
const MAT_ROSE = new THREE.MeshBasicMaterial({ map: roseTex, color: glassColor.clone(), transparent: true, alphaTest: 0.5 });
const MAT_LANCET = new THREE.MeshBasicMaterial({ map: lancetTex, color: glassColor.clone() });

const roseGeo = new THREE.CircleGeometry(1, 64);
function rose(x, y, z, r, ry) {
  const m = new THREE.Mesh(roseGeo, MAT_ROSE);
  m.position.set(x, y, z); m.scale.setScalar(r); m.rotation.y = ry || 0;
  scene.add(m);
}
rose(0, 40, FACADE_Z + 0.08, 10.5);
rose(41.08, 28, -175, 7, Math.PI / 2);
rose(-41.08, 28, -175, 7, -Math.PI / 2);

const lancetList = [];
[-8.8, 8.8].forEach((x) => lancetList.push({ x, y: 12, z: FACADE_Z + 0.08, w: 3.6, h: 18 }));
[-19, 19].forEach((x) => [-3.2, 3.2].forEach((dx) => lancetList.push({ x: x + dx, y: 48, z: -110.92, w: 3.6, h: 20 })));
for (let z = -128; z >= -206; z -= 10.5) {
  if (Math.abs(z + 175) < 13) continue;
  lancetList.push({ x: 17.06, y: 16, z: z - 5.2, w: 4.4, h: 20, ry: Math.PI / 2 });
  lancetList.push({ x: -17.06, y: 16, z: z - 5.2, w: 4.4, h: 20, ry: -Math.PI / 2 });
}
(function () {
  const geo = normalizedShapeGeo(lancetShape(1, 3.4)).translate(0, 0, 0);
  const mesh = new THREE.InstancedMesh(geo, MAT_LANCET, lancetList.length);
  lancetList.forEach((l, i) => {
    _o.position.set(l.x, l.y, l.z); _o.rotation.set(0, l.ry || 0, 0); _o.scale.set(l.w, l.h / 3.4, 1);
    _o.updateMatrix(); mesh.setMatrixAt(i, _o.matrix);
  });
  mesh.frustumCulled = false;
  scene.add(mesh);
})();

// The door: a crimson seam round a black arch
const doorGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.08, 0.25) });
const door = new THREE.Mesh(new THREE.ShapeGeometry(lancetShape(12.5, 26), 12), doorGlow);
door.position.set(0, 0, FACADE_Z + 0.06); scene.add(door);
const doorIn = new THREE.Mesh(new THREE.ShapeGeometry(lancetShape(11, 24.6), 12), new THREE.MeshBasicMaterial({ color: 0x030104 }));
doorIn.position.set(0, 0, FACADE_Z + 0.12); scene.add(doorIn);

/* ------------------------------------------------------------------
   The epicentre beam, and the glow on the crown
   ------------------------------------------------------------------ */
const beamMat = shader({
  fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uI: { value: 1 } },
  vertex: /* glsl */ `
    varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vY = uv.y;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragment: /* glsl */ `
    uniform float uTime, uI, uVeil, uBoss;
    varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){
      float f = abs(dot(normalize(vN), normalize(vV)));
      float core = pow(f, 3.0);
      float fade = smoothstep(0.0, 0.05, vY) * (1.0 - smoothstep(0.25, 1.0, vY));
      float flick = 0.85 + 0.15 * sin(uTime * 7.0 + vY * 60.0);
      vec3 c = mix(vec3(0.7, 0.16, 1.2), vec3(1.4, 0.2, 0.45), 0.25 + 0.4 * uBoss);
      c = mix(c, vec3(0.2, 1.2, 1.8), uVeil);
      gl_FragColor = vec4(c * core * fade * flick * uI * 1.6, 1.0);
    }`,
});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, 1400, 32, 1, true), beamMat);
beam.position.set(0, 168 + 700, -175);
scene.add(beam);

function glowTex(inner, outer) {
  return canvasTex(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, inner); grd.addColorStop(0.35, outer); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  });
}
const TEX_GLOW_VIOLET = glowTex('rgba(255,220,255,1)', 'rgba(150,50,255,0.35)');
const TEX_GLOW_CYAN = glowTex('rgba(230,255,255,1)', 'rgba(60,220,255,0.35)');
const TEX_GLOW_CRIMSON = glowTex('rgba(255,210,220,1)', 'rgba(230,30,80,0.35)');
function sprite(tex, scale, opacity, fog) {
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: !!fog });
  const s = new THREE.Sprite(m); s.scale.setScalar(scale); scene.add(s); return s;
}
const crownGlow = sprite(TEX_GLOW_VIOLET, 220, 0.5);
crownGlow.position.set(0, 168, -175);
const doorHalo = sprite(TEX_GLOW_CRIMSON, 60, 0.35, true);
doorHalo.position.set(0, 12, FACADE_Z + 3);

/* ------------------------------------------------------------------
   Sky
   ------------------------------------------------------------------ */
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3000, 48, 24),
  shader({
    fog: false, side: THREE.BackSide, depthWrite: false,
    uniforms: { uHorizon: { value: new THREE.Vector3(FOG_NIGHT.r, FOG_NIGHT.g, FOG_NIGHT.b) }, uMoon: { value: new THREE.Vector3(-0.42, 0.3, -0.86).normalize() } },
    vertex: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragment: /* glsl */ `
      uniform float uTime, uVeil, uFlash, uCorr, uBoss; uniform vec3 uMoon, uHorizon;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 zen = vec3(0.004, 0.006, 0.024);
        vec3 col = mix(uHorizon, zen, smoothstep(-0.02, 0.6, y));
        col = mix(col, uHorizon * 0.7, smoothstep(0.0, -0.25, y));
        vec2 cuv = d.xz / max(y + 0.18, 0.06);
        float c = fbm(cuv * 0.85 + vec2(uTime * 0.006, uTime * 0.003));
        float cl = smoothstep(0.42, 0.86, c) * smoothstep(-0.05, 0.3, y);
        float towardC = smoothstep(-0.2, 1.0, -d.z);
        vec3 cloudCol = mix(vec3(0.012, 0.01, 0.022), vec3(0.24, 0.05, 0.34), towardC * (0.3 + 0.7 * uCorr));
        cloudCol = mix(cloudCol, vec3(0.32, 0.03, 0.10), uBoss * towardC * 0.6);
        col = mix(col, cloudCol, cl * 0.9);
        vec3 sp = d * 320.0; vec3 id = floor(sp);
        float st = hash12(id.xy + id.z * 7.13);
        float tw = 0.6 + 0.4 * sin(uTime * 3.0 + st * 50.0);
        float star = step(0.9965, st) * smoothstep(0.08, 0.45, y) * (1.0 - cl) * tw;
        star *= smoothstep(0.5, 0.1, length(fract(sp) - 0.5));
        col += vec3(0.8, 0.85, 1.0) * star * 1.4;
        float md = dot(d, uMoon);
        float moon = smoothstep(0.99935, 0.9996, md);
        if (moon > 0.0) col = mix(col, vec3(1.3, 1.32, 1.45) * (0.75 + 0.35 * fbm(d.xy * 260.0)), moon);
        col += vec3(0.4, 0.45, 0.75) * (pow(max(md, 0.0), 900.0) * 0.6 + pow(max(md, 0.0), 60.0) * 0.08) * (1.0 - cl * 0.6);
        col += vec3(0.30, 0.28, 0.55) * uFlash * (0.15 + cl);
        vec3 bp = vec3(0.004, 0.02, 0.07) + vec3(0.0, 0.25, 0.45) * pow(1.0 - abs(y), 12.0) * 0.35;
        vec2 gq = abs(fract(cuv * 2.0 - 0.5) - 0.5) / max(fwidth(cuv * 2.0), vec2(1e-4));
        bp += vec3(0.05, 0.45, 0.8) * (1.0 - min(min(gq.x, gq.y), 1.0)) * smoothstep(0.02, 0.3, y) * 0.25;
        col = mix(col, bp, uVeil);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
sky.frustumCulled = false;
sky.renderOrder = 1; // after the city, so the depth test skips the sky behind every roof
scene.add(sky);

/* ------------------------------------------------------------------
   Ground: cobbles, lamp pools, corruption veins
   ------------------------------------------------------------------ */
const GROUND_VERT = /* glsl */ `
  varying vec3 vW;
  #include <fog_pars_vertex>
  void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const groundMat = shader({
  vertex: GROUND_VERT,
  fragment: /* glsl */ `
    uniform float uTime, uVeil, uCorr, uReach, uBoss; uniform vec3 uCath;
    varying vec3 vW;
    #include <fog_pars_fragment>
    ${GLSL_NOISE}
    void main(){
      vec3 col = vec3(0.016, 0.014, 0.02);
      vec2 q = vW.xz * 0.7; vec2 qf = fract(q);
      float qw = max(fwidth(q).x, fwidth(q).y);
      float cb = smoothstep(0.0, 0.1 + qw, min(min(qf.x, qf.y), min(1.0 - qf.x, 1.0 - qf.y)));
      col *= mix(0.7 + 0.3 * cb + 0.15 * hash12(floor(q)), 1.0, smoothstep(0.12, 0.45, qw));
      if (vW.z > -70.0 && vW.z < 335.0) {
        float lz = (fract(vW.z / 12.0) - 0.5) * 12.0;
        float lx = abs(vW.x) - 8.0;
        col += vec3(1.0, 0.42, 0.12) * exp(-(lz * lz + lx * lx) / 16.0) * 0.6;
        col += vec3(0.5, 0.2, 0.06) * exp(-lx * lx / 30.0) * 0.04;
      }
      float dC = length(vW.xz - uCath.xz);
      if (dC < uReach) { // the veins cost four octaves of noise, so only inside the corruption's reach
        float n = fbm(vW.xz * 0.03);
        float ridge = 1.0 - abs(n * 2.0 - 1.0);
        float rw = fwidth(ridge);
        float vein = smoothstep(0.9 - rw, 0.985 + rw, ridge) * (0.085 / (0.085 + rw * 2.0));
        float reach = smoothstep(uReach, uReach * 0.55, dC);
        float pulse = 0.55 + 0.45 * sin(uTime * 1.6 - dC * 0.07);
        col = mix(col, vec3(0.012, 0.0, 0.016), reach * 0.6);
        col += (vec3(0.6, 0.12, 1.0) * pulse * 1.3 + vec3(0.6, 0.03, 0.14) * uBoss) * vein * reach;
      }
      vec2 fg = max(fwidth(vW.xz / 8.0), vec2(1e-4));
      vec2 gq = abs(fract(vW.xz / 8.0 - 0.5) - 0.5) / fg;
      float line = (1.0 - min(min(gq.x, gq.y), 1.0)) * (1.0 - smoothstep(0.15, 0.5, max(fg.x, fg.y)));
      vec3 bp = vec3(0.004, 0.015, 0.05) + vec3(0.1, 0.7, 1.0) * line * 0.45;
      col = mix(col, bp, uVeil);
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }`,
});
function groundPlane(z0, z1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3200, Math.abs(z1 - z0)).rotateX(-Math.PI / 2), groundMat);
  m.position.set(0, 0, (z0 + z1) / 2);
  scene.add(m);
}
groundPlane(TRENCH_S, 1700);
groundPlane(-1700, TRENCH_N);

// trench floor and its transit rails
const trenchFloor = new THREE.Mesh(new THREE.PlaneGeometry(3200, TRENCH_S - TRENCH_N).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x040309 }));
trenchFloor.position.set(0, -18, (TRENCH_N + TRENCH_S) / 2); scene.add(trenchFloor);
const railMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.7, 1.0) });
[14, 26].forEach((z) => { const r = new THREE.Mesh(new THREE.BoxGeometry(3200, 0.2, 0.35), railMat); r.position.set(0, -17.8, z); scene.add(r); });
const train = sprite(TEX_GLOW_CYAN, 26, 0.9, true);
train.position.set(0, -15.5, 20);

/* ------------------------------------------------------------------
   The Great Span: crystals and the hard-light deck
   ------------------------------------------------------------------ */
const SPAN_S = 30, SPAN_N = 10, SLABS = 11;
const crystalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.7, 2.3) });
const crystals = [];
[SPAN_S + 0.5, SPAN_N - 0.5].forEach((z) => [-7.6, 7.6].forEach((x) => {
  const c = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), crystalMat);
  c.position.set(x, 21, z); c.scale.set(1, 1.6, 1); scene.add(c);
  const halo = sprite(TEX_GLOW_CYAN, 16, 0.55, true); halo.position.copy(c.position);
  crystals.push({ mesh: c, halo, base: 21, phase: rnd() * 6 });
}));
const slabMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.4, 2.0), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(13, 0.35, (SPAN_S - SPAN_N) / SLABS - 0.25), slabMat, SLABS);
slabs.frustumCulled = false;
scene.add(slabs);
const spanFront = sprite(TEX_GLOW_VIOLET, 10, 0, true); // Kishi, carried across
const beamGeo = new THREE.BufferGeometry();
beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(crystals.length * 6), 3));
const beamLines = new THREE.LineSegments(beamGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
beamLines.frustumCulled = false;
scene.add(beamLines);

/* ------------------------------------------------------------------
   The Conduit Spine
   ------------------------------------------------------------------ */
const conduitMat = shader({
  vertex: /* glsl */ `
    varying vec2 vUv; varying vec3 vN;
    #include <fog_pars_vertex>
    void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragment: /* glsl */ `
    uniform float uTime, uVeil;
    varying vec2 vUv; varying vec3 vN;
    #include <fog_pars_fragment>
    void main(){
      float t = vUv.x;
      vec3 band = mix(vec3(0.2, 1.4, 2.0), vec3(1.0, 0.25, 1.6), smoothstep(0.35, 0.95, t));
      float rings = smoothstep(0.42, 0.5, fract(t * 120.0)) - smoothstep(0.5, 0.58, fract(t * 120.0));
      rings = mix(rings, 0.12, smoothstep(0.15, 0.5, fwidth(t * 120.0)));
      float ph = fract(t * 10.0 - uTime * 0.22);
      float flow = pow(ph, 10.0) * (1.0 - smoothstep(0.95, 1.0, ph));
      float light = max(dot(normalize(vN), normalize(vec3(-0.45, 0.75, -0.5))), 0.0);
      vec3 col = vec3(0.03, 0.03, 0.045) * (0.5 + light) + band * (rings * 0.9 + flow * 2.6);
      col = mix(col, vec3(0.05, 0.6, 1.0) * (0.3 + rings + flow * 2.0), uVeil);
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }`,
});
scene.add(new THREE.Mesh(new THREE.TubeGeometry(conduitCurve, 360, 1.7, 10, false), conduitMat));

/* ------------------------------------------------------------------
   Corruption: roots that grow out from the Cathedral as it spreads
   ------------------------------------------------------------------ */
const tendrilMat = shader({
  vertex: /* glsl */ `
    attribute vec3 aCenter; attribute float aDist;
    uniform float uReach;
    varying float vT; varying float vDist;
    #include <fog_pars_vertex>
    void main(){
      vT = uv.x; vDist = aDist;
      float grow = clamp((uReach - aDist) / 26.0, 0.0, 1.0);
      float taper = mix(1.0, 0.12, uv.x);
      vec3 p = aCenter + (position - aCenter) * grow * taper;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragment: /* glsl */ `
    uniform float uTime, uBoss, uVeil;
    varying float vT; varying float vDist;
    #include <fog_pars_fragment>
    void main(){
      float ph = fract(vT * 5.0 - uTime * 0.35 + vDist * 0.01);
      float pulse = smoothstep(0.8, 0.96, ph) * (1.0 - smoothstep(0.96, 1.0, ph));
      vec3 glow = mix(vec3(0.6, 0.1, 1.1), vec3(1.2, 0.1, 0.32), 0.3 + 0.3 * sin(vT * 9.0) + 0.3 * uBoss);
      vec3 col = vec3(0.012, 0.002, 0.016) + glow * (0.05 + pulse * 1.1) * (0.6 + uBoss * 0.9);
      col = mix(col, vec3(0.08, 0.6, 1.0) * (0.25 + pulse), uVeil);
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }`,
});
(function tendrils() {
  const geos = [];
  const TUB = 56, RAD = 6;
  function add(points, radius) {
    const curve = new THREE.CatmullRomCurve3(points);
    const g = new THREE.TubeGeometry(curve, TUB, radius, RAD, false);
    const count = g.attributes.position.count;
    const centers = new Float32Array(count * 3), dists = new Float32Array(count);
    for (let i = 0; i <= TUB; i++) {
      const c = curve.getPointAt(i / TUB);
      const dist = Math.hypot(c.x - CATH.x, c.z - CATH.z);
      for (let j = 0; j <= RAD; j++) {
        const v = i * (RAD + 1) + j;
        centers[v * 3] = c.x; centers[v * 3 + 1] = c.y; centers[v * 3 + 2] = c.z;
        dists[v] = dist;
      }
    }
    g.setAttribute('aCenter', new THREE.BufferAttribute(centers, 3));
    g.setAttribute('aDist', new THREE.BufferAttribute(dists, 1));
    geos.push(g);
  }
  const n = SMALL ? 26 : 44;
  for (let i = 0; i < n; i++) {
    let a = rnd() * Math.PI * 2;
    const start = new THREE.Vector3(CATH.x + Math.cos(a) * 34, 0.3, CATH.z + Math.sin(a) * 52);
    const pts = [start.clone().setY(R(4, 14))];
    const steps = 6 + Math.floor(rnd() * 7);
    const p = start.clone();
    for (let k = 0; k < steps; k++) {
      a += R(-0.5, 0.5);
      const len = R(14, 40);
      p.x += Math.cos(a) * len; p.z += Math.sin(a) * len;
      pts.push(new THREE.Vector3(p.x, rnd() < 0.3 ? R(1.5, 5) : R(0.2, 0.8), p.z));
    }
    add(pts, R(0.3, 0.95));
  }
  // roots climbing the west front
  for (let i = 0; i < 9; i++) {
    const x0 = R(-22, 22), pts = [];
    for (let k = 0; k < 6; k++) pts.push(new THREE.Vector3(x0 + R(-5, 5), k * R(5, 9), FACADE_Z + 0.6 + R(0, 1.2)));
    add(pts, R(0.25, 0.7));
  }
  const merged = mergeGeometries(geos);
  const mesh = new THREE.Mesh(merged, tendrilMat);
  mesh.frustumCulled = false;
  scene.add(mesh);
})();

/* ------------------------------------------------------------------
   The wound: Jaw's black portal, opened by the boss chapter
   ------------------------------------------------------------------ */
const wound = new THREE.Group();
wound.position.set(0, 13, -100);
scene.add(wound);
const woundMat = shader({
  fog: false, transparent: true, depthWrite: false,
  uniforms: { uOpen: { value: 0 } },
  vertex: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragment: /* glsl */ `
    uniform float uTime, uOpen, uBoss;
    varying vec2 vUv;
    ${GLSL_NOISE}
    void main(){
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p), a = atan(p.y, p.x);
      float sw = fbm(vec2(a * 2.0 + r * 7.0 - uTime * 1.4, r * 3.0 - uTime * 0.6));
      float rim = smoothstep(0.72, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
      vec3 c = vec3(0.6, 0.08, 1.1) * pow(sw, 3.0) * 1.6 * r + vec3(1.6, 0.15, 0.4) * rim * 1.5;
      float alpha = (1.0 - smoothstep(0.96, 1.0, r)) * uOpen;
      gl_FragColor = vec4(c, alpha);
    }`,
});
wound.add(new THREE.Mesh(new THREE.CircleGeometry(7, 64), woundMat));
(function shards() {
  const n = 26;
  const geo = new THREE.ConeGeometry(0.55, 1, 4);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.07, 0.05, 0.07) }), n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = R(1.6, 3.4);
    _o.position.set(Math.cos(a) * (7.2 - len * 0.35), Math.sin(a) * (7.2 - len * 0.35), 0.1);
    _o.rotation.set(0, 0, a + Math.PI / 2);
    _o.scale.set(1, len, 1);
    _o.updateMatrix(); mesh.setMatrixAt(i, _o.matrix);
  }
  wound.add(mesh);
})();
const woundHalo = sprite(TEX_GLOW_CRIMSON, 46, 0, false);
woundHalo.position.set(0, 13, -101);

/* ------------------------------------------------------------------
   Lamps, embers, mist
   ------------------------------------------------------------------ */
const POINT_VERT = /* glsl */ `
  attribute float aSeed; attribute float aSize;
  uniform float uScale, uTime;
  varying float vSeed; varying float vFade;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aSize * uScale / -mv.z;
    gl_PointSize = clamp(size, 2.0, 64.0);
    vSeed = aSeed; vFade = exp(-(-mv.z) * 0.0042) * clamp(size / 2.0, 0.0, 1.0);
  }`;
const lampMat = shader({
  fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertex: POINT_VERT,
  fragment: /* glsl */ `
    uniform float uTime, uVeil;
    varying float vSeed; varying float vFade;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float core = smoothstep(0.5, 0.0, d); core *= core;
      vec3 c = mix(vec3(2.6, 1.15, 0.35), vec3(0.4, 1.8, 2.4), uVeil);
      float fl = 0.85 + 0.15 * sin(uTime * 9.0 + vSeed * 30.0);
      gl_FragColor = vec4(c * fl * vFade, core);
    }`,
});
(function () {
  const g = new THREE.BufferGeometry().setFromPoints(lamps);
  const seeds = new Float32Array(lamps.length).map(() => rnd());
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(lamps.length).fill(2.6), 1));
  const pts = new THREE.Points(g, lampMat); pts.frustumCulled = false; scene.add(pts);
})();

const EMBERS = SMALL ? 500 : 1300;
const emberMat = shader({
  fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uCam: { value: new THREE.Vector3() } },
  vertex: /* glsl */ `
    attribute vec3 aVel; attribute float aSeed;
    uniform float uTime, uScale; uniform vec3 uCam;
    varying float vA; varying float vSeed;
    void main(){
      vec3 B = vec3(240.0, 120.0, 240.0);
      vec3 p = position + aVel * uTime;
      p.x += sin(uTime * 0.6 + aSeed * 20.0) * 2.0;
      vec3 rel = mod(p - uCam + B * 0.5, B) - B * 0.5;
      vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
      gl_Position = projectionMatrix * mv;
      float size = (0.16 + aSeed * 0.3) * uScale / -mv.z;
      gl_PointSize = clamp(size, 1.5, 9.0);
      vA = (0.55 + 0.45 * sin(uTime * (2.0 + aSeed * 4.0) + aSeed * 40.0)) * smoothstep(118.0, 30.0, length(rel)) * smoothstep(0.8, 6.0, -mv.z) * clamp(size / 1.5, 0.25, 1.0);
      vSeed = aSeed;
    }`,
  fragment: /* glsl */ `
    uniform float uVeil, uBoss;
    varying float vA; varying float vSeed;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      vec3 c = mix(vec3(2.2, 0.8, 0.22), vec3(1.2, 0.35, 2.2), step(0.62 - uBoss * 0.3, vSeed));
      c = mix(c, vec3(0.35, 1.5, 2.2), uVeil);
      gl_FragColor = vec4(c, a * vA);
    }`,
});
(function () {
  const pos = new Float32Array(EMBERS * 3), vel = new Float32Array(EMBERS * 3), seed = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) {
    pos[i * 3] = R(-120, 120); pos[i * 3 + 1] = R(-60, 60); pos[i * 3 + 2] = R(-120, 120);
    vel[i * 3] = R(-0.6, 0.6); vel[i * 3 + 1] = R(0.6, 2.2); vel[i * 3 + 2] = R(-0.6, 0.6);
    seed[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pts = new THREE.Points(g, emberMat); pts.frustumCulled = false; scene.add(pts);
})();

const mistTex = canvasTex(128, 128, (g) => {
  const pr = mulberry(3);
  for (let i = 0; i < 14; i++) {
    const x = 64 + (pr() - 0.5) * 50, y = 64 + (pr() - 0.5) * 30, r = 20 + pr() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  }
});
// every bank of mist in one draw: camera-facing quads that drift east and wrap round
(function mist() {
  const n = SMALL ? 18 : 34;
  const pos = [], uv = [], centre = [], bank = [], idx = [];
  for (let i = 0; i < n; i++) {
    const opacity = R(0.12, 0.22), s = R(70, 150);
    const c = [R(-220, 220), R(4, 18), R(-260, 340)], b = [s * 2, s * 0.6, opacity, R(0.6, 1.6)];
    [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].forEach(([x, y]) => {
      pos.push(x, y, 0); uv.push(x + 0.5, y + 0.5); centre.push(...c); bank.push(...b);
    });
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCentre', new THREE.Float32BufferAttribute(centre, 3));
  g.setAttribute('aBank', new THREE.Float32BufferAttribute(bank, 4));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, shader({
    transparent: true, depthWrite: false,
    uniforms: { uMap: { value: mistTex }, uColor: { value: new THREE.Color(0.55, 0.45, 0.75) } },
    vertex: /* glsl */ `
      attribute vec3 aCentre; attribute vec4 aBank; // width, height, opacity, drift (m/s)
      uniform float uTime;
      varying vec2 vUv; varying float vA;
      #include <fog_pars_vertex>
      void main(){
        vec3 c = aCentre;
        c.x = mod(c.x + aBank.w * uTime + 260.0, 520.0) - 260.0;
        vec4 mvPosition = viewMatrix * vec4(c, 1.0);
        mvPosition.xy += position.xy * aBank.xy;
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv; vA = aBank.z;
        #include <fog_vertex>
      }`,
    fragment: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor;
      varying vec2 vUv; varying float vA;
      #include <fog_pars_fragment>
      void main(){
        vec4 t = texture2D(uMap, vUv);
        gl_FragColor = vec4(uColor * t.rgb, t.a * vA);
        #include <fog_fragment>
      }`,
  }));
  m.frustumCulled = false;
  scene.add(m);
})();

/* ------------------------------------------------------------------
   Camera. One keyframe per scene or stop; main.js names the one it
   wants in S.camKey and the camera flies there on an arc that lifts
   over the roofs, then idles on a slow breath and pointer parallax.
   ------------------------------------------------------------------ */
const KF = {
  hero:            { p: [0, 88, 345],      l: [0, 62, -160],   f: 46 },
  companion:       { p: [-3, 13, 214],     l: [3, 12, 150],    f: 52 },
  lantern:         { p: [2, 6, 286],       l: [0, 7, 232],     f: 56 },
  market:          { p: [12, 20, 166],     l: [-8, 4, 132],    f: 52 },
  quay:            { p: [22, 9, 57],       l: [-40, 24, 72],   f: 56 },
  underline:       { p: [-12, 5, 28],      l: [-150, -15, 19], f: 58 },
  span:            { p: [24, 14, 62],      l: [-4, -2, 18],    f: 52 },
  cinder:          { p: [0, 7, -14],       l: [0, 12, -62],    f: 56 },
  plaza:           { p: [30, 30, -52],     l: [-4, 34, -128],  f: 54 },
  cathedral:       { p: [4, 2.4, -76],     l: [-12, 36, -118], f: 60 },
  'scale-world':   { p: [3, 1.8, -36],     l: [0, 30, -118],   f: 62 },
  'scale-table':   { p: [150, 135, 95],    l: [0, 10, -60],    f: 45 },
  'scale-diorama': { p: [0, 780, 320],     l: [0, 0, -40],     f: 24 },
  maw:             { p: [-6, 8, -58],      l: [2, 20, -104],   f: 54 },
  finale:          { p: [0, 120, 330],     l: [0, 70, -160],   f: 44 },
  contact:         { p: [-4, 94, 122],     l: [12, 50, -165],  f: 50 },
};
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const cur = { p: V(KF.hero.p), l: V(KF.hero.l), f: KF.hero.f };
let camKey = 'hero', flight = null;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const TIME_SCALE = parseFloat(params.get('timescale') || '1'); // debug: slow the flights down to inspect them
const now = () => performance.now() / 1000 * TIME_SCALE;

function flyTo(key, snap) {
  const k = KF[key];
  if (!k) return;
  camKey = key;
  const to = { p: V(k.p), l: V(k.l), f: k.f };
  if (snap) { cur.p.copy(to.p); cur.l.copy(to.l); cur.f = to.f; flight = null; S.flying = false; dissolve.style.opacity = 0; return; }
  // reduced motion: no flying, a dissolve through dark instead
  if (rm()) { flight = { cut: true, to, t0: now(), dur: 0.9 }; S.flying = true; return; }
  const from = { p: cur.p.clone(), l: cur.l.clone(), f: cur.f };
  const dist = from.p.distanceTo(to.p);
  // street-level hops lift well clear of the roofs; high ones barely arc
  const low = Math.min(from.p.y, to.p.y) < 45;
  const lift = dist > 40 ? Math.min(160, dist * (low ? 0.3 : 0.1)) : 0;
  const mid = from.p.clone().lerp(to.p, 0.5);
  mid.y = Math.max(from.p.y, to.p.y) + lift;
  flight = { from, to, mid, t0: now(), dur: THREE.MathUtils.clamp(1.3 + dist / 420, 1.5, 2.7) };
  S.flying = true;
}

const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });

/* ------------------------------------------------------------------
   Loop
   ------------------------------------------------------------------ */
// ?gputime: log the GPU's own time per frame, where the browser exposes timer queries
const gpuClock = (() => {
  if (!params.has('gputime')) return null;
  const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) { console.info('gputime: this browser exposes no GPU timer'); return null; }
  const pending = [];
  let sum = 0, n = 0;
  return {
    begin() { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); pending.push(q); },
    end() {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { sum += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; n++; }
        gl.deleteQuery(q);
      }
      if (n >= 120) { console.info(`gputime: ${(sum / n).toFixed(2)} ms per frame (${camKey}, ${GPU_NAME})`); sum = n = 0; }
    },
  };
})();

const clock = new THREE.Clock();
let t = 0, nextBolt = 7, boltTimer = -1, ready = false;
let slowFrames = 0;
const tmpV = new THREE.Vector3(), right = new THREE.Vector3(), upV = new THREE.Vector3();
const fogMix = new THREE.Color();
const veilCol = new THREE.Color(0.4, 1.8, 2.4);
const crimsonDoor = new THREE.Color(1.2, 0.08, 0.25);
let veil = 0, boss = 0, withdrawnK = 0, reach = 200, span = 0, open = 0;

function updateScale() {
  U.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  updateScale();
}
addEventListener('resize', onResize);

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!rm()) t += dt;
  U.uTime.value = t;

  const snap = !!S.snap || !ready;
  if (S.camKey && (S.camKey !== camKey || S.snap)) flyTo(S.camKey, snap);
  S.snap = false;

  let flightK = 0;
  if (flight && flight.cut) {
    const u = Math.min(1, (now() - flight.t0) / flight.dur);
    if (u >= 0.5 && !flight.done) { cur.p.copy(flight.to.p); cur.l.copy(flight.to.l); cur.f = flight.to.f; flight.done = true; }
    dissolve.style.opacity = Math.min(1, u < 0.5 ? u / 0.4 : (1 - u) / 0.4).toFixed(3);
    if (u >= 1) { flight = null; S.flying = false; dissolve.style.opacity = 0; }
  } else if (flight) {
    const u = Math.min(1, (now() - flight.t0) / flight.dur);
    const e = easeInOut(u), ie = 1 - e;
    const a = flight.from.p, b = flight.mid, c = flight.to.p;
    cur.p.set(
      ie * ie * a.x + 2 * ie * e * b.x + e * e * c.x,
      ie * ie * a.y + 2 * ie * e * b.y + e * e * c.y,
      ie * ie * a.z + 2 * ie * e * b.z + e * e * c.z
    );
    cur.l.copy(flight.from.l).lerp(flight.to.l, easeInOut(Math.min(1, u * 1.12)));
    cur.f = flight.from.f + (flight.to.f - flight.from.f) * e;
    flightK = Math.sin(Math.PI * u);
    if (u >= 1) { flight = null; S.flying = false; }
  }
  bloom.strength = 0.8 + flightK * 0.4;

  // pointer parallax and a slow breath
  pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
  pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);
  camera.position.copy(cur.p);
  camera.lookAt(cur.l);
  right.setFromMatrixColumn(camera.matrix, 0); upV.setFromMatrixColumn(camera.matrix, 1);
  const sway = rm() ? 0 : 1;
  const amp = Math.min(3, 0.6 + cur.p.y * 0.02) * sway;
  const T = now();
  camera.position.addScaledVector(right, pointer.sx * amp + Math.sin(T * 0.17) * 0.9 * amp * 0.6);
  camera.position.addScaledVector(upV, -pointer.sy * amp * 0.5 + Math.sin(T * 0.29) * 0.35 * sway);
  camera.lookAt(cur.l);
  const fov = cur.f + flightK * 6;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); updateScale(); }
  sky.position.copy(camera.position);
  emberMat.uniforms.uCam.value.copy(camera.position);
  S.camPos = cur.p;

  // state from the page
  const ease = (cur, to, rate) => cur + (to - cur) * Math.min(1, dt * rate);
  veil = ease(veil, S.veil ? 1 : 0, 2.2);
  boss = ease(boss, S.boss || 0, 2.0);
  withdrawnK = ease(withdrawnK, S.withdrawn ? 1 : 0, 0.8);
  const corr = S.corr || 0.1;
  const reachTo = 60 + 125 * Math.pow(corr, 1.2) + boss * 140 - withdrawnK * 150;
  reach = snap ? reachTo : ease(reach, reachTo, 1.4);
  U.uVeil.value = veil; U.uBoss.value = boss * (1 - withdrawnK * 0.8); U.uCorr.value = corr; U.uReach.value = Math.max(40, reach);

  // lightning
  if (!rm() && !params.has('still')) {
    if (t > nextBolt) { U.uFlash.value = 1; boltTimer = 0.14; nextBolt = t + 9 + Math.random() * 14; setTimeout(() => document.dispatchEvent(new Event('ca:thunder')), 900); }
    if (boltTimer > 0) { boltTimer -= dt; if (boltTimer <= 0) U.uFlash.value = 0.8; }
    U.uFlash.value *= Math.exp(-dt * 7);
  }
  const hitK = S.hit ? Math.exp(-(performance.now() - S.hit) / 260) : 0;

  // fog and sky colour
  fogMix.copy(FOG_NIGHT).lerp(FOG_BLOOD, Math.min(1, boss * 0.7 + hitK * 0.5)).lerp(FOG_VEIL, veil);
  scene.fog.color.copy(fogMix);
  scene.background.copy(fogMix);
  sky.material.uniforms.uHorizon.value.set(fogMix.r, fogMix.g, fogMix.b);
  const high = THREE.MathUtils.smoothstep(camera.position.y, 140, 700);
  scene.fog.density = 0.0024 * (1 - veil * 0.45) * (1 + boss * 0.15) * (1 - high * 0.72);

  // glass and lamps turn cyan in the Veil
  MAT_ROSE.color.setRGB(2, 2, 2).lerp(veilCol, veil * 0.6);
  MAT_LANCET.color.copy(MAT_ROSE.color);
  doorGlow.color.copy(crimsonDoor).multiplyScalar(0.7 + boss * 1.6 + hitK * 2 + Math.sin(t * 2.4) * 0.15);
  doorHalo.material.opacity = 0.2 + boss * 0.2;
  beamMat.uniforms.uI.value = (0.65 + corr * 0.5 + boss * 0.6 + hitK) * (1 - withdrawnK * 0.5);
  crownGlow.material.opacity = 0.35 + corr * 0.25 + boss * 0.3;

  // the wound opens with the boss chapter and closes when he withdraws
  const openTo = boss > 0.15 ? Math.min(1, (boss - 0.15) / 0.5) * (1 - withdrawnK) : 0;
  open = ease(open, openTo, 2.5);
  woundMat.uniforms.uOpen.value = open;
  wound.visible = open > 0.01;
  wound.scale.setScalar(0.2 + open * 0.8 + hitK * 0.08);
  wound.rotation.z = t * 0.15;
  woundHalo.material.opacity = open * 0.22 + hitK * 0.5;

  // the light-span
  span = snap ? (S.span || 0) : ease(span, S.span || 0, 6);
  const slabLen = (SPAN_S - SPAN_N) / SLABS;
  for (let i = 0; i < SLABS; i++) {
    const local = THREE.MathUtils.clamp(span * SLABS - i, 0, 1);
    _o.position.set(0, -0.3, SPAN_S - slabLen * (i + 0.5));
    _o.rotation.set(0, 0, 0);
    _o.scale.set(Math.max(0.001, local), Math.max(0.001, local), Math.max(0.001, local));
    _o.updateMatrix(); slabs.setMatrixAt(i, _o.matrix);
  }
  slabs.instanceMatrix.needsUpdate = true;
  slabMat.opacity = 0.75 + Math.sin(t * 6) * 0.1;
  const frontZ = SPAN_S - span * (SPAN_S - SPAN_N);
  spanFront.position.set(0, 1.6 + Math.sin(t * 3) * 0.3, frontZ);
  spanFront.material.opacity = span > 0.001 && span < 0.999 ? 0.9 : 0;
  const bp = beamGeo.attributes.position.array;
  crystals.forEach((c, i) => {
    c.mesh.position.y = c.base + Math.sin(t * 1.3 + c.phase) * 0.6;
    c.mesh.rotation.y = t * 0.8 + c.phase;
    c.halo.position.copy(c.mesh.position);
    c.halo.material.opacity = 0.45 + span * 0.4;
    bp[i * 6] = c.mesh.position.x; bp[i * 6 + 1] = c.mesh.position.y; bp[i * 6 + 2] = c.mesh.position.z;
    bp[i * 6 + 3] = 0; bp[i * 6 + 4] = 0; bp[i * 6 + 5] = frontZ;
  });
  beamGeo.attributes.position.needsUpdate = true;
  beamLines.material.opacity = span > 0.001 && span < 0.999 ? 0.7 : 0;

  train.position.x = ((t * 46) % 900) - 450;

  if (gpuClock) gpuClock.begin();
  composer.render();
  if (gpuClock) gpuClock.end();

  // shed resolution if the device is struggling
  if (dt > 0.032) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
  if (slowFrames > 90 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio); composer.setPixelRatio(pixelRatio); onResize();
    slowFrames = 0;
  }

  if (!ready) {
    ready = true;
    document.body.classList.add('world-ready');
    document.body.classList.remove('no-webgl');
    document.dispatchEvent(new Event('ca:ready'));
  }
  requestAnimationFrame(tick);
}
updateScale();
// Where the browser compiles shaders in parallel, compile every program before the first frame so it
// does not stall the page. The scene renders into the composer's target, so compile for that.
if (renderer.getContext().getExtension('KHR_parallel_shader_compile')) {
  renderer.setRenderTarget(composer.readBuffer);
  const compiled = renderer.compileAsync(scene, camera);
  renderer.setRenderTarget(null);
  compiled.catch(() => {}).then(() => requestAnimationFrame(tick));
} else {
  requestAnimationFrame(tick);
}

import * as THREE from 'three';

/* =========================================================
   DATA
   Drop images into /photos and they are used everywhere
   (listed by photos.php). Otherwise placeholders are shown.
   ========================================================= */
// The journey, in order. Name your photos 01.jpg, 02.jpg … in this same order
// and each one gets the matching title and caption below.
// Photos 01–08 are her real story so far; 09–12 are the goals still ahead
// (use inspiring or symbolic pictures for those until she gets there).
const TITLES = [
  ['First Pages', 'roots', 'Where it started: a little girl and a stack of storybooks.'],
  ['Reading Aloud', 'roots', 'Always the one who volunteered to read in class.'],
  ['Choosing English', 'roots', 'Senior high, the year I knew English was my path.'],
  ['Freshman Year', 'college', 'Day one of BSEd, Major in English.'],
  ['Late-Night Readings', 'college', 'Novels, grammar and too much coffee.'],
  ['Literature Class', 'college', 'Learning to read a text, and someday to teach it.'],
  ['In Front of the Class', 'college', 'Reports and presentations: my first taste of teaching.'],
  ['Second Year, Today', 'college', 'Where I am now: still studying, still dreaming.'],
  ['Practice Teaching', 'goal', 'Next: learning the craft beside a cooperating teacher.'],
  ['Graduation Day', 'goal', 'Bachelor of Secondary Education, Major in English.'],
  ['Passing the LET', 'goal', 'The Licensure Examination for Teachers, and my name on the list.'],
  ['My Own Classroom', 'goal', 'The dream: my own room, my own learners.'],
];
const CAT_LABEL = { roots: 'Roots', college: 'College', goal: 'Goal ahead' };

// photos.php works under XAMPP; photos.json is the static copy used on Vercel.
async function loadList(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}
let LOCAL = await loadList('photos.php');
if (!LOCAL.length) LOCAL = await loadList('photos.json');
const hasLocal = Array.isArray(LOCAL) && LOCAL.length > 0;
const count = hasLocal ? LOCAL.length : TITLES.length;

// One entry per unique image. src(w, h) returns a sized URL (local files ignore the size).
const UNIQUE = Array.from({ length: count }, (_, i) => {
  const [title, cat, note] = TITLES[i % TITLES.length];
  const seed = `aila-journey-${i + 1}`;
  return {
    title, cat, note,
    src: (w, h) => (hasLocal ? LOCAL[i] : `https://picsum.photos/seed/${seed}/${w}/${h}`),
  };
});
const N = 28; // cards in the 3D stage (images repeat if fewer)
const STAGE = Array.from({ length: N }, (_, i) => UNIQUE[i % UNIQUE.length]);

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* =========================================================
   LIGHTBOX (with prev / next)
   ========================================================= */
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbCap = document.getElementById('lbCap');
let lbList = UNIQUE, lbIndex = 0;
function showLb() {
  const p = lbList[lbIndex];
  lbImg.src = p.src(1400, 1750);
  lbImg.alt = p.title;
  lbCap.innerHTML = `<span>${p.title} — ${CAT_LABEL[p.cat]}</span><span>${p.note}</span><span>${String(lbIndex + 1).padStart(2, '0')} / ${String(lbList.length).padStart(2, '0')}</span>`;
}
function openLightbox(photo, list = UNIQUE) {
  lbList = list;
  lbIndex = Math.max(0, list.indexOf(photo));
  showLb();
  lb.classList.add('open');
  lb.setAttribute('aria-hidden', 'false');
}
const closeLightbox = () => { lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true'); };
const stepLb = (d) => { lbIndex = (lbIndex + d + lbList.length) % lbList.length; showLb(); };
document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => stepLb(-1));
document.getElementById('lbNext').addEventListener('click', () => stepLb(1));
lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
addEventListener('keydown', (e) => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') stepLb(1);
  if (e.key === 'ArrowLeft') stepLb(-1);
});

/* =========================================================
   CUSTOM CURSOR
   ========================================================= */
const cursor = document.getElementById('cursor');
const cursorLabel = document.getElementById('cursorLabel');
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
const cpos = { x: mouse.x, y: mouse.y };
let cursorTarget = null;
addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
function setCursor(label) {
  cursor.classList.toggle('big', !!label);
  if (label) cursorLabel.textContent = label;
}
document.addEventListener('pointerover', (e) => {
  cursorTarget = e.target.closest('[data-cursor]');
  setCursor(cursorTarget?.dataset.cursor);
});

/* =========================================================
   THREE.JS STAGE
   ========================================================= */
const canvas = document.getElementById('stage');
const hero = document.querySelector('.hero');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
const world = new THREE.Group();
scene.add(world);

const PW = 1.6, PH = 2.2;
const geo = new THREE.PlaneGeometry(PW, PH, 24, 24);

const vert = /* glsl */`
  uniform float uHover, uBend, uTime, uSeed;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.x * 3.14159) * uBend;
    p.z += uHover * 0.22 * sin(uv.y * 3.14159);
    p.y += sin(uTime * 0.8 + uSeed) * 0.04;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const frag = /* glsl */`
  uniform sampler2D uTex;
  uniform float uHover, uLoaded, uOpacity, uBackDim, uFogNear, uFogFar;
  uniform vec2 uSize, uCover;
  varying vec2 vUv;
  varying float vDepth;
  float roundBox(vec2 uv, vec2 s, float r) {
    vec2 q = abs(uv - 0.5) * s - (s * 0.5 - r);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 uv = vUv;
    if (!gl_FrontFacing) uv.x = 1.0 - uv.x;
    vec2 z = (uv - 0.5) * uCover * (1.0 - uHover * 0.07) + 0.5;
    float s = 0.003 + uHover * 0.005;
    vec3 col = vec3(texture2D(uTex, z + vec2(s, 0.0)).r,
                    texture2D(uTex, z).g,
                    texture2D(uTex, z - vec2(s, 0.0)).b);
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 0.55 + 0.45 * uHover);
    col *= 0.8 + 0.25 * uHover;
    col = mix(vec3(0.07, 0.07, 0.08), col, uLoaded);
    if (!gl_FrontFacing) col *= uBackDim;

    float d = roundBox(vUv, uSize, 0.03);
    if (d > 0.0) discard;
    float edge = smoothstep(-0.025, -0.01, d) * uHover;
    col = mix(col, vec3(0.93, 0.92, 0.9), edge);

    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    col = mix(col, vec3(0.043, 0.043, 0.047), fog);
    gl_FragColor = vec4(col, uOpacity);
  }`;

const loaderEl = document.getElementById('loader');
const pctEl = document.getElementById('loadPct');
const manager = new THREE.LoadingManager();
let finished = false;
const finishLoading = () => { if (!finished) { finished = true; loaderEl.classList.add('done'); } };
manager.onProgress = (_, loaded, total) => { pctEl.textContent = Math.round((loaded / total) * 100); };
manager.onLoad = finishLoading;
setTimeout(finishLoading, 7000);
const texLoader = new THREE.TextureLoader(manager);
texLoader.setCrossOrigin('anonymous');

const meshes = STAGE.map((p, i) => {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, side: THREE.DoubleSide,
    uniforms: {
      uTex: { value: null }, uHover: { value: 0 }, uBend: { value: 0.15 }, uTime: { value: 0 },
      uSeed: { value: i * 1.7 }, uLoaded: { value: 0 }, uOpacity: { value: 0 }, uBackDim: { value: 0.4 },
      uFogNear: { value: 12 }, uFogFar: { value: 30 }, uSize: { value: new THREE.Vector2(PW, PH) },
      uCover: { value: new THREE.Vector2(1, 1) },
    },
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData = { i, photo: p, hover: 0, loaded: 0, speed: 2.6 + (i % 7) * 0.35 };
  texLoader.load(p.src(600, 820), (t) => {
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const img = t.image.width / t.image.height, card = PW / PH;
    mat.uniforms.uCover.value.set(img > card ? card / img : 1, img > card ? 1 : img / card);
    mat.uniforms.uTex.value = t;
    m.userData.loaded = 1;
  });
  m.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, -20 - Math.random() * 30);
  m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  world.add(m);
  return m;
});

const dummy = new THREE.Object3D();
function place(x, y, z, fn) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, 0, 0);
  fn(dummy);
  return { pos: dummy.position.clone(), quat: dummy.quaternion.clone() };
}
const LAYOUTS = {
  ring: { bend: 0.16, build: (i) => {
    const a = (i / N) * Math.PI * 2, r = 6.6;
    return place(Math.sin(a) * r, 0, Math.cos(a) * r, (d) => { d.rotation.y = a; });
  } },
  helix: { bend: 0.12, build: (i) => {
    const a = i * 0.55, r = 5.2, y = (i - (N - 1) / 2) * 0.36;
    return place(Math.sin(a) * r, y, Math.cos(a) * r, (d) => { d.rotation.y = a; });
  } },
  sphere: { bend: 0.22, build: (i) => {
    const y = 1 - ((i + 0.5) / N) * 2, rad = Math.sqrt(1 - y * y), phi = i * Math.PI * (3 - Math.sqrt(5)), R = 6.4;
    const p = new THREE.Vector3(Math.cos(phi) * rad, y, Math.sin(phi) * rad).multiplyScalar(R);
    return place(p.x, p.y, p.z, (d) => d.lookAt(p.clone().multiplyScalar(2)));
  } },
  wall: { bend: 0.05, build: (i) => {
    const cols = 7, c = i % cols, r = Math.floor(i / cols);
    const x = (c - (cols - 1) / 2) * 1.85, y = (1.5 - r) * 2.45;
    return place(x, y, -1 - x * x * 0.05, (d) => { d.rotation.y = -x * 0.1; });
  } },
};
let layout = 'ring';
let targets = meshes.map((_, i) => LAYOUTS.ring.build(i));

const CAMS = {
  eye:    { pos: [0, 0.6, 15],   target: [0, 0, 0],   roll: 0,     fov: 40 },
  low:    { pos: [0, -6, 11.5],  target: [0, 1.6, 0], roll: 0,     fov: 50 },
  bird:   { pos: [0, 17, 4.5],   target: [0, 0, 0],   roll: 0,     fov: 42 },
  dutch:  { pos: [7, 1.5, 12],   target: [0, 0, 0],   roll: 0.32,  fov: 38 },
  close:  { pos: [1.2, 0.3, 10], target: [0, 0, 6],   roll: -0.04, fov: 30 },
  inside: { pos: [0, 0, 0.6],    target: [0, 0, -6],  roll: 0,     fov: 72 },
};
const camState = { pos: new THREE.Vector3(0, 4, 34), target: new THREE.Vector3(), roll: 0.2, fov: 55 };
let camGoal = CAMS.eye, camName = 'eye';

const pointer = new THREE.Vector2(-9, -9);
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
let rot = 0, rotTarget = 0, wallBase = 0, drag = null, hovered = null;
const ray = new THREE.Raycaster();

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  parallax.tx = pointer.x;
  parallax.ty = pointer.y;
  if (drag) {
    const dx = e.clientX - drag.x;
    drag.moved += Math.abs(dx);
    drag.x = e.clientX;
    rotTarget += dx * 0.006;
    if (layout === 'wall') rotTarget = THREE.MathUtils.clamp(rotTarget, wallBase - 0.5, wallBase + 0.5);
  }
});
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, moved: 0 }; });
const endDrag = () => {
  if (drag && drag.moved < 6 && hovered) openLightbox(hovered.userData.photo);
  drag = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('pointerleave', () => { pointer.set(-9, -9); parallax.tx = parallax.ty = 0; drag = null; });

function bindSeg(id, attr, fn) {
  const seg = document.getElementById(id);
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    fn(b.dataset[attr]);
  });
}
bindSeg('camSeg', 'cam', (name) => { camName = name; camGoal = CAMS[name]; });
bindSeg('layoutSeg', 'layout', (name) => {
  layout = name;
  targets = meshes.map((_, i) => LAYOUTS[name].build(i));
  if (name === 'wall') { wallBase = Math.round(rotTarget / (Math.PI * 2)) * Math.PI * 2; rotTarget = wallBase; }
});

function resize() {
  const w = hero.clientWidth, h = hero.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let heroVisible = true;
new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }).observe(hero);

const tmpGoalPos = new THREE.Vector3(), tmpGoalTarget = new THREE.Vector3();

function renderStage(dt, t) {
  if (!drag && layout !== 'wall' && !reduceMotion) rotTarget += dt * 0.07;
  rot = lerp(rot, rotTarget, damp(5, dt));
  world.rotation.y = rot;
  // On tall (phone) screens lift the ring so it sits above the name, not behind it.
  world.position.y = lerp(world.position.y, camera.aspect < 0.8 && camName !== 'inside' ? 2.4 : 0, damp(3, dt));

  const back = camera.aspect < 0.8 && camName !== 'inside' ? 1.45 : 1;
  tmpGoalPos.fromArray(camGoal.pos).multiplyScalar(back);
  tmpGoalTarget.fromArray(camGoal.target);
  const k = damp(2.4, dt);
  camState.pos.lerp(tmpGoalPos, k);
  camState.target.lerp(tmpGoalTarget, k);
  camState.roll = lerp(camState.roll, camGoal.roll, k);
  camState.fov = lerp(camState.fov, camGoal.fov, k);
  parallax.x = lerp(parallax.x, parallax.tx, damp(3, dt));
  parallax.y = lerp(parallax.y, parallax.ty, damp(3, dt));

  camera.position.copy(camState.pos);
  camera.lookAt(camState.target);
  camera.translateX(parallax.x * 0.7);
  camera.translateY(parallax.y * 0.45);
  camera.lookAt(camState.target);
  camera.rotateZ(camState.roll);
  if (Math.abs(camera.fov - camState.fov) > 0.01) { camera.fov = camState.fov; camera.updateProjectionMatrix(); }

  ray.setFromCamera(pointer, camera);
  const hit = drag ? null : ray.intersectObjects(meshes, false)[0];
  hovered = hit ? hit.object : null;
  const label = drag ? 'Drag' : hovered ? 'View' : 'Drag';
  if (canvas.dataset.cursor !== label) {
    canvas.dataset.cursor = label;
    if (cursorTarget === canvas) setCursor(label);
  }

  const bend = LAYOUTS[layout].bend, inside = camName === 'inside';
  for (const m of meshes) {
    const u = m.material.uniforms, d = m.userData, goal = targets[d.i];
    const kk = damp(d.speed, dt);
    m.position.lerp(goal.pos, kk);
    m.quaternion.slerp(goal.quat, kk);
    d.hover = lerp(d.hover, m === hovered ? 1 : 0, damp(8, dt));
    u.uHover.value = d.hover;
    u.uTime.value = t;
    u.uBend.value = lerp(u.uBend.value, bend, kk);
    u.uLoaded.value = lerp(u.uLoaded.value, d.loaded, damp(3, dt));
    u.uOpacity.value = lerp(u.uOpacity.value, 1, damp(1.5, dt));
    u.uBackDim.value = lerp(u.uBackDim.value, inside ? 1 : 0.4, damp(3, dt));
    u.uFogNear.value = inside ? 6 : 12;
    m.scale.setScalar(1 + d.hover * 0.05);
  }

  renderer.render(scene, camera);
}

/* =========================================================
   ABOUT portrait
   ========================================================= */
// The "Second Year, Today" photo (08) doubles as her portrait.
document.getElementById('aboutImg').src = hasLocal ? UNIQUE[7 % UNIQUE.length].src() :'https://picsum.photos/seed/aila-portrait/900/1125';

/* =========================================================
   SELECTED PROJECTS — list with cursor-follow preview
   ========================================================= */
const projectsEl = document.getElementById('projects');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
// Six chapters of the journey: [photo index, what that stage was about]
const CHAPTERS = [[0, 'Childhood'], [3, 'Year 1'], [7, 'Year 2 · Now'], [8, 'Year 4'], [10, 'Board exam'], [11, 'The goal']];
const PROJECTS = CHAPTERS.map(([idx]) => UNIQUE[idx % UNIQUE.length]);
PROJECTS.forEach((p, i) => {
  const li = document.createElement('li');
  li.className = 'project reveal';
  li.dataset.cursor = 'Open';
  const words = p.title.split(' ');
  const last = words.pop();
  li.innerHTML = `
    <span class="p-num mono">${String(i + 1).padStart(2, '0')}</span>
    <span class="p-title">${words.length ? words.join(' ') + ' ' : ''}<em>${last}</em></span>
    <span class="p-cat mono">${CAT_LABEL[p.cat]}</span>
    <span class="p-year mono">${CHAPTERS[i][1]}</span>
    <span class="p-arrow">↗</span>
    <span class="thumb"><img loading="lazy" src="${p.src(900, 560)}" alt="${p.title}" /></span>`;
  li.addEventListener('pointerenter', () => { previewImg.src = p.src(600, 750); preview.classList.add('show'); });
  li.addEventListener('pointerleave', () => preview.classList.remove('show'));
  li.addEventListener('click', () => openLightbox(p, PROJECTS));
  projectsEl.appendChild(li);
});
const pv = { x: mouse.x, y: mouse.y, r: 0 };

/* =========================================================
   ARCHIVE — masonry contact sheet
   ========================================================= */
const masonry = document.getElementById('masonry');
const HEIGHTS = [820, 450, 760, 600, 900, 500];
UNIQUE.forEach((p, i) => {
  const el = document.createElement('figure');
  el.className = 'shot reveal';
  el.dataset.cat = p.cat;
  el.dataset.cursor = 'View';
  el.innerHTML = `<img loading="lazy" src="${p.src(700, HEIGHTS[i % HEIGHTS.length])}" alt="${p.title}" />
    <figcaption class="shot-meta mono"><b>${p.title}</b><span>${CAT_LABEL[p.cat]}</span></figcaption>`;
  el.addEventListener('click', () => {
    const visible = UNIQUE.filter((x) => !masonry.children[UNIQUE.indexOf(x)].classList.contains('hide'));
    openLightbox(p, visible);
  });
  masonry.appendChild(el);
});
document.getElementById('filters').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  document.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('active', c === b));
  [...masonry.children].forEach((c) => c.classList.toggle('hide', b.dataset.f !== 'all' && c.dataset.cat !== b.dataset.f));
});

/* =========================================================
   ANGLES — scroll-driven CSS 3D orbit
   ========================================================= */
// The climb: six steps, each with its own photo from the journey.
const ANGLES = [
  { rx: 0, ry: 0, rz: 0, label: 'The dream', img: 1 },
  { rx: -6, ry: 35, rz: 0, label: 'The books', img: 4 },
  { rx: -4, ry: 62, rz: 0, label: 'Today', img: 7 },
  { rx: -32, ry: 14, rz: 0, label: 'Practice teaching', img: 8 },
  { rx: 24, ry: -22, rz: 0, label: 'Graduation', img: 9 },
  { rx: 0, ry: -10, rz: 18, label: 'The classroom', img: 11 },
];
const stack = document.getElementById('stack');
const floor = document.createElement('div');
floor.className = 'floor';
stack.appendChild(floor);
const slabs = ANGLES.map((a, i) => {
  const s = document.createElement('div');
  s.className = 'slab';
  s.innerHTML = `<img src="${UNIQUE[a.img % UNIQUE.length].src(600, 800)}" alt="${a.label}" loading="lazy" /><span class="tag mono">0${i + 1} · ${a.label}</span>`;
  stack.appendChild(s);
  return s;
});
const anglesSec = document.getElementById('climb');
const listItems = [...document.querySelectorAll('#angleList li')];
const angleDeg = document.getElementById('angleDeg');
const meterFill = document.getElementById('meterFill');
const smooth = (x) => x * x * (3 - 2 * x);

function updateAngles() {
  const r = anglesSec.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  const p = THREE.MathUtils.clamp(-r.top / (r.height - innerHeight), 0, 1);
  const f = p * (ANGLES.length - 1);
  const i0 = Math.floor(f), i1 = Math.min(i0 + 1, ANGLES.length - 1), tt = smooth(f - i0);
  const A = ANGLES[i0], B = ANGLES[i1];
  const rx = lerp(A.rx, B.rx, tt), ry = lerp(A.ry, B.ry, tt), rz = lerp(A.rz, B.rz, tt);
  stack.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  slabs.forEach((s, i) => {
    const d = i - f;
    const z = d >= 0 ? -d * 90 : -d * 260;
    s.style.transform = `translate3d(${d * 22}px, ${d * -10}px, ${z}px)`;
    s.style.opacity = d >= 0 ? Math.max(0, 1 - d * 0.18) : Math.max(0, 1 + d * 1.8);
    s.style.filter = `brightness(${d > 0.3 ? 0.5 : 1})`;
  });
  const active = Math.round(f);
  listItems.forEach((li, i) => li.classList.toggle('active', i === active));
  angleDeg.textContent = `Step ${active + 1}`;
  meterFill.style.width = `${p * 100}%`;
}

/* =========================================================
   NAV, SMOOTH SCROLL, REVEALS, FORM
   ========================================================= */
const nav = document.querySelector('.nav');
const onScroll = () => {
  nav.classList.toggle('scrolled', scrollY > 40);
  updateAngles();
};
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', updateAngles);
onScroll();

// Lenis smooth scrolling on desktop (optional — page works without it)
let lenis = null;
if (finePointer && !reduceMotion) {
  import('https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.mjs')
    .then(({ default: Lenis }) => {
      lenis = new Lenis({ lerp: 0.1 });
      if (document.documentElement.classList.contains('intro-on')) lenis.stop();
    })
    .catch(() => { /* fall back to native scroll */ });
}
addEventListener('intro:done', () => { scrollTo(0, 0); lenis?.start(); });

// Mobile menu
const menuBtn = document.getElementById('menuBtn');
const setMenu = (open) => {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
document.querySelectorAll('#navLinks a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : el, { offset: -60 });
    else scrollTo({ top: id === '#top' ? 0 : el.getBoundingClientRect().top + scrollY - 60, behavior: 'smooth' });
  });
});

const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    io.unobserve(en.target);
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el) => {
  const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
  el.style.transitionDelay = `${(sibs.indexOf(el) % 4) * 70}ms`;
  io.observe(el);
});

document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('formNote').textContent = "Thank you! I'll get back to you soon.";
  e.target.reset();
});

/* =========================================================
   MAIN LOOP
   ========================================================= */
const clock = new THREE.Clock();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  lenis?.raf(now);

  // cursor + project preview follow
  cpos.x = lerp(cpos.x, mouse.x, damp(18, dt));
  cpos.y = lerp(cpos.y, mouse.y, damp(18, dt));
  cursor.style.transform = `translate3d(${cpos.x}px, ${cpos.y}px, 0)`;
  const vx = mouse.x - pv.x;
  pv.x = lerp(pv.x, mouse.x, damp(7, dt));
  pv.y = lerp(pv.y, mouse.y, damp(7, dt));
  pv.r = lerp(pv.r, THREE.MathUtils.clamp(vx * 0.06, -10, 10), damp(6, dt));
  preview.style.left = `${pv.x}px`;
  preview.style.top = `${pv.y}px`;
  preview.style.rotate = `${pv.r}deg`;

  // While the intro plays, skip the hero render so the intro gets the GPU.
  if (heroVisible && !document.documentElement.classList.contains('intro-on')) renderStage(dt, clock.elapsedTime);
}
requestAnimationFrame(tick);

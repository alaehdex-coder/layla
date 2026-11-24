import * as THREE from 'three';

/* =========================================================
   INTRO — gold particles morph into each fact about Aila,
   then scatter past the camera to open the page.
   ========================================================= */
window.__introStarted = true;

const root = document.documentElement;
const intro = document.getElementById('intro');

// Edit the slides here. `shape` is what the particles draw:
// a word (use \n for two lines) or 'book'.
const SLIDES = [
  { shape: 'Aila\nMahinay', italic: true, kicker: 'Introducing', line: 'Aila <em>Mahinay</em>', sub: 'A story still being written, one page at a time.' },
  { shape: '3rd', kicker: 'Year level', line: 'Third-year <em>college</em> student', sub: 'More than halfway up the climb, and still climbing.' },
  { shape: 'BSEd', kicker: 'Program', line: 'Bachelor of Secondary <em>Education</em>', sub: 'Learning the craft of teaching young minds.' },
  { shape: 'English', italic: true, kicker: 'Major', line: 'Major in <em>English</em>', sub: 'Grammar, literature, and the power of words.' },
  { shape: 'heart', long: true, kicker: 'Teacher promise', line: 'HINDI NANANAKAL NG ESTUDYANTE <em>KAPAG NASA MOOD</em>', sub: 'Strict when needed, kind always. 😉' },
  { shape: 'Okay?', italic: true, kicker: 'Just a friendly reminder', line: 'SO BE KIND, STUDENTS. <em>OKAY?</em>', sub: '— Future Ma’am Aila 😄' },
  { shape: 'book', kicker: 'The dream', line: 'Future English <em>Teacher</em>', sub: 'This is her journey to achieve it.' },
];

if (intro) start().catch((err) => { console.error(err); finish(true); });

let finished = false;
function finish(instant = false) {
  if (finished) return;
  finished = true;
  intro.classList.add('leaving');
  root.classList.add('intro-leaving');
  setTimeout(() => {
    root.classList.remove('intro-on', 'intro-leaving');
    dispatchEvent(new Event('intro:done'));
  }, instant ? 0 : 900);
  setTimeout(() => intro.remove(), instant ? 50 : 1800);
}

async function start() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const kickerEl = document.getElementById('introKicker');
  const lineEl = document.getElementById('introLine');
  const subEl = document.getElementById('introSub');
  const dotsEl = document.getElementById('introDots');
  const enterBtn = document.getElementById('introEnter');
  const hintEl = document.getElementById('introHint');

  dotsEl.innerHTML = SLIDES.map(() => '<i></i>').join('');
  const dots = [...dotsEl.children];

  /* ---------- three.js setup ---------- */
  const canvas = document.getElementById('introCanvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    renderer = null; // no WebGL: the text-only intro still works
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 12);
  const group = new THREE.Group();
  scene.add(group);

  const COUNT = innerWidth < 700 ? 3000 : 6500;
  const pos = new Float32Array(COUNT * 3);
  const target = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const tint = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    // start as a wide swirling cloud
    const r = 8 + Math.random() * 14, a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = Math.sin(a) * r - 6;
    seed[i] = Math.random() * 100;
    speed[i] = 1.6 + Math.random() * 2.4;
    tint[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));

  const uniforms = { uTime: { value: 0 }, uPixel: { value: Math.min(devicePixelRatio, 2) }, uFade: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uPixel;
      attribute float aSeed, aTint;
      varying float vTint, vTw;
      void main() {
        vTint = aTint;
        vTw = 0.65 + 0.35 * sin(uTime * 2.0 + aSeed * 6.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (1.6 + aTint * 1.9) * uPixel * (12.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uFade;
      varying float vTint, vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 gold = vec3(0.96, 0.77, 0.26);
        vec3 cream = vec3(0.96, 0.93, 0.85);
        vec3 col = mix(gold, cream, smoothstep(0.55, 1.0, vTint));
        gl_FragColor = vec4(col, a * vTw * 0.7 * uFade);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // faint background stars
  const starGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    sp[i * 3] = (Math.random() - 0.5) * 60;
    sp[i * 3 + 1] = (Math.random() - 0.5) * 40;
    sp[i * 3 + 2] = -10 - Math.random() * 30;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xecebe6, size: 0.06, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(stars);

  /* ---------- shapes ---------- */
  const viewWidth = () => 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const viewHeight = () => 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  // Load the serif before sampling text, but never wait more than 1.5s.
  await Promise.race([
    Promise.all([
      document.fonts.load('400 160px "Instrument Serif"'),
      document.fonts.load('italic 400 160px "Instrument Serif"'),
    ]).catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
  ]);

  function textPoints(text, italic) {
    const c = document.createElement('canvas');
    const W = 1200, H = 600;
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const lines = text.split('\n');
    let size = lines.length > 1 ? 230 : 330;
    g.font = `${italic ? 'italic ' : ''}400 ${size}px "Instrument Serif", Georgia, serif`;
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    if (widest > W * 0.92) { size *= (W * 0.92) / widest; g.font = `${italic ? 'italic ' : ''}400 ${size}px "Instrument Serif", Georgia, serif`; }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lh = size * 0.92;
    lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));
    const data = g.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (data[(y * W + x) * 4 + 3] > 140) pts.push([x / W - 0.5, 0.5 - y / H]);
    return { pts, aspect: W / H };
  }

  function fillTargets(pts2d, scaleX, scaleY, offY, depth = 0.35) {
    for (let i = 0; i < COUNT; i++) {
      const p = pts2d[(Math.random() * pts2d.length) | 0];
      target[i * 3] = p[0] * scaleX + (Math.random() - 0.5) * 0.04;
      target[i * 3 + 1] = p[1] * scaleY + offY + (Math.random() - 0.5) * 0.04;
      target[i * 3 + 2] = (Math.random() - 0.5) * depth * 0.5;
    }
  }

  function bookTargets(offY) {
    const s = Math.min(1, viewWidth() / 11);
    for (let i = 0; i < COUNT; i++) {
      const k = Math.random();
      let x, y, z;
      if (k < 0.82) {
        // two curved pages
        const side = Math.random() < 0.5 ? -1 : 1;
        const u = Math.random(), v = Math.random();
        const lineRow = Math.random() < 0.45;
        const vv = lineRow ? (Math.floor(v * 9) + 0.5) / 9 * 0.8 + 0.1 : v;
        x = side * (0.15 + u * 4.2);
        y = (vv - 0.5) * 3.6 + Math.sin(u * Math.PI) * 0.35 - u * 0.25;
        z = Math.sin(u * Math.PI * 0.9) * 0.9 - u * 0.4;
        if (lineRow && (u < 0.12 || u > 0.9)) { y = (v - 0.5) * 3.6; }
      } else if (k < 0.88) {
        // spine
        x = (Math.random() - 0.5) * 0.12; y = (Math.random() - 0.5) * 3.7; z = 0;
      } else {
        // the guiding light above the book
        const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 2) * 0.55;
        x = Math.cos(a) * r; y = 3.0 + Math.sin(a) * r; z = (Math.random() - 0.5) * 0.3;
      }
      target[i * 3] = x * s;
      target[i * 3 + 1] = y * s + offY;
      target[i * 3 + 2] = z * s;
    }
  }

  function heartTargets(offY) {
    const s = Math.min(0.14, viewWidth() / 80);
    for (let i = 0; i < COUNT; i++) {
      const t = Math.random() * Math.PI * 2;
      // most particles trace the outline, the rest fill it softly
      const r = Math.random() < 0.6 ? 1 - Math.random() * 0.06 : Math.sqrt(Math.random());
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      target[i * 3] = x * r * s;
      target[i * 3 + 1] = y * r * s + offY + 0.3;
      target[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
  }

  function setShape(slide) {
    const vw = viewWidth(), vh = viewHeight();
    const offY = vh * 0.13; // keep the shape above the caption
    if (slide.shape === 'book') { bookTargets(offY - 0.4); return; }
    if (slide.shape === 'heart') { heartTargets(offY); return; }
    const { pts, aspect } = textPoints(slide.shape, slide.italic);
    const w = Math.min(vw * 0.8, 8.8), h = w / aspect;
    fillTargets(pts, w, Math.min(h, vh * 0.6), offY);
  }

  /* ---------- captions ---------- */
  function splitWords(html) {
    // wrap each word (keeping <em>) in a span so they rise one after another
    let i = 0;
    return html.replace(/(<em>)?([^\s<]+)(<\/em>)?/g, (m, open, word, close) =>
      `<span class="w" style="--i:${i++}">${open ? '<em>' : ''}${word}${close ? '</em>' : ''}</span>`);
  }
  function setCaption(s, idx) {
    for (const el of [kickerEl, lineEl, subEl]) { el.classList.remove('in'); void el.offsetWidth; }
    kickerEl.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(SLIDES.length).padStart(2, '0')} — ${s.kicker}`;
    lineEl.innerHTML = splitWords(s.line);
    lineEl.classList.toggle('long', !!s.long);
    subEl.textContent = s.sub;
    for (const el of [kickerEl, lineEl, subEl]) el.classList.add('in');
    dots.forEach((d, i) => { d.classList.toggle('on', i === idx); d.classList.toggle('done', i < idx); });
    const last = idx === SLIDES.length - 1;
    intro.classList.toggle('is-last', last);
    hintEl.textContent = last ? 'Press Enter to open' : 'Click or press → to continue';
  }

  /* ---------- flow ---------- */
  let idx = -1, timer = 0;
  const HOLD = reduceMotion ? 2600 : 3400;
  function go(n) {
    if (finished || n >= SLIDES.length) return;
    idx = n;
    setShape(SLIDES[idx]);
    setCaption(SLIDES[idx], idx);
    clearTimeout(timer);
    if (idx < SLIDES.length - 1) timer = setTimeout(() => go(idx + 1), HOLD);
  }
  function next() { if (idx < SLIDES.length - 1) go(idx + 1); else leave(); }

  let exploding = false;
  function leave() {
    if (finished || exploding) return;
    exploding = true;
    clearTimeout(timer);
    // send every particle flying past the camera
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 10;
      target[i * 3] = Math.cos(a) * r;
      target[i * 3 + 1] = Math.sin(a) * r;
      target[i * 3 + 2] = 14 + Math.random() * 10;
      speed[i] *= 1.3;
    }
    setTimeout(() => finish(), reduceMotion ? 100 : 700);
  }

  enterBtn.addEventListener('click', leave);
  document.getElementById('introSkip').addEventListener('click', leave);
  canvas.addEventListener('click', next);
  addEventListener('keydown', (e) => {
    if (finished) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
    if (e.key === 'Enter' && idx === SLIDES.length - 1) leave();
    if (e.key === 'Escape') leave();
  });

  /* ---------- render loop ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { pointer.tx = e.clientX / innerWidth - 0.5; pointer.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  function resize() {
    if (!renderer) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (idx >= 0) setShape(SLIDES[idx]);
  }
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  function frame() {
    if (!intro.isConnected) { renderer?.dispose(); return; }
    requestAnimationFrame(frame);
    if (!renderer) return;
    // allow big steps so slow devices still finish forming each word on time
    const dt = Math.min(clock.getDelta(), 0.25), t = clock.elapsedTime;
    uniforms.uTime.value = t;
    for (let i = 0; i < COUNT; i++) {
      const k = 1 - Math.exp(-speed[i] * dt * (reduceMotion ? 3 : 1));
      const j = i * 3, s = seed[i];
      // gentle drift keeps the shape alive
      const dx = exploding ? 0 : Math.sin(t * 0.9 + s) * 0.018;
      const dy = exploding ? 0 : Math.cos(t * 0.8 + s * 1.3) * 0.018;
      pos[j] += (target[j] + dx - pos[j]) * k;
      pos[j + 1] += (target[j + 1] + dy - pos[j + 1]) * k;
      pos[j + 2] += (target[j + 2] - pos[j + 2]) * k;
    }
    geo.attributes.position.needsUpdate = true;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    group.rotation.y = pointer.x * 0.35 + Math.sin(t * 0.3) * 0.06;
    group.rotation.x = pointer.y * 0.2;
    stars.rotation.y = t * 0.01;
    if (exploding) uniforms.uFade.value = Math.max(0, uniforms.uFade.value - dt * 1.4);
    renderer.render(scene, camera);
  }
  frame();

  intro.classList.add('ready');
  setTimeout(() => go(0), reduceMotion ? 0 : 500);
}

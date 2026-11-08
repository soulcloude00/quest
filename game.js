// Promethia Quest - original game code. three.js (MIT) bundled in assets/.
import * as THREE from './assets/three.module.min.js';

const CFG = window.PQ_CONFIG || {};
const QS = new URLSearchParams(location.search);
const TEST = QS.get('test') === '1';
const DEBUG = TEST || QS.get('debug') === '1';
const $ = s => document.querySelector(s);
const RUN_KEY = 'pq_run', ARCHIVE_KEY = 'pq_archive', QUALITY_KEY = 'pq_quality', SOUND_KEY = 'pq_sound';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => performance.now() / 1000;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
const words = s => (s || '').trim().split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).length;

/* ================= AUDIO ================= */
const Sound = {
  ctx: null, on: localStorage.getItem(SOUND_KEY) !== 'off', master: null, musicGain: null, musicTimer: null, mode: 'calm', step: 0,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 0.5 : 0; this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.16; this.musicGain.connect(this.master);
    this.startMusic();
  },
  toggle() { this.on = !this.on; localStorage.setItem(SOUND_KEY, this.on ? 'on' : 'off'); if (this.master) this.master.gain.value = this.on ? 0.5 : 0; return this.on; },
  tone(f, d = 0.12, type = 'square', v = 0.25, t0 = 0, slide = 0, dest) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + t0;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d = 0.3, v = 0.3, freq = 800, t0 = 0, q = 1) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + t0;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = v; s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  },
  sfx(name) {
    if (!this.ctx) return;
    const T = (...a) => this.tone(...a);
    switch (name) {
      case 'step': T(220 + Math.random() * 40, 0.04, 'triangle', 0.06); break;
      case 'bump': T(120, 0.08, 'square', 0.12, 0, -40); break;
      case 'collect': [660, 880, 1320].forEach((f, i) => T(f, 0.12, 'square', 0.15, i * 0.06)); break;
      case 'star': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => T(f, 0.18, 'triangle', 0.2, i * 0.07)); this.noise(0.6, 0.05, 6000, 0.1); break;
      case 'good': [523, 784].forEach((f, i) => T(f, 0.15, 'square', 0.15, i * 0.08)); break;
      case 'wrong': T(180, 0.25, 'sawtooth', 0.12, 0, -80); T(150, 0.3, 'square', 0.08, 0.1, -60); break;
      case 'crumble': this.noise(0.5, 0.35, 900); T(90, 0.3, 'square', 0.1, 0, -40); break;
      case 'splash': this.noise(0.6, 0.3, 2500); break;
      case 'gate': T(110, 0.5, 'sawtooth', 0.08, 0, 60); this.noise(0.5, 0.15, 400); [392, 523, 659].forEach((f, i) => T(f, 0.2, 'triangle', 0.15, 0.3 + i * 0.08)); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => T(f, 0.22, 'square', 0.16, i * 0.11)); T(1047, 0.6, 'triangle', 0.2, 0.45); [1319, 1568].forEach((f, i) => T(f, 0.4, 'triangle', 0.12, 0.55 + i * 0.1)); break;
      case 'push': this.noise(0.15, 0.2, 500); break;
      case 'place': T(300 + Math.random() * 200, 0.06, 'square', 0.12); this.noise(0.05, 0.1, 3000); break;
      case 'slam': this.noise(0.8, 0.6, 300); T(80, 0.6, 'sine', 0.4, 0, -50); break;
      case 'warn': T(440, 0.12, 'square', 0.08); T(440, 0.12, 'square', 0.08, 0.25); break;
      case 'hit': T(900, 0.3, 'sawtooth', 0.15, 0, -700); this.noise(0.4, 0.3, 1500); break;
      case 'hurt': T(300, 0.3, 'square', 0.15, 0, -200); break;
      case 'fire': T(200, 0.4, 'sawtooth', 0.1, 0, 600); this.noise(0.4, 0.2, 2000); break;
      case 'cheer': for (let i = 0; i < 6; i++) this.noise(0.25, 0.12, 1500 + Math.random() * 2000, i * 0.08); [784, 988, 1175].forEach((f, i) => T(f, 0.2, 'triangle', 0.12, i * 0.1)); break;
      case 'click': T(700, 0.04, 'square', 0.08); break;
      case 'boom': this.noise(1.2, 0.6, 600); T(60, 1, 'sine', 0.5, 0, -30); break;
    }
  },
  setMode(m) { this.mode = m; },
  startMusic() {
    const calm = [0, 2, 4, 7, 9, 12, 9, 7], bossS = [0, 3, 5, 7, 10, 7, 5, 3];
    const tick = () => {
      if (!this.ctx) return;
      const boss = this.mode === 'boss', root = boss ? 147 : 196, sc = boss ? bossS : calm, s = this.step++;
      const st = (n) => root * Math.pow(2, n / 12);
      const beat = boss ? 0.16 : 0.24;
      if (this.mode !== 'off') {
        if (s % 2 === 0) this.tone(st(sc[(s / 2) % 8 | 0] + (Math.floor(s / 16) % 2 ? 5 : 0)), beat * 1.6, 'triangle', 0.5, 0, 0, this.musicGain);
        if (s % 8 === 0) this.tone(st(-12 + (Math.floor(s / 16) % 2 ? 5 : 0)), beat * 6, 'sine', 0.7, 0, 0, this.musicGain);
        if (boss && s % 4 === 2) this.noise(0.05, 0.15, 4000);
        if (!boss && s % 16 === 12 && Math.random() < 0.6) this.tone(st(sc[Math.random() * 8 | 0] + 12), 0.3, 'sine', 0.25, 0, 0, this.musicGain);
      }
      this.musicTimer = setTimeout(tick, beat * 1000);
    };
    tick();
  }
};

/* ================= RENDERER ================= */
const canvas = $('#c');
let quality = localStorage.getItem(QUALITY_KEY) || (((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4 || Math.min(screen.width, screen.height) < 500) ? 'low' : 'high');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'default' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const SKY = new THREE.Color('#8fd3ff');
scene.background = SKY; const FOG = new THREE.Fog('#cfeeff', 30, 75); scene.fog = FOG; const FOG2 = new THREE.Fog('#cfeeff', 45, 140);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
const hemi = new THREE.HemisphereLight('#dff3ff', '#6b5a3a', 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.2); sun.position.set(-8, 16, 10);
sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
function applyQuality() {
  const hi = quality === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 1.5 : 1));
  renderer.shadowMap.enabled = hi; sun.castShadow = hi;
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  $('#btnQuality').textContent = hi ? '✨' : '⚡';
  $('#btnQuality').title = hi ? 'Graphics: High (tap for Fast)' : 'Graphics: Fast (tap for High)';
  resize();
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); fitCamera();
}
addEventListener('resize', resize);

/* ================= TEXTURES ================= */
function pixTex(draw, size = 16) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function speckle(base, cols, density = 1) {
  return (g, s) => { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let i = 0; i < s * s * 0.5 * density; i++) { g.fillStyle = pick(cols); g.fillRect(Math.random() * s | 0, Math.random() * s | 0, 1, 1); } };
}
const TEX = {
  grassTop: pixTex(speckle('#5fb34a', ['#4f9e3d', '#6fc456', '#58a845', '#7ccf5f'])),
  grassSide: pixTex((g, s) => { speckle('#8a5a36', ['#7a4e2e', '#9a6a42', '#6e4428'])(g, s); g.fillStyle = '#5fb34a'; g.fillRect(0, 0, s, 4); for (let x = 0; x < s; x++) if (Math.random() < 0.5) { g.fillStyle = '#4f9e3d'; g.fillRect(x, 4, 1, 1 + (Math.random() * 2 | 0)); } }),
  dirt: pixTex(speckle('#8a5a36', ['#7a4e2e', '#9a6a42', '#6e4428'])),
  stone: pixTex(speckle('#9aa0a8', ['#8a9098', '#a8aeb6', '#7f858d'])),
  brick: pixTex((g, s) => { g.fillStyle = '#7c8594'; g.fillRect(0, 0, s, s); g.fillStyle = '#5c6474'; for (let y = 0; y < s; y += 4) { g.fillRect(0, y, s, 1); const o = (y / 4) % 2 ? 4 : 0; for (let x = o; x < s; x += 8) g.fillRect(x, y, 1, 4); } for (let i = 0; i < 40; i++) { g.fillStyle = pick(['#8a93a2', '#6f7888']); g.fillRect(Math.random() * s | 0, Math.random() * s | 0, 1, 1); } }),
  plank: pixTex((g, s) => { g.fillStyle = '#b5834c'; g.fillRect(0, 0, s, s); g.fillStyle = '#8f6236'; for (let y = 0; y < s; y += 4) g.fillRect(0, y, s, 1); for (let i = 0; i < 30; i++) { g.fillStyle = pick(['#c4935a', '#a3743f']); g.fillRect(Math.random() * s | 0, Math.random() * s | 0, 2, 1); } }),
  leaves: pixTex(speckle('#3f8f35', ['#2f7a28', '#56a845', '#347f2c', '#2a6a22'], 1.4)),
  log: pixTex((g, s) => { g.fillStyle = '#6e4a2a'; g.fillRect(0, 0, s, s); g.fillStyle = '#5a3a20'; for (let x = 1; x < s; x += 3) g.fillRect(x, 0, 1, s); }),
  crate: pixTex((g, s) => { g.fillStyle = '#c08a4a'; g.fillRect(0, 0, s, s); g.fillStyle = '#7a5228'; g.fillRect(0, 0, s, 2); g.fillRect(0, s - 2, s, 2); g.fillRect(0, 0, 2, s); g.fillRect(s - 2, 0, 2, s); for (let i = 0; i < s; i++) g.fillRect(i, i, 2, 1); }),
  plate: pixTex((g, s) => { g.fillStyle = '#d9a23a'; g.fillRect(0, 0, s, s); g.fillStyle = '#8f6a1e'; g.strokeStyle = '#8f6a1e'; g.lineWidth = 2; g.strokeRect(2, 2, s - 4, s - 4); g.fillRect(6, 6, 4, 4); }),
  pad: pixTex((g, s) => { g.fillStyle = '#2b3d6b'; g.fillRect(0, 0, s, s); g.fillStyle = '#f26b21'; g.fillRect(1, 1, s - 2, 1); g.fillRect(1, s - 2, s - 2, 1); g.fillRect(1, 1, 1, s - 2); g.fillRect(s - 2, 1, 1, s - 2); g.fillStyle = '#ffb27f'; g.fillRect(7, 7, 2, 2); }),
  dark: pixTex(speckle('#3a3550', ['#2c2840', '#48425f', '#25223a'])),
};
TEX.water = pixTex((g, s) => { g.fillStyle = '#2f8fe0'; g.fillRect(0, 0, s, s); for (let i = 0; i < 26; i++) { g.fillStyle = pick(['#4aa6f0', '#7cc4ff', '#2378c8']); g.fillRect(Math.random() * s | 0, Math.random() * s | 0, 3, 1); } });
TEX.water.wrapS = TEX.water.wrapT = THREE.RepeatWrapping;
const skyCache = {};
function skyGrad(cols) { const k = cols.join(); if (skyCache[k]) return skyCache[k]; const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); cols.forEach((col, i) => gr.addColorStop(i / (cols.length - 1), col)); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return skyCache[k] = t; }
const DAY = ['#2f7fd8', '#7cc8ff', '#d9f2ff'];
const cardCache = {};
function cardCanvas(em, label, bg = '#fff6ec') {
  const k = em + '|' + label + '|' + bg; if (cardCache[k]) return cardCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(8, 8, 240, 240, 34) : g.rect(8, 8, 240, 240); g.fill(); g.lineWidth = 10; g.strokeStyle = '#1a2a4f'; g.stroke();
  if (em === 'cocoon') { g.fillStyle = '#8a6a3a'; g.beginPath(); g.ellipse(128, 100, 34, 62, 0.2, 0, 7); g.fill(); g.strokeStyle = '#5a4020'; g.lineWidth = 5; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(98, 100 + i * 20); g.quadraticCurveTo(128, 110 + i * 20, 160, 96 + i * 20); g.stroke(); } g.fillStyle = '#3f8f35'; g.fillRect(100, 26, 70, 10); }
  else if (em === 'seed') { g.fillStyle = '#6e4a2a'; g.beginPath(); g.ellipse(128, 110, 34, 46, 0.5, 0, 7); g.fill(); g.fillStyle = '#9a6a42'; g.beginPath(); g.ellipse(118, 98, 10, 18, 0.5, 0, 7); g.fill(); g.fillStyle = '#7a5a36'; g.fillRect(40, 168, 176, 14); }
  else { g.font = '128px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1a2a4f'; g.fillText(em, 128, label ? 104 : 132); }
  if (label) { g.font = `900 ${label.length > 9 ? 30 : 40}px "Trebuchet MS",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1a2a4f'; g.fillText(label.toUpperCase(), 128, 212); }
  return cardCache[k] = c;
}
function golemRuneSprite(label, scale) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill();
  g.shadowColor = '#7fe8ff'; g.shadowBlur = 28; g.beginPath(); g.moveTo(128, 14); g.lineTo(238, 128); g.lineTo(128, 242); g.lineTo(18, 128); g.closePath();
  const gr = g.createLinearGradient(0, 14, 0, 242); gr.addColorStop(0, '#9fe6ff'); gr.addColorStop(1, '#1e6bff'); g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
  g.lineWidth = 12; g.strokeStyle = '#0a0f2a'; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.stroke();
  const t = String(label); g.font = `900 ${t.length > 3 ? 64 : 92}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#000'; g.strokeText(t, 128, 134); g.fillStyle = '#fff'; g.fillText(t, 128, 134);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthWrite: false, depthTest: false })); s.renderOrder = 10; s.scale.set(scale, scale, 1); return s; }
function cardSprite(em, label, scale = 1.1, bg) { const t = new THREE.CanvasTexture(cardCanvas(em, label, bg)); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(scale, scale, 1); return s; }
function cardImg(em, label, bg) { return `<img class="cimg" src="${cardCanvas(em, label, bg).toDataURL()}" alt="${label || ''}">`; }
const TEXdraw = { brick: (g, s) => { g.fillStyle = '#7c8594'; g.fillRect(0, 0, s, s); g.fillStyle = '#5c6474'; for (let y = 0; y < s; y += 4) { g.fillRect(0, y, s, 1); const o = (y / 4) % 2 ? 4 : 0; for (let x = o; x < s; x += 8) g.fillRect(x, y, 1, 4); } } };
TEX.cracked = pixTex((g, s) => { TEXdraw.brick(g, s); g.fillStyle = '#20242c'; let x = 3, y = 0; for (let i = 0; i < 16; i++) { g.fillRect(x, y, 1, 1); x = Math.max(1, Math.min(14, x + pick([0, 1, -1]))); y++; } x = 12; y = 2; for (let i = 0; i < 9; i++) { g.fillRect(x, y, 1, 1); x -= pick([0, 1]); y++; } g.fillStyle = '#ffd36b'; g.fillRect(7, 6, 2, 2); g.fillRect(9, 9, 1, 1); });

const M = {};
const std = (o) => new THREE.MeshLambertMaterial(o);
M.grass = [std({ map: TEX.grassSide }), std({ map: TEX.grassSide }), std({ map: TEX.grassTop }), std({ map: TEX.dirt }), std({ map: TEX.grassSide }), std({ map: TEX.grassSide })];
M.dirt = std({ map: TEX.dirt }); M.stone = std({ map: TEX.stone }); M.brick = std({ map: TEX.brick }); M.plank = std({ map: TEX.plank });
M.leaves = std({ map: TEX.leaves }); M.log = std({ map: TEX.log }); M.crate = std({ map: TEX.crate }); M.cracked = std({ map: TEX.cracked });
M.plate = std({ map: TEX.plate, emissive: '#5a3a00', emissiveIntensity: 0.4 }); M.pad = std({ map: TEX.pad }); M.dark = std({ map: TEX.dark });
M.ember = new THREE.MeshBasicMaterial({ color: '#ffb02e' }); M.emberCore = new THREE.MeshBasicMaterial({ color: '#fff1a8' });
M.gold = std({ color: '#ffd23f', emissive: '#ff9d00', emissiveIntensity: 0.6 });
M.cloud = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
M.red = new THREE.MeshBasicMaterial({ color: '#ff2d2d', transparent: true, opacity: 0.55, depthWrite: false });
M.bars = std({ color: '#5a4a3a' });
M.water = new THREE.MeshLambertMaterial({ map: TEX.water, color: '#9fd4ff', transparent: true, opacity: 0.85, emissive: '#1a5a9a', emissiveIntensity: 0.25 });
const BOX = new THREE.BoxGeometry(1, 1, 1);

function emojiTex(ch, size = 128, bg) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(4, 4, size - 8, size - 8, 22) : g.rect(4, 4, size - 8, size - 8); g.fill(); g.lineWidth = 6; g.strokeStyle = '#1a2a4f'; g.stroke(); }
  g.font = `${size * 0.66}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#1a2a4f'; g.fillText(ch, size / 2, size / 2 + size * 0.05);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sprite(ch, scale = 1, bg) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(ch, 128, bg), depthWrite: false })); s.scale.set(scale, scale, 1); return s; }

/* ================= WORLD ================= */
let world = new THREE.Group(); scene.add(world);
const decor = new THREE.Group(); scene.add(decor);
let L = null;           // current level runtime
let grid = [];          // grid[z][x] = {t, ...}
let GW = 0, GH = 0;
const wx = x => x - (GW - 1) / 2, wz = z => z - (GH - 1) / 2;
const cell = (x, z) => (grid[z] && grid[z][x]) || null;
const anims = [];       // {t, dur, fn(k), done}
function tween(dur, fn, done) { const a = { t: 0, dur, fn, done }; anims.push(a); return a; }
const ease = k => 1 - Math.pow(1 - k, 3);

function batchBlocks(list) { // list of {m, x, y, z, s}
  const groups = new Map();
  list.forEach(b => { if (!groups.has(b.m)) groups.set(b.m, []); groups.get(b.m).push(b); });
  const dummy = new THREE.Object3D();
  groups.forEach((arr, m) => {
    const im = new THREE.InstancedMesh(BOX, M[m], arr.length);
    arr.forEach((b, i) => { dummy.position.set(b.x, b.y, b.z); dummy.scale.setScalar(b.s || 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.castShadow = true; im.receiveShadow = true; world.add(im);
  });
}
function mesh(m, x, y, z, sx = 1, sy = 1, sz = 1, parent = world) {
  const o = new THREE.Mesh(BOX, typeof m === 'string' ? M[m] : m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = true; parent.add(o); return o;
}
function instBlocks(arr, m, parent) { const im = new THREE.InstancedMesh(BOX, M[m], arr.length); const d = new THREE.Object3D(); arr.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); im.castShadow = im.receiveShadow = true; parent.add(im); return im; }
function addTree(x, z, h = 3, parent = world, y0 = 0) {
  const g = new THREE.Group(); g.position.set(x, y0, z); const logs = [], lv = [];
  for (let y = 0; y < h; y++) logs.push([0, y + 0.5, 0]);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy < 2; dy++) if (!(dy === 1 && Math.abs(dx) + Math.abs(dz) === 2)) lv.push([dx, h + dy + 0.5, dz]);
  lv.push([0, h + 2.5, 0]); instBlocks(logs, 'log', g); instBlocks(lv, 'leaves', g); g.userData.sway = Math.random() * 6; parent.add(g); return g;
}
let torchFire = null, torchLight = null;
function buildDecor() {
  decor.clear();
  // clouds
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group(); const n = 3 + (Math.random() * 3 | 0);
    for (let j = 0; j < n; j++) { const c = new THREE.Mesh(BOX, M.cloud); c.scale.set(rnd(2, 4), 1, rnd(1.5, 3)); c.position.set(j * 1.8 - n, rnd(-0.3, 0.3), rnd(-0.8, 0.8)); g.add(c); }
    g.position.set(rnd(-40, 40), rnd(8, 16), rnd(-40, -5)); g.userData.v = rnd(0.2, 0.6); decor.add(g);
  }
  // distant floating islands
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); const r = rnd(1.5, 3) | 0;
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) if (x * x + z * z <= r * r + 1) { const top = new THREE.Mesh(BOX, M.grass); top.position.set(x, 0, z); g.add(top); for (let d = 1; d < r + 1 - Math.abs(x) * 0.5; d++) { const b = new THREE.Mesh(BOX, M.dirt); b.position.set(x, -d, z); g.add(b); } }
    g.position.set(rnd(-35, 35), rnd(-8, 4), rnd(-45, -20)); g.userData.bob = Math.random() * 6; decor.add(g);
  }
  // the Great Torch of Promethia on a far fort
  const fort = new THREE.Group();
  for (let x = -3; x <= 3; x++) for (let z = -2; z <= 2; z++) { const b = new THREE.Mesh(BOX, M.brick); b.position.set(x, 0, z); fort.add(b); if (Math.abs(x) === 3 || Math.abs(z) === 2) { for (let y = 1; y < 4; y++) { if (y === 3 && (x + z) % 2) continue; const w = new THREE.Mesh(BOX, M.brick); w.position.set(x, y, z); fort.add(w); } } }
  for (let y = 1; y < 7; y++) { const p = new THREE.Mesh(BOX, M.stone); p.position.set(0, y, 0); p.scale.set(0.8, 1, 0.8); fort.add(p); }
  const bowl = new THREE.Mesh(BOX, M.dark); bowl.position.set(0, 7.2, 0); bowl.scale.set(2, 0.6, 2); fort.add(bowl);
  torchFire = new THREE.Group(); torchFire.position.set(0, 8, 0); torchFire.visible = false; fort.add(torchFire);
  [['#ff7a1a', 1.6, 0], ['#ffb02e', 1.1, 0.5], ['#fff1a8', 0.6, 0.9]].forEach(([c, s, y]) => { const f = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: c })); f.scale.set(s, s * 1.3, s); f.position.y = y; torchFire.add(f); });
  torchLight = new THREE.PointLight('#ff8a2a', 0, 40); torchLight.position.set(0, 8.5, 0); fort.add(torchLight);
  fort.position.set(0, -2, -32); decor.add(fort); decor.userData.fort = fort;
}

function buildLevel(def) {
  scene.remove(world); world.traverse(o => { if (o.geometry && o.geometry !== BOX) o.geometry.dispose(); }); world = new THREE.Group(); scene.add(world);
  const map = def.map; GH = map.length; GW = map[0].length; grid = [];
  const list = [];
  for (let z = 0; z < GH; z++) {
    grid[z] = [];
    for (let x = 0; x < GW; x++) {
      const t = map[z][x] || ' '; const c = { t, x, z }; grid[z][x] = c;
      const X = wx(x), Z = wz(z);
      if (t === ' ') continue;
      const floorM = def.floor === 'stone' ? 'stone' : def.floor === 'plank' ? 'plank' : def.floor === 'dark' ? 'dark' : 'grass';
      if (t !== 'z') list.push({ m: floorM, x: X, y: -0.5, z: Z });
      list.push({ m: 'dirt', x: X, y: -1.5, z: Z });
      if (Math.random() < 0.5) list.push({ m: 'dirt', x: X, y: -2.5, z: Z });
      if (t === '#') { list.push({ m: 'brick', x: X, y: 0.5, z: Z }); if (z === 0) list.push({ m: 'brick', x: X, y: 1.5, z: Z }); }
    }
  }
  // grassy rim + trees around the island
  const trees = []; const occ = new Set(); for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) occ.add(x + ',' + z);
  for (let z = -3; z < GH + 2; z++) for (let x = -3; x < GW + 3; x++) {
    if (occ.has(x + ',' + z)) continue; const d = Math.max(-x, x - GW + 1, -z, z - GH + 1); if (d > 3 || (d === 3 && Math.random() < 0.6)) continue;
    if (z >= GH && d > 1) continue; // keep the front clear for the camera
    list.push({ m: 'grass', x: wx(x), y: -0.5, z: wz(z) }); list.push({ m: 'dirt', x: wx(x), y: -1.5, z: wz(z) });
    for (let k = 2; k < 5 - d; k++) list.push({ m: 'dirt', x: wx(x), y: -k - 0.5, z: wz(z) });
    if (z < GH - 1 && (x < -1 || x > GW) && Math.random() < 0.3) trees.push([wx(x), wz(z), 2 + (Math.random() * 2 | 0)]);
  }
  batchBlocks(list); trees.forEach(([x, z, h]) => addTree(x, z, h));
  // shadow camera bounds
  const ext = Math.max(GW, GH) / 2 + 4; Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 50 }); sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.set(0, 0, 0);
  scene.background = def.sky ? skyGrad(['#15122e', def.sky, '#6a5a8a']) : skyGrad(DAY); FOG.color.set(def.sky || '#cfeeff'); scene.fog = FOG;
}

/* special tile objects */
function addEmber(c) {
  const g = new THREE.Group(); const a = new THREE.Mesh(BOX, M.ember); a.scale.setScalar(0.38); g.add(a); const b = new THREE.Mesh(BOX, M.emberCore); b.scale.setScalar(0.2); g.add(b);
  const fl = sprite('🔥', 0.55); fl.position.y = 0.35; g.add(fl); g.position.set(wx(c.x), 0.55, wz(c.z)); world.add(g); c.obj = g; c.ember = true; g.userData.spin = 1;
}
function addStar(c) {
  const s = sprite('⭐', 0.8); s.position.set(wx(c.x), 0.7, wz(c.z)); world.add(s); c.star = s;
}
function addBush(c) { const b = mesh('leaves', wx(c.x), 0.45, wz(c.z), 0.98, 0.9, 0.98); b.material = M.leaves.clone(); b.material.transparent = true; b.material.opacity = 0.9; c.bush = b; }
function addCracked(c) { c.crackObj = mesh('cracked', wx(c.x), 0.5, wz(c.z)); }
function addGate(c) {
  const g = new THREE.Group(); g.position.set(wx(c.x), 0, wz(c.z));
  for (let i = -1; i <= 1; i++) { const b = new THREE.Mesh(BOX, M.bars); b.scale.set(0.14, 1.8, 0.14); b.position.set(i * 0.3, 0.9, 0); b.castShadow = true; g.add(b); }
  const top = new THREE.Mesh(BOX, M.bars); top.scale.set(1, 0.16, 0.2); top.position.y = 1.75; g.add(top);
  const vertical = c.x === 0 || c.x === GW - 1; if (vertical) g.rotation.y = Math.PI / 2;
  [-0.6, 0.6].forEach(o => { const p = mesh('brick', 0, 1, 0, 0.25, 2, 0.4, g); p.position.set(o, 1, 0); });
  world.add(g); c.gate = g; c.open = false;
  const arrow = sprite('⬇️', 0.7); arrow.position.set(wx(c.x), 2.6, wz(c.z)); arrow.visible = false; world.add(arrow); c.arrow = arrow;
}
function openGate(silent) {
  for (const row of grid) for (const c of row) if (c.t === 'E' && !c.open) {
    c.open = true; if (!silent) Sound.sfx('gate');
    const g = c.gate; tween(0.8, k => { g.children.forEach((b, i) => { if (i < 4) b.position.y = (i < 3 ? 0.9 : 1.75) - 1.9 * ease(k); }); });
    c.arrow.visible = true;
  }
}

/* ================= PLAYER ================= */
const HEROES = [
  { id: 'blaze', name: 'Blaze', shirt: '#f26b21', pants: '#1a2a4f', hair: '#3a2414', skin: '#e9b48a' },
  { id: 'nova', name: 'Nova', shirt: '#1a2a4f', pants: '#2c2c3a', hair: '#ffd23f', skin: '#c98f65' },
  { id: 'jade', name: 'Jade', shirt: '#2fa86b', pants: '#5a3a20', hair: '#111111', skin: '#f1c9a5' },
  { id: 'ruby', name: 'Ruby', shirt: '#d63b5a', pants: '#3a2a5a', hair: '#7a3a10', skin: '#8d5a3b' },
];
// the two avatars chosen on the form (Promethia orange / navy outfits)
const AVATARS = { boy: { id: 'boy', name: 'Boy', shirt: '#f26b21', pants: '#1a2a4f', hair: '#2a1a0e', skin: '#c98f65' }, girl: { id: 'girl', name: 'Girl', shirt: '#f26b21', pants: '#1a2a4f', hair: '#2a1a0e', skin: '#c98f65', girl: true } };
const player = { g: new THREE.Group(), x: 0, z: 0, moving: false, queue: [], face: 0, parts: {}, hero: HEROES[0], walkT: 0, jumpT: 0 };
function buildPlayer(h) {
  const P = player.g; P.clear(); player.hero = h;
  const m = c => new THREE.MeshLambertMaterial({ color: c });
  const add = (mat, x, y, z, sx, sy, sz, par = P) => { const o = new THREE.Mesh(BOX, mat); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; par.add(o); return o; };
  const legL = new THREE.Group(); legL.position.set(-0.1, 0.36, 0); P.add(legL); add(m(h.pants), 0, -0.18, 0, 0.18, 0.36, 0.2, legL);
  const legR = new THREE.Group(); legR.position.set(0.1, 0.36, 0); P.add(legR); add(m(h.pants), 0, -0.18, 0, 0.18, 0.36, 0.2, legR);
  add(m(h.shirt), 0, 0.58, 0, 0.42, 0.46, 0.24);
  add(m('#ffd23f'), 0, 0.5, 0.125, 0.42, 0.06, 0.02);
  const armL = new THREE.Group(); armL.position.set(-0.28, 0.78, 0); P.add(armL); add(m(h.shirt), 0, -0.2, 0, 0.14, 0.42, 0.18, armL); add(m(h.skin), 0, -0.44, 0, 0.13, 0.08, 0.16, armL);
  const armR = new THREE.Group(); armR.position.set(0.28, 0.78, 0); P.add(armR); add(m(h.shirt), 0, -0.2, 0, 0.14, 0.42, 0.18, armR); add(m(h.skin), 0, -0.44, 0, 0.13, 0.08, 0.16, armR);
  const head = new THREE.Group(); head.position.set(0, 1.0, 0); P.add(head);
  add(m(h.skin), 0, 0, 0, 0.4, 0.4, 0.4, head); add(m(h.hair), 0, 0.17, -0.02, 0.42, 0.1, 0.44, head); add(m(h.hair), 0, 0.05, -0.19, 0.42, 0.3, 0.06, head);
  add(m('#ffffff'), -0.09, 0.02, 0.201, 0.1, 0.08, 0.01, head); add(m('#ffffff'), 0.09, 0.02, 0.201, 0.1, 0.08, 0.01, head);
  add(m('#1a2a4f'), -0.08, 0.02, 0.206, 0.05, 0.07, 0.01, head); add(m('#1a2a4f'), 0.1, 0.02, 0.206, 0.05, 0.07, 0.01, head);
  add(m('#a5410c'), 0, -0.1, 0.201, 0.12, 0.03, 0.01, head);
  if (h.girl) { add(m(h.hair), 0, -0.12, -0.2, 0.42, 0.36, 0.08, head); add(m(h.hair), -0.205, -0.05, 0, 0.04, 0.3, 0.38, head); add(m(h.hair), 0.205, -0.05, 0, 0.04, 0.3, 0.38, head); const pt = add(m(h.hair), 0, -0.05, -0.32, 0.14, 0.38, 0.12, head); pt.rotation.x = 0.3; add(m('#f26b21'), 0, 0.16, -0.27, 0.16, 0.06, 0.06, head); add(m('#1a2a4f'), 0, 0.38, 0, 0.5, 0.12, 0.26); }
  player.parts = { legL, legR, armL, armR, head };
  scene.add(P);
}
// Promo the flame buddy (3D)
const promo3d = new THREE.Group();
{ [['#ff7a1a', 0.32, 0], ['#ffb02e', 0.22, 0.1], ['#fff1a8', 0.12, 0.17]].forEach(([c, s, y]) => { const f = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: c })); f.scale.set(s, s * 1.25, s); f.position.y = y; promo3d.add(f); });
  const e1 = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: '#1a2a4f' })); e1.scale.set(0.05, 0.07, 0.02); e1.position.set(-0.06, 0.04, 0.17); promo3d.add(e1); const e2 = e1.clone(); e2.position.x = 0.06; promo3d.add(e2); }
const promoLight = new THREE.PointLight('#ff9a3a', 1.5, 5); promo3d.add(promoLight); scene.add(promo3d);

function placePlayer(x, z) { player.x = x; player.z = z; player.g.position.set(wx(x), 0, wz(z)); player.queue = []; player.moving = false; player.g.visible = true; }
function isSolid(c) {
  if (!c) return true; const t = c.t;
  if (t === ' ' || t === '#' || t === 'x' || t === 'w') return true;
  if (t === 'E') return !c.open;
  if (c.crate) return true;
  if (L && L.def.solid && L.def.solid(c)) return true;
  return false;
}
function isTrigger(c) { return !!(c && (c.trigger || (L && L.def.trigger && L.def.trigger(c)))); }
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function tryStep(dx, dz) {
  if (player.moving || !L || L.locked) return false;
  if (L.def.onTry) L.def.onTry(dx, dz);
  const nx = player.x + dx, nz = player.z + dz, c = cell(nx, nz);
  player.face = Math.atan2(dx, dz);
  if (c && c.t === 'x') { breakCrack(c); return false; }
  if (c && c.crate) {
    const b = cell(nx + dx, nz + dz);
    if (b && !isSolid(b) && !isTrigger(b) && b.t !== 'E' && !b.star) { moveCrate(c, b); }
    else { bump(); return false; }
  } else if (isSolid(c)) { bump(); if (L.def.onBump) L.def.onBump(c); return false; }
  player.moving = true; const fx = wx(player.x), fz = wz(player.z); player.x = nx; player.z = nz;
  Sound.sfx('step'); L.rec.steps++;
  tween(0.15, k => { player.g.position.x = fx + (wx(nx) - fx) * k; player.g.position.z = fz + (wz(nz) - fz) * k; player.g.position.y = Math.sin(k * Math.PI) * 0.16; }, () => { player.moving = false; if (quality === 'high' && Math.random() < 0.5) burst(player.g.position.clone().setY(0.05), '#d8c7a0', 3, 0.5); arrive(c); });
  return true;
}
function bump() { Sound.sfx('bump'); const g = player.g; const ox = g.position.x, oz = g.position.z; const dx = Math.sin(player.face) * 0.15, dz = Math.cos(player.face) * 0.15; tween(0.16, k => { const s = Math.sin(k * Math.PI); g.position.x = ox + dx * s; g.position.z = oz + dz * s; }); player.queue = []; }
function arrive(c) {
  if (c.ember) { c.ember = false; world.remove(c.obj); burst(c.obj.position, '#ffb02e', 14); Sound.sfx('collect'); S.embers++; L.rec.embers++; hud(); if (L.onEmber) L.onEmber(); }
  if (c.star) { const p = c.star.position.clone(); world.remove(c.star); c.star = null; burst(p, '#ffd23f', 30); Sound.sfx('star'); S.stars++; L.rec.stars++; L.rec.explore++; hud(); showBanner('⭐ Secret star!', 1100); }
  if (c.bush && !c.bushSeen) { c.bushSeen = true; L.rec.explore++; burst(c.bush.position, '#56a845', 8); }
  if (c.t === 'E' && c.open) { completeLevel(); return; }
  if (L.def.onEnter) L.def.onEnter(c);
}
function breakCrack(c) {
  Sound.sfx('crumble'); burst(c.crackObj.position, '#7c8594', 20); world.remove(c.crackObj); c.t = '.'; L.rec.explore++;
  addStar(c); shake(0.15);
}
function moveCrate(c, b) {
  const o = c.crate; c.crate = null; b.crate = o; Sound.sfx('push'); const fx = o.position.x, fz = o.position.z;
  tween(0.15, k => { o.position.x = fx + (wx(b.x) - fx) * k; o.position.z = fz + (wz(b.z) - fz) * k; }, () => L.def.onCrate && L.def.onCrate());
}

/* path finding for tap-to-walk */
function findPath(tx, tz) {
  const key = (x, z) => x + ',' + z; const start = key(player.x, player.z), goal = key(tx, tz);
  const prev = new Map([[start, null]]); const q = [[player.x, player.z]];
  while (q.length) {
    const [x, z] = q.shift(); if (key(x, z) === goal) break;
    for (const [dx, dz] of Object.values(DIRS)) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz); if (prev.has(k)) continue; const c = cell(nx, nz);
      if (!c || isSolid(c)) continue; if (k !== goal && (isTrigger(c) || (c.t === 'E'))) continue;
      prev.set(k, [x, z]); q.push([nx, nz]);
    }
  }
  if (!prev.has(goal)) return null;
  const path = []; let cur = [tx, tz]; while (cur && key(cur[0], cur[1]) !== start) { path.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
  return path;
}

/* particles */
const parts = []; const PGEO = new THREE.BoxGeometry(0.12, 0.12, 0.12);
function burst(pos, color, n = 12, speed = 3) {
  const mat = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i < n; i++) { const p = new THREE.Mesh(PGEO, mat); p.position.copy(pos); p.userData = { v: new THREE.Vector3(rnd(-1, 1) * speed, rnd(1, 2.5) * speed, rnd(-1, 1) * speed), life: rnd(0.6, 1.1) }; scene.add(p); parts.push(p); }
}
function confetti(n = 60) { const cols = ['#f26b21', '#ffd23f', '#1a2a4f', '#2fa86b', '#ff4f8b', '#4fc3ff']; for (let i = 0; i < n / 6; i++) burst(new THREE.Vector3(player.g.position.x + rnd(-2, 2), 2, player.g.position.z + rnd(-2, 2)), pick(cols), 6, 2.2); }
function islandY() { let best = 0, bd = 1e9; ISL.forEach(s2 => { const d = s2.pos.distanceTo(player.g.position); if (d < bd) { bd = d; best = s2.pos.y; } }); return best; }
let shakeAmt = 0; function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

/* camera */
const camTarget = new THREE.Vector3(); let camDist = 12;
function fitCamera() {
  if (!GW) return; const asp = camera.aspect, fov = THREE.MathUtils.degToRad(camera.fov);
  const halfW = GW / 2 + 0.8, halfH = GH / 2 + 1.2 + ((L && L.def.camZ) ? 1.5 : 0);
  const dW = halfW / (Math.tan(fov / 2) * asp), dH = halfH * 1.25 / Math.tan(fov / 2);
  camDist = Math.max(dW, dH, 8) * (asp < 0.8 ? 1.0 : 1.05);
  camTarget.set(0, 0, 0.6 + (asp < 0.8 ? 0.6 : 0) + ((L && L.def.camZ) || 0));
}
let camCtl = null;
function updateCamera(dt) {
  if (camCtl) { camCtl(dt); return; }
  const dir = new THREE.Vector3(0, 0.78, 0.62).normalize();
  const want = camTarget.clone().addScaledVector(dir, camDist);
  camera.position.lerp(want, Math.min(1, dt * 4));
  if (shakeAmt > 0) { camera.position.x += rnd(-1, 1) * shakeAmt; camera.position.y += rnd(-1, 1) * shakeAmt; shakeAmt = Math.max(0, shakeAmt - dt * 1.5); }
  camera.lookAt(camTarget);
}


/* ================= AMBIENT PARTICLES ================= */
const AMB_N = 160; const ambPos = new Float32Array(AMB_N * 3), ambSpd = new Float32Array(AMB_N);
for (let i = 0; i < AMB_N; i++) { ambPos[i * 3] = rnd(-11, 11); ambPos[i * 3 + 1] = rnd(0, 7); ambPos[i * 3 + 2] = rnd(-8, 8); ambSpd[i] = rnd(0.15, 0.5); }
const ambGeo = new THREE.BufferGeometry(); ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
const ambPts = new THREE.Points(ambGeo, new THREE.PointsMaterial({ color: '#ffe2a8', size: 0.09, transparent: true, opacity: 0.85, depthWrite: false })); scene.add(ambPts);
function ambTick(dt, t) {
  const n = quality === 'high' ? AMB_N : 50; ambGeo.setDrawRange(0, n);
  for (let i = 0; i < n; i++) { ambPos[i * 3 + 1] += ambSpd[i] * dt; ambPos[i * 3] += Math.sin(t / 900 + i) * dt * 0.2; if (ambPos[i * 3 + 1] > 7) ambPos[i * 3 + 1] = 0; }
  ambGeo.attributes.position.needsUpdate = true;
}

/* ================= SPACE + EARTH ================= */
let MODE = 'space'; const FPS = { n: 0, t: -3 };
const space = new THREE.Group(); scene.add(space);
const earthTex = (() => {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#1f5fbf'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) { g.fillStyle = pick(['#2468c9', '#1a55ad', '#2a74d6']); g.fillRect(Math.random() * W | 0, Math.random() * H | 0, 4, 2); }
  const blobs = [[40, 40, 22], [70, 70, 18], [60, 95, 14], [130, 45, 26], [150, 75, 20], [140, 100, 12], [200, 50, 24], [215, 85, 16], [180, 30, 12], [100, 30, 10]];
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
    let land = 0; for (const [bx, by, r] of blobs) { const d = Math.hypot(x - bx, (y - by) * 1.3); land = Math.max(land, 1 - d / (r + Math.sin(x * 0.3 + y * 0.2) * 5)); }
    if (land > 0) { g.fillStyle = land > 0.6 ? pick(['#7a6a4a', '#5a9a3a']) : land > 0.12 ? pick(['#3f9b3a', '#5fb34a', '#4a8a30']) : '#d9c27a'; g.fillRect(x, y, 4, 4); }
    if (y < 10 || y > H - 12) { g.fillStyle = '#f2f8ff'; g.fillRect(x, y, 4, 4); }
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const cloudTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { const x = Math.random() * 256, y = 14 + Math.random() * 100; for (let j = 0; j < 4; j++) g.fillRect(x + j * 4, y + rnd(-3, 3), rnd(6, 14), 4); } const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t; })();
const earth = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 32), new THREE.MeshLambertMaterial({ map: earthTex })); space.add(earth);
const earthClouds = new THREE.Mesh(new THREE.SphereGeometry(10.25, 40, 28), new THREE.MeshLambertMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false })); space.add(earthClouds);
{ const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64); gr.addColorStop(0, '#6fc3ffaa'); gr.addColorStop(0.55, '#3f8fff55'); gr.addColorStop(1, '#3f8fff00'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(30, 30, 1); glow.position.z = -2; space.add(glow); }
{ const n = 1600, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(120, 260)); p.set([v.x, v.y, v.z], i * 3); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(p, 3)); space.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.1, sizeAttenuation: true }))); }
const SC = { pos: new THREE.Vector3(0, 2, 36), look: new THREE.Vector3(0, 0, 0), spin: 0.12 };
function spaceCam() { const far = camera.aspect < 0.8 ? 1.6 : 1; camCtl = () => { camera.position.copy(SC.pos).multiplyScalar(SC.zoom ? 1 : far); camera.lookAt(SC.look); }; }

/* ================= ISLAND MAP ================= */
const overworld = new THREE.Group(); scene.add(overworld); overworld.visible = false;
const ISL = []; let mapPortrait = null;
function setMode(m) {
  MODE = m; space.visible = m === 'space'; overworld.visible = m === 'map'; world.visible = decor.visible = m === 'level';
  ambPts.visible = m !== 'space'; marker.visible = false;
  if (m === 'space') { scene.background = new THREE.Color('#02040c'); scene.fog = null; player.g.visible = false; spaceCam(); }
  else if (m === 'map') { scene.background = skyGrad(DAY); scene.fog = FOG2; }
  else { camCtl = null; }
}
function buildOverworld() {
  const portrait = camera.aspect < 0.8; if (ISL.length && portrait === mapPortrait) return; mapPortrait = portrait;
  overworld.clear(); ISL.length = 0; const N = LEVELS.length;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1); const pos = portrait ? new THREE.Vector3(Math.sin(t * Math.PI * 3.2) * 4.5, Math.sin(i * 1.7) * 0.6, 28 - 56 * t) : new THREE.Vector3(-29 + 58 * t, Math.sin(i * 1.7) * 0.6, Math.sin(t * Math.PI * 3) * 6 - 1);
    const g = new THREE.Group(); g.position.copy(pos); overworld.add(g); const top = [], dirt = [], stone = [];
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { const d = Math.hypot(dx, dz); if (d > 1.5) continue; top.push([dx, -0.5, dz]); for (let k = 1; k < 3.6 - d; k++) (k > 2 ? stone : dirt).push([dx * (1 - k * 0.1), -0.5 - k, dz * (1 - k * 0.1)]); }
    instBlocks(top, 'grass', g); instBlocks(dirt, 'dirt', g); if (stone.length) instBlocks(stone, 'stone', g);
    if (i % 3 === 1) { const tr = addTree(1, -1, 2, g); tr.scale.setScalar(0.45); }
    const def = LEVELS[i]; const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex(i, 'locked'), depthWrite: false, transparent: true })); sign.scale.set(2.3, 2.3, 1); sign.position.set(0, 2.9, -0.4); g.add(sign);
    mesh('log', 0, 0.9, -0.55, 0.16, 1.8, 0.16, g);
    const fcols = ['#ff4f8b', '#ffd23f', '#4fc3ff', '#b46bff', '#ff7a1a']; for (let k = 0; k < 4; k++) { const a = i * 2.3 + k * 1.7, r = 1.0 + (k % 2) * 0.35; const fl = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: fcols[(i + k) % 5] })); fl.scale.set(0.22, 0.22, 0.22); fl.position.set(Math.cos(a) * r, 0.14, Math.sin(a) * r); g.add(fl); const st = mesh('leaves', Math.cos(a) * r, 0.02, Math.sin(a) * r, 0.08, 0.1, 0.08, g); }
    if (i % 3 !== 1) { const rk = mesh('stone', 1.3, 0.15, -0.9, 0.5, 0.3, 0.4, g); } if (i % 2 === 0) { const mu = mesh(new THREE.MeshLambertMaterial({ color: '#e53935' }), -1.2, 0.3, -1.0, 0.36, 0.14, 0.36, g); mesh(new THREE.MeshLambertMaterial({ color: '#fff6ec' }), -1.2, 0.12, -1.0, 0.12, 0.24, 0.12, g); }
    const pole = mesh('log', -1, 0.6, 0.9, 0.18, 1.2, 0.18, g); const flame = new THREE.Group(); [['#ff7a1a', 0.34, 0], ['#ffd23f', 0.2, 0.12]].forEach(([c, sz, y]) => { const f = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: c })); f.scale.set(sz, sz * 1.4, sz); f.position.y = y; flame.add(f); }); flame.position.set(-1, 1.4, 0.9); flame.visible = false; g.add(flame);
    const lock = sprite('🔒', 0.9); lock.position.set(0, 1.5, 0); lock.visible = false; g.add(lock);
    g.userData.bob = i; ISL.push({ pos, g, flame, lock, sign, bridge: null });
  }
  for (let i = 0; i < N - 1; i++) {
    const a = ISL[i].pos, b = ISL[i + 1].pos, dir = b.clone().sub(a); const len = dir.length(); const n = Math.max(1, Math.round(len - 3)); const planks = [];
    const ang = Math.atan2(dir.x, dir.z);
    for (let k = 0; k < n; k++) { const f = (1.5 + (k + 0.5) * (len - 3) / n) / len; const p = a.clone().lerp(b, f); p.y -= 0.06 + Math.sin(f * Math.PI) * 0.35;
      const pl = new THREE.Mesh(BOX, M.plank); pl.position.copy(p); pl.scale.set(1.0, 0.12, (len - 3) / n * 0.85); pl.rotation.y = ang; pl.castShadow = true; pl.visible = false; overworld.add(pl);
      const gh = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false })); gh.position.copy(pl.position); gh.scale.copy(pl.scale); gh.rotation.y = ang; overworld.add(gh); planks.push({ pl, gh }); }
    ISL[i].bridge = { planks, built: false };
  }
  for (let i = 0; i < 18; i++) { const g = new THREE.Group(); const n = 3 + (Math.random() * 3 | 0); for (let j = 0; j < n; j++) { const c = new THREE.Mesh(BOX, M.cloud); c.scale.set(rnd(2, 4), 1, rnd(1.5, 3)); c.position.set(j * 1.8 - n, 0, rnd(-0.8, 0.8)); g.add(c); } g.position.set(rnd(-40, 40), rnd(-9, -4), rnd(-30, 25)); g.userData.v = rnd(0.2, 0.6); overworld.add(g); }
}
const signCache = {};
function signTex(i, state) {
  const k = i + state; if (signCache[k]) return signCache[k]; const d = LEVELS[i];
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const col = { locked: ['#8a93a6', '#5b6478'], now: ['#f26b21', '#1a2a4f'], done: ['#2fa86b', '#1a2a4f'] }[state];
  g.fillStyle = '#0004'; g.beginPath(); g.arc(132, 136, 110, 0, 7); g.fill();
  g.fillStyle = col[0]; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.fill(); g.lineWidth = 14; g.strokeStyle = state === 'now' ? '#ffd23f' : '#fff6ec'; g.stroke();
  g.fillStyle = '#fff6ec'; g.beginPath(); g.arc(128, 150, 70, 0, 7); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 96px system-ui,sans-serif'; g.fillStyle = col[1]; g.fillText(String(i + 1), 128, 154);
  g.font = '54px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.fillText(state === 'locked' ? '🔒' : d.emoji, 128, 54);
  if (state === 'done') { g.fillStyle = '#2fa86b'; g.beginPath(); g.arc(205, 205, 40, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.stroke(); g.font = '900 52px system-ui'; g.fillStyle = '#fff'; g.fillText('✓', 205, 208); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return signCache[k] = t;
}
function setSign(i, state) { const s2 = ISL[i].sign; s2.material.map = signTex(i, state); s2.material.needsUpdate = true; s2.userData.now = state === 'now'; s2.scale.setScalar(state === 'now' ? 2.7 : 2.2); }
function setBridge(i, on) { const b = ISL[i] && ISL[i].bridge; if (!b) return; b.built = on; b.planks.forEach(p => { p.pl.visible = on; p.gh.visible = !on; }); }
const MC = { target: new THREE.Vector3(), look: new THREE.Vector3(), dist: 30, follow: true };
function mapCam() {
  const portrait = camera.aspect < 0.8; MC.dist = portrait ? 30 : 26;
  camCtl = dt => { if (MC.follow) { const center = new THREE.Vector3(0, 0, portrait ? 0 : -1); MC.target.copy(player.g.position).lerp(center, portrait ? 0.2 : 0.45); if (portrait) MC.target.z += 7; }
    const want = MC.target.clone().add(new THREE.Vector3(0, 0.82, 0.57).multiplyScalar(MC.dist)); camera.position.lerp(want, Math.min(1, dt * 2.2)); MC.look.lerp(MC.target, Math.min(1, dt * 3)); camera.lookAt(MC.look); };
}
function islandSpot(i) { return ISL[i].pos.clone().add(new THREE.Vector3(0.2, 0, 0.4)); }
let mapGoResolve = null;
async function showMap(from, to, first) {
  await fade(true);
  ['#hud', '#actions', '#dpad', '#promo', '#buildBar', '#panel'].forEach(s2 => show(s2, false));
  buildOverworld(); setMode('map'); mapCam();
  ISL.forEach((s2, i) => { s2.flame.visible = i < (from >= 0 ? from : to); s2.lock.visible = false; setSign(i, i < to ? 'done' : (i === to && !(from >= 0 && from < to)) ? 'now' : 'locked'); setBridge(i, i < to - 1 || (i < to && !(from >= 0 && from < to))); });
  const startI = from >= 0 ? from : to; player.g.visible = true; player.queue = []; player.moving = false;
  player.g.position.copy(islandSpot(startI)); player.face = 0;
  if (first) { camera.position.set(0, 140, 60); MC.look.set(0, 0, 0); player.g.position.y += 10; } else camera.position.copy(player.g.position.clone().add(new THREE.Vector3(0, 26, 20)));
  mapSkip = false; renderMapUI(to, true);
  await fade(false);
  if (first) { const y0 = player.g.position.y, y1 = islandSpot(to).y; await msleep(500); await new Promise(r => tween(0.6, k => player.g.position.y = y0 + (y1 - y0) * (k * k), r)); burst(player.g.position.clone().setY(y1 + 0.1), '#ffffff', 14, 1.5); Sound.sfx('place'); }
  if (from >= 0 && from < to) {
    const f = ISL[from].flame; f.visible = true; burst(f.getWorldPosition(new THREE.Vector3()), '#ffb02e', 18, 2); Sound.sfx('collect'); setSign(from, 'done'); await msleep(200);
    const br = ISL[from].bridge;
    for (const p of br.planks) { p.gh.visible = false; p.pl.visible = true; p.pl.scale.y = 0.01; const pl = p.pl, y0 = pl.position.y; if (mapSkip) { pl.scale.y = 0.12; continue; } tween(0.18, k => { pl.scale.y = 0.01 + 0.11 * k; pl.position.y = y0 + (1 - k) * 1.2; }); Sound.tone(500 + br.planks.indexOf(p) * 70, 0.06, 'square', 0.1); burst(pl.position, '#ffd23f', 4, 1.2); await msleep(Math.min(90, 520 / br.planks.length)); }
    br.built = true; await msleep(120);
    const pts = [islandSpot(from), ...br.planks.map(p => p.pl.position.clone().setY(p.pl.position.y + 0.06)), islandSpot(to)];
    player.moving = true;
    for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k]; player.face = Math.atan2(b.x - a.x, b.z - a.z); const d = a.distanceTo(b); if (mapSkip) continue; await new Promise(r => tween(d * 0.07, kk => { player.g.position.lerpVectors(a, b, kk); player.g.position.y += Math.sin(kk * Math.PI) * 0.1; }, r)); }
    player.moving = false; player.face = 0; player.g.position.copy(islandSpot(to)); setSign(to, 'now'); tween(0.4, k => ISL[to].sign.scale.setScalar(2.7 + Math.sin(k * Math.PI) * 0.8));
    const lk = ISL[to].lock; lk.visible = true; burst(lk.getWorldPosition(new THREE.Vector3()), '#ffd23f', 16, 2); Sound.sfx('good'); tween(0.4, k => { lk.position.y = 1.5 + k * 2; lk.material.opacity = 1 - k; }, () => { lk.visible = false; lk.position.y = 1.5; lk.material.opacity = 1; });
    player.jumpT = 0.5;
  }
  renderMapUI(to, false);
  await new Promise(r => { mapGoResolve = r; if (window.__pqAutoMap) setTimeout(() => $('#mapGo').click(), 300); });
}
let mapSkip = false;
function msleep(ms) { return new Promise(r => { if (mapSkip) return r(); const t0 = now(); const iv = setInterval(() => { if (mapSkip || now() - t0 >= ms / 1000) { clearInterval(iv); r(); } }, 16); }); }
function renderMapUI(to, busy) {
  const d = LEVELS[to]; show('#mapUI'); const mc = $('#mapUI .map-card'); mc.classList.toggle('busy', busy);
  if (busy) { mc.classList.remove('reveal'); mc.offsetHeight; mc.classList.add('reveal'); }
  $('#mapTitle').innerHTML = `<span class="mnum">${to + 1}</span><span class="mname"><small>Island ${to + 1} of ${LEVELS.length}</small>${d.emoji} ${d.name}</span>`; $('#mapSub').textContent = d.skillLabel || '';
  $('#mapDots').innerHTML = LEVELS.map((l, i) => `<i class="${i < to ? 'done' : i === to ? 'now' : ''}">${i < to ? '✓' : i + 1}</i>`).join('');
  $('#mapGo').disabled = false; $('#mapGo').textContent = busy ? 'Tap to skip ⏩' : `▶ Play island ${to + 1}!`; $('#mapGo').classList.toggle('ready', !busy);
}
$('#mapGo').onclick = () => { if (!mapGoResolve) { mapSkip = true; return; } Sound.sfx('click'); show('#mapUI', false); const r = mapGoResolve; mapGoResolve = null; r(); };
async function earthZoom() {
  setMode('space'); SC.zoom = false; const far = camera.aspect < 0.8 ? 1.6 : 1;
  const p0 = SC.pos.clone().multiplyScalar(far), l0 = SC.look.clone(); SC.zoom = true; SC.pos.copy(p0);
  show('#zoomTxt'); Sound.sfx('fire');
  await new Promise(r => tween(3.0, k => { const e = k * k * (3 - 2 * k); SC.pos.lerpVectors(p0, new THREE.Vector3(0, 7.2, 9.2), e); SC.look.lerpVectors(l0, new THREE.Vector3(0, 9.5, 2), e); SC.spin = 0.12 + Math.sin(k * Math.PI) * 0.5; }, r));
  $('#fade').classList.add('white'); await fade(true); show('#zoomTxt', false); SC.spin = 0.12;
  $('#fade').classList.remove('white');
}

/* ================= STATE + UI ================= */
const S = { band: '5-6', student: null, hero: null, startedAt: null, idx: 0, embers: 0, stars: 0, levels: [], build: null, speech: null, boss: null, promoTaps: 0 };
let promoTimer = null;
// on lab PCs (mouse) say 'click', not 'tap'
function pcWords(h) { return (typeof isTouch !== 'undefined' && isTouch) || typeof h !== 'string' ? h : h.replace(/\bTap\b/g, 'Click').replace(/\btap\b/g, 'click').replace(/\btapping\b/g, 'clicking'); }
function say(text, ms) { text = pcWords(text); const p = $('#promo'); p.classList.remove('hidden'); $('#promoText').innerHTML = text; clearTimeout(promoTimer); if (ms) promoTimer = setTimeout(() => L && L.goalText && ($('#promoText').innerHTML = L.goalText), ms); }
function hud() {
  $('#embers').textContent = S.embers; $('#stars').textContent = S.stars;
  const pr = $('#progress'); pr.innerHTML = LEVELS.map((l, i) => `<i class="${i < S.idx ? 'done' : i === S.idx ? 'now' : ''}" title="${l.name}"></i>`).join('');
}
function showBanner(t, ms = 1400) { $('#bannerText').innerHTML = t; $('#banner').classList.remove('hidden'); const b = $('#bannerText'); b.style.animation = 'none'; b.offsetHeight; b.style.animation = ''; return new Promise(r => setTimeout(() => { $('#banner').classList.add('hidden'); r(); }, ms)); }
function modal(html, bind) {
  return new Promise(res => { $('#modalCard').innerHTML = pcWords(html); $('#modal').classList.remove('hidden'); if (L) L.locked = true; bind($('#modalCard'), v => { $('#modal').classList.add('hidden'); if (L) L.locked = false; res(v); }); });
}
function fade(on) { $('#fade').classList.toggle('on', on); return sleep(380); }
function show(id, on = true) { $(id).classList.toggle('hidden', !on); }

/* ================= LEVEL FLOW ================= */
function bandFor(grade) { return (+grade >= 7) ? '7-8' : '5-6'; }
// Per-track content: a level may define tracks: { '5-6': {...}, '7-8': {...} }; overrides are layered over the base level.
function trackDef(base) { const o = base.tracks && base.tracks[S.band]; return o ? Object.assign(Object.create(base), o) : base; }
function newRec(def) { return { id: def.id, name: def.name, skill: def.skill, t0: now(), time: 0, attempts: 1, fails: 0, hints: 0, stars: 0, explore: 0, embers: 0, steps: 0, completed: false, skipped: false, firstTry: true, extra: {} }; }
/* resume-on-refresh: the unfinished run is kept in localStorage; only active play time counts */
function updateTotalTime() { const tt = $('#totalTime'); if (!tt || !S.startedAt || S.finishing) return; const sec = elapsedSec(); tt.textContent = `⏱️ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
setInterval(updateTotalTime, 1000);
function elapsedSec() { return S.startedAt ? Math.max(0, Math.round((Date.now() - new Date(S.startedAt).getTime()) / 1000)) : 0; }
function saveRun() { if (!S.student || S.finishing || TEST && QS.get('noresume')) return; try { localStorage.setItem(RUN_KEY, JSON.stringify({ v: 1, S, elapsed: elapsedSec(), savedAt: Date.now() })); } catch (e) { } }
function loadRun() { try { const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); return r && r.v === 1 && r.S && r.S.student && r.S.idx < LEVELS.length ? r : null; } catch (e) { return null; } }
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) { } }
function showStartOrResume() {
  const r = loadRun(); if (!r) return show('#start');
  const n = (r.S.levels || []).filter(Boolean).length, nm = String(r.S.student.name).replace(/[<>&"]/g, '');
  $('#resumeName').textContent = nm; $('#resumeInfo').textContent = `Island ${r.S.idx + 1} of ${LEVELS.length} · ${n} island${n === 1 ? '' : 's'} done · ⏱️ ${Math.floor(r.elapsed / 60)}:${String(r.elapsed % 60).padStart(2, '0')}`;
  show('#resume');
  $('#resumeGo').onclick = async () => { Sound.init(); show('#resume', false); Object.assign(S, r.S); S.hero = r.S.hero || AVATARS[S.avatar] || AVATARS.boy; buildPlayer(S.hero);
    S.startedAt = new Date(Date.now() - r.elapsed * 1000).toISOString(); hud(); updateTotalTime();
    if (!(DEBUG && QS.get('nomap'))) await showMap(-1, S.idx); startLevel(S.idx); };
  $('#resumeNew').onclick = () => { if (!confirm(`Start a NEW quest? ${nm}'s progress will be lost.`)) return; clearRun(); show('#resume', false); show('#start'); };
}
async function startLevel(i) {
  S.idx = i; saveRun(); const def = trackDef(LEVELS[i]); document.body.dataset.level = def.id;
  await fade(true); show('#mapUI', false);
  ['#btnHint', '#btnSkip', '#btnReset', '#btnAct', '#buildBar', '#hearts', '#panel'].forEach(s => show(s, false)); $('#btnAct').onclick = null;
  setMode('level'); player.g.position.y = 0;
  L = { def, rec: newRec(def), locked: true, hintIdx: 0, goalText: def.goal, t: 0 };
  buildLevel(def);
  for (const row of grid) for (const c of row) {
    if (c.t === 'S') { c.t = '.'; L.start = [c.x, c.z]; }
    if (c.t === 'o') { c.t = '.'; addEmber(c); }
    if (c.t === '*') { c.t = '.'; addStar(c); }
    if (c.t === 'b') { addBush(c); }
    if (c.t === 'x') addCracked(c);
    if (c.t === 'E') addGate(c);
  }
  if (def.setup) def.setup(L);
  if (L.start) placePlayer(L.start[0], L.start[1]); else player.g.visible = false;
  Sound.setMode(def.music || 'calm');
  $('#lvlName').textContent = `${i + 1}. ${def.emoji} ${def.name}`; $('#lvlGoal').textContent = def.skillLabel || '';
  hud(); fitCamera(); camera.position.copy(camTarget.clone().add(new THREE.Vector3(0, camDist * 1.3, camDist * 0.3)));
  show('#hud'); show('#actions'); show('#dpad', isTouch && !def.noWalk);
  await fade(false);
  await showBanner(`<div style="font-size:.5em">Level ${i + 1}</div>${def.emoji} ${def.name}`, 1500);
  say(def.intro || def.goal);
  L.locked = false; L.rec.t0 = now();
  if (def.start) def.start(L);
}
function failLevel(msg) {
  if (!L) return; L.rec.fails++; L.rec.attempts++; L.rec.firstTry = false; Sound.sfx('wrong'); shake(0.12);
  say(msg || pick(['Oops! Try again. You can do it! 💪', 'Almost! Have another go 🔥', 'Nice try! Mistakes help us learn 🙂']), 3500);
}
async function completeLevel() {
  if (!L || L.done) return; L.done = true; L.locked = true; L.rec.completed = !L.rec.skipped; L.rec.time = Math.round(now() - L.rec.t0);
  if (L.rec.hints) L.rec.firstTry = false;
  if (L.def.cleanup) L.def.cleanup(L);
  S.levels[S.idx] = L.rec; if (S.idx + 1 < LEVELS.length) { S.idx++; saveRun(); S.idx--; }
  if (!L.rec.skipped) { Sound.sfx('win'); confetti(70); player.jumpT = 0.5; await showBanner(pick(['Level clear! 🎉', 'Awesome! 🔥', 'You did it! ⭐', 'Brilliant! 🏆']), 1500); }
  if (S.idx + 1 < LEVELS.length) { const n = S.idx + 1; if (!(DEBUG && QS.get('nomap'))) await showMap(S.idx, n); startLevel(n); } else finishGame();
}
function getHints() { const h = L.def.hints; return (typeof h === 'function' ? h(L) : h) || []; }
function giveHint() {
  const h = getHints(); if (!h.length) return; L.rec.hints++; L.rec.firstTry = false; Sound.sfx('click');
  say('💡 ' + h[Math.min(L.hintIdx, h.length - 1)], 7000); L.hintIdx++;
}
async function skipLevel(offer) {
  const ok = await modal(`<h2>${offer ? 'Great effort! 💪' : 'Skip this level?'}</h2><p class="story-text">${offer ? 'You have tried for a while. Keep trying, or move on to the next island?' : "That's OK! You can move on."}</p><button class="btn" data-v="0" style="background:#ddd;color:#1a2a4f">Keep trying</button> <button class="btn primary" data-v="1">Skip →</button>`, (el, done) => el.querySelectorAll('button').forEach(b => b.onclick = () => done(b.dataset.v === '1')));
  if (ok) { L.rec.skipped = true; completeLevel(); }
}
function checkHelpers() {
  if (!L || L.done) return; const t = now() - L.rec.t0, f = L.rec.fails; if (!S.lastSave || Date.now() - S.lastSave > 10000) { S.lastSave = Date.now(); saveRun(); }
  if (getHints().length && (t > (CFG.HINT_AFTER_SEC || 45) || f >= (CFG.HINT_AFTER_FAILS || 2))) show('#btnHint', true);
  const hard = S.idx >= LEVELS.length - 3, tut = S.idx === 0;
  if ((!L.def.noSkip || (!tut && !L.def.ownTimer)) && ((!L.def.skipFails && t > (CFG.SKIP_AFTER_SEC || (hard ? 120 : 75))) || f >= (CFG.SKIP_AFTER_FAILS || 3))) show('#btnSkip', true);
  // time budget: after a long time, Promo offers to move on (once per level)
  if (!tut && !L.def.ownTimer && !L.def.skipFails && !L.offered && !L.locked && !(TEST && !QS.get('offer')) && t > (hard ? 180 : 120)) { L.offered = true; L.rec.extra.offeredSkip = 1; skipLevel(true); }
  updateTotalTime();
}

/* ================= INPUT ================= */
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const keys = new Set(); const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  Sound.init();
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); player.queue = []; e.preventDefault(); }
  if (e.code === 'KeyR' && L && L.def.reset && !L.locked) L.def.reset(L, true);
  if (DEBUG && e.code === 'KeyN' && L) completeLevel();
  if (e.code === 'Space' && L && !L.done && L.def.tap && !L.locked) { e.preventDefault(); L.def.tap(L); }
  if (e.code === 'Enter' && mapGoResolve && !$('#mapGo').disabled) $('#mapGo').click();
});
addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
document.querySelectorAll('#dpad button').forEach(b => {
  const d = b.dataset.d; b.addEventListener('pointerdown', e => { e.preventDefault(); Sound.init(); keys.add(d); player.queue = []; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => keys.delete(d)));
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let marker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false })); marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
canvas.addEventListener('pointerdown', e => {
  Sound.init(); if (MODE === 'map') { $('#mapGo').click(); return; } if (!L || L.locked) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (L.def.onPointer && L.def.onPointer(L, ray)) return;
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return;
  const gx = Math.round(p.x + (GW - 1) / 2), gz = Math.round(p.z + (GH - 1) / 2); const c = cell(gx, gz); if (!c) return;
  marker.position.set(wx(gx), 0.03, wz(gz)); marker.visible = true; marker.userData.t = 0.6;
  const dx = gx - player.x, dz = gz - player.z;
  if (Math.abs(dx) + Math.abs(dz) === 1) { player.queue = [[gx, gz]]; return; }
  if (c.t === 'x' || c.crate) { // walk next to it
    for (const [ax, az] of Object.values(DIRS)) { const n = cell(gx + ax, gz + az); if (n && !isSolid(n)) { const pth = findPath(gx + ax, gz + az); if (pth) { player.queue = pth.concat([[gx, gz]]); return; } } }
  }
  const path = findPath(gx, gz); if (path) player.queue = path; else Sound.sfx('bump');
});
$('#promo').style.pointerEvents = 'auto';
$('#promo').addEventListener('click', () => { S.promoTaps++; if (L) { if (S.promoTaps <= 3) L.rec.explore += 0; say(pick(['You\'re doing great! 🔥', 'I believe in you!', 'Look around. Secrets hide in cracked walls! 👀', 'Take your time. Think, then try!']), 2500); } Sound.sfx('click'); });
$('#btnHint').onclick = () => giveHint();
$('#btnSkip').onclick = () => skipLevel();
$('#btnReset').onclick = () => L && L.def.reset && L.def.reset(L, true);
$('#btnSound').onclick = () => { Sound.init(); const on = Sound.toggle(); $('#btnSound').textContent = on ? '🔊' : '🔇'; };
$('#btnSound').textContent = Sound.on ? '🔊' : '🔇';
$('#btnQuality').onclick = () => { quality = quality === 'high' ? 'low' : 'high'; localStorage.setItem(QUALITY_KEY, quality); applyQuality(); say(quality === 'high' ? 'Graphics: Pretty ✨' : 'Graphics: Fast ⚡', 1500); };

/* ================= MAIN LOOP ================= */
let last = performance.now(), fpsAcc = 0, fpsN = 0, lowAuto = false;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  // auto-drop quality on slow PCs
  fpsAcc += dt; fpsN++; if (fpsAcc > 3) { const fps = fpsN / fpsAcc; if (fps < 24 && quality === 'high' && !lowAuto) { lowAuto = true; quality = 'low'; applyQuality(); } fpsAcc = 0; fpsN = 0; }
  for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur); a.fn(k); if (k >= 1) { anims.splice(i, 1); a.done && a.done(); } }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i], u = p.userData; u.life -= dt; u.v.y -= 9 * dt; p.position.addScaledVector(u.v, dt); p.rotation.x += dt * 5; if (u.life <= 0 || p.position.y < -3) { scene.remove(p); parts.splice(i, 1); } }
  if (L && !L.locked && !L.def.noWalk && !player.moving && player.g.visible) {
    let moved = false;
    for (const d of ['up', 'down', 'left', 'right']) if (keys.has(d)) { tryStep(...DIRS[d]); moved = true; break; }
    if (!moved && player.queue.length) { const [nx, nz] = player.queue.shift(); if (!tryStep(nx - player.x, nz - player.z)) player.queue = []; }
  }
  // auto-fallback to Fast graphics on slow devices (only if the player never chose a setting)
  if (quality === 'high' && !localStorage.getItem(QUALITY_KEY) && !TEST) { FPS.n++; FPS.t += dt; if (FPS.t > 6) { if (FPS.n / FPS.t < 24) { quality = 'low'; applyQuality(); say('Switched to Fast graphics ⚡ for smoother play', 2500); } FPS.n = 0; FPS.t = -1e9; } }
  // player anim (walk / idle / jump)
  const P = player.parts; if (P.legL) {
    player.walkT += dt * (player.moving ? 14 : 0); const s = player.moving ? Math.sin(player.walkT) * 0.6 : 0; const idle = player.moving ? 0 : Math.sin(t / 650) * 0.07;
    P.legL.rotation.x = s; P.legR.rotation.x = -s; P.armL.rotation.x = -s + idle; P.armR.rotation.x = s - idle; P.armL.rotation.z = player.jumpT > 0 ? -0.9 : -Math.abs(idle) * 0.5; P.armR.rotation.z = player.jumpT > 0 ? 0.9 : Math.abs(idle) * 0.5; P.head.position.y = 1.0 + Math.sin(t / 400) * 0.02; P.head.rotation.y = player.moving ? 0 : Math.sin(t / 1700) * 0.25;
    if (player.jumpT > 0) { player.jumpT -= dt; const k = 1 - Math.max(0, player.jumpT) / 0.5; player.g.position.y = (MODE === 'map' ? player.g.position.y * 0 + islandY() : 0) + Math.sin(k * Math.PI) * 0.7; }
    const cur = player.g.rotation.y; let d = player.face - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); player.g.rotation.y = cur + d * Math.min(1, dt * 14);
  }
  // promo buddy follows
  if (player.g.visible) { const tp = player.g.position.clone().add(new THREE.Vector3(-0.6, 1.5 + Math.sin(t / 300) * 0.12, 0.3)); promo3d.position.lerp(tp, Math.min(1, dt * 5)); promo3d.visible = true; } else promo3d.visible = false;
  promo3d.rotation.y = Math.sin(t / 700) * 0.4; promoLight.intensity = quality === 'high' ? 1.2 + Math.sin(t / 90) * 0.2 : 0;
  ambTick(dt, t); sun.position.x = -8 + Math.sin(t / 14000) * 4;
  if (space.visible) { earth.rotation.y += dt * SC.spin; earthClouds.rotation.y += dt * SC.spin * 1.3; }
  if (overworld.visible) { ISL.forEach((s2, i) => { s2.flame.scale.y = 1 + Math.sin(t / 90 + i) * 0.15; }); overworld.children.forEach(o => { if (o.userData.v) { o.position.x += o.userData.v * dt; if (o.position.x > 45) o.position.x = -45; } }); }
  const sway = g => { if (g.userData.sway !== undefined) g.rotation.z = Math.sin(t / 900 + g.userData.sway) * 0.035; };
  world.children.forEach(sway); overworld.children.forEach(o => o.children && o.children.forEach(sway));
  // world spinners
  world.children.forEach(o => { if (o.userData.spin) { o.rotation.y += dt * 2; o.position.y = 0.55 + Math.sin(t / 300 + o.position.x) * 0.08; } });
  decor.children.forEach(o => { if (o.userData.v) { o.position.x += o.userData.v * dt; if (o.position.x > 45) o.position.x = -45; } if (o.userData.bob !== undefined) o.position.y += Math.sin(t / 1000 + o.userData.bob) * 0.003; });
  if (torchFire && torchFire.visible) { torchFire.children.forEach((f, i) => { f.rotation.y += dt * (1 + i); f.scale.y = (1.6 - i * 0.5) * 1.3 * (1 + Math.sin(t / 80 + i) * 0.08); }); }
  if (marker.visible) { marker.userData.t -= dt; marker.material.opacity = Math.max(0, marker.userData.t); if (marker.userData.t <= 0) marker.visible = false; }
  for (const row of grid) for (const c of row) if (c.arrow && c.arrow.visible) c.arrow.position.y = 2.5 + Math.sin(t / 200) * 0.15;
  if (L && L.def.update && !L.done) L.def.update(L, dt, t);
  if (L && !L.done && Math.floor(t / 1000) !== Math.floor((t - dt * 1000) / 1000)) checkHelpers();
  updateCamera(dt);
  renderer.render(scene, camera);
}

/* ================= LEVEL HELPERS ================= */
function addPad(c, color) {
  const p = mesh(color ? new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.15 }) : 'pad', wx(c.x), 0.04, wz(c.z), 0.86, 0.08, 0.86); c.padObj = p; c.trigger = true; return p;
}
function cubeStack(n, color = '#f26b21', size = 0.2) {
  const g = new THREE.Group(); const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 });
  for (let i = 0; i < n; i++) { const b = new THREE.Mesh(BOX, mat); b.scale.setScalar(size * 0.92); b.position.y = i * size + size / 2; b.castShadow = true; g.add(b); }
  return g;
}
function numSprite(n, s = 0.55) { return sprite(String(n), s, '#fff6ec'); }
function blockyPerson(shirt, skin = '#e0b088', hair = '#333') {
  const g = new THREE.Group(); const m = c => new THREE.MeshLambertMaterial({ color: c });
  mesh(m('#2a3550'), -0.1, 0.18, 0, 0.18, 0.36, 0.2, g); mesh(m('#2a3550'), 0.1, 0.18, 0, 0.18, 0.36, 0.2, g);
  mesh(m(shirt), 0, 0.58, 0, 0.42, 0.46, 0.24, g); mesh(m(shirt), -0.28, 0.6, 0, 0.14, 0.42, 0.18, g); mesh(m(shirt), 0.28, 0.6, 0, 0.14, 0.42, 0.18, g);
  mesh(m(skin), 0, 1.0, 0, 0.4, 0.4, 0.4, g); mesh(m(hair), 0, 1.18, -0.02, 0.42, 0.1, 0.44, g); return g;
}
function bangSprite(x, z, y = 2.2) { const s = sprite('❗', 0.8); s.position.set(x, y, z); s.userData.bang = y; world.add(s); return s; }
function bob(t) { world.children.forEach(o => { if (o.userData.bang) o.position.y = o.userData.bang + Math.sin(t / 220) * 0.15; }); }
function backToStart(delay = 700) { L.locked = true; player.queue = []; setTimeout(() => { burst(player.g.position.clone().setY(0.5), '#ffffff', 10); placePlayer(L.start[0], L.start[1]); L.locked = false; }, delay); }

/* ================= LEVELS ================= */
const NEW = {};
function makeBot(c, scale = 1) {
  const g = new THREE.Group(); const m = col => new THREE.MeshLambertMaterial({ color: col });
  mesh(m('#9aa7bd'), 0, 0.45, 0, 0.7, 0.7, 0.5, g); mesh(m('#1a2a4f'), 0, 0.5, 0.26, 0.5, 0.3, 0.02, g); mesh(new THREE.MeshBasicMaterial({ color: '#4fc3ff' }), -0.12, 0.52, 0.28, 0.1, 0.1, 0.02, g); mesh(new THREE.MeshBasicMaterial({ color: '#4fc3ff' }), 0.12, 0.52, 0.28, 0.1, 0.1, 0.02, g);
  mesh(m('#555'), 0, 0.95, 0, 0.06, 0.3, 0.06, g); mesh(M.gold, 0, 1.12, 0, 0.14, 0.14, 0.14, g); mesh(m('#7c8aa3'), -0.45, 0.45, 0, 0.16, 0.5, 0.16, g); mesh(m('#7c8aa3'), 0.45, 0.45, 0, 0.16, 0.5, 0.16, g);
  g.scale.setScalar(scale); g.position.set(wx(c.x), 0, wz(c.z)); world.add(g); return g;
}
function panel(html) { $('#panel').innerHTML = pcWords(html); show('#panel', true); }
function botHop(b) { if (b) tween(0.8, k => { b.rotation.y = k * Math.PI * 2; b.position.y = Math.sin(k * Math.PI) * 0.5; }); }

/* ---------- N1 Robot Sorter (AI, easy) ---------- */
NEW.N1 = {
  id: 'N1', name: 'Robot Sorter', emoji: '🧺', skill: 'ai', skillLabel: 'Basics of AI',
  map: ['###########', '#....R....#', '#.........#', '#.A.....B.#', '#.........#', '#x...S....#', '#####E#####'],
  intro: 'Robo is learning! 🤖 Show Robo where the food above its head belongs: walk onto the matching bin.',
  goal: 'Teach Robo: walk onto the right bin',
  hints: ['Look closely at the food above Robo. What color is it?', 'Each bin has a color sign. Which one fits the food?', 'Robots learn from the examples YOU give them 🤖'],
  items: [['🍎', 'R'], ['🍌', 'Y'], ['🍓', 'R'], ['🌽', 'Y'], ['🍒', 'R']], tests: [['🍋', 'Y'], ['🌶️', 'R']], binLabels: { R: ['🟥', 'red bin'], Y: ['🟨', 'yellow bin'] },
  tracks: { '7-8': { intro: 'Robo is learning! 🤖 Is the thing above its head LIVING or NON-LIVING? Walk onto the right bin to teach Robo.', goal: 'Teach Robo: living 🌱 or non-living 🪨',
    hints: ['Does it grow, breathe and need food? Then it is living 🌱', 'A thing that never grows or breathes is non-living 🪨', 'Robots learn from the examples YOU give them 🤖'],
    items: [['🐕', 'R'], ['🪨', 'Y'], ['🍄', 'R'], ['🚲', 'Y'], ['🌳', 'R']], tests: [['🐟', 'R'], ['🪑', 'Y']], binLabels: { R: ['🌱', 'living'], Y: ['🪨', 'non-living'] } } },
  solid: c => c.t === 'R',
  setup(L) {
    L.i = 0; L.bins = {};
    for (const row of grid) for (const c of row) {
      if (c.t === 'R') L.bot = makeBot(c);
      if (c.t === 'A' || c.t === 'B') { const col = c.t === 'A' ? '#e53935' : '#fdd835'; c.bin = c.t === 'A' ? 'R' : 'Y'; addPad(c, col);
        const box = mesh(new THREE.MeshLambertMaterial({ color: col }), wx(c.x), 0.35, wz(c.z) - 0.9, 0.9, 0.7, 0.4); box.castShadow = true;
        const bl = this.binLabels[c.bin]; const sg = cardSprite(bl[0], bl[1], 1.0); sg.position.set(wx(c.x), 1.5, wz(c.z) - 0.9); world.add(sg); L.bins[c.bin] = c; box.userData.bin = sg.userData.bin = c; L.binObjs = (L.binObjs || []).concat([box, sg]); }
    }
    panel(`<div class="pbig">🤖 Teaching Robo: <b id="n1c">0</b> / ${this.items.length}</div>`);
    this.showItem(L);
  },
  // tapping the bin box or its sign walks onto that bin's pad (v3 fix: before, taps on the box picked the cell behind it)
  onPointer(L, ray) { if (!L.binObjs || L.testing) return false; const hit = ray.intersectObjects(L.binObjs, false)[0]; if (!hit) return false; const c = hit.object.userData.bin;
    if (player.x === c.x && player.z === c.z) { say('You are on this bin. Step off, then walk on again 👣', 2500); return true; } const pth = findPath(c.x, c.z); if (pth) player.queue = pth; return true; },
  showItem(L) { L.wait = false; if (L.item) world.remove(L.item); const it = this.items[L.i]; L.item = cardSprite(it[0], '', 1.0); L.item.position.set(wx(5), 2.4, wz(1)); world.add(L.item); if (L.i) say(`Next food for Robo: ${it[0]}`, 0); },
  onEnter(c) {
    if (!c.bin || L.testing || L.wait || L.i >= this.items.length) return; const it = this.items[L.i];
    if (c.bin === it[1]) {
      Sound.sfx('good'); const o = L.item; L.item = null; const a = o.position.clone(), b = new THREE.Vector3(wx(c.x), 0.6, wz(c.z) - 0.9);
      tween(0.5, k => { o.position.lerpVectors(a, b, k); o.position.y += Math.sin(k * Math.PI); }, () => { world.remove(o); burst(b, '#ffd23f', 10); });
      L.i++; $('#n1c').textContent = L.i; botHop(L.bot);
      if (L.i >= this.items.length) this.robotTest(L); else { L.wait = true; setTimeout(() => { this.showItem(L); if (this.items[L.i][1] === c.bin && player.x === c.x && player.z === c.z) say(`Next food for Robo: ${this.items[L.i][0]} Step off the bin, then walk on again 👣`, 0); }, 600); }
    } else failLevel('Hmm, Robo looks confused 🤖❓ Look at the food again!');
  },
  async robotTest(L) {
    L.testing = true; L.locked = true; await sleep(700); say('Now Robo tries ALL BY ITSELF! 🤖 Watch…');
    for (const [e, k] of this.tests) {
      const o = cardSprite(e, '', 1.0); o.position.set(wx(5), 2.4, wz(1)); world.add(o); await sleep(900);
      const bc = L.bins[k]; const a = o.position.clone(), b = new THREE.Vector3(wx(bc.x), 0.6, wz(bc.z) - 0.9);
      await new Promise(r => tween(0.7, kk => { o.position.lerpVectors(a, b, kk); o.position.y += Math.sin(kk * Math.PI) * 1.2; }, r)); world.remove(o); burst(b, '#4fc3ff', 14); Sound.sfx('good'); botHop(L.bot); await sleep(500);
    }
    panel(`<div class="pbig">🤖 Robo learned from YOUR examples! That is how AI learns.</div>`);
    openGate(); say('Robo sorted new food by itself! 🎉 It learned from you. Walk to the gate ⬇️'); L.locked = false;
  },
  update(L, dt, t) { bob(t); if (L.item) L.item.position.y = 2.4 + Math.sin(t / 300) * 0.12; },
};

/* ---------- N2 Steady Voice (public speaking) ---------- */
NEW.N2 = {
  id: 'N2', name: 'Steady Voice', emoji: '🎙️', skill: 'speaking', skillLabel: 'Public Speaking', noWalk: true,
  map: ['...........', '..sssssss..', '..sssssss..', '...........', '.c.c.c.c.c.', '...........'], floor: 'grass',
  intro: 'Good speakers talk at a steady pace 🎙️ Tap 🗣️ Speak (or SPACE) each time the ring glows to say the next word!',
  goal: 'Tap 🗣️ when the ring glows', 
  hints: ['Watch the ring. Tap right when it shines brightest ✨', 'Not too fast, not too slow. Steady like a clock ⏰'],
  lines: [['Hello', 'friends!', 'Today', 'I', 'will', 'share', 'my', 'idea.'], ['Thank', 'you', 'for', 'listening!']],
  setup(L) {
    L.start = [5, 2]; L.line = 0; L.w = 0; L.bt = 0; L.period = 1.0; L.good = 0; L.miss = 0; L.missRow = 0; L.lastBeat = -1; L.crowd = [];
    for (const row of grid) for (const c of row) {
      if (c.t === 's') mesh('plank', wx(c.x), 0.06, wz(c.z), 1, 0.12, 1);
      if (c.t === 'c') { const p = blockyPerson(pick(['#e53935', '#43a047', '#3b82f6', '#8e24aa', '#fdd835', '#00acc1']), pick(['#e0b088', '#c98f65', '#8d5a3b', '#f1c9a5']), pick(['#222', '#5a3a20', '#ffd23f'])); p.position.set(wx(c.x), 0, wz(c.z)); p.rotation.y = Math.PI; world.add(p); L.crowd.push(p); }
    }
    [1.5, 9.5].forEach(x => mesh(new THREE.MeshLambertMaterial({ color: '#1a2a4f' }), wx(x), 1.2, wz(1), 0.4, 2.4, 0.4));
    L.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.8, 36), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, side: THREE.DoubleSide, depthWrite: false })); L.ring.position.set(wx(5), 2.3, wz(2)); world.add(L.ring);
    $('#btnAct').textContent = '🗣️ Speak'; $('#btnAct').onclick = () => this.tap(L); show('#btnAct', true);
    this.render(L);
  },
  start(L) { L.bt = 0; player.face = 0; },
  render(L) { const ln = this.lines[L.line]; panel(`<div class="voice">${ln.map((w, i) => `<span class="${i < L.w ? 'said' : i === L.w ? 'nowv' : ''}">${w}</span>`).join(' ')}</div><div class="small2">Line ${L.line + 1} of ${this.lines.length} · 🎯 on-beat: ${L.good}</div>`); },
  phaseDist(L) { const p = (L.bt % L.period) / L.period; return Math.min(p, 1 - p) * L.period; },
  onPointer(L) { this.tap(L); return true; },
  tap(L) {
    if (L.locked || L.finished) return; Sound.init(); const beat = Math.round(L.bt / L.period); if (beat === L.lastBeat) return;
    const d = this.phaseDist(L);
    if (d <= 0.3) {
      L.lastBeat = beat; L.w++; L.good++; L.missRow = 0; Sound.tone(440 + L.w * 60, 0.15, 'triangle', 0.2); L.crowd.forEach((p, i) => tween(0.3, k => p.position.y = Math.sin(k * Math.PI) * 0.15)); player.jumpT = 0.3;
      const ln = this.lines[L.line];
      if (L.w >= ln.length) {
        L.line++; L.w = 0;
        if (L.line >= this.lines.length) { this.render2(L); return this.finish(L); }
        L.period = 0.85; say('Great pace! 👏 One more line.', 2500);
      }
      this.render(L);
    } else {
      L.miss++; L.missRow++; Sound.sfx('bump'); const p = (L.bt % L.period) / L.period;
      say(p < 0.5 ? 'A little late! Wait for the next glow ✨' : 'Too early! Wait for the glow ✨', 1800);
      if (L.missRow >= 2) { L.rec.fails++; L.rec.firstTry = false; L.missRow = 0; }
    }
  },
  render2(L) { panel(`<div class="voice"><span class="said">👏 Clear, steady and confident!</span></div>`); },
  async finish(L) { L.finished = true; show('#btnAct', false); S.voice = { good: L.good, miss: L.miss, ratio: Math.round(100 * L.good / (L.good + L.miss)) / 100 }; L.rec.extra = { ...S.voice }; Sound.sfx('cheer'); confetti(50); L.crowd.forEach((p, i) => tween(1.4, k => { p.position.y = Math.abs(Math.sin(k * Math.PI * 4 + i)) * 0.4; })); await sleep(1500); completeLevel(); },
  update(L, dt, t) { L.bt += dt; const glow = Math.max(0, 1 - this.phaseDist(L) / 0.3); L.ring.material.opacity = 0.2 + 0.8 * glow; L.ring.scale.setScalar(0.8 + glow * 0.5); L.ring.material.color.set(glow > 0.3 ? '#ffd23f' : '#ffffff'); L.ring.lookAt(camera.position); },
};

/* ---------- N3 Tale Trail (storytelling) ---------- */
NEW.N3 = {
  id: 'N3', name: 'Tale Trail', emoji: '🗺️', skill: 'story', skillLabel: 'Storytelling',
  map: ['#########', '#.q.q.q.#', '#.......#', '#.v.v.v.#', '#.......#', '#.h.h.h.#', '#*b.S..x#', '####E####'],
  rows: { h: [['🐉', 'dragon'], ['🤖', 'robot'], ['🧙', 'wizard']], v: [['🏰', 'castle'], ['🚀', 'space'], ['🏝️', 'island']], q: [['🌧️', 'storm'], ['🔑', 'lost key'], ['🍕', 'lost pizza']] },
  phr: { dragon: 'a dragon', robot: 'a robot', wizard: 'a wizard', castle: 'in a castle', space: 'in space', island: 'on an island', storm: 'a big storm came', 'lost key': 'the magic key was lost', 'lost pizza': 'the giant pizza vanished' },
  order: ['h', 'v', 'q'], ask: { h: 'WHO is in your story?', v: 'WHERE do they live?', q: 'What PROBLEM happens?' },
  intro: 'Make your OWN story! 🗺️ Walk onto one card in each row: WHO ➜ WHERE ➜ PROBLEM. Any card is OK!',
  goal: 'Pick WHO ➜ WHERE ➜ PROBLEM',
  hints: ['Start with the row closest to you. Any card works!', 'Imagine the story in your head like a movie 🎬'],
  setup(L) {
    L.step = 0; L.pick = {}; L.cards = [];
    const cnt = { h: 0, v: 0, q: 0 };
    for (const row of grid) for (const c of row) if ('hvq'.includes(c.t) && c.t !== '.') {
      c.row = c.t; c.idx = cnt[c.t]++; c.t = '.'; const [e, w] = this.rows[c.row][c.idx]; addPad(c); c.trigger = c.row === 'h';
      c.card = cardSprite(e, w, 1.05); c.card.position.set(wx(c.x), 1.0, wz(c.z)); world.add(c.card); L.cards.push(c);
    }
    this.render(L); this.dim(L);
  },
  dim(L) { L.cards.forEach(c => { const active = c.row === this.order[L.step]; c.card.material.opacity = active || L.pick[c.row] === c ? 1 : 0.35; c.trigger = active; }); },
  render(L) { const p = L.pick; const b = (r, txt) => p[r] ? `<b class="fill">${this.rows[r][p[r].idx][0]} ${txt}</b>` : `<b class="blank ${this.order[L.step] === r ? 'now' : ''}">❓ ${r === 'h' ? 'WHO' : r === 'v' ? 'WHERE' : 'PROBLEM'}</b>`;
    panel(`<div class="tale">Once upon a time, ${b('h', p.h ? this.phr[this.rows.h[p.h.idx][1]] : '')} lived ${b('v', p.v ? this.phr[this.rows.v[p.v.idx][1]] : '')}. One day, ${b('q', p.q ? this.phr[this.rows.q[p.q.idx][1]] : '')}!</div>`); },
  onEnter(c) {
    if (!c.row || !c.trigger || L.step >= 3) return; L.pick[c.row] = c; L.step++; Sound.sfx('good'); c.padObj.material = M.gold; burst(c.card.position, '#ffd23f', 12);
    tween(0.4, k => c.card.scale.setScalar(1.05 + Math.sin(k * Math.PI) * 0.4));
    this.render(L); this.dim(L);
    if (L.step < 3) say(`Nice! Now: ${this.ask[this.order[L.step]]} ⬆️`, 0); else this.ending(L);
  },
  async ending(L) {
    const p = L.pick, st = `Once upon a time, ${this.phr[this.rows.h[p.h.idx][1]]} lived ${this.phr[this.rows.v[p.v.idx][1]]}. One day, ${this.phr[this.rows.q[p.q.idx][1]]}!`;
    await sleep(500);
    const end = await modal(`<h2>📖 How does YOUR story end?</h2><p class="story-text" style="font-size:18px">${st}</p><input type="text" id="tEnd" maxlength="140" placeholder="In the end, ..."><button class="btn primary" id="tGo">The End ✨</button>`, (el, done) => {
      const inp = el.querySelector('#tEnd'); setTimeout(() => inp.focus(), 50);
      el.querySelector('#tGo').onclick = () => { if (!words(inp.value)) { inp.style.borderColor = '#f26b21'; inp.placeholder = 'Type a few words. Any ending is great!'; return; } done(inp.value.trim()); };
    });
    S.tale = { who: this.rows.h[p.h.idx][1], where: this.rows.v[p.v.idx][1], problem: this.rows.q[p.q.idx][1], ending: end, words: words(end) }; L.rec.extra = { ...S.tale };
    panel(`<div class="tale">${st} <b class="fill">${end.replace(/[<>&]/g, '')}</b></div>`);
    Sound.sfx('cheer'); confetti(40); openGate(); say('What a story! 📖✨ Walk to the gate ⬇️');
  },
  update: (L, dt, t) => bob(t),
};

/* ---------- N4 Mirror Twins (logic, hard) ---------- */
NEW.N4 = {
  id: 'N4', name: 'Mirror Twins', emoji: '🪞', skill: 'logic', skillLabel: 'Logic',
  map: ['#############', '#.F...#..G..#', '#.....#.....#', '#.....#...#.#', '#.....#.....#', '#..S..#.....#', '###E#########'],
  intro: 'Meet your mirror twin! 🪞 When you step LEFT, your twin steps RIGHT. Get YOU on the 🟧 flag and your TWIN on the 🟦 flag at the same time!',
  goal: 'You on 🟧, twin on 🟦, at the same time. ↺ Reset if stuck',
  hints: ['Your twin copies you, but left and right are swapped ↔️', 'Walls can stop your twin while you keep moving 🧱', 'Move one step at a time and watch your twin 👀'],
  setup(L) {
    for (const row of grid) for (const c of row) {
      if (c.t === 'F' || c.t === 'G') { const col = c.t === 'F' ? '#f26b21' : '#3b82f6'; mesh(new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.3 }), wx(c.x), 0.03, wz(c.z), 0.9, 0.06, 0.9); mesh('log', wx(c.x) + 0.35, 0.8, wz(c.z) - 0.35, 0.08, 1.6, 0.08); const fl = mesh(new THREE.MeshLambertMaterial({ color: col }), wx(c.x) + 0.62, 1.4, wz(c.z) - 0.35, 0.5, 0.35, 0.04); fl.userData.flag = 1; if (c.t === 'F') L.F = [c.x, c.z]; else L.G = [c.x, c.z]; c.t = '.'; }
    }
    for (let z = 1; z < GH - 1; z++) { const gl = mesh(new THREE.MeshLambertMaterial({ color: '#9be3ff', transparent: true, opacity: 0.5, emissive: '#4fc3ff', emissiveIntensity: 0.3 }), wx(6), 1.5, wz(z), 0.3, 1, 0.9); }
    const h = player.hero; const tw = blockyPerson('#3b82f6', h.skin, h.hair); tw.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.8; o.material.emissive = new THREE.Color('#4fc3ff'); o.material.emissiveIntensity = 0.25; } }); world.add(tw);
    L.tw = { g: tw }; this.placeTwin(L); show('#btnReset', true);
  },
  placeTwin(L) { L.tw.x = GW - 1 - L.start[0]; L.tw.z = L.start[1]; L.tw.g.position.set(wx(L.tw.x), 0, wz(L.tw.z)); },
  onTry(dx, dz) {
    if (L.solved) return; const T = L.tw, nx = T.x - dx, nz = T.z + dz, c = cell(nx, nz); T.g.rotation.y = Math.atan2(-dx, dz);
    if (c && !isSolid(c) && c.t !== 'E') { const fx = wx(T.x), fz = wz(T.z); T.x = nx; T.z = nz; tween(0.15, k => { T.g.position.x = fx + (wx(nx) - fx) * k; T.g.position.z = fz + (wz(nz) - fz) * k; T.g.position.y = Math.sin(k * Math.PI) * 0.16; }); }
    else { const o = T.g.position.clone(); tween(0.16, k => { const s = Math.sin(k * Math.PI) * 0.15; T.g.position.x = o.x - dx * s; T.g.position.z = o.z + dz * s; }); }
    setTimeout(() => this.check(L), 200);
  },
  check(L) {
    if (L.solved || !L.F) return;
    if (player.x === L.F[0] && player.z === L.F[1] && L.tw.x === L.G[0] && L.tw.z === L.G[1]) { L.solved = true; show('#btnReset', false); openGate(); Sound.sfx('cheer'); confetti(40); tween(0.8, k => L.tw.g.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.5); say('Both on the flags! 🎉 Teamwork! Walk to the gate ⬇️'); }
  },
  reset(L, byUser) { if (L.solved) return; placePlayer(L.start[0], L.start[1]); this.placeTwin(L); if (byUser) { L.rec.fails++; L.rec.attempts++; L.rec.firstTry = false; Sound.sfx('click'); say('Fresh start! 🔄 Watch your twin closely.', 2500); } },
  onEnter() { }, update(L, dt, t) { world.children.forEach(o => { if (o.userData.flag) o.rotation.y = Math.sin(t / 300) * 0.3; }); },
};

/* ---------- N5 Fix the Robot (AI, harder) ---------- */
NEW.N5 = {
  id: 'N5', name: 'Fix the Robot', emoji: '🔧', skill: 'ai', skillLabel: 'Basics of AI',
  map: ['###########', '#....R....#', '#..1.2.3..#', '#.........#', '#..4.5.6..#', '#....S...x#', '#####E#####'],
  rounds: [[['🐱', 'cat', 1], ['🐶', 'cat', 0, 'dog'], ['🐟', 'fish', 1], ['🐦', 'fish', 0, 'bird'], ['🐮', 'cow', 1], ['🐸', 'frog', 1]],
           [['🚗', 'car', 1], ['🍎', 'car', 0, 'apple'], ['🚲', 'bike', 1], ['🍌', 'banana', 1], ['✈️', 'banana', 0, 'plane'], ['⚽', 'ball', 1]]],
  tracks: { '7-8': { rounds: [[['🐋', 'fish', 0, 'mammal'], ['🦈', 'fish', 1], ['🦇', 'bird', 0, 'mammal'], ['🐧', 'bird', 1], ['🐍', 'reptile', 1], ['🐸', 'reptile', 0, 'amphibian']],
    [['🌍', 'planet', 1], ['🌙', 'planet', 0, 'moon'], ['☀️', 'star', 1], ['🪐', 'planet', 1], ['☄️', 'star', 0, 'comet'], ['🌕', 'moon', 1]]] } },
  intro: 'Robo put name labels on these pictures, but some labels are WRONG! 🔧 Walk onto each WRONG card to fix it.',
  goal: 'Find and fix the wrong labels',
  hints: ['Read each label, then look at its picture. Do they match?', 'AI can make mistakes. People check its work! 🕵️'],
  solid: c => c.t === 'R',
  setup(L) { L.round = 0; L.pads = []; for (const row of grid) for (const c of row) { if (/[1-6]/.test(c.t)) { addPad(c); L.pads.push(c); } if (c.t === 'R') L.bot = makeBot(c); } this.showRound(L); },
  showRound(L) {
    const items = shuffle(this.rounds[L.round]); L.left = items.filter(i => !i[2]).length;
    L.pads.forEach((c, i) => { const it = items[i]; c.it = it; c.fixed = false; c.trigger = true; c.padObj.material = M.pad; if (c.card) world.remove(c.card); c.card = cardSprite(it[0], it[1] + '?', 1.05); c.card.position.set(wx(c.x), 1.0, wz(c.z)); world.add(c.card); });
    this.render(L); if (L.round) say('Round 2! Robo labeled new pictures. Check them all 🕵️', 3000);
  },
  render(L) { panel(`<div class="pbig">🔧 Round ${L.round + 1} of 2 · Wrong labels left: <b>${L.left}</b></div>`); },
  onEnter(c) {
    if (!c.it || !c.trigger) return; c.trigger = false;
    if (!c.it[2]) {
      world.remove(c.card); c.card = cardSprite(c.it[0], c.it[3] + ' ✓', 1.05, '#d8f5d0'); c.card.position.set(wx(c.x), 1.0, wz(c.z)); world.add(c.card); c.padObj.material = M.gold;
      Sound.sfx('good'); burst(c.card.position, '#2fa86b', 14); L.left--; this.render(L); botHop(L.bot);
      if (L.left <= 0) {
        L.round++;
        if (L.round >= this.rounds.length) { L.pads.forEach(p => p.trigger = false); openGate(); panel(`<div class="pbig">✅ All fixed! Real AI needs people like you to check it.</div>`); say('Great checking! 🕵️✅ Walk to the gate ⬇️'); }
        else { L.locked = true; setTimeout(() => { this.showRound(L); backToStart(0); }, 1200); }
      }
    } else { world.remove(c.card); c.card = cardSprite(c.it[0], c.it[1] + ' ✓', 1.05, '#d8f5d0'); c.card.position.set(wx(c.x), 1.0, wz(c.z)); world.add(c.card); failLevel('That label was already right ✅ Keep checking the others!'); }
  },
  update(L, dt, t) { bob(t); if (L.bot && !anims.length) L.bot.rotation.y = Math.sin(t / 800) * 0.3; },
};

/* ---------- N6 Dream Machine (creativity) ---------- */
NEW.N6 = {
  id: 'N6', name: 'Dream Machine', emoji: '💡', skill: 'creativity', skillLabel: 'Creativity',
  map: ['#########', '#.1.2.3.#', '#.......#', '#...M...#', '#.......#', '#.4.5.6.#', '#b..S..x#', '####E####'],
  parts: [['🪽', 'wings'], ['🛞', 'wheels'], ['🚀', 'rocket'], ['🧲', 'magnet'], ['☂️', 'umbrella'], ['🤖', 'robot arm'], ['🌈', 'rainbow'], ['🎵', 'music']],
  intro: 'Invent something NEW! 💡 Walk onto any 2 parts to drop them into the Dream Machine.',
  goal: 'Pick any 2 parts for your invention',
  hints: ['Any 2 parts work! There is no wrong answer here 🙂', 'Imagine: what could these parts do together? 🤔'], noSkip: true,
  solid: c => c.t === 'M',
  setup(L) {
    L.chosen = []; const parts = shuffle(this.parts).slice(0, 6); let i = 0;
    for (const row of grid) for (const c of row) {
      if (/[1-6]/.test(c.t)) { addPad(c); c.part = parts[i++]; c.card = cardSprite(c.part[0], c.part[1], 1.0); c.card.position.set(wx(c.x), 1.0, wz(c.z)); world.add(c.card); }
      if (c.t === 'M') { const g = new THREE.Group(); g.position.set(wx(c.x), 0, wz(c.z)); mesh(M.brick, 0, 0.5, 0, 1.2, 1, 1.2, g); mesh(new THREE.MeshLambertMaterial({ color: '#9be3ff', transparent: true, opacity: 0.6 }), 0, 1.3, 0, 0.9, 0.6, 0.9, g); mesh(M.gold, 0, 1.75, 0, 0.3, 0.3, 0.3, g); [-0.62, 0.62].forEach(x => mesh(new THREE.MeshLambertMaterial({ color: '#f26b21', emissive: '#f26b21', emissiveIntensity: 0.6 }), x, 0.7, 0.3, 0.06, 0.2, 0.2, g)); world.add(g); L.mach = g; }
    }
    this.render(L);
  },
  render(L) { const s2 = i => L.chosen[i] ? `<b class="fill">${L.chosen[i][0]} ${L.chosen[i][1]}</b>` : `<b class="blank now">❓</b>`; panel(`<div class="tale">💡 ${s2(0)} ＋ ${s2(1)} ＝ ✨ your invention!</div>`); },
  onEnter(c) {
    if (!c.part || c.used || L.chosen.length >= 2) return; c.used = true; c.trigger = false; L.chosen.push(c.part); Sound.sfx('good');
    const o = c.card, a = o.position.clone(), b = L.mach.position.clone().setY(1.4); tween(0.6, k => { o.position.lerpVectors(a, b, k); o.position.y += Math.sin(k * Math.PI) * 1.2; o.scale.setScalar(1 - k * 0.6); }, () => { world.remove(o); burst(b, '#ffd23f', 12); });
    this.render(L); if (L.chosen.length === 2) this.invent(L); else say('Great! Pick ONE more part 💡', 0);
  },
  async invent(L) {
    L.locked = true; await sleep(700); Sound.sfx('fire'); tween(1.2, k => { L.mach.rotation.y = Math.sin(k * 30) * 0.08; L.mach.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.2); }); await sleep(1300); burst(L.mach.position.clone().setY(2), '#ff4f8b', 30, 3); Sound.sfx('boom');
    const [a, b] = L.chosen;
    const res = await modal(`<h2>${a[0]} + ${b[0]} = ✨</h2><p class="story-text">You invented something! What is it?</p><input type="text" id="iName" maxlength="40" placeholder="Name it (example: Sky Scooter)"><input type="text" id="iDoes" maxlength="140" placeholder="What does it do? (one line)"><button class="btn primary" id="iGo">Show everyone 🎉</button>`, (el, done) => {
      const n = el.querySelector('#iName'); setTimeout(() => n.focus(), 50);
      el.querySelector('#iGo').onclick = () => { if (!words(n.value)) { n.style.borderColor = '#f26b21'; n.placeholder = 'Give it any name you like!'; return; } done({ name: n.value.trim(), does: el.querySelector('#iDoes').value.trim() }); };
    });
    S.invent = { parts: [a[1], b[1]], name: res.name, does: res.does, words: words(res.does) }; L.rec.extra = { ...S.invent };
    const sp = cardSprite(a[0] + b[0], res.name.slice(0, 14), 1.4); sp.position.set(L.mach.position.x, 2.8, L.mach.position.z); world.add(sp); L.show = sp;
    Sound.sfx('cheer'); confetti(50); openGate(); say(`Wow, the "${res.name.replace(/[<>&]/g, '')}"! 🤩 Walk to the gate ⬇️`);
  },
  update(L, dt, t) { bob(t); if (L.show) L.show.position.y = 2.8 + Math.sin(t / 300) * 0.15; },
};

/* ---------- W1 Word Turtle (spelling, medium) ---------- */
NEW.W1 = {
  id: 'W1', name: 'Word Turtle', emoji: '🐢', skill: 'words', skillLabel: 'Word Power',
  map: ['###########', '#.1.2.3.4.#', '#.........#', '#.5.6.7.8.#', '#.........#', '#x...S...*#', '#####E#####'],
  words: [['☀️', 'SUN'], ['🪁', 'KITE'], ['🥭', 'MANGO']],
  tracks: { '7-8': { words: [['🌧️', 'RAIN'], ['🌱', 'PLANT'], ['🧲', 'MAGNET']] } },
  intro: 'Help Tutu the turtle 🐢 spell the word! Walk onto the letters in order.',
  goal: 'Spell the word: walk onto each letter in order',
  hints: L => [`Look at the word card. Which letter comes first? 👀`, 'Say the word slowly. Listen to each sound 👂', 'Gold squares are letters you already used ✨'],
  setup(L) { L.round = 0; L.good = 0; L.bad = 0; L.pads = []; for (const row of grid) for (const c of row) if (/[1-8]/.test(c.t)) { addPad(c); L.pads.push(c); }
    const t = sprite('🐢', 1.2); t.position.set(wx(5), 1.2, wz(0) + 0.6); world.add(t); L.turtle = t; this.showRound(L); },
  showRound(L) {
    const [em, w] = this.words[L.round]; L.word = w; L.pos = 0; const pool = 'ABCDEFGHIJKLMNOPRSTUVWY'.split('').filter(ch => !w.includes(ch));
    const letters = shuffle([...w.split(''), ...shuffle(pool).slice(0, 8 - w.length)]);
    L.pads.forEach((c, i) => { c.letter = letters[i]; c.used = false; c.trigger = true; c.padObj.material = M.pad; if (c.card) world.remove(c.card); c.card = cardSprite(c.letter, '', 0.95); c.card.position.set(wx(c.x), 1.0, wz(c.z)); world.add(c.card); });
    this.render(L); say(L.round ? `Next word! ${em} Spell ${w}` : this.intro, 0);
  },
  render(L) { const [em, w] = this.words[L.round]; panel(`<div class="pbig">${em} <span class="spell">${w.split('').map((ch, i) => `<b class="${i < L.pos ? 'ok' : i === L.pos ? 'now' : ''}">${i < L.pos ? ch : ch}</b>`).join('')}</span></div><div class="small2">Word ${L.round + 1} of ${this.words.length}</div>`); },
  onEnter(c) {
    if (!c.letter || c.used || L.round >= this.words.length) return;
    if (c.letter === L.word[L.pos]) {
      c.used = true; c.padObj.material = M.gold; L.pos++; L.good++; Sound.tone(500 + L.pos * 90, 0.12, 'triangle', 0.2); burst(c.card.position, '#2fa86b', 12); tween(0.35, k => c.card.scale.setScalar(0.95 + Math.sin(k * Math.PI) * 0.4));
      this.render(L);
      if (L.pos >= L.word.length) { Sound.sfx('good'); confetti(30); tween(0.8, k => { L.turtle.position.y = 1.2 + Math.sin(k * Math.PI) * 0.8; }); L.round++;
        if (L.round >= this.words.length) { S.voice = { good: L.good, miss: L.bad, ratio: Math.round(100 * L.good / (L.good + L.bad)) / 100, kind: 'spelling' }; L.rec.extra = { ...S.voice }; L.pads.forEach(p => p.trigger = false); openGate(); say('Tutu is so happy! 🐢🎉 Walk to the gate ⬇️'); }
        else { L.locked = true; say(`You spelled ${L.word}! 🎉`, 1500); setTimeout(() => { this.showRound(L); backToStart(0); }, 1100); } }
      else say(`Good! Now find letter ${L.pos + 1} ➜`, 0);
    } else { L.bad++; if (L.bad % 3 === 0) { L.rec.fails++; L.rec.firstTry = false; } Sound.sfx('bump'); shake(0.05); say('Not that one. Look at the word card again 👀', 2200); }
  },
  update(L, dt, t) { bob(t); L.pads.forEach((c, i) => { if (c.card && !c.used) c.card.position.y = 1.0 + Math.sin(t / 350 + i) * 0.06; }); },
};

/* ---------- P1 Picture Puzzle Fort (jigsaw, medium) ---------- */
NEW.P1 = {
  id: 'P1', name: 'Picture Puzzle Fort', emoji: '🧩', skill: 'logic', skillLabel: 'Puzzles', noWalk: true,
  map: ['#########', '#.......#', '#...F...#', '#.......#', '#...S...#', '####E####'],
  puzzles: [{ c: 3, r: 2, time: 75, art: ['🏰', '☀️', '🌳'] }, { c: 3, r: 3, time: 100, art: ['🛺', '🌴', '🪁'] }],
  tracks: { '7-8': { puzzles: [{ c: 3, r: 3, time: 75, art: ['🏰', '☀️', '🌳'] }, { c: 4, r: 3, time: 100, art: ['🛺', '🌴', '🪁'] }] } },
  intro: 'The fort picture is all mixed up! 🧩 Tap two pieces to swap them.',
  goal: 'Fix the picture: tap 2 pieces to swap',
  hints: ['Find the corners first. Look at the sky and the ground 👀', 'Tap one piece, then tap where it should go 🔄'],
  solid: c => c.t === 'F',
  setup(L) { for (const row of grid) for (const c of row) if (c.t === 'F') { mesh('brick', wx(c.x), 0.7, wz(c.z), 1.6, 1.4, 1.2); mesh(M.gold, wx(c.x), 1.5, wz(c.z), 0.3, 0.3, 0.3); L.fort = c; } L.results = []; },
  art(p) { const c = document.createElement('canvas'); c.width = 360; c.height = 360 * p.r / p.c; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#6ec6ff'); gr.addColorStop(0.62, '#bfe9ff'); gr.addColorStop(0.62, '#5cb85c'); gr.addColorStop(1, '#3f8f35'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.art[0], c.width * 0.5, c.height * 0.55); g.font = '60px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.fillText(p.art[1], c.width * 0.85, c.height * 0.18); g.fillText(p.art[2], c.width * 0.15, c.height * 0.7);
    // tiles that look the same (plain sky / plain grass) are interchangeable: build a coarse look-signature per tile
    const tw = c.width / p.c, th = c.height / p.r; p.sig = [];
    for (let k = 0; k < p.c * p.r; k++) { const d = g.getImageData(Math.floor((k % p.c) * tw), Math.floor(Math.floor(k / p.c) * th), Math.floor(tw), Math.floor(th)).data; const sig = []; const W2 = Math.floor(tw), H2 = Math.floor(th);
      for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 6; xx++) { const i = 4 * (Math.floor((yy + 0.5) * H2 / 6) * W2 + Math.floor((xx + 0.5) * W2 / 6)); sig.push(d[i], d[i + 1], d[i + 2]); } p.sig.push(sig); }
    p.like = (a, b) => { if (a === b) return true; const A = p.sig[a], B = p.sig[b]; let m = 0, tot = 0; for (let i = 0; i < A.length; i++) { const e = Math.abs(A[i] - B[i]); tot += e; m = Math.max(m, e); } return tot / A.length < 12 && m < 60; };
    return c.toDataURL(); },
  async start(L) {
    await modal(`<h2>How to play 🧩</h2><div class="jdemo"><div class="jd" id="jd0">1</div><div class="jd" id="jd1">2</div><div class="jd" id="jd2">3</div><span class="jfinger" id="jf">👆</span></div><p class="story-text" id="jdSay" style="font-size:19px">Tap one piece…</p><button class="btn primary" id="jdGo">Got it! ▶</button>`, (el, done) => {
      const t = [], f = el.querySelector('#jf'), d0 = el.querySelector('#jd0'), d2 = el.querySelector('#jd2'), say2 = el.querySelector('#jdSay'); let fin = false;
      const run = () => { d0.textContent = '3'; d2.textContent = '1'; d0.className = d2.className = 'jd'; f.className = 'jfinger p0'; say2.textContent = 'Tap one piece…';
        t.push(setTimeout(() => { d0.classList.add('sel'); Sound.sfx('click'); }, 700), setTimeout(() => { f.className = 'jfinger p2'; say2.textContent = '…then tap where it should go'; }, 1100),
          setTimeout(() => { d2.classList.add('sel'); Sound.sfx('click'); }, 1800), setTimeout(() => { d0.textContent = '1'; d2.textContent = '3'; d0.className = d2.className = 'jd ok swap'; Sound.sfx('good'); say2.textContent = 'They swap! ✨ Make the whole picture right.'; }, 2200), setTimeout(() => { if (!fin) run(); }, 3800)); };
      run(); el.querySelector('#jdGo').onclick = () => { fin = true; t.forEach(clearTimeout); done(); };
    });
    for (let i = 0; i < this.puzzles.length; i++) {
      const p = this.puzzles[i], n = p.c * p.r, url = this.art(p); const same = (v, k) => v === k || (p.like && p.like(v, k)); let ord; do ord = shuffle([...Array(n).keys()]); while (ord.every(same));
      say(i ? 'Puzzle 2! A bit bigger 🧩' : this.intro, 0); const t0 = now();
      const res = await modal(`<h2>🧩 Puzzle ${i + 1} of ${this.puzzles.length}</h2><div class="jtop"><img src="${url}" class="jpeek" alt="the picture"><span id="jTime">⏱️ ${p.time}s</span></div><div id="jig" style="grid-template-columns:repeat(${p.c},1fr);aspect-ratio:${p.c}/${p.r}"></div><p class="small" id="jTip">Tap a piece, then tap another to swap.</p><div id="jDone" class="hidden"><div class="jdone">Done! ✓</div><button class="btn primary huge" id="jNext">${i + 1 < this.puzzles.length ? 'Next ▶' : 'Finish level ▶'}</button></div>`, (el, done) => {
        const box = el.querySelector('#jig'); let sel = -1, fin = false;
        const draw = () => { box.innerHTML = ord.map((v, k) => `<button class="jp ${k === sel ? 'sel' : ''} ${same(v, k) ? 'ok' : ''}" data-k="${k}" data-v="${v}" style="background-image:url(${url});background-size:${p.c * 100}% ${p.r * 100}%;background-position:${(v % p.c) / (p.c - 1) * 100}% ${(Math.floor(v / p.c)) / (p.r - 1) * 100}%"></button>`).join('');
          box.querySelectorAll('.jp').forEach(b => b.onclick = () => { if (fin) return; const k = +b.dataset.k; if (sel < 0) { sel = k; Sound.sfx('click'); } else { [ord[sel], ord[k]] = [ord[k], ord[sel]]; sel = -1; Sound.sfx(same(ord[k], k) ? 'good' : 'place'); if (ord.every(same)) { fin = true; clearInterval(iv); Sound.sfx('win'); confetti(40); box.classList.add('done'); finish(true); } } draw(); }); };
        const finish = ok => { const d = el.querySelector('#jDone'); if (!ok) d.querySelector('.jdone').textContent = 'Well tried! 👏'; d.classList.remove('hidden'); el.querySelector('#jTip').classList.add('hidden'); el.querySelector('#jNext').onclick = () => { Sound.sfx('click'); done(ok); }; };
        const iv = setInterval(() => { const left = Math.max(0, Math.ceil(p.time - (now() - t0))); const e = el.querySelector('#jTime'); if (e) { e.textContent = `⏱️ ${left}s`; e.classList.toggle('low', left < 15); } if (left <= 0 && !fin) { fin = true; clearInterval(iv); ord = [...Array(n).keys()]; draw(); finish(false); } }, 250);
        draw();
      });
      L.results.push({ ok: res, sec: Math.round(now() - t0) }); if (!res) { L.rec.fails++; L.rec.firstTry = false; } else confetti(30);
    }
    L.rec.extra = { puzzles: L.results.map(r => `${r.ok ? 'solved' : 'time'} ${r.sec}s`).join('; ') };
    Sound.sfx('cheer'); openGate(); L.noWalkDone = true; say('The fort picture is fixed! 🏰🎉', 0); await sleep(1200); completeLevel();
  },
};

/* ---------- O1 One Line Path (logic, medium) ---------- */
NEW.O1 = {
  id: 'O1', name: 'One Line Path', emoji: '〰️', skill: 'logic', skillLabel: 'Logic',
  map: ['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#....S....#', '#####E#####'],
  P: { a: [[4, 2, 3, 2], [4, 3]], b: [[4, 2, 3, 3], [4, 4]], c: [[3, 2, 4, 3], [3, 4]], ring: [[4, 2, 3, 3, 'hole'], [4, 4]], d: [[3, 1, 4, 4], [3, 4]] },
  order: ['a', 'b', 'c'],
  tracks: { '7-8': { order: ['b', 'ring', 'c', 'd'] } },
  intro: 'Paint EVERY bright tile with one walk! 〰️ You cannot step on a tile twice.',
  goal: 'Step on every bright tile once',
  hints: ['Start at the edge and go row by row, like a snake 🐍', 'Do not leave a tile alone in a corner!', 'Stuck? It restarts by itself. Try a new way 🔄'],
  solid: c => L && L.allowed && (!L.allowed.has(c.x + ',' + c.z) || L.vis.has(c.x + ',' + c.z)),
  setup(L) { L.round = 0; L.grp = new THREE.Group(); world.add(L.grp); this.showRound(L); },
  async start(L) {
    L.locked = true;
    await modal(`<h2>How to play 〰️</h2><div class="odemo">${[0, 1, 2, 3].map(i => `<div class="ot" id="ot${i}"></div>`).join('')}<span class="oghost" id="og">🧍</span><span class="ox hidden" id="ox">❌</span></div><p class="story-text" id="oSay" style="min-height:52px;font-size:19px"></p><button class="btn" id="oAgain" style="background:#ddd;color:#1a2a4f">↻ Show again</button> <button class="btn primary" id="oGo" disabled>Got it, let me try ▶</button>`, (el, done) => {
      const pos = [[0, 0], [1, 0], [1, 1], [0, 1]], g = el.querySelector('#og'), x = el.querySelector('#ox'), sayE = el.querySelector('#oSay'); let alive = true;
      const at = (i, c) => { g.style.left = (pos[i][0] * 92 + 18) + 'px'; g.style.top = (pos[i][1] * 92 + 14) + 'px'; if (c) { el.querySelector('#ot' + i).classList.add('used'); Sound.tone(440 + i * 120, 0.12, 'triangle', 0.18); } };
      const run = async () => { el.querySelector('#oGo').disabled = true; [0, 1, 2, 3].forEach(i => el.querySelector('#ot' + i).className = 'ot'); x.classList.add('hidden'); sayE.textContent = 'Walk on a bright tile…'; at(0, true);
        for (const i of [1, 2]) { await sleep(800); if (!alive) return; at(i, true); }
        await sleep(800); if (!alive) return; sayE.innerHTML = '<b style="color:#d6201f">Can\'t step twice! ❌</b>'; g.style.top = (pos[1][1] * 92 + 40) + 'px'; x.style.left = (pos[1][0] * 92 + 26) + 'px'; x.style.top = (pos[1][1] * 92 + 20) + 'px'; x.classList.remove('hidden'); Sound.sfx('wrong');
        await sleep(1200); if (!alive) return; x.classList.add('hidden'); at(2); await sleep(400); at(3, true); Sound.sfx('good');
        sayE.innerHTML = '<b>Step on every bright tile once, never twice</b> ✨'; await sleep(400); el.querySelector('#oGo').disabled = false; };
      el.querySelector('#oAgain').onclick = run; el.querySelector('#oGo').onclick = () => { alive = false; done(); }; run();
    });
    L.locked = false; this.place(L); say(this.intro, 0);
  },
  showRound(L) {
    const [[x0, z0, w, h, hole], st] = this.P[this.order[L.round]]; L.allowed = new Set(); L.vis = new Set(); L.tiles = {}; L.grp.clear(); L.st = st;
    for (let z = 1; z <= 5; z++) for (let x = 1; x <= 9; x++) { const inR = x >= x0 && x < x0 + w && z >= z0 && z < z0 + h && !(hole && x === x0 + 1 && z === z0 + 1); const k = x + ',' + z;
      if (inR) { L.allowed.add(k); L.tiles[k] = mesh(new THREE.MeshLambertMaterial({ color: '#4fc3ff', emissive: '#4fc3ff', emissiveIntensity: 0.25 }), wx(x), 0.04, wz(z), 0.9, 0.08, 0.9, L.grp); }
      else mesh('leaves', wx(x), 0.3, wz(z), 0.9, 0.6, 0.9, L.grp); }
    panel(`<div class="pbig">〰️ Path ${L.round + 1} of ${this.order.length} · tiles left: <b id="o1n">${L.allowed.size}</b></div>`);
  },
  place(L) { placePlayer(L.st[0], L.st[1]); this.visit(L, L.st[0], L.st[1]); },
  visit(L, x, z) { const k = x + ',' + z; if (!L.allowed || !L.allowed.has(k) || L.vis.has(k)) return; L.vis.add(k); const t = L.tiles[k]; t.material = M.gold; tween(0.2, q => t.scale.y = 1 + Math.sin(q * Math.PI) * 3); Sound.tone(400 + L.vis.size * 40, 0.08, 'triangle', 0.15);
    const left = L.allowed.size - L.vis.size; const e = $('#o1n'); if (e) e.textContent = left;
    if (!left) { Sound.sfx('good'); confetti(25); L.round++; if (L.round >= this.order.length) { L.allowed = null; L.grp.clear(); openGate(); panel(`<div class="pbig">〰️ All paths done!</div>`); say('Super paths! 🎉 Walk to the gate ⬇️'); } else { L.locked = true; say('Path done! 🎉 Next one…', 1500); setTimeout(() => { this.showRound(L); this.place(L); L.locked = false; }, 900); } return; }
    const free = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const q = (x + dx) + ',' + (z + dz); return L.allowed.has(q) && !L.vis.has(q); });
    if (!free) { L.locked = true; failLevel('Stuck! 🙈 Some tiles are left. Let us try again.'); setTimeout(() => { this.showRound(L); this.place(L); L.locked = false; }, 1200); }
  },
  onEnter(c) { this.visit(L, c.x, c.z); },
  update: (L, dt, t) => bob(t),
};

/* ---------- G1 Gadget Workshop (creativity + communication, medium) ---------- */
NEW.G1 = {
  id: 'G1', name: 'Gadget Workshop', emoji: '🛠️', skill: 'creativity', skillLabel: 'Invent & Explain', noSkip: true,
  map: ['#########', '#.......#', '#...M...#', '#.......#', '#b..S..x#', '####E####'],
  problem: ['🎒', 'Priya\'s school bag is SO heavy!', 'a lighter school bag'],
  tracks: { '7-8': { problem: ['🚗', 'Every morning there is a big traffic jam outside school!', 'less traffic outside school'] } },
  parts: [['🛞', 'wheels'], ['🎈', 'balloon'], ['🧲', 'magnet'], ['☀️', 'solar panel'], ['🤖', 'robot arm'], ['📱', 'phone app'], ['🔔', 'bell'], ['🪽', 'wings']],
  intro: 'Gadget Workshop! 🛠️ Solve a problem with your own invention.',
  goal: 'Invent a gadget and say how it helps',
  hints: ['Any 2 parts are OK! Think: how could they help? 🤔', 'Start with "It helps by…" 💡'],
  solid: c => c.t === 'M',
  setup(L) { for (const row of grid) for (const c of row) if (c.t === 'M') { const g = new THREE.Group(); g.position.set(wx(c.x), 0, wz(c.z)); mesh('plank', 0, 0.45, 0, 1.6, 0.9, 1, g); mesh(M.gold, -0.4, 1.0, 0, 0.3, 0.2, 0.3, g); mesh(new THREE.MeshLambertMaterial({ color: '#f26b21', emissive: '#f26b21', emissiveIntensity: 0.5 }), 0.4, 1.05, 0, 0.2, 0.3, 0.2, g); world.add(g); L.bench = g; } },
  async start(L) {
    const [pe, pt, pgoal] = this.problem; const parts = shuffle(this.parts).slice(0, 6); say(this.intro, 0);
    const chosen = await modal(`<h2>${pe} Problem!</h2><p class="story-text">${pt}<br>Pick <b>2 parts</b> for a gadget that gives ${pgoal}.</p><div class="choices">${parts.map(([e, t]) => `<button class="choice" data-t="${t}" data-e="${e}"><span class="em">${e}</span>${t}</button>`).join('')}</div><button class="btn primary" id="gp" disabled>Build it! 🛠️</button>`, (el, done) => {
      const sel = []; el.querySelectorAll('.choice').forEach(b => b.onclick = () => { const i = sel.indexOf(b); if (i >= 0) { sel.splice(i, 1); b.classList.remove('sel'); } else { if (sel.length >= 2) sel.shift().classList.remove('sel'); sel.push(b); b.classList.add('sel'); } Sound.sfx('click'); el.querySelector('#gp').disabled = sel.length !== 2; });
      el.querySelector('#gp').onclick = () => done(sel.map(b => [b.dataset.e, b.dataset.t]));
    });
    say(`${chosen[0][0]} + ${chosen[1][0]} … building! 🛠️`, 0); Sound.sfx('fire'); tween(1, k => { L.bench.rotation.y = Math.sin(k * 25) * 0.06; L.bench.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.15); }); await sleep(1100); burst(L.bench.position.clone().setY(1.5), '#ffd23f', 24, 3); Sound.sfx('boom');
    const ideas = [`It helps by ${pgoal === 'a lighter school bag' ? 'rolling the bag so Priya does not carry it' : 'telling cars where to wait'}.`, 'It helps because it is fast and easy to use.'];
    const res = await modal(`<h2>${chosen[0][0]} + ${chosen[1][0]} = ✨</h2><input type="text" id="gName" maxlength="40" placeholder="Name your gadget (example: Bag Buddy)"><input type="text" id="gHow" maxlength="140" placeholder="How does it help? (one line)"><div id="gIdeas" class="choices hidden" style="margin-top:8px">${ideas.map(i => `<button class="choice" style="min-width:100%">${i}</button>`).join('')}</div><button class="btn" id="gHelp" style="background:#ddd;color:#1a2a4f">💡 Ideas</button> <button class="btn primary" id="gGo">Show the class 🎉</button>`, (el, done) => {
      const n = el.querySelector('#gName'), h = el.querySelector('#gHow'); el.querySelector('#gHelp').onclick = () => el.querySelector('#gIdeas').classList.remove('hidden'); el.querySelectorAll('#gIdeas .choice').forEach(b => b.onclick = () => { h.value = b.textContent; });
      el.querySelector('#gGo').onclick = () => { if (!words(n.value)) { n.style.borderColor = '#f26b21'; n.placeholder = 'Give it any name you like!'; return; } done({ name: n.value.trim(), how: h.value.trim() }); };
    });
    S.invent = { parts: chosen.map(c => c[1]), name: res.name, does: res.how, words: words(res.how), problem: pgoal };
    S.tale = { who: 'gadget', where: pgoal, problem: pt, ending: res.how, words: words(res.how) + (words(res.how) ? 2 : 0) };
    L.rec.extra = { ...S.invent };
    const sp = cardSprite(chosen[0][0] + chosen[1][0], res.name.slice(0, 14), 1.4); sp.position.set(L.bench.position.x, 2.6, L.bench.position.z); world.add(sp); L.show = sp;
    Sound.sfx('cheer'); confetti(50); openGate(); say(`The class loves the "${res.name.replace(/[<>&]/g, '')}"! 👏 Walk to the gate ⬇️`);
  },
  update(L, dt, t) { bob(t); if (L.show) L.show.position.y = 2.6 + Math.sin(t / 300) * 0.15; },
};

/* ---------- S1 Setu Builder + Truck Rescue (maths/planning, hard) ---------- */
NEW.S1 = {
  id: 'S1', name: 'Setu Builder', emoji: '🌉', skill: 'logic', skillLabel: 'Bridge + Truck Rescue (hard)', noWalk: true,
  map: ['..............', '..zzzzzzzzzz..', '..zzzzzzzzzz..', '..zzzzzzzzzz..', '..............'],
  mats: { wood: { e: '🪵', n: 'Wood', t: 1, span: 3, cost: 100, col: '#b5834c' }, steel: { e: '🔩', n: 'Steel', t: 3, span: 4, cost: 300, col: '#8f9bab' }, rope: { e: '🪢', n: 'Rope', t: 0.5, span: 5, cost: 40, col: '#d9c08a' } },
  pillarCost: 250,
  rounds: [{ gap: 6, load: 0.5, who: '🛒 mango cart', budget: 900, block: [] }, { gap: 8, load: 2, who: '🚚 mango truck', budget: 3200, block: [] }, { gap: 10, load: 2.5, who: '🚛 heavy truck', budget: 3800, block: [5] }],
  tracks: { '7-8': { rounds: [{ gap: 6, load: 0.5, who: '🛒 mango cart', budget: 700, block: [] }, { gap: 8, load: 2, who: '🚚 mango truck', budget: 2800, block: [] }, { gap: 10, load: 2.5, who: '🚛 heavy truck', budget: 3600, block: [5] }], hints: [] } },
  intro: 'Build a setu (bridge)! 🌉 Pick ONE material and how many pillars ┃, then Test drive. Strong enough, short enough spans, and within budget!',
  goal: 'Strong enough, every span short enough, and under budget',
  hints: L => [`The ${L.R ? L.R.who : 'truck'} weighs ${L.R ? L.R.load : ''} t. Pick a material that holds at least that much 💪`, 'Each material can only reach so far between supports (max span). Add a pillar ┃ to split a long span.', 'Cheaper is better, but it must not break! Check the budget 💰', L.R && L.R.block.length ? 'The strong current 🌊 blocks a pillar at that spot. Put pillars somewhere else.' : 'Rope is cheap but weak. Steel is strong but costly.'],
  setup(L) {
    L.round = 0; L.wins = 0; L.saved = []; L.grp = new THREE.Group(); world.add(L.grp); L.mat = 'wood';
    const w = new THREE.Mesh(BOX, M.water); w.scale.set(10, 0.1, 3); w.position.set((wx(2) + wx(11)) / 2, -0.82, wz(2)); world.add(w);
    for (let i = 0; i < 9; i++) { const r = mesh('stone', wx(2.2 + Math.random() * 9), -0.9, wz(1) + Math.random() * 2.2, 0.3 + Math.random() * 0.3, 0.2, 0.3); r.rotation.y = i; }
    L.metal = new THREE.MeshStandardMaterial({ color: '#9aa6b5', metalness: 0.75, roughness: 0.35 }); L.rope = new THREE.MeshLambertMaterial({ color: '#8a6a3a' });
    [[0.3, 0.5], [1.2, 3.6], [12.6, 0.4], [13.4, 3.4], [1.6, 0.2], [12.3, 3.8]].forEach(([x, z]) => { const r = mesh('stone', wx(0) + x, 0.12, wz(0) + z, 0.5, 0.28, 0.4); r.rotation.y = x; });
    const t = new THREE.Group(); L.truckBody = mesh(new THREE.MeshLambertMaterial({ color: '#f26b21' }), 0, 0.55, 0, 1.3, 0.5, 0.7, t); mesh(new THREE.MeshLambertMaterial({ color: '#1a2a4f' }), 0.8, 0.55, 0, 0.45, 0.6, 0.7, t); mesh(new THREE.MeshBasicMaterial({ color: '#9be3ff' }), 1.03, 0.68, 0, 0.02, 0.22, 0.5, t);
    [[-0.4, 0.38], [0.4, 0.38], [-0.4, -0.38], [0.4, -0.38], [0.8, 0.38], [0.8, -0.38]].forEach(([x, z]) => mesh(M.dark, x, 0.18, z, 0.3, 0.3, 0.1, t));
    for (let i = 0; i < 6; i++) mesh(new THREE.MeshLambertMaterial({ color: i % 2 ? '#ffb02e' : '#ffd23f' }), -0.45 + (i % 3) * 0.3, 0.9, -0.15 + Math.floor(i / 3) * 0.3, 0.26, 0.22, 0.26, t);
    L.loadTag = sprite('🥭', 0.5); L.loadTag.position.set(0, 1.35, 0); t.add(L.loadTag); world.add(t); L.truck = t;
    this.showRound(L);
  },
  start(L) { if (getHints().length) show('#btnHint', true); },
  showRound(L) {
    const R = this.rounds[L.round]; L.R = R; L.deck = Array(R.gap).fill(null); L.pil = new Set(); L.mat = null; L.k = 0; L.blocked = []; L.ended = false; L.grp.clear(); L.objs = {};
    for (let x = 2 + R.gap; x <= 11; x++) for (let z = 1; z <= 3; z++) { mesh(M.grass, wx(x), -0.5, wz(z), 1, 1, 1, L.grp); mesh('dirt', wx(x), -1.5, wz(z), 1, 1, 1, L.grp); }
    R.block.forEach(b => { const f = mesh(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }), wx(2) - 0.5 + b, -0.36, wz(2), 0.6, 0.04, 3, L.grp); f.userData.foam = 1; const s2 = sprite('🌊', 0.7); s2.position.set(wx(2) - 0.5 + b, 0.5, wz(3) + 0.6); L.grp.add(s2); });
    const fl = sprite('🏁', 0.8); fl.position.set(wx(2 + R.gap) + 0.3, 1.2, wz(1)); L.grp.add(fl);
    L.truck.position.set(wx(0.6), 0, wz(2)); L.truck.rotation.set(0, 0, 0); L.truck.visible = true;
    const sc = R.load >= 2.5 ? 1.15 : R.load >= 2 ? 1 : 0.7; L.truck.scale.setScalar(sc);
    this.draw(L); this.render(L);
    say(L.round ? `Round ${L.round + 1}: ${R.gap} m river, ${R.who} weighs ${R.load} t${R.block.length ? '. Strong current in the middle 🌊' : ''}` : this.intro, 0);
  },
  longCells(L) { const out = []; this.spans(L).forEach(([a, b]) => { for (let i = a; i < b; i++) { const m = L.deck[i]; if (m && b - a > this.mats[m].span) out.push(i); } }); return out; },
  cost(L) { return L.deck.reduce((a, m) => a + (m ? this.mats[m].cost : 0), 0) + L.pil.size * this.pillarCost; },
  spans(L) { const sup = [0, ...[...L.pil].sort((a, b) => a - b), L.R.gap]; const out = []; for (let i = 0; i + 1 < sup.length; i++) out.push([sup[i], sup[i + 1]]); return out; },
  // stress of each metre: max(load / strength, span length / max span) -> green < 0.75, yellow <= 1, red > 1 (breaks)
  stress(L) { const st = Array(L.R.gap).fill(0); this.spans(L).forEach(([a, b]) => { for (let i = a; i < b; i++) { const m = L.deck[i]; if (!m) { st[i] = 9; continue; } const M2 = this.mats[m]; st[i] = Math.max(L.R.load / M2.t, (b - a) / M2.span); } }); return st; },
  // a real-looking bridge: textured deck at road level, stone pillars from the riverbed, rails / girders / sagging ropes
  draw(L) {
    Object.values(L.objs).forEach(o => L.grp.remove(o)); L.objs = {}; const G = L.R.gap, Z = wz(2);
    const ab = (x) => { const g = new THREE.Group(); mesh('stone', 0, -0.25, 0, 0.5, 0.5, 1.7, g); g.position.set(x, 0, Z); L.grp.add(g); return g; };
    L.objs.abL = ab(wx(2) - 0.75); L.objs.abR = ab(wx(2) + G - 0.25);
    const sup = [0, ...[...L.pil].sort((a, b) => a - b), G];
    for (let i = 0; i < G; i++) { const m = L.deck[i]; const x = wx(2) + i; const g = new THREE.Group(); g.position.set(x, 0, Z);
      if (m === 'wood') { const pm = M.plank.clone(); pm.emissive = new THREE.Color('#000'); for (let k = 0; k < 4; k++) mesh(pm, -0.375 + k * 0.25, 0, 0, 0.23, 0.12, 1.3, g); const lm = new THREE.MeshLambertMaterial({ color: '#7a5230' }); [-0.62, 0.62].forEach(dz => { mesh(lm, 0, 0.3, dz, 1, 0.07, 0.07, g); mesh(lm, -0.45, 0.16, dz, 0.07, 0.3, 0.07, g); }); }
      else if (m === 'steel') { const sm = L.metal.clone(); sm.emissive = new THREE.Color('#000'); mesh(sm, 0, 0, 0, 1, 0.1, 1.3, g); [-0.66, 0.66].forEach(dz => { mesh(sm, 0, 0.12, dz, 1, 0.34, 0.08, g); mesh(sm, 0, -0.08, dz * 0.92, 1, 0.06, 0.2, g); for (let r = 0; r < 4; r++) mesh(M.dark, -0.375 + r * 0.25, 0.2, dz + Math.sign(dz) * 0.045, 0.05, 0.05, 0.02, g); }); }
      else if (m === 'rope') { const span = sup.find((v, j) => j + 1 < sup.length && i >= v && i < sup[j + 1]); const nxt = sup[sup.indexOf(span) + 1]; const len = nxt - span; const sag = q => -0.25 * Math.sin(Math.PI * (q - span) / len);
        g.position.y = sag(i + 0.5); const rm = new THREE.MeshLambertMaterial({ color: '#c9a66b', emissive: '#000' }); for (let k = 0; k < 3; k++) mesh(rm, -0.33 + k * 0.33, 0, 0, 0.18, 0.06, 1.1, g);
        [-0.6, 0.6].forEach(dz => { const y0 = sag(i) - g.position.y + 0.5, y1 = sag(i + 1) - g.position.y + 0.5; const r = mesh(L.rope, 0, (y0 + y1) / 2, dz, 1.02, 0.05, 0.05, g); r.rotation.z = Math.atan2(y1 - y0, 1); mesh(L.rope, 0, (y0 + y1) / 4, dz, 0.03, (y0 + y1) / 2, 0.03, g); }); }
      else { const gm = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }); mesh(gm, 0, 0, 0, 0.92, 0.05, 1.25, g); }
      g.userData.deck = i; g.userData.y0 = g.position.y; g.traverse(o => { o.userData.deck = i; }); L.grp.add(g); L.objs['d' + i] = g; }
    L.long = this.longCells(L); L.long.forEach(i => { const o = L.objs['d' + i]; if (!o) return; const w = mesh(new THREE.MeshBasicMaterial({ color: '#ff2d2d', transparent: true, opacity: 0.4, depthWrite: false }), 0, 0.12, 0, 1, 0.04, 1.4, o); w.userData.deck = i; });
    if (L.long.length) { const mid = L.long[Math.floor(L.long.length / 2)]; const wt = sprite('⚠️', 0.6); wt.position.set(wx(2) + mid, 1.1, Z); L.grp.add(wt); L.objs.warn = wt; }
    for (let b = 1; b < G; b++) { const x = wx(2) - 0.5 + b; const on = L.pil.has(b), blk = L.R.block.includes(b); if (!on && !blk) continue; const g = new THREE.Group(); g.position.set(x, 0, Z);
      if (on) { mesh('stone', 0, -0.55, 0, 0.42, 0.95, 0.9, g); mesh('stone', 0, -0.08, 0, 0.56, 0.12, 1.05, g); mesh('stone', 0, -0.98, 0, 0.6, 0.12, 1.1, g); }
      else { const gm = new THREE.MeshBasicMaterial({ color: blk ? '#ff4040' : '#ffd23f', transparent: true, opacity: blk ? 0.25 : 0.38, depthWrite: false }); mesh(gm, 0, -0.5, 0.75, 0.3, 0.9, 0.12, g); const t = sprite(blk ? '🌊' : '┃', 0.45); t.position.set(0, 0.35, 0.8); g.add(t); }
      g.traverse(o => { o.userData.pil = b; }); L.grp.add(g); L.objs['p' + b] = g; }
  },
  // one material for the whole bridge + 0-3 evenly spaced pillars
  pillarsFor(G, k) { const out = []; for (let j = 1; j <= k; j++) out.push(Math.round(G * j / (k + 1))); return out; },
  choose(L, m, k) {
    if (L.ended || L.locked) return; if (m !== undefined) L.mat = m; if (k !== undefined) L.k = k;
    L.deck = L.deck.map(() => L.mat || null); L.pil = new Set(this.pillarsFor(L.R.gap, L.k || 0).filter(b => !L.R.block.includes(b)));
    L.blocked = this.pillarsFor(L.R.gap, L.k || 0).filter(b => L.R.block.includes(b));
    Sound.sfx(m !== undefined ? 'place' : 'push'); this.draw(L); this.render(L); if (L.mat) { const ln = this.longCells(L).length; say(ln ? '⚠️ A span is too long for ' + this.mats[L.mat].n + '. Add pillars ┃' : this.mats[L.mat].load < 0 ? '' : `${this.mats[L.mat].e} ${this.mats[L.mat].n} + ${L.pil.size} pillar${L.pil.size === 1 ? '' : 's'} = ₹${this.cost(L)}. Ready? Test drive! 🚚`, 0); }
  },
  render(L) {
    const R = L.R, c = this.cost(L), over = c > R.budget, k = L.k || 0;
    panel(`<div class="bpanel"><b>🌉 Round ${L.round + 1}/${this.rounds.length}</b><span>${R.who} <b>${R.load} t</b></span><span>River <b>${R.gap} m</b></span><span>Budget <b>₹${R.budget}</b></span></div>
      <div class="smats big">${Object.entries(this.mats).map(([key, m]) => `<button class="sm ${L.mat === key ? 'sel' : ''}" data-m="${key}"><b class="si">${m.e}</b><span>${m.n}</span><small>💪 holds ${m.t} t</small><small>↔️ max span ${m.span} m</small><small>💰 ₹${m.cost} per m</small></button>`).join('')}</div>
      <div class="spil"><span>Pillars ┃ <small>(₹${this.pillarCost} each)</small></span>${[0, 1, 2, 3].map(n => `<button class="pk2 ${k === n ? 'sel' : ''}" data-k="${n}">${n}</button>`).join('')}</div>
      <div class="sinfo">${L.mat ? `Spans: <b>${this.spans(L).map(([a, b]) => (b - a) + ' m').join(' + ')}</b>` : 'Pick a material 👆'}${L.blocked && L.blocked.length ? `<div class="swarn">🌊 Strong current at ${L.blocked.join(', ')} m: no pillar there! Choose another number.</div>` : ''}</div>
      <div class="scost ${over ? 'bad' : ''}">Total: ₹${R.gap} m × ${L.mat ? '₹' + this.mats[L.mat].cost : '?'} + ${L.pil.size} × ₹${this.pillarCost} = <b>₹${c}</b> ${L.mat ? (over ? '❌ over budget' : `✅ ₹${R.budget - c} left`) : ''}</div>
      <div class="planks"><button class="pk go" data-g="1" ${!L.mat || (L.blocked && L.blocked.length) ? 'disabled' : ''}>🚚 Test drive!</button></div>`.replace('₹' + R.gap + ' m', R.gap + ' m'));
    const P = $('#panel');
    P.querySelectorAll('[data-m]').forEach(b => b.onclick = () => this.choose(L, b.dataset.m));
    P.querySelectorAll('[data-k]').forEach(b => b.onclick = () => this.choose(L, undefined, +b.dataset.k));
    P.querySelector('[data-g]').onclick = () => this.go(L);
  },
  setCell(L, i, m) { if (L.ended || L.locked) return; m = m || L.mat; L.deck[i] = L.deck[i] === m ? null : m; Sound.sfx('place'); this.draw(L); const o = L.objs['d' + i]; if (o) { const y0 = o.position.y; o.position.y = 0.8; tween(0.2, k => o.position.y = 0.8 + (y0 - 0.8) * k); } this.render(L); },
  togglePillar(L, b) { if (L.ended || L.locked) return; if (L.R.block.includes(b)) { Sound.sfx('bump'); say('The current is too strong there 🌊 Put the pillar somewhere else.', 2500); return; } if (L.pil.has(b)) L.pil.delete(b); else L.pil.add(b); Sound.sfx('push'); this.draw(L); this.render(L); },
  onPointer(L, ray) { return true; },
  async go(L) {
    if (L.ended || L.locked) return; const R = L.R;
    if (L.deck.some(m => !m)) { Sound.sfx('bump'); say('Pick a material first 👆', 2500); return; }
    const c = this.cost(L); if (c > R.budget) { Sound.sfx('bump'); L.rec.fails++; L.rec.firstTry = false; say(`💰 Over budget! ₹${c} is more than ₹${R.budget}. Try a cheaper material or fewer pillars.`, 0); return; }
    L.ended = true; L.locked = true; const st = this.stress(L); const sp = this.spans(L);
    const brk = sp.find(([a, b]) => { for (let i = a; i < b; i++) if (st[i] > 1) return true; return false; });
    const t = L.truck; const xs = wx(2) - 0.5; Sound.sfx('push');
    await new Promise(r => tween(0.8, k => t.position.x = wx(0.6) + (xs - wx(0.6)) * k, r));
    const xEnd = brk ? xs + (brk[0] + brk[1]) / 2 : wx(13.4); const dur = (xEnd - xs) * 0.32; let snapped = false;
    await new Promise(r => tween(dur, k => {
      t.position.x = xs + (xEnd - xs) * k; const tx = t.position.x - xs;
      sp.forEach(([a, b]) => { const on = tx > a - 0.5 && tx < b + 0.5; for (let i = a; i < b; i++) { const o = L.objs['d' + i]; if (!o) continue; const f = Math.sin(Math.PI * (i + 0.5 - a) / (b - a)); const s2 = Math.min(1.4, st[i]); o.position.y = o.userData.y0 - (on ? f * 0.28 * s2 : 0); const col = on ? (s2 > 1 ? '#c01010' : s2 > 0.75 ? '#a08000' : '#108a30') : '#000000'; o.traverse(q => { if (q.material && q.material.emissive && q.material !== M.dark && q.material !== L.rope) q.material.emissive.set(col); }); } });
      { const i = Math.floor(tx); const o = L.objs['d' + Math.min(L.R.gap - 1, Math.max(0, i))]; t.position.y = (tx > 0 && tx < L.R.gap && o) ? o.position.y + 0.07 : 0; }
    }, r));
    if (brk) {
      snapped = true; Sound.sfx('crumble'); shake(0.3); const [a, b] = brk; for (let i = a; i < b; i++) { const o = L.objs['d' + i]; tween(0.6, k => { o.position.y = o.userData.y0 - k * 1.4; o.rotation.z = (i - (a + b) / 2) * k * 0.4; }); }
      await new Promise(r => tween(0.6, k => { t.position.y = -k * 1.3; t.rotation.z = -k * 0.7; }, r)); Sound.sfx('splash'); burst(t.position.clone().setY(0), '#7cc4ff', 24);
      const mk = sprite('❌', 0.9); mk.position.set(xs + (a + b) / 2, 1.4, wz(2)); L.grp.add(mk);
      const weak = (() => { for (let i = a; i < b; i++) { const M2 = this.mats[L.deck[i]]; if (R.load > M2.t) return `Too weak: ${M2.n} holds ${M2.t} t, the truck is ${R.load} t.`; if (b - a > M2.span) return `Span too long: ${b - a} m, but ${M2.n} reaches only ${M2.span} m. Add pillars ┃`; } return 'That part was too weak.'; })();
      failLevel(`Snap! 💥 ${weak}`); await sleep(1600); L.grp.remove(mk); t.rotation.set(0, 0, 0); t.position.set(wx(0.6), 0, wz(2)); L.ended = false; L.locked = false; this.draw(L); this.render(L); say(`💥 ${weak}`, 0); return;
    }
    const saved = R.budget - c; L.saved.push(saved / R.budget); L.wins++; Sound.sfx('win'); confetti(50);
    await showBanner(`${R.who.split(' ')[0]} Rescued! 🥭 Saved ₹${saved}`, 1500);
    L.results = (L.results || []).concat([{ gap: R.gap, cost: c, budget: R.budget, pillars: L.pil.size, mats: [...new Set(L.deck)].join('+') }]); L.round++; L.locked = false;
    if (L.round >= this.rounds.length) {
      const avg = L.saved.reduce((x, y) => x + y, 0) / L.saved.length; L.rec.costStars = avg >= 0.2 ? 3 : avg >= 0.08 ? 2 : 1;
      L.rec.extra = { bridges: L.results.map(r => `${r.gap}m ₹${r.cost}/${r.budget} ${r.mats} ${r.pillars}p`).join('; '), savedPct: Math.round(avg * 100), costStars: L.rec.costStars };
      panel(`<div class="pbig">🌉 All trucks rescued! You saved ${Math.round(avg * 100)}% of the budget.</div>`); await sleep(600); completeLevel();
    } else this.showRound(L);
  },
  update(L, dt, t) { M.water.map.offset.x += dt * 0.35; if (L.grp) L.grp.children.forEach(o => { if (o.userData.foam) o.material.opacity = 0.4 + Math.sin(t / 150) * 0.25; }); }
};

const LEVELS = [
{
  id: 'L1', name: 'Ember Gate', emoji: '🔥', skill: 'tutorial', skillLabel: 'Warm-up',
  map: ['###########', '#S...o..#*#', '#.......#b#', '#..o......#', '#......o..E', '###########'],
  intro: 'Hi, I\'m Promo! 🔥 Walk with ⬅️⬆️⬇️➡️ / W A S D, or tap the ground.',
  goal: 'Grab the 3 glowing 🔥 embers!', hints: ['Look for the glowing orange blocks 🔥. Walk into them!'], noSkip: true,
  tracks: { '7-8': { map: ['###########', '#S..d..d#*#', '#.d...d.#b#', '#...d..d..#', '#.d.....d.E', '###########'],
    intro: 'Hi, I\'m Promo! 🔥 Walk with ⬅️⬆️⬇️➡️ / W A S D, or tap the ground. Light the 🪔 diyas in the right number pattern!',
    goal: 'Light the diyas in order: 2, 4, 6 … what comes next?', hints: ['Start with 2. Then add 2 each time ➕2', 'Skip the odd numbers: 5, 7 and 9 are tricks!', 'Walk onto (or tap) a diya to light it 🪔'], nums: [2, 7, 4, 9, 6, 5, 8, 10],
    setup(L) { L.moved = false; L.next = 0; let i = 0; for (const row of grid) for (const c of row) if (c.t === 'd') { c.dnum = this.nums[i++]; addPad(c, '#8a5a2a'); const sg = cardSprite('🪔', String(c.dnum), 0.9); sg.position.set(wx(c.x), 1.2, wz(c.z)); world.add(sg); c.sg = sg; } },
    trigger: c => c.t === 'd',
    onEnter(c) {
      if (!L.moved) { L.moved = true; say('Great walking! 👍 Now light the diyas: 2, 4, 6 … 🪔', 0); }
      if (c.t !== 'd' || c.lit) return; const want = [2, 4, 6, 8, 10][L.next];
      if (c.dnum === want) { c.lit = true; L.next++; const f = sprite('🔥', 0.6); f.position.set(wx(c.x), 0.6, wz(c.z)); world.add(f); burst(f.position, '#ffb02e', 14); Sound.sfx('collect'); S.embers++; L.rec.embers++; hud();
        if (L.next >= 5) { openGate(); say('All 5 diyas lit! 2, 4, 6, 8, 10 🎉 The gate is open ➡️', 0); } else say(`🪔 ${[2, 4, 6, 8, 10].slice(0, L.next).join(', ')} … what comes next?`, 0); }
      else { L.rec.fails++; L.rec.firstTry = false; Sound.sfx('bump'); say(`Not ${c.dnum}! 🤔 The pattern goes up by 2: ${[2, 4, 6, 8, 10].slice(0, L.next).join(', ') || 'start with 2'}…`, 3000); }
    } } },
  setup(L) { L.moved = false; L.onEmber = () => { const n = L.rec.embers; if (n >= 3) { openGate(); say('The gate is open! 🎉 Walk to the gate ➡️'); } else say(`Nice! 🔥 ${n} of 3`, 0); }; },
  onEnter(c) { if (!L.moved) { L.moved = true; say('Great walking! 👍 Now grab the 3 glowing 🔥 embers!'); } },
  update: (L, dt, t) => bob(t),
},
{
  id: 'L2', name: 'Color Stones', emoji: '🟧', skill: 'logic', skillLabel: 'Patterns',
  map: ['############', '#..zzzzz..x#', '#S.zzzzz...#', '#..zzzzz...E', '#..zzzzz.o.#', '############'],
  intro: 'Cross the river! Step 🟧 then 🟦 then 🟧… like the pattern up top ⬆️',
  goal: 'Follow the color pattern: 🟧 🟦 🟧 🟦 …',
  seq: ['O', 'B'], banner: ['O', 'B', 'O', 'B', 'O', 'B'],
  path: { '3,1': 'O', '4,1': 'B', '4,2': 'O', '5,2': 'B', '5,3': 'O', '6,3': 'B', '7,3': 'O' }, fill: ['B', 'O', 'O', 'B', 'B', 'O', 'O', 'O', 'B', 'B', 'O', 'B', 'B'],
  tracks: { '7-8': { intro: 'Cross the river! TWO rules: 🟧 🟧 then 🟦, again and again. Look at the pattern up top ⬆️', goal: 'Rule: 2 orange 🟧🟧, then 1 blue 🟦, repeat',
    hints: ['Say it out loud: orange, orange, blue, orange, orange, blue…', 'After ONE blue you always need TWO oranges in a row.', 'Plan your path with your eyes first 👀, then walk.'],
    seq: ['O', 'O', 'B'], banner: ['O', 'O', 'B', 'O', 'O', 'B'],
    path: { '3,1': 'O', '4,1': 'O', '4,2': 'B', '5,2': 'O', '5,3': 'O', '6,3': 'B', '7,3': 'O' }, fill: ['B', 'O', 'B', 'B', 'O', 'B', 'O', 'B', 'B', 'O', 'B', 'O', 'B'] } },
  hints: ['Look at the colors floating above the wall ⬆️', 'Never step on the same color twice in a row!', 'Plan your path with your eyes first 👀, then walk.'],
  setup(L) {
    openGate(true); L.last = null; L.k = 0;
    const path = this.path, fill = this.fill;
    let fi = 0; L.stones = [];
    const water = new THREE.Mesh(BOX, M.water); M.water.map.repeat.set(5, 4); water.scale.set(5, 0.1, 4); water.position.set(wx(5), -0.35, (wz(1) + wz(4)) / 2); world.add(water); L.water = water;
    for (const row of grid) for (const c of row) if (c.t === 'z') {
      c.col = path[c.x + ',' + c.z] || fill[fi++ % fill.length];
      const m = new THREE.MeshLambertMaterial({ color: c.col === 'O' ? '#f26b21' : '#3b82f6', emissive: c.col === 'O' ? '#f26b21' : '#3b82f6', emissiveIntensity: 0.1 });
      c.stone = mesh(m, wx(c.x), -0.15, wz(c.z), 0.86, 0.3, 0.86); L.stones.push(c);
    }
    this.banner.forEach((k, i) => { const b = mesh(new THREE.MeshLambertMaterial({ color: k === 'O' ? '#f26b21' : '#3b82f6', emissive: k === 'O' ? '#f26b21' : '#3b82f6', emissiveIntensity: 0.4 }), wx(3 + i * 0.9), 2.7, wz(0), 0.6, 0.6, 0.6); b.userData.float = i; L['ban' + i] = b; });
    const st = sprite('➡️', 0.6); st.position.set(wx(8.6), 2.7, wz(0)); world.add(st);
  },
  trigger: c => c.t === 'z',
  onEnter(c) {
    if (c.t !== 'z') { L.last = null; L.k = 0; L.stones.forEach(s => s.stone.material.emissiveIntensity = 0.1); return; }
    const want = this.seq[L.k % this.seq.length];
    if (c.col === want) { L.last = c.col; L.k++; c.stone.material.emissiveIntensity = 0.6; Sound.tone(c.col === 'O' ? 660 : 880, 0.1, 'triangle', 0.15); }
    else {
      L.locked = true; const s = c.stone; Sound.sfx('crumble');
      tween(0.5, k => { s.position.y = -0.15 - k * 1.5; s.rotation.z = k; player.g.position.y = -k * 0.8; }, () => { Sound.sfx('splash'); burst(new THREE.Vector3(s.position.x, 0, s.position.z), '#7cc4ff', 20); });
      failLevel('Splash! 💦 That stone broke the pattern. Try again!');
      setTimeout(() => { s.position.y = -0.15; s.rotation.z = 0; L.last = null; L.k = 0; L.stones.forEach(q => q.stone.material.emissiveIntensity = 0.1); backToStart(0); }, 1100);
    }
  },
  update(L, dt, t) { M.water.map.offset.x += dt * 0.25; M.water.map.offset.y = Math.sin(t / 1500) * 0.05; for (let i = 0; i < 6; i++) { const b = L['ban' + i]; if (b) { b.position.y = 2.7 + Math.sin(t / 300 + i * 0.7) * 0.1; b.rotation.y += dt; } } },
},
NEW.N1,
{
  id: 'L3', name: 'Gearbot\'s Guess', emoji: '🤖', skill: 'ai', skillLabel: 'Basics of AI',
  map: ['###########', '#....G....#', '#.........#', '#.1.2.3.4.#', '#.........#', '#x...S..o.#', '#####E#####'],
  intro: 'Gearbot learns from examples, like an AI! 🤖 Look at the board ⬆️ and walk onto the pad that comes NEXT.',
  goal: 'Walk onto the pad that comes next ❓',
  hints: L => [L.round === 1 ? 'What color is each fruit? Match the new fruit the same way 🍋' : 'Count the blocks in each tower 🧱. How many more each time?', 'Gearbot finds the rule in the examples, then uses it. You can too!'],
  rounds: [
    { type: 'num', seq: [2, 4, 6], ans: 8, opts: [5, 8, 10, 7] },
    { type: 'sort', ex: [['🍎', '#e53935'], ['🍌', '#fdd835'], ['🥦', '#43a047']], q: '🍋', ans: '#fdd835', opts: ['#e53935', '#43a047', '#fdd835', '#3b82f6'] },
    { type: 'num', seq: [1, 3, 5], ans: 7, opts: [6, 9, 7, 8] },
  ],
  tracks: { '7-8': { rounds: [
    { type: 'num', seq: [3, 6, 12], ans: 24, opts: [15, 18, 24, 20] },
    { type: 'sort', ex: [['☀️', '#fdd835'], ['🌱', '#43a047'], ['💧', '#3b82f6']], q: '🌊', ans: '#3b82f6', opts: ['#e53935', '#43a047', '#fdd835', '#3b82f6'] },
    { type: 'num', seq: [1, 4, 9], ans: 16, opts: [12, 16, 14, 25] }],
    hints: L => [L.round === 1 ? 'Each example has a colour. Sun is yellow, plant is green, water is blue. Where does the sea go? 🌊' : L.round === 2 ? 'Try 1×1, 2×2, 3×3… what comes next? 🔢' : 'Look how each number grows. Is it adding, or doubling? ✖️', 'Gearbot finds the rule in the examples, then uses it. You can too!'] } },
  solid: c => c.t === 'G',
  setup(L) {
    L.round = 0; L.pads = []; L.disp = new THREE.Group(); world.add(L.disp);
    for (const row of grid) for (const c of row) {
      if (/[1-4]/.test(c.t)) { c.pad = +c.t; addPad(c); L.pads.push(c); }
      if (c.t === 'G') { const g = new THREE.Group(); const m = col => new THREE.MeshLambertMaterial({ color: col });
        mesh(m('#9aa7bd'), 0, 0.45, 0, 0.7, 0.7, 0.5, g); mesh(m('#1a2a4f'), 0, 0.5, 0.26, 0.5, 0.3, 0.02, g); mesh(new THREE.MeshBasicMaterial({ color: '#4fc3ff' }), -0.12, 0.52, 0.28, 0.1, 0.1, 0.02, g); mesh(new THREE.MeshBasicMaterial({ color: '#4fc3ff' }), 0.12, 0.52, 0.28, 0.1, 0.1, 0.02, g);
        mesh(m('#555'), 0, 0.95, 0, 0.06, 0.3, 0.06, g); mesh(M.gold, 0, 1.12, 0, 0.14, 0.14, 0.14, g); mesh(m('#7c8aa3'), -0.45, 0.45, 0, 0.16, 0.5, 0.16, g); mesh(m('#7c8aa3'), 0.45, 0.45, 0, 0.16, 0.5, 0.16, g);
        g.position.set(wx(c.x), 0, wz(c.z)); world.add(g); L.bot = g; }
    }
    this.showRound(L);
  },
  showRound(L) {
    const R = this.rounds[L.round]; L.disp.clear(); const z = wz(0) + 0.2; let y = 1.6;
    const board = mesh(M.dark, 0, 3.0, wz(0) - 0.1, 7.2, 2.0, 0.2, L.disp); y = 2.2;
    if (R.type === 'num') {
      R.seq.forEach((n, i) => { const s = cubeStack(n, '#f26b21', 0.16); s.position.set(-2.4 + i * 1.6, y, z); L.disp.add(s); const ns = numSprite(n, 0.45); ns.position.set(-2.4 + i * 1.6 + 0.45, y + 0.25, z + 0.1); L.disp.add(ns); });
      const q = sprite('❓', 0.8); q.position.set(2.4, y + 0.6, z); L.disp.add(q);
    } else {
      R.ex.forEach(([e, col], i) => { const s = sprite(e, 0.6); s.position.set(-2.6 + i * 1.6, y + 0.9, z); L.disp.add(s); const b = mesh(new THREE.MeshLambertMaterial({ color: col }), -2.6 + i * 1.6, y + 0.2, z, 0.4, 0.4, 0.4, L.disp); });
      const s = sprite(R.q, 0.6); s.position.set(2.4, y + 0.9, z); L.disp.add(s); const q = sprite('❓', 0.55); q.position.set(2.4, y + 0.2, z); L.disp.add(q);
    }
    const opts = shuffle(R.opts);
    L.pads.forEach((c, i) => {
      c.opt = opts[i]; if (c.show) world.remove(c.show); const g = new THREE.Group(); g.position.set(wx(c.x), 0.4, wz(c.z));
      if (R.type === 'num') { const s = cubeStack(c.opt, '#ffd23f', 0.12); g.add(s); const n = numSprite(c.opt, 0.4); n.position.y = c.opt * 0.12 + 0.3; g.add(n); }
      else { const b = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: c.opt, emissive: c.opt, emissiveIntensity: 0.3 })); b.scale.setScalar(0.45); b.position.y = 0.3; b.castShadow = true; g.add(b); }
      world.add(g); c.show = g; c.padObj.material = M.pad;
    });
    say(L.round === 1 ? 'New example! 🍎🍌🥦 Where does the 🍋 go?' : (L.round === 2 ? 'Last one! What comes next? ❓' : this.intro));
  },
  onEnter(c) {
    if (!c.pad) return; const R = this.rounds[L.round];
    if (c.opt === R.ans) {
      Sound.sfx('good'); burst(c.padObj.position.clone().setY(0.5), '#ffd23f', 16); L.rec.extra['r' + L.round] = L.rec.extra['r' + L.round] || 'ok';
      tween(0.8, k => { L.bot.rotation.y = k * Math.PI * 2; L.bot.position.y = Math.sin(k * Math.PI) * 0.5; });
      L.round++;
      if (L.round >= this.rounds.length) { L.disp.clear(); openGate(); say('Gearbot learned the rules! 🤖🎉 The gate is open ⬇️'); L.pads.forEach(p => { p.trigger = false; p.pad = 0; }); }
      else { L.locked = true; setTimeout(() => { this.showRound(L); backToStart(0); }, 900); }
    } else {
      L.rec.extra['r' + L.round] = 'miss'; const p = c.padObj; p.material = new THREE.MeshLambertMaterial({ color: '#ff4040' });
      failLevel('Gearbot says: Hmm, not quite! 🤖 Look at the board again.'); backToStart(800); setTimeout(() => p.material = M.pad, 900);
    }
  },
  update(L, dt, t) { bob(t); if (L.bot && !anims.length) L.bot.rotation.y = Math.sin(t / 800) * 0.3; },
},
{
  id: 'L5', name: 'Story Stones', emoji: '📖', skill: 'story', skillLabel: 'Storytelling',
  map: ['###########', '#....T....#', '#.........#', '#..1.2.3..#', '#b........#', '#*#.S...x#', '#####E#####'],
  intro: 'Put the story in order! 📖 Walk onto (or tap) the picture that comes FIRST. It flies into slot 1.',
  goal: 'Fill the slots: 1 FIRST ➜ 2 NEXT ➜ 3 LAST',
  hints: ['What happens at the very START of this life?', 'Things start small and grow bigger 🌱', 'Made a mistake? Press ↶ Undo and try again.'],
  tracks: { '7-8': { stories: [[['☀️', 'sun heats water'], ['☁️', 'clouds form'], ['🌧️', 'rain falls']], [['🧊', 'ice'], ['💧', 'water'], ['♨️', 'steam']], [['🌑', 'new moon'], ['🌓', 'half moon'], ['🌕', 'full moon']]],
    hints: ['What has to happen FIRST for the next step to happen?', 'Heat changes things step by step ☀️', 'Made a mistake? Press ↶ Undo and try again.'] } },
  stories: [[['🥚', 'egg'], ['🐣', 'chick'], ['🐔', 'hen']], [['seed', 'seed'], ['🌱', 'sprout'], ['🌳', 'tree']], [['🐛', 'caterpillar'], ['cocoon', 'cocoon'], ['🦋', 'butterfly']]],
  solid: c => c.t === 'T',
  setup(L) {
    L.round = 0; L.pads = []; L.placed = [];
    for (const row of grid) for (const c of row) {
      if (/[1-3]/.test(c.t)) { addPad(c); L.pads.push(c); }
      if (c.t === 'T') { mesh('log', wx(c.x), 0.4, wz(c.z), 0.6, 0.8, 0.6); const o = sprite('🦉', 1.1); o.position.set(wx(c.x), 1.35, wz(c.z)); world.add(o); L.owl = o; }
    }
    this.showRound(L);
  },
  async start(L) {
    // animated example before round 1
    L.locked = true;
    const ex = [['👶', 'baby'], ['🧒', 'kid'], ['🧑', 'grown-up']];
    await modal(`<h2>How to play 📖</h2><p class="story-text" style="font-size:19px">Stories go in order. Watch!</p><div class="seq demo">${[0, 1, 2].map(i => `<div class="slot" id="dx${i}"><div class="sc"></div><b>${i + 1}</b><span>${['FIRST', 'NEXT', 'LAST'][i]}</span></div>${i < 2 ? '<div class="arr">➜</div>' : ''}`).join('')}</div><div class="dcards" id="dcards">${[2, 0, 1].map(i => `<span id="dc${i}">${cardImg(ex[i][0], ex[i][1])}</span>`).join('')}</div><p id="dsay" class="story-text" style="min-height:30px;font-size:19px"></p><button class="btn" id="dAgain" style="background:#ddd;color:#1a2a4f">↻ Show again</button> <button class="btn primary" id="dGo" disabled>Got it! ▶</button>`, (el, done) => {
      const run = async () => { el.querySelector('#dGo').disabled = true; [0, 1, 2].forEach(i => { el.querySelector('#dx' + i + ' .sc').innerHTML = ''; el.querySelector('#dc' + i).style.visibility = 'visible'; }); el.querySelector('#dsay').textContent = '';
        for (let i = 0; i < 3; i++) { await sleep(900); el.querySelector('#dc' + i).style.visibility = 'hidden'; el.querySelector('#dx' + i + ' .sc').innerHTML = `<div class="fly">${cardImg(ex[i][0], ex[i][1])}</div>`; el.querySelector('#dsay').textContent = ['1 FIRST: a baby 👶', '2 NEXT: the baby grows into a kid 🧒', '3 LAST: the kid grows up 🧑'][i]; Sound.tone(440 + i * 160, 0.15, 'triangle', 0.2); }
        await sleep(500); el.querySelector('#dGo').disabled = false; };
      el.querySelector('#dAgain').onclick = run; el.querySelector('#dGo').onclick = () => done(); run();
    });
    L.locked = false; say(this.intro);
  },
  render(L) {
    panel(`<div class="seq">${[0, 1, 2].map(i => { const c = L.placed[i]; return `<div class="slot ${c ? 'full' : i === L.placed.length ? 'next' : ''}"><div class="sc">${c ? `<div class="fly">${cardImg(...c.st)}</div>` : '?'}</div><b>${i + 1}</b><span>${['FIRST', 'NEXT', 'LAST'][i]}</span></div>${i < 2 ? '<div class="arr">➜</div>' : ''}`; }).join('')}<button id="seqUndo" class="undo" ${L.placed.length ? '' : 'disabled'}>↶ Undo</button></div><div class="small2">Story ${L.round + 1} of 3</div>`);
    $('#seqUndo').onclick = () => this.undo(L);
  },
  showRound(L) {
    const st = this.stories[L.round]; const order = shuffle([0, 1, 2]); L.placed = [];
    L.pads.forEach((c, i) => { c.item = order[i]; c.st = st[c.item]; c.used = false; c.trigger = true; if (c.card) world.remove(c.card); c.card = cardSprite(c.st[0], c.st[1], 1.15); c.card.position.set(wx(c.x), 1.05, wz(c.z)); world.add(c.card); c.padObj.material = M.pad; });
    this.render(L);
  },
  place(L, c) {
    if (c.used || L.placed.length >= 3 || L.checking) return; c.used = true; L.placed.push(c); Sound.tone(440 + L.placed.length * 160, 0.15, 'triangle', 0.2); c.padObj.material = M.gold;
    const o = c.card; const a = o.position.clone(); tween(0.45, k => { o.position.set(a.x, a.y + k * 3, a.z); o.material.opacity = 1 - k; }, () => { o.visible = false; });
    this.render(L);
    if (L.placed.length === 3) this.check(L);
  },
  undo(L) { if (L.checking) return; const c = L.placed.pop(); if (!c) return; Sound.sfx('click'); c.used = false; c.padObj.material = M.pad; c.card.visible = true; c.card.material.opacity = 1; c.card.position.set(wx(c.x), 1.05, wz(c.z)); L.rec.extra.undos = (L.rec.extra.undos || 0) + 1; this.render(L); },
  check(L) {
    L.checking = true; const ok = L.placed.every((c, i) => c.item === i);
    if (ok) {
      Sound.sfx('good'); tween(0.6, k => L.owl.position.y = 1.35 + Math.sin(k * Math.PI) * 0.6); document.querySelectorAll('#panel .slot').forEach(s2 => s2.classList.add('win'));
      L.round++;
      if (L.round >= this.stories.length) { L.pads.forEach(p => { p.trigger = false; }); openGate(); say('You are a Story Master! 🦉📖 The gate is open ⬇️'); }
      else { say('Hoo-hoo! 🦉 Perfect order! Here comes the next story…', 2500); L.locked = true; setTimeout(() => { L.checking = false; this.showRound(L); backToStart(0); }, 1500); }
    } else {
      L.rec.extra['miss' + L.round] = 1; failLevel('Hmm, not quite! 🦉 Which one comes at the very START?'); document.querySelectorAll('#panel .slot').forEach(s2 => s2.classList.add('shake'));
      L.locked = true; setTimeout(() => { L.checking = false; L.placed.slice().reverse().forEach(() => { const c = L.placed.pop(); c.used = false; c.padObj.material = M.pad; c.card.visible = true; c.card.material.opacity = 1; c.card.position.set(wx(c.x), 1.05, wz(c.z)); }); this.render(L); backToStart(0); }, 1400);
    }
  },
  onEnter(c) { if (c.item === undefined || !c.trigger) return; this.place(L, c); },
  onPointer(L, ray) { const cs = L.pads.filter(c => !c.used && c.card.visible); const hit = ray.intersectObjects(cs.map(c => c.card), false)[0]; if (hit) { const c = cs.find(q => q.card === hit.object); this.place(L, c); return true; } return false; },
  update(L, dt, t) { bob(t); if (L.owl) L.owl.material.rotation = Math.sin(t / 500) * 0.1; L.pads.forEach((c, i) => { if (c.card && !c.used) c.card.position.y = 1.05 + Math.sin(t / 350 + i) * 0.08; }); },
},
NEW.W1,
{
  id: 'L4', name: 'Crate Crush', emoji: '📦', skill: 'logic', skillLabel: 'Planning',
  map: ['##########', '#S...#...#', '#.C..#.o.#', '#..C...PP#', '#....#...#', '#x...#...#', '#######E##'],
  tracks: { '7-8': { map: ['##########', '#S...#...#', '#..C.#.o.#', '#.#C...P.#', '#....#.#P#', '#x.#.#...#', '#######E##'], intro: 'Push the 📦 crates onto the 🟨 plates. This one is TIGHT: plan every push!', hints: ['You can only push, never pull. One wrong push can trap a crate.', 'One plate is around a corner. Which crate should go there first? 🤔', 'Stuck? Press ↺ Reset and try a new order.'] } },
  intro: 'Push the 📦 crates onto the 🟨 yellow plates to open the gate!',
  goal: 'Push both 📦 onto the 🟨 plates. Stuck? Press ↺ Reset',
  hints: ['Walk into a crate to push it ➡️', 'You can only push, never pull. Think before you push!', 'Get behind a crate and line it up with the plates 🟨'],
  setup(L) {
    L.crates0 = []; L.plates = [];
    for (const row of grid) for (const c of row) {
      if (c.t === 'C') { c.t = '.'; L.crates0.push([c.x, c.z]); }
      if (c.t === 'P') { c.t = '.'; c.plate = mesh('plate', wx(c.x), 0.02, wz(c.z), 0.9, 0.05, 0.9); L.plates.push(c); }
    }
    this.placeCrates(L); show('#btnReset', true);
  },
  placeCrates(L) {
    for (const row of grid) for (const c of row) if (c.crate) { world.remove(c.crate); c.crate = null; }
    L.crates0.forEach(([x, z]) => { const c = cell(x, z); c.crate = mesh('crate', wx(x), 0.45, wz(z), 0.9, 0.9, 0.9); });
  },
  reset(L, byUser) {
    if (L.solved) return; this.placeCrates(L); placePlayer(L.start[0], L.start[1]); L.plates.forEach(p => p.plate.material = M.plate);
    if (byUser) { L.rec.fails++; L.rec.attempts++; L.rec.firstTry = false; L.rec.extra.resets = (L.rec.extra.resets || 0) + 1; Sound.sfx('click'); say('Fresh start! 🔄 You\'ve got this.', 2500); }
  },
  onCrate() {
    let n = 0; L.plates.forEach(p => { if (p.crate) { n++; p.plate.material = M.gold; } else p.plate.material = M.plate; });
    if (n === L.plates.length && !L.solved) { L.solved = true; openGate(); show('#btnReset', false); say('Both plates pressed! 🎉 Walk to the gate ⬇️'); return; }
    if (n === 1) { Sound.sfx('good'); say('One down! 🙌 One more crate.', 2500); }
    // gentle stuck check: crate in a corner but not on a plate
    for (const row of grid) for (const c of row) if (c.crate && !c.plate) {
      const s = (dx, dz) => isSolid(cell(c.x + dx, c.z + dz)) && !(cell(c.x + dx, c.z + dz) || {}).crate;
      if ((s(0, -1) || s(0, 1)) && (s(-1, 0) || s(1, 0))) { say('Hmm, that crate looks stuck. Press ↺ Reset to try again!', 4000); const b = $('#btnReset'); b.style.transform = 'scale(1.15)'; setTimeout(() => b.style.transform = '', 600); }
    }
  },
  onEnter() { }, update: (L, dt, t) => bob(t),
},
NEW.P1,
NEW.O1,
{
  id: 'L6', name: 'Speaker\'s Stage', emoji: '🎤', skill: 'speaking', skillLabel: 'Public Speaking',
  map: ['###########', '#..sssss..#', '#..ssMss..#', '#.........#', '#.c.c.c.c.#', '#x...S...o#', '#####E#####'],
  floor: 'grass',
  intro: 'The crowd is waiting! 🎤 Walk onto the glowing microphone on the stage.',
  goal: 'Walk onto the 🎤 on the stage', noSkip: false,
  talk: { e1: '🪔', t1: 'Invite everyone to the Diwali mela!', p1: 'Type one line to invite the school.', ph: 'Hello everyone! Come to our Diwali mela...', ideas: ['Hello everyone! Please come to our Diwali mela on Friday!', 'Good morning friends! Our Diwali mela has games, sweets and diyas. Do come!', 'Namaste! Bring your family to the school Diwali mela!'],
    e2: '🌳', t2: 'Convince your class to plant trees!', p2: 'Which line will make your class say YES?', opts: [['Trees give us shade, fresh air and mangoes. Let us plant 10 trees this Saturday!', 1], ['Trees are trees.', 0], ['Plant trees or else!', 0]], tip: 'Hmm, that will not convince them. Which one gives good REASONS?' },
  tracks: { '7-8': { talk: { e1: '🏫', t1: 'Ask the principal to start a club!', p1: 'Type one line to tell the principal your idea.', ph: 'Good morning Ma\'am! I would like to start a ...', ideas: ['Good morning Ma\'am! May we start a science club? We will meet after school on Fridays.', 'Respected Sir, a coding club will help us learn new skills. Please allow us to start one.', 'Good morning! A reading club will help students read more books every week.'],
    e2: '❓', t2: 'A tough question from the audience!', p2: 'A student asks: "Won\'t a club waste our study time?" What is the BEST reply?', opts: [['Good question! We meet only once a week, and the club helps us learn too.', 1], ['No it won\'t. Next question.', 0], ['That is a silly question.', 0]], tip: 'Good speakers stay calm and polite and give a reason. Try again!' } } },
  hints: ['Walk up to the stage ⬆️ and step on the glowing 🎤', 'Good speakers look at people, speak clearly and smile 😊', 'The best answer is polite AND gives a reason 💡'],
  solid: c => c.t === 'c',
  trigger: c => c.t === 'M' && !L.spoke,
  setup(L) {
    L.crowd = []; L.spoke = false;
    for (const row of grid) for (const c of row) {
      if (c.t === 's' || c.t === 'M') mesh('plank', wx(c.x), 0.06, wz(c.z), 1, 0.12, 1);
      if (c.t === 'M') { const g = new THREE.Group(); g.position.set(wx(c.x), 0.12, wz(c.z)); mesh(new THREE.MeshLambertMaterial({ color: '#333' }), 0, 0.5, -0.35, 0.06, 1, 0.06, g); mesh(new THREE.MeshLambertMaterial({ color: '#888', emissive: '#f26b21', emissiveIntensity: 0.5 }), 0, 1.05, -0.35, 0.16, 0.2, 0.16, g); world.add(g); L.ring = mesh(new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.6 }), wx(c.x), 0.14, wz(c.z), 0.9, 0.02, 0.9); L.bang = bangSprite(wx(c.x), wz(c.z), 2.0); }
      if (c.t === 'c') { const p = blockyPerson(pick(['#e53935', '#43a047', '#3b82f6', '#8e24aa', '#fdd835', '#00acc1']), pick(['#e0b088', '#c98f65', '#8d5a3b', '#f1c9a5']), pick(['#222', '#5a3a20', '#ffd23f'])); p.position.set(wx(c.x), 0, wz(c.z)); p.rotation.y = Math.PI; world.add(p); L.crowd.push(p); }
    }
    // curtains
    [1.5, 9.5].forEach(x => mesh(new THREE.MeshLambertMaterial({ color: '#b3202f' }), wx(x), 1.2, wz(1), 0.4, 2.4, 0.4));
    mesh(new THREE.MeshLambertMaterial({ color: '#b3202f' }), wx(5), 2.4, wz(1), 8.4, 0.3, 0.4);
  },
  async onEnter(c) {
    if (c.t !== 'M' || L.spoke) return; L.locked = true; player.face = Math.PI; L.rec.extra.wrongPicks = 0;
    const cards = [['👀', 'Look at people', 1], ['🗣️', 'Speak loud and clear', 1], ['😊', 'Smile', 1], ['🙈', 'Hide your face', 0], ['📱', 'Look at your phone', 0], ['🤫', 'Whisper', 0]];
    await modal(`<h2>🎤 Make the crowd cheer!</h2><p class="story-text">Pick <b>3</b> things good speakers do.</p><div class="choices">${shuffle(cards).map(([e, t, g]) => `<button class="choice" data-g="${g}"><span class="em">${e}</span>${t}</button>`).join('')}</div><p id="spTip" class="small"></p>`, (el, done) => {
      let good = 0; el.querySelectorAll('.choice').forEach(b => b.onclick = () => {
        if (b.disabled) return; b.disabled = true;
        if (b.dataset.g === '1') { b.classList.add('sel'); good++; Sound.sfx('good'); L.crowd.forEach((p, i) => tween(0.3, k => p.position.y = Math.sin(k * Math.PI) * 0.3)); if (good === 3) setTimeout(() => done(), 500); }
        else { b.style.opacity = 0.4; b.innerHTML += ' ❌'; L.rec.extra.wrongPicks++; L.rec.fails++; L.rec.firstTry = false; Sound.sfx('wrong'); el.querySelector('#spTip').textContent = 'The crowd looks bored 😴. Try another!'; }
      });
    });
    const T = this.talk; const ideas = T.ideas;
    const res = await modal(`<h2>${T.e1} ${T.t1}</h2><p class="story-text">${T.p1}</p><input type="text" id="spLine" maxlength="120" placeholder="${T.ph}"><div id="spIdeas" class="choices hidden" style="margin-top:10px">${ideas.map(i => `<button class="choice" style="min-width:100%">${i}</button>`).join('')}</div><button class="btn" id="spHelp" style="background:#ddd;color:#1a2a4f">💡 Show ideas</button> <button class="btn primary" id="spGo">Speak 🎤</button>`, (el, done) => {
      let picked = false; const inp = el.querySelector('#spLine'); setTimeout(() => inp.focus(), 50);
      el.querySelector('#spHelp').onclick = () => { el.querySelector('#spIdeas').classList.remove('hidden'); };
      el.querySelectorAll('#spIdeas .choice').forEach(b => b.onclick = () => { inp.value = b.textContent; picked = true; });
      el.querySelector('#spGo').onclick = () => { if (!words(inp.value)) { inp.style.borderColor = '#f26b21'; inp.placeholder = 'Type a few words, or tap 💡 Show ideas'; return; } done({ line: inp.value.trim(), picked: picked && ideas.includes(inp.value.trim()) }); };
    });
    Sound.sfx('cheer'); L.crowd.forEach((p, i) => tween(0.8, k => { p.position.y = Math.abs(Math.sin(k * Math.PI * 2 + i)) * 0.3; }));
    say('Round 2 is harder! 💪 Choose the BEST answer.', 0); await sleep(600);
    const r2 = await modal(`<h2>${T.e2} ${T.t2}</h2><p class="story-text">${T.p2}</p><div class="choices">${shuffle(T.opts).map(([t, g]) => `<button class="choice" style="min-width:100%" data-g="${g}">${t}</button>`).join('')}</div><p id="spTip2" class="small"></p>`, (el, done) => {
      let tries = 0; el.querySelectorAll('.choice').forEach(b => b.onclick = () => { if (b.disabled) return; tries++;
        if (b.dataset.g === '1') { b.classList.add('sel'); Sound.sfx('good'); setTimeout(() => done({ line: b.textContent, tries }), 500); }
        else { b.disabled = true; b.style.opacity = 0.4; L.rec.fails++; L.rec.firstTry = false; Sound.sfx('wrong'); el.querySelector('#spTip2').textContent = T.tip; } });
    });
    S.speech = { line: res.line, words: words(res.line), pickedIdea: res.picked, wrongPicks: L.rec.extra.wrongPicks, round2: r2.line, round2Tries: r2.tries }; L.rec.extra.round2Tries = r2.tries;
    L.spoke = true; world.remove(L.bang); L.ring.visible = false; Sound.sfx('cheer'); confetti(50);
    L.crowd.forEach((p, i) => tween(1.4, k => { p.position.y = Math.abs(Math.sin(k * Math.PI * 4 + i)) * 0.4; }));
    openGate(); say('The crowd loves you! 👏👏 Walk to the gate ⬇️'); L.locked = false;
  },
  update(L, dt, t) { bob(t); if (L.ring) L.ring.material.opacity = 0.35 + Math.sin(t / 200) * 0.25; },
},
NEW.G1,
NEW.N5,
NEW.S1,
{
  id: 'L7', name: 'Pattern Builder', emoji: '🧱', skill: 'creativity', skillLabel: 'Pattern Copy (hard)',
  map: ['..........', '..........', '..........', '..........', '..........', '..........', '..........'],
  intro: 'PATTERN BUILDER! 🧱 Remember the picture: after 5 seconds most squares hide. Each right block uncovers its square! Pick a colour, then tap a square.',
  goal: 'Make your grid look EXACTLY like the picture ⏱️', noWalk: true, noSkip: true, ownTimer: true,
  hints: ['Look at the picture row by row and say the colours in your head 🧠', 'Green ✅ = right colour. Tap a square again to change it.', 'Peek 👀 costs 8 seconds. Use it when you are stuck.', 'Mirror round: left becomes right, like in a mirror 🪞'],
  cols: { R: ['#e53935', 'Red'], Y: ['#ffd23f', 'Yellow'], B: ['#3b82f6', 'Blue'], G: ['#2fa86b', 'Green'], O: ['#f26b21', 'Orange'], W: ['#f5f5f5', 'White'], P: ['#b46bff', 'Purple'] },
  peekCost: 8, showSec: 5,
  pats: [{ name: 'Mango Tile', time: 60, g: ['GYG', 'YOG', 'GGY'], decoy: 'BR' }, { name: 'Kite', time: 75, g: ['BRRB', 'RYYR', 'RYOR', 'BRRB'], decoy: 'GW' }, { name: 'Mirror Flag', time: 85, mirror: true, g: ['ORRY', 'OBRY', 'OBBY', 'GGGY'], decoy: 'PW' }],
  tracks: { '7-8': { pats: [{ name: 'Kite', time: 70, g: ['BRRB', 'RYYR', 'RYOR', 'BRRB'], decoy: 'GWP' }, { name: 'Rangoli', time: 90, g: ['OGPGO', 'GPYPG', 'PYRYP', 'GPYPG', 'OGPGO'], decoy: 'WB' }, { name: 'Mirror Fort', time: 105, mirror: true, g: ['RRYBB', 'ROYGB', 'OOYGG', 'ROYGB', 'RRYBB'], decoy: 'WP' }] } },
  setup(L) {
    L.round = -1; L.results = []; L.mat = null; L.grp = new THREE.Group(); world.add(L.grp);
    mesh('stone', wx(7.5), 0.4, wz(3), 2.6, 0.8, 0.6); L.stand = new THREE.Group(); L.stand.position.set(wx(7.5), 2.3, wz(3)); world.add(L.stand);
    show('#buildBar', true); document.body.classList.add('pattern'); L.rec.t0 = now(); this.nextRound(L);
  },
  cleanup(L) { show('#buildBar', false); document.body.classList.remove('pattern'); },
  nextRound(L) {
    L.round++; L.grp.clear(); L.stand.clear(); if (L.round >= this.pats.length) return this.finish(L);
    const P = this.pats[L.round], n = P.g.length; L.P = P; L.n = n; L.cells = []; L.tLeft = P.time; L.ended = false; L.rt0 = now();
    const x0 = 3 - (n - 1) / 2, z0 = 3 - (n - 1) / 2; // grid centred at (3,3)
    // target picture on the stand (big blocks, facing camera)
    const sz = 2.4 / n; const back = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: '#1a2a4f' })); back.scale.set(2.7, 2.7, 0.15); back.position.z = -0.1; L.stand.add(back);
    P.g.forEach((row, z) => row.split('').forEach((k, x) => { const b = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: this.cols[k][0] })); b.scale.set(sz * 0.92, sz * 0.92, 0.2); b.position.set((x - (n - 1) / 2) * sz, ((n - 1) / 2 - z) * sz, 0.05); L.stand.add(b); }));
    L.stand.rotation.x = -0.5; L.stand.scale.setScalar(0.01); tween(0.4, k => L.stand.scale.setScalar(k));
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) { const tile = mesh(new THREE.MeshLambertMaterial({ color: (x + z) % 2 ? '#d9b77e' : '#c9a36a' }), wx(x0 + x), 0.05, wz(z0 + z), 0.94, 0.1, 0.94, L.grp); tile.userData.pc = { x, z }; L.cells.push({ x, z, tile, want: P.mirror ? P.g[z][n - 1 - x] : P.g[z][x], have: null, blk: null }); }
    const fm = new THREE.MeshBasicMaterial({ color: '#f26b21' }); const cx = wx(3), cz = wz(3), h = n / 2 + 0.05;
    [[cx, cz - h, n + 0.2, 0.1], [cx, cz + h, n + 0.2, 0.1], [cx - h, cz, 0.1, n + 0.2], [cx + h, cz, 0.1, n + 0.2]].forEach(([x, z, sx, sz2]) => mesh(fm, x, 0.12, z, sx, 0.06, sz2, L.grp));
    const need = [...new Set(P.g.join(''))]; const dec = (P.decoy || '').split('').filter(k => !need.includes(k)); for (const k of shuffle(Object.keys(this.cols))) if (dec.length < 2 && !need.includes(k) && !dec.includes(k)) dec.push(k); const pal = shuffle([...need, ...dec]); L.mat = pal[0];
    // after the 5 s view the picture fades cell by cell to a few anchor cells; each right block uncovers its cell again
    L.covers = {}; L.cover = new THREE.Group(); const keepN = n <= 3 ? 4 : 5; const flat = P.g.join(''), keep = new Set(); for (const k of shuffle([...Array(n * n).keys()])) if (keep.size < 2 && ![...keep].some(q => flat[q] === flat[k])) keep.add(k); for (const k of shuffle([...Array(n * n).keys()])) if (keep.size < keepN) keep.add(k); const cvM = new THREE.MeshLambertMaterial({ color: '#1a2a4f' });
    for (let k = 0; k < n * n; k++) { if (keep.has(k)) continue; const x = k % n, z = Math.floor(k / n); const cv = new THREE.Mesh(BOX, cvM); cv.scale.set(sz * 0.96, sz * 0.96, 0.24); cv.position.set((x - (n - 1) / 2) * sz, ((n - 1) / 2 - z) * sz, 0.12); L.cover.add(cv); const q = sprite('❓', sz * 0.7); q.position.set(cv.position.x, cv.position.y, 0.3); L.cover.add(q); L.covers[k] = [cv, q]; }
    L.cover.visible = false; L.stand.add(L.cover);
    L.showT = this.showSec; L.peeks = 0; L.faded = false;
    const bar = $('#buildBar'); bar.innerHTML = pal.map(k => `<button data-c="${k}" class="pal ${k === L.mat ? 'sel' : ''}" style="background:${this.cols[k][0]}"><span>&nbsp;</span><small>${this.cols[k][1]}</small></button>`).join('') + `<button class="txt done" data-x="done">✅ Done</button>`;
    bar.querySelectorAll('button').forEach(b => b.onclick = () => { Sound.sfx('click'); if (b.dataset.c) { L.mat = b.dataset.c; bar.querySelectorAll('button').forEach(q => q.classList.remove('sel')); b.classList.add('sel'); } else if (!L.ended) this.endRound(L, 'done'); });
    panel(`<div class="bpanel"><b>Round ${L.round + 1}/${this.pats.length}: ${P.name}</b><span id="bpTime">⏱️ ${P.time}s</span><span id="bpMatch">✅ 0 / ${n * n}</span><button class="pk" id="bpPeek">👀 Peek (−${this.peekCost}s)</button></div><div class="mbar"><i id="bpBar"></i></div>${P.mirror ? '<div class="pbig">🪞 MIRROR ROUND: build the mirror image (flip left ↔ right)!</div>' : ''}`);
    $('#bpPeek').onclick = () => this.peek(L);
    say(P.mirror ? `Last one: ${P.name}! 🪞 Build it flipped, like in a mirror. Remember it: it hides in ${this.showSec} seconds!` : L.round ? `${P.name}: bigger and trickier! 🧠 Remember it fast.` : this.intro, 0);
  },
  set(L, x, z, k) {
    if (L.ended || L.locked) return; const c = L.cells.find(q => q.x === x && q.z === z); if (!c) return; k = k || L.mat;
    if (c.blk) L.grp.remove(c.blk); if (c.have === k) { c.have = null; c.blk = null; Sound.sfx('bump'); this.live(L); return; }
    c.have = k; const b = mesh(new THREE.MeshLambertMaterial({ color: this.cols[k][0] }), c.tile.position.x, 0.4, c.tile.position.z, 0.86, 0.6, 0.86, L.grp); b.userData.pc = { x, z }; c.blk = b;
    b.scale.setScalar(0.01); tween(0.2, q => b.scale.set(0.86 * (q + Math.sin(q * Math.PI) * 0.2), 0.6 * (q + Math.sin(q * Math.PI) * 0.3), 0.86 * (q + Math.sin(q * Math.PI) * 0.2)));
    if (k === c.want) { const pi = c.z * L.n + (L.P.mirror ? L.n - 1 - c.x : c.x); const cvp = L.covers && L.covers[pi]; if (cvp) { cvp.forEach(o => L.cover.remove(o)); delete L.covers[pi]; } const t = sprite('✅', 0.45); t.position.set(0, 0.75, 0); t.scale.set(0.5 / 0.86, 0.5 / 0.6, 1); b.add(t); burst(b.position, '#2fa86b', 6, 1.5); Sound.tone(600 + this.count(L) * 40, 0.1, 'triangle', 0.15); }
    else { Sound.sfx('place'); say('Hmm, look at the picture again for that square 👀', 1800); }
    this.live(L);
  },
  peek(L) { if (L.ended || L.locked || L.showT > 0) return; L.peeks++; L.tLeft -= this.peekCost; L.showT = 2; L.cover.visible = false; Sound.sfx('click'); L.rec.extra.peeks = (L.rec.extra.peeks || 0) + 1; },
  count(L) { return L.cells.filter(c => c.have === c.want).length; },
  live(L) { const ok = this.count(L), n2 = L.n * L.n; const e = $('#bpMatch'); if (e) e.textContent = `✅ ${ok} / ${n2}`; const b = $('#bpBar'); if (b) b.style.width = (100 * ok / n2) + '%'; if (ok === n2 && L.cells.every(c => c.have === c.want)) this.endRound(L, 'perfect'); },
  async endRound(L, why) {
    if (L.ended) return; L.ended = true; const ok = this.count(L), pct = Math.round(100 * ok / (L.n * L.n)), sec = Math.round(now() - L.rt0);
    L.results.push({ name: L.P.name, acc: pct, sec, limit: L.P.time, peeks: L.peeks }); if (L.cover) L.cover.visible = false; if (pct < 100) { L.rec.fails++; L.rec.firstTry = false; }
    if (pct === 100) { Sound.sfx('win'); confetti(80); L.cells.forEach((c, i) => { if (c.blk) { const b = c.blk; tween(0.9, k => b.position.y = 0.4 + Math.abs(Math.sin(k * Math.PI * 2 + i * 0.4)) * 0.6); } }); tween(0.9, k => L.stand.rotation.y = k * Math.PI * 2); }
    else Sound.sfx('good');
    await showBanner(pct === 100 ? `🎉 Perfect ${L.P.name}!` : why === 'time' ? `⏰ Time! ${pct}% right` : `${pct}% right! 👍`, 1600);
    this.nextRound(L);
  },
  onPointer(L, ray) { const hit = ray.intersectObjects(L.grp.children.filter(o => o.userData.pc), false)[0]; if (hit) { const { x, z } = hit.object.userData.pc; this.set(L, x, z); } return true; },
  async finish(L) {
    if (L.finishing) return; L.finishing = true; show('#buildBar', false); show('#panel', false);
    const res = await modal(`<h2>Pattern Builder done! 🏆</h2>${L.results.map(r => `<div class="rrow">${r.acc === 100 ? '🎯' : '🧱'} ${r.name}: <b>${r.acc}%</b> in ${r.sec}s</div>`).join('')}<input type="text" id="bWhy" maxlength="140" placeholder="Where could you use a pattern like this? (optional)"><button class="btn primary" id="bGo">Finish ✅</button>`, (el, done) => { el.querySelector('#bGo').onclick = () => done({ why: el.querySelector('#bWhy').value.trim() }); });
    const R = L.results; const acc = R.length ? R.reduce((a, r) => a + r.acc, 0) / R.length / 100 : 0; const timeFrac = R.length ? R.reduce((a, r) => a + (r.acc === 100 ? Math.max(0, 1 - r.sec / r.limit) : 0), 0) / R.length : 0;
    S.build = { rounds: R, acc: Math.round(acc * 100) / 100, timeFrac: Math.round(timeFrac * 100) / 100, perfect: R.filter(r => r.acc === 100).length, bonus: false, blocks: 0, materials: 0, height: 0, footprint: 0, type: 'pattern', name: R.map(r => r.name).join(' + '), why: res.why, whyWords: words(res.why), buildSec: Math.round(now() - L.rec.t0), grid: L.n };
    L.rec.extra = { ...S.build, rounds: R.map(r => `${r.name} ${r.acc}% ${r.sec}s`).join('; ') };
    confetti(60); Sound.sfx('cheer'); say('Promo LOVES your patterns! 😍', 2000); await sleep(1200); completeLevel();
  },
  update(L, dt, t) {
    if (L.stand && !L.ended) L.stand.position.y = 2.3 + Math.sin(t / 500) * 0.05;
    if (L.ended || L.finishing || L.locked || !L.P) return;
    if (L.showT > 0) { L.showT -= dt; if (L.showT <= 0 && L.cover) { L.cover.visible = true; if (!L.faded) { L.faded = true; Object.values(L.covers).forEach((pair, i) => pair.forEach(o => { const s0 = o.scale.clone(); o.scale.setScalar(0.001); setTimeout(() => { tween(0.25, k => o.scale.copy(s0).multiplyScalar(Math.max(0.001, k))); if (o.isSprite) Sound.tone(300 + i * 25, 0.05, 'triangle', 0.06); }, i * 90); })); } else Sound.sfx('click'); } } const pk = $('#bpPeek'); if (pk) pk.disabled = L.showT > 0;
    L.tLeft -= dt; const el = $('#bpTime'); if (el) { el.textContent = `⏱️ ${Math.max(0, Math.ceil(L.tLeft))}s`; el.classList.toggle('low', L.tLeft < 15); }
    if (L.tLeft <= 0) this.endRound(L, 'time');
  }
},
{
  id: 'L8', name: 'Shadow Golem', emoji: '👹', skill: 'boss', skillLabel: 'Final Boss! (very hard)', music: 'boss', floor: 'stone', camZ: -1.2, sky: '#3d3a63', skipFails: true,
  map: ['###############', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#......S......#', '###############'],
  intro: 'The Shadow Golem! 😱 Solve the 🔷 runes to break its shield, then grab 🔥 embers to hit it!',
  goal: 'Runes ➜ shield down ➜ grab 🔥. Dodge red tiles, waves, minions and falling rocks!',
  hints: ['Step on the 🔷 runes from SMALLEST to BIGGEST to break the shield.', 'Red tiles and red waves hurt. Step sideways out of the way!', 'Dark shadows on the floor = a rock is falling there. Move!', 'Minions 👾 chase you. Keep moving and lead them away.'],
  sp: 1, minions: 2,
  runes: [[3, 7, 12], [15, 9, 21], [18, 27, 24]], runeLabels: null,
  tracks: { '7-8': { sp: 1.3, minions: 3, runes: [[9, 8, 10], [16, 20, 12], [27, 30, 25]], runeLabels: [['3²', '2³', '10'], ['4²', '5×4', '√144'], ['3³', '6×5', '5²']],
    hints: ['Work out each rune first (3² = 9, 2³ = 8), then step from SMALLEST to BIGGEST.', 'Red waves travel toward you. Step sideways!', 'Shadows = falling rocks. Minions are faster here, keep moving!'] } },
  solid: c => !!c.hole,
  setup(L) {
    L.hearts = 3; L.phase = 1; L.hp = 9; L.atkT = 5; L.fightT = 0; L.paused = true; L.warn = null; L.inv = 0; L.redObjs = []; L.waves = []; L.mins = []; L.rocks = []; L.runeObjs = []; L.shield = true; L.holes = 0; L.minT = 4; L.rockT = 5; L.crT = 7;
    const g = new THREE.Group(); const dm = M.dark; L.eyeM = new THREE.MeshBasicMaterial({ color: '#c04dff' }); const eye = L.eyeM;
    mesh(dm, -0.8, 1, 0, 0.9, 2, 0.9, g); mesh(dm, 0.8, 1, 0, 0.9, 2, 0.9, g); const body = mesh(dm, 0, 3, 0, 3, 2.4, 1.6, g);
    const head = new THREE.Group(); head.position.set(0, 4.9, 0); g.add(head); mesh(dm, 0, 0, 0, 1.6, 1.4, 1.4, head); mesh(eye, -0.38, 0.1, 0.71, 0.36, 0.24, 0.05, head); mesh(eye, 0.38, 0.1, 0.71, 0.36, 0.24, 0.05, head);
    const aL = new THREE.Group(); aL.position.set(-1.9, 3.9, 0); g.add(aL); mesh(dm, 0, -1.1, 0, 0.8, 2.4, 0.8, aL);
    const aR = new THREE.Group(); aR.position.set(1.9, 3.9, 0); g.add(aR); mesh(dm, 0, -1.1, 0, 0.8, 2.4, 0.8, aR);
    [[-1, 3.6], [0.7, 2.4], [0.2, 3.9]].forEach(([x, y]) => mesh(new THREE.MeshBasicMaterial({ color: '#7a2fbf' }), x, y, 0.81, 0.3, 0.3, 0.02, g));
    L.shieldObj = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 12), new THREE.MeshBasicMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.25, depthWrite: false })); L.shieldObj.position.y = 3; g.add(L.shieldObj);
    g.position.set(0, 0, wz(0) - 1.3); world.add(g); L.golem = { g, head, aL, aR, body };
    L.golemLight = new THREE.PointLight('#b04dff', 3, 8); L.golemLight.position.set(0, 4, wz(0)); world.add(L.golemLight);
    L.onEmber = () => this.fireball(L);
    const bar = document.createElement('div'); bar.id = 'bossBar'; bar.innerHTML = '<span id="bossName">👹 Shadow Golem · Phase 1/3</span><div class="bb"><i id="bossHp"></i></div>'; document.body.appendChild(bar);
    show('#hearts', true); this.hearts(L); this.placeRunes(L);
  },
  cleanup(L) { const b = $('#bossBar'); if (b) b.remove(); const n = $('#golemNext'); if (n) n.remove(); },
  async start(L) {
    L.paused = true;
    await modal(`<h2>How to beat the Golem 👹</h2><p class="story-text" style="font-size:22px;font-weight:800;background:#fff3c4;color:#222;padding:10px 14px;border-radius:12px;border:3px solid #222">💡 Step on the 🔷 diamonds in order 1, 2, 3 (smallest number first). Collect the ⭐ stars and 🔥 fire, then defeat the Shadow Golem!</p><div class="howto">
      <div class="hstep"><div class="hart"><span class="big">🔷</span><span class="go">➜</span><span class="big">🛡️</span></div><b>1. Solve the runes</b><small>Step on them smallest ➜ biggest to break the shield</small></div>
      <div class="hstep"><div class="hart"><span class="hero">🧍</span><span class="go">➜</span><span class="big">🔥</span></div><b>2. Grab embers</b><small>3 hits per phase, 3 phases 💥</small></div>
      <div class="hstep"><div class="hart"><span class="mini-tile red"></span><span class="go">➜</span><span class="mini-tile"></span></div><b>3. Dodge!</b><small>Red tiles, waves, 👾 minions, falling-rock shadows</small></div>
    </div><p class="small">You have ❤️❤️❤️. Lose them all and you retry the SAME phase.</p><button class="btn primary huge" id="gGo">Got it - Start! ▶</button>`, (el, done) => el.querySelector('#gGo').onclick = done);
    L.paused = false; L.fightT = 0; L.atkT = 5; say('Phase 1! Step on the 🔷 runes from smallest to biggest to break the shield!', 5000);
  },
  hearts(L) { $('#hearts').textContent = '❤️'.repeat(Math.max(0, L.hearts)) + '🖤'.repeat(3 - Math.max(0, L.hearts)); const h = $('#bossHp'); if (h) h.style.width = (100 * L.hp / 9) + '%'; const n = $('#bossName'); if (n) n.textContent = `👹 Shadow Golem · Phase ${L.phase}/3${L.shield ? ' · 🛡️' : ' · shield DOWN!'}`; if (L.runeOrder) this.nextInd(L); },
  floorCells() { const a = []; for (const row of grid) for (const c of row) if (c.t === '.' && !c.hole) a.push(c); return a; },
  placeRunes(L) {
    L.runeObjs.forEach(o => world.remove(o)); L.runeObjs = []; for (const row of grid) for (const c of row) if (c.rune) { c.rune = null; c.trigger = false; }
    const vals = this.runes[L.phase - 1], labs = this.runeLabels ? this.runeLabels[L.phase - 1] : vals.map(String);
    const cs = shuffle(this.floorCells().filter(c => c.z >= 2 && c.z <= 7 && Math.abs(c.x - player.x) + Math.abs(c.z - player.z) >= 3)); const used = [];
    for (const c of cs) { if (used.length >= 3) break; if (used.some(u => Math.abs(u.x - c.x) + Math.abs(u.z - c.z) < 3)) continue; used.push(c); }
    L.runeOrder = [...vals].sort((a, b) => a - b); L.runeNext = 0;
    used.forEach((c, i) => { c.rune = { v: vals[i] }; c.trigger = true; const p = mesh(new THREE.MeshLambertMaterial({ color: '#3b82f6', emissive: '#3b82f6', emissiveIntensity: 0.9 }), wx(c.x), 0.05, wz(c.z), 0.95, 0.14, 0.95); const sg = golemRuneSprite(labs[i], 2.1); sg.position.set(wx(c.x), 1.25, wz(c.z)); world.add(sg); c.rune.p = p; c.rune.sg = sg; L.runeObjs.push(p, sg); });
    L.shield = true; L.shieldObj.visible = true; this.hearts(L);
  },
  nextInd(L) { let n = $('#golemNext'); if (!n) { n = document.createElement('div'); n.id = 'golemNext'; n.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:4;background:#0a0f2a;color:#fff;border:3px solid #7fe8ff;border-radius:14px;padding:6px 18px;font:900 26px Arial,sans-serif;text-shadow:0 2px 0 #000;pointer-events:none'; document.body.appendChild(n); } n.style.display = L.shield ? '' : 'none'; n.textContent = `🔷 Next: ${['1st (smallest)', '2nd', '3rd (biggest)'][L.runeNext] || ''}`; },
  onEnter(c) {
    if (!c.rune || c.rune.done || !L.shield) return; const D = L.def;
    if (c.rune.v === L.runeOrder[L.runeNext]) { c.rune.done = true; L.runeNext++; if (L.mins.length) { const m = L.mins.shift(); burst(m.o.position, '#7fd4ff', 14, 2); world.remove(m.o); } c.rune.p.material.color.set('#2fa86b'); c.rune.p.material.emissive.set('#2fa86b'); Sound.tone(500 + L.runeNext * 150, 0.15, 'triangle', 0.2); this.nextInd(L);
      if (L.runeNext >= 3) { L.shield = false; L.shieldObj.visible = false; Sound.sfx('gate'); burst(new THREE.Vector3(0, 3, wz(0) - 1.3), '#7fd4ff', 40, 5); say('🛡️💥 SHIELD DOWN! Grab the 🔥 embers and hit it!', 3000); D.hearts(L); setTimeout(() => { L.runeObjs.forEach(o => world.remove(o)); L.runeObjs = []; }, 600); D.spawnOrb(L); }
    } else { Sound.sfx('wrong'); say('Wrong order! 🔷 Start again: smallest ➜ biggest.', 2500); for (const row of grid) for (const q of row) if (q.rune) { q.rune.done = false; q.rune.p.material.color.set('#3b82f6'); q.rune.p.material.emissive.set('#3b82f6'); } L.runeNext = 0; this.nextInd(L); }
  },
  spawnOrb(L) {
    if (L.won || L.shield) return; const cs = this.floorCells().filter(c => !c.ember && !c.rune && Math.abs(c.x - player.x) + Math.abs(c.z - player.z) >= 3 && !(L.warn && L.warn.has(c)));
    const c = pick(cs); if (!c) return; addEmber(c); burst(c.obj.position, '#ffb02e', 10);
  },
  fireball(L) {
    Sound.sfx('fire'); const f = new THREE.Mesh(BOX, M.ember); f.scale.setScalar(0.5); world.add(f); const a = player.g.position.clone().setY(1), b = L.golem.g.position.clone().setY(4.2);
    tween(0.7, k => { f.position.lerpVectors(a, b, k); f.position.y += Math.sin(k * Math.PI) * 2.5; f.rotation.x += 0.3; }, () => {
      world.remove(f); burst(b, '#ff7a1a', 30, 4); Sound.sfx('hit'); shake(0.3); L.hp--; this.hearts(L);
      L.golem.body.material = new THREE.MeshBasicMaterial({ color: '#ffffff' }); setTimeout(() => L.golem.body.material = M.dark, 150);
      if (L.hp <= 0) return this.win(L);
      if (L.hp % 3 === 0) return this.nextPhase(L);
      say(`HIT! 🔥💥 ${L.hp % 3} more this phase!`, 2000); setTimeout(() => this.spawnOrb(L), 700);
    });
  },
  async nextPhase(L) {
    L.phase++; this.clearAll(L); L.paused = true; Sound.sfx('slam'); shake(0.5);
    if (L.phase === 3) { L.eyeM.color.set('#ff2d2d'); L.golemLight.color.set('#ff3030'); scene.background = new THREE.Color('#4a2030'); }
    await showBanner(L.phase === 2 ? '👹 Phase 2: FASTER! Minions + falling rocks!' : '👹😡 Phase 3: ENRAGED! The floor is crumbling!', 1800);
    L.phaseStart = { hp: L.hp }; this.placeRunes(L); L.atkT = 3; L.minT = 2; L.rockT = 3; L.crT = 4; L.paused = false;
    say('Shield is back! 🔷 Solve the new runes: smallest ➜ biggest.', 3500);
  },
  clearAll(L) { this.clearRed(L); L.waves.forEach(w => { world.remove(w.o); world.remove(w.lane); }); L.waves = []; L.mins.forEach(m => world.remove(m.o)); L.mins = []; L.rocks.forEach(r => { world.remove(r.sh); if (r.o) world.remove(r.o); }); L.rocks = []; for (const row of grid) for (const c of row) if (c.ember) { world.remove(c.obj); c.ember = false; } },
  clearRed(L) { L.redObjs.forEach(o => world.remove(o)); L.redObjs = []; L.warn = null; },
  hurt(L, why) {
    if (L.inv > 0 || L.won || L.paused) return; const H = window.__pqHurt = window.__pqHurt || {}; H[why] = (H[why] || 0) + 1; L.hearts--; L.inv = 1.3; Sound.sfx('hurt'); shake(0.2); this.hearts(L); tween(0.6, k => player.g.visible = Math.floor(k * 8) % 2 === 0, () => player.g.visible = true);
    if (L.hearts <= 0) { this.lose(L); return; } say(`Ouch! 💔 ${why}`, 1800);
  },
  attack(L) {
    const cs = this.floorCells(); const p = L.phase; const pats = [
      c => Math.abs(c.x - player.x) <= 1 && Math.abs(c.z - player.z) <= 1, c => c.z % 2 === (L.hp % 2), c => c.x % 2 === 1, c => (c.x + c.z) % 2 === 0, c => c.z === player.z || c.x === player.x];
    const f = p === 1 ? pick([pats[0], pats[0], pats[1]]) : pick(pats);
    L.warn = new Set(cs.filter(c => f(c) && !c.rune)); L.warnT = L.warnT0 = Math.max(1.3, (2.6 - 0.35 * p) / this.sp);
    L.warn.forEach(c => { const o = mesh(M.red, wx(c.x), 0.03, wz(c.z), 0.94, 0.04, 0.94); o.castShadow = false; L.redObjs.push(o); });
    Sound.sfx('warn');
  },
  slam(L) {
    Sound.sfx('slam'); shake(0.35); const pc = cell(player.x, player.z); const hit = L.warn && L.warn.has(pc); this.clearRed(L);
    if (hit) this.hurt(L, 'Step off the red tiles!'); if (L.hearts <= 0) return;
    // shockwave: a red wave rolls toward the player from the golem's x
    const x0 = Math.round(L.golem.g.position.x + (GW - 1) / 2); const o = mesh(M.red, wx(x0), 0.08, wz(1), 3, 0.12, 0.9); o.material = M.red; const lane = mesh(new THREE.MeshBasicMaterial({ color: '#ff2d2d', transparent: true, opacity: 0.16, depthWrite: false }), wx(x0), 0.02, (wz(1) + wz(GH - 2)) / 2, 3, 0.02, GH - 2); L.waves.push({ o, lane, x0, z: 1, delay: 0.9 });
    L.atkT = Math.max(1.6, (4.4 - L.phase * 0.7) / this.sp) + (L.phase === 3 ? 0 : 0.6);
    if (L.phase === 3) L.rockT = Math.min(L.rockT, 0.3); // combo: slam + rocks
  },
  dropRock(L) {
    const near = this.floorCells().filter(c => Math.abs(c.x - player.x) <= 2 && Math.abs(c.z - player.z) <= 2 && !c.rune); const n = L.phase === 3 ? 3 : 2;
    shuffle(near).slice(0, n).forEach(c => { const sh = mesh(new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.2, depthWrite: false }), wx(c.x), 0.05, wz(c.z), 0.9, 0.02, 0.9); L.rocks.push({ c, sh, t: 1.3 / Math.sqrt(this.sp) }); });
  },
  crumble(L) {
    if (L.holes >= 10) return; const cs = this.floorCells().filter(c => !c.rune && !c.ember && Math.abs(c.x - player.x) + Math.abs(c.z - player.z) >= 2 && c.z >= 1);
    for (const c of shuffle(cs)) { c.hole = true; if (!this.connected()) { c.hole = false; continue; } L.holes++; const o = mesh(M.dark, wx(c.x), -0.05, wz(c.z), 0.98, 0.12, 0.98); o.material = new THREE.MeshBasicMaterial({ color: '#0b0814' }); Sound.sfx('crumble'); burst(new THREE.Vector3(wx(c.x), 0.1, wz(c.z)), '#6a5a7a', 10, 2); break; }
  },
  connected() { const fl = this.floorCells(); if (!fl.length) return true; const seen = new Set([fl[0]]); const q = [fl[0]]; while (q.length) { const c = q.shift(); for (const [dx, dz] of Object.values(DIRS)) { const n = cell(c.x + dx, c.z + dz); if (n && n.t === '.' && !n.hole && !seen.has(n)) { seen.add(n); q.push(n); } } } return seen.size === fl.length; },
  async lose(L) {
    L.locked = true; L.paused = true; failLevel(); player.queue = []; this.clearAll(L);
    await modal(`<h2>💥 The golem got you!</h2><p class="story-text">Heroes never give up! You will restart at <b>Phase ${L.phase}</b> 💪</p><button class="btn primary">Try again 🔥</button>`, (el, done) => el.querySelector('button').onclick = done);
    L.hearts = 3; L.hp = (3 - L.phase + 1) * 3; L.fightT = 0; placePlayer(L.start[0], L.start[1]); this.placeRunes(L); L.atkT = 4; L.minT = 3; L.rockT = 4; L.crT = 5; L.paused = false; L.locked = false; this.hearts(L);
  },
  async win(L) {
    L.won = true; L.locked = true; this.clearAll(L); const bb = $('#bossBar'); if (bb) bb.remove(); scene.background = new THREE.Color('#3d3a63'); Sound.sfx('boom'); shake(0.6);
    const G = L.golem.g; G.traverse(o => { if (o.isMesh) burst(o.getWorldPosition(new THREE.Vector3()), pick(['#3a3550', '#7a2fbf', '#c04dff']), 6, 4); });
    tween(1, k => { G.scale.setScalar(1 - k); G.rotation.z = k * 0.5; }, () => world.remove(G)); L.golemLight.intensity = 0;
    await showBanner('👹💥 Golem defeated!', 1600);
    const sky0 = new THREE.Color('#3d3a63'), sky1 = new THREE.Color('#ffb36b');
    tween(1.5, k => { scene.background.copy(sky0).lerp(sky1, k); scene.fog.color.copy(scene.background); });
    camTarget.set(0, 4, -26); camDist = 16; torchFire.visible = true; tween(1.2, k => { torchLight.intensity = 6 * k; torchFire.scale.setScalar(k); });
    Sound.sfx('win'); setTimeout(() => Sound.sfx('cheer'), 600);
    for (let i = 0; i < 5; i++) setTimeout(() => burst(new THREE.Vector3(rnd(-4, 4), rnd(6, 10), -30), pick(['#f26b21', '#ffd23f', '#ff4f8b', '#4fc3ff']), 24, 4), 300 + i * 350);
    await showBanner('🔥 The fire is back! 🔥', 2000);
    const hows = [['👀', 'I watched the red tiles'], ['🏃', 'I kept moving'], ['🔥', 'I grabbed embers fast'], ['🤔', 'I made a plan']];
    const res = await modal(`<h2>You saved Promethia! 🏆</h2><p class="story-text">How did you beat the golem?</p><div class="choices">${hows.map(([e, t]) => `<button class="choice" data-t="${t}"><span class="em">${e}</span>${t}</button>`).join('')}</div><input type="text" id="hLine" maxlength="140" placeholder="Tell a friend in one line (optional)"><button class="btn primary" id="hGo" disabled>See my badge 🏅</button>`, (el, done) => {
      let how = null; el.querySelectorAll('.choice').forEach(b => b.onclick = () => { how = b.dataset.t; el.querySelectorAll('.choice').forEach(q => q.classList.remove('sel')); b.classList.add('sel'); el.querySelector('#hGo').disabled = false; Sound.sfx('click'); });
      el.querySelector('#hGo').onclick = () => done({ how, line: el.querySelector('#hLine').value.trim() });
    });
    S.boss = { how: res.how, line: res.line, lineWords: words(res.line), heartsLeft: L.hearts };
    completeLevel();
  },
  update(L, dt, t) {
    if (L.won || L.paused || L.locked) return;
    const G = L.golem, D = this, sp = this.sp; G.head.rotation.y = Math.sin(t / 600) * 0.3; G.g.position.y = Math.sin(t / 400) * 0.05; L.inv -= dt; L.fightT += dt;
    if (L.shieldObj.visible) L.shieldObj.material.opacity = 0.2 + Math.sin(t / 200) * 0.08;
    // chase: the golem slides along the back wall to follow the player
    const tx = THREE.MathUtils.clamp(wx(player.x), -5, 5); G.g.position.x += (tx - G.g.position.x) * Math.min(1, dt * 0.5 * L.phase * sp); L.golemLight.position.x = G.g.position.x;
    if (L.warn) { L.warnT -= dt; const k = Math.max(0, L.warnT); G.aL.rotation.x = G.aR.rotation.x = -Math.min(1, (L.warnT0 - k) / L.warnT0 * 1.5) * 2.2; L.redObjs.forEach(o => o.material.opacity = 0.35 + Math.abs(Math.sin(t / (k < 0.8 ? 60 : 140))) * 0.45); if (L.warnT <= 0) { G.aL.rotation.x = G.aR.rotation.x = 0; this.slam(L); } }
    else { L.atkT -= dt; if (L.atkT <= 0) this.attack(L); }
    // shockwaves roll forward
    L.waves = L.waves.filter(w => { if (w.delay > 0) { w.delay -= dt; return true; } w.z += dt * 2.4 * sp; w.o.position.z = wz(w.z); if (Math.round(w.z) === player.z && Math.abs(player.x - w.x0) <= 1) this.hurt(L, 'Jump sideways out of the red wave!'); if (w.z > GH - 1) { world.remove(w.o); world.remove(w.lane); return false; } return true; });
    if (L.phase >= 2) {
      L.minT -= dt; if (L.minT <= 0 && L.mins.length < this.minions) { const c = pick(this.floorCells().filter(c => c.z === 1)); if (c) { const o = new THREE.Group(); mesh(M.dark, 0, 0.3, 0, 0.55, 0.55, 0.55, o); const e = sprite('👾', 0.5); e.position.y = 0.85; o.add(e); o.position.set(wx(c.x), 0, wz(c.z)); world.add(o); L.mins.push({ o, x: c.x, z: c.z, t: 0, life: 8 }); } L.minT = 5.5 / sp; }
      L.mins = L.mins.filter(m => { m.t += dt; m.life -= dt; if (m.t > 0.95 / sp) { m.t = 0; const dx = Math.sign(player.x - m.x), dz = Math.sign(player.z - m.z); const opts = [[dx, 0], [0, dz]].filter(([a, b]) => (a || b) && (() => { const n = cell(m.x + a, m.z + b); return n && n.t === '.' && !n.hole; })()); if (opts.length) { const [a, b] = pick(opts); m.x += a; m.z += b; } }
        m.o.position.x += (wx(m.x) - m.o.position.x) * Math.min(1, dt * 8); m.o.position.z += (wz(m.z) - m.o.position.z) * Math.min(1, dt * 8);
        if (m.x === player.x && m.z === player.z) { this.hurt(L, 'A minion 👾 caught you. Keep moving!'); burst(m.o.position, '#5a4a7a', 10); world.remove(m.o); return false; }
        if (m.life <= 0) { burst(m.o.position, '#5a4a7a', 8); world.remove(m.o); return false; } return true; });
      L.rockT -= dt; if (L.rockT <= 0) { this.dropRock(L); L.rockT = (L.phase === 3 ? 4 : 5) / sp; }
    }
    L.rocks = L.rocks.filter(r => { r.t -= dt; r.sh.material.opacity = Math.min(0.75, 0.2 + (1.3 - r.t) * 0.5); if (r.t <= 0 && !r.o) { r.o = mesh('stone', wx(r.c.x), 6, wz(r.c.z), 0.8, 0.8, 0.8); r.fall = 0; }
      if (r.o) { r.fall += dt; r.o.position.y = Math.max(0.4, 6 - r.fall * r.fall * 40); if (r.o.position.y <= 0.4 && !r.landed) { r.landed = true; Sound.sfx('bump'); burst(r.o.position, '#8a8a9a', 8, 2); if (player.x === r.c.x && player.z === r.c.z) this.hurt(L, 'A rock fell on you! Watch the shadows.'); r.end = 0.5; }
        if (r.landed) { r.end -= dt; if (r.end <= 0) { world.remove(r.o); world.remove(r.sh); return false; } } } return true; });
    if (L.phase === 3) { L.crT -= dt; if (L.crT <= 0) { this.crumble(L); this.crumble(L); L.crT = 5 / sp; } }

  },
},
];

/* ================= SCORING ================= */
const TOTAL_STARS = LEVELS.reduce((n, d) => n + d.map.join('').split('').filter(ch => ch === '*' || ch === 'x').length, 0);
const PUZZLES = ['L2', 'L3', 'L4', 'L5', 'L6', 'N1', 'N5', 'W1', 'P1', 'O1', 'S1'];
function computeScores() {
  const lv = S.levels.filter(Boolean); const byId = Object.fromEntries(lv.map(l => [l.id, l]));
  // Problem-solving (35): 10 puzzle islands; full marks for solving, small deductions per extra try / hint
  const ps = PUZZLES.map(id => { const l = byId[id]; if (!l || !l.completed) return 0; return Math.max(0.4, 1 - 0.1 * l.fails - 0.12 * l.hints); });
  const problem = 35 * ps.reduce((a, b) => a + b, 0) / PUZZLES.length;
  // Persistence (20): finishing islands + coming back after a failure
  const done = lv.filter(l => l.completed).length; const failed = lv.filter(l => l.fails > 0); const recovered = failed.filter(l => l.completed).length;
  const persistence = 10 * done / LEVELS.length + 10 * (failed.length ? recovered / failed.length : 1);
  // Curiosity (15): secret stars + exploring
  const explore = lv.reduce((a, l) => a + l.explore, 0) - S.stars;
  const curiosity = 12 * Math.min(1, S.stars / (TOTAL_STARS * 0.75)) + Math.min(3, explore + (S.promoTaps > 0 ? 1 : 0));
  // Creativity (20): build challenge accuracy 8 + speed 2, bonus free build 4, Gadget Workshop invention 3 + explanation 3
  const b = S.build || {}, iv = S.invent || {}, tl = S.tale || {};
  const creativity = 8 * (b.acc || 0) + 2 * (b.timeFrac || 0) + (b.bonus ? 2 * Math.min(1, b.blocks / 15) + Math.min(1, b.materials / 4) : (b.type === 'pattern' ? 3 * (b.perfect || 0) / Math.max(1, (b.rounds || []).length) : 0)) + (b.name ? 1 : 0)
    + (iv.name ? 1.5 : 0) + (iv.words >= 4 ? 1.5 : iv.words ? 0.75 : 0) + (tl.who ? 1.5 : 0) + (tl.words >= 5 ? 1.5 : tl.words ? 0.75 : 0);
  // Communication (10): stage line 3, Word Turtle spelling accuracy 2, build reason 1.5, gadget explanation 1.5 + 1, boss reflection 1
  const sp = S.speech || {}, bo = S.boss || {}, vo = S.voice || {};
  const communication = (sp.words ? (sp.pickedIdea ? 1.5 : (sp.words >= 4 ? 3 : 2)) : 0) + 2 * (vo.ratio || 0) + (b.whyWords >= 4 ? 1.5 : b.whyWords ? 0.75 : 0) + (tl.words >= 5 ? 1.5 : tl.words ? 0.75 : 0) + (iv.words >= 4 ? 1 : iv.words ? 0.5 : 0) + (bo.how ? 0.5 : 0) + (bo.lineWords >= 3 ? 0.5 : bo.lineWords ? 0.25 : 0);
  const r = v => Math.round(Math.min(v, 1e9) * 10) / 10;
  const sc = { problem: r(problem), persistence: r(persistence), curiosity: r(Math.min(15, curiosity)), creativity: r(Math.min(20, creativity)), communication: r(Math.min(10, communication)) };
  sc.total = Math.round(sc.problem + sc.persistence + sc.curiosity + sc.creativity + sc.communication);
  const firstTry = PUZZLES.filter(id => byId[id] && byId[id].completed && byId[id].firstTry).length;
  return { sc, firstTry, puzzles: PUZZLES.length };
}
function titleFor(total) { return total >= 80 ? 'Legendary Torchbearer' : total >= 65 ? 'Torchbearer' : total >= 50 ? 'Flame Keeper' : 'Brave Spark'; }
function islandStars(l) { if (!l || !l.completed) return 0; if (l.costStars) return Math.max(1, Math.min(l.costStars, 3 - (l.fails >= 3 ? 1 : 0))); let s2 = 3; if (l.fails >= 1 || l.hints >= 1) s2--; if (l.fails >= 3 || l.hints >= 2) s2--; return Math.max(1, s2); }
function badgePool(totalSec) {
  const lv = S.levels.filter(Boolean); const by = Object.fromEntries(lv.map(l => [l.id, l])); const b = S.build || {};
  const hints = lv.reduce((a, l) => a + l.hints, 0); const explore = lv.reduce((a, l) => a + l.explore, 0);
  const pz = PUZZLES.map(id => by[id]).filter(l => l && l.completed); const avgT = pz.length ? pz.reduce((a, l) => a + l.time, 0) / pz.length : 999;
  const lvl = (id, f) => { const l = by[id]; return l && l.completed ? f(l) : 0; };
  const sp = S.speech || {}, bo = S.boss || {};
  const kind = /\b(hello|hi|happy|thank|thanks|friend|friends|welcome|love|glad|please|nice|great)\b/i.test(sp.line || '');
  return [
    ['fast', '⚡', 'Fast Thinker', 'Solved puzzles quickly', 30 / avgT],
    ['never', '💪', 'Never Give Up', 'Kept going after mistakes', lv.filter(l => l.fails > 0 && l.completed).length / 2],
    ['stars', '⭐', 'Star Seeker', 'Found secret stars', S.stars / Math.max(1, TOTAL_STARS * 0.6)],
    ['builder', '🧱', 'Perfect Builder', 'Copied the patterns exactly', (b.acc || 0) / 0.95 + (b.perfect && b.perfect === (b.rounds || []).length ? 0.1 : 0)],
    ['story', '📖', 'Story Master', 'Put every story in order', lvl('L5', l => 1.15 - 0.3 * l.fails - 0.2 * l.hints)],
    ['golem', '👹', 'Golem Slayer', 'Defeated the Shadow Golem', lvl('L8', l => l.skipped ? 0 : 1 + 0.03 * (bo.heartsLeft || 0))],
    ['ai', '🤖', 'AI Whisperer', 'Taught and fixed the robots', ['L3', 'N1', 'N5'].reduce((a, id) => a + lvl(id, l => l.fails === 0 && l.hints === 0 ? 1.12 : Math.max(0.3, 0.85 - 0.15 * l.fails)), 0) / 3],
    ['explorer', '🧭', 'Explorer', 'Peeked into hidden spots', explore / 4],
    ['planner', '🧠', 'Careful Planner', 'Solved logic with few resets', ['L2', 'L4', 'O1'].filter(id => by[id] && by[id].completed && by[id].fails <= 1).length / 3 * 1.05],
    ['nohint', '🦸', 'No-Hint Hero', 'Never needed a hint', hints === 0 ? 1.02 : 0.8 / hints],
    ['comeback', '🔄', 'Comeback Kid', 'Won after 2+ tries', Math.max(0, ...lv.filter(l => l.completed && !l.skipped).map(l => l.fails)) / 2],
    ['speed', '🏃', 'Speed Runner', 'Finished the quest fast', 780 / Math.max(1, totalSec)],
    ['kind', '💬', 'Kind Speaker', 'Spoke warmly on stage', sp.words ? (kind && sp.words >= 4 ? 1.08 : sp.words >= 4 ? 0.85 : 0.5) : 0],
    ['voice', '🐢', 'Word Wizard', 'Spelled words with few slips', (S.voice ? S.voice.ratio : 0) / 0.85],
    ['ember', '🔥', 'Ember Collector', 'Gathered lots of embers', S.embers / 12],
    ['inventor', '💡', 'Inventor', 'Invented a helpful gadget', S.invent ? (S.invent.words >= 4 ? 1.06 : 0.75) : 0],
    ['artist', '🎨', 'Pattern Pro', 'Copied every pattern in time', b.type === 'pattern' ? (b.perfect || 0) / Math.max(1, (b.rounds || []).length) * (0.9 + 0.3 * (b.timeFrac || 0)) : 0],
    ['untouch', '🛡️', 'Untouchable', 'Beat the Golem with all hearts', lvl('L8', () => (bo.heartsLeft || 0) / 3 * 1.1)],
    ['firsttry', '🎯', 'First-Try Champ', 'Solved puzzles on the first try', PUZZLES.filter(id => by[id] && by[id].completed && by[id].firstTry).length / (PUZZLES.length * 0.7)],
    ['tale', '🛠️', 'Gadget Explainer', 'Explained how the gadget helps', S.tale ? S.tale.words / 7 : 0],
  ].map(([id, e, n, d, v]) => ({ id, e, n, d, v: Math.round(Math.max(0, v || 0) * 100) / 100 }));
}
function topBadges(totalSec) {
  const pool = badgePool(totalSec); const key = x => Math.min(x.v, 1.5) + (['builder', 'untouch', 'voice', 'story', 'nohint'].includes(x.id) ? 0.12 : 0);
  const earned = pool.filter(x => x.v >= 1).sort((a, b) => key(b) - key(a)); const rest = pool.filter(x => x.v < 1).sort((a, b) => b.v - a.v);
  return earned.slice(0, 5).map(x => ({ ...x, earned: true })).concat(rest.slice(0, Math.max(0, 5 - earned.length)).map(x => ({ ...x, earned: false })));
}

/* ================= SAVING ================= */
function getArchive() { try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch (e) { return []; } }
function setArchive(a) { try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(a)); } catch (e) { } }
function levelLine(l) { return l ? `${l.time}s, tries ${l.attempts}, fails ${l.fails}, hints ${l.hints}, stars ${l.stars}, explore ${l.explore}, ${l.skipped ? 'SKIPPED' : l.completed ? 'done' : 'not done'}${l.firstTry ? ', first-try' : ''}` : 'not reached'; }
const SKILLS = [['problem', 'Problem-solving', 35], ['persistence', 'Persistence', 20], ['curiosity', 'Curiosity', 15], ['creativity', 'Creativity', 20], ['communication', 'Communication', 10]];
function goodAt(sc) { return SKILLS.map(([k, n, m]) => [n, sc[k] / m]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]).join(', '); }
function shortlisted(rec) { const band = rec.band || '5-6'; const same = getArchive().filter(r => !r.test && (r.band || '5-6') === band).map(r => r.scores.total).sort((a, b) => b - a); const rank = same.filter(t => t > rec.scores.total).length + 1; return rank <= 25 ? `Yes (top 25, Grade ${band})` : 'Not yet'; }
async function submitRecord(rec) {
  const url = CFG.SUBMIT_URL; if (!url) throw new Error('no url');
  const body = {
    _subject: `${rec.test ? 'TEST - ' : ''}Promethia Quest: ${rec.name} (G${rec.grade}${rec.section}) ${rec.scores.total}/100 ${rec.title}`,
    _template: 'table', _captcha: 'false',
    Name: rec.name, 'Grade/Section': `${rec.grade}${rec.section ? ' ' + rec.section : ''}`, 'Time taken': `${Math.floor(rec.totalSec / 60)} min ${rec.totalSec % 60} s`,
    'Overall performance': `${rec.scores.total}/100`, Title: rec.title, 'Good at': goodAt(rec.scores), Shortlisted: shortlisted(rec),
  };
  const post = async (u, b, ms) => {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(b), signal: ctl.signal });
      const j = await r.json().catch(() => ({})); if (!r.ok || j.success === 'false' || j.success === false) throw new Error(j.message || ('HTTP ' + r.status)); return j;
    } finally { clearTimeout(to); }
  };
  try { return await post(url, body, 8000); } catch (e) {
    if (!CFG.WEB3FORMS_KEY) throw e; console.warn('FormSubmit failed, using Web3Forms', e.message);
    const { _subject, _template, _captcha, ...fields } = body;
    return await post('https://api.web3forms.com/submit', { access_key: CFG.WEB3FORMS_KEY, subject: _subject, from_name: 'Promethia Quest', ...fields }, 15000);
  }
}
async function retryUnsent() {
  if (TEST) return; const a = getArchive(); let changed = false;
  for (const r of a) if (!r.sent && !r.test && !(r.tryAt && Date.now() - r.tryAt < 120000)) { try { await submitRecord(r); r.sent = true; r.sentAt = new Date().toISOString(); changed = true; } catch (e) { break; } }
  if (changed) setArchive(a);
}
window.PQ_submitRecord = submitRecord;
/* Supabase: instant save, with a localStorage queue for unsent rows */
const SB_QUEUE = 'pq_sbqueue';
function sbRow(rec) {
  return { name: rec.name, grade_section: `${rec.grade}${rec.section ? ' ' + rec.section : ''}`, score: rec.scores && rec.scores.total, title: rec.title,
    time_taken: `${Math.floor(rec.totalSec / 60)} min ${rec.totalSec % 60} s`, details: { ...rec, goodAt: rec.scores ? goodAt(rec.scores) : '' } };
}
async function sbInsert(row) {
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) throw new Error('no supabase');
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/quest_results`, { method: 'POST', headers: { apikey: CFG.SUPABASE_KEY, Authorization: `Bearer ${CFG.SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row), signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text().catch(() => '')));
  } finally { clearTimeout(to); }
}
function sbQ() { try { return JSON.parse(localStorage.getItem(SB_QUEUE) || '[]'); } catch (e) { return []; } }
function sbSetQ(q) { try { localStorage.setItem(SB_QUEUE, JSON.stringify(q)); } catch (e) { } }
async function sbSave(rec) {
  if (rec.test) return false; const row = sbRow(rec);
  for (let i = 0; i < 3; i++) { try { await sbInsert(row); return true; } catch (e) { console.warn('supabase failed', e.message); if (i < 2) await sleep(1200 * (i + 1)); } }
  const q = sbQ(); if (!q.some(x => x.details && x.details.id === rec.id)) { q.push(row); sbSetQ(q); } return false;
}
async function sbFlush() {
  const q = sbQ(); if (!q.length) return; const left = [];
  for (const row of q) { try { await sbInsert(row); } catch (e) { left.push(row); } }
  sbSetQ(left);
}
setTimeout(() => sbFlush().catch(() => { }), 2000);

/* ================= FINISH ================= */
// Grand finale: fly to a giant torch on the last island, ignite it, light up every island
async function grandFinale() {
  await fade(true); ['#hud', '#actions', '#dpad', '#promo', '#buildBar', '#panel', '#mapUI'].forEach(s2 => show(s2, false));
  buildOverworld(); setMode('map'); mapCam();
  const last = ISL.length - 1, P = ISL[last].pos.clone(); ISL.forEach((s2, i) => { s2.flame.visible = i < last; s2.lock.visible = false; setSign(i, 'done'); setBridge(i, true); });
  const g = new THREE.Group(); g.position.copy(P).add(new THREE.Vector3(0, 0, -0.6)); overworld.add(g);
  player.g.visible = true; player.queue = []; player.moving = false; player.g.position.copy(P).add(new THREE.Vector3(1.5, 0, 1.2)); player.face = 0; player.g.rotation.y = 0;
  mesh('stone', 0, 0.4, 0, 1.6, 0.8, 1.6, g); mesh('stone', 0, 0.95, 0, 1.2, 0.3, 1.2, g); mesh('log', 0, 2.4, 0, 0.6, 3.4, 0.6, g); [1.4, 3.2].forEach(y => mesh(M.gold, 0, y, 0, 0.7, 0.12, 0.7, g)); mesh(M.gold, 0, 4.0, 0, 1.3, 0.3, 1.3, g); mesh(M.gold, 0, 4.25, 0, 1.8, 0.3, 1.8, g); g.scale.setScalar(camera.aspect < 0.8 ? 1.2 : 1.5); if (ISL[last].sign) ISL[last].sign.visible = false;
  const fire = new THREE.Group(); fire.position.y = 4.5; g.add(fire); fire.scale.setScalar(0.01);
  [['#ff4f1a', 1.5, 0.9], ['#ff8a1a', 1.1, 1.6], ['#ffd23f', 0.7, 2.2], ['#fff3b0', 0.35, 2.6]].forEach(([c, w, h]) => { const f = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: c })); f.scale.set(w, h, w); f.position.y = h / 2; f.rotation.y = w; fire.add(f); });
  const light = new THREE.PointLight('#ffb35a', 0, 80); light.position.set(0, 7, 0); g.add(light);
  MC.follow = false; MC.target.copy(P).add(new THREE.Vector3(0, camera.aspect < 0.8 ? 6 : 7, 0)); const d0 = MC.dist; MC.dist = camera.aspect < 0.8 ? 17 : 17;
  camera.position.copy(P).add(new THREE.Vector3(0, 30, 24)); MC.look.copy(MC.target); // fly in from above
  const ov = document.createElement('div'); ov.id = 'finale'; ov.innerHTML = '<div class="fin-t">THE GREAT TORCH IS LIT! 🔥</div><div class="fin-s">You brought the light back to every island of Promethia ✨</div><div class="fin-tap">' + pcWords('tap to continue') + '</div>'; document.body.appendChild(ov);
  let skip; const skipP = new Promise(r => skip = r); ov.onclick = () => skip();
  const wait = ms => Promise.race([sleep(ms), skipP]);
  ov.classList.add('top'); await fade(false); await wait(1600);
  Sound.sfx('fire'); shake(0.4); fire.scale.setScalar(0.01); tween(0.7, k => { fire.scale.setScalar(0.01 + k * 1.2); light.intensity = 8 * k; });
  for (let i = 0; i < 6; i++) setTimeout(() => burst(g.position.clone().add(new THREE.Vector3(rnd(-1, 1), 6 + rnd(0, 2), rnd(-1, 1))), pick(['#f26b21', '#ffd23f', '#ff4f1a', '#fff3b0']), 30, 5), i * 220);
  if (!(scene.background && scene.background.isColor)) scene.background = new THREE.Color('#7ec8ff'); const sky0 = scene.background.clone(), sky1 = new THREE.Color('#ffcf8a'); tween(1.5, k => { scene.background.copy(sky0).lerp(sky1, k); if (scene.fog) scene.fog.color.copy(scene.background); });
  ISL.forEach((s2, i) => setTimeout(() => { s2.flame.visible = true; burst(s2.flame.getWorldPosition(new THREE.Vector3()), '#ffd23f', 14, 2); }, 300 + i * 90));
  ov.classList.add('show'); window.__pqTorchClose = true; await wait(2400); window.__pqTorchClose = false;
  // stay on the torch: pull back a little so the neighbouring lit islands show too, title stays at the top
  ov.classList.add('sub'); MC.dist = camera.aspect < 0.8 ? 26 : 24; MC.target.copy(P).add(new THREE.Vector3(0, 7.5, 0)); Sound.sfx('win'); setTimeout(() => Sound.sfx('star'), 700); confetti(120); setTimeout(() => confetti(80), 1500);
  window.__pqFinale = true; await wait(2600); ov.classList.add('out'); await sleep(400); ov.remove(); MC.dist = d0; MC.follow = true; fire.scale.setScalar(1.2);
}
async function finishGame() {
  L.locked = true; ['#hud', '#actions', '#dpad', '#promo', '#buildBar'].forEach(s => show(s, false));
  const endT = Date.now(); S.finishing = true; clearRun(); try { await grandFinale(); } catch (e) { console.warn(e); document.getElementById('finale')?.remove(); }
  const { sc, firstTry, puzzles } = computeScores(); const title = titleFor(sc.total);
  const rec = {
    id: 'PQ-' + Date.now().toString(36).toUpperCase(), test: TEST, name: S.student.name, school: S.student.school, band: S.band, grade: S.student.grade, section: S.student.section, pc: S.student.pc, avatar: S.avatar, hero: S.hero.name,
    startedAt: S.startedAt, finishedAt: new Date(endT).toISOString(), totalSec: Math.round((endT - new Date(S.startedAt).getTime()) / 1000),
    levels: S.levels.map(l => l && ({ costStars: l.costStars, id: l.id, name: l.name, skill: l.skill, time: l.time, attempts: l.attempts, fails: l.fails, hints: l.hints, stars: l.stars, explore: l.explore, embers: l.embers, completed: l.completed, skipped: l.skipped, firstTry: l.firstTry })),
    build: S.build, speech: S.speech, boss: S.boss, voice: S.voice, tale: S.tale, invent: S.invent, stars: S.stars, embers: S.embers, scores: sc, firstTry, puzzles, title, sent: false,
  };
  const top = topBadges(rec.totalSec); rec.badges = top.map(x => `${x.e} ${x.n}`); rec.badgeIds = top.map(x => x.id); rec.islandStars = LEVELS.map((d, i) => islandStars(S.levels[i]));
  const a = getArchive(); a.push(rec); setArchive(a);
  // results screen
  $('#badgeTitle').textContent = title; $('#resName').textContent = `${rec.name}, you are a`; const ra = $('#resAv'); if (ra) ra.className = 'avfig ' + (S.avatar || 'boy'); window.__pqRec = rec;
  $('#resLine').textContent = `🏆 ${title}! 🏆`;
  $('#resBadges').innerHTML = top.map((x, i) => `<div class="b5" style="animation-delay:${0.3 + i * 0.15}s"><span class="be">${x.e}</span><b>${x.n}</b><small>${x.d}</small></div>`).join('');
  const mm = Math.floor(rec.totalSec / 60), ss = rec.totalSec % 60;
  $('#resStats').innerHTML = `<div>🏆 ${sc.total}<small>score /100</small></div><div>⏱️ ${mm}:${String(ss).padStart(2, '0')}<small>time</small></div><div>⭐ ${rec.stars}/${TOTAL_STARS}<small>secret stars</small></div><div>🔥 ${rec.embers}<small>embers</small></div>`;
  const bars = [['🧩 Problem-solving', sc.problem, 35], ['💪 Persistence', sc.persistence, 20], ['🔍 Curiosity', sc.curiosity, 15], ['🎨 Creativity', sc.creativity, 20], ['🗣️ Communication', sc.communication, 10]];
  $('#resBars').innerHTML = bars.map(([n, v, m], i) => `<div class="bar"><span class="bn">${n}</span><span class="bt"><i style="--w:${Math.round(100 * v / m)}%;animation-delay:${0.2 + i * 0.12}s"></i></span><span class="bv">${v}/${m}</span></div>`).join('');
  $('#resIslands').innerHTML = LEVELS.map((d, i) => `<div class="isl1" title="${d.name}"><span>${d.emoji}</span><small>${i + 1}</small><b>${'★'.repeat(rec.islandStars[i])}<em>${'★'.repeat(3 - rec.islandStars[i])}</em></b></div>`).join('');
  show('#results'); Sound.sfx('win');
  $('#saveStatus').className = 'save'; $('#saveStatus').textContent = 'Saving… ⏳';
  const sbP = sbSave(rec).catch(() => false);
  let ok = false; { const a1 = getArchive(); const m1 = a1.find(r => r.id === rec.id); if (m1) { m1.tryAt = Date.now(); setArchive(a1); } }
  for (let i = 0; i < 2 && !ok; i++) { try { await submitRecord(rec); ok = true; } catch (e) { console.warn('submit failed', e.message); await sleep(1500); } }
  const a2 = getArchive(); const me = a2.find(r => r.id === rec.id); if (me) { me.sent = ok; if (ok) me.sentAt = new Date().toISOString(); setArchive(a2); }
  const sbOk = await sbP; ok = ok || sbOk;
  $('#saveStatus').className = 'save ok'; $('#saveStatus').textContent = ok ? 'Saved ✓' : 'Saved on this PC ✓ (email will retry later)';
  window.__pqDone = { ok, id: rec.id }; show('#btnNext');
}
$('#btnNext').onclick = () => {
  Object.keys(localStorage).forEach(k => { if (k !== ARCHIVE_KEY && k !== SB_QUEUE && k !== QUALITY_KEY && k !== SOUND_KEY) localStorage.removeItem(k); });
  try { sessionStorage.clear(); } catch (e) { }
  location.replace(location.pathname + location.search);
};

/* ================= START FLOW ================= */
const STORY = [
  ['🏰🔥', 'Long ago, the <b>Great Torch</b> of Promethia lit up the sky.'],
  ['👹🌑', 'But the <b>Shadow Golem</b> blew it out! Now the fort is dark.'],
  ['🦸🔥', 'You are a young hero. With <b>Promo</b>, collect the fire and <b>relight the torch!</b>'],
];
$('#startForm').addEventListener('submit', async e => {
  e.preventDefault(); Sound.init();
  if (!S.avatar) { show('#avErr', true); document.querySelector('.avpick').classList.add('shake'); setTimeout(() => document.querySelector('.avpick').classList.remove('shake'), 500); return; }
  S.student = { name: $('#fName').value.trim(), school: ($('#fSchool') ? $('#fSchool').value.trim() : '') || CFG.SCHOOL || '', grade: $('#fGrade').value, section: $('#fSection').value.trim().toUpperCase(), pc: $('#fPC').value.trim() };
  if (!S.student.name) return; S.band = bandFor(S.student.grade);
  show('#start', false); show('#story');
  let i = 0; const step = () => { $('#storyArt').textContent = STORY[i][0]; $('#storyText').innerHTML = STORY[i][1]; Sound.sfx('click'); };
  step(); $('#storyNext').onclick = () => { i++; if (i < STORY.length) step(); else { show('#story', false); pickHero(); } };
});
document.querySelectorAll('.av').forEach(b => b.onclick = () => { document.querySelectorAll('.av').forEach(q => q.classList.remove('sel')); b.classList.add('sel'); S.avatar = b.dataset.av; show('#avErr', false); Sound.init(); Sound.sfx('click'); });
async function pickHero() {
  // the avatar picked on the form is the hero everywhere (map, levels, golem, finale, results)
  S.hero = AVATARS[S.avatar] || AVATARS.boy; buildPlayer(S.hero); S.startedAt = new Date().toISOString();
  if (DEBUG && QS.get('level')) return startLevel(Math.max(0, Math.min(LEVELS.length - 1, (+QS.get('level')) - 1)));
  await earthZoom(); await showMap(-1, 0, true); startLevel(0);
}
function pickHeroOld() {
  show('#heroPick'); const box = $('#heroes');
  box.innerHTML = HEROES.map(h => `<button class="choice" data-id="${h.id}"><div class="sw" style="background:linear-gradient(${h.hair} 0 25%,${h.skin} 25% 50%,${h.shirt} 50% 80%,${h.pants} 80%)"></div>${h.name}</button>`).join('');
  box.querySelectorAll('.choice').forEach(b => b.onclick = () => { box.querySelectorAll('.choice').forEach(q => q.classList.remove('sel')); b.classList.add('sel'); S.hero = HEROES.find(h => h.id === b.dataset.id); $('#heroGo').disabled = false; Sound.sfx('click'); });
  $('#heroGo').onclick = async () => { show('#heroPick', false); buildPlayer(S.hero); S.startedAt = new Date().toISOString();
    if (DEBUG && QS.get('level')) return startLevel(Math.max(0, Math.min(LEVELS.length - 1, (+QS.get('level')) - 1)));
    await earthZoom(); await showMap(-1, 0, true); startLevel(0); };
}

/* ================= BOOT ================= */
// title: cinematic intro over space
buildDecor();
L = null; buildLevel({ map: ['.........', '.........', '.........', '.........', '.........'] }); GW = 9; GH = 5; fitCamera();
buildPlayer(HEROES[0]); placePlayer(4, 2); player.face = 0;
setMode('space');
applyQuality(); requestAnimationFrame(loop);
(function intro() {
  const cv = $('#introFx'), g = cv.getContext('2d'); let W, H; const fit = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; }; fit(); addEventListener('resize', fit);
  const N = quality === 'high' ? 160 : 60; const P = Array.from({ length: N }, () => ({ x: Math.random(), y: 1 + Math.random() * 0.5, v: rnd(0.05, 0.22), s: rnd(1, 3.5), c: pick(['#f26b21', '#ffd23f', '#ffb27f', '#ffffff']) }));
  let alive = true, t0 = performance.now();
  const tick = t => { if (!alive) return; requestAnimationFrame(tick); const dt = 1 / 60; g.clearRect(0, 0, W, H);
    for (const p of P) { p.y -= p.v * dt; p.x += Math.sin(t / 700 + p.s) * 0.0004; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); } g.globalAlpha = Math.min(1, (t - t0) / 800) * (0.4 + 0.6 * Math.abs(Math.sin(t / 300 + p.s))); g.fillStyle = p.c; g.fillRect(p.x * W, p.y * H, p.s, p.s); }
    g.globalAlpha = 1; };
  requestAnimationFrame(tick);
  SC.pos.set(0, 2, 60); tween(4.5, k => SC.pos.z = 60 - 24 * (1 - Math.pow(1 - k, 3)));
  const end = () => { if (!alive) return; alive = false; const l0 = SC.look.clone(), port = camera.aspect < 0.8; tween(1.2, k => SC.look.lerpVectors(l0, port ? new THREE.Vector3(0, 13, 0) : new THREE.Vector3(15, 0, 0), ease(k))); $('#intro').classList.add('out'); setTimeout(() => { show('#intro', false); }, 700); showStartOrResume(); };
  $('#introSkip').onclick = () => { Sound.init(); end(); }; setTimeout(end, TEST ? 1800 : 5200);
})();
retryUnsent();
if (DEBUG) {
  window.PQ = { get camera() { return camera; }, S, topBadges, badgePool, islandStars, get MODE() { return MODE; }, LEVELS, get L() { return L; }, win: () => completeLevel(), start: i => startLevel(i), cell, player, tryStep, get grid() { return grid; }, computeScores, findPath, go: (x, z) => { const p = findPath(x, z); if (p) player.queue = p; return !!p; } };
}

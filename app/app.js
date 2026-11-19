// THE GODPOSTER - cover engine (Session 2). One ES module, no imports, no network.
const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const ctx = stage.getContext('2d');

// ---------- layouts (relative rects in a unit square; panels[0] is the hero) ----------
const R = (x, y, w, h) => ({ x, y, w, h });
const col = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const grid = (c, r) => col(c * r, (i) => R((i % c) / c, Math.floor(i / c) / r, 1 / c, 1 / r));
const LAYOUTS = [
  { id: 'hero-left', name: 'HERO LEFT', title: null,
    panels: [R(0, 0, .56, 1), ...col(4, (i) => R(.56, i * .25, .44, .25))] },
  { id: 'hero-band', name: 'HERO BAND', title: R(0, .82, 1, .18),
    panels: [R(0, 0, 1, .58), ...col(3, (i) => R(i / 3, .58, 1 / 3, .24))] },
  { id: 'grid-6', name: 'GRID 6', title: null, panels: grid(3, 2) },
  { id: 'grid-9', name: 'GRID 9', title: null, panels: grid(3, 3) },
  { id: 'duo', name: 'DUO', title: null, panels: [R(0, 0, .5, 1), R(.5, 0, .5, 1)] },
  { id: 'solo', name: 'SOLO', title: null, panels: [R(0, 0, 1, 1)] },
  { id: 'title-band', name: 'TITLE BAND', title: R(0, .84, 1, .16),
    panels: [R(0, 0, 1, .7), R(0, .7, .5, .14), R(.5, .7, .5, .14)] },
];

// ---------- grades ----------
// stops: wash gradient; blend: composite mode; d: default [strength, contrast, saturation, grain, vignette]
const GRADES = [
  { id: 'vice-sunset', name: 'VICE SUNSET', stops: ['#ff2f92', '#ff8a2b', '#3b1a6e'], blend: 'soft-light', angle: 1, d: [70, 110, 125, 30, 45] },
  { id: 'neon-night', name: 'NEON NIGHT', stops: ['#00e5ff', '#6a2cff', '#ff2fd0'], blend: 'overlay', angle: 0, d: [65, 125, 130, 35, 60] },
  { id: 'golden-hour', name: 'GOLDEN HOUR', stops: ['#ffd36a', '#ff9a3c', '#8a3b12'], blend: 'soft-light', angle: 1, d: [75, 105, 115, 25, 35] },
  { id: 'duotone', name: 'DUOTONE PINK TEAL', stops: ['#ff2f92', '#1fd3c6'], blend: 'color', angle: 1, gray: true, d: [85, 125, 100, 30, 40] },
  { id: 'comic-ink', name: 'COMIC INK', stops: ['#ffe14a', '#ff3b6b'], blend: 'multiply', angle: 1, halftone: true, d: [35, 170, 140, 10, 25] },
  { id: 'omerta-noir', name: 'OMERTA NOIR', stops: ['#d9d2c0', '#2a2a2a'], blend: 'multiply', angle: 1, gray: true, d: [45, 140, 0, 55, 70] },
];

// ---------- state ----------
const SIZES = {
  landscape: { w: 1920, h: 1080, label: 'LANDSCAPE' },
  portrait: { w: 1080, h: 1350, label: 'PORTRAIT' },
  square: { w: 1080, h: 1080, label: 'SQUARE' },
};
const state = {
  photos: [],            // {img, name, url}
  assignment: [],        // photo index per panel (-1 = empty)
  panels: [],            // pixel rects of photo panels (export resolution)
  titleRect: null,       // pixel rect reserved for lettering (Session 3)
  transforms: [],        // per panel {dx, dy, zoom}; dx/dy relative to image size
  selectedPanel: 0,
  layoutId: 'hero-left',
  size: { ...SIZES.landscape },
  grade: { id: 'vice-sunset', strength: 70, contrast: 110, saturation: 125, grain: 30, vignette: 45 },
  texts: {
    title: 'PALM HEAT', subtitle: 'Loyalty is everything', tagline: 'ONE COAST - NO RULES - COMING SOON',
    quote: 'PURE VICE ENERGY', quoteSource: 'THE FAMILY GAZETTE',
    toggles: { quote: true },
  },
};
const layout = () => LAYOUTS.find((l) => l.id === state.layoutId);
const status = (m) => { $('#status').textContent = m; };

function recompute() {
  const { w, h } = state.size, L = layout();
  const px = (r) => ({ x: Math.round(r.x * w), y: Math.round(r.y * h), w: Math.round(r.w * w), h: Math.round(r.h * h) });
  state.panels = L.panels.map(px);
  state.titleRect = L.title ? px(L.title) : null;
  stage.width = w; stage.height = h;
}

// ---------- photo drawing ----------
function sourceWindow(img, r, t) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const s = Math.max(r.w / iw, r.h / ih) * t.zoom;
  const sw = r.w / s, sh = r.h / s;
  const cx = Math.min(iw - sw / 2, Math.max(sw / 2, iw / 2 + t.dx * iw));
  const cy = Math.min(ih - sh / 2, Math.max(sh / 2, ih / 2 + t.dy * ih));
  return { s, sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}

function drawPhoto(c, img, r, t) {
  const g = state.grade, P = GRADES.find((x) => x.id === g.id);
  const w = sourceWindow(img, r, t);
  // (a) contrast/saturate filter applied while drawing
  c.filter = `contrast(${g.contrast / 100}) saturate(${g.saturation / 100})${P.gray ? ' grayscale(1)' : ''}`;
  c.drawImage(img, w.sx, w.sy, w.sw, w.sh, r.x, r.y, r.w, r.h);
  c.filter = 'none';
  // (b) colour wash through the grade gradient
  if (g.strength > 0) {
    const gr = P.angle
      ? c.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h)
      : c.createLinearGradient(r.x, r.y + r.h, r.x + r.w, r.y);
    P.stops.forEach((s, i) => gr.addColorStop(i / (P.stops.length - 1), s));
    c.globalCompositeOperation = P.blend;
    c.globalAlpha = Math.min(1, g.strength / 100);
    c.fillStyle = gr; c.fillRect(r.x, r.y, r.w, r.h);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
}

// ---------- texture tiles ----------
let grainTile = null, dotTile = null;
function makeGrain() {
  const t = document.createElement('canvas'); t.width = t.height = 256;
  const x = t.getContext('2d'), d = x.createImageData(256, 256);
  let seed = 1337; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < d.data.length; i += 4) { const v = rnd() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return t;
}
function makeDots() {
  const t = document.createElement('canvas'); t.width = t.height = 10;
  const x = t.getContext('2d'); x.fillStyle = '#000'; x.beginPath(); x.arc(5, 5, 2.2, 0, 7); x.fill(); return t;
}

// ---------- render: photos, grade, texture, frame, dressing (fixed order) ----------
// opts.ui=false for export (no selection outline / empty-panel placeholders)
function render(c = ctx, W = state.size.w, H = state.size.h, opts = { ui: true }) {
  const ui = opts.ui !== false;
  const g = state.grade, P = GRADES.find((x) => x.id === g.id);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0b0e'; c.fillRect(0, 0, W, H);
  // 1+2 photos + grade, clipped per panel
  state.panels.forEach((r, i) => {
    const p = state.photos[state.assignment[i]];
    c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    if (p) drawPhoto(c, p.img, r, state.transforms[i]);
    else if (ui) {
      c.fillStyle = '#17171d'; c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = '#3a3a45'; c.font = `800 ${Math.min(r.w, r.h) * .25}px Impact, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('+', r.x + r.w / 2, r.y + r.h / 2);
    }
    c.restore();
  });
  // 3 texture: halftone (comic), vignette, grain
  state.panels.forEach((r) => {
    c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    if (P.halftone) {
      dotTile = dotTile || makeDots();
      c.globalAlpha = .22 * g.strength / 100; c.globalCompositeOperation = 'multiply';
      c.fillStyle = c.createPattern(dotTile, 'repeat'); c.fillRect(r.x, r.y, r.w, r.h);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    if (g.vignette > 0) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.hypot(r.w, r.h) / 2;
      const v = c.createRadialGradient(cx, cy, rad * .35, cx, cy, rad);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${.85 * g.vignette / 100})`);
      c.fillStyle = v; c.fillRect(r.x, r.y, r.w, r.h);
    }
    if (g.grain > 0) {
      grainTile = grainTile || makeGrain();
      c.globalCompositeOperation = 'overlay'; c.globalAlpha = .6 * g.grain / 100;
      c.fillStyle = c.createPattern(grainTile, 'repeat'); c.fillRect(r.x, r.y, r.w, r.h);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  });
  // 4 frame: reserved title band, gutters, outer border, selection (preview only)
  if (state.titleRect) { const t = state.titleRect; c.fillStyle = '#0b0b0e'; c.fillRect(t.x, t.y, t.w, t.h); }
  const gut = Math.max(3, Math.round(W / 320));
  c.strokeStyle = '#0b0b0e'; c.lineWidth = gut * 2;
  state.panels.forEach((r) => c.strokeRect(r.x, r.y, r.w, r.h));
  c.strokeStyle = '#e8b931'; c.strokeRect(0, 0, W, H);
  if (ui && state.panels[state.selectedPanel]) {
    const r = state.panels[state.selectedPanel];
    c.strokeStyle = '#ff2f92'; c.lineWidth = Math.max(4, W / 240); c.setLineDash([W / 60, W / 120]);
    c.strokeRect(r.x + gut * 2, r.y + gut * 2, r.w - gut * 4, r.h - gut * 4);
  }
  c.restore();
  // 5 dressing (Session 3)
  renderDressing(c, W, H, opts);
}
// ---------- dressing: lettering, tagline strip, microprint, barcode (Session 3) ----------
// All sizes are relative to the canvas width W. Draws nothing UI-related, so {ui:false} output is identical.
function seededRng(str) { // FNV-1a hash -> mulberry32, so the barcode is stable per title
  let h = 2166136261 >>> 0;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => {
    h = (h + 0x6D2B79F5) >>> 0; let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function starPath(c, cx, cy, R) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .42 : R;
    c[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
}
function renderDressing(c, W, H) {
  const T = state.texts, gut = Math.max(3, Math.round(W / 320));
  const k = state.size.w ? W / state.size.w : 1;               // titleRect is stored in state.size pixels
  const tr = state.titleRect
    ? { x: state.titleRect.x * k, y: state.titleRect.y * k, w: state.titleRect.w * k, h: state.titleRect.h * k } : null;
  const mx = W * .04, stripH = W * .052, bottom = H - gut - W * .006, stripTop = bottom - stripH;
  const GOLD = '#e8b931', CREAM = '#fff3d6';
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.setLineDash([]);

  // scrim + black band (only when no title rectangle is reserved by the layout)
  if (!tr) {
    const g = c.createLinearGradient(0, H * .82, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = g; c.fillRect(0, H * .82, W, H * .18);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(gut, stripTop - W * .004, W - gut * 2, H - gut - stripTop + W * .004);
  }

  // ---- title (Anton, auto-fit) ----
  const title = (T.title || '').trim();
  let baseY = stripTop - W * .004, titleTop = baseY, fs = 0, tx = 0, tw = 0;
  if (title) {
    const areaBottom = stripTop - W * .004, areaW = tr ? tr.w : W;
    const maxW = .92 * areaW, maxH = tr ? areaBottom - tr.y - W * .006 : Infinity;
    tx = (tr ? tr.x : 0) + .04 * areaW;
    let m;
    for (fs = .16 * W; fs > 8; fs -= Math.max(1, fs * .01)) {
      c.font = `${fs}px Anton, Impact, sans-serif`; m = c.measureText(title);
      if (m.width + fs / 13 <= maxW && m.actualBoundingBoxAscent + .16 * fs + fs / 26 <= maxH) break;
    }
    tw = m.width; const asc = m.actualBoundingBoxAscent;
    baseY = areaBottom - .16 * fs; titleTop = baseY - asc - fs / 26;
    c.font = `${fs}px Anton, Impact, sans-serif`; c.lineWidth = fs / 13;
    // 1 hard shadow, 2 stroke, 3 gradient fill
    c.fillStyle = c.strokeStyle = '#1a0b26';
    c.strokeText(title, tx + .006 * W, baseY + .008 * W); c.fillText(title, tx + .006 * W, baseY + .008 * W);
    c.strokeStyle = '#2b1030'; c.strokeText(title, tx, baseY);
    const g = c.createLinearGradient(0, baseY - asc, 0, baseY);
    g.addColorStop(0, '#fff3d6'); g.addColorStop(.55, '#ffb347'); g.addColorStop(1, '#ff5e3a');
    c.fillStyle = g; c.fillText(title, tx, baseY);

    // ---- subtitle (Yellowtail, overlapping lower-right) ----
    const sub = (T.subtitle || '').trim();
    if (sub) {
      let sfs = .42 * fs, sx = tx + .52 * tw; const limit = W * .96;
      c.font = `${sfs}px Yellowtail, cursive`; let sw = c.measureText(sub).width;
      if (sx + sw > limit) { sfs = Math.max(.28 * fs, sfs * (limit - sx) / sw); c.font = `${sfs}px Yellowtail, cursive`; sw = c.measureText(sub).width; }
      sx = Math.min(sx, limit - sw);
      c.save(); c.translate(sx, baseY + .06 * fs); c.rotate(-2 * Math.PI / 180);
      c.shadowColor = '#ff4fa3'; c.shadowBlur = .012 * W; c.fillStyle = '#ff4fa3'; c.fillText(sub, 0, 0);
      c.restore();
    }
  }

  // ---- quote line (stars + bold italic small caps), above the title ----
  const quote = (T.quote || '').trim(), qsrc = (T.quoteSource || '').trim();
  if (T.toggles.quote && (quote || qsrc)) {
    const q = .018 * W, y = titleTop - .016 * W, sp = .0215 * W;
    c.save(); c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = .006 * W;
    c.fillStyle = GOLD;
    for (let i = 0; i < 5; i++) { starPath(c, mx + sp * i + sp * .4, y - q * .36, .0088 * W); c.fill(); }
    c.font = `${q}px Anton, Impact, sans-serif`; c.fontVariantCaps = 'small-caps'; c.letterSpacing = `${q * .12}px`;
    c.translate(mx + sp * 5 + .004 * W, y); c.transform(1, 0, -.2, 1, 0, 0);   // synthetic italic
    c.strokeStyle = '#fff'; c.lineWidth = q / 40; c.fillStyle = '#fff';       // thin stroke = synthetic bold
    let x = 0;
    if (quote) { c.strokeText(quote, 0, 0); c.fillText(quote, 0, 0); x = c.measureText(quote).width; }
    if (qsrc) {
      if (quote) { c.fillStyle = '#fff'; c.fillText(' - ', x, 0); x += c.measureText(' - ').width; }
      c.fillStyle = c.strokeStyle = GOLD; c.strokeText(qsrc, x, 0); c.fillText(qsrc, x, 0);
    }
    c.restore();
  }

  // ---- tagline strip: gold rules + centred tagline, microprint, barcode ----
  const tag = (T.tagline || '').trim();
  if (tag) {
    const tf = .02 * W, ty = stripTop + .016 * W, ls = tf * .18;
    c.save(); c.font = `${tf}px Anton, Impact, sans-serif`; c.letterSpacing = `${ls}px`; c.textBaseline = 'middle';
    const w = c.measureText(tag).width - ls, x0 = W / 2 - w / 2;
    c.fillStyle = CREAM; c.fillText(tag, x0, ty);
    c.fillStyle = GOLD; const rh = Math.max(1, W * .0012), gap = .02 * W;
    c.fillRect(mx, ty - rh / 2, Math.max(0, x0 - gap - mx), rh);
    c.fillRect(x0 + w + gap, ty - rh / 2, Math.max(0, W - mx - (x0 + w + gap)), rh);
    c.restore();
  }
  c.save(); c.font = `${.008 * W}px Anton, Impact, sans-serif`; c.letterSpacing = `${.008 * W * .12}px`;
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.fillText('THE GODPOSTER - A COVER ART STUDIO - PRINTED FROM YOUR OWN PHOTOS - CAT. GP-2026', mx, bottom - .001 * W);
  c.restore();
  const rnd = seededRng(title || 'GODPOSTER'), u = Math.max(1, Math.round(.0011 * W)), bh = .02 * W;
  const bars = Array.from({ length: 40 }, () => 1 + Math.floor(rnd() * 3));
  let bx = W - mx - bars.reduce((a, b) => a + b * u + u, 0) + u;
  c.fillStyle = '#fff';
  for (const b of bars) { c.fillRect(bx, bottom - bh, b * u, bh); bx += b * u + u; }
  c.restore();
}

// ---------- assignment ----------
const fresh = () => ({ dx: 0, dy: 0, zoom: 1 });
function resetTransforms() { state.transforms = state.panels.map(fresh); }
function autoAssign() {
  const n = state.photos.length;
  state.assignment = state.panels.map((_, i) => (n ? i % n : -1));
}
function setLayout(id) {
  state.layoutId = id; recompute(); resetTransforms(); autoAssign();
  state.selectedPanel = 0; syncUI(); render();
  status(`Layout: ${layout().name} (${state.panels.length} panels).`);
}
function setSize(key) {
  state.size = { ...SIZES[key] }; recompute(); syncUI(); render();
  status(`Size: ${state.size.w}x${state.size.h} ${state.size.label}.`);
}

// ---------- photo loading ----------
function loadFile(file) {
  return new Promise((res) => {
    if (!file.type.startsWith('image/')) return res(null);
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => res({ img, name: file.name, url });
    img.onerror = () => res(null);
    img.src = url;
  });
}
async function addFiles(files) {
  const had = state.photos.length;
  const loaded = (await Promise.all([...files].map(loadFile))).filter(Boolean);
  if (!loaded.length) return status('No usable images found in that drop.');
  state.photos.push(...loaded);
  if (!had) autoAssign();
  else { // fill any empty panels with the new photos
    let k = had;
    state.assignment = state.assignment.map((a) => (a < 0 && k < state.photos.length ? k++ : a));
  }
  syncUI(); render();
  status(`Added ${loaded.length} photo${loaded.length > 1 ? 's' : ''} - ${state.photos.length} loaded.`);
}

// ---------- UI wiring ----------
function layoutThumb(L) {
  const mk = (r, cls) => `<rect class="${cls}" x="${r.x * 100 + .8}" y="${r.y * 60 + .8}" width="${r.w * 100 - 1.6}" height="${r.h * 60 - 1.6}"/>`;
  const rects = L.panels.map((r, i) => mk(r, i ? '' : 'h'));
  if (L.title) rects.push(mk(L.title, 't'));
  return `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">${rects.join('')}</svg>`;
}
function buildStatic() {
  $('#layouts').innerHTML = LAYOUTS.map((L) => `<button class="lay" data-id="${L.id}">${layoutThumb(L)}<span>${L.name}</span></button>`).join('');
  $('#grades').innerHTML = GRADES.map((G) => `<button class="gr" data-id="${G.id}"><i style="background:linear-gradient(90deg,${G.stops.join(',')})"></i>${G.name}</button>`).join('');
  $('#layouts').onclick = (e) => { const b = e.target.closest('.lay'); if (b) setLayout(b.dataset.id); };
  $('#grades').onclick = (e) => {
    const b = e.target.closest('.gr'); if (!b) return;
    const G = GRADES.find((x) => x.id === b.dataset.id);
    const [strength, contrast, saturation, grain, vignette] = G.d;
    Object.assign(state.grade, { id: G.id, strength, contrast, saturation, grain, vignette });
    syncUI(); render(); status(`Grade: ${G.name}.`);
  };
  $('#sizes').onclick = (e) => { const b = e.target.closest('.tab'); if (b) setSize(b.dataset.size); };
  for (const k of ['strength', 'contrast', 'saturation', 'grain', 'vignette']) {
    $('#g-' + k).addEventListener('input', (e) => { state.grade[k] = +e.target.value; syncUI(); render(); });
  }
  $('#zoom').addEventListener('input', (e) => {
    const t = state.transforms[state.selectedPanel]; if (!t) return;
    t.zoom = +e.target.value; clampPanel(state.selectedPanel); syncUI(); render();
  });
  $('#chips').onclick = (e) => { const b = e.target.closest('.chip'); if (b) { state.selectedPanel = +b.dataset.i; syncUI(); render(); } };
  $('#thumbs').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.assignment[state.selectedPanel] = +b.dataset.i;
    state.transforms[state.selectedPanel] = fresh();
    syncUI(); render(); status(`Panel ${state.selectedPanel + 1} now shows ${state.photos[+b.dataset.i].name}.`);
  };
  $('#addPhotos').onclick = () => $('#file').click();
  const drop = $('#drop');
  drop.onclick = () => $('#file').click();
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') $('#file').click(); };
  $('#file').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
  for (const el of [drop, document.body]) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    el.addEventListener('dragleave', () => drop.classList.remove('over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('over');
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });
  }
  $('#autoCenter').onclick = () => { state.transforms[state.selectedPanel] = fresh(); syncUI(); render(); status(`Panel ${state.selectedPanel + 1} re-centred.`); };
  $('#replace').onclick = () => $('#fileReplace').click();
  $('#fileReplace').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const p = await loadFile(f); if (!p) return status('That file is not a usable image.');
    const idx = state.assignment[state.selectedPanel];
    if (idx >= 0) state.photos[idx] = p;
    else { state.photos.push(p); state.assignment[state.selectedPanel] = state.photos.length - 1; }
    state.transforms[state.selectedPanel] = fresh();
    syncUI(); render(); status(`Replaced photo in panel ${state.selectedPanel + 1} with ${p.name}.`);
  };
  $('#fillAll').onclick = () => {
    const idx = state.assignment[state.selectedPanel];
    if (idx < 0 || idx === undefined) return status('Select a panel that has a photo first.');
    state.assignment = state.panels.map(() => idx); resetTransforms(); syncUI(); render();
    status(`All ${state.panels.length} panels now use ${state.photos[idx].name}.`);
  };
  $('#spread').onclick = () => {
    if (!state.photos.length) return status('Add photos first.');
    autoAssign(); resetTransforms(); syncUI(); render();
    status(`Spread ${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} across ${state.panels.length} panels.`);
  };
  // caption inputs: re-render on every keystroke
  for (const k of ['title', 'subtitle', 'tagline', 'quote', 'quoteSource']) {
    const el = $('#t-' + k); el.value = state.texts[k];
    el.addEventListener('input', (e) => { state.texts[k] = e.target.value; render(); });
  }
  $('#t-quoteOn').checked = state.texts.toggles.quote;
  $('#t-quoteOn').addEventListener('change', (e) => { state.texts.toggles.quote = e.target.checked; render(); });
  $('#exportAll').onclick = () => {
    if (typeof window.exportAll === 'function') window.exportAll(); else status('Export arrives in Session 4.');
  };
}

function syncUI() {
  $('#photoCount').textContent = state.photos.length;
  $('#thumbs').innerHTML = state.photos.map((p, i) =>
    `<button data-i="${i}" title="${p.name}" class="${state.assignment.includes(i) ? 'used' : ''}"><img src="${p.url}" alt=""></button>`).join('');
  $('#chips').innerHTML = state.panels.map((_, i) =>
    `<button class="chip ${i === state.selectedPanel ? 'on' : ''}" data-i="${i}">${i === 0 ? 'HERO' : i + 1}</button>`).join('');
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', +b.dataset.w === state.size.w && +b.dataset.h === state.size.h));
  document.querySelectorAll('.lay').forEach((b) => b.classList.toggle('on', b.dataset.id === state.layoutId));
  document.querySelectorAll('.gr').forEach((b) => b.classList.toggle('on', b.dataset.id === state.grade.id));
  for (const k of ['strength', 'contrast', 'saturation', 'grain', 'vignette']) {
    const el = $('#g-' + k); el.value = state.grade[k];
    el.previousElementSibling.textContent = state.grade[k] + (k === 'grain' || k === 'vignette' ? '' : '%');
  }
  const t = state.transforms[state.selectedPanel];
  $('#zoom').value = t ? t.zoom : 1; $('#zoomOut').textContent = (t ? t.zoom : 1).toFixed(2) + 'x';
}

// ---------- pointer interaction on the preview ----------
const toExport = (e) => {
  const b = stage.getBoundingClientRect();
  return { x: (e.clientX - b.left) * stage.width / b.width, y: (e.clientY - b.top) * stage.height / b.height };
};
const hit = (p) => state.panels.findIndex((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
// store offsets already clamped to the reachable window so dragging never "sticks" at an edge
function clampPanel(i) {
  const ph = state.photos[state.assignment[i]]; if (!ph) return;
  const t = state.transforms[i], w = sourceWindow(ph.img, state.panels[i], t);
  t.dx = (w.sx + w.sw / 2 - ph.img.naturalWidth / 2) / ph.img.naturalWidth;
  t.dy = (w.sy + w.sh / 2 - ph.img.naturalHeight / 2) / ph.img.naturalHeight;
}
let drag = null;
stage.addEventListener('pointerdown', (e) => {
  const p = toExport(e), i = hit(p); if (i < 0) return;
  if (i !== state.selectedPanel) { state.selectedPanel = i; syncUI(); render(); }
  drag = { i, x: p.x, y: p.y };
  stage.setPointerCapture(e.pointerId); stage.classList.add('drag');
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = toExport(e), i = drag.i, ph = state.photos[state.assignment[i]];
  if (ph) {
    const t = state.transforms[i], s = sourceWindow(ph.img, state.panels[i], t).s;
    t.dx -= (p.x - drag.x) / s / ph.img.naturalWidth;
    t.dy -= (p.y - drag.y) / s / ph.img.naturalHeight;
    clampPanel(i); render();
  }
  drag.x = p.x; drag.y = p.y;
});
const endDrag = () => { if (drag) { drag = null; stage.classList.remove('drag'); } };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const i = hit(toExport(e)); if (i < 0) return;
  state.selectedPanel = i;
  const t = state.transforms[i];
  t.zoom = Math.min(4, Math.max(1, t.zoom * Math.exp(-e.deltaY * .0015)));
  clampPanel(i); syncUI(); render();
}, { passive: false });
stage.addEventListener('dblclick', (e) => {
  const i = hit(toExport(e)); if (i < 0) return;
  state.selectedPanel = i; state.transforms[i] = fresh();
  syncUI(); render(); status(`Panel ${i + 1} re-centred.`);
});

// ---------- fonts (vendored under app/fonts, see OFL-Anton.txt / LICENSE-Yellowtail.txt) ----------
const FONT_FILES = [['Anton', './fonts/Anton-Regular.ttf'], ['Yellowtail', './fonts/Yellowtail-Regular.ttf']];
const fontsReady = Promise.allSettled(FONT_FILES.map(async ([family, url]) => {
  const f = new FontFace(family, `url(${url})`); await f.load(); document.fonts.add(f);
})).then((r) => {
  const bad = r.map((x, i) => (x.status === 'rejected' ? FONT_FILES[i][0] : null)).filter(Boolean);
  if (bad.length) status(`Font failed to load: ${bad.join(', ')} - using fallbacks.`);
});
document.fonts.addEventListener('loadingdone', () => render());   // re-render whenever a font arrives

// ---------- boot ----------
buildStatic(); recompute(); resetTransforms(); autoAssign(); syncUI();
await fontsReady;                                                  // first render waits for the lettering fonts
render();
window.GODPOSTER = { fontsReady, state, render, renderDressing: (...a) => renderDressing(...a), LAYOUTS, GRADES, SIZES, setSize, setLayout, addFiles, status };

// Modul 1: Handschrift-Aufnahme.
import { VARIANTS, groupsFor, variantsOf, recordedCount, progress, checkPair, label, boxWidth, align } from './profile.js';
import { saveProfile, getSettings, setSetting } from './storage.js';
import { fillStrokes } from './ink.js';
import { drawGhost } from './ghost.js';
import { attachPen } from './pen.js';
import { layout } from './layout.js';
import { drawPage } from './render.js';
import { current as writeSettings, INKS } from './schreiben.js';
import { previewText } from './textplan.js';


// Kästchen-Geometrie in x-Höhen: oben 2,5 über, unten 1,5 unter der Grundlinie.
const TOP = -2.5, BOTTOM = 1.5, HEIGHT = BOTTOM - TOP;
const GUIDES = [
  { y: -2, name: 'Oberlänge', color: '#b9c3d6', dash: [0.08, 0.08] },
  { y: -1, name: 'x-Höhe', color: '#6f8fc7', dash: [0.15, 0.08] },
  { y: 0, name: 'Grundlinie', color: '#1f3a68', dash: [] },
  { y: 1, name: 'Unterlänge', color: '#b9c3d6', dash: [0.08, 0.08] },
];
const ACTIONS_H = 60; // Platz für die Knöpfe unter jedem Kästchen (px)
const GAP = 16;

export const PEN_ONLY = 'Bitte mit dem Apple Pencil schreiben. (Maus/Finger lassen sich im Profil-Tab als Testmodus erlauben.)';

export function initAufnahme(profile) {
  const $ = id => document.getElementById(id);
  const groupsEl = $('char-groups'), boxesEl = $('boxes'), hintEl = $('recorder-hint');
  let current = getSettings().aufnahmeChar;
  const allChars = () => groupsFor(profile).flatMap(g => g.chars);
  if (!allChars().includes(current)) current = allChars()[0];

  // ---------- Zeichenliste links ----------
  function renderList() {
    groupsEl.innerHTML = '';
    for (const g of groupsFor(profile)) {
      const h = document.createElement('h3');
      h.textContent = g.name;
      const grid = document.createElement('div');
      grid.className = 'chips';
      for (const ch of g.chars) {
        const b = document.createElement('button');
        b.className = 'chip' + (ch === ' ' ? ' chip-wide' : '');
        b.textContent = ch === ' ' ? '␣' : ch;
        b.dataset.ch = ch;
        b.setAttribute('aria-label', `${label(ch)}: ${recordedCount(profile, ch)} von ${VARIANTS} Varianten`);
        b.dataset.status = recordedCount(profile, ch);
        b.setAttribute('aria-current', ch === current);
        b.addEventListener('click', () => select(ch));
        grid.append(b);
      }
      groupsEl.append(h, grid);
    }
    const p = progress(profile);
    $('progress-text').textContent = `${p.done} von ${p.total} Zeichen`;
    $('progress-bar').max = p.total;
    $('progress-bar').value = p.done;
  }

  function updateChip(ch) {
    const b = groupsEl.querySelector(`[data-ch="${CSS.escape(ch)}"]`);
    if (b) {
      b.dataset.status = recordedCount(profile, ch);
      b.setAttribute('aria-label', `${label(ch)}: ${recordedCount(profile, ch)} von ${VARIANTS} Varianten`);
    }
    const p = progress(profile);
    $('progress-text').textContent = `${p.done} von ${p.total} Zeichen`;
    $('progress-bar').value = p.done;
  }

  function select(ch) {
    // Beim Verlassen ausrichten, nicht nach jedem Strich: sonst springt z. B. der erste Strich eines H in die Mitte.
    if (current !== ch && variantsOf(profile, current).map(v => align(current, v)).some(Boolean)) saveProfile(profile);
    current = ch;
    setSetting('aufnahmeChar', ch);
    for (const b of groupsEl.querySelectorAll('.chip')) b.setAttribute('aria-current', b.dataset.ch === ch);
    groupsEl.querySelector(`[data-ch="${CSS.escape(ch)}"]`)?.scrollIntoView({ block: 'nearest' });
    renderBoxes();
  }

  // ---------- Kästchen rechts ----------
  let boxes = []; // { canvas, ctx, strokes, unit, live }

  function renderBoxes() {
    $('current-char').textContent = label(current);
    $('remove-pair').hidden = !profile.customPairs.includes(current);
    hintEl.textContent = current === ' '
      ? 'Ziehe einen waagerechten Strich, so lang wie der Abstand zwischen zwei Wörtern.'
      : [...current].length > 1
        ? 'Schreibe die Buchstaben so verbunden, wie du sie normalerweise schreibst.'
        : 'Schreibe das Zeichen auf die Grundlinie. Kleinbuchstaben reichen bis zur x-Höhe.';

    // Größte Kästchengröße finden, bei der alle drei Kästchen in den Bereich passen.
    const w = boxWidth(current), aw = boxesEl.clientWidth, ah = boxesEl.clientHeight;
    let unit = 0, cols = 3;
    for (const c of [3, 2, 1]) {
      const rows = Math.ceil(VARIANTS / c);
      const u = Math.min((ah - rows * (ACTIONS_H + GAP)) / (rows * HEIGHT), (aw - (c - 1) * GAP) / (c * w), 110);
      if (u > unit) { unit = u; cols = c; }
    }
    unit = Math.max(unit, 30);
    boxesEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;

    boxesEl.innerHTML = '';
    boxes = variantsOf(profile, current).map((strokes, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'box';
      const canvas = document.createElement('canvas');
      canvas.style.width = w * unit + 'px';
      canvas.style.height = HEIGHT * unit + 'px';
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * unit * dpr);
      canvas.height = Math.round(HEIGHT * unit * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr * unit, 0, 0, dpr * unit, 0, -TOP * dpr * unit); // ab hier in x-Höhen zeichnen
      const box = { canvas, ctx, strokes, unit, w, live: null };

      const actions = document.createElement('div');
      actions.className = 'box-actions';
      const undo = button('↶ Rückgängig', () => {
        strokes.pop();
        changed(box);
      });
      const clear = button('🗑 Löschen', () => {
        if (strokes.length && confirm(`Variante ${i + 1} von „${label(current)}“ löschen?`)) {
          strokes.length = 0;
          changed(box);
        }
      });
      actions.append(undo, clear);
      wrap.append(canvas, actions);
      boxesEl.append(wrap);
      attachPen(canvas, {
        unit: () => box.unit,
        top: TOP,
        onLive: live => { box.live = live; draw(box); },
        onStroke: stroke => { box.live = null; strokes.push(stroke); changed(box); },
        onReject: () => { hintEl.textContent = PEN_ONLY; },
      });
      draw(box);
      return box;
    });
    drawPreview();
  }

  function button(text, onClick) {
    const b = document.createElement('button');
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function changed(box) {
    draw(box);
    updateChip(current);
    saveProfile(profile);
    drawPreview();
  }

  // Beispielwörter mit dem aktuellen Zeichen in der eigenen Handschrift, so wie „Schreiben“ sie setzt.
  function drawPreview() {
    const canvas = $('char-preview');
    const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    if (!cssW) return;
    // Aktuelles Zeichen schon so ausgerichtet zeigen, wie es beim Verlassen gespeichert wird.
    const variants = variantsOf(profile, current).map(v => { const c = structuredClone(v); align(current, c); return c; });
    const p = { ...profile, glyphs: { ...profile.glyphs, [current]: variants } };
    const s = writeSettings();
    const u = cssH / 4; // Pixel je x-Höhe: Platz für Ober- und Unterlänge
    const result = layout(previewText(current), p, {
      xHeight: 1, margin: 0.5, pageW: cssW / u, pageH: 1e6, ruled: false, connect: s.connect / 100, chaos: s.chaos / 100,
    });
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr * u, 0, 0, dpr * u, 0, 0);
    drawPage(ctx, result.pages[0], (INKS[s.ink] || INKS.blau).color);
  }

  function draw({ ctx, strokes, unit, w, live }) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    ctx.lineWidth = 1.5 / unit;
    for (const g of GUIDES) {
      ctx.strokeStyle = g.color;
      ctx.setLineDash(g.dash);
      ctx.beginPath();
      ctx.moveTo(0, g.y);
      ctx.lineTo(w, g.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#9aa6bb';
    ctx.font = `${12 / unit}px -apple-system, sans-serif`;
    ctx.textAlign = 'right';
    for (const g of GUIDES) ctx.fillText(g.name, w - 4 / unit, g.y - 3 / unit);
    drawGhost(ctx, current, w);
    ctx.fillStyle = '#1d1d1f';
    fillStrokes(ctx, live ? [...strokes, live] : strokes);
  }

  // ---------- Navigation und eigene Paare ----------
  function step(dir) {
    const all = allChars();
    select(all[(all.indexOf(current) + dir + all.length) % all.length]);
  }
  $('prev-char').addEventListener('click', () => step(-1));
  $('next-char').addEventListener('click', () => step(1));
  $('next-missing').addEventListener('click', () => {
    // Erst Pflichtzeichen ab der aktuellen Stelle, dann die optionalen Extras.
    const required = groupsFor(profile).filter(g => !g.optional).flatMap(g => g.chars);
    const start = Math.max(required.indexOf(current), 0);
    const order = [...required.slice(start + 1), ...required.slice(0, start + 1),
      ...groupsFor(profile).filter(g => g.optional).flatMap(g => g.chars)];
    const ch = order.find(c => recordedCount(profile, c) < VARIANTS);
    if (ch !== undefined) return select(ch);
    hintEl.textContent = '🎉 Alle Zeichen haben 3 Varianten.';
  });

  $('pair-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('pair-input');
    const error = checkPair(profile, input.value);
    if (error) return alert(error);
    profile.customPairs.push(input.value.trim());
    saveProfile(profile);
    current = input.value.trim();
    input.value = '';
    input.blur();
    renderList();
    select(current);
  });

  $('remove-pair').addEventListener('click', () => {
    if (!confirm(`Eigenes Paar „${current}“ samt Aufnahmen entfernen?`)) return;
    profile.customPairs = profile.customPairs.filter(p => p !== current);
    delete profile.glyphs[current];
    saveProfile(profile);
    current = allChars()[0];
    renderList();
    select(current);
  });

  // Bei Drehung/Größenänderung neu aufbauen (Daten sind normiert, nichts geht verloren).
  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!boxes.some(b => b.live) && boxesEl.clientWidth) renderBoxes(); }, 150);
  }).observe(boxesEl);

  renderList();
  select(current);
  // Nach einer Text-Aufnahme: Liste, Fortschritt und Kästchen neu aufbauen.
  return { refresh: () => { renderList(); select(current); } };
}

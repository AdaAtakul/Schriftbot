// Text-Aufnahme: einen kurzen Text über eine blasse Vorlage schreiben statt jedes Zeichen einzeln.
// Jedes Zeichen der Vorlage hat ein festes Feld; ein Strich gehört zu dem Feld, über dem seine Mitte liegt.
// Gespeichert wird in die erste freie Variante – vorhandene Aufnahmen werden nie überschrieben.
import { plan } from './textplan.js';
import { variantsOf, label, align } from './profile.js';
import { saveProfile, getSettings, setSetting } from './storage.js';
import { fillStrokes } from './ink.js';
import { drawGhost, ghostWidth } from './ghost.js';
import { attachPen } from './pen.js';
import { PEN_ONLY } from './aufnahme.js';
import { ask, info } from './dialog.js';

const PITCH = 3.5;     // Zeilenhöhe in x-Höhen
const BASE = 2.3;      // Grundlinie unterhalb der Zeilenoberkante
const SLOT_PAD = 0.25; // Luft je Feld
const WORD_GAP = 1.2;  // Abstand zwischen Wörtern
const MARGIN = 0.4;
const GUIDES = [[-2, '#d3dae6', [0.08, 0.08]], [-1, '#9fb3d9', [0.15, 0.08]], [0, '#1f3a68', []], [1, '#d3dae6', [0.08, 0.08]]];
const INKS = ['#1d1d1f', '#1f4fbf']; // abwechselnd je Feld, damit man die Zuordnung sieht
const HINT = 'Schreib über die blasse Vorlage, Buchstaben einzeln. Gelb hinterlegte Gruppen bitte verbunden schreiben. Die Farbe zeigt, welchem Zeichen ein Strich zugeordnet wird.';
const round3 = n => Math.round(n * 1000) / 1000;

export function initTextAufnahme(profile, onSaved) {
  const $ = id => document.getElementById(id);
  const wrap = $('text-page-wrap'), canvas = $('text-page'), hint = $('text-hint');
  let pages = [], page = getSettings().textPage || 0, unit = 50, strokes = [], live = null;
  hint.textContent = HINT;

  // Wörter auf Zeilen und Zeilen auf Seiten verteilen, passend zur Bildschirmbreite.
  function layoutPages() {
    // x-Höhe ≈ 6–9 mm auf dem iPad, kleiner wenn die Kästchen an die eigene Schrift angepasst sind
    unit = Math.max(20, Math.min(48, wrap.clientWidth / 24) * (getSettings().boxScale || 1));
    const cols = wrap.clientWidth / unit;
    const rowsPerPage = Math.max(1, Math.floor(wrap.clientHeight / (PITCH * unit)));
    const rows = [];
    let row = [], x = MARGIN;
    plan(profile).forEach((word, wi) => {
      const slots = word.map(key => ({ key, word: wi, w: ghostWidth(key) + SLOT_PAD }));
      const width = slots.reduce((n, s) => n + s.w, 0);
      if (row.length && x + width > cols - MARGIN) { rows.push(row); row = []; x = MARGIN; }
      for (const s of slots) { s.x = x; x += s.w; row.push(s); }
      x += WORD_GAP;
    });
    if (row.length) rows.push(row);
    pages = [];
    for (let i = 0; i < rows.length; i += rowsPerPage) pages.push(rows.slice(i, i + rowsPerPage));
    page = Math.min(page, pages.length - 1);
  }

  // Zeile und Feld eines Strichs: nach der Mitte seines Umrisses.
  function slotOf(stroke) {
    const xs = stroke.map(p => p[0]), ys = stroke.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rows = pages[page];
    const r = Math.max(0, Math.min(rows.length - 1, Math.floor(cy / PITCH)));
    let best = 0, dist = Infinity;
    rows[r].forEach((s, i) => {
      const d = cx < s.x ? s.x - cx : cx > s.x + s.w ? cx - s.x - s.w : 0;
      if (d < dist) { dist = d; best = i; }
    });
    return { r, i: best };
  }

  function draw() {
    const rows = pages[page] || [];
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth, cssH = rows.length * PITCH * unit;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * unit, 0, 0, dpr * unit, 0, 0);
    ctx.lineWidth = 1.5 / unit;
    rows.forEach((row, r) => {
      ctx.save();
      ctx.translate(0, r * PITCH + BASE);
      for (const [y, color, dash] of GUIDES) {
        ctx.strokeStyle = color;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssW / unit, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const s of row) {
        if ([...s.key].length > 1) {
          ctx.fillStyle = 'rgba(232, 194, 106, 0.22)';
          ctx.fillRect(s.x + 0.05, -2.1, s.w - 0.1, 3.2);
        }
        ctx.save();
        ctx.translate(s.x, 0);
        drawGhost(ctx, s.key, s.w);
        ctx.restore();
      }
      ctx.restore();
    });
    for (const st of strokes) {
      ctx.fillStyle = INKS[slotOf(st).i % 2];
      fillStrokes(ctx, [st]);
    }
    if (live) {
      ctx.fillStyle = INKS[0];
      fillStrokes(ctx, [live]);
    }
    $('text-info').textContent = `Seite ${page + 1} von ${pages.length}`;
  }

  function render() {
    if (!wrap.clientWidth) return; // nicht sichtbar
    // shortcut: bei Größenänderung mit schon geschriebenen Strichen bleibt die alte Aufteilung, sonst passen die Striche nicht mehr zu den Feldern
    if (!strokes.length) layoutPages();
    draw();
  }

  attachPen(canvas, {
    unit: () => unit,
    onLive: l => { live = l; draw(); },
    onStroke: s => { live = null; strokes.push(s); draw(); },
    onReject: () => { hint.textContent = PEN_ONLY; },
  });

  // Striche der Seite den Feldern zuordnen und in freie Varianten speichern.
  function commit() {
    if (!strokes.length) return info('Auf dieser Seite ist noch nichts geschrieben.');
    const rows = pages[page];
    const bySlot = new Map();
    for (const st of strokes) {
      const { r, i } = slotOf(st);
      const k = r + ':' + i;
      bySlot.set(k, [...(bySlot.get(k) || []), st]);
    }
    let saved = 0;
    const empty = [], full = new Set();
    const bounds = sts => { const xs = sts.flat().map(p => p[0]); return [Math.min(...xs), Math.max(...xs)]; };
    rows.forEach((row, r) => {
      row.forEach((s, i) => {
        const sts = bySlot.get(r + ':' + i);
        if (!sts) return empty.push(s.key);
        const free = variantsOf(profile, s.key).find(v => !v.length);
        if (!free) return full.add(s.key);
        const baseY = r * PITCH + BASE;
        free.push(...sts.map(st => st.map(([x, y, p, t]) => [round3(x - s.x), round3(y - baseY), p, t])));
        align(s.key, free);
        saved++;
      });
      // Wortabstände werden zu Leerzeichen-Varianten (wie der waagerechte Strich bei der Einzelaufnahme).
      for (let i = 0; i + 1 < row.length; i++) {
        const a = bySlot.get(r + ':' + i), b = bySlot.get(r + ':' + (i + 1));
        if (row[i].word === row[i + 1].word || !a || !b) continue;
        const gap = bounds(b)[0] - bounds(a)[1];
        const free = variantsOf(profile, ' ').find(v => !v.length);
        if (gap > 0.2 && free) free.push([[0, 0, 0.5, 0], [round3(gap), 0, 0.5, 10]]);
      }
    });
    saveProfile(profile);
    onSaved();
    strokes = [];
    const notes = [`${saved} Zeichen übernommen`];
    if (empty.length) notes.push(`leer gelassen: ${[...new Set(empty)].map(label).join(' ')}`);
    if (full.size) notes.push(`hatten schon 3 Varianten: ${[...full].map(label).join(' ')}`);
    if (page < pages.length - 1) page++;
    else notes.push('🎉 Text fertig – für weitere Varianten einfach noch einmal schreiben');
    setSetting('textPage', page);
    render();
    hint.textContent = notes.join(' · ');
  }

  async function go(dir) {
    const next = page + dir;
    if (next < 0 || next >= pages.length) return;
    if (strokes.length && !await ask('Die Striche auf dieser Seite sind noch nicht übernommen. Verwerfen?', { ok: 'Verwerfen', danger: true })) return;
    strokes = [];
    page = next;
    setSetting('textPage', page);
    hint.textContent = HINT;
    render();
  }

  $('text-prev').addEventListener('click', () => go(-1));
  $('text-next').addEventListener('click', () => go(1));
  $('text-undo').addEventListener('click', () => { strokes.pop(); draw(); });
  $('text-clear').addEventListener('click', async () => {
    if (strokes.length && await ask('Alle Striche auf dieser Seite löschen?', { ok: 'Löschen', danger: true })) { strokes = []; draw(); }
  });
  $('text-commit').addEventListener('click', commit);

  // Umschalter Einzeln / Als Text
  const modeButtons = document.querySelectorAll('[data-mode]');
  function setMode(mode) {
    for (const b of modeButtons) b.setAttribute('aria-pressed', b.dataset.mode === mode);
    $('single-recorder').hidden = mode !== 'einzeln';
    $('text-recorder').hidden = mode !== 'text';
    setSetting('aufnahmeMode', mode);
  }
  for (const b of modeButtons) b.addEventListener('click', () => setMode(b.dataset.mode));
  setMode(getSettings().aufnahmeMode || 'einzeln');

  new ResizeObserver(render).observe(wrap);
}

// Text-Aufnahme: einen kurzen Text über eine blasse Vorlage schreiben statt jedes Zeichen einzeln – auf einer Seite,
// die aussieht wie liniertes GoodNotes-Papier, in normaler Schreibgröße (x-Höhe 3 mm auf A4-Breite).
// Jedes Zeichen der Vorlage hat ein festes Feld; ein Strich gehört zu dem Feld, über dem seine Mitte liegt.
// Gespeichert wird sofort nach jedem Strich, in die erste freie Variante. Kommt zu einem Zeichen später noch ein
// Strich dazu (i-Punkt, t-Strich), wird dieselbe Variante ergänzt; vorhandene Aufnahmen werden nie überschrieben.
import { plan } from './textplan.js';
import { variantsOf, label, align } from './profile.js';
import { saveProfile, getSettings, setSetting } from './storage.js';
import { fillStrokes } from './ink.js';
import { drawGhost, ghostWidth } from './ghost.js';
import { attachPen } from './pen.js';
import { paperLines, PAPER_COLORS } from './paper.js';
import { PEN_ONLY } from './aufnahme.js';
import { ask } from './dialog.js';

const PAGE_MM = 210, XH_MM = 3;                                // Seitenbreite und Schriftgröße wie beim fertigen Blatt
const PITCH = paperLines('liniert-breit').lineSpacing / XH_MM; // Zeilenabstand in x-Höhen (GoodNotes „liniert breit“)
const BASE = PITCH;            // Grundlinie liegt auf der Linie am unteren Rand der Zeile
const MARGIN = 4;              // linker und rechter Rand in x-Höhen (12 mm)
const SLOT_PAD = 0.25;         // Luft je Feld
const WORD_GAP = 1.2;          // Abstand zwischen Wörtern
const GHOST_ALPHA = 0.1;       // Vorlage sehr blass
const LINE = PAPER_COLORS.weiss.line, XLINE = 'rgba(159, 179, 217, 0.45)';
const INKS = ['#1d1d1f', '#1f4fbf']; // abwechselnd je Feld, damit man die Zuordnung sieht
const HINT = 'Schreib über die blasse Vorlage, Buchstaben einzeln. Gelb hinterlegte Gruppen bitte verbunden schreiben. Die Farbe zeigt, welchem Zeichen ein Strich zugeordnet wird. Alles wird automatisch gespeichert.';
const round3 = n => Math.round(n * 1000) / 1000;

export function initTextAufnahme(profile, onSaved) {
  const $ = id => document.getElementById(id);
  const wrap = $('text-page-wrap'), canvas = $('text-page'), hint = $('text-hint');
  let pages = [], page = getSettings().textPage || 0, unit = 12, strokes = [], live = null, totalWords = 0;
  // Auf dieser Seite gespeicherte Varianten (Feld → Variante), damit Nachträge dieselbe Variante ergänzen
  let saved = new Map(), pageWords = new Set();
  hint.textContent = HINT;

  // Wörter auf Zeilen und Zeilen auf Seiten verteilen, passend zur Breite (die Breite entspricht A4).
  function layoutPages() {
    unit = Math.max(11, wrap.clientWidth * XH_MM / PAGE_MM); // am Handy nicht winzig
    const cols = wrap.clientWidth / unit;
    const rowsPerPage = Math.max(1, Math.floor(wrap.clientHeight / (PITCH * unit)) - 1);
    const rows = [];
    let row = [], x = MARGIN;
    const words = plan(profile);
    totalWords = words.length;
    words.forEach((word, wi) => {
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

  // Zeile und Feld eines Strichs: nach der Mitte seines Umrisses. Die Zeile ist die, deren Grundlinie knapp
  // darunter liegt (Buchstabenmitten liegen etwa 0,4 x-Höhen über der Grundlinie, Kommas knapp darunter).
  function slotOf(stroke) {
    const xs = stroke.map(p => p[0]), ys = stroke.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rows = pages[page];
    const r = Math.max(0, Math.min(rows.length - 1, Math.round((cy - BASE + 0.4) / PITCH)));
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
    const lines = rows.length + 1; // eine leere Linie mehr, wie auf einer echten Seite
    const cssW = wrap.clientWidth, cssH = (lines * PITCH + 1) * unit;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * unit, 0, 0, dpr * unit, 0, 0);
    const W = cssW / unit;
    // Linien wie im GoodNotes-Papier, dazu eine blasse gestrichelte x-Höhe
    for (let r = 0; r < lines; r++) {
      const y = r * PITCH + BASE;
      ctx.lineWidth = 1 / unit;
      ctx.strokeStyle = LINE;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.strokeStyle = XLINE;
      ctx.setLineDash([0.15, 0.12]);
      ctx.beginPath(); ctx.moveTo(0, y - 1); ctx.lineTo(W, y - 1); ctx.stroke();
    }
    ctx.setLineDash([]);
    rows.forEach((row, r) => {
      ctx.save();
      ctx.translate(0, r * PITCH + BASE);
      for (const s of row) {
        if ([...s.key].length > 1) {
          ctx.fillStyle = 'rgba(232, 194, 106, 0.18)';
          ctx.fillRect(s.x + 0.05, -1.9, s.w - 0.1, 2.6);
        }
        ctx.save();
        ctx.translate(s.x, 0);
        drawGhost(ctx, s.key, s.w, GHOST_ALPHA);
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
    showProgress();
  }

  // Fortschritt über den ganzen Text: ein Wort zählt, sobald alle seine Zeichen Striche haben
  function showProgress() {
    const done = new Set(getSettings().textWords || []).size;
    $('text-progress-label').textContent = `${Math.min(done, totalWords)} von ${totalWords} Wörtern`;
    const bar = $('text-progress-fill').parentElement;
    bar.setAttribute('aria-valuemax', String(totalWords));
    bar.setAttribute('aria-valuenow', String(Math.min(done, totalWords)));
    $('text-progress-fill').style.width = `${totalWords ? Math.min(100, 100 * done / totalWords) : 0}%`;
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
    onStroke: s => { live = null; strokes.push(s); draw(); syncSoon(); },
    onReject: () => { hint.textContent = PEN_ONLY; },
  });

  // Striche der Seite den Feldern zuordnen und sofort speichern. Läuft nach jeder Änderung (auch Rückgängig/Leeren):
  // Felder ohne Striche geben ihre Variante wieder frei, Nachträge ergänzen die schon gewählte Variante.
  let timer = 0;
  const syncSoon = () => { clearTimeout(timer); timer = setTimeout(sync, 350); };
  function sync() {
    clearTimeout(timer);
    timer = 0;
    const rows = pages[page];
    if (!rows) return;
    const bySlot = new Map();
    for (const st of strokes) {
      const { r, i } = slotOf(st);
      const k = r + ':' + i;
      bySlot.set(k, [...(bySlot.get(k) || []), st]);
    }
    const full = new Set();
    const put = (k, key, data, keepAlign) => {
      let v = saved.get(k);
      if (!data) { if (v) { v.length = 0; saved.delete(k); } return; }
      if (!v) {
        v = variantsOf(profile, key).find(x => !x.length);
        if (!v) { full.add(key); return; }
        saved.set(k, v);
      }
      v.length = 0;
      v.push(...data);
      if (keepAlign) align(key, v);
    };
    const bounds = sts => { const xs = sts.flat().map(p => p[0]); return [Math.min(...xs), Math.max(...xs)]; };
    const words = new Map(); // Wort → alle Felder beschrieben?
    rows.forEach((row, r) => {
      const baseY = r * PITCH + BASE;
      row.forEach((s, i) => {
        const sts = bySlot.get(r + ':' + i);
        words.set(s.word, (words.get(s.word) ?? true) && !!sts);
        put(r + ':' + i, s.key, sts && sts.map(st => st.map(([x, y, p, t]) => [round3(x - s.x), round3(y - baseY), p, t])), true);
      });
      // Wortabstände werden zu Leerzeichen-Varianten (wie der waagerechte Strich bei der Einzelaufnahme)
      for (let i = 0; i + 1 < row.length; i++) {
        if (row[i].word === row[i + 1].word) continue;
        const a = bySlot.get(r + ':' + i), b = bySlot.get(r + ':' + (i + 1));
        const gap = a && b ? bounds(b)[0] - bounds(a)[1] : 0;
        put('sp' + r + ':' + i, ' ', gap > 0.2 ? [[[0, 0, 0.5, 0], [round3(gap), 0, 0.5, 10]]] : null, false);
      }
    });
    // Fertige Wörter merken; Wörter dieser Seite, die nicht mehr fertig sind (Rückgängig), wieder herausnehmen
    const done = new Set(getSettings().textWords || []);
    for (const [w, complete] of words) {
      if (complete) { done.add(w); pageWords.add(w); } else if (pageWords.has(w)) { done.delete(w); pageWords.delete(w); }
    }
    setSetting('textWords', [...done]);
    saveProfile(profile);
    onSaved();
    showProgress();
    const pageDone = [...words.values()].every(Boolean);
    const notes = [strokes.length ? 'Automatisch gespeichert ✓' : HINT];
    if (full.size) notes.push(`hatten schon 3 Varianten: ${[...full].map(label).join(' ')}`);
    if (pageDone) notes.push(page < pages.length - 1 ? 'Seite fertig – weiter mit ›' : '🎉 Text fertig – für weitere Varianten einfach noch einmal schreiben');
    hint.textContent = notes.join(' · ');
  }

  // Seite wechseln: alles ist schon gespeichert, die Striche verschwinden nur von der Fläche
  function go(dir) {
    const next = page + dir;
    if (next < 0 || next >= pages.length) return;
    if (timer) sync();
    strokes = [];
    saved = new Map();
    pageWords = new Set();
    page = next;
    setSetting('textPage', page);
    hint.textContent = HINT;
    render();
  }

  $('text-prev').addEventListener('click', () => go(-1));
  $('text-next').addEventListener('click', () => go(1));
  $('text-undo').addEventListener('click', () => { if (!strokes.length) return; strokes.pop(); draw(); sync(); });
  $('text-clear').addEventListener('click', async () => {
    if (!strokes.length || !await ask('Alle Striche auf dieser Seite löschen? Sie werden auch aus deiner Schrift entfernt.', { ok: 'Löschen', danger: true })) return;
    strokes = [];
    draw();
    sync();
  });

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

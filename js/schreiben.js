// Modul 2: Text → Handschrift mit Live-Vorschau.
import { layout, lineMetrics, DEFAULTS } from './layout.js';
import { drawPage, drawPaper } from './render.js';
import { getSettings, setSetting } from './storage.js';
import { buildPdf, buildPng, shareFiles } from './export.js';

// Linienabstände der GoodNotes-Vorlagen sind nicht offiziell dokumentiert (Nutzerangaben),
// deshalb lassen sie sich unten feinjustieren.
export const PAPERS = {
  'liniert-breit': { label: 'Liniert breit', ruled: true, lineSpacing: 8.8 },
  'liniert-schmal': { label: 'Liniert schmal', ruled: true, lineSpacing: 6.2 },
  'kariert': { label: 'Kariert 5 mm', ruled: true, grid: true, lineSpacing: 5 },
  'blanko': { label: 'Blanko', ruled: false },
};

export const INKS = {
  blau: { label: 'Blau', color: '#1f4fbf' },
  dunkelblau: { label: 'Dunkelblau', color: '#162a66' },
  schwarz: { label: 'Schwarz', color: '#1b1b1b' },
  rot: { label: 'Rot', color: '#c0281b' },
};

const STANDARD = {
  paper: 'liniert-breit', ink: 'blau', connect: 70, chaos: 50,
  xHeight: 3, lineHeight: 8.8, margin: 20, lineSpacing: 8.8, lineTop: 20,
};

const mm = v => Number(v).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' mm';
const SLIDERS = [
  { key: 'connect', label: 'Verbindungen', min: 0, max: 100, step: 5, fmt: v => v + ' %' },
  { key: 'chaos', label: 'Unordnung', min: 0, max: 100, step: 5, fmt: v => v + ' %' },
  { key: 'xHeight', label: 'Schriftgröße (x-Höhe)', min: 1.5, max: 6, step: 0.1, fmt: mm },
  { key: 'lineHeight', label: 'Zeilenabstand', min: 4, max: 20, step: 0.1, fmt: (v, s) => {
    const lm = lineMetrics(options(s));
    return lm.lines ? `${mm(lm.step)} (${lm.lines} ${lm.lines === 1 ? 'Linie' : 'Linien'})` : mm(v);
  } },
  { key: 'margin', label: 'Rand', min: 5, max: 40, step: 1, fmt: mm },
  { key: 'lineSpacing', label: 'Linienabstand', min: 3, max: 15, step: 0.1, fmt: mm, ruledOnly: true },
  { key: 'lineTop', label: 'Erste Linie von oben', min: 0, max: 60, step: 0.5, fmt: mm, ruledOnly: true },
];

// Aktuelle Einstellungen (gespeicherte Werte, sonst Standard).
export function current() {
  return { ...STANDARD, ...getSettings() };
}

// Einstellungen → Layout-Optionen.
export function options(s = current()) {
  const paper = PAPERS[s.paper] || PAPERS[STANDARD.paper];
  return {
    xHeight: +s.xHeight, lineHeight: +s.lineHeight, margin: +s.margin,
    connect: s.connect / 100, chaos: s.chaos / 100,
    ruled: paper.ruled, grid: !!paper.grid, lineSpacing: +s.lineSpacing, lineTop: +s.lineTop,
    pageW: DEFAULTS.pageW, pageH: DEFAULTS.pageH,
  };
}

export function initSchreiben(profile) {
  const $ = id => document.getElementById(id);
  const input = $('text-input'), pagesEl = $('pages'), statusEl = $('schreiben-status');
  input.value = getSettings().text || '';
  let seed = getSettings().seed || 1;

  // ---------- Bedienelemente ----------
  const paperSel = $('paper');
  for (const [key, p] of Object.entries(PAPERS)) paperSel.add(new Option(p.label, key));
  paperSel.value = current().paper;
  paperSel.addEventListener('change', () => {
    setSetting('paper', paperSel.value);
    const p = PAPERS[paperSel.value];
    if (p.ruled) { // Vorlage gewählt → passenden Linien- und Zeilenabstand übernehmen
      setSetting('lineSpacing', p.lineSpacing);
      setSetting('lineHeight', p.lineSpacing);
    }
    syncControls();
    render();
  });

  const inkEl = $('ink');
  for (const [key, ink] of Object.entries(INKS)) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.setProperty('--c', ink.color);
    b.dataset.ink = key;
    b.setAttribute('aria-label', ink.label);
    b.title = ink.label;
    b.addEventListener('click', () => { setSetting('ink', key); syncControls(); render(); });
    inkEl.append(b);
  }

  const controlsEl = $('controls');
  const sliders = SLIDERS.map(spec => {
    const label = document.createElement('label');
    label.className = 'slider';
    label.innerHTML = `${spec.label} <output></output><input type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}">`;
    const range = label.querySelector('input');
    range.addEventListener('input', () => {
      setSetting(spec.key, Number(range.value));
      syncControls();
      render();
    });
    controlsEl.append(label);
    return { spec, label, range, out: label.querySelector('output') };
  });

  function syncControls() {
    const s = current();
    const ruled = PAPERS[s.paper]?.ruled;
    for (const { spec, label, range, out } of sliders) {
      range.value = s[spec.key];
      out.textContent = spec.fmt(s[spec.key], s);
      label.hidden = spec.ruledOnly && !ruled;
    }
    for (const b of inkEl.children) b.setAttribute('aria-pressed', b.dataset.ink === s.ink);
  }

  // ---------- Vorschau ----------
  function render() {
    if (!pagesEl.clientWidth) return; // Tab nicht sichtbar
    const s = current(), o = options(s);
    const result = layout(input.value, profile, o, seed);
    const color = (INKS[s.ink] || INKS.blau).color;
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.min(pagesEl.clientWidth - 32, 900);
    const pxPerMm = cssW / o.pageW;

    // Vorhandene Canvas wiederverwenden, damit die Vorschau beim Tippen nicht flackert.
    while (pagesEl.children.length > result.pages.length) pagesEl.lastChild.remove();
    result.pages.forEach((page, i) => {
      let canvas = pagesEl.children[i];
      if (!canvas) pagesEl.append(canvas = document.createElement('canvas'));
      canvas.className = 'page';
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssW * o.pageH / o.pageW + 'px';
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * dpr * o.pageH / o.pageW);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * pxPerMm, 0, 0, dpr * pxPerMm, 0, 0);
      drawPaper(ctx, o);
      drawPage(ctx, page, color);
    });

    const notes = [`${result.pages.length} ${result.pages.length === 1 ? 'Seite' : 'Seiten'}`];
    const shown = result.missing.filter(ch => ch !== ' ');
    if (shown.length) notes.push(`⚠️ Fehlende Zeichen: ${shown.join(' ')}`);
    if (result.spaceMissing) notes.push('ℹ️ Leerzeichen nicht aufgenommen – Standardabstand');
    statusEl.textContent = notes.join(' · ');
    statusEl.classList.toggle('warn', shown.length > 0);
  }

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { setSetting('text', input.value); render(); }, 120);
  });
  $('reroll').addEventListener('click', () => {
    seed = Math.floor(Math.random() * 2 ** 31);
    setSetting('seed', seed);
    render();
  });
  $('reset-settings').addEventListener('click', () => {
    if (!confirm('Alle Schreib-Einstellungen auf Standard zurücksetzen?')) return;
    for (const key of Object.keys(STANDARD)) setSetting(key, STANDARD[key]);
    paperSel.value = STANDARD.paper;
    syncControls();
    render();
  });
  new ResizeObserver(() => render()).observe(pagesEl);

  // ---------- Export ----------
  const paperBox = $('export-paper'), shareAgain = $('share-again');
  const exportButtons = [$('export-pdf'), $('export-png')];
  paperBox.checked = getSettings().exportPaper ?? true;
  paperBox.addEventListener('change', () => setSetting('exportPaper', paperBox.checked));
  let pending = null;

  async function doExport(kind) {
    if (!input.value.trim()) return alert('Bitte zuerst Text eingeben.');
    const s = current(), o = options(s);
    const result = layout(input.value, profile, o, seed);
    const miss = result.missing.filter(ch => ch !== ' ');
    if (miss.length && !confirm(`Es fehlen Zeichen: ${miss.join(' ')}\nSie werden im Export rot markiert. Trotzdem exportieren?`)) return;

    const color = (INKS[s.ink] || INKS.blau).color;
    const date = new Date().toISOString().slice(0, 10);
    const labels = exportButtons.map(b => b.textContent);
    exportButtons.forEach(b => { b.disabled = true; b.textContent = '⏳ Wird erstellt …'; });
    shareAgain.hidden = true;
    try {
      let files;
      if (kind === 'pdf') {
        files = [new File([buildPdf(result, o, color, paperBox.checked)], `handschrift-${date}.pdf`, { type: 'application/pdf' })];
      } else {
        files = [];
        for (const [i, page] of result.pages.entries()) {
          const blob = await buildPng(page, o, color, paperBox.checked);
          files.push(new File([blob], `handschrift-${date}-seite-${i + 1}.png`, { type: 'image/png' }));
        }
      }
      // Safari verlangt fürs Teilen einen frischen Tipp, wenn das Erzeugen länger gedauert hat.
      if (!await shareFiles(files)) { pending = files; shareAgain.hidden = false; }
    } catch (err) {
      alert('Export fehlgeschlagen: ' + err.message);
    } finally {
      exportButtons.forEach((b, i) => { b.disabled = false; b.textContent = labels[i]; });
    }
  }
  $('export-pdf').addEventListener('click', () => doExport('pdf'));
  $('export-png').addEventListener('click', () => doExport('png'));
  shareAgain.addEventListener('click', async () => {
    shareAgain.hidden = true;
    try { await shareFiles(pending); } catch (err) { alert('Teilen fehlgeschlagen: ' + err.message); }
    pending = null;
  });

  syncControls();
  return { render, getSeed: () => seed, getText: () => input.value };
}

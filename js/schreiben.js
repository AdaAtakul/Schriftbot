// Modul 2: Text → Handschrift mit Live-Vorschau.
import { layout, lineMetrics, DEFAULTS } from './layout.js';
import { drawPage, drawPaper } from './render.js';
import { paperShapes } from './paper.js';
import { getSettings, setSetting, saveProfile } from './storage.js';
import { equalize, progress } from './profile.js';
import { PEN_SIZE } from './ink.js';
import { buildPdf, buildPng, shareFiles } from './export.js';
import { buildGoodnotes } from './goodnotes.js';
import { PAPER_KINDS, PAPER_COLORS, paperLines } from './paper.js';
import { PRESETS, styleValues, isModified, withStyleValue, migrateStyle, hueColor } from './stil.js';
import { ask, info } from './dialog.js';
import { isDemo } from './demo.js';

// Papier wie in GoodNotes (Maße in js/paper.js); Zeilen stehen genau auf Linien, Karos bzw. Punktreihen.
export const PAPERS = PAPER_KINDS;

export const INKS = {
  blau: { label: 'Blau', color: '#1f4fbf' },
  dunkelblau: { label: 'Dunkelblau', color: '#162a66' },
  schwarz: { label: 'Schwarz', color: '#1b1b1b' },
  rot: { label: 'Rot', color: '#c0281b' },
  weiss: { label: 'Weiß (für dunkles Papier)', color: '#f2f2f2' },
};

// Tintenfarbe: feste Farbe oder eigene über den Farbton-Regler
export const inkColor = s => (s.ink === 'eigen' ? hueColor(+s.inkHue || 0) : (INKS[s.ink] || INKS.blau).color);

const STANDARD = {
  paper: 'liniert-breit', ink: 'blau', inkHue: 220, xHeight: 3, lineHeight: 8.8, margin: 20, paperColor: 'weiss',
};

const mm = v => Number(v).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' mm';
const pct = v => v + ' %';
// Stil-Regler: gelten für die gewählte Vorlage (Anpassungen werden je Vorlage gemerkt)
const off = v => (v ? pct(v) : 'aus');
const STYLE_SLIDERS = [
  { key: 'connect', label: 'Buchstaben verbinden', desc: 'Wie oft Buchstaben ineinander übergehen', min: 0, max: 100, step: 5, fmt: pct },
  { key: 'chaos', label: 'Unregelmäßigkeit', desc: 'Schwankungen in Größe, Neigung und Abstand', min: 0, max: 150, step: 5, fmt: pct },
  { key: 'strike', label: 'Durchgestrichene Wörter', desc: 'Ab und zu ein Wort falsch begonnen, durchgestrichen und neu geschrieben', min: 0, max: 100, step: 5, fmt: off },
  { key: 'fix', label: 'Kleine Korrekturen', desc: 'Vergessene Buchstaben mit ^ eingefügt, Buchstaben nachgezogen', min: 0, max: 100, step: 5, fmt: off },
  { key: 'fatigue', label: 'Nachlassen zum Ende', desc: 'Lange Texte werden zum Ende hin größer und krakeliger', min: 0, max: 100, step: 5, fmt: off },
  { key: 'wobble', label: 'Wellige Zeilen', desc: 'Zeilen laufen leicht auf und ab, der Druck schwankt', min: 0, max: 100, step: 5, fmt: pct },
  { key: 'edges', label: 'Unruhige Zeilenränder', desc: 'Zeilen beginnen und enden nicht ganz bündig', min: 0, max: 100, step: 5, fmt: pct },
  { key: 'weight', label: 'Strichdicke', desc: '100 % = so dick wie aufgenommen', min: 40, max: 250, step: 5, fmt: pct },
];
const SLIDERS = [
  { key: 'xHeight', label: 'Schriftgröße (x-Höhe)', min: 1.5, max: 6, step: 0.1, fmt: mm },
  { key: 'lineHeight', label: 'Zeilenabstand', min: 4, max: 20, step: 0.1, fmt: (v, s) => {
    const lm = lineMetrics(options(s));
    return lm.lines ? `${mm(lm.step)} (${lm.lines} ${lm.lines === 1 ? 'Linie' : 'Linien'})` : mm(v);
  } },
  { key: 'margin', label: 'Rand', min: 5, max: 40, step: 1, fmt: mm },
];

// Aktuelle Einstellungen: Standard, gespeicherte Werte, darüber die Werte der Stil-Vorlage.
export function current() {
  const raw = getSettings(), mig = migrateStyle(raw);
  if (mig) { setSetting('style', mig.style); setSetting('styles', mig.styles); Object.assign(raw, mig); }
  return { ...STANDARD, ...raw, ...styleValues(raw) };
}

// Einstellungen → Layout-Optionen.
export function options(s = current()) {
  const paper = PAPERS[s.paper] ? s.paper : STANDARD.paper;
  return {
    xHeight: +s.xHeight, lineHeight: +s.lineHeight, margin: +s.margin, penSize: PEN_SIZE * s.weight / 100,
    connect: s.connect / 100, chaos: s.chaos / 100, strike: s.strike / 100, wobble: s.wobble / 100, edges: s.edges / 100,
    fix: s.fix / 100, fatigue: s.fatigue / 100,
    paper, paperColor: PAPER_COLORS[s.paperColor] ? s.paperColor : 'weiss',
    ruled: false, ...paperLines(paper), // Lage der Linien wie in GoodNotes
    pageW: DEFAULTS.pageW, pageH: DEFAULTS.pageH,
  };
}

export function initSchreiben(profile, onProfileChanged = () => {}) {
  const $ = id => document.getElementById(id);
  const input = $('text-input'), pagesEl = $('pages'), statusEl = $('schreiben-status');
  input.value = getSettings().text || '';
  let seed = getSettings().seed || 1;

  // ---------- Bedienelemente ----------
  // Papier als Vorschaubilder (wie die Vorlagen in GoodNotes), in der gewählten Papierfarbe
  const paperEl = $('paper');
  const THUMB_W = 64, THUMB_H = Math.round(THUMB_W * DEFAULTS.pageH / DEFAULTS.pageW);
  for (const [key, p] of Object.entries(PAPERS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paper-opt';
    b.dataset.paper = key;
    b.setAttribute('role', 'radio');
    const c = document.createElement('canvas');
    c.width = THUMB_W * 2; c.height = THUMB_H * 2;
    c.style.width = THUMB_W + 'px'; c.style.height = THUMB_H + 'px';
    c.setAttribute('aria-hidden', 'true');
    const l = document.createElement('span');
    l.textContent = p.label;
    b.append(c, l);
    b.addEventListener('click', () => {
      setSetting('paper', key);
      const pl = paperLines(key);
      // Liniert: eine Zeile je Linie. Karos/Punkte liegen enger (5,64 mm): jede zweite Reihe, sonst stoßen die Zeilen aneinander.
      const rows = PAPERS[key].ruled ? 1 : 2;
      if (pl.ruled) setSetting('lineHeight', +(pl.lineSpacing * rows).toFixed(2));
      syncControls();
      render();
    });
    paperEl.append(b);
  }
  let thumbsFor = '';
  function drawThumbs(color) {
    if (thumbsFor === color) return;
    thumbsFor = color;
    for (const b of paperEl.children) {
      const c = b.querySelector('canvas'), ctx = c.getContext('2d');
      ctx.setTransform(c.width / DEFAULTS.pageW, 0, 0, c.width / DEFAULTS.pageW, 0, 0);
      // Linien in der Vorschau etwas kräftiger, sonst verschwinden sie bei dieser Größe
      const p = paperShapes(b.dataset.paper, color, DEFAULTS.pageW, DEFAULTS.pageH);
      ctx.fillStyle = p.fill; ctx.fillRect(0, 0, DEFAULTS.pageW, DEFAULTS.pageH);
      ctx.fillStyle = p.color;
      for (const [x, y, w, h] of p.rects) ctx.fillRect(x, y, w, Math.max(h, 1.1));
      ctx.beginPath();
      for (const [x, y, r] of p.dots) { ctx.moveTo(x + 1.3, y); ctx.arc(x, y, Math.max(r, 1.3), 0, 2 * Math.PI); }
      ctx.fill();
    }
  }

  // Export-Hintergrund: mit Papier oder nur die Schrift (PNG durchsichtig, PDF ohne Linien und Farbe)
  const bgEl = $('export-bg');
  const exportPaper = () => getSettings().exportPaper ?? true;
  for (const b of bgEl.children) b.addEventListener('click', () => { setSetting('exportPaper', b.dataset.bg === 'paper'); syncControls(); render(); });

  // Stil-Vorlage
  const styleSel = $('style');
  for (const [key, p] of Object.entries(PRESETS)) styleSel.add(new Option(p.label, key));
  styleSel.addEventListener('change', () => { setSetting('style', styleSel.value); syncControls(); render(); });
  $('style-reset').addEventListener('click', () => {
    const s = current(), styles = { ...(s.styles || {}) };
    delete styles[s.style];
    setSetting('styles', styles);
    syncControls();
    render();
  });

  const inkEl = $('ink');
  for (const [key, ink] of Object.entries({ ...INKS, eigen: { label: 'Eigene Farbe (Farbton-Regler)', color: '' } })) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.setProperty('--c', ink.color);
    b.dataset.ink = key;
    b.setAttribute('aria-label', ink.label);
    b.title = ink.label;
    b.addEventListener('click', () => { setSetting('ink', key); syncControls(); render(); });
    inkEl.append(b);
  }
  const hue = $('ink-hue');
  hue.addEventListener('input', () => {
    setSetting('inkHue', Number(hue.value));
    setSetting('ink', 'eigen');
    syncControls();
    render();
  });

  const paperColorEl = $('paper-color');
  for (const [key, c] of Object.entries(PAPER_COLORS)) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.setProperty('--c', c.paper);
    b.dataset.paperColor = key;
    b.setAttribute('aria-label', 'Papier ' + c.label);
    b.title = c.label;
    b.addEventListener('click', () => { setSetting('paperColor', key); syncControls(); render(); });
    paperColorEl.append(b);
  }

  const makeSlider = (spec, parent, style) => {
    const label = document.createElement('label');
    label.className = 'slider';
    label.innerHTML = `${spec.label} <output></output>${spec.desc ? `<small class="slider-desc">${spec.desc}</small>` : ''}<input type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}">`;
    const range = label.querySelector('input');
    range.addEventListener('input', () => {
      if (style) setSetting('styles', withStyleValue(current(), spec.key, Number(range.value)));
      else setSetting(spec.key, Number(range.value));
      syncControls();
      render();
    });
    parent.append(label);
    return { spec, label, range, out: label.querySelector('output') };
  };
  const sliders = [
    ...STYLE_SLIDERS.map(spec => makeSlider(spec, $('style-controls'), true)),
    ...SLIDERS.map(spec => makeSlider(spec, $('controls'), false)),
  ];

  function syncControls() {
    const s = current();
    for (const { spec, range, out } of sliders) {
      range.value = s[spec.key];
      out.textContent = spec.fmt(s[spec.key], s);
    }
    for (const b of inkEl.children) b.setAttribute('aria-pressed', b.dataset.ink === s.ink);
    inkEl.querySelector('[data-ink="eigen"]').style.setProperty('--c', hueColor(+s.inkHue));
    hue.value = s.inkHue;
    $('ink-hue-out').textContent = s.ink === 'eigen' ? `${s.inkHue}°` : 'aus';
    styleSel.value = PRESETS[s.style] ? s.style : 'normal';
    $('style-desc').textContent = PRESETS[styleSel.value].desc;
    const modified = isModified(s);
    $('style-reset').hidden = !modified;
    $('style-note').textContent = modified ? 'Angepasst – deine Werte für diese Vorlage bleiben gespeichert.' : '';
    for (const b of paperColorEl.children) b.setAttribute('aria-pressed', b.dataset.paperColor === options(s).paperColor);
    for (const b of paperEl.children) b.setAttribute('aria-checked', b.dataset.paper === options(s).paper);
    drawThumbs(options(s).paperColor);
    const withPaper = exportPaper();
    for (const b of bgEl.children) b.setAttribute('aria-checked', (b.dataset.bg === 'paper') === withPaper);
    $('export-bg-hint').textContent = withPaper
      ? 'PDF, Bild und GoodNotes mit Linien und Papierfarbe.'
      : 'Nur die Schrift: Bild (PNG) mit durchsichtigem Hintergrund, PDF ohne Linien.';
  }

  // ---------- Vorschau ----------
  function render() {
    if (!pagesEl.clientWidth) return; // Tab nicht sichtbar
    const s = current(), o = options(s);
    const result = layout(input.value, profile, o, seed);
    const color = inkColor(s);
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
      const withPaper = exportPaper();
      canvas.classList.toggle('transparent', !withPaper);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * pxPerMm, 0, 0, dpr * pxPerMm, 0, 0);
      if (withPaper) drawPaper(ctx, o);
      drawPage(ctx, page, color, o.penSize);
    });

    const notes = [`${result.pages.length} ${result.pages.length === 1 ? 'Seite' : 'Seiten'}`];
    const shown = result.missing.filter(ch => ch !== ' ');
    const noGlyphs = progress(profile).done === 0; // dann erklärt der Hinweis über der Vorschau alles
    if (shown.length && !noGlyphs) notes.push(`Noch nicht aufgenommen: ${shown.join(' ')}`);
    if (isDemo()) notes.push('Beispielschrift – deine eigene nimmst du unter „Aufnehmen“ auf');
    statusEl.textContent = notes.join(' · ');
    $('write-empty').hidden = progress(profile).done > 0;
    statusEl.classList.toggle('warn', shown.length > 0 && !noGlyphs);
  }

  let timer;
  // Ganzen Text löschen (mit Rückfrage) oder durch eine Claude-Antwort ersetzen;
  // der vorherige Text ist bis zum nächsten Tippen wiederherstellbar
  const del = $('text-delete'), restore = $('text-restore');
  let previous = null;
  const syncDelete = () => { del.disabled = !input.value.trim(); };
  const setText = text => { input.value = text; setSetting('text', text); syncDelete(); render(); };
  const keepPrevious = label => {
    previous = input.value;
    restore.lastChild.textContent = label;
    restore.hidden = false;
  };
  del.addEventListener('click', async () => {
    if (!input.value.trim()) return;
    const n = input.value.trim().split(/\s+/).length;
    if (!await ask(`Den ganzen Text löschen (${n} ${n === 1 ? 'Wort' : 'Wörter'})?`, { ok: 'Löschen', danger: true })) return;
    keepPrevious('Gelöschten Text wiederherstellen');
    setText('');
  });
  restore.addEventListener('click', () => {
    if (previous == null) return;
    setText(previous);
    previous = null;
    restore.hidden = true;
  });
  syncDelete();

  input.addEventListener('input', () => {
    syncDelete();
    if (previous != null) { previous = null; restore.hidden = true; } // neu getippt → nicht mehr zurückholen
    clearTimeout(timer);
    timer = setTimeout(() => { setSetting('text', input.value); render(); }, 120);
  });
  $('reroll').addEventListener('click', () => {
    seed = Math.floor(Math.random() * 2 ** 31);
    setSetting('seed', seed);
    render();
  });
  $('reset-settings').addEventListener('click', async () => {
    if (!await ask('Alle Schreib-Einstellungen dieses Profils auf Standard zurücksetzen (auch Stil-Vorlage und deine Anpassungen)?', { ok: 'Zurücksetzen' })) return;
    for (const key of Object.keys(STANDARD)) setSetting(key, STANDARD[key]);
    setSetting('style', 'normal');
    setSetting('styles', {});
    syncControls();
    render();
  });
  new ResizeObserver(() => render()).observe(pagesEl);

  // Zu kleine/große Buchstaben an die eigene typische Größe angleichen; rückgängig bis zum Schließen der App.
  let before = null;
  const replaceGlyphs = glyphs => {
    profile.glyphs = glyphs;
    saveProfile(profile);
    onProfileChanged(); // Aufnahme-Kästchen zeigen sonst noch die alten Striche
    render();
  };
  $('equalize').addEventListener('click', async () => {
    const trial = structuredClone(profile.glyphs);
    const changed = equalize({ ...profile, glyphs: trial });
    if (!changed.length) return info('Alle Buchstaben haben schon eine passende Größe.');
    if (!await ask(`Diese Zeichen werden in der Größe an deine übrigen angepasst:\n${changed.join(' ')}\n\nÜbernehmen? Rückgängig geht, bis du die App schließt.`, { ok: 'Angleichen' })) return;
    before = profile.glyphs;
    replaceGlyphs(trial);
    $('equalize-undo').hidden = false;
  });
  $('equalize-undo').addEventListener('click', () => {
    if (!before) return;
    replaceGlyphs(before);
    before = null;
    $('equalize-undo').hidden = true;
  });

  // ---------- Export ----------
  const shareAgain = $('share-again');
  const exportButtons = [$('export-goodnotes'), $('export-pdf'), $('export-png')];
  $('write-empty-record').addEventListener('click', () => document.getElementById('tab-aufnahme').click());
  let pending = null;

  async function doExport(kind) {
    if (!input.value.trim()) return info('Bitte zuerst Text eingeben.');
    const s = current(), o = options(s);
    const result = layout(input.value, profile, o, seed);
    const miss = result.missing.filter(ch => ch !== ' ');
    if (miss.length && !await ask(`Diese Zeichen hast du noch nicht aufgenommen: ${miss.join(' ')}\n\nSie erscheinen im Export als rote Kästchen. Nimm sie am besten erst unter „Aufnehmen“ auf.`, { title: 'Zeichen fehlen', ok: 'Trotzdem exportieren', cancel: 'Abbrechen' })) return;

    const color = inkColor(s);
    const date = new Date().toISOString().slice(0, 10);
    const labels = exportButtons.map(b => b.innerHTML);
    exportButtons.forEach(b => { b.disabled = true; b.textContent = 'Erstelle …'; });
    shareAgain.hidden = true;
    try {
      let files;
      if (kind === 'goodnotes') {
        // Linien (falls gewählt) als Papier, die Schrift als einzelne radierbare Striche darüber
        const paper = new Uint8Array(await buildPdf({ pages: [{ items: [] }] }, o, color, exportPaper()).arrayBuffer());
        files = [new File([buildGoodnotes(result, o, color, paper, `Handschrift ${date}`)], `handschrift-${date}.goodnotes`, { type: 'application/octet-stream' })];
      } else if (kind === 'pdf') {
        files = [new File([buildPdf(result, o, color, exportPaper())], `handschrift-${date}.pdf`, { type: 'application/pdf' })];
      } else {
        files = [];
        for (const [i, page] of result.pages.entries()) {
          const blob = await buildPng(page, o, color, exportPaper());
          files.push(new File([blob], `handschrift-${date}-seite-${i + 1}.png`, { type: 'image/png' }));
        }
      }
      // Safari verlangt fürs Teilen einen frischen Tipp, wenn das Erzeugen länger gedauert hat.
      if (!await shareFiles(files)) { pending = files; shareAgain.hidden = false; }
    } catch (err) {
      info('Export fehlgeschlagen: ' + err.message);
    } finally {
      exportButtons.forEach((b, i) => { b.disabled = false; b.innerHTML = labels[i]; });
    }
  }
  $('export-goodnotes').addEventListener('click', () => doExport('goodnotes'));
  $('export-pdf').addEventListener('click', () => doExport('pdf'));
  $('export-png').addEventListener('click', () => doExport('png'));
  shareAgain.addEventListener('click', async () => {
    shareAgain.hidden = true;
    try { await shareFiles(pending); } catch (err) { info('Teilen fehlgeschlagen: ' + err.message); }
    pending = null;
  });

  syncControls();
  // Text von außen einsetzen (KI-Tab): ersetzen oder anhängen, der vorherige Text bleibt wiederherstellbar
  function insertText(text, mode = 'replace') {
    if (input.value.trim()) keepPrevious('Vorherigen Text wiederherstellen');
    setText(mode === 'append' && input.value.trim() ? input.value.replace(/\s+$/, '') + '\n\n' + text : text);
  }
  return { render, sync: () => { syncControls(); render(); }, getSeed: () => seed, getText: () => input.value, insertText };
}

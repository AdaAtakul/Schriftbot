// Modul 2: Text → Handschrift mit Live-Vorschau.
import { layout, lineMetrics, DEFAULTS } from './layout.js';
import { drawPage, drawPaper, animatePage } from './render.js';
import { paperShapes } from './paper.js';
import { getSettings, setSetting, saveProfile, activeProfile } from './storage.js';
import { equalize, progress } from './profile.js';
import { PEN_SIZE, PENS, penColor } from './ink.js';
import { buildPdf, buildPng, shareFiles } from './export.js';
import { buildGoodnotes } from './goodnotes.js';
import { PAPER_KINDS, PAPER_COLORS, paperLines } from './paper.js';
import { PRESETS, DEFAULT_STYLE, styleValues, isModified, withStyleValue, migrateStyle, hueColor } from './stil.js';
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
export const inkColor = s => penColor(s.ink === 'eigen' ? hueColor(+s.inkHue || 0) : (INKS[s.ink] || INKS.schwarz).color, s.pen);

const STANDARD = {
  paper: 'liniert-breit', ink: 'schwarz', pen: 'kugel', inkHue: 220, xHeight: 3, lineHeight: 8.8, margin: 20, lineShift: 20, paperColor: 'weiss',
};

const mm = v => Number(v).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' mm';
const pct = v => v + ' %';
// Stil-Regler: gelten für die gewählte Vorlage (Anpassungen werden je Vorlage gemerkt)
const off = v => (v ? pct(v) : 'aus');
// Regler in Alltagssprache. main: sofort sichtbar, sonst unter „Weitere Einstellungen“.
// toggle: An/Aus-Schalter (an = dieser Wert, aus = 0). style: gehört zur Stil-Vorlage (je Vorlage gemerkt).
const STYLE_SLIDERS = [
  { key: 'chaos', main: true, label: 'Unordnung', desc: 'Wie stark Größe, Neigung und Abstand der Buchstaben schwanken', min: 0, max: 150, step: 5, fmt: pct },
  { key: 'weight', main: true, label: 'Stiftdicke', desc: '100 % = so dick wie aufgenommen', min: 40, max: 250, step: 5, fmt: pct },
  { key: 'fix', main: true, toggle: 40, label: 'Kleine Korrekturen', desc: 'Mal ein Buchstabe nachgezogen oder ein vergessenes Wort mit ^ eingefügt' },
  { key: 'connect', label: 'Buchstaben verbinden', desc: 'Nutzt deine aufgenommenen Buchstabenpaare (z. B. „ch“)', min: 0, max: 100, step: 5, fmt: pct },
  { key: 'wobble', label: 'Wellige Zeilen', desc: 'Zeilen laufen leicht auf und ab, der Druck schwankt', min: 0, max: 100, step: 5, fmt: pct },
  { key: 'edges', label: 'Ungleiche Zeilenenden', desc: 'Zeilen beginnen und enden nicht ganz bündig', min: 0, max: 100, step: 5, fmt: pct },
  { key: 'strike', toggle: 30, label: 'Verschreiben und durchstreichen', desc: 'Ab und zu ein Wort falsch begonnen, durchgestrichen und neu geschrieben' },
  { key: 'fatigue', toggle: 40, label: 'Zum Ende hin krakeliger', desc: 'Lange Texte werden gegen Ende größer und unordentlicher' },
];
const SLIDERS = [
  { key: 'xHeight', main: true, label: 'Schriftgröße', min: 1.5, max: 6, step: 0.1, fmt: mm },
  { key: 'lineHeight', label: 'Zeilenabstand', min: 4, max: 20, step: 0.1, fmt: (v, s) => {
    const lm = lineMetrics(options(s));
    return lm.lines ? `${mm(lm.step)} (${lm.lines} ${lm.lines === 1 ? 'Linie' : 'Linien'})` : mm(v);
  } },
  { key: 'margin', label: 'Seitenrand', desc: 'Abstand des ganzen Textes zur Blattkante', min: 5, max: 40, step: 1, fmt: mm },
  { key: 'lineShift', label: 'Zeilen versetzen', desc: 'Jede Zeile rückt für sich etwas nach links oder rechts', min: 0, max: 100, step: 5, fmt: off },
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
    xHeight: +s.xHeight, lineHeight: +s.lineHeight, margin: +s.margin, lineShift: (+s.lineShift || 0) / 100, penSize: PEN_SIZE * s.weight / 100, pen: PENS[s.pen] ? s.pen : 'kugel',
    connect: s.connect / 100, chaos: s.chaos / 100, strike: s.strike / 100, wobble: s.wobble / 100, edges: s.edges / 100,
    fix: s.fix / 100, fatigue: s.fatigue / 100,
    paper, paperColor: PAPER_COLORS[s.paperColor] ? s.paperColor : 'weiss', study: !!s.lernzettel,
    ruled: false, ...paperLines(paper), // Lage der Linien wie in GoodNotes
    pageW: DEFAULTS.pageW, pageH: DEFAULTS.pageH,
  };
}

// Beispieltexte zum Ausprobieren (Knöpfe über dem Textfeld)
const TEMPLATES = {
  "Brief": "Liebe Oma,\n\nvielen Dank für das tolle Geschenk! Ich habe mich riesig gefreut und trage den Schal fast jeden Tag. Bei uns ist alles gut, nur das Wetter könnte schöner sein.\n\nIch hoffe, wir sehen uns bald wieder.\n\nGanz liebe Grüße\ndeine Mia",
  "Notizen": "Biologie – Fotosynthese\n\n- Pflanzen wandeln Lichtenergie in chemische Energie um\n- Ort: Chloroplasten in den Blattzellen\n- Ausgangsstoffe: Wasser und Kohlenstoffdioxid\n- Produkte: Traubenzucker und Sauerstoff\n\nMerke: ohne Licht keine Fotosynthese!",
  "To-do": "Erledigen bis Freitag\n\n- Mathe-Hausaufgaben S. 42, Nr. 3 bis 5\n- Bücher in die Bücherei bringen\n- Geschenk für Lena besorgen\n- Fahrrad aufpumpen\n- Oma anrufen",
  "Grußkarte": "Alles Liebe zum Geburtstag!\n\nLiebe Lena,\nich wünsche dir ein wunderschönes neues Lebensjahr voller Glück, Gesundheit und vieler kleiner Abenteuer. Lass dich heute richtig feiern!\n\nDein Jonas",
  "Entschuldigung": "Sehr geehrte Frau Becker,\n\nleider konnte meine Tochter Mia am Montag wegen einer Erkältung nicht am Unterricht teilnehmen. Ich bitte, ihr Fehlen zu entschuldigen.\n\nMit freundlichen Grüßen\nAnna Schneider",
};

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

  // Stil: ein Regler in der Leiste über alle Vorlagen, von sehr ordentlich bis sehr unordentlich
  const STYLE_ORDER = Object.keys(PRESETS);
  const styleRange = $('style-range');
  styleRange.max = STYLE_ORDER.length - 1;
  styleRange.addEventListener('input', () => { setSetting('style', STYLE_ORDER[styleRange.value]); syncControls(); renderSoon(); });

  // Aufklapp-Menüs der Leiste (Papier, Tinte, Feineinstellungen): eins zur Zeit, schließen mit Esc oder Tipp daneben
  const popBtns = [...document.querySelectorAll('.lookbar [data-pop]')];
  const closePops = except => {
    for (const b of popBtns) {
      if (b === except) continue;
      b.setAttribute('aria-expanded', 'false');
      $(b.dataset.pop).hidden = true;
    }
  };
  for (const b of popBtns) b.addEventListener('click', e => {
    e.stopPropagation();
    const pop = $(b.dataset.pop), open = pop.hidden;
    closePops(b);
    pop.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    if (open) {
      // unter dem Knopf ausrichten, aber nicht über den Rand der Bühne hinaus
      const wrap = pop.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left - wrap.left + r.width / 2 - pop.offsetWidth / 2, wrap.width - pop.offsetWidth - 8));
      pop.style.left = left + 'px';
    }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.pop, .lookbar [data-pop]')) closePops(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePops(); });
  $('style-reset').addEventListener('click', () => {
    const s = current(), styles = { ...(s.styles || {}) };
    delete styles[s.style];
    setSetting('styles', styles);
    syncControls();
    render();
  });

  // Stiftart: Form und Breite der Striche (GoodNotes-Export bleibt Kugelschreiber, nur die Breite passt sich an)
  const penEl = $('pen');
  for (const [key, p] of Object.entries(PENS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.pen = key;
    b.textContent = p.label;
    b.addEventListener('click', () => { setSetting('pen', key); syncControls(); render(); });
    penEl.append(b);
  }
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

  const makeSlider = (spec, style) => {
    const parent = $(spec.main ? 'controls-main' : 'controls-more');
    const label = document.createElement('label');
    const set = v => {
      if (style) setSetting('styles', withStyleValue(current(), spec.key, v));
      else setSetting(spec.key, v);
      syncControls();
    };
    if (spec.toggle) {
      // An/Aus-Schalter: aus = 0, an = Wert der Vorlage (falls sie einen hat) oder spec.toggle
      label.className = 'switch-row';
      label.innerHTML = `<span><span class="switch-label">${spec.label}</span><small class="slider-desc">${spec.desc}</small></span><input type="checkbox" role="switch" class="switch">`;
      const box = label.querySelector('input');
      box.addEventListener('change', () => { set(box.checked ? (PRESETS[current().style]?.[spec.key] || spec.toggle) : 0); render(); });
      parent.append(label);
      return { spec, label, box };
    }
    label.className = 'slider';
    label.innerHTML = `${spec.label} <output></output>${spec.desc ? `<small class="slider-desc">${spec.desc}</small>` : ''}<input type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}">`;
    const range = label.querySelector('input');
    range.addEventListener('input', () => {
      set(Number(range.value));
      renderSoon(); // flüssig: höchstens einmal pro Bild, erst die sichtbare Seite
    });
    parent.append(label);
    return { spec, label, range, out: label.querySelector('output') };
  };
  const sliders = [
    ...SLIDERS.filter(x => x.main).map(spec => makeSlider(spec, false)),
    ...STYLE_SLIDERS.map(spec => makeSlider(spec, true)),
    ...SLIDERS.filter(x => !x.main).map(spec => makeSlider(spec, false)),
  ];

  function syncControls() {
    const s = current();
    for (const { spec, range, out, box } of sliders) {
      if (box) { box.checked = s[spec.key] > 0; continue; }
      range.value = s[spec.key];
      out.textContent = spec.fmt(s[spec.key], s);
    }
    for (const b of inkEl.children) b.setAttribute('aria-pressed', b.dataset.ink === s.ink);
    inkEl.querySelector('[data-ink="eigen"]').style.setProperty('--c', hueColor(+s.inkHue));
    hue.value = s.inkHue;
    $('ink-hue-out').textContent = s.ink === 'eigen' ? `${s.inkHue}°` : 'aus';
    const styleKey = PRESETS[s.style] ? s.style : DEFAULT_STYLE;
    styleRange.value = STYLE_ORDER.indexOf(styleKey);
    $('style-out').textContent = PRESETS[styleKey].label;
    styleRange.setAttribute('aria-valuetext', PRESETS[styleKey].label);
    for (const b of penEl.children) b.setAttribute('aria-checked', b.dataset.pen === options(s).pen);
    $('style-desc').textContent = PRESETS[styleKey].desc;
    $('study-toggle').checked = !!s.lernzettel;
    $('study-tools').hidden = !s.lernzettel;
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
  // Beim Ziehen eines Reglers: höchstens ein Neuzeichnen pro Bild und nur die sichtbaren Seiten;
  // die übrigen Seiten folgen, sobald der Regler kurz still steht.
  let rafId = 0, fullTimer = 0;
  function renderSoon() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render({ quick: true });
      clearTimeout(fullTimer);
      fullTimer = setTimeout(() => render(), 220);
    });
  }
  const isVisible = el => {
    const r = el.getBoundingClientRect(), c = pagesEl.getBoundingClientRect();
    return r.bottom > Math.max(0, c.top) && r.top < Math.min(innerHeight, c.bottom) && r.right > c.left && r.left < c.right;
  };

  // Abspielen: die sichtbare Seite schreibt sich mit den echten Strichzeiten hin – beim ersten Anzeigen,
  // nach „Neu würfeln“ und per Knopf. Jede Änderung (Tippen, Regler) zeichnet sofort fertig.
  const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Am Handy steht die Seite sofort fertig da (sonst ist sie beim ersten Blick fast leer); abspielen per Knopf
  let playNext = !stillMotion() && !matchMedia('(max-width: 700px)').matches, anim = null;
  const stopAnim = () => { anim?.cancel(); anim = null; };
  $('play').addEventListener('click', () => { closePops(); stopAnim(); playNext = true; render(); });

  // Leeres Feld: ein kurzes Beispiel auf dem Blatt, damit man sieht, was passiert (Export bleibt leer)
  const shownText = () => input.value.trim() ? input.value : 'Hallo! So sieht dein Text in Handschrift aus.';

  function render({ quick = false } = {}) {
    if (!quick) clearTimeout(fullTimer);
    if (!pagesEl.clientWidth) return; // Tab nicht sichtbar
    const s = current(), o = options(s);
    const result = layout(shownText(), profile, o, seed);
    const color = inkColor(s);
    // Beim Ziehen eines Reglers in einfacher Auflösung zeichnen (4× weniger Pixel am iPad), danach scharf
    const dpr = quick ? 1 : (window.devicePixelRatio || 1);
    const cssW = pageWidth(o);
    const pxPerMm = cssW / o.pageW;
    // Läuft gerade eine Animation zu genau diesem Bild (z. B. nur Größenänderung gemeldet), sie nicht abbrechen
    const key = [shownText(), seed, JSON.stringify(o), color, exportPaper()].join('|');
    if (anim && anim.key !== key) stopAnim();

    // Vorhandene Canvas wiederverwenden, damit die Vorschau beim Tippen nicht flackert.
    while (pagesEl.children.length > result.pages.length) pagesEl.lastChild.remove();
    result.pages.forEach((page, i) => {
      let canvas = pagesEl.children[i];
      if (!canvas) pagesEl.append(canvas = document.createElement('canvas'));
      canvas.className = 'page';
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssW * o.pageH / o.pageW + 'px';
      if (quick && !isVisible(canvas)) return; // unsichtbare Seiten beim Ziehen auslassen
      // Größe nur bei Bedarf setzen: das Neu-Anlegen des Speichers kostet bei jedem Schritt Zeit
      const w = Math.round(cssW * dpr), h = Math.round(cssW * dpr * o.pageH / o.pageW);
      if (anim && anim.index === i) {
        if (canvas.width === w && canvas.height === h) return; // diese Seite schreibt sich gerade hin
        stopAnim(); playNext = true; // Größe hat sich geändert (z. B. beim Start): von vorn beginnen
      }
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext('2d');
      const withPaper = exportPaper();
      canvas.classList.toggle('transparent', !withPaper);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * pxPerMm, 0, 0, dpr * pxPerMm, 0, 0);
      if (withPaper) drawPaper(ctx, o);
      if (playNext && !quick && !anim && isVisible(canvas) && progress(profile).done > 0) {
        playNext = false;
        anim = { key, index: i, cancel: animatePage(ctx, page, color, o.penSize, o.pen) };
        setTimeout(() => { if (anim?.key === key) anim = null; }, 6000); // spätestens dann ist sie fertig
        return;
      }
      drawPage(ctx, page, color, o.penSize, o.pen);
    });

    pageCount = result.pages.length;
    const words = input.value.trim() ? input.value.trim().split(/\s+/).length : 0;
    const notes = words ? [`${words} ${words === 1 ? 'Wort' : 'Wörter'}`, `${pageCount} ${pageCount === 1 ? 'Seite' : 'Seiten'}`] : [];
    const shown = result.missing.filter(ch => ch !== ' ');
    const noGlyphs = progress(profile).done === 0; // dann erklärt der Hinweis über der Vorschau alles
    if (shown.length && !noGlyphs) notes.push(`Noch nicht aufgenommen: ${shown.join(' ')}`);
    if (isDemo()) notes.push('Deine eigene Schrift: unter „Eigene Schrift“');
    statusEl.textContent = notes.join(' · ');
    $('write-empty').hidden = progress(profile).done > 0;
    statusEl.classList.toggle('warn', shown.length > 0 && !noGlyphs);
    updatePageInfo();
  }

  // ---------- Zoom und Blättern ----------
  // 100 % = Seitenbreite (Schrift sofort lesbar); „Ganze Seite“ zeigt das ganze Blatt. Stufen wie in Vorschau-Apps
  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  let zoom = 1, pageCount = 1, pageIndex = 0, fitWhole = false;
  const barWrap = document.querySelector('.view-schreiben .lookbar-wrap');
  function pageWidth(o) {
    // Platz für die schwebende Leiste oben (sie bricht auf schmalen Bildschirmen in zwei Zeilen um)
    const floating = getComputedStyle(barWrap).position === 'absolute';
    pagesEl.style.paddingTop = floating ? barWrap.offsetTop + barWrap.offsetHeight + 16 + 'px' : '';
    const st = getComputedStyle(pagesEl);
    const availW = pagesEl.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
    const availH = pagesEl.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom);
    const narrow = matchMedia('(max-width: 700px)').matches;
    const fit = narrow || availH < 200 || !fitWhole ? availW : Math.min(availW, availH * o.pageW / o.pageH);
    return Math.max(120, Math.round(Math.min(fit, 1000) * zoom));
  }
  const zoomVal = $('zoom-reset');
  function setZoom(z) {
    zoom = z;
    zoomVal.textContent = z === 1 ? (fitWhole ? 'Ganze Seite' : 'Seitenbreite') : Math.round(z * 100) + ' %';
    zoomVal.title = fitWhole ? 'Auf Seitenbreite vergrößern' : 'Ganze Seite zeigen';
    $('zoom-out').disabled = z <= ZOOMS[0];
    $('zoom-in').disabled = z >= ZOOMS[ZOOMS.length - 1];
    render();
  }
  $('zoom-in').addEventListener('click', () => setZoom(ZOOMS.find(z => z > zoom + 1e-6) ?? zoom));
  $('zoom-out').addEventListener('click', () => setZoom([...ZOOMS].reverse().find(z => z < zoom - 1e-6) ?? zoom));
  zoomVal.addEventListener('click', () => { if (zoom === 1) fitWhole = !fitWhole; setZoom(1); });
  function updatePageInfo() {
    const c = pagesEl.getBoundingClientRect(), mid = c.top + c.height / 2;
    let best = 0, dist = Infinity;
    [...pagesEl.children].forEach((pg, i) => {
      const r = pg.getBoundingClientRect(), d = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0;
      if (d < dist) { dist = d; best = i; }
    });
    pageIndex = Math.min(best, pageCount - 1);
    $('page-info').textContent = `Seite ${pageIndex + 1} von ${pageCount}`;
    $('page-prev').disabled = pageIndex === 0;
    $('page-next').disabled = pageIndex >= pageCount - 1;
  }
  const goPage = i => pagesEl.children[i]?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start', inline: 'nearest' });
  $('page-prev').addEventListener('click', () => goPage(pageIndex - 1));
  $('page-next').addEventListener('click', () => goPage(pageIndex + 1));
  let scrollRaf = 0;
  pagesEl.addEventListener('scroll', () => { cancelAnimationFrame(scrollRaf); scrollRaf = requestAnimationFrame(updatePageInfo); }, { passive: true });

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
    closePops();
    seed = Math.floor(Math.random() * 2 ** 31);
    setSetting('seed', seed);
    stopAnim();
    playNext = !stillMotion();
    render();
  });
  $('reset-settings').addEventListener('click', async () => {
    if (!await ask('Alle Einstellungen dieser Schrift auf Standard zurücksetzen (auch Stil und deine Anpassungen)?', { ok: 'Zurücksetzen' })) return;
    for (const key of Object.keys(STANDARD)) setSetting(key, STANDARD[key]);
    setSetting('style', DEFAULT_STYLE);
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
  // Ein Knopf „Exportieren“ (Kopfzeile) öffnet das Export-Fenster: Format und Hintergrund an einem Ort
  const dlg = $('export-dlg'), kindEl = $('export-kind'), go = $('export-go'), openBtn = $('export-open');
  const exportButtons = [go, openBtn];
  const KIND_LABEL = { goodnotes: 'Für GoodNotes sichern', pdf: 'Als PDF sichern', png: 'Als Bild sichern' };
  const exportKind = () => (KIND_LABEL[getSettings().exportKind] ? getSettings().exportKind : 'goodnotes');
  function syncExport() {
    const kind = exportKind();
    for (const b of kindEl.children) b.setAttribute('aria-checked', b.dataset.kind === kind);
    go.textContent = KIND_LABEL[kind];
    const name = activeProfile()?.name || 'Handschrift';
    $('export-summary').textContent = `${pageCount} ${pageCount === 1 ? 'Seite' : 'Seiten'} · A4 · ${name}`;
  }
  for (const b of kindEl.children) b.addEventListener('click', () => { setSetting('exportKind', b.dataset.kind); syncExport(); });
  openBtn.addEventListener('click', () => {
    if (!input.value.trim()) return info('Bitte zuerst Text eingeben.');
    syncControls();
    syncExport();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  });
  go.addEventListener('click', () => { dlg.close?.(); doExport(exportKind()); });
  $('write-empty-record').addEventListener('click', () => document.getElementById('tab-aufnahme').click());
  let pending = null;

  async function doExport(kind) {
    if (!input.value.trim()) return info('Bitte zuerst Text eingeben.');
    const s = current(), o = options(s);
    const result = layout(input.value, profile, o, seed);
    const miss = result.missing.filter(ch => ch !== ' ');
    if (miss.length && !await ask(`Diese Zeichen hast du noch nicht aufgenommen: ${miss.join(' ')}\n\nSie erscheinen im Export als rote Kästchen. Nimm sie am besten erst unter „Eigene Schrift“ auf.`, { title: 'Zeichen fehlen', ok: 'Trotzdem exportieren', cancel: 'Abbrechen' })) return;

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
  shareAgain.addEventListener('click', async () => {
    shareAgain.hidden = true;
    try { await shareFiles(pending); } catch (err) { info('Teilen fehlgeschlagen: ' + err.message); }
    pending = null;
  });

  syncControls();
  // Text von außen einsetzen (KI-Tab): ersetzen oder anhängen, der vorherige Text bleibt wiederherstellbar
  // Vorlagen nach Anlass: ersetzen den Text, der vorherige bleibt wiederherstellbar
  const tplEl = $('templates');
  for (const [name, text] of Object.entries(TEMPLATES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tpl-chip';
    b.textContent = name;
    b.addEventListener('click', () => insertText(text));
    tplEl.append(b);
  }

  function insertText(text, mode = 'replace') {
    if (input.value.trim()) keepPrevious('Vorherigen Text wiederherstellen');
    setText(mode === 'append' && input.value.trim() ? input.value.replace(/\s+$/, '') + '\n\n' + text : text);
  }
  // ---------- Lernzettel-Modus (Beta): # Titel, ==Marker== usw. werden gezeichnet ----------
  const studyToggle = $('study-toggle'), studyTools = $('study-tools');
  const LINE_MARK = /^(#|!!|-|\*|\[ \]|\[[xX]\]) /;
  function setStudy(on) {
    setSetting('lernzettel', !!on);
    syncControls();
    render();
  }
  studyToggle.addEventListener('change', () => setStudy(studyToggle.checked));
  for (const b of studyTools.querySelectorAll('button')) b.addEventListener('click', () => {
    const v = input.value, a = input.selectionStart, e = input.selectionEnd, { line, wrap } = b.dataset;
    if (line) {
      // Zeichen am Zeilenanfang setzen, ersetzen oder (gleiches nochmal) wieder entfernen
      const ls = v.lastIndexOf('\n', a - 1) + 1, old = v.slice(ls).match(LINE_MARK)?.[0] || '';
      input.setRangeText(old === line ? '' : line, ls, ls + old.length, 'end');
    } else if (wrap) {
      const sel = v.slice(a, e) || 'Wort';
      input.setRangeText(wrap + sel + wrap, a, e, 'select');
    } else input.setRangeText(b.dataset.insert, a, e, 'end');
    input.focus();
    input.dispatchEvent(new Event('input'));
  });

  return { render, sync: () => { syncControls(); render(); }, getSeed: () => seed, getText: () => input.value, insertText, setStudy };
}

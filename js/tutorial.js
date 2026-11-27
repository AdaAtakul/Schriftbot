// Kurze Einführung beim ersten Öffnen; über den ?-Knopf jederzeit wieder aufrufbar.
// Jeder Schritt zeigt im Hintergrund den passenden Tab.
const DONE_KEY = 'tutorial-gesehen';

// Ein echtes, handgeschriebenes „a“ (aus der Beispielschrift), das sich langsam selbst nachzeichnet
const LETTER = {"w": 86, "h": 85, "paths": ["M64.6 20.0 L63.1 16.8 L59.5 15.9 L54.8 16.3 L51.2 17.2 L46.6 19.5 L41.2 22.3 L38.3 24.2 L35.6 26.0 L33.3 28.2 L28.7 32.8 L24.2 37.4 L21.9 39.7 L18.2 43.8 L16.0 47.5 L15.0 51.2 L15.0 54.8 L17.2 58.0 L21.4 60.4 L25.5 61.3 L30.2 61.3 L34.3 61.3 L39.3 59.9 L44.3 58.0 L49.4 55.7 L52.1 54.4 L55.7 51.6 L59.5 48.4 L63.1 44.8 L65.5 41.1 L67.3 37.9 L68.2 33.7 L68.2 30.1 L67.3 26.9 L66.4 23.6 L65.5 20.0 L64.6 16.3 L62.2 20.5 L62.2 23.6 L61.7 27.8 L61.7 32.3 L61.7 36.5 L61.7 41.5 L62.2 47.9 L63.1 53.0 L64.0 57.5 L65.5 61.7 L67.3 64.9 L69.6 67.2"]};
function traceArt() {
  const ns = 'http://www.w3.org/2000/svg';
  const wrap = document.createElement('div');
  wrap.className = 'tour-art';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${LETTER.w} ${LETTER.h}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Ein handgeschriebenes a wird nachgezeichnet');
  const lines = document.createElementNS(ns, 'g');
  lines.setAttribute('class', 'tour-art-lines');
  for (const y of [LETTER.h * 0.19, LETTER.h * 0.8]) {
    const l = document.createElementNS(ns, 'line');
    l.setAttribute('x1', 0); l.setAttribute('x2', LETTER.w); l.setAttribute('y1', y); l.setAttribute('y2', y);
    lines.append(l);
  }
  svg.append(lines);
  const paths = LETTER.paths.map(d => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    p.setAttribute('class', 'tour-art-ink');
    svg.append(p);
    return p;
  });
  // Nachzeichnen, kurz stehen lassen, ausblenden, von vorn (bei „Bewegung reduzieren“: fertig gezeichnet)
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = () => {
    if (!wrap.isConnected && run.started) return;
    run.started = true;
    paths.forEach(p => p.animate(
      [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.62 }, { strokeDashoffset: 0, opacity: 1, offset: 0.9 }, { strokeDashoffset: 0, opacity: 0 }],
      { duration: 4200, easing: 'ease-in-out', fill: 'forwards' }));
    setTimeout(run, 4500);
  };
  if (still || !paths[0].animate) paths.forEach(p => { p.style.strokeDashoffset = 0; });
  else requestAnimationFrame(run);
  wrap.append(svg);
  return wrap;
}


const STEPS = demo => [
  {
    view: 'schreiben',
    title: 'Willkommen bei DeineSchrift',
    text: 'DeineSchrift schreibt getippten Text in Handschrift – als PDF, Bild oder GoodNotes-Datei. ' +
      'Alles bleibt auf deinem Gerät, ohne Konto.' +
      (demo ? '\n\nGerade ist eine Beispielschrift ausgewählt. Tipp einfach etwas in das Textfeld.' : ''),
  },
  {
    view: 'schreiben',
    title: '1. Schreiben',
    art: traceArt,
    text: 'Links tippst oder fügst du deinen Text ein, rechts erscheint er sofort in Handschrift. In der Leiste über der Seite wählst du eine Schrift, den Stil, Papier und Tinte. ' +
      'Oben rechts unter „Exportieren“ sicherst du alles als GoodNotes-Datei, PDF oder Bild.',
  },
  {
    view: 'blatt',
    title: '2. Ausfüllen',
    text: 'Hier füllst du PDFs und Arbeitsblätter in Handschrift aus: Tippe deine Einträge vorher in Blau in das PDF und öffne es hier. ' +
      'DeineSchrift ersetzt den blauen Text an derselben Stelle durch Handschrift.',
  },
  {
    view: 'aufnahme',
    title: '3. Eigene Schrift aufnehmen',
    text: 'Unter „Aufnehmen“ schreibst du jedes Zeichen ein paar Mal – am besten mit dem Apple Pencil, Finger oder Maus gehen auch. ' +
      'Plane etwa 20 bis 30 Minuten ein; du kannst jederzeit aufhören und später weitermachen.',
  },
  {
    view: 'profil',
    title: 'Wichtig: Schrift sichern',
    text: 'Deine Handschrift liegt nur in diesem Browser. Füge DeineSchrift zum Home-Bildschirm hinzu (Safari: Teilen → „Zum Home-Bildschirm“) ' +
      'und sichere ab und zu im Bereich „Profil“ mit „Alle Profile sichern“.',
    link: true,
  },
];

export const tutorialSeen = () => { try { return !!localStorage.getItem(DONE_KEY); } catch { return true; } };

export function showTutorial({ goTo, demo = false, onClose = () => {} }) {
  document.querySelector('.tour-bg')?.remove();
  const steps = STEPS(demo);
  let i = 0;
  const bg = document.createElement('div');
  bg.className = 'tour-bg';
  const box = document.createElement('div');
  box.className = 'tour';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'tour-title');
  bg.append(box);
  // Gilt als gesehen, sobald sie einmal erschienen ist (auch wenn die App mittendrin geschlossen wird)
  try { localStorage.setItem(DONE_KEY, '1'); } catch {}
  bg.addEventListener('click', e => { if (e.target === bg) close(); });

  const close = () => {
    try { localStorage.setItem(DONE_KEY, '1'); } catch {}
    bg.remove();
    document.removeEventListener('keydown', onKey);
    onClose();
  };
  const onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && i < steps.length - 1) { i++; draw(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); }
  };

  function draw() {
    const s = steps[i], last = i === steps.length - 1;
    goTo(s.view);
    box.replaceChildren();
    const step = document.createElement('p');
    step.className = 'tour-step';
    step.textContent = `Schritt ${i + 1} von ${steps.length}`;
    const h = document.createElement('h2');
    h.id = 'tour-title';
    h.textContent = s.title;
    box.append(step, h);
    if (s.art) box.append(s.art());
    for (const para of s.text.split('\n\n')) {
      const p = document.createElement('p');
      p.textContent = para;
      box.append(p);
    }
    if (s.link) {
      const a = document.createElement('a');
      a.href = 'anleitung';
      a.textContent = 'Ausführliche Anleitung und häufige Fragen';
      box.append(a);
    }
    const dots = document.createElement('div');
    dots.className = 'tour-dots';
    dots.setAttribute('aria-hidden', 'true');
    steps.forEach((_, k) => { const d = document.createElement('span'); if (k === i) d.className = 'on'; dots.append(d); });
    const row = document.createElement('div');
    row.className = 'row';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = last ? 'Schließen' : 'Überspringen';
    skip.addEventListener('click', close);
    row.append(skip);
    if (i > 0) {
      const back = document.createElement('button');
      back.type = 'button';
      back.textContent = 'Zurück';
      back.addEventListener('click', () => { i--; draw(); });
      row.append(back);
    }
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'primary';
    next.textContent = last ? 'Los geht’s' : 'Weiter';
    next.addEventListener('click', () => {
      if (last) { close(); goTo('schreiben'); } else { i++; draw(); }
    });
    row.append(next);
    box.append(dots, row);
    next.focus();
  }

  document.addEventListener('keydown', onKey);
  document.body.append(bg);
  draw();
}

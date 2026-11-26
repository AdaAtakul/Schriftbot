// Kurze Einführung beim ersten Öffnen; über den ?-Knopf jederzeit wieder aufrufbar.
// Jeder Schritt zeigt im Hintergrund den passenden Tab.
const DONE_KEY = 'tutorial-gesehen';

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
    text: 'Links tippst oder fügst du deinen Text ein, rechts erscheint er sofort in Handschrift. In der Leiste über der Seite wählst du Stil, Papier und Tinte. ' +
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

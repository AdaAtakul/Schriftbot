// Claude über den Schriftbot-Assistenten (ein Claude-Artifact, läuft über das eigene Claude-Abo, ohne API-Schlüssel).
// Ablauf: Assistent öffnen → Claude schreibt → dort bestätigen (kopiert) → hier „Einfügen“ → Vorschau → Ersetzen/Anhängen.
import { cleanPasted, mergeText, wordCount } from './einfuegen.js';

export const ASSISTANT_URL = 'https://claude.ai/artifact/L4y3bjCy9kEdLnYdMK1k5j';
const PENDING = 'claudePending';
const PENDING_MS = 60 * 60 * 1000; // eine Stunde lang an die Antwort erinnern

export function markPending() { try { localStorage.setItem(PENDING, String(Date.now())); } catch {} }
export function clearPending() { try { localStorage.removeItem(PENDING); } catch {} }
export function isPending() {
  try { return Date.now() - Number(localStorage.getItem(PENDING) || 0) < PENDING_MS; } catch { return false; }
}

// ---------- Kurze Meldung unten ----------
let toastTimer;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'toast', className: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// ---------- Blatt von unten (eigene Dialoge statt alert/confirm) ----------
function sheet(build) {
  const t = document.getElementById('toast');
  if (t) t.hidden = true; // Meldung nicht über das Blatt legen
  return new Promise(resolve => {
    const bg = Object.assign(document.createElement('div'), { className: 'sheet-bg' });
    const box = Object.assign(document.createElement('div'), { className: 'sheet' });
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const done = value => { bg.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
    const onKey = e => { if (e.key === 'Escape') done(null); };
    bg.addEventListener('click', e => { if (e.target === bg) done(null); });
    document.addEventListener('keydown', onKey);
    build(box, done);
    bg.append(box);
    document.body.append(bg);
    box.querySelector('textarea, button.primary, button')?.focus();
  });
}
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const button = (text, cls, onClick) => { const b = el('button', { className: cls || '', textContent: text }); b.type = 'button'; b.addEventListener('click', onClick); return b; };

// Text von Hand einfügen lassen (wenn Safari das Lesen der Zwischenablage nicht erlaubt)
function manualPaste() {
  return sheet((box, done) => {
    const ta = el('textarea', { rows: 7, placeholder: 'Lange drücken, dann „Einfügen“ …' });
    ta.className = 'sheet-text';
    const next = button('Weiter', 'primary', () => done(ta.value));
    next.disabled = true;
    ta.addEventListener('input', () => { next.disabled = !ta.value.trim(); });
    box.append(
      el('h2', { textContent: 'Antwort hier einfügen' }),
      el('p', { className: 'hint', textContent: 'Tippe in das Feld, halte gedrückt und wähle „Einfügen“.' }),
      ta,
      el('div', { className: 'row' }, next, button('Abbrechen', '', () => done(null))),
    );
  });
}

// Vorschau und Entscheidung: Ersetzen, Anhängen oder Abbrechen
function confirmInsert(text, current, target) {
  return sheet((box, done) => {
    const preview = el('div', { className: 'sheet-preview', textContent: text });
    const n = wordCount(text);
    const actions = el('div', { className: 'row' });
    if (current.trim()) {
      actions.append(
        button('Text ersetzen', 'primary', () => done('replace')),
        button('Anhängen', '', () => done('append')),
      );
    } else actions.append(button('Einfügen', 'primary', () => done('replace')));
    actions.append(button('Abbrechen', '', () => done(null)));
    box.append(
      el('h2', { textContent: `Antwort von Claude ${target}?` }),
      preview,
      el('p', { className: 'hint small', textContent: `${n} ${n === 1 ? 'Wort' : 'Wörter'}` + (current.trim() ? ' · Dein bisheriger Text lässt sich danach wiederherstellen.' : '') }),
      actions,
    );
  });
}

// Antwort aus der Zwischenablage holen, bestätigen lassen, Ergebnis zurückgeben: { text, mode } oder null.
// Muss direkt aus einem Tipp aufgerufen werden (Safari erlaubt das Lesen nur dann).
export async function pasteFromClaude({ current = '', target = 'einfügen' } = {}) {
  let raw = '';
  try { raw = await navigator.clipboard.readText(); } catch {}
  let text = cleanPasted(raw);
  if (!text) {
    text = cleanPasted(await manualPaste());
    if (!text) return null;
  }
  const mode = await confirmInsert(text, current, target);
  if (!mode) return null;
  clearPending();
  return { text: mergeText(current, text, mode), mode };
}

// Assistenten öffnen; vorhandenen Text gleich mitgeben (kopiert), damit man ihn dort nur einfügen muss
export function openAssistant(current = '') {
  markPending();
  if (current.trim() && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(current)
      .then(() => toast('Dein Text ist kopiert. Im Assistenten bei „Aufgabe oder dein Text“ einfügen.'))
      .catch(() => {});
  }
}

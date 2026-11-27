// KI-Brücke (Beta): Texte mit Google Gemini schreiben lassen – mit dem eigenen, kostenlosen Schlüssel des Nutzers.
// Der Schlüssel bleibt nur auf diesem Gerät (localStorage, nicht in Sicherungen); Anfragen gehen direkt vom
// Gerät an Google, nie über DeineSchrift. Anleitung zum Schlüssel: gemini-schluessel.html
import { ask, info } from './dialog.js';

const KEY = 'gemini-key', MODEL = 'gemini-modell';
const API = 'https://generativelanguage.googleapis.com/v1beta';
// Bevorzugt die schnellen Flash-Modelle (im kostenlosen Kontingent); Lite als Ausweich bei erreichtem Limit
const PREFER = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

const store = {
  get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};
export const hasKey = () => !!store.get(KEY);

// Aufträge an die KI: nur Zeichen, die DeineSchrift als Handschrift setzen kann
const RULES = 'Schreibe auf Deutsch. Keine Emojis, keine Tabellen, kein Fettdruck mit Sternchen, keine Sonderzeichen außer normalen Satzzeichen. Antworte nur mit dem Text selbst, ohne Einleitung oder Nachbemerkung.';
export const MODES = {
  lernzettel: {
    label: 'Lernzettel', placeholder: 'Thema oder Text, z. B. „Photosynthese, Klasse 9, kurz“',
    system: 'Du schreibst kurze, übersichtliche Lernzettel für Schüler. Erste Zeile: „# “ und der Titel. Nutze sonst nur diese Zeichen: ' +
      '„- “ am Zeilenanfang für Stichpunkte, „==Begriff==“ für die 1 bis 3 wichtigsten Begriffe, „_Wort_“ zum Unterstreichen, ' +
      '„-> “ für Folgerungen, „!! “ am Zeilenanfang für genau einen Merksatz, „[ ] “ am Zeilenanfang für Lernaufgaben. ' +
      'Höchstens 14 kurze Zeilen. ' + RULES,
  },
  auftrag: {
    label: 'Auftrag', placeholder: 'z. B. „Schreib eine Entschuldigung für Montag, Grund: Erkältung“',
    system: 'Du schreibst Texte, die anschließend in echter Handschrift auf Papier gesetzt werden. Schreibe natürlich und passend zum Anlass. ' + RULES,
  },
  ueberarbeiten: {
    label: 'Überarbeiten', placeholder: 'z. B. „kürzer“, „einfacher“ oder leer lassen für Rechtschreibung',
    system: 'Überarbeite den Text nach der Anweisung. Ohne Anweisung: nur Rechtschreibung und Zeichensetzung korrigieren. ' +
      'Behalte Zeilen, die mit „# “, „- “, „!! “, „[ ] “ oder „-> “ beginnen, und die Zeichen „==“ und „_“ bei. ' + RULES,
  },
};

// Antwort aufräumen: Codeblöcke, Fettdruck und Leerzeilen am Rand entfernen
export function cleanAnswer(text) {
  return String(text || '').replace(/^```\w*\n?|```$/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s+|\s+$/g, '');
}

// Verständliche Fehlermeldung zu einer Antwort der Gemini-API
export function errorText(status, message = '') {
  if (status === 400 && /api key|API_KEY/i.test(message)) return 'Der Schlüssel ist ungültig. Prüfe, ob du ihn vollständig kopiert hast.';
  if (status === 401 || status === 403) return 'Google lehnt den Schlüssel ab (kein Zugriff). Erstelle in Google AI Studio einen neuen Schlüssel.';
  if (status === 429) return 'Das kostenlose Tageslimit deines Schlüssels ist erreicht. Morgen geht es wieder.';
  if (status >= 500) return 'Gemini ist gerade überlastet. Versuch es in einer Minute noch einmal.';
  return 'Die KI hat nicht geantwortet' + (message ? `: ${message}` : '.');
}

async function request(path, key, body) {
  let res;
  try {
    res = await fetch(`${API}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-goog-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw Object.assign(new Error('Keine Verbindung zu Google. Bist du online?'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(errorText(res.status, data?.error?.message)), { status: res.status });
  return data;
}

// Schlüssel prüfen und ein passendes Modell merken (Google ändert die Modellnamen von Zeit zu Zeit)
async function chooseModel(key) {
  const data = await request('models?pageSize=200', key);
  const names = (data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  return PREFER.find(n => names.includes(n)) || names.find(n => /flash/.test(n) && !/image|tts|audio|live|embed/.test(n)) || names[0];
}

export async function generate(mode, prompt, text = '') {
  const key = store.get(KEY);
  if (!key) throw new Error('Noch kein Schlüssel eingetragen.');
  const m = MODES[mode];
  const user = mode === 'ueberarbeiten' ? `Anweisung: ${prompt || 'Rechtschreibung korrigieren'}\n\nText:\n${text}` : prompt;
  const body = { systemInstruction: { parts: [{ text: m.system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.6 } };
  let model = store.get(MODEL) || PREFER[0];
  const call = mdl => request(`models/${mdl}:generateContent`, key, body);
  let data;
  try {
    data = await call(model);
  } catch (err) {
    // Limit beim großen Modell erreicht oder Modell weg: einmal mit dem anderen versuchen
    if (err.status !== 429 && err.status !== 404) throw err;
    model = err.status === 404 ? await chooseModel(key) : PREFER.find(n => n !== model) || model;
    store.set(MODEL, model);
    data = await call(model);
  }
  const out = cleanAnswer(data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join(''));
  if (!out) throw new Error(data.promptFeedback?.blockReason ? 'Google hat die Anfrage abgelehnt (Inhaltsfilter).' : 'Die KI hat keinen Text geliefert.');
  return out;
}

// ---------- Oberfläche ----------
// insertText(text): Text ins Feld (mit „Wiederherstellen“), getText(), setStudy(on): Lernzettel-Modus schalten
export function initGemini({ insertText, getText, setStudy }) {
  const $ = id => document.getElementById(id);
  const panel = $('ki-panel'), btn = $('ki-btn'), dlg = $('ki-setup'), keyInput = $('ki-key'), status = $('ki-status');
  let mode = 'lernzettel';

  const setMode = m => {
    mode = m;
    for (const b of $('ki-modes').children) b.setAttribute('aria-checked', String(b.dataset.mode === m));
    $('ki-prompt').placeholder = MODES[m].placeholder;
  };
  for (const b of $('ki-modes').children) b.addEventListener('click', () => setMode(b.dataset.mode));
  setMode(mode);

  const openSetup = () => {
    keyInput.value = store.get(KEY);
    $('ki-setup-status').textContent = '';
    $('ki-delete').hidden = !hasKey();
    dlg.showModal();
  };
  btn.addEventListener('click', () => {
    if (!hasKey()) return openSetup();
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) $('ki-prompt').focus();
  });
  $('ki-key-menu').addEventListener('click', openSetup);
  $('ki-change').addEventListener('click', openSetup);

  $('ki-save').addEventListener('click', async () => {
    const key = keyInput.value.trim();
    const st = $('ki-setup-status');
    if (!key) { st.textContent = 'Bitte zuerst den Schlüssel einfügen.'; return keyInput.focus(); }
    st.textContent = 'Prüfe den Schlüssel bei Google …';
    try {
      const model = await chooseModel(key);
      if (!model) throw new Error('Mit diesem Schlüssel ist kein passendes Modell verfügbar.');
      store.set(KEY, key);
      store.set(MODEL, model);
      dlg.close();
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      $('ki-prompt').focus();
    } catch (err) {
      st.textContent = err.message;
    }
  });
  $('ki-delete').addEventListener('click', async () => {
    if (!await ask('Den Gemini-Schlüssel von diesem Gerät löschen?', { ok: 'Löschen', danger: true })) return;
    store.set(KEY, '');
    store.set(MODEL, '');
    panel.hidden = true;
    dlg.close();
  });

  $('ki-go').addEventListener('click', async () => {
    const prompt = $('ki-prompt').value.trim(), text = getText();
    if (mode !== 'ueberarbeiten' && !prompt) { status.textContent = 'Schreib zuerst, was die KI schreiben soll.'; return $('ki-prompt').focus(); }
    if (mode === 'ueberarbeiten' && !text.trim()) { status.textContent = 'Im Textfeld steht noch nichts zum Überarbeiten.'; return; }
    const go = $('ki-go');
    go.disabled = true;
    status.textContent = 'Gemini schreibt …';
    try {
      const out = await generate(mode, prompt, text);
      if (mode === 'lernzettel' || /^\s*(#|!!|- |\[ \])/m.test(out)) setStudy(true);
      insertText(out);
      status.textContent = 'Fertig – bitte kurz prüfen (Beta).';
    } catch (err) {
      status.textContent = '';
      info(err.message);
    } finally {
      go.disabled = false;
    }
  });
}

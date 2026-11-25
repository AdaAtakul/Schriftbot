// KI-Assistent: Einstellungen im Profil-Tab, Aufträge im Schreiben-Tab.
// Der Schlüssel liegt nur in localStorage dieses Geräts (nicht im Profil-Backup).
import { PROVIDERS, DEFAULT_CONFIG, ask, chatPrompt, cleanAnswer } from './ki.js';
import { groupsFor, recordedCount } from './profile.js';

const KEY = 'ki';
function load() {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_CONFIG }; }
}
function save(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
}

export function initKi(profile) {
  const $ = id => document.getElementById(id);
  let cfg = load();

  // ---------- Profil-Tab: Anbieter, Schlüssel, Modell ----------
  const provider = $('ki-provider'), key = $('ki-key'), model = $('ki-model'), base = $('ki-base');
  for (const [k, p] of Object.entries(PROVIDERS)) provider.add(new Option(p.label, k));
  function sync() {
    provider.value = cfg.provider;
    key.value = cfg.key;
    model.value = cfg.model;
    base.value = cfg.baseUrl;
    $('ki-base-field').hidden = cfg.provider === 'claude';
    key.placeholder = cfg.provider === 'claude' ? 'sk-ant-…' : 'Schlüssel des Anbieters';
    model.placeholder = cfg.provider === 'claude' ? DEFAULT_CONFIG.model : 'Modellname des Anbieters';
    $('ki-models').innerHTML = PROVIDERS[cfg.provider].models.map(m => `<option value="${m}">`).join('');
  }
  provider.addEventListener('change', () => {
    const models = PROVIDERS[provider.value].models;
    cfg = { ...cfg, provider: provider.value, model: models[0] || '' };
    save(cfg);
    sync();
  });
  for (const [el, field] of [[key, 'key'], [model, 'model'], [base, 'baseUrl']]) {
    el.addEventListener('change', () => { cfg = { ...cfg, [field]: el.value.trim() }; save(cfg); });
  }
  sync();

  // ---------- Schreiben-Tab: Auftrag ausführen ----------
  const input = $('text-input'), task = $('ki-task'), status = $('ki-status'), undo = $('ki-undo');
  const buttons = [...document.querySelectorAll('#ki-run, [data-ki]')];
  let previous = null;

  // Nur Zeichen erlauben, die schon aufgenommen sind (sonst stehen sie im PDF rot markiert).
  const charset = () => {
    const singles = groupsFor(profile).filter(g => !g.pairs).flatMap(g => g.chars).filter(c => c !== ' ');
    const have = singles.filter(c => recordedCount(profile, c) > 0);
    return (have.length ? have : singles).join(' ');
  };

  const setText = text => {
    input.value = text;
    input.dispatchEvent(new Event('input')); // Schreiben-Tab speichert und zeichnet die Vorschau neu
  };

  // Antwort übernehmen, vorherigen Text für „Zurückholen“ merken.
  function apply(answer) {
    previous = input.value;
    setText(answer);
    undo.hidden = false;
    status.textContent = '✓ Fertig. Der Text steht jetzt oben und in der Vorschau.';
  }

  async function run(job) {
    if (!job.trim()) { task.focus(); return; }
    const name = cfg.provider === 'claude' ? 'Claude' : 'Die KI';
    buttons.forEach(b => { b.disabled = true; });
    status.textContent = `⏳ ${name} schreibt …`;
    try {
      apply(await ask(cfg, job.trim(), input.value, charset()));
    } catch (err) {
      status.textContent = '⚠️ ' + err.message;
    } finally {
      buttons.forEach(b => { b.disabled = false; });
    }
  }

  $('ki-run').addEventListener('click', () => run(task.value));
  for (const b of document.querySelectorAll('[data-ki]')) {
    b.addEventListener('click', () => {
      if (!input.value.trim()) { status.textContent = 'Für diese Aktion braucht es zuerst einen Text.'; return; }
      run(b.dataset.ki);
    });
  }
  // Kostenlos über das eigene Claude-Abo: Auftrag kopieren, in der Claude-App einfügen, Antwort zurückkopieren.
  $('ki-copy').addEventListener('click', () => {
    if (!task.value.trim()) { status.textContent = 'Bitte zuerst oben einen Auftrag eintippen.'; task.focus(); return; }
    const text = chatPrompt(task.value.trim(), input.value, charset());
    // Kopieren und Öffnen im selben Tipp, sonst blockiert Safari das neue Fenster.
    navigator.clipboard.writeText(text).then(
      () => { status.textContent = '📋 Kopiert. In der Claude-App einfügen und senden, die Antwort kopieren (lange drücken → Kopieren), dann hier „📥 Antwort einfügen“.'; },
      () => { status.textContent = '⚠️ Kopieren hat nicht geklappt. Bitte noch einmal tippen.'; },
    );
    window.open('https://claude.ai/new', '_blank'); // öffnet die Claude-App, falls installiert, sonst claude.ai
  });

  $('ki-paste').addEventListener('click', async () => {
    let text = '';
    try {
      text = cleanAnswer(await navigator.clipboard.readText()); // Safari fragt mit „Einfügen“ nach
    } catch {
      status.textContent = '⚠️ Kein Zugriff auf die Zwischenablage. Tippe in Safari auf „Einfügen“, wenn es erscheint.';
      return;
    }
    if (!text) { status.textContent = 'Die Zwischenablage ist leer. Bitte zuerst die Antwort in der Claude-App kopieren.'; return; }
    if (text.includes('Wird ein aktueller Text mitgeschickt')) { status.textContent = 'Das ist noch der kopierte Auftrag. Bitte erst die Antwort in der Claude-App kopieren.'; return; }
    apply(text);
  });

  undo.addEventListener('click', () => {
    if (previous === null) return;
    setText(previous);
    previous = null;
    undo.hidden = true;
    status.textContent = 'Vorheriger Text wiederhergestellt.';
  });
}

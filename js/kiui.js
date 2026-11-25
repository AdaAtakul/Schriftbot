// KI-Assistent: Einstellungen im Profil-Tab, Aufträge im Schreiben-Tab.
// Der Schlüssel liegt nur in localStorage dieses Geräts (nicht im Profil-Backup).
import { PROVIDERS, DEFAULT_CONFIG, ask } from './ki.js';
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

  async function run(job) {
    if (!job.trim()) { task.focus(); return; }
    const name = cfg.provider === 'claude' ? 'Claude' : 'Die KI';
    buttons.forEach(b => { b.disabled = true; });
    status.textContent = `⏳ ${name} schreibt …`;
    try {
      const answer = await ask(cfg, job.trim(), input.value, charset());
      previous = input.value;
      setText(answer);
      undo.hidden = false;
      status.textContent = '✓ Fertig. Der Text steht jetzt oben und in der Vorschau.';
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
  undo.addEventListener('click', () => {
    if (previous === null) return;
    setText(previous);
    previous = null;
    undo.hidden = true;
    status.textContent = 'Vorheriger Text wiederhergestellt.';
  });
}

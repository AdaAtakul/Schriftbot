// Profil-Tab: Backup aller Profile, ein Profil teilen, Importieren, Eingabe (Finger/Maus).
import { parseProfile, progress } from './profile.js';
import {
  saveProfile, getSettings, setSetting, activeProfile, glyphOwner, profilesMeta, profileSettings, seedSettings,
  createProfile, setActiveProfile, deleteProfile, loadGlyphs, saveGlyphs,
} from './storage.js';
import { buildCollection, isCollection, parseCollection, uniqueName } from './sammlung.js';
import { shareFiles } from './export.js';
import { ask, info } from './dialog.js';
import { nonPenAllowed } from './pen.js';
import { isDemo } from './demo.js';
import { DEFAULT_STYLE } from './stil.js';

const fileName = name => name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'profil';
const jsonFile = (data, name) => new File([JSON.stringify(data)], name, { type: 'application/json' });

export function initProfil(profile) {
  const $ = id => document.getElementById(id);

  function showBackupStatus() {
    const last = getSettings().lastBackup;
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    const el = $('backup-status');
    el.textContent = last == null
      ? 'Noch nie gesichert.'
      : days === 0 ? 'Zuletzt gesichert: heute'
      : `Zuletzt gesichert: vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
    el.className = 'status ' + (last == null || days > 7 ? 'warn' : 'ok');
    // Roter Punkt am Profil-Tab, wenn Aufnahmen existieren, aber kein aktuelles Backup.
    const overdue = !isDemo() && progress(profile).done > 0 && (last == null || days > 7);
    document.querySelector('.tabs [data-view="profil"]').classList.toggle('badge', overdue);
  }

  async function send(file) {
    try {
      // Safari verlangt fürs Teilen einen frischen Tipp; dauert das Zusammenstellen zu lange, noch einmal tippen lassen
      if (!await shareFiles([file])) info('Bitte noch einmal tippen, um die Datei zu teilen.');
      return true;
    } catch (err) {
      info('Teilen fehlgeschlagen: ' + err.message);
      return false;
    }
  }

  // Alle Profile mit Schriften und Stil in einer Datei
  $('export-btn').addEventListener('click', async () => {
    const list = profilesMeta().list;
    const entries = await Promise.all(list.map(async p => ({
      name: p.name,
      from: p.from ? list.findIndex(q => q.id === p.from) : null,
      settings: profileSettings(p.id),
      handwriting: p.from ? null : await loadGlyphs(p.id),
    })));
    const date = new Date().toISOString().slice(0, 10);
    if (!await send(jsonFile(buildCollection(entries), `handschrift-alle-profile-${date}.json`))) return;
    for (const p of list) if (!p.from) seedSettings(p.id, { lastBackup: Date.now() });
    showBackupStatus();
  });

  // Aktives Profil teilen: Schrift (auch eine mitbenutzte) und Stil als eigenständiges Profil
  $('share-profile-btn').addEventListener('click', async () => {
    const p = activeProfile(), owner = glyphOwner();
    const settings = { ...profileSettings(owner.id), ...profileSettings(p.id) };
    const entry = { name: p.name, from: null, settings, handwriting: await loadGlyphs(owner.id) };
    await send(jsonFile(buildCollection([entry]), `handschrift-${fileName(p.name)}.json`));
  });

  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    try {
      if (isCollection(text)) await importCollection(parseCollection(text));
      else await importSingle(parseProfile(text));
    } catch (err) {
      info('Import fehlgeschlagen: ' + err.message);
    }
  });

  // Sammlung: als neue Profile hinzufügen (Namen werden bei Bedarf durchnummeriert)
  async function importCollection(entries) {
    const meta = profilesMeta();
    const summary = entries.map(e => `• ${e.name}${e.from != null ? ` (Schrift von „${entries[e.from].name}“)` : ` – ${progress(e.handwriting).done} Zeichen`}`).join('\n');
    if (!await ask(`${entries.length === 1 ? 'Dieses Profil' : `Diese ${entries.length} Profile`} hinzufügen?\n\n${summary}\n\nVorhandene Profile bleiben erhalten.`, { ok: 'Hinzufügen' })) return;
    // Nur das leere Start-Profil eines neuen Geräts wird ersetzt
    const own = meta.list.filter(p => !p.demo);
    const lone = own.length === 1 && !own[0].from && progress(await loadGlyphs(own[0].id)).done === 0 ? own[0] : null;
    const taken = meta.list.filter(p => p !== lone).map(p => p.name); // der Name des ersetzten Start-Profils ist frei
    const ids = [];
    for (const pass of [false, true]) { // erst eigene Schriften, dann die Profile, die sie mitbenutzen
      entries.forEach((e, i) => {
        if ((e.from != null) !== pass) return;
        const name = uniqueName(e.name, taken);
        taken.push(name);
        ids[i] = createProfile({ name, from: pass ? ids[e.from] : null });
      });
    }
    for (const [i, e] of entries.entries()) {
      if (e.handwriting) await saveGlyphs(ids[i], e.handwriting);
      seedSettings(ids[i], { style: DEFAULT_STYLE, styles: {}, ...e.settings });
    }
    if (lone) await deleteProfile(lone.id);
    setActiveProfile(ids[0]);
    location.reload();
  }

  // Altes Einzel-Backup (nur eine Schrift): ersetzt die Schrift des aktiven Profils wie bisher
  async function importSingle(imported) {
    const p = progress(imported), owner = glyphOwner();
    const msg = `Schrift mit ${p.done} von ${p.total} Zeichen importieren?`
      + (progress(profile).done ? `\n\nDie Schrift von „${owner.name}“ wird dabei ersetzt` + (owner.id !== activeProfile().id ? ` (das aktive Profil „${activeProfile().name}“ benutzt sie).` : '.') : '');
    if (!await ask(msg, { ok: 'Importieren' })) return;
    await saveProfile(imported);
    location.reload();
  }

  const allow = $('allow-non-pen');
  allow.checked = nonPenAllowed();
  allow.addEventListener('change', () => setSetting('allowNonPen', allow.checked));

  showBackupStatus();
}

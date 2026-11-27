// „Eigene Schrift“: Sichern aller eigenen Handschriften, die aufgenommene teilen, Importieren, Eingabe (Finger/Maus).
import { parseProfile, progress } from './profile.js';
import {
  getSettings, setSetting, profilesMeta, ownProfiles, recProfile, profileSettings, seedSettings,
  createProfile, setActiveProfile, setRecProfile, deleteProfile, loadGlyphs, saveGlyphs,
} from './storage.js';
import { buildCollection, isCollection, parseCollection, uniqueName } from './sammlung.js';
import { shareFiles } from './export.js';
import { ask, info } from './dialog.js';
import { nonPenAllowed } from './pen.js';

const fileName = name => name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'handschrift';
const jsonFile = (data, name) => new File([JSON.stringify(data)], name, { type: 'application/json' });
// Aussehen (gilt für alle Schriften) plus die Kästchengröße dieser Handschrift
const entrySettings = id => ({ ...getSettings(), boxScale: profileSettings(id).boxScale });

export function initProfil(own) {
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
    // Roter Punkt am Tab „Eigene Schrift“, wenn Aufnahmen existieren, aber kein aktuelles Backup.
    const overdue = progress(own).done > 0 && (last == null || days > 7);
    document.querySelector('.tabs [data-view="aufnahme"]').classList.toggle('badge', overdue);
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

  // Alle eigenen Handschriften mit dem Aussehen in einer Datei (mitgelieferte lassen sich jederzeit neu laden)
  $('export-btn').addEventListener('click', async () => {
    const entries = await Promise.all(ownProfiles().map(async p => ({
      name: p.name, from: null, settings: entrySettings(p.id), handwriting: await loadGlyphs(p.id),
    })));
    const date = new Date().toISOString().slice(0, 10);
    if (!await send(jsonFile(buildCollection(entries), `deineschrift-sicherung-${date}.json`))) return;
    setSetting('lastBackup', Date.now());
    showBackupStatus();
  });

  // Die gerade aufgenommene Handschrift teilen
  $('share-profile-btn').addEventListener('click', async () => {
    const p = recProfile();
    const entry = { name: p.name, from: null, settings: entrySettings(p.id), handwriting: await loadGlyphs(p.id) };
    await send(jsonFile(buildCollection([entry]), `handschrift-${fileName(p.name)}.json`));
  });

  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    try {
      if (isCollection(text)) await importEntries(parseCollection(text));
      else await importEntries([{ name: 'Importierte Schrift', settings: {}, handwriting: parseProfile(text) }]);
    } catch (err) {
      info('Import fehlgeschlagen: ' + err.message);
    }
  });

  // Als neue eigene Handschriften hinzufügen (Namen bei Bedarf durchnummeriert). Ältere Sicherungen enthalten
  // Profile, die nur die Schrift eines anderen benutzen: die gibt es nicht mehr, sie werden übersprungen.
  async function importEntries(all) {
    const entries = all.filter(e => e.handwriting);
    if (!entries.length) return info('Die Datei enthält keine Handschrift.');
    const summary = entries.map(e => `• ${e.name} – ${progress(e.handwriting).done} Zeichen`).join('\n');
    if (!await ask(`${entries.length === 1 ? 'Diese Handschrift' : `Diese ${entries.length} Handschriften`} hinzufügen?\n\n${summary}\n\nVorhandene Handschriften bleiben erhalten.`, { ok: 'Hinzufügen' })) return;
    // Nur die leere Start-Handschrift eines neuen Geräts wird ersetzt; dann gilt auch das Aussehen aus der Datei
    const mine = ownProfiles();
    const lone = mine.length === 1 && progress(await loadGlyphs(mine[0].id)).done === 0 ? mine[0] : null;
    const taken = profilesMeta().list.filter(p => p !== lone).map(p => p.name);
    const ids = [];
    for (const e of entries) {
      const name = uniqueName(e.name, taken);
      taken.push(name);
      const id = createProfile({ name });
      ids.push(id);
      await saveGlyphs(id, e.handwriting);
      if (e.settings.boxScale) seedSettings(id, { boxScale: e.settings.boxScale });
    }
    if (lone) {
      await deleteProfile(lone.id);
      const { boxScale, ...look } = entries[0].settings;
      seedSettings('p1', look); // 'settings' = Aussehen für alle Schriften
    }
    setRecProfile(ids[0]);
    setActiveProfile(ids[0]);
    location.reload();
  }

  const allow = $('allow-non-pen');
  allow.checked = nonPenAllowed();
  allow.addEventListener('change', () => setSetting('allowNonPen', allow.checked));

  showBackupStatus();
}

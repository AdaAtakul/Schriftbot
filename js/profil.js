// Profil-Tab: Backup als JSON, Testmodus.
import { parseProfile, progress } from './profile.js';
import { saveProfile, getSettings, setSetting } from './storage.js';

export function initProfil(profile) {
  const $ = id => document.getElementById(id);

  function showBackupStatus() {
    const last = getSettings().lastBackup;
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    $('backup-status').textContent = last == null
      ? '⚠️ Noch nie ein Backup exportiert.'
      : days === 0 ? '✅ Letztes Backup: heute'
      : `${days > 7 ? '⚠️' : '✅'} Letztes Backup: vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
    // Roter Punkt am Profil-Tab, wenn Aufnahmen existieren, aber kein aktuelles Backup.
    const overdue = progress(profile).done > 0 && (last == null || days > 7);
    document.querySelector('.tabs [data-view="profil"]').classList.toggle('badge', overdue);
  }

  $('export-btn').addEventListener('click', () => {
    const date = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([JSON.stringify(profile)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `handschrift-profil-${date}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setSetting('lastBackup', Date.now());
    showBackupStatus();
  });

  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let imported;
    try {
      imported = parseProfile(await file.text());
    } catch (err) {
      return alert('Import fehlgeschlagen: ' + err.message);
    }
    const p = progress(imported);
    const msg = `Profil mit ${p.done} von ${p.total} Zeichen importieren?`
      + (progress(profile).done ? '\n\nDein aktuelles Profil wird dabei ersetzt.' : '');
    if (!confirm(msg)) return;
    await saveProfile(imported);
    location.reload();
  });

  const allow = $('allow-non-pen');
  allow.checked = !!getSettings().allowNonPen;
  allow.addEventListener('change', () => setSetting('allowNonPen', allow.checked));

  showBackupStatus();
}

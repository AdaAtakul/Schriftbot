import { loadProfile, saveProfile, getSettings, createProfile, setActiveProfile } from './storage.js';
import { alignAll, progress } from './profile.js';
import { initAufnahme } from './aufnahme.js';
import { initTextAufnahme } from './textaufnahme.js';
import { initProfil } from './profil.js';
import { initSchreiben } from './schreiben.js';
import { initBlatt } from './blattui.js';
import { initProfilwahl } from './profilwahl.js';
import { info } from './dialog.js';
import { initKiTab } from './kiui.js';
import { cleanPasted } from './einfuegen.js';
import { setupDemo, isDemo, ownProfile, seedSampleText } from './demo.js';
import { showTutorial, tutorialSeen } from './tutorial.js';

// Läuft die App als Artifact auf claude.ai? Dort gibt es Claude (KI-Tab), aber keinen Service Worker.
const inClaude = typeof window.claude?.use === 'function';

// Navigation zwischen den Bereichen. Die App startet immer in „Schreiben“.
const tabs = document.querySelectorAll('.tabs [data-view]');

let profile;

// Gleitende Markierung hinter dem gewählten Tab (iPad); auf dem Handy per CSS ausgeblendet
const tabBar = document.querySelector('.tabs');
const indicator = document.createElement('span');
indicator.className = 'tab-indicator';
indicator.setAttribute('aria-hidden', 'true');
tabBar.prepend(indicator);
function moveIndicator() {
  const t = tabBar.querySelector('[aria-selected="true"]');
  if (!t || !t.offsetWidth) return;
  indicator.style.width = t.offsetWidth + 'px';
  indicator.style.transform = `translateX(${t.offsetLeft}px)`;
}
new ResizeObserver(moveIndicator).observe(tabBar);

let currentView = null;
function showView(name) {
  // Beim Tabwechsel frisch geschriebene Zeichen ausrichten, damit „Schreiben“ sie schon gerade sieht.
  if (profile && alignAll(profile)) saveProfile(profile);
  for (const tab of tabs) {
    const active = tab.dataset.view === name;
    tab.setAttribute('aria-selected', active);
    const view = document.getElementById('view-' + tab.dataset.view);
    view.hidden = !active;
    // Sanft einblenden, wenn ein anderer Bereich gewählt wird
    if (active && currentView && currentView !== name) {
      view.classList.remove('view-enter');
      void view.offsetWidth;
      view.classList.add('view-enter');
    }
  }
  currentView = name;
  moveIndicator();
}
document.addEventListener('animationend', e => { if (e.target.classList?.contains('view-enter')) e.target.classList.remove('view-enter'); });

for (const tab of tabs) tab.addEventListener('click', () => showView(tab.dataset.view));
// Pfeiltasten in der Tab-Leiste (Tastatur, VoiceOver)
document.querySelector('.tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const visible = [...tabs].filter(t => !t.hidden);
  const k = visible.indexOf(document.activeElement);
  if (k < 0) return;
  const next = visible[(k + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
  next.focus();
  showView(next.dataset.view);
});

// KI gibt es nur in der claude.ai-Version (dort antwortet Claude über das eigene Abo). Sonst kein toter Tab.
if (inClaude) document.querySelector('.tabs [data-view="ki"]').hidden = false;

// Erster Start: Demo-Schrift anlegen, falls mitgeliefert (demo/demo-schrift.json)
await setupDemo();
const demo = isDemo();
if (demo) document.getElementById('view-aufnahme').classList.add('is-demo');

// Erstes Öffnen: eine Seite Beispieltext, damit die Vorschau sofort etwas zeigt
seedSampleText(getSettings().text);

// Start immer in „Schreiben“; nur nach „Eigene Schrift aufnehmen“ (Neuladen) direkt in die Aufnahme
let start = 'schreiben';
try { start = sessionStorage.getItem('startView') || start; sessionStorage.removeItem('startView'); } catch {}
showView(document.getElementById('view-' + start) ? start : 'schreiben');

try {
  profile = await loadProfile();
  if (alignAll(profile)) saveProfile(profile); // ältere Aufnahmen nachträglich ausrichten
} catch (err) {
  info('Das Handschrift-Profil konnte nicht geladen werden: ' + err.message +
    '\n\nTipp: App schließen und neu öffnen. Falls das nicht hilft, im Profil-Tab ein Backup importieren.');
  throw err;
}
let schreiben;
const aufnahme = initAufnahme(profile, () => schreiben.sync()); // Schriftgröße im Schreiben-Tab nachziehen
initTextAufnahme(profile, aufnahme.refresh);
schreiben = initSchreiben(profile, aufnahme.refresh); // rendert neu, sobald der Tab sichtbar wird
initProfil(profile);
// Früher gab es eine KI mit API-Schlüssel: einen gespeicherten Schlüssel vom Gerät löschen.
try { localStorage.removeItem('ki'); } catch {}
const blatt = initBlatt(profile);
initProfilwahl();
initKiTab(profile, { schreiben, blatt, goTo: showView });

// Demo-Profil: statt der Aufnahme ein Hinweis mit Weg zur eigenen Schrift
document.getElementById('demo-note').hidden = !demo;
document.getElementById('demo-own').addEventListener('click', () => {
  const own = ownProfile() || { id: createProfile({ name: 'Meine Schrift' }) };
  setActiveProfile(own.id);
  try { sessionStorage.setItem('startView', 'aufnahme'); } catch {}
  location.reload();
});

// Kurze Einführung beim ersten Öffnen, danach über den ?-Knopf
document.getElementById('help-btn').addEventListener('click', () => showTutorial({ goTo: showView, demo }));
if (!tutorialSeen()) showTutorial({ goTo: showView, demo, onClose: safetyHint });
else safetyHint();

// Hinweis oben: erst „Zum Home-Bildschirm“ (sonst darf Safari die Daten löschen), dann „Backup“.
function safetyHint() {
  const $ = id => document.getElementById(id);
  const banner = $('safety-banner');
  const done = progress(profile).done;
  if (demo || !done || inClaude || window.schriftbotNative) return;
  const later = key => { try { return +localStorage.getItem(key) > Date.now(); } catch { return false; } };
  const snooze = (key, days) => { try { localStorage.setItem(key, Date.now() + days * 86400000); } catch {} };
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const last = getSettings().lastBackup, days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  let key, days2;
  if (apple && !standalone && !later('hinweis-home')) {
    key = 'hinweis-home'; days2 = 14;
    $('safety-text').textContent = 'Füge DeineSchrift zum Home-Bildschirm hinzu – sonst darf Safari deine Schrift nach 7 Tagen ohne Nutzung löschen.';
    $('safety-action').textContent = 'So geht’s';
    $('safety-action').onclick = () => info(
      '1. Sichere zuerst deine Schrift: Profil → „Alle Profile sichern“, z. B. in „Dateien“.\n' +
      '2. Tippe in Safari auf „Teilen“ (Quadrat mit Pfeil) und dann auf „Zum Home-Bildschirm“.\n' +
      '3. Öffne DeineSchrift ab jetzt über das neue Symbol und importiere dort einmal die Sicherung (Profil → Importieren).\n\n' +
      'Die App auf dem Home-Bildschirm hat einen eigenen Speicher, deshalb der Umweg über die Sicherung.',
      { title: 'Zum Home-Bildschirm hinzufügen' });
  } else if (done >= 10 && (days == null || days > 7) && !later('hinweis-backup')) {
    key = 'hinweis-backup'; days2 = 3;
    $('safety-text').textContent = days == null ? 'Deine Schrift ist noch nicht gesichert.' : `Deine letzte Sicherung ist ${days} Tage alt.`;
    $('safety-action').textContent = 'Jetzt sichern';
    $('safety-action').onclick = () => { banner.hidden = true; $('export-btn').click(); };
  } else return;
  $('safety-close').onclick = () => { banner.hidden = true; snooze(key, days2); };
  banner.hidden = false;
}

window.schriftbotInsert = (text, mode = 'replace') => {
  schreiben.insertText(cleanPasted(text), mode === 'append' ? 'append' : 'replace');
  showView('schreiben');
};

// PWA: Service Worker für Offline-Betrieb.
const offlineStatus = document.getElementById('status-offline');
if (inClaude) {
  offlineStatus.textContent = 'Läuft auf claude.ai: KI-Tab aktiv, braucht Internet. Daten liegen getrennt von der Web-Version.';
} else if ('serviceWorker' in navigator) {
  // Neue Version installiert → Hinweis statt automatischem Neuladen (könnte mitten im Schreiben stören).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) document.getElementById('update-banner').hidden = false;
  });
  document.getElementById('update-reload').addEventListener('click', () => location.reload());

  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => caches.keys())
    .then(keys => {
      // Version anzeigen, damit man nach einem Update prüfen kann, ob es angekommen ist.
      const v = Math.max(...keys.map(k => +(k.match(/^handschrift-v(\d+)$/)?.[1] || 0)));
      offlineStatus.textContent = `Offline nutzbar · Version v${v}`;
      offlineStatus.className = 'status ok';
    })
    .catch(err => { offlineStatus.textContent = 'Offline-Modus nicht verfügbar: ' + err.message; offlineStatus.className = 'status warn'; });
} else {
  offlineStatus.textContent = 'Dieser Browser unterstützt keinen Offline-Modus.';
  offlineStatus.className = 'status warn';
}

// Safari darf Website-Daten sonst nach längerer Nichtnutzung löschen.
const storageStatus = document.getElementById('status-storage');
if (navigator.storage?.persist) {
  navigator.storage.persist().then(ok => {
    storageStatus.textContent = ok
      ? 'Dauerhafter Speicher aktiv'
      : 'Der Browser kann deine Daten bei Platzmangel oder längerer Nichtnutzung löschen – bitte regelmäßig sichern.';
    storageStatus.className = 'status ' + (ok ? 'ok' : 'warn');
  });
}

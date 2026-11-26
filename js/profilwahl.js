// Profile: benennen, anlegen (eigene Schrift oder die eines anderen Profils), wechseln, löschen.
// Wechseln lädt die App neu, damit alle Tabs sauber mit der neuen Schrift starten.
import {
  profilesMeta, activeProfile, createProfile, renameProfile, setActiveProfile, deleteProfile, seedSettings, profileSettings,
} from './storage.js';
import { PRESETS, DEFAULT_STYLE } from './stil.js';

export function initProfilwahl() {
  const $ = id => document.getElementById(id);
  const list = $('profile-list'), switcher = $('profile-switch');
  const fromSel = $('profile-from'), styleSel = $('profile-style'), nameInput = $('profile-name');

  const switchTo = id => { setActiveProfile(id); location.reload(); };
  const styleLabel = id => PRESETS[profileSettings(id).style]?.label || PRESETS[DEFAULT_STYLE].label;

  function render() {
    const m = profilesMeta(), active = activeProfile(m);
    const nameOf = id => m.list.find(p => p.id === id)?.name || '?';

    switcher.replaceChildren(...m.list.map(p => new Option(p.name, p.id, false, p.id === active.id)));
    switcher.add(new Option('Profile verwalten …', '__manage'));

    list.replaceChildren(...m.list.map(p => {
      const li = document.createElement('li');
      li.className = 'profile-item' + (p.id === active.id ? ' active' : '');
      const info = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = p.name;
      const meta = document.createElement('span');
      meta.className = 'hint small';
      meta.textContent = `${p.from ? `Schrift von „${nameOf(p.from)}“` : 'Eigene Schrift'} · Stil: ${styleLabel(p.id)}`;
      info.append(name, meta);
      const actions = document.createElement('div');
      actions.className = 'profile-actions';
      const button = (text, fn, cls) => {
        const b = document.createElement('button');
        b.textContent = text;
        if (cls) b.className = cls;
        b.addEventListener('click', fn);
        actions.append(b);
      };
      if (p.id === active.id) {
        const badge = document.createElement('span');
        badge.className = 'badge-active';
        badge.textContent = 'Aktiv';
        actions.append(badge);
      } else button('Wechseln', () => switchTo(p.id), 'primary');
      button('Umbenennen', () => {
        const n = prompt('Neuer Name für das Profil:', p.name)?.trim();
        if (n) { renameProfile(p.id, n); render(); }
      });
      button('Löschen', async () => {
        if (!confirm(`Profil „${p.name}“ löschen?` + (p.from ? '' : '\nSeine aufgenommene Schrift wird dabei gelöscht – vorher ein Backup exportieren!'))) return;
        const err = await deleteProfile(p.id);
        if (err) return alert(err);
        if (p.id === active.id) location.reload(); else render();
      }, 'danger');
      li.append(info, actions);
      return li;
    }));

    fromSel.replaceChildren(
      new Option('Neue eigene Schrift (neu aufnehmen)', ''),
      ...m.list.filter(p => !p.from).map(p => new Option(`Schrift von „${p.name}“ benutzen`, p.id)),
    );
    fromSel.value = active.from || active.id; // naheliegend: die aktuelle Schrift mit anderem Stil
  }

  for (const [key, p] of Object.entries(PRESETS)) styleSel.add(new Option(p.label, key));
  styleSel.value = 'unordentlich';

  $('profile-new').addEventListener('submit', e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return nameInput.focus();
    const id = createProfile({ name, from: fromSel.value || null });
    // Papier, Tinte und Größe vom aktuellen Profil übernehmen, Stil aus der Auswahl
    const cur = profileSettings(activeProfile().id), keep = {};
    // Schriftgröße nur bei gleicher Schrift (sie ist an die Kästchengröße der Aufnahme gekoppelt)
    const keys = ['paper', 'paperColor', 'ink', 'inkHue', 'lineHeight', 'margin', ...(fromSel.value ? ['xHeight'] : [])];
    for (const k of keys) if (k in cur) keep[k] = cur[k];
    seedSettings(id, { ...keep, style: styleSel.value, styles: {} });
    if (!fromSel.value) alert(`Profil „${name}“ ist angelegt. Nimm jetzt im Tab „Aufnahme“ die neue Schrift auf.`);
    switchTo(id);
  });

  switcher.addEventListener('change', () => {
    if (switcher.value === '__manage') {
      switcher.value = activeProfile().id;
      document.querySelector('.tabs [data-view="profil"]').click();
      $('profiles-card').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    switchTo(switcher.value);
  });

  render();
}

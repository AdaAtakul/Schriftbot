// Tab KI: Chat mit Claude über das eigene claude.ai-Konto (nur in der claude.ai-Version der App, dort ohne API-Schlüssel).
// Anhänge: Fotos, PDFs (Text, bei Scans die Seiten als Fotos), Textdateien. Antworten per Tipp in die Handschrift.
import { buildTurns, userContent, kindOf } from './ki.js';
import { cleanPasted, wordCount } from './einfuegen.js';
import { pdfContent } from './pdfimport.js';
import { choose, toast } from './dialog.js';
import { recordedCount } from './profile.js';

export const CLAUDE_APP_URL = 'https://claude.ai/artifact/TuYxD4Q6AKc8VLQQU1K5eY';
const CHAT_KEY = 'ki-chat', TIER_KEY = 'ki-tier';
const TIERS = [['quick', 'Schnell'], ['default', 'Normal'], ['complex', 'Gründlich']];
const SUGGESTIONS = [
  { label: 'Brief oder Karte schreiben', text: 'Schreibe einen kurzen, persönlichen Brief an ' },
  { label: 'Meinen Text korrigieren', text: 'Korrigiere Rechtschreibung, Grammatik und Zeichensetzung in meinem Text. Ändere sonst nichts.', context: true },
  { label: 'Zusammenfassen', text: 'Fasse den Anhang in eigenen Worten zusammen, etwa 120 Wörter.', attach: true },
  { label: 'Lernzettel erstellen', text: 'Mach aus dem Anhang einen übersichtlichen Lernzettel mit den wichtigsten Punkten.', attach: true },
];
const ERRORS = {
  not_granted: 'Du hast der App den Zugriff auf Claude nicht erlaubt. Lade die Seite neu, um noch einmal gefragt zu werden.',
  sampling_disabled: 'Claude ist für dein Konto hier nicht verfügbar.',
  rate_limited: 'Gerade zu viele Anfragen oder dein Nutzungslimit ist erreicht. Versuch es in ein paar Minuten noch einmal.',
  session_expired: 'Bitte melde dich bei claude.ai neu an und lade die Seite neu.',
  refused: 'Claude hat diese Anfrage abgelehnt. Formuliere sie anders.',
  empty_completion: 'Claude hat keinen Text geliefert. Formuliere die Anfrage genauer.',
  prompt_too_large: 'Die Anhänge sind zu groß. Lass einen weg oder starte einen neuen Chat.',
  image_rejected: 'Ein Foto ließ sich nicht verwenden. Nimm ein anderes (JPEG oder PNG).',
  images_unavailable: 'Fotos kann diese Ansicht nicht an Claude schicken.',
};

const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const icon = id => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'icon'); const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.append(u); return s; };

export function initKiTab(profile, { schreiben, blatt, goTo }) {
  const $ = id => document.getElementById(id);
  const log = $('ki-log'), input = $('ki-input'), form = $('ki-form'), sendBtn = $('ki-send'), stopBtn = $('ki-stop');
  const attachEl = $('ki-attachments'), fileInput = $('ki-file'), ctxBox = $('ki-context'), empty = $('ki-empty');

  let history = load(CHAT_KEY, []);       // [{ role, content, display?, files?, error?, partial? }]
  let pending = [];                        // Anhänge für die nächste Nachricht
  let sample = null, caps = null, ctl = null, busy = false;
  let tier = load(TIER_KEY, 'default');

  const chars = () => Object.keys(profile.glyphs).filter(k => [...k].length === 1 && recordedCount(profile, k) > 0);
  const persist = () => save(CHAT_KEY, history.slice(-40).map(({ role, content, display, files, context, error, partial }) => ({ role, content, display, files, context, error, partial })));

  // ---------- Modell ----------
  const tierEl = $('ki-tier');
  tierEl.replaceChildren(...TIERS.map(([id, label]) => {
    const b = el('button', '', label);
    b.type = 'button';
    b.dataset.id = id;
    b.setAttribute('aria-pressed', String(id === tier));
    b.addEventListener('click', () => { tier = id; save(TIER_KEY, id); for (const x of tierEl.children) x.setAttribute('aria-pressed', String(x === b)); });
    return b;
  }));

  // ---------- Vorschläge ----------
  $('ki-suggestions').replaceChildren(...SUGGESTIONS.map(s => {
    const b = el('button', 'ki-suggestion', s.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      input.value = s.text;
      if (s.context) ctxBox.checked = true;
      grow();
      input.focus();
      if (s.attach && !pending.length) fileInput.click();
    });
    return b;
  }));

  // ---------- Eingabe ----------
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 240) + 'px'; syncSend(); };
  const syncSend = () => {
    const reading = pending.some(a => a.status === 'reading');
    sendBtn.disabled = busy || !sample || reading || (!input.value.trim() && !pending.some(a => a.status === 'ready'));
  };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });

  // ---------- Anhänge ----------
  const imageCount = () => pending.reduce((n, a) => n + (a.images?.length || 0), 0);
  async function addFiles(files) {
    for (const file of files) {
      const kind = kindOf(file);
      const a = { name: file.name || 'Foto', kind, status: 'reading' };
      pending.push(a);
      renderAttachments();
      try {
        if (kind === 'image') {
          if (!caps?.images) throw new Error('Fotos gehen in dieser Ansicht nicht.');
          if (imageCount() >= caps.images.maxCount) throw new Error(`Höchstens ${caps.images.maxCount} Fotos pro Nachricht.`);
          a.images = [file];
        } else if (kind === 'pdf') {
          const left = caps?.images ? caps.images.maxCount - imageCount() : 0;
          const r = await pdfContent(file, Math.max(0, left));
          if (r.text) { a.text = r.text; a.pages = r.pages; }
          else if (r.images.length) { a.kind = 'scan'; a.images = r.images; a.pages = r.images.length; }
          else throw new Error('Kein Text im PDF gefunden.');
        } else if (kind === 'text') {
          a.text = await file.text();
        } else if (kind === 'word') {
          throw new Error('Word-Dateien bitte als PDF exportieren und das PDF anhängen.');
        } else throw new Error('Dieses Dateiformat geht nicht. Fotos, PDFs und Textdateien gehen.');
        a.status = 'ready';
      } catch (err) {
        a.status = 'error';
        a.error = err.message || 'Datei konnte nicht gelesen werden.';
      }
      renderAttachments();
    }
  }
  function renderAttachments() {
    attachEl.replaceChildren(...pending.map((a, i) => {
      const chip = el('div', 'ki-file ' + a.status);
      chip.append(icon(a.kind === 'image' || a.kind === 'scan' ? 'i-image' : 'i-file'));
      const label = el('span', '', a.name);
      const meta = el('small', '', a.status === 'reading' ? 'wird gelesen …' : a.status === 'error' ? a.error
        : a.kind === 'scan' ? `Scan, ${a.pages} ${a.pages === 1 ? 'Seite' : 'Seiten'} als Foto`
        : a.kind === 'pdf' ? `PDF, ${a.pages} ${a.pages === 1 ? 'Seite' : 'Seiten'}` : a.kind === 'image' ? 'Foto' : 'Text');
      const x = el('button', 'ki-file-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', a.name + ' entfernen');
      x.addEventListener('click', () => { pending.splice(i, 1); renderAttachments(); });
      const txt = el('div');
      txt.append(label, meta);
      chip.append(txt, x);
      return chip;
    }));
    attachEl.hidden = !pending.length;
    syncSend();
  }
  $('ki-attach').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
  input.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  });
  form.addEventListener('dragover', e => { e.preventDefault(); form.classList.add('drop'); });
  form.addEventListener('dragleave', () => form.classList.remove('drop'));
  form.addEventListener('drop', e => { e.preventDefault(); form.classList.remove('drop'); addFiles([...(e.dataTransfer?.files || [])]); });

  // ---------- Verlauf anzeigen ----------
  function render() {
    empty.hidden = history.length > 0;
    log.replaceChildren(...history.map((m, i) => (m.role === 'user' ? userBubble(m) : answer(m, i))));
    log.scrollTop = log.scrollHeight;
  }
  function userBubble(m) {
    const row = el('div', 'ki-msg user');
    const bubble = el('div', 'ki-bubble');
    if (m.files?.length) {
      const files = el('div', 'ki-msg-files');
      for (const f of m.files) { const c = el('span', 'ki-msg-file'); c.append(icon(f.kind === 'image' || f.kind === 'scan' ? 'i-image' : 'i-file'), document.createTextNode(f.name)); files.append(c); }
      bubble.append(files);
    }
    if (m.display) bubble.append(el('div', 'ki-bubble-text', m.display));
    if (m.context) bubble.append(el('small', 'ki-ctx', 'mit deinem Text aus „Schreiben“'));
    row.append(bubble);
    if (m.error) row.append(errorBox(m.error));
    return row;
  }
  function answer(m, i) {
    const row = el('div', 'ki-msg assistant');
    const avatar = el('div', 'ki-avatar');
    avatar.append(icon('i-spark'));
    const body = el('div', 'ki-body');
    const text = el('div', 'ki-text', m.streaming ? m.content : cleanPasted(m.content)); // fertige Antwort ohne Markdown-Reste
    body.append(text);
    if (m.partial) body.append(el('p', 'ki-note', 'Unterbrochen – das ist nur ein Teil der Antwort.'));
    if (m.error) body.append(errorBox(m.error));
    if (!m.streaming && m.content.trim()) body.append(actions(m, i));
    row.append(avatar, body);
    m.node = text;
    return row;
  }
  function errorBox(code) {
    const box = el('div', 'ki-error');
    box.append(el('span', '', ERRORS[code] || 'Verbindung unterbrochen. Versuch es noch einmal.'));
    if (code !== 'not_granted' && code !== 'sampling_disabled') {
      const retry = el('button', '', 'Noch einmal senden');
      retry.type = 'button';
      retry.addEventListener('click', () => { const last = history.at(-1); if (last?.role === 'user') { delete last.error; ask(); } });
      if (history.at(-1)?.error === code) box.append(retry);
    }
    return box;
  }
  function actions(m, i) {
    const bar = el('div', 'ki-actions');
    const take = el('button', 'primary');
    take.type = 'button';
    take.append(icon('i-edit'), document.createTextNode('In Handschrift übernehmen'));
    take.addEventListener('click', () => takeOver(m.content));
    const copy = el('button');
    copy.type = 'button';
    copy.append(icon('i-clipboard'), document.createTextNode('Kopieren'));
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(cleanPasted(m.content)); toast('Kopiert.'); }
      catch { toast('Kopieren geht hier nicht. Text markieren und kopieren.'); }
    });
    bar.append(take, copy);
    if (i === history.length - 1) {
      const again = el('button');
      again.type = 'button';
      again.append(icon('i-shuffle'), document.createTextNode('Neu schreiben'));
      again.addEventListener('click', () => { history.pop(); ask(); });
      bar.append(again);
    }
    return bar;
  }

  // Antwort übernehmen: Vorschau, dann Ersetzen/Anhängen im Tab Schreiben oder ins gewählte Feld im Blatt
  async function takeOver(content) {
    const text = cleanPasted(content);
    const field = blatt.selectedField?.();
    const hasText = !!schreiben.getText().trim();
    const options = [
      { label: hasText ? 'Text ersetzen' : 'In „Schreiben“ einfügen', value: 'replace', primary: true },
      ...(hasText ? [{ label: 'Anhängen', value: 'append' }] : []),
      ...(field ? [{ label: `In Feld ${field.number} (Blatt)`, value: 'field' }] : []),
    ];
    const n = wordCount(text);
    const pick = await choose(`${n} ${n === 1 ? 'Wort' : 'Wörter'}` + (hasText ? ' · Dein bisheriger Text lässt sich danach wiederherstellen.' : ''),
      options, { title: 'In deine Handschrift übernehmen?', preview: text });
    if (!pick) return;
    if (pick === 'field') {
      blatt.insertIntoField(text, 'replace');
      goTo('blatt');
      toast(`In Feld ${field.number} übernommen.`);
    } else {
      schreiben.insertText(text, pick);
      goTo('schreiben');
      toast(pick === 'append' ? 'Angehängt.' : 'Übernommen.');
    }
  }

  // ---------- Senden ----------
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (sendBtn.disabled) return;
    const ready = pending.filter(a => a.status === 'ready');
    const context = ctxBox.checked ? schreiben.getText() : '';
    const msg = {
      role: 'user',
      display: input.value.trim(),
      content: userContent(input.value, ready, context),
      files: ready.map(a => ({ name: a.name, kind: a.kind })),
      context: !!context.trim(),
    };
    const images = ready.flatMap(a => a.images || []);
    history.push(msg);
    input.value = '';
    pending = [];
    ctxBox.checked = false;
    renderAttachments();
    grow();
    ask(images);
  });
  stopBtn.addEventListener('click', () => ctl?.abort());
  $('ki-new').addEventListener('click', () => {
    if (busy) ctl?.abort();
    history = [];
    persist();
    render();
    input.focus();
  });

  async function ask(images = []) {
    if (!sample) return;
    busy = true;
    stopBtn.hidden = false;
    sendBtn.hidden = true;
    syncSend();
    persist();
    const reply = { role: 'assistant', content: '', streaming: true };
    history.push(reply);
    render();
    const node = reply.node;
    node.classList.add('thinking');
    node.textContent = 'Claude denkt nach';
    ctl = new AbortController();
    try {
      const turns = buildTurns(history.slice(0, -1), chars());
      const opts = { signal: ctl.signal, cache: false, modelTier: tier, onText: ({ text }) => { node.classList.remove('thinking'); node.textContent = text; reply.content = text; log.scrollTop = log.scrollHeight; } };
      if (images.length) opts.images = images;
      const { text, truncated } = await sample(turns, opts);
      reply.content = text;
      reply.partial = truncated;
    } catch (e) {
      const code = e?.code || 'upstream_error';
      reply.content = code === 'refused' ? '' : (e?.text || reply.content || '');
      if (reply.content.trim()) { if (code !== 'cancelled') reply.partial = true; }
      else {
        history.pop(); // keine Antwort: Fehler an der eigenen Nachricht zeigen
        if (code !== 'cancelled') history.at(-1).error = code;
      }
    } finally {
      delete reply.streaming;
      busy = false;
      stopBtn.hidden = true;
      sendBtn.hidden = false;
      persist();
      render();
      syncSend();
    }
  }

  // ---------- Claude verbinden ----------
  render();
  (async () => {
    const use = window.claude?.use;
    sample = use ? await window.claude.use('sample').catch(() => null) : null;
    if (!sample) {
      $('ki-unavailable').hidden = false;
      $('ki-open-claude').href = CLAUDE_APP_URL;
      form.classList.add('off');
      input.disabled = true;
      syncSend();
      return;
    }
    caps = await sample.limits().catch(() => null);
    fileInput.accept = ['application/pdf', '.pdf', 'text/*', '.txt', '.md', '.csv', '.json', ...(caps?.images ? caps.images.mediaTypes : [])].join(',');
    syncSend();
  })();
}

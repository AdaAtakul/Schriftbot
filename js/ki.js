// KI-Tab: Gespräch mit Claude über claude.ai (nur in der claude.ai-Version der App). Ohne DOM, in Node testbar.
// Claude merkt sich nichts zwischen Anfragen: Regeln, bisheriges Gespräch und Anhänge gehen jedes Mal mit.

export const MAX_ATTACHMENT_CHARS = 60000; // je Anhang (Text aus PDF/Textdatei)
export const MAX_TOTAL_CHARS = 180000;     // alles zusammen, unter dem Limit von 256 KiB
export const MAX_HISTORY = 30;             // ältere Nachrichten fallen aus dem Gespräch

// Regeln als erste Nachricht. chars: Zeichen, die in der Handschrift aufgenommen sind.
export function rules(chars = []) {
  const list = [...new Set(chars)].filter(c => c && c !== ' ').join('');
  return [
    'Du bist der Schreibassistent in einer Handschrift-App für das iPad. Was du schreibst, kann die Person per Knopf in ihre eigene Handschrift übernehmen (als Seite oder in ein Feld auf einem Arbeitsblatt) und z. B. in GoodNotes abgeben.',
    'Regeln:',
    '- Wenn die Person einen Text haben möchte (Antwort auf eine Aufgabe, Zusammenfassung, Hefteintrag, Brief …), gib NUR diesen Text aus: ohne Einleitung wie „Hier ist …“ und ohne Nachsatz, damit er direkt übernommen werden kann.',
    '- Bei Fragen, Erklärungen oder Rückfragen darfst du normal antworten.',
    '- Kein Markdown: keine Sternchen, Rauten, Tabellen oder Fettdruck. Aufzählungen mit "- " am Zeilenanfang, Absätze mit einer Leerzeile.',
    '- Keine Emojis und keine Sonderzeichen wie → • ≈ ≥ × ✓.',
    ...(list ? [`- Die Handschrift kennt nur diese Zeichen (plus Leerzeichen und Zeilenumbruch): ${list}`, '  Vermeide alle anderen Zeichen; schreib z. B. Ziffern oder Wörter statt fehlender Symbole.'] : []),
    '- Antworte auf Deutsch, außer die Person möchte eine andere Sprache.',
    '- Anhänge stehen in der Nachricht zwischen ===-Zeilen; Fotos siehst du direkt.',
  ].join('\n');
}

// Anhang als Text für die Nachricht (lange Texte werden gekürzt, das wird vermerkt)
export function attachmentText({ name, kind, text = '', pages = 0 }) {
  if (kind === 'image') return `=== Foto: ${name} ===`;
  if (kind === 'scan') return `=== ${name}: gescanntes PDF, ${pages} ${pages === 1 ? 'Seite' : 'Seiten'} als Foto angehängt ===`;
  const t = text.length > MAX_ATTACHMENT_CHARS ? text.slice(0, MAX_ATTACHMENT_CHARS) + '\n[… gekürzt]' : text;
  return `=== Anhang: ${name} ===\n${t.trim()}\n=== Ende ${name} ===`;
}

// Inhalt einer Nutzer-Nachricht: Text, darunter die Anhänge
export function userContent(text, attachments = [], context = '') {
  const parts = [];
  if (context.trim()) parts.push(`=== Mein aktueller Text (Tab Schreiben) ===\n${context.trim()}\n=== Ende ===`);
  for (const a of attachments) parts.push(attachmentText(a));
  if (text.trim()) parts.push(text.trim());
  return parts.join('\n\n') || 'Bitte sieh dir den Anhang an.';
}

// Gesprächsverlauf → Eingabe für Claude: Regeln vorne, nur die letzten Nachrichten,
// beginnt und endet mit der Person, nichts Leeres, gesamt unter dem Limit.
export function buildTurns(history, chars) {
  let msgs = history.filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()).slice(-MAX_HISTORY);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const size = () => msgs.reduce((n, m) => n + m.content.length, 0);
  while (msgs.length > 1 && size() > MAX_TOTAL_CHARS) { msgs.shift(); while (msgs.length && msgs[0].role !== 'user') msgs.shift(); }
  if (!msgs.length || msgs.at(-1).role !== 'user') throw new Error('Die letzte Nachricht muss von dir sein.');
  return [{ role: 'user', content: rules(chars) }, ...msgs.map(m => ({ role: m.role, content: m.content }))];
}

// Dateiart nach Name und Typ
export function kindOf(file) {
  const n = (file.name || '').toLowerCase(), t = file.type || '';
  if (t.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic)$/.test(n)) return 'image';
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (t.startsWith('text/') || /\.(txt|md|csv|json|html?|xml|rtf)$/.test(n)) return 'text';
  if (/\.(docx?|pages|odt)$/.test(n)) return 'word';
  return 'other';
}

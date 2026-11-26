// Text aus Claude (oder einer anderen Quelle) bereinigen und einsetzen. Ohne DOM, in Node testbar.

// Formatierungsreste entfernen, damit die Handschrift nichts Fremdes rot markiert:
// Markdown-Fett/Kursiv, Überschriften-Rauten, Aufzählungspunkte, Pfeile, Häkchen und Emojis.
export function cleanPasted(t) {
  return String(t ?? '').replace(/\r\n?/g, '\n')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/(^|\s)\*(\S[^*\n]*?)\*(?=\s|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '').replace(/^[ \t]*[•*·▪◦][ \t]+/gm, '- ').replace(/[→⇒➔]/g, '-').replace(/[✓✔]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Neuen Text einsetzen: ersetzen oder mit Leerzeile anhängen.
export function mergeText(current, incoming, mode) {
  if (mode === 'append' && current.trim()) return current.replace(/\s+$/, '') + '\n\n' + incoming;
  return incoming;
}

export const wordCount = t => (String(t).trim().match(/\S+/g) || []).length;

// Aufnahmetext für die Text-Aufnahme (ohne DOM, in Node testbar).
// [xy] markiert ein verbundenes Paar, das als Ganzes aufgenommen wird; alles andere sind Einzelzeichen.
// Die drei Sätze decken alle Kleinbuchstaben, ä ö ü ß und alle 26 Paare ab.
// Was noch fehlt (Großbuchstaben, Ziffern, Satzzeichen, eigene Paare), hängt plan() kompakt hinten an.
import { groupsFor } from './profile.js';

export const SENTENCES = [
  'Victor jagt zwölf Boxkämpfer quer über den großen Sylter D[ei][ch].',
  'Im So[mm][er] [sch]wimmt Elsa m[it] n[eu][en] Freu[nd]en l[an][ge] im Wa[ss]er.',
  'Das L[ie]d k[li][ng]t vo[ll] Glü[ck], [de][nn] [au]ch [un][te]n sind [be][st]e K[in]der sa[tt].',
];

// Satz → Wörter, jedes Wort ist eine Liste von Schlüsseln (Einzelzeichen oder Paar).
export function parse(sentence) {
  return sentence.split(' ').map(word => [...word.matchAll(/\[([^\]]+)\]|(.)/gu)].map(m => m[1] || m[2]));
}

export function plan(profile) {
  const words = SENTENCES.flatMap(parse);
  const have = new Set(words.flat());
  const rest = groupsFor(profile).filter(g => !g.optional).flatMap(g => g.chars)
    .filter(k => k !== ' ' && !have.has(k)); // Leerzeichen kommt aus den Wortabständen

  // Fehlende Buchstaben bzw. Ziffern zu Gruppen à höchstens 6 bündeln, Satzzeichen und Paare einzeln.
  const kind = k => /^\p{L}$/u.test(k) ? 'L' : /^\p{N}$/u.test(k) ? 'N' : null;
  const sorted = [...rest.filter(k => kind(k) === 'L'), ...rest.filter(k => kind(k) === 'N'), ...rest.filter(k => !kind(k))];
  const extra = [];
  let group = [];
  for (const k of sorted) {
    if (group.length && (group.length === 6 || kind(group[0]) !== kind(k))) { extra.push(group); group = []; }
    if (kind(k)) group.push(k);
    else extra.push([k]);
  }
  if (group.length) extra.push(group);
  return [...words, ...extra];
}

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

// Beispielwörter für die Vorschau (Buchstabieralphabet + Alltagswörter, deckt alle Pflichtzeichen ab).
export const SAMPLES = ('Anna Berta Clara Dora Emil Fritz Gustav Heinrich Ida Julius Kaufmann Ludwig Martha Nordpol Otto Paula ' +
  'Quelle Richard Samuel Theodor Ulrich Viktor Wilhelm Xaver Ypsilon Zacharias Ärger Ökonom Übel Köln Straße ' +
  'Brücke Löwe Quark Joghurt Yacht Boxer Wasser schnell dick Lied nie Ende sehr Fisch unten Mitte Liebe Augen ' +
  'Feuer Kind Ding Abend allen Butter Sonne essen Summe Gegend Eule 2025 1987 0634 100% Ja! Wie? Zeit: Hund, ' +
  'Aquarium Handy Projekt Linie Fenster Mädchen Katze; Ende. Mo-Fr 1/2 a+b=c (so) „gut“ ‚klein‘ "Hi" Peter\'s').split(' ');
export const previewText = ch => ch === ' ' ? 'Hund Katze Maus'
  : (SAMPLES.filter(w => w.includes(ch)).slice(0, 3).join(' ') || `n${ch}n`);

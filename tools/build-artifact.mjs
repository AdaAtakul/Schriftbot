// Baut die claude.ai-Version der App (Claude-Artifact) nach dist-artifact/: node tools/build-artifact.mjs
// Die Seite selbst ohne <html>/<head>/<body> (das Gerüst setzt claude.ai), alle übrigen Dateien unverändert daneben.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-artifact');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const html = readFileSync(join(root, 'index.html'), 'utf8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = html.match(/<link rel="stylesheet"[^>]*>/g).join('\n');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(join(out, 'index.html'), `${title}\n${styles}\n${body.trim()}\n`);

// Dateien, die die Seite lädt (kein Service Worker, kein Manifest: gibt es auf claude.ai nicht)
const copied = [];
function copyDir(dir) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = join(dir, name), src = join(root, rel);
    if (statSync(src).isDirectory()) { copyDir(rel); continue; }
    if (/LICENSE/.test(name) && !name.startsWith('LICENSE_')) continue;
    mkdirSync(join(out, dir), { recursive: true });
    if (/\.m?js$/.test(name)) {
      // claude.ai nimmt keine rohen Steuerzeichen an. In den Bibliotheken stehen sie nur in Zeichenketten,
      // dort bedeutet \xNN dasselbe.
      const code = readFileSync(src, 'utf8').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0'));
      writeFileSync(join(out, rel), code);
    } else copyFileSync(src, join(out, rel));
    copied.push(relative(out, join(out, rel)));
  }
}
['css', 'js', 'vendor'].forEach(copyDir);
writeFileSync(join(out, 'files.json'), JSON.stringify(copied, null, 1));
console.log(`dist-artifact/: index.html + ${copied.length} Dateien`);

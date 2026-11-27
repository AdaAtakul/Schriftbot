# Übergabe: DeineSchrift (Stand 26.11.2026)

Lies diese Datei zuerst. Sie fasst eine lange Cloud-Sitzung zusammen; Details stehen im Code und in `README.md`.

## Projekt in einem Satz
**DeineSchrift** (früher „Handschrift-Tool“ / „Schriftbot“) ist eine deutsche Web-App fürs iPad: Man nimmt die eigene Handschrift auf (Apple Pencil), danach wird getippter Text in dieser Handschrift gesetzt und als PDF, PNG oder GoodNotes-Datei exportiert. Reines HTML/CSS/JS ohne Build, offline per Service Worker, alle Daten lokal (IndexedDB/localStorage).

## Wo was liegt
- **Repo:** `github.com/AdaAtakul/Schriftbot` (GitHub-Konto wurde von `bambuseleitung` umbenannt; alte URLs leiten weiter)
- **Arbeits-Branch:** `claude/affectionate-noether-2hmp4y` (alles gepusht, letzter Commit `69fd6da`)
- **Pull Request:** https://github.com/AdaAtakul/Schriftbot/pull/2 (Branch → `main`, noch offen)
- **Live-Seite:** https://deineschrift.de (Cloudflare Worker `deineschrift` mit statischen Dateien, `deineschrift.ada-atakul1.workers.dev`)
- **Domain:** bei GoDaddy registriert (.de lässt sich nicht zu Cloudflare übertragen), DNS liegt bei Cloudflare
- **Veröffentlichung:** Cloudflare holt den Code per Git-Verbindung (`wrangler.jsonc`, `.assetsignore`, `_headers`). Production branch war zuletzt der Arbeits-Branch; nach dem Mergen auf `main` umstellen.

## Wichtige Dateien
- `index.html`, `css/app.css` (Design „Papier & Tinte“: Tokens oben, Redesign-Block und Animationen am Ende)
- `js/app.js` (Start, Tabs mit gleitender Markierung, Hinweise), `js/schreiben.js` (Text, Vorschau, Papier-Vorschaubilder, Export „Mit Papier / Nur Schrift“), `js/tutorial.js` (Einführung), `js/demo.js` (Beispielschrift + Beispieltext)
- `js/aufnahme.js`, `js/textaufnahme.js` (Aufnehmen), `js/blattui.js`, `js/blatt.js`, `js/pdfimport.js` (Ausfüllen)
- `anleitung.html`, `datenschutz.html`, `css/seite.css`, `sitemap.xml`, `robots.txt`, `llms.txt` (SEO/GEO/AEO)
- `sw.js`: **bei jeder Änderung `VERSION` hochzählen** (aktuell `v31`)
- `tests/*.test.mjs`: mit `node tests/<name>.test.mjs` ausführen, alle grün

## Zuletzt umgesetzt (Commit 69fd6da)
1. Einführung nur einmal (gilt ab Anzeige als gesehen, Tippen daneben schließt)
2. Start immer in „Schreiben“; Tabs: Schreiben · Ausfüllen · Aufnehmen · Profil
3. Papier als Vorschaubilder; Export „Mit Papier“ oder „Nur Schrift“ (PNG durchsichtig)
4. Eine Seite Beispieltext beim ersten Öffnen; Hinweis über der Vorschau, solange keine Schrift da ist
5. „Blatt“ → „Ausfüllen“ mit drei Schritten und animierter Grafik
6. Umbenennung zu **DeineSchrift** (auch Symbole in Tintenblau `#2f5bd3`, Vorschaubild `icons/og.png`, iPad-App-Name)
7. Redesign nach Apples Richtlinien (Systemgrau, ein Akzent, hell/dunkel, 44-pt-Tippflächen)
8. Animationen (federnd), „Bewegung reduzieren“ wird beachtet
9. `www.deineschrift.de` leitet per Skript auf die Hauptadresse um

## Offen / nächste Schritte
1. **Live prüfen:** Nach dem letzten Push zeigte deineschrift.de noch v30. Cloudflare → Worker → Builds prüfen (Fehler? oder Branch schon auf `main`?). Prüfen mit `curl -s https://deineschrift.de/sw.js | findstr VERSION` → muss `v31` zeigen.
2. **`/hallmark` ausführen** (lokal installiert) und das Design damit prüfen/verbessern. Farbwerte in `:root` (Tintenblau, hell/dunkel), 44-px-Tippflächen und „Bewegung reduzieren“ beibehalten.
3. **Apple-HIG-Prüfung** mit dem Plugin „HIG Compliance Auditor“, falls installiert (bisher nur von Hand geprüft).
4. **Beispielschrift:** In der App unter Profil → „Profil teilen“ die eigene Schrift exportieren und als `demo/demo-schrift.json` ins Repo legen. Danach den Beispieltext in `js/demo.js` (`SAMPLE_TEXT`) so anpassen, dass er mit dieser Schrift genau eine Seite füllt, und `icons/og.png` mit echter Handschrift neu erstellen.
5. **PR #2 mergen**, dann Cloudflare-Production-Branch auf `main` stellen.
6. Später: E-Mail-Aliase über Cloudflare Email Routing (DMARC-Eintrag `p=quarantine` von GoDaddy beachten), Datenschutz-Kontakt prüfen, Weiterleitung www → Hauptadresse optional zusätzlich als Cloudflare-Regel, iPad-App neu bauen (zeigt auf deineschrift.de), claude.ai-Version (Artifact) ist veraltet.

## Arbeitsweise, die der Nutzer möchte
- Antworten auf **Deutsch**, einfach erklärt.
- **Keine Claude-API** in der App.
- **Weitere Ideen zuerst nennen und nachfragen**, bevor sie umgesetzt werden.
- Pull Requests nur auf Nachfrage.
- Pushes auf den Live-Branch gehen sofort online: erst alles fertig bauen und testen (iPad, Handy, hell/dunkel), dann **einmal** pushen.
- Löschen immer mit Bestätigung; destruktive Aktionen rot.

## Stolpersteine
- Browser-Speicher ist je Adresse getrennt (www vs. Hauptadresse, Safari vs. Home-Bildschirm) → Nutzer sichern über Profil → „Alle Profile sichern“ und importieren.
- Cloudflare entfernt `.html` aus Adressen (`/anleitung`, `/datenschutz`); Links sind schon ohne Endung.
- `.mjs`-Dateien kommen von Cloudflare korrekt als JavaScript; `_headers` setzt `nosniff`.

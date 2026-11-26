# Schriftbot

**Getippten Text in deine eigene Handschrift verwandeln.** Schriftbot nimmt deine Handschrift einmal mit dem Apple Pencil (oder Finger/Maus) auf und schreibt danach jeden Text darin – als eigene Seiten oder direkt in ein Formular. Das Ergebnis gibst du als GoodNotes-Datei, PDF oder PNG weiter.

**Ausprobieren:** https://deineschrift.de/ · [Anleitung & häufige Fragen](https://deineschrift.de/anleitung.html)

- Kostenlos, ohne Anmeldung, ohne Cookies und Tracking
- Optimiert für Safari auf dem iPad, läuft in jedem aktuellen Browser (Handy unten mit Tab-Leiste, heller und dunkler Modus)
- Funktioniert nach dem ersten Öffnen komplett offline
- Reines HTML/CSS/JavaScript, ohne Build-Schritt
- Deine Daten bleiben auf deinem iPad (es gibt keinen Server)

---

## 1. Auf GitHub Pages veröffentlichen

Du brauchst nur ein kostenloses GitHub-Konto. Alles geht im Browser, auch auf dem iPad.

1. Auf [github.com](https://github.com) anmelden und oben rechts **＋ → New repository** wählen.
2. Name z. B. `handschrift-tool`, Sichtbarkeit **Public** (GitHub Pages ist für private Repos nur mit Bezahl-Konto möglich), dann **Create repository**.
3. Auf der leeren Repo-Seite **uploading an existing file** anklicken.
4. Alle Dateien und Ordner dieses Projekts hineinziehen:
   ```
   index.html
   anleitung.html
   datenschutz.html
   manifest.webmanifest
   sw.js
   sitemap.xml
   robots.txt
   llms.txt
   LICENSE
   README.md
   demo/         (optional, die Demo-Schrift)
   css/
   icons/
   js/
   vendor/       (mit vendor/pdfjs/ – wird zum Öffnen von Arbeitsblättern gebraucht)
   tests/        (optional, wird für die App nicht gebraucht)
   ```
   Wichtig: die Ordnerstruktur muss erhalten bleiben (`js/app.js`, nicht nur `app.js`).
5. Unten **Commit changes** klicken.
6. Im Repo **Settings → Pages** öffnen. Bei **Source** „Deploy from a branch“ wählen, bei **Branch** `main` und `/ (root)`, dann **Save**.
7. Nach etwa einer Minute steht oben auf der Seite die Adresse, z. B.
   `https://DEIN-NAME.github.io/handschrift-tool/`

## 1b. Vor dem Veröffentlichen

- **Demo-Schrift** (empfohlen): Damit Besucher Schriftbot sofort ausprobieren können, legst du eine Beispiel-Schrift bei.
  1. In Schriftbot ein Profil mit der Demo-Schrift aufnehmen (alle Zeichen, auch „ “ und Satzzeichen) und die Stil-Vorlage wählen, die Besucher zuerst sehen sollen.
  2. **Profil → Profil teilen** und die Datei sichern.
  3. Sie im Repo als **`demo/demo-schrift.json`** hochladen und `VERSION` in `sw.js` hochzählen.

  Neue Besucher bekommen dann beim ersten Öffnen ein Profil „Demo-Schrift“ und starten im Tab „Schreiben“ mit einem Beispieltext. Im Tab „Aufnahme“ steht stattdessen „Eigene Schrift aufnehmen“. Fehlt die Datei, startet Schriftbot wie bisher in der Aufnahme.
- **Vorschaubild**: `icons/og.png` (1200 × 630) erscheint, wenn jemand den Link teilt. Sobald die Demo-Schrift da ist, lohnt sich ein echtes Bild mit Handschrift.
- **Datenschutz**: `datenschutz.html` nennt als Kontakt GitHub Issues. Je nach Lage kann eine Anschrift nötig sein – im Zweifel rechtlich prüfen lassen.
- **Suchmaschinen**: Die Adresse in der [Google Search Console](https://search.google.com/search-console) und bei [Bing Webmaster Tools](https://www.bing.com/webmasters) anmelden und dort `sitemap.xml` einreichen. `robots.txt` liegt im Hauptordner und wirkt, weil die Seite auf der eigenen Domain im Wurzelverzeichnis läuft.
- **Hosting (Cloudflare Pages)**: Siehe Abschnitt 1c. Die Domain `deineschrift.de` bleibt bei GoDaddy registriert (Cloudflare nimmt keine .de-Domains zur Übertragung an), nur die DNS-Verwaltung liegt bei Cloudflare.
- **Umzug**: Unter der neuen Adresse ist der Browser-Speicher leer. Vorher **Alle Profile sichern**, danach **Importieren**. Zieht die Seite erneut um, die Adresse in `index.html`, `anleitung.html`, `datenschutz.html`, `sitemap.xml`, `robots.txt`, `llms.txt`, `CNAME` und `ios/` ersetzen.

## 1c. Auf Cloudflare Pages veröffentlichen (statt GitHub Pages)

Die Seite besteht nur aus fertigen Dateien, jeder Dateihoster reicht. Mit Cloudflare Pages ist das kostenlos:

1. **Konto** auf [cloudflare.com](https://dash.cloudflare.com/sign-up) anlegen, **Domain hinzufügen** → `deineschrift.de` → Free-Plan. Cloudflare nennt zwei Nameserver.
2. Bei GoDaddy (Domain → DNS → Nameserver → „Eigene Nameserver verwenden“) diese beiden eintragen. Die Domain bleibt dort registriert, nur die DNS-Verwaltung zieht um.
3. In Cloudflare **Workers & Pages → Pages → Upload assets**: Projektname z. B. `schriftbot`, die Datei `schriftbot-site.zip` hochladen (Ordnerinhalt: `index.html`, `css/`, `js/`, `vendor/`, `icons/` …), **Deploy**.
4. Im Projekt **Custom domains** → `deineschrift.de` (und `www.deineschrift.de`) hinzufügen. Die DNS-Einträge legt Cloudflare selbst an, das Zertifikat kommt automatisch.
5. Bei einem Update: neues Zip erzeugen und im Projekt **Create deployment** hochladen. `VERSION` in `sw.js` vorher hochzählen.

Nicht ins Zip gehören `tests/`, `tools/`, `ios/`, `.github/`, `README.md`. Ein Projekt, das per Direct Upload angelegt wurde, lässt sich später nicht auf Git umstellen.

## 2. Auf dem iPad installieren

1. Die Adresse in **Safari** öffnen (nicht in Chrome – nur Safari kann Apps zum Home-Bildschirm hinzufügen).
2. **Teilen-Symbol** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App ab jetzt immer über das neue Symbol starten. So läuft sie im Vollbild, offline, und Safari löscht ihre Daten deutlich seltener.
4. Im Tab **Profil** sollte unter „Status“ „✅ Offline-Modus bereit“ stehen.

## 2b. Als iPad-App mit Claude (optional)

> Nur für dich selbst: Die App wird per Sideloading installiert. Für den App Store bräuchte es ein Apple-Entwicklerkonto, und eine Hülle um eine Webseite lehnt Apple meist ab (Richtlinie 4.2).

Im Ordner `ios/` liegt eine richtige iPad-App: links deine Handschrift-App, im Tab **Claude** das echte claude.ai mit deinem normalen Login (Dateien anhängen, Projekte, Verlauf – alles wie gewohnt). Tippst du unter einer Claude-Antwort auf Claudes **Kopieren**-Knopf, fragt die App: **In deine Handschrift übernehmen?** → **Text ersetzen** oder **Anhängen**, und springt in den Tab „Schreiben“. Exporte gehen über das Teilen-Menü an GoodNotes.

**App bekommen:** Bei jeder Änderung in `ios/` baut GitHub sie automatisch (Tab **Actions** → „iPad-App bauen“ → im Lauf unter **Artifacts** „Schriftbot-ipa“ herunterladen und entpacken). Von Hand starten: Actions → „iPad-App bauen“ → **Run workflow**.

**Installieren** (braucht einen Windows-PC oder Mac):

1. [Sideloadly](https://sideloadly.io) installieren, iPad per Kabel verbinden.
2. `Schriftbot.ipa` in Sideloadly ziehen, deine Apple-ID eingeben, **Start**.
3. Auf dem iPad: **Einstellungen → Datenschutz & Sicherheit → Entwicklermodus** einschalten (iPad startet neu), dann **Einstellungen → Allgemein → VPN & Geräteverwaltung** → deine Apple-ID → **Vertrauen**.
4. Mit einer kostenlosen Apple-ID läuft die App 7 Tage; danach in Sideloadly noch einmal installieren (deine Daten bleiben). Mit einem bezahlten Entwicklerkonto ein Jahr. AltStore kann das Erneuern automatisch übernehmen.

Gut zu wissen:

- Die App lädt die Handschrift-App von deineschrift.de: beim ersten Start braucht sie Internet, danach geht sie offline; Updates kommen automatisch mit.
- Bei Claude mit **E-Mail-Code** anmelden. Die Google-Anmeldung blockiert Google in Apps.
- Die App hat ihren eigenen Speicher (getrennt von Safari): Profile einmal per **Alle Profile sichern** / **Importieren** übertragen.
- Die App liest nur die Zwischenablage, wenn du in Claude etwas kopierst – nicht den Chat selbst.

## 3. So benutzt du die App

### Handschrift aufnehmen (Tab „Aufnahme“)

- Links wählst du das Zeichen, rechts schreibst du es mit dem Pencil in die drei Kästchen (= drei Varianten, damit die Schrift später lebendig wirkt).
- **Grundlinie** (dunkle Linie): Hier steht die Schrift. **x-Höhe** (blau gestrichelt): So hoch sind Kleinbuchstaben wie a, n, o. **Oberlänge / Unterlänge**: für b, d, h, k bzw. g, j, p, y.
- **Leerzeichen**: einen waagerechten Strich ziehen, so lang wie dein normaler Wortabstand.
- **Verbundene Paare** (ch, sch, ei …): so schreiben, wie du sie wirklich verbindest. Eigene Paare fügst du unten links hinzu.
- Farben in der Liste: weiß = fehlt, gelb = 1–2 Varianten, grün = fertig.
- **Nächstes fehlendes** springt zum nächsten unvollständigen Zeichen.
- **Kästchen an meine Schrift anpassen** (links oben): Misst, wie groß du Kleinbuchstaben wirklich schreibst, und verkleinert Kästchen und Hilfslinien passend. Deine Aufnahmen bleiben gleich groß und das PDF auch (die Schriftgröße im Schreiben-Tab wird ausgeglichen). Gilt auch für die Aufnahme als Text.
- Ohne Apple Pencil zeichnen Finger und Maus. Sobald du einmal mit dem Pencil schreibst, zählt nur noch er – Finger und Handballen werden dann ignoriert, damit du die Hand ablegen kannst. Umstellen: **Profil → Eingabe & Speicher**.

- Unter den Kästchen zeigt **„So sieht es im Text aus“** Beispielwörter mit dem aktuellen Zeichen in deiner Schrift. So fällt ein zu großer oder schiefer Buchstabe sofort auf.
- Beim Wechsel zum nächsten Zeichen rückt die App jede Variante mittig unter die Vorlage. Liegt ein Buchstabe nur knapp neben der Grundlinie, setzt sie ihn genau darauf.

Tipp: Schreib in normaler Größe und Geschwindigkeit, nicht „schön“. Je natürlicher die Aufnahme, desto echter das Ergebnis.

### Schneller: als Text aufnehmen

Oben links auf **Als Text** umschalten. Statt jedes Zeichen einzeln schreibst du einen kurzen Text (5 Seiten) über eine blasse Vorlage. Er enthält alle Buchstaben, Umlaute, ß, alle verbundenen Paare, Ziffern und Satzzeichen.

- Buchstaben **einzeln** schreiben, nur **gelb hinterlegte Gruppen verbunden**.
- Die Strichfarbe wechselt je Zeichen – so siehst du, welchem Zeichen ein Strich zugeordnet wird.
- **Übernehmen** speichert die Seite und blättert weiter. Gespeichert wird immer in eine freie Variante; vorhandene Aufnahmen werden nie überschrieben.
- Die Abstände zwischen deinen Wörtern werden automatisch als Leerzeichen übernommen.
- Text dreimal schreiben = drei Varianten für jedes Zeichen. Einzelne Zeichen kannst du jederzeit unter **Einzeln** nachbessern.

### Text umwandeln (Tab „Schreiben“)

- Links Text eingeben oder einfügen, rechts erscheint die A4-Vorschau.
- **Roter Papierkorb** oben rechts im Textfeld: löscht den ganzen Text nach einer Rückfrage. Direkt danach holt **Gelöschten Text wiederherstellen** ihn zurück (bis du neu tippst).
- **Papier**: die GoodNotes-Vorlagen Blanko, Liniert breit, Liniert schmal, Kariert und Gepunktet, jeweils in **Weiß, Gelb oder Dunkel** (Papierfarbe). Jede Zeile steht genau auf einer Linie, Karolinie oder Punktreihe (bei Kariert und Gepunktet anfangs jede zweite Reihe, änderbar über „Zeilenabstand“). Für dunkles Papier gibt es weiße Tinte.
- **Stil-Vorlage**: Sehr ordentlich, Ordentlich, Normal, Locker, Unordentlich oder Sehr unordentlich. Unter **Feineinstellungen der Vorlage** lässt sich jeder Wert ändern: Deine Werte bleiben für genau diese Vorlage gespeichert („Angepasst“), **Vorlage zurücksetzen** holt die Originalwerte zurück.
- Feineinstellungen (gehören zur gewählten Vorlage):
  - **Buchstaben verbinden**: wie oft verbundene Paare statt Einzelbuchstaben genutzt werden.
  - **Unregelmäßigkeit** (bis 150 %): kleine Drehungen, Größen- und Abstandsunterschiede, leichte Schräglage.
  - **Durchgestrichene Wörter**: wie oft ein Wort erst falsch angefangen (Buchstabendreher oder falscher Buchstabe), durchgestrichen und daneben richtig geschrieben wird. „aus“ = nie; bei 100 % etwa alle paar Sätze mehrmals. Verschreiber nutzen nur aufgenommene Zeichen, **Neu würfeln** verteilt sie neu. In GoodNotes ist der Streichstrich ein eigener, radierbarer Strich.
  - **Kleine Korrekturen**: Ab und zu wird ein Buchstabe nachgezogen, oder ein Wort wird erst vergessen und dann klein über der Zeile mit einem **^** eingefügt.
  - **Nachlassen zum Ende**: Je weiter der Text, desto größer, schräger, weiter und unordentlicher wird die Schrift – wie am Ende eines langen Briefs.
  - **Wellige Zeilen**: Zeilen schwanken leicht, der Druck wechselt von Wort zu Wort und lässt zum Zeilenende nach.
  - **Unruhige Zeilenränder**: Zeilenanfänge rücken mal etwas ein, Zeilen brechen rechts mal früher um – wie beim echten Schreiben.
  - **Strichdicke**: dünner oder kräftiger (40–250 %), gilt für Vorschau und alle Exporte.
- **Tintenfarbe**: feste Farben oder der Regenbogen-Knopf mit dem **Farbton**-Regler für jede beliebige Tintenfarbe.
- **Schriftgröße, Zeilenabstand, Rand** nach Geschmack.
- **Neu würfeln**: andere Mischung der Varianten.
- **Größen angleichen**: Bringt zu kleine oder zu große Buchstaben auf die typische Größe deiner übrigen Buchstaben (getrennt nach Kleinbuchstaben, Oberlängen, Großbuchstaben und Ziffern). Deine Proportionen bleiben, nur Ausreißer über 15 % werden korrigiert. i, j, t, Umlaute und Satzzeichen bleiben unberührt. Vor dem Übernehmen zeigt die App, welche Zeichen sich ändern. **Angleichen rückgängig** geht, bis du die App schließt.
- Fehlende Zeichen werden **rot markiert** und unter dem Textfeld aufgelistet.
- Der Abstand zwischen Buchstaben richtet sich nach ihrer Form: Ein o rückt unter das Dach eines T, schräge Schrift wird nicht zu breit.

### KI-Tab (Claude über dein Abo, ohne API-Schlüssel)

Der Tab **KI** ist ein Chat mit Claude. Er erscheint nur in der **claude.ai-Version** der App: https://claude.ai/artifact/TuYxD4Q6AKc8VLQQU1K5eY – dieselbe App, nur auf claude.ai, wo sie Claude über dein normales Abo fragen darf. In der öffentlichen GitHub-Version ist der Tab ausgeblendet. (claude.ai lässt sich nicht in andere Seiten einbetten, deshalb geht es nur so.)

- Nachricht schreiben, mit der **Büroklammer** Dateien anhängen: **Fotos**, **PDFs** (Text wird gelesen, gescannte Seiten gehen als Foto mit) und **Textdateien**. Bilder lassen sich auch einfügen oder hineinziehen. Word-Dateien vorher als PDF exportieren.
- **Schnell / Normal / Gründlich** wählt, wie lange Claude nachdenkt.
- **Meinen Text aus „Schreiben“ mitschicken**, z. B. zum Korrigieren.
- Unter jeder Antwort: **In Handschrift übernehmen** → Vorschau → **Text ersetzen**, **Anhängen** oder **In Feld N (Blatt)**, wenn im Blatt-Tab ein Feld gewählt ist. Die App springt danach in den passenden Tab; **Vorherigen Text wiederherstellen** macht es rückgängig. Außerdem **Kopieren** und **Neu schreiben**.
- Claude bekommt die Liste deiner aufgenommenen Zeichen und schreibt ohne Formatierung, damit nichts rot markiert wird.
- Beim ersten Mal fragt claude.ai, ob die App Claude benutzen darf. Anfragen zählen zu deinem normalen Claude-Nutzungslimit.

Gut zu wissen über die claude.ai-Version:

- Sie braucht Internet und eine Anmeldung bei claude.ai (Safari oder Claude-App). Offline und vom Home-Bildschirm läuft weiter die GitHub-Version.
- Sie hat **ihren eigenen Speicher**: Profile einmal mit **Profil → Alle Profile sichern** (GitHub-Version) und **Importieren** (claude.ai-Version) übertragen.
- Exporte speichert sie über claude.ai. Die GoodNotes-Datei heißt dort **…goodnotes.zip**: in der Dateien-App „.zip“ aus dem Namen löschen, dann in GoodNotes öffnen.
- Sie ist privat: nur du kannst sie öffnen, bis du sie auf claude.ai über „Teilen“ freigibst.

### Formular ausfüllen (Tab „Blatt“)

Du hast ein Formular oder Blatt als PDF, in das du deine Einträge blau hineingetippt hast? Die App setzt sie in deiner Handschrift an genau dieselbe Stelle.

1. **PDF oder Foto öffnen** antippen und das Arbeitsblatt wählen (aus Dateien, iCloud Drive …).
2. Die App findet jede **blaue Antwort**, entfernt sie vom Blatt und schreibt denselben Text an dieselbe Stelle in deiner Handschrift. Das Feld reicht nach unten bis kurz vor die nächste Aufgabe, so ist Platz für die größere Handschrift.
3. Felder anpassen:
   - **Antippen** wählt ein Feld. Links kannst du den Text ändern.
   - **Ziehen** verschiebt das Feld, der **Punkt unten rechts** ändert die Größe.
   - **Automatisch einpassen** (Standard): Die Schrift wird nur so weit verkleinert, wie nötig ist, damit alles ins Feld passt. Ausgeschaltet stellst du die Größe selbst ein.
   - **＋ Textfeld**, dann ein Rechteck aufziehen: neues Feld, z. B. auf einem leeren Arbeitsblatt.
   - **Feld löschen**: Bei einem erkannten Feld erscheint dann wieder der blaue Text.
4. Exportieren über die Leiste unten: **GoodNotes** (Blatt als Hintergrund, die Schrift radierbar darüber), **PDF** oder **PNG**.

- Tinte, Strichdicke, Unordnung und Schreibfehler kommen aus dem Tab „Schreiben“.
- Bei einem **Foto** oder einem eingescannten PDF gibt es keinen lesbaren Text. Dann werden die blauen Stellen trotzdem gefunden, und du trägst den Text selbst ein.
- Als Antwort zählt nur deutlich blaue Schrift. Schwarzer Aufgabentext bleibt unangetastet, auch wenn er direkt über der Antwort steht.
- Das zuletzt geöffnete Blatt bleibt mit allen Feldern gespeichert, auch nach dem Schließen der App.

### Nach GoodNotes exportieren

**Als GoodNotes-Notizbuch (radierbar):**

1. **GoodNotes** antippen.
2. Im Teilen-Menü **GoodNotes** wählen. Fehlt GoodNotes dort, „In Dateien sichern“ wählen und die Datei in der Dateien-App antippen → „Öffnen in GoodNotes“ (oder in GoodNotes über **Importieren**).
3. GoodNotes legt ein neues Notizbuch an. Jeder Strich ist ein echter Kugelschreiber-Strich: mit dem **Radierer** einzelne Buchstaben löschen, mit dem **Lasso** verschieben, umfärben oder löschen. Buchstaben aus mehreren Strichen (t, ä, i …) brauchen einen Radierer-Tipp pro Strich.

- Mit „Papier“ in der Exportleiste bekommt jede Seite das gewählte Papier als Hintergrund.
- Das .goodnotes-Format ist nicht offiziell dokumentiert, die App baut es nach dem offenen Projekt [goodnotes-codec](https://github.com/Taylor-Nilsen/goodnotes-codec) (MIT) nach. Ein GoodNotes-Update kann den Import brechen – dann vorübergehend das PDF nehmen.
- GoodNotes-Striche haben eine feste Breite, der Druck des Pencils geht dabei verloren.

**Als PDF (Seitenhintergrund, nicht radierbar):**

1. **PDF** antippen.
2. Im Teilen-Menü **GoodNotes** wählen (ggf. unter „Mehr“). GoodNotes legt ein neues Dokument an oder fügt die Seiten an.
3. Erscheint stattdessen der Knopf **Jetzt teilen**, einfach noch einmal tippen (Safari verlangt das manchmal, wenn das Erzeugen länger gedauert hat).

- Das PDF ist A4, mehrseitig und in Vektorqualität – die Schrift bleibt bei jedem Zoom scharf.
- **Papier** (Haken in der Exportleiste): Ein importiertes PDF wird in GoodNotes zum Seitenhintergrund, deshalb kommt das gewählte Papier standardmäßig mit ins PDF.
- **PNG** erzeugt ein Bild pro Seite (300 dpi). Ohne Haken bei „Papier“ ist der Hintergrund transparent – praktisch, um die Schrift als Bild auf eine vorhandene GoodNotes-Seite zu legen.

### Papier wie in GoodNotes

Die Vorlagen sind nach den Messungen des offenen Projekts [goodnotes-codec](https://github.com/Taylor-Nilsen/goodnotes-codec) nachgebaut. GoodNotes legt sie in festen Abständen ab der linken oberen Ecke an (1 pt = 0,353 mm):

| Vorlage | Abstand | Erste Linie (Oberkante) |
|---|---|---|
| Liniert breit | 25 pt = 8,82 mm | 49,5 pt = 17,5 mm |
| Liniert schmal | 17,5 pt = 6,17 mm | 50 pt = 17,6 mm |
| Kariert | 16 pt = 5,64 mm | 15,5 pt |
| Gepunktet | 16 pt = 5,64 mm, Punkte mit 0,5 pt Radius | 16 pt |

Linien sind 0,5 pt dick und grau (#d0d2d3), auf dunklem Papier (#333333) #58595b. Gelbes Papier ist #f8f7e9.

Cornell-, Checklisten- und Planer-Papiere sind nicht dabei, weil für sie keine Maße vorliegen.

### Profile (Tab „Profil“ und Auswahl oben rechts)

Du kannst mehrere Profile mit eigenem Namen anlegen. Jedes Profil hat eigenen Stil, eigene Tinte und eigenes Papier. Die Schrift ist entweder

- **eine eigene** – z. B. eine zweite Handschrift oder die einer anderen Person; nach dem Anlegen im Tab „Aufnahme“ neu aufnehmen, oder
- **die eines anderen Profils** – z. B. deine Schrift als „Schnell mitgeschrieben“ mit der Vorlage „Unordentlich“. Aufnahmen und Korrekturen landen dann bei dem Profil, dem die Schrift gehört.

Gewechselt wird oben rechts in der Kopfzeile (die App lädt dabei kurz neu). Text, Arbeitsblatt und Exportwahl gelten für alle Profile.

## 4. Backup – wichtig!

Deine Profile liegen nur im Speicher von Safari auf diesem iPad. Wird die App gelöscht oder Safari-Daten entfernt, sind sie weg.

- **Profil → Alle Profile sichern** packt alle Profile mit ihren Schriften und Stil-Einstellungen in eine `.json`-Datei. Im Teilen-Menü „In Dateien sichern“ wählen, am besten in iCloud Drive.
- **Profil teilen** schickt das aktive Profil (Schrift und Stil) als Datei, z. B. per AirDrop oder Nachricht. Benutzt das Profil die Schrift eines anderen, kommt diese Schrift mit.
- **Importieren** liest eine solche Datei ein. Die Profile kommen als **neue Profile** dazu, vorhandene bleiben unangetastet (gleiche Namen werden durchnummeriert). Auf einem neuen Gerät ersetzt der Import das leere Start-Profil. Alte Backups mit nur einer Schrift ersetzen wie früher die Schrift des aktiven Profils.
- In der Datei stehen nur Schriften und Stil-Einstellungen – keine Texte und keine Geräte-Einstellungen.
- Ein **roter Punkt am Profil-Tab** und ein Hinweis oben erinnern dich, wenn das letzte Backup älter als 7 Tage ist.
- Auf iPad/iPhone erscheint außerdem der Hinweis **„Zum Home-Bildschirm hinzufügen“**: In Safari darf eine normale Website ihre Daten nach 7 Tagen ohne Nutzung verlieren, als Home-Bildschirm-App nicht. Die Home-Bildschirm-App hat einen eigenen Speicher – vorher sichern, dort importieren.

## 5. Updates einspielen

1. Geänderte Dateien in GitHub hochladen (gleiche Stelle, überschreiben).
2. In `sw.js` die Zeile `const VERSION = 'v29';` hochzählen (z. B. auf `'v30'`). **Ohne diesen Schritt sieht das iPad die alten Dateien.**
3. App auf dem iPad öffnen. Nach ein paar Sekunden erscheint „Eine neue Version ist bereit“ → **Neu laden**.

### claude.ai-Version aktualisieren

`node tools/build-artifact.mjs` baut sie nach `dist-artifact/` (ohne Service Worker; Steuerzeichen in den Bibliotheken werden maskiert, weil claude.ai sie nicht annimmt). Den Ordner dann mit Claude Code als Artifact veröffentlichen (Fähigkeiten `sample` mit Bildern und `downloads`) – an dieselbe Adresse, damit der Link gleich bleibt.

## 6. Probleme lösen

| Problem | Lösung |
|---|---|
| Pencil schreibt nicht | Mit dem Pencil direkt ins Kästchen schreiben. |
| Finger zeichnet nicht mehr | Nach dem ersten Pencil-Strich zählt nur noch der Pencil. Profil → Eingabe & Speicher → „Finger und Maus zum Schreiben erlauben“. |
| Alte Version wird angezeigt | App ganz schließen (von unten wischen) und neu öffnen, ggf. zweimal. |
| Teilen-Menü zeigt GoodNotes nicht | Im Teilen-Menü ganz nach rechts wischen → „Mehr“ → GoodNotes aktivieren. |
| Zeichen fehlen rot im PDF | Die markierten Zeichen im Tab „Aufnahme“ nachtragen. |
| Profil ist weg | Profil → Importieren und das letzte Backup wählen. |

## 7. Für Entwickler

Projektstruktur:

```
index.html              Oberfläche (Tabs, auf dem Handy unten), Icons, Meta-Daten und strukturierte Daten (JSON-LD)
anleitung.html          Anleitung, Vergleich, häufige Fragen (HowTo/FAQ als JSON-LD) – für Menschen und Suchmaschinen
datenschutz.html        Datenschutz, Marken, Lizenzen
css/app.css             Gestaltung, Touch-Größen, heller und dunkler Modus
css/seite.css           Gestaltung der Textseiten
sitemap.xml, llms.txt   für Suchmaschinen und KI-Suchen
icons/og.png            Vorschaubild für geteilte Links
demo/demo-schrift.json  (optional) Demo-Schrift für den ersten Start, siehe 1b
js/app.js               Start, Navigation, Offline/Updates, Hinweise (Home-Bildschirm, Sicherung)
js/demo.js              Demo-Schrift beim ersten Start anlegen
js/tutorial.js          Kurze Einführung (erster Start und ?-Knopf)
js/aufnahme.js          Modul 1: Pencil-Aufnahme
js/schreiben.js         Modul 2: Textfeld, Vorschau, Einstellungen, Export-Knöpfe
js/blatt.js             Arbeitsblatt: blaue Antworten finden/entfernen, Felder, Einpassen
js/blattui.js           Tab Blatt: Felder verschieben, aufziehen, bearbeiten, Export
js/pdfimport.js         PDF (pdf.js) und Fotos einlesen, 200 dpi
js/layout.js            Satz: Paare, Varianten, Unordnung, Umbruch, Seiten, Linien
js/render.js            Zeichnen auf Canvas (Vorschau, PNG)
js/paper.js             GoodNotes-Papiervorlagen (Maße, Farben)
js/stil.js              Stil-Vorlagen, Anpassungen je Vorlage, Farbton
js/profilwahl.js        Profile anlegen, wechseln, umbenennen, löschen
js/sammlung.js          Datei mit mehreren Profilen: Backup aller Profile, Profil teilen
js/ki.js                KI-Tab: Regeln, Gespräch, Anhänge (ohne DOM)
js/kiui.js              KI-Tab: Chat-Oberfläche, Dateien, Übernehmen in die Handschrift
js/dialog.js            Eigene Dialoge (Bestätigen, Hinweis, Eingabe, Auswahl)
js/einfuegen.js         Eingefügten Text bereinigen und einsetzen
js/export.js            PDF (Vektor), PNG, Teilen
js/goodnotes.js         .goodnotes-Notizbuch (ZIP + Protobuf, Kugelschreiber-Striche)
js/ink.js               Strichumrisse mit Druck (perfect-freehand)
js/profile.js           Zeichensatz, Profil-Format, Import-Prüfung
js/profil.js            Tab Profil: Backup, Eingabe (Finger/Maus)
js/storage.js           IndexedDB und Einstellungen
sw.js                   Service Worker (Offline-Cache)
ios/                    iPad-App (SwiftUI + WKWebView): Handschrift-App, echtes claude.ai, Übernehmen, Teilen
.github/workflows/ios.yml  baut die iPad-App als .ipa (GitHub Actions, macOS)
tools/build-artifact.mjs   baut die claude.ai-Version
vendor/                 perfect-freehand 1.2.2, jsPDF 2.5.2 (beide MIT), pdf.js 4.10.38 (Apache-2.0, wird erst beim ersten Blatt geladen), Feather-Lizenz
LICENSE                 MIT
tests/                  Selbsttests
```

Profil-Format: Koordinaten sind in x-Höhen normiert (Grundlinie y = 0, x-Höhe y = −1), jeder Punkt ist `[x, y, Druck, ms]`.

Selbsttests (Node.js ≥ 18):

```
node tests/profile.test.mjs
node tests/layout.test.mjs
node tests/export.test.mjs
node tests/goodnotes.test.mjs
node tests/textplan.test.mjs
node tests/blatt.test.mjs
node tests/paper.test.mjs
node tests/stil.test.mjs
node tests/storage.test.mjs
node tests/sammlung.test.mjs
node tests/einfuegen.test.mjs
node tests/ki.test.mjs
```

Lokal starten (Service Worker braucht `localhost` oder HTTPS):

```
python -m http.server 8765
```

Dann `http://localhost:8765` öffnen. Neue Dateien müssen in `sw.js` in der Liste `FILES` eingetragen werden.

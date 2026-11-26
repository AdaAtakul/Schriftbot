# Handschrift-Tool

Eine Web-App für das iPad: Sie nimmt deine eigene Handschrift mit dem Apple Pencil auf und verwandelt getippten Text in diese Handschrift – als eigene Seiten oder direkt auf einem Arbeitsblatt. Das Ergebnis gibst du als GoodNotes-Notizbuch, PDF oder PNG über das Teilen-Menü weiter.

- Läuft im Safari auf dem iPad, optimiert fürs Querformat
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
   manifest.webmanifest
   sw.js
   README.md
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

## 2. Auf dem iPad installieren

1. Die Adresse in **Safari** öffnen (nicht in Chrome – nur Safari kann Apps zum Home-Bildschirm hinzufügen).
2. **Teilen-Symbol** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App ab jetzt immer über das neue Symbol starten. So läuft sie im Vollbild, offline, und Safari löscht ihre Daten deutlich seltener.
4. Im Tab **Profil** sollte unter „Status“ „✅ Offline-Modus bereit“ stehen.

## 3. So benutzt du die App

### Handschrift aufnehmen (Tab „Aufnahme“)

- Links wählst du das Zeichen, rechts schreibst du es mit dem Pencil in die drei Kästchen (= drei Varianten, damit die Schrift später lebendig wirkt).
- **Grundlinie** (dunkle Linie): Hier steht die Schrift. **x-Höhe** (blau gestrichelt): So hoch sind Kleinbuchstaben wie a, n, o. **Oberlänge / Unterlänge**: für b, d, h, k bzw. g, j, p, y.
- **Leerzeichen**: einen waagerechten Strich ziehen, so lang wie dein normaler Wortabstand.
- **Verbundene Paare** (ch, sch, ei …): so schreiben, wie du sie wirklich verbindest. Eigene Paare fügst du unten links hinzu.
- Farben in der Liste: weiß = fehlt, gelb = 1–2 Varianten, grün = fertig.
- **Nächstes fehlendes ⏭** springt zum nächsten unvollständigen Zeichen.
- **Kästchen an meine Schrift anpassen** (links oben): Misst, wie groß du Kleinbuchstaben wirklich schreibst, und verkleinert Kästchen und Hilfslinien passend. Deine Aufnahmen bleiben gleich groß und das PDF auch (die Schriftgröße im Schreiben-Tab wird ausgeglichen). Gilt auch für die Aufnahme als Text.
- Nur der Apple Pencil zeichnet. Finger und Handballen werden ignoriert, damit du die Hand ablegen kannst.

- Unter den Kästchen zeigt **„So sieht es im Text aus“** Beispielwörter mit dem aktuellen Zeichen in deiner Schrift. So fällt ein zu großer oder schiefer Buchstabe sofort auf.
- Beim Wechsel zum nächsten Zeichen rückt die App jede Variante mittig unter die Vorlage. Liegt ein Buchstabe nur knapp neben der Grundlinie, setzt sie ihn genau darauf.

Tipp: Schreib in normaler Größe und Geschwindigkeit, nicht „schön“. Je natürlicher die Aufnahme, desto echter das Ergebnis.

### Schneller: als Text aufnehmen

Oben links auf **Als Text** umschalten. Statt jedes Zeichen einzeln schreibst du einen kurzen Text (5 Seiten) über eine blasse Vorlage. Er enthält alle Buchstaben, Umlaute, ß, alle verbundenen Paare, Ziffern und Satzzeichen.

- Buchstaben **einzeln** schreiben, nur **gelb hinterlegte Gruppen verbunden**.
- Die Strichfarbe wechselt je Zeichen – so siehst du, welchem Zeichen ein Strich zugeordnet wird.
- **✓ Übernehmen** speichert die Seite und blättert weiter. Gespeichert wird immer in eine freie Variante; vorhandene Aufnahmen werden nie überschrieben.
- Die Abstände zwischen deinen Wörtern werden automatisch als Leerzeichen übernommen.
- Text dreimal schreiben = drei Varianten für jedes Zeichen. Einzelne Zeichen kannst du jederzeit unter **Einzeln** nachbessern.

### Text umwandeln (Tab „Schreiben“)

- Links Text eingeben oder einfügen, rechts erscheint die A4-Vorschau.
- **Roter Papierkorb** oben rechts im Textfeld: löscht den ganzen Text nach einer Rückfrage. Direkt danach holt **Gelöschten Text wiederherstellen** ihn zurück (bis du neu tippst).
- **Papier**: die GoodNotes-Vorlagen Blanko, Liniert breit, Liniert schmal, Kariert und Gepunktet, jeweils in **Weiß, Gelb oder Dunkel** (Papierfarbe). Jede Zeile steht genau auf einer Linie, Karolinie oder Punktreihe (bei Kariert und Gepunktet anfangs jede zweite Reihe, änderbar über „Zeilenabstand“). Für dunkles Papier gibt es weiße Tinte.
- **Stil-Vorlage**: Sehr ordentlich, Ordentlich, Normal, Locker, Unordentlich oder Sehr unordentlich. Die Vorlage stellt die Stil-Regler darunter ein. Jeden Regler kannst du ändern: Deine Werte bleiben für genau diese Vorlage gespeichert („Angepasst“), **Vorlage zurücksetzen** holt die Originalwerte zurück.
- Stil-Regler (gehören zur gewählten Vorlage):
  - **Verbindungen**: wie oft verbundene Paare statt Einzelbuchstaben genutzt werden.
  - **Unordnung** (bis 150 %): kleine Drehungen, Größen- und Abstandsunterschiede, leichte Schräglage.
  - **Durchstreichen**: wie oft ein Wort erst falsch angefangen (Buchstabendreher oder falscher Buchstabe), durchgestrichen und daneben richtig geschrieben wird. „aus“ = nie; bei 100 % etwa alle paar Sätze mehrmals. Verschreiber nutzen nur aufgenommene Zeichen, **Neu würfeln** verteilt sie neu. In GoodNotes ist der Streichstrich ein eigener, radierbarer Strich.
  - **Zeilen & Druck**: Zeilen schwanken leicht, der Druck wechselt von Wort zu Wort und lässt zum Zeilenende nach.
  - **Ränder**: Zeilenanfänge rücken mal etwas ein, Zeilen brechen rechts mal früher um – wie beim echten Schreiben.
  - **Strichdicke**: dünner oder kräftiger (40–250 %), gilt für Vorschau und alle Exporte.
- **Tintenfarbe**: feste Farben oder der Regenbogen-Knopf mit dem **Farbton**-Regler für jede beliebige Tintenfarbe.
- **Schriftgröße, Zeilenabstand, Rand** nach Geschmack.
- **Neu würfeln**: andere Mischung der Varianten.
- **Größen angleichen**: Bringt zu kleine oder zu große Buchstaben auf die typische Größe deiner übrigen Buchstaben (getrennt nach Kleinbuchstaben, Oberlängen, Großbuchstaben und Ziffern). Deine Proportionen bleiben, nur Ausreißer über 15 % werden korrigiert. i, j, t, Umlaute und Satzzeichen bleiben unberührt. Vor dem Übernehmen zeigt die App, welche Zeichen sich ändern. **↶ Angleichen rückgängig** geht, bis du die App schließt.
- Fehlende Zeichen werden **rot markiert** und unter dem Textfeld aufgelistet.
- Der Abstand zwischen Buchstaben richtet sich nach ihrer Form: Ein o rückt unter das Dach eines T, schräge Schrift wird nicht zu breit.

### Arbeitsblatt ausfüllen (Tab „Blatt“)

Du hast ein Arbeitsblatt als PDF, in das die Antworten blau hineingetippt sind? Die App setzt sie in deiner Handschrift an genau dieselbe Stelle.

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

Dein Handschrift-Profil liegt nur im Speicher von Safari auf diesem iPad. Wird die App gelöscht oder Safari-Daten entfernt, ist es weg.

- Im Tab **Profil → Profil exportieren** speicherst du die Schrift des aktiven Profils als `.json`-Datei, am besten in iCloud Drive. Jede eigene Schrift braucht ein eigenes Backup.
- **Profil importieren** spielt sie wieder ein (auch auf einem anderen Gerät).
- Ein **roter Punkt am Profil-Tab** erinnert dich, wenn das letzte Backup älter als 7 Tage ist.

## 5. Updates einspielen

1. Geänderte Dateien in GitHub hochladen (gleiche Stelle, überschreiben).
2. In `sw.js` die Zeile `const VERSION = 'v24';` hochzählen (z. B. auf `'v25'`). **Ohne diesen Schritt sieht das iPad die alten Dateien.**
3. App auf dem iPad öffnen. Nach ein paar Sekunden erscheint „Eine neue Version ist bereit“ → **Neu laden**.

## 6. Probleme lösen

| Problem | Lösung |
|---|---|
| Pencil schreibt nicht | Mit dem Pencil direkt ins Kästchen schreiben. Zum Testen ohne Pencil: Profil → „Maus und Finger zum Zeichnen erlauben“. |
| Alte Version wird angezeigt | App ganz schließen (von unten wischen) und neu öffnen, ggf. zweimal. |
| Teilen-Menü zeigt GoodNotes nicht | Im Teilen-Menü ganz nach rechts wischen → „Mehr“ → GoodNotes aktivieren. |
| Zeichen fehlen rot im PDF | Die markierten Zeichen im Tab „Aufnahme“ nachtragen. |
| Profil ist weg | Profil → Profil importieren und das letzte Backup wählen. |

## 7. Für Entwickler

Projektstruktur:

```
index.html              Oberfläche (vier Tabs), Icons
css/app.css             Gestaltung, Touch-Größen
js/app.js               Start, Navigation, Offline/Updates
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
js/export.js            PDF (Vektor), PNG, Teilen
js/goodnotes.js         .goodnotes-Notizbuch (ZIP + Protobuf, Kugelschreiber-Striche)
js/ink.js               Strichumrisse mit Druck (perfect-freehand)
js/profile.js           Zeichensatz, Profil-Format, Import-Prüfung
js/profil.js            Tab Profil: Backup, Testmodus
js/storage.js           IndexedDB und Einstellungen
sw.js                   Service Worker (Offline-Cache)
vendor/                 perfect-freehand 1.2.2, jsPDF 2.5.2 (beide MIT), pdf.js 4.10.38 (Apache-2.0)
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
```

Lokal starten (Service Worker braucht `localhost` oder HTTPS):

```
python -m http.server 8765
```

Dann `http://localhost:8765` öffnen. Neue Dateien müssen in `sw.js` in der Liste `FILES` eingetragen werden.

# Handschrift-Tool

Eine Web-App für das iPad: Sie nimmt deine eigene Handschrift mit dem Apple Pencil auf und verwandelt getippten Text in diese Handschrift. Das Ergebnis gibst du als PDF (oder PNG) über das Teilen-Menü an GoodNotes weiter.

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
   vendor/
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
- **Papier**: Liniert breit / schmal, Kariert 5 mm oder Blanko. Auf liniertem und kariertem Papier steht jede Zeile genau auf einer Linie.
- **Verbindungen**: wie oft verbundene Paare statt Einzelbuchstaben genutzt werden.
- **Unordnung**: kleine Drehungen, Größen- und Abstandsunterschiede, leichte Schräglage – wie echte Handschrift.
- **Schriftgröße, Zeilenabstand, Rand, Tintenfarbe** nach Geschmack.
- **🎲 Neu würfeln**: andere Mischung der Varianten.
- Fehlende Zeichen werden **rot markiert** und unter dem Textfeld aufgelistet.
- Der Abstand zwischen Buchstaben richtet sich nach ihrer Form: Ein o rückt unter das Dach eines T, schräge Schrift wird nicht zu breit.

### KI-Assistent (Claude oder eine andere KI)

Im Tab **Schreiben** unter **✨ KI-Assistent** schreibst du einen Auftrag, z. B. „Fasse die Photosynthese in 5 Sätzen zusammen“. Die Antwort ersetzt den Text im Textfeld und erscheint sofort in deiner Handschrift. **Korrigieren**, **Kürzen** und **Stichpunkte** bearbeiten den vorhandenen Text. **↶ Vorherigen Text zurückholen** macht die letzte Änderung rückgängig.

Einrichten im Tab **Profil → KI-Assistent**:

- **Claude**: Unter [console.anthropic.com](https://console.anthropic.com) → *API Keys* einen Schlüssel anlegen und Guthaben aufladen, dann den Schlüssel einfügen. Voreingestellt ist `claude-opus-5-5`; `claude-haiku-5-5` ist deutlich günstiger.
- **Andere KI**: „Andere KI (OpenAI-kompatibel)“ wählen und Adresse, Modellname und Schlüssel des Anbieters eintragen (z. B. OpenAI `https://api.openai.com/v1`, OpenRouter `https://openrouter.ai/api/v1`). Manche Anbieter erlauben keinen Zugriff direkt aus dem Browser. Dann erscheint „Keine Verbindung“.

Gut zu wissen:

- Der Schlüssel bleibt nur auf diesem iPad und kommt nicht ins Profil-Backup.
- Auftrag und Text gehen an den gewählten Anbieter, der die Kosten direkt mit dir abrechnet.
- Die KI bekommt die Liste deiner aufgenommenen Zeichen und benutzt nur diese, damit nichts rot markiert wird.
- Der Assistent braucht Internet. Der Rest der App läuft weiter offline.

### Nach GoodNotes exportieren

1. **📄 PDF teilen** antippen.
2. Im Teilen-Menü **GoodNotes** wählen (ggf. unter „Mehr“). GoodNotes legt ein neues Dokument an oder fügt die Seiten an.
3. Erscheint stattdessen der Knopf **📤 Jetzt teilen**, einfach noch einmal tippen (Safari verlangt das manchmal, wenn das Erzeugen länger gedauert hat).

- Das PDF ist A4, mehrseitig und in Vektorqualität – die Schrift bleibt bei jedem Zoom scharf.
- **Linien mitexportieren**: Ein importiertes PDF wird in GoodNotes zum Seitenhintergrund, deshalb kommen die Linien standardmäßig mit ins PDF.
- **🖼 PNG teilen** erzeugt ein Bild pro Seite (300 dpi). Ohne „Linien mitexportieren“ ist der Hintergrund transparent – praktisch, um die Schrift als Bild auf eine vorhandene GoodNotes-Seite zu legen.

### Linien an GoodNotes anpassen

GoodNotes veröffentlicht die genauen Abstände seiner Linienvorlagen nicht. Voreingestellt sind ca. 8,8 mm (breit) und 6,2 mm (schmal). Wenn die Linien nicht passen, unter **Einstellungen** „Linienabstand“ und „Erste Linie von oben“ nachstellen.

## 4. Backup – wichtig!

Dein Handschrift-Profil liegt nur im Speicher von Safari auf diesem iPad. Wird die App gelöscht oder Safari-Daten entfernt, ist es weg.

- Im Tab **Profil → Profil exportieren** speicherst du eine `.json`-Datei, am besten in iCloud Drive.
- **Profil importieren** spielt sie wieder ein (auch auf einem anderen Gerät).
- Ein **roter Punkt am Profil-Tab** erinnert dich, wenn das letzte Backup älter als 7 Tage ist.

## 5. Updates einspielen

1. Geänderte Dateien in GitHub hochladen (gleiche Stelle, überschreiben).
2. In `sw.js` die Zeile `const VERSION = 'v15';` hochzählen (z. B. auf `'v16'`). **Ohne diesen Schritt sieht das iPad die alten Dateien.**
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
index.html              Oberfläche (drei Tabs)
css/app.css             Gestaltung, Touch-Größen
js/app.js               Start, Navigation, Offline/Updates
js/aufnahme.js          Modul 1: Pencil-Aufnahme
js/schreiben.js         Modul 2: Textfeld, Vorschau, Einstellungen, Export-Knöpfe
js/layout.js            Satz: Paare, Varianten, Unordnung, Umbruch, Seiten, Linien
js/render.js            Zeichnen auf Canvas (Vorschau, PNG)
js/export.js            PDF (Vektor), PNG, Teilen
js/ink.js               Strichumrisse mit Druck (perfect-freehand)
js/profile.js           Zeichensatz, Profil-Format, Import-Prüfung
js/profil.js            Tab Profil: Backup, Testmodus
js/storage.js           IndexedDB und Einstellungen
js/ki.js                KI-Aufruf: Claude (Messages-API) oder OpenAI-kompatibel
js/kiui.js              KI-Assistent: Einstellungen und Aufträge
sw.js                   Service Worker (Offline-Cache)
vendor/                 perfect-freehand 1.2.2, jsPDF 2.5.2 (beide MIT-Lizenz)
tests/                  Selbsttests
```

Profil-Format: Koordinaten sind in x-Höhen normiert (Grundlinie y = 0, x-Höhe y = −1), jeder Punkt ist `[x, y, Druck, ms]`.

Selbsttests (Node.js ≥ 18):

```
node tests/profile.test.mjs
node tests/layout.test.mjs
node tests/export.test.mjs
node tests/textplan.test.mjs
node tests/ki.test.mjs
```

Lokal starten (Service Worker braucht `localhost` oder HTTPS):

```
python -m http.server 8765
```

Dann `http://localhost:8765` öffnen. Neue Dateien müssen in `sw.js` in der Liste `FILES` eingetragen werden.

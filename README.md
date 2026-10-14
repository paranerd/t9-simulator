# T9 Simulator

Ein Tastendruck zurück: ein klassisches, dunkelblaues Retro-Handy mit grünem
Monochromdisplay. Geschrieben in TypeScript und SCSS, ohne UI-Framework.

**App:** https://paranerd.github.io/t9-simulator/

## Funktionen

- Klassisches Mehrfachdrücken (ABC), mit 850 ms Wartezeit.
- T9 für Deutsch und Englisch mit je 25.000 lokal mitgelieferten Wörtern.
- Wortalternativen, eigene Wörter und persönliche Häufigkeitsrangfolge.
- Deutsche Umlaute und ß, Satzzeichen, Sonderzeichen und Groß-/Kleinschreibung.
- Touch-, Maus- und Tastaturbedienung; Taste halten für Ziffern.
- Cursorbewegung, Zeilenumbrüche und korrekter SMS-Zähler für GSM-7 und Unicode.
- Automatisch gesicherter aktueller Text, bis zu 100 Entwürfe und 100 simuliert
  gesendete Nachrichten. Beim Starten einer neuen Nachricht wird der alte Text
  als Entwurf gesichert.
- Abschaltbare, lokal erzeugte DTMF-Tastentöne und optionale Vibration.
- Installierbare Offline-PWA, responsive für Mobilgeräte und Desktop.
- Keine Anmeldung, kein Backend, keine Analyse- oder Trackingdienste.
- Die Hauptansicht besteht ausschließlich aus dem Handy und einem Settings-Button.
  Wörterbuch, Entwürfe, Postausgang und eigene Wörter sind in den Settings erreichbar.

Das Gehäuse ist von klassischen Handys inspiriert und verwendet kein Markenlogo.
Empfang und Akku auf dem Display sind dekorative Anzeigen. Das Senden ist
ausschließlich simuliert; die App überträgt keine Nachrichten.

## Starten

Voraussetzung: Node.js 24 und npm.

```sh
npm ci
npm run dev
```

Die App verwendet auch lokal den Pfad `/t9-simulator/`.

```sh
npm test        # Eingabe, Wörterbücher, SMS-Segmentierung, Speicherung
npm run build  # TypeScript-Prüfung und Produktionsbuild mit Service Worker
npm run preview
```

## Bedienung

| Taste | Funktion |
| --- | --- |
| 2–9 | T9: ein Druck pro Buchstabe; ABC: durch Buchstaben schalten |
| 0 / Leertaste | Wort bestätigen, Leerzeichen |
| * | T9: nächster Vorschlag; sonst Sonderzeichen |
| # | Satzanfang automatisch / klein / GROSS |
| # halten | T9 / ABC umschalten |
| 1 | Satzzeichen durchschalten |
| Ziffer halten | Ziffer direkt einfügen |
| ↑ / ↓ | T9-Vorschläge durchschalten |
| ← / → | Wort bestätigen und Cursor bewegen |
| Enter | Wort bestätigen |
| Shift + Enter | Zeilenumbruch |
| Backspace | Letztes Zeichen entfernen |

Im ABC-Modus kurz warten oder die mittlere Navigationstaste drücken, bevor
derselbe Knopf für den nächsten Buchstaben verwendet wird. Die Navigation
links/rechts bestätigt ebenfalls den Buchstaben und bewegt zusätzlich den Cursor.
T9 wird durch langes Drücken auf der `#`-Taste des Handys ein- oder ausgeschaltet.
Der aktuelle Modus (T9 / ABC) ist im Display sichtbar.
T9 zeigt zuerst ganze Wörter, danach passende Wortanfänge. Mit „Eigenes Wort
hinzufügen“ lässt sich ein fehlendes Wort für die gewählte Sprache speichern.
Diese Funktion befindet sich in den Settings.
Bei einer unbekannten Ziffernfolge muss die Schreibweise zur Folge passen.

## Offline & Installation

Einmal online öffnen und vollständig laden lassen. Der Service Worker
lädt die gesamte App, beide Wörterbücher, Icons und Lizenztexte in den Cache.
Danach funktionieren Schreiben, Entwürfe, Wörterbücher, Töne und Postausgang
auch ohne Netzwerk. Die Entwicklungsansicht registriert bewusst keinen Service
Worker; für Offline-Tests den Produktionsbuild mit `npm run preview` verwenden.

- Android/Chromium/Desktop: „App installieren“ in den Settings oder im Browser.
- iPhone/iPad: Teilen-Menü → „Zum Home-Bildschirm“.
- Updates: „Update laden“ erscheint in den Settings, wenn eine neue Version bereitsteht. Der
  aktuelle Text wird vor dem Neuladen gespeichert.

Vibration ist nur auf Geräten verfügbar, die die Vibration API unterstützen;
iOS unterstützt sie üblicherweise nicht. Tastentöne beginnen erst nach einer
Interaktion. Alle Texte und Einstellungen werden in `localStorage` gespeichert.
Browserdaten löschen entfernt auch Texte und gelernte Wörter. Privatmodus,
Speicherbeschränkungen oder automatische Browserbereinigung können die
Speicherung einschränken. Die App zeigt einen Hinweis, wenn das Speichern fehlschlägt.

## GitHub Pages

`.github/workflows/deploy.yml` installiert mit `npm ci`, führt Tests aus und
baut die PWA. Pushes auf `main` veröffentlichen `dist/` automatisch auf Pages.
Pull Requests führen nur Tests und Build aus.

In **Settings → Pages → Source** muss **GitHub Actions** gewählt sein.
Die Konfiguration enthält den Repository-Pfad `/t9-simulator/` für App,
Manifest und Service Worker. Bei Umbenennung des Repositories müssen `base`,
`id`, `scope` und `start_url` in `vite.config.ts` angepasst werden.

## Struktur

- `src/engine.ts`: Schreibzustand, Mehrfachdrücken, Cursor und T9-Eingabe.
- `src/t9.ts`: Ziffernzuordnung, Wörterbuch-Trie und persönliche Rangfolge.
- `src/sms.ts`: SMS-Zeichen und Segmentberechnung.
- `src/storage.ts`: validierte lokale Speicherung.
- `src/main.ts`: Oberfläche, Bedienung und PWA-Registrierung.
- `src/style.scss`: responsive Retro-Gestaltung.
- `src/data/`: nach Häufigkeit geordnete Offline-Wortlisten.
- `tests/`: 19 automatisierte Prüfungen.

## Wörterbücher & Lizenz

Der App-Code steht unter **MIT**. Die bearbeiteten Wortlisten stammen aus
**wordfreq 3.1.1 von Robyn Speer** und stehen unter **CC BY-SA 4.0**.
Vollständige Quellen und Änderungen: [THIRD_PARTY.md](THIRD_PARTY.md).
Hinweise und die Datenlizenz werden auch offline mit der App ausgeliefert.

Die Wortlisten sind bereits eingecheckt. Zur Neuerzeugung in einer separaten
Python-Umgebung `pip install wordfreq==3.1.1` und anschließend
`python scripts/dictionaries.py` ausführen. Für neue PWA-Icons: `npm run icons`.

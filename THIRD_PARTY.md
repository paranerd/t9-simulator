# Wörterbücher

`src/data/de.json` und `src/data/en.json` enthalten je 25.000 häufige Wörter,
abgeleitet aus **wordfreq 3.1.1** von **Robyn Speer**.

- Quelle: https://github.com/rspeer/wordfreq
- Datenlizenz: Creative Commons Attribution-ShareAlike 4.0 International
  (https://creativecommons.org/licenses/by-sa/4.0/).
- Änderungen: Kleinschreibung, Filter auf lateinische Buchstaben einschließlich
  deutscher Umlaute und ß, maximal 24 Buchstaben, Begrenzung auf 25.000 Wörter je
  Sprache, Ergänzung gebräuchlicher ß-Schreibweisen neben den von wordfreq
  normalisierten ss-Formen, Ausgabe als nach Häufigkeit sortierte JSON-Arrays.
- Diese bearbeiteten Wortlisten werden ebenfalls unter CC BY-SA 4.0 bereitgestellt.
- Erzeugung: `scripts/dictionaries.py` mit `wordfreq==3.1.1`.

wordfreq verarbeitet frei verfügbare Daten aus Google Books Ngrams,
Wikipedia, Leeds Internet Corpus, ParaCrawl, OPUS OpenSubtitles 2018
(ursprünglich OpenSubtitles) und SUBTLEX-Wortlisten von **Marc Brysbaert et al.**
SUBTLEX ist frei verfügbar unter https://crr.ugent.be/programs-data/subtitle-frequencies.
Diese Quellen werden hier ausdrücklich gewürdigt. wordfreq enthält außerdem
aggregierte Wortstatistiken aus Twitter vor dessen Verkauf, keine Tweets.

Die vollständigen wordfreq-Hinweise sowie eine Kopie der Datenlizenz liegen in
`public/licenses/wordfreq-notice.txt` und `public/licenses/cc-by-sa-4.0.txt`.
Die Hinweise sind auch offline über die App-Einstellungen erreichbar.

Der Code des Simulators steht unter MIT. Fremdpakete behalten ihre jeweiligen
Lizenzen; sie sind in `package-lock.json` dokumentiert.

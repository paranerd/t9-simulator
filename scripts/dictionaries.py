"""Generate ranked, offline T9 dictionaries. Requires wordfreq==3.1.1.

Data: Robyn Speer, wordfreq 3.1.1, CC BY-SA 4.0. See THIRD_PARTY.md.
Run from the repository root: python scripts/dictionaries.py
"""
import json
import re
from pathlib import Path
from wordfreq import top_n_list

destination = Path(__file__).resolve().parents[1] / "src" / "data"
# wordfreq case-folds ß to ss. Restore common German spellings alongside the
# Swiss/normalized forms, at the same frequency position.
sharp_s_words = """straße straßen straßecke straßenbahn straßenverkehr
groß große großen großer großes größer größere größeren größeres größte größten
weiß weiße weißen weißer weißes weißt heißen heißt hieß heiß heiße heißen heißer
grüße grüßen gruß fuß füße füßen fußball fußgänger
außerdem draußen spaß spaßig spaßes maß maße maßstab maßgeblich
schließen schließt schließe geschlossen beschließen beschließt beschlossen
genießen genießt genoss ließ ließen reißen reißt riss gerissen
süß süße süßen süßer süßes fließen fließt fließend gießen gießt gegossen
stoßen stößt stoße gestoßen großartig größtenteils schließlich einschließlich
ausschließlich anschließend schweiß fleiß fleißig scheiße scheiß bloß außen
äußerst äußern äußere äußeren äußerlich vergrößern größerer größerem
""".split()
sharp_s = {word.replace("ß", "ss"): word for word in sharp_s_words if "ß" in word}
for language in ("de", "en"):
    seen = set()
    words = []
    for word in top_n_list(language, 60000):
        word = word.lower()
        if not re.fullmatch(r"[a-zäöüß]+", word) or len(word) > 24 or word in seen:
            continue
        if language == "de" and word in sharp_s and sharp_s[word] not in seen:
            seen.add(sharp_s[word])
            words.append(sharp_s[word])
        seen.add(word)
        words.append(word)
        if len(words) == 25000:
            words = words[:25000]
            break
    (destination / f"{language}.json").write_text(
        json.dumps(words, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    print(f"{language}: {len(words):,} words")

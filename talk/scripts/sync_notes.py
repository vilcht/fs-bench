#!/usr/bin/env python3
"""Copies each slide's "Say" line and target time from SCRIPT.md into src/deck.tsx (notes + seconds).

Rows are matched to slides by order, so keep one table row per slide, in deck order.
"""
import json
import os
import re
import sys

TALK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
script = open(os.path.join(TALK, "SCRIPT.md")).read()
rows = re.findall(r"^\| (\d+) \| (.+?) \| (\d+):(\d+) \| (.+) \|$", script, re.M)
path = os.path.join(TALK, "src", "deck.tsx")
deck = open(path).read()
start = deck.index("export const SLIDES: SlideDef[] = [\n") + len("export const SLIDES: SlideDef[] = [\n")
end = deck.index("\n]\n", start)
parts = [x for x in re.split(r"(?m)^(?=  \{\n    id: ')", deck[start:end]) if x.strip()]
if len(rows) != len(parts):
    sys.exit(f"SCRIPT.md has {len(rows)} rows but the deck has {len(parts)} slides")
NOTES = re.compile(r"    notes:\s*\n?\s*(['\"])(?:\\.|(?!\1).)*\1,\n(    seconds: \d+,\n)?", re.S)
out = []
for part, (_, title, mm, ss, say) in zip(parts, rows):
    text = say.replace("*Reveal:*", "Reveal:").replace("**", "").replace("`", "")
    new, n = NOTES.subn(lambda m: f"    notes:\n      {json.dumps(text)},\n    seconds: {int(mm) * 60 + int(ss)},\n", part, count=1)
    if not n:
        sys.exit(f"no notes found for slide '{title}'")
    out.append(new.rstrip().rstrip(",") + ",\n")
deck = deck[:start] + "".join(out).rstrip().rstrip(",") + "," + deck[end:]
open(path, "w").write(deck)
print(f"synced {len(rows)} slides, {sum(int(r[2]) * 60 + int(r[3]) for r in rows)} s planned")

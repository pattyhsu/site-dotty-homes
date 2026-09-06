# Print collateral

Five pieces that all point at the same place: a QR code → `dottyhomes.com/go/<piece>/`
→ the estimate form, tagged with which piece the person was holding. That tag lands in
the `leads` table, so after a season you can answer "which of these actually produced
jobs?" instead of guessing.

Press-ready PDFs are in [`pdf/`](pdf/) — hand those to the print shop as-is. All but
`neighbor-hanger`, which is built fresh for each job site (see below).

| Piece | Trim size | PDF size (incl. bleed) | Stock / finish to ask for | Where it goes |
|---|---|---|---|---|
| `flyer` | 8.5 × 11 in | 8.75 × 11.25 | 100# gloss text, 2-sided not needed | Open-house counter; crew hands them out |
| `door-hanger` | 4.25 × 11 in | 4.5 × 11.25 | 14pt cardstock, **die-cut hanger hole** | ~50 doors around each active job site |
| `neighbor-hanger` | 4.25 × 11 in | 4.5 × 11.25 | 14pt cardstock, **die-cut hanger hole** | Same doors — but **printed per job**, see below |
| `yard-sign` | 18 × 24 in | 18.25 × 24.25 | 4mm coroplast, **2-sided** (same art both sides), + H-stakes | Planted at active job sites |
| `banner` | 33 × 80 in | 33.25 × 80.25 | Retractable banner stand, matte vinyl | Beside the door at every open house |

**Tell the shop the PDFs include 0.125" bleed on every edge** and give them the trim
size from the table. Everything that must survive the cut is inside a 0.25" safe margin.

## The neighborhood hanger is printed per job

`neighbor-hanger.html` is the only piece that isn't a standing PDF. It prints the
actual job-site address and invites the neighbors to walk over and watch, which is why
there's no `pdf/neighbor-hanger.pdf` checked in — the one from the last job is wrong
for this one.

For each new job site:

1. Open `print/neighbor-hanger.html` and edit the **JOB SITE** block — street, city,
   and the hours the crew is really there. It's the only thing that changes.
2. `./print/build.sh` → `print/pdf/neighbor-hanger.pdf`
3. Print ~50, hang them the week the crew starts, while there's something to see.

Until that block is filled in the build **skips** this piece and says so; the other
four still rebuild normally. That's deliberate — a stack of 50 cards reading
`0000 EXAMPLE ST` is 50 wasted cards and a second trip to the shop.

The two hangers are separate pieces on purpose, with separate QR codes
(`door` vs `nbr`), so the `leads` table can answer which pitch actually works: the
cold "we remodel homes" or the warm "come see the one we're doing up the street."

## Changing the artwork

Each piece is one HTML file in this folder. Edit it, then:

```bash
./print/build.sh
```

That serves the repo locally, renders each piece with headless Chrome, and writes
`print/pdf/*.pdf`, printing the page dimensions it produced so you can confirm nothing
drifted.

To check margins visually, open a piece in a browser with `?guides` appended — dashed
lines show the trim and safe-area boundaries. The guides are screen-only and never
reach the PDF.

## The QR codes

`qr/*.svg` are generated, not drawn — regenerate them only if a URL changes:

```bash
python3 -m pip install segno
python3 -c "
import segno
for s in ['flyer','banner','yard','door','nbr']:
    segno.make(f'https://dottyhomes.com/go/{s}/', error='h').save(
        f'print/qr/{s}.svg', scale=10, border=2, dark='#0e0c0a', light=None)
"
```

Error correction is set to H (30%), so a code still scans after a yard sign has spent a
month outdoors or a door hanger has been folded in half.

**If you change a QR URL, the matching stub in `/go/<piece>/` must still exist** — those
folders are what make each piece's scans countable separately. Deleting one turns every
already-printed piece pointing at it into a dead end.

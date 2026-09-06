#!/usr/bin/env bash
# Render the print collateral to press-ready PDFs.
#
#   ./print/build.sh          → print/pdf/*.pdf
#
# Serves the repo over HTTP first, because the pieces pull Google Fonts and
# local photos; opening them as file:// gives you fallback type and a piece
# that is off-brand in a way you won't notice until it's printed.
#
# Every PDF is TRIM + 0.125" bleed on each edge — tell the print shop the
# file includes bleed and give them the trim size:
#
#   flyer         8.5 × 11   in    (PDF 8.75 × 11.25)
#   door-hanger   4.25 × 11  in    (PDF 4.5 × 11.25)   die-cut hole at top
#   neighbor-hanger 4.25 × 11 in   (PDF 4.5 × 11.25)   die-cut, per-job address
#   yard-sign     18 × 24    in    (PDF 18.25 × 24.25) 2-sided, coroplast
#   banner        33 × 80    in    (PDF 33.25 × 80.25) retractable
#
# Add ?guides to any piece in a browser to see the trim and safe-area
# outlines (screen-only — they never reach the PDF).
set -euo pipefail

cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=4321
OUT="print/pdf"

[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME" >&2; exit 1; }
mkdir -p "$OUT"

PIECES=(flyer door-hanger yard-sign banner)

# The neighborhood hanger prints a specific job-site address, so it is built
# per job rather than kept as a standing PDF — and a stack of 50 that says
# 0000 EXAMPLE ST is 50 wasted cards plus a second trip to the shop. Skip it
# while the placeholder is still there, but never block the other four: those
# don't change per job and you should be able to rebuild them any time.
if grep -q '0000 EXAMPLE ST' print/neighbor-hanger.html; then
  SKIPPED_NEIGHBOR=1
else
  PIECES+=(neighbor-hanger)
fi

python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

# Wait for the server rather than sleeping a guessed number of seconds.
for _ in $(seq 1 40); do
  curl -sf -o /dev/null "http://localhost:$PORT/print/print.css" && break
  sleep 0.25
done

for piece in "${PIECES[@]}"; do
  # --virtual-time-budget gives webfonts and photos time to land; without it
  # Chrome can snapshot the page mid-load and you get Helvetica.
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --virtual-time-budget=10000 \
    --print-to-pdf="$OUT/$piece.pdf" \
    "http://localhost:$PORT/print/$piece.html" 2>/dev/null
  size=$(python3 - "$OUT/$piece.pdf" <<'PY'
import re, sys
d = open(sys.argv[1], 'rb').read()
b = [float(x) for x in re.search(rb'/MediaBox\s*\[([^\]]+)\]', d).group(1).split()]
print(f'{(b[2]-b[0])/72:g} x {(b[3]-b[1])/72:g} in')
PY
)
  printf '%-14s %s  (%s)\n' "$piece" "$size" "$(du -h "$OUT/$piece.pdf" | cut -f1)"
done

echo
echo "PDFs in $OUT/ — sizes above include bleed."

if [ "${SKIPPED_NEIGHBOR:-}" = 1 ]; then
  cat >&2 <<'MSG'

SKIPPED neighbor-hanger — it still says 0000 EXAMPLE ST.
  Edit the JOB SITE block in print/neighbor-hanger.html (street, city,
  and the hours the crew is actually on site), then run this again.
  That piece is printed fresh for each job on purpose.
MSG
fi

#!/usr/bin/env python3
"""
Slices a 3x3 sheet of portrait poses into the nine look-at-cursor frames.

    python3 tools/slice-look-frames.py <sheet.png>

The sheet is read in the same order the effect uses:

    up-left     up      up-right
    left        center  right
    down-left   down    down-right

Two things here are not obvious, and both were bugs first:

* **One crop box, shared by all nine frames** -- the union of their ink
  bounding boxes, grown to the portrait's 107:122 aspect rather than squashed
  to it. Cropping each pose to its own content instead rescales and recentres
  it, so the head jumps in size and position as it looks about, which ruins
  the effect it is there to create.

* **Composite onto white before resizing.** The shared box is taller than a
  cell, so on the top and bottom rows it overruns the artwork. PIL fills an
  out-of-bounds crop with black, which shipped once as black bands across the
  top and bottom of six frames.

Writes frontend/public/portrait--look-<direction>.png and checks the edges of
each result, since a black band is easy to miss on a dark page.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

DIRS = [
    ["up-left", "up", "up-right"],
    ["left", "center", "right"],
    ["down-left", "down", "down-right"],
]

# The portrait's native size, matching public/portrait.png and the character
# spritesheet (PORTRAIT_WIDTH/HEIGHT in src/data/portraits.ts).
TW, TH = 107, 122

# A pixel counts as ink if it is meaningfully darker than the white ground.
INK = 720


def main(sheet_path: str) -> int:
    out_dir = Path(__file__).resolve().parent.parent / "frontend" / "public"
    src = Image.open(sheet_path).convert("RGB")
    sw, sh = src.size

    if sw % 3 or sh % 3:
        print(f"sheet is {sw}x{sh}, not divisible into a 3x3 grid", file=sys.stderr)
        return 1
    cw, ch = sw // 3, sh // 3

    origins, box = {}, None
    left = top = 10 ** 9
    right = bottom = -1

    for r, row in enumerate(DIRS):
        for c, name in enumerate(row):
            ox, oy = c * cw, r * ch
            origins[name] = (ox, oy)
            cell = np.asarray(src.crop((ox, oy, ox + cw, oy + ch))).astype(int)
            ys, xs = np.where(cell.sum(axis=2) < INK)
            if not len(xs):
                print(f"cell {name} is blank", file=sys.stderr)
                return 1
            left, right = min(left, xs.min()), max(right, xs.max())
            top, bottom = min(top, ys.min()), max(bottom, ys.max())

    w, h = right - left + 1, bottom - top + 1
    if w / h > TW / TH:
        pad = (round(w * TH / TW) - h) / 2
        top, bottom = top - pad, bottom + pad
    else:
        pad = (round(h * TW / TH) - w) / 2
        left, right = left - pad, right + pad
    box = (round(left), round(top), round(right) + 1, round(bottom) + 1)
    bw, bh = box[2] - box[0], box[3] - box[1]
    print(f"cells {cw}x{ch}, shared crop {bw}x{bh} (aspect {bw/bh:.4f}, target {TW/TH:.4f})")

    failures = 0
    for name, (ox, oy) in origins.items():
        frame = Image.new("RGB", (bw, bh), (255, 255, 255))
        x0, y0 = max(0, ox + box[0]), max(0, oy + box[1])
        x1, y1 = min(sw, ox + box[2]), min(sh, oy + box[3])
        if x1 > x0 and y1 > y0:
            frame.paste(src.crop((x0, y0, x1, y1)), (x0 - (ox + box[0]), y0 - (oy + box[1])))

        out = out_dir / f"portrait--look-{name}.png"
        frame.resize((TW, TH), Image.LANCZOS).save(out, optimize=True)

        # The top and bottom edges must stay clear: content reaching the sides
        # is legitimate (the front-facing pose has the widest shoulders), but a
        # dark top or bottom edge means the overrun was filled rather than
        # padded, i.e. the black-band bug is back.
        a = np.asarray(Image.open(out).convert("RGB")).astype(int)
        for edge_name, edge in (("top", a[0]), ("bottom", a[-1])):
            dark = int((edge.sum(axis=1) < 600).sum())
            if dark:
                print(f"  !! {name}: {dark} dark px on {edge_name} edge", file=sys.stderr)
                failures += 1
        print(f"  {out.name}  {out.stat().st_size // 1024}K")

    if failures:
        print(f"{failures} edge check(s) failed", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))

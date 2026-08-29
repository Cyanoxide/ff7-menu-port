#!/usr/bin/env python3
"""
Slices a 3x3 sheet of portrait poses into the nine look-at-cursor frames.

    python3 tools/slice-look-frames.py <sheet.png> [zoom]

`zoom` (default 0.78) tightens the shared crop toward the top of the heads.
At 1.0 the box is the full union of the nine poses, which leaves every frame
some slack -- the box has to fit the widest pose and the tallest, so no single
frame ever fills it and the face reads as too small and too far away. Below 1.0
the box closes in, the outermost poses bleed off the edges, and the face fills
the frame the way public/portrait.png does. The crop stays shared, so the head
still does not move between frames.

The sheet is read in the same order the effect uses:

    up-left     up      up-right
    left        center  right
    down-left   down    down-right

Two things here are not obvious, and both were bugs first:

* **One crop *size*, shared by all nine frames**, and one shared horizontal
  window -- the union of their ink bounding boxes, grown to the portrait's
  107:122 aspect rather than squashed to it. Size and horizontal placement have
  to be shared or the head jumps and rescales as it looks about, and the
  sideways turn is exactly what the horizontal window is carrying.

* **Vertically each frame is anchored to its own crown**, not to the shared
  union. The artist drew the bottom row about 23px higher in its cells than the
  other two, so a shared vertical anchor gave the top six frames a band of dead
  white above the head and cut the same amount off their shoulders. The crown
  is the one landmark that is stable across all nine poses -- he is bald, so it
  is a clean arc in every frame -- and the vertical drawing offset carries no
  pose information worth keeping.

* **Composite onto white before resizing.** The shared box is taller than a
  cell, so on the top and bottom rows it overruns the artwork. PIL fills an
  out-of-bounds crop with black, which shipped once as black bands across the
  top and bottom of six frames.

Writes frontend/art/portrait-frames/portrait--look-<direction>.png and checks
the edges of each result, since a black band is easy to miss on a dark page.

Those are sources, not shipped assets. Run tools/pack-look-sheet.py afterwards
to build the spritesheet the site actually loads -- nothing does it for you.
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


def main(sheet_path: str, zoom: float) -> int:
    out_dir = Path(__file__).resolve().parent.parent / "frontend" / "art" / "portrait-frames"
    src = Image.open(sheet_path).convert("RGB")
    sw, sh = src.size

    if sw % 3 or sh % 3:
        print(f"sheet is {sw}x{sh}, not divisible into a 3x3 grid", file=sys.stderr)
        return 1
    cw, ch = sw // 3, sh // 3

    origins, crowns = {}, {}
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
            crowns[name] = int(ys.min())

    w, h = right - left + 1, bottom - top + 1

    # Close in on the heads horizontally; the height then follows from the
    # portrait's aspect rather than from the union, since the vertical placement
    # is per-frame below.
    centre_x = (left + right) / 2
    bw = round((right - left + 1) * zoom)
    bh = round(bw * TH / TW)
    bx = round(centre_x - bw / 2)
    print(f"cells {cw}x{ch}, crop {bw}x{bh} (aspect {bw/bh:.4f}, target {TW/TH:.4f}), "
          f"crown offsets {min(crowns.values())}..{max(crowns.values())}")

    failures = 0
    for name, (ox, oy) in origins.items():
        # Vertical origin is this frame's own crown, so the top of the head
        # lands on the top of the picture in all nine.
        by = crowns[name]

        frame = Image.new("RGB", (bw, bh), (255, 255, 255))
        x0, y0 = max(0, ox + bx), max(0, oy + by)
        x1, y1 = min(sw, ox + bx + bw), min(sh, oy + by + bh)
        if x1 > x0 and y1 > y0:
            frame.paste(src.crop((x0, y0, x1, y1)), (x0 - (ox + bx), y0 - (oy + by)))

        out = out_dir / f"portrait--look-{name}.png"
        frame.resize((TW, TH), Image.LANCZOS).save(out, optimize=True)

        # Look for the black-band bug specifically -- an out-of-bounds crop
        # filled with pure black -- not merely for a dark edge. Artwork running
        # off an edge is expected once the zoom closes in (the shoulders bleed
        # off the bottom by design, and the darkest shirt pixels still sum to
        # ~290), so a brightness threshold flags the intended crop as a fault.
        a = np.asarray(Image.open(out).convert("RGB")).astype(int)
        for edge_name, edge in (("top", a[0]), ("bottom", a[-1]), ("left", a[:, 0]), ("right", a[:, -1])):
            filled = int((edge.sum(axis=1) < 24).sum())
            if filled:
                print(f"  !! {name}: {filled} px of black fill on {edge_name} edge", file=sys.stderr)
                failures += 1
        print(f"  {out.name}  {out.stat().st_size // 1024}K")

    if failures:
        print(f"{failures} edge check(s) failed", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) == 3 else 0.78))

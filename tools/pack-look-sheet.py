#!/usr/bin/env python3
"""
Packs the portrait's look frames into one spritesheet.

    python3 tools/pack-look-sheet.py

Reads frontend/art/portrait-frames/ and writes
frontend/public/portrait-look-spritesheet.png -- a single row, in the order the
code indexes them (see LOOK_DIRECTIONS and SHEET_FRAMES in
src/hooks/useLookDirection.ts). **That order is the contract**: reorder it here
and every glance points the wrong way.

The individual frames live outside public/ on purpose. In public/ they would be
copied into dist/ on every build and shipped alongside the sheet that replaced
them -- ten files nothing requests.

Run this after editing any frame, or after re-running slice-look-frames.py.
Nothing rebuilds it automatically.
"""
import sys
from pathlib import Path

from PIL import Image

# The sheet's frame order. Must match SHEET_FRAMES in useLookDirection.ts.
FRAMES = [
    "up-left", "up", "up-right",
    "left", "center", "right",
    "down-left", "down", "down-right",
    "center--blink",
]

ROOT = Path(__file__).resolve().parent.parent / "frontend"
SRC_DIR = ROOT / "art" / "portrait-frames"
OUT = ROOT / "public" / "portrait-look-spritesheet.png"


def main() -> int:
    images = []
    for name in FRAMES:
        path = SRC_DIR / f"portrait--look-{name}.png"
        if not path.exists():
            print(f"missing frame: {path}", file=sys.stderr)
            return 1
        images.append((name, Image.open(path).convert("RGB")))

    # Every frame has to be identical in size: the code offsets by a fraction of
    # the sheet's width, so one odd frame shifts every frame after it.
    sizes = {im.size for _, im in images}
    if len(sizes) != 1:
        for name, im in images:
            print(f"  {name}: {im.size}", file=sys.stderr)
        print(f"frames differ in size: {sizes}", file=sys.stderr)
        return 1

    w, h = sizes.pop()
    sheet = Image.new("RGB", (w * len(images), h), (255, 255, 255))
    for index, (_, im) in enumerate(images):
        sheet.paste(im, (index * w, 0))

    sheet.save(OUT, optimize=True)

    before = sum((SRC_DIR / f"portrait--look-{n}.png").stat().st_size for n in FRAMES)
    after = OUT.stat().st_size
    print(f"{len(images)} frames of {w}x{h} -> {OUT.name} ({sheet.width}x{sheet.height})")
    print(f"{before // 1024}K in {len(images)} requests -> {after // 1024}K in 1")
    for index, (name, _) in enumerate(images):
        print(f"  {index}  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Packs the portrait's look frames into one spritesheet.

    python3 tools/pack-look-sheet.py [downscale]

Reads frontend/art/portrait-frames/ and writes
frontend/public/portrait-look-spritesheet.png -- a single row, in the order the
code indexes them (see LOOK_DIRECTIONS and SHEET_FRAMES in
src/hooks/useLookDirection.ts). **That order is the contract**: reorder it here
and every glance points the wrong way.

The individual frames live outside public/ on purpose. In public/ they would be
copied into dist/ on every build and shipped alongside the sheet that replaced
them -- ten files nothing requests.

The sources are full resolution and the sheet ships at half (`downscale`,
default 2). The art is drawn in 2x2 pixel blocks, so halving costs no detail,
and keeping the sources at full size leaves something to re-cut from. Passing 1
gives a full-resolution sheet.

Run this after editing any frame, or after re-running slice-look-frames.py.
Nothing rebuilds it automatically.

NOTE: as of 2026-08-30 the frames here are a close ancestor of the shipped
sheet, not its exact source -- the sheet was updated from newer art that never
came back through this script. Re-packing reproduces the right size and frame
order but not the exact pixels. Drop the current full-resolution frames into
art/portrait-frames/ and re-run to make this exact again, and delete this note.
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


def main(downscale: int) -> int:
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

    if downscale > 1:
        # Box filter: with 2x2 blocks in the source it is an exact average of
        # four identical pixels, so nothing is invented at the edges.
        sheet = sheet.resize(
            (sheet.width // downscale, sheet.height // downscale), Image.BOX
        )

    sheet.save(OUT, optimize=True)

    before = sum((SRC_DIR / f"portrait--look-{n}.png").stat().st_size for n in FRAMES)
    after = OUT.stat().st_size
    print(f"{len(images)} frames of {w}x{h} -> {OUT.name} "
          f"({sheet.width}x{sheet.height}, downscale {downscale})")
    print(f"{before // 1024}K in {len(images)} requests -> {after // 1024}K in 1")
    for index, (name, _) in enumerate(images):
        print(f"  {index}  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 2))

#!/usr/bin/env python3
"""Small pixel-level guard for the reader's paper, sepia, and night palettes."""

import json
import sys
from pathlib import Path

from PIL import Image, ImageStat

if len(sys.argv) == 1:
    sys.argv.extend((
        "/tmp/lumbre-e2e/reader-light.png",
        "/tmp/lumbre-e2e/reader-sepia.png",
        "/tmp/lumbre-e2e/reader-dark.png",
    ))
if len(sys.argv) != 4:
    raise SystemExit("usage: python3 scripts/visual-test.py [LIGHT.png SEPIA.png DARK.png]")

expected = ("light", "sepia", "dark")
results = {}
for mode, filename in zip(expected, sys.argv[1:]):
    path = Path(filename)
    if not path.is_file():
        raise SystemExit(f"missing {mode} screenshot: {path}")
    image = Image.open(path).convert("RGB")
    if image.width < 480 or image.height < 800 or image.height <= image.width:
        raise SystemExit(f"{mode} screenshot is not a usable portrait phone capture: {image.size}")

    # Sample the central reading surface, excluding the toolbar and progress rail.
    center = image.crop((image.width // 3, image.height // 2, image.width * 2 // 3, image.height * 3 // 4))
    brightness = sum(ImageStat.Stat(center).mean) / 3
    results[mode] = {"size": list(image.size), "reading_surface_mean_rgb": round(brightness, 2)}

if not results["light"]["reading_surface_mean_rgb"] > results["sepia"]["reading_surface_mean_rgb"] > results["dark"]["reading_surface_mean_rgb"]:
    raise SystemExit(f"reader palettes are not ordered light > sepia > dark: {results}")
if results["light"]["reading_surface_mean_rgb"] < 175:
    raise SystemExit(f"paper theme is unexpectedly dark: {results}")
if results["sepia"]["reading_surface_mean_rgb"] < 110:
    raise SystemExit(f"sepia theme is unexpectedly dark: {results}")
if results["dark"]["reading_surface_mean_rgb"] > 100:
    raise SystemExit(f"night theme is unexpectedly bright: {results}")

print(json.dumps(results, ensure_ascii=False, indent=2))

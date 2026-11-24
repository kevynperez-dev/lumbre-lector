#!/usr/bin/env python3
"""Small pixel-level guard for the reader's paper, sepia, and night palettes."""

import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

if len(sys.argv) == 1:
    artifact_dir = Path(os.environ.get("LUMBRE_E2E_ARTIFACTS", "/tmp/lumbre-e2e"))
    sys.argv.extend((
        str(artifact_dir / "reader-light.png"),
        str(artifact_dir / "reader-sepia.png"),
        str(artifact_dir / "reader-dark.png"),
    ))
    settings_screenshot = artifact_dir / "settings-accent.png"
    if settings_screenshot.is_file():
        sys.argv.append(str(settings_screenshot))
    standard_size = artifact_dir / "settings-scale-standard.png"
    large_size = artifact_dir / "settings-scale-large.png"
    if standard_size.is_file() and large_size.is_file():
        sys.argv.extend((str(standard_size), str(large_size)))
if len(sys.argv) not in (4, 5, 7):
    raise SystemExit("usage: python3 scripts/visual-test.py [LIGHT.png SEPIA.png DARK.png [SETTINGS_ACCENT.png SETTINGS_STANDARD.png SETTINGS_LARGE.png]]")

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

    if mode == "dark":
        # The reader preference can differ from the app-wide NativeWind theme.
        # Its dark toolbar still needs the reader's light-green action labels.
        toolbar = image.crop((0, int(image.height * 0.11), image.width, int(image.height * 0.18)))
        contrast_ink = sum(
            1 for red, green, blue in toolbar.getdata()
            if green >= 135 and green > red * 1.15 and green > blue * 0.9
        )
        results[mode]["toolbar_contrast_pixels"] = contrast_ink
        if contrast_ink < 40:
            raise SystemExit(f"night reader toolbar labels are missing or too dim: {results}")

if not results["light"]["reading_surface_mean_rgb"] > results["sepia"]["reading_surface_mean_rgb"] > results["dark"]["reading_surface_mean_rgb"]:
    raise SystemExit(f"reader palettes are not ordered light > sepia > dark: {results}")
if results["light"]["reading_surface_mean_rgb"] < 175:
    raise SystemExit(f"paper theme is unexpectedly dark: {results}")
if results["sepia"]["reading_surface_mean_rgb"] < 110:
    raise SystemExit(f"sepia theme is unexpectedly dark: {results}")
if results["dark"]["reading_surface_mean_rgb"] > 100:
    raise SystemExit(f"night theme is unexpectedly bright: {results}")

if len(sys.argv) in (5, 7):
    path = Path(sys.argv[4])
    if not path.is_file():
        raise SystemExit(f"missing customized settings screenshot: {path}")
    image = Image.open(path).convert("RGB")
    blue_accent_pixels = sum(
        1 for red, green, blue in image.getdata()
        if blue > 145 and blue > red * 1.2 and blue > green * 0.98
    )
    results["settings_accent"] = {
        "size": list(image.size),
        "blue_accent_pixels": blue_accent_pixels,
    }
    if blue_accent_pixels < 300:
        raise SystemExit(f"selected blue accent is not visible in settings: {results}")

if len(sys.argv) == 7:
    standard = Image.open(sys.argv[5]).convert("RGB")
    large = Image.open(sys.argv[6]).convert("RGB")
    if standard.size != large.size:
        raise SystemExit(f"interface-size comparison screenshots differ in size: {standard.size} vs {large.size}")
    difference = ImageStat.Stat(ImageChops.difference(standard, large))
    mean_difference = round(sum(difference.mean) / 3, 3)
    results["interface_scale_mean_pixel_difference"] = mean_difference
    if mean_difference < 0.1:
        raise SystemExit(f"large interface setting produced no visible change: {results}")

print(json.dumps(results, ensure_ascii=False, indent=2))

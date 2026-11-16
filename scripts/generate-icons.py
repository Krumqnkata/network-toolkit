"""
Generates the Android launcher icon layers from the square logo artwork.

The artwork is a glowing logo on a dark background. The logo is separated from
the background by luminance (light glow over near-black), which gives a clean
transparent foreground for Android's adaptive icons; the background layer is a
separate gradient drawable (res/drawable/ic_launcher_background.xml).

Usage:  python scripts/generate-icons.py path/to/logo.png
Writes: android/app/src/main/res/drawable-*dpi/ic_launcher_{foreground,monochrome}.png
        docs/assets/icon.png (512 px, for the README)
Requires Pillow and NumPy.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RES = Path('android/app/src/main/res')
# Adaptive icons are 108 dp; the logo must fit the 66 dp safe zone.
DENSITIES = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
SAFE_ZONE = 66 / 108
BACKGROUND = np.array([0, 14, 26], dtype=np.float32)  # dark navy of the artwork
THRESHOLD = 40.0  # brightness at or below this counts as background


def extract(source: Image.Image) -> Image.Image:
    rgb = np.asarray(source.convert('RGB'), dtype=np.float32)
    brightness = rgb.max(axis=2)
    alpha = np.clip((brightness - THRESHOLD) / (255.0 - THRESHOLD), 0.0, 1.0) ** 0.85
    safe = np.maximum(alpha, 1e-3)[..., None]
    # Un-mix the background so semi-transparent glow keeps its colour.
    colour = np.clip((rgb - BACKGROUND * (1.0 - alpha[..., None])) / safe, 0, 255)
    rgba = np.dstack([colour, alpha * 255.0]).astype(np.uint8)
    rgba[alpha < 0.02] = 0
    return Image.fromarray(rgba, 'RGBA')


def fit(layer: Image.Image, size: int) -> Image.Image:
    box = layer.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox()
    logo = layer.crop(box)
    target = round(size * SAFE_ZONE)
    scale = target / max(logo.size)
    logo = logo.resize((max(1, round(logo.width * scale)), max(1, round(logo.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
    return canvas


def monochrome(layer: Image.Image) -> Image.Image:
    alpha = layer.getchannel('A')
    white = Image.new('RGBA', layer.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def main(path: str) -> None:
    source = Image.open(path)
    layer = extract(source)
    for density, size in DENSITIES.items():
        folder = RES / f'drawable-{density}'
        folder.mkdir(parents=True, exist_ok=True)
        foreground = fit(layer, size * 4).resize((size, size), Image.LANCZOS)
        foreground.save(folder / 'ic_launcher_foreground.png', optimize=True)
        monochrome(foreground).save(folder / 'ic_launcher_monochrome.png', optimize=True)

    # README/store icon: the artwork itself, with the black outside of its rounded corners made transparent.
    rgb = np.asarray(source.convert('RGB'), dtype=np.uint8)
    corner = (rgb.max(axis=2) <= 3).astype(np.uint8)
    rgba = np.dstack([rgb, (1 - corner) * 255]).astype(np.uint8)
    Path('docs/assets').mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, 'RGBA').resize((512, 512), Image.LANCZOS).save('docs/assets/icon.png', optimize=True)
    print('Icons written.')


if __name__ == '__main__':
    main(sys.argv[1])

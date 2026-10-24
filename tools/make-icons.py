"""Generates the app icons in app/icons. Run: python3 tools/make-icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "icons"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

BACKGROUND = (18, 18, 20)
TEXT = (236, 233, 228)
FOCUS = (255, 90, 78)
GUIDE = (88, 88, 96)


def draw_icon(size, padding=0.0):
    """The word «les» with a red focus letter between Spritz-style guides."""
    scale = 4
    s = size * scale
    image = Image.new("RGB", (s, s), BACKGROUND)
    draw = ImageDraw.Draw(image)
    inner = s * (1 - 2 * padding)
    font = ImageFont.truetype(FONT, int(inner * 0.36))

    parts = [("l", TEXT), ("e", FOCUS), ("s", TEXT)]
    widths = [draw.textlength(text, font=font) for text, _ in parts]
    total = sum(widths)
    ascent, descent = font.getmetrics()
    x = (s - total) / 2
    y = s / 2 - (ascent + descent) / 2 - inner * 0.02
    focus_center = x + widths[0] + widths[1] / 2
    for (text, colour), width in zip(parts, widths):
        draw.text((x, y), text, font=font, fill=colour)
        x += width

    line = max(2, int(inner * 0.012))
    top = s / 2 - inner * 0.25
    bottom = s / 2 + inner * 0.25
    left = s / 2 - inner * 0.34
    right = s / 2 + inner * 0.34
    tick = inner * 0.06
    for yy, direction in ((top, 1), (bottom, -1)):
        draw.line([(left, yy), (right, yy)], fill=GUIDE, width=line)
        draw.line([(focus_center, yy), (focus_center, yy + direction * tick)], fill=FOCUS, width=line * 2)

    return image.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(180).save(OUT / "apple-touch-icon.png")
    draw_icon(192).save(OUT / "icon-192.png")
    draw_icon(512).save(OUT / "icon-512.png")
    draw_icon(512, padding=0.1).save(OUT / "icon-maskable-512.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()

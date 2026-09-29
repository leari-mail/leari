# Generates the macOS installer (DMG) window background as a continuation of the app icon: the
# icon's own scene (sky, bird, branch) is drawn at exactly the place and size where Finder shows the
# icon, so the tile reads as a window into a larger scene. Outside the tile the sky goes on and the
# branch leaves the tile's corner, thickening into a bough that runs under the Applications folder.
#
# Window 660x400 pt; the app icon is centered at (180, 170) and Applications at (480, 170), as set
# in tauri.conf.json (bundle > macOS > dmg). Finder draws icons at 128 pt, and the icon's tile is the
# 824/1024 macOS grid inside that. Finder draws the labels in black over the background.
# Run: python3 assets/brand/gen_dmg_background.py, then rasterize (see CLAUDE.md, Brand).
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_icon as icon  # noqa: E402

W, H = 660, 400
APP = (180, 170)
ICON_PT = 128

# Photo space (the drawing's coordinates) -> window points, matching full_icon()'s transforms.
CROP_X, CROP_Y, CROP_SIZE = icon.CROP
TILE = ICON_PT * 0.8047                      # 824/1024 of the icon
TILE_X, TILE_Y = APP[0] - TILE / 2, APP[1] - TILE / 2
K = TILE / CROP_SIZE
SCENE = f"translate({TILE_X:.3f} {TILE_Y:.3f}) scale({K:.5f}) translate({-CROP_X} {-CROP_Y})"

# The icon's sky (radial, objectBoundingBox on the tile) in window space, padding outward.
SKY = (f'<radialGradient id="sky" gradientUnits="userSpaceOnUse" cx="{TILE_X + 0.72 * TILE:.2f}" '
       f'cy="{TILE_Y + 0.3 * TILE:.2f}" r="{0.9 * TILE:.2f}">'
       '<stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#dfe9fb"/>'
       '<stop offset="1" stop-color="#a9c2ee"/></radialGradient>'
       # far from the icon the sky keeps deepening a little, toward the bottom left
       f'<linearGradient id="deep" gradientUnits="userSpaceOnUse" x1="{W}" y1="0" x2="0" y2="{H}">'
       '<stop offset="0.35" stop-color="#8fabe8" stop-opacity="0"/>'
       '<stop offset="1" stop-color="#8fabe8" stop-opacity="0.55"/></linearGradient>')


def tapered(center, w0, w1):
    """Closed smooth shape along a centerline, width going from w0 to w1."""
    n = len(center)
    left, right = [], []
    for i, (x, y) in enumerate(center):
        a, b = center[max(i - 1, 0)], center[min(i + 1, n - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy) or 1
        nx, ny = -dy / length, dx / length
        w = (w0 + (w1 - w0) * (i / (n - 1)) ** 0.8) / 2
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    return icon.smooth(left + right[::-1], t=0.45)


# The bough, in photo space: it picks up the icon's branch at its lower end, keeps its line, then
# bends right and runs under the Applications folder and out of the window.
BOUGH = [(540, 600), (620, 720), (700, 850), (800, 990), (960, 1110), (1200, 1210), (1550, 1280),
         (1950, 1310), (2400, 1305), (2850, 1285), (3300, 1260)]
TWIGS = [  # (centerline, start width, end width)
    ([(1050, 1160), (1110, 1060), (1220, 990), (1330, 960)], 26, 8),
    ([(2150, 1310), (2240, 1200), (2380, 1130), (2520, 1105)], 30, 9),
    ([(1650, 1290), (1700, 1360), (1780, 1420)], 18, 6),
]


def scene():
    bough = tapered(BOUGH, 34, 130)
    twigs = "".join(f'<path fill="url(#branch)" d="{tapered(c, a, b)}"/>' for c, a, b in TWIGS)
    highlight = icon.smooth([(p[0] - 6, p[1] - 14) for p in BOUGH[1:]], closed=False)
    knots = ("M 900 1060 q 14 12 10 32 M 1480 1240 q 16 14 10 36 M 2600 1265 q 16 14 12 38")
    return f'''
  <rect width="{W}" height="{H}" fill="url(#sky)"/>
  <rect width="{W}" height="{H}" fill="url(#deep)"/>
  <g transform="{SCENE}">
    {icon.bird()}
    <path fill="url(#branch)" d="{bough}"/>
    {twigs}
    <path fill="none" stroke="#c2ad93" stroke-width="7" stroke-linecap="round" opacity="0.6" d="{highlight}"/>
    <path fill="none" stroke="#3e3229" stroke-width="7" stroke-linecap="round" opacity="0.55" d="{knots}"/>
  </g>
  <path d="M 262 168 C 300 150 360 150 398 168" fill="none" stroke="#ffffff" stroke-width="3"
    stroke-linecap="round" stroke-dasharray="1 7" opacity="0.9"/>
  <path d="M 390 158 L 401 169 L 386 173" fill="none" stroke="#ffffff" stroke-width="3"
    stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>'''


svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>{icon.DEFS}{SKY}</defs>{scene()}
</svg>
'''
open(os.path.join(HERE, "dmg-background.svg"), "w").write(svg)

# Generates the leari brand SVGs: a Lear's macaw (Anodorhynchus leari) perched on a branch,
# wings raised, traced from a reference photo. Coordinates are in that photo's 600x900 space.
# Run: python3 assets/brand/gen_icon.py
import os

HERE = os.path.dirname(os.path.abspath(__file__))

def smooth(pts, closed=True, t=0.5):
    """Catmull-Rom through pts -> cubic bezier path."""
    n = len(pts)
    P = lambda i: pts[i % n] if closed else pts[max(0, min(n - 1, i))]
    d = f"M {pts[0][0]:.1f} {pts[0][1]:.1f} "
    segs = n if closed else n - 1
    for i in range(segs):
        p0, p1, p2, p3 = P(i - 1), P(i), P(i + 1), P(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3)
        d += f"C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f} "
    return d + ("Z" if closed else "")

def lerp(a, b, k): return (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)

# ---- wing -------------------------------------------------------------
SHOULDER = (428, 222)
LEADING = [(410, 180), (372, 132), (318, 96), (250, 74), (180, 64), (118, 63)]
TIPS = [(74, 70), (80, 90), (91, 112), (108, 136), (132, 163), (162, 194), (198, 234), (232, 272), (266, 308), (300, 332)]
ROOT_A, ROOT_B = (250, 104), (372, 262)   # feather roots run along the hand/forearm
ROOTS = [lerp(ROOT_A, ROOT_B, i / (len(TIPS) - 1)) for i in range(len(TIPS))]

def wing_outline():
    pts = [SHOULDER] + LEADING
    for i, tip in enumerate(TIPS):
        pts.append(tip)
        if i + 1 < len(TIPS):
            mid_tip = lerp(tip, TIPS[i + 1], 0.5)
            mid_root = lerp(ROOTS[i], ROOTS[i + 1], 0.5)
            pts.append(lerp(mid_tip, mid_root, 0.16))
    pts += [(344, 326), (392, 296), (426, 262)]
    return pts

def wing_path():
    # sharp fingertips: build with lines at tips, curves elsewhere
    pts = wing_outline()
    return smooth(pts, t=0.35)

def feather_lines():
    out = []
    for i in range(len(TIPS) - 1):
        a = lerp(lerp(TIPS[i], TIPS[i + 1], 0.5), lerp(ROOTS[i], ROOTS[i + 1], 0.5), 0.16)
        b = lerp(ROOTS[i], ROOTS[i + 1], 0.5)
        out.append(f"M {a[0]:.1f} {a[1]:.1f} L {lerp(a, b, 0.75)[0]:.1f} {lerp(a, b, 0.75)[1]:.1f}")
    return " ".join(out)

def scallop(edge, bulge=0.35):
    """Open path segment along edge points, each span bulging to its left (feather tips)."""
    d = ""
    for a, b in zip(edge, edge[1:]):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        nx, ny = (a[1] - b[1]), (b[0] - a[0])       # left normal
        d += f"Q {mx + nx * bulge:.1f} {my + ny * bulge:.1f} {b[0]:.1f} {b[1]:.1f} "
    return d

def poly_with_scallop(head, edge, tail, bulge=0.35):
    """head (smooth-ish polyline) -> scalloped edge -> tail, closed."""
    d = f"M {head[0][0]:.1f} {head[0][1]:.1f} "
    for p in head[1:] + [edge[0]]:
        d += f"L {p[0]:.1f} {p[1]:.1f} "
    d += scallop(edge, bulge)
    for p in tail:
        d += f"L {p[0]:.1f} {p[1]:.1f} "
    return d + "Z"

# greater coverts (mid blue) and lesser coverts (light blue), edges run from the wrist down to the body
GREATER = poly_with_scallop([(428, 262), SHOULDER, (410, 180), (372, 132)],
                            [(336, 104), (322, 140), (320, 178), (328, 216), (342, 254), (362, 292), (388, 304)],
                            [(420, 280)], bulge=-0.32)
LESSER = poly_with_scallop([(430, 256), SHOULDER, (412, 184), (390, 150)],
                           [(376, 136), (362, 166), (360, 200), (366, 234), (380, 264), (404, 282)],
                           [(430, 270)], bulge=-0.32)
MARGIN = [SHOULDER, (410, 180), (372, 132), (330, 104), (340, 116), (380, 148), (404, 190), (420, 226)]
FAR_WING = [(404, 230), (416, 198), (446, 182), (478, 181), (496, 192), (472, 198), (440, 214)]

# ---- body (head, back, belly, tail) -----------------------------------
BODY = [
    (548, 226), (547, 208), (532, 196), (510, 189), (486, 188), (466, 192), (446, 206),   # crown, nape
    (420, 236), (396, 272), (366, 312), (334, 346),               # back under wing
    (262, 408), (180, 470), (100, 530), (34, 580),                # tail top edge
    (44, 590), (100, 574), (170, 543), (250, 500), (340, 446),    # tail bottom edge
    (386, 404), (408, 380),                                        # vent, belly
    (418, 346), (432, 314), (452, 292), (476, 280), (494, 282), (512, 270), (530, 240),    # chest, throat
]
TAIL_SPLIT = [(338, 352), (268, 416), (186, 478), (104, 538), (38, 584)]
TAIL_UNDER = TAIL_SPLIT + [(44, 590), (100, 574), (170, 543), (250, 500), (340, 446), (392, 408)]
TORSO = BODY[:11] + [(350, 372), (386, 404), (408, 380)] + BODY[22:]
HEAD = [(548, 226), (547, 208), (532, 196), (510, 189), (486, 188), (466, 192), (450, 204), (440, 224), (452, 252), (470, 272), (490, 280), (512, 270), (530, 240)]
TAIL_LINES = [[(330, 364), (250, 432), (160, 500), (70, 568)], [(340, 400), (250, 462), (150, 525)]]

UPPER_BEAK = [(514, 238), (528, 229), (542, 226), (550, 232), (553, 245), (550, 259), (541, 271), (528, 279), (512, 284), (518, 274), (521, 260), (519, 248)]
LOWER_BEAK = [(487, 252), (502, 248), (518, 250), (524, 262), (518, 277), (502, 282), (490, 273)]
PATCH = [(500, 228), (510, 230), (516, 237), (513, 248), (500, 252), (488, 253), (484, 243), (490, 232)]
EYE = (506, 212)

BRANCH = [(390, 366), (402, 358), (440, 410), (500, 500), (560, 590), (620, 680), (620, 740), (540, 612), (470, 506), (420, 432), (388, 386)]
BRANCH_STUB = [(390, 366), (402, 358), (440, 410), (482, 472), (478, 486), (464, 488), (420, 432), (388, 386)]
TWIG = [(468, 468), (500, 440), (540, 420), (546, 426), (506, 452), (478, 486)]
TOES = [
    [(394, 358), (404, 350), (414, 356), (416, 370), (410, 380), (406, 368), (400, 362)],
    [(406, 366), (418, 362), (428, 372), (426, 388), (418, 396), (418, 382), (412, 372)],
    [(390, 372), (398, 368), (402, 380), (396, 394), (386, 390)],
]

def path(pts, fill, t=0.45, extra=""):
    return f'<path fill="{fill}" {extra} d="{smooth(pts, t=t)}"/>'

def bird(stroke=1.0, branch=True):
    """The macaw. branch: True (full branch), "stub" (short, for the logo mark) or False."""
    if branch == "stub":
        return _bird(stroke, path(BRANCH_STUB, "url(#branch)", t=0.3))
    br = (path(BRANCH, "url(#branch)", t=0.3)
          + path(TWIG, "url(#branch)", t=0.3)
          + f'<path fill="none" stroke="#c2ad93" stroke-width="{3 * stroke}" stroke-linecap="round" opacity="0.7" d="M 408 380 C 440 424 490 500 560 606"/>'
          + f'<path fill="none" stroke="#3e3229" stroke-width="{2.5 * stroke}" stroke-linecap="round" opacity="0.6" d="M 452 470 q 8 6 6 16 M 510 548 q 8 8 4 18"/>') if branch else ""
    return _bird(stroke, br)

def _bird(stroke, br):
    tail_lines = " ".join(smooth(l, closed=False) for l in TAIL_LINES)
    return f"""
  {path(FAR_WING, "url(#far)")}
  {path(BODY, "url(#tail)")}
  {path(TAIL_UNDER, "url(#tailUnder)", t=0.4)}
  <path fill="none" stroke="#284aa8" stroke-width="{3 * stroke}" stroke-linecap="round" opacity="0.7" d="{tail_lines}"/>
  {path(TORSO, "url(#plume)")}
  {path(HEAD, "url(#head)")}
  {br}
  {''.join(path(t_, "url(#toe)", t=0.4) for t_ in TOES)}
  <path fill="url(#flight)" d="{wing_path()}"/>
  <path fill="none" stroke="#3b4478" stroke-width="{2.2 * stroke}" stroke-linecap="round" d="{feather_lines()}"/>
  <path fill="url(#covert)" d="{GREATER}"/>
  <path fill="url(#covert2)" d="{LESSER}"/>
  {path(MARGIN, "url(#margin)", t=0.3)}
  {path(PATCH, "#f6c436", t=0.5)}
  {path(LOWER_BEAK, "url(#lower)", t=0.3)}
  {path(UPPER_BEAK, "url(#beak)", t=0.5)}
  <circle cx="{EYE[0]}" cy="{EYE[1]}" r="8.5" fill="#f6c436"/>
  <circle cx="{EYE[0] + 1}" cy="{EYE[1]}" r="4.8" fill="#101116"/>
  <circle cx="{EYE[0] + 2.4}" cy="{EYE[1] - 1.6}" r="1.5" fill="#fff" opacity="0.85"/>"""

DEFS = '''
  <linearGradient id="plume" x1="0.9" y1="0.1" x2="0.2" y2="0.9">
    <stop offset="0" stop-color="#3f7fd8"/><stop offset="0.5" stop-color="#2f5cc9"/><stop offset="1" stop-color="#2140a6"/>
  </linearGradient>
  <linearGradient id="tail" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2f58c4"/><stop offset="1" stop-color="#1c3486"/>
  </linearGradient>
  <linearGradient id="tailUnder" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1b2150"/><stop offset="1" stop-color="#11142e"/>
  </linearGradient>
  <linearGradient id="flight" x1="1" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#27316a"/><stop offset="1" stop-color="#171a33"/>
  </linearGradient>
  <linearGradient id="covert" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3a6fd6"/><stop offset="1" stop-color="#2848ae"/>
  </linearGradient>
  <linearGradient id="covert2" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4f8ae4"/><stop offset="1" stop-color="#3563c8"/>
  </linearGradient>
  <linearGradient id="head" x1="0.8" y1="0" x2="0.2" y2="1">
    <stop offset="0" stop-color="#4c93de"/><stop offset="1" stop-color="#2f62c8"/>
  </linearGradient>
  <linearGradient id="far" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2848ae"/><stop offset="1" stop-color="#3a6fd6"/>
  </linearGradient>
  <linearGradient id="margin" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5a96ea"/><stop offset="1" stop-color="#4a82e0"/>
  </linearGradient>
  <linearGradient id="branch" x1="0" y1="0" x2="1" y2="0.3">
    <stop offset="0" stop-color="#9c8670"/><stop offset="0.6" stop-color="#6d5a48"/><stop offset="1" stop-color="#4a3c31"/>
  </linearGradient>
  <linearGradient id="toe" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b3a39a"/><stop offset="1" stop-color="#7e716b"/>
  </linearGradient>
  <linearGradient id="lower" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4a4c55"/><stop offset="1" stop-color="#1e1f25"/>
  </linearGradient>
  <linearGradient id="beak" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5a5d68"/><stop offset="0.5" stop-color="#2c2e36"/><stop offset="1" stop-color="#121318"/>
  </linearGradient>'''

# ---- compositions -------------------------------------------------------
CROP = (0, 20, 600)          # square of the drawing shown in the app icon tile: x, y, size
SKY = ('<radialGradient id="bg" cx="0.72" cy="0.3" r="0.9">'
       '<stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#dfe9fb"/><stop offset="1" stop-color="#a9c2ee"/></radialGradient>')

def full_icon():
    """App icon: the bird on a pale sky squircle, inside the macOS icon grid (824 px tile in 1024)."""
    x, y, size = CROP
    k = 1024 / size
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>{DEFS}{SKY}<clipPath id="squircle"><rect width="1024" height="1024" rx="228"/></clipPath></defs>
  <g transform="translate(100 100) scale(0.8047)">
    <g clip-path="url(#squircle)">
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <g transform="scale({k:.4f}) translate({-x} {-y})">{bird()}</g>
    </g>
  </g>
</svg>
'''

AVATAR_CROP = (-10, 25, 610)   # a little looser than the icon, so a circular crop keeps the head

def avatar():
    """Full-bleed square for the GitHub organization / repository profile picture."""
    x, y, size = AVATAR_CROP
    k = 1024 / size
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>{DEFS}{SKY}</defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g transform="scale({k:.4f}) translate({-x} {-y})">{bird()}</g>
</svg>
'''

# The logo mark has no tile behind it, so its darkest feathers are lifted to stay visible on the dark theme.
LOGO_DEFS = (DEFS
             .replace('stop-color="#27316a"/><stop offset="1" stop-color="#171a33"', 'stop-color="#3f52a8"/><stop offset="1" stop-color="#2c3a85"')
             .replace('stop-color="#1b2150"/><stop offset="1" stop-color="#11142e"', 'stop-color="#2f40a0"/><stop offset="1" stop-color="#26348a"'))

def logo_mark():
    """The bird alone (no background) on a short branch, for use inside the app."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="28 46 548 548">
  <defs>{LOGO_DEFS}</defs>{bird(branch="stub")}
</svg>
'''

def shrink(pts, base, k):
    return [(base[0] + (p[0] - base[0]) * k, base[1] + (p[1] - base[1]) * k) for p in pts]

def tray_icon(badge=False):
    """Menu bar / tray template image (black + alpha): bold silhouette with a shorter tail and a
    larger head so it reads at 22 px, eye knocked out. `badge` adds a dot shown while mail is syncing."""
    body = BODY[:9] + shrink(BODY[9:18], (360, 390), 0.62) + BODY[18:]
    head_t = "translate(470 236) scale(1.3) translate(-470 -236)"
    dot = '<circle cx="515" cy="505" r="58" fill="#000"/>' if badge else ""
    cut = '<circle cx="515" cy="505" r="84" fill="#000"/>' if badge else ""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 50 520 520">
  <defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="700" height="700"><rect x="0" y="0" width="700" height="700" fill="#fff"/>
    <g transform="{head_t}"><circle cx="{EYE[0]}" cy="{EYE[1]}" r="8" fill="#000"/>
    <path fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" d="M 518 244 C 524 254 523 268 514 281"/></g>{cut}</mask></defs>
  <g fill="#000" mask="url(#m)">
    <path d="{smooth(body, t=0.45)}"/>
    <path d="{smooth(FAR_WING, t=0.45)}"/>
    <path d="{wing_path()}"/>
    <g transform="{head_t}"><path d="{smooth(HEAD, t=0.45)}"/><path d="{smooth(UPPER_BEAK, t=0.5)}"/><path d="{smooth(LOWER_BEAK, t=0.3)}"/></g>
  </g>
  {dot}
</svg>
"""
open(os.path.join(HERE, "app-icon.svg"), "w").write(full_icon())
open(os.path.join(HERE, "..", "..", "src", "assets", "logo-mark.svg"), "w").write(logo_mark())
open(os.path.join(HERE, "avatar.svg"), "w").write(avatar())
open(os.path.join(HERE, "tray-icon.svg"), "w").write(tray_icon())
open(os.path.join(HERE, "tray-icon-sync.svg"), "w").write(tray_icon(badge=True))

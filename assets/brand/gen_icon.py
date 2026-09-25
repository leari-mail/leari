# Generates the leari brand SVGs: a Lear's macaw (Anodorhynchus leari) with open wings.
# Run: python3 assets/brand/gen_icon.py
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CX = 512

def wing(side):
    """Wing path; side=-1 left, +1 right. Leading edge sweeps up to the tip,
    trailing edge returns through scalloped flight feathers."""
    def x(v): return CX + side * (v - CX) if side == 1 else CX - (v - CX)
    shoulder = (455, 470)
    tip = (95, 215)
    trailing = [(95, 215), (150, 330), (215, 405), (285, 468), (355, 520), (425, 565), (470, 590)]
    d = f"M {x(shoulder[0])} {shoulder[1]} "
    d += f"C {x(400)} 380 {x(260)} 250 {x(tip[0])} {tip[1]} "
    for (ax, ay), (bx, by) in zip(trailing, trailing[1:]):
        mx, my = (ax + bx) / 2, (ay + by) / 2
        d += f"Q {x(mx - 32)} {my + 38} {x(bx)} {by} "
    return d + "Z"

def covert(side):
    """Inner (covert) feathers band, slightly different shade."""
    def x(v): return CX + (v - CX) if side == 1 else CX - (v - CX)
    return (f"M {x(460)} 480 C {x(410)} 420 {x(330)} 370 {x(250)} 330 "
            f"C {x(300)} 420 {x(380)} 500 {x(468)} 560 Z")

TAIL = f"M 478 620 C 470 720 490 820 512 930 C 534 820 554 720 546 620 Z"
BODY = "M 512 360 C 580 360 598 450 590 540 C 582 620 552 660 512 660 C 472 660 442 620 434 540 C 426 450 444 360 512 360 Z"
HEAD = "M 512 250 C 560 250 590 285 590 330 C 590 375 560 405 512 405 C 464 405 434 375 434 330 C 434 285 464 250 512 250 Z"
# beak seen from the front, hooked downward
BEAK_UP = "M 488 340 C 492 318 532 318 536 340 C 540 370 526 398 512 410 C 498 398 484 370 488 340 Z"
BEAK_LOW = "M 494 372 C 502 368 522 368 530 372 C 528 392 520 402 512 404 C 504 402 496 392 494 372 Z"

def full_icon():
    wings = "".join(f'<path fill="url(#wing)" d="{wing(s)}"/>' for s in (-1, 1))
    coverts = "".join(f'<path fill="#5e8fe6" opacity="0.55" d="{covert(s)}"/>' for s in (-1, 1))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#4a70e0"/>
      <stop offset="1" stop-color="#1b2a72"/>
    </linearGradient>
    <linearGradient id="wing" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b4d0ff"/>
      <stop offset="0.4" stop-color="#5a84ea"/>
      <stop offset="1" stop-color="#2d49b3"/>
    </linearGradient>
    <linearGradient id="plume" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5d8cea"/>
      <stop offset="1" stop-color="#2743a8"/>
    </linearGradient>
    <linearGradient id="tail" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3f68d8"/>
      <stop offset="1" stop-color="#6d98f0"/>
    </linearGradient>
    <clipPath id="squircle"><rect width="1024" height="1024" rx="228"/></clipPath>
  </defs>
  <g transform="translate(100 100) scale(0.8047)">
    <g clip-path="url(#squircle)">
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <g transform="translate(512 552) scale(0.86) translate(-512 -512)">
        {wings}
        {coverts}
        <path fill="url(#tail)" d="{TAIL}"/>
        <path fill="url(#plume)" d="{BODY}"/>
        <path fill="url(#plume)" d="{HEAD}"/>
        <circle cx="472" cy="318" r="17" fill="#f7cf3a"/>
        <circle cx="552" cy="318" r="17" fill="#f7cf3a"/>
        <circle cx="472" cy="318" r="8" fill="#111218"/>
        <circle cx="552" cy="318" r="8" fill="#111218"/>
        <path fill="#f7cf3a" d="M 478 372 C 490 360 534 360 546 372 C 544 400 528 416 512 418 C 496 416 480 400 478 372 Z"/>
        <path fill="#15161c" d="{BEAK_LOW}"/>
        <path fill="#23252e" d="{BEAK_UP}"/>
      </g>
    </g>
  </g>
</svg>
'''

def tray_icon(badge=False):
    """Menu bar / tray template image. `badge` adds a dot shown while mail is syncing."""
    wings = "".join(f'<path d="{wing(s)}"/>' for s in (-1, 1))
    dot = '<circle cx="840" cy="960" r="104" fill="#000"/>' if badge else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 210 864 864">
  <g fill="#000" transform="translate(0 40)">
    {wings}
    <path d="{TAIL}"/>
    <path d="{BODY}"/>
    <path d="{HEAD}"/>
  </g>
  {dot}
</svg>
'''

def logo_mark():
    """The bird alone (no background), for use inside the app."""
    svg = full_icon()
    svg = svg.replace('viewBox="0 0 1024 1024"', 'viewBox="120 200 784 784"')
    svg = svg.replace('<rect width="1024" height="1024" fill="url(#bg)"/>', "")
    svg = svg.replace('<g transform="translate(100 100) scale(0.8047)">', "<g>")
    svg = svg.replace('<g clip-path="url(#squircle)">', "<g>")
    return svg

open(os.path.join(HERE, "app-icon.svg"), "w").write(full_icon())
open(os.path.join(HERE, "..", "..", "src", "assets", "logo-mark.svg"), "w").write(logo_mark())
open(os.path.join(HERE, "tray-icon.svg"), "w").write(tray_icon())
open(os.path.join(HERE, "tray-icon-sync.svg"), "w").write(tray_icon(badge=True))

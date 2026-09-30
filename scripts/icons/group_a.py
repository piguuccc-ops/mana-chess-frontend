# Spell icons, group A: Mozgás (movement, teal accents) and Védelem (defence, steel + bronze).
import math
from lib import *


def curve(c, p0, p1, p2, ch, steps=60, shade=None, off=(1, 0)):
    """Quadratic Bézier stroke; optional darker second stroke offset by `off`."""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((round(x), round(y)))
    if shade:
        for x, y in pts:
            if c[min(13, max(0, y + off[1]))][min(13, max(0, x + off[0]))] == '.':
                put(c, x + off[0], y + off[1], shade)
    for x, y in pts:
        put(c, x, y, ch)
    return pts


def ellipse_ring(c, cx, cy, rx, ry, ch_light, ch_dark, thick=1.0):
    for y in range(14):
        for x in range(14):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if 1 - thick / max(rx, ry) <= d <= 1:
                light = (x + 0.5 - cx) + (y + 0.5 - cy) < 0
                c[y][x] = ch_light if light else ch_dark
    return c


def disc(c, cx, cy, r, ch):
    for y in range(14):
        for x in range(14):
            if math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r:
                c[y][x] = ch
    return c


ICONS = {}

# ── pawnRush: pawn under a double chevron, speed lines at its sides ──
c = canvas()
paste(c, 0, 0, grid("""
......JJ......
.....JJII.....
....JJ..II....
...JJ....II...
......JJ......
.....JJII.....
....JJ..II....
"""))
paste(c, 4, 6, PAWN)
paste(c, 0, 8, grid("""
.HJ.........JH
..............
HJ..........JH
"""))
ICONS['pawnRush'] = rows(c)

# ── knightLeap: knight head top-right, jump arc from the bottom-left ──
c = canvas()
paste(c, 7, 0, KNIGHT)
curve(c, (1, 13), (0, 4), (6, 5), 'J', shade='H', off=(1, 0))
paste(c, 5, 3, grid('''
.J.
JJJ
.J.
'''))
paste(c, 0, 12, grid('''
..65
.6554
'''))
ICONS['knightLeap'] = rows(c)

# ── bishopBlessing: bishop under a golden halo ──
c = canvas()
paste(c, 0, 0, grid("""
....opqqpo....
...p......n...
....onnnnm....
"""))
paste(c, 3, 3, grid("""
...99...
..9987..
..9807..
.99077..
.998877.
..9877..
..9887..
...87...
..9887..
.998877.
99888777
"""))
put(c, 1, 5, 'q'); put(c, 12, 6, 'q'); put(c, 0, 9, 'p'); put(c, 13, 10, 'p'); put(c, 12, 2, 'N')
ICONS['bishopBlessing'] = rows(c)

# ── rookCharge: rook charging left with speed lines and dust ──
c = canvas()
paste(c, 7, 3, grid('''
9.98.7.
9988777
.99877.
.98877.
.98877.
.98877.
9988777
9888777
'''))
paste(c, 0, 3, grid('''
.......
..HIJJ.
.......
HHIIJJ.
.......
.HIJJ..
.......
..HIJ..
'''))
paste(c, 0, 11, grid('''
.....6..66....
...66556......
.655444.......
'''))
ICONS['rookCharge'] = rows(c)

# ── queenGrace: crown granting the knight's L ──
c = canvas()
paste(c, 0, 0, grid('''
q..p..o
qp.p.on
qppqpon
pppppon
pAppyon
nnnnnnm
'''))
paste(c, 7, 6, KNIGHT)
paste(c, 1, 7, grid('''
J.....
J.....
JJJJ..
'''))
put(c, 11, 1, 'J'); put(c, 10, 2, 'I'); put(c, 12, 2, 'I'); put(c, 11, 3, 'H')
ICONS['queenGrace'] = rows(c)

# ── kingStride: the king's red boot striding out, crown above ──
c = canvas()
paste(c, 0, 0, grid("""
.q.p.o........
.qpqpn........
.ppppn........
.nnnnm........
.......iiih...
.......ippo...
.......ihhg...
.......ihhg...
.J.....ihhg...
..JJ...ihhhg..
.......ihhhhg.
.JJJ...iihhhhg
.......pooooon
..J...hhgggggg
"""))
ICONS['kingStride'] = rows(c)

# ── pawnShield: round bronze buckler with a pawn emblem ──
c = canvas()
disc(c, 7, 7, 6.9, 'n')
disc(c, 7, 7, 5.9, '4')
disc(c, 6.4, 6.4, 5.2, '5')
ellipse_ring(c, 7, 7, 6.9, 6.9, 'p', 'n', 1.2)
paste(c, 4, 3, PAWN)
put(c, 3, 2, 'q'); put(c, 2, 3, 'p')
ICONS['pawnShield'] = rows(c)

# ── knightShield: kite shield, steel field, bronze rim, knight emblem ──
c = canvas()
spans = [(1, 12), (1, 12), (1, 12), (1, 12), (1, 12), (1, 12), (1, 12), (2, 11), (2, 11), (3, 10), (3, 10), (4, 9), (5, 8), (6, 7)]
for y, (a, b) in enumerate(spans):
    for x in range(a, b + 1):
        edge = x in (a, b) or y == 0 or y == 13 or (y > 0 and not (spans[y - 1][0] <= x <= spans[y - 1][1])) or (y < 13 and not (spans[y + 1][0] <= x <= spans[y + 1][1]))
        if edge:
            c[y][x] = 'p' if (x < 7 and y < 9) or y == 0 else 'n'
        else:
            c[y][x] = 'e' if x < 5 else 'd' if x < 10 else 'c'
paste(c, 3, 2, KNIGHT)
ICONS['knightShield'] = rows(c)

# ── fortify: stone wall with a bolted iron plate ──
c = canvas()
paste(c, 0, 0, grid("""
.ee..ee..ee...
.ed..ed..ed...
.feeeeeeeeeed.
.eddcddddcdcc.
.bbbbbbbbbbbb.
.edpfffffeodc.
.ddfeeeeeddcb.
.bbfedddddcbb.
.edfedddddcdc.
.ddfeddddccca.
.bbpddcccccob.
.eddbbbbbbbdc.
.ddcbddcbdcca.
.aaaaaaaaaaaa.
"""))
ICONS['fortify'] = rows(c)

# ── forcedMarch: war drum with crossed sticks ──
c = canvas()
paste(c, 0, 0, grid('''
9............9
.6..........6.
..5........5..
...4......4...
...66666666...
..6988888875..
..5677777765..
..iipiiiipih..
..iiipiipiih..
..iiiippiiih..
..hiipiipihg..
..5666666665..
..4555555554..
...33333333...
'''))
ICONS['forcedMarch'] = rows(c)

# ── teleport: swirling portal ──
c = canvas()
ellipse_ring(c, 7, 7, 6.8, 6.2, 'J', 'H', 1.6)
ellipse_ring(c, 7, 7, 4.6, 4.2, 'F', 'D', 1.4)
ellipse_ring(c, 7, 7, 2.6, 2.4, 'B', 'E', 1.3)
disc(c, 7, 7, 1.2, 'N')
for x, y in [(2, 3), (11, 10), (3, 11), (10, 2)]:
    c[y][x] = '.'
for x, y, ch in [(1, 1, 'J'), (12, 12, 'J'), (12, 1, 'B')]:
    put(c, x, y, ch)
ICONS['teleport'] = rows(c)

# ── emergencySwap: rook and king trade places (red alarm arrows) ──
c = canvas()
paste(c, 0, 0, grid("""
....jjjjjj....
..jj......j...
.j.........jj.
..........jjj.
...........j..
9.9.7...q.p.o.
99877...qpqpo.
.987....ppppn.
.987....pipin.
99877...nnnnm.
..i...........
.iii..........
.ii.........i.
...ii......i..
.....iiiiii...
"""))
ICONS['emergencySwap'] = rows(c)

# ── doubleMove: two forward chevrons ──
c = canvas()
paste(c, 0, 2, grid('''
.JJ....JJ.....
.JJJ...JJJ....
..JJJ...JJJ...
...JJJ...JJJ..
....JJI...JJI.
....HII...HII.
...HII...HII..
..HII...HII...
.HII...HII....
.HH....HH.....
'''))
ICONS['doubleMove'] = rows(c)

# ── royalGuard: golden fleur-de-lis ──
c = canvas()
paste(c, 0, 0, grid('''
......qp......
.....qppo.....
.....qppo.....
.op..qppo..on.
pqpo.qppo.onnn
pp...qppo...nn
pqp.pqppoo.onn
.pppppppooooo.
..nnnnnnnnnnm.
.....qppo.....
....qp..on....
...qp....on...
...p......n...
..............
'''))
put(c, 6, 3, 'N')
ICONS['royalGuard'] = rows(c)

# ── checkBreaker: a chain snapping apart ──
c = canvas()
paste(c, 0, 0, grid("""
........eeed..
.......eeddcc.
.......ed..cc.
.......ed..cb.
....q...c..cb.
...qNq....cbb.
....q..q..ba..
.eeed.qNq.....
eeddc..q......
ed..c.........
ed..cb........
dc..cb........
dcccbb........
.cbba.........
"""))
ICONS['checkBreaker'] = rows(c)

# ── mirror: gilded hand mirror with silver glass ──
c = canvas()
paste(c, 0, 0, grid("""
....qppppo....
...pfffeeeo...
..pfNfeeeddn..
..pfNfeeddcn..
..pffNeedddn..
..peefNeddcn..
..peedNdddcn..
..peeddNdccn..
...oeddddcn...
....onnnnm....
......pn......
.....pqon.....
......pn......
......nm......
"""))
ICONS['mirror'] = rows(c)

# ── lastChance: white dove with a holy glint ──
c = canvas()
paste(c, 0, 0, grid('''
..q...........
.9.......9....
.99.....99....
.998...998....
..998.9987....
..99989987....
...9999987.99.
...999999999po
..8999999987..
.87.8888877...
.7...7777.....
..........q...
.........qNq..
..........q...
'''))
ICONS['lastChance'] = rows(c)

# ── outOfWay: step aside and come back (return arrow over a pawn) ──
c = canvas()
curve(c, (4, 4), (9, -3), (11, 5), 'J', shade='H', off=(0, 1))
paste(c, 9, 5, grid("""
JJJJ
.JJ.
"""))
paste(c, 1, 5, PAWN)
paste(c, 7, 11, grid("""
.I.....
IIIIIII
.I.....
"""))
ICONS['outOfWay'] = rows(c)

# ── quickCastle: rook and crown with a quick two-way sweep ──
c = canvas()
paste(c, 0, 0, grid('''
9.98.7........
9988777.......
.99877........
.98877...q.p.o
.98877...qpqpo
.98877...ppppn
9988777..nnnnm
9888777.......
..............
..J........J..
.JJJJJJJJJJJJ.
JJIIIIIIIIIIJJ
.HH........HH.
..H........H..
'''))
ICONS['quickCastle'] = rows(c)

# ── pawnVault: a pawn leaping over a stone block ──
c = canvas()
curve(c, (1, 10), (5, -3), (10, 7), 'J', shade='H', off=(0, 1))
paste(c, 4, 9, grid('''
eeeed
dddcb
dcccb
bbbba
'''))
paste(c, 9, 7, grid('''
.98.
9987
.87.
.87.
9876
98776
'''))
ICONS['pawnVault'] = rows(c)

# ── invisibility: a hooded shape fading into dithered air ──
c = canvas()
paste(c, 0, 0, grid('''
.....ffee.....
....ffeeed....
...ffe0000d...
...fe0B00Bd...
...fe0000dd...
..ffe0000ddc..
..fee.00.ddc..
..fe.e..d.dc..
.fe.e.e.d.d.c.
.f.e...e..d.c.
.e.........d..
f..e..e..d...c
..............
..e....d...c..
'''))
ICONS['invisibility'] = rows(c)

# ── scout: a pawn that may also step sideways ──
c = canvas()
paste(c, 4, 3, PAWN)
paste(c, 0, 6, grid("""
.J..........J.
JJ..........JJ
JJJJ......JJJJ
HH..........HH
.H..........H.
"""))
paste(c, 0, 12, grid("""
..6655555544..
"""))
ICONS['scout'] = rows(c)

HEADER = '''// Spell icons, group A – Mozgás (movement) and Védelem (defence).
// 14×14 art + automatic outline = 16×16. Generated by scripts/icons/group_a.py.'''
write_ts('/home/claude/mana-chess/src/ui/pixel/art/spells_a.ts', 'SPELL_ICONS_A', ICONS, HEADER)

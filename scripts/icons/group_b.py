# Spell icons, group B: Irányítás (control, curses) and Taktika (tactics, forest green accents).
import math
from lib import *


def recolor(rows_, mapping):
    return [''.join(mapping.get(ch, ch) for ch in r) for r in rows_]


def disc(c, cx, cy, r, ch):
    for y in range(14):
        for x in range(14):
            if math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r:
                c[y][x] = ch


ICONS = {}

# ── swap: bishop and knight trade places ──
c = canvas()
paste(c, 0, 0, grid('''
...uuuuuuu....
..u.......u...
.u.........uu.
..........uuu.
...........u..
'''))
paste(c, 0, 4, BISHOP)
paste(c, 7, 4, KNIGHT)
paste(c, 0, 11, grid('''
.t............
ttt...........
.t.tttttttt...
'''))
ICONS['swap'] = rows(c)

# ── instantPromotion: pawn rises to a crown ──
c = canvas()
paste(c, 7, 0, grid('''
q.p.o.
qpqpon
pppppn
pAppyn
nnnnnm
'''))
paste(c, 0, 6, PAWN)
paste(c, 6, 5, grid('''
..qp.
.qpp.
qppo.
.po..
po...
o....
'''))
put(c, 12, 7, 'q'); put(c, 13, 8, 'p'); put(c, 1, 3, 'q')
ICONS['instantPromotion'] = rows(c)

# ── recastle: a golden key over a rook ──
c = canvas()
paste(c, 0, 1, ROOK)
paste(c, 0, 0, grid('''
..........pqp.
.........po.op
.........p...o
.........op.on
..........onn.
.........pn...
........pn....
.......pn.....
......pn......
.....pnpn.....
....pn..n.....
...pnpn.......
....n.........
..............
'''))
ICONS['recastle'] = rows(c)

# ── weaken: a wilting rose ──
c = canvas()
paste(c, 0, 0, grid('''
..............
.....ttt......
....t...tt....
....t.....t...
....t......t..
....t.....LLL.
...ut....LMLLK
..ust....LLLKK
....t....KLLK.
....t.....KK..
.L..t....K.K..
.KL.t.........
..K.t.........
...sts........
'''))
ICONS['weaken'] = rows(c)

# ── root: roots curling up out of the ground ──
c = canvas()
paste(c, 0, 0, grid('''
..............
..u......u....
.uts....ust...
..4......4....
..45....54..u.
...4...54..ut.
...45..4...4..
....4.54..54..
....4454.54...
.....4454.....
.....5444.....
...33544433...
.33444544443..
3344444444433.
'''))
ICONS['root'] = rows(c)

# ── blindSpot: an eye under a dark blindfold ──
c = canvas()
paste(c, 0, 0, grid('''
..............
..............
..............
....222222....
..2299988822..
.29999yzy8882.
DE99yzNzyx887C
CDDEyzwwyx87DC
.CCDDEyyx8DDC.
..33CCDDDDC3..
....333CCCD...
...........DC.
............C.
..............
'''))
ICONS['blindSpot'] = rows(c)

# ── silence: lips sewn shut with coarse thread ──
c = canvas()
paste(c, 0, 0, grid("""
..............
..............
..............
....6..6..6...
...L6L.6L.6L..
..LM6LL6LL6K..
.LLL5LL5LL5KK.
.hKK4KK4KK4Kh.
..LL5LL5LL5K..
...K6LLL6L6...
....6KK.6K6...
....5...5..5..
..............
..............
"""))
put(c, 1, 2, 'F'); put(c, 12, 11, 'E'); put(c, 12, 2, 'D')
ICONS['silence'] = rows(c)

# ── disarm: a sword snapped in two ──
c = canvas()
paste(c, 0, 0, grid('''
.............f
............fd
...........fec
..........fec.
.........fec..
..............
......q.q.....
.......N......
.....fq.q.....
....fec.......
..pofec.......
...pon........
..54.nm.......
.53...........
'''))
ICONS['disarm'] = rows(c)

# ── pawnFreeze: a pawn locked in ice ──
c = canvas()
paste(c, 0, 0, grid('''
..BBBBBBBBBA..
.BBAAAAAAAAzA.
.BAAAAAAAAAzz.
.BAAAAAAAAAzz.
.BAAAAAAAAAzz.
.BAAAAAAAAAzz.
.BAAAAAAAAAzz.
.BAAAAAAAAAzz.
.BAAAAAAAAAzz.
.BAAAAAAAAAzz.
.AAAAAAAAAAzy.
.zzzzzzzzzzyy.
..z..y..z..y..
..............
'''))
paste(c, 4, 2, recolor(PAWN, {'9': 'z', '8': 'y', '7': 'x', '6': 'x'}))
put(c, 2, 2, 'N'); put(c, 3, 3, 'B'); put(c, 2, 4, 'B')
ICONS['pawnFreeze'] = rows(c)

# ── chaos: two paths shuffled across each other ──
c = canvas()
paste(c, 0, 0, grid('''
..........j...
..........jj..
jjjj....jjjjj.
...jj..jj.jj..
....jjjj..j...
.....jj.......
....IIII..I...
...II..II.II..
IIII....IIIII.
..........II..
..........I...
.q.....F......
qNq...FNF..p..
.q.....F......
'''))
ICONS['chaos'] = rows(c)

# ── necromancy: a skeletal hand rising from the grave ──
c = canvas()
paste(c, 0, 0, grid('''
..............
....8..8......
..8.9..9.8....
..9.8..8.9....
..8.9..9.8..v.
..9.8..8.9..u.
..98999989....
...899998...v.
....9998......
.u..898.......
.v..989...u...
..34443333....
.3455443333...
334454443333..
'''))
ICONS['necromancy'] = rows(c)

# ── realityBreak: a violet orb cracking apart ──
c = canvas()
disc(c, 6.5, 7.5, 5.8, 'E')
disc(c, 6.0, 7.0, 4.6, 'E')
paste(c, 0, 0, grid('''
..........F...
...........F..
....FFFE...EF.
...FF.EEED....
..FFEEEEEDD...
..FEEEEEEEDD..
.FEEEEEEEEED..
.FEEEEEEEEEDC.
.EEEEEEEEEDDC.
.EEEEEEEEEDDC.
..EEEEEEEDDC..
..DEEEEDDDCC..
...DDDDDDCC...
....CCCCCC....
'''))
paste(c, 0, 0, grid('''
..............
..............
..............
......N.......
..N...N.......
...N..NN......
....NN..N.....
......N..NN...
.....N.....N..
.....N........
....N.........
...N..........
..............
..............
'''))
put(c, 3, 3, 'N'); put(c, 4, 4, 'F')
ICONS['realityBreak'] = rows(c)

# ── brigade: a squad of summoned bondsmen ──
c = canvas()
paste(c, 0, 0, grid('''
..............
..dc......dc..
.edcb....edcb.
.8776....8776.
..76......76..
.8776....8776.
877665..877665
..............
'''))
paste(c, 4, 5, grid('''
..fed.
.fedcb
.9887.
..87..
.9876.
..87..
988776
'''))
paste(c, 0, 12, grid('''
.555544445555.
..3333333333..
'''))
ICONS['brigade'] = rows(c)

# ── clone: a piece and its translucent double ──
c = canvas()
paste(c, 0, 5, PAWN)
ghost = recolor(PAWN, {'9': 'J', '8': 'I', '7': 'H', '6': 'H'})
ghost = [''.join(ch if (x + y) % 2 == 0 or ch == '.' else ('J' if ch in 'J' else '.') for x, ch in enumerate(r)) for y, r in enumerate(ghost)]
paste(c, 8, 5, ghost)
paste(c, 0, 0, grid('''
..............
......J.......
.....JJJ...q..
......J...qNq.
...........q..
'''))
paste(c, 6, 7, grid('''
.J
JJ
.J
'''))
ICONS['clone'] = rows(c)

# ── frenchCheese: a wedge of cheese ──
c = canvas()
paste(c, 0, 0, grid('''
..............
..............
...........l..
.........llql.
.......llqqlp.
.....llqqnqpp.
...llqqqqlpop.
.llqqnqqqlppo.
lllllllllppoo.
pppnppppppooo.
ppnnpppnpppoo.
pppnpppppnpon.
ooooooooooonn.
..............
'''))
ICONS['frenchCheese'] = rows(c)

# ── provoke: a war horn sounding a challenge ──
c = canvas()
paste(c, 0, 0, grid("""
.........ppo..
.i..j...pqqqo.
..i..j..pqmmmn
...i.j..pqmmmn
...i.j..pmmmmn
..i..j...onnm.
.i..j...pon...
.......pon....
......pon.....
.....pon......
....pon.......
...pn.........
..6n..........
.65...........
"""))
ICONS['provoke'] = rows(c)

# ── magnet: a horseshoe magnet pulling ──
c = canvas()
paste(c, 0, 0, grid('''
..............
....iiiiii....
..ijjjiiiihh..
.ijiiii.iiihh.
.iji......ihh.
.ii........hh.
.ii........hg.
.ff........ed.
.fe........ed.
..............
.J.J......J.J.
..J........J..
.J.J......J.J.
..............
'''))
ICONS['magnet'] = rows(c)

# ── repulse: a gust that throws back ──
c = canvas()
paste(c, 0, 0, grid('''
..............
......fffe....
....ff....e...
...f..fee..d..
.......ffe.d..
..fff.....d...
.f...ffffe....
..........e...
...fffffe..d..
.........e.d..
...ff...ed....
..f..fee......
..............
..............
'''))
paste(c, 10, 5, grid('''
.9..
.99.
9999
.99.
.9..
'''))
ICONS['repulse'] = rows(c)

# ── retrain: knight and bishop turn into each other ──
c = canvas()
paste(c, 8, 0, BISHOP)
paste(c, 0, 6, KNIGHT)
paste(c, 0, 0, grid('''
..uuuu........
.u............
.u............
uuu...........
.u............
'''))
paste(c, 9, 8, grid('''
....t
....t
...ttt
....t
tttt.
'''))
ICONS['retrain'] = rows(c)

# ── storm: a thundercloud with rain ──
c = canvas()
paste(c, 0, 0, grid('''
..............
.....ddd......
...ddeeed.dd..
..deeeeeeddeed
.deeeddddddddc
cddddcccccccccb
.bbbbqbbbbbbb.
.....qp.......
..A.qp....A...
...qpppp.A..A.
.A....pp......
.....pp...A...
....p..A...A..
..A...........
'''))
ICONS['storm'] = rows(c)

# ── glassCurse: a glass pawn with a cursed (violet) crack, first shards flying off ──
c = canvas()
paste(c, 0, 0, grid('''
......9.......
....99ADx.....
....BBDzx.....
....BBDzx.....
.....BAD...B..
.....BDx......
....9BDzx.....
.....9AD......
.....BAD....A.
....9BDzx.....
...9BADzzx....
..9BBDAAzzx...
..BBBDAAzzx...
..............
'''))
ICONS['glassCurse'] = rows(c)

HEADER = '''// Spell icons, group B – Irányítás (control) and Taktika (tactics).
// 14×14 art + automatic outline = 16×16. Generated by scripts/icons/group_b.py.'''
write_ts('/home/claude/mana-chess/src/ui/pixel/art/spells_b.ts', 'SPELL_ICONS_B', ICONS, HEADER)

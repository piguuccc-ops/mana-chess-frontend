#!/usr/bin/env python3
"""Builds the game's pixel fonts from the hand-drawn bitmaps.

Outputs
  src/ui/styles/fonts.generated.css  – @font-face rules with embedded WOFF data
  src/ui/pixel/fontData.json          – the raw bitmaps (used by the canvas logo renderer)
Run:  python3 scripts/fonts/build_fonts.py   (needs fontTools)
"""
import base64, io, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
import glyphs_pixel as PX
import glyphs_gothic as GO

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
UNIT = 100  # font units per pixel


def compose(mod):
    """Glyph table including composed accented letters: char -> (top, rows)."""
    out = dict(mod.G)
    for ch, (base, accent) in mod.ACCENTED.items():
        top, rows = mod.G[base]
        w = max(len(r) for r in rows)
        acc = accent(w)
        aw = max(len(r) for r in acc)
        width = max(w, aw)
        gap = 1
        new_top = top + gap + len(acc)
        pad = lambda r: r.ljust(width, '.')
        out[ch] = (new_top, [pad(r) for r in acc] + ['.' * width] * gap + [pad(r) for r in rows])
    # dotless i + acute (í / Í handled above for Í)
    if 'i' in mod.G:
        top, rows = mod.G['i']
        stem_rows = [r for r in rows]
        # remove dot: keep rows from x-height down (rows below the gap)
        x_top = 5 if mod is PX else 6
        keep = rows[top - x_top:]
        w = max(len(r) for r in keep)
        if mod is PX:
            acc = ['.#', '#.']
        else:
            acc = ['.##', '##.']
        width = max(w, max(len(a) for a in acc))
        out['í'] = (x_top + 1 + len(acc), [a.ljust(width, '.') for a in acc] + ['.' * width] + [r.ljust(width, '.') for r in keep])
    return out


def pixels(top, rows):
    s = set()
    for i, r in enumerate(rows):
        y = top - i
        for x, c in enumerate(r):
            if c == '#':
                s.add((x, y))
    return s


def trace(px):
    """Pixel set -> list of closed contours (clockwise outer, counter-clockwise holes; y up)."""
    edges = {}
    def add(a, b):
        if (b, a) in edges:
            del edges[(b, a)]
        else:
            edges[(a, b)] = True
    for (x, y) in px:
        add((x, y), (x, y + 1))
        add((x, y + 1), (x + 1, y + 1))
        add((x + 1, y + 1), (x + 1, y))
        add((x + 1, y), (x, y))
    out_by_start = {}
    for (a, b) in edges:
        out_by_start.setdefault(a, []).append(b)
    used = set()
    loops = []
    for (a0, b0) in list(edges):
        if (a0, b0) in used:
            continue
        loop = [a0]
        a, b = a0, b0
        used.add((a, b))
        while True:
            loop.append(b)
            d = (b[0] - a[0], b[1] - a[1])
            cands = [c for c in out_by_start.get(b, []) if (b, c) not in used]
            if not cands:
                break
            def rank(c):
                nd = (c[0] - b[0], c[1] - b[1])
                right = (d[1], -d[0])
                left = (-d[1], d[0])
                if nd == right: return 0
                if nd == d: return 1
                if nd == left: return 2
                return 3
            c = sorted(cands, key=rank)[0]
            used.add((b, c))
            a, b = b, c
            if b == a0:
                break
        # simplify collinear points
        pts = loop[:-1] if loop[-1] == loop[0] else loop
        simp = []
        n = len(pts)
        for i in range(n):
            p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
            if (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]) != 0:
                simp.append(p1)
        loops.append(simp)
    return loops


def bold(top, rows):
    w = max(len(r) for r in rows)
    out = []
    for r in rows:
        r = r.ljust(w, '.')
        nr = ''.join('#' if (r[x] == '#' if x < w else False) or (x > 0 and r[x - 1] == '#') else '.' for x in range(w + 1))
        out.append(nr)
    return top, out


def build(family, style, weight, table, space_adv, ascent_px, descent_px, make_bold=False):
    upm = (ascent_px + descent_px) * UNIT
    fb = FontBuilder(unitsPerEm=upm, isTTF=True)
    names = ['.notdef', 'space']
    cmap = {32: 'space', 160: 'space'}
    glyphs = {}
    metrics = {}
    pen = TTGlyphPen(None)
    # .notdef: hollow box
    for c in [[(0, 0), (0, 7 * UNIT), (5 * UNIT, 7 * UNIT), (5 * UNIT, 0)], [(UNIT, UNIT), (4 * UNIT, UNIT), (4 * UNIT, 6 * UNIT), (UNIT, 6 * UNIT)]]:
        pen.moveTo(c[0])
        for p in c[1:]:
            pen.lineTo(p)
        pen.closePath()
    glyphs['.notdef'] = pen.glyph()
    metrics['.notdef'] = (6 * UNIT, 0)
    glyphs['space'] = TTGlyphPen(None).glyph()
    metrics['space'] = ((space_adv + (1 if make_bold else 0)) * UNIT, 0)
    for ch in sorted(table):
        top, rows = table[ch]
        if make_bold:
            top, rows = bold(top, rows)
        name = 'uni%04X' % ord(ch)
        names.append(name)
        cmap[ord(ch)] = name
        px = pixels(top, rows)
        pen = TTGlyphPen(None)
        for loop in trace(px):
            pen.moveTo((loop[0][0] * UNIT, loop[0][1] * UNIT))
            for p in loop[1:]:
                pen.lineTo((p[0] * UNIT, p[1] * UNIT))
            pen.closePath()
        glyphs[name] = pen.glyph()
        w = max(len(r) for r in rows)
        xmin = min((x for x, _ in px), default=0)
        metrics[name] = ((w + 1) * UNIT, xmin * UNIT)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ascent_px * UNIT, descent=-descent_px * UNIT)
    fb.setupNameTable({'familyName': family, 'styleName': style, 'uniqueFontIdentifier': f'{family} {style} 1.0',
                       'fullName': f'{family} {style}', 'psName': f'{family.replace(" ", "")}-{style}', 'version': 'Version 1.0'})
    fb.setupOS2(sTypoAscender=ascent_px * UNIT, sTypoDescender=-descent_px * UNIT, sTypoLineGap=0,
                usWinAscent=ascent_px * UNIT, usWinDescent=descent_px * UNIT, fsType=0, usWeightClass=weight,
                sxHeight=(6 if 'Pixel' in family else 7) * UNIT, sCapHeight=(8 if 'Pixel' in family else 10) * UNIT)
    fb.setupPost()
    fb.font.flavor = 'woff'
    buf = io.BytesIO()
    fb.font.save(buf)
    return buf.getvalue()


def main():
    px = compose(PX)
    go = compose(GO)
    faces = [
        ('Mana Pixel', 'Regular', 400, px, PX.SPACE_ADVANCE, 11, 3, False),
        ('Mana Pixel', 'Bold', 700, px, PX.SPACE_ADVANCE, 11, 3, True),
        ('Mana Gothic', 'Regular', 400, go, GO.SPACE_ADVANCE, 13, 3, False),
    ]
    css = ['/* GENERATED by scripts/fonts/build_fonts.py – hand-drawn pixel fonts of Mana Chess. Do not edit. */']
    for family, style, weight, table, sp, asc, desc, b in faces:
        data = build(family, style, weight, table, sp, asc, desc, b)
        b64 = base64.b64encode(data).decode()
        css.append(f"@font-face {{ font-family: '{family}'; src: url(data:font/woff;base64,{b64}) format('woff'); "
                   f"font-weight: {weight}; font-style: normal; font-display: block; }}")
        print(f'{family} {style}: {len(data)} bytes, {len(table)} glyphs')
    with open(os.path.join(ROOT, 'src/ui/styles/fonts.generated.css'), 'w') as f:
        f.write('\n'.join(css) + '\n')
    data = {
        'pixel': {ch: {'top': t, 'rows': r} for ch, (t, r) in px.items()},
        'gothic': {ch: {'top': t, 'rows': r} for ch, (t, r) in go.items()},
        'space': {'pixel': PX.SPACE_ADVANCE, 'gothic': GO.SPACE_ADVANCE},
    }
    with open(os.path.join(ROOT, 'src/ui/pixel/fontData.json'), 'w') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()

"""Tiny helpers for hand-drawn 14×14 spell icons (palette keys from src/ui/pixel/palette.ts).

Icons are authored as rows of palette characters ('.' = transparent). Helpers let an
icon paste reusable mini-sprites (pieces, crowns) and draw clean arcs/rings; the
TypeScript writer validates every sprite before it is written.
"""

W = H = 14


def canvas():
    return [['.'] * W for _ in range(H)]


def paste(c, x, y, rows, skip='.'):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == skip:
                continue
            X, Y = x + dx, y + dy
            if 0 <= X < W and 0 <= Y < H:
                c[Y][X] = ch
    return c


def put(c, x, y, ch):
    if 0 <= x < W and 0 <= y < H:
        c[y][x] = ch


def line(c, x0, y0, x1, y1, ch):
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        put(c, x0, y0, ch)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return c


def rows(c):
    return [''.join(r) for r in c]


def grid(text):
    """Multi-line string → list of rows (strips a leading newline and indentation)."""
    lines = [l.strip() for l in text.strip('\n').split('\n')]
    return [l for l in lines if l]


# ── reusable mini sprites (ivory = own piece; shading 9 → 8 → 7 → 6) ──
PAWN = grid('''
..98..
.9987.
.9887.
..87..
.9876.
..87..
.9877.
988776
''')

PAWN_SMALL = grid('''
.98.
9987
.87.
.87.
9876
''')

KNIGHT = grid('''
...9.9.
..99887
.998887
9908887
9988887
.77.887
...9887
..98877
''')

ROOK = grid('''
9.98.7
998877
.9887.
.9887.
.9887.
.9887.
998877
988777
''')

BISHOP = grid('''
..9...
.998..
.9807.
.9887.
..87..
.9887.
988777
''')

CROWN = grid('''
q..p..o
qp.p.on
qppqpon
pppppon
nnnnnnm
''')


def write_ts(path, export, icons, header):
    out = [header, "import type { SpriteSrc } from '../sprite';", '',
           "const icon = (rows: string[]): SpriteSrc => ({ rows, outline: '0' });", '',
           f'export const {export}: Record<string, SpriteSrc> = {{']
    for name, rs in icons.items():
        assert len(rs) == 14, f'{name}: {len(rs)} rows'
        for i, r in enumerate(rs):
            assert len(r) == 14, f'{name} row {i}: {len(r)} chars {r!r}'
        out.append(f'  {name}: icon([')
        for r in rs:
            out.append(f"    '{r}',")
        out.append('  ]),')
    out.append('};')
    open(path, 'w').write('\n'.join(out) + '\n')
    print('wrote', path, len(icons), 'icons')

import { memo, useMemo, useState } from 'react';
import { COLOR_NAME_HU, fileOf, findKing, inCheck, PIECE_NAME_HU, rankOf, SPELLS } from '../../engine';
import type { Color, Effect, EffectKind, GameState, Move, Piece, Square } from '../../engine';
import { effectText, remainingText } from '../format';
import { ANCHORS } from '../pixel/art/anchors';
import { BADGE_GLYPHS } from '../pixel/art/badges';
import { boardArt } from '../scenes/boardArt';
import type { Motion, Plan } from '../vfx/choreo';
import { PieceSprite, Sprite } from './pixel';

const BADGE_KINDS: EffectKind[] = [
  'immune', 'fortified', 'deathMark', 'weakened', 'frozen', 'rooted', 'blinded', 'disarmed', 'glassCursed', 'spellWard', 'manaMage',
  'provoked', 'sniper', 'pawnRush', 'pawnVault', 'scout', 'bishopBlessing', 'queenGrace', 'frenchCheese', 'outOfWay',
];
const FILES = 'abcdefgh';

type Style = Record<string, string | number>;

export interface BoardProps {
  state: GameState;
  flipped: boolean;
  /** CSS px per art pixel (a square is 20 art px). */
  scale: number;
  selected: Square | null;
  moveTargets: Move[];
  spellTargets: Set<Square> | null;
  picked: Square[];
  /** Accent of the spell being aimed (CSS colour). */
  targetColor: string | null;
  lastMove: { from: Square; to: Square } | null;
  plan: Plan | null;
  /** The side to move is a human who may act now. */
  canAct: boolean;
  /** Board is being turned around (skip piece travel). */
  turning: boolean;
  reduced: boolean;
  onSquareClick: (s: Square) => void;
  onCancel: () => void;
  boardRef: { current: HTMLDivElement | null };
  frameRef: { current: HTMLDivElement | null };
}

const cell = (s: Square, flipped: boolean) => {
  const f = fileOf(s);
  const r = rankOf(s);
  return flipped ? { x: 7 - f, y: r } : { x: f, y: 7 - r };
};

const EASE: Record<string, string> = {
  slide: 'cubic-bezier(0.25, 0.75, 0.3, 1)',
  dash: 'cubic-bezier(0.55, 0, 0.85, 0.45)',
  push: 'cubic-bezier(0.2, 0.9, 0.3, 1.25)',
  pull: 'cubic-bezier(0.6, 0, 0.35, 1)',
  leap: 'cubic-bezier(0.4, 0.1, 0.6, 0.9)',
  rewind: 'cubic-bezier(0.35, 0, 0.25, 1)',
  blast: 'cubic-bezier(0.1, 0.9, 0.25, 1)',
};

/** Outer (travel) + inner (body) animation for a piece's motion in the current plan. */
function motionOf(m: Motion | undefined, at: { x: number; y: number }, flipped: boolean, turning: boolean, reduced: boolean) {
  const outer: Style = {};
  const body: Style = {};
  let cls = '';
  if (turning) {
    outer.transition = 'none';
    return { outer, body, cls };
  }
  if (!m) return { outer, body, cls };
  const delay = Math.round(m.delay);
  const dur = Math.round(reduced ? Math.min(m.dur, 200) : m.dur);
  body['--d'] = `${delay}ms`;
  body['--t'] = `${dur}ms`;
  if (m.mode in EASE) {
    outer.transition = `transform ${dur}ms ${EASE[m.mode]} ${delay}ms`;
    cls = m.mode === 'leap' ? 'm-leap' : m.mode === 'slide' ? 'm-hop' : `m-${m.mode}`;
  } else {
    outer.transition = 'none';
    cls = `m-${m.mode}`;
    if ((m.mode === 'lunge' || m.mode === 'recoil') && m.toward !== undefined) {
      const t = cell(m.toward, flipped);
      const dx = t.x - at.x;
      const dy = t.y - at.y;
      const len = Math.hypot(dx, dy) || 1;
      const reach = m.mode === 'lunge' ? Math.min(0.6, 0.6 * len) / len : -0.14 / len;
      body['--lx'] = (dx * reach).toFixed(3);
      body['--ly'] = (dy * reach).toFixed(3);
    }
  }
  return { outer, body, cls };
}

export const Board = memo(function Board(props: BoardProps) {
  const {
    state, flipped, scale, selected, moveTargets, spellTargets, picked, targetColor, lastMove, plan, canAct, turning,
    reduced, onSquareClick, onCancel, boardRef, frameRef,
  } = props;
  const art = boardArt();
  const [tipSq, setTipSq] = useState<Square | null>(null);

  const walls = useMemo(() => new Set(state.effects.filter((e) => e.kind === 'wall').flatMap((e) => e.squares ?? [])), [state.effects]);
  const zone = useMemo(() => new Set(state.effects.filter((e) => e.kind === 'dimensionZone').flatMap((e) => e.squares ?? [])), [state.effects]);
  const mines = useMemo(() => {
    const m = new Map<Square, Effect>();
    for (const e of state.effects) if (e.kind === 'mine' && e.squares?.length) m.set(e.squares[0], e);
    return m;
  }, [state.effects]);
  const reserved = useMemo(() => {
    const m = new Map<Square, Effect>();
    for (const e of state.effects) if (e.kind === 'outOfWay' && e.squares?.length) m.set(e.squares[0], e);
    return m;
  }, [state.effects]);
  const byPiece = useMemo(() => {
    const m = new Map<string, Effect[]>();
    for (const e of state.effects) {
      if (!e.pieceId) continue;
      if (!m.has(e.pieceId)) m.set(e.pieceId, []);
      m.get(e.pieceId)!.push(e);
    }
    return m;
  }, [state.effects]);
  const checkSquares = useMemo(() => {
    const out: Square[] = [];
    for (const c of ['w', 'b'] as Color[]) if (inCheck(state, c)) out.push(findKing(state.board, c));
    return out;
  }, [state]);
  const moveTo = useMemo(() => {
    const m = new Map<Square, Move>();
    moveTargets.forEach((mv) => m.set(mv.to, mv));
    return m;
  }, [moveTargets]);

  const terrainDelay = plan ? `${Math.round(plan.terrainAt)}ms` : '0ms';

  // ── squares ──
  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const file = flipped ? 7 - col : col;
      const rank = flipped ? row : 7 - row;
      const s = rank * 8 + file;
      const mv = moveTo.get(s);
      const isTarget = spellTargets?.has(s) ?? false;
      const own = state.board[s]?.color === state.turn;
      const cls = [
        'sq',
        (file + rank) % 2 === 1 ? 'is-light' : 'is-dark',
        lastMove && lastMove.from === s ? 'is-last-from' : '',
        lastMove && lastMove.to === s ? 'is-last-to' : '',
        selected === s ? 'is-selected' : '',
        checkSquares.includes(s) ? 'is-check' : '',
        zone.has(s) ? 'is-zone' : '',
        isTarget ? 'is-target' : '',
        picked.includes(s) ? 'is-picked' : '',
        spellTargets && !isTarget && !picked.includes(s) ? 'is-dim' : '',
        mv ? (mv.defuse ? 'is-defuse' : mv.capture ? 'is-capture' : 'is-move') : '',
        canAct && (isTarget || mv || (own && !spellTargets)) ? 'is-hot' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const mine = mines.get(s);
      const home = reserved.get(s);
      squares.push(
        <div
          key={s}
          className={cls}
          role="button"
          tabIndex={-1}
          aria-label={FILES[file] + (rank + 1)}
          data-square={s}
          onClick={() => onSquareClick(s)}
          onMouseEnter={() => setTipSq(s)}
          onMouseLeave={() => setTipSq((cur) => (cur === s ? null : cur))}
          onContextMenu={(e: { preventDefault(): void }) => {
            e.preventDefault();
            onCancel();
          }}
        >
          {mine && (
            <span className={`mine ${mine.expiresAfterTurn! <= state.turnIndex ? 'is-armed' : ''}`} style={{ ['--terrain-delay' as string]: terrainDelay }} aria-hidden="true">
              <img className="px mine-mound" src={art.mound} alt="" draggable={false} />
              <Sprite src={ANCHORS.bomb} fill className="mine-bomb" />
            </span>
          )}
          {walls.has(s) && (
            <span className="wall" style={{ ['--terrain-delay' as string]: terrainDelay }} aria-hidden="true">
              <img className="px px-fill" src={art.wall} alt="" draggable={false} />
            </span>
          )}
          {home && (
            <span className="reserved" aria-hidden="true">
              <Sprite src={BADGE_GLYPHS.outOfWay!} fill />
            </span>
          )}
          {(isTarget || picked.includes(s) || selected === s || (mv && (mv.capture || mv.defuse))) && <span className="brackets" aria-hidden="true" />}
          {mv && !mv.capture && !mv.defuse && <span className="mark-move" aria-hidden="true" />}
          {mv && (mv.capture || mv.defuse) && <span className={mv.defuse ? 'mark-defuse' : 'mark-capture'} aria-hidden="true" />}
        </div>,
      );
    }
  }

  // ── pieces ──
  const glyphScale = Math.max(1, Math.round(scale * 0.67));
  const pieces = [];
  for (let s = 0; s < 64; s++) {
    const p = state.board[s];
    if (!p) continue;
    const at = cell(s, flipped);
    const m = plan?.motions[p.id];
    const { outer, body, cls } = motionOf(m, at, flipped, turning, reduced);
    const effects = byPiece.get(p.id) ?? [];
    const badges = effects.filter((e) => BADGE_KINDS.includes(e.kind) && BADGE_GLYPHS[e.kind]);
    const warded = effects.some((e) => e.kind === 'spellWard');
    const pcls = [
      'piece',
      `is-${p.color}`,
      `pt-${p.type}`,
      p.clone ? 'is-clone' : '',
      warded ? 'is-warded' : '',
      selected === s ? 'is-selected' : '',
      checkSquares.includes(s) && p.type === 'K' ? 'is-checked' : '',
      effects.some((e) => e.kind === 'frozen') ? 'is-frozen' : '',
      effects.some((e) => e.kind === 'immune' || e.kind === 'fortified') ? 'is-guarded' : '',
      effects.some((e) => e.kind === 'manaMage') ? 'is-mage' : '',
      effects.some((e) => e.kind === 'glassCursed') ? 'is-glass' : '',
    ]
      .filter(Boolean)
      .join(' ');
    pieces.push(
      <div key={p.id} className={pcls} style={{ transform: `translate(${at.x * 100}%, ${at.y * 100}%)`, ...outer }}>
        <span className="piece-shadow" aria-hidden="true" />
        <div key={m && plan ? `m${plan.id}` : 'still'} className={`piece-body ${cls}`} style={body}>
          <PieceSprite type={p.type} color={p.color} fill />
        </div>
        {badges.length > 0 && (
          <span className="piece-badges" aria-hidden="true">
            {badges.slice(0, 3).map((e) => (
              <Sprite key={e.id} src={BADGE_GLYPHS[e.kind]!} scale={glyphScale} className="piece-badge" />
            ))}
          </span>
        )}
      </div>,
    );
  }

  // ── hover note for pieces / terrain ──
  let tip = null;
  if (tipSq !== null) {
    const p = state.board[tipSq];
    const visible = p ?? null;
    const effs = visible ? byPiece.get(visible.id) ?? [] : [];
    const mine = mines.get(tipSq);
    const home = reserved.get(tipSq);
    const lines: { key: string; title: string; text: string; left: string }[] = effs
      .map((e) => ({ key: e.id, title: SPELLS[e.source]?.name ?? e.kind, text: effectText(e.kind), left: remainingText(e, state) }));
    if (mine) lines.push({ key: 'mine', title: 'Akna', text: `${COLOR_NAME_HU[mine.owner]} aknája`, left: remainingText(mine, state) });
    if (walls.has(tipSq)) lines.push({ key: 'wall', title: 'Fal', text: 'blokkolt mező', left: '' });
    if (home) lines.push({ key: 'home', title: 'El az útból!', text: 'ide tér vissza a félreállt bábu', left: 'a kör végén' });
    if (lines.length) {
      const { x, y } = cell(tipSq, flipped);
      tip = (
        <div className={`board-tip frame-parchment ${y < 2 ? 'is-below' : ''} ${x > 5 ? 'is-left' : x < 2 ? 'is-right' : ''}`} style={{ left: `${(x + 0.5) * 12.5}%`, top: `${(y < 2 ? y + 1 : y) * 12.5}%` }} role="tooltip">
          {visible && <strong>{pieceLabel(visible)}</strong>}
          {lines.map((l) => (
            <span key={l.key} className="board-tip-line">
              <b>{l.title}</b> {l.text}
              {l.left && <em> · {l.left}</em>}
            </span>
          ))}
        </div>
      );
    }
  }

  return (
    <div className={`board-frame ${turning ? 'is-turning' : ''}`} ref={frameRef} style={{ ['--bs' as string]: `${scale}px` }}>
      <div className="board-coords" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={`f${i}`} className="coord coord-file" style={{ left: `${(i + 0.5) * 12.5}%` }}>
            {FILES[flipped ? 7 - i : i]}
          </span>
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <span key={`r${i}`} className="coord coord-rank" style={{ top: `${(i + 0.5) * 12.5}%` }}>
            {flipped ? i + 1 : 8 - i}
          </span>
        ))}
      </div>
      <div
        className={`board ${spellTargets ? 'is-targeting' : ''}`}
        ref={boardRef}
        style={targetColor ? { ['--target' as string]: targetColor } : undefined}
        onContextMenu={(e: { preventDefault(): void }) => e.preventDefault()}
      >
        <div className="squares">{squares}</div>
        <div className="pieces">{pieces}</div>
        {tip}
      </div>
    </div>
  );
});

function pieceLabel(p: Piece): string {
  return `${COLOR_NAME_HU[p.color]} ${PIECE_NAME_HU[p.type].toLowerCase()}${p.clone ? ' (klón)' : ''}`;
}

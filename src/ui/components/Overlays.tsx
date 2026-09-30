import { useEffect } from 'react';
import { COLOR_NAME_HU, SPELLS } from '../../engine';
import type { Color, GameState, PieceType, PromotionPiece, SpellId } from '../../engine';
import { sfx } from '../audio/sound';
import { displayName } from '../format';
import { Icon, PieceSprite, SpellIcon } from './pixel';

const VALUE: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0, S: 1 };

/**
 * The promotion choice. `lost`: the kinds of piece „Végzet” erased for this player – shown as
 * holes in the shape of the piece, and not choosable.
 */
export function PromotionDialog({
  color, onPick, hot, lost = [],
}: { color: Color; onPick: (p: PromotionPiece) => void; hot?: PromotionPiece | null; lost?: readonly PromotionPiece[] }) {
  const opts: [PromotionPiece, string][] = [
    ['Q', 'Vezér'],
    ['R', 'Bástya'],
    ['B', 'Futó'],
    ['N', 'Huszár'],
  ];
  const first = opts.find(([p]) => !lost.includes(p))?.[0];
  return (
    <div className="overlay overlay-soft" role="dialog" aria-modal="true" aria-label="Gyalogátváltozás">
      <div className="dialog frame-parchment promo-dialog">
        <h3 className="dialog-title">Gyalogátváltozás</h3>
        <p>Mivé változzon a gyalog?</p>
        <div className="promo-options">
          {opts.map(([p, label]) => {
            const gone = lost.includes(p);
            return (
              <button
                key={p}
                type="button"
                className={`promo-option${hot === p ? ' is-hot' : ''}${gone ? ' is-lost' : ''}`}
                data-piece={p}
                disabled={gone}
                title={gone ? `${label}: a Végzet kitörölte a létezésből – ilyen bábu többé nem lehet.` : undefined}
                onClick={() => !gone && onPick(p)}
                autoFocus={p === first}
              >
                <PieceSprite type={p} color={color} scale={3} erased={gone} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        {lost.length > 0 && <p className="promo-lost-note">A Végzet által kitörölt bábu nem választható.</p>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  text, yes, no = 'Mégse', tone = 'danger', onYes, onNo,
}: { text: string; yes: string; no?: string; tone?: 'danger' | 'primary'; onYes: () => void; onNo: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onNo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNo]);
  return (
    <div className="overlay overlay-soft" role="alertdialog" aria-modal="true" aria-label={text}>
      <div className="dialog frame-parchment confirm-dialog">
        <p className="dialog-title">{text}</p>
        <div className="dialog-actions">
          <button type="button" className={`btn ${tone === 'primary' ? 'btn-primary' : 'btn-danger'}`} onClick={onYes} autoFocus>
            {yes}
          </button>
          <button type="button" className="btn" onClick={onNo}>
            {no}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Big banner across the war table when the turn passes. */
export function TurnBanner({ color, round, sub }: { color: Color; round: number; sub: string }) {
  return (
    <div className={`turn-banner turn-banner-${color}`} role="status" aria-live="polite">
      <div className="turn-banner-cloth">
        <Icon name={color === 'w' ? 'crestW' : 'crestB'} scale={3} className="turn-banner-crest" />
        <div className="turn-banner-text">
          <b>{color === 'w' ? 'A VILÁGOS KÖRE' : 'A SÖTÉT KÖRE'}</b>
          <small>
            {round}. kör · {sub}
          </small>
        </div>
      </div>
    </div>
  );
}

/** A card leaving the hand towards the board when a spell is cast. */
export function CastFlight({ spellId, color, rect, to }: { spellId: SpellId; color: Color; rect: { left: number; top: number; width: number; height: number }; to: { x: number; y: number } }) {
  const spell = SPELLS[spellId];
  const w = 104;
  const h = 132;
  const x0 = rect.left + rect.width / 2 - w / 2;
  const y0 = rect.top + rect.height / 2 - h / 2;
  return (
    <div
      className={`cast-flight cast-${color}`}
      data-cat={spell.category}
      style={{
        left: `${x0}px`,
        top: `${y0}px`,
        width: `${w}px`,
        height: `${h}px`,
        ['--tx' as string]: `${to.x - (x0 + w / 2)}px`,
        ['--ty' as string]: `${to.y - (y0 + h / 2)}px`,
      }}
      aria-hidden="true"
    >
      <span className="cast-art">
        <SpellIcon id={spellId} scale={3} />
      </span>
      <span className="cast-name">{displayName(spell)}</span>
    </div>
  );
}

export function CheckStamp({ mate }: { mate: boolean }) {
  return (
    <div className={`check-stamp ${mate ? 'is-mate' : ''}`} role="status" aria-live="assertive">
      {mate ? 'MATT!' : 'SAKK!'}
    </div>
  );
}

interface OverProps {
  state: GameState;
  /** In AI and online games: this player's colour (victory vs. defeat); null in local games. */
  human: Color | null;
  /** Online games: the players' names. */
  names?: Record<Color, string> | null;
  onRematch: () => void;
  /** Online games: the rematch button's state (both players must ask). */
  rematch?: { label: string; disabled: boolean; note: string };
  onMenu: () => void;
  /** What the way out is called (online games go back to the lobby). */
  menuLabel?: string;
  onClose: () => void;
}

/** Victory / defeat screen with a short battle summary. */
export function GameOverScreen({ state, human, names, onRematch, rematch, onMenu, menuLabel, onClose }: OverProps) {
  const st = state.status;
  const winner: Color | null = st.kind === 'checkmate' || st.kind === 'resigned' ? st.winner : null;
  const outcome: 'victory' | 'defeat' | 'draw' = !winner ? 'draw' : human === null || winner === human ? 'victory' : 'defeat';
  let title = 'DÖNTETLEN';
  if (winner) title = human === null ? `A ${winner === 'w' ? 'VILÁGOS' : 'SÖTÉT'} GYŐZÖTT` : outcome === 'victory' ? 'GYŐZELEM' : 'VERESÉG';
  else if (st.kind === 'stalemate') title = 'PATT';
  const reason =
    st.kind === 'checkmate'
      ? 'Sakk-matt'
      : st.kind === 'resigned'
        ? `${(names ?? COLOR_NAME_HU)[winner === 'w' ? 'b' : 'w']} feladta a játszmát`
        : st.kind === 'stalemate'
          ? 'Patt – nincs szabályos lépés'
          : st.kind === 'draw'
            ? st.reason
            : '';

  useEffect(() => {
    sfx(outcome === 'defeat' ? 'defeat' : 'victory');
  }, [outcome]);

  const rounds = Math.floor(state.turnIndex / 2) + 1;
  const row = (c: Color) => {
    const opp: Color = c === 'w' ? 'b' : 'w';
    const takenValue = state.captured[opp].filter((p) => !p.dissolved).reduce((n, p) => n + VALUE[p.type], 0);
    return {
      moves: state.moveList.filter((m) => m.color === c && m.kind !== 'spell').length,
      spells: state.players[c].spellsCast,
      captures: state.captured[opp].filter((p) => !p.dissolved).length,
      value: takenValue,
      mana: state.players[c].mana,
    };
  };
  const w = row('w');
  const b = row('b');

  return (
    <div className={`overlay gameover gameover-${outcome}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="gameover-motes" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-((i * 0.61) % 3).toFixed(2)}s`, animationDuration: `${2.6 + ((i * 7) % 10) / 6}s` }} />
        ))}
      </div>
      <div className="gameover-card">
        <div className="gameover-crest" aria-hidden="true">
          {outcome === 'victory' && <Icon name="crown" scale={5} />}
          {outcome === 'defeat' && <Icon name="skull" scale={5} />}
          {outcome === 'draw' && <Icon name="scales" scale={5} />}
        </div>
        <div className="gameover-banner">
          <h2>{title}</h2>
        </div>
        <p className="gameover-reason">{reason}</p>
        <div className="gameover-sheet frame-parchment">
          <table className="gameover-stats">
            <thead>
              <tr>
                <th />
                <th>
                  <Icon name="crestW" scale={1} /> Világos
                </th>
                <th>
                  <Icon name="crestB" scale={1} /> Sötét
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Lépések</th>
                <td>{w.moves}</td>
                <td>{b.moves}</td>
              </tr>
              <tr>
                <th>Kijátszott spellek</th>
                <td>{w.spells}</td>
                <td>{b.spells}</td>
              </tr>
              <tr>
                <th>Leütött bábuk</th>
                <td>
                  {w.captures} <small>({w.value} pont)</small>
                </td>
                <td>
                  {b.captures} <small>({b.value} pont)</small>
                </td>
              </tr>
              <tr>
                <th>Mana a végén</th>
                <td>{w.mana}</td>
                <td>{b.mana}</td>
              </tr>
            </tbody>
          </table>
          <p className="gameover-rounds">
            <Icon name="hourglass" scale={1} /> {rounds} kör
          </p>
        </div>
        <div className="dialog-actions">
          <button type="button" id="rematch" className="btn btn-primary btn-big" onClick={onRematch} disabled={rematch?.disabled} autoFocus>
            <Icon name="swords" scale={2} /> {rematch?.label ?? 'Új játszma'}
          </button>
          <button type="button" id="gameover-menu" className="btn" onClick={onMenu}>
            <Icon name={menuLabel ? 'globe' : 'home'} scale={2} /> {menuLabel ?? 'Menü'}
          </button>
          <button type="button" className="btn btn-dark" onClick={onClose}>
            <Icon name="eye" scale={2} /> Tábla
          </button>
        </div>
        {rematch && (
          <p className="gameover-note" aria-live="polite">
            {rematch.note}
          </p>
        )}
      </div>
    </div>
  );
}

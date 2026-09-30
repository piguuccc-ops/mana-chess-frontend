import { castBlockReason, chargeOf, COLOR_NAME_HU, effectiveCost, hand, maxMana, SPELLS } from '../../engine';
import type { Color, EffectKind, GameState, PieceType, SpellId } from '../../engine';
import type { Plan } from '../vfx/choreo';
import { ManaCrystals } from './ManaCrystals';
import { Icon, PieceSprite, SpellIcon } from './pixel';
import { SpellCard } from './SpellCard';

/** Colour-wide states worth showing next to a player's name. */
const STATUS: Partial<Record<EffectKind, string>> = {
  silenced: 'Némaság – nem varázsolhat',
  timeStop: 'Időmegállítás – nincs normál lépés',
  discount: 'Túltöltés – a következő spell 2-vel olcsóbb',
  manaCap: 'Arcane Surge – max. 4 mana',
  royalGuard: 'Királyvédelem – nem kaphat sakkot',
  doubleMove: 'Dupla lépés',
  kingStride: 'Királylépés',
  realityBreak: 'Valóságtörés',
  manaDeposit: 'Mana-letét – a következő körben +3 mana',
  manaThirst: 'Mana-szomj – az első ütés manát ér',
};
const VALUE: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0, S: 1 };

interface Props {
  state: GameState;
  color: Color;
  label: string;
  active: boolean;
  thinking: boolean;
  placement: 'top' | 'bottom';
  plan: Plan | null;
  /** Show the hand as small cards (the big hand column shows the other one). */
  showHand: boolean;
  /** Phones: the next card of this player's deck (the hand strip has no queue of its own). */
  showNext?: boolean;
  crystalScale: number;
  /** A small card or the next card was tapped: open it for reading. */
  onInspect?: (id: SpellId) => void;
}

export function PlayerPlate({ state, color, label, active, thinking, placement, plan, showHand, showNext, crystalScale, onInspect }: Props) {
  const pl = state.players[color];
  const opp: Color = color === 'w' ? 'b' : 'w';
  const taken = state.captured[opp].filter((p) => !p.dissolved).sort((a, b) => VALUE[b.type] - VALUE[a.type]);
  const material = (c: Color) => state.board.reduce((n, p) => n + (p && p.color === c ? VALUE[p.type] : 0), 0);
  const diff = material(color) - material(opp);
  const statuses = state.effects.filter((e) => e.color === color && STATUS[e.kind]);
  const cards = hand(state, color);
  const next = pl.deck[3];
  const nextChip = next && (
    <button type="button" className="plate-next" title={`Következő: ${SPELLS[next].name}`} aria-label={`Következő lap: ${SPELLS[next].name}`} onClick={() => onInspect?.(next)}>
      <SpellIcon id={next} scale={1} />
    </button>
  );

  return (
    <section className={`plate plate-${placement} plate-${color} ${active ? 'is-active' : ''}`} aria-label={`${COLOR_NAME_HU[color]} játékos`}>
      <div className="plate-id">
        <span className="plate-crest">
          <Icon name={color === 'w' ? 'crestW' : 'crestB'} scale={2} />
        </span>
        <div className="plate-name">
          <b title={label}>{label}</b>
          <small>{pl.deckName}</small>
        </div>
        {active && (
          <span className={`plate-turn ${thinking ? 'is-thinking' : ''}`} title={thinking ? 'Gondolkodik…' : 'Soron van'}>
            <Icon name="hourglass" scale={1} />
            {thinking && <span className="plate-turn-text">gondolkodik…</span>}
          </span>
        )}
      </div>

      {statuses.length > 0 && (
        <div className="plate-status" aria-label="Aktív állapotok">
          {statuses.map((e) => (
            <span key={e.id} className="status-chip" title={`${STATUS[e.kind]} (${SPELLS[e.source].name})`}>
              <SpellIcon id={e.source} scale={1} />
            </span>
          ))}
        </div>
      )}

      <div className="plate-taken" aria-label="Leütött bábuk">
        {taken.map((p) => (
          <PieceSprite key={p.id} type={p.type} color={p.color} scale={1} className={p.clone ? 'is-clone' : ''} />
        ))}
        {diff > 0 && <span className="plate-diff">+{diff}</span>}
      </div>

      {showHand && (
        <div className="plate-hand" data-hand={color} aria-label={`${COLOR_NAME_HU[color]} keze`}>
          {cards.map((id) => (
            <SpellCard
              key={id}
              spell={SPELLS[id]}
              cost={effectiveCost(state, color, SPELLS[id])}
              blockReason={active ? castBlockReason(state, id) : 'Nem ő van soron.'}
              interactive={false}
              size="mini"
              tooltipSide={placement === 'top' ? 'bottom' : 'top'}
              charge={chargeOf(state, color, id)}
              onClick={onInspect ? () => onInspect(id) : undefined}
            />
          ))}
          {next && nextChip}
        </div>
      )}
      {!showHand && showNext && next && <div className="plate-hand plate-hand-next">{nextChip}</div>}

      <div className="plate-mana">
        <span className="plate-cast" title="Kijátszott spellek">
          <Icon name="rune" scale={1} />
          {pl.spellsCast}
        </span>
        <ManaCrystals color={color} mana={pl.mana} cap={maxMana(state, color)} anim={plan?.mana[color]} planId={plan?.id ?? 0} scale={crystalScale} />
      </div>
    </section>
  );
}

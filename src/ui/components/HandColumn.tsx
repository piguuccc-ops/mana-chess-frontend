import { castBlockReason, chargeOf, COLOR_NAME_HU, effectiveCost, hand, isAwakened, SPELLS } from '../../engine';
import type { Color, GameState, SpellId } from '../../engine';
import { costText } from '../format';
import { Icon, SpellIcon } from './pixel';
import { SpellCard } from './SpellCard';

interface Props {
  state: GameState;
  color: Color;
  /** Header line under „Kéz” (whose hand it is). */
  owner: string;
  /** The player may use these cards right now. */
  interactive: boolean;
  armed: SpellId | null;
  targeting: SpellId | null;
  onCardClick: (id: SpellId) => void;
  onConfirm: (id: SpellId) => void;
  waitingText: string | null;
  /** column: the tall hand panel beside the board. strip: three small cards under the board (phones). */
  layout: 'column' | 'strip';
  /** Opens a card for reading (its whole text and a demo). */
  onInfo?: (id: SpellId) => void;
}

/** The player's hand: three cards on the table, then the order of the rest of the deck. */
export function HandColumn({ state, color, owner, interactive, armed, targeting, onCardClick, onConfirm, waitingText, layout, onInfo }: Props) {
  const cards = hand(state, color);
  const queue = state.players[color].deck.slice(3);
  const active = state.turn === color && state.status.kind === 'playing';
  if (layout === 'strip') {
    return (
      <section className={`hand-panel hand-strip ${interactive ? 'is-live' : ''}`} aria-label={`Kéz – ${owner}`}>
        <div className="hand-cards" data-hand={color} key={color}>
          {cards.map((id, i) => {
            const spell = SPELLS[id];
            return (
              <div key={id} className="hand-slot" style={{ ['--i' as string]: i }}>
                <SpellCard
                  spell={spell}
                  cost={effectiveCost(state, color, spell)}
                  blockReason={active ? castBlockReason(state, id) : 'Nem te vagy soron.'}
                  interactive={interactive}
                  size="strip"
                  active={targeting === id}
                  armed={armed === id}
                  onClick={() => onCardClick(id)}
                  onConfirm={() => onConfirm(id)}
                  onInfo={onInfo ? () => onInfo(id) : undefined}
                  charge={chargeOf(state, color, id)}
                />
              </div>
            );
          })}
          {waitingText && <div className="hand-waiting">{waitingText}</div>}
        </div>
      </section>
    );
  }
  return (
    <section className={`hand-panel panel frame-wood hand-${layout} ${interactive ? 'is-live' : ''}`} aria-label="Kéz">
      <header className="hand-head">
        <h2 className="panel-heading">
          <Icon name="cards" scale={2} /> Kéz
        </h2>
        <span className="hand-owner">{owner}</span>
      </header>
      <div className="hand-cards" data-hand={color} key={color}>
        {cards.map((id, i) => {
          const spell = SPELLS[id];
          const reason = active ? castBlockReason(state, id) : 'Nem te vagy soron.';
          return (
            <div key={id} className="hand-slot" style={{ ['--i' as string]: i }}>
              <SpellCard
                spell={spell}
                cost={effectiveCost(state, color, spell)}
                blockReason={reason}
                interactive={interactive}
                active={targeting === id}
                armed={armed === id}
                onClick={() => onCardClick(id)}
                onConfirm={() => onConfirm(id)}
                tooltipSide="right"
                charge={chargeOf(state, color, id)}
              />
            </div>
          );
        })}
        {waitingText && <div className="hand-waiting">{waitingText}</div>}
      </div>
      <footer className="hand-queue" aria-label="A pakli további sorrendje" data-queue-owner={color}>
        <span className="hand-queue-label">Következő</span>
        {queue.map((id, i) => {
          // „Körforgás”: a charged card is on its way back, awakened
          const awake = isAwakened(state, color, id);
          return (
            <span
              key={id}
              className={`queue-chip ${i === 0 ? 'is-next' : ''} ${awake ? 'is-awakened' : ''}`}
              data-queue={id}
              title={`${i === 0 ? 'Következő lap' : `${i + 1}. a sorban`}: ${SPELLS[id].name} (${costText(SPELLS[id])} mana)${awake ? ' – feltöltve: felébredve jön vissza' : ''}`}
            >
              <SpellIcon id={id} scale={i === 0 ? 2 : 1} />
              {i === 0 && <span className="queue-name">{awake ? SPELLS[id].awakened?.name ?? SPELLS[id].name : SPELLS[id].name}</span>}
              <b>{costText(SPELLS[id])}</b>
              {awake && <i className="queue-charge" aria-hidden="true" />}
            </span>
          );
        })}
      </footer>
      <p className="hand-hint">
        {COLOR_NAME_HU[color]} pakli: kijátszás után a lap a sor végére kerül.
      </p>
    </section>
  );
}

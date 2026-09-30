// ◀ deck ▶ picker used by the battle setup (local, AI and online games).
import { RANDOM_DECK_ID, SPELLS, type DeckDef } from '../../engine';
import { sfx } from '../audio/sound';
import { costText } from '../format';
import { Icon, SpellIcon } from './pixel';

/** ◀ deck ▶ picker with the six spells of the chosen deck. */
export function DeckCarousel({ side, label, value, decks, onChange }: { side: 'w' | 'b' | 'any'; label: string; value: string; decks: DeckDef[]; onChange: (id: string) => void }) {
  const options = [RANDOM_DECK_ID, ...decks.map((d) => d.id)];
  const idx = Math.max(0, options.indexOf(value));
  const isRandom = options[idx] === RANDOM_DECK_ID;
  const deck = isRandom ? null : decks.find((d) => d.id === options[idx]) ?? decks[0];
  const step = (d: number) => {
    sfx('page');
    onChange(options[(idx + d + options.length) % options.length]);
  };
  const avg = deck ? deck.spells.reduce((n, s) => n + SPELLS[s].manaCost, 0) / deck.spells.length : 0;
  return (
    <div className={`deck-carousel side-${side}`}>
      <div className="deck-carousel-head">
        <Icon name={side === 'w' ? 'crestW' : side === 'b' ? 'crestB' : 'cards'} scale={2} />
        <span className="field-label">{label}</span>
      </div>
      <div className="deck-carousel-row">
        <button type="button" className="btn btn-sm btn-icon" aria-label="Előző pakli" onClick={() => step(-1)}>
          <Icon name="arrowLeft" scale={1} />
        </button>
        <div className="deck-carousel-name" aria-live="polite">
          <b>{isRandom ? 'Véletlen pakli' : deck!.name}</b>
          <small>{isRandom ? 'Minden csatára új lapok' : deck!.preset ? 'Előre elkészített' : (deck as DeckDef & { source?: string }).source === 'server' ? 'A fiókodban' : 'Saját pakli'}</small>
        </div>
        <button type="button" className="btn btn-sm btn-icon" aria-label="Következő pakli" onClick={() => step(1)}>
          <Icon name="arrowRight" scale={1} />
        </button>
      </div>
      <div className="deck-carousel-cards">
        {isRandom
          ? Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="mini-slot is-random">
                <Icon name="dice" scale={2} />
              </span>
            ))
          : deck!.spells.map((s) => (
              <span key={s} className="mini-slot" title={`${SPELLS[s].name} (${costText(SPELLS[s])} mana)`}>
                <SpellIcon id={s} scale={2} />
                <b>{costText(SPELLS[s])}</b>
              </span>
            ))}
      </div>
      <p className="deck-carousel-desc">
        {isRandom
          ? 'Legfeljebb egy 6 és egy 5 manás spell, legalább 2 olcsó, és a kezdő kézben mindig van kijátszható lap.'
          : `${deck!.description || 'Saját pakli.'} Átlag: ${avg.toFixed(1)} mana.`}
      </p>
      {!isRandom && (
        <button type="button" className="link-btn" onClick={() => onChange(RANDOM_DECK_ID)}>
          <Icon name="dice" scale={1} /> Véletlen pakli
        </button>
      )}
    </div>
  );
}

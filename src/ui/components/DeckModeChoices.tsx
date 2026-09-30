import { Icon } from './pixel';

/** Where the decks come from: the players' own, or Spell-toborzás (a draft). */
export function DeckModeChoices({ draft, onChange }: { draft: boolean; onChange: (draft: boolean) => void }) {
  return (
    <div className="choices" role="radiogroup" aria-label="Paklik">
      <button type="button" role="radio" aria-checked={!draft} className="choice" onClick={() => onChange(false)}>
        <Icon name="book" scale={2} />
        <b>Saját paklik</b>
        <small>A pakliválasztóból</small>
      </button>
      <button type="button" role="radio" aria-checked={draft} className="choice" onClick={() => onChange(true)}>
        <Icon name="cards" scale={2} />
        <b>Spell-toborzás</b>
        <small>32 spellből, felváltva választva</small>
      </button>
    </div>
  );
}

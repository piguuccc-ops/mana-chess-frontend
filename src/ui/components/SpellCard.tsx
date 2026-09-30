import type { Spell } from '../../engine';
import { costText, displayName } from '../format';
import { sfx } from '../audio/sound';
import { CrystalSprite, Icon, SpellIcon } from './pixel';

export interface SpellCardProps {
  spell: Spell;
  cost: number;
  blockReason: string | null;
  active?: boolean;
  armed?: boolean;
  interactive: boolean;
  /** hand: the tall hand panel; strip: a small card under the board (phones); mini: plates, queue; tile: the library. */
  size?: 'hand' | 'strip' | 'mini' | 'tile';
  selected?: boolean;
  next?: boolean;
  /** Tile that cannot be added right now (deck full) – desaturated but still explains why on click. */
  unavailable?: boolean;
  onClick?: () => void;
  /**
   * Tiles only: a corner button that adds / removes the card right away. With it, a click on
   * the card itself opens the card (inspector) instead of toggling it.
   */
  onQuick?: () => void;
  onConfirm?: () => void;
  /** Strip cards: a corner button that opens the card for reading (touch screens have no hover). */
  onInfo?: () => void;
  /** Where a mini card's hover note opens. */
  tooltipSide?: 'right' | 'left' | 'top' | 'bottom';
  /**
   * Cards that charge up („Körforgás”, e.g. „Végzet”): how far this one has charged in the game.
   * Charged, the card is awakened – its awakened name, text and look. Omitted: shown uncharged.
   */
  charge?: { have: number; need: number } | null;
}

/** A physical spell card: cost gem, pixel artwork, name plate, rules text and category. */
export function SpellCard(props: SpellCardProps) {
  const { spell, cost, blockReason, active, armed, interactive, size = 'hand', selected, next, unavailable, onClick, onQuick, onConfirm, onInfo, tooltipSide = 'right' } = props;
  const quick = size === 'tile' && !!onQuick;
  const disabled = size !== 'tile' && (!interactive || blockReason !== null);
  const discounted = cost < spell.manaCost;
  // „Körforgás”: a card that has charged up comes back awakened
  const cycles = spell.cycles ?? 0;
  const charged = Math.min(cycles, props.charge?.have ?? 0);
  const awake = cycles > 0 && charged >= cycles && !!spell.awakened;
  const name = awake ? spell.awakened!.name : spell.name;
  const title = awake ? name : displayName(spell);
  const desc = awake ? spell.awakened!.description : spell.description;
  const pips = cycles > 0 && (
    <span
      className="card-charge"
      title={
        awake
          ? 'Feltöltve: most felébredve játszod ki'
          : cycles - charged === 1
            ? `Körforgás ${charged}/${cycles}: a következő kijátszás feltölti, és legközelebb felébredve jön vissza`
            : `Körforgás ${charged}/${cycles}: még ${cycles - charged} kijátszás tölti fel, utána felébredve jön vissza`
      }
    >
      {Array.from({ length: cycles }, (_, i) => (
        <i key={i} className={i < charged ? 'is-lit' : ''} />
      ))}
    </span>
  );
  const cls = [
    'card',
    `card--${size}`,
    interactive && !disabled ? 'is-interactive' : '',
    size === 'tile' && (!unavailable || quick) ? 'is-interactive' : '',
    disabled ? 'is-disabled' : '',
    active ? 'is-active' : '',
    armed ? 'is-armed' : '',
    selected ? 'is-selected' : '',
    next ? 'is-next' : '',
    unavailable ? 'is-unavailable' : '',
    awake ? 'is-awakened' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const gem = (
    <span className={`card-cost ${discounted ? 'is-discounted' : ''}`}>
      <CrystalSprite color="w" state="full" scale={size === 'mini' || size === 'strip' ? 1.5 : 2.5} />
      <b>
        {cost}
        {spell.costFor ? '+' : ''}
      </b>
      {discounted && <s>{spell.manaCost}</s>}
    </span>
  );

  const label = quick
    ? `${spell.name}, ${cost} mana${selected ? ', a pakliban' : ''} – leírás és bemutató`
    : `${name}, ${cost} mana. ${desc}${blockReason ? ' – ' + blockReason : ''}`;
  const click = () => {
    if (!onClick) return;
    if (quick) sfx('open');
    else if (size === 'tile' || !disabled) sfx(size === 'tile' ? (selected ? 'cardDrop' : 'cardPick') : 'cardPick');
    onClick();
  };

  return (
    <div className={cls} data-cat={spell.category} data-spell={spell.id}>
      <button
        type="button"
        className="card-face"
        onClick={click}
        aria-disabled={disabled}
        aria-pressed={size === 'tile' && !quick ? !!selected : undefined}
        aria-haspopup={quick ? 'dialog' : undefined}
        aria-label={label}
      >
        {gem}
        {size === 'tile' && (
          <>
            <span className="card-art">
              <SpellIcon id={spell.id} scale={4} />
              {pips}
            </span>
            <span className="card-plate">
              <span className="card-name">{displayName(spell)}</span>
            </span>
            <span className="card-body">
              <span className="card-desc">{spell.description}</span>
              <span className="card-cat">{spell.category}</span>
            </span>
          </>
        )}
        {size === 'hand' && (
          <>
            <span className="card-art">
              <SpellIcon id={spell.id} scale={3} />
              {pips}
            </span>
            <span className="card-text">
              <span className="card-name">{title}</span>
              <span className="card-cat">{spell.category}</span>
              <span className="card-desc">{desc}</span>
            </span>
          </>
        )}
        {size === 'strip' && (
          <>
            <span className="card-art">
              <SpellIcon id={spell.id} scale={2} />
              {pips}
            </span>
            <span className="card-name">{title}</span>
          </>
        )}
        {size === 'mini' && (
          <span className="card-art">
            <SpellIcon id={spell.id} scale={2} />
            {pips}
          </span>
        )}
      </button>
      {size === 'strip' && onInfo && (
        <button type="button" className="card-info" onClick={onInfo} aria-label={`${name}: leírás és bemutató`} title="Leírás és bemutató">
          <Icon name="info" scale={1} />
        </button>
      )}
      {size === 'tile' && (spell.added || spell.change) && (
        <span className="card-badges" aria-hidden="true">
          {spell.added && <span className="badge badge-new">új</span>}
          {spell.change && <span className="badge">módosítva</span>}
        </span>
      )}
      {selected && !quick && (
        <span className="card-seal" aria-hidden="true">
          <Icon name="check" scale={2} />
        </span>
      )}
      {quick && (
        <button
          type="button"
          className={`card-quick ${selected ? 'is-in' : ''} ${unavailable ? 'is-blocked' : ''}`}
          onClick={onQuick}
          aria-pressed={!!selected}
          aria-label={selected ? `${spell.name} kivétele a pakliból` : `${spell.name} a pakliba`}
          title={selected ? 'Kivétel a pakliból' : unavailable ? 'A pakli tele' : 'Pakliba'}
        >
          <Icon name={selected ? 'check' : 'plus'} scale={2} className="card-quick-main" />
          {selected && <Icon name="close" scale={2} className="card-quick-alt" />}
        </button>
      )}
      {size === 'mini' && (
        <div className={`tip frame-parchment tip-${tooltipSide}`} role="tooltip">
          <strong>
            {name} · {costText(spell)} mana
          </strong>
          <span>{desc}</span>
          {blockReason && interactive && <em>{blockReason}</em>}
        </div>
      )}
      {size === 'hand' && (
        // after a short hover the card unfolds over its neighbours so the whole text can be read
        <div className="card-unfold" aria-hidden="true">
          {gem}
          <span className="card-art">
            <SpellIcon id={spell.id} scale={3} />
            {pips}
          </span>
          <span className="card-text">
            <span className="card-name">{title}</span>
            <span className="card-cat">{spell.category}</span>
            <span className="card-desc">{desc}</span>
            {blockReason && interactive && <em className="card-block">{blockReason}</em>}
          </span>
        </div>
      )}
      {armed && onConfirm && (
        <button type="button" className="btn btn-primary btn-sm cast-confirm" onClick={onConfirm}>
          <Icon name="rune" scale={1} /> Kijátszás
        </button>
      )}
    </div>
  );
}

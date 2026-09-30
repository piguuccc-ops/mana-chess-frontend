// ─────────────────────────────────────────────────────────────────────────────
// Spell inspector: the full card – description, how to play it, rule notes –
// next to a looping demo on a small war table. Opened from the deck builder
// (with add / remove) and from the rule book's spell list.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { DECK_SIZE, SPELLS } from '../../engine';
import type { Spell, SpellId } from '../../engine';
import { sfx } from '../audio/sound';
import { costText } from '../format';
import { CrystalSprite, Icon, SpellIcon } from './pixel';
import { SpellDemo } from './SpellDemo';

export interface InspectorDeck {
  /** Cards in the deck being built. */
  count: number;
  inDeck: boolean;
  /** Why the card cannot be added right now (the deck is full, or its cost is at the limit). */
  blocked?: string | null;
  onToggle: () => void;
}

interface Props {
  spellId: SpellId;
  /** The spells the arrows step through (the library's current filter). */
  list: SpellId[];
  onNavigate: (id: SpellId) => void;
  onClose: () => void;
  reduced: boolean;
  /** Deck-builder mode: shows the deck count and the add / remove button. */
  deck?: InspectorDeck;
}

/** Timing and targeting rules worth knowing before playing the card. */
function ruleNotes(s: Spell): string[] {
  const out: string[] = [];
  if (s.costFor) out.push(`Az ára a célponttól függ${s.costLabel ? ` (${s.costLabel} mana)` : ''}.`);
  if (s.beforeMoveOnly) out.push('Csak a normál lépésed előtt használható.');
  if (s.needsNormalMove) out.push('Csak akkor, ha a normál lépésed még hátravan ebben a körben.');
  if (s.random) out.push('A kimenetele véletlenszerű.');
  if (s.ignoresWard) out.push('A Láthatatlanság sem véd ellene.');
  if (s.cycles) {
    const n = s.cycles === 1 ? 'egy' : s.cycles === 2 ? 'két' : String(s.cycles);
    out.push(`Körforgás: ${n} sima kijátszás után a lap feltöltődik, és amikor legközelebb a kezedbe kerül, felébredve játszhatod ki. A felébredt kijátszás után újra töltődik.`);
  }
  return out;
}

/** Height the demo may take so that the whole dialog still fits the window. */
function demoRoom(demo: HTMLElement): number | null {
  const dialog = demo.closest('.inspector');
  const body = demo.closest('.inspector-body');
  const box = demo.closest('.inspector-demo');
  if (!(dialog instanceof HTMLElement) || !(body instanceof HTMLElement) || !box) return null;
  const sum = (el: Element, props: string[]) => {
    const cs = getComputedStyle(el);
    return props.reduce((n, p) => n + (parseFloat(cs.getPropertyValue(p)) || 0), 0);
  };
  const overlay = dialog.parentElement ? sum(dialog.parentElement, ['padding-top', 'padding-bottom']) : 24;
  const around = dialog.offsetHeight - body.clientHeight; // frame + header
  const inside = sum(body, ['padding-top', 'padding-bottom']) + sum(box, ['padding-top', 'padding-bottom', 'border-top-width', 'border-bottom-width']);
  return window.innerHeight - overlay - around - inside;
}

export function SpellInspector({ spellId, list, onNavigate, onClose, reduced, deck }: Props) {
  const s = SPELLS[spellId];
  const idx = list.indexOf(spellId);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const notes = ruleNotes(s);

  const go = (d: number) => {
    if (list.length < 2) return;
    const i = idx < 0 ? 0 : (idx + d + list.length) % list.length;
    sfx('page');
    onNavigate(list[i]);
  };

  // focus moves into the dialog and back to the card when it closes
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const full = !!deck && !deck.inDeck && deck.count >= DECK_SIZE;
  /** Why „Pakliba” cannot work for this card (full deck, or the one-6 / one-5 limit). */
  const blocked = deck && !deck.inDeck ? deck.blocked ?? (full ? 'A pakli tele – előbb vegyél ki egy lapot.' : null) : null;
  /** Shown after trying to add a card the deck cannot take. */
  const [warn, setWarn] = useState(false);
  useEffect(() => setWarn(false), [spellId]);

  return (
    <div
      className="inspector-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="inspector frame-wood" data-cat={s.category} role="dialog" aria-modal="true" aria-labelledby="inspector-name" tabIndex={-1} ref={dialogRef}>
        <header className="inspector-head">
          <span className="inspector-cost" title={`${costText(s)} mana`}>
            <CrystalSprite color="w" state="full" scale={3} />
            <b>{costText(s)}</b>
          </span>
          <div className="inspector-heading" key={s.id}>
            <h2 id="inspector-name" className="inspector-name">
              <span className="gold-text">{s.name}</span>
            </h2>
            <span className="inspector-meta">
              <span className="cat-pip" /> {s.category}
              <span className="inspector-no">{s.number}. spell</span>
              {s.added && <span className="stamp-tag is-new">új</span>}
              {s.change && <span className="stamp-tag">módosítva</span>}
            </span>
          </div>
          <div className="inspector-actions">
            <div className="inspector-nav">
              <button type="button" className="btn btn-dark btn-icon" onClick={() => go(-1)} aria-label="Előző spell" title="Előző (←)" disabled={list.length < 2}>
                <Icon name="arrowLeft" scale={2} />
              </button>
              <span className="inspector-count">
                <b>{idx >= 0 ? idx + 1 : '–'}</b>/{list.length}
              </span>
              <button type="button" className="btn btn-dark btn-icon" onClick={() => go(1)} aria-label="Következő spell" title="Következő (→)" disabled={list.length < 2}>
                <Icon name="arrowRight" scale={2} />
              </button>
            </div>
            {deck && (
              <div className="inspector-deck">
                <span className="inspector-pips" role="img" aria-label={`Pakli: ${deck.count} / ${DECK_SIZE}`} title={full ? 'A pakli tele' : `Pakli: ${deck.count} / ${DECK_SIZE}`}>
                  {Array.from({ length: DECK_SIZE }, (_, i) => (
                    <span key={i} className={`deck-pip ${i < deck.count ? 'is-full' : ''}`} />
                  ))}
                </span>
                {warn && blocked && (
                  <span className="inspector-warn" role="status">
                    {blocked}
                  </span>
                )}
                {deck.inDeck ? (
                  <button type="button" className="btn btn-dark" onClick={deck.onToggle}>
                    <Icon name="close" scale={1} /> Kivétel
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    aria-disabled={!!blocked}
                    title={blocked ?? 'A lap a paklid végére kerül'}
                    onClick={() => {
                      setWarn(!!blocked);
                      deck.onToggle();
                    }}
                  >
                    <Icon name="plus" scale={1} /> Pakliba
                  </button>
                )}
              </div>
            )}
          </div>
          <button type="button" className="btn btn-iron btn-icon inspector-close" onClick={onClose} aria-label="Bezárás" title="Bezárás (Esc)">
            <Icon name="close" scale={2} />
          </button>
        </header>

        <div className="inspector-body">
          <section className="inspector-page frame-parchment" aria-label="A spell leírása" key={s.id}>
            <div className="inspector-art">
              <SpellIcon id={s.id} scale={6} />
            </div>
            <p className="inspector-desc">{s.description}</p>
            {s.awakened && (
              <p className="inspector-awake">
                <b>{s.awakened.name}:</b> {s.awakened.description}
              </p>
            )}
            <h3 className="inspector-h">
              <Icon name="scroll" scale={1} /> Kijátszás
            </h3>
            <ol className="inspector-steps">
              <li>Kattints a lapra a kezedben ({costText(s)} mana).</li>
              {s.steps.length ? (
                s.steps.map((st, i) => <li key={i}>{st.prompt}</li>)
              ) : (
                <li>Nincs célpontja: erősítsd meg a kijátszást, és azonnal hat.</li>
              )}
              {s.id === 'instantPromotion' && <li>Válaszd ki, mivé változzon: vezér, bástya, futó vagy huszár.</li>}
            </ol>
            {notes.length > 0 && (
              <ul className="inspector-notes">
                {notes.map((n) => (
                  <li key={n}>
                    <Icon name="info" scale={1} /> <span>{n}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.change && (
              <p className="inspector-change">
                <b>Módosítva:</b> {s.change.reason}
              </p>
            )}
            {s.added && <p className="inspector-change">{s.added.reason}</p>}
          </section>

          <section className="inspector-demo frame-slot" aria-label="Bemutató: így működik">
            <SpellDemo key={s.id} spell={s.id} reduced={reduced} room={demoRoom} />
          </section>
        </div>
      </div>
    </div>
  );
}

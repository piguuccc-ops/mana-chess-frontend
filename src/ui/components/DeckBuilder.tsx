import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_ORDER, COST_LIMITS, costLimitReason, DECK_SIZE, PRESET_DECKS, randomDeck, SPELL_LIST, SPELLS, validateDeck, type DeckDef,
} from '../../engine';
import type { SpellCategory, SpellId } from '../../engine';
import { sfx } from '../audio/sound';
import { costText, displayName } from '../format';
import { Icon, SpellIcon } from './pixel';
import { WarRoomScene } from './scenes';
import { SpellCard } from './SpellCard';
import { SpellInspector } from './SpellInspector';

/** Where a deck is kept: this browser, or the signed-in account on the server. */
export type DeckHome = 'local' | 'server';

interface Props {
  /** Decks saved in this browser. */
  customDecks: DeckDef[];
  /** The signed-in account's decks (null: nobody is signed in). */
  serverDecks: DeckDef[] | null;
  /** Who and where, for the „saved to” line (e.g. „Misu · Mana Chess”). */
  accountLabel: string | null;
  /** Save a deck; resolves to an error message, or a note when it could only be kept for this visit. */
  onSave: (deck: DeckDef, home: DeckHome) => Promise<{ error?: string; note?: string }>;
  onDelete: (id: string, home: DeckHome) => Promise<string | null>;
  onBack: () => void;
  reduced: boolean;
}

const newDeckId = (home: DeckHome) => `${home === 'server' ? 'acct' : 'custom'}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Flight {
  id: number;
  spell: SpellId;
  from: { x: number; y: number; w: number };
  to: { x: number; y: number; w: number };
}

/** How many cards fit on one page of the library (columns × rows) for the current size. */
function useGridFit(ref: { current: HTMLDivElement | null }) {
  const [fit, setFit] = useState({ cols: 4, rows: 2 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // phones: three short tiles a row (art and name – the text is in the card's inspector)
      const phone = w < 520 || (window.innerHeight < 560 && window.innerWidth > window.innerHeight);
      const gap = phone ? 10 : 16;
      const minW = phone ? 92 : 156;
      const cols = Math.max(2, Math.floor((w + gap) / (minW + gap)));
      const cardW = (w - (cols - 1) * gap) / cols;
      const cardH = cardW * (phone ? 5.8 / 5 : 7.4 / 5) + 10;
      const rows = Math.max(1, Math.floor((h + gap) / (cardH + gap)));
      setFit((f) => (f.cols === cols && f.rows === rows ? f : { cols, rows }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return fit;
}

export function DeckBuilder({ customDecks, serverDecks, accountLabel, onSave, onDelete, onBack, reduced }: Props) {
  // Opens with a copy of the starter deck so there is something to tweak right away.
  const [spells, setSpells] = useState<SpellId[]>(() => [...PRESET_DECKS[0].spells]);
  const [name, setName] = useState(`${PRESET_DECKS[0].name} (másolat)`);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Where the deck being edited lives (null: a new deck – it goes to the account when signed in). */
  const [home, setHome] = useState<DeckHome | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const target: DeckHome = home ?? (serverDecks ? 'server' : 'local');
  const [cat, setCat] = useState<SpellCategory | 'all'>('all');
  const [cost, setCost] = useState<number>(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  /** The card open in the inspector (description + demo). */
  const [inspect, setInspect] = useState<SpellId | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<HTMLOListElement | null>(null);
  const fit = useGridFit(gridRef);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPELL_LIST.filter(
      (s) =>
        (cat === 'all' || s.category === cat) &&
        (!cost || s.manaCost === cost) &&
        (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)),
    );
  }, [cat, cost, query]);

  const perPage = fit.cols * fit.rows;
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const current = Math.min(page, pages - 1);
  const shown = list.slice(current * perPage, current * perPage + perPage);
  useEffect(() => setPage(0), [cat, cost, query]);

  const turnPage = (d: number) => {
    const next = Math.max(0, Math.min(pages - 1, current + d));
    if (next !== current) {
      sfx('page');
      setPage(next);
    }
  };

  const flyToDeck = (id: SpellId, slotIndex: number) => {
    if (reduced) return;
    const card = document.querySelector(`.library [data-spell="${id}"] .card-face`) as HTMLElement | null;
    const slot = slotsRef.current?.children[slotIndex] as HTMLElement | undefined;
    if (!card || !slot) return;
    const a = card.getBoundingClientRect();
    const b = slot.getBoundingClientRect();
    const f: Flight = { id: Date.now(), spell: id, from: { x: a.left, y: a.top, w: a.width }, to: { x: b.left, y: b.top, w: b.height } };
    setFlights((fs) => [...fs, f]);
    window.setTimeout(() => setFlights((fs) => fs.filter((x) => x.id !== f.id)), 620);
  };

  const toggle = (id: SpellId, fly = true) => {
    setMessage(null);
    if (spells.includes(id)) {
      sfx('cardDrop');
      setSpells(spells.filter((s) => s !== id));
    } else if (spells.length >= DECK_SIZE) {
      sfx('illegal');
      setMessage({ tone: 'error', text: `A pakli tele van (${DECK_SIZE} spell). Előbb vegyél ki egyet.` });
    } else if (costLimitReason(spells, id)) {
      // one 6-mana and one 5-mana spell per deck
      sfx('illegal');
      setMessage({ tone: 'error', text: `${costLimitReason(spells, id)} Előbb vedd ki.` });
    } else {
      sfx('cardPick');
      if (fly) flyToDeck(id, spells.length);
      setSpells([...spells, id]);
    }
  };

  const load = (d: DeckDef, from: DeckHome | null = null) => {
    sfx('page');
    setSpells([...d.spells]);
    setName(d.preset ? `${d.name} (másolat)` : d.name);
    setEditingId(d.preset ? null : d.id);
    setHome(d.preset ? null : from);
    // a deck saved before a rule appeared: say what to fix
    const bad = validateDeck(d.spells);
    setMessage(bad ? { tone: 'error', text: `Ez a pakli így nem játszható: ${bad} Cseréld le a felesleges lapot, és mentsd el újra.` } : null);
  };

  const invalid = validateDeck(spells);
  const avg = spells.length ? spells.reduce((n, s) => n + SPELLS[s].manaCost, 0) / spells.length : 0;
  const curve = [1, 2, 3, 4, 5, 6].map((c) => spells.filter((s) => SPELLS[s].manaCost === c).length);
  /** A card the deck cannot take right now: it is full, or the card's cost is at its limit. */
  const blockedFor = (id: SpellId) => (spells.includes(id) ? null : spells.length >= DECK_SIZE ? 'A pakli tele – előbb vegyél ki egy lapot.' : costLimitReason(spells, id));

  const save = async () => {
    if (invalid || busy) return;
    const deck: DeckDef = {
      id: editingId ?? newDeckId(target),
      name: name.trim() || 'Névtelen pakli',
      description: `Saját pakli · átlag ${avg.toFixed(1)} mana`,
      spells: [...spells],
    };
    setBusy('save');
    const r = await onSave(deck, target);
    setBusy(null);
    if (r.error) {
      sfx('illegal');
      setMessage({ tone: 'error', text: r.error });
      return;
    }
    setEditingId(deck.id);
    setHome(target);
    sfx('holy');
    setMessage({ tone: 'ok', text: r.note ?? (target === 'server' ? `„${deck.name}” elmentve a fiókodba.` : `„${deck.name}” elmentve ebben a böngészőben.`) });
  };

  /** A browser deck copied into the signed-in account (it stays in the browser too). */
  const upload = async (d: DeckDef) => {
    if (busy) return;
    setBusy(`up:${d.id}`);
    const r = await onSave({ ...d, id: newDeckId('server') }, 'server');
    setBusy(null);
    if (r.error) {
      sfx('illegal');
      setMessage({ tone: 'error', text: r.error });
    } else {
      sfx('holy');
      setMessage({ tone: 'ok', text: `„${d.name}” feltöltve a fiókodba.` });
    }
  };

  const remove = async (d: DeckDef, from: DeckHome) => {
    if (busy) return;
    setBusy(`del:${d.id}`);
    const err = await onDelete(d.id, from);
    setBusy(null);
    if (err) {
      setMessage({ tone: 'error', text: err });
      return;
    }
    if (editingId === d.id && home === from) {
      setEditingId(null);
      setHome(null);
    }
  };

  const deckRow = (d: DeckDef, from: DeckHome) => {
    const bad = validateDeck(d.spells);
    return (
      <li key={`${from}-${d.id}`}>
        <button type="button" className={`deck-row ${bad ? 'is-invalid' : ''} ${editingId === d.id && home === from ? 'is-editing' : ''}`} onClick={() => load(d, from)} title={bad ? `Javítandó: ${bad}` : undefined}>
          <b>{d.name}</b>
          {bad && <span className="deck-row-flag">javítandó</span>}
          <span className="deck-row-icons">
            {d.spells.map((s) => (
              <SpellIcon key={s} id={s} scale={1} />
            ))}
          </span>
        </button>
        {from === 'local' && serverDecks && !bad && (
          <button type="button" className="btn btn-sm btn-icon" aria-label={`${d.name} feltöltése a fiókodba`} title="Feltöltés a fiókodba" disabled={!!busy} onClick={() => void upload(d)}>
            <Icon name="globe" scale={1} />
          </button>
        )}
        <button type="button" className="btn btn-sm btn-icon btn-danger" aria-label={`${d.name} törlése`} disabled={!!busy} onClick={() => void remove(d, from)}>
          <Icon name="trash" scale={1} />
        </button>
      </li>
    );
  };

  const full = spells.length >= DECK_SIZE;

  return (
    <div className="builder-screen">
      <WarRoomScene reduced={reduced} dim={0.45} />
      <div className="builder frame-wood">
        <header className="builder-head">
          <button type="button" className="btn btn-dark" onClick={onBack}>
            <Icon name="back" scale={1} /> Menü
          </button>
          <div className="builder-title">
            <Icon name="cards" scale={3} />
            <h1 className="gold-text t-display-2">Pakliépítő</h1>
          </div>
          <button
            type="button"
            className="deck-meter"
            aria-label={`Pakli: ${spells.length} / ${DECK_SIZE} – ugrás a paklihoz`}
            onClick={() => slotsRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })}
          >
            {Array.from({ length: DECK_SIZE }, (_, i) => (
              <span key={i} className={`deck-pip ${i < spells.length ? 'is-full' : ''}`}>
                {spells[i] && <SpellIcon id={spells[i]} scale={1} />}
              </span>
            ))}
            <b>
              {spells.length}/{DECK_SIZE}
            </b>
          </button>
        </header>

        <div className="builder-body">
          <section className="library" aria-label="Összes spell">
            <div className="library-tools">
              <div className="tabs" role="tablist" aria-label="Kategória">
                <button type="button" role="tab" aria-selected={cat === 'all'} className="tab" onClick={() => setCat('all')}>
                  Mind
                </button>
                {CATEGORY_ORDER.map((c) => (
                  <button key={c} type="button" role="tab" aria-selected={cat === c} className="tab" data-cat={c} onClick={() => setCat(c)}>
                    <span className="cat-pip" />
                    {c}
                  </button>
                ))}
              </div>
              <div className="library-row">
                <div className="cost-filter" role="group" aria-label="Mana költség">
                  <button type="button" className={`cost-gem-btn ${!cost ? 'is-on' : ''}`} onClick={() => setCost(0)}>
                    Mind
                  </button>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <button key={c} type="button" className={`cost-gem-btn gem ${cost === c ? 'is-on' : ''}`} aria-label={`${c} mana`} onClick={() => setCost(cost === c ? 0 : c)}>
                      {c}
                    </button>
                  ))}
                </div>
                <label className="field search" htmlFor="spell-search">
                  <Icon name="search" scale={1} />
                  <input id="spell-search" type="search" placeholder="Keresés név vagy leírás alapján…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Spell keresése" />
                </label>
              </div>
            </div>
            <div className="card-grid" ref={gridRef} style={{ ['--cols' as string]: fit.cols }}>
              <div className="card-grid-page" key={`${current}-${cat}-${cost}-${query}`}>
                {shown.map((s, i) => (
                  <div key={s.id} className="card-slot" style={{ ['--i' as string]: i }}>
                    <SpellCard
                      spell={s}
                      cost={s.manaCost}
                      blockReason={null}
                      interactive
                      size="tile"
                      selected={spells.includes(s.id)}
                      unavailable={blockedFor(s.id) !== null}
                      onClick={() => setInspect(s.id)}
                      onQuick={() => toggle(s.id)}
                    />
                  </div>
                ))}
                {list.length === 0 && <p className="empty-note frame-parchment">Nincs a szűrésnek megfelelő spell.</p>}
              </div>
            </div>
            <nav className="pager" aria-label="Oldalak">
              <button type="button" className="btn btn-dark btn-icon" aria-label="Előző oldal" disabled={current === 0} onClick={() => turnPage(-1)}>
                <Icon name="arrowLeft" scale={2} />
              </button>
              <span className="pager-label">
                <b>
                  {current + 1} / {pages}
                </b>
                <small>{full ? 'A pakli tele – vegyél ki egy lapot' : `${list.length} spell · kattints a bemutatóért`}</small>
              </span>
              <button type="button" className="btn btn-dark btn-icon" aria-label="Következő oldal" disabled={current >= pages - 1} onClick={() => turnPage(1)}>
                <Icon name="arrowRight" scale={2} />
              </button>
            </nav>
          </section>

          <aside className="spellbook frame-parchment" aria-label="Pakli">
            <label className="field-label" htmlFor="deck-name">
              Pakli neve
            </label>
            <div className="field">
              <Icon name="quill" scale={1} />
              <input id="deck-name" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
            </div>
            <ol className="slots" ref={slotsRef}>
              {Array.from({ length: DECK_SIZE }, (_, i) => {
                const id = spells[i];
                const sp = id ? SPELLS[id] : null;
                return (
                  <li key={i} className={`slot ${sp ? 'is-full' : ''} ${i < 3 ? 'is-hand' : ''}`} data-cat={sp?.category}>
                    <span className="slot-no">{i + 1}</span>
                    {sp ? (
                      <>
                        <span className="slot-icon">
                          <SpellIcon id={sp.id} scale={2} />
                        </span>
                        <span className="slot-name">{displayName(sp)}</span>
                        <span className="slot-cost">{costText(sp)}</span>
                        <button type="button" className="slot-remove" aria-label={`${sp.name} eltávolítása`} onClick={() => toggle(sp.id)}>
                          <Icon name="close" scale={1} />
                        </button>
                      </>
                    ) : (
                      <span className="slot-empty">üres hely</span>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="deck-stats">
              <div className="curve" aria-label="Mana-görbe">
                {curve.map((n, i) => {
                  const cap = COST_LIMITS[i + 1];
                  return (
                    <span
                      key={i}
                      className={`curve-col ${cap !== undefined ? 'is-capped' : ''} ${cap !== undefined && n > cap ? 'is-over' : ''}`}
                      title={cap !== undefined ? `${i + 1} manás spellből legfeljebb ${cap === 1 ? 'egy' : cap} lehet a pakliban` : undefined}
                    >
                      <span className="curve-bar" style={{ height: `${n * 12}px` }} />
                      <small>{i + 1}</small>
                    </span>
                  );
                })}
              </div>
              <div className="deck-stats-text">
                <b>
                  {spells.length}/{DECK_SIZE} spell
                </b>
                <span>Átlag: {avg.toFixed(1)} mana</span>
              </div>
            </div>
            <p className="hint">
              Az első 3 lap a kezdő kezed. Kijátszás után a lap a pakli végére kerül. Legfeljebb egy 6 és egy 5 manás spell lehet a
              pakliban.
            </p>
            {message && (
              <p className={`msg msg-${message.tone}`} role="status">
                {message.text}
              </p>
            )}
            <p className="save-home">
              <Icon name={target === 'server' ? 'globe' : 'book'} scale={1} />
              {target === 'server' ? `Mentés a fiókodba${accountLabel ? ` (${accountLabel})` : ''}` : serverDecks ? 'Mentés ebbe a böngészőbe (a pakli innen való)' : 'Mentés ebbe a böngészőbe'}
            </p>
            <div className="editor-actions">
              <button type="button" className="btn btn-primary" id="deck-save" disabled={!!invalid || !!busy} onClick={() => void save()} title={invalid ?? ''}>
                <Icon name="quill" scale={1} /> {busy === 'save' ? 'Mentés…' : 'Mentés'}
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => {
                  sfx('arcane');
                  setSpells(randomDeck());
                  setEditingId(null);
                  setHome(null);
                  setName('Véletlen pakli');
                  setMessage({ tone: 'ok', text: 'Véletlen pakli összerakva – cserélj benne, ami nem tetszik, vagy dobj újra.' });
                }}
              >
                <Icon name="dice" scale={1} /> Véletlen
              </button>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => {
                  setSpells([]);
                  setEditingId(null);
                  setHome(null);
                  setName('Saját pakli');
                  setMessage(null);
                }}
              >
                <Icon name="plus" scale={1} /> Új
              </button>
            </div>

            <h3 className="section-title">Előre elkészített paklik</h3>
            <ul className="deck-list">
              {PRESET_DECKS.map((d) => (
                <li key={d.id}>
                  <button type="button" className="deck-row" onClick={() => load(d)}>
                    <b>{d.name}</b>
                    <span className="deck-row-icons">
                      {d.spells.map((s) => (
                        <SpellIcon key={s} id={s} scale={1} />
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {serverDecks && (
              <>
                <h3 className="section-title">
                  <Icon name="globe" scale={1} /> A fiókod paklijai
                </h3>
                <ul className="deck-list" id="server-decks">
                  {serverDecks.length === 0 && <li className="empty">Még nincs pakli a fiókodban – amit most mentesz, ide kerül.</li>}
                  {serverDecks.map((d) => deckRow(d, 'server'))}
                </ul>
              </>
            )}
            <h3 className="section-title">{serverDecks ? 'Ebben a böngészőben' : 'Saját paklik'}</h3>
            <ul className="deck-list" id="local-decks">
              {customDecks.length === 0 && <li className="empty">{serverDecks ? 'Nincs pakli ebben a böngészőben.' : 'Még nincs mentett paklid.'}</li>}
              {customDecks.map((d) => deckRow(d, 'local'))}
            </ul>
            {serverDecks && customDecks.length > 0 && <p className="hint">A földgömb gomb feltölti a böngészős paklit a fiókodba – így bármelyik eszközről eléred, és online is azzal játszhatsz.</p>}
          </aside>
        </div>
      </div>
      {flights.map((f) => (
        <span
          key={f.id}
          className="card-flight"
          style={{
            left: `${f.from.x}px`,
            top: `${f.from.y}px`,
            width: `${f.from.w}px`,
            // percentages would resolve against the viewport (fixed position), so the inset is in px
            padding: `${Math.round(f.from.w * 0.18)}px`,
            ['--dx' as string]: `${f.to.x - f.from.x}px`,
            ['--dy' as string]: `${f.to.y - f.from.y}px`,
            ['--s' as string]: `${f.to.w / f.from.w}`,
          }}
          aria-hidden="true"
        >
          <SpellIcon id={f.spell} fill />
        </span>
      ))}
      {inspect && (
        <SpellInspector
          spellId={inspect}
          list={list.map((s) => s.id)}
          onNavigate={setInspect}
          onClose={() => {
            // leave the library open on the page of the last card looked at
            const i = list.findIndex((s) => s.id === inspect);
            if (i >= 0) setPage(Math.floor(i / perPage));
            setInspect(null);
          }}
          reduced={reduced}
          deck={{ count: spells.length, inDeck: spells.includes(inspect), blocked: blockedFor(inspect), onToggle: () => toggle(inspect, false) }}
        />
      )}
    </div>
  );
}

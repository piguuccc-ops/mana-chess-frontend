// ─────────────────────────────────────────────────────────────────────────────
// Spell-toborzás: the draft table. 32 spells on an 8 × 4 table (4 × 8 on a phone); the players
// take one each in turn until both have 6 – the order taken is the deck's order.
//
//   DraftBoard           the table itself (what is shown, what may be picked)
//   LocalDraft           one machine: two players in turn, or a player against the AI
//   OnlineDraftScreen    an online room: picks go to the server, the opponent's come back
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import {
  applyPick, DECK_SIZE, draftDone, draftTurn, HAND_SIZE, pickBlockReason, pickLimitReason, SPELLS, takenBy, type Color, type Draft, type SpellId,
} from '../../engine';
import { aiDraftPick } from '../../ai/draftAI';
import { sfx } from '../audio/sound';
import type { Connection } from '../../net/client';
import { costText, displayName, stripEmoji } from '../format';
import { gameFromStart, type OnlineDraft, type OnlineGame } from '../netSync';
import { Icon, SpellIcon } from './pixel';
import { SpellInspector } from './SpellInspector';

const COLOR_WORD: Record<Color, string> = { w: 'Világos', b: 'Sötét' };

interface BoardProps {
  draft: Draft;
  names: Record<Color, string>;
  /** Whether this screen picks for a colour (both: one machine, two players). */
  mine: (c: Color) => boolean;
  /** Shown while the other side chooses (the AI, the opponent online). */
  waiting: string | null;
  onPick: (id: SpellId) => void;
  onLeave: () => void;
  leaveLabel: string;
  reduced: boolean;
  /** A pick is on its way to the server. */
  busy?: boolean;
  /** The last spell taken (a short highlight). */
  last?: { id: SpellId; by: Color } | null;
  /** A line about the connection (online). */
  note?: string | null;
}

/** The draft table: the two decks growing, the 32 spells, the chosen card and its button. */
export function DraftBoard({ draft, names, mine, waiting, onPick, onLeave, leaveLabel, reduced, busy, last, note }: BoardProps) {
  const [selected, setSelected] = useState<SpellId | null>(null);
  const [inspect, setInspect] = useState<SpellId | null>(null);
  // the cards are dealt once, when the table appears (not again on every change)
  const [dealing, setDealing] = useState(!reduced);
  useEffect(() => {
    const t = window.setTimeout(() => setDealing(false), 1200);
    return () => window.clearTimeout(t);
  }, []);
  const turn = draftTurn(draft);
  const done = turn === null;
  const picking = turn !== null && mine(turn) && !busy;
  const round = draft.picks.w.length + draft.picks.b.length;

  // a card that has just been taken is no longer the one to pick
  useEffect(() => {
    if (selected && takenBy(draft, selected)) setSelected(null);
  }, [draft, selected]);

  const sel = selected ? SPELLS[selected] : null;
  const selWhy = selected && turn ? (mine(turn) ? pickBlockReason(draft, turn, selected) : null) : null;
  const choose = (id: SpellId) => {
    sfx('open');
    setSelected(id === selected ? null : id);
  };
  const pick = () => {
    if (!selected || !picking || selWhy) return;
    onPick(selected);
    setSelected(null);
  };
  const oneMachine = mine('w') && mine('b');

  let prompt: string;
  if (done) prompt = 'A toborzás kész – indul a csata!';
  else if (!mine(turn!)) prompt = waiting ?? `${names[turn!]} választ…`;
  else if (oneMachine) prompt = `${COLOR_WORD[turn!]} választ: jelölj ki egy spellt, majd Kiválasztom.`;
  else prompt = 'Te választasz: jelölj ki egy spellt az asztalon, majd Kiválasztom.';

  return (
    <div className={`draft-screen ${reduced ? 'is-still' : ''} ${done ? 'is-done' : ''}`}>
      <header className="draft-head">
        <button type="button" className="btn btn-iron" onClick={onLeave}>
          <Icon name="back" scale={2} /> {leaveLabel}
        </button>
        <h1 className="draft-title">
          <Icon name="cards" scale={3} /> <span className="gold-text">Spell-toborzás</span>
        </h1>
        <span className="draft-round" aria-label={`${Math.min(round + 1, DECK_SIZE * 2)}. választás a ${DECK_SIZE * 2}-ből`}>
          {done ? 'Kész' : `${round + 1} / ${DECK_SIZE * 2}`}
        </span>
      </header>

      <div className="draft-players">
        {(['w', 'b'] as const).map((c) => (
          <section key={c} className={`draft-player frame-parchment ${turn === c ? 'is-turn' : ''}`} aria-label={`${COLOR_WORD[c]}: ${names[c]}`}>
            <span className="draft-player-who">
              <Icon name={c === 'w' ? 'crestW' : 'crestB'} scale={2} />
              <span>
                <b>{names[c]}</b>
                <small>
                  {names[c] === COLOR_WORD[c] ? '' : `${COLOR_WORD[c]} · `}
                  {draft.picks[c].length}/{DECK_SIZE}
                  {turn === c ? ' · választ' : ''}
                </small>
              </span>
            </span>
            <ol className="draft-slots">
              {Array.from({ length: DECK_SIZE }, (_, i) => {
                const id = draft.picks[c][i];
                return (
                  <li key={i} className={`draft-slot ${i < HAND_SIZE ? 'is-hand' : ''} ${id ? 'is-full' : ''}`} data-cat={id ? SPELLS[id].category : undefined} title={id ? `${i + 1}. ${SPELLS[id].name}` : `${i + 1}. hely${i < HAND_SIZE ? ' (kezdő kéz)' : ''}`}>
                    {id ? (
                      <button type="button" onClick={() => choose(id)} aria-label={`${i + 1}. ${SPELLS[id].name}`}>
                        <SpellIcon id={id} scale={2} />
                      </button>
                    ) : (
                      <span className="draft-slot-no">{i + 1}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <p className={`draft-prompt ${picking ? 'is-mine' : ''}`} aria-live="polite">
        {prompt}
        {note && <small> {note}</small>}
      </p>

      <div className={`draft-grid ${dealing ? 'is-dealing' : ''}`} role="group" aria-label="A spellek asztala">
        {draft.pool.map((id, i) => {
          const sp = SPELLS[id];
          const by = takenBy(draft, id);
          // greyed out: a spell the picking side can never take (its deck's cost limit)
          const blocked = !by && turn !== null && mine(turn) && pickLimitReason(draft, turn, id) !== null;
          const cls = ['draft-card', by ? `is-taken by-${by}` : '', blocked ? 'is-blocked' : '', selected === id ? 'is-selected' : '', last?.id === id ? 'is-last' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={id}
              type="button"
              className={cls}
              data-cat={sp.category}
              data-spell={id}
              style={{ ['--i' as string]: i }}
              aria-pressed={selected === id}
              aria-label={`${sp.name}, ${costText(sp)} mana, ${sp.category}${by ? ` – ${COLOR_WORD[by]} vitte el` : blocked ? ' – nem fér a paklidba' : ''}`}
              onClick={() => choose(id)}
            >
              <span className="draft-card-cost cost-gem">{costText(sp)}</span>
              <SpellIcon id={id} scale={3} className="draft-card-art" />
              <span className="draft-card-name">{displayName(sp)}</span>
              {by && (
                <span className="draft-card-stamp" aria-hidden="true">
                  <Icon name={by === 'w' ? 'crestW' : 'crestB'} scale={1} />
                </span>
              )}
              {blocked && (
                <span className="draft-card-lock" aria-hidden="true">
                  <Icon name="lock" scale={1} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="draft-bar frame-wood">
        {sel ? (
          <div className="draft-detail frame-parchment" data-cat={sel.category}>
            <SpellIcon id={sel.id} scale={3} />
            <div className="draft-detail-text">
              <b>
                {sel.name} <span className="cost-gem">{costText(sel)}</span> <small>{sel.category}</small>
              </b>
              <p>{stripEmoji(sel.description)}</p>
              {selWhy && !takenBy(draft, sel.id) && <p className="draft-why">{selWhy}</p>}
              {takenBy(draft, sel.id) && <p className="draft-why">{COLOR_WORD[takenBy(draft, sel.id)!]} vitte el.</p>}
            </div>
            <div className="draft-detail-actions">
              <button type="button" className="btn btn-sm" onClick={() => setInspect(sel.id)}>
                <Icon name="eye" scale={1} /> Bemutató
              </button>
              <button type="button" id="draft-pick" className="btn btn-primary" disabled={!picking || !!selWhy || !!takenBy(draft, sel.id)} onClick={pick}>
                <Icon name="check" scale={1} /> Kiválasztom
              </button>
            </div>
          </div>
        ) : (
          <p className="draft-hint">
            {done
              ? 'Mindkét pakli kész.'
              : 'Kattints egy spellre a leírásáért. A választásaid sorrendje a paklid sorrendje: az első három lesz a kezdő kezed. Egy pakliban legfeljebb egy 6 és egy 5 manás spell lehet.'}
          </p>
        )}
      </div>

      {inspect && <SpellInspector spellId={inspect} list={draft.pool} onNavigate={setInspect} onClose={() => setInspect(null)} reduced={reduced} />}
    </div>
  );
}

// ── One machine: two players, or a player (Világos) and the AI (Sötét) ─────────

export function LocalDraft({
  initial, vsAi, onDone, onLeave, reduced,
}: { initial: Draft; vsAi: boolean; onDone: (picks: Record<Color, SpellId[]>) => void; onLeave: () => void; reduced: boolean }) {
  const [draft, setDraft] = useState(initial);
  const [last, setLast] = useState<{ id: SpellId; by: Color } | null>(null);
  const ai: Color | null = vsAi ? 'b' : null;
  const turn = draftTurn(draft);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // the AI takes its card after a short think
  useEffect(() => {
    if (!ai || turn !== ai) return;
    const t = window.setTimeout(() => {
      const id = aiDraftPick(draft, ai);
      if (!id) return;
      sfx('cardPick');
      setDraft((d) => applyPick(d, ai, id));
      setLast({ id, by: ai });
    }, reduced ? 250 : 850);
    return () => window.clearTimeout(t);
  }, [draft, ai, turn, reduced]);

  // both decks full: a moment to look, then the battle
  useEffect(() => {
    if (!draftDone(draft)) return;
    sfx('turn');
    const t = window.setTimeout(() => onDoneRef.current(draft.picks), reduced ? 300 : 1400);
    return () => window.clearTimeout(t);
  }, [draft, reduced]);

  const pick = (id: SpellId) => {
    const who = draftTurn(draft);
    if (!who || who === ai || pickBlockReason(draft, who, id)) return;
    sfx('cardPick');
    setDraft(applyPick(draft, who, id));
    setLast({ id, by: who });
  };

  return (
    <DraftBoard
      draft={draft}
      names={vsAi ? { w: 'Te', b: 'AI' } : { w: 'Világos', b: 'Sötét' }}
      mine={(c) => c !== ai}
      waiting={ai && turn === ai ? 'Az AI választ…' : null}
      onPick={pick}
      onLeave={onLeave}
      leaveLabel="Menü"
      reduced={reduced}
      last={last}
    />
  );
}

// ── Online: the server keeps the draft, both players see every pick ────────────

export function OnlineDraftScreen({
  od, onGame, onLeave, notify, reduced,
}: {
  od: OnlineDraft;
  /** The drafted game has begun. */
  onGame: (g: OnlineGame) => void;
  onLeave: () => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
  reduced: boolean;
}) {
  const [draft, setDraftState] = useState(od.draft);
  const draftRef = useRef(od.draft);
  const setDraft = (d: Draft) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ id: SpellId; by: Color } | null>(null);
  const [opOnline, setOpOnline] = useState(od.opponentOnline);
  const opOnlineRef = useRef(opOnline);
  opOnlineRef.current = opOnline;
  const [closed, setClosed] = useState<string | null>(null);
  const [link, setLink] = useState<Connection>(od.session.connection);
  const hooks = useRef({ onGame, notify });
  hooks.current = { onGame, notify };
  const other: Color = od.me === 'w' ? 'b' : 'w';

  /** Asks the server for the draft as it stands (after a refused pick, or a gap). */
  const resync = async () => {
    try {
      const r = await od.session.state();
      if (r.ok && r.state.game === od.game && r.state.draft) setDraft(r.state.draft);
      else if (!r.ok) setClosed(r.error);
    } catch {
      /* the stream will catch up */
    }
  };

  useEffect(() => {
    let started = false;
    let timer = 0;
    const offs = [
      od.session.subscribe(od.fromEvent, (e) => {
        if (e.type === 'pick' && e.game === od.game) {
          const d = draftRef.current;
          if (d.picks[e.by].includes(e.spell)) return; // our own pick, already on the table
          if (pickBlockReason(d, e.by, e.spell) !== null) return void resync();
          setDraft(applyPick(d, e.by, e.spell));
          if (e.by !== od.me) {
            sfx('cardPick');
            setLast({ id: e.spell, by: e.by });
          }
        } else if (e.type === 'start' && e.game === od.game && !started) {
          started = true;
          sfx('turn');
          const g = gameFromStart({ session: od.session, code: od.code, role: od.role }, e, opOnlineRef.current);
          // the finished table stays a moment on screen
          timer = window.setTimeout(() => hooks.current.onGame(g), reduced ? 250 : 1300);
        } else if (e.type === 'presence' && e.role !== od.role) {
          setOpOnline(e.online);
          if (e.online) hooks.current.notify(`${od.names[other]} visszatért.`);
        } else if (e.type === 'left' && e.role !== od.role) {
          hooks.current.notify(`${e.name} kilépett a szobából.`, 'error');
        } else if (e.type === 'closed') {
          setClosed(e.reason);
        }
      }),
      od.session.onConnection(setLink),
    ];
    return () => {
      offs.forEach((off) => off());
      window.clearTimeout(timer);
    };
    // one subscription per draft
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [od]);

  const pick = async (id: SpellId) => {
    const d = draftRef.current;
    if (busy || closed || draftTurn(d) !== od.me || pickBlockReason(d, od.me, id)) return;
    setBusy(true);
    sfx('cardPick');
    setDraft(applyPick(d, od.me, id)); // shown at once; the server confirms it in the stream
    setLast({ id, by: od.me });
    try {
      const r = await od.session.pick({ game: od.game, spell: id });
      if (!r.ok) {
        notify(r.error, 'error');
        await resync();
      }
    } catch {
      notify('Nem érem el a szervert – próbáld újra.', 'error');
      setDraft(d);
    } finally {
      setBusy(false);
    }
  };

  const note = closed
    ? closed
    : link !== 'online'
      ? 'Kapcsolódás a szerverhez…'
      : !opOnline && !draftDone(draft)
        ? `${od.names[other]} kapcsolata megszakadt – várjuk vissza.`
        : null;

  return (
    <DraftBoard
      draft={draft}
      names={{ ...od.names, [od.me]: `${od.names[od.me]} (te)` } as Record<Color, string>}
      mine={(c) => c === od.me && !closed}
      waiting={closed ? 'A szoba bezárult.' : null}
      onPick={(id) => void pick(id)}
      onLeave={onLeave}
      leaveLabel="Kilépés"
      reduced={reduced}
      busy={busy}
      last={last}
      note={note}
    />
  );
}

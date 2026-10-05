// The bots' hall (chess.com style): pick an opponent from Kende the genius (100) to Oli the phone
// taker (3000) – portrait, Elo, who they are, what they say – choose your colour and deck, fight.
import { useEffect, useRef } from 'react';
import { PERSONAS } from '../../bots/chat';
import { BOT_IDS, BOTS, botFullName, type BotId } from '../../bots/roster';
import type { DeckDef } from '../../engine';
import { sfx } from '../audio/sound';
import type { BotRecord, Prefs } from '../storage';
import { BotPortrait, EloBadge } from './BotPortrait';
import { DeckCarousel } from './DeckCarousel';
import { DeckModeChoices } from './DeckModeChoices';
import { Icon } from './pixel';

const TIER_NAME: Record<string, string> = { bronze: 'Bronz', silver: 'Ezüst', gold: 'Arany', diamond: 'Gyémánt', legend: 'Legenda' };

/** A line the bot would say at the start (the picker shows one, so you know who you are dealing with). */
function teaser(id: BotId): string {
  const l = PERSONAS[id].lines;
  const pool = l.intro ?? l['intro@desktop'] ?? l.chatter ?? [];
  return pool.find((x) => x.length > 12 && !x.includes('{')) ?? pool[0] ?? '';
}

export function BotPicker({
  decks, prefs, onPrefs, record, onStart, onBack, reduced,
}: {
  decks: DeckDef[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  record: BotRecord;
  onStart: () => void;
  onBack: () => void;
  reduced: boolean;
}) {
  const sel = BOTS[prefs.botId];
  const rec = record[sel.id];
  const detailRef = useRef<HTMLElement | null>(null);
  const pick = (id: BotId) => {
    if (id === prefs.botId) return;
    sfx('page');
    onPrefs({ ...prefs, botId: id });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
      const i = BOT_IDS.indexOf(prefs.botId);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') pick(BOT_IDS[Math.min(BOT_IDS.length - 1, i + 1)]);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') pick(BOT_IDS[Math.max(0, i - 1)]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={`bots-screen ${reduced ? 'is-still' : ''}`}>
      <header className="bots-head">
        <button type="button" className="btn btn-iron" onClick={onBack}>
          <Icon name="back" scale={2} /> Menü
        </button>
        <h1 className="bots-title">
          <Icon name="swords" scale={3} /> <span className="gold-text">Botok elleni csata</span>
        </h1>
        <span className="bots-head-spacer" />
      </header>

      <div className="bots-body">
        <section className="bots-roster frame-wood" aria-label="Botok">
          <ol className="bots-grid" role="listbox" aria-label="Válassz ellenfelet">
            {BOT_IDS.map((id) => {
              const b = BOTS[id];
              const r = record[id];
              return (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={id === prefs.botId}
                    className={`bot-card tier-${b.tier} ${id === prefs.botId ? 'is-selected' : ''}`}
                    data-bot={id}
                    onClick={() => pick(id)}
                    style={{ '--accent': b.accent } as Record<string, string>}
                  >
                    <BotPortrait id={id} scale={2} />
                    <span className="bot-card-text">
                      <b>{b.name}</b>
                      <small>{b.title}</small>
                    </span>
                    <EloBadge elo={b.elo} tier={b.tier} />
                    {r && r.w > 0 && (
                      <span className="bot-card-beaten" title={`Legyőzted ${r.w}×`}>
                        <Icon name="crown" scale={1} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="bots-detail frame-wood" ref={detailRef} aria-live="polite" aria-label={botFullName(sel)} style={{ '--accent': sel.accent } as Record<string, string>}>
          <div className="bots-hero frame-parchment" key={sel.id}>
            <BotPortrait id={sel.id} scale={4} className="bots-hero-portrait" />
            <div className="bots-hero-text">
              <h2>
                {sel.name} <span>{sel.title}</span>
              </h2>
              <p className="bots-hero-meta">
                <EloBadge elo={sel.elo} tier={sel.tier} /> <span className={`tier-chip tier-${sel.tier}`}>{TIER_NAME[sel.tier]}</span>
                {rec && (
                  <span className="bots-record" title="Az eredményeid ellene ezen az eszközön">
                    {rec.w} győzelem · {rec.l} vereség{rec.d ? ` · ${rec.d} döntetlen` : ''}
                  </span>
                )}
              </p>
              <p className="bots-bio">{sel.bio}</p>
              <blockquote className="bots-quote">„{teaser(sel.id)}”</blockquote>
            </div>
          </div>

          <div className="bots-setup frame-parchment">
            <h3 className="section-title">A te színed</h3>
            <div className="choices choices-3" role="radiogroup" aria-label="A te színed">
              {(
                [
                  ['w', 'Világos', 'crestW', 'Te kezdesz'],
                  ['b', 'Sötét', 'crestB', 'A bot kezd'],
                  ['random', 'Sorsolás', 'dice', 'Véletlenszerű'],
                ] as const
              ).map(([v, label, icon, sub]) => (
                <button key={v} type="button" role="radio" aria-checked={prefs.botColor === v} className="choice" onClick={() => onPrefs({ ...prefs, botColor: v })}>
                  <Icon name={icon} scale={2} />
                  <b>{label}</b>
                  <small>{sub}</small>
                </button>
              ))}
            </div>
            <h3 className="section-title">Paklik</h3>
            <DeckModeChoices draft={prefs.botDraft} onChange={(botDraft) => onPrefs({ ...prefs, botDraft })} />
            {prefs.botDraft ? (
              <p className="hint">32 véletlen spell kerül az asztalra; te és {sel.name} felváltva választotok, amíg mindkettőtöknek 6 lesz – Világos kezd.</p>
            ) : (
              <div className="carousels">
                <DeckCarousel side="any" label="A te paklid" value={prefs.botDeckId} decks={decks} onChange={(id) => onPrefs({ ...prefs, botDeckId: id })} />
                <p className="hint bots-deck-hint">
                  <Icon name="dice" scale={1} /> {sel.name} minden csatára véletlen paklit kap.
                </p>
              </div>
            )}
            <h3 className="section-title">Kör vége</h3>
            <div className="choices" role="radiogroup" aria-label="Kör vége">
              <button type="button" role="radio" aria-checked={prefs.autoEndTurn} className="choice" onClick={() => onPrefs({ ...prefs, autoEndTurn: true })}>
                <Icon name="hourglass" scale={2} />
                <b>Automatikus</b>
                <small>A lépés befejezi a kört</small>
              </button>
              <button type="button" role="radio" aria-checked={!prefs.autoEndTurn} className="choice" onClick={() => onPrefs({ ...prefs, autoEndTurn: false })}>
                <Icon name="quill" scale={2} />
                <b>Kézi</b>
                <small>Lépés után is varázsolhatsz</small>
              </button>
            </div>
            <p className="bots-note">
              <Icon name="scales" scale={1} /> A botok elleni játszmák nem változtatják az Élő-pontszámodat – azt csak a rangsorolt online játszmák.
            </p>
          </div>

          <div className="bots-actions">
            <button type="button" id="start-bot" className="btn btn-primary btn-big" onClick={onStart}>
              <Icon name="swords" scale={2} /> Csatába {sel.name} ellen!
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

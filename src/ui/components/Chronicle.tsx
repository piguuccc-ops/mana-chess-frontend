// The right-hand side of the war table: the battle report („Történet”) written
// on parchment, the move list, and the active effects with their durations.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COLOR_NAME_HU } from '../../engine';
import type { Effect, GameState, LogEntry } from '../../engine';
import { cleanSan, describeEffect, remainingText, stripEmoji } from '../format';
import { Icon, SpellIcon, type IconName } from './pixel';

const KIND_ICON: Record<LogEntry['kind'], IconName> = {
  move: 'boot',
  capture: 'swords',
  spell: 'rune',
  mana: 'crystal',
  system: 'scroll',
};

function LogLine({ l, fresh }: { l: LogEntry; fresh: boolean }) {
  return (
    <li className={`log-line log-${l.kind} ${l.color ? `log-${l.color}` : 'log-none'} ${fresh ? 'is-new' : ''}`}>
      <span className="log-icon" aria-hidden="true">
        {l.spellId ? <SpellIcon id={l.spellId} scale={1} /> : <Icon name={KIND_ICON[l.kind]} scale={1} />}
      </span>
      <span className="log-text">{stripEmoji(l.text)}</span>
    </li>
  );
}

/** Battle report + move list. */
export function Chronicle({ state }: { state: GameState }) {
  const [tab, setTab] = useState<'log' | 'moves'>('log');
  const listRef = useRef<HTMLOListElement | null>(null);
  const seen = useRef(state.log.length);
  const freshFrom = useRef(state.log.length);
  if (state.log.length !== seen.current) {
    freshFrom.current = Math.min(seen.current, state.log.length);
    seen.current = state.log.length;
  }
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length, tab, state.moveList.length]);

  // group the log by round
  const groups: { round: number; lines: { l: LogEntry; i: number }[] }[] = [];
  state.log.forEach((l, i) => {
    const round = Math.floor(l.turnIndex / 2) + 1;
    const g = groups[groups.length - 1];
    if (!g || g.round !== round) groups.push({ round, lines: [{ l, i }] });
    else g.lines.push({ l, i });
  });

  const pairs: { n: number; w?: string; b?: string; wr?: boolean; br?: boolean; extra: string[] }[] = [];
  let current: (typeof pairs)[number] | null = null;
  for (const m of state.moveList) {
    const n = Math.floor(m.turnIndex / 2) + 1;
    if (!current || current.n !== n) {
      current = { n, extra: [] };
      pairs.push(current);
    }
    const label = (m.kind === 'bonus' ? '+ ' : '') + cleanSan(m.san);
    if (m.color === 'w') {
      if (current.w) current.extra.push(label);
      else {
        current.w = label;
        current.wr = m.rewound;
      }
    } else if (current.b) current.extra.push(label);
    else {
      current.b = label;
      current.br = m.rewound;
    }
  }

  return (
    <section className="chronicle panel frame-wood" aria-label="Történet">
      <header className="chronicle-head">
        <h2 className="panel-heading">
          <Icon name="quill" scale={2} /> Történet
        </h2>
        <div className="mini-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'log'} className={`mini-tab ${tab === 'log' ? 'is-on' : ''}`} onClick={() => setTab('log')}>
            Napló
          </button>
          <button type="button" role="tab" aria-selected={tab === 'moves'} className={`mini-tab ${tab === 'moves' ? 'is-on' : ''}`} onClick={() => setTab('moves')}>
            Lépések
          </button>
        </div>
      </header>
      <div className="scroll-sheet frame-parchment">
        <span className="wax-seal" aria-hidden="true">
          <Icon name="seal" scale={2} />
        </span>
        {tab === 'log' ? (
          <ol className="log-list" ref={listRef}>
            {groups.map((g) => (
              <li key={g.round} className="log-round">
                <span className="log-round-title">{g.round}. kör</span>
                <ol>
                  {g.lines.map(({ l, i }) => (
                    <LogLine key={i} l={l} fresh={i >= freshFrom.current} />
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="move-list" ref={listRef}>
            {pairs.length === 0 && <li className="empty">Még nem történt lépés.</li>}
            {pairs.map((p) => (
              <li key={p.n}>
                <span className="mv-n">{p.n}.</span>
                <span className={`mv ${p.wr ? 'is-rewound' : ''}`}>{p.w ?? '…'}</span>
                <span className={`mv ${p.br ? 'is-rewound' : ''}`}>{p.b ?? ''}</span>
                {p.extra.length > 0 && <span className="mv-extra">{p.extra.join(' ')}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/** Active effects with pixel icons and remaining duration; expired ones fade out. */
export function EffectsPanel({ state }: { state: GameState }) {
  const [leaving, setLeaving] = useState<{ e: Effect; title: string; text: string; target: string; who: string }[]>([]);
  const prev = useRef<Map<string, { e: Effect; title: string; text: string; target: string; who: string }>>(new Map());
  const now = new Map(state.effects.map((e) => [e.id, { e, ...describeEffect(e, state) }]));
  useEffect(() => {
    const gone = [...prev.current.values()].filter((x) => !now.has(x.e.id));
    prev.current = now;
    if (!gone.length) return;
    setLeaving((cur) => [...cur, ...gone]);
    const t = window.setTimeout(() => setLeaving((cur) => cur.filter((x) => !gone.includes(x))), 520);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const rows = [...now.values()];
  return (
    <section className="effects-panel panel frame-wood" aria-label="Aktív hatások">
      <header className="chronicle-head">
        <h2 className="panel-heading">
          <Icon name="hourglass" scale={2} /> Aktív hatások
        </h2>
        {rows.length > 0 && <span className="count-chip">{rows.length}</span>}
      </header>
      <ul className="effect-list">
        {rows.length === 0 && leaving.length === 0 && (
          <li className="empty">
            <Icon name="scales" scale={2} /> Nincs aktív hatás.
          </li>
        )}
        {rows.map(({ e, title, text, target, who }) => (
          <li key={e.id} className={`effect-row owner-${e.owner}`}>
            <span className="effect-icon">
              <SpellIcon id={e.source} scale={2} />
            </span>
            <div className="effect-text">
              <strong>{title}</strong>
              <span>
                {target && <em>{target}: </em>}
                {text}
              </span>
              <small>
                <span className={`owner-pip owner-pip-${e.owner}`} aria-hidden="true" />
                {who} · {remainingText(e, state)}
              </small>
            </div>
          </li>
        ))}
        {leaving.map(({ e, title }) => (
          <li key={`gone-${e.id}`} className={`effect-row owner-${e.owner} is-expiring`} aria-hidden="true">
            <span className="effect-icon">
              <SpellIcon id={e.source} scale={2} />
            </span>
            <div className="effect-text">
              <strong>{title}</strong>
              <small>lejárt · {COLOR_NAME_HU[e.owner]}</small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

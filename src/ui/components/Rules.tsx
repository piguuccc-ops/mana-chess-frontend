import { useState } from 'react';
import { MANA, REMOVED_SPELLS, SKIPPED_PROPOSALS, SPELL_LIST } from '../../engine';
import type { SpellCategory, SpellId } from '../../engine';
import { sfx } from '../audio/sound';
import { costText } from '../format';
import { Icon, SpellIcon } from './pixel';
import { SpellInspector } from './SpellInspector';

type Page = 'rules' | 'spells' | 'changes';

const CATS: SpellCategory[] = ['Mozgás', 'Védelem', 'Irányítás', 'Taktika', 'Terep', 'Idő', 'Mana', 'Pusztítás'];

/** The rule book: a leather-bound codex with parchment pages. */
export function Rules({ onBack, reduced }: { onBack: () => void; reduced: boolean }) {
  const [page, setPage] = useState<Page>('rules');
  const [cat, setCat] = useState<SpellCategory | null>(null);
  const [inspect, setInspect] = useState<SpellId | null>(null);
  const changed = SPELL_LIST.filter((s) => s.change);
  const added = SPELL_LIST.filter((s) => s.added);
  const list = cat ? SPELL_LIST.filter((s) => s.category === cat) : SPELL_LIST;
  const open = (id: SpellId) => {
    sfx('open');
    setInspect(id);
  };

  return (
    <div className={`rules-screen ${reduced ? 'is-still' : ''}`}>
      <header className="codex-head">
        <button type="button" className="btn btn-iron" onClick={onBack}>
          <Icon name="back" scale={2} /> Menü
        </button>
        <h1 className="codex-title">
          <Icon name="book" scale={3} /> <span className="gold-text">Szabálykönyv</span>
        </h1>
        <span className="codex-head-spacer" />
      </header>

      <div className="codex frame-wood">
        <nav className="tabs codex-tabs" role="tablist">
          {(
            [
              ['rules', 'Alapszabályok', 'scroll'],
              ['spells', `Spellek (${SPELL_LIST.length})`, 'rune'],
              ['changes', 'Változások', 'quill'],
            ] as const
          ).map(([id, label, icon]) => (
            <button key={id} type="button" role="tab" aria-selected={page === id} className={`tab ${page === id ? 'is-on' : ''}`} onClick={() => setPage(id)}>
              <Icon name={icon} scale={1} /> {label}
            </button>
          ))}
        </nav>

        <div className="codex-page frame-parchment" key={page}>
          {page === 'rules' && (
            <div className="codex-columns">
              <section>
                <h2 className="codex-h">Alapok</h2>
                <p>
                  Normál sakk: sakk, matt, patt, sáncolás, en passant és gyalogátváltozás is működik. A cél továbbra is az ellenfél
                  mattolása. Spell soha nem ütheti le a királyt, és a saját királyodat sem hozhatja sakkba.
                </p>
                <h2 className="codex-h">Mana</h2>
                <ul className="codex-list">
                  <li>Kezdéskor mindkét játékosnak {MANA.START} manája van, a maximum {MANA.MAX}.</li>
                  <li>Minden saját kör elején +{MANA.PER_TURN} mana (az első saját körödet a kezdő 3 manával játszod).</li>
                  <li>Ha egy bábuddal leütsz egy ellenséges bábut: +{MANA.PER_CAPTURE} mana (spell-lel való pusztítás nem ad manát).</li>
                  <li>A {MANA.MAX} feletti mana elveszik. A spell ára azonnal levonódik.</li>
                </ul>
                <h2 className="codex-h">Spell-ciklus</h2>
                <p>
                  A paklid 6 spellből áll, egyszerre 3 van a kezedben. A kijátszott lap a pakli végére kerül, és a következő lap
                  belép a kezedbe: A B C → (A után) B C D → C D E … Egy pakliban legfeljebb egy 6 manás és egy 5 manás spell
                  lehet.
                </p>
                <p>
                  Körforgás: némelyik lap (pl. a Végzet) minden kijátszáskor töltődik; ha összegyűlt a töltése (a Végzetnél két
                  kijátszás), akkor amikor a pakli körbefordul és újra a kezedbe kerül, felébredve – lila kerettel, erősebb hatással –
                  játszhatod ki. A felébredt kijátszás után újra töltődik.
                </p>
              </section>
              <section>
                <h2 className="codex-h">A kör menete</h2>
                <ul className="codex-list">
                  <li>Egy körben tehetsz egy normál sakk-lépést és/vagy kijátszhatsz tetszőleges számú spellt, amíg van manád.</li>
                  <li>
                    A spellek nem fejezik be a kört. A normál lépés után automatikusan az ellenfél következik (a menüben választható
                    „Kézi” kör vége módban a lépés után is varázsolhatsz, és gombbal zárod a kört).
                  </li>
                  <li>Lépés nélkül is befejezheted a kört („Kör vége”), ha legalább egy spellt kijátszottál – de sakkban soha.</li>
                  <li>Ha nincs szabályos lépésed, de egy spell kimenthet, a játék nem ér véget: ki kell játszanod.</li>
                  <li>Matt: sakkban vagy, és sem lépéssel, sem a kezedben lévő spellekkel nem háríthatod el. Patt: ugyanez sakk nélkül.</li>
                  <li>Döntetlen még: 50 lépés ütés/gyaloglépés nélkül, csupasz királyok, megegyezés.</li>
                </ul>
                <h2 className="codex-h">Kategóriák</h2>
                <ul className="codex-cats">
                  {CATS.map((c) => (
                    <li key={c} data-cat={c}>
                      <span className="cat-pip" /> {c} <small>({SPELL_LIST.filter((s) => s.category === c).length})</small>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {page === 'spells' && (
            <>
              <div className="codex-filter" role="group" aria-label="Kategória">
                <button type="button" className={`chip-btn ${cat === null ? 'is-on' : ''}`} onClick={() => setCat(null)}>
                  Mind
                </button>
                {CATS.map((c) => (
                  <button key={c} type="button" data-cat={c} className={`chip-btn ${cat === c ? 'is-on' : ''}`} onClick={() => setCat(c)}>
                    <span className="cat-pip" /> {c}
                  </button>
                ))}
              </div>
              <p className="codex-hint">
                <Icon name="eye" scale={1} /> Kattints egy spellre: részletes leírás és bemutató a táblán.
              </p>
              <div className="table-scroll">
                <table className="codex-table is-clickable">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Spell</th>
                      <th>Mana</th>
                      <th>Kategória</th>
                      <th>Hatás</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id} data-cat={s.category} onClick={() => open(s.id)}>
                        <td className="num">{s.number}</td>
                        <td className="nm">
                          <button
                            type="button"
                            className="nm-in nm-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              open(s.id);
                            }}
                            aria-haspopup="dialog"
                          >
                            <SpellIcon id={s.id} scale={2} />
                            <span>
                              {s.name}
                              {s.change && <span className="stamp-tag">módosítva</span>}
                              {s.added && <span className="stamp-tag is-new">új</span>}
                            </span>
                          </button>
                        </td>
                        <td className="num">
                          <span className="cost-gem">{costText(s)}</span>
                        </td>
                        <td>
                          <span className="cat-pip" /> {s.category}
                        </td>
                        <td>{s.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {page === 'changes' && (
            <div className="codex-columns">
              <section>
                <h2 className="codex-h">Új és kivett spellek</h2>
                <ul className="codex-entries">
                  {added.map((s) => (
                    <li key={s.id}>
                      <h3>
                        <SpellIcon id={s.id} scale={2} /> {s.name} <span className="stamp-tag is-new">új</span> <span className="cost-gem">{costText(s)}</span>
                      </h3>
                      <p>{s.description}</p>
                      {s.added!.proposal && (
                        <p className="muted">
                          <b>Javaslat:</b> {s.added!.proposal}
                          {s.added!.proposalCost !== undefined && ` (${s.added!.proposalCost} mana)`}
                        </p>
                      )}
                      <p>
                        <b>Miért:</b> {s.added!.reason}
                      </p>
                    </li>
                  ))}
                  {REMOVED_SPELLS.map((r) => (
                    <li key={r.id}>
                      <h3>
                        {r.number}. {r.name} <span className="stamp-tag">kivéve</span>
                      </h3>
                      <p>{r.reason} A mentett paklikban automatikusan lecserélődik.</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="codex-h">Kihagyott javaslatok ({SKIPPED_PROPOSALS.length})</h2>
                <p className="muted">Az 50 javasolt spell közül ezek nem kerültek be – többnyire mert egy meglévő spell már ugyanezt tudja.</p>
                <ul className="codex-list compact">
                  {SKIPPED_PROPOSALS.map((p) => (
                    <li key={p.number}>
                      <b>{p.name}</b> <span className="cost-gem">{p.cost}</span> – {p.reason}
                    </li>
                  ))}
                </ul>
                <h2 className="codex-h">Módosított spellek ({changed.length})</h2>
                <p className="muted">
                  Ezek a spellek eredeti formájukban hatástalanok, kiegyensúlyozatlanok vagy nem egyértelműek voltak, ezért minimálisan
                  módosultak.
                </p>
                <ul className="codex-entries">
                  {changed.map((s) => (
                    <li key={s.id}>
                      <h3>
                        <SpellIcon id={s.id} scale={2} /> {s.number}. {s.name}{' '}
                        <span className="cost-gem">
                          {s.change!.originalCost ? `${s.change!.originalCost} → ` : ''}
                          {s.manaCost}
                        </span>
                      </h3>
                      <p>
                        <b>Eredeti:</b> {s.change!.original}
                      </p>
                      <p>
                        <b>Miért változott:</b> {s.change!.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
      {inspect && (
        <SpellInspector spellId={inspect} list={list.map((s) => s.id)} onNavigate={setInspect} onClose={() => setInspect(null)} reduced={reduced} />
      )}
    </div>
  );
}

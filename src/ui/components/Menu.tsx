// Title screen: the living landscape, the wordmark and the main menu – the bots' hall (with the
// faces of the eleven bots), ranked play (with your Élő-pontszám), friendly games online, a game
// for two on one device, and the decks / rules / settings row – plus a small profile card.
// The local battle setup and the settings slide in over the scenery.
import { useEffect, useState, type ReactNode } from 'react';
import { BOT_IDS, BOTS, type BotId } from '../../bots/roster';
import type { DeckDef } from '../../engine';
import { sfx } from '../audio/sound';
import { pushBack } from '../native';
import type { BotRecord, Prefs } from '../storage';
import { BotPortrait, EloBadge } from './BotPortrait';
import { DeckCarousel } from './DeckCarousel';
import { DeckModeChoices } from './DeckModeChoices';
import { Icon, type IconName } from './pixel';
import { LandscapeScene, PixelLogo } from './scenes';
import { SettingsBody } from './Settings';

/** The signed-in player as the title screen shows them. */
export interface MenuProfile {
  name: string;
  server: string;
  rating: number;
  w: number;
  l: number;
  d: number;
  rank: number | null;
}

interface Props {
  decks: DeckDef[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  /** A game for two on this device (from the battle setup). */
  onStart: () => void;
  onBots: () => void;
  onRanked: () => void;
  /** The online screen (server, account, friends, rooms). */
  onOnline: () => void;
  /** Challenges and friend requests waiting for an answer (shown on the Online button). */
  onlineBadge: number;
  onDeckBuilder: () => void;
  onRules: () => void;
  reduced: boolean;
  initialPanel?: 'setup' | 'settings' | null;
  botRecord: BotRecord;
  /** Signed in on a server (null: a guest). */
  profile: MenuProfile | null;
}

function useLogoScale() {
  const pick = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // a phone on its side: the logo shares the height with the menu
    if (h < 560 && w > h) return h < 360 ? 2 : 3;
    if (w < 760) return h < 700 ? 2 : 3;
    return w >= 1280 && h >= 820 ? 5 : h >= 780 ? 4 : 3;
  };
  const [s, setS] = useState(pick);
  useEffect(() => {
    const on = () => setS(pick());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

function MenuButton({ icon, children, sub, primary, onClick, id, badge, aside }: { icon: IconName; children: string; sub?: string; primary?: boolean; onClick: () => void; id: string; badge?: number; aside?: ReactNode }) {
  return (
    <button id={id} type="button" className={`menu-btn btn ${primary ? 'btn-primary' : 'btn-dark'}`} onClick={onClick}>
      <span className="menu-btn-icon">
        <Icon name={icon} scale={2} />
      </span>
      <span className="menu-btn-label">
        {children}
        {sub && <small>{sub}</small>}
      </span>
      {aside}
      {!!badge && (
        <span className="menu-btn-badge badge" aria-label={`${badge} új`}>
          {badge}
        </span>
      )}
    </button>
  );
}

/** The first bot not beaten yet (the next challenge), or the strongest when all are. */
export function nextBot(record: BotRecord): BotId {
  return BOT_IDS.find((id) => !((record[id]?.w ?? 0) > 0)) ?? BOT_IDS[BOT_IDS.length - 1];
}

/** The big bots' hall button: every bot's face in a row (the beaten ones lit up), and the next one. */
function BotsButton({ record, onClick }: { record: BotRecord; onClick: () => void }) {
  const next = BOTS[nextBot(record)];
  const beaten = BOT_IDS.filter((id) => (record[id]?.w ?? 0) > 0).length;
  return (
    <button id="menu-bots" type="button" className="menu-btn menu-bots btn btn-primary" onClick={onClick}>
      <span className="menu-bots-top">
        <span className="menu-btn-icon">
          <Icon name="swords" scale={2} />
        </span>
        <span className="menu-btn-label">
          Botok ellen
          <small>
            {beaten === BOT_IDS.length ? 'Mindenkit legyőztél – jöhet a visszavágó!' : `Következő: ${next.name} · ${next.elo} Élő`}
          </small>
        </span>
      </span>
      <span className="menu-bots-faces" aria-hidden="true">
        {BOT_IDS.map((id) => (
          <span key={id} className={`menu-face ${(record[id]?.w ?? 0) > 0 ? 'is-beaten' : ''} ${id === next.id ? 'is-next' : ''}`}>
            <BotPortrait id={id} scale={1} />
          </span>
        ))}
      </span>
    </button>
  );
}

function ProfileCard({ profile, record, onOpen }: { profile: MenuProfile | null; record: BotRecord; onOpen: () => void }) {
  const beaten = BOT_IDS.filter((id) => (record[id]?.w ?? 0) > 0).length;
  const games = profile ? profile.w + profile.l + profile.d : 0;
  return (
    <aside className="title-profile frame-parchment" aria-label="Profil">
      <button type="button" className="profile-id" onClick={onOpen} title={profile ? 'Online: fiók, barátok, ranglista' : 'Bejelentkezés'}>
        <span className="profile-crest">
          <Icon name="user" scale={2} />
        </span>
        <span className="profile-name">
          <b>{profile ? profile.name : 'Vendég'}</b>
          <small>{profile ? profile.server : 'Nem vagy bejelentkezve'}</small>
        </span>
      </button>
      <dl className="profile-stats">
        <div>
          <dt>Élő</dt>
          <dd>{profile ? <EloBadge elo={profile.rating} title={`Élő-pontszám: ${profile.rating}`} /> : '–'}</dd>
        </div>
        <div>
          <dt>Rangsorolt</dt>
          <dd>{profile ? (games ? `${profile.w}–${profile.l}–${profile.d}` : 'még nincs') : '–'}</dd>
        </div>
        <div>
          <dt>Botok</dt>
          <dd>
            <Icon name="crown" scale={1} /> {beaten}/{BOT_IDS.length}
          </dd>
        </div>
      </dl>
      {!profile && (
        <button type="button" className="link-btn profile-signin" onClick={onOpen}>
          Bejelentkezés a rangsorolt játékhoz
        </button>
      )}
    </aside>
  );
}

function BattleSetup({
  decks, prefs, onPrefs, onStart, onBots, onOnline, onClose,
}: { decks: DeckDef[]; prefs: Prefs; onPrefs: (p: Prefs) => void; onStart: () => void; onBots: () => void; onOnline: () => void; onClose: () => void }) {
  return (
    <section className="side-panel frame-wood" role="dialog" aria-modal="false" aria-labelledby="setup-title">
      <h2 className="panel-title" id="setup-title">
        <Icon name="duel" scale={2} /> Helyi csata
      </h2>
      <div className="side-panel-body frame-parchment">
        <h3 className="section-title">Játékmód</h3>
        <div className="choices choices-modes" role="radiogroup" aria-label="Játékmód">
          <button type="button" role="radio" aria-checked={true} className="choice">
            <Icon name="duel" scale={2} />
            <b>Helyi 1v1</b>
            <small>Két játékos, egy eszköz</small>
          </button>
          <button type="button" role="radio" aria-checked={false} className="choice" id="mode-bots" onClick={onBots}>
            <BotPortrait id="kende" scale={1} className="choice-face" />
            <b>Botok</b>
            <small>11 ellenfél, 100–3000 Élő</small>
          </button>
          <button type="button" role="radio" aria-checked={false} className="choice" id="mode-online" onClick={onOnline}>
            <Icon name="globe" scale={2} />
            <b>Online</b>
            <small>Rangsorolt vagy barátságos</small>
          </button>
        </div>
        <h3 className="section-title">Paklik</h3>
        <DeckModeChoices draft={prefs.draft} onChange={(draft) => onPrefs({ ...prefs, draft })} />
        {prefs.draft ? (
          <p className="hint draft-setup-hint">
            32 véletlen spell kerül az asztalra (8 × 4). Ketten felváltva választotok egyet-egyet, amíg mindkettőtöknek 6 lesz – Világos kezd. A
            választások sorrendje a pakli sorrendje: az első három a kezdő kéz.
          </p>
        ) : (
          <div className="carousels">
            <DeckCarousel side="w" label="Világos paklija" value={prefs.whiteDeckId} decks={decks} onChange={(id) => onPrefs({ ...prefs, whiteDeckId: id })} />
            <DeckCarousel side="b" label="Sötét paklija" value={prefs.blackDeckId} decks={decks} onChange={(id) => onPrefs({ ...prefs, blackDeckId: id })} />
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
      </div>
      <div className="side-panel-actions">
        <button type="button" className="btn btn-dark" onClick={onClose}>
          <Icon name="back" scale={1} /> Vissza
        </button>
        <button id="start-battle" type="button" className="btn btn-primary btn-big" onClick={onStart}>
          <Icon name="swords" scale={2} /> Csatába!
        </button>
      </div>
    </section>
  );
}

export function Menu({
  decks, prefs, onPrefs, onStart, onBots, onRanked, onOnline, onlineBadge, onDeckBuilder, onRules, reduced, initialPanel = null, botRecord, profile,
}: Props) {
  const [panel, setPanel] = useState<'setup' | 'settings' | null>(initialPanel);
  const logoScale = useLogoScale();
  const open = (p: 'setup' | 'settings' | null) => {
    sfx(p ? 'open' : 'back');
    setPanel(p);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // the Android back button closes an open panel first
  useEffect(() => {
    if (!panel) return;
    return pushBack(() => {
      open(null);
      return true;
    });
  }, [panel]); // eslint-disable-line react-hooks/exhaustive-deps

  const games = profile ? profile.w + profile.l + profile.d : 0;
  return (
    <div className={`title-screen ${panel ? 'has-panel' : ''}`}>
      <LandscapeScene reduced={reduced} />
      <div className="title-ui">
        <div className="title-left">
          <div className="title-logo">
            <PixelLogo scale={logoScale} />
            <p className="tagline">Tervezz · Varázsolj · Győzz</p>
          </div>
          <nav className="title-menu" aria-label="Főmenü">
            <BotsButton record={botRecord} onClick={onBots} />
            <MenuButton
              id="menu-ranked"
              icon="trophy"
              onClick={onRanked}
              sub={profile ? (games ? `${profile.rank ? `${profile.rank}. hely · ` : ''}${profile.w} gy · ${profile.l} v · ${profile.d} d` : 'Élő-pontszám, párosítás') : 'Bejelentkezéssel, online'}
              aside={profile ? <EloBadge elo={profile.rating} /> : undefined}
            >
              Rangsorolt
            </MenuButton>
            <MenuButton id="menu-online" icon="globe" onClick={onOnline} badge={onlineBadge} sub="Barátok, szobák, LAN">
              Barátságos
            </MenuButton>
            <MenuButton id="menu-start" icon="duel" onClick={() => open('setup')} sub="Két játékos, egy eszköz">
              Helyi 1v1
            </MenuButton>
            <div className="title-row" role="group" aria-label="Egyebek">
              <button id="menu-decks" type="button" className="btn btn-dark title-small" onClick={onDeckBuilder}>
                <Icon name="cards" scale={2} />
                <span>Paklik</span>
              </button>
              <button id="menu-rules" type="button" className="btn btn-dark title-small" onClick={onRules}>
                <Icon name="book" scale={2} />
                <span>Szabályok</span>
              </button>
              <button id="menu-settings" type="button" className="btn btn-dark title-small" onClick={() => open('settings')}>
                <Icon name="gear" scale={2} />
                <span>Beállítások</span>
              </button>
            </div>
          </nav>
        </div>
        <ProfileCard profile={profile} record={botRecord} onOpen={onRanked} />
        {panel === 'setup' && <BattleSetup decks={decks} prefs={prefs} onPrefs={onPrefs} onStart={onStart} onBots={onBots} onOnline={onOnline} onClose={() => open(null)} />}
        {panel === 'settings' && (
          <section className="side-panel frame-wood" role="dialog" aria-modal="false" aria-labelledby="settings-title">
            <h2 className="panel-title" id="settings-title">
              <Icon name="gear" scale={2} /> Beállítások
            </h2>
            <div className="side-panel-body frame-parchment">
              <SettingsBody prefs={prefs} onPrefs={onPrefs} />
            </div>
            <div className="side-panel-actions">
              <button type="button" className="btn btn-dark" onClick={() => open(null)}>
                <Icon name="back" scale={1} /> Vissza
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// Title screen: the living landscape, the wordmark, the main menu, and the
// battle-setup / settings panels that slide in over the scenery.
import { useEffect, useState } from 'react';
import { SPELL_LIST, type DeckDef } from '../../engine';
import { sfx } from '../audio/sound';
import type { Prefs } from '../storage';
import { DeckCarousel } from './DeckCarousel';
import { Icon, type IconName } from './pixel';
import { LandscapeScene, PixelLogo } from './scenes';
import { SettingsBody } from './Settings';

interface Props {
  decks: DeckDef[];
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
  onStart: () => void;
  /** The online screen (server, account, friends, rooms). */
  onOnline: () => void;
  /** Challenges and friend requests waiting for an answer (shown on the Online button). */
  onlineBadge: number;
  onDeckBuilder: () => void;
  onRules: () => void;
  reduced: boolean;
  initialPanel?: 'setup' | 'settings' | null;
}

function useLogoScale() {
  const pick = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // a phone on its side: the logo shares the height with the menu
    if (h < 560 && w > h) return h < 360 ? 2 : 3;
    return w >= 1280 && h >= 760 ? 5 : w >= 760 ? 4 : 3;
  };
  const [s, setS] = useState(pick);
  useEffect(() => {
    const on = () => setS(pick());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

function MenuButton({ icon, children, primary, onClick, id, badge }: { icon: IconName; children: string; primary?: boolean; onClick: () => void; id: string; badge?: number }) {
  return (
    <button id={id} type="button" className={`menu-btn btn ${primary ? 'btn-primary' : 'btn-dark'}`} onClick={onClick}>
      <span className="menu-btn-icon">
        <Icon name={icon} scale={2} />
      </span>
      <span className="menu-btn-label">{children}</span>
      {!!badge && (
        <span className="menu-btn-badge badge" aria-label={`${badge} új`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function BattleSetup({
  decks, prefs, onPrefs, onStart, onOnline, onClose,
}: { decks: DeckDef[]; prefs: Prefs; onPrefs: (p: Prefs) => void; onStart: () => void; onOnline: () => void; onClose: () => void }) {
  const ai = prefs.mode === 'ai';
  return (
    <section className="side-panel frame-wood" role="dialog" aria-modal="false" aria-labelledby="setup-title">
      <h2 className="panel-title" id="setup-title">
        <Icon name="swords" scale={2} /> Csata előkészítése
      </h2>
      <div className="side-panel-body frame-parchment">
        <h3 className="section-title">Játékmód</h3>
        <div className="choices choices-modes" role="radiogroup" aria-label="Játékmód">
          <button type="button" role="radio" aria-checked={prefs.mode === 'local'} className="choice" onClick={() => onPrefs({ ...prefs, mode: 'local' })}>
            <Icon name="duel" scale={2} />
            <b>Helyi 1v1</b>
            <small>Két játékos, egy gép</small>
          </button>
          <button type="button" role="radio" aria-checked={ai} className="choice" onClick={() => onPrefs({ ...prefs, mode: 'ai' })}>
            <Icon name="owl" scale={2} />
            <b>Egyszerű AI</b>
            <small>Béta · te vagy a Világos</small>
          </button>
          <button type="button" role="radio" aria-checked={false} className="choice" id="mode-online" onClick={onOnline}>
            <Icon name="globe" scale={2} />
            <b>Online</b>
            <small>Szerveren, fiókkal vagy LAN-on</small>
          </button>
        </div>
        <h3 className="section-title">Paklik</h3>
        <div className="carousels">
          <DeckCarousel side="w" label={ai ? 'A te paklid (Világos)' : 'Világos paklija'} value={prefs.whiteDeckId} decks={decks} onChange={(id) => onPrefs({ ...prefs, whiteDeckId: id })} />
          <DeckCarousel side="b" label={ai ? 'Az AI paklija (Sötét)' : 'Sötét paklija'} value={prefs.blackDeckId} decks={decks} onChange={(id) => onPrefs({ ...prefs, blackDeckId: id })} />
        </div>
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

export function Menu({ decks, prefs, onPrefs, onStart, onOnline, onlineBadge, onDeckBuilder, onRules, reduced, initialPanel = null }: Props) {
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
            <MenuButton id="menu-start" icon="swords" primary onClick={() => open('setup')}>
              Csatába!
            </MenuButton>
            <MenuButton id="menu-online" icon="globe" onClick={onOnline} badge={onlineBadge}>
              Online
            </MenuButton>
            <MenuButton id="menu-decks" icon="cards" onClick={onDeckBuilder}>
              Paklik
            </MenuButton>
            <MenuButton id="menu-rules" icon="book" onClick={onRules}>
              Szabályok
            </MenuButton>
            <MenuButton id="menu-settings" icon="gear" onClick={() => open('settings')}>
              Beállítások
            </MenuButton>
          </nav>
        </div>
        <aside className="title-plaque frame-parchment">
          <Icon name="book" scale={2} />
          <p>
            Klasszikus sakk manakristályokkal: minden körben +1 mana, minden ütésért +1. Pakliba {SPELL_LIST.length} varázslatból
            választhatsz 6-ot – egyszerre 3 van a kezedben.
          </p>
        </aside>
        {panel === 'setup' && <BattleSetup decks={decks} prefs={prefs} onPrefs={onPrefs} onStart={onStart} onOnline={onOnline} onClose={() => open(null)} />}
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

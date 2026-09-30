// Small pieces of the online screen: a parchment dialog, presence dots, and the two forms that
// open over the lobby (challenging a friend, changing the password).
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DeckDef } from '../../../engine';
import { PASSWORD_MIN, type ColorChoice, type Presence } from '../../../net/protocol';
import { Icon, SpellIcon } from '../pixel';

/** Dialogs go to the app's root, above every panel (no card's scrolling or clipping applies). */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.querySelector('.app') ?? document.body);
}

/** A dialog over the online screen (Escape or the backdrop closes it). */
export function Modal({ title, icon, children, onClose }: { title: string; icon?: Parameters<typeof Icon>[0]['name']; children: ReactNode; onClose: () => void }) {
  const card = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    card.current?.querySelector<HTMLElement>('input, button.btn-primary')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <Portal>
      <div className="overlay overlay-soft online-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={card} className="dialog frame-parchment online-dialog">
          <p className="dialog-title">
            {icon && <Icon name={icon} scale={2} />} {title}
          </p>
          {children}
        </div>
      </div>
    </Portal>
  );
}

export const PRESENCE_WORD: Record<Presence, string> = { online: 'online', playing: 'játszik', offline: 'nincs bent' };

export function PresenceDot({ status }: { status: Presence }) {
  return <span className={`presence-dot is-${status}`} aria-hidden="true" />;
}

/** The six spells of a deck as a row of small icons. */
export function DeckStrip({ deck }: { deck: DeckDef | null }) {
  return (
    <span className="deck-strip" aria-hidden="true">
      {deck
        ? deck.spells.map((s) => <SpellIcon key={s} id={s} scale={1} />)
        : Array.from({ length: 6 }, (_, i) => <Icon key={i} name="dice" scale={1} />)}
    </span>
  );
}

export const COLOR_WORD: Record<ColorChoice, string> = { w: 'Világos', b: 'Sötét', random: 'véletlen szín' };
/** The colour the other side gets when one side asked for `c`. */
export const theirColor = (c: ColorChoice): ColorChoice => (c === 'random' ? 'random' : c === 'w' ? 'b' : 'w');

export function ColorChoices({ value, onChange }: { value: ColorChoice; onChange: (c: ColorChoice) => void }) {
  const one = (c: ColorChoice, icon: 'crestW' | 'crestB' | 'dice', label: string) => (
    <button type="button" role="radio" aria-checked={value === c} className="choice choice-sm" onClick={() => onChange(c)}>
      <Icon name={icon} scale={2} />
      <b>{label}</b>
    </button>
  );
  return (
    <div className="choices choices-3" role="radiogroup" aria-label="Színed">
      {one('w', 'crestW', 'Világos')}
      {one('b', 'crestB', 'Sötét')}
      {one('random', 'dice', 'Véletlen')}
    </div>
  );
}

export function TurnChoices({ auto, onChange }: { auto: boolean; onChange: (auto: boolean) => void }) {
  return (
    <div className="choices" role="radiogroup" aria-label="Kör vége">
      <button type="button" role="radio" aria-checked={auto} className="choice" onClick={() => onChange(true)}>
        <Icon name="hourglass" scale={2} />
        <b>Automatikus</b>
        <small>A lépés befejezi a kört</small>
      </button>
      <button type="button" role="radio" aria-checked={!auto} className="choice" onClick={() => onChange(false)}>
        <Icon name="quill" scale={2} />
        <b>Kézi</b>
        <small>Lépés után is varázsolhatsz</small>
      </button>
    </div>
  );
}

/** Challenging a friend: colour, turn mode, and the deck chosen in the lobby. */
export function ChallengeDialog({
  friend, deck, color, autoEndTurn, onColor, onAuto, onSend, onClose,
}: {
  friend: string;
  deck: DeckDef | null;
  color: ColorChoice;
  autoEndTurn: boolean;
  onColor: (c: ColorChoice) => void;
  onAuto: (a: boolean) => void;
  onSend: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    setBusy(true);
    const e = await onSend();
    setBusy(false);
    if (e) setError(e);
    else onClose();
  };
  return (
    <Modal title={`${friend} kihívása`} icon="duel" onClose={onClose}>
      <div className="online-form">
        <span className="field-label">A színed</span>
        <ColorChoices value={color} onChange={onColor} />
        <span className="field-label">Kör vége</span>
        <TurnChoices auto={autoEndTurn} onChange={onAuto} />
        <div className="challenge-deck">
          <span className="field-label">A paklid</span>
          <b>{deck ? deck.name : 'Véletlen pakli'}</b>
          <DeckStrip deck={deck} />
          <small className="hint">A paklit a Játék oldalon, a pakliválasztóban cserélheted.</small>
        </div>
        <p className="hint">{friend} 5 percig fogadhatja el – ha elfogadja, azonnal indul a játszma.</p>
        {error && (
          <p className="msg msg-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void send()}>
          <Icon name="swords" scale={1} /> {busy ? 'Küldés…' : 'Kihívás küldése'}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Mégse
        </button>
      </div>
    </Modal>
  );
}

export function PasswordDialog({ onSave, onClose }: { onSave: (old: string, next: string) => Promise<string | null>; onClose: () => void }) {
  const [old, setOld] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== again) return setError('A két új jelszó nem egyezik.');
    if (next.length < PASSWORD_MIN) return setError(`Az új jelszó legalább ${PASSWORD_MIN} karakter legyen.`);
    setBusy(true);
    const err = await onSave(old, next);
    setBusy(false);
    if (err) setError(err);
    else setDone(true);
  };
  return (
    <Modal title="Jelszócsere" icon="lock" onClose={onClose}>
      {done ? (
        <>
          <p className="msg msg-ok" role="status">
            Az új jelszó beállítva. A többi eszközödön újra be kell lépned.
          </p>
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Rendben
            </button>
          </div>
        </>
      ) : (
        <form className="online-form" onSubmit={(e: FormEvent) => void submit(e)}>
          <Field label="Mostani jelszó" type="password" value={old} onChange={setOld} autoComplete="current-password" icon="lock" />
          <Field label="Új jelszó" type="password" value={next} onChange={setNext} autoComplete="new-password" icon="lock" hint={`Legalább ${PASSWORD_MIN} karakter`} />
          <Field label="Új jelszó még egyszer" type="password" value={again} onChange={setAgain} autoComplete="new-password" icon="lock" />
          {error && (
            <p className="msg msg-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !old || !next}>
              {busy ? 'Mentés…' : 'Mentés'}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Mégse
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** A labelled parchment input. */
export function Field({
  label, value, onChange, type = 'text', icon, hint, autoComplete, placeholder, maxLength, id, inputMode, autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password' | 'search';
  icon?: Parameters<typeof Icon>[0]['name'];
  hint?: string;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  id?: string;
  inputMode?: 'url' | 'text';
  autoFocus?: boolean;
}) {
  return (
    <label className="online-field">
      <span className="field-label">{label}</span>
      <span className="field">
        {icon && <Icon name={icon} scale={1} />}
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          autoCapitalize="off"
          spellCheck={false}
          inputMode={inputMode}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

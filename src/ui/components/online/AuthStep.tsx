// Step 2 of the online screen: sign in, make an account, or play as a guest (LAN mode).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { displayServer } from '../../../net/client';
import { NAME_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN, type ServerInfo } from '../../../net/protocol';
import type { Online } from '../../online/useOnline';
import { Icon } from '../pixel';
import { Field } from './parts';

type Tab = 'login' | 'register' | 'guest';

const REG_WORD = { closed: 'zárva', approval: 'jóváhagyással', open: 'nyitott' } as const;

export function ServerBanner({ origin, info, onSwitch }: { origin: string; info: ServerInfo; onSwitch?: () => void }) {
  return (
    <div className="online-server" data-state="ok">
      <Icon name="globe" scale={2} />
      <div className="online-server-text">
        <b>{info.name}</b>
        <small>
          {displayServer(origin)} · regisztráció: {REG_WORD[info.registration]} · vendégjáték: {info.guests ? 'engedélyezve' : 'tiltva'}
        </small>
      </div>
      {onSwitch && (
        <button type="button" className="link-btn" onClick={onSwitch}>
          Másik szerver
        </button>
      )}
    </div>
  );
}

export function AuthStep({ online, origin, info, guestName, onGuestName }: { online: Online; origin: string; info: ServerInfo; guestName: string; onGuestName: (n: string) => void }) {
  const [tab, setTab] = useState<Tab>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const pick = (t: Tab) => {
    setTab(t);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (tab === 'register') {
      if (password !== again) return setError('A két jelszó nem egyezik.');
      setBusy(true);
      const r = await online.register(name, password, remember);
      setBusy(false);
      if (r.error) return setError(r.error);
      if (r.pending) {
        setPending(name.trim());
        setPassword('');
        setAgain('');
        setTab('login');
      }
      return;
    }
    if (tab === 'login') {
      setBusy(true);
      const err = await online.login(name, password, remember);
      setBusy(false);
      if (err) setError(err);
      return;
    }
    if (!guestName.trim()) return setError('Adj meg egy nevet, ezt látja az ellenfeled.');
    online.setGuest(true);
  };

  const tabs: [Tab, string, Parameters<typeof Icon>[0]['name']][] = [
    ['login', 'Belépés', 'lock'],
    ['register', 'Regisztráció', 'quill'],
    ['guest', 'Vendégként', 'user'],
  ];

  return (
    <section className="online-card online-step frame-parchment" aria-labelledby="auth-title">
      <h2 className="online-card-title" id="auth-title">
        <Icon name="user" scale={2} /> Fiók
      </h2>
      <ServerBanner origin={origin} info={info} onSwitch={online.disconnect} />
      <div className="tabs online-tabs" role="tablist">
        {tabs.map(([id, label, icon]) => (
          <button key={id} type="button" role="tab" id={`auth-${id}`} aria-selected={tab === id} className="tab" onClick={() => pick(id)}>
            <Icon name={icon} scale={1} /> {label}
          </button>
        ))}
      </div>
      {pending && tab === 'login' && (
        <p className="msg msg-ok" role="status">
          Regisztráció elküldve: {pending}. Amint az adminisztrátor jóváhagyja, itt beléphetsz.
        </p>
      )}
      <form className="online-form" onSubmit={(e: FormEvent) => void submit(e)}>
        {tab === 'login' && (
          <>
            <Field id="login-name" label="Név" value={name} onChange={setName} icon="user" autoComplete="username" maxLength={USERNAME_MAX} />
            <Field id="login-password" label="Jelszó" type="password" value={password} onChange={setPassword} icon="lock" autoComplete="current-password" />
          </>
        )}
        {tab === 'register' &&
          (info.registration === 'closed' ? (
            <p className="msg msg-error">Ezen a szerveren zárva a regisztráció – fiókot az adminisztrátor hozhat létre neked a vezérlőpulton.</p>
          ) : (
            <>
              <Field id="reg-name" label="Név" value={name} onChange={setName} icon="user" autoComplete="username" maxLength={USERNAME_MAX} hint={`${USERNAME_MIN}–${USERNAME_MAX} karakter: betű, szám, szóköz, _ . -`} />
              <Field id="reg-password" label="Jelszó" type="password" value={password} onChange={setPassword} icon="lock" autoComplete="new-password" hint={`Legalább ${PASSWORD_MIN} karakter`} />
              <Field id="reg-password2" label="Jelszó még egyszer" type="password" value={again} onChange={setAgain} icon="lock" autoComplete="new-password" />
              <p className="hint">
                {info.registration === 'approval'
                  ? 'Ezen a szerveren az adminisztrátor hagyja jóvá az új fiókokat – utána tudsz belépni.'
                  : 'A fiókod azonnal használható.'}
              </p>
            </>
          ))}
        {tab === 'guest' &&
          (info.guests ? (
            <>
              <Field id="guest-name" label="A neved" value={guestName} onChange={onGuestName} icon="user" autoComplete="nickname" maxLength={NAME_MAX} placeholder="pl. Misi" />
              <p className="hint">
                Vendégként szobát nyithatsz és beléphetsz mások szobáiba. A pakliid ebben a böngészőben maradnak; barátlista és kihívás
                csak fiókkal van.
              </p>
            </>
          ) : (
            <p className="msg msg-error">Ezen a szerveren csak bejelentkezve lehet játszani.</p>
          ))}
        {tab !== 'guest' && !(tab === 'register' && info.registration === 'closed') && (
          <label className="online-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Maradjak bejelentkezve ezen az eszközön</span>
          </label>
        )}
        {error && (
          <p className="msg msg-error" role="alert">
            {error}
          </p>
        )}
        {!(tab === 'register' && info.registration === 'closed') && !(tab === 'guest' && !info.guests) && (
          <button type="submit" id="auth-submit" className="btn btn-primary btn-big online-submit" disabled={busy || (tab !== 'guest' && (!name.trim() || !password))}>
            <Icon name={tab === 'guest' ? 'swords' : tab === 'register' ? 'quill' : 'lock'} scale={2} />
            {busy ? 'Egy pillanat…' : tab === 'login' ? 'Belépés' : tab === 'register' ? 'Regisztráció' : 'Tovább vendégként'}
          </button>
        )}
      </form>
    </section>
  );
}

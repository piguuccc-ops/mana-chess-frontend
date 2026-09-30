// Step 1 of the online screen: which backend to use (ip:port on the LAN, or the https address
// it has on the internet).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { displayServer } from '../../../net/client';
import { DEFAULT_PORT } from '../../../net/protocol';
import type { Online } from '../../online/useOnline';
import { forgetServer, recentServers } from '../../online/useOnline';
import { Icon } from '../pixel';

export function ServerStep({ online, initial, onAddress }: { online: Online; initial: string; onAddress: (a: string) => void }) {
  const [address, setAddress] = useState(initial);
  const [recent, setRecent] = useState(recentServers);
  const s = online.server;
  const checking = s.phase === 'checking';

  const go = (a: string) => {
    setAddress(a);
    onAddress(a);
    void online.connect(a);
  };

  return (
    <section className="online-card online-step frame-parchment" aria-labelledby="server-title">
      <h2 className="online-card-title" id="server-title">
        <Icon name="globe" scale={2} /> Kapcsolódás a szerverhez
      </h2>
      <p className="online-lead">
        Add meg a Mana Chess <b>backend</b> szerver címét. A helyi hálózaton ez <b>ip:port</b> (például 192.168.1.23:{DEFAULT_PORT}), interneten
        a szerver <b>https://</b> címe.
      </p>
      <form
        className="online-row"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go(address);
        }}
      >
        <label className="field">
          <Icon name="globe" scale={1} />
          <input
            id="server-address"
            value={address}
            placeholder={`192.168.1.23:${DEFAULT_PORT} vagy https://sakk.pelda.hu`}
            aria-label="A szerver címe"
            autoComplete="url"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="url"
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" id="server-connect" disabled={checking || !address.trim()}>
          {checking ? 'Keresem…' : 'Kapcsolódás'}
        </button>
      </form>
      {s.phase === 'error' && (
        <p className="msg msg-error" role="alert">
          {s.error}
          {s.hint && <span className="msg-more">{s.hint}</span>}
          {!s.hint && s.origin && <span className="msg-more">Fut a backend ({displayServer(s.origin)})? Ugyanazon a hálózaton vagytok? A tűzfal átengedi a portot?</span>}
        </p>
      )}
      {recent.length > 0 && (
        <>
          <h3 className="section-title">Legutóbbi szerverek</h3>
          <ul className="server-list">
            {recent.map((r) => (
              <li key={r}>
                <button type="button" className="server-pick" disabled={checking} onClick={() => go(displayServer(r))}>
                  <Icon name="globe" scale={1} /> <span>{displayServer(r)}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-icon"
                  aria-label={`${displayServer(r)} törlése a listából`}
                  onClick={() => {
                    forgetServer(r);
                    setRecent(recentServers());
                  }}
                >
                  <Icon name="close" scale={1} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="online-howto">
        <h3 className="section-title">Honnan tudom a címet?</h3>
        <ul className="online-bullets">
          <li>
            <b>Helyi hálózat (LAN):</b> valamelyikőtök gépén fusson a backend (<b>mana-chess-backend</b> mappa → <b>Start.bat</b>). Az ablaka
            kiírja a címet, pl. <b>192.168.1.23:{DEFAULT_PORT}</b> – a többiek ezt írják be.
          </li>
          <li>
            <b>Interneten:</b> a szerver gazdája adja meg a https-es címet (pl. <b>https://sakk.pelda.hu</b>).
          </li>
          <li>Fiók nélkül is játszhatsz (vendégként), ha a szerver engedi – ilyenkor a pakliid ebben a böngészőben maradnak.</li>
        </ul>
      </div>
    </section>
  );
}

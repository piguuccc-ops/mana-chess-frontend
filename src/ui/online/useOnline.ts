// ─────────────────────────────────────────────────────────────────────────────
// The online side of the app, kept above the screens: which backend we talk to, the signed-in
// account (its profile, friends and challenges) and the account's live stream. It lives for the
// whole visit, so a challenge reaches the player on any screen.
//
//   • The backend address: typed in (ip:port or https://…), the one used last time, or a default
//     the page was served with (<meta name="mana-chess-backend">, see server/frontend.ts).
//   • Signing in keeps a session token – in localStorage („remember me”) or sessionStorage – and
//     the next visit continues with it.
//   • Guest play (LAN mode): no account, the decks stay in this browser.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccountApi, AccountSession, login as loginCall, NetError, normalizeServer, reachHint, register as registerCall, serverInfo,
  type Connection,
} from '../../net/client';
import { DEFAULT_PORT, type AccountEvent, type MeView, type RoomState, type Seat, type ServerInfo } from '../../net/protocol';

const ACCOUNT_KEY = 'mana-chess.account.v1';
const SERVERS_KEY = 'mana-chess.servers.v1';
/** The server this browser last played on as a guest (it goes straight to the lobby next time). */
const GUEST_KEY = 'mana-chess.guest.v1';

export type ServerState =
  | { phase: 'idle' }
  | { phase: 'checking'; origin: string }
  | { phase: 'ok'; origin: string; info: ServerInfo }
  | { phase: 'error'; origin: string | null; error: string; hint: string | null };

export interface AccountState {
  server: string;
  token: string;
  me: MeView;
  api: AccountApi;
}

export interface OnlineHooks {
  /** A challenge we sent was accepted: the room and our seat in it. */
  onGame(server: string, seat: Seat, state: RoomState): void;
  /** Something to tell the player („X kihívott…”, „a bejelentkezés lejárt”). */
  notify(text: string, tone?: 'info' | 'error'): void;
}

export interface Online {
  server: ServerState;
  account: AccountState | null;
  /** The account stream's link to the backend. */
  link: Connection;
  /** Playing on the current server without an account (LAN mode). */
  guest: boolean;
  /** `quiet`: a guess – failing to reach it shows no error. */
  connect(address: string, quiet?: boolean): Promise<boolean>;
  /** Forget the current server (back to the address box). */
  disconnect(): void;
  /** Fetch the server's settings again (registration, guests…). */
  reloadInfo(): Promise<void>;
  login(name: string, password: string, remember: boolean): Promise<string | null>;
  register(name: string, password: string, remember: boolean): Promise<{ error?: string; pending?: boolean }>;
  logout(): Promise<void>;
  setGuest(on: boolean): void;
  /** Fetch the profile again (after an action whose answer does not carry it). */
  refresh(): Promise<void>;
}

// ── storage (every access guarded: storage may be missing or blocked) ──

type Area = 'local' | 'session';
function area(kind: Area): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
function readJson<T>(kind: Area, key: string): T | null {
  try {
    const raw = area(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(kind: Area, key: string, value: unknown): void {
  try {
    if (value === null) area(kind)?.removeItem(key);
    else area(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // no storage: the login lasts until the page is closed
  }
}

interface SavedLogin {
  server: string;
  token: string;
  name: string;
}
function savedLogin(): SavedLogin | null {
  for (const kind of ['local', 'session'] as const) {
    const v = readJson<SavedLogin>(kind, ACCOUNT_KEY);
    if (v && typeof v.server === 'string' && typeof v.token === 'string') return v;
  }
  return null;
}
function saveLogin(v: SavedLogin | null, remember = true): void {
  writeJson('local', ACCOUNT_KEY, null);
  writeJson('session', ACCOUNT_KEY, null);
  if (v) writeJson(remember ? 'local' : 'session', ACCOUNT_KEY, v);
}

/** Servers used before, the latest first (for one-tap reconnecting). */
export function recentServers(): string[] {
  const v = readJson<string[]>('local', SERVERS_KEY);
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, 5) : [];
}
function rememberServer(origin: string): void {
  writeJson('local', SERVERS_KEY, [origin, ...recentServers().filter((s) => s !== origin)].slice(0, 5));
}
export function forgetServer(origin: string): void {
  writeJson('local', SERVERS_KEY, recentServers().filter((s) => s !== origin));
}

/** The backend the page was served with (the frontend's --backend option), if any. */
export function defaultBackend(): string | null {
  if (typeof document === 'undefined') return null;
  const v = document.querySelector('meta[name="mana-chess-backend"]')?.getAttribute('content');
  return v ? normalizeServer(v) : null;
}

/** The address the online screen starts with: the signed-in server, the last one used, or the page's default. */
export function startAddress(lastUsed: string): string | null {
  return savedLogin()?.server ?? normalizeServer(lastUsed) ?? defaultBackend();
}

/**
 * A guess when nothing else is known: the page came from a frontend on some machine (http, LAN) –
 * the backend usually runs on the same machine, on its default port.
 */
export function guessBackend(): string | null {
  if (typeof location === 'undefined' || location.protocol !== 'http:' || !location.hostname) return null;
  return normalizeServer(`${location.hostname.includes(':') ? `[${location.hostname}]` : location.hostname}:${DEFAULT_PORT}`);
}

const errorText = (e: unknown) => (e instanceof NetError ? e.message : 'Nem érem el a szervert.');

export function useOnline(hooks: OnlineHooks): Online {
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  const [server, setServer] = useState<ServerState>({ phase: 'idle' });
  const [account, setAccount] = useState<AccountState | null>(null);
  const [link, setLink] = useState<Connection>('online');
  const [guest, setGuestState] = useState(false);
  const accountRef = useRef(account);
  accountRef.current = account;
  const stream = useRef<AccountSession | null>(null);
  const connectSeq = useRef(0);
  const refreshTimer = useRef(0);

  const stopStream = () => {
    stream.current?.stop();
    stream.current = null;
    window.clearTimeout(refreshTimer.current);
  };

  const signedOut = useCallback((reason: string | null) => {
    stopStream();
    saveLogin(null);
    setAccount(null);
    if (reason) hooksRef.current.notify(reason, 'error');
  }, []);

  const refresh = useCallback(async () => {
    const a = accountRef.current;
    if (!a) return;
    const r = await a.api.me().catch(() => null);
    if (!r || accountRef.current?.token !== a.token) return;
    if (r.ok) setAccount((cur) => (cur && cur.token === a.token ? { ...cur, me: r.me } : cur));
    else if (r.auth === false) signedOut(r.error);
  }, [signedOut]);

  const onEvent = useCallback(
    (server: string, e: AccountEvent) => {
      if (e.type === 'refresh') {
        // a burst of changes (a request accepted, a challenge sent…) is fetched once
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = window.setTimeout(() => void refresh(), 120);
        if (e.notice) hooksRef.current.notify(e.notice, 'info');
      } else if (e.type === 'presence') {
        setAccount((a) => a && { ...a, me: { ...a.me, friends: a.me.friends.map((f) => (f.id === e.userId ? { ...f, status: e.status } : f)) } });
      } else if (e.type === 'game') {
        hooksRef.current.onGame(server, e.seat, e.state);
      } else if (e.type === 'signedOut') {
        signedOut(e.reason);
      }
    },
    [refresh, signedOut],
  );

  const begin = useCallback(
    (server: string, token: string, me: MeView, last: number) => {
      stopStream();
      const s = new AccountSession(server, token, last);
      stream.current = s;
      s.subscribe((e) => onEvent(server, e));
      s.onConnection(setLink);
      setLink('online');
      s.start();
      setGuestState(false);
      setAccount({ server, token, me, api: new AccountApi(server, token) });
    },
    [onEvent],
  );

  /** Continue a login saved on this device (after checking that the token still works). */
  const resume = useCallback(
    async (saved: SavedLogin, seq: number) => {
      const r = await new AccountApi(saved.server, saved.token).me().catch(() => null);
      if (!r || seq !== connectSeq.current) return; // unreachable right now (kept for later), or another server was chosen meanwhile
      if (!r.ok) {
        if (r.auth === false) saveLogin(null);
        return;
      }
      begin(saved.server, saved.token, r.me, r.last);
    },
    [begin],
  );

  const connect = useCallback(
    async (address: string, quiet = false) => {
      const origin = normalizeServer(address);
      if (!origin) {
        setServer({ phase: 'error', origin: null, error: `Adj meg egy címet, például 192.168.1.23:${DEFAULT_PORT} vagy https://sakk.pelda.hu`, hint: null });
        return false;
      }
      const seq = ++connectSeq.current;
      // an account belongs to one server: going elsewhere signs it out here
      if (accountRef.current && accountRef.current.server !== origin) signedOut(null);
      setServer({ phase: 'checking', origin });
      try {
        const info = await serverInfo(origin);
        if (seq !== connectSeq.current) return false;
        rememberServer(origin);
        const saved = savedLogin();
        if (saved && saved.server === origin && !accountRef.current) await resume(saved, seq);
        if (seq !== connectSeq.current) return false;
        // played here as a guest last time: straight back to the lobby
        if (!accountRef.current && info.guests && readJson<string>('local', GUEST_KEY) === origin) setGuestState(true);
        setServer({ phase: 'ok', origin, info });
        return true;
      } catch (e) {
        if (seq === connectSeq.current) setServer(quiet ? { phase: 'idle' } : { phase: 'error', origin, error: errorText(e), hint: reachHint(origin) });
        return false;
      }
    },
    [resume, signedOut],
  );

  const reloadInfo = useCallback(async () => {
    const s = server;
    if (s.phase !== 'ok') return;
    try {
      const info = await serverInfo(s.origin);
      setServer((cur) => (cur.phase === 'ok' && cur.origin === s.origin ? { ...cur, info } : cur));
    } catch {
      // keep what we have; the next action will tell if the server is gone
    }
  }, [server]);

  const setGuest = useCallback(
    (on: boolean) => {
      setGuestState(on);
      writeJson('local', GUEST_KEY, on && server.phase === 'ok' ? server.origin : null);
    },
    [server],
  );

  const disconnect = useCallback(() => {
    connectSeq.current += 1;
    if (accountRef.current) signedOut(null);
    setGuestState(false);
    writeJson('local', GUEST_KEY, null);
    setServer({ phase: 'idle' });
  }, [signedOut]);

  const login = useCallback(
    async (name: string, password: string, remember: boolean): Promise<string | null> => {
      if (server.phase !== 'ok') return 'Előbb kapcsolódj egy szerverhez.';
      try {
        const r = await loginCall(server.origin, name, password);
        if (!r.ok) return r.error;
        saveLogin({ server: server.origin, token: r.token, name: r.me.user.name }, remember);
        begin(server.origin, r.token, r.me, r.last);
        return null;
      } catch (e) {
        return errorText(e);
      }
    },
    [server, begin],
  );

  const register = useCallback(
    async (name: string, password: string, remember: boolean) => {
      if (server.phase !== 'ok') return { error: 'Előbb kapcsolódj egy szerverhez.' };
      try {
        const r = await registerCall(server.origin, name, password);
        if (!r.ok) return { error: r.error };
        if (r.status === 'pending' || !r.token || !r.me) return { pending: true };
        saveLogin({ server: server.origin, token: r.token, name: r.me.user.name }, remember);
        begin(server.origin, r.token, r.me, r.last ?? 0);
        return {};
      } catch (e) {
        return { error: errorText(e) };
      }
    },
    [server, begin],
  );

  const logout = useCallback(async () => {
    const a = accountRef.current;
    signedOut(null);
    if (a) await a.api.logout().catch(() => undefined);
  }, [signedOut]);

  // a login saved on this device: sign in again right away (challenges reach every screen)
  useEffect(() => {
    const saved = savedLogin();
    if (saved) void connect(saved.server);
    return () => stopStream();
  }, [connect]);

  return { server, account, link, guest, connect, disconnect, reloadInfo, login, register, logout, setGuest, refresh };
}

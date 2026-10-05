// The Android app's bridge (window.ManaAndroid, see android/src/…/MainActivity.java) and its
// fall-backs in a browser: vibration, keeping the screen awake during a game, the back button,
// and opening links outside the app.

interface AndroidBridge {
  vibrate(ms: number): void;
  vibratePattern(pattern: string): void;
  keepScreenOn(on: boolean): void;
  openExternal(url: string): void;
  appVersion(): string;
}

const bridge = (): AndroidBridge | null => {
  if (typeof window === 'undefined') return null;
  return ((window as unknown as { ManaAndroid?: AndroidBridge }).ManaAndroid ?? null);
};

/** Running inside the Mana Chess Android app. */
export const inAndroidApp = (): boolean => !!bridge();

/** A phone or tablet (touch first) – Oli notices. */
export function onPhone(): boolean {
  if (inAndroidApp()) return true;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

let vibrationOn = true;
export const setVibration = (on: boolean) => {
  vibrationOn = on;
};

/** A short buzz (ms), or a pattern of buzz / pause / buzz … */
export function vibrate(pattern: number | number[]): void {
  if (!vibrationOn) return;
  try {
    const b = bridge();
    if (b) {
      if (Array.isArray(pattern)) b.vibratePattern(pattern.join(','));
      else b.vibrate(pattern);
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* decoration only */
  }
}

/** The app keeps the screen on while a game is open. */
export function keepScreenOn(on: boolean): void {
  try {
    bridge()?.keepScreenOn(on);
  } catch {
    /* ignore */
  }
}

/** Opens a link in the phone's browser (inside the app), or a new tab. */
export function openExternal(url: string): void {
  const b = bridge();
  if (b) {
    b.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener');
}

/** Where a new version of the Android app can be downloaded (the frontend repository's releases). */
export const APP_RELEASES = 'https://github.com/piguuccc-ops/mana-chess-frontend/releases/latest';

/** The app's version name (empty in a browser). */
export function appVersion(): string {
  try {
    return bridge()?.appVersion() ?? '';
  } catch {
    return '';
  }
}

// ── the back button (Android): the screens register what „back” means for them ──

type BackHandler = () => boolean;
const backStack: BackHandler[] = [];

/** While mounted, `handler` answers the back button first (return true when it did something). */
export function pushBack(handler: BackHandler): () => void {
  backStack.push(handler);
  return () => {
    const i = backStack.lastIndexOf(handler);
    if (i >= 0) backStack.splice(i, 1);
  };
}

/** Called by the app on the back button: true = handled, false = leave the app. */
export function handleBack(): boolean {
  for (let i = backStack.length - 1; i >= 0; i--) {
    try {
      if (backStack[i]()) return true;
    } catch {
      /* the next one */
    }
  }
  // no screen took it: a dialog or panel open in the page may still close on Escape
  return false;
}

if (typeof window !== 'undefined') {
  (window as unknown as { __manaBack?: () => boolean }).__manaBack = handleBack;
}

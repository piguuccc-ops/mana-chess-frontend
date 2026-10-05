// Runs a bot's decision off the main thread when it can (a Web Worker started from the bundle
// the single-file build embeds), and on the main thread otherwise (development, tests, a browser
// that refuses workers). Either way the answer comes back as a promise.
import { botNextAction, CLASSIC } from '../ai/botSearch';
import { BOT_STRENGTH, type BotId } from '../bots/strength';
import type { Action, GameState } from '../engine';

declare const __AI_WORKER_SRC__: string | undefined;

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, (a: Action | null | undefined) => void>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  try {
    if (typeof __AI_WORKER_SRC__ !== 'string' || typeof Worker === 'undefined' || typeof Blob === 'undefined') return null;
    const url = URL.createObjectURL(new Blob([__AI_WORKER_SRC__], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = (e: MessageEvent<{ id: number; action?: Action | null; error?: string }>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      // an error in the worker: the main thread tries once more
      done?.(e.data.error ? undefined : (e.data.action ?? null));
    };
    w.onerror = () => {
      // the worker died (or never started): everyone waiting falls back to the main thread
      worker = null;
      for (const [, done] of waiting) done(undefined);
      waiting.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

const onMainThread = (state: GameState, bot: BotId | null): Promise<Action | null> =>
  new Promise((resolve) => window.setTimeout(() => resolve(botNextAction(state, bot ? BOT_STRENGTH[bot] : CLASSIC)), 0));

/** The bot's next action for `state` (`bot` null: the classic in-game AI). */
export function botAction(state: GameState, bot: BotId | null): Promise<Action | null> {
  const w = getWorker();
  if (!w) return onMainThread(state, bot);
  return new Promise((resolve) => {
    const id = nextId++;
    const limit = window.setTimeout(() => {
      // far too slow (or lost): decide here instead
      if (!waiting.delete(id)) return;
      void onMainThread(state, bot).then(resolve);
    }, 30_000);
    waiting.set(id, (a) => {
      window.clearTimeout(limit);
      if (a === undefined) void onMainThread(state, bot).then(resolve);
      else resolve(a);
    });
    try {
      w.postMessage({ id, state, bot });
    } catch {
      waiting.delete(id);
      window.clearTimeout(limit);
      void onMainThread(state, bot).then(resolve);
    }
  });
}

// The bots think here, in a Web Worker, so the board keeps moving while they search. The page
// builds this file into a separate bundle and starts it from a Blob (see src/ui/botRunner.ts).
import type { GameState } from '../engine';
import { BOT_STRENGTH, type BotId } from '../bots/strength';
import { botNextAction, CLASSIC } from './botSearch';

interface Ask {
  id: number;
  state: GameState;
  bot: BotId | null;
}

const ctx = self as unknown as { onmessage: ((e: MessageEvent<Ask>) => void) | null; postMessage: (m: unknown) => void };
ctx.onmessage = (e) => {
  const { id, state, bot } = e.data;
  try {
    const action = botNextAction(state, bot ? BOT_STRENGTH[bot] : CLASSIC);
    ctx.postMessage({ id, action });
  } catch (err) {
    ctx.postMessage({ id, error: String((err as Error)?.message ?? err) });
  }
};

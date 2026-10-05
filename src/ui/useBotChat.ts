// The bot at the other side of the board talks: about the start, every move worth a word, your
// spells and blunders, the end – and in between, when you think too long, just small talk.
// (What it says comes from src/bots; this hook only decides when.)
import { useEffect, useRef, useState } from 'react';
import { chatEvents, freshMemory, PERSONAS, pickLine, TALK_CHANCE, type ChatEvent } from '../bots/chat';
import type { BotId } from '../bots/roster';
import type { Color, GameState } from '../engine';
import type { Batch } from './vfx/choreo';

export interface BotLine {
  id: number;
  text: string;
  /** How long the bubble stays up (ms). */
  ms: number;
  /** The battle report's length when it was said (the line sits after that entry). */
  logAt: number;
}

/** Events a bot may skip when it has just spoken. */
const CHEAP = new Set(['playerMove', 'botMove', 'winning', 'losing', 'chatter', 'idle']);
let lineId = 1;

const readingTime = (text: string) => Math.min(8000, 2600 + text.length * 55);

export function useBotChat(o: {
  bot: BotId | null;
  botColor: Color;
  state: GameState;
  batch: Batch | null;
  enabled: boolean;
  /** Played on a phone (Oli notices). */
  phone: boolean;
}): { line: BotLine | null; log: BotLine[] } {
  const persona = o.bot ? PERSONAS[o.bot] : null;
  const mem = useRef(persona ? freshMemory(persona) : null);
  const [line, setLine] = useState<BotLine | null>(null);
  const [log, setLog] = useState<BotLine[]>([]);
  const lastAt = useRef(0);
  const stateRef = useRef(o.state);
  stateRef.current = o.state;
  const optsRef = useRef(o);
  optsRef.current = o;

  const say = (ev: ChatEvent): boolean => {
    const { enabled, phone } = optsRef.current;
    if (!persona || !mem.current || !enabled) return false;
    const said = pickLine(persona, ev, mem.current, phone);
    if (!said) return false;
    const l: BotLine = { id: lineId++, text: said.text, ms: readingTime(said.text), logAt: stateRef.current.log.length };
    lastAt.current = performance.now();
    setLine(l);
    setLog((all) => [...all.slice(-60), l]);
    return true;
  };
  const sayRef = useRef(say);
  sayRef.current = say;

  // hello – once the scene has settled
  useEffect(() => {
    if (!persona) return;
    const t = window.setTimeout(() => sayRef.current({ trigger: 'intro' }), 1100);
    return () => window.clearTimeout(t);
  }, [persona]);

  // every step at the board may get a word
  const seenBatch = useRef<number | null>(null);
  useEffect(() => {
    const b = o.batch;
    if (!persona || !b || b.id === seenBatch.current || b.rewind) return;
    seenBatch.current = b.id;
    const since = performance.now() - lastAt.current;
    for (const ev of chatEvents(b.before, b.after, b.action, o.botColor)) {
      if (CHEAP.has(ev.trigger) && since < 2600) continue;
      if (Math.random() > Math.min(1, TALK_CHANCE[ev.trigger] * persona.talk)) continue;
      // a beat after the move, so the bubble does not cover the animation's start
      window.setTimeout(() => sayRef.current(ev), ev.trigger === 'win' || ev.trigger === 'lose' || ev.trigger === 'draw' ? 900 : 450);
      break;
    }
  }, [o.batch, persona, o.botColor]);

  // thinking for long → a nudge; and small talk now and then (non-stop for the chatty ones)
  const playing = o.state.status.kind === 'playing';
  const yourTurn = playing && o.state.turn !== o.botColor && !o.state.pendingPromotion;
  useEffect(() => {
    // the clock restarts with every new position
    if (!persona || !yourTurn) return;
    const t = window.setTimeout(() => sayRef.current({ trigger: 'idle' }), 16000 + Math.random() * 6000);
    return () => window.clearTimeout(t);
  }, [persona, yourTurn, o.state]);
  useEffect(() => {
    if (!persona || !playing) return;
    let t = 0;
    const chatter = () => {
      const quiet = performance.now() - lastAt.current;
      if (quiet > 7000 && Math.random() < persona.talk) sayRef.current({ trigger: 'chatter' });
      t = window.setTimeout(chatter, (9000 + Math.random() * 9000) / Math.max(0.35, persona.talk));
    };
    t = window.setTimeout(chatter, (8000 + Math.random() * 6000) / Math.max(0.35, persona.talk));
    return () => window.clearTimeout(t);
  }, [persona, playing]);

  return { line: o.enabled ? line : null, log: o.enabled ? log : [] };
}

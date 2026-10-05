// The bot's speech bubble: the line types itself out with little beeps in the bot's voice,
// stays up long enough to read, then fades. Tapping it closes it early.
import { useEffect, useState } from 'react';
import { PERSONAS } from '../../bots/chat';
import { BOTS, botFullName, type BotId } from '../../bots/roster';
import { voiceBlip } from '../audio/sound';
import type { BotLine } from '../useBotChat';
import { BotPortrait } from './BotPortrait';

export function ChatBubble({ bot, line, reduced, voice, placement = 'left' }: { bot: BotId; line: BotLine | null; reduced: boolean; voice: boolean; placement?: 'left' | 'right' }) {
  const [shown, setShown] = useState<BotLine | null>(null);
  const [chars, setChars] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!line) return;
    setShown(line);
    setLeaving(false);
    setChars(reduced ? line.text.length : 0);
    const timers: number[] = [];
    if (!reduced) {
      const { pitch, wave } = PERSONAS[bot].voice;
      const total = [...line.text].length;
      let i = 0;
      const step = () => {
        i = Math.min(total, i + 2);
        setChars(i);
        if (voice && i % 4 === 2 && line.text[i - 1] !== ' ') voiceBlip(pitch, wave);
        if (i < total) timers.push(window.setTimeout(step, 34));
      };
      timers.push(window.setTimeout(step, 60));
    }
    timers.push(window.setTimeout(() => setLeaving(true), line.ms));
    timers.push(window.setTimeout(() => setShown((s) => (s?.id === line.id ? null : s)), line.ms + 400));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [line, bot, reduced, voice]);

  if (!shown) return null;
  const b = BOTS[bot];
  const text = [...shown.text];
  return (
    <div className={`chat-bubble at-${placement} ${leaving ? 'is-leaving' : ''}`} role="status" aria-live="polite" onClick={() => setLeaving(true)}>
      <BotPortrait id={bot} scale={1} className="chat-bubble-face" talking={!leaving && chars < text.length} />
      <div className="chat-bubble-body">
        <b className="chat-bubble-name" style={{ color: b.accent }}>
          {botFullName(b)}
        </b>
        <p className="chat-bubble-text">
          {text.slice(0, chars).join('')}
          <span className="chat-bubble-rest" aria-hidden="true">
            {text.slice(chars).join('')}
          </span>
        </p>
      </div>
    </div>
  );
}

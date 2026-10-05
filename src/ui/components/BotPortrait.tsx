// A bot's framed portrait (pixel art on its own colour) and its Elo badge.
import { BOTS, type BotId } from '../../bots/roster';
import { portrait } from '../pixel/art/portraits';
import { Sprite } from './pixel';

export function BotPortrait({ id, scale = 2, className, talking }: { id: BotId; scale?: number; className?: string; talking?: boolean }) {
  const b = BOTS[id];
  return (
    <span
      className={`bot-portrait tier-${b.tier}${talking ? ' is-talking' : ''}${className ? ' ' + className : ''}`}
      style={{ '--accent': b.accent, '--size-default': `${32 * scale}px` } as Record<string, string>}
      aria-hidden="true"
    >
      <Sprite src={portrait(id)} scale={scale} className="bot-portrait-img" />
    </span>
  );
}

export function EloBadge({ elo, tier, title }: { elo: number; tier?: string; title?: string }) {
  return (
    <span className={`elo-badge${tier ? ` tier-${tier}` : ''}`} title={title ?? `Élő-pontszám: ${elo}`}>
      {elo}
    </span>
  );
}

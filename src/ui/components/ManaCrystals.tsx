import { useLayoutEffect, useState } from 'react';
import type { Color } from '../../engine';
import type { ManaAnim } from '../vfx/choreo';
import { CrystalSprite } from './pixel';

export const MAX_MANA = 6;

interface Props {
  color: Color;
  mana: number;
  /** Current maximum (Arcane Surge lowers it). */
  cap: number;
  anim?: ManaAnim;
  /** Changes whenever a new animation plan starts (re-triggers the CSS). */
  planId: number;
  scale?: number;
  showCount?: boolean;
}

/**
 * Physical mana crystals in iron sockets. Spent crystals crack and fall out,
 * gained ones grow back in their sockets – timed by the animation plan.
 */
export function ManaCrystals({ color, mana, cap, anim, planId, scale = 3, showCount = true }: Props) {
  const changeAt = anim ? Math.round(Math.min(anim.spendAt, anim.gainAt)) : 0;
  // the number keeps its old value until the crystals really change (a long cinematic may come first)
  const [shown, setShown] = useState(mana);
  useLayoutEffect(() => {
    if (!anim || changeAt <= 0 || anim.from === mana) {
      setShown(mana);
      return;
    }
    setShown(anim.from);
    const t = window.setTimeout(() => setShown(mana), changeAt);
    return () => window.clearTimeout(t);
  }, [planId, mana]); // a new plan (or a new value) restarts the count
  const slots = [];
  for (let i = 0; i < MAX_MANA; i++) {
    const locked = i >= cap;
    const full = i < mana;
    const breaking = anim && i >= anim.mid && i < anim.from;
    const forming = anim && full && i >= anim.mid && i < anim.to;
    slots.push(
      <span key={i} className={`crystal-slot ${full ? 'is-full' : ''} ${locked ? 'is-locked' : ''}`} data-slot={i}>
        <CrystalSprite color={color} state={locked ? 'locked' : 'empty'} scale={scale} className="crystal-socket" />
        {full && !forming && <CrystalSprite color={color} state="full" scale={scale} className="crystal-gem" />}
        {forming && (
          <span key={`f${planId}`} className="crystal-anim is-forming" style={{ animationDelay: `${Math.round(anim!.gainAt + (i - anim!.mid) * 70)}ms` }}>
            <CrystalSprite color={color} state="full" scale={scale} className="crystal-gem" />
          </span>
        )}
        {breaking && (
          <span key={`b${planId}`} className="crystal-anim is-breaking" style={{ animationDelay: `${Math.round(anim!.spendAt + (anim!.from - 1 - i) * 60)}ms` }}>
            <CrystalSprite color={color} state="full" scale={scale} className="crystal-gem" />
          </span>
        )}
      </span>,
    );
  }
  return (
    <div className={`crystals crystals-${color}`} data-crystals={color} aria-label={`Mana: ${mana} / ${MAX_MANA}`} role="img">
      <div className="crystal-row">{slots}</div>
      {showCount && (
        <div className="crystal-count">
          <b key={`n${planId}`} className={anim ? 'is-changing' : ''} style={anim ? { animationDelay: `${changeAt}ms` } : undefined}>
            {shown}
          </b>
          <small>/{MAX_MANA}</small>
        </div>
      )}
      {anim && anim.wasted > 0 && (
        <span key={`w${planId}`} className="crystal-waste" style={{ animationDelay: `${Math.round(anim.gainAt)}ms` }}>
          +{anim.wasted} elveszett
        </span>
      )}
    </div>
  );
}

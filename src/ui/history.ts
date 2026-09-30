// Undo / redo for local games (misclicks): every successful engine step is kept as a pair of
// whole snapshots, so stepping back restores the exact earlier state – mana, hands, effects,
// the chaos seed – and stepping forward replays the very same step.
import type { Action, GameState, Square } from '../engine';

export type LastMove = { from: Square; to: Square } | null;

export interface Snapshot {
  state: GameState;
  /** The highlighted last move, as the board showed it. */
  lastMove: LastMove;
}

export interface Step {
  action: Action;
  before: Snapshot;
  after: Snapshot;
}

export class GameHistory {
  private past: Step[] = [];
  private future: Step[] = [];

  constructor(private readonly limit = 400) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** A new step. Whatever was undone before it is forgotten (the game took another path). */
  record(step: Step): void {
    this.past.push(step);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  /** The step to take back (its `before` is the state to restore), or null. */
  undo(): Step | null {
    const s = this.past.pop();
    if (!s) return null;
    this.future.push(s);
    return s;
  }

  /** The step to replay (its `after` is the state to restore), or null. */
  redo(): Step | null {
    const s = this.future.pop();
    if (!s) return null;
    this.past.push(s);
    return s;
  }
}

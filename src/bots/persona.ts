// What a bot says, and when. The lines live in src/bots/lines/<bot>.ts.
//
// Triggers (what just happened at the board):
//   intro – the game starts                        win / lose / draw – the game is over (the bot's side)
//   playerMove – you made a quiet move             playerCapture – you took one of the bot's pieces
//   botMove – the bot made a quiet move            botCapture – the bot took one of yours
//   playerSpell / botSpell – a spell was cast      check – the bot gives check;  inCheck – you do
//   blunder – your move left something hanging     brilliant – your move won something big
//   winning / losing – the bot is far ahead/behind promotion – a pawn became something
//   idle – you have been thinking for a while      chatter – small talk between the moves
//   moodSwing – (moody bots) the mood just changed
//
// A key may carry a variant after '@': '@phone' / '@desktop' (Oli knows what you play on) and a
// mood ('@strict', '@chill' …). The most specific list that exists is used.
//
// Placeholders filled in at the board:
//   {p}    the piece, plain: „huszár”          {pacc}  „huszárt”         {pert}  „huszárért”
//   {yn}   your piece: „huszárod”              {pd}    „huszárodat”
//   {pn}   my piece: „huszárom”                {pm}    „huszáromat”
//   {spell} the spell's name                   {br}    (Nádi) a random brainrot name
export type ChatTrigger =
  | 'intro'
  | 'playerMove'
  | 'botMove'
  | 'playerCapture'
  | 'botCapture'
  | 'playerSpell'
  | 'botSpell'
  | 'check'
  | 'inCheck'
  | 'blunder'
  | 'brilliant'
  | 'winning'
  | 'losing'
  | 'promotion'
  | 'idle'
  | 'chatter'
  | 'moodSwing'
  | 'win'
  | 'lose'
  | 'draw';

export interface BotPersona {
  /** How talkative (1 = chatters non-stop, 0.3 = rarely says anything). */
  talk: number;
  /** The little beeps of the speech bubble: base pitch (Hz) and the wave. */
  voice: { pitch: number; wave: 'square' | 'triangle' | 'sine' | 'sawtooth' };
  /** Moody bots: the moods they swing between (the first is where they start). */
  moods?: string[];
  /** Chance that a line comes with a mood swing (moody bots). */
  swing?: number;
  lines: Partial<Record<string, readonly string[]>>;
  /** Words for {br}. */
  words?: readonly string[];
}

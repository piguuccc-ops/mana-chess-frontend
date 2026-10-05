// ─────────────────────────────────────────────────────────────────────────────
// Sound: every effect is synthesised with the Web Audio API (no audio files),
// routed through master / effects / ambience buses. The context only starts
// after the player's first click or key press (browser autoplay rules).
// To use recorded samples later, replace a recipe in RECIPES with a buffer
// player – the rest of the game only calls sfx(name) / setAmbience(kind).
// ─────────────────────────────────────────────────────────────────────────────

export interface SoundSettings {
  master: number;
  sfx: number;
  ambient: number;
  muted: boolean;
}

export type SfxName =
  | 'click'
  | 'cardPick'
  | 'cardDrop'
  | 'page'
  | 'open'
  | 'back'
  | 'move'
  | 'capture'
  | 'check'
  | 'mate'
  | 'promote'
  | 'illegal'
  | 'fire'
  | 'lightning'
  | 'holy'
  | 'shield'
  | 'teleport'
  | 'dark'
  | 'freeze'
  | 'earth'
  | 'wind'
  | 'summon'
  | 'time'
  | 'explosion'
  | 'shot'
  | 'arcane'
  | 'manaGain'
  | 'manaSpend'
  | 'defuse'
  | 'turn'
  | 'victory'
  | 'defeat'
  | 'reaper'
  | 'scythe'
  | 'rewind'
  | 'glassCurse'
  | 'glass'
  | 'doomCast'
  | 'ward'
  | 'realityCrack'
  | 'singularity'
  | 'doomBoom'
  | 'glitch'
  | 'erase'
  | 'doomBass'
  | 'doomBlast'
  | 'charge'
  | 'awaken';

export type Ambience = 'menu' | 'war' | null;

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let ambBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let settings: SoundSettings = { master: 0.7, sfx: 0.8, ambient: 0.35, muted: false };
let wantedAmbience: Ambience = null;
let ambienceStop: (() => void) | null = null;
const lastPlayed = new Map<SfxName, number>();

function ensure(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    ambBus = ctx.createGain();
    sfxBus.connect(master);
    ambBus.connect(master);
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
  }
  return ctx;
}

function applyVolumes() {
  if (!ctx || !master || !sfxBus || !ambBus) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.05);
  ambBus.gain.setTargetAtTime(settings.ambient * 0.6, t, 0.2);
}

/** Call once from the first user gesture. */
export function unlockAudio(): void {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
  if (wantedAmbience && !ambienceStop) startAmbience(wantedAmbience);
}

// A hidden page (another tab, the Android app sent to the background, the phone locked) goes
// quiet: the audio is suspended until the page is seen again.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      if (ctx.state === 'running') void ctx.suspend().catch(() => undefined);
    } else if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  });
}

export function setSoundSettings(s: SoundSettings): void {
  settings = { ...s };
  applyVolumes();
}

export const soundSettings = () => settings;

// ── Building blocks ──────────────────────────────────────────────────────────

interface ToneOpts {
  f: number;
  f2?: number;
  type?: OscillatorType;
  dur: number;
  gain?: number;
  attack?: number;
  delay?: number;
  bus?: GainNode | null;
  detune?: number;
}

function tone(o: ToneOpts) {
  const c = ctx!;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  const peak = o.gain ?? 0.2;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(o.bus ?? sfxBus!);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

interface NoiseOpts {
  dur: number;
  type?: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  gain?: number;
  attack?: number;
  delay?: number;
  bus?: GainNode | null;
}

function noise(o: NoiseOpts) {
  const c = ctx!;
  const t0 = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.type ?? 'bandpass';
  filter.frequency.setValueAtTime(o.f, t0);
  if (o.f2) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + o.dur);
  filter.Q.value = o.q ?? 1;
  const g = c.createGain();
  const peak = o.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(o.bus ?? sfxBus!);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + o.dur + 0.05);
}

const bell = (f: number, dur: number, gain: number, delay = 0) => {
  tone({ f, dur, gain, delay, type: 'sine' });
  tone({ f: f * 2.76, dur: dur * 0.6, gain: gain * 0.35, delay, type: 'sine' });
  tone({ f: f * 5.4, dur: dur * 0.3, gain: gain * 0.15, delay, type: 'sine' });
};

// ── Recipes ─────────────────────────────────────────────────────────────────

const RECIPES: Record<SfxName, () => void> = {
  click: () => {
    tone({ f: 900, f2: 600, type: 'square', dur: 0.05, gain: 0.05 });
    noise({ dur: 0.03, type: 'highpass', f: 3000, gain: 0.05 });
  },
  cardPick: () => {
    noise({ dur: 0.09, type: 'bandpass', f: 1800, f2: 4200, q: 0.8, gain: 0.09 });
    tone({ f: 660, f2: 880, dur: 0.07, gain: 0.04, delay: 0.02 });
  },
  cardDrop: () => {
    noise({ dur: 0.1, type: 'lowpass', f: 1200, f2: 400, gain: 0.12 });
    tone({ f: 260, f2: 180, dur: 0.1, gain: 0.08 });
  },
  page: () => noise({ dur: 0.22, type: 'bandpass', f: 2600, f2: 700, q: 0.7, gain: 0.1 }),
  open: () => noise({ dur: 0.32, type: 'lowpass', f: 250, f2: 1600, gain: 0.09, attack: 0.08 }),
  back: () => noise({ dur: 0.25, type: 'lowpass', f: 1400, f2: 250, gain: 0.08, attack: 0.02 }),
  // „Üvegátok” cast: a crystal chime with a sour, beating twin and a dark hum underneath
  glassCurse: () => {
    tone({ f: 1568, dur: 1.1, gain: 0.05, type: 'triangle' });
    tone({ f: 1661, dur: 0.9, gain: 0.035, type: 'triangle', delay: 0.05 });
    tone({ f: 3136, dur: 0.5, gain: 0.02, delay: 0.02 });
    noise({ dur: 0.45, type: 'bandpass', f: 5200, f2: 1400, q: 2, gain: 0.07, attack: 0.03 });
    tone({ f: 104, f2: 82, type: 'sawtooth', dur: 0.7, gain: 0.05, attack: 0.08, delay: 0.1 });
  },
  // a glass piece breaking: a sharp crack, a spray of tiny shards, the pieces tinkling down
  glass: () => {
    noise({ dur: 0.07, type: 'highpass', f: 3800, f2: 2200, gain: 0.26 });
    tone({ f: 190, f2: 90, dur: 0.09, gain: 0.12 });
    noise({ dur: 0.42, type: 'bandpass', f: 7200, f2: 4200, q: 1.2, gain: 0.1, attack: 0.01, delay: 0.02 });
    const notes = [3322, 4186, 5274, 3951, 6272, 4699, 3520, 5588];
    notes.forEach((f, i) => tone({ f: f * (0.97 + Math.random() * 0.06), dur: 0.07 + Math.random() * 0.12, gain: 0.03 + Math.random() * 0.025, type: i % 2 ? 'triangle' : 'sine', delay: 0.03 + i * 0.032 + Math.random() * 0.02 }));
  },
  // „Végzet” – the crystals shatter while every mote of mana is sucked back towards the caster
  doomCast: () => {
    noise({ dur: 0.08, type: 'highpass', f: 4200, f2: 2400, gain: 0.24 });
    [2637, 3520, 4186].forEach((f, i) => tone({ f, dur: 0.16, gain: 0.03, type: 'triangle', delay: 0.02 + i * 0.03 }));
    noise({ dur: 0.42, type: 'bandpass', f: 300, f2: 5200, q: 1.4, gain: 0.14, attack: 0.36 });
    tone({ f: 70, f2: 40, dur: 0.5, gain: 0.2, delay: 0.34 });
  },
  // a faint ward being raised (one of the ways the piece could have been saved)
  ward: () => {
    tone({ f: 1318, dur: 0.22, gain: 0.03, type: 'triangle' });
    tone({ f: 1976, dur: 0.18, gain: 0.02, delay: 0.03 });
  },
  // reality cracking: a dry snap with a hollow knock under it
  realityCrack: () => {
    noise({ dur: 0.06 + Math.random() * 0.03, type: 'highpass', f: 2600 + Math.random() * 1400, f2: 1200, gain: 0.3 });
    tone({ f: 130 + Math.random() * 40, f2: 55, dur: 0.14, gain: 0.2 });
    tone({ f: 4200 + Math.random() * 900, dur: 0.05, gain: 0.03, delay: 0.01 });
  },
  // the piece pulled into a point: a rising suck that swells into nothing
  singularity: () => {
    tone({ f: 60, f2: 900, dur: 0.46, gain: 0.07, type: 'sawtooth', attack: 0.3 });
    noise({ dur: 0.46, type: 'bandpass', f: 180, f2: 6000, q: 2, gain: 0.12, attack: 0.4 });
  },
  // the collapse: a sub-bass implosion, a torn-air blast and a long rumble tail
  doomBoom: () => {
    tone({ f: 62, f2: 24, dur: 2.4, gain: 0.55, attack: 0.004 });
    tone({ f: 44, f2: 30, dur: 1.2, gain: 0.25, type: 'triangle', attack: 0.004 });
    noise({ dur: 1.8, type: 'lowpass', f: 1400, f2: 70, gain: 0.5, attack: 0.004 });
    noise({ dur: 0.25, type: 'highpass', f: 3000, f2: 900, gain: 0.25 });
    tone({ f: 90, f2: 36, dur: 0.9, gain: 0.12, type: 'sawtooth', attack: 0.004 });
    noise({ dur: 2.6, type: 'lowpass', f: 260, f2: 40, gain: 0.16, attack: 0.3, delay: 0.25 });
  },
  // something tries to undo it and fails: a digital error
  glitch: () => {
    for (let i = 0; i < 7; i++) {
      tone({ f: 600 + Math.random() * 2400, dur: 0.03 + Math.random() * 0.04, gain: 0.05, type: 'square', delay: i * 0.035 });
    }
    noise({ dur: 0.08, type: 'bandpass', f: 1800, q: 6, gain: 0.08, delay: 0.1 });
    tone({ f: 220, f2: 110, dur: 0.2, gain: 0.06, type: 'square', delay: 0.2 });
  },
  // dragged into the void and gone
  erase: () => {
    tone({ f: 1400, f2: 60, dur: 0.26, gain: 0.08 });
    noise({ dur: 0.2, type: 'bandpass', f: 4000, f2: 200, q: 2, gain: 0.08 });
  },
  // „Végzet”, first form: a short, heavy blast – a thump, torn air, a quick rumble
  doomBlast: () => {
    tone({ f: 72, f2: 30, dur: 0.9, gain: 0.42, attack: 0.004 });
    noise({ dur: 0.7, type: 'lowpass', f: 1700, f2: 90, gain: 0.38, attack: 0.004 });
    noise({ dur: 0.14, type: 'highpass', f: 3400, f2: 1100, gain: 0.2 });
    tone({ f: 130, f2: 52, dur: 0.3, gain: 0.1, type: 'sawtooth', attack: 0.004 });
  },
  // a card charges up („Körforgás”): a dark minor figure that rises and hangs
  charge: () => {
    tone({ f: 98, dur: 0.6, gain: 0.05, attack: 0.05 });
    [392, 466, 587, 698].forEach((f, i) => tone({ f, dur: 0.3, gain: 0.035, type: 'triangle', delay: i * 0.07 }));
  },
  // the charged card comes back to the hand, awakened: a low swell, then a cold glassy chime
  awaken: () => {
    tone({ f: 55, f2: 82, dur: 0.9, gain: 0.12, attack: 0.25 });
    noise({ dur: 0.7, type: 'bandpass', f: 300, f2: 2400, q: 2, gain: 0.05, attack: 0.4 });
    [1318, 1760, 2637].forEach((f, i) => tone({ f, dur: 0.45, gain: 0.03, type: 'triangle', delay: 0.42 + i * 0.06 }));
  },
  // the music comes back: one gigantic bass hit
  doomBass: () => {
    tone({ f: 55, f2: 36, dur: 1.6, gain: 0.55, attack: 0.004 });
    tone({ f: 110, f2: 55, dur: 0.5, gain: 0.18, type: 'triangle', attack: 0.004 });
    noise({ dur: 0.5, type: 'lowpass', f: 500, f2: 60, gain: 0.3, attack: 0.004 });
  },
  // undo: a reversed whoosh (high → low) and two falling chime notes
  rewind: () => {
    noise({ dur: 0.2, type: 'bandpass', f: 5200, f2: 600, q: 1.8, gain: 0.11, attack: 0.03 });
    tone({ f: 1318, dur: 0.12, gain: 0.035, type: 'triangle', delay: 0.04 });
    tone({ f: 988, dur: 0.2, gain: 0.035, type: 'triangle', delay: 0.11 });
  },
  move: () => {
    tone({ f: 190, f2: 110, type: 'sine', dur: 0.09, gain: 0.32 });
    noise({ dur: 0.04, type: 'bandpass', f: 1100, q: 2, gain: 0.14 });
  },
  capture: () => {
    tone({ f: 170, f2: 90, dur: 0.12, gain: 0.35 });
    noise({ dur: 0.05, type: 'bandpass', f: 1400, q: 2, gain: 0.18 });
    noise({ dur: 0.22, type: 'bandpass', f: 500, f2: 250, q: 1.2, gain: 0.2, delay: 0.03 });
    tone({ f: 70, f2: 45, dur: 0.25, gain: 0.25, delay: 0.02 });
  },
  check: () => {
    bell(880, 0.9, 0.14);
    bell(1175, 0.7, 0.08, 0.08);
  },
  mate: () => {
    bell(110, 2.4, 0.3);
    bell(165, 2, 0.14, 0.05);
    noise({ dur: 1.2, type: 'lowpass', f: 300, f2: 80, gain: 0.08 });
  },
  promote: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.35, gain: 0.08, type: 'triangle', delay: i * 0.07 })),
  illegal: () => tone({ f: 110, type: 'square', dur: 0.14, gain: 0.05 }),
  fire: () => {
    noise({ dur: 0.5, type: 'bandpass', f: 500, f2: 1800, q: 0.8, gain: 0.22, attack: 0.04 });
    for (let i = 0; i < 6; i++) noise({ dur: 0.03, type: 'highpass', f: 2500, gain: 0.08, delay: 0.05 + Math.random() * 0.4 });
  },
  lightning: () => {
    noise({ dur: 0.08, type: 'highpass', f: 1800, gain: 0.35 });
    tone({ f: 1400, f2: 60, type: 'sawtooth', dur: 0.35, gain: 0.08 });
    noise({ dur: 0.6, type: 'lowpass', f: 600, f2: 80, gain: 0.15, delay: 0.05 });
  },
  holy: () => [659, 831, 988, 1319].forEach((f, i) => tone({ f, dur: 0.7, gain: 0.05, delay: i * 0.05, attack: 0.03 })),
  shield: () => {
    tone({ f: 2400, f2: 2200, dur: 0.5, gain: 0.05 });
    tone({ f: 587, dur: 0.6, gain: 0.07, attack: 0.02, type: 'triangle' });
    tone({ f: 880, dur: 0.5, gain: 0.05, attack: 0.02, delay: 0.04 });
  },
  teleport: () => {
    tone({ f: 200, f2: 1600, dur: 0.32, gain: 0.08, type: 'sine' });
    tone({ f: 300, f2: 2400, dur: 0.32, gain: 0.04, type: 'triangle', delay: 0.03 });
    noise({ dur: 0.35, type: 'bandpass', f: 800, f2: 5000, q: 2, gain: 0.05 });
  },
  dark: () => {
    tone({ f: 92, f2: 70, type: 'sawtooth', dur: 0.6, gain: 0.07, attack: 0.05 });
    tone({ f: 97, f2: 72, type: 'sawtooth', dur: 0.6, gain: 0.06, attack: 0.05 });
    noise({ dur: 0.5, type: 'bandpass', f: 300, f2: 700, q: 3, gain: 0.07 });
  },
  freeze: () => {
    for (let i = 0; i < 7; i++) tone({ f: 2000 + Math.random() * 2500, dur: 0.18, gain: 0.03, delay: i * 0.045 });
    noise({ dur: 0.3, type: 'highpass', f: 4000, gain: 0.04 });
  },
  earth: () => {
    noise({ dur: 0.9, type: 'lowpass', f: 180, f2: 60, gain: 0.35, attack: 0.05 });
    tone({ f: 55, f2: 40, dur: 0.8, gain: 0.25 });
    for (let i = 0; i < 4; i++) noise({ dur: 0.08, type: 'lowpass', f: 600, gain: 0.12, delay: 0.1 + i * 0.15 });
  },
  wind: () => noise({ dur: 0.7, type: 'bandpass', f: 400, f2: 1400, q: 1.5, gain: 0.14, attack: 0.2 }),
  summon: () => {
    [392, 523, 659].forEach((f, i) => tone({ f, dur: 0.4, gain: 0.06, type: 'triangle', delay: i * 0.06 }));
    noise({ dur: 0.25, type: 'lowpass', f: 900, f2: 200, gain: 0.1, delay: 0.15 });
  },
  time: () => {
    for (let i = 0; i < 4; i++) tone({ f: i % 2 ? 1400 : 1000, type: 'square', dur: 0.03, gain: 0.04, delay: i * 0.09 });
    tone({ f: 1200, f2: 300, dur: 0.5, gain: 0.05, delay: 0.3 });
  },
  explosion: () => {
    noise({ dur: 1.0, type: 'lowpass', f: 1500, f2: 90, gain: 0.45, attack: 0.01 });
    tone({ f: 80, f2: 35, dur: 0.6, gain: 0.35 });
  },
  shot: () => {
    tone({ f: 240, f2: 120, type: 'triangle', dur: 0.12, gain: 0.18 });
    noise({ dur: 0.06, type: 'highpass', f: 2500, gain: 0.12 });
    noise({ dur: 0.12, type: 'bandpass', f: 900, q: 2, gain: 0.08, delay: 0.16 });
  },
  arcane: () => {
    tone({ f: 523, f2: 1046, dur: 0.4, gain: 0.06, type: 'triangle' });
    tone({ f: 784, f2: 1568, dur: 0.4, gain: 0.04, delay: 0.05 });
  },
  manaGain: () => {
    tone({ f: 660, f2: 990, dur: 0.14, gain: 0.07 });
    tone({ f: 1980, dur: 0.2, gain: 0.03, delay: 0.07 });
  },
  manaSpend: () => tone({ f: 880, f2: 440, dur: 0.16, gain: 0.06, type: 'triangle' }),
  defuse: () => {
    noise({ dur: 0.03, type: 'highpass', f: 3500, gain: 0.12 });
    noise({ dur: 0.03, type: 'highpass', f: 4200, gain: 0.1, delay: 0.08 });
  },
  turn: () => {
    tone({ f: 196, type: 'sawtooth', dur: 0.55, gain: 0.05, attack: 0.06 });
    tone({ f: 294, type: 'sawtooth', dur: 0.5, gain: 0.035, attack: 0.08, delay: 0.05 });
    noise({ dur: 0.4, type: 'lowpass', f: 700, gain: 0.02, attack: 0.1 });
  },
  victory: () => {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
      tone({ f, dur: i === 5 ? 1.2 : 0.22, gain: 0.08, type: 'triangle', delay: i * 0.16 });
      tone({ f: f / 2, dur: i === 5 ? 1.2 : 0.22, gain: 0.04, type: 'square', delay: i * 0.16 });
    });
  },
  defeat: () => [440, 349, 294, 220].forEach((f, i) => tone({ f, dur: 0.5, gain: 0.08, type: 'triangle', delay: i * 0.28 })),
  // „Végítélet”: a funeral bell tolls while something climbs out of the dark
  reaper: () => {
    bell(82, 2.8, 0.26);
    tone({ f: 41, dur: 2.2, gain: 0.16, attack: 0.02 });
    bell(123, 2.2, 0.07, 0.03);
    noise({ dur: 1.1, type: 'bandpass', f: 140, f2: 900, q: 1.3, gain: 0.16, attack: 0.35 });
    tone({ f: 73, f2: 55, type: 'sawtooth', dur: 1.6, gain: 0.045, attack: 0.3 });
    tone({ f: 77.5, f2: 58, type: 'sawtooth', dur: 1.6, gain: 0.04, attack: 0.35 });
    noise({ dur: 0.7, type: 'highpass', f: 6000, f2: 2500, gain: 0.025, attack: 0.25, delay: 0.3 });
  },
  // the scythe: a whistling sweep, the ring of the blade, the cut
  scythe: () => {
    noise({ dur: 0.13, type: 'bandpass', f: 900, f2: 7000, q: 0.9, gain: 0.24, attack: 0.07 });
    tone({ f: 2637, dur: 0.26, gain: 0.045, delay: 0.06 });
    tone({ f: 3960, dur: 0.18, gain: 0.03, delay: 0.06 });
    tone({ f: 5280, dur: 0.1, gain: 0.018, delay: 0.06 });
    tone({ f: 150, f2: 70, dur: 0.14, gain: 0.22, delay: 0.07 });
    noise({ dur: 0.09, type: 'lowpass', f: 1200, f2: 300, gain: 0.14, delay: 0.07 });
  },
};

/** Play a sound effect (rate-limited per name so bursts of events don't stack up). */
export function sfx(name: SfxName): void {
  const c = ensure();
  if (!c || settings.muted || settings.master <= 0 || settings.sfx <= 0) return;
  if (c.state === 'suspended') return;
  const now = c.currentTime;
  if ((lastPlayed.get(name) ?? -1) > now - 0.04) return;
  lastPlayed.set(name, now);
  try {
    RECIPES[name]();
  } catch {
    /* audio is decoration – never break the game */
  }
}

/** One syllable of a bot's voice (the speech bubble's little beeps, Animal Crossing style). */
export function voiceBlip(pitch: number, wave: OscillatorType): void {
  const c = ensure();
  if (!c || settings.muted || settings.master <= 0 || settings.sfx <= 0 || c.state === 'suspended') return;
  try {
    const f = pitch * (0.88 + Math.random() * 0.3);
    tone({ f, f2: f * (0.92 + Math.random() * 0.16), type: wave, dur: 0.055, gain: wave === 'square' || wave === 'sawtooth' ? 0.035 : 0.07 });
  } catch {
    /* decoration only */
  }
}

// ── Ambience ─────────────────────────────────────────────────────────────────

function startAmbience(kind: Exclude<Ambience, null>): void {
  const c = ensure();
  if (!c || !ambBus || !noiseBuf || c.state !== 'running') return;
  const nodes: AudioNode[] = [];
  const timers: number[] = [];
  const bed = c.createBufferSource();
  bed.buffer = noiseBuf;
  bed.loop = true;
  const f = c.createBiquadFilter();
  f.type = kind === 'menu' ? 'bandpass' : 'lowpass';
  f.frequency.value = kind === 'menu' ? 600 : 220;
  f.Q.value = kind === 'menu' ? 0.6 : 0.7;
  const g = c.createGain();
  g.gain.value = kind === 'menu' ? 0.09 : 0.07;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = kind === 'menu' ? 0.07 : 0.2;
  lfoGain.gain.value = kind === 'menu' ? 300 : 60;
  lfo.connect(lfoGain);
  lfoGain.connect(f.frequency);
  bed.connect(f);
  f.connect(g);
  g.connect(ambBus);
  bed.start();
  lfo.start();
  nodes.push(bed, lfo);
  const schedule = () => {
    if (kind === 'menu') {
      // distant birds
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const base = 2400 + Math.random() * 1600;
        tone({ f: base, f2: base * 1.3, dur: 0.09, gain: 0.018, delay: i * 0.13, bus: ambBus });
      }
      timers.push(window.setTimeout(schedule, 5000 + Math.random() * 9000));
    } else {
      // fire crackles
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) noise({ dur: 0.02 + Math.random() * 0.03, type: 'highpass', f: 1500 + Math.random() * 2500, gain: 0.05, delay: Math.random() * 0.2, bus: ambBus });
      timers.push(window.setTimeout(schedule, 120 + Math.random() * 600));
    }
  };
  schedule();
  ambienceStop = () => {
    timers.forEach((t) => window.clearTimeout(t));
    const t = c.currentTime;
    g.gain.setTargetAtTime(0, t, 0.3);
    window.setTimeout(() => nodes.forEach((n) => {
      try {
        (n as AudioScheduledSourceNode).stop();
      } catch {
        /* already stopped */
      }
    }), 1500);
    ambienceStop = null;
  };
}

/**
 * A hard cut of the background ambience – no fade – for `ms`, after which it snaps back in
 * (a cinematic silence, e.g. „Végzet”). `ms` = 0 brings it back right away.
 */
export function cutAmbience(ms: number): void {
  if (!ctx || !ambBus) return;
  const t = ctx.currentTime;
  const level = settings.ambient * 0.6;
  ambBus.gain.cancelScheduledValues(t);
  if (ms <= 0) {
    ambBus.gain.setValueAtTime(level, t);
    return;
  }
  ambBus.gain.setValueAtTime(0, t);
  ambBus.gain.setValueAtTime(0, t + ms / 1000);
  ambBus.gain.linearRampToValueAtTime(level, t + ms / 1000 + 0.02);
}

/** Switch the background ambience (null = silence). Starts once audio is unlocked. */
export function setAmbience(kind: Ambience): void {
  if (kind === wantedAmbience) return;
  wantedAmbience = kind;
  ambienceStop?.();
  if (kind && ctx && ctx.state === 'running') startAmbience(kind);
}

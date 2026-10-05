// The bots: who they are and how strong (Elo is their label – see strength.ts for how they play).
import type { BotId } from './strength';

export type { BotId };
export type BotTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legend';

export interface BotInfo {
  id: BotId;
  name: string;
  /** „the genius”, „the master” … shown after the name. */
  title: string;
  elo: number;
  tier: BotTier;
  /** A short introduction on the bot picker. */
  bio: string;
  /** The colour of the portrait's backdrop and the bot's name plate. */
  accent: string;
}

export const BOT_IDS: readonly BotId[] = ['kende', 'erika', 'nadi', 'peter', 'misu', 'madar', 'aron', 'istvan', 'magnum', 'boss', 'oli'];

export const BOTS: Record<BotId, BotInfo> = {
  kende: {
    id: 'kende',
    name: 'Kende',
    title: 'the genius',
    elo: 100,
    tier: 'bronze',
    bio: 'Okos, intelligens és nagyon jóképű, mégis szerény. Fényképez, a laptopja OLED (nem IPS!), 32 GB RAM-mal. A sakkot még csak tanulja, de minden rossz lépésére van egy tudományos magyarázata.',
    accent: '#71b24e',
  },
  erika: {
    id: 'erika',
    name: 'Erika',
    title: 'the English teacher',
    elo: 300,
    tier: 'bronze',
    bio: 'Angoltanár. A B2 neki konyhanyelv, a C1 kezdő szint. Hol tök laza, hol kiabál – főleg azzal, aki nem jegyzetel. De ez csak motiváció.',
    accent: '#3e7f3a',
  },
  nadi: {
    id: 'nadi',
    name: 'Nádi',
    title: 'the normal',
    elo: 500,
    tier: 'bronze',
    bio: 'Gen Alpha, szemüveges TikTok-szlengmester. Kedvenc szava a „chillex”, és játék közben random brainrot neveket kiabál.',
    accent: '#7b48b0',
  },
  peter: {
    id: 'peter',
    name: 'Magyar Péter',
    title: 'the man',
    elo: 700,
    tier: 'silver',
    bio: 'Végtelen aura, profi aurafarmer. Diplomatikus ember – még akkor is, amikor épp leüti a vezéredet.',
    accent: '#3569b8',
  },
  // the id stays 'misu' (saved records and settings use it); his name is Misi
  misu: {
    id: 'misu',
    name: 'Misi',
    title: 'the pro',
    elo: 900,
    tier: 'silver',
    bio: 'Gazdag. Van egy drága KTM-je (igaz, 125-ös), autót akar, Tescóba jár Clubcarddal, 3D-nyomtat, és imádja szívatni Kendét. A trappista sajtot ki nem állhatja.',
    accent: '#f28c38',
  },
  madar: {
    id: 'madar',
    name: 'Madár',
    title: 'the master',
    elo: 1100,
    tier: 'silver',
    bio: 'A főellensége a paradicsom (a pizzaszósz kivétel, az más). Animézik, Satisfactoryzik, vibecodol, side hustlel, és minden ingyen cuccot begyűjt.',
    accent: '#4fa0e0',
  },
  aron: {
    id: 'aron',
    name: 'Áron',
    title: 'the cheater',
    elo: 1500,
    tier: 'gold',
    bio: 'Kenesei hátvéd: focizik, röpizik, dartsozik, motorozik – kb. mindenben profi, kivéve amiben nem. Egoista, de barátságos. Csal? Dehogy. Talán.',
    accent: '#b3322c',
  },
  istvan: {
    id: 'istvan',
    name: 'István',
    title: 'the hacker',
    elo: 1750,
    tier: 'gold',
    bio: 'Ritkán szól, de akkor fárasztó viccet mond. Geek, hacker, és büszke az SSD-jére. (Az egy HDD.) A vibecodereket nem bírja.',
    accent: '#34948a',
  },
  magnum: {
    id: 'magnum',
    name: 'Magnum',
    title: 'ice cream',
    elo: 2000,
    tier: 'diamond',
    bio: 'Svéd–magyar, és imádja a fagyit. Hidegfejű játékos – szó szerint.',
    accent: '#8fd8f5',
  },
  boss: {
    id: 'boss',
    name: 'Boss',
    title: 'the boss',
    elo: 2300,
    tier: 'diamond',
    bio: 'Csendes gyerek. Nonchalant. Nem beszél sokat, de ha igen, minden tanár ideges lesz tőle – főleg Erika. Lassan eszik, lassan lép, és mégis nyer.',
    accent: '#7d1f22',
  },
  oli: {
    id: 'oli',
    name: 'Oli',
    title: 'the phone taker',
    elo: 3000,
    tier: 'legend',
    bio: 'Nagy, szemüveges, szőke infótanár, sasszemmel. 10 km-es körzetben bemér minden telefont. Ha nincs nálad, kedves – de meg ne lássa még egyszer!',
    accent: '#e6bf4c',
  },
};

/** „Kende the genius”, „Magnum ice cream” … */
export const botFullName = (b: BotInfo): string => `${b.name} ${b.title}`;

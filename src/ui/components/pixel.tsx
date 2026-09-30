// React wrappers for the pixel-art sprites (all rendered as crisp <img> elements).
import type { Color, PieceType, SpellId } from '../../engine';
import { CRYSTAL, CRYSTAL_PAL, SOCKET, SOCKET_LOCKED } from '../pixel/art/crystals';
import { PIECE_PAL, PIECE_SPRITES, VOID_PAL } from '../pixel/art/pieces';
import { spellSprite } from '../pixel/art/spellIcons';
import { UI_ICONS } from '../pixel/art/ui_icons';
import { spriteImage, type SpriteSrc } from '../pixel/sprite';

export type IconName = keyof typeof UI_ICONS;

interface SpriteProps {
  src: SpriteSrc;
  pal?: Readonly<Record<string, string>>;
  palKey?: string;
  /** Pixel scale (1 sprite pixel = `scale` CSS px). Omit together with `fill` to size with CSS. */
  scale?: number;
  fill?: boolean;
  className?: string;
  title?: string;
  style?: Record<string, string | number>;
}

export function Sprite({ src, pal, palKey, scale = 1, fill, className, title, style }: SpriteProps) {
  const img = spriteImage(src, pal, palKey);
  return (
    <img
      className={`px${fill ? ' px-fill' : ''}${className ? ' ' + className : ''}`}
      src={img.url}
      width={fill ? undefined : img.w * scale}
      height={fill ? undefined : img.h * scale}
      alt=""
      aria-hidden="true"
      draggable={false}
      title={title}
      style={style}
    />
  );
}

export const Icon = ({ name, scale = 2, className, fill }: { name: IconName; scale?: number; className?: string; fill?: boolean }) => (
  <Sprite src={UI_ICONS[name]} scale={scale} className={`icon${className ? ' ' + className : ''}`} fill={fill} />
);

export const SpellIcon = ({ id, scale = 2, className, fill }: { id: SpellId; scale?: number; className?: string; fill?: boolean }) => (
  <Sprite src={spellSprite(id)} scale={scale} className={`spell-icon${className ? ' ' + className : ''}`} fill={fill} />
);

export const PieceSprite = ({
  type, color, scale = 2, className, fill, erased,
}: { type: PieceType; color: Color; scale?: number; className?: string; fill?: boolean; erased?: boolean }) => (
  <Sprite
    src={PIECE_SPRITES[type]}
    pal={erased ? VOID_PAL : PIECE_PAL[color]}
    palKey={erased ? 'void' : color}
    scale={scale}
    className={`piece-sprite${className ? ' ' + className : ''}`}
    fill={fill}
  />
);

export type CrystalState = 'full' | 'empty' | 'locked';

export const CrystalSprite = ({ color, state, scale = 2, className }: { color: Color; state: CrystalState; scale?: number; className?: string }) =>
  state === 'full' ? (
    <Sprite src={CRYSTAL} pal={CRYSTAL_PAL[color]} palKey={color} scale={scale} className={className} />
  ) : (
    <Sprite src={state === 'locked' ? SOCKET_LOCKED : SOCKET} scale={scale} className={className} />
  );

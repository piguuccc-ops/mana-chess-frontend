// Living backgrounds: the menu landscape (parallax, drifting clouds, flags,
// birds, torch) and the war room behind the board (torches, candles, dust).
import { useEffect, useRef, useState } from 'react';
import { envArt, type Strip } from '../scenes/env';
import { landscapeArt, LH, LW } from '../scenes/landscape';
import { logoArt } from '../scenes/logo';
import { warRoomArt, WH, WW } from '../scenes/warroom';

type Style = Record<string, string | number>;

/** Cover-fit scale for a W×H scene inside the element, keeping `focusX` (0..1) in view. */
function useCover(W: number, H: number, focusX: number, overscan = 1.04) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState({ k: 3, x: 0, y: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const vw = el.clientWidth || window.innerWidth;
      const vh = el.clientHeight || window.innerHeight;
      const k = Math.max(vw / W, vh / H) * overscan;
      const sw = W * k;
      const sh = H * k;
      const x = Math.min(0, Math.max(vw - sw, vw / 2 - focusX * sw));
      const y = (vh - sh) / 2;
      setFit({ k, x, y });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H, focusX, overscan]);
  return { ref, ...fit };
}

/** Pointer parallax: writes --mx/--my (-1..1) on the element without re-rendering. */
function useParallax(ref: { current: HTMLDivElement | null }, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--mx', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty('--my', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
}

function StripSprite({ s, x, y, k, fps = 8, delay = 0, className = '', flip = false, scale = 1 }: { s: Strip; x: number; y: number; k: number; fps?: number; delay?: number; className?: string; flip?: boolean; scale?: number }) {
  const kk = k * scale;
  const style: Style = {
    left: `${x * k}px`,
    top: `${y * k}px`,
    width: `${s.fw * kk}px`,
    height: `${s.fh * kk}px`,
    backgroundImage: `url(${s.url})`,
    backgroundSize: `${s.fw * s.frames * kk}px ${s.fh * kk}px`,
    ['--sw' as string]: `${s.fw * s.frames * kk}px`,
    ['--frames' as string]: s.frames,
    animationDuration: `${s.frames / fps}s`,
    animationDelay: `${delay}s`,
  };
  if (flip) style.transform = 'scaleX(-1)';
  return <span className={`strip ${className}`} style={style} aria-hidden="true" />;
}

export function LandscapeScene({ reduced }: { reduced: boolean }) {
  const art = landscapeArt();
  const env = envArt();
  const { ref, k, x, y } = useCover(LW, LH, 0.62);
  useParallax(ref, !reduced);
  const layer = (url: string, depth: number, extra: Style = {}) => (
    <div className="layer" style={{ backgroundImage: `url(${url})`, ['--depth' as string]: depth, ...extra }} />
  );
  return (
    <div className={`scene scene-landscape ${reduced ? 'is-still' : ''}`} ref={ref} aria-hidden="true">
      <div className="stage" style={{ width: `${LW * k}px`, height: `${LH * k}px`, transform: `translate(${x}px, ${y}px)` }}>
        {layer(art.sky, 0)}
        <div
          className="layer clouds"
          style={{
            top: `${20 * k}px`,
            height: `${art.cloudsH * k}px`,
            backgroundImage: `url(${art.clouds})`,
            backgroundSize: `${art.cloudsW * k}px ${art.cloudsH * k}px`,
            ['--cloud-w' as string]: `${art.cloudsW * k}px`,
            ['--depth' as string]: 0.6,
          }}
        />
        {layer(art.far, 1)}
        <div className="layer layer-sprites" style={{ ['--depth' as string]: 2 }}>
          <div className="layer" style={{ backgroundImage: `url(${art.mid})` }} />
          {art.flags.map((f, i) => (
            <StripSprite key={i} s={env.pennant} x={f.x + 1} y={f.y - 5} k={k} fps={5 + (i % 3)} delay={-i * 0.3} />
          ))}
          {art.windows.map((w, i) => (
            <span key={i} className="window-glow" style={{ left: `${w.x * k}px`, top: `${w.y * k}px`, width: `${k}px`, height: `${k * 2}px`, animationDelay: `${-(i * 1.7) % 5}s` }} />
          ))}
        </div>
        <div className="birds" style={{ ['--k' as string]: k }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="bird-path" style={{ top: `${(52 + i * 17) * k}px`, animationDelay: `${i * 9 + 3}s`, animationDuration: `${34 + i * 7}s` }}>
              <StripSprite s={env.bird} x={0} y={0} k={k} fps={4 + i} />
              {i !== 1 && <StripSprite s={env.bird} x={7} y={4} k={k} fps={5} delay={-0.2} />}
            </span>
          ))}
        </div>
        {layer(art.near, 3)}
        <div className="layer layer-sprites" style={{ ['--depth' as string]: 5 }}>
          <div className="layer" style={{ backgroundImage: `url(${art.fg})` }} />
          <StripSprite s={env.banner} x={art.banner.x - 1} y={art.banner.y} k={k} fps={4} className="banner-cloth" />
          {art.torches.map((t, i) => (
            <span key={i}>
              <span className="torch-light" style={{ left: `${t.x * k}px`, top: `${t.y * k}px`, ['--r' as string]: `${46 * k}px` }} />
              <StripSprite s={env.flame} x={t.x - 3} y={t.y - 12} k={k} fps={9} />
            </span>
          ))}
        </div>
        <div className="dust" style={{ ['--k' as string]: k }}>
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 61) % 100}%`, top: `${40 + ((i * 37) % 55)}%`, animationDelay: `${-i * 1.3}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
          ))}
        </div>
        <div className="light-shift" />
      </div>
      <div className="vignette" />
    </div>
  );
}

export function WarRoomScene({ reduced, dim = 0 }: { reduced: boolean; dim?: number }) {
  const art = warRoomArt();
  const env = envArt();
  const { ref, k, x, y } = useCover(WW, WH, 0.5, 1.02);
  return (
    <div className={`scene scene-warroom ${reduced ? 'is-still' : ''}`} ref={ref} aria-hidden="true" style={{ ['--dim' as string]: dim }}>
      <div className="stage" style={{ width: `${WW * k}px`, height: `${WH * k}px`, transform: `translate(${x}px, ${y}px)` }}>
        <div className="layer" style={{ backgroundImage: `url(${art.wall})` }} />
        <div className="layer" style={{ backgroundImage: `url(${art.table})` }} />
        {art.torches.map((t, i) => (
          <span key={`t${i}`}>
            <span className="torch-light" style={{ left: `${t.x * k}px`, top: `${t.y * k}px`, ['--r' as string]: `${70 * k}px` }} />
            <StripSprite s={env.flame} x={t.x - 3} y={t.y - 11} k={k} fps={9} delay={-i * 0.21} />
          </span>
        ))}
        {art.candles.map((c, i) => (
          <span key={`c${i}`}>
            <span className="torch-light candle-light" style={{ left: `${c.x * k}px`, top: `${c.y * k}px`, ['--r' as string]: `${24 * k}px` }} />
            <StripSprite s={env.candle} x={c.x - 1} y={c.y - 5} k={k} fps={7} delay={-i * 0.17} />
          </span>
        ))}
        {art.crystals.map((c, i) => (
          <span key={`k${i}`} className="crystal-glow" style={{ left: `${c.x * k}px`, top: `${c.y * k}px`, ['--r' as string]: `${18 * k}px` }} />
        ))}
        <div className="dust dust-warm" style={{ ['--k' as string]: k }}>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 47 + 7) % 100}%`, top: `${15 + ((i * 29) % 60)}%`, animationDelay: `${-i * 1.1}s`, animationDuration: `${11 + (i % 4) * 3}s` }} />
          ))}
        </div>
        <div className="light-flicker" />
      </div>
      <div className="vignette vignette-strong" />
      <div className="scene-dim" />
    </div>
  );
}

/** The game's wordmark with a crown crystal that sparkles now and then. */
export function PixelLogo({ scale }: { scale: number }) {
  const logo = logoArt();
  return (
    <div className="logo" style={{ width: `${logo.w * scale}px`, height: `${logo.h * scale}px` }}>
      <img className="px logo-img" src={logo.url} width={logo.w * scale} height={logo.h * scale} alt="Mana Chess" draggable={false} />
      <span className="logo-shine" style={{ WebkitMaskImage: `url(${logo.url})`, maskImage: `url(${logo.url})` }} />
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="logo-spark"
          style={{
            left: `${(logo.crystal.x + [-5, 5, -2, 3][i]) * scale}px`,
            top: `${(logo.crystal.y + [-3, -1, 3, 2][i]) * scale}px`,
            width: `${scale}px`,
            height: `${scale}px`,
            animationDelay: `${i * 0.9}s`,
          }}
        />
      ))}
    </div>
  );
}

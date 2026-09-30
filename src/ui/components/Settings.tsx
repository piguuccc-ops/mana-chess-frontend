// Settings: brass sliders and lever switches on parchment. Used from the title
// screen and from the in-game menu; every change is saved to the preferences.
import { sfx } from '../audio/sound';
import type { Prefs } from '../storage';

export function Switch({ id, on, onChange, label, hint }: { id: string; on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={on} className="switch" onClick={() => onChange(!on)}>
      <span className="switch-track">
        <span className="switch-knob" />
      </span>
      <span className="switch-text">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
    </button>
  );
}

export function Slider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        style={{ ['--fill' as string]: `${Math.round(value * 100)}%` }}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <output htmlFor={id}>{Math.round(value * 100)}%</output>
    </div>
  );
}

export function SettingsBody({ prefs, onPrefs }: { prefs: Prefs; onPrefs: (p: Prefs) => void }) {
  const snd = prefs.sound;
  const setSound = (patch: Partial<Prefs['sound']>) => onPrefs({ ...prefs, sound: { ...snd, ...patch } });
  return (
    <div className="settings">
      <section className="settings-group">
        <h3 className="section-title">Hang</h3>
        <Switch id="set-mute" on={!snd.muted} onChange={(v) => setSound({ muted: !v })} label="Hangok" hint={snd.muted ? 'Némítva' : 'Bekapcsolva'} />
        <Slider id="set-master" label="Fő hangerő" value={snd.master} onChange={(v) => setSound({ master: v })} />
        <Slider
          id="set-sfx"
          label="Effektek (lépések, varázslatok)"
          value={snd.sfx}
          onChange={(v) => {
            setSound({ sfx: v });
            window.setTimeout(() => sfx('manaGain'), 30);
          }}
        />
        <Slider id="set-amb" label="Környezet (szél, tűzropogás)" value={snd.ambient} onChange={(v) => setSound({ ambient: v })} />
      </section>
      <section className="settings-group">
        <h3 className="section-title">Látvány</h3>
        <Switch
          id="set-motion"
          on={prefs.motion === 'full'}
          onChange={(v) => onPrefs({ ...prefs, motion: v ? 'full' : 'reduced' })}
          label="Teljes animáció"
          hint={prefs.motion === 'full' ? 'Élő háttér, részletes effektek' : 'Csökkentett mozgás, rövid effektek'}
        />
      </section>
      <section className="settings-group">
        <h3 className="section-title">Játék</h3>
        <Switch
          id="set-flip"
          on={prefs.autoFlip}
          onChange={(v) => onPrefs({ ...prefs, autoFlip: v })}
          label="Tábla automatikus forgatása"
          hint="Helyi játékban mindig a soron lévő játékos van alul."
        />
      </section>
    </div>
  );
}

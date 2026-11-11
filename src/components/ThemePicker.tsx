// Auswahl des Designs (Sunset / Neon) und des Modus (Automatisch / Hell / Dunkel).
// Die Vorschau-Karten zeigen das jeweilige Theme mit festen Farben – unabhängig vom aktuellen.

import { MODES, MODE_NAMES, THEMES, type ThemeName } from '../lib/theme'
import { Icon } from './Icon'
import { useTheme } from './ThemeProvider'

function Preview({ name, dark }: { name: ThemeName; dark: boolean }) {
  if (name === 'sunset') {
    const bg = dark ? '#130910' : '#fff4ea'
    const tile = dark ? '#21111c' : '#ffffff'
    const ink = dark ? '#fff1e6' : '#24101c'
    const glow = dark
      ? 'radial-gradient(60% 60% at 0% 30%, rgb(234 88 12 / 0.28), transparent 70%), radial-gradient(60% 60% at 100% 40%, rgb(225 29 72 / 0.26), transparent 70%)'
      : 'radial-gradient(60% 60% at 0% 30%, rgb(255 190 110 / 0.6), transparent 70%), radial-gradient(60% 60% at 100% 40%, rgb(255 140 175 / 0.5), transparent 70%)'
    return (
      <div className="relative h-36 overflow-hidden p-3" style={{ backgroundColor: bg, backgroundImage: glow, color: ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        <div className="flex items-baseline text-[22px] leading-none font-extrabold tracking-tight">
          Heute
          <span className="ml-0.5 inline-block h-[5px] w-[5px] rounded-full" style={{ background: 'linear-gradient(135deg,#e8590c,#e11d48 55%,#c026d3)' }} />
        </div>
        <div className="mt-2 flex gap-2">
          <div
            className="relative flex-[2] overflow-hidden rounded-[14px] p-2 text-white"
            style={{ background: 'linear-gradient(135deg,#d9480f,#e11d48 46%,#b01fb4 80%,#7c3aed)', boxShadow: '0 8px 16px -6px rgb(225 29 72 / 0.6)' }}
          >
            {/* Sonnenstrahlen */}
            <span
              className="absolute -top-12 -right-12 h-28 w-28 rounded-full"
              style={{
                background: 'repeating-conic-gradient(rgb(255 255 255 / 0.16) 0deg 6deg, transparent 6deg 18deg)',
                maskImage: 'radial-gradient(closest-side, #000, transparent 85%)',
                WebkitMaskImage: 'radial-gradient(closest-side, #000, transparent 85%)',
              }}
            />
            <div className="relative text-[34px] leading-none font-extrabold tracking-tighter">3</div>
            <div className="relative text-[10px] font-bold">Tage bis Mathe</div>
          </div>
          <div
            className="flex-1 rounded-[14px] p-2"
            style={{ background: dark ? 'linear-gradient(155deg,#45290f,#3c1523)' : 'linear-gradient(155deg,#ffeab8,#ffcfa6)' }}
          >
            <div className="text-[22px] leading-none font-extrabold">46</div>
            <div className="text-[9px] font-bold opacity-70">Ferien</div>
          </div>
        </div>
        <div className="mt-2 flex h-5 items-center gap-1.5 rounded-[10px] px-2" style={{ background: tile }}>
          <span className="h-2 w-2 rounded-full bg-[#f97316]" />
          <span className="h-2 w-2 rounded-full bg-[#e11d48]" />
          <span className="h-2 w-2 rounded-full bg-[#9333ea]" />
        </div>
      </div>
    )
  }
  const bg = dark ? '#07090b' : '#f3f4ee'
  const grid = dark ? 'rgb(198 255 61 / 0.08)' : 'rgb(11 13 10 / 0.07)'
  const ink = dark ? '#edefe8' : '#0b0d0a'
  return (
    <div
      className="h-36 overflow-hidden p-3"
      style={{
        backgroundColor: bg,
        color: ink,
        backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
        backgroundSize: '12px 12px',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div className="flex items-baseline text-[22px] leading-none font-bold tracking-tight">
        Heute
        <span className="ml-0.5 inline-block h-[5px] w-[5px] bg-[#c6ff3d]" style={{ boxShadow: dark ? '0 0 8px #c6ff3d' : '0 0 0 1px #0b0d0a' }} />
      </div>
      {/* Hell: schwarze Insel mit Lime-Schatten · Dunkel: Lime-Rahmen, der leuchtet */}
      <div
        className="mt-2 rounded-lg border p-2"
        style={{
          borderColor: dark ? '#c6ff3d' : '#0b0d0a',
          background: dark ? '#0d1110' : '#0b0d0a',
          boxShadow: dark ? '0 0 16px rgb(198 255 61 / 0.25)' : '3px 3px 0 #c6ff3d, 3px 3px 0 1px #0b0d0a',
        }}
      >
        <div className="font-mono text-[9px] font-bold text-[#c6ff3d]">■ NEXT_TEST</div>
        <div className="font-mono text-[26px] leading-none font-bold tracking-tighter text-[#c6ff3d]" style={{ textShadow: '0 0 12px rgb(198 255 61 / 0.45)' }}>
          T–3d
        </div>
        <div className="mt-1.5 flex gap-1">
          {[1, 1, 0, 0].map((on, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-[1px] border" style={on ? { background: '#c6ff3d', borderColor: '#c6ff3d' } : { borderColor: 'rgb(237 239 232 / 0.2)' }} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-1.5">
        <span className="h-2 w-2 bg-[#c6ff3d]" style={{ boxShadow: dark ? undefined : '0 0 0 1px #0b0d0a' }} />
        <span className="h-2 w-2" style={{ background: dark ? '#3df5ff' : '#22d3ee', boxShadow: dark ? undefined : '0 0 0 1px #0b0d0a' }} />
        <span className="h-2 w-2 bg-[#ff4d9a]" style={{ boxShadow: dark ? undefined : '0 0 0 1px #0b0d0a' }} />
      </div>
    </div>
  )
}

export function ThemePicker() {
  const { theme, mode, dark, setTheme, setMode } = useTheme()
  return (
    <section className="space-y-3" aria-labelledby="design-title">
      <h2 id="design-title" className="section-title">
        Design
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(THEMES) as ThemeName[]).map((name) => {
          const active = theme === name
          return (
            <button
              key={name}
              className={`tile overflow-hidden text-left ${active ? 'ring-[3px] ring-(--accent) ring-offset-2 ring-offset-(--bg)' : ''}`}
              aria-pressed={active}
              onClick={() => setTheme(name)}
            >
              <Preview name={name} dark={dark} />
              <div className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">{THEMES[name].label}</div>
                  <div className="muted truncate text-[13px]">{THEMES[name].description}</div>
                </div>
                {active && (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-(--accent) text-(--on-accent)">
                    <Icon name="check" className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <div className="tile flex flex-wrap items-center gap-3 p-3 pl-4">
        <span className="flex-1 font-bold">Hell / Dunkel</span>
        <div className="segment" role="group" aria-label="Hell oder Dunkel">
          {MODE_NAMES.map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {MODES[m]}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

// Auswahl des Designs (Sunset / Neon) und des Modus (Automatisch / Hell / Dunkel).
// Die Vorschau-Karten zeigen das jeweilige Theme mit festen Farben – unabhängig vom aktuellen.

import { MODES, MODE_NAMES, THEMES, type ThemeName } from '../lib/theme'
import { Icon } from './Icon'
import { useTheme } from './ThemeProvider'

function Preview({ name, dark }: { name: ThemeName; dark: boolean }) {
  if (name === 'sunset') {
    const bg = dark ? '#130910' : '#fff4ea'
    const tile = dark ? '#20111b' : '#ffffff'
    const ink = dark ? '#fff1e6' : '#24101c'
    return (
      <div className="relative h-36 overflow-hidden p-3" style={{ background: bg, color: ink, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        <div className="text-[22px] leading-none font-extrabold tracking-tight">Heute</div>
        <div className="mt-2 flex gap-2">
          <div
            className="relative flex-[2] overflow-hidden rounded-[14px] p-2 text-white"
            style={{ background: 'linear-gradient(135deg,#c2410c,#be123c 55%,#86198f)' }}
          >
            <span className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-white/15" />
            <div className="text-[34px] leading-none font-extrabold tracking-tighter">3</div>
            <div className="text-[10px] font-bold">Tage bis Mathe</div>
          </div>
          <div className="flex-1 rounded-[14px] p-2" style={{ background: dark ? '#2c1523' : '#ffe6d5' }}>
            <div className="text-[22px] leading-none font-extrabold">46</div>
            <div className="text-[9px] font-bold opacity-70">Ferien</div>
          </div>
        </div>
        <div className="mt-2 h-5 rounded-[10px]" style={{ background: tile }} />
      </div>
    )
  }
  const bg = dark ? '#07090b' : '#f3f4ee'
  const grid = dark ? 'rgb(198 255 61 / 0.08)' : 'rgb(11 13 10 / 0.07)'
  const ink = dark ? '#edefe8' : '#0b0d0a'
  const line = dark ? 'rgb(237 239 232 / 0.15)' : 'rgb(11 13 10 / 0.16)'
  const lime = dark ? '#c6ff3d' : '#3f6212'
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
      <div className="text-[22px] leading-none font-bold tracking-tight">
        Heute<span style={{ color: lime }}>.</span>
      </div>
      <div
        className="mt-2 rounded-lg border p-2"
        style={{ borderColor: lime, background: dark ? '#0d1110' : '#fff', boxShadow: dark ? '0 0 16px rgb(198 255 61 / 0.2)' : undefined }}
      >
        <div className="font-mono text-[9px] font-bold" style={{ color: lime }}>
          ● NEXT_TEST
        </div>
        <div className="font-mono text-[26px] leading-none font-bold tracking-tighter" style={{ color: lime }}>
          T–3d
        </div>
        <div className="mt-1.5 flex gap-1">
          {[1, 1, 0, 0].map((on, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-[1px] border" style={on ? { background: '#c6ff3d', borderColor: '#c6ff3d' } : { borderColor: line }} />
          ))}
        </div>
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

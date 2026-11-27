// Bausteine der Heute-Übersicht: Kachel mit Einblend-Animation, hochzählender Countdown.

import type { CSSProperties, ReactNode } from 'react'
import { CountUp } from '../CountUp'
import { useTheme } from '../ThemeProvider'

/** Kachel mit Einblend-Animation (--i = Reihenfolge). clip = false für Bereiche, die selbst Kacheln enthalten
 *  (sonst würden deren Schatten am Rand abgeschnitten). */
export function Tile({ i, className = '', children, onClick, label, clip = true }: { i: number; className?: string; children: ReactNode; onClick?: () => void; label?: string; clip?: boolean }) {
  const style = { '--i': i } as CSSProperties
  const cls = `tile-in relative text-left ${clip ? 'overflow-hidden' : ''} ${className}`
  return onClick ? (
    <button className={cls} style={style} onClick={onClick} aria-label={label}>
      {children}
    </button>
  ) : (
    <section className={cls} style={style} aria-label={label}>
      {children}
    </section>
  )
}

/** Countdown, der hochzählt: "3" (Sunset) bzw. "T–3d" (Neon). delay passend zur Kachel (--i). */
export function Countdown({ days, delay }: { days: number; delay?: number }) {
  const { theme } = useTheme()
  return <CountUp value={days} delay={delay} format={(n) => (theme === 'neon' ? `T–${Math.round(n)}d` : String(Math.round(n)))} />
}

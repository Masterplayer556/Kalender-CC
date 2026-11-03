// Noten-Graph als SVG (ohne Diagramm-Bibliothek).
//   • Linie  = Verlauf des Schnitts
//   • Punkte = einzelne Noten (grösser = höheres Gewicht), antippen öffnet die Note
//   • gestrichelt = Grenze 4 (genügend)
// Sunset: weiche Kurve mit Farbfläche darunter. Neon: gerade Linien, Raster, eckige Punkte, Glühen.

import { useId, useLayoutEffect, useRef, useState } from 'react'
import { addDays, daysBetween, formatDate, type DateKey } from '../lib/dates'
import type { TrendPoint } from '../lib/gradeStats'
import { useTheme } from './ThemeProvider'

export interface ChartDot {
  id: string
  date: DateKey
  value: number
  weight: number
  label: string
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** Breite eines Elements messen (Graph passt sich der Kachel an). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Weiche Kurve ohne Überschwinger (monotone kubische Interpolation nach Fritsch–Carlson). */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  const n = pts.length
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0])
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (dx[i] || 1))
  const m = pts.map((_, i) => {
    if (i === 0) return slope[0]
    if (i === n - 1) return slope[n - 2]
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  })
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

export function GradeChart({
  line,
  dots = [],
  color,
  height = 160,
  label,
  sparkline = false,
  range,
  onDot,
}: {
  line: TrendPoint[]
  dots?: ChartDot[]
  color: string
  height?: number
  label: string // Beschreibung für Bildschirmleser
  sparkline?: boolean // klein, ohne Achsen (z. B. in der Heute-Kachel)
  range?: [DateKey, DateKey] // fester Zeitraum (sonst von erster bis letzter Note)
  onDot?: (id: string) => void
}) {
  const { theme, dark } = useTheme()
  const neon = theme === 'neon'
  const gradId = useId().replace(/:/g, '')
  const [ref, width] = useWidth<HTMLDivElement>()

  const values = [...line.map((p) => p.value), ...dots.map((d) => d.value)]
  const dates = [...line.map((p) => p.date), ...dots.map((d) => d.date)].sort()
  if (values.length === 0) return <div ref={ref} style={{ height }} />

  // Zeitachse
  let [x0, x1] = range ?? [dates[0], dates[dates.length - 1]]
  if (x0 === x1) [x0, x1] = [addDays(x0, -7), addDays(x1, 7)]
  const span = daysBetween(x0, x1)

  // Notenachse: Sparkline eng um die Werte, sonst ab knapp unter 4 bis 6
  const lo = sparkline
    ? Math.min(...values) - 0.15
    : Math.max(1, Math.floor((Math.min(4, ...values) - 0.25) * 2) / 2)
  const hi = sparkline ? Math.max(...values) + 0.15 : 6

  const pad = sparkline ? { l: 4, r: 4, t: 6, b: 6 } : { l: 30, r: 12, t: 12, b: 26 }
  const w = Math.max(width, 1)
  const innerW = w - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const X = (d: DateKey) => pad.l + (daysBetween(x0, d) / span) * innerW
  const Y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * innerH

  const pts = line.map((p) => [X(p.date), Y(p.value)] as [number, number])
  const linePath = neon ? pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ') : smoothPath(pts)
  const areaPath = pts.length ? `${linePath} L${pts[pts.length - 1][0]},${pad.t + innerH} L${pts[0][0]},${pad.t + innerH} Z` : ''

  // Hilfslinien: ganze Noten im sichtbaren Bereich
  const ticks: number[] = []
  if (!sparkline) for (let v = Math.ceil(lo); v <= hi; v++) ticks.push(v)

  // Monatsbeschriftung, bei kurzen Zeiträumen nur Anfang und Ende
  const xLabels: { x: number; text: string }[] = []
  if (!sparkline) {
    if (span > 45) {
      const [y, m] = x0.split('-').map(Number)
      for (let i = 1; i < 14; i++) {
        const mm = ((m - 1 + i) % 12) + 1
        const yy = y + Math.floor((m - 1 + i) / 12)
        const key = `${yy}-${String(mm).padStart(2, '0')}-01`
        if (key > x1) break
        xLabels.push({ x: X(key), text: MONTHS[mm - 1] })
      }
    } else {
      xLabels.push({ x: X(x0), text: formatDate(x0).slice(0, 6) }, { x: X(x1), text: formatDate(x1).slice(0, 6) })
    }
  }

  const axisFont = neon ? "'JetBrains Mono', monospace" : 'inherit'
  const glow = neon && dark ? `drop-shadow(0 0 6px ${color})` : undefined
  const last = pts[pts.length - 1]

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={label} className="block overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={sparkline ? 0.28 : 0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={Y(v)}
                y2={Y(v)}
                stroke="var(--chart-grid, var(--line))"
                strokeDasharray={v === 4 ? '5 5' : neon ? '2 4' : undefined}
                strokeWidth={v === 4 ? 1.5 : 1}
                style={v === 4 ? { stroke: 'color-mix(in srgb, var(--chart-axis, var(--muted)) 70%, transparent)' } : undefined}
              />
              <text x={pad.l - 8} y={Y(v)} dy="0.35em" textAnchor="end" fontSize="11" fill="var(--chart-axis, var(--muted))" fontFamily={axisFont} fontWeight={v === 4 ? 700 : 500}>
                {v}
              </text>
            </g>
          ))}
          {xLabels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={height - 6}
              textAnchor={span > 45 ? 'start' : i === 0 ? 'start' : 'end'}
              fontSize="11"
              fill="var(--chart-axis, var(--muted))"
              fontFamily={axisFont}
            >
              {neon ? l.text.toUpperCase() : l.text}
            </text>
          ))}

          {!neon && areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
          {neon && areaPath && <path d={areaPath} fill={color} opacity={dark ? 0.08 : 0.1} />}

          {pts.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={neon ? 2 : sparkline ? 3 : 3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="chart-draw"
              style={{ ['--len' as string]: 1, filter: glow }}
            />
          )}

          {dots.map((d) => {
            const r = 3.5 + Math.min(d.weight, 3) * 1.5
            const cx = X(d.date)
            const cy = Y(d.value)
            const common = {
              onClick: onDot ? () => onDot(d.id) : undefined,
              style: { cursor: onDot ? 'pointer' : undefined },
            }
            return neon ? (
              <rect key={d.id} x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1.5} fill="var(--chart-ring, var(--surface))" stroke={color} strokeWidth={2} {...common}>
                <title>{d.label}</title>
              </rect>
            ) : (
              <circle key={d.id} cx={cx} cy={cy} r={r} fill={color} stroke="var(--chart-ring, var(--surface))" strokeWidth={2} opacity={0.9} {...common}>
                <title>{d.label}</title>
              </circle>
            )
          })}

          {/* Endpunkt hervorheben: aktueller Stand */}
          {last &&
            (neon ? (
              <rect x={last[0] - 5} y={last[1] - 5} width={10} height={10} fill={color} style={{ filter: glow }} />
            ) : (
              <circle cx={last[0]} cy={last[1]} r={sparkline ? 4.5 : 6} fill={color} stroke="var(--chart-ring, var(--surface))" strokeWidth={sparkline ? 2 : 3} />
            ))}
        </svg>
      )}
    </div>
  )
}

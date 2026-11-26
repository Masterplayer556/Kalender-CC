// Kleine Anzeigen im Noten-Tab: Note als farbiges Kästchen, Veränderung (▲/▼).

import { formatGrade, gradeClass } from '../../lib/grades'

/** Note als farbiges Kästchen (grün/gelb/rot) */
export function GradeBadge({ value, big }: { value: number; big?: boolean }) {
  return (
    <span
      className={`grade-badge inline-flex items-center justify-center rounded-(--r-ctl) font-extrabold tabular-nums ${gradeClass(value)} ${
        big ? 'h-11 min-w-14 px-2.5 text-xl' : 'h-8 min-w-11 px-1.5 text-[15px]'
      }`}
    >
      {formatGrade(value)}
    </span>
  )
}

/** Veränderung des Schnitts: ▲ 0.25 bzw. ▼ 0.10 (nichts bei 0) */
export function Delta({ value }: { value: number | null }) {
  if (value === null || Math.abs(value) < 0.01) return null
  return (
    <span className={`grade-badge shrink-0 whitespace-nowrap rounded-(--r-chip) px-2 py-0.5 text-xs font-bold ${value > 0 ? 'grade-good' : 'grade-bad'}`}>
      {value > 0 ? '▲' : '▼'} {Math.abs(value).toFixed(2)}
    </span>
  )
}


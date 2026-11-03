// Verläufe für die Noten-Graphen: Wie hat sich der Schnitt über die Zeit entwickelt?

import { roundToHalf, weightedAverage } from './grades'
import type { DateKey } from './dates'

export interface GradeLike {
  subject_id: string
  date: DateKey
  grade: number
  weight: number
}

export interface TrendPoint {
  date: DateKey
  value: number
}

/** Chronologisch sortiert (bei gleichem Datum stabil). */
function byDate<T extends { date: DateKey }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Laufender gewichteter Schnitt eines Fachs: nach jedem Datum mit neuer Note ein Punkt.
 * Mehrere Noten am selben Tag ergeben einen einzigen Punkt.
 */
export function runningAverage(grades: Pick<GradeLike, 'date' | 'grade' | 'weight'>[]): TrendPoint[] {
  const points: TrendPoint[] = []
  const seen: { grade: number; weight: number }[] = []
  for (const g of byDate(grades)) {
    seen.push(g)
    const value = weightedAverage(seen)!
    if (points.length && points[points.length - 1].date === g.date) points[points.length - 1].value = value
    else points.push({ date: g.date, value })
  }
  return points
}

/**
 * Verlauf des Gesamtschnitts wie im Zeugnis: nach jedem Datum der Durchschnitt der
 * auf halbe Noten gerundeten Fachschnitte (nur Fächer, die bis dahin Noten haben).
 * Der letzte Punkt entspricht damit genau dem angezeigten Gesamtschnitt.
 */
export function overallTrend(grades: GradeLike[]): TrendPoint[] {
  const points: TrendPoint[] = []
  const bySubject = new Map<string, { grade: number; weight: number }[]>()
  const sorted = byDate(grades)
  sorted.forEach((g, i) => {
    bySubject.set(g.subject_id, [...(bySubject.get(g.subject_id) ?? []), g])
    // Erst nach der letzten Note dieses Tages einen Punkt setzen
    if (sorted[i + 1]?.date === g.date) return
    const reports = [...bySubject.values()].map((list) => roundToHalf(weightedAverage(list)!))
    points.push({ date: g.date, value: reports.reduce((a, b) => a + b, 0) / reports.length })
  })
  return points
}

/** Veränderung seit dem letzten Punkt vor `since` (z. B. vor 30 Tagen). null, wenn es keinen gibt. */
export function trendDelta(points: TrendPoint[], since: DateKey): number | null {
  if (points.length < 2) return null
  const before = [...points].reverse().find((p) => p.date < since) ?? points[0]
  const last = points[points.length - 1]
  if (before === last) return null
  return last.value - before.value
}

// Notenziele: pro Fach (Zeugnisnote) und für den Gesamtschnitt.
// Gespeichert in der Datenbank (Einstellung "gradeTargets"), also auf allen Geräten gleich.

import { requiredGrade, roundToHalf, weightedAverage, type Weighted } from './grades'
import type { DateKey } from './dates'

export const OVERALL = 'gesamt'
export const TARGET_OPTIONS = [4, 4.5, 5, 5.5, 6]

export type Targets = Record<string, number>

/** Gespeicherten Wert prüfen (kommt aus der Datenbank bzw. dem localStorage) */
export function asTargets(value: unknown): Targets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'number')) as Targets
}

export function withTarget(targets: Targets, key: string, value: number | null): Targets {
  const next = { ...targets }
  if (value === null) delete next[key]
  else next[key] = value
  return next
}

export type TargetStatus =
  // Zeugnisnote erreicht das Ziel schon. Das Ziel bleibt aktiv: `keep` = so viel braucht es in den
  // nächsten Prüfungen (je Gewicht 1), damit es gehalten wird. null = hält auch mit lauter 1ern.
  | { state: 'reached'; keep: number | null }
  | { state: 'needs'; grade: number } // so viel braucht es (im Schnitt) in den nächsten Prüfungen
  | { state: 'out-of-reach' } // mit diesen Prüfungen nicht mehr erreichbar

/**
 * Stand eines Fachs gegenüber seinem Ziel (Zeugnisnote, auf halbe Noten gerundet).
 * Für eine 5 im Zeugnis reicht ein Schnitt von 4.75 – deshalb rechnet der Rechner mit Ziel − 0.25.
 * `upcoming` = so viele Prüfungen (je Gewicht 1) kommen noch, z. B. die geplanten Tests im Kalender.
 * Die Note gilt dann für jede davon (bzw. als deren Schnitt).
 */
export function targetStatus(grades: Weighted[], target: number, upcoming = 1): TargetStatus {
  const avg = weightedAverage(grades)!
  const needed = requiredGrade(grades, target - 0.25, Math.max(1, upcoming))
  if (roundToHalf(avg) >= target) return { state: 'reached', keep: needed > 1 ? ceil2(needed) : null }
  if (needed > 6) return { state: 'out-of-reach' }
  return { state: 'needs', grade: ceil2(needed) }
}

/** Auf Hundertstel aufrunden (lieber etwas zu streng als zu knapp) */
function ceil2(x: number): number {
  return Math.ceil(x * 100 - 1e-9) / 100
}

/** Was wäre, wenn: neuer Schnitt und neue Zeugnisnote mit einer weiteren Note. */
export function whatIf(grades: Weighted[], grade: number, weight: number): { average: number; report: number } {
  const average = weightedAverage([...grades, { grade, weight }])!
  return { average, report: roundToHalf(average) }
}

/** Ein Test aus dem Kalender, der noch keine Note hat */
export interface PlannedTest {
  id: string
  title: string
  date: DateKey
  subject_id: string | null
  category: string
}

/**
 * Geplante Tests pro Fach: Tests im Kalender von heute bis `until` (z. B. Semesterende), die ein Fach
 * haben und noch mit keiner Note verknüpft sind – nach Datum sortiert.
 */
export function plannedTests<T extends PlannedTest>(
  entries: T[],
  gradedEntryIds: Set<string>,
  today: DateKey,
  until: DateKey,
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  const list = entries
    .filter((e) => e.category === 'test' && e.subject_id && e.date >= today && e.date <= until && !gradedEntryIds.has(e.id))
    .sort((a, b) => a.date.localeCompare(b.date))
  for (const e of list) map.set(e.subject_id!, [...(map.get(e.subject_id!) ?? []), e])
  return map
}

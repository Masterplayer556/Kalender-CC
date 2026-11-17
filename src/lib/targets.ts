// Notenziele: pro Fach (Zeugnisnote) und für den Gesamtschnitt.
// Gespeichert in der Datenbank (Einstellung "gradeTargets"), also auf allen Geräten gleich.

import { requiredGrade, roundToHalf, type Weighted } from './grades'

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
  // Zeugnisnote erreicht das Ziel schon. Das Ziel bleibt aktiv: `keep` = so viel braucht es in der
  // nächsten Prüfung (Gewicht 1), damit es gehalten wird. null = hält auch mit einer 1.
  | { state: 'reached'; keep: number | null }
  | { state: 'needs'; grade: number } // so viel braucht es in der nächsten Prüfung (Gewicht 1)
  | { state: 'out-of-reach' } // mit einer Prüfung nicht mehr erreichbar

/**
 * Stand eines Fachs gegenüber seinem Ziel (Zeugnisnote, auf halbe Noten gerundet).
 * Für eine 5 im Zeugnis reicht ein Schnitt von 4.75 – deshalb rechnet der Rechner mit Ziel − 0.25.
 */
export function targetStatus(grades: Weighted[], target: number): TargetStatus {
  const total = grades.reduce((s, g) => s + g.weight, 0)
  const avg = grades.reduce((s, g) => s + g.grade * g.weight, 0) / total
  const needed = requiredGrade(grades, target - 0.25, 1)
  if (roundToHalf(avg) >= target) return { state: 'reached', keep: needed > 1 ? ceil2(needed) : null }
  if (needed > 6) return { state: 'out-of-reach' }
  return { state: 'needs', grade: ceil2(needed) }
}

/** Auf Hundertstel aufrunden (lieber etwas zu streng als zu knapp) */
function ceil2(x: number): number {
  return Math.ceil(x * 100 - 1e-9) / 100
}

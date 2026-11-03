// Notenziele: pro Fach (Zeugnisnote) und für den Gesamtschnitt. Gespeichert auf diesem Gerät.

import { loadPref, savePref } from './cache'
import { requiredGrade, roundToHalf, type Weighted } from './grades'

export const OVERALL = 'gesamt'
export const TARGET_OPTIONS = [4, 4.5, 5, 5.5, 6]

export type Targets = Record<string, number>

export function loadTargets(): Targets {
  return loadPref<Targets>('gradeTargets', {})
}

export function withTarget(targets: Targets, key: string, value: number | null): Targets {
  const next = { ...targets }
  if (value === null) delete next[key]
  else next[key] = value
  savePref('gradeTargets', next)
  return next
}

export type TargetStatus =
  | { state: 'reached' } // Zeugnisnote erreicht das Ziel schon
  | { state: 'needs'; grade: number } // so viel braucht es in der nächsten Prüfung (Gewicht 1)
  | { state: 'out-of-reach' } // mit einer Prüfung nicht mehr erreichbar

/**
 * Stand eines Fachs gegenüber seinem Ziel (Zeugnisnote, auf halbe Noten gerundet).
 * Für eine 5 im Zeugnis reicht ein Schnitt von 4.75 – deshalb rechnet der Rechner mit Ziel − 0.25.
 */
export function targetStatus(grades: Weighted[], target: number): TargetStatus {
  const total = grades.reduce((s, g) => s + g.weight, 0)
  const avg = grades.reduce((s, g) => s + g.grade * g.weight, 0) / total
  if (roundToHalf(avg) >= target) return { state: 'reached' }
  const needed = requiredGrade(grades, target - 0.25, 1)
  if (needed > 6) return { state: 'out-of-reach' }
  return { state: 'needs', grade: Math.ceil(needed * 100 - 1e-9) / 100 }
}

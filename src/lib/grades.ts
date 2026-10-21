// Notenberechnung (Schweizer Skala 1–6) und Semester-Einteilung.

import type { DateKey } from './dates'

export interface Weighted {
  grade: number
  weight: number
}

/** Gewichteter Durchschnitt: Σ(Note × Gewicht) / Σ(Gewicht). null, wenn keine Noten. */
export function weightedAverage(grades: Weighted[]): number | null {
  const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0)
  if (totalWeight === 0) return null
  return grades.reduce((sum, g) => sum + g.grade * g.weight, 0) / totalWeight
}

/** Auf halbe Noten runden wie im Zeugnis: 4.24 → 4, 4.25 → 4.5, 4.75 → 5. */
export function roundToHalf(x: number): number {
  // + 1e-9 gleicht Rundungsfehler von Kommazahlen aus (z. B. 4.2499999999 statt 4.25)
  return Math.round(x * 2 + 1e-9) / 2
}

/**
 * Notenrechner: Welche Note braucht es in der nächsten Prüfung (mit Gewicht `nextWeight`),
 * damit der Schnitt genau `target` wird?
 *
 * Herleitung:   (Σ(Note × Gewicht) + x × nextWeight) / (Σ Gewicht + nextWeight) = target
 *
 * Das Ergebnis kann ausserhalb von 1–6 liegen:
 *   > 6  → Ziel ist mit einer Prüfung nicht erreichbar
 *   ≤ 1  → Ziel ist mit jeder Note erreicht
 */
export function requiredGrade(grades: Weighted[], target: number, nextWeight: number): number {
  const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0)
  const weightedSum = grades.reduce((sum, g) => sum + g.grade * g.weight, 0)
  // Diese "Punkte" (Note × Gewicht) muss die nächste Prüfung beisteuern:
  const neededPoints = target * (totalWeight + nextWeight) - weightedSum
  // Punkte = Note × Gewicht  →  Note = Punkte / Gewicht der nächsten Prüfung
  return neededPoints / nextWeight
}

// ---------------------------------------------------------------------
// Semester: 1. Semester = August–Januar, 2. Semester = Februar–Juli
// ---------------------------------------------------------------------

export interface Semester {
  key: string // "2026-1" = Schuljahr 2026/27, 1. Semester (sortierbar)
  label: string // "2026/27 · 1. Semester"
}

export function semesterOf(date: DateKey): Semester {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const schoolYear = month >= 8 ? year : year - 1 // Schuljahr beginnt im August
  const half = month >= 8 || month === 1 ? 1 : 2
  const next = String((schoolYear + 1) % 100).padStart(2, '0')
  return { key: `${schoolYear}-${half}`, label: `${schoolYear}/${next} · ${half}. Semester` }
}

/** Note hübsch anzeigen: 5 → "5", 4.5 → "4.5", 4.75 → "4.75" */
export function formatGrade(x: number): string {
  return String(Math.round(x * 100) / 100)
}

/** Farbe nach Note: ab 4.5 gut, 4–4.5 knapp genügend, unter 4 ungenügend */
export function gradeTone(x: number): 'good' | 'ok' | 'bad' {
  if (x >= 4.5) return 'good'
  if (x >= 4) return 'ok'
  return 'bad'
}

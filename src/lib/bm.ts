// BM-Einschätzung: pro Fach je 4 Kreuze für fachliche und persönliche Kompetenz (also 8 pro Fach).

import type { BmKind, BmRating, BmSubject } from '../types'

export const BM_MAX = 4 // Kreuze pro Kompetenz

export const BM_SUBJECTS: { key: BmSubject; name: string; detail?: string; match: string[] }[] = [
  { key: 'math', name: 'Mathe', match: ['math'] },
  { key: 'deutsch', name: 'Deutsch', match: ['deutsch'] },
  { key: 'franz', name: 'Franz', match: ['franz'] },
  { key: 'nmg', name: 'NMG', detail: 'NT & RZG', match: ['nmg', 'nt', 'natur', 'rzg', 'räume'] },
]

export const BM_KINDS: { key: BmKind; label: string; short: string }[] = [
  { key: 'fach', label: 'Fachliche Kompetenz', short: 'Fachlich' },
  { key: 'pers', label: 'Persönliche Kompetenz', short: 'Persönlich' },
]

export type BmScore = Record<BmKind, number>
export type BmSheet = Record<BmSubject, BmScore>

/** Die Kreuze eines Semesters als Tabelle; fehlende Fächer zählen 0. */
export function bmSheet(ratings: BmRating[], semester: string): BmSheet {
  const sheet = Object.fromEntries(BM_SUBJECTS.map((s) => [s.key, { fach: 0, pers: 0 }])) as BmSheet
  for (const r of ratings) if (r.semester === semester && r.subject in sheet) sheet[r.subject] = { fach: r.fach, pers: r.pers }
  return sheet
}

/** Hat dieses Semester überhaupt Kreuze? */
export function bmHasData(sheet: BmSheet): boolean {
  return BM_SUBJECTS.some((s) => sheet[s.key].fach + sheet[s.key].pers > 0)
}

/** Summen über alle Fächer: pro Kompetenz und gesamt (max. 16 / 16 / 32). */
export function bmTotals(sheet: BmSheet): { fach: number; pers: number; total: number; max: number } {
  const fach = BM_SUBJECTS.reduce((s, x) => s + sheet[x.key].fach, 0)
  const pers = BM_SUBJECTS.reduce((s, x) => s + sheet[x.key].pers, 0)
  return { fach, pers, total: fach + pers, max: BM_SUBJECTS.length * BM_MAX * 2 }
}

/**
 * Tipp auf das n-te Kreuz (1–4): füllt bis dorthin, wie bei Sternen.
 * Nochmals auf das letzte gesetzte Kreuz tippen nimmt es weg (so kommt man auch auf 0).
 */
export function toggleCross(current: number, n: number): number {
  return current === n ? n - 1 : n
}

/** Vorheriges Semester: "2026-1" → "2025-2", "2026-2" → "2026-1" */
export function previousSemester(key: string): string {
  const [y, half] = key.split('-').map(Number)
  return half === 2 ? `${y}-1` : `${y - 1}-2`
}

/** Passendes Fach aus "Fächer" (für die Farbe), z. B. "Mathematik" für Mathe. */
export function matchSubject<T extends { name: string }>(subjects: T[], match: string[]): T | undefined {
  const norm = (s: string) => s.trim().toLowerCase()
  return subjects.find((s) => match.some((m) => norm(s.name) === m || (m.length > 2 && norm(s.name).startsWith(m))))
}

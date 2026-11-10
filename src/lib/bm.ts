// BM-Einschätzung: pro Fach je ein Kreuz für fachliche und eins für persönliche Kompetenz (4 Fächer → 8 Kreuze).

import type { BmKind, BmRating, BmSubject } from '../types'

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

/** Kreuze eines Fachs: je 0 oder 1 */
export type BmScore = Record<BmKind, number>
export type BmSheet = Record<BmSubject, BmScore>

/** Die Kreuze eines Semesters als Tabelle; fehlende Fächer zählen 0. Werte über 1 zählen als gesetzt. */
export function bmSheet(ratings: BmRating[], semester: string): BmSheet {
  const sheet = Object.fromEntries(BM_SUBJECTS.map((s) => [s.key, { fach: 0, pers: 0 }])) as BmSheet
  for (const r of ratings)
    if (r.semester === semester && r.subject in sheet) sheet[r.subject] = { fach: r.fach > 0 ? 1 : 0, pers: r.pers > 0 ? 1 : 0 }
  return sheet
}

/** Hat dieses Semester überhaupt Kreuze? */
export function bmHasData(sheet: BmSheet): boolean {
  return BM_SUBJECTS.some((s) => sheet[s.key].fach + sheet[s.key].pers > 0)
}

/** Summen über alle Fächer: pro Kompetenz (max. 4) und gesamt (max. 8). */
export function bmTotals(sheet: BmSheet): { fach: number; pers: number; total: number; max: number } {
  const fach = BM_SUBJECTS.reduce((s, x) => s + sheet[x.key].fach, 0)
  const pers = BM_SUBJECTS.reduce((s, x) => s + sheet[x.key].pers, 0)
  return { fach, pers, total: fach + pers, max: BM_SUBJECTS.length * 2 }
}

/** Noch fehlende Kreuze, z. B. ["Franz persönlich", "NMG fachlich"] */
export function bmMissingCrosses(sheet: BmSheet): string[] {
  return BM_SUBJECTS.flatMap((s) => BM_KINDS.filter((k) => !sheet[s.key][k.key]).map((k) => `${s.name} ${k.short.toLowerCase()}`))
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

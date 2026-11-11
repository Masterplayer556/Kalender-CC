// BM-Einschätzung: pro Fach je ein Feld für fachliche und eins für persönliche Kompetenz (4 Fächer → 8 Felder).
// Jedes Feld ist "Ja", "Nein" oder noch offen. Ziel: 6 × Ja.

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

/** So viele "Ja" braucht es */
export const BM_GOAL = 6

/** Wert eines Felds (so in der Datenbank gespeichert) */
export const BM_OPEN = 0
export const BM_YES = 1
export const BM_NO = 2
export type BmValue = typeof BM_OPEN | typeof BM_YES | typeof BM_NO

export type BmScore = Record<BmKind, BmValue>
export type BmSheet = Record<BmSubject, BmScore>

const toValue = (v: number): BmValue => (v === BM_YES || v === BM_NO ? v : BM_OPEN)

/** Die Felder eines Semesters als Tabelle; fehlende Fächer sind offen. */
export function bmSheet(ratings: BmRating[], semester: string): BmSheet {
  const sheet = Object.fromEntries(BM_SUBJECTS.map((s) => [s.key, { fach: BM_OPEN, pers: BM_OPEN }])) as BmSheet
  for (const r of ratings)
    if (r.semester === semester && r.subject in sheet) sheet[r.subject] = { fach: toValue(r.fach), pers: toValue(r.pers) }
  return sheet
}

const cells = (sheet: BmSheet) => BM_SUBJECTS.flatMap((s) => BM_KINDS.map((k) => sheet[s.key][k.key]))

/** Hat dieses Semester überhaupt Einträge (Ja oder Nein)? */
export function bmHasData(sheet: BmSheet): boolean {
  return cells(sheet).some((v) => v !== BM_OPEN)
}

/** Zählt Ja / Nein / offen über alle 8 Felder, dazu Ja pro Kompetenz. */
export function bmTotals(sheet: BmSheet) {
  const all = cells(sheet)
  const yesOf = (kind: BmKind) => BM_SUBJECTS.filter((s) => sheet[s.key][kind] === BM_YES).length
  return {
    yes: all.filter((v) => v === BM_YES).length,
    no: all.filter((v) => v === BM_NO).length,
    open: all.filter((v) => v === BM_OPEN).length,
    fach: yesOf('fach'),
    pers: yesOf('pers'),
    max: all.length,
  }
}

/**
 * Ist das Ziel (6 × Ja) noch erreichbar?
 * reached: schon erreicht · possible: mit den offenen Feldern noch möglich · lost: zu viele "Nein"
 */
export function bmGoalState(sheet: BmSheet): 'reached' | 'possible' | 'lost' {
  const t = bmTotals(sheet)
  if (t.yes >= BM_GOAL) return 'reached'
  return t.yes + t.open >= BM_GOAL ? 'possible' : 'lost'
}

/** Tipp auf "Ja" oder "Nein": setzt den Wert; nochmals tippen macht das Feld wieder offen. */
export function toggleValue(current: BmValue, chosen: typeof BM_YES | typeof BM_NO): BmValue {
  return current === chosen ? BM_OPEN : chosen
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

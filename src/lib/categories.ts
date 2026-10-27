import type { Category, Entry, Subject } from '../types'

export const CATEGORIES: Record<Category, { label: string; icon: string }> = {
  test: { label: 'Test', icon: '📝' },
  aufgabe: { label: 'Aufgabe', icon: '✅' },
  event: { label: 'Event', icon: '🎉' },
  sonstiges: { label: 'Sonstiges', icon: '📌' },
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]

/** Farbe für Einträge ohne Fach */
export const NO_SUBJECT_COLOR = '#64748b'
/** Events ohne Fach bekommen eine eigene Farbe, damit sie im Kalender auffallen */
export const EVENT_COLOR = '#ec4899'

/** Farbe eines Eintrags: die des Fachs, sonst je nach Kategorie */
export function entryColor(entry: Pick<Entry, 'subject_id' | 'category'>, subjectById: Map<string, Subject>): string {
  const subjectColor = entry.subject_id && subjectById.get(entry.subject_id)?.color
  return subjectColor || (entry.category === 'event' ? EVENT_COLOR : NO_SUBJECT_COLOR)
}

/** Vorschlagsfarben beim Anlegen eines Fachs */
export const SUBJECT_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78716c',
]

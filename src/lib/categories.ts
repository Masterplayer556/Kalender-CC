import type { Category } from '../types'

export const CATEGORIES: Record<Category, { label: string; icon: string }> = {
  test: { label: 'Test', icon: '📝' },
  aufgabe: { label: 'Aufgabe', icon: '✅' },
  sonstiges: { label: 'Sonstiges', icon: '📌' },
}

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]

/** Farbe für Einträge ohne Fach */
export const NO_SUBJECT_COLOR = '#64748b'

/** Vorschlagsfarben beim Anlegen eines Fachs */
export const SUBJECT_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#78716c',
]

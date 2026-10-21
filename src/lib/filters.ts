// Filter (Kategorie, Fach) und Suche – gelten in allen Ansichten.

import type { Category, Entry } from '../types'

/** Sonder-Wert im Fach-Filter für "Einträge ohne Fach" */
export const NO_SUBJECT = 'none'

export interface Filters {
  categories: Category[] // leer = alle
  subjects: string[] // Fach-IDs oder NO_SUBJECT; leer = alle
}

export const EMPTY_FILTERS: Filters = { categories: [], subjects: [] }

export function isFilterActive(f: Filters): boolean {
  return f.categories.length > 0 || f.subjects.length > 0
}

export function matchesFilters(entry: Entry, f: Filters): boolean {
  if (f.categories.length && !f.categories.includes(entry.category)) return false
  if (f.subjects.length && !f.subjects.includes(entry.subject_id ?? NO_SUBJECT)) return false
  return true
}

/** Groß-/Kleinschreibung egal, mehrere Wörter müssen alle vorkommen ("ww1 test"). */
export function matchesSearch(entry: Entry, query: string): boolean {
  const words = query.toLocaleLowerCase('de').split(/\s+/).filter(Boolean)
  const haystack = `${entry.title} ${entry.notes ?? ''}`.toLocaleLowerCase('de')
  return words.every((w) => haystack.includes(w))
}

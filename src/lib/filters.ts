// Filter (Kategorie, Fach) und Suche – gelten in allen Ansichten.

import { CATEGORY_KEYS } from './categories'
import type { Category, Entry } from '../types'

/** Sonder-Wert im Fach-Filter für "Einträge ohne Fach" */
export const NO_SUBJECT = 'none'

export interface Filters {
  categories: Category[] // leer = alle
  subjects: string[] // Fach-IDs oder NO_SUBJECT; leer = alle
}

export const EMPTY_FILTERS: Filters = { categories: [], subjects: [] }

/** Gespeicherten Wert prüfen (kommt aus der Datenbank bzw. dem localStorage) */
export function asFilters(value: unknown): Filters {
  const v = value as Partial<Filters> | null
  const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  if (!v || typeof v !== 'object') return EMPTY_FILTERS
  return { categories: strings(v.categories) as Category[], subjects: strings(v.subjects) }
}

/**
 * Nur Filter, die es noch gibt: Ein gelöschtes Fach (oder eine unbekannte Kategorie) im Filter würde sonst
 * alles verstecken, ohne dass man es in der Filterleiste sieht oder abwählen kann.
 * Solange die Fächer noch nicht geladen sind (subjectIds = null), bleibt der Fach-Filter, wie er ist.
 */
export function validFilters(f: Filters, subjectIds: ReadonlySet<string> | null): Filters {
  const categories = f.categories.filter((c) => CATEGORY_KEYS.includes(c))
  const subjects = subjectIds ? f.subjects.filter((s) => s === NO_SUBJECT || subjectIds.has(s)) : f.subjects
  return categories.length === f.categories.length && subjects.length === f.subjects.length ? f : { categories, subjects }
}

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

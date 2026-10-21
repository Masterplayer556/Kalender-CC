// Überfällige Einträge für die Liste "Als Nächstes".

import type { DateKey } from './dates'
import { compareEntries } from './grouping'
import type { Entry } from '../types'

/**
 * Nicht erledigte Aufgaben und Sonstiges aus der Vergangenheit, älteste zuerst.
 * Tests zählen nicht: Ein vergangener Test lässt sich nicht nachholen,
 * er soll die Liste nicht dauerhaft verstopfen.
 */
export function overdueEntries(entries: Entry[], today: DateKey): Entry[] {
  return entries
    .filter((e) => e.date < today && !e.done && e.category !== 'test')
    .sort(compareEntries)
}

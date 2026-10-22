// Überfällige Einträge für die Liste "Als Nächstes".

import { addDays, type DateKey } from './dates'
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

/** So viele Tage nach einem Test erscheint noch "Note eintragen?" */
export const GRADE_REMINDER_DAYS = 30

/**
 * Vergangene Tests der letzten 30 Tage, für die noch keine Note verknüpft ist – neueste zuerst.
 * (Wer eine Note nicht eintragen will, sieht den Test nach 30 Tagen nicht mehr.)
 */
export function testsAwaitingGrade(entries: Entry[], gradedEntryIds: Set<string>, today: DateKey): Entry[] {
  const oldest = addDays(today, -GRADE_REMINDER_DAYS)
  return entries
    .filter((e) => e.category === 'test' && e.date < today && e.date >= oldest && !gradedEntryIds.has(e.id))
    .sort((a, b) => compareEntries(b, a))
}

// Gruppierung der Liste "Als Nächstes".

import { addDays, daysBetween, startOfWeek, type DateKey } from './dates'
import type { Entry } from '../types'

export type UpcomingGroup = 'Heute' | 'Morgen' | 'Diese Woche' | 'Später'

export const GROUP_ORDER: UpcomingGroup[] = ['Heute', 'Morgen', 'Diese Woche', 'Später']

/**
 * In welche Gruppe gehört ein Eintrag mit Datum `date`, wenn heute `today` ist?
 * Wird nur für heutige und zukünftige Daten aufgerufen (date >= today).
 */
export function groupFor(today: DateKey, date: DateKey): UpcomingGroup {
  const diff = daysBetween(today, date)
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Morgen'
  if (date <= addDays(startOfWeek(today), 6)) return 'Diese Woche'
  return 'Später'
}

/** Sortiert Einträge chronologisch: nach Datum, dann Uhrzeit (ganztägige zuerst), dann Titel. */
export function compareEntries(a: Entry, b: Entry): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.start_time ?? '').localeCompare(b.start_time ?? '') ||
    a.title.localeCompare(b.title, 'de')
  )
}

/**
 * Kommende Einträge (ab heute), chronologisch sortiert und gruppiert.
 * Leere Gruppen werden weggelassen.
 */
export function groupUpcoming(
  entries: Entry[],
  today: DateKey,
  showDone: boolean,
): { group: UpcomingGroup; entries: Entry[] }[] {
  const upcoming = entries
    .filter((e) => e.date >= today && (showDone || !e.done))
    .sort(compareEntries)

  const byGroup = new Map<UpcomingGroup, Entry[]>()
  for (const entry of upcoming) {
    const g = groupFor(today, entry.date)
    byGroup.set(g, [...(byGroup.get(g) ?? []), entry])
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ group: g, entries: byGroup.get(g)! }))
}

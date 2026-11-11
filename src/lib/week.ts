// Kachel "Noch diese Woche" in der Heute-Übersicht: Was steht von heute bis Sonntag noch an?

import { addDays, startOfWeek, type DateKey } from './dates'
import type { Entry } from '../types'

export interface WeekOutlook {
  tests: number
  tasks: number
}

/**
 * Offene Tests und Aufgaben von heute bis und mit Sonntag.
 * Bewusst ohne Erledigtes und ohne die bereits vergangenen Tage der Woche: Ein Test vom Montag
 * soll am Mittwoch nicht mehr als "Test diese Woche" erscheinen. Verpasste Aufgaben stehen
 * stattdessen unter "Überfällig" (siehe overdue.ts) und würden sonst doppelt gezählt.
 */
export function weekOutlook(entries: Entry[], today: DateKey): WeekOutlook {
  const sunday = addDays(startOfWeek(today), 6)
  const ahead = entries.filter((e) => !e.done && e.date >= today && e.date <= sunday)
  return {
    tests: ahead.filter((e) => e.category === 'test').length,
    tasks: ahead.filter((e) => e.category === 'aufgabe').length,
  }
}

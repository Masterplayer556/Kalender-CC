// Kachel "Noch diese Woche" in der Heute-Übersicht: Was steht von heute bis Sonntag noch an?

import { addDays, startOfWeek, type DateKey } from './dates'
import type { Entry, StudyBlock } from '../types'

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

// ---------------------------------------------------------------------
// Kachel "Lernwoche": Lernzeit in Stunden statt Anzahl Blöcke
// ---------------------------------------------------------------------

export interface StudyTime {
  planned: number // Minuten
  done: number // Minuten
}

export interface StudyWeek extends StudyTime {
  /** pro Fach (null = ohne Fach), meiste geplante Zeit zuerst */
  bySubject: ({ subjectId: string | null } & StudyTime)[]
}

/** Dauer einer Lernzeit in Minuten (nie negativ) */
export function blockMinutes(b: Pick<StudyBlock, 'starts_at' | 'ends_at'>): number {
  return Math.max(0, Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000))
}

/**
 * Geplante und erledigte Lernzeit der übergebenen Lernzeiten (z. B. die der laufenden Woche), gesamt
 * und pro Fach. Eine IVE-Lektion mit 45 Minuten zählt so weniger als ein Abend mit 3 Stunden.
 */
export function studyWeek(blocks: StudyBlock[], subjectOf: (b: StudyBlock) => string | null): StudyWeek {
  const bySubject = new Map<string | null, StudyTime>()
  const total: StudyTime = { planned: 0, done: 0 }
  for (const b of blocks) {
    const min = blockMinutes(b)
    const key = subjectOf(b)
    const t = bySubject.get(key) ?? { planned: 0, done: 0 }
    t.planned += min
    total.planned += min
    if (b.done) {
      t.done += min
      total.done += min
    }
    bySubject.set(key, t)
  }
  return {
    ...total,
    bySubject: [...bySubject].map(([subjectId, t]) => ({ subjectId, ...t })).sort((a, b) => b.planned - a.planned),
  }
}

/** Dauer lesbar: 45 → "45 min", 90 → "1.5 h", 120 → "2 h", 100 → "1.7 h" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  return `${Math.round((minutes / 60) * 10) / 10} h`
}

/** Stunden als Zahl mit höchstens einer Nachkommastelle (für die grosse Zahl der Kachel) */
export function hours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

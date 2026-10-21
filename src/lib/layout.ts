// Platzierung von Blöcken im Zeitraster (0–24 Uhr) der Wochen- und Tagesansicht.
//
// Alle Zeiten sind "Minuten seit Mitternacht" (0 … 1440). Daraus rechnet die Ansicht
// die Pixelposition: top = start * PixelProMinute, Höhe = (end - start) * PixelProMinute.

import { addDays, parseDateKey, type DateKey } from './dates'

export const MINUTES_PER_DAY = 24 * 60

export interface Span {
  start: number // Minuten seit Mitternacht
  end: number // exklusiv
}

/**
 * Schneidet einen Zeitraum (z. B. eine Lernzeit) auf einen Kalendertag zu.
 * Eine Lernzeit von 22:00 bis 01:00 erscheint so an zwei Tagen.
 * Gibt null zurück, wenn der Zeitraum den Tag nicht berührt.
 *
 * Wir lesen Stunden/Minuten direkt aus dem Date-Objekt, statt Millisekunden seit Mitternacht
 * zu rechnen – so stimmt die Position auch an Tagen mit Zeitumstellung (23 bzw. 25 Stunden).
 */
export function clipToDay(start: Date, end: Date, day: DateKey): Span | null {
  const dayStart = parseDateKey(day)
  const dayEnd = parseDateKey(addDays(day, 1))
  if (end <= dayStart || start >= dayEnd) return null

  const s = start <= dayStart ? 0 : start.getHours() * 60 + start.getMinutes()
  const e = end >= dayEnd ? MINUTES_PER_DAY : end.getHours() * 60 + end.getMinutes()
  return e > s ? { start: s, end: e } : null
}

export type Positioned<T> = T & {
  column: number // in welcher Spalte (0, 1, 2 …) der Block steht
  columns: number // wie viele Spalten sich die überlappende Gruppe teilt
}

/**
 * Verteilt sich überlappende Blöcke nebeneinander (wie im Apple- oder Google-Kalender).
 *
 * Vorgehen:
 * 1. Nach Startzeit sortieren (bei Gleichstand: längere zuerst).
 * 2. Blöcke, die sich (auch indirekt) überlappen, bilden eine "Gruppe".
 * 3. Jeder Block kommt in die erste Spalte der Gruppe, die zu seinem Start wieder frei ist.
 * 4. Alle Blöcke einer Gruppe teilen sich die Breite durch die Spaltenzahl der Gruppe.
 *
 * minDuration: Sehr kurze Blöcke werden mindestens so hoch gezeichnet – damit sie
 * sich optisch nicht überdecken, rechnen wir hier auch schon mit dieser Mindesthöhe.
 */
export function layoutDay<T extends Span>(items: T[], minDuration = 20): Positioned<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const result: Positioned<T>[] = []

  let group: Positioned<T>[] = []
  let columnEnds: number[] = [] // Ende des letzten Blocks pro Spalte
  let groupEnd = -1

  const closeGroup = () => {
    for (const p of group) p.columns = columnEnds.length
    group = []
    columnEnds = []
  }

  for (const item of sorted) {
    const visualEnd = Math.max(item.end, item.start + minDuration)
    if (item.start >= groupEnd) closeGroup()

    let column = columnEnds.findIndex((end) => end <= item.start)
    if (column === -1) column = columnEnds.push(visualEnd) - 1
    else columnEnds[column] = visualEnd

    const positioned = { ...item, column, columns: 1 }
    group.push(positioned)
    result.push(positioned)
    groupEnd = Math.max(groupEnd, visualEnd)
  }
  closeGroup()
  return result
}

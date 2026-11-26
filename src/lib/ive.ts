// IVE-Lektionen: feste Lernlektionen in der Schule, die man mit einem Tipp als Lernzeit eintragen kann.

import { addDays, parseDateKey, timeToMinutes, type DateKey } from './dates'
import { periodCovers } from './periods'
import type { Period, StudyBlockInput } from '../types'

export interface IveSlot {
  label: string // z. B. "IVE (Di)"
  weekday: number // 0 = Sonntag … 6 = Samstag (wie Date.getDay())
  start: string // "HH:MM"
  end: string // "HH:MM"
}

export const IVE_SLOTS: IveSlot[] = [
  { label: 'IVE (Di)', weekday: 2, start: '14:30', end: '15:15' },
  { label: 'IVE (Do)', weekday: 4, start: '13:40', end: '14:25' },
  { label: 'IVE (Fr)', weekday: 5, start: '11:10', end: '11:55' },
]

/**
 * Nächste IVE-Lektion, die noch nicht als Lernzeit eingetragen ist. Mehrmals tippen trägt so die Lektion
 * in den folgenden Wochen ein. Übersprungen werden: die heutige Lektion, wenn sie schon begonnen hat
 * (nowMinutes = Minuten seit Mitternacht), und Tage in Ferien, an schulfreien Tagen und im Lager.
 */
export function nextIveBlock(
  slot: IveSlot,
  blocks: StudyBlockInput[],
  today: DateKey,
  nowMinutes = 0,
  periods: Pick<Period, 'start_date' | 'end_date'>[] = [],
): StudyBlockInput {
  let date = addDays(today, (slot.weekday - parseDateKey(today).getDay() + 7) % 7)
  const skip = (d: DateKey) =>
    (d === today && nowMinutes >= timeToMinutes(slot.start)) ||
    periods.some((p) => periodCovers(p, d)) ||
    blocks.some((b) => b.date === d && b.start === slot.start)
  // Höchstens ein Jahr weit suchen (z. B. falls ein Zeitraum versehentlich Jahre dauert)
  for (let i = 0; i < 52 && skip(date); i++) date = addDays(date, 7)
  return { date, start: slot.start, end: slot.end, done: false }
}

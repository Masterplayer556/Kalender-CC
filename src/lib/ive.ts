// IVE-Lektionen: feste Lernlektionen in der Schule, die man mit einem Tipp als Lernzeit eintragen kann.

import { addDays, parseDateKey, type DateKey } from './dates'
import type { StudyBlockInput } from '../types'

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
 * Nächste IVE-Lektion ab heute, die noch nicht als Lernzeit eingetragen ist.
 * Mehrmals tippen trägt so die Lektion in den folgenden Wochen ein.
 */
export function nextIveBlock(slot: IveSlot, blocks: StudyBlockInput[], today: DateKey): StudyBlockInput {
  let date = addDays(today, (slot.weekday - parseDateKey(today).getDay() + 7) % 7)
  while (blocks.some((b) => b.date === date && b.start === slot.start)) date = addDays(date, 7)
  return { date, start: slot.start, end: slot.end, done: false }
}

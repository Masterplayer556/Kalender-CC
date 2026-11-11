// Lernzeiten im Eintrag-Formular: Helfer ohne Oberfläche.

import { addDays } from './dates'
import type { StudyBlockInput } from '../types'

/**
 * Verschiebt die noch offenen Lernzeiten um `days` Tage (z. B. wenn der Test eine Woche später ist).
 * Erledigte bleiben, wo sie waren – dort wurde ja wirklich gelernt.
 */
export function shiftOpenBlocks(blocks: StudyBlockInput[], days: number): StudyBlockInput[] {
  if (days === 0) return blocks
  return blocks.map((b) => (b.done ? b : { ...b, date: addDays(b.date, days) }))
}

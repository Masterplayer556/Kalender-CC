// Heatmap "Belastung pro Tag": Wie viel steht an einem Tag an?
// Punkte (bestimmen die Farbe): Test = 2, jeder andere Eintrag = 1, jede Lernzeit = 1.
// Mehrtägige Einträge zählen an jedem ihrer Tage.
// Erledigte Einträge und Lernzeiten zählen bewusst mit: Die Heatmap zeigt auch vergangene Monate,
// also wie viel an einem Tag los war – nicht nur, was noch offen ist.

import { isoToLocal, type DateKey } from './dates'
import { entryCovers } from './grouping'
import type { Entry, StudyBlock } from '../types'

export interface DayLoad {
  score: number
  tests: number
  others: number // Aufgaben, Events, Sonstiges
  study: number // Lernzeiten
}

const EMPTY: DayLoad = { score: 0, tests: 0, others: 0, study: 0 }

/**
 * Wie viele Dinge stehen an dem Tag an (Einträge + Lernzeiten)? Diese Zahl steht im Feld.
 * Nicht die Punkte: Ein einzelner Test zählt 2 Punkte, im Feld soll aber "1" stehen –
 * sonst sieht es aus, als gäbe es den Test doppelt.
 */
export function loadCount(load: DayLoad): number {
  return load.tests + load.others + load.study
}

export function dayLoads(days: DateKey[], entries: Entry[], blocks: StudyBlock[]): Map<DateKey, DayLoad> {
  const map = new Map<DateKey, DayLoad>(days.map((d) => [d, { ...EMPTY }]))
  for (const e of entries) {
    for (const d of days) {
      if (!entryCovers(e, d)) continue
      const load = map.get(d)!
      if (e.category === 'test') {
        load.tests++
        load.score += 2
      } else {
        load.others++
        load.score += 1
      }
    }
  }
  for (const b of blocks) {
    const load = map.get(isoToLocal(b.starts_at).date)
    if (!load) continue
    load.study++
    load.score += 1
  }
  return map
}

/** Stufe 0–3 für die Farbe: nichts, wenig (1), mittel (2–3), viel (ab 4) */
export function heatLevel(score: number): 0 | 1 | 2 | 3 {
  if (score <= 0) return 0
  if (score === 1) return 1
  if (score <= 3) return 2
  return 3
}

/** Woche mit der höchsten Belastung (nur Tage im Monat `month` = "JJJJ-MM" zählen). null, wenn alles leer ist. */
export function busiestWeek(
  weeks: DateKey[][],
  loads: Map<DateKey, DayLoad>,
  month: string,
): { week: DateKey[]; load: DayLoad } | null {
  let best: { week: DateKey[]; load: DayLoad } | null = null
  for (const week of weeks) {
    const sum = { ...EMPTY }
    for (const d of week) {
      if (!d.startsWith(month)) continue
      const l = loads.get(d) ?? EMPTY
      sum.score += l.score
      sum.tests += l.tests
      sum.others += l.others
      sum.study += l.study
    }
    if (sum.score > 0 && (!best || sum.score > best.load.score)) best = { week, load: sum }
  }
  return best
}

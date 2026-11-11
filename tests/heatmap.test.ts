import { describe, expect, it } from 'vitest'
import { busiestWeek, dayLoads, heatLevel, loadCount } from '../src/lib/heatmap'
import type { Entry, StudyBlock } from '../src/types'

const entry = (date: string, category: Entry['category'], end_date: string | null = null) =>
  ({ id: date + category, date, end_date, category }) as Entry
const block = (date: string) => ({ id: 'b' + date, starts_at: `${date}T17:00:00+01:00` }) as StudyBlock

describe('dayLoads', () => {
  it('Test zählt 2, Aufgabe und Lernzeit je 1', () => {
    const loads = dayLoads(['2026-11-03'], [entry('2026-11-03', 'test'), entry('2026-11-03', 'aufgabe')], [block('2026-11-03')])
    expect(loads.get('2026-11-03')).toEqual({ score: 4, tests: 1, others: 1, study: 1 })
  })
  it('erledigte Einträge und Lernzeiten zählen mit (auch vergangene Monate zeigen die Belastung)', () => {
    const done = { ...entry('2026-10-12', 'test'), done: true } as Entry
    const doneBlock = { ...block('2026-10-12'), done: true } as StudyBlock
    expect(dayLoads(['2026-10-12'], [done], [doneBlock]).get('2026-10-12')!.score).toBe(3)
  })
  it('„Nur Offenes“: erledigte Einträge und Lernzeiten zählen nicht', () => {
    const done = { ...entry('2026-10-12', 'test'), done: true } as Entry
    const open = { ...entry('2026-10-12', 'aufgabe'), done: false } as Entry
    const doneBlock = { ...block('2026-10-12'), done: true } as StudyBlock
    expect(dayLoads(['2026-10-12'], [done, open], [doneBlock], true).get('2026-10-12')).toEqual({ score: 1, tests: 0, others: 1, study: 0 })
  })
  it('mehrtägige Einträge zählen an jedem Tag', () => {
    const loads = dayLoads(['2026-11-23', '2026-11-24', '2026-11-25'], [entry('2026-11-23', 'event', '2026-11-24')], [])
    expect([...loads.values()].map((l) => l.score)).toEqual([1, 1, 0])
  })
})

describe('loadCount', () => {
  it('ein einzelner Test ist 1 Eintrag, auch wenn er 2 Punkte zählt', () => {
    const load = dayLoads(['2026-11-17'], [entry('2026-11-17', 'test')], []).get('2026-11-17')!
    expect(load.score).toBe(2)
    expect(loadCount(load)).toBe(1)
  })
  it('zählt Einträge und Lernzeiten zusammen', () => {
    const load = dayLoads(['2026-11-03'], [entry('2026-11-03', 'test'), entry('2026-11-03', 'aufgabe')], [block('2026-11-03')]).get('2026-11-03')!
    expect(loadCount(load)).toBe(3)
  })
  it('verschobener Test: am alten Tag bleibt nichts zurück', () => {
    const moved = entry('2026-11-17', 'test') // vorher am 10.11.
    const loads = dayLoads(['2026-11-10', '2026-11-17'], [moved], [])
    expect(loadCount(loads.get('2026-11-10')!)).toBe(0)
    expect(loadCount(loads.get('2026-11-17')!)).toBe(1)
  })
})

describe('heatLevel', () => {
  it.each([[0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [9, 3]])('%i Punkte → Stufe %i', (score, level) => {
    expect(heatLevel(score)).toBe(level)
  })
})

describe('busiestWeek', () => {
  it('findet die Woche mit den meisten Punkten, nur Tage im Monat', () => {
    const weeks = [['2026-10-31', '2026-11-01'], ['2026-11-02', '2026-11-03']]
    const loads = dayLoads(weeks.flat(), [entry('2026-10-31', 'test'), entry('2026-10-31', 'test'), entry('2026-11-03', 'test')], [])
    expect(busiestWeek(weeks, loads, '2026-11')?.week).toEqual(['2026-11-02', '2026-11-03'])
  })
  it('leerer Monat → null', () => {
    expect(busiestWeek([['2026-11-02']], dayLoads(['2026-11-02'], [], []), '2026-11')).toBeNull()
  })
})

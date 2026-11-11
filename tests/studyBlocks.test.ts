import { describe, expect, it } from 'vitest'
import { shiftOpenBlocks } from '../src/lib/studyBlocks'
import type { StudyBlockInput } from '../src/types'

const block = (date: string, done = false): StudyBlockInput => ({ id: date, date, start: '17:00', end: '18:00', done })

describe('shiftOpenBlocks', () => {
  it('verschiebt offene Lernzeiten um die Anzahl Tage, Uhrzeit bleibt', () => {
    expect(shiftOpenBlocks([block('2026-11-12')], 7)).toEqual([{ ...block('2026-11-12'), date: '2026-11-19' }])
  })
  it('erledigte Lernzeiten bleiben, wo sie waren', () => {
    const list = [block('2026-11-05', true), block('2026-11-12')]
    expect(shiftOpenBlocks(list, 7).map((b) => b.date)).toEqual(['2026-11-05', '2026-11-19'])
  })
  it('rückwärts und über den Monatswechsel', () => {
    expect(shiftOpenBlocks([block('2026-12-02')], -3)[0].date).toBe('2026-11-29')
  })
  it('0 Tage ändert nichts', () => {
    const list = [block('2026-11-12')]
    expect(shiftOpenBlocks(list, 0)).toBe(list)
  })
})

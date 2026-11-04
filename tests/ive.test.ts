import { describe, expect, it } from 'vitest'
import { IVE_SLOTS, nextIveBlock } from '../src/lib/ive'

const [di, , fr] = IVE_SLOTS

describe('IVE-Lektionen als Lernzeit', () => {
  it('nimmt den nächsten passenden Wochentag ab heute', () => {
    // 2026-11-04 ist ein Mittwoch
    expect(nextIveBlock(di, [], '2026-11-04')).toEqual({ date: '2026-11-10', start: '14:30', end: '15:15', done: false })
    expect(nextIveBlock(fr, [], '2026-11-04').date).toBe('2026-11-06')
  })

  it('heute zählt mit, wenn heute der Tag ist', () => {
    expect(nextIveBlock(di, [], '2026-11-10').date).toBe('2026-11-10')
  })

  it('springt eine Woche weiter, wenn die Lektion schon eingetragen ist', () => {
    const blocks = [{ date: '2026-11-06', start: '11:10', end: '11:55', done: false }]
    expect(nextIveBlock(fr, blocks, '2026-11-04').date).toBe('2026-11-13')
  })
})

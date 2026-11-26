import { describe, expect, it } from 'vitest'
import { rollToday } from '../src/lib/router'

describe('Tageswechsel', () => {
  it('stand auf heute → springt auf den neuen Tag', () => {
    expect(rollToday({ view: 'woche', date: '2026-11-25' }, '2026-11-25', '2026-11-26')).toEqual({
      view: 'woche',
      date: '2026-11-26',
    })
  })
  it('auch in der Heute-Übersicht (Datum für den Kalender danach)', () => {
    expect(rollToday({ view: 'heute', date: '2026-11-25' }, '2026-11-25', '2026-11-26')?.date).toBe('2026-11-26')
  })
  it('selbst gewählter anderer Tag bleibt', () => {
    expect(rollToday({ view: 'tag', date: '2026-12-03' }, '2026-11-25', '2026-11-26')).toBeNull()
  })
  it('gleicher Tag → nichts ändern', () => {
    expect(rollToday({ view: 'monat', date: '2026-11-26' }, '2026-11-26', '2026-11-26')).toBeNull()
  })
})

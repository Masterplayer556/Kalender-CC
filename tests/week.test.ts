import { describe, expect, it } from 'vitest'
import { weekOutlook } from '../src/lib/week'
import type { Entry } from '../src/types'

const entry = (partial: Partial<Entry>): Entry => ({
  id: partial.title ?? 'x',
  user_id: 'u',
  title: 'Eintrag',
  category: 'test',
  subject_id: null,
  date: '2026-11-11',
  end_date: null,
  start_time: null,
  end_time: null,
  notes: null,
  done: false,
  created_at: '',
  updated_at: '',
  ...partial,
})

// Mittwoch, 11.11.2026 – die Woche geht vom 09.11. (Mo) bis 15.11. (So)
const today = '2026-11-11'

describe('weekOutlook (Kachel "Noch diese Woche")', () => {
  it('zählt offene Tests und Aufgaben von heute bis Sonntag', () => {
    const list = [
      entry({ title: 'Test heute', date: '2026-11-11' }),
      entry({ title: 'Test Sonntag', date: '2026-11-15' }),
      entry({ title: 'Aufgabe Do', date: '2026-11-12', category: 'aufgabe' }),
    ]
    expect(weekOutlook(list, today)).toEqual({ tests: 2, tasks: 1 })
  })

  it('auf nächste Woche verschobener Test zählt nicht mehr', () => {
    const moved = entry({ title: 'LU 20', date: '2026-11-17' }) // vorher am 10.11.
    expect(weekOutlook([moved], today)).toEqual({ tests: 0, tasks: 0 })
  })

  it('Tests von früher in dieser Woche zählen nicht mehr (sie sind vorbei)', () => {
    const monday = entry({ title: 'Akustik', date: '2026-11-09' })
    expect(weekOutlook([monday], today).tests).toBe(0)
  })

  it('Erledigtes zählt nicht', () => {
    const list = [
      entry({ title: 'Test erledigt', date: '2026-11-13', done: true }),
      entry({ title: 'Aufgabe erledigt', date: '2026-11-13', category: 'aufgabe', done: true }),
    ]
    expect(weekOutlook(list, today)).toEqual({ tests: 0, tasks: 0 })
  })

  it('verpasste Aufgaben stehen unter "Überfällig" und werden hier nicht doppelt gezählt', () => {
    const missed = entry({ title: 'Aufgabe Mo', date: '2026-11-09', category: 'aufgabe' })
    expect(weekOutlook([missed], today).tasks).toBe(0)
  })

  it('Events und Sonstiges zählen nicht', () => {
    const list = [entry({ category: 'event', date: '2026-11-12' }), entry({ category: 'sonstiges', date: '2026-11-12' })]
    expect(weekOutlook(list, today)).toEqual({ tests: 0, tasks: 0 })
  })

  it('am Sonntag zählt nur noch der Sonntag, der Montag gehört zur nächsten Woche', () => {
    const list = [entry({ title: 'So', date: '2026-11-15' }), entry({ title: 'Mo', date: '2026-11-16' })]
    expect(weekOutlook(list, '2026-11-15').tests).toBe(1)
  })
})

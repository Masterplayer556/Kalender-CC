import { describe, expect, it } from 'vitest'
import { overdueEntries, testsAwaitingGrade } from '../src/lib/overdue'
import type { Entry } from '../src/types'

const entry = (partial: Partial<Entry>): Entry => ({
  id: partial.title ?? 'x',
  user_id: 'u',
  title: 'Eintrag',
  category: 'aufgabe',
  subject_id: null,
  date: '2026-10-20',
  start_time: null,
  end_time: null,
  notes: null,
  done: false,
  created_at: '',
  updated_at: '',
  ...partial,
})

describe('Überfällig', () => {
  const today = '2026-10-20'
  const list = [
    entry({ title: 'heute', date: '2026-10-20' }),
    entry({ title: 'neuere Aufgabe', date: '2026-10-18' }),
    entry({ title: 'ältere Aufgabe', date: '2026-10-01' }),
    entry({ title: 'erledigt', date: '2026-10-15', done: true }),
    entry({ title: 'vergangener Test', date: '2026-10-16', category: 'test' }),
    entry({ title: 'Sonstiges', date: '2026-10-19', category: 'sonstiges' }),
  ]

  it('nur vergangene, offene Nicht-Tests – älteste zuerst', () => {
    expect(overdueEntries(list, today).map((e) => e.title)).toEqual(['ältere Aufgabe', 'neuere Aufgabe', 'Sonstiges'])
  })
})

describe('Note eintragen?', () => {
  const today = '2026-10-20'
  const list = [
    entry({ title: 'gestern', category: 'test', date: '2026-10-19' }),
    entry({ title: 'benotet', category: 'test', date: '2026-10-18' }),
    entry({ title: 'vor 30 Tagen', category: 'test', date: '2026-09-20' }),
    entry({ title: 'vor 31 Tagen', category: 'test', date: '2026-09-19' }),
    entry({ title: 'heute', category: 'test', date: '2026-10-20' }),
    entry({ title: 'Aufgabe', category: 'aufgabe', date: '2026-10-19' }),
  ]
  it('nur vergangene Tests der letzten 30 Tage ohne Note, neueste zuerst', () => {
    expect(testsAwaitingGrade(list, new Set(['benotet']), today).map((e) => e.title)).toEqual(['gestern', 'vor 30 Tagen'])
  })
})

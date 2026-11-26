import { describe, expect, it } from 'vitest'
import { blockMinutes, formatDuration, hours, studyWeek, weekOutlook } from '../src/lib/week'
import type { Entry, StudyBlock } from '../src/types'

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

describe('Lernwoche in Stunden', () => {
  const block = (id: string, start: string, end: string, done = false, entry_id = 'e1'): StudyBlock => ({
    id,
    user_id: 'u',
    entry_id,
    starts_at: `2026-11-10T${start}:00+01:00`,
    ends_at: `2026-11-10T${end}:00+01:00`,
    done,
  })
  const subjects: Record<string, string | null> = { e1: 'mathe', e2: 'franz', e3: null }

  it('zählt Minuten statt Blöcke', () => {
    const w = studyWeek([block('ive', '14:30', '15:15', true), block('abend', '17:00', '20:00')], (b) => subjects[b.entry_id])
    expect(w.planned).toBe(45 + 180)
    expect(w.done).toBe(45)
  })
  it('pro Fach, meiste Zeit zuerst', () => {
    const w = studyWeek(
      [block('a', '14:00', '15:00', true, 'e1'), block('b', '16:00', '18:00', false, 'e2'), block('c', '19:00', '19:30', true, 'e3')],
      (b) => subjects[b.entry_id],
    )
    expect(w.bySubject).toEqual([
      { subjectId: 'franz', planned: 120, done: 0 },
      { subjectId: 'mathe', planned: 60, done: 60 },
      { subjectId: null, planned: 30, done: 30 },
    ])
  })
  it('leere Woche', () => {
    expect(studyWeek([], () => null)).toEqual({ planned: 0, done: 0, bySubject: [] })
  })
  it('Dauer über Mitternacht und verkehrte Zeiten', () => {
    expect(blockMinutes({ starts_at: '2026-11-10T23:00:00+01:00', ends_at: '2026-11-11T00:30:00+01:00' })).toBe(90)
    expect(blockMinutes({ starts_at: '2026-11-10T12:00:00+01:00', ends_at: '2026-11-10T11:00:00+01:00' })).toBe(0)
  })
  it.each([
    [45, '45 min'],
    [60, '1 h'],
    [90, '1.5 h'],
    [100, '1.7 h'],
    [240, '4 h'],
  ])('formatDuration(%i) = %s', (min, text) => {
    expect(formatDuration(min)).toBe(text)
  })
  it('hours rundet auf eine Stelle', () => {
    expect(hours(150)).toBe(2.5)
    expect(hours(45)).toBe(0.8)
  })
})

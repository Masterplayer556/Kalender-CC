import { describe, expect, it } from 'vitest'
import { matchesFilters, matchesSearch, NO_SUBJECT } from '../src/lib/filters'
import { compareEntries, entryCovers, groupFor, groupUpcoming } from '../src/lib/grouping'
import type { Entry } from '../src/types'

function entry(partial: Partial<Entry>): Entry {
  return {
    id: Math.random().toString(36),
    user_id: 'u',
    title: 'Eintrag',
    category: 'test',
    subject_id: null,
    date: '2026-10-20',
    end_date: null,
    start_time: null,
    end_time: null,
    notes: null,
    done: false,
    created_at: '',
    updated_at: '',
    ...partial,
  }
}

describe('Suche', () => {
  const e = entry({ title: 'Test über den Ersten Weltkrieg', notes: 'Seiten 34–52, Versailler Vertrag' })
  it('findet Wörter in Titel und Notizen, Groß-/Kleinschreibung egal', () => {
    expect(matchesSearch(e, 'weltkrieg')).toBe(true)
    expect(matchesSearch(e, 'VERSAILLER')).toBe(true)
    expect(matchesSearch(e, 'Ersten versailler')).toBe(true)
  })
  it('alle Wörter müssen vorkommen', () => {
    expect(matchesSearch(e, 'Weltkrieg Mathe')).toBe(false)
  })
})

describe('Filter', () => {
  const geschichte = entry({ category: 'test', subject_id: 'ges' })
  const ohneFach = entry({ category: 'aufgabe', subject_id: null })
  it('leere Filter lassen alles durch', () => {
    expect(matchesFilters(geschichte, { categories: [], subjects: [] })).toBe(true)
  })
  it('nach Kategorie', () => {
    expect(matchesFilters(geschichte, { categories: ['aufgabe'], subjects: [] })).toBe(false)
    expect(matchesFilters(ohneFach, { categories: ['aufgabe'], subjects: [] })).toBe(true)
  })
  it('nach Fach, inkl. "ohne Fach"', () => {
    expect(matchesFilters(geschichte, { categories: [], subjects: ['ges'] })).toBe(true)
    expect(matchesFilters(ohneFach, { categories: [], subjects: ['ges'] })).toBe(false)
    expect(matchesFilters(ohneFach, { categories: [], subjects: [NO_SUBJECT] })).toBe(true)
  })
})

describe('Liste "Als Nächstes"', () => {
  it('sortiert nach Datum, dann Uhrzeit (ganztägig zuerst)', () => {
    const list = [
      entry({ title: 'C', date: '2026-10-21' }),
      entry({ title: 'B', date: '2026-10-20', start_time: '14:00:00' }),
      entry({ title: 'A', date: '2026-10-20' }),
    ].sort(compareEntries)
    expect(list.map((e) => e.title)).toEqual(['A', 'B', 'C'])
  })
  it('lässt Vergangenes weg und blendet Erledigtes nur auf Wunsch ein', () => {
    const list = [
      entry({ title: 'alt', date: '2026-10-19' }),
      entry({ title: 'offen', date: '2026-10-20' }),
      entry({ title: 'erledigt', date: '2026-10-22', done: true }),
    ]
    const titles = (showDone: boolean) =>
      groupUpcoming(list, '2026-10-20', showDone).flatMap((g) => g.entries.map((e) => e.title))
    expect(titles(false)).toEqual(['offen'])
    expect(titles(true)).toEqual(['offen', 'erledigt'])
  })
  it('mehrtägiges Event, das noch läuft, steht unter "Heute"', () => {
    const lager = entry({ title: 'Musiklager', category: 'event', date: '2026-10-18', end_date: '2026-10-21' })
    const vorbei = entry({ title: 'vorbei', category: 'event', date: '2026-10-16', end_date: '2026-10-19' })
    expect(groupUpcoming([lager, vorbei], '2026-10-20', false)).toEqual([{ group: 'Heute', entries: [lager] }])
  })
  it('entryCovers: an jedem Tag von Beginn bis Ende', () => {
    const e = entry({ date: '2026-10-23', end_date: '2026-10-25' })
    expect(['2026-10-22', '2026-10-23', '2026-10-25', '2026-10-26'].map((d) => entryCovers(e, d))).toEqual([
      false, true, true, false,
    ])
    expect(entryCovers(entry({ date: '2026-10-23' }), '2026-10-23')).toBe(true)
  })
})

describe('groupFor: "Diese Woche" = bis Sonntag', () => {
  it('Dienstag 20.10.2026', () => {
    const t = '2026-10-20'
    expect(groupFor(t, '2026-10-20')).toBe('Heute')
    expect(groupFor(t, '2026-10-21')).toBe('Morgen')
    expect(groupFor(t, '2026-10-25')).toBe('Diese Woche') // Sonntag
    expect(groupFor(t, '2026-10-26')).toBe('Später') // nächster Montag
  })
  it('Samstag: Sonntag ist "Morgen", Montag schon "Später"', () => {
    expect(groupFor('2026-10-24', '2026-10-25')).toBe('Morgen')
    expect(groupFor('2026-10-24', '2026-10-26')).toBe('Später')
  })
  it('Sonntag: Montag ist "Morgen", nicht "Diese Woche"', () => {
    expect(groupFor('2026-10-25', '2026-10-26')).toBe('Morgen')
    expect(groupFor('2026-10-25', '2026-10-27')).toBe('Später')
  })
})

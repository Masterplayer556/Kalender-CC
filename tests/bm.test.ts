import { describe, expect, it } from 'vitest'
import { bmHasData, bmMissingCrosses, bmSheet, bmTotals, matchSubject, previousSemester } from '../src/lib/bm'
import type { BmRating } from '../src/types'

const row = (semester: string, subject: BmRating['subject'], fach: number, pers: number): BmRating => ({
  id: `${semester}-${subject}`,
  user_id: 'u',
  semester,
  subject,
  fach,
  pers,
  updated_at: '',
})

describe('bmSheet / bmTotals', () => {
  const ratings = [row('2026-1', 'math', 1, 1), row('2026-1', 'franz', 0, 1), row('2025-2', 'math', 1, 0)]
  it('nimmt nur das gewählte Semester, fehlende Fächer zählen 0', () => {
    const sheet = bmSheet(ratings, '2026-1')
    expect(sheet.math).toEqual({ fach: 1, pers: 1 })
    expect(sheet.deutsch).toEqual({ fach: 0, pers: 0 })
    expect(bmTotals(sheet)).toEqual({ fach: 1, pers: 2, total: 3, max: 8 })
  })
  it('zählt alte Werte über 1 als ein Kreuz', () => {
    expect(bmSheet([row('2026-1', 'nmg', 3, 0)], '2026-1').nmg).toEqual({ fach: 1, pers: 0 })
  })
  it('erkennt leere Semester', () => {
    expect(bmHasData(bmSheet(ratings, '2024-1'))).toBe(false)
    expect(bmHasData(bmSheet(ratings, '2025-2'))).toBe(true)
  })
  it('listet die fehlenden Kreuze', () => {
    expect(bmMissingCrosses(bmSheet(ratings, '2026-1'))).toEqual([
      'Deutsch fachlich',
      'Deutsch persönlich',
      'Franz fachlich',
      'NMG fachlich',
      'NMG persönlich',
    ])
  })
})

describe('previousSemester', () => {
  it('springt über den Schuljahreswechsel', () => {
    expect(previousSemester('2026-2')).toBe('2026-1')
    expect(previousSemester('2026-1')).toBe('2025-2')
  })
})

describe('matchSubject', () => {
  const subjects = [{ name: 'Mathematik' }, { name: 'Französisch' }, { name: 'NT' }, { name: 'Englisch' }]
  it('findet passende Fächer für die Farbe', () => {
    expect(matchSubject(subjects, ['math'])?.name).toBe('Mathematik')
    expect(matchSubject(subjects, ['franz'])?.name).toBe('Französisch')
    expect(matchSubject(subjects, ['nmg', 'nt', 'natur'])?.name).toBe('NT')
    expect(matchSubject(subjects, ['deutsch'])).toBeUndefined()
  })
})

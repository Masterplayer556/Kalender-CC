import { describe, expect, it } from 'vitest'
import { bmHasData, bmSheet, bmTotals, matchSubject, previousSemester, toggleCross } from '../src/lib/bm'
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

describe('toggleCross', () => {
  it('füllt bis zum angetippten Kreuz', () => {
    expect(toggleCross(0, 3)).toBe(3)
    expect(toggleCross(4, 2)).toBe(2)
  })
  it('nochmals auf das letzte Kreuz tippen nimmt es weg', () => {
    expect(toggleCross(3, 3)).toBe(2)
    expect(toggleCross(1, 1)).toBe(0)
  })
})

describe('bmSheet / bmTotals', () => {
  const ratings = [row('2026-1', 'math', 3, 4), row('2026-1', 'franz', 1, 2), row('2025-2', 'math', 1, 1)]
  it('nimmt nur das gewählte Semester, fehlende Fächer zählen 0', () => {
    const sheet = bmSheet(ratings, '2026-1')
    expect(sheet.math).toEqual({ fach: 3, pers: 4 })
    expect(sheet.deutsch).toEqual({ fach: 0, pers: 0 })
    expect(bmTotals(sheet)).toEqual({ fach: 4, pers: 6, total: 10, max: 32 })
  })
  it('erkennt leere Semester', () => {
    expect(bmHasData(bmSheet(ratings, '2024-1'))).toBe(false)
    expect(bmHasData(bmSheet(ratings, '2025-2'))).toBe(true)
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

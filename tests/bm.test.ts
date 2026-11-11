import { describe, expect, it } from 'vitest'
import {
  BM_NO,
  BM_OPEN,
  BM_YES,
  bmGoalState,
  bmHasData,
  bmSheet,
  bmTotals,
  matchSubject,
  previousSemester,
  toggleValue,
} from '../src/lib/bm'
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
  const ratings = [row('2026-1', 'math', BM_YES, BM_YES), row('2026-1', 'franz', BM_NO, BM_YES), row('2025-2', 'math', BM_YES, 0)]
  it('nimmt nur das gewählte Semester, fehlende Fächer sind offen', () => {
    const sheet = bmSheet(ratings, '2026-1')
    expect(sheet.math).toEqual({ fach: BM_YES, pers: BM_YES })
    expect(sheet.deutsch).toEqual({ fach: BM_OPEN, pers: BM_OPEN })
    expect(bmTotals(sheet)).toEqual({ yes: 3, no: 1, open: 4, fach: 1, pers: 2, max: 8 })
  })
  it('unbekannte Werte gelten als offen', () => {
    expect(bmSheet([row('2026-1', 'nmg', 7, BM_NO)], '2026-1').nmg).toEqual({ fach: BM_OPEN, pers: BM_NO })
  })
  it('erkennt leere Semester', () => {
    expect(bmHasData(bmSheet(ratings, '2024-1'))).toBe(false)
    expect(bmHasData(bmSheet(ratings, '2025-2'))).toBe(true)
  })
})

describe('bmGoalState (Ziel: 6 × Ja)', () => {
  it('erreicht', () => {
    const r = ['math', 'deutsch', 'franz'].map((s) => row('2026-1', s as BmRating['subject'], BM_YES, BM_YES))
    expect(bmGoalState(bmSheet(r, '2026-1'))).toBe('reached')
  })
  it('noch möglich, solange genug Felder offen sind', () => {
    expect(bmGoalState(bmSheet([row('2026-1', 'math', BM_NO, BM_NO)], '2026-1'))).toBe('possible')
  })
  it('nicht mehr möglich bei drei "Nein"', () => {
    const r = [row('2026-1', 'math', BM_NO, BM_NO), row('2026-1', 'franz', BM_NO, BM_YES)]
    expect(bmGoalState(bmSheet(r, '2026-1'))).toBe('lost')
  })
})

describe('toggleValue', () => {
  it('setzt Ja/Nein und nimmt es beim zweiten Tipp weg', () => {
    expect(toggleValue(BM_OPEN, BM_YES)).toBe(BM_YES)
    expect(toggleValue(BM_YES, BM_NO)).toBe(BM_NO)
    expect(toggleValue(BM_NO, BM_NO)).toBe(BM_OPEN)
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

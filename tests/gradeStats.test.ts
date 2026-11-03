import { describe, expect, it } from 'vitest'
import { overallTrend, runningAverage, trendDelta } from '../src/lib/gradeStats'

describe('runningAverage', () => {
  it('ein Punkt pro Datum, gewichtet und chronologisch', () => {
    const points = runningAverage([
      { date: '2026-09-10', grade: 5, weight: 1 },
      { date: '2026-08-20', grade: 4, weight: 1 },
      { date: '2026-09-10', grade: 6, weight: 2 },
    ])
    expect(points).toEqual([
      { date: '2026-08-20', value: 4 },
      // (4 + 5 + 6×2) / 4 = 21 / 4
      { date: '2026-09-10', value: 5.25 },
    ])
  })
  it('ohne Noten → leer', () => {
    expect(runningAverage([])).toEqual([])
  })
})

describe('overallTrend', () => {
  it('Durchschnitt der gerundeten Fachnoten nach jedem Datum', () => {
    const points = overallTrend([
      { subject_id: 'm', date: '2026-09-01', grade: 5.2, weight: 1 }, // Mathe → 5
      { subject_id: 'f', date: '2026-09-05', grade: 4.3, weight: 1 }, // Franz → 4.5
      { subject_id: 'm', date: '2026-09-05', grade: 6, weight: 1 }, // Mathe 5.6 → 5.5
    ])
    expect(points).toEqual([
      { date: '2026-09-01', value: 5 },
      { date: '2026-09-05', value: 5 }, // (5.5 + 4.5) / 2
    ])
  })
})

describe('trendDelta', () => {
  const points = [
    { date: '2026-09-01', value: 4.5 },
    { date: '2026-10-01', value: 4.75 },
    { date: '2026-10-20', value: 5 },
  ]
  it('vergleicht mit dem letzten Punkt vor dem Stichtag', () => {
    expect(trendDelta(points, '2026-10-05')).toBeCloseTo(0.25)
  })
  it('ohne früheren Punkt → Vergleich mit dem ersten', () => {
    expect(trendDelta(points, '2026-08-01')).toBeCloseTo(0.5)
  })
  it('nur ein Punkt → null', () => {
    expect(trendDelta(points.slice(0, 1), '2026-10-05')).toBeNull()
  })
})

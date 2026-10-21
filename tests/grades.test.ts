import { describe, expect, it } from 'vitest'
import { formatGrade, requiredGrade, roundToHalf, semesterOf, weightedAverage } from '../src/lib/grades'

describe('Durchschnitt', () => {
  it('ohne Noten → null', () => {
    expect(weightedAverage([])).toBeNull()
  })
  it('ungewichtet', () => {
    expect(weightedAverage([{ grade: 4, weight: 1 }, { grade: 5, weight: 1 }])).toBe(4.5)
  })
  it('gewichtet: eine Prüfung zählt doppelt', () => {
    // (4×1 + 5.5×2) / 3 = 15 / 3 = 5
    expect(weightedAverage([{ grade: 4, weight: 1 }, { grade: 5.5, weight: 2 }])).toBe(5)
  })
})

describe('Zeugnisnote (auf halbe Noten gerundet)', () => {
  it.each([
    [4.24, 4],
    [4.25, 4.5],
    [4.74, 4.5],
    [4.75, 5],
    [5.9, 6],
    [3.749, 3.5],
  ])('%f → %f', (input, expected) => {
    expect(roundToHalf(input)).toBe(expected)
  })
})

describe('Notenrechner: Welche Note brauche ich?', () => {
  it('Noten 4 und 5, Ziel 4.5, nächste zählt einfach → 4.5', () => {
    expect(requiredGrade([{ grade: 4, weight: 1 }, { grade: 5, weight: 1 }], 4.5, 1)).toBeCloseTo(4.5)
  })
  it('Noten 4 und 4, Ziel 4.5 → 5.5', () => {
    expect(requiredGrade([{ grade: 4, weight: 1 }, { grade: 4, weight: 1 }], 4.5, 1)).toBeCloseTo(5.5)
  })
  it('nächste Prüfung zählt doppelt → braucht weniger hohe Note', () => {
    // (4 + 4 + x·2) / 4 = 4.5  →  x = 5
    expect(requiredGrade([{ grade: 4, weight: 1 }, { grade: 4, weight: 1 }], 4.5, 2)).toBeCloseTo(5)
  })
  it('ohne bisherige Noten: braucht genau das Ziel', () => {
    expect(requiredGrade([], 4, 1)).toBeCloseTo(4)
  })
  it('unerreichbar → Ergebnis über 6', () => {
    expect(requiredGrade([{ grade: 3, weight: 1 }], 5, 1)).toBeGreaterThan(6)
  })
})

describe('Semester', () => {
  it('August–Dezember: 1. Semester des neuen Schuljahrs', () => {
    expect(semesterOf('2026-08-17')).toEqual({ key: '2026-1', label: '2026/27 · 1. Semester' })
    expect(semesterOf('2026-12-20')).toEqual({ key: '2026-1', label: '2026/27 · 1. Semester' })
  })
  it('Januar gehört noch zum 1. Semester', () => {
    expect(semesterOf('2027-01-25').key).toBe('2026-1')
  })
  it('Februar–Juli: 2. Semester', () => {
    expect(semesterOf('2027-02-01').key).toBe('2026-2')
    expect(semesterOf('2027-07-05')).toEqual({ key: '2026-2', label: '2026/27 · 2. Semester' })
  })
  it('Jahrhundertwechsel-Format', () => {
    expect(semesterOf('2099-09-01').label).toBe('2099/00 · 1. Semester')
  })
})

describe('Anzeige', () => {
  it('ohne überflüssige Nullen', () => {
    expect(formatGrade(5)).toBe('5')
    expect(formatGrade(4.5)).toBe('4.5')
    expect(formatGrade(4.75)).toBe('4.75')
  })
})

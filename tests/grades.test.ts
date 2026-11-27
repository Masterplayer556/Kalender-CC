import { describe, expect, it } from 'vitest'
import {
  ALL_SEMESTERS,
  formatGrade,
  gradesInSemester,
  groupBySubject,
  overallAverage,
  pickSemester,
  semesterChoice,
  semesterLabel,
  semesterRange,
  requiredGrade,
  roundToHalf,
  semesterOf,
  weightedAverage,
} from '../src/lib/grades'

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

describe('Gespeicherte Semester-Auswahl', () => {
  it('"Alle Noten" bleibt gewählt', () => {
    expect(pickSemester(ALL_SEMESTERS, '2026-1')).toBe('alle')
  })
  it('„aktuelles Semester“ gewählt → nach dem Semesterwechsel das neue', () => {
    const saved = semesterChoice('2026-1', '2026-1') // im Herbst das aktuelle gewählt
    expect(pickSemester(saved, '2026-1')).toBe('2026-1')
    expect(pickSemester(saved, '2026-2')).toBe('2026-2') // im Februar
    expect(semesterChoice('2025-2', '2026-1')).toBe('2025-2') // früheres Semester bleibt fest gewählt
  })
  it('gültiges Semester bleibt', () => {
    expect(pickSemester('2025-2', '2026-1')).toBe('2025-2')
  })
  it.each([undefined, null, 42, '', '2025-3', 'irgendwas'])('ungültig (%s) → aktuelles Semester', (v) => {
    expect(pickSemester(v, '2026-1')).toBe('2026-1')
  })
})

describe('semesterLabel', () => {
  it('beschriftet die gewählte Semester-Auswahl', () => {
    expect(semesterLabel('2026-1')).toBe('2026/27 · 1. Semester')
    expect(semesterLabel('2025-2')).toBe('2025/26 · 2. Semester')
    expect(semesterLabel(ALL_SEMESTERS)).toBe('Alle Noten')
  })
})

describe('semesterRange', () => {
  it('1. Semester: August bis Januar', () => {
    expect(semesterRange('2026-1')).toEqual(['2026-08-01', '2027-01-31'])
  })
  it('2. Semester: Februar bis Juli des Folgejahrs', () => {
    expect(semesterRange('2026-2')).toEqual(['2027-02-01', '2027-07-31'])
  })
  it('passt zu semesterOf', () => {
    for (const key of ['2026-1', '2026-2']) {
      const [start, end] = semesterRange(key)
      expect(semesterOf(start).key).toBe(key)
      expect(semesterOf(end).key).toBe(key)
    }
  })
})

describe('Gesamtschnitt (overallAverage)', () => {
  const g = (subject_id: string, grade: number, weight = 1, date = '2026-09-01') => ({ subject_id, grade, weight, date })

  it('ohne Noten → null', () => {
    expect(overallAverage([])).toBeNull()
  })
  it('Durchschnitt der gerundeten Fachnoten, nicht aller Noten', () => {
    // Mathe: (4 + 4.5) / 2 = 4.25 → 4.5; Deutsch: 6 → 6; Gesamt (4.5 + 6) / 2 = 5.25
    const result = overallAverage([g('m', 4), g('m', 4.5), g('d', 6)])!
    expect(result.overall).toBeCloseTo(5.25)
    expect(result.raw).toBeCloseTo((4.25 + 6) / 2)
    expect(result.reports).toEqual(new Map([['m', 4.5], ['d', 6]]))
  })
  it('Gewichte zählen pro Fach', () => {
    // (4 + 6·3) / 4 = 5.5
    expect(overallAverage([g('m', 4), g('m', 6, 3)])!.overall).toBeCloseTo(5.5)
  })
  it('nach Semester gefiltert', () => {
    const list = [g('m', 4, 1, '2026-09-01'), g('m', 6, 1, '2027-03-01')]
    expect(gradesInSemester(list, '2026-1')).toHaveLength(1)
    expect(gradesInSemester(list, ALL_SEMESTERS)).toHaveLength(2)
    expect(overallAverage(gradesInSemester(list, '2026-2'))!.overall).toBe(6)
  })
  it('groupBySubject behält die Reihenfolge', () => {
    const map = groupBySubject([g('a', 1), g('b', 2), g('a', 3)])
    expect([...map.keys()]).toEqual(['a', 'b'])
    expect(map.get('a')!.map((x) => x.grade)).toEqual([1, 3])
  })
})

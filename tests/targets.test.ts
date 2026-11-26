import { describe, expect, it } from 'vitest'
import { plannedTests, targetStatus, whatIf } from '../src/lib/targets'

describe('targetStatus', () => {
  it('Ziel erreicht, wenn die Zeugnisnote reicht (4.8 → 5)', () => {
    // Ziel bleibt aktiv: (4.8 + x) / 2 = 4.75 → x = 4.7 zum Halten
    expect(targetStatus([{ grade: 4.8, weight: 1 }], 5)).toEqual({ state: 'reached', keep: 4.7 })
  })
  it('Ziel hält auch mit einer 1', () => {
    expect(targetStatus([{ grade: 6, weight: 3 }], 4)).toEqual({ state: 'reached', keep: null })
  })
  it('nötige Note für die nächste Prüfung', () => {
    // Schnitt 4.5 bei 2 Noten; für 5 im Zeugnis braucht es Schnitt 4.75 → (9 + x) / 3 = 4.75 → x = 5.25
    expect(targetStatus([{ grade: 4, weight: 1 }, { grade: 5, weight: 1 }], 5)).toEqual({ state: 'needs', grade: 5.25 })
  })
  it('nicht erreichbar mit einer Prüfung', () => {
    expect(targetStatus([{ grade: 3, weight: 2 }], 6)).toEqual({ state: 'out-of-reach' })
  })
})

describe('targetStatus mit mehreren geplanten Tests', () => {
  it('zwei Tests: nötige Note für jeden', () => {
    // Für 5 im Zeugnis Schnitt 4.75: (4 + 5 + 2x) / 4 = 4.75 → x = 5
    expect(targetStatus([{ grade: 4, weight: 1 }, { grade: 5, weight: 1 }], 5, 2)).toEqual({ state: 'needs', grade: 5 })
  })
  it('mit mehr Tests wird ein Ziel erreichbar', () => {
    const grades = [{ grade: 3, weight: 2 }]
    expect(targetStatus(grades, 5, 1)).toEqual({ state: 'out-of-reach' })
    // (6 + 3x) / 5 = 4.75 → x = 5.92
    expect(targetStatus(grades, 5, 3)).toEqual({ state: 'needs', grade: 5.92 })
  })
  it('0 geplante Tests zählt wie eine nächste Prüfung', () => {
    expect(targetStatus([{ grade: 4, weight: 1 }], 5, 0)).toEqual(targetStatus([{ grade: 4, weight: 1 }], 5, 1))
  })
})

describe('whatIf', () => {
  it('neuer Schnitt und Zeugnisnote', () => {
    // (4 + 4.5 + 5) / 3 = 4.5
    expect(whatIf([{ grade: 4, weight: 1 }, { grade: 4.5, weight: 1 }], 5, 1)).toEqual({ average: 4.5, report: 4.5 })
  })
  it('mit Gewicht', () => {
    // (4 + 6·2) / 3 = 5.33 → 5.5
    const r = whatIf([{ grade: 4, weight: 1 }], 6, 2)
    expect(r.average).toBeCloseTo(5.333, 2)
    expect(r.report).toBe(5.5)
  })
})

describe('plannedTests', () => {
  const t = (id: string, date: string, subject_id: string | null, category = 'test') => ({ id, title: id, date, subject_id, category })
  const entries = [
    t('spaet', '2026-12-10', 'm'),
    t('frueh', '2026-11-30', 'm'),
    t('vorbei', '2026-11-20', 'm'),
    t('benotet', '2026-12-01', 'm'),
    t('ohneFach', '2026-12-01', null),
    t('aufgabe', '2026-12-01', 'm', 'aufgabe'),
    t('naechstesSemester', '2027-02-10', 'm'),
    t('deutsch', '2026-12-02', 'd'),
  ]
  it('nur kommende Tests mit Fach, ohne Note, bis zum Semesterende – nach Datum', () => {
    const map = plannedTests(entries, new Set(['benotet']), '2026-11-26', '2027-01-31')
    expect(map.get('m')!.map((e) => e.id)).toEqual(['frueh', 'spaet'])
    expect(map.get('d')!.map((e) => e.id)).toEqual(['deutsch'])
    expect(map.size).toBe(2)
  })
  it('heute zählt mit', () => {
    expect(plannedTests([t('heute', '2026-11-26', 'm')], new Set(), '2026-11-26', '2027-01-31').get('m')).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'
import { targetStatus } from '../src/lib/targets'

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

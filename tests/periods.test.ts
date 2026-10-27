import { describe, expect, it } from 'vitest'
import { holidayStatus, periodLength, periodsByDay, schoolDaysUntil } from '../src/lib/periods'
import type { Period } from '../src/types'

const period = (partial: Partial<Period>): Period => ({
  id: partial.name ?? 'p',
  user_id: 'u',
  name: 'Ferien',
  kind: 'ferien',
  start_date: '2026-10-03',
  end_date: '2026-10-18',
  created_at: '',
  ...partial,
})

// Herbstferien: Sa 03.10. – So 18.10.2026
const herbst = period({ name: 'Herbstferien' })
// Weihnachtsferien: Sa 19.12.2026 – So 03.01.2027
const weihnacht = period({ name: 'Weihnachtsferien', start_date: '2026-12-19', end_date: '2027-01-03' })

describe('Zeiträume', () => {
  it('Länge zählt beide Enden mit', () => {
    expect(periodLength(herbst)).toBe(16)
    expect(periodLength(period({ start_date: '2026-05-14', end_date: '2026-05-14' }))).toBe(1)
  })

  it('pro Tag nachschlagen: Anfang und Ende gehören dazu', () => {
    const map = periodsByDay([herbst], ['2026-10-02', '2026-10-03', '2026-10-18', '2026-10-19'])
    expect(map.get('2026-10-02')).toEqual([])
    expect(map.get('2026-10-03')).toEqual([herbst])
    expect(map.get('2026-10-18')).toEqual([herbst])
    expect(map.get('2026-10-19')).toEqual([])
  })

  it('Schultage: nur Mo–Fr, freie Tage zählen nicht', () => {
    // Mo 07.12. bis vor Sa 19.12. = 2 Wochen = 10 Schultage
    expect(schoolDaysUntil('2026-12-07', '2026-12-19', [])).toBe(10)
    const frei = period({ kind: 'frei', start_date: '2026-12-08', end_date: '2026-12-08' })
    expect(schoolDaysUntil('2026-12-07', '2026-12-19', [frei])).toBe(9)
  })

  it('Countdown bis zu den nächsten Ferien', () => {
    const status = holidayStatus([weihnacht, herbst], '2026-12-07')
    expect(status).toMatchObject({ state: 'upcoming', period: weihnacht, daysUntil: 12, schoolDays: 10 })
  })

  it('während der Ferien: verbleibende Tage inklusive heute', () => {
    expect(holidayStatus([herbst, weihnacht], '2026-10-17')).toMatchObject({ state: 'during', period: herbst, daysLeft: 2 })
  })

  it('schulfreie Tage und Lager lösen keinen Ferien-Countdown aus', () => {
    const lager = period({ kind: 'lager', start_date: '2026-11-02', end_date: '2026-11-06' })
    expect(holidayStatus([lager], '2026-10-27')).toBeNull()
  })
})

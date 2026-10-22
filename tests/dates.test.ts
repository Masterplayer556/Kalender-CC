import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  countdown,
  daysBetween,
  formatDate,
  isoWeek,
  isoToLocal,
  localToIso,
  minutesToTime,
  monthGrid,
  startOfWeek,
  timeToMinutes,
  weekDays,
} from '../src/lib/dates'

// Alle Tests laufen in der Zeitzone Europe/Zurich (siehe vite.config.ts).

describe('Wochen beginnen am Montag', () => {
  it('Dienstag → Montag derselben Woche', () => {
    expect(startOfWeek('2026-10-20')).toBe('2026-10-19')
  })
  it('Sonntag gehört zur Woche davor', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19')
  })
  it('Montag bleibt Montag', () => {
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19')
  })
  it('über den Jahreswechsel', () => {
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28')
    expect(weekDays('2027-01-01')).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ])
  })
})

describe('Tage und Monate rechnen', () => {
  it('addDays über Monats- und Schaltjahresgrenzen', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('addDays am Tag der Zeitumstellung', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
  })
  it('addMonths kürzt auf den letzten Tag des Monats', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
  })
  it('daysBetween ignoriert die Zeitumstellung', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-10-20', '2026-10-18')).toBe(-2)
  })
})

describe('Monatsraster', () => {
  it('Oktober 2026: beginnt Mo 28.09., 5 Wochen', () => {
    const grid = monthGrid('2026-10-20')
    expect(grid).toHaveLength(5)
    expect(grid[0][0]).toBe('2026-09-28')
    expect(grid.at(-1)!.at(-1)).toBe('2026-11-01')
  })
  it('Februar 2027 beginnt an einem Montag und braucht genau 4 Wochen', () => {
    const grid = monthGrid('2027-02-10')
    expect(grid).toHaveLength(4)
    expect(grid[0][0]).toBe('2027-02-01')
  })
  it('Monat mit 6 Wochen (August 2027)', () => {
    expect(monthGrid('2027-08-01')).toHaveLength(6)
  })
})

describe('Anzeige', () => {
  it('Datum als TT.MM.JJJJ', () => {
    expect(formatDate('2026-03-05')).toBe('05.03.2026')
  })
  it('Countdown', () => {
    expect(countdown('2026-10-20', '2026-10-20')).toBe('heute')
    expect(countdown('2026-10-20', '2026-10-21')).toBe('morgen')
    expect(countdown('2026-10-20', '2026-10-22')).toBe('übermorgen')
    expect(countdown('2026-10-20', '2026-10-23')).toBe('in 3 Tagen')
    expect(countdown('2026-10-20', '2026-10-15')).toBe('vor 5 Tagen')
  })
  it('Uhrzeiten ↔ Minuten', () => {
    expect(timeToMinutes('17:30')).toBe(1050)
    expect(timeToMinutes('17:30:00')).toBe(1050)
    expect(minutesToTime(1050)).toBe('17:30')
    expect(minutesToTime(0)).toBe('00:00')
  })
})

describe('Lokale Zeit ↔ Datenbank (UTC)', () => {
  it('Sommerzeit: 17:00 in Zürich = 15:00 UTC', () => {
    expect(localToIso('2026-07-01', '17:00')).toBe('2026-07-01T15:00:00.000Z')
  })
  it('Winterzeit: 17:00 in Zürich = 16:00 UTC', () => {
    expect(localToIso('2026-12-01', '17:00')).toBe('2026-12-01T16:00:00.000Z')
  })
  it('Hin und zurück ergibt wieder dasselbe', () => {
    expect(isoToLocal(localToIso('2026-10-25', '18:45'))).toEqual({ date: '2026-10-25', time: '18:45' })
  })
})

describe('Kalenderwoche (ISO)', () => {
  it.each([
    ['2026-10-20', 43],
    ['2026-01-01', 1], // Donnerstag → KW 1
    ['2027-01-01', 53], // Freitag → gehört noch zu KW 53 von 2026
    ['2027-01-04', 1],
    ['2026-12-31', 53],
  ])('%s → KW %i', (date, week) => {
    expect(isoWeek(date)).toBe(week)
  })
})

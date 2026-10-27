import { describe, expect, it } from 'vitest'
import { bandLanes, clipToDay, layoutDay } from '../src/lib/layout'

const at = (iso: string) => new Date(iso) // ohne "Z" = lokale Zeit (Europe/Zurich)

describe('clipToDay: Zeitraum auf einen Tag zuschneiden', () => {
  it('normaler Lernblock 17:00–20:00', () => {
    expect(clipToDay(at('2026-10-19T17:00'), at('2026-10-19T20:00'), '2026-10-19')).toEqual({ start: 1020, end: 1200 })
  })
  it('anderer Tag → null', () => {
    expect(clipToDay(at('2026-10-19T17:00'), at('2026-10-19T20:00'), '2026-10-20')).toBeNull()
  })
  it('über Mitternacht: erscheint an beiden Tagen', () => {
    const s = at('2026-10-19T22:00')
    const e = at('2026-10-20T01:30')
    expect(clipToDay(s, e, '2026-10-19')).toEqual({ start: 1320, end: 1440 })
    expect(clipToDay(s, e, '2026-10-20')).toEqual({ start: 0, end: 90 })
  })
  it('endet genau um Mitternacht → nicht am Folgetag', () => {
    expect(clipToDay(at('2026-10-19T22:00'), at('2026-10-20T00:00'), '2026-10-20')).toBeNull()
  })
  it('Tag der Zeitumstellung (25.10.2026, 25 Stunden): Position nach Uhrzeit, nicht nach Dauer', () => {
    // Nach der Umstellung um 03:00 → 02:00 muss 05:00 trotzdem bei 300 Minuten stehen
    expect(clipToDay(at('2026-10-25T05:00'), at('2026-10-25T06:00'), '2026-10-25')).toEqual({ start: 300, end: 360 })
  })
})

describe('layoutDay: überlappende Blöcke nebeneinander', () => {
  const cols = (items: { start: number; end: number; id: string }[]) =>
    Object.fromEntries(layoutDay(items).map((p) => [p.id, [p.column, p.columns]]))

  it('ohne Überlappung: alle volle Breite', () => {
    expect(cols([
      { id: 'a', start: 480, end: 540 },
      { id: 'b', start: 600, end: 660 },
    ])).toEqual({ a: [0, 1], b: [0, 1] })
  })

  it('direkt hintereinander zählt nicht als Überlappung', () => {
    expect(cols([
      { id: 'a', start: 480, end: 540 },
      { id: 'b', start: 540, end: 600 },
    ])).toEqual({ a: [0, 1], b: [0, 1] })
  })

  it('zwei überlappende teilen sich die Breite', () => {
    expect(cols([
      { id: 'a', start: 480, end: 600 },
      { id: 'b', start: 540, end: 660 },
    ])).toEqual({ a: [0, 2], b: [1, 2] })
  })

  it('freie Spalte wird wiederverwendet', () => {
    // a: 8–12 Uhr, b: 8–9 Uhr, c: 10–11 Uhr → c passt in die Spalte von b
    expect(cols([
      { id: 'a', start: 480, end: 720 },
      { id: 'b', start: 480, end: 540 },
      { id: 'c', start: 600, end: 660 },
    ])).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2] })
  })

  it('drei gleichzeitige → drei Spalten', () => {
    const r = cols([
      { id: 'a', start: 600, end: 660 },
      { id: 'b', start: 600, end: 660 },
      { id: 'c', start: 600, end: 660 },
    ])
    expect(Object.values(r).map(([c]) => c).sort()).toEqual([0, 1, 2])
    expect(Object.values(r).every(([, n]) => n === 3)).toBe(true)
  })

  it('sehr kurze Blöcke bekommen Mindesthöhe und überdecken sich nicht', () => {
    // 5-Minuten-Blöcke direkt hintereinander: mit Mindesthöhe 20 min würden sie sich überlappen
    expect(cols([
      { id: 'a', start: 600, end: 605 },
      { id: 'b', start: 605, end: 610 },
    ])).toEqual({ a: [0, 2], b: [1, 2] })
  })
})

describe('Bänder in der Monatsansicht', () => {
  const week = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']
  const band = (name: string, start: string, end: string) => ({ name, start, end })
  const names = (rows: ({ name: string } | null)[][]) => rows.map((r) => r.map((b) => b?.name ?? '-').join(','))

  it('ein Band bleibt an allen Tagen auf derselben Höhe', () => {
    const theater = band('Theater', '2026-10-29', '2026-11-03')
    const frei = band('Frei', '2026-10-30', '2026-10-30')
    expect(names(bandLanes([frei, theater], week))).toEqual(['', '', '', 'Theater', 'Theater,Frei', 'Theater', 'Theater'])
  })

  it('freie Spur oben bleibt als Platzhalter stehen', () => {
    const a = band('A', '2026-10-26', '2026-10-27')
    const b = band('B', '2026-10-26', '2026-10-28')
    // B ist länger → oben; A darunter. Am 28. ist nur noch B da.
    expect(names(bandLanes([a, b], week)).slice(0, 3)).toEqual(['B,A', 'B,A', 'B'])
    const c = band('C', '2026-10-27', '2026-10-29')
    // C passt in keine Spur, die am 27. frei ist → dritte Spur; am 29. stehen zwei Platzhalter darüber
    expect(names(bandLanes([a, b, c], week)).slice(1, 4)).toEqual(['B,A,C', 'B,-,C', '-,-,C'])
  })

  it('Spur wird wieder frei, wenn das Band davor geendet hat', () => {
    const a = band('A', '2026-10-26', '2026-10-27')
    const b = band('B', '2026-10-29', '2026-10-30')
    expect(names(bandLanes([a, b], week)).slice(0, 5)).toEqual(['A', 'A', '', 'B', 'B'])
  })
})

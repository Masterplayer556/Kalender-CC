import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changedRows,
  fromRows,
  loadLocalPrefs,
  mergePrefs,
  missingOnServer,
  normalizePending,
  saveLocalPrefs,
  serverRows,
  stamp,
  toRows,
  withoutUploaded,
} from '../src/lib/syncedPrefs'
import { asTargets } from '../src/lib/targets'

const T = (s: string) => Date.parse(`2026-11-26T${s}:00Z`)
const iso = (s: string) => new Date(T(s)).toISOString()

describe('mergePrefs', () => {
  it('Server gewinnt gegenüber dem lokalen Stand', () => {
    expect(mergePrefs({ theme: 'sunset' }, { theme: { value: 'neon', at: T('10:00') } }, {}, new Set())).toEqual({ theme: 'neon' })
  })
  it('neuere, noch nicht hochgeladene Änderung gewinnt gegenüber dem Server', () => {
    const next = mergePrefs(
      { showDone: true },
      { showDone: { value: false, at: T('10:00') } },
      { showDone: { value: true, at: T('11:00') } },
      new Set(),
    )
    expect(next.showDone).toBe(true)
  })
  it('ältere Offline-Änderung verliert gegen eine neuere vom anderen Gerät', () => {
    const next = mergePrefs(
      { theme: 'sunset' },
      { theme: { value: 'neon', at: T('11:00') } },
      { theme: { value: 'sunset', at: T('10:00') } },
      new Set(),
    )
    expect(next.theme).toBe('neon')
  })
  it('während des Ladens geänderte Werte bleiben', () => {
    expect(mergePrefs({ showDone: true }, { showDone: { value: false, at: T('10:00') } }, {}, new Set(['showDone']))).toEqual({
      showDone: true,
    })
  })
  it('Werte, die der Server nicht kennt, bleiben lokal erhalten', () => {
    expect(mergePrefs({ themeMode: 'dark' }, { theme: { value: 'neon', at: 1 } }, {}, new Set())).toEqual({
      themeMode: 'dark',
      theme: 'neon',
    })
  })
  it('Notenziele: pro Fach zusammengeführt, nicht als Ganzes überschrieben', () => {
    // Gerät A hat offline Mathe geändert, Gerät B (Server) inzwischen Deutsch
    const next = mergePrefs(
      { gradeTargets: { mathe: 5.5, deutsch: 4.5 } },
      { 'gradeTarget:mathe': { value: 5, at: T('09:00') }, 'gradeTarget:deutsch': { value: 5, at: T('11:00') } },
      { 'gradeTarget:mathe': { value: 5.5, at: T('10:00') } },
      new Set(),
    )
    expect(next.gradeTargets).toEqual({ mathe: 5.5, deutsch: 5 })
  })
  it('Notenziele: auf einem anderen Gerät entferntes Ziel verschwindet', () => {
    const next = mergePrefs({ gradeTargets: { mathe: 5 } }, { 'gradeTarget:mathe': { value: false, at: T('10:00') } }, {}, new Set())
    expect(asTargets(next.gradeTargets)).toEqual({})
  })
})

describe('serverRows', () => {
  it('liest Zeitpunkte und ignoriert Unbekanntes', () => {
    expect(serverRows([{ name: 'theme', value: 'neon', updated_at: iso('10:00') }, { name: 'xyz', value: 1, updated_at: iso('10:00') }])).toEqual({
      theme: { value: 'neon', at: T('10:00') },
    })
  })
  it('altes Notenziel-Objekt gilt pro Fach, ausser eine Zeile ist neuer', () => {
    const rows = serverRows(
      [
        { name: 'gradeTargets', value: { mathe: 5, gesamt: 5 }, updated_at: iso('10:00') },
        { name: 'gradeTarget:mathe', value: 6, updated_at: iso('11:00') },
        { name: 'gradeTarget:gesamt', value: 4, updated_at: iso('09:00') },
      ],
      ['franz'],
    )
    expect(rows['gradeTarget:mathe'].value).toBe(6)
    expect(rows['gradeTarget:gesamt'].value).toBe(5)
    expect(rows['gradeTarget:franz']).toEqual({ value: false, at: T('10:00') }) // fehlt im Objekt → entfernt
  })
})

describe('Zeilen', () => {
  it('Notenziele werden zu einer Zeile pro Fach und zurück', () => {
    const rows = toRows({ gradeTargets: { gesamt: 5, abc: 4.5 }, showDone: true })
    expect(rows).toEqual({ 'gradeTarget:gesamt': 5, 'gradeTarget:abc': 4.5, showDone: true })
    expect(fromRows({ ...rows, 'gradeTarget:weg': false })).toEqual({ gradeTargets: { gesamt: 5, abc: 4.5 }, showDone: true })
  })
  it('changedRows: nur geänderte Fächer, entfernte als false', () => {
    expect(changedRows('gradeTargets', { a: 5, b: 4, c: 6 }, { a: 5, b: 4.5 })).toEqual({ 'gradeTarget:b': 4.5, 'gradeTarget:c': false })
    expect(changedRows('theme', 'sunset', 'neon')).toEqual({ theme: 'neon' })
  })
  it('alter Speicherstand der ausstehenden Änderungen wird übernommen', () => {
    expect(normalizePending({ showDone: true, gradeTargets: { gesamt: 5 } }, 7)).toEqual({
      showDone: { value: true, at: 7 },
      'gradeTarget:gesamt': { value: 5, at: 7 },
    })
    expect(normalizePending({ theme: { value: 'neon', at: 3 } }, 7)).toEqual({ theme: { value: 'neon', at: 3 } })
  })
})

describe('missingOnServer', () => {
  it('lädt früher nur lokal gespeicherte Ziele einmalig hoch', () => {
    expect(missingOnServer({ gradeTargets: { gesamt: 5 }, showDone: true }, { showDone: { value: false, at: 1 } })).toEqual({
      'gradeTarget:gesamt': 5,
    })
  })
  it('Design wird nicht automatisch übernommen', () => {
    expect(missingOnServer({ theme: 'sunset', themeMode: 'auto' }, {})).toEqual({})
  })
})

describe('withoutUploaded', () => {
  it('entfernt Hochgeladenes, behält erneut Geändertes', () => {
    const uploaded = stamp({ showDone: true, theme: 'sunset' }, 1)
    const pending = { ...uploaded, theme: { value: 'neon', at: 2 } }
    expect(withoutUploaded(pending, uploaded)).toEqual({ theme: { value: 'neon', at: 2 } })
  })
})

describe('asTargets', () => {
  it('filtert ungültige Werte', () => {
    expect(asTargets({ gesamt: 5, abc: 'x' })).toEqual({ gesamt: 5 })
    expect(asTargets(null)).toEqual({})
    expect(asTargets([1, 2])).toEqual({})
  })
})

describe('Einstellungen im localStorage pro Benutzer', () => {
  let store: Map<string, string>
  beforeEach(() => {
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ein anderer Benutzer sieht die Einstellungen nicht', () => {
    saveLocalPrefs('anna', { filters: { categories: [], subjects: ['mathe'] }, showDone: true })
    expect(loadLocalPrefs('anna').showDone).toBe(true)
    expect(loadLocalPrefs('ben')).toEqual({})
  })

  it('alte Einstellungen ohne Benutzer gehen einmalig an den ersten Benutzer, das Design bleibt beim Gerät', () => {
    store.set('kalender-pref:showDone', 'true')
    store.set('kalender-pref:theme', '"neon"')
    store.set('andere-app:showDone', 'false')
    expect(loadLocalPrefs('anna')).toEqual({ showDone: true })
    expect(store.has('kalender-pref:showDone')).toBe(false)
    expect(store.get('kalender-pref:theme')).toBe('"neon"')
    expect(store.get('andere-app:showDone')).toBe('false') // fremde Schlüssel (gleiche Origin) bleiben
    expect(loadLocalPrefs('ben')).toEqual({})
  })
})

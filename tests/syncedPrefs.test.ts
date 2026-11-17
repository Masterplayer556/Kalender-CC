import { describe, expect, it } from 'vitest'
import { mergePrefs, missingOnServer, prefsFromRows, withoutUploaded } from '../src/lib/syncedPrefs'
import { asTargets } from '../src/lib/targets'

describe('mergePrefs', () => {
  it('Server gewinnt gegenüber dem lokalen Stand', () => {
    expect(mergePrefs({ theme: 'sunset' }, { theme: 'neon' }, {}, new Set())).toEqual({ theme: 'neon' })
  })
  it('noch nicht hochgeladene Änderungen gewinnen gegenüber dem Server', () => {
    const next = mergePrefs({ gradeTargets: { gesamt: 5 } }, { gradeTargets: { gesamt: 4.5 } }, { gradeTargets: { gesamt: 5 } }, new Set())
    expect(next.gradeTargets).toEqual({ gesamt: 5 })
  })
  it('während des Ladens geänderte Werte bleiben', () => {
    expect(mergePrefs({ showDone: true }, { showDone: false }, {}, new Set(['showDone']))).toEqual({ showDone: true })
  })
  it('Werte, die der Server nicht kennt, bleiben lokal erhalten', () => {
    expect(mergePrefs({ themeMode: 'dark' }, { theme: 'neon' }, {}, new Set())).toEqual({ themeMode: 'dark', theme: 'neon' })
  })
})

describe('missingOnServer', () => {
  it('lädt früher nur lokal gespeicherte Ziele einmalig hoch', () => {
    expect(missingOnServer({ gradeTargets: { gesamt: 5 }, showDone: true }, { showDone: false })).toEqual({ gradeTargets: { gesamt: 5 } })
  })
  it('Design wird nicht automatisch übernommen', () => {
    expect(missingOnServer({ theme: 'sunset', themeMode: 'auto' }, {})).toEqual({})
  })
})

describe('withoutUploaded', () => {
  it('entfernt Hochgeladenes, behält erneut Geändertes', () => {
    const pending = { showDone: true, theme: 'neon' }
    expect(withoutUploaded(pending, { showDone: true, theme: 'sunset' })).toEqual({ theme: 'neon' })
  })
})

describe('prefsFromRows / asTargets', () => {
  it('ignoriert unbekannte Einstellungen', () => {
    expect(prefsFromRows([{ name: 'theme', value: 'neon' }, { name: 'xyz', value: 1 }])).toEqual({ theme: 'neon' })
  })
  it('asTargets filtert ungültige Werte', () => {
    expect(asTargets({ gesamt: 5, abc: 'x' })).toEqual({ gesamt: 5 })
    expect(asTargets(null)).toEqual({})
    expect(asTargets([1, 2])).toEqual({})
  })
})

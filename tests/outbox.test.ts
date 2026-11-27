import { describe, expect, it } from 'vitest'
import { applyOutbox, asOutbox, conflictThreshold, dequeue, enqueue, isRetryable, type OutboxOp, type SaveEntryOp } from '../src/lib/outbox'
import type { Entry, EntryInput, StudyBlock } from '../src/types'

const input = (over: Partial<EntryInput> = {}): EntryInput => ({
  title: 'Test',
  category: 'test',
  subject_id: null,
  date: '2026-12-01',
  end_date: null,
  start_time: '08:00',
  end_time: null,
  notes: null,
  done: false,
  multi_grade: false,
  ...over,
})
const entry = (id: string, over: Partial<Entry> = {}): Entry => ({
  id,
  user_id: 'u',
  title: id,
  category: 'test',
  subject_id: null,
  date: '2026-12-01',
  end_date: null,
  start_time: null,
  end_time: null,
  notes: null,
  done: false,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-20T10:00:00.123456+00:00',
  ...over,
})
const block = (id: string, entry_id: string, over: Partial<StudyBlock> = {}): StudyBlock => ({
  id,
  user_id: 'u',
  entry_id,
  starts_at: '2026-11-30T16:00:00.000Z',
  ends_at: '2026-11-30T17:00:00.000Z',
  done: false,
  ...over,
})
let n = 0
const done = (kind: 'entryDone' | 'blockDone', id: string, value: boolean, at = 1000): OutboxOp => ({ kind, key: `k${++n}`, id, done: value, at })
const save = (id: string, over: Partial<SaveEntryOp> = {}): SaveEntryOp => ({
  kind: 'saveEntry',
  key: `k${++n}`,
  id,
  create: false,
  entry: input(),
  blocks: [],
  removedBlockIds: [],
  at: 2000,
  ...over,
})

describe('Warteschlange zusammenfassen', () => {
  it('mehrmals abhaken: nur das letzte zählt', () => {
    let q = enqueue([], done('entryDone', 'e1', true))
    q = enqueue(q, done('entryDone', 'e1', false))
    q = enqueue(q, done('blockDone', 'e1', true)) // gleiche id, andere Art → bleibt
    expect(q.map((o) => [o.kind, o.id, 'done' in o && o.done])).toEqual([
      ['entryDone', 'e1', false],
      ['blockDone', 'e1', true],
    ])
  })

  it('abhaken eines offline angelegten Eintrags fliesst in das Speichern ein', () => {
    let q = enqueue([], save('neu', { create: true }))
    q = enqueue(q, done('entryDone', 'neu', true, 3000))
    expect(q).toHaveLength(1)
    const op = q[0] as SaveEntryOp
    expect(op.entry.done).toBe(true)
    expect(op.create).toBe(true)
    expect(op.at).toBe(3000)
  })

  it('abhaken einer Lernzeit, die mit dem Speichern kommt', () => {
    const b = { id: 'b1', starts_at: 'x', ends_at: 'y', done: false }
    let q = enqueue([], save('e1', { blocks: [b] }))
    q = enqueue(q, done('blockDone', 'b1', true))
    expect(q).toHaveLength(1)
    expect((q[0] as SaveEntryOp).blocks[0].done).toBe(true)
  })

  it('Speichern ersetzt frühere Haken und frühere Speicher-Änderungen desselben Eintrags', () => {
    const b = { id: 'b1', starts_at: 'x', ends_at: 'y', done: true }
    let q = enqueue([], done('entryDone', 'e1', true))
    q = enqueue(q, done('blockDone', 'b1', true))
    q = enqueue(q, done('blockDone', 'b-anders', true))
    q = enqueue(q, save('e1', { create: true, removedBlockIds: ['b2'], base: 'alt' }))
    q = enqueue(q, save('e1', { create: false, blocks: [b], removedBlockIds: ['b3'], base: 'neuer' }))
    expect(q.map((o) => o.kind + ':' + o.id)).toEqual(['blockDone:b-anders', 'saveEntry:e1'])
    const op = q[1] as SaveEntryOp
    expect(op.create).toBe(true) // noch nie auf dem Server → bleibt "neu"
    expect(op.base).toBe('alt') // Stand vor der ersten Offline-Änderung
    expect(op.removedBlockIds).toEqual(['b2', 'b3'])
  })

  it('entfernte Lernzeit, die wieder im Formular steht, wird nicht gelöscht', () => {
    let q = enqueue([], save('e1', { removedBlockIds: ['b1'] }))
    q = enqueue(q, save('e1', { blocks: [{ id: 'b1', starts_at: 'x', ends_at: 'y', done: false }] }))
    expect((q[0] as SaveEntryOp).removedBlockIds).toEqual([])
  })

  it('was gerade gesendet wird, bleibt unangetastet', () => {
    const first = save('neu', { create: true })
    let q = enqueue([], first)
    q = enqueue(q, done('entryDone', 'neu', true), first.key)
    expect(q).toHaveLength(2)
    expect(q[0].key).toBe(first.key)
    expect((q[0] as SaveEntryOp).entry.done).toBe(false)
    expect((q[1] as SaveEntryOp).entry.done).toBe(true)
    expect((q[1] as SaveEntryOp).create).toBe(true)
    expect(q[1].key).not.toBe(first.key)
    // Nach dem Senden nur die gesendete entfernen
    expect(dequeue(q, first.key)).toEqual([q[1]])
  })

  it('ein neues Speichern während des Sendens ersetzt die gesendete Änderung nicht', () => {
    const first = save('e1', { create: true })
    const q = enqueue([first], save('e1', { create: false }), first.key)
    expect(q).toHaveLength(2)
    expect((q[1] as SaveEntryOp).create).toBe(true)
  })
})

describe('Konflikte: ab wann gewinnt der Server?', () => {
  it('ohne bekannten Stand: Zeitpunkt der Offline-Änderung', () => {
    expect(conflictThreshold({ at: Date.UTC(2026, 10, 26, 12) })).toBe('2026-11-26T12:00:00.000Z')
  })
  it('Server-Stand neuer als die (falsch gehende) Uhr des Geräts: Stand zählt, mit Mikrosekunden', () => {
    const base = '2026-11-26T12:00:00.123456+00:00'
    expect(conflictThreshold({ at: Date.UTC(2026, 10, 26, 11, 59), base })).toBe(base)
    expect(conflictThreshold({ at: Date.parse('2026-11-26T12:00:00.123Z'), base })).toBe(base)
  })
  it('Offline-Änderung später als der bekannte Stand: ihr Zeitpunkt', () => {
    expect(conflictThreshold({ at: Date.UTC(2026, 10, 26, 13), base: '2026-11-26T12:00:00+00:00' })).toBe('2026-11-26T13:00:00.000Z')
  })
  it('kaputter Stand wird ignoriert', () => {
    expect(conflictThreshold({ at: 0, base: 'kaputt' })).toBe('1970-01-01T00:00:00.000Z')
  })
})

describe('Wartende Änderungen anzeigen', () => {
  const data = { entries: [entry('e1'), entry('e2', { date: '2026-12-05' })], blocks: [block('b1', 'e1'), block('b2', 'e1')] }

  it('leere Warteschlange: unverändert (gleiche Objekte)', () => {
    expect(applyOutbox(data, [], 'u')).toBe(data)
  })
  it('Haken an Eintrag und Lernzeit', () => {
    const r = applyOutbox(data, [done('entryDone', 'e1', true), done('blockDone', 'b2', true)], 'u')
    expect(r.entries[0].done).toBe(true)
    expect(r.blocks.find((b) => b.id === 'b2')!.done).toBe(true)
    expect(r.entries[0].updated_at).toBe(data.entries[0].updated_at) // Stand bleibt für den Konflikt-Vergleich
  })
  it('geänderter Eintrag mit Lernzeiten', () => {
    const r = applyOutbox(
      data,
      [save('e1', { entry: input({ title: 'Neu', start_time: '09:30' }), blocks: [{ id: 'b3', starts_at: '2026-11-29T10:00:00.000Z', ends_at: '2026-11-29T11:00:00.000Z', done: false }], removedBlockIds: ['b1'] })],
      'u',
    )
    const e1 = r.entries.find((e) => e.id === 'e1')!
    expect(e1.title).toBe('Neu')
    expect(e1.start_time).toBe('09:30:00') // wie vom Server
    expect(r.blocks.map((b) => b.id)).toEqual(['b3', 'b2']) // b1 entfernt, nach Zeit sortiert
    expect(r.blocks[0]).toMatchObject({ entry_id: 'e1', user_id: 'u' })
  })
  it('neuer Eintrag erscheint an der richtigen Stelle', () => {
    const r = applyOutbox(data, [save('neu', { create: true, entry: input({ date: '2026-12-03' }), at: Date.UTC(2026, 10, 26) })], 'u')
    expect(r.entries.map((e) => e.id)).toEqual(['e1', 'neu', 'e2'])
    expect(r.entries[1]).toMatchObject({ user_id: 'u', updated_at: '', created_at: '2026-11-26T00:00:00.000Z' })
  })
  it('auf dem Server gelöscht: Änderung erscheint nicht mehr', () => {
    const r = applyOutbox(data, [save('weg'), done('entryDone', 'weg2', true)], 'u')
    expect(r.entries.map((e) => e.id)).toEqual(['e1', 'e2'])
  })
})

describe('Gespeicherte Warteschlange prüfen', () => {
  it('nur gültige Einträge', () => {
    const good = [done('entryDone', 'e1', true), save('e1')]
    expect(asOutbox([...good, null, 42, { kind: 'entryDone', key: 'x', id: 'y', at: 1 }, { kind: 'quatsch', key: 'a', id: 'b', at: 1 }])).toEqual(good)
    expect(asOutbox('kaputt')).toEqual([])
  })
})

describe('Neuer Versuch sinnvoll?', () => {
  it.each([
    [{ message: 'TypeError: Failed to fetch' }, true],
    [{ message: 'Load failed' }, true],
    [{ message: 'JWT expired', code: 'PGRST301' }, true],
    [{ message: 'x', status: 503 }, true],
    [{ message: 'x', code: 'PGRST002' }, true],
    [{ message: 'new row violates check constraint "study_blocks_order"', code: '23514' }, false],
    [{ message: 'new row violates row-level security policy', code: '42501' }, false],
  ])('%o → %s', (err, expected) => {
    expect(isRetryable(err)).toBe(expected)
  })
})

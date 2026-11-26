// @vitest-environment jsdom
// DataProvider mit Offline-Warteschlange: offline abhaken/speichern, beim Online-Gehen nachsenden.
import './dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLayoutEffect } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import type { Entry, EntryInput, StudyBlock } from '../src/types'

// --- Supabase-Zugriffe nachbilden ---------------------------------------------------------------
const server: { entries: Entry[]; blocks: StudyBlock[] } = { entries: [], blocks: [] }
const api = vi.hoisted(() => ({
  fetchPart: vi.fn(),
  fetchPrefs: vi.fn(),
  setEntryDone: vi.fn(),
  setBlockDone: vi.fn(),
  setDoneIfUnchanged: vi.fn(),
  saveEntryRows: vi.fn(),
  saveEntry: vi.fn(),
}))
vi.mock('../src/data/api', async (importOriginal) => ({ ...(await importOriginal<object>()), ...api }))
vi.mock('../src/data/useRealtime', () => ({ useRealtime: () => {} })) // ohne Realtime-Verbindung

const { DataProvider, useData } = await import('../src/data/DataProvider')
const { saveSnapshot } = await import('../src/lib/cache')

// --- Online/Offline steuern --------------------------------------------------------------------
let online = true
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
async function goOnline() {
  online = true
  await act(async () => {
    window.dispatchEvent(new Event('online'))
  })
}

const BASE = '2026-11-20T10:00:00.123456+00:00'
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
  updated_at: BASE,
  ...over,
})
const input: EntryInput = {
  title: 'Neu offline',
  category: 'aufgabe',
  subject_id: null,
  date: '2026-12-02',
  end_date: null,
  start_time: null,
  end_time: null,
  notes: null,
  done: false,
  multi_grade: false,
}

// Der aktuelle Stand von useData(), nach jedem Zeichnen (zum Prüfen und Aufrufen im Test)
let data: ReturnType<typeof useData>
function Probe() {
  const value = useData()
  useLayoutEffect(() => {
    data = value
  })
  return null
}
async function mount() {
  render(
    <DataProvider userId="u">
      <Probe />
    </DataProvider>,
  )
  await act(async () => {}) // erstes Laden abwarten
}

beforeEach(() => {
  vi.clearAllMocks()
  online = true
  server.entries = [entry('e1')]
  server.blocks = [{ id: 'b1', user_id: 'u', entry_id: 'e1', starts_at: '2026-11-30T16:00:00Z', ends_at: '2026-11-30T17:00:00Z', done: false, updated_at: BASE }]
  saveSnapshot('u', { subjects: [], entries: server.entries, blocks: server.blocks, savedAt: '2026-11-25T10:00:00Z' })
  api.fetchPart.mockImplementation(async () => {
    if (!online) throw new TypeError('Failed to fetch')
    return { subjects: [], entries: server.entries, blocks: server.blocks, grades: [], gradesMissing: false, attachments: [], periods: [], periodsMissing: false, bm: [], bmMissing: false }
  })
  api.fetchPrefs.mockResolvedValue([])
  api.setDoneIfUnchanged.mockImplementation(async (table: string, id: string, done: boolean) => {
    const list: { id: string; done: boolean }[] = table === 'entries' ? server.entries : server.blocks
    const row = list.find((r) => r.id === id)
    if (!row) return false // gelöscht
    row.done = done
    return true
  })
  api.saveEntryRows.mockImplementation(async (target: { id: string }, e: EntryInput) => {
    server.entries = [...server.entries.filter((x) => x.id !== target.id), entry(target.id, { ...e, start_time: null })]
    return 'saved'
  })
})

describe('Offline abhaken', () => {
  it('erscheint sofort, wartet und wird beim Online-Gehen nachgeschickt', async () => {
    online = false
    await mount()
    await act(() => data.setEntryDone('e1', true))
    expect(data.entries.find((e) => e.id === 'e1')!.done).toBe(true)
    expect(data.pendingChanges).toBe(1)
    expect(api.setEntryDone).not.toHaveBeenCalled()

    await goOnline()
    await waitFor(() => expect(data.pendingChanges).toBe(0))
    // Konflikt-Grenze = bekannter Server-Stand (neuer als die Uhrzeit des Abhakens? sonst diese)
    const [table, id, done, notAfter] = api.setDoneIfUnchanged.mock.calls[0]
    expect([table, id, done]).toEqual(['entries', 'e1', true])
    expect(typeof notAfter).toBe('string')
    expect(server.entries[0].done).toBe(true)
    expect(data.entries.find((e) => e.id === 'e1')!.done).toBe(true)
    expect(data.syncNotice).toBeNull()
  })

  it('Lernzeit: gleiche Warteschlange, Tabelle study_blocks', async () => {
    online = false
    await mount()
    await act(() => data.setBlockDone('b1', true))
    expect(data.blocks[0].done).toBe(true)
    await goOnline()
    await waitFor(() => expect(data.pendingChanges).toBe(0))
    expect(api.setDoneIfUnchanged.mock.calls[0].slice(0, 3)).toEqual(['study_blocks', 'b1', true])
  })

  it('übersteht einen Neustart der App (localStorage)', async () => {
    online = false
    await mount()
    await act(() => data.setEntryDone('e1', true))
    // App neu öffnen (immer noch offline): Haken ist weiterhin sichtbar
    render(
      <DataProvider userId="u">
        <Probe />
      </DataProvider>,
    )
    await act(async () => {})
    expect(data.entries.find((e) => e.id === 'e1')!.done).toBe(true)
    expect(data.pendingChanges).toBe(1)
  })

  it('auf dem Server inzwischen gelöscht → Server gewinnt, Hinweis', async () => {
    online = false
    await mount()
    await act(() => data.setEntryDone('e1', true))
    server.entries = [] // auf einem anderen Gerät gelöscht
    server.blocks = []
    await goOnline()
    await waitFor(() => expect(data.pendingChanges).toBe(0))
    expect(data.entries).toEqual([])
    expect(data.syncNotice).toMatch(/nicht übernommen/)
  })

  it('Netz bricht beim Senden ab → landet in der Warteschlange statt Fehler', async () => {
    await mount()
    api.setEntryDone.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    online = true
    await act(() => data.setEntryDone('e1', true))
    expect(data.pendingChanges).toBe(1)
    expect(data.entries.find((e) => e.id === 'e1')!.done).toBe(true)
  })

  it('anderer Fehler beim direkten Senden → Fehlermeldung, Server-Stand', async () => {
    await mount()
    api.setEntryDone.mockRejectedValueOnce({ message: 'permission denied', code: '42501' })
    await expect(act(() => data.setEntryDone('e1', true))).rejects.toThrow(/permission denied/)
    expect(data.pendingChanges).toBe(0)
    expect(data.entries.find((e) => e.id === 'e1')!.done).toBe(false)
  })
})

describe('Offline Einträge speichern', () => {
  it('neuer Eintrag erscheint sofort und wird als "neu" nachgeschickt', async () => {
    online = false
    await mount()
    await act(() => data.saveEntry({ id: 'neu', create: true }, input, [{ date: '2026-12-01', start: '17:00', end: '18:00', done: false }], []))
    expect(data.entries.map((e) => e.id)).toContain('neu')
    expect(data.blocks.filter((b) => b.entry_id === 'neu')).toHaveLength(1)

    await goOnline()
    await waitFor(() => expect(data.pendingChanges).toBe(0))
    const [target, sentEntry, rows, removed, changedAt] = api.saveEntryRows.mock.calls[0]
    expect(target).toEqual({ id: 'neu', create: true })
    expect(sentEntry).toEqual(input)
    expect(rows).toHaveLength(1)
    expect(removed).toEqual([])
    expect(changedAt).toBeUndefined() // neu: keine Konfliktprüfung
  })

  it('Bearbeiten schickt den bekannten Stand mit (neuere Änderung gewinnt)', async () => {
    online = false
    await mount()
    await act(() => data.saveEntry({ id: 'e1', create: false }, { ...input, title: 'Geändert' }, [], ['b1']))
    expect(data.entries.find((e) => e.id === 'e1')!.title).toBe('Geändert')
    expect(data.blocks).toHaveLength(0) // Lernzeit im Formular entfernt
    await goOnline()
    await waitFor(() => expect(data.pendingChanges).toBe(0))
    const [target, , , removed, changedAt] = api.saveEntryRows.mock.calls[0]
    expect(target).toEqual({ id: 'e1', create: false })
    expect(removed).toEqual(['b1'])
    expect(typeof changedAt).toBe('string')
  })

  it('Anhänge gehen offline nicht', async () => {
    online = false
    await mount()
    const link = { id: 'a1', kind: 'link' as const, url: 'https://example.org', name: 'Link' }
    await expect(act(() => data.saveEntry({ id: 'e1', create: false }, input, [], [], { added: [link], removed: [] }))).rejects.toThrow(/Anhänge/)
    expect(data.pendingChanges).toBe(0)
  })
})

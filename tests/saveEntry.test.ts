import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase-Client nachbilden: rpc() und die Tabellen-Aufrufe des früheren Wegs aufzeichnen
const calls: { kind: string; args: unknown[] }[] = []
let rpcResult: { data: unknown; error: unknown } = { data: 'saved', error: null }

vi.mock('../src/lib/supabase', () => {
  const chain = (table: string) => {
    const q: Record<string, unknown> = {}
    const rec = (kind: string) => (...args: unknown[]) => {
      calls.push({ kind: `${table}.${kind}`, args })
      return q
    }
    for (const k of ['upsert', 'update', 'delete', 'in', 'eq', 'select']) q[k] = rec(k)
    q.single = () => Promise.resolve({ data: { id: 'e1' }, error: null })
    // Die Abfragen von supabase-js sind "thenable" (man kann sie awaiten) – das bildet der Ersatz nach
    // oxlint-disable-next-line unicorn/no-thenable
    q.then = (resolve: (v: unknown) => void) => resolve({ error: null })
    return q
  }
  return {
    supabase: {
      rpc: (...args: unknown[]) => {
        calls.push({ kind: 'rpc', args })
        return Promise.resolve(rpcResult)
      },
      from: (table: string) => chain(table),
    },
  }
})

const { saveEntry, saveEntryRows } = await import('../src/data/api')

const input = {
  title: 'Vokabeltest',
  category: 'test' as const,
  subject_id: null,
  date: '2026-12-01',
  end_date: null,
  start_time: null,
  end_time: null,
  notes: null,
  done: false,
  multi_grade: false,
}

beforeEach(() => {
  calls.length = 0
  rpcResult = { data: 'saved', error: null }
})

describe('Eintrag speichern (save_entry)', () => {
  it('eine einzige Anfrage für Eintrag und Lernzeiten', async () => {
    await saveEntry(
      { id: 'e1', create: true },
      input,
      [{ id: 'b1', date: '2026-11-30', start: '17:00', end: '18:00', done: false }, { date: '2026-11-29', start: '16:00', end: '17:00', done: true }],
      ['b1', 'b9'],
    )
    expect(calls).toHaveLength(1)
    const [name, params] = calls[0].args as [string, Record<string, unknown>]
    expect(name).toBe('save_entry')
    expect(params.p_id).toBe('e1')
    expect(params.p_create).toBe(true)
    expect(params.p_entry).toEqual(input)
    expect(params.p_changed_at).toBeNull()
    // b1 bleibt im Formular → wird nicht gelöscht, nur b9
    expect(params.p_removed_block_ids).toEqual(['b9'])
    const blocks = params.p_blocks as { id: string; done: boolean }[]
    expect(blocks).toHaveLength(2)
    expect(blocks[0].id).toBe('b1')
    expect(blocks[1].id).toMatch(/^[0-9a-f-]{36}$/) // neue Lernzeit bekommt eine id
  })

  it('Eintrag gelöscht → verständliche Meldung', async () => {
    rpcResult = { data: 'gone', error: null }
    await expect(saveEntry({ id: 'e1', create: false }, input, [], [])).rejects.toThrow(/gibt es nicht mehr/)
  })

  it('Zeitpunkt einer Offline-Änderung wird mitgeschickt; Server neuer → stale', async () => {
    rpcResult = { data: 'stale', error: null }
    expect(await saveEntryRows({ id: 'e1', create: false }, input, [], [], '2026-11-26T12:00:00.000Z')).toBe('stale')
    expect((calls[0].args[1] as Record<string, unknown>).p_changed_at).toBe('2026-11-26T12:00:00.000Z')
  })

  it('ohne Migration 012: Speichern in Schritten wie früher', async () => {
    rpcResult = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
    const result = await saveEntryRows({ id: 'e1', create: false }, input, [{ id: 'b1', starts_at: 'a', ends_at: 'b', done: false }], ['b2'])
    expect(result).toBe('saved')
    expect(calls.map((c) => c.kind)).toEqual(['rpc', 'entries.update', 'entries.eq', 'entries.select', 'study_blocks.delete', 'study_blocks.in', 'study_blocks.upsert'])
  })

  it('andere Fehler werden weitergegeben', async () => {
    rpcResult = { data: null, error: { code: '23514', message: 'study_blocks_order' } }
    await expect(saveEntryRows({ id: 'e1', create: true }, input, [], [])).rejects.toMatchObject({ code: '23514' })
  })
})

// Laden: alle Tabellen bzw. einzelne (z. B. nach einer Realtime-Meldung).

import { supabase } from '../../lib/supabase'
import type { Attachment, BmRating, Entry, Grade, Period, StudyBlock, Subject } from '../../types'

const PAGE_SIZE = 1000 // Supabase liefert pro Abfrage höchstens 1000 Zeilen

/** Lädt alle Zeilen einer Tabelle, notfalls in mehreren Portionen. */
async function fetchAll<T>(table: string, orderBy: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) return rows
  }
}

/** Was die App lädt (Schlüssel = Name im Zustand bzw. Offline-Cache) */
export const DATA_KEYS = ['subjects', 'entries', 'blocks', 'grades', 'attachments', 'periods', 'bm'] as const
export type DataKey = (typeof DATA_KEYS)[number]

export interface LoadedData {
  subjects: Subject[]
  entries: Entry[]
  blocks: StudyBlock[]
  grades: Grade[]
  gradesMissing: boolean
  attachments: Attachment[]
  periods: Period[]
  periodsMissing: boolean
  bm: BmRating[]
  bmMissing: boolean
}

/** Tabelle in der Datenbank je Schlüssel */
export const TABLE_OF: Record<DataKey, string> = {
  subjects: 'subjects',
  entries: 'entries',
  blocks: 'study_blocks',
  grades: 'grades',
  attachments: 'attachments',
  periods: 'periods',
  bm: 'bm_ratings',
}

const loaders: { [K in DataKey]: () => Promise<Partial<LoadedData>> } = {
  subjects: async () => ({ subjects: await fetchAll<Subject>('subjects', 'name') }),
  entries: async () => ({ entries: await fetchAll<Entry>('entries', 'date') }),
  blocks: async () => ({ blocks: await fetchAll<StudyBlock>('study_blocks', 'starts_at') }),
  grades: async () => {
    const grades = await fetchOptional<Grade>('grades', 'date')
    // Postgres liefert "numeric" je nach Einstellung als Text → sicherheitshalber in Zahlen umwandeln
    return {
      grades: (grades ?? []).map((g) => ({ ...g, grade: Number(g.grade), weight: Number(g.weight), entry_id: g.entry_id ?? null })),
      gradesMissing: grades === null,
    }
  },
  attachments: async () => ({ attachments: (await fetchOptional<Attachment>('attachments', 'created_at')) ?? [] }),
  periods: async () => {
    const periods = await fetchOptional<Period>('periods', 'start_date')
    return { periods: periods ?? [], periodsMissing: periods === null }
  },
  bm: async () => {
    const bm = await fetchOptional<BmRating>('bm_ratings', 'semester')
    return { bm: (bm ?? []).map((r) => ({ ...r, fach: Number(r.fach), pers: Number(r.pers) })), bmMissing: bm === null }
  },
}

/** Nur diese Tabellen laden (z. B. nach einer Realtime-Meldung) */
export async function fetchPart(keys: readonly DataKey[]): Promise<Partial<LoadedData>> {
  const parts = await Promise.all(keys.map((k) => loaders[k]()))
  return Object.assign({}, ...parts)
}

export async function fetchEverything(): Promise<LoadedData> {
  return (await fetchPart(DATA_KEYS)) as LoadedData
}

/**
 * Wie fetchAll, gibt aber null zurück, wenn es die Tabelle noch nicht gibt
 * (Migration noch nicht ausgeführt) – der Rest der App funktioniert dann trotzdem.
 */
async function fetchOptional<T>(table: string, orderBy: string): Promise<T[] | null> {
  try {
    return await fetchAll<T>(table, orderBy)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'PGRST205' || code === '42P01') return null // Tabelle existiert nicht
    throw err
  }
}

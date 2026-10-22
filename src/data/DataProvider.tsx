// Hält alle Fächer, Einträge und Lernzeiten des angemeldeten Benutzers im Speicher
// und stellt Funktionen zum Ändern bereit. Jede Ansicht holt sich die Daten über useData().
//
// Ablauf beim Start:
// 1. Sofort die zuletzt gespeicherten Daten aus dem Offline-Cache anzeigen (falls vorhanden).
// 2. Frische Daten von Supabase laden und den Cache aktualisieren.
// 3. Erneut laden, wenn die App wieder in den Vordergrund kommt (z. B. Wechsel iPad ↔ Computer).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from './api'
import { useOnline } from './useOnline'
import { loadSnapshot, saveSnapshot } from '../lib/cache'
import { friendlyError } from '../lib/supabase'
import type {
  Attachment,
  Entry,
  EntryInput,
  Grade,
  GradeInput,
  PendingAttachment,
  StudyBlock,
  StudyBlockInput,
  Subject,
} from '../types'

interface DataValue {
  subjects: Subject[]
  entries: Entry[]
  blocks: StudyBlock[]
  grades: Grade[]
  gradesMissing: boolean // true, solange 002_grades.sql nicht ausgeführt wurde
  attachments: Attachment[]
  loading: boolean // true nur beim allerersten Laden ohne Cache
  error: string | null // letzter Ladefehler
  lastSync: string | null // Zeitpunkt der letzten erfolgreichen Synchronisation
  online: boolean
  subjectById: Map<string, Subject>
  entryById: Map<string, Entry>
  blocksByEntry: Map<string, StudyBlock[]>
  attachmentsByEntry: Map<string, Attachment[]>
  gradeByEntry: Map<string, Grade> // verknüpfte Note eines Tests
  reload: () => Promise<void>
  saveEntry: (
    id: string | null,
    input: EntryInput,
    blocks: StudyBlockInput[],
    attachments?: { added: PendingAttachment[]; removed: Attachment[] },
  ) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  restoreEntry: (entry: Entry, blocks: StudyBlock[], attachments: Attachment[], linkedGradeIds: string[]) => Promise<void>
  /** Dateien endgültig aus dem Speicher löschen (nach Ablauf von "Rückgängig") */
  purgeAttachmentFiles: (list: Attachment[]) => Promise<void>
  attachmentUrl: (a: Attachment) => Promise<string>
  setEntryDone: (id: string, done: boolean) => Promise<void>
  setBlockDone: (id: string, done: boolean) => Promise<void>
  saveSubject: (id: string | null, name: string, color: string) => Promise<void>
  deleteSubject: (id: string) => Promise<void>
  saveGrade: (id: string | null, input: GradeInput) => Promise<void>
  deleteGrade: (id: string) => Promise<void>
  restoreGrade: (grade: Grade) => Promise<void>
}

const DataContext = createContext<DataValue | null>(null)

export function DataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const cached = useMemo(() => loadSnapshot(userId), [userId])
  const [subjects, setSubjects] = useState<Subject[]>(cached?.subjects ?? [])
  const [entries, setEntries] = useState<Entry[]>(cached?.entries ?? [])
  const [blocks, setBlocks] = useState<StudyBlock[]>(cached?.blocks ?? [])
  const [grades, setGrades] = useState<Grade[]>(cached?.grades ?? [])
  const [gradesMissing, setGradesMissing] = useState(cached?.gradesMissing ?? false)
  const [attachments, setAttachments] = useState<Attachment[]>(cached?.attachments ?? [])
  const [lastSync, setLastSync] = useState<string | null>(cached?.savedAt ?? null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const online = useOnline()

  const reload = useCallback(async () => {
    try {
      const data = await api.fetchEverything()
      const savedAt = new Date().toISOString()
      setSubjects(data.subjects)
      setEntries(data.entries)
      setBlocks(data.blocks)
      setGrades(data.grades)
      setGradesMissing(data.gradesMissing)
      setAttachments(data.attachments)
      setLastSync(savedAt)
      setError(null)
      saveSnapshot(userId, { ...data, savedAt })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Laden beim Start, beim Wiederverbinden und wenn die App wieder sichtbar wird
  useEffect(() => {
    reload()
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reload)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reload)
    }
  }, [reload])

  /** Hülle für alle Änderungen: offline sperren, Fehler übersetzen, danach neu laden. */
  const mutate = useCallback(
    async (action: () => Promise<void>) => {
      if (!navigator.onLine) throw new Error('Offline – Änderungen nicht möglich')
      try {
        await action()
      } catch (err) {
        throw new Error(friendlyError(err))
      } finally {
        await reload()
      }
    },
    [reload],
  )

  const value = useMemo<DataValue>(() => {
    const blocksByEntry = new Map<string, StudyBlock[]>()
    for (const b of blocks) blocksByEntry.set(b.entry_id, [...(blocksByEntry.get(b.entry_id) ?? []), b])
    const attachmentsByEntry = new Map<string, Attachment[]>()
    for (const a of attachments) attachmentsByEntry.set(a.entry_id, [...(attachmentsByEntry.get(a.entry_id) ?? []), a])
    const gradeByEntry = new Map<string, Grade>()
    for (const g of grades) if (g.entry_id) gradeByEntry.set(g.entry_id, g)

    return {
      subjects,
      entries,
      blocks,
      grades,
      gradesMissing,
      attachments,
      loading,
      error,
      lastSync,
      online,
      subjectById: new Map(subjects.map((s) => [s.id, s])),
      entryById: new Map(entries.map((e) => [e.id, e])),
      blocksByEntry,
      attachmentsByEntry,
      gradeByEntry,
      reload,
      saveEntry: (id, input, newBlocks, att) =>
        mutate(async () => {
          const previousBlockIds = id ? (blocksByEntry.get(id) ?? []).map((b) => b.id) : []
          await api.saveEntry(id, input, newBlocks, previousBlockIds, att)
        }),
      deleteEntry: (id) => mutate(() => api.deleteEntry(id)),
      restoreEntry: (entry, entryBlocks, att, gradeIds) => mutate(() => api.restoreEntry(entry, entryBlocks, att, gradeIds)),
      purgeAttachmentFiles: (list) => api.deleteAttachmentFiles(list),
      attachmentUrl: (a) => api.attachmentUrl(a),
      setEntryDone: (id, done) => mutate(() => api.setEntryDone(id, done)),
      setBlockDone: (id, done) => mutate(() => api.setBlockDone(id, done)),
      saveSubject: (id, name, color) => mutate(() => api.saveSubject(id, name, color)),
      deleteSubject: (id) => mutate(() => api.deleteSubject(id)),
      saveGrade: (id, input) => mutate(() => api.saveGrade(id, input)),
      deleteGrade: (id) => mutate(() => api.deleteGrade(id)),
      restoreGrade: (grade) => mutate(() => api.restoreGrade(grade)),
    }
  }, [subjects, entries, blocks, grades, gradesMissing, attachments, loading, error, lastSync, online, reload, mutate])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData() muss innerhalb von <DataProvider> verwendet werden')
  return ctx
}

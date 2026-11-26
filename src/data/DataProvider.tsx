// Hält alle Fächer, Einträge, Lernzeiten, Noten und Zeiträume des angemeldeten Benutzers im Speicher
// und stellt Funktionen zum Ändern bereit. Jede Ansicht holt sich die Daten über useData().
//
// Ablauf beim Start:
// 1. Sofort die zuletzt gespeicherten Daten aus dem Offline-Cache anzeigen (falls vorhanden).
// 2. Frische Daten von Supabase laden und den Cache aktualisieren.
// 3. Erneut laden, wenn die App wieder in den Vordergrund kommt (z. B. Wechsel iPad ↔ Computer).
//
// Dazu kommen Einstellungen wie Notenziele und Design (lib/syncedPrefs.ts): Sie gelten auf allen
// Geräten, lassen sich aber auch offline ändern und werden dann beim nächsten Laden hochgeladen.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import { useOnline } from './useOnline'
import { loadSnapshot, saveSnapshot } from '../lib/cache'
import { friendlyError } from '../lib/supabase'
import {
  TARGET_ROW,
  changedRows,
  loadLocalPrefs,
  loadPending,
  mergePrefs,
  missingOnServer,
  saveLocalPrefs,
  savePending,
  serverRows,
  stamp,
  withoutUploaded,
  type PrefName,
  type SyncedPrefs,
} from '../lib/syncedPrefs'
import { asTargets } from '../lib/targets'
import type {
  Attachment,
  BmRating,
  BmSubject,
  Entry,
  EntryInput,
  Grade,
  GradeInput,
  PendingAttachment,
  Period,
  PeriodInput,
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
  periods: Period[] // Ferien, schulfreie Tage, Lager
  periodsMissing: boolean // true, solange 004_events_and_periods.sql nicht ausgeführt wurde
  bm: BmRating[] // BM-Einschätzung: Kreuze pro Semester und Fach
  bmMissing: boolean // true, solange 006_bm.sql nicht ausgeführt wurde
  loading: boolean // true nur beim allerersten Laden ohne Cache
  error: string | null // letzter Ladefehler
  lastSync: string | null // Zeitpunkt der letzten erfolgreichen Synchronisation
  online: boolean
  subjectById: Map<string, Subject>
  entryById: Map<string, Entry>
  blocksByEntry: Map<string, StudyBlock[]>
  attachmentsByEntry: Map<string, Attachment[]>
  gradesByEntry: Map<string, Grade[]> // verknüpfte Noten eines Tests (meist eine, bei „mehrere Noten“ auch mehr)
  reload: () => Promise<void>
  /**
   * target.create: neuer Eintrag mit der im Formular vergebenen id (erneuter Versuch legt nichts doppelt an).
   * removedBlockIds / attachments.removed: nur, was im Formular entfernt wurde – was ein anderes Gerät
   * inzwischen hinzugefügt hat, bleibt stehen.
   */
  saveEntry: (
    target: { id: string; create: boolean },
    input: EntryInput,
    blocks: StudyBlockInput[],
    removedBlockIds: string[],
    attachments?: { added: PendingAttachment[]; removed: Attachment[] },
  ) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  restoreEntry: (entry: Entry, blocks: StudyBlock[], attachments: Attachment[], linkedGradeIds: string[]) => Promise<void>
  /** Dateien endgültig aus dem Speicher löschen (nach Ablauf von "Rückgängig") */
  purgeAttachmentFiles: (list: Attachment[]) => Promise<void>
  attachmentUrls: (list: Attachment[]) => Promise<Map<string, string>>
  setEntryDone: (id: string, done: boolean) => Promise<void>
  setBlockDone: (id: string, done: boolean) => Promise<void>
  saveSubject: (id: string | null, name: string, color: string) => Promise<void>
  deleteSubject: (id: string) => Promise<void>
  saveGrade: (id: string | null, input: GradeInput) => Promise<void>
  deleteGrade: (id: string) => Promise<void>
  restoreGrade: (grade: Grade) => Promise<void>
  savePeriod: (id: string | null, input: PeriodInput) => Promise<void>
  deletePeriod: (id: string) => Promise<void>
  restorePeriod: (period: Period) => Promise<void>
  /** BM-Kreuze speichern. Wird sofort angezeigt und im Hintergrund gespeichert. */
  saveBm: (semester: string, subject: BmSubject, fach: number, pers: number) => Promise<void>
  /** Einstellungen, die auf allen Geräten gleich sind (Notenziele, Design …) */
  prefs: SyncedPrefs
  /** Einstellung ändern: sofort lokal, dann im Hintergrund hochladen (offline: sobald wieder online). */
  setPref: <K extends PrefName>(name: K, value: SyncedPrefs[K]) => void
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
  const [periods, setPeriods] = useState<Period[]>(cached?.periods ?? [])
  const [periodsMissing, setPeriodsMissing] = useState(cached?.periodsMissing ?? false)
  const [bm, setBm] = useState<BmRating[]>(cached?.bm ?? [])
  const [bmMissing, setBmMissing] = useState(cached?.bmMissing ?? false)
  const [lastSync, setLastSync] = useState<string | null>(cached?.savedAt ?? null)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<SyncedPrefs>(() => loadLocalPrefs(userId))
  const prefsRef = useRef(prefs) // aktueller Stand für setPref (welche Notenziele haben sich geändert?)
  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])
  const online = useOnline()

  // --- Einstellungen hochladen ---
  // Wann wurde welche Zeile zuletzt auf diesem Gerät geändert? (Ein Laden, das vorher begann,
  // darf sie nicht mit dem alten Server-Stand überschreiben.)
  const prefChangedAt = useRef(new Map<string, number>())
  const prefsMissing = useRef(false) // Tabelle user_prefs fehlt → nur lokal speichern
  const prefQueue = useRef<Promise<void>>(Promise.resolve())
  /** Ausstehende Einstellungen hochladen – nacheinander, damit nichts sich überholt. */
  const flushPrefs = useCallback(() => {
    const job = prefQueue.current.then(async () => {
      const pending = loadPending(userId)
      if (prefsMissing.current || !navigator.onLine || Object.keys(pending).length === 0) return
      await api.savePrefs(pending)
      savePending(userId, withoutUploaded(loadPending(userId), pending))
    })
    prefQueue.current = job.catch(() => {}) // fehlgeschlagen → bleibt ausstehend, nächster Versuch beim Laden
    return prefQueue.current
  }, [userId])

  const setPref = useCallback(
    <K extends PrefName>(name: K, value: SyncedPrefs[K]) => {
      // Nur die geänderten Zeilen hochladen (bei Notenzielen: nur das geänderte Fach), mit Zeitpunkt
      const at = Date.now()
      const changes = changedRows(name, prefsRef.current[name], value)
      for (const row of Object.keys(changes)) prefChangedAt.current.set(row, at)
      prefsRef.current = { ...prefsRef.current, [name]: value }
      setPrefs((p) => ({ ...p, [name]: value }))
      saveLocalPrefs(userId, { [name]: value })
      savePending(userId, { ...loadPending(userId), ...stamp(changes, at) })
      flushPrefs()
    },
    [userId, flushPrefs],
  )

  // Mehrere Ladevorgänge können sich überholen (z. B. App kommt in den Vordergrund, während gerade
  // gespeichert wird). Nur die zuletzt gestartete Abfrage darf den Stand setzen – sonst könnte eine
  // ältere, langsamere Antwort die frischen Daten wieder mit dem alten Stand überschreiben.
  const loadSeq = useRef(0)
  const reload = useCallback(async () => {
    const seq = ++loadSeq.current
    const isLatest = () => seq === loadSeq.current
    const startedAt = Date.now()
    try {
      await flushPrefs() // zuerst Offline-Änderungen hochladen, sonst kämen gleich die alten Werte zurück
      const [data, prefRows] = await Promise.all([api.fetchEverything(), api.fetchPrefs()])
      if (!isLatest()) return
      prefsMissing.current = prefRows === null
      if (prefRows) {
        const knownTargets = [
          ...Object.keys(asTargets(prefsRef.current.gradeTargets)),
          ...Object.keys(loadPending(userId))
            .filter((n) => n.startsWith(TARGET_ROW))
            .map((n) => n.slice(TARGET_ROW.length)),
        ]
        const server = serverRows(prefRows, knownTargets)
        // Früher nur auf diesem Gerät gespeichert (z. B. Notenziele) → einmalig hochladen
        const missing = missingOnServer(loadLocalPrefs(userId), server)
        if (Object.keys(missing).length) {
          savePending(userId, { ...stamp(missing, Date.now()), ...loadPending(userId) })
          flushPrefs()
        }
        const changedMeanwhile = new Set([...prefChangedAt.current].filter(([, t]) => t >= startedAt).map(([n]) => n))
        setPrefs((current) => {
          const next = mergePrefs(current, server, loadPending(userId), changedMeanwhile)
          saveLocalPrefs(userId, next)
          return next
        })
      }
      const savedAt = new Date().toISOString()
      setSubjects(data.subjects)
      setEntries(data.entries)
      setBlocks(data.blocks)
      setGrades(data.grades)
      setGradesMissing(data.gradesMissing)
      setAttachments(data.attachments)
      setPeriods(data.periods)
      setPeriodsMissing(data.periodsMissing)
      setBm(data.bm)
      setBmMissing(data.bmMissing)
      setLastSync(savedAt)
      setError(null)
      saveSnapshot(userId, { ...data, savedAt })
    } catch (err) {
      if (isLatest()) setError(friendlyError(err))
    } finally {
      if (isLatest()) setLoading(false)
    }
  }, [userId, flushPrefs])

  // Laden beim Start, beim Wiederverbinden und wenn die App wieder sichtbar wird
  useEffect(() => {
    reload()
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reload)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reload)
      loadSeq.current++ // z. B. abgemeldet: ein noch laufendes Laden legt keinen Offline-Cache mehr an
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

  // BM-Kreuze: Beim schnellen Antippen soll jede Änderung in der richtigen Reihenfolge ankommen.
  const bmQueue = useRef<Promise<void>>(Promise.resolve())
  const saveBm = useCallback(
    (semester: string, subject: BmSubject, fach: number, pers: number) => {
      if (!navigator.onLine) return Promise.reject(new Error('Offline – Änderungen nicht möglich'))
      // Sofort anzeigen (ohne auf den Server zu warten)
      setBm((list) => {
        const rest = list.filter((r) => !(r.semester === semester && r.subject === subject))
        const old = list.find((r) => r.semester === semester && r.subject === subject)
        const row: BmRating = old
          ? { ...old, fach, pers }
          : { id: `lokal-${semester}-${subject}`, user_id: userId, semester, subject, fach, pers, updated_at: new Date().toISOString() }
        return [...rest, row]
      })
      const job = bmQueue.current.then(() => api.saveBmRating(semester, subject, fach, pers))
      bmQueue.current = job.catch(() => {})
      return job.catch(async (err) => {
        await reload() // Server-Stand wieder anzeigen
        throw new Error(friendlyError(err))
      })
    },
    [userId, reload],
  )

  const value = useMemo<DataValue>(() => {
    const blocksByEntry = new Map<string, StudyBlock[]>()
    for (const b of blocks) blocksByEntry.set(b.entry_id, [...(blocksByEntry.get(b.entry_id) ?? []), b])
    const attachmentsByEntry = new Map<string, Attachment[]>()
    for (const a of attachments) attachmentsByEntry.set(a.entry_id, [...(attachmentsByEntry.get(a.entry_id) ?? []), a])
    const gradesByEntry = new Map<string, Grade[]>()
    for (const g of grades) if (g.entry_id) gradesByEntry.set(g.entry_id, [...(gradesByEntry.get(g.entry_id) ?? []), g])

    return {
      subjects,
      entries,
      blocks,
      grades,
      gradesMissing,
      attachments,
      periods,
      periodsMissing,
      bm,
      bmMissing,
      loading,
      error,
      lastSync,
      online,
      subjectById: new Map(subjects.map((s) => [s.id, s])),
      entryById: new Map(entries.map((e) => [e.id, e])),
      blocksByEntry,
      attachmentsByEntry,
      gradesByEntry,
      reload,
      saveEntry: (target, input, newBlocks, removedBlockIds, att) =>
        mutate(async () => {
          await api.saveEntry(target, input, newBlocks, removedBlockIds, att)
        }),
      deleteEntry: (id) => mutate(() => api.deleteEntry(id)),
      restoreEntry: (entry, entryBlocks, att, gradeIds) => mutate(() => api.restoreEntry(entry, entryBlocks, att, gradeIds)),
      purgeAttachmentFiles: (list) => api.deleteAttachmentFiles(list),
      attachmentUrls: (list) => api.attachmentUrls(list),
      setEntryDone: (id, done) => mutate(() => api.setEntryDone(id, done)),
      setBlockDone: (id, done) => mutate(() => api.setBlockDone(id, done)),
      saveSubject: (id, name, color) => mutate(() => api.saveSubject(id, name, color)),
      deleteSubject: (id) => mutate(() => api.deleteSubject(id)),
      saveGrade: (id, input) => mutate(() => api.saveGrade(id, input)),
      deleteGrade: (id) => mutate(() => api.deleteGrade(id)),
      restoreGrade: (grade) => mutate(() => api.restoreGrade(grade)),
      savePeriod: (id, input) => mutate(() => api.savePeriod(id, input)),
      deletePeriod: (id) => mutate(() => api.deletePeriod(id)),
      restorePeriod: (period) => mutate(() => api.restorePeriod(period)),
      saveBm,
      prefs,
      setPref,
    }
  }, [subjects, entries, blocks, grades, gradesMissing, attachments, periods, periodsMissing, bm, bmMissing, loading, error, lastSync, online, reload, mutate, saveBm, prefs, setPref])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData() muss innerhalb von <DataProvider> verwendet werden')
  return ctx
}

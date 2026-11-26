// Hält alle Fächer, Einträge, Lernzeiten, Noten und Zeiträume des angemeldeten Benutzers im Speicher
// und stellt Funktionen zum Ändern bereit. Jede Ansicht holt sich die Daten über useData().
//
// Ablauf beim Start:
// 1. Sofort die zuletzt gespeicherten Daten aus dem Offline-Cache anzeigen (falls vorhanden).
// 2. Frische Daten von Supabase laden und den Cache aktualisieren.
// 3. Änderungen anderer Geräte kommen per Supabase Realtime sofort (data/useRealtime.ts); dann wird nur
//    die betroffene Tabelle neu geladen. War die App länger im Hintergrund, lädt sie beim Zurückkehren
//    einmal alles (höchstens alle 30 s, lib/refresh.ts).
//
// Dazu kommen Einstellungen wie Notenziele und Design (lib/syncedPrefs.ts): Sie gelten auf allen
// Geräten, lassen sich aber auch offline ändern und werden dann beim nächsten Laden hochgeladen.
//
// Abhaken und Speichern von Einträgen geht auch offline (lib/outbox.ts): Die Änderung erscheint sofort,
// wartet in einer Warteschlange und wird nachgeschickt, sobald wieder Internet da ist.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import { useOnline } from './useOnline'
import { useRealtime, type RealtimeTable } from './useRealtime'
import { loadPref, loadSnapshot, savePref, saveSnapshot } from '../lib/cache'
import { applyOutbox, asOutbox, conflictThreshold, dequeue, enqueue as enqueueOp, isRetryable, type OutboxOp } from '../lib/outbox'
import { asQueue, dueItems, enqueue, type PurgeItem } from '../lib/purge'
import { shouldReloadOnReturn } from '../lib/refresh'
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
  /** So viele offline gemachte Änderungen warten noch aufs Hochladen */
  pendingChanges: number
  /** Hinweis, wenn eine offline gemachte Änderung nicht übernommen werden konnte (null = keiner) */
  syncNotice: string | null
  dismissSyncNotice: () => void
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

/** So lange bleiben Dateien eines gelöschten Eintrags mindestens liegen ("Rückgängig" dauert 6 s) */
const UNDO_GRACE_MS = 60_000
/** So lange darf ein Speichern mit hochgeladener Datei dauern bzw. wiederholt werden, bevor aufgeräumt wird */
const UPLOAD_GRACE_MS = 60 * 60_000

/** Was einzeln geladen werden kann: die Tabellen und die Einstellungen */
type LoadKey = api.DataKey | 'prefs'
const KEY_OF_TABLE: Record<RealtimeTable, LoadKey> = {
  subjects: 'subjects',
  entries: 'entries',
  study_blocks: 'blocks',
  grades: 'grades',
  attachments: 'attachments',
  periods: 'periods',
  bm_ratings: 'bm',
  user_prefs: 'prefs',
}
/** Realtime-Meldungen so lange sammeln, bevor geladen wird */
const REALTIME_DEBOUNCE_MS = 400

/** Nach so vielen ms wird eine wartende Offline-Änderung erneut gesendet (solange online) */
const OUTBOX_RETRY_MS = 30_000

export function DataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const cached = useMemo(() => loadSnapshot(userId), [userId])
  // Offline-Warteschlange: liegt im localStorage, übersteht also das Schliessen der App
  const outboxKey = `outbox:${userId}`
  const readOutbox = useCallback(() => asOutbox(loadPref(outboxKey, [])), [outboxKey])
  // Beim Start: Daten aus dem Cache plus die noch wartenden Offline-Änderungen
  const initial = useMemo(
    () => applyOutbox({ entries: cached?.entries ?? [], blocks: cached?.blocks ?? [] }, readOutbox(), userId),
    [cached, readOutbox, userId],
  )
  const [subjects, setSubjects] = useState<Subject[]>(cached?.subjects ?? [])
  const [entries, setEntries] = useState<Entry[]>(initial.entries)
  const [blocks, setBlocks] = useState<StudyBlock[]>(initial.blocks)
  // Aktueller Stand für die Änderungs-Funktionen (die sich nicht bei jeder Änderung neu bilden sollen)
  const entriesRef = useRef(entries)
  const blocksRef = useRef(blocks)
  useEffect(() => {
    entriesRef.current = entries
    blocksRef.current = blocks
  }, [entries, blocks])
  const [pendingChanges, setPendingChanges] = useState(() => readOutbox().length)
  const [syncNotice, setSyncNotice] = useState<string | null>(null)
  const [grades, setGrades] = useState<Grade[]>(cached?.grades ?? [])
  const [gradesMissing, setGradesMissing] = useState(cached?.gradesMissing ?? false)
  const [attachments, setAttachments] = useState<Attachment[]>(cached?.attachments ?? [])
  const [periods, setPeriods] = useState<Period[]>(cached?.periods ?? [])
  const [periodsMissing, setPeriodsMissing] = useState(cached?.periodsMissing ?? false)
  const [bm, setBm] = useState<BmRating[]>(cached?.bm ?? [])
  const [bmMissing, setBmMissing] = useState(cached?.bmMissing ?? false)
  // Zeitpunkt des letzten erfolgreichen Ladens. Angezeigt wird er nur offline oder bei einem Fehler
  // (StatusBanner) – deshalb kommt er erst dann in den Zustand, nicht bei jedem Laden (sonst zeichnete
  // jedes Laden die ganze App neu, auch wenn sich nichts geändert hat).
  const lastSyncRef = useRef<string | null>(cached?.savedAt ?? null)
  const [lastSync, setLastSync] = useState<string | null>(lastSyncRef.current)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<SyncedPrefs>(() => loadLocalPrefs(userId))
  const prefsRef = useRef(prefs) // aktueller Stand für setPref (welche Notenziele haben sich geändert?)
  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])
  const online = useOnline()
  useEffect(() => {
    if (!online) setLastSync(lastSyncRef.current)
  }, [online])

  // Zuletzt geladener Stand je Tabelle (als JSON): Bringt ein Laden dieselben Daten, bleibt der Zustand
  // (und damit jede Liste) unverändert – nichts zeichnet sich neu. Lokale Änderungen (z. B. sofort
  // angezeigte BM-Kreuze) löschen den Vergleichswert, damit der Server-Stand danach sicher übernommen wird.
  const loadedJson = useRef<Record<string, string>>(
    cached ? Object.fromEntries(Object.entries({ ...cached, ...initial }).map(([k, v]) => [k, JSON.stringify(v)])) : {},
  )
  const changed = (key: string, value: unknown) => {
    const json = JSON.stringify(value)
    if (loadedJson.current[key] === json) return false
    loadedJson.current[key] = json
    return true
  }

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

  // --- Dateien aufräumen, die zu keinem Anhang mehr gehören (lib/purge.ts) ---
  const purgeKey = `purge:${userId}`
  const purgeQueue = useRef<Promise<void>>(Promise.resolve())
  const queuePurge = useCallback(
    (items: PurgeItem[]) => items.length > 0 && savePref(purgeKey, enqueue(asQueue(loadPref(purgeKey, [])), items)),
    [purgeKey],
  )
  /** Fällige (bzw. die mit diesen ids) aufräumen: Datei löschen, wenn es die Anhang-Zeile nicht mehr gibt. */
  const flushPurge = useCallback(
    (force: string[] = []) => {
      const job = purgeQueue.current.then(async () => {
        if (!navigator.onLine) return
        const items = dueItems(asQueue(loadPref(purgeKey, [])), Date.now(), new Set(force))
        if (items.length === 0) return
        const alive = await api.existingAttachmentIds(items.map((i) => i.id))
        await api.removeFiles(items.filter((i) => !alive.has(i.id)).map((i) => i.path))
        // Erledigt – ausser, derselbe Anhang wurde inzwischen neu aufgenommen (z. B. erneuter Versuch)
        const done = (q: PurgeItem) => items.some((i) => i.id === q.id && i.due === q.due)
        savePref(purgeKey, asQueue(loadPref(purgeKey, [])).filter((q) => !done(q)))
      })
      purgeQueue.current = job.catch(() => {}) // fehlgeschlagen → bleibt in der Liste, nächster Versuch beim Laden
      return purgeQueue.current
    },
    [purgeKey],
  )

  // --- Offline-Warteschlange für Einträge und Lernzeiten (lib/outbox.ts) ---
  const writeOutbox = useCallback(
    (queue: OutboxOp[]) => {
      savePref(outboxKey, queue)
      setPendingChanges(queue.length)
    },
    [outboxKey],
  )
  const inflight = useRef<string | undefined>(undefined) // key der Änderung, die gerade gesendet wird
  /** Änderung in die Warteschlange stellen und sofort anzeigen */
  const queueChange = useCallback(
    (op: OutboxOp) => {
      writeOutbox(enqueueOp(readOutbox(), op, inflight.current))
      const next = applyOutbox({ entries: entriesRef.current, blocks: blocksRef.current }, [op], userId)
      delete loadedJson.current.entries
      delete loadedJson.current.blocks
      entriesRef.current = next.entries
      blocksRef.current = next.blocks
      setEntries(next.entries)
      setBlocks(next.blocks)
    },
    [readOutbox, writeOutbox, userId],
  )
  const outboxQueue = useRef<Promise<void>>(Promise.resolve())
  /** Wartende Änderungen der Reihe nach senden. Netzfehler: bleiben für später; andere Fehler: Hinweis. */
  const flushOutbox = useCallback(() => {
    const job = outboxQueue.current.then(async () => {
      let skipped = 0
      const failed: string[] = []
      while (navigator.onLine) {
        const op = readOutbox()[0]
        if (!op) break
        inflight.current = op.key
        try {
          const notAfter = conflictThreshold(op)
          const applied =
            op.kind === 'saveEntry'
              ? (await api.saveEntryRows({ id: op.id, create: op.create }, op.entry, op.blocks, op.removedBlockIds, op.create ? undefined : notAfter)) === 'saved'
              : await api.setDoneIfUnchanged(op.kind === 'entryDone' ? 'entries' : 'study_blocks', op.id, op.done, notAfter)
          if (!applied) skipped++ // gelöscht oder auf dem Server neuer: Der Server gewinnt
        } catch (err) {
          if (isRetryable(err)) break // bleibt in der Warteschlange, nächster Versuch später
          failed.push(friendlyError(err))
        } finally {
          inflight.current = undefined
        }
        writeOutbox(dequeue(readOutbox(), op.key))
      }
      if (skipped || failed.length) {
        const parts = []
        if (skipped)
          parts.push(
            skipped === 1
              ? 'Eine offline gemachte Änderung wurde nicht übernommen: Der Eintrag wurde inzwischen auf einem anderen Gerät geändert oder gelöscht.'
              : `${skipped} offline gemachte Änderungen wurden nicht übernommen: Die Einträge wurden inzwischen auf einem anderen Gerät geändert oder gelöscht.`,
          )
        for (const msg of failed) parts.push(`Eine offline gemachte Änderung konnte nicht gespeichert werden: ${msg}`)
        setSyncNotice(parts.join(' '))
      }
    })
    outboxQueue.current = job.catch(() => {})
    return outboxQueue.current
  }, [readOutbox, writeOutbox])

  // Mehrere Ladevorgänge können sich überholen (z. B. App kommt in den Vordergrund, während gerade
  // gespeichert wird). Pro Tabelle darf nur die zuletzt gestartete Abfrage den Stand setzen – sonst könnte
  // eine ältere, langsamere Antwort die frischen Daten wieder mit dem alten Stand überschreiben.
  const loadSeq = useRef(0)
  const latestSeq = useRef(new Map<LoadKey, number>())
  const lastLoadAt = useRef<number | null>(null) // Beginn des letzten erfolgreichen vollständigen Ladens
  // Zuletzt geladener Server-Stand (ohne wartende Offline-Änderungen) – für den Offline-Cache und um nach
  // dem Laden einer einzelnen Tabelle die Offline-Änderungen wieder darüberzulegen
  const server = useRef<api.LoadedData>({
    subjects: cached?.subjects ?? [],
    entries: cached?.entries ?? [],
    blocks: cached?.blocks ?? [],
    grades: cached?.grades ?? [],
    gradesMissing: cached?.gradesMissing ?? false,
    attachments: cached?.attachments ?? [],
    periods: cached?.periods ?? [],
    periodsMissing: cached?.periodsMissing ?? false,
    bm: cached?.bm ?? [],
    bmMissing: cached?.bmMissing ?? false,
  })

  /** Alles laden – oder mit `only` nur einzelne Tabellen (Realtime-Meldung). */
  const reload = useCallback(
    async (only?: LoadKey[]) => {
      const keys: LoadKey[] = only ?? [...api.DATA_KEYS, 'prefs']
      const seq = ++loadSeq.current
      for (const k of keys) latestSeq.current.set(k, seq)
      const isLatest = (k: LoadKey) => latestSeq.current.get(k) === seq
      const startedAt = Date.now()
      try {
        // Zuerst Offline-Änderungen hochladen, sonst kämen gleich die alten Werte zurück
        await Promise.all([flushPrefs(), flushOutbox()])
        const dataKeys = keys.filter((k): k is api.DataKey => k !== 'prefs')
        const [data, prefRows] = await Promise.all([
          api.fetchPart(dataKeys),
          keys.includes('prefs') ? api.fetchPrefs() : Promise.resolve(undefined),
        ])
        if (prefRows !== undefined && isLatest('prefs')) {
          prefsMissing.current = prefRows === null
          if (prefRows) {
            const knownTargets = [
              ...Object.keys(asTargets(prefsRef.current.gradeTargets)),
              ...Object.keys(loadPending(userId))
                .filter((n) => n.startsWith(TARGET_ROW))
                .map((n) => n.slice(TARGET_ROW.length)),
            ]
            const serverPrefs = serverRows(prefRows, knownTargets)
            // Früher nur auf diesem Gerät gespeichert (z. B. Notenziele) → einmalig hochladen
            const missing = missingOnServer(loadLocalPrefs(userId), serverPrefs)
            if (Object.keys(missing).length) {
              savePending(userId, { ...stamp(missing, Date.now()), ...loadPending(userId) })
              flushPrefs()
            }
            const changedMeanwhile = new Set([...prefChangedAt.current].filter(([, t]) => t >= startedAt).map(([n]) => n))
            setPrefs((current) => {
              const next = mergePrefs(current, serverPrefs, loadPending(userId), changedMeanwhile)
              if (JSON.stringify(next) === JSON.stringify(current)) return current // nichts geändert
              saveLocalPrefs(userId, next)
              return next
            })
          }
        }
        // Nur Tabellen übernehmen, für die keine neuere Abfrage läuft
        const fresh = dataKeys.filter(isLatest)
        if (fresh.length === 0) return
        const s = server.current
        for (const k of fresh) {
          if (k === 'grades') Object.assign(s, { grades: data.grades, gradesMissing: data.gradesMissing })
          else if (k === 'periods') Object.assign(s, { periods: data.periods, periodsMissing: data.periodsMissing })
          else if (k === 'bm') Object.assign(s, { bm: data.bm, bmMissing: data.bmMissing })
          else Object.assign(s, { [k]: data[k] })
        }
        // Was noch wartet (z. B. gerade offline abgehakt), bleibt sichtbar
        const shown = applyOutbox({ entries: s.entries, blocks: s.blocks }, readOutbox(), userId)
        // Nur geänderte Tabellen übernehmen (Flags wie gradesMissing ändern sich ohnehin nur selten)
        if (changed('subjects', s.subjects)) setSubjects(s.subjects)
        if (changed('entries', shown.entries)) setEntries(shown.entries)
        if (changed('blocks', shown.blocks)) setBlocks(shown.blocks)
        if (changed('grades', s.grades)) setGrades(s.grades)
        if (changed('attachments', s.attachments)) setAttachments(s.attachments)
        if (changed('periods', s.periods)) setPeriods(s.periods)
        if (changed('bm', s.bm)) setBm(s.bm)
        setGradesMissing(s.gradesMissing)
        setPeriodsMissing(s.periodsMissing)
        setBmMissing(s.bmMissing)
        const savedAt = new Date().toISOString()
        if (!only) {
          lastSyncRef.current = savedAt
          lastLoadAt.current = startedAt
        }
        setError(null)
        saveSnapshot(userId, { ...s, savedAt: lastSyncRef.current ?? savedAt })
        if (!only) void flushPurge()
      } catch (err) {
        if (keys.some(isLatest)) {
          setLastSync(lastSyncRef.current)
          setError(friendlyError(err))
        }
      } finally {
        if (keys.some(isLatest)) setLoading(false)
      }
    },
    [userId, flushPrefs, flushPurge, flushOutbox, readOutbox],
  )
  const reloadAll = useCallback(() => reload(), [reload])

  // Laden beim Start und beim Wiederverbinden
  useEffect(() => {
    reload()
    const onOnline = () => reload()
    window.addEventListener('online', onOnline)
    const seqs = latestSeq.current
    return () => {
      window.removeEventListener('online', onOnline)
      seqs.clear() // z. B. abgemeldet: ein noch laufendes Laden legt keinen Offline-Cache mehr an
    }
  }, [reload])

  // Realtime: Änderungen anderer Geräte sofort übernehmen – nur die betroffene Tabelle neu laden.
  // Mehrere Meldungen kurz hintereinander (z. B. Eintrag mit 5 Lernzeiten gespeichert) → einmal laden.
  const changedTables = useRef(new Set<LoadKey>())
  const changeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(changeTimer.current), [])
  const onRealtimeChange = useCallback(
    (table: RealtimeTable) => {
      changedTables.current.add(KEY_OF_TABLE[table])
      clearTimeout(changeTimer.current)
      changeTimer.current = setTimeout(() => {
        const keys = [...changedTables.current]
        changedTables.current.clear()
        void reload(keys)
      }, REALTIME_DEBOUNCE_MS)
    },
    [reload],
  )
  // Verpasst? Nach einer Unterbrechung immer, beim Zurückkehren höchstens alle 30 s (lib/refresh.ts)
  const onCatchUp = useCallback(
    (force: boolean) => {
      if (force || shouldReloadOnReturn(lastLoadAt.current, Date.now())) void reload()
    },
    [reload],
  )
  useRealtime({ userId, onChange: onRealtimeChange, onCatchUp })

  // Warten noch Offline-Änderungen (z. B. Server kurz nicht erreichbar), regelmässig erneut versuchen
  useEffect(() => {
    if (pendingChanges === 0) return
    const timer = setInterval(() => navigator.onLine && reload(), OUTBOX_RETRY_MS)
    return () => clearInterval(timer)
  }, [pendingChanges, reload])

  /** Hülle für alle Änderungen: offline sperren, Fehler übersetzen, danach neu laden. */
  const mutate = useCallback(
    async (action: () => Promise<void>) => {
      if (!navigator.onLine) throw new Error('Offline – Änderungen nicht möglich')
      // Offline gemachte Änderungen zuerst senden (z. B. Note zu einem offline angelegten Test)
      if (readOutbox().length) await flushOutbox()
      try {
        await action()
      } catch (err) {
        throw new Error(friendlyError(err))
      } finally {
        await reload()
      }
    },
    [reload, readOutbox, flushOutbox],
  )

  /**
   * Änderung an Einträgen/Lernzeiten: online direkt senden; offline (oder wenn das Netz unterwegs wegbricht)
   * in die Warteschlange. Warten schon Offline-Änderungen, kommt die neue dahinter (Reihenfolge bleibt).
   */
  const sendOrQueue = useCallback(
    async (op: OutboxOp, send: () => Promise<void>, canQueue = true) => {
      if (navigator.onLine && readOutbox().length) await flushOutbox()
      if (canQueue && (!navigator.onLine || readOutbox().length)) {
        queueChange(op)
        if (navigator.onLine) await reload()
        return
      }
      try {
        await send()
      } catch (err) {
        if (canQueue && isRetryable(err)) {
          queueChange(op) // kommt später nochmals
          return
        }
        await reload() // Server-Stand wieder anzeigen
        throw new Error(friendlyError(err))
      }
      await reload()
    },
    [readOutbox, flushOutbox, queueChange, reload],
  )
  // BM-Kreuze: Beim schnellen Antippen soll jede Änderung in der richtigen Reihenfolge ankommen.
  const bmQueue = useRef<Promise<void>>(Promise.resolve())
  const saveBm = useCallback(
    (semester: string, subject: BmSubject, fach: number, pers: number) => {
      if (!navigator.onLine) return Promise.reject(new Error('Offline – Änderungen nicht möglich'))
      // Sofort anzeigen (ohne auf den Server zu warten)
      delete loadedJson.current.bm
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

  // Nachschlage-Tabellen: jede nur neu, wenn sich ihre eigene Liste ändert
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])
  const blocksByEntry = useMemo(() => groupBy(blocks, (b) => b.entry_id), [blocks])
  const attachmentsByEntry = useMemo(() => groupBy(attachments, (a) => a.entry_id), [attachments])
  const gradesByEntry = useMemo(() => groupBy(grades, (g) => g.entry_id), [grades])
  const attachmentsByEntryRef = useRef(attachmentsByEntry) // für deleteEntry, ohne die Funktionen neu zu erzeugen
  useEffect(() => {
    attachmentsByEntryRef.current = attachmentsByEntry
  }, [attachmentsByEntry])

  // Änderungs-Funktionen: bleiben gleich, solange der Benutzer gleich bleibt
  const actions = useMemo(
    () => ({
      reload: reloadAll,
      saveEntry: async (
        target: { id: string; create: boolean },
        input: EntryInput,
        newBlocks: StudyBlockInput[],
        removedBlockIds: string[],
        att?: { added: PendingAttachment[]; removed: Attachment[] },
      ) => {
        // Hochgeladene Dateien vormerken: Scheitert das Speichern und wird es nicht wiederholt, liegt die
        // Datei sonst ohne Anhang im Speicher. Entfernte Anhänge: falls das Löschen der Datei nicht klappt.
        const now = Date.now()
        const uploads = (att?.added ?? []).filter((a) => a.kind === 'file')
        queuePurge([
          ...uploads.map((a) => ({ id: a.id, path: api.attachmentPath(userId, target.id, a), due: now + UPLOAD_GRACE_MS })),
          ...(att?.removed ?? []).flatMap((a) => (a.storage_path ? [{ id: a.id, path: a.storage_path, due: now }] : [])),
        ])
        // Anhänge brauchen Internet (Datei-Upload); alles andere geht auch offline
        const withAttachments = (att?.added.length ?? 0) + (att?.removed.length ?? 0) > 0
        if (withAttachments && !navigator.onLine)
          throw new Error('Offline – Anhänge lassen sich nur mit Internet hinzufügen oder entfernen. Ohne Änderung an den Anhängen kannst du speichern.')
        const rows = api.blockRows(newBlocks)
        const keep = new Set(rows.map((b) => b.id))
        const op: OutboxOp = {
          kind: 'saveEntry',
          key: crypto.randomUUID(),
          id: target.id,
          create: target.create,
          entry: input,
          blocks: rows,
          removedBlockIds: removedBlockIds.filter((id) => !keep.has(id)),
          at: Date.now(),
          base: baseOf(entriesRef.current.find((e) => e.id === target.id)),
        }
        await sendOrQueue(
          op,
          async () => {
            const blockInputs = newBlocks.map((b, i) => ({ ...b, id: rows[i].id }))
            await api.saveEntry(target, input, blockInputs, removedBlockIds, att)
          },
          !withAttachments,
        )
        void flushPurge(uploads.map((a) => a.id)) // gespeichert → die Anhänge gibt es, nichts zu löschen
      },
      deleteEntry: (id: string) => {
        // Dateien bleiben für "Rückgängig" liegen; danach (auch wenn die App vorher geschlossen wird) weg damit
        const files = (attachmentsByEntryRef.current.get(id) ?? []).flatMap((a) =>
          a.storage_path ? [{ id: a.id, path: a.storage_path, due: Date.now() + UNDO_GRACE_MS }] : [],
        )
        queuePurge(files)
        return mutate(() => api.deleteEntry(id))
      },
      restoreEntry: (entry: Entry, entryBlocks: StudyBlock[], att: Attachment[], gradeIds: string[]) =>
        mutate(() => api.restoreEntry(entry, entryBlocks, att, gradeIds)),
      purgeAttachmentFiles: (list: Attachment[]) => flushPurge(list.map((a) => a.id)),
      attachmentUrls: (list: Attachment[]) => api.attachmentUrls(list),
      // Abhaken: sofort anzeigen, dann speichern – offline später (bei einem Fehler zeigt das Neuladen
      // wieder den Server-Stand)
      setEntryDone: (id: string, done: boolean) => {
        delete loadedJson.current.entries
        setEntries((list) => list.map((e) => (e.id === id ? { ...e, done } : e)))
        const base = baseOf(entriesRef.current.find((e) => e.id === id))
        return sendOrQueue({ kind: 'entryDone', key: crypto.randomUUID(), id, done, at: Date.now(), base }, () => api.setEntryDone(id, done))
      },
      setBlockDone: (id: string, done: boolean) => {
        delete loadedJson.current.blocks
        setBlocks((list) => list.map((b) => (b.id === id ? { ...b, done } : b)))
        const base = baseOf(blocksRef.current.find((b) => b.id === id))
        return sendOrQueue({ kind: 'blockDone', key: crypto.randomUUID(), id, done, at: Date.now(), base }, () => api.setBlockDone(id, done))
      },
      saveSubject: (id: string | null, name: string, color: string) => mutate(() => api.saveSubject(id, name, color)),
      deleteSubject: (id: string) => mutate(() => api.deleteSubject(id)),
      saveGrade: (id: string | null, input: GradeInput) => mutate(() => api.saveGrade(id, input)),
      deleteGrade: (id: string) => mutate(() => api.deleteGrade(id)),
      restoreGrade: (grade: Grade) => mutate(() => api.restoreGrade(grade)),
      savePeriod: (id: string | null, input: PeriodInput) => mutate(() => api.savePeriod(id, input)),
      deletePeriod: (id: string) => mutate(() => api.deletePeriod(id)),
      restorePeriod: (period: Period) => mutate(() => api.restorePeriod(period)),
      saveBm,
      setPref,
    }),
    [reloadAll, mutate, sendOrQueue, saveBm, setPref, userId, queuePurge, flushPurge],
  )
  const dismissSyncNotice = useCallback(() => setSyncNotice(null), [])

  const value = useMemo<DataValue>(
    () => ({
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
      pendingChanges,
      syncNotice,
      dismissSyncNotice,
      loading,
      error,
      lastSync,
      online,
      subjectById,
      entryById,
      blocksByEntry,
      attachmentsByEntry,
      gradesByEntry,
      prefs,
      ...actions,
    }),
    [subjects, entries, blocks, grades, gradesMissing, attachments, periods, periodsMissing, bm, bmMissing, pendingChanges, syncNotice, dismissSyncNotice, loading, error, lastSync, online, subjectById, entryById, blocksByEntry, attachmentsByEntry, gradesByEntry, prefs, actions],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/** Stand der Zeile, wie ihn das Gerät zuletzt vom Server kannte (für Konflikte, lib/outbox.ts) */
function baseOf(row: { updated_at?: string } | undefined): string | undefined {
  return row?.updated_at || undefined
}

/** Liste → Map nach Schlüssel (ohne Schlüssel: weggelassen). Einmal durch die Liste statt immer neu kopieren. */
function groupBy<T>(list: T[], key: (item: T) => string | null | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of list) {
    const k = key(item)
    if (!k) continue
    const group = map.get(k)
    if (group) group.push(item)
    else map.set(k, [item])
  }
  return map
}

export function useData(): DataValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData() muss innerhalb von <DataProvider> verwendet werden')
  return ctx
}

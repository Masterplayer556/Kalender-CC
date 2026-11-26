// Alle Zugriffe auf die Supabase-Datenbank an einem Ort.
// user_id wird nie mitgeschickt: Die Datenbank setzt sie automatisch (default auth.uid()),
// und die RLS-Regeln verhindern Zugriffe auf fremde Daten.

import { supabase } from '../lib/supabase'
import { localToIso } from '../lib/dates'
import { officeViewerUrl } from '../lib/files'
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

// ---------------------------------------------------------------------
// Einträge
// ---------------------------------------------------------------------

/** Ergebnis von save_entry: gespeichert, Eintrag gibt es nicht mehr, Server-Stand ist neuer */
export type SaveResult = 'saved' | 'gone' | 'stale'

const GONE_MESSAGE = 'Diesen Eintrag gibt es nicht mehr – er wurde wohl auf einem anderen Gerät gelöscht.'

/** Lernzeiten aus dem Formular als Zeilen (neue bekommen hier ihre id) */
export function blockRows(blocks: StudyBlockInput[]): { id: string; starts_at: string; ends_at: string; done: boolean }[] {
  return blocks.map((b) => ({
    id: b.id ?? crypto.randomUUID(),
    starts_at: localToIso(b.date, b.start),
    ends_at: localToIso(b.date, b.end),
    done: b.done,
  }))
}

/**
 * Speichert einen Eintrag samt Lernzeiten und Anhängen.
 * - Lernzeiten: neue werden angelegt, geänderte aktualisiert, die in removedBlockIds gelöscht.
 * - Anhänge: neue Dateien werden hochgeladen, neue Links gespeichert, die in attachments.removed gelöscht.
 * Gelöscht wird nur, was im Formular entfernt wurde: Bearbeitet ein anderes Gerät denselben Eintrag und
 * fügt etwas hinzu, bleibt das stehen.
 *
 * Eintrag und Lernzeiten speichert die Datenbank-Funktion save_entry (Migration 012) in einem Schritt:
 * Reisst die Verbindung ab, ist entweder alles oder nichts gespeichert. Anhänge folgen danach.
 * Alle ids kommen vom Gerät und es wird mit upsert geschrieben: Ein erneuter Versuch legt nichts doppelt an.
 */
export async function saveEntry(
  target: { id: string; create: boolean },
  input: EntryInput,
  blocks: StudyBlockInput[],
  removedBlockIds: string[],
  attachments: { added: PendingAttachment[]; removed: Attachment[] } = { added: [], removed: [] },
): Promise<string> {
  const keptIds = new Set(blocks.map((b) => b.id).filter(Boolean))
  const removed = removedBlockIds.filter((bid) => !keptIds.has(bid))
  const result = await saveEntryRows(target, input, blockRows(blocks), removed)
  if (result === 'gone') throw new Error(GONE_MESSAGE)

  // Anhänge
  if (attachments.removed.length) await deleteAttachments(attachments.removed)
  for (const a of attachments.added) await addAttachment(target.id, a)

  return target.id
}

/**
 * Eintrag und Lernzeiten speichern (ohne Anhänge). changedAt (ISO): bei offline gemachten Änderungen –
 * ist der Eintrag auf dem Server neuer, bleibt er stehen ('stale', siehe lib/outbox.ts). Fehlt Migration 012, wird in mehreren
 * Schritten gespeichert (wie früher).
 */
export async function saveEntryRows(
  target: { id: string; create: boolean },
  input: EntryInput,
  rows: { id: string; starts_at: string; ends_at: string; done: boolean }[],
  removedBlockIds: string[],
  changedAt?: string,
): Promise<SaveResult> {
  const { data, error } = await supabase.rpc('save_entry', {
    p_id: target.id,
    p_create: target.create,
    p_entry: input,
    p_blocks: rows,
    p_removed_block_ids: removedBlockIds,
    p_changed_at: changedAt ?? null,
  })
  // PGRST202 = Funktion unbekannt: 012_save_entry.sql noch nicht ausgeführt
  if (error?.code === 'PGRST202') return saveEntryInSteps(target, input, rows, removedBlockIds)
  if (error) throw error
  return data as SaveResult
}

/** Früherer Weg ohne save_entry: mehrere Anfragen nacheinander (nicht atomar). */
async function saveEntryInSteps(
  target: { id: string; create: boolean },
  input: EntryInput,
  rows: { id: string; starts_at: string; ends_at: string; done: boolean }[],
  removed: string[],
): Promise<SaveResult> {
  // 1. Eintrag speichern (neu: upsert mit der vorab vergebenen id)
  const write = (row: Partial<EntryInput>) =>
    (target.create
      ? supabase.from('entries').upsert({ id: target.id, ...row })
      : supabase.from('entries').update(row).eq('id', target.id)
    )
      .select('id')
      .single()
  let { data, error } = await write(input)
  // PGRST204 = Spalte unbekannt: 007_multi_grade_tests.sql noch nicht ausgeführt → ohne den Haken speichern
  if (error?.code === 'PGRST204' && /multi_grade/.test(error.message) && !input.multi_grade) {
    const { multi_grade: _, ...rest } = input
    ;({ data, error } = await write(rest))
  }
  // PGRST116 = keine Zeile getroffen: Der Eintrag wurde inzwischen gelöscht (z. B. auf einem anderen Gerät)
  if (!target.create && (error?.code === 'PGRST116' || (!error && !data))) return 'gone'
  if (error || !data) throw error ?? new Error('Der Eintrag konnte nicht gespeichert werden.')

  // 2. Im Formular entfernte Lernzeiten löschen
  if (removed.length) {
    const { error: delError } = await supabase.from('study_blocks').delete().in('id', removed)
    if (delError) throw delError
  }

  // 3. Bestehende aktualisieren, neue anlegen
  if (rows.length) {
    const { error: upError } = await supabase.from('study_blocks').upsert(rows.map((r) => ({ ...r, entry_id: target.id })))
    if (upError) throw upError
  }
  return 'saved'
}

// ---------------------------------------------------------------------
// Anhänge (Dateien im Supabase-Speicher "attachments", Links nur als Zeile)
// ---------------------------------------------------------------------

const BUCKET = 'attachments'

/** Dateiname für den Speicher: nur sichere Zeichen, Umlaute werden ersetzt. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // ä → a, é → e
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned.slice(-100) || 'datei'
}

/** Pfad einer Datei im Speicher. Aus der id des Anhangs: Ein zweiter Versuch ersetzt die Datei, statt eine
 *  weitere abzulegen. Er beginnt mit der eigenen user_id – nur dort darf man laut Speicher-Regeln hochladen. */
export function attachmentPath(userId: string, entryId: string, a: { id: string; name: string }): string {
  return `${userId}/${entryId}/${a.id.slice(0, 8)}-${safeFileName(a.name)}`
}

async function addAttachment(entryId: string, a: PendingAttachment): Promise<void> {
  // Schon angelegt (früherer Versuch)? Dann nichts tun.
  const once = { onConflict: 'id', ignoreDuplicates: true }
  if (a.kind === 'link') {
    const { error } = await supabase.from('attachments').upsert({ id: a.id, entry_id: entryId, kind: 'link', name: a.name, url: a.url }, once)
    if (error) throw error
    return
  }
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) throw new Error('Nicht angemeldet.')
  const path = attachmentPath(userId, entryId, a)

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, a.file, { contentType: a.file.type || undefined, upsert: true })
  if (upError) throw upError

  const { error } = await supabase.from('attachments').upsert(
    {
      id: a.id,
      entry_id: entryId,
      kind: 'file',
      name: a.name,
      storage_path: path,
      size: a.file.size,
      mime: a.file.type || null,
    },
    once,
  )
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]) // hochgeladene Datei nicht verwaist liegen lassen
    throw error
  }
}

/** Löscht Anhang-Zeilen und die zugehörigen Dateien. */
export async function deleteAttachments(list: Attachment[]): Promise<void> {
  const { error } = await supabase.from('attachments').delete().in('id', list.map((a) => a.id))
  if (error) throw error
  // Klappt das Löschen der Dateien nicht, räumt die Aufräum-Liste sie später weg (DataProvider, lib/purge.ts)
  await deleteAttachmentFiles(list).catch(() => {})
}

/** Nur die Dateien im Speicher löschen. */
export async function deleteAttachmentFiles(list: Attachment[]): Promise<void> {
  await removeFiles(list.map((a) => a.storage_path).filter((p): p is string => !!p))
}

/** Dateien im Speicher löschen (Fehler werden gemeldet, damit es später nochmals versucht werden kann). */
export async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

/** Welche dieser Anhänge gibt es (noch) in der Datenbank? */
export async function existingAttachmentIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data, error } = await supabase.from('attachments').select('id').in('id', ids)
  if (error) throw error
  return new Set(data.map((r) => r.id as string))
}

/** So lange gelten die Datei-Links (Sekunden). */
export const SIGNED_URL_SECONDS = 60 * 60

/**
 * Adressen zum Öffnen von Anhängen (Anhang-id → Adresse).
 * Dateien: zeitlich begrenzte Links, da der Speicher privat ist – alle in einer Anfrage.
 * Word, PowerPoint und Excel laufen über den Office-Viewer (siehe officeViewerUrl).
 */
export async function attachmentUrls(list: Attachment[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  for (const a of list) if (a.kind === 'link' && a.url) urls.set(a.id, a.url)

  const files = list.filter((a) => a.kind === 'file' && a.storage_path)
  if (files.length) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(files.map((a) => a.storage_path!), SIGNED_URL_SECONDS)
    if (error) throw error
    const byPath = new Map(data.map((d) => [d.path, d.signedUrl]))
    for (const a of files) {
      const url = byPath.get(a.storage_path!)
      if (url) urls.set(a.id, officeViewerUrl(url, a.name, a.size) ?? url)
    }
  }
  return urls
}

export async function deleteEntry(id: string): Promise<void> {
  // Die Lernzeiten löscht die Datenbank automatisch mit (on delete cascade).
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw error
}

/**
 * Stellt einen gelöschten Eintrag samt Lernzeiten wieder her ("Rückgängig").
 * Gleiche ids wie vorher, damit z. B. eine spätere Verknüpfung (Noten, .ics) wieder passt.
 */
export async function restoreEntry(
  entry: Entry,
  blocks: StudyBlock[],
  attachments: Attachment[] = [],
  linkedGradeIds: string[] = [],
): Promise<void> {
  const row = {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    subject_id: entry.subject_id,
    date: entry.date,
    end_date: entry.end_date ?? null,
    start_time: entry.start_time,
    end_time: entry.end_time,
    notes: entry.notes,
    done: entry.done,
    ...(entry.multi_grade ? { multi_grade: true } : {}),
    created_at: entry.created_at,
  }
  let { error } = await supabase.from('entries').insert(row)
  // 23503 = Fremdschlüssel fehlt: Das Fach wurde inzwischen gelöscht → ohne Fach wiederherstellen
  if (error?.code === '23503') ({ error } = await supabase.from('entries').insert({ ...row, subject_id: null }))
  if (error) throw error

  if (blocks.length) {
    const { error: blockError } = await supabase.from('study_blocks').insert(
      blocks.map((b) => ({ id: b.id, entry_id: b.entry_id, starts_at: b.starts_at, ends_at: b.ends_at, done: b.done })),
    )
    if (blockError) throw blockError
  }

  // Anhänge: Die Dateien liegen noch im Speicher (sie werden erst nach dem Rückgängig-Fenster gelöscht)
  if (attachments.length) {
    const { error: attError } = await supabase.from('attachments').insert(
      attachments.map(({ id, entry_id, kind, name, url, storage_path, size, mime, created_at }) => ({
        id, entry_id, kind, name, url, storage_path, size, mime, created_at,
      })),
    )
    if (attError) throw attError
  }

  // Verknüpfte Noten wieder mit dem Test verbinden (beim Löschen wurde entry_id auf null gesetzt)
  if (linkedGradeIds.length) {
    const { error: gradeError } = await supabase.from('grades').update({ entry_id: entry.id }).in('id', linkedGradeIds)
    if (gradeError) throw gradeError
  }
}

export async function setEntryDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('entries').update({ done }).eq('id', id)
  if (error) throw error
}

export async function setBlockDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('study_blocks').update({ done }).eq('id', id)
  if (error) throw error
}

/**
 * Offline gemachten Haken nachsenden: nur, wenn es die Zeile noch gibt und sie auf dem Server nicht nach
 * `notAfter` geändert wurde (lib/outbox.ts). false = entfallen (gelöscht oder auf dem Server neuer).
 */
export async function setDoneIfUnchanged(table: 'entries' | 'study_blocks', id: string, done: boolean, notAfter: string): Promise<boolean> {
  const run = (check: boolean) => {
    let q = supabase.from(table).update({ done }).eq('id', id)
    if (check) q = q.lte('updated_at', notAfter)
    return q.select('id')
  }
  let { data, error } = await run(true)
  // 42703 = Spalte unbekannt: Lernzeiten ohne updated_at (013_study_blocks_updated_at.sql fehlt) → ohne Prüfung
  if (error?.code === '42703') ({ data, error } = await run(false))
  if (error) throw error
  return (data ?? []).length > 0
}

// ---------------------------------------------------------------------
// Fächer
// ---------------------------------------------------------------------

export async function saveSubject(id: string | null, name: string, color: string): Promise<void> {
  const { error } = id
    ? await supabase.from('subjects').update({ name, color }).eq('id', id)
    : await supabase.from('subjects').insert({ name, color })
  if (error) throw error
}

export async function deleteSubject(id: string): Promise<void> {
  // Einträge dieses Fachs bleiben erhalten, sie verlieren nur die Fach-Zuordnung.
  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------
// Noten
// ---------------------------------------------------------------------

export async function saveGrade(id: string | null, input: GradeInput): Promise<void> {
  const { error } = id
    ? await supabase.from('grades').update(input).eq('id', id)
    : await supabase.from('grades').insert(input)
  if (error) throw error
}

export async function deleteGrade(id: string): Promise<void> {
  const { error } = await supabase.from('grades').delete().eq('id', id)
  if (error) throw error
}

/** Gelöschte Note wiederherstellen ("Rückgängig"), mit derselben id. */
export async function restoreGrade(g: Grade): Promise<void> {
  const { error } = await supabase.from('grades').insert({
    id: g.id,
    subject_id: g.subject_id,
    title: g.title,
    date: g.date,
    grade: g.grade,
    weight: g.weight,
    entry_id: g.entry_id,
    created_at: g.created_at,
  })
  if (error) throw error
}

// ---------------------------------------------------------------------
// Zeiträume (Ferien, schulfreie Tage, Lager)
// ---------------------------------------------------------------------

export async function savePeriod(id: string | null, input: PeriodInput): Promise<void> {
  const { error } = id
    ? await supabase.from('periods').update(input).eq('id', id)
    : await supabase.from('periods').insert(input)
  if (error) throw error
}

export async function deletePeriod(id: string): Promise<void> {
  const { error } = await supabase.from('periods').delete().eq('id', id)
  if (error) throw error
}

/** Gelöschten Zeitraum wiederherstellen ("Rückgängig"), mit derselben id. */
export async function restorePeriod(p: Period): Promise<void> {
  const { id, name, kind, start_date, end_date, created_at } = p
  const { error } = await supabase.from('periods').insert({ id, name, kind, start_date, end_date, created_at })
  if (error) throw error
}

// ---------------------------------------------------------------------
// BM-Einschätzung
// ---------------------------------------------------------------------

/** Kreuze eines Fachs in einem Semester speichern (legt die Zeile an, falls es sie noch nicht gibt). */
export async function saveBmRating(semester: string, subject: BmSubject, fach: number, pers: number): Promise<void> {
  const { error } = await supabase
    .from('bm_ratings')
    .upsert({ semester, subject, fach, pers, updated_at: new Date().toISOString() }, { onConflict: 'user_id,semester,subject' })
  if (error) throw error
}

// ---------------------------------------------------------------------
// Einstellungen auf allen Geräten (Notenziele, Design …)
// ---------------------------------------------------------------------

/** Alle Einstellungen laden; null, wenn 009_user_prefs.sql noch nicht ausgeführt wurde. */
export async function fetchPrefs(): Promise<{ name: string; value: unknown; updated_at: string }[] | null> {
  const { data, error } = await supabase.from('user_prefs').select('name, value, updated_at')
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') return null // Tabelle existiert nicht
    throw error
  }
  return data
}

/**
 * Einstellungen speichern (legt die Zeilen an, falls es sie noch nicht gibt). updated_at = Zeitpunkt der
 * Änderung auf dem Gerät; eine Zeile, die auf dem Server schon neuer ist, bleibt stehen (Migration 010).
 */
export async function savePrefs(prefs: Record<string, { value: unknown; at: number }>): Promise<void> {
  const rows = Object.entries(prefs).map(([name, { value, at }]) => ({ name, value, updated_at: new Date(at).toISOString() }))
  if (rows.length === 0) return
  const { error } = await supabase.from('user_prefs').upsert(rows, { onConflict: 'user_id,name' })
  if (error) throw error
}

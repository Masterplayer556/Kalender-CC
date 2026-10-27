// Alle Zugriffe auf die Supabase-Datenbank an einem Ort.
// user_id wird nie mitgeschickt: Die Datenbank setzt sie automatisch (default auth.uid()),
// und die RLS-Regeln verhindern Zugriffe auf fremde Daten.

import { supabase } from '../lib/supabase'
import { localToIso } from '../lib/dates'
import type {
  Attachment,
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

export async function fetchEverything() {
  const [subjects, entries, blocks, grades, attachments, periods] = await Promise.all([
    fetchAll<Subject>('subjects', 'name'),
    fetchAll<Entry>('entries', 'date'),
    fetchAll<StudyBlock>('study_blocks', 'starts_at'),
    fetchOptional<Grade>('grades', 'date'),
    fetchOptional<Attachment>('attachments', 'created_at'),
    fetchOptional<Period>('periods', 'start_date'),
  ])
  return {
    subjects,
    entries,
    blocks,
    // Postgres liefert "numeric" je nach Einstellung als Text → sicherheitshalber in Zahlen umwandeln
    grades: (grades ?? []).map((g) => ({ ...g, grade: Number(g.grade), weight: Number(g.weight), entry_id: g.entry_id ?? null })),
    gradesMissing: grades === null,
    attachments: attachments ?? [],
    periods: periods ?? [],
    periodsMissing: periods === null,
  }
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

/**
 * Speichert einen Eintrag samt Lernzeiten und Anhängen.
 * - entryId = null → neuer Eintrag
 * - Lernzeiten: neue werden angelegt, geänderte aktualisiert, entfernte gelöscht.
 * - Anhänge: neue Dateien werden hochgeladen, neue Links gespeichert, entfernte gelöscht.
 */
export async function saveEntry(
  entryId: string | null,
  input: EntryInput,
  blocks: StudyBlockInput[],
  previousBlockIds: string[],
  attachments: { added: PendingAttachment[]; removed: Attachment[] } = { added: [], removed: [] },
): Promise<string> {
  // 1. Eintrag speichern und seine id erhalten
  const query = entryId
    ? supabase.from('entries').update(input).eq('id', entryId)
    : supabase.from('entries').insert(input)
  const { data, error } = await query.select('id').single()
  if (error) throw error
  const id = data.id as string

  // 2. Entfernte Lernzeiten löschen
  const keptIds = new Set(blocks.map((b) => b.id).filter(Boolean))
  const removed = previousBlockIds.filter((bid) => !keptIds.has(bid))
  if (removed.length) {
    const { error: delError } = await supabase.from('study_blocks').delete().in('id', removed)
    if (delError) throw delError
  }

  // 3. Bestehende aktualisieren, neue anlegen
  const toRow = (b: StudyBlockInput) => ({
    entry_id: id,
    starts_at: localToIso(b.date, b.start),
    ends_at: localToIso(b.date, b.end),
    done: b.done,
  })
  const existing = blocks.filter((b) => b.id).map((b) => ({ id: b.id!, ...toRow(b) }))
  const created = blocks.filter((b) => !b.id).map(toRow)

  if (existing.length) {
    const { error: upError } = await supabase.from('study_blocks').upsert(existing)
    if (upError) throw upError
  }
  if (created.length) {
    const { error: insError } = await supabase.from('study_blocks').insert(created)
    if (insError) throw insError
  }

  // 4. Anhänge
  if (attachments.removed.length) await deleteAttachments(attachments.removed)
  for (const a of attachments.added) await addAttachment(id, a)

  return id
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

async function addAttachment(entryId: string, a: PendingAttachment): Promise<void> {
  if (a.kind === 'link') {
    const { error } = await supabase.from('attachments').insert({ entry_id: entryId, kind: 'link', name: a.name, url: a.url })
    if (error) throw error
    return
  }
  // Pfad beginnt mit der eigenen user_id – nur dort darf man laut Speicher-Regeln hochladen
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) throw new Error('Nicht angemeldet.')
  const path = `${userId}/${entryId}/${crypto.randomUUID().slice(0, 8)}-${safeFileName(a.name)}`

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, a.file, { contentType: a.file.type || undefined })
  if (upError) throw upError

  const { error } = await supabase.from('attachments').insert({
    entry_id: entryId,
    kind: 'file',
    name: a.name,
    storage_path: path,
    size: a.file.size,
    mime: a.file.type || null,
  })
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]) // hochgeladene Datei nicht verwaist liegen lassen
    throw error
  }
}

/** Löscht Anhang-Zeilen und die zugehörigen Dateien. */
export async function deleteAttachments(list: Attachment[]): Promise<void> {
  const { error } = await supabase.from('attachments').delete().in('id', list.map((a) => a.id))
  if (error) throw error
  await deleteAttachmentFiles(list)
}

/** Nur die Dateien im Speicher löschen (z. B. wenn das Rückgängig-Fenster abgelaufen ist). */
export async function deleteAttachmentFiles(list: Attachment[]): Promise<void> {
  const paths = list.map((a) => a.storage_path).filter((p): p is string => !!p)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

/** Adresse zum Öffnen eines Anhangs. Dateien: zeitlich begrenzter Link (1 Stunde), da der Speicher privat ist. */
export async function attachmentUrl(a: Attachment): Promise<string> {
  if (a.kind === 'link') return a.url!
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path!, 60 * 60)
  if (error) throw error
  return data.signedUrl
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

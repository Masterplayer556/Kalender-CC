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

export async function fetchEverything() {
  const [subjects, entries, blocks, grades, attachments, periods, bm] = await Promise.all([
    fetchAll<Subject>('subjects', 'name'),
    fetchAll<Entry>('entries', 'date'),
    fetchAll<StudyBlock>('study_blocks', 'starts_at'),
    fetchOptional<Grade>('grades', 'date'),
    fetchOptional<Attachment>('attachments', 'created_at'),
    fetchOptional<Period>('periods', 'start_date'),
    fetchOptional<BmRating>('bm_ratings', 'semester'),
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
    bm: (bm ?? []).map((r) => ({ ...r, fach: Number(r.fach), pers: Number(r.pers) })),
    bmMissing: bm === null,
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
/**
 * Eintrag mit Lernzeiten und Anhängen speichern. Alle ids kommen vom Gerät (neuer Eintrag, neue Lernzeiten,
 * neue Anhänge) und es wird mit upsert geschrieben: Bricht das Speichern mittendrin ab (z. B. Netz weg)
 * und man versucht es nochmals, entstehen keine doppelten Einträge, Lernzeiten oder Anhänge.
 */
export async function saveEntry(
  target: { id: string; create: boolean },
  input: EntryInput,
  blocks: StudyBlockInput[],
  previousBlockIds: string[],
  attachments: { added: PendingAttachment[]; removed: Attachment[] } = { added: [], removed: [] },
): Promise<string> {
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
  if (!target.create && (error?.code === 'PGRST116' || (!error && !data)))
    throw new Error('Diesen Eintrag gibt es nicht mehr – er wurde wohl auf einem anderen Gerät gelöscht.')
  if (error || !data) throw error ?? new Error('Der Eintrag konnte nicht gespeichert werden.')
  const id = data.id as string

  // 2. Entfernte Lernzeiten löschen
  const keptIds = new Set(blocks.map((b) => b.id).filter(Boolean))
  const removed = previousBlockIds.filter((bid) => !keptIds.has(bid))
  if (removed.length) {
    const { error: delError } = await supabase.from('study_blocks').delete().in('id', removed)
    if (delError) throw delError
  }

  // 3. Bestehende aktualisieren, neue anlegen (in einem upsert; neue ohne id bekommen hier eine)
  const rows = blocks.map((b) => ({
    id: b.id ?? crypto.randomUUID(),
    entry_id: id,
    starts_at: localToIso(b.date, b.start),
    ends_at: localToIso(b.date, b.end),
    done: b.done,
  }))
  if (rows.length) {
    const { error: upError } = await supabase.from('study_blocks').upsert(rows)
    if (upError) throw upError
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
  // Schon angelegt (früherer Versuch)? Dann nichts tun.
  const once = { onConflict: 'id', ignoreDuplicates: true }
  if (a.kind === 'link') {
    const { error } = await supabase.from('attachments').upsert({ id: a.id, entry_id: entryId, kind: 'link', name: a.name, url: a.url }, once)
    if (error) throw error
    return
  }
  // Pfad beginnt mit der eigenen user_id – nur dort darf man laut Speicher-Regeln hochladen
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) throw new Error('Nicht angemeldet.')
  // Pfad aus der id des Anhangs: Ein zweiter Versuch ersetzt die Datei, statt eine weitere abzulegen
  const path = `${userId}/${entryId}/${a.id.slice(0, 8)}-${safeFileName(a.name)}`

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
  await deleteAttachmentFiles(list)
}

/** Nur die Dateien im Speicher löschen (z. B. wenn das Rückgängig-Fenster abgelaufen ist). */
export async function deleteAttachmentFiles(list: Attachment[]): Promise<void> {
  const paths = list.map((a) => a.storage_path).filter((p): p is string => !!p)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
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

// Einträge und Lernzeiten: speichern (Migration 012: in einem Schritt), löschen, wiederherstellen, abhaken.

import { supabase } from '../../lib/supabase'
import { localToIso } from '../../lib/dates'
import { addAttachment, deleteAttachments } from './attachments'
import type { Attachment, Entry, EntryInput, PendingAttachment, StudyBlock, StudyBlockInput } from '../../types'

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

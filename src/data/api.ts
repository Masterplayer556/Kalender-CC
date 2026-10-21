// Alle Zugriffe auf die Supabase-Datenbank an einem Ort.
// user_id wird nie mitgeschickt: Die Datenbank setzt sie automatisch (default auth.uid()),
// und die RLS-Regeln verhindern Zugriffe auf fremde Daten.

import { supabase } from '../lib/supabase'
import { localToIso } from '../lib/dates'
import type { Entry, EntryInput, Grade, GradeInput, StudyBlock, StudyBlockInput, Subject } from '../types'

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
  const [subjects, entries, blocks, grades] = await Promise.all([
    fetchAll<Subject>('subjects', 'name'),
    fetchAll<Entry>('entries', 'date'),
    fetchAll<StudyBlock>('study_blocks', 'starts_at'),
    fetchGrades(),
  ])
  return { subjects, entries, blocks, grades: grades ?? [], gradesMissing: grades === null }
}

/**
 * Noten laden. Gibt null zurück, wenn es die Tabelle noch nicht gibt
 * (002_grades.sql noch nicht ausgeführt) – der Rest der App funktioniert dann trotzdem.
 */
async function fetchGrades(): Promise<Grade[] | null> {
  try {
    const rows = await fetchAll<Grade>('grades', 'date')
    // Postgres liefert "numeric" je nach Einstellung als Text → sicherheitshalber in Zahlen umwandeln
    return rows.map((g) => ({ ...g, grade: Number(g.grade), weight: Number(g.weight) }))
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
 * Speichert einen Eintrag samt Lernzeiten.
 * - entryId = null → neuer Eintrag
 * - Lernzeiten: neue werden angelegt, geänderte aktualisiert, entfernte gelöscht.
 */
export async function saveEntry(
  entryId: string | null,
  input: EntryInput,
  blocks: StudyBlockInput[],
  previousBlockIds: string[],
): Promise<void> {
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
export async function restoreEntry(entry: Entry, blocks: StudyBlock[]): Promise<void> {
  const row = {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    subject_id: entry.subject_id,
    date: entry.date,
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
    created_at: g.created_at,
  })
  if (error) throw error
}

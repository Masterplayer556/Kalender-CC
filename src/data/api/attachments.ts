// Anhänge: Dateien im Supabase-Speicher "attachments", Links nur als Zeile.

import { supabase } from '../../lib/supabase'
import { officeViewerUrl } from '../../lib/files'
import type { Attachment, PendingAttachment } from '../../types'

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

export async function addAttachment(entryId: string, a: PendingAttachment): Promise<void> {
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

// BM-Einschätzung und Einstellungen auf allen Geräten.

import { supabase } from '../../lib/supabase'
import type { BmSubject } from '../../types'

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

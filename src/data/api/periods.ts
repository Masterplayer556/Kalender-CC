// Zeiträume (Ferien, schulfreie Tage, Lager).

import { supabase } from '../../lib/supabase'
import type { Period, PeriodInput } from '../../types'

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

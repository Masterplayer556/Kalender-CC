// Fächer.

import { supabase } from '../../lib/supabase'

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

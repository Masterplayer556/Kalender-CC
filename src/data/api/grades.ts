// Noten.

import { supabase } from '../../lib/supabase'
import type { Grade, GradeInput } from '../../types'

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

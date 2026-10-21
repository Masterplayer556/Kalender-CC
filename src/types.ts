// Datentypen – entsprechen den Tabellen in supabase/migrations/001_init.sql

export type Category = 'test' | 'aufgabe' | 'sonstiges'

export interface Subject {
  id: string
  user_id: string
  name: string
  color: string // Hex, z. B. "#3b82f6"
}

export interface Entry {
  id: string
  user_id: string
  title: string
  category: Category
  subject_id: string | null
  date: string // "JJJJ-MM-TT"
  start_time: string | null // "HH:MM:SS" (so liefert Postgres den Typ "time")
  end_time: string | null
  notes: string | null
  done: boolean
  created_at: string
  updated_at: string
}

export interface StudyBlock {
  id: string
  user_id: string
  entry_id: string
  starts_at: string // ISO-Zeitstempel mit Zeitzone
  ends_at: string
  done: boolean
}

export interface Grade {
  id: string
  user_id: string
  subject_id: string
  title: string
  date: string // "JJJJ-MM-TT"
  grade: number // 1–6
  weight: number // 1 = normal
  created_at: string
}

/** Was das Noten-Formular beim Speichern übergibt. */
export interface GradeInput {
  subject_id: string
  title: string
  date: string
  grade: number
  weight: number
}

/** Was das Formular beim Speichern eines Eintrags übergibt. */
export interface EntryInput {
  title: string
  category: Category
  subject_id: string | null
  date: string
  start_time: string | null // "HH:MM"
  end_time: string | null
  notes: string | null
  done: boolean
}

/** Eine Lernzeit im Formular (id fehlt, wenn sie neu ist). */
export interface StudyBlockInput {
  id?: string
  date: string // "JJJJ-MM-TT"
  start: string // "HH:MM"
  end: string // "HH:MM"
  done: boolean
}

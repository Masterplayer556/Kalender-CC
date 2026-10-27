// Datentypen – entsprechen den Tabellen in supabase/migrations/001_init.sql

export type Category = 'test' | 'aufgabe' | 'event' | 'sonstiges'

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
  end_date: string | null // letzter Tag bei mehrtägigen Einträgen (dann ganztägig), sonst null
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
  entry_id: string | null // optional verknüpfter Test
  created_at: string
}

/** Was das Noten-Formular beim Speichern übergibt. */
export interface GradeInput {
  subject_id: string
  title: string
  date: string
  grade: number
  weight: number
  entry_id: string | null
}

/** Anhang an einem Eintrag: hochgeladene Datei oder Link */
export interface Attachment {
  id: string
  user_id: string
  entry_id: string
  kind: 'file' | 'link'
  name: string
  url: string | null // nur bei Links
  storage_path: string | null // nur bei Dateien
  size: number | null
  mime: string | null
  created_at: string
}

/** Anhang im Formular, der noch nicht gespeichert ist */
export type PendingAttachment =
  | { kind: 'file'; file: File; name: string }
  | { kind: 'link'; url: string; name: string }

/** Was das Formular beim Speichern eines Eintrags übergibt. */
export interface EntryInput {
  title: string
  category: Category
  subject_id: string | null
  date: string
  end_date: string | null
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

/** Art eines Zeitraums: Ferien, einzelne schulfreie Tage, Lager/Reise/Projektwoche */
export type PeriodKind = 'ferien' | 'frei' | 'lager'

/** Zeitraum über mehrere Tage, z. B. "Herbstferien" vom 03.10. bis 18.10. (beide Tage inklusive) */
export interface Period {
  id: string
  user_id: string
  name: string
  kind: PeriodKind
  start_date: string // "JJJJ-MM-TT"
  end_date: string // "JJJJ-MM-TT", gleich oder nach start_date
  created_at: string
}

/** Was das Zeitraum-Formular beim Speichern übergibt. */
export interface PeriodInput {
  name: string
  kind: PeriodKind
  start_date: string
  end_date: string
}

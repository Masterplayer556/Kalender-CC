// Offline-Zwischenspeicher: Die zuletzt geladenen Daten werden im Browser (localStorage)
// abgelegt, damit die App sie ohne Internet anzeigen kann.

import type { Attachment, Entry, Grade, Period, StudyBlock, Subject } from '../types'

export interface Snapshot {
  subjects: Subject[]
  grades?: Grade[] // optional: ältere Zwischenspeicher haben noch keine Noten
  gradesMissing?: boolean
  attachments?: Attachment[] // optional: ältere Zwischenspeicher haben noch keine Anhänge
  periods?: Period[] // optional: ältere Zwischenspeicher haben noch keine Zeiträume
  periodsMissing?: boolean
  entries: Entry[]
  blocks: StudyBlock[]
  savedAt: string // ISO-Zeitpunkt des letzten erfolgreichen Ladens
}

const key = (userId: string) => `kalender-cache:${userId}`

export function loadSnapshot(userId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(key(userId))
    return raw ? (JSON.parse(raw) as Snapshot) : null
  } catch {
    return null // z. B. privater Modus oder kaputte Daten → einfach ohne Cache weiter
  }
}

export function saveSnapshot(userId: string, data: Snapshot): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(data))
  } catch {
    // Speicher voll oder gesperrt – die App funktioniert online trotzdem.
  }
}

export function clearSnapshot(userId: string): void {
  try {
    localStorage.removeItem(key(userId))
  } catch {
    /* ignorieren */
  }
}

/** Kleine Helfer für Einstellungen (z. B. Filter), ebenfalls fehlertolerant. */
export function loadPref<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`kalender-pref:${name}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function savePref(name: string, value: unknown): void {
  try {
    localStorage.setItem(`kalender-pref:${name}`, JSON.stringify(value))
  } catch {
    /* ignorieren */
  }
}

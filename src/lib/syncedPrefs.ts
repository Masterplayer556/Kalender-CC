// Einstellungen, die auf allen Geräten gleich sein sollen (Tabelle user_prefs, Migration 009).
// Zusätzlich liegen sie im localStorage: für den Start ohne Internet und damit beim Öffnen nichts aufblitzt.
// Offline geänderte Werte warten in einer Liste "ausstehend" und werden beim nächsten Laden hochgeladen.
//
// Bewusst NICHT synchronisiert (gehören zum jeweiligen Gerät bzw. zur aktuellen Ansicht):
// Filter, zuletzt benutzte Kalender-Ansicht, gewähltes Noten-Semester.

import { loadPref, savePref } from './cache'
import type { Targets } from './targets'

export interface SyncedPrefs {
  gradeTargets?: Targets // Notenziele pro Fach und für den Gesamtschnitt
  theme?: string // Design: sunset | neon
  themeMode?: string // auto | light | dark
  showDone?: boolean // Liste "Als Nächstes": Erledigte anzeigen
  heatmapOpenOnly?: boolean // Heatmap: nur Offenes zählen
}
export type PrefName = keyof SyncedPrefs

export const SYNCED_PREFS: PrefName[] = ['gradeTargets', 'theme', 'themeMode', 'showDone', 'heatmapOpenOnly']

/** Stand dieses Geräts (localStorage) */
export function loadLocalPrefs(): SyncedPrefs {
  const prefs: Record<string, unknown> = {}
  for (const name of SYNCED_PREFS) {
    const v = loadPref<unknown>(name, undefined)
    if (v !== undefined) prefs[name] = v
  }
  return prefs as SyncedPrefs
}

export function saveLocalPrefs(prefs: SyncedPrefs): void {
  for (const name of SYNCED_PREFS) if (prefs[name] !== undefined) savePref(name, prefs[name])
}

const pendingKey = (userId: string) => `prefs-pending:${userId}`
export const loadPending = (userId: string) => loadPref<SyncedPrefs>(pendingKey(userId), {})
export const savePending = (userId: string, pending: SyncedPrefs) => savePref(pendingKey(userId), pending)

/** Zeilen aus der Datenbank → Einstellungen (unbekannte Namen werden ignoriert). */
export function prefsFromRows(rows: { name: string; value: unknown }[]): SyncedPrefs {
  const prefs: Record<string, unknown> = {}
  for (const r of rows) if ((SYNCED_PREFS as string[]).includes(r.name)) prefs[r.name] = r.value
  return prefs as SyncedPrefs
}

/**
 * Neuer Stand nach dem Laden: Der Server gewinnt, ausser bei Werten, die auf diesem Gerät noch nicht
 * hochgeladen sind (pending) oder während des Ladens geändert wurden (changedMeanwhile).
 */
export function mergePrefs(
  current: SyncedPrefs,
  server: SyncedPrefs,
  pending: SyncedPrefs,
  changedMeanwhile: Set<PrefName>,
): SyncedPrefs {
  const next: Record<string, unknown> = { ...current }
  for (const name of SYNCED_PREFS) {
    if (name in pending) next[name] = pending[name]
    else if (changedMeanwhile.has(name)) continue
    else if (name in server) next[name] = server[name]
  }
  return next as SyncedPrefs
}

/**
 * Einmalige Übernahme: Was auf diesem Gerät eingestellt ist, aber auf dem Server noch fehlt
 * (z. B. Notenziele von früher, als sie nur lokal gespeichert wurden), wird hochgeladen.
 */
export function missingOnServer(local: SyncedPrefs, server: SyncedPrefs): SyncedPrefs {
  const missing: Record<string, unknown> = {}
  for (const name of SYNCED_PREFS) {
    // Das Design speichert jedes Gerät von selbst (auch ohne Auswahl) → erst übernehmen, wenn es aktiv gewählt wird
    if (name === 'theme' || name === 'themeMode') continue
    if (local[name] !== undefined && !(name in server)) missing[name] = local[name]
  }
  return missing as SyncedPrefs
}

/** Ausstehende Werte entfernen, die inzwischen hochgeladen sind (und seither nicht erneut geändert wurden). */
export function withoutUploaded(pending: SyncedPrefs, uploaded: SyncedPrefs): SyncedPrefs {
  const rest: Record<string, unknown> = { ...pending }
  for (const name of Object.keys(uploaded) as PrefName[])
    if (JSON.stringify(rest[name]) === JSON.stringify(uploaded[name])) delete rest[name]
  return rest as SyncedPrefs
}

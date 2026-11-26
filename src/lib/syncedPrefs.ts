// Einstellungen, die auf allen Geräten gleich sein sollen (Tabelle user_prefs, Migration 009/010).
// Zusätzlich liegen sie im localStorage: für den Start ohne Internet und damit beim Öffnen nichts aufblitzt –
// pro Benutzer ("kalender-pref:<user-id>:<name>"), damit auf einem geteilten Gerät niemand die
// Einstellungen (Filter, Notenziele …) eines anderen sieht.
// Offline geänderte Werte warten in einer Liste "ausstehend" und werden beim nächsten Laden hochgeladen.
//
// Jede Einstellung ist eine eigene Zeile mit dem Zeitpunkt der Änderung; Notenziele sogar eine Zeile pro
// Fach ("gradeTarget:<fach-id>"). Beim Zusammenführen gewinnt pro Zeile die neuere Änderung – so
// überschreibt ein Gerät nicht mehr, was ein anderes inzwischen an einer anderen Stelle geändert hat.

import { hasPref, loadPref, removePref, savePref } from './cache'
import type { Filters } from './filters'
import { asTargets, type Targets } from './targets'

export interface SyncedPrefs {
  gradeTargets?: Targets // Notenziele pro Fach und für den Gesamtschnitt
  theme?: string // Design: sunset | neon
  themeMode?: string // auto | light | dark
  showDone?: boolean // Liste "Als Nächstes": Erledigte anzeigen
  heatmapOpenOnly?: boolean // Heatmap: nur Offenes zählen
  filters?: Filters // Filter nach Kategorie und Fach
  calendarView?: string // zuletzt benutzte Kalender-Ansicht (monat, woche …)
  gradeSemester?: string // gewähltes Semester im Noten-Tab, z. B. "2026-1"
}
export type PrefName = keyof SyncedPrefs

export const SYNCED_PREFS: PrefName[] = [
  'gradeTargets',
  'theme',
  'themeMode',
  'showDone',
  'heatmapOpenOnly',
  'filters',
  'calendarView',
  'gradeSemester',
]

const localKey = (userId: string, name: PrefName) => `${userId}:${name}`

/**
 * Früher lagen die Einstellungen ohne Benutzer im localStorage ("kalender-pref:<name>"). Sie gehen einmalig an
 * den ersten Benutzer, der sich danach anmeldet, und werden dann entfernt. Design (theme/themeMode) bleibt:
 * Das ist die Einstellung des Geräts (auch für die Anmeldeseite, siehe lib/theme.ts).
 */
function adoptLegacyPrefs(userId: string): void {
  for (const name of SYNCED_PREFS) {
    if (name === 'theme' || name === 'themeMode' || !hasPref(name)) continue
    if (!hasPref(localKey(userId, name))) savePref(localKey(userId, name), loadPref<unknown>(name, undefined))
    removePref(name)
  }
}

/** Stand dieses Geräts (localStorage) für diesen Benutzer */
export function loadLocalPrefs(userId: string): SyncedPrefs {
  adoptLegacyPrefs(userId)
  const prefs: Record<string, unknown> = {}
  for (const name of SYNCED_PREFS) {
    const v = loadPref<unknown>(localKey(userId, name), undefined)
    if (v !== undefined) prefs[name] = v
  }
  return prefs as SyncedPrefs
}

export function saveLocalPrefs(userId: string, prefs: SyncedPrefs): void {
  for (const name of SYNCED_PREFS) if (prefs[name] !== undefined) savePref(localKey(userId, name), prefs[name])
}

const pendingKey = (userId: string) => `prefs-pending:${userId}`

/** Zeilenname eines Notenziels: "gradeTarget:<fach-id>" bzw. "gradeTarget:gesamt" */
export const TARGET_ROW = 'gradeTarget:'
/** Wert eines entfernten Notenziels (die Zeile bleibt, damit auch das Entfernen einen Zeitpunkt hat) */
export const NO_TARGET = false

/** Einstellungen als einzelne Zeilen: Name → Wert */
export type PrefRows = Record<string, unknown>
/** Wert mit Zeitpunkt der Änderung (ms seit 1970) */
export interface Stamped {
  value: unknown
  at: number
}
export type StampedRows = Record<string, Stamped>

const isTargetRow = (name: string) => name.startsWith(TARGET_ROW)
const isKnownRow = (name: string) => isTargetRow(name) || ((SYNCED_PREFS as string[]).includes(name) && name !== 'gradeTargets')

/** Einstellungen → einzelne Zeilen (Notenziele pro Fach) */
export function toRows(prefs: SyncedPrefs): PrefRows {
  const rows: PrefRows = {}
  for (const name of SYNCED_PREFS) {
    if (prefs[name] === undefined) continue
    if (name === 'gradeTargets') for (const [k, v] of Object.entries(asTargets(prefs.gradeTargets))) rows[TARGET_ROW + k] = v
    else rows[name] = prefs[name]
  }
  return rows
}

/** Einzelne Zeilen → Einstellungen (unbekannte Namen und entfernte Ziele fallen weg) */
export function fromRows(rows: PrefRows): SyncedPrefs {
  const prefs: Record<string, unknown> = {}
  let targets: Targets | undefined
  for (const [name, value] of Object.entries(rows)) {
    if (isTargetRow(name)) {
      targets ??= {}
      if (typeof value === 'number') targets[name.slice(TARGET_ROW.length)] = value
    } else if (isKnownRow(name)) prefs[name] = value
  }
  if (targets) prefs.gradeTargets = targets
  return prefs as SyncedPrefs
}

/** Welche Zeilen eine Änderung betrifft: bei Notenzielen nur die Fächer, deren Ziel sich geändert hat. */
export function changedRows<K extends PrefName>(name: K, before: SyncedPrefs[K], after: SyncedPrefs[K]): PrefRows {
  if (name !== 'gradeTargets') return { [name]: after }
  const a = asTargets(before)
  const b = asTargets(after)
  const rows: PrefRows = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) rows[TARGET_ROW + k] = b[k] ?? NO_TARGET
  return rows
}

export const stamp = (rows: PrefRows, at: number): StampedRows =>
  Object.fromEntries(Object.entries(rows).map(([name, value]) => [name, { value, at }]))

function isStamped(v: unknown): v is Stamped {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'value' in v && typeof (v as Stamped).at === 'number'
}

/** Ausstehende Änderungen lesen; der alte Speicherstand (Name → Wert, ohne Zeitpunkt) wird übernommen. */
export function normalizePending(raw: unknown, now: number): StampedRows {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const rows: StampedRows = {}
  for (const [name, v] of Object.entries(raw)) {
    if (isStamped(v)) rows[name] = v
    else if (name === 'gradeTargets') Object.assign(rows, stamp(toRows({ gradeTargets: asTargets(v) }), now))
    else rows[name] = { value: v, at: now }
  }
  return rows
}

export const loadPending = (userId: string) => normalizePending(loadPref<unknown>(pendingKey(userId), {}), Date.now())
export const savePending = (userId: string, pending: StampedRows) => savePref(pendingKey(userId), pending)

/**
 * Zeilen aus der Datenbank → Werte mit Zeitpunkt (unbekannte Namen werden ignoriert).
 * Ältere App-Versionen speichern alle Notenziele als ein Objekt ("gradeTargets"): Das gilt für jedes Fach
 * (fehlt eines darin, ist sein Ziel entfernt) – ausser, es gibt eine neuere Zeile für dieses Fach.
 * knownTargets: weitere Fächer mit Ziel, die dieses Gerät kennt.
 */
export function serverRows(rows: { name: string; value: unknown; updated_at?: string | null }[], knownTargets: string[] = []): StampedRows {
  const result: StampedRows = {}
  let legacy: Stamped | undefined
  for (const r of rows) {
    const at = Date.parse(r.updated_at ?? '') || 0
    if (r.name === 'gradeTargets') legacy = { value: r.value, at }
    else if (isKnownRow(r.name)) result[r.name] = { value: r.value, at }
  }
  if (legacy) {
    const old = asTargets(legacy.value)
    const keys = new Set([
      ...Object.keys(old),
      ...knownTargets,
      ...Object.keys(result).filter(isTargetRow).map((n) => n.slice(TARGET_ROW.length)),
    ])
    for (const k of keys) {
      const name = TARGET_ROW + k
      if (!result[name] || result[name].at < legacy.at) result[name] = { value: old[k] ?? NO_TARGET, at: legacy.at }
    }
  }
  return result
}

/**
 * Neuer Stand nach dem Laden, pro Zeile: Die neuere Änderung gewinnt – noch nicht hochgeladene (pending)
 * gegen den Server. Sonst gewinnt der Server, ausser bei Zeilen, die während des Ladens geändert wurden.
 */
export function mergePrefs(
  current: SyncedPrefs,
  server: StampedRows,
  pending: StampedRows,
  changedMeanwhile: Set<string>,
): SyncedPrefs {
  const rows = toRows(current)
  for (const name of new Set([...Object.keys(server), ...Object.keys(pending)])) {
    const p = pending[name]
    const s = server[name]
    if (p && (!s || p.at >= s.at)) rows[name] = p.value
    else if (changedMeanwhile.has(name)) continue
    else if (s) rows[name] = s.value
  }
  const next = { ...current, ...fromRows(rows) }
  if (!Object.keys(rows).some(isTargetRow)) delete next.gradeTargets
  return next
}

/**
 * Einmalige Übernahme: Was auf diesem Gerät eingestellt ist, aber auf dem Server noch fehlt
 * (z. B. Notenziele von früher, als sie nur lokal gespeichert wurden), wird hochgeladen.
 */
export function missingOnServer(local: SyncedPrefs, server: StampedRows): PrefRows {
  const missing: PrefRows = {}
  for (const [name, value] of Object.entries(toRows(local))) {
    // Das Design speichert jedes Gerät von selbst (auch ohne Auswahl) → erst übernehmen, wenn es aktiv gewählt wird
    if (name === 'theme' || name === 'themeMode') continue
    if (!(name in server)) missing[name] = value
  }
  return missing
}

/** Ausstehende Werte entfernen, die inzwischen hochgeladen sind (und seither nicht erneut geändert wurden). */
export function withoutUploaded(pending: StampedRows, uploaded: StampedRows): StampedRows {
  const rest: StampedRows = { ...pending }
  for (const name of Object.keys(uploaded)) if (rest[name]?.at === uploaded[name].at) delete rest[name]
  return rest
}

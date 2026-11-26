// Offline-Warteschlange ("Postausgang") für Änderungen an Einträgen und Lernzeiten.
//
// Ohne Internet (oder wenn eine Anfrage am Netz scheitert) landen Abhaken und Speichern eines Eintrags
// hier. Die App zeigt die Änderung sofort an (applyOutbox legt sie über die geladenen Daten) und schickt
// sie nach, sobald wieder Internet da ist (DataProvider). Gespeichert im localStorage, übersteht also
// auch das Schliessen der App.
//
// Konflikte (jemand hat denselben Eintrag inzwischen auf einem anderen Gerät geändert):
// - Gelöscht auf dem Server → der Server gewinnt, die Offline-Änderung entfällt.
// - Geändert auf dem Server → die neuere Änderung gewinnt. Jede Änderung merkt sich `base`, den Stand
//   (updated_at), den das Gerät zuletzt vom Server kannte. Ist die Zeile auf dem Server noch auf diesem
//   Stand, gibt es keinen Konflikt. Sonst zählt die Uhrzeit: Offline-Änderung (`at`) gegen Server-Änderung.
//
// Nicht offline möglich (bewusst): Anhänge, Löschen, Noten, Fächer, Ferien – die brauchen weiter Internet.

import type { Entry, EntryInput, StudyBlock } from '../types'

/** Lernzeit, wie sie gespeichert wird (Zeitpunkte als ISO-Text) */
export interface BlockRow {
  id: string
  starts_at: string
  ends_at: string
  done: boolean
}

interface OpBase {
  key: string // eindeutig pro Eintrag in der Warteschlange
  at: number // Zeitpunkt der Änderung auf dem Gerät (ms)
  base?: string // updated_at der Zeile, wie das Gerät sie zuletzt vom Server kannte
}

export type OutboxOp =
  | (OpBase & { kind: 'entryDone'; id: string; done: boolean })
  | (OpBase & { kind: 'blockDone'; id: string; done: boolean })
  | (OpBase & {
      kind: 'saveEntry'
      id: string
      create: boolean
      entry: EntryInput
      blocks: BlockRow[] // alle Lernzeiten des Eintrags (wie im Formular)
      removedBlockIds: string[]
    })

export type SaveEntryOp = Extract<OutboxOp, { kind: 'saveEntry' }>

/** Gespeicherten Wert prüfen (localStorage kann alte oder kaputte Daten enthalten) */
export function asOutbox(value: unknown): OutboxOp[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (op): op is OutboxOp =>
      !!op &&
      typeof op === 'object' &&
      typeof op.key === 'string' &&
      typeof op.id === 'string' &&
      typeof op.at === 'number' &&
      (((op.kind === 'entryDone' || op.kind === 'blockDone') && typeof op.done === 'boolean') ||
        (op.kind === 'saveEntry' && !!op.entry && Array.isArray(op.blocks) && Array.isArray(op.removedBlockIds))),
  )
}

/** Gehört die Lernzeit zu dieser Speicher-Änderung (gespeichert oder entfernt)? */
function touchesBlock(op: SaveEntryOp, blockId: string): boolean {
  return op.blocks.some((b) => b.id === blockId) || op.removedBlockIds.includes(blockId)
}

/**
 * Änderung in die Warteschlange aufnehmen. Zusammenfassen, was sich überholt hat:
 * - Abhaken eines Eintrags bzw. einer Lernzeit, die in einer wartenden Speicher-Änderung steckt,
 *   wird in diese eingerechnet (sonst käme sie vor dem Anlegen an).
 * - Speichern ersetzt frühere Speicher-Änderungen und frühere Haken desselben Eintrags (es enthält den
 *   ganzen Stand des Formulars); ein noch nicht angelegter Eintrag bleibt "neu".
 * - Mehrmals Abhaken derselben Sache: nur die letzte zählt.
 * `inflight`: Diese Änderung wird gerade gesendet – sie bleibt unangetastet; was sie ändern würde,
 * kommt als neue Änderung dazu.
 */
export function enqueue(queue: OutboxOp[], op: OutboxOp, inflight?: string): OutboxOp[] {
  const editable = (o: OutboxOp) => o.key !== inflight
  const saveFor = (pred: (o: SaveEntryOp) => boolean) =>
    [...queue].reverse().find((o): o is SaveEntryOp => o.kind === 'saveEntry' && pred(o))

  // Welche wartende Speicher-Änderung betrifft diese Änderung?
  const pending =
    op.kind === 'blockDone' ? saveFor((o) => o.blocks.some((b) => b.id === op.id)) : saveFor((o) => o.id === op.id)

  if (pending && op.kind !== 'saveEntry') {
    const merged: SaveEntryOp =
      op.kind === 'entryDone'
        ? { ...pending, entry: { ...pending.entry, done: op.done }, at: op.at }
        : { ...pending, blocks: pending.blocks.map((b) => (b.id === op.id ? { ...b, done: op.done } : b)), at: op.at }
    return editable(pending) ? queue.map((o) => (o === pending ? merged : o)) : [...queue, { ...merged, key: op.key }]
  }

  if (op.kind === 'saveEntry') {
    const created = queue.some((o) => o.kind === 'saveEntry' && o.id === op.id && o.create)
    const merged: SaveEntryOp = {
      ...op,
      create: op.create || created,
      base: pending ? pending.base : op.base,
      removedBlockIds: [...new Set([...(pending?.removedBlockIds ?? []), ...op.removedBlockIds])].filter(
        (id) => !op.blocks.some((b) => b.id === id),
      ),
    }
    const superseded = (o: OutboxOp) =>
      editable(o) &&
      ((o.kind === 'saveEntry' && o.id === op.id) ||
        (o.kind === 'entryDone' && o.id === op.id) ||
        (o.kind === 'blockDone' && touchesBlock(merged, o.id)))
    return [...queue.filter((o) => !superseded(o)), merged]
  }

  // Abhaken ohne wartende Speicher-Änderung: frühere Haken derselben Sache ersetzen
  return [...queue.filter((o) => !(editable(o) && o.kind === op.kind && o.id === op.id)), op]
}

/** Änderung aus der Warteschlange nehmen (nach dem Senden) */
export function dequeue(queue: OutboxOp[], key: string): OutboxOp[] {
  return queue.filter((o) => o.key !== key)
}

/**
 * Ab welchem Server-Stand gilt eine Offline-Änderung als überholt? Ist die Zeile auf dem Server neuer als
 * dieser Zeitpunkt, gewinnt der Server. = der spätere von `base` und `at`:
 * - Server noch auf Stand `base` → nicht neuer → Offline-Änderung gilt (egal, wie die Uhren gehen).
 * - Server seit `base` geändert → gilt, wenn diese Änderung später als `at` war.
 * `base` bleibt als Text erhalten (Postgres speichert Mikrosekunden, JavaScript nur Millisekunden).
 */
export function conflictThreshold(op: Pick<OpBase, 'at' | 'base'>): string {
  if (op.base) {
    const base = Date.parse(op.base)
    if (!Number.isNaN(base) && base >= op.at) return op.base
  }
  return new Date(op.at).toISOString()
}

/**
 * Wartende Änderungen über die (geladenen) Daten legen, damit sie sofort sichtbar sind.
 * Neue Einträge erscheinen erst, wenn sie gespeichert werden; geänderte Zeilen behalten ihr updated_at.
 */
export function applyOutbox(
  data: { entries: Entry[]; blocks: StudyBlock[] },
  ops: OutboxOp[],
  userId: string,
): { entries: Entry[]; blocks: StudyBlock[] } {
  if (ops.length === 0) return data
  let entries = data.entries
  let blocks = data.blocks
  let added = false
  for (const op of ops) {
    if (op.kind === 'entryDone') {
      entries = entries.map((e) => (e.id === op.id ? { ...e, done: op.done } : e))
    } else if (op.kind === 'blockDone') {
      blocks = blocks.map((b) => (b.id === op.id ? { ...b, done: op.done } : b))
    } else {
      const existing = entries.find((e) => e.id === op.id)
      if (!existing && !op.create) continue // inzwischen gelöscht: der Server gewinnt
      const row: Entry = {
        ...(existing ?? { id: op.id, user_id: userId, created_at: new Date(op.at).toISOString(), updated_at: '' }),
        ...op.entry,
        start_time: op.entry.start_time && op.entry.start_time.length === 5 ? `${op.entry.start_time}:00` : op.entry.start_time,
        end_time: op.entry.end_time && op.entry.end_time.length === 5 ? `${op.entry.end_time}:00` : op.entry.end_time,
      }
      if (existing) entries = entries.map((e) => (e.id === op.id ? row : e))
      else {
        entries = [...entries, row]
        added = true
      }
      const gone = new Set([...op.removedBlockIds, ...op.blocks.map((b) => b.id)])
      const kept = blocks.filter((b) => !(b.entry_id === op.id && gone.has(b.id)))
      const old = new Map(blocks.map((b) => [b.id, b]))
      blocks = [
        ...kept,
        ...op.blocks.map((b) => ({ ...(old.get(b.id) ?? { user_id: userId }), ...b, entry_id: op.id }) as StudyBlock),
      ]
      added = true
    }
  }
  // Wie vom Server sortiert (nach Datum, dann id), damit neue Zeilen an der richtigen Stelle stehen
  if (added) {
    entries = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    blocks = [...blocks].sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id))
  }
  return { entries, blocks }
}

/**
 * Lohnt sich ein neuer Versuch? Ja bei Netz- und Anmeldeproblemen (gehen von selbst vorbei),
 * nein bei Fehlern der Daten selbst (z. B. verletzte Regel) – die würden die Warteschlange sonst für immer blockieren.
 */
export function isRetryable(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const e = err as { message?: unknown; code?: unknown; status?: unknown; name?: unknown } | null
  const msg = String(e?.message ?? err ?? '')
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout|timed out|aborted/i.test(msg)) return true
  if (/jwt|refresh token|session (missing|expired)|not authenticated/i.test(msg)) return true
  if (e?.name === 'TypeError' || e?.name === 'AbortError') return true
  const code = typeof e?.code === 'string' ? e.code : ''
  if (/^PGRST00\d$/.test(code) || code === '57014' || code === '53300' || code === '08006') return true // Verbindung/Server
  const status = typeof e?.status === 'number' ? e.status : 0
  return status >= 500 || status === 401 || status === 408 || status === 429
}

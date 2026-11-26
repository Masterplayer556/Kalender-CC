// Senden der Offline-Warteschlange (lib/outbox.ts) an Supabase und Text für den Hinweis danach.

import * as api from './api'
import { conflictThreshold, type OutboxOp } from '../lib/outbox'

/**
 * Eine wartende Änderung senden. true = übernommen; false = entfallen, weil der Eintrag bzw. die Lernzeit
 * inzwischen gelöscht oder auf dem Server neuer ist (der Server gewinnt). Fehler werden weitergegeben.
 */
export async function sendOutboxOp(op: OutboxOp): Promise<boolean> {
  const notAfter = conflictThreshold(op)
  if (op.kind === 'saveEntry') {
    const result = await api.saveEntryRows(
      { id: op.id, create: op.create },
      op.entry,
      op.blocks,
      op.removedBlockIds,
      op.create ? undefined : notAfter,
    )
    return result === 'saved'
  }
  return api.setDoneIfUnchanged(op.kind === 'entryDone' ? 'entries' : 'study_blocks', op.id, op.done, notAfter)
}

/** Hinweis nach dem Senden: was nicht übernommen wurde (null = alles gut) */
export function outboxNotice(skipped: number, failed: string[]): string | null {
  const parts: string[] = []
  if (skipped === 1)
    parts.push('Eine offline gemachte Änderung wurde nicht übernommen: Der Eintrag wurde inzwischen auf einem anderen Gerät geändert oder gelöscht.')
  else if (skipped > 1)
    parts.push(`${skipped} offline gemachte Änderungen wurden nicht übernommen: Die Einträge wurden inzwischen auf einem anderen Gerät geändert oder gelöscht.`)
  for (const msg of failed) parts.push(`Eine offline gemachte Änderung konnte nicht gespeichert werden: ${msg}`)
  return parts.length ? parts.join(' ') : null
}

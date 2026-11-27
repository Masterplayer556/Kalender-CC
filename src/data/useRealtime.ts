// Supabase Realtime: Ändert sich auf einem anderen Gerät etwas, meldet der Server es sofort, und die App
// lädt nur die betroffene Tabelle nach (statt erst beim nächsten App-Wechsel alles).
//
// - RLS gilt auch hier: Gemeldet werden nur Änderungen an eigenen Zeilen (bei Löschungen nur die id).
// - Ist die App länger als 30 s im Hintergrund, wird die Verbindung geschlossen (spart Akku). Kommt die
//   App zurück, verbindet sie neu und lädt einmal alles, weil sie in der Zwischenzeit nichts gehört hat.
// - Bricht die Verbindung ab (z. B. iOS friert die App kurz ein) und steht sie danach wieder, wird
//   ebenfalls einmal alles geladen.
// - Ohne Realtime (Migration 014 fehlt, Server nicht erreichbar) lädt die App wie früher beim
//   Zurückkehren neu (höchstens alle 30 s, lib/refresh.ts).

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { RETURN_RELOAD_GAP_MS } from '../lib/refresh'

/** Tabellen dieser App (siehe supabase/migrations/014_realtime.sql) */
export const REALTIME_TABLES = ['subjects', 'entries', 'study_blocks', 'grades', 'attachments', 'periods', 'bm_ratings', 'user_prefs'] as const
export type RealtimeTable = (typeof REALTIME_TABLES)[number]

/** So lange darf die App im Hintergrund sein, bevor die Verbindung geschlossen wird */
const CLOSE_AFTER_HIDDEN_MS = RETURN_RELOAD_GAP_MS

export function useRealtime({
  userId,
  onChange,
  onCatchUp,
}: {
  userId: string
  /** Eine Tabelle hat sich geändert */
  onChange: (table: RealtimeTable) => void
  /**
   * Es könnten Änderungen verpasst worden sein: Nach einer Unterbrechung (force = true) bzw. beim
   * Zurückkehren in die App ohne laufende Verbindung (force = false: höchstens alle 30 s).
   */
  onCatchUp: (force: boolean) => void
}): void {
  // Aktuelle Rückrufe, ohne dass die Verbindung bei jeder neuen Funktion neu aufgebaut wird
  const handlers = useRef({ onChange, onCatchUp })
  useEffect(() => {
    handlers.current = { onChange, onCatchUp }
  }, [onChange, onCatchUp])

  useEffect(() => {
    let channel: RealtimeChannel | null = null
    let live = false // Verbindung steht und meldet Änderungen
    let wasLive = false // stand schon einmal → nach einem Abbruch muss nachgeladen werden
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    let hiddenAt: number | null = null

    const open = () => {
      if (channel) return
      wasLive = false
      const ch = supabase.channel(`kalender:${userId}`)
      for (const table of REALTIME_TABLES) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => handlers.current.onChange(table))
      }
      ch.subscribe((status) => {
        if (channel !== ch) return // inzwischen geschlossen
        if (status === 'SUBSCRIBED') {
          if (wasLive) handlers.current.onCatchUp(true) // nach Unterbrechung wieder verbunden
          live = wasLive = true
        } else {
          live = false // CHANNEL_ERROR, TIMED_OUT, CLOSED: realtime-js verbindet selbst neu
        }
      })
      channel = ch
    }
    const close = () => {
      if (!channel) return
      const ch = channel
      channel = null
      live = false
      void supabase.removeChannel(ch)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        clearTimeout(closeTimer)
        closeTimer = setTimeout(close, CLOSE_AFTER_HIDDEN_MS)
        return
      }
      clearTimeout(closeTimer)
      // Zu lange weg (Timer kann auf iOS eingefroren gewesen sein) → Verbindung gilt als verpasst
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt
      hiddenAt = null
      if (away >= CLOSE_AFTER_HIDDEN_MS) close()
      const missed = !live
      open()
      if (missed) handlers.current.onCatchUp(false)
    }

    if (document.visibilityState === 'visible') open()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimeout(closeTimer)
      close()
    }
  }, [userId])
}

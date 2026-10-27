import { createClient } from '@supabase/supabase-js'

// Die Werte kommen aus der Datei ".env" (lokal) bzw. aus den GitHub-Secrets (beim Veröffentlichen).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false, wenn die .env-Datei fehlt – dann zeigt die App eine Einrichtungs-Hilfe. */
export const supabaseConfigured = Boolean(url && anonKey)

// "||" statt "??": GitHub setzt ein fehlendes Secret als leeren Text "" ein, nicht als undefined.
export const supabase = createClient(url || 'http://localhost', anonKey || 'fehlt', {
  auth: {
    persistSession: true, // Login bleibt nach dem Schließen der App erhalten
    autoRefreshToken: true,
  },
})

/** Technische Fehlermeldungen in verständliches Deutsch übersetzen. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err)
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg))
    return 'Keine Verbindung zum Server. Bist du online? (Falls ja: Ist das Supabase-Projekt pausiert? Siehe README.)'
  if (/invalid login credentials/i.test(msg)) return 'E-Mail oder Passwort ist falsch.'
  if (/email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail-Adresse (Link im Postfach).'
  if (/user already registered/i.test(msg)) return 'Für diese E-Mail gibt es schon ein Konto. Bitte anmelden.'
  if (/password should be at least/i.test(msg)) return 'Das Passwort ist zu kurz (mindestens 6 Zeichen).'
  if (/signups not allowed|signup is disabled/i.test(msg)) return 'Neue Konten sind in Supabase deaktiviert.'
  if (/jwt|refresh token|session (missing|expired)/i.test(msg))
    return 'Deine Anmeldung ist abgelaufen. Bitte ab- und wieder anmelden.'
  if (/entries_category_check/i.test(msg))
    return 'Für Events braucht die Datenbank ein Update: Führe supabase/migrations/004_events_and_periods.sql im Supabase SQL Editor aus (siehe README).'
  if (/could not find the table 'public\.periods'/i.test(msg))
    return 'Für Ferien & freie Tage braucht die Datenbank ein Update: Führe supabase/migrations/004_events_and_periods.sql im Supabase SQL Editor aus (siehe README).'
  if (/periods_order/i.test(msg)) return 'Das Ende muss am oder nach dem Beginn liegen.'
  if (/grades_entry_unique/i.test(msg)) return 'Dieser Test hat schon eine Note. Bearbeite die bestehende Note.'
  if (/exceeded the maximum allowed size|payload too large|413/i.test(msg)) return 'Die Datei ist zu gross (maximal 50 MB).'
  if (/grades_subject_fk/i.test(msg))
    return 'Dieses Fach hat noch Noten. Lösche zuerst die Noten oder behalte das Fach.'
  if (/rate limit/i.test(msg)) return 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.'
  return msg
}

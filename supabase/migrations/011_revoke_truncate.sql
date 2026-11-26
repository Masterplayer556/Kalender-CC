-- =====================================================================
-- Kalender-Tracker: überflüssige Rechte auf den Tabellen entfernen
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Nach 010_user_prefs_newer_wins.sql.) Daten bleiben unverändert.
--
-- Supabase gibt neuen Tabellen standardmässig ALLE Rechte, auch TRUNCATE (ganze Tabelle auf einmal
-- leeren – ohne Zeilen-Regeln/RLS!), TRIGGER und REFERENCES. Die App braucht nur select, insert,
-- update und delete (siehe die grant-Zeilen in 001–009). Nur die Tabellen dieser App – andere
-- Tabellen im selben Projekt bleiben unberührt.
-- =====================================================================

revoke truncate, trigger, references on
  public.subjects,
  public.entries,
  public.study_blocks,
  public.grades,
  public.attachments,
  public.periods,
  public.bm_ratings,
  public.user_prefs
from anon, authenticated;

-- =====================================================================
-- Kalender-Tracker: Änderungen sofort auf allen Geräten (Supabase Realtime)
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run. (Nach 001–013.)
--
-- Nimmt die Tabellen dieser App in die Realtime-Publication auf: Ändert sich etwas (z. B. auf dem iPad),
-- erfährt es das offene iPhone sofort und lädt nur die betroffene Tabelle neu. Die RLS-Regeln gelten
-- auch hier: Jedes Gerät bekommt nur Änderungen an den eigenen Zeilen (bei Löschungen nur die id).
-- Nur die Tabellen dieser App – andere Tabellen im selben Projekt bleiben unberührt.
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array['subjects', 'entries', 'study_blocks', 'grades', 'attachments', 'periods', 'bm_ratings', 'user_prefs']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

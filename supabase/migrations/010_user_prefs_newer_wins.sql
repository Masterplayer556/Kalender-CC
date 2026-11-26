-- =====================================================================
-- Kalender-Tracker: Einstellungen – die neuere Änderung gewinnt
-- Die App schickt bei jeder Einstellung den Zeitpunkt der Änderung (updated_at) mit.
-- Ist die Zeile auf dem Server schon neuer (z. B. auf einem anderen Gerät geändert, während
-- dieses offline war), bleibt sie stehen. Notenziele liegen neu als eine Zeile pro Fach
-- ("gradeTarget:<fach-id>"), damit zwei Geräte verschiedene Fächer ändern können.
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run. (Nach 001–009.)
-- =====================================================================

create or replace function public.user_prefs_keep_newer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null; -- älterer Stand: Zeile unverändert lassen
  end if;
  return new;
end;
$$;

revoke all on function public.user_prefs_keep_newer() from public, anon, authenticated;

drop trigger if exists user_prefs_keep_newer on public.user_prefs;
create trigger user_prefs_keep_newer
  before update on public.user_prefs
  for each row execute function public.user_prefs_keep_newer();

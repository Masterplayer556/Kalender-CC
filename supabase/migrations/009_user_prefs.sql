-- =====================================================================
-- Kalender-Tracker: Einstellungen auf allen Geräten gleich
-- (Notenziele, Design, "Erledigte anzeigen", Heatmap "Nur Offenes")
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Nach 001–008.) Bestehende Daten bleiben erhalten.
-- =====================================================================

-- Eine Zeile pro Einstellung, z. B. name = 'gradeTargets', value = {"gesamt": 5, "<fach-id>": 5.5}
create table public.user_prefs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 50),
  value      jsonb not null,
  updated_at timestamptz not null default now(),

  primary key (user_id, name)
);

alter table public.user_prefs enable row level security;

create policy "Eigene Einstellungen" on public.user_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.user_prefs from anon;
grant select, insert, update, delete on public.user_prefs to authenticated;

-- =====================================================================
-- Kalender-Tracker: BM-Einschätzung (Kreuze für fachliche und persönliche Kompetenz)
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Nach 001–005.) Bestehende Daten bleiben erhalten.
-- =====================================================================

-- Eine Zeile pro Semester und Fach. Pro Kompetenz ein Kreuz (0 = leer, 1 = angekreuzt).
create table public.bm_ratings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Semester wie in der App: "2026-1" = Schuljahr 2026/27, 1. Semester
  semester   text not null check (semester ~ '^[0-9]{4}-[12]$'),
  subject    text not null check (subject in ('math', 'deutsch', 'franz', 'nmg')),
  fach       smallint not null default 0 check (fach between 0 and 1),
  pers       smallint not null default 0 check (pers between 0 and 1),
  updated_at timestamptz not null default now(),

  constraint bm_ratings_unique unique (user_id, semester, subject)
);

alter table public.bm_ratings enable row level security;

create policy "Eigene BM-Einschätzung" on public.bm_ratings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.bm_ratings from anon;
grant select, insert, update, delete on public.bm_ratings to authenticated;

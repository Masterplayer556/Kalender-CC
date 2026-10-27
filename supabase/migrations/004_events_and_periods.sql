-- =====================================================================
-- Kalender-Tracker: Kategorie "Event" und Zeiträume (Ferien, schulfreie Tage, Lager)
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Nach 001–003.) Bestehende Daten bleiben erhalten.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Neue Kategorie "event" für Einträge erlauben
-- ---------------------------------------------------------------------
alter table public.entries drop constraint if exists entries_category_check;
alter table public.entries
  add constraint entries_category_check check (category in ('test', 'aufgabe', 'event', 'sonstiges'));

-- ---------------------------------------------------------------------
-- 2. Zeiträume: von–bis, beide Tage inklusive
-- ---------------------------------------------------------------------
create table public.periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  kind       text not null default 'ferien' check (kind in ('ferien', 'frei', 'lager')),
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now(),

  constraint periods_order check (end_date >= start_date)
);

create index periods_user_start_idx on public.periods (user_id, start_date);

alter table public.periods enable row level security;

create policy "Eigene Zeiträume" on public.periods
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.periods from anon;
grant select, insert, update, delete on public.periods to authenticated;

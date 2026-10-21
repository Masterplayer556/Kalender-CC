-- =====================================================================
-- Kalender-Tracker: Noten
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Erst NACH 001_init.sql – braucht die Tabelle "subjects".)
-- =====================================================================

create table public.grades (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  title      text not null check (char_length(title) between 1 and 200),
  date       date not null,
  -- Schweizer Skala 1–6, bis zu zwei Nachkommastellen (z. B. 4.75)
  grade      numeric(4, 2) not null check (grade between 1 and 6),
  -- Gewichtung: 1 = normal, 2 = zählt doppelt, 0.5 = halb
  weight     numeric(5, 2) not null default 1 check (weight > 0 and weight <= 100),
  created_at timestamptz not null default now(),

  -- Fach muss demselben Benutzer gehören. "restrict": Ein Fach mit Noten lässt sich nicht
  -- versehentlich löschen (sonst wären alle seine Noten weg).
  constraint grades_subject_fk foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete restrict
);

create index grades_user_date_idx on public.grades (user_id, date);

alter table public.grades enable row level security;

create policy "Eigene Noten" on public.grades
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.grades from anon;
grant select, insert, update, delete on public.grades to authenticated;

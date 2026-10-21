-- =====================================================================
-- Kalender-Tracker: Datenbankstruktur
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fächer
-- ---------------------------------------------------------------------
create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  -- default auth.uid(): Die App muss user_id nicht selbst mitschicken.
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  color      text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  -- Wird für den Fremdschlüssel aus "entries" gebraucht (siehe unten).
  unique (id, user_id)
);

-- ---------------------------------------------------------------------
-- Einträge (Tests, Aufgaben, Sonstiges)
-- ---------------------------------------------------------------------
create table public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  category   text not null default 'test' check (category in ('test', 'aufgabe', 'sonstiges')),
  subject_id uuid,
  date       date not null,               -- Tag des Tests bzw. Abgabe
  start_time time,                        -- optional
  end_time   time,                        -- optional, nur zusammen mit start_time
  notes      text,
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, user_id),
  constraint entries_end_requires_start check (end_time is null or start_time is not null),
  constraint entries_time_order check (end_time is null or end_time > start_time),
  -- Fach muss demselben Benutzer gehören. Wird das Fach gelöscht,
  -- bleibt der Eintrag bestehen und nur subject_id wird geleert.
  constraint entries_subject_fk foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete set null (subject_id)
);

create index entries_user_date_idx on public.entries (user_id, date);

-- ---------------------------------------------------------------------
-- Lernzeiten (gehören zu einem Eintrag)
-- "starts_at"/"ends_at" statt "start"/"end", weil "end" in SQL ein reserviertes Wort ist.
-- timestamptz speichert den genauen Zeitpunkt; angezeigt wird in der Zeitzone des Geräts.
-- ---------------------------------------------------------------------
create table public.study_blocks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id   uuid not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  done       boolean not null default false,
  created_at timestamptz not null default now(),

  constraint study_blocks_order check (ends_at > starts_at),
  -- Wird der Eintrag gelöscht, verschwinden seine Lernzeiten mit.
  constraint study_blocks_entry_fk foreign key (entry_id, user_id)
    references public.entries (id, user_id) on delete cascade
);

create index study_blocks_entry_idx on public.study_blocks (entry_id);
create index study_blocks_user_start_idx on public.study_blocks (user_id, starts_at);

-- ---------------------------------------------------------------------
-- updated_at automatisch setzen
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security: Jeder sieht und ändert nur seine eigenen Zeilen.
-- (select auth.uid()) statt auth.uid(): wird so nur einmal pro Abfrage berechnet.
-- ---------------------------------------------------------------------
alter table public.subjects     enable row level security;
alter table public.entries      enable row level security;
alter table public.study_blocks enable row level security;

create policy "Eigene Fächer" on public.subjects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Eigene Einträge" on public.entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Eigene Lernzeiten" on public.study_blocks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Zugriffsrechte: nur angemeldete Benutzer, nicht anonyme Besucher.
revoke all on public.subjects, public.entries, public.study_blocks from anon;
grant select, insert, update, delete
  on public.subjects, public.entries, public.study_blocks
  to authenticated;

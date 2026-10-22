-- =====================================================================
-- Kalender-Tracker: Noten ↔ Test verknüpfen, Anhänge (Dateien + Links)
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Nach 001_init.sql und 002_grades.sql.) Bestehende Daten bleiben erhalten.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Note optional mit einem Test (Eintrag) verknüpfen
-- ---------------------------------------------------------------------
alter table public.grades add column entry_id uuid;

alter table public.grades
  add constraint grades_entry_fk foreign key (entry_id, user_id)
    references public.entries (id, user_id) on delete set null (entry_id);

-- Pro Test höchstens eine Note
create unique index grades_entry_unique on public.grades (entry_id) where entry_id is not null;

-- ---------------------------------------------------------------------
-- 2. Anhänge an Einträgen: hochgeladene Dateien oder Links
-- ---------------------------------------------------------------------
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id     uuid not null,
  kind         text not null check (kind in ('file', 'link')),
  name         text not null check (char_length(name) between 1 and 300), -- Anzeigename
  url          text check (url is null or url ~* '^https?://'),          -- nur bei Links
  storage_path text,                                                     -- nur bei Dateien
  size         bigint,                                                   -- Bytes, nur bei Dateien
  mime         text,
  created_at   timestamptz not null default now(),

  constraint attachments_kind_fields check (
    (kind = 'link' and url is not null and storage_path is null) or
    (kind = 'file' and storage_path is not null and url is null)
  ),
  -- Gehört zum selben Benutzer; wird der Eintrag gelöscht, verschwinden die Anhänge mit.
  constraint attachments_entry_fk foreign key (entry_id, user_id)
    references public.entries (id, user_id) on delete cascade
);

create index attachments_entry_idx on public.attachments (entry_id);

alter table public.attachments enable row level security;

create policy "Eigene Anhänge" on public.attachments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.attachments from anon;
grant select, insert, update, delete on public.attachments to authenticated;

-- ---------------------------------------------------------------------
-- 3. Datei-Speicher (privat, max. 50 MB pro Datei)
-- Dateien liegen unter  <user_id>/<entry_id>/<zufall>-<name>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

-- Jeder darf nur in seinem eigenen Ordner (= seine user_id) lesen, hochladen und löschen.
create policy "Anhänge lesen" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Anhänge hochladen" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Anhänge ändern" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Anhänge löschen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =====================================================================
-- Kalender-Tracker: Lernzeiten merken sich, wann sie zuletzt geändert wurden
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run. (Nach 001–012.)
--
-- Wer offline eine Lernzeit abhakt, schickt die Änderung später nach. Hat ein anderes Gerät dieselbe
-- Lernzeit inzwischen geändert, soll die neuere Änderung gewinnen – dafür braucht es updated_at
-- (wie bei den Einträgen). Bestehende Lernzeiten bekommen den jetzigen Zeitpunkt.
-- =====================================================================

alter table public.study_blocks add column if not exists updated_at timestamptz not null default now();

-- set_updated_at() gibt es seit 001_init.sql (setzt updated_at bei jeder Änderung auf jetzt)
drop trigger if exists study_blocks_set_updated_at on public.study_blocks;
create trigger study_blocks_set_updated_at
  before update on public.study_blocks
  for each row execute function public.set_updated_at();

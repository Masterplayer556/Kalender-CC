-- =====================================================================
-- Kalender-Tracker: Tests, die für mehrere Noten zählen dürfen
-- (z. B. ein Test, der eine Note für Grammatik und eine für Wortschatz gibt)
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Nach 001–006.) Bestehende Daten bleiben erhalten.
-- =====================================================================

-- Haken im Test: "für mehrere Noten verwendbar"
alter table public.entries add column multi_grade boolean not null default false;

-- Bisher: pro Test höchstens eine Note (eindeutiger Index).
-- Neu: gilt weiterhin, ausser der Test erlaubt mehrere Noten → Prüfung per Trigger.
drop index if exists public.grades_entry_unique;

create or replace function public.grades_entry_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entry_id is not null
     and not coalesce((select e.multi_grade from public.entries e where e.id = new.entry_id), false)
     and exists (select 1 from public.grades g where g.entry_id = new.entry_id and g.id <> new.id) then
    raise exception 'grades_entry_unique: Dieser Test hat schon eine Note' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger grades_entry_check
  before insert or update of entry_id on public.grades
  for each row execute function public.grades_entry_check();

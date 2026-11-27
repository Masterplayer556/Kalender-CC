-- =====================================================================
-- Kalender-Tracker: Eintrag samt Lernzeiten in einem Schritt speichern
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run. (Nach 001–011.)
--
-- Bisher schickte die App nacheinander mehrere Anfragen (Eintrag, Lernzeiten löschen, Lernzeiten
-- speichern). Riss die Verbindung mittendrin ab, war der Eintrag nur halb gespeichert. Diese Funktion
-- erledigt alles in einer Transaktion: ganz oder gar nicht. Anhänge (Datei-Upload) bleiben separat.
--
-- security invoker: Die Funktion läuft mit den Rechten des angemeldeten Benutzers, die RLS-Regeln
-- ("nur eigene Zeilen") gelten also unverändert.
--
-- Rückgabe:
--   'saved' – gespeichert
--   'gone'  – der Eintrag existiert nicht mehr (z. B. auf einem anderen Gerät gelöscht)
--   'stale' – nur mit p_changed_at: Der Eintrag wurde auf dem Server nach diesem Zeitpunkt geändert
--             (neuere Änderung gewinnt; wird für Änderungen gebraucht, die offline gemacht wurden)
-- =====================================================================

create or replace function public.save_entry(
  p_id uuid,
  p_create boolean,
  p_entry jsonb,
  p_blocks jsonb default '[]'::jsonb,
  p_removed_block_ids uuid[] default '{}'::uuid[],
  p_changed_at timestamptz default null
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.entries;
  server_updated timestamptz;
begin
  r := jsonb_populate_record(null::public.entries, p_entry);

  if p_create then
    -- Neuer Eintrag mit der auf dem Gerät vergebenen id. Ein zweiter Versuch (z. B. nach Netzabbruch)
    -- legt nichts doppelt an, sondern überschreibt den ersten.
    insert into public.entries (id, title, category, subject_id, date, end_date, start_time, end_time, notes, done, multi_grade)
    values (p_id, r.title, r.category, r.subject_id, r.date, r.end_date, r.start_time, r.end_time, r.notes,
            coalesce(r.done, false), coalesce(r.multi_grade, false))
    on conflict (id) do update set
      title = excluded.title, category = excluded.category, subject_id = excluded.subject_id,
      date = excluded.date, end_date = excluded.end_date, start_time = excluded.start_time,
      end_time = excluded.end_time, notes = excluded.notes, done = excluded.done,
      multi_grade = excluded.multi_grade;
  else
    select e.updated_at into server_updated from public.entries e where e.id = p_id for update;
    if not found then
      return 'gone';
    end if;
    if p_changed_at is not null and server_updated > p_changed_at then
      return 'stale';
    end if;
    update public.entries set
      title = r.title, category = r.category, subject_id = r.subject_id, date = r.date,
      end_date = r.end_date, start_time = r.start_time, end_time = r.end_time, notes = r.notes,
      done = coalesce(r.done, false), multi_grade = coalesce(r.multi_grade, false)
    where id = p_id;
  end if;

  -- Im Formular entfernte Lernzeiten löschen (nur die dieses Eintrags)
  if coalesce(array_length(p_removed_block_ids, 1), 0) > 0 then
    delete from public.study_blocks b where b.entry_id = p_id and b.id = any (p_removed_block_ids);
  end if;

  -- Bestehende Lernzeiten aktualisieren, neue anlegen
  insert into public.study_blocks (id, entry_id, starts_at, ends_at, done)
  select b.id, p_id, b.starts_at, b.ends_at, coalesce(b.done, false)
  from jsonb_to_recordset(coalesce(p_blocks, '[]'::jsonb)) as b (id uuid, starts_at timestamptz, ends_at timestamptz, done boolean)
  on conflict (id) do update set
    starts_at = excluded.starts_at, ends_at = excluded.ends_at, done = excluded.done
  where public.study_blocks.entry_id = excluded.entry_id;

  return 'saved';
end;
$$;

-- Nur angemeldete Benutzer (Supabase gibt neuen Funktionen sonst automatisch allen das Ausführungsrecht)
revoke all on function public.save_entry(uuid, boolean, jsonb, jsonb, uuid[], timestamptz) from public, anon;
grant execute on function public.save_entry(uuid, boolean, jsonb, jsonb, uuid[], timestamptz) to authenticated;

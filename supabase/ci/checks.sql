-- =====================================================================
-- Nur für die Prüfung in CI (.github/workflows/migrations.yml), NICHT in Supabase ausführen!
-- Läuft nach allen Migrationen und bricht mit einer Fehlermeldung ab, wenn eine Regel verletzt ist.
-- =====================================================================

-- 1. Jede Tabelle in public hat RLS ("nur eigene Zeilen")
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    raise exception 'Tabelle public.% hat kein RLS', t;
  end loop;
end $$;

-- 2. Anonyme Besucher (anon) dürfen an keiner Tabelle etwas – Supabase gibt neuen Tabellen sonst alle Rechte
do $$
declare r record;
begin
  for r in select table_name, privilege_type from information_schema.role_table_grants
           where grantee = 'anon' and table_schema = 'public'
  loop
    raise exception 'anon hat % auf public.% (fehlt revoke in der Migration?)', r.privilege_type, r.table_name;
  end loop;
end $$;

-- 3. Angemeldete nur select/insert/update/delete – kein TRUNCATE (umgeht RLS), TRIGGER, REFERENCES
do $$
declare r record;
begin
  for r in select table_name, privilege_type from information_schema.role_table_grants
           where grantee = 'authenticated' and table_schema = 'public'
             and privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  loop
    raise exception 'authenticated hat % auf public.% (siehe 011_revoke_truncate.sql)', r.privilege_type, r.table_name;
  end loop;
end $$;

-- 4. Aufrufbare Funktionen (keine Trigger-Funktionen): nicht für anon, und security invoker (RLS gilt)
do $$
declare f record;
begin
  for f in select p.oid, p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
             and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') -- nicht aus Erweiterungen
  loop
    if has_function_privilege('anon', f.oid, 'execute') then
      raise exception 'anon darf public.%() ausführen (fehlt revoke in der Migration?)', f.proname;
    end if;
    if f.prosecdef then
      raise exception 'public.%() ist security definer – RLS würde umgangen', f.proname;
    end if;
  end loop;
end $$;

-- 5. Alle Tabellen sind in der Realtime-Publication (014_realtime.sql)
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
             and not exists (select 1 from pg_publication_tables p
                             where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = c.relname)
  loop
    raise exception 'Tabelle public.% fehlt in der Realtime-Publication', t;
  end loop;
end $$;

-- 6. save_entry (012) funktioniert und RLS gilt: Benutzer B sieht und ändert die Einträge von A nicht
begin;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$
declare res text;
begin
  res := public.save_entry('10000000-0000-0000-0000-000000000001', true,
    '{"title":"Test","category":"test","date":"2026-12-01","done":false}',
    '[{"id":"20000000-0000-0000-0000-000000000001","starts_at":"2026-11-30T16:00:00Z","ends_at":"2026-11-30T17:00:00Z","done":false}]');
  if res <> 'saved' then raise exception 'save_entry neu: %', res; end if;
  -- Erneuter Versuch legt nichts doppelt an
  res := public.save_entry('10000000-0000-0000-0000-000000000001', true,
    '{"title":"Test","category":"test","date":"2026-12-01","done":false}',
    '[{"id":"20000000-0000-0000-0000-000000000001","starts_at":"2026-11-30T16:00:00Z","ends_at":"2026-11-30T17:00:00Z","done":false}]');
  if (select count(*) from public.study_blocks) <> 1 then raise exception 'save_entry legt Lernzeiten doppelt an'; end if;
  -- Server neuer als die Offline-Änderung → stale
  res := public.save_entry('10000000-0000-0000-0000-000000000001', false, '{"title":"Alt","category":"test","date":"2026-12-01"}', '[]', '{}', now() - interval '1 hour');
  if res <> 'stale' then raise exception 'save_entry stale erwartet, war %', res; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
do $$
begin
  if (select count(*) from public.entries) <> 0 then raise exception 'RLS: B sieht Einträge von A'; end if;
  if public.save_entry('10000000-0000-0000-0000-000000000001', false, '{"title":"Fremd","category":"test","date":"2026-12-01"}') <> 'gone' then
    raise exception 'RLS: B kann den Eintrag von A ändern';
  end if;
end $$;
rollback;

select 'Alle Prüfungen bestanden' as ergebnis;

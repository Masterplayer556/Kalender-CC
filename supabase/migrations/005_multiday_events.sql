-- =====================================================================
-- Kalender-Tracker: Einträge über mehrere Tage (z. B. ein Event von Freitag bis Sonntag)
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Nach 001–004.) Bestehende Daten bleiben erhalten.
-- =====================================================================

-- Letzter Tag (inklusive). Leer = nur an "date". Mehrtägige Einträge sind ganztägig.
alter table public.entries add column end_date date;

alter table public.entries
  add constraint entries_end_date_order check (end_date is null or end_date > date),
  add constraint entries_multiday_all_day check (end_date is null or start_time is null);

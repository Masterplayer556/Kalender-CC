-- =====================================================================
-- Kalender-Tracker: BM-Kreuze als Ja / Nein (statt nur angekreuzt)
-- Ausführen im Supabase-Dashboard → SQL Editor → "New query" → Run.
-- (Nach 006_bm.sql.) Bestehende Kreuze bleiben als "Ja" erhalten.
-- =====================================================================

-- 0 = noch offen, 1 = Ja, 2 = Nein
alter table public.bm_ratings drop constraint if exists bm_ratings_fach_check;
alter table public.bm_ratings drop constraint if exists bm_ratings_pers_check;
alter table public.bm_ratings
  add constraint bm_ratings_fach_check check (fach between 0 and 2),
  add constraint bm_ratings_pers_check check (pers between 0 and 2);

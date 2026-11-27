#!/usr/bin/env bash
# Wendet EINE Migration auf die Supabase-Datenbank an und trägt sie in die Migrations-Historie ein –
# beides in einer Transaktion (ganz oder gar nicht). Von Hand oder über den Workflow
# "Migrationen prüfen" → "Run workflow" mit Dateiname.
#
# Warum nicht "supabase db push"? Das Supabase-Projekt teilt sich die Datenbank (und die Historie
# supabase_migrations.schema_migrations) mit der Game-Bibliothek, und die Dateien hier heissen
# 001_….sql statt <Zeitstempel>_….sql. "db push" würde die fremden Einträge in der Historie nicht
# kennen und abbrechen bzw. zum "Reparieren" der gemeinsamen Historie auffordern. Dieses Skript
# fasst nur die angegebene Datei an.
#
# Aufruf:
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<passwort>@<pooler>:5432/postgres' \
#     scripts/apply-migration.sh supabase/migrations/015_beispiel.sql        # fragt nach
#   … scripts/apply-migration.sh --yes supabase/migrations/015_beispiel.sql   # ohne Rückfrage (CI)
#   … scripts/apply-migration.sh --status                                     # was ist eingetragen?
#
# SUPABASE_DB_URL: Supabase-Dashboard → Connect → "Session pooler" (funktioniert auch von GitHub aus,
# die direkte Verbindung geht nur über IPv6). Das Passwort ist das Datenbank-Passwort des Projekts.
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL fehlt (siehe Kommentar oben)}"
cd "$(dirname "$0")/.."
psql_run() { psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -X -q "$@"; }

if [ "${1:-}" = "--status" ]; then
  echo "In der Historie eingetragen (alle Apps dieses Projekts):"
  psql_run -At -c "select version || '  ' || coalesce(name, '') from supabase_migrations.schema_migrations order by version"
  echo
  echo "Dateien hier (001, 002, 007 wurden vor der Historie im SQL-Editor ausgeführt):"
  ls supabase/migrations
  exit 0
fi

yes=false
if [ "${1:-}" = "--yes" ]; then yes=true; shift; fi
file="${1:?Datei angeben, z. B. supabase/migrations/015_beispiel.sql}"
case "$file" in
  *..*|*//*) echo "Ungültiger Pfad: $file" >&2; exit 1 ;;
  supabase/migrations/*/*) echo "Nur Dateien direkt in supabase/migrations/." >&2; exit 1 ;;
  supabase/migrations/*.sql) ;;
  *) echo "Nur Dateien aus supabase/migrations/ (relativ zum Projektordner)." >&2; exit 1 ;;
esac
[ -f "$file" ] || { echo "Datei $file gibt es nicht." >&2; exit 1; }

name="$(basename "$file" .sql)"            # z. B. 015_beispiel
short="${name#[0-9][0-9][0-9]_}"           # beispiel (ältere Einträge heissen ohne Nummer)
# (psql setzt :'name' nur in Skripten ein, nicht bei -c – deshalb über stdin)
already="$(psql_run -At -v name="$name" -v short="$short" -f - <<'SQL'
select count(*) from supabase_migrations.schema_migrations where name in (:'name', :'short');
SQL
)"
if [ "$already" != "0" ]; then
  echo "$name steht schon in der Historie – nichts zu tun."
  exit 0
fi

if ! $yes; then
  read -r -p "$name auf die Supabase-Datenbank anwenden? (ja/nein) " answer
  [ "$answer" = "ja" ] || { echo "Abgebrochen."; exit 1; }
fi

version="$(date -u +%Y%m%d%H%M%S)"
echo "== $file (Version $version)"
{
  cat "$file"
  printf '\n;\ninsert into supabase_migrations.schema_migrations (version, name, statements)\n'
  printf "values (:'version', :'name', array[:'content']);\n"
} | psql_run --single-transaction -v version="$version" -v name="$name" -v content="$(cat "$file")" -f -
echo "Fertig: $name angewendet und eingetragen."

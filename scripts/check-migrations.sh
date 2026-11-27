#!/usr/bin/env bash
# Prüft alle Migrationen gegen ein leeres Postgres (lokal oder in CI, Workflow "Migrationen prüfen").
# Ablauf: Supabase-Teile nachbilden (supabase/ci/stubs.sql), alle Dateien in supabase/migrations der
# Reihe nach je in einer Transaktion ausführen, danach die Regeln in supabase/ci/checks.sql prüfen.
#
# Aufruf: DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres scripts/check-migrations.sh
# Achtung: Die Datenbank muss LEER sein (z. B. ein Wegwerf-Container) – niemals die Supabase-Datenbank!
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL fehlt (leere Test-Datenbank)}"
case "$DATABASE_URL" in
  *supabase.co*|*supabase.com*) echo "Abbruch: Das ist eine Supabase-Datenbank. Hier nur eine leere Test-Datenbank verwenden." >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."
psql_run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X "$@"; }

echo "== Supabase-Teile nachbilden"
psql_run -f supabase/ci/stubs.sql

for file in supabase/migrations/*.sql; do
  echo "== $file"
  psql_run --single-transaction -f "$file"
done

echo "== Regeln prüfen"
psql_run -f supabase/ci/checks.sql

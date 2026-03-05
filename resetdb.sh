#!/usr/bin/env bash
set -euo pipefail

# resetdb.sh
# Drops and recreates the `pharmacy_pos` and `pharmacy_customer_db` databases.
# Configure via environment variables: DB_HOST, DB_PORT, DB_USER, DB_PASS
# To run non-interactively set FORCE=1 and optionally DB_PASS or MYSQL_PWD.

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
FORCE="${FORCE:-}"

if [ "$FORCE" != "1" ]; then
  read -r -p "This will DROP and recreate databases pharmacy_pos and pharmacy_customer_db. Continue? (y/N) " ans
  case "$ans" in
    [Yy]*) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

if [ -n "$DB_PASS" ]; then
  export MYSQL_PWD="$DB_PASS"
fi

SQL="DROP DATABASE IF EXISTS pharmacy_customer_db; DROP DATABASE IF EXISTS pharmacy_pos; CREATE DATABASE pharmacy_pos; CREATE DATABASE pharmacy_customer_db;"

echo "Running SQL on ${DB_HOST}:${DB_PORT} as ${DB_USER}..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "$SQL"

echo "Done."

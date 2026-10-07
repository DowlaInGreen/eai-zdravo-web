#!/usr/bin/env bash
# Throwaway local Postgres for app tests (no network, no real data).
#   source tests/local-pg.sh start   -> exports POSTGRES_URL for a fresh DB
#   bash tests/local-pg.sh stop
set -euo pipefail
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  RUN_AS=(runuser -u postgres --)   # initdb refuses to run as root
  PGDATA_DIR="${PGDATA_DIR:-$(getent passwd postgres | cut -d: -f6)/eai-app-pg}"
else
  PGDATA_DIR="${PGDATA_DIR:-$HOME/.eai-app-pg}"
fi

case "${1:-start}" in
  start)
    if [ ! -d "$PGDATA_DIR" ]; then
      mkdir -p "$PGDATA_DIR"
      [ "$(id -u)" = "0" ] && chown postgres "$PGDATA_DIR"
      "${RUN_AS[@]}" "$PGBIN/initdb" -D "$PGDATA_DIR" -U postgres -A trust >/dev/null
    fi
    if ! "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA_DIR" status >/dev/null 2>&1; then
      "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -o "-p $PORT -k /tmp -c listen_addresses=localhost" -l "$PGDATA_DIR/log" -w start >/dev/null
    fi
    psql "postgresql://postgres@localhost:$PORT/postgres" -qc "drop database if exists eai_test" >/dev/null
    psql "postgresql://postgres@localhost:$PORT/postgres" -qc "create database eai_test" >/dev/null
    export POSTGRES_URL="postgresql://postgres@localhost:$PORT/eai_test"
    echo "local pg ready on :$PORT"
    ;;
  stop)
    "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -m fast stop >/dev/null && echo "local pg stopped"
    ;;
esac

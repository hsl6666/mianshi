#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-mianshi}"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d%H%M%S)}"
APP_DIR="${APP_DIR:-/opt/mianshi}"
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
BACKEND_IMAGE="${BACKEND_IMAGE:-mianshi-backend}"
CONTAINER_NAME="${CONTAINER_NAME:-$APP_NAME-backend}"
BACKEND_BIND_HOST="${BACKEND_BIND_HOST:-127.0.0.1}"
BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-8000}"
BACKEND_CONTAINER_PORT="${BACKEND_CONTAINER_PORT:-8000}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$APP_DIR/backend.env}"
BACKEND_ENV_SOURCE="${BACKEND_ENV_SOURCE:-}"
BACKEND_ARCHIVE="${BACKEND_ARCHIVE:-}"
DATA_ARCHIVE="${DATA_ARCHIVE:-}"
FRONTEND_ARCHIVE="${FRONTEND_ARCHIVE:-}"
FRONTEND_WEB_ROOT="${FRONTEND_WEB_ROOT:-}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-}"
USE_SUDO="${USE_SUDO:-1}"
DOCKER_USE_SUDO="${DOCKER_USE_SUDO:-0}"
RELOAD_NGINX="${RELOAD_NGINX:-1}"
NGINX_BIN="${NGINX_BIN:-nginx}"
BACKUP_FULL_DATA="${BACKUP_FULL_DATA:-1}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-1}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:${BACKEND_HOST_PORT}/health}"

step() {
  printf '==> %s\n' "$1"
}

warn() {
  printf 'WARN: %s\n' "$1" >&2
}

die() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

priv() {
  if [[ "$USE_SUDO" == "1" ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

docker_cmd() {
  if [[ "$DOCKER_USE_SUDO" == "1" ]]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

http_ok() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$HEALTHCHECK_URL" >/dev/null 2>&1
    return $?
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -q -O /dev/null "$HEALTHCHECK_URL" >/dev/null 2>&1
    return $?
  fi
  warn "Neither curl nor wget is installed; skipping HTTP health check."
  return 0
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 30); do
    if http_ok; then
      return 0
    fi
    sleep 2
  done
  return 1
}

container_exists() {
  docker_cmd ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"
}

container_running() {
  docker_cmd ps --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"
}

safe_frontend_root() {
  local path="$1"
  case "$path" in
    ""|"/"|"/var"|"/var/"|"/var/www"|"/var/www/"|"/usr"|"/usr/"|"/opt"|"/opt/")
      return 1
      ;;
  esac
  return 0
}

ensure_dirs() {
  priv mkdir -p "$APP_DIR" "$DATA_DIR" "$BACKUP_DIR/images" "$BACKUP_DIR/db" "$BACKUP_DIR/data" "$BACKUP_DIR/frontend" "$APP_DIR/tmp"
}

copy_backend_env_if_needed() {
  if [[ -n "$BACKEND_ENV_SOURCE" && -f "$BACKEND_ENV_SOURCE" ]]; then
    step "Updating backend env file"
    priv mkdir -p "$(dirname "$BACKEND_ENV_FILE")"
    priv cp "$BACKEND_ENV_SOURCE" "$BACKEND_ENV_FILE"
    priv chmod 600 "$BACKEND_ENV_FILE" || true
  fi
}

backup_image() {
  local old_image="$1"
  if [[ -z "$old_image" ]]; then
    return 0
  fi

  local image_backup="$BACKUP_DIR/images/${APP_NAME}_${RELEASE_ID}_image.tar.gz"
  step "Backing up current image $old_image"
  docker_cmd save "$old_image" | gzip -c | priv tee "$image_backup" >/dev/null
}

backup_database_and_data() {
  local db_path="$DATA_DIR/interviewer.db"
  local db_backup="$BACKUP_DIR/db/interviewer_${RELEASE_ID}.db"
  if priv test -f "$db_path"; then
    step "Backing up SQLite database"
    priv cp "$db_path" "$db_backup"
  else
    warn "SQLite database not found, skipping DB backup: $db_path"
  fi

  if [[ "$BACKUP_FULL_DATA" == "1" ]] && priv test -d "$DATA_DIR"; then
    local data_backup="$BACKUP_DIR/data/data_${RELEASE_ID}.tar.gz"
    step "Backing up backend data directory"
    priv tar -czf "$data_backup" -C "$DATA_DIR" .
  fi
}

migrate_data_archive() {
  if [[ -z "$DATA_ARCHIVE" ]]; then
    return 0
  fi
  [[ -f "$DATA_ARCHIVE" ]] || die "Data archive not found on server: $DATA_ARCHIVE"

  step "Migrating uploaded backend data directory"
  priv mkdir -p "$DATA_DIR"
  priv tar -xzf "$DATA_ARCHIVE" -C "$DATA_DIR"
}

stop_and_remove_container() {
  if container_running; then
    step "Stopping current container"
    docker_cmd stop "$CONTAINER_NAME" >/dev/null
  fi
  if container_exists; then
    step "Removing current container"
    docker_cmd rm "$CONTAINER_NAME" >/dev/null
  fi
}

run_backend_container() {
  local image_ref="$1"
  local args=(
    run
    -d
    --name "$CONTAINER_NAME"
    --restart unless-stopped
    -p "${BACKEND_BIND_HOST}:${BACKEND_HOST_PORT}:${BACKEND_CONTAINER_PORT}"
    -v "${DATA_DIR}:/app/data"
  )

  if priv test -f "$BACKEND_ENV_FILE"; then
    args+=(--env-file "$BACKEND_ENV_FILE")
  else
    warn "Backend env file not found, running without --env-file: $BACKEND_ENV_FILE"
  fi
  args+=(-e "DATABASE_URL=sqlite:///./data/interviewer.db")
  if [[ -n "$PUBLIC_BASE_URL" ]]; then
    args+=(-e "PUBLIC_BASE_URL=$PUBLIC_BASE_URL")
  fi
  if [[ -n "$FRONTEND_ORIGIN" ]]; then
    args+=(-e "FRONTEND_ORIGIN=$FRONTEND_ORIGIN")
  fi

  step "Starting backend container $image_ref"
  docker_cmd "${args[@]}" "$image_ref" >/dev/null
}

rollback_backend() {
  local old_image="$1"
  local db_backup="$BACKUP_DIR/db/interviewer_${RELEASE_ID}.db"

  if [[ "$ROLLBACK_ON_FAILURE" != "1" || -z "$old_image" ]]; then
    return 1
  fi

  warn "Health check failed; rolling back to $old_image"
  if container_running; then
    docker_cmd stop "$CONTAINER_NAME" >/dev/null || true
  fi
  if container_exists; then
    docker_cmd rm "$CONTAINER_NAME" >/dev/null || true
  fi
  if priv test -f "$db_backup"; then
    priv cp "$db_backup" "$DATA_DIR/interviewer.db"
  fi
  run_backend_container "$old_image"
  wait_for_health || warn "Rollback container started but health check still failed."
  return 0
}

deploy_backend() {
  if [[ -z "$BACKEND_ARCHIVE" ]]; then
    step "Skipping backend deploy"
    return 0
  fi
  [[ -f "$BACKEND_ARCHIVE" ]] || die "Backend archive not found on server: $BACKEND_ARCHIVE"

  local old_image=""
  if container_exists; then
    old_image="$(docker_cmd inspect -f '{{.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  elif docker_cmd image inspect "${BACKEND_IMAGE}:current" >/dev/null 2>&1; then
    old_image="${BACKEND_IMAGE}:current"
  fi

  backup_image "$old_image"
  stop_and_remove_container
  backup_database_and_data
  migrate_data_archive

  step "Loading new backend image"
  docker_cmd load -i "$BACKEND_ARCHIVE" >/dev/null

  local new_image="${BACKEND_IMAGE}:${RELEASE_ID}"
  docker_cmd image inspect "$new_image" >/dev/null 2>&1 || die "Loaded image not found: $new_image"
  docker_cmd tag "$new_image" "${BACKEND_IMAGE}:current"

  run_backend_container "$new_image"
  if ! wait_for_health; then
    rollback_backend "$old_image" || die "Backend health check failed: $HEALTHCHECK_URL"
    die "Backend release failed and rollback was attempted."
  fi

  step "Backend health check passed"
}

deploy_frontend() {
  if [[ -z "$FRONTEND_ARCHIVE" ]]; then
    step "Skipping frontend deploy"
    return 0
  fi
  [[ -f "$FRONTEND_ARCHIVE" ]] || die "Frontend archive not found on server: $FRONTEND_ARCHIVE"
  [[ -n "$FRONTEND_WEB_ROOT" ]] || die "FRONTEND_WEB_ROOT is required for frontend deploy."
  safe_frontend_root "$FRONTEND_WEB_ROOT" || die "Refusing to deploy to unsafe FRONTEND_WEB_ROOT: $FRONTEND_WEB_ROOT"

  local frontend_backup="$BACKUP_DIR/frontend/frontend_${RELEASE_ID}.tar.gz"
  local tmp_dir="$APP_DIR/tmp/frontend_${RELEASE_ID}"

  if priv test -d "$FRONTEND_WEB_ROOT"; then
    step "Backing up current frontend web root"
    priv tar -czf "$frontend_backup" -C "$FRONTEND_WEB_ROOT" .
  fi

  step "Deploying frontend static files to nginx web root"
  priv rm -rf "$tmp_dir"
  priv mkdir -p "$tmp_dir" "$FRONTEND_WEB_ROOT"
  priv tar -xzf "$FRONTEND_ARCHIVE" -C "$tmp_dir"
  priv find "$FRONTEND_WEB_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  priv cp -a "$tmp_dir/." "$FRONTEND_WEB_ROOT/"
  priv rm -rf "$tmp_dir"

  if [[ "$RELOAD_NGINX" == "1" ]]; then
    step "Testing and reloading nginx"
    if priv "$NGINX_BIN" -t; then
      if command -v systemctl >/dev/null 2>&1; then
        if priv systemctl reload nginx 2>/dev/null; then
          return 0
        fi
        priv "$NGINX_BIN" -s reload
      else
        priv "$NGINX_BIN" -s reload
      fi
    else
      die "nginx -t failed; frontend files were deployed but nginx was not reloaded."
    fi
  fi
}

main() {
  ensure_dirs
  copy_backend_env_if_needed
  deploy_backend
  deploy_frontend
  step "Release complete: $RELEASE_ID"
}

main "$@"

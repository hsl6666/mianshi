#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ACTION="all"
CONFIG_PATH="$SCRIPT_DIR/deploy.env"
CLI_RELEASE_ID=""
SKIP_BACKEND=0
SKIP_FRONTEND=0
SKIP_DATA=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    all|package|upload|release)
      ACTION="$1"
      ;;
    --config)
      CONFIG_PATH="$2"
      shift
      ;;
    --release-id)
      CLI_RELEASE_ID="$2"
      shift
      ;;
    --skip-backend)
      SKIP_BACKEND=1
      ;;
    --skip-frontend)
      SKIP_FRONTEND=1
      ;;
    --skip-data)
      SKIP_DATA=1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

step() {
  printf '==> %s\n' "$1"
}

die() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

if [[ ! -f "$CONFIG_PATH" ]]; then
  die "Config file not found: $CONFIG_PATH. Copy scripts/deploy/deploy.env.example to scripts/deploy/deploy.env first."
fi

set -a
# shellcheck source=/dev/null
. "$CONFIG_PATH"
set +a

APP_NAME="${APP_NAME:-mianshi}"
RELEASE_ID="${CLI_RELEASE_ID:-${RELEASE_ID:-$(date +%Y%m%d%H%M%S)}}"
BACKEND_IMAGE="${BACKEND_IMAGE:-mianshi-backend}"
CONTAINER_NAME="${CONTAINER_NAME:-$APP_NAME-backend}"
REMOTE_UPLOAD_DIR="${REMOTE_UPLOAD_DIR:-mianshi-deploy}"
REMOTE_RELEASE_DIR="${REMOTE_UPLOAD_DIR%/}/releases/$RELEASE_ID"
DIST_DIR="$REPO_ROOT/dist/deploy/$RELEASE_ID"
BACKEND_ARCHIVE="$DIST_DIR/backend-image.tar.gz"
FRONTEND_ARCHIVE="$DIST_DIR/frontend-dist.tar.gz"
DATA_ARCHIVE="$DIST_DIR/backend-data.tar.gz"

require_cfg() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" || "$value" == your.* ]]; then
    die "Missing required config value: $name"
  fi
}

reject_single_quote() {
  local name="$1"
  local value="$2"
  if [[ "$value" == *"'"* ]]; then
    die "$name contains a single quote, which is not supported by this deploy script."
  fi
}

quote_remote() {
  reject_single_quote "remote value" "$1"
  printf "'%s'" "$1"
}

ssh_target() {
  require_cfg SERVER_HOST
  require_cfg SERVER_USER
  printf '%s@%s' "$SERVER_USER" "$SERVER_HOST"
}

build_ssh_opts() {
  SSH_OPTS=(-p "${SERVER_PORT:-22}")
  if [[ -n "${SERVER_SSH_KEY:-}" ]]; then
    SSH_OPTS+=(-i "$SERVER_SSH_KEY")
  fi
}

build_scp_opts() {
  SCP_OPTS=(-P "${SERVER_PORT:-22}")
  if [[ -n "${SERVER_SSH_KEY:-}" ]]; then
    SCP_OPTS+=(-i "$SERVER_SSH_KEY")
  fi
}

build_backend() {
  require_cmd docker
  mkdir -p "$DIST_DIR"
  local image_ref="$BACKEND_IMAGE:$RELEASE_ID"

  step "Building backend image $image_ref"
  docker build -t "$image_ref" "$REPO_ROOT/backend"

  step "Saving backend image archive"
  rm -f "$BACKEND_ARCHIVE"
  docker save "$image_ref" | gzip -c > "$BACKEND_ARCHIVE"
}

build_frontend() {
  require_cmd npm
  require_cmd npx
  require_cmd tar
  mkdir -p "$DIST_DIR"

  export VITE_API_BASE_URL="${VITE_API_BASE_URL:-}"
  export VITE_PUBLIC_BASE_URL="${VITE_PUBLIC_BASE_URL:-}"
  export VITE_WIFI_SSID="${VITE_WIFI_SSID:-}"
  export VITE_WIFI_PASSWORD="${VITE_WIFI_PASSWORD:-}"
  export VITE_WRITTEN_EXAM_SECONDS="${VITE_WRITTEN_EXAM_SECONDS:-}"
  export VITE_ORAL_INTERVIEW_SECONDS="${VITE_ORAL_INTERVIEW_SECONDS:-}"
  export VITE_SNAPSHOT_COUNT="${VITE_SNAPSHOT_COUNT:-}"

  if [[ "${FRONTEND_NPM_CI:-0}" == "1" || ! -d "$REPO_ROOT/frontend/node_modules" ]]; then
    step "Installing frontend dependencies with npm ci"
    (cd "$REPO_ROOT/frontend" && npm ci)
  fi

  step "Building frontend static files"
  (cd "$REPO_ROOT/frontend" && npx tsc -b && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && npx vite build)

  step "Packing frontend dist"
  rm -f "$FRONTEND_ARCHIVE"
  tar -czf "$FRONTEND_ARCHIVE" -C "$REPO_ROOT/frontend/dist" .
}

should_migrate_data() {
  [[ "$SKIP_DATA" != "1" && "${MIGRATE_LOCAL_DATA:-0}" == "1" ]]
}

build_data_archive() {
  require_cmd tar
  mkdir -p "$DIST_DIR"

  local local_data_dir="${LOCAL_DATA_DIR:-backend/data}"
  if [[ "$local_data_dir" != /* ]]; then
    local_data_dir="$REPO_ROOT/$local_data_dir"
  fi
  [[ -d "$local_data_dir" ]] || die "LOCAL_DATA_DIR not found: $local_data_dir"

  step "Packing backend data directory"
  rm -f "$DATA_ARCHIVE"
  tar -czf "$DATA_ARCHIVE" -C "$local_data_dir" .
}

upload_artifacts() {
  require_cmd ssh
  require_cmd scp

  local target
  target="$(ssh_target)"
  build_ssh_opts
  build_scp_opts

  step "Creating remote release directory $REMOTE_RELEASE_DIR"
  ssh "${SSH_OPTS[@]}" "$target" "mkdir -p $(quote_remote "$REMOTE_RELEASE_DIR")"

  scp "${SCP_OPTS[@]}" "$SCRIPT_DIR/remote-deploy.sh" "$target:$REMOTE_RELEASE_DIR/remote-deploy.sh"

  if [[ "$SKIP_BACKEND" != "1" ]]; then
    [[ -f "$BACKEND_ARCHIVE" ]] || die "Backend archive not found: $BACKEND_ARCHIVE. Run package first or use action all."
    scp "${SCP_OPTS[@]}" "$BACKEND_ARCHIVE" "$target:$REMOTE_RELEASE_DIR/backend-image.tar.gz"
  fi

  if [[ "$SKIP_FRONTEND" != "1" ]]; then
    [[ -f "$FRONTEND_ARCHIVE" ]] || die "Frontend archive not found: $FRONTEND_ARCHIVE. Run package first or use action all."
    scp "${SCP_OPTS[@]}" "$FRONTEND_ARCHIVE" "$target:$REMOTE_RELEASE_DIR/frontend-dist.tar.gz"
  fi

  if should_migrate_data; then
    [[ -f "$DATA_ARCHIVE" ]] || die "Data archive not found: $DATA_ARCHIVE. Run package first or use action all."
    scp "${SCP_OPTS[@]}" "$DATA_ARCHIVE" "$target:$REMOTE_RELEASE_DIR/backend-data.tar.gz"
  fi

  if [[ -n "${BACKEND_ENV_LOCAL_FILE:-}" ]]; then
    local backend_env_path="$BACKEND_ENV_LOCAL_FILE"
    if [[ "$backend_env_path" != /* ]]; then
      backend_env_path="$REPO_ROOT/$backend_env_path"
    fi
    [[ -f "$backend_env_path" ]] || die "BACKEND_ENV_LOCAL_FILE not found: $backend_env_path"
    scp "${SCP_OPTS[@]}" "$backend_env_path" "$target:$REMOTE_RELEASE_DIR/backend.env"
  fi
}

remote_env_pair() {
  local key="$1"
  local value="$2"
  printf '%s=%s' "$key" "$(quote_remote "$value")"
}

remote_release() {
  require_cmd ssh

  local target
  target="$(ssh_target)"
  build_ssh_opts

  local backend_archive_remote=""
  local frontend_archive_remote=""
  local data_archive_remote=""
  local backend_env_source=""

  if [[ "$SKIP_BACKEND" != "1" ]]; then
    backend_archive_remote="$REMOTE_RELEASE_DIR/backend-image.tar.gz"
  fi
  if [[ "$SKIP_FRONTEND" != "1" ]]; then
    frontend_archive_remote="$REMOTE_RELEASE_DIR/frontend-dist.tar.gz"
  fi
  if should_migrate_data; then
    data_archive_remote="$REMOTE_RELEASE_DIR/backend-data.tar.gz"
  fi
  if [[ -n "${BACKEND_ENV_LOCAL_FILE:-}" ]]; then
    backend_env_source="$REMOTE_RELEASE_DIR/backend.env"
  fi

  local env_parts=(
    "$(remote_env_pair APP_NAME "$APP_NAME")"
    "$(remote_env_pair RELEASE_ID "$RELEASE_ID")"
    "$(remote_env_pair APP_DIR "${REMOTE_APP_DIR:-/opt/mianshi}")"
    "$(remote_env_pair FRONTEND_WEB_ROOT "${REMOTE_FRONTEND_WEB_ROOT:-/var/www/mianshi}")"
    "$(remote_env_pair USE_SUDO "${REMOTE_USE_SUDO:-1}")"
    "$(remote_env_pair DOCKER_USE_SUDO "${DOCKER_USE_SUDO:-0}")"
    "$(remote_env_pair RELOAD_NGINX "${RELOAD_NGINX:-1}")"
    "$(remote_env_pair NGINX_BIN "${NGINX_BIN:-nginx}")"
    "$(remote_env_pair BACKEND_IMAGE "$BACKEND_IMAGE")"
    "$(remote_env_pair CONTAINER_NAME "$CONTAINER_NAME")"
    "$(remote_env_pair BACKEND_BIND_HOST "${BACKEND_BIND_HOST:-127.0.0.1}")"
    "$(remote_env_pair BACKEND_HOST_PORT "${BACKEND_HOST_PORT:-8000}")"
    "$(remote_env_pair BACKEND_CONTAINER_PORT "${BACKEND_CONTAINER_PORT:-8000}")"
    "$(remote_env_pair BACKEND_ENV_FILE "${BACKEND_ENV_REMOTE_FILE:-/opt/mianshi/backend.env}")"
    "$(remote_env_pair BACKEND_ENV_SOURCE "$backend_env_source")"
    "$(remote_env_pair BACKEND_ARCHIVE "$backend_archive_remote")"
    "$(remote_env_pair DATA_ARCHIVE "$data_archive_remote")"
    "$(remote_env_pair FRONTEND_ARCHIVE "$frontend_archive_remote")"
    "$(remote_env_pair PUBLIC_BASE_URL "${PUBLIC_BASE_URL:-}")"
    "$(remote_env_pair FRONTEND_ORIGIN "${FRONTEND_ORIGIN:-}")"
    "$(remote_env_pair BACKUP_FULL_DATA "${BACKUP_FULL_DATA:-1}")"
    "$(remote_env_pair ROLLBACK_ON_FAILURE "${ROLLBACK_ON_FAILURE:-1}")"
  )

  local remote_script="$REMOTE_RELEASE_DIR/remote-deploy.sh"
  local command="chmod +x $(quote_remote "$remote_script") && ${env_parts[*]} $(quote_remote "$remote_script")"

  step "Running remote release"
  ssh "${SSH_OPTS[@]}" "$target" "$command"
}

if [[ "$ACTION" == "all" || "$ACTION" == "package" ]]; then
  [[ "$SKIP_BACKEND" == "1" ]] || build_backend
  [[ "$SKIP_FRONTEND" == "1" ]] || build_frontend
  should_migrate_data && build_data_archive
fi

if [[ "$ACTION" == "all" || "$ACTION" == "upload" ]]; then
  upload_artifacts
fi

if [[ "$ACTION" == "all" || "$ACTION" == "release" ]]; then
  remote_release
fi

step "Done. ReleaseId=$RELEASE_ID"

# Deploy scripts

These scripts deploy the backend as a Docker image and deploy the frontend as static files for an existing nginx server.

## Files

- `deploy.ps1`: Windows PowerShell entry point.
- `deploy.cmd`: Windows cmd wrapper for `deploy.ps1`.
- `deploy.sh`: macOS/Linux terminal entry point.
- `remote-deploy.sh`: script uploaded to and executed on the server.
- `deploy.env.example`: local deploy config template.
- `backend.env.example`: backend runtime env template.

## First time setup

1. Copy `scripts/deploy/deploy.env.example` to `scripts/deploy/deploy.env`.
2. Fill in `SERVER_HOST`, `SERVER_USER`, URL values, and server paths.
3. Create `/opt/mianshi/backend.env` on the server, or copy `backend.env.example` to `scripts/deploy/backend.env`, fill it, and set `BACKEND_ENV_LOCAL_FILE=scripts/deploy/backend.env`.
4. Make sure the server has Docker and nginx installed.
5. Make sure nginx proxies backend routes to `127.0.0.1:8000`.

If you deploy as a non-root SSH user and need `sudo` for `/opt` or `/var/www`, keep `REMOTE_USE_SUDO=1`. If the same user is not in the Docker group, also set `DOCKER_USE_SUDO=1`.
If nginx is not on `PATH`, set `NGINX_BIN`, for example `/usr/local/nginx/sbin/nginx`.

Example nginx locations:

```nginx
location / {
  root /var/www/mianshi;
  try_files $uri $uri/ /index.html;
}

location /api/ {
  proxy_pass http://127.0.0.1:8000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location = /health {
  proxy_pass http://127.0.0.1:8000;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /uploads/ {
  proxy_pass http://127.0.0.1:8000;
}

location /snapshots/ {
  proxy_pass http://127.0.0.1:8000;
}

location /m/ {
  proxy_pass http://127.0.0.1:8000;
}
```

## Run from Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy\deploy.ps1 all
```

## Run from Windows cmd

```bat
scripts\deploy\deploy.cmd all
```

## Run from macOS/Linux terminal

```bash
chmod +x scripts/deploy/deploy.sh
./scripts/deploy/deploy.sh all
```

## Useful modes

```bash
# Build local artifacts only.
./scripts/deploy/deploy.sh package

# Upload artifacts for a known release id.
./scripts/deploy/deploy.sh upload --release-id 20260622153000

# Run the already uploaded release on the server.
./scripts/deploy/deploy.sh release --release-id 20260622153000

# Backend only.
./scripts/deploy/deploy.sh all --skip-frontend

# Frontend only.
./scripts/deploy/deploy.sh all --skip-backend
```

PowerShell supports the same modes:

```powershell
scripts\deploy\deploy.ps1 -Action package
scripts\deploy\deploy.ps1 -Action all -SkipFrontend
scripts\deploy\deploy.ps1 -Action all -SkipBackend
```

## Backup behavior

Before replacing the backend container, the server script backs up:

- the current Docker image to `$REMOTE_APP_DIR/backups/images`;
- `interviewer.db` to `$REMOTE_APP_DIR/backups/db`;
- the whole backend data directory to `$REMOTE_APP_DIR/backups/data` when `BACKUP_FULL_DATA=1`;
- the current nginx frontend web root to `$REMOTE_APP_DIR/backups/frontend`.

If the new backend fails `/health`, the script attempts to roll back to the previous backend image and database when `ROLLBACK_ON_FAILURE=1`.

## Data migration

Set `MIGRATE_LOCAL_DATA=1` to upload and extract `LOCAL_DATA_DIR` into the server backend data directory. This is useful for the first deployment when migrating the local SQLite database and uploaded files.

Keep `MIGRATE_LOCAL_DATA=0` for normal upgrades, otherwise local `backend/data` can overwrite newer server data.

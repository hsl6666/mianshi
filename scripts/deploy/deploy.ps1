[CmdletBinding()]
param(
    [ValidateSet("all", "package", "upload", "release")]
    [string]$Action = "all",
    [string]$ConfigPath = "",
    [string]$ReleaseId = "",
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipData
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message"
}

function Fail {
    param([string]$Message)
    throw $Message
}

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "Required command not found: $Name"
    }
}

function Read-DeployConfig {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Config file not found: $Path. Copy scripts/deploy/deploy.env.example to scripts/deploy/deploy.env first."
    }

    $config = @{}
    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith("#")) {
            continue
        }
        $index = $line.IndexOf("=")
        if ($index -lt 1) {
            continue
        }
        $key = $line.Substring(0, $index).Trim()
        $value = $line.Substring($index + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $config[$key] = $value
    }
    return $config
}

function Get-Cfg {
    param(
        [hashtable]$Config,
        [string]$Name,
        [string]$Default = ""
    )
    if ($Config.ContainsKey($Name) -and $Config[$Name] -ne "") {
        return $Config[$Name]
    }
    return $Default
}

function Require-Cfg {
    param(
        [hashtable]$Config,
        [string]$Name
    )
    $value = Get-Cfg $Config $Name
    if ([string]::IsNullOrWhiteSpace($value) -or $value -like "your.*") {
        Fail "Missing required config value: $Name"
    }
    return $value
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory = ""
    )
    $oldLocation = Get-Location
    try {
        if ($WorkingDirectory -ne "") {
            Set-Location -LiteralPath $WorkingDirectory
        }
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            Fail "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
        }
    }
    finally {
        Set-Location $oldLocation
    }
}

function Compress-GzipFile {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )
    $inputStream = [System.IO.File]::OpenRead($SourcePath)
    try {
        $outputStream = [System.IO.File]::Create($DestinationPath)
        try {
            $gzipStream = [System.IO.Compression.GzipStream]::new($outputStream, [System.IO.Compression.CompressionLevel]::Optimal)
            try {
                $inputStream.CopyTo($gzipStream)
            }
            finally {
                $gzipStream.Dispose()
            }
        }
        finally {
            $outputStream.Dispose()
        }
    }
    finally {
        $inputStream.Dispose()
    }
}

function Assert-NoSingleQuote {
    param(
        [string]$Name,
        [string]$Value
    )
    if ($Value -match "'") {
        Fail "$Name contains a single quote, which is not supported by this deploy script."
    }
}

function Quote-Sh {
    param([string]$Value)
    Assert-NoSingleQuote "remote value" $Value
    return "'$Value'"
}

function Set-EnvIfPresent {
    param(
        [hashtable]$Config,
        [string]$Name
    )
    $value = Get-Cfg $Config $Name
    if ($value -ne "") {
        [System.Environment]::SetEnvironmentVariable($Name, $value, "Process")
    }
}

function Join-RemotePath {
    param(
        [string]$Base,
        [string]$Child
    )
    return ($Base.TrimEnd("/") + "/" + $Child.TrimStart("/"))
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
if ($ConfigPath -eq "") {
    $ConfigPath = Join-Path $scriptDir "deploy.env"
}
$config = Read-DeployConfig $ConfigPath

if ($ReleaseId -eq "") {
    $ReleaseId = Get-Cfg $config "RELEASE_ID" (Get-Date -Format "yyyyMMddHHmmss")
}

$appName = Get-Cfg $config "APP_NAME" "mianshi"
$backendImage = Get-Cfg $config "BACKEND_IMAGE" "mianshi-backend"
$containerName = Get-Cfg $config "CONTAINER_NAME" "$appName-backend"
$remoteUploadDir = Get-Cfg $config "REMOTE_UPLOAD_DIR" "mianshi-deploy"
$remoteReleaseDir = Join-RemotePath $remoteUploadDir "releases/$ReleaseId"
$distDir = Join-Path $repoRoot "dist\deploy\$ReleaseId"
$backendArchive = Join-Path $distDir "backend-image.tar.gz"
$frontendArchive = Join-Path $distDir "frontend-dist.tar.gz"
$dataArchive = Join-Path $distDir "backend-data.tar.gz"

function Should-MigrateData {
    if ($SkipData) {
        return $false
    }
    return (Get-Cfg $config "MIGRATE_LOCAL_DATA" "0") -eq "1"
}

function Build-Backend {
    Require-Command "docker"
    New-Item -ItemType Directory -Force -Path $distDir | Out-Null

    $imageRef = "${backendImage}:${ReleaseId}"
    $backendDir = Join-Path $repoRoot "backend"
    $tarPath = Join-Path $distDir "backend-image.tar"

    Write-Step "Building backend image $imageRef"
    Invoke-Checked "docker" @("build", "-t", $imageRef, $backendDir)

    Write-Step "Saving backend image archive"
    if (Test-Path -LiteralPath $tarPath) {
        Remove-Item -LiteralPath $tarPath -Force
    }
    if (Test-Path -LiteralPath $backendArchive) {
        Remove-Item -LiteralPath $backendArchive -Force
    }
    Invoke-Checked "docker" @("save", "-o", $tarPath, $imageRef)
    Compress-GzipFile $tarPath $backendArchive
    Remove-Item -LiteralPath $tarPath -Force
}

function Build-Frontend {
    Require-Command "npm"
    Require-Command "npx"
    Require-Command "tar"
    New-Item -ItemType Directory -Force -Path $distDir | Out-Null

    foreach ($name in @(
        "VITE_API_BASE_URL",
        "VITE_PUBLIC_BASE_URL",
        "VITE_WIFI_SSID",
        "VITE_WIFI_PASSWORD",
        "VITE_WRITTEN_EXAM_SECONDS",
        "VITE_ORAL_INTERVIEW_SECONDS",
        "VITE_SNAPSHOT_COUNT"
    )) {
        Set-EnvIfPresent $config $name
    }

    $frontendDir = Join-Path $repoRoot "frontend"
    $nodeModules = Join-Path $frontendDir "node_modules"
    $shouldNpmCi = (Get-Cfg $config "FRONTEND_NPM_CI" "0") -eq "1"
    if ($shouldNpmCi -or -not (Test-Path -LiteralPath $nodeModules)) {
        Write-Step "Installing frontend dependencies with npm ci"
        Invoke-Checked "npm" @("ci") $frontendDir
    }

    Write-Step "Building frontend static files"
    Invoke-Checked "npx" @("tsc", "-b") $frontendDir
    foreach ($file in @("tsconfig.app.tsbuildinfo", "tsconfig.node.tsbuildinfo")) {
        $path = Join-Path $frontendDir $file
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }
    Invoke-Checked "npx" @("vite", "build") $frontendDir

    Write-Step "Packing frontend dist"
    if (Test-Path -LiteralPath $frontendArchive) {
        Remove-Item -LiteralPath $frontendArchive -Force
    }
    $frontendDist = Join-Path $frontendDir "dist"
    Invoke-Checked "tar" @("-czf", $frontendArchive, "-C", $frontendDist, ".")
}

function Build-DataArchive {
    Require-Command "tar"
    New-Item -ItemType Directory -Force -Path $distDir | Out-Null

    $localDataDir = Get-Cfg $config "LOCAL_DATA_DIR" "backend/data"
    if (-not [System.IO.Path]::IsPathRooted($localDataDir)) {
        $localDataDir = Join-Path $repoRoot $localDataDir
    }
    if (-not (Test-Path -LiteralPath $localDataDir)) {
        Fail "LOCAL_DATA_DIR not found: $localDataDir"
    }

    Write-Step "Packing backend data directory"
    if (Test-Path -LiteralPath $dataArchive) {
        Remove-Item -LiteralPath $dataArchive -Force
    }
    Invoke-Checked "tar" @("-czf", $dataArchive, "-C", $localDataDir, ".")
}

function Get-SshArgs {
    $serverPort = Get-Cfg $config "SERVER_PORT" "22"
    $args = @("-p", $serverPort)
    $sshKey = Get-Cfg $config "SERVER_SSH_KEY"
    if ($sshKey -ne "") {
        $args += @("-i", $sshKey)
    }
    return $args
}

function Get-ScpArgs {
    $serverPort = Get-Cfg $config "SERVER_PORT" "22"
    $args = @("-P", $serverPort)
    $sshKey = Get-Cfg $config "SERVER_SSH_KEY"
    if ($sshKey -ne "") {
        $args += @("-i", $sshKey)
    }
    return $args
}

function Get-SshTarget {
    $serverHost = Require-Cfg $config "SERVER_HOST"
    $serverUser = Require-Cfg $config "SERVER_USER"
    return "${serverUser}@${serverHost}"
}

function Upload-Artifacts {
    Require-Command "ssh"
    Require-Command "scp"

    $target = Get-SshTarget
    $sshArgs = Get-SshArgs
    $scpArgs = Get-ScpArgs

    Write-Step "Creating remote release directory $remoteReleaseDir"
    Invoke-Checked "ssh" ($sshArgs + @($target, "mkdir -p $(Quote-Sh $remoteReleaseDir)"))

    $remoteScript = Join-Path $scriptDir "remote-deploy.sh"
    Invoke-Checked "scp" ($scpArgs + @($remoteScript, "${target}:$remoteReleaseDir/remote-deploy.sh"))

    if (-not $SkipBackend) {
        if (-not (Test-Path -LiteralPath $backendArchive)) {
            Fail "Backend archive not found: $backendArchive. Run package first or use Action=all."
        }
        Invoke-Checked "scp" ($scpArgs + @($backendArchive, "${target}:$remoteReleaseDir/backend-image.tar.gz"))
    }

    if (-not $SkipFrontend) {
        if (-not (Test-Path -LiteralPath $frontendArchive)) {
            Fail "Frontend archive not found: $frontendArchive. Run package first or use Action=all."
        }
        Invoke-Checked "scp" ($scpArgs + @($frontendArchive, "${target}:$remoteReleaseDir/frontend-dist.tar.gz"))
    }

    if (Should-MigrateData) {
        if (-not (Test-Path -LiteralPath $dataArchive)) {
            Fail "Data archive not found: $dataArchive. Run package first or use Action=all."
        }
        Invoke-Checked "scp" ($scpArgs + @($dataArchive, "${target}:$remoteReleaseDir/backend-data.tar.gz"))
    }

    $backendEnvLocal = Get-Cfg $config "BACKEND_ENV_LOCAL_FILE"
    if ($backendEnvLocal -ne "") {
        $backendEnvPath = $backendEnvLocal
        if (-not [System.IO.Path]::IsPathRooted($backendEnvPath)) {
            $backendEnvPath = Join-Path $repoRoot $backendEnvPath
        }
        if (-not (Test-Path -LiteralPath $backendEnvPath)) {
            Fail "BACKEND_ENV_LOCAL_FILE not found: $backendEnvPath"
        }
        Invoke-Checked "scp" ($scpArgs + @($backendEnvPath, "${target}:$remoteReleaseDir/backend.env"))
    }
}

function Invoke-RemoteRelease {
    Require-Command "ssh"

    $target = Get-SshTarget
    $sshArgs = Get-SshArgs
    $backendArchiveRemote = ""
    $frontendArchiveRemote = ""
    if (-not $SkipBackend) {
        $backendArchiveRemote = Join-RemotePath $remoteReleaseDir "backend-image.tar.gz"
    }
    if (-not $SkipFrontend) {
        $frontendArchiveRemote = Join-RemotePath $remoteReleaseDir "frontend-dist.tar.gz"
    }
    $backendEnvSource = ""
    if ((Get-Cfg $config "BACKEND_ENV_LOCAL_FILE") -ne "") {
        $backendEnvSource = Join-RemotePath $remoteReleaseDir "backend.env"
    }
    $dataArchiveRemote = ""
    if (Should-MigrateData) {
        $dataArchiveRemote = Join-RemotePath $remoteReleaseDir "backend-data.tar.gz"
    }

    $remoteEnv = [ordered]@{
        APP_NAME = $appName
        RELEASE_ID = $ReleaseId
        APP_DIR = Get-Cfg $config "REMOTE_APP_DIR" "/opt/mianshi"
        FRONTEND_WEB_ROOT = Get-Cfg $config "REMOTE_FRONTEND_WEB_ROOT" "/var/www/mianshi"
        USE_SUDO = Get-Cfg $config "REMOTE_USE_SUDO" "1"
        DOCKER_USE_SUDO = Get-Cfg $config "DOCKER_USE_SUDO" "0"
        RELOAD_NGINX = Get-Cfg $config "RELOAD_NGINX" "1"
        NGINX_BIN = Get-Cfg $config "NGINX_BIN" "nginx"
        BACKEND_IMAGE = $backendImage
        CONTAINER_NAME = $containerName
        BACKEND_BIND_HOST = Get-Cfg $config "BACKEND_BIND_HOST" "127.0.0.1"
        BACKEND_HOST_PORT = Get-Cfg $config "BACKEND_HOST_PORT" "8000"
        BACKEND_CONTAINER_PORT = Get-Cfg $config "BACKEND_CONTAINER_PORT" "8000"
        BACKEND_ENV_FILE = Get-Cfg $config "BACKEND_ENV_REMOTE_FILE" "/opt/mianshi/backend.env"
        BACKEND_ENV_SOURCE = $backendEnvSource
        BACKEND_ARCHIVE = $backendArchiveRemote
        DATA_ARCHIVE = $dataArchiveRemote
        FRONTEND_ARCHIVE = $frontendArchiveRemote
        PUBLIC_BASE_URL = Get-Cfg $config "PUBLIC_BASE_URL"
        FRONTEND_ORIGIN = Get-Cfg $config "FRONTEND_ORIGIN"
        BACKUP_FULL_DATA = Get-Cfg $config "BACKUP_FULL_DATA" "1"
        ROLLBACK_ON_FAILURE = Get-Cfg $config "ROLLBACK_ON_FAILURE" "1"
    }

    $envPrefix = (($remoteEnv.GetEnumerator() | ForEach-Object {
        "$($_.Key)=$(Quote-Sh ([string]$_.Value))"
    }) -join " ")
    $remoteScriptPath = Join-RemotePath $remoteReleaseDir "remote-deploy.sh"
    $command = "chmod +x $(Quote-Sh $remoteScriptPath) && $envPrefix $(Quote-Sh $remoteScriptPath)"

    Write-Step "Running remote release"
    Invoke-Checked "ssh" ($sshArgs + @($target, $command))
}

if ($Action -eq "all" -or $Action -eq "package") {
    if (-not $SkipBackend) {
        Build-Backend
    }
    if (-not $SkipFrontend) {
        Build-Frontend
    }
    if (Should-MigrateData) {
        Build-DataArchive
    }
}

if ($Action -eq "all" -or $Action -eq "upload") {
    Upload-Artifacts
}

if ($Action -eq "all" -or $Action -eq "release") {
    Invoke-RemoteRelease
}

Write-Step "Done. ReleaseId=$ReleaseId"

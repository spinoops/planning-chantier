<#
.SYNOPSIS
    Derive un nouveau projet a partir du template baseapp.

.DESCRIPTION
    Copie le template (sans vendor/node_modules/.git/dist), installe les
    dependances, prepare les .env (nom, base, ports), cree la base MySQL,
    migre + seed, cree le lien storage, et initialise un depot git neuf.

    Donne des ports differents a chaque projet derive (-ApiPort / -FrontPort)
    pour pouvoir en lancer plusieurs en meme temps avec dev.bat.

.EXAMPLE
    .\new-project.ps1 -Name caisse-resto
    .\new-project.ps1 -Name caisse-resto -ApiPort 8001 -FrontPort 5174
    .\new-project.ps1 -Name caisse-resto -Database caisse_resto -Destination D:\wamp64\www\caisse-resto
#>
param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$Database,
    [string]$Destination,
    [int]$ApiPort = 8000,
    [int]$FrontPort = 5173
)

$ErrorActionPreference = 'Stop'
$template = $PSScriptRoot

if (-not $Database)    { $Database = ($Name -replace '[^0-9A-Za-z_]', '_').ToLower() }
if (-not $Destination) { $Destination = Join-Path (Split-Path $template -Parent) $Name }

Write-Host ""
Write-Host "  Nouveau projet : $Name" -ForegroundColor Cyan
Write-Host "    Source       : $template"
Write-Host "    Destination  : $Destination"
Write-Host "    Base MySQL   : $Database"
Write-Host "    Ports        : API :$ApiPort  /  Front :$FrontPort"
Write-Host ""

if (Test-Path $Destination) {
    Write-Host "[X] La destination existe deja : $Destination" -ForegroundColor Red
    exit 1
}

# --- Localise le PHP >= 8.3 le plus recent de WAMP et le place en tete du PATH ---
# (ainsi composer.bat, php et artisan utilisent tous PHP 8.3+ le temps du script)
$php = Get-ChildItem 'D:\wamp64\bin\php' -Directory -ErrorAction SilentlyContinue |
    ForEach-Object {
        if ($_.Name -match '^php(\d+)\.(\d+)\.(\d+)') {
            [pscustomobject]@{
                Version = [version]("{0}.{1}.{2}" -f $Matches[1], $Matches[2], $Matches[3])
                Exe     = Join-Path $_.FullName 'php.exe'
            }
        }
    } |
    Where-Object { $_.Version -ge [version]'8.3.0' -and (Test-Path $_.Exe) } |
    Sort-Object Version -Descending | Select-Object -First 1 -ExpandProperty Exe

if (-not $php) { Write-Host "[X] PHP 8.3+ introuvable dans D:\wamp64\bin\php." -ForegroundColor Red; exit 1 }
$env:Path = (Split-Path $php -Parent) + ';' + $env:Path

# --- Localise le client mysql de WAMP ---
$mysql = Get-ChildItem 'D:\wamp64\bin\mysql' -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'bin\mysql.exe' } |
    Where-Object { Test-Path $_ } | Sort-Object -Descending | Select-Object -First 1

# --- 1. Copie du template (exclusions des dossiers lourds/specifiques) ---
Write-Host "-> Copie des fichiers..." -ForegroundColor Green
$excludeDirs = @('vendor', 'node_modules', '.git', 'dist', '.claude')
robocopy $template $Destination /E /NFL /NDL /NJH /NJS /NP /XD @excludeDirs /XF '.env' 'guide-dev-deploiement.pdf' | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Host "[X] Echec de la copie (robocopy code $LASTEXITCODE)." -ForegroundColor Red; exit 1 }

$backend = Join-Path $Destination 'backend'
$frontend = Join-Path $Destination 'frontend'

# --- 2. Backend ---
Write-Host "-> Backend : composer install..." -ForegroundColor Green
Push-Location $backend
try {
    composer install --no-interaction --prefer-dist --no-progress
    if ($LASTEXITCODE -ne 0) { throw "composer install a echoue." }

    Copy-Item '.env.example' '.env'
    (Get-Content '.env') `
        -replace '^APP_NAME=.*', "APP_NAME=`"$Name`"" `
        -replace '^APP_URL=.*', "APP_URL=http://localhost:$ApiPort" `
        -replace '^FRONTEND_URL=.*', "FRONTEND_URL=http://localhost:$FrontPort" `
        -replace '^SANCTUM_STATEFUL_DOMAINS=.*', "SANCTUM_STATEFUL_DOMAINS=localhost:$FrontPort,127.0.0.1:$FrontPort" `
        -replace '^DB_DATABASE=.*', "DB_DATABASE=$Database" |
        Set-Content '.env' -Encoding utf8

    Write-Host "-> Backend : cle applicative..." -ForegroundColor Green
    php artisan key:generate --ansi

    if ($mysql) {
        Write-Host "-> Backend : creation de la base '$Database'..." -ForegroundColor Green
        & $mysql -u root --execute="CREATE DATABASE IF NOT EXISTS $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        if ($LASTEXITCODE -ne 0) { Write-Host "[!] Base non creee (MySQL demarre ?). Cree '$Database' puis relance migrate." -ForegroundColor Yellow }
    } else {
        Write-Host "[!] Client mysql introuvable : cree la base '$Database' manuellement." -ForegroundColor Yellow
    }

    Write-Host "-> Backend : migrate + seed..." -ForegroundColor Green
    php artisan migrate --seed --force

    Write-Host "-> Backend : lien storage (uploads)..." -ForegroundColor Green
    php artisan storage:link --force | Out-Null
}
finally { Pop-Location }

# --- 3. Frontend ---
Write-Host "-> Frontend : npm install..." -ForegroundColor Green
Push-Location $frontend
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install a echoue." }

    (Get-Content '.env.example') `
        -replace '^VITE_API_URL=.*', "VITE_API_URL=http://localhost:$ApiPort" `
        -replace '^VITE_PORT=.*', "VITE_PORT=$FrontPort" |
        Set-Content '.env' -Encoding utf8

    # Titre de l'onglet avant que la configuration ne soit chargee.
    (Get-Content 'index.html') -replace '<title>.*</title>', "<title>$Name</title>" | Set-Content 'index.html' -Encoding utf8
}
finally { Pop-Location }

# --- 4. Depot git neuf ---
Write-Host "-> Initialisation git..." -ForegroundColor Green
Push-Location $Destination
try {
    git init -q
    git add -A
    git commit -q -m "Initial commit (derive du template baseapp)"
}
finally { Pop-Location }

# --- Recap ---
Write-Host ""
Write-Host "  Projet '$Name' cree avec succes." -ForegroundColor Green
Write-Host "  Etapes suivantes :" -ForegroundColor Cyan
Write-Host "    cd `"$Destination`""
Write-Host "    .\dev.bat                 # lance backend (:$ApiPort) + frontend (:$FrontPort)"
Write-Host "    Connexion : admin@baseapp.test / password"
Write-Host ""
Write-Host "  Premiere entite metier :  backend\artisan.bat make:crud Facture --fields=`"numero:string,montant:decimal`" --front" -ForegroundColor DarkGray
Write-Host "  Pense a : configurer le remote git, relire backend\.env (mail, invitations, sauvegardes)." -ForegroundColor DarkGray

# =============================================================================
#  dev.ps1  —  Lance l'environnement de dev complet (backend + frontend).
#
#  Ouvre DEUX fenetres PowerShell :
#    - API Laravel  -> http://localhost:<APP_URL port>   (php artisan serve)
#    - SPA React    -> http://localhost:<VITE_PORT>      (npm run dev, hot-reload)
#
#  Les ports sont lus dans backend\.env (APP_URL) et frontend\.env (VITE_PORT) :
#  chaque projet derive peut ainsi tourner en meme temps que les autres
#  (voir new-project.ps1 -ApiPort / -FrontPort).
#
#  Usage :  depuis la racine du projet, clic droit > "Executer avec PowerShell"
#           ou en terminal :  .\dev.ps1
#  (equivalent double-clic : dev.bat)
# =============================================================================

$ErrorActionPreference = 'Stop'
$root     = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

# --- Lit une variable dans un fichier .env (sans evaluer les ${...}) ----------
function Get-EnvValue([string]$file, [string]$key, [string]$default) {
    if (-not (Test-Path $file)) { return $default }
    $line = Get-Content $file | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return $default }
    $value = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
    if ($value -eq '') { return $default }
    return $value
}

$appUrl    = Get-EnvValue (Join-Path $backend '.env') 'APP_URL' 'http://localhost:8000'
$apiPort   = 8000
if ($appUrl -match ':(\d+)\s*$') { $apiPort = [int]$Matches[1] }
$frontPort = [int](Get-EnvValue (Join-Path $frontend '.env') 'VITE_PORT' '5173')

# --- Localise un PHP >= 8.3 (requis par Laravel 13) --------------------------
# Le "php" du PATH Windows est souvent une vieille version WAMP (ici 8.1) qui
# ne peut PAS lancer Laravel 13. On selectionne donc automatiquement le PHP
# >= 8.3 le plus recent installe dans WAMP.
#
# Besoin d'un chemin precis ? Decommente et adapte la ligne suivante :
# $php = 'D:\wamp64\bin\php\php8.4.24\php.exe'

if (-not $php) {
    $found = Get-ChildItem 'D:\wamp64\bin\php' -Directory -ErrorAction SilentlyContinue |
        ForEach-Object {
            if ($_.Name -match '^php(\d+)\.(\d+)\.(\d+)') {
                [pscustomobject]@{
                    Version = [version]("{0}.{1}.{2}" -f $Matches[1], $Matches[2], $Matches[3])
                    Exe     = Join-Path $_.FullName 'php.exe'
                }
            }
        } |
        Where-Object { $_.Version -ge [version]'8.3.0' -and (Test-Path $_.Exe) } |
        Sort-Object Version -Descending |
        Select-Object -First 1

    if ($found) { $php = $found.Exe }
}

# --- Verifications rapides ---------------------------------------------------
if (-not $php -or -not (Test-Path $php)) {
    Write-Host "[X] Aucun PHP >= 8.3 trouve dans D:\wamp64\bin\php." -ForegroundColor Red
    Write-Host "    Installe PHP 8.3+ via WAMP, ou fixe la variable \$php en haut de dev.ps1." -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path (Join-Path $backend 'vendor'))) {
    Write-Host "[!] backend\vendor absent. Lance d'abord :  cd backend ; composer install" -ForegroundColor Yellow
}
if (-not (Test-Path (Join-Path $backend '.env'))) {
    Write-Host "[!] backend\.env absent. Copie .env.example puis :  backend\artisan.bat key:generate" -ForegroundColor Yellow
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Host "[!] frontend\node_modules absent. Lance d'abord :  cd frontend ; npm install" -ForegroundColor Yellow
}
if (-not (Test-Path (Join-Path $backend 'public\storage'))) {
    Write-Host "[!] backend\public\storage absent (uploads). Lance :  backend\artisan.bat storage:link" -ForegroundColor Yellow
}
foreach ($port in @($apiPort, $frontPort)) {
    if (Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet) {
        Write-Host "[!] Le port $port est deja utilise (un autre projet tourne ?). Change les ports dans les .env." -ForegroundColor Yellow
    }
}

# --- Commandes des deux fenetres --------------------------------------------
# `$Host (backtick) reste litteral : il s'evalue dans la fenetre enfant.
$backendCmd  = "`$Host.UI.RawUI.WindowTitle = 'API Laravel  ->  http://localhost:$apiPort'; " +
               "Set-Location '$backend'; " +
               "& '$php' artisan serve --port=$apiPort"

$frontendCmd = "`$Host.UI.RawUI.WindowTitle = 'SPA React (Vite)  ->  http://localhost:$frontPort'; " +
               "Set-Location '$frontend'; " +
               "npm run dev"

Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-Command', $backendCmd
Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-Command', $frontendCmd

# --- Recap -------------------------------------------------------------------
Write-Host ""
Write-Host "  Deux serveurs de dev lances (une fenetre chacun) :" -ForegroundColor Green
Write-Host "    - API  Laravel   http://localhost:$apiPort    (test : /api/health)"
Write-Host "    - SPA  React      http://localhost:$frontPort"
Write-Host ""
Write-Host "  PHP utilise : $php" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Rappels :"
Write-Host "    - WAMP doit tourner (icone verte) pour que MySQL reponde."
Write-Host "    - Front : les modifs .tsx s'affichent toutes seules (hot-reload)."
Write-Host "    - Back  : rafraichis l'appel API apres modif. Un changement de .env"
Write-Host "              ou de config -> Ctrl+C puis relance la fenetre API."
Write-Host "    - Nouvelle entite :  backend\artisan.bat make:crud Nom --fields=... --front"
Write-Host ""
Write-Host "  Pour arreter : ferme les deux fenetres (ou Ctrl+C dans chacune)."

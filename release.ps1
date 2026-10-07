<#
.SYNOPSIS
    Prépare une archive de mise en ligne de secours de Planning Chantier (Infomaniak),
    pour le cas où GitHub Actions serait indisponible.

.DESCRIPTION
    1. Build du front dans frontend/dist (API relative : même domaine).
    2. Copie du backend dans release\planning (sans .env, vendor de dev, logs, sauvegardes).
    3. composer install --no-dev dans la copie (le serveur n'a besoin ni de Node ni de Composer).
    4. Archive release\planning-AAAAMMJJ-HHMM.zip à décompresser dans backend/ sur le serveur.

    Le dossier cible (doc root) du site Infomaniak pointe sur backend/public.
    Ensuite : commandes artisan du § 1 de DEPLOY.md.

.EXAMPLE
    .\release.ps1
#>
$ErrorActionPreference = 'Stop'
$root     = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$outDir   = Join-Path $root 'release'
$stage    = Join-Path $outDir 'planning'

# --- PHP >= 8.3 de WAMP en tête du PATH (composer / artisan) ---
$php = Get-ChildItem 'D:\wamp64\bin\php' -Directory -ErrorAction SilentlyContinue |
    ForEach-Object {
        if ($_.Name -match '^php(\d+)\.(\d+)\.(\d+)') {
            [pscustomobject]@{ Version = [version]("{0}.{1}.{2}" -f $Matches[1], $Matches[2], $Matches[3]); Exe = Join-Path $_.FullName 'php.exe' }
        }
    } | Where-Object { $_.Version -ge [version]'8.3.0' -and (Test-Path $_.Exe) } |
    Sort-Object Version -Descending | Select-Object -First 1 -ExpandProperty Exe
if (-not $php) { throw "PHP 8.3+ introuvable dans D:\wamp64\bin\php." }
$env:Path = (Split-Path $php -Parent) + ';' + $env:Path

# --- 1. Front (API relative : on neutralise VITE_API_URL du .env de développement) ---
Write-Host "-> Build du front..." -ForegroundColor Green
$env:VITE_API_URL = ''
try {
    npm --prefix $frontend run build
    if ($LASTEXITCODE -ne 0) { throw "Build du front en échec." }
}
finally { Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue }

# --- 2. Copie du backend ---
Write-Host "-> Copie du backend..." -ForegroundColor Green
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
robocopy $backend $stage /E /NFL /NDL /NJH /NJS /NP /XD vendor node_modules tests /XF .env .env.testing *.log | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copie en échec (robocopy $LASTEXITCODE)." }

# Dossiers d'exécution vidés (on garde l'arborescence et les .gitignore).
$runtime = @('storage\logs', 'storage\framework\cache', 'storage\framework\sessions', 'storage\framework\views', 'storage\app', 'bootstrap\cache')
foreach ($dir in $runtime) {
    $full = Join-Path $stage $dir
    if (Test-Path $full) {
        Get-ChildItem $full -Recurse -File | Where-Object { $_.Name -ne '.gitignore' } | Remove-Item -Force
    }
}
# Le lien public/storage se recrée sur le serveur (artisan storage:link).
$link = Join-Path $stage 'public\storage'
if (Test-Path $link) { Remove-Item $link -Recurse -Force }

# Build du front copié dans public/ (comme le déploiement GitHub)
Copy-Item (Join-Path $frontend 'dist\*') (Join-Path $stage 'public') -Recurse -Force

# --- 3. Dépendances de production ---
Write-Host "-> composer install --no-dev..." -ForegroundColor Green
Push-Location $stage
try {
    composer install --no-dev --optimize-autoloader --no-interaction --no-progress
    if ($LASTEXITCODE -ne 0) { throw "composer install en échec." }
}
finally { Pop-Location }

# --- 4. Archive ---
$zip = Join-Path $outDir ("planning-{0}.zip" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
Write-Host "-> Archive $zip..." -ForegroundColor Green
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal

$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "  Archive prête : $zip ($size Mo)" -ForegroundColor Cyan
Write-Host "  Suite : DEPLOY.md, § 6 « Secours sans GitHub »." -ForegroundColor DarkGray

@echo off
REM ===========================================================================
REM  artisan.bat  —  Lance "php artisan" avec le bon PHP (>= 8.3) de WAMP.
REM
REM  Le "php" du PATH Windows est souvent une vieille version (8.1) incompatible
REM  avec Laravel 13. Ce wrapper selectionne automatiquement le PHP le plus
REM  recent parmi 8.4 / 8.3 installe dans WAMP.
REM
REM  Usage (depuis backend\) :   artisan migrate
REM                              artisan make:migration create_projects_table
REM                              artisan tinker
REM ===========================================================================
setlocal
set "PHPROOT=D:\wamp64\bin\php"
set "PHP="
for %%v in (8.4 8.3) do (
  if not defined PHP for /f "delims=" %%d in ('dir /b /ad /o-n "%PHPROOT%\php%%v*" 2^>nul') do (
    if not defined PHP if exist "%PHPROOT%\%%d\php.exe" set "PHP=%PHPROOT%\%%d\php.exe"
  )
)
if not defined PHP (
  echo [X] PHP 8.3+ introuvable dans %PHPROOT%. Installe-le via WAMP.
  exit /b 1
)
"%PHP%" "%~dp0artisan" %*

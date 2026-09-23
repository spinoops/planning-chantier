@echo off
REM Lanceur double-clic : demarre backend (Laravel) + frontend (Vite).
REM Delegue a dev.ps1 en contournant l'ExecutionPolicy le temps du script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1"

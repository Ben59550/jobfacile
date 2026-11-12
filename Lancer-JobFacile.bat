@echo off
title JobFacile
cd /d "%~dp0jobfacile"

if not exist node_modules (
    echo Installation des dependances...
    call npm install
)

echo Demarrage de JobFacile sur http://localhost:3000 ...
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js

echo.
echo Le serveur s'est arrete.
pause

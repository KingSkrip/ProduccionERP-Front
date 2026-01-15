@echo off
echo ===================================
echo Actualizando proyecto...
echo ===================================

echo.
echo [1/4] Obteniendo cambios de Git...
git pull origin main

echo.
echo [2/4] Instalando dependencias...
call npm install

echo.
echo [3/4] Construyendo aplicación...
call ng build --configuration production

echo.
echo [4/4] Listo! No olvides:
echo   - Reiniciar Apache
echo   - Limpiar cache del navegador (Ctrl + F5)
echo.

pause
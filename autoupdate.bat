@echo off
setlocal
cd /d "%~dp0"
title Actualizador e Instalador - Notificador WhatsApp

echo ================================================================
echo       ACTUALIZADOR E INSTALADOR - NOTIFICADOR WHATSAPP
echo ================================================================
echo.

REM -----------------------------------------------------------------
REM CONFIGURACION DEL REPOSITORIO
REM Repositorio oficial en GitHub
REM -----------------------------------------------------------------
set REPO_URL=https://github.com/matiasSerantes/NotificadorWSP.git
set RAMA=main

where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] No se encontro Git instalado en tu equipo.
    echo Descarga e instala Git desde: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

echo [1/3] Conectando con el repositorio y descargando actualizaciones...
echo Repositorio: %REPO_URL%
echo Rama: %RAMA%
echo.

if exist ".git" (
    git fetch origin %RAMA%
    git pull origin %RAMA%
) else (
    echo Inicializando repositorio local...
    git init
    git remote add origin %REPO_URL%
    git fetch origin %RAMA%
    git reset --hard origin/%RAMA%
)

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ALERTA] Ocurrio un problema al descargar los archivos.
    echo Verifica tu conexion a internet o que el repositorio este publicado.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Configurando accesos directos y arranque en Windows...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$wsh = New-Object -ComObject WScript.Shell; " ^
    "$baseDir = (Get-Item .).FullName; " ^
    "$targetVbs = Join-Path $baseDir 'windows-app\IniciarSilencioso.vbs'; " ^
    "$iconPath = Join-Path $baseDir 'windows-app\icono.ico'; " ^
    "$desk = [Environment]::GetFolderPath('Desktop'); " ^
    "$deskLink = $wsh.CreateShortcut((Join-Path $desk 'Notificador WhatsApp.lnk')); " ^
    "$deskLink.TargetPath = 'wscript.exe'; " ^
    "$deskLink.Arguments = '\"' + $targetVbs + '\"'; " ^
    "$deskLink.WorkingDirectory = (Join-Path $baseDir 'windows-app'); " ^
    "$deskLink.Description = 'Notificador de WhatsApp'; " ^
    "if (Test-Path $iconPath) { $deskLink.IconLocation = $iconPath }; " ^
    "$deskLink.Save(); " ^
    "$startFolder = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\Startup'); " ^
    "$startLink = $wsh.CreateShortcut((Join-Path $startFolder 'NotificadorWSP.lnk')); " ^
    "$startLink.TargetPath = 'wscript.exe'; " ^
    "$startLink.Arguments = '\"' + $targetVbs + '\"'; " ^
    "$startLink.WorkingDirectory = (Join-Path $baseDir 'windows-app'); " ^
    "$startLink.Description = 'Notificador de WhatsApp en Inicio'; " ^
    "if (Test-Path $iconPath) { $startLink.IconLocation = $iconPath }; " ^
    "$startLink.Save(); " ^
    "Write-Output 'Accesos directos configurados exitosamente.'"

echo.
echo [3/3] Iniciando servicio en segundo plano de Windows...
start "" wscript.exe "windows-app\IniciarSilencioso.vbs"

echo.
echo ================================================================
echo  [INSTALACION Y ACTUALIZACION COMPLETADA CON EXITO]
echo ================================================================
echo.
echo  1. App de Windows: Ya quedo iniciada en la barra de tareas
echo     al lado del reloj (icono verde de WhatsApp).
echo  2. Auto-Arranque: Ya se iniciara sola al encender la PC.
echo  3. Extension Chrome: Si usas la extension en el navegador,
echo     recuerda hacer clic en recargar en chrome://extensions
echo.
echo ================================================================
echo Presiona cualquier tecla para cerrar...
pause > nul

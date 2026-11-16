@echo off
setlocal
title Actualizador Automatico - Notificador WhatsApp

echo ================================================================
echo       ACTUALIZADOR AUTOMATICO - NOTIFICADOR WHATSAPP
echo ================================================================
echo.

REM -----------------------------------------------------------------
REM CONFIGURACION DEL REPOSITORIO
REM Repositorio oficial en GitHub
REM -----------------------------------------------------------------
set REPO_URL=https://github.com/matiasSerantes/NotificadorWSP.git
set RAMA=main

if "%REPO_URL%"=="PENDIENTE_REPOSITORIO" (
    echo [ESTADO: PENDIENTE DE REPOSITORIO]
    echo ----------------------------------------------------------------
    echo Aun no has colocado el enlace de tu repositorio Git.
    echo.
    echo Pasos para activarlo cuando tengas el repositorio:
    echo  1. Abre este archivo autoupdate.bat con el Bloc de Notas.
    echo  2. Busca la linea que dice set REPO_URL=PENDIENTE_REPOSITORIO
    echo  3. Reemplaza PENDIENTE_REPOSITORIO por la URL de tu repositorio.
    echo  4. Guarda el archivo y ejecutalo nuevamente.
    echo ----------------------------------------------------------------
    echo.
    pause
    exit /b 0
)

where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] No se encontro Git instalado en tu equipo.
    echo Descarga e instala Git desde: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

echo [1/2] Conectando con el repositorio remoto...
echo Repositorio: %REPO_URL%
echo Rama: %RAMA%
echo.

if exist ".git" (
    echo [2/2] Descargando ultimas actualizaciones...
    git fetch origin %RAMA%
    git pull origin %RAMA%
) else (
    echo [2/2] Inicializando repositorio local...
    git init
    git remote add origin %REPO_URL%
    git fetch origin %RAMA%
    git reset --hard origin/%RAMA%
)

if %ERRORLEVEL% equ 0 (
    echo.
    echo ================================================================
    echo  [EXITO] Archivos actualizados a la ultima version.
    echo ================================================================
    echo  Recuerda ir a chrome://extensions y presionar el boton
    echo  de recarga en la extension para aplicar los cambios.
    echo ================================================================
) else (
    echo.
    echo [ALERTA] Ocurrio un problema al actualizar.
    echo Verifica tu conexion a internet o el enlace del repositorio.
)

echo.
pause

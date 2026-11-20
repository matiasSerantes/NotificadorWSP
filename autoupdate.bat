@echo off
setlocal
cd /d "%~dp0"
title Actualizar Notificador WhatsApp
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Actualizar.ps1" %*
exit /b %ERRORLEVEL%

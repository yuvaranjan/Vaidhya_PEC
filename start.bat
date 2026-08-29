@echo off
REM Project Vaidhya - double-click this to install everything and start the app.
REM It is a thin wrapper so Windows users never have to think about PowerShell
REM execution policy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
if errorlevel 1 pause

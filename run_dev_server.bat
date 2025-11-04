@echo off
echo ============================================================
echo   Medichek Client - Development Server
echo ============================================================
echo.
echo Starting development server with live reload...
echo.
echo Make sure the backend server is running at:
echo   http://127.0.0.1:8000
echo.
echo ============================================================
echo.

cd /d "%~dp0"
".venv\Scripts\python.exe" dev_server.py

pause

@echo off
cd /d %~dp0

echo ======================================
echo JARVIS IMPORT
echo ======================================
echo.

if not exist "venv\Scripts\activate.bat" (
    echo [INFO] Tworzenie srodowiska Python...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Nie udalo sie utworzyc venv
        pause
        exit /b 1
    )
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

python -m jarvis_import %*
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE%==0 (
    echo [OK] Import zakonczony poprawnie.
) else (
    echo [ERROR] Import zakonczyl sie bledem. Kod: %EXITCODE%
)

echo.
pause
exit /b %EXITCODE%

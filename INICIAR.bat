@echo off
echo ============================================
echo   PASAELTEST - Iniciando aplicacion
echo ============================================
echo.

REM Verificar si Node.js esta instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js no esta instalado
    echo Descarga Node.js de: https://nodejs.org
    pause
    exit /b 1
)

REM Verificar si existe node_modules
if not exist "node_modules\" (
    echo Instalando dependencias por primera vez...
    echo Esto puede tardar 2-3 minutos...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Fallo la instalacion de dependencias
        pause
        exit /b 1
    )
)

REM Verificar si existe .env
if not exist ".env" (
    echo.
    echo ERROR: No se encuentra el archivo .env
    echo.
    echo Por favor:
    echo 1. Copia .env.example a .env
    echo 2. Edita .env y pega tus credenciales
    echo.
    pause
    exit /b 1
)

echo.
echo Iniciando servidor de desarrollo...
echo.
echo La aplicacion se abrira en: http://localhost:3000
echo.
echo Para DETENER el servidor presiona: Ctrl+C
echo ============================================
echo.

call npm run dev

pause

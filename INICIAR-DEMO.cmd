@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo No se encuentra npm. Instala Node.js y vuelve a abrir VS Code.
  exit /b 1
)
if not exist "node_modules" (
  echo Instalando dependencias de la web...
  call npm install
  if errorlevel 1 exit /b 1
)
echo Iniciando ONE. Abre la direccion que aparecera abajo.
call npm run dev:demo

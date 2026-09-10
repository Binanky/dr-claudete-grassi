@echo off
cd /d "%~dp0app"
if not exist .env copy "..\config\mysql.env.example" .env
where pnpm >nul 2>nul || (echo Instale Node.js 22 e pnpm antes de continuar. & pause & exit /b 1)
if not exist node_modules pnpm install
pnpm build
pnpm start

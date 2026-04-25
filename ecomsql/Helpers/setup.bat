@echo off
REM E-Commerce Application Setup Script for Windows

echo 🚀 E-Commerce Application Setup
echo ================================

REM Check Node.js installation
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js v14+ first.
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo ✅ Node.js installed: %NODE_VER%

REM Setup Backend
echo.
echo 📦 Setting up backend...
cd server
call npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install backend dependencies
    exit /b 1
)

echo ✅ Backend dependencies installed

REM Create uploads directory
if not exist "uploads" (
    mkdir uploads
    echo ✅ Created uploads directory
)

REM Setup Frontend
echo.
echo 🎨 Setting up frontend...
cd ..\client
call npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install frontend dependencies
    exit /b 1
)

echo ✅ Frontend dependencies installed

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Configure database in server\.env
echo 2. Run SQL scripts to create database
echo 3. Start backend: cd server ^&^& npm start
echo 4. Start frontend: cd client ^&^& npm start
echo.
echo Frontend: http://localhost:3000
echo Backend: http://localhost:5000

pause

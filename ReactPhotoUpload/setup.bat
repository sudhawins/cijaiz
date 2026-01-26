@echo off
REM Photo and Video Upload Application - Setup Script for Windows

echo.
echo ================================
echo Setting up Photo Upload App
echo ================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Desktop first.
    exit /b 1
)

echo ✅ Docker and Docker Compose are installed
echo.

REM Create uploads directory if it doesn't exist
if not exist "uploads" (
    mkdir uploads
    echo ✅ Created uploads directory
) else (
    echo ✅ Uploads directory already exists
)

REM Build images
echo.
echo Building Docker images...
docker-compose build

echo.
echo ================================
echo ✅ Setup Complete!
echo ================================
echo.
echo To start the application, run:
echo   docker-compose up
echo.
echo Then open:
echo   Frontend: http://localhost:3000
echo   API: http://localhost:5000
echo.
pause

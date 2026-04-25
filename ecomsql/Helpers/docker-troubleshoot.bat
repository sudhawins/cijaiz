@echo off
REM Docker troubleshooting helper script

echo.
echo ================================
echo Docker Build Troubleshooter
echo ================================
echo.

if "%1"=="" (
    echo Usage: docker-troubleshoot [command]
    echo.
    echo Commands:
    echo   check         Check Docker installation and connectivity
    echo   pull-test     Test pulling Docker image
    echo   alpine        Build using Dockerfile.alpine (most reliable)
    echo   clean         Clean Docker cache and volumes
    echo   rebuild       Force rebuild without cache
    echo   logs          Show detailed build logs
    echo.
    pause
    exit /b 1
)

if "%1"=="check" (
    echo [1] Checking Docker version...
    docker version >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Docker is installed
        docker version | findstr "Version"
    ) else (
        echo [FAIL] Docker is not installed or not in PATH
        exit /b 1
    )
    
    echo.
    echo [2] Checking Docker daemon...
    docker ps >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Docker daemon is running
    ) else (
        echo [FAIL] Docker daemon is not running
        echo Start Docker Desktop or run: net start com.docker.service
        exit /b 1
    )
    
    echo.
    echo [3] Checking docker-compose...
    docker-compose --version >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] docker-compose is installed
        docker-compose --version
    ) else (
        echo [FAIL] docker-compose is not installed
        exit /b 1
    )
    
    echo.
    echo [4] Testing connectivity...
    docker pull hello-world >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Docker can pull images from registry
    ) else (
        echo [FAIL] Cannot pull from Docker registry
        echo Check your internet connection
        exit /b 1
    )
    
    echo.
    echo All checks passed!
    pause
    exit /b 0
)

if "%1"=="pull-test" (
    echo Attempting to pull node:18.19.0-slim...
    docker pull node:18.19.0-slim
    pause
    exit /b %ERRORLEVEL%
)

if "%1"=="alpine" (
    echo Building using Alpine Dockerfile...
    echo.
    echo [Client]
    docker build -f client\Dockerfile.alpine -t ecommerce-client:latest .\client
    echo.
    echo [Server]
    docker build -f server\Dockerfile.alpine -t ecommerce-server:latest .\server
    echo.
    echo Building complete!
    echo.
    echo To run: docker-compose up
    echo (Make sure docker-compose.yml uses Dockerfile.alpine)
    pause
    exit /b %ERRORLEVEL%
)

if "%1"=="clean" (
    echo Cleaning Docker...
    echo Removing dangling images and volumes...
    docker system prune -a --volumes -f
    echo Done!
    pause
    exit /b 0
)

if "%1"=="rebuild" (
    echo Force rebuilding without cache...
    docker-compose down
    docker system prune -a -f --volumes
    docker-compose build --no-cache
    echo.
    echo Build complete! Run: docker-compose up
    pause
    exit /b %ERRORLEVEL%
)

if "%1"=="logs" (
    echo Building with detailed logs...
    docker-compose build --progress=plain
    pause
    exit /b %ERRORLEVEL%
)

echo Unknown command: %1
pause
exit /b 1

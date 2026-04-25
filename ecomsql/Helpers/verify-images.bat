@echo off
REM Image Loading Verification Script for Docker (Windows)
REM Tests if images are properly served through the Docker setup
REM Usage: verify-images.bat

setlocal enabledelayedexpansion

echo.
echo ==========================================
echo Image Loading Verification for Docker
echo ==========================================
echo.

REM Check if Docker is installed
echo 1. Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker is not installed or not in PATH
    exit /b 1
)
echo [OK] Docker is installed
echo.

REM Check if containers are running
echo 2. Checking Docker containers...
docker ps | findstr "ecommerce-server" >nul 2>&1
if errorlevel 1 (
    echo [X] Server container is not running
    exit /b 1
)
echo [OK] Server container is running

docker ps | findstr "ecommerce-nginx" >nul 2>&1
if errorlevel 1 (
    echo [X] Nginx container is not running
    exit /b 1
)
echo [OK] Nginx container is running
echo.

REM Check uploads directory
echo 3. Checking uploads directory...
docker exec ecommerce-server cmd /c "dir /b C:\app\uploads" >nul 2>&1
if errorlevel 1 (
    echo [X] /app/uploads directory does not exist
) else (
    echo [OK] /app/uploads directory exists in server
    for /f %%A in ('docker exec ecommerce-server cmd /c "dir /b C:\app\uploads 2^>nul ^| find /c /v """') do (
        set FILE_COUNT=%%A
    )
    echo    Found !FILE_COUNT! files
)
echo.

REM Check volume mounts
echo 4. Checking volume mounts...
docker inspect ecommerce-server | findstr "uploads" >nul 2>&1
if errorlevel 1 (
    echo [X] Uploads volume is not mounted
    echo    Fix: Ensure volumes: - ./server/uploads:/app/uploads is in docker-compose.yml
) else (
    echo [OK] Uploads volume is mounted
)
echo.

REM Test server endpoint
echo 5. Testing server /uploads endpoint...
curl -s -w "HTTP CODE: %%{http_code}\n" -o nul http://localhost:5000/uploads/ 2>nul
if errorlevel 1 (
    echo [!] Could not connect to server on port 5000
    echo    Is the server running? Check: docker logs ecommerce-server
) else (
    echo [OK] Server /uploads endpoint is accessible
)
echo.

REM Test nginx endpoint
echo 6. Testing nginx /uploads endpoint...
curl -s -w "HTTP CODE: %%{http_code}\n" -o nul http://localhost/uploads/ 2>nul
if errorlevel 1 (
    echo [!] Could not connect to nginx on port 80
    echo    Is nginx running? Check: docker logs ecommerce-nginx
) else (
    echo [OK] Nginx /uploads endpoint is accessible
)
echo.

REM Test API
echo 7. Testing API /api/products endpoint...
curl -s http://localhost/api/products | find "image_url" >nul 2>&1
if errorlevel 1 (
    echo [!] API products do not contain image_url field
) else (
    echo [OK] API returns products with image_url
)
echo.

REM Summary
echo ==========================================
echo Verification Summary
echo ==========================================
echo.
echo To test image loading in the browser:
echo   1. Open http://localhost
echo   2. Navigate to the Products page
echo   3. Check if product images are visible
echo.
echo If images are not showing:
echo   1. Check logs: docker logs ecommerce-server
echo   2. Check nginx: docker logs ecommerce-nginx
echo   3. Review DOCKER_IMAGE_LOADING.md
echo.
echo To rebuild containers:
echo   docker-compose down
echo   docker-compose build --no-cache
echo   docker-compose up -d
echo.

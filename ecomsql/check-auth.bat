@echo off
REM Token & Auth Diagnostics Script for Windows
echo.
echo ==========================================
echo ECommerce App - Token ^& Auth Diagnostics
echo ==========================================
echo.

REM Check 1: Server running
echo 📡 Checking if server is running...
curl -s http://localhost:5002/api/health > nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Server is running on port 5002
) else (
    echo ✗ Server is not running on port 5002
    echo Start server with: cd server ^&^& npm run dev
    exit /b 1
)
echo.

REM Check 2: JWT_SECRET in .env
echo 🔐 Checking JWT_SECRET configuration...
findstr /M "JWT_SECRET" server\.env > nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ JWT_SECRET found in server\.env
    for /f "tokens=2 delims==" %%A in ('findstr "JWT_SECRET" server\.env') do (
        echo   Value length: %%A characters
    )
) else (
    echo ✗ JWT_SECRET not found in server\.env
    echo Add JWT_SECRET=your-secret-key to server\.env
)
echo.

REM Check 3: Token Debug Endpoint
echo 🔍 Testing Token Debug Endpoint...
for /f "delims=" %%A in ('curl -s http://localhost:5002/api/token-debug') do (
    set "RESPONSE=%%A"
)
echo  Testing: http://localhost:5002/api/token-debug
if "%RESPONSE%"=="" (
    echo ✓ Endpoint is reachable
) else (
    echo Endpoint Status: %RESPONSE%
)
echo.

REM Check 4: Help user test with a token
echo 📝 To test with your token:
echo.
echo 1. Login to the app at http://localhost:3002
echo 2. Open browser console (F12) and run:
echo    console.log(localStorage.getItem('authToken')^)
echo 3. Copy the token and run:
echo    curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5002/api/token-debug
echo.

REM Check 5: Database connection
echo 💾 Checking Database Connection...
curl -s http://localhost:5002/api/debug | find "Connected" > nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Database is connected
) else (
    echo ⚠ Could not determine database status
)
echo.

REM Check 6: Orders endpoint test
echo 🛒 Checking Orders API...
where curl > nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%A in ('curl -s -w "%%{http_code}" http://localhost:5002/api/orders 2^>^&1') do (
        set "RESPONSE=%%A"
    )
    echo Orders endpoint requires authentication
    echo Run with Authorization header containing your token
) else (
    echo curl not found - please install curl or use browser DevTools
)
echo.

echo ==========================================
echo Diagnostics Complete!
echo ==========================================
pause

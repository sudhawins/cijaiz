@echo off
REM Database setup script for E-commerce application

echo.
echo ================================
echo E-Commerce Database Setup
echo ================================
echo.

REM Check if environment variables are set
if "%DB_SERVER%"=="" (
    echo ERROR: DB_SERVER environment variable not set
    echo Please set your environment variables or use this script:
    echo setx DB_SERVER your-server.database.windows.net
    echo setx DB_NAME your-database
    echo setx DB_USER your-username
    echo setx DB_PASSWORD your-password
    pause
    exit /b 1
)

echo Using database configuration:
echo Server: %DB_SERVER%
echo Database: %DB_NAME%
echo User: %DB_USER%
echo.

if "%1"=="" (
    echo Usage: db-setup.bat [init]
    echo.
    echo Commands:
    echo   init      Initialize database schema and seed data
    echo.
    echo Or run manually:
    echo   sqlcmd -S %DB_SERVER% -U %DB_USER% -P %DB_PASSWORD% -d %DB_NAME% -i Scripts/ecommerce.sql
    echo   sqlcmd -S %DB_SERVER% -U %DB_USER% -P %DB_PASSWORD% -d %DB_NAME% -i Scripts/ecommerce_seed.sql
    echo.
    pause
    exit /b 1
)

if "%1"=="init" (
    echo Creating database schema...
    sqlcmd -S %DB_SERVER% -U %DB_USER% -P %DB_PASSWORD% -d %DB_NAME% -i Scripts\ecommerce.sql
    
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to create schema
        pause
        exit /b 1
    )
    
    echo.
    echo Schema created successfully!
    echo.
    echo Seeding database with sample data...
    sqlcmd -S %DB_SERVER% -U %DB_USER% -P %DB_PASSWORD% -d %DB_NAME% -i Scripts\ecommerce_seed.sql
    
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to seed database
        pause
        exit /b 1
    )
    
    echo.
    echo Database setup completed successfully!
    echo.
    echo Verifying data...
    sqlcmd -S %DB_SERVER% -U %DB_USER% -P %DB_PASSWORD% -d %DB_NAME% -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' ORDER BY TABLE_NAME"
    sqlcmd -S %DB_SERVER% -U %DB_USER% -P %DB_PASSWORD% -d %DB_NAME% -Q "SELECT 'Categories' as [Table], COUNT(*) as [Records] FROM categories UNION ALL SELECT 'Products', COUNT(*) FROM products UNION ALL SELECT 'Orders', COUNT(*) FROM orders"
    
    echo.
    echo Done! Start your server with: npm start
    pause
    exit /b 0
)

echo Unknown command: %1
pause
exit /b 1

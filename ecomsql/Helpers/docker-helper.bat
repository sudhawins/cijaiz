@echo off
REM Docker helper script for E-commerce application

if "%1"=="" (
    echo.
    echo E-Commerce Docker Helper
    echo Usage: docker-helper [command]
    echo.
    echo Available commands:
    echo   up              Start all services
    echo   down            Stop all services
    echo   build           Build Docker images
    echo   logs            View logs from all services
    echo   logs-server     View server logs only
    echo   logs-client     View client logs only
    echo   shell-server    Open shell in server container
    echo   shell-client    Open shell in client container
    echo   ps              List running containers
    echo   clean           Remove containers and volumes
    echo.
    goto :eof
)

if "%1"=="up" (
    docker-compose up
    goto :eof
)

if "%1"=="down" (
    docker-compose down
    goto :eof
)

if "%1"=="build" (
    docker-compose build
    goto :eof
)

if "%1"=="logs" (
    docker-compose logs -f
    goto :eof
)

if "%1"=="logs-server" (
    docker-compose logs -f server
    goto :eof
)

if "%1"=="logs-client" (
    docker-compose logs -f client
    goto :eof
)

if "%1"=="shell-server" (
    docker-compose exec server /bin/sh
    goto :eof
)

if "%1"=="shell-client" (
    docker-compose exec client /bin/sh
    goto :eof
)

if "%1"=="ps" (
    docker-compose ps
    goto :eof
)

if "%1"=="clean" (
    docker-compose down -v
    goto :eof
)

echo Unknown command: %1
echo Run 'docker-helper' without arguments to see available commands.

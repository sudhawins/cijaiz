#!/bin/bash
# Docker helper script for E-commerce application

show_help() {
    echo ""
    echo "E-Commerce Docker Helper"
    echo "Usage: ./docker-helper.sh [command]"
    echo ""
    echo "Available commands:"
    echo "  up              Start all services"
    echo "  down            Stop all services"
    echo "  build           Build Docker images"
    echo "  logs            View logs from all services"
    echo "  logs-server     View server logs only"
    echo "  logs-client     View client logs only"
    echo "  shell-server    Open shell in server container"
    echo "  shell-client    Open shell in client container"
    echo "  ps              List running containers"
    echo "  clean           Remove containers and volumes"
    echo ""
}

if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

case "$1" in
    up)
        docker-compose up
        ;;
    down)
        docker-compose down
        ;;
    build)
        docker-compose build
        ;;
    logs)
        docker-compose logs -f
        ;;
    logs-server)
        docker-compose logs -f server
        ;;
    logs-client)
        docker-compose logs -f client
        ;;
    shell-server)
        docker-compose exec server /bin/sh
        ;;
    shell-client)
        docker-compose exec client /bin/sh
        ;;
    ps)
        docker-compose ps
        ;;
    clean)
        docker-compose down -v
        ;;
    *)
        echo "Unknown command: $1"
        echo "Run './docker-helper.sh' without arguments to see available commands."
        exit 1
        ;;
esac

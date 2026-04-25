#!/bin/bash
# Docker troubleshooting helper script

show_help() {
    echo ""
    echo "================================"
    echo "Docker Build Troubleshooter"
    echo "================================"
    echo ""
    echo "Usage: ./docker-troubleshoot.sh [command]"
    echo ""
    echo "Commands:"
    echo "  check         Check Docker installation and connectivity"
    echo "  pull-test     Test pulling Docker image"
    echo "  alpine        Build using Dockerfile.alpine (most reliable)"
    echo "  clean         Clean Docker cache and volumes"
    echo "  rebuild       Force rebuild without cache"
    echo "  logs          Show detailed build logs"
    echo ""
}

if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

case "$1" in
    check)
        echo "[1] Checking Docker version..."
        docker version > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "[OK] Docker is installed"
            docker version | grep "Version"
        else
            echo "[FAIL] Docker is not installed or not in PATH"
            exit 1
        fi
        
        echo ""
        echo "[2] Checking Docker daemon..."
        docker ps > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "[OK] Docker daemon is running"
        else
            echo "[FAIL] Docker daemon is not running"
            echo "Run: sudo systemctl start docker"
            exit 1
        fi
        
        echo ""
        echo "[3] Checking docker-compose..."
        docker-compose --version > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "[OK] docker-compose is installed"
            docker-compose --version
        else
            echo "[FAIL] docker-compose is not installed"
            exit 1
        fi
        
        echo ""
        echo "[4] Testing connectivity..."
        docker pull hello-world > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "[OK] Docker can pull images from registry"
        else
            echo "[FAIL] Cannot pull from Docker registry"
            echo "Check your internet connection"
            exit 1
        fi
        
        echo ""
        echo "All checks passed!"
        ;;
    
    pull-test)
        echo "Attempting to pull node:18.19.0-slim..."
        docker pull node:18.19.0-slim
        ;;
    
    alpine)
        echo "Building using Alpine Dockerfile..."
        echo ""
        echo "[Client]"
        docker build -f client/Dockerfile.alpine -t ecommerce-client:latest ./client
        echo ""
        echo "[Server]"
        docker build -f server/Dockerfile.alpine -t ecommerce-server:latest ./server
        echo ""
        echo "Building complete!"
        echo ""
        echo "To run: docker-compose up"
        echo "(Make sure docker-compose.yml uses Dockerfile.alpine)"
        ;;
    
    clean)
        echo "Cleaning Docker..."
        echo "Removing dangling images and volumes..."
        docker system prune -a --volumes -f
        echo "Done!"
        ;;
    
    rebuild)
        echo "Force rebuilding without cache..."
        docker-compose down
        docker system prune -a -f --volumes
        docker-compose build --no-cache
        echo ""
        echo "Build complete! Run: docker-compose up"
        ;;
    
    logs)
        echo "Building with detailed logs..."
        docker-compose build --progress=plain
        ;;
    
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

#!/bin/bash

# Photo and Video Upload Application - Setup Script

set -e

echo "================================"
echo "Setting up Photo Upload App"
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Create uploads directory if it doesn't exist
if [ ! -d "uploads" ]; then
    mkdir -p uploads
    echo "✅ Created uploads directory"
fi

# Set permissions
chmod 755 uploads
echo "✅ Set permissions for uploads directory"

# Build images
echo ""
echo "Building Docker images..."
docker-compose build

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "To start the application, run:"
echo "  docker-compose up"
echo ""
echo "Then open:"
echo "  Frontend: http://localhost:3000"
echo "  API: http://localhost:5000"
echo ""

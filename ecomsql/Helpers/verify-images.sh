#!/bin/bash

# Image Loading Verification Script for Docker
# Tests if images are properly served through the Docker setup
# Usage: bash verify-images.sh

echo "=========================================="
echo "Image Loading Verification for Docker"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "1. Checking Docker status..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker daemon is not running${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Check if containers are running
echo "2. Checking Docker containers..."
if docker ps | grep -q ecommerce-server; then
    echo -e "${GREEN}✓ Server container is running${NC}"
else
    echo -e "${RED}✗ Server container is not running${NC}"
    exit 1
fi

if docker ps | grep -q ecommerce-nginx; then
    echo -e "${GREEN}✓ Nginx container is running${NC}"
else
    echo -e "${RED}✗ Nginx container is not running${NC}"
    exit 1
fi
echo ""

# Check if uploads directory exists in container
echo "3. Checking uploads directory..."
if docker exec ecommerce-server test -d /app/uploads; then
    echo -e "${GREEN}✓ /app/uploads directory exists in server${NC}"
    
    FILE_COUNT=$(docker exec ecommerce-server sh -c 'ls -1 /app/uploads 2>/dev/null | wc -l')
    if [ "$FILE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Found $FILE_COUNT image files${NC}"
        echo "   Sample files:"
        docker exec ecommerce-server sh -c 'ls -1 /app/uploads | head -3' | sed 's/^/   - /'
    else
        echo -e "${YELLOW}⚠ No image files in /app/uploads${NC}"
    fi
else
    echo -e "${RED}✗ /app/uploads directory does not exist${NC}"
fi
echo ""

# Check if volumes are mounted
echo "4. Checking volume mounts..."
VOLUME_STATUS=$(docker inspect ecommerce-server --format='{{json .Mounts}}' | grep -o '/app/uploads')
if [ -n "$VOLUME_STATUS" ]; then
    echo -e "${GREEN}✓ Uploads volume is mounted${NC}"
else
    echo -e "${RED}✗ Uploads volume is not mounted${NC}"
    echo "   Fix: Ensure docker-compose.yml has 'volumes: - ./server/uploads:/app/uploads'"
fi
echo ""

# Test server image endpoint
echo "5. Testing image endpoints..."
echo "   Testing http://localhost:5000/uploads/"
HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null http://localhost:5000/uploads/)
if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Server /uploads endpoint responds (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠ Server /uploads returned HTTP $HTTP_CODE${NC}"
fi
echo ""

# Test nginx proxying
echo "6. Testing nginx proxying..."
echo "   Testing http://localhost/uploads/"
NGINX_HTTP=$(curl -s -w "%{http_code}" -o /dev/null http://localhost/uploads/)
if [ "$NGINX_HTTP" = "403" ] || [ "$NGINX_HTTP" = "200" ]; then
    echo -e "${GREEN}✓ Nginx /uploads endpoint responds (HTTP $NGINX_HTTP)${NC}"
else
    echo -e "${YELLOW}⚠ Nginx /uploads returned HTTP $NGINX_HTTP${NC}"
fi
echo ""

# Test API products endpoint
echo "7. Testing API products endpoint..."
echo "   Testing http://localhost/api/products"
API_RESPONSE=$(curl -s http://localhost/api/products)
if [ -n "$API_RESPONSE" ] && echo "$API_RESPONSE" | grep -q "image_url"; then
    echo -e "${GREEN}✓ API returns products with image_url field${NC}"
    SAMPLE_URL=$(echo "$API_RESPONSE" | grep -o '"image_url":"[^"]*"' | head -1 | sed 's/"image_url":"\(.*\)"/\1/')
    if [ -n "$SAMPLE_URL" ]; then
        echo -e "   Sample image_url: ${NC}$SAMPLE_URL"
    fi
else
    echo -e "${YELLOW}⚠ API response does not contain image_url${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""
echo "To test image loading in the browser:"
echo "  1. Open http://localhost"
echo "  2. Navigate to the Products page"
echo "  3. Check if product images are visible"
echo ""
echo "If images are not showing:"
echo "  1. Check server logs: docker logs ecommerce-server"
echo "  2. Check nginx logs: docker logs ecommerce-nginx"
echo "  3. Review DOCKER_IMAGE_LOADING.md for troubleshooting"
echo ""
echo "To rebuild with fresh images:"
echo "  docker-compose down"
echo "  docker-compose build --no-cache"
echo "  docker-compose up -d"
echo ""

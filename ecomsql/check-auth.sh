#!/bin/bash
# Token & Auth Diagnostics Script

echo "=========================================="
echo "ECommerce App - Token & Auth Diagnostics"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Server running
echo "📡 Checking if server is running..."
if curl -s http://localhost:5002/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running on port 5002${NC}"
else
    echo -e "${RED}✗ Server is not running on port 5002${NC}"
    echo "  Start server with: cd server && npm run dev"
    exit 1
fi
echo ""

# Check 2: JWT_SECRET in .env
echo "🔐 Checking JWT_SECRET configuration..."
if grep -q "JWT_SECRET" server/.env 2>/dev/null; then
    echo -e "${GREEN}✓ JWT_SECRET found in server/.env${NC}"
    JWT_SECRET=$(grep "JWT_SECRET" server/.env | cut -d'=' -f2 | xargs)
    if [ -z "$JWT_SECRET" ]; then
        echo -e "${RED}✗ JWT_SECRET is empty${NC}"
    else
        echo "  Value length: ${#JWT_SECRET} characters"
    fi
else
    echo -e "${RED}✗ JWT_SECRET not found in server/.env${NC}"
    echo "  Add JWT_SECRET=your-secret-key to server/.env"
fi
echo ""

# Check 3: Token Debug Endpoint
echo "🔍 Testing Token Debug Endpoint..."
RESPONSE=$(curl -s http://localhost:5002/api/token-debug)
if echo "$RESPONSE" | grep -q "No token provided"; then
    echo -e "${YELLOW}⚠ Endpoint is working (no token provided, as expected)${NC}"
    echo "  Next: Provide a token via Authorization header"
else
    echo "  Response: $RESPONSE"
fi
echo ""

# Check 4: Help user test with a token
echo "📝 To test with your token:"
echo "  1. Login to the app at http://localhost:3002"
echo "  2. Open browser console (F12) and run:"
echo "     console.log(localStorage.getItem('authToken'))"
echo "  3. Copy the token and run:"
echo "     curl -H \"Authorization: Bearer YOUR_TOKEN\" http://localhost:5002/api/token-debug"
echo ""

# Check 5: Database connection
echo "💾 Checking Database Connection..."
DB_RESPONSE=$(curl -s http://localhost:5002/api/debug | grep -o '"connectionStatus":"[^"]*"')
if echo "$DB_RESPONSE" | grep -q "Connected"; then
    echo -e "${GREEN}✓ Database is connected${NC}"
elif echo "$DB_RESPONSE" | grep -q "connectionStatus"; then
    echo "  Database status: $DB_RESPONSE"
else
    echo -e "${YELLOW}⚠ Could not determine database status${NC}"
fi
echo ""

# Check 6: Orders endpoint test
echo "🛒 Checking Orders API..."
ORDERS_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:5002/api/orders 2>&1)
HTTP_CODE=$(echo "$ORDERS_RESPONSE" | tail -n1)
BODY=$(echo "$ORDERS_RESPONSE" | head -n1)

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${YELLOW}⚠ Orders endpoint requires authentication (401)${NC}"
    echo "  This is expected - requests need valid token in Authorization header"
elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Orders endpoint accessible${NC}"
    echo "  Response: $BODY"
else
    echo -e "${RED}✗ Orders endpoint error (HTTP $HTTP_CODE)${NC}"
    echo "  Response: $BODY"
fi
echo ""

echo "=========================================="
echo "Diagnostics Complete!"
echo "=========================================="

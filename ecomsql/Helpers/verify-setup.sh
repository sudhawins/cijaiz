#!/bin/bash
# Quick verification script for E-commerce application

echo ""
echo "================================"
echo "E-Commerce Verification"
echo "================================"
echo ""

# Check if node is installed
echo "[1/5] Checking Node.js..."
if command -v node &> /dev/null; then
    echo "[OK] Node.js is installed:"
    node --version
else
    echo "[FAIL] Node.js not found"
    exit 1
fi

# Check if npm is installed
echo "[2/5] Checking npm..."
if command -v npm &> /dev/null; then
    echo "[OK] npm is installed:"
    npm --version
else
    echo "[FAIL] npm not found"
    exit 1
fi

# Check if .env file exists
echo "[3/5] Checking configuration (.env file)..."
if [ -f ".env" ]; then
    echo "[OK] .env file found"
else
    if [ -f ".env.example" ]; then
        echo "[WARN] .env file not found, but .env.example exists"
        echo "Please run: cp .env.example .env"
        echo "Then edit .env with your database credentials"
    else
        echo "[FAIL] Neither .env nor .env.example found"
        exit 1
    fi
fi

# Check if server/package.json exists
echo "[4/5] Checking server installation..."
if [ -f "server/package.json" ]; then
    echo "[OK] Server project found"
else
    echo "[FAIL] Server project not found"
    exit 1
fi

# Check if client/package.json exists
echo "[5/5] Checking client installation..."
if [ -f "client/package.json" ]; then
    echo "[OK] Client project found"
else
    echo "[FAIL] Client project not found"
    exit 1
fi

echo ""
echo "================================"
echo "Verification Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Start the server:"
echo "   cd server"
echo "   npm start"
echo ""
echo "2. In another terminal, start the client:"
echo "   cd client"
echo "   npm start"
echo ""
echo "3. If you see no products, check:"
echo "   curl http://localhost:5000/api/debug"
echo ""
echo "4. For detailed help, see DEBUGGING.md"
echo ""

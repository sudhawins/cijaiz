#!/bin/bash

echo "🚀 E-Commerce Application Setup"
echo "================================"

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v14+ first."
    exit 1
fi

echo "✅ Node.js installed: $(node -v)"

# Setup Backend
echo ""
echo "📦 Setting up backend..."
cd server
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

echo "✅ Backend dependencies installed"

# Create uploads directory
if [ ! -d "uploads" ]; then
    mkdir uploads
    echo "✅ Created uploads directory"
fi

# Setup Frontend
echo ""
echo "🎨 Setting up frontend..."
cd ../client
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

echo "✅ Frontend dependencies installed"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure database in server/.env"
echo "2. Run SQL scripts to create database"
echo "3. Start backend: cd server && npm start"
echo "4. Start frontend: cd client && npm start"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:5000"

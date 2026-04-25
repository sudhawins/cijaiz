#!/bin/bash
# Database setup script for E-commerce application

echo ""
echo "================================"
echo "E-Commerce Database Setup"
echo "================================"
echo ""

# Check if environment variables are set
if [ -z "$DB_SERVER" ]; then
    echo "ERROR: DB_SERVER environment variable not set"
    echo "Please set your environment variables:"
    echo "  export DB_SERVER=your-server.database.windows.net"
    echo "  export DB_NAME=your-database"
    echo "  export DB_USER=your-username"
    echo "  export DB_PASSWORD=your-password"
    exit 1
fi

echo "Using database configuration:"
echo "Server: $DB_SERVER"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

if [ -z "$1" ]; then
    echo "Usage: ./db-setup.sh [init]"
    echo ""
    echo "Commands:"
    echo "  init      Initialize database schema and seed data"
    echo ""
    echo "Or run manually:"
    echo "  sqlcmd -S $DB_SERVER -U $DB_USER -P '$DB_PASSWORD' -d $DB_NAME -i Scripts/ecommerce.sql"
    echo "  sqlcmd -S $DB_SERVER -U $DB_USER -P '$DB_PASSWORD' -d $DB_NAME -i Scripts/ecommerce_seed.sql"
    echo ""
    exit 1
fi

if [ "$1" = "init" ]; then
    echo "Creating database schema..."
    sqlcmd -S "$DB_SERVER" -U "$DB_USER" -P "$DB_PASSWORD" -d "$DB_NAME" -i Scripts/ecommerce.sql
    
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create schema"
        exit 1
    fi
    
    echo ""
    echo "Schema created successfully!"
    echo ""
    echo "Seeding database with sample data..."
    sqlcmd -S "$DB_SERVER" -U "$DB_USER" -P "$DB_PASSWORD" -d "$DB_NAME" -i Scripts/ecommerce_seed.sql
    
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to seed database"
        exit 1
    fi
    
    echo ""
    echo "Database setup completed successfully!"
    echo ""
    echo "Verifying data..."
    sqlcmd -S "$DB_SERVER" -U "$DB_USER" -P "$DB_PASSWORD" -d "$DB_NAME" -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' ORDER BY TABLE_NAME"
    sqlcmd -S "$DB_SERVER" -U "$DB_USER" -P "$DB_PASSWORD" -d "$DB_NAME" -Q "SELECT 'Categories' as [Table], COUNT(*) as [Records] FROM categories UNION ALL SELECT 'Products', COUNT(*) FROM products UNION ALL SELECT 'Orders', COUNT(*) FROM orders"
    
    echo ""
    echo "Done! Start your server with: npm start"
    exit 0
fi

echo "Unknown command: $1"
exit 1

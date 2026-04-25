# Debugging Guide

## Issue: Unable to See Products or Orders from Database

### Quick Diagnostic Steps

1. **Check Server Connection**
   ```bash
   curl http://localhost:5000/api/health
   ```
   Should return: `{"status":"Server is running"}`

2. **Run Database Debug Endpoint** (NEW)
   ```bash
   curl http://localhost:5000/api/debug
   ```
   This will show:
   - Database connection status
   - Number of products and orders in database
   - Sample data from each table
   - Any connection errors

3. **Check Server Console Logs**
   Look at the server terminal for messages like:
   ```
   [DEBUG] Fetching products with query:...
   [DEBUG] Products query returned: 0 records
   [DEBUG] Total products in database: 0
   ```

### Common Issues & Solutions

#### Issue 1: Database Connection Error
**Symptoms:**
- Debug endpoint returns connection error
- Server logs show `[ERROR] Database connection error`
- Error code `ELOGIN`

**Solution:**
1. Verify `.env` file has correct database credentials:
   ```
   DB_SERVER=your-server.database.windows.net
   DB_NAME=your-database
   DB_USER=your-username
   DB_PASSWORD=your-password
   ```
2. Ensure SQL Server is running and accessible
3. Check firewall rules allow connection to database server
4. Verify you're connected to the correct network (if VPN required)

#### Issue 2: Tables Don't Exist
**Symptoms:**
- Debug endpoint returns error with code `EREQUEST`
- Server logs show `Invalid object name`

**Solution:**
1. Run the database schema creation script:
   ```bash
   # In SQL Server Management Studio or using sqlcmd:
   sqlcmd -S your-server -U your-user -P your-password -d your-database -i Scripts/ecommerce.sql
   ```
2. Verify tables were created:
   ```sql
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'
   ```

#### Issue 3: No Data in Database
**Symptoms:**
- Debug endpoint shows `products: 0` and `orders: 0`
- Connection is working fine

**Solution:**
1. Insert sample data using the seed script:
   ```bash
   sqlcmd -S your-server -U your-user -P your-password -d your-database -i Scripts/ecommerce_seed.sql
   ```
2. Verify data was inserted:
   ```sql
   SELECT COUNT(*) as product_count FROM products;
   SELECT COUNT(*) as category_count FROM categories;
   SELECT COUNT(*) as order_count FROM orders;
   ```

#### Issue 4: API Returns Empty Array (Connected but No Data)
**Symptoms:**
- `/api/health` returns `200 OK`
- `/api/debug` shows tables are empty
- Frontend shows "No products found"

**Solution:**
This is expected behavior. You need to:
1. Run the seed script to add sample data (see Issue 3)
2. Or manually insert products and categories through the frontend "Add Products" page

### Step-by-Step Setup Verification

1. **Start the server:**
   ```bash
   cd server
   npm install
   npm start
   ```

2. **Check health:**
   ```bash
   curl http://localhost:5000/api/health
   ```

3. **Run debug check:**
   ```bash
   curl http://localhost:5000/api/debug
   ```

4. **Review output:**
   - Look for `connectionStatus: "Connected"`
   - Check table record counts
   - Look at `sampleProducts` and `sampleOrders`

5. **If database is empty:**
   ```bash
   # Connect to your database and run:
   sqlcmd -S YOUR_SERVER -U YOUR_USER -P YOUR_PASSWORD -d YOUR_DB -i Scripts/ecommerce.sql
   sqlcmd -S YOUR_SERVER -U YOUR_USER -P YOUR_PASSWORD -d YOUR_DB -i Scripts/ecommerce_seed.sql
   ```

6. **Restart server and check again:**
   ```bash
   curl http://localhost:5000/api/debug
   ```

### Server Logs to Watch For

**Success:**
```
[DEBUG] Fetching products with query: SELECT p.id...
[DEBUG] Products query returned: 8 records
```

**Connection Error:**
```
[ERROR] Products endpoint error: Error: Login failed for user 'sa'
[ERROR] Error details: { code: 'ELOGIN' }
```

**Tables Don't Exist:**
```
[ERROR] Products endpoint error: Error: Invalid object name 'products'
[ERROR] Error details: { number: 208 }
```

### Manual Testing with SQL

Connect to your database and run these queries:

```sql
-- Check if tables exist
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'dbo' 
ORDER BY TABLE_NAME;

-- Count records in each table
SELECT 'categories' as TableName, COUNT(*) as RecordCount FROM categories
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'cart_items', COUNT(*) FROM cart_items;

-- Get sample products
SELECT TOP 5 id, name, price, stock FROM products;

-- Get sample orders
SELECT TOP 5 id, order_number, total_amount, status FROM orders;
```

### Environment Variable Troubleshooting

If debug shows wrong server name, verify `.env` file:

```bash
# On Windows PowerShell:
Get-Content .env

# On Linux/Mac:
cat .env
```

Should show:
```
DB_SERVER=your-actual-server
DB_NAME=your-actual-database
DB_USER=your-actual-username
DB_PASSWORD=your-actual-password
```

### Frontend Issues Despite Database Working

If backend is working but frontend still shows no data:

1. **Check network request:**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Click Products page
   - Look for request to `/api/products`
   - Check Status (should be 200)
   - Check Response (should show array of products)

2. **Check frontend logs:**
   - In DevTools Console tab
   - Look for any JavaScript errors
   - Verify `REACT_APP_API_URL` environment variable

### Need More Help?

1. Check the [README.md](README.md) for setup instructions
2. Review [DOCKER.md](DOCKER.md) if using Docker
3. Run the debug endpoint and share the output
4. Check server console logs for `[DEBUG]` and `[ERROR]` messages

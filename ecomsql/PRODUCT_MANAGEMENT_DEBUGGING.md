# Product Management - Debugging Checklist

## Step 1: Check Browser Console (F12)
Open your browser and press **F12** to open Developer Tools.

**Look for these messages:**

### ✅ GOOD - What you should see:
```
[ProductManagement] Component mounted, loading products
[getProducts] Token present: true
[getProducts] Token length: XXX
[ProductManagement] API response: {data: Array(5), pagination: {...}}
[ProductManagement] Products loaded: 5
```

### ❌ BAD - Common Issues and What They Mean:

**Issue 1: "Token present: false"**
```
[getProducts] Token present: false
```
- **Cause**: You're not logged in, or token was lost
- **Fix**: Log out and log back in
- **Verify**: Check localStorage by running in console: `localStorage.getItem('authToken')`

---

**Issue 2: "error: Request failed with status code 401"**
```
[ProductManagement] Error loading products: 
AxiosError {message: 'Request failed with status code 401', code: 'ERR_BAD_REQUEST'}
```
- **Cause**: Token is invalid or expired
- **Fix**: Clear browser cache/localStorage, log in again
- **Verify**: Open DevTools → Application → localStorage → check authToken

---

**Issue 3: "API response with 0 products"**
```
[ProductManagement] API response: {data: Array(0), pagination: {page: 1, total: 0}}
[ProductManagement] Products loaded: 0
```
- **Cause**: Either:
  - No products exist in database
  - Products exist but don't belong to your seller account
  - seller_id was NULL in old seed data
- **Fix**: 
  - Option A: Create a new product via Sell tab
  - Option B: Run database migration to assign existing products

---

## Step 2: Check Server Logs

When you navigate to Product Management, check your **Node.js server console** for:

```
[PRODUCTS] ========== REQUEST RECEIVED ==========
[PRODUCTS] Query params: { categoryId: undefined, search: undefined, sellerOnly: 'true', ... }
[PRODUCTS] Auth status: AUTHENTICATED
[PRODUCTS] User details: { userId: 123, userName: 'seller@email.com', roleType: 'Seller' }
[PRODUCTS] Authorization header: PRESENT
[PRODUCTS] ✓ FILTERING BY SELLER - seller_id: 123
[PRODUCTS] Products query returned: 5 records, Total: 5
```

### If you see "NOT AUTHENTICATED" or "CANNOT FILTER BY SELLER":
- Token is not being verified correctly
- Check auth middleware
- Verify jwt secret in .env

---

## Step 3: Run Database Diagnostic

Run this SQL script against your database:
```
Scripts/scripts-diagnostics-products.sql
```

Check the output:
- **Do products exist?** (Check "TOTAL PRODUCTS IN DATABASE")
- **Do they have seller_id?** (Check "PRODUCTS WITHOUT SELLER_ID")
- **Are you a seller?** (Check "SELLER/ADMIN USERS" - do you see your email?)

---

## Step 4: Database Migrations (If Needed)

If products exist but show seller_id = NULL, run:
```sql
Scripts/assign_products_to_seller.sql
```

This will assign all NULL-seller products to the first admin user.

---

## Step 5: Create a Test Product

1. Go to **Sell** tab
2. Fill in all required fields:
   - Product Name
   - Category
   - Price
   - **SKU (now mandatory)**
   - Stock (optional)
3. Click "Create Product"
4. You should see a success message
5. Go back to **Product Management** - product should appear

---

## Essential Checklist

- [ ] Browser console shows "Token present: true"
- [ ] Server console shows "Auth status: AUTHENTICATED"
- [ ] Server console shows "✓ FILTERING BY SELLER - seller_id: XXX"
- [ ] Database shows products with your seller_id
- [ ] Can create at least one test product
- [ ] Test product appears in Product Management

---

## Quick Test Commands (Run in Browser Console)

```javascript
// Check if token exists
console.log('Token:', localStorage.getItem('authToken')?.substring(0, 20) + '...');

// Check user info
console.log('User:', localStorage.getItem('user'));

// Check API base URL
console.log('API URL:', document.querySelector('[data-api-url]')?.dataset.apiUrl);
```

---

## Still Not Working?

1. Check exact error message in browser console
2. Take a screenshot of server logs when you navigate to Product Management
3. Run the diagnostic SQL script and share the results
4. Verify:
   - You're logged in as a SELLER (not customer)
   - Your seller account has an Id in the database
   - At least one product exists with that seller_id

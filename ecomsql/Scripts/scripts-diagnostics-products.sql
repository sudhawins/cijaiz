-- Comprehensive Product Management Diagnostics
-- Run this script to identify why products aren't showing

PRINT '=========================================';
PRINT '  PRODUCT MANAGEMENT DIAGNOSTICS';
PRINT '=========================================';

-- 1. Check total products
PRINT '';
PRINT '1. TOTAL PRODUCTS IN DATABASE:';
SELECT COUNT(*) as total_products FROM products;

-- 2. Check products with seller_id
PRINT '';
PRINT '2. PRODUCTS WITH VALID SELLER_ID:';
SELECT COUNT(*) as products_with_seller 
FROM products 
WHERE seller_id IS NOT NULL;

-- 3. Check products without seller_id
PRINT '';
PRINT '3. PRODUCTS WITHOUT SELLER_ID (invisible to sellers):';
SELECT COUNT(*) as products_without_seller
FROM products 
WHERE seller_id IS NULL;

-- 4. Show all users who have Seller or Administrator role
PRINT '';
PRINT '4. SELLER/ADMIN USERS:';
SELECT 
    u.Id,
    u.Email,
    u.Name,
    STRING_AGG(r.Name, ',') as roles
FROM [User] u
LEFT JOIN UserRole ur ON u.Id = ur.UserId
LEFT JOIN Role r ON ur.RoleId = r.Id
WHERE r.Name IN ('Seller', 'Administrator')
GROUP BY u.Id, u.Email, u.Name
ORDER BY u.Id;

-- 5. List all products with their seller info
PRINT '';
PRINT '5. ALL PRODUCTS AND ASSIGNED SELLERS:';
SELECT 
    p.id,
    p.name,
    p.sku,
    p.price,
    p.stock,
    p.seller_id,
    ISNULL(u.Email, 'NOT ASSIGNED') as seller_email,
    ISNULL(u.Name, 'NO SELLER') as seller_name,
    p.created_at
FROM products p
LEFT JOIN [User] u ON p.seller_id = u.Id
ORDER BY p.seller_id DESC, p.id DESC;

-- 6. Count products per seller
PRINT '';
PRINT '6. PRODUCTS COUNT PER SELLER:';
SELECT 
    ISNULL(u.Email, 'UNASSIGNED') as seller_email,
    COUNT(p.id) as product_count
FROM products p
LEFT JOIN [User] u ON p.seller_id = u.Id
GROUP BY u.Id, u.Email
ORDER BY COUNT(p.id) DESC;

-- 7. Check for duplicate/invalid SKU
PRINT '';
PRINT '7. SKU VALIDATION:';
SELECT 
    'NULL SKUs' as sku_issue,
    COUNT(*) as count
FROM products
WHERE sku IS NULL
UNION ALL
SELECT 
    'DUPLICATE SKUs',
    COUNT(*) - COUNT(DISTINCT sku) 
FROM products
WHERE sku IS NOT NULL;

-- 8. Show the seller_id column info
PRINT '';
PRINT '8. SELLER_ID COLUMN INFO:';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'seller_id';

PRINT '';
PRINT '=========================================';
PRINT '  WHAT TO DO NEXT:';
PRINT '=========================================';
PRINT '';
PRINT 'IF: No products exist';
PRINT '  -> Create a product via the Sell tab';
PRINT '';
PRINT 'IF: Products exist but all have seller_id = NULL';
PRINT '  -> Run: Scripts/assign_products_to_seller.sql';
PRINT '';
PRINT 'IF: Products exist with seller_id, but still not showing';
PRINT '  -> Check your browser console (F12) for errors';
PRINT '  -> Check server logs for auth/filtering issues';
PRINT '  -> Verify you''re logged in as the correct seller';
PRINT '';
PRINT 'IF: Some products show, but not all';
PRINT '  -> It might be working! Verify you''re viewing';
PRINT '     products that belong to YOUR seller account';

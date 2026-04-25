-- Quick diagnosis script for product loading issue
-- Run this against your database to identify the problem

PRINT '====== PRODUCT LOADING DIAGNOSIS ======';
PRINT '';

-- Step 1: Check if any products exist
PRINT 'Step 1: Total products in database';
SELECT COUNT(*) as total_products FROM products;
PRINT '';

-- Step 2: Check how many products have seller_id
PRINT 'Step 2: Products by seller_id status';
SELECT 
    CASE WHEN seller_id IS NULL THEN 'NULL (no seller)' ELSE CAST(seller_id AS NVARCHAR(50)) END as seller_id,
    COUNT(*) as product_count
FROM products
GROUP BY seller_id
ORDER BY CASE WHEN seller_id IS NULL THEN 1 ELSE 0 END;
PRINT '';

-- Step 3: Show all users with Seller or Administrator role
PRINT 'Step 3: Users who can sell';
SELECT 
    u.Id,
    u.Email,
    u.Name,
    STRING_AGG(r.Name, ', ') as roles
FROM [User] u
LEFT JOIN UserRole ur ON u.Id = ur.UserId
LEFT JOIN Role r ON ur.RoleId = r.Id
WHERE r.Name IN ('Seller', 'Administrator')
   OR ur.RoleId IN (SELECT Id FROM Role WHERE Name IN ('Seller', 'Administrator'))
GROUP BY u.Id, u.Email, u.Name
ORDER BY u.Id;
PRINT '';

-- Step 4: Sample of products with sellers
PRINT 'Step 4: First 10 products with seller info';
SELECT TOP 10
    p.id,
    p.name,
    p.stock,
    p.seller_id,
    ISNULL(u.Email, 'NO SELLER ASSIGNED') as seller_email
FROM products p
LEFT JOIN [User] u ON p.seller_id = u.Id
ORDER BY p.id;
PRINT '';

-- Step 5: Count products per seller
PRINT 'Step 5: Products per seller';
SELECT 
    ISNULL(u.Email, 'UNASSIGNED') as seller_email,
    COUNT(p.id) as product_count
FROM products p
LEFT JOIN [User] u ON p.seller_id = u.Id
GROUP BY u.Email, u.Id
HAVING COUNT(p.id) > 0
ORDER BY product_count DESC;
PRINT '';

PRINT '====== DIAGNOSIS COMPLETE ======';
PRINT '';
PRINT 'WHAT TO DO NEXT:';
PRINT '1. If products exist but seller_id is NULL:';
PRINT '   -> Run: Scripts/assign_products_to_seller.sql';
PRINT '';
PRINT '2. If no products exist at all:';
PRINT '   -> Create a new product in the app as a seller';
PRINT '   -> Or import seed data if needed';
PRINT '';
PRINT '3. If products show with YOUR user ID as seller_id:';
PRINT '   -> The database is correct, check token/auth issues';
PRINT '   -> Open browser F12 console and look for token errors';

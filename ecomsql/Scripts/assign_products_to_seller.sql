-- Assign products without seller_id to first admin user
-- This helps with testing seller product management functionality

-- First, check current state of products without seller_id
SELECT COUNT(*) as products_without_seller_id 
FROM products 
WHERE seller_id IS NULL;

-- Find an admin user to assign these products to (first admin found)
DECLARE @adminUserId INT;
SELECT TOP 1 @adminUserId = u.Id 
FROM [User] u
INNER JOIN UserRole ur ON u.Id = ur.UserId
INNER JOIN Role r ON ur.RoleId = r.Id
WHERE r.Name = 'Administrator'
ORDER BY u.CreatedDate ASC;

-- If no admin found, show message
IF @adminUserId IS NULL
BEGIN
    PRINT 'WARNING: No Administrator role found in database. Please create an admin user first.';
    SELECT * FROM [User] LIMIT 5;
END
ELSE
BEGIN
    PRINT 'Assigning products to admin user ID: ' + CAST(@adminUserId AS VARCHAR);
    
    -- Update products without seller_id
    UPDATE products
    SET seller_id = @adminUserId
    WHERE seller_id IS NULL;
    
    -- Show summary
    SELECT 
        'Products assigned to seller' as status,
        @adminUserId as seller_id,
        COUNT(*) as product_count
    FROM products
    WHERE seller_id = @adminUserId;
    
    PRINT 'Done! Products are now assigned and should appear in Product Management.';
END;

-- Verify results
SELECT 
    p.id,
    p.name,
    p.seller_id,
    ISNULL(u.Email, 'NO SELLER') as seller_email
FROM products p
LEFT JOIN [User] u ON p.seller_id = u.Id
WHERE seller_id IS NULL OR seller_id = (SELECT TOP 1 Id FROM [User] WHERE Id = @adminUserId)
ORDER BY p.id;

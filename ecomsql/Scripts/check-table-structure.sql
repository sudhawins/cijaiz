-- Verify products table structure
PRINT '====== PRODUCTS TABLE STRUCTURE ======';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'products'
ORDER BY ORDINAL_POSITION;

PRINT '';
PRINT '====== CHECKING FILE CONSTRAINTS ======';
SELECT 
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_NAME = 'products'
ORDER BY CONSTRAINT_NAME;

PRINT '';
PRINT '====== KEY COLUMN CHECK ======';
SELECT 
    'seller_id EXISTS' as check_result,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'seller_id';

PRINT '';
PRINT '====== SAMPLE INSERT TEST ======';
PRINT 'If seller_id column exists, this query will show the column exists.';
PRINT 'If it errors, seller_id column needs to be added.';

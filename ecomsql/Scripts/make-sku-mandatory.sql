-- Make SKU mandatory in products table
-- This script will:
-- 1. Assign auto-generated SKUs to any NULL values
-- 2. Remove old constraints
-- 3. Make SKU NOT NULL
-- 4. Create new UNIQUE constraint

PRINT '====== Making SKU Mandatory ======';

-- Step 1: Update any NULL SKU values with auto-generated ones
PRINT '';
PRINT 'Step 1: Generating SKU for any NULL values...';
DECLARE @counter INT = 1;
UPDATE products
SET sku = 'SKU-' + FORMAT(GETDATE(), 'yyyyMMdd') + '-' + CAST(id AS VARCHAR(10))
WHERE sku IS NULL;

SET @counter = @@ROWCOUNT;
PRINT 'Generated SKU for ' + CAST(@counter AS VARCHAR(10)) + ' products';

-- Step 2: Remove old constraints on SKU if they exist
PRINT '';
PRINT 'Step 2: Removing old constraints...';

-- Drop filtered index if it exists
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_products_sku')
BEGIN
    DROP INDEX UQ_products_sku ON products;
    PRINT 'Dropped filtered unique index';
END;

-- Drop regular unique constraint if it exists
IF EXISTS (
    SELECT * FROM sys.key_constraints 
    WHERE parent_object_id = OBJECT_ID('products') 
    AND type = 'UQ'
    AND name LIKE '%sku%'
)
BEGIN
    DECLARE @constraint NVARCHAR(128);
    SELECT @constraint = name FROM sys.key_constraints 
    WHERE parent_object_id = OBJECT_ID('products') 
    AND type = 'UQ'
    AND name LIKE '%sku%';
    
    EXEC('ALTER TABLE products DROP CONSTRAINT ' + @constraint);
    PRINT 'Dropped constraint: ' + @constraint;
END;

-- Step 3: Make SKU column NOT NULL
PRINT '';
PRINT 'Step 3: Making SKU NOT NULL...';
ALTER TABLE products
ALTER COLUMN sku NVARCHAR(100) NOT NULL;
PRINT 'SKU column is now NOT NULL';

-- Step 4: Create UNIQUE constraint on SKU
PRINT '';
PRINT 'Step 4: Creating unique constraint on SKU...';
ALTER TABLE products
ADD CONSTRAINT UQ_products_sku UNIQUE (sku);
PRINT 'Created UNIQUE constraint on SKU';

PRINT '';
PRINT '====== Migration Complete ======';
PRINT 'SKU is now mandatory for all products.';
PRINT 'All future products must have a SKU value.';

-- Add pre-order fields to products table
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'is_preorder'
)
BEGIN
    ALTER TABLE products ADD is_preorder BIT NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'preorder_release_date'
)
BEGIN
    ALTER TABLE products ADD preorder_release_date DATE NULL;
END;

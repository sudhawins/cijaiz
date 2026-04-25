-- Add Model Number to Products Table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'model_number')
BEGIN
    ALTER TABLE products
    ADD model_number NVARCHAR(100);
    
    PRINT 'model_number column added to products table';
END;
ELSE
BEGIN
    PRINT 'model_number column already exists in products table';
END;

-- Create index for faster model_number searches
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_products_model_number' AND object_id = OBJECT_ID(N'[dbo].[products]'))
BEGIN
    CREATE INDEX idx_products_model_number ON products(model_number);
    PRINT 'Index created for model_number column';
END;

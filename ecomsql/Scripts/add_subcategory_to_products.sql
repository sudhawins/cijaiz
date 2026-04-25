-- Add Subcategory Foreign Key to Products Table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'subcategory_id')
BEGIN
    ALTER TABLE products
    ADD subcategory_id INT NULL;
    
    -- Add the foreign key constraint
    ALTER TABLE products
    ADD CONSTRAINT fk_products_subcategory FOREIGN KEY (subcategory_id) 
        REFERENCES subcategories(id) ON DELETE SET NULL;
    
    -- Create index for faster lookups
    CREATE INDEX idx_products_subcategory_id ON products(subcategory_id);
    
    PRINT 'subcategory_id column added to products table with foreign key constraint';
END;
ELSE
BEGIN
    PRINT 'subcategory_id column already exists in products table';
END;

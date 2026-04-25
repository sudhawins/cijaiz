-- Add seller_id column to products table
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.products') 
    AND name = 'seller_id'
)
BEGIN
    ALTER TABLE products 
    ADD seller_id INT NULL;

    -- Add foreign key constraint
    ALTER TABLE products
    ADD CONSTRAINT fk_products_seller 
    FOREIGN KEY (seller_id) REFERENCES [User](Id) ON DELETE CASCADE;

    -- Create index for seller_id
    CREATE INDEX idx_products_seller ON products(seller_id);

    PRINT 'Migration completed: Added seller_id to products table';
END
ELSE
BEGIN
    PRINT 'Column seller_id already exists in products table';
END

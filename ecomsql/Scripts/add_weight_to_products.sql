IF COL_LENGTH('products', 'weight_kg') IS NULL
BEGIN
    ALTER TABLE products
    ADD weight_kg DECIMAL(10, 2) NOT NULL CONSTRAINT DF_products_weight_kg DEFAULT (0.50);

    PRINT 'Added weight_kg column to products table with default 0.50 kg';
END
ELSE
BEGIN
    PRINT 'weight_kg column already exists in products table';
END

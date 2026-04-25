-- Add payment_screenshot column to orders table if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'payment_screenshot')
BEGIN
    ALTER TABLE orders
    ADD payment_screenshot NVARCHAR(MAX) NULL;
    PRINT 'Column payment_screenshot added to orders table';
END
ELSE
BEGIN
    PRINT 'Column payment_screenshot already exists in orders table';
END

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'orders'
ORDER BY ORDINAL_POSITION;

-- Add payment_method column to orders table if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'payment_method')
BEGIN
    ALTER TABLE orders
    ADD payment_method NVARCHAR(50) NULL;
    PRINT 'Column payment_method added to orders table';
END
ELSE
BEGIN
    PRINT 'Column payment_method already exists in orders table';
END

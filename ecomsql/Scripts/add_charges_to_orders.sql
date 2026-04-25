-- Add GST, Shipping, and Subtotal columns to orders table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='orders' AND COLUMN_NAME='subtotal_amount')
BEGIN
    ALTER TABLE orders
    ADD subtotal_amount DECIMAL(10, 2) DEFAULT 0;
    PRINT 'Added subtotal_amount column to orders table';
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='orders' AND COLUMN_NAME='gst_amount')
BEGIN
    ALTER TABLE orders
    ADD gst_amount DECIMAL(10, 2) DEFAULT 0;
    PRINT 'Added gst_amount column to orders table';
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='orders' AND COLUMN_NAME='shipping_charge')
BEGIN
    ALTER TABLE orders
    ADD shipping_charge DECIMAL(10, 2) DEFAULT 0;
    PRINT 'Added shipping_charge column to orders table';
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='orders' AND COLUMN_NAME='payment_screenshot')
BEGIN
    ALTER TABLE orders
    ADD payment_screenshot NVARCHAR(MAX);
    PRINT 'Added payment_screenshot column to orders table';
END;

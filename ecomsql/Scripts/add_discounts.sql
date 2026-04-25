-- Discounts/Coupons Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[discounts]') AND type = 'U')
BEGIN
    CREATE TABLE discounts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(50) NOT NULL UNIQUE,
        description NVARCHAR(255),
        discount_type NVARCHAR(20) NOT NULL, -- 'percentage' or 'fixed'
        discount_value DECIMAL(10, 2) NOT NULL, -- percentage (0-100) or fixed amount
        minimum_purchase DECIMAL(10, 2) DEFAULT 0, -- minimum cart amount to apply discount
        maximum_discount DECIMAL(10, 2), -- max discount amount for percentage discounts
        usage_limit INT, -- max number of times code can be used (NULL = unlimited)
        usage_count INT DEFAULT 0,
        is_active BIT DEFAULT 1,
        valid_from DATETIME2,
        valid_until DATETIME2,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
END;

-- Add discount columns to orders table to track applied discount
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'orders') AND name = 'discount_code')
BEGIN
    ALTER TABLE orders ADD discount_code NVARCHAR(50);
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'orders') AND name = 'discount_amount')
BEGIN
    ALTER TABLE orders ADD discount_amount DECIMAL(10, 2) DEFAULT 0;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'orders') AND name = 'subtotal_amount')
BEGIN
    ALTER TABLE orders ADD subtotal_amount DECIMAL(10, 2);
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'orders') AND name = 'gst_amount')
BEGIN
    ALTER TABLE orders ADD gst_amount DECIMAL(10, 2) DEFAULT 0;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'orders') AND name = 'shipping_charge')
BEGIN
    ALTER TABLE orders ADD shipping_charge DECIMAL(10, 2) DEFAULT 0;
END;

-- Create index on discount code for faster lookup
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_discounts_code' AND object_id = OBJECT_ID('discounts'))
    CREATE INDEX idx_discounts_code ON discounts(code);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_discounts_active' AND object_id = OBJECT_ID('discounts'))
    CREATE INDEX idx_discounts_active ON discounts(is_active);

-- Insert sample discount codes (optional - for testing)
IF NOT EXISTS (SELECT 1 FROM discounts WHERE code = 'WELCOME10')
BEGIN
    INSERT INTO discounts (code, description, discount_type, discount_value, minimum_purchase, is_active, valid_from, valid_until)
    VALUES ('WELCOME10', '10% off for new customers', 'percentage', 10, 0, 1, GETDATE(), DATEADD(day, 30, GETDATE()));
END;

IF NOT EXISTS (SELECT 1 FROM discounts WHERE code = 'SAVE50')
BEGIN
    INSERT INTO discounts (code, description, discount_type, discount_value, minimum_purchase, maximum_discount, is_active, valid_from, valid_until)
    VALUES ('SAVE50', 'Get ₹50 off on orders above ₹500', 'fixed', 50, 500, 50, 1, GETDATE(), DATEADD(day, 60, GETDATE()));
END;

IF NOT EXISTS (SELECT 1 FROM discounts WHERE code = 'FREESHIP')
BEGIN
    INSERT INTO discounts (code, description, discount_type, discount_value, minimum_purchase, is_active, valid_from, valid_until)
    VALUES ('FREESHIP', 'Free shipping on all orders', 'fixed', 99, 0, 1, GETDATE(), DATEADD(day, 90, GETDATE()));
END;

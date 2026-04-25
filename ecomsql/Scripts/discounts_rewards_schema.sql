-- Discounts and Rewards System Schema

-- Discounts Table (Coupon Codes)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[discounts]') AND type = 'U')
BEGIN
    CREATE TABLE discounts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        code NVARCHAR(50) NOT NULL UNIQUE,
        description NVARCHAR(MAX),
        discount_type NVARCHAR(20) NOT NULL, -- 'percentage' or 'fixed'
        discount_value DECIMAL(10, 2) NOT NULL,
        max_uses INT,
        current_uses INT DEFAULT 0,
        min_order_amount DECIMAL(10, 2),
        max_discount_amount DECIMAL(10, 2),
        valid_from DATETIME2,
        valid_until DATETIME2,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX idx_discount_code ON discounts(code);
    CREATE INDEX idx_discount_active ON discounts(is_active, valid_from, valid_until);
END;

-- Customer Rewards Table (Loyalty Points)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[customer_rewards]') AND type = 'U')
BEGIN
    CREATE TABLE customer_rewards (
        id INT IDENTITY(1,1) PRIMARY KEY,
        customer_email NVARCHAR(255) NOT NULL UNIQUE,
        total_points INT DEFAULT 0,
        redeemed_points INT DEFAULT 0,
        available_points INT DEFAULT 0,
        loyalty_tier NVARCHAR(20) DEFAULT 'Silver', -- Silver, Gold, Platinum, Diamond
        total_spent DECIMAL(10, 2) DEFAULT 0,
        order_count INT DEFAULT 0,
        last_order_date DATETIME2,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    
    CREATE INDEX idx_customer_email ON customer_rewards(customer_email);
    CREATE INDEX idx_loyalty_tier ON customer_rewards(loyalty_tier);
END;

-- Reward Transactions Table (Point History)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[reward_transactions]') AND type = 'U')
BEGIN
    CREATE TABLE reward_transactions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        customer_email NVARCHAR(255) NOT NULL,
        transaction_type NVARCHAR(20) NOT NULL, -- 'earned', 'redeemed'
        points_amount INT NOT NULL,
        order_id INT,
        description NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_reward_transactions_order FOREIGN KEY (order_id) 
            REFERENCES orders(id) ON DELETE SET NULL
    );
    
    CREATE INDEX idx_customer_email_trans ON reward_transactions(customer_email);
    CREATE INDEX idx_transaction_type ON reward_transactions(transaction_type);
END;

-- Order Discounts Table (Discount Applied to Order)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[order_discounts]') AND type = 'U')
BEGIN
    CREATE TABLE order_discounts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        order_id INT NOT NULL,
        discount_id INT,
        discount_code NVARCHAR(50),
        discount_type NVARCHAR(20), -- 'coupon', 'loyalty_points', 'tier_bonus'
        discount_amount DECIMAL(10, 2) NOT NULL,
        applied_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_order_discounts_order FOREIGN KEY (order_id) 
            REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_order_discounts_discount FOREIGN KEY (discount_id) 
            REFERENCES discounts(id)
    );
    
    CREATE INDEX idx_order_id ON order_discounts(order_id);
    CREATE INDEX idx_discount_id ON order_discounts(discount_id);
END;

-- Update orders table to include discount and loyalty fields
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'discount_amount')
BEGIN
    ALTER TABLE orders ADD discount_amount DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE orders ADD loyalty_points_used INT DEFAULT 0;
    ALTER TABLE orders ADD loyalty_points_earned INT DEFAULT 0;
    ALTER TABLE orders ADD applied_discount_code NVARCHAR(50);
END;

-- Insert sample discount codes
IF NOT EXISTS (SELECT * FROM discounts WHERE code = 'WELCOME10')
BEGIN
    INSERT INTO discounts (code, description, discount_type, discount_value, min_order_amount, valid_from, is_active)
    VALUES ('WELCOME10', 'Welcome discount - 10% off', 'percentage', 10, 100, GETDATE(), 1);
END;

IF NOT EXISTS (SELECT * FROM discounts WHERE code = 'SAVE50')
BEGIN
    INSERT INTO discounts (code, description, discount_type, discount_value, max_uses, valid_from, is_active)
    VALUES ('SAVE50', 'Flat ₹50 discount', 'fixed', 50, 100, GETDATE(), 1);
END;

PRINT 'Discounts and Rewards Schema created successfully!';

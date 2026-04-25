-- Loyalty Rewards/Coupons Table
-- Stores rewards generated from customer orders
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[customer_rewards]') AND type = 'U')
BEGIN
    CREATE TABLE customer_rewards (
        id INT IDENTITY(1,1) PRIMARY KEY,
        customer_email NVARCHAR(255) NOT NULL,
        order_id INT NOT NULL,
        reward_code NVARCHAR(50) NOT NULL UNIQUE,
        reward_percentage DECIMAL(5, 2) DEFAULT 5.0, -- 5% default
        reward_amount DECIMAL(10, 2) NOT NULL, -- Amount customer can use (5% of order value)
        original_order_value DECIMAL(10, 2) NOT NULL,
        is_used BIT DEFAULT 0,
        used_in_order_id INT, -- Which order this reward was used in
        used_at DATETIME2,
        valid_from DATETIME2 DEFAULT GETDATE(),
        valid_until DATETIME2, -- 3 months from valid_from
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_customer_rewards_order FOREIGN KEY (order_id) 
            REFERENCES orders(id) ON DELETE CASCADE
    );
END;

-- Add column to track reward used in orders
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'orders') AND name = 'reward_code_used')
BEGIN
    ALTER TABLE orders ADD reward_code_used NVARCHAR(50);
END;

-- Create indexes for faster lookup
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_customer_rewards_email' AND object_id = OBJECT_ID('customer_rewards'))
    CREATE INDEX idx_customer_rewards_email ON customer_rewards(customer_email);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_customer_rewards_code' AND object_id = OBJECT_ID('customer_rewards'))
    CREATE INDEX idx_customer_rewards_code ON customer_rewards(reward_code);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_customer_rewards_used' AND object_id = OBJECT_ID('customer_rewards'))
    CREATE INDEX idx_customer_rewards_used ON customer_rewards(is_used, valid_until);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_customer_rewards_status' AND object_id = OBJECT_ID('customer_rewards'))
    CREATE INDEX idx_customer_rewards_status ON customer_rewards(customer_email, is_used, valid_until);

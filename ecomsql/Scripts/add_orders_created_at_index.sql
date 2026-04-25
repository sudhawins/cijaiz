-- Add index to speed up order listing sorted by created_at
-- Safe to run multiple times

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'idx_orders_created_at'
      AND object_id = OBJECT_ID('orders')
)
BEGIN
    CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
    PRINT 'Created index idx_orders_created_at';
END
ELSE
BEGIN
    PRINT 'Index idx_orders_created_at already exists';
END

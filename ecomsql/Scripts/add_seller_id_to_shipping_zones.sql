-- Add seller_id support to shipping_zones so sellers can configure their own base charge rates.

IF COL_LENGTH('shipping_zones', 'seller_id') IS NULL
BEGIN
    ALTER TABLE [dbo].[shipping_zones]
    ADD [seller_id] INT NULL;

    PRINT 'Added seller_id column to shipping_zones';
END
ELSE
BEGIN
    PRINT 'seller_id column already exists in shipping_zones';
END
GO

-- Add foreign key only if it does not already exist.
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_shipping_zones_User_seller_id'
)
BEGIN
    ALTER TABLE [dbo].[shipping_zones]
    ADD CONSTRAINT [FK_shipping_zones_User_seller_id]
    FOREIGN KEY ([seller_id]) REFERENCES [dbo].[User]([Id]);

    PRINT 'Added FK_shipping_zones_User_seller_id';
END
ELSE
BEGIN
    PRINT 'FK_shipping_zones_User_seller_id already exists';
END
GO

-- Drop unique constraints on zone_name/zone_code so seller-specific duplicates can exist.
DECLARE @dropConstraintsSql NVARCHAR(MAX) = N'';

SELECT @dropConstraintsSql = @dropConstraintsSql +
    N'ALTER TABLE [dbo].[shipping_zones] DROP CONSTRAINT [' + kc.name + N'];' + CHAR(10)
FROM sys.key_constraints kc
JOIN sys.index_columns ic
    ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
JOIN sys.columns c
    ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.parent_object_id = OBJECT_ID(N'[dbo].[shipping_zones]')
  AND kc.type = 'UQ'
  AND c.name IN ('zone_name', 'zone_code');

IF LEN(@dropConstraintsSql) > 0
BEGIN
    EXEC sp_executesql @dropConstraintsSql;
    PRINT 'Dropped unique constraints on zone_name/zone_code';
END
ELSE
BEGIN
    PRINT 'No unique constraints found on zone_name/zone_code';
END
GO

-- Drop standalone unique indexes on zone_name/zone_code if present.
DECLARE @dropIndexesSql NVARCHAR(MAX) = N'';

SELECT @dropIndexesSql = @dropIndexesSql +
    N'DROP INDEX [' + i.name + N'] ON [dbo].[shipping_zones];' + CHAR(10)
FROM sys.indexes i
JOIN sys.index_columns ic
    ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c
    ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(N'[dbo].[shipping_zones]')
  AND i.is_unique = 1
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND c.name IN ('zone_name', 'zone_code');

IF LEN(@dropIndexesSql) > 0
BEGIN
    EXEC sp_executesql @dropIndexesSql;
    PRINT 'Dropped unique indexes on zone_name/zone_code';
END
ELSE
BEGIN
    PRINT 'No standalone unique indexes found on zone_name/zone_code';
END
GO

-- Supporting indexes for lookup and seller filtering.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_shipping_zones_zone_code_seller'
      AND object_id = OBJECT_ID(N'[dbo].[shipping_zones]')
)
BEGIN
    CREATE INDEX [idx_shipping_zones_zone_code_seller]
    ON [dbo].[shipping_zones] ([zone_code], [seller_id]);

    PRINT 'Created idx_shipping_zones_zone_code_seller';
END
ELSE
BEGIN
    PRINT 'idx_shipping_zones_zone_code_seller already exists';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'idx_shipping_zones_seller'
      AND object_id = OBJECT_ID(N'[dbo].[shipping_zones]')
)
BEGIN
    CREATE INDEX [idx_shipping_zones_seller]
    ON [dbo].[shipping_zones] ([seller_id]);

    PRINT 'Created idx_shipping_zones_seller';
END
ELSE
BEGIN
    PRINT 'idx_shipping_zones_seller already exists';
END
GO

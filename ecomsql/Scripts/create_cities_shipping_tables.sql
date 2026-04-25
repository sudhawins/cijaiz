-- Create Cities table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cities]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[cities] (
        [id] INT PRIMARY KEY IDENTITY(1,1),
        [city_name] NVARCHAR(100) NOT NULL UNIQUE,
        [zip_code] NVARCHAR(10) NOT NULL,
        [state] NVARCHAR(50) NOT NULL,
        [shipping_zone] NVARCHAR(20) NOT NULL, -- metro, tier1, tier2, tier3
        [created_at] DATETIME DEFAULT GETDATE(),
        [updated_at] DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX idx_city_name ON [dbo].[cities]([city_name]);
    CREATE INDEX idx_zip_code ON [dbo].[cities]([zip_code]);
    CREATE INDEX idx_shipping_zone ON [dbo].[cities]([shipping_zone]);
    CREATE INDEX idx_state ON [dbo].[cities]([state]);
    
    PRINT 'Cities table created successfully';
END

-- Create Shipping Zones table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[shipping_zones]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[shipping_zones] (
        [id] INT PRIMARY KEY IDENTITY(1,1),
        [zone_name] NVARCHAR(50) NOT NULL,
        [zone_code] NVARCHAR(20) NOT NULL,
        [shipping_charge] DECIMAL(10, 2) NOT NULL,
        [description] NVARCHAR(255),
        [is_active] BIT DEFAULT 1,
        [seller_id] INT NULL,
        [created_at] DATETIME DEFAULT GETDATE(),
        [updated_at] DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX idx_zone_code ON [dbo].[shipping_zones]([zone_code]);
    CREATE INDEX idx_shipping_zones_zone_code_seller ON [dbo].[shipping_zones]([zone_code], [seller_id]);
    CREATE INDEX idx_shipping_zones_seller ON [dbo].[shipping_zones]([seller_id]);
    
    PRINT 'Shipping Zones table created successfully';
END

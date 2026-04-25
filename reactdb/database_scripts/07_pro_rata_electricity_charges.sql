-- =====================================================
-- Migration: Pro-Rata Electricity Charge Distribution
-- Purpose: Calculate and distribute monthly electricity
--          charges among tenants based on occupancy dates
-- Date: 2026-03-21
-- =====================================================

-- Create TenantServiceCharges table to track individual tenant charges
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TenantServiceCharges')
BEGIN
    CREATE TABLE [dbo].[TenantServiceCharges](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [ServiceConsumptionId] [int] NOT NULL,
        [TenantId] [int] NOT NULL,
        [RoomId] [int] NOT NULL,
        [ServiceId] [int] NOT NULL,
        [BillingMonth] [int] NOT NULL,          -- Month (1-12)
        [BillingYear] [int] NOT NULL,           -- Year
        [TotalUnitsForRoom] [int] NOT NULL,     -- Total units consumed by room
        [ProRataUnits] [decimal](10, 2) NOT NULL,    -- Pro-rata units for this tenant
        [ProRataPercentage] [decimal](5, 2) NOT NULL,-- Pro-rata percentage (for reference)
        [ChargePerUnit] [money] NOT NULL,       -- Rate per unit (15 rupees)
        [TotalCharge] [money] NOT NULL,         -- ProRataUnits * ChargePerUnit
        [CheckInDate] [date] NOT NULL,
        [CheckOutDate] [date] NULL,
        [OccupancyDaysInMonth] [int] NOT NULL,  -- Days occupied in billing month
        [TotalDaysInMonth] [int] NOT NULL,      -- Total days in billing month (28-31)
        [CreatedDate] [datetime] NOT NULL DEFAULT GETDATE(),
        [UpdatedDate] [datetime] NULL,
        [Status] [nvarchar](20) DEFAULT 'Calculated',  -- Calculated, Billed, Paid
        [Notes] [nvarchar](max) NULL,
        
        PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_TenantServiceCharges_Tenant] FOREIGN KEY ([TenantId])
            REFERENCES [dbo].[Tenant]([Id]),
        CONSTRAINT [FK_TenantServiceCharges_RoomDetail] FOREIGN KEY ([RoomId])
            REFERENCES [dbo].[RoomDetail]([Id]),
        CONSTRAINT [FK_TenantServiceCharges_ServiceDetails] FOREIGN KEY ([ServiceId])
            REFERENCES [dbo].[ServiceDetails]([Id]),
        CONSTRAINT [FK_TenantServiceCharges_ServiceConsumption] FOREIGN KEY ([ServiceConsumptionId])
            REFERENCES [dbo].[ServiceConsumptionDetails]([Id])
    );
    
    -- Create indexes for efficient queries
    CREATE NONCLUSTERED INDEX [IX_TenantServiceCharges_TenantMonth]
    ON [dbo].[TenantServiceCharges] ([TenantId], [BillingYear], [BillingMonth]);
    
    CREATE NONCLUSTERED INDEX [IX_TenantServiceCharges_RoomMonth]
    ON [dbo].[TenantServiceCharges] ([RoomId], [BillingYear], [BillingMonth]);
    
    CREATE NONCLUSTERED INDEX [IX_TenantServiceCharges_ServiceConsumption]
    ON [dbo].[TenantServiceCharges] ([ServiceConsumptionId]);
    
    CREATE NONCLUSTERED INDEX [IX_TenantServiceCharges_Status]
    ON [dbo].[TenantServiceCharges] ([Status], [BillingYear], [BillingMonth]);
END
GO

PRINT 'Pro-Rata Electricity Charge Distribution - Table setup completed successfully!';

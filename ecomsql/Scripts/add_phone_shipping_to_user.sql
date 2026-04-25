-- Add PhoneNumber and ShippingAddress columns to User table
-- This migration adds optional contact and address information for user registration

USE [ecommerce];
GO

-- Check if columns already exist
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'User' AND COLUMN_NAME = 'PhoneNumber')
BEGIN
    ALTER TABLE [dbo].[User]
    ADD [PhoneNumber] [nvarchar](20) NULL;
    PRINT 'Added PhoneNumber column to User table';
END;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'User' AND COLUMN_NAME = 'ShippingAddress')
BEGIN
    ALTER TABLE [dbo].[User]
    ADD [ShippingAddress] [nvarchar](500) NULL;
    PRINT 'Added ShippingAddress column to User table';
END;

-- Verify the columns were added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'User'
ORDER BY ORDINAL_POSITION;
GO

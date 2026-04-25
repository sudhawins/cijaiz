-- =====================================================
-- DailyGuestCheckIn Unicode Support Migration
-- =====================================================
-- Purpose: Ensure Tamil/Unicode text is stored correctly by converting
--          DailyGuestCheckIn text columns from VARCHAR to NVARCHAR.
-- Created: 2026-04-21

USE [mansion];
GO

PRINT 'Applying Unicode migration for DailyGuestCheckIn...';
GO

IF OBJECT_ID('dbo.DailyGuestCheckIn', 'U') IS NULL
BEGIN
  PRINT 'DailyGuestCheckIn table not found. Skipping migration.';
  RETURN;
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.DailyGuestCheckIn')
    AND name = 'GuestName'
    AND system_type_id = 167
)
BEGIN
  ALTER TABLE [dbo].[DailyGuestCheckIn] ALTER COLUMN [GuestName] [nvarchar](150) NOT NULL;
  PRINT 'Converted GuestName to NVARCHAR(150).';
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.DailyGuestCheckIn')
    AND name = 'PhoneNumber'
    AND system_type_id = 167
)
BEGIN
  ALTER TABLE [dbo].[DailyGuestCheckIn] ALTER COLUMN [PhoneNumber] [nvarchar](25) NULL;
  PRINT 'Converted PhoneNumber to NVARCHAR(25).';
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.DailyGuestCheckIn')
    AND name = 'Purpose'
    AND system_type_id = 167
)
BEGIN
  ALTER TABLE [dbo].[DailyGuestCheckIn] ALTER COLUMN [Purpose] [nvarchar](500) NULL;
  PRINT 'Converted Purpose to NVARCHAR(500).';
END
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.DailyGuestCheckIn')
    AND name = 'VisitingRoomNo'
    AND system_type_id = 167
)
BEGIN
  ALTER TABLE [dbo].[DailyGuestCheckIn] ALTER COLUMN [VisitingRoomNo] [nvarchar](20) NULL;
  PRINT 'Converted VisitingRoomNo to NVARCHAR(20).';
END
GO

PRINT 'Unicode migration completed.';
GO

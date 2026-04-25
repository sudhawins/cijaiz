-- =====================================================
-- Daily Guest Check-In Rent/Deposit Enhancement
-- =====================================================
-- Purpose: Add rent and deposit amount fields to DailyGuestCheckIn
-- Created: 2026-04-02

USE [mansion];
GO

PRINT 'Applying DailyGuestCheckIn rent/deposit enhancements...';
GO

IF OBJECT_ID('dbo.DailyGuestCheckIn', 'U') IS NULL
BEGIN
  PRINT 'DailyGuestCheckIn table does not exist. Run 08_daily_guest_checkins.sql first.';
  RETURN;
END
GO

IF COL_LENGTH('dbo.DailyGuestCheckIn', 'RentAmount') IS NULL
BEGIN
  ALTER TABLE [dbo].[DailyGuestCheckIn]
  ADD [RentAmount] [decimal](10,2) NOT NULL CONSTRAINT [DF_DailyGuestCheckIn_RentAmount] DEFAULT (0);
  PRINT 'Added RentAmount column.';
END
ELSE
BEGIN
  PRINT 'RentAmount column already exists. Skipping.';
END
GO

IF COL_LENGTH('dbo.DailyGuestCheckIn', 'DepositAmount') IS NULL
BEGIN
  ALTER TABLE [dbo].[DailyGuestCheckIn]
  ADD [DepositAmount] [decimal](10,2) NOT NULL CONSTRAINT [DF_DailyGuestCheckIn_DepositAmount] DEFAULT (0);
  PRINT 'Added DepositAmount column.';
END
ELSE
BEGIN
  PRINT 'DepositAmount column already exists. Skipping.';
END
GO

PRINT '';
PRINT 'Verification query output:';
SELECT TOP 20
  Id,
  DailyStatusId,
  GuestName,
  VisitingRoomNo,
  RentAmount,
  DepositAmount,
  CheckInTime,
  CheckOutTime
FROM [dbo].[DailyGuestCheckIn]
ORDER BY CheckInTime DESC, Id DESC;
GO

PRINT 'DailyGuestCheckIn rent/deposit enhancement completed.';
GO

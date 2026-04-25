-- =====================================================
-- Daily Guest Check-In Proof & Photo URL Enhancement
-- =====================================================
-- Purpose: Add ProofUrl and PhotoUrl fields to DailyGuestCheckIn for blob storage uploads
-- Created: 2026-04-03

USE [mansion];
GO

PRINT 'Applying DailyGuestCheckIn proof/photo URL enhancements...';
GO

IF OBJECT_ID('dbo.DailyGuestCheckIn', 'U') IS NULL
BEGIN
  PRINT 'DailyGuestCheckIn table does not exist. Run 08_daily_guest_checkins.sql first.';
  RETURN;
END
GO

IF COL_LENGTH('dbo.DailyGuestCheckIn', 'ProofUrl') IS NULL
BEGIN
  ALTER TABLE [dbo].[DailyGuestCheckIn]
  ADD [ProofUrl] [varchar](1000) NULL;
  PRINT 'Added ProofUrl column.';
END
ELSE
BEGIN
  PRINT 'ProofUrl column already exists. Skipping.';
END
GO

IF COL_LENGTH('dbo.DailyGuestCheckIn', 'PhotoUrl') IS NULL
BEGIN
  ALTER TABLE [dbo].[DailyGuestCheckIn]
  ADD [PhotoUrl] [varchar](1000) NULL;
  PRINT 'Added PhotoUrl column.';
END
ELSE
BEGIN
  PRINT 'PhotoUrl column already exists. Skipping.';
END
GO

PRINT '';
PRINT 'Verification query output:';
SELECT TOP 10
  Id,
  DailyStatusId,
  GuestName,
  ProofUrl,
  PhotoUrl,
  CheckInTime,
  UpdatedDate
FROM [dbo].[DailyGuestCheckIn]
ORDER BY CheckInTime DESC, Id DESC;
GO

PRINT 'Daily guest check-in proof/photo script completed.';
GO

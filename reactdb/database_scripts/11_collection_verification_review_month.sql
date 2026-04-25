-- =====================================================
-- Collection Verification Review Month Enhancement
-- =====================================================
-- Purpose: Persist rental review decisions/comments per tenant per month
-- Created: 2026-04-18

USE [mansion];
GO

PRINT 'Applying CollectionVerification review month enhancement...';
GO

IF OBJECT_ID('dbo.CollectionVerification', 'U') IS NULL
BEGIN
  PRINT 'CollectionVerification table does not exist. Run base schema first.';
  RETURN;
END
GO

IF COL_LENGTH('dbo.CollectionVerification', 'ReviewMonth') IS NULL
BEGIN
  ALTER TABLE [dbo].[CollectionVerification]
  ADD [ReviewMonth] [nchar](7) NULL;

  PRINT 'Added ReviewMonth column.';
END
ELSE
BEGIN
  PRINT 'ReviewMonth column already exists. Skipping.';
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_CollectionVerification_Occupancy_ReviewMonth'
    AND object_id = OBJECT_ID('dbo.CollectionVerification')
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX [UX_CollectionVerification_Occupancy_ReviewMonth]
  ON [dbo].[CollectionVerification] ([OccupancyId], [ReviewMonth])
  WHERE [ReviewMonth] IS NOT NULL;

  PRINT 'Created filtered unique index on OccupancyId + ReviewMonth.';
END
ELSE
BEGIN
  PRINT 'Filtered unique index already exists. Skipping.';
END
GO

PRINT '';
PRINT 'Verification query output:';
SELECT TOP 20
  Id,
  OccupancyId,
  ReviewMonth,
  Comments,
  VerifiedBy,
  VerifiedOn,
  IsVerified,
  IsDisputeRaised
FROM [dbo].[CollectionVerification]
ORDER BY VerifiedOn DESC, Id DESC;
GO

PRINT 'CollectionVerification review month enhancement completed.';
GO
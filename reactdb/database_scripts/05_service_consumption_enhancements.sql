-- Migration: Add meter photo storage and previous reading tracking to ServiceConsumptionDetails
-- Date: 2026-03-03

-- Add columns to ServiceConsumptionDetails for photo storage and previous reading flag
ALTER TABLE [dbo].[ServiceConsumptionDetails]
ADD 
    [MeterPhoto1Url] [nvarchar](max) NULL,
    [MeterPhoto2Url] [nvarchar](max) NULL,
    [MeterPhoto3Url] [nvarchar](max) NULL,
    [IsAutoFilledStartingReading] [bit] DEFAULT 0;

-- Create index on ReadingTakenDate and ServiceAllocId for efficient queries
CREATE NONCLUSTERED INDEX [IX_ServiceConsumptionDetails_DateAndAlloc]
ON [dbo].[ServiceConsumptionDetails] ([ReadingTakenDate] DESC, [ServiceAllocId] ASC);

-- Create index on ServiceAllocId for joining with ServiceRoomAllocation
CREATE NONCLUSTERED INDEX [IX_ServiceConsumptionDetails_ServiceAllocId]
ON [dbo].[ServiceConsumptionDetails] ([ServiceAllocId]);

GO

-- Stored Procedure to get previous month's ending meter reading for a service allocation
CREATE OR ALTER PROCEDURE [dbo].[sp_GetPreviousMonthEndingReading]
    @ServiceAllocId INT,
    @CurrentMonth INT,
    @CurrentYear INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Calculate previous month
    DECLARE @PreviousMonth INT = CASE WHEN @CurrentMonth = 1 THEN 12 ELSE @CurrentMonth - 1 END;
    DECLARE @PreviousYear INT = CASE WHEN @CurrentMonth = 1 THEN @CurrentYear - 1 ELSE @CurrentYear END;

    -- Get the last reading of the previous month
    SELECT TOP 1 
        [EndingMeterReading],
        [ReadingTakenDate]
    FROM [dbo].[ServiceConsumptionDetails]
    WHERE [ServiceAllocId] = @ServiceAllocId
        AND YEAR([ReadingTakenDate]) = @PreviousYear
        AND MONTH([ReadingTakenDate]) = @PreviousMonth
    ORDER BY [ReadingTakenDate] DESC;
END
GO

-- Stored Procedure to get service allocations with search capability
CREATE OR ALTER PROCEDURE [dbo].[sp_GetServiceAllocationsForReading]
    @SearchTerm NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        sra.[Id],
        sra.[ServiceId],
        sra.[RoomId],
        sd.[ConsumerNo],
        sd.[ConsumerName],
        sd.[MeterNo],
        rd.[Number] as [RoomNumber],
        CONCAT(rd.[Number], ' - ', sd.[ConsumerName], ' (', sd.[ConsumerNo], ')') as [DisplayName]
    FROM [dbo].[ServiceRoomAllocation] sra
    INNER JOIN [dbo].[ServiceDetails] sd ON sra.[ServiceId] = sd.[Id]
    INNER JOIN [dbo].[RoomDetail] rd ON sra.[RoomId] = rd.[Id]
    WHERE (@SearchTerm IS NULL 
        OR rd.[Number] LIKE '%' + @SearchTerm + '%'
        OR sd.[ConsumerName] LIKE '%' + @SearchTerm + '%'
        OR sd.[ConsumerNo] LIKE '%' + @SearchTerm + '%')
    ORDER BY rd.[Number] ASC, sd.[ConsumerName] ASC;
END
GO

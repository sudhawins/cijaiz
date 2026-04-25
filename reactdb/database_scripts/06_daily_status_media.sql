-- =====================================================
-- Daily Room Status Media Table Script
-- =====================================================
-- Purpose: Add media (photos and videos) support to Daily Room Status
-- Created: 2026
-- Description: Creates table to store photos and videos for daily room status records

USE [mansion];
GO

-- Create DailyRoomStatusMedia table
PRINT 'Creating DailyRoomStatusMedia table...';
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DailyRoomStatusMedia')
BEGIN
  CREATE TABLE [dbo].[DailyRoomStatusMedia](
    [Id] [int] IDENTITY(1,1) NOT NULL,
    [DailyStatusId] [int] NOT NULL,
    [MediaType] [varchar](50) NOT NULL, -- 'photo' or 'video'
    [SequenceNumber] [int] NOT NULL,    -- 1, 2 for ordering (max 2 per type)
    [FileName] [varchar](500) NOT NULL,
    [FilePath] [varchar](1000) NOT NULL,
    [FileSize] [bigint] NULL,            -- Size in bytes
    [MimeType] [varchar](100) NULL,      -- image/jpeg, image/png, video/mp4, etc.
    [UploadedDate] [datetime] NOT NULL DEFAULT GETDATE(),
    [CreatedBy] [int] NULL,              -- User ID who uploaded
    PRIMARY KEY CLUSTERED 
    (
      [Id] ASC
    )WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
  ) ON [PRIMARY]
  
  -- Add foreign key constraint
  ALTER TABLE [dbo].[DailyRoomStatusMedia]
  ADD CONSTRAINT [FK_DailyRoomStatusMedia_DailyRoomStatus] 
  FOREIGN KEY([DailyStatusId]) 
  REFERENCES [dbo].[DailyRoomStatus] ([Id])
  ON DELETE CASCADE
  GO
  
  -- Create index on DailyStatusId for faster queries
  CREATE NONCLUSTERED INDEX [IX_DailyRoomStatusMedia_DailyStatusId] 
  ON [dbo].[DailyRoomStatusMedia] ([DailyStatusId] ASC)
  GO
  
  -- Create index on MediaType for faster filtering
  CREATE NONCLUSTERED INDEX [IX_DailyRoomStatusMedia_MediaType] 
  ON [dbo].[DailyRoomStatusMedia] ([MediaType] ASC, [SequenceNumber] ASC)
  GO
  
  PRINT 'DailyRoomStatusMedia table created successfully!';
END
ELSE
BEGIN
  PRINT 'DailyRoomStatusMedia table already exists. Skipping creation.';
END
GO

-- Display table structure for verification
PRINT '';
PRINT 'Table Structure:';
PRINT REPLICATE('-', 60);
EXEC sp_help 'DailyRoomStatusMedia';
GO

PRINT '';
PRINT 'DailyRoomStatusMedia table setup completed!';
GO

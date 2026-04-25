-- =====================================================
-- Migration Validation Script
-- Purpose: Verify schema compatibility before deploying
--          pro-rata electricity charges system
-- Run this BEFORE applying the migration
-- =====================================================

-- Step 1: Verify Occupancy table structure
PRINT '===== STEP 1: Verify Occupancy Table ====='
PRINT 'Expected: CheckInDate [nchar](10), CheckOutDate [nchar](10)'
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Occupancy' 
  AND COLUMN_NAME IN ('CheckInDate', 'CheckOutDate')
ORDER BY COLUMN_NAME;

-- Step 2: Verify Tenant table structure
PRINT ''
PRINT '===== STEP 2: Verify Tenant Table ====='
PRINT 'Expected: Name [nchar](100), Phone [nchar](15)'
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Tenant' 
  AND COLUMN_NAME IN ('Name', 'Phone')
ORDER BY COLUMN_NAME;

-- Step 3: Verify RoomDetail table structure
PRINT ''
PRINT '===== STEP 3: Verify RoomDetail Table ====='
PRINT 'Expected: Number [nchar](10), Rent [int]'
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'RoomDetail' 
  AND COLUMN_NAME IN ('Number', 'Rent')
ORDER BY COLUMN_NAME;

-- Step 4: Verify ServiceDetails table structure
PRINT ''
PRINT '===== STEP 4: Verify ServiceDetails Table ====='
PRINT 'Expected: MeterNo [int], ConsumerNo [nvarchar](50)'
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ServiceDetails' 
  AND COLUMN_NAME IN ('MeterNo', 'ConsumerNo')
ORDER BY COLUMN_NAME;

-- Step 5: Verify ServiceConsumptionDetails table structure
PRINT ''
PRINT '===== STEP 5: Verify ServiceConsumptionDetails Table ====='
PRINT 'Expected: EndingMeterReading [nchar](10)'
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ServiceConsumptionDetails' 
  AND COLUMN_NAME IN ('EndingMeterReading', 'UnitsConsumed', 'UnitRate')
ORDER BY COLUMN_NAME;

-- Step 6: Verify ServiceRoomAllocation table exists
PRINT ''
PRINT '===== STEP 6: Verify ServiceRoomAllocation Table ====='
SELECT 
  COLUMN_NAME,
  DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ServiceRoomAllocation'
ORDER BY ORDINAL_POSITION;

-- Step 7: Check if TenantServiceCharges already exists
PRINT ''
PRINT '===== STEP 7: Check TenantServiceCharges Table ====='
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'TenantServiceCharges')
BEGIN
  PRINT 'WARNING: TenantServiceCharges table already exists!'
  PRINT 'The migration script will re-create this table.'
  SELECT COUNT(*) as ExistingRecordCount FROM [dbo].[TenantServiceCharges];
END
ELSE
BEGIN
  PRINT 'OK: TenantServiceCharges table does not exist (expected for new installation)'
END

-- Step 8: Check occupancy data format
PRINT ''
PRINT '===== STEP 8: Sample Occupancy Data ====='
PRINT 'Verifying date format is YYYY-MM-DD'
SELECT TOP 5
  Id,
  RoomId,
  TenantId,
  CheckInDate,
  CheckOutDate,
  LEN(CheckInDate) as CheckInDateLength
FROM [dbo].[Occupancy]
WHERE CheckInDate IS NOT NULL
ORDER BY CreatedDate DESC;

-- Step 9: Sample ServiceConsumptionDetails data
PRINT ''
PRINT '===== STEP 9: Sample ServiceConsumptionDetails Data ====='
PRINT 'Verifying meter reading storage'
SELECT TOP 5
  Id,
  ServiceAllocId,
  ReadingTakenDate,
  StartingMeterReading,
  EndingMeterReading,
  UnitsConsumed,
  UnitRate
FROM [dbo].[ServiceConsumptionDetails]
ORDER BY CreatedDate DESC;

-- Step 10: Sample Service Room Allocation
PRINT ''
PRINT '===== STEP 10: Service Room Allocation Data ====='
SELECT TOP 5
  sra.Id,
  sra.ServiceId,
  sra.RoomId,
  rd.Number as RoomNumber,
  sd.ConsumerName as ServiceName
FROM [dbo].[ServiceRoomAllocation] sra
INNER JOIN [dbo].[RoomDetail] rd ON sra.RoomId = rd.Id
INNER JOIN [dbo].[ServiceDetails] sd ON sra.ServiceId = sd.Id;

-- Step 11: Test date conversion
PRINT ''
PRINT '===== STEP 11: Test Date Conversion Logic ====='
PRINT 'Testing nchar → DATE conversion'
SELECT TOP 3
  Id,
  CheckInDate as Original_nchar,
  LTRIM(RTRIM(CheckInDate)) as Trimmed,
  CONVERT(DATE, LTRIM(RTRIM(CheckInDate))) as ConvertedDate
FROM [dbo].[Occupancy]
WHERE CheckInDate IS NOT NULL;

-- Step 12: Summary
PRINT ''
PRINT '===== VALIDATION SUMMARY ====='
PRINT 'If all above checks passed, you are ready to apply the migration:'
PRINT '  1. Backup your database'
PRINT '  2. Run: 07_pro_rata_electricity_charges.sql'
PRINT '  3. Restart backend service'
PRINT '  4. Test with MonthlyMeterReading component'
PRINT ''
PRINT 'To check for errors, look above for any unexpected results'

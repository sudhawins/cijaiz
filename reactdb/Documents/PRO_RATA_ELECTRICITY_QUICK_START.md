# Pro-Rata Electricity Charges - Quick Start Guide

## What It Does

Automatically calculates and distributes monthly electricity charges to tenants based on their actual occupancy days. If a tenant checked out mid-month, they pay only for the days they occupied the room.

**Example:**
- Room uses 100 electricity units in March (31 days)
- Tenant A lived there 20 days (March 1-20): Pays for 64.52 units = ₹968
- Tenant B lived there 11 days (March 21-31): Pays for 35.48 units = ₹532

---

## Installation (6 Steps)

### Step 0: Validate Database Schema (IMPORTANT!)
Before applying the migration, verify your schema is compatible:

```bash
# Run this query in SQL Server Management Studio:
# File: database_scripts/00_validate_schema_before_migration.sql
sqlcmd -S <server> -d mansion -i database_scripts/00_validate_schema_before_migration.sql
```

**What it checks:**
- ✅ Occupancy table has CheckInDate/CheckOutDate as nchar(10)
- ✅ Tenant table has Name/Phone as nchar(100/15)
- ✅ RoomDetail has Number as nchar(10)
- ✅ ServiceConsumptionDetails has EndingMeterReading as nchar(10)
- ✅ Date format is YYYY-MM-DD

**Expected Output:** 
All queries should return data without errors. If you see schema mismatches, contact support before proceeding.

### Step 1: Run Database Migration
```bash
# Use SQL Server Management Studio or sqlcmd to run:
database_scripts/07_pro_rata_electricity_charges.sql
```

This creates:
- `TenantServiceCharges` table (tracks individual charges)
- 6 stored procedures for calculations
- Necessary indexes

**Important:** The script includes automatic data type conversions for:
- nchar(10) dates → DATE type
- nchar(100/15) strings → Trimmed for display
- All conversions handled in SQL properly

### Step 2: Restart Backend Service
```bash
# Backend will automatically load new API endpoints
# No code changes needed - just restart or redeploy
cd backend && npm start
```

### Step 3: (Optional) Add Components to Frontend Navigation

Edit [App.tsx](../frontend/src/App.tsx) or your navigation component:

```typescript
import MonthlyMeterReading from './components/MonthlyMeterReading';
import TenantElectricityCharges from './components/TenantElectricityCharges';

// In your routing:
<Route path="/meter-reading" element={<MonthlyMeterReading />} />
<Route path="/electricity-charges" element={<TenantElectricityCharges />} />
```

### Step 4: Build Frontend
```bash
cd frontend
npm run build
```

### Step 5: Test
Navigate to the components and test with your data (see Testing Guide below)

---

## Understanding the Schema

Your database uses **nchar** (fixed-length character) data types for dates and text:

| Table | Column | Actual Type | Format |
|-------|--------|-------------|--------|
| Occupancy | CheckInDate | nchar(10) | YYYY-MM-DD |
| Occupancy | CheckOutDate | nchar(10) | YYYY-MM-DD |
| Tenant | Name | nchar(100) | Text (padded) |
| Tenant | Phone | nchar(15) | Number (padded) |
| RoomDetail | Number | nchar(10) | Text (padded) |
| ServiceConsumptionDetails | EndingMeterReading | nchar(10) | Number (padded) |

**What this means:**
- Dates are stored as text '2026-03-01' (not datetime)
- Text fields have trailing spaces (cleaned automatically)
- All conversions handled by SQL queries with LTRIM(RTRIM(...))

✅ **The system handles all this automatically - no manual work needed**

---

## Monthly Workflow

### Record Meter Reading (Monthly, end of month)

1. Go to **"Monthly EB Meter Recording"** page
2. Search for room/service (e.g., Room 101)
3. Click the room card to select it
4. Enter:
   - **Reading Date:** Last day of month
   - **Starting Reading:** Previous month's ending (auto-populated from DB)
   - **Ending Reading:** Current month's meter reading
   - **Rate:** 15 rupees/unit (default, customizable)
5. Click **"Save & Calculate Charges"**
6. System automatically:
   - Creates meter reading record
   - Calculates pro-rata for each tenant
   - Stores charges in database

### View Charges (Any time during month)

1. Go to **"Tenant Electricity Charges"** page
2. Select the billing month
3. View three tabs:
   - **Billing Report:** Overall summary (total charges, units, tenants)
   - **Room Summary:** Charges broken down by room
   - **Tenant Charges:** Individual charges per tenant with occupancy %

---

## API Quick Reference

### Record Meter Reading
```bash
POST /api/service-consumption
{
  "serviceAllocId": 1,
  "readingTakenDate": "2026-03-31",
  "startingMeterReading": 5000,
  "endingMeterReading": 5100,
  "unitRate": 15
}
```

### Calculate Pro-Rata Charges
```bash
POST /api/tenant-service-charges/calculate/1
{ "chargePerUnit": 15 }
```

### Get Charges for Month
```bash
GET /api/tenant-service-charges/2026/3
```

### Get Room Summary
```bash
GET /api/room-billing-summary/2026/3
```

### Get Billing Report
```bash
GET /api/monthly-billing-report/2026/3
```

### Get Single Tenant's Bill
```bash
GET /api/tenant-monthly-bill/5
```

---

## Database Queries (SQL)

### View All Charges for a Month
```sql
SELECT 
  t.Name as TenantName,
  rd.Number as RoomNumber,
  tsc.ProRataPercentage,
  tsc.ProRataUnits,
  tsc.TotalCharge,
  tsc.OccupancyDaysInMonth
FROM TenantServiceCharges tsc
INNER JOIN Tenant t ON tsc.TenantId = t.Id
INNER JOIN RoomDetail rd ON tsc.RoomId = rd.Id
WHERE tsc.BillingYear = 2026 AND tsc.BillingMonth = 3
ORDER BY rd.Number, t.Name;
```

### Sum Charges by Room
```sql
SELECT 
  rd.Number as RoomNumber,
  SUM(tsc.ProRataUnits) as TotalUnits,
  SUM(tsc.TotalCharge) as TotalCharge,
  COUNT(DISTINCT tsc.TenantId) as TenantCount
FROM TenantServiceCharges tsc
INNER JOIN RoomDetail rd ON tsc.RoomId = rd.Id
WHERE tsc.BillingYear = 2026 AND tsc.BillingMonth = 3
GROUP BY rd.Number
ORDER BY rd.Number;
```

### Verify Occupancy Calculation for a Tenant
```sql
SELECT 
  tsc.TenantId,
  t.Name,
  tsc.CheckInDate,
  tsc.CheckOutDate,
  tsc.OccupancyDaysInMonth,
  tsc.ProRataPercentage,
  tsc.ProRataUnits,
  tsc.TotalCharge
FROM TenantServiceCharges tsc
INNER JOIN Tenant t ON tsc.TenantId = t.Id
WHERE tsc.RoomId = 1 AND tsc.BillingMonth = 3;
```

---

## Calculation Example (Verify Your Data)

**Room 101 in March 2026 (31 days):**
- Meter: 5000 → 5085 units = 85 units consumed
- Rate: ₹15/unit

**Tenant A:**
- Check-in: March 1, Check-out: March 20
- Days: 20 days
- ProRataPercentage: 20/31 = 64.52%
- ProRataUnits: 85 × 20/31 = 54.84 units
- **Charge: 54.84 × 15 = ₹822.58**

**Tenant B:**
- Check-in: March 21, Check-out: null (still there)
- Days: 11 days
- ProRataPercentage: 11/31 = 35.48%
- ProRataUnits: 85 × 11/31 = 30.16 units
- **Charge: 30.16 × 15 = ₹452.42**

**Verification:** 54.84 + 30.16 = 85 ✓ | 822.58 + 452.42 = 1275 ✓

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Charges not created after meter reading | Run: `EXEC sp_CalculateProRataCharges @ServiceConsumptionId = 1` |
| Wrong occupancy days | Check Occupancy table: `SELECT * FROM Occupancy WHERE RoomId = X` |
| Duplicate charges | Delete old ones: `DELETE FROM TenantServiceCharges WHERE ServiceConsumptionId = 1` then recalculate |
| Different rate needed | Use recalculate API: `POST /api/tenant-service-charges/recalculate/2026/3` with new rate |
| No rooms showing in UI | Verify ServiceRoomAllocation exists: `SELECT * FROM ServiceRoomAllocation` |
| Tenant names have extra spaces | This is normal - system trims them automatically with LTRIM(RTRIM(...)) |
| Dates showing as null | Verify Occupancy dates are in YYYY-MM-DD format |

---

## Files Added/Modified

**New Files:**
- `database_scripts/00_validate_schema_before_migration.sql` - Schema validation (run FIRST)
- `database_scripts/07_pro_rata_electricity_charges.sql` - Database migrations & procedures
- `frontend/src/components/MonthlyMeterReading.tsx` - Meter reading component
- `frontend/src/components/TenantElectricityCharges.tsx` - Charges display component
- `Documents/PRO_RATA_ELECTRICITY_CHARGES.md` - Full documentation
- `Documents/SCHEMA_ALIGNMENT_ANALYSIS.md` - Schema compatibility details

**Modified Files:**
- `backend/src/index.ts` - Added 6 new API endpoints
- `frontend/src/api.ts` - Added 7 new API client methods

---

## Key Features

✅ **Automatic pro-rata calculation** based on occupancy dates  
✅ **Handles mid-month check-ins/check-outs**  
✅ **Multi-tenant rooms** supported  
✅ **Monthly billing cycles**  
✅ **Customizable rate** per unit  
✅ **Charge status tracking** (Calculated → Billed → Paid)  
✅ **Comprehensive reports**  
✅ **Historical billing** per tenant  
✅ **Recalculation support** if rates change  
✅ **Full audit trail** with timestamps
✅ **Schema compatible** with nchar date/text types  

---

## Support

See **PRO_RATA_ELECTRICITY_CHARGES.md** for:
- Detailed system architecture
- All database procedures
- Complete API documentation
- Advanced testing scenarios
- Performance considerations
- Future enhancements

See **SCHEMA_ALIGNMENT_ANALYSIS.md** for:
- Data type mapping details
- Conversion logic explanation
- Type handling throughout system
- Common issues and fixes

---

**Ready to use!** Start with Step 0 (validation) above.

---

## Monthly Workflow

### Record Meter Reading (Monthly, end of month)

1. Go to **"Monthly EB Meter Recording"** page
2. Search for room/service (e.g., Room 101)
3. Click the room card to select it
4. Enter:
   - **Reading Date:** Last day of month
   - **Starting Reading:** Previous month's ending (auto-populated from DB)
   - **Ending Reading:** Current month's meter reading
   - **Rate:** 15 rupees/unit (default, customizable)
5. Click **"Save & Calculate Charges"**
6. System automatically:
   - Creates meter reading record
   - Calculates pro-rata for each tenant
   - Stores charges in database

### View Charges (Any time during month)

1. Go to **"Tenant Electricity Charges"** page
2. Select the billing month
3. View three tabs:
   - **Billing Report:** Overall summary (total charges, units, tenants)
   - **Room Summary:** Charges broken down by room
   - **Tenant Charges:** Individual charges per tenant with occupancy %

---

## API Quick Reference

### Record Meter Reading
```bash
POST /api/service-consumption
{
  "serviceAllocId": 1,
  "readingTakenDate": "2026-03-31",
  "startingMeterReading": 5000,
  "endingMeterReading": 5100,
  "unitRate": 15
}
```

### Calculate Pro-Rata Charges
```bash
POST /api/tenant-service-charges/calculate/1
{ "chargePerUnit": 15 }
```

### Get Charges for Month
```bash
GET /api/tenant-service-charges/2026/3
```

### Get Room Summary
```bash
GET /api/room-billing-summary/2026/3
```

### Get Billing Report
```bash
GET /api/monthly-billing-report/2026/3
```

### Get Single Tenant's Bill
```bash
GET /api/tenant-monthly-bill/5
```

---

## Database Queries (SQL)

### View All Charges for a Month
```sql
SELECT 
  t.Name as TenantName,
  rd.Number as RoomNumber,
  tsc.ProRataPercentage,
  tsc.ProRataUnits,
  tsc.TotalCharge,
  tsc.OccupancyDaysInMonth
FROM TenantServiceCharges tsc
INNER JOIN Tenant t ON tsc.TenantId = t.Id
INNER JOIN RoomDetail rd ON tsc.RoomId = rd.Id
WHERE tsc.BillingYear = 2026 AND tsc.BillingMonth = 3
ORDER BY rd.Number, t.Name;
```

### Sum Charges by Room
```sql
SELECT 
  rd.Number as RoomNumber,
  SUM(tsc.ProRataUnits) as TotalUnits,
  SUM(tsc.TotalCharge) as TotalCharge,
  COUNT(DISTINCT tsc.TenantId) as TenantCount
FROM TenantServiceCharges tsc
INNER JOIN RoomDetail rd ON tsc.RoomId = rd.Id
WHERE tsc.BillingYear = 2026 AND tsc.BillingMonth = 3
GROUP BY rd.Number
ORDER BY rd.Number;
```

### Verify Occupancy Calculation for a Tenant
```sql
SELECT 
  tsc.TenantId,
  t.Name,
  tsc.CheckInDate,
  tsc.CheckOutDate,
  tsc.OccupancyDaysInMonth,
  tsc.ProRataPercentage,
  tsc.ProRataUnits,
  tsc.TotalCharge
FROM TenantServiceCharges tsc
INNER JOIN Tenant t ON tsc.TenantId = t.Id
WHERE tsc.RoomId = 1 AND tsc.BillingMonth = 3;
```

---

## Calculation Example (Verify Your Data)

**Room 101 in March 2026 (31 days):**
- Meter: 5000 → 5085 units = 85 units consumed
- Rate: ₹15/unit

**Tenant A:**
- Check-in: March 1, Check-out: March 20
- Days: 20 days
- ProRataPercentage: 20/31 = 64.52%
- ProRataUnits: 85 × 20/31 = 54.84 units
- **Charge: 54.84 × 15 = ₹822.58**

**Tenant B:**
- Check-in: March 21, Check-out: null (still there)
- Days: 11 days
- ProRataPercentage: 11/31 = 35.48%
- ProRataUnits: 85 × 11/31 = 30.16 units
- **Charge: 30.16 × 15 = ₹452.42**

**Verification:** 54.84 + 30.16 = 85 ✓ | 822.58 + 452.42 = 1275 ✓

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Charges not created after meter reading | Run: `EXEC sp_CalculateProRataCharges @ServiceConsumptionId = 1` |
| Wrong occupancy days | Check Occupancy table: `SELECT * FROM Occupancy WHERE RoomId = X` |
| Duplicate charges | Delete old ones: `DELETE FROM TenantServiceCharges WHERE ServiceConsumptionId = 1` then recalculate |
| Different rate needed | Use recalculate API: `POST /api/tenant-service-charges/recalculate/2026/3` with new rate |
| No rooms showing in UI | Verify ServiceRoomAllocation exists: `SELECT * FROM ServiceRoomAllocation` |

---

## Files Added/Modified

**New Files:**
- `database_scripts/07_pro_rata_electricity_charges.sql` - Database migrations & procedures
- `backend/src/index.ts` - API endpoints (added to existing file)
- `frontend/src/api.ts` - API client methods (added to existing file)
- `frontend/src/components/MonthlyMeterReading.tsx` - Meter reading component
- `frontend/src/components/TenantElectricityCharges.tsx` - Charges display component
- `Documents/PRO_RATA_ELECTRICITY_CHARGES.md` - Full documentation

**Modified Files:**
- `backend/src/index.ts` - Added 6 new API endpoints
- `frontend/src/api.ts` - Added 7 new API client methods

---

## Key Features

✅ **Automatic pro-rata calculation** based on occupancy dates  
✅ **Handles mid-month check-ins/check-outs**  
✅ **Multi-tenant rooms** supported  
✅ **Monthly billing cycles**  
✅ **Customizable rate** per unit  
✅ **Charge status tracking** (Calculated → Billed → Paid)  
✅ **Comprehensive reports**  
✅ **Historical billing** per tenant  
✅ **Recalculation support** if rates change  
✅ **Full audit trail** with timestamps  

---

## Support

See **PRO_RATA_ELECTRICITY_CHARGES.md** for:
- Detailed system architecture
- All database procedures
- Complete API documentation
- Advanced testing scenarios
- Performance considerations
- Future enhancements

---

**Ready to use!** Start with Step 1 above.

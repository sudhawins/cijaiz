# Pro-Rata Electricity Charge Distribution System

## Overview

This system automates the calculation and distribution of monthly electricity charges among tenants based on their occupancy dates. Each tenant is charged a pro-rata amount based on the number of days they occupied the room during the billing month.

**Key Features:**
- Monthly meter reading recording per room
- Automatic pro-rata calculation based on check-in/check-out dates
- Flexible charge rate per unit (default: ₹15/unit)
- Multi-tenant charge distribution for rooms
- Comprehensive billing reports and summaries
- Charge status tracking (Calculated, Billed, Paid)
- Audit trail for all calculations

---

## System Architecture

### Database Schema

#### 1. **TenantServiceCharges** (New Table)
Tracks individual tenant charges with pro-rata calculations.

```sql
Columns:
- Id (Primary Key)
- ServiceConsumptionId (FK to ServiceConsumptionDetails)
- TenantId (FK to Tenant)
- RoomId (FK to RoomDetail)
- ServiceId (FK to ServiceDetails)
- BillingMonth (1-12)
- BillingYear (YYYY)
- TotalUnitsForRoom (Total units consumed by room)
- ProRataUnits (Units allocated to this tenant)
- ProRataPercentage (% of room usage)
- ChargePerUnit (Rate per unit)
- TotalCharge (Final charge amount)
- CheckInDate, CheckOutDate (Tenant occupancy period)
- OccupancyDaysInMonth (Days occupied in billing month)
- TotalDaysInMonth (28-31 days)
- Status (Calculated, Billed, Paid)
- CreatedDate, UpdatedDate
```

#### 2. **Existing Tables Used**
- **ServiceConsumptionDetails**: Stores monthly meter readings
- **ServiceRoomAllocation**: Links rooms to electricity services
- **Occupancy**: Contains tenant check-in/check-out dates
- **RoomDetail**: Room information
- **ServiceDetails**: Service/meter details
- **Tenant**: Tenant information

### Pro-Rata Calculation Formula

```
OccupancyDaysInMonth = 
  IF (CheckInDate > 1st of Month)
    THEN: (Last of Month - CheckInDate) + 1
    ELSE: IF (CheckOutDate IS NULL OR CheckOutDate > Last of Month)
      THEN: (Last of Month - 1st of Month) + 1
      ELSE: (CheckOutDate - 1st of Month) + 1

ProRataPercentage = (OccupancyDaysInMonth / Total Days in Month) × 100

ProRataUnits = (TotalUnitsConsumed × OccupancyDaysInMonth) / TotalDaysInMonth

TotalCharge = ProRataUnits × ChargePerUnit
```

**Example:**
- Room has 100 units consumed in March (31 days)
- Tenant A: Check-in March 1, Check-out March 20 = 20 days
  - ProRataPercentage: 20/31 = 64.52%
  - ProRataUnits: 100 × 20/31 = 64.52 units
  - Charge at ₹15/unit: ₹967.74

- Tenant B: Check-in March 21, Check-out March 31 = 11 days
  - ProRataPercentage: 11/31 = 35.48%
  - ProRataUnits: 100 × 11/31 = 35.48 units
  - Charge at ₹15/unit: ₹532.26

---

## Database Stored Procedures

### 1. `sp_CalculateProRataCharges`
Calculates pro-rata charges for a single service consumption record.

**Parameters:**
- `@ServiceConsumptionId` (INT): ID of the meter reading
- `@ChargePerUnit` (MONEY): Rate per unit (default: 15.00)

**Usage:**
```sql
EXEC sp_CalculateProRataCharges @ServiceConsumptionId = 1, @ChargePerUnit = 15.00;
```

### 2. `sp_RecalculateMonthlyCharges`
Recalculates all charges for an entire month (used if rate changes).

**Parameters:**
- `@BillingYear` (INT): Year (e.g., 2026)
- `@BillingMonth` (INT): Month (1-12)
- `@ChargePerUnit` (MONEY): Rate per unit

**Usage:**
```sql
EXEC sp_RecalculateMonthlyCharges @BillingYear = 2026, @BillingMonth = 3, @ChargePerUnit = 15.00;
```

### 3. `sp_GetTenantChargesForMonth`
Retrieves tenant charges for a specific month with filtering.

**Parameters:**
- `@BillingYear`, `@BillingMonth`: Billing period
- `@TenantId` (OPTIONAL): Filter by tenant
- `@RoomId` (OPTIONAL): Filter by room

**Returns:** List of tenant charges with full details

### 4. `sp_GetRoomBillingsSummary`
Summarizes billing by room for the billing period.

**Returns:** Room-level summary with total units and total charges

### 5. `sp_GetMonthlyBillingReport`
Generates overall billing report for the month.

**Returns:** Summary statistics (total charges, number of rooms, tenants, units, etc.)

### 6. `sp_GetTenantMonthlyBill`
Retrieves all charges for a specific tenant.

**Returns:** Historical billing data for the tenant

---

## Backend API Endpoints

### Charge Calculation

**POST** `/api/tenant-service-charges/calculate/:serviceConsumptionId`
- Calculates pro-rata charges for a meter reading
- **Body:** `{ chargePerUnit: 15 }`
- **Returns:** `{ success: true, message: "...", serviceConsumptionId: ... }`

```bash
curl -X POST http://localhost:5000/api/tenant-service-charges/calculate/1 \
  -H "Content-Type: application/json" \
  -d '{"chargePerUnit": 15}'
```

### Retrieve Charges

**GET** `/api/tenant-service-charges/:billingYear/:billingMonth`
- Fetches all tenant charges for the month
- **Query Params:** `tenantId`, `roomId` (optional filters)
- **Returns:** Array of tenant charges

```bash
curl "http://localhost:5000/api/tenant-service-charges/2026/3?roomId=5"
```

**GET** `/api/room-billing-summary/:billingYear/:billingMonth`
- Room-level billing summary
- **Query Params:** `roomId` (optional filter)

**GET** `/api/monthly-billing-report/:billingYear/:billingMonth`
- Overall billing statistics for the month

**GET** `/api/tenant-monthly-bill/:tenantId`
- Historical bills for a tenant

### Administrative Functions

**POST** `/api/tenant-service-charges/recalculate/:billingYear/:billingMonth`
- Recalculates all charges for a month (dangerous operation - requires confirmation)
- **Body:** `{ chargePerUnit: 15 }`

**PUT** `/api/tenant-service-charges/:chargeId/status`
- Updates charge status (Calculated → Billed → Paid)
- **Body:** `{ status: "Billed", notes: "Optional notes" }`

**GET** `/api/tenant-service-charges`
- Retrieves all charges with advanced filtering and pagination
- **Query Params:** `billingYear`, `billingMonth`, `tenantId`, `roomId`, `status`, `page`, `limit`

---

## Frontend Components

### 1. **MonthlyMeterReading** Component
Records monthly electricity meter readings for each room.

**Location:** `frontend/src/components/MonthlyMeterReading.tsx`

**Features:**
- Search by room number, service name, or meter number
- Select month for reading
- Input starting and ending meter readings
- Automatic unit calculation
- Pro-rata charge calculation on save
- Success notifications

**Integration Points:**
- Uses `apiService.getServiceAllocationsForReading()`
- Calls `apiService.createServiceConsumption()`
- Auto-calculates charges via `apiService.calculateProRataCharges()`

### 2. **TenantElectricityCharges** Component
Displays pro-rata charge distribution to tenants.

**Location:** `frontend/src/components/TenantElectricityCharges.tsx`

**Features:**
- **Billing Report View**: Summary statistics for the month
  - Total charges collected
  - Units consumed
  - Number of tenants and rooms
  - Average occupancy percentage
  
- **Room Summary View**: Breakdown by room
  - Units consumed per room
  - Number of tenants in each room
  - Total charge per room
  - Click through to tenant details

- **Tenant Charges View**: Detailed tenant charges
  - Occupancy days in billing month
  - Pro-rata percentage and units
  - Individual charges
  - Charge status (Calculated/Billed/Paid)
  - Search and filter capabilities

**Controls:**
- Month selector
- Rate per unit adjustment
- Recalculate button for all charges
- Tab-based navigation between views

---

## Integration with Existing System

### 1. Service Consumption Details
- Existing table is used to store meter readings
- New `TenantServiceCharges` table links to this via `ServiceConsumptionId`

### 2. Occupancy Management
- Check-in and check-out dates from `Occupancy` table
- Pro-rata calculation based on these dates
- Handles mid-month check-ins and check-outs

### 3. Room & Service Mapping
- Uses existing `ServiceRoomAllocation` to link rooms to services
- Respects existing service-to-room relationships

---

## Usage Workflow

### Monthly Billing Process

**Step 1: Record Meter Readings**
1. Navigate to "Monthly EB Meter Recording" component
2. Search and select a room/service
3. Enter:
   - Reading date (end of month)
   - Starting meter reading (previous month's ending)
   - Ending meter reading (current month's reading)
   - Unit rate (default: ₹15)
4. Click "Save & Calculate Charges"
5. System automatically:
   - Calculates units consumed
   - Finds all tenants occupying the room
   - Calculates pro-rata units for each tenant
   - Creates charge records with occupancy percentages

**Step 2: Review Charges**
1. Navigate to "Tenant Electricity Charges" component
2. Select billing month
3. View Reports:
   - **Billing Report**: Overview statistics
   - **Room Summary**: Charges per room
   - **Tenant Charges**: Individual tenant charges with occupancy details

**Step 3: Update Charge Status**
```bash
# Mark charges as Billed
curl -X PUT http://localhost:5000/api/tenant-service-charges/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "Billed", "notes": "Billed on invoice #123"}'

# Mark as Paid
curl -X PUT http://localhost:5000/api/tenant-service-charges/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "Paid", "notes": "Payment received"}'
```

---

## Testing Guide

### Test Case 1: Single Tenant in Room for Full Month

**Setup:**
- Room 101 with electricity service
- Tenant A: Check-in Jan 1, Check-out Jan 31
- Meter reading: 100 units for January

**Expected Calculation:**
- OccupancyDays: 31
- ProRataPercentage: 100%
- ProRataUnits: 100
- Charge: 100 × 15 = ₹1500

**API Test:**
```bash
# Run monthly meter reading
POST /api/service-consumption
Body: {
  serviceAllocId: 1,
  readingTakenDate: "2026-01-31",
  startingMeterReading: 5000,
  endingMeterReading: 5100,
  unitRate: 15
}

# Calculate charges
POST /api/tenant-service-charges/calculate/1
Body: { chargePerUnit: 15 }

# Retrieve charges
GET /api/tenant-service-charges/2026/1
```

### Test Case 2: Two Tenants Mid-Month Swap

**Setup:**
- Room 102 with electricity service
- Tenant A: Check-in Feb 1, Check-out Feb 15
- Tenant B: Check-in Feb 16, Check-out Feb 28
- Meter reading: 62 units for February (28 days)

**Expected Calculation:**
- **Tenant A:**
  - OccupancyDays: 15 (1st to 15th)
  - ProRataPercentage: 15/28 = 53.57%
  - ProRataUnits: 62 × 15/28 = 33.21
  - Charge: 33.21 × 15 = ₹498.15

- **Tenant B:**
  - OccupancyDays: 13 (16th to 28th)
  - ProRataPercentage: 13/28 = 46.43%
  - ProRataUnits: 62 × 13/28 = 28.79
  - Charge: 28.79 × 15 = ₹431.85

**Total:** ₹498.15 + ₹431.85 = ₹930 ✓

**SQL Verification:**
```sql
SELECT * FROM TenantServiceCharges
WHERE BillingYear = 2026 AND BillingMonth = 2 AND RoomId = 2
ORDER BY TenantId;
```

### Test Case 3: Multiple Rooms in Single Service

**Setup:**
- One electricity service covers multiple rooms
- Each room billed separately based on its reading

**Expected:**
- Each room gets separate meter reading
- Charges calculated independently per room
- Tenants only charged for their room

**API Test:**
```bash
# Get all rooms' summaries
GET /api/room-billing-summary/2026/3

# Get monthly report
GET /api/monthly-billing-report/2026/3
```

### Test Case 4: Recalculation with Rate Change

**Setup:**
- March charges calculated at ₹15/unit
- Rate changed to ₹16/unit

**Steps:**
```bash
# Recalculate all March charges at new rate
POST /api/tenant-service-charges/recalculate/2026/3
Body: { chargePerUnit: 16 }
```

**Verification:**
```sql
SELECT * FROM TenantServiceCharges
WHERE BillingYear = 2026 AND BillingMonth = 3
-- All charges should be recalculated with new rate
```

### Test Case 5: Partial Month Occupancy

**Setup:**
- Room 103, January has 31 days
- Tenant A: Check-in Jan 15 (mid-month check-in)
- Meter reading: 50 units in January

**Expected:**
- OccupancyDays: 17 (15th to 31st)
- ProRataPercentage: 17/31 = 54.84%
- ProRataUnits: 50 × 17/31 = 27.42
- Charge: 27.42 × 15 = ₹411.29

**SQL Query:**
```sql
SELECT 
  TenantId, 
  OccupancyDaysInMonth, 
  ProRataPercentage, 
  ProRataUnits, 
  TotalCharge
FROM TenantServiceCharges
WHERE RoomId = 3 AND BillingMonth = 1;
```

---

## Database Migration

To apply this system to an existing database:

```bash
# 1. Run the SQL migration script
sqlcmd -S <server> -d <database> -i 07_pro_rata_electricity_charges.sql

# 2. Verify tables and procedures
SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%TenantServiceCharges%';
SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME LIKE 'sp_%';

# 3. Test with sample data (see Test Cases above)
```

---

## Troubleshooting

### Issue: Charges not calculated after meter reading

**Solution:**
```sql
-- Check if service consumption was created
SELECT * FROM ServiceConsumptionDetails WHERE Id = @serviceConsumptionId;

-- Manually calculate charges
EXEC sp_CalculateProRataCharges @ServiceConsumptionId = 1, @ChargePerUnit = 15;

-- Verify results
SELECT * FROM TenantServiceCharges WHERE ServiceConsumptionId = 1;
```

### Issue: Incorrect occupancy days for mid-month check-in/out

**Verify occupancy dates in database:**
```sql
SELECT Id, TenantId, RoomId, CheckInDate, CheckOutDate
FROM Occupancy
WHERE RoomId = @roomId AND BillingMonth = 3;
```

### Issue: Charges appear multiple times (duplicates)

**Solution - Delete and recalculate:**
```sql
DELETE FROM TenantServiceCharges WHERE ServiceConsumptionId = @id;
EXEC sp_CalculateProRataCharges @ServiceConsumptionId = @id, @ChargePerUnit = 15;
```

---

## Performance Considerations

1. **Indexes created for:**
   - `IX_TenantServiceCharges_TenantMonth`: Fast tenant billing queries
   - `IX_TenantServiceCharges_RoomMonth`: Room-based reports
   - `IX_TenantServiceCharges_ServiceConsumption`: Linking calculations
   - `IX_TenantServiceCharges_Status`: Status filtering

2. **Pagination:** API supports pagination for large datasets
   ```bash
   GET /api/tenant-service-charges?page=2&limit=50
   ```

3. **Query optimization:** All calculations done in SQL (not application layer)

---

## Future Enhancements

1. **Automated Monthly Billing**
   - Schedule automatic meter reading reminder emails
   - Auto-generate invoices on month-end

2. **Payment Integration**
   - Link charges to payment module
   - Track payment status per tenant per month

3. **Rate Variations**
   - Support different rates by service type
   - Time-based rate changes (peak/off-peak)

4. **Consumption Alerts**
   - Alert on unusual consumption patterns
   - Tenant-wise consumption historical trends

5. **Export Capabilities**
   - Generate PDF invoices for tenants
   - Excel export for accounting

---

## Support & Contact

For issues or questions about the pro-rata electricity charge system:

1. Check the **Troubleshooting** section above
2. Review **Test Cases** for expected behavior
3. Examine database tables for data validation
4. Check backend logs for API errors

---

**Last Updated:** March 21, 2026
**Version:** 1.0
**System:** PhotoApp ReactDB Tenant Management

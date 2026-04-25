# Backend Code Search Results
## Pro-Rata Calculations, Payment Tracking, and Data Structure

**Date of Search:** March 23, 2026
**Scope:** backend/src and database_scripts directories

---

## 1. PRO-RATA CALCULATION FILES

### Primary Files

#### **[backend/src/services/proRataRentService.ts](backend/src/services/proRataRentService.ts)**
Main service for calculating pro-rata rent for tenant occupancies.

**Key Functions:**
- `calculateCheckInProRataRent(checkInDate, fullMonthRent)` - Calculates pro-rata rent from check-in date to end of month
- `calculateCheckOutProRataRent(checkOutDate, fullMonthRent)` - Calculates pro-rata rent from start of month to check-out date
- `calculateProRataRentForPeriod(checkInDate, checkOutDate, fullMonthRent)` - Calculates pro-rata for custom date periods
- `recordProRataRentCalculation(...)` - Records pro-rata calculations to TenantRentCalculations table for audit trail

**Return Type:**
```typescript
interface ProRataRentResult {
  calculatedRent: number;
  fullMonthRent: number;
  occupancyDays: number;
  totalDaysInMonth: number;
  proRataPercentage: number;
}
```

**Pro-Rata Calculation Logic:**
```
proRataRent = (fullMonthRent × occupancyDays) / lastDayOfMonth
proRataPercentage = (occupancyDays / lastDayOfMonth) × 100
```

#### **[backend/src/services/proRataService.ts](backend/src/services/proRataService.ts)**
Service for distributing electricity charges (and other services) to tenants based on occupancy.

**Key Functions:**
- `calculateProRataCharges(serviceConsumptionId, chargePerUnit)` - Distributes service charges among tenants based on occupancy

**Service Charge Logic:**
```
proRataUnits = (UnitsConsumed × occupancyDaysInMonth) / totalDaysInMonth
proRataPercentage = (occupancyDaysInMonth / totalDaysInMonth) × 100
totalCharge = proRataUnits × chargePerUnit
```

**Database Queries Used:**
- Gets service consumption details from `ServiceConsumptionDetails` table
- Retrieves occupancy records from `Occupancy` table based on service room and billing month
- Inserts calculated charges into `TenantServiceCharges` table
- Updates `ServiceConsumptionDetails.UpdatedDate` as processed flag

---

## 2. PAYMENT TRACKING API ENDPOINTS

### Rental Collection Endpoints

#### **GET /api/rental/summary**
**Purpose:** Returns monthly rental summary with collection status
**SQL Query:** [Lines 517-630 in index.ts]
- Joins: `RentalCollection` → `Occupancy` → `Tenant` → `RoomDetail`
- Groups by month (YYYY-MM format)
- Returns:
  - Total occupancies per month
  - Total collection records count
  - Total collected amount
  - Total outstanding amount (calculated with pro-rata logic)

**Pro-Rata Calculation in Endpoint:**
- If check-in is in the query month: `daysOccupied = lastDay - checkInDate.day + 1`
- If check-out is in the query month: `daysOccupied = checkOutDate.day`
- Otherwise: Full month rent
- Outstanding = max(0, proRataRent - collectedAmount)

#### **GET /api/rental/unpaid-tenants**
**Purpose:** Lists unpaid tenants by month
**SQL Query:** Similar to /summary but filters for outstanding balances > 0
- Returns count of unpaid occupancies per month
- Returns total outstanding amount per month

#### **GET /api/rental/unpaid-details/:month**
**Purpose:** Returns detailed unpaid information for specific month
**Parameters:** month in YYYY-MM format

#### **GET /api/rental/payments/:monthYear**
**Purpose:** Returns payment details for specific month
**Parameters:** monthYear in format YYYY-MM
**SQL Query:** [Lines 850-910 in index.ts]
```sql
SELECT 
  o.Id as occupancyId,
  t.Id as tenantId,
  t.Name as tenantName,
  rd.Number as roomNumber,
  ISNULL(o.RentFixed, rd.Rent) as rentFixed,
  ISNULL(CAST(rc.RentReceivedOn AS NVARCHAR), NULL) as rentReceivedOn,
  ISNULL(CAST(rc.RentReceived AS FLOAT), 0) as rentReceived,
  ISNULL(CAST(o.RentFixed AS FLOAT), CAST(rd.Rent AS FLOAT)) 
    - ISNULL(CAST(rc.RentReceived AS FLOAT), 0) as rentBalance,
  CAST(o.CheckInDate AS DATE) as checkInDate,
  CAST(o.CheckOutDate AS DATE) as checkOutDate,
  CASE 
    WHEN rc.Id IS NULL THEN 'pending'
    WHEN ISNULL(CAST(rc.RentBalance AS FLOAT), 0) = 0 THEN 'paid'
    WHEN ISNULL(CAST(rc.RentReceived AS FLOAT), 0) > 0 THEN 'partial'
    ELSE 'pending'
  END as paymentStatus
FROM Occupancy o
INNER JOIN Tenant t ON o.TenantId = t.Id
INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
LEFT JOIN RentalCollection rc ON rc.OccupancyId = o.Id
  AND YEAR(CAST(rc.RentReceivedOn AS DATE)) = @year
  AND MONTH(CAST(rc.RentReceivedOn AS DATE)) = @month
WHERE 
  CAST(o.CheckInDate AS DATE) <= EOMONTH(DATEFROMPARTS(@year, @month, 1))
  AND (o.CheckOutDate IS NULL OR CAST(o.CheckOutDate AS DATE) > DATEFROMPARTS(@year, @month, 1))
ORDER BY t.Name ASC
```
**Returns:** Payment status for all occupancies active during month with status: 'pending' | 'paid' | 'partial'

#### **GET /api/rental/payment-balance**
**Purpose:** Returns overall payment balance information

#### **GET /api/rental/occupancy/:occupancyId**
**Purpose:** Returns specific occupancy details

#### **GET /api/rental/occupancy/:occupancyId/summary**
**Purpose:** Returns summary for specific occupancy

### Service Payment Endpoints

#### **GET /api/services/payments**
**Purpose:** Returns all service payments

#### **GET /api/services/payments/:id**
**Purpose:** Returns specific service payment details

#### **GET /api/service-allocations-with-payments**
**Purpose:** Returns service allocations combined with payment information

---

## 3. OCCUPANCY AND RENTAL DATA STRUCTURE

### **Occupancy Table**
```sql
[Id] INT IDENTITY PRIMARY KEY
[TenantId] INT NOT NULL
[RoomId] INT NOT NULL
[CheckInDate] NCHAR(10) NOT NULL            -- Format: YYYY-MM-DD
[CheckOutDate] NCHAR(10) NULL               -- Format: YYYY-MM-DD (nullable for active)
[CreatedDate] DATETIME NOT NULL
[UpdatedDate] DATETIME NOT NULL
[RentFixed] MONEY NULL                      -- Override room rent (used for pro-rata)
[DepositReceived] MONEY NULL
[Charges] MONEY NULL
[DepositRefunded] MONEY NULL
[Depositurl] NVARCHAR(MAX) NULL
[Refundurl] NVARCHAR(MAX) NULL
[CollectionVerificationId] INT NULL
[TransactionId] INT NULL
```

**Key Notes:**
- Dates stored as NCHAR(10) in YYYY-MM-DD format
- RentFixed allows per-occupancy rent override
- CheckOutDate is NULL for currently active occupancies

### **RentalCollection Table**
```sql
[Id] INT IDENTITY PRIMARY KEY
[OccupancyId] INT NOT NULL                  -- FK to Occupancy
[RentReceivedOn] NCHAR(10) NOT NULL         -- Date rent was received YYYY-MM-DD
[RentBalance] MONEY NULL
[Charges] MONEY NULL
[RefundDetails] TEXT NULL
[CreatedDate] DATETIME NOT NULL
[UpdatedDate] DATETIME NULL
[RentReceived] MONEY NOT NULL               -- Amount received
[ModeofPayment] NVARCHAR(10) NULL           -- Payment method
[screenshoturl] NVARCHAR(MAX) NULL          -- Receipt screenshot
[folder] NVARCHAR(50) NULL                  -- Storage folder reference
[CollectionVerificationId] INT NULL
[TransactionId] INT NULL
```

**Key Notes:**
- Tracks individual payment records per occupancy
- RentReceivedOn used for monthly filtering
- Multiple payment records possible per occupancy (for partial/phased collections)

### **TenantRentCalculations Table**
```sql
[Id] INT IDENTITY PRIMARY KEY
[OccupancyId] INT NOT NULL
[CheckInDate] DATE NOT NULL
[CheckOutDate] DATE NULL
[FullMonthRent] MONEY NOT NULL
[CalculatedRent] MONEY NOT NULL             -- Pro-rata calculated amount
[OccupancyDays] INT NOT NULL
[TotalDaysInMonth] INT NOT NULL
[CalculationType] NVARCHAR(20) NOT NULL     -- 'check-in' | 'check-out' | 'period'
[CreatedDate] DATETIME NOT NULL DEFAULT GETDATE()
```

**Purpose:** Audit trail for pro-rata rent calculations

### **TenantServiceCharges Table** (For Electricity/Services)
```sql
[Id] INT IDENTITY PRIMARY KEY
[ServiceConsumptionId] INT NOT NULL
[TenantId] INT NOT NULL
[RoomId] INT NOT NULL
[ServiceId] INT NOT NULL
[BillingMonth] INT NOT NULL                 -- 1-12
[BillingYear] INT NOT NULL
[TotalUnitsForRoom] INT NOT NULL            -- Total units consumed by room
[ProRataUnits] DECIMAL(10, 2) NOT NULL      -- Units allocated to this tenant
[ProRataPercentage] DECIMAL(5, 2) NOT NULL  -- Percentage (occupancy days / total days)
[ChargePerUnit] MONEY NOT NULL              -- Rate per unit (typically 15 rupees)
[TotalCharge] MONEY NOT NULL                -- ProRataUnits × ChargePerUnit
[CheckInDate] DATE NOT NULL
[CheckOutDate] DATE NULL
[OccupancyDaysInMonth] INT NOT NULL         -- Actual days occupied in billing month
[TotalDaysInMonth] INT NOT NULL             -- Days in billing month (28-31)
[CreatedDate] DATETIME NOT NULL
[UpdatedDate] DATETIME NULL
[Status] NVARCHAR(20) DEFAULT 'Calculated'  -- 'Calculated' | 'Billed' | 'Paid'
[Notes] NVARCHAR(MAX) NULL
```

**Indexes:**
- `IX_TenantServiceCharges_TenantMonth` on (TenantId, BillingYear, BillingMonth)
- `IX_TenantServiceCharges_RoomMonth` on (RoomId, BillingYear, BillingMonth)
- `IX_TenantServiceCharges_ServiceConsumption` on (ServiceConsumptionId)
- `IX_TenantServiceCharges_Status` on (Status, BillingYear, BillingMonth)

### **EBServicePayments Table** (Electricity Bill Records)
```sql
[Id] INT IDENTITY PRIMARY KEY
[ServiceId] INT NOT NULL                    -- FK to ServiceDetails
[BillAmount] MONEY NOT NULL
[BillDate] DATETIME NOT NULL
[CreatedDate] DATETIME NOT NULL
[UpdatedDate] DATETIME NULL
[BilledUnits] INT NULL
```

---

## 4. CHECK-IN/CHECK-OUT ENDPOINTS (Using Pro-Rata)

### **POST /api/occupancy/checkin** [Line 1896]
**Purpose:** Create new occupancy and calculate check-in pro-rata rent
**Payload:**
```json
{
  "tenantId": int,
  "roomId": int,
  "checkInDate": "YYYY-MM-DD",
  "checkOutDate": "YYYY-MM-DD",
  "rentFixed": number,
  "depositReceived": number
}
```
**Process:**
1. Inserts occupancy record with CheckInDate
2. Calls `calculateCheckInProRataRent(checkInDate, rentFixed)`
3. Records calculation via `recordProRataRentCalculation()` with type: 'check-in'
4. Returns occupancy details with pro-rata calculations

### **POST /api/occupancy/:occupancyId/checkout** [Line 2075]
**Purpose:** Update occupancy with checkout and calculate checkout pro-rata rent
**Payload:**
```json
{
  "checkOutDate": "YYYY-MM-DD",
  "depositRefunded": number,
  "charges": number
}
```
**Process:**
1. Fetches occupancy and room rent
2. Updates occupancy with CheckOutDate, DepositRefunded, Charges
3. Calls `calculateCheckOutProRataRent(checkOutDate, roomRent)`
4. Records calculation via `recordProRataRentCalculation()` with type: 'check-out'
5. Returns updated occupancy details with pro-rata calculations

---

## 5. STORED PROCEDURES AND DATABASE SCRIPTS

### **[database_scripts/07_pro_rata_electricity_charges.sql](database_scripts/07_pro_rata_electricity_charges.sql)**
Creates tables and infrastructure for pro-rata electricity charge distribution:
- Sets up `TenantServiceCharges` table with complete schema
- Creates performance indexes
- No stored procedures (calculations done in application service)

### Database Scripts with Payment Information:
- [database_scripts/Full_Script_3_9_2026](database_scripts/Full_Script_3_9_2026) - Comprehensive schema
- [database_scripts/mansion_ddl_scripts_02_24_2026.sql](database_scripts/mansion_ddl_scripts_02_24_2026.sql) - DDL scripts
- [database_scripts/01_role_definitions.sql](database_scripts/01_role_definitions.sql) - RBAC for Payment Tracking role
- [database_scripts/04_verification_and_utilities.sql](database_scripts/04_verification_and_utilities.sql) - Screen role definitions

**No SQL stored procedures found** - All pro-rata calculations and payment processing are handled in backend services

---

## 6. RENTAL CALCULATION SUMMARY

### Current Calculation Logic

**Check-In Pro-Rata:**
```
occupancyDays = lastDayOfMonth - checkInDate.day + 1
proRataRent = (fullMonthRent × occupancyDays) / lastDayOfMonth
proRataPercentage = (occupancyDays / lastDayOfMonth) × 100
```
Example: Check-in on March 5 for ₹10,000/month
- Days: 31 - 5 + 1 = 27 days
- Pro-rata: (₹10,000 × 27) / 31 = ₹8,709.68
- Percentage: (27/31) × 100 = 87.10%

**Check-Out Pro-Rata:**
```
occupancyDays = checkOutDate.day
proRataRent = (fullMonthRent × occupancyDays) / lastDayOfMonth
proRataPercentage = (occupancyDays / lastDayOfMonth) × 100
```
Example: Check-out on March 15 for ₹10,000/month
- Days: 15
- Pro-rata: (₹10,000 × 15) / 31 = ₹4,838.71
- Percentage: (15/31) × 100 = 48.39%

**Service/Electricity Pro-Rata:**
```
proRataUnits = (totalUnitsConsumed × occupancyDaysInMonth) / totalDaysInMonth
totalCharge = proRataUnits × chargePerUnit
proRataPercentage = (occupancyDaysInMonth / totalDaysInMonth) × 100
```

---

## 7. KEY FINDINGS

### ✅ Pro-Rata Implementation
- **Two main services:** `proRataRentService.ts` (rent) and `proRataService.ts` (utilities)
- **Formula:** (Days/Total Days in Month) × Amount
- **Precision:** 2 decimal places (rounded)
- **Auditing:** Calculations recorded in `TenantRentCalculations` table

### ✅ Payment Data Flow
1. Occupancies created with CheckInDate (triggers check-in pro-rata)
2. Occupancies updated with CheckOutDate (triggers checkout pro-rata)
3. RentalCollection records created for each payment
4. `/api/rental/payments/:monthYear` aggregates collection vs pro-rata

### ⚠️ Important Notes
- Dates stored as NCHAR(10) strings in format YYYY-MM-DD
- String trimming required: `LTRIM(RTRIM(o.CheckInDate))`
- RentFixed in Occupancy overrides room's default rent
- Multiple payment records possible per occupancy
- Payment status calculated as: pending → partial → paid

### 📊 Data Aggregation Points
- Monthly summaries: `/api/rental/summary`
- Tenant balances: `/api/rental/payments/:monthYear`
- Unpaid tracking: `/api/rental/unpaid-tenants`
- Service charges: Service tables (separate from rent)

---

## 8. FILE REFERENCE GUIDE

| File | Purpose | Key Functions |
|------|---------|---|
| [backend/src/services/proRataRentService.ts](backend/src/services/proRataRentService.ts) | Rent pro-rata calculations | calculateCheckInProRataRent, calculateCheckOutProRataRent, recordProRataRentCalculation |
| [backend/src/services/proRataService.ts](backend/src/services/proRataService.ts) | Service charge calculations | calculateProRataCharges |
| [backend/src/index.ts](backend/src/index.ts) lines 1896-2200 | Check-in/Check-out endpoints | POST /api/occupancy/checkin, checkout |
| [backend/src/index.ts](backend/src/index.ts) lines 517-910 | Rental endpoints | GET /api/rental/summary, payments, unpaid-tenants |
| [database_scripts/07_pro_rata_electricity_charges.sql](database_scripts/07_pro_rata_electricity_charges.sql) | Service charges schema | TenantServiceCharges table setup |


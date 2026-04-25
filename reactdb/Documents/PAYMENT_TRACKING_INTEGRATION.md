# Payment Tracking Screen Integration Guide

## What Was Created

A comprehensive **Tenant Payment Balance Tracking** screen that calculates tenant rent balance based on pro-rata basis considering check-in and check-out dates.

## Files Created/Modified

### New Files

1. **Frontend Component**
   - `frontend/src/components/TenantPaymentBalance.tsx` - Main payment balance tracking component
   - `frontend/src/components/TenantPaymentBalance.css` - Comprehensive styling

2. **Documentation**
   - `Documents/PAYMENT_TRACKING_PRORATE.md` - Complete feature documentation

### Modified Files

1. **Backend**
   - `backend/src/index.ts` 
     - Added: `GET /api/rental/payment-balance` endpoint
     - Performs pro-rata calculations for all tenants

2. **Frontend**
   - `frontend/src/api.ts`
     - Added: `getPaymentBalance()` API method
   - `frontend/src/utils/proRataCalculations.ts` (already created in previous task)
     - Contains utility functions for pro-rata calculations

## Key Features

### 1. Pro-Rata Rent Calculation
- **Check-In Pro-Rata**: Calculates rent from check-in date to end of month
- **Check-Out Pro-Rata**: Calculates rent from 1st of month to check-out date
- Supports partial month billing for fair pricing

### 2. Real-Time Balance Tracking
- **Expected Rent**: Based on pro-rata calculation
- **Amount Paid**: Total collected
- **Outstanding Balance**: Amount still due
- **Payment Status**: Categorized as Paid, Partial, or Pending

### 3. Advanced Analytics
- **Collection Rate**: Percentage of expected rent collected
- **Summary Statistics**: Total expected, paid, and outstanding amounts
- **Payment Count**: Number of payment records per tenant

### 4. Smart Filtering
- Filter by payment status
- Search by tenant name, room, or balance
- Show only active or expired occupancies
- Multi-attribute search

## How to Use

### Step 1: Import the Component

```tsx
import TenantPaymentBalance from './components/TenantPaymentBalance';
```

### Step 2: Add to Navigation/Routes

```tsx
// In your main App component or routing configuration
<Route path="/payment-tracking" element={<TenantPaymentBalance />} />

// Or add to navigation menu
<NavLink to="/payment-tracking">Payment Tracking</NavLink>
```

### Step 3: Verify Database

Ensure the following tables exist and are properly linked:
- `Occupancy` (with CheckInDate, CheckOutDate)
- `Tenant` (tenant information)
- `RoomDetail` (room rent amounts)
- `RentalCollection` (payment records)

### Step 4: Start Using

Navigate to the payment tracking screen to:
1. View all tenant payment balances
2. Filter by status, tenant, or room
3. Track collection metrics
4. Identify pending payments

## Backend Endpoint Details

### GET `/api/rental/payment-balance`

**Description**: Retrieves payment balance for all tenants with pro-rata calculations

**Response Format**:
```json
[
  {
    "occupancyId": 1,
    "tenantId": 5,
    "tenantName": "John Doe",
    "roomNumber": "101",
    "roomRent": 10000,
    "checkInDate": "2026-03-15",
    "checkOutDate": null,
    "isActive": true,
    "checkInProRata": 3333.33,
    "checkOutProRata": null,
    "expectedRent": 3333.33,
    "totalPaid": 2000,
    "balance": 1333.33,
    "balanceStatus": "partial",
    "lastPaymentDate": "2026-03-20",
    "paymentCount": 1
  }
]
```

**Status Codes**:
- `200`: Success
- `500`: Server error

## Component Props

The component is standalone and requires no props.

```tsx
<TenantPaymentBalance />
```

## Data Flow

```
Browser
  ↓
TenantPaymentBalance Component
  ↓
API Service (getPaymentBalance)
  ↓
Backend: GET /api/rental/payment-balance
  ↓
Database Queries:
  1. Occupancy data (check-in/check-out dates)
  2. Tenant information
  3. Room rent details
  4. Payment records
  ↓
Backend Pro-Rata Calculations
  ↓
Return calculated balances
  ↓
Component renders filtered/sorted data
```

## Configuration Options

### Filter by Status
- All Statuses: Show all records
- Fully Paid: Balance = 0
- Partially Paid: 0 < Balance < Expected
- Pending: Balance = Expected (no payment)

### Search Capabilities
- By tenant name (contains match)
- By room number (contains match)
- By balance amount (exact match)

### View Options
- Include/Exclude expired occupancies
- Sort by tenant name, balance, or collection rate

## Example Usage Scenarios

### Scenario 1: Find Tenants with Outstanding Balance
1. Set Status Filter to "Pending" or "Partial"
2. View the Outstanding Balance column
3. Focus collection efforts on highest balances

### Scenario 2: Check Collection Rate
1. Look at Collection Rate card (shows percentage)
2. Identify pattern in collection vs expected amounts
3. Plan payment campaigns

### Scenario 3: Verify Pro-Rata Calculations
1. Find a tenant with partial month occupancy
2. Check "Pro-Rata Expected" column
3. Manually verify: (Rent × Days) / Days in Month

## Pro-Rata Calculation Examples

### Example: Check-In on March 15 (30-day month)
- Full Rent: ₹10,000
- Days from March 15-31: 17 days
- Pro-rata: (10,000 × 17) / 30 = **₹5,666.67**

### Example: Check-Out on March 20 (30-day month)
- Full Rent: ₹10,000
- Days from March 1-20: 20 days
- Pro-rata: (10,000 × 20) / 30 = **₹6,666.67**

## API Integration

The component uses the standard apiService pattern:

```tsx
// In frontend/src/api.ts
getPaymentBalance: () => api.get('/rental/payment-balance')

// Usage in component
const response = await apiService.getPaymentBalance();
const balances = response.data;
```

## Authentication

Ensure your API endpoints are protected with authentication tokens:
- The apiService automatically includes Authorization headers
- Verify user has permission to view payment data

## Performance Notes

- **Efficient**: Single API call fetches all data
- **Optimized**: Client-side filtering prevents server round-trips
- **Responsive**: Uses React.useMemo for computed values
- **Scalable**: Handles large datasets with pagination-ready structure

## Troubleshooting

### Issue: Component shows "No data found"
**Solution**: Verify that:
- Occupancies exist with valid CheckInDate
- Tenants are linked to occupancies
- RoomDetail has rent amounts configured
- RentalCollection has payment records

### Issue: Pro-rata values are incorrect
**Solution**: Check:
- Check-in/Check-out dates are in correct YYYY-MM-DD format
- Room rent amounts are configured
- Month calculations include both start and end dates (inclusive)

### Issue: API returns 500 error
**Solution**:
- Check backend logs for calculation errors
- Verify database connections
- Ensure all required tables exist

## Future Enhancements

- [ ] Export payment data to Excel/PDF
- [ ] Payment reminder automation
- [ ] Bulk payment processing
- [ ] Payment plan support
- [ ] Receipt generation
- [ ] Payment history charts
- [ ] Recurring payment setup
- [ ] Integration with accounting systems

## Support

For issues or questions:
1. Check backend logs: `backend/logs/`
2. Review API response in browser DevTools
3. Verify database schema matches expected structure
4. Check component console for React errors

## Related Documentation

- [Pro-Rata Electricity Charges](PRO_RATA_ELECTRICITY_CHARGES.md)
- [Payment Tracking with Pro-Rata Rent](PAYMENT_TRACKING_PRORATE.md)
- [Tenant Check-In/Check-Out](COMPLETE_STATUS_REPORT.md)
- [Rental Collection Dashboard](README.md)

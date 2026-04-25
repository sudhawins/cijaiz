# Payment Tracking with Pro-Rata Rent Calculation

## Overview

The **Tenant Payment Balance Tracking** screen provides a comprehensive view of tenant rent payments with pro-rata calculations based on check-in and check-out dates. This feature ensures fair billing for tenants who occupy rooms for partial months.

## Features

### 1. **Pro-Rata Rent Calculation**
- **Check-In Pro-Rata**: Calculates rent from check-in date to the end of the month
- **Check-Out Pro-Rata**: Calculates rent from the 1st of the month to check-out date
- Automatically determines the expected rent based on occupancy dates

### 2. **Payment Balance Tracking**
- **Total Expected Rent**: Based on pro-rata calculations
- **Amount Paid**: Total collected from the tenant
- **Outstanding Balance**: Remaining amount due
- **Balance Status**: Categorized as Paid, Partially Paid, or Pending

### 3. **Collection Metrics**
- **Collection Rate**: Percentage of expected rent that has been collected
- **Status Summary**: Count of fully paid, partially paid, and pending accounts
- **Tenant Statistics**: Total active tenants and aggregate amounts

### 4. **Advanced Filtering**
- Filter by tenant name
- Filter by room number
- Filter by payment status (Paid, Partial, Pending)
- Search by tenant name, room, or balance amount
- Show expired/checked-out tenants only

## Technical Implementation

### Backend Endpoint

**GET** `/api/rental/payment-balance`

Returns an array of tenant payment balance objects with pro-rata calculations:

```json
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
```

### Frontend Component

**File**: `frontend/src/components/TenantPaymentBalance.tsx`

**Props**: None (standalone component)

**State**:
- `tenantBalances`: Array of tenant balance records
- `loading`: Loading state
- `selectedStatusFilter`: Payment status filter
- `selectedTenant`: Tenant name filter
- `selectedRoom`: Room number filter
- `searchTerm`: Search query
- `showExpiredOnly`: Filter for expired occupancies

### Pro-Rata Calculations

The component uses the pro-rata rent calculation utilities from `frontend/src/utils/proRataCalculations.ts`:

- `calculateCheckInProRataRent()`: Calculates rent from check-in to month-end
- `calculateCheckOutProRataRent()`: Calculates rent from month-start to check-out

These are also available on the backend in `backend/src/services/proRataRentService.ts` where the actual calculations are performed.

## Usage Example

### Display the Payment Balance Screen

Add to your navigation or routing:

```tsx
import TenantPaymentBalance from './components/TenantPaymentBalance';

function App() {
  return (
    <div>
      <TenantPaymentBalance />
    </div>
  );
}
```

### Filter Examples

1. **View all pending payments**:
   - Set Status Filter to "Pending"

2. **Check specific tenant's payment status**:
   - Select tenant from "Tenant" dropdown
   - All their records will be displayed

3. **Find expired occupancies with outstanding balance**:
   - Check "Show Expired Only"
   - Set Status Filter to "Pending" or "Partial"

4. **Search by room number**:
   - Use the Search field to find "Room 101"

## Pro-Rata Rent Calculation Examples

### Example 1: Check-In on March 15 (30-day month, ₹10,000/month)
```
Days in March: 30
Check-in Date: March 15
Days remaining (including 15th): 16 days
Pro-rata rent = (10,000 × 16) / 30 = ₹5,333.33
```

### Example 2: Check-Out on March 20 (30-day month, ₹10,000/month)
```
Days in March: 30
Check-out Date: March 20
Days occupied (1st to 20th): 20 days
Pro-rata rent = (10,000 × 20) / 30 = ₹6,666.67
```

## Data Fields Explained

| Field | Description |
|-------|-------------|
| **Tenant** | Name of the tenant |
| **Room** | Room number assigned |
| **Check-In** | Date tenant moved in |
| **Check-Out** | Date tenant moved out (null if active) |
| **Full Month Rent** | Standard monthly rent |
| **Pro-Rata Expected** | Calculated rent based on occupancy dates |
| **Amount Paid** | Total amount collected |
| **Outstanding** | Balance due (Pro-Rata - Paid) |
| **Status** | Payment status (Paid/Partial/Pending) |
| **Last Payment** | Date of most recent payment |
| **Payments** | Count of payment records |

## Color Codes

- **Blue** (Pro-Rata value): Amount calculated by pro-rata formula
- **Green** (Paid amount): Revenue collected
- **Amber** (Partial status badge): Partially paid accounts
- **Red** (Pending/Outstanding): Overdue or unpaid amounts

## API Integration

### Frontend API Service

Add to `frontend/src/api.ts`:

```tsx
getPaymentBalance: () => api.get('/rental/payment-balance'),
```

Usage:
```tsx
const response = await apiService.getPaymentBalance();
const tenantBalances = response.data;
```

## Responsive Design

The payment tracking screen is fully responsive:

- **Desktop**: Full table with all columns visible
- **Tablet**: Optimized filter layout with scrollable table
- **Mobile**: Stacked view with essential columns

## Performance Considerations

1. **Backend Calculation**: Pro-rata calculations happen on the backend to ensure consistency
2. **Batch Processing**: All tenant balances are fetched in a single API call
3. **Client-Side Filtering**: Fast, instant filtering without server round-trips
4. **Memoized Calculations**: React useMemo prevents unnecessary recalculations

## Future Enhancements

1. **Export to Excel/PDF**: Download payment summaries
2. **Payment History**: View detailed payment history per tenant
3. **Automated Reminders**: Send payment reminders for pending accounts
4. **Bulk Actions**: Batch payment processing
5. **Payment Plans**: Support for installment payment plans
6. **Receipt Generation**: Generate payment receipts

## Troubleshooting

### Missing Pro-Rata Values
- Verify check-in dates are in correct format (YYYY-MM-DD)
- Ensure room rent is properly configured in RoomDetail table

### Incorrect Balance Calculations
- Check that all payment records are properly linked to occupancies
- Verify that pro-rata calculations match expected values

### Data Not Loading
- Confirm `/api/rental/payment-balance` endpoint is accessible
- Check browser console for API errors
- Verify database connection and query permissions

## Database Tables Used

1. **Occupancy**: Contains check-in/check-out dates
2. **Tenant**: Tenant information
3. **RoomDetail**: Room rent amounts
4. **RentalCollection**: Payment records

## Related Features

- [Pro-Rata Rent Calculation Service](PRO_RATA_ELECTRICITY_CHARGES.md)
- [Rental Collection Dashboard](RENTAL_COLLECTION_DASHBOARD.md)
- [Check-In/Check-Out Implementation](CHECKIN_CHECKOUT_PRORATE.md)

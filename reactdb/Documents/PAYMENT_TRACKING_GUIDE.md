# Rental Payment Tracking Feature

## Overview

The Rental Payment Tracking screen provides a comprehensive dashboard for tracking and monitoring tenant rental payments on a monthly basis. It displays pending payments, payment status, and key financial metrics with an intuitive searchable interface.

## Features

### 1. **Month/Year Selection with Search**
- Searchable dropdown showing the current month and the last 12 months
- Type to filter months and years (e.g., "February", "2025")
- Easy navigation through historical payment data

### 2. **Summary Dashboard**
Displays four key metrics:
- **Total Tenants**: Number of occupants with rental records for the selected month
- **Total Rent Due**: Sum of all fixed rent amounts for the selected period
- **Total Received**: Sum of all payments collected in the selected month
- **Total Pending**: Sum of all outstanding balances for the month

### 3. **Payment Status Overview**
Quick view of payment status distribution:
- **Paid**: Tenants who have paid their full monthly rent
- **Partial**: Tenants who have paid some portion of their rent
- **Pending**: Tenants with no payments for the month

### 4. **Detailed Payment Table**
Comprehensive table displaying:
- **Tenant Name**: Full name of the tenant
- **Room Number**: Room identifier
- **Rent Fixed**: Monthly rent amount set for the occupancy
- **Rent Received**: Amount of payment received
- **Balance**: Outstanding balance (Rent Fixed - Rent Received)
- **Payment Date**: Date when payment was received (if any)
- **Status**: Visual badge indicating payment status (Paid, Partial, or Pending)

## API Endpoints

### Get Payments by Month-Year
```
GET /api/rental/payments/:monthYear
```

**Parameters:**
- `monthYear` (string, path parameter): Format `YYYY-MM` (e.g., "2025-02")

**Response Example:**
```json
[
  {
    "occupancyId": 1,
    "tenantId": 5,
    "tenantName": "John Doe",
    "roomNumber": "101",
    "rentFixed": 10000,
    "rentReceivedOn": "2025-02-15",
    "rentReceived": 10000,
    "rentBalance": 0,
    "month": 2,
    "year": 2025,
    "paymentStatus": "paid"
  },
  {
    "occupancyId": 2,
    "tenantId": 6,
    "tenantName": "Jane Smith",
    "roomNumber": "102",
    "rentFixed": 10000,
    "rentReceivedOn": "2025-02-20",
    "rentReceived": 5000,
    "rentBalance": 5000,
    "month": 2,
    "year": 2025,
    "paymentStatus": "partial"
  }
]
```

**Error Response:**
```json
{
  "error": "Invalid month-year format. Use YYYY-MM"
}
```

## Database Schema

The feature uses the following tables:

### Occupancy
- `Id`: Unique identifier
- `TenantId`: Reference to tenant
- `RoomId`: Reference to room
- `RentFixed`: Fixed monthly rent amount
- `CheckInDate`: Tenant check-in date
- `CheckOutDate`: Tenant check-out date

### RentalCollection
- `Id`: Unique identifier
- `OccupancyId`: Reference to occupancy
- `RentReceivedOn`: Date payment was received
- `RentReceived`: Amount of payment received
- `RentBalance`: Outstanding balance

### Tenant
- `Id`: Unique identifier
- `Name`: Tenant name
- `Phone`: Contact number
- `Address`: Address information

### RoomDetail
- `Id`: Unique identifier
- `Number`: Room number/identifier
- `Rent`: Base rent for the room

## Frontend Component

**File**: `src/components/PaymentTracking.tsx`

**Key Implementation Points:**
- Uses React hooks for state management (useState, useEffect, useMemo)
- Implements searchable dropdown for efficient month selection
- Performance optimized with memoized filters and calculations
- Responsive design for mobile and desktop
- Currency formatting with Indian Rupee (₹)

### Component State
```typescript
interface PaymentRecord {
  occupancyId: number;
  tenantId: number;
  tenantName: string;
  roomNumber: string;
  rentFixed: number;
  rentReceivedOn: string | null;
  rentReceived: number;
  rentBalance: number;
  month: number;
  year: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
}
```

## Usage Instructions

1. **Navigate to Payment Tracking**
   - Click the "Payment Tracking" button from the home page

2. **Select a Month**
   - Click the month/year dropdown
   - Type to search (e.g., "Jan", "2025")
   - Select from the filtered results

3. **Review Summary**
   - Check the summary cards for key metrics
   - Review the status distribution badges

4. **Analyze Payments**
   - Review the detailed table for individual tenant records
   - Sort by clicking column headers (if implemented)
   - Identify pending payments by status badge color

## Styling

The component uses a custom CSS file (`PaymentTracking.css`) with:
- **Color Scheme**:
  - Green (#22863a) for paid/success states
  - Orange (#cb2431) for pending states
  - Blue (#4299e1) for primary actions
- **Layout**: CSS Grid and Flexbox for responsive design
- **Accessibility**: Proper contrast ratios and semantic HTML

## Status Badges

- **Green (Paid)**: `rgb(198, 246, 213)` - Tenant has paid full rent
- **Orange (Partial)**: `rgb(254, 235, 200)` - Partial payment received
- **Red (Pending)**: `rgb(254, 215, 215)` - No payment or insufficient payment

## Performance Notes

- Memoized filter calculations prevent unnecessary re-renders
- Summary statistics calculated using useMemo hook
- Efficient dropdown filtering based on search input
- Loads data only when a month is selected

## Error Handling

- Invalid month-year format returns 400 error
- Database connection errors are caught and displayed
- User-friendly error messages in the UI
- Loading spinner during data fetch

## Future Enhancements

Potential improvements could include:
- Sorting and filtering of the payment table
- Export to CSV/PDF functionality
- Payment history timeline view
- Automated payment reminder notifications
- Payment analytics and trends
- Batch payment processing
- Custom date range selection (not just months)

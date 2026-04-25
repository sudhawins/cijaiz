# Tenant Management - Quick Start Guide

## 🚀 Getting Started

### Access the Feature
1. Open frontend at `http://localhost:3000`
2. Click **"Tenant Management"** button on home page
3. You'll see the tenant management dashboard with stats and search

## 📋 Dashboard Overview

### Statistics Dashboard
```
┌──────────────┬──────────────┬──────────────┐
│ Total        │   Occupied   │   Vacant     │
│ Tenants      │   Rooms      │   Rooms      │
│     12       │      8       │      4       │
└──────────────┴──────────────┴──────────────┘
```

### Search Interface
```
Search: [________________] 🔍
Search by: [All Fields ▼]
[Clear Search] (visible only when searching)
```

### Tenant Cards Grid
Each card shows:
- Tenant photo (or avatar with initial)
- Occupancy badge (Occupied/Vacant)
- Name, phone, city, address
- Room details (if occupied)
- Edit & Delete buttons

## 🎯 Common Tasks

### Add New Tenant
1. Click **"+ Add New Tenant"** button
2. Fill in required fields:
   - Name (e.g., "John Doe")
   - Phone (e.g., "9876543210")
   - City (e.g., "Mumbai")
   - Address (e.g., "123 Main Street")
3. Upload photo (optional) - click photo area
4. Add document URLs (optional)
5. Click **"Create Tenant"**

### Edit Tenant
1. Find tenant card
2. Click **"✎ Edit"** button
3. Modify any fields
4. Update photo if needed
5. Click **"Update Tenant"**

### Delete Tenant
1. Find tenant card
2. Click **"🗑 Delete"** button
3. Confirm in dialog: **"Yes, Delete"**
4. Tenant removed from system

*Note: Cannot delete if tenant has active room occupancy*

### Search Tenants

**By Name:**
1. Select "Name" from dropdown
2. Type tenant name
3. Results filter instantly

**By Phone:**
1. Select "Phone Number" from dropdown
2. Enter phone number
3. Matching tenants displayed

**By City:**
1. Select "City" from dropdown
2. Type city name
3. Results update

**By Address:**
1. Select "Address" from dropdown
2. Type address details
3. Tenants found

**Search All Fields:**
1. Keep dropdown on "All Fields"
2. Type any tenant info
3. Searches across all fields
## 💰 Payment Status Overview

The tenant card automatically shows current month payment information:

### If Payment is Complete
- Received amount equals or exceeds rent fixed
- Pending shows ₹0 with green background
- Shows last payment date

### If Payment is Pending
- Received amount is less than rent fixed
- Pending shows remaining balance with red background
- Easy visual indicator of who still owes rent

### Real-time Updates
- Payment information updates when new payments are recorded
- Automatically pulls current month data
- Synced with Payment Tracking system

Example Card:
```
┌─────────────────────────────────┐
│ John Doe                        │
│ 9876543210 | Mumbai             │
│                                 │
│ Room & Payment Details          │
│ Room: 101  Rent: ₹10,000        │
│ Check-in: Jan 15, 2025          │
│                                 │
│ Current Month Payment           │
│ ┌─────────────┬──────────────┐  │
│ │ Received    │   Pending    │  │
│ │ ₹10,000     │      ₹0      │  │
│ └─────────────┴──────────────┘  │
│ Last Payment: Feb 15, 2025       │
└─────────────────────────────────┘
```
## 📊 Tenant Card Information

### Basic Info
- **Name**: Tenant's full name
- **Phone**: Contact number
- **City**: Location
- **Address**: Street address

### Occupancy Badge
- **Green (Occupied)**: Tenant currently occupying a room
- **Red (Vacant)**: Tenant but no active occupancy

### Room Details (if Occupied)
- **Room**: Room number
- **Rent Fixed**: Monthly rent amount (₹)
- **Check-in**: Move-in date
- **Check-out**: Move-out date (if applicable)

### Current Month Payment Status
- **Received**: Amount paid for current month (₹)
- **Pending**: Outstanding balance for current month (₹)
- **Last Payment**: Date of most recent payment
- **Status Colors**:
  - Green: Payment fully received or no pending balance
  - Red: Outstanding balance pending

## 🔌 API Reference

### Get All Tenants
```bash
GET http://localhost:5000/api/tenants/with-occupancy
```

### Create Tenant
```bash
POST http://localhost:5000/api/tenants
Content-Type: application/json

{
  "name": "Jane Smith",
  "phone": "9876543211",
  "address": "456 Oak Ave",
  "city": "Boston",
  "photoUrl": "data:image/jpeg;base64,...",
  "proof1Url": null,
  "proof2Url": null,
  "proof3Url": null
}
```

### Update Tenant
```bash
PUT http://localhost:5000/api/tenants/1
Content-Type: application/json

{
  "name": "Jane Smith",
  "phone": "9876543211",
  "address": "456 Oak Ave",
  "city": "Boston",
  ...
}
```

### Delete Tenant
```bash
DELETE http://localhost:5000/api/tenants/1
```

### Search Tenant
```bash
GET http://localhost:5000/api/tenants/search?field=name&query=john
```

## 🎨 UI Elements Guide

### Buttons
- **Blue Button**: Main actions (Create, Update)
- **Gray Button**: Secondary actions (Cancel, Clear)
- **Red Button**: Danger actions (Delete)
- **Outlined Button**: Confirmation (Yes, Delete)

### Badges
- **Green Badge**: Occupied rooms
- **Red Badge**: Vacant tenants
- **Blue Badge**: Search field indicator

### Forms
- **Required fields**: Marked with *
- **Photo upload**: Click area to browse or drag-drop
- **Error messages**: Red background, appears above form
- **Success notifications**: Green background, auto-dismisses after 3 seconds

## 🔍 Search Examples

| Search Field | Example Input | Result |
|---|---|---|
| Name | "john" | All tenants with "john" in name |
| Phone | "9876" | All tenants with "9876" in phone |
| City | "mumbai" | All tenants in Mumbai |
| Address | "main" | All tenants on Main Street |
| All Fields | "123" | Tenants matching "123" anywhere |

## 📱 Mobile View

- Single column card layout
- Full-width search and filter boxes
- Stacked form fields
- Bottom action buttons
- Scrollable occupancy details

## ⚙️ Form Validation

| Field | Rule | Error Message |
|---|---|---|
| Name | Required | "Name is required" |
| Phone | Exactly 10 digits | "Phone number must be exactly 10 digits" |
| City | Required | "City is required" |
| Address | Required | "Address is required" |

## 🐛 Troubleshooting

### "No tenants found"
- Database might be empty
- Try adding first tenant with "+ Add New Tenant"

### "Cannot delete tenant"
- Check if tenant has active occupancy
- Tenant needs to be checked out first
- Contact admin to manage occupancy

### Photo not showing
- Photo might be broken URL
- Clear photo and re-upload
- Check file format (PNG, JPG allowed)

### Search not working
- Clear search box and try again
- Check search field selection
- Ensure database connection is active

### Form validation errors
- Check all required fields (marked with *)
- Verify phone format (numeric, exactly 10 digits)
- Check for extra spaces in input

## 📂 File Locations

```
Frontend:
/frontend/src/components/TenantManagement.tsx
/frontend/src/components/TenantManagement.css
/frontend/src/components/TenantForm.tsx
/frontend/src/components/TenantForm.css

Backend:
/backend/src/index.ts (endpoints in this file)

API Service:
/frontend/src/api.ts
```

## 💾 Data Structure

### Tenant Object
```javascript
{
  id: 1,
  name: "John Doe",
  phone: "9876543210",
  address: "123 Main St",
  city: "New York",
  photoUrl: "data:image/jpeg;base64,...",
  proof1Url: "https://...",
  proof2Url: null,
  proof3Url: null,
  occupancyId: 5,
  roomNumber: "101",
  checkInDate: "2025-01-15",
  checkOutDate: null,
  rentFixed: 10000,
  isCurrentlyOccupied: true
}
```

## 🔐 Security Notes

- Photos stored as Base64 in database
- All inputs are sanitized
- SQL injection prevented with parameterized queries
- CORS enabled for secure API calls

## 📊 Performance Tips

- Search is instant on client-side (no API call)
- Use specific search fields for faster filtering
- Large datasets (100+) may benefit from pagination
- Close unused modals to save memory

## 🎓 Keyboard Shortcuts

| Key | Action |
|---|---|
| Esc | Close form modal |
| Enter | Submit form (from any field) |
| Tab | Navigate form fields |

(Note: Must implement keyboard event handlers)

## 📞 Support

For issues:
1. Check TENANT_MANAGEMENT_GUIDE.md for detailed docs
2. Review browser console (F12) for errors
3. Check backend logs: `docker-compose logs backend`
4. Verify database connection is active

## 🚀 Next Steps

After setting up tenant management:
1. Add room occupancy details
2. Link to payment tracking
3. Set up rent reminders
4. Create tenant communication tools
5. Implement bulk operations

# Tenant Management Feature - Complete Documentation

## Overview

Comprehensive React frontend screen for managing tenants with full CRUD operations (Create, Read, Update, Delete), rich tenant profiles with images, occupancy details, and advanced searchable filtering across multiple fields.

## Features

### 1. **Tenant Profile Management**
- Create new tenant records with photo upload
- Edit existing tenant information
- Delete tenants (with validation for active occupancy)
- Photo preview and replacement
- Store up to 3 proof document URLs

### 2. **Advanced Search & Filtering**
- Real-time search across tenant information
- Search by specific fields:
  - Name
  - Phone Number
  - City
  - Address
  - All fields (default)
- Clear search functionality

### 3. **Occupancy Details Display**
For currently occupied tenants, display:
- Room number
- Monthly rent amount (rent fixed)
- Check-in date
- Check-out date (if applicable)
- Occupancy status badge (Occupied/Vacant)

### 4. **Current Month Payment Status**
For occupied tenants, display real-time payment information:
- Amount received in current month
- Pending balance for current month
- Last payment date
- Visual indicators (green for paid/partial, red for pending)
- Photo upload with preview
- Base64 encoding for image storage
- Fallback avatar with tenant initial
- Photo removal functionality

### 5. **Dashboard Statistics**
- Total number of tenants
- Count of occupied rooms
- Count of vacant rooms

## File Structure

```
frontend/src/components/
├── TenantManagement.tsx       # Main tenant management component
├── TenantManagement.css       # Tenant management styles
├── TenantForm.tsx             # Tenant form modal
└── TenantForm.css             # Form styles

frontend/src/
├── api.ts                     # API service methods
└── App.tsx                    # Navigation integration

backend/src/
└── index.ts                   # API endpoints
```

## Frontend Components

### TenantManagement.tsx

**Main Component**: Displays grid of tenant cards with search functionality

**Key Features**:
- State management for tenants, search query, and filters
- Real-time filtering based on search input and field selection
- CRUD operation handlers
- Modal form management
- Delete confirmation dialog

**State Variables**:
```typescript
- tenants: TenantWithOccupancy[] // All tenants with occupancy and payment data
- filteredTenants: TenantWithOccupancy[] // Filtered results
- loading: boolean // Loading state
- error: string | null // Error messages
- searchQuery: string // Current search input
- searchField: SearchField // Selected search field
- showForm: boolean // Form visibility
- editingTenant: TenantWithOccupancy | null // Tenant being edited
- showDeleteConfirm: number | null // Delete confirmation for tenant ID
- successMessage: string | null // Success notifications
```

**TenantWithOccupancy Interface**:
```typescript
interface TenantWithOccupancy extends Tenant {
  occupancyId?: number;
  roomNumber?: string;
  roomId?: number;
  checkInDate?: string;
  checkOutDate?: string | null;
  rentFixed?: number;
  isCurrentlyOccupied?: boolean;
  currentPendingPayment?: number;      // Current month pending balance
  currentRentReceived?: number;         // Current month amount received
  lastPaymentDate?: string;             // Date of last payment
}
```

**Key Functions**:
- `fetchTenants()` - Fetches all tenants with occupancy details
- `handleAddTenant()` - Opens form for new tenant
- `handleEditTenant(tenant)` - Opens form for editing
- `handleDeleteTenant(tenantId)` - Deletes tenant with confirmation
- `handleFormSubmit(formData)` - Saves new or updated tenant

### TenantForm.tsx

**Form Modal Component**: Collects and validates tenant information

**Fields**:
- Name (required)
- Phone Number (required, exactly 10 digits)
- City (required)
- Address (required)
- Photo (optional, file upload)
- Proof 1 URL (optional)
- Proof 2 URL (optional)
- Proof 3 URL (optional)

**Validation**:
- Required field validation
- Phone number format (exactly 10 digits)
- Photo upload with preview
- Base64 encoding for image storage

## Backend API Endpoints

### Get All Tenants with Occupancy and Payment Info
```
GET /api/tenants/with-occupancy
```
**Note**: This endpoint now includes:
- Occupied room details (room number, rent fixed)
- Current month payment status:
  - Amount received for current month
  - Pending balance for current month
  - Last payment date
- Uses JOINs with Occupancy, RoomDetail, and RentalCollection tables
- Automatically filters to current month data

**Response**:
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "phone": "9876543210",
    "address": "123 Main St",
    "city": "New York",
    "photoUrl": "data:image/jpeg;base64,...",
    "proof1Url": "https://...",
    "proof2Url": null,
    "proof3Url": null,
    "occupancyId": 5,
    "roomNumber": "101",
    "roomId": 1,
    "checkInDate": "2025-01-15",
    "checkOutDate": null,
    "rentFixed": 10000,
    "isCurrentlyOccupied": 1,
    "currentRentReceived": 10000,
    "currentPendingPayment": 0,
    "lastPaymentDate": "2025-02-15"
  }
]
```

### Get Single Tenant
```
GET /api/tenants/:id
```
**Parameters**: 
- `id` (number) - Tenant ID

**Response**: Single tenant object

### Create Tenant
```
POST /api/tenants
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
**Response**:
```json
{
  "id": 2,
  "message": "Tenant created successfully"
}
```

### Update Tenant
```
PUT /api/tenants/:id
Content-Type: application/json

{
  "name": "Jane Smith Updated",
  "phone": "9876543211",
  "address": "456 Oak Ave",
  "city": "Boston",
  "photoUrl": "data:image/jpeg;base64,...",
  "proof1Url": "https://...",
  "proof2Url": null,
  "proof3Url": null
}
```
**Response**:
```json
{
  "message": "Tenant updated successfully"
}
```

### Delete Tenant
```
DELETE /api/tenants/:id
```
**Parameters**: 
- `id` (number) - Tenant ID

**Response**:
```json
{
  "message": "Tenant deleted successfully"
}
```

**Error** (if tenant has active occupancy):
```json
{
  "error": "Cannot delete tenant with active occupancy. Check out the tenant first."
}
```

### Search Tenants
```
GET /api/tenants/search?field=name&query=john
```
**Query Parameters**:
- `field` (required) - Search field: 'name', 'phone', 'city', 'address'
- `query` (required) - Search query string

**Response**: Array of matching tenant objects

## Database Schema

### Tenant Table
```sql
[Id] INT PRIMARY KEY IDENTITY(1,1)
[Name] NCHAR(100) NOT NULL
[Phone] NCHAR(15) NOT NULL
[Address] NCHAR(100) NOT NULL
[City] NCHAR(50) NOT NULL
[PhotoUrl] NVARCHAR(MAX) NULL
[Proof1Url] NVARCHAR(MAX) NULL
[Proof2Url] NVARCHAR(MAX) NULL
[Proof3Url] NVARCHAR(MAX) NULL
```

### Occupancy Table (Related)
```sql
[Id] INT PRIMARY KEY IDENTITY(1,1)
[TenantId] INT NOT NULL (FK Tenant.Id)
[RoomId] INT NOT NULL (FK RoomDetail.Id)
[CheckInDate] NCHAR(10) NOT NULL
[CheckOutDate] NCHAR(10) NULL
[RentFixed] MONEY NULL
...
```

## API Service Methods

From `frontend/src/api.ts`:

```typescript
// Tenant Management APIs
getAllTenantsWithOccupancy: () => api.get('/tenants/with-occupancy')
getTenantById: (tenantId: number) => api.get(`/tenants/${tenantId}`)
createTenant: (data: any) => api.post('/tenants', data)
updateTenant: (tenantId: number, data: any) => api.put(`/tenants/${tenantId}`, data)
deleteTenant: (tenantId: number) => api.delete(`/tenants/${tenantId}`)
searchTenants: (field: string, query: string) => 
  api.get(`/tenants/search?field=${field}&query=${query}`)
```

## UI/UX Features

### Responsive Design
- Desktop: Grid layout showing 3-4 tenant cards per row
- Tablet: 2 cards per row
- Mobile: Single column layout

### Color Scheme
- Primary actions: Blue (#4299e1)
- Success/Occupied: Green (#22863a)
- Danger/Vacant: Red (#cb2431)
- Secondary: Gray (#e2e8f0)

### Tenant Cards
- Image header (200px height) with gradient fallback
- Tenant name and details
- Occupancy badge (top-right corner)
- Room details section (if occupied)
- Action buttons (Edit, Delete)

### Form Modal
- Centered overlay modal
- Smooth animations
- Photo upload with drag-and-drop support
- Input validation with error messages
- Document URL fields for proof documents

### States
- **Loading**: Spinner animation
- **Empty**: Message encouraging first tenant creation
- **No Results**: Message with clear filters button
- **Error**: Error message display with close button
- **Success**: Notification with auto-dismiss

## Usage Instructions

### Adding a Tenant
1. Click "+ Add New Tenant" button
2. Enter tenant information (name, phone, city, address)
3. Click photo area to upload image
4. Optionally add proof document URLs
5. Click "Create Tenant"

### Editing a Tenant
1. Click "Edit" button on tenant card
2. Modify desired fields
3. Update or change photo as needed
4. Click "Update Tenant"

### Deleting a Tenant
1. Click "Delete" button on tenant card
2. Confirm deletion in popup
3. Tenant is removed from system
(Note: Cannot delete if tenant has active occupancy)

### Searching Tenants
1. Enter search query in search box
2. Select search field from dropdown (optional)
3. Results filter in real-time
4. Click "Clear Search" to reset

## Data Validation

### Frontend Validation
- Required field checking
- Phone format validation (exactly 10 digits)
- URL format validation for proof documents
- Image file type and size checking

### Backend Validation
- Required field validation
- Active occupancy check before deletion
- SQL injection prevention with parameterized queries
- Phone number and email format validation

## Security Considerations

1. **Image Handling**: Base64 encoded images stored as text
2. **SQL Injection**: All inputs use parameterized queries
3. **CORS**: Enabled for frontend-backend communication
4. **Input Sanitization**: Whitespace trimming on text fields
5. **Authorization**: No role-based access (implement as needed)

## Performance Optimizations

1. **Memoization**: useMemo for filtered results
2. **Efficient Filtering**: Client-side filtering for instant results
3. **Lazy Loading**: Occupancy data joined in single query
4. **Pagination**: Can be added for large datasets (100+ tenants)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Testing Checklist

- [ ] Create new tenant with photo
- [ ] Edit tenant information
- [ ] Delete tenant (confirm failure if occupied)
- [ ] Search by name
- [ ] Search by phone
- [ ] Search by city
- [ ] Search by address
- [ ] Clear search filters
- [ ] View occupancy details
- [ ] Upload and preview photo
- [ ] Mobile responsiveness
- [ ] Error handling
- [ ] Form validation

## Future Enhancements

- Bulk import/export functionality
- Advanced filtering (occupancy status, room type)
- Tenant activity history
- Lease management and expiration alerts
- Automatic duplicate detection
- Photo gallery with multiple images
- Document management system
- Tenant communication tools
- Payment history integration
- Advanced analytics

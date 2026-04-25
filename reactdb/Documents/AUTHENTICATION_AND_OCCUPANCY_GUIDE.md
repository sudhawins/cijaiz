# Authentication & Room Occupancy Implementation Guide

## Overview
This document outlines the authentication system and room occupancy tracking features added to the Mansion Management System. These features enable secure user login and comprehensive room-level occupancy status tracking.

## What's New

### 1. Authentication System ✅

#### AuthContext Component ([AuthContext.tsx](../src/components/AuthContext.tsx))
- **Purpose**: Provides global authentication state management using React Context API
- **Key Features**:
  - User login/logout functionality
  - JWT token management
  - LocalStorage persistence for user session
  - Auto-authentication check on app mount
  - Error handling and state management
  
**Key Methods**:
```typescript
const { user, isAuthenticated, login, logout, error } = useAuth();
```

**Demo Credentials** (for testing):
- Username: `admin` / Password: `admin123` (Admin role)
- Username: `manager` / Password: `manager123` (Manager role)
- Username: `user` / Password: `user123` (User role)

#### LoginScreen Component ([LoginScreen.tsx](../src/components/LoginScreen.tsx))
- **Purpose**: Professional login interface with form validation
- **Features**:
  - Form validation (username required, password 6+ characters)
  - Show/hide password toggle
  - Loading state during login
  - Error message display
  - Responsive design
  - Disabled form state during submission
  - Demo credentials hint section

**Styling**: [LoginScreen.css](../src/components/LoginScreen.css)
- Gradient background with animation
- Card-based layout with shadow effects
- Password visibility toggle button
- Professional error messaging
- Mobile-responsive design

### 2. Room Occupancy Dashboard ✅

#### RoomOccupancy Component ([RoomOccupancy.tsx](../src/components/RoomOccupancy.tsx))
- **Purpose**: Displays room-level occupancy status and tenant information
- **Key Features**:
  - Statistics cards (total rooms, occupied, vacant, occupancy rate)
  - Real-time room status tracking (occupied/vacant)
  - Tenant information display when room is occupied
  - Current month payment status for each room
  - Search by room number or tenant name
  - Filter by occupancy status (all, occupied, vacant)
  - Revenue metrics (monthly rent, collected, pending)
  - Responsive grid layout

**Data Structure**:
```typescript
interface OccupancyData {
  roomId: number;
  roomNumber: string;
  roomRent: number;
  beds: number;
  isOccupied: boolean;
  tenantId?: number;
  tenantName?: string;
  tenantPhone?: string;
  checkInDate?: string;
  checkOutDate?: string | null;
  currentRentReceived?: number;
  currentPendingPayment?: number;
  lastPaymentDate?: string;
}
```

**Styling**: [RoomOccupancy.css](../src/components/RoomOccupancy.css)
- Professional card-based layout
- Color-coded occupancy status (green for occupied, orange for vacant)
- Statistics grid with hover effects
- Payment status section with received/pending amounts
- Mobile-responsive design
- Smooth animations

### 3. Backend API Endpoints

#### Authentication Endpoint
```
POST /api/auth/login
```
**Request Body**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@mansion.com",
    "role": "admin"
  }
}
```

**Error Response** (401 Unauthorized):
```json
{
  "error": "Invalid username or password"
}
```

#### Room Occupancy Endpoint
```
GET /api/rooms/occupancy
```

**Response** (200 OK):
```json
[
  {
    "roomId": 1,
    "roomNumber": "101",
    "roomRent": 5000,
    "beds": 2,
    "isOccupied": 1,
    "tenantId": 5,
    "tenantName": "John Doe",
    "tenantPhone": "555-0101",
    "checkInDate": "2024-01-15",
    "checkOutDate": null,
    "currentRentReceived": 5000,
    "currentPendingPayment": 0,
    "lastPaymentDate": "2024-12-01"
  },
  ...
]
```

### 4. App Integration

#### Updated App.tsx
- Wrapped application with `<AuthProvider>` for global auth state
- Conditional rendering: Shows LoginScreen if not authenticated
- Added RoomOccupancy page to navigation ('occupancy' route)
- Added logout button in home header
- User welcome message displays current username
- Protected routes structure

#### Updated Navigation
- **Home**: Dashboard with system status
- **Room Occupancy**: New page for room tracking (✨ NEW)
- **Tenant Management**: CRUD operations for tenants
- **Rental Collection**: Rental data management
- **Payment Tracking**: Monthly payment tracking
- **Diagnostic**: System diagnostics

### 5. API Client Updates ([api.ts](../src/api.ts))

**New Functions**:
```typescript
export const login = async (username: string, password: string) => { ... }
export const getRoomOccupancyData = async () => { ... }
```

**Request Interceptor**: Automatically adds JWT token to all API requests
```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm 10+
- Azure SQL Database connection
- Environment variables configured

### Backend Setup
```bash
cd backend

# Install dependencies (jsonwebtoken added)
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev
```

**Backend Dependencies Added**:
- `jsonwebtoken`: ^11.0.0 - JWT token generation
- `@types/jsonwebtoken`: TypeScript types

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

**Frontend runs on**: `http://localhost:3003`
**Backend API**: `http://localhost:5000/api`

## Configuration

### Environment Variables
**Frontend** (.env or .env.local):
```
VITE_API_URL=http://localhost:5000/api
```

**Backend** (JWT):
```
JWT_SECRET=your-secret-key-change-in-production
```

## Security Notes

### Current Implementation
- ✅ JWT tokens for stateless authentication
- ✅ Token stored in localStorage
- ✅ Token automatically added to all API requests
- ✅ Demo credentials for testing
- ✅ Form validation on client and server

### Recommendations for Production
1. **Password Hashing**: Use bcrypt instead of plain text comparison
2. **Token Expiration**: Implement refresh tokens (currently 24h expiration)
3. **HTTPS**: Always use HTTPS in production
4. **Secure Storage**: Use httpOnly cookies for token storage instead of localStorage
5. **Role-Based Access Control**: Implement role-based route protection
6. **Rate Limiting**: Add rate limiting to auth endpoint
7. **CORS**: Configure CORS appropriately for production domain

## Testing

### Login Flow
1. Application loads and redirects unauthenticated users to login
2. Enter credentials: `admin` / `admin123`
3. Click "Sign In" button
4. User authenticated and redirected to dashboard
5. User info displayed: "Welcome back, admin!"
6. Click "Sign Out" to logout from any page

### Room Occupancy Features
1. Navigate to "Room Occupancy" page
2. View statistics: Total rooms, occupied, vacant, occupancy rate
3. Search by room number or tenant name
4. Filter by occupancy status (all, occupied, vacant)
5. View detailed tenant and payment info for occupied rooms
6. See pending payments highlighted in orange

## File Structure

```
frontend/src/
├── components/
│   ├── AuthContext.tsx          (NEW) Authentication context provider
│   ├── LoginScreen.tsx          (NEW) Login form component
│   ├── LoginScreen.css          (NEW) Login styling
│   ├── RoomOccupancy.tsx        (NEW) Room occupancy dashboard
│   ├── RoomOccupancy.css        (NEW) Room occupancy styling
│   ├── PaymentTracking.tsx      (existing)
│   ├── TenantManagement.tsx     (existing)
│   └── ...
├── App.tsx                      (UPDATED) Auth integration
├── App.css                      (UPDATED) Logout button styling
└── api.ts                       (UPDATED) Auth APIs, room endpoint

backend/src/
├── index.ts                     (UPDATED) New endpoints added
│   └── POST /api/auth/login     (NEW)
│   └── GET /api/rooms/occupancy (NEW)
├── database.ts                  (existing)
└── ...
```

## API Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/api/auth/login` | User authentication | ❌ No |
| GET | `/api/rooms/occupancy` | Room occupancy data | ✅ Yes |
| GET | `/api/tenants/with-occupancy` | Tenant with occupancy | ✅ Yes |
| GET | `/api/rental/payments/:monthYear` | Monthly payments | ✅ Yes |
| POST | `/api/tenants` | Create tenant | ✅ Yes |
| PUT | `/api/tenants/:id` | Update tenant | ✅ Yes |
| DELETE | `/api/tenants/:id` | Delete tenant | ✅ Yes |

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Login Returns 401 Error
- Verify credentials: admin/admin123, manager/manager123, user/user123
- Check backend is running on port 5000
- Check VITE_API_URL configuration

### Room Occupancy Shows Empty
- Verify database has RoomDetail records
- Check database connection in backend
- Inspect browser console for API errors

### Token Not Persisting
- Check localStorage is enabled
- Clear browser cache and cookies
- Verify authToken is saved after login

## Next Steps & Enhancements

1. **Database User Authentication**: Query users from database with password hashing
2. **Role-Based Authorization**: Implement middleware for role-based access control
3. **Protected Routes**: Create ProtectedRoute wrapper component
4. **Token Refresh**: Implement refresh token mechanism
5. **Session Management**: Add session timeout and auto-logout
6. **Audit Logging**: Track user actions and authentication events
7. **Multi-Factor Authentication**: Add 2FA/MFA support
8. **User Management**: Admin panel for user CRUD operations

## Support & Documentation

For detailed implementation notes, refer to:
- [Payment Tracking Guide](./PaymentTracking_Guide.md)
- [Tenant Management Guide](./TenantManagement_Guide.md)
- [Room Occupancy Dashboard](./RoomOccupancy.md)

---

**Last Updated**: December 2024
**Version**: 1.0.0 with Authentication & Room Occupancy

# Admin Role Management System - Implementation Guide

## Overview

A complete admin role management system has been implemented to allow administrators to manage user roles and permissions across the e-commerce platform. This enables scalable user access control with Admin, Customer, and Seller roles.

## Features Implemented

### 1. Backend API Endpoints

#### Get All Users (Admin Only)
- **Endpoint:** `GET /api/auth/users`
- **Authentication:** Required (Bearer Token)
- **Authorization:** Admin role only
- **Response:**
  ```json
  {
    "totalUsers": 5,
    "users": [
      {
        "Id": 1,
        "UserName": "john_doe",
        "Name": "John Doe",
        "CreatedDate": "2026-01-15T10:30:00Z",
        "LastLogin": "2026-03-10T14:22:00Z",
        "RoleId": 3,
        "RoleName": "Customer",
        "RoleType": "Customer"
      },
      ...
    ]
  }
  ```

#### Get User by ID (Admin or Own Profile)
- **Endpoint:** `GET /api/auth/users/:userId`
- **Authentication:** Required (Bearer Token)
- **Authorization:** Admin or the user requesting their own profile
- **Response:** User object with role information

#### Update User Role (Admin Only)
- **Endpoint:** `PUT /api/auth/users/:userId/role`
- **Authentication:** Required (Bearer Token)
- **Authorization:** Admin role only
- **Request Body:**
  ```json
  {
    "roleId": 2
  }
  ```
- **Response:**
  ```json
  {
    "message": "User role updated successfully",
    "result": {
      "userId": 1,
      "roleId": 2
    }
  }
  ```

#### Get All Roles (Admin Only)
- **Endpoint:** `GET /api/auth/roles`
- **Authentication:** Required (Bearer Token)
- **Authorization:** Admin role only
- **Response:**
  ```json
  [
    {
      "Id": 1,
      "RoleName": "Administrator",
      "RoleType": "Admin"
    },
    {
      "Id": 2,
      "RoleName": "Seller",
      "RoleType": "Seller"
    },
    {
      "Id": 3,
      "RoleName": "Customer",
      "RoleType": "Customer"
    }
  ]
  ```

### 2. Frontend Components

#### AdminPanel Component
- **Location:** `client/src/components/AdminPanel.js`
- **Props:** None
- **Features:**
  - Admin dashboard with tabbed interface
  - Navigation between different admin features
  - Extensible for future admin features
  - Responsive design

#### RoleManagement Component
- **Location:** `client/src/components/RoleManagement.js`
- **Props:** None
- **Features:**
  - Display all users in a sortable, filterable table
  - View user details (username, full name, current role, creation date)
  - Change user roles with a dedicated role editor
  - View all available roles
  - Real-time updates after role changes
  - Error handling and success notifications
  - Responsive table with mobile-friendly layout

### 3. API Client Functions

#### Get All Users
```javascript
import { getAllUsers } from '../api';

const usersResponse = await getAllUsers();
// Returns: { totalUsers: number, users: User[] }
```

#### Get User by ID (Admin)
```javascript
import { getAdminUserById } from '../api';

const user = await getAdminUserById(userId);
// Returns: User object with role information
```

#### Update User Role
```javascript
import { updateUserRole } from '../api';

await updateUserRole(userId, roleId);
// Returns: { message: string, result: object }
```

#### Get All Roles
```javascript
import { getUserRoles } from '../api';

const roles = await getUserRoles();
// Returns: Role[] array
```

### 4. Authorization & Authentication

The system uses JWT-based authentication with role-based access control:

- **Admin Role:** Full access to role management and user administration
- **Seller Role:** Can upload products and manage their own products
- **Customer Role:** Can browse products and place orders

Admin endpoints are protected with the `isAdmin` middleware that verifies:
1. Valid JWT token is provided
2. Token contains `roleType: 'Admin'`

### 5. UI Integration

#### Admin Navigation
- Visible only to users with Admin role
- Accessible via the bottom navigation bar labeled "🔐 Admin"
- Styled with distinct color (#667eea) to differentiate from other navigation items

#### Navigation Setup
```javascript
{user && hasRole('Admin') && (
  <button
    className={`nav-link admin-link ${currentPage === 'admin' ? 'active' : ''}`}
    onClick={() => setCurrentPage('admin')}
  >
    🔐 Admin
  </button>
)}
```

## How to Use

### 1. Access Admin Panel
1. Log in with an Admin account
2. Click the "🔐 Admin" button in the navigation bar
3. You'll be taken to the Admin Panel

### 2. Manage User Roles
1. In the Admin Panel, the "Role Management" tab shows all users
2. Locate the user you want to manage
3. Click "Change Role" button
4. Select the new role from the dropdown
5. Click "Update Role" to save changes
6. The page automatically refreshes with updated information

### 3. View User Information
- User ID, username, full name
- Current role and role type
- Account creation date
- Last login information

### 4. View Available Roles
- Scroll down to see all available roles
- Each role card displays the role name, type, and ID
- Use this information when assigning roles

## Database Schema

The system uses three key tables:

### User Table
- `Id` (int, PK)
- `UserName` (nvarchar, unique)
- `Password` (nvarchar)
- `Name` (nvarchar)
- `CreatedDate` (datetime2)
- `LastLogin` (datetime2, nullable)

### RoleDetail Table
- `Id` (int, PK)
- `RoleName` (nvarchar) - e.g., "Administrator", "Seller", "Customer"
- `RoleType` (nvarchar) - e.g., "Admin", "Seller", "Customer"

### UserRole Junction Table
- `UserId` (int, FK to User)
- `RoleId` (int, FK to RoleDetail)
- `CreatedDate` (datetime2)

## Security Features

### 1. Authentication
- JWT tokens with 24-hour expiration
- Automatic token injection in all API requests
- Token validation on every protected endpoint

### 2. Authorization
- Role-based access control (RBAC)
- Admin-only endpoints protected by `isAdmin` middleware
- User can only access their own profile (or any if Admin)

### 3. Data Protection
- All API endpoints require valid JWT token
- Passwords are hashed with bcryptjs (10 salt rounds)
- SQL parameters prevent injection attacks

## Error Handling

The RoleManagement component provides user-friendly error messages:

- **Failed to load users:** Notifies user if data retrieval fails
- **Failed to update role:** Shows error if role assignment fails
- **Form validation:** Prevents submission with invalid selections

Success messages confirm:
- Role update completion
- User feedback on changes

## Styling

### Color Scheme
- Admin panel: Purple gradient (#667eea)
- Success messages: Green (#3c3)
- Error messages: Red (#c33)
- Role badges: Neutral gray with colored role types

### Responsive Design
- Mobile-friendly layout
- Adaptive navigation bar
- Responsive table with horizontal scrolling on small screens
- Stacked controls on mobile devices

## File Structure

```
client/src/
├── components/
│   ├── AdminPanel.js           # Main admin dashboard
│   ├── AdminPanel.css          # Admin panel styling
│   ├── RoleManagement.js       # Role management interface
│   └── RoleManagement.css      # Role management styling
├── api.js                      # Updated with admin functions
└── App.js                      # Contains admin route and navigation

server/
├── services/
│   └── userService.js          # Updated with getAllUsers()
├── routes/
│   └── auth.js                 # New admin endpoints
└── middleware/
    └── auth.js                 # Auth and role verification
```

## Testing the System

### 1. Setup Test Users
```sql
-- Ensure you have an Admin user
INSERT INTO [User] (UserName, Password, Name, CreatedDate)
VALUES ('admin_user', 'admin_password', 'Admin User', GETDATE())

-- Assign Admin role
SELECT Id FROM RoleDetail WHERE RoleType = 'Admin'
INSERT INTO UserRole (UserId, RoleId, CreatedDate)
VALUES (1, 1, GETDATE())
```

### 2. Test Scenarios
1. **Non-Admin Access:** Log in as Customer/Seller and verify Admin link doesn't appear
2. **Admin Access:** Log in as Admin and verify Admin link appears
3. **Role Change:** Change a user's role and verify it updates immediately
4. **Error Handling:** Try updating without selecting a role (button disabled)

## Troubleshooting

### Admin Link Not Showing
- Verify user has Admin role in database
- Check JWT token includes `roleType: 'Admin'`
- Clear browser cache and LocalStorage

### Role Update Fails
- Verify the roleId is valid and exists in RoleDetail table
- Ensure JWT token is valid and not expired
- Check browser console for error messages

### Users Not Loading
- Verify JWT token has Admin role
- Check network tab for 403 or 401 responses
- Inspect the `/api/auth/users` response in console

## Future Enhancements

Planned features for future versions:
1. **User Search & Filter:** Search users by name or role
2. **Bulk Role Assignment:** Update multiple users at once
3. **User Deletion:** Soft delete users (mark as inactive)
4. **Audit Logging:** Track all role changes with timestamp and admin user
5. **Permission Management:** Define granular permissions per role
6. **User Deactivation:** Enable/disable user accounts
7. **Analytics Dashboard:** User statistics and activity monitoring

## API Testing with cURL

### Get All Users
```bash
curl -X GET http://localhost:5002/api/auth/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update User Role
```bash
curl -X PUT http://localhost:5002/api/auth/users/2/role \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleId": 2}'
```

### Get All Roles
```bash
curl -X GET http://localhost:5002/api/auth/roles \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Summary

The Admin Role Management System provides:
- ✅ Comprehensive user and role management interface
- ✅ Secure, token-based authentication
- ✅ Role-based access control
- ✅ Responsive, user-friendly UI
- ✅ Real-time role updates
- ✅ Error handling and validation
- ✅ Extensible architecture for future features

Administrators can now efficiently manage user roles and permissions through a dedicated admin panel, improving system maintainability and user access control.

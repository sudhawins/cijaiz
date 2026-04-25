# Authentication and Role-Based Access Control (RBAC) Implementation

## Overview
This document describes the authentication and role-based access control implementation for the e-commerce application using JWT tokens and the existing User/Role schema.

## Architecture

### Backend Components

#### 1. Database Schema
The implementation uses three main tables:
- **User**: Stores user credentials and profile information
  - `Id`: User ID (Primary Key)
  - `UserName`: Unique username
  - `Password`: Hashed password (bcrypt)
  - `Name`: User's full name
  - `CreatedDate`: Account creation date
  - `LastLogin`: Last login timestamp

- **RoleDetail**: Stores role definitions
  - `Id`: Role ID (Primary Key)
  - `RoleName`: Display name of the role (e.g., "Administrator")
  - `RoleType`: Type of role for permission checking (e.g., "Admin", "Customer")

- **UserRole**: Junction table mapping users to roles
  - `UserId`: Foreign key to User
  - `RoleId`: Foreign key to RoleDetail
  - `CreatedDate`: Assignment date

#### 2. Authentication Middleware (`middleware/auth.js`)
Provides several middleware functions:
- `verifyToken`: Validates JWT token and extracts user information
- `checkRole(allowedRoles)`: Checks if user has required role(s)
- `isAdmin`: Shorthand for checking admin role
- `optionalAuth`: Optional authentication (doesn't fail if no token)

#### 3. User Service (`services/userService.js`)
Handles all user-related database operations:
- `registerUser(userName, password, name)`: Creates new user with default role
- `loginUser(userName, password)`: Authenticates user and returns JWT token
- `getUserById(userId)`: Retrieves user information
- `updateUserRole(userId, roleId)`: Changes user's role
- `getAllRoles()`: Lists all available roles
- Utility functions for password hashing and token generation

#### 4. Authentication Routes (`routes/auth.js`)
REST API endpoints:
- `POST /api/auth/register`: Register new user
- `POST /api/auth/login`: Login user and receive JWT token
- `GET /api/auth/me`: Get current user profile (requires auth)
- `GET /api/auth/roles`: Get all roles (admin only)
- `PUT /api/auth/users/:userId/role`: Update user role (admin only)

### Security Features

#### Password Hashing
- Uses `bcryptjs` for secure password hashing
- Salt rounds: 10 (strong hashing)
- Passwords are never stored in plain text

#### JWT Tokens
- Token expiration: 24 hours
- Secret key: Configurable via `JWT_SECRET` environment variable
- Token includes: userId, userName, name, roleType, roleId
- Transmitted via Authorization header: `Bearer <token>`

#### Request Authentication
- All protected endpoints require valid JWT token
- Token validation happens automatically via middleware
- Invalid/expired tokens return 401 Unauthorized

### Frontend Components

#### 1. Authentication API (`client/src/api.js`)
API client functions:
- `registerUser(userName, password, name)`
- `loginUser(userName, password)`
- `getCurrentUser()`
- `getUserRoles()`
- `updateUserRole(userId, roleId)`
- `logout()`

Includes request interceptor to automatically add Authorization header with stored token.

#### 2. Login Component (`client/src/components/Login.js`)
User login interface:
- Username and password input fields
- Error message display
- Link to registration page
- Stores token and user data in localStorage

#### 3. Register Component (`client/src/components/Register.js`)
User registration interface:
- Full name, username, password fields
- Form validation
- Success/error messages
- Auto-login after successful registration

#### 4. User Profile Component (`client/src/components/UserProfile.js`)
Displays current user information:
- Username, name, role
- Account creation date
- Last login timestamp
- Logout button

#### 5. Protected Routes (`client/src/components/ProtectedRoute.js`)
Route protection components:
- `ProtectedRoute`: Requires authentication
- `RoleBasedRoute`: Requires specific role
- `MultiRoleRoute`: Requires one of multiple roles
- Redirects to login if not authenticated

#### 6. Authentication Utilities (`client/src/utils/authUtils.js`)
Helper functions:
- `getAuthToken()`: Retrieve stored JWT token
- `getUser()`: Retrieve stored user information
- `isAuthenticated()`: Check if user is logged in
- `hasRole(requiredRole)`: Check if user has specific role
- `isAdmin()`: Check if user is admin
- `clearAuth()`: Clear stored authentication data

## Usage Examples

### Backend Usage

#### Protecting Routes with Authentication
```javascript
const { verifyToken } = require('./middleware/auth');

// Route that requires authentication
router.get('/protected', verifyToken, (req, res) => {
  res.json({ userId: req.user.userId, userName: req.user.userName });
});
```

#### Protecting Routes with Specific Role
```javascript
const { verifyToken, checkRole } = require('./middleware/auth');

// Route that requires admin role
router.delete('/admin/users/:id', 
  verifyToken, 
  checkRole(['Admin']), 
  async (req, res) => {
    // Admin-only logic
  }
);
```

#### Multiple Roles
```javascript
const { verifyToken, checkRole } = require('./middleware/auth');

// Route accessible by admin or seller
router.post('/products', 
  verifyToken, 
  checkRole(['Admin', 'Seller']), 
  async (req, res) => {
    // Admin/Seller logic
  }
);
```

### Frontend Usage

#### Basic Login Flow
```javascript
import { loginUser } from './api';
import { getUser, isAuthenticated } from './utils/authUtils';

// Login user
const result = await loginUser('john', 'password123');
localStorage.setItem('authToken', result.data.token);
localStorage.setItem('user', JSON.stringify(result.data.user));

// Check if logged in
if (isAuthenticated()) {
  const user = getUser();
  console.log(`Welcome ${user.name}`);
}
```

#### Route Protection
```javascript
import { ProtectedRoute, RoleBasedRoute } from './components/ProtectedRoute';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';

<Routes>
  <Route path="/login" element={<Login />} />
  <Route 
    path="/dashboard" 
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    } 
  />
  <Route 
    path="/admin" 
    element={
      <RoleBasedRoute requiredRole="Admin">
        <AdminPanel />
      </RoleBasedRoute>
    } 
  />
</Routes>
```

#### Checking Permissions
```javascript
import { isAdmin, hasRole, hasAnyRole } from './utils/authUtils';

if (isAdmin()) {
  // Show admin features
}

if (hasRole('Seller')) {
  // Show seller features
}

if (hasAnyRole(['Admin', 'Seller'])) {
  // Show admin or seller features
}
```

## Database Setup

### Create Role Types
Before using the system, create default roles:
```sql
INSERT INTO RoleDetail (RoleName, RoleType, createdDate)
VALUES 
  ('Administrator', 'Admin', GETDATE()),
  ('Customer', 'Customer', GETDATE()),
  ('Seller', 'Seller', GETDATE()),
  ('Moderator', 'Moderator', GETDATE());
```

### Example User Creation
```sql
-- Insert user
INSERT INTO [User] (UserName, Password, Name, CreatedDate)
VALUES ('john_doe', '$2a$10$...hashed_password...', 'John Doe', GETDATE());

-- Assign role
INSERT INTO UserRole (UserId, RoleId, CreatedDate)
VALUES (1, 1, GETDATE()); -- Assign admin role
```

## Environment Variables

Required environment variables:
```
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=24h
DB_SERVER=your-server
DB_NAME=your-database
DB_USER=your-username
DB_PASSWORD=your-password
```

## API Endpoints Summary

### Authentication Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login user |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/auth/roles` | Admin | List all roles |
| PUT | `/api/auth/users/:id/role` | Admin | Update user role |

### Protected Endpoints Example
Any endpoint can be protected by adding the `verifyToken` middleware:
```javascript
router.get('/api/protected', verifyToken, handler);
```

## Security Best Practices

1. **Always hash passwords**: Use bcryptjs with salt rounds ≥ 10
2. **Use HTTPS**: Always transmit tokens over HTTPS in production
3. **Secure token storage**: Store tokens in httpOnly cookies or secure storage
4. **Token expiration**: Implement token refresh mechanism for long sessions
5. **CORS configuration**: Properly configure CORS for frontend
6. **Validate input**: Always validate user input on backend
7. **SQL injection prevention**: Use parameterized queries (already implemented)
8. **Rate limiting**: Implement rate limiting on auth endpoints in production

## Troubleshooting

### "Invalid token" error
- Ensure token is correctly formatted with "Bearer " prefix
- Check token expiration (24 hours)
- Verify JWT_SECRET environment variable

### "Insufficient permissions" error
- Verify user's role in database
- Check role names match exactly (case-sensitive)
- Ensure user is assigned a role via UserRole table

### Password mismatch on registration
- Ensure password fields match during registration
- Check password minimum length (6 characters)

## Future Enhancements

1. **Token Refresh**: Implement refresh tokens for extended sessions
2. **Two-Factor Authentication**: Add 2FA support
3. **OAuth Integration**: Add social login (Google, GitHub, etc.)
4. **Audit Logging**: Log all authentication events
5. **Permission System**: Move from role-based to permission-based system
6. **Session Management**: Track active sessions and allow logout from all devices

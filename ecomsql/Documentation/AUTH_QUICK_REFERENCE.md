# Authentication & RBAC Quick Reference

## 🔐 Backend Authentication Endpoints

### Registration & Login
```
POST    /api/auth/register
        Body: { userName, password, name }
        Response: { userId, userName, name }

POST    /api/auth/login
        Body: { userName, password }
        Response: { token, user: { id, userName, name, role, roleType } }
```

### User Profile
```
GET     /api/auth/me
        Auth: Required
        Response: User object with role info
```

### Role Management (Admin Only)
```
GET     /api/auth/roles
        Auth: Required + Admin role
        Response: [{ Id, RoleName, RoleType }]

PUT     /api/auth/users/:userId/role
        Auth: Required + Admin role
        Body: { roleId }
        Response: Success message
```

---

## 🎯 Middleware Usage

### Protect Route with Authentication
```javascript
const { verifyToken } = require('./middleware/auth');

router.get('/protected', verifyToken, (req, res) => {
  // req.user contains: userId, userName, name, roleType, roleId
});
```

### Check Specific Role
```javascript
const { verifyToken, checkRole } = require('./middleware/auth');

router.delete('/admin/delete', 
  verifyToken, 
  checkRole(['Admin']), 
  (req, res) => { /* Admin only */ }
);
```

### Multiple Roles
```javascript
router.post('/create', 
  verifyToken, 
  checkRole(['Admin', 'Seller']), 
  (req, res) => { /* Admin or Seller */ }
);
```

### Optional Authentication
```javascript
const { optionalAuth } = require('./middleware/auth');

router.get('/public', optionalAuth, (req, res) => {
  // Works with or without token
  if (req.user) { /* Authenticated */ }
});
```

---

## 📱 Frontend API Functions

### Authentication
```javascript
import { 
  registerUser,
  loginUser,
  getCurrentUser,
  getUserRoles,
  updateUserRole,
  logout
} from './api';

// Register
await registerUser('john', 'password123', 'John Doe');

// Login
const { data } = await loginUser('john', 'password123');
localStorage.setItem('authToken', data.token);

// Get profile
const user = await getCurrentUser();

// Get all roles (admin)
const roles = await getUserRoles();

// Update role (admin)
await updateUserRole(userId, roleId);

// Logout
logout();
```

---

## 🛡️ Frontend Utilities

### Auth Status
```javascript
import { 
  isAuthenticated,
  getUser,
  hasRole,
  hasAnyRole,
  isAdmin,
  getAuthToken,
  clearAuth
} from './utils/authUtils';

isAuthenticated()           // Returns: boolean
getUser()                   // Returns: { id, userName, name, roleType, role }
getAuthToken()              // Returns: JWT token string
hasRole('Admin')            // Returns: boolean
hasAnyRole(['Admin', 'Seller'])  // Returns: boolean
isAdmin()                   // Returns: boolean
clearAuth()                 // Clears storage
```

---

## 🚦 Frontend Route Protection

### Simple Authentication Required
```javascript
import { ProtectedRoute } from './components/ProtectedRoute';

<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

### Specific Role Required
```javascript
import { RoleBasedRoute } from './components/ProtectedRoute';

<Route path="/admin" element={
  <RoleBasedRoute requiredRole="Admin">
    <AdminPanel />
  </RoleBasedRoute>
} />
```

### Multiple Roles
```javascript
import { MultiRoleRoute } from './components/ProtectedRoute';

<Route path="/seller" element={
  <MultiRoleRoute requiredRoles={['Admin', 'Seller']}>
    <SellerPanel />
  </MultiRoleRoute>
} />
```

---

## 💾 Database Schema

### User Table
```sql
CREATE TABLE [User] (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  UserName NVARCHAR(100) NOT NULL UNIQUE,
  Password NVARCHAR(500) NOT NULL,    -- Bcrypt hashed
  Name NVARCHAR(500),
  CreatedDate DATETIME2 NOT NULL,
  LastLogin DATETIME2
);
```

### RoleDetail Table
```sql
CREATE TABLE [RoleDetail] (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  RoleName NVARCHAR(50) NOT NULL,      -- Display: "Administrator"
  RoleType NVARCHAR(50) NOT NULL,      -- Check: "Admin"
  createdDate DATE,
  updatedDate DATE
);
```

### UserRole Junction Table
```sql
CREATE TABLE [UserRole] (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT FOREIGN KEY,
  RoleId INT FOREIGN KEY,
  CreatedDate DATETIME2 NOT NULL
);
```

### Initialize Default Roles
```sql
INSERT INTO RoleDetail (RoleName, RoleType, createdDate)
VALUES 
  ('Administrator', 'Admin', GETDATE()),
  ('Customer', 'Customer', GETDATE()),
  ('Seller', 'Seller', GETDATE()),
  ('Moderator', 'Moderator', GETDATE());
```

---

## 🔑 JWT Token Structure

```javascript
// Token payload (decoded):
{
  userId: 1,
  userName: "john_doe",
  name: "John Doe",
  roleType: "Admin",
  roleId: 1,
  iat: 1678432800,
  exp: 1678519200  // Expires in 24 hours
}

// Usage:
// Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 📦 Environment Variables

### Server (.env)
```env
PORT=5000
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=24h

DB_SERVER=localhost
DB_NAME=ecommerce
DB_USER=user
DB_PASSWORD=password
DB_PORT=1433

CLIENT_URL=http://localhost:3000
```

### Client (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🧪 Test Scenarios

### Test 1: User Registration
```bash
POST /api/auth/register
{
  "userName": "testuser",
  "password": "password123",
  "name": "Test User"
}
# Expected: 201 Created with userId
```

### Test 2: User Login
```bash
POST /api/auth/login
{
  "userName": "testuser",
  "password": "password123"
}
# Expected: 200 OK with token and user info
```

### Test 3: Access Protected Route
```bash
GET /api/auth/me
Headers: Authorization: Bearer <token>
# Expected: 200 OK with user details
```

### Test 4: Unauthorized Access
```bash
GET /api/auth/roles
# Expected: 401 Unauthorized (no token)
```

### Test 5: Insufficient Permissions
```bash
GET /api/auth/roles
Headers: Authorization: Bearer <customer-token>
# Expected: 403 Forbidden (not admin)
```

---

## 🔄 Common Workflows

### Registration & Auto-Login
```javascript
// 1. Register
await registerUser('john', 'password123', 'John Doe');

// 2. Login
const { data } = await loginUser('john', 'password123');

// 3. Store token
localStorage.setItem('authToken', data.token);
localStorage.setItem('user', JSON.stringify(data.user));

// 4. Redirect
navigate('/');
```

### Accessing Protected API
```javascript
// Import function with built-in auth
import { getOrders } from './api';

// Call - token automatically included
const orders = await getOrders();

// On server side:
router.get('/orders', verifyToken, (req, res) => {
  // req.user = { userId, userName, ... }
  const userId = req.user.userId;
});
```

### Role-Based Component Display
```javascript
import { isAdmin, hasRole } from './utils/authUtils';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      {isAdmin() && <AdminPanel />}
      {hasRole('Seller') && <SellerSection />}
      <CustomerSection />  {/* Always shown */}
    </div>
  );
}
```

---

## ⚠️ Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request format, missing fields |
| 401 | Unauthorized | No token or invalid token, login required |
| 403 | Forbidden | Token valid but insufficient permissions |
| 409 | Conflict | Username already exists during registration |
| 500 | Server Error | Check server logs |

---

## 🚀 Performance Tips

1. **Token Caching**: Store token in httpOnly cookie for security
2. **Request Interceptor**: All API calls include token automatically
3. **Role Checking**: Check roles in components before rendering sensitive content
4. **Token Refresh**: Implement refresh token for better UX (optional enhancement)
5. **CORS**: Properly configure for cross-origin requests

---

## 📚 Files Reference

| File | Purpose |
|------|---------|
| `server/middleware/auth.js` | Authentication middleware |
| `server/services/userService.js` | User service logic |
| `server/routes/auth.js` | Auth API endpoints |
| `client/src/components/Login.js` | Login UI |
| `client/src/components/Register.js` | Registration UI |
| `client/src/components/UserProfile.js` | Profile UI |
| `client/src/utils/authUtils.js` | Auth utilities |
| `client/src/api.js` | API client functions |

---

## 💡 Tips & Tricks

**Debugging Info**: Check localStorage for `authToken` and `user`
```javascript
console.log(localStorage.getItem('authToken'));
console.log(JSON.parse(localStorage.getItem('user')));
```

**Manual Token Check**: See token payload
```javascript
const token = localStorage.getItem('authToken');
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log(decoded);
```

**Force Logout**: Clear auth from browser console
```javascript
localStorage.removeItem('authToken');
localStorage.removeItem('user');
window.location.href = '/login';
```

---

**Last Updated**: March 10, 2026  
**Status**: Production Ready ✅

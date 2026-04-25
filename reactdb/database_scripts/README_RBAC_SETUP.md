# Role-Based Access Control (RBAC) Database Setup Guide

## Overview

This guide provides instructions for setting up the Role-Based Access Control (RBAC) system for the Property Management Application. The system includes role definitions, test users, and role-to-user mappings.

## Files Included

### 1. **00_comprehensive_rbac_setup.sql** (RECOMMENDED)
- **Purpose**: Complete setup in a single script
- **What it does**: Creates roles, test users, and role assignments
- **Usage**: Run this script first for basic setup
- **Execution time**: < 1 second

### 2. **01_role_definitions.sql**
- **Purpose**: Create system roles
- **What it does**: Inserts 7 standard roles into RoleDetail table
- **Roles created**:
  - `admin` - Full system access
  - `manager` - Executive level access
  - `accountant` - Financial management
  - `property_manager` - Property & occupancy management
  - `maintenance` - Maintenance operations
  - `utilities_manager` - Utilities & services management
  - `inventory_manager` - Stock & inventory management

### 3. **02_test_users.sql**
- **Purpose**: Create test user accounts
- **Users created**: 8 test users with login credentials
- **Note**: Passwords are plain text - use proper hashing in production

### 4. **03_user_role_assignments.sql**
- **Purpose**: Link users to roles
- **What it does**: Inserts user-role relationships into UserRole table
- **Dependencies**: Requires 01 and 02 to run first

### 5. **04_verification_and_utilities.sql**
- **Purpose**: Verify setup and provide reference queries
- **What it does**: Provides verification queries and permission reference
- **Helpful for**: Troubleshooting and understanding the role matrix

## Quick Start

### Option A: Fast Setup (Recommended)
```sql
-- Run single comprehensive setup script
sqlcmd -S <server> -d mansion -i database_scripts\00_comprehensive_rbac_setup.sql
```

Then verify:
```sql
-- Run verification
sqlcmd -S <server> -d mansion -i database_scripts\04_verification_and_utilities.sql
```

### Option B: Step-by-Step Setup
```sql
-- Step 1: Create roles
sqlcmd -S <server> -d mansion -i database_scripts\01_role_definitions.sql

-- Step 2: Create users
sqlcmd -S <server> -d mansion -i database_scripts\02_test_users.sql

-- Step 3: Assign roles
sqlcmd -S <server> -d mansion -i database_scripts\03_user_role_assignments.sql

-- Step 4: Verify
sqlcmd -S <server> -d mansion -i database_scripts\04_verification_and_utilities.sql
```

## Test Credentials

After setup, use these credentials to login and test:

| Username | Password | Full Name | Role | Access |
|----------|----------|-----------|------|--------|
| admin_user | admin123 | Admin User | admin | All screens |
| manager_user | manager123 | Manager User | manager | Management screens |
| accountant_user | accountant123 | Accountant User | accountant | Financial screens |
| property_mgr_user | property123 | Property Manager User | property_manager | Property screens |
| maintenance_user | maintenance123 | Maintenance User | maintenance | Diagnostic only |
| utilities_user | utilities123 | Utilities Manager User | utilities_manager | Utilities screens |
| inventory_user | inventory123 | Inventory Manager User | inventory_manager | Stock screens |
| standard_user | standard123 | Standard User | (none) | Public screens only |

## Screen Access Matrix

| Screen | Required Roles | Admin | Manager | Accountant | Prop.Mgr | Maint. | Utilities | Inventory |
|--------|---|---|---|---|---|---|---|---|
| Diagnostic | admin, manager, maintenance | ✓ | ✓ | | | ✓ | | |
| Dashboard | (public) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Complaints | admin, manager | ✓ | ✓ | | | | | |
| Payment Tracking | admin, manager, accountant | ✓ | ✓ | ✓ | | | | |
| EB Service Payments | admin, accountant, utilities_manager | ✓ | | ✓ | | | ✓ | |
| Transactions | admin, manager, accountant | ✓ | ✓ | ✓ | | | | |
| Tenant Management | admin, manager, property_manager | ✓ | ✓ | | ✓ | | | |
| Room Occupancy | admin, property_manager | ✓ | | | ✓ | | | |
| Occupancy Links | admin, property_manager | ✓ | | | ✓ | | | |
| Service Allocation | admin, property_manager, utilities_manager | ✓ | | | ✓ | | ✓ | |
| Daily Status | admin, manager, property_manager | ✓ | ✓ | | ✓ | | | |
| Rental Collection | admin, manager, accountant | ✓ | ✓ | ✓ | | | | |
| Stock Management | admin, inventory_manager | ✓ | | | | | | ✓ |
| Management | admin, inventory_manager | ✓ | | | | | | ✓ |
| User Management | admin | ✓ | | | | | | |
| Roles & Access | admin | ✓ | | | | | | |

## Database Schema

### RoleDetail Table
```sql
CREATE TABLE RoleDetail (
  Id INT PRIMARY KEY IDENTITY(1,1),
  roleName NVARCHAR(100),
  roleType NVARCHAR(100),
  createdDate DATETIME,
  updatedDate DATETIME
)
```

### UserRole Junction Table
```sql
CREATE TABLE UserRole (
  Id INT PRIMARY KEY IDENTITY(1,1),
  UserId INT,
  RoleId INT,
  createdDate DATETIME,
  updatedDate DATETIME,
  FOREIGN KEY (UserId) REFERENCES User(Id),
  FOREIGN KEY (RoleId) REFERENCES RoleDetail(Id)
)
```

### User Table (relevant fields)
```sql
CREATE TABLE User (
  Id INT PRIMARY KEY IDENTITY(1,1),
  username NVARCHAR(100),
  password NVARCHAR(100),      -- HASH in production!
  name NVARCHAR(200),
  createdDate DATETIME,
  updatedDate DATETIME,
  nextLoginDuration INT
)
```

## Verification Queries

### Check all roles exist
```sql
SELECT Id, roleName, roleType, createdDate 
FROM RoleDetail 
WHERE roleType = 'System'
ORDER BY Id;
```

### Check all test users exist
```sql
SELECT Id, username, name, createdDate 
FROM User 
WHERE username LIKE '%_user' OR username = 'standard_user'
ORDER BY Id;
```

### Check user-role assignments
```sql
SELECT 
  u.username,
  u.name,
  STRING_AGG(r.roleName, ', ') AS Roles
FROM User u
LEFT JOIN UserRole ur ON u.Id = ur.UserId
LEFT JOIN RoleDetail r ON ur.RoleId = r.Id
WHERE u.username LIKE '%_user' OR u.username = 'standard_user'
GROUP BY u.Id, u.username, u.name
ORDER BY u.username;
```

### Simulate login (what backend returns)
```sql
SELECT 
  u.Id,
  u.username,
  u.name,
  STRING_AGG(r.roleName, ',') AS roles
FROM User u
LEFT JOIN UserRole ur ON u.Id = ur.UserId
LEFT JOIN RoleDetail r ON ur.RoleId = r.Id
WHERE u.username = 'admin_user'
GROUP BY u.Id, u.username, u.name;
```

## Login Flow

1. User enters username and password in LoginScreen
2. Frontend calls `/api/auth/login` with credentials
3. Backend queries User table for matching username/password
4. Backend JOINs with UserRole and RoleDetail to get user's roles
5. Backend returns JWT containing:
   - userId (int)
   - username (string)
   - name (string)
   - roles (comma-separated string, e.g., "admin" or "manager,accountant")
6. Frontend stores JWT and parses roles into AuthContext
7. AuthContext provides hasRole() and hasAnyRole() methods for permission checks
8. ProtectedRoute components check permissions and show/hide screens

## Frontend Integration

### Using Roles in Components

```typescript
// In any component:
const { user, hasRole, hasAnyRole } = useAuth();

// Check single role
if (hasRole('admin')) {
  // Render admin-only content
}

// Check any of multiple roles
if (hasAnyRole(['accountant', 'manager'])) {
  // Render financial content
}

// Get user's roles
console.log(user?.roles); // "admin" or "manager,accountant"
```

### Role Protection in Routes

All screens are automatically wrapped with `ProtectedRoute` component:

```typescript
<ProtectedRoute requiredRoles={['admin', 'manager']} requireAll={false}>
  <PaymentTracking />
</ProtectedRoute>
```

- `requiredRoles`: Array of roles that grant access
- `requireAll`: If true, user must have ALL roles; if false, user needs ANY role

## Production Considerations

### Security Best Practices

1. **Hash Passwords**: Don't store plain text passwords
   ```csharp
   // In production backend:
   using BCrypt.Net;
   string hashedPassword = BCrypt.HashPassword(password);
   ```

2. **Use JWT Secrets**: Store JWT secret in environment variables
   ```javascript
   const token = jwt.sign(payload, process.env.JWT_SECRET);
   ```

3. **HTTPS Only**: All authentication should use HTTPS

4. **Token Expiration**: Set reasonable JWT expiration (24 hours currently)

5. **Secure Role Storage**: Don't expose role IDs in API responses

### Password Reset Instructions

1. Change test user passwords in production:
   ```sql
   UPDATE User 
   SET password = 'new_hashed_password'
   WHERE username = 'admin_user';
   ```

2. Force password reset on first login:
   ```sql
   UPDATE User 
   SET nextLoginDuration = -1  -- Requires password change
   WHERE Id > 0;
   ```

## Troubleshooting

### Issue: "Access Denied" on all screens

**Solution**: Verify role assignments exist:
```sql
SELECT ur.* FROM UserRole ur
WHERE ur.UserId = (SELECT Id FROM User WHERE username = 'admin_user');
```

If empty, run user role assignments script.

### Issue: Roles not showing in dropdown

**Solution**: Ensure roles table populated:
```sql
SELECT * FROM RoleDetail WHERE roleType = 'System';
```

If empty, run role definitions script.

### Issue: Login fails with valid credentials

**Solution**: Check user exists with exact password:
```sql
SELECT * FROM User WHERE username = 'admin_user' AND password = 'admin123';
```

Remember: Check case-sensitivity of username field.

### Issue: User has roles but screens still show "Access Denied"

**Solution**: Check JWT token in browser:
1. Open DevTools → Application → LocalStorage
2. Check `auth` key contains valid JWT
3. Decode JWT at jwt.io to verify roles field
4. Check browser console for errors

## Cleanup and Reset

### Remove all test data (careful!)

```sql
-- Delete user-role assignments
DELETE FROM UserRole 
WHERE UserId IN (SELECT Id FROM User WHERE username LIKE '%_user');

-- Delete test users
DELETE FROM User 
WHERE username LIKE '%_user' OR username = 'standard_user';

-- Delete system roles
DELETE FROM RoleDetail WHERE roleType = 'System';

-- Reseed identity
DBCC CHECKIDENT('[User]', RESEED, 0);
DBCC CHECKIDENT('[RoleDetail]', RESEED, 0);
DBCC CHECKIDENT('[UserRole]', RESEED, 0);
```

## Support

For issues or questions:
1. Check verification queries above
2. Review backend `/api/auth/login` endpoint in `backend/src/index.ts`
3. Review AuthContext in `frontend/src/context/AuthContext.tsx`
4. Review ProtectedRoute in `frontend/src/components/ProtectedRoute.tsx`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial RBAC setup with 7 roles and 8 test users |

---

**Generated**: 2024
**For**: Property Management Application
**Database**: MSSQL / Azure SQL

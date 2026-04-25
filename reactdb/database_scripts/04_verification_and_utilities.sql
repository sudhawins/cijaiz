-- =====================================================
-- Verification and Utilities Script
-- =====================================================
-- Purpose: Verify role setup and provide reference queries
-- Created: 2024
-- Description: Queries to validate tables and demonstrate access matrix

USE [mansion];
GO

-- =====================================================
-- SECTION 1: VERIFICATION QUERIES
-- =====================================================

PRINT '';
PRINT '===== VERIFICATION QUERIES =====';
PRINT '';

-- 1.1 Verify RoleDetail table
PRINT '1. RoleDetail Table (System Roles):';
PRINT REPLICATE('-', 60);
SELECT 
  Id,
  roleName,
  roleType,
  FORMAT(createdDate, 'yyyy-MM-dd HH:mm:ss') AS createdDate
FROM [dbo].[RoleDetail]
WHERE roleType = 'System'
ORDER BY Id;

-- 1.2 Verify User table
PRINT '';
PRINT '2. User Table (Test Users):';
PRINT REPLICATE('-', 60);
SELECT 
  Id,
  username,
  name,
  FORMAT(createdDate, 'yyyy-MM-dd HH:mm:ss') AS createdDate
FROM [dbo].[User]
WHERE username LIKE '%_user' OR username = 'standard_user'
ORDER BY Id;

-- 1.3 Verify UserRole junction table
PRINT '';
PRINT '3. UserRole Assignments:';
PRINT REPLICATE('-', 60);
SELECT 
  ur.Id,
  u.username,
  r.roleName,
  FORMAT(ur.createdDate, 'yyyy-MM-dd HH:mm:ss') AS createdDate
FROM [dbo].[UserRole] ur
INNER JOIN [dbo].[User] u ON ur.UserId = u.Id
INNER JOIN [dbo].[RoleDetail] r ON ur.RoleId = r.Id
WHERE u.username LIKE '%_user' OR u.username = 'standard_user'
ORDER BY u.username, r.roleName;

-- =====================================================
-- SECTION 2: ACCESS MATRIX VIEW
-- =====================================================

PRINT '';
PRINT '===== ACCESS MATRIX =====';
PRINT '';

SELECT 
  u.username,
  u.name,
  ISNULL(STRING_AGG(r.roleName, ', '), 'No Roles') AS AssignedRoles,
  COUNT(ur.RoleId) AS RoleCount
FROM [dbo].[User] u
LEFT JOIN [dbo].[UserRole] ur ON u.Id = ur.UserId
LEFT JOIN [dbo].[RoleDetail] r ON ur.RoleId = r.Id
WHERE u.username LIKE '%_user' OR u.username = 'standard_user'
GROUP BY u.Id, u.username, u.name
ORDER BY u.createdDate;

-- =====================================================
-- SECTION 3: LOGIN SIMULATION QUERIES
-- =====================================================
-- These queries simulate what the backend /api/auth/login endpoint returns

PRINT '';
PRINT '===== LOGIN SIMULATION (Backend Response) =====';
PRINT '';

-- Query that matches backend login endpoint logic
PRINT 'Sample: Login as admin_user with password admin123:';
PRINT REPLICATE('-', 60);

DECLARE @username NVARCHAR(100) = 'admin_user';
DECLARE @password NVARCHAR(100) = 'admin123';

SELECT 
  u.Id,
  u.username,
  u.name,
  STRING_AGG(r.roleName, ',') AS roles,
  'JWT Token would contain: userId=' + CAST(u.Id AS NVARCHAR(10)) 
    + ', username=' + u.username 
    + ', roles=' + ISNULL(STRING_AGG(r.roleName, ','), '') AS JwtPayload
FROM [dbo].[User] u
LEFT JOIN [dbo].[UserRole] ur ON u.Id = ur.UserId
LEFT JOIN [dbo].[RoleDetail] r ON ur.RoleId = r.Id
WHERE u.username = @username AND u.password = @password
GROUP BY u.Id, u.username, u.name;

-- =====================================================
-- SECTION 4: PERMISSION REFERENCE
-- =====================================================

PRINT '';
PRINT '===== SCREEN ACCESS REFERENCE =====';
PRINT '';

CREATE TABLE #ScreenRoles (
  ScreenName NVARCHAR(50),
  RequiredRoles NVARCHAR(200),
  Description NVARCHAR(500)
);

INSERT INTO #ScreenRoles VALUES
  ('Diagnostic', 'admin, manager, maintenance', 'System diagnostics and monitoring'),
  ('Payment Tracking', 'admin, manager, accountant', 'Track rental and service payments'),
  ('Tenant Management', 'admin, manager, property_manager', 'Manage tenant information'),
  ('Daily Status', 'admin, manager, property_manager', 'Daily status reports and updates'),
  ('Transaction Management', 'admin, manager, accountant', 'Track all transactions'),
  ('Complaints', 'admin, manager', 'Manage complaints and issues'),
  ('EB Service Payments', 'admin, accountant, utilities_manager', 'Electric bill service payments'),
  ('Rental Collection', 'admin, manager, accountant', 'Rental payment collection'),
  ('Occupancy Links', 'admin, property_manager', 'Room occupancy management'),
  ('Room Occupancy', 'admin, property_manager', 'View room occupancy status'),
  ('Service Allocation', 'admin, property_manager, utilities_manager', 'Service allocation management'),
  ('Stock Management', 'admin, inventory_manager', 'Inventory stock management'),
  ('User Management', 'admin', 'System user administration'),
  ('Roles & Access', 'admin', 'Role and permission management');

SELECT 
  ScreenName,
  RequiredRoles,
  Description
FROM #ScreenRoles
ORDER BY ScreenName;

DROP TABLE #ScreenRoles;

-- =====================================================
-- SECTION 5: TEST DATA COUNTS
-- =====================================================

PRINT '';
PRINT '===== SETUP SUMMARY =====';
PRINT '';

SELECT 
  'Total System Roles' AS MetricName,
  CAST(COUNT(*) AS NVARCHAR(10)) AS Value
FROM [dbo].[RoleDetail]
WHERE roleType = 'System'

UNION ALL

SELECT 
  'Total Test Users',
  CAST(COUNT(*) AS NVARCHAR(10))
FROM [dbo].[User]
WHERE username LIKE '%_user' OR username = 'standard_user'

UNION ALL

SELECT 
  'Total User-Role Assignments',
  CAST(COUNT(*) AS NVARCHAR(10))
FROM [dbo].[UserRole];

-- =====================================================
-- SECTION 6: TROUBLESHOOTING QUERIES
-- =====================================================

PRINT '';
PRINT '===== TROUBLESHOOTING QUERIES =====';
PRINT '';

-- Find users with no roles assigned
PRINT 'Users with No Roles Assigned:';
PRINT REPLICATE('-', 60);
SELECT 
  u.Id,
  u.username,
  u.name
FROM [dbo].[User] u
LEFT JOIN [dbo].[UserRole] ur ON u.Id = ur.UserId
WHERE ur.RoleId IS NULL
AND (u.username LIKE '%_user' OR u.username = 'standard_user');

-- Find roles with no users assigned (for admin roles)
PRINT '';
PRINT 'Roles with No Users Assigned:';
PRINT REPLICATE('-', 60);
SELECT 
  r.Id,
  r.roleName,
  r.roleType
FROM [dbo].[RoleDetail] r
LEFT JOIN [dbo].[UserRole] ur ON r.Id = ur.RoleId
WHERE ur.UserId IS NULL
AND r.roleType = 'System';

PRINT '';
PRINT '===== VERIFICATION COMPLETE =====';

GO

-- =====================================================
-- SECTION 7: CLEANUP PROCEDURES (OPTIONAL)
-- =====================================================
-- Use these if you need to reset or clean up test data

/*
-- To remove all test user role assignments:
DELETE FROM [dbo].[UserRole] 
WHERE UserId IN (SELECT Id FROM [dbo].[User] WHERE username LIKE '%_user' OR username = 'standard_user');

-- To remove all test users:
DELETE FROM [dbo].[User] 
WHERE username LIKE '%_user' OR username = 'standard_user';

-- To remove all system roles:
DELETE FROM [dbo].[RoleDetail] 
WHERE roleType = 'System';

-- Reseed identity if needed:
DBCC CHECKIDENT('[dbo].[User]', RESEED, 0);
DBCC CHECKIDENT('[dbo].[RoleDetail]', RESEED, 0);
DBCC CHECKIDENT('[dbo].[UserRole]', RESEED, 0);
*/

GO

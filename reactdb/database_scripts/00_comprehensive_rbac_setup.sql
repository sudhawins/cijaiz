-- =====================================================
-- COMPREHENSIVE RBAC SETUP SCRIPT
-- =====================================================
-- Purpose: Complete Role-Based Access Control System Setup
-- Created: 2024
-- Description: Creates roles, test users, and role assignments in one script
--
-- EXECUTION ORDER:
-- 1. Run this script against the mansion database
-- 2. Run 04_verification_and_utilities.sql to verify setup
-- 3. Test login with provided credentials
--
-- IMPORTANT: 
-- - Change passwords in production
-- - Use proper password hashing (bcrypt/PBKDF2)
-- - This is for development/testing only

USE [mansion];
GO

PRINT '';
PRINT '===== COMPREHENSIVE RBAC SETUP STARTED =====';
PRINT '';

-- =====================================================
-- STEP 1: CREATE ROLES
-- =====================================================

PRINT 'STEP 1: Creating system roles...';
PRINT REPLICATE('-', 60);

INSERT INTO [dbo].[RoleDetail] (roleName, roleType, createdDate, updatedDate)
VALUES 
  ('admin', 'System', GETDATE(), GETDATE()),
  ('manager', 'System', GETDATE(), GETDATE()),
  ('accountant', 'System', GETDATE(), GETDATE()),
  ('property_manager', 'System', GETDATE(), GETDATE()),
  ('maintenance', 'System', GETDATE(), GETDATE()),
  ('utilities_manager', 'System', GETDATE(), GETDATE()),
  ('inventory_manager', 'System', GETDATE(), GETDATE());

SELECT 'Created ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' roles' AS Status;

-- =====================================================
-- STEP 2: CREATE TEST USERS
-- =====================================================

PRINT '';
PRINT 'STEP 2: Creating test users...';
PRINT REPLICATE('-', 60);

INSERT INTO [dbo].[User] (username, password, name, createdDate, updatedDate, nextLoginDuration)
VALUES 
  ('admin_user', 'admin123', 'Admin User', GETDATE(), GETDATE(), 24),
  ('manager_user', 'manager123', 'Manager User', GETDATE(), GETDATE(), 24),
  ('accountant_user', 'accountant123', 'Accountant User', GETDATE(), GETDATE(), 24),
  ('property_mgr_user', 'property123', 'Property Manager User', GETDATE(), GETDATE(), 24),
  ('maintenance_user', 'maintenance123', 'Maintenance User', GETDATE(), GETDATE(), 24),
  ('utilities_user', 'utilities123', 'Utilities Manager User', GETDATE(), GETDATE(), 24),
  ('inventory_user', 'inventory123', 'Inventory Manager User', GETDATE(), GETDATE(), 24),
  ('standard_user', 'standard123', 'Standard User', GETDATE(), GETDATE(), 24);

SELECT 'Created ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' test users' AS Status;

-- =====================================================
-- STEP 3: ASSIGN ROLES TO USERS
-- =====================================================

PRINT '';
PRINT 'STEP 3: Assigning roles to users...';
PRINT REPLICATE('-', 60);

-- Get user and role IDs
DECLARE @adminUserId INT, @managerUserId INT, @accountantUserId INT,
        @propertyMgrUserId INT, @maintenanceUserId INT, @utilitiesUserId INT,
        @inventoryUserId INT;

DECLARE @adminRoleId INT, @managerRoleId INT, @accountantRoleId INT,
        @propertyMgrRoleId INT, @maintenanceRoleId INT, @utilitiesRoleId INT,
        @inventoryRoleId INT;

SELECT @adminUserId = Id FROM [dbo].[User] WHERE username = 'admin_user';
SELECT @managerUserId = Id FROM [dbo].[User] WHERE username = 'manager_user';
SELECT @accountantUserId = Id FROM [dbo].[User] WHERE username = 'accountant_user';
SELECT @propertyMgrUserId = Id FROM [dbo].[User] WHERE username = 'property_mgr_user';
SELECT @maintenanceUserId = Id FROM [dbo].[User] WHERE username = 'maintenance_user';
SELECT @utilitiesUserId = Id FROM [dbo].[User] WHERE username = 'utilities_user';
SELECT @inventoryUserId = Id FROM [dbo].[User] WHERE username = 'inventory_user';

SELECT @adminRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'admin';
SELECT @managerRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'manager';
SELECT @accountantRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'accountant';
SELECT @propertyMgrRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'property_manager';
SELECT @maintenanceRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'maintenance';
SELECT @utilitiesRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'utilities_manager';
SELECT @inventoryRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'inventory_manager';

-- Insert role assignments
INSERT INTO [dbo].[UserRole] (UserId, RoleId, createdDate, updatedDate)
VALUES 
  (@adminUserId, @adminRoleId, GETDATE(), GETDATE()),
  (@managerUserId, @managerRoleId, GETDATE(), GETDATE()),
  (@accountantUserId, @accountantRoleId, GETDATE(), GETDATE()),
  (@propertyMgrUserId, @propertyMgrRoleId, GETDATE(), GETDATE()),
  (@maintenanceUserId, @maintenanceRoleId, GETDATE(), GETDATE()),
  (@utilitiesUserId, @utilitiesRoleId, GETDATE(), GETDATE()),
  (@inventoryUserId, @inventoryRoleId, GETDATE(), GETDATE());

SELECT 'Assigned ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' user-role relationships' AS Status;

-- =====================================================
-- STEP 4: DISPLAY SUMMARY
-- =====================================================

PRINT '';
PRINT '===== SETUP SUMMARY =====';
PRINT '';

PRINT 'Available Test Accounts:';
PRINT REPLICATE('-', 60);
SELECT 
  ROW_NUMBER() OVER (ORDER BY u.Id) AS 'No',
  u.username AS 'Username',
  'Password' = CASE u.username 
    WHEN 'admin_user' THEN 'admin123'
    WHEN 'manager_user' THEN 'manager123'
    WHEN 'accountant_user' THEN 'accountant123'
    WHEN 'property_mgr_user' THEN 'property123'
    WHEN 'maintenance_user' THEN 'maintenance123'
    WHEN 'utilities_user' THEN 'utilities123'
    WHEN 'inventory_user' THEN 'inventory123'
    ELSE 'standard123'
  END,
  u.name AS 'Full Name',
  ISNULL(STRING_AGG(r.roleName, ', '), 'No Roles') AS 'Assigned Roles'
FROM [dbo].[User] u
LEFT JOIN [dbo].[UserRole] ur ON u.Id = ur.UserId
LEFT JOIN [dbo].[RoleDetail] r ON ur.RoleId = r.Id
WHERE u.username LIKE '%_user' OR u.username = 'standard_user'
GROUP BY u.Id, u.username, u.name
ORDER BY u.Id;

PRINT '';
PRINT 'Setup Statistics:';
PRINT REPLICATE('-', 60);

SELECT 
  (SELECT COUNT(*) FROM [dbo].[RoleDetail] WHERE roleType = 'System') AS TotalRoles,
  (SELECT COUNT(*) FROM [dbo].[User] WHERE username LIKE '%_user' OR username = 'standard_user') AS TotalTestUsers,
  (SELECT COUNT(*) FROM [dbo].[UserRole]) AS TotalAssignments;

PRINT '';
PRINT '===== COMPREHENSIVE RBAC SETUP COMPLETED SUCCESSFULLY =====';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Run 04_verification_and_utilities.sql to verify the setup';
PRINT '2. Start the application and test login with credentials above';
PRINT '3. Verify role-based access control on each screen';
PRINT '';

GO

-- =====================================================
-- VERIFICATION: Display what backend login will return
-- =====================================================

PRINT 'Backend Login Response Examples:';
PRINT REPLICATE('=', 60);
PRINT '';

SELECT 
  u.Id,
  u.username,
  u.name,
  STRING_AGG(r.roleName, ',') AS roles,
  'Login: ' + u.username + ' / Entry password' AS Instruction
FROM [dbo].[User] u
LEFT JOIN [dbo].[UserRole] ur ON u.Id = ur.UserId
LEFT JOIN [dbo].[RoleDetail] r ON ur.RoleId = r.Id
WHERE u.username IN ('admin_user', 'manager_user', 'accountant_user', 'property_mgr_user')
GROUP BY u.Id, u.username, u.name
ORDER BY u.Id;

PRINT '';
PRINT 'Roles will be returned as comma-separated values in JWT token';
PRINT 'Example: "admin" or "manager,accountant" for multiple roles';
PRINT '';

GO

-- =====================================================
-- User Role Assignments Setup Script
-- =====================================================
-- Purpose: Assign roles to test users
-- Created: 2024
-- Description: Links users to roles via the UserRole junction table
-- Dependencies: Run 01_role_definitions.sql and 02_test_users.sql first

USE [mansion];
GO

-- Get user IDs and role IDs for assignment
DECLARE @adminUserId INT, @managerUserId INT, @accountantUserId INT,
        @propertyMgrUserId INT, @maintenanceUserId INT, @utilitiesUserId INT,
        @inventoryUserId INT, @standardUserId INT;

DECLARE @adminRoleId INT, @managerRoleId INT, @accountantRoleId INT,
        @propertyMgrRoleId INT, @maintenanceRoleId INT, @utilitiesRoleId INT,
        @inventoryRoleId INT;

-- Get user IDs
SELECT @adminUserId = Id FROM [dbo].[User] WHERE username = 'admin_user';
SELECT @managerUserId = Id FROM [dbo].[User] WHERE username = 'manager_user';
SELECT @accountantUserId = Id FROM [dbo].[User] WHERE username = 'accountant_user';
SELECT @propertyMgrUserId = Id FROM [dbo].[User] WHERE username = 'property_mgr_user';
SELECT @maintenanceUserId = Id FROM [dbo].[User] WHERE username = 'maintenance_user';
SELECT @utilitiesUserId = Id FROM [dbo].[User] WHERE username = 'utilities_user';
SELECT @inventoryUserId = Id FROM [dbo].[User] WHERE username = 'inventory_user';
SELECT @standardUserId = Id FROM [dbo].[User] WHERE username = 'standard_user';

-- Get role IDs
SELECT @adminRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'admin';
SELECT @managerRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'manager';
SELECT @accountantRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'accountant';
SELECT @propertyMgrRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'property_manager';
SELECT @maintenanceRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'maintenance';
SELECT @utilitiesRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'utilities_manager';
SELECT @inventoryRoleId = Id FROM [dbo].[RoleDetail] WHERE roleName = 'inventory_manager';

-- Log the IDs for verification
PRINT 'User IDs:';
PRINT CONCAT('  admin_user: ', @adminUserId);
PRINT CONCAT('  manager_user: ', @managerUserId);
PRINT CONCAT('  accountant_user: ', @accountantUserId);
PRINT CONCAT('  property_mgr_user: ', @propertyMgrUserId);
PRINT CONCAT('  maintenance_user: ', @maintenanceUserId);
PRINT CONCAT('  utilities_user: ', @utilitiesUserId);
PRINT CONCAT('  inventory_user: ', @inventoryUserId);
PRINT CONCAT('  standard_user: ', @standardUserId);

PRINT 'Role IDs:';
PRINT CONCAT('  admin: ', @adminRoleId);
PRINT CONCAT('  manager: ', @managerRoleId);
PRINT CONCAT('  accountant: ', @accountantRoleId);
PRINT CONCAT('  property_manager: ', @propertyMgrRoleId);
PRINT CONCAT('  maintenance: ', @maintenanceRoleId);
PRINT CONCAT('  utilities_manager: ', @utilitiesRoleId);
PRINT CONCAT('  inventory_manager: ', @inventoryRoleId);

-- Clean up existing test role assignments (optional)
-- DELETE FROM [dbo].[UserRole] 
-- WHERE UserId IN (SELECT Id FROM [dbo].[User] WHERE username LIKE '%_user' OR username = 'standard_user');
-- GO

-- =====================================================
-- Assign Roles to Users
-- =====================================================

-- 1. Admin User: Full access to all roles (or just admin role)
--    Based on SCREEN_ROLES in App.tsx, admin can access: diagnostic, payment, tenants, 
--    daily_status, management, transactions, complaints, payments, utilities_management,
--    rental_collection, occupancy_links, occupancy, service_allocation, stock, userManagement
INSERT INTO [dbo].[UserRole] (UserId, RoleId, createdDate, updatedDate)
VALUES 
  (@adminUserId, @adminRoleId, GETDATE(), GETDATE());

-- 2. Manager User: Manager role (executive level)
--    Access: payment, daily_status, diagnostic, transactions, tenants
INSERT INTO [dbo].[UserRole] (UserId, RoleId, createdDate, updatedDate)
VALUES 
  (@managerUserId, @managerRoleId, GETDATE(), GETDATE());

-- 3. Accountant User: Accountant role
--    Access: payment, payments, transactions
INSERT INTO [dbo].[UserRole] (UserId, RoleId, createdDate, updatedDate)
VALUES 
  (@accountantUserId, @accountantRoleId, GETDATE(), GETDATE());

-- 4. Property Manager User: Property manager role
--    Access: tenants, occupancy, occupancy_links, service_allocation, daily_status
INSERT INTO [dbo].[UserRole] (UserId, RoleId, createdDate, updatedDate)
VALUES 
  (@propertyMgrUserId, @propertyMgrRoleId, GETDATE(), GETDATE());

-- 5. Maintenance User: Maintenance role
--    Access: diagnostic
INSERT INTO [dbo].[UserRole] (UserId, RoleId, createdDate, updatedDate)
VALUES 
  (@maintenanceUserId, @maintenanceRoleId, GETDATE(), GETDATE());

-- 6. Utilities Manager User: Utilities manager role
--    Access: utilities_management, payments
INSERT INTO [dbo].[UserRole] (UserId, RoleId, createdDate, updatedDate)
VALUES 
  (@utilitiesUserId, @utilitiesRoleId, GETDATE(), GETDATE());

-- 7. Inventory Manager User: Inventory manager role
--    Access: stock, management
INSERT INTO [dbo].[UserRole] (UserId, RoleId, createdDate, updatedDate)
VALUES 
  (@inventoryUserId, @inventoryRoleId, GETDATE(), GETDATE());

-- 8. Standard User: Limited roles (diagnostic, dash, complaints)
--    Not assigned any specific roles - will see limited screens

-- Verify the assignments
PRINT '';
PRINT '=== User Role Assignments ===';
SELECT 
  u.username,
  u.name,
  STRING_AGG(r.roleName, ', ') AS Roles,
  COUNT(*) AS RoleCount
FROM [dbo].[User] u
LEFT JOIN [dbo].[UserRole] ur ON u.Id = ur.UserId
LEFT JOIN [dbo].[RoleDetail] r ON ur.RoleId = r.Id
WHERE u.username LIKE '%_user' OR u.username = 'standard_user'
GROUP BY u.Id, u.username, u.name
ORDER BY u.createdDate;

-- =====================================================
-- Permission Matrix (Reference)
-- =====================================================
-- The following shows access matrix based on role assignments:

-- admin_user (admin):
--   - All screens accessible

-- manager_user (manager):
--   - Payment Tracking, Daily Status, Diagnostic, Transactions, Tenant Management

-- accountant_user (accountant):
--   - Payment Tracking, Payments, Transactions

-- property_mgr_user (property_manager):
--   - Tenant Management, Room Occupancy, Occupancy Links, Service Allocation, Daily Status

-- maintenance_user (maintenance):
--   - Diagnostic

-- utilities_user (utilities_manager):
--   - Utilities Management, Payments

-- inventory_user (inventory_manager):
--   - Stock Management, Management

-- standard_user (no roles):
--   - Limited to public screens only (Diagnostic, Dashboard, Complaints)

GO

-- =====================================================
-- Testing: Get User with Roles
-- =====================================================
-- This query simulates what the backend login endpoint returns:

PRINT '';
PRINT '=== Sample Login Query Result (What Backend Returns) ===';
SELECT 
  u.Id,
  u.username,
  u.name,
  STRING_AGG(r.roleName, ',') AS roles  -- Comma-separated roles for JWT
FROM [dbo].[User] u
LEFT JOIN [dbo].[UserRole] ur ON u.Id = ur.UserId
LEFT JOIN [dbo].[RoleDetail] r ON ur.RoleId = r.Id
WHERE u.username IN ('admin_user', 'manager_user', 'accountant_user')
GROUP BY u.Id, u.username, u.name;

GO

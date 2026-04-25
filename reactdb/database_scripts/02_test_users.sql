-- =====================================================
-- Test Users Setup Script
-- =====================================================
-- Purpose: Create test users for system development and testing
-- Created: 2024
-- Description: Populates the User table with test accounts for various role types
-- Note: In production, use proper password hashing (bcrypt/PBKDF2)

USE [mansion];
GO

-- Clean up existing test users (optional - comment out to preserve existing users)
-- DELETE FROM [dbo].[User] WHERE username LIKE '%_user' OR username LIKE 'test_%';
-- GO

-- Insert test users
-- Note: Passwords are plain text in this example. Production systems should hash passwords.
-- Format: username | password | name | notes
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

-- Verify the inserts
SELECT 
  Id,
  username,
  name,
  createdDate,
  updatedDate,
  nextLoginDuration
FROM [dbo].[User]
WHERE username LIKE '%_user' OR username = 'standard_user'
ORDER BY createdDate;

-- =====================================================
-- User Credentials Reference (Keep Secure)
-- =====================================================
/*
Test Login Credentials:

1. admin_user / admin123
   - Full system access to all features and screens
   
2. manager_user / manager123
   - Executive level access
   - Can view most reports and manage operations
   
3. accountant_user / accountant123
   - Financial management
   - Payment and transaction tracking
   
4. property_mgr_user / property123
   - Property and occupancy management
   - Room and tenant management
   
5. maintenance_user / maintenance123
   - Maintenance operations
   - Limited diagnostic and request access
   
6. utilities_user / utilities123
   - Utilities and services management
   - EB service payments and allocations
   
7. inventory_user / inventory123
   - Stock and inventory management
   - Inventory tracking and management
   
8. standard_user / standard123
   - Limited access
   - Basic screens only (diagnostic, dash, complaints)
*/

GO

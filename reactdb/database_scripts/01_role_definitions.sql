-- =====================================================
-- Role Definitions Setup Script
-- =====================================================
-- Purpose: Create standard roles for the property management system
-- Created: 2024
-- Description: Populates the RoleDetail table with predefined system roles

USE [mansion];
GO

-- Clean up existing roles (optional - comment out if you want to preserve existing data)
-- DELETE FROM [dbo].[RoleDetail] WHERE roleType = 'System';
-- GO

-- Insert standard system roles
INSERT INTO [dbo].[RoleDetail] (roleName, roleType, createdDate, updatedDate)
VALUES 
  ('admin', 'System', GETDATE(), GETDATE()),
  ('manager', 'System', GETDATE(), GETDATE()),
  ('accountant', 'System', GETDATE(), GETDATE()),
  ('property_manager', 'System', GETDATE(), GETDATE()),
  ('maintenance', 'System', GETDATE(), GETDATE()),
  ('utilities_manager', 'System', GETDATE(), GETDATE()),
  ('inventory_manager', 'System', GETDATE(), GETDATE());

-- Verify the inserts
SELECT Id, roleName, roleType, createdDate, updatedDate 
FROM [dbo].[RoleDetail] 
WHERE roleType = 'System'
ORDER BY createdDate;

-- =====================================================
-- Role Descriptions (Reference - for documentation)
-- =====================================================
/*
Role Definitions:

1. admin
   - Full system access
   - Can access all screens and management features
   - Access: All diagnostic, management, tracking, and configuration screens

2. manager
   - Executive level access
   - Can manage most operations and view reports
   - Access: Payment tracking, daily status, diagnostic, transactions, tenant management

3. accountant
   - Financial management focused
   - Can track payments, transactions, and financial reports
   - Access: Payment tracking, EB service payments, transaction management

4. property_manager
   - Property and occupancy management
   - Can manage rooms, tenants, and occupancies
   - Access: Room occupancy, occupancy links, tenant management, service allocation

5. maintenance
   - Maintenance operations focused
   - Can manage maintenance requests and schedule
   - Access: Diagnostic, maintenance requests (limited)

6. utilities_manager
   - Utilities and services management
   - Can manage service allocations and utility billing
   - Access: EB service payments, service allocation, utilities tracking

7. inventory_manager
   - Stock and inventory management focused
   - Can manage stock levels and inventory
   - Access: Stock management, inventory tracking
*/

GO

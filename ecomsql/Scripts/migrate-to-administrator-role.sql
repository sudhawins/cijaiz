-- Migration: Update RoleDetail table from 'Admin' to 'Administrator'

-- Check current roles
SELECT Id, RoleName, RoleType FROM RoleDetail ORDER BY Id;

-- Update 'Admin' role type to 'Administrator'
UPDATE RoleDetail 
SET RoleType = 'Administrator' 
WHERE RoleType = 'Admin';

-- Verify the update
SELECT Id, RoleName, RoleType FROM RoleDetail ORDER BY Id;

-- Create admin user if not exists
IF NOT EXISTS (SELECT 1 FROM [User] WHERE UserName = 'admin')
BEGIN
  INSERT INTO [User] (UserName, Password, Name, CreatedDate)
  VALUES ('admin', 'password', 'Administrator', GETDATE());
  
  -- Get the newly created user ID
  DECLARE @AdminUserId INT = (SELECT IDENT_CURRENT('[User]'));
  
  -- Get the Administrator role ID
  DECLARE @AdminRoleId INT = (SELECT Id FROM RoleDetail WHERE RoleType = 'Administrator');
  
  -- Assign Administrator role
  INSERT INTO UserRole (UserId, RoleId, CreatedDate)
  VALUES (@AdminUserId, @AdminRoleId, GETDATE());
  
  PRINT 'Admin user created with Administrator role';
END
ELSE
BEGIN
  PRINT 'Admin user already exists';
END

-- Verify admin user
SELECT u.Id, u.UserName, u.Name, rd.RoleType, rd.RoleName
FROM [User] u
LEFT JOIN UserRole ur ON u.Id = ur.UserId
LEFT JOIN RoleDetail rd ON ur.RoleId = rd.Id
WHERE u.UserName = 'admin';

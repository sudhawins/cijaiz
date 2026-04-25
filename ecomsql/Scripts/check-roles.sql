-- Check what roles exist in the database
SELECT 'RoleDetail Table' as Info, Id, RoleName, RoleType FROM RoleDetail ORDER BY Id;

-- Check what roles users have
SELECT 'User Roles' as Info, u.Id, u.UserName, u.Name, rd.RoleType, rd.RoleName
FROM [User] u
LEFT JOIN UserRole ur ON u.Id = ur.UserId
LEFT JOIN RoleDetail rd ON ur.RoleId = rd.Id
ORDER BY u.CreatedDate DESC;

-- Specifically check for seller role
SELECT 'Seller Role Check' as Info, * FROM RoleDetail WHERE RoleType LIKE '%ell%' OR RoleName LIKE '%ell%';

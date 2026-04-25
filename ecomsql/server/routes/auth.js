const express = require('express');
const { body, validationResult } = require('express-validator');
const userService = require('../services/userService');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Register endpoint
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').optional(),
  body('name').notEmpty().trim(),
  body('phoneNumber').notEmpty().trim(),
  body('shippingAddress').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Support both 'email' and 'userName' for backwards compatibility
    const email = req.body.email || req.body.userName;
    const { password, name, phoneNumber, shippingAddress } = req.body;

    if (!phoneNumber || !phoneNumber.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Always register as Customer role
    const user = await userService.registerUser(email, password, name, 'Customer', phoneNumber, shippingAddress);

    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    if (error.message === 'User already exists' || error.message === 'Email already registered') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
router.post('/login', [
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
  body('userName').optional({ checkFalsy: true }).trim(),
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.userName) {
      throw new Error('Email is required');
    }
    return true;
  }),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Support both 'email' and 'userName' for backwards compatibility
    const email = req.body.email
      ? req.body.email.trim().toLowerCase()
      : req.body.userName.trim();
    const { password } = req.body;
    
    console.log('[AUTH ROUTE] Login attempt for email:', email);

    const result = await userService.loginUser(email, password);
    console.log('[AUTH ROUTE] Login successful, returning response');

    res.json(result);
  } catch (error) {
    console.error('[AUTH ROUTE] Login error:', error.message);
    console.error('[AUTH ROUTE] Full error:', error);
    
    if (error.message === 'Invalid username or password' || error.message === 'Invalid email or password') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Get current user profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.userId);
    
    res.json({
      id: user.Id,
      userName: user.UserName,
      email: user.UserName,  // Email is stored in UserName field
      name: user.Name,
      phoneNumber: user.PhoneNumber,
      shippingAddress: user.ShippingAddress,
      role: user.RoleName,
      roleType: user.RoleType,
      createdDate: user.CreatedDate,
      lastLogin: user.LastLogin
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update current user profile
router.put('/me', verifyToken, [
  body('phoneNumber').optional().trim(),
  body('shippingAddress').optional().trim(),
  body('currentPassword').optional().trim(),
  body('newPassword').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phoneNumber, shippingAddress, currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    if (currentPassword || newPassword) {
      return res.status(400).json({
        error: 'Password is managed automatically from phone number. Update phone number to change password.'
      });
    }

    // Update profile; if phone number changes, password is updated to match phone in service layer.
    const updatedUser = await userService.updateUserProfile(userId, phoneNumber, shippingAddress);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.Id,
        userName: updatedUser.UserName,
        email: updatedUser.UserName,
        name: updatedUser.Name,
        phoneNumber: updatedUser.PhoneNumber,
        shippingAddress: updatedUser.ShippingAddress,
        createdDate: updatedUser.CreatedDate,
        lastLogin: updatedUser.LastLogin
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get all roles (Admin only)
router.get('/roles', verifyToken, isAdmin, async (req, res) => {
  try {
    const roles = await userService.getAllRoles();
    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

// Update user role (Admin only)
router.put('/users/:userId/role', verifyToken, isAdmin, [
  body('roleId').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { roleId } = req.body;

    const result = await userService.updateUserRole(parseInt(userId), roleId);

    res.json({
      message: 'User role updated successfully',
      result
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Reset user password (Admin only)
router.put('/users/:userId/reset-password', verifyToken, isAdmin, [
  body('newPassword').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;

    const result = await userService.resetUserPassword(parseInt(userId));

    res.json({
      message: 'User password reset to phone number successfully',
      user: result
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset user password' });
  }
});

// Get all users with their roles (Admin only)
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({
      totalUsers: users.length,
      users: users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Get user by ID with role info (Admin only or own profile)
router.get('/users/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.roleType;
    
    // Allow access if admin or if requesting own profile
    if (requestingUserRole !== 'Administrator' && parseInt(userId) !== requestingUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await userService.getUserById(parseInt(userId));
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Debug endpoint to check database users (remove in production)
router.get('/debug/users', async (req, res) => {
  try {
    const { getConnection, sql } = require('../config');
    const pool = await getConnection();
    
    const result = await pool.request().query(`
      SELECT u.Id, u.UserName, u.Name, u.CreatedDate, 
             rd.RoleType, rd.RoleName
      FROM [User] u
      LEFT JOIN UserRole ur ON u.Id = ur.UserId
      LEFT JOIN RoleDetail rd ON ur.RoleId = rd.Id
      ORDER BY u.CreatedDate DESC
    `);
    
    res.json({
      totalUsers: result.recordset.length,
      users: result.recordset
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch debug info', details: error.message });
  }
});

// Debug endpoint to check roles
router.get('/debug/roles', async (req, res) => {
  try {
    const { getConnection, sql } = require('../config');
    const pool = await getConnection();
    
    const result = await pool.request().query(`
      SELECT * FROM RoleDetail ORDER BY RoleType
    `);
    
    res.json({
      totalRoles: result.recordset.length,
      roles: result.recordset
    });
  } catch (error) {
    console.error('Debug roles endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch roles', details: error.message });
  }
});

// Assign role to user (Admin only)
router.post('/assign-role', verifyToken, async (req, res) => {
  try {
    const { userId, roleType } = req.body;
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.roleType;
    
    // Check if requesting user is admin
    if (requestingUserRole !== 'Administrator') {
      return res.status(403).json({ error: 'Only administrators can assign roles' });
    }

    if (!userId || !roleType) {
      return res.status(400).json({ error: 'userId and roleType are required' });
    }

    const { getConnection, sql } = require('../config');
    const pool = await getConnection();
    
    console.log(`[ASSIGN-ROLE] Admin ${requestingUserId} assigning role '${roleType}' to user ${userId}`);
    
    // Get the role ID
    const roleResult = await pool.request()
      .input('roleType', sql.NVarChar, roleType)
      .query('SELECT Id FROM RoleDetail WHERE RoleType = @roleType');

    if (roleResult.recordset.length === 0) {
      return res.status(400).json({ error: `Role '${roleType}' does not exist` });
    }

    const roleId = roleResult.recordset[0].Id;

    // Check if user already has this role
    const existingRole = await pool.request()
      .input('userId', sql.Int, userId)
      .input('roleId', sql.Int, roleId)
      .query('SELECT id FROM UserRole WHERE UserId = @userId AND RoleId = @roleId');

    if (existingRole.recordset.length > 0) {
      return res.status(400).json({ error: 'User already has this role' });
    }

    // Remove previous roles and assign new one
    await pool.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM UserRole WHERE UserId = @userId');

    // Assign new role
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('roleId', sql.Int, roleId)
      .input('createdDate', sql.DateTime2, new Date())
      .query(`
        INSERT INTO UserRole (UserId, RoleId, CreatedDate)
        VALUES (@userId, @roleId, @createdDate)
      `);

    console.log(`[ASSIGN-ROLE] Role '${roleType}' assigned to user ${userId}`);
    res.json({ message: `User ${userId} assigned role '${roleType}' successfully` });
  } catch (error) {
    console.error('[ASSIGN-ROLE] Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role', details: error.message });
  }
});

module.exports = router;

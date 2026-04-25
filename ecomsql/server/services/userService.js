const { getConnection, sql } = require('../config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Hash password for display purposes (consistent one-way hash)
function hashPasswordForDisplay(password) {
  if (!password) return 'N/A';
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Hash password
async function hashPassword(password) {
  try {
    console.log('[HASH] Starting password hash for password length:', password?.length);
    const salt = await bcrypt.genSalt(10);
    console.log('[HASH] Salt generated:', salt);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('[HASH] Password hashed successfully');
    console.log('[HASH] Original password length:', password?.length);
    console.log('[HASH] Hashed password length:', hashedPassword?.length);
    console.log('[HASH] Hashed password:', hashedPassword);
    return hashedPassword;
  } catch (error) {
    console.error('[HASH] Error during hashing:', error);
    throw error;
  }
}

// Compare password
async function comparePassword(password, hashedPassword) {
  console.log('[COMPARE] Password length:', password?.length, 'characters');
  console.log('[COMPARE] Hash length:', hashedPassword?.length, 'characters');
  console.log('[COMPARE] Comparing password:', password, 'with hash:', hashedPassword);
  
  // Check if the stored password looks like a bcrypt hash
  const isBcryptHash = hashedPassword && (hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$'));
  console.log('[COMPARE] Is bcrypt hash?:', isBcryptHash);
  
  let isMatch;
  
  if (isBcryptHash) {
    // Use bcrypt for hashed passwords
    console.log('[COMPARE] Using bcrypt.compare() for hashed password');
    isMatch = await bcrypt.compare(password, hashedPassword);
  } else {
    // Fallback: simple string comparison for plain text passwords (temporary workaround)
    console.warn('[COMPARE] WARNING: Plain text password detected in database!');
    console.warn('[COMPARE] Using plain text comparison (NOT SECURE - for testing only)');
    isMatch = password === hashedPassword;
  }
  
  console.log('[COMPARE] Password match result:', isMatch);
  return isMatch;
}

// Generate JWT token
function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  
  if (!process.env.JWT_SECRET) {
    console.warn('[generateToken] WARNING: JWT_SECRET not set in environment, using fallback');
  }
  
  const token = jwt.sign(
    {
      userId: user.Id,
      userName: user.UserName,
      name: user.Name,
      roleType: user.RoleType,
      roleId: user.RoleId
    },
    secret,
    { expiresIn: '24h' }
  );
  return token;
}

// Register a new user using email
async function registerUser(email, password, name, roleType, phoneNumber = null, shippingAddress = null) {
  try {
    const pool = await getConnection();
    console.log('[REGISTER] Starting registration for email:', email);
    console.log('[REGISTER] Requested role:', roleType);
    const normalizedPhone = (phoneNumber || '').trim();

    if (!normalizedPhone) {
      throw new Error('Phone number is required');
    }
    
    // Check if user already exists (email stored in UserName field)
    const existingUser = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM [User] WHERE UserName = @email');

    if (existingUser.recordset.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash password
    console.log('[REGISTER] Hashing password...');
    // Password policy: password is always the user's phone number.
    const hashedPassword = await hashPassword(normalizedPhone);
    console.log('[REGISTER] Password hashed successfully. Length:', hashedPassword?.length);

    // Insert new user with email as UserName
    const result = await pool.request()
      .input('email', sql.NVarChar, email)      // Email stored in UserName field
      .input('password', sql.NVarChar, hashedPassword)
      .input('name', sql.NVarChar, name)
      .input('phoneNumber', sql.NVarChar, normalizedPhone)
      .input('shippingAddress', sql.NVarChar, shippingAddress)
      .input('createdDate', sql.DateTime2, new Date())
      .query(`
        INSERT INTO [User] (UserName, Password, Name, PhoneNumber, ShippingAddress, CreatedDate)
        VALUES (@email, @password, @name, @phoneNumber, @shippingAddress, @createdDate)
        SELECT SCOPE_IDENTITY() as Id
      `);

    console.log('[REGISTER] User inserted with ID:', result.recordset[0].Id);
    const userId = result.recordset[0].Id;

    // Assign role (default to Customer, but allow Seller on signup)
    // First, find the requested role
    const roleResult = await pool.request()
      .input('roleType', sql.NVarChar, roleType)
      .query('SELECT Id FROM RoleDetail WHERE RoleType = @roleType');

    if (roleResult.recordset.length > 0) {
      const roleId = roleResult.recordset[0].Id;
      console.log('[REGISTER] Assigning', roleType, 'role (ID:', roleId, ') to user');
      
      await pool.request()
        .input('userId', sql.Int, userId)
        .input('roleId', sql.Int, roleId)
        .input('createdDate', sql.DateTime2, new Date())
        .query(`
          INSERT INTO UserRole (UserId, RoleId, CreatedDate)
          VALUES (@userId, @roleId, @createdDate)
        `);
      console.log('[REGISTER] Role assigned successfully. User email:', email);
    } else {
      console.warn('[REGISTER] Requested role "' + roleType + '" not found in RoleDetail table. Using Customer role.');
      
      // Fallback to Customer role
      const customerRoleResult = await pool.request()
        .input('roleType', sql.NVarChar, 'Customer')
        .query('SELECT Id FROM RoleDetail WHERE RoleType = @roleType');
      
      if (customerRoleResult.recordset.length > 0) {
        const roleId = customerRoleResult.recordset[0].Id;
        await pool.request()
          .input('userId', sql.Int, userId)
          .input('roleId', sql.Int, roleId)
          .input('createdDate', sql.DateTime2, new Date())
          .query(`
            INSERT INTO UserRole (UserId, RoleId, CreatedDate)
            VALUES (@userId, @roleId, @createdDate)
          `);
      }
    }

    console.log('[REGISTER] Registration complete for user:', email);
    return { userId, email, name, phoneNumber: normalizedPhone };
  } catch (error) {
    console.error('[REGISTER] Registration error:', error.message);
    throw error;
  }
}

// Login user
async function loginUser(email, password) {
  try {
    const pool = await getConnection();
    console.log('[LOGIN] Database connection established for loginUser');
    console.log('[LOGIN] Attempting to find user with email:', email);
    console.log('[LOGIN] Password provided:', password ? 'Yes' : 'No');

    // Get user with role information using email (stored in UserName field)
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(`
        SELECT 
          u.Id,
          u.UserName,
          u.Password,
          u.Name,
          u.CreatedDate,
          u.LastLogin,
          rd.Id as RoleId,
          rd.RoleName,
          rd.RoleType
        FROM [User] u
        LEFT JOIN UserRole ur ON u.Id = ur.UserId
        LEFT JOIN RoleDetail rd ON ur.RoleId = rd.Id
        WHERE u.UserName = @email
      `);

    console.log('[LOGIN] Query result received. Records found:', result.recordset ? result.recordset.length : 0);

    if (!result || !result.recordset || result.recordset.length === 0) {
      console.log('[LOGIN] User not found with email:', email);
      throw new Error('Invalid email or password');
    }

    const user = result.recordset[0];
    console.log('[LOGIN] User found:', { id: user.Id, email: user.UserName, name: user.Name });

    // Compare password
    console.log('[LOGIN] Validating password...');
    const isPasswordValid = await comparePassword(password, user.Password);
    console.log('[LOGIN] Password validation result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('[LOGIN] Password invalid for user:', email);
      throw new Error('Invalid email or password');
    }

    // Update last login
    await pool.request()
      .input('userId', sql.Int, user.Id)
      .input('lastLogin', sql.DateTime2, new Date())
      .query('UPDATE [User] SET LastLogin = @lastLogin WHERE Id = @userId');

    console.log('[LOGIN] Last login updated for user:', email);

    // Generate token
    const token = generateToken(user);
    console.log('[LOGIN] Token generated successfully');

    const loginResponse = {
      token,
      user: {
        id: user.Id,
        userName: user.UserName,
        email: user.UserName,
        name: user.Name,
        role: user.RoleName,
        roleType: user.RoleType,
        roleId: user.RoleId
      }
    };

    console.log('[LOGIN] Login successful for user:', user.UserName);
    return loginResponse;
  } catch (error) {
    console.error('[LOGIN] Error during login:', error.message);
    console.error('[LOGIN] Full error:', error);
    throw error;
  }
}

// Auto register/login during checkout using email + phone number
async function checkoutAutoRegisterOrLogin(email, name, phoneNumber, shippingAddress = null) {
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPhone = (phoneNumber || '').trim();

    if (!normalizedEmail || !normalizedPhone) {
      throw new Error('Email and phone number are required for checkout auto authentication');
    }

    const pool = await getConnection();

    const existingUserResult = await pool.request()
      .input('email', sql.NVarChar, normalizedEmail)
      .query(`
        SELECT 
          u.Id,
          u.UserName,
          u.Password,
          u.Name,
          u.PhoneNumber,
          u.ShippingAddress,
          u.CreatedDate,
          u.LastLogin,
          rd.Id as RoleId,
          rd.RoleName,
          rd.RoleType
        FROM [User] u
        LEFT JOIN UserRole ur ON u.Id = ur.UserId
        LEFT JOIN RoleDetail rd ON ur.RoleId = rd.Id
        WHERE LOWER(u.UserName) = LOWER(@email)
      `);

    if (existingUserResult.recordset.length === 0) {
      const fallbackName = (name || '').trim() || normalizedEmail.split('@')[0] || 'Customer';

      await registerUser(normalizedEmail, normalizedPhone, fallbackName, 'Customer', normalizedPhone, shippingAddress || null);
      const registeredLogin = await loginUser(normalizedEmail, normalizedPhone);

      return {
        ...registeredLogin,
        authMode: 'registered'
      };
    }

    const existingUser = existingUserResult.recordset[0];
    const existingPhone = (existingUser.PhoneNumber || '').trim();

    if (existingPhone && existingPhone !== normalizedPhone) {
      throw new Error('Phone number does not match the existing account for this email');
    }

    // Keep checkout details in sync for future logins/profile usage.
    const updateRequest = pool.request()
      .input('userId', sql.Int, existingUser.Id)
      .input('phoneNumber', sql.NVarChar, normalizedPhone)
      .input('lastLogin', sql.DateTime2, new Date())
      .input('shippingAddress', sql.NVarChar, shippingAddress || existingUser.ShippingAddress || null);

    if (!existingPhone) {
      const hashedPhonePassword = await hashPassword(normalizedPhone);
      updateRequest.input('password', sql.NVarChar, hashedPhonePassword);
      await updateRequest.query(`
        UPDATE [User]
        SET PhoneNumber = @phoneNumber,
            Password = @password,
            ShippingAddress = @shippingAddress,
            LastLogin = @lastLogin
        WHERE Id = @userId
      `);
    } else {
      await updateRequest.query(`
        UPDATE [User]
        SET PhoneNumber = @phoneNumber,
            ShippingAddress = @shippingAddress,
            LastLogin = @lastLogin
        WHERE Id = @userId
      `);
    }

    const token = generateToken(existingUser);

    return {
      token,
      user: {
        id: existingUser.Id,
        userName: existingUser.UserName,
        email: existingUser.UserName,
        name: existingUser.Name,
        role: existingUser.RoleName,
        roleType: existingUser.RoleType,
        roleId: existingUser.RoleId
      },
      authMode: 'logged_in'
    };
  } catch (error) {
    console.error('[CHECKOUT_AUTO_AUTH] Error:', error.message);
    throw error;
  }
}

// Get user by ID
async function getUserById(userId) {
  try {
    const pool = await getConnection();

    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          u.Id,
          u.UserName,
          u.Name,
          u.PhoneNumber,
          u.ShippingAddress,
          u.CreatedDate,
          u.LastLogin,
          rd.RoleName,
          rd.RoleType
        FROM [User] u
        LEFT JOIN UserRole ur ON u.Id = ur.UserId
        LEFT JOIN RoleDetail rd ON ur.RoleId = rd.Id
        WHERE u.Id = @userId
      `);

    if (result.recordset.length === 0) {
      throw new Error('User not found');
    }

    return result.recordset[0];
  } catch (error) {
    throw error;
  }
}

// Update user role
async function updateUserRole(userId, roleId) {
  try {
    const pool = await getConnection();

    // Remove existing role
    await pool.request()
      .input('userId', sql.Int, userId)
      .query('DELETE FROM UserRole WHERE UserId = @userId');

    // Assign new role
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('roleId', sql.Int, roleId)
      .input('createdDate', sql.DateTime2, new Date())
      .query(`
        INSERT INTO UserRole (UserId, RoleId, CreatedDate)
        VALUES (@userId, @roleId, @createdDate)
      `);

    return { userId, roleId };
  } catch (error) {
    throw error;
  }
}

// Get all users with their roles
async function getAllUsers() {
  try {
    const pool = await getConnection();

    const result = await pool.request()
      .query(`
        SELECT 
          u.Id,
          u.UserName,
          u.Name,
          u.Password,
          u.CreatedDate,
          u.LastLogin,
          rd.Id as RoleId,
          rd.RoleName,
          rd.RoleType
        FROM [User] u
        LEFT JOIN UserRole ur ON u.Id = ur.UserId
        LEFT JOIN RoleDetail rd ON ur.RoleId = rd.Id
        ORDER BY u.CreatedDate DESC
      `);

    return result.recordset;
  } catch (error) {
    console.error('[GET_ALL_USERS] Error:', error);
    throw error;
  }
}

// Get all roles
async function getAllRoles() {
  try {
    const pool = await getConnection();

    const result = await pool.request()
      .query('SELECT Id, RoleName, RoleType FROM RoleDetail ORDER BY RoleName');

    return result.recordset;
  } catch (error) {
    throw error;
  }
}

// Update user profile (phone number and shipping address)
async function updateUserProfile(userId, phoneNumber, shippingAddress) {
  try {
    const pool = await getConnection();
    console.log('[UPDATE_PROFILE] Updating user profile for userId:', userId);

    let updateQuery = `
      UPDATE [User]
      SET ShippingAddress = @shippingAddress`;
    
    let hashedPassword = null;
    
    // If phone number is provided and not empty, update password to match phone number
    if (phoneNumber && phoneNumber.trim()) {
      hashedPassword = await hashPassword(phoneNumber);
      updateQuery += `, PhoneNumber = @phoneNumber, Password = @password`;
      console.log('[UPDATE_PROFILE] Phone number changed, updating password to match');
    } else {
      updateQuery += `, PhoneNumber = @phoneNumber`;
    }

    updateQuery += ` WHERE Id = @userId;
      
      SELECT 
        Id,
        UserName,
        Name,
        PhoneNumber,
        ShippingAddress,
        CreatedDate,
        LastLogin
      FROM [User]
      WHERE Id = @userId`;

    const request = pool.request()
      .input('userId', sql.Int, userId)
      .input('phoneNumber', sql.NVarChar, phoneNumber || null)
      .input('shippingAddress', sql.NVarChar, shippingAddress || null);
    
    if (hashedPassword) {
      request.input('password', sql.NVarChar, hashedPassword);
    }

    const result = await request.query(updateQuery);

    if (result.recordset.length === 0) {
      throw new Error('User not found');
    }

    console.log('[UPDATE_PROFILE] Profile updated successfully');
    return result.recordset[0];
  } catch (error) {
    console.error('[UPDATE_PROFILE] Error:', error);
    throw error;
  }
}

// Update user profile with optional password change
async function updateUserProfileWithPassword(userId, phoneNumber, shippingAddress, currentPassword, newPassword) {
  try {
    const pool = await getConnection();
    console.log('[UPDATE_PROFILE_PASSWORD] Updating user profile for userId:', userId);

    // If changing password, verify current password
    if (newPassword) {
      const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT Password FROM [User] WHERE Id = @userId');

      if (userResult.recordset.length === 0) {
        throw new Error('User not found');
      }

      const storedPassword = userResult.recordset[0].Password;
      const isPasswordValid = await comparePassword(currentPassword, storedPassword);

      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update profile with new password
      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('phoneNumber', sql.NVarChar, phoneNumber || null)
        .input('shippingAddress', sql.NVarChar, shippingAddress || null)
        .input('password', sql.NVarChar, hashedPassword)
        .query(`
          UPDATE [User]
          SET PhoneNumber = @phoneNumber,
              ShippingAddress = @shippingAddress,
              Password = @password
          WHERE Id = @userId;
          
          SELECT 
            Id,
            UserName,
            Name,
            PhoneNumber,
            ShippingAddress,
            CreatedDate,
            LastLogin
          FROM [User]
          WHERE Id = @userId
        `);

      console.log('[UPDATE_PROFILE_PASSWORD] Profile and password updated successfully');
      return result.recordset[0];
    } else {
      // Update profile without explicit password change
      // If phone number is provided, update password to match it
      let hashedPassword = null;
      
      if (phoneNumber && phoneNumber.trim()) {
        hashedPassword = await hashPassword(phoneNumber);
        console.log('[UPDATE_PROFILE_PASSWORD] Phone number changed, updating password to match');
      }

      let updateQuery = `
        UPDATE [User]
        SET PhoneNumber = @phoneNumber,
            ShippingAddress = @shippingAddress`;
      
      if (hashedPassword) {
        updateQuery += `, Password = @password`;
      }

      updateQuery += ` WHERE Id = @userId;
        
        SELECT 
          Id,
          UserName,
          Name,
          PhoneNumber,
          ShippingAddress,
          CreatedDate,
          LastLogin
        FROM [User]
        WHERE Id = @userId`;

      const request = pool.request()
        .input('userId', sql.Int, userId)
        .input('phoneNumber', sql.NVarChar, phoneNumber || null)
        .input('shippingAddress', sql.NVarChar, shippingAddress || null);
      
      if (hashedPassword) {
        request.input('password', sql.NVarChar, hashedPassword);
      }

      const result = await request.query(updateQuery);

      if (result.recordset.length === 0) {
        throw new Error('User not found');
      }

      console.log('[UPDATE_PROFILE_PASSWORD] Profile updated successfully');
      return result.recordset[0];
    }
  } catch (error) {
    console.error('[UPDATE_PROFILE_PASSWORD] Error:', error);
    throw error;
  }
}

// Reset user password (Admin only)
async function resetUserPassword(userId) {
  try {
    const pool = await getConnection();
    console.log('[RESET_PASSWORD] Starting password reset for user ID:', userId);

    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT PhoneNumber FROM [User] WHERE Id = @userId');

    if (userResult.recordset.length === 0) {
      throw new Error('User not found');
    }

    const phoneNumber = (userResult.recordset[0].PhoneNumber || '').trim();
    if (!phoneNumber) {
      throw new Error('User phone number is required to reset password');
    }

    // Password policy: password is always the user's phone number.
    const hashedPassword = await hashPassword(phoneNumber);
    console.log('[RESET_PASSWORD] Password hashed successfully');

    // Update the user's password
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('password', sql.NVarChar, hashedPassword)
      .query(`
        UPDATE [User]
        SET Password = @password
        WHERE Id = @userId
        
        SELECT 
          Id,
          UserName,
          Name,
          CreatedDate,
          LastLogin
        FROM [User]
        WHERE Id = @userId
      `);

    if (result.recordset.length === 0) {
      throw new Error('User not found');
    }

    console.log('[RESET_PASSWORD] Password reset successfully for user ID:', userId);
    return result.recordset[0];
  } catch (error) {
    console.error('[RESET_PASSWORD] Error:', error);
    throw error;
  }
}

module.exports = {
  registerUser,
  loginUser,
  checkoutAutoRegisterOrLogin,
  getUserById,
  updateUserRole,
  updateUserProfile,
  updateUserProfileWithPassword,
  getAllRoles,
  getAllUsers,
  hashPassword,
  comparePassword,
  generateToken,
  resetUserPassword
};

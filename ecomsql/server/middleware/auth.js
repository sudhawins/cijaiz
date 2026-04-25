const jwt = require('jsonwebtoken');

// Get JWT secret - use environment variable or fallback
const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  if (!process.env.JWT_SECRET) {
    console.warn('[JWT] WARNING: JWT_SECRET not set in environment, using fallback');
  }
  return secret;
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      console.warn('[verifyToken] No token provided in request to:', req.originalUrl);
      return res.status(401).json({ error: 'No token provided' });
    }

    console.log('[verifyToken] Token received. Verifying...');
    console.log('[verifyToken] Auth header present:', !!authHeader);
    console.log('[verifyToken] Token length:', token?.length);
    
    // Verify token
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    
    console.log('[verifyToken] Token verified. User:', {
      userId: decoded.userId,
      userName: decoded.userName,
      roleType: decoded.roleType
    });
    
    next();
  } catch (error) {
    console.error('[verifyToken] Token verification failed:', error.message);
    console.error('[verifyToken] Error name:', error.name);
    if (error.name === 'JsonWebTokenError') {
      console.error('[verifyToken] JWT Error - likely invalid signature or malformed token');
    }
    if (error.name === 'TokenExpiredError') {
      console.error('[verifyToken] Token has expired at:', error.expiredAt);
    }
    return res.status(401).json({ error: 'Invalid or expired token', details: error.message });
  }
};

// Middleware to check if user has required roles
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!allowedRoles.includes(req.user.roleType)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  return checkRole(['Administrator'])(req, res, next);
};

// Middleware to optionally verify user (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
    }
  } catch (error) {
    // Token is invalid but optional, so we continue
  }
  next();
};

module.exports = {
  verifyToken,
  checkRole,
  isAdmin,
  optionalAuth
};

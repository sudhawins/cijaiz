require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { getConnection } = require('./config');

// Import routes
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const subcategoryRoutes = require('./routes/subcategories');
const productRoutes = require('./routes/products');
const productImageRoutes = require('./routes/productImages');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const shippingRoutes = require('./routes/shipping');
const discountsRoutes = require('./routes/discounts');
const wishlistRoutes = require('./routes/wishlist');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - Compression for all responses
app.use(compression());

// CORS with specific options
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cache static files for 24 hours
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '24h',
  etag: false
}));

// Initialize database connection
async function initializeDB() {
  try {
    await getConnection();
    console.log('Database initialized');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-images', productImageRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/discounts', discountsRoutes);
app.use('/api/wishlist', wishlistRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Debug endpoint to check database and data
app.get('/api/debug', async (req, res) => {
  try {
    const pool = await getConnection();
    const { sql: SqlClient } = require('mssql');
    
    // Check if pool is connected
    const connectionStatus = pool.connected ? 'Connected' : 'Not Connected';
    
    // Count records in each table
    const categoryCount = await pool.request().query('SELECT COUNT(*) as count FROM categories');
    const productCount = await pool.request().query('SELECT COUNT(*) as count FROM products');
    const orderCount = await pool.request().query('SELECT COUNT(*) as count FROM orders');
    const cartCount = await pool.request().query('SELECT COUNT(*) as count FROM cart_items');
    
    // Get sample product
    const sampleProduct = await pool.request().query('SELECT TOP 5 id, name, price, stock FROM products');
    
    // Get sample order
    const sampleOrder = await pool.request().query('SELECT TOP 5 id, order_number, total_amount, status FROM orders');
    
    res.json({
      status: 'Success',
      database: {
        connectionStatus,
        dbServer: process.env.DB_SERVER,
        dbName: process.env.DB_NAME,
        dbUser: process.env.DB_USER
      },
      tables: {
        categories: categoryCount.recordset[0].count,
        products: productCount.recordset[0].count,
        orders: orderCount.recordset[0].count,
        cart_items: cartCount.recordset[0].count
      },
      sampleProducts: sampleProduct.recordset,
      sampleOrders: sampleOrder.recordset,
      timestamp: new Date()
    });
  } catch (error) {
    res.json({
      status: 'Error',
      error: error.message,
      details: {
        code: error.code,
        number: error.number,
        originalError: error.originalError?.message
      },
      dbServer: process.env.DB_SERVER,
      dbName: process.env.DB_NAME,
      timestamp: new Date()
    });
  }
});

// Token diagnostic endpoint (for debugging token issues)
app.get('/api/token-debug', (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.json({
        success: false,
        message: 'No token provided in Authorization header',
        hint: 'Add "Authorization: Bearer <token>" header to requests'
      });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret);
    
    res.json({
      success: true,
      message: 'Token is valid',
      decoded: {
        userId: decoded.userId,
        userName: decoded.userName,
        roleType: decoded.roleType,
        roleId: decoded.roleId,
        issuedAt: new Date(decoded.iat * 1000).toISOString(),
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      errorType: error.name,
      hint: error.name === 'TokenExpiredError' 
        ? 'Token has expired. Please login again.' 
        : error.name === 'JsonWebTokenError'
        ? 'Token is invalid or signature mismatch. Check JWT_SECRET.'
        : 'Unknown token error'
    });
  }
});

// Start server
initializeDB().then(() => {
  // Log JWT configuration on startup
  console.log('[SERVER] JWT Configuration:', {
    jwtSecretSet: !!process.env.JWT_SECRET,
    jwtSecretLength: (process.env.JWT_SECRET || 'your-secret-key').length,
    jwtSecretSource: process.env.JWT_SECRET ? 'from .env' : 'using fallback',
    note: 'If jwtSecretSource is "using fallback", JWT tokens may not verify correctly'
  });

  app.listen(PORT, () => {
    console.log(`[SERVER] Server running on port ${PORT}`);
    console.log('[SERVER] Use GET /api/token-debug with Authorization header to test token validity');
  });
}).catch(error => {
  console.error('[SERVER] Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Server shutting down gracefully...');
  const timeout = setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
  timeout.unref();
  process.exit(0);
});

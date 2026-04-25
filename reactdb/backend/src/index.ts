import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initializeDatabase, closeDatabase, getPool } from './database';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { initializeAzureClient, isAzureConfigured, downloadAzureBlob, downloadAzureBlobFromContainer, downloadFromAzureBlobUrl, getAzureBlobSasUrl, uploadAzureBlob, uploadAzureBlobToContainer, deleteAzureBlob, deleteAzureBlobFromContainer } from './azureService';
import { calculateProRataCharges, getTenantChargesForMonth, getRoomBillingsSummary, getMonthlyBillingReport, getTenantMonthlyBill, recalculateMonthlyCharges, getRoomMonthlyEbReport } from './services/proRataService';
import { calculateCheckInProRataRent, calculateCheckOutProRataRent, recordProRataRentCalculation, calculateProRataRentForMonth, calculateOccupancyDaysForMonth } from './services/proRataRentService';

const app: Express = express();
const PORT: number = parseInt(process.env.EXPRESS_PORT || '5000');

// Determine complains directory based on environment
// In Docker: /app/complains (or use env variable if provided)
// In local development: process.cwd()/complains
const isDocker = process.env.NODE_ENV === 'production';
const complainsDir = process.env.COMPLAINS_DIR || 
  (isDocker ? '/app/complains' : path.resolve(process.cwd(), 'complains'));

// Determine daily status media directory
const dailyStatusMediaDir = process.env.DAILY_STATUS_MEDIA_DIR || 
  (isDocker ? '/app/daily-status-media' : path.resolve(process.cwd(), 'daily-status-media'));

// Determine tenant photos directory
const tenantPhotosDir = process.env.TENANT_PHOTOS_DIR || 
  (isDocker ? '/app/tenantphotos' : path.resolve(process.cwd(), 'tenantphotos'));

// Determine payments directory
const paymentsDir = process.env.PAYMENTS_DIR || 
  (isDocker ? '/app/payments' : path.resolve(process.cwd(), 'payments'));

// Determine banner directory
const bannerDir = process.env.BANNER_DIR || 
  (isDocker ? '/app/banner' : path.resolve(process.cwd(), 'banner'));

// Determine guest checkin files directory
const guestCheckinDir = process.env.GUEST_CHECKIN_DIR ||
  (isDocker ? '/app/guest-checkin' : path.resolve(process.cwd(), 'guest-checkin'));

// Azure container name for guest checkin files
const AZURE_COMPLAINS_CONTAINER = process.env.AZURE_COMPLAINS_CONTAINER || 'complains';
const AZURE_GUEST_CHECKIN_CONTAINER = process.env.AZURE_GUEST_CHECKIN_CONTAINER || 'guest-checkins';
const AZURE_STORAGE_BASE = process.env.AZURE_STORAGE_BASE_URL ||
  process.env.AZURE_BLOB_URL?.replace(/\/[^/]+$/, '') ||
  'https://complexstore.blob.core.windows.net';

const getPaymentProofContainerName = (paymentDate?: string): string => {
  const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

  if (Number.isNaN(parsedPaymentDate.getTime())) {
    const currentDate = new Date();
    return `${currentDate.getFullYear()}${currentDate.getMonth() + 1}`;
  }

  return `${parsedPaymentDate.getFullYear()}${parsedPaymentDate.getMonth() + 1}`;
};

console.log('Environment:', { NODE_ENV: process.env.NODE_ENV, isDocker });
console.log('Complains directory:', complainsDir);
console.log('Daily Status Media directory:', dailyStatusMediaDir);
console.log('Tenant Photos directory:', tenantPhotosDir);
console.log('Payments directory:', paymentsDir);
console.log('Banner directory:', bannerDir);

if (!fs.existsSync(complainsDir)) {
  fs.mkdirSync(complainsDir, { recursive: true });
  console.log('Created complains directory:', complainsDir);
} else {
  console.log('Complains directory already exists');
}

if (!fs.existsSync(dailyStatusMediaDir)) {
  fs.mkdirSync(dailyStatusMediaDir, { recursive: true });
  console.log('Created daily status media directory:', dailyStatusMediaDir);
} else {
  console.log('Daily status media directory already exists');
}

if (!fs.existsSync(tenantPhotosDir)) {
  fs.mkdirSync(tenantPhotosDir, { recursive: true });
  console.log('Created tenant photos directory:', tenantPhotosDir);
} else {
  console.log('Tenant photos directory already exists');
}

if (!fs.existsSync(paymentsDir)) {
  fs.mkdirSync(paymentsDir, { recursive: true });
  console.log('Created payments directory:', paymentsDir);
} else {
  console.log('Payments directory already exists');
}

if (!fs.existsSync(bannerDir)) {
  fs.mkdirSync(bannerDir, { recursive: true });
  console.log('Created banner directory:', bannerDir);
} else {
  console.log('Banner directory already exists');
}

// Verify directories are readable/writable
try {
  fs.accessSync(complainsDir, fs.constants.R_OK | fs.constants.W_OK);
  console.log('Complains directory is readable and writable');
} catch (err) {
  console.error('ERROR: Complains directory is not accessible:', err);
}

try {
  fs.accessSync(dailyStatusMediaDir, fs.constants.R_OK | fs.constants.W_OK);
  console.log('Daily status media directory is readable and writable');
} catch (err) {
  console.error('ERROR: Daily status media directory is not accessible:', err);
}

try {
  fs.accessSync(tenantPhotosDir, fs.constants.R_OK | fs.constants.W_OK);
  console.log('Tenant photos directory is readable and writable');
} catch (err) {
  console.error('ERROR: Tenant photos directory is not accessible:', err);
}

try {
  fs.accessSync(paymentsDir, fs.constants.R_OK | fs.constants.W_OK);
  console.log('Payments directory is readable and writable');
} catch (err) {
  console.error('ERROR: Payments directory is not accessible:', err);
}

try {
  fs.accessSync(bannerDir, fs.constants.R_OK);
  console.log('Banner directory is readable');
} catch (err) {
  console.error('ERROR: Banner directory is not accessible:', err);
}

if (!fs.existsSync(guestCheckinDir)) {
  fs.mkdirSync(guestCheckinDir, { recursive: true });
  console.log('Created guest checkin directory:', guestCheckinDir);
} else {
  console.log('Guest checkin directory already exists');
}

try {
  fs.accessSync(guestCheckinDir, fs.constants.R_OK | fs.constants.W_OK);
  console.log('Guest checkin directory is readable and writable');
} catch (err) {
  console.error('ERROR: Guest checkin directory is not accessible:', err);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, complainsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer for daily status media uploads
const dailyStatusMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dailyStatusMediaDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max file size
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  }
});

const uploadDailyStatusMedia = multer({
  storage: dailyStatusMediaStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max file size
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  }
});

// Configure multer for payment uploads
const paymentsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPaymentScreenshot = multer({
  storage: paymentsStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (req, file, cb) => {
    // Allow images only
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed for payment screenshots.'));
    }
  }
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
// Serve static files from complains folder via API path and direct path
app.use('/api/complains', express.static(complainsDir));
app.get('/api/complains/:fileName', async (req: Request, res: Response) => {
  const fileName = path.basename(req.params.fileName || '');

  if (!fileName) {
    return res.status(400).json({ error: 'File name is required' });
  }

  const localFilePath = path.join(complainsDir, fileName);
  if (fs.existsSync(localFilePath)) {
    return res.sendFile(localFilePath);
  }

  try {
    if (isAzureConfigured()) {
      const { buffer, contentType } = await downloadAzureBlobFromContainer(AZURE_COMPLAINS_CONTAINER, fileName);
      if (contentType) {
        res.type(contentType);
      } else {
        res.type(fileName);
      }
      return res.send(buffer);
    }

    const blobUrl = `${AZURE_STORAGE_BASE}/${AZURE_COMPLAINS_CONTAINER}/${fileName}`;
    const buffer = await downloadFromAzureBlobUrl(blobUrl);
    res.type(fileName);
    return res.send(buffer);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.includes('BlobNotFound') || message.includes('Blob not found') || message.includes('404')) {
      return res.status(404).json({ error: 'Complaint file not found' });
    }

    console.error('[Complaint File] Failed to load from Azure:', error);
    return res.status(500).json({ error: 'Failed to retrieve complaint file' });
  }
});
app.use('/complains', express.static(complainsDir));
console.log('Static file serving enabled at /api/complains and /complains from:', complainsDir);

// Serve static files from daily status media folder
app.use('/api/daily-status-media', express.static(dailyStatusMediaDir));
app.use('/daily-status-media', express.static(dailyStatusMediaDir));
console.log('Static file serving enabled at /api/daily-status-media and /daily-status-media from:', dailyStatusMediaDir);

// Serve static files from tenant photos folder
app.use('/api/tenantphotos', express.static(tenantPhotosDir));
app.use('/tenantphotos', express.static(tenantPhotosDir));
console.log('Static file serving enabled at /api/tenantphotos and /tenantphotos from:', tenantPhotosDir);

// Serve static files from guest checkin folder
app.use('/api/guest-checkin', express.static(guestCheckinDir));
app.get('/api/guest-checkin/:fileName', async (req: Request, res: Response) => {
  const fileName = path.basename(req.params.fileName || '');

  if (!fileName) {
    return res.status(400).json({ error: 'File name is required' });
  }

  const localFilePath = path.join(guestCheckinDir, fileName);
  if (fs.existsSync(localFilePath)) {
    return res.sendFile(localFilePath);
  }

  try {
    if (isAzureConfigured()) {
      const { buffer, contentType } = await downloadAzureBlobFromContainer(AZURE_GUEST_CHECKIN_CONTAINER, fileName);
      if (contentType) {
        res.type(contentType);
      } else {
        res.type(fileName);
      }
      return res.send(buffer);
    }

    const blobUrl = `${AZURE_STORAGE_BASE}/${AZURE_GUEST_CHECKIN_CONTAINER}/${fileName}`;
    const buffer = await downloadFromAzureBlobUrl(blobUrl);
    res.type(fileName);
    return res.send(buffer);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.includes('BlobNotFound') || message.includes('Blob not found') || message.includes('404')) {
      return res.status(404).json({ error: 'Guest check-in file not found' });
    }

    console.error('[Guest Checkin File] Failed to load from Azure:', error);
    return res.status(500).json({ error: 'Failed to retrieve guest check-in file' });
  }
});
app.use('/guest-checkin', express.static(guestCheckinDir));
console.log('Static file serving enabled at /api/guest-checkin and /guest-checkin from:', guestCheckinDir);

// Serve static files from payments folder
app.use('/api/payments', express.static(paymentsDir));
app.use('/payments', express.static(paymentsDir));
console.log('Static file serving enabled at /api/payments and /payments from:', paymentsDir);

// Serve static files from banner folder
app.use('/api/banner', express.static(bannerDir));
app.use('/banner', express.static(bannerDir));
console.log('Static file serving enabled at /api/banner and /banner from:', bannerDir);

// **HELPER FUNCTION: Transform blob names to Azure URLs**
// Converts stored blob names to full Azure URLs or local fallback paths
const transformPhotoUrlsForResponse = (data: any): any => {
  const azureConfigured = isAzureConfigured();
  const azureBlobUrl = process.env.AZURE_BLOB_URL || 'https://complexstore.blob.core.windows.net/proofs';
  
  // List of photo and proof URL fields
  const imageFields = [
    'photoUrl', 'photo2Url', 'photo3Url', 'photo4Url', 'photo5Url',
    'photo6Url', 'photo7Url', 'photo8Url', 'photo9Url', 'photo10Url',
    'proof1Url', 'proof2Url', 'proof3Url', 'proof4Url', 'proof5Url',
    'proof6Url', 'proof7Url', 'proof8Url', 'proof9Url', 'proof10Url'
  ];

  // Transform each image field
  for (const field of imageFields) {
    if (data[field]) {
      const blobName = data[field];
      
      // If already a full URL, keep as-is
      if (blobName.startsWith('http://') || blobName.startsWith('https://')) {
        continue;
      }
      
      // If Azure is configured, construct Azure URL
      if (azureConfigured) {
        data[field] = `${azureBlobUrl}/${blobName}`;
      } else {
        // Fallback to local path
        data[field] = `/api/tenantphotos/${blobName}`;
      }
    }
  }
  
  return data;
};

// Helper to transform array of records
const transformPhotoUrlsInArray = (records: any[]): any[] => {
  return records.map(record => transformPhotoUrlsForResponse({ ...record }));
};

const normalizeStoredFileName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const valueWithoutQuery = trimmedValue.split('?')[0].split('#')[0];
  return path.basename(valueWithoutQuery);
};

const normalizeGuestCheckinFilesForResponse = <T extends Record<string, any>>(record: T): T => {
  if (!record || typeof record !== 'object') {
    return record;
  }

  return {
    ...record,
    proofUrl: normalizeStoredFileName(record.proofUrl ?? record.ProofUrl),
    photoUrl: normalizeStoredFileName(record.photoUrl ?? record.PhotoUrl)
  };
};

const resolveComplaintFileUrlForResponse = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const fileName = normalizeStoredFileName(trimmed);
  if (!fileName) {
    return null;
  }

  if (isAzureConfigured()) {
    return `${AZURE_STORAGE_BASE}/${AZURE_COMPLAINS_CONTAINER}/${fileName}`;
  }

  return `/api/complains/${encodeURIComponent(fileName)}`;
};

const normalizeComplaintFilesForResponse = <T extends Record<string, any>>(record: T): T => {
  if (!record || typeof record !== 'object') {
    return record;
  }

  return {
    ...record,
    proof1Url: resolveComplaintFileUrlForResponse(record.proof1Url),
    proof2Url: resolveComplaintFileUrlForResponse(record.proof2Url),
    videoUrl: resolveComplaintFileUrlForResponse(record.videoUrl)
  };
};

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Test endpoint to check upload directory
app.get('/api/complaints/test-upload', (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(complainsDir);
    const stats = fs.statSync(complainsDir);
    const fileDetails = files.map(f => {
      const filePath = path.join(complainsDir, f);
      const fileStats = fs.statSync(filePath);
      return {
        name: f,
        size: fileStats.size,
        mode: '0o' + fileStats.mode.toString(8).slice(-3),
        accessible: true
      };
    });
    
    res.json({
      uploadDirectory: complainsDir,
      directoryExists: fs.existsSync(complainsDir),
      directoryMode: '0o' + stats.mode.toString(8).slice(-3),
      directorySize: stats.size,
      filesInDirectory: files,
      fileDetails: fileDetails,
      totalFiles: files.length,
      servingAt: ['/api/complains', '/complains']
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to read upload directory',
      details: errorMessage,
      uploadDirectory: complainsDir
    });
  }
});

app.get('/api/database/status', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query('SELECT 1 as connected');
    res.json({ status: 'connected', message: 'Database connection successful' });
  } catch (error) {
    console.error('Database query error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Database query failed',
      details: errorMessage
    });
  }
});

// Authentication endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    const pool = getPool();
    
    // Query user from database
    const userResult = await pool.request()
      .input('username', sql.NVarChar(100), username)
      .query(`
        SELECT 
          Id as id,
          UserName as username,
          Password as password,
          Name as name,
          NextLoginDuration as nextLoginDuration,
          LastLogin as lastLogin
        FROM [User]
        WHERE UserName = @username
      `);

    if (!userResult.recordset.length) {
      console.log(`[Login] User not found: ${username}`);
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }

    const user = userResult.recordset[0];
    console.log(`[Login] User found: ${username} (ID: ${user.id})`);

    // Check password (in production, should use hashed passwords)
    if (user.password !== password) {
      console.log(`[Login] Invalid password for user: ${username}`);
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }

    // Get user roles
    const rolesResult = await pool.request()
      .input('userId', sql.Int, user.id)
      .query(`
        SELECT 
          r.RoleName as roleName,
          r.RoleType as roleType
        FROM UserRole ur
        INNER JOIN RoleDetail r ON ur.RoleId = r.Id
        WHERE ur.UserId = @userId
      `);

    const roles = rolesResult.recordset
      .map(r => r.roleName)
      .filter(r => r && r.trim() !== '') // Filter out null/empty values
      .join(',') || 'user';
    
    console.log(`[Login] User roles for ${username}: ${roles}`);

    // Update LastLogin timestamp and fetch the updated value
    const updateResult = await pool.request()
      .input('userId', sql.Int, user.id)
      .query(`
        UPDATE [User]
        SET LastLogin = GETUTCDATE()
        WHERE Id = @userId;
        
        SELECT LastLogin
        FROM [User]
        WHERE Id = @userId
      `);

    // Get the newly updated LastLogin
    const updatedLastLogin = updateResult.recordset.length > 0 
      ? updateResult.recordset[0].LastLogin 
      : user.lastLogin;

    // Generate JWT access and refresh tokens
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || `${jwtSecret}-refresh`;

    const tokenPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      roles: roles
    };

    const token = jwt.sign(
      tokenPayload,
      jwtSecret,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      tokenPayload,
      refreshTokenSecret,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        roles: roles,
        nextLoginDuration: user.nextLoginDuration || null,
        lastLogin: updatedLastLogin || null
      }
    });

    console.log(`[Login] Successful login for user: ${username}`);
    console.log(`[Login] Response user object:`, {
      id: user.id,
      username: user.username,
      name: user.name,
      roles: roles,
      nextLoginDuration: user.nextLoginDuration,
      lastLogin: updatedLastLogin
    });
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Login failed',
      details: errorMessage
    });
  }
});

app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || `${jwtSecret}-refresh`;

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, refreshTokenSecret);
    } catch (verifyError) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const tokenPayload = {
      id: decoded.id,
      username: decoded.username,
      name: decoded.name,
      roles: decoded.roles || 'user'
    };

    const newToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '24h' });
    const newRefreshToken = jwt.sign(tokenPayload, refreshTokenSecret, { expiresIn: '30d' });

    res.json({
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to refresh token',
      details: errorMessage
    });
  }
});

// Example API endpoint - Get all tables
app.get('/api/tables', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool
      .request()
      .query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
      `);
    const normalizedComplaints = result.recordset.map((record: any) => normalizeComplaintFilesForResponse(record));
    res.json(normalizedComplaints);
  } catch (error) {
    console.error('Get tables error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve tables',
      details: errorMessage
    });
  }
});

// Diagnostic endpoint - Check RentalCollection table structure
app.get('/api/diagnostic/rental-schema', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool
      .request()
      .query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'RentalCollection'
        ORDER BY ORDINAL_POSITION
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Schema check error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve schema',
      details: errorMessage
    });
  }
});

// Diagnostic endpoint - Check sample data
app.get('/api/diagnostic/rental-sample', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool
      .request()
      .query(`SELECT TOP 5 * FROM RentalCollection`);
    res.json(result.recordset);
  } catch (error) {
    console.error('Sample data error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve sample data',
      details: errorMessage
    });
  }
});

// Rental Collection endpoints
app.get('/api/rental/summary', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    
    // Get all occupancies with their collection data
    const result = await pool.request().query(`
      SELECT 
        CONVERT(VARCHAR(7), rc.RentReceivedOn, 120) as month,
        o.Id as OccupancyId,
        o.TenantId,
        t.Name as TenantName,
        rd.Number as RoomNumber,
        ISNULL(CAST(o.RentFixed AS FLOAT), rd.Rent) as RentFixed,
        rd.Rent as RoomRent,
        LTRIM(RTRIM(o.CheckInDate)) as CheckInDate,
        LTRIM(RTRIM(o.CheckOutDate)) as CheckOutDate,
        ISNULL(SUM(CAST(rc.RentReceived AS FLOAT)), 0) as collected_amount,
        COUNT(rc.Id) as records_count
      FROM RentalCollection rc
      INNER JOIN Occupancy o ON rc.OccupancyId = o.Id
      INNER JOIN Tenant t ON o.TenantId = t.Id
      INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
      WHERE rc.RentReceivedOn IS NOT NULL
      GROUP BY 
        CONVERT(VARCHAR(7), rc.RentReceivedOn, 120),
        o.Id, o.TenantId, t.Name, rd.Number, o.RentFixed, rd.Rent,
        o.CheckInDate, o.CheckOutDate
      ORDER BY month DESC
    `);
    
    // Process results to calculate pro-rata and group by month
    const summaryByMonth: Record<string, any> = {};
    
    result.recordset.forEach((record: any) => {
      const month = record.month;
      const roomRent = parseFloat(record.RentFixed) || parseFloat(record.RoomRent) || 0;
      const checkInDate = record.CheckInDate?.trim() || null;
      const checkOutDate = record.CheckOutDate?.trim() || null;
      const collectedAmount = parseFloat(record.collected_amount) || 0;
      const recordsCount = parseInt(record.records_count) || 0;
      
      // Parse month
      const [monthYear, monthNum] = month.split('-');
      const targetYear = parseInt(monthYear);
      const targetMonth = parseInt(monthNum);
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      
      let proRataRent = 0;
      
      try {
        if (checkInDate) {
          const checkIn = new Date(checkInDate);
          
          if (checkIn.getFullYear() === targetYear && checkIn.getMonth() + 1 === targetMonth) {
            // Check-in in this month
            const daysOccupied = lastDay - checkIn.getDate() + 1;
            proRataRent = Math.round((roomRent * daysOccupied) / lastDay * 100) / 100;
          } else if (checkOutDate && new Date(checkOutDate).getFullYear() === targetYear && 
                     new Date(checkOutDate).getMonth() + 1 === targetMonth) {
            // Check-out in this month
            const checkOut = new Date(checkOutDate);
            const daysOccupied = checkOut.getDate();
            proRataRent = Math.round((roomRent * daysOccupied) / lastDay * 100) / 100;
          } else {
            // Full month
            proRataRent = roomRent;
          }
        }
      } catch (err) {
        proRataRent = roomRent;
      }
      
      const outstandingAmount = Math.max(0, proRataRent - collectedAmount);
      
      // Accumulate by month
      if (!summaryByMonth[month]) {
        summaryByMonth[month] = {
          month,
          total_occupancies: 0,
          total_records: 0,
          total_collected: 0,
          total_outstanding: 0,
          occupancies: new Set()
        };
      }
      
      summaryByMonth[month].occupancies.add(record.OccupancyId);
      summaryByMonth[month].total_records += recordsCount;
      summaryByMonth[month].total_collected += collectedAmount;
      summaryByMonth[month].total_outstanding += outstandingAmount;
    });
    
    // Convert to array and set total_occupancies, ensure proper numeric formatting
    const summary = Object.values(summaryByMonth)
      .map((item: any) => ({
        month: item.month,
        total_occupancies: item.occupancies.size,
        total_records: item.total_records,
        total_collected: Math.round(item.total_collected * 100) / 100,
        total_outstanding: Math.round(item.total_outstanding * 100) / 100
      }))
      .sort((a: any, b: any) => b.month.localeCompare(a.month));
    
    res.json(summary);
  } catch (error) {
    console.error('Rental summary error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve rental summary',
      details: errorMessage
    });
  }
});

app.get('/api/rental/unpaid-tenants', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    
    // Get all occupancies with their collection data
    const result = await pool.request().query(`
      SELECT 
        CONVERT(VARCHAR(7), rc.RentReceivedOn, 120) as month,
        o.Id as OccupancyId,
        ISNULL(CAST(o.RentFixed AS FLOAT), rd.Rent) as RentFixed,
        rd.Rent as RoomRent,
        LTRIM(RTRIM(o.CheckInDate)) as CheckInDate,
        LTRIM(RTRIM(o.CheckOutDate)) as CheckOutDate,
        ISNULL(SUM(CAST(rc.RentReceived AS FLOAT)), 0) as collected_amount,
        COUNT(rc.Id) as records_count
      FROM RentalCollection rc
      INNER JOIN Occupancy o ON rc.OccupancyId = o.Id
      INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
      WHERE rc.RentReceivedOn IS NOT NULL
      GROUP BY 
        CONVERT(VARCHAR(7), rc.RentReceivedOn, 120),
        o.Id, o.RentFixed, rd.Rent,
        o.CheckInDate, o.CheckOutDate
      ORDER BY month DESC
    `);
    
    // Process results to calculate pro-rata and outstanding
    const unpaidByMonth: Record<string, any> = {};
    
    result.recordset.forEach((record: any) => {
      const month = record.month;
      const roomRent = record.RentFixed || record.RoomRent || 0;
      const checkInDate = record.CheckInDate?.trim() || null;
      const checkOutDate = record.CheckOutDate?.trim() || null;
      const collectedAmount = parseFloat(record.collected_amount) || 0;
      
      // Parse month
      const [monthYear, monthNum] = month.split('-');
      const targetYear = parseInt(monthYear);
      const targetMonth = parseInt(monthNum);
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      
      let proRataRent = 0;
      
      try {
        if (checkInDate) {
          const checkIn = new Date(checkInDate);
          
          if (checkIn.getFullYear() === targetYear && checkIn.getMonth() + 1 === targetMonth) {
            // Check-in in this month
            const daysOccupied = lastDay - checkIn.getDate() + 1;
            proRataRent = Math.round((roomRent * daysOccupied) / lastDay * 100) / 100;
          } else if (checkOutDate && new Date(checkOutDate).getFullYear() === targetYear && 
                     new Date(checkOutDate).getMonth() + 1 === targetMonth) {
            // Check-out in this month
            const checkOut = new Date(checkOutDate);
            const daysOccupied = checkOut.getDate();
            proRataRent = Math.round((roomRent * daysOccupied) / lastDay * 100) / 100;
          } else {
            // Full month
            proRataRent = roomRent;
          }
        }
      } catch (err) {
        proRataRent = roomRent;
      }
      
      const outstandingAmount = Math.max(0, proRataRent - collectedAmount);
      
      // Only include if there is outstanding balance
      if (outstandingAmount > 0) {
        if (!unpaidByMonth[month]) {
          unpaidByMonth[month] = {
            month,
            outstanding_count: 0,
            total_outstanding: 0
          };
        }
        
        unpaidByMonth[month].outstanding_count += 1;
        unpaidByMonth[month].total_outstanding += outstandingAmount;
      }
    });
    
    const unpaidTenants = Object.values(unpaidByMonth).sort((a: any, b: any) => 
      b.month.localeCompare(a.month)
    );
    
    res.json(unpaidTenants);
  } catch (error) {
    console.error('Unpaid tenants error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve unpaid tenants',
      details: errorMessage
    });
  }
});

app.get('/api/rental/unpaid-details/:month', async (req: Request, res: Response) => {
  try {
    const { month } = req.params;
    
    const pool = getPool();
    const result = await pool
      .request()
      .input('month', sql.VarChar(7), month)
      .query(`
        SELECT 
          o.Id as OccupancyId,
          t.Name as TenantName,
          LTRIM(RTRIM(rd.Number)) as RoomNumber,
          LTRIM(RTRIM(o.CheckInDate)) as CheckInDate,
          LTRIM(RTRIM(o.CheckOutDate)) as CheckOutDate,
          ISNULL(CAST(o.RentFixed AS FLOAT), rd.Rent) as RentFixed,
          rd.Rent as RoomRent,
          ISNULL(SUM(CAST(rc.RentReceived AS FLOAT)), 0) as collected_amount,
          COUNT(rc.Id) as records_count,
          MAX(rc.RentReceivedOn) as latest_date
        FROM Occupancy o
        INNER JOIN Tenant t ON o.TenantId = t.Id
        INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
        LEFT JOIN RentalCollection rc 
          ON o.Id = rc.OccupancyId 
          AND CONVERT(VARCHAR(7), rc.RentReceivedOn, 120) = @month
        WHERE 
          -- Tenant is active in this month
          (CAST(o.CheckInDate AS DATE) <= EOMONTH(CAST(@month + '-01' AS DATE)))
          AND (o.CheckOutDate IS NULL 
            OR LTRIM(RTRIM(o.CheckOutDate)) = '' 
            OR CAST(o.CheckOutDate AS DATE) >= CAST(@month + '-01' AS DATE))
        GROUP BY 
          o.Id, t.Name, rd.Number, o.CheckInDate, o.CheckOutDate, 
          o.RentFixed, rd.Rent
        ORDER BY t.Name ASC
      `);
    
    // Process results to calculate pro-rata and outstanding balance
    const unpaidDetails = result.recordset.map((record: any) => {
      const roomRent = parseFloat(record.RentFixed) || parseFloat(record.RoomRent) || 0;
      const checkInDate = record.CheckInDate?.trim() || null;
      const checkOutDate = record.CheckOutDate?.trim() || null;
      const collectedAmount = parseFloat(record.collected_amount) || 0;
      const recordsCount = parseInt(record.records_count) || 0;
      
      // Parse the month to get year/month values
      const [monthYear, monthNum] = month.split('-');
      const targetYear = parseInt(monthYear);
      const targetMonth = parseInt(monthNum);
      
      // Get last day of the month
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      
      let proRataRent = 0;
      
      try {
        if (checkInDate) {
          const checkIn = new Date(checkInDate);
          const checkInYear = checkIn.getFullYear();
          const checkInMonth = checkIn.getMonth() + 1;
          
          if (checkInYear === targetYear && checkInMonth === targetMonth) {
            // Check-in is in this month - calculate from check-in to month end
            const daysOccupied = lastDay - checkIn.getDate() + 1;
            proRataRent = Math.round((roomRent * daysOccupied) / lastDay * 100) / 100;
          } else if (checkOutDate) {
            const checkOut = new Date(checkOutDate);
            const checkOutYear = checkOut.getFullYear();
            const checkOutMonth = checkOut.getMonth() + 1;
            
            if (checkOutYear === targetYear && checkOutMonth === targetMonth) {
              // Check-out is in this month - calculate from month start to check-out
              const daysOccupied = checkOut.getDate();
              proRataRent = Math.round((roomRent * daysOccupied) / lastDay * 100) / 100;
            } else if (checkInYear < targetYear || (checkInYear === targetYear && checkInMonth < targetMonth)) {
              // Check-in before this month, check-out after - full month
              proRataRent = roomRent;
            }
          } else {
            // No check-out date (active tenant) - if check-in is before this month, full month
            if (checkInYear < targetYear || (checkInYear === targetYear && checkInMonth < targetMonth)) {
              proRataRent = roomRent;
            }
          }
        }
      } catch (err) {
        console.error('Error calculating pro-rata:', err);
        proRataRent = roomRent;
      }
      
      // Calculate pending amount based on pro-rata
      const pendingAmount = Math.round(Math.max(0, proRataRent - collectedAmount) * 100) / 100;
      
      return {
        OccupancyId: record.OccupancyId,
        TenantName: record.TenantName?.trim() || '',
        RoomNumber: record.RoomNumber || '',
        CheckInDate: checkInDate,
        CheckOutDate: checkOutDate,
        proRataRent: Math.round(proRataRent * 100) / 100,
        pending_amount: pendingAmount,
        collected_amount: collectedAmount,
        records_count: recordsCount,
        latest_date: record.latest_date
      };
    }).filter(detail => detail.pending_amount > 0); // Only show records with pending balance
    
    res.json(unpaidDetails);
  } catch (error) {
    console.error('Unpaid details error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve unpaid details',
      details: errorMessage
    });
  }
});

// Get payment details by month and year
app.get('/api/rental/payments/:monthYear', async (req: Request, res: Response) => {
  try {
    const { monthYear } = req.params;
    
    // Parse monthYear in format YYYY-MM
    const [year, month] = monthYear.split('-').map(Number);
    
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ 
        error: 'Invalid month-year format. Use YYYY-MM' 
      });
    }
    
    const pool = getPool();
    const result = await pool
      .request()
      .input('year', sql.Int, year)
      .input('month', sql.Int, month)
      .input('reviewMonth', sql.NChar(7), monthYear)
      .query(`
        SELECT 
          o.Id as occupancyId,
          t.Id as tenantId,
          t.Name as tenantName,
          rd.Number as roomNumber,
          ISNULL(o.RentFixed, rd.Rent) as rentFixed,
          CAST(latestPayment.rentReceivedOn AS NVARCHAR) as rentReceivedOn,
          latestPayment.screenshotUrl as screenshotUrl,
          latestPayment.folder as folder,
          ISNULL(CAST(monthlyTotals.totalRentReceived AS FLOAT), 0) as rentReceived,
          ISNULL(CAST(monthlyTotals.totalCharges AS FLOAT), 0) as charges,
          CASE
            WHEN latestReview.IsVerified = 1 THEN 'approved'
            WHEN latestReview.IsDisputeRaised = 1 THEN 'rejected'
            ELSE NULL
          END as reviewDecision,
          latestReview.Comments as reviewComment,
          latestReview.VerifiedBy as reviewVerifiedBy,
          CONVERT(NVARCHAR(33), latestReview.VerifiedOn, 126) as reviewVerifiedOn,
          @month as [month],
          @year as [year],
          CAST(o.CheckInDate AS NVARCHAR) as checkInDate,
          CAST(o.CheckOutDate AS NVARCHAR) as checkOutDate,
          CASE 
            WHEN ISNULL(monthlyTotals.totalRentReceived, 0) + ISNULL(monthlyTotals.totalCharges, 0) = 0 THEN 'pending'
            WHEN ISNULL(monthlyTotals.totalRentReceived, 0) > 0 THEN 'partial'
            ELSE 'pending'
          END as paymentStatus
        FROM Occupancy o
        INNER JOIN Tenant t ON o.TenantId = t.Id
        INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
        OUTER APPLY (
          SELECT
            SUM(ISNULL(CAST(rcMonth.RentReceived AS FLOAT), 0)) as totalRentReceived,
            SUM(ISNULL(CAST(rcMonth.Charges AS FLOAT), 0)) as totalCharges
          FROM RentalCollection rcMonth
          WHERE rcMonth.OccupancyId = o.Id
            AND YEAR(CAST(rcMonth.RentReceivedOn AS DATE)) = @year
            AND MONTH(CAST(rcMonth.RentReceivedOn AS DATE)) = @month
        ) monthlyTotals
        OUTER APPLY (
          SELECT TOP 1
            rcLatest.RentReceivedOn as rentReceivedOn,
            rcLatest.screenshoturl as screenshotUrl,
            rcLatest.folder as folder
          FROM RentalCollection rcLatest
          WHERE rcLatest.OccupancyId = o.Id
            AND YEAR(CAST(rcLatest.RentReceivedOn AS DATE)) = @year
            AND MONTH(CAST(rcLatest.RentReceivedOn AS DATE)) = @month
          ORDER BY CAST(rcLatest.RentReceivedOn AS DATE) DESC, rcLatest.Id DESC
        ) latestPayment
        OUTER APPLY (
          SELECT TOP 1
            cv.Comments,
            cv.VerifiedBy,
            cv.VerifiedOn,
            cv.IsVerified,
            cv.IsDisputeRaised
          FROM CollectionVerification cv
          WHERE cv.OccupancyId = o.Id
            AND cv.ReviewMonth = @reviewMonth
          ORDER BY cv.VerifiedOn DESC, cv.Id DESC
        ) latestReview
        WHERE 
          -- Occupancy is active during this month
          CAST(o.CheckInDate AS DATE) <= EOMONTH(DATEFROMPARTS(@year, @month, 1))
          AND (o.CheckOutDate IS NULL OR CAST(o.CheckOutDate AS DATE) > DATEFROMPARTS(@year, @month, 1))
        ORDER BY t.Name ASC
      `);
    
    // Calculate pro-rata rent balance for each record
    const paymentRecords = result.recordset.map((record: any) => {
      const rentFixed = record.rentFixed || 0;
      const rentReceived = record.rentReceived || 0;
      const charges = record.charges || 0;
      
      // Calculate pro-rata rent for this specific month based on check-in/check-out dates
      const proRataRent = calculateProRataRentForMonth(
        record.checkInDate,
        record.checkOutDate,
        rentFixed,
        year,
        month
      );
      
      // Calculate occupancy days for this month
      const occupancyDays = calculateOccupancyDaysForMonth(
        record.checkInDate,
        record.checkOutDate,
        year,
        month
      );
      
      // Calculate rent balance as: proRataRent - (rentReceived + charges)
      const totalReceived = rentReceived + charges;
      const rentBalance = Math.max(0, proRataRent - totalReceived);

      // Recalculate payment status based on updated balance
      let paymentStatus: string;
      if (totalReceived === 0) {
        paymentStatus = 'pending';
      } else if (rentBalance === 0) {
        paymentStatus = 'paid';
      } else {
        paymentStatus = 'partial';
      }
      
      return {
        ...record,
        proRataRent,
        rentBalance,
        paymentStatus,
        occupancyDays
      };
    });
    
    res.json(paymentRecords);
  } catch (error) {
    console.error('Payment details error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve payment details',
      details: errorMessage
    });
  }
});

// ==================== AUTHENTICATION & AUTHORIZATION MIDDLEWARE ====================

// Verify JWT token and extract user info
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      console.log('[Auth] No token provided');
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Attach user info to request
    (req as any).user = decoded;
    console.log('[Auth] Token verified for user:', decoded.username, 'Roles:', decoded.roles);
    next();
  } catch (error) {
    console.log('[Auth] Token verification failed:', error instanceof Error ? error.message : String(error));
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Check if user has required role
const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userRoles = user.roles || [];
    const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      console.log('[Auth] Access denied for user:', user.username, 'Required roles:', allowedRoles, 'User roles:', userRoles);
      return res.status(403).json({ error: 'Insufficient permissions. Admin role required.' });
    }

    console.log('[Auth] Access granted for user:', user.username);
    next();
  };
};

// ==================== END MIDDLEWARE ====================

// Room Occupancy Endpoint

// Get occupancy records with explicit room-tenant linking (via FK_Occupancy_Tenant)
app.get('/api/occupancy/links', verifyToken, requireRole(['admin', 'manager', 'accountant', 'property_manager']), async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        o.Id as occupancyId,
        t.Id as tenantId,
        t.Name as tenantName,
        t.Phone as tenantPhone,
        t.Address as tenantAddress,
        t.City as tenantCity,
        t.PhotoUrl as tenantPhoto,
        rd.Id as roomId,
        rd.Number as roomNumber,
        ISNULL(CAST(rd.Rent AS FLOAT), 0) as roomRent,
        rd.Beds as beds,
        o.CheckInDate as checkInDate,
        o.CheckOutDate as checkOutDate,
        ISNULL(CAST(o.RentFixed AS FLOAT), 0) as rentFixed,
        ISNULL(CAST(o.DepositReceived AS FLOAT), 0) as advanceCollected,
        CASE WHEN o.CheckOutDate IS NULL OR o.CheckOutDate > CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END as isActive,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 CAST(RentReceived AS FLOAT) 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC),
          0) AS FLOAT), 0) as currentRentReceived,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 CAST(RentBalance AS FLOAT) 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC),
          0) AS FLOAT), 0) as currentPendingPayment,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 RentReceivedOn 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC), NULL) AS NVARCHAR(10)), NULL) as lastPaymentDate
      FROM Occupancy o
      INNER JOIN Tenant t ON o.TenantId = t.Id
      INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
      ORDER BY o.CheckOutDate ASC, t.Name ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Occupancy links error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve occupancy links',
      details: errorMessage
    });
  }
});

// Get all rooms with occupancy and payment data
app.get('/api/rooms/occupancy', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        rd.Id as roomId,
        rd.Number as roomNumber,
        ISNULL(CAST(rd.Rent AS FLOAT), 0) as roomRent,
        ISNULL(rd.Beds, 0) as beds,
        CASE WHEN o.Id IS NOT NULL THEN 1 ELSE 0 END as isOccupied,
        o.TenantId as tenantId,
        t.Name as tenantName,
        t.Phone as tenantPhone,
        o.CheckInDate as checkInDate,
        o.CheckOutDate as checkOutDate,
        (
          SELECT TOP 1 CAST(oHistory.CheckOutDate AS NVARCHAR(10))
          FROM Occupancy oHistory
          WHERE oHistory.RoomId = rd.Id
            AND oHistory.CheckOutDate IS NOT NULL
            AND CAST(oHistory.CheckOutDate AS DATE) <= CAST(GETDATE() AS DATE)
          ORDER BY CAST(oHistory.CheckOutDate AS DATE) DESC, oHistory.Id DESC
        ) as lastCheckOutDate,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 CAST(RentReceived AS FLOAT) 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC),
          0) AS FLOAT), 0) as currentRentReceived,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 CAST(RentBalance AS FLOAT) 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC),
          0) AS FLOAT), 0) as currentPendingPayment,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 RentReceivedOn 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC), NULL) AS NVARCHAR(10)), NULL) as lastPaymentDate
      FROM RoomDetail rd
      LEFT JOIN Occupancy o ON rd.Id = o.RoomId AND (o.CheckOutDate IS NULL OR CAST(o.CheckOutDate AS DATE) > CAST(GETDATE() AS DATE))
      LEFT JOIN Tenant t ON o.TenantId = t.Id
      ORDER BY rd.Number ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Room occupancy error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve room occupancy data',
      details: errorMessage
    });
  }
});

// Get vacant rooms (rooms with no active occupancy)
app.get('/api/rooms/vacant', async (req: Request, res: Response) => {
  try {
    console.log('[Vacant Rooms API] Request received');
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        rd.Id as id,
        LTRIM(RTRIM(rd.Number)) as number,
        ISNULL(CAST(rd.Rent AS FLOAT), 0) as rent,
        rd.Beds as beds,
        -- Last occupancy details
        (SELECT TOP 1 CONVERT(DATE, o2.CheckOutDate) 
         FROM Occupancy o2 
         WHERE o2.RoomId = rd.Id 
         AND o2.CheckOutDate IS NOT NULL
         ORDER BY o2.CheckOutDate DESC) as lastCheckOutDate,
        -- Last tenant details
        (SELECT TOP 1 LTRIM(RTRIM(t2.Name))
         FROM Occupancy o2
         INNER JOIN Tenant t2 ON o2.TenantId = t2.Id
         WHERE o2.RoomId = rd.Id 
         AND o2.CheckOutDate IS NOT NULL
         ORDER BY o2.CheckOutDate DESC) as lastTenantName,
        (SELECT TOP 1 LTRIM(RTRIM(t2.Phone))
         FROM Occupancy o2
         INNER JOIN Tenant t2 ON o2.TenantId = t2.Id
         WHERE o2.RoomId = rd.Id 
         AND o2.CheckOutDate IS NOT NULL
         ORDER BY o2.CheckOutDate DESC) as lastTenantPhone,
        -- Days vacant since last checkout
        (SELECT TOP 1 DATEDIFF(DAY, CONVERT(DATE, o2.CheckOutDate), CONVERT(DATE, GETDATE()))
         FROM Occupancy o2 
         WHERE o2.RoomId = rd.Id 
         AND o2.CheckOutDate IS NOT NULL
         ORDER BY o2.CheckOutDate DESC) as daysVacant,
        -- Check if room has ever been occupied
        CASE WHEN EXISTS (
          SELECT 1 FROM Occupancy o2 WHERE o2.RoomId = rd.Id
        ) THEN 'Previously Occupied' ELSE 'Never Occupied' END as vacancyStatus
      FROM RoomDetail rd
      WHERE NOT EXISTS (
        SELECT 1 FROM Occupancy o 
        WHERE o.RoomId = rd.Id 
        AND (o.CheckOutDate IS NULL OR CONVERT(DATE, o.CheckOutDate) > CONVERT(DATE, GETDATE()))
      )
      ORDER BY ISNULL((SELECT TOP 1 DATEDIFF(DAY, CONVERT(DATE, o2.CheckOutDate), CONVERT(DATE, GETDATE()))
                       FROM Occupancy o2 
                       WHERE o2.RoomId = rd.Id 
                       AND o2.CheckOutDate IS NOT NULL
                       ORDER BY o2.CheckOutDate DESC), 0) DESC,
               CASE WHEN ISNUMERIC(LTRIM(RTRIM(rd.Number))) = 1 
                   THEN CAST(LTRIM(RTRIM(rd.Number)) AS INT) 
                   ELSE 999999 END,
               LTRIM(RTRIM(rd.Number))
    `);
    // console.log('[Vacant Rooms API] Query executed. Results:', {
    //   count: result.recordset.length,
    //   rooms: result.recordset
    // });
    res.json(result.recordset);
  } catch (error) {
    console.error('[Vacant Rooms API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve vacant rooms',
      details: errorMessage
    });
  }
});

// Tenant Management Endpoints

// Get all tenants with occupancy details and pending payments
app.get('/api/tenants/with-occupancy', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        t.Id as id,
        TRIM(t.Name) as name,
        TRIM(t.Phone) as phone,
        TRIM(t.Address) as address,
        TRIM(t.City) as city,
        t.PhotoUrl as photoUrl,
        t.Photo2Url as photo2Url,
        t.Photo3Url as photo3Url,
        t.Photo4Url as photo4Url,
        t.Photo5Url as photo5Url,
        t.Photo6Url as photo6Url,
        t.Photo7Url as photo7Url,
        t.Photo8Url as photo8Url,
        t.Photo9Url as photo9Url,
        t.Photo10Url as photo10Url,
        t.Proof1Url as proof1Url,
        t.Proof2Url as proof2Url,
        t.Proof3Url as proof3Url,
        t.Proof4Url as proof4Url,
        t.Proof5Url as proof5Url,
        t.Proof6Url as proof6Url,
        t.Proof7Url as proof7Url,
        t.Proof8Url as proof8Url,
        t.Proof9Url as proof9Url,
        t.Proof10Url as proof10Url,
        o.Id as occupancyId,
        rd.Number as roomNumber,
        rd.Id as roomId,
        o.CheckInDate as checkInDate,
        o.CheckOutDate as checkOutDate,
        ISNULL(o.RentFixed, rd.Rent) as rentFixed,
        CASE WHEN o.CheckOutDate >= CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END as isCurrentlyOccupied,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 CAST(RentBalance AS FLOAT) 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC),
          0) AS FLOAT), 0) as currentPendingPayment,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 CAST(RentReceived AS FLOAT) 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC),
          0) AS FLOAT), 0) as currentRentReceived,
        ISNULL(CAST(COALESCE(
          (SELECT TOP 1 RentReceivedOn 
           FROM RentalCollection 
           WHERE OccupancyId = o.Id 
           AND YEAR(RentReceivedOn) = YEAR(GETDATE())
           AND MONTH(RentReceivedOn) = MONTH(GETDATE())
           ORDER BY RentReceivedOn DESC), NULL) AS NVARCHAR(10)), NULL) as lastPaymentDate
      FROM Tenant t
      LEFT JOIN Occupancy o ON t.Id = o.TenantId AND o.CheckOutDate >= CAST(GETDATE() AS DATE)
      LEFT JOIN RoomDetail rd ON o.RoomId = rd.Id
      ORDER BY t.Name ASC
    `);
    // **Transform blob names to Azure URLs**
    const transformedRecords = transformPhotoUrlsInArray(result.recordset);
    res.json(transformedRecords);
  } catch (error) {
    console.error('Get tenants error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve tenants',
      details: errorMessage
    });
  }
});

// Get single tenant
app.get('/api/tenants/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT 
          t.Id as id,
          TRIM(t.Name) as name,
          TRIM(t.Phone) as phone,
          TRIM(t.Address) as address,
          TRIM(t.City) as city,
          t.PhotoUrl as photoUrl,
          t.Photo2Url as photo2Url,
          t.Photo3Url as photo3Url,
          t.Photo4Url as photo4Url,
          t.Photo5Url as photo5Url,
          t.Photo6Url as photo6Url,
          t.Photo7Url as photo7Url,
          t.Photo8Url as photo8Url,
          t.Photo9Url as photo9Url,
          t.Photo10Url as photo10Url,
          t.Proof1Url as proof1Url,
          t.Proof2Url as proof2Url,
          t.Proof3Url as proof3Url,
          t.Proof4Url as proof4Url,
          t.Proof5Url as proof5Url,
          t.Proof6Url as proof6Url,
          t.Proof7Url as proof7Url,
          t.Proof8Url as proof8Url,
          t.Proof9Url as proof9Url,
          t.Proof10Url as proof10Url,
          o.Id as occupancyId,
          rd.Number as roomNumber,
          o.CheckInDate,
          o.CheckOutDate,
          o.RentFixed
        FROM Tenant t
        LEFT JOIN Occupancy o ON t.Id = o.TenantId AND o.CheckOutDate IS NULL
        LEFT JOIN RoomDetail rd ON o.RoomId = rd.Id
        WHERE t.Id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    // **Transform blob names to Azure URLs**
    const transformedTenant = transformPhotoUrlsForResponse(result.recordset[0]);
    res.json(transformedTenant);
  } catch (error) {
    console.error('Get tenant error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve tenant',
      details: errorMessage
    });
  }
});

// Get occupancy history for a tenant
app.get('/api/tenants/:id/occupancy-history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool
      .request()
      .input('tenantId', sql.Int, parseInt(id))
      .query(`
        SELECT 
          o.Id as occupancyId,
          o.RoomId as roomId,
          rd.Number as roomNumber,
          o.CheckInDate as checkInDate,
          o.CheckOutDate as checkOutDate,
          o.RentFixed as rentFixed,
          o.DepositReceived as depositReceived,
          o.DepositRefunded as depositRefunded,
          o.Charges as charges
        FROM Occupancy o
        LEFT JOIN RoomDetail rd ON o.RoomId = rd.Id
        WHERE o.TenantId = @tenantId
        ORDER BY 
          CASE WHEN o.CheckOutDate IS NOT NULL AND LTRIM(RTRIM(o.CheckOutDate)) <> '' THEN o.CheckOutDate ELSE o.CheckInDate END DESC
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Get tenant occupancy history error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to retrieve tenant occupancy history',
      details: errorMessage
    });
  }
});

// Check if phone number already exists
app.get('/api/tenants/check-phone/:phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const excludeTenantId = req.query.excludeId ? parseInt(req.query.excludeId as string) : null;
    
    console.log('[Phone Check] Checking phone:', { phone, excludeTenantId });
    
    const pool = getPool();
    let query = `SELECT Id, Name, LTRIM(RTRIM(Name)) as name FROM Tenant WHERE LTRIM(RTRIM(Phone)) = LTRIM(RTRIM(@phone))`;
    const request = pool.request().input('phone', sql.NChar(15), phone);
    
    // If editing a tenant, exclude the current tenant from the check
    if (excludeTenantId) {
      query += ` AND Id != @excludeId`;
      request.input('excludeId', sql.Int, excludeTenantId);
    }
    
    console.log('[Phone Check] Query:', query);
    
    const result = await request.query(query);
    
    console.log('[Phone Check] Raw result:', JSON.stringify(result.recordset));
    
    const exists = result.recordset.length > 0;
    let tenantName = null;
    
    if (exists) {
      const raw = result.recordset[0];
      console.log('[Phone Check] Raw record:', raw);
      
      // Try different approaches to get the name
      tenantName = raw.name || raw.Name || raw['name'] || null;
      
      if (tenantName && typeof tenantName === 'string') {
        tenantName = tenantName.trim();
      }
      
      // Fallback if name is empty after all attempts
      if (!tenantName) {
        console.log('[Phone Check] Name was empty, using fallback');
        tenantName = 'Unnamed Tenant';
      }
      
      console.log('[Phone Check] Final tenant name:', tenantName);
    }
    
    console.log('[Phone Check] Final result:', { 
      phone: phone.trim(), 
      exists, 
      tenantName
    });
    
    res.json({ 
      exists, 
      phone: phone.trim(),
      tenantName: tenantName 
    });
  } catch (error) {
    console.error('Check phone error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to check phone number',
      details: errorMessage
    });
  }
});

// Create tenant
app.post('/api/tenants', async (req: Request, res: Response) => {
  try {
    const { 
      name, phone, address, city, roomId, checkInDate,
      photoUrl, photo2Url, photo3Url, photo4Url, photo5Url, photo6Url, photo7Url, photo8Url, photo9Url, photo10Url,
      proof1Url, proof2Url, proof3Url, proof4Url, proof5Url, proof6Url, proof7Url, proof8Url, proof9Url, proof10Url
    } = req.body;
    
    if (!name || !phone || !address || !city) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate phone format - must be exactly 10 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      return res.status(400).json({ 
        error: 'Invalid phone format',
        details: `Phone number must be exactly 10 digits (received ${phoneDigits.length} digits)`
      });
    }
    
    // If creating occupancy, validate the parameters
    const creatingOccupancy = roomId && checkInDate;
    if (creatingOccupancy) {
      if (!roomId || !checkInDate) {
        return res.status(400).json({ 
          error: 'Both roomId and checkInDate are required to create an occupancy'
        });
      }
    }
    
    const pool = getPool();
    
    // Check if phone number already exists
    const phoneCheckResult = await pool
      .request()
      .input('phone', sql.NChar(15), phone)
      .query(`SELECT COUNT(*) as count FROM Tenant WHERE TRIM(Phone) = TRIM(@phone)`);
    
    if (phoneCheckResult.recordset[0].count > 0) {
      return res.status(400).json({ 
        error: 'Phone number already exists',
        details: `A tenant with phone number ${phone.trim()} already exists in the database.`
      });
    }
    
    const result = await pool
      .request()
      .input('name', sql.NChar(100), name)
      .input('phone', sql.NChar(15), phone)
      .input('address', sql.NChar(100), address)
      .input('city', sql.NChar(50), city)
      .input('photoUrl', sql.NVarChar(sql.MAX), photoUrl || null)
      .input('photo2Url', sql.NVarChar(sql.MAX), photo2Url || null)
      .input('photo3Url', sql.NVarChar(sql.MAX), photo3Url || null)
      .input('photo4Url', sql.NVarChar(sql.MAX), photo4Url || null)
      .input('photo5Url', sql.NVarChar(sql.MAX), photo5Url || null)
      .input('photo6Url', sql.NVarChar(sql.MAX), photo6Url || null)
      .input('photo7Url', sql.NVarChar(sql.MAX), photo7Url || null)
      .input('photo8Url', sql.NVarChar(sql.MAX), photo8Url || null)
      .input('photo9Url', sql.NVarChar(sql.MAX), photo9Url || null)
      .input('photo10Url', sql.NVarChar(sql.MAX), photo10Url || null)
      .input('proof1Url', sql.NVarChar(sql.MAX), proof1Url || null)
      .input('proof2Url', sql.NVarChar(sql.MAX), proof2Url || null)
      .input('proof3Url', sql.NVarChar(sql.MAX), proof3Url || null)
      .input('proof4Url', sql.NVarChar(sql.MAX), proof4Url || null)
      .input('proof5Url', sql.NVarChar(sql.MAX), proof5Url || null)
      .input('proof6Url', sql.NVarChar(sql.MAX), proof6Url || null)
      .input('proof7Url', sql.NVarChar(sql.MAX), proof7Url || null)
      .input('proof8Url', sql.NVarChar(sql.MAX), proof8Url || null)
      .input('proof9Url', sql.NVarChar(sql.MAX), proof9Url || null)
      .input('proof10Url', sql.NVarChar(sql.MAX), proof10Url || null)
      .query(`
        INSERT INTO Tenant (Name, Phone, Address, City, PhotoUrl, Photo2Url, Photo3Url, Photo4Url, Photo5Url, Photo6Url, Photo7Url, Photo8Url, Photo9Url, Photo10Url, Proof1Url, Proof2Url, Proof3Url, Proof4Url, Proof5Url, Proof6Url, Proof7Url, Proof8Url, Proof9Url, Proof10Url)
        VALUES (@name, @phone, @address, @city, @photoUrl, @photo2Url, @photo3Url, @photo4Url, @photo5Url, @photo6Url, @photo7Url, @photo8Url, @photo9Url, @photo10Url, @proof1Url, @proof2Url, @proof3Url, @proof4Url, @proof5Url, @proof6Url, @proof7Url, @proof8Url, @proof9Url, @proof10Url);
        SELECT SCOPE_IDENTITY() as id;
      `);
    
    const tenantId = result.recordset[0].id;
    let occupancyId = null;

    // Create occupancy if room and check-in date are provided
    if (creatingOccupancy) {
      try {
        // Get the room rent value for RentFixed
        const roomResult = await pool
          .request()
          .input('roomId', sql.Int, roomId)
          .query(`SELECT Rent FROM RoomDetail WHERE Id = @roomId`);
        
        if (roomResult.recordset.length === 0) {
          return res.status(400).json({ 
            error: 'Invalid room ID',
            details: `Room with ID ${roomId} does not exist`
          });
        }

        const roomRent = roomResult.recordset[0].Rent;

        // Create occupancy record
        const occupancyResult = await pool
          .request()
          .input('tenantId', sql.Int, tenantId)
          .input('roomId', sql.Int, roomId)
          .input('checkInDate', sql.NChar(10), checkInDate)
          .input('rentFixed', sql.Money, roomRent || 0)
          .query(`
            INSERT INTO Occupancy (TenantId, RoomId, CheckInDate, CheckOutDate, CreatedDate, UpdatedDate, RentFixed)
            VALUES (@tenantId, @roomId, @checkInDate, NULL, GETUTCDATE(), GETUTCDATE(), @rentFixed);
            SELECT SCOPE_IDENTITY() as occupancyId;
          `);
        
        occupancyId = occupancyResult.recordset[0].occupancyId;
        console.log(`[Tenant Creation] Created occupancy ${occupancyId} for tenant ${tenantId} in room ${roomId}`);
      } catch (occupancyError) {
        console.error('Error creating occupancy:', occupancyError);
        // Still return success for tenant creation, but note the occupancy creation failed
        return res.status(500).json({ 
          error: 'Failed to create occupancy',
          details: occupancyError instanceof Error ? occupancyError.message : String(occupancyError),
          tenantId: tenantId,
          message: 'Tenant was created but occupancy creation failed'
        });
      }
    }

    res.status(201).json({ 
      id: tenantId, 
      occupancyId: occupancyId,
      message: creatingOccupancy ? 'Tenant and occupancy created successfully' : 'Tenant created successfully' 
    });
  } catch (error) {
    console.error('Create tenant error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to create tenant',
      details: errorMessage
    });
  }
});

// Configure multer for guest checkin file uploads (proof and photo)
const uploadGuestCheckin = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, guestCheckinDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// Configure multer for tenant file uploads (supports up to 10 photos and 10 proofs)
const tenantUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, tenantPhotosDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// Tenant file upload endpoint
app.post('/api/tenants/upload', (req: Request, res: Response, next: Function) => {
  tenantUpload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'proofs', maxCount: 10 }
  ])(req, res, (err: any) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Too many files uploaded. Maximum 10 photos and 10 proofs allowed.'
        });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File size exceeds 10MB limit.'
        });
      }
      // Other multer errors
      return res.status(400).json({
        error: err.message || 'File upload error'
      });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const files = req.files as any;
    
    if (!files || (!files.photos && !files.proofs)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const photoUrls: string[] = [];
    const proofUrls: string[] = [];
    const azureConfigured = isAzureConfigured();

    // Process photos
    if (files.photos && Array.isArray(files.photos)) {
      for (const file of files.photos) {
        try {
          const fileName = path.basename(file.path);
          
          if (azureConfigured) {
            // Upload to Azure Blob Storage
            try {
              const fileBuffer = fs.readFileSync(file.path);
              const blobName = fileName;
              // console.log(`[Tenant Photo Upload] Uploading to Azure: ${blobName}`);
              await uploadAzureBlob(blobName, fileBuffer, 'image/' + path.extname(fileName).slice(1));
              photoUrls.push(blobName);
              // console.log(`[Tenant Photo Upload] Uploaded to Azure: ${blobName}`);
              
              // Clean up disk file after successful Azure upload
              fs.unlinkSync(file.path);
            } catch (azureError) {
              console.warn(`[Tenant Photo Upload] Azure upload failed, using fallback:`, azureError);
              // Fallback to disk - just store blob name
              photoUrls.push(fileName);
            }
          } else {
            // No Azure configured, just store blob name
            photoUrls.push(fileName);
          }
        } catch (fileError) {
          console.error(`Error processing photo file:`, fileError);
          throw fileError;
        }
      }
    }

    // Process proofs
    if (files.proofs && Array.isArray(files.proofs)) {
      for (const file of files.proofs) {
        try {
          const fileName = path.basename(file.path);
          // console.log(`[Tenant Proof Upload] Processing proof file: ${fileName}`);
          // console.log(azureConfigured ? '[Tenant Proof Upload] Azure is configured, attempting upload' : '[Tenant Proof Upload] Azure not configured, using fallback');
          if (azureConfigured) {
            // Upload to Azure Blob Storage
            try {
              const fileBuffer = fs.readFileSync(file.path);
              const blobName = fileName;
              await uploadAzureBlob(blobName, fileBuffer, 'image/' + path.extname(fileName).slice(1));
              proofUrls.push(blobName);
              console.log(`[Tenant Proof Upload] Uploaded to Azure: ${blobName}`);
              
              // Clean up disk file after successful Azure upload
              fs.unlinkSync(file.path);
            } catch (azureError) {
              console.warn(`[Tenant Proof Upload] Azure upload failed, using fallback:`, azureError);
              // Fallback to disk - just store blob name
              proofUrls.push(fileName);
            }
          } else {
            // No Azure configured, just store blob name
            proofUrls.push(fileName);
          }
        } catch (fileError) {
          console.error(`Error processing proof file:`, fileError);
          throw fileError;
        }
      }
    }

    // console.log('[Tenant Upload] Files uploaded successfully:', {
    //   photoCount: photoUrls.length,
    //   proofCount: proofUrls.length,
    //   photoUrls,
    //   proofUrls,
    //   azureConfigured
    // });

    res.status(200).json({ 
      message: 'Files uploaded successfully',
      photoUrls,
      proofUrls,
      uploadedToAzure: azureConfigured
    });
  } catch (error) {
    console.error('Tenant file upload error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to upload files',
      details: errorMessage
    });
  }
});

// Update tenant
app.put('/api/tenants/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      roomIds, checkInDate,
      name, phone, address, city, 
      photoUrl, photo2Url, photo3Url, photo4Url, photo5Url, photo6Url, photo7Url, photo8Url, photo9Url, photo10Url,
      proof1Url, proof2Url, proof3Url, proof4Url, proof5Url, proof6Url, proof7Url, proof8Url, proof9Url, proof10Url
    } = req.body;
    
    if (!name || !phone || !address || !city) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate phone format - must be exactly 10 digits
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      return res.status(400).json({ 
        error: 'Invalid phone format',
        details: `Phone number must be exactly 10 digits (received ${phoneDigits.length} digits)`
      });
    }
    
    const pool = getPool();
    const tenantId = parseInt(id);
    
    // Check if phone number already exists (excluding current tenant)
    const phoneCheckResult = await pool
      .request()
      .input('phone', sql.NChar(15), phone)
      .input('id', sql.Int, tenantId)
      .query(`SELECT COUNT(*) as count FROM Tenant WHERE TRIM(Phone) = TRIM(@phone) AND Id != @id`);
    
    if (phoneCheckResult.recordset[0].count > 0) {
      return res.status(400).json({ 
        error: 'Phone number already exists',
        details: `Phone number ${phone.trim()} is already used by another tenant.`
      });
    }

    const requestedRoomIds = Array.isArray(roomIds)
      ? Array.from(new Set(roomIds.map((value: any) => parseInt(value, 10)).filter((value: number) => Number.isInteger(value) && value > 0)))
      : [];

    if (requestedRoomIds.length > 0) {
      if (!checkInDate || typeof checkInDate !== 'string') {
        return res.status(400).json({ error: 'checkInDate is required when assigning roomIds' });
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(checkInDate)) {
        return res.status(400).json({ error: 'Invalid checkInDate format. Use YYYY-MM-DD.' });
      }

      if (new Date(checkInDate) > new Date()) {
        return res.status(400).json({ error: 'Check-in date cannot be in the future' });
      }

      const roomValidationResult = await pool
        .request()
        .input('tenantId', sql.Int, tenantId)
        .input('roomIdsCsv', sql.NVarChar(sql.MAX), requestedRoomIds.join(','))
        .query(`
          WITH RequestedRooms AS (
            SELECT DISTINCT TRY_CAST(value AS INT) AS RoomId
            FROM STRING_SPLIT(@roomIdsCsv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
          )
          SELECT
            rr.RoomId as roomId,
            rd.Number as roomNumber,
            CAST(ISNULL(rd.Rent, 0) AS FLOAT) as roomRent,
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM Occupancy oActive
                WHERE oActive.RoomId = rr.RoomId
                  AND (oActive.CheckOutDate IS NULL OR CAST(oActive.CheckOutDate AS DATE) > CAST(GETDATE() AS DATE))
                  AND oActive.TenantId <> @tenantId
              ) THEN 1
              ELSE 0
            END as occupiedByOther,
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM Occupancy oSame
                WHERE oSame.RoomId = rr.RoomId
                  AND oSame.TenantId = @tenantId
                  AND (oSame.CheckOutDate IS NULL OR CAST(oSame.CheckOutDate AS DATE) > CAST(GETDATE() AS DATE))
              ) THEN 1
              ELSE 0
            END as alreadyAssignedToTenant
          FROM RequestedRooms rr
          LEFT JOIN RoomDetail rd ON rd.Id = rr.RoomId
        `);

      const unknownRoomIds = roomValidationResult.recordset
        .filter((row: any) => !row.roomNumber)
        .map((row: any) => row.roomId);

      if (unknownRoomIds.length > 0) {
        return res.status(400).json({
          error: 'Some selected rooms do not exist',
          details: `Invalid room IDs: ${unknownRoomIds.join(', ')}`
        });
      }

      const occupiedRooms = roomValidationResult.recordset
        .filter((row: any) => row.occupiedByOther === 1)
        .map((row: any) => row.roomNumber);

      if (occupiedRooms.length > 0) {
        return res.status(400).json({
          error: 'Some selected rooms are currently occupied by another tenant',
          details: `Occupied room(s): ${occupiedRooms.join(', ')}`
        });
      }
    }

    // **FEATURE 2 & 3: Handle file deletion for removed photos/proofs**
    // Fetch existing tenant to get old blob names
    const existingTenantResult = await pool
      .request()
      .input('id', sql.Int, tenantId)
      .query(`SELECT PhotoUrl, Photo2Url, Photo3Url, Photo4Url, Photo5Url, Photo6Url, Photo7Url, Photo8Url, Photo9Url, Photo10Url,
                     Proof1Url, Proof2Url, Proof3Url, Proof4Url, Proof5Url, Proof6Url, Proof7Url, Proof8Url, Proof9Url, Proof10Url
              FROM Tenant WHERE Id = @id`);
    
    if (existingTenantResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const existingUrls = existingTenantResult.recordset[0];
    
    // Trim all URL values from database (NVarChar may have trailing spaces)
    const trimmedExistingUrls: any = {};
    for (const key in existingUrls) {
      trimmedExistingUrls[key] = existingUrls[key] ? String(existingUrls[key]).trim() : null;
    }
    
    const newUrls = {
      photoUrl, photo2Url, photo3Url, photo4Url, photo5Url, photo6Url, photo7Url, photo8Url, photo9Url, photo10Url,
      proof1Url, proof2Url, proof3Url, proof4Url, proof5Url, proof6Url, proof7Url, proof8Url, proof9Url, proof10Url
    };

    const azureConfigured = isAzureConfigured();
    // console.log(`[Tenant Update] Azure configured: ${azureConfigured}`);
    // console.log(`[Tenant Update] Existing URLs (trimmed):`, trimmedExistingUrls);
    // console.log(`[Tenant Update] New URLs:`, newUrls);

    // Delete files that are being removed (exist in old but not in new)
    const fieldsToCheck = [
      { dbField: 'PhotoUrl', newField: 'photoUrl' },
      { dbField: 'Photo2Url', newField: 'photo2Url' },
      { dbField: 'Photo3Url', newField: 'photo3Url' },
      { dbField: 'Photo4Url', newField: 'photo4Url' },
      { dbField: 'Photo5Url', newField: 'photo5Url' },
      { dbField: 'Photo6Url', newField: 'photo6Url' },
      { dbField: 'Photo7Url', newField: 'photo7Url' },
      { dbField: 'Photo8Url', newField: 'photo8Url' },
      { dbField: 'Photo9Url', newField: 'photo9Url' },
      { dbField: 'Photo10Url', newField: 'photo10Url' },
      { dbField: 'Proof1Url', newField: 'proof1Url' },
      { dbField: 'Proof2Url', newField: 'proof2Url' },
      { dbField: 'Proof3Url', newField: 'proof3Url' },
      { dbField: 'Proof4Url', newField: 'proof4Url' },
      { dbField: 'Proof5Url', newField: 'proof5Url' },
      { dbField: 'Proof6Url', newField: 'proof6Url' },
      { dbField: 'Proof7Url', newField: 'proof7Url' },
      { dbField: 'Proof8Url', newField: 'proof8Url' },
      { dbField: 'Proof9Url', newField: 'proof9Url' },
      { dbField: 'Proof10Url', newField: 'proof10Url' }
    ];

    for (const fieldMap of fieldsToCheck) {
      const oldBlobName = trimmedExistingUrls[fieldMap.dbField];
      const newBlobName = newUrls[fieldMap.newField as keyof typeof newUrls];

      // Extract just the filename from both old and new blob names for comparison
      // This handles cases where oldBlobName might be a full URL or path
      const oldFilename = oldBlobName ? oldBlobName.split('/').pop() : null;
      const newFilename = newBlobName ? newBlobName.split('/').pop() : null;

      // console.log(`[Tenant Update] Comparing field ${fieldMap.dbField}:`, {
      //   oldBlobName,
      //   newBlobName,
      //   oldFilename,
      //   newFilename,
      //   isChanged: oldFilename && oldFilename !== newFilename
      // });

      // If blob name existed and is now being removed (set to null or different blob name)
      // Only delete if there's actually a different filename
      if (oldFilename && oldFilename !== newFilename) {
        console.log(`[Tenant Update] ⚠️ Blob change detected for field ${fieldMap.dbField}: "${oldFilename}" !== "${newFilename}"`);
        
        if (azureConfigured) {
          // Delete from Azure Blob Storage
          try {
            // Use the original oldBlobName for Azure deletion (it should be just the blob name)
            console.log(`[Tenant Update] Attempting to delete from Azure: ${oldBlobName}`);
            await deleteAzureBlob(oldBlobName);
            console.log(`[Tenant Update] ✓ Successfully deleted from Azure: ${oldBlobName}`);
          } catch (deleteError) {
            const errorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
            console.error(`[Tenant Update] ✗ Failed to delete from Azure: ${oldBlobName} - ${errorMsg}`, deleteError);
            // Continue with update even if Azure delete fails
          }
        } else {
          // Delete from disk storage
          try {
            const tenantPhotosPath = process.env.TENANT_PHOTOS_DIR || 
              (process.env.NODE_ENV === 'production' ? '/app/tenantphotos' : path.resolve(process.cwd(), 'tenantphotos'));
            const filePath = path.join(tenantPhotosPath, oldFilename);
            
            
            console.log(`[Tenant Update] Attempting to delete from disk: ${filePath}`);
            
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`[Tenant Update] ✓ Successfully deleted from disk: ${oldBlobName}`);
            } else {
              console.warn(`[Tenant Update] File does not exist: ${filePath}`);
            }
          } catch (deleteError) {
            console.error(`[Tenant Update] ✗ Failed to delete disk file: ${oldBlobName}`, deleteError);
            // Continue with update even if disk delete fails
          }
        }
      }
    }

    // Update tenant record
    const result = await pool
      .request()
      .input('id', sql.Int, tenantId)
      .input('name', sql.NChar(100), name)
      .input('phone', sql.NChar(15), phone)
      .input('address', sql.NChar(100), address)
      .input('city', sql.NChar(50), city)
      .input('photoUrl', sql.NVarChar(sql.MAX), photoUrl || null)
      .input('photo2Url', sql.NVarChar(sql.MAX), photo2Url || null)
      .input('photo3Url', sql.NVarChar(sql.MAX), photo3Url || null)
      .input('photo4Url', sql.NVarChar(sql.MAX), photo4Url || null)
      .input('photo5Url', sql.NVarChar(sql.MAX), photo5Url || null)
      .input('photo6Url', sql.NVarChar(sql.MAX), photo6Url || null)
      .input('photo7Url', sql.NVarChar(sql.MAX), photo7Url || null)
      .input('photo8Url', sql.NVarChar(sql.MAX), photo8Url || null)
      .input('photo9Url', sql.NVarChar(sql.MAX), photo9Url || null)
      .input('photo10Url', sql.NVarChar(sql.MAX), photo10Url || null)
      .input('proof1Url', sql.NVarChar(sql.MAX), proof1Url || null)
      .input('proof2Url', sql.NVarChar(sql.MAX), proof2Url || null)
      .input('proof3Url', sql.NVarChar(sql.MAX), proof3Url || null)
      .input('proof4Url', sql.NVarChar(sql.MAX), proof4Url || null)
      .input('proof5Url', sql.NVarChar(sql.MAX), proof5Url || null)
      .input('proof6Url', sql.NVarChar(sql.MAX), proof6Url || null)
      .input('proof7Url', sql.NVarChar(sql.MAX), proof7Url || null)
      .input('proof8Url', sql.NVarChar(sql.MAX), proof8Url || null)
      .input('proof9Url', sql.NVarChar(sql.MAX), proof9Url || null)
      .input('proof10Url', sql.NVarChar(sql.MAX), proof10Url || null)
      .query(`
        UPDATE Tenant 
        SET Name = @name, Phone = @phone, Address = @address, City = @city,
            PhotoUrl = @photoUrl, Photo2Url = @photo2Url, Photo3Url = @photo3Url, Photo4Url = @photo4Url, Photo5Url = @photo5Url, Photo6Url = @photo6Url, Photo7Url = @photo7Url, Photo8Url = @photo8Url, Photo9Url = @photo9Url, Photo10Url = @photo10Url,
            Proof1Url = @proof1Url, Proof2Url = @proof2Url, Proof3Url = @proof3Url, Proof4Url = @proof4Url, Proof5Url = @proof5Url, Proof6Url = @proof6Url, Proof7Url = @proof7Url, Proof8Url = @proof8Url, Proof9Url = @proof9Url, Proof10Url = @proof10Url
        WHERE Id = @id
      `);
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    let createdOccupancies = 0;

    if (requestedRoomIds.length > 0) {
      const roomAssignmentRows = await pool
        .request()
        .input('tenantId', sql.Int, tenantId)
        .input('roomIdsCsv', sql.NVarChar(sql.MAX), requestedRoomIds.join(','))
        .query(`
          WITH RequestedRooms AS (
            SELECT DISTINCT TRY_CAST(value AS INT) AS RoomId
            FROM STRING_SPLIT(@roomIdsCsv, ',')
            WHERE TRY_CAST(value AS INT) IS NOT NULL
          )
          SELECT
            rr.RoomId as roomId,
            CAST(ISNULL(rd.Rent, 0) AS FLOAT) as roomRent
          FROM RequestedRooms rr
          INNER JOIN RoomDetail rd ON rd.Id = rr.RoomId
          WHERE NOT EXISTS (
            SELECT 1
            FROM Occupancy o
            WHERE o.RoomId = rr.RoomId
              AND o.TenantId = @tenantId
              AND (o.CheckOutDate IS NULL OR CAST(o.CheckOutDate AS DATE) > CAST(GETDATE() AS DATE))
          )
            AND NOT EXISTS (
            SELECT 1
            FROM Occupancy oActive
            WHERE oActive.RoomId = rr.RoomId
              AND (oActive.CheckOutDate IS NULL OR CAST(oActive.CheckOutDate AS DATE) > CAST(GETDATE() AS DATE))
              AND oActive.TenantId <> @tenantId
          )
        `);

      for (const row of roomAssignmentRows.recordset) {
        await pool
          .request()
          .input('tenantId', sql.Int, tenantId)
          .input('roomId', sql.Int, row.roomId)
          .input('checkInDate', sql.NChar(10), checkInDate)
          .input('rentFixed', sql.Decimal(10, 2), row.roomRent || 0)
          .query(`
            INSERT INTO Occupancy (TenantId, RoomId, CheckInDate, CheckOutDate, CreatedDate, UpdatedDate, RentFixed)
            VALUES (@tenantId, @roomId, @checkInDate, NULL, GETUTCDATE(), GETUTCDATE(), @rentFixed)
          `);

        createdOccupancies += 1;
      }
    }

    res.json({ message: 'Tenant updated successfully', deletedFiles: true, createdOccupancies });
  } catch (error) {
    console.error('Update tenant error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to update tenant',
      details: errorMessage
    });
  }
});

// Delete tenant
app.delete('/api/tenants/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    
    // First check if tenant has active occupancy
    const checkResult = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT COUNT(*) as count FROM Occupancy 
        WHERE TenantId = @id AND CheckOutDate IS NULL
      `);
    
    if (checkResult.recordset[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete tenant with active occupancy. Check out the tenant first.' 
      });
    }

    // Fetch tenant record to get all photo and proof URLs
    const tenantResult = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT PhotoUrl, Photo2Url, Photo3Url, Photo4Url, Photo5Url, Photo6Url, Photo7Url, Photo8Url, Photo9Url, Photo10Url,
               Proof1Url, Proof2Url, Proof3Url, Proof4Url, Proof5Url, Proof6Url, Proof7Url, Proof8Url, Proof9Url, Proof10Url
        FROM Tenant WHERE Id = @id
      `);

    if (tenantResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantResult.recordset[0];

    // Extract and delete all photo and proof files
    const filesToDelete = [
      tenant.PhotoUrl, tenant.Photo2Url, tenant.Photo3Url, tenant.Photo4Url, tenant.Photo5Url,
      tenant.Photo6Url, tenant.Photo7Url, tenant.Photo8Url, tenant.Photo9Url, tenant.Photo10Url,
      tenant.Proof1Url, tenant.Proof2Url, tenant.Proof3Url, tenant.Proof4Url, tenant.Proof5Url,
      tenant.Proof6Url, tenant.Proof7Url, tenant.Proof8Url, tenant.Proof9Url, tenant.Proof10Url
    ];

    // Delete each file from the tenantphotos directory
    for (const fileUrl of filesToDelete) {
      if (fileUrl) {
        try {
          // Extract filename from URL (e.g., "tenantphotos/filename.jpg" -> "filename.jpg")
          const fileName = fileUrl.split('/').pop();
          if (fileName) {
            const filePath = path.join(tenantPhotosDir, fileName);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log('[Tenant Delete] Deleted file:', filePath);
            }
          }
        } catch (fileErr) {
          console.warn('[Tenant Delete] Warning: Could not delete file:', fileUrl, (fileErr instanceof Error ? fileErr.message : String(fileErr)));
          // Don't throw error, just log warning and continue
        }
      }
    }

    // Delete tenant from database
    const deleteResult = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`DELETE FROM Tenant WHERE Id = @id`);
    
    if (deleteResult.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    console.log('[Tenant Delete] Tenant deleted successfully:', id);
    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Delete tenant error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to delete tenant',
      details: errorMessage
    });
  }
});

// Check in tenant to a room
app.post('/api/occupancy/checkin', async (req: Request, res: Response) => {
  try {
    const { tenantId, roomId, checkInDate, checkOutDate, rentFixed, depositReceived } = req.body;

    if (!tenantId || !roomId || !checkInDate || !checkOutDate) {
      return res.status(400).json({ 
        error: 'Tenant ID, Room ID, check-in date, and check-out date are required' 
      });
    }

    if (rentFixed === undefined || rentFixed === null || rentFixed <= 0) {
      return res.status(400).json({ 
        error: 'Rent fixed amount is required and must be greater than 0'
      });
    }

    // Validate depositReceived if provided
    if (depositReceived !== undefined && depositReceived !== null && parseFloat(depositReceived) < 0) {
      return res.status(400).json({ 
        error: 'Deposit received amount cannot be negative'
      });
    }

    // Validate that checkInDate is a valid date string (YYYY-MM-DD format)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkInDate)) {
      return res.status(400).json({ 
        error: 'Invalid check-in date format',
        details: 'Date must be in YYYY-MM-DD format'
      });
    }

    // Validate that check-in date is not in the future
    if (new Date(checkInDate) > new Date()) {
      return res.status(400).json({ 
        error: 'Check-in date cannot be in the future'
      });
    }

    // Validate checkout date format
    if (!dateRegex.test(checkOutDate)) {
      return res.status(400).json({ 
        error: 'Invalid check-out date format',
        details: 'Date must be in YYYY-MM-DD format'
      });
    }

    // Validate check-out date is after check-in date
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      return res.status(400).json({ 
        error: 'Check-out date must be after check-in date'
      });
    }

    const pool = getPool();

    // Verify tenant exists
    const tenantResult = await pool
      .request()
      .input('tenantId', sql.Int, tenantId)
      .query(`SELECT Id, Name FROM Tenant WHERE Id = @tenantId`);

    if (tenantResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Verify room exists
    const roomResult = await pool
      .request()
      .input('roomId', sql.Int, roomId)
      .query(`SELECT Id, Number FROM RoomDetail WHERE Id = @roomId`);

    if (roomResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Create new occupancy record with pro-rata rent calculation
    const insertResult = await pool
      .request()
      .input('tenantId', sql.Int, tenantId)
      .input('roomId', sql.Int, roomId)
      .input('checkInDate', sql.NChar(10), checkInDate)
      .input('checkOutDate', sql.NChar(10), checkOutDate)
      .input('rentFixed', sql.Decimal(10, 2), rentFixed)
      .input('depositReceived', sql.Money, depositReceived || 0)
      .query(`
        INSERT INTO Occupancy (TenantId, RoomId, CheckInDate, CheckOutDate, CreatedDate, UpdatedDate, RentFixed, DepositReceived)
        VALUES (@tenantId, @roomId, @checkInDate, @checkOutDate, GETUTCDATE(), GETUTCDATE(), @rentFixed, @depositReceived)
        SELECT SCOPE_IDENTITY() as id;
      `);

    const occupancyId = insertResult.recordset[0]?.id;

    if (!occupancyId) {
      return res.status(500).json({ error: 'Failed to create occupancy' });
    }

    // Calculate pro-rata rent based on check-in date
    const proRataCalculation = calculateCheckInProRataRent(checkInDate, rentFixed);
    
    // Record the pro-rata calculation for audit trail
    await recordProRataRentCalculation(
      occupancyId,
      checkInDate,
      checkOutDate,
      rentFixed,
      proRataCalculation.calculatedRent,
      proRataCalculation.occupancyDays,
      proRataCalculation.totalDaysInMonth,
      'check-in'
    );

    // Get the created occupancy details to return
    const detailsResult = await pool
      .request()
      .input('occupancyId', sql.Int, occupancyId)
      .query(`
        SELECT 
          o.Id as occupancyId,
          o.TenantId as tenantId,
          t.Name as tenantName,
          o.RoomId as roomId,
          rd.Number as roomNumber,
          o.CheckInDate as checkInDate,
          o.CheckOutDate as checkOutDate,
          rd.Rent as roomRent,
          ISNULL(CAST(o.RentFixed AS FLOAT), 0) as rentFixed,
          ISNULL(CAST(o.DepositReceived AS FLOAT), 0) as depositReceived,
          CASE WHEN o.CheckOutDate IS NULL OR o.CheckOutDate > CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END as isActive
        FROM Occupancy o
        JOIN Tenant t ON o.TenantId = t.Id
        JOIN RoomDetail rd ON o.RoomId = rd.Id
        WHERE o.Id = @occupancyId
      `);

    const occupancy = detailsResult.recordset[0];

    console.log(`[Occupancy Check-In] Tenant ${occupancy.tenantName} (ID: ${occupancy.tenantId}) checked in to Room ${occupancy.roomNumber} on ${checkInDate}`);
    console.log(`[Pro-Rata Rent] Full month rent: ₹${rentFixed}, Check-in pro-rata: ₹${proRataCalculation.calculatedRent} for ${proRataCalculation.occupancyDays} days out of ${proRataCalculation.totalDaysInMonth}`);

    res.json({ 
      message: 'Occupancy check-in completed successfully',
      occupancy: occupancy,
      proRataCalculation: {
        fullMonthRent: proRataCalculation.fullMonthRent,
        calculatedRent: proRataCalculation.calculatedRent,
        occupancyDays: proRataCalculation.occupancyDays,
        totalDaysInMonth: proRataCalculation.totalDaysInMonth,
        proRataPercentage: proRataCalculation.proRataPercentage,
        calculationNote: `Rent calculated pro-rata from ${checkInDate} to end of month (${proRataCalculation.occupancyDays} days out of ${proRataCalculation.totalDaysInMonth})`
      }
    });
  } catch (error) {
    console.error('Check-in occupancy error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to check in occupancy',
      details: errorMessage
    });
  }
});

// Checkout tenant from occupancy
app.post('/api/occupancy/:occupancyId/checkout', async (req: Request, res: Response) => {
  try {
    const { occupancyId } = req.params;
    const { checkOutDate, depositRefunded, charges } = req.body;

    if (!checkOutDate) {
      return res.status(400).json({ error: 'Checkout date is required' });
    }

    // Validate depositRefunded if provided
    if (depositRefunded !== undefined && depositRefunded !== null && parseFloat(depositRefunded) < 0) {
      return res.status(400).json({ 
        error: 'Deposit refunded amount cannot be negative'
      });
    }

    // Validate charges if provided
    if (charges !== undefined && charges !== null && parseFloat(charges) < 0) {
      return res.status(400).json({ 
        error: 'Charges amount cannot be negative'
      });
    }

    // Validate that checkOutDate is a valid date string (YYYY-MM-DD format)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(checkOutDate)) {
      return res.status(400).json({ 
        error: 'Invalid checkout date format',
        details: 'Date must be in YYYY-MM-DD format'
      });
    }

    const pool = getPool();
    
    // Verify occupancy exists and is currently active (CheckOutDate is NULL or in future)
    const checkResult = await pool
      .request()
      .input('occupancyId', sql.Int, parseInt(occupancyId))
      .query(`
        SELECT Id, TenantId, RoomId, CheckInDate, CheckOutDate FROM Occupancy 
        WHERE Id = @occupancyId
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Occupancy not found' });
    }

    const occupancy = checkResult.recordset[0];

    // Check if occupancy is already checked out
    if (occupancy.CheckOutDate && new Date(occupancy.CheckOutDate) <= new Date(checkOutDate)) {
      return res.status(400).json({ 
        error: 'Occupancy is already checked out or checkout date is invalid'
      });
    }

    // Validate checkout date is not before check-in date
    if (new Date(checkOutDate) < new Date(occupancy.CheckInDate)) {
      return res.status(400).json({ 
        error: 'Checkout date cannot be before check-in date'
      });
    }

    // Get the room rent for pro-rata calculation
    const roomResult = await pool
      .request()
      .input('roomId', sql.Int, occupancy.RoomId)
      .query(`SELECT Rent FROM RoomDetail WHERE Id = @roomId`);
    
    const roomRent = roomResult.recordset[0]?.Rent || 0;

    // Update occupancy with checkout date, deposit refunded, and charges
    const updateResult = await pool
      .request()
      .input('occupancyId', sql.Int, parseInt(occupancyId))
      .input('checkOutDate', sql.NChar(10), checkOutDate)
      .input('depositRefunded', sql.Money, depositRefunded || 0)
      .input('charges', sql.Money, charges || 0)
      .query(`
        UPDATE Occupancy 
        SET CheckOutDate = @checkOutDate, DepositRefunded = @depositRefunded, Charges = @charges, UpdatedDate = GETUTCDATE()
        WHERE Id = @occupancyId
      `);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(500).json({ error: 'Failed to update occupancy' });
    }

    // Calculate pro-rata rent based on checkout date
    const proRataCalculation = calculateCheckOutProRataRent(checkOutDate, roomRent);
    
    // Record the pro-rata calculation for audit trail
    await recordProRataRentCalculation(
      parseInt(occupancyId),
      occupancy.CheckInDate,
      checkOutDate,
      roomRent,
      proRataCalculation.calculatedRent,
      proRataCalculation.occupancyDays,
      proRataCalculation.totalDaysInMonth,
      'check-out'
    );

    // Get updated occupancy details to return to client
    const updatedResult = await pool
      .request()
      .input('occupancyId', sql.Int, parseInt(occupancyId))
      .query(`
        SELECT 
          o.Id as occupancyId,
          o.TenantId as tenantId,
          t.Name as tenantName,
          o.RoomId as roomId,
          rd.Number as roomNumber,
          o.CheckInDate as checkInDate,
          o.CheckOutDate as checkOutDate,
          ISNULL(CAST(o.DepositRefunded AS FLOAT), 0) as depositRefunded,
          ISNULL(CAST(o.Charges AS FLOAT), 0) as charges,
          CASE WHEN o.CheckOutDate IS NULL OR o.CheckOutDate > CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END as isActive
        FROM Occupancy o
        JOIN Tenant t ON o.TenantId = t.Id
        JOIN RoomDetail rd ON o.RoomId = rd.Id
        WHERE o.Id = @occupancyId
      `);

    const updatedOccupancy = updatedResult.recordset[0];

    console.log(`[Occupancy Checkout] Tenant ${updatedOccupancy.tenantName} (ID: ${updatedOccupancy.tenantId}) checked out from Room ${updatedOccupancy.roomNumber} on ${checkOutDate}`);
    console.log(`[Pro-Rata Rent] Full month rent: ₹${roomRent}, Checkout pro-rata: ₹${proRataCalculation.calculatedRent} for ${proRataCalculation.occupancyDays} days out of ${proRataCalculation.totalDaysInMonth}`);

    res.json({ 
      message: 'Occupancy checkout completed successfully',
      occupancy: updatedOccupancy,
      proRataCalculation: {
        fullMonthRent: proRataCalculation.fullMonthRent,
        calculatedRent: proRataCalculation.calculatedRent,
        occupancyDays: proRataCalculation.occupancyDays,
        totalDaysInMonth: proRataCalculation.totalDaysInMonth,
        proRataPercentage: proRataCalculation.proRataPercentage,
        calculationNote: `Rent calculated pro-rata from 1st to ${checkOutDate} (${proRataCalculation.occupancyDays} days out of ${proRataCalculation.totalDaysInMonth})`
      }
    });
  } catch (error) {
    console.error('Checkout occupancy error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to checkout occupancy',
      details: errorMessage
    });
  }
});

// Cache for Indian cities
let citiesCache: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Search Indian cities
app.get('/api/cities/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Missing query parameter',
        cities: []
      });
    }

    // Check if cache is still valid
    const now = Date.now();
    if (!citiesCache || (now - cacheTimestamp > CACHE_DURATION)) {
      console.log('[Cities] Fetching fresh city data from database');
      // Load cities from database (distinct cities from tenants)
      const pool = getPool();
      const result = await pool
        .request()
        .query(`
          SELECT DISTINCT LTRIM(RTRIM(City)) as city 
          FROM Tenant 
          WHERE City IS NOT NULL AND LTRIM(RTRIM(City)) != ''
          ORDER BY LTRIM(RTRIM(City)) ASC
        `);
      
      citiesCache = result.recordset.map((r: any) => r.city).filter(Boolean);
      cacheTimestamp = now;
      console.log('[Cities] Loaded', citiesCache.length, 'cities from database');
    }

    // Search in cache
    const searchTerm = query.toString().toLowerCase().trim();
    const filteredCities = citiesCache
      .filter(city => city.toLowerCase().includes(searchTerm))
      .slice(0, 50); // Limit to 50 results

    console.log('[Cities] Search results for "' + searchTerm + '":', filteredCities.length);

    res.json({ 
      cities: filteredCities,
      query: searchTerm,
      total: filteredCities.length
    });
  } catch (error) {
    console.error('Cities search error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to search cities',
      details: errorMessage,
      cities: []
    });
  }
});

// Search tenants
app.get('/api/tenants/search', async (req: Request, res: Response) => {
  try {
    const { field, query } = req.query;
    
    if (!field || !query) {
      return res.status(400).json({ error: 'Missing field or query parameter' });
    }
    
    const pool = getPool();
    const searchQuery = `%${query}%`;
    
    let sqlQuery = '';
    switch (field) {
      case 'name':
        sqlQuery = 'WHERE TRIM(t.Name) LIKE @query';
        break;
      case 'phone':
        sqlQuery = 'WHERE TRIM(t.Phone) LIKE @query';
        break;
      case 'city':
        sqlQuery = 'WHERE TRIM(t.City) LIKE @query';
        break;
      case 'address':
        sqlQuery = 'WHERE TRIM(t.Address) LIKE @query';
        break;
      default:
        return res.status(400).json({ error: 'Invalid search field' });
    }
    
    const result = await pool
      .request()
      .input('query', sql.NVarChar(sql.MAX), searchQuery)
      .query(`
        SELECT 
          t.Id as id,
          TRIM(t.Name) as name,
          TRIM(t.Phone) as phone,
          TRIM(t.Address) as address,
          TRIM(t.City) as city,
          t.PhotoUrl as photoUrl,
          t.Photo2Url as photo2Url,
          t.Photo3Url as photo3Url,
          t.Photo4Url as photo4Url,
          t.Photo5Url as photo5Url,
          t.Photo6Url as photo6Url,
          t.Photo7Url as photo7Url,
          t.Photo8Url as photo8Url,
          t.Photo9Url as photo9Url,
          t.Photo10Url as photo10Url,
          t.Proof1Url as proof1Url,
          t.Proof2Url as proof2Url,
          t.Proof3Url as proof3Url,
          t.Proof4Url as proof4Url,
          t.Proof5Url as proof5Url,
          t.Proof6Url as proof6Url,
          t.Proof7Url as proof7Url,
          t.Proof8Url as proof8Url,
          t.Proof9Url as proof9Url,
          t.Proof10Url as proof10Url,
          o.Id as occupancyId,
          rd.Number as roomNumber,
          o.CheckInDate,
          o.CheckOutDate,
          o.RentFixed,
          CASE WHEN o.CheckOutDate IS NULL THEN 1 ELSE 0 END as isCurrentlyOccupied
        FROM Tenant t
        LEFT JOIN Occupancy o ON t.Id = o.TenantId AND o.CheckOutDate IS NULL
        LEFT JOIN RoomDetail rd ON o.RoomId = rd.Id
        ${sqlQuery}
        ORDER BY t.Name ASC
      `);
    
    // **Transform blob names to Azure URLs**
    const transformedRecords = transformPhotoUrlsInArray(result.recordset);
    res.json(transformedRecords);
  } catch (error) {
    console.error('Search tenants error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to search tenants',
      details: errorMessage
    });
  }
});

// Complaints Management Endpoints

// Get all complaints with related data
app.get('/api/complaints', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        c.Id as id,
        c.Description as description,
        c.ComplaintTypeId as complaintTypeId,
        ct.Type as complaintTypeName,
        c.ComplaintStatusId as complaintStatusId,
        cs.Status as complaintStatusName,
        c.ClosedDate as closedDate,
        c.ClosureComments as closureComments,
        c.CreatedDate as createdDate,
        c.UpdatedDate as updatedDate,
        c.RoomId as roomId,
        rd.Number as roomNumber,
        ISNULL(CAST(c.Charges AS FLOAT), 0) as charges,
        c.ChargesDetails as chargesDetails,
        c.Proof1Url as proof1Url,
        c.Proof2Url as proof2Url,
        c.VideoUrl as videoUrl
      FROM Complains c
      INNER JOIN ComplainType ct ON c.ComplaintTypeId = ct.Id
      INNER JOIN ComplaintStatus cs ON c.ComplaintStatusId = cs.Id
      INNER JOIN RoomDetail rd ON c.RoomId = rd.Id
      ORDER BY c.CreatedDate DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Get complaints error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve complaints',
      details: errorMessage
    });
  }
});

// Get all complaint types
app.get('/api/complaints/types', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        Type as type,
        CreatedDate as createdDate,
        UpdatedDate as updatedDate
      FROM ComplainType
      ORDER BY Type ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Get complaint types error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve complaint types',
      details: errorMessage
    });
  }
});

// Get all complaint statuses
app.get('/api/complaints/statuses', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        Status as status
      FROM ComplaintStatus
      ORDER BY Status ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Get complaint statuses error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve complaint statuses',
      details: errorMessage
    });
  }
});

// Create a new complaint
app.post('/api/complaints', async (req: Request, res: Response) => {
  try {
    const {
      description,
      complaintTypeId,
      complaintStatusId,
      roomId,
      charges,
      chargesDetails,
      proof1Url,
      proof2Url,
      videoUrl
    } = req.body;

    // Validation
    if (!description || !complaintTypeId || !complaintStatusId || !roomId) {
      return res.status(400).json({
        error: 'Description, complaint type, status, and room are required'
      });
    }

    const pool = getPool();
    const result = await pool.request()
      .input('description', sql.NVarChar(sql.MAX), description)
      .input('complaintTypeId', sql.Int, complaintTypeId)
      .input('complaintStatusId', sql.Int, complaintStatusId)
      .input('roomId', sql.Int, roomId)
      .input('charges', sql.Decimal(10, 2), charges || 0)
      .input('chargesDetails', sql.NVarChar(sql.MAX), chargesDetails || null)
      .input('proof1Url', sql.NVarChar(sql.MAX), proof1Url || null)
      .input('proof2Url', sql.NVarChar(sql.MAX), proof2Url || null)
      .input('videoUrl', sql.NVarChar(sql.MAX), videoUrl || null)
      .query(`
        INSERT INTO Complains (
          Description, ComplaintTypeId, ComplaintStatusId, RoomId, 
          Charges, ChargesDetails, Proof1Url, Proof2Url, VideoUrl, 
          CreatedDate, UpdatedDate
        )
        VALUES (
          @description, @complaintTypeId, @complaintStatusId, @roomId,
          @charges, @chargesDetails, @proof1Url, @proof2Url, @videoUrl,
          GETDATE(), GETDATE()
        );
        SELECT SCOPE_IDENTITY() as id;
      `);

    const newId = result.recordset[0]?.id;
    res.status(201).json({
      message: 'Complaint created successfully',
      id: newId
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to create complaint',
      details: errorMessage
    });
  }
});

// Update a complaint
app.put('/api/complaints/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      description,
      complaintTypeId,
      complaintStatusId,
      roomId,
      closedDate,
      closureComments,
      charges,
      chargesDetails,
      proof1Url,
      proof2Url,
      videoUrl
    } = req.body;

    // Validation
    if (!description || !complaintTypeId || !complaintStatusId || !roomId) {
      return res.status(400).json({
        error: 'Description, complaint type, status, and room are required'
      });
    }

    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, parseInt(id))
      .input('description', sql.NVarChar(sql.MAX), description)
      .input('complaintTypeId', sql.Int, complaintTypeId)
      .input('complaintStatusId', sql.Int, complaintStatusId)
      .input('roomId', sql.Int, roomId)
      .input('closedDate', sql.DateTime, closedDate || null)
      .input('closureComments', sql.NVarChar(sql.MAX), closureComments || null)
      .input('charges', sql.Decimal(10, 2), charges || 0)
      .input('chargesDetails', sql.NVarChar(sql.MAX), chargesDetails || null)
      .input('proof1Url', sql.NVarChar(sql.MAX), proof1Url || null)
      .input('proof2Url', sql.NVarChar(sql.MAX), proof2Url || null)
      .input('videoUrl', sql.NVarChar(sql.MAX), videoUrl || null)
      .query(`
        UPDATE Complains
        SET
          Description = @description,
          ComplaintTypeId = @complaintTypeId,
          ComplaintStatusId = @complaintStatusId,
          RoomId = @roomId,
          ClosedDate = @closedDate,
          ClosureComments = @closureComments,
          Charges = @charges,
          ChargesDetails = @chargesDetails,
          Proof1Url = @proof1Url,
          Proof2Url = @proof2Url,
          VideoUrl = @videoUrl,
          UpdatedDate = GETDATE()
        WHERE Id = @id
      `);

    res.json({ message: 'Complaint updated successfully' });
  } catch (error) {
    console.error('Update complaint error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to update complaint',
      details: errorMessage
    });
  }
});

// Delete a complaint
app.delete('/api/complaints/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query('DELETE FROM Complains WHERE Id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json({ message: 'Complaint deleted successfully' });
  } catch (error) {
    console.error('Delete complaint error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
  }
});

// Upload complaint files
app.post('/api/complaints/upload', upload.fields([
  { name: 'proof1', maxCount: 1 },
  { name: 'proof2', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req: Request, res: Response) => {
  try {
    console.log('\n========== FILE UPLOAD REQUEST ==========');
    console.log('Complains directory:', complainsDir);
    console.log('Files received:', req.files);
    
    const uploadedFiles: { [key: string]: string | null } = {
      proof1Url: null,
      proof2Url: null,
      videoUrl: null
    };

    if (req.files && typeof req.files === 'object') {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files.proof1 && files.proof1[0]) {
        const proof1File = files.proof1[0];
        const filename = proof1File.filename;
        uploadedFiles.proof1Url = filename;
        const proof1Path = path.join(complainsDir, filename);
        console.log('Proof1 file saved at:', proof1Path);
        console.log('Proof1 file exists:', fs.existsSync(proof1Path));
        if (isAzureConfigured()) {
          try {
            const fileBuffer = fs.readFileSync(proof1Path);
            await uploadAzureBlobToContainer(AZURE_COMPLAINS_CONTAINER, filename, fileBuffer, proof1File.mimetype);
            fs.unlinkSync(proof1Path);
          } catch (azureError) {
            console.warn('[Complaint Upload] Azure upload failed for proof1, using local fallback:', azureError);
          }
        }
        if (fs.existsSync(proof1Path)) {
          fs.chmod(proof1Path, 0o644, (err) => {
            if (err) console.error('Failed to chmod proof1:', err);
            else console.log('Proof1 permissions set to 644');
          });
        }
      }
      if (files.proof2 && files.proof2[0]) {
        const proof2File = files.proof2[0];
        const filename = proof2File.filename;
        uploadedFiles.proof2Url = filename;
        const proof2Path = path.join(complainsDir, filename);
        console.log('Proof2 file saved at:', proof2Path);
        console.log('Proof2 file exists:', fs.existsSync(proof2Path));
        if (isAzureConfigured()) {
          try {
            const fileBuffer = fs.readFileSync(proof2Path);
            await uploadAzureBlobToContainer(AZURE_COMPLAINS_CONTAINER, filename, fileBuffer, proof2File.mimetype);
            fs.unlinkSync(proof2Path);
          } catch (azureError) {
            console.warn('[Complaint Upload] Azure upload failed for proof2, using local fallback:', azureError);
          }
        }
        if (fs.existsSync(proof2Path)) {
          fs.chmod(proof2Path, 0o644, (err) => {
            if (err) console.error('Failed to chmod proof2:', err);
            else console.log('Proof2 permissions set to 644');
          });
        }
      }
      if (files.video && files.video[0]) {
        const videoFile = files.video[0];
        const filename = videoFile.filename;
        uploadedFiles.videoUrl = filename;
        const videoPath = path.join(complainsDir, filename);
        console.log('Video file saved at:', videoPath);
        console.log('Video file exists:', fs.existsSync(videoPath));
        if (isAzureConfigured()) {
          try {
            const fileBuffer = fs.readFileSync(videoPath);
            await uploadAzureBlobToContainer(AZURE_COMPLAINS_CONTAINER, filename, fileBuffer, videoFile.mimetype);
            fs.unlinkSync(videoPath);
          } catch (azureError) {
            console.warn('[Complaint Upload] Azure upload failed for video, using local fallback:', azureError);
          }
        }
        if (fs.existsSync(videoPath)) {
          fs.chmod(videoPath, 0o644, (err) => {
            if (err) console.error('Failed to chmod video:', err);
            else console.log('Video permissions set to 644');
          });
        }
      }
    }

    console.log('Upload response:', uploadedFiles);
    console.log('=========================================\n');
    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles,
      servingUrls: {
        proof1: uploadedFiles.proof1Url ? `/api/complains/${uploadedFiles.proof1Url}` : null,
        proof2: uploadedFiles.proof2Url ? `/api/complains/${uploadedFiles.proof2Url}` : null,
        video: uploadedFiles.videoUrl ? `/api/complains/${uploadedFiles.videoUrl}` : null
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to upload files',
      details: errorMessage
    });
  }
});

// Service Details Management Endpoints

// Get all service details
app.get('/api/services/details', verifyToken, requireRole(['admin', 'manager', 'accountant']), async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        ConsumerNo as consumerNo,
        MeterNo as meterNo,
        Load as load,
        ServiceCategory as serviceCategory,
        ConsumerName as consumerName,
        CreatedDate as createdDate,
        UpdatedDate as updatedDate
      FROM ServiceDetails
      ORDER BY ConsumerName ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Get service details error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve service details',
      details: errorMessage
    });
  }
});

// Get single service detail
app.get('/api/services/details/:id', verifyToken, requireRole(['admin', 'manager', 'accountant']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT 
          Id as id,
          ConsumerNo as consumerNo,
          MeterNo as meterNo,
          Load as load,
          ServiceCategory as serviceCategory,
          ConsumerName as consumerName,
          CreatedDate as createdDate,
          UpdatedDate as updatedDate
        FROM ServiceDetails
        WHERE Id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Service detail not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Get service detail error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve service detail',
      details: errorMessage
    });
  }
});

// Create service detail
app.post('/api/services/details', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { consumerNo, meterNo, load, serviceCategory, consumerName } = req.body;
    
    if (!consumerNo || !meterNo || !load || !serviceCategory || !consumerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const pool = getPool();
    const result = await pool
      .request()
      .input('consumerNo', sql.NVarChar(50), consumerNo)
      .input('meterNo', sql.Int, meterNo)
      .input('load', sql.NVarChar(10), load)
      .input('serviceCategory', sql.NVarChar(50), serviceCategory)
      .input('consumerName', sql.NVarChar(100), consumerName)
      .query(`
        INSERT INTO ServiceDetails (ConsumerNo, MeterNo, Load, ServiceCategory, ConsumerName, CreatedDate, UpdatedDate)
        VALUES (@consumerNo, @meterNo, @load, @serviceCategory, @consumerName, GETDATE(), GETDATE());
        SELECT SCOPE_IDENTITY() as id;
      `);
    
    const serviceId = result.recordset[0].id;
    res.status(201).json({ 
      id: serviceId, 
      consumerNo,
      meterNo,
      load,
      serviceCategory,
      consumerName,
      createdDate: new Date().toISOString(),
      message: 'Service detail created successfully' 
    });
  } catch (error) {
    console.error('Create service detail error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to create service detail',
      details: errorMessage
    });
  }
});

// Update service detail
app.put('/api/services/details/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { consumerNo, meterNo, load, serviceCategory, consumerName } = req.body;
    
    if (!consumerNo || !meterNo || !load || !serviceCategory || !consumerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const pool = getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .input('consumerNo', sql.NVarChar(50), consumerNo)
      .input('meterNo', sql.Int, meterNo)
      .input('load', sql.NVarChar(10), load)
      .input('serviceCategory', sql.NVarChar(50), serviceCategory)
      .input('consumerName', sql.NVarChar(100), consumerName)
      .query(`
        UPDATE ServiceDetails 
        SET ConsumerNo = @consumerNo, MeterNo = @meterNo, Load = @load, 
            ServiceCategory = @serviceCategory, ConsumerName = @consumerName, UpdatedDate = GETDATE()
        WHERE Id = @id
      `);
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Service detail not found' });
    }
    
    res.json({ message: 'Service detail updated successfully' });
  } catch (error) {
    console.error('Update service detail error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to update service detail',
      details: errorMessage
    });
  }
});

// Delete service detail
app.delete('/api/services/details/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`DELETE FROM ServiceDetails WHERE Id = @id`);
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Service detail not found' });
    }
    
    res.json({ message: 'Service detail deleted successfully' });
  } catch (error) {
    console.error('Delete service detail error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to delete service detail',
      details: errorMessage
    });
  }
});

// EB Service Payments Management Endpoints

// Get all EB service payments
app.get('/api/services/payments', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        ServiceId as serviceId,
        ISNULL(CAST(BillAmount AS FLOAT), 0) as billAmount,
        BillDate as billDate,
        CreatedDate as createdDate,
        UpdatedDate as updatedDate,
        BilledUnits as billedUnits
      FROM EBServicePayments
      ORDER BY BillDate DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Get EB service payments error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve EB service payments',
      details: errorMessage
    });
  }
});

// Get single EB service payment
app.get('/api/services/payments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT 
          Id as id,
          ServiceId as serviceId,
          ISNULL(CAST(BillAmount AS FLOAT), 0) as billAmount,
          BillDate as billDate,
          CreatedDate as createdDate,
          UpdatedDate as updatedDate,
          BilledUnits as billedUnits
        FROM EBServicePayments
        WHERE Id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'EB service payment not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Get EB service payment error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve EB service payment',
      details: errorMessage
    });
  }
});

// Create EB service payment
app.post('/api/services/payments', async (req: Request, res: Response) => {
  try {
    const { serviceId, billAmount, billDate, billedUnits } = req.body;
    
    if (!serviceId || billAmount === undefined || !billDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const pool = getPool();
    const result = await pool
      .request()
      .input('serviceId', sql.Int, serviceId)
      .input('billAmount', sql.Money, billAmount)
      .input('billDate', sql.DateTime, billDate)
      .input('billedUnits', sql.Int, billedUnits || null)
      .query(`
        INSERT INTO EBServicePayments (ServiceId, BillAmount, BillDate, CreatedDate, UpdatedDate, BilledUnits)
        VALUES (@serviceId, @billAmount, @billDate, GETDATE(), GETDATE(), @billedUnits);
        SELECT SCOPE_IDENTITY() as id;
      `);
    
    const paymentId = result.recordset[0].id;
    res.status(201).json({ 
      id: paymentId, 
      serviceId,
      billAmount,
      billDate,
      billedUnits,
      createdDate: new Date().toISOString(),
      message: 'EB service payment created successfully' 
    });
  } catch (error) {
    console.error('Create EB service payment error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to create EB service payment',
      details: errorMessage
    });
  }
});

// Update EB service payment
app.put('/api/services/payments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { serviceId, billAmount, billDate, billedUnits } = req.body;
    
    if (!serviceId || billAmount === undefined || !billDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const pool = getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .input('serviceId', sql.Int, serviceId)
      .input('billAmount', sql.Money, billAmount)
      .input('billDate', sql.DateTime, billDate)
      .input('billedUnits', sql.Int, billedUnits || null)
      .query(`
        UPDATE EBServicePayments 
        SET ServiceId = @serviceId, BillAmount = @billAmount, BillDate = @billDate, 
            BilledUnits = @billedUnits, UpdatedDate = GETDATE()
        WHERE Id = @id
      `);
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'EB service payment not found' });
    }
    
    res.json({ message: 'EB service payment updated successfully' });
  } catch (error) {
    console.error('Update EB service payment error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to update EB service payment',
      details: errorMessage
    });
  }
});

// Delete EB service payment
app.delete('/api/services/payments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`DELETE FROM EBServicePayments WHERE Id = @id`);
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'EB service payment not found' });
    }
    
    res.json({ message: 'EB service payment deleted successfully' });
  } catch (error) {
    console.error('Delete EB service payment error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to delete EB service payment',
      details: errorMessage
    });
  }
});

// Get all rooms
app.get('/api/rooms', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        Number as number,
        ISNULL(CAST(Rent AS FLOAT), 0) as rent,
        Beds as beds
      FROM RoomDetail
      ORDER BY Number ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Get rooms error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve rooms',
      details: errorMessage
    });
  }
});

// Update room rent
app.put('/api/rooms/:id', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { rent } = req.body;

    // Validate input
    if (rent === undefined || rent === null) {
      return res.status(400).json({ error: 'Rent value is required' });
    }

    const rentValue = parseFloat(rent);
    if (isNaN(rentValue) || rentValue < 0) {
      return res.status(400).json({ error: 'Invalid rent amount' });
    }

    const pool = getPool();
    
    // Update the room
    await pool.request()
      .input('Id', roomId)
      .input('Rent', rentValue)
      .query(`
        UPDATE RoomDetail
        SET Rent = @Rent
        WHERE Id = @Id
      `);

    res.json({ 
      success: true,
      message: 'Room rent updated successfully',
      id: roomId,
      rent: rentValue
    });
  } catch (error) {
    console.error('Update room error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to update room rent',
      details: errorMessage
    });
  }
});

// ============ USER MANAGEMENT ENDPOINTS ============

// Get all users
app.get('/api/users', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        UserName as userName,
        Password as password,
        Name as name,
        CreatedDate as createdDate,
        UpdatedDate as updatedDate,
        NextLoginDuration as nextLoginDuration
      FROM [User]
      ORDER BY Name ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to retrieve users', details: error });
  }
});

// Get user by ID
app.get('/api/users/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          Id as id,
          UserName as userName,
          Password as password,
          Name as name,
          CreatedDate as createdDate,
          UpdatedDate as updatedDate,
          NextLoginDuration as nextLoginDuration
        FROM [User]
        WHERE Id = @id
      `);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve user', details: error });
  }
});

// Create user
app.post('/api/users', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { userName, password, name, nextLoginDuration } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('userName', sql.NVarChar(100), userName)
      .input('password', sql.NVarChar(500), password)
      .input('name', sql.NVarChar(500), name)
      .input('nextLoginDuration', sql.TinyInt, nextLoginDuration || 30)
      .query(`
        INSERT INTO [User] (UserName, Password, Name, CreatedDate, NextLoginDuration)
        VALUES (@userName, @password, @name, GETDATE(), @nextLoginDuration);
        SELECT SCOPE_IDENTITY() as id;
      `);
    res.status(201).json({ id: result.recordset[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user', details: error });
  }
});

// Update user
app.put('/api/users/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userName, password, name, nextLoginDuration } = req.body;
    const pool = getPool();
    
    const updateQuery = password 
      ? `UPDATE [User] SET UserName = @userName, Password = @password, Name = @name, NextLoginDuration = @nextLoginDuration, UpdatedDate = GETDATE() WHERE Id = @id`
      : `UPDATE [User] SET UserName = @userName, Name = @name, NextLoginDuration = @nextLoginDuration, UpdatedDate = GETDATE() WHERE Id = @id`;
    
    const req1 = pool.request()
      .input('id', sql.Int, id)
      .input('userName', sql.NVarChar(100), userName)
      .input('name', sql.NVarChar(500), name)
      .input('nextLoginDuration', sql.TinyInt, nextLoginDuration || 30);
    
    if (password) {
      req1.input('password', sql.NVarChar(500), password);
    }
    
    await req1.query(updateQuery);
    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user', details: error });
  }
});

// Delete user
app.delete('/api/users/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM [User] WHERE Id = @id');
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user', details: error });
  }
});

// ============ ROLE MANAGEMENT ENDPOINTS ============

// Get all roles
app.get('/api/roles', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        RoleName as roleName,
        RoleType as roleType
      FROM RoleDetail
      ORDER BY RoleName ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve roles', details: error });
  }
});

// Get role by ID
app.get('/api/roles/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          Id as id,
          RoleName as roleName,
          RoleType as roleType
        FROM RoleDetail
        WHERE Id = @id
      `);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve role', details: error });
  }
});

// Create role
app.post('/api/roles', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { roleName, roleType } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('roleName', sql.NVarChar(50), roleName)
      .input('roleType', sql.NVarChar(50), roleType)
      .query(`
        INSERT INTO RoleDetail (RoleName, RoleType)
        VALUES (@roleName, @roleType);
        SELECT SCOPE_IDENTITY() as id;
      `);
    res.status(201).json({ id: result.recordset[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create role', details: error });
  }
});

// Update role
app.put('/api/roles/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { roleName, roleType } = req.body;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('roleName', sql.NVarChar(50), roleName)
      .input('roleType', sql.NVarChar(50), roleType)
      .query('UPDATE RoleDetail SET RoleName = @roleName, RoleType = @roleType WHERE Id = @id');
    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role', details: error });
  }
});

// Delete role
app.delete('/api/roles/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM RoleDetail WHERE Id = @id');
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete role', details: error });
  }
});

// ============ USER ROLES ENDPOINTS ============

// Get all user roles
app.get('/api/user-roles', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        ur.Id as id,
        ur.UserId as userId,
        ur.RoleId as roleId,
        ur.CreatedDate as createdDate,
        ur.UpdatedDate as updatedDate,
        u.Name as userName,
        u.UserName as username,
        r.RoleName as roleName
      FROM UserRole ur
      LEFT JOIN [User] u ON ur.UserId = u.Id
      LEFT JOIN RoleDetail r ON ur.RoleId = r.Id
      ORDER BY u.Name ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve user roles', details: error });
  }
});

// Create user role
app.post('/api/user-roles', async (req: Request, res: Response) => {
  try {
    const { userId, roleId } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .input('roleId', sql.Int, roleId)
      .query(`
        INSERT INTO UserRole (UserId, RoleId, CreatedDate)
        VALUES (@userId, @roleId, GETDATE());
        SELECT SCOPE_IDENTITY() as id;
      `);
    res.status(201).json({ id: result.recordset[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user role', details: error });
  }
});

// Delete user role
app.delete('/api/user-roles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM UserRole WHERE Id = @id');
    res.json({ message: 'User role deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user role', details: error });
  }
});

// ============ TRANSACTION ENDPOINTS ============

// Get all transactions
app.get('/api/transactions', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        t.Id as id,
        t.Description as description,
        t.TransactionTypeId as transactionTypeId,
        t.TransactionDate as transactionDate,
        t.CreatedDate as createdDate,
        t.UpdatedDate as updatedDate,
        CAST(t.Amount AS FLOAT) as amount,
        t.OccupancyId as occupancyId,
        tt.TransactionType as 'transactionType.transactionType',
        tt.Id as 'transactionType.id'
      FROM Transactions t
      LEFT JOIN TransactionType tt ON t.TransactionTypeId = tt.Id
      ORDER BY t.TransactionDate DESC
    `);
    const formattedResult = result.recordset.map(row => ({
      id: row.id,
      description: row.description,
      transactionTypeId: row.transactionTypeId,
      transactionDate: row.transactionDate,
      createdDate: row.createdDate,
      updatedDate: row.updatedDate,
      amount: row.amount,
      occupancyId: row.occupancyId,
      transactionType: {
        id: row['transactionType.id'],
        transactionType: row['transactionType.transactionType']
      }
    }));
    res.json(formattedResult);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve transactions', details: error });
  }
});

// Get transaction by ID
app.get('/api/transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          t.Id as id,
          t.Description as description,
          t.TransactionTypeId as transactionTypeId,
          t.TransactionDate as transactionDate,
          t.CreatedDate as createdDate,
          t.UpdatedDate as updatedDate,
          CAST(t.Amount AS FLOAT) as amount,
          t.OccupancyId as occupancyId
        FROM Transactions t
        WHERE t.Id = @id
      `);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve transaction', details: error });
  }
});

// Create transaction
app.post('/api/transactions', async (req: Request, res: Response) => {
  try {
    const { description, transactionTypeId, transactionDate, amount, occupancyId } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('description', sql.NVarChar(500), description)
      .input('transactionTypeId', sql.Int, transactionTypeId)
      .input('transactionDate', sql.DateTime, transactionDate)
      .input('amount', sql.Money, amount)
      .input('occupancyId', sql.Int, occupancyId || null)
      .query(`
        INSERT INTO Transactions (Description, TransactionTypeId, TransactionDate, CreatedDate, Amount, OccupancyId)
        VALUES (@description, @transactionTypeId, @transactionDate, GETDATE(), @amount, @occupancyId);
        SELECT SCOPE_IDENTITY() as id;
      `);
    res.status(201).json({ id: result.recordset[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create transaction', details: error });
  }
});

// Update transaction
app.put('/api/transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description, transactionTypeId, transactionDate, amount, occupancyId } = req.body;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('description', sql.NVarChar(500), description)
      .input('transactionTypeId', sql.Int, transactionTypeId)
      .input('transactionDate', sql.DateTime, transactionDate)
      .input('amount', sql.Money, amount)
      .input('occupancyId', sql.Int, occupancyId || null)
      .query(`
        UPDATE Transactions 
        SET Description = @description, TransactionTypeId = @transactionTypeId, 
            TransactionDate = @transactionDate, Amount = @amount, OccupancyId = @occupancyId,
            UpdatedDate = GETDATE()
        WHERE Id = @id
      `);
    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update transaction', details: error });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM Transactions WHERE Id = @id');
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transaction', details: error });
  }
});

// Get transaction types
app.get('/api/transaction-types', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        TransactionType as transactionType
      FROM TransactionType
      ORDER BY TransactionType ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve transaction types', details: error });
  }
});

// ============ STOCK MANAGEMENT ENDPOINTS ============

// Get all stocks
app.get('/api/stock', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        [Name] as name,
        Description as description,
        Quantity as quantity,
        CreatedDate as createdDate,
        CreatedBy as createdBy,
        UpdatedDate as updatedDate,
        UpdatedBy as updatedBy,
        ImageURL as imageURL
      FROM StockDetails
      ORDER BY [Name] ASC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stock', details: error });
  }
});

// Get stock by ID
app.get('/api/stock/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          Id as id,
          [Name] as name,
          Description as description,
          Quantity as quantity,
          CreatedDate as createdDate,
          CreatedBy as createdBy,
          UpdatedDate as updatedDate,
          UpdatedBy as updatedBy,
          ImageURL as imageURL
        FROM StockDetails
        WHERE Id = @id
      `);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve stock', details: error });
  }
});

// Create stock
app.post('/api/stock', async (req: Request, res: Response) => {
  try {
    const { name, description, quantity, createdBy } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar(50), name)
      .input('description', sql.NVarChar(500), description || null)
      .input('quantity', sql.SmallInt, quantity)
      .input('createdBy', sql.VarChar(50), createdBy)
      .query(`
        INSERT INTO StockDetails ([Name], Description, Quantity, CreatedDate, CreatedBy)
        VALUES (@name, @description, @quantity, GETDATE(), @createdBy);
        SELECT SCOPE_IDENTITY() as id;
      `);
    res.status(201).json({ id: result.recordset[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create stock', details: error });
  }
});

// Update stock
app.put('/api/stock/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, quantity, updatedBy } = req.body;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(50), name)
      .input('description', sql.NVarChar(500), description || null)
      .input('quantity', sql.SmallInt, quantity)
      .input('updatedBy', sql.VarChar(50), updatedBy || 'Admin')
      .query(`
        UPDATE StockDetails 
        SET [Name] = @name, Description = @description, Quantity = @quantity, 
            UpdatedDate = GETDATE(), UpdatedBy = @updatedBy
        WHERE Id = @id
      `);
    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update stock', details: error });
  }
});

// Delete stock
app.delete('/api/stock/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM StockDetails WHERE Id = @id');
    res.json({ message: 'Stock deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete stock', details: error });
  }
});

// ============ DAILY STATUS ENDPOINTS ============

// Get all daily statuses
app.get('/api/daily-status', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        Id as id,
        [Date] as date,
        RoomStatus as roomStatus,
        WaterLevelStatus as waterLevelStatus,
        CreatedDate as createdDate
      FROM DailyRoomStatus
      ORDER BY Id DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve daily statuses', details: error });
  }
});

// Get daily status by ID
app.get('/api/daily-status/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          Id as id,
          [Date] as date,
          RoomStatus as roomStatus,
          WaterLevelStatus as waterLevelStatus,
          CreatedDate as createdDate
        FROM DailyRoomStatus
        WHERE Id = @id
      `);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Daily status not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve daily status', details: error });
  }
});

// Create daily status
app.post('/api/daily-status', async (req: Request, res: Response) => {
  try {
    const { date, roomStatus, waterLevelStatus } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('date', sql.DateTime, date)
      .input('roomStatus', sql.VarChar(1000), roomStatus || null)
      .input('waterLevelStatus', sql.VarChar(1000), waterLevelStatus || null)
      .query(`
        INSERT INTO DailyRoomStatus ([Date], RoomStatus, WaterLevelStatus, CreatedDate)
        VALUES (@date, @roomStatus, @waterLevelStatus, GETDATE());
        SELECT SCOPE_IDENTITY() as id;
      `);
    res.status(201).json({ id: result.recordset[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create daily status', details: error });
  }
});

// Update daily status
app.put('/api/daily-status/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, roomStatus, waterLevelStatus } = req.body;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('date', sql.DateTime, date)
      .input('roomStatus', sql.VarChar(1000), roomStatus || null)
      .input('waterLevelStatus', sql.VarChar(1000), waterLevelStatus || null)
      .query(`
        UPDATE DailyRoomStatus 
        SET [Date] = @date, RoomStatus = @roomStatus, WaterLevelStatus = @waterLevelStatus
        WHERE Id = @id
      `);
    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update daily status', details: error });
  }
});

// Delete daily status
app.delete('/api/daily-status/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM DailyRoomStatus WHERE Id = @id');
    res.json({ message: 'Daily status deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete daily status', details: error });
  }
});

// Get guest check-ins for a daily status
app.get('/api/daily-status/:id/guest-checkins', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.request()
      .input('dailyStatusId', sql.Int, parseInt(id))
      .query(`
        SELECT
          g.Id as id,
          g.DailyStatusId as dailyStatusId,
          g.GuestName as guestName,
          g.PhoneNumber as phoneNumber,
          g.Purpose as purpose,
          g.VisitingRoomNo as visitingRoomNo,
          ISNULL(CAST(g.RentAmount AS FLOAT), 0) as rentAmount,
          ISNULL(CAST(g.DepositAmount AS FLOAT), 0) as depositAmount,
          g.CheckInTime as checkInTime,
          g.CheckOutTime as checkOutTime,
          g.ProofUrl as proofUrl,
          g.PhotoUrl as photoUrl,
          g.CreatedDate as createdDate,
          g.UpdatedDate as updatedDate
        FROM DailyGuestCheckIn g
        WHERE g.DailyStatusId = @dailyStatusId
        ORDER BY g.CheckInTime DESC, g.Id DESC
      `);

    res.json(result.recordset.map(normalizeGuestCheckinFilesForResponse));
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve guest check-ins', details: error });
  }
});

const normalizeGuestPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
};

// Create guest check-in for a daily status
app.post('/api/daily-status/:id/guest-checkins', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { guestName, phoneNumber, purpose, visitingRoomNo, checkInTime, rentAmount, depositAmount, proofUrl, photoUrl } = req.body;
    const normalizedProofUrl = normalizeStoredFileName(proofUrl);
    const normalizedPhotoUrl = normalizeStoredFileName(photoUrl);

    if (!guestName || typeof guestName !== 'string' || !guestName.trim()) {
      return res.status(400).json({ error: 'Guest name is required' });
    }

    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const normalizedPhone = normalizeGuestPhoneNumber(phoneNumber.trim());
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    if (!purpose || typeof purpose !== 'string' || !purpose.trim()) {
      return res.status(400).json({ error: 'Purpose is required' });
    }

    if (rentAmount === undefined || rentAmount === null || rentAmount === '') {
      return res.status(400).json({ error: 'Rent amount is required' });
    }

    if (depositAmount === undefined || depositAmount === null || depositAmount === '') {
      return res.status(400).json({ error: 'Deposit amount is required' });
    }

    const parsedCheckInTime = checkInTime ? new Date(checkInTime) : new Date();
    if (isNaN(parsedCheckInTime.getTime())) {
      return res.status(400).json({ error: 'Invalid check-in time' });
    }

    const parsedRentAmount = rentAmount === undefined || rentAmount === null || rentAmount === ''
      ? 0
      : parseFloat(rentAmount);
    if (isNaN(parsedRentAmount) || parsedRentAmount < 0) {
      return res.status(400).json({ error: 'Rent amount must be a valid non-negative number' });
    }

    const parsedDepositAmount = depositAmount === undefined || depositAmount === null || depositAmount === ''
      ? 0
      : parseFloat(depositAmount);
    if (isNaN(parsedDepositAmount) || parsedDepositAmount < 0) {
      return res.status(400).json({ error: 'Deposit amount must be a valid non-negative number' });
    }

    const pool = getPool();

    const statusResult = await pool.request()
      .input('dailyStatusId', sql.Int, parseInt(id))
      .query('SELECT Id FROM DailyRoomStatus WHERE Id = @dailyStatusId');

    if (!statusResult.recordset.length) {
      return res.status(404).json({ error: 'Daily status not found' });
    }

    const insertResult = await pool.request()
      .input('dailyStatusId', sql.Int, parseInt(id))
      .input('guestName', sql.NVarChar(150), guestName.trim())
      .input('phoneNumber', sql.VarChar(25), normalizedPhone)
      .input('purpose', sql.NVarChar(500), purpose.trim())
      .input('visitingRoomNo', sql.VarChar(20), visitingRoomNo?.trim() || null)
      .input('rentAmount', sql.Decimal(10, 2), parsedRentAmount)
      .input('depositAmount', sql.Decimal(10, 2), parsedDepositAmount)
      .input('checkInTime', sql.DateTime, parsedCheckInTime)
      .input('proofUrl', sql.NVarChar(1000), normalizedProofUrl)
      .input('photoUrl', sql.NVarChar(1000), normalizedPhotoUrl)
      .query(`
        INSERT INTO DailyGuestCheckIn (
          DailyStatusId,
          GuestName,
          PhoneNumber,
          Purpose,
          VisitingRoomNo,
          RentAmount,
          DepositAmount,
          CheckInTime,
          ProofUrl,
          PhotoUrl,
          CreatedDate
        )
        VALUES (
          @dailyStatusId,
          @guestName,
          @phoneNumber,
          @purpose,
          @visitingRoomNo,
          @rentAmount,
          @depositAmount,
          @checkInTime,
          @proofUrl,
          @photoUrl,
          GETDATE()
        );

        SELECT
          Id as id,
          DailyStatusId as dailyStatusId,
          GuestName as guestName,
          PhoneNumber as phoneNumber,
          Purpose as purpose,
          VisitingRoomNo as visitingRoomNo,
          ISNULL(CAST(RentAmount AS FLOAT), 0) as rentAmount,
          ISNULL(CAST(DepositAmount AS FLOAT), 0) as depositAmount,
          CheckInTime as checkInTime,
          CheckOutTime as checkOutTime,
          ProofUrl as proofUrl,
          PhotoUrl as photoUrl,
          CreatedDate as createdDate,
          UpdatedDate as updatedDate
        FROM DailyGuestCheckIn
        WHERE Id = SCOPE_IDENTITY();
      `);

    res.status(201).json(normalizeGuestCheckinFilesForResponse(insertResult.recordset[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create guest check-in', details: error });
  }
});

// Update guest check-in (including check-out time)
app.put('/api/daily-status/:dailyStatusId/guest-checkins/:guestCheckinId', async (req: Request, res: Response) => {
  try {
    const { dailyStatusId, guestCheckinId } = req.params;
    const { guestName, phoneNumber, purpose, visitingRoomNo, checkInTime, checkOutTime, rentAmount, depositAmount, proofUrl, photoUrl } = req.body;

    const pool = getPool();

    const existingResult = await pool.request()
      .input('dailyStatusId', sql.Int, parseInt(dailyStatusId))
      .input('guestCheckinId', sql.Int, parseInt(guestCheckinId))
      .query(`
        SELECT *
        FROM DailyGuestCheckIn
        WHERE Id = @guestCheckinId AND DailyStatusId = @dailyStatusId
      `);

    if (!existingResult.recordset.length) {
      return res.status(404).json({ error: 'Guest check-in not found' });
    }

    const existing = existingResult.recordset[0];
    const nextGuestName = guestName !== undefined ? String(guestName).trim() : existing.GuestName;
    const nextPhoneNumber = phoneNumber !== undefined
      ? normalizeGuestPhoneNumber(String(phoneNumber).trim())
      : normalizeGuestPhoneNumber(String(existing.PhoneNumber || ''));
    const nextPurpose = purpose !== undefined ? String(purpose).trim() : existing.Purpose;
    const nextVisitingRoomNo = visitingRoomNo !== undefined ? String(visitingRoomNo).trim() : existing.VisitingRoomNo;
    const nextProofUrl = proofUrl !== undefined ? normalizeStoredFileName(proofUrl) : existing.ProofUrl;
    const nextPhotoUrl = photoUrl !== undefined ? normalizeStoredFileName(photoUrl) : existing.PhotoUrl;

    if (!nextGuestName) {
      return res.status(400).json({ error: 'Guest name is required' });
    }

    if (!nextPhoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(nextPhoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits' });
    }

    if (!nextPurpose) {
      return res.status(400).json({ error: 'Purpose is required' });
    }

    const nextCheckInTime = checkInTime !== undefined ? new Date(checkInTime) : new Date(existing.CheckInTime);
    if (isNaN(nextCheckInTime.getTime())) {
      return res.status(400).json({ error: 'Invalid check-in time' });
    }

    const nextCheckOutTime = checkOutTime === undefined
      ? existing.CheckOutTime
      : (checkOutTime ? new Date(checkOutTime) : null);

    const nextRentAmount = rentAmount !== undefined
      ? parseFloat(rentAmount)
      : parseFloat(existing.RentAmount ?? 0);
    if (isNaN(nextRentAmount) || nextRentAmount < 0) {
      return res.status(400).json({ error: 'Rent amount must be a valid non-negative number' });
    }

    if (rentAmount !== undefined && (rentAmount === null || rentAmount === '')) {
      return res.status(400).json({ error: 'Rent amount is required' });
    }

    const nextDepositAmount = depositAmount !== undefined
      ? parseFloat(depositAmount)
      : parseFloat(existing.DepositAmount ?? 0);
    if (isNaN(nextDepositAmount) || nextDepositAmount < 0) {
      return res.status(400).json({ error: 'Deposit amount must be a valid non-negative number' });
    }

    if (depositAmount !== undefined && (depositAmount === null || depositAmount === '')) {
      return res.status(400).json({ error: 'Deposit amount is required' });
    }

    if (nextCheckOutTime && isNaN(new Date(nextCheckOutTime).getTime())) {
      return res.status(400).json({ error: 'Invalid check-out time' });
    }

    if (nextCheckOutTime && new Date(nextCheckOutTime) < nextCheckInTime) {
      return res.status(400).json({ error: 'Check-out time cannot be earlier than check-in time' });
    }

    await pool.request()
      .input('guestCheckinId', sql.Int, parseInt(guestCheckinId))
      .input('guestName', sql.NVarChar(150), nextGuestName)
      .input('phoneNumber', sql.NVarChar(25), nextPhoneNumber || null)
      .input('purpose', sql.NVarChar(500), nextPurpose || null)
      .input('visitingRoomNo', sql.NVarChar(20), nextVisitingRoomNo || null)
      .input('rentAmount', sql.Decimal(10, 2), nextRentAmount)
      .input('depositAmount', sql.Decimal(10, 2), nextDepositAmount)
      .input('checkInTime', sql.DateTime, nextCheckInTime)
      .input('checkOutTime', sql.DateTime, nextCheckOutTime ? new Date(nextCheckOutTime) : null)
      .input('proofUrl', sql.NVarChar(1000), nextProofUrl)
      .input('photoUrl', sql.NVarChar(1000), nextPhotoUrl)
      .query(`
        UPDATE DailyGuestCheckIn
        SET
          GuestName = @guestName,
          PhoneNumber = @phoneNumber,
          Purpose = @purpose,
          VisitingRoomNo = @visitingRoomNo,
          RentAmount = @rentAmount,
          DepositAmount = @depositAmount,
          CheckInTime = @checkInTime,
          CheckOutTime = @checkOutTime,
          ProofUrl = @proofUrl,
          PhotoUrl = @photoUrl,
          UpdatedDate = GETDATE()
        WHERE Id = @guestCheckinId
      `);

    const updatedResult = await pool.request()
      .input('guestCheckinId', sql.Int, parseInt(guestCheckinId))
      .query(`
        SELECT
          Id as id,
          DailyStatusId as dailyStatusId,
          GuestName as guestName,
          PhoneNumber as phoneNumber,
          Purpose as purpose,
          VisitingRoomNo as visitingRoomNo,
          ISNULL(CAST(RentAmount AS FLOAT), 0) as rentAmount,
          ISNULL(CAST(DepositAmount AS FLOAT), 0) as depositAmount,
          CheckInTime as checkInTime,
          CheckOutTime as checkOutTime,
          ProofUrl as proofUrl,
          PhotoUrl as photoUrl,
          CreatedDate as createdDate,
          UpdatedDate as updatedDate
        FROM DailyGuestCheckIn
        WHERE Id = @guestCheckinId
      `);

    res.json(normalizeGuestCheckinFilesForResponse(updatedResult.recordset[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update guest check-in', details: error });
  }
});

// Upload proof/photo for a guest check-in
app.post('/api/daily-status/:dailyStatusId/guest-checkins/:guestCheckinId/upload',
  uploadGuestCheckin.fields([
    { name: 'proof', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    try {
      const { dailyStatusId, guestCheckinId } = req.params;

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const azureConfigured = isAzureConfigured();

      let proofUrl: string | null = null;
      let photoUrl: string | null = null;

      if (files.proof && files.proof[0]) {
        const file = files.proof[0];
        const fileName = path.basename(file.path);
        if (azureConfigured) {
          try {
            const fileBuffer = fs.readFileSync(file.path);
            await uploadAzureBlobToContainer(AZURE_GUEST_CHECKIN_CONTAINER, fileName, fileBuffer, file.mimetype);
            proofUrl = fileName;
            fs.unlinkSync(file.path);
          } catch (azureError) {
            console.warn('[Guest Checkin Upload] Azure upload failed for proof, using fallback:', azureError);
            proofUrl = fileName;
          }
        } else {
          proofUrl = fileName;
        }
      }

      if (files.photo && files.photo[0]) {
        const file = files.photo[0];
        const fileName = path.basename(file.path);
        if (azureConfigured) {
          try {
            const fileBuffer = fs.readFileSync(file.path);
            await uploadAzureBlobToContainer(AZURE_GUEST_CHECKIN_CONTAINER, fileName, fileBuffer, file.mimetype);
            photoUrl = fileName;
            fs.unlinkSync(file.path);
          } catch (azureError) {
            console.warn('[Guest Checkin Upload] Azure upload failed for photo, using fallback:', azureError);
            photoUrl = fileName;
          }
        } else {
          photoUrl = fileName;
        }
      }

      const pool = getPool();
      const guestCheckinIdInt = parseInt(guestCheckinId);
      const dailyStatusIdInt = parseInt(dailyStatusId);

      const existsResult = await pool.request()
        .input('dailyStatusId', sql.Int, dailyStatusIdInt)
        .input('guestCheckinId', sql.Int, guestCheckinIdInt)
        .query('SELECT Id FROM DailyGuestCheckIn WHERE Id = @guestCheckinId AND DailyStatusId = @dailyStatusId');

      if (!existsResult.recordset.length) {
        return res.status(404).json({ error: 'Guest check-in not found' });
      }

      // Atomic partial update to avoid race conditions when proof/photo upload in parallel.
      await pool.request()
        .input('dailyStatusId', sql.Int, dailyStatusIdInt)
        .input('guestCheckinId', sql.Int, guestCheckinIdInt)
        .input('proofUrl', sql.VarChar(1000), proofUrl)
        .input('photoUrl', sql.VarChar(1000), photoUrl)
        .query(`
          UPDATE DailyGuestCheckIn
          SET
            ProofUrl = COALESCE(@proofUrl, ProofUrl),
            PhotoUrl = COALESCE(@photoUrl, PhotoUrl),
            UpdatedDate = GETDATE()
          WHERE Id = @guestCheckinId AND DailyStatusId = @dailyStatusId
        `);

      const updatedResult = await pool.request()
        .input('dailyStatusId', sql.Int, dailyStatusIdInt)
        .input('guestCheckinId', sql.Int, guestCheckinIdInt)
        .query('SELECT ProofUrl, PhotoUrl FROM DailyGuestCheckIn WHERE Id = @guestCheckinId AND DailyStatusId = @dailyStatusId');

      const finalProofUrl = updatedResult.recordset[0]?.ProofUrl || null;
      const finalPhotoUrl = updatedResult.recordset[0]?.PhotoUrl || null;

      res.json({
        message: 'Files uploaded successfully',
        proofUrl: finalProofUrl,
        photoUrl: finalPhotoUrl,
        uploadedToAzure: azureConfigured
      });
    } catch (error) {
      console.error('[Guest Checkin Upload] Error:', error);
      res.status(500).json({ error: 'Failed to upload files', details: error });
    }
  }
);

// Delete guest check-in
app.delete('/api/daily-status/:dailyStatusId/guest-checkins/:guestCheckinId', async (req: Request, res: Response) => {
  try {
    const { dailyStatusId, guestCheckinId } = req.params;
    const pool = getPool();

    const existingResult = await pool.request()
      .input('dailyStatusId', sql.Int, parseInt(dailyStatusId))
      .input('guestCheckinId', sql.Int, parseInt(guestCheckinId))
      .query(`
        SELECT ProofUrl, PhotoUrl
        FROM DailyGuestCheckIn
        WHERE Id = @guestCheckinId AND DailyStatusId = @dailyStatusId
      `);

    if (!existingResult.recordset.length) {
      return res.status(404).json({ error: 'Guest check-in not found' });
    }

    const proofFileName = normalizeStoredFileName(existingResult.recordset[0].ProofUrl);
    const photoFileName = normalizeStoredFileName(existingResult.recordset[0].PhotoUrl);

    const deleteResult = await pool.request()
      .input('dailyStatusId', sql.Int, parseInt(dailyStatusId))
      .input('guestCheckinId', sql.Int, parseInt(guestCheckinId))
      .query(`
        DELETE FROM DailyGuestCheckIn
        WHERE Id = @guestCheckinId AND DailyStatusId = @dailyStatusId
      `);

    if (deleteResult.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Guest check-in not found' });
    }

    const filesToDelete = [proofFileName, photoFileName].filter((value): value is string => Boolean(value));

    for (const fileName of filesToDelete) {
      if (isAzureConfigured()) {
        try {
          await deleteAzureBlobFromContainer(fileName, AZURE_GUEST_CHECKIN_CONTAINER);
        } catch (deleteError) {
          console.error(`[Guest Checkin Delete] Failed to delete Azure blob: ${fileName}`, deleteError);
        }
      }

      const localFilePath = path.join(guestCheckinDir, path.basename(fileName));
      if (fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch (deleteError) {
          console.error(`[Guest Checkin Delete] Failed to delete local file: ${localFilePath}`, deleteError);
        }
      }
    }

    res.json({ message: 'Guest check-in deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete guest check-in', details: error });
  }
});

// ============ DAILY STATUS MEDIA ENDPOINTS ============

// Get media for a daily status
app.get('/api/daily-status/:id/media', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.request()
      .input('dailyStatusId', sql.Int, id)
      .query(`
        SELECT 
          Id as id,
          DailyStatusId as dailyStatusId,
          MediaType as mediaType,
          SequenceNumber as sequenceNumber,
          FileName as fileName,
          FilePath as filePath,
          FileSize as fileSize,
          MimeType as mimeType,
          UploadedDate as uploadedDate,
          CreatedBy as createdBy
        FROM DailyRoomStatusMedia
        WHERE DailyStatusId = @dailyStatusId
        ORDER BY MediaType ASC, SequenceNumber ASC
      `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve media', details: error });
  }
});

// Get media for a daily status
app.get('/api/all-media/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          Id as id,
          DailyStatusId as dailyStatusId,
          MediaType as mediaType,
          SequenceNumber as sequenceNumber,
          FileName as fileName,
          FilePath as filePath,
          FileSize as fileSize,
          MimeType as mimeType,
          UploadedDate as uploadedDate,
          CreatedBy as createdBy
        FROM DailyRoomStatusMedia
        ORDER BY MediaType ASC, SequenceNumber ASC
      `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve media', details: error });
  }
});

// Upload media for a daily status
app.post('/api/daily-status/upload', uploadDailyStatusMedia.array('files', 4), async (req: Request, res: Response) => {
  try {
    const { dailyStatusId, mediaType } = req.body;
    
    if (!dailyStatusId || !mediaType) {
      return res.status(400).json({ error: 'dailyStatusId and mediaType are required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const pool = getPool();
    const uploadedMedia = [];

    // Get the current max sequence number for this media type
    const seqResult = await pool.request()
      .input('dailyStatusId', sql.Int, dailyStatusId)
      .input('mediaType', sql.VarChar(50), mediaType)
      .query(`
        SELECT ISNULL(MAX(SequenceNumber), 0) as maxSeq
        FROM DailyRoomStatusMedia
        WHERE DailyStatusId = @dailyStatusId AND MediaType = @mediaType
      `);

    let sequenceNumber = (seqResult.recordset[0]?.maxSeq || 0) + 1;

    for (const file of req.files as Express.Multer.File[]) {
      // Limit to 2 per type
      if (sequenceNumber > 2) {
        // Delete the extra file
        fs.unlinkSync(file.path);
        continue;
      }

      const filePath = `/daily-status-media/${path.basename(file.path)}`;
      
      const insertResult = await pool.request()
        .input('dailyStatusId', sql.Int, dailyStatusId)
        .input('mediaType', sql.VarChar(50), mediaType)
        .input('sequenceNumber', sql.Int, sequenceNumber)
        .input('fileName', sql.VarChar(500), file.originalname)
        .input('filePath', sql.VarChar(1000), filePath)
        .input('fileSize', sql.BigInt, file.size)
        .input('mimeType', sql.VarChar(100), file.mimetype)
        .query(`
          INSERT INTO DailyRoomStatusMedia (DailyStatusId, MediaType, SequenceNumber, FileName, FilePath, FileSize, MimeType, UploadedDate)
          VALUES (@dailyStatusId, @mediaType, @sequenceNumber, @fileName, @filePath, @fileSize, @mimeType, GETDATE());
          SELECT SCOPE_IDENTITY() as id;
        `);

      uploadedMedia.push({
        id: insertResult.recordset[0].id,
        dailyStatusId,
        mediaType,
        sequenceNumber,
        fileName: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype
      });

      sequenceNumber++;
    }

    res.status(201).json({
      message: 'Media uploaded successfully',
      uploadedMedia
    });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ error: 'Failed to upload media', details: error });
  }
});

// Delete media file
app.delete('/api/daily-status/media/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Get the file path first
    const mediaResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT FilePath FROM DailyRoomStatusMedia WHERE Id = @id
      `);

    if (!mediaResult.recordset.length) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const filePath = mediaResult.recordset[0].FilePath;
    
    // Delete from database
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM DailyRoomStatusMedia WHERE Id = @id');

    // Delete the file from disk
    const fullPath = path.join(dailyStatusMediaDir, path.basename(filePath));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete media', details: error });
  }
});

// ============ SERVICE ALLOCATION ENDPOINTS ============

// Get all service allocations
app.get('/api/service-allocations', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        sa.Id as id,
        sa.ServiceId as serviceId,
        sa.RoomId as roomId,
        sd.ConsumerNo as 'service.consumerNo',
        sd.MeterNo as 'service.meterNo',
        sd.[Load] as 'service.load',
        sd.ServiceCategory as 'service.serviceCategory',
        sd.ConsumerName as 'service.consumerName',
        sd.Id as 'service.id',
        rd.Number as 'room.number',
        rd.Rent as 'room.rent',
        rd.Beds as 'room.beds',
        rd.Id as 'room.id'
      FROM ServiceRoomAllocation sa
      LEFT JOIN ServiceDetails sd ON sa.ServiceId = sd.Id
      LEFT JOIN RoomDetail rd ON sa.RoomId = rd.Id
      ORDER BY sd.ConsumerName, rd.Number ASC
    `);
    const formattedResult = result.recordset.map(row => ({
      id: row.id,
      serviceId: row.serviceId,
      roomId: row.roomId,
      service: {
        id: row['service.id'],
        consumerNo: row['service.consumerNo'],
        meterNo: row['service.meterNo'],
        load: row['service.load'],
        serviceCategory: row['service.serviceCategory'],
        consumerName: row['service.consumerName']
      },
      room: {
        id: row['room.id'],
        number: row['room.number'],
        rent: row['room.rent'],
        beds: row['room.beds']
      }
    }));
    res.json(formattedResult);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve service allocations', details: error });
  }
});

// Get service allocation by ID
app.get('/api/service-allocations/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          sa.Id as id,
          sa.ServiceId as serviceId,
          sa.RoomId as roomId
        FROM ServiceRoomAllocation sa
        WHERE sa.Id = @id
      `);
    if (!result.recordset.length) {
      return res.status(404).json({ error: 'Service allocation not found' });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve service allocation', details: error });
  }
});

// Create service allocation
app.post('/api/service-allocations', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { serviceId, roomId } = req.body;
    const pool = getPool();
    const result = await pool.request()
      .input('serviceId', sql.Int, serviceId)
      .input('roomId', sql.Int, roomId)
      .query(`
        INSERT INTO ServiceRoomAllocation (ServiceId, RoomId)
        VALUES (@serviceId, @roomId);
        SELECT SCOPE_IDENTITY() as id;
      `);
    res.status(201).json({ id: result.recordset[0].id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create service allocation', details: error });
  }
});

// Update service allocation
app.put('/api/service-allocations/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { serviceId, roomId } = req.body;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .input('serviceId', sql.Int, serviceId)
      .input('roomId', sql.Int, roomId)
      .query(`
        UPDATE ServiceRoomAllocation 
        SET ServiceId = @serviceId, RoomId = @roomId
        WHERE Id = @id
      `);
    res.json({ id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service allocation', details: error });
  }
});

// Delete service allocation
app.delete('/api/service-allocations/:id', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM ServiceRoomAllocation WHERE Id = @id');
    res.json({ message: 'Service allocation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service allocation', details: error });
  }
});

// Get service allocations with last payment details
app.get('/api/service-allocations-with-payments', verifyToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.request().query(`
      SELECT 
        sa.Id as id,
        sa.ServiceId as serviceId,
        sa.RoomId as roomId,
        sd.ConsumerNo as 'service.consumerNo',
        sd.MeterNo as 'service.meterNo',
        sd.[Load] as 'service.load',
        sd.ServiceCategory as 'service.serviceCategory',
        sd.ConsumerName as 'service.consumerName',
        sd.Id as 'service.id',
        rd.Number as 'room.number',
        rd.Rent as 'room.rent',
        rd.Beds as 'room.beds',
        rd.Id as 'room.id',
        esp.Id as 'lastPayment.id',
        esp.BillAmount as 'lastPayment.billAmount',
        esp.BillDate as 'lastPayment.billDate',
        esp.BilledUnits as 'lastPayment.billedUnits',
        esp.CreatedDate as 'lastPayment.createdDate'
      FROM ServiceRoomAllocation sa
      LEFT JOIN ServiceDetails sd ON sa.ServiceId = sd.Id
      LEFT JOIN RoomDetail rd ON sa.RoomId = rd.Id
      LEFT JOIN (
        SELECT Id, ServiceId, BillAmount, BillDate, BilledUnits, CreatedDate,
               ROW_NUMBER() OVER (PARTITION BY ServiceId ORDER BY BillDate DESC) as rn
        FROM EBServicePayments
      ) esp ON sa.ServiceId = esp.ServiceId AND esp.rn = 1
      ORDER BY sd.ConsumerName, rd.Number ASC
    `);
    const formattedResult = result.recordset.map(row => ({
      id: row.id,
      serviceId: row.serviceId,
      roomId: row.roomId,
      service: {
        id: row['service.id'],
        consumerNo: row['service.consumerNo'],
        meterNo: row['service.meterNo'],
        load: row['service.load'],
        serviceCategory: row['service.serviceCategory'],
        consumerName: row['service.consumerName']
      },
      room: {
        id: row['room.id'],
        number: row['room.number'],
        rent: row['room.rent'],
        beds: row['room.beds']
      },
      lastPayment: row['lastPayment.id'] ? {
        id: row['lastPayment.id'],
        billAmount: row['lastPayment.billAmount'],
        billDate: row['lastPayment.billDate'],
        billedUnits: row['lastPayment.billedUnits'],
        createdDate: row['lastPayment.createdDate']
      } : null
    }));
    res.json(formattedResult);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve service allocations with payments', details: error });
  }
});

// Get service allocations for meter reading (searchable)
app.get('/api/service-allocations-for-reading', verifyToken, requireRole(['admin', 'manager', 'utilities_manager']), async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const pool = getPool();
    
    let query = `
      SELECT 
        sra.Id as id,
        sra.ServiceId as serviceId,
        sra.RoomId as roomId,
        sd.Id as 'service.id',
        sd.ConsumerNo as 'service.consumerNo',
        sd.ConsumerName as 'service.consumerName',
        sd.MeterNo as 'service.meterNo',
        sd.Load as 'service.load',
        sd.ServiceCategory as 'service.serviceCategory',
        rd.Id as 'room.id',
        rd.Number as 'room.number',
        rd.Rent as 'room.rent',
        rd.Beds as 'room.beds',
        (SELECT TOP 1 scd.ReadingTakenDate 
         FROM ServiceConsumptionDetails scd 
         WHERE scd.ServiceAllocId = sra.Id 
         ORDER BY scd.ReadingTakenDate DESC) as lastReadingDate,
        (SELECT TOP 1 scd.EndingMeterReading 
         FROM ServiceConsumptionDetails scd 
         WHERE scd.ServiceAllocId = sra.Id 
         ORDER BY scd.ReadingTakenDate DESC) as lastEndingReading
      FROM ServiceRoomAllocation sra
      INNER JOIN ServiceDetails sd ON sra.ServiceId = sd.Id
      INNER JOIN RoomDetail rd ON sra.RoomId = rd.Id
    `;
    
    const request = pool.request();
    
    if (search) {
      query += ` WHERE rd.Number LIKE @search
                    OR sd.ConsumerName LIKE @search
                    OR sd.ConsumerNo LIKE @search`;
      request.input('search', sql.NVarChar(100), `%${search}%`);
    }
    
    query += ` ORDER BY rd.Number ASC, sd.ConsumerName ASC`;
    
    const result = await request.query(query);
    
    // Transform flat result into nested structure
    const transformedData = result.recordset.map((row: any) => ({
      id: row.id,
      serviceId: row.serviceId,
      roomId: row.roomId,
      lastReadingDate: row.lastReadingDate,
      lastEndingReading: row.lastEndingReading,
      service: {
        id: row['service.id'],
        consumerNo: row['service.consumerNo'],
        consumerName: row['service.consumerName'],
        meterNo: row['service.meterNo'],
        load: row['service.load'],
        serviceCategory: row['service.serviceCategory']
      },
      room: {
        id: row['room.id'],
        number: row['room.number'],
        rent: row['room.rent'],
        beds: row['room.beds']
      }
    }));
    
    res.json(transformedData);
  } catch (error) {
    console.error('Get service allocations for reading error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve service allocations',
      details: errorMessage
    });
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// Service Consumption endpoints

// Get previous month's ending meter reading for a service allocation
app.get('/api/service-consumption/previous-month-reading/:serviceAllocId/:month/:year', async (req: Request, res: Response) => {
  try {
    const { serviceAllocId, month, year } = req.params;
    const pool = getPool();
    
    // Calculate previous month
    let prevMonth = parseInt(month) - 1;
    let prevYear = parseInt(year);
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    
    const result = await pool
      .request()
      .input('serviceAllocId', sql.Int, parseInt(serviceAllocId))
      .input('prevYear', sql.Int, prevYear)
      .input('prevMonth', sql.Int, prevMonth)
      .query(`
        SELECT TOP 1
          scd.EndingMeterReading as endingMeterReading,
          scd.ReadingTakenDate as readingTakenDate
        FROM ServiceConsumptionDetails scd
        WHERE scd.ServiceAllocId = @serviceAllocId
          AND YEAR(scd.ReadingTakenDate) = @prevYear
          AND MONTH(scd.ReadingTakenDate) = @prevMonth
        ORDER BY scd.ReadingTakenDate DESC
      `);
    
    if (!res.headersSent) {
      res.json(result.recordset);
    }
  } catch (error) {
    console.error('Get previous month reading error:', error);
    if (!res.headersSent) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ 
        error: 'Failed to retrieve previous month reading',
        details: errorMessage
      });
    }
  }
});

// Get service consumption details
app.get('/api/service-consumption', async (req: Request, res: Response) => {
  try {
    const { serviceAllocId, startDate, endDate, roomId } = req.query;
    const pool = getPool();
    
    let query = `
      SELECT 
        scd.Id as id,
        scd.ServiceAllocId as serviceAllocId,
        sra.ServiceId as serviceId,
        sra.RoomId as roomId,
        rd.Number as roomNumber,
        sd.ConsumerNo as consumerNo,
        sd.ConsumerName as consumerName,
        sd.MeterNo as meterNo,
        scd.ReadingTakenDate as readingTakenDate,
        scd.StartingMeterReading as startingMeterReading,
        scd.EndingMeterReading as endingMeterReading,
        scd.UnitsConsumed as unitsConsumed,
        scd.AmountToBeCollected as amountToBeCollected,
        scd.UnitRate as unitRate,
        scd.MeterPhoto1Url as meterPhoto1Url,
        scd.MeterPhoto2Url as meterPhoto2Url,
        scd.MeterPhoto3Url as meterPhoto3Url,
        scd.CreatedDate as createdDate,
        scd.UpdatedDate as updatedDate
      FROM ServiceConsumptionDetails scd
      LEFT JOIN ServiceRoomAllocation sra ON scd.ServiceAllocId = sra.Id
      LEFT JOIN RoomDetail rd ON sra.RoomId = rd.Id
      LEFT JOIN ServiceDetails sd ON sra.ServiceId = sd.Id
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    if (serviceAllocId) {
      query += ` AND scd.ServiceAllocId = @serviceAllocId`;
      request.input('serviceAllocId', sql.Int, parseInt(serviceAllocId as string));
    }
    
    if (roomId) {
      query += ` AND sra.RoomId = @roomId`;
      request.input('roomId', sql.Int, parseInt(roomId as string));
    }
    
    if (startDate) {
      query += ` AND scd.ReadingTakenDate >= @startDate`;
      request.input('startDate', sql.DateTime, new Date(startDate as string));
    }
    
    if (endDate) {
      query += ` AND scd.ReadingTakenDate <= @endDate`;
      request.input('endDate', sql.DateTime, new Date(endDate as string));
    }
    
    query += ` ORDER BY scd.ReadingTakenDate DESC`;
    
    const result = await request.query(query);
    if (!res.headersSent) {
      res.json(result.recordset);
    }
  } catch (error) {
    console.error('Get service consumption error:', error);
    if (!res.headersSent) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ 
        error: 'Failed to retrieve service consumption details',
        details: errorMessage
      });
    }
  }
});


// Get service consumption by ID
app.get('/api/service-consumption/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        SELECT 
          scd.Id as id,
          scd.ServiceAllocId as serviceAllocId,
          sra.ServiceId as serviceId,
          sra.RoomId as roomId,
          rd.Number as roomNumber,
          sd.ConsumerNo as consumerNo,
          sd.ConsumerName as consumerName,
          sd.MeterNo as meterNo,
          scd.ReadingTakenDate as readingTakenDate,
          scd.StartingMeterReading as startingMeterReading,
          scd.EndingMeterReading as endingMeterReading,
          scd.UnitsConsumed as unitsConsumed,
          scd.AmountToBeCollected as amountToBeCollected,
          scd.UnitRate as unitRate,
          scd.MeterPhoto1Url as meterPhoto1Url,
          scd.MeterPhoto2Url as meterPhoto2Url,
          scd.MeterPhoto3Url as meterPhoto3Url,
          scd.CreatedDate as createdDate,
          scd.UpdatedDate as updatedDate
        FROM ServiceConsumptionDetails scd
        LEFT JOIN ServiceRoomAllocation sra ON scd.ServiceAllocId = sra.Id
        LEFT JOIN RoomDetail rd ON sra.RoomId = rd.Id
        LEFT JOIN ServiceDetails sd ON sra.ServiceId = sd.Id
        WHERE scd.Id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Service consumption detail not found' });
    }
    
    if (!res.headersSent) {
      res.json(result.recordset[0]);
    }
  } catch (error) {
    console.error('Get service consumption detail error:', error);
    if (!res.headersSent) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ 
        error: 'Failed to retrieve service consumption detail',
        details: errorMessage
      });
    }
  }
});

// Create service consumption
app.post('/api/service-consumption', async (req: Request, res: Response) => {
  try {
    const { 
      serviceAllocId, 
      roomId,
      readingTakenDate, 
      startingMeterReading, 
      endingMeterReading, 
      unitRate,
      isAutoFilledStartingReading
    } = req.body;
    
    // Validation
    if ((!serviceAllocId && !roomId) || !readingTakenDate || startingMeterReading === undefined || endingMeterReading === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields. Provide serviceAllocId or roomId, along with readingTakenDate, startingMeterReading and endingMeterReading.' 
      });
    }
    
    const pool = getPool();

    const parsedStartReading = Number(startingMeterReading);
    const parsedEndReading = Number(endingMeterReading);

    if (!Number.isFinite(parsedStartReading) || !Number.isFinite(parsedEndReading)) {
      return res.status(400).json({ error: 'Meter readings must be numeric values' });
    }

    if (parsedEndReading < parsedStartReading) {
      return res.status(400).json({ error: 'Ending meter reading cannot be less than starting meter reading' });
    }

    const readingDate = new Date(readingTakenDate);
    if (isNaN(readingDate.getTime())) {
      return res.status(400).json({ error: 'Invalid readingTakenDate' });
    }

    let resolvedServiceAllocId = serviceAllocId ? parseInt(serviceAllocId) : null;

    if (!resolvedServiceAllocId && roomId) {
      const roomAllocations = await pool
        .request()
        .input('roomId', sql.Int, parseInt(roomId))
        .query(`
          SELECT sra.Id as id
          FROM ServiceRoomAllocation sra
          WHERE sra.RoomId = @roomId
          ORDER BY sra.Id ASC
        `);

      if (roomAllocations.recordset.length === 0) {
        return res.status(400).json({ error: 'No service allocation found for this room' });
      }

      if (roomAllocations.recordset.length > 1) {
        return res.status(400).json({
          error: 'Multiple service allocations found for this room. Please provide serviceAllocId explicitly.'
        });
      }

      resolvedServiceAllocId = roomAllocations.recordset[0].id;
    }

    if (!resolvedServiceAllocId || Number.isNaN(resolvedServiceAllocId)) {
      return res.status(400).json({ error: 'Invalid service allocation' });
    }

    // Ensure only one meter reading is recorded per room/service allocation per month
    const existingMonthlyRecord = await pool
      .request()
      .input('serviceAllocId', sql.Int, resolvedServiceAllocId)
      .input('readingYear', sql.Int, readingDate.getFullYear())
      .input('readingMonth', sql.Int, readingDate.getMonth() + 1)
      .query(`
        SELECT TOP 1 Id as id, ReadingTakenDate as readingTakenDate
        FROM ServiceConsumptionDetails
        WHERE ServiceAllocId = @serviceAllocId
          AND YEAR(ReadingTakenDate) = @readingYear
          AND MONTH(ReadingTakenDate) = @readingMonth
        ORDER BY ReadingTakenDate DESC
      `);

    if (existingMonthlyRecord.recordset.length > 0) {
      return res.status(409).json({
        error: 'Monthly EB meter reading already exists for this room/service allocation',
        existingRecordId: existingMonthlyRecord.recordset[0].id,
        existingReadingTakenDate: existingMonthlyRecord.recordset[0].readingTakenDate
      });
    }
    
    // Calculate units consumed
    const unitsConsumed = parsedEndReading - parsedStartReading;
    const resolvedUnitRate = Number(unitRate) > 0 ? Number(unitRate) : 15;
    const amountToBeCollected = unitsConsumed * resolvedUnitRate;
    
    // Handle photo uploads - store photo URLs from request body
    const photoUrls: (string | null)[] = [null, null, null];
    if (req.body.meterPhoto1) photoUrls[0] = req.body.meterPhoto1;
    if (req.body.meterPhoto2) photoUrls[1] = req.body.meterPhoto2;
    if (req.body.meterPhoto3) photoUrls[2] = req.body.meterPhoto3;
    
    const request = pool.request()
      .input('serviceAllocId', sql.Int, resolvedServiceAllocId)
      .input('readingTakenDate', sql.DateTime, readingDate)
      .input('startingMeterReading', sql.Int, parsedStartReading)
      .input('endingMeterReading', sql.NVarChar(10), String(parsedEndReading))
      .input('unitsConsumed', sql.Int, Math.round(unitsConsumed))
      .input('amountToBeCollected', sql.Money, amountToBeCollected)
      .input('unitRate', sql.Money, resolvedUnitRate)
      .input('createdDate', sql.DateTime, new Date())
      .input('meterPhoto1Url', sql.NVarChar(sql.MAX), photoUrls[0] || null)
      .input('meterPhoto2Url', sql.NVarChar(sql.MAX), photoUrls[1] || null)
      .input('meterPhoto3Url', sql.NVarChar(sql.MAX), photoUrls[2] || null)
      .input('isAutoFilledStartingReading', sql.Bit, isAutoFilledStartingReading ? 1 : 0);
    
    const result = await request.query(`
      INSERT INTO ServiceConsumptionDetails (
        ServiceAllocId,
        ReadingTakenDate,
        StartingMeterReading,
        EndingMeterReading,
        UnitsConsumed,
        AmountToBeCollected,
        UnitRate,
        MeterPhoto1Url,
        MeterPhoto2Url,
        MeterPhoto3Url,
        IsAutoFilledStartingReading,
        CreatedDate
      )
      VALUES (
        @serviceAllocId,
        @readingTakenDate,
        @startingMeterReading,
        @endingMeterReading,
        @unitsConsumed,
        @amountToBeCollected,
        @unitRate,
        @meterPhoto1Url,
        @meterPhoto2Url,
        @meterPhoto3Url,
        @isAutoFilledStartingReading,
        @createdDate
      );
      SELECT SCOPE_IDENTITY() as id;
    `);
    
    const consumptionId = result.recordset[0].id;

    // Auto-generate tenant split charges for this monthly room reading.
    const chargeResult = await calculateProRataCharges(consumptionId, resolvedUnitRate);
    
    // Fetch the created record with all details
    const fetchResult = await pool
      .request()
      .input('id', sql.Int, consumptionId)
      .query(`
        SELECT 
          scd.Id as id,
          scd.ServiceAllocId as serviceAllocId,
          sra.ServiceId as serviceId,
          sra.RoomId as roomId,
          rd.Number as roomNumber,
          sd.ConsumerNo as consumerNo,
          sd.ConsumerName as consumerName,
          sd.MeterNo as meterNo,
          scd.ReadingTakenDate as readingTakenDate,
          scd.StartingMeterReading as startingMeterReading,
          scd.EndingMeterReading as endingMeterReading,
          scd.UnitsConsumed as unitsConsumed,
          scd.AmountToBeCollected as amountToBeCollected,
          scd.UnitRate as unitRate,
          scd.MeterPhoto1Url as meterPhoto1Url,
          scd.MeterPhoto2Url as meterPhoto2Url,
          scd.MeterPhoto3Url as meterPhoto3Url,
          scd.IsAutoFilledStartingReading as isAutoFilledStartingReading,
          scd.CreatedDate as createdDate,
          scd.UpdatedDate as updatedDate
        FROM ServiceConsumptionDetails scd
        LEFT JOIN ServiceRoomAllocation sra ON scd.ServiceAllocId = sra.Id
        LEFT JOIN RoomDetail rd ON sra.RoomId = rd.Id
        LEFT JOIN ServiceDetails sd ON sra.ServiceId = sd.Id
        WHERE scd.Id = @id
      `);
    
    if (!res.headersSent) {
      res.status(201).json({
        ...fetchResult.recordset[0],
        tenantChargeDistribution: {
          success: chargeResult.success,
          message: chargeResult.message,
          chargesCreated: chargeResult.chargesCreated || 0
        }
      });
    }
  } catch (error) {
    console.error('Create service consumption error:', error);
    if (!res.headersSent) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ 
        error: 'Failed to create service consumption detail',
        details: errorMessage
      });
    }
  }
});

// Delete service consumption
app.delete('/api/service-consumption/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    
    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .query(`
        DELETE FROM ServiceConsumptionDetails
        WHERE Id = @id
      `);
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Service consumption detail not found' });
    }
    
    if (!res.headersSent) {
      res.json({ message: 'Service consumption detail deleted successfully' });
    }
  } catch (error) {
    console.error('Delete service consumption error:', error);
    if (!res.headersSent) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ 
        error: 'Failed to delete service consumption detail',
        details: errorMessage
      });
    }
  }
});

// Rental Collection Detail Endpoints
// Get detailed rental collection records for an occupancy
app.get('/api/rental/occupancy/:occupancyId', async (req: Request, res: Response) => {
  try {
    const { occupancyId } = req.params;
    const pool = getPool();
    
    const result = await pool
      .request()
      .input('occupancyId', sql.Int, parseInt(occupancyId))
      .query(`
        SELECT 
          rc.Id as id,
          rc.OccupancyId as occupancyId,
          o.TenantId as tenantId,
          t.Name as tenantName,
          rd.Number as roomNumber,
          ISNULL(o.RentFixed, rd.Rent) as rentFixed,
          rc.RentReceivedOn as rentReceivedOn,
          rc.RentReceived as rentReceived,
          rc.Charges as charges,
          rc.RentBalance as rentBalance,
          rc.ModeofPayment as modeOfPayment,
          rc.screenshoturl as screenshotUrl,
          rc.folder as folder,
          rc.CreatedDate as createdDate,
          rc.UpdatedDate as updatedDate
        FROM RentalCollection rc
        INNER JOIN Occupancy o ON rc.OccupancyId = o.Id
        INNER JOIN Tenant t ON o.TenantId = t.Id
        INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
        WHERE rc.OccupancyId = @occupancyId
        ORDER BY rc.RentReceivedOn DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Get rental collection error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve rental collection details',
      details: errorMessage
    });
  }
});

// Upload payment screenshot and create/update rental collection record
app.post('/api/rental/upload-payment', uploadPaymentScreenshot.single('screenshot'), async (req: Request, res: Response) => {
  try {
    const { occupancyId, rentReceived, charges, modeOfPayment, rentReceivedOn } = req.body;
    
    if (!occupancyId || !rentReceived) {
      return res.status(400).json({ 
        error: 'Occupancy ID and Rent Received amount are required' 
      });
    }

    const paymentDate = rentReceivedOn || new Date().toISOString().split('T')[0];
    const paymentProofContainer = getPaymentProofContainerName(paymentDate);

    let screenshotUrl = '';
    if (req.file) {
      screenshotUrl = `/api/payments/${req.file.filename}`;

      if (isAzureConfigured()) {
        try {
          const fileBuffer = fs.readFileSync(req.file.path);

          screenshotUrl = await uploadAzureBlobToContainer(
            paymentProofContainer,
            req.file.filename,
            fileBuffer,
            req.file.mimetype
          );

          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn('Could not delete local payment proof after Azure upload:', cleanupError);
          }
        } catch (azureUploadError) {
          console.error('Azure upload failed for payment proof, using local storage path:', azureUploadError);
        }
      }
    }

    const pool = getPool();
    
    // Check if rental collection record exists for this occupancy and date
    const existingRecord = await pool
      .request()
      .input('occupancyId', sql.Int, parseInt(occupancyId))
      .input('rentReceivedOn', sql.NChar(10), paymentDate)
      .query(`
        SELECT Id FROM RentalCollection 
        WHERE OccupancyId = @occupancyId 
        AND RentReceivedOn = @rentReceivedOn
      `);

    let result;
    
    if (existingRecord.recordset.length > 0) {
      // Update existing record
      result = await pool
        .request()
        .input('id', sql.Int, existingRecord.recordset[0].Id)
        .input('rentReceived', sql.Money, parseFloat(rentReceived))
        .input('charges', sql.Money, charges ? parseFloat(charges) : 0)
        .input('modeOfPayment', sql.NVarChar(10), modeOfPayment || '')
        .input('screenshotUrl', sql.NVarChar(sql.MAX), screenshotUrl)
        .input('folder', sql.NVarChar(100), paymentProofContainer)
        .input('updateDate', sql.DateTime, new Date())
        .query(`
          UPDATE RentalCollection
          SET 
            RentReceived = @rentReceived,
            Charges = @charges,
            ModeofPayment = @modeOfPayment,
            screenshoturl = CASE WHEN @screenshotUrl != '' THEN @screenshotUrl ELSE screenshoturl END,
            folder = CASE WHEN @screenshotUrl != '' THEN @folder ELSE folder END,
            UpdatedDate = @updateDate
          WHERE Id = @id;
          
          SELECT Id, OccupancyId, RentReceivedOn, RentReceived, Charges, RentBalance, screenshoturl, folder
          FROM RentalCollection
          WHERE Id = @id
        `);
    } else {
      // Create new record
      result = await pool
        .request()
        .input('occupancyId', sql.Int, parseInt(occupancyId))
        .input('rentReceivedOn', sql.NChar(10), paymentDate)
        .input('rentReceived', sql.Money, parseFloat(rentReceived))
        .input('charges', sql.Money, charges ? parseFloat(charges) : 0)
        .input('modeOfPayment', sql.NVarChar(10), modeOfPayment || '')
        .input('screenshotUrl', sql.NVarChar(sql.MAX), screenshotUrl)
        .input('folder', sql.NVarChar(100), paymentProofContainer)
        .input('createDate', sql.DateTime, new Date())
        .query(`
          INSERT INTO RentalCollection 
          (OccupancyId, RentReceivedOn, RentReceived, Charges, ModeofPayment, screenshoturl, folder, CreatedDate)
          VALUES (@occupancyId, @rentReceivedOn, @rentReceived, @charges, @modeOfPayment, @screenshotUrl, @folder, @createDate);
          
          SELECT Id, OccupancyId, RentReceivedOn, RentReceived, Charges, RentBalance, screenshoturl, folder
          FROM RentalCollection
          WHERE Id = SCOPE_IDENTITY()
        `);
    }

    if (result.recordset.length > 0) {
      res.status(200).json({
        message: existingRecord.recordset.length > 0 ? 'Payment updated successfully' : 'Payment recorded successfully',
        data: result.recordset[0]
      });
    } else {
      throw new Error('Failed to save rental collection record');
    }
  } catch (error) {
    console.error('Upload payment error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to upload payment screenshot',
      details: errorMessage
    });
  }
});

// Get rental collection summary for a specific occupancy
app.get('/api/rental/occupancy/:occupancyId/summary', async (req: Request, res: Response) => {
  try {
    const { occupancyId } = req.params;
    const pool = getPool();
    
    const result = await pool
      .request()
      .input('occupancyId', sql.Int, parseInt(occupancyId))
      .query(`
        SELECT 
          o.Id as occupancyId,
          t.Name as tenantName,
          rd.Number as roomNumber,
          ISNULL(o.RentFixed, rd.Rent) as rentFixed,
          ISNULL(CAST(o.DepositReceived AS FLOAT), 0) as depositReceived,
          ISNULL(SUM(CAST(rc.RentReceived AS FLOAT)), 0) as totalRentReceived,
          ISNULL(SUM(CAST(rc.Charges AS FLOAT)), 0) as totalCharges,
          ISNULL(CAST(COALESCE(
            (SELECT TOP 1 CAST(RentBalance AS FLOAT) 
             FROM RentalCollection 
             WHERE OccupancyId = o.Id 
             AND YEAR(RentReceivedOn) = YEAR(GETDATE())
             AND MONTH(RentReceivedOn) = MONTH(GETDATE())
             ORDER BY RentReceivedOn DESC),
            0) AS FLOAT), 0) as currentMonthPending,
          COUNT(rc.Id) as paymentRecordsCount,
          MAX(rc.RentReceivedOn) as lastPaymentDate,
          o.CheckInDate as checkInDate,
          o.CheckOutDate as checkOutDate
        FROM Occupancy o
        INNER JOIN Tenant t ON o.TenantId = t.Id
        INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
        LEFT JOIN RentalCollection rc ON o.Id = rc.OccupancyId
        WHERE o.Id = @occupancyId
        GROUP BY o.Id, t.Name, rd.Number, o.RentFixed, o.DepositReceived, rd.Rent, o.CheckInDate, o.CheckOutDate
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Occupancy not found' });
    }
    
    const record = result.recordset[0];
    
    // Calculate pro-rata rent for current month based on check-in/check-out dates
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const rentFixed = record.rentFixed || 0;
    const checkInDate = record.checkInDate?.trim() || null;
    const checkOutDate = record.checkOutDate?.trim() || null;
    
    let proRataRent = rentFixed;
    
    try {
      if (checkInDate) {
        proRataRent = calculateProRataRentForMonth(
          checkInDate,
          checkOutDate,
          rentFixed,
          currentYear,
          currentMonth
        );
      }
    } catch (err) {
      console.error('Error calculating pro-rata rent:', err);
      proRataRent = rentFixed;
    }
    
    // Return response with proRataRent included
    res.json({
      ...record,
      proRataRent: Math.round(proRataRent * 100) / 100
    });
  } catch (error) {
    console.error('Get rental summary error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve rental summary',
      details: errorMessage
    });
  }
});

app.put('/api/rental/reviews/:occupancyId', verifyToken, requireRole(['admin', 'manager', 'accountant']), async (req: Request, res: Response) => {
  try {
    const occupancyId = parseInt(req.params.occupancyId, 10);
    const { monthYear, decision, comment } = req.body;
    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
    const normalizedDecision = decision === 'approved' || decision === 'rejected' ? decision : null;
    const currentUser = (req as any).user || {};
    const userRoles = Array.isArray(currentUser.roles)
      ? currentUser.roles
      : typeof currentUser.roles === 'string'
        ? currentUser.roles.split(',').map((role: string) => role.trim()).filter(Boolean)
        : [];
    const canChangeReviewDecision = userRoles.includes('admin') || userRoles.includes('accountant') || !userRoles.includes('manager');

    if (!Number.isInteger(occupancyId) || occupancyId <= 0) {
      return res.status(400).json({ error: 'Valid occupancy ID is required.' });
    }

    if (typeof monthYear !== 'string' || !/^\d{4}-\d{2}$/.test(monthYear)) {
      return res.status(400).json({ error: 'monthYear must be in YYYY-MM format.' });
    }

    const verifiedBy = ((req as any).user?.name || (req as any).user?.username || 'system').toString().trim();
    const pool = getPool();

    const occupancyResult = await pool
      .request()
      .input('occupancyId', sql.Int, occupancyId)
      .query('SELECT Id FROM Occupancy WHERE Id = @occupancyId');

    if (occupancyResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Occupancy not found.' });
    }

    const existingReview = await pool
      .request()
      .input('occupancyId', sql.Int, occupancyId)
      .input('reviewMonth', sql.NChar(7), monthYear)
      .query(`
        SELECT TOP 1
          Id,
          CASE
            WHEN IsVerified = 1 THEN 'approved'
            WHEN IsDisputeRaised = 1 THEN 'rejected'
            ELSE NULL
          END as reviewDecision
        FROM CollectionVerification
        WHERE OccupancyId = @occupancyId
          AND ReviewMonth = @reviewMonth
        ORDER BY VerifiedOn DESC, Id DESC
      `);

    const existingDecision = existingReview.recordset[0]?.reviewDecision || null;

    if (!canChangeReviewDecision && normalizedDecision !== existingDecision) {
      return res.status(403).json({ error: 'Managers can update comments only. Status changes are not allowed.' });
    }

    const finalDecision = canChangeReviewDecision ? normalizedDecision : existingDecision;

    const reviewQuery = existingReview.recordset.length > 0
      ? `
          UPDATE CollectionVerification
          SET
            Comments = @comments,
            VerifiedBy = @verifiedBy,
            VerifiedOn = GETDATE(),
            IsVerified = @isVerified,
            IsDisputeRaised = @isDisputeRaised,
            ReviewMonth = @reviewMonth
          WHERE Id = @reviewId;

          SELECT TOP 1
            OccupancyId as occupancyId,
            ReviewMonth as reviewMonth,
            CASE
              WHEN IsVerified = 1 THEN 'approved'
              WHEN IsDisputeRaised = 1 THEN 'rejected'
              ELSE NULL
            END as reviewDecision,
            Comments as reviewComment,
            VerifiedBy as reviewVerifiedBy,
            CONVERT(NVARCHAR(33), VerifiedOn, 126) as reviewVerifiedOn
          FROM CollectionVerification
          WHERE Id = @reviewId
        `
      : `
          INSERT INTO CollectionVerification
            (OccupancyId, Comments, VerifiedBy, VerifiedOn, IsVerified, IsDisputeRaised, ReviewMonth)
          VALUES
            (@occupancyId, @comments, @verifiedBy, GETDATE(), @isVerified, @isDisputeRaised, @reviewMonth);

          SELECT TOP 1
            OccupancyId as occupancyId,
            ReviewMonth as reviewMonth,
            CASE
              WHEN IsVerified = 1 THEN 'approved'
              WHEN IsDisputeRaised = 1 THEN 'rejected'
              ELSE NULL
            END as reviewDecision,
            Comments as reviewComment,
            VerifiedBy as reviewVerifiedBy,
            CONVERT(NVARCHAR(33), VerifiedOn, 126) as reviewVerifiedOn
          FROM CollectionVerification
          WHERE Id = SCOPE_IDENTITY()
        `;

    const reviewResult = await pool
      .request()
      .input('reviewId', sql.Int, existingReview.recordset[0]?.Id ?? null)
      .input('occupancyId', sql.Int, occupancyId)
      .input('reviewMonth', sql.NChar(7), monthYear)
      .input('comments', sql.NVarChar(200), trimmedComment || null)
      .input('verifiedBy', sql.NVarChar(100), verifiedBy)
      .input('isVerified', sql.Bit, finalDecision === 'approved')
      .input('isDisputeRaised', sql.Bit, finalDecision === 'rejected')
      .query(reviewQuery);

    res.json(reviewResult.recordset[0]);
  } catch (error) {
    console.error('Save rental review error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to save rental review',
      details: errorMessage
    });
  }
});

// Get tenant payment balance with pro-rata calculations
app.get('/api/rental/payment-balance', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    
    // Get all active occupancies with tenant and payment information
    const result = await pool
      .request()
      .query(`
        SELECT 
          o.Id as occupancyId,
          o.TenantId as tenantId,
          t.Name as tenantName,
          LTRIM(RTRIM(rd.Number)) as roomNumber,
          rd.Rent as roomRent,
          ISNULL(CAST(o.RentFixed AS FLOAT), rd.Rent) as rentFixed,
          LTRIM(RTRIM(o.CheckInDate)) as checkInDate,
          LTRIM(RTRIM(o.CheckOutDate)) as checkOutDate,
          CASE 
            WHEN o.CheckOutDate IS NULL OR LTRIM(RTRIM(o.CheckOutDate)) = '' THEN 1
            WHEN CAST(o.CheckOutDate AS DATE) > CAST(GETDATE() AS DATE) THEN 1
            ELSE 0
          END as isActive,
          ISNULL(SUM(CAST(rc.RentReceived AS FLOAT)), 0) as totalPaid,
          COUNT(rc.Id) as paymentCount,
          MAX(rc.RentReceivedOn) as lastPaymentDate
        FROM Occupancy o
        INNER JOIN Tenant t ON o.TenantId = t.Id
        INNER JOIN RoomDetail rd ON o.RoomId = rd.Id
        LEFT JOIN RentalCollection rc ON o.Id = rc.OccupancyId
        GROUP BY 
          o.Id, o.TenantId, t.Name, rd.Number, rd.Rent, 
          o.RentFixed, o.CheckInDate, o.CheckOutDate
        ORDER BY t.Name ASC
      `);
    
    // Process results to include pro-rata calculations
    const paymentBalances = result.recordset.map((record: any) => {
      const roomRent = record.rentFixed || record.roomRent || 0;
      
      // Calculate pro-rata values
      const checkInDate = record.checkInDate?.trim() || null;
      const checkOutDate = record.checkOutDate?.trim() || null;
      
      let checkInProRata = 0;
      let checkOutProRata = null;
      let expectedRent = roomRent;
      
      // Helper function to calculate days in month
      const getDaysInMonth = (date: Date): number => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      };
      
      // Helper function to add months to a date
      const addMonths = (date: Date, months: number): Date => {
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() + months);
        return newDate;
      };
      
      if (checkInDate && checkOutDate) {
        // Both check-in and check-out: calculate pro-rata for the entire period
        try {
          const checkIn = new Date(checkInDate);
          const checkOut = new Date(checkOutDate);
          let totalExpectedRent = 0;
          
          // Check-in month pro-rata
          const checkInCalculation = calculateCheckInProRataRent(checkInDate, roomRent);
          checkInProRata = Math.round(checkInCalculation.calculatedRent * 100) / 100;
          totalExpectedRent += checkInProRata;
          
          // Check-out month pro-rata
          const checkOutCalculation = calculateCheckOutProRataRent(checkOutDate, roomRent);
          checkOutProRata = Math.round(checkOutCalculation.calculatedRent * 100) / 100;
          
          // Add full months between check-in and check-out (if any)
          const checkInMonth = new Date(checkIn.getFullYear(), checkIn.getMonth(), 1);
          const checkOutMonth = new Date(checkOut.getFullYear(), checkOut.getMonth(), 1);
          
          // Only add intermediate full months if check-in and check-out are not in same or consecutive months
          let currentMonth = addMonths(checkInMonth, 1);
          while (currentMonth < checkOutMonth) {
            totalExpectedRent += roomRent; // Full month rent
            currentMonth = addMonths(currentMonth, 1);
          }
          
          // Add checkout month (only if different from check-in month)
          if (checkOutMonth > checkInMonth) {
            totalExpectedRent += checkOutProRata;
          }
          
          expectedRent = Math.round(totalExpectedRent * 100) / 100;
        } catch (err) {
          console.error('Error calculating checkout pro-rata:', err);
          expectedRent = roomRent;
        }
      } else if (checkInDate && !checkOutDate) {
        // Active occupancy: calculate from check-in to current date
        try {
          const checkIn = new Date(checkInDate);
          const today = new Date();
          let totalExpectedRent = 0;
          
          // Check-in month pro-rata
          const checkInCalculation = calculateCheckInProRataRent(checkInDate, roomRent);
          checkInProRata = Math.round(checkInCalculation.calculatedRent * 100) / 100;
          totalExpectedRent += checkInProRata;
          
          // Add full/partial months from month after check-in to current month
          const checkInMonth = new Date(checkIn.getFullYear(), checkIn.getMonth(), 1);
          const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          
          let iterMonth = addMonths(checkInMonth, 1);
          while (iterMonth < currentMonth) {
            totalExpectedRent += roomRent; // Full month rent
            iterMonth = addMonths(iterMonth, 1);
          }
          
          // Add current month pro-rata (from 1st to current date)
          if (currentMonth > checkInMonth) {
            const currentMonthDays = getDaysInMonth(today);
            const daysInCurrentMonth = today.getDate();
            const currentMonthProRata = Math.round((roomRent * daysInCurrentMonth) / currentMonthDays * 100) / 100;
            totalExpectedRent += currentMonthProRata;
          }
          
          expectedRent = Math.round(totalExpectedRent * 100) / 100;
        } catch (err) {
          console.error('Error calculating active occupancy pro-rata:', err);
          checkInProRata = roomRent;
          expectedRent = checkInProRata;
        }
      }
      
      // Calculate balance
      const totalPaid = parseFloat(record.totalPaid) || 0;
      const balance = expectedRent - totalPaid;
      
      // Determine status
      let balanceStatus = 'pending';
      if (balance <= 0) {
        balanceStatus = 'paid';
      } else if (totalPaid > 0) {
        balanceStatus = 'partial';
      }
      
      return {
        occupancyId: record.occupancyId,
        tenantId: record.tenantId,
        tenantName: record.tenantName?.trim() || '',
        roomNumber: record.roomNumber || '',
        roomRent: roomRent,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        isActive: record.isActive === 1,
        
        checkInProRata,
        checkOutProRata,
        expectedRent,
        
        totalPaid,
        balance: Math.round(Math.max(0, balance) * 100) / 100,
        balanceStatus,
        
        lastPaymentDate: record.lastPaymentDate,
        paymentCount: record.paymentCount || 0
      };
    });
    
    res.json(paymentBalances);
  } catch (error) {
    console.error('Get payment balance error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve payment balance data',
      details: errorMessage
    });
  }
});

// DEBUG: Test blob deletion endpoint
app.post('/api/debug/test-blob-delete', async (req: Request, res: Response) => {
  try {
    const { blobName } = req.body;
    
    if (!blobName) {
      return res.status(400).json({ error: 'blobName is required' });
    }

    const azureConfigured = isAzureConfigured();
    console.log(`[DEBUG] Azure configured: ${azureConfigured}`);
    
    if (!azureConfigured) {
      return res.status(400).json({ error: 'Azure not configured' });
    }

    console.log(`[DEBUG] Attempting to delete blob: ${blobName}`);
    
    try {
      await deleteAzureBlob(blobName);
      res.json({ success: true, message: `Deleted blob: ${blobName}` });
    } catch (deleteError) {
      const errorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
      console.error(`[DEBUG] Deletion failed:`, errorMsg);
      res.status(500).json({ success: false, error: errorMsg });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMsg });
  }
});

// =====================================================
// TENANT SERVICE CHARGES API ENDPOINTS
// =====================================================

// Calculate pro-rata charges for a service consumption record
app.post('/api/tenant-service-charges/calculate/:serviceConsumptionId', async (req: Request, res: Response) => {
  try {
    const { serviceConsumptionId } = req.params;
    const { chargePerUnit } = req.body;

    const result = await calculateProRataCharges(
      parseInt(serviceConsumptionId),
      chargePerUnit || 15.00
    );

    res.json({ 
      success: result.success, 
      message: result.message,
      chargesCreated: result.chargesCreated,
      serviceConsumptionId: parseInt(serviceConsumptionId)
    });
  } catch (error) {
    console.error('Calculate pro-rata charges error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to calculate pro-rata charges',
      details: errorMessage
    });
  }
});

// Get tenant charges for a specific month
app.get('/api/tenant-service-charges/:billingYear/:billingMonth', async (req: Request, res: Response) => {
  try {
    const { billingYear, billingMonth } = req.params;
    const { tenantId, roomId } = req.query;

    const charges = await getTenantChargesForMonth(
      parseInt(billingYear),
      parseInt(billingMonth),
      tenantId ? parseInt(tenantId as string) : undefined,
      roomId ? parseInt(roomId as string) : undefined
    );

    res.json(charges);
  } catch (error) {
    console.error('Get tenant charges error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve tenant charges',
      details: errorMessage
    });
  }
});

// Get room billing summary for a month
app.get('/api/room-billing-summary/:billingYear/:billingMonth', async (req: Request, res: Response) => {
  try {
    const { billingYear, billingMonth } = req.params;
    const { roomId } = req.query;

    const summary = await getRoomBillingsSummary(
      parseInt(billingYear),
      parseInt(billingMonth),
      roomId ? parseInt(roomId as string) : undefined
    );

    res.json(summary);
  } catch (error) {
    console.error('Get room billing summary error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve room billing summary',
      details: errorMessage
    });
  }
});

// Get monthly billing report
app.get('/api/monthly-billing-report/:billingYear/:billingMonth', async (req: Request, res: Response) => {
  try {
    const { billingYear, billingMonth } = req.params;

    const report = await getMonthlyBillingReport(
      parseInt(billingYear),
      parseInt(billingMonth)
    );

    res.json(report || {});
  } catch (error) {
    console.error('Get monthly billing report error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve monthly billing report',
      details: errorMessage
    });
  }
});

// Get detailed room-wise EB monthly report with meter readings and tenant splits
app.get('/api/eb-room-monthly-report/:billingYear/:billingMonth', async (req: Request, res: Response) => {
  try {
    const { billingYear, billingMonth } = req.params;
    const { roomId } = req.query;

    const report = await getRoomMonthlyEbReport(
      parseInt(billingYear),
      parseInt(billingMonth),
      roomId ? parseInt(roomId as string) : undefined
    );

    res.json({
      billingYear: parseInt(billingYear),
      billingMonth: parseInt(billingMonth),
      roomId: roomId ? parseInt(roomId as string) : null,
      data: report
    });
  } catch (error) {
    console.error('Get room monthly EB report error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to retrieve room monthly EB report',
      details: errorMessage
    });
  }
});

// Get tenant's monthly bill
app.get('/api/tenant-monthly-bill/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const bill = await getTenantMonthlyBill(parseInt(tenantId));

    res.json(bill);
  } catch (error) {
    console.error('Get tenant monthly bill error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve tenant monthly bill',
      details: errorMessage
    });
  }
});

// Recalculate all charges for a month (administrative function)
app.post('/api/tenant-service-charges/recalculate/:billingYear/:billingMonth', async (req: Request, res: Response) => {
  try {
    const { billingYear, billingMonth } = req.params;
    const { chargePerUnit } = req.body;

    const result = await recalculateMonthlyCharges(
      parseInt(billingYear),
      parseInt(billingMonth),
      chargePerUnit || 15.00
    );

    res.json({ 
      success: result.success, 
      message: result.message,
      servicesProcessed: result.servicesProcessed,
      totalChargesCreated: result.totalChargesCreated,
      billingPeriod: `${billingMonth}/${billingYear}`
    });
  } catch (error) {
    console.error('Recalculate monthly charges error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to recalculate monthly charges',
      details: errorMessage
    });
  }
});

// Get all tenant service charges (with pagination/filtering)
app.get('/api/tenant-service-charges', async (req: Request, res: Response) => {
  try {
    const { billingYear, billingMonth, tenantId, roomId, status, page = '1', limit = '50' } = req.query;
    const pool = getPool();
    
    let query = `
      SELECT 
        tsc.[Id],
        tsc.[ServiceConsumptionId],
        tsc.[TenantId],
        t.[Name] as TenantName,
        t.[Phone] as TenantPhone,
        tsc.[RoomId],
        rd.[Number] as RoomNumber,
        tsc.[ServiceId],
        sd.[ConsumerName] as ServiceName,
        sd.[MeterNo],
        tsc.[BillingMonth],
        tsc.[BillingYear],
        tsc.[TotalUnitsForRoom],
        tsc.[ProRataUnits],
        tsc.[ProRataPercentage],
        tsc.[ChargePerUnit],
        tsc.[TotalCharge],
        tsc.[OccupancyDaysInMonth],
        tsc.[TotalDaysInMonth],
        tsc.[Status],
        tsc.[CreatedDate],
        tsc.[UpdatedDate]
      FROM [dbo].[TenantServiceCharges] tsc
      INNER JOIN [dbo].[Tenant] t ON tsc.[TenantId] = t.[Id]
      INNER JOIN [dbo].[RoomDetail] rd ON tsc.[RoomId] = rd.[Id]
      INNER JOIN [dbo].[ServiceDetails] sd ON tsc.[ServiceId] = sd.[Id]
      WHERE 1=1
    `;
    
    const request = pool.request();
    
    if (billingYear) {
      query += ` AND tsc.[BillingYear] = @billingYear`;
      request.input('billingYear', sql.Int, parseInt(billingYear as string));
    }
    
    if (billingMonth) {
      query += ` AND tsc.[BillingMonth] = @billingMonth`;
      request.input('billingMonth', sql.Int, parseInt(billingMonth as string));
    }
    
    if (tenantId) {
      query += ` AND tsc.[TenantId] = @tenantId`;
      request.input('tenantId', sql.Int, parseInt(tenantId as string));
    }
    
    if (roomId) {
      query += ` AND tsc.[RoomId] = @roomId`;
      request.input('roomId', sql.Int, parseInt(roomId as string));
    }
    
    if (status) {
      query += ` AND tsc.[Status] = @status`;
      request.input('status', sql.NVarChar, status as string);
    }
    
    query += ` ORDER BY tsc.[BillingYear] DESC, tsc.[BillingMonth] DESC, tsc.[RoomId], tsc.[TenantId]`;
    
    const pageNum = parseInt(page as string) || 1;
    const pageSize = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * pageSize;
    
    query += ` OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
    
    const result = await request.query(query);
    res.json({
      data: result.recordset,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: result.recordset.length
      }
    });
  } catch (error) {
    console.error('Get tenant service charges error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to retrieve tenant service charges',
      details: errorMessage
    });
  }
});

// Update charge status (Calculated, Billed, Paid)
app.put('/api/tenant-service-charges/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const pool = getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, parseInt(id))
      .input('status', sql.NVarChar, status)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        UPDATE [dbo].[TenantServiceCharges]
        SET [Status] = @status,
            [Notes] = @notes,
            [UpdatedDate] = GETDATE()
        WHERE [Id] = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Tenant service charge record not found' });
    }

    res.json({ 
      success: true, 
      message: 'Charge status updated successfully'
    });
  } catch (error) {
    console.error('Update charge status error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to update charge status',
      details: errorMessage
    });
  }
});

// Start server
const startServer = async () => {
  try {
    await initializeDatabase();
    
    // Initialize Azure Blob Storage if configured
    initializeAzureClient();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Express server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await closeDatabase();
  process.exit(0);
});

startServer();

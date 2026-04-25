import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config: sql.config = {
  server: process.env.DB_SERVER || 'gnanabi.database.windows.net',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_DATABASE || 'mansion',
  user: process.env.DB_USER || 'servergnanaabi',
  password: process.env.DB_PASSWORD || 'serverpassword@123',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
};

let pool: sql.ConnectionPool;

export async function initializeDatabase(): Promise<void> {
  try {
    console.log(`Connecting to Azure SQL Server...`);
    console.log(`Server: ${config.server}, Database: ${config.database}`);
    
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✓ Successfully connected to Azure SQL Database');
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    console.error('Connection config:', {
      server: config.server,
      database: config.database,
      port: config.port,
      user: config.user,
      options: config.options
    });
    throw error;
  }
}

export function getPool(): sql.ConnectionPool {
  if (!pool) {
    throw new Error('Database connection pool not initialized');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.close();
    console.log('✓ Database connection closed');
  }
}

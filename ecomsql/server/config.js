const sql = require('mssql');

// SQL Azure Database configuration
const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    }
  },
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 20000,
    connectionTimeout: 20000,
    requestTimeout: 15000,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 1433
  }
};

console.log(`Connecting to SQL Azure: ${process.env.DB_SERVER}/${process.env.DB_NAME}`);

let pool;

async function getConnection() {
  if (!pool) {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('Database connected to SQL Azure successfully');
  }
  return pool;
}

module.exports = { getConnection, sql };


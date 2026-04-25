const sql = require('mssql');

const config = {
  server: 'localhost',
  database: 'ecommerce',
  authentication: {
    type: 'default',
    options: {
      userName: '',
      password: ''
    }
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    integratedSecurity: true
  }
};

async function checkUsers() {
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    
    const result = await pool.request().query(`
      SELECT u.Id, u.UserName, u.Name, rd.RoleType, rd.RoleName
      FROM [User] u
      LEFT JOIN UserRole ur ON u.Id = ur.UserId
      LEFT JOIN RoleDetail rd ON ur.RoleId = rd.Id
      ORDER BY u.CreatedDate DESC
    `);
    
    console.log('\n=== USERS IN DATABASE ===\n');
    result.recordset.forEach(user => {
      console.log(`ID: ${user.Id} | Username: ${user.UserName} | Name: ${user.Name} | Role: ${user.RoleType || 'NONE'}`);
    });
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkUsers();

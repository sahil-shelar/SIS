const mysql = require('mysql2/promise');

async function testDatabaseConnection() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Oggy@41414',
    database: 'login'
  });

  try {
    await connection.ping();
    console.log('Database connection successful!');
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    await connection.end();
  }
}

testDatabaseConnection();

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the database connection
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    console.log('✅ MySQL database connected');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL database connection failed:', err.message);
  }
}

testConnection();

export default pool; 
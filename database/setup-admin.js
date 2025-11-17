const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function setupAdmin() {
  const password = process.argv[2] || 'admin123';
  
  console.log('Generating password hash...');
  const hash = await bcrypt.hash(password, 10);
  console.log('Password hash:', hash);
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bluebeam_prototype',
  });

  try {
    await connection.execute(
      'UPDATE users SET password = ? WHERE username = ?',
      [hash, 'admin']
    );
    console.log('✅ Admin password updated successfully!');
    console.log('Username: admin');
    console.log('Password:', password);
  } catch (error) {
    console.error('❌ Error updating admin password:', error.message);
  } finally {
    await connection.end();
  }
}

setupAdmin();


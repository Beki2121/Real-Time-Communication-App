import pool from './db.js';
import bcrypt from 'bcrypt';

export async function registerUser({ username, full_name, email, password }) {
  const password_hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (username, full_name, email, password_hash) VALUES (?, ?, ?, ?)',
    [username, full_name, email, password_hash]
  );
  return { id: result.insertId, username, full_name, email };
}

export async function findUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
} 
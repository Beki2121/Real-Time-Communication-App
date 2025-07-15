import { registerUser, findUserByEmail } from '../models/user.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export async function register(req, res) {
  const { username, full_name, email, password } = req.body;
  if (!username || !full_name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const user = await registerUser({ username, full_name, email, password });
    res.status(201).json({ message: 'User registered', user: { id: user.id, username, full_name, email } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, full_name: user.full_name, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
} 
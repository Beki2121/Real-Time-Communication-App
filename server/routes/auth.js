import express from 'express';
import { register, login } from '../controllers/authController.js';
import authMiddleware from '../middleware/auth.js';
const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// Protected route example
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router; 
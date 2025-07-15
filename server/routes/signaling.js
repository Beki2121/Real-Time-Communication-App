import express from 'express';
const router = express.Router();

// Placeholder for REST signaling if needed
router.post('/signal', (req, res) => {
  res.json({ message: 'Signal endpoint' });
});

export default router; 
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import signalingRoutes from './routes/signaling.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/signaling', signalingRoutes);

app.get('/', (req, res) => res.send('RTC App Backend Running'));

export default app; 
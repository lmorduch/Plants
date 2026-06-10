import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import webpush from 'web-push';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { requireAuth } from './auth.js';
import authRouter from './routes/auth.js';
import plantsRouter from './routes/plants.js';
import logsRouter from './routes/logs.js';
import schedulesRouter from './routes/schedules.js';
import analyzeRouter from './routes/analyze.js';
import notificationsRouter from './routes/notifications.js';
import assistantRouter from './routes/assistant.js';
import { startCron } from './cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Configure web push VAPID keys
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@plantcare.app'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public routes — no auth required
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// All routes below require a valid app JWT
app.use(requireAuth);
app.use('/api/plants', plantsRouter);
app.use('/api/plants', logsRouter);
app.use('/api/plants', schedulesRouter);
app.use('/api/schedule', schedulesRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/assistant', assistantRouter);

initDb()
  .then(() => {
    startCron();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize DB:', err);
    process.exit(1);
  });

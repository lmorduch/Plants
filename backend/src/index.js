import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import plantsRouter from './routes/plants.js';
import logsRouter from './routes/logs.js';
import schedulesRouter from './routes/schedules.js';
import analyzeRouter from './routes/analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use('/api/plants', plantsRouter);
app.use('/api/plants', logsRouter);
app.use('/api/plants', schedulesRouter);
app.use('/api/schedule', schedulesRouter);
app.use('/api/analyze', analyzeRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize DB:', err);
    process.exit(1);
  });

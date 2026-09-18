/**
 * Ashraya API — Main Express 5 Server Entrypoint
 * Spec 3.architecture.md §6
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth.ts';
import { seatsRouter } from './routes/seats.ts';
import { bookingsRouter } from './routes/bookings.ts';
import { attendanceRouter } from './routes/attendance.ts';
import { gateRouter } from './routes/gate.ts';
import { validityRouter } from './routes/validity.ts';
import { waitlistRouter } from './routes/waitlist.ts';
import { startBackgroundWorkers } from './workers.ts';

const app = express();
const PORT = Number(process.env.API_PORT) || 8787;

// Security & Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health Check
app.get('/api/v1/healthz', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ashraya-api',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', seatsRouter);
app.use('/api/v1/bookings', bookingsRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/gate', gateRouter);
app.use('/api/v1/validity', validityRouter);
app.use('/api/v1/waitlist', waitlistRouter);

// Global Error Handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({
    ok: false,
    message: err.message || 'Internal server error',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ashraya API] Express 5 server listening on http://0.0.0.0:${PORT}`);
    startBackgroundWorkers();
  });
}

export { app };

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { withDatabaseConnection } from './db.js';

import authRouter from './auth.js';
import materialsRouter from './materials.js';
import inventoryRouter from './inventory.js';
import requestsRouter from './requests.js';
import teamsRouter from './teams.js';
import projectsRouter from './projects.js';
import reportsRouter from './reports.js';
import auditRouter from './auditRouter.js';
import notificationsRouter from './notificationsRouter.js';
import searchRouter from './search.js';
import settingsRouter from './settings.js';
import docsRouter from './docs.js';

const app = express();

const allowedOrigins = process.env.WEB_ORIGIN
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean) || [];
const vercelOrigins = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL
].filter((origin): origin is string => Boolean(origin)).map((origin) => `https://${origin}`);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || vercelOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by the API CORS policy.'));
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', withDatabaseConnection);

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/materials', materialsRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/material-requests', requestsRouter);
app.use('/api/v1/teams', teamsRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/docs', docsRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    system: 'Decko Materials Management System',
    timestamp: new Date().toISOString()
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API error:', error);
  if (res.headersSent) return;
  const errorCode = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
  if (errorCode.startsWith('08') || errorCode.startsWith('ECONN') ||
      ['ETIMEDOUT', '57P01', '53300'].includes(errorCode)) {
    res.status(503).json({
      success: false,
      message: 'The database is temporarily unavailable. Please try again shortly.',
      code: 'DATABASE_UNAVAILABLE'
    });
    return;
  }
  res.status(500).json({
    success: false,
    message: 'The API could not complete this request. Please try again.',
    code: 'INTERNAL_SERVER_ERROR'
  });
});

export default app;

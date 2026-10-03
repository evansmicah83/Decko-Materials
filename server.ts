import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './src/server/db.js';

import authRouter from './src/server/auth.js';
import materialsRouter from './src/server/materials.js';
import inventoryRouter from './src/server/inventory.js';
import requestsRouter from './src/server/requests.js';
import teamsRouter from './src/server/teams.js';
import projectsRouter from './src/server/projects.js';
import reportsRouter from './src/server/reports.js';
import auditRouter from './src/server/auditRouter.js';
import notificationsRouter from './src/server/notificationsRouter.js';
import searchRouter from './src/server/search.js';
import settingsRouter from './src/server/settings.js';
import docsRouter from './src/server/docs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database, schemas, and seeds
initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API v1 Routes
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

// API Documentation (OpenAPI / Swagger)
app.use('/api/docs', docsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    system: 'Decko Materials Management System',
    timestamp: new Date().toISOString()
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Decko Materials server running on http://0.0.0.0:${PORT}`);
    console.log(`API docs available at http://0.0.0.0:${PORT}/api/docs`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

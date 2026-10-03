import 'dotenv/config';
import { createServer as createViteServer } from 'vite';
import app from './src/server/app.js';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false
    },
    appType: 'spa'
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Decko Materials server running on http://0.0.0.0:${PORT}`);
    console.log(`API docs available at http://0.0.0.0:${PORT}/api/docs`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Fatal server startup error:', error);
  process.exitCode = 1;
});

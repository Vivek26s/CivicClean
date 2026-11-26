import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase } from './backend/config/database.ts';
import apiRouter from './backend/routes/api.ts';
import { UPLOADS_DIR } from './backend/middleware/upload.ts';
import { resolveSafeFilePath } from './backend/utils/security.ts';

async function startServer() {
  initializeDatabase();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Serve uploaded images with strict path confinement and security headers
  app.get('/uploads/:filename', (req: Request, res: Response) => {
    const fileName = path.basename(String(req.params.filename || ''));
    const safePath = resolveSafeFilePath(UPLOADS_DIR, fileName);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(safePath);
  });

  // Mount REST API
  app.use('/api', apiRouter);

  // API error handler (including multer upload validation errors)
  app.use('/api', (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('API Error:', err.message);
    res.status(400).json({ error: err.message || 'Request error.' });
  });

  // Serve frontend: Vite dev middleware in development, built dist in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CivicClean Smart City Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

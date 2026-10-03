import type { Request, Response } from 'express';
import app from '../src/server/app.js';

export default function handler(req: Request, res: Response) {
  const url = new URL(req.url ?? '/', `https://${req.headers.host ?? 'localhost'}`);
  const apiPath = url.searchParams.get('__path');

  if (!apiPath || !apiPath.startsWith('/api/')) {
    res.status(400).json({
      success: false,
      message: 'A valid API route is required.',
      code: 'INVALID_API_ROUTE'
    });
    return;
  }

  url.searchParams.delete('__path');
  req.url = `${apiPath}${url.search}`;
  app(req, res);
}

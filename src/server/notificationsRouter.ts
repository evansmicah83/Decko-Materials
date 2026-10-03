import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken } from './auth.js';
import { createAsyncRouter } from './asyncRouter.js';

const router = createAsyncRouter();

// GET /api/v1/notifications
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const notifications = await db.prepare(`
    SELECT id, user_id as userId, title, message, type, link, is_read as isRead, created_at as createdAt
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);

  const unreadCount = (await db.prepare('SELECT count(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id) as any)?.count || 0;

  return res.json({ success: true, unreadCount, notifications });
});

// POST /api/v1/notifications/:id/read
router.post('/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  return res.json({ success: true });
});

// POST /api/v1/notifications/read-all
router.post('/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  return res.json({ success: true });
});

export default router;

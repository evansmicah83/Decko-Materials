import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken, requireRole } from './auth.js';
import { logAuditEvent } from './audit.js';
import { createAsyncRouter } from './asyncRouter.js';

const router = createAsyncRouter();

// GET /api/v1/settings
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const settings = await db.prepare('SELECT key, value, description, updated_at as updatedAt FROM system_settings').all();
  const settingsMap: Record<string, string> = {};
  for (const s of settings as any[]) {
    settingsMap[s.key] = s.value;
  }
  return res.json({ success: true, settings: settingsMap });
});

// POST /api/v1/settings
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, message: 'Settings object required' });
  }

  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO system_settings (key, value, description, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  await db.exec('BEGIN TRANSACTION');
  try {
    for (const [k, v] of Object.entries(settings)) {
      await upsert.run(k, String(v), 'System setting', now);
    }
    await db.exec('COMMIT');
  } catch (err: any) {
    await db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Failed to update settings: ' + err.message });
  }

  await logAuditEvent({
    userId: req.user?.id,
    action: 'SETTINGS_UPDATED',
    entity: 'SystemSetting',
    entityId: 'global',
    ipAddress: req.ip,
    newValue: settings,
    reason: 'Admin updated system configuration'
  });

  return res.json({ success: true, message: 'Settings updated successfully' });
});

export default router;

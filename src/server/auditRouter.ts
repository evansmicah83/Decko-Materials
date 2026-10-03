import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken } from './auth.js';

const router = Router();

// GET /api/v1/audit-logs
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { action, entity, entityId, userId, limit } = req.query;

  let query = `
    SELECT al.id, al.user_id as userId, u.full_name as userName, u.email as userEmail,
           u.role as userRole, al.action, al.entity, al.entity_id as entityId,
           al.ip_address as ipAddress, al.user_agent as userAgent,
           al.previous_value as previousValue, al.new_value as newValue,
           al.reason, al.created_at as createdAt
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (action) {
    query += ' AND al.action = ?';
    params.push(action);
  }
  if (entity) {
    query += ' AND al.entity = ?';
    params.push(entity);
  }
  if (entityId) {
    query += ' AND al.entity_id = ?';
    params.push(entityId);
  }
  if (userId) {
    query += ' AND al.user_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY al.created_at DESC LIMIT ?';
  params.push(Number(limit) || 100);

  const logs = db.prepare(query).all(...params);
  return res.json({ success: true, count: logs.length, logs });
});

export default router;

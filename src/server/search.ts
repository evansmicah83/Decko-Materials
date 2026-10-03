import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken } from './auth.js';

const router = Router();

// GET /api/v1/search?q=query
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const query = (req.query.q as string || '').trim();
  if (!query || query.length < 2) {
    return res.json({ success: true, results: { requests: [], materials: [], serials: [], teams: [] } });
  }

  const q = `%${query}%`;

  // Search Requests
  const requests = db.prepare(`
    SELECT mr.id, mr.request_number as requestNumber, t.team_code as teamCode,
           mr.status, mr.reason, mr.created_at as createdAt, 'request' as type
    FROM material_requests mr
    JOIN teams t ON mr.team_id = t.id
    WHERE mr.request_number LIKE ? OR mr.work_order_ref LIKE ? OR mr.reason LIKE ?
    LIMIT 5
  `).all(q, q, q);

  // Search Materials
  const materials = db.prepare(`
    SELECT id, sku, name, current_stock as currentStock, unit, 'material' as type
    FROM materials
    WHERE sku LIKE ? OR name LIKE ?
    LIMIT 5
  `).all(q, q);

  // Search Serials / Tracked Units
  const serials = db.prepare(`
    SELECT tu.id, tu.serial_number as serialNumber, tu.status, m.name as materialName, 'serial' as type
    FROM tracked_units tu
    JOIN materials m ON tu.material_id = m.id
    WHERE tu.serial_number LIKE ? OR tu.barcode LIKE ? OR tu.safaricom_tag LIKE ?
    LIMIT 5
  `).all(q, q, q);

  // Search Teams
  const teams = db.prepare(`
    SELECT id, team_code as teamCode, name, assigned_area as assignedArea, 'team' as type
    FROM teams
    WHERE team_code LIKE ? OR name LIKE ? OR assigned_area LIKE ?
    LIMIT 5
  `).all(q, q, q);

  return res.json({
    success: true,
    results: {
      requests,
      materials,
      serials,
      teams
    }
  });
});

export default router;

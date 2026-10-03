import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken } from './auth.js';
import { createAsyncRouter } from './asyncRouter.js';

const router = createAsyncRouter();

// GET /api/v1/reports/summary (Executive & Management Overview)
router.get('/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'FIELD_TECHNICIAN' || req.user?.role === 'FIELD_TEAM_LEADER') {
    if (!req.user.teamId) {
      return res.status(403).json({ success: false, message: 'Your account is not assigned to a field team.', code: 'TEAM_REQUIRED' });
    }
    const teamId = req.user.teamId;
    const activeTeams = (await db.prepare("SELECT count(*) as count FROM teams WHERE id = ? AND status = 'ACTIVE'").get(teamId) as any)?.count || 0;
    const pendingRequests = (await db.prepare("SELECT count(*) as count FROM material_requests WHERE team_id = ? AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED')").get(teamId) as any)?.count || 0;
    const readyForIssueCount = (await db.prepare("SELECT count(*) as count FROM material_requests WHERE team_id = ? AND status IN ('READY_FOR_ISSUE', 'PARTIALLY_ISSUED')").get(teamId) as any)?.count || 0;
    const totalMaterialsCost = (await db.prepare("SELECT COALESCE(sum(estimated_cost), 0) as total FROM material_requests WHERE team_id = ? AND status NOT IN ('REJECTED', 'CANCELLED')").get(teamId) as any)?.total || 0;
    const safaricomTrackedUnits = (await db.prepare("SELECT count(*) as count FROM tracked_units WHERE current_team_id = ? AND safaricom_tag IS NOT NULL").get(teamId) as any)?.count || 0;
    const outstandingReturns = (await db.prepare("SELECT count(*) as count FROM tracked_units WHERE current_team_id = ? AND status = 'WITH_TEAM'").get(teamId) as any)?.count || 0;
    const requestsByStatus = await db.prepare(`
      SELECT status, count(*) as count FROM material_requests WHERE team_id = ? GROUP BY status
    `).all(teamId);
    const requestsByProject = await db.prepare(`
      SELECT p.name as projectName, count(mr.id) as requestCount, COALESCE(sum(mr.estimated_cost), 0) as totalCost
      FROM projects p JOIN material_requests mr ON p.id = mr.project_id
      WHERE mr.team_id = ? GROUP BY p.id ORDER BY totalCost DESC
    `).all(teamId);
    const topDemanded = await db.prepare(`
      SELECT m.name as materialName, m.unit, sum(mri.quantity_requested) as totalRequested, sum(mri.quantity_issued) as totalIssued
      FROM material_request_items mri
      JOIN materials m ON mri.material_id = m.id
      JOIN material_requests mr ON mr.id = mri.request_id
      WHERE mr.team_id = ?
      GROUP BY m.id ORDER BY totalRequested DESC LIMIT 6
    `).all(teamId);
    return res.json({
      success: true,
      summary: {
        activeTeams,
        pendingRequests,
        accountingQueueCount: 0,
        readyForIssueCount,
        lowStockCount: 0,
        totalMaterialsCost,
        safaricomTrackedUnits,
        outstandingReturns,
        requestsByStatus,
        requestsByProject,
        topDemanded
      }
    });
  }

  const activeTeams = (await db.prepare("SELECT count(*) as count FROM teams WHERE status = 'ACTIVE'").get() as any)?.count || 0;
  const activeTechnicians = (await db.prepare("SELECT count(*) as count FROM users WHERE role = 'FIELD_TECHNICIAN' AND is_active = 1").get() as any)?.count || 0;
  const activeTeamLeaders = (await db.prepare("SELECT count(*) as count FROM users WHERE role = 'FIELD_TEAM_LEADER' AND is_active = 1").get() as any)?.count || 0;
  const pendingRequests = (await db.prepare("SELECT count(*) as count FROM material_requests WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED')").get() as any)?.count || 0;
  const accountingQueueCount = (await db.prepare("SELECT count(*) as count FROM material_requests WHERE status IN ('APPROVED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING')").get() as any)?.count || 0;
  const readyForIssueCount = (await db.prepare("SELECT count(*) as count FROM material_requests WHERE status IN ('READY_FOR_ISSUE', 'PARTIALLY_ISSUED')").get() as any)?.count || 0;
  const lowStockCount = (await db.prepare("SELECT count(*) as count FROM materials WHERE current_stock <= minimum_stock AND is_active = 1").get() as any)?.count || 0;
  const totalMaterialsCost = (await db.prepare("SELECT COALESCE(sum(estimated_cost), 0) as total FROM material_requests WHERE status NOT IN ('REJECTED', 'CANCELLED')").get() as any)?.total || 0;
  const safaricomTrackedUnits = (await db.prepare("SELECT count(*) as count FROM tracked_units WHERE safaricom_tag IS NOT NULL").get() as any)?.count || 0;
  const outstandingReturns = (await db.prepare("SELECT count(*) as count FROM tracked_units WHERE status = 'WITH_TEAM'").get() as any)?.count || 0;

  // Requests by status
  const requestsByStatus = await db.prepare(`
    SELECT status, count(*) as count
    FROM material_requests
    GROUP BY status
  `).all();

  // Requests by project
  const requestsByProject = await db.prepare(`
    SELECT p.name as projectName, count(mr.id) as requestCount, COALESCE(sum(mr.estimated_cost), 0) as totalCost
    FROM projects p
    LEFT JOIN material_requests mr ON p.id = mr.project_id
    GROUP BY p.id
    ORDER BY totalCost DESC
  `).all();

  // Material demand (top 5 requested materials)
  const topDemanded = await db.prepare(`
    SELECT m.name as materialName, m.unit, sum(mri.quantity_requested) as totalRequested, sum(mri.quantity_issued) as totalIssued
    FROM material_request_items mri
    JOIN materials m ON mri.material_id = m.id
    GROUP BY m.id
    ORDER BY totalRequested DESC
    LIMIT 6
  `).all();

  return res.json({
    success: true,
    summary: {
      activeTeams,
      activeTechnicians,
      activeTeamLeaders,
      pendingRequests,
      accountingQueueCount,
      readyForIssueCount,
      lowStockCount,
      totalMaterialsCost,
      safaricomTrackedUnits,
      outstandingReturns,
      requestsByStatus,
      requestsByProject,
      topDemanded
    }
  });
});

// GET /api/v1/reports/safaricom-tracking (Safaricom Transparency Report)
router.get('/safaricom-tracking', authenticateToken, async (req: AuthRequest, res: Response) => {
  const teamFilter = ['FIELD_TECHNICIAN', 'FIELD_TEAM_LEADER'].includes(req.user?.role || '');
  if (teamFilter && !req.user?.teamId) {
    return res.status(403).json({ success: false, message: 'Your account is not assigned to a field team.', code: 'TEAM_REQUIRED' });
  }
  const records = await db.prepare(`
    SELECT tu.id, tu.serial_number as serialNumber, tu.barcode, tu.safaricom_tag as safaricomTag,
           m.name as materialName, m.sku, m.category, tu.status, tu.current_location as currentLocation,
           t.team_code as teamCode, t.name as teamName, p.name as projectName, p.client,
           tu.custodian_name as custodianName, tu.updated_at as lastMovementDate
    FROM tracked_units tu
    JOIN materials m ON tu.material_id = m.id
    LEFT JOIN teams t ON tu.current_team_id = t.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE (m.requires_safaricom_tracking = 1 OR tu.safaricom_tag IS NOT NULL)
      AND (? = 0 OR tu.current_team_id = ?)
    ORDER BY tu.updated_at DESC
  `).all(teamFilter ? 1 : 0, req.user?.teamId || '');

  return res.json({ success: true, count: records.length, records });
});

// GET /api/v1/reports/material-consumption
router.get('/material-consumption', authenticateToken, async (req: AuthRequest, res: Response) => {
  const teamFilter = ['FIELD_TECHNICIAN', 'FIELD_TEAM_LEADER'].includes(req.user?.role || '');
  if (teamFilter && !req.user?.teamId) {
    return res.status(403).json({ success: false, message: 'Your account is not assigned to a field team.', code: 'TEAM_REQUIRED' });
  }
  const records = await db.prepare(`
    SELECT mc.id, mc.quantity_consumed as quantityConsumed, mc.work_order as workOrder,
           mc.notes, mc.created_at as date,
           m.sku, m.name as materialName, m.unit, m.category,
           t.team_code as teamCode, t.name as teamName,
           u.full_name as loggedByName
    FROM material_consumptions mc
    JOIN materials m ON mc.material_id = m.id
    JOIN teams t ON mc.team_id = t.id
    JOIN users u ON mc.logged_by_id = u.id
    WHERE (? = 0 OR mc.team_id = ?)
    ORDER BY mc.created_at DESC
    LIMIT 200
  `).all(teamFilter ? 1 : 0, req.user?.teamId || '');

  return res.json({ success: true, count: records.length, records });
});

export default router;

import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken, requireRole } from './auth.js';
import { logAuditEvent } from './audit.js';
import { v4 as uuidv4 } from 'uuid';
import { createAsyncRouter } from './asyncRouter.js';

const router = createAsyncRouter();
const managementRoles = ['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER'];
const projectStatuses = ['IN_PROGRESS', 'ACTIVE', 'ON_HOLD', 'COMPLETED'];

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function getContractHealth(startDate: string | null, endDate: string | null): 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_STARTED' | 'MISSING_DATES' {
  if (!startDate || !endDate) return 'MISSING_DATES';
  const today = new Date().toISOString().slice(0, 10);
  if (endDate < today) return 'EXPIRED';
  if (startDate > today) return 'NOT_STARTED';
  const remainingDays = Math.ceil((Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86400000);
  return remainingDays <= 60 ? 'EXPIRING_SOON' : 'ACTIVE';
}

function decorateProject(project: any) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...project,
    contractHealth: getContractHealth(project.contractStartDate, project.contractEndDate),
    daysUntilExpiry: project.contractEndDate
      ? Math.ceil((Date.parse(`${project.contractEndDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86400000)
      : null
  };
}

function validateProjectInput(input: Record<string, unknown>): string | null {
  if (!validDate(input.contractStartDate) || !validDate(input.contractEndDate)) {
    return 'Contract start date and expiry date are required and must be valid dates.';
  }
  if (input.contractEndDate < input.contractStartDate) {
    return 'Contract expiry date must be on or after the start date.';
  }
  if (typeof input.status === 'string' && !projectStatuses.includes(input.status)) {
    return 'Select a valid project status.';
  }
  return null;
}

async function resolveRegionId(name: string): Promise<string> {
  const existing = await db.prepare('SELECT id FROM regions WHERE LOWER(name) = LOWER(?)').get(name) as { id: string } | undefined;
  if (existing) return existing.id;
  const regionId = `reg-${uuidv4().slice(0, 8)}`;
  await db.prepare('INSERT INTO regions (id, name, code) VALUES (?, ?, ?)').run(
    regionId,
    name,
    `REG-${uuidv4().slice(0, 8).toUpperCase()}`
  );
  return regionId;
}

// GET /api/v1/projects
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const projects = await db.prepare(`
    SELECT p.id, p.project_code as projectCode, p.name, p.network_type as networkType, p.client,
           p.region_id as regionId, r.name as regionName,
           p.status, p.budget, p.contract_start_date as contractStartDate,
           p.contract_end_date as contractEndDate, p.created_at as createdAt,
           (SELECT count(*) FROM teams WHERE project_id = p.id) as teamCount,
           (SELECT count(DISTINCT up.user_id) FROM user_projects up
            JOIN users u ON u.id = up.user_id AND u.is_active = 1
            WHERE up.project_id = p.id) as staffCount,
           (SELECT count(*) FROM material_requests WHERE project_id = p.id) as requestCount,
           (SELECT COALESCE(sum(estimated_cost), 0) FROM material_requests WHERE project_id = p.id) as totalMaterialCost
    FROM projects p
    LEFT JOIN regions r ON p.region_id = r.id
    ORDER BY p.name ASC
  `).all();

  const projectsWithHealth = projects.map(decorateProject);

  return res.json({ success: true, count: projectsWithHealth.length, projects: projectsWithHealth });
});

// POST /api/v1/projects
router.post('/', authenticateToken, requireRole(managementRoles), async (req: AuthRequest, res: Response) => {
  const { projectCode, name, networkType, client, regionName, budget, status, contractStartDate, contractEndDate } = req.body;
  if (typeof projectCode !== 'string' || !projectCode.trim() ||
      typeof name !== 'string' || !name.trim() ||
      typeof client !== 'string' || !client.trim() ||
      typeof regionName !== 'string' || !regionName.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Project code, project name, client, and country/county/region are required.',
      code: 'PROJECT_FIELDS_REQUIRED'
    });
  }

  const cleanCode = projectCode.trim().toUpperCase();
  const cleanNetworkType = typeof networkType === 'string' ? networkType.trim().toUpperCase() : '';
  if (!['FTTH', 'FTTB'].includes(cleanNetworkType)) {
    return res.status(400).json({ success: false, message: 'Project network type must be FTTH or FTTB.', code: 'INVALID_NETWORK_TYPE' });
  }
  const dateError = validateProjectInput(req.body);
  if (dateError) return res.status(400).json({ success: false, message: dateError, code: 'INVALID_CONTRACT_DATES' });

  const cleanBudget = budget === undefined || budget === '' ? 0 : Number(budget);
  if (!Number.isFinite(cleanBudget) || cleanBudget < 0) {
    return res.status(400).json({ success: false, message: 'Project budget must be a non-negative number.', code: 'INVALID_PROJECT_BUDGET' });
  }
  if (await db.prepare('SELECT id FROM projects WHERE UPPER(project_code) = ?').get(cleanCode)) {
    return res.status(409).json({ success: false, message: `Project code ${cleanCode} is already in use.`, code: 'PROJECT_CODE_EXISTS' });
  }

  const projectId = `prj-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();
  await db.exec('BEGIN');
  try {
    const regionId = await resolveRegionId(regionName.trim());
    await db.prepare(`
      INSERT INTO projects (id, project_code, name, network_type, client, region_id, status, budget, contract_start_date, contract_end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      cleanCode,
      name.trim(),
      cleanNetworkType,
      client.trim(),
      regionId,
      typeof status === 'string' && projectStatuses.includes(status) ? status : 'IN_PROGRESS',
      cleanBudget,
      contractStartDate,
      contractEndDate,
      now,
      now
    );
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }

  await logAuditEvent({
    userId: req.user!.id,
    action: 'PROJECT_CREATED',
    entity: 'Project',
    entityId: projectId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    newValue: { projectCode: cleanCode, name: name.trim(), networkType: cleanNetworkType },
    reason: `Project ${cleanCode} created by ${req.user!.fullName}`
  });

  const project = await db.prepare(`
    SELECT p.id, p.project_code as projectCode, p.name, p.network_type as networkType,
           p.client, p.region_id as regionId, r.name as regionName, p.status, p.budget,
           p.contract_start_date as contractStartDate, p.contract_end_date as contractEndDate,
           p.created_at as createdAt,
           (SELECT count(*) FROM teams WHERE project_id = p.id) as teamCount,
           (SELECT count(DISTINCT up.user_id) FROM user_projects up
            JOIN users u ON u.id = up.user_id AND u.is_active = 1
            WHERE up.project_id = p.id) as staffCount,
           (SELECT count(*) FROM material_requests WHERE project_id = p.id) as requestCount,
           (SELECT COALESCE(sum(estimated_cost), 0) FROM material_requests WHERE project_id = p.id) as totalMaterialCost
    FROM projects p LEFT JOIN regions r ON r.id = p.region_id
    WHERE p.id = ?
  `).get(projectId);
  return res.status(201).json({ success: true, message: 'Project created successfully.', project: decorateProject(project) });
});

router.put('/:id', authenticateToken, requireRole(managementRoles), async (req: AuthRequest, res: Response) => {
  const projectId = req.params.id;
  const { projectCode, name, networkType, client, regionName, budget, status, contractStartDate, contractEndDate } = req.body;
  const current = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
  if (!current) return res.status(404).json({ success: false, message: 'Project not found.' });
  if (typeof projectCode !== 'string' || !projectCode.trim() ||
      typeof name !== 'string' || !name.trim() ||
      typeof client !== 'string' || !client.trim() ||
      typeof regionName !== 'string' || !regionName.trim()) {
    return res.status(400).json({ success: false, message: 'Project code, name, client, and region are required.' });
  }
  const cleanCode = projectCode.trim().toUpperCase();
  const cleanNetworkType = typeof networkType === 'string' ? networkType.trim().toUpperCase() : '';
  if (!['FTTH', 'FTTB'].includes(cleanNetworkType)) {
    return res.status(400).json({ success: false, message: 'Project network type must be FTTH or FTTB.' });
  }
  const dateError = validateProjectInput(req.body);
  if (dateError) return res.status(400).json({ success: false, message: dateError, code: 'INVALID_CONTRACT_DATES' });
  const cleanBudget = Number(budget);
  if (!Number.isFinite(cleanBudget) || cleanBudget < 0) {
    return res.status(400).json({ success: false, message: 'Project budget must be a non-negative number.' });
  }
  const duplicate = await db.prepare('SELECT id FROM projects WHERE UPPER(project_code) = ? AND id <> ?').get(cleanCode, projectId);
  if (duplicate) return res.status(409).json({ success: false, message: `Project code ${cleanCode} is already in use.` });

  const incompatibleTeam = await db.prepare(`
    SELECT team_code FROM teams
    WHERE project_id = ? AND UPPER(team_code) NOT LIKE ?
    LIMIT 1
  `).get(projectId, `${cleanNetworkType}-%`) as { team_code: string } | undefined;
  if (incompatibleTeam) {
    return res.status(409).json({
      success: false,
      message: `Network type cannot be changed while team ${incompatibleTeam.team_code} is assigned to this project.`,
      code: 'PROJECT_HAS_INCOMPATIBLE_TEAMS'
    });
  }

  const now = new Date().toISOString();
  await db.exec('BEGIN');
  try {
    const regionId = await resolveRegionId(regionName.trim());
    await db.prepare(`
      UPDATE projects
      SET project_code = ?, name = ?, network_type = ?, client = ?, region_id = ?, status = ?, budget = ?,
          contract_start_date = ?, contract_end_date = ?, updated_at = ?
      WHERE id = ?
    `).run(
      cleanCode, name.trim(), cleanNetworkType, client.trim(), regionId, status,
      cleanBudget, contractStartDate, contractEndDate, now, projectId
    );
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }

  await logAuditEvent({
    userId: req.user!.id,
    action: 'PROJECT_UPDATED',
    entity: 'Project',
    entityId: projectId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    previousValue: { status: current.status, contractEndDate: current.contract_end_date },
    newValue: { projectCode: cleanCode, status, contractEndDate },
    reason: `Project ${cleanCode} updated by ${req.user!.fullName}`
  });
  const project = await db.prepare(`
    SELECT p.id, p.project_code as projectCode, p.name, p.network_type as networkType,
           p.client, p.region_id as regionId, r.name as regionName, p.status, p.budget,
           p.contract_start_date as contractStartDate, p.contract_end_date as contractEndDate,
           p.created_at as createdAt, p.updated_at as updatedAt,
           (SELECT count(*) FROM teams WHERE project_id = p.id) as teamCount,
           (SELECT count(DISTINCT up.user_id) FROM user_projects up
            JOIN users u ON u.id = up.user_id AND u.is_active = 1
            WHERE up.project_id = p.id) as staffCount,
           (SELECT count(*) FROM material_requests WHERE project_id = p.id) as requestCount,
           (SELECT COALESCE(sum(estimated_cost), 0) FROM material_requests WHERE project_id = p.id) as totalMaterialCost
    FROM projects p LEFT JOIN regions r ON r.id = p.region_id WHERE p.id = ?
  `).get(projectId);
  return res.json({ success: true, message: 'Project updated successfully.', project: decorateProject(project) });
});

// GET /api/v1/projects/:id/stats
router.get('/:id/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  const projectId = req.params.id;

  const project = await db.prepare(`
    SELECT id, project_code as projectCode, name, network_type as networkType, client,
           region_id as regionId, status, budget, contract_start_date as contractStartDate,
           contract_end_date as contractEndDate, created_at as createdAt, updated_at as updatedAt
    FROM projects
    WHERE id = ?
  `).get(projectId) as any;
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  // Material requests breakdown
  const statusBreakdown = await db.prepare(`
    SELECT status, count(*) as count, sum(estimated_cost) as totalCost
    FROM material_requests
    WHERE project_id = ?
    GROUP BY status
  `).all(projectId);

  // Top consumed materials on this project
  const topMaterials = await db.prepare(`
    SELECT m.name as materialName, m.unit, sum(mii.quantity_issued) as totalQuantityIssued
    FROM material_issue_items mii
    JOIN material_issues mi ON mii.issue_id = mi.id
    JOIN material_requests mr ON mi.request_id = mr.id
    JOIN materials m ON mii.material_id = m.id
    WHERE mr.project_id = ?
    GROUP BY m.id
    ORDER BY totalQuantityIssued DESC
    LIMIT 10
  `).all(projectId);

  return res.json({ success: true, project, statusBreakdown, topMaterials });
});

export default router;

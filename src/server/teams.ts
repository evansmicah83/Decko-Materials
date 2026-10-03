import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken, requireRole } from './auth.js';
import { logAuditEvent } from './audit.js';
import { v4 as uuidv4 } from 'uuid';
import { createAsyncRouter } from './asyncRouter.js';

const router = createAsyncRouter();

const managementRoles = ['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER'];
const isFieldRole = (req: AuthRequest) => ['FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(req.user?.role || '');

async function resolveRegionId(value: string | null | undefined): Promise<string | null> {
  const name = value?.trim();
  if (!name) return null;
  const existing = await db.prepare('SELECT id FROM regions WHERE id = ? OR LOWER(name) = LOWER(?)').get(name, name) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = `reg-${uuidv4().slice(0, 8)}`;
  const code = `REG-${uuidv4().slice(0, 8).toUpperCase()}`;
  await db.prepare('INSERT INTO regions (id, name, code) VALUES (?, ?, ?)').run(id, name, code);
  return id;
}

function requireTeamAccess(req: AuthRequest, res: Response, teamId: string): boolean {
  if (isFieldRole(req) && req.user?.teamId !== teamId) {
    res.status(403).json({ success: false, message: 'You can only access your assigned team.', code: 'TEAM_ACCESS_DENIED' });
    return false;
  }
  return true;
}

async function validateTeamProject(projectId: unknown, teamCode: string): Promise<string | null> {
  if (typeof projectId !== 'string' || !projectId.trim()) {
    return 'Choose an active project before creating or updating a team.';
  }
  const project = await db.prepare('SELECT network_type, status, contract_start_date, contract_end_date FROM projects WHERE id = ?').get(projectId) as
    { network_type: string; status: string; contract_start_date: string | null; contract_end_date: string | null } | undefined;
  const today = new Date().toISOString().slice(0, 10);
  if (!project || !['IN_PROGRESS', 'ACTIVE'].includes(project.status) ||
      !project.contract_start_date || !project.contract_end_date ||
      project.contract_start_date > today || project.contract_end_date < today) {
    return 'Choose a project with an active contract that has not expired or started in the future.';
  }
  if (!teamCode.toUpperCase().startsWith(`${project.network_type.toUpperCase()}-`)) {
    return `Team code must use the ${project.network_type} prefix for this project.`;
  }
  return null;
}

// GET /api/v1/teams
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const teamScope = isFieldRole(req) ? 'WHERE t.id = ?' : '';
  const teams = await db.prepare(`
    SELECT t.id, t.team_code as teamCode, t.name, t.leader_id as leaderId,
           u.full_name as leaderName, u.phone_number as leaderPhone,
           u.email as leaderEmail, u.employee_id as leaderEmployeeId,
           t.project_id as projectId, p.name as projectName,
           t.region_id as regionId, r.name as regionName,
           t.assigned_area as assignedArea, t.status, t.contact_info as contactInfo,
           (
             (SELECT count(*) FROM team_members WHERE team_id = t.id AND is_active = 1) +
             (SELECT count(*) FROM users
              WHERE team_id = t.id AND role = 'FIELD_TECHNICIAN' AND is_active = 1
                AND NOT EXISTS (
                  SELECT 1 FROM team_members
                  WHERE team_members.team_id = users.team_id
                    AND team_members.employee_id = users.employee_id
                    AND team_members.is_active = 1
                ))
           ) as memberCount
    FROM teams t
    LEFT JOIN users u ON t.leader_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN regions r ON t.region_id = r.id
    ${teamScope}
    ORDER BY t.team_code ASC
  `).all(...(isFieldRole(req) ? [req.user?.teamId || ''] : [])) as any[];

  // Attach team members to each team
  const getMembers = db.prepare(`
    SELECT id, team_id as teamId, full_name as fullName, phone_number as phoneNumber,
           employee_id as employeeId, role_title as roleTitle, national_id as nationalId,
           is_active as isActive, joined_at as joinedAt, created_at as createdAt,
           EXISTS (
             SELECT 1 FROM users
             WHERE users.team_id = team_members.team_id
               AND users.employee_id = team_members.employee_id
               AND users.role = 'FIELD_TECHNICIAN'
               AND users.is_active = 1
           ) as hasLogin
    FROM team_members
    WHERE team_id = ? AND is_active = 1
    ORDER BY full_name ASC
  `);

  for (const team of teams) {
    const roster = await getMembers.all(team.id);
    const technicians = await db.prepare(`
      SELECT 'usrmember-' || id as id, team_id as teamId, full_name as fullName,
             phone_number as phoneNumber, employee_id as employeeId,
             'Field Technician' as roleTitle, NULL as nationalId,
             is_active as isActive, created_at as joinedAt, created_at as createdAt
      FROM users
      WHERE team_id = ? AND role = 'FIELD_TECHNICIAN' AND is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM team_members
          WHERE team_members.team_id = users.team_id
            AND team_members.employee_id = users.employee_id
            AND team_members.is_active = 1
        )
      ORDER BY full_name ASC
    `).all(team.id);
    team.members = [...roster, ...technicians].sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));
  }

  return res.json({ success: true, count: teams.length, teams });
});

// GET /api/v1/teams/leaders/available (Get registered Field Team Leaders)
router.get('/leaders/available', authenticateToken, requireRole(managementRoles), async (req: AuthRequest, res: Response) => {
  const leaders = await db.prepare(`
    SELECT u.id, u.full_name as fullName, u.email, u.employee_id as employeeId,
           u.phone_number as phoneNumber, u.department, u.team_id as teamId,
           t.team_code as currentTeamCode, t.name as currentTeamName
    FROM users u
    LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.role = 'FIELD_TEAM_LEADER' AND u.is_active = 1
    ORDER BY u.full_name ASC
  `).all();

  return res.json({ success: true, count: leaders.length, leaders });
});

// POST /api/v1/teams (Create new Field Team - HR, Project Manager, or Admin)
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER']), async (req: AuthRequest, res: Response) => {
  const { teamCode, name, leaderId, projectId, regionId, regionName, assignedArea, contactInfo } = req.body;
  const locationInput = typeof regionName === 'string' ? regionName : typeof regionId === 'string' ? regionId : '';

  if (typeof teamCode !== 'string' || !teamCode.trim() || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Team code and team name are required' });
  }
  if (!locationInput.trim()) {
    return res.status(400).json({ success: false, message: 'Country, county, or region is required.', code: 'REGION_REQUIRED' });
  }
  if (typeof assignedArea !== 'string' || !assignedArea.trim()) {
    return res.status(400).json({ success: false, message: 'Assigned area is required.', code: 'ASSIGNED_AREA_REQUIRED' });
  }

  const cleanCode = teamCode.trim().toUpperCase();
  const projectError = await validateTeamProject(projectId, cleanCode);
  if (projectError) {
    return res.status(400).json({ success: false, message: projectError, code: 'ACTIVE_PROJECT_REQUIRED' });
  }
  const existing = await db.prepare('SELECT id FROM teams WHERE UPPER(team_code) = ?').get(cleanCode);
  if (existing) {
    return res.status(409).json({ success: false, message: `Team with code ${cleanCode} already exists` });
  }

  if (leaderId) {
    const leader = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'FIELD_TEAM_LEADER' AND is_active = 1").get(leaderId);
    if (!leader) {
      return res.status(400).json({ success: false, message: 'Select an active Field Team Leader account.', code: 'INVALID_TEAM_LEADER' });
    }
  }

  const teamId = `team-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const now = new Date().toISOString();
  let resolvedRegionId: string | null;
  try {
    resolvedRegionId = await resolveRegionId(locationInput);
  } catch (error) {
    console.error('Failed to resolve field team region:', error);
    return res.status(400).json({ success: false, message: 'Enter a valid country, county, or region.', code: 'INVALID_REGION' });
  }

  await db.prepare(`
    INSERT INTO teams (id, team_code, name, leader_id, project_id, region_id, assigned_area, status, contact_info, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `).run(
    teamId,
    cleanCode,
    name.trim(),
    leaderId || null,
    projectId || null,
    resolvedRegionId,
    assignedArea.trim(),
    contactInfo ? contactInfo.trim() : null,
    now,
    now
  );

  // If leader assigned, link user to team
  if (leaderId) {
    const previousTeam = await db.prepare('SELECT id FROM teams WHERE leader_id = ? AND id != ?').get(leaderId, teamId) as { id: string } | undefined;
    if (previousTeam) {
      await db.prepare('UPDATE teams SET leader_id = NULL, updated_at = ? WHERE id = ?').run(now, previousTeam.id);
    }
    await db.prepare('UPDATE users SET team_id = ?, updated_at = ? WHERE id = ?').run(teamId, now, leaderId);
  }

  await logAuditEvent({
    userId: req.user!.id,
    action: 'TEAM_CREATED',
    entity: 'Team',
    entityId: teamId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    reason: `Field Team ${cleanCode} (${name}) created by ${req.user!.fullName} (${req.user!.role})`
  });

  const createdTeam = await db.prepare(`
    SELECT t.id, t.team_code as teamCode, t.name, t.leader_id as leaderId,
           u.full_name as leaderName, u.phone_number as leaderPhone,
           t.project_id as projectId, t.region_id as regionId,
           t.assigned_area as assignedArea, t.status, t.contact_info as contactInfo
    FROM teams t
    LEFT JOIN users u ON t.leader_id = u.id
    WHERE t.id = ?
  `).get(teamId) as any;

  createdTeam.members = [];

  return res.status(201).json({
    success: true,
    message: `Team ${cleanCode} created successfully`,
    team: createdTeam
  });
});

// PUT /api/v1/teams/:id (Update Team & Assign Leader - HR, Project Manager, Admin)
router.put('/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER']), async (req: AuthRequest, res: Response) => {
  const teamId = req.params.id;
  const { name, leaderId, projectId, regionId, regionName, assignedArea, status, contactInfo } = req.body;

  const current = await db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
  if (!current) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const nextProjectId = projectId !== undefined ? projectId : current.project_id;
  const projectError = await validateTeamProject(nextProjectId, current.team_code);
  if (projectError) {
    return res.status(400).json({ success: false, message: projectError, code: 'ACTIVE_PROJECT_REQUIRED' });
  }

  if (leaderId && leaderId !== current.leader_id) {
    const leader = await db.prepare("SELECT id FROM users WHERE id = ? AND role = 'FIELD_TEAM_LEADER' AND is_active = 1").get(leaderId);
    if (!leader) {
      return res.status(400).json({ success: false, message: 'Select an active Field Team Leader account.', code: 'INVALID_TEAM_LEADER' });
    }
  }

  const now = new Date().toISOString();
  let resolvedRegionId: string | null;
  try {
    resolvedRegionId = regionName !== undefined || regionId !== undefined
      ? await resolveRegionId(regionName !== undefined ? regionName : regionId)
      : current.region_id;
  } catch (error) {
    console.error('Failed to resolve field team region:', error);
    return res.status(400).json({ success: false, message: 'Enter a valid country, county, or region.', code: 'INVALID_REGION' });
  }

  await db.prepare(`
    UPDATE teams
    SET name = COALESCE(?, name),
        leader_id = ?,
        project_id = ?,
        region_id = ?,
        assigned_area = COALESCE(?, assigned_area),
        status = COALESCE(?, status),
        contact_info = COALESCE(?, contact_info),
        updated_at = ?
    WHERE id = ?
  `).run(
    name ? name.trim() : null,
    leaderId !== undefined ? leaderId : current.leader_id,
    nextProjectId,
    resolvedRegionId,
    assignedArea ? assignedArea.trim() : null,
    status || null,
    contactInfo ? contactInfo.trim() : null,
    now,
    teamId
  );

  if (leaderId !== undefined && leaderId !== current.leader_id) {
    if (current.leader_id) {
      await db.prepare('UPDATE users SET team_id = NULL, updated_at = ? WHERE id = ? AND team_id = ?')
        .run(now, current.leader_id, teamId);
    }
  }
  if (leaderId && leaderId !== current.leader_id) {
    const previousTeam = await db.prepare('SELECT id FROM teams WHERE leader_id = ? AND id != ?').get(leaderId, teamId) as { id: string } | undefined;
    if (previousTeam) {
      await db.prepare('UPDATE teams SET leader_id = NULL, updated_at = ? WHERE id = ?').run(now, previousTeam.id);
    }
    await db.prepare('UPDATE users SET team_id = ?, updated_at = ? WHERE id = ?').run(teamId, now, leaderId);
  }

  await logAuditEvent({
    userId: req.user!.id,
    action: 'TEAM_UPDATED',
    entity: 'Team',
    entityId: teamId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    reason: `Team ${current.team_code} updated by ${req.user!.fullName}`
  });

  return res.json({ success: true, message: 'Team details updated successfully' });
});

// GET /api/v1/teams/:id/members (Get team teammates / crew roster)
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  const teamId = req.params.id;
  if (!requireTeamAccess(req, res, teamId)) return;
  const members = await db.prepare(`
    SELECT id, team_id as teamId, full_name as fullName, phone_number as phoneNumber,
           employee_id as employeeId, role_title as roleTitle, national_id as nationalId,
           is_active as isActive, joined_at as joinedAt, created_at as createdAt,
           EXISTS (
             SELECT 1 FROM users
             WHERE users.team_id = team_members.team_id
               AND users.employee_id = team_members.employee_id
               AND users.role = 'FIELD_TECHNICIAN'
               AND users.is_active = 1
           ) as hasLogin
    FROM team_members
    WHERE team_id = ? AND is_active = 1
    ORDER BY full_name ASC
  `).all(teamId) as any[];
  const technicians = await db.prepare(`
    SELECT 'usrmember-' || id as id, team_id as teamId, full_name as fullName,
           phone_number as phoneNumber, employee_id as employeeId,
           'Field Technician' as roleTitle, NULL as nationalId,
           is_active as isActive, created_at as joinedAt, created_at as createdAt
    FROM users
    WHERE team_id = ? AND role = 'FIELD_TECHNICIAN' AND is_active = 1
      AND NOT EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = users.team_id
          AND team_members.employee_id = users.employee_id
          AND team_members.is_active = 1
      )
    ORDER BY full_name ASC
  `).all(teamId);
  members.push(...technicians);
  members.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return res.json({ success: true, count: members.length, members });
});

// POST /api/v1/teams/:id/members (Add Teammate / Crew Member - HR, Project Manager, or Admin)
router.post('/:id/members', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER', 'FIELD_TEAM_LEADER']), async (req: AuthRequest, res: Response) => {
  const teamId = req.params.id;
  if (!requireTeamAccess(req, res, teamId)) return;
  const { fullName, phoneNumber, employeeId, roleTitle, nationalId, joinedAt } = req.body;

  if (!fullName) {
    return res.status(400).json({ success: false, message: 'Teammate full name is required' });
  }

  const team = await db.prepare('SELECT id, team_code, name FROM teams WHERE id = ?').get(teamId) as any;
  if (!team) {
    return res.status(404).json({ success: false, message: 'Team not found' });
  }

  const memberId = `tm-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO team_members (id, team_id, full_name, phone_number, employee_id, role_title, national_id, is_active, joined_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    memberId,
    teamId,
    fullName.trim(),
    phoneNumber ? phoneNumber.trim() : null,
    employeeId ? employeeId.trim().toUpperCase() : `TEC-${Math.floor(1000 + Math.random() * 9000)}`,
    roleTitle ? roleTitle.trim() : 'Fibre Splicer & Aerial Technician',
    nationalId ? nationalId.trim() : null,
    joinedAt || now.split('T')[0],
    now,
    now
  );

  await logAuditEvent({
    userId: req.user!.id,
    action: 'TEAM_MEMBER_ADDED',
    entity: 'TeamMember',
    entityId: memberId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    reason: `Added teammate ${fullName} (${roleTitle || 'Technician'}) to Team ${team.team_code} by ${req.user!.fullName}`
  });

  const member = await db.prepare(`
    SELECT id, team_id as teamId, full_name as fullName, phone_number as phoneNumber,
           employee_id as employeeId, role_title as roleTitle, national_id as nationalId,
           is_active as isActive, joined_at as joinedAt, created_at as createdAt
    FROM team_members
    WHERE id = ?
  `).get(memberId);

  return res.status(201).json({
    success: true,
    message: `Teammate ${fullName} added to ${team.team_code}`,
    member
  });
});

// DELETE /api/v1/teams/:id/members/:memberId (Remove/Deactivate teammate)
router.delete('/:id/members/:memberId', authenticateToken, requireRole(managementRoles), async (req: AuthRequest, res: Response) => {
  const { id: teamId, memberId } = req.params;

  if (memberId.startsWith('usrmember-')) {
    const technicianId = memberId.slice('usrmember-'.length);
    const technician = await db.prepare("SELECT * FROM users WHERE id = ? AND team_id = ? AND role = 'FIELD_TECHNICIAN'").get(technicianId, teamId) as any;
    if (!technician) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }
    const now = new Date().toISOString();
    try {
      await db.exec('BEGIN');
      await db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(now, technicianId);
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      console.error('Failed to deactivate Supabase technician account:', error);
      return res.status(503).json({ success: false, message: 'Technician access could not be revoked. Please retry.', code: 'TECHNICIAN_DEACTIVATION_FAILED' });
    }
    await logAuditEvent({
      userId: req.user!.id,
      action: 'TECHNICIAN_ACCOUNT_DEACTIVATED',
      entity: 'User',
      entityId: technicianId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      reason: `Deactivated technician ${technician.full_name} from team ${teamId}`
    });
    return res.json({ success: true, message: `Technician ${technician.full_name} deactivated` });
  }

  const member = await db.prepare('SELECT * FROM team_members WHERE id = ? AND team_id = ? AND is_active = 1').get(memberId, teamId) as any;
  if (!member) {
    return res.status(404).json({ success: false, message: 'Team member not found' });
  }

  const linkedTechnician = await db.prepare(`
    SELECT id, full_name FROM users
    WHERE team_id = ? AND employee_id = ? AND role = 'FIELD_TECHNICIAN' AND is_active = 1
  `).get(teamId, member.employee_id) as { id: string; full_name: string } | undefined;
  if (linkedTechnician) {
    const now = new Date().toISOString();
    try {
      await db.exec('BEGIN');
      await db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(now, linkedTechnician.id);
      await db.prepare('UPDATE team_members SET is_active = 0, updated_at = ? WHERE id = ?').run(now, memberId);
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      console.error('Failed to revoke technician sign-in access:', error);
      return res.status(503).json({ success: false, message: 'Technician access could not be revoked. Please retry.', code: 'TECHNICIAN_DEACTIVATION_FAILED' });
    }
  } else {
    await db.prepare('DELETE FROM team_members WHERE id = ?').run(memberId);
  }

  await logAuditEvent({
    userId: req.user!.id,
    action: 'TEAM_MEMBER_REMOVED',
    entity: 'TeamMember',
    entityId: memberId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    reason: `Removed teammate ${member.full_name} from team ${teamId} by ${req.user!.fullName}`
  });

  return res.json({ success: true, message: `Teammate ${member.full_name} removed from team` });
});

// GET /api/v1/teams/:id/stock (Team Virtual Stock)
router.get('/:id/stock', authenticateToken, async (req: AuthRequest, res: Response) => {
  const teamId = req.params.id;
  if (!requireTeamAccess(req, res, teamId)) return;

  const stocks = await db.prepare(`
    SELECT ts.id, ts.team_id as teamId, ts.material_id as materialId,
           m.sku, m.name as materialName, m.category, m.unit,
           ts.current_stock as currentStock, ts.total_issued as totalIssued,
           ts.total_consumed as totalConsumed, ts.total_returned as totalReturned,
           ts.total_damaged as totalDamaged, ts.total_lost as totalLost,
           m.is_serial_required as isSerialRequired,
           ts.updated_at as updatedAt
    FROM team_stocks ts
    JOIN materials m ON ts.material_id = m.id
    WHERE ts.team_id = ?
    ORDER BY m.name ASC
  `).all(teamId);

  // Active tracked tools currently in custody of this team
  const tools = await db.prepare(`
    SELECT tu.id, tu.serial_number as serialNumber, tu.barcode, tu.material_id as materialId,
           m.name as materialName, m.sku, tu.status, tu.custodian_name as custodianName,
           tu.safaricom_tag as safaricomTag, tu.updated_at as updatedAt
    FROM tracked_units tu
    JOIN materials m ON tu.material_id = m.id
    WHERE tu.current_team_id = ? AND tu.status = 'WITH_TEAM'
    ORDER BY m.name ASC
  `).all(teamId);

  return res.json({ success: true, stocks, tools });
});

export default router;

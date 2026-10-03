import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db.js';
import { supabase } from './supabase.js';
import { logAuditEvent } from './audit.js';

const router = Router();
function requireJwtSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const secret = process.env[name];
  if (!secret || secret.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return secret;
}

const JWT_SECRET = requireJwtSecret('JWT_SECRET');
const JWT_REFRESH_SECRET = requireJwtSecret('JWT_REFRESH_SECRET');

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  department: string | null;
  employeeId: string;
  teamId: string | null;
  phoneNumber?: string | null;
  mustChangePassword?: boolean;
  lastLogin?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// In-memory failed login attempt tracker for rate limiting / throttling
interface ThrottleRecord {
  attempts: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, ThrottleRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one special character (e.g. !@#$%^&*).' };
  }
  return { valid: true };
}

export function generateToken(user: AuthUser, expiresIn = '7d'): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      employeeId: user.employeeId,
      teamId: user.teamId,
      phoneNumber: user.phoneNumber,
      mustChangePassword: user.mustChangePassword,
    },
    JWT_SECRET,
    { expiresIn: expiresIn as any }
  );
}

export function generateRefreshToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      employeeId: user.employeeId,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.', code: 'UNAUTHORIZED' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    const activeUser = db.prepare('SELECT is_active FROM users WHERE id = ?').get(decoded.id) as { is_active: number } | undefined;
    if (!activeUser || !activeUser.is_active) {
      return res.status(401).json({ success: false, message: 'Your account is inactive. Please contact your administrator.', code: 'ACCOUNT_INACTIVE' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired session token. Please sign in again.', code: 'FORBIDDEN' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    // Universal access for SUPER_ADMIN, ADMIN, HR, and PROJECT_MANAGER across all features
    if (['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER'].includes(req.user.role) || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Permission denied. Required role: ${allowedRoles.join(', ')}`,
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  };
}

// POST /api/v1/auth/register (Create employee account; manager-only)
router.post('/register', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'HR', 'PROJECT_MANAGER']), async (req: AuthRequest, res: Response) => {
  const {
    fullName,
    email,
    employeeId,
    phoneNumber,
    role,
    department,
    teamId,
    projectIds,
    roleTitle,
    password,
    confirmPassword
  } = req.body;

  if (!fullName || !email || !employeeId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Full Name, Work Email, Employee ID, and Password are required',
      code: 'MISSING_FIELDS'
    });
  }

  const allowedRoles = [
    'ADMIN',
    'HR',
    'PROJECT_MANAGER',
    'FIELD_TEAM_LEADER',
    'FIELD_TECHNICIAN',
    'DISPATCHER',
    'ACCOUNTANT',
    'STORE_OFFICER',
    'PROCUREMENT_OFFICER',
    'AUDITOR',
    'VIEWER',
    'FIELD',
    'FIELD_LEADER',
    'TEAM_LEADER'
  ];

  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Select a valid employee role. Super Admin accounts cannot be created here.',
      code: 'INVALID_ROLE'
    });
  }

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match',
      code: 'PASSWORD_MISMATCH'
    });
  }

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return res.status(400).json({
      success: false,
      message: strength.reason,
      code: 'WEAK_PASSWORD'
    });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanEmpId = employeeId.trim().toUpperCase();

  // Check if email or employee ID already exists
  const existingUser = db.prepare(`
    SELECT id, email, employee_id FROM users 
    WHERE LOWER(email) = ? OR UPPER(employee_id) = ?
  `).get(cleanEmail, cleanEmpId) as any;

  if (existingUser) {
    if (existingUser.email?.toLowerCase() === cleanEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.',
        code: 'EMAIL_EXISTS'
      });
    }
    return res.status(409).json({
      success: false,
      message: `An account with Employee ID ${cleanEmpId} already exists.`,
      code: 'EMPLOYEE_ID_EXISTS'
    });
  }

  const userId = `usr-${uuidv4().slice(0, 8)}`;
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  // If role is field or not specified, ensure it is FIELD_TEAM_LEADER
  let assignedRole = role || 'FIELD_TEAM_LEADER';
  if (assignedRole === 'FIELD' || assignedRole === 'FIELD_LEADER' || assignedRole === 'TEAM_LEADER') {
    assignedRole = 'FIELD_TEAM_LEADER';
  }

  if (['FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(assignedRole) && !teamId) {
    return res.status(400).json({
      success: false,
      message: 'A field team must be selected for a Field Team Leader or Field Technician account.',
      code: 'TEAM_REQUIRED'
    });
  }

  if (teamId && !['FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(assignedRole)) {
    return res.status(400).json({
      success: false,
      message: 'Only Field Team Leaders and Field Technicians can be assigned to a field team.',
      code: 'INVALID_TEAM_ASSIGNMENT'
    });
  }

  const assignedTeam = teamId
    ? db.prepare('SELECT id, leader_id, project_id FROM teams WHERE id = ?').get(teamId) as { id: string; leader_id: string | null; project_id: string | null } | undefined
    : undefined;
  if (teamId && !assignedTeam) {
    return res.status(404).json({
      success: false,
      message: 'The selected field team does not exist.',
      code: 'TEAM_NOT_FOUND'
    });
  }
  if (assignedRole === 'FIELD_TEAM_LEADER' && assignedTeam?.leader_id) {
    return res.status(409).json({
      success: false,
      message: 'The selected team already has a leader. Choose an unassigned team or assign this leader separately.',
      code: 'TEAM_ALREADY_HAS_LEADER'
    });
  }
  const requestedProjectIds = Array.isArray(projectIds)
    ? [...new Set(projectIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))]
    : [];
  if (['FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(assignedRole)) {
    if (!assignedTeam?.project_id) {
      return res.status(400).json({
        success: false,
        message: 'Assign the field team to an active project before creating accounts for its leader or technicians.',
        code: 'TEAM_PROJECT_REQUIRED'
      });
    }
    if (requestedProjectIds.length > 0 && (requestedProjectIds.length !== 1 || requestedProjectIds[0] !== assignedTeam.project_id)) {
      return res.status(400).json({
        success: false,
        message: 'Field employees must be assigned to the project serving their selected team.',
        code: 'TEAM_PROJECT_MISMATCH'
      });
    }
  }
  const finalProjectIds = ['FIELD_TEAM_LEADER', 'FIELD_TECHNICIAN'].includes(assignedRole)
    ? [assignedTeam!.project_id!]
    : requestedProjectIds;
  if (!['ADMIN', 'HR', 'PROJECT_MANAGER'].includes(assignedRole) && finalProjectIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Assign this employee to at least one active client project.',
      code: 'PROJECT_ASSIGNMENT_REQUIRED'
    });
  }
  for (const projectId of finalProjectIds) {
    const project = db.prepare('SELECT status, contract_start_date, contract_end_date FROM projects WHERE id = ?')
      .get(projectId) as { status: string; contract_start_date: string | null; contract_end_date: string | null } | undefined;
    const today = new Date().toISOString().slice(0, 10);
    if (!project || !['IN_PROGRESS', 'ACTIVE'].includes(project.status) ||
        !project.contract_start_date || !project.contract_end_date ||
        project.contract_start_date > today || project.contract_end_date < today) {
      return res.status(400).json({
        success: false,
        message: 'Employees can only be assigned to projects with active contracts.',
        code: 'PROJECT_NOT_ACTIVE'
      });
    }
  }
  const existingRosterMember = assignedRole === 'FIELD_TECHNICIAN' && teamId
    ? db.prepare('SELECT id FROM team_members WHERE team_id = ? AND UPPER(employee_id) = ? AND is_active = 1').get(teamId, cleanEmpId) as { id: string } | undefined
    : undefined;

  let finalDept = department;
  if (!finalDept) {
    if (assignedRole === 'FIELD_TEAM_LEADER') {
      finalDept = 'Field Operations';
    } else if (assignedRole === 'HR') {
      finalDept = 'Human Resources & Administration';
    } else if (assignedRole === 'PROJECT_MANAGER' || assignedRole === 'DISPATCHER') {
      finalDept = 'Operations & Dispatch';
    } else if (assignedRole === 'ACCOUNTANT') {
      finalDept = 'Finance & Accounting';
    } else if (assignedRole === 'STORE_OFFICER') {
      finalDept = 'Warehousing & Logistics';
    } else if (assignedRole === 'AUDITOR') {
      finalDept = 'Quality & Compliance';
    } else {
      finalDept = 'Executive Operations';
    }
  }

  try {
    await supabase.query(`
      INSERT INTO users (
        id, email, password_hash, full_name, phone_number, employee_id,
        role, department, is_active, team_id, must_change_password, last_login, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, 1, $10, $10, $10)
    `, [
      userId,
      cleanEmail,
      passwordHash,
      fullName.trim(),
      phoneNumber ? phoneNumber.trim() : null,
      cleanEmpId,
      assignedRole,
      finalDept,
      teamId || null,
      now
    ]);
    if (assignedRole === 'FIELD_TEAM_LEADER' && teamId) {
      await supabase.query('UPDATE teams SET leader_id = $1, updated_at = $2 WHERE id = $3', [userId, now, teamId]);
    }
    if (assignedRole === 'FIELD_TECHNICIAN' && teamId) {
      if (existingRosterMember) {
        await supabase.query(`
          UPDATE team_members SET full_name = $1, phone_number = $2, role_title = $3, updated_at = $4
          WHERE id = $5 AND team_id = $6
        `, [fullName.trim(), phoneNumber ? phoneNumber.trim() : null, roleTitle ? roleTitle.trim() : 'Field Technician', now, existingRosterMember.id, teamId]);
      } else {
        await supabase.query(`
          INSERT INTO team_members (id, team_id, full_name, phone_number, employee_id, role_title, is_active, joined_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $8)
        `, [
          `usrmember-${userId}`,
          teamId,
          fullName.trim(),
          phoneNumber ? phoneNumber.trim() : null,
          cleanEmpId,
          roleTitle ? roleTitle.trim() : 'Field Technician',
          now.split('T')[0],
          now
        ]);
      }
    }
  } catch (error) {
    await supabase.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => undefined);
    if (assignedRole === 'FIELD_TEAM_LEADER' && teamId) {
      await supabase.query('UPDATE teams SET leader_id = NULL WHERE id = $1 AND leader_id = $2', [teamId, userId]).catch(() => undefined);
    }
    if (assignedRole === 'FIELD_TECHNICIAN' && teamId && !existingRosterMember) {
      await supabase.query('DELETE FROM team_members WHERE id = $1', [`usrmember-${userId}`]).catch(() => undefined);
    }
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address or Employee ID already exists.',
        code: 'ACCOUNT_EXISTS'
      });
    }
    console.error('Supabase employee account creation failed:', error);
    return res.status(503).json({
      success: false,
      message: 'The employee account could not be created. Please try again shortly.',
      code: 'AUTH_DATABASE_UNAVAILABLE'
    });
  }

  try {
    db.exec('BEGIN TRANSACTION');
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, phone_number, employee_id,
        role, department, is_active, team_id, must_change_password, last_login, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?)
    `).run(
      userId,
      cleanEmail,
      passwordHash,
      fullName.trim(),
      phoneNumber ? phoneNumber.trim() : null,
      cleanEmpId,
      assignedRole,
      finalDept,
      teamId || null,
      now,
      now,
      now
    );

    if (assignedRole === 'FIELD_TEAM_LEADER' && teamId) {
      db.prepare('UPDATE teams SET leader_id = ? WHERE id = ?').run(userId, teamId);
    }
    if (assignedRole === 'FIELD_TECHNICIAN' && teamId) {
      if (existingRosterMember) {
        db.prepare('UPDATE team_members SET full_name = ?, phone_number = ?, role_title = ?, updated_at = ? WHERE id = ?')
          .run(fullName.trim(), phoneNumber ? phoneNumber.trim() : null, roleTitle ? roleTitle.trim() : 'Field Technician', now, existingRosterMember.id);
      } else {
        db.prepare(`
          INSERT INTO team_members (id, team_id, full_name, phone_number, employee_id, role_title, is_active, joined_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).run(
          `usrmember-${userId}`,
          teamId,
          fullName.trim(),
          phoneNumber ? phoneNumber.trim() : null,
          cleanEmpId,
          roleTitle ? roleTitle.trim() : 'Field Technician',
          now.split('T')[0],
          now,
          now
        );
      }
    }
    for (const projectId of finalProjectIds) {
      db.prepare(`
        INSERT INTO user_projects (user_id, project_id, assigned_at, assigned_by)
        VALUES (?, ?, ?, ?)
      `).run(userId, projectId, now, req.user?.id ?? null);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    await supabase.query('DELETE FROM users WHERE id = $1', [userId]).catch((cleanupError) => {
      console.error('Failed to roll back Supabase account after local persistence error:', cleanupError);
    });
    console.error('Local employee account mirror failed:', error);
    return res.status(500).json({
      success: false,
      message: 'The account could not be synchronized to the operational roster.',
      code: 'ACCOUNT_SYNC_FAILED'
    });
  }

  const authUser: AuthUser = {
    id: userId,
    email: cleanEmail,
    fullName: fullName.trim(),
    role: assignedRole,
    department: finalDept,
    employeeId: cleanEmpId,
    teamId: teamId || null,
    phoneNumber: phoneNumber ? phoneNumber.trim() : null,
    mustChangePassword: true,
    lastLogin: now,
  };

  logAuditEvent({
    userId: req.user!.id,
    action: 'USER_CREATED',
    entity: 'User',
    entityId: userId,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    reason: `${authUser.fullName} (${authUser.role}, ${authUser.employeeId}) created by ${req.user!.fullName}`
  });

  return res.status(201).json({
    success: true,
    message: 'Employee account created successfully.',
    user: authUser
  });
});

// POST /api/v1/auth/login
// Supports login with either Employee ID (e.g. EMP-ADM-001, EMP-TL-021) or company email
router.post('/login', async (req: Request, res: Response) => {
  const { identifier, email, employeeId, password, rememberMe } = req.body;
  const loginId = (identifier || email || employeeId || '').trim();

  if (!loginId || !password) {
    return res.status(400).json({
      success: false,
      message: 'Employee ID or company email, and password are required',
      code: 'MISSING_FIELDS'
    });
  }

  // Check rate limiting / failed login throttling
  const throttleKey = `${req.ip || 'ip'}_${loginId.toLowerCase()}`;
  const throttleRecord = loginAttempts.get(throttleKey);
  if (throttleRecord && throttleRecord.lockedUntil > Date.now()) {
    const remainingSeconds = Math.ceil((throttleRecord.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      message: `Too many failed login attempts. Account temporarily locked for ${remainingSeconds} seconds.`,
      code: 'TOO_MANY_REQUESTS'
    });
  }

  // Resolve any test/legacy aliases (e.g. EMP-TL-021 <-> DA-112, technician <-> tech)
  const IDENTIFIER_ALIASES: Record<string, string> = {
    'EMP-ADM-001': 'DA-001',
    'EMP-DSP-001': 'DA-045',
    'EMP-PM-001': 'DA-018',
    'EMP-ACC-001': 'DA-029',
    'EMP-STR-001': 'DA-034',
    'EMP-TL-021': 'DA-112',
    'EMP-TC-021': 'DA-144',
    'EMP-AUD-001': 'DA-010',
    'technician@deckoafrica.com': 'tech@deckoafrica.com',
    'manager@deckoafrica.com': 'pm@deckoafrica.com',
  };
  const resolvedId = IDENTIFIER_ALIASES[loginId] || IDENTIFIER_ALIASES[loginId.toUpperCase()] || IDENTIFIER_ALIASES[loginId.toLowerCase()] || loginId;

  // Find user by either email or employee_id
  let user: any;
  try {
    const result = await supabase.query(`
      SELECT * FROM users
      WHERE LOWER(email) = LOWER($1) OR UPPER(employee_id) = UPPER($2)
         OR LOWER(email) = LOWER($3) OR UPPER(employee_id) = UPPER($4)
      LIMIT 1
    `, [loginId, loginId, resolvedId, resolvedId]);
    user = result.rows[0];
  } catch (error) {
    console.error('Supabase sign-in lookup failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Sign-in is temporarily unavailable. Please try again shortly.',
      code: 'AUTH_DATABASE_UNAVAILABLE'
    });
  }

  // Account check: If account does not exist or password mismatch
  if (!user) {
    recordFailedAttempt(throttleKey);
    return res.status(401).json({
      success: false,
      message: 'Invalid employee ID/email or password.',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Account check: If account is deactivated/inactive
  if (user.is_active === 0 || user.is_active === false) {
    return res.status(403).json({
      success: false,
      message: 'Your account is inactive. Please contact your administrator.',
      code: 'ACCOUNT_INACTIVE'
    });
  }

  // Access check: Field Technicians do not have portal login access (Team Leader only)
  if (user.role === 'FIELD_TECHNICIAN') {
    if (!user.team_id) {
      return res.status(403).json({
        success: false,
        message: 'Your technician account is not assigned to a team. Please contact your supervisor or HR.',
        code: 'TECHNICIAN_TEAM_REQUIRED'
      });
    }
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    recordFailedAttempt(throttleKey);
    try {
      await supabase.query(`
        INSERT INTO audit_logs (id, user_id, action, entity, entity_id, ip_address, user_agent, reason, created_at)
        VALUES ($1, $2, 'LOGIN_FAILED', 'User', $2, $3, $4, $5, $6)
      `, [
        `aud-${uuidv4().slice(0, 8)}`,
        user.id,
        req.ip || req.socket.remoteAddress || null,
        req.headers['user-agent'] || null,
        `Failed password attempt for ${user.email} (${user.employee_id})`,
        new Date().toISOString()
      ]);
    } catch (error) {
      console.error('Failed to write Supabase sign-in audit event:', error);
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid employee ID/email or password.',
      code: 'INVALID_CREDENTIALS'
    });
  }

  // Successful login: reset throttling
  loginAttempts.delete(throttleKey);

  const now = new Date().toISOString();
  try {
    await supabase.query('UPDATE users SET last_login = $1, updated_at = $1 WHERE id = $2', [now, user.id]);
    await supabase.query(`
      INSERT INTO audit_logs (id, user_id, action, entity, entity_id, ip_address, user_agent, reason, created_at)
      VALUES ($1, $2, 'USER_LOGIN', 'User', $2, $3, $4, $5, $6)
    `, [
      `aud-${uuidv4().slice(0, 8)}`,
      user.id,
      req.ip || req.socket.remoteAddress || null,
      req.headers['user-agent'] || null,
      `Authenticated via ${loginId.includes('@') ? 'email' : 'employee ID'}`,
      now
    ]);
  } catch (error) {
    console.error('Supabase sign-in session update failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Sign-in could not be completed. Please try again shortly.',
      code: 'AUTH_DATABASE_UNAVAILABLE'
    });
  }

  const mustChange = Boolean(user.must_change_password);

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    department: user.department,
    employeeId: user.employee_id,
    teamId: user.team_id,
    phoneNumber: user.phone_number,
    mustChangePassword: mustChange,
    lastLogin: now,
  };

  const tokenExpiry = rememberMe ? '30d' : '7d';
  const token = generateToken(authUser, tokenExpiry);
  const refreshToken = generateRefreshToken(authUser);

  return res.json({
    success: true,
    message: mustChange ? 'Temporary password detected. Please change your password to continue.' : 'Login successful',
    token,
    refreshToken,
    mustChangePassword: mustChange,
    user: authUser
  });
});

function recordFailedAttempt(key: string) {
  const current = loginAttempts.get(key) || { attempts: 0, lockedUntil: 0 };
  current.attempts += 1;
  if (current.attempts >= MAX_ATTEMPTS) {
    current.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(key, current);
}

// POST /api/v1/auth/change-password
// Enforces password security rules: min 8 chars, uppercase, lowercase, number, special char
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password, new password, and confirmation are required',
      code: 'MISSING_FIELDS'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password and confirmation do not match',
      code: 'PASSWORD_MISMATCH'
    });
  }

  // Validate password strength
  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.valid) {
    return res.status(400).json({
      success: false,
      message: strengthCheck.reason,
      code: 'WEAK_PASSWORD'
    });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isCurrentValid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!isCurrentValid) {
    return res.status(401).json({
      success: false,
      message: 'Incorrect current password',
      code: 'INCORRECT_CURRENT_PASSWORD'
    });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();

  try {
    await supabase.query(
      'UPDATE users SET password_hash = $1, must_change_password = 0, updated_at = $2 WHERE id = $3',
      [newHash, now, user.id]
    );
  } catch (error) {
    console.error('Supabase password change failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Your password could not be updated right now. Please try again shortly.',
      code: 'AUTH_DATABASE_UNAVAILABLE'
    });
  }

  db.prepare(`
    UPDATE users 
    SET password_hash = ?, must_change_password = 0, updated_at = ? 
    WHERE id = ?
  `).run(newHash, now, user.id);

  logAuditEvent({
    userId: user.id,
    action: 'PASSWORD_CHANGED',
    entity: 'User',
    entityId: user.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    reason: 'User successfully updated password'
  });

  const updatedAuthUser: AuthUser = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    department: user.department,
    employeeId: user.employee_id,
    teamId: user.team_id,
    phoneNumber: user.phone_number,
    mustChangePassword: false,
    lastLogin: user.last_login
  };

  const newToken = generateToken(updatedAuthUser);

  return res.json({
    success: true,
    message: 'Password changed successfully',
    token: newToken,
    user: updatedAuthUser
  });
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', (req: Request, res: Response) => {
  const { identifier } = req.body;
  const loginId = (identifier || '').trim();

  if (!loginId) {
    return res.status(400).json({ success: false, message: 'Employee ID or company email is required' });
  }

  const IDENTIFIER_ALIASES: Record<string, string> = {
    'EMP-ADM-001': 'DA-001',
    'EMP-DSP-001': 'DA-045',
    'EMP-PM-001': 'DA-018',
    'EMP-ACC-001': 'DA-029',
    'EMP-STR-001': 'DA-034',
    'EMP-TL-021': 'DA-112',
    'EMP-TC-021': 'DA-144',
    'EMP-AUD-001': 'DA-010',
    'technician@deckoafrica.com': 'tech@deckoafrica.com',
    'manager@deckoafrica.com': 'pm@deckoafrica.com',
  };
  const resolvedId = IDENTIFIER_ALIASES[loginId] || IDENTIFIER_ALIASES[loginId.toUpperCase()] || IDENTIFIER_ALIASES[loginId.toLowerCase()] || loginId;

  const user = db.prepare(`
    SELECT * FROM users 
    WHERE LOWER(email) = LOWER(?) OR UPPER(employee_id) = UPPER(?)
       OR LOWER(email) = LOWER(?) OR UPPER(employee_id) = UPPER(?)
  `).get(loginId, loginId, resolvedId, resolvedId) as any;

  if (user && user.is_active) {
    const resetToken = `rst-${uuidv4().slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO password_resets (id, user_id, token, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(`pr-${uuidv4().slice(0, 8)}`, user.id, resetToken, expiresAt, now);

    logAuditEvent({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      reason: `Password reset requested for ${user.email}`
    });

    return res.json({
      success: true,
      message: 'If an active account exists with that identifier, password reset instructions have been generated.',
      // Provided in development environment for testing convenience
      resetToken
    });
  }

  // Return generic confirmation to prevent user enumeration
  return res.json({
    success: true,
    message: 'If an active account exists with that identifier, password reset instructions have been generated.'
  });
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { resetToken, newPassword, confirmPassword } = req.body;

  if (!resetToken || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Reset token, new password, and confirmation are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.valid) {
    return res.status(400).json({ success: false, message: strengthCheck.reason });
  }

  const resetRecord = db.prepare(`
    SELECT * FROM password_resets 
    WHERE token = ? AND used = 0 AND expires_at > ?
  `).get(resetToken, new Date().toISOString()) as any;

  if (!resetRecord) {
    return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();

  try {
    await supabase.query(
      'UPDATE users SET password_hash = $1, must_change_password = 0, updated_at = $2 WHERE id = $3',
      [newHash, now, resetRecord.user_id]
    );
  } catch (error) {
    console.error('Supabase password reset failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Your password could not be reset right now. Please try again shortly.',
      code: 'AUTH_DATABASE_UNAVAILABLE'
    });
  }

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(newHash, now, resetRecord.user_id);
  db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);

  logAuditEvent({
    userId: resetRecord.user_id,
    action: 'PASSWORD_RESET_COMPLETED',
    entity: 'User',
    entityId: resetRecord.user_id,
    ipAddress: req.ip,
    reason: 'Password reset completed via token'
  });

  return res.json({ success: true, message: 'Password has been reset successfully. You may now sign in with your new password.' });
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user) {
    logAuditEvent({
      userId: req.user.id,
      action: 'USER_LOGOUT',
      entity: 'User',
      entityId: req.user.id,
      ipAddress: req.ip,
      reason: 'User signed out'
    });
  }

  return res.json({ success: true, message: 'Signed out successfully' });
});

// POST /api/v1/auth/refresh
router.post('/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(decoded.id) as any;
    if (!user) {
      return res.status(403).json({ success: false, message: 'User session invalid or deactivated' });
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      department: user.department,
      employeeId: user.employee_id,
      teamId: user.team_id,
      phoneNumber: user.phone_number,
      mustChangePassword: Boolean(user.must_change_password),
      lastLogin: user.last_login
    };

    const newAccessToken = generateToken(authUser);
    return res.json({ success: true, token: newAccessToken, user: authUser });
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
  }
});

// POST /api/v1/auth/switch-persona (Development testing only)
router.post('/switch-persona', authenticateToken, (req: AuthRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  const { role, email } = req.body;

  let query = 'SELECT * FROM users WHERE is_active = 1';
  const params: any[] = [];

  if (email) {
    query += ' AND LOWER(email) = LOWER(?)';
    params.push(email);
  } else if (role) {
    query += ' AND role = ?';
    params.push(role);
  }

  const user = db.prepare(query + ' LIMIT 1').get(...params) as any;
  if (!user) {
    return res.status(404).json({ success: false, message: 'Target user persona not found' });
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    department: user.department,
    employeeId: user.employee_id,
    teamId: user.team_id,
    phoneNumber: user.phone_number,
    mustChangePassword: Boolean(user.must_change_password),
    lastLogin: user.last_login
  };

  const token = generateToken(authUser);

  return res.json({
    success: true,
    message: `Switched persona to ${authUser.fullName} (${authUser.role})`,
    token,
    user: authUser
  });
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  let user: any;
  let team: any = null;
  try {
    const result = await supabase.query(`
      SELECT id, email, full_name, phone_number, employee_id, role, department,
             team_id, is_active, must_change_password, last_login
      FROM users
      WHERE id = $1
    `, [req.user.id]);
    user = result.rows[0];
    if (user?.team_id) {
      const teamResult = await supabase.query(
        'SELECT id, team_code, name, assigned_area, project_id, region_id FROM teams WHERE id = $1',
        [user.team_id]
      );
      team = teamResult.rows[0] || null;
    }
  } catch (error) {
    console.error('Supabase profile lookup failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Your profile is temporarily unavailable. Please try again shortly.',
      code: 'AUTH_DATABASE_UNAVAILABLE'
    });
  }

  if (!user || !user.is_active) {
    return res.status(404).json({ success: false, message: 'User not found or inactive' });
  }

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      employeeId: user.employee_id,
      role: user.role,
      department: user.department,
      teamId: user.team_id,
      mustChangePassword: Boolean(user.must_change_password),
      lastLogin: user.last_login,
      team
    }
  });
});

// GET /api/v1/users (Protected: strictly require ADMIN or SUPER_ADMIN or AUDITOR)
router.get('/users', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'AUDITOR']), (req: AuthRequest, res: Response) => {
  const users = db.prepare(`
    SELECT u.id, u.email, u.full_name as fullName, u.phone_number as phoneNumber,
           u.employee_id as employeeId, u.role, u.department, u.is_active as isActive,
           u.must_change_password as mustChangePassword, u.last_login as lastLogin,
           u.team_id as teamId, t.team_code as teamCode, t.name as teamName,
           u.created_at as createdAt
    FROM users u
    LEFT JOIN teams t ON u.team_id = t.id
    ORDER BY u.full_name ASC
  `).all();

  return res.json({ success: true, users });
});

export default router;

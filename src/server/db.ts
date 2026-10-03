import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'decko_materials.db');
export const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for high performance & reliability
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      project_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      network_type TEXT NOT NULL DEFAULT 'FTTH',
      client TEXT NOT NULL DEFAULT 'Safaricom PLC',
      region_id TEXT,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      budget REAL NOT NULL DEFAULT 0.0,
      contract_start_date TEXT,
      contract_end_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      site_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      region_id TEXT,
      project_id TEXT,
      address TEXT,
      coordinates TEXT,
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      manager TEXT
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      team_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      leader_id TEXT,
      project_id TEXT,
      region_id TEXT,
      assigned_area TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      contact_info TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_projects (
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      assigned_by TEXT,
      PRIMARY KEY (user_id, project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone_number TEXT,
      employee_id TEXT,
      role_title TEXT DEFAULT 'Fibre Splicer & Aerial Technician',
      national_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      joined_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone_number TEXT,
      employee_id TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'FIELD_TECHNICIAN',
      department TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      team_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'FIBRE_CABLE',
      description TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      current_stock REAL NOT NULL DEFAULT 0.0,
      minimum_stock REAL NOT NULL DEFAULT 10.0,
      reorder_level REAL NOT NULL DEFAULT 20.0,
      maximum_stock REAL NOT NULL DEFAULT 1000.0,
      store_location TEXT,
      is_serial_required INTEGER NOT NULL DEFAULT 0,
      is_barcode_required INTEGER NOT NULL DEFAULT 0,
      is_scanning_mandatory INTEGER NOT NULL DEFAULT 0,
      requires_safaricom_tracking INTEGER NOT NULL DEFAULT 0,
      supplier TEXT,
      unit_cost REAL NOT NULL DEFAULT 0.0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracked_units (
      id TEXT PRIMARY KEY,
      serial_number TEXT NOT NULL UNIQUE,
      barcode TEXT,
      material_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN_STORE',
      current_location TEXT NOT NULL DEFAULT 'Warehouse',
      current_team_id TEXT,
      custodian_name TEXT,
      safaricom_tag TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      FOREIGN KEY (current_team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_balances (
      id TEXT PRIMARY KEY,
      warehouse_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0.0,
      updated_at TEXT NOT NULL,
      UNIQUE(warehouse_id, material_id),
      FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_stocks (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0.0,
      total_issued REAL NOT NULL DEFAULT 0.0,
      total_consumed REAL NOT NULL DEFAULT 0.0,
      total_returned REAL NOT NULL DEFAULT 0.0,
      total_damaged REAL NOT NULL DEFAULT 0.0,
      total_lost REAL NOT NULL DEFAULT 0.0,
      updated_at TEXT NOT NULL,
      UNIQUE(team_id, material_id),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      source TEXT,
      destination TEXT,
      reference TEXT,
      reason TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_requests (
      id TEXT PRIMARY KEY,
      request_number TEXT NOT NULL UNIQUE,
      team_id TEXT NOT NULL,
      requester_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      site_name TEXT,
      required_date TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      reason TEXT NOT NULL,
      work_order_ref TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      estimated_cost REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_request_items (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      quantity_requested REAL NOT NULL,
      quantity_approved REAL NOT NULL DEFAULT 0.0,
      quantity_issued REAL NOT NULL DEFAULT 0.0,
      quantity_remaining REAL NOT NULL DEFAULT 0.0,
      unit TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY (request_id) REFERENCES material_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      approver_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES material_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      accountant_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_reference TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      receipt_evidence TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'CONFIRMED',
      FOREIGN KEY (request_id) REFERENCES material_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (accountant_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_issues (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      store_officer_id TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_id TEXT,
      recipient_signature TEXT,
      is_partial INTEGER NOT NULL DEFAULT 0,
      issued_at TEXT NOT NULL,
      received_at TEXT,
      FOREIGN KEY (request_id) REFERENCES material_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (store_officer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_issue_items (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      quantity_issued REAL NOT NULL,
      tracked_unit_id TEXT,
      serial_number TEXT,
      FOREIGN KEY (issue_id) REFERENCES material_issues(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      FOREIGN KEY (tracked_unit_id) REFERENCES tracked_units(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS material_consumptions (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      quantity_consumed REAL NOT NULL,
      work_order TEXT,
      logged_by_id TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      FOREIGN KEY (logged_by_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_returns (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      team_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACCEPTED',
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES material_requests(id) ON DELETE SET NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      tracked_unit_id TEXT,
      serial_number TEXT,
      condition TEXT NOT NULL DEFAULT 'GOOD',
      notes TEXT,
      FOREIGN KEY (return_id) REFERENCES material_returns(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      FOREIGN KEY (tracked_unit_id) REFERENCES tracked_units(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      previous_value TEXT,
      new_value TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Column migrations if schema upgraded
  try {
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec('ALTER TABLE users ADD COLUMN last_login TEXT;');
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE projects ADD COLUMN network_type TEXT NOT NULL DEFAULT 'FTTH';");
  } catch (e) {
    // Column already exists
  }
  for (const column of ['contract_start_date TEXT', 'contract_end_date TEXT']) {
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN ${column};`);
    } catch (e) {
      // Column already exists
    }
  }

  seedInitialData();
  removeSeededDemoTeams();
  removeSeededOperationalDemoData();
}

function removeSeededDemoTeams() {
  const marker = db.prepare("SELECT value FROM system_settings WHERE key = 'seeded_demo_teams_removed'").get();
  if (marker) return;

  const seededTeams = [
    { id: 'team-ftth-021', teamCode: 'FTTH-021', name: 'FTTH Alpha Installation Team' },
    { id: 'team-ftth-012', teamCode: 'FTTH-012', name: 'FTTH Bravo Splicing & Testing Team' },
    { id: 'team-fttb-005', teamCode: 'FTTB-005', name: 'Central FTTB Backbone Construction Team' }
  ];
  const findTeam = db.prepare('SELECT id FROM teams WHERE id = ? AND team_code = ? AND name = ?');
  const counts = (table: string, column: string, teamId: string) =>
    (db.prepare(`SELECT count(*) as count FROM ${table} WHERE ${column} = ?`).get(teamId) as { count: number }).count;
  const removalTargets = seededTeams.filter((team) => findTeam.get(team.id, team.teamCode, team.name));
  const hasOperationalHistory = removalTargets.some(({ id }) =>
    counts('material_requests', 'team_id', id) > 0 ||
    counts('material_consumptions', 'team_id', id) > 0 ||
    counts('material_returns', 'team_id', id) > 0 ||
    counts('tracked_units', 'current_team_id', id) > 0
  );

  if (hasOperationalHistory) {
    console.warn('Seeded demo teams were retained because they contain operational history.');
    return;
  }

  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    for (const team of removalTargets) {
      db.prepare('UPDATE users SET team_id = NULL, updated_at = ? WHERE team_id = ?').run(now, team.id);
      db.prepare('DELETE FROM teams WHERE id = ?').run(team.id);
    }
    db.prepare(`
      INSERT INTO system_settings (key, value, description, updated_at)
      VALUES ('seeded_demo_teams_removed', 'true', 'One-time removal of seeded demo field teams', ?)
    `).run(now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function removeSeededOperationalDemoData() {
  const marker = db.prepare("SELECT value FROM system_settings WHERE key = 'seeded_operational_demo_data_removed'").get();
  if (marker) return;

  const seededProjectIds = ['prj-nbi-ftth', 'prj-thk-fttb', 'prj-mbs-back', 'prj-nkr-fttd'];
  const seededSiteIds = ['site-01', 'site-02', 'site-03'];
  const seededWarehouseIds = ['wh-central', 'wh-mombasa'];
  const seededMaterialIds = Array.from({ length: 18 }, (_, index) => `mat-${String(index + 1).padStart(2, '0')}`);
  const requestIds = ['req-001', 'req-002', 'req-03efc014', 'req-63b3e5a7'];
  const placeholders = (ids: string[]) => ids.map(() => '?').join(',');
  const seededBalanceIds = seededMaterialIds.map((id) => `bal-${id}`);
  const demoUnitIds = ['unit-lp-01', 'unit-lp-02', 'unit-lp-03', 'unit-opm-01', 'unit-opm-02', 'unit-clv-01', 'unit-clv-02', 'unit-ont-01', 'unit-ont-02'];
  const hasOperationalHistory = db.prepare(`
    SELECT
      (SELECT count(*) FROM material_requests WHERE project_id IN (${seededProjectIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM material_request_items mri JOIN material_requests mr ON mr.id = mri.request_id
        WHERE mr.project_id IN (${seededProjectIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM material_request_items WHERE material_id IN (${seededMaterialIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM material_issue_items WHERE material_id IN (${seededMaterialIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM material_consumptions WHERE material_id IN (${seededMaterialIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM material_return_items WHERE material_id IN (${seededMaterialIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM tracked_units WHERE material_id IN (${seededMaterialIds.map(() => '?').join(',')})
        AND id NOT IN (${demoUnitIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM team_stocks WHERE material_id IN (${seededMaterialIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM inventory_balances WHERE material_id IN (${seededMaterialIds.map(() => '?').join(',')})
        AND id NOT IN (${seededBalanceIds.map(() => '?').join(',')})) +
      (SELECT count(*) FROM inventory_transactions WHERE material_id IN (${seededMaterialIds.map(() => '?').join(',')})
        AND id NOT IN (${seededMaterialIds.map(() => '?').join(',')})
        AND COALESCE(reference, '') != 'REQ-2026-000003') AS count
  `).get(
    ...seededProjectIds,
    ...seededProjectIds,
    ...seededMaterialIds,
    ...seededMaterialIds,
    ...seededMaterialIds,
    ...seededMaterialIds,
    ...demoUnitIds,
    ...seededMaterialIds,
    ...seededMaterialIds,
    ...seededBalanceIds,
    ...seededMaterialIds,
    ...seededMaterialIds
  ) as { count: number };

  if (hasOperationalHistory.count > 0) {
    console.warn('Seeded demo inventory and projects were retained because operational history references them.');
    return;
  }

  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    const seededTransactionIds = seededMaterialIds.map((id) => `tx-init-${id}`);
    db.prepare(`DELETE FROM inventory_transactions WHERE id IN (${placeholders(seededTransactionIds)}) OR reference = 'REQ-2026-000003'`)
      .run(...seededTransactionIds);
    db.prepare(`DELETE FROM inventory_balances WHERE id IN (${placeholders(seededBalanceIds)})`).run(...seededBalanceIds);
    db.prepare(`DELETE FROM tracked_units WHERE id IN (${placeholders(demoUnitIds)})`).run(...demoUnitIds);
    db.prepare(`DELETE FROM audit_logs WHERE id IN ('aud-01', 'aud-02', 'aud-03', 'aud-04') OR (entity = 'MaterialRequest' AND entity_id IN (${placeholders(requestIds)}))`)
      .run(...requestIds);
    db.prepare(`DELETE FROM notifications WHERE link IN (${placeholders(requestIds.map((id) => `/requests/${id}`))})`)
      .run(...requestIds.map((id) => `/requests/${id}`));
    db.prepare(`DELETE FROM sites WHERE id IN (${placeholders(seededSiteIds)})`).run(...seededSiteIds);
    db.prepare(`DELETE FROM projects WHERE id IN (${placeholders(seededProjectIds)})`).run(...seededProjectIds);
    db.prepare(`DELETE FROM inventory_balances WHERE warehouse_id IN (${placeholders(seededWarehouseIds)})`).run(...seededWarehouseIds);
    db.prepare(`DELETE FROM warehouses WHERE id IN (${placeholders(seededWarehouseIds)})`).run(...seededWarehouseIds);
    db.prepare(`DELETE FROM materials WHERE id IN (${placeholders(seededMaterialIds)})`).run(...seededMaterialIds);
    db.prepare("DELETE FROM regions WHERE id IN ('reg-nairobi', 'reg-central', 'reg-coast', 'reg-rift')").run();
    db.prepare(`
      INSERT INTO system_settings (key, value, description, updated_at)
      VALUES ('seeded_operational_demo_data_removed', 'true', 'One-time removal of seeded operational demo data', ?)
    `).run(now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function seedInitialData() {
  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (userCount && userCount.count > 0) {
    return; // Database already seeded
  }

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync('Decko2026!', 10);

  // 1. Settings
  const insertSetting = db.prepare('INSERT INTO system_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)');
  insertSetting.run('company_name', 'Decko Africa Ltd.', 'Corporate Entity Name', now);
  insertSetting.run('company_website', 'https://deckoafrica.com', 'Corporate Website', now);
  insertSetting.run('sla_approval_hours', '4', 'Target SLA for Request Approval', now);
  insertSetting.run('sla_payment_hours', '8', 'Target SLA for Accounting Payment Processing', now);
  insertSetting.run('sla_issue_hours', '4', 'Target SLA for Store Issuance', now);
  insertSetting.run('safaricom_tracking_enabled', 'true', 'Mandatory Tracking for Safaricom Equipment', now);

  // Keep current account bootstrap data, but operational records are created from the live admin flows.
  const insertUser = db.prepare('INSERT INTO users (id, email, password_hash, full_name, phone_number, employee_id, role, department, is_active, team_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  // Super Admin / Master Accounts
  insertUser.run('usr-micah', 'emicah565@gmail.com', passwordHash, 'Micah', '+254 700 000 000', 'DA-000', 'SUPER_ADMIN', 'Executive Operations', 1, null, now, now);
  insertUser.run('usr-admin', 'admin@deckoafrica.com', passwordHash, 'David Gachanja', '+254 722 100 001', 'DA-001', 'SUPER_ADMIN', 'Executive Management', 1, null, now, now);
  // Dispatcher
  insertUser.run('usr-disp', 'dispatcher@deckoafrica.com', passwordHash, 'Dennis Mwangi', '+254 722 200 002', 'DA-045', 'DISPATCHER', 'Operations & Dispatch', 1, null, now, now);
  // Project Manager
  insertUser.run('usr-pm', 'pm@deckoafrica.com', passwordHash, 'Sarah Kamau', '+254 722 300 003', 'DA-018', 'PROJECT_MANAGER', 'Project Engineering', 1, null, now, now);
  // Accountant
  insertUser.run('usr-acct', 'accountant@deckoafrica.com', passwordHash, 'Kelvin Ochieng', '+254 722 400 004', 'DA-029', 'ACCOUNTANT', 'Finance & Accounting', 1, null, now, now);
  // Store Officer
  insertUser.run('usr-store', 'store@deckoafrica.com', passwordHash, 'George Otieno', '+254 722 500 005', 'DA-034', 'STORE_OFFICER', 'Warehousing & Logistics', 1, null, now, now);
  // Auditor
  insertUser.run('usr-audit', 'auditor@deckoafrica.com', passwordHash, 'Grace Wanjiku', '+254 722 990 008', 'DA-010', 'AUDITOR', 'Quality & Compliance', 1, null, now, now);
  // Procurement Officer
  insertUser.run('usr-proc', 'procurement@deckoafrica.com', passwordHash, 'Faith Chebet', '+254 722 660 009', 'DA-055', 'PROCUREMENT_OFFICER', 'Procurement', 1, null, now, now);


}

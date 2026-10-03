-- Generated from the current operational SQLite schema; PostgreSQL-compatible DDL.
CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE
    );

CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      project_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      client TEXT NOT NULL DEFAULT 'Safaricom PLC',
      region_id TEXT,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      budget REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, network_type TEXT NOT NULL DEFAULT 'FTTH', contract_start_date TEXT, contract_end_date TEXT,
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL
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
      updated_at TEXT NOT NULL, must_change_password INTEGER NOT NULL DEFAULT 0, last_login TEXT,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      manager TEXT
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

CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS user_projects (
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      assigned_by TEXT,
      PRIMARY KEY (user_id, project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

ALTER TABLE projects ADD COLUMN IF NOT EXISTS network_type TEXT NOT NULL DEFAULT 'FTTH';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_start_date TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_end_date TEXT;

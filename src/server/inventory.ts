import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken, requireRole } from './auth.js';
import { logAuditEvent } from './audit.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/v1/inventory or /api/v1/inventory/balances
router.get(['/', '/balances'], authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'FIELD_TECHNICIAN') {
    return res.status(403).json({ success: false, message: 'Technicians can view their assigned team stock from Teams & Stock.', code: 'INSUFFICIENT_PERMISSIONS' });
  }
  const { warehouseId, lowStockOnly } = req.query;

  let query = `
    SELECT ib.id, ib.warehouse_id as warehouseId, w.name as warehouseName, w.code as warehouseCode,
           m.id as materialId, m.sku, m.name as materialName, m.category, m.unit,
           ib.quantity as warehouseStock, m.current_stock as totalStock,
           m.minimum_stock as minimumStock, m.reorder_level as reorderLevel,
           m.is_serial_required as isSerialRequired, m.requires_safaricom_tracking as requiresSafaricomTracking,
           m.store_location as storeLocation, m.unit_cost as unitCost
    FROM inventory_balances ib
    JOIN materials m ON ib.material_id = m.id
    JOIN warehouses w ON ib.warehouse_id = w.id
    WHERE m.is_active = 1
  `;
  const params: any[] = [];

  if (warehouseId) {
    query += ' AND ib.warehouse_id = ?';
    params.push(warehouseId);
  }
  if (lowStockOnly === 'true') {
    query += ' AND m.current_stock <= m.minimum_stock';
  }

  query += ' ORDER BY m.name ASC';
  const balances = db.prepare(query).all(...params);

  return res.json({ success: true, count: balances.length, balances });
});

router.get('/warehouses', authenticateToken, (req: AuthRequest, res: Response) => {
  const warehouses = db.prepare(`
    SELECT id, code, name, location, manager
    FROM warehouses
    ORDER BY name ASC
  `).all();
  return res.json({ success: true, count: warehouses.length, warehouses });
});

router.post('/warehouses', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_OFFICER']), (req: AuthRequest, res: Response) => {
  const { code, name, location, manager } = req.body;
  if (typeof code !== 'string' || !code.trim() ||
      typeof name !== 'string' || !name.trim() ||
      typeof location !== 'string' || !location.trim()) {
    return res.status(400).json({ success: false, message: 'Warehouse code, name, and location are required.' });
  }

  const cleanCode = code.trim().toUpperCase();
  if (db.prepare('SELECT id FROM warehouses WHERE UPPER(code) = ?').get(cleanCode)) {
    return res.status(409).json({ success: false, message: `Warehouse code ${cleanCode} is already in use.` });
  }

  const id = `wh-${uuidv4().slice(0, 8)}`;
  db.prepare('INSERT INTO warehouses (id, code, name, location, manager) VALUES (?, ?, ?, ?, ?)')
    .run(id, cleanCode, name.trim(), location.trim(), typeof manager === 'string' && manager.trim() ? manager.trim() : null);
  logAuditEvent({
    userId: req.user?.id,
    action: 'WAREHOUSE_CREATED',
    entity: 'Warehouse',
    entityId: id,
    ipAddress: req.ip,
    newValue: { code: cleanCode, name: name.trim(), location: location.trim() },
    reason: `Warehouse ${cleanCode} created`
  });
  const warehouse = db.prepare('SELECT id, code, name, location, manager FROM warehouses WHERE id = ?').get(id);
  return res.status(201).json({ success: true, message: 'Warehouse created successfully.', warehouse });
});

// GET /api/v1/inventory/transactions (Ledger)
router.get('/transactions', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user?.role === 'FIELD_TECHNICIAN') {
    return res.status(403).json({ success: false, message: 'Warehouse inventory transactions are restricted to authorized operations staff.', code: 'INSUFFICIENT_PERMISSIONS' });
  }
  const { materialId, type, limit } = req.query;

  let query = `
    SELECT it.id, it.material_id as materialId, m.sku, m.name as materialName, m.unit,
           it.type, it.quantity, it.previous_stock as previousStock, it.new_stock as newStock,
           it.source, it.destination, it.reference, it.reason,
           it.user_id as userId, u.full_name as userName, it.created_at as createdAt
    FROM inventory_transactions it
    JOIN materials m ON it.material_id = m.id
    LEFT JOIN users u ON it.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (req.user?.role === 'FIELD_TECHNICIAN') {
    if (!req.user.teamId) {
      return res.status(403).json({ success: false, message: 'Your account is not assigned to a field team.', code: 'TEAM_REQUIRED' });
    }
    query += ' AND tu.current_team_id = ?';
    params.push(req.user.teamId);
  }

  if (materialId) {
    query += ' AND it.material_id = ?';
    params.push(materialId);
  }
  if (type) {
    query += ' AND it.type = ?';
    params.push(type);
  }

  query += ' ORDER BY it.created_at DESC LIMIT ?';
  params.push(Number(limit) || 100);

  const transactions = db.prepare(query).all(...params);
  return res.json({ success: true, count: transactions.length, transactions });
});

// POST /api/v1/inventory/adjust (Stock Adjustment)
router.post('/adjust', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_OFFICER']), (req: AuthRequest, res: Response) => {
  const { materialId, warehouseId, type, quantity, reason, reference } = req.body;

  if (!materialId || !type || quantity === undefined) {
    return res.status(400).json({ success: false, message: 'materialId, type, and quantity are required' });
  }

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
  if (!material) {
    return res.status(404).json({ success: false, message: 'Material not found' });
  }

  const numQty = Number(quantity);
  if (isNaN(numQty) || numQty <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
  }

  const targetWh = typeof warehouseId === 'string' ? warehouseId : '';
  if (!targetWh) {
    return res.status(400).json({ success: false, message: 'Select a warehouse for this inventory adjustment.', code: 'WAREHOUSE_REQUIRED' });
  }
  if (!db.prepare('SELECT id FROM warehouses WHERE id = ?').get(targetWh)) {
    return res.status(400).json({ success: false, message: 'Selected warehouse does not exist.', code: 'INVALID_WAREHOUSE' });
  }
  const prevStock = Number(material.current_stock);
  let newStock = prevStock;

  if (['RECEIPT', 'PURCHASE', 'RETURN'].includes(type)) {
    newStock = prevStock + numQty;
  } else if (['ISSUE', 'DAMAGE', 'LOSS', 'DISPOSAL', 'ADJUSTMENT'].includes(type)) {
    if (prevStock < numQty && type !== 'ADJUSTMENT') {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory balance. Current stock is ${prevStock} ${material.unit}. Cannot deduct ${numQty} ${material.unit}.`,
        code: 'NEGATIVE_INVENTORY_PROHIBITED'
      });
    }
    newStock = Math.max(0, prevStock - numQty);
  }

  const now = new Date().toISOString();
  const txId = `tx-${uuidv4().slice(0, 8)}`;

  // Atomic database update
  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare('UPDATE materials SET current_stock = ?, updated_at = ? WHERE id = ?').run(newStock, now, materialId);
    
    // Update or insert warehouse balance
    const existingBal = db.prepare('SELECT id, quantity FROM inventory_balances WHERE warehouse_id = ? AND material_id = ?').get(targetWh, materialId) as any;
    if (existingBal) {
      const whNew = ['RECEIPT', 'PURCHASE', 'RETURN'].includes(type) ? Number(existingBal.quantity) + numQty : Math.max(0, Number(existingBal.quantity) - numQty);
      db.prepare('UPDATE inventory_balances SET quantity = ?, updated_at = ? WHERE id = ?').run(whNew, now, existingBal.id);
    } else {
      db.prepare('INSERT INTO inventory_balances (id, warehouse_id, material_id, quantity, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(`bal-${uuidv4().slice(0, 8)}`, targetWh, materialId, newStock, now);
    }

    db.prepare(`
      INSERT INTO inventory_transactions (id, material_id, type, quantity, previous_stock, new_stock, source, destination, reference, reason, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      txId, materialId, type, numQty, prevStock, newStock,
      targetWh, 'Adjustment', reference || 'MANUAL-ADJ', reason || 'Manual inventory adjustment',
      req.user?.id ?? null, now
    );

    db.exec('COMMIT');
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Adjustment transaction failed: ' + err.message });
  }

  logAuditEvent({
    userId: req.user?.id,
    action: 'STOCK_ADJUSTED',
    entity: 'Inventory',
    entityId: materialId,
    ipAddress: req.ip,
    previousValue: { stock: prevStock },
    newValue: { stock: newStock, delta: numQty, type },
    reason
  });

  return res.json({
    success: true,
    message: `Inventory successfully adjusted. New stock: ${newStock} ${material.unit}`,
    previousStock: prevStock,
    newStock
  });
});

// GET /api/v1/inventory/tracked-units (Serial number controlled tools & Safaricom devices)
router.get('/tracked-units', authenticateToken, (req: AuthRequest, res: Response) => {
  const { materialId, status, search } = req.query;

  let query = `
    SELECT tu.id, tu.serial_number as serialNumber, tu.barcode, tu.material_id as materialId,
           m.name as materialName, m.sku, m.category, tu.status, tu.current_location as currentLocation,
           tu.current_team_id as currentTeamId, t.team_code as teamCode, t.name as teamName,
           tu.custodian_name as custodianName, tu.safaricom_tag as safaricomTag,
           tu.created_at as createdAt, tu.updated_at as updatedAt
    FROM tracked_units tu
    JOIN materials m ON tu.material_id = m.id
    LEFT JOIN teams t ON tu.current_team_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (materialId) {
    query += ' AND tu.material_id = ?';
    params.push(materialId);
  }
  if (status) {
    query += ' AND tu.status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (tu.serial_number LIKE ? OR tu.barcode LIKE ? OR tu.safaricom_tag LIKE ? OR tu.custodian_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY tu.updated_at DESC';
  const units = db.prepare(query).all(...params);

  return res.json({ success: true, count: units.length, units });
});

// GET /api/v1/inventory/chain-of-custody/:serial (Complete serial timeline history)
router.get('/chain-of-custody/:serial', authenticateToken, (req: AuthRequest, res: Response) => {
  const serial = req.params.serial.trim();

  const unit = db.prepare(`
    SELECT tu.*, m.name as materialName, m.sku, m.category, m.requires_safaricom_tracking as requiresSafaricomTracking,
           t.team_code as teamCode, t.name as teamName
    FROM tracked_units tu
    JOIN materials m ON tu.material_id = m.id
    LEFT JOIN teams t ON tu.current_team_id = t.id
    WHERE tu.serial_number = ? OR tu.barcode = ?
  `).get(serial, serial) as any;

  if (!unit) {
    return res.status(404).json({ success: false, message: `No tracked unit found for identifier: ${serial}` });
  }

  if (req.user?.role === 'FIELD_TECHNICIAN' && unit.current_team_id !== req.user.teamId) {
    return res.status(403).json({ success: false, message: 'You can only view custody for equipment assigned to your team.', code: 'TEAM_ACCESS_DENIED' });
  }

  // Find all issues where this serial was included
  const issues = db.prepare(`
    SELECT mi.id, mi.request_id as requestId, mr.request_number as requestNumber,
           t.team_code as teamCode, t.name as teamName, p.name as projectName,
           mi.recipient_name as recipientName, u.full_name as storeOfficerName,
           mi.issued_at as timestamp, 'ISSUED_TO_TEAM' as eventType
    FROM material_issue_items mii
    JOIN material_issues mi ON mii.issue_id = mi.id
    JOIN material_requests mr ON mi.request_id = mr.id
    JOIN teams t ON mr.team_id = t.id
    JOIN projects p ON mr.project_id = p.id
    JOIN users u ON mi.store_officer_id = u.id
    WHERE mii.serial_number = ? OR mii.tracked_unit_id = ?
    ORDER BY mi.issued_at ASC
  `).all(unit.serial_number, unit.id);

  // Find all returns where this serial was returned
  const returns = db.prepare(`
    SELECT mr.id, mr.request_id as requestId, req.request_number as requestNumber,
           t.team_code as teamCode, t.name as teamName,
           u.full_name as receiverName, mri.condition, mri.notes,
           mr.created_at as timestamp, 'RETURNED_TO_STORE' as eventType
    FROM material_return_items mri
    JOIN material_returns mr ON mri.return_id = mr.id
    LEFT JOIN material_requests req ON mr.request_id = req.id
    JOIN teams t ON mr.team_id = t.id
    JOIN users u ON mr.receiver_id = u.id
    WHERE mri.serial_number = ? OR mri.tracked_unit_id = ?
    ORDER BY mr.created_at ASC
  `).all(unit.serial_number, unit.id);

  const chain = [...issues, ...returns].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return res.json({
    success: true,
    unit: {
      id: unit.id,
      serialNumber: unit.serial_number,
      barcode: unit.barcode,
      materialName: unit.materialName,
      sku: unit.sku,
      category: unit.category,
      status: unit.status,
      currentLocation: unit.current_location,
      custodianName: unit.custodian_name,
      teamCode: unit.teamCode,
      safaricomTag: unit.safaricom_tag,
      requiresSafaricomTracking: !!unit.requiresSafaricomTracking
    },
    chain
  });
});

export default router;

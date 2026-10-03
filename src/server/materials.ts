import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken, requireRole } from './auth.js';
import { logAuditEvent } from './audit.js';
import { v4 as uuidv4 } from 'uuid';
import { createAsyncRouter } from './asyncRouter.js';

const router = createAsyncRouter();

// GET /api/v1/materials
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { category, search, activeOnly, lowStockOnly } = req.query;

  let query = `
    SELECT id, sku, name, category, description, unit, current_stock as currentStock,
           minimum_stock as minimumStock, reorder_level as reorderLevel, maximum_stock as maximumStock,
           store_location as storeLocation, is_serial_required as isSerialRequired,
           is_barcode_required as isBarcodeRequired, is_scanning_mandatory as isScanningMandatory,
           requires_safaricom_tracking as requiresSafaricomTracking, supplier, unit_cost as unitCost,
           is_active as isActive, created_at as createdAt, updated_at as updatedAt
    FROM materials
    WHERE 1=1
  `;
  const params: any[] = [];

  if (activeOnly !== 'false') {
    query += ' AND is_active = 1';
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    query += ' AND (sku LIKE ? OR name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (lowStockOnly === 'true') {
    query += ' AND current_stock <= minimum_stock';
  }

  query += ' ORDER BY name ASC';
  const materials = await db.prepare(query).all(...params);

  return res.json({ success: true, count: materials.length, materials });
});

// GET /api/v1/materials/categories
router.get('/categories', authenticateToken, (req: AuthRequest, res: Response) => {
  const categories = [
    { code: 'FIBRE_CABLE', label: 'Fibre Optical Cable' },
    { code: 'CONNECTORS', label: 'Connectors & Patch Cords' },
    { code: 'SPLITTERS', label: 'Optical Splitters (PLC)' },
    { code: 'TOOLS', label: 'Field Splicing & Cleaving Tools' },
    { code: 'TESTING_EQUIPMENT', label: 'Optical Power Meters & Testers' },
    { code: 'INSTALLATION_MATERIALS', label: 'Clamps, Sleeves & Suspension' },
    { code: 'CONSUMABLES', label: 'Cleaning Materials & Ties' },
    { code: 'SAFETY_PPE', label: 'Safety & PPE Equipment' },
    { code: 'NETWORK_EQUIPMENT', label: 'FAT Boxes, ATBs, ONTs & Routers' },
    { code: 'ELECTRICAL', label: 'Power & Electrical Supplies' },
    { code: 'OTHER', label: 'Other Telecom Materials' }
  ];
  return res.json({ success: true, categories });
});

// GET /api/v1/materials/:id
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const material = await db.prepare(`
    SELECT id, sku, name, category, description, unit, current_stock as currentStock,
           minimum_stock as minimumStock, reorder_level as reorderLevel, maximum_stock as maximumStock,
           store_location as storeLocation, is_serial_required as isSerialRequired,
           is_barcode_required as isBarcodeRequired, is_scanning_mandatory as isScanningMandatory,
           requires_safaricom_tracking as requiresSafaricomTracking, supplier, unit_cost as unitCost,
           is_active as isActive, created_at as createdAt, updated_at as updatedAt
    FROM materials
    WHERE id = ?
  `).get(req.params.id) as any;

  if (!material) {
    return res.status(404).json({ success: false, message: 'Material not found' });
  }

  const trackedUnits = await db.prepare(`
    SELECT id, serial_number as serialNumber, barcode, status, current_location as currentLocation,
           current_team_id as currentTeamId, custodian_name as custodianName, safaricom_tag as safaricomTag
    FROM tracked_units
    WHERE material_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);

  return res.json({ success: true, material: { ...material, trackedUnits } });
});

// POST /api/v1/materials (Create material - admin/store/procurement)
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_OFFICER', 'PROCUREMENT_OFFICER']), async (req: AuthRequest, res: Response) => {
  const {
    sku, name, category, description, unit, minimumStock, reorderLevel, maximumStock,
    storeLocation, isSerialRequired, isBarcodeRequired, isScanningMandatory,
    requiresSafaricomTracking, supplier, unitCost, initialStock, warehouseId
  } = req.body;

  if (!sku || !name || !category) {
    return res.status(400).json({ success: false, message: 'SKU, name, and category are required' });
  }

  const existing = await db.prepare('SELECT id FROM materials WHERE sku = ?').get(sku);
  if (existing) {
    return res.status(400).json({ success: false, message: 'Material with this SKU already exists' });
  }

  const id = `mat-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();
  const stock = Number(initialStock) || 0;
  if (!Number.isFinite(stock) || stock < 0) {
    return res.status(400).json({ success: false, message: 'Initial stock must be a non-negative number.' });
  }
  const initialWarehouse = stock > 0 && typeof warehouseId === 'string'
    ? await db.prepare('SELECT id, name FROM warehouses WHERE id = ?').get(warehouseId) as { id: string; name: string } | undefined
    : undefined;
  if (stock > 0 && !initialWarehouse) {
    return res.status(400).json({
      success: false,
      message: 'Select an existing warehouse before assigning initial stock.',
      code: 'WAREHOUSE_REQUIRED'
    });
  }

  await db.prepare(`
    INSERT INTO materials (
      id, sku, name, category, description, unit, current_stock, minimum_stock, reorder_level, maximum_stock,
      store_location, is_serial_required, is_barcode_required, is_scanning_mandatory, requires_safaricom_tracking,
      supplier, unit_cost, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id, sku.trim().toUpperCase(), name.trim(), category, description || null, unit || 'pcs',
    stock, Number(minimumStock) || 10, Number(reorderLevel) || 20, Number(maximumStock) || 1000,
    storeLocation || null, isSerialRequired ? 1 : 0, isBarcodeRequired ? 1 : 0,
    isScanningMandatory ? 1 : 0, requiresSafaricomTracking ? 1 : 0,
    supplier || null, Number(unitCost) || 0, now, now
  );

  if (stock > 0) {
    await db.prepare('INSERT INTO inventory_balances (id, warehouse_id, material_id, quantity, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(`bal-${id}`, initialWarehouse!.id, id, stock, now);

    await db.prepare(`
      INSERT INTO inventory_transactions (id, material_id, type, quantity, previous_stock, new_stock, source, destination, reference, reason, user_id, created_at)
      VALUES (?, ?, 'RECEIPT', ?, 0, ?, 'Initial Setup', ?, 'INIT-ITEM', 'Initial Stock Setup', ?, ?)
    `).run(`tx-${uuidv4().slice(0, 8)}`, id, stock, stock, initialWarehouse!.name, req.user?.id ?? null, now);
  }

  await logAuditEvent({
    userId: req.user?.id,
    action: 'MATERIAL_CREATED',
    entity: 'Material',
    entityId: id,
    ipAddress: req.ip,
    newValue: { sku, name, category, stock },
    reason: 'New material added to master'
  });

  return res.status(201).json({ success: true, message: 'Material created successfully', id });
});

export default router;

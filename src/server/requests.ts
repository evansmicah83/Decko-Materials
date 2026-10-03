import { Router, Response } from 'express';
import { db } from './db.js';
import { AuthRequest, authenticateToken, requireRole } from './auth.js';
import { logAuditEvent } from './audit.js';
import { createNotification, notifyRoles } from './notifications.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use('/:id', authenticateToken, (req: AuthRequest, res: Response, next) => {
  if (!['FIELD_TECHNICIAN', 'FIELD_TEAM_LEADER'].includes(req.user?.role || '')) return next();
  if (!req.user?.teamId) {
    return res.status(403).json({ success: false, message: 'Your account is not assigned to a field team.', code: 'TEAM_REQUIRED' });
  }
  const id = req.params.id;
  const request = db.prepare('SELECT team_id FROM material_requests WHERE id = ? OR request_number = ?').get(id, id) as { team_id: string } | undefined;
  if (request && request.team_id !== req.user.teamId) {
    return res.status(403).json({ success: false, message: 'You can only access requests for your assigned team.', code: 'TEAM_ACCESS_DENIED' });
  }
  return next();
});

function generateRequestNumber(): string {
  const year = new Date().getFullYear();
  const countRow = db.prepare('SELECT count(*) as count FROM material_requests').get() as { count: number };
  const nextNum = (countRow?.count || 0) + 1;
  return `REQ-${year}-${String(nextNum).padStart(6, '0')}`;
}

function deductWarehouseBalances(materialId: string, quantity: number, updatedAt: string): string {
  const balances = db.prepare(`
    SELECT ib.id, ib.quantity, w.code
    FROM inventory_balances ib
    JOIN warehouses w ON w.id = ib.warehouse_id
    WHERE ib.material_id = ? AND ib.quantity > 0
    ORDER BY ib.quantity DESC, w.code ASC
  `).all(materialId) as Array<{ id: string; quantity: number; code: string }>;

  let remaining = quantity;
  const usedWarehouses: string[] = [];
  for (const balance of balances) {
    if (remaining <= 0) break;
    const deducted = Math.min(Number(balance.quantity), remaining);
    db.prepare('UPDATE inventory_balances SET quantity = quantity - ?, updated_at = ? WHERE id = ?')
      .run(deducted, updatedAt, balance.id);
    remaining -= deducted;
    usedWarehouses.push(balance.code);
  }
  if (remaining > 0) {
    throw new Error(`Warehouse balances are short by ${remaining}. Reconcile warehouse stock before issuing.`);
  }
  return usedWarehouses.join(', ');
}

// GET /api/v1/material-requests
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { status, teamId, projectId, priority, search, page, limit } = req.query;

  let query = `
    SELECT mr.id, mr.request_number as requestNumber, mr.team_id as teamId,
           t.team_code as teamCode, t.name as teamName,
           mr.requester_id as requesterId, u.full_name as requesterName, u.email as requesterEmail,
           mr.project_id as projectId, p.name as projectName, p.project_code as projectCode,
           mr.site_name as siteName, mr.required_date as requiredDate, mr.priority,
           mr.reason, mr.work_order_ref as workOrderRef, mr.status, mr.estimated_cost as estimatedCost,
           mr.created_at as createdAt, mr.updated_at as updatedAt,
           (SELECT count(*) FROM material_request_items mri WHERE mri.request_id = mr.id) as itemCount,
           p_pay.payment_reference as paymentReference, p_pay.status as paymentStatus
    FROM material_requests mr
    JOIN teams t ON mr.team_id = t.id
    JOIN users u ON mr.requester_id = u.id
    JOIN projects p ON mr.project_id = p.id
    LEFT JOIN payments p_pay ON mr.id = p_pay.request_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Role based filtering: if technician or leader, show own team's requests unless viewing all
  if (['FIELD_TECHNICIAN', 'FIELD_TEAM_LEADER'].includes(req.user?.role || '')) {
    if (req.user?.teamId) {
      query += ' AND mr.team_id = ?';
      params.push(req.user.teamId);
    }
  }

  if (status) {
    if (status === 'ACCOUNTING_QUEUE') {
      query += " AND mr.status IN ('APPROVED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING')";
    } else if (status === 'READY_FOR_ISSUE_QUEUE') {
      query += " AND mr.status IN ('READY_FOR_ISSUE', 'PARTIALLY_ISSUED')";
    } else {
      query += ' AND mr.status = ?';
      params.push(status);
    }
  }

  if (teamId) {
    query += ' AND mr.team_id = ?';
    params.push(teamId);
  }
  if (projectId) {
    query += ' AND mr.project_id = ?';
    params.push(projectId);
  }
  if (priority) {
    query += ' AND mr.priority = ?';
    params.push(priority);
  }
  if (search) {
    query += ' AND (mr.request_number LIKE ? OR t.team_code LIKE ? OR u.full_name LIKE ? OR mr.work_order_ref LIKE ? OR mr.reason LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY mr.created_at DESC';

  const p = Number(page) || 1;
  const l = Number(limit) || 50;
  const offset = (p - 1) * l;

  const countQuery = `SELECT count(*) as total FROM (${query})`;
  const totalRow = db.prepare(countQuery).get(...params) as { total: number };

  query += ' LIMIT ? OFFSET ?';
  params.push(l, offset);

  const requests = db.prepare(query).all(...params);

  return res.json({
    success: true,
    total: totalRow?.total || 0,
    page: p,
    limit: l,
    requests
  });
});

// GET /api/v1/material-requests/:id (Full Request Details)
router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const request = db.prepare(`
    SELECT mr.id, mr.request_number as requestNumber, mr.team_id as teamId,
           t.team_code as teamCode, t.name as teamName, t.assigned_area as teamArea,
           mr.requester_id as requesterId, u.full_name as requesterName, u.email as requesterEmail,
           u.phone_number as requesterPhone, u.employee_id as requesterEmployeeId,
           mr.project_id as projectId, p.name as projectName, p.project_code as projectCode, p.client as projectClient,
           mr.site_name as siteName, mr.required_date as requiredDate, mr.priority,
           mr.reason, mr.work_order_ref as workOrderRef, mr.notes, mr.status,
           mr.estimated_cost as estimatedCost, mr.created_at as createdAt, mr.updated_at as updatedAt
    FROM material_requests mr
    JOIN teams t ON mr.team_id = t.id
    JOIN users u ON mr.requester_id = u.id
    JOIN projects p ON mr.project_id = p.id
    WHERE mr.id = ? OR mr.request_number = ?
  `).get(req.params.id, req.params.id) as any;

  if (!request) {
    return res.status(404).json({ success: false, message: 'Material request not found' });
  }

  // Get items
  const items = db.prepare(`
    SELECT mri.id, mri.material_id as materialId, m.sku, m.name as materialName,
           m.category, mri.quantity_requested as quantityRequested,
           mri.quantity_approved as quantityApproved, mri.quantity_issued as quantityIssued,
           mri.quantity_remaining as quantityRemaining, mri.unit, mri.reason,
           m.current_stock as currentWarehouseStock, m.unit_cost as unitCost,
           m.is_serial_required as isSerialRequired, m.requires_safaricom_tracking as requiresSafaricomTracking,
           m.store_location as storeLocation
    FROM material_request_items mri
    JOIN materials m ON mri.material_id = m.id
    WHERE mri.request_id = ?
  `).all(request.id);

  // Get approvals history
  const approvals = db.prepare(`
    SELECT a.id, a.approver_id as approverId, u.full_name as approverName, u.role as approverRole,
           a.action, a.previous_status as previousStatus, a.new_status as newStatus,
           a.comment, a.created_at as createdAt
    FROM approvals a
    JOIN users u ON a.approver_id = u.id
    WHERE a.request_id = ?
    ORDER BY a.created_at ASC
  `).all(request.id);

  // Get payment info
  const payment = db.prepare(`
    SELECT p.id, p.accountant_id as accountantId, u.full_name as accountantName,
           p.amount, p.payment_method as paymentMethod, p.payment_reference as paymentReference,
           p.payment_date as paymentDate, p.receipt_evidence as receiptEvidence,
           p.notes, p.status
    FROM payments p
    JOIN users u ON p.accountant_id = u.id
    WHERE p.request_id = ?
  `).get(request.id);

  // Get material issues & items
  const issues = db.prepare(`
    SELECT mi.id, mi.store_officer_id as storeOfficerId, u.full_name as storeOfficerName,
           mi.recipient_name as recipientName, mi.recipient_signature as recipientSignature,
           mi.is_partial as isPartial, mi.issued_at as issuedAt, mi.received_at as receivedAt
    FROM material_issues mi
    JOIN users u ON mi.store_officer_id = u.id
    WHERE mi.request_id = ?
    ORDER BY mi.issued_at ASC
  `).all(request.id) as any[];

  for (const issue of issues) {
    issue.items = db.prepare(`
      SELECT mii.id, mii.material_id as materialId, m.name as materialName, m.sku,
             mii.quantity_issued as quantityIssued, mii.serial_number as serialNumber,
             mii.tracked_unit_id as trackedUnitId
      FROM material_issue_items mii
      JOIN materials m ON mii.material_id = m.id
      WHERE mii.issue_id = ?
    `).all(issue.id);
  }

  // Get returns
  const returns = db.prepare(`
    SELECT mr.id, mr.receiver_id as receiverId, u.full_name as receiverName,
           mr.status, mr.created_at as createdAt
    FROM material_returns mr
    JOIN users u ON mr.receiver_id = u.id
    WHERE mr.request_id = ?
    ORDER BY mr.created_at ASC
  `).all(request.id) as any[];

  for (const ret of returns) {
    ret.items = db.prepare(`
      SELECT mri.id, mri.material_id as materialId, m.name as materialName, m.sku,
             mri.quantity, mri.serial_number as serialNumber, mri.condition, mri.notes
      FROM material_return_items mri
      JOIN materials m ON mri.material_id = m.id
      WHERE mri.return_id = ?
    `).all(ret.id);
  }

  // Get team current stock for context
  const teamStock = db.prepare(`
    SELECT ts.material_id as materialId, m.name as materialName, m.sku, ts.current_stock as currentStock, m.unit
    FROM team_stocks ts
    JOIN materials m ON ts.material_id = m.id
    WHERE ts.team_id = ?
  `).all(request.teamId);

  // Get immutable audit log for this request
  const auditLogs = db.prepare(`
    SELECT al.id, al.user_id as userId, u.full_name as userName, al.action,
           al.previous_value as previousValue, al.new_value as newValue,
           al.reason, al.created_at as createdAt
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.entity = 'MaterialRequest' AND al.entity_id = ?
    ORDER BY al.created_at ASC
  `).all(request.id);

  return res.json({
    success: true,
    request: {
      ...request,
      items,
      approvals,
      payment,
      issues,
      returns,
      teamStock,
      auditLogs
    }
  });
});

// POST /api/v1/material-requests (Create new Request)
router.post('/', authenticateToken, (req: AuthRequest, res: Response) => {
  const { teamId, projectId, siteName, requiredDate, priority, reason, workOrderRef, notes, items, isDraft } = req.body;

  if (['FIELD_TECHNICIAN', 'FIELD_TEAM_LEADER'].includes(req.user?.role || '') && req.user?.teamId !== teamId) {
    return res.status(403).json({ success: false, message: 'You can only create requests for your assigned team.', code: 'TEAM_ACCESS_DENIED' });
  }

  if (!teamId || !projectId || !requiredDate || !reason || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please provide team, project, required date, reason, and at least one material item' });
  }

  const requestId = `req-${uuidv4().slice(0, 8)}`;
  const requestNumber = generateRequestNumber();
  const now = new Date().toISOString();
  const initialStatus = isDraft ? 'DRAFT' : 'SUBMITTED';

  let estimatedTotal = 0;
  for (const item of items) {
    const mat = db.prepare('SELECT unit_cost FROM materials WHERE id = ?').get(item.materialId) as { unit_cost: number };
    const cost = (mat?.unit_cost || 0) * (Number(item.quantityRequested) || 0);
    estimatedTotal += cost;
  }

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare(`
      INSERT INTO material_requests (
        id, request_number, team_id, requester_id, project_id, site_name, required_date,
        priority, reason, work_order_ref, notes, status, estimated_cost, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId, requestNumber, teamId, req.user?.id || 'usr-lead', projectId, siteName || null,
      requiredDate, priority || 'MEDIUM', reason.trim(), workOrderRef || null,
      notes || null, initialStatus, estimatedTotal, now, now
    );

    const insertItem = db.prepare(`
      INSERT INTO material_request_items (
        id, request_id, material_id, quantity_requested, quantity_approved, quantity_issued,
        quantity_remaining, unit, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const mat = db.prepare('SELECT unit FROM materials WHERE id = ?').get(item.materialId) as { unit: string };
      const qty = Number(item.quantityRequested);
      insertItem.run(
        `item-${uuidv4().slice(0, 8)}`,
        requestId,
        item.materialId,
        qty,
        0.0,
        0.0,
        qty,
        item.unit || mat?.unit || 'pcs',
        item.reason || null
      );
    }

    db.exec('COMMIT');
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Failed to create material request: ' + err.message });
  }

  logAuditEvent({
    userId: req.user?.id,
    action: isDraft ? 'REQUEST_DRAFTED' : 'REQUEST_CREATED',
    entity: 'MaterialRequest',
    entityId: requestId,
    ipAddress: req.ip,
    newValue: { requestNumber, initialStatus, itemCount: items.length, estimatedTotal },
    reason
  });

  if (!isDraft) {
    notifyRoles(['DISPATCHER', 'PROJECT_MANAGER'], 'New Material Request Submitted', `${requestNumber} submitted by ${req.user?.fullName} for review.`, 'APPROVAL', `/requests/${requestId}`);
  }

  return res.status(201).json({
    success: true,
    message: isDraft ? 'Draft saved' : 'Material request submitted successfully',
    requestId,
    requestNumber
  });
});

// POST /api/v1/material-requests/:id/submit (Draft -> Submitted)
router.post('/:id/submit', authenticateToken, (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  if (request.status !== 'DRAFT') {
    return res.status(400).json({ success: false, message: `Request is already in status: ${request.status}` });
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE material_requests SET status = 'SUBMITTED', updated_at = ? WHERE id = ?").run(now, request.id);

  logAuditEvent({
    userId: req.user?.id,
    action: 'REQUEST_SUBMITTED',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    previousValue: 'DRAFT',
    newValue: 'SUBMITTED',
    reason: 'Technician finalized and submitted request'
  });

  notifyRoles(['DISPATCHER', 'PROJECT_MANAGER'], 'Material Request Submitted', `${request.request_number} is ready for review.`, 'APPROVAL', `/requests/${request.id}`);

  return res.json({ success: true, message: 'Request submitted for review', newStatus: 'SUBMITTED' });
});

// POST /api/v1/material-requests/:id/review (Dispatcher/PM sets to UNDER_REVIEW)
router.post('/:id/review', authenticateToken, requireRole(['SUPER_ADMIN', 'DISPATCHER', 'PROJECT_MANAGER']), (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;

  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  const now = new Date().toISOString();
  db.prepare("UPDATE material_requests SET status = 'UNDER_REVIEW', updated_at = ? WHERE id = ?").run(now, request.id);

  logAuditEvent({
    userId: req.user?.id,
    action: 'REQUEST_UNDER_REVIEW',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    previousValue: request.status,
    newValue: 'UNDER_REVIEW',
    reason: 'Dispatcher/PM opened request for technical evaluation'
  });

  return res.json({ success: true, message: 'Request status set to UNDER_REVIEW', newStatus: 'UNDER_REVIEW' });
});

// POST /api/v1/material-requests/:id/approve (Dispatcher/PM Approves Request)
router.post('/:id/approve', authenticateToken, requireRole(['SUPER_ADMIN', 'DISPATCHER', 'PROJECT_MANAGER']), (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const { comment, approvedItems } = req.body;
  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;

  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  if (!['SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED'].includes(request.status)) {
    return res.status(400).json({ success: false, message: `Cannot approve request with current status: ${request.status}` });
  }

  const now = new Date().toISOString();
  const nextStatus = 'PAYMENT_PENDING'; // Automatically moves into accounting payment queue

  db.exec('BEGIN TRANSACTION');
  try {
    // Update request status
    db.prepare('UPDATE material_requests SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now, request.id);

    // Update approved quantities for each line item
    const updateItem = db.prepare('UPDATE material_request_items SET quantity_approved = ?, quantity_remaining = ? WHERE id = ?');
    const items = db.prepare('SELECT id, quantity_requested FROM material_request_items WHERE request_id = ?').all(request.id) as any[];

    for (const item of items) {
      let approvedQty = item.quantity_requested;
      if (approvedItems && approvedItems[item.id] !== undefined) {
        approvedQty = Number(approvedItems[item.id]);
      }
      updateItem.run(approvedQty, approvedQty, item.id);
    }

    // Insert approval record
    db.prepare(`
      INSERT INTO approvals (id, request_id, approver_id, action, previous_status, new_status, comment, created_at)
      VALUES (?, ?, ?, 'APPROVED', ?, ?, ?, ?)
    `).run(`appr-${uuidv4().slice(0, 8)}`, request.id, req.user?.id || 'usr-pm', request.status, nextStatus, comment || 'Approved by project supervisor', now);

    db.exec('COMMIT');
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Approval failed: ' + err.message });
  }

  logAuditEvent({
    userId: req.user?.id,
    action: 'REQUEST_APPROVED',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    previousValue: request.status,
    newValue: nextStatus,
    reason: comment || 'Technical and project authorization granted'
  });

  // Notify Accountant
  notifyRoles(['ACCOUNTANT'], 'Payment Required for Approved Request', `${request.request_number} was approved and is in the accounting queue for payment verification.`, 'PAYMENT', `/requests/${request.id}`);

  // Notify Requester
  createNotification(request.requester_id, 'Request Approved!', `Your material request ${request.request_number} has been approved and moved to accounting for payment.`, 'APPROVAL', `/requests/${request.id}`);

  return res.json({ success: true, message: 'Request approved and routed to accounting for payment', newStatus: nextStatus });
});

// POST /api/v1/material-requests/:id/reject
router.post('/:id/reject', authenticateToken, requireRole(['SUPER_ADMIN', 'DISPATCHER', 'PROJECT_MANAGER', 'ACCOUNTANT']), (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const { reason } = req.body;

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Rejection reason is mandatory' });
  }

  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  const now = new Date().toISOString();
  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare("UPDATE material_requests SET status = 'REJECTED', updated_at = ? WHERE id = ?").run(now, request.id);

    db.prepare(`
      INSERT INTO approvals (id, request_id, approver_id, action, previous_status, new_status, comment, created_at)
      VALUES (?, ?, ?, 'REJECTED', ?, 'REJECTED', ?, ?)
    `).run(`appr-${uuidv4().slice(0, 8)}`, request.id, req.user?.id || 'usr-pm', request.status, reason.trim(), now);

    db.exec('COMMIT');
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Rejection failed: ' + err.message });
  }

  logAuditEvent({
    userId: req.user?.id,
    action: 'REQUEST_REJECTED',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    previousValue: request.status,
    newValue: 'REJECTED',
    reason: reason.trim()
  });

  createNotification(request.requester_id, 'Request Rejected', `Request ${request.request_number} was rejected. Reason: ${reason}`, 'APPROVAL', `/requests/${request.id}`);

  return res.json({ success: true, message: 'Request has been rejected', newStatus: 'REJECTED' });
});

// POST /api/v1/material-requests/:id/clarification
router.post('/:id/clarification', authenticateToken, requireRole(['SUPER_ADMIN', 'DISPATCHER', 'PROJECT_MANAGER', 'ACCOUNTANT']), (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const { comment } = req.body;

  if (!comment || comment.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Clarification query comment is required' });
  }

  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  const now = new Date().toISOString();
  db.prepare("UPDATE material_requests SET status = 'CLARIFICATION_REQUIRED', updated_at = ? WHERE id = ?").run(now, request.id);

  db.prepare(`
    INSERT INTO approvals (id, request_id, approver_id, action, previous_status, new_status, comment, created_at)
    VALUES (?, ?, ?, 'CLARIFICATION_REQUESTED', ?, 'CLARIFICATION_REQUIRED', ?, ?)
  `).run(`appr-${uuidv4().slice(0, 8)}`, request.id, req.user?.id || 'usr-pm', request.status, comment.trim(), now);

  logAuditEvent({
    userId: req.user?.id,
    action: 'CLARIFICATION_REQUESTED',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    previousValue: request.status,
    newValue: 'CLARIFICATION_REQUIRED',
    reason: comment.trim()
  });

  createNotification(request.requester_id, 'Clarification Needed', `Clarification requested on ${request.request_number}: "${comment}"`, 'APPROVAL', `/requests/${request.id}`);

  return res.json({ success: true, message: 'Clarification request sent to team', newStatus: 'CLARIFICATION_REQUIRED' });
});

// POST /api/v1/material-requests/:id/payment (Accountant Records Payment & Authorization)
router.post('/:id/payment', authenticateToken, requireRole(['SUPER_ADMIN', 'ACCOUNTANT']), (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const { amount, paymentMethod, paymentReference, notes, receiptEvidence } = req.body;

  if (!paymentReference || !paymentMethod) {
    return res.status(400).json({ success: false, message: 'Payment reference (e.g. M-Pesa code / EFT) and payment method are required' });
  }

  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  if (!['APPROVED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING'].includes(request.status)) {
    return res.status(400).json({ success: false, message: `Cannot confirm payment for request with status: ${request.status}. Request must be approved first.` });
  }

  const now = new Date().toISOString();
  const nextStatus = 'READY_FOR_ISSUE';
  const payId = `pay-${uuidv4().slice(0, 8)}`;
  const payAmount = Number(amount) || Number(request.estimated_cost) || 0;

  db.exec('BEGIN TRANSACTION');
  try {
    // Record payment
    db.prepare(`
      INSERT INTO payments (id, request_id, accountant_id, amount, payment_method, payment_reference, payment_date, receipt_evidence, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
      ON CONFLICT(request_id) DO UPDATE SET
        amount = excluded.amount,
        payment_method = excluded.payment_method,
        payment_reference = excluded.payment_reference,
        payment_date = excluded.payment_date,
        receipt_evidence = excluded.receipt_evidence,
        notes = excluded.notes,
        status = 'CONFIRMED'
    `).run(payId, request.id, req.user?.id || 'usr-acct', payAmount, paymentMethod, paymentReference.trim().toUpperCase(), now, receiptEvidence || null, notes || null);

    // Update status to READY_FOR_ISSUE
    db.prepare('UPDATE material_requests SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now, request.id);

    db.exec('COMMIT');
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Payment confirmation failed: ' + err.message });
  }

  logAuditEvent({
    userId: req.user?.id,
    action: 'PAYMENT_CONFIRMED',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    previousValue: request.status,
    newValue: nextStatus,
    reason: `Payment reference ${paymentReference} confirmed. Amount: KES ${payAmount}`
  });

  // Notify Store Officer
  notifyRoles(['STORE_OFFICER'], 'Request Authorized for Issue', `${request.request_number} is PAID and READY FOR ISSUE for Team ${request.team_id}.`, 'ISSUE', `/requests/${request.id}`);

  // Notify Requester
  createNotification(request.requester_id, 'Payment Confirmed - Ready for Pickup', `Materials for ${request.request_number} are ready for collection at the store.`, 'PAYMENT', `/requests/${request.id}`);

  return res.json({
    success: true,
    message: 'Payment confirmed. Request is now READY FOR ISSUE.',
    newStatus: nextStatus,
    paymentReference
  });
});

// POST /api/v1/material-requests/:id/issue (Store Officer Issues Materials)
router.post('/:id/issue', authenticateToken, requireRole(['SUPER_ADMIN', 'STORE_OFFICER']), (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const { issuedItems, recipientName, recipientId, signature } = req.body;

  if (!recipientName) {
    return res.status(400).json({ success: false, message: 'Recipient name is mandatory' });
  }

  if (!issuedItems || !Array.isArray(issuedItems) || issuedItems.length === 0) {
    return res.status(400).json({ success: false, message: 'Please specify the items and quantities to issue' });
  }

  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  // Verification check: Request must be READY_FOR_ISSUE or PARTIALLY_ISSUED
  if (!['READY_FOR_ISSUE', 'PARTIALLY_ISSUED', 'PAID'].includes(request.status)) {
    return res.status(400).json({
      success: false,
      message: `BLOCKED: Request cannot be issued. Current status is ${request.status}. Issuance requires payment/management authorization first.`,
      code: 'UNAUTHORIZED_ISSUANCE'
    });
  }

  const now = new Date().toISOString();
  const issueId = `iss-${uuidv4().slice(0, 8)}`;
  let isPartial = false;

  db.exec('BEGIN TRANSACTION');
  try {
    // 1. Create issue header
    db.prepare(`
      INSERT INTO material_issues (id, request_id, store_officer_id, recipient_name, recipient_id, recipient_signature, is_partial, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(issueId, request.id, req.user?.id || 'usr-store', recipientName.trim(), recipientId || null, signature || null, now);

    const insertIssueItem = db.prepare(`
      INSERT INTO material_issue_items (id, issue_id, material_id, quantity_issued, tracked_unit_id, serial_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateRequestItem = db.prepare(`
      UPDATE material_request_items
      SET quantity_issued = quantity_issued + ?, quantity_remaining = quantity_remaining - ?
      WHERE id = ?
    `);

    // 2. Loop through issued items
    for (const issued of issuedItems) {
      const lineItem = db.prepare('SELECT * FROM material_request_items WHERE id = ?').get(issued.lineItemId) as any;
      if (!lineItem) throw new Error(`Line item ${issued.lineItemId} not found`);

      const qty = Number(issued.quantityIssued);
      if (qty <= 0) continue;

      if (qty > Number(lineItem.quantity_remaining)) {
        throw new Error(`Issued quantity (${qty}) exceeds remaining authorized quantity (${lineItem.quantity_remaining}) for material`);
      }

      // Check warehouse stock
      const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(lineItem.material_id) as any;
      if (Number(mat.current_stock) < qty) {
        throw new Error(`Insufficient stock for ${mat.name}. Available: ${mat.current_stock}, Requested: ${qty}`);
      }

      let trackedUnitId: string | null = null;
      let serialNumber: string | null = null;

      // Handle serialized / Safaricom tracked unit
      if (mat.is_serial_required || mat.requires_safaricom_tracking) {
        if (!issued.serialNumber) {
          throw new Error(`Serial number or barcode scanning is mandatory for ${mat.name}`);
        }
        serialNumber = issued.serialNumber.trim();
        const trackedUnit = db.prepare('SELECT * FROM tracked_units WHERE serial_number = ? AND material_id = ?').get(serialNumber, mat.id) as any;

        if (!trackedUnit) {
          // If not pre-registered, create the unit in system to ensure tracking
          trackedUnitId = `unit-${uuidv4().slice(0, 8)}`;
          db.prepare(`
            INSERT INTO tracked_units (id, serial_number, barcode, material_id, status, current_location, current_team_id, custodian_name, safaricom_tag, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'WITH_TEAM', 'In Field with Team', ?, ?, ?, ?, ?)
          `).run(trackedUnitId, serialNumber, serialNumber, mat.id, request.team_id, recipientName, mat.requires_safaricom_tracking ? `SAF-${serialNumber}` : null, now, now);
        } else {
          if (trackedUnit.status !== 'IN_STORE') {
            throw new Error(`Item ${serialNumber} is not in store (Current status: ${trackedUnit.status}). Cannot issue.`);
          }
          trackedUnitId = trackedUnit.id;
          db.prepare(`
            UPDATE tracked_units
            SET status = 'WITH_TEAM', current_location = 'In Field with Team', current_team_id = ?, custodian_name = ?, updated_at = ?
            WHERE id = ?
          `).run(request.team_id, recipientName, now, trackedUnit.id);
        }
      }

      // Record issue item
      insertIssueItem.run(`isi-${uuidv4().slice(0, 8)}`, issueId, lineItem.material_id, qty, trackedUnitId, serialNumber);

      // Deduct warehouse balance and material current stock
      const newStock = Number(mat.current_stock) - qty;
      db.prepare('UPDATE materials SET current_stock = ?, updated_at = ? WHERE id = ?').run(newStock, now, mat.id);
      const sourceWarehouses = deductWarehouseBalances(mat.id, qty, now);

      // Record inventory transaction ledger entry
      db.prepare(`
        INSERT INTO inventory_transactions (id, material_id, type, quantity, previous_stock, new_stock, source, destination, reference, reason, user_id, created_at)
        VALUES (?, ?, 'ISSUE', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `tx-${uuidv4().slice(0, 8)}`, mat.id, qty, Number(mat.current_stock), newStock,
        sourceWarehouses, `Team ${request.team_id}`, request.request_number, `Material issue to ${recipientName}`, req.user?.id ?? null, now
      );

      // Credit Team Virtual Stock
      db.prepare(`
        INSERT INTO team_stocks (id, team_id, material_id, current_stock, total_issued, total_consumed, total_returned, total_damaged, total_lost, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, ?)
        ON CONFLICT(team_id, material_id) DO UPDATE SET
          current_stock = current_stock + excluded.current_stock,
          total_issued = total_issued + excluded.total_issued,
          updated_at = excluded.updated_at
      `).run(`tstk-${uuidv4().slice(0, 8)}`, request.team_id, lineItem.material_id, qty, qty, now);

      // Update line item remaining
      updateRequestItem.run(qty, qty, lineItem.id);
    }

    // Check if any items still have remaining quantity to issue
    const allRemaining = db.prepare('SELECT sum(quantity_remaining) as totalRem FROM material_request_items WHERE request_id = ?').get(request.id) as { totalRem: number };
    const totalRemaining = Number(allRemaining?.totalRem || 0);

    let nextStatus = 'ISSUED';
    if (totalRemaining > 0) {
      nextStatus = 'PARTIALLY_ISSUED';
      isPartial = true;
      db.prepare('UPDATE material_issues SET is_partial = 1 WHERE id = ?').run(issueId);
    }

    db.prepare('UPDATE material_requests SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now, request.id);

    db.exec('COMMIT');

    logAuditEvent({
      userId: req.user?.id,
      action: isPartial ? 'MATERIAL_PARTIALLY_ISSUED' : 'MATERIAL_ISSUED',
      entity: 'MaterialRequest',
      entityId: request.id,
      ipAddress: req.ip,
      previousValue: request.status,
      newValue: nextStatus,
      reason: `Issued to ${recipientName}. Partial: ${isPartial}`
    });

    createNotification(request.requester_id, 'Materials Issued from Store', `Materials for ${request.request_number} have been issued to ${recipientName}. Please confirm receipt.`, 'ISSUE', `/requests/${request.id}`);

    return res.json({
      success: true,
      message: isPartial ? 'Materials partially issued' : 'All requested materials issued successfully',
      newStatus: nextStatus,
      issueId
    });
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(400).json({ success: false, message: 'Issuance failed: ' + err.message });
  }
});

// POST /api/v1/material-requests/:id/receive (Team Confirms Receipt)
router.post('/:id/receive', authenticateToken, (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const { notes, digitalSignature } = req.body;

  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  if (!['ISSUED', 'PARTIALLY_ISSUED'].includes(request.status)) {
    return res.status(400).json({ success: false, message: `Cannot confirm receipt for request with status: ${request.status}` });
  }

  const now = new Date().toISOString();
  const nextStatus = 'RECEIVED';

  db.prepare('UPDATE material_requests SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, now, request.id);
  db.prepare('UPDATE material_issues SET received_at = ?, recipient_signature = COALESCE(?, recipient_signature) WHERE request_id = ? AND received_at IS NULL').run(now, digitalSignature || null, request.id);

  logAuditEvent({
    userId: req.user?.id,
    action: 'MATERIAL_RECEIVED_BY_TEAM',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    previousValue: request.status,
    newValue: nextStatus,
    reason: notes || 'Field team confirmed physical receipt of materials'
  });

  return res.json({ success: true, message: 'Material receipt confirmed by field team', newStatus: nextStatus });
});

// POST /api/v1/material-requests/:id/consumption (Team Records Consumption)
router.post('/:id/consumption', authenticateToken, (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const { consumptions } = req.body;

  if (!consumptions || !Array.isArray(consumptions) || consumptions.length === 0) {
    return res.status(400).json({ success: false, message: 'No consumption entries provided' });
  }

  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION');
  try {
    for (const c of consumptions) {
      const qty = Number(c.quantityConsumed);
      if (qty <= 0) continue;

      // Check current team stock
      const tStock = db.prepare('SELECT current_stock FROM team_stocks WHERE team_id = ? AND material_id = ?').get(request.team_id, c.materialId) as any;
      const current = Number(tStock?.current_stock || 0);

      // Decrement team stock
      const newStock = Math.max(0, current - qty);
      db.prepare(`
        UPDATE team_stocks
        SET current_stock = ?, total_consumed = total_consumed + ?, updated_at = ?
        WHERE team_id = ? AND material_id = ?
      `).run(newStock, qty, now, request.team_id, c.materialId);

      // Log consumption record
      db.prepare(`
        INSERT INTO material_consumptions (id, team_id, material_id, quantity_consumed, work_order, logged_by_id, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`csm-${uuidv4().slice(0, 8)}`, request.team_id, c.materialId, qty, request.work_order_ref || null, req.user?.id || 'usr-lead', c.notes || null, now);
    }

    db.prepare("UPDATE material_requests SET status = 'IN_USE', updated_at = ? WHERE id = ? AND status = 'RECEIVED'").run(now, request.id);

    db.exec('COMMIT');
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Recording consumption failed: ' + err.message });
  }

  logAuditEvent({
    userId: req.user?.id,
    action: 'MATERIAL_CONSUMPTION_LOGGED',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    newValue: consumptions,
    reason: 'Field installation consumption recorded'
  });

  return res.json({ success: true, message: 'Material consumption logged and team stock updated' });
});

// POST /api/v1/material-requests/:id/return (Team returns equipment / materials)
router.post('/:id/return', authenticateToken, (req: AuthRequest, res: Response) => {
  const reqId = req.params.id;
  const { items, warehouseId } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please provide return items' });
  }

  const request = db.prepare('SELECT * FROM material_requests WHERE id = ? OR request_number = ?').get(reqId, reqId) as any;
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

  const warehouse = typeof warehouseId === 'string' && warehouseId
    ? db.prepare('SELECT id, name FROM warehouses WHERE id = ?').get(warehouseId) as { id: string; name: string } | undefined
    : db.prepare('SELECT id, name FROM warehouses ORDER BY code ASC LIMIT 1').get() as { id: string; name: string } | undefined;
  if (!warehouse) {
    return res.status(400).json({
      success: false,
      message: 'Create a warehouse before accepting material returns.',
      code: 'WAREHOUSE_REQUIRED'
    });
  }

  const now = new Date().toISOString();
  const returnId = `ret-${uuidv4().slice(0, 8)}`;

  db.exec('BEGIN TRANSACTION');
  try {
    db.prepare(`
      INSERT INTO material_returns (id, request_id, team_id, receiver_id, status, created_at)
      VALUES (?, ?, ?, ?, 'ACCEPTED', ?)
    `).run(returnId, request.id, request.team_id, req.user?.id || 'usr-store', now);

    const insertReturnItem = db.prepare(`
      INSERT INTO material_return_items (id, return_id, material_id, quantity, tracked_unit_id, serial_number, condition, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const qty = Number(item.quantity);
      if (qty <= 0) continue;

      const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(item.materialId) as any;
      let trackedUnitId: string | null = null;

      // Handle tool / serialized unit return
      if (item.serialNumber) {
        const unit = db.prepare('SELECT id, status FROM tracked_units WHERE serial_number = ?').get(item.serialNumber) as any;
        if (unit) {
          trackedUnitId = unit.id;
          const newStatus = item.condition === 'DAMAGED' ? 'DAMAGED' : 'IN_STORE';
          db.prepare(`
            UPDATE tracked_units
            SET status = ?, current_location = 'Central Store - Returned', current_team_id = NULL, custodian_name = 'Store Officer', updated_at = ?
            WHERE id = ?
          `).run(newStatus, now, unit.id);
        }
      }

      insertReturnItem.run(
        `mri-${uuidv4().slice(0, 8)}`, returnId, item.materialId, qty, trackedUnitId,
        item.serialNumber || null, item.condition || 'GOOD', item.notes || null
      );

      // If condition is GOOD, restore to warehouse balance
      if (item.condition === 'GOOD' || !item.condition) {
        const newStock = Number(mat.current_stock) + qty;
        db.prepare('UPDATE materials SET current_stock = ?, updated_at = ? WHERE id = ?').run(newStock, now, mat.id);
        db.prepare(`
          INSERT INTO inventory_balances (id, warehouse_id, material_id, quantity, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(warehouse_id, material_id) DO UPDATE SET
            quantity = inventory_balances.quantity + excluded.quantity,
            updated_at = excluded.updated_at
        `).run(`bal-${uuidv4().slice(0, 8)}`, warehouse.id, mat.id, qty, now);

        db.prepare(`
          INSERT INTO inventory_transactions (id, material_id, type, quantity, previous_stock, new_stock, source, destination, reference, reason, user_id, created_at)
          VALUES (?, ?, 'RETURN', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `tx-${uuidv4().slice(0, 8)}`, mat.id, qty, Number(mat.current_stock), newStock,
          `Team ${request.team_id}`, warehouse.name, request.request_number, `Tool/Material return in good condition`, req.user?.id ?? null, now
        );
      }

      // Update team stock
      db.prepare(`
        UPDATE team_stocks
        SET current_stock = MAX(0, current_stock - ?),
            total_returned = total_returned + ?,
            total_damaged = total_damaged + ?,
            updated_at = ?
        WHERE team_id = ? AND material_id = ?
      `).run(qty, item.condition === 'GOOD' ? qty : 0, item.condition === 'DAMAGED' ? qty : 0, now, request.team_id, item.materialId);
    }

    db.prepare("UPDATE material_requests SET status = 'RETURNED', updated_at = ? WHERE id = ?").run(now, request.id);

    db.exec('COMMIT');
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: 'Return processing failed: ' + err.message });
  }

  logAuditEvent({
    userId: req.user?.id,
    action: 'MATERIAL_RETURNED',
    entity: 'MaterialRequest',
    entityId: request.id,
    ipAddress: req.ip,
    newValue: items,
    reason: 'Store officer accepted returned materials'
  });

  return res.json({ success: true, message: 'Return accepted and inventory ledger updated' });
});

export default router;

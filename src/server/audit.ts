import { db } from './db.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuditParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousValue?: any;
  newValue?: any;
  reason?: string | null;
}

export function logAuditEvent(params: AuditParams) {
  try {
    const id = `aud-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const prevStr = params.previousValue !== undefined ? (typeof params.previousValue === 'string' ? params.previousValue : JSON.stringify(params.previousValue)) : null;
    const newStr = params.newValue !== undefined ? (typeof params.newValue === 'string' ? params.newValue : JSON.stringify(params.newValue)) : null;

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity, entity_id, ip_address, user_agent, previous_value, new_value, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.userId || null,
      params.action,
      params.entity,
      params.entityId,
      params.ipAddress || null,
      params.userAgent || null,
      prevStr,
      newStr,
      params.reason || null,
      now
    );
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

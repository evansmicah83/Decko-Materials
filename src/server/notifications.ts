import { db } from './db.js';
import { v4 as uuidv4 } from 'uuid';

export function createNotification(userId: string, title: string, message: string, type: string, link?: string) {
  try {
    const id = `notif-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, userId, title, message, type, link || null, now);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

export function notifyRoles(roles: string[], title: string, message: string, type: string, link?: string) {
  try {
    const placeholders = roles.map(() => '?').join(',');
    const users = db.prepare(`SELECT id FROM users WHERE role IN (${placeholders}) AND is_active = 1`).all(...roles) as { id: string }[];
    for (const u of users) {
      createNotification(u.id, title, message, type, link);
    }
  } catch (err) {
    console.error('Failed to notify roles:', err);
  }
}

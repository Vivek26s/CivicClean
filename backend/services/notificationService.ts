import { db } from '../config/database.ts';

export type NotificationType = 'info' | 'success' | 'warning' | 'alert';

export function createNotification(
  userId: number,
  message: string,
  type: NotificationType = 'info',
  reportId: string | null = null
): void {
  const stmt = db.prepare(`
    INSERT INTO notifications (user_id, report_id, message, type)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(userId, reportId, message, type);
}

export function notifyAllAdmins(
  message: string,
  type: NotificationType = 'info',
  reportId: string | null = null
): void {
  const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin'`).all() as Array<{ id: number }>;
  const stmt = db.prepare(`
    INSERT INTO notifications (user_id, report_id, message, type)
    VALUES (?, ?, ?, ?)
  `);
  for (const admin of admins) {
    stmt.run(admin.id, reportId, message, type);
  }
}

import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: z.string().trim().email('Please enter a valid email').max(150),
  subject: z.string().trim().min(3, 'Please enter a subject').max(150),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export function getDashboardStats(_req: AuthenticatedRequest, res: Response): void {
  try {
    const counts = db.prepare(`
      SELECT
        COUNT(*) AS totalReports,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pendingReports,
        COUNT(CASE WHEN status = 'Assigned' THEN 1 END) AS assignedReports,
        COUNT(CASE WHEN status = 'In Progress' THEN 1 END) AS inProgressReports,
        COUNT(CASE WHEN status = 'Resolved' THEN 1 END) AS resolvedReports,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejectedReports,
        COUNT(CASE WHEN worker_status = 'Completed' AND status != 'Resolved' THEN 1 END) AS awaitingVerification
      FROM reports
    `).get() as Record<string, number>;

    const totalWorkers = (db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'worker'`).get() as { count: number }).count;
    const availableWorkers = (db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'worker' AND availability = 'available'`).get() as { count: number }).count;
    const totalCitizens = (db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'citizen'`).get() as { count: number }).count;

    const byCategory = db.prepare(`
      SELECT category, COUNT(*) AS count
      FROM reports
      GROUP BY category
      ORDER BY count DESC
    `).all();

    const byWard = db.prepare(`
      SELECT ward AS location, COUNT(*) AS total,
             COUNT(CASE WHEN status = 'Resolved' THEN 1 END) AS resolved,
             COUNT(CASE WHEN status IN ('Pending', 'Assigned', 'In Progress') THEN 1 END) AS active
      FROM reports
      GROUP BY ward
      ORDER BY total DESC
    `).all();

    const byPriority = db.prepare(`
      SELECT priority, COUNT(*) AS count
      FROM reports
      GROUP BY priority
    `).all();

    const dailyTrend = db.prepare(`
      SELECT date(created_at) AS day,
             COUNT(*) AS submitted,
             COUNT(CASE WHEN status = 'Resolved' THEN 1 END) AS resolved
      FROM reports
      GROUP BY date(created_at)
      ORDER BY day ASC
      LIMIT 14
    `).all();

    res.json({
      summary: {
        ...counts,
        totalWorkers,
        availableWorkers,
        totalCitizens,
        resolutionRate: counts.totalReports > 0
          ? Math.round((counts.resolvedReports / counts.totalReports) * 100)
          : 0,
      },
      byCategory,
      byLocation: byWard,
      byPriority,
      dailyTrend,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to load analytics.' });
  }
}

export function getPublicStats(_req: Request, res: Response): void {
  try {
    const counts = db.prepare(`
      SELECT
        COUNT(*) AS totalReports,
        COUNT(CASE WHEN status = 'Resolved' THEN 1 END) AS resolvedReports,
        COUNT(CASE WHEN status IN ('Pending', 'Assigned', 'In Progress') THEN 1 END) AS activeOperations
      FROM reports
    `).get() as { totalReports: number; resolvedReports: number; activeOperations: number };

    const totalWorkers = (db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'worker'`).get() as { count: number }).count;
    const wardsCovered = (db.prepare(`SELECT COUNT(DISTINCT ward) AS count FROM reports`).get() as { count: number }).count;

    res.json({
      totalReports: counts.totalReports,
      resolvedReports: counts.resolvedReports,
      activeOperations: counts.activeOperations,
      totalWorkers,
      wardsCovered: Math.max(wardsCovered, 5),
      resolutionRate: counts.totalReports > 0
        ? Math.round((counts.resolvedReports / counts.totalReports) * 100)
        : 0,
    });
  } catch (err) {
    console.error('Public stats error:', err);
    res.status(500).json({ error: 'Failed to load city statistics.' });
  }
}

export function getNotifications(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const rows = db.prepare(`
    SELECT id, report_id AS reportId, message, type, is_read AS read, created_at AS createdAt
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(req.user.userId);
  res.json({ notifications: rows });
}

export function markNotificationRead(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const notifId = Number(req.params.id);
  if (!Number.isInteger(notifId)) {
    res.status(400).json({ error: 'Invalid notification ID.' });
    return;
  }
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(notifId, req.user.userId);
  res.json({ message: 'Notification marked as read.' });
}

export function markAllNotificationsRead(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.user.userId);
  res.json({ message: 'All notifications marked as read.' });
}

export function submitContactMessage(req: Request, res: Response): void {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please check your message fields.' });
    return;
  }

  const { name, email, subject, message } = parsed.data;
  db.prepare(`
    INSERT INTO contact_messages (name, email, subject, message)
    VALUES (?, ?, ?, ?)
  `).run(name, email, subject, message);

  res.status(201).json({ message: 'Thank you. Your inquiry has been logged with Municipal Sanitation Support.' });
}

import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';
import { generateReportCode, isSafeAssetPath } from '../utils/security.ts';
import { createNotification, notifyAllAdmins } from '../services/notificationService.ts';

const CATEGORIES = [
  'Overflowing Dustbin',
  'Garbage on Road',
  'Garbage Near Park',
  'Garbage on Empty Plot',
  'Other',
] as const;

const STATUSES = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected'] as const;
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
const WORKER_STATUSES = ['Accepted', 'On the Way', 'In Progress', 'Completed'] as const;

const createReportSchema = z.object({
  category: z.enum(CATEGORIES),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(1500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  address: z.string().trim().min(4, 'Location address is required').max(300),
  ward: z.string().trim().min(2).max(100).optional(),
  priority: z.enum(PRIORITIES).optional(),
});

const updateReportSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  adminNotes: z.string().trim().max(1500).optional(),
  ward: z.string().trim().min(2).max(100).optional(),
});

const assignWorkerSchema = z.object({
  workerId: z.coerce.number().int().positive(),
  priority: z.enum(PRIORITIES).optional(),
  adminNotes: z.string().trim().max(1500).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(STATUSES),
  adminNotes: z.string().trim().max(1500).optional(),
});

const workerUpdateSchema = z.object({
  workerStatus: z.enum(WORKER_STATUSES),
  completionNotes: z.string().trim().max(1500).optional(),
});

interface JoinedReportRow {
  id: number;
  report_id: string;
  user_id: number;
  citizen_name: string;
  citizen_email: string;
  citizen_phone: string;
  category: string;
  description: string;
  image: string | null;
  latitude: number;
  longitude: number;
  address: string;
  ward: string;
  status: string;
  worker_status: string | null;
  priority: string;
  assigned_worker_id: number | null;
  worker_name: string | null;
  worker_phone: string | null;
  worker_zone: string | null;
  admin_notes: string;
  completion_image: string | null;
  completion_notes: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const BASE_REPORT_SELECT = `
  SELECT
    r.*,
    u.name AS citizen_name,
    u.email AS citizen_email,
    u.phone AS citizen_phone,
    w.name AS worker_name,
    w.phone AS worker_phone,
    w.zone AS worker_zone
  FROM reports r
  JOIN users u ON r.user_id = u.id
  LEFT JOIN users w ON r.assigned_worker_id = w.id
`;

function formatReport(row: JoinedReportRow) {
  return {
    id: row.id,
    reportId: row.report_id,
    userId: row.user_id,
    citizen: {
      name: row.citizen_name,
      email: row.citizen_email,
      phone: row.citizen_phone,
    },
    category: row.category,
    description: row.description,
    image: isSafeAssetPath(row.image) ? row.image : null,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      ward: row.ward,
    },
    status: row.status,
    workerStatus: row.worker_status,
    priority: row.priority,
    assignedWorker: row.assigned_worker_id
      ? {
          id: row.assigned_worker_id,
          name: row.worker_name,
          phone: row.worker_phone,
          zone: row.worker_zone,
        }
      : null,
    adminNotes: row.admin_notes,
    completionImage: isSafeAssetPath(row.completion_image) ? row.completion_image : null,
    completionNotes: row.completion_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

export function createReport(req: AuthenticatedRequest, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const parsed = createReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid report data.' });
      return;
    }

    const { category, description, latitude, longitude, address, ward, priority } = parsed.data;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const reportCode = generateReportCode();

    const result = db.prepare(`
      INSERT INTO reports (
        report_id, user_id, category, description, image,
        latitude, longitude, address, ward, status, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `).run(
      reportCode,
      req.user.userId,
      category,
      description,
      imageUrl,
      latitude,
      longitude,
      address,
      ward || 'Central Ward',
      priority || 'Medium'
    );

    const newRow = db.prepare(`${BASE_REPORT_SELECT} WHERE r.id = ?`).get(Number(result.lastInsertRowid)) as JoinedReportRow;

    createNotification(
      req.user.userId,
      `Complaint ${reportCode} (${category}) submitted and queued for municipal review.`,
      'info',
      reportCode
    );
    notifyAllAdmins(
      `New garbage complaint ${reportCode}: ${category} at ${address}.`,
      'warning',
      reportCode
    );

    res.status(201).json({
      message: 'Garbage complaint submitted successfully.',
      report: formatReport(newRow),
    });
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
}

export function getReports(req: AuthenticatedRequest, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (req.user.role === 'citizen') {
      conditions.push('r.user_id = ?');
      params.push(req.user.userId);
    } else if (req.user.role === 'worker') {
      conditions.push('r.assigned_worker_id = ?');
      params.push(req.user.userId);
    }

    const { status, category, priority, search, dateFrom, dateTo } = req.query;

    if (typeof status === 'string' && status && status !== 'All') {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (typeof category === 'string' && category && category !== 'All') {
      conditions.push('r.category = ?');
      params.push(category);
    }
    if (typeof priority === 'string' && priority && priority !== 'All') {
      conditions.push('r.priority = ?');
      params.push(priority);
    }
    if (typeof search === 'string' && search.trim()) {
      const pattern = `%${search.trim()}%`;
      conditions.push('(r.report_id LIKE ? OR r.address LIKE ? OR r.description LIKE ? OR r.ward LIKE ? OR u.name LIKE ?)');
      params.push(pattern, pattern, pattern, pattern, pattern);
    }
    if (typeof dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      conditions.push('date(r.created_at) >= date(?)');
      params.push(dateFrom);
    }
    if (typeof dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      conditions.push('date(r.created_at) <= date(?)');
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(`${BASE_REPORT_SELECT} ${whereClause} ORDER BY r.created_at DESC`).all(...params) as JoinedReportRow[];

    res.json({ reports: rows.map(formatReport) });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to load reports.' });
  }
}

export function getReportById(req: AuthenticatedRequest, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const param = String(req.params.id || '').trim();
    const isNumeric = /^\d+$/.test(param);
    const row = (isNumeric
      ? db.prepare(`${BASE_REPORT_SELECT} WHERE r.id = ?`).get(Number(param))
      : db.prepare(`${BASE_REPORT_SELECT} WHERE r.report_id = ?`).get(param.toUpperCase())) as JoinedReportRow | undefined;

    if (!row) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    if (req.user.role === 'citizen' && row.user_id !== req.user.userId) {
      res.status(403).json({ error: 'Access denied to this complaint.' });
      return;
    }
    if (req.user.role === 'worker' && row.assigned_worker_id !== req.user.userId) {
      res.status(403).json({ error: 'This task is not assigned to you.' });
      return;
    }

    res.json({ report: formatReport(row) });
  } catch (err) {
    console.error('Get report by id error:', err);
    res.status(500).json({ error: 'Failed to load report details.' });
  }
}

export function updateReport(req: AuthenticatedRequest, res: Response): void {
  try {
    const reportIdNum = Number(req.params.id);
    if (!Number.isInteger(reportIdNum)) {
      res.status(400).json({ error: 'Invalid report identifier.' });
      return;
    }

    const existing = db.prepare(`SELECT * FROM reports WHERE id = ?`).get(reportIdNum) as {
      id: number;
      report_id: string;
      user_id: number;
      assigned_worker_id: number | null;
      status: string;
      priority: string;
      admin_notes: string;
      ward: string;
    } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const parsed = updateReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update payload.' });
      return;
    }

    const nextStatus = parsed.data.status ?? existing.status;
    const nextPriority = parsed.data.priority ?? existing.priority;
    const nextNotes = parsed.data.adminNotes ?? existing.admin_notes;
    const nextWard = parsed.data.ward ?? existing.ward;
    const resolvedAt = nextStatus === 'Resolved' ? new Date().toISOString() : null;

    db.prepare(`
      UPDATE reports
      SET status = ?, priority = ?, admin_notes = ?, ward = ?,
          updated_at = datetime('now'),
          resolved_at = COALESCE(?, resolved_at)
      WHERE id = ?
    `).run(nextStatus, nextPriority, nextNotes, nextWard, resolvedAt, reportIdNum);

    if (nextStatus !== existing.status) {
      createNotification(
        existing.user_id,
        `Your complaint ${existing.report_id} status changed to "${nextStatus}".`,
        nextStatus === 'Resolved' ? 'success' : nextStatus === 'Rejected' ? 'alert' : 'info',
        existing.report_id
      );
    }

    const updated = db.prepare(`${BASE_REPORT_SELECT} WHERE r.id = ?`).get(reportIdNum) as JoinedReportRow;
    res.json({ message: 'Report updated.', report: formatReport(updated) });
  } catch (err) {
    console.error('Update report error:', err);
    res.status(500).json({ error: 'Failed to update report.' });
  }
}

export function assignWorker(req: AuthenticatedRequest, res: Response): void {
  try {
    const reportIdNum = Number(req.params.id);
    if (!Number.isInteger(reportIdNum)) {
      res.status(400).json({ error: 'Invalid report identifier.' });
      return;
    }

    const parsed = assignWorkerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please select a valid worker.' });
      return;
    }

    const { workerId, priority, adminNotes } = parsed.data;

    const existing = db.prepare(`SELECT id, report_id, user_id, address, category, priority, admin_notes FROM reports WHERE id = ?`).get(reportIdNum) as {
      id: number;
      report_id: string;
      user_id: number;
      address: string;
      category: string;
      priority: string;
      admin_notes: string;
    } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const worker = db.prepare(`SELECT id, name FROM users WHERE id = ? AND role = 'worker'`).get(workerId) as { id: number; name: string } | undefined;
    if (!worker) {
      res.status(404).json({ error: 'Selected sanitation worker does not exist.' });
      return;
    }

    db.prepare(`
      UPDATE reports
      SET assigned_worker_id = ?,
          status = 'Assigned',
          worker_status = NULL,
          priority = ?,
          admin_notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(worker.id, priority || existing.priority, adminNotes ?? existing.admin_notes, reportIdNum);

    createNotification(
      worker.id,
      `New task assigned: ${existing.report_id} (${existing.category}) at ${existing.address}.`,
      'warning',
      existing.report_id
    );
    createNotification(
      existing.user_id,
      `Sanitation worker ${worker.name} has been assigned to complaint ${existing.report_id}.`,
      'info',
      existing.report_id
    );

    const updated = db.prepare(`${BASE_REPORT_SELECT} WHERE r.id = ?`).get(reportIdNum) as JoinedReportRow;
    res.json({ message: `Assigned to ${worker.name}.`, report: formatReport(updated) });
  } catch (err) {
    console.error('Assign worker error:', err);
    res.status(500).json({ error: 'Failed to assign worker.' });
  }
}

export function updateReportStatus(req: AuthenticatedRequest, res: Response): void {
  try {
    const reportIdNum = Number(req.params.id);
    if (!Number.isInteger(reportIdNum)) {
      res.status(400).json({ error: 'Invalid report identifier.' });
      return;
    }

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid status.' });
      return;
    }

    const existing = db.prepare(`SELECT id, report_id, user_id, assigned_worker_id, admin_notes FROM reports WHERE id = ?`).get(reportIdNum) as {
      id: number;
      report_id: string;
      user_id: number;
      assigned_worker_id: number | null;
      admin_notes: string;
    } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const { status, adminNotes } = parsed.data;
    const resolvedAt = status === 'Resolved' ? new Date().toISOString() : null;

    db.prepare(`
      UPDATE reports
      SET status = ?,
          admin_notes = ?,
          updated_at = datetime('now'),
          resolved_at = CASE WHEN ? IS NOT NULL THEN ? ELSE resolved_at END
      WHERE id = ?
    `).run(status, adminNotes !== undefined ? adminNotes : existing.admin_notes, resolvedAt, resolvedAt, reportIdNum);

    createNotification(
      existing.user_id,
      `Complaint ${existing.report_id} is now marked "${status}".`,
      status === 'Resolved' ? 'success' : status === 'Rejected' ? 'alert' : 'info',
      existing.report_id
    );
    if (existing.assigned_worker_id && status === 'Resolved') {
      createNotification(
        existing.assigned_worker_id,
        `Admin verified and closed task ${existing.report_id} as Resolved.`,
        'success',
        existing.report_id
      );
    }

    const updated = db.prepare(`${BASE_REPORT_SELECT} WHERE r.id = ?`).get(reportIdNum) as JoinedReportRow;
    res.json({ message: `Status updated to ${status}.`, report: formatReport(updated) });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status.' });
  }
}

export function workerUpdateTask(req: AuthenticatedRequest, res: Response): void {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const reportIdNum = Number(req.params.id);
    if (!Number.isInteger(reportIdNum)) {
      res.status(400).json({ error: 'Invalid task identifier.' });
      return;
    }

    const existing = db.prepare(`
      SELECT id, report_id, user_id, assigned_worker_id, status, completion_image, completion_notes
      FROM reports WHERE id = ?
    `).get(reportIdNum) as {
      id: number;
      report_id: string;
      user_id: number;
      assigned_worker_id: number | null;
      status: string;
      completion_image: string | null;
      completion_notes: string;
    } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (req.user.role === 'worker' && existing.assigned_worker_id !== req.user.userId) {
      res.status(403).json({ error: 'You can only update tasks assigned to you.' });
      return;
    }

    const parsed = workerUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid worker status update.' });
      return;
    }

    const { workerStatus, completionNotes } = parsed.data;
    const proofUrl = req.file ? `/uploads/${req.file.filename}` : existing.completion_image;

    // Reflect workflow cleanly: Accepted keeps Assigned; On the Way / In Progress / Completed moves report to In Progress until Admin verifies Resolved
    let nextReportStatus = existing.status;
    if (workerStatus === 'Accepted' && existing.status === 'Pending') {
      nextReportStatus = 'Assigned';
    } else if (workerStatus === 'On the Way' || workerStatus === 'In Progress' || workerStatus === 'Completed') {
      if (existing.status !== 'Resolved') {
        nextReportStatus = 'In Progress';
      }
    }

    db.prepare(`
      UPDATE reports
      SET worker_status = ?,
          status = ?,
          completion_image = ?,
          completion_notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      workerStatus,
      nextReportStatus,
      proofUrl,
      completionNotes !== undefined ? completionNotes : existing.completion_notes,
      reportIdNum
    );

    if (workerStatus === 'Completed') {
      notifyAllAdmins(
        `Worker ${req.user.name} marked ${existing.report_id} Completed with proof. Ready for verification.`,
        'success',
        existing.report_id
      );
      createNotification(
        existing.user_id,
        `Cleaning work for ${existing.report_id} is complete and awaiting final municipal verification.`,
        'info',
        existing.report_id
      );
    } else {
      createNotification(
        existing.user_id,
        `Field update for ${existing.report_id}: Sanitation crew status is "${workerStatus}".`,
        'info',
        existing.report_id
      );
    }

    const updated = db.prepare(`${BASE_REPORT_SELECT} WHERE r.id = ?`).get(reportIdNum) as JoinedReportRow;
    res.json({ message: `Task updated to "${workerStatus}".`, report: formatReport(updated) });
  } catch (err) {
    console.error('Worker update task error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
}

export function deleteReport(req: AuthenticatedRequest, res: Response): void {
  try {
    const reportIdNum = Number(req.params.id);
    if (!Number.isInteger(reportIdNum)) {
      res.status(400).json({ error: 'Invalid report identifier.' });
      return;
    }

    const info = db.prepare(`DELETE FROM reports WHERE id = ?`).run(reportIdNum);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    res.json({ message: 'Report deleted successfully.' });
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).json({ error: 'Failed to delete report.' });
  }
}

export function trackPublicReport(req: Request, res: Response): void {
  try {
    const code = String(req.params.reportId || '').trim().toUpperCase();
    if (!code || code.length < 5 || code.length > 30) {
      res.status(400).json({ error: 'Enter a valid Complaint ID (e.g., SMC-2026-1042).' });
      return;
    }

    const row = db.prepare(`${BASE_REPORT_SELECT} WHERE upper(r.report_id) = ?`).get(code) as JoinedReportRow | undefined;
    if (!row) {
      res.status(404).json({ error: `No complaint found matching ID "${code}".` });
      return;
    }

    // Omit citizen private phone/email on public lookup
    const formatted = formatReport(row);
    res.json({
      report: {
        reportId: formatted.reportId,
        category: formatted.category,
        description: formatted.description,
        image: formatted.image,
        location: formatted.location,
        status: formatted.status,
        workerStatus: formatted.workerStatus,
        priority: formatted.priority,
        assignedWorkerName: formatted.assignedWorker?.name || null,
        adminNotes: formatted.adminNotes,
        completionImage: formatted.completionImage,
        completionNotes: formatted.completionNotes,
        createdAt: formatted.createdAt,
        updatedAt: formatted.updatedAt,
        resolvedAt: formatted.resolvedAt,
      },
    });
  } catch (err) {
    console.error('Track public report error:', err);
    res.status(500).json({ error: 'Failed to look up complaint.' });
  }
}

export function getPublicMapReports(_req: Request, res: Response): void {
  try {
    const rows = db.prepare(`
      SELECT report_id, category, status, priority, latitude, longitude, address, ward, created_at
      FROM reports
      ORDER BY created_at DESC
      LIMIT 40
    `).all();
    res.json({ reports: rows });
  } catch (err) {
    console.error('Public map reports error:', err);
    res.status(500).json({ error: 'Failed to load public map reports.' });
  }
}

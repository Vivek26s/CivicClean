import { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';
import { hashPassword } from '../utils/security.ts';

const createWorkerSchema = z.object({
  name: z.string().trim().min(2, 'Worker name is required').max(100),
  email: z.string().trim().email('Valid email is required').max(150),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  phone: z.string().trim().min(7, 'Phone number is required').max(30),
  zone: z.string().trim().min(2, 'Assigned zone is required').max(100),
  availability: z.enum(['available', 'busy', 'off_duty']).optional(),
});

const updateWorkerSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  zone: z.string().trim().min(2).max(100).optional(),
  availability: z.enum(['available', 'busy', 'off_duty']).optional(),
  password: z.string().min(6).max(128).optional(),
});

export function getWorkers(_req: AuthenticatedRequest, res: Response): void {
  try {
    const workers = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.zone,
        u.availability,
        u.created_at AS createdAt,
        (u.password_hash != 'LOCKED') AS hasCredentials,
        COUNT(CASE WHEN r.status IN ('Assigned', 'In Progress') THEN 1 END) AS activeTasks,
        COUNT(CASE WHEN r.status = 'Resolved' THEN 1 END) AS completedTasks,
        COUNT(r.id) AS totalTasks
      FROM users u
      LEFT JOIN reports r ON r.assigned_worker_id = u.id
      WHERE u.role = 'worker'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();

    res.json({ workers });
  } catch (err) {
    console.error('Get workers error:', err);
    res.status(500).json({ error: 'Failed to load sanitation workers.' });
  }
}

export async function createWorker(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const parsed = createWorkerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid worker details.' });
      return;
    }

    const { name, email, password, phone, zone, availability } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalizedEmail);
    if (exists) {
      res.status(409).json({ error: 'A user with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, phone, role, zone, availability)
      VALUES (?, ?, ?, ?, 'worker', ?, ?)
    `).run(name, normalizedEmail, passwordHash, phone, zone, availability || 'available');

    const worker = db.prepare(`
      SELECT id, name, email, phone, zone, availability, created_at AS createdAt
      FROM users WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    res.status(201).json({
      message: 'Sanitation worker created successfully.',
      worker: { ...worker as object, activeTasks: 0, completedTasks: 0, totalTasks: 0, hasCredentials: 1 },
    });
  } catch (err) {
    console.error('Create worker error:', err);
    res.status(500).json({ error: 'Failed to create worker.' });
  }
}

export async function updateWorker(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const workerId = Number(req.params.id);
    if (!Number.isInteger(workerId)) {
      res.status(400).json({ error: 'Invalid worker ID.' });
      return;
    }

    const existing = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'worker'`).get(workerId) as {
      id: number;
      name: string;
      phone: string;
      zone: string;
      availability: string;
      password_hash: string;
    } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Worker not found.' });
      return;
    }

    const parsed = updateWorkerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update fields.' });
      return;
    }

    const nextName = parsed.data.name ?? existing.name;
    const nextPhone = parsed.data.phone ?? existing.phone;
    const nextZone = parsed.data.zone ?? existing.zone;
    const nextAvailability = parsed.data.availability ?? existing.availability;
    const nextPasswordHash = parsed.data.password
      ? await hashPassword(parsed.data.password)
      : existing.password_hash;

    db.prepare(`
      UPDATE users
      SET name = ?, phone = ?, zone = ?, availability = ?, password_hash = ?
      WHERE id = ?
    `).run(nextName, nextPhone, nextZone, nextAvailability, nextPasswordHash, workerId);

    const updated = db.prepare(`
      SELECT id, name, email, phone, zone, availability, created_at AS createdAt,
             (password_hash != 'LOCKED') AS hasCredentials
      FROM users WHERE id = ?
    `).get(workerId);

    res.json({ message: 'Worker updated.', worker: updated });
  } catch (err) {
    console.error('Update worker error:', err);
    res.status(500).json({ error: 'Failed to update worker.' });
  }
}

export function deleteWorker(req: AuthenticatedRequest, res: Response): void {
  try {
    const workerId = Number(req.params.id);
    if (!Number.isInteger(workerId)) {
      res.status(400).json({ error: 'Invalid worker ID.' });
      return;
    }

    const info = db.prepare(`DELETE FROM users WHERE id = ? AND role = 'worker'`).run(workerId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Worker not found.' });
      return;
    }

    res.json({ message: 'Worker removed successfully.' });
  } catch (err) {
    console.error('Delete worker error:', err);
    res.status(500).json({ error: 'Failed to delete worker.' });
  }
}

export function updateMyAvailability(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const parsed = z.object({ availability: z.enum(['available', 'busy', 'off_duty']) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid availability status.' });
    return;
  }

  db.prepare(`UPDATE users SET availability = ? WHERE id = ?`).run(parsed.data.availability, req.user.userId);
  res.json({ message: 'Availability updated.', availability: parsed.data.availability });
}

export function getCitizens(_req: AuthenticatedRequest, res: Response): void {
  try {
    const citizens = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.zone,
        u.created_at AS createdAt,
        COUNT(r.id) AS totalReports,
        COUNT(CASE WHEN r.status = 'Resolved' THEN 1 END) AS resolvedReports
      FROM users u
      LEFT JOIN reports r ON r.user_id = u.id
      WHERE u.role = 'citizen'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();

    res.json({ citizens });
  } catch (err) {
    console.error('Get citizens error:', err);
    res.status(500).json({ error: 'Failed to load citizens directory.' });
  }
}

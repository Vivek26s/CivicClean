import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../config/database.ts';
import { hashPassword, signToken, verifyPassword } from '../utils/security.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  phone: string;
  role: 'citizen' | 'admin' | 'worker';
  zone: string;
  availability: 'available' | 'busy' | 'off_duty';
  created_at: string;
}

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().trim().email('Enter a valid email address').max(150),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(30),
  zone: z.string().trim().max(80).optional(),
});

const bootstrapAdminSchema = z.object({
  name: z.string().trim().min(2, 'Admin name must be at least 2 characters').max(100),
  email: z.string().trim().email('Enter a valid email address').max(150),
  password: z.string().min(8, 'Admin password must be at least 8 characters').max(128),
  phone: z.string().trim().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  role: z.enum(['citizen', 'admin', 'worker']).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(30),
  zone: z.string().trim().min(2).max(80),
});

function sanitizeUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    zone: row.zone,
    availability: row.availability,
    createdAt: row.created_at,
  };
}

function timingSafeCompareText(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getAuthStatus(_req: Request, res: Response): void {
  const adminRow = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get() as { id: number } | undefined;
  const envPasscodeConfigured = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
  res.json({
    adminClaimed: Boolean(adminRow),
    envPasscodeConfigured,
  });
}

export async function bootstrapAdmin(req: Request, res: Response): Promise<void> {
  try {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      res.status(403).json({ error: 'Admin access is governed by server environment configuration.' });
      return;
    }

    const existingAdmin = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
    if (existingAdmin) {
      res.status(409).json({ error: 'Municipal admin account has already been initialized. Please sign in.' });
      return;
    }

    const parsed = bootstrapAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid admin setup input.' });
      return;
    }

    const { name, email, password, phone } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existingEmail = db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalizedEmail);
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Atomic check-and-insert transaction so bootstrap locks once claimed
    const claimTx = db.transaction(() => {
      const checkAgain = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
      if (checkAgain) {
        return null;
      }
      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash, phone, role, zone, availability)
        VALUES (?, ?, ?, ?, 'admin', 'Municipal HQ', 'available')
      `).run(name, normalizedEmail, passwordHash, phone || '+91 11 2345 6700');
      return Number(result.lastInsertRowid);
    });

    const newAdminId = claimTx();
    if (!newAdminId) {
      res.status(409).json({ error: 'Municipal admin account was already claimed.' });
      return;
    }

    const adminUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(newAdminId) as UserRow;
    const token = signToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      name: adminUser.name,
    });

    res.status(201).json({
      message: 'Municipal Admin account initialized successfully.',
      token,
      user: sanitizeUser(adminUser),
    });
  } catch (err) {
    console.error('Bootstrap admin error:', err);
    res.status(500).json({ error: 'Failed to initialize admin account.' });
  }
}

export async function registerCitizen(req: Request, res: Response): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration details.' });
      return;
    }

    const { name, email, password, phone, zone } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email is already registered.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, phone, role, zone, availability)
      VALUES (?, ?, ?, ?, 'citizen', ?, 'available')
    `).run(name, normalizedEmail, passwordHash, phone, zone || 'Central Ward');

    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(Number(result.lastInsertRowid)) as UserRow;
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid login credentials.' });
      return;
    }

    const { email, password, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check server env override for ADMIN_PASSCODE if logging into admin role
    const envAdminPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (role === 'admin' && envAdminPasscode) {
      if (timingSafeCompareText(password, envAdminPasscode)) {
        let adminUser = db.prepare(`SELECT * FROM users WHERE email = ? AND role = 'admin'`).get(normalizedEmail) as UserRow | undefined;
        if (!adminUser) {
          const fallbackAdmin = db.prepare(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`).get() as UserRow | undefined;
          if (fallbackAdmin) {
            adminUser = fallbackAdmin;
          } else {
            const hash = await hashPassword(envAdminPasscode);
            const inserted = db.prepare(`
              INSERT INTO users (name, email, password_hash, phone, role, zone, availability)
              VALUES ('Municipal Administrator', ?, ?, '+91 11 2345 6700', 'admin', 'Municipal HQ', 'available')
            `).run(normalizedEmail, hash);
            adminUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(Number(inserted.lastInsertRowid)) as UserRow;
          }
        }
        const token = signToken({
          userId: adminUser.id,
          email: adminUser.email,
          role: 'admin',
          name: adminUser.name,
        });
        res.json({ token, user: sanitizeUser(adminUser) });
        return;
      } else {
        res.status(401).json({ error: 'Invalid administrator credentials.' });
        return;
      }
    }

    const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(normalizedEmail) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (role && user.role !== role) {
      res.status(403).json({ error: `This account is registered under the "${user.role}" role. Please switch to the ${user.role} tab.` });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Sign in failed. Please try again.' });
  }
}

export function getMe(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.userId) as UserRow | undefined;
  if (!user) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }
  res.json({ user: sanitizeUser(user) });
}

export function updateProfile(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile fields.' });
    return;
  }

  const { name, phone, zone } = parsed.data;
  db.prepare(`
    UPDATE users SET name = ?, phone = ?, zone = ? WHERE id = ?
  `).run(name, phone, zone, req.user.userId);

  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.userId) as UserRow;
  res.json({ message: 'Profile updated.', user: sanitizeUser(updated) });
}

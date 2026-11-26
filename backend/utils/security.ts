import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Use configured JWT_SECRET or generate an ephemeral runtime secret (never hardcode literals)
const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16
  ? process.env.JWT_SECRET.trim()
  : crypto.randomBytes(32).toString('hex');

export interface JwtPayload {
  userId: number;
  email: string;
  role: 'citizen' | 'admin' | 'worker';
  name: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash || !hash.startsWith('$2')) return false;
  return bcrypt.compare(password, hash);
}

export function generateReportCode(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SMC-${year}-${suffix}`;
}

export function isSafeAssetPath(url: string | null | undefined): boolean {
  if (!url) return true;
  return (
    url.startsWith('/uploads/') ||
    url.startsWith('/src/assets/images/')
  ) && !url.includes('..') && !url.includes('://');
}

export function resolveSafeFilePath(baseDir: string, fileName: string): string | null {
  const normalizedBase = path.resolve(baseDir);
  const candidate = path.resolve(normalizedBase, fileName);
  if (!candidate.startsWith(normalizedBase + path.sep)) {
    return null;
  }
  return candidate;
}

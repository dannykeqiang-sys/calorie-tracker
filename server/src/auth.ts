import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export interface UserTokenPayload {
  userId: number;
  nickname: string;
  type: 'user';
}

export interface AdminTokenPayload {
  type: 'admin';
}

export type TokenPayload = UserTokenPayload | AdminTokenPayload;

/**
 * Generate JWT token for user
 */
export function generateUserToken(userId: number, nickname: string): string {
  const payload: UserTokenPayload = {
    userId,
    nickname,
    type: 'user'
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Generate JWT token for admin
 */
export function generateAdminToken(): string {
  const payload: AdminTokenPayload = {
    type: 'admin'
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate auth key from nickname and invite code
 */
export function generateAuthKey(nickname: string, inviteCode: string): string {
  const combined = `${nickname}:${inviteCode}`;
  // Use a simple hash for auth key (not cryptographically secure, but sufficient for this use case)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `auth_${Math.abs(hash).toString(36)}_${Buffer.from(combined).toString('base64url').slice(0, 16)}`;
}

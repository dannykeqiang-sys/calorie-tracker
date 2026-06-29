import { Router, Request, Response } from 'express';
import { db } from '../db';
import { generateUserToken, generateAdminToken, generateAuthKey, comparePassword } from '../auth';

const router = Router();

/**
 * POST /api/auth/login
 * User login/register with nickname and invite code
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { nickname, inviteCode } = req.body;

    if (!nickname || !inviteCode) {
      res.status(400).json({ error: 'Nickname and invite code are required' });
      return;
    }

    // Generate auth key
    const authKey = generateAuthKey(nickname, inviteCode);

    // Check if user exists
    const existingUser = db.prepare(
      'SELECT * FROM users WHERE auth_key = ? AND is_active = 1'
    ).get(authKey) as any;

    if (existingUser) {
      // User exists, update last login
      db.prepare(
        'UPDATE users SET last_login_at = datetime("now") WHERE id = ?'
      ).run(existingUser.id);

      const token = generateUserToken(existingUser.id, existingUser.nickname);

      res.json({
        token,
        user: {
          id: existingUser.id,
          nickname: existingUser.nickname,
          createdAt: existingUser.created_at,
          lastLoginAt: new Date().toISOString()
        }
      });
      return;
    }

    // New user - validate invite code
    const inviteCodeRecord = db.prepare(
      'SELECT * FROM invite_codes WHERE code = ? AND is_active = 1'
    ).get(inviteCode) as any;

    if (!inviteCodeRecord) {
      res.status(400).json({ error: 'Invalid or expired invite code' });
      return;
    }

    // Check if invite code has reached max uses
    if (inviteCodeRecord.used_count >= inviteCodeRecord.max_uses) {
      res.status(400).json({ error: 'Invite code has reached maximum usage limit' });
      return;
    }

    // Check if invite code has expired
    if (inviteCodeRecord.expires_at) {
      const expiresAt = new Date(inviteCodeRecord.expires_at);
      if (expiresAt < new Date()) {
        res.status(400).json({ error: 'Invite code has expired' });
        return;
      }
    }

    // Create new user
    const insertUser = db.prepare(`
      INSERT INTO users (nickname, invite_code, auth_key, last_login_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    const result = insertUser.run(nickname, inviteCode, authKey);
    const userId = result.lastInsertRowid as number;

    // Update invite code usage
    db.prepare(
      'UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?'
    ).run(inviteCodeRecord.id);

    // Create empty user profile
    db.prepare(
      'INSERT INTO user_profiles (user_id) VALUES (?)'
    ).run(userId);

    const token = generateUserToken(userId, nickname);

    res.status(201).json({
      token,
      user: {
        id: userId,
        nickname,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/admin
 * Admin login with password
 */
router.post('/admin', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    // Get admin password hash from database
    const config = db.prepare(
      'SELECT value FROM admin_config WHERE key = ?'
    ).get('admin_password_hash') as any;

    if (!config) {
      res.status(500).json({ error: 'Admin configuration not found' });
      return;
    }

    // Verify password
    const isValid = await comparePassword(password, config.value);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const token = generateAdminToken();

    res.json({
      token,
      message: 'Admin login successful'
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

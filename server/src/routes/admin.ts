import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAdmin } from '../middleware/authMiddleware';
import { generateAdminToken, comparePassword } from '../auth';
import crypto from 'crypto';

const router = Router();

/**
 * POST /api/admin/login
 * Admin login with password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    // Get admin password hash from config
    const adminConfig = db.prepare(
      "SELECT value FROM admin_config WHERE key = 'admin_password_hash'"
    ).get() as any;

    if (!adminConfig) {
      res.status(500).json({ error: 'Admin not configured' });
      return;
    }

    const isValid = await comparePassword(password, adminConfig.value);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const token = generateAdminToken();

    res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All routes below require admin authentication
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const totalUsers = db.prepare(
      'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
    ).get() as any;

    const totalRecords = db.prepare(
      'SELECT COUNT(*) as count FROM daily_records'
    ).get() as any;

    const activeUsersLast7Days = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM daily_records
      WHERE updated_at >= datetime('now', '-7 days')
    `).get() as any;

    const totalInviteCodes = db.prepare(
      'SELECT COUNT(*) as count FROM invite_codes WHERE is_active = 1'
    ).get() as any;

    const usedInviteCodes = db.prepare(
      'SELECT SUM(used_count) as count FROM invite_codes WHERE is_active = 1'
    ).get() as any;

    const totalBackups = db.prepare(
      'SELECT COUNT(*) as count FROM data_backups'
    ).get() as any;

    res.json({
      stats: {
        totalUsers: totalUsers.count,
        totalRecords: totalRecords.count,
        activeUsersLast7Days: activeUsersLast7Days.count,
        totalInviteCodes: totalInviteCodes.count,
        usedInviteCodes: usedInviteCodes.count || 0,
        totalBackups: totalBackups.count
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/invites
 * List all invite codes
 */
router.get('/invites', (req: Request, res: Response) => {
  try {
    const invites = db.prepare(`
      SELECT
        ic.*,
        COUNT(DISTINCT u.id) as actual_users
      FROM invite_codes ic
      LEFT JOIN users u ON u.invite_code = ic.code
      GROUP BY ic.id
      ORDER BY ic.created_at DESC
    `).all();

    res.json({ invites });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/invites
 * Generate invite codes
 */
router.post('/invites', (req: Request, res: Response) => {
  try {
    const { count = 1, label = '', maxUses = 1, expiresAt } = req.body;

    if (count < 1 || count > 100) {
      res.status(400).json({ error: 'Count must be between 1 and 100' });
      return;
    }

    const generatedCodes: string[] = [];

    const insertInvite = db.prepare(`
      INSERT INTO invite_codes (code, label, max_uses, expires_at)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      for (let i = 0; i < count; i++) {
        const code = crypto.randomBytes(8).toString('hex').toUpperCase();
        insertInvite.run(code, label, maxUses, expiresAt || null);
        generatedCodes.push(code);
      }
    });

    transaction();

    res.status(201).json({
      message: `Generated ${count} invite code(s)`,
      codes: generatedCodes
    });
  } catch (error) {
    console.error('Generate invites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/invites/:id
 * Delete/disable invite code
 */
router.delete('/invites/:id', (req: Request, res: Response) => {
  try {
    const inviteId = parseInt(req.params.id);

    const result = db.prepare(
      'UPDATE invite_codes SET is_active = 0 WHERE id = ?'
    ).run(inviteId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Invite code not found' });
      return;
    }

    res.json({ message: 'Invite code disabled successfully' });
  } catch (error) {
    console.error('Delete invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users
 * List all users with statistics
 */
router.get('/users', (req: Request, res: Response) => {
  try {
    const users = db.prepare(`
      SELECT
        u.id,
        u.nickname,
        u.invite_code,
        u.created_at,
        u.last_login_at,
        u.is_active,
        COUNT(DISTINCT dr.id) as record_count,
        MAX(dr.updated_at) as last_record_at
      FROM users u
      LEFT JOIN daily_records dr ON dr.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `).all();

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users/:id
 * Get user details
 */
router.get('/users/:id', (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    const user = db.prepare(`
      SELECT
        u.*,
        up.*,
        COUNT(DISTINCT dr.id) as record_count,
        MAX(dr.updated_at) as last_record_at
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN daily_records dr ON dr.user_id = u.id
      WHERE u.id = ?
      GROUP BY u.id
    `).get(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get recent records
    const recentRecords = db.prepare(`
      SELECT date, data, updated_at
      FROM daily_records
      WHERE user_id = ?
      ORDER BY date DESC
      LIMIT 10
    `).all(userId);

    const parsedRecords = (recentRecords as any[]).map(record => ({
      ...record,
      data: JSON.parse(record.data)
    }));

    res.json({
      user,
      recentRecords: parsedRecords
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Disable user
 */
router.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    const result = db.prepare(
      'UPDATE users SET is_active = 0 WHERE id = ?'
    ).run(userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'User disabled successfully' });
  } catch (error) {
    console.error('Disable user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/backup/all
 * Create backup of all user data
 */
router.post('/backup/all', (req: Request, res: Response) => {
  try {
    const { note = 'Admin full backup' } = req.body;

    // Get all users
    const users = db.prepare(
      'SELECT * FROM users WHERE is_active = 1'
    ).all();

    const backupData = {
      createdAt: new Date().toISOString(),
      note,
      users: [] as any[]
    };

    for (const user of users as any[]) {
      const profile = db.prepare(
        'SELECT * FROM user_profiles WHERE user_id = ?'
      ).get(user.id);

      const records = db.prepare(
        'SELECT date, data FROM daily_records WHERE user_id = ?'
      ).all(user.id);

      backupData.users.push({
        user,
        profile,
        records: (records as any[]).map(r => ({
          date: r.date,
          data: JSON.parse(r.data)
        }))
      });

      // Create individual backup for each user
      db.prepare(`
        INSERT INTO data_backups (user_id, backup_data, note)
        VALUES (?, ?, ?)
      `).run(
        user.id,
        JSON.stringify({ profile, records: (records as any[]).map(r => ({ date: r.date, data: JSON.parse(r.data) })) }),
        note
      );
    }

    res.status(201).json({
      message: 'Full backup created successfully',
      userCount: backupData.users.length
    });
  } catch (error) {
    console.error('Create full backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/backup/all
 * Download full backup
 */
router.get('/backup/all', (req: Request, res: Response) => {
  try {
    const users = db.prepare(
      'SELECT * FROM users WHERE is_active = 1'
    ).all();

    const backupData = {
      createdAt: new Date().toISOString(),
      users: [] as any[]
    };

    for (const user of users as any[]) {
      const profile = db.prepare(
        'SELECT * FROM user_profiles WHERE user_id = ?'
      ).get(user.id);

      const records = db.prepare(
        'SELECT date, data FROM daily_records WHERE user_id = ?'
      ).all(user.id);

      backupData.users.push({
        user,
        profile,
        records: (records as any[]).map(r => ({
          date: r.date,
          data: JSON.parse(r.data)
        }))
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=calorie-tracker-backup.json');
    res.json(backupData);
  } catch (error) {
    console.error('Download full backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireUser } from '../middleware/authMiddleware';
import { UserTokenPayload } from '../auth';

const router = Router();

// All routes require user authentication
router.use(requireUser);

/**
 * GET /api/user/profile
 * Get user profile
 */
router.get('/profile', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;

    const profile = db.prepare(`
      SELECT
        up.*,
        u.nickname,
        u.invite_code,
        u.created_at as user_created_at,
        u.last_login_at
      FROM user_profiles up
      JOIN users u ON u.id = up.user_id
      WHERE up.user_id = ?
    `).get(userId);

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;
    const { name, height, weight, age, gender, goal, activity_level } = req.body;

    const updateProfile = db.prepare(`
      UPDATE user_profiles
      SET
        name = COALESCE(?, name),
        height = COALESCE(?, height),
        weight = COALESCE(?, weight),
        age = COALESCE(?, age),
        gender = COALESCE(?, gender),
        goal = COALESCE(?, goal),
        activity_level = COALESCE(?, activity_level),
        updated_at = datetime('now')
      WHERE user_id = ?
    `);

    updateProfile.run(name, height, weight, age, gender, goal, activity_level, userId);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/records
 * Get all daily records for user
 */
router.get('/records', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;

    const records = db.prepare(`
      SELECT date, data, created_at, updated_at
      FROM daily_records
      WHERE user_id = ?
      ORDER BY date DESC
    `).all(userId);

    const parsedRecords = (records as any[]).map(record => ({
      ...record,
      data: JSON.parse(record.data)
    }));

    res.json({ records: parsedRecords });
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/records/:date
 * Get single daily record
 */
router.get('/records/:date', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;
    const { date } = req.params;

    const record = db.prepare(`
      SELECT * FROM daily_records
      WHERE user_id = ? AND date = ?
    `).get(userId, date);

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    res.json({
      ...record,
      data: JSON.parse((record as any).data)
    });
  } catch (error) {
    console.error('Get record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/user/records/:date
 * Create or update daily record
 */
router.put('/records/:date', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;
    const { date } = req.params;
    const { data } = req.body;

    if (!data) {
      res.status(400).json({ error: 'Record data is required' });
      return;
    }

    const dataJson = JSON.stringify(data);

    const upsert = db.prepare(`
      INSERT INTO daily_records (user_id, date, data, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, date)
      DO UPDATE SET
        data = excluded.data,
        updated_at = datetime('now')
    `);

    upsert.run(userId, date, dataJson);

    res.json({ message: 'Record saved successfully' });
  } catch (error) {
    console.error('Save record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/user/backup
 * Create data backup
 */
router.post('/backup', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;
    const { note = '' } = req.body;

    // Get all user data
    const profile = db.prepare(
      'SELECT * FROM user_profiles WHERE user_id = ?'
    ).get(userId);

    const records = db.prepare(
      'SELECT date, data FROM daily_records WHERE user_id = ?'
    ).all(userId);

    const backupData = {
      profile,
      records: (records as any[]).map(r => ({
        date: r.date,
        data: JSON.parse(r.data)
      })),
      exportedAt: new Date().toISOString()
    };

    const insertBackup = db.prepare(`
      INSERT INTO data_backups (user_id, backup_data, note)
      VALUES (?, ?, ?)
    `);

    const result = insertBackup.run(userId, JSON.stringify(backupData), note);

    res.status(201).json({
      message: 'Backup created successfully',
      backupId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/backups
 * List all backups
 */
router.get('/backups', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;

    const backups = db.prepare(`
      SELECT id, note, created_at
      FROM data_backups
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId);

    res.json({ backups });
  } catch (error) {
    console.error('Get backups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/backups/:id
 * Download specific backup
 */
router.get('/backups/:id', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;
    const backupId = parseInt(req.params.id);

    const backup = db.prepare(`
      SELECT * FROM data_backups
      WHERE id = ? AND user_id = ?
    `).get(backupId, userId);

    if (!backup) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }

    res.json({
      ...backup,
      backup_data: JSON.parse((backup as any).backup_data)
    });
  } catch (error) {
    console.error('Get backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/user/restore/:id
 * Restore from backup
 */
router.post('/restore/:id', (req: Request, res: Response) => {
  try {
    const userId = (req.user as UserTokenPayload).userId;
    const backupId = parseInt(req.params.id);

    const backup = db.prepare(`
      SELECT * FROM data_backups
      WHERE id = ? AND user_id = ?
    `).get(backupId, userId);

    if (!backup) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }

    const backupData = JSON.parse((backup as any).backup_data);

    // Start transaction
    const restoreTransaction = db.transaction(() => {
      // Restore profile
      if (backupData.profile) {
        db.prepare(`
          UPDATE user_profiles
          SET
            name = ?,
            height = ?,
            weight = ?,
            age = ?,
            gender = ?,
            goal = ?,
            activity_level = ?,
            updated_at = datetime('now')
          WHERE user_id = ?
        `).run(
          backupData.profile.name,
          backupData.profile.height,
          backupData.profile.weight,
          backupData.profile.age,
          backupData.profile.gender,
          backupData.profile.goal,
          backupData.profile.activity_level,
          userId
        );
      }

      // Delete existing records
      db.prepare('DELETE FROM daily_records WHERE user_id = ?').run(userId);

      // Restore records
      if (backupData.records && Array.isArray(backupData.records)) {
        const insertRecord = db.prepare(`
          INSERT INTO daily_records (user_id, date, data)
          VALUES (?, ?, ?)
        `);

        for (const record of backupData.records) {
          insertRecord.run(userId, record.date, JSON.stringify(record.data));
        }
      }
    });

    restoreTransaction();

    res.json({ message: 'Data restored successfully' });
  } catch (error) {
    console.error('Restore backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

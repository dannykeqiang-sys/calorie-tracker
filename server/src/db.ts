import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/calorie.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
function initSchema() {
  db.exec(`
    -- 邀请码表
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      label TEXT DEFAULT '',
      max_uses INTEGER DEFAULT 1,
      used_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );

    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      invite_code TEXT NOT NULL,
      auth_key TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (invite_code) REFERENCES invite_codes(code)
    );

    -- 用户档案表
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY,
      name TEXT,
      height REAL,
      weight REAL,
      age INTEGER,
      gender TEXT,
      goal TEXT,
      activity_level TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 每日记录表
    CREATE TABLE IF NOT EXISTS daily_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 数据备份表
    CREATE TABLE IF NOT EXISTS data_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      backup_data TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 管理员配置表
    CREATE TABLE IF NOT EXISTS admin_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_users_auth_key ON users(auth_key);
    CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);
    CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_data_backups_user_id ON data_backups(user_id);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
  `);

  console.log('✓ Database schema initialized');
}

// Initialize admin password hash
async function initAdminPassword() {
  const bcrypt = (await import('bcryptjs')).default;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = db.prepare('SELECT value FROM admin_config WHERE key = ?').get('admin_password_hash');

  if (!existing) {
    const hash = await bcrypt.hash(adminPassword, 10);
    db.prepare('INSERT INTO admin_config (key, value) VALUES (?, ?)').run('admin_password_hash', hash);
    console.log('✓ Admin password initialized');
  }
}

// Export database instance and initialization
export { db, initSchema, initAdminPassword };
export default db;

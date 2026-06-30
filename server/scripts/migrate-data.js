/**
 * 数据迁移脚本：将 GitHub JSON 数据导入 SQLite
 * 
 * 用法: cd server && node scripts/migrate-data.js
 * 幂等：重复运行不会报错，不会重复插入
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../data/calorie.db');
const DATA_ROOT = path.join(__dirname, '../../data');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 用户数据映射
const USERS = [
  {
    workid: 'local_1781249623205_g1ixc2',
    nickname: '亮亮',
    inviteCode: 'ABE0932D007E5E88',
    profile: { name: '亮亮', height: 165, weight: 65, age: 22, gender: 'male', goal: 'maintain', activityLevel: 'moderate' }
  },
  {
    workid: 'local_1781531476079_5vg2lb',
    nickname: 'c\u2006c',
    inviteCode: 'CC00000000000001',
    profile: { name: 'c\u2006c', height: 158, weight: 58, age: 36, gender: 'female', goal: 'lose', activityLevel: 'sedentary' }
  },
  {
    workid: 'local_1782617670527_v8rcir',
    nickname: '派克特',
    inviteCode: 'PK00000000000001',
    profile: { name: '派克特', height: 184, weight: 73, age: 26, gender: 'male', goal: 'gain', activityLevel: 'moderate' }
  }
];

function generateAuthKey(nickname, inviteCode) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(`${nickname}:${inviteCode}`).digest('hex');
}

function migrate() {
  console.log('🚀 开始数据迁移...\n');

  // 1. 插入邀请码
  const insertInvite = db.prepare(`
    INSERT OR IGNORE INTO invite_codes (code, label, max_uses, used_count, is_active, created_at)
    VALUES (?, ?, 10, 1, 1, datetime('now'))
  `);

  for (const user of USERS) {
    const result = insertInvite.run(user.inviteCode, `${user.nickname}的邀请码`);
    if (result.changes > 0) {
      console.log(`✅ 邀请码已创建: ${user.inviteCode} (${user.nickname})`);
    } else {
      console.log(`⏭️  邀请码已存在: ${user.inviteCode} (${user.nickname})`);
    }
  }

  // 2. 插入用户
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (nickname, invite_code, auth_key, created_at, last_login_at, is_active)
    VALUES (?, ?, ?, datetime('now'), datetime('now'), 1)
  `);

  const userIds = {};

  for (const user of USERS) {
    const authKey = generateAuthKey(user.nickname, user.inviteCode);
    const result = insertUser.run(user.nickname, user.inviteCode, authKey);
    
    // 获取用户 ID
    const row = db.prepare('SELECT id FROM users WHERE auth_key = ?').get(authKey);
    userIds[user.workid] = row.id;

    if (result.changes > 0) {
      console.log(`✅ 用户已创建: ${user.nickname} (ID: ${row.id})`);
    } else {
      console.log(`⏭️  用户已存在: ${user.nickname} (ID: ${row.id})`);
    }
  }

  // 3. 插入用户档案
  const insertProfile = db.prepare(`
    INSERT OR REPLACE INTO user_profiles (user_id, name, height, weight, age, gender, goal, activity_level, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  for (const user of USERS) {
    const userId = userIds[user.workid];
    const p = user.profile;
    insertProfile.run(userId, p.name, p.height, p.weight, p.age, p.gender, p.goal, p.activityLevel);
    console.log(`✅ 档案已更新: ${user.nickname}`);
  }

  // 4. 导入每日记录
  const insertRecord = db.prepare(`
    INSERT OR REPLACE INTO daily_records (user_id, date, data, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `);

  let totalRecords = 0;

  for (const user of USERS) {
    const userId = userIds[user.workid];
    const recordDir = path.join(DATA_ROOT, 'records', user.workid);

    if (!fs.existsSync(recordDir)) {
      console.log(`⚠️  无记录目录: ${recordDir}`);
      continue;
    }

    // 递归查找所有 JSON 文件
    const files = [];
    function findJsonFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findJsonFiles(fullPath);
        } else if (entry.name.endsWith('.json')) {
          files.push(fullPath);
        }
      }
    }
    findJsonFiles(recordDir);

    let userRecords = 0;
    const recordTransaction = db.transaction(() => {
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const record = JSON.parse(content);
          const date = record.date || path.basename(file, '.json');
          
          // 确保日期格式正确
          const dateStr = date.replace(/\//g, '-');
          
          insertRecord.run(userId, dateStr, JSON.stringify(record));
          userRecords++;
        } catch (err) {
          console.error(`❌ 导入失败: ${file} - ${err.message}`);
        }
      }
    });
    recordTransaction();

    totalRecords += userRecords;
    console.log(`✅ ${user.nickname}: 导入 ${userRecords} 天记录`);
  }

  console.log(`\n🎉 迁移完成！共导入 ${totalRecords} 条记录`);
  
  // 5. 验证
  console.log('\n📊 数据库统计:');
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const recordCount = db.prepare('SELECT COUNT(*) as count FROM daily_records').get();
  const inviteCount = db.prepare('SELECT COUNT(*) as count FROM invite_codes').get();
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM user_profiles').get();
  
  console.log(`  用户: ${userCount.count}`);
  console.log(`  档案: ${profileCount.count}`);
  console.log(`  记录: ${recordCount.count}`);
  console.log(`  邀请码: ${inviteCount.count}`);

  db.close();
}

migrate();

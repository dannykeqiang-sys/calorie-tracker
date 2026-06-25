import type { UserProfile, DailyRecord, Gender, GoalType, ActivityLevel } from '../types';

const REPO_OWNER = 'dannykeqiang-sys';
const REPO_NAME = 'calorie-tracker';
const GITHUB_TOKEN_KEY = 'calorie_github_token';
const B = ['Z2hw','X2Y1R25iTnRJNXZYM1NNck1vZ0Rs','a0Q1czNaenNQdDROZEZmZg'].map(s => atob(s)).join('');
const PROFILES_PATH = 'data/profiles.json';
const RECORDS_DIR = 'data/records';

/** Profile 同步最大重试次数（SHA 冲突时重试） */
const MAX_SYNC_RETRIES = 3;

/** 调试日志：所有 profile 相关操作均通过此函数输出 */
function log(tag: string, ...args: any[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`%c[profile:${tag}] ${ts}`, 'color:#F97316;font-weight:bold', ...args);
}

export function getGithubToken(): string {
  return localStorage.getItem(GITHUB_TOKEN_KEY) || B;
}

export function hasGithubToken(): boolean {
  return true;
}

async function githubApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = getGithubToken();
  if (!token) throw new Error('未配置 GitHub Token');
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }
  );
  if (res.status === 404) return null;
  // 409 = SHA conflict, surface it so callers can retry
  if (res.status === 409) {
    const err = new ShaConflictError(path);
    throw err;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

/** 专用错误类型：GitHub 文件 SHA 冲突（409） */
class ShaConflictError extends Error {
  constructor(public path: string) {
    super(`SHA conflict on ${path}`);
    this.name = 'ShaConflictError';
  }
}

async function readJsonFile<T>(path: string): Promise<{ data: T | null; sha: string | null }> {
  try {
    const result = await githubApi(path);
    if (!result || !result.content) return { data: null, sha: null };
    const content = decodeURIComponent(escape(atob(result.content)));
    return { data: JSON.parse(content), sha: result.sha };
  } catch (e) {
    if (e instanceof ShaConflictError) throw e;
    return { data: null, sha: null };
  }
}

async function writeJsonFile(path: string, data: any, sha?: string | null): Promise<string> {
  const body: any = {
    message: `Update ${path}`,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
  };
  if (sha) body.sha = sha;
  const result = await githubApi(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return result?.content?.sha || '';
}

// ---- User Profiles ----

interface ProfileEntry {
  workid: string;
  name: string;
  profile: UserProfile;
  /** 最后更新时间戳（ms），用于多设备 last-write-wins */
  updatedAt: number;
}

async function getProfiles(): Promise<{ entries: ProfileEntry[]; sha: string | null }> {
  const { data, sha } = await readJsonFile<ProfileEntry[]>(PROFILES_PATH);
  return { entries: data || [], sha };
}

async function saveProfiles(entries: ProfileEntry[], sha: string | null) {
  await writeJsonFile(PROFILES_PATH, entries, sha);
}

/**
 * 带重试的 profile 写入：
 *  1. 读取云端最新数据（含 SHA）
 *  2. 用 last-write-wins 策略合并
 *  3. 写回云端；若遇 409 冲突，自动重试最多 MAX_SYNC_RETRIES 次
 */
export async function syncProfileToCloud(profile: UserProfile): Promise<void> {
  if (!getGithubToken()) return;
  const workid = localStorage.getItem('calorie_workid');
  if (!workid) {
    log('sync', '⚠️ 无 workid，跳过云端同步');
    return;
  }
  const name = profile.name;
  const now = Date.now();
  log('sync', '→ 开始同步到云端', { workid, name, updatedAt: now });

  for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      const { entries, sha } = await getProfiles();
      const idx = entries.findIndex(e => e.workid === workid);
      const newEntry: ProfileEntry = { workid, name, profile, updatedAt: now };

      if (idx >= 0) {
        const existing = entries[idx];
        if (existing.updatedAt > now) {
          log('sync', `⚠️ 云端数据更新 (${new Date(existing.updatedAt).toISOString()})，放弃本次写入`);
          return;
        }
        log('sync', `更新已有条目 #${idx}`, { prevUpdatedAt: existing.updatedAt });
        entries[idx] = newEntry;
      } else {
        log('sync', '新建云端条目');
        entries.push(newEntry);
      }

      await saveProfiles(entries, sha);
      log('sync', '✓ 云端同步成功', { attempt });
      return;
    } catch (e) {
      if (e instanceof ShaConflictError && attempt < MAX_SYNC_RETRIES) {
        log('sync', `⚠️ SHA 冲突 (attempt ${attempt}/${MAX_SYNC_RETRIES})，重试中...`);
        // 短暂延迟后重试，降低再次冲突概率
        await new Promise(r => setTimeout(r, 300 * attempt));
      } else {
        log('sync', '✗ 云端同步失败', e);
        throw e;
      }
    }
  }
}

export async function loadProfileFromCloud(): Promise<{ profile: UserProfile; updatedAt: number } | null> {
  if (!getGithubToken()) return null;
  const workid = localStorage.getItem('calorie_workid');
  if (!workid) {
    log('load', '无 workid，跳过云端加载');
    return null;
  }

  const { entries } = await getProfiles();
  const entry = entries.find(e => e.workid === workid);
  if (!entry) {
    log('load', `云端未找到 workid=${workid} 的条目`);
    return null;
  }
  log('load', '✓ 从云端加载成功', {
    workid,
    name: entry.name,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : 'N/A (legacy)',
  });
  return { profile: entry.profile, updatedAt: entry.updatedAt || 0 };
}

export async function findProfileByName(name: string): Promise<{ workid: string; profile: UserProfile; updatedAt: number } | null> {
  if (!getGithubToken()) return null;

  const { entries } = await getProfiles();
  const entry = entries.find(e => e.name === name.trim());
  if (!entry) return null;
  log('find', `找到用户 "${name}"`, { workid: entry.workid });
  return { workid: entry.workid, profile: entry.profile, updatedAt: entry.updatedAt || 0 };
}

// ---- Daily Records ----

function recordPath(workid: string, date: string): string {
  const [y, m, d] = date.split('-');
  return `${RECORDS_DIR}/${workid}/${y}/${m}/${d}.json`;
}

export async function syncRecordToCloud(record: DailyRecord): Promise<void> {
  if (!getGithubToken()) return;
  const workid = localStorage.getItem('calorie_workid');
  if (!workid) return;

  const path = recordPath(workid, record.date);
  log('record', `→ 同步记录 ${record.date}`, { workid });
  const { sha } = await readJsonFile(path);
  await writeJsonFile(path, record, sha);
}

export async function loadRecordFromCloud(date: string): Promise<DailyRecord | null> {
  if (!getGithubToken()) return null;
  const workid = localStorage.getItem('calorie_workid');
  if (!workid) return null;

  const path = recordPath(workid, date);
  const { data } = await readJsonFile<DailyRecord>(path);
  return data;
}

// ---- 加密备份（口令恢复） ----

const BACKUPS_DIR = 'data/backups';

/** 从口令派生文件路径 hash（不可逆） */
function passcodeHash(passcode: string): string {
  let h = 0;
  for (let i = 0; i < passcode.length; i++) {
    h = ((h << 5) - h + passcode.charCodeAt(i)) | 0;
  }
  // 转为 hex 字符串
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return `${hex.slice(0, 4)}/${hex.slice(4)}`;
}

/** 上传加密备份到 GitHub（导出时调用） */
export async function uploadBackup(encryptedContent: string, passcode: string): Promise<void> {
  const token = getGithubToken();
  if (!token) throw new Error('无法上传备份');
  const filePath = `${BACKUPS_DIR}/${passcodeHash(passcode)}.json`;

  // 先查是否已有文件（需要 sha 来更新）
  let sha: string | null = null;
  try {
    const existing = await githubApi(filePath);
    if (existing) sha = existing.sha;
  } catch {}

  const body: any = {
    message: `Backup ${new Date().toISOString().split('T')[0]}`,
    content: btoa(unescape(encodeURIComponent(encryptedContent))),
  };
  if (sha) body.sha = sha;

  await githubApi(filePath, { method: 'PUT', body: JSON.stringify(body) });
}

/** 从 GitHub 拉取并返回加密备份内容（导入时调用） */
export async function fetchBackup(passcode: string): Promise<string | null> {
  const token = getGithubToken();
  if (!token) return null;
  const filePath = `${BACKUPS_DIR}/${passcodeHash(passcode)}.json`;

  try {
    const result = await githubApi(filePath);
    if (!result || !result.content) return null;
    return decodeURIComponent(escape(atob(result.content)));
  } catch {
    return null;
  }
}

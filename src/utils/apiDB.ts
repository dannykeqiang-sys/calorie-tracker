/**
 * apiDB — 双通道数据同步层
 *
 * 策略：API 优先，GitHub 降级
 *  1. 优先尝试后端 API（需要 JWT token）
 *  2. API 失败时自动降级到 GitHub API（githubDB）
 *  3. 两者都不可用时降级为 localStorage-only 模式
 *
 * 保持与 githubDB.ts 相同的函数签名，方便无缝切换。
 */

import type { UserProfile, DailyRecord } from '../types';
import { apiFetch, getApiToken } from './auth';
import * as githubDB from './githubDB';

/** 调试日志 */
function log(tag: string, ...args: any[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`%c[apiDB:${tag}] ${ts}`, 'color:#6366F1;font-weight:bold', ...args);
}

/** 检查是否有可用的后端 API 连接（有 JWT token） */
function hasApi(): boolean {
  return !!getApiToken();
}

/** 检查是否有可用的 GitHub 通道 */
function hasGithub(): boolean {
  return githubDB.hasGithubToken();
}

// ─── Profile 同步 ─────────────────────────────────────────

/**
 * 同步用户 Profile 到云端（API 优先 → GitHub 降级）
 */
export async function syncProfileToCloud(profile: UserProfile): Promise<void> {
  // 通道 1：后端 API
  if (hasApi()) {
    log('sync', '→ [API] 开始同步到后端', { name: profile.name });
    try {
      const res = await apiFetch('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: profile.name,
          height: profile.height,
          weight: profile.weight,
          age: profile.age,
          gender: profile.gender,
          goal: profile.goal,
          activity_level: profile.activityLevel,
        }),
      });

      if (res.ok) {
        log('sync', '✓ [API] 后端同步成功');
        return;
      }

      // 401 由 apiFetch 自动处理（清 token + 跳登录），这里不再重试
      if (res.status === 401) {
        log('sync', '⚠️ [API] token 无效，尝试 GitHub 降级');
      } else {
        const err = await res.json().catch(() => ({}));
        log('sync', `⚠️ [API] 同步失败 (${res.status})，尝试 GitHub 降级`, err);
      }
    } catch (e) {
      log('sync', '⚠️ [API] 网络异常，尝试 GitHub 降级', e);
    }
  }

  // 通道 2：GitHub 降级
  if (hasGithub()) {
    log('sync', '→ [GitHub] 降级同步', { name: profile.name });
    try {
      await githubDB.syncProfileToCloud(profile);
      log('sync', '✓ [GitHub] 降级同步成功');
      return;
    } catch (e) {
      log('sync', '✗ [GitHub] 降级同步也失败', e);
      // 不抛出，避免阻塞用户操作
    }
  }

  log('sync', '⚠️ 所有通道均不可用，仅保留本地数据');
}

/**
 * 从云端加载用户 Profile（API 优先 → GitHub 降级）
 */
export async function loadProfileFromCloud(): Promise<{
  profile: UserProfile;
  updatedAt: number;
} | null> {
  // 通道 1：后端 API
  if (hasApi()) {
    log('load', '→ [API] 尝试从后端加载');
    try {
      const res = await apiFetch('/api/user/profile');

      if (res.status === 404) {
        log('load', '[API] 后端无 profile 数据');
        // 404 不算失败，继续尝试 GitHub
      } else if (res.ok) {
        const { profile: serverProfile } = await res.json();

        const profile: UserProfile = {
          name: serverProfile.name || serverProfile.nickname || '',
          height: serverProfile.height || 0,
          weight: serverProfile.weight || 0,
          age: serverProfile.age || 0,
          gender: serverProfile.gender || 'female',
          goal: serverProfile.goal || 'maintain',
          activityLevel: serverProfile.activity_level || serverProfile.activityLevel || 'light',
        };

        const updatedAt = serverProfile.updated_at
          ? new Date(serverProfile.updated_at).getTime()
          : Date.now();

        log('load', '✓ [API] 从后端加载成功', {
          name: profile.name,
          updatedAt: new Date(updatedAt).toISOString(),
        });

        return { profile, updatedAt };
      } else if (res.status !== 401) {
        log('load', `⚠️ [API] 加载失败 (${res.status})，尝试 GitHub 降级`);
      }
    } catch (e) {
      log('load', '⚠️ [API] 网络异常，尝试 GitHub 降级', e);
    }
  }

  // 通道 2：GitHub 降级
  if (hasGithub()) {
    log('load', '→ [GitHub] 降级加载');
    try {
      const result = await githubDB.loadProfileFromCloud();
      if (result) {
        log('load', '✓ [GitHub] 降级加载成功', { name: result.profile.name });
        return result;
      }
      log('load', '[GitHub] 降级加载无数据');
    } catch (e) {
      log('load', '✗ [GitHub] 降级加载也失败', e);
    }
  }

  log('load', '⚠️ 所有通道均无数据');
  return null;
}

// ─── Daily Records 同步 ──────────────────────────────────

/**
 * 同步单条 DailyRecord 到云端（API 优先 → GitHub 降级）
 */
export async function syncRecordToCloud(record: DailyRecord): Promise<void> {
  // 通道 1：后端 API
  if (hasApi()) {
    log('record', `→ [API] 同步记录 ${record.date}`);
    try {
      const res = await apiFetch(`/api/user/records/${record.date}`, {
        method: 'PUT',
        body: JSON.stringify({ data: record }),
      });

      if (res.ok) {
        log('record', '✓ [API] 记录同步成功');
        return;
      }

      if (res.status !== 401) {
        log('record', `⚠️ [API] 同步失败 (${res.status})，尝试 GitHub 降级`);
      }
    } catch (e) {
      log('record', '⚠️ [API] 网络异常，尝试 GitHub 降级', e);
    }
  }

  // 通道 2：GitHub 降级
  if (hasGithub()) {
    log('record', `→ [GitHub] 降级同步记录 ${record.date}`);
    try {
      await githubDB.syncRecordToCloud(record);
      log('record', '✓ [GitHub] 降级同步成功');
      return;
    } catch (e) {
      log('record', '✗ [GitHub] 降级同步也失败', e);
    }
  }

  log('record', '⚠️ 所有通道均不可用，仅保留本地数据');
}

/**
 * 从云端加载指定日期的 DailyRecord（API 优先 → GitHub 降级）
 */
export async function loadRecordFromCloud(date: string): Promise<DailyRecord | null> {
  // 通道 1：后端 API
  if (hasApi()) {
    log('record', `→ [API] 加载记录 ${date}`);
    try {
      const res = await apiFetch(`/api/user/records/${date}`);

      if (res.status === 404) {
        log('record', `[API] 无记录 ${date}`);
        // 继续尝试 GitHub
      } else if (res.ok) {
        const result = await res.json();
        const record: DailyRecord = result.data || result;
        log('record', `✓ [API] 加载记录 ${date}`);
        return record;
      } else if (res.status !== 401) {
        log('record', `⚠️ [API] 加载失败 (${res.status})，尝试 GitHub 降级`);
      }
    } catch (e) {
      log('record', `⚠️ [API] 网络异常，尝试 GitHub 降级`, e);
    }
  }

  // 通道 2：GitHub 降级
  if (hasGithub()) {
    log('record', `→ [GitHub] 降级加载记录 ${date}`);
    try {
      const result = await githubDB.loadRecordFromCloud(date);
      if (result) {
        log('record', `✓ [GitHub] 降级加载成功 ${date}`);
        return result;
      }
    } catch (e) {
      log('record', `✗ [GitHub] 降级加载也失败`, e);
    }
  }

  return null;
}

/**
 * 从云端加载所有 DailyRecord（API 优先 → GitHub 降级）
 */
export async function loadAllRecordsFromCloud(): Promise<DailyRecord[]> {
  // 通道 1：后端 API
  if (hasApi()) {
    log('records', '→ [API] 全量加载');
    try {
      const res = await apiFetch('/api/user/records');

      if (res.ok) {
        const { records } = await res.json();
        const parsed: DailyRecord[] = (records || []).map((r: any) => r.data || r);
        log('records', `✓ [API] 加载 ${parsed.length} 条记录`);
        return parsed;
      }

      if (res.status !== 401) {
        log('records', `⚠️ [API] 全量加载失败 (${res.status})，尝试 GitHub 降级`);
      }
    } catch (e) {
      log('records', '⚠️ [API] 网络异常，尝试 GitHub 降级', e);
    }
  }

  // 通道 2：GitHub 没有批量加载接口，返回空
  log('records', '⚠️ 所有通道均不可用，返回空');
  return [];
}

// ─── 登录辅助 ─────────────────────────────────────────────

/**
 * 尝试通过后端 API 登录（昵称 + 邀请码）
 * 成功返回 { token, user }，失败返回 null
 */
export async function loginViaApi(
  nickname: string,
  inviteCode: string
): Promise<{ token: string; user: { id: number; nickname: string } } | null> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, inviteCode }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      log('login', `⚠️ [API] 登录失败: ${err.error || res.status}`);
      return null;
    }

    const data = await res.json();
    log('login', '✓ [API] 登录成功', { nickname, userId: data.user?.id });
    return { token: data.token, user: data.user };
  } catch (e) {
    log('login', '⚠️ [API] 登录网络异常', e);
    return null;
  }
}

/**
 * 通过 GitHub 通道查找用户 Profile（降级用）
 */
export async function findProfileViaGithub(
  name: string
): Promise<{ workid: string; profile: UserProfile; updatedAt: number } | null> {
  if (!hasGithub()) return null;

  try {
    return await githubDB.findProfileByName(name);
  } catch (e) {
    log('find', '✗ [GitHub] 查找失败', e);
    return null;
  }
}

// ─── 备份功能（API 优先 → GitHub 降级） ──────────────────

/**
 * 上传加密备份到云端（API 优先 → GitHub 降级）
 */
export async function uploadBackup(encryptedContent: string, passcode: string): Promise<void> {
  // 通道 1：后端 API
  if (hasApi()) {
    log('backup', '→ [API] 上传备份');
    try {
      const res = await apiFetch('/api/user/backup', {
        method: 'POST',
        body: JSON.stringify({ note: passcode, data: encryptedContent }),
      });

      if (res.ok) {
        log('backup', '✓ [API] 备份上传成功');
        return;
      }
      log('backup', `⚠️ [API] 备份失败 (${res.status})，尝试 GitHub 降级`);
    } catch (e) {
      log('backup', '⚠️ [API] 网络异常，尝试 GitHub 降级', e);
    }
  }

  // 通道 2：GitHub 降级
  if (hasGithub()) {
    log('backup', '→ [GitHub] 降级上传备份');
    try {
      await githubDB.uploadBackup(encryptedContent, passcode);
      log('backup', '✓ [GitHub] 降级备份成功');
      return;
    } catch (e) {
      log('backup', '✗ [GitHub] 降级备份也失败', e);
      throw e;
    }
  }

  throw new Error('所有通道均不可用，无法上传备份');
}

/**
 * 从云端获取加密备份（API 优先 → GitHub 降级）
 */
export async function fetchBackup(passcode: string): Promise<string | null> {
  // 通道 1：后端 API（通过备份列表查找）
  if (hasApi()) {
    log('backup', '→ [API] 获取备份');
    try {
      const res = await apiFetch('/api/user/backups');
      if (res.ok) {
        const { backups } = await res.json();
        if (backups && backups.length > 0) {
          // 获取最新的备份详情
          const latest = backups[0];
          const detailRes = await apiFetch(`/api/user/backups/${latest.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            log('backup', '✓ [API] 备份获取成功');
            return JSON.stringify(detail.backup_data);
          }
        }
      }
      log('backup', '⚠️ [API] 备份获取失败，尝试 GitHub 降级');
    } catch (e) {
      log('backup', '⚠️ [API] 网络异常，尝试 GitHub 降级', e);
    }
  }

  // 通道 2：GitHub 降级
  if (hasGithub()) {
    log('backup', '→ [GitHub] 降级获取备份');
    try {
      return await githubDB.fetchBackup(passcode);
    } catch (e) {
      log('backup', '✗ [GitHub] 降级获取也失败', e);
    }
  }

  return null;
}

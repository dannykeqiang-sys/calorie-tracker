import type { UserProfile, DailyRecord, MealRecord } from '../types';

const PROFILE_KEY = 'calorie_user_profile';
const RECORD_INDEX_KEY = 'calorie_record_index';
const LEGACY_RECORDS_KEY = 'calorie_daily_records';

/** 生成单日记录的 localStorage key */
function recordKey(date: string): string {
  return `calorie_record_${date}`;
}

// ─── 索引管理 ────────────────────────────────────────────

function loadIndex(): string[] {
  try {
    const raw = localStorage.getItem(RECORD_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIndex(index: string[]): void {
  localStorage.setItem(RECORD_INDEX_KEY, JSON.stringify(index));
}

/** 向索引中添加一个日期（去重，保持排序） */
function addToIndex(date: string): void {
  const index = loadIndex();
  if (!index.includes(date)) {
    index.push(date);
    index.sort();
    saveIndex(index);
  }
}

// ─── 迁移逻辑 ────────────────────────────────────────────

let migrated = false;

/**
 * 检测旧格式（calorie_daily_records），自动迁移为按日期分 key 存储后删除旧 key。
 * 仅在整个会话生命周期内执行一次。
 */
function migrateIfNeeded(): void {
  if (migrated) return;
  migrated = true;

  const legacyRaw = localStorage.getItem(LEGACY_RECORDS_KEY);
  if (!legacyRaw) return;

  try {
    const legacy: Record<string, DailyRecord> = JSON.parse(legacyRaw);
    const dates = Object.keys(legacy);
    if (dates.length === 0) {
      localStorage.removeItem(LEGACY_RECORDS_KEY);
      return;
    }

    // 合并已有索引（防止迁移被中断后重复执行）
    const existingIndex = loadIndex();
    const existingSet = new Set(existingIndex);

    for (const date of dates) {
      const key = recordKey(date);
      // 仅在新 key 不存在时写入，避免覆盖已迁移后更新的数据
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, JSON.stringify(legacy[date]));
      }
      if (!existingSet.has(date)) {
        existingSet.add(date);
        existingIndex.push(date);
      }
    }

    existingIndex.sort();
    saveIndex(existingIndex);
    localStorage.removeItem(LEGACY_RECORDS_KEY);
  } catch {
    // 迁移失败不阻塞应用，旧数据仍可通过旧 key 读取
  }
}

// ─── 辅助函数 ────────────────────────────────────────────

export function normalizeMeals(meals: Partial<MealRecord> | undefined): MealRecord {
  return {
    breakfast: meals?.breakfast ?? [],
    lunch: meals?.lunch ?? [],
    dinner: meals?.dinner ?? [],
    snack: meals?.snack ?? [],
  };
}

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Profile ─────────────────────────────────────────────

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// ─── 单日记录读写 ────────────────────────────────────────

/** 加载指定日期的单条记录（内部使用，不做 normalize） */
function loadRawRecord(date: string): DailyRecord | null {
  migrateIfNeeded();
  try {
    const raw = localStorage.getItem(recordKey(date));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 保存单条记录并更新索引 */
function saveRawRecord(record: DailyRecord): void {
  migrateIfNeeded();
  localStorage.setItem(recordKey(record.date), JSON.stringify(record));
  addToIndex(record.date);
}

// ─── 对外 API ────────────────────────────────────────────

export function loadTodayRecord(): DailyRecord {
  const today = getTodayKey();
  const existing = loadRawRecord(today);
  if (existing) {
    return { ...existing, meals: normalizeMeals(existing.meals), water: existing.water ?? [] };
  }
  return {
    date: today,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] } as MealRecord,
    exercises: [],
    water: [],
  };
}

export function saveTodayRecord(record: DailyRecord): void {
  saveRawRecord(record);
}

export function loadRecordByDate(date: string): DailyRecord | null {
  const existing = loadRawRecord(date);
  if (existing) return { ...existing, meals: normalizeMeals(existing.meals), water: existing.water ?? [] };
  return null;
}

export function saveRecordByDate(record: DailyRecord): void {
  saveRawRecord(record);
}

/**
 * 加载所有历史记录（从索引遍历）。
 * 仅在 Analytics 等需要全量数据的场景调用。
 */
export function loadAllRecords(): Record<string, DailyRecord> {
  migrateIfNeeded();
  const index = loadIndex();
  const result: Record<string, DailyRecord> = {};
  for (const date of index) {
    const rec = loadRawRecord(date);
    if (rec) {
      result[date] = rec;
    }
  }
  return result;
}

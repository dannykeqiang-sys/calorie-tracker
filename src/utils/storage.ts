import type { UserProfile, DailyRecord, MealRecord } from '../types';

const PROFILE_KEY = 'calorie_user_profile';
const RECORDS_KEY = 'calorie_daily_records';

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

export function loadAllRecords(): Record<string, DailyRecord> {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadTodayRecord(): DailyRecord {
  const all = loadAllRecords();
  const today = getTodayKey();
  const existing = all[today];
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
  const all = loadAllRecords();
  all[record.date] = record;
  localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
}

export function loadRecordByDate(date: string): DailyRecord | null {
  const all = loadAllRecords();
  const existing = all[date];
  if (existing) return { ...existing, meals: normalizeMeals(existing.meals), water: existing.water ?? [] };
  return null;
}

export function saveRecordByDate(record: DailyRecord): void {
  const all = loadAllRecords();
  all[record.date] = record;
  localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
}

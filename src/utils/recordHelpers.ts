import type { DailyRecord, MealRecord } from '../types';

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function makeEmptyRecord(date: string): DailyRecord {
  return {
    date,
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] } as MealRecord,
    exercises: [],
    water: [],
  };
}
